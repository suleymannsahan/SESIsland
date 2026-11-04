'use strict';
/* global ada */
(() => {
  const $ = (id) => document.getElementById(id);
  const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
  let schedule = { classes: [], exams: [] };

  const msg = (el, text, kind) => { el.textContent = text || ''; el.className = 'msg ' + (kind || ''); };

  // ------------------------------------------------------------ spotify
  function showSpotify(st) {
    $('redirect').textContent = st.redirectUri;
    $('sp-badge').textContent = st.connected ? (st.needsReauth ? 'Yeniden bağlan' : 'Bağlı') : 'Bağlı değil';
    $('sp-badge').classList.toggle('ok', st.connected && !st.needsReauth);
    $('sp-reauth').hidden = !(st.connected && st.needsReauth);
    $('sp-connected').hidden = !st.connected;
    $('sp-setup').hidden = st.connected;
    if (st.clientId && !$('client-id').value) $('client-id').value = st.clientId;
    if (st.connected) loadPlaylists();
  }

  async function connect() {
    const id = $('client-id').value.trim();
    if (!id) { msg($('sp-msg'), 'Önce Client ID\'yi yapıştır.', 'err'); $('client-id').focus(); return; }
    $('sp-connect').disabled = true;
    msg($('sp-msg'), 'Tarayıcıda Spotify açılıyor… Orada "Agree"ye bas.');
    const r = await ada.spotifyConnect(id);
    $('sp-connect').disabled = false;
    if (!r.ok) msg($('sp-msg'), r.error, 'err');
  }

  $('sp-connect').addEventListener('click', connect);
  $('client-id').addEventListener('keydown', (e) => { if (e.key === 'Enter') connect(); });
  $('sp-reconnect').addEventListener('click', async () => { $('sp-connected').hidden = true; $('sp-setup').hidden = false; await connect(); });
  $('sp-disconnect').addEventListener('click', () => ada.spotifyDisconnect());
  $('copy-redirect').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('redirect').textContent);
      $('copy-redirect').textContent = 'Kopyalandı';
      setTimeout(() => { $('copy-redirect').textContent = 'Kopyala'; }, 1500);
    } catch { /* select manually */ }
  });
  document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => ada.open(b.dataset.open)));

  // ------------------------------------------------------------ pomodoro
  let plLoaded = false;
  async function loadPlaylists(selected) {
    if (plLoaded) return;
    const r = await ada.spotifyPlaylists();
    if (!r.ok) { msg($('po-pl-msg'), 'Playlistler yüklenemedi: ' + r.error, 'err'); return; }
    plLoaded = true;
    const sel = $('po-musicUri');
    const cur = selected ?? sel.value;
    for (const p of r.items) {
      const o = document.createElement('option');
      o.value = p.uri;
      o.textContent = p.name;
      sel.appendChild(o);
    }
    sel.value = cur;
  }

  function showPomodoro(p) {
    ['focusMin', 'shortMin', 'longMin', 'longEvery'].forEach((k) => { $('po-' + k).value = p[k]; });
    ['autoNext', 'quietFocus', 'musicOnFocus', 'pauseOnBreak'].forEach((k) => { $('po-' + k).checked = !!p[k]; });
    const sel = $('po-musicUri');
    if (p.musicUri && ![...sel.options].some((o) => o.value === p.musicUri)) {
      const o = document.createElement('option');
      o.value = p.musicUri;
      o.textContent = 'Seçili liste';
      sel.appendChild(o);
    }
    sel.value = p.musicUri || '';
  }

  ['focusMin', 'shortMin', 'longMin', 'longEvery'].forEach((k) => {
    $('po-' + k).addEventListener('change', (e) => ada.call('pomodoro', 'settings', { [k]: Number(e.target.value) }));
  });
  ['autoNext', 'quietFocus', 'musicOnFocus', 'pauseOnBreak'].forEach((k) => {
    $('po-' + k).addEventListener('change', (e) => ada.call('pomodoro', 'settings', { [k]: e.target.checked }));
  });
  $('po-musicUri').addEventListener('change', (e) => ada.call('pomodoro', 'settings', { musicUri: e.target.value }));

  // ------------------------------------------------------------ schedule editor
  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    children.forEach((c) => n.appendChild(c));
    return n;
  }

  function renderClasses() {
    const box = $('classes');
    box.textContent = '';
    if (!schedule.classes.length) box.appendChild(el('p', { class: 'fine empty-t', text: 'Henüz ders yok.' }));
    schedule.classes
      .map((c, i) => ({ c, i }))
      .sort((a, b) => a.c.day - b.c.day || String(a.c.start).localeCompare(String(b.c.start)))
      .forEach(({ c, i }) => {
        const day = el('select', { 'aria-label': 'Gün', onchange: (e) => { c.day = Number(e.target.value); } },
          DAYS.map((d, k) => el('option', { value: String(k + 1), text: d })));
        day.value = String(c.day || 1);
        box.appendChild(el('div', { class: 'tr', role: 'row' }, [
          day,
          el('input', { type: 'time', value: c.start || '', 'aria-label': 'Başlangıç', oninput: (e) => { c.start = e.target.value; } }),
          el('input', { type: 'time', value: c.end || '', 'aria-label': 'Bitiş', oninput: (e) => { c.end = e.target.value; } }),
          el('input', { type: 'text', value: c.name || '', placeholder: 'Ders adı', 'aria-label': 'Ders adı', oninput: (e) => { c.name = e.target.value; } }),
          el('input', { type: 'text', class: 'room', value: c.room || '', placeholder: 'Derslik', 'aria-label': 'Derslik', oninput: (e) => { c.room = e.target.value; } }),
          el('button', { class: 'ghost sm x', title: 'Sil', 'aria-label': 'Dersi sil', text: '×', onclick: () => { schedule.classes.splice(i, 1); renderClasses(); } }),
        ]));
      });
  }

  function renderExams() {
    const box = $('exams');
    box.textContent = '';
    if (!schedule.exams.length) box.appendChild(el('p', { class: 'fine empty-t', text: 'Henüz sınav yok.' }));
    schedule.exams
      .map((x, i) => ({ x, i }))
      .sort((a, b) => String(a.x.date).localeCompare(String(b.x.date)))
      .forEach(({ x, i }) => {
        box.appendChild(el('div', { class: 'tr ex', role: 'row' }, [
          el('input', { type: 'date', value: x.date || '', 'aria-label': 'Tarih', oninput: (e) => { x.date = e.target.value; } }),
          el('input', { type: 'time', value: x.time || '', 'aria-label': 'Saat', oninput: (e) => { x.time = e.target.value; } }),
          el('input', { type: 'text', value: x.name || '', placeholder: 'Sınav adı', 'aria-label': 'Sınav adı', oninput: (e) => { x.name = e.target.value; } }),
          el('button', { class: 'ghost sm x', title: 'Sil', 'aria-label': 'Sınavı sil', text: '×', onclick: () => { schedule.exams.splice(i, 1); renderExams(); } }),
        ]));
      });
  }

  $('add-class').addEventListener('click', () => {
    const lastDay = schedule.classes.length ? schedule.classes[schedule.classes.length - 1].day : 1;
    schedule.classes.push({ day: lastDay, start: '09:00', end: '10:50', name: '', room: '' });
    renderClasses();
    const inputs = $('classes').querySelectorAll('input[placeholder="Ders adı"]');
    inputs[inputs.length - 1]?.focus();
  });
  $('add-exam').addEventListener('click', () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    schedule.exams.push({ date: d.toISOString().slice(0, 10), time: '', name: '' });
    renderExams();
  });
  $('save-schedule').addEventListener('click', async () => {
    const r = await ada.call('schedule', 'set', schedule);
    if (r.ok) {
      schedule = JSON.parse(JSON.stringify(r.result));
      renderClasses();
      renderExams();
      msg($('de-msg'), 'Kaydedildi', 'ok');
      setTimeout(() => msg($('de-msg'), ''), 2500);
    } else msg($('de-msg'), r.error, 'err');
  });

  // ------------------------------------------------------------ simple options
  const set = (patch) => ada.setSettings(patch);
  ['sound', 'notifications', 'desktopWatcher', 'loginAtStart', 'hideFullscreen', 'sleepy', 'albumColor', 'shortcuts', 'clipboard', 'translateLyrics'].forEach((k) => {
    $('opt-' + k).addEventListener('change', async (e) => {
      await set({ [k]: e.target.checked });
      if (k === 'shortcuts') refreshShortcuts();
    });
  });
  document.querySelectorAll('input[name="position"]').forEach((r) => r.addEventListener('change', (e) => set({ position: e.target.value })));
  $('opt-display').addEventListener('change', (e) => set({ display: Number(e.target.value) }));
  $('opt-scale').addEventListener('input', (e) => { $('scale-v').textContent = `%${Math.round(e.target.value * 100)}`; });
  $('opt-scale').addEventListener('change', (e) => set({ scale: Number(e.target.value) }));
  $('opt-classReminder').addEventListener('change', (e) => set({ classReminder: Number(e.target.value) }));
  $('sum-on').addEventListener('change', (e) => {
    $('opt-summaryTime').disabled = !e.target.checked;
    set({ summaryTime: e.target.checked ? ($('opt-summaryTime').value || '21:30') : '' });
  });
  $('opt-summaryTime').addEventListener('change', (e) => { if ($('sum-on').checked) set({ summaryTime: e.target.value }); });
  $('opt-updateRepo').addEventListener('change', (e) => set({ updateRepo: e.target.value.trim() }));
  $('check-update').addEventListener('click', async () => {
    await set({ updateRepo: $('opt-updateRepo').value.trim() });
    msg($('up-msg'), 'Kontrol ediliyor…');
    const r = await ada.call('update', 'check');
    if (!r.ok) msg($('up-msg'), r.error, 'err');
    else if (r.result && r.result.version) msg($('up-msg'), `Ada ${r.result.version} hazır. Adadaki kartta İndir'e bas.`, 'ok');
    else msg($('up-msg'), $('opt-updateRepo').value.trim() ? 'En son sürümü kullanıyorsun.' : 'Önce depo adını yaz.', '');
  });

  function showShortcuts(list) {
    const box = $('shortcut-list');
    box.textContent = '';
    if (!list.length) { box.appendChild(el('p', { class: 'fine', text: 'Kısayollar kapalı.' })); return; }
    list.forEach((s) => box.appendChild(el('div', { class: 'sc' + (s.ok ? '' : ' bad') }, [
      el('kbd', { text: s.acc.replace(/\+/g, ' + ').replace('Space', 'Boşluk').replace('Right', '→').replace('Left', '←').replace('Up', '↑').replace('Down', '↓') }),
      el('span', { text: s.label + (s.ok ? '' : ' · başka bir uygulama kullanıyor') }),
    ])));
  }
  async function refreshShortcuts() {
    const s = await ada.settings();
    showShortcuts(s.shortcuts || []);
  }

  // ------------------------------------------------------------ events
  ada.on('settings:spotify', (st) => { showSpotify(st); if (st.connected) msg($('sp-msg'), ''); });
  ada.on('settings:login', (r) => msg($('sp-msg'), r.ok ? 'Spotify bağlandı.' : 'Bağlantı başarısız: ' + r.error, r.ok ? 'ok' : 'err'));
  ada.on('settings:section', (s) => { if (s) $(s)?.scrollIntoView({ behavior: 'smooth' }); });

  ada.settings().then((s) => {
    $('version').textContent = 'Ada ' + s.version;
    const c = s.config;
    showSpotify(s.spotify);
    showPomodoro(s.pomodoro || {});
    if (s.spotify.connected) loadPlaylists(s.pomodoro && s.pomodoro.musicUri);
    schedule = JSON.parse(JSON.stringify(s.schedule || { classes: [], exams: [] }));
    renderClasses();
    renderExams();
    ['sound', 'notifications', 'desktopWatcher', 'hideFullscreen', 'sleepy', 'albumColor', 'shortcuts', 'clipboard', 'translateLyrics'].forEach((k) => { $('opt-' + k).checked = !!c[k]; });
    $('opt-loginAtStart').checked = !!s.loginAtStart;
    document.querySelectorAll('input[name="position"]').forEach((r) => { r.checked = r.value === (c.position || 'center'); });
    const ds = $('opt-display');
    (s.displays || []).forEach((d) => ds.appendChild(el('option', { value: String(d.i), text: d.label })));
    ds.value = String(c.display || 0);
    $('opt-scale').value = c.scale || 1;
    $('scale-v').textContent = `%${Math.round((c.scale || 1) * 100)}`;
    $('opt-classReminder').value = String(c.classReminder ?? 10);
    $('sum-on').checked = !!c.summaryTime;
    $('opt-summaryTime').value = c.summaryTime || '21:30';
    $('opt-summaryTime').disabled = !c.summaryTime;
    $('opt-updateRepo').value = c.updateRepo || '';
    showShortcuts(s.shortcuts || []);
    const q = new URLSearchParams(location.search).get('section');
    if (q) setTimeout(() => $(q)?.scrollIntoView(), 50);
  });
})();
