const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bridge', {
  onCostUpdate: (fn) => ipcRenderer.on('cost-update', (_e, data) => fn(data)),
  onInitialData: (fn) => ipcRenderer.on('initial-data', (_e, data) => fn(data)),
  hideOverlay: () => ipcRenderer.send('hide-overlay'),
  startDrag: () => ipcRenderer.send('start-drag'),
});
