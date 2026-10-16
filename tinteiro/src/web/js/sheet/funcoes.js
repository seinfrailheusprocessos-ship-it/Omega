// Nomes de funções: inglês (como fica no arquivo) ⇄ português do Brasil (como o usuário digita e vê).
import ptPT from "hyperformula/i18n/languages/ptPT";

// o pacote de idioma de Portugal é quase igual ao do Excel brasileiro; estas são as diferenças
const AJUSTES_BR = {
  HYPERLINK: "HIPERLINK", SWITCH: "PARÂMETRO", FILTER: "FILTRO", UNIQUE: "ÚNICO", SORT: "CLASSIFICAR",
  VSTACK: "EMPILHARV", HSTACK: "EMPILHARH", IFS: "SES", IFNA: "SENÃODISP", DATEDIF: "DATADIF", ARABIC: "ARÁBICO",
  SHEET: "PLAN", SHEETS: "PLANS", FORMULATEXT: "FÓRMULATEXTO", "CEILING.MATH": "TETO.MAT", "FLOOR.MATH": "ARREDMULTB.MAT",
  "CEILING.PRECISE": "TETO.PRECISO", "FLOOR.PRECISE": "ARREDMULTB.PRECISO", "ISO.CEILING": "ISO.TETO", SERIESSUM: "SOMASEQÜÊNCIA",
};
// funções do Excel que o motor de cálculo não tem, mas que precisam ser traduzidas
const EXTRAS = {
  RANK: "ORDEM", "RANK.EQ": "ORDEM.EQ", "RANK.AVG": "ORDEM.MÉD", CONCAT: "CONCAT", MODE: "MODO", "MODE.SNGL": "MODO.ÚNICO",
  "MODE.MULT": "MODO.MULT", LOOKUP: "PROC", INDIRECT: "INDIRETO", NUMBERVALUE: "VALORNUMÉRICO", FIXED: "DEF.NÚM.DEC",
  DOLLAR: "MOEDA", AGGREGATE: "AGREGAR", AVERAGEIFS: "MÉDIASES", XMATCH: "CORRESPX", TEXTBEFORE: "TEXTOANTES",
  TEXTAFTER: "TEXTODEPOIS", TEXTSPLIT: "DIVIDIRTEXTO", LET: "LET", LAMBDA: "LAMBDA", CELL: "CÉL", TYPE: "TIPO", INFO: "INFORMAÇÃO",
  PERCENTRANK: "ORDEM.PORCENTUAL", FORECAST: "PREVISÃO", "FORECAST.LINEAR": "PREVISÃO.LINEAR", TREND: "TENDÊNCIA",
  GROWTH: "CRESCIMENTO", LINEST: "PROJ.LIN", FREQUENCY: "FREQÜÊNCIA", RANDARRAY: "MATRIZALEATÓRIA", TOCOL: "PARACOL",
  TOROW: "PARALIN", TAKE: "PEGAR", DROP: "DESCARTAR", CHOOSECOLS: "ESCOLHERCOLS", CHOOSEROWS: "ESCOLHERLINS",
  SORTBY: "CLASSIFICARPOR", ENCODEURL: "CODIFURL", ASC: "ASC", BAHTTEXT: "BAHTTEXT", PRICE: "PREÇO", YIELD: "LUCRO",
  ACCRINT: "JUROSACUM", DURATION: "DURAÇÃO", INTERCEPT: "INTERCEPÇÃO", KURT: "CURT", MEDIANIFS: "MEDIANIFS",
  PERMUT: "PERMUT", PROB: "PROB", QUARTILE: "QUARTIL", SUMPRODUCT: "SOMARPRODUTO", ISOMITTED: "ÉOMITIDO", T: "T", N: "N",
  CONVERT: "CONVERTER", TEXTJOIN: "UNIRTEXTO", MINIFS: "MÍNIMOSES", MAXIFS: "MÁXIMOSES", DAYS: "DIAS", COUNTA: "CONT.VALORES",
};
// funções "novas" que o Excel grava com o prefixo _xlfn. no arquivo
export const COM_XLFN = new Set(("ACOT ACOTH AGGREGATE ARABIC BASE BETA.DIST BETA.INV BINOM.DIST BINOM.DIST.RANGE BINOM.INV BITAND BITLSHIFT BITOR " +
  "BITRSHIFT BITXOR CEILING.MATH CEILING.PRECISE CHISQ.DIST CHISQ.DIST.RT CHISQ.INV CHISQ.INV.RT CHISQ.TEST COMBINA CONCAT " +
  "CONFIDENCE.NORM CONFIDENCE.T COT COTH COVARIANCE.P COVARIANCE.S CSC CSCH DAYS DECIMAL ERF.PRECISE ERFC.PRECISE EXPON.DIST F.DIST " +
  "F.DIST.RT F.INV F.INV.RT F.TEST FLOOR.MATH FLOOR.PRECISE FORECAST.LINEAR FORMULATEXT GAMMA GAMMA.DIST GAMMA.INV GAMMALN.PRECISE " +
  "GAUSS HYPGEOM.DIST IFNA IFS IMCOSH IMCOT IMCSC IMCSCH IMSEC IMSECH IMSINH IMTAN ISFORMULA ISOWEEKNUM LOGNORM.DIST LOGNORM.INV " +
  "MAXIFS MINIFS MODE.MULT MODE.SNGL MUNIT NEGBINOM.DIST NETWORKDAYS.INTL NORM.DIST NORM.INV NORM.S.DIST NORM.S.INV NUMBERVALUE PDURATION " +
  "PERCENTILE.EXC PERCENTILE.INC PERCENTRANK.EXC PERCENTRANK.INC PERMUTATIONA PHI POISSON.DIST QUARTILE.EXC QUARTILE.INC RANK.AVG RANK.EQ " +
  "RRI SEC SECH SHEET SHEETS SKEW.P STDEV.P STDEV.S SWITCH T.DIST T.DIST.2T T.DIST.RT T.INV T.INV.2T T.TEST TEXTJOIN UNICHAR UNICODE " +
  "VAR.P VAR.S WEIBULL.DIST WORKDAY.INTL XOR Z.TEST XLOOKUP XMATCH UNIQUE SEQUENCE RANDARRAY LET LAMBDA VSTACK HSTACK TEXTBEFORE " +
  "TEXTAFTER TEXTSPLIT TOCOL TOROW TAKE DROP CHOOSECOLS CHOOSEROWS SORTBY FILTER SORT ISOMITTED").split(" "));
// destas o Excel ainda acrescenta _xlws.
export const COM_XLWS = new Set(["FILTER", "SORT"]);

export const EN_PT = new Map();
export const PT_EN = new Map();
const semAcento = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const SEM_ACENTO_EN = new Map();

for (const [en, pt] of Object.entries({ ...ptPT.functions, ...EXTRAS, ...AJUSTES_BR })) {
  if (!pt || en.startsWith("HF.")) continue;
  EN_PT.set(en, pt);
}
for (const [en, pt] of EN_PT) {
  PT_EN.set(pt, en);
  const s = semAcento(pt);
  if (s !== pt && !SEM_ACENTO_EN.has(s)) SEM_ACENTO_EN.set(s, en);
}
const NOMES_EN = new Set([...EN_PT.keys(), ...COM_XLFN]);

/** nome digitado (pt ou en, com ou sem acento) → nome em inglês (ou null se desconhecido) */
export function nomeIngles(nome) {
  const N = nome.toUpperCase().replace(/^(_XLFN\.)?(_XLWS\.)?/, "");
  if (PT_EN.has(N)) return PT_EN.get(N);
  if (NOMES_EN.has(N)) return N;
  const s = semAcento(N);
  if (SEM_ACENTO_EN.has(s)) return SEM_ACENTO_EN.get(s);
  return null;
}
/** nome em inglês → português (ou o próprio nome se não houver tradução) */
export function nomePortugues(en) {
  const N = en.toUpperCase().replace(/^(_XLFN\.)?(_XLWS\.)?/, "");
  return EN_PT.get(N) || N;
}
/** nome em inglês → como o Excel grava no arquivo */
export function nomeArquivo(en) {
  const N = en.toUpperCase();
  if (COM_XLWS.has(N)) return "_xlfn._xlws." + N;
  if (COM_XLFN.has(N)) return "_xlfn." + N;
  return N;
}

export const ERROS_EN_PT = { "#N/A": "#N/D", "#NAME?": "#NOME?", "#VALUE!": "#VALOR!", "#NUM!": "#NÚM!", "#NULL!": "#NULO!", "#SPILL!": "#DESPEJAR!", "#DIV/0!": "#DIV/0!", "#REF!": "#REF!", "#CALC!": "#CALC!", "#GETTING_DATA": "#OBTENDO_DADOS", "#CYCLE!": "#REF.CIRC!", "#ERROR!": "#ERRO!" };
export const ERROS_PT_EN = Object.fromEntries(Object.entries(ERROS_EN_PT).map(([a, b]) => [b, a]));
/** lista de funções em português para o autocompletar (ordenada) */
export function listaFuncoesPt() {
  return [...new Set([...EN_PT.values()])].filter(n => /^[\p{L}][\p{L}\p{N}.]*$/u.test(n)).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

// descrições curtas das funções mais usadas (dica ao digitar)
export const DICAS = {
  SOMA: "SOMA(núm1; [núm2]; …) — soma os valores", "MÉDIA": "MÉDIA(núm1; [núm2]; …) — média aritmética",
  SE: "SE(teste; valor_se_verdadeiro; [valor_se_falso])", PROCV: "PROCV(valor; tabela; nº_coluna; [procurar_intervalo])",
  PROCH: "PROCH(valor; tabela; nº_linha; [procurar_intervalo])", PROCX: "PROCX(valor; matriz_procura; matriz_retorno; [se_não_encontrado])",
  "CONT.SE": "CONT.SE(intervalo; critério) — conta células que atendem ao critério", "CONT.SES": "CONT.SES(intervalo1; critério1; …)",
  SOMASE: "SOMASE(intervalo; critério; [intervalo_soma])", SOMASES: "SOMASES(intervalo_soma; intervalo1; critério1; …)",
  "CONT.VALORES": "CONT.VALORES(valor1; …) — conta células não vazias", "CONT.NÚM": "CONT.NÚM(valor1; …) — conta números",
  ARRED: "ARRED(número; nº_dígitos) — arredonda", "ARREDONDAR.PARA.CIMA": "ARREDONDAR.PARA.CIMA(número; nº_dígitos)",
  "ARREDONDAR.PARA.BAIXO": "ARREDONDAR.PARA.BAIXO(número; nº_dígitos)", HOJE: "HOJE() — data de hoje", AGORA: "AGORA() — data e hora atuais",
  "MÁXIMO": "MÁXIMO(núm1; …) — maior valor", "MÍNIMO": "MÍNIMO(núm1; …) — menor valor", CONCATENAR: "CONCATENAR(texto1; texto2; …)",
  SEERRO: "SEERRO(valor; valor_se_erro)", "ÍNDICE": "ÍNDICE(matriz; nº_linha; [nº_coluna])", CORRESP: "CORRESP(valor; matriz; [tipo])",
  DATA: "DATA(ano; mês; dia)", TEXTO: "TEXTO(valor; formato)", ESQUERDA: "ESQUERDA(texto; [nº_caract])", DIREITA: "DIREITA(texto; [nº_caract])",
  "EXT.TEXTO": "EXT.TEXTO(texto; início; nº_caract)", "NÚM.CARACT": "NÚM.CARACT(texto)", ARRUMAR: "ARRUMAR(texto) — tira espaços extras",
  E: "E(lógico1; lógico2; …)", OU: "OU(lógico1; lógico2; …)", "DIATRABALHOTOTAL": "DIATRABALHOTOTAL(data_inicial; data_final; [feriados])",
  "DIA.DA.SEMANA": "DIA.DA.SEMANA(data; [tipo])", DATADIF: "DATADIF(data_inicial; data_final; unidade)", "MÉDIASE": "MÉDIASE(intervalo; critério; [intervalo_média])",
  SUBTOTAL: "SUBTOTAL(função; ref1; …)", SOMARPRODUTO: "SOMARPRODUTO(matriz1; [matriz2]; …)", "ANO": "ANO(data)", "MÊS": "MÊS(data)", DIA: "DIA(data)",
};
