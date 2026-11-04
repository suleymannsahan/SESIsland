'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const LISTEN = [
  'island:state', 'island:event', 'island:toast', 'island:expand', 'island:config',
  'music:state', 'music:lyrics', 'mod:state', 'island:pointer',
  'settings:spotify', 'settings:login', 'settings:section',
];

contextBridge.exposeInMainWorld('ada', {
  // island
  init: () => ipcRenderer.invoke('island:init'),
  mouse: () => {},
  rect: (r) => ipcRenderer.send('island:rect', r),
  hold: (on) => ipcRenderer.send('island:hold', on),
  diag: (kind, data) => ipcRenderer.send('island:diag', kind, data),
  decide: (id, decision) => ipcRenderer.send('island:decide', { id, decision }),
  dismiss: (sessionId) => ipcRenderer.send('island:dismiss', sessionId),
  answer: (askId, answers) => ipcRenderer.send('island:answer', { askId, answers }),
  focusable: (on) => ipcRenderer.send('island:focusable', on),
  focusSession: (s) => ipcRenderer.send('island:focusSession', s),
  call: (mod, fn, arg) => ipcRenderer.invoke('mod:call', { mod, fn, arg }),
  // music
  music: (name, arg) => ipcRenderer.invoke('music:action', { name, arg }),
  musicList: (kind) => ipcRenderer.invoke('music:list', kind),
  lyrics: () => ipcRenderer.invoke('music:lyrics'),
  translate: () => ipcRenderer.invoke('music:translate'),
  // settings
  openSettings: (section) => ipcRenderer.send('app:settings', section),
  settings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  spotifyConnect: (clientId) => ipcRenderer.invoke('spotify:connect', clientId),
  spotifyDisconnect: () => ipcRenderer.invoke('spotify:disconnect'),
  spotifyPlaylists: () => ipcRenderer.invoke('spotify:playlists'),
  open: (url) => ipcRenderer.send('app:open', url),
  on: (channel, fn) => {
    if (!LISTEN.includes(channel)) return;
    ipcRenderer.on(channel, (_e, payload) => fn(payload));
  },
});
