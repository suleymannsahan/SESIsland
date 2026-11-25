'use strict';
/* global Ada, ada */
// Cards for the colour picker and QR codes.
(() => {
  const { esc } = Ada;

  function hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
    }
    return `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
  }

  Ada.onEvent((ev) => {
    if (ev.type === 'color') {
      const rgb = `rgb(${ev.r}, ${ev.g}, ${ev.b})`;
      const formats = [ev.hex, rgb, hsl(ev.r, ev.g, ev.b)];
      Ada.showCard({
        key: 'color' + ev.hex + Date.now(), status: 'idle', until: Date.now() + 15000,
        html: `<div class="color-card">
          <span class="swatch" data-bg="${esc(ev.hex)}"></span>
          <div class="cc-main">
            <div class="card-head"><span class="proj">${esc(ev.hex)}</span><span class="what">panoya kopyalandı</span></div>
            <div class="cc-fmts">${formats.map((f) => `<button class="chip sm" data-act="x:copy" data-id="${esc(f)}" title="Kopyala">${esc(f)}</button>`).join('')}</div>
          </div>
          <div class="cc-acts"><button class="btn-text sm" data-act="x:pick">Yeniden seç</button><button class="btn-text sm" data-act="closeCard">Kapat</button></div>
        </div>`,
      });
      setTimeout(paint, 30);
    }
    if (ev.type === 'qr') {
      Ada.showCard({
        key: 'qr' + Date.now(), status: 'idle', sticky: true,
        html: `<div class="qr-card">
          <img class="qr-img" src="${esc(ev.url)}" alt="QR kod">
          <div class="qr-main">
            <div class="card-head"><span class="proj">QR kod</span></div>
            <p class="msg qr-text" title="${esc(ev.text)}">${esc(ev.text)}</p>
            <div class="actions"><button class="btn-allow sm" data-act="x:qrcopy">Kopyala</button><button class="btn-text sm" data-act="x:qrsave" title="Masaüstüne PNG olarak kaydet">Kaydet</button><button class="btn-text sm" data-act="closeCard">Kapat</button></div>
          </div>
        </div>`,
      });
    }
  });

  // swatch colour from data-bg (inline styles are blocked by the CSP)
  function paint() { Ada.inner.querySelectorAll('[data-bg]').forEach((el) => { el.style.background = el.dataset.bg; }); }
  const obs = new MutationObserver(paint);
  obs.observe(Ada.inner, { childList: true, subtree: true });

  Ada.onAct((act, id) => {
    if (!act.startsWith('x:')) return false;
    const fn = act.slice(2);
    if (fn === 'pick') { Ada.closeCard(); setTimeout(() => ada.call('picker', 'color'), 250); }
    if (fn === 'copy') ada.call('palette', 'copy', id).then(() => Ada.toast({ kind: 'info', text: `Kopyalandı · ${id}` }));
    if (fn === 'qr') ada.call('qr', 'make', '').then((r) => { if (!r.ok) Ada.toast({ kind: 'error', text: r.error }); });
    if (fn === 'qrcopy') ada.call('qr', 'copy').then(() => Ada.toast({ kind: 'info', text: 'QR resmi panoya kopyalandı' }));
    if (fn === 'qrsave') ada.call('qr', 'save').then((r) => r.ok && r.result && Ada.toast({ kind: 'info', text: `Kaydedildi · ${r.result}` }));
    return true;
  });
})();
