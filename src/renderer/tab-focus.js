'use strict';
/* global Ada, ada */
// Focus tab: pomodoro timer with a ring, presets, today's numbers and a 7-day bar chart.
(() => {
  const { S, I, esc, mmss } = Ada;
  const R = 52;
  const C = 2 * Math.PI * R;
  const PHASE = { idle: 'Hazır', focus: 'Odak', short: 'Kısa mola', long: 'Uzun mola' };
  const PRESETS = [[25, 5, 15], [50, 10, 20], [15, 3, 10]];

  const pomo = () => S.mods.pomodoro || null;
  function remaining() {
    const p = pomo();
    if (!p) return 0;
    if (p.phase === 'idle' || p.paused) return p.remaining;
    return Math.max(0, p.remaining - (Date.now() - p.at));
  }

  function ringHtml(size, stroke) {
    const p = pomo();

    const tone = !p || p.phase === 'idle' ? 'idle' : p.phase === 'focus' ? 'focus' : 'break';
    return `<svg class="ring ${tone} ${p && p.paused ? 'paused' : ''}" viewBox="0 0 120 120" width="${size}" height="${size}" aria-hidden="true">
      <circle class="track" cx="60" cy="60" r="${R}" stroke-width="${stroke}"/>
      <circle class="prog" cx="60" cy="60" r="${R}" stroke-width="${stroke}" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${C.toFixed(2)}" data-live="ring"/>
    </svg>`;
  }

  function leftHtml() {
    const p = pomo();
    if (!p) return '';
    const st = p.settings;
    const dots = Array.from({ length: st.longEvery }, (_, i) => `<i class="${i < p.cycle ? 'on' : ''}"></i>`).join('');
    const running = p.phase !== 'idle' && !p.paused;
    const presetOn = (pr) => st.focusMin === pr[0] && st.shortMin === pr[1];
    return `
      <div class="pomo">
        <div class="ring-wrap">
          ${ringHtml(132, 7)}
          <div class="ring-text">
            <span class="r-time" data-live="ptime"></span>
            <span class="r-phase">${PHASE[p.phase]}${p.paused && p.phase !== 'idle' ? ' · duraklatıldı' : ''}</span>
          </div>
        </div>
        <div class="pomo-side">
          <div class="dots" title="Uzun molaya kadar">${dots}</div>
          <div class="pomo-ctrl">
            <button class="ic big" data-act="p:toggle" title="${running ? 'Duraklat' : 'Başlat'} · Ctrl+Alt+P">${running ? I.pause : I.play}</button>
            <button class="ic" data-act="p:skip" title="Sonraki aşamaya geç" ${p.phase === 'idle' ? 'disabled' : ''}>${I.skip}</button>
            <button class="ic" data-act="p:stop" title="Bitir" ${p.phase === 'idle' ? 'disabled' : ''}>${I.stop}</button>
          </div>
          <div class="presets">
            ${PRESETS.map((pr) => `<button class="chip ${presetOn(pr) ? 'on' : ''}" data-act="p:preset" data-id="${pr.join(',')}">${pr[0]}/${pr[1]}</button>`).join('')}
          </div>
          <div class="pomo-flags">
            <button class="flag ${st.musicOnFocus ? 'on' : ''}" data-act="p:flag" data-id="musicOnFocus">Odakta müzik</button>
            <button class="flag ${st.pauseOnBreak ? 'on' : ''}" data-act="p:flag" data-id="pauseOnBreak">Molada durdur</button>
            <button class="flag ${st.quietFocus ? 'on' : ''}" data-act="p:flag" data-id="quietFocus">Bildirimleri sustur</button>
          </div>
        </div>
      </div>`;
  }

  function rightHtml() {
    const s = S.mods.stats;
    if (!s) return '';
    const d = s.today;
    const max = Math.max(25, ...s.week.map((w) => w.focusMin));
    const dayName = (k) => ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'][new Date(k + 'T12:00:00').getDay()];
    const h = Math.floor(d.focusMin / 60);
    const focus = h ? `${h} sa ${d.focusMin % 60} dk` : `${d.focusMin} dk`;
    return `
      <div class="today">
        <h3>Bugün</h3>
        <div class="nums">
          <div><b>${d.pomodoros}</b><span>pomodoro</span></div>
          <div><b>${focus}</b><span>odak</span></div>
          <div><b>${d.claudeDone}</b><span>Claude işi</span></div>
          <div><b>${d.songs}</b><span>şarkı</span></div>
        </div>
        <div class="week" aria-label="Son 7 gün odak süresi">
          ${s.week.map((w, i) => `<div class="wk ${i === 6 ? 'now' : ''}" title="${w.focusMin} dk"><span class="wk-bar"><b data-h="${Math.round((w.focusMin / max) * 100)}"></b></span><em>${dayName(w.day)}</em></div>`).join('')}
        </div>
      </div>`;
  }

  function tick(root) {
    const p = pomo();
    if (!p) return;
    const rem = remaining();
    const total = p.total || 1;
    const frac = p.phase === 'idle' ? 0 : 1 - rem / total;
    root.querySelectorAll('[data-live="ring"]').forEach((el) => {
      // a freshly drawn ring jumps to its position instead of animating from empty
      const fresh = force || !el.dataset.seen;
      if (fresh) el.style.transition = 'none';
      el.style.strokeDashoffset = (C * (1 - frac)).toFixed(2);
      if (fresh) { void el.getBoundingClientRect(); el.style.transition = ''; el.dataset.seen = '1'; }
    });
    root.querySelectorAll('[data-live="ptime"]').forEach((el) => { el.textContent = mmss(rem); });
  }

  Ada.tab({
    id: 'focus',
    label: 'Odak',
    icon: I.timer,
    pillRank: 1,
    badge() {
      const p = pomo();
      return p && p.phase !== 'idle' ? `<span class="dotb ${p.phase === 'focus' ? 'focus' : 'break'}"></span>` : '';
    },
    status() { const p = pomo(); return p && p.phase === 'focus' ? 'focus' : p && p.phase !== 'idle' ? 'break' : 'idle'; },
    wantsFocus() { const p = pomo(); return p && p.phase !== 'idle'; },
    pill() {
      const p = pomo();
      if (!p || p.phase === 'idle') return null;
      const t = S.music && S.music.player && S.music.player.isPlaying ? S.music.player.track : null;
      return {
        status: p.phase === 'focus' ? 'focus' : 'break',
        html: `<div class="pill pomo-pill">
          ${ringHtml(22, 14)}
          <span class="proj">${PHASE[p.phase]}</span>
          <span class="act" data-live="ptime"></span>
          ${p.paused ? '<span class="act">· duraklatıldı</span>' : ''}
          ${t ? `<span class="eq on" aria-hidden="true"><i></i><i></i><i></i></span><span class="act tname">${esc(t.name)}</span>` : ''}
        </div>`,
      };
    },
    body() {
      return `<div class="f-grid">
        <div class="f-left" data-region="f-left">${leftHtml()}</div>
        <div class="f-right" data-region="f-right">${rightHtml()}</div>
      </div>`;
    },
    tick,
    onAct(a, id) {
      if (!a.startsWith('p:')) return false;
      const fn = a.slice(2);
      if (fn === 'preset') {
        const [f, sh, l] = id.split(',').map(Number);
        ada.call('pomodoro', 'settings', { focusMin: f, shortMin: sh, longMin: l });
      } else if (fn === 'flag') {
        const p = pomo();
        ada.call('pomodoro', 'settings', { [id]: !(p && p.settings[id]) });
      } else {
        ada.call('pomodoro', fn);
      }
      return true;
    },
    onEvent(ev) {
      if (ev.type !== 'pomodoro') return;
      Ada.chime('pomo');
      const title = ev.phase === 'focus' ? 'Odak bitti, eline sağlık' : 'Mola bitti';
      Ada.showCard({
        key: 'pomo' + Date.now(),
        status: ev.next === 'focus' ? 'focus' : 'break',
        until: Date.now() + 6000,
        html: `<div class="card-head"><span class="glyph" data-s="${ev.next === 'focus' ? 'working' : 'done'}"></span><span class="proj">Pomodoro</span><span class="what">${esc(title)}</span></div>
               <p class="msg">${esc(ev.summary)}</p>`,
      });
    },
  });
})();
