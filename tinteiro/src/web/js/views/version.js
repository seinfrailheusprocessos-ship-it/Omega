// Visualização somente leitura de uma versão antiga (do histórico).
import { h } from "../util/dom.js";
import { FileView } from "./base.js";
import { viewParaExtensao } from "./registry.js";
import { formatData } from "../util/dom.js";
import { basename, extname } from "../util/path.js";

export class VersionView extends FileView {
  constructor(leaf, file, estado) { super(leaf, file); this.estado = estado; }
  getViewType() { return "file-version"; }
  getDisplayText() { return `${basename(this.file.path)} (${formatData(this.estado.quando)})`; }
  getIcon() { return "history"; }
  getState() { return { ...this.estado }; }
  async onOpen() {
    const aviso = h("div.version-banner", h("span", { text: `Versão de ${formatData(this.estado.quando)} — somente leitura.` }),
      h("button.mod-cta", { text: "Restaurar esta versão", onclick: () => this.app.restaurarVersao(this.file.path, { id: this.estado.versao, time: this.estado.quando }) }));
    this.contentEl.appendChild(aviso);
    const dados = await this.app.backend.readVersion(this.file.path, this.estado.versao);
    const Classe = await viewParaExtensao(extname(this.file.path));
    // usa o visualizador normal do formato, em modo somente leitura, numa área própria
    const area = h("div.version-body");
    this.contentEl.appendChild(area);
    const falsoLeaf = { app: this.app, contentEl: area, viewContentEl: area, acoesEl: h("div", h("div")), atualizarCabecalho() {}, group: null };
    this.interno = new Classe(falsoLeaf, this.file);
    this.interno.somenteLeitura = true;
    this.interno.setDirty = () => {};
    this.interno.save = async () => false;
    await this.interno.onLoadFile(dados);
  }
  async onClose() { await this.interno?.onClose?.(); }
}
