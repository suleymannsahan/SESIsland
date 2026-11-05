'use strict';
// Windows master volume through scripts/volume.ps1 (one long-running PowerShell process).
const { spawn } = require('child_process');
const path = require('path');
const { EventEmitter } = require('events');

const PS = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File'];

class SystemVolume extends EventEmitter {
  constructor(scriptsDir) {
    super();
    this.script = path.join(scriptsDir, 'volume.ps1');
    this.proc = null;
    this.state = { vol: null, muted: false, available: false };
    this.stopped = true;
    this.pendingSet = null;
    this.setTimer = null;
    this.restarts = 0;
  }

  start() {
    if (process.platform !== 'win32' || this.proc) return;
    this.stopped = false;
    this.proc = spawn('powershell.exe', [...PS, this.script], { windowsHide: true });
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
          if (typeof j.vol === 'number' && j.vol >= 0) {
            // ignore echoes of an older value while the user is still dragging
            if (this.pendingSet != null && Date.now() - this.pendingAt < 600 && j.vol !== this.pendingSet) continue;
            this.state = { vol: j.vol, muted: !!j.muted, available: true, dev: j.dev || this.state.dev || '' };
            this.emit('state', this.state);
          }
        } catch { /* partial line */ }
      }
    });
    this.proc.on('exit', () => {
      this.proc = null;
      if (this.stopped) return;
      if (++this.restarts > 5) { this.state = { ...this.state, available: false }; this.emit('state', this.state); return; }
      setTimeout(() => this.start(), 3000);
    });
    this.proc.on('error', () => { this.state = { ...this.state, available: false }; this.emit('state', this.state); });
  }

  stop() {
    this.stopped = true;
    if (this.proc) { try { this.proc.stdin.end(); } catch { /* closed */ } this.proc.kill(); }
    this.proc = null;
  }

  write(cmd) {
    if (!this.proc) return false;
    try { this.proc.stdin.write(cmd + '\n'); return true; } catch { return false; }
  }

  /** Throttled so dragging the slider sends at most ~12 updates a second. */
  set(v) {
    v = Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
    this.pendingSet = v;
    this.pendingAt = Date.now();
    this.state = { ...this.state, vol: v, muted: v === 0 ? this.state.muted : false };
    if (this.setTimer) return;
    this.setTimer = setTimeout(() => {
      this.setTimer = null;
      this.write(`set ${this.pendingSet}`);
    }, 80);
  }

  step(delta) {
    const cur = this.state.vol == null ? 50 : this.state.vol;
    this.set(cur + delta);
    this.emit('state', this.state);
  }

  toggleMute() {
    this.state = { ...this.state, muted: !this.state.muted };
    this.emit('state', this.state);
    this.write('togglemute');
  }
}

module.exports = { SystemVolume };
