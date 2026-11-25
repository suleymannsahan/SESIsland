'use strict';
// The colour of the desktop wallpaper right under the island (the top middle of the picture), so
// the island can take on a little of it. Windows keeps the current picture, already scaled, in
// %APPDATA%\Microsoft\Windows\Themes\TranscodedWallpaper; a plain colour background is in the
// registry instead.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

/**
 * Average colour of the top-middle strip of a BGRA bitmap.
 * @returns {{r:number,g:number,b:number,lum:number}|null}
 */
function sampleTop(bitmap, width, height, { x0 = 0.3, x1 = 0.7, y1 = 0.14 } = {}) {
  if (!bitmap || !width || !height || bitmap.length < width * height * 4) return null;
  let r = 0, g = 0, b = 0, n = 0;
  const xa = Math.round(width * x0), xb = Math.max(xa + 1, Math.round(width * x1));
  const yb = Math.max(1, Math.round(height * y1));
  for (let y = 0; y < yb; y++) {
    for (let x = xa; x < xb; x++) {
      const i = (y * width + x) * 4;
      b += bitmap[i]; g += bitmap[i + 1]; r += bitmap[i + 2]; n++;
    }
  }
  if (!n) return null;
  return withLum({ r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) });
}

function withLum(c) {
  // relative luminance (sRGB)
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return { ...c, lum: Math.round((0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b)) * 1000) / 1000 };
}

/** "R G B" from HKCU\Control Panel\Colors Background */
function parseRegColor(text) {
  const m = /Background\s+REG_SZ\s+(\d+)\s+(\d+)\s+(\d+)/i.exec(text || '');
  return m ? withLum({ r: +m[1], g: +m[2], b: +m[3] }) : null;
}

function reg(key, value) {
  return new Promise((resolve) => {
    execFile('reg', ['query', key, '/v', value], { windowsHide: true, timeout: 4000 }, (err, out) => resolve(err ? '' : String(out)));
  });
}

class Wallpaper {
  constructor(nativeImage, onChange) {
    this.nativeImage = nativeImage;
    this.onChange = onChange;
    this.state = null;
    this.stamp = '';
    this.timer = null;
  }

  file() {
    return path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Themes', 'TranscodedWallpaper');
  }

  async read() {
    if (process.platform !== 'win32') return null;
    const wp = await reg('HKCU\\Control Panel\\Desktop', 'WallPaper');
    const picture = /WallPaper\s+REG_SZ\s+\S/i.test(wp);
    if (!picture) return parseRegColor(await reg('HKCU\\Control Panel\\Colors', 'Background'));
    const f = this.file();
    const img = this.nativeImage.createFromBuffer(fs.readFileSync(f));
    if (img.isEmpty()) return null;
    const small = img.resize({ width: 96, quality: 'good' });
    const { width, height } = small.getSize();
    return sampleTop(small.toBitmap(), width, height);
  }

  async refresh(force) {
    try {
      let stamp = '';
      try { const st = fs.statSync(this.file()); stamp = `${st.mtimeMs}:${st.size}`; } catch { /* plain colour */ }
      if (!force && stamp && stamp === this.stamp) return this.state;
      this.stamp = stamp;
      const c = await this.read();
      if (c && JSON.stringify(c) !== JSON.stringify(this.state)) { this.state = c; this.onChange(c); }
    } catch { /* keep the last colour */ }
    return this.state;
  }

  start() {
    this.refresh(true);
    clearInterval(this.timer);
    this.timer = setInterval(() => this.refresh(false), 2 * 60 * 1000);
  }
}

module.exports = { Wallpaper, sampleTop, parseRegColor };
