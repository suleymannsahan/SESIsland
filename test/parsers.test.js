'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseLrc } = require('../src/lyrics.js');
const { parseNumbers } = require('../src/serial.js');
const { newer } = require('../src/updater.js');
const { clip, describeTool } = require('../src/describe.js');

test('LRC: zaman damgaları, çoklu damga ve sıralama', () => {
  const lines = parseLrc('[00:01.50]a\n[00:00.20][01:00]b\nzaman yok');
  assert.deepEqual(lines, [
    { t: 200, text: 'b' },
    { t: 1500, text: 'a' },
    { t: 60000, text: 'b' },
  ]);
  assert.deepEqual(parseLrc(null), []);
});

test('seri port: anahtar:değer ve çıplak sayılar, ESP32 gibi adlar atlanır', () => {
  assert.deepEqual(parseNumbers('ESP32 temp:41.2 hum=55 3.3 PASS'), [
    { k: 'temp', v: 41.2 },
    { k: 'hum', v: 55 },
    { k: '#3', v: 3.3 },
  ]);
  assert.equal(parseNumbers('1 2 3 4 5 6').length, 4);
});

test('güncelleme: sürüm karşılaştırma', () => {
  assert.equal(newer('0.6.0', '0.5.1'), true);
  assert.equal(newer('v0.5.0', '0.5.0'), false);
  assert.equal(newer('0.10.0', '0.9.9'), true);
  assert.equal(newer('0.5.0', '0.6.0'), false);
});

test('Claude araç açıklamaları', () => {
  assert.equal(clip('abcdefghij', 5), 'abcd…');
  assert.equal(describeTool('Bash', { command: 'npm test' }), '$ npm test');
  assert.match(describeTool('Edit', { file_path: '/a/b/c.js' }), /c\.js$/);
});
