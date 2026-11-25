'use strict';
/* global Ada, ada, AdaCalc, AdaElec, AdaTime */
// Command bar (Ctrl+Alt+Space): the island turns into a search box. Start an app, calculate,
// convert units, set a timer or an alarm, play a song, jot a note, change a setting, open a tab,
// search the web. Arrow keys choose, Enter runs, Esc closes.
(() => {
  const { S, ui, esc, I } = Ada;
  const P = { open: false, q: '', sel: 0, items: [], apps: null, icons: {}, songs: { q: '', items: [], loading: false }, seq: 0 };

  const SEARCH = '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20 20"/></svg>';
  const ICONS = {
    app: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg>',
    calc: '<svg viewBox="0 0 24 24"><rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M8.5 7.5h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/></svg>',
    timer: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2M10 3h4"/></svg>',
    alarm: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2M5 4.5L2.8 6.7M19 4.5l2.2 2.2"/></svg>',
    note: '<svg viewBox="0 0 24 24"><path d="M6 3.5h9l4 4v13H6z"/><path d="M9 11h7M9 15h5"/></svg>',
    web: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z"/></svg>',
    cog: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/></svg>',
    tab: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="14" rx="3"/><path d="M3.5 9.5h17"/></svg>',
    color: '<svg viewBox="0 0 24 24"><path d="M14.5 4.5l5 5-8.5 8.5H6v-5z"/><path d="M12.5 6.5l5 5"/></svg>',
    qr: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM18 14h2M14 18v2"/></svg>',
    weather: '<svg viewBox="0 0 24 24"><path d="M7 18a4 4 0 0 1 0-8 5.5 5.5 0 0 1 10.5 1.5A3.3 3.3 0 0 1 17 18z"/></svg>',
  };

  // ------------------------------------------------------------ matching (Turkish-aware, forgiving)
  const fold = (s) => String(s || '').toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c').normalize('NFD').replace(/[̀-ͯ]/g, '');
  function score(text, q) {
    const t = fold(text);
    const f = fold(q);
    if (!f) return 0;
    if (t === f) return 120;
    if (t.startsWith(f)) return 100 - Math.min(20, t.length - f.length) / 2;
    if (t.split(/[\s\-_.()]+/).some((w) => w.startsWith(f))) return 80;
    if (t.includes(f)) return 60;
    // initials: "vsc" → "Visual Studio Code"
    const initials = t.split(/[\s\-_.]+/).map((w) => w[0]).join('');
    if (initials.startsWith(f)) return 55;
    let i = 0;
    for (const ch of t) if (ch === f[i]) i++;
    return i === f.length ? 25 : 0;
  }

  // ------------------------------------------------------------ built-in commands
  const tabName = (id) => (Ada.tabs.find((t) => t.id === id) || {}).label || id;
  function commands() {
    const c = S.config || {};
    const list = [
      { title: 'Ayarlar', keys: 'ayarlar settings tercihler', icon: 'cog', run: () => ada.openSettings('') },
      { title: c.skin === 'black' ? 'Tema: gece mavisi' : 'Tema: siyah', keys: 'tema siyah koyu mavi gorunum theme', icon: 'cog', run: () => ada.call('palette', 'set', { skin: c.skin === 'black' ? 'slate' : 'black' }) },
      { title: 'Sesi kapat / aç', keys: 'sessiz mute ses kapat', icon: 'cog', run: () => ada.call('volume', 'toggleMute') },
      { title: 'Pomodoro başlat / duraklat', keys: 'pomodoro odak focus calis', icon: 'timer', run: () => ada.call('pomodoro', 'toggle') },
      { title: 'Kronometre başlat / duraklat', keys: 'kronometre stopwatch', icon: 'timer', run: () => ada.call('stopwatch', 'toggle') },
      { title: 'Renk seç (ekrandan)', keys: 'renk sec renk secici color picker hex', icon: 'color', run: () => setTimeout(() => ada.call('picker', 'color'), 250) },
      { title: 'Panodaki metni QR kod yap', keys: 'qr karekod qr kod', icon: 'qr', run: () => ada.call('qr', 'make', '') },
      { title: 'Hava durumu', keys: 'hava durumu weather sicaklik', icon: 'weather', run: () => Ada.openTab('system') },
      { title: 'Adayı gizle', keys: 'gizle hide sakla', icon: 'cog', run: () => ada.call('palette', 'hide') },
      { title: 'Tanı raporu oluştur', keys: 'tani raporu sorun giderme diagnostics', icon: 'cog', run: () => ada.call('palette', 'diag') },
      { title: 'Güncellemeleri denetle', keys: 'guncelleme update surum', icon: 'cog', run: () => ada.call('update', 'check').then((r) => Ada.toast({ kind: 'info', text: r.ok && r.result && r.result.version ? `Ada ${r.result.version} hazır` : 'En son sürümü kullanıyorsun' })) },
    ];
    for (const t of Ada.tabs) list.push({ title: `${t.label} sekmesini aç`, keys: `${t.label} sekme tab ${t.id}`, icon: 'tab', run: () => Ada.openTab(t.id) });
    return list;
  }

  // ------------------------------------------------------------ results for the current text
  function build(q) {
    const items = [];
    const text = q.trim();
    if (!text) {
      return [
        { kind: 'hint', title: 'Uygulama adı yaz ya da:', sub: '“12*4.7k” hesap · “15 dk çay” sayaç · “7:30” alarm · “çal …” şarkı · “not …” not · “g …” web' },
        ...commands().slice(0, 5).map((c) => ({ ...c, kind: 'cmd' })),
      ];
    }
    const low = fold(text);

    // prefixed commands
    let m;
    if ((m = /^(çal|cal|play|şarkı|sarki)\s+(.+)$/i.exec(text))) {
      return songItems(m[2]);
    }
    if ((m = /^(not|note)\s+(.+)$/i.exec(text))) {
      return [{ kind: 'note', icon: 'note', title: `Nota ekle: ${m[2]}`, sub: 'Araçlar → Not', run: () => ada.call('palette', 'note', m[2]).then(() => Ada.toast({ kind: 'info', text: 'Nota eklendi' })) }];
    }
    if ((m = /^(g|google|ara|web)\s+(.+)$/i.exec(text))) {
      return [{ kind: 'web', icon: 'web', title: `Google'da ara: ${m[2]}`, run: () => ada.call('palette', 'web', m[2]) }];
    }
    if ((m = /^(qr|karekod)\s+(.+)$/i.exec(text))) {
      return [{ kind: 'qr', icon: 'qr', title: `QR kod: ${m[2]}`, run: () => ada.call('qr', 'make', m[2]) }];
    }
    if ((m = /^(ses|volume)\s+(\d{1,3})$/i.exec(text))) {
      const v = Math.min(100, Number(m[2]));
      return [{ kind: 'cmd', icon: 'cog', title: `Bilgisayar sesi %${v}`, run: () => ada.call('volume', 'set', v) }];
    }

    // timer / alarm
    const tm = AdaTime.parse(text);
    if (tm) {
      const what = tm.kind === 'alarm' ? `Alarm kur · ${new Date(tm.at).toTimeString().slice(0, 5)}${new Date(tm.at).getDate() !== new Date().getDate() ? ' (yarın)' : ''}` : `Sayaç başlat · ${AdaTime.human(tm.ms)}`;
      items.push({ kind: 'timer', icon: tm.kind === 'alarm' ? 'alarm' : 'timer', title: what + (tm.label ? ` · ${tm.label}` : ''), sub: 'Enter', score: tm.guess ? 40 : 200, run: () => Ada.addTimer(text) });
    }

    // calculator
    if (/[\d)]/.test(text) && /[-+*/^%()|√]|\b(sin|cos|tan|log|ln|sqrt|pi)\b/i.test(text)) {
      try {
        const v = AdaCalc.evaluate(text, null);
        if (v != null) {
          const plain = AdaCalc.plain(v);
          const pretty = AdaCalc.si(v);
          const shown = pretty !== plain && /[a-zµ]$/i.test(pretty) ? `${plain}  (${pretty})` : plain;
          items.push({ kind: 'calc', icon: 'calc', title: `= ${shown}`, sub: 'Enter: kopyala', score: 190, run: () => ada.call('palette', 'copy', plain).then(() => Ada.toast({ kind: 'info', text: `Kopyalandı · ${plain}` })) });
        }
      } catch { /* not an expression */ }
    }
    // unit conversion ("20dBm", "22AWG", "4k7")
    if (/^-?\d/.test(text)) {
      for (const row of AdaElec.convert(text).slice(0, 3)) {
        items.push({ kind: 'calc', icon: 'calc', title: `${row.v}`, sub: `${row.k} · Enter: kopyala`, score: 150, run: () => ada.call('palette', 'copy', row.v).then(() => Ada.toast({ kind: 'info', text: `Kopyalandı · ${row.v}` })) });
      }
    }

    // apps
    for (const name of P.apps || []) {
      const s = score(name, text);
      if (s >= 25) items.push({ kind: 'app', icon: 'app', app: name, title: name, sub: 'Uygulama', score: s + 5, run: () => ada.call('palette', 'launch', name) });
    }
    // commands and tabs
    for (const c of commands()) {
      const s = Math.max(score(c.title, text), score(c.keys, text) - 5);
      if (s >= 55) items.push({ ...c, kind: 'cmd', score: s });
    }

    items.sort((a, b) => (b.score || 0) - (a.score || 0));
    const top = items.slice(0, 7);
    if (S.music && S.music.connected && !(top[0] && top[0].score >= 150)) top.push({ kind: 'song-search', icon: 'note', title: `Spotify'da ara: ${text}`, sub: 'Tab', score: 1, run: () => { setQuery(`çal ${text}`); return 'keep'; } });
    top.push({ kind: 'web', icon: 'web', title: `Google'da ara: ${text}`, score: 0, run: () => ada.call('palette', 'web', text) });
    if (low.length > 2 && !items.length && !tm) top.unshift({ kind: 'note', icon: 'note', title: `Nota ekle: ${text}`, sub: 'not …', run: () => ada.call('palette', 'note', text).then(() => Ada.toast({ kind: 'info', text: 'Nota eklendi' })) });
    return top;
  }

  function songItems(q) {
    if (!(S.music && S.music.connected)) return [{ kind: 'hint', title: 'Spotify bağlı değil', sub: 'Ayarlar → Spotify' }];
    if (P.songs.q !== q) {
      P.songs = { q, items: [], loading: true };
      const seq = ++P.seq;
      setTimeout(async () => {
        if (seq !== P.seq || !P.open) return;
        const r = await ada.call('spotify', 'search', q);
        if (seq !== P.seq) return;
        const tracks = (r.ok && r.result && (r.result.tracks || r.result)) || [];
        P.songs = { q, items: Array.isArray(tracks) ? tracks.slice(0, 7) : [], loading: false };
        refresh();
      }, 280);
    }
    if (P.songs.loading) return [{ kind: 'hint', title: `“${q}” aranıyor…` }];
    if (!P.songs.items.length) return [{ kind: 'hint', title: 'Şarkı bulunamadı' }];
    return P.songs.items.map((t) => ({
      kind: 'song', title: t.name, sub: `${t.artists || ''}${t.album ? ' · ' + t.album : ''}`, img: t.coverSmall || t.cover || '',
      run: () => ada.call('palette', 'play', { uri: t.uri, albumUri: t.albumUri || '' }).then((r) => { const x = r && r.result; if (x && !x.ok && x.error) Ada.toast({ kind: 'error', text: x.error }); }),
    }));
  }

  // ------------------------------------------------------------ view
  function rowHtml(it, i) {
    if (it.kind === 'hint') return `<div class="pal-row hint"><span class="pal-t">${esc(it.title)}</span>${it.sub ? `<span class="pal-s">${esc(it.sub)}</span>` : ''}</div>`;
    const icon = it.img ? `<img class="pal-ic img" src="${esc(it.img)}" alt="">`
      : it.app && P.icons[it.app] ? `<img class="pal-ic img" src="${esc(P.icons[it.app])}" alt="">`
        : `<span class="pal-ic">${ICONS[it.icon] || ICONS.app}</span>`;
    return `<div class="pal-row ${i === P.sel ? 'sel' : ''}" data-act="pal:run" data-id="${i}">
      ${icon}<span class="pal-t">${esc(it.title)}</span>${it.sub ? `<span class="pal-s">${esc(it.sub)}</span>` : ''}
    </div>`;
  }
  function listHtml() {
    const runnable = P.items.filter((x) => x.kind !== 'hint');
    if (P.sel >= runnable.length) P.sel = Math.max(0, runnable.length - 1);
    let n = -1;
    return P.items.map((it) => (it.kind === 'hint' ? rowHtml(it, -1) : rowHtml(it, ++n))).join('');
  }
  function view() {
    return {
      mode: 'palette', key: 'palette', status: 'idle',
      html: `<div class="pal-box">
        <div class="pal-in">${SEARCH}<input type="text" data-palin="1" placeholder="Ara ya da yaz: uygulama, 12*4.7k, 15 dk, çal …, not …" spellcheck="false" autocomplete="off" aria-label="Komut çubuğu"><kbd>Esc</kbd></div>
        <div class="pal-list" data-region="pal-list">${listHtml()}</div>
      </div>`,
    };
  }
  Ada.paletteView = () => (P.open ? view() : null);

  function refresh() {
    P.items = build(P.q);
    Ada.render();
    // fetch icons of visible apps
    for (const it of P.items) {
      if (it.app && !(it.app in P.icons)) {
        P.icons[it.app] = '';
        ada.call('palette', 'icon', it.app).then((r) => { if (r.ok && r.result) { P.icons[it.app] = r.result; if (P.open) Ada.render(); } });
      }
    }
  }
  function setQuery(q) {
    P.q = q;
    P.sel = 0;
    const input = Ada.$('[data-palin]');
    if (input && input.value !== q) input.value = q;
    refresh();
  }

  // ------------------------------------------------------------ open / close / keys
  function open() {
    if (P.open) { const i = Ada.$('[data-palin]'); if (i) i.select(); return; }
    P.open = true;
    P.q = '';
    P.sel = 0;
    ui.holdOpen = true;
    ada.hold(true);
    ada.focusable(true);
    if (!P.apps) ada.call('palette', 'apps').then((r) => { if (r.ok) { P.apps = r.result || []; if (P.open) refresh(); } });
    P.items = build('');
    Ada.render();
    const focus = (n) => setTimeout(() => {
      const i = Ada.$('[data-palin]');
      if (i) { i.focus(); i.select(); } else if (n > 0) focus(n - 1);
    }, 60);
    focus(8);
  }
  function close() {
    if (!P.open) return;
    P.open = false;
    P.seq++;
    const a = document.activeElement;
    ui.holdOpen = false;
    if (a && a.blur) a.blur();
    ada.focusable(false);
    ada.hold(false);
    Ada.render();
    Ada.afterPointerAction();
  }
  Ada.palette = { open, close, get open_() { return P.open; } };

  function runnable() { return P.items.filter((x) => x.kind !== 'hint'); }
  async function run(i) {
    const it = runnable()[i];
    if (!it || !it.run) return;
    const keep = await it.run();
    if (keep !== 'keep') close();
  }

  ada.on('island:palette', () => open());
  Ada.island.addEventListener('input', (e) => {
    if (!e.target.matches('[data-palin]')) return;
    P.q = e.target.value;
    P.sel = 0;
    refresh();
  });
  Ada.island.addEventListener('keydown', (e) => {
    if (!P.open || !e.target.matches('[data-palin]')) return;
    const n = runnable().length;
    if (e.key === 'ArrowDown') { e.preventDefault(); P.sel = (P.sel + 1) % Math.max(1, n); Ada.render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); P.sel = (P.sel - 1 + Math.max(1, n)) % Math.max(1, n); Ada.render(); }
    else if (e.key === 'Enter') { e.preventDefault(); run(P.sel); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Tab') {
      e.preventDefault();
      const it = runnable()[P.sel];
      if (it && it.kind === 'song-search') run(P.sel);
      else if (it && it.app) setQuery(it.app);
    }
  }, true);
  // clicking elsewhere (another window) closes it
  window.addEventListener('blur', () => { if (P.open) setTimeout(() => { if (!document.hasFocus()) close(); }, 120); });
  Ada.paletteAct = (act, id) => {
    if (act !== 'pal:run') return false;
    run(Number(id));
    return true;
  };
})();
