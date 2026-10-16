// Tinteiro — processo principal do app de computador (Electron).
"use strict";
const { app, BrowserWindow, shell, dialog, ipcMain, Menu, nativeTheme, session } = require("electron");
const path = require("path");
const fs = require("fs");
const { Config } = require("../server/config");
const { criarServidor } = require("../server/server");

let janela = null, servidor = null, config = null, podeFechar = false, pedidoInstalar = false;

if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on("second-instance", () => { if (janela) { if (janela.isMinimized()) janela.restore(); janela.focus(); } });
  app.whenReady().then(iniciar).catch(e => { dialog.showErrorBox("Tinteiro", "Não foi possível iniciar: " + (e && e.message)); app.quit(); });
}
app.on("window-all-closed", () => app.quit());

async function iniciar() {
  config = new Config(app.getPath("userData"));
  try { fs.mkdirSync(config.get("root"), { recursive: true }); } catch (e) {}
  servidor = criarServidor({
    config,
    webDir: path.join(__dirname, "../../dist/web"),
    versao: app.getVersion(),
    hooks: {
      openPath: async p => { const r = await shell.openPath(p); return r || null; },
      reveal: p => shell.showItemInFolder(p),
      trash: p => shell.trashItem(p),
      chooseFolder: async () => {
        const r = await dialog.showOpenDialog(janela, { title: "Escolher a pasta raiz", properties: ["openDirectory", "createDirectory"], defaultPath: config.get("root") });
        return r.canceled ? null : r.filePaths[0];
      },
    },
  });
  const r = await servidor.iniciar();
  criarMenu();
  criarJanela(r);
  configurarAtualizacao();
}

function criarJanela(r) {
  const est = config.get("janela") || {};
  const escuro = nativeTheme.shouldUseDarkColors;
  janela = new BrowserWindow({
    width: est.width || 1280, height: est.height || 800, x: est.x, y: est.y,
    minWidth: 420, minHeight: 320,
    title: "Tinteiro",
    icon: path.join(__dirname, "../../build/icon.png"),
    backgroundColor: escuro ? "#1e1e1e" : "#ffffff",
    show: false,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    titleBarOverlay: process.platform === "darwin" ? undefined : { color: escuro ? "#262626" : "#f6f6f6", symbolColor: escuro ? "#dadada" : "#222222", height: 40 },
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, spellcheck: true, nodeIntegration: false },
  });
  if (est.maximized) janela.maximize();
  try { session.defaultSession.setSpellCheckerLanguages(["pt-BR"]); } catch (e) {}
  janela.loadURL(`${r.url}/#token=${encodeURIComponent(r.token)}`);
  janela.once("ready-to-show", () => janela.show());
  const origem = r.url;
  janela.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?|mailto):/i.test(url) && !url.startsWith(origem)) shell.openExternal(url);
    return { action: "deny" };
  });
  janela.webContents.on("will-navigate", (e, url) => { if (!url.startsWith(origem)) { e.preventDefault(); if (/^(https?|mailto):/i.test(url)) shell.openExternal(url); } });
  janela.webContents.on("context-menu", (e, p) => menuDeContexto(p));
  const salvarEstado = () => {
    if (!janela || janela.isDestroyed()) return;
    const max = janela.isMaximized();
    const b = max ? (config.get("janela") || {}) : janela.getBounds();
    config.set("janela", { ...b, maximized: max });
  };
  janela.on("resize", debounce(salvarEstado, 500));
  janela.on("move", debounce(salvarEstado, 500));
  janela.on("close", e => {
    salvarEstado();
    if (podeFechar) return;
    e.preventDefault();
    janela.webContents.send("pedido-fechar");
    setTimeout(() => { if (!podeFechar && janela && !janela.isDestroyed() && janela.webContents.isCrashed()) { podeFechar = true; janela.close(); } }, 4000);
  });
  janela.on("closed", () => { janela = null; });
}

ipcMain.on("resposta-fechar", (ev, ok) => {
  if (!ok) { pedidoInstalar = false; return; }
  podeFechar = true;
  if (pedidoInstalar) { const { autoUpdater } = require("electron-updater"); setImmediate(() => autoUpdater.quitAndInstall(true, true)); }
  else if (janela) janela.close();
});
ipcMain.on("tema", (ev, t) => {
  try {
    nativeTheme.themeSource = t.dark ? "dark" : "light";
    if (janela && process.platform !== "darwin") janela.setTitleBarOverlay({ color: t.background, symbolColor: t.symbol });
    if (janela) janela.setBackgroundColor(t.dark ? "#1e1e1e" : "#ffffff");
  } catch (e) {}
});
ipcMain.on("maximizar", () => { if (!janela) return; janela.isMaximized() ? janela.unmaximize() : janela.maximize(); });
ipcMain.on("abrir-url", (ev, url) => { if (/^(https?|mailto):/i.test(url)) shell.openExternal(url); });
ipcMain.handle("versao", () => app.getVersion());

function menuDeContexto(p) {
  const itens = [];
  if (p.misspelledWord) {
    for (const s of p.dictionarySuggestions.slice(0, 6)) itens.push({ label: s, click: () => janela.webContents.replaceMisspelling(s) });
    if (!p.dictionarySuggestions.length) itens.push({ label: "Sem sugestões", enabled: false });
    itens.push({ label: "Adicionar ao dicionário", click: () => janela.webContents.session.addWordToSpellCheckerDictionary(p.misspelledWord) });
    itens.push({ type: "separator" });
  }
  if (p.isEditable) itens.push({ label: "Recortar", role: "cut", enabled: p.editFlags.canCut }, { label: "Copiar", role: "copy", enabled: p.editFlags.canCopy }, { label: "Colar", role: "paste", enabled: p.editFlags.canPaste }, { type: "separator" }, { label: "Selecionar tudo", role: "selectAll" });
  else if (p.selectionText) itens.push({ label: "Copiar", role: "copy" });
  if (p.linkURL && /^https?:/.test(p.linkURL)) itens.push({ type: "separator" }, { label: "Abrir link no navegador", click: () => shell.openExternal(p.linkURL) });
  if (itens.length) Menu.buildFromTemplate(itens).popup({ window: janela });
}

function criarMenu() {
  const m = Menu.buildFromTemplate([
    { label: "Tinteiro", submenu: [{ role: "quit", label: "Sair" }] },
    { label: "Editar", submenu: [{ role: "undo", label: "Desfazer" }, { role: "redo", label: "Refazer" }, { type: "separator" }, { role: "cut", label: "Recortar" }, { role: "copy", label: "Copiar" }, { role: "paste", label: "Colar" }, { role: "selectAll", label: "Selecionar tudo" }] },
    { label: "Exibir", submenu: [{ role: "resetZoom", label: "Tamanho normal" }, { role: "zoomIn", label: "Aumentar", accelerator: "CommandOrControl+=" }, { role: "zoomOut", label: "Diminuir" }, { type: "separator" }, { role: "togglefullscreen", label: "Tela cheia" }, { role: "toggleDevTools", label: "Ferramentas do desenvolvedor", accelerator: "CommandOrControl+Shift+I" }] },
  ]);
  Menu.setApplicationMenu(m);
}

// ------------------------------------------------------------ atualização automática (GitHub Releases)
function configurarAtualizacao() {
  if (!app.isPackaged) return;
  let autoUpdater;
  try { autoUpdater = require("electron-updater").autoUpdater; } catch (e) { return; }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  let manual = false;
  const enviar = s => { if (janela && !janela.isDestroyed()) janela.webContents.send("atualizacao", { ...s, manual }); };
  autoUpdater.on("update-available", i => enviar({ estado: "disponivel", versao: i.version }));
  autoUpdater.on("update-not-available", () => { enviar({ estado: "nenhuma" }); manual = false; });
  autoUpdater.on("download-progress", p => enviar({ estado: "baixando", percentual: p.percent }));
  autoUpdater.on("update-downloaded", i => { enviar({ estado: "baixada", versao: i.version }); manual = false; });
  autoUpdater.on("error", e => { enviar({ estado: "erro", erro: String(e && e.message) }); manual = false; });
  const verificar = () => autoUpdater.checkForUpdates().catch(() => {});
  ipcMain.on("procurar-atualizacao", (ev, m) => { manual = !!m; verificar(); });
  ipcMain.on("instalar-atualizacao", () => {
    pedidoInstalar = true;
    if (janela) janela.webContents.send("pedido-fechar");
    else autoUpdater.quitAndInstall(true, true);
  });
  setTimeout(verificar, 8000);
  setInterval(verificar, 6 * 60 * 60 * 1000);
}

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
