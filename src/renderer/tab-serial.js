'use strict';
/* global Ada, ada */
// Serial tab: pick a COM port and baud rate, read the log (PASS green, FAIL red), plot numbers, send lines.
(() => {
  const { S, I, esc } = Ada;
  const BAUDS = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];
  const COLORS = ['#5cc8c4', '#f2b544', '#9bd17a', '#f07c6b'];
  const st = { ports: null, loading: false, port: '', baud: 115200, view: 'log', follow: true };

  const ser = () => S.mods.serial || { status: 'closed', lines: [], series: {} };

  async function refreshPorts() {
    st.loading = true;
    Ada.render();
    const r = await ada.call('serial', 'list');
    st.loading = false;
    st.ports = r.ok ? r.result : [];
    if (!st.port && st.ports.length) st.port = st.ports[st.ports.length - 1].port;
    Ada.render();
  }

  function leftHtml() {
    const s = ser();
    const open = s.status === 'open' || s.status === 'opening';
    const ports = st.ports;
    const portList = st.loading ? '<p class="hint-l">Portlar aranıyor…</p>'
      : !ports ? '' : !ports.length ? '<p class="hint-l">Bağlı seri cihaz yok. Kartı tak ve yenile.</p>'
        : ports.map((p) => `<button class="chip port ${st.port === p.port ? 'on' : ''}" data-act="s:port" data-id="${esc(p.port)}" title="${esc(p.name)}" ${open ? 'disabled' : ''}>${esc(p.port)}${p.name ? `<small>${esc(p.name.slice(0, 22))}</small>` : ''}</button>`).join('');
    const statusText = { closed: 'Kapalı', opening: 'Açılıyor…', open: `${esc(s.port)} · ${s.baud}`, error: esc(s.error || 'Hata') }[s.status];
    return `
      <div class="s-head"><h3>Seri port</h3><button class="ic xs" data-act="s:refresh" title="Portları yenile" ${open ? 'disabled' : ''}>${I.repeat}</button></div>
      <div class="ports">${portList}</div>
      <div class="baud">
        <button class="chip" data-act="s:baud" data-id="-1" ${open ? 'disabled' : ''} aria-label="Daha düşük baud">‹</button>
        <span class="baud-v">${st.baud}</span>
        <button class="chip" data-act="s:baud" data-id="1" ${open ? 'disabled' : ''} aria-label="Daha yüksek baud">›</button>
        <span class="baud-u">baud</span>
      </div>
      <div class="s-actions">
        ${open ? '<button class="btn-deny" data-act="s:close">Bağlantıyı kes</button>' : `<button class="btn-allow" data-act="s:open" ${st.port ? '' : 'disabled'}>Bağlan</button>`}
        <span class="s-status ${s.status}">${statusText}</span>
      </div>`;
  }

  function logHtml() {
    const s = ser();
    if (!s.lines.length) return `<p class="hint-l">${s.status === 'open' ? 'Veri bekleniyor…' : 'Bir port seçip bağlan. ESP32 / Arduino çıktısı burada akar; içinde PASS geçen satırlar yeşil, FAIL geçenler kırmızı olur.'}</p>`;
    return s.lines.map((l) => `<div class="ln ${l.kind} ${l.dir}">${l.dir === 'tx' ? '<em>›</em>' : ''}${esc(l.text)}</div>`).join('');
  }

  function legendHtml() {
    const keys = Object.keys(ser().series || {});
    if (!keys.length) return '<p class="hint-l">Satırlardaki sayılar burada çizilir. Örnek: <code>temp:23.5 hum:41</code></p>';
    return keys.map((k, i) => {
      const arr = ser().series[k];
      return `<span class="lg"><i class="c${i}"></i>${esc(k)} <b>${+Number(arr[arr.length - 1]).toPrecision(5)}</b></span>`;
    }).join('');
  }

  function drawPlot(root) {
    const cv = root.querySelector('canvas[data-plot]');
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const series = Object.values(ser().series || {});
    if (!series.length) return;
    let min = Infinity, max = -Infinity;
    for (const a of series) for (const v of a) { if (v < min) min = v; if (v > max) max = v; }
    if (min === max) { min -= 1; max += 1; }
    const pad = (max - min) * 0.08;
    min -= pad; max += pad;
    g.strokeStyle = 'rgba(232,238,243,.08)';
    g.lineWidth = 1;
    for (let k = 1; k < 4; k++) { const y = Math.round((h * k) / 4) + 0.5; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = 'rgba(147,163,180,.8)';
    g.font = '10px "Segoe UI", system-ui';
    g.fillText(String(+max.toPrecision(4)), 4, 11);
    g.fillText(String(+min.toPrecision(4)), 4, h - 4);
    series.forEach((a, i) => {
      g.strokeStyle = COLORS[i % COLORS.length];
      g.lineWidth = 1.6;
      g.beginPath();
      const n = Math.max(2, a.length);
      a.forEach((v, j) => {
        const x = (j / (n - 1)) * w;
        const y = h - ((v - min) / (max - min)) * h;
        j ? g.lineTo(x, y) : g.moveTo(x, y);
      });
      g.stroke();
    });
  }

  function scrollLog(root) {
    const box = root.querySelector('[data-region="s-log"]');
    if (box && st.follow) box.scrollTop = box.scrollHeight;
  }

  Ada.island.addEventListener('keydown', (e) => {
    if (!e.target.matches('[data-serial-in]') || e.key !== 'Enter') return;
    const v = e.target.value;
    if (!v) return;
    ada.call('serial', 'send', v).then((r) => { if (!r.ok || r.result === false) Ada.toast({ kind: 'error', text: 'Port açık değil' }); });
    e.target.value = '';
  });
  Ada.island.addEventListener('scroll', (e) => {
    if (!e.target.matches || !e.target.matches('[data-region="s-log"]')) return;
    const b = e.target;
    st.follow = b.scrollTop + b.clientHeight >= b.scrollHeight - 12;
  }, true);

  Ada.tab({
    id: 'serial',
    label: 'Seri port',
    icon: I.chip,
    badge() { return ser().status === 'open' ? '<span class="dotb serial"></span>' : ''; },
    body() {
      const s = ser();
      return `<div class="s-grid">
        <div class="s-left" data-region="s-left">${leftHtml()}</div>
        <div class="s-right">
          <div class="segs mini">
            <button class="seg ${st.view === 'log' ? 'on' : ''}" data-act="s:view" data-id="log">Çıktı</button>
            <button class="seg ${st.view === 'plot' ? 'on' : ''}" data-act="s:view" data-id="plot">Grafik</button>
            <span class="spacer"></span>
            <button class="btn-text sm" data-act="s:clear">Temizle</button>
          </div>
          ${st.view === 'log'
            ? `<div class="s-log" data-region="s-log">${logHtml()}</div>`
            : `<div class="s-plot"><canvas data-plot="1"></canvas><div class="legend" data-region="s-legend">${legendHtml()}</div></div>`}
          <input type="text" class="s-in" data-serial-in="1" placeholder="${s.status === 'open' ? 'Gönder (Enter)' : 'Bağlanınca buradan veri gönderebilirsin'}" spellcheck="false" autocomplete="off" aria-label="Seri porta gönder">
        </div>
      </div>`;
    },
    after(root) { scrollLog(root); drawPlot(root); },
    tick(root, force, visible) { if (visible && st.view === 'plot' && force) drawPlot(root); },
    onEnter() { if (!st.ports) refreshPorts(); },
    onMod(mod) { if (mod === 'serial' && st.view === 'plot') requestAnimationFrame(() => drawPlot(Ada.inner)); },
    onAct(a, id) {
      if (!a.startsWith('s:')) return false;
      const fn = a.slice(2);
      if (fn === 'refresh') refreshPorts();
      if (fn === 'port') { st.port = id; Ada.render(); }
      if (fn === 'baud') {
        const i = BAUDS.indexOf(st.baud);
        st.baud = BAUDS[Math.max(0, Math.min(BAUDS.length - 1, (i < 0 ? 4 : i) + Number(id)))];
        Ada.render();
      }
      if (fn === 'open') { st.follow = true; ada.call('serial', 'open', { port: st.port, baud: st.baud }); }
      if (fn === 'close') ada.call('serial', 'close');
      if (fn === 'clear') ada.call('serial', 'clear');
      if (fn === 'view') { st.view = id; Ada.render(); }
      return true;
    },
  });
})();
