// Estilos da planilha (styles.xml + cores do tema): leitura para desenhar e criação de novos estilos
// sempre ACRESCENTANDO ao final das listas (nunca reordena os existentes).
import { lerXml, gravarXml, filho, filhos, criar, inserirNaOrdem, NS, ORDEM_ESTILOS, ORDEM_FONTE } from "./xml.js";
import { FORMATOS_EMBUTIDOS } from "./formatos.js";

const PALETA_INDEXADA = ["000000", "FFFFFF", "FF0000", "00FF00", "0000FF", "FFFF00", "FF00FF", "00FFFF", "000000", "FFFFFF", "FF0000", "00FF00", "0000FF",
  "FFFF00", "FF00FF", "00FFFF", "800000", "008000", "000080", "808000", "800080", "008080", "C0C0C0", "808080", "9999FF", "993366", "FFFFCC", "CCFFFF",
  "660066", "FF8080", "0066CC", "CCCCFF", "000080", "FF00FF", "FFFF00", "00FFFF", "800080", "800000", "008080", "0000FF", "00CCFF", "CCFFFF", "CCFFCC",
  "FFFF99", "99CCFF", "FF99CC", "CC99FF", "FFCC99", "3366FF", "33CCCC", "99CC00", "FFCC00", "FF9900", "FF6600", "666699", "969696", "003366", "339966",
  "003300", "333300", "993300", "993366", "333399", "333333"];
const TEMA_PADRAO = ["FFFFFF", "000000", "E7E6E6", "44546A", "4472C4", "ED7D31", "A5A5A5", "FFC000", "5B9BD5", "70AD47", "0563C1", "954F72"];

const FAMILIAS = {
  calibri: 'Calibri, Carlito, "Segoe UI", Arial, sans-serif', "calibri light": '"Calibri Light", Calibri, Carlito, sans-serif',
  arial: 'Arial, "Liberation Sans", Helvetica, sans-serif', "arial narrow": '"Arial Narrow", "Liberation Sans Narrow", Arial, sans-serif',
  "times new roman": '"Times New Roman", "Liberation Serif", Times, serif', cambria: 'Cambria, Caladea, Georgia, serif',
  aptos: 'Aptos, Calibri, Carlito, "Segoe UI", sans-serif', "aptos narrow": '"Aptos Narrow", Aptos, Calibri, Carlito, sans-serif', verdana: "Verdana, sans-serif",
  tahoma: "Tahoma, Verdana, sans-serif", "courier new": '"Courier New", "Liberation Mono", monospace', consolas: "Consolas, monospace",
  "segoe ui": '"Segoe UI", Roboto, sans-serif', georgia: "Georgia, serif", garamond: "Garamond, Georgia, serif", "century gothic": '"Century Gothic", sans-serif',
};
export const familiaCss = nome => FAMILIAS[(nome || "").toLowerCase()] || `"${(nome || "Calibri").replace(/"/g, "")}", Calibri, Carlito, sans-serif`;

const BORDAS = {
  thin: { w: 1 }, hair: { w: 1, alfa: 0.6 }, medium: { w: 2 }, thick: { w: 3 }, dashed: { w: 1, dash: [3, 2] }, dotted: { w: 1, dash: [1, 1] },
  double: { w: 3, duplo: true }, mediumDashed: { w: 2, dash: [5, 2] }, dashDot: { w: 1, dash: [4, 2, 1, 2] }, mediumDashDot: { w: 2, dash: [5, 2, 2, 2] },
  dashDotDot: { w: 1, dash: [4, 1, 1, 1, 1, 1] }, mediumDashDotDot: { w: 2, dash: [5, 2, 2, 2, 2, 2] }, slantDashDot: { w: 2, dash: [5, 1, 2, 1] },
};

// ---------------------------------------------------------------- cores
function rgbParaHls(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h, l, s];
}
function hlsParaRgb(h, l, s) {
  if (s === 0) return [l, l, l].map(x => Math.round(x * 255));
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(x => Math.round(x * 255));
}
function aplicarTom(hex, tom) {
  if (!tom) return hex;
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
  let [h, l, s] = rgbParaHls(r, g, b);
  l = tom < 0 ? l * (1 + tom) : l * (1 - tom) + tom;
  return hlsParaRgb(h, l, s).map(x => x.toString(16).padStart(2, "0")).join("").toUpperCase();
}
export const luminancia = hex => {
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// ---------------------------------------------------------------- leitura
function lerCor(el) {
  if (!el) return null;
  const c = {};
  if (el.hasAttribute("rgb")) c.rgb = el.getAttribute("rgb");
  if (el.hasAttribute("theme")) c.tema = +el.getAttribute("theme");
  if (el.hasAttribute("indexed")) c.ind = +el.getAttribute("indexed");
  if (el.hasAttribute("auto")) c.auto = el.getAttribute("auto") === "1" || el.getAttribute("auto") === "true";
  if (el.hasAttribute("tint")) c.tom = parseFloat(el.getAttribute("tint"));
  return c;
}
const bool = (el, padrao = true) => { if (!el) return false; const v = el.getAttribute("val"); return v == null ? padrao : !(v === "0" || v === "false"); };

function lerFonte(el) {
  const v = (n, a = "val") => filho(el, n)?.getAttribute(a);
  const u = filho(el, "u");
  return {
    nome: v("name") || "Calibri", tam: parseFloat(v("sz") || "11"), b: bool(filho(el, "b")), i: bool(filho(el, "i")),
    u: u ? (u.getAttribute("val") || "single") : null, s: bool(filho(el, "strike")), cor: lerCor(filho(el, "color")),
    va: v("vertAlign") || null,
  };
}
function lerPreenchimento(el) {
  const p = filho(el, "patternFill");
  if (p) {
    const tipo = p.getAttribute("patternType") || (filho(p, "fgColor") ? "solid" : "none");
    return { tipo, fg: lerCor(filho(p, "fgColor")), bg: lerCor(filho(p, "bgColor")) };
  }
  const g = filho(el, "gradientFill");
  if (g) { const st = filhos(g, "stop"); return { tipo: "gradient", fg: lerCor(st[0] && filho(st[0], "color")), bg: lerCor(st[1] && filho(st[1], "color")) }; }
  return { tipo: "none" };
}
function lerBorda(el) {
  const lado = n => { const e = filho(el, n); const st = e?.getAttribute("style"); return st && st !== "none" ? { estilo: st, cor: lerCor(filho(e, "color")) } : null; };
  return { l: lado("left") || lado("start"), r: lado("right") || lado("end"), t: lado("top"), b: lado("bottom") };
}
function lerXf(el) {
  const a = filho(el, "alignment");
  const n = (k, d = 0) => el.hasAttribute(k) ? +el.getAttribute(k) : d;
  return {
    numFmtId: n("numFmtId"), fontId: n("fontId"), fillId: n("fillId"), borderId: n("borderId"), xfId: n("xfId"),
    h: a?.getAttribute("horizontal") || null, v: a?.getAttribute("vertical") || null,
    quebra: a ? (a.getAttribute("wrapText") === "1" || a.getAttribute("wrapText") === "true") : false,
    recuo: a ? +(a.getAttribute("indent") || 0) : 0, rot: a ? +(a.getAttribute("textRotation") || 0) : 0,
    encolher: a ? a.getAttribute("shrinkToFit") === "1" : false,
    prefixo: el.getAttribute("quotePrefix") === "1",
  };
}

export class Estilos {
  /** xml = conteúdo de styles.xml (ou null para planilha sem estilos), temaXml = theme1.xml */
  constructor(xml, temaXml) {
    this.original = xml;
    this.doc = xml ? lerXml(xml) : null;
    this.novos = { numFmts: [], fonts: [], fills: [], borders: [], cellXfs: [] };
    this.tema = TEMA_PADRAO.slice();
    if (temaXml) {
      try {
        const t = lerXml(temaXml);
        const esquema = t.getElementsByTagNameNS(NS.a, "clrScheme")[0];
        if (esquema) {
          const cor = n => { const e = esquema.getElementsByTagNameNS(NS.a, n)[0]; if (!e) return null; const s = e.getElementsByTagNameNS(NS.a, "srgbClr")[0]; if (s) return s.getAttribute("val"); const y = e.getElementsByTagNameNS(NS.a, "sysClr")[0]; return y ? y.getAttribute("lastClr") : null; };
          const ordem = ["lt1", "dk1", "lt2", "dk2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"];
          ordem.forEach((n, i) => { const c = cor(n); if (c) this.tema[i] = c.toUpperCase(); });
        }
      } catch (e) { /* tema ilegível: usa o padrão */ }
    }
    this.indexadas = PALETA_INDEXADA.slice();
    this.numFmts = new Map(Object.entries(FORMATOS_EMBUTIDOS).map(([k, v]) => [+k, v]));
    this.fontes = []; this.preenchimentos = []; this.bordas = []; this.xfs = [];
    this.elFontes = []; this.elPreench = []; this.elBordas = []; this.elXfs = [];
    const d = this.doc;
    if (d) {
      const raiz = d.documentElement;
      const sec = n => filho(raiz, n);
      for (const e of filhos(sec("numFmts") || raiz, "numFmt")) this.numFmts.set(+e.getAttribute("numFmtId"), e.getAttribute("formatCode") || "General");
      for (const e of filhos(sec("fonts") || raiz, "font")) { this.fontes.push(lerFonte(e)); this.elFontes.push(e); }
      for (const e of filhos(sec("fills") || raiz, "fill")) { this.preenchimentos.push(lerPreenchimento(e)); this.elPreench.push(e); }
      for (const e of filhos(sec("borders") || raiz, "border")) { this.bordas.push(lerBorda(e)); this.elBordas.push(e); }
      for (const e of filhos(sec("cellXfs") || raiz, "xf")) { this.xfs.push(lerXf(e)); this.elXfs.push(e); }
      const cores = sec("colors");
      const ind = cores && filho(cores, "indexedColors");
      if (ind) filhos(ind, "rgbColor").forEach((e, i) => { const v = e.getAttribute("rgb"); if (v) this.indexadas[i] = v.slice(-6); });
    }
    if (!this.fontes.length) this.fontes.push({ nome: "Calibri", tam: 11, b: false, i: false, u: null, s: false, cor: null });
    if (!this.xfs.length) this.xfs.push({ numFmtId: 0, fontId: 0, fillId: 0, borderId: 0, xfId: 0, h: null, v: null, quebra: false, recuo: 0, rot: 0 });
    this.cacheRender = new Map();
    this.escuro = false;
  }

  get fontePadrao() { return this.fontes[0]; }

  /** cor do arquivo → "#RRGGBB" (ou null = automática) */
  cor(c) {
    if (!c || c.auto) return null;
    let hex = null;
    if (c.rgb) hex = c.rgb.length >= 8 ? c.rgb.slice(-6) : c.rgb.padStart(6, "0");
    else if (c.tema != null) hex = this.tema[c.tema] || null;
    else if (c.ind != null) { if (c.ind === 64 || c.ind === 65) return null; hex = this.indexadas[c.ind] || null; }
    if (!hex) return null;
    return "#" + aplicarTom(hex.toUpperCase(), c.tom || 0);
  }

  xf(s) { return this.xfs[s] || this.xfs[0]; }
  formato(s) { const x = this.xf(s); return this.numFmts.get(x.numFmtId) || "General"; }

  definirTemaEscuro(escuro) { if (this.escuro !== escuro) { this.escuro = escuro; this.cacheRender.clear(); } }

  /** informações para desenhar uma célula com o estilo s (com o zoom aplicado depois) */
  render(s) {
    let r = this.cacheRender.get(s);
    if (r) return r;
    const x = this.xf(s);
    const f = this.fontes[x.fontId] || this.fontes[0];
    const p = this.preenchimentos[x.fillId] || { tipo: "none" };
    const b = this.bordas[x.borderId] || {};
    let fundo = null;
    if (p.tipo === "solid") fundo = this.cor(p.fg) || (p.fg?.ind === 64 ? null : "#FFFFFF");
    else if (p.tipo === "gradient") fundo = this.cor(p.fg);
    else if (p.tipo && p.tipo !== "none") {
      // padrões (gray125 etc.): mistura aproximada
      const fg = this.cor(p.fg) || "#000000", bg = this.cor(p.bg) || null;
      const fr = { gray125: 0.125, gray0625: 0.0625, lightGray: 0.25, mediumGray: 0.5, darkGray: 0.75 }[p.tipo] ?? 0.3;
      fundo = misturar(fg, bg || "#FFFFFF", fr);
      if (p.tipo === "gray125" && !p.fg) fundo = null; // padrão reservado do Excel
    }
    let corTexto = this.cor(f.cor);
    const bordas = {};
    for (const lado of ["l", "r", "t", "b"]) {
      const bl = b[lado];
      if (!bl) continue;
      const def = BORDAS[bl.estilo] || BORDAS.thin;
      let cor = this.cor(bl.cor) || "#000000";
      if (this.escuro && !fundo && luminancia(cor.slice(1)) < 0.35) cor = "#8A8A8A";
      bordas[lado] = { ...def, cor };
    }
    if (this.escuro && !fundo && corTexto && luminancia(corTexto.slice(1)) < 0.3) corTexto = null;
    r = {
      fonteNome: f.nome, tam: f.tam, b: f.b, i: f.i, u: f.u, s: f.s, va: f.va,
      familia: familiaCss(f.nome), corTexto, fundo, bordas: Object.keys(bordas).length ? bordas : null,
      h: x.h, v: x.v || "bottom", quebra: x.quebra || x.h === "justify" || x.v === "justify", recuo: x.recuo, rot: x.rot, encolher: x.encolher,
      formato: this.numFmts.get(x.numFmtId) || "General", numFmtId: x.numFmtId,
    };
    this.cacheRender.set(s, r);
    return r;
  }

  // ------------------------------------------------------------ novos estilos
  /**
   * Devolve o índice de um estilo igual a "s" com as mudanças pedidas (cria se não existir).
   * m: { b, i, u, s(tachado), corTexto: "RRGGBB"|null, fundo: "RRGGBB"|null, h, v, quebra, formato: código, tam, fonte, bordas: {l,r,t,b: estilo|null} }
   */
  comMudanca(s, m) {
    if (!this.doc) return s;
    const x = { ...this.xf(s) };
    const elXf = this.elXfs[s] || this.elXfs[0];
    // fonte
    if (["b", "i", "u", "s", "corTexto", "tam", "fonte"].some(k => k in m)) x.fontId = this.fonteCom(x.fontId, m);
    if ("fundo" in m) x.fillId = this.preenchimentoCom(m.fundo);
    if ("bordas" in m) x.borderId = this.bordaCom(x.borderId, m.bordas);
    if ("formato" in m) x.numFmtId = this.idFormato(m.formato);
    const alinha = {};
    for (const k of ["h", "v", "quebra"]) if (k in m) alinha[k] = m[k];
    return this.xfCom(s, elXf, x, alinha, m);
  }

  idFormato(codigo) {
    if (!codigo || /^general$/i.test(codigo)) return 0;
    for (const [id, c] of this.numFmts) if (c === codigo) return id;
    let id = 164;
    for (const k of this.numFmts.keys()) if (k >= id) id = k + 1;
    this.numFmts.set(id, codigo);
    const el = criar(this.doc, "numFmt");
    el.setAttribute("numFmtId", String(id)); el.setAttribute("formatCode", codigo);
    this.novos.numFmts.push(el);
    return id;
  }

  fonteCom(fontId, m) {
    const base = this.elFontes[fontId] || this.elFontes[0];
    const el = base ? base.cloneNode(true) : criar(this.doc, "font");
    const def = (nome, ligado) => {
      const atual = filho(el, nome);
      if (ligado) { if (!atual) inserirNaOrdem(el, criar(this.doc, nome), ORDEM_FONTE); else atual.removeAttribute("val"); }
      else if (atual) atual.remove();
    };
    if ("b" in m) def("b", m.b);
    if ("i" in m) def("i", m.i);
    if ("s" in m) def("strike", m.s);
    if ("u" in m) { def("u", !!m.u); if (m.u && m.u !== "single") filho(el, "u").setAttribute("val", m.u); }
    if ("tam" in m) { let e = filho(el, "sz"); if (!e) e = inserirNaOrdem(el, criar(this.doc, "sz"), ORDEM_FONTE); e.setAttribute("val", String(m.tam)); }
    if ("fonte" in m) {
      let e = filho(el, "name"); if (!e) e = inserirNaOrdem(el, criar(this.doc, "name"), ORDEM_FONTE); e.setAttribute("val", m.fonte);
      filho(el, "scheme")?.remove(); filho(el, "family")?.remove(); filho(el, "charset")?.remove();
    }
    if ("corTexto" in m) {
      filho(el, "color")?.remove();
      if (m.corTexto) { const c = inserirNaOrdem(el, criar(this.doc, "color"), ORDEM_FONTE); c.setAttribute("rgb", "FF" + m.corTexto.replace("#", "").toUpperCase()); }
    }
    return this.acharOuAcrescentar(el, this.elFontes, this.fontes, lerFonte, "fonts");
  }

  preenchimentoCom(cor) {
    let el;
    if (!cor) { el = criar(this.doc, "fill"); const p = criar(this.doc, "patternFill"); p.setAttribute("patternType", "none"); el.appendChild(p); }
    else {
      el = criar(this.doc, "fill");
      const p = criar(this.doc, "patternFill"); p.setAttribute("patternType", "solid");
      const fg = criar(this.doc, "fgColor"); fg.setAttribute("rgb", "FF" + cor.replace("#", "").toUpperCase());
      const bg = criar(this.doc, "bgColor"); bg.setAttribute("indexed", "64");
      p.append(fg, bg); el.appendChild(p);
    }
    if (!cor) return 0;
    return this.acharOuAcrescentar(el, this.elPreench, this.preenchimentos, lerPreenchimento, "fills");
  }

  bordaCom(borderId, lados) {
    const base = this.elBordas[borderId] || this.elBordas[0];
    const el = base ? base.cloneNode(true) : criar(this.doc, "border");
    const nomes = { l: "left", r: "right", t: "top", b: "bottom" };
    const ordem = ["left", "start", "right", "end", "top", "bottom", "diagonal", "vertical", "horizontal"];
    for (const [k, estilo] of Object.entries(lados)) {
      const n = nomes[k];
      let e = filho(el, n) || (k === "l" ? filho(el, "start") : k === "r" ? filho(el, "end") : null);
      if (!e) e = inserirNaOrdem(el, criar(this.doc, n), ordem);
      while (e.firstChild) e.removeChild(e.firstChild);
      if (estilo) { e.setAttribute("style", estilo); const c = criar(this.doc, "color"); c.setAttribute("indexed", "64"); e.appendChild(c); }
      else e.removeAttribute("style");
    }
    for (const n of ["left", "right", "top", "bottom", "diagonal"]) if (!filho(el, n) && !(n === "left" && filho(el, "start")) && !(n === "right" && filho(el, "end"))) inserirNaOrdem(el, criar(this.doc, n), ordem);
    return this.acharOuAcrescentar(el, this.elBordas, this.bordas, lerBorda, "borders");
  }

  xfCom(sBase, elBase, x, alinha, m) {
    const el = elBase ? elBase.cloneNode(true) : criar(this.doc, "xf");
    el.setAttribute("numFmtId", String(x.numFmtId)); el.setAttribute("fontId", String(x.fontId));
    el.setAttribute("fillId", String(x.fillId)); el.setAttribute("borderId", String(x.borderId));
    if (!el.hasAttribute("xfId")) el.setAttribute("xfId", "0");
    if ("formato" in m) el.setAttribute("applyNumberFormat", "1");
    if (["b", "i", "u", "s", "corTexto", "tam", "fonte"].some(k => k in m)) el.setAttribute("applyFont", "1");
    if ("fundo" in m) el.setAttribute("applyFill", "1");
    if ("bordas" in m) el.setAttribute("applyBorder", "1");
    if (Object.keys(alinha).length) {
      el.setAttribute("applyAlignment", "1");
      let a = filho(el, "alignment");
      if (!a) { a = criar(this.doc, "alignment"); el.insertBefore(a, el.firstElementChild); }
      if ("h" in alinha) { if (alinha.h) a.setAttribute("horizontal", alinha.h); else a.removeAttribute("horizontal"); }
      if ("v" in alinha) { if (alinha.v) a.setAttribute("vertical", alinha.v); else a.removeAttribute("vertical"); }
      if ("quebra" in alinha) { if (alinha.quebra) a.setAttribute("wrapText", "1"); else a.removeAttribute("wrapText"); }
      if (!a.attributes.length && !a.firstChild) a.remove();
    }
    if ("formato" in m && m.formato === "@") el.removeAttribute("quotePrefix");
    return this.acharOuAcrescentar(el, this.elXfs, this.xfs, lerXf, "cellXfs");
  }

  acharOuAcrescentar(el, elementos, objetos, ler, secao) {
    const chave = new XMLSerializer().serializeToString(el).replace(/\sxmlns(:\w+)?="[^"]*"/g, "");
    if (!this.chaves) this.chaves = {};
    let mapa = this.chaves[secao];
    if (!mapa) {
      mapa = new Map();
      elementos.forEach((e, i) => { const k = new XMLSerializer().serializeToString(e).replace(/\sxmlns(:\w+)?="[^"]*"/g, ""); if (!mapa.has(k)) mapa.set(k, i); });
      this.chaves[secao] = mapa;
    }
    if (mapa.has(chave)) return mapa.get(chave);
    const i = elementos.length;
    elementos.push(el); objetos.push(ler(el)); mapa.set(chave, i);
    this.novos[secao].push(el);
    this.cacheRender.delete(i);
    return i;
  }

  temNovos() { return Object.values(this.novos).some(l => l.length); }

  /** grava styles.xml acrescentando os estilos novos ao final de cada lista */
  gravar() {
    const d = this.doc, raiz = d.documentElement;
    for (const secao of ORDEM_ESTILOS) {
      const lista = this.novos[secao];
      if (!lista || !lista.length) continue;
      let cont = filho(raiz, secao);
      if (!cont) cont = inserirNaOrdem(raiz, criar(d, secao), ORDEM_ESTILOS);
      for (const el of lista) if (!el.parentNode) cont.appendChild(el);
      cont.setAttribute("count", String(filhos(cont, secao === "numFmts" ? "numFmt" : secao === "fonts" ? "font" : secao === "fills" ? "fill" : secao === "borders" ? "border" : "xf").length));
    }
    return gravarXml(d, this.original);
  }
  /** chamado depois que o arquivo foi gravado com sucesso */
  confirmar() { this.novos = { numFmts: [], fonts: [], fills: [], borders: [], cellXfs: [] }; }
}

function misturar(a, b, fr) {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return "#" + pa.map((x, i) => Math.round(x * fr + pb[i] * (1 - fr)).toString(16).padStart(2, "0")).join("");
}
