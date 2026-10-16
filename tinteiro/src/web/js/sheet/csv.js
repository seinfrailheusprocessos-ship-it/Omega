// CSV: detecta codificação (UTF-8 com/sem BOM ou Windows-1252) e separador (; , tab | ), lê campos entre aspas
// com quebras de linha e grava de volta mantendo separador, BOM, fim de linha e o estilo das aspas.

// Windows-1252: bytes 0x80–0x9F que diferem do Latin-1
const CP1252 = { 0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02C6, 0x89: 0x2030, 0x8A: 0x0160, 0x8B: 0x2039, 0x8C: 0x0152, 0x8E: 0x017D, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02DC, 0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A, 0x9C: 0x0153, 0x9E: 0x017E, 0x9F: 0x0178 };
const CP1252_INV = new Map(Object.entries(CP1252).map(([b, u]) => [u, +b]));

export function decodificar(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bom = false, ini = 0;
  if (u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF) { bom = true; ini = 3; }
  else if (u8[0] === 0xFF && u8[1] === 0xFE) return { texto: new TextDecoder("utf-16le").decode(u8.subarray(2)), codificacao: "utf-16le", bom: true };
  else if (u8[0] === 0xFE && u8[1] === 0xFF) return { texto: new TextDecoder("utf-16be").decode(u8.subarray(2)), codificacao: "utf-16be", bom: true };
  try {
    const texto = new TextDecoder("utf-8", { fatal: true }).decode(u8.subarray(ini));
    return { texto, codificacao: "utf-8", bom };
  } catch (e) {
    let s = "";
    for (let i = ini; i < u8.length; i++) { const b = u8[i]; s += String.fromCharCode(CP1252[b] || b); }
    return { texto: s, codificacao: "windows-1252", bom: false };
  }
}

export function codificar(texto, codificacao, bom) {
  if (codificacao === "windows-1252") {
    const out = new Uint8Array(texto.length);
    let n = 0;
    for (const ch of texto) {
      const u = ch.codePointAt(0);
      let b;
      if (u < 0x80 || (u >= 0xA0 && u <= 0xFF)) b = u;
      else if (CP1252_INV.has(u)) b = CP1252_INV.get(u);
      else return null; // caractere que não cabe nessa codificação
      out[n++] = b;
    }
    return out.subarray(0, n);
  }
  if (codificacao === "utf-16le" || codificacao === "utf-16be") {
    const le = codificacao === "utf-16le";
    const out = new Uint8Array(2 + texto.length * 2);
    out[0] = le ? 0xFF : 0xFE; out[1] = le ? 0xFE : 0xFF;
    for (let i = 0; i < texto.length; i++) { const c = texto.charCodeAt(i); out[2 + i * 2] = le ? c & 255 : c >> 8; out[3 + i * 2] = le ? c >> 8 : c & 255; }
    return out;
  }
  const corpo = new TextEncoder().encode(texto);
  if (!bom) return corpo;
  const out = new Uint8Array(corpo.length + 3);
  out.set([0xEF, 0xBB, 0xBF]); out.set(corpo, 3);
  return out;
}

/** separador mais provável, olhando as primeiras linhas fora de aspas */
export function detectarSeparador(texto) {
  const amostra = texto.slice(0, 64 * 1024);
  const linhas = [];
  let atual = "", aspas = false;
  for (let i = 0; i < amostra.length && linhas.length < 30; i++) {
    const ch = amostra[i];
    if (ch === '"') aspas = !aspas;
    if (!aspas && (ch === "\n" || ch === "\r")) { if (atual) linhas.push(atual); atual = ""; if (ch === "\r" && amostra[i + 1] === "\n") i++; continue; }
    atual += aspas && ch !== '"' ? "" : ch;
  }
  if (atual) linhas.push(atual);
  let melhor = ";", nota = -1;
  for (const sep of [";", ",", "\t", "|"]) {
    const cont = linhas.map(l => l.split(sep).length - 1);
    if (!cont.length || cont[0] === 0) continue;
    const iguais = cont.filter(c => c === cont[0]).length / cont.length;
    const n = iguais * 100 + Math.min(cont[0], 20);
    if (n > nota) { nota = n; melhor = sep; }
  }
  return melhor;
}

/** lê o texto em linhas de campos. Guarda também se cada campo veio entre aspas. */
export function analisar(texto, sep) {
  const linhas = [];
  let campos = [], aspasLinha = [], campo = "", entreAspas = false, foiAspas = false, i = 0;
  const n = texto.length;
  let crlf = 0, lf = 0, cr = 0;
  const fimCampo = () => { campos.push(campo); aspasLinha.push(foiAspas); campo = ""; foiAspas = false; };
  const fimLinha = () => { fimCampo(); linhas.push({ campos, aspas: aspasLinha }); campos = []; aspasLinha = []; };
  while (i < n) {
    const ch = texto[i];
    if (entreAspas) {
      if (ch === '"') { if (texto[i + 1] === '"') { campo += '"'; i += 2; continue; } entreAspas = false; i++; continue; }
      campo += ch; i++; continue;
    }
    if (ch === '"' && campo === "") { entreAspas = true; foiAspas = true; i++; continue; }
    if (ch === sep) { fimCampo(); i++; continue; }
    if (ch === "\r") { if (texto[i + 1] === "\n") { crlf++; i += 2; } else { cr++; i++; } fimLinha(); continue; }
    if (ch === "\n") { lf++; i++; fimLinha(); continue; }
    campo += ch; i++;
  }
  const terminaComQuebra = n > 0 && (texto[n - 1] === "\n" || texto[n - 1] === "\r");
  if (!terminaComQuebra && (campo !== "" || campos.length || foiAspas)) fimLinha();
  const fimDeLinha = crlf >= lf && crlf >= cr && crlf > 0 ? "\r\n" : cr > lf ? "\r" : "\n";
  // aspas em todos os campos?
  let total = 0, comAspas = 0;
  for (const l of linhas.slice(0, 200)) for (let k = 0; k < l.campos.length; k++) { if (l.campos[k] === "" && !l.aspas[k]) continue; total++; if (l.aspas[k]) comAspas++; }
  const aspasSempre = total > 0 && comAspas / total > 0.9;
  return { linhas, fimDeLinha, terminaComQuebra, aspasSempre };
}

/** monta o texto CSV */
export function montar(linhas, { sep, fimDeLinha, terminaComQuebra, aspasSempre }) {
  const precisa = s => s.includes(sep) || s.includes('"') || s.includes("\n") || s.includes("\r") || /^\s|\s$/.test(s) && s.trim() !== "";
  const campo = s => {
    s = s == null ? "" : String(s);
    if ((aspasSempre && s !== "") || precisa(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const out = linhas.map(l => l.map(campo).join(sep)).join(fimDeLinha);
  return out + (terminaComQuebra && linhas.length ? fimDeLinha : "");
}

/** os números deste CSV usam vírgula decimal (padrão brasileiro)? */
export function detectarDecimalVirgula(linhas, sep) {
  if (sep === ";" || sep === "\t" || sep === "|") {
    let br = 0, en = 0;
    for (const l of linhas.slice(0, 500)) for (const c of l.campos) {
      if (/^-?\d{1,3}(\.\d{3})*,\d+$/.test(c) || /^-?\d+,\d+$/.test(c)) br++;
      else if (/^-?\d{1,3}(,\d{3})*\.\d+$/.test(c) || /^-?\d+\.\d{1,2}$/.test(c)) en++;
    }
    return br >= en;
  }
  return false;
}

import { chave } from "./enderecos.js";
import { paraIngles, paraMotor } from "./formula.js";
import { lerNumeroBR, lerNumeroEN } from "./formatos.js";

/** bytes do CSV → dados para o modelo da pasta (uma planilha) */
export function dadosCsv(bytes, nome = "Planilha1") {
  const { texto, codificacao, bom } = decodificar(bytes);
  const sep = detectarSeparador(texto);
  const { linhas, fimDeLinha, terminaComQuebra, aspasSempre } = analisar(texto, sep);
  const decimalVirgula = detectarDecimalVirgula(linhas, sep);
  const celulas = new Map();
  const hf = new Array(linhas.length);
  let maxC = -1;
  linhas.forEach((l, r) => {
    const out = new Array(l.campos.length);
    l.campos.forEach((t, c) => {
      if (t === "") { out[c] = null; return; }
      const cel = { s: 0, raw: t };
      if (t.startsWith("=") && t.length > 1) {
        try { cel.f = paraIngles(t.slice(1)); out[c] = "=" + paraMotor(cel.f); } catch (e) { out[c] = "'" + t; delete cel.f; }
      } else {
        const n = decimalVirgula ? lerNumeroBR(t, { pontoDecimal: false }) : lerNumeroEN(t);
        out[c] = n ? n.valor : "'" + t;
      }
      celulas.set(chave(r, c), cel);
      if (c > maxC) maxC = c;
    });
    hf[r] = out;
  });
  return {
    tipo: "csv",
    csv: { sep, decimalVirgula, codificacao, bom, fimDeLinha, terminaComQuebra, aspasSempre, camposPorLinha: linhas.map(l => l.campos.length) },
    folhas: [{ nome, celulas, hf, maxR: linhas.length - 1, maxC, linhas: new Map(), colunas: [], mesclas: [] }],
    abaAtiva: 0,
  };
}
