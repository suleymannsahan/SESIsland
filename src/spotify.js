'use strict';
// Spotify Web API client for Ada: PKCE login through the browser, token storage, a polling
// loop for the player state, and the controls the island needs.
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const AUTH_PORT = 47822;
const REDIRECT_URI = `http://127.0.0.1:${AUTH_PORT}/callback`;
const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'user-library-modify',
  'playlist-modify-private',
  'playlist-modify-public',
].join(' ');
// Scopes added after the first release; an older login has to be renewed to get them.
const NEW_SCOPES = ['playlist-modify-private', 'playlist-modify-public'];
const API = 'https://api.spotify.com/v1';
const ACCOUNTS = 'https://accounts.spotify.com';

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

class SpotifyError extends Error {
  constructor(status, message, reason) {
    super(message);
    this.status = status;
    this.reason = reason || '';
  }
}

class Spotify extends EventEmitter {
  /**
   * @param {string} dir   userData folder
   * @param {object} vault { encrypt(str): Buffer|null, decrypt(Buffer): string|null } (Electron safeStorage)
   * @param {object} opts  { fetch, api, accounts } — overridable for tests
   */
  constructor(dir, vault, opts = {}) {
    super();
    this.file = path.join(dir, 'spotify.json');
    this.vault = vault;
    this.fetch = opts.fetch || globalThis.fetch;
    this.api = opts.api || API;
    this.accounts = opts.accounts || ACCOUNTS;
    this.clientId = '';
    this.refreshToken = '';
    this.accessToken = '';
    this.expiresAt = 0;
    this.userId = '';
    this.scopes = '';
    this.state = null;          // last player state pushed to the UI
    this.timer = null;
    this.pollMs = 2000;
    this.likedCache = new Map();
    this.authServer = null;
    this.load();
  }

  // ------------------------------------------------------------ storage
  load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.clientId = raw.clientId || '';
      this.scopes = raw.scopes || '';
      if (raw.refresh) {
        const buf = Buffer.from(raw.refresh, 'base64');
        this.refreshToken = (raw.enc && this.vault ? this.vault.decrypt(buf) : buf.toString('utf8')) || '';
      }
    } catch { /* first run */ }
  }

  save() {
    let refresh = '';
    let enc = false;
    if (this.refreshToken) {
      const e = this.vault && this.vault.encrypt(this.refreshToken);
      if (e) { refresh = e.toString('base64'); enc = true; } else refresh = Buffer.from(this.refreshToken).toString('base64');
    }
    try {
      fs.writeFileSync(this.file, JSON.stringify({ clientId: this.clientId, refresh, enc, scopes: this.scopes }, null, 2));
    } catch { /* best effort */ }
  }

  status() {
    return {
      configured: !!this.clientId,
      connected: !!this.refreshToken,
      // true when the saved login predates "add to playlist" and must be renewed once
      needsReauth: !!this.refreshToken && !!this.scopes && NEW_SCOPES.some((x) => !this.scopes.split(' ').includes(x)),
      clientId: this.clientId,
      redirectUri: REDIRECT_URI,
    };
  }

  setClientId(id) {
    id = String(id || '').trim();
    if (!/^[0-9a-f]{32}$/i.test(id)) throw new Error('Client ID 32 karakterlik bir kod olmalı (0-9, a-f).');
    if (id !== this.clientId) { this.refreshToken = ''; this.accessToken = ''; }
    this.clientId = id;
    this.save();
    this.emit('status', this.status());
  }

  disconnect() {
    this.stop();
    this.refreshToken = '';
    this.accessToken = '';
    this.expiresAt = 0;
    this.state = null;
    this.save();
    this.emit('status', this.status());
    this.emit('state', this.publicState());
  }

  // ------------------------------------------------------------ login (PKCE)
  /** Starts the loopback server and returns the URL to open in the browser. */
  beginLogin() {
    if (!this.clientId) throw new Error('Önce Client ID gir.');
    const verifier = b64url(crypto.randomBytes(48));
    const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
    const stateTok = b64url(crypto.randomBytes(12));
    this.closeAuthServer();

    return new Promise((resolve, reject) => {
      const srv = http.createServer(async (req, res) => {
        const url = new URL(req.url, REDIRECT_URI);
        if (url.pathname !== '/callback') { res.writeHead(404); return res.end(); }
        const page = (title, body) => {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<!doctype html><meta charset="utf-8"><title>Ada</title><body style="font-family:Segoe UI,system-ui;background:#1a2533;color:#e8eef3;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><h2 style="font-weight:600">${title}</h2><p style="color:#93a3b4">${body}</p></div>`);
        };
        if (url.searchParams.get('state') !== stateTok) { page('Bağlantı başarısız', 'Güvenlik kodu eşleşmedi. Ada\'dan tekrar dene.'); return; }
        const err = url.searchParams.get('error');
        if (err) { page('Bağlantı iptal edildi', 'Ada\'dan istediğin zaman tekrar bağlanabilirsin.'); this.closeAuthServer(); this.emit('login', { ok: false, error: err }); return; }
        try {
          await this.exchange(url.searchParams.get('code'), verifier);
          page('Spotify bağlandı', 'Bu sekmeyi kapatabilirsin.');
          this.emit('status', this.status());
          this.emit('login', { ok: true });
          this.start();
        } catch (e) {
          page('Bağlantı başarısız', String(e.message));
          this.emit('login', { ok: false, error: e.message });
        }
        this.closeAuthServer();
      });
      srv.on('error', (e) => reject(e.code === 'EADDRINUSE' ? new Error(`Port ${AUTH_PORT} kullanımda`) : e));
      srv.listen(AUTH_PORT, '127.0.0.1', () => {
        this.authServer = srv;
        // Give up after 5 minutes.
        this.authTimer = setTimeout(() => this.closeAuthServer(), 5 * 60 * 1000);
        const q = new URLSearchParams({
          client_id: this.clientId,
          response_type: 'code',
          redirect_uri: REDIRECT_URI,
          code_challenge_method: 'S256',
          code_challenge: challenge,
          scope: SCOPES,
          state: stateTok,
        });
        resolve(`${this.accounts}/authorize?${q}`);
      });
    });
  }

  closeAuthServer() {
    clearTimeout(this.authTimer);
    if (this.authServer) { try { this.authServer.close(); } catch { /* already closed */ } }
    this.authServer = null;
  }

  async tokenRequest(params) {
    const res = await this.fetch(`${this.accounts}/api/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: this.clientId, ...params }).toString(),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new SpotifyError(res.status, j.error_description || j.error || `Token hatası (${res.status})`, j.error);
    this.accessToken = j.access_token;
    this.expiresAt = Date.now() + (j.expires_in || 3600) * 1000 - 60 * 1000;
    if (j.scope && j.scope !== this.scopes) { this.scopes = j.scope; this.save(); this.emit('status', this.status()); }
    if (j.refresh_token) { this.refreshToken = j.refresh_token; this.save(); }
  }

  exchange(code, verifier) {
    return this.tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI, code_verifier: verifier });
  }

  async token() {
    if (this.accessToken && Date.now() < this.expiresAt) return this.accessToken;
    if (!this.refreshToken) throw new SpotifyError(401, 'Spotify bağlı değil', 'not_connected');
    try {
      await this.tokenRequest({ grant_type: 'refresh_token', refresh_token: this.refreshToken });
    } catch (e) {
      if (e.status === 400 || e.status === 401) {
        // Refresh token revoked or the app was changed: ask to log in again.
        this.refreshToken = '';
        this.save();
        this.emit('status', this.status());
      }
      throw e;
    }
    return this.accessToken;
  }

  // ------------------------------------------------------------ API
  async call(method, p, body) {
    const t = await this.token();
    const res = await this.fetch(this.api + p, {
      method,
      headers: { Authorization: `Bearer ${t}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return null;
    if (res.status === 429) {
      const wait = Number(res.headers.get('retry-after') || 5);
      this.backoffUntil = Date.now() + wait * 1000;
      throw new SpotifyError(429, 'Spotify çok fazla istek dedi, biraz bekleniyor', 'rate');
    }
    const text = await res.text();
    let j = null;
    try { j = text ? JSON.parse(text) : null; } catch { j = null; }
    if (!res.ok) {
      const e = (j && j.error) || {};
      if (res.status === 401) this.accessToken = '';
      throw new SpotifyError(res.status, e.message || `Spotify hatası (${res.status})`, e.reason);
    }
    return j;
  }

  // ------------------------------------------------------------ polling
  start() {
    if (!this.refreshToken) return;
    this.stop();
    const tick = async () => {
      if (Date.now() < (this.backoffUntil || 0)) { this.timer = setTimeout(tick, 1000); return; }
      try {
        await this.refresh();
      } catch (e) {
        if (e.reason === 'not_connected') return this.emit('state', this.publicState());
        this.emit('error', e);
      }
      const playing = this.state && this.state.isPlaying;
      this.timer = setTimeout(tick, playing ? this.pollMs : this.pollMs * 2.5);
    };
    tick();
  }

  stop() {
    clearTimeout(this.timer);
    this.timer = null;
  }

  /** Fetches /me/player and emits the new state. */
  async refresh() {
    const p = await this.call('GET', '/me/player?additional_types=episode');
    const prevId = this.state && this.state.track && this.state.track.id;
    if (!p || !p.item) {
      this.state = p ? { ...this.base(p), track: null } : null;
    } else {
      const it = p.item;
      const isEp = it.type === 'episode';
      const images = (isEp ? it.images : it.album && it.album.images) || [];
      const track = {
        id: it.id,
        uri: it.uri,
        name: it.name,
        artists: isEp ? (it.show && it.show.name) || '' : (it.artists || []).map((a) => a.name).join(', '),
        firstArtist: isEp ? '' : ((it.artists || [])[0] || {}).name || '',
        album: isEp ? '' : (it.album && it.album.name) || '',
        cover: (images[images.length > 1 ? 1 : 0] || {}).url || '',
        coverSmall: (images[images.length - 1] || {}).url || '',
        duration: it.duration_ms || 0,
        episode: isEp,
      };
      this.state = { ...this.base(p), track, liked: this.likedCache.get(it.uri) };
      if (track.id !== prevId) {
        this.emit('track', track);
        if (!isEp && !this.likedCache.has(it.uri)) this.checkLiked(it.uri).catch(() => {});
      }
    }
    this.emit('state', this.publicState());
  }

  base(p) {
    return {
      isPlaying: !!p.is_playing,
      progress: p.progress_ms || 0,
      at: Date.now(),
      shuffle: !!p.shuffle_state,
      repeat: p.repeat_state || 'off',
      volume: p.device ? p.device.volume_percent : null,
      device: p.device ? { id: p.device.id, name: p.device.name, type: p.device.type, canVolume: p.device.supports_volume !== false } : null,
      context: p.context ? p.context.uri : '',
    };
  }

  publicState() {
    return { ...this.status(), player: this.state };
  }

  async checkLiked(uri) {
    const r = await this.call('GET', `/me/library/contains?uris=${encodeURIComponent(uri)}`);
    const liked = Array.isArray(r) ? !!r[0] : false;
    this.likedCache.set(uri, liked);
    if (this.state && this.state.track && this.state.track.uri === uri) {
      this.state.liked = liked;
      this.emit('state', this.publicState());
    }
  }

  // ------------------------------------------------------------ controls
  /** Optimistically patches local state so the UI responds instantly, then re-polls. */
  patch(fn) {
    if (!this.state) return;
    fn(this.state);
    this.emit('state', this.publicState());
  }

  livePosition() {
    const s = this.state;
    if (!s) return 0;
    return s.isPlaying ? s.progress + (Date.now() - s.at) : s.progress;
  }

  /** opts.deviceId plays on that device (used after launching Spotify). */
  async action(name, arg, opts = {}) {
    const dev = opts.deviceId ? `?device_id=${encodeURIComponent(opts.deviceId)}` : '';
    switch (name) {
      case 'toggle':
        if (this.state && this.state.isPlaying && !opts.deviceId) {
          this.patch((s) => { s.progress = this.livePosition(); s.at = Date.now(); s.isPlaying = false; });
          await this.call('PUT', '/me/player/pause');
        } else {
          this.patch((s) => { s.at = Date.now(); s.isPlaying = true; });
          await this.call('PUT', `/me/player/play${dev}`);
        }
        break;
      case 'playTrack': {
        // a track from search: play it inside its album so "next" keeps going
        const body = arg.albumUri ? { context_uri: arg.albumUri, offset: { uri: arg.uri } } : { uris: [arg.uri] };
        await this.call('PUT', `/me/player/play${dev}`, body);
        break;
      }
      case 'next': await this.call('POST', '/me/player/next'); break;
      case 'prev':
        // Like the Spotify app: restart the song when past 3 s, otherwise go back.
        if (this.livePosition() > 3000) {
          this.patch((s) => { s.progress = 0; s.at = Date.now(); });
          await this.call('PUT', '/me/player/seek?position_ms=0');
        } else {
          await this.call('POST', '/me/player/previous');
        }
        break;
      case 'seek': {
        const ms = Math.max(0, Math.round(arg));
        this.patch((s) => { s.progress = ms; s.at = Date.now(); });
        await this.call('PUT', `/me/player/seek?position_ms=${ms}`);
        break;
      }
      case 'shuffle': {
        const v = !(this.state && this.state.shuffle);
        this.patch((s) => { s.shuffle = v; });
        await this.call('PUT', `/me/player/shuffle?state=${v}`);
        break;
      }
      case 'repeat': {
        const order = ['off', 'context', 'track'];
        const cur = (this.state && this.state.repeat) || 'off';
        const v = order[(order.indexOf(cur) + 1) % order.length];
        this.patch((s) => { s.repeat = v; });
        await this.call('PUT', `/me/player/repeat?state=${v}`);
        break;
      }
      case 'volume': {
        const v = Math.max(0, Math.min(100, Math.round(arg)));
        this.patch((s) => { s.volume = v; });
        await this.call('PUT', `/me/player/volume?volume_percent=${v}`);
        break;
      }
      case 'like': {
        const t = this.state && this.state.track;
        if (!t || t.episode) return;
        const v = !this.state.liked;
        this.likedCache.set(t.uri, v);
        this.patch((s) => { s.liked = v; });
        await this.call(v ? 'PUT' : 'DELETE', `/me/library?uris=${encodeURIComponent(t.uri)}`);
        break;
      }
      case 'playContext':
        await this.call('PUT', `/me/player/play${dev}`, { context_uri: arg.uri });
        break;
      case 'playLiked': {
        const me = await this.me();
        await this.call('PUT', `/me/player/play${dev}`, { context_uri: `spotify:user:${me}:collection` });
        break;
      }
      case 'transfer':
        await this.call('PUT', '/me/player', { device_ids: [arg], play: true });
        break;
      default:
        throw new Error('Bilinmeyen komut: ' + name);
    }
    // Spotify takes a moment to apply changes; re-read twice.
    setTimeout(() => this.refresh().catch(() => {}), 350);
    setTimeout(() => this.refresh().catch(() => {}), 1200);
  }

  async me() {
    if (!this.userId) {
      const m = await this.call('GET', '/me');
      this.userId = m.id;
    }
    return this.userId;
  }

  async playlists() {
    const r = await this.call('GET', '/me/playlists?limit=50');
    const me = await this.me().catch(() => '');
    return (r && r.items ? r.items : []).filter(Boolean).map((p) => ({
      editable: !!(p.collaborative || (p.owner && p.owner.id === me)),
      id: p.id,
      uri: p.uri,
      name: p.name,
      owner: p.owner ? p.owner.display_name : '',
      cover: p.images && p.images.length ? p.images[p.images.length - 1].url : '',
      count: p.items ? p.items.total : p.tracks ? p.tracks.total : null,
    }));
  }

  /** Adds a track to one of the user's playlists. */
  async addToPlaylist(playlistId, uri) {
    const p = `/playlists/${encodeURIComponent(playlistId)}`;
    try {
      await this.call('POST', `${p}/items`, { uris: [uri] });
    } catch (e) {
      // apps created before the February 2026 change may still use the old path
      if (e.status === 404) await this.call('POST', `${p}/tracks`, { uris: [uri] });
      else throw e;
    }
  }

  /** Search: up to 10 tracks, 5 albums and 5 playlists (the API caps limit at 10). */
  async search(q) {
    q = String(q || '').trim();
    if (!q) return { tracks: [], albums: [], playlists: [] };
    const enc = encodeURIComponent(q);
    const [t, other] = await Promise.all([
      this.call('GET', `/search?q=${enc}&type=track&limit=10`),
      this.call('GET', `/search?q=${enc}&type=album,playlist&limit=5`).catch(() => null),
    ]);
    const img = (imgs) => (imgs && imgs.length ? imgs[imgs.length - 1].url : '');
    return {
      tracks: ((t && t.tracks && t.tracks.items) || []).filter(Boolean).map((x) => ({
        uri: x.uri, name: x.name, artists: (x.artists || []).map((a) => a.name).join(', '),
        albumUri: x.album ? x.album.uri : '', cover: img(x.album && x.album.images), duration: x.duration_ms,
      })),
      albums: ((other && other.albums && other.albums.items) || []).filter(Boolean).map((x) => ({
        uri: x.uri, name: x.name, sub: (x.artists || []).map((a) => a.name).join(', '), cover: img(x.images),
      })),
      playlists: ((other && other.playlists && other.playlists.items) || []).filter(Boolean).map((x) => ({
        uri: x.uri, name: x.name, sub: x.owner ? x.owner.display_name : '', cover: img(x.images),
      })),
    };
  }

  async devices() {
    const r = await this.call('GET', '/me/player/devices');
    return (r && r.devices ? r.devices : []).map((d) => ({
      id: d.id, name: d.name, type: d.type, active: d.is_active, volume: d.volume_percent,
    }));
  }
}

module.exports = { Spotify, SpotifyError, REDIRECT_URI, AUTH_PORT, SCOPES, NEW_SCOPES };
