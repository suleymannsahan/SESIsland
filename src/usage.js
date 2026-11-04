'use strict';
// Claude plan usage (5-hour and weekly limits), read with the login Claude Code already saved on
// this computer (~/.claude/.credentials.json). The token is sent only to api.anthropic.com.
// The endpoint is not documented, so this is best effort and hides itself when it fails.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');

const CRED = path.join(os.homedir(), '.claude', '.credentials.json');
const URL_ = 'https://api.anthropic.com/api/oauth/usage';

function readToken(file = CRED) {
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    const o = j.claudeAiOauth || j.claude_ai_oauth || {};
    if (!o.accessToken) return null;
    if (o.expiresAt && Number(o.expiresAt) < Date.now()) return null; // Claude Code refreshes it on its next run
    return o.accessToken;
  } catch {
    return null;
  }
}

function pick(w) {
  if (!w || typeof w !== 'object') return null;
  const u = Number(w.utilization);
  if (!Number.isFinite(u)) return null;
  return { pct: Math.max(0, Math.min(100, Math.round(u))), resetsAt: w.resets_at || null };
}

class ClaudeUsage extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.fetch = opts.fetch || globalThis.fetch;
    this.credFile = opts.credFile || CRED;
    this.state = { available: false };
    this.timer = null;
  }

  start() {
    this.stop();
    const tick = async () => {
      await this.refresh();
      this.timer = setTimeout(tick, 5 * 60 * 1000);
    };
    tick();
  }

  stop() { clearTimeout(this.timer); }

  async refresh() {
    const token = readToken(this.credFile);
    if (!token) return this.set({ available: false, reason: 'no-login' });
    try {
      const res = await this.fetch(URL_, {
        headers: { Authorization: `Bearer ${token}`, 'anthropic-beta': 'oauth-2025-04-20', 'User-Agent': 'Ada/0.3' },
      });
      if (!res.ok) return this.set({ available: false, reason: `http-${res.status}` });
      const j = await res.json();
      const five = pick(j.five_hour);
      const week = pick(j.seven_day);
      if (!five && !week) return this.set({ available: false, reason: 'shape' });
      this.set({ available: true, five, week, at: Date.now() });
    } catch (e) {
      this.set({ available: false, reason: 'network' });
    }
  }

  set(s) {
    this.state = s;
    this.emit('state', s);
  }
}

module.exports = { ClaudeUsage, readToken };
