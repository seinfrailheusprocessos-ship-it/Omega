// Leitura de .xlsx: pacote ZIP → modelo (células, estilos, larguras, mesclas, painéis congelados…).
import JSZip from "jszip";
import { lerXml, filho, filhos, todos, NS, TIPO_REL, resolverAlvo, relsDe } from "./xml.js";
import { Estilos } from "./estilos.js";
import { chave, lerCelula, lerIntervalo, numeroColuna } from "./enderecos.js";
import { transladarFormula } from "./formula.js";
import { dataParaSerial } from "./formatos.js";

/** texto de <si>/<is> (ignora a fonética <rPh>) */
export function textoRico(el) {
  if (!el) return "";
  let s = "";
  const ts = el.getElementsByTagNameNS(NS.main, "t");
  for (let i = 0; i < ts.length; i++) { const t = ts[i]; if (t.parentNode && t.parentNode.localName === "rPh") continue; s += t.textContent; }
  return desescapar(s);
}
export const desescapar = s => s.indexOf("_x") < 0 ? s : s.replace(/_x([0-9A-Fa-f]{4})_/g, (m, h) => String.fromCharCode(parseInt(h, 16)));

export async function lerRelacoes(zip, caminho) {
  const arq = zip.file(relsDe(caminho));
  if (!arq) return [];
  const d = lerXml(await arq.async("string"));
  return [...d.getElementsByTagNameNS(NS.rels, "Relationship")].map(e => ({ id: e.getAttribute("Id"), tipo: e.getAttribute("Type"), alvo: e.getAttribute("Target"), externo: e.getAttribute("TargetMode") === "External", caminho: e.getAttribute("TargetMode") === "External" ? null : resolverAlvo(caminho, e.getAttribute("Target")) }));
}

export async function lerXlsx(dados) {
  const zip = await JSZip.loadAsync(dados);
  const relsRaiz = await lerRelacoes(zip, "");
  const relPasta = relsRaiz.find(r => /\/officeDocument$/.test(r.tipo));
  const caminhoPasta = relPasta ? relPasta.caminho : "xl/workbook.xml";
  const arqPasta = zip.file(caminhoPasta);
  if (!arqPasta) throw new Error("Este arquivo não parece ser uma planilha do Excel (.xlsx).");
  const xmlPasta = await arqPasta.async("string");
  if (/vnd\.ms-excel\.sheet\.binary|\.bin"/.test(xmlPasta)) throw new Error("Planilha em formato binário não suportado.");
  const docPasta = lerXml(xmlPasta);
  const rels = await lerRelacoes(zip, caminhoPasta);
  const porId = new Map(rels.map(r => [r.id, r]));
  const relDe = tipo => rels.find(r => r.tipo === tipo);

  // estilos e tema
  const relEst = relDe(TIPO_REL.estilos), relTema = relDe(TIPO_REL.tema);
  const xmlEst = relEst && zip.file(relEst.caminho) ? await zip.file(relEst.caminho).async("string") : null;
  const xmlTema = relTema && zip.file(relTema.caminho) ? await zip.file(relTema.caminho).async("string") : null;
  const estilos = new Estilos(xmlEst, xmlTema);

  // textos compartilhados
  const relTx = relDe(TIPO_REL.textos);
  const textos = [];
  if (relTx && zip.file(relTx.caminho)) {
    const d = lerXml(await zip.file(relTx.caminho).async("string"));
    const sis = d.documentElement.children;
    for (let i = 0; i < sis.length; i++) if (sis[i].localName === "si") textos.push(textoRico(sis[i]));
  }

  const wbPr = filho(docPasta.documentElement, "workbookPr");
  const data1904 = !!wbPr && (wbPr.getAttribute("date1904") === "1" || wbPr.getAttribute("date1904") === "true");
  const vista = docPasta.getElementsByTagNameNS(NS.main, "workbookView")[0];
  const abaAtiva = vista ? +(vista.getAttribute("activeTab") || 0) : 0;

  const elFolhas = [...docPasta.getElementsByTagNameNS(NS.main, "sheet")];
  const folhas = [];
  for (const el of elFolhas) {
    const rid = el.getAttributeNS(NS.r, "id") || el.getAttribute("r:id");
    const rel = porId.get(rid);
    const info = { nome: el.getAttribute("name"), sheetId: +el.getAttribute("sheetId"), rId: rid, estado: el.getAttribute("state") || "visible", caminho: rel ? rel.caminho : null };
    if (!rel || !/\/worksheet$/.test(rel.tipo) || !zip.file(rel.caminho)) {
      // gráfico em folha própria, macro etc.: mostra como aba sem células
      folhas.push({ ...info, especial: true, celulas: new Map(), linhas: new Map(), colunas: [], mesclas: [], hf: [] });
      continue;
    }
    folhas.push({ ...info, ...(await lerFolha(zip, rel.caminho, textos, estilos, data1904)) });
  }

  // nomes definidos
  const nomes = [];
  for (const e of docPasta.getElementsByTagNameNS(NS.main, "definedName")) {
    nomes.push({ nome: e.getAttribute("name"), texto: e.textContent, local: e.hasAttribute("localSheetId") ? +e.getAttribute("localSheetId") : null, oculto: e.getAttribute("hidden") === "1" });
  }
  return { tipo: "xlsx", zip, caminhoPasta, estilos, textos, data1904, nomes, folhas, abaAtiva: Math.min(abaAtiva, folhas.length - 1) };
}

async function lerFolha(zip, caminho, textos, estilos, data1904) {
  const xml = await zip.file(caminho).async("string");
  const doc = lerXml(xml);
  const raiz = doc.documentElement;
  const celulas = new Map();
  const linhas = new Map();
  const hf = []; // linhas de conteúdo para o motor de cálculo
  const compartilhadas = new Map(); // si → {texto, r, c}
  const pendentes = [];
  const matrizes = [];
  let maxR = -1, maxC = -1;

  const sheetData = filho(raiz, "sheetData");
  let r = -1;
  if (sheetData) for (let row = sheetData.firstElementChild; row; row = row.nextElementSibling) {
    if (row.localName !== "row") continue;
    r = row.hasAttribute("r") ? +row.getAttribute("r") - 1 : r + 1;
    const props = {};
    if (row.hasAttribute("ht")) props.ht = parseFloat(row.getAttribute("ht"));
    if (row.getAttribute("customHeight") === "1" || row.getAttribute("customHeight") === "true") props.custom = true;
    if (row.getAttribute("hidden") === "1" || row.getAttribute("hidden") === "true") props.oculta = true;
    if (row.getAttribute("customFormat") === "1" && row.hasAttribute("s")) props.s = +row.getAttribute("s");
    if (Object.keys(props).length) linhas.set(r, props);
    let c = -1;
    let linhaHF = null;
    for (let ce = row.firstElementChild; ce; ce = ce.nextElementSibling) {
      if (ce.localName !== "c") continue;
      const ref = ce.getAttribute("r");
      if (ref) { const p = lerCelula(ref); if (p) { c = p.c; } else c++; } else c++;
      const s = ce.hasAttribute("s") ? +ce.getAttribute("s") : 0;
      const t = ce.getAttribute("t") || "n";
      let fEl = null, vEl = null, isEl = null;
      for (let k = ce.firstElementChild; k; k = k.nextElementSibling) { const n = k.localName; if (n === "f") fEl = k; else if (n === "v") vEl = k; else if (n === "is") isEl = k; }
      let valor = null;
      if (t === "s") { const i = vEl ? +vEl.textContent : -1; valor = i >= 0 && i < textos.length ? textos[i] : ""; }
      else if (t === "inlineStr") valor = textoRico(isEl);
      else if (t === "str") valor = vEl ? desescapar(vEl.textContent) : "";
      else if (t === "b") valor = vEl ? vEl.textContent.trim() === "1" || vEl.textContent.trim() === "true" : false;
      else if (t === "e") valor = { erro: vEl ? vEl.textContent : "#N/A" };
      else if (t === "d") { const d = vEl ? new Date(vEl.textContent) : null; valor = d && !isNaN(d) ? dataParaSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()) : null; }
      else if (vEl) { const n = parseFloat(vEl.textContent); valor = isNaN(n) ? null : n; }
      const k = chave(r, c);
      const cel = { s };
      let entradaHF;
      if (fEl) {
        const ft = fEl.getAttribute("t") || "normal";
        let texto = fEl.textContent;
        if (ft === "shared") {
          const si = fEl.getAttribute("si");
          if (texto && fEl.hasAttribute("ref")) compartilhadas.set(si, { texto, r, c });
          else if (!texto) { pendentes.push({ k, si, r, c }); texto = null; }
        }
        if (ft === "dataTable") { entradaHF = paraHF(valor); cel.cache = valor; cel.tabelaDados = true; }
        else {
          if (texto != null) cel.f = texto;
          cel.cache = valor;
          if (ft === "array" && fEl.hasAttribute("ref")) { cel.mat = fEl.getAttribute("ref"); matrizes.push({ k, ref: cel.mat }); }
          entradaHF = texto != null ? null : undefined; // preenchido depois
        }
      } else entradaHF = paraHF(valor);
      if (valor === null && !fEl && s === 0) continue; // célula vazia sem estilo
      celulas.set(k, cel);
      if (entradaHF !== undefined || cel.f != null) {
        if (!linhaHF) { linhaHF = hf[r] || (hf[r] = []); }
        linhaHF[c] = cel.f != null ? { formula: cel.f, mat: !!cel.mat } : entradaHF;
      }
      if (r > maxR) maxR = r;
      if (c > maxC) maxC = c;
    }
  }
  // fórmulas compartilhadas: expande a partir da mestra
  for (const p of pendentes) {
    const m = compartilhadas.get(p.si);
    const cel = celulas.get(p.k);
    if (!m || !cel) continue;
    cel.f = transladarFormula(m.texto, p.r - m.r, p.c - m.c);
    (hf[p.r] || (hf[p.r] = []))[p.c] = { formula: cel.f };
  }
  // células cobertas por fórmula de matriz (exceto a mestra) ficam vazias no motor
  for (const m of matrizes) {
    const g = lerIntervalo(m.ref);
    if (!g) continue;
    for (let rr = g.r1; rr <= g.r2; rr++) for (let cc = g.c1; cc <= g.c2; cc++) {
      const k = chave(rr, cc);
      if (k === m.k) continue;
      const cel = celulas.get(k);
      if (cel && cel.f == null) { cel.parte = m.k; if (hf[rr]) hf[rr][cc] = null; }
    }
  }

  // vistas: congelar painéis, linhas de grade, zoom
  const vistaEl = raiz.getElementsByTagNameNS(NS.main, "sheetView")[0];
  let congelar = { linhas: 0, colunas: 0 }, grade = true, zoom = 100, topo = null;
  if (vistaEl) {
    grade = vistaEl.getAttribute("showGridLines") !== "0" && vistaEl.getAttribute("showGridLines") !== "false";
    zoom = +(vistaEl.getAttribute("zoomScale") || 100) || 100;
    const pane = filho(vistaEl, "pane");
    if (pane && /frozen/i.test(pane.getAttribute("state") || "")) {
      congelar = { linhas: Math.round(+(pane.getAttribute("ySplit") || 0)), colunas: Math.round(+(pane.getAttribute("xSplit") || 0)) };
      const tl = vistaEl.getAttribute("topLeftCell");
      if (tl) topo = lerCelula(tl);
    }
    const sel = filhos(vistaEl, "selection").pop();
    if (sel && sel.getAttribute("activeCell")) topo = { ...(topo || {}), ativa: lerCelula(sel.getAttribute("activeCell")) };
  }
  const fmt = filho(raiz, "sheetFormatPr");
  const alturaPadrao = fmt && fmt.hasAttribute("defaultRowHeight") ? parseFloat(fmt.getAttribute("defaultRowHeight")) : 15;
  const larguraPadrao = fmt && fmt.hasAttribute("defaultColWidth") ? parseFloat(fmt.getAttribute("defaultColWidth")) : null;
  const larguraBase = fmt && fmt.hasAttribute("baseColWidth") ? parseFloat(fmt.getAttribute("baseColWidth")) : 8;
  const linhasOcultasPadrao = fmt && fmt.getAttribute("zeroHeight") === "1";

  const colunas = [];
  const colsEl = filho(raiz, "cols");
  if (colsEl) for (const e of filhos(colsEl, "col")) {
    const attrs = {};
    for (const a of e.attributes) attrs[a.name] = a.value;
    colunas.push({ min: +attrs.min - 1, max: +attrs.max - 1, attrs });
  }
  colunas.sort((a, b) => a.min - b.min);

  const mesclas = [];
  const mc = filho(raiz, "mergeCells");
  if (mc) for (const e of filhos(mc, "mergeCell")) { const g = lerIntervalo(e.getAttribute("ref") || ""); if (g && (g.r1 !== g.r2 || g.c1 !== g.c2)) mesclas.push(g); }

  const prFolha = filho(raiz, "sheetPr");
  const corAba = prFolha && filho(prFolha, "tabColor") ? estilos.cor({ rgb: filho(prFolha, "tabColor").getAttribute("rgb"), tema: filho(prFolha, "tabColor").hasAttribute("theme") ? +filho(prFolha, "tabColor").getAttribute("theme") : undefined, tom: parseFloat(filho(prFolha, "tabColor").getAttribute("tint") || 0) }) : null;

  // tabelas (para não estragá-las ao inserir colunas)
  const tabelas = [];
  const relsFolha = await lerRelacoes(zip, caminho);
  for (const rel of relsFolha) {
    if (!/\/table$/.test(rel.tipo) || !zip.file(rel.caminho)) continue;
    try {
      const d = lerXml(await zip.file(rel.caminho).async("string"));
      const g = lerIntervalo(d.documentElement.getAttribute("ref") || "");
      if (g) tabelas.push({ ...g, nome: d.documentElement.getAttribute("displayName") || "", cabecalho: d.documentElement.getAttribute("headerRowCount") !== "0" });
    } catch (e) { /* ignora */ }
  }
  const temDinamica = relsFolha.some(r => /\/pivotTable$/.test(r.tipo));

  return { celulas, linhas, hf, colunas, mesclas, congelar, grade, zoom, topo, alturaPadrao, larguraPadrao, larguraBase, linhasOcultasPadrao, corAba, tabelas, temDinamica, maxR, maxC };
}

/** valor do arquivo → conteúdo para o motor de cálculo */
export function paraHF(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return "'" + v;
  if (typeof v === "object" && v.erro) return v.erro;
  return v;
}

export { numeroColuna };
