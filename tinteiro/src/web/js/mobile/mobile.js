// Interface do celular: gavetas laterais por gesto, barra de baixo, troca de abas, barra de formatação.
import { h, vazio, debounce, formatData } from "../util/dom.js";
import { icon, iconButton } from "../util/icons.js";
import { Menu } from "../ui/menu.js";
import { Leaf } from "../workspace/workspace.js";
import { notice } from "../ui/notice.js";

export class MobileUI {
  constructor(app) { this.app = app; this.gaveta = null; }

  montar() {
    const app = this.app;
    this.fundo = h("div.workspace-drawer-backdrop", { onclick: () => this.fecharGavetas() });
    this.esq = this.criarGaveta("left", app.esquerda.grupo, true);
    this.dir = this.criarGaveta("right", app.direita.grupo, false);
    document.body.append(this.fundo, this.esq.el, this.dir.el);
    // barra de baixo
    this.btVoltar = this.acao("arrow-left", "Voltar", () => app.workspace.activeLeaf?.navegar(-1));
    this.btAvancar = this.acao("arrow-right", "Avançar", () => app.workspace.activeLeaf?.navegar(1));
    this.btNovo = this.acao("plus", "Novo", e => this.menuNovo(e));
    this.contAbas = h("div.mobile-tab-count", { text: "1" });
    this.btAbas = h("div.mobile-navbar-action", { "aria-label": "Abas", onclick: () => this.trocaDeAbas() }, this.contAbas);
    this.btMenu = this.acao("menu", "Menu", e => this.menuPrincipal(e));
    this.navbar = h("div.mobile-navbar", this.btVoltar, this.btAvancar, this.btNovo, this.btAbas, this.btMenu);
    this.toolbar = h("div.mobile-toolbar");
    app.app.append(this.toolbar, this.navbar);
    app.on("layout-changed", () => this.atualizar());
    app.on("active-leaf-change", () => this.atualizar());
    app.on("leaf-header", () => this.atualizar());
    this.atualizar();
    this.configurarGestos();
    this.configurarTeclado();
    this.configurarNativo();
    // estado da sincronização no topo da gaveta
    const sync = app.backend.sync;
    if (sync) { sync.on("estado", () => this.mostrarSync()); this.mostrarSync(); sync.on("conflito", c => notice(`“${c.path}” mudou no celular e no computador. A versão do celular foi guardada como cópia.`, { tempo: 9000 })); }
    app.backend.on?.("synced", () => {});
  }

  acao(ic, titulo, fn) { return h("div.mobile-navbar-action", { "aria-label": titulo, title: titulo, onclick: fn }, icon(ic)); }

  criarGaveta(lado, grupo, comCabecalho) {
    const el = h(`div.workspace-drawer.mod-${lado}`);
    const opcoes = h("div.workspace-drawer-tab-options");
    for (const leaf of grupo.leaves) {
      const b = h("div.workspace-drawer-tab-option-item", { "aria-label": leaf.view.getDisplayText(), onclick: () => { grupo.setActive(leaf); this.marcarAbas(opcoes, grupo); setTimeout(() => leaf.view.focus?.(), 50); } }, icon(leaf.view.getIcon()));
      b.dataset.leaf = leaf.id;
      opcoes.appendChild(b);
    }
    this.marcarAbas(opcoes, grupo);
    const conteudo = h("div.workspace-drawer-active-tab-container", grupo.containerEl);
    if (comCabecalho) {
      this.nomeCofre = h("div.workspace-drawer-header-name", { onclick: () => this.app.abrirConfiguracoes("sincronizacao") }, h("span", { text: this.app.backend.info?.vaultName || "Tinteiro" }));
      this.syncEl = h("div.drawer-sync-status", { onclick: () => this.app.backend.sync?.sincronizar() });
      el.append(h("div.workspace-drawer-header", this.nomeCofre, iconButton("settings", "Configurações", () => { this.fecharGavetas(); this.app.abrirConfiguracoes(); })), this.syncEl);
    } else el.appendChild(h("div.workspace-drawer-header", h("div.workspace-drawer-header-name", { text: "Painéis" })));
    el.append(opcoes, conteudo);
    grupo.headerEl.remove();
    return { el, opcoes, grupo };
  }
  marcarAbas(opcoes, grupo) { for (const b of opcoes.children) b.classList.toggle("is-active", b.dataset.leaf === grupo.active?.id); }

  abrirGaveta(lado, leaf) {
    const g = lado === "left" ? this.esq : this.dir;
    if (leaf) { g.grupo.setActive(leaf); this.marcarAbas(g.opcoes, g.grupo); }
    this.fecharGavetas(true);
    g.el.classList.add("is-open");
    this.fundo.classList.add("is-visible");
    this.gaveta = g;
    document.activeElement?.blur?.();
  }
  fecharGavetas(semAnimar) {
    for (const g of [this.esq, this.dir]) g?.el.classList.remove("is-open");
    this.fundo?.classList.remove("is-visible");
    this.gaveta = null;
  }

  mostrarSync() {
    const s = this.app.backend.sync;
    if (!s || !this.syncEl) return;
    vazio(this.syncEl);
    const cls = { ocioso: "", sincronizando: "is-working", erro: "is-error", "sem-conexao": "is-off", desligado: "is-off" }[s.estado] || "";
    const txt = s.estado === "desligado" ? "Não pareado com o computador — toque para configurar"
      : s.estado === "sincronizando" ? s.mensagem || "Sincronizando…"
      : s.estado === "ocioso" ? (s.ultima ? `Sincronizado ${formatData(s.ultima).slice(0, 16)}` : "Pronto")
      : s.mensagem;
    this.syncEl.append(h("span.sync-dot." + (cls || "ok")), h("span", { text: txt }));
    if (s.estado === "desligado") this.syncEl.onclick = () => { this.fecharGavetas(); this.app.abrirConfiguracoes("sincronizacao"); };
    else this.syncEl.onclick = () => s.sincronizar();
    if (this.nomeCofre) this.nomeCofre.firstChild.textContent = this.app.backend.info?.vaultName || "Tinteiro";
  }

  atualizar() {
    const leaf = this.app.workspace.activeLeaf;
    this.btVoltar.classList.toggle("is-disabled", !leaf?.voltar.length);
    this.btAvancar.classList.toggle("is-disabled", !leaf?.avancar.length);
    this.contAbas.textContent = String(this.app.workspace.leaves().length);
    this.atualizarToolbar();
  }

  menuNovo(e) {
    const m = new Menu();
    const app = this.app;
    m.addItem({ title: "Nova nota", icon: "new-note", onClick: () => app.novaNota() });
    m.addItem({ title: "Novo documento Word", icon: "file-type", onClick: () => app.novoDocumento(app.pastaAtual(), "docx") });
    m.addItem({ title: "Nova planilha", icon: "file-spreadsheet", onClick: () => app.novoDocumento(app.pastaAtual(), "xlsx") });
    m.addItem({ title: "Nova pasta", icon: "folder-plus", onClick: () => app.novaPasta(app.pastaAtual()) });
    m.addSeparator();
    m.addItem({ title: "Nova aba", icon: "plus", onClick: () => app.workspace.activeLeaf?.group.novaAba() });
    m.addItem({ title: "Importar arquivo do celular", icon: "upload", onClick: () => app.importarArquivos() });
    m.showAtMouseEvent(e);
  }

  menuPrincipal(e) {
    const m = new Menu();
    const app = this.app;
    m.addItem({ title: "Buscar em todos os arquivos", icon: "search", onClick: () => app.buscaGlobal() });
    m.addItem({ title: "Ir para arquivo", icon: "file-search", onClick: () => app.trocaRapida() });
    m.addItem({ title: "Paleta de comandos", icon: "terminal", onClick: () => app.paletaComandos() });
    m.addItem({ title: "Estrutura do documento", icon: "outline", onClick: () => this.abrirGaveta("right", app.leafEstrutura) });
    m.addItem({ title: "Histórico de versões", icon: "history", onClick: () => this.abrirGaveta("right", app.leafHistorico) });
    m.addSeparator();
    if (app.backend.sync) m.addItem({ title: "Sincronizar agora", icon: "refresh", onClick: () => app.backend.sync.sincronizar().then(ok => notice(ok ? "Sincronizado." : app.backend.sync.mensagem || "Não foi possível sincronizar.")) });
    m.addItem({ title: app.temaEfetivo() === "escuro" ? "Tema claro" : "Tema escuro", icon: app.temaEfetivo() === "escuro" ? "sun" : "moon", onClick: () => app.alternarTema() });
    m.addItem({ title: "Configurações", icon: "settings", onClick: () => app.abrirConfiguracoes() });
    m.showAtMouseEvent(e);
  }

  trocaDeAbas() {
    const app = this.app;
    const el = h("div.tab-switcher");
    const grade = h("div.tab-switcher-grid");
    const fechar = () => el.remove();
    const desenhar = () => {
      vazio(grade);
      for (const l of app.workspace.leaves()) {
        const card = h("div.tab-switcher-card" + (l === app.workspace.activeLeaf ? ".is-active" : ""),
          h("div.tab-switcher-card-title", { text: l.view?.getDisplayText() || l.tabTitleEl.textContent || "Nova aba" }),
          h("div.tab-switcher-card-body", icon(l.view?.getIcon() || "file")),
          iconButton("x", "Fechar aba", async () => { await l.fechar(); desenhar(); this.atualizar(); }, "clickable-icon tab-switcher-card-close"));
        card.addEventListener("click", e => { if (e.target.closest(".tab-switcher-card-close")) return; l.group.setActive(l); app.workspace.setActiveLeaf(l); fechar(); });
        grade.appendChild(card);
      }
    };
    desenhar();
    el.append(h("div.tab-switcher-header", h("span", { text: "Abas" })), grade,
      h("div.tab-switcher-footer", h("button", { text: "Nova aba", onclick: async () => { await app.workspace.activeLeaf?.group.novaAba(); fechar(); } }), h("button.mod-cta", { text: "Concluído", onclick: fechar })));
    document.body.appendChild(el);
  }

  // ---------- gestos: arrastar da borda abre a gaveta ----------
  configurarGestos() {
    let ini = null;
    const BORDA = 28;
    document.addEventListener("touchstart", e => {
      if (e.touches.length !== 1 || document.querySelector(".modal-container, .tab-switcher, .menu")) { ini = null; return; }
      const t = e.touches[0];
      const W = window.innerWidth;
      const naGaveta = this.gaveta && this.gaveta.el.contains(e.target);
      if (this.gaveta) ini = { x: t.clientX, y: t.clientY, tipo: "fechar", g: this.gaveta, naGaveta };
      else if (t.clientX < BORDA) ini = { x: t.clientX, y: t.clientY, tipo: "abrir", lado: "left" };
      else if (t.clientX > W - BORDA) ini = { x: t.clientX, y: t.clientY, tipo: "abrir", lado: "right" };
      else ini = null;
      if (ini) ini.t = Date.now();
    }, { passive: true });
    document.addEventListener("touchmove", e => {
      if (!ini) return;
      const t = e.touches[0];
      const dx = t.clientX - ini.x, dy = t.clientY - ini.y;
      if (!ini.decidido) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        if (Math.abs(dy) > Math.abs(dx)) { ini = null; return; }
        ini.decidido = true;
        if (ini.tipo === "abrir") { ini.g = ini.lado === "left" ? this.esq : this.dir; ini.g.el.classList.add("is-dragging"); this.fundo.classList.add("is-visible"); this.fundo.style.opacity = "0"; }
        else ini.g.el.classList.add("is-dragging");
      }
      const g = ini.g, largura = g.el.offsetWidth, esq = g === this.esq;
      let desloc;
      if (ini.tipo === "abrir") desloc = esq ? Math.min(0, -largura + dx) : Math.max(0, largura + dx);
      else desloc = esq ? Math.min(0, dx) : Math.max(0, dx);
      g.el.style.transform = `translateX(${desloc}px)`;
      this.fundo.style.opacity = String(1 - Math.abs(desloc) / largura);
    }, { passive: true });
    document.addEventListener("touchend", e => {
      if (!ini || !ini.decidido) { ini = null; return; }
      const g = ini.g, largura = g.el.offsetWidth, esq = g === this.esq;
      const t = e.changedTouches[0];
      const dx = t.clientX - ini.x;
      const rapido = Math.abs(dx) / (Date.now() - ini.t) > 0.4;
      g.el.classList.remove("is-dragging");
      g.el.style.transform = "";
      this.fundo.style.opacity = "";
      if (ini.tipo === "abrir") { if (Math.abs(dx) > largura / 3 || rapido) this.abrirGaveta(esq ? "left" : "right"); else this.fecharGavetas(); }
      else { if ((esq ? -dx : dx) > largura / 3 || rapido) this.fecharGavetas(); else { g.el.classList.add("is-open"); this.fundo.classList.add("is-visible"); } }
      ini = null;
    });
  }

  // ---------- teclado na tela: mostra a barra de formatação ----------
  configurarTeclado() {
    const vv = window.visualViewport;
    const ver = () => {
      const aberto = vv ? window.innerHeight - vv.height > 140 : false;
      const editando = document.activeElement && (document.activeElement.isContentEditable || document.activeElement.matches?.("input, textarea, .cm-content"));
      document.body.classList.toggle("keyboard-open", !!(aberto || (this.tecladoNativo && editando)));
      this.atualizarToolbar();
    };
    vv?.addEventListener("resize", debounce(ver, 50));
    document.addEventListener("focusin", () => setTimeout(ver, 300));
    document.addEventListener("focusout", () => setTimeout(ver, 300));
  }
  atualizarToolbar() {
    const v = this.app.workspace.activeLeaf?.view;
    const acoes = v?.getMobileToolbar?.() || [];
    vazio(this.toolbar);
    for (const a of acoes) {
      const b = h("div.mobile-toolbar-option", { "aria-label": a.title, title: a.title }, icon(a.icon));
      b.addEventListener("mousedown", e => e.preventDefault());
      b.addEventListener("touchstart", e => e.preventDefault(), { passive: false });
      b.addEventListener("touchend", e => { e.preventDefault(); a.fn(); });
      b.addEventListener("click", () => a.fn());
      this.toolbar.appendChild(b);
    }
    this.toolbar.classList.toggle("has-actions", acoes.length > 0);
  }

  // ---------- atualização do app Android (nova versão publicada no GitHub) ----------
  async procurarAtualizacao() {
    try {
      const ultima = Number(localStorage.getItem("tinteiro.apk.verificado") || 0);
      if (Date.now() - ultima < 6 * 3600 * 1000) return;
      const r = await fetch("https://api.github.com/repos/seinfrailheusprocessos-ship-it/Omega/releases/latest", { headers: { Accept: "application/vnd.github+json" } });
      if (!r.ok) return;
      localStorage.setItem("tinteiro.apk.verificado", String(Date.now()));
      const j = await r.json();
      const nova = String(j.tag_name || "").replace(/^v/, "");
      const atual = typeof __VERSAO__ !== "undefined" ? __VERSAO__ : "0";
      const n = v => v.split(".").map(x => parseInt(x) || 0);
      const [a, b] = [n(nova), n(atual)];
      const maior = a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2])));
      if (!maior) return;
      const apk = (j.assets || []).find(x => /\.apk$/i.test(x.name));
      const url = apk?.browser_download_url || "https://github.com/seinfrailheusprocessos-ship-it/Omega/releases/latest/download/Tinteiro.apk";
      const faixa = h("div.update-banner", h("span", { text: `Nova versão do Tinteiro (${nova}).` }),
        h("button.mod-cta", { text: "Atualizar", onclick: () => { faixa.remove(); location.href = url; } }),
        iconButton("x", "Agora não", () => faixa.remove()));
      document.body.appendChild(faixa);
    } catch (e) {}
  }

  // ---------- Android: botão voltar, links de pareamento, teclado ----------
  async configurarNativo() {
    if (!window.Capacitor?.isNativePlatform?.()) return;
    try {
      const { App } = await import("@capacitor/app");
      App.addListener("backButton", () => {
        const modal = document.querySelector(".modal-container, .tab-switcher, .menu");
        if (modal) { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); modal.classList.contains("tab-switcher") && modal.remove(); return; }
        if (this.gaveta) { this.fecharGavetas(); return; }
        const leaf = this.app.workspace.activeLeaf;
        if (leaf?.voltar.length) { leaf.navegar(-1); return; }
        App.minimizeApp();
      });
      const tratarLink = async url => {
        if (!url || !url.startsWith("tinteiro://")) return;
        try { await this.app.backend.sync.parear(url); notice("Celular pareado com o computador. Sincronizando…"); this.app.backend.sync.sincronizar(); }
        catch (e) { notice("Não foi possível parear: " + e.message, { erro: true }); }
      };
      App.addListener("appUrlOpen", d => tratarLink(d.url));
      const lanc = await App.getLaunchUrl();
      if (lanc?.url) tratarLink(lanc.url);
      App.addListener("resume", () => this.app.backend.sync?.sincronizar());
    } catch (e) {}
    setTimeout(() => this.procurarAtualizacao(), 6000);
    try {
      const { Keyboard } = await import("@capacitor/keyboard");
      Keyboard.addListener("keyboardWillShow", () => { this.tecladoNativo = true; document.body.classList.add("keyboard-open"); this.atualizarToolbar(); });
      Keyboard.addListener("keyboardWillHide", () => { this.tecladoNativo = false; document.body.classList.remove("keyboard-open"); });
    } catch (e) {}
    try {
      const { StatusBar, Style } = await import("@capacitor/status-bar");
      const aplicar = () => { const esc = this.app.temaEfetivo() === "escuro"; StatusBar.setStyle({ style: esc ? Style.Dark : Style.Light }); StatusBar.setBackgroundColor({ color: esc ? "#1e1e1e" : "#ffffff" }).catch(() => {}); };
      aplicar(); this.app.on("theme-changed", aplicar);
    } catch (e) {}
  }
}
