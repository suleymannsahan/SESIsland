'use strict';
// Understands what people type for a timer or an alarm:
//   "15 dk", "15dk çay", "1 saat 30 dk", "1sa30dk", "90 sn", "25m", "2h"   -> a countdown
//   "7:30", "07.30 alarm", "alarm 7:30 kalk", "22:00'de ilaç"               -> an alarm at that time
// Returns { kind: 'timer', ms, label } | { kind: 'alarm', at, label } | null.
(function (root) {
  const UNITS = [
    [/^(sn|saniye|san|s|sec|secs|second|seconds)$/, 1000],
    [/^(dk|dak|dakika|m|min|mins|minute|minutes)$/, 60000],
    [/^(sa|saat|h|hr|hrs|hour|hours)$/, 3600000],
  ];
  const unitMs = (u) => { for (const [re, ms] of UNITS) if (re.test(u)) return ms; return 0; };

  function parse(input, now = new Date()) {
    let s = String(input || '').trim().toLocaleLowerCase('tr').replace(/,/g, '.');
    if (!s) return null;
    s = s.replace(/^(zamanlayıcı|sayaç|timer)\s+/, '');

    // alarm: "alarm 7:30 …", "7:30 …", "22.00'de …"
    const am = /^(?:alarm\s+)?(\d{1,2})[:.](\d{2})(?:['’]?(?:da|de|ta|te))?(?:\s+alarm)?(?:\s+(.*))?$/.exec(s);
    if (am) {
      const h = Number(am[1]);
      const m = Number(am[2]);
      if (h > 23 || m > 59) return null;
      const at = new Date(now);
      at.setHours(h, m, 0, 0);
      if (at <= now) at.setDate(at.getDate() + 1);
      return { kind: 'alarm', at: at.getTime(), label: (am[3] || '').trim() };
    }

    // countdown: one or more "<number><unit>" parts, then an optional label
    const re = /^(\d+(?:\.\d+)?)\s*([a-zçğıöşü]+)\s*/;
    let ms = 0;
    let rest = s;
    let parts = 0;
    for (;;) {
      const m = re.exec(rest);
      if (!m) break;
      const u = unitMs(m[2]);
      if (!u) break;
      ms += Number(m[1]) * u;
      rest = rest.slice(m[0].length);
      parts++;
    }
    // a bare number means minutes ("25")
    if (!parts) {
      const n = /^(\d{1,3})(?:\s+(.*))?$/.exec(s);
      if (!n || Number(n[1]) < 1) return null;
      return { kind: 'timer', ms: Number(n[1]) * 60000, label: (n[2] || '').trim(), guess: true };
    }
    if (ms < 1000 || ms > 24 * 3600000) return null;
    return { kind: 'timer', ms: Math.round(ms), label: rest.replace(/^(sonra|sayaç|zamanlayıcı)\s*/, '').trim() };
  }

  /** 900000 -> "15 dk", 5400000 -> "1 sa 30 dk", 45000 -> "45 sn" */
  function human(ms) {
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s} sn`;
    if (s < 600 && s % 60) return `${Math.floor(s / 60)} dk ${s % 60} sn`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m} dk`;
    const h = Math.floor(m / 60);
    return m % 60 ? `${h} sa ${m % 60} dk` : `${h} sa`;
  }

  /** remaining ms -> "14:59" / "1:02:03" */
  function clock(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
  }

  const api = { parse, human, clock };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AdaTime = api;
})(typeof window !== 'undefined' ? window : globalThis);
