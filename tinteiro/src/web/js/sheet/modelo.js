// Modelo da pasta de trabalho: células (estilo e fórmula no idioma do arquivo), valores calculados pelo HyperFormula,
// operações com desfazer/refazer e o registro das mudanças estruturais para gravar o arquivo depois.
import { HyperFormula, DetailedCellError } from "hyperformula";
import { Emitter } from "../util/events.js";
import { chave, linhaDaChave, colunaDaChave, MAX_LINHAS, MAX_COLUNAS, lerIntervalo, dentro, intersecta, nomeIntervalo } from "./enderecos.js";
import { paraIngles, paraPortugues, paraMotor, deslocarFormula, deslocarIndice, deslocarFaixa, transladarFormula, renomearFolhaNaFormula, excluirFolhaNaFormula } from "./formula.js";
import { interpretarEntrada, valorParaEdicao, formatar, formatoGeral, numeroParaEdicao, lerNumeroBR, lerNumeroEN, ehFormatoPercentual, ehFormatoData, tipoFormato } from "./formatos.js";
import { ERROS_EN_PT } from "./funcoes.js";
import { paraHF } from "./xlsx-leitor.js";

export const CONFIG_HF = {
  licenseKey: "gpl-v3", maxRows: MAX_LINHAS, maxColumns: MAX_COLUNAS, undoLimit: 1000, evaluateNullToZero: true, accentSensitive: true,
  localeLang: "pt-BR", dateFormats: ["DD/MM/YYYY", "DD/MM/YY", "YYYY-MM-DD"], timeFormats: ["hh:mm", "hh:mm:ss.sss"], currencySymbol: ["R$", "$"],
};
const LIMITE_DESFAZER = 400;
let seqFolha = 0;

export class Folha {
  constructor(pasta, d) {
    this.pasta = pasta;
    this.id = ++seqFolha;
    this.nome = d.nome;
    this.caminho = d.caminho || null;
    this.sheetId = d.sheetId || null;
    this.rId = d.rId || null;
    this.estado = d.estado || "visible";
    this.especial = !!d.especial;
    this.celulas = d.celulas || new Map();
    this.linhas = d.linhas || new Map();
    this.colunas = d.colunas || [];
    this.mesclas = d.mesclas || [];
    this.congelar = d.congelar || { linhas: 0, colunas: 0 };
    this.grade = d.grade !== false;
    this.zoom = d.zoom || 100;
    this.topo = d.topo || null;
    this.alturaPadrao = d.alturaPadrao || 15;
    this.larguraPadrao = d.larguraPadrao || null;
    this.larguraBase = d.larguraBase || 8;
    this.corAba = d.corAba || null;
    this.tabelas = d.tabelas || [];
    this.temDinamica = !!d.temDinamica;
    this.limite = { r: d.maxR ?? -1, c: d.maxC ?? -1 };
    this.sujas = new Set();
    this.linhasSujas = new Set();
    this.colunasSujas = false;
    this.mesclasSujas = false;
    this.painelSujo = false;
    this.hfId = null;
  }
  cel(r, c) { return this.celulas.get(chave(r, c)); }
  /** mescla que contém (r, c) */
  mesclaEm(r, c) { for (const m of this.mesclas) if (r >= m.r1 && r <= m.r2 && c >= m.c1 && c <= m.c2) return m; return null; }
  colunaInfo(c) { for (const col of this.colunas) { if (c < col.min) return null; if (c <= col.max) return col; } return null; }
  estiloColuna(c) { const col = this.colunaInfo(c); return col && col.attrs.style ? +col.attrs.style : 0; }
  estiloLinha(r) { const l = this.linhas.get(r); return l && l.s != null ? l.s : null; }
  /** estilo de uma célula nova (herda da linha ou da coluna, como o Excel) */
  estiloNovo(r, c) { const sl = this.estiloLinha(r); if (sl != null) return sl; return this.estiloColuna(c); }
  estilo(r, c) { const cel = this.cel(r, c); return cel ? cel.s : this.estiloNovo(r, c); }
  estender(r, c) { if (r > this.limite.r) this.limite.r = r; if (c > this.limite.c) this.limite.c = c; }
}

export class Pasta extends Emitter {
  /** dados: resultado de lerXlsx() ou do leitor de CSV */
  constructor(dados) {
    super();
    this.tipo = dados.tipo;
    this.zip = dados.zip || null;
    this.caminhoPasta = dados.caminhoPasta || null;
    this.estilos = dados.estilos || null;
    this.textos = dados.textos || [];
    this.data1904 = !!dados.data1904;
    this.nomes = dados.nomes || [];
    this.csv = dados.csv || null; // {sep, decimalVirgula, codificacao, bom, fimDeLinha, terminaComQuebra, aspasSempre, larguras}
    this.folhas = dados.folhas.map(f => new Folha(this, f));
    this.abaAtiva = dados.abaAtiva || 0;
    this.ops = [];
    this.pilhaDesfazer = [];
    this.pilhaRefazer = [];
    this.alteracoesPasta = false; // nomes de planilhas, novas planilhas…
    this.construirMotor(dados.folhas);
  }

  construirMotor(folhasDados) {
    const folhas = {};
    folhasDados.forEach((fd, i) => {
      const linhas = fd.hf || [];
      const out = new Array(linhas.length);
      for (let r = 0; r < linhas.length; r++) {
        const l = linhas[r];
        if (!l) { out[r] = []; continue; }
        const o = new Array(l.length);
        for (let c = 0; c < l.length; c++) {
          const v = l[c];
          if (v == null) o[c] = null;
          else if (typeof v === "object" && v.formula != null) o[c] = v.mat ? "=ARRAYFORMULA(" + paraMotor(v.formula) + ")" : "=" + paraMotor(v.formula);
          else o[c] = v;
        }
        out[r] = o;
      }
      folhas[this.folhas[i].nome] = out;
    });
    const cfg = { ...CONFIG_HF };
    if (this.data1904) cfg.nullDate = { year: 1904, month: 1, day: 1 };
    this.hf = HyperFormula.buildFromSheets(folhas, cfg);
    for (const f of this.folhas) f.hfId = this.hf.getSheetId(f.nome);
    for (const n of this.nomes) {
      if (!n.nome || n.nome.startsWith("_xlnm.") || /#REF!|\[\d+\]/.test(n.texto)) continue;
      try {
        const escopo = n.local != null && this.folhas[n.local] ? this.folhas[n.local].hfId : undefined;
        this.hf.addNamedExpression(n.nome, "=" + paraMotor(n.texto), escopo);
      } catch (e) { /* nome que o motor não aceita: ignora (fica no arquivo) */ }
    }
    this.hf.clearUndoStack();
  }

  destruir() { try { this.hf?.destroy(); } catch (e) { /* ignora */ } this.hf = null; }

  folhaPorNome(nome) { const N = nome.toLocaleUpperCase("pt-BR"); return this.folhas.find(f => f.nome.toLocaleUpperCase("pt-BR") === N) || null; }

  // -------------------------------------------------------------- leitura de valores
  /** valor calculado: number | string | boolean | {erro} | null */
  valor(folha, r, c) {
    if (folha.especial) return null;
    const cel = folha.celulas.get(chave(r, c));
    let v;
    try { v = this.hf.getCellValue({ sheet: folha.hfId, row: r, col: c }); } catch (e) { return cel?.cache ?? null; }
    if (v instanceof DetailedCellError) {
      // função que o motor não conhece: mostra o valor que veio do arquivo
      if (cel && cel.cache !== undefined && cel.cache !== null && (v.type === "NAME" || v.type === "ERROR" || v.type === "SPILL" || v.type === "CYCLE" || v.type === "VALUE" && cel.mat)) return cel.cache;
      return { erro: v.value, tipo: v.type };
    }
    if (v === null && cel && cel.parte != null && cel.cache != null) return cel.cache;
    if (v === null && cel && cel.tabelaDados) return cel.cache ?? null;
    return v;
  }

  formato(folha, r, c) { return this.estilos ? this.estilos.formato(folha.estilo(r, c)) : "General"; }

  /** texto para mostrar na célula: {texto, cor, esquerda, direita, numero, alinhar} */
  exibir(folha, r, c) {
    const v = this.valor(folha, r, c);
    if (v === null || v === undefined || v === "") {
      return null;
    }
    const cel = folha.celulas.get(chave(r, c));
    if (this.tipo === "csv") {
      if (cel && cel.raw != null && cel.f == null) {
        return { texto: cel.raw, numero: typeof v === "number", alinhar: typeof v === "number" ? "right" : typeof v === "boolean" ? "center" : "left" };
      }
    }
    if (typeof v === "object") return { texto: ERROS_EN_PT[v.erro] || v.erro, alinhar: "center", erro: true };
    if (typeof v === "boolean") return { texto: v ? "VERDADEIRO" : "FALSO", alinhar: "center" };
    const fmt = this.estilos ? this.estilos.formato(cel ? cel.s : folha.estiloNovo(r, c)) : "General";
    if (typeof v === "number") {
      const r2 = formatar(this.data1904 && ehFormatoData(fmt) ? v + 1462 : v, fmt);
      r2.numero = true; r2.alinhar = "right";
      return r2;
    }
    const r3 = fmt === "General" || fmt === "@" ? { texto: v } : formatar(v, fmt);
    r3.alinhar = "left";
    return r3;
  }

  /** texto mostrado na barra de fórmulas / ao editar */
  textoEdicao(folha, r, c) {
    const cel = folha.celulas.get(chave(r, c));
    if (cel && cel.parte != null) { const m = folha.celulas.get(cel.parte); if (m && m.f) return "{=" + paraPortugues(m.f) + "}"; }
    if (this.tipo === "csv" && cel && cel.raw != null) return cel.raw;
    if (cel && cel.f != null) return (cel.mat ? "{=" : "=") + paraPortugues(cel.f) + (cel.mat ? "}" : "");
    const v = this.valor(folha, r, c);
    if (v === null || v === undefined) return "";
    if (typeof v === "object") return ERROS_EN_PT[v.erro] || v.erro;
    const fmt = this.formato(folha, r, c);
    const prefixo = typeof v === "string" && this.estilos && this.estilos.xf(cel ? cel.s : 0).prefixo ? "'" : "";
    return prefixo + valorParaEdicao(this.data1904 && typeof v === "number" && ehFormatoData(fmt) ? v + 1462 : v, fmt);
  }

  /** texto no padrão para copiar para outro programa (como aparece na célula) */
  textoCopia(folha, r, c) {
    const e = this.exibir(folha, r, c);
    return e ? e.texto : "";
  }

  // -------------------------------------------------------------- desfazer / refazer
  registrar(entrada) {
    this.pilhaDesfazer.push(entrada);
    if (this.pilhaDesfazer.length > LIMITE_DESFAZER) this.pilhaDesfazer.shift();
    this.pilhaRefazer = [];
    this.emit("historico");
  }
  get podeDesfazer() { return this.pilhaDesfazer.length > 0; }
  get podeRefazer() { return this.pilhaRefazer.length > 0; }
  desfazer() {
    const e = this.pilhaDesfazer.pop();
    if (!e) return null;
    if (e.hf) this.hf.undo();
    e.desfazer();
    this.pilhaRefazer.push(e);
    this.emit("mudou", { folha: e.folha, estrutura: !!e.estrutura, desfazer: true });
    this.emit("historico");
    return e;
  }
  refazer() {
    const e = this.pilhaRefazer.pop();
    if (!e) return null;
    if (e.hf) this.hf.redo();
    e.refazer();
    this.pilhaDesfazer.push(e);
    this.emit("mudou", { folha: e.folha, estrutura: !!e.estrutura });
    this.emit("historico");
    return e;
  }
  limparHistorico() { this.pilhaDesfazer = []; this.pilhaRefazer = []; try { this.hf.clearUndoStack(); } catch (e) { /* ignora */ } this.emit("historico"); }

  // -------------------------------------------------------------- escrita de células
  /** prepara a célula a partir do texto digitado. Devolve {cel, hf} ou {erro} */
  prepararTexto(folha, r, c, texto, celAtual) {
    const s = celAtual ? celAtual.s : folha.estiloNovo(r, c);
    const fmt = this.estilos ? this.estilos.formato(s) : "General";
    if (this.tipo === "csv") return this.prepararCsv(texto, s);
    if (fmt === "@" && texto !== "") return { cel: { s }, hf: "'" + texto };
    const e = interpretarEntrada(texto);
    if (e.tipo === "vazio") return { cel: s ? { s } : null, hf: null };
    if (e.tipo === "formula") {
      const f = paraIngles(e.valor);
      const motor = "=" + paraMotor(f);
      if (!this.hf.validateFormula(motor)) return { erro: "Há um problema com esta fórmula. Confira parênteses, aspas e separadores (use ; entre os argumentos)." };
      return { cel: { s, f }, hf: motor };
    }
    if (e.tipo === "numero") {
      let v = e.valor, sNovo = s;
      if (ehFormatoPercentual(fmt) && !/%\s*$/.test(texto)) v = v / 100;
      if (e.formato && this.estilos && /^general$/i.test(fmt)) sNovo = this.estilos.comMudanca(s, { formato: e.formato });
      if (this.data1904 && e.formato && ehFormatoData(e.formato)) v -= 1462;
      return { cel: { s: sNovo }, hf: v };
    }
    if (e.tipo === "bool") return { cel: { s }, hf: e.valor };
    return { cel: { s }, hf: "'" + e.valor };
  }

  prepararCsv(texto, s = 0) {
    if (texto === "") return { cel: null, hf: null };
    if (texto.startsWith("=") && texto.length > 1) {
      const f = paraIngles(texto.slice(1));
      const motor = "=" + paraMotor(f);
      if (this.hf.validateFormula(motor)) return { cel: { s, raw: texto, f }, hf: motor };
      return { cel: { s, raw: texto }, hf: "'" + texto };
    }
    const n = this.csv && !this.csv.decimalVirgula ? lerNumeroEN(texto) : lerNumeroBR(texto, { pontoDecimal: false });
    if (n) return { cel: { s, raw: texto }, hf: n.valor };
    return { cel: { s, raw: texto }, hf: "'" + texto };
  }

  /** número → texto como seria digitado no CSV */
  numeroCsv(v) {
    if (this.csv && !this.csv.decimalVirgula) return String(Number(v.toPrecision(15)));
    return numeroParaEdicao(v);
  }

  /**
   * Grava várias células de uma vez (uma única ação de desfazer).
   * itens: [{r, c, texto}] ou [{r, c, cel, hf}] (cel = null apaga)
   */
  definir(folha, itens, { nome = "Editar" } = {}) {
    const mudancas = [];
    for (const it of itens) {
      const k = chave(it.r, it.c);
      const antes = folha.celulas.get(k) || null;
      let p;
      if ("texto" in it) {
        p = this.prepararTexto(folha, it.r, it.c, it.texto, antes);
        if (p.erro) return { erro: p.erro };
      } else p = { cel: it.cel, hf: it.hf };
      let depois = p.cel ? { ...p.cel } : null;
      if (depois && !depois.s && depois.f == null && depois.raw == null && p.hf == null) depois = null;
      if (depois && !depois.s) depois.s = 0;
      if (depois && depois.s === 0 && depois.f == null && depois.raw == null && (p.hf === null || p.hf === undefined)) depois = null;
      mudancas.push({ r: it.r, c: it.c, k, antes, depois, hf: p.hf === undefined ? null : p.hf, mudaValor: it.soEstilo ? false : true });
    }
    // não deixa mexer em parte de fórmula de matriz
    for (const m of mudancas) {
      const a = m.antes;
      if (!m.mudaValor) continue;
      if (a && (a.parte != null || (a.mat && lerIntervaloSeguro(a.mat, true)))) {
        const mestra = a.parte != null ? a.parte : m.k;
        const ref = a.parte != null ? folha.celulas.get(a.parte)?.mat : a.mat;
        const g = ref ? lerIntervalo(ref) : null;
        const todas = g ? itens.length >= (g.r2 - g.r1 + 1) * (g.c2 - g.c1 + 1) && mudancas.some(x => x.k === mestra) : false;
        if (!todas) return { erro: "Não é possível alterar parte de uma matriz." };
      }
    }
    const comValor = mudancas.filter(m => m.mudaValor);
    if (comValor.length) {
      this.hf.batch(() => {
        for (const m of comValor) this.hf.setCellContents({ sheet: folha.hfId, row: m.r, col: m.c }, [[m.hf]]);
      });
    }
    const aplicar = lado => {
      for (const m of mudancas) {
        const cel = m[lado];
        if (cel) folha.celulas.set(m.k, cel); else folha.celulas.delete(m.k);
        folha.sujas.add(m.k);
        if (cel) folha.estender(m.r, m.c);
      }
    };
    aplicar("depois");
    this.registrar({ nome, folha, hf: comValor.length > 0, desfazer: () => aplicar("antes"), refazer: () => aplicar("depois") });
    this.emit("mudou", { folha });
    return { ok: true };
  }

  /** conteúdo "cru" de uma célula para copiar/mover dentro da pasta */
  conteudo(folha, r, c) {
    const cel = folha.celulas.get(chave(r, c)) || null;
    if (cel && cel.f != null) return { cel, hf: (cel.mat ? "=ARRAYFORMULA(" + paraMotor(cel.f) + ")" : "=" + paraMotor(cel.f)) };
    let v;
    try { v = this.hf.getCellSerialized({ sheet: folha.hfId, row: r, col: c }); } catch (e) { v = null; }
    if (typeof v === "string" && !v.startsWith("'") && !v.startsWith("#")) v = "'" + v;
    if (v instanceof DetailedCellError) v = v.value;
    return { cel, hf: v ?? null };
  }

  /** apaga conteúdo e/ou formatos de um intervalo */
  limpar(folha, g, { conteudo = true, formatos = false } = {}) {
    const itens = [];
    const visitar = (r, c, cel) => {
      if (!cel) return;
      if (conteudo && formatos) itens.push({ r, c, cel: null, hf: null });
      else if (conteudo) { if (cel.f != null || cel.raw != null || this.hf.getCellValue({ sheet: folha.hfId, row: r, col: c }) !== null || cel.cache != null) itens.push({ r, c, cel: cel.s ? { s: cel.s } : null, hf: null }); }
      else if (formatos && cel.s) { const { hf } = this.conteudo(folha, r, c); itens.push({ r, c, cel: { ...cel, s: 0 }, hf, soEstilo: true }); }
    };
    this.paraCadaCelula(folha, g, visitar);
    // matriz inteira selecionada: apaga também as partes
    if (!itens.length) return { ok: true, vazio: true };
    return this.definir(folha, itens, { nome: formatos ? "Limpar formatos" : "Limpar" });
  }

  /** visita as células existentes dentro do intervalo (eficiente para colunas/linhas inteiras) */
  paraCadaCelula(folha, g, fn) {
    const area = (g.r2 - g.r1 + 1) * (g.c2 - g.c1 + 1);
    if (area > folha.celulas.size * 2) {
      const lista = [];
      for (const [k, cel] of folha.celulas) {
        const r = linhaDaChave(k), c = colunaDaChave(k);
        if (r >= g.r1 && r <= g.r2 && c >= g.c1 && c <= g.c2) lista.push([r, c, cel]);
      }
      lista.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      for (const [r, c, cel] of lista) fn(r, c, cel);
    } else {
      for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) { const cel = folha.celulas.get(chave(r, c)); if (cel) fn(r, c, cel); }
    }
  }

  // -------------------------------------------------------------- formatação
  /**
   * Aplica mudança de estilo (negrito, cores, formato…) a um intervalo.
   * Linhas/colunas inteiras mudam também o estilo da linha/coluna (para células novas).
   */
  formatar(folha, g, mudanca, { nome = "Formatar" } = {}) {
    if (!this.estilos || !this.estilos.doc) return { erro: this.tipo === "csv" ? "Arquivos CSV não guardam formatação." : "Esta planilha não tem estilos." };
    const colunasInteiras = g.r1 === 0 && g.r2 >= MAX_LINHAS - 1;
    const linhasInteiras = g.c1 === 0 && g.c2 >= MAX_COLUNAS - 1;
    const area = (g.r2 - g.r1 + 1) * (g.c2 - g.c1 + 1);
    if (!colunasInteiras && !linhasInteiras && area > 250000) return { erro: "Selecione uma área menor para formatar (no máximo 250 mil células)." };
    const novo = new Map();
    const est = s => { if (!novo.has(s)) novo.set(s, this.estilos.comMudanca(s, mudanca)); return novo.get(s); };
    const itens = [];
    const antesCols = clonarColunas(folha.colunas), antesLinhas = new Map(folha.linhas);
    if (colunasInteiras || linhasInteiras) {
      this.paraCadaCelula(folha, g, (r, c, cel) => itens.push({ k: chave(r, c), r, c, antes: cel, depois: { ...cel, s: est(cel.s) } }));
      if (colunasInteiras) {
        dividirColunas(folha, g.c1, Math.min(g.c2, MAX_COLUNAS - 1), col => { const s = est(col.attrs.style ? +col.attrs.style : 0); if (s) col.attrs.style = String(s); else delete col.attrs.style; }, true);
        folha.colunasSujas = true;
        // linhas com estilo próprio também recebem
        for (const [r, l] of folha.linhas) if (l.s != null) { folha.linhas.set(r, { ...l, s: est(l.s) }); folha.linhasSujas.add(r); }
      } else {
        const fim = Math.min(g.r2, g.r1 + 100000);
        for (let r = g.r1; r <= fim; r++) {
          const l = folha.linhas.get(r) || {};
          folha.linhas.set(r, { ...l, s: est(l.s != null ? l.s : 0) });
          folha.linhasSujas.add(r);
        }
      }
    } else {
      for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) {
        const k = chave(r, c);
        const cel = folha.celulas.get(k);
        if (cel && cel.parte != null && !dentro(g, linhaDaChave(cel.parte), colunaDaChave(cel.parte))) { /* parte de matriz: formata mesmo assim */ }
        const s0 = cel ? cel.s : folha.estiloNovo(r, c);
        const s1 = est(s0);
        if (cel && s1 === cel.s) continue;
        if (!cel && s1 === 0) continue;
        itens.push({ k, r, c, antes: cel || null, depois: cel ? { ...cel, s: s1 } : { s: s1 } });
      }
    }
    const depoisCols = clonarColunas(folha.colunas), depoisLinhas = new Map(folha.linhas);
    const aplicar = lado => {
      for (const it of itens) { const cel = it[lado]; if (cel) folha.celulas.set(it.k, cel); else folha.celulas.delete(it.k); folha.sujas.add(it.k); if (cel) folha.estender(it.r, it.c); }
      if (colunasInteiras || linhasInteiras) {
        folha.colunas = clonarColunas(lado === "antes" ? antesCols : depoisCols);
        folha.linhas = new Map(lado === "antes" ? antesLinhas : depoisLinhas);
        folha.colunasSujas = true;
      }
    };
    aplicar("depois");
    this.registrar({ nome, folha, hf: false, desfazer: () => aplicar("antes"), refazer: () => aplicar("depois") });
    this.emit("mudou", { folha, estilo: true });
    return { ok: true };
  }

  /** estilo efetivo para a barra de ferramentas */
  infoEstilo(folha, r, c) {
    if (!this.estilos) return null;
    const s = folha.estilo(r, c);
    const x = this.estilos.xf(s);
    const f = this.estilos.fontes[x.fontId] || this.estilos.fontes[0];
    const fmt = this.estilos.formato(s);
    return { s, b: f.b, i: f.i, u: !!f.u, tachado: f.s, h: x.h, v: x.v, quebra: x.quebra, formato: fmt, tipoFormato: tipoFormato(fmt), tam: f.tam, fonte: f.nome };
  }

  // -------------------------------------------------------------- larguras, alturas, ocultar, congelar
  larguraColunas(folha, c1, c2, largura /* em caracteres do Excel */) {
    const antes = clonarColunas(folha.colunas);
    dividirColunas(folha, c1, c2, col => { col.attrs.width = String(largura); col.attrs.customWidth = "1"; delete col.attrs.bestFit; if (largura <= 0) col.attrs.hidden = "1"; else delete col.attrs.hidden; }, true);
    const depois = clonarColunas(folha.colunas);
    const aplicar = l => { folha.colunas = clonarColunas(l); folha.colunasSujas = true; };
    aplicar(depois);
    this.registrar({ nome: "Largura da coluna", folha, hf: false, desfazer: () => aplicar(antes), refazer: () => aplicar(depois), geometria: true });
    this.emit("mudou", { folha, geometria: true });
  }

  alturaLinhas(folha, r1, r2, pt /* null = automática */) {
    const antes = new Map();
    for (let r = r1; r <= r2; r++) antes.set(r, folha.linhas.get(r) || null);
    const aplicarDepois = () => {
      for (let r = r1; r <= r2; r++) {
        const l = { ...(folha.linhas.get(r) || {}) };
        if (pt == null) { delete l.ht; delete l.custom; } else { l.ht = pt; l.custom = true; if (pt <= 0) l.oculta = true; else delete l.oculta; }
        if (Object.keys(l).length) folha.linhas.set(r, l); else folha.linhas.delete(r);
        folha.linhasSujas.add(r);
      }
    };
    const aplicarAntes = () => { for (const [r, l] of antes) { if (l) folha.linhas.set(r, l); else folha.linhas.delete(r); folha.linhasSujas.add(r); } };
    aplicarDepois();
    this.registrar({ nome: "Altura da linha", folha, hf: false, desfazer: aplicarAntes, refazer: aplicarDepois, geometria: true });
    this.emit("mudou", { folha, geometria: true });
  }

  ocultar(folha, eixo, a, b, ocultar) {
    if (eixo === "col") {
      const antes = clonarColunas(folha.colunas);
      dividirColunas(folha, a, b, col => { if (ocultar) col.attrs.hidden = "1"; else { delete col.attrs.hidden; if (col.attrs.width === "0") col.attrs.width = String(folha.larguraPadrao || 9.140625); } }, true);
      const depois = clonarColunas(folha.colunas);
      const aplicar = l => { folha.colunas = clonarColunas(l); folha.colunasSujas = true; };
      this.registrar({ nome: ocultar ? "Ocultar colunas" : "Reexibir colunas", folha, hf: false, desfazer: () => aplicar(antes), refazer: () => aplicar(depois), geometria: true });
    } else {
      const antes = new Map();
      const fim = Math.min(b, Math.max(folha.limite.r + 1000, a + 1000));
      for (let r = a; r <= fim; r++) antes.set(r, folha.linhas.get(r) || null);
      const depois = () => {
        for (let r = a; r <= fim; r++) {
          const l = { ...(folha.linhas.get(r) || {}) };
          if (ocultar) l.oculta = true; else { delete l.oculta; if (l.ht === 0) { delete l.ht; delete l.custom; } }
          if (Object.keys(l).length) folha.linhas.set(r, l); else folha.linhas.delete(r);
          folha.linhasSujas.add(r);
        }
      };
      const desf = () => { for (const [r, l] of antes) { if (l) folha.linhas.set(r, l); else folha.linhas.delete(r); folha.linhasSujas.add(r); } };
      depois();
      this.registrar({ nome: ocultar ? "Ocultar linhas" : "Reexibir linhas", folha, hf: false, desfazer: desf, refazer: depois, geometria: true });
    }
    this.emit("mudou", { folha, geometria: true });
  }

  congelarPainel(folha, linhas, colunas) {
    const antes = { ...folha.congelar }, depois = { linhas, colunas };
    const aplicar = v => { folha.congelar = { ...v }; folha.painelSujo = true; };
    aplicar(depois);
    this.registrar({ nome: "Congelar painéis", folha, hf: false, desfazer: () => aplicar(antes), refazer: () => aplicar(depois), geometria: true });
    this.emit("mudou", { folha, geometria: true });
  }

  // -------------------------------------------------------------- mesclar
  mesclar(folha, g, centralizar = true) {
    if (g.r1 === g.r2 && g.c1 === g.c2) return { erro: "Selecione mais de uma célula para mesclar." };
    if (folha.mesclas.some(m => intersecta(m, g) && !(m.r1 >= g.r1 && m.r2 <= g.r2 && m.c1 >= g.c1 && m.c2 <= g.c2))) return { erro: "A seleção cruza outra área mesclada. Desfaça a mesclagem antes." };
    const antesM = folha.mesclas.slice();
    const depoisM = folha.mesclas.filter(m => !intersecta(m, g)).concat([{ ...g }]);
    // só o valor do canto superior esquerdo fica
    const itens = [];
    this.paraCadaCelula(folha, g, (r, c, cel) => {
      if (r === g.r1 && c === g.c1) return;
      if (cel.f != null || this.hf.getCellValue({ sheet: folha.hfId, row: r, col: c }) !== null) itens.push({ r, c, cel: cel.s ? { s: cel.s } : null, hf: null });
    });
    const cel0 = folha.cel(g.r1, g.c1);
    const s0 = cel0 ? cel0.s : folha.estiloNovo(g.r1, g.c1);
    const sNovo = centralizar && this.estilos?.doc ? this.estilos.comMudanca(s0, g.r1 !== g.r2 ? { h: "center", v: "center" } : { h: "center" }) : s0;
    if (sNovo !== s0) { const { hf } = this.conteudo(folha, g.r1, g.c1); itens.push({ r: g.r1, c: g.c1, cel: { ...(cel0 || {}), s: sNovo }, hf, soEstilo: true }); }
    const r = itens.length ? this.definir(folha, itens, { nome: "Mesclar" }) : null;
    if (r && r.erro) return r;
    const aplicar = l => { folha.mesclas = l.slice(); folha.mesclasSujas = true; };
    aplicar(depoisM);
    if (r) { const e = this.pilhaDesfazer[this.pilhaDesfazer.length - 1]; const d0 = e.desfazer, r0 = e.refazer; e.desfazer = () => { d0(); aplicar(antesM); }; e.refazer = () => { r0(); aplicar(depoisM); }; e.nome = "Mesclar"; }
    else this.registrar({ nome: "Mesclar", folha, hf: false, desfazer: () => aplicar(antesM), refazer: () => aplicar(depoisM) });
    this.emit("mudou", { folha });
    return { ok: true };
  }

  desmesclar(folha, g) {
    const antesM = folha.mesclas.slice();
    const depoisM = folha.mesclas.filter(m => !intersecta(m, g));
    if (depoisM.length === antesM.length) return { erro: "Não há células mescladas na seleção." };
    const aplicar = l => { folha.mesclas = l.slice(); folha.mesclasSujas = true; };
    aplicar(depoisM);
    this.registrar({ nome: "Desfazer mesclagem", folha, hf: false, desfazer: () => aplicar(antesM), refazer: () => aplicar(depoisM) });
    this.emit("mudou", { folha });
    return { ok: true };
  }

  // -------------------------------------------------------------- inserir / excluir linhas e colunas
  /** n > 0 insere, n < 0 exclui, a partir do índice "em" */
  mudarEixo(folha, eixo, em, n) {
    const lin = eixo === "lin";
    const max = lin ? MAX_LINHAS : MAX_COLUNAS;
    const k = Math.abs(n);
    if (n > 0 && (lin ? folha.limite.r : folha.limite.c) + n >= max) return { erro: "Não há espaço: a planilha chegaria ao limite de " + (lin ? "linhas" : "colunas") + "." };
    // tabelas e matrizes
    for (const t of folha.tabelas) {
      if (!lin && (n > 0 ? em > t.c1 && em <= t.c2 : !(em + k - 1 < t.c1 || em > t.c2))) return { erro: `Não é possível ${n > 0 ? "inserir" : "excluir"} colunas dentro da tabela “${t.nome}”. Use o Excel para alterar a estrutura da tabela.` };
      if (lin && n < 0 && t.cabecalho && t.r1 >= em && t.r1 < em + k) return { erro: `A exclusão apagaria o cabeçalho da tabela “${t.nome}”.` };
    }
    if (folha.temDinamica && !lin) return { erro: "Esta planilha tem uma tabela dinâmica; inserir ou excluir colunas pode danificá-la. Use o Excel para isso." };
    for (const [kk, cel] of folha.celulas) {
      if (!cel.mat) continue;
      const g = lerIntervalo(cel.mat); if (!g || (g.r1 === g.r2 && g.c1 === g.c2)) continue;
      const a = lin ? g.r1 : g.c1, b = lin ? g.r2 : g.c2;
      const corta = n > 0 ? em > a && em <= b : !(em + k - 1 < a || em > b) && !(em <= a && em + k - 1 >= b);
      if (corta) return { erro: "Não é possível alterar parte de uma matriz." };
      void kk;
    }
    const op = { folha: folha.nome, folhaObj: folha, eixo, em, n };
    const registro = this.aplicarEixoModelo(folha, op);
    try {
      if (lin) n > 0 ? this.hf.addRows(folha.hfId, [em, n]) : this.hf.removeRows(folha.hfId, [em, k]);
      else n > 0 ? this.hf.addColumns(folha.hfId, [em, n]) : this.hf.removeColumns(folha.hfId, [em, k]);
    } catch (e) {
      this.desfazerEixoModelo(folha, op, registro);
      return { erro: "Não foi possível alterar a planilha: " + e.message };
    }
    // estilo das linhas novas copiado da anterior (como no Excel)
    const copias = [];
    if (n > 0 && em > 0) {
      const ant = em - 1;
      for (const [kk, cel] of folha.celulas) {
        if (!cel.s) continue;
        const r = linhaDaChave(kk), c = colunaDaChave(kk);
        if ((lin ? r : c) !== ant) continue;
        if (folha.mesclaEm(r, c)) continue;
        for (let i = 0; i < n; i++) copias.push([lin ? chave(em + i, c) : chave(r, em + i), { s: cel.s }]);
      }
      if (lin) { const l = folha.linhas.get(ant); if (l && (l.s != null || l.ht)) for (let i = 0; i < n; i++) { folha.linhas.set(em + i, { ...l, oculta: undefined }); folha.linhasSujas.add(em + i); } }
      for (const [kk, cel] of copias) { folha.celulas.set(kk, cel); folha.sujas.add(kk); }
    }
    registro.copias = copias;
    this.ops.push(op);
    this.registrar({
      nome: n > 0 ? "Inserir" : "Excluir", folha, hf: true, estrutura: true,
      desfazer: () => { for (const [kk] of copias) folha.celulas.delete(kk); this.desfazerEixoModelo(folha, op, registro); this.registrarOp({ ...op, n: -op.n }); },
      refazer: () => { const r2 = this.aplicarEixoModelo(folha, op); Object.assign(registro, r2, { copias }); for (const [kk, cel] of copias) { folha.celulas.set(kk, cel); folha.sujas.add(kk); } this.registrarOp(op); },
    });
    this.emit("mudou", { folha, estrutura: true });
    return { ok: true };
  }

  /** acrescenta uma operação estrutural ao registro (ou cancela a anterior se for o inverso dela) */
  registrarOp(op) {
    const ult = this.ops[this.ops.length - 1];
    if (ult && ult.folha === op.folha && ult.eixo === op.eixo && ult.em === op.em && ult.n === -op.n && op.eixo) { this.ops.pop(); return; }
    this.ops.push(op);
  }

  /** aplica a mudança de linhas/colunas no modelo (células, fórmulas, mesclas…) e devolve o necessário para desfazer */
  aplicarEixoModelo(folha, op) {
    const lin = op.eixo === "lin";
    const max = lin ? MAX_LINHAS : MAX_COLUNAS;
    const removidas = [];
    const novo = new Map();
    for (const [kk, cel] of folha.celulas) {
      const r = linhaDaChave(kk), c = colunaDaChave(kk);
      const v = deslocarIndice(lin ? r : c, op.em, op.n, max);
      if (v == null) { removidas.push([kk, cel]); continue; }
      novo.set(lin ? chave(v, c) : chave(r, v), cel);
    }
    folha.celulas = novo;
    const sujasAntes = folha.sujas;
    const ns = new Set();
    for (const kk of folha.sujas) {
      const r = linhaDaChave(kk), c = colunaDaChave(kk);
      const v = deslocarIndice(lin ? r : c, op.em, op.n, max);
      if (v != null) ns.add(lin ? chave(v, c) : chave(r, v));
    }
    folha.sujas = ns;
    // fórmulas em todas as planilhas
    const formulas = [];
    for (const f of this.folhas) {
      for (const [kk, cel] of f.celulas) {
        if (cel.f == null) continue;
        const nf = deslocarFormula(cel.f, f.nome, op);
        let mat = cel.mat;
        if (mat && f === folha) {
          const g = lerIntervalo(mat);
          if (g) { const fx = lin ? deslocarFaixa(g.r1, g.r2, op.em, op.n, max) : deslocarFaixa(g.c1, g.c2, op.em, op.n, max); if (fx) mat = nomeIntervalo(lin ? { ...g, r1: fx[0], r2: fx[1] } : { ...g, c1: fx[0], c2: fx[1] }); }
        }
        if (nf !== cel.f || mat !== cel.mat) {
          const nc = { ...cel, f: nf, mat };
          if (this.tipo === "csv") nc.raw = "=" + (this.csv?.decimalVirgula ? paraPortugues(nf) : nf);
          formulas.push([f, kk, cel, nc]);
          f.celulas.set(kk, nc);
          f.sujas.add(kk);
        }
      }
      // partes de matriz apontam para a chave da mestra
      if (f === folha) for (const [kk, cel] of f.celulas) if (cel.parte != null) {
        const r = linhaDaChave(cel.parte), c = colunaDaChave(cel.parte);
        const v = deslocarIndice(lin ? r : c, op.em, op.n, max);
        if (v != null) { const np = lin ? chave(v, c) : chave(r, v); if (np !== cel.parte) f.celulas.set(kk, { ...cel, parte: np }); }
      }
    }
    // mesclas
    const mesclasAntes = folha.mesclas;
    folha.mesclas = folha.mesclas.map(m => {
      const fx = lin ? deslocarFaixa(m.r1, m.r2, op.em, op.n, max) : deslocarFaixa(m.c1, m.c2, op.em, op.n, max);
      if (!fx) return null;
      const g = lin ? { ...m, r1: fx[0], r2: fx[1] } : { ...m, c1: fx[0], c2: fx[1] };
      return g.r1 === g.r2 && g.c1 === g.c2 ? null : g;
    }).filter(Boolean);
    folha.mesclasSujas = true;
    // tabelas
    const tabelasAntes = folha.tabelas;
    folha.tabelas = folha.tabelas.map(t => { const fx = lin ? deslocarFaixa(t.r1, t.r2, op.em, op.n, max) : deslocarFaixa(t.c1, t.c2, op.em, op.n, max); return fx ? (lin ? { ...t, r1: fx[0], r2: fx[1] } : { ...t, c1: fx[0], c2: fx[1] }) : null; }).filter(Boolean);
    // linhas / colunas
    const linhasAntes = folha.linhas, colunasAntes = clonarColunas(folha.colunas), limiteAntes = { ...folha.limite };
    const linhasSujasAntes = folha.linhasSujas;
    if (lin) {
      const nl = new Map();
      for (const [r, l] of folha.linhas) { const v = deslocarIndice(r, op.em, op.n, max); if (v != null) nl.set(v, l); }
      folha.linhas = nl;
      const nls = new Set();
      for (const r of folha.linhasSujas) { const v = deslocarIndice(r, op.em, op.n, max); if (v != null) nls.add(v); }
      folha.linhasSujas = nls;
      folha.limite.r = Math.max(-1, folha.limite.r + op.n);
    } else {
      const nc = [];
      for (const col of folha.colunas) {
        const fx = deslocarFaixa(col.min, col.max, op.em, op.n, max);
        if (fx) nc.push({ min: fx[0], max: fx[1], attrs: { ...col.attrs } });
      }
      folha.colunas = nc;
      folha.colunasSujas = true;
      folha.limite.c = Math.max(-1, folha.limite.c + op.n);
    }
    return { removidas, formulas, mesclasAntes, tabelasAntes, linhasAntes, colunasAntes, limiteAntes, sujasAntes, linhasSujasAntes };
  }

  desfazerEixoModelo(folha, op, reg) {
    const lin = op.eixo === "lin";
    const max = lin ? MAX_LINHAS : MAX_COLUNAS;
    const inv = { ...op, n: -op.n };
    // move de volta
    const novo = new Map();
    for (const [kk, cel] of folha.celulas) {
      const r = linhaDaChave(kk), c = colunaDaChave(kk);
      const v = deslocarIndice(lin ? r : c, inv.em, inv.n, max);
      if (v == null) continue;
      novo.set(lin ? chave(v, c) : chave(r, v), cel);
    }
    for (const [kk, cel] of reg.removidas) { novo.set(kk, cel); }
    folha.celulas = novo;
    for (const [f, kk, antes] of reg.formulas) {
      // a chave guardada é a da posição depois da operação: recalcula para a posição original
      if (f === folha) {
        const r = linhaDaChave(kk), c = colunaDaChave(kk);
        const v = deslocarIndice(lin ? r : c, inv.em, inv.n, max);
        if (v == null) continue;
        const ko = lin ? chave(v, c) : chave(r, v);
        folha.celulas.set(ko, antes);
      } else f.celulas.set(kk, antes);
    }
    // partes de matriz
    for (const [kk, cel] of folha.celulas) if (cel.parte != null) {
      const r = linhaDaChave(cel.parte), c = colunaDaChave(cel.parte);
      const v = deslocarIndice(lin ? r : c, inv.em, inv.n, max);
      if (v != null) { const np = lin ? chave(v, c) : chave(r, v); if (np !== cel.parte) folha.celulas.set(kk, { ...cel, parte: np }); }
    }
    folha.mesclas = reg.mesclasAntes; folha.mesclasSujas = true;
    folha.tabelas = reg.tabelasAntes;
    folha.linhas = reg.linhasAntes;
    folha.colunas = clonarColunas(reg.colunasAntes); folha.colunasSujas = true;
    folha.limite = { ...reg.limiteAntes };
    // tudo que voltou fica marcado para gravar
    folha.sujas = new Set(reg.sujasAntes);
    for (const [kk] of reg.removidas) folha.sujas.add(kk);
    for (const [f, kk] of reg.formulas) { if (f !== folha) f.sujas.add(kk); }
    for (const [kk, cel] of folha.celulas) if (cel.f != null) folha.sujas.add(kk);
    folha.linhasSujas = new Set(reg.linhasSujasAntes);
    if (lin) for (const r of reg.linhasAntes.keys()) folha.linhasSujas.add(r);
  }

  // -------------------------------------------------------------- planilhas (abas)
  validarNomeFolha(nome, atual = null) {
    const n = (nome || "").trim();
    if (!n) return "Digite um nome.";
    if (n.length > 31) return "O nome pode ter no máximo 31 caracteres.";
    if (/[\\/?*[\]:]/.test(n)) return "O nome não pode ter \\ / ? * [ ] :";
    if (n.startsWith("'") || n.endsWith("'")) return "O nome não pode começar nem terminar com apóstrofo.";
    if (n.toLowerCase() === "histórico" || n.toLowerCase() === "history") return "Esse nome é reservado pelo Excel.";
    const outra = this.folhaPorNome(n);
    if (outra && outra !== atual) return "Já existe uma planilha com esse nome.";
    return null;
  }

  adicionarFolha(nome) {
    const erro = this.validarNomeFolha(nome);
    if (erro) return { erro };
    const folha = new Folha(this, { nome, alturaPadrao: this.folhas[0]?.alturaPadrao || 15 });
    folha.nova = true;
    this.hf.addSheet(nome);
    folha.hfId = this.hf.getSheetId(nome);
    this.folhas.push(folha);
    this.ops.push({ tipo: "novaFolha", folhaObj: folha });
    this.alteracoesPasta = true;
    this.registrar({
      nome: "Nova planilha", folha, hf: true, estrutura: true, abas: true,
      desfazer: () => { this.folhas = this.folhas.filter(f => f !== folha); this.registrarOpFolha({ tipo: "excluirFolha", folhaObj: folha, nome: folha.nome }); },
      refazer: () => { this.folhas.push(folha); folha.hfId = this.hf.getSheetId(folha.nome); this.registrarOpFolha({ tipo: "novaFolha", folhaObj: folha }); },
    });
    this.emit("abas");
    return { ok: true, folha };
  }

  registrarOpFolha(op) {
    const ult = this.ops[this.ops.length - 1];
    if (ult && ult.folhaObj === op.folhaObj && ((ult.tipo === "novaFolha" && op.tipo === "excluirFolha") || (ult.tipo === "excluirFolha" && op.tipo === "novaFolha"))) { this.ops.pop(); return; }
    this.ops.push(op);
  }

  renomearFolha(folha, nome) {
    nome = nome.trim();
    if (nome === folha.nome) return { ok: true };
    const erro = this.validarNomeFolha(nome, folha);
    if (erro) return { erro };
    const antigo = folha.nome;
    const formulas = [];
    const trocar = (de, para) => {
      for (const f of this.folhas) for (const [kk, cel] of f.celulas) {
        if (cel.f == null) continue;
        const nf = renomearFolhaNaFormula(cel.f, de, para);
        if (nf !== cel.f) { const nc = { ...cel, f: nf }; formulas.push([f, kk, cel, nc]); f.celulas.set(kk, nc); f.sujas.add(kk); }
      }
    };
    this.hf.renameSheet(folha.hfId, nome);
    folha.nome = nome;
    trocar(antigo, nome);
    this.ops.push({ tipo: "renomear", folhaObj: folha, de: antigo, para: nome });
    this.alteracoesPasta = true;
    this.registrar({
      nome: "Renomear planilha", folha, hf: true, abas: true,
      desfazer: () => { folha.nome = antigo; for (const [f, kk, a] of formulas) { f.celulas.set(kk, a); f.sujas.add(kk); } this.ops.push({ tipo: "renomear", folhaObj: folha, de: nome, para: antigo }); },
      refazer: () => { folha.nome = nome; for (const [f, kk, , d] of formulas) { f.celulas.set(kk, d); f.sujas.add(kk); } this.ops.push({ tipo: "renomear", folhaObj: folha, de: antigo, para: nome }); },
    });
    this.emit("abas");
    return { ok: true };
  }

  /** exclui a planilha (não dá para desfazer, como no Excel) */
  excluirFolha(folha) {
    if (this.folhas.filter(f => f.estado === "visible").length <= 1 && folha.estado === "visible") return { erro: "A pasta precisa ter pelo menos uma planilha visível." };
    const nome = folha.nome;
    this.hf.removeSheet(folha.hfId);
    this.folhas = this.folhas.filter(f => f !== folha);
    for (const f of this.folhas) for (const [kk, cel] of f.celulas) {
      if (cel.f == null) continue;
      const nf = excluirFolhaNaFormula(cel.f, nome);
      if (nf !== cel.f) { f.celulas.set(kk, { ...cel, f: nf, cache: undefined }); f.sujas.add(kk); }
    }
    this.ops.push({ tipo: "excluirFolha", folhaObj: folha, nome });
    this.alteracoesPasta = true;
    this.limparHistorico();
    this.emit("abas");
    this.emit("mudou", { estrutura: true });
    return { ok: true };
  }

  // -------------------------------------------------------------- copiar, colar, preencher, classificar
  /** cópia interna de um intervalo (com fórmulas e estilos) */
  copiar(folha, g) {
    const linhas = [];
    for (let r = g.r1; r <= g.r2; r++) {
      const l = [];
      for (let c = g.c1; c <= g.c2; c++) {
        const { cel, hf } = this.conteudo(folha, r, c);
        l.push({ cel, hf, texto: this.textoEdicao(folha, r, c) });
      }
      linhas.push(l);
    }
    return { pasta: this, folha, g: { ...g }, linhas, mesclas: folha.mesclas.filter(m => m.r1 >= g.r1 && m.r2 <= g.r2 && m.c1 >= g.c1 && m.c2 <= g.c2) };
  }

  /** cola dados internos (copiar()) em (r, c). modo: "tudo" | "valores" | "formatos" */
  colarInterno(folha, r0, c0, dados, { modo = "tudo", repetirEm = null } = {}) {
    const alt = dados.linhas.length, larg = dados.linhas[0]?.length || 0;
    // colar uma célula numa seleção maior repete o conteúdo
    let alvo = { r1: r0, c1: c0, r2: r0 + alt - 1, c2: c0 + larg - 1 };
    if (repetirEm && (repetirEm.r2 - repetirEm.r1 + 1) % alt === 0 && (repetirEm.c2 - repetirEm.c1 + 1) % larg === 0) alvo = { ...repetirEm };
    if (alvo.r2 >= MAX_LINHAS || alvo.c2 >= MAX_COLUNAS) return { erro: "A área colada passa do limite da planilha." };
    const mesmaPasta = dados.pasta === this;
    const itens = [];
    for (let r = alvo.r1; r <= alvo.r2; r++) for (let c = alvo.c1; c <= alvo.c2; c++) {
      const src = dados.linhas[(r - alvo.r1) % alt][(c - alvo.c1) % larg];
      const dr = r - (dados.g.r1 + (r - alvo.r1) % alt), dc = c - (dados.g.c1 + (c - alvo.c1) % larg);
      const atual = folha.cel(r, c);
      const sDest = atual ? atual.s : folha.estiloNovo(r, c);
      if (modo === "formatos") {
        if (!mesmaPasta) continue;
        const { hf } = this.conteudo(folha, r, c);
        const s = src.cel ? src.cel.s : 0;
        itens.push({ r, c, cel: atual ? { ...atual, s } : (s ? { s } : null), hf, soEstilo: true });
        continue;
      }
      if (modo === "valores" || !mesmaPasta) {
        let texto;
        if (modo === "valores") {
          const v = dados.pasta.valor(dados.folha, dados.g.r1 + (r - alvo.r1) % alt, dados.g.c1 + (c - alvo.c1) % larg);
          if (v === null || v === undefined) { itens.push({ r, c, cel: sDest ? { s: sDest } : null, hf: null }); continue; }
          if (typeof v === "number") { const p = this.tipo === "csv" ? this.prepararCsv(this.numeroCsv(v)) : { cel: { s: sDest }, hf: v }; itens.push({ r, c, ...p, cel: { ...(p.cel || {}), s: sDest } }); continue; }
          if (typeof v === "boolean") { itens.push({ r, c, cel: { s: sDest, ...(this.tipo === "csv" ? { raw: v ? "VERDADEIRO" : "FALSO" } : {}) }, hf: v }); continue; }
          if (typeof v === "object") texto = ERROS_EN_PT[v.erro] || v.erro; else texto = v;
          const p = this.tipo === "csv" ? this.prepararCsv(String(texto)) : { cel: { s: sDest }, hf: "'" + texto };
          itens.push({ r, c, cel: { ...(p.cel || {}), s: sDest }, hf: p.hf });
          continue;
        }
        texto = src.texto;
        if (src.cel && src.cel.f != null) texto = "=" + paraPortugues(transladarFormula(src.cel.f, dr, dc));
        const p = this.prepararTexto(folha, r, c, texto, atual);
        if (p.erro) continue;
        itens.push({ r, c, cel: p.cel, hf: p.hf });
        continue;
      }
      // mesma pasta: fórmula ajustada, valor e estilo
      const s = this.tipo === "csv" ? 0 : (src.cel ? src.cel.s : 0);
      if (src.cel && src.cel.f != null && !src.cel.mat) {
        const f = transladarFormula(src.cel.f, dr, dc);
        const cel = { s, f };
        if (this.tipo === "csv") cel.raw = "=" + (this.csv?.decimalVirgula ? paraPortugues(f) : f);
        itens.push({ r, c, cel, hf: "=" + paraMotor(f) });
      } else if (src.cel && (src.cel.mat || src.cel.parte != null)) {
        const v = dados.pasta.valor(dados.folha, dados.g.r1 + (r - alvo.r1) % alt, dados.g.c1 + (c - alvo.c1) % larg);
        itens.push({ r, c, cel: { s }, hf: paraHF(typeof v === "object" && v && v.erro ? { erro: v.erro } : v) });
      } else {
        const cel = src.cel ? { s, ...(src.cel.raw != null ? { raw: src.cel.raw } : {}) } : (s ? { s } : null);
        itens.push({ r, c, cel: cel && (cel.s || cel.raw != null || src.hf != null) ? cel : (src.hf != null ? { s: 0 } : null), hf: src.hf });
      }
    }
    const res = this.definir(folha, itens, { nome: "Colar" });
    if (res.erro) return res;
    // mesclas da origem
    if (mesmaPasta && modo !== "valores" && dados.mesclas.length) {
      const novas = dados.mesclas.map(m => ({ r1: m.r1 - dados.g.r1 + r0, r2: m.r2 - dados.g.r1 + r0, c1: m.c1 - dados.g.c1 + c0, c2: m.c2 - dados.g.c1 + c0 }));
      const antesM = folha.mesclas.slice();
      const depoisM = folha.mesclas.filter(m => !novas.some(n => intersecta(n, m))).concat(novas);
      const aplicar = l => { folha.mesclas = l.slice(); folha.mesclasSujas = true; };
      aplicar(depoisM);
      const e = this.pilhaDesfazer[this.pilhaDesfazer.length - 1];
      const d0 = e.desfazer, r1 = e.refazer;
      e.desfazer = () => { d0(); aplicar(antesM); }; e.refazer = () => { r1(); aplicar(depoisM); };
    }
    return { ok: true, area: alvo };
  }

  /** cola texto vindo de outro programa (linhas × colunas) */
  colarTexto(folha, r0, c0, linhas, repetirEm = null) {
    const alt = linhas.length, larg = Math.max(...linhas.map(l => l.length));
    let alvo = { r1: r0, c1: c0, r2: r0 + alt - 1, c2: c0 + larg - 1 };
    if (repetirEm && alt === 1 && larg === 1) alvo = { ...repetirEm };
    if (alvo.r2 >= MAX_LINHAS || alvo.c2 >= MAX_COLUNAS) return { erro: "A área colada passa do limite da planilha." };
    if ((alvo.r2 - alvo.r1 + 1) * (alvo.c2 - alvo.c1 + 1) > 500000) return { erro: "Área muito grande para colar de uma vez." };
    const itens = [];
    for (let r = alvo.r1; r <= alvo.r2; r++) for (let c = alvo.c1; c <= alvo.c2; c++) {
      const texto = (linhas[(r - alvo.r1) % alt][(c - alvo.c1) % larg]) ?? "";
      const atual = folha.cel(r, c);
      const p = this.prepararTexto(folha, r, c, texto, atual);
      if (p.erro) { const s = atual ? atual.s : 0; itens.push({ r, c, cel: { s, ...(this.tipo === "csv" ? { raw: texto } : {}) }, hf: "'" + texto }); continue; }
      itens.push({ r, c, cel: p.cel, hf: p.hf });
    }
    const res = this.definir(folha, itens, { nome: "Colar" });
    return res.erro ? res : { ok: true, area: alvo };
  }

  /**
   * Preenche "destino" a partir de "origem" (alça de preenchimento / Ctrl+D / Ctrl+R).
   * serie=true reconhece sequências (1, 2, 3…; datas; "Item 1").
   */
  preencher(folha, origem, destino, { serie = true } = {}) {
    const vertical = destino.c1 === origem.c1 && destino.c2 === origem.c2;
    const itens = [];
    const tam = vertical ? origem.r2 - origem.r1 + 1 : origem.c2 - origem.c1 + 1;
    const para = vertical ? destino.r1 > origem.r2 || destino.r2 > origem.r2 : destino.c1 > origem.c2 || destino.c2 > origem.c2;
    const fixoIni = vertical ? origem.c1 : origem.r1, fixoFim = vertical ? origem.c2 : origem.r2;
    for (let x = fixoIni; x <= fixoFim; x++) {
      const srcPos = []; for (let i = 0; i < tam; i++) srcPos.push(vertical ? [origem.r1 + i, x] : [x, origem.c1 + i]);
      const vals = srcPos.map(([r, c]) => ({ r, c, cel: folha.cel(r, c), v: this.valor(folha, r, c) }));
      // série numérica (passo constante) quando há 2+ números, ou data/“texto N” sozinho
      let passo = null, base = null, textoNum = null;
      if (serie && vals.every(o => typeof o.v === "number" && (!o.cel || o.cel.f == null))) {
        if (vals.length >= 2) { const d = vals[1].v - vals[0].v; if (vals.every((o, i) => i === 0 || Math.abs(o.v - vals[i - 1].v - d) < 1e-9)) { passo = d; base = vals[vals.length - 1].v; } }
        else if (vals.length === 1 && ehFormatoData(this.formato(folha, vals[0].r, vals[0].c))) { passo = 1; base = vals[0].v; }
      }
      if (serie && vals.length === 1 && typeof vals[0].v === "string" && (!vals[0].cel || vals[0].cel.f == null)) {
        const m = /^(.*?)(\d+)$/.exec(vals[0].v); if (m && m[1]) textoNum = { pref: m[1], n: +m[2], larg: m[2].length };
      }
      const ini = vertical ? destino.r1 : destino.c1, fim = vertical ? destino.r2 : destino.c2;
      const sentido = para ? 1 : -1;
      let cont = 0;
      const posicoes = [];
      if (para) for (let p = ini; p <= fim; p++) { if (vertical ? p >= origem.r1 && p <= origem.r2 : p >= origem.c1 && p <= origem.c2) continue; posicoes.push(p); }
      else for (let p = fim; p >= ini; p--) { if (vertical ? p >= origem.r1 && p <= origem.r2 : p >= origem.c1 && p <= origem.c2) continue; posicoes.push(p); }
      for (const p of posicoes) {
        cont++;
        const r = vertical ? p : x, c = vertical ? x : p;
        const idx = para ? (cont - 1) % tam : (tam - 1 - ((cont - 1) % tam));
        const src = vals[idx];
        const s = src.cel ? src.cel.s : 0;
        if (passo != null) {
          const v = para ? base + passo * cont : vals[0].v - passo * cont;
          const p2 = this.tipo === "csv" ? this.prepararCsv(this.numeroCsv(v)) : { cel: { s }, hf: v };
          itens.push({ r, c, cel: p2.cel, hf: p2.hf }); continue;
        }
        if (textoNum) {
          const n = textoNum.n + sentido * cont;
          const t = textoNum.pref + (n < 0 ? String(n) : String(n).padStart(textoNum.larg, "0"));
          itens.push({ r, c, cel: { s, ...(this.tipo === "csv" ? { raw: t } : {}) }, hf: "'" + t }); continue;
        }
        const dr = r - src.r, dc = c - src.c;
        if (src.cel && src.cel.f != null && !src.cel.mat) {
          const f = transladarFormula(src.cel.f, dr, dc);
          const cel = { s, f };
          if (this.tipo === "csv") cel.raw = "=" + (this.csv?.decimalVirgula ? paraPortugues(f) : f);
          itens.push({ r, c, cel, hf: "=" + paraMotor(f) });
        } else {
          const { cel, hf } = this.conteudo(folha, src.r, src.c);
          const nc = cel ? { s: cel.s, ...(cel.raw != null ? { raw: cel.raw } : {}) } : null;
          itens.push({ r, c, cel: nc && (nc.s || nc.raw != null || hf != null) ? nc : (hf != null ? { s: 0 } : null), hf: cel && cel.parte != null ? paraHF(src.v) : hf });
        }
      }
    }
    if (!itens.length) return { ok: true };
    return this.definir(folha, itens, { nome: "Preencher" });
  }

  /** classifica as linhas do intervalo pela coluna "col" */
  classificar(folha, g, col, crescente = true, cabecalho = false) {
    const r1 = g.r1 + (cabecalho ? 1 : 0);
    if (r1 >= g.r2) return { erro: "Nada para classificar." };
    if (folha.mesclas.some(m => intersecta(m, { ...g, r1 }))) return { erro: "Não é possível classificar áreas com células mescladas." };
    const linhas = [];
    for (let r = r1; r <= g.r2; r++) {
      const v = this.valor(folha, r, col);
      const cels = [];
      for (let c = g.c1; c <= g.c2; c++) cels.push(this.conteudo(folha, r, c));
      linhas.push({ r, v, cels });
    }
    const ordem = v => v === null || v === undefined || v === "" ? 4 : typeof v === "number" ? 0 : typeof v === "string" ? 1 : typeof v === "boolean" ? 2 : 3;
    const col8 = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });
    linhas.sort((a, b) => {
      const oa = ordem(a.v), ob = ordem(b.v);
      if (oa === 4 || ob === 4) return oa - ob; // vazias sempre no fim
      let d = oa - ob;
      if (!d) d = oa === 0 ? a.v - b.v : oa === 1 ? col8.compare(a.v, b.v) : oa === 2 ? (a.v === b.v ? 0 : a.v ? 1 : -1) : 0;
      return crescente ? d : -d;
    });
    const itens = [];
    linhas.forEach((l, i) => {
      const r = r1 + i;
      l.cels.forEach((cont, j) => {
        const c = g.c1 + j;
        let { cel, hf } = cont;
        if (cel && cel.f != null) {
          const f = transladarFormula(cel.f, r - l.r, 0);
          cel = { ...cel, f, cache: undefined };
          if (this.tipo === "csv") cel.raw = "=" + (this.csv?.decimalVirgula ? paraPortugues(f) : f);
          hf = "=" + paraMotor(f);
        }
        itens.push({ r, c, cel: cel ? { ...cel } : null, hf });
      });
    });
    return this.definir(folha, itens, { nome: "Classificar" });
  }

  /** procura texto; devolve lista de {folha, r, c} */
  procurar(texto, { todasFolhas = false, folha = null, inteira = false, maiusculas = false } = {}) {
    const norm = s => { s = String(s); if (!maiusculas) s = s.toLocaleLowerCase("pt-BR"); return s.normalize("NFD").replace(/[̀-ͯ]/g, ""); };
    const alvo = norm(texto);
    const out = [];
    for (const f of todasFolhas ? this.folhas : [folha]) {
      if (!f || f.especial) continue;
      const lista = [];
      for (const kk of f.celulas.keys()) lista.push(kk);
      lista.sort((a, b) => a - b);
      for (const kk of lista) {
        const r = linhaDaChave(kk), c = colunaDaChave(kk);
        const e = this.exibir(f, r, c);
        const t = e ? e.texto : "";
        const ed = f.celulas.get(kk)?.f != null ? this.textoEdicao(f, r, c) : "";
        const ok = inteira ? norm(t) === alvo : (norm(t).includes(alvo) || (ed && norm(ed).includes(alvo)));
        if (ok) out.push({ folha: f, r, c });
      }
    }
    return out;
  }

  /** soma, média e contagem do intervalo (barra de status) */
  estatisticas(folha, g) {
    let soma = 0, numeros = 0, contagem = 0, fmt = null;
    this.paraCadaCelula(folha, g, (r, c) => {
      if (folha.mesclaEm(r, c) && !(folha.mesclaEm(r, c).r1 === r && folha.mesclaEm(r, c).c1 === c)) return;
      const v = this.valor(folha, r, c);
      if (v === null || v === undefined || v === "") return;
      contagem++;
      if (typeof v === "number") { soma += v; numeros++; if (fmt == null) fmt = this.formato(folha, r, c); }
    });
    return { soma, numeros, contagem, media: numeros ? soma / numeros : null, formato: fmt };
  }

  formatarNumeroStatus(v, fmt) {
    if (fmt && !/^general$/i.test(fmt) && !ehFormatoData(fmt)) return formatar(v, fmt).texto.trim();
    return formatoGeral(Number(v.toPrecision(12)), 15);
  }
}

// ---------------------------------------------------------------- colunas (<col min max …>)
function clonarColunas(l) { return l.map(c => ({ min: c.min, max: c.max, attrs: { ...c.attrs } })); }

/** divide os <col> para que [c1, c2] tenha entradas próprias e aplica fn em cada uma */
function dividirColunas(folha, c1, c2, fn, criar) {
  const out = [];
  let cur = c1;
  const larguraPadrao = folha.larguraPadrao ? String(folha.larguraPadrao) : String(Math.ceil((folha.larguraBase * 7 + 5) / 8) * 8 / 7);
  for (const col of folha.colunas) {
    if (col.max < c1 || col.min > c2) { out.push(col); continue; }
    if (col.min < c1) out.push({ min: col.min, max: c1 - 1, attrs: { ...col.attrs } });
    const a = Math.max(col.min, c1), b = Math.min(col.max, c2);
    if (criar && a > cur) { const nova = { min: cur, max: a - 1, attrs: { width: larguraPadrao } }; fn(nova); out.push(nova); }
    const meio = { min: a, max: b, attrs: { ...col.attrs } }; fn(meio); out.push(meio);
    if (col.max > c2) out.push({ min: c2 + 1, max: col.max, attrs: { ...col.attrs } });
    cur = b + 1;
  }
  if (criar && cur <= c2) { const nova = { min: cur, max: c2, attrs: { width: larguraPadrao } }; fn(nova); out.push(nova); }
  out.sort((a, b) => a.min - b.min);
  folha.colunas = out;
}

function lerIntervaloSeguro(ref, maisDeUma) {
  const g = lerIntervalo(ref);
  if (!g) return null;
  if (maisDeUma && g.r1 === g.r2 && g.c1 === g.c2) return null;
  return g;
}
