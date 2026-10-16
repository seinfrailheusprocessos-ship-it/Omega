// Classes-base das visualizações (cada aba mostra uma View).
import { h, vazio } from "../util/dom.js";
import { iconButton, iconeDoArquivo } from "../util/icons.js";
import { basename, stem, extname } from "../util/path.js";
import { notice, erro } from "../ui/notice.js";

export class View {
  constructor(leaf) {
    this.leaf = leaf;
    this.app = leaf.app;
    this.containerEl = leaf.contentEl;  // .workspace-leaf-content
    this.contentEl = leaf.viewContentEl; // .view-content
    this.acoesEl = leaf.acoesEl;
    this.destruido = false;
  }
  getViewType() { return "empty"; }
  getDisplayText() { return "Nova aba"; }
  getIcon() { return "file"; }
  getState() { return {}; }
  async setState() {}
  async onOpen() {}
  async onClose() {}
  /** pode fechar? (pergunta se há alterações não salvas) */
  async canClose() { return true; }
  onResize() {}
  /** ações da barra inferior do celular quando o teclado está aberto */
  getMobileToolbar() { return []; }
  /** itens extras no menu "⋮" */
  onPaneMenu(menu) {}
  /** cabeçalhos para o painel Estrutura: [{nivel, texto, alvo}] */
  getOutline() { return null; }
  revealOutline(item) {}
  getStatus() { return []; }
  addAction(ic, titulo, cb, classe = "") {
    const b = iconButton(ic, titulo, cb, "clickable-icon view-action" + (classe ? " " + classe : ""));
    this.acoesEl.insertBefore(b, this.acoesEl.lastChild);
    return b;
  }
  focus() {}
}

export class FileView extends View {
  constructor(leaf, file) {
    super(leaf);
    this.file = file;
    this.dirty = false;
    this.salvando = null;
  }
  get path() { return this.file.path; }
  getViewType() { return "file"; }
  getDisplayText() { return this.file ? (this.mostrarExtensao() ? basename(this.file.path) : stem(this.file.path)) : ""; }
  mostrarExtensao() { return extname(this.file.path) !== "md"; }
  getIcon() { return iconeDoArquivo(extname(this.file.path)); }
  getState() { return { file: this.file.path }; }

  /** salva automaticamente (md/txt) ou só quando o usuário pede (docx, xlsx, pdf) */
  get autosave() { return false; }

  setDirty(v) {
    if (this.dirty === v) return;
    this.dirty = v;
    this.leaf.atualizarCabecalho();
    this.app.emit("dirty-changed", this);
  }

  async onOpen() {
    vazio(this.contentEl);
    const carregando = h("div.view-loading", { text: "Abrindo…" });
    this.contentEl.appendChild(carregando);
    try {
      const dados = await this.app.vault.read(this.file.path);
      this.ultimaVersaoLida = this.app.vault.get(this.file.path)?.mtime;
      carregando.remove();
      if (this.destruido) return;
      await this.onLoadFile(dados);
    } catch (e) {
      carregando.remove();
      this.contentEl.appendChild(h("div.view-error", h("p", { text: "Não foi possível abrir este arquivo." }), h("p.u-muted", { text: e.message || String(e) })));
      console.error(e);
    }
  }

  async onLoadFile(dados) {}
  async getSaveData() { return null; }

  async save({ explicit = true, silencioso = false } = {}) {
    if (this.salvando) { await this.salvando; if (!this.dirty) return true; }
    const tarefa = (async () => {
      try {
        const dados = await this.getSaveData();
        if (dados == null) return false;
        const info = await this.app.vault.write(this.file.path, dados, { explicit, origem: this.app.idSessao });
        this.ultimaVersaoLida = info.mtime;
        this.setDirty(false);
        if (explicit && !silencioso) notice("Salvo. A versão anterior foi guardada no histórico.", { tempo: 2500 });
        this.app.emit("file-saved", this.file.path);
        return true;
      } catch (e) {
        erro("Não foi possível salvar " + basename(this.file.path) + ".", e);
        return false;
      }
    })();
    this.salvando = tarefa;
    try { return await tarefa; } finally { this.salvando = null; }
  }

  async canClose() {
    if (!this.dirty) return true;
    if (this.autosave) { await this.save({ explicit: false, silencioso: true }); return true; }
    const { confirmar } = await import("../ui/modal.js");
    const r = await confirmar({ titulo: "Salvar alterações?", texto: `“${basename(this.file.path)}” tem alterações não salvas.`, ok: "Salvar", cancelar: "Cancelar", extra: { texto: "Não salvar", valor: "descartar" } });
    if (r === true) return await this.save();
    return r === "descartar";
  }

  /** o arquivo mudou fora do app */
  async onExternalChange() {
    if (this.dirty) { notice(`“${basename(this.file.path)}” mudou fora do app. Suas alterações abertas foram mantidas; ao salvar, a versão de fora vai para o histórico.`, { tempo: 8000 }); return; }
    await this.recarregar();
  }

  async recarregar() {
    const estado = this.getState();
    await this.onClose();
    await this.onOpen();
    await this.setState(estado);
  }

  onRename(novo) { this.file = novo; this.leaf.atualizarCabecalho(); }
}
