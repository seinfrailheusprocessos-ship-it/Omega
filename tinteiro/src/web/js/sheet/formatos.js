// Formatos de número do Excel mostrados no padrão brasileiro (1.234,56; dd/mm/aaaa) e leitura do que o usuário digita.

export const FORMATOS_EMBUTIDOS = {
  0: "General", 1: "0", 2: "0.00", 3: "#,##0", 4: "#,##0.00",
  5: '"R$" #,##0;-"R$" #,##0', 6: '"R$" #,##0;[Red]-"R$" #,##0', 7: '"R$" #,##0.00;-"R$" #,##0.00', 8: '"R$" #,##0.00;[Red]-"R$" #,##0.00',
  9: "0%", 10: "0.00%", 11: "0.00E+00", 12: "# ?/?", 13: "# ??/??", 14: "dd/mm/yyyy", 15: "d-mmm-yy", 16: "d-mmm", 17: "mmm-yy",
  18: "h:mm AM/PM", 19: "h:mm:ss AM/PM", 20: "h:mm", 21: "h:mm:ss", 22: "dd/mm/yyyy hh:mm",
  37: "#,##0 ;(#,##0)", 38: "#,##0 ;[Red](#,##0)", 39: "#,##0.00;(#,##0.00)", 40: "#,##0.00;[Red](#,##0.00)",
  41: '_(* #,##0_);_(* (#,##0);_(* "-"_);_(@_)', 42: '_("R$"* #,##0_);_("R$"* (#,##0);_("R$"* "-"_);_(@_)',
  43: '_(* #,##0.00_);_(* (#,##0.00);_(* "-"??_);_(@_)', 44: '_("R$"* #,##0.00_);_("R$"* (#,##0.00);_("R$"* "-"??_);_(@_)',
  45: "mm:ss", 46: "[h]:mm:ss", 47: "mm:ss.0", 48: "##0.0E+0", 49: "@",
};

// formatos oferecidos na barra de ferramentas
export const FORMATOS_PADRAO = {
  geral: "General",
  numero: "#,##0.00",
  moeda: '"R$" #,##0.00',
  contabil: '_-"R$" * #,##0.00_-;\\-"R$" * #,##0.00_-;_-"R$" * "-"??_-;_-@_-',
  percentual: "0.00%",
  data: "dd/mm/yyyy",
  dataHora: "dd/mm/yyyy hh:mm",
  hora: "hh:mm:ss",
  texto: "@",
};

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES_AB = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const DIAS_AB = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const CORES = { black: "#000000", preto: "#000000", blue: "#0000FF", azul: "#0000FF", cyan: "#00FFFF", ciano: "#00FFFF", green: "#00FF00", verde: "#00FF00", magenta: "#FF00FF", red: "#FF0000", vermelho: "#FF0000", white: "#FFFFFF", branco: "#FFFFFF", yellow: "#FFFF00", amarelo: "#FFFF00" };
const CORES_INDICE = ["#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF"];

// ------------------------------------------------------------------ datas
const BASE = Date.UTC(1899, 11, 30);
export function serialParaData(s) {
  let dias = Math.floor(s);
  let ms = Math.round((s - dias) * 86400000);
  if (ms >= 86400000) { dias += 1; ms -= 86400000; }
  let ano, mes, dia, sem;
  if (dias === 60) { ano = 1900; mes = 2; dia = 29; sem = 3; }
  else {
    const d = new Date(BASE + (dias < 60 ? dias + 1 : dias) * 86400000);
    ano = d.getUTCFullYear(); mes = d.getUTCMonth() + 1; dia = d.getUTCDate(); sem = d.getUTCDay();
  }
  const h = Math.floor(ms / 3600000), mi = Math.floor(ms / 60000) % 60, se = Math.floor(ms / 1000) % 60;
  return { ano, mes, dia, sem, h, mi, se, ms: ms % 1000, totalMs: ms, dias };
}
export function dataParaSerial(ano, mes, dia, h = 0, mi = 0, se = 0) {
  let dias = Math.round((Date.UTC(ano, mes - 1, dia) - BASE) / 86400000);
  if (dias < 61) dias -= 1;
  return dias + (h * 3600 + mi * 60 + se) / 86400;
}
export const hojeSerial = () => { const d = new Date(); return dataParaSerial(d.getFullYear(), d.getMonth() + 1, d.getDate()); };

// ------------------------------------------------------------------ números (pt-BR)
const agrupar = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
function arredondar(v, casas) {
  if (!isFinite(v)) return v;
  const r = Number(Math.round(Number(Math.abs(v) + "e" + casas)) + "e-" + casas);
  return v < 0 ? -r : r;
}
/** número no formato "Geral" (até ~11 caracteres, vírgula decimal) */
export function formatoGeral(v, max = 11) {
  if (!isFinite(v)) return v > 0 ? "∞" : "-∞";
  if (v === 0) return "0";
  const abs = Math.abs(v), neg = v < 0 ? "-" : "";
  if (Number.isInteger(v) && abs < 1e11) return String(v);
  const exp = () => {
    let s = abs.toExponential(5).replace(/\.?0+e/, "e");
    const [m, e] = s.split("e");
    const n = parseInt(e, 10);
    return neg + m.replace(".", ",") + "E" + (n < 0 ? "-" : "+") + String(Math.abs(n)).padStart(2, "0");
  };
  if (abs >= 1e11 || abs < 1e-9) return exp();
  let s = String(Number(abs.toPrecision(10)));
  if (s.includes("e")) return exp();
  const inteiro = s.split(".")[0];
  const disp = max - (neg ? 1 : 0) - inteiro.length - 1;
  if (s.length + (neg ? 1 : 0) > max) {
    if (disp <= 0) return neg + String(Math.round(abs));
    s = String(arredondar(abs, disp));
    if (abs < 1e-4 && Number(s) === 0) return exp();
  }
  return neg + s.replace(".", ",");
}
/** número completo para edição (pt-BR, até 15 dígitos significativos) */
export function numeroParaEdicao(v) {
  if (!isFinite(v)) return String(v);
  let s = String(Number(v.toPrecision(15)));
  if (s.includes("e")) {
    const [m, e] = s.split("e");
    return m.replace(".", ",") + "E" + (e.startsWith("-") ? e : "+" + e.replace("+", ""));
  }
  return s.replace(".", ",");
}

// ------------------------------------------------------------------ leitura do código de formato
const cache = new Map();

function lerSecoes(codigo) {
  const secoes = [];
  let atual = "", i = 0;
  while (i < codigo.length) {
    const ch = codigo[i];
    if (ch === '"') { const j = codigo.indexOf('"', i + 1); const f = j < 0 ? codigo.length : j + 1; atual += codigo.slice(i, f); i = f; continue; }
    if (ch === "\\" || ch === "_" || ch === "*") { atual += codigo.substr(i, 2); i += 2; continue; }
    if (ch === "[") { const j = codigo.indexOf("]", i); const f = j < 0 ? codigo.length : j + 1; atual += codigo.slice(i, f); i = f; continue; }
    if (ch === ";") { secoes.push(atual); atual = ""; i++; continue; }
    atual += ch; i++;
  }
  secoes.push(atual);
  return secoes.map(lerSecao);
}

function lerSecao(txt) {
  const sec = { toks: [], cor: null, cond: null, data: false, texto: false, num: false, geral: false, pct: 0, exp: false, fracao: false, preencher: false, tempoDecorrido: false, ampm: false };
  let i = 0;
  const lit = s => { if (s) sec.toks.push({ t: "lit", v: s }); };
  while (i < txt.length) {
    const ch = txt[i];
    const resto = txt.slice(i);
    if (ch === '"') { const j = txt.indexOf('"', i + 1); const f = j < 0 ? txt.length : j; lit(txt.slice(i + 1, f)); i = f + 1; continue; }
    if (ch === "\\") { lit(txt[i + 1] || ""); i += 2; continue; }
    if (ch === "_") { lit(" "); i += 2; continue; }
    if (ch === "*") { sec.toks.push({ t: "fill" }); sec.preencher = true; i += 2; continue; }
    if (ch === "[") {
      const j = txt.indexOf("]", i); const dentro = txt.slice(i + 1, j < 0 ? txt.length : j); i = j < 0 ? txt.length : j + 1;
      const D = dentro.toLowerCase();
      if (CORES[D]) sec.cor = CORES[D];
      else if (/^(color|cor)\s*\d+$/.test(D)) { const n = parseInt(D.replace(/\D/g, ""), 10); sec.cor = CORES_INDICE[(n - 1) % 8] || null; }
      else if (/^(<=|>=|<>|<|>|=)\s*-?[\d.,]+$/.test(dentro)) { const m = /^(<=|>=|<>|<|>|=)\s*(-?[\d.,]+)$/.exec(dentro); sec.cond = { op: m[1], v: parseFloat(m[2].replace(",", ".")) }; }
      else if (/^h+$/i.test(dentro)) { sec.toks.push({ t: "dec", u: "h", n: dentro.length }); sec.data = true; sec.tempoDecorrido = true; }
      else if (/^m+$/i.test(dentro)) { sec.toks.push({ t: "dec", u: "m", n: dentro.length }); sec.data = true; sec.tempoDecorrido = true; }
      else if (/^s+$/i.test(dentro)) { sec.toks.push({ t: "dec", u: "s", n: dentro.length }); sec.data = true; sec.tempoDecorrido = true; }
      else if (dentro.startsWith("$")) {
        const m = /^\$([^-]*)(?:-([0-9A-Fa-f]+))?/.exec(dentro);
        const loc = (m && m[2] || "").toUpperCase();
        if (loc.endsWith("F800")) { sec.longa = true; sec.data = true; }
        else if (loc.endsWith("F400")) { sec.horaSistema = true; sec.data = true; }
        lit(m ? m[1] : "");
      }
      continue;
    }
    if (/^(general|geral)/i.test(resto)) { sec.toks.push({ t: "geral" }); sec.geral = true; i += /^general/i.test(resto) ? 7 : 5; continue; }
    if (/^(am\/pm|a\/p)/i.test(resto)) { const n = /^am\/pm/i.test(resto) ? 5 : 3; sec.toks.push({ t: "ampm", curto: n === 3 }); sec.ampm = true; sec.data = true; i += n; continue; }
    if (/[yYdDhHsSeE]/.test(ch) && !/[eE][+-]/.test(resto.slice(0, 2)) || /[mM]/.test(ch)) {
      if (/[eE]/.test(ch) && sec.num) { /* expoente tratado abaixo */ }
      else {
        let j = i; const L = ch.toLowerCase(); while (j < txt.length && txt[j].toLowerCase() === L) j++;
        const n = j - i;
        if (L === "e") { sec.toks.push({ t: "data", u: "y", n: 4 }); }
        else sec.toks.push({ t: "data", u: L, n });
        sec.data = true; i = j; continue;
      }
    }
    if (/^[eE][+-]/.test(resto) && sec.num) { let j = i + 2; while ("0#?".includes(txt[j]) && j < txt.length) j++; sec.toks.push({ t: "exp", sinal: resto[1], n: j - i - 2 }); sec.exp = true; i = j; continue; }
    if ("0#?".includes(ch)) { sec.toks.push({ t: "ph", v: ch }); sec.num = true; i++; continue; }
    if (ch === "." ) {
      // ".0" depois de segundos = frações de segundo
      if (sec.data && !sec.num && /^\.0+/.test(resto)) { const m = /^\.0+/.exec(resto)[0]; sec.toks.push({ t: "fs", n: m.length - 1 }); i += m.length; continue; }
      sec.toks.push({ t: "ponto" }); i++; continue;
    }
    if (ch === ",") { sec.toks.push({ t: "virg" }); i++; continue; }
    if (ch === "%") { sec.toks.push({ t: "lit", v: "%" }); sec.pct++; i++; continue; }
    if (ch === "@") { sec.toks.push({ t: "arroba" }); sec.texto = true; i++; continue; }
    if (ch === "/" && sec.num && /^\/\s*[0-9#?]/.test(resto)) { sec.toks.push({ t: "barra" }); sec.fracao = true; i++; continue; }
    lit(ch); i++;
  }
  // "m" logo após h ou antes de s é minuto
  const dt = sec.toks.filter(t => t.t === "data" || t.t === "dec");
  for (let k = 0; k < dt.length; k++) {
    const t = dt[k];
    if (t.u !== "m" || t.t !== "data" || t.n > 2) continue;
    const ant = dt[k - 1], prox = dt[k + 1];
    if ((ant && (ant.u === "h")) || (prox && prox.u === "s")) t.u = "min";
  }
  if (sec.data) sec.num = false;
  // vírgulas: separador de milhar (entre dígitos) ou divisão por mil (no fim)
  if (sec.num) {
    const toks = sec.toks;
    sec.milhar = false; sec.escala = 0;
    for (let k = 0; k < toks.length; k++) {
      if (toks[k].t !== "virg") continue;
      let a = k - 1; while (a >= 0 && toks[a].t === "virg") a--;
      let b = k + 1; while (b < toks.length && toks[b].t === "virg") b++;
      const antesPh = a >= 0 && toks[a].t === "ph";
      const depoisPh = b < toks.length && toks[b].t === "ph";
      if (antesPh && depoisPh) { toks[k].t = "nada"; sec.milhar = true; }
      else if (antesPh) { toks[k].t = "nada"; sec.escala++; }
      else toks[k] = { t: "lit", v: "," };
    }
  } else sec.toks = sec.toks.map(t => t.t === "virg" ? { t: "lit", v: "," } : t.t === "ponto" ? { t: "lit", v: "." } : t);
  return sec;
}

function compilar(codigo) {
  let c = cache.get(codigo);
  if (c) return c;
  const secoes = lerSecoes(codigo || "General");
  c = { secoes, data: secoes.some(s => s.data), codigo };
  if (cache.size > 500) cache.clear();
  cache.set(codigo, c);
  return c;
}

export function ehFormatoData(codigo) { return !!codigo && compilar(codigo).secoes[0].data; }
export function ehFormatoHora(codigo) { const s = compilar(codigo).secoes[0]; return s.data && !s.toks.some(t => t.t === "data" && ["y", "d", "m"].includes(t.u)) ; }
export function ehFormatoPercentual(codigo) { return !!codigo && compilar(codigo).secoes[0].pct > 0; }
export function ehFormatoTexto(codigo) { return codigo === "@"; }

/** tipo do formato (para a barra de ferramentas) */
export function tipoFormato(codigo) {
  if (!codigo || /^(general|geral)$/i.test(codigo)) return "geral";
  if (codigo === "@") return "texto";
  const s = compilar(codigo).secoes[0];
  if (s.data) return ehFormatoHora(codigo) ? "hora" : "data";
  if (s.pct) return "percentual";
  if (/R\$|\[\$/.test(codigo)) return codigo.includes("*") ? "contabil" : "moeda";
  if (s.num) return "numero";
  return "personalizado";
}

/** quantas casas decimais o formato mostra */
export function casasDecimais(codigo) {
  const s = compilar(codigo || "General").secoes[0];
  if (!s.num) return null;
  let depois = false, n = 0;
  for (const t of s.toks) { if (t.t === "ponto") depois = true; else if (t.t === "ph" && depois) n++; else if (t.t === "exp") break; }
  return n;
}

/** muda as casas decimais de um formato numérico (+1 / −1) */
export function mudarCasas(codigo, delta) {
  if (!codigo || /^(general|geral)$/i.test(codigo)) return delta > 0 ? "0.0" : "0";
  const partes = [];
  let atual = "", i = 0, q = false;
  // altera cada seção: acha o último bloco de dígitos
  const ajustar = sec => {
    const m = /([0#?,]*)(\.([0#?]*))?(?![^"]*"(?:[^"]*"[^"]*")*[^"]*$)/;
    // procura o primeiro grupo de marcadores numéricos fora de aspas
    let pos = -1, dentroAspas = false;
    for (let k = 0; k < sec.length; k++) {
      const ch = sec[k];
      if (ch === '"') dentroAspas = !dentroAspas;
      else if (!dentroAspas && "0#?".includes(ch)) { pos = k; break; }
      else if (!dentroAspas && (ch === "\\" || ch === "_" || ch === "*")) k++;
    }
    if (pos < 0) return sec;
    let fim = pos; while (fim < sec.length && "0#?,.".includes(sec[fim])) fim++;
    const bloco = sec.slice(pos, fim);
    const [int, dec = null] = bloco.split(".");
    let novoDec;
    if (delta > 0) novoDec = (dec || "") + "0";
    else novoDec = dec ? dec.slice(0, -1) : null;
    const novo = int + (novoDec ? "." + novoDec : "");
    void m;
    return sec.slice(0, pos) + novo + sec.slice(fim);
  };
  for (; i < codigo.length; i++) {
    const ch = codigo[i];
    if (ch === '"') q = !q;
    if (ch === ";" && !q) { partes.push(atual); atual = ""; continue; }
    atual += ch;
  }
  partes.push(atual);
  return partes.map(ajustar).join(";");
}

// ------------------------------------------------------------------ aplicação do formato
function escolherSecao(c, v) {
  const S = c.secoes;
  if (typeof v === "string") {
    if (S.length >= 4) return { sec: S[3], v, abs: false };
    if (S[0].texto && !S[0].num && !S[0].data) return { sec: S[0], v, abs: false };
    return null;
  }
  const temCond = S.some(s => s.cond);
  if (temCond) {
    const ok = (s) => {
      const { op, v: x } = s.cond;
      return op === "<" ? v < x : op === ">" ? v > x : op === "<=" ? v <= x : op === ">=" ? v >= x : op === "=" ? v === x : v !== x;
    };
    if (S[0].cond && ok(S[0])) return { sec: S[0], v, abs: v < 0 && S[0].cond.op.includes("<") ? true : false };
    if (S[1] && S[1].cond && ok(S[1])) return { sec: S[1], v, abs: true };
    if (S[1] && !S[1].cond) return { sec: S[1], v, abs: v < 0 };
    if (S[2]) return { sec: S[2], v, abs: true };
    return { sec: S[0], v, abs: false };
  }
  if (S.length === 1 || v > 0 || (v === 0 && S.length < 3)) return { sec: S[0], v, abs: false };
  if (v < 0) return S[1] && S[1].toks.length ? { sec: S[1], v, abs: true } : { sec: S[0], v, abs: false };
  return { sec: S[2] || S[0], v, abs: false };
}

/**
 * Formata um valor para exibir.
 * Devolve { texto, cor?, esquerda?, direita? } — esquerda/direita quando o formato tem preenchimento (*), como no Contábil.
 */
export function formatar(v, codigo) {
  if (v === null || v === undefined || v === "") return { texto: "" };
  if (typeof v === "boolean") return { texto: v ? "VERDADEIRO" : "FALSO" };
  if (!codigo || /^(general|geral)$/i.test(codigo)) {
    return { texto: typeof v === "number" ? formatoGeral(v) : String(v) };
  }
  const c = compilar(codigo);
  const esc = escolherSecao(c, v);
  if (!esc) return { texto: String(v) };
  const { sec } = esc;
  let texto;
  try {
    if (typeof v === "string") texto = montar(sec, () => v, v);
    else if (sec.data) texto = formatarData(sec, v);
    else if (sec.geral && !sec.num) texto = montar(sec, () => formatoGeral(esc.abs ? Math.abs(v) : v), v);
    else if (sec.num) texto = formatarNumero(sec, esc.abs ? Math.abs(v) : v, c.secoes.length === 1 || (!esc.abs && v < 0));
    else texto = montar(sec, () => (typeof v === "number" ? "" : String(v)), v);
  } catch (e) { texto = typeof v === "number" ? formatoGeral(v) : String(v); }
  const r = { texto, cor: sec.cor };
  if (sec.preencher && texto.includes("\u0000")) {
    const [a, b] = texto.split("\u0000");
    r.esquerda = a; r.direita = b; r.texto = a + b;
  } else r.texto = texto.replace(/\u0000/g, "");
  return r;
}

function montar(sec, valorTexto) {
  let s = "";
  for (const t of sec.toks) {
    if (t.t === "lit") s += t.v;
    else if (t.t === "fill") s += "\u0000";
    else if (t.t === "arroba" || t.t === "geral") s += valorTexto();
  }
  return s;
}

function formatarNumero(sec, v, sinalAuto) {
  const neg = v < 0;
  let x = Math.abs(v);
  x *= Math.pow(100, sec.pct);
  x /= Math.pow(1000, sec.escala || 0);
  const toks = sec.toks;
  // posições dos marcadores
  const iPonto = toks.findIndex(t => t.t === "ponto");
  const iExp = toks.findIndex(t => t.t === "exp");
  const iBarra = toks.findIndex(t => t.t === "barra");
  const phs = toks.map((t, k) => t.t === "ph" ? k : -1).filter(k => k >= 0);
  const fimMantissa = iExp >= 0 ? iExp : toks.length;
  const intPh = phs.filter(k => (iPonto < 0 || k < iPonto) && k < fimMantissa && (iBarra < 0 || k < iBarra));
  const decPh = iPonto >= 0 ? phs.filter(k => k > iPonto && k < fimMantissa) : [];
  let expoente = 0;
  if (iBarra >= 0) return fracao(sec, neg && sinalAuto, x);
  if (iExp >= 0) {
    if (x !== 0) {
      const nInt = Math.max(1, intPh.length);
      expoente = Math.floor(Math.log10(x));
      // engenharia (##0.0E+0): expoente múltiplo do nº de dígitos inteiros
      if (nInt > 1 && intPh.some(k => toks[k].v === "#")) expoente = Math.floor(expoente / nInt) * nInt;
      else expoente = expoente - (nInt - 1);
      x = x / Math.pow(10, expoente);
      const arred = arredondar(x, decPh.length);
      if (arred >= Math.pow(10, Math.max(1, intPh.length)) && !(nInt > 1 && intPh.some(k => toks[k].v === "#"))) { expoente++; x = x / 10; }
    }
  }
  const xr = arredondar(x, decPh.length);
  let [intS, decS = ""] = xr.toFixed(decPh.length).split(".");
  if (intS === "0") intS = "";
  // casas decimais
  const decOut = [];
  for (let k = 0; k < decPh.length; k++) decOut.push(decS[k] || "0");
  // remove zeros finais nos marcadores "#" e "?"
  for (let k = decPh.length - 1; k >= 0; k--) {
    const ph = toks[decPh[k]].v;
    if (ph === "0") break;
    if (decOut[k] === "0") decOut[k] = ph === "?" ? " " : ""; else break;
  }
  // inteiros: distribui os dígitos da direita para a esquerda
  const intOut = new Map();
  let digs = intS;
  if (sec.milhar && intPh.length) {
    const minZeros = intPh.filter(k => toks[k].v === "0").length;
    let s = digs.padStart(minZeros, "0");
    s = s ? agrupar(s) : "";
    intPh.forEach((k, idx) => intOut.set(k, idx === 0 ? s : ""));
  } else {
    for (let idx = intPh.length - 1; idx >= 0; idx--) {
      const k = intPh[idx], ph = toks[k].v;
      if (idx === 0) intOut.set(k, digs || (ph === "0" ? "0" : ph === "?" ? " " : ""));
      else if (digs) { intOut.set(k, digs.slice(-1)); digs = digs.slice(0, -1); }
      else intOut.set(k, ph === "0" ? "0" : ph === "?" ? " " : "");
    }
  }
  let s = "", virgulaPosta = false;
  const temDigitos = intS !== "" || decOut.some(d => d && d !== " ");
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.t === "ph") {
      if (intOut.has(k)) s += intOut.get(k);
      else { const j = decPh.indexOf(k); if (j >= 0) s += decOut[j]; else if (iExp >= 0 && k > iExp) s += ""; }
    } else if (t.t === "ponto") { if (decOut.some(d => d !== "")) s += ","; virgulaPosta = true; }
    else if (t.t === "exp") {
      const e = Math.abs(expoente);
      s += "E" + (expoente < 0 ? "-" : t.sinal === "+" ? "+" : "") + String(e).padStart(t.n, "0");
    }
    else if (t.t === "lit") s += t.v;
    else if (t.t === "fill") s += "\u0000";
    else if (t.t === "geral") s += formatoGeral(x);
    else if (t.t === "arroba") s += "";
  }
  void virgulaPosta;
  if (neg && sinalAuto && (temDigitos || xr !== 0)) {
    // coloca o "-" antes do primeiro dígito/símbolo, mas depois do preenchimento do contábil
    const i0 = s.indexOf("\u0000");
    s = i0 >= 0 ? s.slice(0, i0 + 1) + "-" + s.slice(i0 + 1) : "-" + s;
  }
  return s;
}

function fracao(sec, neg, x) {
  const toks = sec.toks;
  const iBarra = toks.findIndex(t => t.t === "barra");
  const den = toks.slice(iBarra + 1).filter(t => t.t === "ph").length;
  const litDen = toks.slice(iBarra + 1).find(t => t.t === "lit" && /^\d+$/.test(t.v));
  const temInteiro = toks.slice(0, iBarra).some((t, k, arr) => t.t === "lit" && /\s/.test(t.v) && arr.slice(0, k).some(u => u.t === "ph"));
  let inteiro = temInteiro ? Math.floor(x) : 0;
  let f = x - inteiro;
  let num, d;
  if (litDen) { d = parseInt(litDen.v, 10); num = Math.round(f * d); }
  else {
    const maxD = Math.pow(10, Math.max(1, den)) - 1;
    let best = [0, 1], erro = Infinity;
    for (let q = 1; q <= maxD; q++) { const p = Math.round(f * q); const e = Math.abs(f - p / q); if (e < erro - 1e-12) { erro = e; best = [p, q]; } }
    [num, d] = best;
  }
  if (num === d) { inteiro++; num = 0; }
  const s = (temInteiro ? (inteiro ? String(inteiro) : "") : String(num + inteiro * d)) + (num ? (temInteiro && inteiro ? " " : "") + num + "/" + d : temInteiro ? "" : "/" + d);
  return (neg ? "-" : "") + (s || "0");
}

function formatarData(sec, v) {
  if (v < 0 || v > 2958465.99999) return "#".repeat(10);
  if (sec.longa) {
    const d = serialParaData(v);
    return `${DIAS[d.sem]}, ${d.dia} de ${MESES[d.mes - 1]} de ${d.ano}`;
  }
  if (sec.horaSistema) {
    const d = serialParaData(v);
    return [d.h, d.mi, d.se].map(n => String(n).padStart(2, "0")).join(":");
  }
  const fs = sec.toks.find(t => t.t === "fs");
  const casas = fs ? fs.n : 0;
  // arredonda ao segundo (ou fração mostrada)
  const passo = 86400 * Math.pow(10, casas);
  const vr = Math.round(v * passo) / passo;
  const d = serialParaData(vr);
  const totalSeg = vr * 86400;
  let s = "";
  for (const t of sec.toks) {
    if (t.t === "lit") { s += t.v; continue; }
    if (t.t === "fill") continue;
    if (t.t === "ampm") { s += t.curto ? (d.h < 12 ? "A" : "P") : (d.h < 12 ? "AM" : "PM"); continue; }
    if (t.t === "fs") { s += "," + String(Math.floor(d.ms / Math.pow(10, 3 - t.n))).padStart(t.n, "0"); continue; }
    if (t.t === "dec") {
      const val = t.u === "h" ? Math.floor(totalSeg / 3600) : t.u === "m" ? Math.floor(totalSeg / 60) : Math.floor(totalSeg);
      s += String(val).padStart(t.n, "0"); continue;
    }
    if (t.t === "data") {
      const n = t.n;
      switch (t.u) {
        case "y": s += n <= 2 ? String(d.ano % 100).padStart(2, "0") : String(d.ano); break;
        case "m": s += n === 1 ? d.mes : n === 2 ? String(d.mes).padStart(2, "0") : n === 3 ? MESES_AB[d.mes - 1] : n === 5 ? MESES[d.mes - 1][0] : MESES[d.mes - 1]; break;
        case "min": s += n === 1 ? d.mi : String(d.mi).padStart(2, "0"); break;
        case "d": s += n === 1 ? d.dia : n === 2 ? String(d.dia).padStart(2, "0") : n === 3 ? DIAS_AB[d.sem] : DIAS[d.sem]; break;
        case "h": { let h = d.h; if (sec.ampm) { h = h % 12; if (h === 0) h = 12; } s += n === 1 ? h : String(h).padStart(2, "0"); break; }
        case "s": s += n === 1 ? d.se : String(d.se).padStart(2, "0"); break;
        default: break;
      }
      continue;
    }
    if (t.t === "ph") s += t.v === "0" ? "0" : "";
    if (t.t === "ponto") s += ",";
  }
  return s;
}

// ------------------------------------------------------------------ o que o usuário digita
const RE_NUM_BR = /^([-+]?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?(?:[eE]([-+]?\d+))?$/;
const RE_NUM_PONTO = /^([-+]?)(\d+)\.(\d+)$/;

/** lê um número escrito em português (1.234,56) — ou null */
export function lerNumeroBR(txt, { pontoDecimal = true } = {}) {
  let s = String(txt).trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1).trim(); }
  const m = RE_NUM_BR.exec(s);
  if (m) {
    const n = parseFloat((m[1] === "-" ? "-" : "") + m[2].replace(/\./g, "") + (m[3] ? "." + m[3] : "") + (m[4] ? "e" + m[4] : ""));
    return { valor: neg ? -n : n, milhar: m[2].includes("."), casas: m[3] ? m[3].length : 0 };
  }
  if (pontoDecimal) {
    const p = RE_NUM_PONTO.exec(s);
    if (p && p[3].length !== 3) { const n = parseFloat(p[1] + p[2] + "." + p[3]); return { valor: neg ? -n : n, milhar: false, casas: p[3].length }; }
  }
  return null;
}
/** lê um número escrito em inglês (1,234.56) — usado em CSV com vírgula como separador */
export function lerNumeroEN(txt) {
  const s = String(txt).trim();
  const m = /^([-+]?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(?:[eE]([-+]?\d+))?$/.exec(s);
  if (!m) return null;
  return { valor: parseFloat(m[1] + m[2].replace(/,/g, "") + (m[3] ? "." + m[3] : "") + (m[4] ? "e" + m[4] : "")), milhar: m[2].includes(","), casas: m[3] ? m[3].length : 0 };
}

/**
 * Interpreta o texto digitado numa célula, como o Excel em português.
 * Devolve { tipo: "vazio"|"formula"|"numero"|"texto"|"bool", valor, formato? }
 * formato: sugestão quando a célula ainda está como "Geral" (ex.: digitou 15% ou 16/10/2026)
 */
export function interpretarEntrada(texto) {
  const t = String(texto);
  if (t === "") return { tipo: "vazio" };
  if (t.startsWith("=") && t.length > 1) return { tipo: "formula", valor: t.slice(1) };
  if (t.startsWith("'")) return { tipo: "texto", valor: t.slice(1) };
  const s = t.trim();
  if (!s) return { tipo: "texto", valor: t };
  const U = s.toUpperCase();
  if (U === "VERDADEIRO" || U === "TRUE") return { tipo: "bool", valor: true };
  if (U === "FALSO" || U === "FALSE") return { tipo: "bool", valor: false };
  let n = lerNumeroBR(s);
  if (n) return { tipo: "numero", valor: n.valor, formato: n.milhar ? (n.casas ? "#,##0.00" : "#,##0") : null };
  // moeda: R$ 1.234,56 / -R$ 10 / R$-10
  let m = /^(-)?\s*R\$\s*(-)?\s*(.+)$/i.exec(s);
  if (m) { n = lerNumeroBR(m[3]); if (n) return { tipo: "numero", valor: (m[1] || m[2] ? -1 : 1) * n.valor, formato: '"R$" #,##0.00' }; }
  // percentual
  m = /^(.+?)\s*%$/.exec(s);
  if (m) { n = lerNumeroBR(m[1]); if (n) return { tipo: "numero", valor: n.valor / 100, formato: n.casas ? "0." + "0".repeat(Math.min(n.casas, 10)) + "%" : "0%" }; }
  // data dd/mm/aaaa [hh:mm[:ss]]
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
  if (m) {
    const dia = +m[1], mes = +m[2];
    let ano = +m[3]; if (m[3].length === 2) ano += ano < 30 ? 2000 : 1900;
    if (dataValida(ano, mes, dia)) {
      const comHora = m[4] != null;
      const h = comHora ? +m[4] : 0, mi = comHora ? +m[5] : 0, se = m[6] ? +m[6] : 0;
      if (h < 24 && mi < 60 && se < 60) return { tipo: "numero", valor: dataParaSerial(ano, mes, dia, h, mi, se), formato: comHora ? "dd/mm/yyyy hh:mm" : "dd/mm/yyyy" };
    }
  }
  // dd/mm (ano atual)
  m = /^(\d{1,2})\/(\d{1,2})$/.exec(s);
  if (m) {
    const ano = new Date().getFullYear(), dia = +m[1], mes = +m[2];
    if (dataValida(ano, mes, dia)) return { tipo: "numero", valor: dataParaSerial(ano, mes, dia), formato: "d/mmm" };
  }
  // hora hh:mm[:ss]
  m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (m && +m[2] < 60 && (!m[3] || +m[3] < 60)) return { tipo: "numero", valor: (+m[1] * 3600 + +m[2] * 60 + (m[3] ? +m[3] : 0)) / 86400, formato: m[3] ? "hh:mm:ss" : "hh:mm" };
  return { tipo: "texto", valor: t };
}
function dataValida(a, m, d) {
  if (m < 1 || m > 12 || d < 1 || a < 1900 || a > 9999) return false;
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** texto mostrado na barra de fórmulas/edição para um valor (não fórmula) */
export function valorParaEdicao(v, codigo) {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "VERDADEIRO" : "FALSO";
  if (typeof v === "number") {
    if (codigo && ehFormatoData(codigo) && v >= 0) {
      const d = serialParaData(v);
      const p = n => String(n).padStart(2, "0");
      const data = `${p(d.dia)}/${p(d.mes)}/${d.ano}`;
      const hora = `${p(d.h)}:${p(d.mi)}:${p(d.se)}`;
      if (ehFormatoHora(codigo)) return v >= 1 ? data + " " + hora : hora;
      return d.totalMs ? data + " " + hora : data;
    }
    if (codigo && ehFormatoPercentual(codigo)) return numeroParaEdicao(v * 100) + "%";
    return numeroParaEdicao(v);
  }
  return String(v);
}
