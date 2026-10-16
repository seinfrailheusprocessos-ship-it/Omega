// Editor de texto simples (txt, json, csv bruto, código).
import { EditorView, keymap, drawSelection, highlightSpecialChars, lineNumbers, highlightActiveLineGutter } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab, undo, redo } from "@codemirror/commands";
import { searchKeymap, search, openSearchPanel, highlightSelectionMatches } from "@codemirror/search";
import { syntaxHighlighting, bracketMatching, LanguageDescription } from "@codemirror/language";
import { h, debounce } from "../util/dom.js";
import { FileView } from "./base.js";
import { realce } from "./markdown.js";
import { extname } from "../util/path.js";

const LANG = { json: () => import("@codemirror/lang-json").then(m => m.json()), js: () => import("@codemirror/lang-javascript").then(m => m.javascript()), css: () => import("@codemirror/lang-css").then(m => m.css()), xml: () => import("@codemirror/lang-xml").then(m => m.xml()), py: () => import("@codemirror/lang-python").then(m => m.python()), sql: () => import("@codemirror/lang-sql").then(m => m.sql()), html: () => import("@codemirror/lang-html").then(m => m.html()) };

export class TextView extends FileView {
  getViewType() { return "text"; }
  get autosave() { return true; }
  async onLoadFile(dados) {
    const texto = new TextDecoder("utf-8").decode(dados);
    this.textoSalvo = texto;
    const ext = extname(this.file.path);
    const codigo = ext !== "txt" && ext !== "log";
    this.sourceEl = h("div.markdown-source-view.mod-cm6.is-plaintext" + (codigo ? ".is-code" : "") + (this.app.config.larguraLegivel !== false && !codigo ? ".is-readable-line-width" : ""));
    this.sizer = h("div.cm-sizer");
    this.sourceEl.appendChild(this.sizer);
    this.contentEl.classList.add("markdown-view-content");
    this.contentEl.appendChild(this.sourceEl);
    const salvarAuto = debounce(() => this.save({ explicit: false, silencioso: true }), 1200);
    this.salvarAuto = salvarAuto;
    const extras = [];
    if (LANG[ext]) extras.push(await LANG[ext]());
    this.editor = new EditorView({
      parent: this.sizer,
      state: EditorState.create({
        doc: texto,
        extensions: [
          highlightSpecialChars(), history(), drawSelection(), bracketMatching(), highlightSelectionMatches(), search({ top: true }),
          codigo ? [lineNumbers(), highlightActiveLineGutter()] : [], EditorView.lineWrapping, syntaxHighlighting(realce), ...extras,
          EditorView.contentAttributes.of({ spellcheck: codigo ? "false" : "true", lang: "pt-BR" }),
          keymap.of([{ key: "Mod-s", run: () => { this.save({ explicit: true }); return true; } }, ...defaultKeymap, ...searchKeymap, ...historyKeymap, indentWithTab]),
          EditorView.updateListener.of(u => { if (u.docChanged) { this.setDirty(u.state.doc.toString() !== this.textoSalvo); salvarAuto(); this.app.atualizarStatus(); } }),
        ],
      }),
    });
  }
  focus() { setTimeout(() => this.editor?.focus(), 0); }
  async getSaveData() { return this.editor ? this.editor.state.doc.toString() : null; }
  async save(o = {}) {
    const t = this.editor?.state.doc.toString();
    const ok = await super.save(o);
    if (ok && t !== undefined) { this.textoSalvo = t; this.setDirty(this.editor.state.doc.toString() !== t); }
    return ok;
  }
  async onClose() { if (this.dirty) { this.salvarAuto?.cancel(); await super.save({ explicit: false, silencioso: true }); } this.editor?.destroy(); }
  async onExternalChange() {
    if (this.dirty) return super.onExternalChange();
    const novo = await this.app.vault.readText(this.file.path);
    this.ultimaVersaoLida = this.app.vault.get(this.file.path)?.mtime;
    if (novo === this.editor.state.doc.toString()) return;
    this.textoSalvo = novo;
    this.editor.dispatch({ changes: { from: 0, to: this.editor.state.doc.length, insert: novo } });
    this.setDirty(false);
  }
  destacarBusca(q) {
    const txt = this.editor.state.doc.toString();
    const dob = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const i = dob(txt).indexOf(dob(q));
    if (i >= 0) { this.editor.dispatch({ selection: { anchor: i, head: i + q.length }, effects: EditorView.scrollIntoView(i, { y: "center" }) }); this.editor.focus(); }
  }
  getStatus() {
    if (!this.editor) return [];
    const st = this.editor.state, l = st.doc.lineAt(st.selection.main.head);
    return [{ texto: `Linha ${l.number}, coluna ${st.selection.main.head - l.from + 1}` }, { texto: `${st.doc.lines} linhas` }];
  }
  getCommands() { return [{ id: "txt-buscar", nome: "Procurar no arquivo atual", fn: () => openSearchPanel(this.editor), tecla: "Ctrl+F" }]; }
  getMobileToolbar() { return [{ icon: "undo", title: "Desfazer", fn: () => undo(this.editor) }, { icon: "redo", title: "Refazer", fn: () => redo(this.editor) }]; }
}
