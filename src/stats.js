'use strict';
// Per-day counters for the daily summary: Claude tasks finished, pomodoros, focus minutes, songs.
const { EventEmitter } = require('events');
const { Store, today } = require('./store');

class Stats extends EventEmitter {
  constructor(dir) {
    super();
    this.store = new Store(dir, 'stats', { days: {} });
  }

  day(key = today()) {
    const days = this.store.get().days;
    return days[key] || { claudeDone: 0, pomodoros: 0, focusMin: 0, songs: 0 };
  }

  add(field, n = 1) {
    const key = today();
    const days = { ...this.store.get().days };
    const d = { ...this.day(key) };
    d[field] = (d[field] || 0) + n;
    days[key] = d;
    // keep ~60 days
    const keys = Object.keys(days).sort();
    while (keys.length > 60) delete days[keys.shift()];
    this.store.set({ days });
    this.emit('change', this.summary());
  }

  summary() {
    const d = this.day();
    // last 7 days of focus minutes for a tiny bar chart
    const week = [];
    for (let i = 6; i >= 0; i--) {
      const dt = new Date();
      dt.setDate(dt.getDate() - i);
      const k = today(dt);
      week.push({ day: k, focusMin: (this.store.get().days[k] || {}).focusMin || 0 });
    }
    return { today: d, week };
  }
}

module.exports = { Stats };
