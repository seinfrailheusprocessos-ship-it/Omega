// Pré-visualização ao vivo para Markdown no CodeMirror 6: esconde a marcação fora da linha do cursor.
import { ViewPlugin, Decoration, WidgetType, EditorView } from "@codemirror/view";
import { StateField, RangeSetBuilder } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

const esconder = Decoration.replace({});

class BulletWidget extends WidgetType {
  constructor(nivel) { super(); this.nivel = nivel; }
  eq(o) { return o.nivel === this.nivel; }
  toDOM() { const s = document.createElement("span"); s.className = "list-bullet"; s.textContent = "•"; return s; }
}
class CheckboxWidget extends WidgetType {
  constructor(marcado, pos) { super(); this.marcado = marcado; this.pos = pos; }
  eq(o) { return o.marcado === this.marcado && o.pos === this.pos; }
  toDOM(view) {
    const c = document.createElement("input");
    c.type = "checkbox"; c.className = "task-list-item-checkbox"; c.checked = this.marcado;
    c.addEventListener("mousedown", e => e.preventDefault());
    c.addEventListener("click", e => {
      e.preventDefault();
      const novo = this.marcado ? " " : "x";
      view.dispatch({ changes: { from: this.pos + 1, to: this.pos + 2, insert: novo } });
    });
    return c;
  }
  ignoreEvent() { return false; }
}
class HrWidget extends WidgetType {
  eq() { return true; }
  toDOM() { const d = document.createElement("hr"); d.className = "cm-hr-widget"; return d; }
}
class ImagemWidget extends WidgetType {
  constructor(src, alt, resolver) { super(); this.src = src; this.alt = alt; this.resolver = resolver; }
  eq(o) { return o.src === this.src && o.alt === this.alt; }
  toDOM() {
    const w = document.createElement("span");
    w.className = "image-embed";
    const img = document.createElement("img");
    img.alt = this.alt || "";
    const m = /\|(\d+)(?:x(\d+))?$/.exec(this.alt || "");
    if (m) img.style.width = m[1] + "px";
    Promise.resolve(this.resolver(this.src)).then(u => { if (u) img.src = u; else w.textContent = `Imagem não encontrada: ${this.src}`; });
    w.appendChild(img);
    return w;
  }
}
class TabelaWidget extends WidgetType {
  constructor(texto, inicio, render) { super(); this.texto = texto; this.inicio = inicio; this.render = render; }
  eq(o) { return o.texto === this.texto; }
  toDOM(view) {
    const d = document.createElement("div");
    d.className = "cm-table-widget markdown-rendered";
    d.innerHTML = this.render(this.texto);
    d.addEventListener("mousedown", e => { e.preventDefault(); view.dispatch({ selection: { anchor: this.inicio + 1 } }); view.focus(); });
    return d;
  }
  ignoreEvent() { return false; }
}
class CalloutTitulo extends WidgetType {
  constructor(tipo, titulo) { super(); this.tipo = tipo; this.titulo = titulo; }
  eq(o) { return o.tipo === this.tipo && o.titulo === this.titulo; }
  toDOM() {
    const s = document.createElement("span");
    s.className = "callout-title-widget";
    s.textContent = this.titulo || (this.tipo.charAt(0).toUpperCase() + this.tipo.slice(1));
    return s;
  }
}

function cursorEm(state, from, to) {
  for (const r of state.selection.ranges) if (r.from <= to && r.to >= from) return true;
  return false;
}
function linhasDoCursor(state) {
  const s = new Set();
  for (const r of state.selection.ranges) {
    const a = state.doc.lineAt(r.from).number, b = state.doc.lineAt(r.to).number;
    for (let i = a; i <= b; i++) s.add(i);
  }
  return s;
}

/** decorações em linha (marcas escondidas, estilos) — recalculadas para a parte visível */
function montarDecoracoes(view, opcoes) {
  const { state } = view;
  const deco = [];
  const linhasCur = linhasDoCursor(state);
  const focado = view.hasFocus;
  const naLinha = pos => focado && linhasCur.has(state.doc.lineAt(pos).number);
  const add = (from, to, d) => { if (from < to || d.point) deco.push(d.range(from, to)); };
  const linhaClasse = (pos, cls) => { const l = state.doc.lineAt(pos); deco.push(Decoration.line({ class: cls }).range(l.from)); };

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from, to,
      enter: no => {
        const n = no.name;
        const m = /^ATXHeading(\d)$/.exec(n) || /^SetextHeading(\d)$/.exec(n);
        if (m) {
          linhaClasse(no.from, `HyperMD-header HyperMD-header-${m[1]} cm-line-heading`);
          add(no.from, no.to, Decoration.mark({ class: `cm-header cm-header-${m[1]}` }));
          return;
        }
        if (n === "HeaderMark") {
          if (!naLinha(no.from)) {
            const fim = Math.min(no.to + 1, state.doc.lineAt(no.from).to);
            const l = state.doc.lineAt(no.from);
            if (no.from === l.from) add(no.from, state.doc.sliceString(no.to, no.to + 1) === " " ? fim : no.to, esconder);
            else add(no.from, no.to, esconder);
          } else add(no.from, no.to, Decoration.mark({ class: "cm-formatting cm-formatting-header" }));
          return;
        }
        if (n === "StrongEmphasis") add(no.from, no.to, Decoration.mark({ class: "cm-strong" }));
        else if (n === "Emphasis") add(no.from, no.to, Decoration.mark({ class: "cm-em" }));
        else if (n === "Strikethrough") add(no.from, no.to, Decoration.mark({ class: "cm-strikethrough" }));
        else if (n === "InlineCode") {
          add(no.from, no.to, Decoration.mark({ class: "cm-inline-code" }));
        }
        if (n === "EmphasisMark" || n === "StrikethroughMark" || (n === "CodeMark" && no.node.parent?.name === "InlineCode")) {
          const pai = no.node.parent;
          if (!cursorEm(state, pai.from, pai.to) || !focado) add(no.from, no.to, esconder);
          else add(no.from, no.to, Decoration.mark({ class: "cm-formatting" }));
          return;
        }
        if (n === "Link" || n === "Image") {
          const dentro = focado && cursorEm(state, no.from, no.to);
          const texto = state.doc.sliceString(no.from, no.to);
          const mm = /^!?\[([^\]]*)\]\(([^)\s]*)(?:\s+"[^"]*")?\)$/.exec(texto);
          if (n === "Image" && mm && !dentro) {
            add(no.from, no.to, Decoration.replace({ widget: new ImagemWidget(mm[2], mm[1], opcoes.resolverImagem) }));
            return false;
          }
          if (n === "Link" && mm && !dentro) {
            const ini = no.from + 1, fim = ini + mm[1].length;
            add(no.from, ini, esconder);
            add(ini, fim, Decoration.mark({ class: "cm-link cm-hmd-internal-link", attributes: { "data-href": mm[2] } }));
            add(fim, no.to, esconder);
            return false;
          }
          if (dentro) add(no.from, no.to, Decoration.mark({ class: "cm-link-source" }));
          return;
        }
        if (n === "URL" && no.node.parent?.name !== "Link" && no.node.parent?.name !== "Image") {
          add(no.from, no.to, Decoration.mark({ class: "cm-url cm-link", attributes: { "data-href": state.doc.sliceString(no.from, no.to) } }));
        }
        if (n === "Blockquote") {
          for (let p = no.from; p <= no.to;) {
            const l = state.doc.lineAt(p);
            const t = l.text;
            const cal = /^>\s*\[!(\w+)\][+-]?\s*(.*)$/.exec(t);
            linhaClasse(l.from, "HyperMD-quote HyperMD-quote-1 cm-blockquote-line" + (cal || opcoes.emCallout(state, l) ? " cm-callout-line cm-callout-" + ((cal && cal[1].toLowerCase()) || opcoes.emCallout(state, l)) : ""));
            if (cal && !naLinha(l.from)) {
              add(l.from, l.to, Decoration.replace({ widget: new CalloutTitulo(cal[1].toLowerCase(), cal[2]) }));
            }
            p = l.to + 1;
          }
        }
        if (n === "QuoteMark") {
          if (!naLinha(no.from)) {
            const depois = state.doc.sliceString(no.to, no.to + 1) === " " ? no.to + 1 : no.to;
            add(no.from, depois, esconder);
          } else add(no.from, no.to, Decoration.mark({ class: "cm-formatting cm-formatting-quote" }));
          return;
        }
        if (n === "ListMark") {
          const l = state.doc.lineAt(no.from);
          const indent = no.from - l.from;
          const texto = state.doc.sliceString(no.from, no.to);
          const tarefa = /^\s*\[[ xX]\]/.test(state.doc.sliceString(no.to + 1, no.to + 5));
          linhaClasse(l.from, "HyperMD-list-line HyperMD-list-line-" + (Math.floor(indent / 2) + 1) + (tarefa ? " HyperMD-task-line" : ""));
          if (/^[-*+]$/.test(texto)) {
            if (tarefa) { if (!cursorEm(state, no.from, no.to + 5) || !focado) add(no.from, no.to + 1, esconder); }
            else if (!naLinha(no.from) || !cursorEm(state, no.from, no.to + 1)) add(no.from, no.to, Decoration.replace({ widget: new BulletWidget(indent) }));
            else add(no.from, no.to, Decoration.mark({ class: "cm-formatting-list" }));
          } else add(no.from, no.to, Decoration.mark({ class: "cm-formatting-list cm-formatting-list-ol" }));
          return;
        }
        if (n === "TaskMarker") {
          const marcado = /x/i.test(state.doc.sliceString(no.from, no.to));
          const l = state.doc.lineAt(no.from);
          if (marcado) deco.push(Decoration.line({ class: "is-checked" }).range(l.from));
          if (!cursorEm(state, no.from, no.to) || !focado) add(no.from, no.to, Decoration.replace({ widget: new CheckboxWidget(marcado, no.from) }));
          return;
        }
        if (n === "HorizontalRule") {
          if (!naLinha(no.from)) add(no.from, no.to, Decoration.replace({ widget: new HrWidget() }));
          return;
        }
        if (n === "FencedCode" || n === "CodeBlock") {
          const ini = state.doc.lineAt(no.from).number, fim = state.doc.lineAt(no.to).number;
          const dentro = focado && cursorEm(state, no.from, no.to);
          for (let i = ini; i <= fim; i++) {
            const l = state.doc.line(i);
            let cls = "HyperMD-codeblock HyperMD-codeblock-bg cm-codeblock-line";
            if (i === ini) cls += " HyperMD-codeblock-begin";
            if (i === fim) cls += " HyperMD-codeblock-end";
            deco.push(Decoration.line({ class: cls }).range(l.from));
            if (n === "FencedCode" && (i === ini || i === fim) && !dentro) {
              if (i === ini) {
                const lang = l.text.replace(/^\s*(```+|~~~+)/, "").trim();
                add(l.from, l.to, Decoration.replace({ widget: new (class extends WidgetType { eq(o) { return o.l === lang; } get l() { return lang; } toDOM() { const s = document.createElement("span"); s.className = "code-block-flair"; s.textContent = lang; return s; } })() }));
              } else add(l.from, l.to, esconder);
            }
          }
          return false;
        }
        if (n === "Table" ) return false; // tratado no campo de blocos
        if (n === "Highlight") add(no.from, no.to, Decoration.mark({ class: "cm-highlight" }));
      },
    });
    // ==marca==, [[links internos]], #etiquetas (linha a linha, fora de código)
    let pos = from;
    while (pos <= to) {
      const l = state.doc.lineAt(pos);
      const t = l.text;
      const arvore = syntaxTree(state);
      const emCodigo = p => { const nd = arvore.resolveInner(p, 1); for (let x = nd; x; x = x.parent) if (/Code|Comment|HTML/.test(x.name)) return true; return false; };
      for (const m of t.matchAll(/(!)?\[\[([^\]|#]+)(#[^\]|]*)?(?:\|([^\]]*))?\]\]/g)) {
        const a = l.from + m.index, b = a + m[0].length;
        if (emCodigo(a)) continue;
        const dentro = focado && cursorEm(state, a, b);
        if (m[1]) {
          if (!dentro) add(a, b, Decoration.replace({ widget: new ImagemWidget(m[2], m[4] || "", opcoes.resolverImagem) }));
          continue;
        }
        if (dentro) { add(a, b, Decoration.mark({ class: "cm-hmd-internal-link cm-link-source" })); continue; }
        const visivelIni = m[4] !== undefined ? b - 2 - m[4].length : a + 2;
        add(a, visivelIni, esconder);
        add(visivelIni, b - 2, Decoration.mark({ class: "cm-hmd-internal-link cm-wikilink" + (opcoes.existe(m[2]) ? "" : " is-unresolved"), attributes: { "data-wikilink": m[2] } }));
        add(b - 2, b, esconder);
      }
      for (const m of t.matchAll(/==([^=\n]+)==/g)) {
        const a = l.from + m.index, b = a + m[0].length;
        if (emCodigo(a)) continue;
        add(a + 2, b - 2, Decoration.mark({ class: "cm-highlight" }));
        if (!(focado && cursorEm(state, a, b))) { add(a, a + 2, esconder); add(b - 2, b, esconder); }
      }
      for (const m of t.matchAll(/(^|\s)(#[\p{L}\p{N}_/-]+)/gu)) {
        const a = l.from + m.index + m[1].length, b = a + m[2].length;
        if (/^#+$/.test(m[2]) || emCodigo(a) || /^#{1,6}\s/.test(t)) continue;
        add(a, b, Decoration.mark({ class: "cm-hashtag", attributes: { "data-tag": m[2] } }));
      }
      pos = l.to + 1;
    }
  }
  deco.sort((x, y) => x.from - y.from || x.value.startSide - y.value.startSide);
  const b = new RangeSetBuilder();
  let ultimo = -1;
  for (const d of deco) {
    // evita sobreposição de substituições
    if (d.value.spec?.widget === undefined && d.value === esconder && d.from < ultimo) continue;
    try { b.add(d.from, d.to, d.value); } catch (e) {}
    if (d.value === esconder || d.value.spec?.widget) ultimo = Math.max(ultimo, d.to);
  }
  return b.finish();
}

export function livePreview(opcoes) {
  const plugin = ViewPlugin.fromClass(class {
    constructor(view) { this.decorations = montarDecoracoes(view, opcoes); }
    update(u) {
      if (u.docChanged || u.viewportChanged || u.selectionSet || u.focusChanged || u.transactions.some(t => t.reconfigured) || syntaxTree(u.startState) !== syntaxTree(u.state))
        this.decorations = montarDecoracoes(u.view, opcoes);
    }
  }, {
    decorations: v => v.decorations,
    eventHandlers: {
      mousedown(e, view) {
        const alvo = e.target.closest?.("[data-wikilink],[data-href],[data-tag]");
        if (!alvo) return false;
        const seguir = !opcoes.precisaCtrl() || e.ctrlKey || e.metaKey;
        if (!seguir) return false;
        if (alvo.dataset.wikilink) { e.preventDefault(); opcoes.abrirLink(alvo.dataset.wikilink, e.ctrlKey || e.metaKey); return true; }
        if (alvo.dataset.href) { e.preventDefault(); opcoes.abrirLink(alvo.dataset.href, e.ctrlKey || e.metaKey); return true; }
        if (alvo.dataset.tag) { e.preventDefault(); opcoes.buscarTag(alvo.dataset.tag); return true; }
        return false;
      },
    },
  });

  // tabelas como blocos renderizados (precisam vir de um StateField)
  const tabelas = StateField.define({
    create: st => blocos(st, false),
    update: (v, tr) => (tr.docChanged || tr.selection || tr.effects.length ? blocos(tr.state, true) : v),
    provide: f => EditorView.decorations.from(f),
  });
  function blocos(state) {
    const b = new RangeSetBuilder();
    syntaxTree(state).iterate({
      enter: no => {
        if (no.name !== "Table") return;
        if (cursorEm(state, no.from, no.to)) return false;
        const ini = state.doc.lineAt(no.from).from, fim = state.doc.lineAt(no.to).to;
        b.add(ini, fim, Decoration.replace({ widget: new TabelaWidget(state.doc.sliceString(ini, fim), ini, opcoes.renderTabela), block: true }));
        return false;
      },
    });
    return b.finish();
  }
  return [plugin, tabelas];
}
