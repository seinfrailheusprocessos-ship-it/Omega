// Gravação. XLSX: edita o pacote original "cirurgicamente" — só as partes que mudaram são reescritas, e dentro de
// cada planilha só os elementos afetados. Tudo o que o app não entende (gráficos, imagens, validação, formatação
// condicional, comentários, nomes, impressão…) é preservado. CSV: remonta o texto mantendo o formato original.
import JSZip from "jszip";
import { DetailedCellError } from "hyperformula";
import { lerXml, gravarXml, filho, filhos, criar, inserirNaOrdem, NS, TIPO_REL, ORDEM_FOLHA, ORDEM_PASTA, ORDEM_VISTA, relsDe, resolverAlvo, limparTextoXml } from "./xml.js";
import { chave, linhaDaChave, colunaDaChave, lerCelula, lerIntervalo, letraColuna, nomeCelula, nomeIntervalo, MAX_LINHAS, MAX_COLUNAS } from "./enderecos.js";
import { deslocarFormula, deslocarIndice, deslocarFaixa, transladarFormula, renomearFolhaNaFormula, excluirFolhaNaFormula, paraPortugues } from "./formula.js";
import { textoRico, desescapar, lerRelacoes } from "./xlsx-leitor.js";
import { codificar, montar } from "./csv.js";

const CT_FOLHA = "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml";
const ERROS_EXCEL = new Set(["#NULL!", "#DIV/0!", "#VALUE!", "#REF!", "#NAME?", "#NUM!", "#N/A", "#GETTING_DATA"]);
const NOVA_FOLHA = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><sheetData/><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>';

/** escapa "_xHHHH_" literal (o Excel o interpretaria como código de caractere) */
const escaparOoxml = s => limparTextoXml(s).replace(/_(x[0-9A-Fa-f]{4}_)/g, "_x005F_$1");

// ============================================================== CSV
export function gravarCsv(pasta) {
  const folha = pasta.folhas[0];
  const cfg = pasta.csv;
  // quantas colunas cada linha tinha no arquivo (para não acrescentar separadores à toa)
  const maxR = Math.max(folha.limite.r, (cfg.camposPorLinha?.length || 0) - 1);
  const porLinha = new Map();
  for (const [k, cel] of folha.celulas) {
    const r = linhaDaChave(k), c = colunaDaChave(k);
    let l = porLinha.get(r); if (!l) porLinha.set(r, l = []);
    l[c] = textoCsv(pasta, folha, r, c, cel);
  }
  const linhas = [];
  for (let r = 0; r <= maxR; r++) {
    const l = porLinha.get(r) || [];
    let n = l.length;
    while (n > 0 && (l[n - 1] == null || l[n - 1] === "")) n--;
    const orig = cfg.camposPorLinha?.[r] ?? 0;
    const tam = Math.max(n, orig);
    const out = [];
    for (let c = 0; c < tam; c++) out.push(l[c] ?? "");
    linhas.push(out);
  }
  // remove linhas vazias no fim que não existiam no arquivo
  while (linhas.length > (cfg.camposPorLinha?.length || 0) && linhas.length && linhas[linhas.length - 1].every(x => x === "")) linhas.pop();
  const texto = montar(linhas, cfg);
  let bytes = codificar(texto, cfg.codificacao, cfg.bom);
  let aviso = null;
  if (!bytes) { bytes = codificar(texto, "utf-8", true); aviso = "Alguns caracteres não cabem na codificação original do arquivo (Windows-1252); ele foi salvo em UTF-8."; }
  return { bytes, aviso, confirmar: () => { if (aviso) { cfg.codificacao = "utf-8"; cfg.bom = true; } cfg.camposPorLinha = linhas.map(l => l.length); for (const f of pasta.folhas) f.sujas.clear(); pasta.ops = []; } };
}

function textoCsv(pasta, folha, r, c, cel) {
  if (cel.raw != null) return cel.raw;
  if (cel.f != null) return "=" + (pasta.csv.decimalVirgula ? paraPortugues(cel.f) : cel.f);
  const v = pasta.valor(folha, r, c);
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return pasta.numeroCsv(v);
  if (typeof v === "boolean") return v ? "VERDADEIRO" : "FALSO";
  if (typeof v === "object") return v.erro;
  return String(v);
}

// ============================================================== XLSX
class Contexto {
  constructor(pasta) {
    this.pasta = pasta;
    this.zip = pasta.zip;
    this.saida = new Map(); // caminho → conteúdo (string | Uint8Array) ou null para excluir
    this.docs = new Map();  // caminho → {doc, original}
    this.caminhosNovos = new Map(); // Folha → caminho (planilhas novas)
    this.mudouConteudo = false;
  }
  async texto(caminho) {
    if (this.saida.has(caminho)) { const v = this.saida.get(caminho); return typeof v === "string" ? v : null; }
    const f = this.zip.file(caminho);
    return f ? f.async("string") : null;
  }
  async doc(caminho) {
    let d = this.docs.get(caminho);
    if (d) return d;
    const t = await this.texto(caminho);
    if (t == null) return null;
    d = { doc: lerXml(t), original: t, mudou: false };
    this.docs.set(caminho, d);
    return d;
  }
  novoDoc(caminho, texto) { const d = { doc: lerXml(texto), original: texto, mudou: true }; this.docs.set(caminho, d); return d; }
  excluir(caminho) { this.docs.delete(caminho); this.saida.set(caminho, null); }
}

/**
 * Gera o novo .xlsx. Devolve { bytes, confirmar } — confirmar() só deve ser chamado depois que o arquivo
 * foi gravado com sucesso (atualiza o modelo para a nova versão).
 */
export async function gravarXlsx(pasta) {
  const ctx = new Contexto(pasta);
  const wb = await ctx.doc(pasta.caminhoPasta);
  const relsWbCaminho = relsDe(pasta.caminhoPasta);
  const relsWb = await ctx.doc(relsWbCaminho);
  const tipos = await ctx.doc("[Content_Types].xml");
  ctx.wb = wb; ctx.relsWb = relsWb; ctx.tipos = tipos;
  ctx.caminhoDe = f => f.caminho || ctx.caminhosNovos.get(f) || null;

  // 1) mudanças estruturais na ordem em que aconteceram
  if (pasta.ops.length) await reproduzirOps(ctx);

  // 2) conteúdo das planilhas
  const novosTextos = await prepararTextos(ctx);
  if (novosTextos) await carregarTextos(ctx, novosTextos);
  for (const folha of pasta.folhas) {
    if (folha.especial) continue;
    const alteradas = new Set(folha.sujas);
    // fórmulas cujo valor calculado mudou (atualiza o valor guardado no arquivo)
    for (const [k, cel] of folha.celulas) {
      if (cel.f == null || alteradas.has(k)) continue;
      const v = valorConfiavel(pasta, folha, linhaDaChave(k), colunaDaChave(k), cel);
      if (v !== undefined && !mesmoValor(v, cel.cache)) alteradas.add(k);
    }
    const precisa = alteradas.size || folha.linhasSujas.size || folha.colunasSujas || folha.mesclasSujas || folha.painelSujo || ctx.caminhosNovos.has(folha);
    const caminho = ctx.caminhoDe(folha);
    if (!precisa || !caminho) continue;
    const d = await ctx.doc(caminho);
    if (!d) continue;
    sincronizarFolha(ctx, folha, d, alteradas, novosTextos);
  }
  await gravarTextos(ctx, novosTextos);

  // 3) estilos novos
  if (pasta.estilos && pasta.estilos.temNovos()) {
    const relEst = [...ctx.relsWb.doc.getElementsByTagNameNS(NS.rels, "Relationship")].find(e => e.getAttribute("Type") === TIPO_REL.estilos);
    if (relEst) ctx.saida.set(resolverAlvo(pasta.caminhoPasta, relEst.getAttribute("Target")), pasta.estilos.gravar());
  }

  // 4) pasta de trabalho: nomes das abas, recálculo, cadeia de cálculo
  atualizarNomesAbas(ctx);
  if (ctx.mudouConteudo || pasta.ops.length) {
    pedirRecalculo(ctx);
    removerCadeiaCalculo(ctx);
  }

  // 5) serializa as partes alteradas
  for (const [caminho, d] of ctx.docs) if (d.mudou) ctx.saida.set(caminho, gravarXml(d.doc, d.original));

  // 6) monta o novo ZIP (mesma ordem de entradas; as não alteradas mantêm o conteúdo idêntico)
  const novo = new JSZip();
  const opcoes = e => ({ date: e.date, unixPermissions: e.unixPermissions, dosPermissions: e.dosPermissions, comment: e.comment, createFolders: false });
  for (const [nome, e] of Object.entries(ctx.zip.files)) {
    if (ctx.saida.has(nome)) { const v = ctx.saida.get(nome); if (v != null) novo.file(nome, v, { ...opcoes(e), date: new Date() }); continue; }
    if (e.dir) { novo.folder(nome); continue; }
    novo.file(nome, await e.async("uint8array"), opcoes(e));
  }
  for (const [nome, v] of ctx.saida) if (v != null && !ctx.zip.files[nome]) novo.file(nome, v, { createFolders: false });
  const bytes = await novo.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 }, platform: "DOS" });

  const confirmar = () => {
    pasta.zip = novo;
    for (const [f, c] of ctx.caminhosNovos) { f.caminho = c; f.nova = false; }
    for (const f of pasta.folhas) {
      f.sujas.clear(); f.linhasSujas.clear(); f.colunasSujas = false; f.mesclasSujas = false; f.painelSujo = false;
      for (const [k, cel] of f.celulas) if (cel.f != null) { const v = valorConfiavel(pasta, f, linhaDaChave(k), colunaDaChave(k), cel); if (v !== undefined) cel.cache = v; }
    }
    pasta.ops = [];
    pasta.alteracoesPasta = false;
    pasta.estilos?.confirmar?.();
  };
  return { bytes, confirmar };
}

// -------------------------------------------------------------- valores
/** valor calculado que pode ir para o arquivo (undefined = não confiável; mantém o que havia) */
function valorConfiavel(pasta, folha, r, c, cel) {
  let v;
  try { v = pasta.hf.getCellValue({ sheet: folha.hfId, row: r, col: c }); } catch (e) { return undefined; }
  if (v instanceof DetailedCellError) {
    if (!ERROS_EXCEL.has(v.value)) return undefined;
    if (v.type === "NAME" && /not recognized/i.test(v.message || "")) return undefined; // função que o motor não conhece
    if (v.type === "ERROR" || v.type === "CYCLE") return undefined;
    return { erro: v.value };
  }
  if (typeof v === "number" && !isFinite(v)) return undefined;
  return v;
}
function mesmoValor(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return (a == null || a === "") && (b == null || b === "");
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a), Math.abs(b));
  if (typeof a === "object" && typeof b === "object") return a.erro === b.erro;
  return false;
}

// -------------------------------------------------------------- textos compartilhados
async function prepararTextos(ctx) {
  const rel = [...ctx.relsWb.doc.getElementsByTagNameNS(NS.rels, "Relationship")].find(e => e.getAttribute("Type") === TIPO_REL.textos);
  if (!rel) return null; // sem sharedStrings.xml: usa textos embutidos (inlineStr)
  const caminho = resolverAlvo(ctx.pasta.caminhoPasta, rel.getAttribute("Target"));
  if (!ctx.zip.file(caminho)) return null;
  return { caminho, carregado: false, indice: null, lista: null, novos: [], d: null, contagem: 0 };
}
async function carregarTextos(ctx, T) {
  if (T.carregado) return;
  T.d = await ctx.doc(T.caminho);
  const raiz = T.d.doc.documentElement;
  T.indice = new Map(); T.lista = [];
  let i = 0;
  for (let si = raiz.firstElementChild; si; si = si.nextElementSibling) {
    if (si.localName !== "si") continue;
    const txt = textoRico(si);
    T.lista.push(txt);
    // só reaproveita textos simples (sem formatação parcial)
    const t = filho(si, "t");
    if (t && si.childElementCount === 1 && !T.indice.has(txt)) T.indice.set(txt, i);
    i++;
  }
  T.carregado = true;
}
function indiceTexto(T, texto) {
  if (T.indice.has(texto)) return T.indice.get(texto);
  const i = T.lista.length;
  T.lista.push(texto); T.indice.set(texto, i); T.novos.push(texto);
  return i;
}
async function gravarTextos(ctx, T) {
  if (!T || !T.carregado) return;
  if (!T.novos.length && !T.contagem) return;
  const doc = T.d.doc, raiz = doc.documentElement;
  for (const s of T.novos) {
    const si = criar(doc, "si"), t = criar(doc, "t");
    const txt = escaparOoxml(s);
    if (/^\s|\s$|\n/.test(txt)) t.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
    t.textContent = txt;
    si.appendChild(t);
    raiz.appendChild(si);
  }
  raiz.setAttribute("uniqueCount", String(T.lista.length));
  if (raiz.hasAttribute("count")) raiz.setAttribute("count", String(Math.max(T.lista.length, (+raiz.getAttribute("count") || 0) + T.contagem)));
  T.d.mudou = true;
}

// -------------------------------------------------------------- uma planilha
class IndiceFolha {
  constructor(d) {
    this.d = d;
    this.doc = d.doc;
    const raiz = this.doc.documentElement;
    this.sheetData = filho(raiz, "sheetData") || inserirNaOrdem(raiz, criar(this.doc, "sheetData"), ORDEM_FOLHA);
    this.linhas = new Map();
    let r = -1;
    for (let row = this.sheetData.firstElementChild; row; row = row.nextElementSibling) {
      if (row.localName !== "row") continue;
      r = row.hasAttribute("r") ? +row.getAttribute("r") - 1 : r + 1;
      if (!row.hasAttribute("r")) row.setAttribute("r", String(r + 1));
      this.linhas.set(r, { el: row, cels: null });
    }
    this.ordenadas = null;
  }
  celulasDaLinha(L, r) {
    if (L.cels) return L.cels;
    L.cels = new Map();
    let c = -1;
    for (let ce = L.el.firstElementChild; ce; ce = ce.nextElementSibling) {
      if (ce.localName !== "c") continue;
      const ref = ce.getAttribute("r");
      const p = ref ? lerCelula(ref) : null;
      c = p ? p.c : c + 1;
      if (!ref) ce.setAttribute("r", nomeCelula(r, c));
      L.cels.set(c, ce);
    }
    return L.cels;
  }
  linha(r, criarSeFaltar) {
    let L = this.linhas.get(r);
    if (L || !criarSeFaltar) return L || null;
    const el = criar(this.doc, "row");
    el.setAttribute("r", String(r + 1));
    // posição: antes da primeira linha com índice maior
    if (!this.ordenadas) this.ordenadas = [...this.linhas.keys()].sort((a, b) => a - b);
    const pos = buscaMaior(this.ordenadas, r);
    const prox = pos < this.ordenadas.length ? this.linhas.get(this.ordenadas[pos]).el : null;
    this.sheetData.insertBefore(el, prox);
    this.ordenadas.splice(pos, 0, r);
    L = { el, cels: new Map() };
    this.linhas.set(r, L);
    return L;
  }
  cel(r, c, criarSeFaltar) {
    const L = this.linha(r, criarSeFaltar);
    if (!L) return null;
    const cels = this.celulasDaLinha(L, r);
    let ce = cels.get(c);
    if (ce || !criarSeFaltar) return ce || null;
    ce = criar(this.doc, "c");
    ce.setAttribute("r", nomeCelula(r, c));
    let prox = null;
    for (const [cc, e] of cels) if (cc > c && (!prox || cc < prox[0])) prox = [cc, e];
    L.el.insertBefore(ce, prox ? prox[1] : null);
    L.el.removeAttribute("spans");
    cels.set(c, ce);
    return ce;
  }
  remover(r, c) {
    const L = this.linhas.get(r);
    if (!L) return;
    const cels = this.celulasDaLinha(L, r);
    const ce = cels.get(c);
    if (ce) { ce.remove(); cels.delete(c); }
  }
}
function buscaMaior(lista, v) { let a = 0, b = lista.length; while (a < b) { const m = (a + b) >> 1; if (lista[m] <= v) a = m + 1; else b = m; } return a; }

function sincronizarFolha(ctx, folha, d, alteradas, T) {
  const pasta = ctx.pasta;
  const idx = new IndiceFolha(d);
  const grupos = coletarCompartilhadas(idx);
  let mexeuCelulas = false;
  const chaves = [...alteradas].sort((a, b) => a - b);
  for (const k of chaves) {
    const r = linhaDaChave(k), c = colunaDaChave(k);
    if (sincronizarCelula(ctx, pasta, folha, idx, grupos, r, c, T)) mexeuCelulas = true;
  }
  // alturas / linhas ocultas / estilo de linha
  for (const r of folha.linhasSujas) {
    const l = folha.linhas.get(r) || {};
    const tem = l.ht != null || l.oculta || l.s != null;
    const L = idx.linha(r, tem);
    if (!L) continue;
    const e = L.el;
    const def = (n, v) => { if (v == null) { if (e.hasAttribute(n)) { e.removeAttribute(n); mexeuCelulas = true; } } else if (e.getAttribute(n) !== v) { e.setAttribute(n, v); mexeuCelulas = true; } };
    def("ht", l.ht != null ? String(l.ht) : null);
    def("customHeight", l.ht != null && l.custom ? "1" : null);
    def("hidden", l.oculta ? "1" : null);
    def("s", l.s != null ? String(l.s) : null);
    def("customFormat", l.s != null ? "1" : null);
  }
  const raiz = d.doc.documentElement;
  if (folha.colunasSujas) { gravarColunas(d.doc, raiz, folha); d.mudou = true; }
  if (folha.mesclasSujas) { gravarMesclas(d.doc, raiz, folha); d.mudou = true; }
  if (folha.painelSujo) { gravarPainel(d.doc, raiz, folha); d.mudou = true; }
  if (mexeuCelulas) { atualizarDimensao(d.doc, raiz, idx); d.mudou = true; }
}

/** grupos de fórmulas compartilhadas da planilha: si → {mestra, texto, r, c, membros[]} */
function coletarCompartilhadas(idx) {
  const grupos = new Map();
  const fs = idx.doc.getElementsByTagNameNS(NS.main, "f");
  for (let i = 0; i < fs.length; i++) {
    const f = fs[i];
    if (f.getAttribute("t") !== "shared") continue;
    const ce = f.parentNode;
    const p = lerCelula(ce.getAttribute("r") || "");
    if (!p) continue;
    const si = f.getAttribute("si");
    let g = grupos.get(si); if (!g) grupos.set(si, g = { membros: [] });
    if (f.hasAttribute("ref") && f.textContent) { g.mestra = f; g.texto = f.textContent; g.r = p.r; g.c = p.c; }
    g.membros.push({ f, r: p.r, c: p.c });
  }
  return grupos;
}
/** transforma o grupo compartilhado em fórmulas comuns (cada célula com seu texto) */
function descompartilhar(g, transformar = null) {
  if (!g || g.desfeito || !g.mestra) return;
  for (const m of g.membros) {
    let t = transladarFormula(g.texto, m.r - g.r, m.c - g.c);
    if (transformar) t = transformar(t);
    m.f.removeAttribute("t"); m.f.removeAttribute("ref"); m.f.removeAttribute("si");
    m.f.textContent = t;
  }
  g.desfeito = true;
}
function formulaDoDom(fEl, grupos, r, c) {
  if (fEl.getAttribute("t") === "shared" && !fEl.textContent) {
    const g = grupos.get(fEl.getAttribute("si"));
    return g && g.mestra ? transladarFormula(g.texto, r - g.r, c - g.c) : null;
  }
  return fEl.textContent;
}
function valorDoDom(ce, T, ctx) {
  const t = ce.getAttribute("t") || "n";
  const v = filho(ce, "v");
  if (t === "inlineStr") return textoRico(filho(ce, "is"));
  if (!v) return null;
  const s = v.textContent;
  if (t === "s") { if (!T) return null; return T.lista ? T.lista[+s] ?? null : ctx.pasta.textos[+s] ?? null; }
  if (t === "str") return desescapar(s);
  if (t === "b") return s.trim() === "1" || s.trim() === "true";
  if (t === "e") return { erro: s };
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/** escreve uma célula do modelo no XML; devolve true se mudou algo */
function sincronizarCelula(ctx, pasta, folha, idx, grupos, r, c, T) {
  const k = chave(r, c);
  const cel = folha.celulas.get(k) || null;
  let ce = idx.cel(r, c, false);
  const s = cel ? cel.s || 0 : 0;
  const temConteudo = cel && (cel.f != null || pasta.hf.getCellValue({ sheet: folha.hfId, row: r, col: c }) !== null);
  // célula vazia sem estilo: remove
  if (!cel || (!temConteudo && !s && cel.parte == null && !cel.tabelaDados)) {
    if (!ce) return false;
    const f = filho(ce, "f");
    if (f && f.getAttribute("t") === "shared" && f.hasAttribute("ref")) descompartilhar(grupos.get(f.getAttribute("si")));
    // mantém atributos especiais (cm/vm/ph) só se houver; senão remove o elemento
    idx.remover(r, c);
    ctx.mudouConteudo = true;
    return true;
  }
  let mudou = false;
  if (!ce) { ce = idx.cel(r, c, true); mudou = true; }
  // estilo
  const sDom = ce.hasAttribute("s") ? +ce.getAttribute("s") : 0;
  if (sDom !== s) { if (s) ce.setAttribute("s", String(s)); else ce.removeAttribute("s"); mudou = true; }
  if (cel.parte != null || cel.tabelaDados) return mudou; // partes de matriz/tabela de dados: só o estilo

  const fDom = filho(ce, "f");
  if (cel.f != null) {
    const textoDom = fDom ? formulaDoDom(fDom, grupos, r, c) : null;
    const v = valorConfiavel(pasta, folha, r, c, cel);
    if (textoDom !== cel.f || (!!cel.mat !== (fDom && fDom.getAttribute("t") === "array"))) {
      if (fDom && fDom.getAttribute("t") === "shared" && fDom.hasAttribute("ref")) descompartilhar(grupos.get(fDom.getAttribute("si")));
      limparConteudo(ce);
      const f = criar(idx.doc, "f");
      if (cel.mat) { f.setAttribute("t", "array"); f.setAttribute("ref", cel.mat); }
      f.textContent = limparTextoXml(cel.f);
      inserirNaOrdem(ce, f, ["f", "v", "is", "extLst"]);
      escreverValor(ce, idx.doc, v === undefined ? (textoDom === cel.f ? cel.cache : undefined) : v, true, T);
      ctx.mudouConteudo = true;
      return true;
    }
    // fórmula igual: só atualiza o valor guardado
    if (v !== undefined && !mesmoValor(v, valorDoDom(ce, T, ctx))) {
      for (const e of [...ce.children]) if (e.localName === "v" || e.localName === "is") e.remove();
      escreverValor(ce, idx.doc, v, true, T);
      return true;
    }
    return mudou;
  }
  // constante
  const v = pasta.valor(folha, r, c);
  const atual = fDom ? undefined : valorDoDom(ce, T, ctx);
  if (!fDom && mesmoValor(v, atual) && tipoIgual(v, atual)) return mudou;
  if (fDom && fDom.getAttribute("t") === "shared" && fDom.hasAttribute("ref")) descompartilhar(grupos.get(fDom.getAttribute("si")));
  limparConteudo(ce);
  escreverValor(ce, idx.doc, v, false, T);
  ctx.mudouConteudo = true;
  return true;
}
const tipoIgual = (a, b) => typeof a === typeof b;
function limparConteudo(ce) {
  for (const e of [...ce.children]) if (e.localName === "f" || e.localName === "v" || e.localName === "is") e.remove();
  ce.removeAttribute("t");
}
function escreverValor(ce, doc, v, formula, T) {
  ce.removeAttribute("t");
  if (v === undefined || v === null || v === "") {
    if (formula && v === "") { ce.setAttribute("t", "str"); const ve = criar(doc, "v"); inserirNaOrdem(ce, ve, ["f", "v", "is", "extLst"]); }
    return;
  }
  const ve = criar(doc, "v");
  if (typeof v === "number") ve.textContent = String(v);
  else if (typeof v === "boolean") { ce.setAttribute("t", "b"); ve.textContent = v ? "1" : "0"; }
  else if (typeof v === "object") { ce.setAttribute("t", "e"); ve.textContent = v.erro; }
  else if (formula) { ce.setAttribute("t", "str"); ve.textContent = escaparOoxml(String(v)); }
  else if (T) { ce.setAttribute("t", "s"); ve.textContent = String(indiceTexto(T, String(v))); T.contagem++; }
  else {
    ce.setAttribute("t", "inlineStr");
    const is = criar(doc, "is"), t = criar(doc, "t");
    const txt = escaparOoxml(String(v));
    if (/^\s|\s$|\n/.test(txt)) t.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
    t.textContent = txt; is.appendChild(t);
    inserirNaOrdem(ce, is, ["f", "v", "is", "extLst"]);
    return;
  }
  inserirNaOrdem(ce, ve, ["f", "v", "is", "extLst"]);
}

function gravarColunas(doc, raiz, folha) {
  let cols = filho(raiz, "cols");
  const lista = folha.colunas.filter(c => Object.keys(c.attrs).some(k => k !== "min" && k !== "max"));
  if (!lista.length) { if (cols) cols.remove(); return; }
  if (!cols) cols = inserirNaOrdem(raiz, criar(doc, "cols"), ORDEM_FOLHA);
  while (cols.firstChild) cols.removeChild(cols.firstChild);
  // junta faixas vizinhas iguais
  const unidas = [];
  for (const c of lista) {
    const u = unidas[unidas.length - 1];
    const igual = u && u.max + 1 === c.min && JSON.stringify(semMinMax(u.attrs)) === JSON.stringify(semMinMax(c.attrs));
    if (igual) u.max = c.max; else unidas.push({ min: c.min, max: c.max, attrs: c.attrs });
  }
  for (const c of unidas) {
    const e = criar(doc, "col");
    e.setAttribute("min", String(c.min + 1)); e.setAttribute("max", String(Math.min(c.max, MAX_COLUNAS - 1) + 1));
    for (const [k, v] of Object.entries(c.attrs)) if (k !== "min" && k !== "max") e.setAttribute(k, v);
    if (!e.hasAttribute("width")) e.setAttribute("width", String(folha.larguraPadrao || 9.140625));
    cols.appendChild(e);
  }
}
const semMinMax = a => { const o = { ...a }; delete o.min; delete o.max; return o; };

function gravarMesclas(doc, raiz, folha) {
  let mc = filho(raiz, "mergeCells");
  if (!folha.mesclas.length) { if (mc) mc.remove(); return; }
  if (!mc) mc = inserirNaOrdem(raiz, criar(doc, "mergeCells"), ORDEM_FOLHA);
  while (mc.firstChild) mc.removeChild(mc.firstChild);
  for (const m of folha.mesclas) { const e = criar(doc, "mergeCell"); e.setAttribute("ref", nomeIntervalo(m)); mc.appendChild(e); }
  mc.setAttribute("count", String(folha.mesclas.length));
}

function gravarPainel(doc, raiz, folha) {
  let vistas = filho(raiz, "sheetViews");
  if (!vistas) { vistas = inserirNaOrdem(raiz, criar(doc, "sheetViews"), ORDEM_FOLHA); }
  let v = filho(vistas, "sheetView");
  if (!v) { v = criar(doc, "sheetView"); v.setAttribute("workbookViewId", "0"); vistas.appendChild(v); }
  const ativaAnt = filhos(v, "selection").pop()?.getAttribute("activeCell") || "A1";
  for (const e of [...v.children]) if (e.localName === "pane" || e.localName === "selection") e.remove();
  const { linhas, colunas } = folha.congelar;
  if (linhas || colunas) {
    const p = criar(doc, "pane");
    if (colunas) p.setAttribute("xSplit", String(colunas));
    if (linhas) p.setAttribute("ySplit", String(linhas));
    p.setAttribute("topLeftCell", nomeCelula(linhas, colunas));
    const ativo = linhas && colunas ? "bottomRight" : linhas ? "bottomLeft" : "topRight";
    p.setAttribute("activePane", ativo); p.setAttribute("state", "frozen");
    inserirNaOrdem(v, p, ORDEM_VISTA);
    const s = criar(doc, "selection");
    s.setAttribute("pane", ativo); s.setAttribute("activeCell", ativaAnt); s.setAttribute("sqref", ativaAnt);
    inserirNaOrdem(v, s, ORDEM_VISTA);
    v.removeAttribute("topLeftCell");
  } else {
    const s = criar(doc, "selection");
    s.setAttribute("activeCell", ativaAnt); s.setAttribute("sqref", ativaAnt);
    inserirNaOrdem(v, s, ORDEM_VISTA);
  }
}

function atualizarDimensao(doc, raiz, idx) {
  let r1 = Infinity, r2 = -1, c1 = Infinity, c2 = -1;
  for (const [r, L] of idx.linhas) {
    const cels = idx.celulasDaLinha(L, r);
    if (!L.el.isConnected || !cels.size) continue;
    if (r < r1) r1 = r; if (r > r2) r2 = r;
    for (const c of cels.keys()) { if (c < c1) c1 = c; if (c > c2) c2 = c; }
  }
  const ref = r2 < 0 ? "A1" : nomeIntervalo({ r1, c1, r2, c2 });
  let dim = filho(raiz, "dimension");
  if (!dim) dim = inserirNaOrdem(raiz, criar(doc, "dimension"), ORDEM_FOLHA);
  dim.setAttribute("ref", ref);
}

// -------------------------------------------------------------- pasta de trabalho
function relacoes(ctx) { return [...ctx.relsWb.doc.getElementsByTagNameNS(NS.rels, "Relationship")]; }
function elementoFolha(ctx, caminho) {
  const rel = relacoes(ctx).find(e => resolverAlvo(ctx.pasta.caminhoPasta, e.getAttribute("Target")) === caminho);
  if (!rel) return null;
  const id = rel.getAttribute("Id");
  return [...ctx.wb.doc.getElementsByTagNameNS(NS.main, "sheet")].find(e => (e.getAttributeNS(NS.r, "id") || e.getAttribute("r:id")) === id) || null;
}

function atualizarNomesAbas(ctx) {
  for (const f of ctx.pasta.folhas) {
    const c = ctx.caminhoDe(f);
    if (!c) continue;
    const el = elementoFolha(ctx, c);
    if (el && el.getAttribute("name") !== f.nome) { el.setAttribute("name", f.nome); ctx.wb.mudou = true; }
  }
  if (ctx.pasta.alteracoesPasta) atualizarApp(ctx);
}

function pedirRecalculo(ctx) {
  const raiz = ctx.wb.doc.documentElement;
  let calc = filho(raiz, "calcPr");
  if (!calc) { calc = inserirNaOrdem(raiz, criar(ctx.wb.doc, "calcPr"), ORDEM_PASTA); calc.setAttribute("calcId", "191029"); }
  if (calc.getAttribute("fullCalcOnLoad") !== "1") { calc.setAttribute("fullCalcOnLoad", "1"); ctx.wb.mudou = true; }
}

function removerCadeiaCalculo(ctx) {
  for (const rel of relacoes(ctx)) {
    if (rel.getAttribute("Type") !== TIPO_REL.calcChain) continue;
    const caminho = resolverAlvo(ctx.pasta.caminhoPasta, rel.getAttribute("Target"));
    rel.remove(); ctx.relsWb.mudou = true;
    if (ctx.zip.file(caminho)) ctx.excluir(caminho);
    removerTipo(ctx, caminho);
  }
}
function removerTipo(ctx, caminho) {
  for (const o of [...ctx.tipos.doc.getElementsByTagNameNS(NS.ct, "Override")]) if (o.getAttribute("PartName") === "/" + caminho) { o.remove(); ctx.tipos.mudou = true; }
}

/** docProps/app.xml: lista de nomes das planilhas (informativo) */
function atualizarApp() { /* docProps/app.xml é só informativo; o Excel o refaz ao salvar */ }

// -------------------------------------------------------------- operações estruturais
async function reproduzirOps(ctx) {
  const pasta = ctx.pasta;
  // documentos das planilhas existentes no arquivo (todas, pois fórmulas de uma citam outras)
  const todas = new Map(); // Folha → caminho
  const folhasNoArquivo = [...pasta.folhas];
  for (const op of pasta.ops) if (op.tipo === "excluirFolha" && op.folhaObj && !folhasNoArquivo.includes(op.folhaObj)) folhasNoArquivo.push(op.folhaObj);
  for (const f of folhasNoArquivo) if (f.caminho && !f.especial && ctx.zip.file(f.caminho)) todas.set(f, f.caminho);
  const nomesAtuais = new Map();
  // nome de cada planilha no início (desfaz as renomeações em ordem inversa)
  for (const f of folhasNoArquivo) nomesAtuais.set(f, f.nome);
  for (let i = pasta.ops.length - 1; i >= 0; i--) { const op = pasta.ops[i]; if (op.tipo === "renomear") nomesAtuais.set(op.folhaObj, op.de); }
  const graficos = Object.keys(ctx.zip.files).filter(n => /^xl\/charts\/chart[^/]*\.xml$/i.test(n) || /^xl\/charts\/chartEx[^/]*\.xml$/i.test(n));
  const caches = Object.keys(ctx.zip.files).filter(n => /^xl\/pivotCache\/pivotCacheDefinition[^/]*\.xml$/i.test(n));

  for (const op of pasta.ops) {
    if (op.tipo === "novaFolha") {
      const f = op.folhaObj;
      const caminho = novoCaminhoFolha(ctx);
      ctx.caminhosNovos.set(f, caminho);
      const d = ctx.novoDoc(caminho, NOVA_FOLHA.replace('defaultRowHeight="15"', `defaultRowHeight="${f.alturaPadrao || 15}"`));
      d.mudou = true;
      acrescentarFolhaNaPasta(ctx, caminho, nomesAtuais.get(f) || f.nome);
      todas.set(f, caminho);
      nomesAtuais.set(f, nomesAtuais.get(f) || f.nome);
      continue;
    }
    if (op.tipo === "excluirFolha") {
      const f = op.folhaObj;
      const caminho = todas.get(f);
      if (caminho) await excluirFolhaDoArquivo(ctx, f, caminho, op.nome, folhasNoArquivo);
      ctx.caminhosNovos.delete(f);
      todas.delete(f);
      // referências nas outras
      for (const [g, c] of todas) { const d = await ctx.doc(c); if (d) transformarFormulasDoc(d, txt => excluirFolhaNaFormula(txt, op.nome)); }
      transformarNomes(ctx, txt => excluirFolhaNaFormula(txt, op.nome));
      continue;
    }
    if (op.tipo === "renomear") {
      nomesAtuais.set(op.folhaObj, op.para);
      const t = txt => renomearFolhaNaFormula(txt, op.de, op.para);
      for (const [, c] of todas) { const d = await ctx.doc(c); if (d) transformarFormulasDoc(d, t); }
      transformarNomes(ctx, t);
      for (const g of graficos) { const d = await ctx.doc(g); if (d) transformarGrafico(d, t); }
      for (const pc of caches) {
        const d = await ctx.doc(pc); if (!d) continue;
        for (const ws of d.doc.getElementsByTagNameNS(NS.main, "worksheetSource")) if ((ws.getAttribute("sheet") || "").toLowerCase() === op.de.toLowerCase()) { ws.setAttribute("sheet", op.para); d.mudou = true; }
      }
      continue;
    }
    // linhas / colunas
    const alvo = op.folhaObj || folhasNoArquivo.find(f => nomesAtuais.get(f) === op.folha);
    const caminhoAlvo = alvo ? todas.get(alvo) : null;
    const opNome = { ...op, folha: alvo ? nomesAtuais.get(alvo) : op.folha };
    for (const [f, c] of todas) {
      const d = await ctx.doc(c);
      if (!d) continue;
      const ehAlvo = c === caminhoAlvo;
      const nomeF = ehAlvo ? opNome.folha : "\u0000" + (nomesAtuais.get(f) || "");
      if (ehAlvo) await deslocarFolhaDom(ctx, d, c, opNome);
      else deslocarFormulasDoc(d, nomeF, opNome);
    }
    transformarNomes(ctx, (txt, local) => deslocarFormula(txt, local ?? "\u0000", opNome));
    for (const g of graficos) { const d = await ctx.doc(g); if (d) transformarGrafico(d, txt => deslocarFormula(txt, "\u0000", opNome)); }
    for (const pc of caches) {
      const d = await ctx.doc(pc); if (!d) continue;
      for (const ws of d.doc.getElementsByTagNameNS(NS.main, "worksheetSource")) {
        if ((ws.getAttribute("sheet") || "").toLowerCase() !== (opNome.folha || "").toLowerCase() || !ws.getAttribute("ref")) continue;
        const n = deslocarSqref(ws.getAttribute("ref"), opNome);
        if (n && n !== ws.getAttribute("ref")) { ws.setAttribute("ref", n); d.mudou = true; }
      }
    }
  }
  if (pasta.ops.some(o => o.tipo === "excluirFolha" || o.tipo === "novaFolha")) ctx.pasta.alteracoesPasta = true;
}

function novoCaminhoFolha(ctx) {
  let n = 1;
  const existe = c => ctx.zip.file(c) || ctx.docs.has(c) || [...ctx.caminhosNovos.values()].includes(c);
  while (existe(`xl/worksheets/sheet${n}.xml`)) n++;
  return `xl/worksheets/sheet${n}.xml`;
}

function acrescentarFolhaNaPasta(ctx, caminho, nome) {
  const wb = ctx.wb.doc, raiz = wb.documentElement;
  const sheets = filho(raiz, "sheets");
  let maxId = 0; for (const s of filhos(sheets, "sheet")) maxId = Math.max(maxId, +s.getAttribute("sheetId") || 0);
  let n = 1; const ids = new Set(relacoes(ctx).map(e => e.getAttribute("Id")));
  while (ids.has("rId" + n)) n++;
  const rid = "rId" + n;
  const rel = ctx.relsWb.doc.createElementNS(NS.rels, "Relationship");
  rel.setAttribute("Id", rid); rel.setAttribute("Type", TIPO_REL.folha);
  const pastaDir = ctx.pasta.caminhoPasta.split("/").slice(0, -1).join("/");
  rel.setAttribute("Target", caminho.startsWith(pastaDir + "/") ? caminho.slice(pastaDir.length + 1) : "/" + caminho);
  ctx.relsWb.doc.documentElement.appendChild(rel); ctx.relsWb.mudou = true;
  const s = criar(wb, "sheet");
  s.setAttribute("name", nome); s.setAttribute("sheetId", String(maxId + 1));
  let pref = raiz.lookupPrefix(NS.r);
  if (!pref) { raiz.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:r", NS.r); pref = "r"; }
  s.setAttributeNS(NS.r, pref + ":id", rid);
  sheets.appendChild(s); ctx.wb.mudou = true;
  const o = ctx.tipos.doc.createElementNS(NS.ct, "Override");
  o.setAttribute("PartName", "/" + caminho); o.setAttribute("ContentType", CT_FOLHA);
  ctx.tipos.doc.documentElement.appendChild(o); ctx.tipos.mudou = true;
}

async function excluirFolhaDoArquivo(ctx, folha, caminho, nome, folhasNoArquivo) {
  const wb = ctx.wb.doc, raiz = wb.documentElement;
  const el = elementoFolha(ctx, caminho);
  const sheets = filho(raiz, "sheets");
  const lista = filhos(sheets, "sheet");
  const pos = el ? lista.indexOf(el) : -1;
  if (el) {
    const rid = el.getAttributeNS(NS.r, "id") || el.getAttribute("r:id");
    el.remove();
    for (const r of relacoes(ctx)) if (r.getAttribute("Id") === rid) r.remove();
    ctx.relsWb.mudou = true; ctx.wb.mudou = true;
  }
  if (ctx.zip.file(caminho)) ctx.excluir(caminho); else ctx.docs.delete(caminho);
  if (ctx.zip.file(relsDe(caminho))) ctx.excluir(relsDe(caminho));
  removerTipo(ctx, caminho);
  // nomes definidos locais
  if (pos >= 0) {
    const dn = filho(raiz, "definedNames");
    if (dn) {
      for (const n of filhos(dn, "definedName")) {
        if (!n.hasAttribute("localSheetId")) continue;
        const id = +n.getAttribute("localSheetId");
        if (id === pos) n.remove(); else if (id > pos) n.setAttribute("localSheetId", String(id - 1));
      }
      if (!filhos(dn, "definedName").length) dn.remove();
    }
    for (const v of wb.getElementsByTagNameNS(NS.main, "workbookView")) {
      for (const a of ["activeTab", "firstSheet"]) if (v.hasAttribute(a)) { const x = +v.getAttribute(a); if (x >= pos && x > 0) v.setAttribute(a, String(x - 1)); }
    }
  }
  // a aba selecionada não pode ficar sem nenhuma
  void folha; void folhasNoArquivo; void nome;
}

function transformarNomes(ctx, fn) {
  const raiz = ctx.wb.doc.documentElement;
  const dn = filho(raiz, "definedNames");
  if (!dn) return;
  const folhas = filhos(filho(raiz, "sheets"), "sheet");
  for (const n of filhos(dn, "definedName")) {
    const local = n.hasAttribute("localSheetId") ? folhas[+n.getAttribute("localSheetId")]?.getAttribute("name") : null;
    const t = n.textContent;
    const novo = fn(t, local);
    if (novo !== t) { n.textContent = novo; ctx.wb.mudou = true; }
  }
}

function transformarGrafico(d, fn) {
  const fs = d.doc.getElementsByTagNameNS("*", "f");
  for (let i = 0; i < fs.length; i++) {
    const f = fs[i];
    const t = f.textContent;
    if (!t) continue;
    // listas como (Plan1!$A$1,Plan1!$A$3)
    const novo = t.startsWith("(") && t.endsWith(")") ? "(" + fn(t.slice(1, -1)) + ")" : fn(t);
    if (novo !== t) { f.textContent = novo; d.mudou = true; }
  }
}

/** aplica fn ao texto de todas as fórmulas (células, formatação condicional, validação) */
function transformarFormulasDoc(d, fn) {
  const doc = d.doc;
  // fórmulas compartilhadas: se algum membro mudaria, descompartilha
  const idx = { doc };
  const grupos = coletarCompartilhadas(idx);
  for (const g of grupos.values()) {
    if (!g.mestra) continue;
    const muda = g.membros.some(m => { const t = transladarFormula(g.texto, m.r - g.r, m.c - g.c); return fn(t) !== t; });
    if (muda) { descompartilhar(g, fn); d.mudou = true; }
  }
  const fs = doc.getElementsByTagNameNS(NS.main, "f");
  for (let i = 0; i < fs.length; i++) {
    const f = fs[i];
    if (f.getAttribute("t") === "shared") continue;
    const t = f.textContent;
    if (!t) continue;
    const n = fn(t);
    if (n !== t) { f.textContent = n; d.mudou = true; }
  }
  for (const nome of ["formula", "formula1", "formula2"]) {
    for (const e of [...doc.getElementsByTagNameNS(NS.main, nome)]) { const t = e.textContent; const n = fn(t); if (n !== t) { e.textContent = n; d.mudou = true; } }
  }
  for (const e of [...doc.getElementsByTagNameNS(NS.xm, "f")]) { const t = e.textContent; const n = fn(t); if (n !== t) { e.textContent = n; d.mudou = true; } }
}

function deslocarFormulasDoc(d, nomeFolha, op) { transformarFormulasDoc(d, t => deslocarFormula(t, nomeFolha, op)); }

/** "A1:B3 D5" deslocado; "" se tudo foi excluído */
function deslocarSqref(sqref, op) {
  const lin = op.eixo === "lin";
  const max = lin ? MAX_LINHAS : MAX_COLUNAS;
  const out = [];
  for (const parte of sqref.trim().split(/\s+/)) {
    if (!parte) continue;
    const abs = parte.includes("$");
    const g = lerIntervalo(parte);
    if (!g) { out.push(parte); continue; }
    const inteira = lin ? (g.r1 === 0 && g.r2 >= MAX_LINHAS - 1) : (g.c1 === 0 && g.c2 >= MAX_COLUNAS - 1);
    if (inteira) { out.push(parte); continue; }
    const fx = lin ? deslocarFaixa(g.r1, g.r2, op.em, op.n, max) : deslocarFaixa(g.c1, g.c2, op.em, op.n, max);
    if (!fx) continue;
    const ng = lin ? { ...g, r1: fx[0], r2: fx[1] } : { ...g, c1: fx[0], c2: fx[1] };
    let txt = nomeIntervalo(ng);
    if (abs) txt = txt.replace(/([A-Z]+)(\d+)/g, "$$$1$$$2");
    out.push(txt);
  }
  return out.join(" ");
}
function deslocarRefAttr(el, nome, op, removerSeVazio = false) {
  const v = el.getAttribute(nome);
  if (!v) return false;
  const n = deslocarSqref(v, op);
  if (n === v) return false;
  if (!n) { if (removerSeVazio) el.remove(); else el.setAttribute(nome, "A1"); return true; }
  el.setAttribute(nome, n);
  return true;
}

async function deslocarFolhaDom(ctx, d, caminho, op) {
  const doc = d.doc, raiz = doc.documentElement;
  const lin = op.eixo === "lin";
  const max = lin ? MAX_LINHAS : MAX_COLUNAS;
  const idx = new IndiceFolha(d);
  // 1) fórmulas compartilhadas viram comuns (as posições vão mudar)
  for (const g of coletarCompartilhadas(idx).values()) descompartilhar(g);
  // 2) linhas e células
  for (const [r, L] of [...idx.linhas]) {
    const cels = idx.celulasDaLinha(L, r);
    if (lin) {
      const v = deslocarIndice(r, op.em, op.n, max);
      if (v == null) { L.el.remove(); continue; }
      if (v !== r) {
        L.el.setAttribute("r", String(v + 1));
        for (const [c, ce] of cels) ce.setAttribute("r", nomeCelula(v, c));
      }
    } else {
      let mexeu = false;
      for (const [c, ce] of cels) {
        const v = deslocarIndice(c, op.em, op.n, max);
        if (v == null) { ce.remove(); mexeu = true; continue; }
        if (v !== c) { ce.setAttribute("r", nomeCelula(r, v)); mexeu = true; }
      }
      if (mexeu) L.el.removeAttribute("spans");
    }
  }
  // 3) fórmulas (inclusive a própria planilha) e matrizes
  deslocarFormulasDoc(d, op.folha, op);
  for (const f of [...doc.getElementsByTagNameNS(NS.main, "f")]) {
    if (f.getAttribute("t") === "array" && f.hasAttribute("ref")) {
      const n = deslocarSqref(f.getAttribute("ref"), op);
      if (n) f.setAttribute("ref", n);
    }
  }
  // 4) referências de áreas na planilha
  const porNome = n => [...doc.getElementsByTagNameNS(NS.main, n)];
  for (const e of porNome("conditionalFormatting")) deslocarRefAttr(e, "sqref", op, true);
  for (const e of porNome("dataValidation")) deslocarRefAttr(e, "sqref", op, true);
  for (const e of porNome("hyperlink")) deslocarRefAttr(e, "ref", op, true);
  for (const e of porNome("ignoredError")) deslocarRefAttr(e, "sqref", op, true);
  for (const e of porNome("protectedRange")) deslocarRefAttr(e, "sqref", op, true);
  for (const e of porNome("autoFilter")) deslocarRefAttr(e, "ref", op, true);
  for (const e of porNome("sortState")) deslocarRefAttr(e, "ref", op, true);
  for (const e of porNome("sortCondition")) deslocarRefAttr(e, "ref", op, true);
  for (const e of porNome("selection")) { deslocarRefAttr(e, "sqref", op); deslocarRefAttr(e, "activeCell", op); }
  for (const e of porNome("pane")) deslocarRefAttr(e, "topLeftCell", op);
  for (const e of porNome("sheetView")) deslocarRefAttr(e, "topLeftCell", op);
  for (const e of [...doc.getElementsByTagNameNS(NS.xm, "sqref")]) { const n = deslocarSqref(e.textContent, op); if (!n) { const pai = e.parentNode; pai?.parentNode?.removeChild(pai); } else e.textContent = n; }
  const dv = filho(raiz, "dataValidations");
  if (dv) { const n = filhos(dv, "dataValidation").length; if (!n) dv.remove(); else dv.setAttribute("count", String(n)); }
  const quebras = filho(raiz, lin ? "rowBreaks" : "colBreaks");
  if (quebras) {
    for (const b of filhos(quebras, "brk")) { const v = deslocarIndice(+b.getAttribute("id"), op.em, op.n, max); if (v == null) b.remove(); else b.setAttribute("id", String(v)); }
    const n = filhos(quebras, "brk").length;
    if (!n) quebras.remove(); else { quebras.setAttribute("count", String(n)); if (quebras.hasAttribute("manualBreakCount")) quebras.setAttribute("manualBreakCount", String(n)); }
  }
  d.mudou = true;
  // 5) partes ligadas à planilha: desenhos, comentários, tabelas
  const rels = await lerRelacoesCtx(ctx, caminho);
  for (const rel of rels) {
    if (rel.externo || !rel.caminho) continue;
    if (/\/drawing$/.test(rel.tipo)) { const dd = await ctx.doc(rel.caminho); if (dd) deslocarDesenho(dd, op); }
    else if (/\/comments$/.test(rel.tipo)) { const dd = await ctx.doc(rel.caminho); if (dd) deslocarComentarios(dd, op, "comment"); }
    else if (/\/threadedComment$/.test(rel.tipo)) { const dd = await ctx.doc(rel.caminho); if (dd) deslocarComentarios(dd, op, "threadedComment"); }
    else if (/\/table$/.test(rel.tipo)) {
      const dd = await ctx.doc(rel.caminho); if (!dd) continue;
      const t = dd.doc.documentElement;
      if (deslocarRefAttr(t, "ref", op)) dd.mudou = true;
      for (const af of dd.doc.getElementsByTagNameNS(NS.main, "autoFilter")) if (deslocarRefAttr(af, "ref", op)) dd.mudou = true;
    } else if (/\/vmlDrawing$/.test(rel.tipo)) {
      const t = await ctx.texto(rel.caminho);
      if (t != null) { const n = deslocarVml(t, op); if (n !== t) ctx.saida.set(rel.caminho, n); }
    }
  }
}

async function lerRelacoesCtx(ctx, caminho) {
  const t = await ctx.texto(relsDe(caminho));
  if (t == null) return [];
  const d = lerXml(t);
  return [...d.getElementsByTagNameNS(NS.rels, "Relationship")].map(e => ({ tipo: e.getAttribute("Type"), externo: e.getAttribute("TargetMode") === "External", caminho: e.getAttribute("TargetMode") === "External" ? null : resolverAlvo(caminho, e.getAttribute("Target")) }));
}

function deslocarDesenho(d, op) {
  const lin = op.eixo === "lin";
  const nome = lin ? "row" : "col";
  for (const ancora of ["from", "to"]) {
    for (const e of [...d.doc.getElementsByTagNameNS(NS.xdr, ancora)]) {
      const x = filho(e, nome), off = filho(e, nome + "Off");
      if (!x) continue;
      const v = +x.textContent;
      let nv;
      if (op.n > 0) nv = v >= op.em ? v + op.n : v;
      else { const k = -op.n; nv = v >= op.em + k ? v - k : v >= op.em ? op.em : v; if (v >= op.em && v < op.em + k && off) off.textContent = "0"; }
      if (nv !== v) { x.textContent = String(nv); d.mudou = true; }
    }
  }
}

function deslocarComentarios(d, op, tag) {
  for (const e of [...d.doc.getElementsByTagNameNS("*", tag)]) {
    const ref = e.getAttribute("ref");
    if (!ref) continue;
    const n = deslocarSqref(ref, op);
    if (!n) { e.remove(); d.mudou = true; }
    else if (n !== ref) { e.setAttribute("ref", n); d.mudou = true; }
  }
}

function deslocarVml(texto, op) {
  const lin = op.eixo === "lin";
  const max = lin ? MAX_LINHAS : MAX_COLUNAS;
  return texto.replace(/<v:shape\b[\s\S]*?<\/v:shape>/g, bloco => {
    const tag = lin ? "x:Row" : "x:Column";
    const m = new RegExp(`<${tag}>(\\d+)</${tag}>`).exec(bloco);
    if (!m) return bloco;
    const v = deslocarIndice(+m[1], op.em, op.n, max);
    if (v == null) return "";
    let b = bloco.replace(m[0], `<${tag}>${v}</${tag}>`);
    b = b.replace(/<x:Anchor>([^<]*)<\/x:Anchor>/, (mm, a) => {
      const p = a.split(",").map(s => s.trim());
      if (p.length !== 8) return mm;
      const i1 = lin ? 2 : 0, i2 = lin ? 6 : 4;
      for (const i of [i1, i2]) { const x = +p[i]; const nx = op.n > 0 ? (x >= op.em ? x + op.n : x) : (x >= op.em - op.n ? x + op.n : x >= op.em ? op.em : x); p[i] = String(nx); }
      return `<x:Anchor>${p.join(", ")}</x:Anchor>`;
    });
    return b;
  });
}

export { letraColuna };
