// Explorador de arquivos em árvore.
import { h, vazio, debounce } from "../util/dom.js";
import { icon, iconButton } from "../util/icons.js";
import { dirname, join, extname, NOME_INVALIDO } from "../util/path.js";
import { View } from "./base.js";
import { Menu } from "../ui/menu.js";
import { erro, notice } from "../ui/notice.js";

export class FileExplorerView extends View {
  getViewType() { return "file-explorer"; }
  getDisplayText() { return "Arquivos"; }
  getIcon() { return "folder-closed"; }

  async onOpen() {
    const app = this.app;
    this.recolhidas = new Set(JSON.parse(localStorage.getItem("tinteiro.recolhidas") || "null") || []);
    this.primeiraVez = !localStorage.getItem("tinteiro.recolhidas");
    this.botoes = h("div.nav-buttons-container",
      iconButton("new-note", "Nova nota", () => app.novaNota(this.pastaAlvo()), "clickable-icon nav-action-button"),
      iconButton("folder-plus", "Nova pasta", () => app.novaPasta(this.pastaAlvo()), "clickable-icon nav-action-button"),
      iconButton("sort", "Ordenar", e => this.menuOrdem(e), "clickable-icon nav-action-button"),
      this.btnRecolher = iconButton("chevrons-down-up", "Recolher tudo", () => this.alternarTudo(), "clickable-icon nav-action-button"));
    this.lista = h("div.nav-files-container", { tabindex: "0" });
    this.contentEl.classList.add("mod-explorer");
    this.contentEl.style.display = "flex";
    this.contentEl.style.flexDirection = "column";
    this.contentEl.append(h("div.nav-header", this.botoes), this.lista);
    this.render = debounce(() => this.desenhar(), 50);
    this.offs = [
      app.vault.on("changed", () => this.render()),
      app.on("active-leaf-change", () => this.marcarAtivo()),
      app.on("file-open", () => this.marcarAtivo()),
    ];
    this.configurarSoltarArquivos();
    this.lista.addEventListener("contextmenu", e => { if (e.target === this.lista) this.menuPasta(e, app.vault.get("")); });
    this.desenhar();
  }
  async onClose() { this.offs?.forEach(f => f()); }

  pastaAlvo() {
    const f = this.app.arquivoAtivo();
    return f ? dirname(f.path) : "";
  }

  salvarRecolhidas() { localStorage.setItem("tinteiro.recolhidas", JSON.stringify([...this.recolhidas])); }

  desenhar() {
    const v = this.app.vault;
    const rolagem = this.lista.scrollTop;
    vazio(this.lista);
    if (this.primeiraVez) { for (const f of v.folders()) if (f.path) this.recolhidas.add(f.path); this.primeiraVez = false; this.salvarRecolhidas(); }
    const raiz = h("div.tree-item.nav-folder.mod-root", h("div.tree-item-children.nav-folder-children"));
    this.itens = new Map();
    this.montarFilhos(raiz.firstChild, "");
    this.lista.appendChild(raiz);
    if (v.files().length === 0 && v.folders().length <= 1) this.lista.appendChild(h("div.nav-files-empty", { text: "A pasta está vazia. Crie uma nota ou arraste arquivos para cá." }));
    this.lista.scrollTop = rolagem;
    this.marcarAtivo();
    vazio(this.btnRecolher).appendChild(icon(this.tudoRecolhido() ? "chevrons-up-down" : "chevrons-down-up"));
    this.btnRecolher.title = this.tudoRecolhido() ? "Expandir tudo" : "Recolher tudo";
  }

  montarFilhos(container, pasta) {
    for (const e of this.app.vault.children(pasta)) container.appendChild(e.type === "folder" ? this.itemPasta(e) : this.itemArquivo(e));
  }

  itemPasta(e) {
    const recolhida = this.recolhidas.has(e.path);
    const filhos = h("div.tree-item-children.nav-folder-children");
    const self = h("div.tree-item-self.nav-folder-title.is-clickable.mod-collapsible", { draggable: "true", "data-path": e.path },
      h("div.tree-item-icon.collapse-icon", icon("chevron-down", "right-triangle")),
      h("div.tree-item-inner.nav-folder-title-content", { text: e.name }));
    const item = h("div.tree-item.nav-folder" + (recolhida ? ".is-collapsed" : ""), self, filhos);
    if (!recolhida) this.montarFilhos(filhos, e.path);
    self.addEventListener("click", ev => {
      if (self.classList.contains("is-being-renamed")) return;
      const agora = !item.classList.contains("is-collapsed");
      item.classList.toggle("is-collapsed", agora);
      if (agora) this.recolhidas.add(e.path); else { this.recolhidas.delete(e.path); if (!filhos.children.length) this.montarFilhos(filhos, e.path); }
      this.salvarRecolhidas();
      vazio(this.btnRecolher).appendChild(icon(this.tudoRecolhido() ? "chevrons-up-down" : "chevrons-down-up"));
    });
    self.addEventListener("contextmenu", ev => this.menuPasta(ev, e));
    this.configurarArrastar(self, e);
    this.itens.set(e.path, self);
    return item;
  }

  itemArquivo(e) {
    const ext = e.ext;
    const self = h("div.tree-item-self.nav-file-title.is-clickable", { draggable: "true", "data-path": e.path },
      h("div.tree-item-inner.nav-file-title-content", { text: ext === "md" ? e.basename : (ext ? e.basename : e.name) }),
      ext && ext !== "md" ? h("div.tree-item-flair-outer", h("span.nav-file-tag", { text: ext })) : null);
    if (ext && ext !== "md") self.title = e.name;
    const item = h("div.tree-item.nav-file", self);
    self.addEventListener("click", ev => {
      if (self.classList.contains("is-being-renamed")) return;
      const nova = ev.ctrlKey || ev.metaKey;
      this.app.abrirArquivo(e.path, { novaAba: nova });
      if (this.app.isMobile) this.app.mobile.fecharGavetas();
    });
    self.addEventListener("auxclick", ev => { if (ev.button === 1) this.app.abrirArquivo(e.path, { novaAba: true }); });
    self.addEventListener("contextmenu", ev => {
      const m = new Menu();
      this.app.itensMenuArquivo(m, e, "explorer");
      m.showAtMouseEvent(ev);
    });
    this.configurarArrastar(self, e);
    this.itens.set(e.path, self);
    return item;
  }

  marcarAtivo() {
    const ativo = this.app.arquivoAtivo()?.path;
    this.lista.querySelectorAll(".tree-item-self.is-active").forEach(x => x.classList.remove("is-active"));
    if (ativo && this.itens?.get(ativo)) this.itens.get(ativo).classList.add("is-active");
  }

  revelar(path) {
    let p = dirname(path); let mudou = false;
    while (p) { if (this.recolhidas.delete(p)) mudou = true; p = dirname(p); }
    if (this.recolhidas.has(path) && this.app.vault.get(path)?.type === "folder") { this.recolhidas.delete(path); mudou = true; }
    if (mudou) { this.salvarRecolhidas(); this.desenhar(); }
    const el = this.itens.get(path);
    if (el) { el.scrollIntoView({ block: "center" }); el.classList.add("has-focus"); setTimeout(() => el.classList.remove("has-focus"), 1200); }
  }

  tudoRecolhido() { return this.app.vault.folders().filter(f => f.path).every(f => this.recolhidas.has(f.path)); }
  alternarTudo() {
    if (this.tudoRecolhido()) this.recolhidas.clear();
    else for (const f of this.app.vault.folders()) if (f.path) this.recolhidas.add(f.path);
    this.salvarRecolhidas();
    this.desenhar();
  }

  menuOrdem(e) {
    const m = new Menu();
    const v = this.app.vault;
    const op = (t, k) => m.addItem({ title: t, checked: v.ordem === k, onClick: () => { v.ordem = k; localStorage.setItem("tinteiro.ordem", k); this.desenhar(); } });
    op("Nome do arquivo (A a Z)", "nome-asc"); op("Nome do arquivo (Z a A)", "nome-desc");
    m.addSeparator();
    op("Data de modificação (mais nova primeiro)", "data-desc"); op("Data de modificação (mais antiga primeiro)", "data-asc");
    m.showBelow(e.currentTarget);
  }

  menuPasta(ev, e) {
    const m = new Menu();
    const app = this.app;
    m.addItem({ title: "Nova nota", icon: "new-note", onClick: () => app.novaNota(e.path) });
    m.addItem({ title: "Nova pasta", icon: "folder-plus", onClick: () => app.novaPasta(e.path) });
    m.addItem({ title: "Novo documento Word", icon: "file-type", onClick: () => app.novoDocumento(e.path, "docx") });
    m.addItem({ title: "Nova planilha", icon: "file-spreadsheet", onClick: () => app.novoDocumento(e.path, "xlsx") });
    m.addItem({ title: "Importar arquivos…", icon: "upload", onClick: () => app.importarArquivos(e.path) });
    if (e.path) {
      m.addSeparator();
      m.addItem({ title: "Renomear…", icon: "pencil", onClick: () => this.renomearInline(e.path) });
      m.addItem({ title: "Excluir", icon: "trash", warning: true, onClick: () => app.excluir(e.path) });
    }
    if (app.backend.caps.reveal) { m.addSeparator(); m.addItem({ title: "Mostrar no Explorador de Arquivos", icon: "folder-open", onClick: () => app.backend.reveal(e.path) }); }
    m.addItem({ title: "Copiar caminho", icon: "copy", onClick: () => app.copiarCaminho(e.path) });
    m.showAtMouseEvent(ev);
  }

  /** renomear direto na árvore (como no app de referência) */
  renomearInline(path) {
    this.revelar(path);
    const self = this.itens.get(path);
    const e = this.app.vault.get(path);
    if (!self || !e) return this.app.renomear(path, { modal: true });
    const inner = self.querySelector(".tree-item-inner");
    const ext = e.type === "file" ? e.ext : "";
    const antigo = e.type === "file" && ext === "md" ? e.basename : e.name;
    const inp = h("input", { type: "text", value: antigo, spellcheck: "false" });
    vazio(inner).appendChild(inp);
    self.classList.add("is-being-renamed");
    self.draggable = false;
    inp.focus();
    const ponto = e.type === "file" && ext !== "md" ? antigo.lastIndexOf(".") : -1;
    inp.setSelectionRange(0, ponto > 0 ? ponto : antigo.length);
    let feito = false;
    const fim = async ok => {
      if (feito) return; feito = true;
      self.classList.remove("is-being-renamed"); self.draggable = true;
      let novo = inp.value.trim();
      if (!ok || !novo || novo === antigo) { inner.textContent = antigo; return; }
      if (NOME_INVALIDO.test(novo)) { notice("O nome não pode ter \\ / : * ? \" < > |"); inner.textContent = antigo; return; }
      if (e.type === "file" && ext === "md") novo += ".md";
      inner.textContent = novo;
      await this.app.moverPara(path, join(dirname(path), novo));
    };
    inp.addEventListener("keydown", ev => { ev.stopPropagation(); if (ev.key === "Enter") { ev.preventDefault(); fim(true); } else if (ev.key === "Escape") { ev.preventDefault(); fim(false); } });
    inp.addEventListener("blur", () => fim(true));
    inp.addEventListener("click", ev => ev.stopPropagation());
  }

  configurarArrastar(self, e) {
    self.addEventListener("dragstart", ev => {
      ev.dataTransfer.setData("tinteiro/path", e.path);
      ev.dataTransfer.setData("text/plain", e.path);
      ev.dataTransfer.effectAllowed = "copyMove";
    });
    if (e.type !== "folder") return;
    self.addEventListener("dragover", ev => {
      if (!ev.dataTransfer.types.includes("tinteiro/path") && !ev.dataTransfer.types.includes("Files")) return;
      ev.preventDefault(); ev.stopPropagation();
      self.classList.add("drop-target");
    });
    self.addEventListener("dragleave", () => self.classList.remove("drop-target"));
    self.addEventListener("drop", async ev => {
      ev.preventDefault(); ev.stopPropagation();
      self.classList.remove("drop-target");
      await this.soltarEm(ev, e.path);
    });
  }

  configurarSoltarArquivos() {
    this.lista.addEventListener("dragover", ev => {
      if (!ev.dataTransfer.types.includes("tinteiro/path") && !ev.dataTransfer.types.includes("Files")) return;
      ev.preventDefault();
      this.lista.classList.add("drop-target-root");
    });
    this.lista.addEventListener("dragleave", ev => { if (!this.lista.contains(ev.relatedTarget)) this.lista.classList.remove("drop-target-root"); });
    this.lista.addEventListener("drop", async ev => { ev.preventDefault(); this.lista.classList.remove("drop-target-root"); await this.soltarEm(ev, ""); });
  }

  async soltarEm(ev, pasta) {
    const p = ev.dataTransfer.getData("tinteiro/path");
    if (p) {
      if (p === pasta || pasta.startsWith(p + "/") || dirname(p) === pasta) return;
      await this.app.moverPara(p, join(pasta, p.split("/").pop()));
      return;
    }
    if (ev.dataTransfer.files?.length) await this.app.enviarArquivos([...ev.dataTransfer.files], pasta);
  }
}
