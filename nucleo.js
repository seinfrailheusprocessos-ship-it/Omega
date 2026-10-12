"use strict";
/* Omega — núcleo: utilidades, modelo do relatório, banco do artefato (db) e saída para o Claude.
   Banco:
   relatorios/<id> = { json: "<texto do relatório>", rev }        (o Claude escreve)
   decisoes/<id>   = { id, rev, titulo, numero, atualizado, texto, st, foco, conversa, entrada, notasGeral }  (o Omega escreve)
   config/brasao   = { url, w, h }       config/pastas = { "<código>": { nome, readme } }
   pipeline/<lote> = lote do script (o Claude escreve)      revisao/<lote> = aprovações (o Omega escreve)
   extracoes/<id>  = arquivo extraído na Mesa PDF e o destino escolhido (o Omega escreve) */

/* ================= utilidades ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
function h(tag, attrs, ...filhos) {
  const e = document.createElement(tag);
  for (const k in (attrs || {})) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "style") e.setAttribute("style", v);
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
    else if (k === "value") e.value = v;
    else if (k === "checked" || k === "disabled" || k === "readOnly") e[k] = !!v;
    else if (v === true) e.setAttribute(k, "");
    else e.setAttribute(k, v);
  }
  for (const f of filhos.flat(Infinity)) if (f != null && f !== false) e.append(f.nodeType ? f : document.createTextNode(String(f)));
  return e;
}
/* append que ignora null/false (filhos opcionais) */
function ap(el, ...xs) { el.append(...xs.flat(Infinity).filter(x => x != null && x !== false)); return el; }
const ICONES = {
  menu: '<path d="M4 6h16M4 12h16M4 18h10"/>', search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  eye: '<path d="M2 12s3.7-7 10-7 10 7 10 7-3.7 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  focus: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',
  cl: '<path d="m6 9 6 6 6-6"/>', cr: '<path d="m9 6 6 6-6 6"/>', cle: '<path d="m15 6-6 6 6 6"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', send: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
  print: '<path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
  side: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9 4v16"/>',
  home: '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1Z"/>', layers: '<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  spark: '<path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3"/>', pen: '<path d="m4 20 1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19Z"/>',
  scissor: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.5 7.5 20 18M8.5 16.5 20 6"/>',
  play: '<path d="M7 5v14l11-7Z"/>', pause: '<path d="M8 5v14M16 5v14"/>', up: '<path d="m6 15 6-6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>'
};
function ico(n, extra) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true");
  s.innerHTML = ICONES[n] || "";
  if (extra) s.setAttribute("style", extra);
  return s;
}
function dot(c) { return h("i", { class: "dotm " + c }); }
function aviso(msg, acao, rotulo) {
  const box = $("#toasts"); if (!box) return;
  box.querySelectorAll(".toast").forEach(t => t.remove());
  const t = h("div", { class: "toast", role: "status" }, h("span", {}, msg));
  if (acao) t.append(h("button", { type: "button", onclick: () => { acao(); t.remove(); } }, rotulo || "Desfazer"));
  box.append(t);
  setTimeout(() => t.remove(), acao ? 6000 : 3500);
}
/* copiar: chamar dentro do toque/clique; se o aparelho recusar, abre a caixa com o texto selecionado */
async function copiar(texto, msgOk) {
  let ok = false;
  try { await navigator.clipboard.writeText(texto); ok = true; } catch (e) {}
  if (!ok) {
    try {
      const ta = h("textarea", { style: "position:fixed;top:0;left:0;opacity:0", "aria-hidden": "true" });
      ta.value = texto; document.body.append(ta); ta.focus({ preventScroll: true }); ta.select();
      ok = document.execCommand("copy"); ta.remove();
    } catch (e) { ok = false; }
  }
  if (ok) { if (msgOk) aviso(msgOk); } else caixaCopia(texto, "Copie o texto");
  return ok;
}
function caixaCopia(texto, titulo) {
  const pre = h("pre", {}, texto);
  dialogo(titulo || "Texto", [h("p", { class: "sub" }, "O aparelho não deixou copiar sozinho. Selecione o texto abaixo e use Copiar."), pre], [{ rotulo: "Fechar", pri: true }]);
  setTimeout(() => { try { const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) {} }, 30);
}
/* abrir site em nova aba: só <a href target=_blank> funciona de forma confiável dentro do Claude */
function abrirLink(url) {
  const a = h("a", { href: url, target: "_blank", rel: "noopener" }); document.body.append(a); a.click(); a.remove();
}
const pad = n => String(n).padStart(2, "0");
function agora() { const d = new Date(); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function dataCurta(ms) {
  if (!ms) return "";
  const d = new Date(ms), hoje = new Date(); if (isNaN(d)) return "";
  const dia = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dd = Math.round((dia(hoje) - dia(d)) / 864e5);
  if (dd === 0) return `hoje ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (dd === 1) return "ontem";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}
function dataHora(ms) { const d = new Date(ms); return isNaN(d) ? "" : `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function hashTxt(s) { let x = 5381; for (let i = 0; i < s.length; i++) x = ((x << 5) + x + s.charCodeAt(i)) | 0; return String(x); }
const norm = s => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const slug = s => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "documento";
const ehCampo = e => e && (e.isContentEditable || /^(TEXTAREA|SELECT)$/.test(e.tagName) || (e.tagName === "INPUT" && !/^(checkbox|radio|button|submit|range|file)$/i.test(e.type)));
function arr(x) { return x == null ? [] : Array.isArray(x) ? x.map(String) : [String(x)]; }
const clone = o => JSON.parse(JSON.stringify(o));
/* ordem dos códigos numéricos: 1.10 vem depois de 1.9 */
function cmpCodigo(a, b) {
  const A = String(a || "").split("."), B = String(b || "").split(".");
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    if (A[i] == null) return -1; if (B[i] == null) return 1;
    const x = parseFloat(A[i]), y = parseFloat(B[i]);
    if (!isNaN(x) && !isNaN(y) && x !== y) return x - y;
    if (isNaN(x) || isNaN(y)) { const c = A[i].localeCompare(B[i], "pt"); if (c) return c; }
  }
  return 0;
}

/* ================= preferências deste aparelho (só conveniência) ================= */
const PREF = (() => {
  const base = { tema: "maisescuro", lat: true, abertos: {}, atual: null, visto: {}, pastaSel: null, revisar: false, caixinha: false, avancar: false, vel: 3, dic: [], soPend: false };
  try { const x = JSON.parse(localStorage.getItem("omega.pref") || "null"); if (x && typeof x === "object") return Object.assign(base, x); } catch (e) {}
  return base;
})();
PREF.revisar = false;
let tPref = null;
function salvarPref() { clearTimeout(tPref); tPref = setTimeout(() => { try { localStorage.setItem("omega.pref", JSON.stringify(PREF)); } catch (e) {} }, 200); }

/* ================= modelo ================= */
const OPC_ACAO = ["A fazer", "Feito", "Ignorar", "Não consegui"];
const OPC_DEC = ["Aguardando", "Seguir", "Ignorar"];
const OPC_INFO = ["Ciente", "Dúvida"];
const OPC_PAR = ["Pendente", "Aprovado", "Ajustar"];
const OPC_CAP = ["Aprovar capítulo inteiro", "Marcar capítulo para ajustar", "Voltar capítulo a pendente"];
const OPC_ENT = ["Pendente", "Em análise", "Responder", "Respondido", "Arquivar"];
const SIT_DE = { Pendente: "vermelho", Aprovado: "verde", Ajustar: "azul" };
const ROTULO_SIT = { vermelho: "Pendente", verde: "Aprovado", azul: "Ajustar" };
const CICLO = { vermelho: "verde", verde: "azul", azul: "vermelho" };
const CICLO_VOLTA = { vermelho: "azul", azul: "verde", verde: "vermelho" };
const TIPO_ROT = { acao: "ação", decisao: "decisão", info: "info" };

function normalizar(d) {
  if (!d || typeof d !== "object" || !Array.isArray(d.secoes)) throw new Error("O texto não parece um relatório do Omega (faltam as seções).");
  const pa = d.pasta && typeof d.pasta === "object" ? d.pasta : {};
  const r = {
    id: String(d.id || "relatorio"), rev: Number(d.rev ?? d.rodada ?? 1) || 1, titulo: String(d.titulo || "Sem título"),
    atualizado: d.atualizado || "", autor: String(d.autor || ""), numero: d.numero != null ? String(d.numero) : "",
    nome: String(d.nome || pa.rotulo || d.titulo || ""), conversa: String(d.conversa || ""), exemplo: !!d.exemplo,
    pasta: { rotulo: String(pa.rotulo || d.rotulo || ""), caminho: String(pa.caminho || ""), drive: String(pa.drive || "") },
    prazos: Array.isArray(d.prazos) ? d.prazos.filter(p => p && p.data).map(p => ({ titulo: String(p.titulo || "Prazo"), data: String(p.data), tipo: String(p.tipo || "") })) : [],
    readme: String(d.readme || ""), secoes: []
  };
  d.secoes.forEach((s, si) => {
    const num = String(s.num ?? s.id ?? si + 1);
    const sec = { num, titulo: String(s.titulo || ""), tipo: s.tipo === "texto" || s.capitulos ? "texto" : "itens" };
    if (sec.tipo === "texto") {
      sec.doc = s.documento && typeof s.documento === "object" ? s.documento : null;
      sec.capitulos = (s.capitulos || []).map((c, ci) => {
        const cn = String(c.num ?? ci + 1);
        return { num: cn, titulo: String(c.titulo || ""), paragrafos: (c.paragrafos || []).map((p, pi) => ({ id: String(p.id ?? `${cn}.${pi + 1}`), texto: String(p.texto || ""), situacao: ["verde", "azul", "vermelho"].includes(p.situacao) ? p.situacao : "vermelho" })) };
      });
    } else {
      sec.itens = (s.itens || []).map((it, ii) => {
        const opcoes = arr(it.opcoes);
        const o = { num: String(it.num ?? it.id ?? `${num}.${ii + 1}`), tipo: ["acao", "decisao", "info"].includes(it.tipo) ? it.tipo : (opcoes.length ? "decisao" : "acao"),
          titulo: String(it.titulo || ""), texto: String(it.texto || ""), dependeDe: arr(it.dependeDe ?? it.requer), bloqueia: arr(it.bloqueia), caminhos: arr(it.caminhos), opcoes, valor: it.valor ? String(it.valor) : null };
        if (it.tabela && Array.isArray(it.tabela.linhas)) o.tabela = { colunas: (it.tabela.colunas || []).map(c => typeof c === "string" ? { nome: c } : { nome: String(c.nome || ""), alin: c.alinhamento || c.alin }), linhas: it.tabela.linhas };
        return o;
      });
    }
    r.secoes.push(sec);
  });
  return r;
}
/* estado de um relatório: dados (do Claude) + st (decisões, por chave) */
function novaRel(d) { return { id: d.id, dados: d, st: {}, foco: null, conversa: "", entrada: [], notasGeral: [], remotoEm: 0, local: false }; }
function itensDe(rel) { return rel.dados.secoes.flatMap(s => s.itens || []); }
function achar(rel, num) { return itensDe(rel).find(i => i.num === num); }
function secDoItem(rel, num) { return rel.dados.secoes.find(s => (s.itens || []).some(i => i.num === num)); }
function stOf(rel, k) { return rel.st[k] || (rel.st[k] = {}); }
function padrao(it) { return it.tipo === "acao" ? "A fazer" : it.tipo === "decisao" ? "Aguardando" : "Ciente"; }
function valorItem(rel, it) { const s = rel.st["I:" + it.num]; return s && s.v != null ? s.v : (it.valor || padrao(it)); }
function kind(v) {
  if (v == null || v === "A fazer" || v === "Aguardando" || v === "Pendente") return "pend";
  if (v === "Feito" || v === "Seguir" || v === "Aprovado" || v === "Respondido" || v === "Ciente") return "ok";
  if (v === "Ignorar" || v === "Arquivar") return "ign";
  if (v === "Não consegui") return "nao";
  if (v === "Ajustar" || v === "Em análise" || v === "Responder" || v === "Dúvida") return "aj";
  return "esc";
}
const resolvido = k => k === "ok" || k === "ign" || k === "esc";
const acionavel = it => it.tipo === "acao" || it.tipo === "decisao";
function bloqueado(rel, it) { return it.dependeDe.some(n => { const d = achar(rel, n); return d && acionavel(d) && !resolvido(kind(valorItem(rel, d))); }); }
function opcoesDe(it) { return it.tipo === "acao" ? OPC_ACAO : it.tipo === "info" ? OPC_INFO : (it.opcoes.length ? it.opcoes : OPC_DEC); }
/* classe de cor do chip: vermelho = pendente, verde = feito, azul = decidir/ajustar, contorno = escolha ou ignorado */
function corChip(v, tipo) {
  const k = kind(v);
  if (k === "pend") return tipo === "decisao" || v === "Aguardando" ? "cb" : "cr";
  if (k === "nao") return "cr";
  if (k === "ok") return v === "Ciente" ? "cb" : "cg";
  if (k === "aj") return v === "Dúvida" ? "cr" : "cb";
  return "cn";
}
/* cor de contagem de um alvo: vermelho, verde, azul (ou null se não conta) */
function corAlvo(rel, f) {
  if (f.t === "P") { const sec = secDe(rel, f.sec), p = parDe(rel, f); return p ? sitDe(rel, sec, p) : null; }
  const inf = infoAlvo(rel, f); if (!inf) return null;
  const k = kind(inf.valor);
  if (resolvido(k)) return "verde";
  if (k === "nao") return "vermelho";
  if (k === "aj") return "azul";
  return inf.tipo === "decisao" ? "azul" : "vermelho";
}

/* focos: {t:"I",num} | {t:"C",num,r,c} | {t:"P",sec,id} | {t:"K",sec,cap} | {t:"E",id} | {t:"T",num,r,c} (célula editada) */
function chave(f) { return f.t === "I" ? "I:" + f.num : f.t === "C" ? `C:${f.num}:${f.r}:${f.c}` : f.t === "T" ? `T:${f.num}:${f.r}:${f.c}` : f.t === "K" ? `K:${f.sec}:${f.cap}` : f.t === "E" ? `E:${f.id}` : `P:${f.sec}:${f.id}`; }
function celula(it, r, c) { const x = it.tabela && it.tabela.linhas[r] && it.tabela.linhas[r][c]; return x && typeof x === "object" && x.chip ? x.chip : null; }
function secDe(rel, num) { return rel.dados.secoes.find(s => s.num === num); }
function capDe(rel, f) { const s = secDe(rel, f.sec); return s && s.capitulos && s.capitulos.find(c => c.num === f.cap); }
function parDe(rel, f) { const s = secDe(rel, f.sec); return s && s.capitulos && s.capitulos.flatMap(c => c.paragrafos).find(p => p.id === f.id); }
function alvosSecao(rel, sec) {
  const out = [];
  if (sec.tipo === "texto") sec.capitulos.forEach(c => c.paragrafos.forEach(p => out.push({ t: "P", sec: sec.num, id: p.id })));
  else sec.itens.forEach(it => {
    const temCel = it.tabela && it.tabela.linhas.some(ln => ln.some(x => x && typeof x === "object" && x.chip));
    if (acionavel(it) && !temCel) out.push({ t: "I", num: it.num });
    if (it.tabela) it.tabela.linhas.forEach((ln, r) => ln.forEach((cel, c) => { if (cel && typeof cel === "object" && cel.chip) out.push({ t: "C", num: it.num, r, c }); }));
  });
  return out;
}
function alvos(rel) { return rel.dados.secoes.flatMap(s => alvosSecao(rel, s)); }
function infoAlvo(rel, f) {
  if (f.t === "E") {
    const e = (rel.entrada || []).find(x => x.id === f.id); if (!e) return null;
    const s = rel.st[chave(f)];
    return { titulo: `Recebido · ${e.arquivo}`, sub: `Páginas: ${e.paginas || "todas"}`, opcoes: OPC_ENT, valor: (s && s.v) || "Pendente", padrao: "Pendente", bloq: false, custom: false, tipo: "acao" };
  }
  if (f.t === "P") {
    const sec = secDe(rel, f.sec), p = parDe(rel, f); if (!p) return null;
    return { titulo: `${f.id} · parágrafo`, sub: textoDe(rel, sec, p), opcoes: OPC_PAR, valor: ROTULO_SIT[sitDe(rel, sec, p)], padrao: "Pendente", bloq: false, custom: false, tipo: "par" };
  }
  if (f.t === "K") {
    const sec = secDe(rel, f.sec), cap = capDe(rel, f); if (!cap) return null;
    const st = statusCap(rel, sec, cap);
    return { titulo: `${cap.num} · ${cap.titulo}`, sub: "Vale para todos os parágrafos do capítulo", opcoes: OPC_CAP, valor: st.cor === "verde" ? OPC_CAP[0] : st.cor === "azul" ? OPC_CAP[1] : OPC_CAP[2], padrao: OPC_CAP[2], bloq: false, custom: false, tipo: "cap" };
  }
  const it = achar(rel, f.num); if (!it) return null;
  if (f.t === "I") return { titulo: `${it.num} · ${it.titulo}`, sub: it.texto, opcoes: opcoesDe(it), valor: valorItem(rel, it), padrao: padrao(it), bloq: bloqueado(rel, it), custom: it.tipo !== "info", tipo: it.tipo };
  const ch = celula(it, f.r, f.c); if (!ch) return null;
  const col = it.tabela.colunas[f.c] ? it.tabela.colunas[f.c].nome : "";
  const ln = it.tabela.linhas[f.r], base = String(ln[0] != null && typeof ln[0] !== "object" ? ln[0] : "");
  const desc = ln.find((x, j) => j > 0 && typeof x === "string" && x.length > 3) || "";
  const s = rel.st[chave(f)];
  const opcoes = arr(ch.opcoes).length ? arr(ch.opcoes) : (ch.tipo === "decisao" ? OPC_DEC : OPC_ACAO);
  return { titulo: `${it.num} · ${base}${desc ? " · " + desc : ""}`, sub: col, opcoes, valor: s && s.v != null ? s.v : (ch.valor || opcoes[0]), padrao: ch.valor || opcoes[0], bloq: false, custom: true, tipo: ch.tipo === "decisao" ? "decisao" : "acao" };
}
function parSt(rel, sec, p) { return rel.st[`P:${sec.num}:${p.id}`]; }
/* edição do parágrafo só vale enquanto o Claude não reescrever o mesmo parágrafo (leva nova) */
function edicaoValida(s, p) { return s && s.alterado && s.texto != null && (s.base == null || s.base === p.texto); }
function sitDe(rel, sec, p) { const s = parSt(rel, sec, p); if (s && s.alterado && !edicaoValida(s, p)) return p.situacao; return (s && s.sit) || p.situacao; }
function textoDe(rel, sec, p) { const s = parSt(rel, sec, p); return edicaoValida(s, p) ? s.texto : p.texto; }
function statusCap(rel, sec, cap) {
  const sits = cap.paragrafos.map(p => sitDe(rel, sec, p));
  const verdes = sits.filter(s => s === "verde").length;
  return { cor: sits.includes("azul") ? "azul" : (sits.length && verdes === sits.length ? "verde" : "vermelho"), verdes, total: sits.length };
}
function contar(rel, sec) {
  const c = { vermelho: 0, verde: 0, azul: 0, total: 0 };
  (sec ? alvosSecao(rel, sec) : alvos(rel)).forEach(f => { const cor = corAlvo(rel, f); if (cor) { c[cor]++; c.total++; } });
  return c;
}
function corRel(rel) { const c = contar(rel); return c.vermelho ? "r" : c.azul ? "b" : "g"; }
/* registra uma mudança: data e leva (rev) ficam na própria chave, para mesclar entre aparelhos */
function tocar(rel, k) { const s = stOf(rel, k); s.t = Date.now(); s.rev = rel.dados.rev; s.tocado = true; Banco.marcar(rel, k); return s; }
function aplicarValor(rel, f, valor, obs, custom) {
  const k = chave(f), s = stOf(rel, k);
  if (f.t === "P") { s.sit = SIT_DE[valor] || valor || "vermelho"; s.viaCap = false; }
  else if (f.t === "K") {
    const sec = secDe(rel, f.sec), cap = capDe(rel, f), sit = valor === OPC_CAP[0] ? "verde" : valor === OPC_CAP[1] ? "azul" : "vermelho";
    cap.paragrafos.forEach(p => { const pk = `P:${sec.num}:${p.id}`, ps = stOf(rel, pk); ps.sit = sit; ps.viaCap = true; tocar(rel, pk); });
    s.v = valor;
  } else { s.v = valor; s.outro = !!custom; }
  if (obs != null) s.obs = obs;
  tocar(rel, k);
}

/* ================= estado geral ================= */
const REL = {};            // id -> estado do relatório
const DEC = {};            // id -> último documento de decisões lido do banco
const CFG = { pastas: null, brasao: null };
const PIPE = {};           // lote -> dados do pipeline
const REVISAO = {};        // lote -> aprovações
let ouvintes = [];         // funções chamadas quando algo muda no banco
function aoMudar(fn) { ouvintes.push(fn); }
function avisarMudanca(o) { ouvintes.forEach(fn => { try { fn(o || {}); } catch (e) { console.error(e); } }); }
const PASTAS_PADRAO = {
  "1": { nome: "Licitações" }, "2": { nome: "Aditivos" }, "3": { nome: "Jurídico" },
  "3.1": { nome: "MP E JUSTIÇA", readme: "Processos com o Ministério Público e o Judiciário. Cada relatório tem código 3.1.n. Respostas seguem o padrão oficial (Arial 12)." },
  "3.2": { nome: "Pareceres" }, "4": { nome: "Contratos" }, "5": { nome: "Pessoal" }
};
function pastas() { return Object.assign({}, PASTAS_PADRAO, CFG.pastas || {}); }
function codigoRel(rel) { return rel.dados.numero || ""; }
function nomeCurto(rel) { return rel.dados.nome || rel.dados.pasta.rotulo || rel.dados.titulo; }
function nomeRel(rel) { return `${codigoRel(rel)} ${nomeCurto(rel)}`.trim(); }
function pastaPai(cod) { const i = String(cod).lastIndexOf("."); return i > 0 ? cod.slice(0, i) : ""; }
function nomePasta(cod) { const p = pastas()[cod]; if (p && p.nome) return p.nome; const r = Object.values(REL).find(x => codigoRel(x) === cod); return r ? nomeCurto(r) : cod; }
function ultimaAtividade(rel) { return Math.max(rel.remotoEm || 0, PREF.visto[rel.id] || 0, Date.parse(rel.dados.atualizado) || 0); }

/* ================= banco (db do artefato) ================= */
const Banco = (() => {
  let db = null, estado = "conectando";
  const sujos = {}, timers = {}, filas = {}, existe = {}, extra = {};
  const LIM = 230 * 1024;
  const campos = ["v", "obs", "outro", "sit", "texto", "base", "alterado", "notas", "t", "rev", "viaCap", "tocado"];
  const paraBanco = s => { const o = {}; campos.forEach(k => { o[k] = s && s[k] !== undefined ? s[k] : null; }); return o; };
  const doBanco = s => { const o = {}; for (const k in (s || {})) if (s[k] !== null && s[k] !== undefined) o[k] = s[k]; return o; };
  function cache(chaveC, valor) { try { const c = JSON.parse(localStorage.getItem("omega.cache") || "{}"); c[chaveC] = valor; localStorage.setItem("omega.cache", JSON.stringify(c)); } catch (e) {} }
  function lerCache() { try { return JSON.parse(localStorage.getItem("omega.cache") || "{}"); } catch (e) { return {}; } }

  /* mescla o que veio do banco no estado local: por chave, vence a mudança mais recente */
  function mesclar(rel, d) {
    if (!d) return;
    const pend = sujos[rel.id] || new Set();
    const st = d.st || {};
    for (const k in st) {
      if (pend.has(k)) continue;
      const remoto = doBanco(st[k]), local = rel.st[k];
      if (!local || (remoto.t || 0) >= (local.t || 0)) rel.st[k] = remoto;
    }
    if (!extra[rel.id] || !extra[rel.id].conversa) { if (typeof d.conversa === "string" && d.conversa) rel.conversa = d.conversa; }
    if (!extra[rel.id] || !extra[rel.id].entrada) { if (Array.isArray(d.entrada)) rel.entrada = d.entrada; }
    if (!extra[rel.id] || !extra[rel.id].notasGeral) { if (Array.isArray(d.notasGeral)) rel.notasGeral = d.notasGeral; }
    if (!rel.foco && d.foco && typeof d.foco === "object") rel.foco = d.foco;
    rel.remotoEm = Math.max(rel.remotoEm || 0, Date.parse(d.atualizado) || 0);
  }
  function receberRelatorio(id, v) {
    if (!v || !v.json) return false;
    let bruto; try { bruto = JSON.parse(v.json); } catch (e) { return false; }
    let d; try { d = normalizar(bruto); } catch (e) { return false; }
    const rid = d.id || id; d.id = rid;
    const ja = REL[rid];
    if (ja && ja.dados.rev > d.rev) return false;
    if (ja && ja.dados.rev === d.rev && JSON.stringify(ja.dados) === JSON.stringify(d)) return false;
    if (ja) { const novaLeva = d.rev > ja.dados.rev; ja.dados = d; if (novaLeva) ja.novaLeva = true; }
    else { REL[rid] = novaRel(d); if (DEC[rid]) mesclar(REL[rid], DEC[rid]); }
    return true;
  }
  function snapRel(sn) {
    const vistos = new Set(); let mexeu = false; const guardar = {};
    sn.docs.forEach(s => { const v = s.data(); if (!v) return; guardar[s.id] = { json: v.json, rev: v.rev }; let id = s.id; try { id = JSON.parse(v.json).id || s.id; } catch (e) {} vistos.add(String(id)); if (receberRelatorio(s.id, v)) mexeu = true; });
    for (const id in REL) if (!REL[id].local && !vistos.has(id)) { delete REL[id]; mexeu = true; }
    cache("relatorios", guardar);
    if (mexeu) avisarMudanca({ tipo: "relatorios" });
  }
  function snapDec(sn) {
    let mexeu = false; const guardar = {};
    sn.docs.forEach(s => {
      const v = s.data(); if (!v) return;
      guardar[s.id] = v; existe[s.id] = true;
      if (DEC[s.id] === v) return;
      DEC[s.id] = v;
      if (REL[s.id]) { mesclar(REL[s.id], v); mexeu = true; }
    });
    cache("decisoes", guardar);
    if (mexeu) avisarMudanca({ tipo: "decisoes" });
  }
  function snapCfg(sn) {
    sn.docs.forEach(s => {
      const v = s.data(); if (!v) return;
      if (s.id === "pastas") CFG.pastas = v;
      if (s.id === "brasao" && v.url) CFG.brasao = v;
    });
    avisarMudanca({ tipo: "config" });
  }
  function snapPipe(sn) {
    for (const k in PIPE) delete PIPE[k];
    sn.docs.forEach(s => { let v = s.data(); if (!v) return; if (typeof v.json === "string") { try { v = JSON.parse(v.json); } catch (e) { return; } } PIPE[s.id] = v; });
    avisarMudanca({ tipo: "pipeline" });
  }
  function snapRev(sn) { sn.docs.forEach(s => { const v = s.data(); if (v) REVISAO[s.id] = clone(v); }); avisarMudanca({ tipo: "revisao" }); }
  const erroSub = nome => e => { console.warn("Omega: assinatura", nome, e && e.code); if (e && (e.code === "unavailable")) setTimeout(() => assinar(nome), 3000); };
  const assinaturas = {};
  function assinar(nome) {
    const fn = { relatorios: snapRel, decisoes: snapDec, config: snapCfg, pipeline: snapPipe, revisao: snapRev }[nome];
    try { assinaturas[nome] = db.collection(nome).onSnapshot(fn, erroSub(nome)); } catch (e) { console.warn(e); }
  }
  async function conectar() {
    const c = lerCache();
    if (c.relatorios) for (const id in c.relatorios) receberRelatorio(id, c.relatorios[id]);
    if (c.decisoes) for (const id in c.decisoes) { DEC[id] = c.decisoes[id]; if (REL[id]) mesclar(REL[id], c.decisoes[id]); }
    carregarLocais();
    avisarMudanca({ tipo: "cache" });
    try { db = window.claude && typeof window.claude.use === "function" ? await window.claude.use("db") : null; } catch (e) { db = null; }
    if (!db) {
      estado = "local";
      try { const x = JSON.parse(localStorage.getItem("omega.sembanco") || "{}"); for (const id in x) if (REL[id]) { Object.assign(REL[id].st, x[id].st || {}); if (x[id].conversa) REL[id].conversa = x[id].conversa; } } catch (e) {}
      avisarMudanca({ tipo: "estado" }); return;
    }
    estado = "ok"; avisarMudanca({ tipo: "estado" });
    ["relatorios", "decisoes", "config", "pipeline", "revisao"].forEach(assinar);
    for (const id in sujos) if (sujos[id].size || (extra[id] && Object.keys(extra[id]).length)) { clearTimeout(timers[id]); timers[id] = setTimeout(() => escrever(id), 1500); }
  }
  /* relatórios abertos só neste aparelho (exemplo ou colado) e o estado deles */
  function carregarLocais() {
    try {
      const x = JSON.parse(localStorage.getItem("omega.locais") || "{}");
      for (const id in x) { if (REL[id]) continue; try { const r = novaRel(normalizar(x[id].dados)); r.local = true; r.st = x[id].st || {}; r.conversa = x[id].conversa || ""; REL[id] = r; } catch (e) {} }
    } catch (e) {}
  }
  function salvarLocais() {
    try { const x = {}; for (const id in REL) if (REL[id].local) x[id] = { dados: REL[id].dados, st: REL[id].st, conversa: REL[id].conversa }; localStorage.setItem("omega.locais", JSON.stringify(x)); } catch (e) {}
  }
  function marcar(rel, k, oque) {
    if (!rel) return;
    if (oque) (extra[rel.id] = extra[rel.id] || {})[oque] = true;
    if (k) (sujos[rel.id] = sujos[rel.id] || new Set()).add(k);
    else { sujos[rel.id] = sujos[rel.id] || new Set(); (extra[rel.id] = extra[rel.id] || {}).foco = true; }
    if (rel.local) { salvarLocais(); return; }
    if (estado === "local") { salvarSemBanco(rel); return; }
    if (estado !== "ok") return; /* conectando: grava assim que o banco responder */
    clearTimeout(timers[rel.id]);
    timers[rel.id] = setTimeout(() => escrever(rel.id), 1200);
  }
  function salvarSemBanco(rel) { try { const x = JSON.parse(localStorage.getItem("omega.sembanco") || "{}"); x[rel.id] = { st: rel.st, conversa: rel.conversa }; localStorage.setItem("omega.sembanco", JSON.stringify(x)); } catch (e) {} }
  function docInteiro(rel) {
    const st = {}; for (const k in rel.st) st[k] = paraBanco(rel.st[k]);
    return { id: rel.id, rev: rel.dados.rev, titulo: rel.dados.titulo, numero: rel.dados.numero, atualizado: new Date().toISOString(),
      texto: textoSaida(rel), st, foco: rel.foco || null, conversa: rel.conversa || "", entrada: rel.entrada || [], notasGeral: rel.notasGeral || [] };
  }
  function textoSaida(rel) { let t = ""; try { t = montarSaida(rel, false); } catch (e) { console.error(e); } return t.length > 120000 ? t.slice(0, 120000) : t; }
  function escrever(id) {
    clearTimeout(timers[id]);
    filas[id] = (filas[id] || Promise.resolve()).then(() => escreverJa(id)).catch(e => console.warn("Omega: gravação", e));
    return filas[id];
  }
  async function escreverJa(id) {
    const rel = REL[id]; if (!rel || !db || rel.local) return;
    const chaves = Array.from(sujos[id] || []); const ex = extra[id] || {};
    sujos[id] = new Set(); extra[id] = {};
    const ref = db.doc("decisoes/" + id);
    const devolver = () => { chaves.forEach(k => (sujos[id] = sujos[id] || new Set()).add(k)); extra[id] = Object.assign(extra[id] || {}, ex); };
    try {
      if (!existe[id]) {
        const g = await ref.get();
        if (g.exists) { existe[id] = true; const v = g.data(); DEC[id] = v; const minhas = new Set(chaves); const antes = {}; minhas.forEach(k => { antes[k] = rel.st[k]; }); mesclar(rel, v); minhas.forEach(k => { if (antes[k]) rel.st[k] = antes[k]; }); }
      }
      if (!existe[id]) {
        let d = docInteiro(rel); if (JSON.stringify(d).length > LIM) d.texto = d.texto.slice(0, 20000);
        await ref.set(d); existe[id] = true;
      } else {
        const p = { id, rev: rel.dados.rev, titulo: rel.dados.titulo, numero: rel.dados.numero, atualizado: new Date().toISOString(), texto: textoSaida(rel), foco: rel.foco || null, st: {} };
        chaves.forEach(k => { if (rel.st[k]) p.st[k] = paraBanco(rel.st[k]); });
        if (ex.conversa) p.conversa = rel.conversa || "";
        if (ex.entrada) p.entrada = rel.entrada || [];
        if (ex.notasGeral) p.notasGeral = rel.notasGeral || [];
        if (JSON.stringify(p).length > LIM) p.texto = p.texto.slice(0, 20000);
        try { await ref.update(p); }
        catch (e) { if (e && e.code === "invalid_argument") { existe[id] = false; await ref.set(docInteiro(rel)); existe[id] = true; } else throw e; }
      }
      rel.remotoEm = Date.now(); rel.gravadoEm = Date.now();
      avisarMudanca({ tipo: "gravado", id });
    } catch (e) {
      devolver();
      if (e && e.code === "unavailable") { setTimeout(() => escrever(id), 1500 + Math.random() * 1500); }
      else if (e && e.code === "quota_exceeded") aviso("O banco do Omega está cheio. Peça ao Claude para limpar relatórios antigos.");
      else if (e && (e.code === "revoked" || e.code === "not_granted")) { estado = "local"; avisarMudanca({ tipo: "estado" }); aviso("Sem acesso ao banco agora: as decisões ficam só neste aparelho."); }
      else console.warn("Omega: não gravou", e);
    }
  }
  async function gravarAgora(id) { if (!REL[id] || REL[id].local || estado !== "ok") return; if ((sujos[id] && sujos[id].size) || (extra[id] && Object.keys(extra[id]).length) || !existe[id]) await escrever(id); else await filas[id]; }
  /* outros documentos (config, revisao, extracoes): uma gravação por vez em cada documento */
  const filaDoc = {};
  function gravarDoc(caminho, dados, merge) {
    if (!db) return Promise.resolve(false);
    const vez = (filaDoc[caminho] || Promise.resolve()).then(async () => {
      try { const ref = db.doc(caminho); if (merge) { try { await ref.update(dados); } catch (e) { if (e && e.code === "invalid_argument") await ref.set(dados); else throw e; } } else await ref.set(dados); return true; }
      catch (e) { console.warn("Omega: não gravou", caminho, e); return false; }
    });
    filaDoc[caminho] = vez;
    return vez;
  }
  return { conectar, marcar, gravarAgora, gravarDoc, salvarLocais, mesclar, get estado() { return estado; }, get db() { return db; }, pendente: id => !!(sujos[id] && sujos[id].size) };
})();

/* ================= saída para o Claude (só decisões e comentários) ================= */
function aspas(t) { return `"${String(t).replace(/\s+/g, " ").trim()}"`; }
function tocouNaLeva(rel, s) { return s && ((s.rev != null ? s.rev === rel.dados.rev : s.tocado) || s.obs || (s.notas && s.notas.length)); }
function linhaItem(rel, it, f) {
  const k = chave(f), s = rel.st[k] || {}, inf = infoAlvo(rel, f), v = inf.valor, kd = kind(v);
  const prefixo = f.t === "I" ? it.num : `${it.num} (linha ${f.r + 1}, ${(it.tabela.colunas[f.c] || {}).nome || "coluna " + (f.c + 1)})`;
  const temNotas = s.notas && s.notas.length;
  if (kd === "pend" && !s.obs && !temNotas) return null;
  if (it.tipo === "info" && f.t === "I" && v === "Ciente" && !s.obs && !temNotas) return null;
  let tag, extraTxt = "";
  if (s.outro) { tag = "[Escolheu]"; extraTxt = ` outro: ${aspas(v)}`; }
  else if (f.t === "I" && it.tipo === "decisao" && it.opcoes.length && it.opcoes.includes(v) && v !== "Ignorar") { tag = "[Escolheu]"; extraTxt = ` opção ${String.fromCharCode(65 + it.opcoes.indexOf(v))}: ${aspas(v.toLowerCase())}`; }
  else tag = `[${v}]`;
  let l = `${prefixo} ${tag}${extraTxt}`, usada = null;
  if (s.obs) l += ` — comentário: ${s.obs}`;
  else if (kd === "nao" && temNotas) { usada = s.notas[s.notas.length - 1]; l += ` — nota: ${usada}`; }
  return { l, usada };
}
function montarSaida(rel, soFoco) {
  const d = rel.dados, blocos = [], notas = [], foco = rel.foco ? chave(rel.foco) : null;
  const tocou = s => tocouNaLeva(rel, s);
  d.secoes.forEach(sec => {
    if (sec.tipo === "texto") {
      sec.capitulos.forEach(cap => {
        const ls = [], kk = `K:${sec.num}:${cap.num}`, ks = rel.st[kk];
        if (ks && tocou(ks) && (!soFoco || foco === kk)) ls.push(`Todo o capítulo [${ks.v === OPC_CAP[0] ? "Aprovado" : ks.v === OPC_CAP[1] ? "Ajustar" : "Pendente"}]` + (ks.obs ? ` — comentário: ${ks.obs}` : ""));
        cap.paragrafos.forEach(p => {
          const k = `P:${sec.num}:${p.id}`, s = rel.st[k]; if (!tocou(s)) return;
          if (soFoco && k !== foco) return;
          if (s.viaCap && !s.obs && !edicaoValida(s, p) && !(s.notas && s.notas.length)) return;
          const sit = sitDe(rel, sec, p); let l = `${p.id} [${ROTULO_SIT[sit]}]`;
          if (edicaoValida(s, p)) l += ` texto alterado: ${aspas(textoDe(rel, sec, p))}`;
          if (s.obs) l += ` — comentário: ${s.obs}`;
          ls.push(l);
          (s.notas || []).forEach(n => notas.push(`(item ${p.id}) ${aspas(n)}`));
        });
        if (ls.length) blocos.push(`## Texto: ${sec.titulo}, capítulo ${cap.num}\n\n${ls.join("\n\n")}`);
      });
    } else {
      const ls = [];
      sec.itens.forEach(it => {
        const fs = [];
        if (acionavel(it) || it.tipo === "info") fs.push({ t: "I", num: it.num });
        if (it.tabela) it.tabela.linhas.forEach((ln, r) => ln.forEach((cel, c) => {
          if (cel && typeof cel === "object" && cel.chip) fs.push({ t: "C", num: it.num, r, c });
          const tk = `T:${it.num}:${r}:${c}`, ts = rel.st[tk];
          if (ts && ts.texto != null && tocou(ts) && (!soFoco || foco === tk || foco === "I:" + it.num)) ls.push(`${it.num} (linha ${r + 1}, ${(it.tabela.colunas[c] || {}).nome || "coluna " + (c + 1)}) valor alterado: ${aspas(ts.texto)}`);
        }));
        fs.forEach(f => {
          const k = chave(f), s = rel.st[k]; if (!tocou(s)) return;
          if (soFoco && k !== foco) return;
          const r = linhaItem(rel, it, f); if (!r) return;
          ls.push(r.l);
          (s.notas || []).forEach(n => { if (n !== r.usada) notas.push(`(item ${it.num}) ${aspas(n)}`); });
        });
      });
      if (ls.length) blocos.push(`## ${sec.num} ${sec.titulo}\n\n${ls.join("\n\n")}`);
    }
  });
  if (!soFoco && (rel.entrada || []).length) {
    const ls = [];
    rel.entrada.forEach(e => {
      const f = { t: "E", id: e.id }, s = rel.st[chave(f)]; if (!tocou(s)) return;
      ls.push(`${e.id} ${aspas(e.arquivo)} p. ${e.paginas || "todas"} [${(s && s.v) || "Pendente"}]` + (e.destino ? ` — destino: ${e.destino}` : "") + (s && s.obs ? ` — comentário: ${s.obs}` : ""));
    });
    if (ls.length) blocos.push(`## Recebidos\n\n${ls.join("\n\n")}`);
  }
  if (!soFoco) (rel.notasGeral || []).forEach(n => notas.push(`(geral) ${aspas(n)}`));
  let t = `[OMEGA] ${nomeRel(rel)} · relatório ${d.id} rev ${d.rev} | ${agora()}\n\n`;
  t += blocos.length ? blocos.join("\n\n") + "\n" : "Nada decidido ou alterado desde a última leva.\n";
  if (notas.length) t += `\nNotas de voz:\n\n${notas.map(n => "- " + n).join("\n")}\n`;
  return t;
}
function textoCapitulo(rel, sec, c) { return `${c.num} ${c.titulo}\n\n` + c.paragrafos.map(p => textoDe(rel, sec, p)).join("\n\n"); }
function textoSecao(rel, sec) { return `${sec.titulo}\n\n` + sec.capitulos.map(c => textoCapitulo(rel, sec, c)).join("\n\n"); }
function textoRelatorio(rel) {
  const d = rel.dados; let t = `${d.titulo}\n[${d.numero ? d.numero + " · " : ""}${d.id} rev ${d.rev}]\n`;
  d.secoes.forEach(s => {
    t += `\n${s.num} ${s.titulo}\n\n`;
    if (s.tipo === "texto") t += s.capitulos.map(c => textoCapitulo(rel, s, c)).join("\n\n") + "\n";
    else s.itens.forEach(it => {
      const v = acionavel(it) ? valorItem(rel, it) : null, st = rel.st["I:" + it.num] || {};
      t += `${it.num} ${it.titulo}${v ? ` [${v}]` : ""}${it.texto ? "\n" + it.texto : ""}\n`;
      if (it.dependeDe.length) t += `Depende de: ${it.dependeDe.join(", ")}\n`;
      it.caminhos.forEach(c => { t += `Caminho: ${c}\n`; });
      if (st.obs) t += `Comentário: ${st.obs}\n`;
      t += "\n";
    });
  });
  return t;
}
function contarPendencias(rel) { const c = contar(rel); return c.vermelho + c.azul; }
const URLS = { claude: "https://claude.ai/new", gemini: "https://gemini.google.com/app" };
const PERGUNTA = "Revise apenas o português (ortografia, acentuação, concordância e pontuação) do texto abaixo. Não mude o sentido nem o vocabulário jurídico. Devolva o texto corrigido e, depois, uma lista curta das alterações.";
function msgEnvio(rel) { return `Leia o relatório de retorno do Omega do objeto ${nomeRel(rel)} (rev ${rel.dados.rev}).`; }
function fraseContinuacao(rel) { const cam = rel.dados.pasta.caminho; return `Omega: ler o relatório de ${nomeRel(rel)}${cam ? ` na pasta ${cam}` : ""} e resolver as pendências.`; }
function linkGmail(para, assunto, corpo) { return "https://mail.google.com/mail/?view=cm&fs=1" + (para ? "&to=" + encodeURIComponent(para) : "") + "&su=" + encodeURIComponent(assunto || "") + "&body=" + encodeURIComponent(corpo || ""); }
