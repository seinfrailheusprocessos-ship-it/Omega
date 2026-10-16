// Endereços de células no estilo A1 (linhas e colunas começam em 0 internamente).
export const MAX_LINHAS = 1048576;
export const MAX_COLUNAS = 16384;

/** chave numérica de uma célula (linha, coluna) */
export const chave = (r, c) => r * MAX_COLUNAS + c;
export const linhaDaChave = k => Math.floor(k / MAX_COLUNAS);
export const colunaDaChave = k => k % MAX_COLUNAS;

const cacheLetras = [];
/** 0 → "A", 25 → "Z", 26 → "AA" */
export function letraColuna(c) {
  if (c < 1024 && cacheLetras[c]) return cacheLetras[c];
  let s = "", n = c + 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  if (c < 1024) cacheLetras[c] = s;
  return s;
}

/** "A" → 0, "AA" → 26 (sem validação de limite) */
export function numeroColuna(letras) {
  let n = 0;
  const L = letras.toUpperCase();
  for (let i = 0; i < L.length; i++) n = n * 26 + (L.charCodeAt(i) - 64);
  return n - 1;
}

/** {r, c} → "B3" */
export const nomeCelula = (r, c) => letraColuna(c) + (r + 1);

/** "B3" / "$B$3" → {r, c} ou null */
export function lerCelula(txt) {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d{1,7})$/.exec(String(txt).trim());
  if (!m) return null;
  const c = numeroColuna(m[1]), r = parseInt(m[2], 10) - 1;
  if (c < 0 || c >= MAX_COLUNAS || r < 0 || r >= MAX_LINHAS) return null;
  return { r, c };
}

/** "A1:C3", "A:A", "2:5", "B4" → {r1, c1, r2, c2} normalizado ou null */
export function lerIntervalo(txt) {
  const t = String(txt).trim().replace(/\$/g, "");
  if (!t) return null;
  const partes = t.split(":");
  if (partes.length === 1) { const a = lerCelula(partes[0]); return a ? { r1: a.r, c1: a.c, r2: a.r, c2: a.c } : null; }
  if (partes.length !== 2) return null;
  const [p, q] = partes;
  if (/^[A-Za-z]{1,3}$/.test(p) && /^[A-Za-z]{1,3}$/.test(q)) {
    const c1 = numeroColuna(p), c2 = numeroColuna(q);
    if (c1 >= MAX_COLUNAS || c2 >= MAX_COLUNAS) return null;
    return { r1: 0, c1: Math.min(c1, c2), r2: MAX_LINHAS - 1, c2: Math.max(c1, c2) };
  }
  if (/^\d+$/.test(p) && /^\d+$/.test(q)) {
    const r1 = +p - 1, r2 = +q - 1;
    if (r1 < 0 || r2 < 0) return null;
    return { r1: Math.min(r1, r2), c1: 0, r2: Math.max(r1, r2), c2: MAX_COLUNAS - 1 };
  }
  const a = lerCelula(p), b = lerCelula(q);
  if (!a || !b) return null;
  return { r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c), r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c) };
}

/** {r1,c1,r2,c2} → "A1:C3" (ou "A1" se for uma célula; "A:C" / "2:5" para colunas/linhas inteiras) */
export function nomeIntervalo(g) {
  if (g.r1 === 0 && g.r2 >= MAX_LINHAS - 1) return letraColuna(g.c1) + ":" + letraColuna(g.c2);
  if (g.c1 === 0 && g.c2 >= MAX_COLUNAS - 1) return (g.r1 + 1) + ":" + (g.r2 + 1);
  const a = nomeCelula(g.r1, g.c1);
  if (g.r1 === g.r2 && g.c1 === g.c2) return a;
  return a + ":" + nomeCelula(g.r2, g.c2);
}

export const dentro = (g, r, c) => r >= g.r1 && r <= g.r2 && c >= g.c1 && c <= g.c2;
export const intersecta = (a, b) => a.r1 <= b.r2 && b.r1 <= a.r2 && a.c1 <= b.c2 && b.c1 <= a.c2;
export const mesmoIntervalo = (a, b) => a && b && a.r1 === b.r1 && a.c1 === b.c1 && a.r2 === b.r2 && a.c2 === b.c2;
export const normalizar = (a, b) => ({ r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c), r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c) });

/** nome de planilha precisa de aspas numa fórmula? */
export function precisaAspas(nome) {
  if (!/^[\p{L}_\\][\p{L}\p{N}_.]*$/u.test(nome)) return true;
  // parece referência (A1, R1C1) ou valor lógico
  if (/^[A-Za-z]{1,3}\d+$/.test(nome) || /^R\d*C\d*$/i.test(nome) || /^(TRUE|FALSE)$/i.test(nome)) return true;
  return false;
}
export const citarFolha = nome => precisaAspas(nome) ? "'" + nome.replace(/'/g, "''") + "'" : nome;
