// Ponte segura entre a janela e o Electron.
"use strict";
const { contextBridge, ipcRenderer } = require("electron");

let antesDeFechar = null;
ipcRenderer.on("pedido-fechar", async () => {
  let ok = true;
  try { if (antesDeFechar) ok = await antesDeFechar(); } catch (e) { ok = true; }
  ipcRenderer.send("resposta-fechar", ok !== false);
});

contextBridge.exposeInMainWorld("tinteiroDesktop", {
  platform: process.platform,
  windowControls: process.platform !== "darwin",
  setTheme: t => ipcRenderer.send("tema", t),
  maximizar: () => ipcRenderer.send("maximizar"),
  checkUpdates: manual => ipcRenderer.send("procurar-atualizacao", !!manual),
  installUpdate: () => ipcRenderer.send("instalar-atualizacao"),
  onUpdateStatus: cb => ipcRenderer.on("atualizacao", (e, s) => cb(s)),
  onBeforeClose: cb => { antesDeFechar = cb; },
  openUrl: url => ipcRenderer.send("abrir-url", url),
  versao: () => ipcRenderer.invoke("versao"),
});
