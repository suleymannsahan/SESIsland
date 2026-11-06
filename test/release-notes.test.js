'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { sectionFor } = require('../.github/scripts/release-notes.js');

const changelog = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8');

test('CHANGELOG: sürüm bölümü çıkarılır', () => {
  const notes = sectionFor(changelog, 'v0.5.1');
  assert.match(notes, /kronometre/i);
  assert.doesNotMatch(notes, /^## /m);
});

test('CHANGELOG: package.json sürümünün bir bölümü var', () => {
  const { version } = require('../package.json');
  assert.notEqual(sectionFor(changelog, version), '', `CHANGELOG.md içinde ## [${version}] yok`);
});

test('CHANGELOG: bilinmeyen sürüm boş döner', () => {
  assert.equal(sectionFor(changelog, '9.9.9'), '');
});
