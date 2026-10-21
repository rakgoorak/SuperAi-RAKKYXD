const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('installer', {
  info: () => ipcRenderer.invoke('installer:info'),
  pick: (current) => ipcRenderer.invoke('installer:pick', current),
  install: (options) => ipcRenderer.invoke('installer:install', options),
  launch: (exe) => ipcRenderer.invoke('installer:launch', exe),
  window: (action) => ipcRenderer.invoke('installer:window', action),
  onProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('installer:progress', handler);
    return () => ipcRenderer.removeListener('installer:progress', handler);
  },
});
