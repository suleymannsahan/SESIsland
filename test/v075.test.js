'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { sampleTop, parseRegColor } = require('../src/wallpaper');

function bitmap(w, h, fn) {
  const b = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, bl] = fn(x, y);
    const i = (y * w + x) * 4;
    b[i] = bl; b[i + 1] = g; b[i + 2] = r; b[i + 3] = 255;
  }
  return b;
}

test('wallpaper: averages the top middle strip only (BGRA)', () => {
  // top 14 % middle is red, everything else blue
  const bm = bitmap(100, 50, (x, y) => (y < 7 && x >= 30 && x < 70 ? [200, 20, 10] : [0, 0, 255]));
  const c = sampleTop(bm, 100, 50);
  assert.deepStrictEqual([c.r, c.g, c.b], [200, 20, 10]);
  assert.ok(c.lum > 0 && c.lum < 0.2);
});

test('wallpaper: luminance tells light from dark', () => {
  const white = sampleTop(bitmap(20, 20, () => [250, 250, 250]), 20, 20);
  const black = sampleTop(bitmap(20, 20, () => [5, 5, 5]), 20, 20);
  assert.ok(white.lum > 0.9);
  assert.ok(black.lum < 0.01);
});

test('wallpaper: bad input gives null', () => {
  assert.strictEqual(sampleTop(null, 10, 10), null);
  assert.strictEqual(sampleTop(Buffer.alloc(8), 10, 10), null);
});

test('wallpaper: plain colour background from the registry', () => {
  const out = '\r\nHKEY_CURRENT_USER\\Control Panel\\Colors\r\n    Background    REG_SZ    0 99 177\r\n';
  const c = parseRegColor(out);
  assert.deepStrictEqual([c.r, c.g, c.b], [0, 99, 177]);
  assert.strictEqual(parseRegColor('nothing'), null);
});
