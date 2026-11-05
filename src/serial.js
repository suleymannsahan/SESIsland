'use strict';
// Serial monitor: talks to scripts/serial.ps1 and keeps the last lines plus numbers for the plot.
const { spawn, execFile } = require('child_process');
const path = require('path');
const { EventEmitter } = require('events');

const PS = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File'];
const MAX_LINES = 300;
const MAX_POINTS = 600;

/** Pulls up to 4 numbers out of a line: "t=23.5 h:41" -> [{k:'t',v:23.5},{k:'h',v:41}] */
function parseNumbers(line) {
  const out = [];
  const re = /(?:([A-Za-z_][\w]*)\s*[:=]\s*)?(-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)/g;
  let m;
  while ((m = re.exec(line)) && out.length < 4) {
    // skip numbers glued to letters (e.g. "ESP32", "COM3") unless they are a key:value
    const before = line[m.index - 1];
    if (!m[1] && before && /[A-Za-z_]/.test(before)) continue;
    out.push({ k: m[1] || `#${out.length + 1}`, v: Number(m[2]) });
  }
  return out;
}

class SerialMonitor extends EventEmitter {
  constructor(scriptsDir) {
    super();
    this.script = path.join(scriptsDir, 'serial.ps1');
    this.proc = null;
    this.port = '';
    this.baud = 115200;
    this.status = 'closed';   // closed | opening | open | error
    this.error = '';
    this.lines = [];          // { t, text, kind }
    this.series = {};         // key -> [values]
    this.seq = 0;
    this.flushTimer = null;
  }

  list() {
    return new Promise((resolve) => {
      if (process.platform !== 'win32') return resolve([]);
      execFile('powershell.exe', [...PS, this.script, '-List'], { windowsHide: true, timeout: 15000 }, (err, out) => {
        if (err) return resolve([]);
        try {
          const j = JSON.parse(String(out).trim() || '[]');
          resolve(Array.isArray(j) ? j : [j]);
        } catch { resolve([]); }
      });
    });
  }

  open(port, baud) {
    this.close();
    this.port = String(port);
    this.baud = Number(baud) || 115200;
    this.status = 'opening';
    this.error = '';
    this.push();
    this.proc = spawn('powershell.exe', [...PS, this.script, '-Port', this.port, '-Baud', String(this.baud)], { windowsHide: true });
    let buf = '';
    this.proc.stdout.setEncoding('utf8');
    this.proc.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).replace(/\r$/, '');
        buf = buf.slice(i + 1);
        this.onLine(line);
      }
    });
    this.proc.on('exit', () => {
      this.proc = null;
      if (this.status !== 'error') this.status = 'closed';
      this.push();
    });
    this.proc.on('error', (e) => { this.status = 'error'; this.error = e.message; this.push(); });
  }

  onLine(line) {
    if (line.startsWith('!OPEN')) { this.status = 'open'; return this.push(); }
    if (line.startsWith('!ERR')) { this.status = 'error'; this.error = line.slice(5).trim(); return this.push(); }
    if (line.startsWith('!CLOSED')) return;
    this.addLine(line, 'rx');
  }

  addLine(text, dir) {
    const kind = /\b(FAIL(ED)?|ERROR|ERR|HATA|PANIC|Guru Meditation)\b/i.test(text) ? 'bad'
      : /\b(PASS(ED)?|OK|SUCCESS|BAŞARILI|READY)\b/i.test(text) ? 'good' : '';
    this.lines.push({ id: ++this.seq, t: Date.now(), text: text.slice(0, 500), kind, dir });
    if (this.lines.length > MAX_LINES) this.lines.splice(0, this.lines.length - MAX_LINES);
    if (dir === 'rx') {
      for (const { k, v } of parseNumbers(text)) {
        const arr = this.series[k] || (this.series[k] = []);
        arr.push(v);
        if (arr.length > MAX_POINTS) arr.shift();
      }
      const keys = Object.keys(this.series);
      if (keys.length > 4) for (const k of keys.slice(0, keys.length - 4)) delete this.series[k];
    }
    // Lines can arrive hundreds per second: send updates at most 10 times a second.
    if (!this.flushTimer) this.flushTimer = setTimeout(() => { this.flushTimer = null; this.push(); }, 100);
  }

  send(text) {
    if (!this.proc || this.status !== 'open') return false;
    this.proc.stdin.write(String(text).replace(/[\r\n]+/g, ' ') + '\n');
    this.addLine(String(text), 'tx');
    return true;
  }

  /** The plotted numbers as CSV (one row per sample, one column per series). */
  csv() {
    const keys = Object.keys(this.series);
    const n = Math.max(0, ...keys.map((k) => this.series[k].length));
    const rows = [['n', ...keys].join(',')];
    for (let i = 0; i < n; i++) {
      rows.push([i + 1, ...keys.map((k) => {
        const a = this.series[k];
        const v = a[a.length - n + i];
        return v == null ? '' : v;
      })].join(','));
    }
    return rows.join('\r\n') + '\r\n';
  }

  clear() {
    this.lines = [];
    this.series = {};
    this.push();
  }

  close() {
    if (this.proc) {
      try { this.proc.stdin.end(); } catch { /* closed */ }
      const p = this.proc;
      setTimeout(() => { try { p.kill(); } catch { /* gone */ } }, 600);
      this.proc = null;
    }
    this.status = 'closed';
    this.push();
  }

  snapshot() {
    return {
      port: this.port, baud: this.baud, status: this.status, error: this.error,
      lines: this.lines.slice(-120), series: this.series,
    };
  }

  push() { this.emit('state', this.snapshot()); }
}

module.exports = { SerialMonitor, parseNumbers };
