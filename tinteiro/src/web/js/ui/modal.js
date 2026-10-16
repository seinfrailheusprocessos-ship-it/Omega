// Janelas: modal genérica, confirmar, perguntar texto.
import { h } from "../util/dom.js";
import { iconButton } from "../util/icons.js";

export class Modal {
  constructor({ titulo = "", classe = "" } = {}) {
    this.containerEl = h("div.modal-container");
    this.bg = h("div.modal-bg");
    this.modalEl = h("div.modal" + (classe ? "." + classe : ""));
    this.titleEl = h("div.modal-title", { text: titulo });
    this.contentEl = h("div.modal-content");
    this.modalEl.append(iconButton("x", "Fechar", () => this.close(), "clickable-icon modal-close-button"), this.titleEl, this.contentEl);
    this.containerEl.append(this.bg, this.modalEl);
    this.bg.addEventListener("click", () => this.close());
    this._tecla = e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); this.close(); } };
    this.aoFechar = [];
  }
  open() {
    document.body.appendChild(this.containerEl);
    document.addEventListener("keydown", this._tecla, true);
    this.onOpen && this.onOpen();
    return this;
  }
  close() {
    if (!this.containerEl.isConnected) return;
    document.removeEventListener("keydown", this._tecla, true);
    this.containerEl.remove();
    this.onClose && this.onClose();
    this.aoFechar.forEach(f => f());
  }
  botoes(lista) {
    const c = h("div.modal-button-container");
    for (const b of lista) {
      const el = h("button" + (b.cta ? ".mod-cta" : "") + (b.warning ? ".mod-warning" : ""), { text: b.texto });
      el.addEventListener("click", () => b.acao());
      c.appendChild(el);
    }
    this.modalEl.appendChild(c);
    return c;
  }
}

export function confirmar({ titulo, texto, ok = "Confirmar", cancelar = "Cancelar", perigo = false, extra = null }) {
  return new Promise(res => {
    const m = new Modal({ titulo });
    m.contentEl.appendChild(h("p", { text: texto }));
    let feito = false;
    const fim = v => { if (!feito) { feito = true; res(v); m.close(); } };
    m.aoFechar.push(() => fim(false));
    const bs = [{ texto: cancelar, acao: () => fim(false) }];
    if (extra) bs.push({ texto: extra.texto, acao: () => fim(extra.valor) });
    bs.push({ texto: ok, cta: !perigo, warning: perigo, acao: () => fim(true) });
    const c = m.botoes(bs);
    m.open();
    setTimeout(() => c.lastChild.focus(), 30);
  });
}

export function perguntar({ titulo, valor = "", placeholder = "", ok = "Salvar", selecionarAte = null }) {
  return new Promise(res => {
    const m = new Modal({ titulo });
    const inp = h("input", { type: "text", value: valor, placeholder, spellcheck: "false" });
    m.contentEl.appendChild(inp);
    let feito = false;
    const fim = v => { if (!feito) { feito = true; res(v); m.close(); } };
    m.aoFechar.push(() => fim(null));
    inp.addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); fim(inp.value.trim() || null); } });
    m.botoes([{ texto: "Cancelar", acao: () => fim(null) }, { texto: ok, cta: true, acao: () => fim(inp.value.trim() || null) }]);
    m.open();
    setTimeout(() => { inp.focus(); inp.setSelectionRange(0, selecionarAte ?? valor.length); }, 30);
  });
}
