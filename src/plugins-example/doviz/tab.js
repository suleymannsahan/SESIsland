'use strict';
/* global Ada, ada */
// Example Ada plugin: exchange rates. A plugin is just a tab registered with Ada.tab().
// It can draw with Ada's own styles, call ada.call('plugins', 'fetch', { url }) for https data
// and keep a little JSON with ada.call('plugins', 'load' | 'save', …).
(() => {
  const ID = 'doviz';
  const { esc } = Ada;
  const CUR = [['USD', 'Dolar'], ['EUR', 'Euro'], ['GBP', 'Sterlin']];
  const st = { rates: null, date: '', loading: false, error: '', amount: '100', from: 'USD' };

  async function load() {
    if (st.loading) return;
    st.loading = true;
    Ada.render();
    try {
      const r = await ada.call('plugins', 'fetch', { url: 'https://api.frankfurter.app/latest?from=TRY&to=USD,EUR,GBP' });
      if (!r.ok || r.result.status !== 200) throw new Error((r.result && r.result.status) || r.error);
      const j = JSON.parse(r.result.text);
      // TRY -> X; we want X -> TRY
      st.rates = Object.fromEntries(Object.entries(j.rates).map(([k, v]) => [k, 1 / v]));
      st.date = j.date;
      st.error = '';
      ada.call('plugins', 'save', { id: ID, data: { rates: st.rates, date: st.date } });
    } catch (e) {
      st.error = 'Kurlar alınamadı';
    }
    st.loading = false;
    Ada.render();
  }

  const fmt = (n, d = 2) => Number(n).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });

  function body() {
    if (!st.rates) {
      return `<div class="dv-empty">${st.loading ? 'Kurlar alınıyor…' : esc(st.error || 'Kurlar yüklenmedi')}
        ${st.loading ? '' : '<button class="btn-text sm" data-act="dv:refresh">Yenile</button>'}</div>`;
    }
    const amt = Number(String(st.amount).replace(',', '.')) || 0;
    return `<div class="dv">
      <div class="dv-cards">${CUR.map(([c, name]) => `
        <div class="tile dv-card ${st.from === c ? 'on' : ''}" data-act="dv:from" data-id="${c}">
          <span class="tl">${name}</span><b>${fmt(st.rates[c], 3)} ₺</b><span class="ts">1 ${c}</span>
        </div>`).join('')}</div>
      <div class="dv-conv">
        <h3>Çevir</h3>
        <div class="dv-row"><input type="text" data-dvamt="1" value="${esc(st.amount)}" aria-label="Miktar"><span class="dv-cur">${st.from}</span></div>
        <div class="dv-out" data-region="dv-out">= <b>${fmt(amt * st.rates[st.from])} ₺</b></div>
        <p class="hint-l">ECB kuru · ${esc(st.date)} <button class="btn-text sm" data-act="dv:refresh">Yenile</button></p>
      </div>
    </div>`;
  }

  Ada.island.addEventListener('input', (e) => {
    if (!e.target.matches('[data-dvamt]')) return;
    st.amount = e.target.value;
    Ada.render();
  });

  Ada.tab({
    id: 'plugin-doviz',
    label: 'Döviz',
    icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M14.5 8.8c-.6-.8-1.5-1.2-2.6-1.2-1.6 0-2.6.8-2.6 2 0 2.8 5.6 1.5 5.6 4.5 0 1.2-1.1 2.1-2.8 2.1-1.2 0-2.2-.5-2.8-1.3M12 6v1.6M12 16.2V18"/></svg>',
    body,
    onEnter() { if (!st.rates || Date.now() - (st.loadedAt || 0) > 3600000) { st.loadedAt = Date.now(); load(); } },
    onAct(a, id) {
      if (!a.startsWith('dv:')) return false;
      if (a === 'dv:refresh') load();
      if (a === 'dv:from') { st.from = id; Ada.render(); }
      return true;
    },
    init() {
      ada.call('plugins', 'load', ID).then((r) => { if (r.ok && r.result && r.result.rates && !st.rates) { st.rates = r.result.rates; st.date = r.result.date; Ada.render(); } });
    },
  });
})();
