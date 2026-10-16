// Relatórios HTML: mostrados já renderizados (com scripts, isolados do app). Dá para editar o código-fonte.
import { h, vazio } from "../util/dom.js";
import { icon } from "../util/icons.js";
import { FileView } from "./base.js";
import { extname, dirname, join } from "../util/path.js";

export class HtmlView extends FileView {
  getViewType() { return "html"; }
  async onLoadFile(dados) {
    this.dados = dados;
    this.contentEl.classList.add("html-view-content");
    this.frame = h("iframe.html-frame", { sandbox: "allow-scripts allow-popups allow-forms allow-modals allow-downloads allow-popups-to-escape-sandbox", referrerpolicy: "no-referrer" });
    this.contentEl.appendChild(this.frame);
    await this.mostrar();
    this.addAction("refresh", "Recarregar", () => this.recarregar());
    this.btnFonte = this.addAction("code", "Editar código-fonte", () => this.alternarFonte());
  }
  async mostrar() {
    if (this.app.backend.caps.rawUrl) {
      try { this.frame.src = await this.app.backend.rawUrl(this.file.path); return; } catch (e) {}
    }
    // sem servidor (celular): troca imagens/estilos relativos por cópias locais
    let html = new TextDecoder("utf-8").decode(this.dados);
    const base = dirname(this.file.path);
    const urls = [];
    const subst = async (m, attr, q, src) => m;
    const achados = [...html.matchAll(/(src|href)=(["'])([^"'#?]+)\2/gi)].filter(m => !/^(https?:|data:|mailto:|#|javascript:)/i.test(m[3]));
    for (const m of achados) {
      const p = join(base, decodeURIComponent(m[3]));
      if (!this.app.vault.exists(p)) continue;
      const ext = extname(p);
      const tipo = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml", css: "text/css", js: "text/javascript", webp: "image/webp" }[ext];
      if (!tipo) continue;
      const buf = await this.app.vault.read(p);
      const u = URL.createObjectURL(new Blob([buf], { type: tipo }));
      urls.push(u);
      html = html.split(m[0]).join(`${m[1]}=${m[2]}${u}${m[2]}`);
    }
    this.urls = urls;
    this.frame.srcdoc = html;
  }
  async alternarFonte() {
    if (this.fonte) {
      // volta para a visualização e salva se mudou
      const novo = this.fonte.state.doc.toString();
      this.fonte.destroy(); this.fonte = null; this.fonteEl.remove();
      if (this.dirty) { this.dados = new TextEncoder().encode(novo); await this.save({ explicit: true }); }
      this.frame.classList.remove("is-hidden");
      await this.mostrar();
      vazio(this.btnFonte).appendChild(icon("code"));
      return;
    }
    const { EditorView, keymap, lineNumbers } = await import("@codemirror/view");
    const { EditorState } = await import("@codemirror/state");
    const { defaultKeymap, history, historyKeymap } = await import("@codemirror/commands");
    const { html } = await import("@codemirror/lang-html");
    const { syntaxHighlighting } = await import("@codemirror/language");
    const { realce } = await import("./markdown.js");
    this.frame.classList.add("is-hidden");
    this.fonteEl = h("div.markdown-source-view.mod-cm6.is-code");
    this.contentEl.appendChild(this.fonteEl);
    const texto = new TextDecoder("utf-8").decode(this.dados);
    this.fonteTexto = texto;
    this.fonte = new EditorView({ parent: this.fonteEl, state: EditorState.create({ doc: texto, extensions: [lineNumbers(), history(), html(), syntaxHighlighting(realce), EditorView.lineWrapping, keymap.of([{ key: "Mod-s", run: () => { this.dados = new TextEncoder().encode(this.fonte.state.doc.toString()); this.save({ explicit: true }); return true; } }, ...defaultKeymap, ...historyKeymap]), EditorView.updateListener.of(u => { if (u.docChanged) this.setDirty(u.state.doc.toString() !== this.fonteTexto); })] }) });
    vazio(this.btnFonte).appendChild(icon("eye"));
    this.btnFonte.title = "Ver renderizado";
  }
  async getSaveData() { return this.fonte ? this.fonte.state.doc.toString() : this.dados; }
  async save(o) { const ok = await super.save(o); if (ok && this.fonte) this.fonteTexto = this.fonte.state.doc.toString(); return ok; }
  async onClose() { this.fonte?.destroy(); (this.urls || []).forEach(u => URL.revokeObjectURL(u)); }
  imprimir() { try { this.frame.contentWindow.print(); } catch (e) { window.print(); } }
  onPaneMenu(m) { m.addItem({ title: "Imprimir", icon: "printer", onClick: () => this.imprimir() }); }
}
