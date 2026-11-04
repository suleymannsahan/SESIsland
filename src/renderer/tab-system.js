'use strict';
/* global Ada, ada */
// System tab: CPU (with a sparkline), RAM, GPU (NVIDIA), battery, uptime.
(() => {
  const { S, I, esc } = Ada;
  let battery = null;

  const gb = (b) => (b / 1024 ** 3).toFixed(1);
  function spark(arr) {
    if (!arr || arr.length < 2) return '';
    const w = 120, h = 32;
    const pts = arr.map((v, i) => `${((i / (arr.length - 1)) * w).toFixed(1)},${(h - (v / 100) * h).toFixed(1)}`).join(' ');
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}"/></svg>`;
  }
  const tone = (pct, warn, bad) => (pct >= bad ? 'bad' : pct >= warn ? 'warn' : '');
  function uptime(sec) {
    const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
    return d ? `${d} gün ${h} sa` : h ? `${h} sa ${m} dk` : `${m} dk`;
  }

  function tiles() {
    const s = S.mods.system;
    if (!s) return '<p class="hint-l">Ölçülüyor…</p>';
    const memPct = Math.round((s.memUsed / s.memTotal) * 100);
    const gpu = s.gpu;
    const bat = battery;
    return `
      <div class="tile">
        <span class="tl">İşlemci</span>
        <b class="${tone(s.cpu, 70, 90)}">%${s.cpu}</b>
        ${spark(s.cpuHistory)}
        <span class="ts" title="${esc(s.cpuModel)}">${s.cores} çekirdek</span>
      </div>
      <div class="tile">
        <span class="tl">Bellek</span>
        <b class="${tone(memPct, 80, 92)}">%${memPct}</b>
        <span class="meter"><i data-w="${memPct}"></i></span>
        <span class="ts">${gb(s.memUsed)} / ${gb(s.memTotal)} GB</span>
      </div>
      <div class="tile">
        <span class="tl">Ekran kartı</span>
        ${gpu ? `<b class="${tone(gpu.temp, 75, 85)}">${gpu.temp}°C</b>
          <span class="meter"><i data-w="${gpu.util}"></i></span>
          <span class="ts" title="${esc(gpu.name)}">%${gpu.util} · ${(gpu.memUsed / 1024).toFixed(1)}/${(gpu.memTotal / 1024).toFixed(0)} GB</span>`
        : '<b class="dim">—</b><span class="ts">NVIDIA kartı bulunamadı</span>'}
      </div>
      <div class="tile">
        <span class="tl">Pil</span>
        ${bat && bat.level != null && !(bat.charging && bat.level === 1 && bat.chargingTime === 0 && !bat.real)
          ? `<b class="${bat.level < 0.15 && !bat.charging ? 'bad' : ''}">%${Math.round(bat.level * 100)}</b>
             <span class="meter"><i data-w="${Math.round(bat.level * 100)}"></i></span>
             <span class="ts">${bat.charging ? 'şarj oluyor' : 'pilde'}</span>`
          : '<b class="dim">—</b><span class="ts">Pil yok (masaüstü)</span>'}
      </div>
      <div class="tile">
        <span class="tl">Açık kalma</span>
        <b class="sm">${uptime(s.uptime)}</b>
        <span class="ts">son yeniden başlatmadan beri</span>
      </div>`;
  }

  async function watchBattery() {
    try {
      const b = await navigator.getBattery();
      const upd = () => {
        // Desktops report a full, charging, never-changing battery; treat that as "no battery".
        const real = !(b.charging && b.level === 1 && b.chargingTime === 0 && b.dischargingTime === Infinity);
        battery = { level: b.level, charging: b.charging, chargingTime: b.chargingTime, real };
        if (!real) battery = null;
        Ada.render();
      };
      ['levelchange', 'chargingchange'].forEach((ev) => b.addEventListener(ev, upd));
      upd();
    } catch { battery = null; }
  }

  Ada.tab({
    id: 'system',
    label: 'Sistem',
    icon: I.gauge,
    body() { return `<div class="sys" data-region="sys">${tiles()}</div>`; },
    onEnter() { ada.call('system', 'fast', true); },
    onLeave() { ada.call('system', 'fast', false); },
    init() { watchBattery(); },
  });
})();
