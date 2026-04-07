const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bridge', {
  onCostUpdate: (fn) => ipcRenderer.on('cost-update', (_e, data) => fn(data)),
  onInitialData: (fn) => ipcRenderer.on('initial-data', (_e, data) => fn(data)),
  onReportRefreshed: (fn) => ipcRenderer.on('report-refreshed', (_e, payload) => fn(payload)),
  hideOverlay: () => ipcRenderer.send('hide-overlay'),
  startDrag: () => ipcRenderer.send('start-drag'),

  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (updates) => ipcRenderer.invoke('save-config', updates),
  getReport: (days) => ipcRenderer.invoke('get-report', days),
  resizeWidget: (expanded) => ipcRenderer.send('resize-widget', expanded),
});
