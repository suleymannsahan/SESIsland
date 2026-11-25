'use strict';
/* global Ada */
// Devices on the island: when headphones, a mouse, a keyboard, a controller, a phone or a USB
// drive connects, the collapsed island shows what it is with its battery (when it has one) for a
// few seconds. A battery dropping below the chosen level gets a warning card. The laptop's own
// charger and battery too.
(() => {
  const { S, esc } = Ada;
  const on = () => S.config.deviceCards !== false;
  const threshold = () => (S.config.lowBattery == null ? 20 : Number(S.config.lowBattery));

  const ICONS = {
    audio: '<svg viewBox="0 0 24 24"><path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3.5" y="14" width="4.5" height="6.5" rx="1.6"/><rect x="16" y="14" width="4.5" height="6.5" rx="1.6"/></svg>',
    speaker: '<svg viewBox="0 0 24 24"><path class="f" d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
    mouse: '<svg viewBox="0 0 24 24"><rect x="6.5" y="3.5" width="11" height="17" rx="5.5"/><path d="M12 3.5v5.5"/></svg>',
    keyboard: '<svg viewBox="0 0 24 24"><rect x="2.5" y="6.5" width="19" height="11" rx="2"/><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M7 14h10"/></svg>',
    gamepad: '<svg viewBox="0 0 24 24"><path d="M7 8h10a4.5 4.5 0 0 1 4.3 5.8l-.9 3a2.3 2.3 0 0 1-3.9.9L14.8 16H9.2l-1.7 1.7a2.3 2.3 0 0 1-3.9-.9l-.9-3A4.5 4.5 0 0 1 7 8z"/><path d="M8 11v3M6.5 12.5h3M15.5 12h.01M17.5 13.5h.01"/></svg>',
    phone: '<svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg>',
    watch: '<svg viewBox="0 0 24 24"><rect x="7" y="6.5" width="10" height="11" rx="3"/><path d="M9 6.5l.8-3.5h4.4l.8 3.5M9 17.5l.8 3.5h4.4l.8-3.5M12 10v2.5l1.5 1"/></svg>',
    pen: '<svg viewBox="0 0 24 24"><path d="M15.5 4.5l4 4L9 19H5v-4z"/></svg>',
    computer: '<svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="11" rx="1.5"/><path d="M2 19h20"/></svg>',
    usb: '<svg viewBox="0 0 24 24"><rect x="7.5" y="9" width="9" height="12.5" rx="1.5"/><path d="M9 9V3.5h6V9M10.5 5.5h.01M13.5 5.5h.01"/></svg>',
    other: '<svg viewBox="0 0 24 24"><path d="M7.5 7.5l9 9-4.5 4.5V3l4.5 4.5-9 9"/></svg>',
  };
  const icon = (k) => ICONS[k] || ICONS.other;
  const KIND = { audio: 'Kulaklık', mouse: 'Fare', keyboard: 'Klavye', gamepad: 'Oyun kolu', phone: 'Telefon', watch: 'Saat', pen: 'Kalem', computer: 'Bilgisayar', usb: 'USB bellek', other: 'Bluetooth' };

  function batt(level, charging) {
    const pct = Math.max(0, Math.min(100, Math.round(level)));
    const thr = threshold() || 20;
    const tone = pct <= Math.min(10, thr) ? 'bad' : pct <= thr ? 'warn' : 'ok';
    return `<span class="batt ${tone} ${charging ? 'chg' : ''}" title="Pil %${pct}"><span class="batt-body"><b data-w="${pct}"></b>${charging ? '<svg viewBox="0 0 10 14" class="bolt"><path d="M6 0L1 8h3l-1 6 5-8H5z"/></svg>' : ''}</span><span class="batt-cap"></span></span><span class="batt-n">%${pct}</span>`;
  }
  Ada.battHtml = batt;

  const gb = (b) => (b >= 1e12 ? `${(b / 1e12).toFixed(1)} TB` : `${Math.round(b / 1e9)} GB`);
  function dur(sec) {
    if (!Number.isFinite(sec) || sec <= 0) return '';
    const m = Math.round(sec / 60);
    return m < 60 ? `${m} dk` : `${Math.floor(m / 60)} sa ${m % 60} dk`;
  }

  // a pill on the collapsed island: icon · name · what happened · battery
  function pill(d, what, status, ms, dim) {
    Ada.notice({
      key: `${d.id}:${what}:${d.battery ?? ''}:${Date.now()}`, status, ms,
      html: `<div class="pill dev-pill ${dim ? 'off' : ''}">
        <span class="dev-ic k-${esc(d.kind)}">${icon(d.kind)}</span>
        <span class="proj">${esc(d.name)}</span>
        <span class="act">${esc(what)}</span>
        ${d.battery != null ? batt(d.battery, d.charging) : ''}
      </div>`,
    });
  }

  Ada.onEvent((ev) => {
    if (ev.type === 'device-on' && on()) {
      const what = ev.conn === 'usb' ? (ev.size ? `takıldı · ${gb(ev.size)}` : 'takıldı') : 'bağlandı';
      pill(ev, what, 'done', ev.again ? 3500 : 4500);
      if (!ev.again) Ada.fx.flash('done');
    }
    if (ev.type === 'device-off' && on()) {
      pill({ ...ev, battery: null }, ev.conn === 'usb' ? 'çıkarıldı' : 'ayrıldı', 'idle', 2600, true);
    }
    if (ev.type === 'device-low') {
      Ada.showCard({
        key: 'low:' + ev.id + ev.level, status: 'error', until: Date.now() + 8000,
        html: `<div class="card-head dev-card">
            <span class="dev-ic k-${esc(ev.kind)} warn">${icon(ev.kind)}</span>
            <span class="proj">${esc(ev.name)}</span>
            <span class="what">pili azaldı</span>
            <span class="spacer"></span>${batt(ev.battery, false)}
          </div>
          <p class="msg">${ev.level <= 5 ? 'Birazdan kapanabilir, hemen şarja tak.' : `%${ev.battery} kaldı; şarj etmeyi unutma.`}</p>`,
      });
      Ada.chime('ask');
      Ada.fx.flash('error');
    }
    // the default sound output changed (a speaker or wired headphones; Bluetooth ones come above)
    if (ev.type === 'device' && on()) {
      const hp = ev.kind === 'headphones';
      pill({ id: 'out:' + ev.name, name: ev.name, kind: hp ? 'audio' : 'speaker', battery: ev.battery }, hp ? 'bağlandı' : 'ses çıkışı', hp ? 'done' : 'idle', 3500);
    }
  });

  // ---- the laptop's own battery (desktops report a full, always-charging battery and stay quiet)
  let warned = 100;
  function laptop(b, kind) {
    const level = b.level * 100;
    const d = { id: 'laptop', name: kind === 'plug' ? 'Şarj oluyor' : 'Şarjdan çıkarıldı', kind: 'computer', battery: level, charging: b.charging };
    if (kind !== 'low') {
      const extra = kind === 'plug' ? (dur(b.chargingTime) ? `${dur(b.chargingTime)} sonra dolu` : '') : (dur(b.dischargingTime) ? `yaklaşık ${dur(b.dischargingTime)}` : '');
      pill(d, extra, kind === 'plug' ? 'done' : 'idle', 4000);
      return;
    }
    Ada.showCard({
      key: 'batt:low' + Date.now(), status: 'error', until: Date.now() + 8000,
      html: `<div class="card-head dev-card">${batt(level, false)}<span class="proj">Bilgisayarın pili azaldı</span>
          ${dur(b.dischargingTime) ? `<span class="what">yaklaşık ${esc(dur(b.dischargingTime))}</span>` : ''}</div>
        <p class="msg">Şarj aletini tak.</p>`,
    });
    Ada.chime('ask');
    Ada.fx.flash('error');
  }
  if (navigator.getBattery) {
    navigator.getBattery().then((b) => {
      const desktop = () => b.charging && b.level === 1 && b.chargingTime === 0;
      b.addEventListener('chargingchange', () => {
        if (!on() || desktop()) return;
        warned = 100;
        laptop(b, b.charging ? 'plug' : 'unplug');
      });
      b.addEventListener('levelchange', () => {
        const thr = threshold();
        if (!thr || b.charging) return;
        const pct = Math.round(b.level * 100);
        for (const limit of [...new Set([thr, 10, 5])].filter((x) => x <= thr).sort((x, y) => x - y)) {
          if (pct <= limit && warned > limit) { warned = limit; laptop(b, 'low'); break; }
        }
      });
      Ada.battery = b;
    }).catch(() => {});
  }
  Ada.deviceCard = (b, kind) => laptop(b, kind);   // for tests
})();
