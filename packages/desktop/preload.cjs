const { contextBridge, ipcRenderer, webUtils } = require('electron');
const listen = (channel, callback) => { const handler = (_event, data) => callback(data); ipcRenderer.on(channel, handler); return () => ipcRenderer.removeListener(channel, handler); };
contextBridge.exposeInMainWorld('superai', {
  isDesktop: true, platform: process.platform,
  pickFolder: () => ipcRenderer.invoke('app:folder'),
  openExternal: url => ipcRenderer.invoke('app:external', url),
  browser: (action, payload) => ipcRenderer.invoke('browser:action', action, payload),
  onBrowser: callback => listen('browser:state', callback),
  pathForFile: file => { try { return webUtils.getPathForFile(file) || ''; } catch { return ''; } },
  stageClipboardImage: filePath => ipcRenderer.invoke('clipboard:stage-image', filePath),
});
