'use strict';
// Connected devices (scripts/devices.ps1): Bluetooth headphones, mice, keyboards, controllers,
// phones… with battery when Windows knows it, and USB drives. Emits connect / disconnect and a
// low-battery warning when a device drops below the chosen level (then again at 10% and 5%).
const { EventEmitter } = require('events');
const { PsLoop } = require('./psloop');

const BY_NAME = [
  [/airpods|buds|headphone|headset|kulakl|\bwh-|\bwf-|jbl|beats|bose|soundcore|\bqcy|xm[3-6]|earbud|earphone|speaker|hoparl|sennheiser|jabra|marshall|\bpods?\b/i, 'audio'],
  [/mouse|fare\b|mx master|mx anywhere|\bg\d{3}\b|trackball|trackpad/i, 'mouse'],
  [/keyboard|klavye|\bkeys\b|\bk\d{3}\b/i, 'keyboard'],
  [/controller|gamepad|xbox|dualsense|dualshock|pro controller|joy-?con|8bitdo/i, 'gamepad'],
  [/iphone|galaxy|pixel|redmi|xiaomi|oneplus|huawei|honor|phone|telefon/i, 'phone'],
  [/watch|band\b|saat/i, 'watch'],
  [/pen\b|kalem|stylus/i, 'pen'],
];
function guessKind(name, kind) {
  if (kind && kind !== 'input') return kind;
  for (const [re, k] of BY_NAME) if (re.test(name || '')) return k;
  return kind || 'other';
}
const list = (x) => (Array.isArray(x) ? x : x ? [x] : []);

class Devices extends EventEmitter {
  constructor(scriptsDir, opts = {}) {
    super();
    this.loop = new PsLoop(scriptsDir, 'devices.ps1');
    this.threshold = opts.threshold || (() => 20);
    this.prev = null;           // Map id -> device, null until the first report
    this.warned = new Map();    // id -> lowest level already warned about
    this.state = { bt: [], usb: [] };
    this.loop.on('message', (m) => this.onMessage(m));
  }

  start() { this.loop.start(); }
  stop() { this.loop.stop(); }

  onMessage(m) {
    const bt = list(m.bt).filter((d) => d && d.name).map((d) => ({
      id: String(d.id), name: String(d.name), conn: 'bt', kind: guessKind(d.name, d.kind),
      battery: d.battery == null || d.battery === '' ? null : Math.max(0, Math.min(100, Number(d.battery))),
    }));
    const usb = list(m.usb).filter((d) => d && d.id).map((d) => ({ id: 'usb:' + d.id, name: String(d.name), conn: 'usb', kind: 'usb', size: Number(d.size) || 0, battery: null }));
    const all = new Map([...bt, ...usb].map((d) => [d.id, d]));
    if (this.prev) {
      for (const [id, d] of all) if (!this.prev.has(id)) this.emit('connect', d);
      for (const [id, d] of this.prev) if (!all.has(id)) { this.emit('disconnect', d); this.warned.delete(id); }
      // a battery level that shows up a few seconds after connecting
      for (const [id, d] of all) {
        const p = this.prev.get(id);
        if (p && p.battery == null && d.battery != null) this.emit('battery', d);
      }
    }
    for (const d of bt) this.checkLow(d);
    this.prev = all;
    this.state = { bt, usb };
    this.emit('state', this.state);
  }

  checkLow(d) {
    if (d.battery == null) return;
    const thr = Number(this.threshold()) || 0;
    if (!thr) return;
    const levels = [...new Set([thr, 10, 5])].filter((x) => x <= thr).sort((a, b) => b - a);
    const done = this.warned.has(d.id) ? this.warned.get(d.id) : Infinity;
    // charged again: start over
    if (d.battery > thr + 5) { this.warned.delete(d.id); return; }
    const hit = levels.filter((l) => d.battery <= l && l < done);
    if (!hit.length) return;
    const level = Math.min(...hit);
    this.warned.set(d.id, level);
    this.emit('low', { ...d, level });
  }
}

module.exports = { Devices, guessKind };
