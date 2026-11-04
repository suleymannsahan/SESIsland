'use strict';
// Pomodoro timer that lives in the main process, so it keeps time when the island is hidden.
const { EventEmitter } = require('events');
const { Store } = require('./store');

const DEFAULTS = {
  focusMin: 25,
  shortMin: 5,
  longMin: 15,
  longEvery: 4,
  autoNext: true,          // start the next phase automatically
  musicUri: '',            // playlist to start when a focus phase starts ('' = keep what is playing)
  musicOnFocus: true,      // resume music when focus starts
  pauseOnBreak: true,      // pause music on breaks
  quietFocus: true,        // hold back Ada's own Windows notifications while focusing
};

class Pomodoro extends EventEmitter {
  constructor(dir, now = () => Date.now()) {
    super();
    this.now = now;
    this.store = new Store(dir, 'pomodoro', { settings: DEFAULTS });
    this.settings = { ...DEFAULTS, ...this.store.get().settings };
    this.phase = 'idle';     // idle | focus | short | long
    this.endsAt = 0;
    this.remaining = 0;      // ms, while paused
    this.paused = false;
    this.done = 0;           // focus phases finished in this run (for the long break)
    this.timer = null;
  }

  setSettings(patch) {
    const clean = {};
    for (const [k, v] of Object.entries(patch || {})) {
      if (!(k in DEFAULTS)) continue;
      if (typeof DEFAULTS[k] === 'number') {
        const n = Math.round(Number(v));
        if (Number.isFinite(n)) clean[k] = Math.max(1, Math.min(k === 'longEvery' ? 12 : 180, n));
      } else if (typeof DEFAULTS[k] === 'boolean') clean[k] = !!v;
      else clean[k] = String(v || '');
    }
    this.settings = { ...this.settings, ...clean };
    this.store.set({ settings: this.settings });
    this.push();
  }

  lengthOf(phase) {
    const m = phase === 'focus' ? this.settings.focusMin : phase === 'long' ? this.settings.longMin : this.settings.shortMin;
    return m * 60 * 1000;
  }

  start(phase = 'focus') {
    this.phase = phase;
    this.paused = false;
    this.endsAt = this.now() + this.lengthOf(phase);
    this.schedule();
    this.emit('phase', { phase, auto: false });
    this.push();
  }

  toggle() {
    if (this.phase === 'idle') return this.start('focus');
    if (this.paused) {
      this.paused = false;
      this.endsAt = this.now() + this.remaining;
      this.schedule();
      this.emit('resume', { phase: this.phase });
    } else {
      this.paused = true;
      this.remaining = Math.max(0, this.endsAt - this.now());
      clearTimeout(this.timer);
      this.emit('pause', { phase: this.phase });
    }
    this.push();
  }

  stop() {
    clearTimeout(this.timer);
    const was = this.phase;
    this.phase = 'idle';
    this.paused = false;
    this.done = 0;
    this.push();
    if (was !== 'idle') this.emit('stop', { phase: was });
  }

  skip() {
    if (this.phase === 'idle') return;
    this.finish(true);
  }

  schedule() {
    clearTimeout(this.timer);
    const ms = Math.max(0, this.endsAt - this.now());
    // setTimeout drifts on sleep; re-check every 30 s at most.
    this.timer = setTimeout(() => this.check(), Math.min(ms, 30 * 1000));
  }

  check() {
    if (this.paused || this.phase === 'idle') return;
    if (this.now() >= this.endsAt - 50) this.finish(false);
    else this.schedule();
  }

  finish(skipped) {
    const ended = this.phase;
    let next;
    if (ended === 'focus') {
      if (!skipped) this.done += 1;
      next = this.done > 0 && this.done % this.settings.longEvery === 0 ? 'long' : 'short';
    } else {
      next = 'focus';
    }
    this.emit('end', { phase: ended, skipped, minutes: ended === 'focus' && !skipped ? this.settings.focusMin : 0, next });
    if (this.settings.autoNext) {
      this.phase = next;
      this.paused = false;
      this.endsAt = this.now() + this.lengthOf(next);
      this.schedule();
      this.emit('phase', { phase: next, auto: true });
    } else {
      this.phase = next;
      this.paused = true;
      this.remaining = this.lengthOf(next);
    }
    this.push();
  }

  snapshot() {
    const remaining = this.phase === 'idle' ? this.lengthOf('focus') : this.paused ? this.remaining : Math.max(0, this.endsAt - this.now());
    return {
      phase: this.phase,
      paused: this.paused,
      remaining,
      total: this.lengthOf(this.phase === 'idle' ? 'focus' : this.phase),
      at: this.now(),
      cycle: this.done % this.settings.longEvery,
      settings: this.settings,
    };
  }

  push() { this.emit('state', this.snapshot()); }
}

module.exports = { Pomodoro, POMODORO_DEFAULTS: DEFAULTS };
