const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('setup', {
  onBoot: (cb) => ipcRenderer.on('boot', (_e, p) => cb(p)),
  onProgress: (cb) => ipcRenderer.on('progress', (_e, p) => cb(p)),
  chooseDir: () => ipcRenderer.invoke('choose-dir'),
  install: (opts) => ipcRenderer.invoke('install', opts),
  uninstall: () => ipcRenderer.invoke('uninstall'),
  launch: (exePath) => ipcRenderer.invoke('launch', exePath),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  minimize: () => ipcRenderer.send('win-minimize'),
  close: () => ipcRenderer.send('win-close'),
});
