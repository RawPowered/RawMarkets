const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("launcher", {
  getVersion: () => ipcRenderer.sendSync("launcher:get-version"),
  play: () => ipcRenderer.invoke("launcher:play"),
  openSettings: () => ipcRenderer.invoke("launcher:settings"),
  quit: () => ipcRenderer.invoke("launcher:quit"),
  onStatus: (cb) => {
    ipcRenderer.on("launcher:status", (_e, payload) => cb(payload));
  },
});

contextBridge.exposeInMainWorld("rawMarkets", {
  openExternal: (url) => ipcRenderer.invoke("shell:open-external", url),
});
