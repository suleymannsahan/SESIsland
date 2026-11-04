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
    if (!all.length) {
      return `<div class="d-empty"><p>Ders programın henüz boş. Derslerini ve sınavlarını bir kere ekle; Ada sıradaki dersi ve sınava kalan günü göstersin.</p>
        <button class="btn-allow" data-act="settings" data-id="ders">Ders programını düzenle</button></div>`;
    }
    const { now, next, list } = current();
    const n = nowMin();
    if (!list.length) {
      const nd = nextDayWithClasses();
      return `<h3>Bugün ders yok</h3>${nd ? `<p class="hint-l">Sıradaki: ${nd.k === 1 ? 'yarın' : DAYS[nd.day]} · ${esc(nd.list[0].start)} ${esc(nd.list[0].name)}</p>` : ''}`;
    }
    const rows = list.map((c) => {
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
    }).join('');
    return `<h3>Bugün · ${DAYS[dow()]}</h3><div class="cls">${rows}</div>`;
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
      return now || soon ? '<span class="dotb class"></span>' : '';
    },
    pill() {
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
    onEvent(ev) {
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
