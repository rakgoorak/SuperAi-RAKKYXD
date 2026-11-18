// Bridge for the quick ask box only: send its text to the app, or close it.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('quickAsk', {
  submit: (text) => ipcRenderer.send('quick:submit', String(text).slice(0, 20000)),
  close: () => ipcRenderer.send('quick:close'),
  onShow: (callback) => ipcRenderer.on('quick:show', () => callback()),
});
