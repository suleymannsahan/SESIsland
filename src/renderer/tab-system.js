'use strict';
/* global Ada, ada */
// System tab: weather, CPU (with a sparkline), RAM, GPU (NVIDIA), battery, uptime.
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

  const DAY = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  const WX = {
    clear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2" class="sun"/><path class="sun" d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></svg>',
    partly: '<svg viewBox="0 0 24 24"><circle cx="9" cy="9" r="3.4" class="sun"/><path class="sun" d="M9 2.5v1.5M2.5 9H4M4.4 4.4l1 1M13.6 4.4l-1 1"/><path d="M8.5 19.5a3.5 3.5 0 0 1 0-7a4.8 4.8 0 0 1 9.2 1.3a2.9 2.9 0 0 1-.4 5.7z"/></svg>',
    cloudy: '<svg viewBox="0 0 24 24"><path d="M7 18.5a4 4 0 0 1 0-8a5.5 5.5 0 0 1 10.5 1.5a3.3 3.3 0 0 1-.5 6.5z"/></svg>',
    fog: '<svg viewBox="0 0 24 24"><path d="M4 9h16M6 13h12M4 17h16"/></svg>',
    drizzle: '<svg viewBox="0 0 24 24"><path d="M7 14.5a3.8 3.8 0 0 1 0-7.6a5.2 5.2 0 0 1 10 1.4a3.1 3.1 0 0 1-.5 6.2z"/><path class="rain" d="M9 18l-.6 1.5M13 18l-.6 1.5M17 18l-.6 1.5"/></svg>',
    rain: '<svg viewBox="0 0 24 24"><path d="M7 14.5a3.8 3.8 0 0 1 0-7.6a5.2 5.2 0 0 1 10 1.4a3.1 3.1 0 0 1-.5 6.2z"/><path class="rain" d="M8.5 17.5l-1 2.5M12.5 17.5l-1 2.5M16.5 17.5l-1 2.5"/></svg>',
    snow: '<svg viewBox="0 0 24 24"><path d="M7 14.5a3.8 3.8 0 0 1 0-7.6a5.2 5.2 0 0 1 10 1.4a3.1 3.1 0 0 1-.5 6.2z"/><path class="snow" d="M8.5 18.5h.01M12.5 19.5h.01M16.5 18.5h.01M10.5 21h.01M14.5 21h.01"/></svg>',
    storm: '<svg viewBox="0 0 24 24"><path d="M7 14.5a3.8 3.8 0 0 1 0-7.6a5.2 5.2 0 0 1 10 1.4a3.1 3.1 0 0 1-.5 6.2z"/><path class="bolt" d="M12.5 15l-2.5 4h2.5l-1.5 3.5"/></svg>',
  };
  function weatherTile() {
    const w = S.mods.weather;
    if (!w || !w.configured) {
      return `<div class="tile wx-tile empty"><span class="tl">Hava durumu</span><p class="ts">Şehrini bir kere seç, sıcaklık adada görünsün.</p>
        <button class="btn-text sm" data-act="settings" data-id="hava">Şehri seç</button></div>`;
    }
    if (!w.now) return `<div class="tile wx-tile"><span class="tl">${esc(w.place ? w.place.name : 'Hava durumu')}</span><p class="ts">${esc(w.error || 'Alınıyor…')}</p></div>`;
    const days = (w.days || []).slice(1, 4);
    return `<div class="tile wx-tile">
      <span class="tl">${esc(w.place.name)}</span>
      <div class="wx-now"><span class="wx-ic big">${WX[w.now.kind] || WX.cloudy}</span><b>${w.now.temp}°</b>
        <span class="wx-txt">${esc(w.now.text)}<small>hissedilen ${w.now.feels}° · rüzgâr ${w.now.wind} km/s</small></span></div>
      <div class="wx-days">${days.map((d) => `<span class="wx-d" title="${esc(d.text)}${d.rain != null ? ` · yağış %${d.rain}` : ''}"><i>${DAY[new Date(d.date + 'T12:00').getDay()]}</i><span class="wx-ic">${WX[d.kind] || WX.cloudy}</span><em>${d.max}° <s>${d.min}°</s></em></span>`).join('')}</div>
    </div>`;
  }

  function tiles() {
    const s = S.mods.system;
    if (!s) return '<p class="hint-l">Ölçülüyor…</p>';
    const memPct = Math.round((s.memUsed / s.memTotal) * 100);
    const gpu = s.gpu;
    const bat = battery;
    return `
      ${weatherTile()}
      <div class="tile">
        <span class="tl">İşlemci</span>
        <b class="${tone(s.cpu, 70, 90)}">%${s.cpu}</b>
        ${spark(s.cpuHistory)}
        <span class="ts" title="${esc(s.cpuModel)} · açık kalma ${uptime(s.uptime)}">${s.cores} çekirdek · ${uptime(s.uptime)} açık</span>
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
`;
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
