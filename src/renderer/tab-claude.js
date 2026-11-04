'use strict';
/* global Ada, ada */
// Claude tab: sessions (click to jump to the window) and plan usage.
(() => {
  const { S, I, esc, ago, live, primarySession } = Ada;
  const sourceName = (s) => (s.source === 'desktop' ? 'Desktop' : 'Claude Code');

  function resetText(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const mins = Math.round((d - Date.now()) / 60000);
    if (mins <= 0) return 'şimdi sıfırlanıyor';
    if (mins < 60) return `${mins} dk sonra sıfırlanır`;
    if (mins < 24 * 60) return `${Math.floor(mins / 60)} sa ${mins % 60} dk sonra sıfırlanır`;
    const days = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    return `${days[d.getDay()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} sıfırlanır`;
  }

  function usageHtml() {
    const u = S.mods.usage;
    if (!u || !u.available) return '';
    const bar = (label, w) => {
      if (!w) return '';
      const tone = w.pct >= 90 ? 'bad' : w.pct >= 70 ? 'warn' : '';
      return `<div class="u-row">
        <span class="u-label">${label}</span>
        <span class="u-bar ${tone}"><b data-w="${w.pct}"></b></span>
        <span class="u-pct">%${w.pct}</span>
        <span class="u-reset">${esc(resetText(w.resetsAt))}</span>
      </div>`;
    };
    return `<div class="usage">${bar('5 saatlik', u.five)}${bar('Haftalık', u.week)}</div>`;
  }

  Ada.tab({
    id: 'claude',
    label: 'Claude',
    icon: I.terminal,
    badge() {
      const p = primarySession();
      return p && live(p) ? `<span class="glyph" data-s="${esc(p.status)}"></span>` : '';
    },
    wantsFocus() {
      const p = primarySession();
      return p && live(p);
    },
    body() {
      const lead = primarySession();
      const rows = S.claude.sessions.map((s) => `
        <button class="row" data-act="jump" data-id="${esc(s.id)}" title="Pencereye git">
          <span class="glyph" data-s="${esc(s.status)}" ${s === lead ? 'data-morph="glyph"' : ''}></span>
          <span class="proj"><span ${s === lead ? 'data-morph="proj" data-morph-text' : ''}>${esc(s.project)}</span><span class="src">${sourceName(s)}</span></span>
          <span class="time">${ago(s.updatedAt)}</span>
          <span class="act">${esc(s.status === 'done' && s.lastMessage ? s.lastMessage : s.activity)}</span>
        </button>`).join('');
      return `<div class="c-wrap">
        <div data-region="usage">${usageHtml()}</div>
        <div data-region="rows" class="rows-wrap">${S.claude.sessions.length
          ? `<div class="rows">${rows}</div>`
          : `<p class="empty">Şu an çalışan bir şey yok. <b>Claude Code</b>'da yeni bir oturum başlat ya da Claude Desktop'ta bir mesaj gönder.</p>`}</div>
      </div>`;
    },
    onAct(act, id) {
      if (act !== 'jump') return false;
      const s = S.claude.sessions.find((x) => x.id === id);
      if (s) ada.focusSession({ source: s.source, project: s.project });
      return true;
    },
  });
})();
