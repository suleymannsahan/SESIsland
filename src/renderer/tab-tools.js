'use strict';
/* global Ada, ada, AdaCalc, AdaElec */
// Tools tab: engineering calculator, resistor colour code, unit converter, quick note, clipboard history.
(() => {
  const { S, I, esc, ago } = Ada;
  const t = { ans: null, history: [], result: '', error: '', noteTimer: null, tool: 'calc', conv: '' };
  // resistor: 4 or 5 bands, which band is being edited
  const r = { count: 4, bands: AdaElec.toBands(4700, 4), sel: 0 };
  try { t.tool = localStorage.getItem('ada.tool') || 'calc'; } catch { /* no storage */ }

  // ------------------------------------------------------------ resistor colour code
  function bandList() { return AdaElec.bandColors(r.bands); }
  function resistorSvg() {
    const cols = bandList();
    const n = cols.length;
    // body from x=40 to x=190; bands spread, the tolerance band set apart on the right
    const xs = n === 4 ? [62, 84, 106, 160] : [58, 76, 94, 112, 162];
    const bands = cols.map((c, i) => `<rect class="band ${r.sel === i ? 'sel' : ''}" data-act="t:band" data-id="${i}" x="${xs[i]}" y="12" width="12" height="36" rx="2" fill="${c.hex}"><title>${esc(c.name)}</title></rect>`).join('');
    return `<svg class="resistor" viewBox="0 0 230 60" role="img" aria-label="Direnç renk kodu">
      <line x1="0" y1="30" x2="44" y2="30" class="lead"/><line x1="186" y1="30" x2="230" y2="30" class="lead"/>
      <path class="rbody" d="M44 16 q0 -8 10 -8 h18 q6 0 8 4 h70 q2 -4 8 -4 h18 q10 0 10 8 v28 q0 8 -10 8 h-18 q-6 0 -8 -4 h-70 q-2 4 -8 4 h-18 q-10 0 -10 -8 z"/>
      ${bands}
    </svg>`;
  }
  function paletteHtml() {
    const n = bandList().length;
    const last = n - 1;
    let opts;
    if (r.sel === last) opts = [...AdaElec.COLORS, AdaElec.GOLD, AdaElec.SILVER].filter((c) => c.tol != null);
    else if (r.sel === last - 1) opts = [...AdaElec.COLORS, AdaElec.GOLD, AdaElec.SILVER];
    else opts = AdaElec.COLORS;
    return opts.map((c) => `<button class="pc" data-act="t:color" data-id="${c.id}" title="${esc(c.name)}"><i data-c="${c.id}"></i></button>`).join('');
  }
  function resistorValue() {
    const v = AdaElec.fromBands(r.bands);
    const e24 = AdaElec.nearest(v, 24);
    const std = Math.abs(e24 - v) / v < 0.005 ? 'E24 standart değeri' : `En yakın E24: ${AdaElec.si(e24, 'Ω', 3)}`;
    return `<b>${AdaElec.si(v, 'Ω')}</b> <span class="tol">±%${String(r.bands.tol).replace('.', ',')}</span><small>${std}</small>`;
  }
  function resistorHtml() {
    return `<div class="res">
      <div class="res-top"><span data-region="t-rsvg">${resistorSvg()}</span>
        <button class="chip sm" data-act="t:bands" title="Bant sayısı">${r.count} bant</button></div>
      <div class="pal" data-region="t-pal">${paletteHtml()}</div>
      <div class="res-v" data-region="t-rv">${resistorValue()}</div>
      <input type="text" data-rval="1" placeholder="Değer yaz: 4k7, 220, 1M" spellcheck="false" autocomplete="off" aria-label="Direnç değeri">
    </div>`;
  }
  function paintPalette() {
    // colour swatches come from data-c (inline styles are blocked by the page's CSP)
    const all = [...AdaElec.COLORS, AdaElec.GOLD, AdaElec.SILVER];
    Ada.inner.querySelectorAll('.pal i[data-c]').forEach((i) => { const c = all.find((x) => x.id === i.dataset.c); if (c) i.style.background = c.hex; });
  }
  function refreshResistor() {
    for (const [name, html] of [['t-rsvg', resistorSvg()], ['t-pal', paletteHtml()], ['t-rv', resistorValue()]]) {
      const el = Ada.$(`[data-region="${name}"]`);
      if (el) el.innerHTML = html;
    }
    paintPalette();
  }
  function pickColor(id) {
    const n = bandList().length;
    const last = n - 1;
    const all = [...AdaElec.COLORS, AdaElec.GOLD, AdaElec.SILVER];
    const c = all.find((x) => x.id === id);
    if (!c) return;
    if (r.sel === last) r.bands.tol = c.tol;
    else if (r.sel === last - 1) r.bands.mult = c.mult != null ? c.mult : AdaElec.COLORS.indexOf(c);
    else r.bands.digits[r.sel] = AdaElec.COLORS.indexOf(c);
    if (r.bands.digits[0] === 0 && r.sel !== 0) { /* a leading black is allowed but odd; keep it */ }
    r.sel = Math.min(last, r.sel + 1);
    refreshResistor();
  }

  // ------------------------------------------------------------ converter
  function convHtml() {
    const rows = AdaElec.convert(t.conv);
    if (!t.conv.trim()) return '<p class="hint-l">Örnek: <code>20dBm</code> <code>22AWG</code> <code>1kHz</code> <code>100nF</code> <code>10mil</code> <code>25C</code> <code>4k7</code></p>';
    if (!rows.length) return '<p class="hint-l">Bunu tanımadım. Sayının arkasına birim yaz: dBm, dB, W, AWG, mm2, Hz, F, H, mil, mm, C…</p>';
    return rows.map((x) => `<div class="cv-row"><span>${esc(x.k)}</span><b>${esc(x.v)}</b></div>`).join('');
  }

  function toolSegs() {
    const b = (id, label) => `<button class="seg ${t.tool === id ? 'on' : ''}" data-act="t:tool" data-id="${id}">${label}</button>`;
    return `<div class="segs mini tool-segs">${b('calc', 'Hesap')}${b('res', 'Direnç')}${b('conv', 'Çevir')}</div>`;
  }
  function firstColumn() {
    if (t.tool === 'res') return resistorHtml();
    if (t.tool === 'conv') {
      return `<input type="text" data-conv="1" placeholder="20dBm, 22AWG, 1kHz, 100nF…" spellcheck="false" autocomplete="off" aria-label="Dönüştür">
        <div class="conv" data-region="t-conv">${convHtml()}</div>`;
    }
    return `<input type="text" data-calc="1" placeholder="4.7k*2, 1k||1k, 5V/20mA" spellcheck="false" autocomplete="off" aria-label="Hesap">
          <div class="calc-out" data-live="calc-out" aria-live="polite"></div>
          <div class="hist" data-region="t-hist">${calcHtml()}</div>`;
  }

  function calcHtml() {
    const hist = t.history.slice(0, 4).map((h, i) => `<button class="h-row" data-act="t:reuse" data-id="${i}" title="Tekrar kullan"><span>${esc(h.expr)}</span><b>${esc(h.si)}</b></button>`).join('');
    return `${hist || '<p class="hint-l">Örnek: <code>1k||2.2k</code>, <code>12V/220</code>, <code>1/(2pi*50Hz*100nF)</code></p>'}`;
  }

  function clipHtml() {
    const c = S.mods.clip;
    if (!c || !c.enabled) return '<p class="hint-l">Pano geçmişi kapalı. Ayarlar\'dan açabilirsin.</p>';
    if (!c.items.length) return '<p class="hint-l">Kopyaladığın metinler burada görünür. Sadece bellekte tutulur, Ada kapanınca silinir.</p>';
    return c.items.map((x, i) => `<div class="clip-row">
      <button class="clip-text" data-act="t:copy" data-id="${i}" title="Tekrar kopyala">${esc(x.text.replace(/\s+/g, ' ').slice(0, 120))}</button>
      <span class="clip-meta">${ago(x.at)}</span>
      <button class="ic xs" data-act="t:del" data-id="${i}" title="Sil">${I.x}</button>
    </div>`).join('');
  }

  function evaluate(src) {
    if (!src.trim()) { t.result = ''; t.error = ''; return null; }
    try {
      const v = AdaCalc.evaluate(src, t.ans);
      t.error = '';
      t.result = v == null ? '' : `${AdaCalc.si(v)}${AdaCalc.si(v) !== AdaCalc.plain(v) ? `  ·  ${AdaCalc.plain(v)}` : ''}`;
      return v;
    } catch (e) {
      t.result = '';
      t.error = e.message;
      return null;
    }
  }

  function showResult() {
    const r = Ada.$('[data-live="calc-out"]');
    if (!r) return;
    r.textContent = t.error ? t.error : t.result ? `= ${t.result}` : '';
    r.classList.toggle('err', !!t.error);
  }

  const island = Ada.island;
  island.addEventListener('input', (e) => {
    if (e.target.matches('[data-calc]')) { evaluate(e.target.value); showResult(); }
    if (e.target.matches('[data-conv]')) {
      t.conv = e.target.value;
      const el = Ada.$('[data-region="t-conv"]');
      if (el) el.innerHTML = convHtml();
    }
    if (e.target.matches('[data-rval]')) {
      const q = AdaElec.parse(e.target.value);
      const b = q && (q.unit === 'R' || q.unit === '') ? AdaElec.toBands(q.v, r.count) : null;
      e.target.classList.toggle('bad', !!e.target.value.trim() && !b);
      if (b) { r.bands = b; refreshResistor(); }
    }
    if (e.target.matches('[data-note]')) {
      clearTimeout(t.noteTimer);
      const v = e.target.value;
      S.mods.notes = { text: v };
      t.noteTimer = setTimeout(() => ada.call('notes', 'set', v), 500);
    }
  });
  island.addEventListener('keydown', (e) => {
    if (!e.target.matches('[data-calc]')) return;
    if (e.key === 'Enter') {
      const src = e.target.value;
      const v = evaluate(src);
      if (v != null) {
        t.ans = v;
        t.history.unshift({ expr: src, v, si: AdaCalc.si(v) });
        t.history = t.history.slice(0, 20);
        e.target.value = '';
        t.result = `${AdaCalc.si(v)}  ·  ans`;
        showResult();
        const h = Ada.$('[data-region="t-hist"]');
        if (h) h.innerHTML = calcHtml();
      }
    }
    if (e.key === 'ArrowUp' && t.history[0]) { e.preventDefault(); e.target.value = t.history[0].expr; evaluate(e.target.value); showResult(); }
  });

  Ada.tab({
    id: 'tools',
    label: 'Araçlar',
    icon: I.tools,
    body() {
      const note = (S.mods.notes && S.mods.notes.text) || '';
      return `<div class="t-grid">
        <section class="t-col calc">
          ${toolSegs()}
          ${firstColumn()}
        </section>
        <section class="t-col">
          <h3>Not</h3>
          <textarea data-note="1" placeholder="Aklına geleni yaz, kendiliğinden kaydedilir." spellcheck="false" aria-label="Not">${esc(note)}</textarea>
        </section>
        <section class="t-col">
          <div class="t-head"><h3>Pano</h3>${S.mods.clip && S.mods.clip.items && S.mods.clip.items.length ? '<button class="btn-text sm" data-act="t:clear">Temizle</button>' : ''}</div>
          <div class="clips" data-region="t-clip">${clipHtml()}</div>
        </section>
      </div>`;
    },
    after() {
      showResult();
      paintPalette();
      const c = Ada.$('[data-conv]');
      if (c && document.activeElement !== c) c.value = t.conv;
    },
    onAct(a, id) {
      if (!a.startsWith('t:')) return false;
      const fn = a.slice(2);
      if (fn === 'tool') {
        t.tool = id;
        try { localStorage.setItem('ada.tool', id); } catch { /* no storage */ }
        Ada.render();
        return true;
      }
      if (fn === 'band') { r.sel = Number(id); refreshResistor(); return true; }
      if (fn === 'color') { pickColor(id); return true; }
      if (fn === 'bands') {
        const v = AdaElec.fromBands(r.bands);
        r.count = r.count === 4 ? 5 : 4;
        r.bands = AdaElec.toBands(v, r.count) || AdaElec.toBands(4700, r.count);
        r.sel = 0;
        Ada.render();
        return true;
      }
      if (fn === 'copy') { ada.call('clip', 'copy', Number(id)); Ada.toast({ kind: 'info', text: 'Kopyalandı' }); }
      if (fn === 'del') ada.call('clip', 'remove', Number(id));
      if (fn === 'clear') ada.call('clip', 'clear');
      if (fn === 'reuse') {
        const h = t.history[Number(id)];
        const input = Ada.$('[data-calc]');
        if (h && input) { input.value = h.expr; evaluate(h.expr); showResult(); }
      }
      return true;
    },
  });
})();
