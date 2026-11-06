'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const e = require('../src/renderer/electronics.js');

test('değer ayrıştırma (4k7, 1M, 100nF)', () => {
  assert.deepEqual(e.parse('4k7'), { v: 4700, unit: 'R' });
  assert.equal(e.parse('1M').v, 1e6);
  const c = e.parse('100nF');
  assert.equal(c.unit, 'F');
  assert.ok(Math.abs(c.v - 100e-9) < 1e-15);
});

test('renk bantları: değer → bant → değer', () => {
  const b4 = e.toBands(4700, 4);
  assert.deepEqual(b4.digits, [4, 7]);
  assert.equal(e.fromBands(b4), 4700);
  assert.deepEqual(e.bandColors(b4).map((c) => c.name), ['Sarı', 'Mor', 'Kırmızı', 'Altın']);
  assert.deepEqual(e.toBands(4700, 5).digits, [4, 7, 0]);
});

test('en yakın E serisi değeri', () => {
  assert.equal(e.nearest(4800, 12), 4700);
  assert.equal(e.nearest(4800, 24), 4700);
  assert.equal(e.nearest(1234, 96), 1240);
});

test('kondansatör kodu ve AWG', () => {
  assert.equal(e.capCode(100e-9), '104');
  assert.ok(Math.abs(e.awgDiameter(22) - 0.6438) < 1e-3);
});

test('çevirici: 20dBm → 100 mW, 25C → 77 °F', () => {
  assert.equal(e.convert('20dBm').find((r) => r.k === 'Güç').v, '100 mW');
  assert.equal(e.convert('25C').find((r) => r.k === 'Fahrenheit').v, '77 °F');
});
