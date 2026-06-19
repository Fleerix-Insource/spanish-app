const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setWindowState: (state) => ipcRenderer.send('set-window-state', state),
  windowControl: (action) => ipcRenderer.send('window-control', action),
});
