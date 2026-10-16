// Aplica ao XML do Word só as mudanças feitas na tela (texto, parágrafos, negrito etc.).
// Parágrafos que não foram tocados continuam exatamente iguais no arquivo.

export const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const XMLNS = "http://www.w3.org/XML/1998/namespace";

// ordem dos elementos dentro de w:rPr e w:pPr (o Word exige essa ordem)
const ORDEM_RPR = ["rStyle", "rFonts", "b", "bCs", "i", "iCs", "caps", "smallCaps", "strike", "dstrike", "outline", "shadow", "emboss", "imprint", "noProof", "snapToGrid", "vanish", "webHidden", "color", "spacing", "w", "kern", "position", "sz", "szCs", "highlight", "u", "effect", "bdr", "shd", "fitText", "vertAlign", "rtl", "cs", "em", "lang", "eastAsianLayout", "specVanish", "oMath", "rPrChange"];
export const ORDEM_PPR = ["pStyle", "keepNext", "keepLines", "pageBreakBefore", "framePr", "widowControl", "numPr", "suppressLineNumbers", "pBdr", "shd", "tabs", "suppressAutoHyphens", "kinsoku", "wordWrap", "overflowPunct", "topLinePunct", "autoSpaceDE", "autoSpaceDN", "bidi", "adjustRightInd", "snapToGrid", "spacing", "ind", "contextualSpacing", "mirrorIndents", "suppressOverlap", "jc", "textDirection", "textAlignment", "textboxTightWrap", "outlineLvl", "divId", "cnfStyle", "rPr", "sectPr", "pPrChange"];

export const filhos = el => [...el.childNodes].filter(n => n.nodeType === 1);
export const ehW = (el, nome) => !!el && el.nodeType === 1 && el.namespaceURI === W && el.localName === nome;
export const filhoW = (el, nome) => filhos(el).find(c => ehW(c, nome)) || null;
export const novoW = (doc, nome) => doc.createElementNS(W, "w:" + nome);

const ehBrTexto = c => ehW(c, "br") && (!c.getAttributeNS(W, "type") || c.getAttributeNS(W, "type") === "textWrapping");
const ehTextual = c => ehW(c, "t") || ehW(c, "tab") || ehW(c, "cr") || ehW(c, "noBreakHyphen") || ehW(c, "softHyphen") || ehBrTexto(c);

/** coloca `novo` dentro de `pai` respeitando a ordem do esquema */
export function inserirOrdenado(pai, novo, ordem) {
  const idx = ordem.indexOf(novo.localName);
  for (const c of filhos(pai)) {
    const i = ordem.indexOf(c.localName);
    if (i > idx) { pai.insertBefore(novo, c); return novo; }
  }
  pai.appendChild(novo);
  return novo;
}
function garantir(pai, nome, ordemPai) {
  let el = filhoW(pai, nome);
  if (!el) { el = novoW(pai.ownerDocument, nome); if (ordemPai) inserirOrdenado(pai, el, ordemPai); else pai.insertBefore(el, pai.firstChild); }
  return el;
}
export function definirPropriedade(pai, nome, attrs, ordem) {
  let el = filhoW(pai, nome);
  if (attrs === null) { if (el) el.remove(); return; }
  if (!el) el = inserirOrdenado(pai, novoW(pai.ownerDocument, nome), ordem);
  for (const a of [...el.attributes]) el.removeAttributeNode(a);
  for (const [k, v] of Object.entries(attrs)) el.setAttributeNS(W, "w:" + k, v);
}

/** texto de um run como aparece na tela */
export function textoDoRun(run) {
  let s = "";
  for (const c of filhos(run)) {
    if (ehW(c, "t")) s += c.textContent;
    else if (ehW(c, "tab")) s += "\t";
    else if (ehBrTexto(c) || ehW(c, "cr")) s += "\n";
    else if (ehW(c, "noBreakHyphen")) s += "‑";
  }
  return s;
}

/** run só com texto (pode ser apagado sem perder imagem, campo, quebra de página etc.) */
function soTexto(run) { return filhos(run).every(c => ehW(c, "rPr") || ehW(c, "lastRenderedPageBreak") || ehTextual(c)); }

/** troca o texto de um run mantendo rPr e itens não textuais */
function escreverTexto(run, texto, manterNbsp) {
  const doc = run.ownerDocument;
  if (!manterNbsp) texto = texto.replace(/ /g, " ");
  const textuais = filhos(run).filter(ehTextual);
  const ancora = textuais[0] || null;
  for (const p of texto.split(/(\t|\n)/)) {
    if (p === "") continue;
    let n;
    if (p === "\t") n = novoW(doc, "tab");
    else if (p === "\n") n = novoW(doc, "br");
    else {
      n = novoW(doc, "t");
      if (/^\s|\s$|\s\s/.test(p)) n.setAttributeNS(XMLNS, "xml:space", "preserve");
      n.textContent = p.replace(/‑/g, "-");
    }
    if (ancora) run.insertBefore(n, ancora); else run.appendChild(n);
  }
  for (const c of textuais) c.remove();
}

/** formatação visível de um trecho (negrito, itálico, cor…); tamanho e fonte só quando o editor marcou */
export function estiloDe(el) {
  if (!el || el.nodeType !== 1) return null;
  const cs = getComputedStyle(el);
  const st = {
    b: Number(cs.fontWeight) >= 600,
    i: cs.fontStyle === "italic",
    u: (cs.textDecorationLine || "").includes("underline"),
    s: (cs.textDecorationLine || "").includes("line-through"),
    cor: cs.color,
    fundo: fundoDe(el),
  };
  const comTam = el.closest("[data-tam]"), comFonte = el.closest("[data-fonte]");
  if (comTam) st.tam = comTam.dataset.tam;
  if (comFonte) st.fonte = comFonte.dataset.fonte;
  return st;
}
function fundoDe(el) {
  // fundo do próprio trecho (marca-texto), sem herdar o fundo da página
  for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
    if (e.matches("p, td, th, li, article, section, div, header, footer")) break;
    const bg = getComputedStyle(e).backgroundColor;
    if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return bg;
  }
  return "";
}

function rgbParaHex(c) {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(c || "");
  if (!m) return null;
  if (m[4] !== undefined && Number(m[4]) === 0) return null;
  return [m[1], m[2], m[3]].map(x => Number(x).toString(16).padStart(2, "0")).join("").toUpperCase();
}
const HIGHLIGHT = { FFFF00: "yellow", "00FF00": "green", "00FFFF": "cyan", FF00FF: "magenta", "0000FF": "blue", FF0000: "red", "000080": "darkBlue", "008080": "darkCyan", "008000": "darkGreen", "800080": "darkMagenta", "800000": "darkRed", "808000": "darkYellow", "808080": "darkGray", C0C0C0: "lightGray", "000000": "black" };

function aplicarFormatacao(run, dif) {
  const rpr = garantir(run, "rPr");
  if ("b" in dif) { definirPropriedade(rpr, "b", dif.b ? {} : { val: "0" }, ORDEM_RPR); definirPropriedade(rpr, "bCs", dif.b ? {} : { val: "0" }, ORDEM_RPR); }
  if ("i" in dif) { definirPropriedade(rpr, "i", dif.i ? {} : { val: "0" }, ORDEM_RPR); definirPropriedade(rpr, "iCs", dif.i ? {} : { val: "0" }, ORDEM_RPR); }
  if ("u" in dif) definirPropriedade(rpr, "u", { val: dif.u ? "single" : "none" }, ORDEM_RPR);
  if ("s" in dif) definirPropriedade(rpr, "strike", dif.s ? {} : { val: "0" }, ORDEM_RPR);
  if ("cor" in dif) { const hx = rgbParaHex(dif.cor); if (hx) definirPropriedade(rpr, "color", { val: hx }, ORDEM_RPR); }
  if ("fundo" in dif) {
    const hx = rgbParaHex(dif.fundo);
    if (!hx) { definirPropriedade(rpr, "highlight", null, ORDEM_RPR); }
    else if (HIGHLIGHT[hx]) definirPropriedade(rpr, "highlight", { val: HIGHLIGHT[hx] }, ORDEM_RPR);
    else definirPropriedade(rpr, "shd", { val: "clear", color: "auto", fill: hx }, ORDEM_RPR);
  }
  if ("tam" in dif && dif.tam) { const meios = String(Math.round(Number(dif.tam) * 2)); definirPropriedade(rpr, "sz", { val: meios }, ORDEM_RPR); definirPropriedade(rpr, "szCs", { val: meios }, ORDEM_RPR); }
  if ("fonte" in dif && dif.fonte) definirPropriedade(rpr, "rFonts", { ascii: dif.fonte, hAnsi: dif.fonte, cs: dif.fonte, eastAsia: dif.fonte }, ORDEM_RPR);
  if (!filhos(rpr).length) rpr.remove();
}

function diferencas(a, b) {
  const d = {};
  if (!a || !b) return d;
  for (const k of ["b", "i", "u", "s", "cor", "fundo", "tam", "fonte"]) if ((a[k] ?? "") !== (b[k] ?? "")) d[k] = b[k];
  return d;
}

/**
 * Guarda o vínculo tela ↔ XML e aplica as edições.
 * reg: WeakMap(elemento/nó da tela → {xml, tipo})
 */
export class Reconciliador {
  constructor() {
    this.reg = new WeakMap();
    this.ids = new Map();       // id → nó XML
    this.xmlId = new Map();     // nó XML → id
    this.estilos = new WeakMap(); // elemento da tela → formatação no momento da abertura
    this.runsDoParagrafo = new Map(); // w:p → Set(w:r) renderizados
    this.alinhamentos = new Map();
    this.hosts = [];            // [{els:[...], container, paragrafos:Set, tabelas:Set}]
    this.desenhos = [];
    this.alteradas = new Set();
    this.tocados = new Set();
    this.seq = 0;
  }

  idDe(xml) {
    let id = this.xmlId.get(xml);
    if (id === undefined) { id = ++this.seq; this.xmlId.set(xml, id); this.ids.set(id, xml); }
    return id;
  }

  /** chamado pelo renderizador para cada elemento criado a partir do XML */
  registrar(el, modelo) {
    const xml = modelo.xml;
    this.reg.set(el, { xml, tipo: modelo.type });
    if (el.nodeType === 1) el.dataset.x = String(this.idDe(xml));
    if (ehW(xml, "r")) {
      let p = xml.parentNode;
      while (p && !ehW(p, "p")) p = p.parentNode;
      if (p) { if (!this.runsDoParagrafo.has(p)) this.runsDoParagrafo.set(p, new Set()); this.runsDoParagrafo.get(p).add(xml); }
    }
    if (ehW(xml, "drawing")) this.desenhos.push({ el, xml });
  }

  xmlDe(el) {
    const r = this.reg.get(el);
    if (r) return r.xml;
    const id = el.dataset?.x;
    return id ? this.ids.get(Number(id)) || null : null;
  }
  ehOriginal(el) { return this.reg.has(el); }

  /** depois de desenhar: guarda a formatação original de cada trecho */
  fotografar(raiz) {
    const tw = document.createTreeWalker(raiz, NodeFilter.SHOW_ELEMENT);
    for (let e = tw.nextNode(); e; e = tw.nextNode()) {
      const r = this.reg.get(e);
      if (r && ehW(r.xml, "r")) {
        this.estilos.set(e, estiloDe(e));
        for (const d of e.querySelectorAll("*")) if (!d.dataset.tab) this.estilos.set(d, estiloDe(d));
      } else if (r && ehW(r.xml, "p")) this.alinhamentos.set(r.xml, e.style.textAlign || "");
    }
  }

  baseDe(el, limite) {
    for (let e = el; e && e !== limite; e = e.parentElement) { const s = this.estilos.get(e); if (s) return s; }
    return null;
  }

  /** blocos (parágrafos/tabelas) de um host, na ordem da tela */
  blocos(host) {
    const out = [];
    const anda = el => {
      for (const n of [...el.childNodes]) {
        if (n.nodeType === 3) { if (n.data.trim()) out.push({ tipo: "solto", el: n }); continue; }
        if (n.nodeType !== 1) continue;
        const tag = n.tagName;
        if (tag === "TABLE") { out.push({ tipo: "tabela", el: n }); continue; }
        if (/^(P|H[1-6]|LI|BLOCKQUOTE|PRE)$/.test(tag)) { out.push({ tipo: "p", el: n }); continue; }
        if ((tag === "DIV" || tag === "UL" || tag === "OL") && !n.dataset.desenho && n.querySelector("p,table,li")) { anda(n); continue; }
        if (n.dataset?.desenho) continue;
        out.push({ tipo: "p", el: n, solto: true });
      }
    };
    for (const h of host.els) anda(h);
    return out;
  }

  /** segmentos de texto de um bloco */
  segmentos(bloco) {
    const segs = [];
    const runDe = no => {
      for (let e = no.nodeType === 1 ? no : no.parentElement; e; e = e.parentElement) {
        const x = this.xmlDe(e);
        if (x && ehW(x, "r")) return { el: e, xml: x, original: this.ehOriginal(e) };
        if (e === bloco) break;
      }
      return null;
    };
    const anda = no => {
      for (const n of [...no.childNodes]) {
        if (n.nodeType === 3) {
          if (n.data) segs.push({ tipo: "texto", texto: n.data.replace(/​/g, ""), el: n.parentElement, run: runDe(n) });
        } else if (n.nodeType === 1) {
          if (n.dataset?.tab) { segs.push({ tipo: "texto", texto: "\t", el: n.parentElement, run: runDe(n) }); continue; }
          if (n.tagName === "BR") { segs.push({ tipo: "br", texto: "\n", el: n.parentElement, run: runDe(n), original: this.ehOriginal(n) }); continue; }
          if (n.dataset?.desenho || n.getAttribute("contenteditable") === "false" || n.tagName === "TABLE") continue;
          anda(n);
        }
      }
    };
    if (bloco.nodeType === 3) segs.push({ tipo: "texto", texto: bloco.data, el: bloco.parentElement, run: null });
    else anda(bloco);
    // a última quebra de linha do bloco é só o marcador do navegador (a não ser que venha do arquivo)
    for (let i = segs.length - 1; i >= 0; i--) {
      if (segs[i].tipo === "br") { if (!segs[i].original) segs.splice(i, 1); break; }
      if (segs[i].texto !== "") break;
    }
    return segs.filter(s => s.texto !== "");
  }

  primeiroRun(pXml) { const tw = pXml.ownerDocument.createTreeWalker(pXml, NodeFilter.SHOW_ELEMENT); for (let e = tw.nextNode(); e; e = tw.nextNode()) if (ehW(e, "r")) return e; return null; }

  runModelo(pXml) {
    const doc = pXml.ownerDocument;
    const r = this.primeiroRun(pXml);
    if (r) return r;
    const run = novoW(doc, "r");
    const ppr = filhoW(pXml, "pPr");
    const prr = ppr && filhoW(ppr, "rPr");
    if (prr) { const rpr = novoW(doc, "rPr"); for (const c of filhos(prr)) if (!/^(ins|del|moveFrom|moveTo|rPrChange)$/.test(c.localName)) rpr.appendChild(c.cloneNode(true)); if (filhos(rpr).length) run.appendChild(rpr); }
    return run;
  }

  /** refaz os runs de um parágrafo a partir do que está na tela */
  reconstruirParagrafo(pXml, fragmentos, { novo = false } = {}) {
    const doc = pXml.ownerDocument;
    const segs = fragmentos.flatMap(f => this.segmentos(f).map(s => ({ ...s, frag: f })));
    const renderizados = this.runsDoParagrafo.get(pXml) || new Set();
    const grupos = [];
    for (const s of segs) {
      const tpl = s.run?.xml || null;
      const base = this.baseDe(s.el, null) || (s.run ? this.estilos.get(s.run.el) : null);
      const dif = base ? diferencas(base, estiloDe(s.el)) : {};
      const chave = (tpl ? this.idDe(tpl) : "x") + JSON.stringify(dif);
      const ult = grupos[grupos.length - 1];
      if (ult && ult.chave === chave) ult.texto += s.texto;
      else grupos.push({ chave, tpl, dif, texto: s.texto });
    }
    const usados = new Set();
    let anterior = null, mudou = false;
    const depois = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    for (const g of grupos) {
      let run;
      const reusa = !novo && g.tpl && renderizados.has(g.tpl) && g.tpl.parentNode && pXml.contains(g.tpl) && !usados.has(g.tpl) && !Object.keys(g.dif).length && (!anterior || depois(anterior, g.tpl));
      if (reusa) {
        run = g.tpl;
        usados.add(run);
        const atual = textoDoRun(run);
        if (atual.replace(/ /g, " ") !== g.texto.replace(/ /g, " ")) { escreverTexto(run, g.texto, atual.includes(" ")); mudou = true; }
      } else {
        const tpl = g.tpl && g.tpl.ownerDocument === doc ? g.tpl : this.runModelo(pXml);
        run = tpl.cloneNode(true);
        for (const c of filhos(run)) if (!ehW(c, "rPr")) c.remove();
        for (const a of ["rsidR", "rsidRPr", "rsidDel"]) run.removeAttributeNS(W, a);
        escreverTexto(run, g.texto, false);
        if (Object.keys(g.dif).length) aplicarFormatacao(run, g.dif);
        if (anterior) anterior.parentNode.insertBefore(run, anterior.nextSibling);
        else {
          const primeiro = [...renderizados].find(r => r.parentNode && pXml.contains(r)) || this.primeiroRun(pXml);
          if (primeiro) primeiro.parentNode.insertBefore(run, primeiro);
          else { const ppr = filhoW(pXml, "pPr"); pXml.insertBefore(run, ppr ? ppr.nextSibling : pXml.firstChild); }
        }
        usados.add(run);
        mudou = true;
      }
      anterior = run;
    }
    for (const r of renderizados) {
      if (usados.has(r) || !r.parentNode || !pXml.contains(r)) continue;
      if (soTexto(r)) r.remove();
      else if (textoDoRun(r)) escreverTexto(r, "", false);
      else continue;
      mudou = true;
    }
    this.runsDoParagrafo.set(pXml, usados);
    if (mudou) this.alteradas.add(doc);
    return mudou;
  }

  aplicarAlinhamento(pXml, el, original) {
    const atual = el.style?.textAlign || "";
    if (atual === (original || "")) return false;
    const mapa = { left: "left", start: "left", center: "center", right: "right", end: "right", justify: "both" };
    if (!mapa[atual]) return false;
    definirPropriedade(garantir(pXml, "pPr"), "jc", { val: mapa[atual] }, ORDEM_PPR);
    this.alinhamentos.set(pXml, atual);
    this.alteradas.add(pXml.ownerDocument);
    return true;
  }

  novoParagrafo(modeloXml, doc) {
    const p = novoW(doc, "p");
    const ppr = modeloXml && filhoW(modeloXml, "pPr");
    if (ppr) {
      const c = ppr.cloneNode(true);
      for (const x of filhos(c)) if (ehW(x, "sectPr") || ehW(x, "pPrChange")) x.remove();
      p.appendChild(c);
    }
    return p;
  }

  /** bloco da tela que contém este nó */
  blocoDe(no) {
    for (let e = no.nodeType === 1 ? no : no.parentNode; e && e.parentNode; e = e.parentNode) {
      if (this.ehHost(e.parentNode)) return e;
    }
    return null;
  }
  ehHost(el) { return this.hosts.some(h => h.els.includes(el)); }

  /** chamado pelo MutationObserver */
  marcar(registros) {
    for (const r of registros) {
      const b = this.blocoDe(r.target);
      if (b) this.tocados.add(b);
      if (r.type === "childList") for (const n of r.addedNodes) { const bb = this.blocoDe(n); if (bb) this.tocados.add(bb); }
    }
  }

  /** aplica as edições ao XML; devolve true se algo mudou */
  aplicar() {
    const vivosP = new Set(), vivasT = new Set();
    const fragmentos = new Map(); // w:p → [blocos]
    const novos = [];
    let mudou = false;
    for (const host of this.hosts) {
      if (!host.els.some(e => e.isConnected)) continue;
      let ultimo = null;
      for (const b of this.blocos(host)) {
        if (b.tipo === "tabela") { const x = this.xmlDe(b.el); if (x && ehW(x, "tbl")) { vivasT.add(x); ultimo = { xml: x }; } continue; }
        const x = b.el.nodeType === 1 ? this.xmlDe(b.el) : null;
        if (!b.solto && x && ehW(x, "p") && this.ehOriginal(b.el) && x.parentNode) {
          if (!fragmentos.has(x)) fragmentos.set(x, []);
          fragmentos.get(x).push(b.el);
          vivosP.add(x);
          ultimo = { xml: x };
        } else {
          const n = { el: b.el, modelo: x && ehW(x, "p") ? x : ultimo?.xml && ehW(ultimo.xml, "p") ? ultimo.xml : (ultimo?.novo?.xml || null), antes: ultimo, host };
          novos.push(n);
          ultimo = { novo: n };
        }
      }
    }
    // parágrafos tocados
    for (const [x, frags] of fragmentos) {
      if (!frags.some(f => this.tocados.has(f))) continue;
      if (this.reconstruirParagrafo(x, frags)) mudou = true;
      if (this.aplicarAlinhamento(x, frags[0], this.alinhamentos.get(x))) mudou = true;
    }
    // parágrafos novos (Enter, colar)
    for (const n of novos) {
      const doc = n.host.container.ownerDocument;
      const modelo = n.modelo && n.modelo.ownerDocument === doc ? n.modelo : null;
      const p = this.novoParagrafo(modelo, doc);
      let ref = n.antes;
      while (ref && ref.novo) ref = ref.novo.xml ? { xml: ref.novo.xml } : ref.novo.antes;
      if (ref?.xml) ref.xml.parentNode.insertBefore(p, ref.xml.nextSibling);
      else {
        const primeiro = filhos(n.host.container).find(c => ehW(c, "p") || ehW(c, "tbl") || ehW(c, "sdt"));
        if (primeiro) n.host.container.insertBefore(p, primeiro);
        else n.host.container.insertBefore(p, filhoW(n.host.container, "sectPr"));
      }
      n.xml = p;
      this.runsDoParagrafo.set(p, new Set());
      this.reconstruirParagrafo(p, [n.el], { novo: true });
      if (n.el.nodeType === 1) {
        this.aplicarAlinhamento(p, n.el, modelo ? this.alinhamentos.get(modelo) : "");
        // daqui em diante este bloco é o parágrafo novo
        this.reg.set(n.el, { xml: p, tipo: "Paragraph" });
        n.el.dataset.x = String(this.idDe(p));
        this.alinhamentos.set(p, n.el.style.textAlign || "");
      }
      n.host.paragrafos.add(p);
      vivosP.add(p);
      this.alteradas.add(doc);
      mudou = true;
    }
    // parágrafos e tabelas que sumiram da tela
    for (const host of this.hosts) {
      const hostVivo = host.els.some(e => e.isConnected);
      if (!hostVivo) continue;
      for (const x of [...host.paragrafos]) {
        if (vivosP.has(x)) continue;
        host.paragrafos.delete(x);
        if (!x.parentNode) continue;
        const ppr = filhoW(x, "pPr");
        const pai = x.parentNode;
        const ultimoDaCelula = ehW(pai, "tc") && filhos(pai).filter(c => ehW(c, "p") || ehW(c, "tbl")).length <= 1;
        if ((ppr && filhoW(ppr, "sectPr")) || ultimoDaCelula) {
          const renderizados = this.runsDoParagrafo.get(x) || new Set();
          for (const r of renderizados) if (r.parentNode && soTexto(r)) r.remove();
          host.paragrafos.add(x);
        } else x.remove();
        this.alteradas.add(x.ownerDocument);
        mudou = true;
      }
      for (const t of [...host.tabelas]) {
        if (vivasT.has(t) || !t.parentNode) continue;
        const pai = t.parentNode;
        t.remove();
        host.tabelas.delete(t);
        if (ehW(pai, "tc") && !filhos(pai).some(c => ehW(c, "p"))) pai.appendChild(novoW(pai.ownerDocument, "p"));
        this.alteradas.add(pai.ownerDocument);
        mudou = true;
      }
    }
    // imagens apagadas
    for (const d of this.desenhos) {
      if (d.el.isConnected || !d.xml.parentNode) continue;
      d.xml.remove();
      this.alteradas.add(d.xml.ownerDocument);
      mudou = true;
    }
    this.desenhos = this.desenhos.filter(d => d.xml.parentNode);
    this.tocados.clear();
    return mudou;
  }
}
