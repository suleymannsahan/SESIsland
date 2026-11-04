'use strict';
// CPU / RAM from Node, GPU from nvidia-smi when an NVIDIA card is present.
const os = require('os');
const { execFile } = require('child_process');
const { EventEmitter } = require('events');

function cpuTimes() {
  let idle = 0, total = 0;
  for (const c of os.cpus()) {
    for (const v of Object.values(c.times)) total += v;
    idle += c.times.idle;
  }
  return { idle, total };
}

class SystemMonitor extends EventEmitter {
  constructor() {
    super();
    this.prev = cpuTimes();
    this.timer = null;
    this.gpu = null;
    this.gpuAvailable = process.platform === 'win32' || process.platform === 'linux';
    this.history = [];    // last 60 cpu samples
    this.fast = false;
  }

  start() {
    this.stop();
    const tick = () => {
      this.sample();
      this.timer = setTimeout(tick, this.fast ? 1500 : 6000);
    };
    tick();
  }

  stop() { clearTimeout(this.timer); }

  /** Sample faster while the Sistem tab is open. */
  setFast(on) {
    const was = this.fast;
    this.fast = !!on;
    if (this.fast && !was) this.start();
  }

  sample() {
    const now = cpuTimes();
    const dt = now.total - this.prev.total;
    const cpu = dt > 0 ? Math.round(100 * (1 - (now.idle - this.prev.idle) / dt)) : 0;
    this.prev = now;
    this.history.push(cpu);
    if (this.history.length > 60) this.history.shift();
    const total = os.totalmem();
    const used = total - os.freemem();
    if (this.fast && this.gpuAvailable) this.readGpu();
    this.emit('state', {
      cpu,
      cpuHistory: this.history.slice(),
      cores: os.cpus().length,
      cpuModel: (os.cpus()[0] || {}).model || '',
      memUsed: used,
      memTotal: total,
      uptime: os.uptime(),
      gpu: this.gpu,
    });
  }

  readGpu() {
    execFile('nvidia-smi', ['--query-gpu=name,utilization.gpu,temperature.gpu,memory.used,memory.total', '--format=csv,noheader,nounits'],
      { windowsHide: true, timeout: 4000 },
      (err, out) => {
        if (err) { this.gpuAvailable = false; this.gpu = null; return; }
        const [name, util, temp, mu, mt] = String(out).split('\n')[0].split(',').map((s) => s.trim());
        this.gpu = { name, util: Number(util), temp: Number(temp), memUsed: Number(mu), memTotal: Number(mt) };
      });
  }
}

module.exports = { SystemMonitor };
