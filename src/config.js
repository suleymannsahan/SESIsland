'use strict';
const fs = require('fs');
const path = require('path');

// Button names Claude Desktop shows. English and Turkish variants; the tray's
// "Desktop tanılama dosyası" writes the real names so these can be tuned in config.json.
const DEFAULTS = {
  sound: true,
  notifications: true,
  desktopWatcher: true,
  hooksOffered: false,
  // layout
  position: 'center',        // center | left | right
  display: 0,                // index in screen.getAllDisplays(); 0 = primary
  scale: 1,                  // 0.8 … 1.3
  hideFullscreen: true,      // step aside for fullscreen games, videos and slides
  sleepy: true,              // shrink and dim when nothing happens for a while
  albumColor: true,          // tint the island with the album cover's colour
  shortcuts: true,
  clipboard: true,
  translateLyrics: false,
  summaryTime: '21:30',      // '' turns the daily summary off
  lastSummary: '',
  classReminder: 10,         // minutes before a class; 0 = off
  updateRepo: '',            // owner/repo on GitHub for update checks
  patternsVersion: 3,
  // Learned from Claude Desktop's accessibility tree (ada-kayit.txt). English and Turkish variants.
  desktopPatterns: {
    working: '^(Stop response|Stop|Stop generating|Claude is responding|Claude is thinking|Yanıtı durdur|Durdur|Claude yanıt veriyor|Claude düşünüyor)$',
    allow: '^(Allow for this session|Allow for this chat|Allow once|Allow|Always allow|Allow always|Bu oturum için izin ver|Bir kez izin ver|İzin ver|Her zaman izin ver)$',
    allowOnce: '^(Allow once|Allow for this session|Allow for this chat|Allow|Bir kez izin ver|Bu oturum için izin ver|İzin ver)$',
    deny: '^(Decline|Deny|Don\'t allow|Reddet|İzin verme)$',
    waiting: '^(Needs your input|Girdin gerekiyor|Yanıtını bekliyor)$',
    prompt: '^(?:Claude wants to use|Permission request:|Claude şunu kullanmak istiyor:?)\\s*(.+)$',
    session: '^(.+) (?:Running|Awaiting input|Çalışıyor|Yanıt bekliyor)$',
    // Exact button names, in the order the island's "İzin ver" / "Reddet" should try them.
    allowNames: ['Allow once', 'Allow for this session', 'Allow for this chat', 'Allow', 'Bir kez izin ver', 'Bu oturum için izin ver', 'İzin ver'],
    denyNames: ['Decline', 'Deny', "Don't allow", 'Reddet', 'İzin verme'],
  },
};

let file = null;
let data = { ...DEFAULTS };

function load(dir) {
  file = path.join(dir, 'config.json');
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    // Patterns saved by an older version are dropped so new defaults take effect.
    const userPatterns = raw.patternsVersion === DEFAULTS.patternsVersion ? (raw.desktopPatterns || {}) : {};
    data = { ...DEFAULTS, ...raw, patternsVersion: DEFAULTS.patternsVersion, desktopPatterns: { ...DEFAULTS.desktopPatterns, ...userPatterns } };
  } catch {
    data = { ...DEFAULTS };
  }
  save();
}

function save() {
  if (!file) return;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch { /* best effort */ }
}

function get() { return data; }
function set(patch) { data = { ...data, ...patch }; save(); }

module.exports = { load, get, set, DEFAULTS };
