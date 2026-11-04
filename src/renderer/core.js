'use strict';
/* global ada */
// Ada island core: state, collapsed views and cards, the panel frame, rendering and events.
// Tabs live in tab-*.js and register themselves with Ada.tab({...}).
(() => {
  const island = document.getElementById('island');
  const inner = document.getElementById('inner');
  const toastEl = document.getElementById('toast');
  const hudEl = document.getElementById('hud');

  // ------------------------------------------------------------ shared state
  const S = {
    claude: { sessions: [], permissions: [] },
    music: null,
    config: { sound: true },
    mods: {},
  };
  const ui = {
    hovered: false,
    tab: null,
    lastActivity: Date.now(),
    holdOpen: false,            // an input inside the panel has focus
    drag: false,                // a slider or progress bar is being dragged
  };
  const tabs = [];
  let card = null;              // transient info card { kind, key, html, until, sticky }
  let doneCard = null;
  let leaveTimer = null;
  let hoverTimer = null;
  let last = { mode: '', key: '', skeleton: '', regions: {} };
  let pressed = false;          // a button is held down: don't re-draw under it

  // ------------------------------------------------------------ helpers
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel) => inner.querySelector(sel);
  const $$ = (sel) => [...inner.querySelectorAll(sel)];
  const mmss = (ms) => {
    const s = Math.max(0, Math.round(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const ago = (ts) => {
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 45) return 'şimdi';
    const m = Math.round(s / 60);
    if (m < 60) return `${m} dk`;
    return `${Math.round(m / 60)} sa`;
  };

  const I = {
    play: '<svg viewBox="0 0 24 24"><path class="f" d="M8 5.5v13l10.5-6.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path class="f" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path class="f" d="M6 5.5l9 6.5-9 6.5zM16 5.5h2.2v13H16z"/></svg>',
    prev: '<svg viewBox="0 0 24 24"><path class="f" d="M18 5.5l-9 6.5 9 6.5zM5.8 5.5H8v13H5.8z"/></svg>',
    stop: '<svg viewBox="0 0 24 24"><path class="f" d="M7 7h10v10H7z"/></svg>',
    skip: '<svg viewBox="0 0 24 24"><path d="M5 6l7 6-7 6M13 6l7 6-7 6"/></svg>',
    shuffle: '<svg viewBox="0 0 24 24"><path d="M3 7h3.2c4.3 0 5.6 10 10 10H21M18 14l3 3-3 3M3 17h3.2c1.6 0 2.7-1.3 3.6-3M13.6 10c.9-1.7 2-3 3.6-3H21M18 4l3 3-3 3"/></svg>',
    repeat: '<svg viewBox="0 0 24 24"><path d="M4 11.5V10a3.5 3.5 0 0 1 3.5-3.5H20M17 3.5l3 3-3 3M20 12.5V14a3.5 3.5 0 0 1-3.5 3.5H4M7 20.5l-3-3 3-3"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/></svg>',
    liked: '<svg viewBox="0 0 24 24"><path class="f" d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/></svg>',
    volOff: '<svg viewBox="0 0 24 24"><path class="f" d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4z"/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    vol: '<svg viewBox="0 0 24 24"><path class="f" d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z"/><path d="M19.4 13.5l1.6 1.2-1.8 3.1-1.9-.7a7 7 0 0 1-1.7 1l-.3 2h-3.6l-.3-2a7 7 0 0 1-1.7-1l-1.9.7-1.8-3.1 1.6-1.2a7 7 0 0 1 0-2l-1.6-1.2 1.8-3.1 1.9.7a7 7 0 0 1 1.7-1l.3-2h3.6l.3 2a7 7 0 0 1 1.7 1l1.9-.7 1.8 3.1-1.6 1.2a7 7 0 0 1 0 2z"/></svg>',
    terminal: '<svg viewBox="0 0 24 24"><path d="M4 5.5h16v13H4zM7.5 10l2.5 2-2.5 2M12 14.5h4"/></svg>',
    note: '<svg viewBox="0 0 24 24"><path d="M9 17.5V6l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/></svg>',
    timer: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2M9.5 3h5"/></svg>',
    book: '<svg viewBox="0 0 24 24"><path d="M4.5 5.5A2 2 0 0 1 6.5 3.5H19v15H6.5a2 2 0 0 0-2 2zM4.5 20.5v-15M8.5 7.5h6.5"/></svg>',
    tools: '<svg viewBox="0 0 24 24"><path d="M5 3.5h14v17H5zM8 7h8M8 11h2M12 11h2M16 11h.01M8 14.5h2M12 14.5h2M16 14.5v3M8 17.5h2M12 17.5h2"/></svg>',
    chip: '<svg viewBox="0 0 24 24"><path d="M7 7h10v10H7zM9.5 3v4M14.5 3v4M9.5 17v4M14.5 17v4M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4"/></svg>',
    gauge: '<svg viewBox="0 0 24 24"><path d="M4.5 16.5a8 8 0 1 1 15 0M12 13l3.5-4"/><circle cx="12" cy="13.5" r="1.3"/></svg>',
    computer: '<svg viewBox="0 0 24 24"><path d="M3.5 5h17v11h-17zM8.5 20h7M12 16v4"/></svg>',
    phone: '<svg viewBox="0 0 24 24"><path d="M8 2.5h8a1 1 0 0 1 1 1v17a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-17a1 1 0 0 1 1-1zM11 18.5h2"/></svg>',
    speaker: '<svg viewBox="0 0 24 24"><path d="M6 2.5h12v19H6z"/><circle cx="12" cy="14.5" r="3.2"/><path d="M12 7h.01"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><path d="M8.5 8.5h11v11h-11zM15.5 8.5v-4h-11v11h4"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
    jump: '<svg viewBox="0 0 24 24"><path d="M13.5 5.5h5v5M18.5 5.5l-7.5 7.5M10 6.5H5.5v12h12V14"/></svg>',
  };

  // ------------------------------------------------------------ sessions
  const live = (s) => ['working', 'waiting', 'question', 'done'].includes(s.status);
  const rank = { waiting: 0, question: 1, working: 2, done: 3, idle: 4 };
  const primarySession = () => [...S.claude.sessions].sort((a, b) => (rank[a.status] - rank[b.status]) || (b.updatedAt - a.updatedAt))[0];

  // ------------------------------------------------------------ public API for tabs
  const Ada = {
    S, ui, I, esc, $, $$, mmss, ago, live, primarySession,
    island, inner,
    tab(def) { tabs.push(def); },
    render: () => render(),
    toast: (t) => toast(t),
    chime: (k) => chime(k),
    showCard: (c) => { card = c; render(); },
    holdOpen: (on) => { ui.holdOpen = !!on; },
  };
  window.Ada = Ada;

  // ------------------------------------------------------------ cards
  function wellHtml(tool, detail) {
    if (!detail) return '';
    if (tool === 'Edit') {
      const lines = detail.split('\n').map((l, i) => {
        if (i === 0) return `<span>${esc(l)}</span>`;
        if (l.startsWith('+ ')) return `<span class="add">${esc(l)}</span>`;
        if (l.startsWith('- ')) return `<span class="del">${esc(l)}</span>`;
        return esc(l);
      });
      return `<div class="well">${lines.join('\n')}</div>`;
    }
    return `<div class="well">${esc(detail)}</div>`;
  }

  function viewPermission(p) {
    const more = S.claude.permissions.length - 1;
    const desktop = p.source === 'desktop';
    return {
      mode: 'card', status: 'waiting', key: 'perm:' + p.id,
      html: `<div class="card">
        <div class="card-head">
          <span class="glyph" data-s="waiting" data-morph="glyph"></span>
          <span class="proj" data-morph="proj" data-morph-text>${esc(p.project)}</span>
          <span class="what">izin istiyor</span>
          ${more > 0 ? `<span class="queue">${more} istek daha</span>` : ''}
        </div>
        <h2>${esc(p.title)}</h2>
        ${wellHtml(p.tool, p.detail)}
        <div class="actions">
          <button class="btn-allow" data-act="allow" data-id="${esc(p.id)}">İzin ver <kbd>Ctrl+Alt+Y</kbd></button>
          <button class="btn-deny" data-act="deny" data-id="${esc(p.id)}">Reddet</button>
          <span class="spacer"></span>
          ${desktop ? '' : `<button class="btn-text" data-act="ask" data-id="${esc(p.id)}">Terminalde sor</button>`}
        </div>
      </div>`,
    };
  }

  // Answers being picked for a waiting AskUserQuestion: { [question]: label | [labels] }
  const picks = {};

  function viewQuestion(s) {
    const q = s.question || {};
    const interactive = !!q.askId && Array.isArray(q.questions);
    if (!interactive) {
      return {
        mode: 'card', status: 'question', key: 'q:' + s.id + q.text,
        html: `<div class="card">
          <div class="card-head"><span class="glyph" data-s="question" data-morph="glyph"></span><span class="proj" data-morph="proj" data-morph-text>${esc(s.project)}</span><span class="what">soru soruyor</span></div>
          <h2>${esc(q.text)}</h2>
          ${q.options && q.options.length ? `<div class="opts">${q.options.map((o) => `<span>${esc(o)}</span>`).join('')}</div>` : ''}
          <p class="msg">${s.source === 'desktop' ? "Yanıtını Claude Desktop'ta ver." : 'Yanıtını terminalde ver.'}</p>
        </div>`,
      };
    }
    const sel = picks[q.askId] || (picks[q.askId] = {});
    const blocks = q.questions.map((qq, qi) => {
      const chosen = sel[qq.question];
      const opts = qq.options.map((o) => {
        const on = qq.multiSelect ? (chosen || []).includes(o.label) : chosen === o.label;
        return `<button class="opt ${on ? 'on' : ''}" data-act="pick" data-q="${qi}" data-id="${esc(o.label)}" title="${esc(o.description)}">${esc(o.label)}</button>`;
      }).join('');
      return `<div class="qblock">
        ${q.questions.length > 1 || qq.header ? `<div class="qhead">${esc(qq.header || `Soru ${qi + 1}`)}${qq.multiSelect ? ' · birden fazla seçebilirsin' : ''}</div>` : ''}
        <h2>${esc(qq.question)}</h2>
        <div class="opts pick">${opts}</div>
      </div>`;
    }).join('');
    const needSend = q.questions.length > 1 || q.questions.some((x) => x.multiSelect);
    const ready = q.questions.every((x) => (x.multiSelect ? (sel[x.question] || []).length : sel[x.question]));
    return {
      mode: 'card', status: 'question', key: 'ask:' + q.askId,
      html: `<div class="card">
        <div class="card-head"><span class="glyph" data-s="question" data-morph="glyph"></span><span class="proj" data-morph="proj" data-morph-text>${esc(s.project)}</span><span class="what">soru soruyor</span></div>
        ${blocks}
        <div class="actions">
          ${needSend ? `<button class="btn-allow" data-act="sendAnswers" data-id="${esc(q.askId)}" ${ready ? '' : 'disabled'}>Gönder</button>` : ''}
          <span class="spacer"></span>
          ${q.until ? `<span class="ask-left" data-region="askleft">${Math.max(0, Math.round((q.until - Date.now()) / 1000))} sn sonra terminale düşer</span>` : ''}
          <button class="btn-text" data-act="askTerminal" data-id="${esc(q.askId)}">Terminalde yanıtla</button>
        </div>
      </div>`,
    };
  }

  function viewDone(d) {
    return {
      mode: 'card', status: 'done', key: 'done:' + d.sessionId + d.until,
      html: `<div class="card" data-act="dismiss" data-id="${esc(d.sessionId)}">
        <div class="card-head"><span class="glyph" data-s="done" data-morph="glyph"></span><span class="proj" data-morph="proj" data-morph-text>${esc(d.project)}</span><span class="what">tamamlandı</span></div>
        ${d.summary ? `<p class="msg">${esc(d.summary)}</p>` : ''}
      </div>`,
    };
  }

  function viewInfoCard(c) {
    return { mode: 'card', status: c.status || 'idle', key: 'info:' + c.key, html: `<div class="card info-card" ${c.sticky ? '' : 'data-act="closeCard"'}>${c.html}</div>` };
  }

  // ------------------------------------------------------------ the lighthouse (Ada's mascot)
  // mood: idle | working | waiting | done | sleep
  function lighthouse(mood) {
    return `<span class="fener" data-mood="${mood}" data-act="fener" data-morph="glyph" aria-hidden="true">
      <svg viewBox="-8 0 40 24">
        <defs>
          <linearGradient id="beamL" x1="1" x2="0"><stop offset="0" stop-color="var(--lamp)" stop-opacity=".55"/><stop offset="1" stop-color="var(--lamp)" stop-opacity="0"/></linearGradient>
          <linearGradient id="beamR" x1="0" x2="1"><stop offset="0" stop-color="var(--lamp)" stop-opacity=".55"/><stop offset="1" stop-color="var(--lamp)" stop-opacity="0"/></linearGradient>
        </defs>
        <polygon class="beam-l" points="12,6 -8,1.5 -8,10.5" fill="url(#beamL)"/>
        <polygon class="beam-r" points="12,6 32,1.5 32,10.5" fill="url(#beamR)"/>
        <polygon class="roof" points="8.6,4.2 12,1.6 15.4,4.2"/>
        <rect class="lamp" x="9.6" y="4.2" width="4.8" height="3.6" rx=".8"/>
        <rect class="rail" x="8.8" y="7.8" width="6.4" height="1.1" rx=".4"/>
        <polygon class="tower" points="10,8.9 14,8.9 15.3,21 8.7,21"/>
        <polygon class="stripe" points="9.6,12.4 14.4,12.4 14.7,14.6 9.3,14.6"/>
        <polygon class="stripe" points="9.1,17 14.9,17 15.1,19 8.9,19"/>
        <rect class="base" x="7.2" y="21" width="9.6" height="1.6" rx=".8"/>
        <circle class="spark" cx="18.5" cy="3" r="1.1"/>
      </svg>
    </span>`;
  }
  Ada.lighthouse = lighthouse;
  const moodOf = (status) => ({ working: 'working', waiting: 'waiting', question: 'waiting', done: 'done' }[status] || 'idle');

  // ------------------------------------------------------------ collapsed views
  function viewRest() {
    const sleepy = S.config.sleepy !== false && Date.now() - ui.lastActivity > 90 * 1000;
    return { mode: sleepy ? 'rest sleepy' : 'rest', status: 'idle', html: `<div class="rest">${lighthouse(sleepy ? 'sleep' : 'idle')}</div>` };
  }

  function viewPill(s) {
    const others = S.claude.sessions.filter(live).length - 1;
    return {
      mode: 'pill', status: s.status,
      html: `<div class="pill">
        ${lighthouse(moodOf(s.status))}
        <span class="proj" data-morph="proj" data-morph-text>${esc(s.project)}</span>
        <span class="act">${esc(s.activity)}</span>
        ${others > 0 ? `<span class="count" title="Diğer oturumlar">+${others}</span>` : ''}
      </div>`,
    };
  }

  // ------------------------------------------------------------ panel
  function viewPanel() {
    const t = tabs.find((x) => x.id === ui.tab) || tabs[0];
    ui.tab = t.id;
    const rail = tabs.map((x) => {
      const badge = x.badge ? x.badge() : '';
      return `<button class="tab ${x.id === t.id ? 'on' : ''}" data-act="tab" data-id="${x.id}" title="${esc(x.label)}" aria-label="${esc(x.label)}">${x.icon}${badge || ''}</button>`;
    }).join('');
    const p = primarySession();
    return {
      mode: 'panel',
      status: p && live(p) ? p.status : (t.status && t.status()) || 'idle',
      key: 'panel:' + t.id,
      html: `<div class="panel tab-${t.id}">
        <nav class="rail">${rail}<span class="spacer"></span>
          <button class="tab" data-act="settings" title="Ayarlar" aria-label="Ayarlar">${I.gear}</button>
        </nav>
        <div class="body body-${t.id}">${t.body()}</div>
      </div>`,
    };
  }

  function pickView() {
    if (S.claude.permissions.length) return viewPermission(S.claude.permissions[0]);
    const q = S.claude.sessions.find((s) => s.status === 'question' && s.question);
    if (q) return viewQuestion(q);
    if (doneCard && Date.now() < doneCard.until) return viewDone(doneCard);
    if (card && (card.sticky || Date.now() < card.until)) return viewInfoCard(card);
    if (ui.hovered) return viewPanel();
    const p = primarySession();
    if (p && live(p)) return viewPill(p);
    // tabs may offer a collapsed pill (pomodoro, class reminder, music) in priority order
    for (const t of [...tabs].sort((a, b) => (a.pillRank || 99) - (b.pillRank || 99))) {
      const v = t.pill && t.pill();
      if (v) return { mode: 'pill', key: 'pill:' + t.id, ...v };
    }
    return viewRest();
  }

  // ------------------------------------------------------------ render with region patching
  // Parts of a view marked data-region="name" are updated in place when only they change,
  // so scroll positions, focused inputs and running animations survive updates.
  const parser = document.createElement('template');
  function split(html) {
    parser.innerHTML = html;
    const regions = {};
    parser.content.querySelectorAll('[data-region]').forEach((el) => {
      // nested regions belong to their outermost region
      if (el.parentElement && el.parentElement.closest('[data-region]')) return;
      regions[el.dataset.region] = el.innerHTML;
      el.innerHTML = '';
    });
    const div = document.createElement('div');
    div.appendChild(parser.content.cloneNode(true));
    return { skeleton: div.innerHTML, regions };
  }

  function currentTab() { return ui.hovered ? tabs.find((x) => x.id === ui.tab) : null; }

  function render() {
    if (ui.drag || pressed) return;
    const v = pickView();
    const key = v.key || v.mode;
    const { skeleton, regions } = split(v.html);

    if (key === last.key && v.mode === last.mode && skeleton === last.skeleton) {
      let changed = false;
      for (const [name, html] of Object.entries(regions)) {
        if (last.regions[name] === html) continue;
        const el = inner.querySelector(`[data-region="${name}"]`);
        if (el) { el.innerHTML = html; changed = true; }
      }
      last.regions = regions;
      island.dataset.status = v.status;
      if (changed) { resize(); const t = currentTab(); if (t && t.after) t.after(inner, false); tick(true); }
      return;
    }
    // A focused input is never rebuilt under the user's fingers.
    if (ui.holdOpen && key === last.key && v.mode === last.mode) return;
    const modeChanged = v.mode !== last.mode || key !== last.key;
    last = { mode: v.mode, key, skeleton, regions };
    const apply = () => {
      inner.innerHTML = v.html;
      island.dataset.status = v.status;
      island.className = v.mode.split(' ').map((m) => `mode-${m}`).join(' ');
      resize();
      const t = currentTab();
      if (t && t.after) t.after(inner, true);
      tick(true);
    };
    if (modeChanged && inner.innerHTML && !reduceMotion()) morph(apply);
    else apply();
  }

  // ------------------------------------------------------------ morph between views
  // Elements tagged data-morph="name" in both the old and the new view (album cover, title,
  // status dot, pomodoro ring…) fly from their old place to the new one while the island
  // resizes around them; everything else cross-fades. The content is anchored to the island's
  // centre (left/right edge when Ada sits at a side), so nothing slides while the island grows.
  const EASE = 'cubic-bezier(.2, .9, .25, 1.12)';
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function morph(apply) {
    const before = {};
    inner.querySelectorAll('[data-morph]').forEach((el) => {
      if (!(el.dataset.morph in before)) before[el.dataset.morph] = el.getBoundingClientRect();
    });
    // the old view stays on top for a moment as a fading ghost
    const ghost = inner.cloneNode(true);
    ghost.removeAttribute('id');
    ghost.classList.add('ghost');
    ghost.querySelectorAll('[data-morph]').forEach((el) => { if (el.dataset.morph in before) el.style.visibility = 'hidden'; });
    island.appendChild(ghost);
    ghost.animate([{ opacity: 1 }, { opacity: 0, filter: 'blur(2px)' }], { duration: 160, easing: 'ease-out', fill: 'forwards' })
      .onfinish = () => ghost.remove();

    apply();

    inner.animate([{ opacity: 0, transform: anchorTransform(0.97) }, { opacity: 1, transform: anchorTransform(1) }],
      { duration: 280, delay: 40, easing: EASE, fill: 'backwards' });
    inner.querySelectorAll('[data-morph]').forEach((el) => {
      const a = before[el.dataset.morph];
      if (!a) return;
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) return;
      const dx = a.left + a.width / 2 - (b.left + b.width / 2);
      const dy = a.top + a.height / 2 - (b.top + b.height / 2);
      const sx = a.width / b.width;
      const sy = a.height / b.height;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.02) return;
      // the shared element is visible from the first frame, even while its container fades in
      if (el.hasAttribute('data-morph-text')) {
        // text keeps its proportions: scale by line height, anchored at its top-left corner
        const k = a.height / b.height;
        el.animate([
          { transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${k})`, transformOrigin: 'left top', opacity: 1 },
          { transform: 'none', transformOrigin: 'left top', opacity: 1 },
        ], { duration: 460, easing: EASE });
        return;
      }
      el.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, transformOrigin: 'center', opacity: 1 },
        { transform: 'none', transformOrigin: 'center', opacity: 1 },
      ], { duration: 460, easing: EASE });
    });
  }

  function anchorTransform(scale) {
    const pos = document.body.dataset.pos || 'center';
    return pos === 'center' ? `translateX(-50%) scale(${scale})` : `scale(${scale})`;
  }

  // Inline style attributes are blocked by the page's CSP; sizes come as data-w / data-h instead.
  function applySizes() {
    inner.querySelectorAll('[data-w]').forEach((el) => { el.style.width = el.dataset.w + '%'; });
    inner.querySelectorAll('[data-h]').forEach((el) => { el.style.height = el.dataset.h + '%'; });
  }

  function resize() {
    applySizes();
    island.style.width = inner.offsetWidth + 'px';
    island.style.height = inner.offsetHeight + 'px';
  }

  function tick(force) {
    for (const t of tabs) if (t.tick) t.tick(inner, force, ui.hovered && ui.tab === t.id);
    // pills hold live text (countdowns); keep the island as wide as its content
    if (last.mode === 'pill') {
      const w = inner.offsetWidth + 'px';
      if (island.style.width !== w) island.style.width = w;
    }
  }
  setInterval(() => tick(false), 200);
  // re-evaluate time-based views (sleepy rest, card expiry, pills with countdowns)
  setInterval(() => render(), 1000);

  function bump() {
    island.classList.remove('bump');
    void island.offsetWidth;
    island.classList.add('bump');
  }
  function activity() { ui.lastActivity = Date.now(); }

  // ------------------------------------------------------------ sound
  let actx = null;
  function chime(kind) {
    if (!S.config.sound) return;
    try {
      actx = actx || new AudioContext();
      const seq = kind === 'done' ? [659.25, 987.77] : kind === 'pomo' ? [523.25, 659.25, 783.99] : [880, 880];
      const gap = kind === 'done' ? 0.12 : kind === 'pomo' ? 0.16 : 0.18;
      const t0 = actx.currentTime;
      seq.forEach((f, i) => {
        const o = actx.createOscillator();
        const g = actx.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        const t = t0 + i * gap;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.11, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
        o.connect(g).connect(actx.destination);
        o.start(t);
        o.stop(t + 0.75);
      });
    } catch { /* audio unavailable */ }
  }

  function applyBodyConfig(c) {
    document.body.dataset.pos = c.position || 'center';
    document.body.classList.toggle('glass', c.glass !== false);
  }

  // ------------------------------------------------------------ scroll gestures
  // Over the island (outside lists and text): wheel up/down = computer volume,
  // horizontal swipe (touchpad) or Shift+wheel = next / previous song.
  let hudTimer = null;
  function hud(html) {
    hudEl.innerHTML = html;
    hudEl.hidden = false;
    clearTimeout(hudTimer);
    hudTimer = setTimeout(() => { hudEl.hidden = true; }, 1100);
  }
  Ada.hud = hud;
  let swipe = 0;
  let swipeLock = 0;
  island.addEventListener('wheel', (e) => {
    if (e.target.closest('.sub, .rows, .s-log, textarea, .clips, .cls, .hist, .list, .lyrics, .vol, input')) return;
    const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey;
    e.preventDefault();
    if (horizontal) {
      if (Date.now() < swipeLock) return;
      swipe += e.shiftKey ? e.deltaY : e.deltaX;
      if (Math.abs(swipe) < 60) return;
      const dir = swipe > 0 ? 'next' : 'prev';
      swipe = 0;
      swipeLock = Date.now() + 700;
      if (!S.music || !S.music.connected) return;
      ada.music(dir).then((r) => { if (r && !r.ok) toast({ kind: 'error', text: r.error }); });
      hud(`${dir === 'next' ? I.next : I.prev}<span>${dir === 'next' ? 'Sonraki şarkı' : 'Önceki şarkı'}</span>`);
      return;
    }
    const v = S.mods.volume;
    if (!v || !v.available || v.vol == null) return;
    const step = e.deltaY < 0 ? 2 : -2;
    const nv = Math.max(0, Math.min(100, v.vol + step));
    S.mods.volume = { ...v, vol: nv, muted: nv === 0 ? v.muted : false };
    ada.call('volume', 'set', nv);
    hud(`${nv === 0 || S.mods.volume.muted ? I.volOff : I.vol}<span class="hbar"><b data-w="${nv}"></b></span><span class="hv">${nv}</span>`);
    hudEl.querySelector('[data-w]').style.width = nv + '%';
  }, { passive: false });

  // ------------------------------------------------------------ toast
  let toastTimer = null;
  function toast({ kind, text }) {
    toastEl.textContent = text;
    toastEl.className = kind === 'error' ? 'error' : '';
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, kind === 'error' ? 7000 : 4000);
  }

  // ------------------------------------------------------------ open / close the panel
  function openPanel() {
    if (ui.hovered) return;
    ui.hovered = true;
    activity();
    if (!ui.tab) {
      const preferred = tabs.find((t) => t.wantsFocus && t.wantsFocus());
      ui.tab = (preferred || tabs[0]).id;
    } else {
      const p = primarySession();
      if (p && live(p)) ui.tab = 'claude';
    }
    const t = currentTab();
    if (t && t.onEnter) t.onEnter();
    render();
  }

  function closePanel() {
    if (ui.drag || ui.holdOpen) return;
    if (!ui.hovered) return;
    const t = currentTab();
    ui.hovered = false;
    if (t && t.onLeave) t.onLeave();
    if (doneCard && Date.now() >= doneCard.until) doneCard = null;
    render();
  }
  Ada.closePanel = closePanel;

  // The main process tells us when the cursor enters or leaves the island (see main.js).
  ui.pointer = false;
  function onPointer(inside) {
    ui.pointer = inside;
    if (inside) {
      clearTimeout(leaveTimer);
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(openPanel, 160);
    } else {
      clearTimeout(hoverTimer);
      if (ui.drag || ui.holdOpen) return;
      leaveTimer = setTimeout(closePanel, 300);
    }
  }
  ada.on('island:pointer', onPointer);
  // Fallback for tests in a plain browser, where no main process sends pointer events.
  island.addEventListener('mouseenter', () => { if (!window.__adaMain) onPointer(true); });
  island.addEventListener('mouseleave', () => { if (!window.__adaMain) onPointer(false); });
  ada.on('island:pointer', () => { window.__adaMain = true; });

  // Report the island's outline so the main process knows where clicks belong.
  let lastRect = '';
  function reportRect() {
    const r = island.getBoundingClientRect();
    const key = `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}`;
    if (key === lastRect) return;
    lastRect = key;
    ada.rect({ x: r.left, y: r.top, w: r.width, h: r.height });
  }
  island.addEventListener('transitionend', reportRect);
  setInterval(reportRect, 100);
  Ada.afterPointerAction = () => { ada.hold(ui.drag || ui.holdOpen); if (!ui.pointer && !ui.holdOpen) closePanel(); };

  // Inputs: make the window focusable only while typing.
  island.addEventListener('mousedown', (e) => {
    const field = e.target.closest('input[type="text"], input[type="search"], textarea');
    if (!field) return;
    ui.holdOpen = true;
    ada.hold(true);
    ada.focusable(true);
    setTimeout(() => field.focus(), 30);
  });
  island.addEventListener('focusout', (e) => {
    setTimeout(() => {
      const a = document.activeElement;
      if (a && inner.contains(a) && a.matches('input, textarea')) return;
      ui.holdOpen = false;
      ada.focusable(false);
      ada.hold(ui.drag);
      if (!ui.pointer) closePanel();
    }, 50);
  });
  window.addEventListener('blur', () => {
    if (!ui.holdOpen) return;
    const a = document.activeElement;
    if (a && a.blur) a.blur();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ui.holdOpen) {
      const a = document.activeElement;
      if (a && a.blur) a.blur();
    }
  });

  // Buttons act on press. The island re-draws often (music, timers); waiting for a full
  // click means a re-draw between press and release could swallow it.
  let pressTimer = null;
  island.addEventListener('pointerdown', (e) => {
    ada.diag('down', `${e.button} ${Math.round(e.clientX)},${Math.round(e.clientY)} ${e.target.tagName}${e.target.closest('[data-act]') ? ' act' : ''}`);
    if (e.button !== 0) return;
    pressed = true;
    ada.hold(true);
    // if the release is ever missed, don't stay frozen
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => { pressed = false; ada.hold(ui.drag || ui.holdOpen); }, 1500);
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    if (el.closest('[data-seek]')) return;
    e.preventDefault();
    handleAct(el, e);
  });
  window.addEventListener('pointerup', () => {
    if (!pressed) return;
    pressed = false;
    clearTimeout(pressTimer);
    ada.hold(ui.drag || ui.holdOpen);
    setTimeout(render, 0);
  });
  // keyboard (Enter / Space on a focused button) still arrives as a click with detail 0
  island.addEventListener('click', (e) => {
    if (e.detail !== 0) return;
    const el = e.target.closest('[data-act]');
    if (el && !el.disabled) handleAct(el, e);
  });

  Ada.debugState = () => ({
    hovered: ui.hovered, tab: ui.tab, pointer: ui.pointer, drag: ui.drag, holdOpen: ui.holdOpen, pressed,
    mode: last.mode, key: last.key, rect: island.getBoundingClientRect().toJSON(),
    activeElement: document.activeElement ? document.activeElement.tagName + '.' + document.activeElement.className : null,
    hasFocus: document.hasFocus(),
  });

  function handleAct(el, e) {
    ada.diag('act', el.dataset.act + (el.dataset.id ? ':' + el.dataset.id : ''));
    activity();
    const { act, id } = el.dataset;
    if (act === 'tab') {
      const prev = currentTab();
      if (prev && prev.onLeave && prev.id !== id) prev.onLeave();
      ui.tab = id;
      const t = currentTab();
      if (t && t.onEnter) t.onEnter();
      render();
      return;
    }
    if (act === 'fener') {
      const f = el.closest('.fener');
      f.classList.remove('wink'); void f.offsetWidth; f.classList.add('wink');
      return;
    }
    if (act === 'settings') { ada.openSettings(id || ''); return; }
    if (act === 'dismiss') { ada.dismiss(id); doneCard = null; render(); return; }
    if (act === 'closeCard') { card = null; render(); return; }
    if (act === 'updateOpen') { ada.call('update', 'open'); card = null; render(); return; }
    if (act === 'allow' || act === 'deny' || act === 'ask') {
      ada.decide(id, act);
      S.claude.permissions = S.claude.permissions.filter((p) => p.id !== id);
      render();
      return;
    }
    if (act === 'pick' || act === 'sendAnswers' || act === 'askTerminal') return onAnswer(act, el);
    // let the tab that owns the current view handle it
    for (const t of tabs) {
      if (t.onAct && t.onAct(act, id, el, e) === true) return;
    }
  }

  function onAnswer(act, el) {
    const s = S.claude.sessions.find((x) => x.status === 'question' && x.question && x.question.askId);
    if (!s) return;
    const q = s.question;
    if (act === 'askTerminal') { ada.answer(q.askId, null); delete picks[q.askId]; return; }
    const sel = picks[q.askId] || (picks[q.askId] = {});
    if (act === 'pick') {
      const qq = q.questions[Number(el.dataset.q)];
      const label = el.dataset.id;
      if (qq.multiSelect) {
        const arr = new Set(sel[qq.question] || []);
        arr.has(label) ? arr.delete(label) : arr.add(label);
        sel[qq.question] = [...arr];
      } else sel[qq.question] = label;
      // one single-choice question: send right away
      if (q.questions.length === 1 && !qq.multiSelect) {
        ada.answer(q.askId, { [qq.question]: label });
        delete picks[q.askId];
        s.question = null;
        s.status = 'working';
      }
      render();
      return;
    }
    if (act === 'sendAnswers') {
      ada.answer(q.askId, sel);
      delete picks[q.askId];
      s.question = null;
      s.status = 'working';
      render();
    }
  }

  // ------------------------------------------------------------ wiring
  ada.on('island:state', (s) => { S.claude = s; activity(); render(); });
  ada.on('island:event', (ev) => {
    activity();
    if (ev.type === 'permission' || ev.type === 'question') { chime('ask'); bump(); }
    if (ev.type === 'done') {
      chime('done');
      doneCard = { sessionId: ev.sessionId, project: ev.project, summary: ev.summary, until: Date.now() + 7000 };
      bump();
    }
    if (ev.type === 'update') {
      card = {
        key: 'update' + ev.version, status: 'done', sticky: true,
        html: `<div class="card-head"><span class="glyph" data-s="done"></span><span class="proj">Ada ${esc(ev.version)}</span><span class="what">yeni sürüm hazır</span></div>
          ${ev.notes ? `<p class="msg">${esc(ev.notes.split('\n')[0])}</p>` : ''}
          <div class="actions"><button class="btn-allow" data-act="updateOpen">İndir</button><button class="btn-text" data-act="closeCard">Sonra</button></div>`,
      };
    }
    if (ev.type === 'summary' && ev.stats) {
      const d = ev.stats.today;
      const h = Math.floor(d.focusMin / 60);
      card = {
        key: 'summary', status: 'idle', sticky: true,
        html: `<div class="card-head"><span class="glyph" data-s="done"></span><span class="proj">Günün özeti</span><span class="what">${new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}</span></div>
          <div class="sum-nums">
            <div><b>${h ? `${h} sa ${d.focusMin % 60} dk` : `${d.focusMin} dk`}</b><span>odak</span></div>
            <div><b>${d.pomodoros}</b><span>pomodoro</span></div>
            <div><b>${d.claudeDone}</b><span>Claude işi</span></div>
            <div><b>${d.songs}</b><span>şarkı</span></div>
          </div>
          <div class="actions"><span class="spacer"></span><button class="btn-text" data-act="closeCard">Kapat</button></div>`,
      };
      chime('done');
    }
    for (const t of tabs) if (t.onEvent) t.onEvent(ev);
    render();
  });
  ada.on('music:state', (m) => { S.music = m; for (const t of tabs) if (t.onMusic) t.onMusic(m); render(); });
  ada.on('mod:state', ({ mod, data }) => { S.mods[mod] = data; for (const t of tabs) if (t.onMod) t.onMod(mod, data); render(); });
  ada.on('island:toast', toast);
  ada.on('island:config', (c) => { S.config = c; applyBodyConfig(c); for (const t of tabs) if (t.onConfig) t.onConfig(c); render(); });
  ada.on('island:expand', () => {
    openPanel();
    setTimeout(() => { if (!island.matches(':hover')) closePanel(); }, 5000);
  });

  document.addEventListener('DOMContentLoaded', () => {
    ada.init().then(({ config, state, music, mods }) => {
      if (config) { S.config = config; applyBodyConfig(config); }
      if (state) S.claude = state;
      if (music) S.music = music;
      if (mods) Object.assign(S.mods, mods);
      for (const t of tabs) if (t.init) t.init();
      render();
    });
  });
})();
