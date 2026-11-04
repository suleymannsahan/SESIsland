'use strict';
// Synced lyrics from LRCLIB (https://lrclib.net), a free, community-run lyrics database.
// Lyrics are fetched on demand for the song that is playing and kept only in memory.
const BASE = 'https://lrclib.net/api';
const UA = 'Ada/0.2 (Windows desktop island)';

function parseLrc(lrc) {
  const lines = [];
  for (const raw of String(lrc || '').split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    if (!stamps.length) continue;
    const text = raw.replace(/\[[^\]]*\]/g, '').trim();
    for (const m of stamps) {
      const frac = m[3] ? Number(m[3].padEnd(3, '0')) : 0;
      lines.push({ t: Number(m[1]) * 60000 + Number(m[2]) * 1000 + frac, text });
    }
  }
  return lines.sort((a, b) => a.t - b.t);
}

class Lyrics {
  constructor(fetchFn) {
    this.fetch = fetchFn || globalThis.fetch;
    this.cache = new Map();
  }

  async get(track) {
    if (!track || track.episode) return { status: 'none' };
    if (this.cache.has(track.id)) return this.cache.get(track.id);
    let result = { status: 'none' };
    try {
      const q = new URLSearchParams({
        track_name: track.name,
        artist_name: track.firstArtist || track.artists,
        album_name: track.album || '',
        duration: String(Math.round(track.duration / 1000)),
      });
      let j = await this.req(`/get?${q}`);
      if (!j || (!j.syncedLyrics && !j.plainLyrics && !j.instrumental)) {
        // The exact signature is not in the database; try a looser search.
        const s = await this.req(`/search?${new URLSearchParams({ track_name: track.name, artist_name: track.firstArtist || track.artists })}`);
        if (Array.isArray(s) && s.length) {
          const dur = track.duration / 1000;
          j = s.filter((x) => x.syncedLyrics).sort((a, b) => Math.abs(a.duration - dur) - Math.abs(b.duration - dur))[0] || s[0];
        }
      }
      if (j && j.instrumental) result = { status: 'instrumental' };
      else if (j && j.syncedLyrics) result = { status: 'synced', lines: parseLrc(j.syncedLyrics) };
      else if (j && j.plainLyrics) result = { status: 'plain', lines: j.plainLyrics.split(/\r?\n/).map((text) => ({ t: -1, text })) };
    } catch {
      result = { status: 'error' };
    }
    if (result.status !== 'error') this.cache.set(track.id, result);
    if (this.cache.size > 200) this.cache.delete(this.cache.keys().next().value);
    return result;
  }

  /**
   * Translates lyric lines to Turkish with MyMemory (free, no key, about 5000 characters a day).
   * Returns an array the same length as `lines` (empty strings where nothing came back).
   */
  async translate(trackId, lines, target = 'tr') {
    const key = `${trackId}:${target}`;
    this.tcache = this.tcache || new Map();
    if (this.tcache.has(key)) return this.tcache.get(key);
    const texts = lines.map((l) => l.text || '');
    const out = new Array(texts.length).fill('');
    // MyMemory takes up to ~500 bytes per request: send lines in batches joined by newlines.
    const idx = texts.map((t, i) => (t.trim() ? i : -1)).filter((i) => i >= 0);
    const batches = [];
    let cur = [];
    let size = 0;
    for (const i of idx) {
      const b = Buffer.byteLength(texts[i]) + 1;
      if (size + b > 450 && cur.length) { batches.push(cur); cur = []; size = 0; }
      cur.push(i);
      size += b;
    }
    if (cur.length) batches.push(cur);
    for (const batch of batches) {
      const q = batch.map((i) => texts[i]).join('\n');
      const res = await this.fetch(`https://api.mymemory.translated.net/get?${new URLSearchParams({ q, langpair: `autodetect|${target}` })}`, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error('Çeviri servisi yanıt vermedi');
      const j = await res.json();
      const text = j && j.responseData && j.responseData.translatedText;
      if (!text || /MYMEMORY WARNING|QUOTA/i.test(text)) throw new Error('Günlük ücretsiz çeviri sınırı doldu');
      const parts = String(text).split(/\n/);
      batch.forEach((i, k) => { out[i] = (parts[k] || '').trim(); });
    }
    this.tcache.set(key, out);
    return out;
  }

  async req(p) {
    const res = await this.fetch(BASE + p, { headers: { 'User-Agent': UA, 'Lrclib-Client': UA } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('lrclib ' + res.status);
    return res.json();
  }
}

module.exports = { Lyrics, parseLrc };
