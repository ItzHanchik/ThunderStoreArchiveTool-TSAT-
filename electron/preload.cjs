const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("tsat", {
  setLanguage: (language) => ipcRenderer.invoke("locale:set", language),
  saveArchive: (bytes, filename) =>
    ipcRenderer.invoke("archive:save", bytes, filename),
  openExternal: (url) => ipcRenderer.invoke("external:open", url),
  catalog: (operation, params) =>
    ipcRenderer.invoke("catalog:read", operation, params),
  verifyToken: () => ipcRenderer.invoke("token:verify"),
  tokenStatus: () => ipcRenderer.invoke("token:status"),
  saveToken: (token) => ipcRenderer.invoke("token:save", token),
  deleteToken: () => ipcRenderer.invoke("token:delete"),
  publish: (bytes, metadata) =>
    ipcRenderer.invoke("package:publish", bytes, metadata),
});
