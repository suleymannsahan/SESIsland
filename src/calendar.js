'use strict';
// Calendar from a secret iCal (ICS) address, e.g. Google Calendar → Settings → your calendar →
// "Secret address in iCal format". Fetched every 15 minutes; events of the coming week are kept
// in memory only. Recurring events (daily / weekly / monthly / yearly, with COUNT, UNTIL, BYDAY,
// INTERVAL and EXDATE) are expanded; that covers what Google, Outlook and Apple export.
const { EventEmitter } = require('events');

// ------------------------------------------------------------ parsing
function unfold(text) {
  return String(text || '').replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

function unescape(v) {
  return String(v || '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
}

/** "20261105T093000Z" | "20261105T093000" (local / TZID) | "20261105" (all day) -> { date, allDay } */
function parseDate(value, params = {}) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(String(value || '').trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (h == null || params.VALUE === 'DATE') return { date: new Date(+y, +mo - 1, +d), allDay: true };
  if (z) return { date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s || 0))), allDay: false };
  // TZID or floating: the computer's own time zone is the best guess for a student's own calendar
  return { date: new Date(+y, +mo - 1, +d, +h, +mi, +(s || 0)), allDay: false };
}

function parseLine(line) {
  const i = line.indexOf(':');
  if (i < 0) return null;
  const head = line.slice(0, i);
  const value = line.slice(i + 1);
  const [name, ...ps] = head.split(';');
  const params = {};
  for (const p of ps) { const [k, v] = p.split('='); if (k) params[k.toUpperCase()] = (v || '').replace(/^"|"$/g, ''); }
  return { name: name.toUpperCase(), params, value };
}

function parseIcs(text) {
  const events = [];
  let cur = null;
  for (const raw of unfold(text).split('\n')) {
    const line = raw.trimEnd();
    if (line === 'BEGIN:VEVENT') { cur = { exdates: [] }; continue; }
    if (line === 'END:VEVENT') { if (cur && cur.start) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const p = parseLine(line);
    if (!p) continue;
    switch (p.name) {
      case 'UID': cur.uid = p.value; break;
      case 'SUMMARY': cur.title = unescape(p.value); break;
      case 'LOCATION': cur.location = unescape(p.value); break;
      case 'DESCRIPTION': cur.description = unescape(p.value).slice(0, 2000); break;
      case 'URL': cur.url = p.value; break;
      case 'STATUS': cur.status = p.value.toUpperCase(); break;
      case 'DTSTART': { const d = parseDate(p.value, p.params); if (d) { cur.start = d.date; cur.allDay = d.allDay; } break; }
      case 'DTEND': { const d = parseDate(p.value, p.params); if (d) cur.end = d.date; break; }
      case 'DURATION': cur.duration = p.value; break;
      case 'RRULE': cur.rrule = Object.fromEntries(p.value.split(';').map((kv) => kv.split('=')).map(([k, v]) => [k.toUpperCase(), v])); break;
      case 'EXDATE': for (const v of p.value.split(',')) { const d = parseDate(v, p.params); if (d) cur.exdates.push(d.date.getTime()); } break;
      case 'RECURRENCE-ID': { const d = parseDate(p.value, p.params); if (d) cur.recurrenceId = d.date.getTime(); break; }
      default: break;
    }
  }
  return events;
}

function durationMs(ev) {
  if (ev.end) return Math.max(0, ev.end - ev.start);
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(ev.duration || '');
  if (m) return ((+(m[1] || 0) * 24 + +(m[2] || 0)) * 60 + +(m[3] || 0)) * 60000;
  return ev.allDay ? 86400000 : 3600000;
}

const DAYS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

/** Start times of one event's occurrences that overlap [from, to). */
function occurrences(ev, from, to) {
  const dur = durationMs(ev);
  const out = [];
  const push = (d) => { if (d.getTime() + dur > from.getTime() && d < to && !ev.exdates.includes(d.getTime())) out.push(new Date(d)); };
  const r = ev.rrule;
  if (!r) { push(ev.start); return out; }
  const freq = r.FREQ;
  const interval = Math.max(1, Number(r.INTERVAL) || 1);
  const count = r.COUNT ? Number(r.COUNT) : Infinity;
  const until = r.UNTIL ? (parseDate(r.UNTIL) || {}).date : null;
  const byday = r.BYDAY ? r.BYDAY.split(',').map((x) => DAYS[x.slice(-2)]).filter((x) => x != null) : null;
  let n = 0;
  const done = (d) => n >= count || (until && d > until) || d >= to;
  const start = ev.start;
  if (freq === 'WEEKLY') {
    const days = byday && byday.length ? byday : [start.getDay()];
    // walk week by week from the week of the first event
    const week0 = new Date(start);
    week0.setDate(start.getDate() - start.getDay());
    for (let w = 0; w < 2000; w += interval) {
      for (const dow of [...days].sort((a, b) => a - b)) {
        const d = new Date(week0);
        d.setDate(week0.getDate() + w * 7 + dow);
        d.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), 0);
        if (d < start) continue;
        if (done(d)) return out;
        n++;
        push(d);
      }
    }
    return out;
  }
  for (let k = 0; k < 5000; k++) {
    const d = new Date(start);
    if (freq === 'DAILY') d.setDate(start.getDate() + k * interval);
    else if (freq === 'MONTHLY') d.setMonth(start.getMonth() + k * interval);
    else if (freq === 'YEARLY') d.setFullYear(start.getFullYear() + k * interval);
    else { push(start); return out; }
    if (done(d)) return out;
    n++;
    push(d);
  }
  return out;
}

const MEET = /https:\/\/(?:meet\.google\.com|[\w.-]*zoom\.us|teams\.microsoft\.com|teams\.live\.com)\/[^\s"<>)]+/i;

/** Events overlapping [from, to), sorted, with moved / cancelled instances of recurring ones applied. */
function expand(events, from, to) {
  const moved = new Map();   // uid -> Set of original start times replaced by a RECURRENCE-ID copy
  for (const ev of events) if (ev.recurrenceId && ev.uid) {
    if (!moved.has(ev.uid)) moved.set(ev.uid, new Set());
    moved.get(ev.uid).add(ev.recurrenceId);
  }
  const out = [];
  for (const ev of events) {
    if (ev.status === 'CANCELLED') continue;
    const dur = durationMs(ev);
    for (const d of occurrences(ev, from, to)) {
      if (!ev.recurrenceId && ev.uid && moved.has(ev.uid) && moved.get(ev.uid).has(d.getTime())) continue;
      const link = (ev.url && MEET.test(ev.url) ? ev.url : null) || ((ev.location || '').match(MEET) || [])[0] || ((ev.description || '').match(MEET) || [])[0] || '';
      out.push({
        id: `${ev.uid || ev.title}@${d.getTime()}`,
        title: ev.title || '(adsız)',
        location: (ev.location || '').replace(MEET, '').replace(/^[\s,;]+|[\s,;]+$/g, ''),
        start: d.getTime(),
        end: d.getTime() + dur,
        allDay: !!ev.allDay,
        link,
      });
    }
  }
  return out.sort((a, b) => a.start - b.start).slice(0, 200);
}

class Calendar extends EventEmitter {
  constructor(fetchFn) {
    super();
    this.fetch = fetchFn || globalThis.fetch;
    this.url = '';
    this.raw = [];
    this.state = { configured: false, events: [], error: '', updated: 0 };
    this.timer = null;
  }

  setUrl(url) {
    let u = String(url || '').trim().replace(/^webcal:\/\//i, 'https://');
    if (u && !/^https:\/\//i.test(u)) u = '';
    this.url = u;
    this.raw = [];
    this.state = { configured: !!u, events: [], error: '', updated: 0 };
    this.push();
  }

  start() {
    this.stop();
    if (!this.url) return;
    const tick = async () => {
      await this.refresh().catch(() => {});
      this.timer = setTimeout(tick, 15 * 60 * 1000);
    };
    tick();
    // re-expand every few minutes so "today" stays today without fetching again
    this.dayTimer = setInterval(() => this.recompute(), 5 * 60 * 1000);
  }

  stop() { clearTimeout(this.timer); clearInterval(this.dayTimer); }

  async refresh() {
    if (!this.url) return this.state;
    try {
      const res = await this.fetch(this.url, { headers: { 'User-Agent': 'Ada calendar' } });
      if (!res.ok) throw new Error(`Takvim alınamadı (${res.status})`);
      const text = await res.text();
      if (!/BEGIN:VCALENDAR/.test(text)) throw new Error('Bu adres bir iCal takvimi değil');
      this.raw = parseIcs(text);
      this.state.error = '';
      this.state.updated = Date.now();
    } catch (e) {
      this.state.error = e.message;
    }
    this.recompute();
    return this.state;
  }

  recompute() {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(from.getDate() + 8);
    this.state = { ...this.state, configured: !!this.url, events: expand(this.raw, from, to) };
    this.push();
  }

  push() { this.emit('state', this.state); }
}

module.exports = { Calendar, parseIcs, expand, occurrences, parseDate };
