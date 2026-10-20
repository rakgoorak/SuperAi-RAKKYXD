const { contextBridge, ipcRenderer } = require('electron');
const listen = (channel, callback) => { const handler = (_event, data) => callback(data); ipcRenderer.on(channel, handler); return () => ipcRenderer.removeListener(channel, handler); };
contextBridge.exposeInMainWorld('superai', {
  isDesktop: true, platform: process.platform,
  pickFolder: () => ipcRenderer.invoke('app:folder'),
  openExternal: url => ipcRenderer.invoke('app:external', url),
  openVoice: () => ipcRenderer.invoke('app:voice'),
  browser: (action, payload) => ipcRenderer.invoke('browser:action', action, payload),
  onBrowser: callback => listen('browser:state', callback),
  onVoiceText: callback => listen('voice:text', callback),
});
