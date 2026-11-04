'use strict';
/* global Ada, ada */
// Music tab (Spotify): now playing, controls, volume, lyrics (+ translation), playlists, devices.
(() => {
  const { S, ui, I, esc, mmss, island } = Ada;
  const m = {
    sub: 'lyrics',
    lists: { playlists: null, devices: null, loading: null, error: '' },
    lyr: { trackId: null, status: 'none', lines: [] },
    trans: { trackId: null, lines: null, loading: false, on: false },
    seekDrag: null,
    volDrag: false,
    q: '',
    results: null,          // { tracks, albums, playlists }
    searching: false,
    searchTimer: null,
    adding: null,           // playlist id being added to
    lyricIdx: -1,
    albumFor: null,
  };

  const player = () => (S.music && S.music.player) || null;
  const track = () => (player() && player().track) || null;
  const deviceIcon = (type) => (/smartphone|tablet/i.test(type) ? I.phone : /speaker|avr|stb|tv|cast/i.test(type) ? I.speaker : I.computer);

  function position() {
    const p = player();
    if (!p || !p.track) return 0;
    if (m.seekDrag != null) return m.seekDrag;
    const ms = p.isPlaying ? p.progress + (Date.now() - p.at) : p.progress;
    return Math.min(ms, p.track.duration);
  }

  // ------------------------------------------------------------ album colour
  function albumColor(url) {
    if (!url || S.config.albumColor === false) { island.style.removeProperty('--album'); return; }
    if (m.albumFor === url) return;
    m.albumFor = url;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = 16;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(img, 0, 0, 16, 16);
        const d = g.getImageData(0, 0, 16, 16).data;
        let best = null;
        let bestScore = -1;
        // pick the most saturated, not-too-dark pixel bucket
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], gg = d[i + 1], b = d[i + 2];
          const max = Math.max(r, gg, b), min = Math.min(r, gg, b);
          const sat = max ? (max - min) / max : 0;
          const score = sat * 2 + max / 255;
          if (max > 60 && score > bestScore) { bestScore = score; best = [r, gg, b]; }
        }
        if (!best) return island.style.removeProperty('--album');
        // lift dark colours so they stay visible on the slate background
        const max = Math.max(...best);
        const k = max < 170 ? 170 / max : 1;
        const [r, gg, b] = best.map((v) => Math.min(255, Math.round(v * k)));
        island.style.setProperty('--album', `rgb(${r}, ${gg}, ${b})`);
      } catch {
        island.style.removeProperty('--album');
      }
    };
    img.onerror = () => island.style.removeProperty('--album');
    img.src = url;
  }

  // ------------------------------------------------------------ views
  function leftHtml() {
    const p = player();
    const t = track();
    const repeatOn = p.repeat !== 'off';
    return `
      <div class="np">
        ${t.cover ? `<img class="cover" src="${esc(t.cover)}" alt="" data-morph="cover">` : '<span class="cover" data-morph="cover"></span>'}
        <div class="meta">
          <div class="t-name" title="${esc(t.name)}"><span data-morph="title" data-morph-text>${esc(t.name)}</span></div>
          <div class="t-artist" title="${esc(t.artists)}"><span data-morph="artist" data-morph-text>${esc(t.artists)}</span></div>
          ${p.device ? `<div class="t-dev">${deviceIcon(p.device.type)}<span>${esc(p.device.name)}</span></div>` : ''}
        </div>
        ${t.episode ? '' : `<div class="np-acts">
          <button class="ic like ${p.liked ? 'on' : ''}" data-act="m:like" title="${p.liked ? 'Beğenilenlerden çıkar' : 'Beğen'}" aria-pressed="${!!p.liked}">${p.liked ? I.liked : I.heart}</button>
          <button class="ic sm add ${m.sub === 'add' ? 'on' : ''}" data-act="m:sub" data-id="add" title="Playliste ekle">${I.plus}</button>
        </div>`}
      </div>
      <div class="seek">
        <span class="tm" data-live="cur">0:00</span>
        <div class="bar" data-seek="1" role="slider" aria-label="Şarkıda ilerle">
          <div class="fill" data-live="fill"></div><div class="knob" data-live="knob"></div>
        </div>
        <span class="tm">${mmss(t.duration)}</span>
      </div>
      <div class="ctrl">
        <button class="ic sm ${p.shuffle ? 'on' : ''}" data-act="m:shuffle" title="Karıştır" aria-pressed="${p.shuffle}">${I.shuffle}</button>
        <button class="ic" data-act="m:prev" title="Önceki · Ctrl+Alt+←">${I.prev}</button>
        <button class="ic big" data-act="m:toggle" title="${p.isPlaying ? 'Duraklat' : 'Oynat'} · Ctrl+Alt+Boşluk">${p.isPlaying ? I.pause : I.play}</button>
        <button class="ic" data-act="m:next" title="Sonraki · Ctrl+Alt+→">${I.next}</button>
        <button class="ic sm ${repeatOn ? 'on' : ''}" data-act="m:repeat" title="${p.repeat === 'track' ? 'Şarkıyı tekrarla' : p.repeat === 'context' ? 'Listeyi tekrarla' : 'Tekrar kapalı'}" aria-pressed="${repeatOn}">${I.repeat}${p.repeat === 'track' ? '<em>1</em>' : ''}</button>
      </div>
      ${volHtml()}`;
  }

  // The slider controls the computer's master volume (Windows), not Spotify's own volume.
  function volHtml() {
    const v = S.mods.volume;
    if (!v || !v.available || v.vol == null) return '';
    const icon = v.muted || v.vol === 0 ? I.volOff : I.vol;
    return `<div class="vol">
        <button class="ic xs vol-btn ${v.muted ? 'muted' : ''}" data-act="m:mute" title="${v.muted ? 'Sesi aç' : 'Sessize al'} · Ctrl+Alt+M">${icon}</button>
        <input type="range" min="0" max="100" step="1" value="${v.vol}" data-vol="1" aria-label="Bilgisayar sesi">
        <span class="tm" data-live="volnum">${v.vol}</span>
      </div>`;
  }

  function segs() {
    const b = (id, label) => `<button class="seg ${m.sub === id ? 'on' : ''}" data-act="m:sub" data-id="${id}">${label}</button>`;
    const canTranslate = m.sub === 'lyrics' && track() && (m.lyr.status === 'synced' || m.lyr.status === 'plain');
    return `<div class="segs">${track() ? b('lyrics', 'Sözler') : ''}${b('search', 'Ara')}${b('playlists', 'Listeler')}${b('devices', 'Cihazlar')}
      ${canTranslate ? `<button class="seg tr ${m.trans.on ? 'on' : ''}" data-act="m:translate" title="Sözleri Türkçeye çevir">${m.trans.loading ? '…' : 'TR'}</button>` : ''}
    </div>`;
  }

  function subBody() {
    const sub = !track() && (m.sub === 'lyrics' || m.sub === 'add') ? 'playlists' : m.sub;
    if (sub === 'lyrics') return lyricsBody();
    if (sub === 'search') return searchBody();
    if (sub === 'add') return addBody();
    if (m.lists.loading === sub) return '<div class="sub"><p class="hint">Yükleniyor…</p></div>';
    if (m.lists.error) return `<div class="sub"><p class="hint err">${esc(m.lists.error)}</p></div>`;
    const ctx = (player() && player().context) || '';
    if (sub === 'playlists') {
      const items = m.lists.playlists;
      if (!items) return '<div class="sub"></div>';
      const liked = `<button class="li ${/:collection$/.test(ctx) ? 'on' : ''}" data-act="m:playLiked"><span class="li-art liked-art">${I.liked}</span><span class="li-name">Beğenilen şarkılar</span><span class="li-meta">${/:collection$/.test(ctx) ? 'çalıyor' : ''}</span></button>`;
      const rows = items.map((pl) => `
        <button class="li ${ctx === pl.uri ? 'on' : ''}" data-act="m:playContext" data-id="${esc(pl.uri)}">
          ${pl.cover ? `<img class="li-art" src="${esc(pl.cover)}" alt="">` : '<span class="li-art"></span>'}
          <span class="li-name">${esc(pl.name)}</span>
          <span class="li-meta">${ctx === pl.uri ? 'çalıyor' : pl.count != null ? `${pl.count} şarkı` : ''}</span>
        </button>`).join('');
      return `<div class="sub list">${liked}${rows || '<p class="hint">Hiç playlistin yok.</p>'}</div>`;
    }
    const items = m.lists.devices;
    if (!items) return '<div class="sub"></div>';
    if (!items.length) return '<div class="sub"><p class="hint">Cihaz bulunamadı. Spotify\'ı bilgisayarında ya da telefonunda aç, sonra burayı yenile.</p></div>';
    return `<div class="sub list">${items.map((d) => `
      <button class="li ${d.active ? 'on' : ''}" data-act="m:transfer" data-id="${esc(d.id)}">
        <span class="li-art dev">${deviceIcon(d.type)}</span>
        <span class="li-name">${esc(d.name)}</span>
        <span class="li-meta">${d.active ? 'çalıyor' : ''}</span>
      </button>`).join('')}</div>`;
  }

  function searchBody() {
    if (!m.q.trim()) return '<div class="sub"><p class="hint">Şarkı, sanatçı, albüm ya da playlist ara.</p></div>';
    if (m.searching && !m.results) return '<div class="sub"><p class="hint">Aranıyor…</p></div>';
    const r = m.results || { tracks: [], albums: [], playlists: [] };
    if (!r.tracks.length && !r.albums.length && !r.playlists.length) return `<div class="sub"><p class="hint">"${esc(m.q)}" için sonuç yok.</p></div>`;
    const cur = track() && track().uri;
    const tracks = r.tracks.map((x) => `
      <button class="li ${cur === x.uri ? 'on' : ''}" data-act="m:playTrack" data-id="${esc(x.uri)}" data-album="${esc(x.albumUri)}">
        ${x.cover ? `<img class="li-art" src="${esc(x.cover)}" alt="">` : '<span class="li-art"></span>'}
        <span class="li-name">${esc(x.name)}<small>${esc(x.artists)}</small></span>
        <span class="li-meta">${mmss(x.duration)}</span>
      </button>`).join('');
    const ctx = (arr, kind) => arr.map((x) => `
      <button class="li" data-act="m:playContext" data-id="${esc(x.uri)}">
        ${x.cover ? `<img class="li-art" src="${esc(x.cover)}" alt="">` : '<span class="li-art"></span>'}
        <span class="li-name">${esc(x.name)}<small>${kind}${x.sub ? ' · ' + esc(x.sub) : ''}</small></span>
        <span class="li-meta"></span>
      </button>`).join('');
    return `<div class="sub list tall">
      ${tracks ? `<div class="li-group">Şarkılar</div>${tracks}` : ''}
      ${r.albums.length ? `<div class="li-group">Albümler</div>${ctx(r.albums, 'Albüm')}` : ''}
      ${r.playlists.length ? `<div class="li-group">Playlistler</div>${ctx(r.playlists, 'Playlist')}` : ''}
    </div>`;
  }

  function addBody() {
    const t = track();
    if (!t) return '<div class="sub"><p class="hint">Şu an çalan bir şarkı yok.</p></div>';
    if (S.music && S.music.needsReauth) {
      return `<div class="sub"><p class="hint">Playliste ekleyebilmem için Spotify'a bir kez yeniden bağlanman gerekiyor.</p>
        <p class="hint"><button class="btn-allow sm" data-act="settings" data-id="spotify">Yeniden bağlan</button></p></div>`;
    }
    if (m.lists.loading === 'playlists') return '<div class="sub"><p class="hint">Yükleniyor…</p></div>';
    const items = (m.lists.playlists || []).filter((p) => p.editable);
    if (!m.lists.playlists) return '<div class="sub"></div>';
    if (!items.length) return '<div class="sub"><p class="hint">Ekleyebileceğin bir playlist yok. Spotify\'da bir liste oluştur, burada görünür.</p></div>';
    return `<div class="sub list">
      <div class="li-group">"${esc(t.name)}" şuraya eklensin:</div>
      ${items.map((pl) => `
        <button class="li" data-act="m:add" data-id="${esc(pl.id)}" ${m.adding === pl.id ? 'disabled' : ''}>
          ${pl.cover ? `<img class="li-art" src="${esc(pl.cover)}" alt="">` : '<span class="li-art"></span>'}
          <span class="li-name">${esc(pl.name)}</span>
          <span class="li-meta">${m.adding === pl.id ? 'ekleniyor…' : pl.count != null ? `${pl.count} şarkı` : ''}</span>
        </button>`).join('')}
    </div>`;
  }

  function lyricsBody() {
    const t = track();
    const l = m.lyr;
    if (!t || l.trackId !== t.id || l.status === 'loading') return '<div class="sub lyrics"><p class="hint">Sözler aranıyor…</p></div>';
    if (l.status === 'instrumental') return '<div class="sub lyrics"><p class="hint">Enstrümantal</p></div>';
    if (l.status === 'error') return '<div class="sub lyrics"><p class="hint">Sözlere ulaşılamadı.</p></div>';
    if (l.status !== 'synced' && l.status !== 'plain') return '<div class="sub lyrics"><p class="hint">Bu şarkının sözleri bulunamadı.</p></div>';
    const synced = l.status === 'synced';
    const tr = m.trans.on && m.trans.trackId === t.id && m.trans.lines ? m.trans.lines : null;
    return `<div class="sub lyrics ${synced ? 'synced' : 'plain'} ${tr ? 'with-tr' : ''}" data-live="lyrics">
      ${l.lines.map((x, i) => `<p data-i="${i}">${x.text ? esc(x.text) : '<span class="gap">♪</span>'}${tr && tr[i] ? `<small>${esc(tr[i])}</small>` : ''}</p>`).join('')}
    </div>`;
  }

  function body() {
    if (!S.music || !S.music.connected) {
      return `<div class="m-empty">
        <p><b>Spotify'ı bağla</b>, çalan şarkıyı, playlistlerini ve sözleri buradan yönet.</p>
        <button class="btn-allow" data-act="settings" data-id="spotify">Spotify'ı bağla</button>
      </div>`;
    }
    const left = track()
      ? leftHtml()
      : `<div class="m-empty"><p>Şu an bir şey çalmıyor. Sağdan bir şarkı ara ya da bir playlist seç; Spotify kapalıysa ben açarım.</p></div>${volHtml()}`;
    const searchBox = m.sub === 'search'
      ? `<input type="text" class="m-search" data-msearch="1" placeholder="Ara: şarkı, sanatçı, albüm" spellcheck="false" autocomplete="off" aria-label="Spotify'da ara">`
      : '';
    return `<div class="m-grid">
      <div class="m-left" data-region="m-left">${left}</div>
      <div class="m-right">
        <div data-region="m-segs">${segs()}</div>
        ${searchBox}
        <div class="m-sub" data-region="m-sub">${subBody()}</div>
      </div>
    </div>`;
  }

  // ------------------------------------------------------------ actions
  async function act(name, arg) {
    const r = await ada.music(name, arg);
    if (!r.ok) Ada.toast({ kind: 'error', text: r.error });
    return r;
  }

  async function loadList(kind, force) {
    if (!force && m.lists[kind]) return;
    m.lists.loading = kind;
    m.lists.error = '';
    Ada.render();
    const r = await ada.musicList(kind);
    m.lists.loading = null;
    if (r.ok) m.lists[kind] = r.items; else m.lists.error = r.error;
    Ada.render();
  }

  function openSub(id) {
    m.sub = id;
    m.lists.error = '';
    if (id === 'playlists' || id === 'add') loadList('playlists');
    if (id === 'devices') loadList('devices', true);
    Ada.render();
    if (id === 'search') {
      setTimeout(() => {
        const box = Ada.$('[data-msearch]');
        if (!box) return;
        ui.holdOpen = true;
        ada.hold(true);
        ada.focusable(true);
        setTimeout(() => { box.focus(); box.select(); }, 40);
      }, 160);
    }
  }

  async function translate() {
    const t = track();
    if (!t) return;
    if (m.trans.on) { m.trans.on = false; return Ada.render(); }
    m.trans.on = true;
    if (m.trans.trackId === t.id && m.trans.lines) return Ada.render();
    m.trans.loading = true;
    Ada.render();
    const r = await ada.translate();
    m.trans.loading = false;
    if (r.ok && r.trackId === t.id) m.trans = { trackId: t.id, lines: r.lines, loading: false, on: true };
    else { m.trans.on = false; Ada.toast({ kind: 'error', text: r.error || 'Çeviri başarısız' }); }
    Ada.render();
  }

  // ------------------------------------------------------------ live updates
  function tick(root, force) {
    const t = track();
    if (!t) return;
    const pos = position();
    const ratio = t.duration ? Math.min(1, pos / t.duration) : 0;
    const pct = (ratio * 100).toFixed(2) + '%';
    const fill = root.querySelector('[data-live="fill"]');
    if (fill) {
      fill.style.width = pct;
      root.querySelector('[data-live="knob"]').style.left = pct;
      root.querySelector('[data-live="cur"]').textContent = mmss(pos);
    }
    const pf = root.querySelector('[data-live="pillfill"]');
    if (pf) pf.style.width = pct;

    const box = root.querySelector('[data-live="lyrics"]');
    if (box && box.classList.contains('synced')) {
      const lines = m.lyr.lines;
      let idx = -1;
      for (let i = 0; i < lines.length; i++) { if (lines[i].t <= pos + 250) idx = i; else break; }
      if (idx !== m.lyricIdx || force) {
        box.querySelectorAll('p').forEach((el, i) => { el.classList.toggle('past', i < idx); el.classList.toggle('on', i === idx); });
        const cur = idx >= 0 ? box.querySelector(`p[data-i="${idx}"]`) : null;
        if (cur) box.scrollTo({ top: cur.offsetTop - box.clientHeight / 2 + cur.offsetHeight / 2, behavior: force ? 'auto' : 'smooth' });
        else if (force) box.scrollTo({ top: 0 });
        m.lyricIdx = idx;
      }
    }
  }

  // seek by click or drag
  island.addEventListener('mousedown', (e) => {
    const bar = e.target.closest('[data-seek]');
    if (!bar || !track()) return;
    e.preventDefault();
    const dur = track().duration;
    const at = (ev) => {
      const r = bar.getBoundingClientRect();
      return Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * dur;
    };
    ui.drag = true;
    ada.hold(true);
    m.seekDrag = at(e);
    tick(Ada.inner, true);
    const move = (ev) => { m.seekDrag = at(ev); tick(Ada.inner, true); };
    const up = (ev) => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      const ms = at(ev);
      m.seekDrag = null;
      ui.drag = false;
      act('seek', ms);
      Ada.afterPointerAction();
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  });

  island.addEventListener('input', (e) => {
    if (e.target.matches('[data-msearch]')) return onSearchInput(e.target.value);
    if (!e.target.matches('[data-vol]')) return;
    if (!ui.drag) ada.hold(true);
    ui.drag = true;
    const n = Ada.$('[data-live="volnum"]');
    if (n) n.textContent = e.target.value;
    ada.call('volume', 'set', Number(e.target.value)); // live: the main process throttles it
  });
  island.addEventListener('change', (e) => {
    if (!e.target.matches('[data-vol]')) return;
    ui.drag = false;
    ada.call('volume', 'set', Number(e.target.value));
    Ada.afterPointerAction();
  });
  island.addEventListener('keydown', (e) => {
    if (!e.target.matches('[data-msearch]')) return;
    if (e.key === 'Enter') {
      // Enter plays the first song
      const first = m.results && m.results.tracks && m.results.tracks[0];
      if (first) play('playTrack', { uri: first.uri, albumUri: first.albumUri }, first.name);
    }
  });

  function onSearchInput(v) {
    m.q = v;
    clearTimeout(m.searchTimer);
    if (!v.trim()) { m.results = null; m.searching = false; return Ada.render(); }
    m.searchTimer = setTimeout(async () => {
      const q = m.q;
      m.searching = true;
      Ada.render();
      const r = await ada.call('spotify', 'search', q);
      if (q !== m.q) return;           // a newer search is on its way
      m.searching = false;
      if (r.ok) m.results = r.result;
      else Ada.toast({ kind: 'error', text: r.error });
      Ada.render();
    }, 320);
  }

  async function play(name, arg, label) {
    const r = await act(name, arg);
    if (r.ok && !r.launching && label) Ada.toast({ kind: 'info', text: `Çalıyor: ${label}` });
  }

  async function addTo(id) {
    const t = track();
    if (!t) return;
    m.adding = id;
    Ada.render();
    const r = await ada.call('spotify', 'addToPlaylist', { id, uri: t.uri });
    m.adding = null;
    const res = r.ok ? r.result : { ok: false, error: r.error };
    const pl = (m.lists.playlists || []).find((p) => p.id === id);
    if (res.ok) {
      Ada.toast({ kind: 'info', text: `"${t.name}" → ${pl ? pl.name : 'playlist'} listesine eklendi` });
      if (pl && pl.count != null) pl.count += 1;
      m.sub = 'lyrics';
    } else Ada.toast({ kind: 'error', text: res.error });
    Ada.render();
  }
  island.addEventListener('wheel', (e) => {
    const s = e.target.closest('.vol');
    if (!s) return;
    const input = s.querySelector('input');
    e.preventDefault();
    const v = Math.max(0, Math.min(100, Number(input.value) + (e.deltaY < 0 ? 2 : -2)));
    input.value = v;
    Ada.$('[data-live="volnum"]').textContent = v;
    ada.call('volume', 'set', v);
  }, { passive: false });

  // ------------------------------------------------------------ register
  Ada.tab({
    id: 'music',
    label: 'Müzik',
    icon: I.note,
    pillRank: 3,
    badge() { return player() && player().isPlaying ? '<span class="eq on mini"><i></i><i></i><i></i></span>' : ''; },
    status() { return player() && player().isPlaying ? 'music' : 'idle'; },
    wantsFocus() { return !!(S.music && S.music.connected && player() && player().isPlaying); },
    pill() {
      const t = track();
      const p = player();
      if (!t || !p.isPlaying) return null;
      return {
        status: 'music',
        html: `<div class="pill music-pill">
          ${t.coverSmall ? `<img class="mini-cover" src="${esc(t.coverSmall)}" alt="" data-morph="cover">` : '<span class="mini-cover" data-morph="cover"></span>'}
          <span class="proj" data-morph="title" data-morph-text>${esc(t.name)}</span>
          <span class="act" data-morph="artist" data-morph-text>${esc(t.artists)}</span>
          <span class="eq on" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="mini-prog" aria-hidden="true"><b data-live="pillfill"></b></span>
        </div>`,
      };
    },
    body,
    tick(root, force) { tick(root, force); },
    after(root) {
      m.lyricIdx = -1;
      const box = root.querySelector('[data-msearch]');
      if (box && document.activeElement !== box && box.value !== m.q) box.value = m.q;
    },
    onEnter() {
      if (S.music && S.music.connected && !track() && m.sub === 'lyrics') openSub('playlists');
    },
    onAct(a, id, el) {
      if (!a.startsWith('m:')) return false;
      const name = a.slice(2);
      if (name === 'sub') openSub(m.sub === id && id === 'add' ? 'lyrics' : id);
      else if (name === 'translate') translate();
      else if (name === 'mute') ada.call('volume', 'toggleMute');
      else if (name === 'add') addTo(id);
      else if (name === 'playTrack') { play('playTrack', { uri: id, albumUri: el.dataset.album || '' }); }
      else if (name === 'playContext') { play('playContext', { uri: id }); if (m.sub !== 'search') m.sub = 'lyrics'; }
      else if (name === 'playLiked') { play('playLiked'); m.sub = 'lyrics'; }
      else if (name === 'transfer') act('transfer', id).then(() => setTimeout(() => loadList('devices', true), 900));
      else act(name);
      return true;
    },
    onMod(mod, v) {
      if (mod !== 'volume' || ui.drag) return;
      const input = Ada.$('[data-vol]');
      if (input && v && v.vol != null) {
        input.value = v.vol;
        const n = Ada.$('[data-live="volnum"]');
        if (n) n.textContent = v.vol;
      }
    },
    onMusic() {
      const t = track();
      if (t && m.lyr.trackId !== t.id) {
        m.lyr = { trackId: t.id, status: 'loading', lines: [] };
        if (m.trans.trackId !== t.id) m.trans = { trackId: null, lines: null, loading: false, on: !!S.config.translateLyrics };
      }
      albumColor(t ? t.coverSmall || t.cover : null);
    },
    init() {
      const t = track();
      if (t) {
        albumColor(t.coverSmall || t.cover);
        ada.lyrics().then((l) => { if (l && l.trackId) { m.lyr = { trackId: l.trackId, status: l.status, lines: l.lines || [] }; Ada.render(); } });
      }
      m.trans.on = !!S.config.translateLyrics;
      ada.on('music:lyrics', async (l) => {
        if (!track() || l.trackId !== track().id) return;
        m.lyr = { trackId: l.trackId, status: l.status, lines: l.lines || [] };
        Ada.render();
        if (m.trans.on && (l.status === 'synced' || l.status === 'plain')) { m.trans.on = false; translate(); }
      });
    },
    onEvent(ev) {
      if (ev.type !== 'spotify-launch') return;
      if (ev.stage === 'opening') {
        Ada.showCard({ key: 'sp-open', status: 'music', sticky: true,
          html: `<div class="card-head"><span class="spin" aria-hidden="true"></span><span class="proj">Spotify açılıyor…</span></div>
                 <p class="msg">Hazır olunca istediğin şarkıyı başlatacağım.</p>` });
      } else if (ev.stage === 'playing') {
        Ada.showCard({ key: 'sp-ok', status: 'music', until: Date.now() + 3500,
          html: `<div class="card-head"><span class="glyph" data-s="done"></span><span class="proj">Spotify açıldı</span><span class="what">${esc(ev.device || '')} üzerinde çalıyor</span></div>` });
      } else {
        Ada.showCard({ key: 'sp-fail', status: 'error', until: Date.now() + 7000,
          html: `<div class="card-head"><span class="glyph" data-s="waiting"></span><span class="proj">Spotify</span><span class="what">başlatılamadı</span></div>
                 <p class="msg">${esc(ev.error || '')}</p>` });
      }
    },
    onConfig(c) { if (c.albumColor === false) island.style.removeProperty('--album'); else if (track()) { m.albumFor = null; albumColor(track().coverSmall); } },
  });
})();
