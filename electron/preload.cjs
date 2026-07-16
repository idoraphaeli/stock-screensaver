const { contextBridge, ipcRenderer } = require('electron');

// Minimal bridge for the renderer's data fetching and its runtime screen
// config — see the IPC handlers in main.cjs. Exposed under a name the web
// code can feature-detect (src/transport.ts and src/config.ts fall back to
// the dev proxy / bundled defaults when it's absent, i.e. in the browser).
contextBridge.exposeInMainWorld('screensaverNative', {
  fetchJson: (url) => ipcRenderer.invoke('fetch-json', url),
  fetchText: (url) => ipcRenderer.invoke('fetch-text', url),
  getScreens: () => ipcRenderer.invoke('get-screens'),
  onScreensChanged: (callback) => {
    const listener = (_event, screens) => callback(screens);
    ipcRenderer.on('screens-changed', listener);
    return () => ipcRenderer.removeListener('screens-changed', listener);
  },
});
