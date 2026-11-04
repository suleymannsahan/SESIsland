'use strict';
// Clipboard history: the last 20 copied texts, kept in memory only (never written to disk),
// so a copied password does not end up in a file.
const { EventEmitter } = require('events');

class ClipHistory extends EventEmitter {
  constructor(clipboard) {
    super();
    this.clipboard = clipboard;
    this.items = [];
    this.last = '';
    this.timer = null;
    this.enabled = true;
  }

  start() {
    this.stop();
    try { this.last = this.clipboard.readText(); } catch { this.last = ''; }
    this.timer = setInterval(() => this.poll(), 1000);
  }

  stop() { clearInterval(this.timer); }

  setEnabled(on) {
    this.enabled = !!on;
    if (!on) { this.items = []; this.emit('state', this.snapshot()); }
  }

  poll() {
    if (!this.enabled) return;
    let t = '';
    try { t = this.clipboard.readText(); } catch { return; }
    if (!t || t === this.last) return;
    this.last = t;
    if (t.length > 10000 || !t.trim()) return;
    this.items = [{ text: t, at: Date.now() }, ...this.items.filter((x) => x.text !== t)].slice(0, 20);
    this.emit('state', this.snapshot());
  }

  copy(i) {
    const item = this.items[i];
    if (!item) return;
    this.last = item.text;
    this.clipboard.writeText(item.text);
    this.items = [item, ...this.items.filter((_, j) => j !== i)];
    this.emit('state', this.snapshot());
  }

  remove(i) {
    this.items = this.items.filter((_, j) => j !== i);
    this.emit('state', this.snapshot());
  }

  clear() {
    this.items = [];
    this.emit('state', this.snapshot());
  }

  snapshot() {
    return { enabled: this.enabled, items: this.items.map((x) => ({ text: x.text.slice(0, 400), len: x.text.length, at: x.at })) };
  }
}

module.exports = { ClipHistory };
