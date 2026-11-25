'use strict';
/* global Ada, ada, AdaTime */
// Focus tab: pomodoro, a stopwatch or timers & alarms; today's numbers and a 7-day bar chart.
(() => {
  const { S, I, esc, mmss } = Ada;
  const R = 52;
  const C = 2 * Math.PI * R;
  const PHASE = { idle: 'Hazır', focus: 'Odak', short: 'Kısa mola', long: 'Uzun mola' };
  const PRESETS = [[25, 5, 15], [50, 10, 20], [15, 3, 10]];

  // which of the two the tab shows; remembered per computer
  let mode = 'pomo';
  try { const m0 = localStorage.getItem('ada.focusMode'); mode = m0 === 'watch' || m0 === 'timer' ? m0 : 'pomo'; } catch { /* storage blocked */ }
  const setMode = (m) => { mode = m; try { localStorage.setItem('ada.focusMode', m); } catch { /* ignore */ } };

  const pomo = () => S.mods.pomodoro || null;
  const sw = () => S.mods.stopwatch || null;
  const pomoActive = () => { const p = pomo(); return !!(p && p.phase !== 'idle'); };
  const watchActive = () => { const w = sw(); return !!(w && (w.running || w.elapsed > 0)); };
  const tlist = () => ((S.mods.timers && S.mods.timers.list) || []);
  const timersActive = () => tlist().length > 0;
  const tLeft = (t) => (t.paused != null ? t.paused : t.end - Date.now());
  // the one to show: running before paused, then the soonest
  const nextTimer = () => tlist().filter((t) => !t.ringing).sort((a, b) => ((a.paused != null) - (b.paused != null)) || (tLeft(a) - tLeft(b)))[0] || null;
  const tName = (t) => t.label || (t.kind === 'alarm' ? `Alarm ${new Date(t.end).toTimeString().slice(0, 5)}` : `${AdaTime.human(t.dur)} sayaç`);
  const ALARM = '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2M5 4.5L2.8 6.7M19 4.5l2.2 2.2"/></svg>';

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
    const isTimer = kind === 'timer';
    const p = pomo();
    const w = sw();
    const n = isTimer ? nextTimer() : null;
    const tone = isTimer ? (n ? 'timer' : 'idle') : isWatch ? 'watch' : !p || p.phase === 'idle' ? 'idle' : p.phase === 'focus' ? 'focus' : 'break';
    const paused = isTimer ? n && n.paused != null : isWatch ? w && !w.running && w.elapsed > 0 : p && p.paused;
    return `<svg data-morph="ring" class="ring ${tone} ${paused ? 'paused' : ''}" viewBox="0 0 120 120" width="${size}" height="${size}" aria-hidden="true">
      <circle class="track" cx="60" cy="60" r="${R}" stroke-width="${stroke}"/>
      <circle class="prog" cx="60" cy="60" r="${R}" stroke-width="${stroke}" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${C.toFixed(2)}" data-live="${isTimer ? 'tmring' : isWatch ? 'swring' : 'ring'}"/>
    </svg>`;
  }

  function modeSwitch() {
    const b = (id, label, dot) => `<button class="seg ${mode === id ? 'on' : ''}" data-act="f:mode" data-id="${id}">${label}${dot ? '<i class="seg-dot"></i>' : ''}</button>`;
    return `<div class="segs mini mode-sw">${b('pomo', 'Pomodoro', pomoActive() && mode !== 'pomo')}${b('watch', 'Kronometre', watchActive() && mode !== 'watch')}${b('timer', 'Sayaç', timersActive() && mode !== 'timer')}</div>`;
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

  // ------------------------------------------------------------ timers & alarms
  function timerHtml() {
    const t = nextTimer();
    const quick = [1, 5, 10, 15, 25, 45, 60];
    return `
      <div class="pomo">
        <div class="ring-wrap">
          ${ringHtml(132, 7, 'timer')}
          <div class="ring-text">
            <span class="r-time" data-live="tmtime" data-morph="ptime" data-morph-text>${t ? AdaTime.clock(tLeft(t)) : '0:00'}</span>
            <span class="r-phase">${t ? esc(tName(t)) : 'Sayaç yok'}</span>
          </div>
        </div>
        <div class="pomo-side">
          ${modeSwitch()}
          <div class="tm-quick">${quick.map((m) => `<button class="chip" data-act="tm:quick" data-id="${m}">${m < 60 ? m + ' dk' : '1 sa'}</button>`).join('')}</div>
          <input type="text" data-tmin="1" placeholder="15 dk çay · 7:30 alarm" spellcheck="false" autocomplete="off" aria-label="Sayaç ya da alarm">
          <p class="sw-hint" data-live="tmhint">Süre ya da saat yaz, Enter'a bas. Ctrl+Alt+Boşluk ile her yerden de kurabilirsin.</p>
        </div>
      </div>`;
  }

  function timerListHtml() {
    const list = tlist();
    if (!list.length) {
      return `<div class="today"><h3>Sayaçlar ve alarmlar</h3><p class="hint-l">Kurduğun sayaçlar ve alarmlar burada listelenir. Ada kapalıyken kurulu alarmlar, açılınca çalar.</p></div>`;
    }
    return `<div class="today"><h3>Sayaçlar ve alarmlar</h3><div class="tms">${list.map((t) => `
      <div class="tm ${t.ringing ? 'ringing' : ''} ${t.paused != null ? 'paused' : ''}">
        <span class="tm-ic">${t.kind === 'alarm' ? ALARM : I.timer}</span>
        <span class="tm-name">${esc(tName(t))}<small>${t.kind === 'alarm' ? new Date(t.end).toLocaleString('tr-TR', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : AdaTime.human(t.dur)}</small></span>
        <span class="tm-left" data-live="tm" data-id="${esc(t.id)}">${t.ringing ? 'çalıyor' : AdaTime.clock(tLeft(t))}</span>
        <span class="tm-acts">
          ${t.ringing ? `<button class="chip" data-act="tm:snooze" data-id="${esc(t.id)}">+5 dk</button>` : t.kind === 'timer' ? `<button class="ic xs" data-act="tm:pause" data-id="${esc(t.id)}" title="${t.paused != null ? 'Devam' : 'Duraklat'}">${t.paused != null ? I.play : I.pause}</button><button class="ic xs" data-act="tm:plus" data-id="${esc(t.id)}" title="+1 dk">+1</button>` : ''}
          <button class="ic xs" data-act="tm:remove" data-id="${esc(t.id)}" title="${t.ringing ? 'Durdur' : 'Sil'}">${I.x}</button>
        </span>
        ${t.kind === 'timer' && !t.ringing ? `<i class="tm-bar"><b data-live="tmbar" data-id="${esc(t.id)}"></b></i>` : ''}
      </div>`).join('')}</div></div>`;
  }

  async function addTimer(text) {
    const r = AdaTime.parse(text);
    if (!r) { Ada.toast({ kind: 'error', text: 'Anlamadım · örnek: 15 dk, 1 sa 30 dk, 7:30' }); return false; }
    const res = await ada.call('timers', 'add', r);
    if (!res.ok) { Ada.toast({ kind: 'error', text: res.error }); return false; }
    Ada.toast({ kind: 'info', text: r.kind === 'alarm' ? `Alarm kuruldu · ${new Date(r.at).toTimeString().slice(0, 5)}` : `${AdaTime.human(r.ms)} sayaç başladı` });
    return true;
  }
  Ada.addTimer = addTimer;

  Ada.island.addEventListener('keydown', (e) => {
    if (!e.target.matches('[data-tmin]') || e.key !== 'Enter') return;
    e.preventDefault();
    const el = e.target;
    addTimer(el.value).then((ok) => { if (ok) el.value = ''; });
  });

  // ringing: a card with Stop / Snooze; the sound repeats until answered (at most a minute)
  let ringLoop = null;
  function ring(ev) {
    clearInterval(ringLoop);
    let n = 0;
    Ada.chime('alarm');
    ringLoop = setInterval(() => {
      const still = tlist().some((t) => t.id === ev.id && t.ringing);
      if (!still || ++n > 20) { clearInterval(ringLoop); return; }
      Ada.chime('alarm');
    }, 3000);
    const title = ev.label || (ev.kind === 'alarm' ? 'Alarm' : 'Süre doldu');
    Ada.showCard({
      key: 'ring' + ev.id, status: 'waiting', sticky: true,
      html: `<div class="card-head"><span class="tm-ic ring-ic">${ev.kind === 'alarm' ? ALARM : I.timer}</span><span class="proj">${esc(title)}</span>
          <span class="what">${ev.kind === 'alarm' ? new Date(ev.end).toTimeString().slice(0, 5) : `${AdaTime.human(ev.dur)} doldu`}${ev.late ? ' · Ada kapalıyken' : ''}</span></div>
        <div class="actions"><button class="btn-allow" data-act="tm:stop" data-id="${esc(ev.id)}">Durdur</button>
          <button class="btn-text" data-act="tm:snooze" data-id="${esc(ev.id)}">5 dk ertele</button></div>`,
    });
    Ada.fx.flash('ask');
    Ada.fx.bump();
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
    const list = tlist();
    if (list.length) {
      const byId = Object.fromEntries(list.map((t) => [t.id, t]));
      root.querySelectorAll('[data-live="tm"]').forEach((el) => { const t = byId[el.dataset.id]; if (t && !t.ringing) el.textContent = AdaTime.clock(tLeft(t)); });
      root.querySelectorAll('[data-live="tmbar"]').forEach((el) => { const t = byId[el.dataset.id]; if (t) el.style.width = `${Math.max(0, Math.min(100, 100 * (1 - tLeft(t) / (t.dur || 1))))}%`; });
      const n = nextTimer();
      if (n) {
        root.querySelectorAll('[data-live="tmtime"], [data-live="tmpill"]').forEach((el) => { el.textContent = AdaTime.clock(tLeft(n)); });
        root.querySelectorAll('[data-live="tmring"]').forEach((el) => setRing(el, Math.min(1, 1 - tLeft(n) / (n.dur || 1)), force));
      }
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
      if (w && w.running) return '<span class="dotb watch"></span>';
      return nextTimer() ? '<span class="dotb timer"></span>' : '';
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
      else if (timersActive() && !pomoActive() && !(sw() && sw().running)) setMode('timer');
    },
    pill() {
      const p = pomo();
      const t = S.music && S.music.player && S.music.player.isPlaying ? S.music.player.track : null;
      const song = t ? `<span class="eq on" data-viz aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="act tname">${esc(t.name)}</span>` : '';
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
      const n = nextTimer();
      if (n && n.paused == null) {
        return {
          status: 'break',
          html: `<div class="pill pomo-pill">
            ${ringHtml(22, 14, 'timer')}
            <span class="proj">${esc(n.label || (n.kind === 'alarm' ? 'Alarm' : 'Sayaç'))}</span>
            <span class="act" data-live="tmpill" data-morph="ptime" data-morph-text>${AdaTime.clock(tLeft(n))}</span>
            ${song}
          </div>`,
        };
      }
      return null;
    },
    body() {
      return `<div class="f-grid">
        <div class="f-left" data-region="f-left">${mode === 'watch' ? watchHtml() : mode === 'timer' ? timerHtml() : pomoHtml()}</div>
        <div class="f-right" data-region="f-right">${mode === 'watch' ? lapsHtml() : mode === 'timer' ? timerListHtml() : statsHtml()}</div>
      </div>`;
    },
    tick,
    onAct(a, id) {
      if (a === 'f:mode') { setMode(id); Ada.render(); return true; }
      if (a.startsWith('w:')) { ada.call('stopwatch', a.slice(2)); return true; }
      if (a.startsWith('tm:')) {
        const fn = a.slice(3);
        if (fn === 'quick') addTimer(`${id} dk`);
        if (fn === 'remove' || fn === 'stop') { ada.call('timers', 'remove', id); if (fn === 'stop') { Ada.closeCard && Ada.closeCard(); } }
        if (fn === 'snooze') { ada.call('timers', 'snooze', { id, min: 5 }); Ada.closeCard && Ada.closeCard(); Ada.toast({ kind: 'info', text: '5 dk ertelendi' }); }
        if (fn === 'pause') ada.call('timers', 'pause', id);
        if (fn === 'plus') ada.call('timers', 'addTime', { id, ms: 60000 });
        return true;
      }
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
      if (ev.type === 'timer-ring') { ring(ev); return; }
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
