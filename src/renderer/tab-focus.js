'use strict';
/* global Ada, ada */
// Focus tab: pomodoro timer or a stopwatch, today's numbers and a 7-day bar chart.
(() => {
  const { S, I, esc, mmss } = Ada;
  const R = 52;
  const C = 2 * Math.PI * R;
  const PHASE = { idle: 'Hazır', focus: 'Odak', short: 'Kısa mola', long: 'Uzun mola' };
  const PRESETS = [[25, 5, 15], [50, 10, 20], [15, 3, 10]];

  // which of the two the tab shows; remembered per computer
  let mode = 'pomo';
  try { mode = localStorage.getItem('ada.focusMode') === 'watch' ? 'watch' : 'pomo'; } catch { /* storage blocked */ }
  const setMode = (m) => { mode = m; try { localStorage.setItem('ada.focusMode', m); } catch { /* ignore */ } };

  const pomo = () => S.mods.pomodoro || null;
  const sw = () => S.mods.stopwatch || null;
  const pomoActive = () => { const p = pomo(); return !!(p && p.phase !== 'idle'); };
  const watchActive = () => { const w = sw(); return !!(w && (w.running || w.elapsed > 0)); };

  function remaining() {
    const p = pomo();
    if (!p) return 0;
    if (p.phase === 'idle' || p.paused) return p.remaining;
    return Math.max(0, p.remaining - (Date.now() - p.at));
  }
  function elapsed() {
    const w = sw();
    if (!w) return 0;
    return w.running ? w.elapsed + (Date.now() - w.at) : w.elapsed;
  }
  // 0:07.3 under a minute, 12:34 under an hour, then 1:02:03
  function swText(ms, tenths) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    const base = `${m}:${String(sec).padStart(2, '0')}`;
    return tenths ? `${base}<small>.${Math.floor((ms % 1000) / 100)}</small>` : base;
  }

  function ringHtml(size, stroke, kind) {
    const isWatch = kind === 'watch';
    const p = pomo();
    const w = sw();
    const tone = isWatch ? 'watch' : !p || p.phase === 'idle' ? 'idle' : p.phase === 'focus' ? 'focus' : 'break';
    const paused = isWatch ? w && !w.running && w.elapsed > 0 : p && p.paused;
    return `<svg data-morph="ring" class="ring ${tone} ${paused ? 'paused' : ''}" viewBox="0 0 120 120" width="${size}" height="${size}" aria-hidden="true">
      <circle class="track" cx="60" cy="60" r="${R}" stroke-width="${stroke}"/>
      <circle class="prog" cx="60" cy="60" r="${R}" stroke-width="${stroke}" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${C.toFixed(2)}" data-live="${isWatch ? 'swring' : 'ring'}"/>
    </svg>`;
  }

  function modeSwitch() {
    const b = (id, label, dot) => `<button class="seg ${mode === id ? 'on' : ''}" data-act="f:mode" data-id="${id}">${label}${dot ? '<i class="seg-dot"></i>' : ''}</button>`;
    return `<div class="segs mini mode-sw">${b('pomo', 'Pomodoro', pomoActive() && mode !== 'pomo')}${b('watch', 'Kronometre', watchActive() && mode !== 'watch')}</div>`;
  }

  // ------------------------------------------------------------ pomodoro view
  function pomoHtml() {
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
            <span class="r-time" data-live="ptime" data-morph="ptime" data-morph-text></span>
            <span class="r-phase">${PHASE[p.phase]}${p.paused && p.phase !== 'idle' ? ' · duraklatıldı' : ''}</span>
          </div>
        </div>
        <div class="pomo-side">
          ${modeSwitch()}
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

  // ------------------------------------------------------------ stopwatch view
  function watchHtml() {
    const w = sw() || { running: false, elapsed: 0, laps: [] };
    const started = w.running || w.elapsed > 0;
    return `
      <div class="pomo">
        <div class="ring-wrap">
          ${ringHtml(132, 7, 'watch')}
          <div class="ring-text">
            <span class="r-time sw" data-live="swtime" data-morph="ptime" data-morph-text></span>
            <span class="r-phase">${w.running ? 'Kronometre' : started ? 'Duraklatıldı' : 'Sıfırdan sayar'}</span>
          </div>
        </div>
        <div class="pomo-side">
          ${modeSwitch()}
          <div class="pomo-ctrl">
            <button class="ic big" data-act="w:toggle" title="${w.running ? 'Duraklat' : started ? 'Devam et' : 'Başlat'} · Ctrl+Alt+K">${w.running ? I.pause : I.play}</button>
            <button class="chip lapbtn" data-act="w:lap" ${w.running ? '' : 'disabled'} title="Tur kaydet">Tur</button>
            <button class="ic" data-act="w:reset" title="Sıfırla" ${started ? '' : 'disabled'}>${I.stop}</button>
          </div>
          <p class="sw-hint">${started ? 'Geçen süre bugünkü odak süresine eklenir.' : 'Başlat\'a bas, süre 0\'dan saymaya başlasın.'}</p>
        </div>
      </div>`;
  }

  function lapsHtml() {
    const w = sw();
    const laps = (w && w.laps) || [];
    if (!laps.length) {
      return `<div class="today"><h3>Turlar</h3><p class="hint-l">Kronometre çalışırken <b>Tur</b>'a bas; her turun süresi burada listelenir.</p></div>`;
    }
    const best = Math.min(...laps.map((l) => l.split));
    const worst = Math.max(...laps.map((l) => l.split));
    return `<div class="today"><h3>Turlar</h3><div class="laps">${laps.map((l) => `
      <div class="lap ${laps.length > 1 && l.split === best ? 'best' : ''} ${laps.length > 1 && l.split === worst ? 'worst' : ''}">
        <span class="lap-n">${l.n}. tur</span><span class="lap-split">${swText(l.split, true)}</span><span class="lap-total">${swText(l.total)}</span>
      </div>`).join('')}</div></div>`;
  }

  // ------------------------------------------------------------ today
  function statsHtml() {
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

  // ------------------------------------------------------------ live updates
  function setRing(el, frac, force) {
    // a freshly drawn ring jumps to its position instead of animating from empty
    const fresh = force || !el.dataset.seen;
    if (fresh) el.style.transition = 'none';
    el.style.strokeDashoffset = (C * (1 - frac)).toFixed(2);
    if (fresh) { void el.getBoundingClientRect(); el.style.transition = ''; el.dataset.seen = '1'; }
  }

  function tick(root, force) {
    const p = pomo();
    if (p) {
      const rem = remaining();
      const frac = p.phase === 'idle' ? 0 : 1 - rem / (p.total || 1);
      root.querySelectorAll('[data-live="ring"]').forEach((el) => setRing(el, frac, force));
      root.querySelectorAll('[data-live="ptime"]').forEach((el) => { el.textContent = mmss(rem); });
    }
    const w = sw();
    if (w) {
      const ms = elapsed();
      // the ring goes round once a minute, like a stopwatch's second hand
      const frac = (ms % 60000) / 60000;
      root.querySelectorAll('[data-live="swring"]').forEach((el) => {
        // when the minute wraps, jump back to empty instead of sweeping backwards
        const wrapped = el.dataset.last && frac < Number(el.dataset.last);
        setRing(el, frac, force || wrapped);
        el.dataset.last = frac;
      });
      root.querySelectorAll('[data-live="swtime"]').forEach((el) => { el.innerHTML = swText(ms, true); });
      root.querySelectorAll('[data-live="swpill"]').forEach((el) => { el.textContent = swText(ms); });
    }
  }

  Ada.tab({
    id: 'focus',
    label: 'Odak',
    icon: I.timer,
    pillRank: 1,
    badge() {
      const p = pomo();
      if (p && p.phase !== 'idle') return `<span class="dotb ${p.phase === 'focus' ? 'focus' : 'break'}"></span>`;
      const w = sw();
      return w && w.running ? '<span class="dotb watch"></span>' : '';
    },
    status() {
      const p = pomo();
      if (p && p.phase === 'focus') return 'focus';
      if (p && p.phase !== 'idle') return 'break';
      return sw() && sw().running ? 'focus' : 'idle';
    },
    wantsFocus() { return pomoActive() || !!(sw() && sw().running); },
    onEnter() {
      // open on whichever is running
      if (pomoActive() && !(sw() && sw().running)) setMode('pomo');
      else if (sw() && sw().running && !pomoActive()) setMode('watch');
    },
    pill() {
      const p = pomo();
      const t = S.music && S.music.player && S.music.player.isPlaying ? S.music.player.track : null;
      const song = t ? `<span class="eq on" aria-hidden="true"><i></i><i></i><i></i></span><span class="act tname">${esc(t.name)}</span>` : '';
      if (p && p.phase !== 'idle') {
        return {
          status: p.phase === 'focus' ? 'focus' : 'break',
          html: `<div class="pill pomo-pill">
            ${ringHtml(22, 14)}
            <span class="proj">${PHASE[p.phase]}</span>
            <span class="act" data-live="ptime" data-morph="ptime" data-morph-text></span>
            ${p.paused ? '<span class="act">· duraklatıldı</span>' : ''}
            ${song}
          </div>`,
        };
      }
      const w = sw();
      if (w && w.running) {
        return {
          status: 'focus',
          html: `<div class="pill pomo-pill">
            ${ringHtml(22, 14, 'watch')}
            <span class="proj">Kronometre</span>
            <span class="act" data-live="swpill" data-morph="ptime" data-morph-text></span>
            ${song}
          </div>`,
        };
      }
      return null;
    },
    body() {
      return `<div class="f-grid">
        <div class="f-left" data-region="f-left">${mode === 'watch' ? watchHtml() : pomoHtml()}</div>
        <div class="f-right" data-region="f-right">${mode === 'watch' ? lapsHtml() : statsHtml()}</div>
      </div>`;
    },
    tick,
    onAct(a, id) {
      if (a === 'f:mode') { setMode(id); Ada.render(); return true; }
      if (a.startsWith('w:')) { ada.call('stopwatch', a.slice(2)); return true; }
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
