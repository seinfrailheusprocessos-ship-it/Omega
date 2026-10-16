// Formatos sem editor próprio: mostra informações e o botão "Abrir no programa padrão".
import { h } from "../util/dom.js";
import { icon } from "../util/icons.js";
import { FileView } from "./base.js";
import { formatBytes, formatData } from "../util/dom.js";
import { extname, basename } from "../util/path.js";

export class OtherView extends FileView {
  getViewType() { return "other"; }
  async onOpen() {
    const f = this.app.vault.get(this.file.path) || this.file;
    const ext = extname(f.path).toUpperCase() || "?";
    const pode = this.app.backend.caps.openExternal;
    const botao = h("button.mod-cta", { onclick: () => this.app.abrirNoPrograma(f.path) }, icon("external-link"), h("span", { text: "Abrir no programa padrão" }));
    if (!pode) botao.disabled = true;
    this.contentEl.appendChild(h("div.empty-state", h("div.empty-state-container.other-file",
      h("div.other-file-icon", icon("file")), h("div.other-file-ext", { text: ext }),
      h("div.empty-state-title", { style: { marginBottom: "8px" }, text: basename(f.path) }),
      h("div.u-muted", { style: { marginBottom: "20px", fontSize: "13px" }, text: `${formatBytes(f.size)} · modificado em ${formatData(f.mtime)}` }),
      botao,
      !pode ? h("p.u-faint", { style: { fontSize: "13px", marginTop: "12px" }, text: "Este formato abre no programa do computador (ou no app Android)." }) : null)));
  }
}
