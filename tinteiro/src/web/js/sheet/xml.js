// Ajudantes de XML (pacotes OOXML): ler, gravar mantendo a declaração original, criar elementos na ordem do esquema.
export const NS = {
  main: "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  rels: "http://schemas.openxmlformats.org/package/2006/relationships",
  ct: "http://schemas.openxmlformats.org/package/2006/content-types",
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  xdr: "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing",
  x14: "http://schemas.microsoft.com/office/spreadsheetml/2009/9/main",
  xm: "http://schemas.microsoft.com/office/excel/2006/main",
};
export const TIPO_REL = {
  folha: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet",
  estilos: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles",
  textos: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings",
  tema: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme",
  calcChain: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/calcChain",
};

export function lerXml(texto) {
  const doc = new DOMParser().parseFromString(texto, "application/xml");
  const erro = doc.getElementsByTagName("parsererror")[0];
  if (erro) throw new Error("XML inválido: " + (erro.textContent || "").slice(0, 200));
  return doc;
}

/** serializa mantendo a declaração <?xml …?> original */
export function gravarXml(doc, original) {
  let corpo = new XMLSerializer().serializeToString(doc);
  corpo = corpo.replace(/^<\?xml[^?]*\?>\s*/, "");
  const m = original ? /^﻿?<\?xml[^?]*\?>(\r?\n)?/.exec(original) : null;
  const decl = m ? m[0].replace(/^﻿/, "") : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  return decl + corpo;
}

/** filhos diretos com o nome local */
export const filhos = (el, nome) => { const out = []; for (let c = el.firstElementChild; c; c = c.nextElementSibling) if (c.localName === nome) out.push(c); return out; };
export const filho = (el, nome) => { for (let c = el.firstElementChild; c; c = c.nextElementSibling) if (c.localName === nome) return c; return null; };
export const todos = (raiz, nome, ns = NS.main) => raiz.getElementsByTagNameNS(ns, nome);

/** cria elemento no mesmo namespace/prefixo do pai */
export function criar(doc, nome, ns = null) {
  const raiz = doc.documentElement;
  const n = ns || raiz.namespaceURI;
  const prefixo = n === raiz.namespaceURI ? raiz.prefix : raiz.lookupPrefix(n);
  return doc.createElementNS(n, prefixo ? prefixo + ":" + nome : nome);
}

/** insere "el" em "pai" respeitando a ordem dos elementos do esquema */
export function inserirNaOrdem(pai, el, ordem) {
  const pos = ordem.indexOf(el.localName);
  for (let c = pai.firstElementChild; c; c = c.nextElementSibling) {
    const p = ordem.indexOf(c.localName);
    if (p > pos) { pai.insertBefore(el, c); return el; }
  }
  pai.appendChild(el);
  return el;
}

export const ORDEM_FOLHA = ["sheetPr", "dimension", "sheetViews", "sheetFormatPr", "cols", "sheetData", "sheetCalcPr", "sheetProtection", "protectedRanges",
  "scenarios", "autoFilter", "sortState", "dataConsolidate", "customSheetViews", "mergeCells", "phoneticPr", "conditionalFormatting", "dataValidations",
  "hyperlinks", "printOptions", "pageMargins", "pageSetup", "headerFooter", "rowBreaks", "colBreaks", "customProperties", "cellWatches", "ignoredErrors",
  "smartTags", "drawing", "legacyDrawing", "legacyDrawingHF", "drawingHF", "picture", "oleObjects", "controls", "webPublishItems", "tableParts", "extLst"];
export const ORDEM_PASTA = ["fileVersion", "fileSharing", "workbookPr", "workbookProtection", "bookViews", "sheets", "functionGroups", "externalReferences",
  "definedNames", "calcPr", "oleSize", "customWorkbookViews", "pivotCaches", "smartTagPr", "smartTagTypes", "webPublishing", "fileRecoveryPr", "webPublishObjects", "extLst"];
export const ORDEM_ESTILOS = ["numFmts", "fonts", "fills", "borders", "cellStyleXfs", "cellXfs", "cellStyles", "dxfs", "tableStyles", "colors", "extLst"];
export const ORDEM_FONTE = ["b", "i", "strike", "condense", "extend", "outline", "shadow", "u", "vertAlign", "sz", "color", "name", "family", "charset", "scheme"];
export const ORDEM_CELULA = ["f", "v", "is", "extLst"];
export const ORDEM_VISTA = ["pane", "selection", "pivotSelection", "extLst"];

/** caminho de destino de uma relação, relativo à pasta da parte de origem */
export function resolverAlvo(origem, alvo) {
  if (alvo.startsWith("/")) return alvo.slice(1);
  const partes = origem.split("/"); partes.pop();
  for (const p of alvo.split("/")) { if (p === "..") partes.pop(); else if (p !== ".") partes.push(p); }
  return partes.join("/");
}
export const relsDe = caminho => { const p = caminho.split("/"); const n = p.pop(); return [...p, "_rels", n + ".rels"].join("/"); };

/** remove caracteres proibidos no XML */
export const limparTextoXml = s => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "");
