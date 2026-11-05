'use strict';
// A long-running PowerShell helper that prints one JSON object per line and reads JSON commands
// from stdin. Restarts itself a few times if it dies. Used by media, privacy and the like.
const { spawn } = require('child_process');
const path = require('path');
const { EventEmitter } = require('events');

const PS = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File'];

class PsLoop extends EventEmitter {
  constructor(scriptsDir, script, args = []) {
    super();
    this.script = path.join(scriptsDir, script);
    this.args = args;
    this.proc = null;
    this.stopped = true;
    this.restarts = 0;
  }

  start() {
    if (process.platform !== 'win32' || this.proc) return false;
    this.stopped = false;
    const proc = spawn('powershell.exe', [...PS, this.script, ...this.args], { windowsHide: true });
    this.proc = proc;
    let buf = '';
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (d) => {
      buf += d;
      if (buf.length > 8e6) buf = '';
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        let j;
        try { j = JSON.parse(line); } catch { continue; }
        this.restarts = 0;
        this.emit('message', j);
      }
    });
    proc.stderr.on('data', () => {});
    proc.on('exit', () => {
      if (this.proc === proc) this.proc = null;
      if (this.stopped) return;
      if (++this.restarts > 5) { this.emit('dead'); return; }
      setTimeout(() => { if (!this.stopped) this.start(); }, 3000 * this.restarts);
    });
    proc.on('error', () => this.emit('dead'));
    return true;
  }

  send(obj) {
    if (!this.proc) return false;
    try { this.proc.stdin.write(JSON.stringify(obj) + '\n'); return true; } catch { return false; }
  }

  stop() {
    this.stopped = true;
    const p = this.proc;
    this.proc = null;
    if (!p) return;
    try { p.stdin.end(); } catch { /* closed */ }
    setTimeout(() => { try { p.kill(); } catch { /* gone */ } }, 400);
  }
}

module.exports = { PsLoop };
