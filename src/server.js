'use strict';
// Local HTTP server that receives Claude Code hook events and keeps session state.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { describeTool, permissionDetail, lastAssistantText } = require('./describe');

const STALE_MS = 30 * 60 * 1000;
const DONE_LINGER_MS = 9000;

class HookServer extends EventEmitter {
  constructor(port) {
    super();
    this.port = port;
    this.sessions = new Map();     // id -> session
    this.pending = new Map();      // reqId -> { req: publicData, res, sessionId }
    this.seq = 0;
    this.http = null;
    this.timer = null;
  }

  start() {
    this.http = http.createServer((req, res) => this.handle(req, res));
    this.http.on('error', (e) => {
      if (e.code === 'EADDRINUSE') this.emit('error', new Error(`Port ${this.port} kullanımda · Ada zaten açık olabilir`));
      else this.emit('error', e);
    });
    this.http.listen(this.port, '127.0.0.1');
    this.timer = setInterval(() => this.sweep(), 30 * 1000);
  }

  stop() {
    clearInterval(this.timer);
    for (const id of [...this.pending.keys()]) this.answer(id, null);
    if (this.http) this.http.close();
  }

  // ------------------------------------------------------------ http
  handle(req, res) {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end('{"ok":true,"app":"ada"}');
    }
    if (req.method !== 'POST' || !req.url.startsWith('/hook')) {
      res.writeHead(404); return res.end();
    }
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (c) => { body += c; if (body.length > 5e6) req.destroy(); });
    req.on('end', () => {
      let ev;
      try { ev = JSON.parse(body); } catch { res.writeHead(400); return res.end('{}'); }
      try {
        if (/[?&]wait=ask\b/.test(req.url)) return this.onAsk(ev, res);
        this.onHook(ev, res);
      } catch (e) {
        this.emit('error', e);
        if (!res.headersSent) { res.writeHead(200); res.end('{}'); }
      }
    });
  }

  reply(res, obj = {}) {
    if (res.headersSent || res.writableEnded) return;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
  }

  // ------------------------------------------------------------ sessions
  session(ev) {
    const id = ev.session_id || 'bilinmeyen';
    let s = this.sessions.get(id);
    if (!s) {
      const cwd = ev.cwd || '';
      s = {
        id,
        source: 'code',
        project: cwd ? path.basename(cwd) : 'Claude Code',
        cwd,
        status: 'idle',
        activity: '',
        lastMessage: '',
        question: null,
        tools: 0,
        startedAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.sessions.set(id, s);
    }
    s.updatedAt = Date.now();
    if (ev.transcript_path) s.transcript = ev.transcript_path;
    return s;
  }

  onHook(ev, res) {
    const name = ev.hook_event_name;
    const s = this.session(ev);

    switch (name) {
      case 'SessionStart':
        s.status = 'idle';
        s.activity = 'Oturum başladı';
        break;

      case 'UserPromptSubmit':
        s.status = 'working';
        s.activity = 'Düşünüyor…';
        s.prompt = (ev.prompt || '').slice(0, 200);
        s.question = null;
        clearTimeout(s.doneTimer);
        break;

      case 'PreToolUse':
        // A question waiting on the island keeps the session in the question state.
        s.status = s.question && s.question.askId ? 'question' : 'working';
        s.activity = describeTool(ev.tool_name, ev.tool_input);
        s.tools += 1;
        if (ev.tool_name === 'AskUserQuestion' && !(s.question && s.question.askId)) {
          s.status = 'question';
          const q = (ev.tool_input && ev.tool_input.questions && ev.tool_input.questions[0]) || {};
          s.question = {
            text: q.question || 'Claude bir soru soruyor',
            options: (q.options || []).map((o) => o.label).slice(0, 4),
          };
            this.emit('event', { type: 'question', sessionId: s.id, project: s.project, summary: s.question.text });
        }
        break;

      case 'PostToolUse':
        if (s.status !== 'done') s.status = 'working';
        if (s.question) s.question = null;
        this.clearPendingFor(s.id);
        break;

      case 'PermissionRequest': {
        s.status = 'waiting';
        const reqId = `r${++this.seq}`;
        const pub = {
          id: reqId,
          sessionId: s.id,
          project: s.project,
          source: 'code',
          tool: ev.tool_name,
          title: describeTool(ev.tool_name, ev.tool_input),
          detail: permissionDetail(ev.tool_name, ev.tool_input),
          at: Date.now(),
        };
        this.pending.set(reqId, { pub, res, sessionId: s.id });
        // If Claude Code gives up (answered in the terminal, timeout, Ctrl+C) curl closes the socket.
        res.on('close', () => {
          if (this.pending.has(reqId)) { this.pending.delete(reqId); this.afterPermission(s); this.push(); }
        });
        this.emit('event', { type: 'permission', sessionId: s.id, project: s.project, summary: pub.title });
        this.push();
        return; // reply later
      }

      case 'Notification':
        if (/waiting for your input/i.test(ev.message || '') && s.status !== 'done') {
          s.status = 'idle';
          s.activity = 'Senden yanıt bekliyor';
        }
        break;

      case 'Stop':
      case 'SubagentStop':
        if (name === 'SubagentStop') break;
        this.clearPendingFor(s.id);
        s.status = 'done';
        s.question = null;
        s.lastMessage = lastAssistantText(s.transcript) || s.lastMessage;
        s.activity = 'Tamamlandı';
        this.emit('event', { type: 'done', sessionId: s.id, project: s.project, summary: s.lastMessage });
        clearTimeout(s.doneTimer);
        s.doneTimer = setTimeout(() => {
          if (s.status === 'done') { s.status = 'idle'; s.activity = 'Hazır'; this.push(); }
        }, DONE_LINGER_MS);
        break;

      case 'SessionEnd':
        this.clearPendingFor(s.id);
        this.sessions.delete(s.id);
        break;

      default:
        break;
    }
    this.reply(res);
    this.push();
  }

  // AskUserQuestion: hold the hook until the question is answered on the island (or released).
  onAsk(ev, res) {
    if (ev.hook_event_name !== 'PreToolUse' || ev.tool_name !== 'AskUserQuestion') return this.reply(res);
    const s = this.session(ev);
    const questions = ((ev.tool_input && ev.tool_input.questions) || []).slice(0, 4).map((q) => ({
      question: String(q.question || ''),
      header: String(q.header || ''),
      multiSelect: !!q.multiSelect,
      options: (q.options || []).slice(0, 6).map((o) => ({ label: String(o.label || ''), description: String(o.description || '') })),
    }));
    if (!questions.length) return this.reply(res);
    const askId = `a${++this.seq}`;
    this.asks = this.asks || new Map();
    this.asks.set(askId, { res, sessionId: s.id, input: ev.tool_input });
    s.status = 'question';
    s.question = { askId, text: questions[0].question, options: questions[0].options.map((o) => o.label), questions };
    res.on('close', () => {
      if (this.asks.has(askId)) {
        this.asks.delete(askId);
        if (s.question && s.question.askId === askId) s.question = { ...s.question, askId: null };
        this.push();
      }
    });
    this.emit('event', { type: 'question', sessionId: s.id, project: s.project, summary: questions[0].question });
    this.push();
  }

  /** answers: { [question text]: "label" | ["label", ...] } or null to answer in the terminal. */
  answerAsk(askId, answers) {
    const a = this.asks && this.asks.get(askId);
    if (!a) return false;
    this.asks.delete(askId);
    const s = this.sessions.get(a.sessionId);
    if (!answers) {
      this.reply(a.res, {});
      if (s && s.question) s.question = { ...s.question, askId: null };
    } else {
      const flat = Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : String(v)]));
      this.reply(a.res, {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'allow',
          updatedInput: { ...a.input, answers: flat },
        },
      });
      if (s) { s.question = null; s.status = 'working'; s.activity = 'Yanıtın iletildi'; }
    }
    this.push();
    return true;
  }

  afterPermission(s) {
    const stillWaiting = [...this.pending.values()].some((p) => p.sessionId === s.id);
    if (!stillWaiting && s.status === 'waiting') s.status = 'working';
  }

  clearPendingFor(sessionId) {
    for (const [id, p] of this.pending) {
      if (p.sessionId === sessionId) this.answer(id, null);
    }
    for (const [id, a] of (this.asks || new Map())) {
      if (a.sessionId === sessionId) this.answerAsk(id, null);
    }
  }

  // decision: 'allow' | 'deny' | 'ask' (= let the terminal ask)
  decide(reqId, decision) {
    this.answer(reqId, decision);
  }

  answer(reqId, decision) {
    const p = this.pending.get(reqId);
    if (!p) return;
    this.pending.delete(reqId);
    let out = {};
    if (decision === 'allow') {
      out = { hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow' } } };
    } else if (decision === 'deny') {
      out = { hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'deny', message: 'Kullanıcı Ada üzerinden reddetti.' } } };
    }
    this.reply(p.res, out);
    const s = this.sessions.get(p.sessionId);
    if (s) {
      this.afterPermission(s);
      if (decision === 'deny') s.activity = 'İzin reddedildi';
    }
    this.push();
  }

  dismiss(sessionId) {
    const s = this.sessions.get(sessionId);
    if (s && s.status === 'done') { s.status = 'idle'; s.activity = 'Hazır'; this.push(); }
  }

  // ------------------------------------------------------------ Claude Desktop (chat)
  desktopState(st) {
    const id = 'desktop';
    if (st.state === 'gone') {
      this.sessions.delete(id);
      this.pending.delete('desktop:1');
      return this.push();
    }
    let s = this.sessions.get(id);
    if (!s) {
      s = { id, source: 'desktop', project: 'Claude Desktop', status: 'idle', activity: 'Hazır', lastMessage: '', tools: 0, startedAt: Date.now(), updatedAt: Date.now() };
      this.sessions.set(id, s);
    }
    const prev = s.status;
    s.updatedAt = Date.now();
    if (st.title) s.project = st.title;

    if (st.state === 'permission') {
      s.status = 'waiting';
      s.activity = 'İzin istiyor';
      if (!this.pending.has('desktop:1')) {
        const pub = {
          id: 'desktop:1',
          sessionId: id,
          project: s.project,
          source: 'desktop',
          tool: 'Claude Desktop',
          title: st.prompt ? `${st.prompt} · kullanmak istiyor` : 'Bir araç kullanmak için izin istiyor',
          detail: st.prompt ? '' : [...new Set(st.buttons || [])].slice(0, 6).join('  ·  '),
          at: Date.now(),
        };
        this.pending.set('desktop:1', { pub, res: null, sessionId: id });
        this.emit('event', { type: 'permission', sessionId: id, project: s.project, summary: pub.title });
      }
    } else {
      this.pending.delete('desktop:1');
      if (st.state === 'working') {
        s.question = null;
        s.status = 'working';
        s.activity = 'Yanıt yazıyor…';
      } else if (st.state === 'question') {
        if (s.status !== 'question') {
          s.status = 'question';
          s.activity = 'Senden yanıt bekliyor';
          s.question = { text: 'Claude senden bir yanıt bekliyor', options: [] };
          this.emit('event', { type: 'question', sessionId: id, project: s.project, summary: s.question.text });
        }
      } else if (st.state === 'idle') {
        s.question = null;
        if (prev === 'working' || prev === 'waiting' || prev === 'question') {
          s.status = 'done';
          s.activity = 'Tamamlandı';
          this.emit('event', { type: 'done', sessionId: id, project: s.project, summary: 'Yanıt hazır.' });
          clearTimeout(s.doneTimer);
          s.doneTimer = setTimeout(() => { if (s.status === 'done') { s.status = 'idle'; s.activity = 'Hazır'; this.push(); } }, DONE_LINGER_MS);
        } else if (s.status !== 'done') {
          s.status = 'idle';
          s.activity = 'Hazır';
        }
      }
    }
    this.push();
  }

  clearDesktopPermission() {
    this.pending.delete('desktop:1');
    const s = this.sessions.get('desktop');
    if (s && s.status === 'waiting') { s.status = 'working'; s.activity = 'Yanıt yazıyor…'; }
    this.push();
  }

  // ------------------------------------------------------------ state
  sweep() {
    const now = Date.now();
    for (const [id, s] of this.sessions) {
      if (s.source === 'code' && now - s.updatedAt > STALE_MS && ![...this.pending.values()].some((p) => p.sessionId === id)) {
        this.sessions.delete(id);
      }
    }
    this.push();
  }

  snapshot() {
    const sessions = [...this.sessions.values()]
      .map(({ doneTimer, transcript, ...rest }) => rest)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    const permissions = [...this.pending.values()].map((p) => p.pub).sort((a, b) => a.at - b.at);
    return { sessions, permissions };
  }

  push() { this.emit('state', this.snapshot()); }

  // ------------------------------------------------------------ demo (tray → Test bildirimi)
  demo() {
    const fake = (ev) => this.onHook(ev, { headersSent: false, writableEnded: false, writeHead() {}, end() {}, on() {} });
    const sid = 'demo-' + Date.now();
    const base = { session_id: sid, cwd: 'C:/Users/emre/projeler/ada-demo' };
    fake({ ...base, hook_event_name: 'UserPromptSubmit', prompt: 'README dosyasını güncelle' });
    setTimeout(() => fake({ ...base, hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'C:/proj/README.md' } }), 1200);
    setTimeout(() => fake({ ...base, hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: 'C:/proj/README.md' } }), 2600);
    setTimeout(() => {
      const reqId = `r${++this.seq}`;
      const s = this.sessions.get(sid);
      if (!s) return;
      s.status = 'waiting';
      const pub = {
        id: reqId, sessionId: sid, project: s.project, source: 'code', tool: 'Bash',
        title: describeTool('Bash', { command: 'npm run build' }),
        detail: permissionDetail('Bash', { command: 'npm run build && npm test' }), at: Date.now(),
      };
      this.pending.set(reqId, {
        pub, sessionId: sid,
        res: { headersSent: false, writableEnded: false, writeHead() {}, end: () => {
          setTimeout(() => {
            s.lastMessage = 'README güncellendi: kurulum adımları ve ekran görüntüleri eklendi.';
            fake({ ...base, hook_event_name: 'Stop' });
          }, 1500);
        } },
      });
      this.emit('event', { type: 'permission', sessionId: sid, project: s.project, summary: pub.title });
      this.push();
    }, 4200);
  }
}

module.exports = { HookServer };
