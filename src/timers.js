'use strict';
// Countdown timers and alarms. Kept in timers.json with absolute end times, so they survive a
// restart (a timer that ended while Ada was closed rings once on start).
const { EventEmitter } = require('events');
const { Store } = require('./store');

const MAX = 20;

class Timers extends EventEmitter {
  constructor(dir, now = () => Date.now()) {
    super();
    this.now = now;
    this.store = new Store(dir, 'timers', { list: [] });
    this.timer = null;
  }

  list() { return this.store.get().list || []; }
  save(list) { this.store.set({ list }); this.push(); }

  start() {
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 500);
    this.tick();
  }

  stop() { clearInterval(this.timer); }

  /** { kind: 'timer', ms, label } | { kind: 'alarm', at, label } */
  add(t) {
    const now = this.now();
    const kind = t.kind === 'alarm' ? 'alarm' : 'timer';
    const end = kind === 'alarm' ? Number(t.at) : now + Number(t.ms);
    if (!Number.isFinite(end) || end <= now || end - now > 7 * 86400000) throw new Error('Geçersiz süre');
    const item = {
      id: `${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      kind,
      label: String(t.label || '').slice(0, 60),
      start: now,
      end,
      dur: end - now,
      paused: null,       // remaining ms while paused
      ringing: false,
    };
    const list = [...this.list(), item].sort((a, b) => a.end - b.end).slice(0, MAX);
    this.save(list);
    return item;
  }

  remove(id) { this.save(this.list().filter((t) => t.id !== id)); }

  /** stop a ringing one (or cancel a running one) */
  dismiss(id) { this.remove(id); }

  snooze(id, min = 5) {
    const list = this.list().map((t) => (t.id === id ? { ...t, end: this.now() + min * 60000, dur: min * 60000, start: this.now(), ringing: false, paused: null, label: t.label } : t));
    this.save(list.sort((a, b) => a.end - b.end));
  }

  togglePause(id) {
    const now = this.now();
    this.save(this.list().map((t) => {
      if (t.id !== id || t.kind !== 'timer' || t.ringing) return t;
      if (t.paused != null) return { ...t, end: now + t.paused, paused: null };
      return { ...t, paused: Math.max(0, t.end - now) };
    }));
  }

  addTime(id, ms) {
    this.save(this.list().map((t) => (t.id === id && !t.ringing ? (t.paused != null ? { ...t, paused: t.paused + ms, dur: t.dur + ms } : { ...t, end: t.end + ms, dur: t.dur + ms }) : t)));
  }

  tick() {
    const now = this.now();
    let changed = false;
    const list = this.list().map((t) => {
      if (t.ringing || t.paused != null || t.end > now) return t;
      changed = true;
      const late = now - t.end > 60000;   // ended while Ada was closed
      this.emit('ring', { ...t, late });
      return { ...t, ringing: true, rangAt: now };
    });
    // a ringing one stops by itself after 10 minutes
    const kept = list.filter((t) => !(t.ringing && now - (t.rangAt || now) > 10 * 60000));
    if (changed || kept.length !== list.length) this.save(kept);
  }

  snapshot() { return { list: this.list(), at: this.now() }; }
  push() { this.emit('state', this.snapshot()); }
}

module.exports = { Timers };
