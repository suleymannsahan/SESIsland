'use strict';
// Windows media sessions (browser, VLC, Media Player, Spotify app…) through scripts/media.ps1.
const { EventEmitter } = require('events');
const { PsLoop } = require('./psloop');

const APPS = [
  [/^spotify/i, 'Spotify'],
  [/chrome/i, 'Chrome'],
  [/msedge|microsoftedge/i, 'Edge'],
  [/firefox|308046B0AF4A39CB/i, 'Firefox'],
  [/brave/i, 'Brave'],
  [/opera/i, 'Opera'],
  [/vivaldi/i, 'Vivaldi'],
  [/vlc/i, 'VLC'],
  [/ZuneMusic|Media\.Player/i, 'Medya Oynatıcı'],
  [/ZuneVideo/i, 'Filmler ve TV'],
  [/AppleMusic|iTunes/i, 'Apple Music'],
  [/deezer/i, 'Deezer'],
  [/discord/i, 'Discord'],
  [/foobar/i, 'foobar2000'],
  [/aimp/i, 'AIMP'],
  [/potplayer/i, 'PotPlayer'],
  [/mpv/i, 'mpv'],
];

function appName(id) {
  for (const [re, name] of APPS) if (re.test(id || '')) return name;
  const base = String(id || '').split('!').pop().split('\\').pop().replace(/\.exe$/i, '').replace(/_[a-z0-9]{13}$/i, '');
  return base.split('.').pop() || 'Medya';
}

const isSpotify = (id) => /^spotify/i.test(id || '');

class MediaSessions extends EventEmitter {
  constructor(scriptsDir) {
    super();
    this.loop = new PsLoop(scriptsDir, 'media.ps1');
    this.thumbs = new Map();      // id -> { key, url }
    this.state = { available: false, current: '', sessions: [] };
    this.loop.on('message', (m) => this.onMessage(m));
    this.loop.on('dead', () => { this.state = { ...this.state, available: false }; this.push(); });
  }

  start() { this.loop.start(); }
  stop() { this.loop.stop(); }

  onMessage(m) {
    if (m.t === 'error') { this.state = { available: false, current: '', sessions: [], error: m.error }; return this.push(); }
    if (m.t === 'thumb') {
      this.thumbs.set(m.id, { key: m.key, url: `data:${m.mime || 'image/png'};base64,${m.data}` });
      return this.push();
    }
    if (m.t !== 'state') return;
    const sessions = (Array.isArray(m.sessions) ? m.sessions : m.sessions ? [m.sessions] : [])
      .filter((s) => s && s.id && (s.title || s.status === 'playing'))
      .map((s) => ({
        id: s.id,
        app: appName(s.id),
        spotify: isSpotify(s.id),
        title: s.title || '',
        artist: s.artist || '',
        album: s.album || '',
        status: s.status,
        pos: Math.max(0, Number(s.pos) || 0),
        dur: Math.max(0, Number(s.dur) || 0),
        at: Number(s.upd) || Date.now(),
        next: !!s.next,
        prev: !!s.prev,
        seek: !!s.seek && Number(s.dur) > 0,
        key: s.key || '',
      }));
    for (const id of [...this.thumbs.keys()]) if (!sessions.some((s) => s.id === id)) this.thumbs.delete(id);
    this.state = { available: true, current: m.current || '', sessions };
    this.push();
  }

  snapshot() {
    return {
      ...this.state,
      sessions: this.state.sessions.map((s) => {
        const t = this.thumbs.get(s.id);
        return { ...s, thumb: t && t.key === s.key ? t.url : '' };
      }),
    };
  }

  /** The session the user most likely means: playing first, then Windows' current one. */
  active({ skipSpotify = false } = {}) {
    const list = this.state.sessions.filter((s) => !(skipSpotify && s.spotify));
    return list.find((s) => s.status === 'playing')
      || list.find((s) => s.id === this.state.current)
      || list[0] || null;
  }

  command(c, id, ms) {
    if (!id) return false;
    // answer at once on the island; the script confirms a moment later
    const s = this.state.sessions.find((x) => x.id === id);
    if (s && (c === 'toggle' || c === 'play' || c === 'pause')) {
      const playing = c === 'play' || (c === 'toggle' && s.status !== 'playing');
      const pos = s.status === 'playing' ? s.pos + (Date.now() - s.at) : s.pos;
      Object.assign(s, { status: playing ? 'playing' : 'paused', pos, at: Date.now() });
      this.push();
    }
    return this.loop.send({ c, id, ms: Math.round(ms || 0) });
  }

  push() { this.emit('state', this.snapshot()); }
}

module.exports = { MediaSessions, appName, isSpotify };
