'use strict';
/* global Ada, ada */
// Claude tab: sessions (click to jump to the window) and plan usage.
(() => {
  const { S, I, esc, ago, live, primarySession } = Ada;
  const sourceName = (s) => (s.source === 'desktop' ? 'Desktop' : 'Claude Code');
  let view = 'sessions';   // sessions | usage
  const DAY = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  const fmtTok = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));

  // ------------------------------------------------------------ usage charts
  function tokenChart() {
    const t = S.mods.tokens;
    if (!t || !t.available || !t.days || !t.days.length) return '<p class="hint-l">Claude Code oturumu bulunamadı. Token sayıları bu bilgisayardaki Claude Code kayıtlarından okunur.</p>';
    const W = 300, H = 132, top = 16, bottom = 20, gap = 8;
    const vals = t.days.map((d) => d.in + d.out + d.cw);
    const max = Math.max(1, ...vals);
    const bw = (W - gap * (vals.length - 1)) / vals.length;
    const today = vals.length - 1;
    const bars = vals.map((v, i) => {
      const h = Math.max(v ? 2 : 0, ((H - top - bottom) * v) / max);
      const x = i * (bw + gap);
      const y = H - bottom - h;
      const d = new Date(t.days[i].day + 'T12:00');
      return `<g><title>${DAY[d.getDay()]} · ${fmtTok(v)} token (yazılan ${fmtTok(t.days[i].out)})</title>
        <rect class="tk-bar ${i === today ? 'today' : ''}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3"/>
        ${v ? `<text class="tk-v" x="${(x + bw / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}">${fmtTok(v)}</text>` : ''}
        <text class="tk-d ${i === today ? 'today' : ''}" x="${(x + bw / 2).toFixed(1)}" y="${H - 5}">${i === today ? 'Bugün' : DAY[d.getDay()]}</text></g>`;
    }).join('');
    const week = vals.reduce((a, b) => a + b, 0);
    return `<div class="u-chart"><div class="u-ch-head"><h3>Günlük token</h3><span>7 günde ${fmtTok(week)}</span></div>
      <svg viewBox="0 0 ${W} ${H}" class="tk-svg" role="img" aria-label="Son 7 günün günlük token kullanımı">${bars}</svg></div>`;
  }

  function limitChart() {
    const pts = ((S.mods.usageHistory && S.mods.usageHistory.points) || []).filter((p) => p.week != null);
    const u = S.mods.usage;
    if (!pts.length) {
      return `<div class="u-chart"><div class="u-ch-head"><h3>Haftalık limit</h3></div><p class="hint-l">${u && u.available ? 'Geçmiş toplanıyor; birkaç saat sonra çizgi burada belirir.' : 'Limit bilgisi için Claude Code\'a giriş yapılmış olmalı.'}</p></div>`;
    }
    const W = 220, H = 132, top = 10, bottom = 20, left = 26;
    const end = Date.now();
    const start = end - 7 * 86400000;
    const xs = (t) => left + ((t - start) / (end - start)) * (W - left - 4);
    const ys = (v) => top + (1 - v / 100) * (H - top - bottom);
    const recent = pts.filter((p) => p.t >= start);
    const line = recent.map((p, i) => `${i ? 'L' : 'M'}${xs(p.t).toFixed(1)},${ys(p.week).toFixed(1)}`).join(' ');
    const last = recent[recent.length - 1] || pts[pts.length - 1];
    const grid = [0, 50, 100].map((v) => `<line class="lm-grid" x1="${left}" x2="${W - 4}" y1="${ys(v)}" y2="${ys(v)}"/><text class="lm-ax" x="${left - 4}" y="${ys(v) + 3}">%${v}</text>`).join('');
    const ticks = [6, 4, 2, 0].map((k) => { const t = end - k * 86400000; const d = new Date(t); return `<text class="tk-d" x="${xs(t).toFixed(1)}" y="${H - 5}">${k ? DAY[d.getDay()] : 'Bugün'}</text>`; }).join('');
    const tone = last.week >= 90 ? 'bad' : last.week >= 70 ? 'warn' : '';
    return `<div class="u-chart"><div class="u-ch-head"><h3>Haftalık limit</h3><span class="${tone}">şu an %${last.week}</span></div>
      <svg viewBox="0 0 ${W} ${H}" class="lm-svg ${tone}" role="img" aria-label="Son 7 günde haftalık limit">${grid}
        ${recent.length > 1 ? `<path class="lm-area" d="${line} L${xs(last.t).toFixed(1)},${ys(0)} L${xs(recent[0].t).toFixed(1)},${ys(0)} Z"/><path class="lm-line" d="${line}"/>` : ''}
        <circle class="lm-dot" cx="${xs(last.t).toFixed(1)}" cy="${ys(last.week).toFixed(1)}" r="3"/>${ticks}</svg></div>`;
  }

  function projectsHtml() {
    const t = S.mods.tokens;
    const list = (t && t.projects) || [];
    if (!list.length) return '';
    const max = list[0].tokens || 1;
    return `<div class="u-proj"><h3>En çok çalışılan</h3>${list.map((p) => `
      <div class="up-row"><span class="up-name" title="${esc(p.name)}">${esc(p.name)}</span><span class="up-n">${fmtTok(p.tokens)}</span>
        <span class="up-bar"><b data-w="${Math.round((p.tokens / max) * 100)}"></b></span></div>`).join('')}</div>`;
  }

  function usageView() {
    return `<div class="u-view">${tokenChart()}${limitChart()}${projectsHtml()}</div>`;
  }
  const viewSw = () => `<div class="segs mini c-sw"><button class="seg ${view === 'sessions' ? 'on' : ''}" data-act="c:view" data-id="sessions">Oturumlar</button><button class="seg ${view === 'usage' ? 'on' : ''}" data-act="c:view" data-id="usage">Kullanım</button></div>`;

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
          ${(s.status === 'done' || s.status === 'idle') && s.lastMessage
            ? `<span class="act msg2" title="${esc(s.lastMessage)}">${esc(s.lastMessage)}</span>`
            : `<span class="act">${esc(s.activity)}${s.status === 'working' && s.prompt ? `<em> · ${esc(s.prompt)}</em>` : ''}</span>`}
        </button>`).join('');
      if (view === 'usage') {
        return `<div class="c-wrap"><div class="c-top"><div data-region="usage">${usageHtml()}</div>${viewSw()}</div>
          <div data-region="uview">${usageView()}</div></div>`;
      }
      return `<div class="c-wrap">
        <div class="c-top"><div data-region="usage">${usageHtml()}</div>${viewSw()}</div>
        <div data-region="rows" class="rows-wrap">${S.claude.sessions.length
          ? `<div class="rows">${rows}</div>`
          : `<p class="empty">Şu an çalışan bir şey yok. <b>Claude Code</b>'da yeni bir oturum başlat ya da Claude Desktop'ta bir mesaj gönder.</p>`}</div>
      </div>`;
    },
    onAct(act, id) {
      if (act === 'c:view') {
        view = id === 'usage' ? 'usage' : 'sessions';
        if (view === 'usage') ada.call('usage', 'tokens');
        Ada.render();
        return true;
      }
      if (act !== 'jump') return false;
      const s = S.claude.sessions.find((x) => x.id === id);
      if (s) ada.focusSession({ source: s.source, project: s.project });
      return true;
    },
  });
})();
