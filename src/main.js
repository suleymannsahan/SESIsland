'use strict';
const {
  app, BrowserWindow, ipcMain, screen, Tray, Menu, Notification, nativeImage, shell, safeStorage, globalShortcut, clipboard,
} = require('electron');
const path = require('path');
const fs = require('fs');
const { HookServer } = require('./server');
const hooks = require('./hooks');
const { DesktopWatcher } = require('./desktop-watcher');
const config = require('./config');
const { makeTrayIcon } = require('./icon');
const { Spotify } = require('./spotify');
const { Lyrics } = require('./lyrics');
const { Pomodoro } = require('./pomodoro');
const { Stats } = require('./stats');
const { SystemMonitor } = require('./system');
const { ClipHistory } = require('./clip');
const { SerialMonitor } = require('./serial');
const { WinCtl } = require('./winctl');
const { ClaudeUsage } = require('./usage');
const { Updater } = require('./updater');
const { Store, today } = require('./store');

const PORT = 47821;
const BASE_W = 880;
const BASE_H = 460;

let win = null;
let tray = null;
let server = null;
let watcher = null;
let hidden = false;           // hidden from the tray menu
let fullscreenHidden = false; // stepped aside for a fullscreen app
let spotify = null;
let lyrics = null;
let settingsWin = null;
let pomo = null;
let stats = null;
let sys = null;
let clip = null;
let serial = null;
let winctl = null;
let usage = null;
let updater = null;
let schedule = null;
let notes = null;
let minuteTimer = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
}
app.setAppUserModelId('com.emre.ada');

// ================================================================= window
function targetDisplay() {
  const all = screen.getAllDisplays();
  const i = Number(config.get().display) || 0;
  if (i > 0 && all[i]) return all[i];
  return screen.getPrimaryDisplay();
}

function bounds() {
  const cfg = config.get();
  const scale = Math.max(0.8, Math.min(1.3, Number(cfg.scale) || 1));
  const w = Math.round(BASE_W * scale);
  const h = Math.round(BASE_H * scale);
  const { workArea } = targetDisplay();
  let x = workArea.x + (workArea.width - w) / 2;
  if (cfg.position === 'left') x = workArea.x + 8;
  if (cfg.position === 'right') x = workArea.x + workArea.width - w - 8;
  return { x: Math.round(x), y: workArea.y, width: w, height: h, scale };
}

function createWindow() {
  const b = bounds();
  win = new BrowserWindow({
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true);
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, 'renderer', 'island.html'));
  win.webContents.on('did-finish-load', () => win.webContents.setZoomFactor(b.scale));
  win.once('ready-to-show', () => applyVisibility());
  // ADA_DEBUG=1: print renderer errors to the terminal (used for testing).
  if (process.env.ADA_DEBUG) {
    win.webContents.on('console-message', (_e, level, message, line, source) => {
      if (level >= 2) console.log(`[renderer] ${message} (${path.basename(source)}:${line})`);
    });
    win.webContents.on('render-process-gone', (_e, d) => console.log('[renderer gone]', d.reason));
  }
  // Never navigate away from the island.
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  screen.on('display-metrics-changed', placeWindow);
  screen.on('display-added', placeWindow);
  screen.on('display-removed', placeWindow);
}

function placeWindow() {
  if (!win || win.isDestroyed()) return;
  const b = bounds();
  win.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height });
  win.webContents.setZoomFactor(b.scale);
}

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function mod(name, data) {
  send('mod:state', { mod: name, data });
}

// Something on the island needs the user even during a fullscreen game.
function urgent() {
  if (!server) return false;
  const snap = server.snapshot();
  return snap.permissions.length > 0 || snap.sessions.some((s) => s.status === 'question');
}

function applyVisibility() {
  if (!win || win.isDestroyed()) return;
  const stepAside = fullscreenHidden && config.get().hideFullscreen && !urgent();
  const show = !hidden && !stepAside;
  if (show && !win.isVisible()) win.showInactive();
  if (!show && win.isVisible()) win.hide();
}

// ================================================================= notifications
function quietNow() {
  return pomo && pomo.phase === 'focus' && !pomo.paused && pomo.settings.quietFocus;
}

function notify(title, body, { force = false } = {}) {
  if (!config.get().notifications) return;
  if (!force && quietNow()) return;
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, silent: true });
  n.on('click', () => send('island:expand', true));
  n.show();
}

// ================================================================= tray
function buildTray() {
  tray = new Tray(makeTrayIcon(nativeImage));
  tray.setToolTip('Ada');
  refreshTrayMenu();
  tray.on('click', toggleHidden);
}

function refreshTrayMenu() {
  if (!tray) return;
  const cfg = config.get();
  const installed = hooks.isInstalled(PORT);
  const menu = Menu.buildFromTemplate([
    { label: hidden ? 'Adayı göster' : 'Adayı gizle', click: toggleHidden },
    { label: 'Ayarlar…', click: () => openSettings() },
    { type: 'separator' },
    {
      label: pomo && pomo.phase !== 'idle' ? (pomo.paused ? 'Pomodoro: devam et' : 'Pomodoro: duraklat') : 'Pomodoro başlat',
      click: () => pomo.toggle(),
    },
    ...(pomo && pomo.phase !== 'idle' ? [{ label: 'Pomodoro: bitir', click: () => pomo.stop() }] : []),
    { type: 'separator' },
    {
      label: installed ? 'Claude Code hook\'larını kaldır' : 'Claude Code hook\'larını kur',
      click: () => {
        try {
          if (installed) {
            hooks.uninstall(PORT);
            send('island:toast', { kind: 'info', text: 'Hook\'lar kaldırıldı' });
          } else {
            hooks.install(PORT);
            send('island:toast', { kind: 'info', text: 'Hook\'lar kuruldu · yeni oturum başlat' });
          }
        } catch (e) {
          send('island:toast', { kind: 'error', text: 'Hook hatası: ' + e.message });
        }
        refreshTrayMenu();
      },
    },
    {
      label: 'Claude Desktop sohbetini izle (deneysel)',
      type: 'checkbox',
      checked: cfg.desktopWatcher,
      click: (item) => {
        config.set({ desktopWatcher: item.checked });
        item.checked ? startWatcher() : stopWatcher();
      },
    },
    {
      label: 'Sorun giderme',
      submenu: [
        { label: 'Test bildirimi', click: () => server && server.demo() },
        {
          label: 'Desktop tanılama dosyası oluştur',
          click: async () => {
            const out = path.join(app.getPath('desktop'), 'ada-tanilama.txt');
            try {
              await DesktopWatcher.dump(scriptsDir(), out);
              shell.openPath(out);
            } catch (e) {
              send('island:toast', { kind: 'error', text: 'Tanılama başarısız: ' + e.message });
            }
          },
        },
        {
          label: 'Desktop\'u 60 sn kaydet',
          click: async () => {
            const out = path.join(app.getPath('desktop'), 'ada-kayit.txt');
            send('island:toast', { kind: 'info', text: 'Kayıt başladı · 60 sn' });
            try {
              await DesktopWatcher.record(scriptsDir(), out, 60);
              send('island:toast', { kind: 'info', text: 'Kayıt bitti · masaüstünde ada-kayit.txt' });
              shell.showItemInFolder(out);
            } catch (e) {
              send('island:toast', { kind: 'error', text: 'Kayıt başarısız: ' + e.message });
            }
          },
        },
        {
          label: 'Log dosyasını göster',
          click: () => {
            const p = logPath();
            if (fs.existsSync(p)) shell.showItemInFolder(p);
            else send('island:toast', { kind: 'info', text: 'Henüz log yok' });
          },
        },
        { label: 'Ayar klasörünü aç', click: () => shell.openPath(app.getPath('userData')) },
      ],
    },
    { type: 'separator' },
    { label: 'Çıkış', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
}

function toggleHidden() {
  hidden = !hidden;
  applyVisibility();
  refreshTrayMenu();
}

// ================================================================= claude desktop watcher
function scriptsDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'scripts')
    : path.join(__dirname, '..', 'scripts');
}

function logPath() {
  return path.join(app.getPath('userData'), 'ada-log.txt');
}

function startWatcher() {
  if (watcher || process.platform !== 'win32') return;
  watcher = new DesktopWatcher(scriptsDir(), config.get().desktopPatterns, logPath());
  watcher.on('state', (s) => server.desktopState(s));
  watcher.on('error', (msg) => send('island:toast', { kind: 'error', text: 'Desktop izleyici: ' + msg }));
  watcher.start();
}

function stopWatcher() {
  if (!watcher) return;
  watcher.stop();
  watcher = null;
  server.desktopState({ state: 'gone' });
}

function decideFirst(decision) {
  const p = server && server.snapshot().permissions[0];
  if (!p) return false;
  if (p.id.startsWith('desktop:')) {
    if (watcher) watcher.click(decision);
    server.clearDesktopPermission();
  } else {
    server.decide(p.id, decision);
  }
  return true;
}

// ================================================================= settings window
function openSettings(section) {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show();
    settingsWin.focus();
    if (section) settingsWin.webContents.send('settings:section', section);
    return;
  }
  settingsWin = new BrowserWindow({
    width: 780,
    height: 780,
    title: 'Ada · Ayarlar',
    backgroundColor: '#1a2533',
    autoHideMenuBar: true,
    resizable: true,
    minWidth: 640,
    minHeight: 520,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  settingsWin.setMenu(null);
  settingsWin.loadFile(path.join(__dirname, 'renderer', 'settings.html'), { query: { section: section || '' } });
  settingsWin.webContents.on('will-navigate', (e) => e.preventDefault());
  settingsWin.on('closed', () => { settingsWin = null; });
}

function sendSettings(channel, payload) {
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send(channel, payload);
}

// ================================================================= spotify
function setupSpotify() {
  const vault = safeStorage.isEncryptionAvailable()
    ? { encrypt: (s) => safeStorage.encryptString(s), decrypt: (b) => { try { return safeStorage.decryptString(b); } catch { return null; } } }
    : null;
  spotify = new Spotify(app.getPath('userData'), vault);
  lyrics = new Lyrics();
  let lastErr = 0;
  spotify.on('state', (st) => send('music:state', st));
  spotify.on('status', (st) => { sendSettings('settings:spotify', st); send('music:state', spotify.publicState()); });
  spotify.on('login', (r) => {
    sendSettings('settings:login', r);
    send('island:toast', r.ok ? { kind: 'info', text: 'Spotify bağlandı' } : { kind: 'error', text: 'Spotify bağlantısı başarısız: ' + r.error });
  });
  spotify.on('track', async (track) => {
    stats.add('songs');
    send('music:lyrics', { trackId: track.id, status: 'loading' });
    const r = await lyrics.get(track);
    send('music:lyrics', { trackId: track.id, ...r });
  });
  spotify.on('error', (e) => {
    // Network blips are common; only surface an error once every 30 s.
    if (Date.now() - lastErr < 30000) return;
    lastErr = Date.now();
    send('island:toast', { kind: 'error', text: 'Spotify: ' + e.message });
  });
  spotify.start();
}

function friendlySpotifyError(e) {
  if (e.reason === 'NO_ACTIVE_DEVICE' || /no active device/i.test(e.message)) return 'Açık bir Spotify cihazı yok · Spotify\'ı aç ya da Cihazlar\'dan seç';
  if (e.reason === 'PREMIUM_REQUIRED' || e.status === 403) return 'Bu kontrol için Spotify Premium gerekiyor';
  if (e.reason === 'not_connected') return 'Spotify bağlı değil · Müzik sekmesinden bağla';
  return e.message;
}

async function musicDo(name, arg) {
  if (!spotify || !spotify.status().connected) return { ok: false, error: 'Spotify bağlı değil' };
  try {
    await spotify.action(name, arg);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlySpotifyError(e) };
  }
}

// ================================================================= pomodoro
function setupPomodoro() {
  pomo = new Pomodoro(app.getPath('userData'));
  pomo.on('state', (s) => { mod('pomodoro', s); refreshTrayMenu(); });
  pomo.on('phase', async ({ phase }) => {
    const st = pomo.settings;
    const playing = spotify && spotify.state && spotify.state.isPlaying;
    if (phase === 'focus' && st.musicOnFocus && spotify && spotify.status().connected) {
      if (st.musicUri) await musicDo(st.musicUri === 'liked' ? 'playLiked' : 'playContext', { uri: st.musicUri });
      else if (!playing) await musicDo('toggle');
    }
    if ((phase === 'short' || phase === 'long') && st.pauseOnBreak && playing) await musicDo('toggle');
  });
  pomo.on('end', ({ phase, skipped, minutes, next }) => {
    if (phase === 'focus' && !skipped) {
      stats.add('pomodoros');
      stats.add('focusMin', minutes);
    }
    if (skipped) return;
    const title = phase === 'focus' ? 'Odak bitti' : 'Mola bitti';
    const body = next === 'focus' ? 'Sıradaki: odak' : next === 'long' ? `Uzun mola · ${pomo.settings.longMin} dk` : `Kısa mola · ${pomo.settings.shortMin} dk`;
    send('island:event', { type: 'pomodoro', phase, next, summary: body });
    notify(`Pomodoro · ${title}`, body, { force: true });
  });
}

// ================================================================= small modules
function setupModules() {
  const ud = app.getPath('userData');
  stats = new Stats(ud);
  stats.on('change', (s) => mod('stats', s));

  sys = new SystemMonitor();
  sys.on('state', (s) => mod('system', s));
  sys.start();

  clip = new ClipHistory(clipboard);
  clip.setEnabled(config.get().clipboard);
  clip.on('state', (s) => mod('clip', s));
  clip.start();

  serial = new SerialMonitor(scriptsDir());
  serial.on('state', (s) => mod('serial', s));

  schedule = new Store(ud, 'schedule', { classes: [], exams: [] });
  notes = new Store(ud, 'notes', { text: '' });

  usage = new ClaudeUsage();
  usage.on('state', (s) => mod('usage', s));
  usage.start();

  updater = new Updater(app.getVersion());
  updater.setRepo(config.get().updateRepo);
  updater.on('available', (u) => {
    mod('update', u);
    send('island:event', { type: 'update', summary: `Ada ${u.version} hazır`, ...u });
  });
  updater.start();

  winctl = new WinCtl(scriptsDir());
  winctl.on('fullscreen', (fs_) => { fullscreenHidden = fs_; applyVisibility(); });
  if (config.get().hideFullscreen) winctl.startWatch();

  // once a minute: class reminders and the daily summary
  const minute = () => {
    checkClassReminder();
    checkDailySummary();
  };
  minuteTimer = setInterval(minute, 60 * 1000);
  setTimeout(minute, 5000);
}

function nowHM(d = new Date()) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function toMin(hm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
const remindedClasses = new Set();

function checkClassReminder() {
  const lead = Number(config.get().classReminder) || 0;
  if (!lead) return;
  const d = new Date();
  const dow = ((d.getDay() + 6) % 7) + 1; // Monday = 1
  const cur = d.getHours() * 60 + d.getMinutes();
  for (const c of schedule.get().classes || []) {
    if (Number(c.day) !== dow) continue;
    const start = toMin(c.start);
    if (start == null) continue;
    const key = `${today()}:${c.id}`;
    if (start - cur <= lead && start - cur >= 0 && !remindedClasses.has(key)) {
      remindedClasses.add(key);
      const body = `${c.start}${c.room ? ' · ' + c.room : ''}`;
      send('island:event', { type: 'class', summary: `${c.name} · ${start - cur} dk sonra`, room: c.room, start: c.start, name: c.name });
      notify(`${c.name} ${start - cur} dk sonra`, body);
    }
  }
}

function checkDailySummary() {
  const t = config.get().summaryTime;
  if (!t) return;
  if (config.get().lastSummary === today()) return;
  const cur = toMin(nowHM());
  const target = toMin(t);
  if (target == null || cur < target) return;
  config.set({ lastSummary: today() });
  send('island:event', { type: 'summary', summary: 'Günün özeti', stats: stats.summary() });
}

// ================================================================= shortcuts
const SHORTCUTS = [
  ['CommandOrControl+Alt+Space', 'Müzik: oynat / duraklat', () => musicDo('toggle')],
  ['CommandOrControl+Alt+Right', 'Müzik: sonraki', () => musicDo('next')],
  ['CommandOrControl+Alt+Left', 'Müzik: önceki', () => musicDo('prev')],
  ['CommandOrControl+Alt+Up', 'Müzik: ses +10', () => musicDo('volume', Math.min(100, ((spotify && spotify.state && spotify.state.volume) || 0) + 10))],
  ['CommandOrControl+Alt+Down', 'Müzik: ses −10', () => musicDo('volume', Math.max(0, ((spotify && spotify.state && spotify.state.volume) || 0) - 10))],
  ['CommandOrControl+Alt+Y', 'Claude: izin ver', () => decideFirst('allow') || send('island:toast', { kind: 'info', text: 'Bekleyen izin yok' })],
  ['CommandOrControl+Alt+N', 'Claude: reddet', () => decideFirst('deny') || send('island:toast', { kind: 'info', text: 'Bekleyen izin yok' })],
  ['CommandOrControl+Alt+P', 'Pomodoro: başlat / duraklat', () => pomo.toggle()],
  ['CommandOrControl+Alt+A', 'Adayı aç', () => { if (hidden) toggleHidden(); send('island:expand', true); }],
];
let shortcutReport = [];

function registerShortcuts() {
  globalShortcut.unregisterAll();
  shortcutReport = [];
  if (!config.get().shortcuts) return;
  for (const [acc, label, fn] of SHORTCUTS) {
    let ok = false;
    try { ok = globalShortcut.register(acc, () => { try { fn(); } catch { /* ignore */ } }); } catch { ok = false; }
    shortcutReport.push({ acc: acc.replace('CommandOrControl', 'Ctrl'), label, ok });
  }
}

// ================================================================= ipc: island
ipcMain.on('island:mouse', (_e, inside) => {
  if (win) win.setIgnoreMouseEvents(!inside, { forward: true });
});

// Typing in the island (notes, calculator, serial) needs a focusable window for a moment.
ipcMain.on('island:focusable', (_e, on) => {
  if (!win || win.isDestroyed()) return;
  win.setFocusable(!!on);
  if (on) win.focus();
});

ipcMain.on('island:decide', (_e, { id, decision }) => {
  if (!server) return;
  if (id && id.startsWith('desktop:')) {
    if (watcher) watcher.click(decision);
    server.clearDesktopPermission();
  } else {
    server.decide(id, decision);
  }
});

ipcMain.on('island:answer', (_e, { askId, answers }) => { if (server) server.answerAsk(askId, answers || null); });
ipcMain.on('island:dismiss', (_e, sessionId) => server && server.dismiss(sessionId));

ipcMain.on('island:focusSession', async (_e, s) => {
  if (!winctl || !s) return;
  const ok = s.source === 'desktop'
    ? await winctl.focus(['claude'])
    : await winctl.focus(['WindowsTerminal', 'Code', 'Cursor', 'pwsh', 'powershell', 'cmd', 'claude'], s.project);
  if (!ok) send('island:toast', { kind: 'info', text: 'Pencere bulunamadı' });
});

ipcMain.handle('island:init', () => ({
  config: config.get(),
  state: server ? server.snapshot() : null,
  music: spotify ? spotify.publicState() : null,
  mods: {
    pomodoro: pomo ? pomo.snapshot() : null,
    stats: stats ? stats.summary() : null,
    clip: clip ? clip.snapshot() : null,
    serial: serial ? serial.snapshot() : null,
    schedule: schedule ? schedule.get() : null,
    notes: notes ? notes.get() : null,
    usage: usage ? usage.state : null,
    update: updater ? updater.latest : null,
  },
}));

ipcMain.handle('music:action', (_e, { name, arg }) => musicDo(name, arg));

ipcMain.handle('music:list', async (_e, kind) => {
  try {
    if (kind === 'playlists') return { ok: true, items: await spotify.playlists() };
    if (kind === 'devices') return { ok: true, items: await spotify.devices() };
    return { ok: false, error: 'Bilinmeyen liste' };
  } catch (e) {
    return { ok: false, error: friendlySpotifyError(e) };
  }
});

ipcMain.handle('music:lyrics', async () => {
  const t = spotify && spotify.state && spotify.state.track;
  if (!t) return { status: 'none' };
  return { trackId: t.id, ...(await lyrics.get(t)) };
});

ipcMain.handle('music:translate', async () => {
  const t = spotify && spotify.state && spotify.state.track;
  if (!t) return { ok: false, error: 'Çalan şarkı yok' };
  const l = await lyrics.get(t);
  if (!l.lines || !l.lines.length) return { ok: false, error: 'Söz yok' };
  try {
    return { ok: true, trackId: t.id, lines: await lyrics.translate(t.id, l.lines) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Generic module calls from the island and the settings window.
const CALLS = {
  pomodoro: {
    toggle: () => pomo.toggle(),
    start: (phase) => pomo.start(phase || 'focus'),
    stop: () => pomo.stop(),
    skip: () => pomo.skip(),
    settings: (patch) => pomo.setSettings(patch),
  },
  stats: { get: () => stats.summary() },
  system: { fast: (on) => sys.setFast(on) },
  clip: {
    copy: (i) => clip.copy(i),
    remove: (i) => clip.remove(i),
    clear: () => clip.clear(),
  },
  serial: {
    list: () => serial.list(),
    open: ({ port, baud }) => serial.open(port, baud),
    close: () => serial.close(),
    send: (text) => serial.send(text),
    clear: () => serial.clear(),
  },
  schedule: {
    get: () => schedule.get(),
    set: (data) => {
      const clean = {
        classes: (data.classes || []).slice(0, 80).map((c, i) => ({
          id: String(c.id || `c${Date.now()}${i}`), day: Math.max(1, Math.min(7, Number(c.day) || 1)),
          start: String(c.start || '').slice(0, 5), end: String(c.end || '').slice(0, 5),
          name: String(c.name || '').slice(0, 80), room: String(c.room || '').slice(0, 40),
        })).filter((c) => c.name),
        exams: (data.exams || []).slice(0, 40).map((x, i) => ({
          id: String(x.id || `e${Date.now()}${i}`), date: String(x.date || '').slice(0, 10),
          time: String(x.time || '').slice(0, 5), name: String(x.name || '').slice(0, 80),
        })).filter((x) => x.name && /^\d{4}-\d{2}-\d{2}$/.test(x.date)),
      };
      schedule.set(clean);
      mod('schedule', schedule.get());
      return schedule.get();
    },
  },
  notes: {
    set: (text) => { notes.set({ text: String(text || '').slice(0, 20000) }); return true; },
  },
  usage: { refresh: () => usage.refresh() },
  update: {
    check: async () => {
      updater.setRepo(config.get().updateRepo);
      const r = await updater.check().catch(() => null);
      return r || { none: true };
    },
    open: () => updater.latest && shell.openExternal(updater.latest.url),
  },
};

ipcMain.handle('mod:call', async (_e, { mod: m, fn, arg }) => {
  const f = CALLS[m] && CALLS[m][fn];
  if (!f) return { ok: false, error: 'bilinmeyen çağrı' };
  try {
    const r = await f(arg);
    return { ok: true, result: r === undefined ? null : r };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ================================================================= ipc: settings window
ipcMain.on('app:settings', (_e, section) => openSettings(section));

ipcMain.handle('settings:get', () => ({
  config: config.get(),
  spotify: spotify.status(),
  version: app.getVersion(),
  loginAtStart: app.getLoginItemSettings().openAtLogin,
  displays: screen.getAllDisplays().map((d, i) => ({ i, label: `${i === 0 ? 'Ana ekran' : `Ekran ${i + 1}`} · ${d.size.width}×${d.size.height}`, primary: d.id === screen.getPrimaryDisplay().id })),
  shortcuts: shortcutReport,
  pomodoro: pomo.settings,
  schedule: schedule.get(),
}));

const SETTABLE = {
  sound: 'bool', notifications: 'bool', desktopWatcher: 'bool', hideFullscreen: 'bool', sleepy: 'bool',
  albumColor: 'bool', shortcuts: 'bool', clipboard: 'bool', translateLyrics: 'bool',
  position: ['center', 'left', 'right'], display: 'int', scale: 'num', summaryTime: 'hm', classReminder: 'int', updateRepo: 'repo',
};

ipcMain.handle('settings:set', (_e, patch) => {
  const clean = {};
  for (const [k, v] of Object.entries(patch || {})) {
    const t = SETTABLE[k];
    if (!t) continue;
    if (t === 'bool') clean[k] = !!v;
    else if (t === 'int') clean[k] = Math.max(0, Math.round(Number(v) || 0));
    else if (t === 'num') clean[k] = Math.max(0.8, Math.min(1.3, Number(v) || 1));
    else if (t === 'hm') clean[k] = /^\d{1,2}:\d{2}$/.test(v) || v === '' ? v : config.get()[k];
    else if (t === 'repo') clean[k] = /^[\w.-]+\/[\w.-]+$/.test(v) || v === '' ? v : config.get()[k];
    else if (Array.isArray(t) && t.includes(v)) clean[k] = v;
  }
  config.set(clean);
  if ('desktopWatcher' in clean) clean.desktopWatcher ? startWatcher() : stopWatcher();
  if ('hideFullscreen' in clean) clean.hideFullscreen ? winctl.startWatch() : winctl.stopWatch();
  if ('shortcuts' in clean) registerShortcuts();
  if ('clipboard' in clean) clip.setEnabled(clean.clipboard);
  if ('position' in clean || 'display' in clean || 'scale' in clean) placeWindow();
  if ('updateRepo' in clean) { updater.setRepo(clean.updateRepo); updater.start(); }
  if ('loginAtStart' in (patch || {})) app.setLoginItemSettings({ openAtLogin: !!patch.loginAtStart });
  send('island:config', config.get());
  refreshTrayMenu();
  return config.get();
});

ipcMain.handle('spotify:connect', async (_e, clientId) => {
  try {
    spotify.setClientId(clientId);
    const url = await spotify.beginLogin();
    await shell.openExternal(url);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('spotify:disconnect', () => { spotify.disconnect(); return { ok: true }; });
ipcMain.handle('spotify:playlists', async () => {
  try { return { ok: true, items: await spotify.playlists() }; } catch (e) { return { ok: false, error: friendlySpotifyError(e) }; }
});

// Only these sites may be opened from Ada's pages.
const OPENABLE = ['developer.spotify.com', 'lrclib.net', 'www.spotify.com', 'github.com', 'mymemory.translated.net'];
ipcMain.on('app:open', (_e, url) => {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:' && OPENABLE.includes(u.hostname)) shell.openExternal(url);
  } catch { /* ignore */ }
});

// ================================================================= lifecycle
app.whenReady().then(() => {
  config.load(app.getPath('userData'));
  createWindow();

  setupModules();
  setupPomodoro();

  server = new HookServer(PORT);
  server.on('state', (state) => { send('island:state', state); applyVisibility(); });
  server.on('event', (ev) => {
    send('island:event', ev);
    if (ev.type === 'permission') notify(`${ev.project} · izin istiyor`, ev.summary, { force: true });
    if (ev.type === 'question') notify(`${ev.project} · soru soruyor`, ev.summary, { force: true });
    if (ev.type === 'done') {
      stats.add('claudeDone');
      notify(`${ev.project} · tamamlandı`, ev.summary || 'İş bitti.');
    }
  });
  server.on('error', (e) => send('island:toast', { kind: 'error', text: e.message }));
  server.start();

  buildTray();

  // First run: install hooks automatically, with a backup of the user's settings.
  const cfg = config.get();
  if (!cfg.hooksOffered) {
    try {
      hooks.install(PORT);
      setTimeout(() => send('island:toast', { kind: 'info', text: 'Claude Code bağlandı · yeni oturum başlat' }), 1500);
    } catch (e) {
      setTimeout(() => send('island:toast', { kind: 'error', text: 'Hook kurulamadı: ' + e.message }), 1500);
    }
    config.set({ hooksOffered: true });
    refreshTrayMenu();
  }
  // Hooks written by an older Ada are rewritten (new events, no shell).
  if (hooks.isOutdated(PORT)) {
    try {
      hooks.install(PORT);
      setTimeout(() => send('island:toast', { kind: 'info', text: 'Hook\'lar güncellendi · yeni Claude Code oturumu başlat' }), 1500);
    } catch (e) {
      setTimeout(() => send('island:toast', { kind: 'error', text: 'Hook güncellenemedi: ' + e.message }), 1500);
    }
  }
  if (cfg.desktopWatcher) startWatcher();
  setupSpotify();
  registerShortcuts();
});

app.on('second-instance', () => {
  if (hidden) toggleHidden();
  send('island:expand', true);
});

app.on('window-all-closed', (e) => e.preventDefault());

app.on('will-quit', () => globalShortcut.unregisterAll());

app.on('before-quit', () => {
  clearInterval(minuteTimer);
  if (spotify) { spotify.stop(); spotify.closeAuthServer(); }
  if (watcher) watcher.stop();
  if (server) server.stop();
  if (serial) serial.close();
  if (winctl) winctl.stopWatch();
  if (sys) sys.stop();
  if (clip) clip.stop();
  if (usage) usage.stop();
  if (updater) updater.stop();
  for (const s of [schedule, notes, stats && stats.store, pomo && pomo.store]) if (s) s.saveNow();
});
