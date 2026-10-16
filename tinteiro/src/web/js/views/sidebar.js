// Painéis laterais: Busca, Favoritos, Estrutura (sumário) e Histórico de versões.
import { h, vazio, debounce, formatBytes, formatData } from "../util/dom.js";
import { icon, iconButton } from "../util/icons.js";
import { basename, extname } from "../util/path.js";
import { View } from "./base.js";
import { Menu } from "../ui/menu.js";
import { erro } from "../ui/notice.js";

/* ---------------- Busca ---------------- */
export class SearchView extends View {
  getViewType() { return "search"; }
  getDisplayText() { return "Buscar"; }
  getIcon() { return "search"; }
  async onOpen() {
    this.contentEl.style.display = "flex";
    this.contentEl.style.flexDirection = "column";
    this.input = h("input", { type: "search", placeholder: "Buscar…", spellcheck: "false", enterkeyhint: "search" });
    const limpar = iconButton("x", "Limpar", () => { this.input.value = ""; this.buscar(); this.input.focus(); }, "clickable-icon search-input-clear-button");
    this.info = h("div.search-result-info");
    this.res = h("div.search-results-children");
    this.contentEl.append(h("div.search-input-container", h("span.search-icon", icon("search")), this.input, limpar), this.info, this.res);
    this.buscarDeb = debounce(() => this.buscar(), 250);
    this.input.addEventListener("input", () => this.buscarDeb());
    this.input.addEventListener("keydown", e => { if (e.key === "Enter") this.buscarDeb.flush(); });
  }
  focus() { if (document.activeElement !== this.input) { this.input?.focus(); this.input?.select(); } }
  setQuery(q) { this.input.value = q; this.buscar(); }
  async buscar() {
    const q = this.input.value.trim();
    const meu = this.seq = (this.seq || 0) + 1;
    vazio(this.res); vazio(this.info);
    if (!q) return;
    this.info.textContent = "Buscando…";
    let r;
    try { r = await this.app.backend.search(q); } catch (e) { this.info.textContent = "Erro na busca."; return; }
    if (meu !== this.seq) return;
    const lista = r.results || [];
    this.info.textContent = "";
    this.info.append(h("span", { text: lista.length ? `${lista.length} arquivo${lista.length > 1 ? "s" : ""}` : "Nenhum resultado." }));
    if (r.ready === false) this.info.append(h("span.u-faint", { text: "indexando…" }));
    for (const it of lista) {
      const ext = extname(it.path);
      const titulo = h("div.tree-item-self.search-result-file-title.is-clickable",
        h("div.tree-item-icon.collapse-icon", icon("chevron-down", "right-triangle")),
        h("div.tree-item-inner", { text: ext === "md" ? basename(it.path).slice(0, -3) : basename(it.path) }),
        h("div.tree-item-flair-outer", h("span.search-result-count", { text: String(it.total || "") })));
      titulo.title = it.path;
      const trechos = h("div.search-result-file-matches");
      for (const m of it.matches || []) {
        const linha = h("div.search-result-file-match", m.before.trimStart(), h("span.search-result-file-matched-text", { text: m.match }), m.after);
        linha.addEventListener("click", () => this.app.abrirArquivo(it.path, { busca: m.match, mobileFechar: true }));
        trechos.appendChild(linha);
      }
      const item = h("div.tree-item.search-result", titulo, it.matches?.length ? trechos : null);
      titulo.addEventListener("click", e => {
        if (e.target.closest(".collapse-icon")) { item.classList.toggle("is-collapsed"); trechos.classList.toggle("is-hidden"); return; }
        this.app.abrirArquivo(it.path, { novaAba: e.ctrlKey || e.metaKey, busca: q, mobileFechar: true });
      });
      titulo.addEventListener("contextmenu", e => { const m = new Menu(); this.app.itensMenuArquivo(m, this.app.vault.get(it.path) || { path: it.path, type: "file" }, "search"); m.showAtMouseEvent(e); });
      this.res.appendChild(item);
    }
  }
}

/* ---------------- Favoritos ---------------- */
export class BookmarksView extends View {
  getViewType() { return "bookmarks"; }
  getDisplayText() { return "Favoritos"; }
  getIcon() { return "bookmark"; }
  async onOpen() {
    this.lista = h("div.nav-files-container");
    this.contentEl.appendChild(this.lista);
    this.offs = [this.app.on("bookmarks-changed", () => this.desenhar()), this.app.vault.on("changed", () => this.desenhar())];
    this.desenhar();
  }
  async onClose() { this.offs?.forEach(f => f()); }
  desenhar() {
    vazio(this.lista);
    const favs = this.app.favoritos.filter(p => this.app.vault.exists(p));
    if (!favs.length) { this.lista.appendChild(h("div.nav-files-empty", { text: "Nenhum favorito. Clique com o botão direito num arquivo e escolha “Adicionar aos favoritos”." })); return; }
    for (const p of favs) {
      const e = this.app.vault.get(p);
      const self = h("div.tree-item-self.is-clickable", { style: { paddingLeft: "8px" } }, h("div.tree-item-icon", { style: { marginRight: "6px", display: "flex", "--icon-size": "16px" } }, icon(e.type === "folder" ? "folder" : "file")), h("div.tree-item-inner", { text: e.type === "file" && e.ext === "md" ? e.basename : e.name }));
      self.title = p;
      self.addEventListener("click", ev => e.type === "folder" ? this.app.revelarNoExplorador(p) : this.app.abrirArquivo(p, { novaAba: ev.ctrlKey, mobileFechar: true }));
      self.addEventListener("contextmenu", ev => { const m = new Menu(); m.addItem({ title: "Remover dos favoritos", icon: "star-off", onClick: () => this.app.alternarFavorito(p) }); m.showAtMouseEvent(ev); });
      this.lista.appendChild(h("div.tree-item", self));
    }
  }
}

/* ---------------- Estrutura (sumário do documento) ---------------- */
export class OutlineView extends View {
  getViewType() { return "outline"; }
  getDisplayText() { return "Estrutura"; }
  getIcon() { return "outline"; }
  async onOpen() {
    this.box = h("div.outline-container");
    this.contentEl.appendChild(this.box);
    this.atualizar = debounce(() => this.desenhar(), 300);
    this.offs = [this.app.on("active-leaf-change", () => this.atualizar()), this.app.on("outline-changed", () => this.atualizar())];
    this.desenhar();
  }
  async onClose() { this.offs?.forEach(f => f()); }
  desenhar() {
    vazio(this.box);
    const v = this.app.workspace.activeLeaf?.view;
    const itens = v?.getOutline?.();
    if (!itens || !itens.length) { this.box.appendChild(h("div.outline-empty", { text: v?.file ? "Nenhum título encontrado." : "Nenhum arquivo aberto." })); return; }
    const min = Math.min(...itens.map(i => i.nivel));
    for (const it of itens) {
      const self = h("div.tree-item-self.is-clickable", { style: { paddingLeft: `${8 + (it.nivel - min) * 16}px` } }, h("div.tree-item-inner", { text: it.texto }));
      self.addEventListener("click", () => { v.revealOutline(it); if (this.app.isMobile) this.app.mobile.fecharGavetas(); });
      this.box.appendChild(h("div.tree-item.outline-item", self));
    }
  }
}

/* ---------------- Histórico de versões do arquivo ativo ---------------- */
export class HistoryPanelView extends View {
  getViewType() { return "file-history"; }
  getDisplayText() { return "Histórico de versões"; }
  getIcon() { return "history"; }
  async onOpen() {
    this.box = h("div.outline-container");
    this.contentEl.appendChild(this.box);
    this.atualizar = debounce(() => this.desenhar(), 300);
    this.offs = [this.app.on("active-leaf-change", () => this.atualizar()), this.app.on("file-saved", () => this.atualizar())];
    this.desenhar();
  }
  async onClose() { this.offs?.forEach(f => f()); }
  async desenhar() {
    const f = this.app.arquivoAtivo();
    vazio(this.box);
    if (!f) { this.box.appendChild(h("div.outline-empty", { text: "Abra um arquivo para ver as versões anteriores." })); return; }
    let vs = [];
    try { vs = await this.app.backend.history(f.path); } catch (e) {}
    vazio(this.box);
    this.box.appendChild(h("div.search-result-info", h("span", { text: basename(f.path) })));
    if (!vs.length) { this.box.appendChild(h("div.outline-empty", { text: "Ainda não há versões anteriores. Cada vez que você salva, a versão anterior é guardada aqui." })); return; }
    for (const v of vs) {
      const self = h("div.tree-item-self.is-clickable", { style: { paddingLeft: "8px", display: "flex", gap: "8px" } },
        h("div.tree-item-inner", { text: formatData(v.time) }), h("div.tree-item-flair-outer", h("span.u-faint", { style: { fontSize: "11px" }, text: formatBytes(v.size) })));
      self.addEventListener("click", ev => this.menu(ev, f, v));
      self.addEventListener("contextmenu", ev => this.menu(ev, f, v));
      this.box.appendChild(h("div.tree-item", self));
    }
  }
  menu(ev, f, v) {
    const m = new Menu();
    m.addItem({ title: "Abrir esta versão (somente leitura)", icon: "eye", onClick: () => this.app.abrirVersao(f.path, v) });
    m.addItem({ title: "Restaurar esta versão", icon: "rotate-ccw", onClick: () => this.app.restaurarVersao(f.path, v) });
    m.showAtMouseEvent(ev);
  }
}
