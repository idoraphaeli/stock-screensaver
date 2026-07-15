const { contextBridge, ipcRenderer } = require('electron');

// Minimal bridge for the renderer's data fetching — see the IPC handlers
// in main.cjs. Exposed under a name the web code can feature-detect
// (src/transport.ts falls back to plain fetch in the browser).
contextBridge.exposeInMainWorld('screensaverNative', {
  fetchJson: (url) => ipcRenderer.invoke('fetch-json', url),
  fetchText: (url) => ipcRenderer.invoke('fetch-text', url),
});
