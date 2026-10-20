const { contextBridge, ipcRenderer } = require('electron');
const on = (channel, callback) => {
  const handler = (_e, v) => callback(v);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};
contextBridge.exposeInMainWorld('voice', {
  testMode: process.argv.includes('--superai-test-mode'),
  status: () => ipcRenderer.invoke('voice:status'),
  setup: () => ipcRenderer.invoke('voice:setup'),
  prepare: (model) => ipcRenderer.invoke('voice:prepare', model),
  transcribe: (options) => ipcRenderer.invoke('voice:transcribe', options),
  deliver: (options) => ipcRenderer.invoke('voice:deliver', options),
  copy: (text) => ipcRenderer.invoke('voice:copy', text),
  cancel: () => ipcRenderer.invoke('voice:cancel'),
  capture: () => ipcRenderer.invoke('voice:capture'),
  hide: () => ipcRenderer.invoke('voice:hide'),
  settings: (expanded) => ipcRenderer.invoke('voice:settings', expanded),
  onToggle: (callback) => on('voice:toggle', callback),
  onProgress: (callback) => on('voice:progress', callback)
});
