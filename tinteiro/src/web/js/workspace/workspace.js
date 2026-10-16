// Área de trabalho: faixa de ícones, barras laterais, divisões, grupos de abas e folhas.
import { h, vazio } from "../util/dom.js";
import { icon, iconButton } from "../util/icons.js";
import { basename, dirname, extname } from "../util/path.js";
import { Menu } from "../ui/menu.js";
import { View } from "../views/base.js";
import { viewParaExtensao } from "../views/registry.js";
import { erro } from "../ui/notice.js";

let seqLeaf = 0;

/* ------------------------------------------------------------------ */
export class Leaf {
  constructor(app, sidebar = false) {
    this.app = app;
    this.id = "leaf-" + (++seqLeaf);
    this.sidebar = sidebar;
    this.group = null;
    this.view = null;
    this.voltar = [];
    this.avancar = [];
    this.el = h("div.workspace-leaf");
    this.contentEl = h("div.workspace-leaf-content");
    this.viewContentEl = h("div.view-content");
    if (!sidebar) {
      this.navVoltar = iconButton("arrow-left", "Voltar", () => this.navegar(-1), "clickable-icon view-header-nav-button");
      this.navAvancar = iconButton("arrow-right", "Avançar", () => this.navegar(1), "clickable-icon view-header-nav-button");
      this.menuLateral = iconButton("sidebar-left", "Abrir arquivos", () => this.app.mobile?.abrirGaveta("left"), "clickable-icon view-header-mobile-left");
      this.tituloPaiEl = h("div.view-header-title-parent");
      this.tituloEl = h("div.view-header-title");
      this.acoesEl = h("div.view-actions", iconButton("more-vertical", "Mais opções", e => this.menuMais(e), "clickable-icon view-action mod-more"));
      this.headerEl = h("div.view-header",
        h("div.view-header-left", this.app.isMobile ? this.menuLateral : null, h("div.view-header-nav-buttons", this.app.isMobile ? null : [this.navVoltar, this.navAvancar])),
        h("div.view-header-title-container", this.tituloPaiEl, this.tituloEl),
        this.acoesEl);
      this.tituloEl.addEventListener("dblclick", () => this.renomearPeloTitulo());
      this.contentEl.appendChild(this.headerEl);
    } else this.acoesEl = h("div.view-actions");
    this.contentEl.appendChild(this.viewContentEl);
    this.el.appendChild(this.contentEl);
    this.el.addEventListener("mousedown", () => { if (!this.sidebar) this.app.workspace.setActiveLeaf(this); }, true);
    this.el.addEventListener("focusin", () => { if (!this.sidebar) this.app.workspace.setActiveLeaf(this, false); });

    // cabeçalho da aba
    this.tabIconEl = h("div.workspace-tab-header-inner-icon");
    this.tabTitleEl = h("div.workspace-tab-header-inner-title");
    this.tabCloseEl = iconButton("x", "Fechar", () => this.fechar(), "workspace-tab-header-inner-close-button");
    this.tabHeaderEl = h("div.workspace-tab-header", { draggable: sidebar ? null : "true", "data-leaf": this.id },
      h("div.workspace-tab-header-inner", this.tabIconEl, this.tabTitleEl, sidebar ? null : h("div.workspace-tab-header-status-container"), sidebar ? null : this.tabCloseEl));
    this.tabHeaderEl.addEventListener("mousedown", e => {
      if (e.button === 1) { e.preventDefault(); this.fechar(); return; }
      if (e.button === 0) this.group.setActive(this);
    });
    this.tabHeaderEl.addEventListener("contextmenu", e => this.menuAba(e));
  }

  getViewState() { return { type: this.view ? this.view.getViewType() : "empty", state: this.view ? this.view.getState() : {} }; }

  /** troca o conteúdo da folha */
  async setViewState(vs, { historico = true } = {}) {
    if (this.view) {
      if (!(await this.view.canClose())) return false;
      if (historico && !this.sidebar && this.view.getViewType() !== "empty") { this.voltar.push(this.getViewState()); this.avancar = []; }
      const v = this.view; this.view = null;
      v.destruido = true;
      try { await v.onClose(); } catch (e) { console.error(e); }
    }
    vazio(this.viewContentEl);
    this.viewContentEl.className = "view-content";
    this.contentEl.removeAttribute("data-type");
    // remove ações da visualização anterior (mantém só "mais opções")
    if (this.acoesEl) while (this.acoesEl.children.length > 1) this.acoesEl.firstChild.remove();
    let view;
    try { view = await this.app.criarView(this, vs); }
    catch (e) { erro("Erro ao abrir.", e); view = new EmptyView(this); }
    this.view = view;
    this.contentEl.dataset.type = view.getViewType();
    this.atualizarCabecalho();
    try { await view.onOpen(); if (vs.state) await view.setState(vs.state); }
    catch (e) { erro("Erro ao abrir.", e); }
    this.atualizarCabecalho();
    this.app.emit("layout-changed");
    if (this.app.workspace.activeLeaf === this) this.app.emit("active-leaf-change", this);
    return true;
  }

  async openFile(entry, opts = {}) {
    return this.setViewState({ type: "file", state: { file: entry.path, ...(opts.state || {}) } }, opts);
  }

  async navegar(d) {
    const de = d < 0 ? this.voltar : this.avancar, para = d < 0 ? this.avancar : this.voltar;
    while (de.length) {
      const vs = de.pop();
      if (vs.state?.file && !this.app.vault.exists(vs.state.file)) continue;
      const atual = this.getViewState();
      const ok = await this.setViewState(vs, { historico: false });
      if (ok) para.push(atual);
      break;
    }
    this.atualizarCabecalho();
  }

  atualizarCabecalho() {
    const v = this.view;
    const titulo = v ? v.getDisplayText() : "Nova aba";
    vazio(this.tabIconEl).appendChild(icon(v ? v.getIcon() : "file"));
    this.tabTitleEl.textContent = titulo;
    this.tabHeaderEl.title = v?.file ? v.file.path : titulo;
    this.tabHeaderEl.setAttribute("aria-label", titulo);
    this.tabHeaderEl.classList.toggle("is-dirty", !!v?.dirty);
    const st = this.tabHeaderEl.querySelector(".workspace-tab-header-status-container");
    if (st) { vazio(st); if (v?.dirty) st.appendChild(h("span.workspace-tab-header-status-icon", { text: "●", title: "Alterações não salvas" })); }
    if (this.headerEl) {
      vazio(this.tituloPaiEl);
      if (v?.file) {
        const partes = dirname(v.file.path).split("/").filter(Boolean);
        let acum = "";
        for (const p of partes) {
          acum = acum ? acum + "/" + p : p;
          const alvo = acum;
          this.tituloPaiEl.append(h("span.view-header-breadcrumb", { text: p, onclick: () => this.app.revelarNoExplorador(alvo) }), h("span.view-header-breadcrumb-separator", { text: "/" }));
        }
      }
      this.tituloEl.textContent = titulo;
      this.tituloEl.classList.toggle("is-unsaved", !!v?.dirty);
      this.navVoltar?.classList.toggle("is-disabled", !this.voltar.length);
      this.navAvancar?.classList.toggle("is-disabled", !this.avancar.length);
    }
    if (this.group) this.group.atualizarLista();
    this.app.emit("leaf-header", this);
  }

  async renomearPeloTitulo() {
    if (this.view?.file) this.app.renomear(this.view.file.path);
  }

  menuMais(e) {
    const m = new Menu();
    const v = this.view;
    if (v?.file) {
      v.onPaneMenu(m);
      m.addSeparator();
      this.app.itensMenuArquivo(m, this.app.vault.get(v.file.path) || v.file, "pane");
    }
    m.addSeparator();
    m.addItem({ title: "Dividir à direita", icon: "split-right", onClick: () => this.app.workspace.dividir(this, "vertical") });
    m.addItem({ title: "Dividir para baixo", icon: "split-down", onClick: () => this.app.workspace.dividir(this, "horizontal") });
    m.addSeparator();
    m.addItem({ title: "Fechar", icon: "x", onClick: () => this.fechar() });
    m.showAtMouseEvent(e);
  }

  menuAba(e) {
    e.preventDefault();
    const m = new Menu();
    m.addItem({ title: "Fechar", icon: "x", onClick: () => this.fechar() });
    m.addItem({ title: "Fechar as outras abas", onClick: () => this.group.fecharOutras(this) });
    m.addItem({ title: "Fechar abas à direita", onClick: () => this.group.fecharDireita(this) });
    m.addSeparator();
    m.addItem({ title: "Dividir à direita", icon: "split-right", onClick: () => this.app.workspace.dividir(this, "vertical") });
    m.addItem({ title: "Dividir para baixo", icon: "split-down", onClick: () => this.app.workspace.dividir(this, "horizontal") });
    if (this.view?.file) { m.addSeparator(); this.app.itensMenuArquivo(m, this.app.vault.get(this.view.file.path) || this.view.file, "tab"); }
    m.showAtMouseEvent(e);
  }

  async fechar() {
    if (this.view && !(await this.view.canClose())) return false;
    if (this.view) { this.view.destruido = true; try { await this.view.onClose(); } catch (e) {} this.view = null; }
    this.group?.removerLeaf(this);
    this.app.emit("layout-changed");
    return true;
  }
}

/* ------------------------------------------------------------------ */
export class EmptyView extends View {
  getViewType() { return "empty"; }
  getDisplayText() { return "Nova aba"; }
  getIcon() { return "file"; }
  async onOpen() {
    const a = (texto, tecla, fn) => h("div.empty-state-action", { onclick: fn }, texto, tecla ? h("span.hotkey", { text: `(${tecla})` }) : null);
    const mob = this.app.isMobile;
    this.contentEl.appendChild(h("div.empty-state", h("div.empty-state-container",
      h("div.empty-state-title", { text: "Nenhum arquivo aberto" }),
      h("div.empty-state-action-list",
        a("Criar nova nota", mob ? null : "Ctrl+N", () => this.app.novaNota()),
        a("Ir para arquivo", mob ? null : "Ctrl+O", () => this.app.trocaRapida()),
        a("Ver arquivos recentes", null, () => this.app.trocaRapida({ recentes: true })),
        mob ? a("Abrir arquivos", null, () => this.app.mobile.abrirGaveta("left")) : null,
        this.leaf.group && (this.leaf.group.leaves.length > 1 || this.app.workspace.grupos().length > 1) ? a("Fechar", null, () => this.leaf.fechar()) : null))));
  }
}

/* ------------------------------------------------------------------ */
export class TabGroup {
  constructor(ws, { sidebar = false } = {}) {
    this.ws = ws;
    this.app = ws.app;
    this.sidebar = sidebar;
    this.leaves = [];
    this.active = null;
    this.parent = null;
    this.headerInner = h("div.workspace-tab-header-container-inner");
    this.headerEl = h("div.workspace-tab-header-container", this.headerInner);
    this.containerEl = h("div.workspace-tab-container");
    this.el = h("div.workspace-tabs.mod-top", this.headerEl, this.containerEl);
    if (!sidebar) {
      this.headerEl.append(
        h("div.workspace-tab-header-new-tab", iconButton("plus", "Nova aba (Ctrl+T)", () => this.novaAba())),
        h("div.workspace-tab-header-spacer"),
        h("div.workspace-tab-header-tab-list", iconButton("chevron-down", "Lista de abas", e => this.menuLista(e))),
        h("div.titlebar-controls-spacer"));
      this.headerEl.querySelector(".workspace-tab-header-spacer").addEventListener("dblclick", () => this.app.desktop?.maximizar());
      this.configurarArrastar();
    }
  }

  addLeaf(leaf, indice = this.leaves.length) {
    if (leaf.group && leaf.group !== this) leaf.group.removerLeaf(leaf, { manter: true });
    leaf.group = this;
    const atual = this.leaves.indexOf(leaf);
    if (atual >= 0) this.leaves.splice(atual, 1);
    indice = Math.min(indice, this.leaves.length);
    this.leaves.splice(indice, 0, leaf);
    const ref = this.headerInner.children[indice];
    this.headerInner.insertBefore(leaf.tabHeaderEl, ref || null);
    this.containerEl.appendChild(leaf.el);
    this.setActive(leaf, false);
    return leaf;
  }

  setActive(leaf, focar = true) {
    this.active = leaf;
    for (const l of this.leaves) {
      const ativo = l === leaf;
      l.tabHeaderEl.classList.toggle("is-active", ativo);
      l.el.classList.toggle("is-hidden-tab", !ativo);
    }
    if (!this.sidebar) this.ws.setActiveLeaf(leaf, focar);
    else this.ws.app.emit("sidebar-tab", this, leaf);
    leaf.view?.onResize();
  }

  removerLeaf(leaf, { manter = false } = {}) {
    const i = this.leaves.indexOf(leaf);
    if (i < 0) return;
    this.leaves.splice(i, 1);
    leaf.tabHeaderEl.remove();
    leaf.el.remove();
    leaf.group = null;
    if (this.active === leaf) {
      const prox = this.leaves[Math.min(i, this.leaves.length - 1)];
      if (prox) this.setActive(prox);
      else this.active = null;
    }
    if (!this.leaves.length && !this.sidebar && !manter) this.ws.grupoVazio(this);
    if (!this.leaves.length && !this.sidebar && manter) this.ws.grupoVazio(this, true);
  }

  async novaAba() {
    const leaf = new Leaf(this.app);
    this.addLeaf(leaf, this.active ? this.leaves.indexOf(this.active) + 1 : this.leaves.length);
    await leaf.setViewState({ type: "empty" });
    return leaf;
  }

  async fecharOutras(leaf) { for (const l of [...this.leaves]) if (l !== leaf) await l.fechar(); }
  async fecharDireita(leaf) { const i = this.leaves.indexOf(leaf); for (const l of this.leaves.slice(i + 1)) await l.fechar(); }

  atualizarLista() {}

  menuLista(e) {
    const m = new Menu();
    for (const l of this.leaves) m.addItem({ title: l.view?.getDisplayText() || "Nova aba", icon: l.view?.getIcon() || "file", checked: l === this.active, onClick: () => this.setActive(l) });
    m.addSeparator();
    m.addItem({ title: "Fechar todas", icon: "x", onClick: async () => { for (const l of [...this.leaves]) await l.fechar(); } });
    m.showBelow(e.currentTarget);
  }

  configurarArrastar() {
    const limpa = () => this.headerInner.querySelectorAll(".drop-before,.drop-after").forEach(x => x.classList.remove("drop-before", "drop-after"));
    this.headerInner.addEventListener("dragstart", e => {
      const t = e.target.closest(".workspace-tab-header"); if (!t) return;
      this.ws.arrastando = this.leaves.find(l => l.tabHeaderEl === t);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", this.ws.arrastando?.view?.file?.path || "");
      setTimeout(() => t.classList.add("is-dragging"), 0);
    });
    this.headerInner.addEventListener("dragend", e => { e.target.closest?.(".workspace-tab-header")?.classList.remove("is-dragging"); this.ws.arrastando = null; limpa(); this.ws.esconderSobreposicao(); });
    this.headerEl.addEventListener("dragover", e => {
      if (!this.ws.arrastando && !e.dataTransfer.types.includes("tinteiro/path")) return;
      e.preventDefault();
      limpa();
      const t = e.target.closest(".workspace-tab-header");
      if (t) { const r = t.getBoundingClientRect(); t.classList.add(e.clientX < r.left + r.width / 2 ? "drop-before" : "drop-after"); }
    });
    this.headerEl.addEventListener("dragleave", limpa);
    this.headerEl.addEventListener("drop", async e => {
      e.preventDefault();
      const t = e.target.closest(".workspace-tab-header");
      let indice = this.leaves.length;
      if (t) { const r = t.getBoundingClientRect(); const i = [...this.headerInner.children].indexOf(t); indice = e.clientX < r.left + r.width / 2 ? i : i + 1; }
      limpa();
      const leaf = this.ws.arrastando;
      if (leaf) {
        if (leaf.group === this && this.leaves.indexOf(leaf) < indice) indice--;
        this.addLeaf(leaf, indice);
        this.setActive(leaf);
        this.app.emit("layout-changed");
      } else {
        const p = e.dataTransfer.getData("tinteiro/path");
        if (p) { const nl = new Leaf(this.app); this.addLeaf(nl, indice); await this.app.abrirNaFolha(nl, p); }
      }
    });
    // soltar sobre o conteúdo: dividir ou mover para este grupo
    this.containerEl.addEventListener("dragover", e => {
      if (!this.ws.arrastando && !e.dataTransfer.types.includes("tinteiro/path")) return;
      e.preventDefault();
      this.ws.mostrarSobreposicao(this, this.zona(e));
    });
    this.containerEl.addEventListener("dragleave", e => { if (!this.containerEl.contains(e.relatedTarget)) this.ws.esconderSobreposicao(); });
    this.containerEl.addEventListener("drop", async e => {
      e.preventDefault();
      const zona = this.zona(e);
      this.ws.esconderSobreposicao();
      let leaf = this.ws.arrastando;
      const p = !leaf && e.dataTransfer.getData("tinteiro/path");
      if (!leaf && !p) return;
      if (zona === "centro") {
        if (leaf) { this.addLeaf(leaf); this.setActive(leaf); }
        else { const nl = new Leaf(this.app); this.addLeaf(nl); await this.app.abrirNaFolha(nl, p); }
      } else {
        const novo = this.ws.dividirGrupo(this, zona === "esquerda" || zona === "direita" ? "vertical" : "horizontal", zona === "esquerda" || zona === "cima");
        if (leaf) { novo.addLeaf(leaf); novo.setActive(leaf); }
        else { const nl = new Leaf(this.app); novo.addLeaf(nl); await this.app.abrirNaFolha(nl, p); }
      }
      this.app.emit("layout-changed");
    });
  }

  zona(e) {
    const r = this.containerEl.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    if (x < 0.25) return "esquerda";
    if (x > 0.75) return "direita";
    if (y < 0.25) return "cima";
    if (y > 0.75) return "baixo";
    return "centro";
  }
}

/* ------------------------------------------------------------------ */
export class Split {
  constructor(ws, dir) {
    this.ws = ws;
    this.dir = dir; // "vertical" = lado a lado; "horizontal" = um embaixo do outro
    this.children = [];
    this.parent = null;
    this.el = h("div.workspace-split.mod-" + dir);
  }
  render() {
    vazio(this.el);
    this.children.forEach((c, i) => {
      if (i > 0) {
        const alca = h("div.workspace-leaf-resize-handle.mod-inner");
        this.configurarAlca(alca, i);
        this.el.appendChild(alca);
      }
      c.el.style.flex = `${c.tamanho || 1} 1 0`;
      this.el.appendChild(c.el);
    });
  }
  configurarAlca(alca, i) {
    alca.addEventListener("mousedown", e => {
      e.preventDefault();
      const a = this.children[i - 1], b = this.children[i];
      const ra = a.el.getBoundingClientRect(), rb = b.el.getBoundingClientRect();
      const horiz = this.dir === "vertical";
      const total = horiz ? ra.width + rb.width : ra.height + rb.height;
      const soma = (a.tamanho || 1) + (b.tamanho || 1);
      const ini = horiz ? e.clientX : e.clientY;
      const tamA = horiz ? ra.width : ra.height;
      alca.classList.add("is-dragging");
      const mover = ev => {
        const d = (horiz ? ev.clientX : ev.clientY) - ini;
        const novoA = Math.max(120, Math.min(total - 120, tamA + d));
        a.tamanho = soma * novoA / total; b.tamanho = soma - a.tamanho;
        a.el.style.flex = `${a.tamanho} 1 0`; b.el.style.flex = `${b.tamanho} 1 0`;
      };
      const soltar = () => { alca.classList.remove("is-dragging"); document.removeEventListener("mousemove", mover); document.removeEventListener("mouseup", soltar); this.ws.app.emit("layout-changed"); this.ws.app.emit("resize"); };
      document.addEventListener("mousemove", mover);
      document.addEventListener("mouseup", soltar);
    });
  }
  inserir(filho, indice = this.children.length) {
    filho.parent = this;
    this.children.splice(indice, 0, filho);
    this.render();
  }
  remover(filho) {
    const i = this.children.indexOf(filho);
    if (i >= 0) this.children.splice(i, 1);
    filho.parent = null;
    this.render();
  }
}

/* ------------------------------------------------------------------ */
export class Workspace {
  constructor(app) {
    this.app = app;
    this.activeLeaf = null;
    this.arrastando = null;
    this.root = new Split(this, "vertical");
    this.root.el.classList.add("mod-root");
    this.overlay = h("div.workspace-drop-overlay.is-hidden");
  }

  grupos() {
    const out = [];
    const anda = n => { if (n instanceof TabGroup) out.push(n); else n.children.forEach(anda); };
    anda(this.root);
    return out;
  }
  leaves() { return this.grupos().flatMap(g => g.leaves); }

  /** primeira montagem: um grupo com uma aba vazia */
  async iniciarVazio() {
    const g = new TabGroup(this);
    this.root.inserir(g);
    const leaf = new Leaf(this.app);
    g.addLeaf(leaf);
    await leaf.setViewState({ type: "empty" });
    this.setActiveLeaf(leaf);
  }

  setActiveLeaf(leaf, focar = true) {
    if (!leaf || leaf.sidebar) return;
    const mudou = this.activeLeaf !== leaf;
    this.activeLeaf = leaf;
    for (const g of this.grupos()) g.el.classList.toggle("mod-active", g === leaf.group);
    if (mudou) { this.app.emit("active-leaf-change", leaf); this.app.emit("layout-changed"); }
    if (focar && mudou) leaf.view?.focus();
  }

  /** folha para abrir arquivo: a ativa (substitui) ou uma nova aba */
  getLeaf(novaAba = false) {
    let leaf = this.activeLeaf;
    if (!leaf || !leaf.group) { const g = this.grupos().find(x => x.active) || this.grupos()[0]; leaf = g?.active || g?.leaves[0]; }
    if (!leaf) {
      // nenhuma aba aberta: cria uma
      let g = this.grupos()[0];
      if (!g) { g = new TabGroup(this); this.root.inserir(g); }
      leaf = new Leaf(this.app);
      g.addLeaf(leaf);
      return leaf;
    }
    if (novaAba) {
      const g = leaf.group;
      const nl = new Leaf(this.app);
      g.addLeaf(nl, g.leaves.indexOf(leaf) + 1);
      return nl;
    }
    return leaf;
  }

  dividirGrupo(grupo, dir, antes = false) {
    const novo = new TabGroup(this);
    const pai = grupo.parent;
    if (pai.dir === dir) {
      const i = pai.children.indexOf(grupo);
      novo.tamanho = grupo.tamanho = (grupo.tamanho || 1);
      pai.inserir(novo, antes ? i : i + 1);
    } else {
      const i = pai.children.indexOf(grupo);
      const s = new Split(this, dir);
      s.tamanho = grupo.tamanho || 1;
      pai.children.splice(i, 1, s);
      s.parent = pai;
      grupo.tamanho = 1; novo.tamanho = 1;
      s.children = antes ? [novo, grupo] : [grupo, novo];
      novo.parent = s; grupo.parent = s;
      s.render();
      pai.render();
    }
    return novo;
  }

  async dividir(leaf, dir) {
    const novo = this.dividirGrupo(leaf.group, dir);
    const nl = new Leaf(this.app);
    novo.addLeaf(nl);
    const vs = leaf.getViewState();
    await nl.setViewState(vs.type === "file" ? vs : { type: "empty" }, { historico: false });
    this.setActiveLeaf(nl);
    this.app.emit("layout-changed");
    return nl;
  }

  /** grupo ficou sem abas: some (ou ganha aba vazia se for o único) */
  grupoVazio(grupo, mantendo = false) {
    const todos = this.grupos();
    if (todos.length <= 1) {
      if (!mantendo) { const leaf = new Leaf(this.app); grupo.addLeaf(leaf); leaf.setViewState({ type: "empty" }); }
      return;
    }
    let pai = grupo.parent;
    pai.remover(grupo);
    // desfaz divisões com um só filho
    while (pai !== this.root && pai.children.length === 1) {
      const so = pai.children[0], avo = pai.parent;
      const i = avo.children.indexOf(pai);
      so.tamanho = pai.tamanho;
      avo.children.splice(i, 1, so); so.parent = avo;
      avo.render();
      pai = avo;
    }
    if (pai === this.root && pai.children.length === 1 && pai.children[0] instanceof Split) {
      const so = pai.children[0];
      this.root.dir = so.dir; this.root.el.className = "workspace-split mod-root mod-" + so.dir;
      this.root.children = so.children; so.children.forEach(c => (c.parent = this.root));
      this.root.render();
    }
    if (!this.activeLeaf?.group || this.activeLeaf.group === grupo) {
      const g = this.grupos()[0];
      if (g?.active) this.setActiveLeaf(g.active);
    }
  }

  mostrarSobreposicao(grupo, zona) {
    if (!this.overlay.isConnected) document.body.appendChild(this.overlay);
    const r = grupo.containerEl.getBoundingClientRect();
    let { left, top, width, height } = r;
    if (zona === "esquerda") width /= 2;
    else if (zona === "direita") { left += width / 2; width /= 2; }
    else if (zona === "cima") height /= 2;
    else if (zona === "baixo") { top += height / 2; height /= 2; }
    Object.assign(this.overlay.style, { left: left + 4 + "px", top: top + 4 + "px", width: width - 8 + "px", height: height - 8 + "px" });
    this.overlay.classList.remove("is-hidden");
  }
  esconderSobreposicao() { this.overlay.classList.add("is-hidden"); }

  // ---- persistência do layout ----
  serializar() {
    const s = n => n instanceof TabGroup
      ? { tipo: "abas", tamanho: n.tamanho || 1, ativa: n.leaves.indexOf(n.active), abas: n.leaves.map(l => l.getViewState()) }
      : { tipo: "divisao", dir: n.dir, tamanho: n.tamanho || 1, filhos: n.children.map(s) };
    const ativo = this.leaves().indexOf(this.activeLeaf);
    return { raiz: s(this.root), ativo };
  }

  async restaurar(dados) {
    if (!dados?.raiz) return this.iniciarVazio();
    const todas = [];
    const monta = (d, pai) => {
      if (d.tipo === "abas") {
        const g = new TabGroup(this); g.tamanho = d.tamanho || 1; g.parent = pai; pai.children.push(g);
        const abas = (d.abas || []).filter(vs => !vs.state?.file || this.app.vault.exists(vs.state.file));
        if (!abas.length) abas.push({ type: "empty" });
        for (const vs of abas) { const l = new Leaf(this.app); g.addLeaf(l); todas.push([l, vs]); }
        g._ativaIdx = Math.max(0, Math.min(d.ativa ?? 0, g.leaves.length - 1));
      } else {
        const s = new Split(this, d.dir); s.tamanho = d.tamanho || 1; s.parent = pai; pai.children.push(s);
        for (const f of d.filhos || []) monta(f, s);
        if (!s.children.length) pai.children.pop();
        s.render();
      }
    };
    this.root.children = [];
    this.root.dir = dados.raiz.tipo === "divisao" ? dados.raiz.dir : "vertical";
    this.root.el.className = "workspace-split mod-root mod-" + this.root.dir;
    if (dados.raiz.tipo === "divisao") for (const f of dados.raiz.filhos) monta(f, this.root);
    else monta(dados.raiz, this.root);
    if (!this.root.children.length) return this.iniciarVazio();
    this.root.render();
    for (const g of this.grupos()) g.setActive(g.leaves[g._ativaIdx], false);
    // só carrega o conteúdo das abas visíveis agora; as demais quando forem abertas
    const visiveis = new Set(this.grupos().map(g => g.active));
    for (const [l, vs] of todas) {
      if (visiveis.has(l)) await l.setViewState(vs, { historico: false });
      else l.pendente = vs, l.atualizarCabecalhoPendente(vs);
    }
    const ativo = this.leaves()[dados.ativo] || this.grupos()[0].active;
    this.setActiveLeaf(ativo);
  }
}

// abas restauradas que ainda não foram carregadas mostram só o título
Leaf.prototype.atualizarCabecalhoPendente = function (vs) {
  const p = vs.state?.file;
  const ext = p ? extname(p) : "";
  this.tabTitleEl.textContent = p ? (ext === "md" ? basename(p).replace(/\.md$/i, "") : basename(p)) : "Nova aba";
  vazio(this.tabIconEl).appendChild(icon("file"));
};
const setActiveOriginal = TabGroup.prototype.setActive;
TabGroup.prototype.setActive = function (leaf, focar = true) {
  setActiveOriginal.call(this, leaf, focar);
  if (leaf?.pendente) { const vs = leaf.pendente; leaf.pendente = null; leaf.setViewState(vs, { historico: false }); }
};
