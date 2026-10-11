"use strict";
/* ================= utilidades ================= */
const $ = (s, r = document) => r.querySelector(s);
function h(tag, attrs, ...filhos) {
  const e = document.createElement(tag);
  for (const k in (attrs || {})) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "value") e.value = v;
    else if (v === true) e.setAttribute(k, "");
    else e.setAttribute(k, v);
  }
  for (const f of filhos.flat()) if (f != null && f !== false) e.append(f.nodeType ? f : document.createTextNode(String(f)));
  return e;
}
function aviso(msg, acao, rotulo) {
  document.querySelectorAll(".toast").forEach(t => t.remove());
  const t = h("div", { class: "toast" }, msg);
  if (acao) t.append(h("button", { onclick: () => { acao(); t.remove(); } }, rotulo || "Desfazer"));
  document.body.append(t);
  setTimeout(() => t.remove(), acao ? 7000 : 3500);
}
async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); return true; } catch (e) {}
  try {
    const ta = h("textarea", { style: "position:fixed;top:0;left:0;opacity:0" });
    ta.value = texto; document.body.append(ta); ta.focus(); ta.select();
    const ok = document.execCommand("copy"); ta.remove(); return ok;
  } catch (e) { return false; }
}
function caixaCopia(texto, titulo) {
  const pre = h("pre", { class: "copia" }, texto);
  const fundo = h("div", { style: "position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:14px" },
    h("div", { class: "cartao", style: "max-width:640px;width:100%;max-height:85vh;overflow:auto;background:var(--bg)" },
      h("b", {}, titulo || "Copie à mão"),
      h("p", { class: "suave" }, "O navegador não deixou copiar sozinho. O texto abaixo já está selecionado: use Copiar do seu aparelho."),
      pre, h("div", { class: "linha" }, h("button", { class: "btn", onclick: () => fundo.remove() }, "Fechar"))));
  document.body.append(fundo);
  const r = document.createRange(); r.selectNodeContents(pre);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}
const pad = n => String(n).padStart(2, "0");
function agora() { const d = new Date(); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function hashTxt(s) { let x = 5381; for (let i = 0; i < s.length; i++) x = ((x << 5) + x + s.charCodeAt(i)) | 0; return String(x); }
const eh = e => e && (e.isContentEditable || /^(TEXTAREA|INPUT|SELECT)$/.test(e.tagName));

/* ================= armazenamento ================= */
const CHAVE = "omega.v2";
let DB = { rels: {}, atual: null, dic: [], salvoEm: 0, ui: { tema: "claro", lateral: true, avancar: true, audioSempre: false, revisar: true } };
function carregarLocal() {
  try {
    const x = JSON.parse(localStorage.getItem(CHAVE));
    if (x && x.rels) { DB = Object.assign(DB, x); DB.ui = Object.assign({ tema: "claro", lateral: true, avancar: true, audioSempre: false, revisar: true }, x.ui); }
  } catch (e) {}
}
carregarLocal();
let tEnvio, servidorOk = null;
function salvar() {
  DB.salvoEm = Date.now();
  try { localStorage.setItem(CHAVE, JSON.stringify(DB)); } catch (e) { aviso("Não consegui salvar neste navegador."); }
  clearTimeout(tEnvio); tEnvio = setTimeout(enviarEstado, 900);
}
async function enviarEstado() {
  if (servidorOk === false || !/^https?:$/.test(location.protocol)) return;
  try {
    const r = await fetch("dados/estado.json", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(DB) });
    servidorOk = r.ok;
  } catch (e) { servidorOk = false; }
}
async function lerEstadoServidor() {
  if (!/^https?:$/.test(location.protocol)) return;
  try {
    const r = await fetch("dados/estado.json", { cache: "no-store" });
    if (!r.ok) { servidorOk = servidorOk === true ? true : (r.status === 404 ? null : false); return; }
    const x = await r.json(); servidorOk = true;
    if (x && x.rels && (x.salvoEm || 0) > (DB.salvoEm || 0)) { DB = Object.assign(DB, x); salvarSemEnviar(); montar(); }
  } catch (e) {}
}
function salvarSemEnviar() { try { localStorage.setItem(CHAVE, JSON.stringify(DB)); } catch (e) {} }

/* ================= modelo ================= */
const PEND = ["A fazer", "Aguardando"];
const OPC_ACAO = ["A fazer", "Feito", "Ignorar", "Não consegui"];
const OPC_DEC = ["Aguardando", "Seguir", "Ignorar"];
function arr(x) { return x == null ? [] : Array.isArray(x) ? x.map(String) : [String(x)]; }
function normalizar(d) {
  if (!d || typeof d !== "object" || !Array.isArray(d.secoes)) throw new Error("O arquivo não parece um relatório do Ômega (faltam as seções).");
  const r = { id: String(d.id || "relatorio"), rev: Number(d.rev ?? d.rodada ?? 1) || 1, titulo: String(d.titulo || "Sem título"), atualizado: d.atualizado || "", secoes: [] };
  d.secoes.forEach((s, si) => {
    const num = String(s.num ?? s.id ?? si + 1);
    const sec = { num, titulo: String(s.titulo || ""), tipo: s.tipo === "texto" || s.capitulos ? "texto" : "itens" };
    if (sec.tipo === "texto") {
      sec.capitulos = (s.capitulos || []).map((c, ci) => {
        const cn = String(c.num ?? ci + 1);
        return { num: cn, titulo: String(c.titulo || ""), paragrafos: (c.paragrafos || []).map((p, pi) => ({ id: String(p.id ?? `${cn}.${pi + 1}`), texto: String(p.texto || ""), situacao: ["verde", "azul", "vermelho"].includes(p.situacao) ? p.situacao : "vermelho" })) };
      });
    } else {
      sec.itens = (s.itens || []).map((it, ii) => {
        const opcoes = arr(it.opcoes);
        const o = { num: String(it.num ?? it.id ?? `${num}.${ii + 1}`), tipo: it.tipo || (opcoes.length ? "decisao" : "acao"), titulo: String(it.titulo || ""), texto: String(it.texto || ""), dependeDe: arr(it.dependeDe ?? it.requer), bloqueia: arr(it.bloqueia), caminhos: arr(it.caminhos), opcoes, valor: it.valor ? String(it.valor) : null };
        if (it.tabela && Array.isArray(it.tabela.linhas)) {
          o.tabela = { colunas: (it.tabela.colunas || []).map(c => typeof c === "string" ? { nome: c } : { nome: String(c.nome || ""), alin: c.alinhamento || c.alin }), linhas: it.tabela.linhas };
        }
        return o;
      });
    }
    r.secoes.push(sec);
  });
  return r;
}
function novaRel(d) { return { dados: d, st: {}, alin: {}, larg: {}, rec: { __feito: true }, foco: null, notasGeral: [], atualizado: Date.now() }; }
function carregarRelatorio(bruto, opts) {
  opts = opts || {};
  const d = normalizar(bruto), ja = DB.rels[d.id];
  if (!ja) { DB.rels[d.id] = novaRel(d); DB.atual = d.id; vista = "rel"; aviso("Relatório carregado."); }
  else {
    const nova = d.rev > ja.dados.rev;
    if (nova) for (const k in ja.st) ja.st[k].tocado = false;
    d.secoes.forEach(s => (s.capitulos || []).forEach(c => c.paragrafos.forEach(p => {
      const e = ja.st[`P:${s.num}:${p.id}`];
      if (e && e.alterado && e.base !== p.texto) { delete e.texto; delete e.alterado; delete e.base; delete e.sit; }
    })));
    ja.dados = d; ja.atualizado = Date.now();
    if (!opts.auto || DB.atual === d.id || !DB.atual) { DB.atual = d.id; vista = "rel"; }
    aviso(nova ? `Novo relatório carregado (rev ${d.rev}). Suas escolhas foram mantidas.` : "Relatório atualizado.");
  }
  salvar(); montar();
}
function itensDe(rel) { return rel.dados.secoes.flatMap(s => s.itens || []); }
function achar(rel, num) { return itensDe(rel).find(i => i.num === num); }
function stOf(rel, k) { return rel.st[k] || (rel.st[k] = {}); }
function padrao(it) { return it.tipo === "acao" ? "A fazer" : it.tipo === "decisao" ? "Aguardando" : null; }
function valorItem(rel, it) { const s = rel.st["I:" + it.num]; return s && s.v != null ? s.v : (it.valor || padrao(it)); }
function kind(v) {
  if (v == null || PEND.includes(v)) return "pend";
  if (v === "Feito" || v === "Seguir") return "ok";
  if (v === "Ignorar") return "ign";
  if (v === "Não consegui") return "nao";
  return "ok";
}
const resolvido = k => k === "ok" || k === "ign";
const acionavel = it => it.tipo === "acao" || it.tipo === "decisao";
function bloqueado(rel, it) {
  return it.dependeDe.some(n => { const d = achar(rel, n); return d && acionavel(d) && !resolvido(kind(valorItem(rel, d))); });
}
function opcoesDe(it) { return it.tipo === "acao" ? OPC_ACAO : (it.opcoes.length ? it.opcoes : OPC_DEC); }

/* focos: {t:"I",num} | {t:"C",num,r,c} | {t:"P",sec,id} */
function chave(f) { return f.t === "I" ? "I:" + f.num : f.t === "C" ? `C:${f.num}:${f.r}:${f.c}` : `P:${f.sec}:${f.id}`; }
function celula(it, r, c) { const x = it.tabela && it.tabela.linhas[r] && it.tabela.linhas[r][c]; return x && x.chip ? x.chip : null; }
function alvos(rel) {
  const out = [];
  itensDe(rel).forEach(it => {
    if (acionavel(it)) out.push({ t: "I", num: it.num });
    if (it.tabela) it.tabela.linhas.forEach((ln, r) => ln.forEach((cel, c) => { if (cel && typeof cel === "object" && cel.chip) out.push({ t: "C", num: it.num, r, c }); }));
  });
  return out;
}
function infoAlvo(rel, f) {
  const it = achar(rel, f.num); if (!it) return null;
  if (f.t === "I") return { titulo: `${it.num} · ${it.titulo}`, sub: it.texto, opcoes: opcoesDe(it), valor: valorItem(rel, it), padrao: padrao(it), bloq: bloqueado(rel, it) };
  const ch = celula(it, f.r, f.c); if (!ch) return null;
  const col = it.tabela.colunas[f.c] ? it.tabela.colunas[f.c].nome : "";
  const base = String(it.tabela.linhas[f.r][0] && typeof it.tabela.linhas[f.r][0] !== "object" ? it.tabela.linhas[f.r][0] : "");
  const s = rel.st[chave(f)];
  const opcoes = arr(ch.opcoes).length ? arr(ch.opcoes) : (ch.tipo === "decisao" ? OPC_DEC : OPC_ACAO);
  return { titulo: `${it.num} · ${col}`, sub: `${it.titulo}${base ? " — " + base : ""}`, opcoes, valor: s && s.v != null ? s.v : (ch.valor || "A fazer"), padrao: ch.valor && PEND.includes(ch.valor) ? ch.valor : "A fazer", bloq: false };
}
function valorAlvo(rel, f) { const i = infoAlvo(rel, f); return i ? i.valor : null; }
function vizinho(rel, dir) {
  const lista = alvos(rel); if (!lista.length) return null;
  const atual = rel.foco ? lista.findIndex(f => chave(f) === chave(rel.foco)) : -1;
  for (const incluirBloq of [false, true]) {
    for (let p = 1; p <= lista.length; p++) {
      const i = ((atual < 0 ? (dir > 0 ? -1 : 0) : atual) + dir * p + lista.length * p) % lista.length;
      const f = lista[i], inf = infoAlvo(rel, f);
      if (inf && kind(inf.valor) === "pend" && (incluirBloq || !inf.bloq) && chave(f) !== (rel.foco ? chave(rel.foco) : "")) return f;
    }
  }
  return null;
}
function contagens(rel) {
  let pend = 0, feitos = 0, bloq = 0;
  alvos(rel).forEach(f => {
    const inf = infoAlvo(rel, f), k = kind(inf.valor);
    if (resolvido(k)) feitos++; else if (inf.bloq) bloq++; else if (k === "pend" || k === "nao") pend++;
  });
  return { pend, feitos, bloq };
}
function statusCap(rel, sec, cap) {
  const sits = cap.paragrafos.map(p => sitDe(rel, sec, p));
  const verdes = sits.filter(s => s === "verde").length;
  return { cor: sits.includes("azul") ? "azul" : (sits.length && verdes === sits.length ? "verde" : "vermelho"), verdes, total: sits.length };
}
function parSt(rel, sec, p) { return rel.st[`P:${sec.num}:${p.id}`]; }
function sitDe(rel, sec, p) { const s = parSt(rel, sec, p); return (s && s.sit) || p.situacao; }
function textoDe(rel, sec, p) { const s = parSt(rel, sec, p); return s && s.texto != null ? s.texto : p.texto; }

/* ================= estado da interface ================= */
let vista = "rel"; // rel | rev | est
let painel = { aberto: false, hl: 0, outro: false };
function relAtual() { return DB.atual && DB.rels[DB.atual] ? DB.rels[DB.atual] : null; }
function remontar() { const y = scrollY; montar(); scrollTo(0, y); }
function setFoco(f, rolar) {
  const rel = relAtual(); if (!rel) return;
  rel.foco = f; salvar();
  document.querySelectorAll(".foco").forEach(e => e.classList.remove("foco"));
  if (f) { const e = document.querySelector(`[data-fk="${CSS.escape(chave(f))}"]`); if (e) { e.classList.add("foco"); if (rolar) e.scrollIntoView({ behavior: "smooth", block: "center" }); } }
}

/* ================= montagem ================= */
function aplicarTema() {
  document.documentElement.dataset.tema = DB.ui.tema;
  $("#tema").value = DB.ui.tema;
  document.body.classList.toggle("lat", !!DB.ui.lateral);
  $("#fundo").classList.toggle("oculto", !(DB.ui.lateral && innerWidth < 900));
  document.body.classList.toggle("pa", painel.aberto);
  $("#b-rev").classList.toggle("on", !!DB.ui.revisar);
}
function montar() {
  aplicarTema();
  const m = $("#main"); m.replaceChildren();
  const rel = relAtual();
  desenharLateral();
  if (vista === "rev") telaRevisor(m);
  else if (vista === "est") telaEstado(m);
  else if (!rel) telaInicio(m);
  else telaRelatorio(m, rel);
  atualizarContador();
  desenharPainel();
  ajustarTabelas();
  if (rel && rel.foco) setFoco(rel.foco, false);
  if (vista === "rel" && rel && DB.ui.revisar && temTexto(rel) && DICSTATE === "nao") carregarDic(() => { if (DICSTATE === "ok") remontar(); });
}
function temTexto(rel) { return rel.dados.secoes.some(s => s.tipo === "texto"); }
function atualizarContador() {
  const rel = relAtual(), c = $("#cont");
  if (!rel || vista !== "rel") { c.textContent = ""; return; }
  const n = contagens(rel);
  c.replaceChildren(h("b", {}, n.pend), h("span", { class: "lg" }, " pendentes · "), h("span", {}, " "), h("b", {}, n.feitos), h("span", { class: "lg" }, " decididos · "), h("span", {}, " "), h("b", {}, n.bloq), h("span", { class: "lg" }, " bloqueados"));
}
$("#tema").onchange = e => { DB.ui.tema = e.target.value; salvar(); aplicarTema(); };
$("#b-lat").onclick = () => { DB.ui.lateral = !DB.ui.lateral; salvar(); aplicarTema(); };
$("#fundo").onclick = () => { DB.ui.lateral = false; salvar(); aplicarTema(); };
$("#b-rev").onclick = () => { DB.ui.revisar = !DB.ui.revisar; salvar(); remontar(); if (DB.ui.revisar) aviso("Revisão de texto ligada."); };

function desenharLateral() {
  const L = $("#lateral"); L.replaceChildren();
  const rel = relAtual();
  L.append(h("h4", {}, "Relatórios"));
  const ids = Object.keys(DB.rels).sort((a, b) => DB.rels[b].atualizado - DB.rels[a].atualizado);
  if (!ids.length) L.append(h("p", { class: "suave", style: "padding:0 8px" }, "Nenhum ainda."));
  ids.forEach(id => {
    const r = DB.rels[id], n = contagens(r);
    L.append(h("button", { class: "caixinha" + (id === DB.atual && vista === "rel" ? " sel" : ""), onclick: () => { DB.atual = id; vista = "rel"; salvar(); montar(); scrollTo(0, 0); fecharLateralPequena(); } },
      h("span", {}, "▤"), h("span", { class: "n" }, r.dados.titulo), h("span", { class: "c" }, n.pend || "✓")));
  });
  if (rel && vista === "rel") {
    L.append(h("h4", {}, "Seções"));
    rel.dados.secoes.forEach(s => {
      const cor = s.tipo === "texto" ? (s.capitulos.every(c => statusCap(rel, s, c).cor === "verde") ? "verde" : s.capitulos.some(c => statusCap(rel, s, c).cor === "azul") ? "azul" : "vermelho") : (s.itens.filter(acionavel).length && s.itens.filter(acionavel).every(i => resolvido(kind(valorItem(rel, i)))) ? "verde" : "vermelho");
      L.append(h("button", { class: "caixinha", onclick: () => { rel.rec[s.num] = false; salvar(); remontar(); const e = document.getElementById("sec-" + s.num); if (e) e.scrollIntoView({ behavior: "smooth", block: "start" }); fecharLateralPequena(); } },
        h("span", { class: "bola " + cor }), h("span", { class: "n" }, `${s.num} ${s.titulo}`)));
    });
  }
  L.append(h("h4", {}, "Abrir"));
  L.append(h("button", { class: "lat-bt", onclick: () => $("#arq").click() }, "Abrir arquivo .json"),
    h("button", { class: "lat-bt", onclick: telaColar }, "Colar relatório"),
    h("button", { class: "lat-bt", onclick: acompanharArquivo }, "Acompanhar arquivo (Chrome)"),
    h("button", { class: "lat-bt", onclick: () => { servidorOk = null; procurarPasta(true); } }, "Procurar na pasta dados"),
    h("button", { class: "lat-bt", onclick: abrirExemplo }, "Ver exemplo"));
  L.append(h("h4", {}, "Ferramentas"));
  L.append(h("button", { class: "lat-bt", onclick: () => { vista = "rev"; montar(); fecharLateralPequena(); } }, "Revisor de texto livre"),
    h("button", { class: "lat-bt", onclick: () => { vista = "est"; montar(); fecharLateralPequena(); } }, "Levar estado para outro aparelho"));
  L.append(h("h4", {}, "Ajustes"));
  [["avancar", "Avançar sozinho para o próximo pendente"], ["audioSempre", "Áudio sempre ligado"], ["revisar", "Revisar texto ao abrir capítulo"]].forEach(([k, t]) => {
    const c = h("input", { type: "checkbox", onchange: e => { DB.ui[k] = e.target.checked; salvar(); if (k === "audioSempre" && e.target.checked && !audioOn) ligarAudio(); if (k === "revisar") remontar(); } });
    c.checked = !!DB.ui[k]; L.append(h("label", { class: "lat-chk" }, c, t));
  });
}
function fecharLateralPequena() { if (innerWidth < 900) { DB.ui.lateral = false; aplicarTema(); } }

function telaInicio(m) {
  m.append(h("h1", {}, "Ômega"),
    h("p", { class: "suave just" }, "Leitor e decisor de relatórios. Abra o relatório que o Claude gerou (arquivo relatorio.json) ou cole o texto dele. Tudo o que você decidir fica salvo neste aparelho."),
    h("div", { class: "linha" },
      h("button", { class: "btn", onclick: () => $("#arq").click() }, "Abrir relatório"),
      h("button", { class: "btn sec", onclick: telaColar }, "Colar relatório"),
      h("button", { class: "btn sec", onclick: abrirExemplo }, "Ver exemplo")));
}
$("#arq").onchange = async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try { carregarRelatorio(JSON.parse(await f.text())); } catch (er) { aviso("Erro: " + er.message); }
};
function telaColar() {
  const m = $("#main"); m.replaceChildren(); vista = "colar";
  const ta = h("textarea", { class: "livre", placeholder: "Cole aqui o texto do relatório (começa com {)", style: "min-height:280px" });
  m.append(h("h1", {}, "Colar relatório"), ta, h("div", { class: "linha" },
    h("button", { class: "btn", onclick: () => { try { carregarRelatorio(JSON.parse(ta.value)); } catch (er) { aviso("Não entendi o texto: " + er.message); } } }, "Abrir"),
    h("button", { class: "btn sec", onclick: () => { vista = "rel"; montar(); } }, "Voltar")));
  fecharLateralPequena();
}
async function abrirExemplo() {
  try {
    let d;
    if (!/^https?:$/.test(location.protocol)) d = JSON.parse($("#ex").textContent);
    else try { d = await (await fetch("dados/relatorio.exemplo.json")).json(); } catch (e) { d = JSON.parse($("#ex").textContent); }
    carregarRelatorio(d);
  } catch (e) { aviso("Não consegui abrir o exemplo."); }
  fecharLateralPequena();
}

/* ---- relatório ---- */
function telaRelatorio(m, rel) {
  const d = rel.dados;
  m.append(h("h1", {}, d.titulo),
    h("div", { class: "autoria" },
      h("span", { class: "pilula" }, d.atualizado ? new Date(d.atualizado).toLocaleDateString("pt-BR") : "sem data"),
      h("span", { class: "pilula" }, "Claude"),
      h("span", { class: "pilula" }, `rev ${d.rev}`),
      h("span", { class: "pilula" }, d.id)));
  const feitos = [];
  d.secoes.forEach(sec => {
    const aberto = !rel.rec[sec.num];
    const el = h("section", { class: "sec" + (aberto ? "" : " rec"), id: "sec-" + sec.num });
    let res = 0, tot = 0;
    const corpo = h("div", { class: "sec-b" });
    if (sec.tipo === "texto") {
      sec.capitulos.forEach(c => { const s = statusCap(rel, sec, c); res += s.verdes; tot += s.total; corpo.append(capituloEl(rel, sec, c)); });
    } else {
      sec.itens.forEach(it => {
        if (acionavel(it)) { tot++; const k = kind(valorItem(rel, it)); if (resolvido(k)) res++; if (k === "ok") { feitos.push(it); return; } }
        corpo.append(itemEl(rel, it));
      });
      if (!corpo.children.length) corpo.append(h("p", { class: "suave" }, tot ? "Tudo feito nesta seção." : "Sem itens."));
    }
    const cor = sec.tipo === "texto" ? "" : (tot && res === tot ? "verde" : "vermelho");
    el.append(h("button", { class: "sec-h", onclick: () => { rel.rec[sec.num] = aberto; salvar(); remontar(); } },
      h("span", { class: "seta" }, "▾"), cor ? h("span", { class: "bola " + cor }) : null, h("h2", { class: "n" }, `${sec.num} ${sec.titulo}`)),
      corpo, h("div", { class: "sec-f sec-b" }, `${res} de ${tot} resolvidos`));
    m.append(el);
  });
  const feitoAberto = !rel.rec.__feito;
  const fe = h("section", { class: "sec bloco-feito" + (feitoAberto ? "" : " rec"), id: "sec-__feito" });
  fe.append(h("button", { class: "sec-h", onclick: () => { rel.rec.__feito = feitoAberto; salvar(); remontar(); } }, h("span", { class: "seta" }, "▾"), h("span", { class: "bola ok" }), h("h2", { class: "n" }, `Já feito (${feitos.length})`)),
    h("div", { class: "sec-b" }, feitos.length ? feitos.map(it => itemEl(rel, it)) : h("p", { class: "suave" }, "Nada ainda.")));
  m.append(fe);
}
function chipEl(valor, fk, aoClicar) {
  return h("button", { class: "chip " + kind(valor), "data-chip": fk, onclick: e => { e.stopPropagation(); aoClicar(); } }, valor);
}
function itemEl(rel, it) {
  const v = valorItem(rel, it), k = kind(v), bloq = acionavel(it) && bloqueado(rel, it);
  const f = { t: "I", num: it.num }, st = rel.st["I:" + it.num] || {};
  const e = h("div", { class: "item" + (bloq ? " bloq" : "") + (k === "ign" ? " ign" : ""), id: "it-" + it.num.replace(/[^\w-]/g, "_"), "data-fk": chave(f), onclick: ev => { if (!ev.target.closest("button,a,table")) setFoco(f); } },
    h("div", { class: "cab" }, h("span", { class: "num" }, it.num), h("span", { class: "tit" }, it.titulo || "(sem título)")));
  if (it.texto) e.append(h("p", { class: "tx just" }, it.texto));
  if (it.dependeDe.length) {
    const l = h("div", { class: "rel-l" }, "Depende de ");
    it.dependeDe.forEach(n => l.append(h("a", { onclick: () => irPara(n) }, n)));
    e.append(l);
    if (bloq) e.append(h("div", { class: "aviso-dep" }, "Aguardando o item anterior ficar resolvido."));
  }
  if (it.bloqueia.length) {
    const l = h("div", { class: "rel-l" }, "Bloqueia ");
    it.bloqueia.forEach(n => l.append(h("a", { onclick: () => irPara(n) }, n)));
    e.append(l);
  }
  it.caminhos.forEach(c => e.append(h("div", { class: "cam" }, h("code", {}, c), h("button", { class: "mini", onclick: async ev => { ev.stopPropagation(); (await copiar(c)) ? aviso("Caminho copiado.") : caixaCopia(c, "Caminho"); } }, "Copiar"))));
  if (it.tabela) e.append(tabelaEl(rel, it));
  if (st.obs) e.append(h("div", { class: "nota-ob" }, "Anotação: " + st.obs));
  e.append(notasEl(rel, "I:" + it.num));
  if (acionavel(it)) e.append(h("div", { class: "fim-item" }, "(", chipEl(v, chave(f), () => abrirPainel(f)), ")"));
  return e;
}
function notasEl(rel, k) {
  const s = rel.st[k]; if (!s || !s.notas || !s.notas.length) return h("span");
  return h("div", { class: "notas" }, s.notas.map((t, i) => h("div", { class: "nota" }, h("span", {}, "🎙"), h("span", { style: "flex:1" }, t), h("button", { title: "Apagar nota", onclick: ev => { ev.stopPropagation(); s.notas.splice(i, 1); salvar(); remontar(); } }, "×"))));
}
function irPara(num) {
  const rel = relAtual(); if (!rel) return;
  const id = "it-" + num.replace(/[^\w-]/g, "_");
  let el = document.getElementById(id);
  if (!el) {
    rel.dados.secoes.forEach(s => { if ((s.itens || []).some(i => i.num === num)) rel.rec[s.num] = false; });
    rel.rec.__feito = false; salvar(); remontar(); el = document.getElementById(id);
  } else {
    const sec = el.closest(".sec"); if (sec && sec.classList.contains("rec")) { const sn = sec.id.replace("sec-", ""); rel.rec[sn] = false; salvar(); remontar(); el = document.getElementById(id); }
  }
  if (!el) { aviso("Item " + num + " não encontrado."); return; }
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove("alvo"); void el.offsetWidth; el.classList.add("alvo");
}

/* ---- tabelas ---- */
const REG_NUM = /^[\s\-+R$€%.,\d]+$/, REG_DATA = /^\d{1,2}\/\d{1,2}(\/\d{2,4})?/;
function icoAlin(a) {
  const ns = "http://www.w3.org/2000/svg", s = document.createElementNS(ns, "svg");
  s.setAttribute("viewBox", "0 0 14 12"); s.setAttribute("width", "14"); s.setAttribute("height", "12");
  const L = { left: [[0, 10], [0, 6], [0, 10], [0, 7]], center: [[2, 12], [4, 10], [2, 12], [3, 11]], right: [[4, 14], [8, 14], [4, 14], [7, 14]], justify: [[0, 14], [0, 14], [0, 14], [0, 14]] }[a];
  L.forEach(([x1, x2], i) => { const l = document.createElementNS(ns, "line"); [["x1", x1], ["x2", x2], ["y1", 1.5 + i * 3], ["y2", 1.5 + i * 3], ["stroke", "currentColor"], ["stroke-width", "1.4"]].forEach(([k, v]) => l.setAttribute(k, v)); s.append(l); });
  return s;
}
function alinPadrao(it, j) {
  const cel = it.tabela.linhas.map(l => l[j]).filter(x => x != null && x !== "");
  if (cel.length && cel.every(x => typeof x === "object" && x.chip)) return "center";
  if (cel.length && cel.every(x => typeof x !== "object" && (REG_NUM.test(String(x)) || REG_DATA.test(String(x))))) return "right";
  return "justify";
}
function tabelaEl(rel, it) {
  const t = it.tabela, hs = hashTxt(JSON.stringify(t));
  let L = rel.larg[it.num]; if (!L || L.h !== hs) L = rel.larg[it.num] = { h: hs, w: {} };
  const alinDe = j => rel.alin[`${it.num}|${j}`] || (t.colunas[j] && t.colunas[j].alin) || alinPadrao(it, j);
  const tr = h("tr", {});
  t.colunas.forEach((c, j) => {
    const a = alinDe(j), th = h("th", { style: L.w[j] ? `width:${L.w[j]}px` : null });
    th.append(h("div", {}, c.nome), h("div", { class: "alins" }, ["left", "center", "right", "justify"].map(x => h("button", { class: x === a ? "on" : "", title: { left: "Esquerda", center: "Centralizado", right: "Direita", justify: "Justificado" }[x], onclick: ev => { ev.stopPropagation(); rel.alin[`${it.num}|${j}`] = x; salvar(); remontar(); } }, icoAlin(x)))));
    const rz = h("div", { class: "rz" });
    rz.addEventListener("pointerdown", ev => {
      ev.preventDefault(); const x0 = ev.clientX, w0 = th.getBoundingClientRect().width;
      const mv = e2 => { th.style.width = Math.max(40, w0 + e2.clientX - x0) + "px"; };
      const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); L.w[j] = Math.round(th.getBoundingClientRect().width); salvar(); };
      addEventListener("pointermove", mv); addEventListener("pointerup", up);
    });
    th.append(rz); tr.append(th);
  });
  const corpo = h("tbody", {});
  t.linhas.forEach((ln, r) => {
    const row = h("tr", {});
    t.colunas.forEach((c, j) => {
      const x = ln[j], td = h("td", { "data-label": c.nome, style: `text-align:${alinDe(j)}` });
      if (x && typeof x === "object" && x.chip) {
        const f = { t: "C", num: it.num, r, c: j }, s = rel.st[chave(f)];
        td.setAttribute("data-fk", chave(f));
        td.append(chipEl(s && s.v != null ? s.v : (x.chip.valor || "A fazer"), chave(f), () => abrirPainel(f)));
      } else if (x && typeof x === "object" && x.caminho) {
        td.append(h("code", { class: "cod" }, x.caminho), " ", h("button", { class: "mini", onclick: async () => { (await copiar(x.caminho)) ? aviso("Caminho copiado.") : caixaCopia(x.caminho, "Caminho"); } }, "Copiar"));
      } else td.append(x == null ? "" : String(x && x.texto != null ? x.texto : x));
      row.append(td);
    });
    corpo.append(row);
  });
  return h("div", { class: "tabs" }, h("table", { class: "tab" }, h("thead", {}, tr), corpo),
    h("div", { class: "tab-ferr" }, h("button", { class: "mini", onclick: () => { rel.larg[it.num] = { h: hs, w: {} }; salvar(); remontar(); } }, "Ajustar tabela")));
}

function ajustarTabelas() {
  document.querySelectorAll(".tabs").forEach(box => {
    const t = box.querySelector("table.tab"), cols = t.querySelectorAll("thead th").length || 1;
    t.classList.remove("cartoes");
    const cart = box.clientWidth / cols < 115;
    t.classList.toggle("cartoes", cart); box.classList.toggle("cart", cart);
  });
}

/* ---- modo Texto ---- */
const CICLO = ["vermelho", "verde", "azul"];
function capituloEl(rel, sec, cap) {
  const ck = `cap-${sec.num}-${cap.num}`, aberto = !rel.rec[ck], s = statusCap(rel, sec, cap);
  const tb = h("table", { class: "tex" }, h("thead", {}, h("tr", {}, h("th", {}, "Tópico / parágrafo"), h("th", { class: "col-s" }, "Situação"))), h("tbody", {}, cap.paragrafos.map(p => paragrafoEl(rel, sec, p))));
  return h("div", { class: "capitulo" + (aberto ? "" : " rec") },
    h("button", { class: "cap-h", onclick: () => { rel.rec[ck] = aberto; salvar(); remontar(); } }, h("span", { class: "bola " + s.cor, style: "width:16px;height:16px" }), h("span", { class: "n" }, `${cap.num} ${cap.titulo}`), h("span", { class: "suave", style: "font-size:13px" }, `${s.verdes} de ${s.total}`), h("span", { class: "seta" }, "▾")),
    h("div", { class: "cap-b" }, tb));
}
function paragrafoEl(rel, sec, p) {
  const f = { t: "P", sec: sec.num, id: p.id }, k = chave(f), st = rel.st[k] || {}, sit = sitDe(rel, sec, p), txt = textoDe(rel, sec, p);
  const alvoTx = h("div", { class: "ptexto" });
  renderTexto(alvoTx, txt, (novo) => alterarPar(rel, sec, p, novo));
  const dot = h("button", { class: "dot " + sit, title: sit === "vermelho" ? "Pendente" : sit === "verde" ? "Aprovado" : "Ajustar", "aria-label": "Situação: " + sit });
  let timer = null, longo = false;
  dot.addEventListener("pointerdown", () => { longo = false; timer = setTimeout(() => { longo = true; ciclar(-1); }, 550); });
  const fim = () => clearTimeout(timer);
  dot.addEventListener("pointerup", fim); dot.addEventListener("pointerleave", fim); dot.addEventListener("pointercancel", fim);
  dot.addEventListener("contextmenu", e => e.preventDefault());
  dot.addEventListener("click", e => { e.stopPropagation(); if (longo) { longo = false; return; } ciclar(1); });
  function ciclar(d) {
    const ns = CICLO[(CICLO.indexOf(sit) + d + 3) % 3], s = stOf(rel, k); s.sit = ns; s.tocado = true; rel.foco = f; salvar(); remontar();
  }
  dot.append(h("i"));
  const mic = h("button", { class: "mic" + (audioOn && rel.foco && chave(rel.foco) === k ? " gravando" : ""), title: "Ditar uma nota para este parágrafo", onclick: e => { e.stopPropagation(); setFoco(f); alternarAudio(); } }, "🎙");
  const tdT = h("td", {}, h("div", { class: "pid" }, p.id, st.alterado ? h("span", { class: "alt" }, "alterado por você") : null), alvoTx, notasEl(rel, k));
  if (DB.ui.revisar && rel.foco && chave(rel.foco) === k) tdT.append(h("div", { class: "rev-acoes" }, h("a", { onclick: async () => { const t = PERGUNTA + "\n\n" + textoDe(rel, sec, p); const ok = await copiar(t); window.open(URLS.gemini, "_blank", "noopener"); ok ? aviso("Copiado, cole no Gemini") : caixaCopia(t, "Texto para o Gemini"); } }, "Revisar no Gemini")));
  const tr = h("tr", { "data-fk": k, onclick: ev => { if (!ev.target.closest("button,a")) { const antes = rel.foco && chave(rel.foco); setFoco(f); if (DB.ui.revisar && antes !== k) remontar(); } } }, tdT, h("td", { class: "col-s" }, dot, mic));
  alvoTx.addEventListener("dblclick", () => editarPar(alvoTx, rel, sec, p));
  let ult = 0;
  alvoTx.addEventListener("pointerup", ev => { if (ev.pointerType === "mouse") return; const t = Date.now(); if (t - ult < 350) editarPar(alvoTx, rel, sec, p); ult = t; });
  return tr;
}
function editarPar(el, rel, sec, p) {
  if (el.isContentEditable) return;
  const original = textoDe(rel, sec, p);
  el.textContent = original;
  try { el.contentEditable = "plaintext-only"; } catch (e) {}
  if (!el.isContentEditable) el.contentEditable = "true";
  el.focus();
  const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  let cancel = false;
  el.addEventListener("keydown", ev => { if (ev.key === "Escape") { cancel = true; el.blur(); } });
  el.addEventListener("blur", () => {
    el.removeAttribute("contenteditable");
    const novo = el.innerText.replace(/ /g, " ").replace(/\n+$/g, "");
    if (!cancel && novo !== original) alterarPar(rel, sec, p, novo); else remontar();
  }, { once: true });
}
function alterarPar(rel, sec, p, novo) {
  const k = `P:${sec.num}:${p.id}`, s = stOf(rel, k);
  if (!s.alterado) s.base = p.texto;
  s.texto = novo; s.alterado = true; s.sit = "azul"; s.tocado = true; rel.foco = { t: "P", sec: sec.num, id: p.id }; salvar(); remontar();
}

/* ================= painel fixo de escolhas ================= */
function abrirPainel(f) {
  const rel = relAtual(); if (!rel) return;
  setFoco(f); painel.aberto = true; painel.outro = false;
  const inf = infoAlvo(rel, f); painel.hl = Math.max(0, inf ? inf.opcoes.indexOf(inf.valor) : 0);
  aplicarTema(); desenharPainel();
}
function fecharPainel() { painel.aberto = false; painel.outro = false; aplicarTema(); desenharPainel(); }
function desenharPainel() {
  const P = $("#painel"), rel = relAtual();
  P.classList.toggle("aberto", painel.aberto);
  P.replaceChildren();
  if (!painel.aberto || !rel || !rel.foco || rel.foco.t === "P") { return; }
  const f = rel.foco, inf = infoAlvo(rel, f); if (!inf) return;
  P.append(h("div", { class: "p-topo" }, h("div", { class: "t" }, h("b", {}, inf.titulo), h("span", {}, inf.sub && inf.sub.length > 140 ? inf.sub.slice(0, 140) + "…" : inf.sub)), h("button", { class: "p-x", onclick: fecharPainel, "aria-label": "Fechar" }, "×")));
  const ops = h("div", { class: "p-ops" });
  inf.opcoes.forEach((o, i) => ops.append(h("button", { class: "op" + (o === inf.valor ? " sel" : "") + (i === painel.hl ? " hl" : ""), onclick: () => escolher(f, o) }, h("kbd", {}, i < 9 ? i + 1 : "·"), h("span", {}, o))));
  const st = rel.st[chave(f)];
  if (painel.outro) {
    const ta = h("textarea", { placeholder: "Escreva (ou dite) a sua resposta…" });
    if (st && st.outro) ta.value = st.v;
    ops.append(h("div", { class: "p-outro" }, ta, h("div", { class: "linha", style: "margin:0" }, h("button", { class: "btn", onclick: () => { if (ta.value.trim()) escolher(f, ta.value.trim(), true); } }, "Salvar"), h("button", { class: "btn sec", onclick: () => { painel.outro = false; desenharPainel(); } }, "Voltar"))));
    setTimeout(() => ta.focus(), 50);
  } else ops.append(h("button", { class: "op", onclick: () => { painel.outro = true; desenharPainel(); } }, h("kbd", {}, "·"), h("span", {}, "Outro…")));
  P.append(ops);
  P.append(h("div", { class: "p-nav" }, h("button", { onclick: () => irVizinho(-1) }, "← Anterior pendente"), h("button", { onclick: () => irVizinho(1) }, "Próximo pendente →")));
  const av = h("input", { type: "checkbox", onchange: e => { DB.ui.avancar = e.target.checked; salvar(); } }); av.checked = !!DB.ui.avancar;
  P.append(h("div", { class: "p-rod" }, h("label", {}, av, "Avançar sozinho"), kind(inf.valor) !== "pend" ? h("a", { onclick: () => escolher(f, inf.padrao, false, true) }, "Voltar a pendente") : null));
  let x0 = 0, y0 = 0;
  P.ontouchstart = e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; };
  P.ontouchend = e => { const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; if (Math.abs(dx) > 70 && Math.abs(dy) < 45 && !eh(document.activeElement)) irVizinho(dx < 0 ? 1 : -1); };
}
function irVizinho(dir) {
  const rel = relAtual(); if (!rel) return;
  const n = vizinho(rel, dir); if (!n) { aviso("Não há outro pendente."); return; }
  setFoco(n, true); painel.outro = false; const inf = infoAlvo(rel, n); painel.hl = Math.max(0, inf.opcoes.indexOf(inf.valor)); painel.aberto = true; aplicarTema(); desenharPainel();
}
function escolher(f, valor, outro, reset) {
  const rel = relAtual(); if (!rel) return;
  const k = chave(f), antes = JSON.stringify(rel.st[k] || null), s = stOf(rel, k);
  s.v = valor; s.outro = !!outro; s.tocado = true;
  rel.foco = f; salvar();
  const desfaz = () => { if (antes === "null") delete rel.st[k]; else rel.st[k] = JSON.parse(antes); salvar(); remontar(); };
  const prox = DB.ui.avancar && !reset && kind(valor) !== "pend" ? vizinho(rel, 1) : null;
  painel.outro = false;
  remontar();
  if (prox) {
    setFoco(prox, true); const inf = infoAlvo(rel, prox); painel.hl = Math.max(0, inf.opcoes.indexOf(inf.valor)); desenharPainel();
    aviso("Registrado. Próximo pendente.", desfaz);
  } else {
    if (DB.ui.avancar && !reset && kind(valor) !== "pend") { fecharPainel(); aviso("Registrado. Não há mais pendentes.", desfaz); }
    else { const inf = infoAlvo(rel, f); painel.hl = Math.max(0, inf.opcoes.indexOf(inf.valor)); desenharPainel(); aviso("Registrado.", desfaz); }
  }
}
document.addEventListener("keydown", e => {
  if (eh(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
  const rel = relAtual(); if (!rel || vista !== "rel") return;
  if (e.key === "n" || e.key === "N") { e.preventDefault(); irVizinho(1); return; }
  if (e.key === "p" || e.key === "P") { e.preventDefault(); irVizinho(-1); return; }
  if (!painel.aberto || !rel.foco || rel.foco.t === "P") return;
  const inf = infoAlvo(rel, rel.foco); if (!inf) return;
  if (/^[1-9]$/.test(e.key)) { const o = inf.opcoes[+e.key - 1]; if (o != null) { e.preventDefault(); escolher(rel.foco, o); } }
  else if (e.key === "ArrowDown") { e.preventDefault(); painel.hl = Math.min(inf.opcoes.length - 1, painel.hl + 1); desenharPainel(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); painel.hl = Math.max(0, painel.hl - 1); desenharPainel(); }
  else if (e.key === "ArrowRight") { e.preventDefault(); irVizinho(1); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); irVizinho(-1); }
  else if (e.key === "Enter") { e.preventDefault(); const o = inf.opcoes[painel.hl]; if (o != null) escolher(rel.foco, o); }
  else if (e.key === "Escape") fecharPainel();
});

/* ================= saída: copiar relatório ================= */
function aspas(t) { return `"${String(t).replace(/\s+/g, " ").trim()}"`; }
function linhaItem(rel, it, f) {
  const k = chave(f), s = rel.st[k] || {}, inf = infoAlvo(rel, f), v = inf.valor, kd = kind(v);
  const prefixo = f.t === "I" ? it.num : `${it.num} (linha ${f.r + 1}, ${it.tabela.colunas[f.c].nome})`;
  let tag, extra = "";
  if (kd === "pend") { if (!(s.notas && s.notas.length)) return null; tag = `[${v}]`; }
  else if (s.outro) { tag = "[Escolheu]"; extra = ` outro: ${aspas(v)}`; }
  else if (inf.opcoes === it.opcoes && it.tipo === "decisao" && it.opcoes.length && it.opcoes.includes(v) && v !== "Ignorar") { tag = "[Escolheu]"; extra = ` opção ${String.fromCharCode(65 + it.opcoes.indexOf(v))}: ${aspas(v.toLowerCase())}`; }
  else tag = `[${v}]`;
  let nota = "";
  if (s.obs) nota = `nota: ${s.obs}`;
  else if (kd === "nao" && s.notas && s.notas.length) nota = `nota: ${s.notas[s.notas.length - 1]}`;
  let l = `${prefixo} ${tag}${extra}`;
  if (nota) l += (extra ? " — " : " ") + nota;
  return { l, usada: !s.obs && kd === "nao" && s.notas && s.notas.length ? s.notas[s.notas.length - 1] : null };
}
function montarSaida(rel, soFoco) {
  const d = rel.dados, blocos = [], notas = [];
  const foco = rel.foco ? chave(rel.foco) : null;
  d.secoes.forEach(sec => {
    if (sec.tipo === "texto") {
      sec.capitulos.forEach(cap => {
        const ls = [];
        cap.paragrafos.forEach(p => {
          const k = `P:${sec.num}:${p.id}`, s = rel.st[k]; if (!s || !(s.tocado || (s.notas && s.notas.length))) return;
          if (soFoco && k !== foco) return;
          const sit = sitDe(rel, sec, p); let l = `${p.id} [${sit}]`;
          if (s.alterado) l += ` texto alterado: ${aspas(textoDe(rel, sec, p))}`;
          else if (sit === "azul" && s.notas && s.notas.length) l += ` ajuste: ${s.notas[0]}`;
          ls.push(l);
          (s.notas || []).forEach((n, i) => { if (!(sit === "azul" && !s.alterado && i === 0)) notas.push(`(item ${p.id}) ${aspas(n)}`); });
        });
        if (ls.length) blocos.push(`## Texto: ${sec.titulo}, capítulo ${cap.num}\n\n${ls.join("\n\n")}`);
      });
    } else {
      const ls = [];
      sec.itens.forEach(it => {
        if (!acionavel(it) && !it.tabela) return;
        const fs = [];
        if (acionavel(it)) fs.push({ t: "I", num: it.num });
        if (it.tabela) it.tabela.linhas.forEach((ln, r) => ln.forEach((cel, c) => { if (cel && typeof cel === "object" && cel.chip) fs.push({ t: "C", num: it.num, r, c }); }));
        fs.forEach(f => {
          const k = chave(f), s = rel.st[k]; if (!s || !(s.tocado || (s.notas && s.notas.length))) return;
          if (soFoco && k !== foco) return;
          const r = linhaItem(rel, it, f); if (!r) { (s.notas || []).forEach(n => notas.push(`(item ${it.num}) ${aspas(n)}`)); return; }
          ls.push(r.l);
          (s.notas || []).forEach(n => { if (n !== r.usada) notas.push(`(item ${it.num}) ${aspas(n)}`); });
        });
      });
      if (ls.length) blocos.push(`## ${sec.num} ${sec.titulo}\n\n${ls.join("\n\n")}`);
    }
  });
  if (!soFoco) (rel.notasGeral || []).forEach(n => notas.push(`(geral) ${aspas(n)}`));
  let t = `[ÔMEGA] relatório ${d.id} rev ${d.rev} | ${agora()}\n\n`;
  t += blocos.length ? blocos.join("\n\n") + "\n" : "Nada decidido ou alterado desde a última leva.\n";
  if (notas.length) t += `\nNotas de voz:\n\n${notas.map(n => "- " + n).join("\n")}\n`;
  return t;
}
async function copiarSaida(soFoco) {
  const rel = relAtual(); if (!rel) { aviso("Abra um relatório primeiro."); return; }
  if (soFoco && !rel.foco) { aviso("Toque num item para colocá-lo em foco."); return; }
  const t = montarSaida(rel, soFoco);
  if (await copiar(t)) aviso(soFoco ? "Item copiado. Cole na conversa com o Claude." : "Copiado. Cole na conversa com o Claude."); else caixaCopia(t, "Relatório");
}
$("#b-cop").onclick = () => copiarSaida(false);
$("#b-copf").onclick = () => copiarSaida(true);

/* ================= Claude / Gemini ================= */
const URLS = { claude: "https://claude.ai/new", gemini: "https://gemini.google.com/app" };
const PERGUNTA = "Revise apenas o português (ortografia, acentuação, concordância e pontuação) do texto abaixo. Não mude o sentido nem o vocabulário jurídico. Devolva o texto corrigido e, depois, uma lista curta das alterações.";
function trechoSelecionado() {
  const a = document.activeElement;
  if (a && (a.tagName === "TEXTAREA" || a.tagName === "INPUT") && a.selectionEnd > a.selectionStart) return a.value.slice(a.selectionStart, a.selectionEnd).trim();
  return getSelection().toString().trim();
}
function textoFoco() {
  const rel = relAtual(); if (!rel || !rel.foco) return "";
  const f = rel.foco;
  if (f.t === "P") { const sec = rel.dados.secoes.find(s => s.num === f.sec), p = sec && sec.capitulos.flatMap(c => c.paragrafos).find(x => x.id === f.id); return p ? textoDe(rel, sec, p) : ""; }
  const it = achar(rel, f.num); return it ? `Item ${it.num} — ${it.titulo}\n${it.texto}` : "";
}
async function abrirIA(ia) {
  const t = trechoSelecionado() || (Date.now() - quandoGuardado < 8000 ? trechoGuardado : "") || textoFoco();
  let url = URLS[ia];
  if (ia === "claude" && t && t.length <= 1500) url += "?q=" + encodeURIComponent(t);
  if (t) { const ok = await copiar(t); window.open(url, "_blank", "noopener"); ok ? aviso("Copiado, cole na conversa") : caixaCopia(t, "Trecho"); }
  else window.open(url, "_blank", "noopener");
}
$("#b-claude").onclick = () => abrirIA("claude");
$("#b-gemini").onclick = () => abrirIA("gemini");
let trechoGuardado = "", quandoGuardado = 0;
function checarSelecao() {
  const t = trechoSelecionado(); if (t) { trechoGuardado = t; quandoGuardado = Date.now(); }
  $("#sel").style.display = t ? "flex" : "none";
}
["selectionchange", "mouseup", "keyup"].forEach(ev => document.addEventListener(ev, () => setTimeout(checarSelecao, 60)));
document.querySelectorAll("#sel button").forEach(b => {
  b.addEventListener("mousedown", e => e.preventDefault());
  b.addEventListener("click", async () => {
    const t = trechoGuardado, ia = b.dataset.ia; if (!t) return;
    let url = URLS[ia]; if (ia === "claude" && t.length <= 1500) url += "?q=" + encodeURIComponent(t);
    const ok = await copiar(t); window.open(url, "_blank", "noopener"); ok ? aviso("Copiado, cole na conversa") : caixaCopia(t, "Trecho");
  });
});

/* ================= áudio (ditado) ================= */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let reconhecedor = null, audioOn = false;
function corrigirSiglas(t) {
  return t.replace(/\b(l[aá]\s+n[ao])\s+(?:s[eé]\s*)?in?fra\b/gi, (m, a) => a + " SEINFRA")
    .replace(/\b(?:isso\s+[eé]|s[eé]|sei|cei|ce)\s*[- ]?\s*in?fra\b/gi, "SEINFRA")
    .replace(/\bseinfra\b/gi, "SEINFRA");
}
function anexarNota(t) {
  const rel = relAtual(); if (!rel || !t) return;
  if (rel.foco) { const s = stOf(rel, chave(rel.foco)); (s.notas = s.notas || []).push(t); s.tocado = true; }
  else (rel.notasGeral = rel.notasGeral || []).push(t);
  salvar(); if (!eh(document.activeElement)) remontar();
}
function mostrarOuvindo(t) { const o = $("#ouvindo"); o.style.display = t ? "block" : "none"; o.textContent = t ? "🎙 " + t : ""; }
function ligarAudio() {
  if (!SR) { aviso("Este navegador não tem ditado por voz. Use o Chrome."); return; }
  if (audioOn) return;
  audioOn = true;
  reconhecedor = new SR(); reconhecedor.lang = "pt-BR"; reconhecedor.continuous = true; reconhecedor.interimResults = true;
  reconhecedor.onresult = e => {
    let parcial = "";
    for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) anexarNota(corrigirSiglas(r[0].transcript.trim())); else parcial += r[0].transcript; }
    mostrarOuvindo(corrigirSiglas(parcial.trim()) || "ouvindo…");
  };
  reconhecedor.onerror = e => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") { audioOn = false; aviso("O microfone está bloqueado. Libere o microfone nas permissões do site (e use localhost ou https)."); atualizarAudioBt(); }
  };
  reconhecedor.onend = () => { if (audioOn) setTimeout(() => { try { reconhecedor.start(); } catch (e) {} }, 300); else { mostrarOuvindo(""); atualizarAudioBt(); } };
  try { reconhecedor.start(); mostrarOuvindo("ouvindo…"); } catch (e) { audioOn = false; }
  atualizarAudioBt();
}
function desligarAudio() { audioOn = false; try { reconhecedor && reconhecedor.stop(); } catch (e) {} mostrarOuvindo(""); atualizarAudioBt(); }
function alternarAudio() { audioOn ? desligarAudio() : ligarAudio(); }
function atualizarAudioBt() { $("#b-aud").classList.toggle("gravando", audioOn); $("#b-aud").classList.toggle("on", audioOn); }
$("#b-aud").onclick = alternarAudio;

/* ================= revisor de português ================= */
let STEMS = null, SUF = null, PRE = null, maxS = 0, maxP = 0, DICSTATE = "nao";
function carregarDic(cb) {
  if (DICSTATE === "ok") return cb();
  if (DICSTATE === "carregando") return;
  if (!window.OMEGA_DIC) { if (document.readyState !== "complete") { addEventListener("load", () => { DICSTATE = "nao"; carregarDic(cb); }, { once: true }); return; } DICSTATE = "erro"; return cb(); }
  DICSTATE = "carregando";
  setTimeout(() => {
    STEMS = new Map(); SUF = new Map(); PRE = new Map();
    for (const l of window.OMEGA_DIC.split("\n")) { const i = l.indexOf("/"), w = i < 0 ? l : l.slice(0, i); STEMS.set(w, (STEMS.get(w) || "") + (i < 0 ? "" : l.slice(i + 1))); }
    for (const [flag, tipo, cross, regras] of window.OMEGA_AFF) {
      const mapa = tipo === "S" ? SUF : PRE;
      for (const [strip, add, cond] of regras) {
        if (!mapa.has(add)) mapa.set(add, []);
        mapa.get(add).push({ flag, cross, strip, cond, re: null });
        if (tipo === "S") maxS = Math.max(maxS, add.length); else maxP = Math.max(maxP, add.length);
      }
    }
    DICSTATE = "ok"; cb();
  }, 30);
}
function condOk(r, s, tipo) {
  if (r.cond === ".") return true;
  if (!r.re) { try { r.re = new RegExp(tipo === "S" ? r.cond + "$" : "^" + r.cond); } catch (e) { r.re = /^/; } }
  return r.re.test(s);
}
function existe(w) {
  if (STEMS.has(w)) return true;
  for (let k = 0; k <= Math.min(maxS, w.length); k++) {
    const L = SUF.get(w.slice(w.length - k)); if (!L) continue;
    for (const r of L) { const stem = w.slice(0, w.length - k) + r.strip, f = STEMS.get(stem); if (f !== undefined && f.includes(r.flag) && condOk(r, stem, "S")) return true; }
  }
  for (let k = 1; k <= Math.min(maxP, w.length); k++) {
    const L = PRE.get(w.slice(0, k)); if (!L) continue;
    for (const r of L) {
      const w2 = r.strip + w.slice(k); if (!condOk(r, w2, "P")) continue;
      const f0 = STEMS.get(w2); if (f0 !== undefined && f0.includes(r.flag)) return true;
      if (!r.cross) continue;
      for (let j = 1; j <= Math.min(maxS, w2.length); j++) {
        const L2 = SUF.get(w2.slice(w2.length - j)); if (!L2) continue;
        for (const q of L2) { if (!q.cross) continue; const stem = w2.slice(0, w2.length - j) + q.strip, f = STEMS.get(stem); if (f !== undefined && f.includes(r.flag) && f.includes(q.flag) && condOk(q, stem, "S")) return true; }
      }
    }
  }
  return false;
}
const CLITICOS = new Set("o a os as lo la los las lhe lhes me te se nos vos ia ias íamos íeis iam ei ás á emos eis ão".split(" "));
function certa(p) {
  const min = p.toLowerCase();
  if ((DB.dic || []).includes(min)) return true;
  if (existe(min)) return true;
  if (min.includes("-")) {
    const ps = min.split("-").filter(Boolean);
    if (ps.length && ps.every(x => existe(x) || (DB.dic || []).includes(x))) return true;
    if (existe(ps[0]) && ps.slice(1).every(x => CLITICOS.has(x))) return true;
  }
  return false;
}
const LETRAS = "abcdefghijklmnopqrstuvwxyzáàâãéêíóôõúüç";
function edicoes(p) {
  const r = new Set();
  for (let i = 0; i <= p.length; i++) {
    const a = p.slice(0, i), b = p.slice(i);
    if (b) r.add(a + b.slice(1));
    if (b.length > 1) r.add(a + b[1] + b[0] + b.slice(2));
    for (const c of LETRAS) { if (b) r.add(a + c + b.slice(1)); r.add(a + c + b); }
  }
  return r;
}
const SEMACENTO = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
function sugestoes(pal) {
  const min = pal.toLowerCase(), cap = pal[0] !== min[0], saida = [];
  const add = w => { if (!saida.includes(w) && w !== min) saida.push(w); };
  const e1 = edicoes(min), v = [...e1].filter(w => w.length > 1 && existe(w)), sa = SEMACENTO(min);
  v.sort((x, y) => (SEMACENTO(y) === sa) - (SEMACENTO(x) === sa) || Math.abs(x.length - min.length) - Math.abs(y.length - min.length));
  v.forEach(add);
  if (saida.length < 3 && min.length < 11) {
    for (const w of e1) { if (saida.length >= 5) break; if (w.length < 3) continue; for (const w2 of edicoes(w)) if (w2.length > 1 && existe(w2)) { add(w2); if (saida.length >= 5) break; } }
  }
  return saida.slice(0, 5).map(w => cap ? w[0].toUpperCase() + w.slice(1) : w);
}
const ignoradas = new Set();
/* devolve marcas {ini,fim,txt,sug[]} para palavras desconhecidas e erros simples de espaço/pontuação */
function marcas(t) {
  const out = [];
  if (DICSTATE === "ok") {
    const re = /[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’-]*/g; let mm;
    while ((mm = re.exec(t))) {
      const p = mm[0].replace(/[-'’]+$/, ""), ini = mm.index, fim = ini + p.length;
      if (p.length === 1 || /\d/.test(p) || (p.length > 1 && p === p.toUpperCase())) continue;
      if (/^(art|inc|par|al|arts|nº|no)$/i.test(p)) continue;
      if (/\d/.test(t.slice(Math.max(0, ini - 1), ini)) || (t[fim] && /\d/.test(t[fim]))) continue;
      if (/^[A-ZÀ-Ý]/.test(p) && /[^\s.!?:;\n"“(]\s+$/.test(t.slice(Math.max(0, ini - 4), ini))) continue;
      if (ignoradas.has(p.toLowerCase()) || certa(p)) continue;
      out.push({ ini, fim, txt: p, tipo: "palavra" });
    }
  }
  let m2; const r2 = / {2,}/g; while ((m2 = r2.exec(t))) out.push({ ini: m2.index, fim: m2.index + m2[0].length, txt: m2[0], tipo: "regra", sug: [" "], msg: "Espaço duplo" });
  const r3 = / +(?=[,.;:!?])/g; while ((m2 = r3.exec(t))) out.push({ ini: m2.index, fim: m2.index + m2[0].length, txt: m2[0], tipo: "regra", sug: [""], msg: "Espaço antes da pontuação" });
  const r4 = /,(?=[A-Za-zÀ-ÿ])/g; while ((m2 = r4.exec(t))) out.push({ ini: m2.index, fim: m2.index + 1, txt: ",", tipo: "regra", sug: [", "], msg: "Falta espaço depois da vírgula" });
  out.sort((a, b) => a.ini - b.ini);
  return out.filter((x, i) => i === 0 || x.ini >= out[i - 1].fim);
}
function renderTexto(alvo, texto, aplicar) {
  alvo.replaceChildren();
  const ms = DB.ui.revisar ? marcas(texto) : [];
  let u = 0;
  ms.forEach(x => {
    alvo.append(texto.slice(u, x.ini));
    alvo.append(h("span", { class: "err", onclick: ev => { ev.stopPropagation(); balao(ev.currentTarget, x, novo => aplicar(texto.slice(0, x.ini) + novo + texto.slice(x.fim))); } }, x.tipo === "regra" && !x.txt.trim() ? "␣".repeat(Math.min(3, x.txt.length)) || "␣" : x.txt));
    u = x.fim;
  });
  alvo.append(texto.slice(u));
  if (!ms.length) alvo.textContent = texto;
}
function fecharBalao() { document.querySelectorAll(".bal").forEach(x => x.remove()); }
function balao(el, marca, aplicar, aoMudar) {
  fecharBalao();
  const r = el.getBoundingClientRect(), s = marca.tipo === "palavra" ? sugestoes(marca.txt) : marca.sug;
  const b = h("div", { class: "bal", style: `left:${Math.max(8, Math.min(r.left, innerWidth - 320))}px;top:${Math.min(r.bottom + 6, innerHeight - 300)}px` },
    marca.msg ? h("span", { class: "suave", style: "padding:6px 12px;font-size:13px" }, marca.msg) : null,
    s.length ? s.map(w => h("button", { class: "sug", onclick: () => { b.remove(); aplicar(w); } }, w === "" ? "remover espaço" : w === " " ? "usar um espaço" : w)) : h("span", { class: "suave", style: "padding:6px 12px" }, "Sem sugestões"),
    h("button", { onclick: () => { b.remove(); if (marca.tipo === "palavra") ignoradas.add(marca.txt.toLowerCase()); remontar(); if (aoMudar) aoMudar(); } }, "Ignorar"),
    marca.tipo === "palavra" ? h("button", { onclick: () => { b.remove(); (DB.dic = DB.dic || []).push(marca.txt.toLowerCase()); salvar(); remontar(); if (aoMudar) aoMudar(); aviso(`“${marca.txt.toLowerCase()}” adicionada ao seu dicionário.`); } }, "Adicionar ao meu dicionário") : null);
  document.body.append(b);
  setTimeout(() => document.addEventListener("click", function f(ev) { if (!b.contains(ev.target)) { b.remove(); document.removeEventListener("click", f); } }), 0);
}
function telaRevisor(m) {
  const ta = h("textarea", { class: "livre", placeholder: "Escreva ou cole o texto aqui…", style: "min-height:170px", oninput: () => { sessionStorage.setItem("omega.rev", ta.value); agendar(); } });
  ta.value = sessionStorage.getItem("omega.rev") || "";
  const conf = h("div", { class: "cartao ptexto", style: "min-height:60px" }), status = h("p", { class: "suave" });
  let tmr; const agendar = () => { clearTimeout(tmr); tmr = setTimeout(pintar, 400); };
  function pintar() {
    fecharBalao();
    if (DICSTATE === "erro") { status.textContent = "Dicionário não encontrado (dicionario-ptbr.js). Deixe-o na mesma pasta do index.html."; conf.replaceChildren(); return; }
    if (DICSTATE !== "ok") { status.textContent = "Carregando o dicionário…"; carregarDic(pintar); return; }
    status.textContent = "Palavras sublinhadas não estão no dicionário. Toque numa delas.";
    const saveRev = DB.ui.revisar; DB.ui.revisar = true;
    renderTexto(conf, ta.value, novo => { ta.value = novo; sessionStorage.setItem("omega.rev", novo); pintar(); });
    DB.ui.revisar = saveRev;
  }
  m.append(h("h1", {}, "Revisor de texto livre"), h("p", { class: "suave just" }, "Confere a ortografia neste aparelho, sem enviar o texto a ninguém."), ta, status, conf,
    h("div", { class: "linha" },
      h("button", { class: "btn", onclick: async () => { (await copiar(ta.value)) ? aviso("Texto copiado.") : caixaCopia(ta.value, "Texto corrigido"); } }, "Copiar texto corrigido"),
      h("button", { class: "btn sec", onclick: async () => { const t = PERGUNTA + "\n\n" + ta.value, ok = await copiar(t); window.open(URLS.gemini, "_blank", "noopener"); ok ? aviso("Copiado, cole no Gemini") : caixaCopia(t, "Texto para o Gemini"); } }, "Revisar texto final"),
      h("button", { class: "btn sec", onclick: () => { ta.value = ""; sessionStorage.removeItem("omega.rev"); pintar(); } }, "Limpar")),
    h("p", { class: "suave" }, `Meu dicionário: ${(DB.dic || []).length} palavra(s). `, (DB.dic || []).length ? h("a", { style: "cursor:pointer", onclick: () => { if (confirm("Esvaziar seu dicionário pessoal?")) { DB.dic = []; salvar(); montar(); } } }, "esvaziar") : null));
  if (ta.value) pintar(); else { status.textContent = "O dicionário carrega ao começar a digitar."; setTimeout(() => carregarDic(() => {}), 300); }
}

/* ================= estado entre aparelhos ================= */
function telaEstado(m) {
  const ta = h("textarea", { class: "livre", placeholder: "Cole aqui o estado copiado do outro aparelho", style: "min-height:160px" });
  m.append(h("h1", {}, "Levar para outro aparelho"),
    h("p", { class: "suave just" }, "No aparelho de origem toque em “Copiar estado”. No outro, cole o texto abaixo e toque em “Colar estado”. Isso substitui o que estiver neste aparelho."),
    h("div", { class: "linha" }, h("button", { class: "btn", onclick: async () => { const t = "OMEGA-ESTADO:" + JSON.stringify(DB); (await copiar(t)) ? aviso("Estado copiado. Cole no outro aparelho.") : caixaCopia(t, "Estado"); } }, "Copiar estado")),
    ta, h("div", { class: "linha" }, h("button", { class: "btn sec", onclick: () => {
      try {
        const x = JSON.parse(ta.value.trim().replace(/^OMEGA-ESTADO:/, ""));
        if (!x || typeof x.rels !== "object") throw new Error("não é um estado do Ômega");
        if (!confirm("Substituir tudo o que está neste aparelho pelo estado colado?")) return;
        DB = Object.assign({ rels: {}, atual: null, dic: [], ui: DB.ui }, x); DB.ui = Object.assign({ tema: "claro", lateral: true, avancar: true, audioSempre: false, revisar: true }, DB.ui);
        vista = "rel"; salvar(); montar(); aviso("Estado colado.");
      } catch (e) { aviso("Não entendi o texto: " + e.message); }
    } }, "Colar estado")));
}

/* ================= recarregar relatório sozinho ================= */
let ultimoHash = null, pollTimer = null;
async function procurarPasta(avisar) {
  if (!/^https?:$/.test(location.protocol)) { if (avisar) aviso("Abra o Ômega pelo endereço do servidor (servidor.js) para ler a pasta dados."); return; }
  try {
    const r = await fetch("dados/relatorio.json", { cache: "no-store" });
    if (!r.ok) throw new Error(r.status);
    const txt = await r.text(), hs = hashTxt(txt);
    if (hs !== ultimoHash) { const primeiro = ultimoHash === null; ultimoHash = hs; carregarRelatorio(JSON.parse(txt), { auto: !primeiro }); }
    else if (avisar) aviso("O relatório da pasta não mudou.");
    clearTimeout(pollTimer); pollTimer = setTimeout(() => procurarPasta(false), 4000);
  } catch (e) { if (avisar) aviso("Não achei dados/relatorio.json neste endereço."); }
}
/* acompanhar um arquivo do computador (Chrome/Edge) */
let handleArq = null, tArq = null, ultMod = 0;
function idb() { return new Promise((res, rej) => { const q = indexedDB.open("omega", 1); q.onupgradeneeded = () => q.result.createObjectStore("k"); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
async function idbSet(k, v) { try { const d = await idb(); d.transaction("k", "readwrite").objectStore("k").put(v, k); } catch (e) {} }
async function idbGet(k) { try { const d = await idb(); return await new Promise(res => { const q = d.transaction("k").objectStore("k").get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); } catch (e) { return null; } }
async function acompanharArquivo() {
  if (!window.showOpenFilePicker) { aviso("Este navegador não acompanha arquivos. Use o Chrome no computador, ou o botão Abrir arquivo."); return; }
  try { const [hd] = await showOpenFilePicker({ types: [{ description: "Relatório JSON", accept: { "application/json": [".json"] } }] }); handleArq = hd; idbSet("handle", hd); ultMod = 0; vigiarArquivo(); aviso("Acompanhando " + hd.name + ". Quando o arquivo mudar, o Ômega recarrega."); } catch (e) {}
  fecharLateralPequena();
}
async function vigiarArquivo() {
  clearTimeout(tArq); if (!handleArq) return;
  try {
    const f = await handleArq.getFile();
    if (f.lastModified !== ultMod) { const primeiro = ultMod === 0; ultMod = f.lastModified; carregarRelatorio(JSON.parse(await f.text()), { auto: !primeiro }); }
    tArq = setTimeout(vigiarArquivo, 3000);
  } catch (e) { handleArq = null; }
}
async function restaurarHandle() {
  if (!window.showOpenFilePicker) return;
  const hd = await idbGet("handle"); if (!hd) return;
  try {
    if ((await hd.queryPermission({ mode: "read" })) === "granted") { handleArq = hd; vigiarArquivo(); }
    else aviso("Retomar o acompanhamento do arquivo " + hd.name + "?", async () => { try { if ((await hd.requestPermission({ mode: "read" })) === "granted") { handleArq = hd; vigiarArquivo(); } } catch (e) {} }, "Retomar");
  } catch (e) {}
}

/* ================= início ================= */
addEventListener("resize", () => { ajustarTabelas(); document.body.classList.toggle("lat", !!DB.ui.lateral); $("#fundo").classList.toggle("oculto", !(DB.ui.lateral && innerWidth < 900)); });
if (innerWidth < 900) DB.ui.lateral = false;
montar();
if (new URLSearchParams(location.search).has("exemplo")) abrirExemplo();
lerEstadoServidor().then(() => procurarPasta(false));
restaurarHandle();
if (DB.ui.audioSempre) setTimeout(ligarAudio, 800);
if ("serviceWorker" in navigator && location.protocol === "https:" || location.hostname === "localhost") navigator.serviceWorker && navigator.serviceWorker.register("sw.js").catch(() => {});
