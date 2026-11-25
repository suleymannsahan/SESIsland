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
    terminal: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="14" rx="3"/><path d="M7.5 10l2.5 2-2.5 2M12.5 14.5h4"/></svg>',
    note: '<svg viewBox="0 0 24 24"><path d="M9 17.5V6l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/></svg>',
    timer: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2M9.5 2.8h5M18.5 6.5l1.2-1.2"/></svg>',
    book: '<svg viewBox="0 0 24 24"><path d="M5 18.5V6a2.5 2.5 0 0 1 2.5-2.5H19v13H7.5A2.5 2.5 0 0 0 5 19a2.5 2.5 0 0 0 2.5 2.5H19M9 7.5h6"/></svg>',
    tools: '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="3"/><rect x="8" y="6" width="8" height="3.5" rx="1"/><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 17h.01M12 17h.01M15.5 17h.01"/></svg>',
    chip: '<svg viewBox="0 0 24 24"><rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/><path d="M9.5 3v3.5M14.5 3v3.5M9.5 17.5V21M14.5 17.5V21M3 9.5h3.5M3 14.5h3.5M17.5 9.5H21M17.5 14.5H21"/></svg>',
    gauge: '<svg viewBox="0 0 24 24"><path d="M4.5 16.5a8 8 0 1 1 15 0M12 13l3.5-4"/><circle cx="12" cy="13.5" r="1.3"/></svg>',
    computer: '<svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="12" rx="2.5"/><path d="M8.5 20.5h7M12 16.5v4"/></svg>',
    phone: '<svg viewBox="0 0 24 24"><rect x="6.5" y="2.5" width="11" height="19" rx="2.8"/><path d="M11 18.5h2"/></svg>',
    speaker: '<svg viewBox="0 0 24 24"><rect x="5.5" y="2.5" width="13" height="19" rx="3"/><circle cx="12" cy="14.5" r="3.2"/><path d="M12 7h.01"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
    jump: '<svg viewBox="0 0 24 24"><path d="M13.5 4.5h6v6M19.5 4.5l-8 8M10 5.5H7.5a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V14"/></svg>',
  };

  // ------------------------------------------------------------ sessions
  const live = (s) => ['working', 'waiting', 'question', 'done'].includes(s.status);
  const rank = { waiting: 0, question: 1, working: 2, done: 3, idle: 4 };
  const primarySession = () => [...S.claude.sessions].sort((a, b) => (rank[a.status] - rank[b.status]) || (b.updatedAt - a.updatedAt))[0];

  // ------------------------------------------------------------ public API for tabs
  const Ada = {
    S, ui, I, esc, $, $$, mmss, ago, live, primarySession,
    island, inner, tabs,
    tab(def) {
      if (tabs.some((t) => t.id === def.id)) return;
      tabs.push(def);
      // a plugin's tab arrives after start-up: give it its init and show it
      if (started) { try { if (def.init) def.init(); } catch (e) { console.error(e); } render(); }
    },
    render: () => render(),
    toast: (t) => toast(t),
    chime: (k) => chime(k),
    showCard: (c) => { card = c; render(); },
    closeCard: () => { card = null; render(); },
    holdOpen: (on) => { ui.holdOpen = !!on; },
  };
  let started = false;
  let notice = null;
  Ada.notice = (n) => { notice = { ...n, until: Date.now() + (n.ms || 4000) }; render(); setTimeout(render, (n.ms || 4000) + 30); };
  const eventListeners = [];
  const pillProviders = [];
  Ada.addPill = (p) => pillProviders.push(p);
  Ada.onEvent = (fn) => eventListeners.push(fn);
  const actHandlers = [];
  Ada.onAct = (fn) => actHandlers.push(fn);
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
          ${S.config.fenerMoods === false ? '<span class="glyph" data-s="waiting" data-morph="glyph"></span>' : lighthouse('waiting', { ...scene(), wx: '' })}
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

  // quick replies: what the chips send to Claude
  const QUICK = [
    ['Devam et', 'Devam et.'],
    ['Test et', 'Yaptığın değişiklikleri test et ve sonucu kısaca söyle.'],
    ['Açıkla', 'Ne yaptığını kısaca, maddeler hâlinde açıkla.'],
    ['Commit at', 'Değişiklikleri anlamlı bir mesajla commit et.'],
  ];
  // Claude Desktop is a chat: other quick answers fit better there
  const QUICK_CHAT = [
    ['Devam et', 'Devam et.'],
    ['Daha kısa', 'Daha kısa ve öz anlatır mısın?'],
    ['Örnek ver', 'Bir örnekle açıklar mısın?'],
    ['Teşekkürler', 'Teşekkürler!'],
  ];
  const quickFor = (d) => (d && d.desktop ? QUICK_CHAT : QUICK);
  function viewDone(d) {
    if (d.replyUntil && Date.now() < d.replyUntil) {
      const left = Math.max(0, Math.ceil((d.replyUntil - Date.now()) / 1000));
      return {
        mode: 'card', status: 'done', key: 'done:' + d.id,
        html: `<div class="card done-card">
          <div class="card-head"><span class="glyph" data-s="done" data-morph="glyph"></span><span class="proj" data-morph="proj" data-morph-text>${esc(d.project)}</span><span class="what">tamamlandı</span>
            <span class="queue" data-region="qrleft">${left} sn</span>
            <button class="ic xs" data-act="dismiss" data-id="${esc(d.sessionId)}" title="Kapat">${I.x}</button></div>
          ${d.summary ? `<p class="msg clamp3">${esc(d.summary)}</p>` : ''}
          <div class="qr">
            ${quickFor(d).map(([label], i) => `<button class="opt" data-act="qr" data-id="${i}">${label}</button>`).join('')}
          </div>
          <input type="text" class="qr-in" data-qreply="1" placeholder="Claude'a yanıt yaz… (Enter ile gönder)" spellcheck="false" autocomplete="off" aria-label="Claude'a yanıt">
        </div>`,
      };
    }
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
  // mood: idle | working | waiting | done | sleep | focus
  // extra: tod (night/dawn/day), exam, wx (weather kind), and on its own: the season and special days,
  // and whether you have been at it for a long time (the lighthouse gets tired and yawns)
  function lighthouse(mood, extra = {}) {
    const fest = S.config.seasons === false ? {} : festive();
    return `<span class="fener" data-mood="${mood}" data-tod="${extra.tod || 'day'}" data-exam="${extra.exam ? 1 : 0}" data-wx="${extra.wx || ''}" data-season="${fest.season || ''}" data-fest="${fest.day || ''}" data-tired="${mood !== 'sleep' && tired() ? 1 : 0}" data-act="fener" data-morph="glyph" aria-hidden="true">
      <svg viewBox="-8 0 40 24">
        <defs>
          <linearGradient id="beamL" x1="1" x2="0"><stop offset="0" stop-color="var(--lamp)" stop-opacity=".55"/><stop offset="1" stop-color="var(--lamp)" stop-opacity="0"/></linearGradient>
          <linearGradient id="beamR" x1="0" x2="1"><stop offset="0" stop-color="var(--lamp)" stop-opacity=".55"/><stop offset="1" stop-color="var(--lamp)" stop-opacity="0"/></linearGradient>
          <linearGradient id="beamD" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--lamp)" stop-opacity=".7"/><stop offset="1" stop-color="var(--lamp)" stop-opacity="0"/></linearGradient>
        </defs>
        <g class="stars"><circle cx="-5" cy="3" r=".7"/><circle cx="-1.5" cy="10.5" r=".5"/><circle cx="26" cy="12" r=".55"/><circle cx="20.5" cy="1.4" r=".45"/></g>
        <path class="moon" d="M29.6 1.2a3.3 3.3 0 1 0 2.2 5.6a2.7 2.7 0 1 1 -2.2 -5.6z"/>
        <circle class="sun" cx="19.6" cy="20.2" r="3.4"/>
        <polygon class="beam-l" points="12,6 -8,1.5 -8,10.5" fill="url(#beamL)"/>
        <polygon class="beam-r" points="12,6 32,1.5 32,10.5" fill="url(#beamR)"/>
        <polygon class="beam-f" points="12,6 32,4.6 32,7.4" fill="url(#beamR)"/>
        <polygon class="beam-d" points="12,6 4,24 20,24" fill="url(#beamD)"/>
        <g class="fb">
          <polygon class="roof" points="8.6,4.2 12,1.6 15.4,4.2"/>
          <path class="snowcap" d="M8.3 4.4q1.2-1.3 2.2-2.1q.7.5 1.5.1q.8.5 1.5-.1q1 .8 2.2 2.1q-.9.5-1.7-.1q-.9.6-2 0q-1.1.6-2 0q-.8.6-1.7.1z"/>
          <g class="hat"><polygon points="10,2 12,-2.4 14,2"/><circle cx="12" cy="-2.5" r=".8"/><path d="M10.9 .4h2.2M11.4 -1.1h1.2"/></g>
          <g class="flag"><path class="pole" d="M12 1.8V-2.6"/><rect x="12" y="-2.6" width="4.6" height="3" rx=".3"/><circle cx="13.7" cy="-1.1" r=".9"/><circle cx="14" cy="-1.1" r=".72" class="cut"/><circle cx="15.1" cy="-1.1" r=".38" class="st"/></g>
          <rect class="lamp" x="9.6" y="4.2" width="4.8" height="3.6" rx=".8"/>
          <rect class="lid" x="9.6" y="4.2" width="4.8" height="0" rx=".5"/>
          <rect class="rail" x="8.8" y="7.8" width="6.4" height="1.1" rx=".4"/>
          <polygon class="tower" points="10,8.9 14,8.9 15.3,21 8.7,21"/>
          <polygon class="stripe" points="9.6,12.4 14.4,12.4 14.7,14.6 9.3,14.6"/>
          <polygon class="stripe" points="9.1,17 14.9,17 15.1,19 8.9,19"/>
          <ellipse class="yawn" cx="12" cy="10.9" rx=".9" ry="0"/>
        </g>
        <rect class="base" x="7.2" y="21" width="9.6" height="1.6" rx=".8"/>
        <g class="flower"><path class="stem" d="M5 22v-3"/><circle cx="5" cy="18.4" r="1.25"/><circle cx="5" cy="18.4" r=".5" class="mid"/></g>
        <path class="leaf" d="M0 0q1.6-1.6 3.2 0q-1.6 1.6-3.2 0z"/>
        <g class="confetti"><rect x="2" y="2" width="1" height="1.6"/><rect x="21" y="3" width="1.6" height="1"/><rect x="0" y="12" width="1" height="1.6"/><rect x="24" y="14" width="1.6" height="1"/></g>
        <circle class="spark" cx="18.5" cy="3" r="1.1"/>
        <path class="drop" d="M17.2 5.6q1.3 1.7 0 2.6q-1.3 -.9 0 -2.6z"/>
        <g class="wx-rain"><path d="M-4 -2l-1 3"/><path d="M1 -4l-1 3"/><path d="M21 -1l-1 3"/><path d="M25 2l-1 3"/><path d="M-1 6l-1 3"/><path d="M23 8l-1 3"/></g>
        <g class="wx-snow"><circle cx="-4" cy="-2" r=".9"/><circle cx="1" cy="-4" r=".8"/><circle cx="21" cy="-1" r=".9"/><circle cx="25" cy="2" r=".8"/><circle cx="-1" cy="7" r=".8"/><circle cx="23" cy="9" r=".9"/></g>
        <path class="wx-bolt" d="M23.5 1l-2.5 4h2l-1.5 4 3.8-5.5h-2l1.2-2.5z"/>
        <g class="wx-fog"><path d="M-7 15h12"/><path d="M19 17h12"/><path d="M-4 19.5h10"/></g>
        <path class="wx-cloud" d="M19.5 5a2.3 2.3 0 0 1 0-4.6a3.2 3.2 0 0 1 6.1 .9a1.9 1.9 0 0 1 .2 3.7z"/>
        <text class="zz" x="16.5" y="5">z</text>
      </svg>
    </span>`;
  }

  // seasons and special days: snow on the roof in winter, a flower in spring, a falling leaf in
  // autumn; a party hat at New Year and on your birthday; a flag on national days
  function festive(d = new Date()) {
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const md = `${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const season = m === 12 || m <= 2 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'autumn';
    let special = '';
    if ((m === 12 && day >= 30) || (m === 1 && day <= 1)) special = 'newyear';
    if (['04-23', '05-19', '08-30', '10-29'].includes(md)) special = 'flag';
    const bd = String(S.config.birthday || '').match(/^(\d{1,2})[./-](\d{1,2})$/);
    if (bd && Number(bd[1]) === day && Number(bd[2]) === m) special = 'birthday';
    return { season, day: special };
  }
  Ada.festive = festive;

  // tired: busy (Claude at work, a Pomodoro, the stopwatch) for 50 minutes without a real break,
  // or still up past one at night
  let busySince = 0;
  let calmSince = Date.now();
  function busyNow() {
    const working = S.claude.sessions.some((x) => x.status === 'working');
    const f = S.mods.pomodoro;
    return working || !!(f && f.phase === 'focus' && !f.paused);
  }
  setInterval(() => {
    if (busyNow()) { if (!busySince) busySince = Date.now(); calmSince = 0; }
    else { if (!calmSince) calmSince = Date.now(); if (Date.now() - calmSince > 10 * 60 * 1000) busySince = 0; }
  }, 15000);
  function tired() {
    if (S.config.fenerMoods === false) return false;
    const h = new Date().getHours();
    if (h >= 1 && h < 5) return true;
    return !!busySince && Date.now() - busySince > 50 * 60 * 1000;
  }
  Ada.tired = tired;
  Ada.lighthouse = lighthouse;
  const moodOf = (status) => ({ working: 'working', waiting: 'waiting', question: 'waiting', done: 'done' }[status] || 'idle');

  // ------------------------------------------------------------ collapsed views
  // time of day and exams change the lighthouse a little: stars and a moon at night, the sun at
  // dawn, a drop of sweat the day before an exam
  function scene() {
    const d = new Date();
    const h = d.getHours();
    const tod = h >= 21 || h < 6 ? 'night' : h < 9 ? 'dawn' : 'day';
    const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    const tomorrow = new Date(d); tomorrow.setDate(d.getDate() + 1);
    const exams = (S.mods.schedule && S.mods.schedule.exams) || [];
    const exam = exams.some((x) => x.date === iso(d) || x.date === iso(tomorrow));
    const w = S.mods.weather;
    const wx = w && w.now && S.config.weatherRest !== false ? w.now.kind : '';
    return { tod, exam, wx };
  }
  // small weather icons, shared with the System tab
  const WXI = {
    sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2" class="sun"/><path class="sun" d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path class="moon" d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5z"/></svg>',
    partly: '<svg viewBox="0 0 24 24"><circle cx="9" cy="9" r="3.4" class="sun"/><path class="sun" d="M9 2.5v1.5M2.5 9H4M4.4 4.4l1 1M13.6 4.4l-1 1"/><path d="M8.5 19.5a3.5 3.5 0 0 1 0-7a4.8 4.8 0 0 1 9.2 1.3a2.9 2.9 0 0 1-.4 5.7z"/></svg>',
    cloudy: '<svg viewBox="0 0 24 24"><path d="M7 18.5a4 4 0 0 1 0-8a5.5 5.5 0 0 1 10.5 1.5a3.3 3.3 0 0 1-.5 6.5z"/></svg>',
    fog: '<svg viewBox="0 0 24 24"><path d="M4 9h16M6 13h12M4 17h16"/></svg>',
    drizzle: '<svg viewBox="0 0 24 24"><path d="M7 14.5a3.8 3.8 0 0 1 0-7.6a5.2 5.2 0 0 1 10 1.4a3.1 3.1 0 0 1-.5 6.2z"/><path class="rain" d="M9 18l-.6 1.5M13 18l-.6 1.5M17 18l-.6 1.5"/></svg>',
    rain: '<svg viewBox="0 0 24 24"><path d="M7 14.5a3.8 3.8 0 0 1 0-7.6a5.2 5.2 0 0 1 10 1.4a3.1 3.1 0 0 1-.5 6.2z"/><path class="rain" d="M8.5 17.5l-1 2.5M12.5 17.5l-1 2.5M16.5 17.5l-1 2.5"/></svg>',
    snow: '<svg viewBox="0 0 24 24"><path d="M7 14.5a3.8 3.8 0 0 1 0-7.6a5.2 5.2 0 0 1 10 1.4a3.1 3.1 0 0 1-.5 6.2z"/><path class="snow" d="M8.5 18.5h.01M12.5 19.5h.01M16.5 18.5h.01M10.5 21h.01M14.5 21h.01"/></svg>',
    storm: '<svg viewBox="0 0 24 24"><path d="M7 14.5a3.8 3.8 0 0 1 0-7.6a5.2 5.2 0 0 1 10 1.4a3.1 3.1 0 0 1-.5 6.2z"/><path class="bolt" d="M12.5 15l-2.5 4h2.5l-1.5 3.5"/></svg>',
  };
  Ada.wxIcon = (kind, isDay = true) => (kind === 'clear' ? (isDay ? WXI.sun : WXI.moon) : WXI[kind] || WXI.cloudy);
  function wxHtml() {
    const w = S.mods.weather;
    if (!w || !w.now || S.config.weatherRest === false) return '';
    return `<span class="wx" title="${esc(`${w.place ? w.place.name + ' · ' : ''}${w.now.text} · hissedilen ${w.now.feels}°`)}"><i class="wx-ic sm">${Ada.wxIcon(w.now.kind, w.now.isDay)}</i><span data-num="wxtemp">${w.now.temp}°</span></span>`;
  }
  Ada.scene = scene;

  function viewRest() {
    const dots = privacyHtml();
    const sleepy = !dots && !wxHtml() && S.config.sleepy !== false && Date.now() - ui.lastActivity > 90 * 1000;
    return { mode: sleepy ? 'rest sleepy' : 'rest', status: 'idle', html: `<div class="rest ${dots ? 'has-priv' : ''} ${wxHtml() ? 'has-wx' : ''}">${lighthouse(sleepy ? 'sleep' : 'idle', scene())}${wxHtml()}${dots}</div>` };
  }

  // camera / microphone in use (Windows privacy indicator): small dots next to the island's content
  function privacyHtml() {
    const p = S.mods.privacy;
    if (!p || S.config.privacyDots === false) return '';
    const cam = (p.cam || []).length;
    const mic = (p.mic || []).length;
    if (!cam && !mic) return '';
    const who = [...new Set([...(p.cam || []), ...(p.mic || [])])].join(', ');
    return `<span class="priv" title="${esc((cam ? 'Kamera' : '') + (cam && mic ? ' ve ' : '') + (mic ? 'mikrofon' : '') + ' kullanımda: ' + who)}">${cam ? '<i class="cam"></i>' : ''}${mic ? '<i class="mic"></i>' : ''}</span>`;
  }
  Ada.privacyHtml = privacyHtml;

  function viewPill(s) {
    const others = S.claude.sessions.filter((x) => live(x) && x !== s).sort((a, b) => (rank[a.status] - rank[b.status]) || (b.updatedAt - a.updatedAt));
    // a song playing at the same time keeps its own small corner of the pill
    const song = Ada.musicMini ? Ada.musicMini() : '';
    const shown = others.slice(0, song ? 1 : 2);
    const more = others.length - shown.length;
    return {
      mode: 'pill', status: s.status,
      html: `<div class="pill ${song ? 'with-music' : ''}">
        ${lighthouse(moodOf(s.status), { ...scene(), wx: '' })}
        <span class="proj" data-morph="proj" data-morph-text>${esc(s.project)}</span>
        <span class="act ${shown.length || song ? 'short' : ''}">${esc(s.activity)}</span>
        ${shown.map((x) => `<span class="osess" title="${esc(x.project)} · ${esc(x.activity)}"><span class="glyph" data-s="${esc(x.status)}"></span>${esc(x.project)}</span>`).join('')}
        ${more > 0 ? `<span class="count" title="Diğer oturumlar">+${more}</span>` : ''}
        ${song}
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
        <nav class="rail"><i class="rail-hl" aria-hidden="true"></i>${rail}<span class="spacer"></span>
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
    if (Ada.paletteView) { const pv = Ada.paletteView(); if (pv) return pv; }
    if (doneCard && Date.now() < doneCard.until) return viewDone(doneCard);
    if (card && (card.sticky || Date.now() < card.until)) return viewInfoCard(card);
    if (ui.hovered) return viewPanel();
    const withPriv = (v) => {
      const dots = privacyHtml();
      return dots ? { ...v, html: v.html.replace(/<\/div>\s*$/, dots + '</div>') } : v;
    };
    // a short notice in pill shape (a device connected, the charger…) wins over the usual pill
    if (notice && Date.now() < notice.until) return withPriv({ mode: 'pill', key: 'notice:' + notice.key, status: notice.status || 'idle', html: notice.html });
    const p = primarySession();
    if (p && live(p)) return withPriv(viewPill(p));
    // tabs (and other pill providers) may offer a collapsed pill in priority order
    for (const t of [...tabs, ...pillProviders].sort((a, b) => (a.pillRank || 99) - (b.pillRank || 99))) {
      const v = t.pill && t.pill();
      if (v) return withPriv({ mode: 'pill', key: 'pill:' + t.id, ...v });
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
      if (changed) { resize(); freshNumbers(); const t = currentTab(); if (t && t.after) t.after(inner, false); tick(true); }
      return;
    }
    // A focused input is never rebuilt under the user's fingers.
    if (ui.holdOpen && key === last.key && v.mode === last.mode) return;
    const modeChanged = v.mode !== last.mode || key !== last.key;
    const tabSwitch = last.mode === 'panel' && v.mode === 'panel' && last.key !== key && last.key.startsWith('panel:') && key.startsWith('panel:');
    const fromHl = tabSwitch ? railOn() : null;
    const fromIdx = tabs.findIndex((x) => 'panel:' + x.id === last.key);
    const oldW = island.offsetWidth;
    const oldH = island.offsetHeight;
    last = { mode: v.mode, key, skeleton, regions };
    const apply = () => {
      inner.innerHTML = v.html;
      island.dataset.status = v.status;
      const keep = ['peek', 'near', 'halo-done', 'bump'].filter((c) => island.classList.contains(c));
      island.className = [...v.mode.split(' ').map((m) => `mode-${m}`), ...keep].join(' ');
      resize();
      placeRailHl(fromHl);
      freshNumbers();
      const t = currentTab();
      if (t && t.after) t.after(inner, true);
      tick(true);
    };
    if (tabSwitch && !reduceMotion()) {
      apply();
      // the new tab's content slides in from the side of the rail it came from
      const dir = tabs.findIndex((x) => x.id === ui.tab) > fromIdx ? 1 : -1;
      const body = inner.querySelector('.body');
      if (body) body.animate([{ opacity: 0, transform: `translateY(${dir * 14}px)`, filter: 'blur(2px)' }, { opacity: 1, transform: 'none', filter: 'none' }], { duration: 300, easing: EASE });
    } else if (modeChanged && inner.innerHTML && !reduceMotion()) {
      morph(apply);
      liquid(oldW, oldH);
    } else apply();
    if (!modeChanged) freshNumbers();
  }

  // ------------------------------------------------------------ liquid: the island stretches like a drop
  // Growing, it gets a little taller and thinner first, then settles; shrinking, it squashes.
  function liquid(oldW, oldH) {
    if (S.config.motion === false) return;
    const w = parseFloat(island.style.width) || oldW;
    const h = parseFloat(island.style.height) || oldH;
    const dh = h - oldH;
    const dw = w - oldW;
    if (Math.abs(dh) < 4 && Math.abs(dw) < 8) return;
    const k = Math.min(1, (Math.abs(dh) + Math.abs(dw) / 4) / 160);
    const grow = dh > 0 || (dh === 0 && dw > 0);
    const a = grow ? [1 - 0.035 * k, 1 + 0.06 * k] : [1 + 0.05 * k, 1 - 0.07 * k];
    const b = grow ? [1 + 0.012 * k, 1 - 0.02 * k] : [1 - 0.012 * k, 1 + 0.025 * k];
    island.animate([
      { transform: 'none' },
      { transform: `scale(${a[0]}, ${a[1]})`, offset: 0.32 },
      { transform: `scale(${b[0]}, ${b[1]})`, offset: 0.68 },
      { transform: 'none' },
    ], { duration: 560, easing: 'ease-in-out', composite: 'add' });
  }

  // ------------------------------------------------------------ the sliding highlight behind the chosen tab
  function railOn() {
    const on = inner.querySelector('.rail .tab.on');
    return on ? on.offsetTop : null;
  }
  function placeRailHl(from) {
    const hl = inner.querySelector('.rail-hl');
    const on = inner.querySelector('.rail .tab.on');
    if (!hl || !on) return;
    hl.style.left = on.offsetLeft + 'px';
    hl.style.width = on.offsetWidth + 'px';
    hl.style.height = on.offsetHeight + 'px';
    if (from == null || reduceMotion()) { hl.style.transform = `translateY(${on.offsetTop}px)`; return; }
    hl.animate([{ transform: `translateY(${from}px) scaleY(1)` }, { transform: `translateY(${(from + on.offsetTop) / 2}px) scaleY(1.25)`, offset: 0.45 }, { transform: `translateY(${on.offsetTop}px)` }], { duration: 380, easing: EASE });
    hl.style.transform = `translateY(${on.offsetTop}px)`;
  }

  // ------------------------------------------------------------ numbers that roll
  // Countdowns and the temperature change digit by digit: the new digit slides up into place.
  function rollTo(el, text, prev) {
    if (prev == null || prev === text || reduceMotion() || S.config.motion === false) { el.textContent = text; return; }
    const p = prev.padStart(text.length, ' ');
    const off = p.length - text.length;
    el.replaceChildren(...[...text].map((ch, i) => {
      const sp = document.createElement('span');
      const was = p[i + off];
      sp.className = 'dg' + (was !== ch && /[0-9]/.test(ch) ? ' roll' : '');
      sp.textContent = ch;
      return sp;
    }));
  }
  function setNum(el, text) {
    text = String(text);
    const prev = el.dataset.rv;
    if (prev === text) return;
    el.dataset.rv = text;
    rollTo(el, text, prev);
  }
  Ada.setNum = setNum;
  // numbers drawn as HTML (data-num="key"): compare with the last value seen under that key
  const numMem = {};
  function freshNumbers() {
    inner.querySelectorAll('[data-num]').forEach((el) => {
      const k = el.dataset.num;
      const text = el.dataset.rv || el.textContent;
      if (el.dataset.rv) return;
      el.dataset.rv = text;
      rollTo(el, text, numMem[k]);
      numMem[k] = text;
    });
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
    clearTimeout(bump.t);
    bump.t = setTimeout(() => island.classList.remove('bump'), 560);
  }

  // ------------------------------------------------------------ update card: offer → download → install
  function updateCardHtml(u) {
    const head = (what) => `<div class="card-head"><span class="glyph" data-s="done"></span><span class="proj">Ada ${esc(u.version)}</span><span class="what">${what}</span></div>`;
    if (u.stage === 'downloading') {
      const pct = Math.round((u.pct || 0) * 100);
      return `${head('indiriliyor')}
        <div class="upd-bar" data-region="updbar"><b data-w="${pct}"></b><span>%${pct}</span></div>`;
    }
    if (u.stage === 'installing') {
      return `${head('kuruluyor')}<p class="msg"><span class="spin" aria-hidden="true"></span> Ada birkaç saniye kapanıp yeni sürümle yeniden açılacak.</p>`;
    }
    if (u.stage === 'error') {
      return `${head('güncellenemedi')}<p class="msg">${esc(u.error || '')}</p>
        <div class="actions"><button class="btn-allow sm" data-act="updateInstall">Tekrar dene</button><button class="btn-text sm" data-act="updateOpen">Tarayıcıda indir</button><button class="btn-text sm" data-act="closeCard">Kapat</button></div>`;
    }
    return `${head(u.stage === 'ready' ? 'indirildi, kurulmaya hazır' : 'yeni sürüm hazır')}
      ${u.notes ? `<p class="msg">${esc(u.notes)}</p>` : ''}
      <div class="actions"><button class="btn-allow" data-act="updateInstall">Güncelle</button><button class="btn-text" data-act="updatePage">Yenilikler</button><button class="btn-text" data-act="closeCard">Sonra</button></div>`;
  }

  // ------------------------------------------------------------ event effects
  // Drawn in #fx, a click-through layer around the island: a ring of light, a shine sweep, confetti.
  const fxEl = document.getElementById('fx');
  const COLORS = { done: '#9bd17a', ask: '#f2b544', pomo: '#5cc8c4', class: '#b7a6f2', error: '#f07c6b', music: '#9bd17a' };
  function flash(kind) {
    if (!fxEl || reduceMotion()) return;
    const c = COLORS[kind] || kind;
    // wait one frame so the island already has its new size
    requestAnimationFrame(() => setTimeout(() => {
      const r = island.getBoundingClientRect();
      const ring = document.createElement('div');
      ring.className = 'fx-ring';
      ring.style.left = r.left + 'px';
      ring.style.top = r.top + 'px';
      ring.style.width = r.width + 'px';
      ring.style.height = r.height + 'px';
      ring.style.borderRadius = getComputedStyle(island).borderRadius;
      ring.style.setProperty('--c', c);
      fxEl.appendChild(ring);
      const sy = 1 + 26 / Math.max(30, r.height);
      const sx = 1 + 26 / Math.max(60, r.width);
      ring.animate([
        { transform: 'scale(1)', opacity: 0.95 },
        { transform: `scale(${sx}, ${sy})`, opacity: 0 },
      ], { duration: 820, easing: 'cubic-bezier(.15,.75,.25,1)' }).onfinish = () => ring.remove();
    }, 120));
  }
  function shine() {
    if (reduceMotion()) return;
    const el = document.createElement('div');
    el.className = 'fx-shine';
    island.appendChild(el);
    el.animate([{ transform: 'translateX(-110%)' }, { transform: 'translateX(110%)' }], { duration: 900, delay: 160, easing: 'ease-in-out' })
      .onfinish = () => el.remove();
  }
  function burst(colors = ['#5cc8c4', '#9bd17a', '#f2b544', '#b7a6f2', '#f07c6b']) {
    if (!fxEl || reduceMotion()) return;
    requestAnimationFrame(() => {
      const r = island.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height - 4;
      for (let i = 0; i < 26; i++) {
        const dot = document.createElement('i');
        dot.className = 'fx-dot' + (i % 3 === 0 ? ' sq' : '');
        dot.style.left = cx + 'px';
        dot.style.top = cy + 'px';
        dot.style.background = colors[i % colors.length];
        fxEl.appendChild(dot);
        // a fan downwards and to the sides (the island sits at the top of the screen)
        const a = (Math.PI / 180) * (8 + Math.random() * 164);
        const v = 70 + Math.random() * 110;
        const dx = Math.cos(a) * v * 1.4;
        const dy = Math.sin(a) * v * 0.6;
        const rot = (Math.random() * 540 - 270) | 0;
        dot.animate([
          { transform: 'translate(-50%, -50%) scale(.4)', opacity: 1 },
          { transform: `translate(calc(-50% + ${dx * 0.7}px), calc(-50% + ${dy * 0.7}px)) rotate(${rot / 2}deg) scale(1)`, opacity: 1, offset: 0.45 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 70}px)) rotate(${rot}deg) scale(.8)`, opacity: 0 },
        ], { duration: 1100 + Math.random() * 500, easing: 'cubic-bezier(.2,.6,.4,1)', delay: Math.random() * 90 }).onfinish = () => dot.remove();
      }
    });
  }
  Ada.fx = { flash, shine, burst, bump: () => bump() };
  function activity() { ui.lastActivity = Date.now(); }
  // the edge light turns green for a moment when Claude finishes
  function halo() {
    island.classList.add('halo-done');
    clearTimeout(halo.t);
    halo.t = setTimeout(() => island.classList.remove('halo-done'), 1900);
  }

  // ------------------------------------------------------------ the morning hello
  // "Günaydın Emre · 11° · 2 ders · 1 etkinlik": the first time you sit down each day.
  function greetText(ev, now = new Date()) {
    const h = ev.hour != null ? ev.hour : now.getHours();
    const hi = h < 12 ? 'Günaydın' : h < 18 ? 'İyi günler' : 'İyi akşamlar';
    const bits = [];
    const w = S.mods.weather;
    if (w && w.now) bits.push(`${w.now.temp}°`);
    const dow = (now.getDay() + 6) % 7;
    const classes = ((S.mods.schedule && S.mods.schedule.classes) || []).filter((c) => Number(c.day) === dow).length;
    if (classes) bits.push(`bugün ${classes} ders`);
    const events = ((S.mods.calendar && S.mods.calendar.events) || []).filter((e) => new Date(e.start).toDateString() === now.toDateString()).length;
    if (events) bits.push(`${events} etkinlik`);
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (((S.mods.schedule && S.mods.schedule.exams) || []).some((x) => x.date === iso)) bits.push('sınav günü, başarılar');
    const f = festive(now);
    if (f.day === 'birthday') bits.unshift('iyi ki doğdun');
    if (f.day === 'newyear') bits.unshift('mutlu yıllar');
    return { hi: ev.name ? `${hi} ${ev.name}` : hi, bits };
  }
  Ada.greetText = greetText;
  function greet(ev) {
    const g = greetText(ev);
    const w = S.mods.weather;
    Ada.notice({
      key: 'greet', status: 'done', ms: 6500,
      html: `<div class="pill greet-pill">
        ${lighthouse('done', { ...scene(), wx: '' })}
        <span class="proj">${esc(g.hi)}</span>
        ${g.bits.map((b, i) => `<span class="act">${i === 0 && w && w.now && b === `${w.now.temp}°` ? `<i class="wx-ic sm">${Ada.wxIcon(w.now.kind, w.now.isDay)}</i>` : ''}${esc(b)}</span>`).join('<i class="sep">·</i>')}
      </div>`,
    });
    chime('hello');
    if (festive().day === 'birthday' || festive().day === 'newyear') burst();
    else flash('done');
  }

  // ------------------------------------------------------------ sound
  function chime(kind) {
    // an alarm rings even with sounds turned off: ringing is its whole job
    if (!S.config.sound && kind !== 'alarm') return;
    if (window.AdaSound) window.AdaSound.play(kind, S.config.soundPack || 'klasik');
  }

  // accent: one of the palette colours or Windows' own accent colour (lifted so it reads on dark)
  const ACCENTS = { deniz: '#5cc8c4', gok: '#6aa8f7', lila: '#b7a6f2', mercan: '#f07c6b', fener: '#f2b544', yosun: '#9bd17a', pembe: '#f28cc0' };
  function readable(hex) {
    const m = /^#?([0-9a-f]{6})/i.exec(hex || '');
    if (!m) return null;
    let [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, sat = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    l = Math.max(l, 0.64);
    sat = Math.min(sat, 0.8);
    return `hsl(${Math.round(h * 360)} ${Math.round(sat * 100)}% ${Math.round(l * 100)}%)`;
  }
  function applyBodyConfig(c) {
    document.body.dataset.pos = c.position || 'center';
    document.body.classList.toggle('glass', c.glass !== false);
    document.body.classList.toggle('no-album', c.albumColor === false);
    // "auto": light while Windows uses its light theme, deep blue in dark mode
    const dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.body.dataset.skin = c.skin === 'auto' ? (dark ? 'slate' : 'light') : c.skin || 'slate';
    document.body.classList.toggle('edge-glow', c.edgeGlow !== false);
    document.body.classList.toggle('calm', c.motion === false);
    const acc = c.accent === 'windows' ? readable(c.systemAccent) : ACCENTS[c.accent];
    if (acc) document.documentElement.style.setProperty('--deniz', acc);
    else document.documentElement.style.removeProperty('--deniz');
  }

  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyBodyConfig(S.config));

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
      if (!(Ada.musicPlaying && Ada.musicPlaying()) && !(S.music && S.music.connected)) return;
      ada.call('media', 'transport', dir).then((r) => { const x = r && r.result; if (x && !x.ok) toast({ kind: 'error', text: x.error }); });
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
    island.classList.remove('peek', 'near');
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
  Ada.openTab = (id) => {
    const prev = currentTab();
    if (ui.hovered && prev && prev.id !== id && prev.onLeave) prev.onLeave();
    ui.tab = id;
    if (!ui.hovered) { ui.hovered = true; activity(); }
    const t = currentTab();
    if (t && t.onEnter) t.onEnter();
    render();
  };

  // The cursor coming close: the island leans out a little and its edge lights up.
  let nearNow = false;
  ada.on('island:near', (on) => {
    nearNow = !!on && S.config.motion !== false;
    island.classList.toggle('near', nearNow && !ui.hovered);
  });

  // The main process tells us when the cursor enters or leaves the island (see main.js).
  ui.pointer = false;
  function onPointer(inside) {
    ui.pointer = inside;
    island.classList.toggle('peek', inside && !ui.hovered && S.config.motion !== false);
    if (inside) {
      island.classList.remove('near');
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
    if (act === 'dismiss') {
      if (doneCard && doneCard.replyUntil && !doneCard.desktop) ada.call('claude', 'release', id);
      if (ui.holdOpen) { const a = document.activeElement; if (a && a.blur) a.blur(); }
      ada.dismiss(id); doneCard = null; render(); return;
    }
    if (act === 'qr') { const q = quickFor(doneCard)[Number(id)]; if (q) sendQuickReply(q[1]); return; }
    if (act === 'closeCard') { card = null; render(); return; }
    if (act === 'updateOpen') { ada.call('update', 'open'); card = null; render(); return; }
    if (act === 'updateInstall') { ada.call('update', 'install'); return; }
    if (act === 'updatePage') { ada.call('update', 'page'); return; }
    if (act === 'updatedNotes') { ada.open(id); card = null; render(); return; }
    if (act === 'allow' || act === 'deny' || act === 'ask') {
      ada.decide(id, act);
      S.claude.permissions = S.claude.permissions.filter((p) => p.id !== id);
      render();
      return;
    }
    if (act === 'pick' || act === 'sendAnswers' || act === 'askTerminal') return onAnswer(act, el);
    if (Ada.paletteAct && Ada.paletteAct(act, id)) return;
    for (const fn of actHandlers) if (fn(act, id, el, e) === true) return;
    // let the tab that owns the current view handle it
    for (const t of tabs) {
      if (t.onAct && t.onAct(act, id, el, e) === true) return;
    }
  }

  async function sendQuickReply(text) {
    if (!doneCard || !text.trim()) return;
    const d = doneCard;
    if (ui.holdOpen) { const a = document.activeElement; if (a && a.blur) a.blur(); }
    if (d.desktop) {
      doneCard = null;
      render();
      const r2 = await ada.call('claude', 'desktopReply', text);
      toast(r2.ok && r2.result ? { kind: 'info', text: "Claude Desktop'a gönderildi" } : { kind: 'error', text: 'Claude Desktop penceresi bulunamadı' });
      return;
    }
    const r = await ada.call('claude', 'reply', { sessionId: d.sessionId, text });
    if (r.ok && r.result) {
      doneCard = null;
      toast({ kind: 'info', text: "Claude'a iletildi" });
    } else {
      toast({ kind: 'error', text: 'Süre doldu · yanıtını terminalde yaz' });
      doneCard = null;
    }
    render();
  }
  // typing a reply keeps the session waiting (up to about a minute)
  island.addEventListener('focusin', (e) => {
    if (!e.target.matches('[data-qreply]') || !doneCard) return;
    const d = doneCard;
    if (d.desktop) { d.replyUntil = Date.now() + 120000; d.until = d.replyUntil; return; }
    ada.call('claude', 'hold', d.sessionId).then((r) => {
      if (r.ok && r.result && doneCard === d) { d.replyUntil = r.result; d.until = Math.max(d.until, r.result); }
    });
  });
  island.addEventListener('keydown', (e) => {
    if (!e.target.matches('[data-qreply]')) return;
    if (e.key === 'Enter') { e.preventDefault(); sendQuickReply(e.target.value); }
  });

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
    if (ev.type === 'permission' || ev.type === 'question') { chime('ask'); bump(); flash('ask'); }
    if (ev.type === 'pomodoro') { burst(); flash('pomo'); }
    if (ev.type === 'class') flash('class');
    if (ev.type === 'done') {
      chime('done');
      flash('done');
      shine();
      halo();
      doneCard = {
        id: Date.now(), sessionId: ev.sessionId, project: ev.project, summary: ev.summary, desktop: !!ev.desktop,
        replyUntil: ev.replyUntil || 0, until: Math.max(Date.now() + 7000, ev.replyUntil || 0),
      };
      bump();
    }
    if (ev.type === 'greet') greet(ev);
    if (ev.type === 'update') card = { key: 'update', status: 'done', sticky: true, html: updateCardHtml(ev) };
    if (ev.type === 'updated') {
      card = {
        key: 'updated', status: 'done', until: Date.now() + 9000,
        html: `<div class="card-head"><span class="glyph" data-s="done"></span><span class="proj">Ada ${esc(ev.version)}</span><span class="what">güncellendi</span></div>
          <div class="actions"><button class="btn-allow sm" data-act="updatedNotes" data-id="${esc(ev.page)}">Yenilikler</button><button class="btn-text sm" data-act="closeCard">Kapat</button></div>`,
      };
      flash('done');
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
    for (const fn of eventListeners) fn(ev);
    render();
  });
  ada.on('music:state', (m) => { S.music = m; for (const t of tabs) if (t.onMusic) t.onMusic(m); render(); });
  // the wallpaper's colour under the island: a little of it goes into the island's body, and a light
  // wallpaper gets a deeper shadow so the island still stands out
  function applyWall(w) {
    const root = document.documentElement;
    if (!w) { root.style.removeProperty('--wall'); document.body.classList.remove('wall-tint', 'wall-light'); return; }
    root.style.setProperty('--wall', `rgb(${w.r} ${w.g} ${w.b})`);
    document.body.classList.add('wall-tint');
    document.body.classList.toggle('wall-light', w.lum > 0.45);
  }
  Ada.applyWall = applyWall;

  ada.on('mod:state', ({ mod, data }) => {
    S.mods[mod] = data;
    if (mod === 'wall') applyWall(data);
    if (mod === 'update' && card && card.key === 'update' && data) card.html = updateCardHtml(data);
    for (const t of tabs) if (t.onMod) t.onMod(mod, data);
    render();
  });
  ada.on('island:toast', toast);
  ada.on('island:config', (c) => { S.config = c; applyBodyConfig(c); for (const t of tabs) if (t.onConfig) t.onConfig(c); render(); });
  ada.on('island:expand', () => {
    openPanel();
    setTimeout(() => { if (!island.matches(':hover')) closePanel(); }, 5000);
  });

  // Plugins the user turned on in Settings: their stylesheet and script, from ada-plugin://
  function loadPlugins(list) {
    for (const p of list) {
      if (p.style) {
        const l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = `ada-plugin://${p.id}/${p.style}`;
        document.head.appendChild(l);
      }
      const sc = document.createElement('script');
      sc.src = `ada-plugin://${p.id}/${p.main}`;
      sc.onerror = () => toast({ kind: 'error', text: `Eklenti yüklenemedi: ${p.name}` });
      document.body.appendChild(sc);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    ada.init().then(({ config, state, music, mods }) => {
      if (config) { S.config = config; applyBodyConfig(config); }
      if (state) S.claude = state;
      if (music) S.music = music;
      if (mods) Object.assign(S.mods, mods);
      applyWall(S.mods.wall);
      for (const t of tabs) if (t.init) t.init();
      started = true;
      render();
      loadPlugins((mods && mods.plugins) || []);
    });
  });
})();
