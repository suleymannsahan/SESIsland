'use strict';
// Checks GitHub Releases for a newer Ada and tells the island. Nothing is downloaded without a click.
const { EventEmitter } = require('events');

function newer(a, b) {
  const pa = String(a).replace(/^v/, '').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const pb = String(b).replace(/^v/, '').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return false;
}

class Updater extends EventEmitter {
  constructor(current, opts = {}) {
    super();
    this.current = current;
    this.fetch = opts.fetch || globalThis.fetch;
    this.repo = '';
    this.timer = null;
    this.latest = null;
  }

  setRepo(repo) {
    this.repo = /^[\w.-]+\/[\w.-]+$/.test(repo || '') ? repo : '';
  }

  start() {
    this.stop();
    if (!this.repo) return;
    const tick = async () => {
      await this.check().catch(() => {});
      this.timer = setTimeout(tick, 6 * 60 * 60 * 1000);
    };
    this.timer = setTimeout(tick, 20 * 1000);
  }

  stop() { clearTimeout(this.timer); }

  async check() {
    if (!this.repo) return null;
    const res = await this.fetch(`https://api.github.com/repos/${this.repo}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Ada-updater' },
    });
    if (!res.ok) return null;
    const j = await res.json();
    const tag = j.tag_name || '';
    if (!newer(tag, this.current)) return null;
    const asset = (j.assets || []).find((a) => /setup-[\d.]+\.exe$/i.test(a.name)) || (j.assets || []).find((a) => /setup.*\.exe$/i.test(a.name)) || (j.assets || []).find((a) => /\.zip$/i.test(a.name));
    this.latest = { version: tag.replace(/^v/, ''), url: asset ? asset.browser_download_url : j.html_url, page: j.html_url, notes: String(j.body || '').slice(0, 400) };
    this.emit('available', this.latest);
    return this.latest;
  }
}

module.exports = { Updater, newer };
