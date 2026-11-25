'use strict';
// The Start menu's apps for the command bar: names + how to start them, with icons for the
// desktop programs (from their Start menu shortcuts). Refreshed every half hour.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

function walk(dir, out, depth = 0) {
  if (depth > 4) return out;
  let list = [];
  try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const d of list) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) walk(p, out, depth + 1);
    else if (/\.(lnk|url)$/i.test(d.name)) out.push(p);
  }
  return out;
}

const SKIP = /^(uninstall|kaldır|readme|help|yardım|website|web sitesi|license|lisans)\b|\b(uninstall|kaldır)\b/i;

class Apps {
  constructor(scriptsDir, getIcon) {
    this.scriptsDir = scriptsDir;
    this.getIcon = getIcon || (async () => null);
    this.list = [];          // { name, id, lnk }
    this.icons = new Map();  // name -> dataURL
    this.loadedAt = 0;
    this.loading = null;
  }

  shortcuts() {
    const dirs = [
      path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
      path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    ];
    const map = new Map();
    for (const d of dirs) for (const f of walk(d, [])) {
      const name = path.basename(f).replace(/\.(lnk|url)$/i, '');
      if (!SKIP.test(name) && !map.has(name.toLowerCase())) map.set(name.toLowerCase(), f);
    }
    return map;
  }

  startApps() {
    return new Promise((resolve) => {
      if (process.platform !== 'win32') return resolve([]);
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(this.scriptsDir, 'apps.ps1')],
        { windowsHide: true, timeout: 20000, maxBuffer: 8 * 1024 * 1024 }, (err, out) => {
          if (err) return resolve([]);
          try {
            const j = JSON.parse(String(out).trim() || '[]');
            resolve((Array.isArray(j) ? j : [j]).filter((x) => x && x.name && x.id));
          } catch { resolve([]); }
        });
    });
  }

  async load(force = false) {
    if (!force && this.list.length && Date.now() - this.loadedAt < 30 * 60000) return this.list;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const lnks = this.shortcuts();
      const started = await this.startApps();
      const seen = new Set();
      const list = [];
      for (const a of started) {
        const k = a.name.toLowerCase();
        if (seen.has(k) || SKIP.test(a.name)) continue;
        seen.add(k);
        list.push({ name: a.name, id: a.id, lnk: lnks.get(k) || '' });
      }
      // shortcuts Get-StartApps did not list
      for (const [k, f] of lnks) if (!seen.has(k)) { seen.add(k); list.push({ name: path.basename(f).replace(/\.(lnk|url)$/i, ''), id: '', lnk: f }); }
      this.list = list.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
      this.loadedAt = Date.now();
      this.loading = null;
      return this.list;
    })();
    return this.loading;
  }

  async icon(name) {
    if (this.icons.has(name)) return this.icons.get(name);
    const a = this.list.find((x) => x.name === name);
    let url = '';
    if (a && a.lnk) {
      try { const img = await this.getIcon(a.lnk); if (img && !img.isEmpty()) url = img.toDataURL(); } catch { /* none */ }
    }
    this.icons.set(name, url);
    return url;
  }

  /** start it: the shortcut if there is one, else the Store app id */
  launch(name, shell) {
    const a = this.list.find((x) => x.name === name);
    if (!a) return false;
    if (a.lnk) { shell.openPath(a.lnk); return true; }
    if (a.id) {
      execFile('explorer.exe', [`shell:AppsFolder\\${a.id}`], { windowsHide: true }, () => {});
      return true;
    }
    return false;
  }
}

module.exports = { Apps };
