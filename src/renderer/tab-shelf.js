'use strict';
/* global Ada, ada */
// Shelf tab: drop files on the island to keep them handy, drag them out again where you need them.
(() => {
  const { S, I, esc, island } = Ada;
  const sh = { over: false, leaveTimer: null };
  const ICON = '<svg viewBox="0 0 24 24"><path d="M3.5 13.5l2.6-7.2a1.5 1.5 0 0 1 1.4-1h9a1.5 1.5 0 0 1 1.4 1l2.6 7.2v4.5a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3.5 18zM3.5 13.5h5l1.2 2h4.6l1.2-2h5"/></svg>';
  const FOLDER = '<svg viewBox="0 0 24 24"><path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4.2l2 2H19a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z"/></svg>';
  const FILE = '<svg viewBox="0 0 24 24"><path d="M6.5 3.5h7l4 4v13h-11zM13.5 3.5v4h4"/></svg>';
  const items = () => (S.mods.shelf && S.mods.shelf.items) || [];

  const size = (n) => (n == null ? '' : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB` : n < 1073741824 ? `${(n / 1048576).toFixed(1)} MB` : `${(n / 1073741824).toFixed(2)} GB`);

  function body() {
    const list = items();
    if (!list.length) {
      return `<div class="shelf-empty ${sh.over ? 'over' : ''}">
        <span class="drop-ic">${ICON}</span>
        <p><b>Dosyaları buraya bırak.</b> Ada onları rafta tutar; sonra buradan istediğin klasöre, tarayıcıdaki yükleme kutusuna ya da bir mesaja sürükleyip bırakırsın.</p>
        <p class="hint-l">Dosyalar kopyalanmaz ya da taşınmaz; Ada sadece yerlerini hatırlar.</p>
      </div>`;
    }
    const tiles = list.map((x) => `
      <div class="sh-item" draggable="true" data-path="${esc(x.path)}" title="${esc(x.path)}\nÇift tıkla: aç · Sürükle: bırakmak istediğin yere">
        ${x.icon ? `<img class="sh-ic" src="${esc(x.icon)}" alt="" draggable="false">` : `<span class="sh-ic gen">${x.dir ? FOLDER : FILE}</span>`}
        <span class="sh-name">${esc(x.name)}</span>
        <span class="sh-meta">${x.dir ? 'klasör' : esc([x.ext.toUpperCase(), size(x.size)].filter(Boolean).join(' · '))}</span>
        <span class="sh-acts">
          <button class="ic xs" data-act="sh:reveal" data-id="${esc(x.path)}" title="Klasörde göster">${I.jump}</button>
          <button class="ic xs" data-act="sh:remove" data-id="${esc(x.path)}" title="Raftan kaldır">${I.x}</button>
        </span>
      </div>`).join('');
    return `<div class="shelf ${sh.over ? 'over' : ''}">
      <div class="sh-head">
        <h3>Raf · ${list.length} öge</h3>
        <span class="spacer"></span>
        ${list.length > 1 ? `<span class="chip sh-all" draggable="true" data-all="1" title="Hepsini birden sürükle">Hepsini sürükle</span>` : ''}
        <button class="btn-text sm" data-act="sh:clear">Rafı boşalt</button>
      </div>
      <div class="sh-grid" data-region="sh-grid">${tiles}</div>
      <div class="sh-drop">Bırak, rafa koyayım</div>
    </div>`;
  }

  // ------------------------------------------------------------ dropping files onto the island
  const hasFiles = (e) => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
  let dragOut = false;
  function setOver(on) {
    if (sh.over === on) return;
    sh.over = on;
    island.classList.toggle('dropping', on);
    Ada.ui.drag = false;
    Ada.render();
    Ada.ui.drag = on;      // keep the panel open while the files hover
  }
  document.addEventListener('dragenter', (e) => {
    if (dragOut || !hasFiles(e)) return;
    e.preventDefault();
    clearTimeout(sh.leaveTimer);
    if (!Ada.ui.hovered || Ada.ui.tab !== 'shelf') Ada.openTab('shelf');
    setOver(true);
  });
  document.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = dragOut ? 'none' : 'copy';
    clearTimeout(sh.leaveTimer);
  });
  document.addEventListener('dragleave', (e) => {
    if (!hasFiles(e)) return;
    clearTimeout(sh.leaveTimer);
    sh.leaveTimer = setTimeout(() => { setOver(false); Ada.ui.drag = false; Ada.afterPointerAction(); }, 120);
  });
  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    clearTimeout(sh.leaveTimer);
    setOver(false);
    Ada.ui.drag = false;
    if (dragOut) return;
    const paths = [...(e.dataTransfer.files || [])].map((f) => ada.pathFor(f)).filter(Boolean);
    if (!paths.length) return;
    const r = await ada.call('shelf', 'add', paths);
    const n = r.ok ? r.result : 0;
    Ada.toast({ kind: 'info', text: n ? `${n} öge rafa kondu` : 'Bunlar zaten rafta' });
    if (n) Ada.fx.flash(getComputedStyle(document.documentElement).getPropertyValue('--deniz').trim() || 'pomo');
  });

  // ------------------------------------------------------------ dragging files off the shelf
  island.addEventListener('dragstart', (e) => {
    const all = e.target.closest('[data-all]');
    const item = e.target.closest('.sh-item');
    if (!all && !item) return;
    e.preventDefault();
    dragOut = true;
    setTimeout(() => { dragOut = false; }, 1200);
    ada.shelfDrag(all ? items().map((x) => x.path) : [item.dataset.path]);
  });
  island.addEventListener('dblclick', (e) => {
    const item = e.target.closest('.sh-item');
    if (!item || e.target.closest('[data-act]')) return;
    ada.call('shelf', 'open', item.dataset.path).then((r) => { if (r.ok && r.result) Ada.toast({ kind: 'error', text: 'Açılamadı: ' + r.result }); });
  });

  Ada.tab({
    id: 'shelf',
    label: 'Raf',
    icon: ICON,
    badge() { const n = items().length; return n ? `<span class="tab-n">${n > 9 ? '9+' : n}</span>` : ''; },
    body,
    onLeave() { if (sh.over) setOver(false); },
    onAct(a, id) {
      if (!a.startsWith('sh:')) return false;
      const fn = a.slice(3);
      if (fn === 'remove') ada.call('shelf', 'remove', id);
      if (fn === 'reveal') ada.call('shelf', 'reveal', id);
      if (fn === 'clear') ada.call('shelf', 'clear');
      return true;
    },
  });
})();
