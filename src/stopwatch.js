'use strict';
// Stopwatch that counts up from zero. Lives in the main process so it keeps time while the
// island is hidden; the island draws it from { running, elapsed, at } and its own clock.
const { EventEmitter } = require('events');

class Stopwatch extends EventEmitter {
  constructor(now = () => Date.now()) {
    super();
    this.now = now;
    this.running = false;
    this.base = 0;          // ms counted before the current run
    this.startedAt = 0;     // when the current run started
    this.laps = [];         // { n, total, split }
    this.counted = 0;       // ms already added to today's focus time
  }

  elapsed() {
    return this.base + (this.running ? this.now() - this.startedAt : 0);
  }

  toggle() {
    if (this.running) {
      this.base = this.elapsed();
      this.running = false;
      this.flushFocus();
    } else {
      this.startedAt = this.now();
      this.running = true;
    }
    this.push();
  }

  lap() {
    if (!this.running && this.elapsed() === 0) return;
    const total = this.elapsed();
    const prev = this.laps.length ? this.laps[0].total : 0;
    this.laps.unshift({ n: this.laps.length + 1, total, split: total - prev });
    if (this.laps.length > 99) this.laps.pop();
    this.push();
  }

  reset() {
    this.flushFocus();
    this.running = false;
    this.base = 0;
    this.startedAt = 0;
    this.laps = [];
    this.counted = 0;
    this.push();
  }

  // Whole minutes timed since the last flush go into today's focus minutes.
  flushFocus() {
    const total = this.elapsed();
    const mins = Math.floor((total - this.counted) / 60000);
    if (mins > 0) {
      this.counted += mins * 60000;
      this.emit('focus', mins);
    }
  }

  snapshot() {
    return { running: this.running, elapsed: this.elapsed(), at: this.now(), laps: this.laps.slice(0, 30) };
  }

  push() { this.emit('state', this.snapshot()); }
}

module.exports = { Stopwatch };
