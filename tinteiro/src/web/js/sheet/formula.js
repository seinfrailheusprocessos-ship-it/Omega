// Fórmulas: leitura em pedaços (tokens), tradução português ⇄ inglês, ajuste de referências
// (inserir/excluir linhas e colunas, copiar/colar, renomear planilha) e conversão para o motor de cálculo.
import { letraColuna, numeroColuna, citarFolha, MAX_LINHAS, MAX_COLUNAS } from "./enderecos.js";
import { nomeIngles, nomePortugues, nomeArquivo, ERROS_EN_PT, ERROS_PT_EN } from "./funcoes.js";

const ERROS = Object.keys(ERROS_EN_PT).concat(Object.keys(ERROS_PT_EN)).sort((a, b) => b.length - a.length);
const RE_PALAVRA = /[\p{L}\p{N}_.\\$]/u;
const RE_INICIO_PALAVRA = /[\p{L}_\\$]/u;
const RE_CELULA = /^(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})$/;
const RE_COLUNA = /^(\$?)([A-Za-z]{1,3})$/;
const RE_LINHA = /^(\$?)(\d{1,7})$/;

function lerParteRef(txt) {
  let m = RE_CELULA.exec(txt);
  if (m) {
    const c = numeroColuna(m[2]), r = +m[4] - 1;
    if (c < MAX_COLUNAS && r >= 0 && r < MAX_LINHAS) return { tipo: "cel", c, r, ca: !!m[1], ra: !!m[3] };
    return null;
  }
  m = RE_COLUNA.exec(txt);
  if (m) { const c = numeroColuna(m[2]); if (c < MAX_COLUNAS) return { tipo: "col", c, r: null, ca: !!m[1], ra: false }; return null; }
  m = RE_LINHA.exec(txt);
  if (m) { const r = +m[2] - 1; if (r >= 0 && r < MAX_LINHAS) return { tipo: "lin", r, c: null, ra: !!m[1], ca: false }; }
  return null;
}
const fmtParte = p => p.tipo === "cel" ? (p.ca ? "$" : "") + letraColuna(p.c) + (p.ra ? "$" : "") + (p.r + 1)
  : p.tipo === "col" ? (p.ca ? "$" : "") + letraColuna(p.c) : (p.ra ? "$" : "") + (p.r + 1);

/**
 * Divide a fórmula (sem o "=") em tokens. Cada token tem {t, raw, i (posição)}.
 * pt=true: ";" separa argumentos e "," é decimal (aceita também o estilo inglês quando não há ambiguidade).
 */
export function tokenizar(texto, { pt = false } = {}) {
  const toks = [];
  let i = 0, chaves = 0;
  const n = texto.length;
  const push = (t, raw, extra) => { const tk = { t, raw, i: i, ...extra }; toks.push(tk); i += raw.length; return tk; };
  const anterior = () => { for (let k = toks.length - 1; k >= 0; k--) if (toks[k].t !== "esp") return toks[k]; return null; };

  // lê a parte depois de "Folha!" (célula, intervalo, coluna, linha, nome ou #REF!)
  const lerAlvo = (j) => {
    if (texto.startsWith("#REF!", j)) return { fim: j + 5, refErro: true };
    let k = j;
    while (k < n && /[A-Za-z0-9$]/.test(texto[k])) k++;
    const p1 = texto.slice(j, k);
    const a = lerParteRef(p1);
    if (!a && /^[\p{L}_\\]/u.test(p1)) { // nome definido com escopo de planilha
      let k2 = j; while (k2 < n && RE_PALAVRA.test(texto[k2])) k2++;
      return { fim: k2, nome: texto.slice(j, k2) };
    }
    if (!a) return null;
    if (texto[k] === ":") {
      let k2 = k + 1;
      while (k2 < n && /[A-Za-z0-9$]/.test(texto[k2])) k2++;
      const b = lerParteRef(texto.slice(k + 1, k2));
      if (b && b.tipo === a.tipo) return { fim: k2, a, b };
    }
    if (a.tipo !== "cel") return null;
    return { fim: k, a, b: null };
  };

  while (i < n) {
    const ch = texto[i];
    if (ch === '"') {
      let j = i + 1;
      for (;;) { if (j >= n) break; if (texto[j] === '"') { if (texto[j + 1] === '"') { j += 2; continue; } j++; break; } j++; }
      push("texto", texto.slice(i, j)); continue;
    }
    if (/\s/.test(ch)) { let j = i; while (j < n && /\s/.test(texto[j])) j++; push("esp", texto.slice(i, j)); continue; }
    // referência externa [1]Folha!A1 ou nome de planilha entre aspas
    if (ch === "'" || (ch === "[" && /^\[\d+\]/.test(texto.slice(i)))) {
      let j = i, externo = false;
      if (ch === "[") { j = texto.indexOf("]", i) + 1; externo = true; }
      let nomeFolha = null;
      if (texto[j] === "'") {
        let k = j + 1, s = "";
        for (;;) { if (k >= n) break; if (texto[k] === "'") { if (texto[k + 1] === "'") { s += "'"; k += 2; continue; } k++; break; } s += texto[k]; k++; }
        nomeFolha = s; j = k;
      } else { let k = j; while (k < n && RE_PALAVRA.test(texto[k])) k++; nomeFolha = texto.slice(j, k); j = k; }
      if (/^\[[^\]]*\]/.test(nomeFolha)) externo = true;
      if (texto[j] === "!" ) {
        const alvo = lerAlvo(j + 1);
        if (alvo) {
          const raw = texto.slice(i, alvo.fim);
          if (alvo.nome) push("nome", raw, { folha: nomeFolha, externo });
          else push("ref", raw, { folha: nomeFolha, prefixo: texto.slice(i, j + 1), externo, tres: false, a: alvo.a || null, b: alvo.b || null, refErro: !!alvo.refErro });
          continue;
        }
      }
      push("outro", texto.slice(i, Math.max(j, i + 1))); continue;
    }
    if (ch === "#") {
      const e = ERROS.find(e => texto.substr(i, e.length).toUpperCase() === e);
      if (e) { push("erro", texto.substr(i, e.length)); continue; }
      push("op", "#"); continue;
    }
    if (/[0-9]/.test(ch) || ((ch === "." || (pt && ch === ",")) && /[0-9]/.test(texto[i + 1] || "") && !["ref", "num", "fecha", "nome", "texto", "func"].includes(anterior()?.t))) {
      // linhas inteiras (2:5)
      const mL = /^\$?\d{1,7}:\$?\d{1,7}/.exec(texto.slice(i));
      const ant = anterior();
      if (mL && !(ant && (ant.t === "num"))) {
        const [p, q] = mL[0].split(":");
        const a = lerParteRef(p), b = lerParteRef(q);
        if (a && b) { push("ref", mL[0], { folha: null, prefixo: "", a, b }); continue; }
      }
      const m = (pt ? /^(\d+(,\d+|\.\d+)?|[.,]\d+)([eE][+-]?\d+)?/ : /^(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/).exec(texto.slice(i));
      push("num", m[0]); continue;
    }
    if (ch === "$" || RE_INICIO_PALAVRA.test(ch)) {
      let j = i; while (j < n && RE_PALAVRA.test(texto[j])) j++;
      const palavra = texto.slice(i, j);
      // Folha!A1  ou  Folha1:Folha3!A1
      if (texto[j] === "!" && !palavra.includes("$")) {
        const alvo = lerAlvo(j + 1);
        if (alvo) {
          const raw = texto.slice(i, alvo.fim);
          if (alvo.nome) push("nome", raw, { folha: palavra });
          else push("ref", raw, { folha: palavra, prefixo: palavra + "!", a: alvo.a || null, b: alvo.b || null, refErro: !!alvo.refErro });
          continue;
        }
      }
      if (texto[j] === ":" ) {
        const m3 = /^:([\p{L}_][\p{L}\p{N}_.]*)!/u.exec(texto.slice(j));
        if (m3) {
          const alvo = lerAlvo(j + m3[0].length);
          if (alvo && !alvo.nome) { push("ref", texto.slice(i, alvo.fim), { folha: palavra, prefixo: texto.slice(i, j + m3[0].length), tres: true, a: alvo.a || null, b: alvo.b || null }); continue; }
        }
      }
      if (texto[j] === "(") { push("func", palavra); continue; }
      const a = lerParteRef(palavra);
      if (a && a.tipo === "cel") {
        if (texto[j] === ":") {
          let k = j + 1; while (k < n && /[A-Za-z0-9$]/.test(texto[k])) k++;
          const b = lerParteRef(texto.slice(j + 1, k));
          if (b && b.tipo === "cel") { push("ref", texto.slice(i, k), { folha: null, prefixo: "", a, b }); continue; }
        }
        push("ref", palavra, { folha: null, prefixo: "", a, b: null }); continue;
      }
      if (a && a.tipo === "col" && texto[j] === ":") {
        let k = j + 1; while (k < n && /[A-Za-z$]/.test(texto[k])) k++;
        const b = lerParteRef(texto.slice(j + 1, k));
        if (b && b.tipo === "col" && !RE_PALAVRA.test(texto[k] || "")) { push("ref", texto.slice(i, k), { folha: null, prefixo: "", a, b }); continue; }
      }
      const P = palavra.toUpperCase();
      if (P === "TRUE" || P === "FALSE" || P === "VERDADEIRO" || P === "FALSO") { push("bool", palavra, { valor: P === "TRUE" || P === "VERDADEIRO" }); continue; }
      if (texto[j] === "[") { // referência estruturada Tabela[Coluna]
        let k = j, prof = 0;
        while (k < n) { if (texto[k] === "[") prof++; else if (texto[k] === "]") { prof--; if (prof === 0) { k++; break; } } k++; }
        push("outro", texto.slice(i, k)); continue;
      }
      push("nome", palavra, { folha: null }); continue;
    }
    if (ch === "(") { push("abre", ch); continue; }
    if (ch === ")") { push("fecha", ch); continue; }
    if (ch === "{") { chaves++; push("chave", ch); continue; }
    if (ch === "}") { chaves = Math.max(0, chaves - 1); push("chave", ch); continue; }
    if (ch === ";" || ch === ",") { push("sep", ch, { matriz: chaves > 0 }); continue; }
    if (ch === "<" || ch === ">") { const dois = texto.substr(i, 2); if (dois === "<=" || dois === ">=" || dois === "<>") push("op", dois); else push("op", ch); continue; }
    if ("+-*/^&=%:@".includes(ch)) { push("op", ch); continue; }
    push("outro", ch);
  }
  return toks;
}

const juntar = toks => toks.map(t => t.raw).join("");
const renderRef = (t, a, b) => t.prefixo + fmtParte(a) + (b ? ":" + fmtParte(b) : "");

/** a fórmula digitada usa o estilo português (; e vírgula decimal)? */
export function pareceEstiloPt(texto) {
  const toks = tokenizar(texto, { pt: true });
  if (toks.some(t => t.t === "sep" && t.raw === ";" && !t.matriz)) return true;
  // sem ";": se tiver função com nome só em inglês, é estilo inglês
  for (const t of toks) {
    if (t.t !== "func") continue;
    const N = t.raw.toUpperCase().replace(/^(_XLFN\.)?(_XLWS\.)?/, "");
    const en = nomeIngles(N);
    if (en && en === N && nomePortugues(en) !== N) return false;
  }
  return true;
}

/** texto digitado pelo usuário (sem "=") → fórmula como fica no arquivo (inglês, "," e ".") */
export function paraIngles(texto) {
  const pt = pareceEstiloPt(texto);
  const toks = tokenizar(texto, { pt });
  return toks.map(t => {
    switch (t.t) {
      case "func": { const en = nomeIngles(t.raw); return en ? nomeArquivo(en) : t.raw.toUpperCase(); }
      case "num": return t.raw.replace(",", ".");
      case "sep": return t.matriz ? t.raw : ",";
      case "bool": return t.valor ? "TRUE" : "FALSE";
      case "erro": { const U = t.raw.toUpperCase(); return ERROS_PT_EN[U] || U; }
      case "ref": return t.refErro ? t.raw : renderRef(t, t.a, t.b);
      default: return t.raw;
    }
  }).join("");
}

/** fórmula do arquivo (inglês, sem "=") → como mostrar ao usuário (português) */
export function paraPortugues(textoEn) {
  const toks = tokenizar(textoEn, { pt: false });
  return toks.map(t => {
    switch (t.t) {
      case "func": return nomePortugues(t.raw);
      case "num": return t.raw.replace(".", ",");
      case "sep": return t.matriz ? t.raw : ";";
      case "bool": return t.valor ? "VERDADEIRO" : "FALSO";
      case "erro": return ERROS_EN_PT[t.raw.toUpperCase()] || t.raw;
      default: return t.raw;
    }
  }).join("");
}

/** fórmula do arquivo → sintaxe aceita pelo motor de cálculo */
export function paraMotor(textoEn) {
  const toks = tokenizar(textoEn, { pt: false });
  let s = "";
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.t === "func") { s += t.raw.replace(/^(_xlfn\.)?(_xlws\.)?/i, "").replace(/^_xlfn\./i, ""); continue; }
    if (t.t === "bool") { s += t.valor ? "TRUE()" : "FALSE()"; continue; }
    if (t.t === "op" && t.raw === "@") continue;
    s += t.raw;
  }
  return s;
}

const mesmaFolha = (a, b) => a != null && b != null && a.toLocaleUpperCase("pt-BR") === b.toLocaleUpperCase("pt-BR");
const refErro = t => (t.folha != null ? t.prefixo : "") + "#REF!";

/** desloca um valor por inserção (n>0) ou exclusão (n<0) a partir de "em"; null = excluído */
export function deslocarIndice(v, em, n, max) {
  if (n > 0) { if (v >= em) { v += n; if (v >= max) return null; } return v; }
  const k = -n;
  if (v >= em + k) return v - k;
  if (v >= em) return null;
  return v;
}
/** desloca um intervalo [v1, v2]; null = excluído por inteiro */
export function deslocarFaixa(v1, v2, em, n, max) {
  if (n > 0) {
    if (v1 >= em) v1 += n;
    if (v2 >= em) v2 += n;
    if (v1 >= max) return null;
    return [v1, Math.min(v2, max - 1)];
  }
  const k = -n;
  const a = v1 >= em + k ? v1 - k : v1 >= em ? em : v1;
  const b = v2 >= em + k ? v2 - k : v2 >= em ? em - 1 : v2;
  if (b < a) return null;
  return [a, b];
}

/**
 * Ajusta a fórmula para inserção/exclusão de linhas ou colunas.
 * op = { folha: nome da planilha alterada, eixo: "lin"|"col", em: índice (0), n: +inseridas / −excluídas }
 * folhaFormula = planilha onde a fórmula está (para referências sem nome de planilha)
 */
export function deslocarFormula(textoEn, folhaFormula, op) {
  const toks = tokenizar(textoEn);
  let mudou = false;
  for (const t of toks) {
    if (t.t !== "ref" || t.refErro || t.externo || t.tres) continue;
    const folha = t.folha ?? folhaFormula;
    if (!mesmaFolha(folha, op.folha)) continue;
    const novo = deslocarRef(t, op);
    if (novo !== t.raw) { t.raw = novo; mudou = true; }
  }
  return mudou ? juntar(toks) : textoEn;
}

function deslocarRef(t, op) {
  const lin = op.eixo === "lin";
  const max = lin ? MAX_LINHAS : MAX_COLUNAS;
  const a = { ...t.a }, b = t.b ? { ...t.b } : null;
  const campo = lin ? "r" : "c";
  if (a[campo] == null) return t.raw; // A:A não muda com linhas; 1:1 não muda com colunas
  if (!b) {
    const v = deslocarIndice(a[campo], op.em, op.n, max);
    if (v == null) return refErro(t);
    a[campo] = v;
    return renderRef(t, a, null);
  }
  let v1 = a[campo], v2 = b[campo], inv = false;
  if (v1 > v2) { [v1, v2] = [v2, v1]; inv = true; }
  const f = deslocarFaixa(v1, v2, op.em, op.n, max);
  if (!f) return refErro(t);
  if (inv) { a[campo] = f[1]; b[campo] = f[0]; } else { a[campo] = f[0]; b[campo] = f[1]; }
  return renderRef(t, a, b);
}

/** move as referências relativas (copiar/colar, preencher, fórmula compartilhada) */
export function transladarFormula(textoEn, dr, dc) {
  if (!dr && !dc) return textoEn;
  const toks = tokenizar(textoEn);
  let mudou = false;
  for (const t of toks) {
    if (t.t !== "ref" || t.refErro || t.externo) continue;
    const mover = p => {
      const q = { ...p };
      if (q.r != null && !q.ra) q.r += dr;
      if (q.c != null && !q.ca) q.c += dc;
      if ((q.r != null && (q.r < 0 || q.r >= MAX_LINHAS)) || (q.c != null && (q.c < 0 || q.c >= MAX_COLUNAS))) return null;
      return q;
    };
    const a = mover(t.a), b = t.b ? mover(t.b) : null;
    const novo = !a || (t.b && !b) ? refErro(t) : renderRef(t, a, b);
    if (novo !== t.raw) { t.raw = novo; mudou = true; }
  }
  return mudou ? juntar(toks) : textoEn;
}

/** troca o nome de uma planilha nas referências */
export function renomearFolhaNaFormula(textoEn, antigo, novo) {
  const toks = tokenizar(textoEn);
  let mudou = false;
  for (const t of toks) {
    if ((t.t !== "ref" && t.t !== "nome") || t.folha == null || t.externo || t.tres) continue;
    if (!mesmaFolha(t.folha, antigo)) continue;
    const resto = t.raw.slice(t.prefixo != null ? t.prefixo.length : t.raw.indexOf("!") + 1);
    t.raw = citarFolha(novo) + "!" + resto; mudou = true;
  }
  return mudou ? juntar(toks) : textoEn;
}

/** referências a uma planilha excluída viram #REF! */
export function excluirFolhaNaFormula(textoEn, nome) {
  const toks = tokenizar(textoEn);
  let mudou = false;
  for (const t of toks) {
    if (t.t !== "ref" || t.folha == null || t.externo) continue;
    if (!mesmaFolha(t.folha, nome)) continue;
    t.raw = "#REF!"; mudou = true;
  }
  return mudou ? juntar(toks) : textoEn;
}

/** a fórmula usa alguma referência à planilha (por nome)? */
export function citaFolha(textoEn, nome) {
  return tokenizar(textoEn).some(t => (t.t === "ref" || t.t === "nome") && t.folha != null && mesmaFolha(t.folha, nome));
}

/**
 * Referências de uma fórmula digitada (para destacar no grid e para o modo de apontar).
 * Devolve [{inicio, fim, folha, r1, c1, r2, c2}] com posições no texto (sem o "=").
 */
export function referenciasDoTexto(texto, pt = true) {
  const toks = tokenizar(texto, { pt });
  const out = [];
  for (const t of toks) {
    if (t.t !== "ref" || t.refErro || t.externo || t.tres) continue;
    const a = t.a, b = t.b || t.a;
    const r1 = a.r ?? 0, r2 = b.r ?? MAX_LINHAS - 1, c1 = a.c ?? 0, c2 = b.c ?? MAX_COLUNAS - 1;
    out.push({ inicio: t.i, fim: t.i + t.raw.length, folha: t.folha, r1: Math.min(r1, r2), r2: Math.max(r1, r2), c1: Math.min(c1, c2), c2: Math.max(c1, c2) });
  }
  return out;
}

/** F4: alterna $A$1 → A$1 → $A1 → A1 na referência sob o cursor. Devolve {texto, inicio, fim} ou null */
export function alternarAbsoluta(texto, pos) {
  const toks = tokenizar(texto, { pt: true });
  const t = toks.find(t => t.t === "ref" && !t.refErro && pos >= t.i && pos <= t.i + t.raw.length);
  if (!t) return null;
  const ciclo = p => {
    if (p.tipo !== "cel") { const abs = p.tipo === "col" ? p.ca : p.ra; return { ...p, ca: p.tipo === "col" ? !abs : p.ca, ra: p.tipo === "lin" ? !abs : p.ra }; }
    if (!p.ca && !p.ra) return { ...p, ca: true, ra: true };
    if (p.ca && p.ra) return { ...p, ca: false, ra: true };
    if (!p.ca && p.ra) return { ...p, ca: true, ra: false };
    return { ...p, ca: false, ra: false };
  };
  const novo = renderRef(t, ciclo(t.a), t.b ? ciclo(t.b) : null);
  return { texto: texto.slice(0, t.i) + novo + texto.slice(t.i + t.raw.length), inicio: t.i, fim: t.i + novo.length };
}

/** posição do cursor aceita inserir uma referência clicando numa célula? */
export function podeApontar(texto, pos) {
  let k = pos - 1;
  while (k >= 0 && texto[k] === " ") k--;
  if (k < 0) return false; // texto sem "=" é tratado fora
  const ch = texto[k];
  const depois = texto.slice(pos).trimStart()[0];
  const fimOk = depois === undefined || ")+-*/^&=<>;,:%".includes(depois);
  return "=(;,+-*/^&<>:".includes(ch) && fimOk;
}

/** funções usadas (em inglês) — para saber se o motor entende a fórmula */
export function funcoesUsadas(textoEn) {
  return tokenizar(textoEn).filter(t => t.t === "func").map(t => t.raw.toUpperCase().replace(/^(_XLFN\.)?(_XLWS\.)?/, ""));
}
