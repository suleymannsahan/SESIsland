'use strict';
// Draws the tray icon in code (a small pill with a glowing dot) so the app ships with no image assets.
function makeTrayIcon(nativeImage, size = 32) {
  const buf = Buffer.alloc(size * size * 4);
  const cy = size / 2;
  const h = size * 0.42;            // pill height
  const left = size * 0.08, right = size * 0.92;
  const r = h / 2;
  const dot = { x: left + r, y: cy, r: r * 0.55 };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5, py = y + 0.5;
      // signed distance to the pill (capsule)
      const cx = Math.min(Math.max(px, left + r), right - r);
      const d = Math.hypot(px - cx, py - cy) - r;
      let a = Math.max(0, Math.min(1, 0.5 - d));
      let R = 245, G = 245, B = 245;
      const dd = Math.hypot(px - dot.x, py - dot.y) - dot.r;
      const da = Math.max(0, Math.min(1, 0.5 - dd));
      // dot is cut out of the pill and filled with the accent colour
      R = Math.round(R * (1 - da) + 132 * da);
      G = Math.round(G * (1 - da) + 222 * da);
      B = Math.round(B * (1 - da) + 168 * da);
      const i = (y * size + x) * 4;
      buf[i] = B; buf[i + 1] = G; buf[i + 2] = R; buf[i + 3] = Math.round(a * 255);
    }
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size });
}

module.exports = { makeTrayIcon };
