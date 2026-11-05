'use strict';
/* global Ada, ada */
// Lessons tab: today's classes (now / next), exam countdowns, and a reminder pill before a class.
(() => {
  const { S, I, esc } = Ada;
  const DAYS = ['', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

  const toMin = (hm) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hm || '');
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const dow = (d = new Date()) => ((d.getDay() + 6) % 7) + 1;
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const sched = () => S.mods.schedule || { classes: [], exams: [] };
  const cal = () => S.mods.calendar || { configured: false, events: [] };
  const hm = (t) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const sameDay = (t, k = 0) => { const a = new Date(t); const b = new Date(); b.setDate(b.getDate() + k); return a.toDateString() === b.toDateString(); };
  const CAM = '<svg viewBox="0 0 24 24"><rect x="3" y="6.5" width="12.5" height="11" rx="2.2"/><path d="M15.5 10.5l5-3v9l-5-3z"/></svg>';
  // calendar events of today (or tomorrow) that are not over yet
  const calToday = (k = 0) => (cal().events || []).filter((e) => sameDay(e.start, k) && (k > 0 || e.allDay || e.end > Date.now()));
  function nextEvent() {
    const now = Date.now();
    return (cal().events || []).filter((e) => !e.allDay && e.start >= now - 60000).sort((a, b) => a.start - b.start)[0] || null;
  }
  function eventRow(e) {
    const now = Date.now();
    const live = !e.allDay && e.start <= now && now < e.end;
    const left = Math.round((e.start - now) / 60000);
    const meta = e.allDay ? 'tüm gün' : live ? 'şimdi' : left <= 90 && left >= 0 ? `${left} dk sonra` : '';
    return `<div class="cl ev ${live ? 'now' : ''}">
      <span class="cl-time">${e.allDay ? '—' : `${hm(e.start)}–${hm(e.end)}`}</span>
      <span class="cl-name"><i class="evdot"></i>${esc(e.title)}</span>
      <span class="cl-room">${esc(e.location || '')}</span>
      <span class="cl-meta">${e.link ? `<button class="chip join" data-act="cal:join" data-id="${esc(e.link)}" title="Toplantıya katıl">${CAM}Katıl</button>` : meta}</span>
    </div>`;
  }

  function todayClasses() {
    return (sched().classes || []).filter((c) => Number(c.day) === dow()).sort((a, b) => toMin(a.start) - toMin(b.start));
  }

  function current() {
    const n = nowMin();
    const list = todayClasses();
    const now = list.find((c) => toMin(c.start) <= n && n < toMin(c.end || c.start) + (c.end ? 0 : 50));
    const next = list.find((c) => toMin(c.start) > n);
    return { now, next, list };
  }

  function daysUntil(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return Math.round((d - t) / 86400000);
  }

  function nextDayWithClasses() {
    const all = sched().classes || [];
    for (let k = 1; k <= 7; k++) {
      const day = ((dow() - 1 + k) % 7) + 1;
      const list = all.filter((c) => Number(c.day) === day).sort((a, b) => toMin(a.start) - toMin(b.start));
      if (list.length) return { day, list, k };
    }
    return null;
  }

  function classesHtml() {
    const all = sched().classes || [];
    const evs = calToday();
    if (!all.length && !evs.length) {
      return `<div class="d-empty"><p>Ders programın henüz boş. Derslerini ve sınavlarını bir kere ekle; Ada sıradaki dersi ve sınava kalan günü göstersin. Google Takvim'ini de bağlayabilirsin.</p>
        <button class="btn-allow" data-act="settings" data-id="ders">Ders programını düzenle</button>
        ${cal().configured ? '' : '<button class="btn-text" data-act="settings" data-id="takvim">Takvimi bağla</button>'}</div>`;
    }
    const { now, next, list } = current();
    const n = nowMin();
    if (!list.length && !evs.length) {
      const nd = nextDayWithClasses();
      const tomorrow = calToday(1);
      return `<h3>Bugün ders yok</h3>${nd ? `<p class="hint-l">Sıradaki: ${nd.k === 1 ? 'yarın' : DAYS[nd.day]} · ${esc(nd.list[0].start)} ${esc(nd.list[0].name)}</p>` : ''}
        ${tomorrow.length ? `<h3 class="h-sub">Yarın takvimde</h3><div class="cls">${tomorrow.slice(0, 3).map(eventRow).join('')}</div>` : ''}`;
    }
    const rowsOf = (c) => {
      const isNow = c === now;
      const isNext = c === next;
      const start = toMin(c.start);
      const meta = isNow ? 'şimdi' : isNext ? `${start - n} dk sonra` : start < n ? 'bitti' : '';
      return `<div class="cl ${isNow ? 'now' : ''} ${isNext ? 'next' : ''} ${start < n && !isNow ? 'past' : ''}">
        <span class="cl-time">${esc(c.start)}${c.end ? `–${esc(c.end)}` : ''}</span>
        <span class="cl-name">${esc(c.name)}</span>
        <span class="cl-room">${esc(c.room || '')}</span>
        <span class="cl-meta">${meta}</span>
      </div>`;
    };
    // classes and calendar events in one timeline
    const items = [
      ...list.map((c) => ({ t: toMin(c.start), html: rowsOf(c) })),
      ...evs.map((e) => ({ t: e.allDay ? -1 : new Date(e.start).getHours() * 60 + new Date(e.start).getMinutes(), html: eventRow(e) })),
    ].sort((a, b) => a.t - b.t);
    return `<h3>Bugün · ${DAYS[dow()]}</h3><div class="cls">${items.map((x) => x.html).join('')}</div>`;
  }

  function examsHtml() {
    const exams = (sched().exams || [])
      .map((x) => ({ ...x, d: daysUntil(x.date) }))
      .filter((x) => x.d >= 0)
      .sort((a, b) => a.d - b.d)
      .slice(0, 6);
    if (!exams.length) return `<h3>Sınavlar</h3><p class="hint-l">Yaklaşan sınav yok.</p>`;
    return `<h3>Sınavlar</h3><div class="exams">${exams.map((x) => {
      const tone = x.d <= 3 ? 'bad' : x.d <= 7 ? 'warn' : '';
      const when = x.d === 0 ? 'bugün' : x.d === 1 ? 'yarın' : `${x.d} gün`;
      const dt = new Date(x.date + 'T12:00:00');
      return `<div class="ex ${tone}"><b>${when}</b><span class="ex-name">${esc(x.name)}</span><span class="ex-date">${dt.getDate()}.${dt.getMonth() + 1}${x.time ? ' · ' + esc(x.time) : ''}</span></div>`;
    }).join('')}</div>`;
  }

  Ada.tab({
    id: 'ders',
    label: 'Ders',
    icon: I.book,
    pillRank: 0,
    badge() {
      const { now, next } = current();
      const soon = next && toMin(next.start) - nowMin() <= 15;
      const ev = nextEvent();
      const evSoon = ev && ev.start - Date.now() <= 15 * 60000;
      return now || soon || evSoon ? '<span class="dotb class"></span>' : '';
    },
    pill() {
      // a calendar event coming up
      const ev = nextEvent();
      const elead = Number(S.config.calendarReminder);
      if (ev && elead) {
        const left = Math.round((ev.start - Date.now()) / 60000);
        if (left <= elead && left >= -1) {
          return {
            status: 'class',
            html: `<div class="pill">
              <span class="glyph" data-s="class"></span>
              <span class="proj">${esc(ev.title)}</span>
              <span class="act">${left <= 0 ? 'başlıyor' : `${left} dk sonra`}${ev.location ? ' · ' + esc(ev.location) : ''}</span>
            </div>`,
          };
        }
      }
      const lead = Number(S.config.classReminder);
      if (!lead) return null;
      const { next } = current();
      if (!next) return null;
      const left = toMin(next.start) - nowMin();
      if (left > lead || left < 0) return null;
      return {
        status: 'class',
        html: `<div class="pill">
          <span class="glyph" data-s="class"></span>
          <span class="proj">${esc(next.name)}</span>
          <span class="act">${left === 0 ? 'başlıyor' : `${left} dk sonra`}${next.room ? ' · ' + esc(next.room) : ''}</span>
        </div>`,
      };
    },
    body() {
      return `<div class="d-grid">
        <div class="d-left" data-region="d-left">${classesHtml()}</div>
        <div class="d-right" data-region="d-right">${examsHtml()}
          <button class="btn-text edit" data-act="settings" data-id="ders">Düzenle</button>
        </div>
      </div>`;
    },
    onAct(a, id) {
      if (a !== 'cal:join') return false;
      ada.call('calendar', 'open', id).then((r) => { if (!(r.ok && r.result)) Ada.toast({ kind: 'error', text: 'Bağlantı açılamadı' }); });
      return true;
    },
    onEvent(ev) {
      if (ev.type === 'calendar') {
        Ada.chime('ask');
        Ada.fx.flash('class');
        const left = Math.round((ev.start - Date.now()) / 60000);
        Ada.showCard({
          key: 'cal' + ev.id, status: 'class', until: Date.now() + 12000,
          html: `<div class="card-head"><span class="glyph" data-s="class"></span><span class="proj">${esc(ev.title)}</span><span class="what">${left > 0 ? `${left} dk sonra` : 'başlıyor'}</span></div>
            <p class="msg">${hm(ev.start)}${ev.location ? ' · ' + esc(ev.location) : ''}</p>
            ${ev.link ? `<div class="actions"><button class="btn-allow sm" data-act="cal:join" data-id="${esc(ev.link)}">Toplantıya katıl</button><span class="spacer"></span><button class="btn-text sm" data-act="closeCard">Kapat</button></div>` : ''}`,
        });
        return;
      }
      if (ev.type !== 'class') return;
      Ada.chime('ask');
      Ada.showCard({
        key: 'class' + ev.name,
        status: 'class',
        until: Date.now() + 8000,
        html: `<div class="card-head"><span class="glyph" data-s="class"></span><span class="proj">${esc(ev.name)}</span><span class="what">${esc(ev.summary.split(' · ').pop())}</span></div>
               <p class="msg">${esc(ev.start)}${ev.room ? ' · ' + esc(ev.room) : ''}</p>`,
      });
    },
  });
})();
