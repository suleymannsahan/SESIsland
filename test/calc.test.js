'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluate, si, plain } = require('../src/renderer/calc.js');

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);

test('işlem önceliği ve parantez', () => {
  assert.equal(evaluate('2+3*4'), 14);
  assert.equal(evaluate('(1+2)*3'), 9);
});

test('SI ön ekleri', () => {
  assert.equal(evaluate('4.7k*2'), 9400);
  near(evaluate('12V/220'), 12 / 220);
});

test('paralel direnç (||)', () => {
  near(evaluate('1k||2.2k'), (1000 * 2200) / 3200);
});

test('birimli ifade: 1/(2πfC)', () => {
  near(evaluate('1/(2pi*50Hz*100nF)'), 1 / (2 * Math.PI * 50 * 100e-9));
});

test('boş girdi null döner, bozuk girdi hata atar', () => {
  assert.equal(evaluate(''), null);
  assert.throws(() => evaluate('2+'));
});

test('si() ve plain() biçimlendirme', () => {
  assert.equal(si(4700), '4.7k');
  assert.equal(si(0.000022), '22µ');
  assert.equal(si(0), '0');
  assert.equal(plain(123.456), '123.456');
  assert.equal(plain(1e-6), '1.0000e-6');
});
