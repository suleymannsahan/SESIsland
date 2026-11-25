'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('picker', {
  onImage: (fn) => ipcRenderer.on('picker:image', (_e, d) => fn(d)),
  done: (color) => ipcRenderer.send('picker:done', color),
  cancel: () => ipcRenderer.send('picker:done', null),
});
