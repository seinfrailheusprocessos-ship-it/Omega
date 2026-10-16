// Tinteiro — controlador principal.
import { h, vazio, debounce, modKey } from "./util/dom.js";
import { icon, iconButton, iconeDoArquivo } from "./util/icons.js";
import { Emitter } from "./util/events.js";
import { basename, dirname, extname, join, stem, NOME_INVALIDO } from "./util/path.js";
import { VaultModel, ordenarNomes } from "./workspace/vault-model.js";
import { Workspace, Leaf, TabGroup, EmptyView } from "./workspace/workspace.js";
import { viewParaExtensao } from "./views/registry.js";
import { FileExplorerView } from "./views/explorer.js";
import { SearchView, BookmarksView, OutlineView, HistoryPanelView } from "./views/sidebar.js";
import { Menu, fecharMenus } from "./ui/menu.js";
import { Modal, confirmar, perguntar } from "./ui/modal.js";
import { notice, erro } from "./ui/notice.js";
import { SuggestModal, fuzzy, linhaSugestao } from "./ui/suggest.js";

export const VERSAO = typeof __VERSAO__ !== "undefined" ? __VERSAO__ : "dev";

export class App extends Emitter {
  constructor({ backend, plataforma }) {
    super();
    this.backend = backend;
    this.plataforma = plataforma; // "desktop" | "web" | "android" | "pwa"
    this.isMobile = plataforma === "android" || plataforma === "pwa" || (plataforma === "web" && matchMedia("(max-width: 760px), (pointer: coarse)").matches);
    this.desktop = window.tinteiroDesktop || null;
    this.idSessao = Math.random().toString(36).slice(2);
    this.vault = new VaultModel(backend);
    this.vault.ordem = localStorage.getItem("tinteiro.ordem") || "nome-asc";
    this.workspace = new Workspace(this);
    this.comandos = [];
    this.recentes = JSON.parse(localStorage.getItem("tinteiro.recentes") || "[]");
    this.favoritos = JSON.parse(localStorage.getItem("tinteiro.favoritos") || "[]");
    this.config = JSON.parse(localStorage.getItem("tinteiro.config") || "{}");
    this.config = { tema: "sistema", larguraLegivel: true, tamanhoFonte: 16, mostrarTituloNoDoc: true, verificarOrtografia: true, ...this.config };
  }

  salvarConfig() { localStorage.setItem("tinteiro.config", JSON.stringify(this.config)); this.emit("config-changed"); }

  async start(raiz) {
    document.body.classList.toggle("is-mobile", this.isMobile);
    document.body.classList.toggle("is-phone", this.isMobile && Math.min(screen.width, screen.height) < 600);
    document.body.classList.toggle("is-desktop-app", !!this.desktop);
    if (this.desktop?.windowControls) document.body.classList.add("has-window-controls");
    this.aplicarTema();
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => this.aplicarTema());
    this.montarInterface(raiz);
    await this.vault.load();
    this.registrarComandos();
    this.configurarAtalhos();
    await this.montarLaterais();
    let layout = null;
    try { layout = this.isMobile ? JSON.parse(localStorage.getItem("tinteiro.layout.mobile") || "null") : await this.backend.getConfig("workspace.json"); } catch (e) {}
    await this.workspace.restaurar(layout && layout.raiz ? layout : null);
    this.salvarLayout = debounce(() => this.persistirLayout(), 800);
    this.on("layout-changed", () => this.salvarLayout());
    this.on("active-leaf-change", () => { this.atualizarStatus(); this.emit("file-open", this.arquivoAtivo()); this.atualizarTituloJanela(); });
    this.on("dirty-changed", () => { this.atualizarStatus(); this.atualizarTituloJanela(); });
    this.configurarEventosBackend();
    if (this.isMobile) { const { MobileUI } = await import("./mobile/mobile.js"); this.mobile = new MobileUI(this); this.mobile.montar(); }
    window.addEventListener("beforeunload", e => { if (this.workspace.leaves().some(l => l.view?.dirty && !l.view.autosave)) { e.preventDefault(); e.returnValue = ""; } });
    this.desktop?.onBeforeClose?.(async () => this.fecharTudoComSeguranca());
    this.desktop?.onUpdateStatus?.(s => this.statusAtualizacao(s));
    this.desktop?.onOpenFile?.(p => this.abrirCaminhoExterno(p));
    this.atualizarStatus();
    this.atualizarTituloJanela();
    this.emit("ready");
    document.body.classList.add("is-ready");
  }

  // ------------------------------------------------------------ tema
  temaEfetivo() {
    const t = this.config.tema;
    if (t === "claro" || t === "escuro") return t;
    return matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
  }
  aplicarTema() {
    const t = this.temaEfetivo();
    document.body.classList.toggle("theme-dark", t === "escuro");
    document.body.classList.toggle("theme-light", t === "claro");
    document.body.style.setProperty("--font-text-size", (this.config.tamanhoFonte || 16) + "px");
    document.body.classList.toggle("readable-line-width", this.config.larguraLegivel !== false);
    const cs = getComputedStyle(document.body);
    const fundo = cs.getPropertyValue("--background-secondary").trim() || (t === "escuro" ? "#262626" : "#f6f6f6");
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) { meta = h("meta", { name: "theme-color" }); document.head.appendChild(meta); }
    meta.content = this.isMobile ? (t === "escuro" ? "#1e1e1e" : "#ffffff") : fundo;
    this.desktop?.setTheme?.({ dark: t === "escuro", background: t === "escuro" ? "#262626" : "#f6f6f6", symbol: t === "escuro" ? "#dadada" : "#222222" });
    this.emit("theme-changed", t);
  }
  alternarTema() { this.config.tema = this.temaEfetivo() === "escuro" ? "claro" : "escuro"; this.salvarConfig(); this.aplicarTema(); }

  // ------------------------------------------------------------ interface
  montarInterface(raiz) {
    this.ribbonAcoes = h("div.side-dock-actions");
    this.ribbonBaixo = h("div.side-dock-settings");
    this.ribbonEl = h("div.workspace-ribbon.side-dock-ribbon.mod-left",
      h("div.sidebar-toggle-button.mod-left", iconButton("sidebar-left", "Mostrar/ocultar barra lateral esquerda", () => this.alternarLateral("esquerda"))),
      this.ribbonAcoes, this.ribbonBaixo);
    const ra = (ic, t, fn) => this.ribbonAcoes.appendChild(iconButton(ic, t, fn, "clickable-icon side-dock-ribbon-action"));
    ra("file-search", "Abrir troca rápida", () => this.trocaRapida());
    ra("terminal", "Abrir paleta de comandos", () => this.paletaComandos());
    ra("new-note", "Criar nova nota", () => this.novaNota());
    ra("file-type", "Novo documento Word", () => this.novoDocumento(this.pastaAtual(), "docx"));
    ra("file-spreadsheet", "Nova planilha", () => this.novoDocumento(this.pastaAtual(), "xlsx"));
    ra("history", "Histórico de versões do arquivo", () => this.mostrarHistorico());
    if (this.backend.caps.pairing || this.backend.kind === "local") ra("smartphone", "Sincronizar com o celular", () => this.abrirConfiguracoes("sincronizacao"));
    this.ribbonBaixo.appendChild(iconButton(this.temaEfetivo() === "escuro" ? "sun" : "moon", "Alternar tema claro/escuro", e => { this.alternarTema(); vazio(e.currentTarget || this.ribbonBaixo.firstChild).appendChild(icon(this.temaEfetivo() === "escuro" ? "sun" : "moon")); }, "clickable-icon side-dock-ribbon-action"));

    this.esquerda = this.criarDock("left");
    this.direita = this.criarDock("right");
    this.statusEl = h("div.status-bar");
    this.workspaceEl = h("div.workspace", this.ribbonEl, this.esquerda.el, this.workspace.root.el, this.direita.el);
    this.app = h("div.app-container", h("div.horizontal-main-container", this.workspaceEl), this.statusEl);
    raiz.appendChild(this.app);
    this.workspaceEl.addEventListener("contextmenu", e => { if (!e.target.closest("input,textarea,[contenteditable],.cm-editor,.view-content")) e.preventDefault(); });
    window.addEventListener("resize", debounce(() => this.emit("resize"), 100));
    this.on("resize", () => this.workspace.leaves().forEach(l => l.view?.onResize()));
    // canto superior direito: botão da barra lateral direita e (no Windows) espaço para minimizar/maximizar/fechar
    this.botaoLateralDireita = h("div.sidebar-toggle-button.mod-right", iconButton("sidebar-right", "Mostrar/ocultar barra lateral direita", () => this.alternarLateral("direita")));
    if (!this.isMobile) {
      const ajustar = debounce(() => this.ajustarControlesJanela(), 30);
      this.on("resize", ajustar); this.on("layout-changed", ajustar);
      setTimeout(() => this.ajustarControlesJanela(), 300);
    }
  }

  criarDock(lado) {
    const grupo = new TabGroup(this.workspace, { sidebar: true });
    const el = h(`div.workspace-split.mod-horizontal.mod-sidedock.mod-${lado}-split`);
    const larguraSalva = Number(localStorage.getItem(`tinteiro.largura.${lado}`)) || (lado === "left" ? 300 : 300);
    el.style.width = larguraSalva + "px";
    el.appendChild(grupo.el);
    if (lado === "left") {
      this.nomeCofreEl = h("div.workspace-drawer-vault-name");
      const perfil = h("div.workspace-sidedock-vault-profile",
        h("div.workspace-drawer-vault-switcher", { onclick: e => this.menuCofre(e) }, this.nomeCofreEl, h("div.workspace-drawer-vault-switcher-icon", icon("chevrons-up-down"))),
        h("div.workspace-drawer-vault-actions",
          iconButton("help", "Ajuda", () => this.ajuda()),
          iconButton("settings", "Configurações", () => this.abrirConfiguracoes())));
      el.appendChild(perfil);
    } else {
      grupo.headerEl.appendChild(h("div.workspace-tab-header-spacer"));
      grupo.headerEl.appendChild(h("div.titlebar-controls-spacer"));
    }
    const alca = h("div.workspace-leaf-resize-handle");
    el.appendChild(alca);
    alca.addEventListener("mousedown", e => {
      e.preventDefault();
      const ini = e.clientX, w0 = el.getBoundingClientRect().width;
      alca.classList.add("is-dragging");
      const mover = ev => { const w = Math.max(180, Math.min(700, w0 + (lado === "left" ? ev.clientX - ini : ini - ev.clientX))); el.style.width = w + "px"; };
      const soltar = () => { alca.classList.remove("is-dragging"); document.removeEventListener("mousemove", mover); document.removeEventListener("mouseup", soltar); localStorage.setItem(`tinteiro.largura.${lado}`, parseInt(el.style.width)); this.emit("resize"); };
      document.addEventListener("mousemove", mover); document.addEventListener("mouseup", soltar);
    });
    if (localStorage.getItem(`tinteiro.recolhida.${lado}`) === "1") el.classList.add("is-collapsed");
    return { el, grupo, lado };
  }

  async montarLaterais() {
    this.nomeCofreEl.textContent = this.backend.info?.vaultName || "Cofre";
    const add = async (dock, Classe) => {
      const leaf = new Leaf(this, true);
      dock.grupo.addLeaf(leaf);
      const v = new Classe(leaf);
      leaf.view = v;
      leaf.contentEl.dataset.type = v.getViewType();
      leaf.atualizarCabecalho();
      await v.onOpen();
      return leaf;
    };
    this.leafExplorador = await add(this.esquerda, FileExplorerView);
    this.leafBusca = await add(this.esquerda, SearchView);
    this.leafFavoritos = await add(this.esquerda, BookmarksView);
    this.esquerda.grupo.setActive(this.leafExplorador);
    this.leafEstrutura = await add(this.direita, OutlineView);
    this.leafHistorico = await add(this.direita, HistoryPanelView);
    this.direita.grupo.setActive(this.leafEstrutura);
    // aba ativa de cada lateral volta para a última escolha
    const ae = localStorage.getItem("tinteiro.lateral.esquerda"), ad = localStorage.getItem("tinteiro.lateral.direita");
    for (const l of this.esquerda.grupo.leaves) if (l.view.getViewType() === ae) this.esquerda.grupo.setActive(l);
    for (const l of this.direita.grupo.leaves) if (l.view.getViewType() === ad) this.direita.grupo.setActive(l);
    this.on("sidebar-tab", (g, l) => localStorage.setItem(g === this.esquerda.grupo ? "tinteiro.lateral.esquerda" : "tinteiro.lateral.direita", l.view?.getViewType() || ""));
  }

  ajustarControlesJanela() {
    const grupos = [this.direita.grupo, ...this.workspace.grupos()];
    let alvo = null;
    for (const g of grupos) {
      g.el.classList.remove("mod-top-right-space");
      const r = g.headerEl.getBoundingClientRect();
      if (!alvo && r.width && r.right >= window.innerWidth - 2 && r.top <= 1) alvo = g;
    }
    if (!alvo) return;
    alvo.el.classList.add("mod-top-right-space");
    const esp = alvo.headerEl.querySelector(".titlebar-controls-spacer");
    if (this.botaoLateralDireita.parentNode !== alvo.headerEl || this.botaoLateralDireita.nextSibling !== esp) alvo.headerEl.insertBefore(this.botaoLateralDireita, esp);
  }

  alternarLateral(lado, abrir) {
    const dock = lado === "esquerda" ? this.esquerda : this.direita;
    if (this.isMobile) { this.mobile?.abrirGaveta(lado === "esquerda" ? "left" : "right"); return; }
    const recolher = abrir === undefined ? !dock.el.classList.contains("is-collapsed") : !abrir;
    dock.el.classList.toggle("is-collapsed", recolher);
    if (lado === "esquerda") this.ribbonEl.classList.toggle("is-collapsed", recolher);
    localStorage.setItem(`tinteiro.recolhida.${dock.lado}`, recolher ? "1" : "0");
    this.emit("resize");
    this.emit("layout-changed");
  }

  mostrarPainel(leaf) {
    const dock = leaf.group === this.esquerda.grupo ? "esquerda" : "direita";
    leaf.group.setActive(leaf);
    if (this.isMobile) this.mobile?.abrirGaveta(dock === "esquerda" ? "left" : "right", leaf);
    else this.alternarLateral(dock, true);
    leaf.view?.focus();
    setTimeout(() => leaf.view?.focus(), 30);
  }

  // ------------------------------------------------------------ eventos do servidor / sincronização
  configurarEventosBackend() {
    const atualizar = debounce(async () => {
      try {
        const { mudados, removidos } = await this.vault.refresh();
        for (const l of this.workspace.leaves()) {
          const p = l.view?.file?.path;
          if (!p) continue;
          if (removidos.includes(p)) continue;
          const e = this.vault.get(p);
          if (mudados.includes(p) && e && l.view.ultimaVersaoLida && Math.abs(e.mtime - l.view.ultimaVersaoLida) > 1) l.view.onExternalChange();
        }
      } catch (e) {}
    }, 300);
    this.backend.on("event", ev => {
      if (ev.type === "hello") return;
      if (ev.type === "vault") { location.reload(); return; }
      if (ev.origem === this.idSessao) return;
      atualizar();
    });
    this.backend.on("synced", () => atualizar());
    window.addEventListener("focus", () => atualizar());
    document.addEventListener("visibilitychange", () => { if (!document.hidden) atualizar(); });
    this.vault.on("renamed", (de, para) => {
      for (const l of this.workspace.leaves()) {
        const p = l.view?.file?.path;
        if (p && (p === de || p.startsWith(de + "/"))) l.view.onRename(this.vault.get(para + p.slice(de.length)) || { ...l.view.file, path: para + p.slice(de.length) });
      }
      this.recentes = this.recentes.map(p => (p === de || p.startsWith(de + "/") ? para + p.slice(de.length) : p));
      this.favoritos = this.favoritos.map(p => (p === de || p.startsWith(de + "/") ? para + p.slice(de.length) : p));
      localStorage.setItem("tinteiro.favoritos", JSON.stringify(this.favoritos));
      this.salvarLayout?.();
    });
    this.vault.on("deleted", p => {
      for (const l of this.workspace.leaves()) {
        const vp = l.view?.file?.path;
        if (vp && (vp === p || vp.startsWith(p + "/"))) { l.view.dirty = false; l.fechar(); }
      }
    });
  }

  persistirLayout() {
    const dados = this.workspace.serializar();
    if (this.isMobile) localStorage.setItem("tinteiro.layout.mobile", JSON.stringify(dados));
    else this.backend.setConfig("workspace.json", dados).catch(() => {});
  }

  async fecharTudoComSeguranca() {
    for (const l of this.workspace.leaves()) {
      if (l.view?.dirty) { this.workspace.setActiveLeaf(l); l.group.setActive(l); if (!(await l.view.canClose())) return false; }
    }
    this.persistirLayout();
    return true;
  }

  // ------------------------------------------------------------ abrir arquivos
  async criarView(leaf, vs) {
    if (vs.type === "empty" || !vs.state?.file) return new EmptyView(leaf);
    const entrada = this.vault.get(vs.state.file);
    if (!entrada) return new EmptyView(leaf);
    if (vs.type === "file-version") {
      const { VersionView } = await import("./views/version.js");
      return new VersionView(leaf, entrada, vs.state);
    }
    const Classe = await viewParaExtensao(entrada.ext);
    return new Classe(leaf, entrada);
  }

  arquivoAtivo() { return this.workspace.activeLeaf?.view?.file || null; }
  pastaAtual() { const f = this.arquivoAtivo(); return f ? dirname(f.path) : ""; }

  leafComArquivo(path) { return this.workspace.leaves().find(l => (l.view?.file?.path === path && l.view.getViewType() !== "file-version") || l.pendente?.state?.file === path); }

  async abrirArquivo(path, { novaAba = false, busca = null, mobileFechar = false, dividir = null, linha = null } = {}) {
    const e = this.vault.get(path);
    if (!e || e.type !== "file") { notice("Arquivo não encontrado: " + path); return null; }
    if (mobileFechar && this.isMobile) this.mobile?.fecharGavetas();
    let leaf = this.leafComArquivo(path);
    if (leaf) {
      leaf.group.setActive(leaf);
      this.workspace.setActiveLeaf(leaf);
    } else {
      if (dividir) { const atual = this.workspace.activeLeaf; leaf = await this.workspace.dividir(atual, dividir); }
      else leaf = this.workspace.getLeaf(novaAba || this.config.sempreNovaAba);
      leaf.group.setActive(leaf);
      await leaf.openFile(e);
      this.workspace.setActiveLeaf(leaf);
    }
    this.registrarRecente(path);
    if (busca && leaf.view?.destacarBusca) setTimeout(() => leaf.view.destacarBusca(busca), 150);
    if (linha != null && leaf.view?.irParaLinha) setTimeout(() => leaf.view.irParaLinha(linha), 150);
    this.emit("file-open", e);
    return leaf;
  }

  async abrirNaFolha(leaf, path) {
    const e = this.vault.get(path);
    if (!e) return;
    if (e.type === "folder") return;
    const existente = this.leafComArquivo(path);
    if (existente && existente !== leaf) { await leaf.fechar(); existente.group.setActive(existente); return; }
    await leaf.openFile(e);
    this.workspace.setActiveLeaf(leaf);
    this.registrarRecente(path);
  }

  async abrirCaminhoExterno(caminhoRel) { if (caminhoRel && this.vault.exists(caminhoRel)) this.abrirArquivo(caminhoRel); }

  registrarRecente(path) {
    this.recentes = [path, ...this.recentes.filter(p => p !== path)].slice(0, 50);
    localStorage.setItem("tinteiro.recentes", JSON.stringify(this.recentes));
  }

  revelarNoExplorador(path) {
    this.mostrarPainel(this.leafExplorador);
    setTimeout(() => this.leafExplorador.view.revelar(path), 60);
  }

  // ------------------------------------------------------------ criar, renomear, mover, excluir
  async novaNota(pasta = this.pastaAtual(), { novaAba = false } = {}) {
    const p = this.vault.nomeLivre(pasta, "Sem título", "md");
    try {
      await this.vault.create(p, "");
      const leaf = await this.abrirArquivo(p, { novaAba });
      leaf?.view?.focarTitulo?.();
      return p;
    } catch (e) { erro("Não foi possível criar a nota.", e); }
  }

  async novaPasta(pasta = "") {
    const p = this.vault.nomeLivre(pasta, "Sem título", "");
    try {
      await this.vault.mkdir(p);
      this.revelarNoExplorador(p);
      setTimeout(() => this.leafExplorador.view.renomearInline(p), 120);
    } catch (e) { erro("Não foi possível criar a pasta.", e); }
  }

  async novoDocumento(pasta, tipo) {
    const { docxEmBranco, xlsxEmBranco } = await import("./util/modelos.js");
    const nome = await perguntar({ titulo: tipo === "docx" ? "Novo documento Word" : "Nova planilha", valor: tipo === "docx" ? "Documento sem título" : "Planilha sem título", ok: "Criar" });
    if (!nome) return;
    if (NOME_INVALIDO.test(nome)) return notice("O nome não pode ter \\ / : * ? \" < > |");
    let p = join(pasta, nome.toLowerCase().endsWith("." + tipo) ? nome : `${nome}.${tipo}`);
    if (this.vault.exists(p)) p = this.vault.nomeLivre(pasta, stem(p), tipo);
    try {
      const dados = tipo === "docx" ? await docxEmBranco() : await xlsxEmBranco();
      await this.vault.create(p, dados);
      await this.abrirArquivo(p);
    } catch (e) { erro("Não foi possível criar o arquivo.", e); }
  }

  importarArquivos(pasta = this.pastaAtual()) {
    const inp = h("input", { type: "file", multiple: true, style: { display: "none" } });
    inp.addEventListener("change", () => { this.enviarArquivos([...inp.files], pasta); inp.remove(); });
    document.body.appendChild(inp);
    inp.click();
  }

  async enviarArquivos(arquivos, pasta) {
    let ok = 0;
    for (const f of arquivos) {
      let p = join(pasta, f.name);
      if (this.vault.exists(p)) { const i = f.name.lastIndexOf("."); p = this.vault.nomeLivre(pasta, i > 0 ? f.name.slice(0, i) : f.name, i > 0 ? f.name.slice(i + 1) : ""); }
      try { await this.vault.create(p, new Uint8Array(await f.arrayBuffer())); ok++; }
      catch (e) { erro("Não foi possível importar " + f.name, e); }
    }
    if (ok) notice(`${ok} arquivo${ok > 1 ? "s" : ""} importado${ok > 1 ? "s" : ""}.`);
  }

  async renomear(path, { modal = false } = {}) {
    const e = this.vault.get(path);
    if (!e) return;
    if (!modal && !this.isMobile && this.leafExplorador && !this.esquerda.el.classList.contains("is-collapsed")) { this.leafExplorador.group.setActive(this.leafExplorador); return this.leafExplorador.view.renomearInline(path); }
    const atual = e.type === "file" && e.ext === "md" ? e.basename : e.name;
    const ponto = e.type === "file" && e.ext !== "md" ? atual.lastIndexOf(".") : -1;
    const novo = await perguntar({ titulo: "Renomear", valor: atual, selecionarAte: ponto > 0 ? ponto : null, ok: "Renomear" });
    if (!novo || novo === atual) return;
    if (NOME_INVALIDO.test(novo)) return notice("O nome não pode ter \\ / : * ? \" < > |");
    await this.moverPara(path, join(dirname(path), e.type === "file" && e.ext === "md" ? novo + ".md" : novo));
  }

  async moverPara(de, para) {
    if (de === para) return;
    for (const l of this.workspace.leaves()) if (l.view?.file?.path === de && l.view.dirty) await l.view.save({ explicit: true, silencioso: true });
    try { await this.vault.rename(de, para); }
    catch (e) { erro("Não foi possível mover/renomear.", e); }
  }

  async excluir(path) {
    const e = this.vault.get(path);
    if (!e) return;
    const ok = await confirmar({ titulo: e.type === "folder" ? "Excluir pasta" : "Excluir arquivo", texto: `Tem certeza de que quer excluir “${e.name}”?${e.type === "folder" ? " Tudo que está dentro da pasta também será excluído." : ""} O item vai para a lixeira.`, ok: "Excluir", perigo: true });
    if (!ok) return;
    try { await this.vault.remove(path); notice(`“${e.name}” foi para a lixeira.`); }
    catch (err) { erro("Não foi possível excluir.", err); }
  }

  async duplicar(path) {
    const e = this.vault.get(path);
    const p = this.vault.nomeLivre(dirname(path), (e.type === "file" ? e.basename : e.name) + " (cópia)", e.type === "file" ? e.ext : "");
    try { await this.vault.copy(path, p); if (e.type === "file") this.abrirArquivo(p); }
    catch (err) { erro("Não foi possível duplicar.", err); }
  }

  copiarCaminho(path) {
    const raiz = this.backend.info?.root;
    const completo = raiz ? (raiz.replace(/[\\/]+$/, "") + (raiz.includes("\\") ? "\\" + path.replace(/\//g, "\\") : "/" + path)) : path;
    navigator.clipboard?.writeText(completo).then(() => notice("Caminho copiado.")).catch(() => notice(completo));
  }

  async abrirNoPrograma(path) {
    try {
      if (this.backend.caps.openExternal) await this.backend.openExternal(path);
      else notice("Abrir no programa padrão só funciona no computador ou no app Android.");
    } catch (e) { erro("Não foi possível abrir no programa padrão.", e); }
  }

  alternarFavorito(path) {
    if (this.favoritos.includes(path)) this.favoritos = this.favoritos.filter(p => p !== path);
    else this.favoritos.push(path);
    localStorage.setItem("tinteiro.favoritos", JSON.stringify(this.favoritos));
    this.emit("bookmarks-changed");
  }

  itensMenuArquivo(m, e, origem) {
    if (e.type === "folder") return;
    if (origem !== "pane" && origem !== "tab") {
      m.addItem({ title: "Abrir em nova aba", icon: "file-plus", onClick: () => this.abrirArquivo(e.path, { novaAba: true }) });
      if (!this.isMobile) m.addItem({ title: "Abrir à direita", icon: "split-right", onClick: () => this.abrirArquivo(e.path, { dividir: "vertical" }) });
      m.addSeparator();
    }
    if (this.backend.caps.openExternal) m.addItem({ title: "Abrir no programa padrão", icon: "external-link", onClick: () => this.abrirNoPrograma(e.path) });
    m.addItem({ title: "Histórico de versões", icon: "history", onClick: () => this.mostrarHistorico(e.path) });
    m.addItem({ title: this.favoritos.includes(e.path) ? "Remover dos favoritos" : "Adicionar aos favoritos", icon: "bookmark", onClick: () => this.alternarFavorito(e.path) });
    m.addSeparator();
    m.addItem({ title: "Duplicar", icon: "copy", onClick: () => this.duplicar(e.path) });
    m.addItem({ title: "Renomear…", icon: "pencil", onClick: () => (origem === "explorer" ? this.leafExplorador.view.renomearInline(e.path) : this.renomear(e.path, { modal: true })) });
    m.addItem({ title: "Excluir", icon: "trash", warning: true, onClick: () => this.excluir(e.path) });
    m.addSeparator();
    if (origem !== "explorer") m.addItem({ title: "Mostrar na lista de arquivos", icon: "folder-open", onClick: () => this.revelarNoExplorador(e.path) });
    if (this.backend.caps.reveal) m.addItem({ title: "Mostrar no Explorador de Arquivos", icon: "folder-open", onClick: () => this.backend.reveal(e.path) });
    m.addItem({ title: "Copiar caminho", icon: "copy", onClick: () => this.copiarCaminho(e.path) });
  }

  // ------------------------------------------------------------ histórico de versões
  mostrarHistorico(path) {
    const p = path || this.arquivoAtivo()?.path;
    if (!p) return notice("Abra um arquivo primeiro.");
    if (path && path !== this.arquivoAtivo()?.path) this.abrirArquivo(path);
    this.mostrarPainel(this.leafHistorico);
  }

  async abrirVersao(path, v) {
    const leaf = this.workspace.getLeaf(true);
    leaf.group.setActive(leaf);
    await leaf.setViewState({ type: "file-version", state: { file: path, versao: v.id, quando: v.time } }, { historico: false });
  }

  async restaurarVersao(path, v) {
    const { formatData } = await import("./util/dom.js");
    const ok = await confirmar({ titulo: "Restaurar versão", texto: `Restaurar “${basename(path)}” para a versão de ${formatData(v.time)}? A versão atual também fica guardada no histórico.`, ok: "Restaurar" });
    if (!ok) return;
    try {
      const l = this.leafComArquivo(path);
      if (l?.view) l.view.dirty = false;
      await this.backend.restore(path, v.id);
      await this.vault.refresh();
      if (l?.view) await l.view.recarregar();
      notice("Versão restaurada.");
      this.emit("file-saved", path);
    } catch (e) { erro("Não foi possível restaurar.", e); }
  }

  // ------------------------------------------------------------ comandos e atalhos
  addCommand(c) { this.comandos.push(c); }

  registrarComandos() {
    const C = (id, nome, fn, tecla, ic) => this.addCommand({ id, nome, fn, tecla, icon: ic });
    const v = () => this.workspace.activeLeaf?.view;
    C("troca-rapida", "Troca rápida: abrir arquivo", () => this.trocaRapida(), "Ctrl+O", "file-search");
    C("paleta", "Paleta de comandos: abrir", () => this.paletaComandos(), "Ctrl+P", "terminal");
    C("buscar", "Buscar em todos os arquivos", () => this.buscaGlobal(), "Ctrl+Shift+F", "search");
    C("nova-nota", "Criar nova nota", () => this.novaNota(), "Ctrl+N", "new-note");
    C("nova-nota-aba", "Criar nova nota em nova aba", () => this.novaNota(undefined, { novaAba: true }), null, "new-note");
    C("novo-docx", "Criar novo documento Word", () => this.novoDocumento(this.pastaAtual(), "docx"), null, "file-type");
    C("nova-planilha", "Criar nova planilha", () => this.novoDocumento(this.pastaAtual(), "xlsx"), null, "file-spreadsheet");
    C("nova-pasta", "Criar nova pasta", () => this.novaPasta(this.pastaAtual()), null, "folder-plus");
    C("nova-aba", "Nova aba", () => this.workspace.activeLeaf?.group.novaAba(), "Ctrl+T", "plus");
    C("fechar-aba", "Fechar aba atual", () => this.workspace.activeLeaf?.fechar(), "Ctrl+W", "x");
    C("salvar", "Salvar arquivo atual", () => v()?.save?.({ explicit: true }), "Ctrl+S", "save");
    C("dividir-direita", "Dividir à direita", () => this.workspace.dividir(this.workspace.activeLeaf, "vertical"), null, "split-right");
    C("dividir-baixo", "Dividir para baixo", () => this.workspace.dividir(this.workspace.activeLeaf, "horizontal"), null, "split-down");
    C("lateral-esquerda", "Mostrar/ocultar barra lateral esquerda", () => this.alternarLateral("esquerda"), null, "sidebar-left");
    C("lateral-direita", "Mostrar/ocultar barra lateral direita", () => this.alternarLateral("direita"), null, "sidebar-right");
    C("voltar", "Navegar para trás", () => this.workspace.activeLeaf?.navegar(-1), "Ctrl+Alt+←", "arrow-left");
    C("avancar", "Navegar para a frente", () => this.workspace.activeLeaf?.navegar(1), "Ctrl+Alt+→", "arrow-right");
    C("proxima-aba", "Ir para a próxima aba", () => this.trocarAba(1), "Ctrl+Tab");
    C("aba-anterior", "Ir para a aba anterior", () => this.trocarAba(-1), "Ctrl+Shift+Tab");
    C("tema", "Alternar tema claro/escuro", () => this.alternarTema(), null, "moon");
    C("configuracoes", "Abrir configurações", () => this.abrirConfiguracoes(), "Ctrl+,", "settings");
    C("renomear", "Renomear arquivo atual", () => this.arquivoAtivo() && this.renomear(this.arquivoAtivo().path), "F2", "pencil");
    C("excluir", "Excluir arquivo atual", () => this.arquivoAtivo() && this.excluir(this.arquivoAtivo().path), null, "trash");
    C("revelar", "Mostrar arquivo atual na lista de arquivos", () => this.arquivoAtivo() && this.revelarNoExplorador(this.arquivoAtivo().path), null, "folder-open");
    C("programa-padrao", "Abrir arquivo atual no programa padrão", () => this.arquivoAtivo() && this.abrirNoPrograma(this.arquivoAtivo().path), null, "external-link");
    C("historico", "Ver histórico de versões do arquivo atual", () => this.mostrarHistorico(), null, "history");
    C("estrutura", "Mostrar estrutura do documento", () => this.mostrarPainel(this.leafEstrutura), null, "outline");
    C("favoritos", "Mostrar favoritos", () => this.mostrarPainel(this.leafFavoritos), null, "bookmark");
    C("arquivos", "Mostrar lista de arquivos", () => this.mostrarPainel(this.leafExplorador), "Ctrl+Shift+E", "folder-closed");
    C("favoritar", "Adicionar/remover arquivo atual dos favoritos", () => this.arquivoAtivo() && this.alternarFavorito(this.arquivoAtivo().path), null, "star");
    C("recarregar", "Recarregar arquivo atual do disco", () => v()?.recarregar?.(), null, "refresh");
    C("importar", "Importar arquivos para a pasta atual", () => this.importarArquivos(), null, "upload");
    C("duplicar", "Duplicar arquivo atual", () => this.arquivoAtivo() && this.duplicar(this.arquivoAtivo().path), null, "copy");
    C("sincronizar", "Sincronização com o celular", () => this.abrirConfiguracoes("sincronizacao"), null, "smartphone");
    if (this.desktop) C("atualizar", "Procurar atualização do app", () => this.desktop.checkUpdates?.(true), null, "download");
    C("imprimir", "Imprimir arquivo atual", () => v()?.imprimir ? v().imprimir() : window.print(), null, "printer");
  }

  configurarAtalhos() {
    const norm = e => {
      const p = [];
      if (modKey(e)) p.push("Ctrl");
      if (e.altKey) p.push("Alt");
      if (e.shiftKey) p.push("Shift");
      let k = e.key;
      if (k === "ArrowLeft") k = "←"; else if (k === "ArrowRight") k = "→";
      else if (k.length === 1) k = k.toUpperCase();
      p.push(k);
      return p.join("+");
    };
    document.addEventListener("keydown", e => {
      if (document.querySelector(".modal-container") && e.key !== "Escape") {
        // dentro de janelas só os atalhos da própria janela
        return;
      }
      const t = norm(e);
      const c = this.comandos.find(c => c.tecla === t || (c.tecla === "Ctrl+P" && t === "Ctrl+Shift+P"));
      if (c) {
        if (c.id === "salvar" || c.id === "troca-rapida" || c.id === "paleta" || c.id === "nova-aba" || c.id === "fechar-aba" || c.id === "nova-nota" || modKey(e) || e.key === "F2") {
          if (c.id === "renomear" && e.target.closest?.("input,textarea,[contenteditable=true],.cm-editor")) return;
          e.preventDefault(); e.stopPropagation();
          fecharMenus();
          c.fn();
        }
      }
    }, true);
  }

  trocarAba(d) {
    const l = this.workspace.activeLeaf; if (!l) return;
    const g = l.group, i = g.leaves.indexOf(l);
    g.setActive(g.leaves[(i + d + g.leaves.length) % g.leaves.length]);
  }

  paletaComandos() {
    const app = this;
    const m = new SuggestModal({ placeholder: "Digite um comando…", instrucoes: [["↑↓", "para navegar"], ["↵", "para usar"], ["esc", "para fechar"]], vazioTexto: "Nenhum comando encontrado." });
    const usados = JSON.parse(localStorage.getItem("tinteiro.comandosUsados") || "[]");
    m.getSuggestions = q => {
      const extra = app.workspace.activeLeaf?.view?.getCommands?.() || [];
      const todos = [...extra, ...app.comandos];
      if (!q.trim()) return todos.slice().sort((a, b) => { const ia = usados.indexOf(a.id), ib = usados.indexOf(b.id); return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.nome.localeCompare(b.nome); }).map(c => ({ c }));
      return todos.map(c => ({ c, r: fuzzy(q, c.nome) })).filter(x => x.r).sort((a, b) => b.r.score - a.r.score);
    };
    m.renderSuggestion = (it, el) => linhaSugestao(el, { titulo: it.c.nome, ranges: it.r?.ranges, hotkeys: it.c.tecla ? [it.c.tecla] : [] });
    m.onChooseSuggestion = it => {
      const lista = [it.c.id, ...usados.filter(x => x !== it.c.id)].slice(0, 20);
      localStorage.setItem("tinteiro.comandosUsados", JSON.stringify(lista));
      setTimeout(() => it.c.fn(), 10);
    };
    m.open();
  }

  trocaRapida({ recentes = false } = {}) {
    const app = this;
    const m = new SuggestModal({ placeholder: "Encontre ou crie uma nota…", instrucoes: [["↑↓", "para navegar"], ["↵", "para abrir"], ["ctrl ↵", "abrir em nova aba"], ["shift ↵", "para criar"], ["esc", "para fechar"]], vazioTexto: "Nenhum arquivo encontrado. Shift+Enter cria uma nota." });
    m.getSuggestions = q => {
      const arquivos = app.vault.files();
      if (!q.trim()) {
        const rec = app.recentes.map(p => app.vault.get(p)).filter(Boolean);
        const resto = recentes ? [] : arquivos.filter(f => !app.recentes.includes(f.path)).sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
        return [...rec, ...resto].map(e => ({ e }));
      }
      const res = [];
      for (const e of arquivos) {
        const nome = e.ext === "md" ? e.basename : e.name;
        const r1 = fuzzy(q, nome), r2 = r1 ? null : fuzzy(q, e.path);
        if (r1) res.push({ e, r: r1, nome: true, score: r1.score + 100 });
        else if (r2) res.push({ e, r: r2, nome: false, score: r2.score });
      }
      res.sort((a, b) => b.score - a.score);
      return res;
    };
    m.renderSuggestion = (it, el) => {
      const e = it.e;
      const nome = e.ext === "md" ? e.basename : e.name;
      linhaSugestao(el, { titulo: nome, ranges: it.nome ? it.r?.ranges : null, nota: e.parent ? e.parent + "/" : "", iconeFlair: e.ext !== "md" ? iconeDoArquivo(e.ext) : null });
    };
    m.onChooseSuggestion = (it, ev) => app.abrirArquivo(it.e.path, { novaAba: ev && (ev.ctrlKey || ev.metaKey) });
    const teclaOrig = m.tecla.bind(m);
    m.tecla = async e => {
      if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        const nome = m.inputEl.value.trim();
        if (!nome) return;
        m.close();
        const p = join(app.pastaAtual(), nome.toLowerCase().endsWith(".md") ? nome : nome + ".md");
        if (!app.vault.exists(p)) await app.vault.create(p, "");
        app.abrirArquivo(p);
        return;
      }
      teclaOrig(e);
    };
    m.open();
  }

  buscaGlobal(q) {
    this.mostrarPainel(this.leafBusca);
    const sel = q || window.getSelection()?.toString().trim();
    if (sel && sel.length < 80) this.leafBusca.view.setQuery(sel);
  }

  // ------------------------------------------------------------ barra de status e título
  atualizarStatus() {
    vazio(this.statusEl);
    const v = this.workspace.activeLeaf?.view;
    const itens = v?.getStatus?.() || [];
    for (const it of itens) {
      const el = h("div.status-bar-item" + (it.onClick ? ".mod-clickable" : ""), it.icon ? icon(it.icon) : null, it.texto ? h("span", { text: it.texto }) : null);
      if (it.title) el.title = it.title;
      if (it.onClick) el.addEventListener("click", it.onClick);
      this.statusEl.appendChild(el);
    }
    if (v?.dirty && !v.autosave) this.statusEl.appendChild(h("div.status-bar-item.mod-clickable", { title: "Salvar (Ctrl+S)", onclick: () => v.save() }, icon("save"), h("span", { text: "Não salvo" })));
    if (this.statusSync) this.statusEl.appendChild(this.statusSync);
    if (this.statusUpdate) this.statusEl.appendChild(this.statusUpdate);
    this.statusEl.classList.toggle("is-hidden", !this.statusEl.children.length);
  }

  atualizarTituloJanela() {
    const v = this.workspace.activeLeaf?.view;
    const nome = this.backend.info?.vaultName || "Tinteiro";
    document.title = v?.file ? `${v.dirty ? "● " : ""}${v.getDisplayText()} - ${nome} - Tinteiro` : `${nome} - Tinteiro`;
  }

  statusAtualizacao(s) {
    if (s.estado === "baixada") {
      this.statusUpdate = h("div.status-bar-item.mod-clickable", { title: "Reiniciar para atualizar", onclick: () => this.desktop.installUpdate() }, icon("download"), h("span", { text: "Atualização pronta — clique para reiniciar" }));
      notice(`Nova versão ${s.versao || ""} baixada. Clique em “Atualização pronta” na barra de baixo para reiniciar.`, { tempo: 10000 });
    } else if (s.estado === "baixando") {
      this.statusUpdate = h("div.status-bar-item", icon("download"), h("span", { text: `Baixando atualização ${Math.round(s.percentual || 0)}%` }));
    } else if (s.estado === "nenhuma" && s.manual) { notice("Você já está na versão mais nova."); this.statusUpdate = null; }
    else if (s.estado === "erro" && s.manual) { notice("Não foi possível procurar atualização agora (sem internet?)."); this.statusUpdate = null; }
    this.atualizarStatus();
  }

  menuCofre(e) {
    const m = new Menu();
    m.addLabel(this.backend.info?.root || "");
    if (this.backend.caps.reveal) m.addItem({ title: "Abrir pasta no Explorador", icon: "folder-open", onClick: () => this.backend.reveal("") });
    if (this.backend.caps.settings) m.addItem({ title: "Trocar pasta raiz…", icon: "folder-input", onClick: () => this.abrirConfiguracoes("geral") });
    m.addItem({ title: "Configurações", icon: "settings", onClick: () => this.abrirConfiguracoes() });
    m.showBelow(e.currentTarget);
  }

  ajuda() {
    const md = new Modal({ titulo: "Atalhos do Tinteiro" });
    const lista = this.comandos.filter(c => c.tecla);
    md.contentEl.appendChild(h("div", lista.map(c => h("div", { style: { display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--background-modifier-border)" } }, h("span", { text: c.nome }), h("kbd", { text: c.tecla })))));
    md.contentEl.appendChild(h("p", { style: { marginTop: "12px" }, text: `Tinteiro ${VERSAO}. Arquivos que começam com “@” abrem normalmente.` }));
    md.open();
  }

  async abrirConfiguracoes(aba) {
    const { abrirConfiguracoes } = await import("./ui/settings.js");
    abrirConfiguracoes(this, aba);
  }
}
