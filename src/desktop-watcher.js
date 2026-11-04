'use strict';
// Runs scripts/uia-watch.ps1 in the background and turns its JSON lines into state events.
const { spawn, execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { EventEmitter } = require('events');

const PS_ARGS = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File'];

class DesktopWatcher extends EventEmitter {
  constructor(scriptsDir, patterns, logFile) {
    super();
    this.logFile = logFile;
    this.dir = scriptsDir;
    this.patterns = patterns;
    this.proc = null;
    this.stopped = false;
    this.restarts = 0;
    this.patternsFile = path.join(os.tmpdir(), 'ada-desktop-patterns.json');
    this.writePatterns();
  }

  log(line) {
    if (!this.logFile) return;
    try {
      const st = fs.existsSync(this.logFile) && fs.statSync(this.logFile);
      if (st && st.size > 2 * 1024 * 1024) fs.renameSync(this.logFile, this.logFile + '.old');
      fs.appendFileSync(this.logFile, `${new Date().toISOString()} ${line}\n`);
    } catch { /* logging is best effort */ }
  }

  // Regexes go to PowerShell through a UTF-8 file; on the command line they get mangled.
  writePatterns() {
    fs.writeFileSync(this.patternsFile, JSON.stringify(this.patterns), 'utf8');
  }

  start() {
    this.stopped = false;
    this.proc = spawn('powershell.exe', [
      ...PS_ARGS, path.join(this.dir, 'uia-watch.ps1'),
      '-PatternsFile', this.patternsFile, '-IntervalMs', '1000',
    ], { windowsHide: true });

    let buf = '';
    this.proc.stdout.setEncoding('utf8');
    this.proc.stdout.on('data', (chunk) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        this.log('watch ' + line);
        try {
          const st = JSON.parse(line);
          if (st.state === 'error') { this.emit('error', 'buton kalıpları okunamadı'); continue; }
          // The window is usually just titled "Claude"; only keep a title that says more.
          if (!st.title || /^claude$/i.test(st.title.trim())) delete st.title;
          if (st.prompt) st.prompt = String(st.prompt).replace(/^Claude wants to use\s*/i, '');
          if (!Array.isArray(st.buttons)) st.buttons = st.buttons ? [st.buttons] : [];
          this.emit('state', st);
        } catch { /* ignore partial lines */ }
      }
    });
    this.proc.stderr.setEncoding('utf8');
    this.proc.stderr.on('data', (d) => this.log('stderr ' + String(d).trim()));
    this.log('start ' + JSON.stringify(this.patterns));
    this.proc.on('error', (e) => { this.log('error ' + e.message); this.emit('error', e.message); });
    this.proc.on('exit', () => {
      this.proc = null;
      if (this.stopped) return;
      if (++this.restarts > 5) return this.emit('error', 'izleyici tekrar tekrar kapandı');
      setTimeout(() => this.start(), 3000);
    });
  }

  stop() {
    this.stopped = true;
    if (this.proc) this.proc.kill();
    this.proc = null;
  }

  click(decision) {
    this.writePatterns();
    execFile('powershell.exe', [...PS_ARGS, path.join(this.dir, 'uia-click.ps1'), '-PatternsFile', this.patternsFile, '-Which', decision === 'allow' ? 'allow' : 'deny'],
      { windowsHide: true, timeout: 8000 },
      (err, stdout) => {
        this.log(`click ${decision} -> ${String(stdout || '').trim()} ${err ? err.message : ''}`);
        if (err || !/clicked/.test(stdout)) this.emit('error', 'Desktop\'taki buton bulunamadı · tanılama dosyası oluştur');
      });
  }

  static record(scriptsDir, out, seconds = 60) {
    return new Promise((resolve, reject) => {
      execFile('powershell.exe', [...PS_ARGS, path.join(scriptsDir, 'uia-record.ps1'), '-Out', out, '-Seconds', String(seconds)],
        { windowsHide: true, timeout: (seconds + 30) * 1000 },
        (err) => (err ? reject(err) : resolve(out)));
    });
  }

  static dump(scriptsDir, out) {
    return new Promise((resolve, reject) => {
      execFile('powershell.exe', [...PS_ARGS, path.join(scriptsDir, 'uia-dump.ps1'), '-Out', out],
        { windowsHide: true, timeout: 60000 },
        (err) => (err ? reject(err) : resolve(out)));
    });
  }
}

module.exports = { DesktopWatcher };
