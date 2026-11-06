'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseIcs, expand, parseDate } = require('../src/calendar.js');

const ICS = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'UID:1',
  'SUMMARY:Devre',
  ' Analizi',
  'DTSTART:20261106T090000Z',
  'DTEND:20261106T100000Z',
  'RRULE:FREQ=WEEKLY;COUNT=3',
  'EXDATE:20261113T090000Z',
  'LOCATION:https://meet.google.com/abc-defg-hij',
  'END:VEVENT',
  'END:VCALENDAR',
  '',
].join('\r\n');

test('UTC ve tüm gün tarihleri', () => {
  assert.equal(parseDate('20261106T090000Z').date.toISOString(), '2026-11-06T09:00:00.000Z');
  const d = parseDate('20261106');
  assert.equal(d.allDay, true);
  assert.deepEqual([d.date.getFullYear(), d.date.getMonth(), d.date.getDate()], [2026, 10, 6]);
});

test('iCal ayrıştırma: katlanmış satır, RRULE, EXDATE', () => {
  const [ev] = parseIcs(ICS);
  assert.equal(ev.title, 'DevreAnalizi');
  assert.deepEqual(ev.rrule, { FREQ: 'WEEKLY', COUNT: '3' });
  assert.equal(ev.exdates.length, 1);
});

test('tekrar açma: COUNT=3 içinden EXDATE düşer', () => {
  const occ = expand(parseIcs(ICS), new Date('2026-11-01T00:00:00Z'), new Date('2026-12-31T00:00:00Z'));
  assert.deepEqual(occ.map((o) => new Date(o.start).toISOString().slice(0, 10)), ['2026-11-06', '2026-11-20']);
  assert.equal(occ[0].end - occ[0].start, 3600000);
});
