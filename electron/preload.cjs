const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('tsat', {
  saveArchive: (bytes, filename) => ipcRenderer.invoke('archive:save', bytes, filename),
  openExternal: url => ipcRenderer.invoke('external:open', url),
  tokenStatus: () => ipcRenderer.invoke('token:status'),
  saveToken: token => ipcRenderer.invoke('token:save', token),
  deleteToken: () => ipcRenderer.invoke('token:delete'),
  publish: (bytes, metadata) => ipcRenderer.invoke('package:publish', bytes, metadata),
});
