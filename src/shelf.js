'use strict';
// File shelf: drop files on the island to park them, drag them out again wherever you need them.
// Only the paths are kept (in shelf.json); files are never copied or moved.
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { Store } = require('./store');

const MAX = 40;

class Shelf extends EventEmitter {
  /** iconFor(path) -> Promise<nativeImage|null> (app.getFileIcon in the app, a stub in tests) */
  constructor(dir, iconFor) {
    super();
    this.store = new Store(dir, 'shelf', { items: [] });
    this.iconFor = iconFor || (async () => null);
    this.icons = new Map();   // path -> { img, url }
  }

  async load() {
    const items = (this.store.get().items || []).filter((x) => x && x.path && fs.existsSync(x.path));
    this.store.set({ items });
    await Promise.all(items.map((x) => this.loadIcon(x.path)));
    this.push();
  }

  async loadIcon(p) {
    if (this.icons.has(p)) return;
    try {
      const img = await this.iconFor(p);
      if (img && !img.isEmpty()) this.icons.set(p, { img, url: img.toDataURL() });
    } catch { /* no icon */ }
  }

  items() { return this.store.get().items || []; }
  has(p) { return this.items().some((x) => x.path === p); }
  icon(p) { const i = this.icons.get(p); return i ? i.img : null; }

  async add(paths) {
    const list = [...this.items()];
    let added = 0;
    for (const raw of (Array.isArray(paths) ? paths : [paths]).slice(0, 100)) {
      const p = path.resolve(String(raw || ''));
      if (!raw || list.some((x) => x.path === p)) continue;
      let st;
      try { st = fs.statSync(p); } catch { continue; }
      list.unshift({ path: p, name: path.basename(p) || p, dir: st.isDirectory(), size: st.isDirectory() ? null : st.size, added: Date.now() });
      added++;
      await this.loadIcon(p);
    }
    for (const x of list.splice(MAX)) this.icons.delete(x.path);
    this.store.set({ items: list });
    this.push();
    return added;
  }

  remove(p) {
    this.store.set({ items: this.items().filter((x) => x.path !== p) });
    this.icons.delete(p);
    this.push();
  }

  clear() {
    this.store.set({ items: [] });
    this.icons.clear();
    this.push();
  }

  snapshot() {
    return {
      items: this.items().map((x) => ({ ...x, icon: (this.icons.get(x.path) || {}).url || '', ext: x.dir ? '' : path.extname(x.name).slice(1).toLowerCase() })),
    };
  }

  push() { this.emit('state', this.snapshot()); }
}

module.exports = { Shelf };
