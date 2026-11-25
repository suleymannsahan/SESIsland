'use strict';
// Claude Code token use per day and per project, read from its own transcripts on this computer
// (~/.claude/projects/**/*.jsonl). Nothing leaves the computer. Files are re-read only when they
// changed; one assistant message is counted once even when it appears on several lines.
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { EventEmitter } = require('events');

const DAYS = 8;
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function listFiles(dir, since, out = [], depth = 0) {
  if (depth > 3) return out;
  let list = [];
  try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const d of list) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) listFiles(p, since, out, depth + 1);
    else if (d.name.endsWith('.jsonl')) {
      try { const st = fs.statSync(p); if (st.mtimeMs >= since) out.push({ p, mtime: st.mtimeMs, size: st.size }); } catch { /* gone */ }
    }
  }
  return out;
}

/** One transcript -> { byDay: { day: { in, out, cw, cr } }, project, ids:Set } */
async function readFile(file, since) {
  const byDay = {};
  const seen = new Set();
  let project = '';
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!project && line.includes('"cwd"')) {
      const m = /"cwd":"((?:[^"\\]|\\.)*)"/.exec(line);
      if (m) {
        try {
          const cwd = JSON.parse(`"${m[1]}"`);
          project = (cwd.includes('\\') ? path.win32 : path.posix).basename(cwd);
        } catch { /* odd path */ }
      }
    }
    if (!line.includes('"usage"')) continue;
    let j;
    try { j = JSON.parse(line); } catch { continue; }
    const msg = j.message;
    const u = msg && msg.usage;
    if (!u || !j.timestamp) continue;
    const t = new Date(j.timestamp);
    if (Number.isNaN(t.getTime()) || t.getTime() < since) continue;
    const id = `${msg.id || ''}:${j.requestId || ''}`;
    if (id !== ':' && seen.has(id)) continue;
    seen.add(id);
    const k = dayKey(t);
    const d = byDay[k] || (byDay[k] = { in: 0, out: 0, cw: 0, cr: 0 });
    d.in += Number(u.input_tokens) || 0;
    d.out += Number(u.output_tokens) || 0;
    d.cw += Number(u.cache_creation_input_tokens) || 0;
    d.cr += Number(u.cache_read_input_tokens) || 0;
  }
  return { byDay, project };
}

class TokenStats extends EventEmitter {
  constructor(root = path.join(os.homedir(), '.claude', 'projects')) {
    super();
    this.root = root;
    this.cache = new Map();   // file -> { mtime, size, byDay, project }
    this.state = { available: false, days: [], projects: [] };
    this.timer = null;
    this.busy = false;
  }

  start() {
    this.stop();
    const tick = async () => { await this.refresh().catch(() => {}); this.timer = setTimeout(tick, 30 * 60 * 1000); };
    this.timer = setTimeout(tick, 25 * 1000);
  }

  stop() { clearTimeout(this.timer); }

  async refresh() {
    if (this.busy) return this.state;
    this.busy = true;
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - (DAYS - 1));
      const since = start.getTime();
      const files = listFiles(this.root, since);
      const live = new Set(files.map((f) => f.p));
      for (const k of [...this.cache.keys()]) if (!live.has(k)) this.cache.delete(k);
      for (const f of files) {
        const c = this.cache.get(f.p);
        if (c && c.mtime === f.mtime && c.size === f.size) continue;
        try { this.cache.set(f.p, { mtime: f.mtime, size: f.size, ...(await readFile(f.p, since)) }); } catch { /* unreadable */ }
      }
      const days = [];
      for (let i = 0; i < DAYS; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        days.push({ day: dayKey(d), in: 0, out: 0, cw: 0, cr: 0 });
      }
      const idx = Object.fromEntries(days.map((d, i) => [d.day, i]));
      const projects = {};
      for (const c of this.cache.values()) {
        for (const [k, v] of Object.entries(c.byDay)) {
          const i = idx[k];
          if (i == null) continue;
          for (const f of ['in', 'out', 'cw', 'cr']) days[i][f] += v[f];
          const name = c.project || '?';
          projects[name] = (projects[name] || 0) + v.in + v.out + v.cw;
        }
      }
      const top = Object.entries(projects).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, tokens]) => ({ name, tokens }));
      this.state = { available: files.length > 0 || this.cache.size > 0, days: days.slice(1), projects: top, updated: Date.now() };
    } finally {
      this.busy = false;
    }
    this.emit('state', this.state);
    return this.state;
  }
}

module.exports = { TokenStats, readFile, dayKey };
