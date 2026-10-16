// Editor de notas Markdown com pré-visualização ao vivo e modo leitura.
import { EditorView, keymap, drawSelection, dropCursor, placeholder, highlightSpecialChars, rectangularSelection, crosshairCursor } from "@codemirror/view";
import { EditorState, Compartment, EditorSelection } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab, undo, redo, indentMore, indentLess } from "@codemirror/commands";
import { markdown, markdownLanguage, markdownKeymap } from "@codemirror/lang-markdown";
import { syntaxHighlighting, HighlightStyle, indentOnInput, bracketMatching, syntaxTree, LanguageDescription } from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches, search, openSearchPanel } from "@codemirror/search";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { tags as t } from "@lezer/highlight";
import MarkdownIt from "markdown-it";
import { h, vazio, debounce } from "../util/dom.js";
import { FileView } from "./base.js";
import { livePreview } from "./livepreview.js";
import { basename, dirname, join, extname, stem } from "../util/path.js";
import { notice } from "../ui/notice.js";

const linguagens = [
  LanguageDescription.of({ name: "JavaScript", alias: ["js", "javascript", "ts", "typescript"], load: () => import("@codemirror/lang-javascript").then(m => m.javascript()) }),
  LanguageDescription.of({ name: "JSON", alias: ["json"], load: () => import("@codemirror/lang-json").then(m => m.json()) }),
  LanguageDescription.of({ name: "CSS", alias: ["css"], load: () => import("@codemirror/lang-css").then(m => m.css()) }),
  LanguageDescription.of({ name: "HTML", alias: ["html", "xml"], load: () => import("@codemirror/lang-html").then(m => m.html()) }),
  LanguageDescription.of({ name: "Python", alias: ["py", "python"], load: () => import("@codemirror/lang-python").then(m => m.python()) }),
  LanguageDescription.of({ name: "SQL", alias: ["sql"], load: () => import("@codemirror/lang-sql").then(m => m.sql()) }),
];

export const realce = HighlightStyle.define([
  { tag: t.heading, class: "cm-header" },
  { tag: t.strong, class: "cm-strong" },
  { tag: t.emphasis, class: "cm-em" },
  { tag: t.strikethrough, class: "cm-strikethrough" },
  { tag: t.link, class: "cm-link" },
  { tag: t.url, class: "cm-url" },
  { tag: t.monospace, class: "cm-inline-code" },
  { tag: t.quote, class: "cm-quote" },
  { tag: t.processingInstruction, class: "cm-formatting" },
  { tag: t.contentSeparator, class: "cm-hr" },
  { tag: t.keyword, class: "cm-keyword" },
  { tag: [t.string, t.special(t.string)], class: "cm-string" },
  { tag: t.comment, class: "cm-comment" },
  { tag: [t.number, t.bool, t.null], class: "cm-number" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], class: "cm-def" },
  { tag: t.propertyName, class: "cm-property" },
  { tag: t.variableName, class: "cm-variable" },
  { tag: t.typeName, class: "cm-type" },
  { tag: t.operator, class: "cm-operator" },
  { tag: t.tagName, class: "cm-tag" },
  { tag: t.attributeName, class: "cm-attribute" },
  { tag: t.meta, class: "cm-meta" },
]);

// ---------- renderização para o modo leitura ----------
let mdit = null;
export function renderizador(app, origem) {
  if (!mdit) {
    mdit = new MarkdownIt({ html: true, linkify: true, breaks: false, typographer: false });
    // [[link interno]] e ![[imagem]]
    mdit.inline.ruler.before("link", "wikilink", (state, silent) => {
      const src = state.src.slice(state.pos);
      const m = /^(!)?\[\[([^\]|#]+)(#[^\]|]*)?(?:\|([^\]]*))?\]\]/.exec(src);
      if (!m) return false;
      if (!silent) {
        const tk = state.push("wikilink", "", 0);
        tk.meta = { embed: !!m[1], alvo: m[2], alias: m[4] };
      }
      state.pos += m[0].length;
      return true;
    });
    mdit.renderer.rules.wikilink = (tokens, i) => {
      const { embed, alvo, alias } = tokens[i].meta;
      const esc = s => mdit.utils.escapeHtml(s);
      if (embed) return `<span class="internal-embed image-embed" data-src="${esc(alvo)}" data-alt="${esc(alias || "")}"></span>`;
      return `<a class="internal-link" data-href="${esc(alvo)}" href="#">${esc(alias || alvo)}</a>`;
    };
    // ==marca==
    mdit.inline.ruler.before("emphasis", "mark", (state, silent) => {
      if (state.src.charCodeAt(state.pos) !== 0x3d || state.src.charCodeAt(state.pos + 1) !== 0x3d) return false;
      const fim = state.src.indexOf("==", state.pos + 2);
      if (fim < 0 || fim === state.pos + 2) return false;
      if (!silent) {
        state.push("mark_open", "mark", 1);
        const tk = state.push("text", "", 0); tk.content = state.src.slice(state.pos + 2, fim);
        state.push("mark_close", "mark", -1);
      }
      state.pos = fim + 2;
      return true;
    });
    // - [ ] tarefas
    mdit.core.ruler.after("inline", "tarefas", st => {
      for (let i = 2; i < st.tokens.length; i++) {
        const tk = st.tokens[i];
        if (tk.type !== "inline" || st.tokens[i - 1].type !== "paragraph_open" || st.tokens[i - 2].type !== "list_item_open") continue;
        const m = /^\[([ xX])\]\s/.exec(tk.content);
        if (!m) continue;
        tk.children[0].content = tk.children[0].content.replace(/^\[[ xX]\]\s/, "");
        const cb = new st.Token("html_inline", "", 0);
        cb.content = `<input type="checkbox" class="task-list-item-checkbox"${m[1] !== " " ? " checked" : ""} disabled> `;
        tk.children.unshift(cb);
        st.tokens[i - 2].attrJoin("class", "task-list-item" + (m[1] !== " " ? " is-checked" : ""));
      }
    });
  }
  return mdit;
}

function renderCallouts(el) {
  for (const bq of el.querySelectorAll("blockquote")) {
    const p = bq.firstElementChild;
    if (!p || p.tagName !== "P") continue;
    const m = /^\[!(\w+)\][+-]?\s*([^\n]*)/.exec(p.textContent);
    if (!m) continue;
    const tipo = m[1].toLowerCase();
    const div = document.createElement("div");
    div.className = "callout";
    div.dataset.callout = tipo;
    const tit = document.createElement("div");
    tit.className = "callout-title";
    tit.textContent = m[2] || tipo.charAt(0).toUpperCase() + tipo.slice(1);
    const corpo = document.createElement("div");
    corpo.className = "callout-content";
    p.innerHTML = p.innerHTML.replace(/^\[!\w+\][+-]?[^\n<]*(\n|<br>)?/, "");
    while (bq.firstChild) corpo.appendChild(bq.firstChild);
    div.append(tit, corpo);
    bq.replaceWith(div);
  }
}

export class MarkdownView extends FileView {
  getViewType() { return "markdown"; }
  get autosave() { return true; }

  async onLoadFile(dados) {
    const texto = new TextDecoder("utf-8").decode(dados);
    this.textoSalvo = texto;
    this.modo = localStorage.getItem("tinteiro.md.modo." + this.file.path) || this.app.config.modoPadraoMd || "editar";
    this.contentEl.classList.add("markdown-view-content");
    this.sourceEl = h("div.markdown-source-view.mod-cm6.is-live-preview.is-folding" + (this.app.config.larguraLegivel !== false ? ".is-readable-line-width" : ""));
    this.sizer = h("div.cm-sizer");
    this.tituloEl = h("div.inline-title", { contenteditable: "true", spellcheck: "false", tabindex: "-1", enterkeyhint: "done" });
    this.tituloEl.textContent = stem(this.file.path);
    this.editorHost = h("div.cm-host");
    this.sizer.append(this.tituloEl, this.editorHost);
    this.sourceEl.appendChild(this.sizer);
    this.leituraEl = h("div.markdown-reading-view.is-hidden", h("div.markdown-preview-view.markdown-rendered" + (this.app.config.larguraLegivel !== false ? ".is-readable-line-width" : ""), this.leituraSizer = h("div.markdown-preview-sizer.markdown-preview-section")));
    this.contentEl.append(this.sourceEl, this.leituraEl);
    this.configurarTitulo();

    const app = this.app;
    const salvarAuto = debounce(() => this.save({ explicit: false, silencioso: true }), 1200);
    this.salvarAuto = salvarAuto;
    const atualizarStatus = debounce(() => { app.atualizarStatus(); app.emit("outline-changed"); }, 400);
    this.lpCompartimento = new Compartment();
    const resolverImagem = async src => {
      if (/^(https?:|data:)/.test(src)) return src;
      const alvo = this.resolverLink(decodeURIComponent(src));
      if (!alvo) return null;
      const buf = await app.vault.read(alvo);
      const tipo = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp" }[extname(alvo)] || "application/octet-stream";
      const url = URL.createObjectURL(new Blob([buf], { type: tipo }));
      (this.urls ||= []).push(url);
      return url;
    };
    this.resolverImagem = resolverImagem;
    const opcoesLP = {
      resolverImagem,
      existe: nome => !!this.resolverLink(nome),
      abrirLink: (alvo, nova) => this.abrirLink(alvo, nova),
      buscarTag: tag => app.buscaGlobal(tag),
      precisaCtrl: () => false,
      renderTabela: txt => renderizador(app).render(txt),
      emCallout: (state, linha) => {
        for (let n = linha.number; n >= 1; n--) {
          const tx = state.doc.line(n).text;
          if (!/^>/.test(tx)) return null;
          const m = /^>\s*\[!(\w+)\]/.exec(tx);
          if (m) return m[1].toLowerCase();
        }
        return null;
      },
    };
    const state = EditorState.create({
      doc: texto,
      extensions: [
        highlightSpecialChars(), history(), drawSelection(), dropCursor(), EditorState.allowMultipleSelections.of(true),
        indentOnInput(), bracketMatching(), closeBrackets(), rectangularSelection(), crosshairCursor(), highlightSelectionMatches(),
        search({ top: true }),
        markdown({ base: markdownLanguage, codeLanguages: linguagens, addKeymap: true }),
        syntaxHighlighting(realce),
        EditorView.lineWrapping,
        placeholder(""),
        EditorView.contentAttributes.of({ spellcheck: app.config.verificarOrtografia !== false ? "true" : "false", autocorrect: "on", autocapitalize: "sentences", lang: "pt-BR" }),
        this.lpCompartimento.of(livePreview(opcoesLP)),
        keymap.of([
          { key: "Mod-b", run: v => this.envolver(v, "**") },
          { key: "Mod-i", run: v => this.envolver(v, "*") },
          { key: "Mod-k", run: v => this.inserirLink(v) },
          { key: "Mod-e", run: () => { this.alternarModo(); return true; } },
          { key: "Mod-Enter", run: v => this.alternarTarefa(v) },
          { key: "Mod-s", run: () => { this.save({ explicit: true }); return true; } },
          ...closeBracketsKeymap, ...markdownKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, indentWithTab,
        ]),
        EditorView.updateListener.of(u => {
          if (u.docChanged) {
            this.setDirty(u.state.doc.toString() !== this.textoSalvo);
            salvarAuto();
            atualizarStatus();
          } else if (u.selectionSet) atualizarStatus();
        }),
        EditorView.domEventHandlers({
          paste: (e, v) => this.colar(e, v),
          drop: (e, v) => this.soltar(e, v),
        }),
      ],
    });
    this.editor = new EditorView({ state, parent: this.editorHost });
    if (this.modo === "ler") this.mostrarLeitura(true);
    this.botaoModo = this.addAction(this.modo === "ler" ? "pencil" : "book-open", this.modo === "ler" ? "Editar (Ctrl+E)" : "Modo leitura (Ctrl+E)", () => this.alternarModo());
    app.emit("outline-changed");
  }

  configurarTitulo() {
    const t = this.tituloEl;
    t.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); this.editor?.focus(); this.editor?.dispatch({ selection: { anchor: 0 } }); }
      if (e.key === "ArrowDown") { e.preventDefault(); this.editor?.focus(); }
    });
    t.addEventListener("blur", async () => {
      const novo = t.textContent.replace(/[\\/:*?"<>|\n]/g, "").trim();
      if (!novo || novo === stem(this.file.path)) { t.textContent = stem(this.file.path); return; }
      const destino = join(dirname(this.file.path), novo + ".md");
      if (this.app.vault.exists(destino)) { notice("Já existe uma nota com esse nome."); t.textContent = stem(this.file.path); return; }
      await this.app.moverPara(this.file.path, destino);
    });
    t.addEventListener("paste", e => { e.preventDefault(); document.execCommand("insertText", false, (e.clipboardData.getData("text/plain") || "").replace(/\n/g, " ")); });
  }

  focarTitulo() {
    setTimeout(() => {
      this.tituloEl.focus();
      const r = document.createRange(); r.selectNodeContents(this.tituloEl);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    }, 50);
  }

  onRename(novo) { super.onRename(novo); if (this.tituloEl && document.activeElement !== this.tituloEl) this.tituloEl.textContent = stem(novo.path); }

  getState() { return { file: this.file.path, modo: this.modo, cursor: this.editor?.state.selection.main.head || 0, rolagem: this.sourceEl?.scrollTop || 0 }; }
  async setState(s) {
    if (!this.editor || !s) return;
    if (s.cursor && s.cursor <= this.editor.state.doc.length) this.editor.dispatch({ selection: { anchor: s.cursor } });
    if (s.rolagem) requestAnimationFrame(() => { this.sourceEl.scrollTop = s.rolagem; });
  }

  focus() { if (this.modo !== "ler") setTimeout(() => this.editor?.focus(), 0); }

  async getSaveData() { return this.editor ? this.editor.state.doc.toString() : null; }
  async save(o = {}) {
    const texto = this.editor?.state.doc.toString();
    const ok = await super.save(o);
    if (ok && texto !== undefined) { this.textoSalvo = texto; this.setDirty(this.editor.state.doc.toString() !== texto); }
    return ok;
  }

  async onClose() {
    if (this.dirty) { this.salvarAuto?.cancel(); await super.save({ explicit: false, silencioso: true }); }
    this.editor?.destroy();
    (this.urls || []).forEach(u => URL.revokeObjectURL(u));
  }

  async onExternalChange() {
    if (this.dirty) return super.onExternalChange();
    const novo = await this.app.vault.readText(this.file.path);
    this.ultimaVersaoLida = this.app.vault.get(this.file.path)?.mtime;
    if (novo === this.editor.state.doc.toString()) return;
    const sel = this.editor.state.selection.main.head;
    this.textoSalvo = novo;
    this.editor.dispatch({ changes: { from: 0, to: this.editor.state.doc.length, insert: novo }, selection: { anchor: Math.min(sel, novo.length) } });
    this.setDirty(false);
    if (this.modo === "ler") this.mostrarLeitura(true);
  }

  // ---------- links ----------
  resolverLink(alvo) {
    alvo = alvo.split("#")[0].trim();
    if (!alvo) return this.file.path;
    const v = this.app.vault;
    const candidatos = [alvo, alvo + ".md", join(dirname(this.file.path), alvo), join(dirname(this.file.path), alvo + ".md")];
    for (const c of candidatos) if (v.get(c)?.type === "file") return c;
    const nome = basename(alvo).toLowerCase();
    const achado = v.files().find(f => f.name.toLowerCase() === nome || (f.ext === "md" && f.basename.toLowerCase() === nome));
    return achado ? achado.path : null;
  }

  async abrirLink(alvo, novaAba) {
    if (/^[a-z][\w+.-]*:/i.test(alvo)) { window.open(alvo, "_blank", "noopener"); return; }
    const p = this.resolverLink(decodeURIComponent(alvo));
    if (p) return this.app.abrirArquivo(p, { novaAba });
    // link para nota que não existe: cria (como no app de referência)
    const novo = join(dirname(this.file.path), alvo.replace(/[\\:*?"<>|]/g, "") + (extname(alvo) ? "" : ".md"));
    await this.app.vault.create(novo, "");
    this.app.abrirArquivo(novo, { novaAba });
  }

  // ---------- comandos de formatação ----------
  envolver(v, marca) {
    const tr = v.state.changeByRange(r => {
      const txt = v.state.sliceDoc(r.from, r.to);
      const antes = v.state.sliceDoc(r.from - marca.length, r.from), depois = v.state.sliceDoc(r.to, r.to + marca.length);
      if (antes === marca && depois === marca) return { changes: [{ from: r.from - marca.length, to: r.from }, { from: r.to, to: r.to + marca.length }], range: EditorSelection.range(r.from - marca.length, r.to - marca.length) };
      return { changes: { from: r.from, to: r.to, insert: marca + txt + marca }, range: EditorSelection.range(r.from + marca.length, r.to + marca.length) };
    });
    v.dispatch(tr); v.focus();
    return true;
  }
  inserirLink(v) {
    const r = v.state.selection.main;
    const txt = v.state.sliceDoc(r.from, r.to);
    v.dispatch({ changes: { from: r.from, to: r.to, insert: `[${txt}]()` }, selection: { anchor: r.from + txt.length + 3 } });
    v.focus();
    return true;
  }
  alternarTarefa(v) {
    const l = v.state.doc.lineAt(v.state.selection.main.head);
    const m = /^(\s*)([-*+] )?(\[[ xX]\] )?/.exec(l.text);
    let novo;
    if (m[3]) novo = m[1] + (m[2] || "- ") + (m[3][1] === " " ? "[x] " : "[ ] ");
    else novo = m[1] + (m[2] || "- ") + "[ ] ";
    v.dispatch({ changes: { from: l.from, to: l.from + m[0].length, insert: novo } });
    return true;
  }
  prefixoLinha(v, prefixo) {
    const l = v.state.doc.lineAt(v.state.selection.main.head);
    const m = /^(#{1,6} |[-*+] (\[[ xX]\] )?|\d+\. |> )?/.exec(l.text);
    const atual = m[0] || "";
    const novo = atual === prefixo ? "" : prefixo;
    v.dispatch({ changes: { from: l.from, to: l.from + atual.length, insert: novo } });
    v.focus();
  }

  colar(e, v) {
    const arqs = [...(e.clipboardData?.files || [])];
    if (!arqs.length) return false;
    e.preventDefault();
    this.anexarArquivos(arqs, v, v.state.selection.main.head);
    return true;
  }
  soltar(e, v) {
    const p = e.dataTransfer?.getData("tinteiro/path");
    const pos = v.posAtCoords({ x: e.clientX, y: e.clientY }) ?? v.state.selection.main.head;
    if (p) {
      e.preventDefault();
      const ext = extname(p);
      const txt = ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext) ? `![[${basename(p)}]]` : `[[${ext === "md" ? stem(p) : basename(p)}]]`;
      v.dispatch({ changes: { from: pos, insert: txt } });
      return true;
    }
    const arqs = [...(e.dataTransfer?.files || [])];
    if (!arqs.length) return false;
    e.preventDefault();
    this.anexarArquivos(arqs, v, pos);
    return true;
  }
  async anexarArquivos(arqs, v, pos) {
    const pasta = dirname(this.file.path);
    let ins = "";
    for (const f of arqs) {
      const nome = f.name && f.name !== "image.png" ? f.name : `Colado ${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}.png`;
      const i = nome.lastIndexOf(".");
      const p = this.app.vault.nomeLivre(pasta, i > 0 ? nome.slice(0, i) : nome, i > 0 ? nome.slice(i + 1) : "");
      await this.app.vault.create(p, new Uint8Array(await f.arrayBuffer()));
      const ext = extname(p);
      ins += (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext) ? `![[${basename(p)}]]` : `[[${basename(p)}]]`) + "\n";
    }
    v.dispatch({ changes: { from: pos, insert: ins } });
  }

  // ---------- modo leitura ----------
  alternarModo() {
    this.modo = this.modo === "ler" ? "editar" : "ler";
    localStorage.setItem("tinteiro.md.modo." + this.file.path, this.modo);
    this.mostrarLeitura(this.modo === "ler");
    vazio(this.botaoModo).appendChild((await_icon(this.modo === "ler" ? "pencil" : "book-open")));
    this.botaoModo.title = this.modo === "ler" ? "Editar (Ctrl+E)" : "Modo leitura (Ctrl+E)";
    if (this.modo !== "ler") this.editor.focus();
  }

  mostrarLeitura(ler) {
    this.sourceEl.classList.toggle("is-hidden", ler);
    this.leituraEl.classList.toggle("is-hidden", !ler);
    if (!ler) return;
    const md = renderizador(this.app);
    const texto = this.editor.state.doc.toString();
    const corpo = texto.replace(/^---\n[\s\S]*?\n---\n?/, "");
    this.leituraSizer.innerHTML = `<div class="inline-title">${md.utils.escapeHtml(stem(this.file.path))}</div>` + md.render(corpo);
    renderCallouts(this.leituraSizer);
    for (const a of this.leituraSizer.querySelectorAll("a")) {
      a.addEventListener("click", e => {
        e.preventDefault();
        const alvo = a.dataset.href || a.getAttribute("href");
        if (alvo) this.abrirLink(alvo, e.ctrlKey || e.metaKey);
      });
    }
    for (const sp of this.leituraSizer.querySelectorAll(".internal-embed")) {
      const img = document.createElement("img");
      this.resolverImagem(sp.dataset.src).then(u => { if (u) img.src = u; });
      sp.appendChild(img);
    }
    for (const img of this.leituraSizer.querySelectorAll("img:not(.internal-embed img)")) {
      const src = img.getAttribute("src");
      if (src && !/^(https?:|data:|blob:)/.test(src)) this.resolverImagem(src).then(u => { if (u) img.src = u; });
    }
  }

  // ---------- painéis ----------
  getOutline() {
    if (!this.editor) return [];
    const out = [];
    syntaxTree(this.editor.state).iterate({
      enter: n => {
        const m = /^(ATX|Setext)Heading(\d)$/.exec(n.name);
        if (m) {
          const texto = this.editor.state.sliceDoc(n.from, n.to).replace(/^#+\s*/, "").replace(/\s*#*$/, "").split("\n")[0];
          out.push({ nivel: +m[2], texto: texto || "(sem título)", pos: n.from });
        }
      },
    });
    return out;
  }
  revealOutline(it) {
    if (this.modo === "ler") { this.alternarModo(); }
    this.editor.dispatch({ selection: { anchor: it.pos }, effects: EditorView.scrollIntoView(it.pos, { y: "start", yMargin: 60 }) });
    this.editor.focus();
  }

  destacarBusca(q) {
    const txt = this.editor.state.doc.toString();
    const dob = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const i = dob(txt).indexOf(dob(q));
    if (i >= 0) {
      if (this.modo === "ler") this.alternarModo();
      this.editor.dispatch({ selection: { anchor: i, head: i + q.length }, effects: EditorView.scrollIntoView(i, { y: "center" }) });
      this.editor.focus();
    }
  }

  getStatus() {
    if (!this.editor) return [];
    const txt = this.editor.state.doc.toString();
    const sel = this.editor.state.selection.main;
    const alvo = sel.empty ? txt : this.editor.state.sliceDoc(sel.from, sel.to);
    const palavras = (alvo.match(/[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu) || []).length;
    const fmt = n => n.toLocaleString("pt-BR");
    return [{ texto: `${fmt(palavras)} ${palavras === 1 ? "palavra" : "palavras"}` }, { texto: `${fmt(alvo.length)} ${alvo.length === 1 ? "caractere" : "caracteres"}` }];
  }

  getCommands() {
    const v = () => this.editor;
    return [
      { id: "md-modo", nome: "Alternar modo leitura/edição", fn: () => this.alternarModo(), tecla: "Ctrl+E" },
      { id: "md-negrito", nome: "Negrito", fn: () => this.envolver(v(), "**"), tecla: "Ctrl+B" },
      { id: "md-italico", nome: "Itálico", fn: () => this.envolver(v(), "*"), tecla: "Ctrl+I" },
      { id: "md-tarefa", nome: "Alternar item de tarefa", fn: () => this.alternarTarefa(v()), tecla: "Ctrl+Enter" },
      { id: "md-buscar", nome: "Procurar no arquivo atual", fn: () => { openSearchPanel(v()); }, tecla: "Ctrl+F" },
    ];
  }

  onPaneMenu(m) {
    m.addItem({ title: this.modo === "ler" ? "Editar" : "Modo leitura", icon: this.modo === "ler" ? "pencil" : "book-open", onClick: () => this.alternarModo() });
    m.addItem({ title: "Procurar no arquivo…", icon: "search", onClick: () => openSearchPanel(this.editor) });
    m.addItem({ title: "Imprimir / salvar em PDF", icon: "printer", onClick: () => this.imprimir() });
  }

  imprimir() {
    const md = renderizador(this.app);
    const html = md.render(this.editor.state.doc.toString());
    imprimirHtml(`<h1>${md.utils.escapeHtml(stem(this.file.path))}</h1>` + html, stem(this.file.path));
  }

  getMobileToolbar() {
    const v = () => this.editor;
    return [
      { icon: "undo", title: "Desfazer", fn: () => undo(v()) },
      { icon: "redo", title: "Refazer", fn: () => redo(v()) },
      { icon: "bold", title: "Negrito", fn: () => this.envolver(v(), "**") },
      { icon: "italic", title: "Itálico", fn: () => this.envolver(v(), "*") },
      { icon: "h1", title: "Título", fn: () => this.prefixoLinha(v(), "# ") },
      { icon: "h2", title: "Subtítulo", fn: () => this.prefixoLinha(v(), "## ") },
      { icon: "list", title: "Lista", fn: () => this.prefixoLinha(v(), "- ") },
      { icon: "list-checks", title: "Tarefa", fn: () => this.alternarTarefa(v()) },
      { icon: "link", title: "Link", fn: () => this.inserirLink(v()) },
      { icon: "quote", title: "Citação", fn: () => this.prefixoLinha(v(), "> ") },
      { icon: "indent", title: "Aumentar recuo", fn: () => indentMore(v()) },
      { icon: "outdent", title: "Diminuir recuo", fn: () => indentLess(v()) },
    ];
  }
}

import { icon as await_icon } from "../util/icons.js";

export function imprimirHtml(corpo, titulo) {
  const fr = document.createElement("iframe");
  fr.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
  document.body.appendChild(fr);
  const d = fr.contentDocument;
  d.open();
  d.write(`<!doctype html><html><head><meta charset="utf-8"><title>${titulo}</title><style>body{font-family:-apple-system,"Segoe UI",Roboto,sans-serif;font-size:12pt;line-height:1.5;color:#000;margin:2cm}h1,h2,h3{line-height:1.2}table{border-collapse:collapse}td,th{border:1px solid #999;padding:4px 8px}code,pre{font-family:Consolas,monospace;background:#f3f3f3}img{max-width:100%}blockquote{border-left:3px solid #999;margin-left:0;padding-left:12px;color:#444}</style></head><body>${corpo}</body></html>`);
  d.close();
  setTimeout(() => { fr.contentWindow.focus(); fr.contentWindow.print(); setTimeout(() => fr.remove(), 1000); }, 300);
}
