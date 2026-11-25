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

  // the editor marks the save bar until "Kaydet" and redraws the week as you type
  function dirty(on = true) {
    document.querySelector('.savebar').classList.toggle('dirty', on);
    if (on) msg($('de-msg'), 'Kaydedilmemiş değişiklikler var');
    renderWeek();
  }
  $('ders').addEventListener('input', (e) => { if (e.target.closest('#classes, #exams')) dirty(); });
  $('ders').addEventListener('change', (e) => { if (e.target.closest('#classes, #exams')) dirty(); });

  // ------------------------------------------------------------ the week at a glance
  const SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  const toMin = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
  const hue = (name) => { let h = 0; for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
  const PALETTE = ['#5cc8c4', '#6aa8f7', '#b7a6f2', '#f28cc0', '#f07c6b', '#f2b544', '#9bd17a', '#7fd0f0'];
  function renderWeek() {
    const box = $('week');
    box.textContent = '';
    const list = schedule.classes.filter((c) => c.name && toMin(c.start) != null);
    if (!list.length) { box.style.removeProperty('--days'); box.appendChild(el('p', { class: 'week-empty', text: 'Ders ekleyince haftan burada görünür.' })); $('week-sum').textContent = ''; return; }
    const lastDay = Math.max(5, ...list.map((c) => Number(c.day) || 1));
    box.style.setProperty('--days', lastDay);
    const from = Math.floor(Math.min(...list.map((c) => toMin(c.start))) / 60) * 60;
    const to = Math.ceil(Math.max(...list.map((c) => toMin(c.end) ?? toMin(c.start) + 50)) / 60) * 60;
    const PX = 0.85;                       // pixels per minute
    const H = (to - from) * PX;
    const today = ((new Date().getDay() + 6) % 7) + 1;
    box.appendChild(el('span'));
    for (let d = 1; d <= lastDay; d++) box.appendChild(el('span', { class: 'wd' + (d === today ? ' today' : ''), text: SHORT[d - 1] }));
    const hours = el('div', { class: 'hours' });
    hours.style.height = H + 'px';
    for (let m = from; m <= to; m += 60) { const sp = el('span', { text: `${String(m / 60).padStart(2, '0')}:00` }); sp.style.top = (m - from) * PX + 'px'; hours.appendChild(sp); }
    box.appendChild(hours);
    const names = [...new Set(list.map((c) => c.name.trim().toLowerCase()))].sort();
    for (let d = 1; d <= lastDay; d++) {
      const col = el('div', { class: 'col' + (d === today ? ' today' : '') });
      col.style.height = H + 'px';
      for (let m = from + 60; m < to; m += 60) { const ln = el('i', { class: 'line' }); ln.style.top = (m - from) * PX + 'px'; col.appendChild(ln); }
      for (const c of list.filter((x) => Number(x.day) === d)) {
        const a0 = toMin(c.start);
        const a1 = toMin(c.end) ?? a0 + 50;
        const blk = el('div', { class: 'blk', title: `${c.name}\n${c.start}–${c.end || ''}${c.room ? ' · ' + c.room : ''}` }, [
          el('b', { text: c.name }),
          el('small', { text: `${c.start}–${c.end || ''}${c.room ? ' · ' + c.room.split('·')[0].trim() : ''}` }),
        ]);
        blk.style.top = (a0 - from) * PX + 1 + 'px';
        blk.style.height = Math.max(18, (a1 - a0) * PX - 2) + 'px';
        blk.style.setProperty('--c', PALETTE[names.indexOf(c.name.trim().toLowerCase()) % PALETTE.length]);
        // a click shows the class in the list below
        blk.addEventListener('click', () => {
          const i = schedule.classes.indexOf(c);
          const row = $('classes').querySelector(`[data-i="${i}"]`);
          if (!row) return;
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          row.classList.remove('hl'); void row.offsetWidth; row.classList.add('hl');
          row.querySelector('input[type="text"]')?.focus();
        });
        col.appendChild(blk);
      }
      if (d === today) {
        const n = new Date();
        const nm = n.getHours() * 60 + n.getMinutes();
        if (nm > from && nm < to) { const ln = el('i', { class: 'now' }); ln.style.top = (nm - from) * PX + 'px'; col.appendChild(ln); }
      }
      box.appendChild(col);
    }
    const mins = list.reduce((t, c) => t + Math.max(0, (toMin(c.end) ?? toMin(c.start) + 50) - toMin(c.start)), 0);
    $('week-sum').textContent = `${names.length} ders · haftada ${Math.round(mins / 60)} saat`;
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
        box.appendChild(el('div', { class: 'tr', role: 'row', 'data-i': String(i) }, [
          day,
          el('input', { type: 'time', value: c.start || '', 'aria-label': 'Başlangıç', oninput: (e) => { c.start = e.target.value; } }),
          el('input', { type: 'time', value: c.end || '', 'aria-label': 'Bitiş', oninput: (e) => { c.end = e.target.value; } }),
          el('input', { type: 'text', value: c.name || '', placeholder: 'Ders adı', 'aria-label': 'Ders adı', oninput: (e) => { c.name = e.target.value; } }),
          el('input', { type: 'text', class: 'room', value: c.room || '', placeholder: 'Derslik', 'aria-label': 'Derslik', oninput: (e) => { c.room = e.target.value; } }),
          el('button', { class: 'ghost sm x', title: 'Sil', 'aria-label': 'Dersi sil', text: '×', onclick: () => { schedule.classes.splice(i, 1); renderClasses(); dirty(); } }),
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
          el('button', { class: 'ghost sm x', title: 'Sil', 'aria-label': 'Sınavı sil', text: '×', onclick: () => { schedule.exams.splice(i, 1); renderExams(); dirty(); } }),
        ]));
      });
  }

  $('add-class').addEventListener('click', () => {
    const lastDay = schedule.classes.length ? schedule.classes[schedule.classes.length - 1].day : 1;
    schedule.classes.push({ day: lastDay, start: '09:00', end: '10:50', name: '', room: '' });
    renderClasses();
    dirty();
    const inputs = $('classes').querySelectorAll('input[placeholder="Ders adı"]');
    inputs[inputs.length - 1]?.focus();
  });
  $('add-exam').addEventListener('click', () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    schedule.exams.push({ date: d.toISOString().slice(0, 10), time: '', name: '' });
    renderExams();
    dirty();
  });
  // a schedule file: { classes: [{ day 1–7, start, end, name, room }], exams: [{ date, time, name }] }
  $('import-schedule').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const classes = Array.isArray(data.classes) ? data.classes : Array.isArray(data) ? data : null;
      if (!classes) throw new Error('Bu dosyada ders listesi yok');
      const keep = schedule.classes.length && !confirm(`Şu anki ${schedule.classes.length} dersin yerine dosyadaki ${classes.length} ders gelsin mi?\n\n"İptal" dersem dosyadakiler mevcutların yanına eklenir.`);
      schedule.classes = [...(keep ? schedule.classes : []), ...classes.map((c) => ({ day: Number(c.day) || 1, start: c.start || '', end: c.end || '', name: c.name || '', room: c.room || '' }))];
      if (Array.isArray(data.exams)) schedule.exams = [...schedule.exams, ...data.exams.map((x) => ({ date: x.date || '', time: x.time || '', name: x.name || '' }))];
      renderClasses();
      renderExams();
      dirty();
      msg($('de-msg'), `${classes.length} ders yüklendi · Kaydet'e bas`, 'ok');
    } catch (err) {
      msg($('de-msg'), 'Dosya okunamadı: ' + (err.message || err), 'err');
    }
  });
  $('export-schedule').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ classes: schedule.classes.map(({ id, ...c }) => c), exams: schedule.exams.map(({ id, ...x }) => x) }, null, 2)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: 'ada-ders-programi.json' });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  });

  $('save-schedule').addEventListener('click', async () => {
    const r = await ada.call('schedule', 'set', schedule);
    if (r.ok) {
      schedule = JSON.parse(JSON.stringify(r.result));
      renderClasses();
      renderExams();
      dirty(false);
      msg($('de-msg'), 'Kaydedildi', 'ok');
      setTimeout(() => msg($('de-msg'), ''), 2500);
    } else msg($('de-msg'), r.error, 'err');
  });

  // ------------------------------------------------------------ simple options
  const set = (patch) => ada.setSettings(patch);
  ['sound', 'notifications', 'desktopWatcher', 'loginAtStart', 'hideFullscreen', 'sleepy', 'glass', 'albumColor', 'shortcuts', 'clipboard', 'translateLyrics', 'visualizer', 'privacyDots', 'deviceCards', 'media', 'weatherRest', 'autoUpdate', 'motion', 'edgeGlow', 'wallTint', 'fenerMoods', 'seasons', 'greeting'].forEach((k) => {
    $('opt-' + k).addEventListener('change', async (e) => {
      await set({ [k]: e.target.checked });
      if (k === 'shortcuts') refreshShortcuts();
    });
  });
  document.querySelectorAll('input[name="position"]').forEach((r) => r.addEventListener('change', (e) => set({ position: e.target.value })));
  $('opt-display').addEventListener('change', (e) => set({ display: Number(e.target.value) }));
  function syncSize(v) {
    $('scale-v').textContent = `%${Math.round(v * 100)}`;
    document.querySelectorAll('input[name="size"]').forEach((r) => { r.checked = Math.abs(Number(r.value) - v) < 0.01; });
  }
  $('opt-scale').addEventListener('input', (e) => syncSize(Number(e.target.value)));
  $('opt-scale').addEventListener('change', (e) => set({ scale: Number(e.target.value) }));
  document.querySelectorAll('input[name="size"]').forEach((r) => r.addEventListener('change', (e) => {
    $('opt-scale').value = e.target.value;
    syncSize(Number(e.target.value));
    set({ scale: Number(e.target.value) });
  }));
  document.querySelectorAll('input[name="skin"]').forEach((r) => r.addEventListener('change', (e) => { set({ skin: e.target.value }); theme(e.target.value); }));
  let skinNow = 'slate';
  function theme(skin) {
    skinNow = skin || 'slate';
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.body.classList.toggle('light', skinNow === 'light' || (skinNow === 'auto' && !dark));
  }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => theme(skinNow));
  function accent(name, sys) {
    const map = { deniz: '#5cc8c4', gok: '#6aa8f7', lila: '#b7a6f2', mercan: '#f07c6b', fener: '#f2b544', yosun: '#9bd17a', pembe: '#f28cc0' };
    const c = name === 'windows' && sys ? '#' + sys.slice(0, 6) : map[name] || map.deniz;
    document.documentElement.style.setProperty('--accent', c);
  }
  let sysAccent = '';
  document.querySelectorAll('input[name="accent"]').forEach((r) => r.addEventListener('change', (e) => { set({ accent: e.target.value }); accent(e.target.value, sysAccent); }));
  document.querySelectorAll('input[name="soundPack"]').forEach((r) => r.addEventListener('change', (e) => {
    set({ soundPack: e.target.value });
    if (window.AdaSound) window.AdaSound.play('done', e.target.value);
  }));
  // try the chosen pack: "done", then a moment later "ask"
  $('sound-try').addEventListener('click', () => {
    const pack = (document.querySelector('input[name="soundPack"]:checked') || {}).value || 'klasik';
    window.AdaSound.play('done', pack);
    setTimeout(() => window.AdaSound.play('ask', pack), 900);
    setTimeout(() => window.AdaSound.play('pomo', pack), 1800);
  });
  $('opt-userName').addEventListener('change', (e) => set({ userName: e.target.value.trim() }));
  $('opt-birthday').addEventListener('change', async (e) => {
    const v = e.target.value.trim();
    if (v && !/^\d{1,2}[./-]\d{1,2}$/.test(v)) { e.target.setCustomValidity('GG.AA biçiminde yaz, örneğin 14.03'); e.target.reportValidity(); return; }
    e.target.setCustomValidity('');
    await set({ birthday: v });
  });
  $('opt-classReminder').addEventListener('change', (e) => set({ classReminder: Number(e.target.value) }));
  $('opt-calendarReminder').addEventListener('change', (e) => set({ calendarReminder: Number(e.target.value) }));
  $('opt-quickReply').addEventListener('change', (e) => set({ quickReply: Number(e.target.value) }));
  $('opt-lowBattery').addEventListener('change', (e) => set({ lowBattery: Number(e.target.value) }));
  async function saveCalendar() {
    const v = $('opt-calendarUrl').value.trim();
    if (v && !/^(https|webcal):\/\//i.test(v)) { msg($('cal-msg'), 'Adres https:// ile başlamalı.', 'err'); return; }
    await set({ calendarUrl: v });
    if (!v) { msg($('cal-msg'), 'Takvim bağlantısı kaldırıldı.'); calBadge(false); return; }
    msg($('cal-msg'), 'Takvim okunuyor…');
    const r = await ada.call('calendar', 'refresh');
    const st = r.ok && r.result;
    if (st && !st.error) { msg($('cal-msg'), `Bağlandı · önümüzdeki hafta ${st.events.length} etkinlik`, 'ok'); calBadge(true); }
    else msg($('cal-msg'), (st && st.error) || r.error || 'Okunamadı', 'err');
  }
  function calBadge(on) { $('cal-badge').textContent = on ? 'Bağlı' : 'Bağlı değil'; $('cal-badge').classList.toggle('ok', on); }
  $('cal-save').addEventListener('click', saveCalendar);

  // ---- weather: find the city, pick one of the matches
  function wxBadge(p) { $('wx-badge').textContent = p ? p.name : 'Seçilmedi'; $('wx-badge').classList.toggle('ok', !!p); }
  async function findCity() {
    const q = $('wx-city').value.trim();
    const box = $('wx-results');
    box.textContent = '';
    if (!q) return;
    msg($('wx-msg'), 'Aranıyor…');
    const r = await ada.call('weather', 'find', q);
    if (!r.ok) { msg($('wx-msg'), r.error, 'err'); return; }
    const list = r.result || [];
    if (!list.length) { msg($('wx-msg'), 'Bu adla bir yer bulunamadı.', 'err'); return; }
    msg($('wx-msg'), list.length > 1 ? 'Hangisi?' : '');
    for (const p of list) {
      const b = document.createElement('button');
      b.className = 'ghost wx-pick';
      b.textContent = [p.name, p.admin && p.admin !== p.name ? p.admin : '', p.country].filter(Boolean).join(', ');
      b.addEventListener('click', async () => {
        const s2 = await ada.call('weather', 'set', p);
        box.textContent = '';
        wxBadge(s2.ok ? s2.result : null);
        msg($('wx-msg'), `${b.textContent} seçildi.`, 'ok');
      });
      box.appendChild(b);
    }
    if (list.length === 1) box.firstChild.click();
  }
  $('wx-find').addEventListener('click', findCity);
  $('wx-locate').addEventListener('click', async () => {
    msg($('wx-msg'), 'Konum alınıyor…');
    const r = await ada.call('weather', 'locate');
    if (r.ok && r.result) { wxBadge(r.result); msg($('wx-msg'), 'Konumun bulundu; hava durumu birazdan adada.', 'ok'); }
    else msg($('wx-msg'), r.error || 'Konum alınamadı', 'err');
  });

  // ---- plugins
  async function loadPlugins() {
    const r = await ada.call('plugins', 'list');
    const box = $('plugin-list');
    box.textContent = '';
    const list = (r.ok && r.result && r.result.plugins) || [];
    if (!list.length) { box.appendChild(el('p', { class: 'fine', text: 'Yüklü eklenti yok.' })); return; }
    for (const p of list) {
      const row = el('label', { class: 'toggle plugin-row' });
      const cb = el('input', { type: 'checkbox' });
      cb.checked = p.enabled;
      cb.addEventListener('change', async () => {
        await ada.call('plugins', 'setEnabled', { id: p.id, on: cb.checked });
        msg($('plugin-msg'), cb.checked ? `${p.name} açıldı; ada yenilendi.` : `${p.name} kapatıldı.`, 'ok');
      });
      const txt = el('span', { text: `${p.name} ` });
      txt.appendChild(el('em', { text: `${p.version}${p.author ? ' · ' + p.author : ''}${p.description ? ' · ' + p.description : ''}` }));
      row.append(cb, txt);
      box.appendChild(row);
    }
  }
  $('plugin-dir').addEventListener('click', () => ada.call('plugins', 'openDir'));
  $('plugin-example').addEventListener('click', async () => {
    const r = await ada.call('plugins', 'installExample');
    msg($('plugin-msg'), r.ok ? 'Döviz eklentisi kuruldu ve açıldı; adada yeni bir sekme var.' : r.error, r.ok ? 'ok' : 'err');
    loadPlugins();
  });
  loadPlugins();
  $('wx-city').addEventListener('keydown', (e) => { if (e.key === 'Enter') findCity(); });
  $('opt-calendarUrl').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveCalendar(); });
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
    else if (r.result && r.result.version) msg($('up-msg'), `Ada ${r.result.version} hazır. Adadaki kartta Güncelle'ye bas.`, 'ok');
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

  // ------------------------------------------------------------ pages: one section at a time
  const NAV_IC = {
    palette: '<svg viewBox="0 0 24 24"><path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1-1.6-1-2.7 0-1 .8-1.6 1.8-1.6h2.1a3.8 3.8 0 0 0 3.8-3.8C20.5 6.7 16.7 3.5 12 3.5z"/><circle cx="7.8" cy="11" r="1.1"/><circle cx="10.5" cy="7.4" r="1.1"/><circle cx="15" cy="7.6" r="1.1"/></svg>',
    fener: '<svg viewBox="0 0 24 24"><path d="M9 4.5l3-2 3 2M9.3 4.5h5.4v3.3H9.3zM10 7.8l-1.3 13h6.6L14 7.8M7 20.8h10M4.5 5.5l3 .7M19.5 5.5l-3 .7"/></svg>',
    claude: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="14" rx="3"/><path d="M7.5 10l2.5 2-2.5 2M12.5 14.5h4"/></svg>',
    timer: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2M9.5 2.8h5"/></svg>',
    book: '<svg viewBox="0 0 24 24"><path d="M5 18.5V6a2.5 2.5 0 0 1 2.5-2.5H19v13H7.5A2.5 2.5 0 0 0 5 19a2.5 2.5 0 0 0 2.5 2.5H19M9 7.5h6"/></svg>',
    cal: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01"/></svg>',
    note: '<svg viewBox="0 0 24 24"><path d="M9 17.5V6l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/></svg>',
    cloud: '<svg viewBox="0 0 24 24"><circle cx="9" cy="9" r="3.4"/><path d="M9 2.5v1.5M2.5 9H4M4.4 4.4l1 1M13.6 4.4l-1 1"/><path d="M8.5 19.5a3.5 3.5 0 0 1 0-7a4.8 4.8 0 0 1 9.2 1.3a2.9 2.9 0 0 1-.4 5.7z"/></svg>',
    puzzle: '<svg viewBox="0 0 24 24"><path d="M5 7.5h3.5a2 2 0 1 1 4 0H16v3.5a2 2 0 1 1 0 4V19H12.5a2 2 0 1 0-4 0H5v-3.5a2 2 0 1 0 0-4z"/></svg>',
    key: '<svg viewBox="0 0 24 24"><rect x="2.5" y="6.5" width="19" height="11" rx="2.5"/><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M7.5 14h9"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.5l1.6 1.2-1.8 3.1-1.9-.7a7 7 0 0 1-1.7 1l-.3 2h-3.6l-.3-2a7 7 0 0 1-1.7-1l-1.9.7-1.8-3.1 1.6-1.2a7 7 0 0 1 0-2l-1.6-1.2 1.8-3.1 1.9.7a7 7 0 0 1 1.7-1l.3-2h3.6l.3 2a7 7 0 0 1 1.7 1l1.9-.7 1.8 3.1-1.6 1.2a7 7 0 0 1 0 2z"/></svg>',
    update: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4.5h-4.5"/><path d="M12 8v4.5l3 1.8"/></svg>',
  };
  const links = [...document.querySelectorAll('.side a')];
  links.forEach((a) => { a.querySelector('i').innerHTML = NAV_IC[a.dataset.ic] || ''; });
  const sections = [...document.querySelectorAll('main > section')];
  function show(id) {
    if (!sections.some((x) => x.id === id)) id = 'gorunum';
    if ($('search').value) { $('search').value = ''; search(''); }
    sections.forEach((x) => x.classList.toggle('show', x.id === id));
    links.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + id));
    document.querySelector('main').scrollTop = 0;
    try { localStorage.setItem('ada.settings.page', id); } catch { /* fine */ }
    if (id === 'ders') renderWeek();
  }
  links.forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); show(a.getAttribute('href').slice(1)); }));

  // search: every page at once, only the rows that match
  const norm = (t) => String(t || '').toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
  function search(q) {
    const n = norm(q.trim());
    document.body.classList.toggle('searching', !!n);
    let any = false;
    for (const sec of sections) {
      let hits = 0;
      if (!n) {
        sec.querySelectorAll('.nomatch').forEach((x) => x.classList.remove('nomatch'));
      } else {
        const secHit = norm(sec.querySelector('h1').textContent).includes(n);
        for (const card of sec.querySelectorAll('.card')) {
          const rows = [...card.querySelectorAll(':scope > .toggle, :scope > .field, :scope > .toggle-row')];
          const cardHit = secHit || norm((card.querySelector('h2') || {}).textContent).includes(n);
          let cardRows = 0;
          for (const r of rows) {
            const hit = cardHit || norm(r.textContent).includes(n);
            r.classList.toggle('nomatch', !hit);
            if (hit) cardRows++;
          }
          const textHit = cardHit || cardRows || (!rows.length && norm(card.textContent).includes(n));
          card.classList.toggle('nomatch', !textHit);
          if (textHit) hits++;
        }
      }
      const a = links.find((x) => x.getAttribute('href') === '#' + sec.id);
      let badge = a.querySelector('.hits');
      if (!badge) { badge = el('span', { class: 'hits' }); a.appendChild(badge); }
      badge.textContent = n && hits ? String(hits) : '';
      if (n) sec.classList.toggle('show', hits > 0);
      any = any || hits > 0;
    }
    $('search-empty').hidden = !n || any;
    if (!n) show((links.find((a) => a.classList.contains('on')) || links[0]).getAttribute('href').slice(1));
  }
  $('search').addEventListener('input', (e) => search(e.target.value));
  $('search').addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.target.value = ''; search(''); } });
  window.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key.toLowerCase() === 'f') { e.preventDefault(); $('search').focus(); $('search').select(); } });
  // links from one page to another (e.g. "Görünüm'de")
  document.addEventListener('click', (e) => { const go = e.target.closest('[data-go]'); if (go) show(go.dataset.go); });

  // ------------------------------------------------------------ events
  ada.on('settings:spotify', (st) => { showSpotify(st); if (st.connected) msg($('sp-msg'), ''); });
  ada.on('settings:login', (r) => msg($('sp-msg'), r.ok ? 'Spotify bağlandı.' : 'Bağlantı başarısız: ' + r.error, r.ok ? 'ok' : 'err'));
  ada.on('settings:section', (s) => { if (s) show(s); });
  {
    let first = '';
    try { first = localStorage.getItem('ada.settings.page') || ''; } catch { /* fine */ }
    show(new URLSearchParams(location.search).get('section') || first || 'gorunum');
  }

  ada.settings().then((s) => {
    $('version').textContent = 'Ada ' + s.version;
    const c = s.config;
    showSpotify(s.spotify);
    showPomodoro(s.pomodoro || {});
    if (s.spotify.connected) loadPlaylists(s.pomodoro && s.pomodoro.musicUri);
    schedule = JSON.parse(JSON.stringify(s.schedule || { classes: [], exams: [] }));
    renderClasses();
    renderExams();
    ['sound', 'notifications', 'desktopWatcher', 'hideFullscreen', 'sleepy', 'glass', 'albumColor', 'shortcuts', 'clipboard', 'translateLyrics', 'visualizer', 'privacyDots', 'deviceCards', 'media', 'weatherRest', 'autoUpdate', 'motion', 'edgeGlow', 'wallTint', 'fenerMoods', 'seasons', 'greeting'].forEach((k) => { $('opt-' + k).checked = c[k] !== false && !!(c[k] ?? true); });
    document.querySelectorAll('input[name="skin"]').forEach((r) => { r.checked = r.value === (c.skin || 'slate'); });
    document.querySelectorAll('input[name="accent"]').forEach((r) => { r.checked = r.value === (c.accent || 'deniz'); });
    document.querySelectorAll('input[name="soundPack"]').forEach((r) => { r.checked = r.value === (c.soundPack || 'klasik'); });
    $('opt-userName').value = c.userName || '';
    $('opt-birthday').value = c.birthday || '';
    if (c.systemAccent) document.querySelector('.sw-windows').style.background = '#' + c.systemAccent.slice(0, 6);
    syncSize(c.scale || 1);
    $('opt-loginAtStart').checked = !!s.loginAtStart;
    document.querySelectorAll('input[name="position"]').forEach((r) => { r.checked = r.value === (c.position || 'center'); });
    const ds = $('opt-display');
    (s.displays || []).forEach((d) => ds.appendChild(el('option', { value: String(d.i), text: d.label })));
    if ((s.displays || []).length > 1) ds.appendChild(el('option', { value: '-1', text: 'İmlecin olduğu ekran (takip et)' }));
    ds.value = String(c.display || 0);
    $('opt-scale').value = c.scale || 1;
    $('scale-v').textContent = `%${Math.round((c.scale || 1) * 100)}`;
    $('opt-classReminder').value = String(c.classReminder ?? 10);
    $('opt-calendarReminder').value = String(c.calendarReminder ?? 10);
    $('opt-lowBattery').value = String([0, 10, 15, 20, 30].includes(Number(c.lowBattery)) ? Number(c.lowBattery) : 20);
    $('opt-quickReply').value = String([0, 8, 15, 30].includes(Number(c.quickReply)) ? Number(c.quickReply) : 15);
    $('opt-calendarUrl').value = c.calendarUrl || '';
    calBadge(!!c.calendarUrl);
    wxBadge(c.weatherPlace);
    if (c.weatherPlace) $('wx-city').value = c.weatherPlace.name;
    $('sum-on').checked = !!c.summaryTime;
    $('opt-summaryTime').value = c.summaryTime || '21:30';
    $('opt-summaryTime').disabled = !c.summaryTime;
    $('opt-updateRepo').value = c.updateRepo || '';
    showShortcuts(s.shortcuts || []);
    theme(c.skin);
    sysAccent = c.systemAccent || '';
    accent(c.accent || 'deniz', sysAccent);
    renderWeek();
    let last = '';
    try { last = localStorage.getItem('ada.settings.page') || ''; } catch { /* fine */ }
    show(new URLSearchParams(location.search).get('section') || last || 'gorunum');
  });
})();
