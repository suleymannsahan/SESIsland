'use strict';
// Checks GitHub Releases for a newer Ada and tells the island. Nothing is downloaded without a
// click; then the installer is downloaded, checked (size + GitHub's sha256 digest) and run silently,
// and Ada restarts on the new version.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');

/** "### Eklendi\n- **Her uygulamanın müziği:** YouTube…" -> "Her uygulamanın müziği: YouTube…" */
function summarize(body) {
  const lines = String(body || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const first = lines.find((l) => /^[-*] /.test(l)) || lines.find((l) => !/^#|^\*\*Full Changelog/i.test(l)) || '';
  return first.replace(/^[-*] /, '').replace(/\*\*|__|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').slice(0, 200);
}

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
    const digest = asset && /^sha256:([0-9a-f]{64})$/i.exec(asset.digest || '');
    this.latest = {
      version: tag.replace(/^v/, ''),
      url: asset ? asset.browser_download_url : j.html_url,
      page: j.html_url,
      notes: summarize(j.body),
      installer: !!(asset && /\.exe$/i.test(asset.name)),
      name: asset ? asset.name : '',
      size: asset ? Number(asset.size) || 0 : 0,
      sha256: digest ? digest[1].toLowerCase() : '',
    };
    this.emit('available', this.latest);
    return this.latest;
  }
}

/**
 * Downloads the installer of `latest` into `dir`, reporting progress (0…1), and checks its size
 * and sha256. Resolves to the file path.
 */
async function download(latest, dir, { fetch = globalThis.fetch, onProgress = () => {} } = {}) {
  if (!latest || !latest.installer) throw new Error('Bu sürümde kurulum dosyası yok');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, latest.name.replace(/[^\w.-]/g, '_'));
  const part = file + '.part';
  const res = await fetch(latest.url, { headers: { 'User-Agent': 'Ada-updater' }, redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`İndirilemedi (${res.status})`);
  const total = Number(res.headers.get('content-length')) || latest.size || 0;
  const hash = crypto.createHash('sha256');
  const out = fs.createWriteStream(part);
  let got = 0;
  let last = 0;
  try {
    for await (const chunk of res.body) {
      const buf = Buffer.from(chunk);
      hash.update(buf);
      got += buf.length;
      if (!out.write(buf)) await new Promise((r) => out.once('drain', r));
      if (total && (got - last > total / 100 || got === total)) { last = got; onProgress(Math.min(1, got / total)); }
    }
  } finally {
    await new Promise((r) => out.end(r));
  }
  if (latest.size && got !== latest.size) { fs.rmSync(part, { force: true }); throw new Error('Dosya eksik indi'); }
  const sum = hash.digest('hex');
  if (latest.sha256 && sum !== latest.sha256) { fs.rmSync(part, { force: true }); throw new Error('Dosya doğrulanamadı (sha256 uyuşmuyor)'); }
  fs.rmSync(file, { force: true });
  fs.renameSync(part, file);
  onProgress(1);
  return file;
}

module.exports = { Updater, newer, summarize, download };
