'use strict';
// Installs / removes Ada's entries in ~/.claude/settings.json.
// Every hook runs curl directly (exec form: program in "command", arguments in "args"), so no
// shell is involved; Git Bash and PowerShell quoting can't break it. curl posts the event JSON
// (stdin) to Ada's local server. For PermissionRequest, curl waits for Ada's answer and prints it.
// If Ada is not running curl fails fast, which Claude Code treats as a non-blocking hook error.
const fs = require('fs');
const os = require('os');
const path = require('path');

const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');
const MARK = (port) => `127.0.0.1:${port}/hook`;
const CURL = process.platform === 'win32' ? 'curl.exe' : 'curl';

function hookEntry(port, maxTime, query = '') {
  return {
    type: 'command',
    command: CURL,
    args: [
      '-s', '--noproxy', '*',
      '--connect-timeout', '1',
      '-m', String(maxTime),
      '-X', 'POST',
      '-H', 'Content-Type: application/json',
      '--data-binary', '@-',
      `http://${MARK(port)}${query}`,
    ],
    timeout: maxTime + 5,
  };
}

// Kept for tests: the equivalent single-line command.
function cmd(port, maxTime) {
  const e = hookEntry(port, maxTime);
  return [e.command, ...e.args.map((a) => (/[\s*;]/.test(a) ? `"${a}"` : a))].join(' ');
}

// [event name, { matcher?, timeout (s), query? }]
// The second PreToolUse entry waits (up to 1 min) while the question is answered on the island.
const EVENTS = [
  ['SessionStart', { t: 5 }],
  ['UserPromptSubmit', { t: 5 }],
  ['PreToolUse', { matcher: '*', t: 5 }],
  ['PreToolUse', { matcher: 'AskUserQuestion', t: 75, query: '?wait=ask' }],
  ['PostToolUse', { matcher: '*', t: 5 }],
  ['PermissionRequest', { matcher: '*', t: 600 }],
  ['Notification', { t: 5 }],
  // Stop waits a few seconds so a reply typed on the island can send Claude back to work.
  ['Stop', { t: 75, query: '?wait=reply' }],
  ['SubagentStop', { t: 5 }],
  ['SessionEnd', { t: 5 }],
];

function read() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return {};
    throw new Error('settings.json okunamadı (JSON hatalı olabilir)');
  }
}

function backup() {
  if (!fs.existsSync(SETTINGS)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(SETTINGS, `${SETTINGS}.ada-yedek-${stamp}`);
}

const isOurs = (port) => (x) => JSON.stringify(x).includes(MARK(port));

function stripOurs(settings, port) {
  const h = settings.hooks || {};
  for (const ev of Object.keys(h)) {
    if (!Array.isArray(h[ev])) continue;
    h[ev] = h[ev]
      .map((group) => ({ ...group, hooks: (group.hooks || []).filter((x) => !isOurs(port)(x)) }))
      .filter((group) => group.hooks.length > 0);
    if (h[ev].length === 0) delete h[ev];
  }
  if (Object.keys(h).length === 0) delete settings.hooks; else settings.hooks = h;
  return settings;
}

function desired(port) {
  const settings = stripOurs(read(), port);
  settings.hooks = settings.hooks || {};
  for (const [ev, o] of EVENTS) {
    const group = { hooks: [hookEntry(port, o.t, o.query)] };
    if (o.matcher) group.matcher = o.matcher;
    settings.hooks[ev] = [...(settings.hooks[ev] || []), group];
  }
  return settings;
}

function write(settings) {
  backup();
  fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
  fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2));
}

function install(port) {
  write(desired(port));
}

function uninstall(port) {
  write(stripOurs(read(), port));
}

function isInstalled(port) {
  try {
    return JSON.stringify(read().hooks || {}).includes(MARK(port));
  } catch {
    return false;
  }
}

// True when Ada's hooks are present but written by an older version (e.g. the bash one-liner).
function isOutdated(port) {
  try {
    if (!isInstalled(port)) return false;
    return JSON.stringify(read()) !== JSON.stringify(desired(port));
  } catch {
    return false;
  }
}

module.exports = { install, uninstall, isInstalled, isOutdated, SETTINGS, EVENTS, cmd, hookEntry };
