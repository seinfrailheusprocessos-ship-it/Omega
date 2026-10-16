// Janela de sugestões com busca aproximada (paleta de comandos, troca rápida de arquivo).
import { h, vazio } from "../util/dom.js";
import { icon } from "../util/icons.js";
import { dobrar } from "../../../shared/search-core.mjs";

/** busca aproximada: letras na ordem; pontua sequências e começos de palavra */
export function fuzzy(q, texto) {
  q = dobrar(q.trim()); if (!q) return { score: 0, ranges: [] };
  const t = dobrar(texto);
  const pos = t.indexOf(q);
  if (pos >= 0) {
    const inicioPalavra = pos === 0 || /[\s/_\-.(]/.test(t[pos - 1]);
    return { score: 1000 - pos + (inicioPalavra ? 200 : 0) - t.length * 0.1, ranges: [[pos, pos + q.length]] };
  }
  const termos = q.split(/\s+/).filter(Boolean);
  if (termos.length > 1) {
    let total = 0; const ranges = [];
    for (const termo of termos) { const r = fuzzy(termo, texto); if (!r) return null; total += r.score; ranges.push(...r.ranges); }
    ranges.sort((a, b) => a[0] - b[0]);
    const unidos = [];
    for (const r of ranges) { const u = unidos[unidos.length - 1]; if (u && r[0] <= u[1]) u[1] = Math.max(u[1], r[1]); else unidos.push([...r]); }
    return { score: total / termos.length - 50, ranges: unidos };
  }
  let i = 0, score = 0, seq = 0; const ranges = [];
  for (let j = 0; j < t.length && i < q.length; j++) {
    if (t[j] === q[i]) {
      const inicio = j === 0 || /[\s/_\-.(]/.test(t[j - 1]);
      seq++; score += 10 + seq * 5 + (inicio ? 15 : 0);
      if (ranges.length && ranges[ranges.length - 1][1] === j) ranges[ranges.length - 1][1] = j + 1; else ranges.push([j, j + 1]);
      i++;
    } else seq = 0;
  }
  if (i < q.length) return null;
  return { score: score - t.length * 0.5 - ranges.length * 8, ranges };
}

export function destacar(texto, ranges) {
  const frag = document.createDocumentFragment();
  let ult = 0;
  for (let [a, b] of ranges || []) {
    a = Math.max(a, ult);
    if (b <= a) continue;
    if (a > ult) frag.appendChild(document.createTextNode(texto.slice(ult, a)));
    frag.appendChild(h("span.suggestion-highlight", { text: texto.slice(a, b) }));
    ult = b;
  }
  frag.appendChild(document.createTextNode(texto.slice(ult)));
  return frag;
}

export class SuggestModal {
  constructor({ placeholder = "", instrucoes = [], vazioTexto = "Nenhum resultado.", limite = 80 } = {}) {
    this.limite = limite;
    this.vazioTexto = vazioTexto;
    this.containerEl = h("div.modal-container.mod-prompt");
    const bg = h("div.modal-bg");
    this.promptEl = h("div.prompt");
    this.inputEl = h("input.prompt-input", { type: "text", placeholder, spellcheck: "false", autocomplete: "off", enterkeyhint: "go" });
    this.resultsEl = h("div.prompt-results");
    this.promptEl.append(h("div.prompt-input-container", this.inputEl), this.resultsEl);
    if (instrucoes.length && !document.body.classList.contains("is-mobile")) {
      this.promptEl.appendChild(h("div.prompt-instructions", instrucoes.map(([cmd, txt]) => h("div.prompt-instruction", h("span.prompt-instruction-command", { text: cmd }), h("span", { text: txt })))));
    }
    this.containerEl.append(bg, this.promptEl);
    bg.addEventListener("click", () => this.close());
    this.sel = 0; this.itens = [];
    this.inputEl.addEventListener("input", () => this.atualizar());
    this.inputEl.addEventListener("keydown", e => this.tecla(e));
  }
  open() { document.body.appendChild(this.containerEl); this.atualizar(); setTimeout(() => this.inputEl.focus(), 10); return this; }
  close() { this.containerEl.remove(); this.onClose && this.onClose(); }
  tecla(e) {
    if (e.key === "Escape") { e.preventDefault(); this.close(); }
    else if (e.key === "ArrowDown" || (e.key === "n" && e.ctrlKey)) { e.preventDefault(); this.selecionar(this.sel + 1); }
    else if (e.key === "ArrowUp" || (e.key === "p" && e.ctrlKey)) { e.preventDefault(); this.selecionar(this.sel - 1); }
    else if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); this.escolher(this.itens[this.sel], e); }
  }
  selecionar(i) {
    const n = this.itens.length; if (!n) return;
    this.sel = (i + n) % n;
    [...this.resultsEl.children].forEach((c, k) => c.classList.toggle("is-selected", k === this.sel));
    this.resultsEl.children[this.sel]?.scrollIntoView({ block: "nearest" });
  }
  async atualizar() {
    const q = this.inputEl.value;
    const itens = await this.getSuggestions(q);
    if (q !== this.inputEl.value) return;
    this.itens = itens.slice(0, this.limite);
    vazio(this.resultsEl);
    if (!this.itens.length) { this.resultsEl.appendChild(h("div.suggestion-empty", { text: this.vazioTexto })); return; }
    this.itens.forEach((it, i) => {
      const el = h("div.suggestion-item");
      this.renderSuggestion(it, el);
      el.addEventListener("mousemove", () => { if (this.sel !== i) this.selecionar(i); });
      el.addEventListener("click", e => this.escolher(it, e));
      this.resultsEl.appendChild(el);
    });
    this.sel = 0; this.selecionar(0);
  }
  escolher(it, e) { if (!it) return; this.close(); this.onChooseSuggestion(it, e); }
  // a implementar: getSuggestions(q) → [], renderSuggestion(item, el), onChooseSuggestion(item, evt)
}

export function linhaSugestao(el, { titulo, ranges, nota, notaRanges, hotkeys = [], iconeFlair }) {
  const c = h("div.suggestion-content", h("div.suggestion-title", destacar(titulo, ranges)));
  if (nota) c.appendChild(h("div.suggestion-note", destacar(nota, notaRanges)));
  el.appendChild(c);
  const aux = h("div.suggestion-aux");
  for (const k of hotkeys) aux.appendChild(h("kbd.suggestion-hotkey", { text: k }));
  if (iconeFlair) aux.appendChild(h("span.suggestion-flair", icon(iconeFlair)));
  el.appendChild(aux);
}
