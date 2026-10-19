// Exposes a minimal, safe desktop API to the Studio UI as `window.bridgemind`.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bridgemind', {
  isDesktop: true,
  platform: process.platform,
  browserLogin: (service) => ipcRenderer.invoke('auth:browser-login', service),
  logout: (service) => ipcRenderer.invoke('auth:logout', service),
  pickFolder: () => ipcRenderer.invoke('dialog:pick-folder'),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
});
