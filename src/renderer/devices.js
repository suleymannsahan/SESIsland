'use strict';
/* global Ada */
// Short cards for device changes: headphones connected (with battery when Windows knows it),
// another speaker chosen, charger plugged in or out, battery getting low.
(() => {
  const { S, esc } = Ada;
  const HP = '<svg viewBox="0 0 24 24"><path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3.5" y="14" width="4.5" height="6.5" rx="1.6"/><rect x="16" y="14" width="4.5" height="6.5" rx="1.6"/></svg>';
  const SPK = '<svg viewBox="0 0 24 24"><path class="f" d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
  const on = () => S.config.deviceCards !== false;

  function batt(level, charging) {
    const pct = Math.max(0, Math.min(100, Math.round(level)));
    const tone = pct <= 10 ? 'bad' : pct <= 20 ? 'warn' : 'ok';
    return `<span class="batt ${tone} ${charging ? 'chg' : ''}"><span class="batt-body"><b data-w="${pct}"></b>${charging ? '<svg viewBox="0 0 10 14" class="bolt"><path d="M6 0L1 8h3l-1 6 5-8H5z"/></svg>' : ''}</span><span class="batt-cap"></span></span><span class="batt-n">%${pct}</span>`;
  }

  function dur(sec) {
    if (!Number.isFinite(sec) || sec <= 0) return '';
    const m = Math.round(sec / 60);
    return m < 60 ? `${m} dk` : `${Math.floor(m / 60)} sa ${m % 60} dk`;
  }

  // ---- audio output (from the main process)
  Ada.onEvent((ev) => {
    if (ev.type !== 'device' || !on()) return;
    const hp = ev.kind === 'headphones';
    Ada.showCard({
      key: 'dev:' + ev.name + Date.now(), status: hp ? 'done' : 'idle', until: Date.now() + (hp ? 5000 : 3200),
      html: `<div class="card-head dev-card">
          <span class="dev-ic ${hp ? 'hp' : ''}">${hp ? HP : SPK}</span>
          <span class="proj">${esc(ev.name)}</span>
          <span class="what">${hp ? 'bağlandı' : 'ses çıkışı oldu'}</span>
          ${ev.battery != null ? `<span class="spacer"></span>${batt(ev.battery, false)}` : ''}
        </div>`,
    });
    Ada.fx.flash(hp ? 'done' : 'pomo');
  });

  // ---- laptop battery (Chromium's Battery API; desktops report nothing and stay quiet)
  let warned = 100;
  function card(b, kind) {
    const level = b.level * 100;
    const text = kind === 'plug' ? 'Şarj oluyor' : kind === 'unplug' ? 'Şarjdan çıkarıldı' : 'Pil azaldı';
    const extra = kind === 'plug' ? dur(b.chargingTime) && `${dur(b.chargingTime)} sonra dolu` : dur(b.dischargingTime) && `yaklaşık ${dur(b.dischargingTime)}`;
    Ada.showCard({
      key: 'batt:' + kind + Date.now(), status: kind === 'low' ? 'error' : kind === 'plug' ? 'done' : 'idle', until: Date.now() + (kind === 'low' ? 7000 : 4000),
      html: `<div class="card-head dev-card">
          ${batt(level, b.charging)}
          <span class="proj">${text}</span>
          ${extra ? `<span class="what">${esc(extra)}</span>` : ''}
        </div>`,
    });
    if (kind === 'low') { Ada.chime('ask'); Ada.fx.flash('error'); } else Ada.fx.flash(kind === 'plug' ? 'done' : 'pomo');
  }
  if (navigator.getBattery) {
    navigator.getBattery().then((b) => {
      // a desktop PC: always "charging", full, never changes
      const desktop = () => b.charging && b.level === 1 && b.chargingTime === 0;
      b.addEventListener('chargingchange', () => {
        if (!on() || desktop()) return;
        warned = 100;
        card(b, b.charging ? 'plug' : 'unplug');
      });
      b.addEventListener('levelchange', () => {
        if (!on() || b.charging) return;
        const pct = Math.round(b.level * 100);
        for (const limit of [20, 10, 5]) {
          if (pct <= limit && warned > limit) { warned = limit; card(b, 'low'); break; }
        }
      });
      Ada.battery = b;
    }).catch(() => {});
  }
  Ada.deviceCard = card;   // for tests
})();
