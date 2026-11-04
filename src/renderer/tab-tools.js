'use strict';
/* global Ada, ada, AdaCalc */
// Tools tab: engineering calculator, quick note, clipboard history.
(() => {
  const { S, I, esc, ago } = Ada;
  const t = { ans: null, history: [], result: '', error: '', noteTimer: null };

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
          <h3>Hesap</h3>
          <input type="text" data-calc="1" placeholder="4.7k*2, 1k||1k, 5V/20mA" spellcheck="false" autocomplete="off" aria-label="Hesap">
          <div class="calc-out" data-live="calc-out" aria-live="polite"></div>
          <div class="hist" data-region="t-hist">${calcHtml()}</div>
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
    after() { showResult(); },
    onAct(a, id) {
      if (!a.startsWith('t:')) return false;
      const fn = a.slice(2);
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
