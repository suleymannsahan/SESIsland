'use strict';
// Fullscreen detection and "bring window to front", via scripts/winctl.ps1.
const { spawn, execFile } = require('child_process');
const path = require('path');
const { EventEmitter } = require('events');

const PS = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File'];

class WinCtl extends EventEmitter {
  constructor(scriptsDir) {
    super();
    this.script = path.join(scriptsDir, 'winctl.ps1');
    this.proc = null;
    this.fullscreen = false;
    this.stopped = true;
  }

  /** point: a physical-pixel point inside Ada's window, so only that monitor counts. */
  startWatch(point) {
    if (process.platform !== 'win32' || this.proc) return;
    this.stopped = false;
    if (point) this.point = point;
    const p = this.point || { x: 0, y: 0 };
    this.proc = spawn('powershell.exe', [...PS, this.script, '-Watch', '-SelfPid', String(process.pid), '-AdaX', String(p.x), '-AdaY', String(p.y)], { windowsHide: true });
    let buf = '';
    this.proc.stdout.setEncoding('utf8');
    this.proc.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        try {
          const j = JSON.parse(line);
          if (typeof j.fullscreen === 'boolean' && j.fullscreen !== this.fullscreen) {
            this.fullscreen = j.fullscreen;
            this.emit('fullscreen', this.fullscreen);
          }
        } catch { /* partial */ }
      }
    });
    this.proc.on('exit', () => {
      this.proc = null;
      if (!this.stopped) setTimeout(() => this.startWatch(), 5000);
    });
  }

  restartWatch(point) {
    const wasOn = !this.stopped;
    this.stopWatch();
    if (wasOn) this.startWatch(point);
  }

  stopWatch() {
    this.stopped = true;
    if (this.proc) this.proc.kill();
    this.proc = null;
    if (this.fullscreen) { this.fullscreen = false; this.emit('fullscreen', false); }
  }

  /** Bring a window to the front. names: process names in order of preference. */
  focus(names, title) {
    return new Promise((resolve) => {
      if (process.platform !== 'win32') return resolve(false);
      execFile('powershell.exe', [...PS, this.script, '-Focus', '-Names', names.join(','), '-Title', title || ''],
        { windowsHide: true, timeout: 10000 }, (err, out) => resolve(!err && /focused/.test(String(out))));
    });
  }
}

module.exports = { WinCtl };
