'use strict';
// Plugins: folders in <userData>/plugins/<id>/ with a plugin.json and a script that adds a tab to
// the island through the same Ada.tab() the built-in tabs use. A plugin runs only after the user
// turns it on in Settings. Files are served to the island over the ada-plugin:// scheme, only
// from inside their own folder.
const fs = require('fs');
const path = require('path');

const ID = /^[a-z0-9][a-z0-9-]{1,39}$/;
const MAX_STORE = 256 * 1024;

function readManifest(dir) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(dir, 'plugin.json'), 'utf8'));
    const id = String(j.id || path.basename(dir)).toLowerCase();
    if (!ID.test(id) || id !== path.basename(dir).toLowerCase()) return null;
    const main = String(j.main || 'tab.js');
    if (!/^[\w.-]+\.js$/.test(main) || !fs.existsSync(path.join(dir, main))) return null;
    const style = j.style && /^[\w.-]+\.css$/.test(j.style) && fs.existsSync(path.join(dir, j.style)) ? j.style : '';
    return {
      id,
      name: String(j.name || id).slice(0, 40),
      version: String(j.version || '0.0.0').slice(0, 20),
      description: String(j.description || '').slice(0, 200),
      author: String(j.author || '').slice(0, 60),
      homepage: /^https:\/\//.test(j.homepage || '') ? String(j.homepage).slice(0, 200) : '',
      main,
      style,
    };
  } catch {
    return null;
  }
}

class Plugins {
  constructor(userData) {
    this.dir = path.join(userData, 'plugins');
    this.dataDir = path.join(userData, 'plugins-data');
    this.list = [];
  }

  scan() {
    try { fs.mkdirSync(this.dir, { recursive: true }); } catch { /* read-only? */ }
    let names = [];
    try { names = fs.readdirSync(this.dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { /* none */ }
    this.list = names.map((n) => readManifest(path.join(this.dir, n))).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    return this.list;
  }

  /** ada-plugin://<id>/<file> -> absolute path inside that plugin's folder, or null */
  resolve(url, enabled) {
    let u;
    try { u = new URL(url); } catch { return null; }
    const id = u.hostname.toLowerCase();
    if (!ID.test(id) || !enabled[id] || !this.list.some((p) => p.id === id)) return null;
    const root = path.join(this.dir, id);
    const rel = decodeURIComponent(u.pathname).replace(/^\/+/, '');
    if (!rel || rel.includes('\0')) return null;
    const full = path.resolve(root, rel);
    if (!full.startsWith(root + path.sep)) return null;
    if (!/\.(js|css|png|svg|jpg|jpeg|webp|json)$/i.test(full)) return null;
    return fs.existsSync(full) ? full : null;
  }

  // a small JSON store per plugin
  load(id) {
    if (!ID.test(id)) return null;
    try { return JSON.parse(fs.readFileSync(path.join(this.dataDir, `${id}.json`), 'utf8')); } catch { return null; }
  }

  save(id, data) {
    if (!ID.test(id)) throw new Error('Geçersiz eklenti');
    const text = JSON.stringify(data ?? null);
    if (text.length > MAX_STORE) throw new Error('Eklenti verisi çok büyük');
    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.writeFileSync(path.join(this.dataDir, `${id}.json`), text);
    return true;
  }

  /** copy a bundled example plugin into the plugins folder */
  install(fromDir) {
    const m = readManifest(fromDir);
    if (!m) throw new Error('Eklenti okunamadı');
    const to = path.join(this.dir, m.id);
    fs.mkdirSync(to, { recursive: true });
    for (const f of fs.readdirSync(fromDir)) fs.copyFileSync(path.join(fromDir, f), path.join(to, f));
    this.scan();
    return m.id;
  }
}

module.exports = { Plugins, readManifest };
