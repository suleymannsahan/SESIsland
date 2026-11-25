'use strict';
// 0.7: timers, time parsing, plugins, token counting, weather codes, update download.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const T = require('../src/renderer/timeparse.js');
const { Timers } = require('../src/timers.js');
const { Plugins } = require('../src/plugins.js');
const { TokenStats } = require('../src/tokens.js');
const { describe } = require('../src/weather.js');
const { download, summarize } = require('../src/updater.js');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ada-test-'));

test('timeparse: countdowns, alarms, labels', () => {
  const now = new Date(2026, 10, 25, 13, 0);
  assert.deepEqual(T.parse('15 dk çay', now), { kind: 'timer', ms: 900000, label: 'çay' });
  assert.equal(T.parse('1 saat 30 dk', now).ms, 5400000);
  assert.equal(T.parse('1sa30dk', now).ms, 5400000);
  assert.equal(T.parse('90 sn', now).ms, 90000);
  assert.equal(T.parse('25', now).ms, 1500000);
  const a = T.parse("22:00'de ilaç", now);
  assert.equal(a.kind, 'alarm');
  assert.equal(new Date(a.at).getHours(), 22);
  assert.equal(a.label, 'ilaç');
  // a time already past today means tomorrow
  assert.equal(new Date(T.parse('7:30', now).at).getDate(), 26);
  assert.equal(T.parse('25:00', now), null);
  assert.equal(T.parse('merhaba', now), null);
  assert.equal(T.human(90000), '1 dk 30 sn');
  assert.equal(T.human(5400000), '1 sa 30 dk');
  assert.equal(T.clock(3723000), '1:02:03');
});

test('timers: pause, ring, snooze, survive a restart', () => {
  let t = 1e9;
  const dir = tmp();
  const a = new Timers(dir, () => t);
  const rings = [];
  a.on('ring', (x) => rings.push(x.label));
  const tea = a.add({ kind: 'timer', ms: 60000, label: 'çay' });
  a.add({ kind: 'alarm', at: t + 120000, label: 'kalk' });
  a.togglePause(tea.id);
  t += 90000; a.tick();
  assert.deepEqual(rings, []);
  a.togglePause(tea.id);
  t += 61000; a.tick();
  assert.deepEqual(rings.sort(), ['kalk', 'çay']);
  a.snooze(tea.id, 5);
  a.store.saveNow();
  const b = new Timers(dir, () => t);
  const again = b.list().find((x) => x.id === tea.id);
  assert.equal(again.ringing, false);
  assert.equal(again.end - t, 5 * 60000);
  assert.throws(() => a.add({ kind: 'timer', ms: -5 }));
});

test('plugins: manifest, serving only enabled files inside the folder', () => {
  const ud = tmp();
  const p = new Plugins(ud);
  const id = p.install(path.join(__dirname, '..', 'src', 'plugins-example', 'doviz'));
  assert.equal(id, 'doviz');
  assert.equal(p.list.length, 1);
  assert.equal(p.resolve('ada-plugin://doviz/tab.js', {}), null, 'disabled plugins are not served');
  assert.ok(p.resolve('ada-plugin://doviz/tab.js', { doviz: true }).endsWith('tab.js'));
  assert.equal(p.resolve('ada-plugin://doviz/../../settings.json', { doviz: true }), null);
  assert.equal(p.resolve('ada-plugin://doviz/%2e%2e/%2e%2e/x.js', { doviz: true }), null);
  assert.equal(p.resolve('ada-plugin://doviz/plugin.exe', { doviz: true }), null);
  // a folder whose name does not match its id is ignored
  fs.mkdirSync(path.join(p.dir, 'baska'));
  fs.writeFileSync(path.join(p.dir, 'baska', 'plugin.json'), JSON.stringify({ id: 'doviz2', main: 'tab.js' }));
  fs.writeFileSync(path.join(p.dir, 'baska', 'tab.js'), '');
  assert.equal(p.scan().length, 1);
  p.save('doviz', { a: 1 });
  assert.deepEqual(p.load('doviz'), { a: 1 });
  assert.throws(() => p.save('doviz', 'x'.repeat(300 * 1024)));
});

test('tokens: per day, per project, a message counted once', async () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, 'p'));
  const now = Date.now();
  const iso = (d) => new Date(now - d * 86400000).toISOString();
  const msg = (id, d, u) => JSON.stringify({ type: 'assistant', timestamp: iso(d), requestId: 'r' + id, message: { id: 'm' + id, usage: u } });
  fs.writeFileSync(path.join(root, 'p', 'a.jsonl'), [
    JSON.stringify({ type: 'user', cwd: 'C:\\Users\\emre\\ada', timestamp: iso(0) }),
    msg(1, 0, { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 1000, cache_read_input_tokens: 9000 }),
    msg(1, 0, { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 1000, cache_read_input_tokens: 9000 }),
    msg(2, 1, { input_tokens: 10, output_tokens: 5 }),
    msg(3, 30, { input_tokens: 999, output_tokens: 999 }),
  ].join('\n'));
  const s = await new TokenStats(root).refresh();
  const today = s.days[s.days.length - 1];
  assert.equal(today.in + today.out + today.cw, 1150);
  assert.equal(s.days.reduce((a, d) => a + d.in, 0), 110);
  assert.deepEqual(s.projects, [{ name: 'ada', tokens: 1165 }]);
});

test('weather codes', () => {
  assert.equal(describe(0).kind, 'clear');
  assert.equal(describe(63).kind, 'rain');
  assert.equal(describe(75).kind, 'snow');
  assert.equal(describe(95).kind, 'storm');
  assert.equal(describe(45).kind, 'fog');
});

test('update: summary line and a checked download', async () => {
  assert.equal(summarize('### Eklendi\n- **Komut çubuğu:** [Ctrl](x)+Alt'), 'Komut çubuğu: Ctrl+Alt');
  const data = Buffer.alloc(200000, 3);
  const sha256 = crypto.createHash('sha256').update(data).digest('hex');
  const fetch = async () => new Response(data, { headers: { 'content-length': String(data.length) } });
  const dir = tmp();
  const f = await download({ installer: true, name: 'Ada-Setup-0.7.0.exe', url: 'x', size: data.length, sha256 }, dir, { fetch });
  assert.equal(fs.statSync(f).size, data.length);
  await assert.rejects(download({ installer: true, name: 'b.exe', url: 'x', size: data.length, sha256: '0'.repeat(64) }, dir, { fetch }), /sha256/);
  await assert.rejects(download({ installer: true, name: 'c.exe', url: 'x', size: data.length + 1, sha256: '' }, dir, { fetch }), /eksik/);
});
