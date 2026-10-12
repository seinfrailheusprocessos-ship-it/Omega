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
  for (const f of filhos.flat(Infinity)) if (f != null && f !== false) e.append(f.nodeType ? f : document.createTextNode(String(f)));
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
let DB = { rels: {}, atual: null, dic: [], salvoEm: 0, ui: { tema: "maisescuro", lateral: true, avancar: false, audioSempre: false, revisar: true } };
function carregarLocal() {
  try {
    const x = JSON.parse(localStorage.getItem(CHAVE));
    if (x && x.rels) { DB = Object.assign(DB, x); DB.ui = Object.assign({ tema: "maisescuro", lateral: true, avancar: false, audioSempre: false, revisar: true }, x.ui); }
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
const OPC_PAR = ["Pendente", "Aprovado", "Ajustar"];
const OPC_CAP = ["Aprovar capítulo inteiro", "Marcar capítulo para ajustar", "Voltar capítulo a pendente"];
const SIT_DE = { Pendente: "vermelho", Aprovado: "verde", Ajustar: "azul" };
const ROTULO_SIT = { vermelho: "Pendente", verde: "Aprovado", azul: "Ajustar" };
const norm = s => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function arr(x) { return x == null ? [] : Array.isArray(x) ? x.map(String) : [String(x)]; }
function normalizar(d) {
  if (!d || typeof d !== "object" || !Array.isArray(d.secoes)) throw new Error("O arquivo não parece um relatório do Omega (faltam as seções).");
  const pa = d.pasta && typeof d.pasta === "object" ? d.pasta : {};
  const r = { id: String(d.id || "relatorio"), rev: Number(d.rev ?? d.rodada ?? 1) || 1, titulo: String(d.titulo || "Sem título"), atualizado: d.atualizado || "", autor: String(d.autor || "@Morrão"), numero: d.numero != null ? String(d.numero) : "", pasta: { rotulo: String(pa.rotulo || d.rotulo || ""), caminho: String(pa.caminho || ""), drive: String(pa.drive || "") }, secoes: [] };
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
function novaRel(d) { return { dados: d, st: {}, alin: {}, larg: {}, rec: {}, foco: null, notasGeral: [], atualizado: Date.now() }; }
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
  if (v == null || PEND.includes(v) || v === "Pendente") return "pend";
  if (v === "Feito" || v === "Seguir" || v === "Aprovado") return "ok";
  if (v === "Ignorar") return "ign";
  if (v === "Não consegui") return "nao";
  if (v === "Ajustar" || v === "Em análise" || v === "Responder") return "aj";
  if (v === "Respondido") return "ok";
  if (v === "Arquivar") return "ign";
  return "ok";
}
const resolvido = k => k === "ok" || k === "ign";
const acionavel = it => it.tipo === "acao" || it.tipo === "decisao";
function bloqueado(rel, it) {
  return it.dependeDe.some(n => { const d = achar(rel, n); return d && acionavel(d) && !resolvido(kind(valorItem(rel, d))); });
}
function opcoesDe(it) { return it.tipo === "acao" ? OPC_ACAO : (it.opcoes.length ? it.opcoes : OPC_DEC); }

/* focos: {t:"I",num} | {t:"C",num,r,c} | {t:"P",sec,id} | {t:"K",sec,cap} */
function chave(f) { return f.t === "I" ? "I:" + f.num : f.t === "C" ? `C:${f.num}:${f.r}:${f.c}` : f.t === "K" ? `K:${f.sec}:${f.cap}` : f.t === "E" ? `E:${f.id}` : `P:${f.sec}:${f.id}`; }
function celula(it, r, c) { const x = it.tabela && it.tabela.linhas[r] && it.tabela.linhas[r][c]; return x && x.chip ? x.chip : null; }
function secDe(rel, num) { return rel.dados.secoes.find(s => s.num === num); }
function capDe(rel, f) { const s = secDe(rel, f.sec); return s && s.capitulos.find(c => c.num === f.cap); }
function parDe(rel, f) { const s = secDe(rel, f.sec); return s && s.capitulos.flatMap(c => c.paragrafos).find(p => p.id === f.id); }
function alvos(rel) {
  const out = [];
  rel.dados.secoes.forEach(sec => {
    if (sec.tipo === "texto") sec.capitulos.forEach(c => { out.push({ t: "K", sec: sec.num, cap: c.num }); c.paragrafos.forEach(p => out.push({ t: "P", sec: sec.num, id: p.id })); });
    else sec.itens.forEach(it => {
      if (acionavel(it)) out.push({ t: "I", num: it.num });
      if (it.tabela) it.tabela.linhas.forEach((ln, r) => ln.forEach((cel, c) => { if (cel && typeof cel === "object" && cel.chip) out.push({ t: "C", num: it.num, r, c }); }));
    });
  });
  return out;
}
function infoAlvo(rel, f) {
  if (f.t === "E") {
    const e = (rel.entrada || []).find(x => x.id === f.id); if (!e) return null;
    const s = rel.st[chave(f)];
    return { titulo: `Recebido · ${e.arquivo}`, sub: `Páginas: ${e.paginas || "todas"}`, opcoes: OPC_ENT, valor: (s && s.v) || "Pendente", padrao: "Pendente", bloq: false, custom: false };
  }
  if (f.t === "P") {
    const sec = secDe(rel, f.sec), p = parDe(rel, f); if (!p) return null;
    return { titulo: `${f.id} · parágrafo`, sub: textoDe(rel, sec, p), opcoes: OPC_PAR, valor: ROTULO_SIT[sitDe(rel, sec, p)], padrao: "Pendente", bloq: false, custom: false };
  }
  if (f.t === "K") {
    const sec = secDe(rel, f.sec), cap = capDe(rel, f); if (!cap) return null;
    const st = statusCap(rel, sec, cap);
    return { titulo: `${cap.num} · ${cap.titulo}`, sub: "Vale para todos os parágrafos do capítulo", opcoes: OPC_CAP, valor: st.cor === "verde" ? "Aprovado" : st.cor === "azul" ? "Ajustar" : "Pendente", padrao: "Pendente", bloq: false, custom: false };
  }
  const it = achar(rel, f.num); if (!it) return null;
  if (f.t === "I") return { titulo: `${it.num} · ${it.titulo}`, sub: it.texto, opcoes: opcoesDe(it), valor: valorItem(rel, it), padrao: padrao(it), bloq: bloqueado(rel, it), custom: true };
  const ch = celula(it, f.r, f.c); if (!ch) return null;
  const col = it.tabela.colunas[f.c] ? it.tabela.colunas[f.c].nome : "";
  const base = String(it.tabela.linhas[f.r][0] && typeof it.tabela.linhas[f.r][0] !== "object" ? it.tabela.linhas[f.r][0] : "");
  const s = rel.st[chave(f)];
  const opcoes = arr(ch.opcoes).length ? arr(ch.opcoes) : (ch.tipo === "decisao" ? OPC_DEC : OPC_ACAO);
  return { titulo: `${it.num} · ${col}`, sub: `${it.titulo}${base ? " — " + base : ""}`, opcoes, valor: s && s.v != null ? s.v : (ch.valor || "A fazer"), padrao: ch.valor && PEND.includes(ch.valor) ? ch.valor : "A fazer", bloq: false, custom: true };
}
function vizinho(rel, dir, so) {
  const lista = alvos(rel).filter(f => f.t !== "K"); if (!lista.length) return null;
  const atual = rel.foco ? lista.findIndex(f => chave(f) === chave(rel.foco)) : -1;
  for (const incluirBloq of [false, true]) {
    for (let p = 1; p <= lista.length; p++) {
      const i = (((atual < 0 ? (dir > 0 ? -1 : 0) : atual) + dir * p) % lista.length + lista.length) % lista.length;
      const f = lista[i], inf = infoAlvo(rel, f);
      if (inf && kind(inf.valor) === "pend" && (incluirBloq || !inf.bloq) && chave(f) !== (rel.foco ? chave(rel.foco) : "")) return f;
    }
  }
  return null;
}
function contagens(rel) {
  let pend = 0, feitos = 0, bloq = 0;
  alvos(rel).filter(f => f.t !== "K").forEach(f => {
    const inf = infoAlvo(rel, f), k = kind(inf.valor);
    if (resolvido(k)) feitos++; else if (inf.bloq) bloq++; else if (k === "pend" || k === "nao" || k === "aj") pend++;
  });
  return { pend, feitos, bloq };
}
function parSt(rel, sec, p) { return rel.st[`P:${sec.num}:${p.id}`]; }
function sitDe(rel, sec, p) { const s = parSt(rel, sec, p); return (s && s.sit) || p.situacao; }
function textoDe(rel, sec, p) { const s = parSt(rel, sec, p); return s && s.texto != null ? s.texto : p.texto; }
function statusCap(rel, sec, cap) {
  const sits = cap.paragrafos.map(p => sitDe(rel, sec, p));
  const verdes = sits.filter(s => s === "verde").length;
  return { cor: sits.includes("azul") ? "azul" : (sits.length && verdes === sits.length ? "verde" : "vermelho"), verdes, total: sits.length };
}
/* aplica uma escolha (e o comentário, se vier) */
function aplicarValor(rel, f, valor, obs, custom) {
  const k = chave(f), s = stOf(rel, k);
  if (f.t === "P") { s.sit = SIT_DE[valor] || "vermelho"; delete s.viaCap; }
  else if (f.t === "K") {
    const sec = secDe(rel, f.sec), cap = capDe(rel, f), sit = valor === OPC_CAP[0] ? "verde" : valor === OPC_CAP[1] ? "azul" : "vermelho";
    cap.paragrafos.forEach(p => { const ps = stOf(rel, `P:${sec.num}:${p.id}`); ps.sit = sit; ps.tocado = true; ps.viaCap = true; });
    s.v = valor;
  } else { s.v = valor; s.outro = !!custom; }
  s.tocado = true;
  if (obs != null) s.obs = obs;
}

/* ================= estado da interface ================= */
let vista = "rel"; // rel | rev | est | pdf | pastas | colar
let pop = null, refoco = null, buscaQ = "";
let API = { ok: false, raizes: [], scripts: [] };
function relAtual() { return DB.atual && DB.rels[DB.atual] ? DB.rels[DB.atual] : null; }
function remontar() { const y = scrollY; montar(); scrollTo(0, y); }
function marcarFoco(f) {
  document.querySelectorAll(".foco").forEach(e => e.classList.remove("foco"));
  if (f) { const e = document.querySelector(`[data-fk="${CSS.escape(chave(f))}"]`); if (e) e.classList.add("foco"); }
}
function setFoco(f) { const rel = relAtual(); if (!rel) return; rel.foco = f; salvar(); marcarFoco(f); }
function focarAlvo(f) {
  const e = document.querySelector(`[data-chip="${CSS.escape(chave(f))}"]`); if (!e) return false;
  e.focus(); e.scrollIntoView({ block: "center", behavior: "smooth" }); return true;
}

/* ================= montagem ================= */
function aplicarTema() {
  document.documentElement.dataset.tema = DB.ui.tema;
  document.body.classList.toggle("lat", !!DB.ui.lateral);
  $("#fundo").classList.toggle("oculto", !(DB.ui.lateral && innerWidth < 900));
}
function montar() {
  aplicarTema();
  const m = $("#main"); m.replaceChildren(); m.className = vista === "mesa" ? "larga" : "";
  const rel = relAtual();
  desenharLateral();
  if (vista === "rev") telaRevisor(m);
  else if (vista === "est") telaEstado(m);
  else if (vista === "pdf") telaPDF(m);
  else if (vista === "mesa") telaMesa(m);
  else if (vista === "pastas") telaPastas(m);
  else if (vista === "colar") telaColar(m);
  else if (!rel) telaInicio(m);
  else telaRelatorio(m, rel);
  atualizarContador();
  ajustarTabelas();
  if (rel && rel.foco && vista === "rel") marcarFoco(rel.foco);
  if (refoco) { const e = document.querySelector(refoco); refoco = null; if (e) e.focus({ preventScroll: false }); }
  if (vista === "rel" && rel && DB.ui.revisar && temTexto(rel) && DICSTATE === "nao") carregarDic(() => { if (DICSTATE === "ok") remontar(); });
}
function temTexto(rel) { return rel.dados.secoes.some(s => s.tipo === "texto"); }
function atualizarContador() {
  const rel = relAtual(), c = $("#cont"); if (!c) return;
  if (!rel || vista !== "rel") { c.textContent = "Abra um relatório para ver o contador."; return; }
  const n = contagens(rel);
  c.replaceChildren(h("b", {}, n.pend), " pendentes · ", h("b", {}, n.feitos), " decididos · ", h("b", {}, n.bloq), " bloqueados");
}
$("#b-lat").onclick = () => { DB.ui.lateral = !DB.ui.lateral; salvar(); aplicarTema(); };
$("#fundo").onclick = () => { DB.ui.lateral = false; salvar(); aplicarTema(); };
const movel = () => /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
function nomeRel(r, i) { return `${r.dados.numero || (i != null ? i + 1 : "")} ${r.dados.pasta.rotulo || r.dados.titulo}`.trim(); }
function idsOrdenados() { return Object.keys(DB.rels).sort((a, b) => (parseFloat(DB.rels[a].dados.numero) || 1e9) - (parseFloat(DB.rels[b].dados.numero) || 1e9) || DB.rels[a].atualizado - DB.rels[b].atualizado); }
async function abrirPasta(rel) {
  const p = rel.dados.pasta || {};
  if (movel()) { if (p.drive) window.open(p.drive, "_blank", "noopener"); else aviso("Este relatório não tem link do Drive. Peça ao Claude para incluir pasta.drive no relatório."); return; }
  if (!p.caminho) { aviso("Este relatório não informa a pasta (campo pasta.caminho)."); return; }
  if (/^https?:$/.test(location.protocol)) {
    try { const r = await fetch("api/abrir-pasta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caminho: p.caminho }) }); if (r.ok) { aviso("Abrindo a pasta no Explorador…"); return; } } catch (e) {}
  }
  const ok = await copiar(p.caminho);
  aviso(ok ? "Caminho copiado. No Explorador (Win+E) cole na barra de endereço e tecle Enter. Pelo Iniciar Omega.bat abre direto." : "Caminho: " + p.caminho);
}
function abrirConversa(id) {
  const r = DB.rels[id]; if (!r) return;
  if (r.conversa) { window.open(r.conversa, "_blank", "noopener"); return; }
  DB.atual = id; vista = "rel"; DB.ui.lateral = true; salvar(); montar();
  const i = $("#in-conv"); if (i) i.focus();
  aviso("Cole o link da conversa deste relatório no campo da lateral e tecle Enter.");
}
function abrirRelatorio(id, num, par) {
  DB.atual = id; vista = "rel"; salvar(); montar(); scrollTo(0, 0);
  if (num) setTimeout(() => irPara(num), 30);
  if (par) setTimeout(() => { const e = document.querySelector(`[data-fk="${CSS.escape(par)}"]`); if (e) { e.scrollIntoView({ block: "center", behavior: "smooth" }); e.classList.add("alvo"); const pf = e.querySelector("[data-pf]"); if (pf) pf.focus(); } }, 30);
  fecharLateralPequena();
}

/* ---- barra lateral: busca por número/nome e atalhos ---- */
function resultadosBusca(q) {
  const toks = norm(q).split(/\s+/).filter(Boolean); if (!toks.length) return null;
  const res = { rels: [], itens: [] };
  idsOrdenados().forEach(id => {
    const r = DB.rels[id], nome = norm(nomeRel(r) + " " + r.dados.titulo + " " + r.dados.id), casa = toks.every(t => nome.includes(t));
    if (casa) res.rels.push(id);
    r.dados.secoes.forEach(sec => {
      if (sec.tipo === "texto") sec.capitulos.forEach(c => c.paragrafos.forEach(p => {
        const hay = norm(p.id + " " + textoDe(r, sec, p) + " " + c.titulo);
        if (toks.every(t => hay.includes(t)) || (casa && sitDe(r, sec, p) !== "verde")) res.itens.push({ id, rotulo: nomeRel(r), num: p.id, titulo: textoDe(r, sec, p).slice(0, 70), par: `P:${sec.num}:${p.id}`, st: ROTULO_SIT[sitDe(r, sec, p)] });
      }));
      else sec.itens.forEach(it => {
        const hay = norm(it.num + " " + it.titulo + " " + it.texto), v = valorItem(r, it), pendente = acionavel(it) && !resolvido(kind(v));
        if (toks.every(t => hay.includes(t)) || (casa && pendente)) res.itens.push({ id, rotulo: nomeRel(r), num: it.num, titulo: it.titulo, st: v || "" });
      });
    });
  });
  res.itens = res.itens.slice(0, 80);
  return res;
}
let tPastas = null;
function desenharBusca() {
  const box = $("#busca-res"); if (!box) return;
  box.replaceChildren();
  const res = resultadosBusca(buscaQ);
  if (!res) return;
  if (res.rels.length) { box.append(h("h4", {}, "Relatórios")); res.rels.forEach(id => box.append(h("button", { class: "lat-bt res", onclick: () => abrirRelatorio(id) }, nomeRel(DB.rels[id])))); }
  if (res.itens.length) { box.append(h("h4", {}, `Itens (${res.itens.length})`)); res.itens.forEach(x => box.append(h("button", { class: "lat-bt res", onclick: () => abrirRelatorio(x.id, x.par ? null : x.num, x.par) }, h("span", { class: "rn" }, x.num), h("span", { class: "rt" }, x.titulo || "(sem título)"), h("span", { class: "rs" }, x.st + (res.rels.length !== 1 ? " · " + x.rotulo : "")))));}
  if (!res.rels.length && !res.itens.length) box.append(h("p", { class: "suave", style: "padding:4px 8px" }, "Nada encontrado nos relatórios."));
  if (API.ok && buscaQ.trim().length >= 2) {
    const pb = h("div", { id: "res-pastas" }); box.append(pb);
    clearTimeout(tPastas);
    tPastas = setTimeout(async () => {
      try {
        const lista = await (await fetch("api/pastas?q=" + encodeURIComponent(buscaQ))).json();
        if (!lista.length) return;
        pb.append(h("h4", {}, "Pastas e arquivos do computador"));
        lista.forEach(x => pb.append(h("button", { class: "lat-bt res", onclick: () => { x.dir ? abrirPastaView(x.caminho) : abrirArquivoView(x.caminho); fecharLateralPequena(); } }, h("span", { class: "rn" }, x.dir ? "📁" : "📄"), h("span", { class: "rt" }, x.nome), h("span", { class: "rs" }, x.caminho))));
      } catch (e) {}
    }, 250);
  }
}
function desenharLateral() {
  const L = $("#lateral"), sy = L.scrollTop, tinhaFoco = document.activeElement && document.activeElement.id === "busca"; L.replaceChildren();
  const rel = relAtual();
  L.append(h("div", { class: "lat-topo" }, h("span", { class: "marca" }, "Omega")));
  const busca = h("input", { id: "busca", type: "search", placeholder: "Buscar por número ou nome…  ( / )", "aria-label": "Buscar", autocomplete: "off",
    oninput: e => { buscaQ = e.target.value; desenharBusca(); },
    onkeydown: e => { if (e.key === "Enter") { const b = $("#busca-res .res"); if (b) b.click(); } else if (e.key === "ArrowDown") { const b = $("#busca-res .res"); if (b) { e.preventDefault(); b.focus(); } } else if (e.key === "Escape") { buscaQ = ""; e.target.value = ""; desenharBusca(); } } });
  busca.value = buscaQ;
  L.append(h("div", { class: "busca-caixa" }, busca), h("div", { id: "busca-res" }));
  L.append(h("h4", {}, "Relatórios"));
  const ids = idsOrdenados();
  if (!ids.length) L.append(h("p", { class: "suave", style: "padding:0 8px" }, "Nenhum ainda."));
  ids.forEach((id, i) => {
    const r = DB.rels[id], n = contagens(r), sel = id === DB.atual && vista === "rel";
    L.append(h("div", { class: "caixa-l" + (sel ? " sel" : "") },
      h("button", { class: "caixinha", onclick: () => { DB.atual = id; vista = "rel"; salvar(); montar(); scrollTo(0, 0); fecharLateralPequena(); } }, h("span", { class: "n" }, nomeRel(r, i)), h("span", { class: "c" }, n.pend || "✓")),
      h("button", { class: "ico", title: "Arquivos: abrir a pasta deste relatório", "aria-label": "Arquivos", onclick: () => abrirPasta(r) }, "📁"),
      h("button", { class: "ico" + (r.conversa ? " tem" : ""), title: r.conversa ? "Ir para a conversa (copia a mensagem e salva o retorno na pasta)" : "Colar o link da conversa", "aria-label": "Conversa", onclick: () => irConversa(id) }, "💬")));
  });
  if (rel) {
    const inp = h("input", { id: "in-conv", type: "url", placeholder: "Link da conversa deste relatório", "aria-label": "Link da conversa", onchange: e => {
      const v = e.target.value.trim();
      if (v && !/^https?:\/\//i.test(v)) { aviso("O link precisa começar com https://"); return; }
      rel.conversa = v; salvar(); aviso(v ? "Link da conversa salvo." : "Link da conversa removido."); desenharLateral();
    } });
    inp.value = rel.conversa || "";
    const msg = h("input", { id: "in-msg", type: "text", placeholder: "Mensagem ao ir para a conversa (padrão: Leia o relatório de retorno…)", "aria-label": "Mensagem para a conversa", onchange: e => { rel.msg = e.target.value.trim(); salvar(); } });
    msg.value = rel.msg || "";
    L.append(h("div", { class: "conv" }, inp, h("button", { class: "mini", onclick: () => irConversa(DB.atual) }, "Ir")), h("div", { class: "conv" }, msg));
  }
  const acao = (txt, ic, fn, on, attr) => h("button", Object.assign({ class: "lat-bt" + (on ? " on" : ""), onclick: fn }, attr || {}), h("span", { class: "ic" }, ic), txt);
  L.append(h("h4", {}, "Copiar"));
  L.append(acao("Copiar relatório", "⧉", () => { copiarSaida(false); fecharLateralPequena(); }, false, { id: "b-cop", title: "Só as decisões e os comentários" }),
    acao("Copiar item em foco", "◎", () => { copiarSaida(true); fecharLateralPequena(); }, false, { id: "b-copf" }),
    acao("Copiar relatório inteiro", "▤", () => { copiarInteiro(); fecharLateralPequena(); }),
    acao("Copiar tudo e enviar relatório", "➤", () => { copiarTudoEnviar(); fecharLateralPequena(); }, false, { id: "b-env" }));
  L.append(h("h4", {}, "Texto"));
  L.append(acao("Revisar texto", "✎", () => { DB.ui.revisar = !DB.ui.revisar; salvar(); remontar(); aviso(DB.ui.revisar ? "Revisão de texto ligada." : "Revisão de texto desligada."); }, DB.ui.revisar, { id: "b-rev" }),
    acao("Áudio (ditado)", "🎙", () => alternarAudio(), audioOn, { id: "b-aud", "data-aud": "1" }),
    acao("Novo objeto", "＋", () => { novoObjeto(); fecharLateralPequena(); }, false, { id: "b-novo-obj" }),
    acao("Novo documento", "▭", () => { novoDocumento(); fecharLateralPequena(); }),
    acao("Mesa PDF", "📄", () => { abrirMesaLocal(); }, false, { id: "b-mesa" }),
    acao("Pastas do computador", "🗂", () => { abrirPastaView(null); fecharLateralPequena(); }));
  L.append(h("h4", {}, "Conversa e e-mail"));
  L.append(acao("Claude (nova conversa)", "✦", () => { window.open(URLS.claude, "_blank", "noopener"); fecharLateralPequena(); }),
    acao("Gemini (nova conversa)", "✧", () => { window.open(URLS.gemini, "_blank", "noopener"); fecharLateralPequena(); }),
    acao("Gmail", "✉", () => { window.open("https://mail.google.com/", "_blank", "noopener"); fecharLateralPequena(); }, false, { id: "b-gmail" }));
  L.append(h("h4", {}, "Iluminação"));
  L.append(h("div", { class: "seg" }, [["claro", "Claro"], ["escuro", "Escuro"], ["maisescuro", "Mais escuro"]].map(([k, t]) => h("button", { class: DB.ui.tema === k ? "on" : "", "data-tema": k, onclick: () => { DB.ui.tema = k; salvar(); aplicarTema(); desenharLateral(); } }, t))));
  L.append(h("h4", {}, "Contador"), h("div", { id: "cont", class: "contador" }));
  L.append(h("h4", {}, "Abrir relatório"));
  L.append(h("button", { class: "lat-bt", onclick: () => $("#arq").click() }, "Abrir arquivo .json"),
    h("button", { class: "lat-bt", onclick: () => { vista = "colar"; montar(); fecharLateralPequena(); } }, "Colar relatório"),
    h("button", { class: "lat-bt", onclick: acompanharArquivo }, "Acompanhar arquivo (Chrome)"),
    h("button", { class: "lat-bt", onclick: () => { servidorOk = null; procurarPasta(true); } }, "Procurar na pasta dados"),
    h("button", { class: "lat-bt", onclick: abrirExemplo }, "Ver exemplo"));
  L.append(h("h4", {}, "Ferramentas"));
  L.append(h("button", { class: "lat-bt", onclick: () => { vista = "rev"; montar(); fecharLateralPequena(); } }, "Revisor de texto livre"),
    h("button", { class: "lat-bt", onclick: () => { vista = "est"; montar(); fecharLateralPequena(); } }, "Levar estado para outro aparelho"));
  L.append(h("h4", {}, "Ajustes"));
  [["avancar", "Depois de escolher, ir para o próximo pendente"], ["audioSempre", "Áudio sempre ligado"], ["revisar", "Revisar texto ao abrir capítulo"]].forEach(([k, t]) => {
    const c = h("input", { type: "checkbox", onchange: e => { DB.ui[k] = e.target.checked; salvar(); if (k === "audioSempre" && e.target.checked && !audioOn) ligarAudio(); if (k === "revisar") remontar(); } });
    c.checked = !!DB.ui[k]; L.append(h("label", { class: "lat-chk" }, c, t));
  });
  L.scrollTop = sy;
  desenharBusca();
  if (tinhaFoco) { busca.focus(); const n = busca.value.length; try { busca.setSelectionRange(n, n); } catch (e) {} }
}
/* abrir a lateral deslizando da borda esquerda (celular) e fechar deslizando para a esquerda */
let sw = null;
document.addEventListener("touchstart", e => { const t = e.touches[0]; sw = { x: t.clientX, y: t.clientY, aberto: !!DB.ui.lateral }; }, { passive: true });
document.addEventListener("touchmove", e => {
  if (!sw || innerWidth >= 900) return;
  const t = e.touches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y;
  if (Math.abs(dy) > Math.abs(dx)) return;
  if (!sw.aberto && sw.x < 30 && dx > 60) { DB.ui.lateral = true; salvar(); aplicarTema(); sw = null; }
  else if (sw.aberto && dx < -60) { DB.ui.lateral = false; salvar(); aplicarTema(); sw = null; }
}, { passive: true });
function fecharLateralPequena() { if (innerWidth < 900) { DB.ui.lateral = false; aplicarTema(); } }

function telaInicio(m) {
  m.append(h("h1", {}, "Omega"),
    h("p", { class: "suave just" }, "Leitor e decisor de relatórios. Abra o relatório que o Claude gerou (arquivo relatorio.json) ou cole o texto dele. Tudo o que você decidir fica salvo neste aparelho."),
    h("div", { class: "linha" },
      h("button", { class: "btn", onclick: () => $("#arq").click() }, "Abrir relatório"),
      h("button", { class: "btn sec", onclick: () => { vista = "colar"; montar(); } }, "Colar relatório"),
      h("button", { class: "btn sec", onclick: abrirExemplo }, "Ver exemplo")));
}
$("#arq").onchange = async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try { carregarRelatorio(JSON.parse(await f.text())); } catch (er) { aviso("Erro: " + er.message); }
};
function telaColar(m) {
  const ta = h("textarea", { class: "livre", placeholder: "Cole aqui o texto do relatório (começa com {)", style: "min-height:280px" });
  m.append(h("h1", {}, "Colar relatório"), ta, h("div", { class: "linha" },
    h("button", { class: "btn", onclick: () => { try { carregarRelatorio(JSON.parse(ta.value)); } catch (er) { aviso("Não entendi o texto: " + er.message); } } }, "Abrir"),
    h("button", { class: "btn sec", onclick: () => { vista = "rel"; montar(); } }, "Voltar")));
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
function dataExtenso(iso) {
  const d = iso ? new Date(iso) : new Date();
  return isNaN(d) ? "sem data" : d.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" }).replace(/^(\d+) (\S+?)\.? de (\d+)$/, "$1 de $2. de $3");
}
function telaRelatorio(m, rel) {
  const d = rel.dados;
  m.append(h("h1", {}, nomeRel(rel) || d.titulo),
    h("p", { class: "sub-titulo" }, d.titulo),
    h("div", { class: "autoria" }, "Eu ", h("span", { class: "pilula" }, "▫ " + dataExtenso(d.atualizado)), " · ", h("span", { class: "pilula" }, d.autor), h("span", { class: "pilula suave" }, `rev ${d.rev}`)));
  if (!d.secoes.length) m.append(h("div", { class: "cartao" }, h("p", { style: "margin:0 0 .5em" }, h("b", {}, "Objeto novo. "), "Ainda não há relatório do Claude. Suba arquivos, use a Mesa PDF ou peça o relatório ao Claude usando este id:"), h("div", { class: "cam" }, h("code", {}, d.id), h("button", { class: "mini", tabindex: "-1", onclick: async () => { (await copiar(d.id)) ? aviso("Id copiado.") : caixaCopia(d.id, "Id"); } }, "Copiar id"))));
  const pa = painelArquivos(rel); if (pa) m.append(pa);
  const rc = tabelaRecebidos(rel); if (rc) m.append(rc);
  d.secoes.forEach(sec => {
    const aberto = !rel.rec[sec.num];
    const el = h("section", { class: "sec" + (aberto ? "" : " rec"), id: "sec-" + sec.num });
    let res = 0, tot = 0;
    const corpo = h("div", { class: "sec-b" });
    if (sec.tipo === "texto") {
      sec.capitulos.forEach(c => { const s = statusCap(rel, sec, c); res += s.verdes; tot += s.total; corpo.append(capituloEl(rel, sec, c)); });
    } else {
      sec.itens.forEach(it => { if (acionavel(it)) { tot++; if (resolvido(kind(valorItem(rel, it)))) res++; } });
      corpo.append(tabelaItens(rel, sec));
    }
    const acoes = sec.tipo === "texto" ? [
      h("button", { class: "mini", tabindex: "-1", onclick: () => revisarTudo(rel, sec) }, "Revisar tudo"),
      h("button", { class: "mini", tabindex: "-1", onclick: () => previaImpressao(rel, sec) }, "Visualizar impressão"),
      h("button", { class: "mini", tabindex: "-1", onclick: () => copiarTexto(textoSecao(rel, sec), "Texto inteiro copiado.") }, "Copiar texto inteiro")] : [];
    el.append(h("div", { class: "sec-hl" },
      h("button", { class: "sec-h", tabindex: "-1", onclick: () => { rel.rec[sec.num] = aberto; salvar(); remontar(); } }, h("span", { class: "seta" }, "▾"), h("h2", { class: "n" }, sec.titulo || sec.num)), acoes),
      corpo, h("div", { class: "sec-f sec-b" }, `${res} de ${tot} resolvidos`));
    m.append(el);
  });
}
/* chip = a caixinha azul "A fazer ▾": Tab chega nela, Espaço/Enter/↓ abrem as opções */
function chipEl(f, valor, extra) {
  const key = chave(f);
  const b = h("button", { class: `chip ${kind(valor)}${extra ? " " + extra : ""}`, "data-chip": key, "aria-haspopup": "listbox", title: "Espaço ou Enter abre as opções",
    onclick: e => { e.stopPropagation(); abrirPop(f, b); },
    onkeydown: e => { if (e.key === "ArrowDown") { e.preventDefault(); abrirPop(f, b); } },
    onfocus: () => { const rel = relAtual(); if (rel) { rel.foco = f; marcarFoco(f); } } });
  if (f.t === "P") { const rel = relAtual(), sec = secDe(rel, f.sec), p = parDe(rel, f); b.append(h("i", { class: "pb " + sitDe(rel, sec, p) })); }
  b.append(valor);
  return b;
}
function ligacoes(nums) {
  const sp = h("span", { class: "rel-l" });
  if (!nums.length) { sp.append("Nada"); return sp; }
  nums.forEach((n, i) => { if (i) sp.append(", "); sp.append(h("a", { onclick: () => irPara(n) }, n)); });
  return sp;
}
/* o relatório é uma tabela de linhas transparentes: Item | O que fazer | Depende de | Bloqueia | Escolha */
function tabelaItens(rel, sec) {
  const tb = h("tbody", {});
  sec.itens.forEach(it => {
    const v = valorItem(rel, it), k = kind(v), bloq = acionavel(it) && bloqueado(rel, it), f = { t: "I", num: it.num }, st = rel.st["I:" + it.num] || {};
    const txt = h("td", { "data-label": "O que fazer", class: "c-texto" });
    if (it.texto) txt.append(h("div", { class: "just" }, it.texto));
    it.caminhos.forEach(c => txt.append(h("div", { class: "cam" }, h("code", {}, c), h("button", { class: "mini", tabindex: "-1", onclick: async ev => { ev.stopPropagation(); (await copiar(c)) ? aviso("Caminho copiado.") : caixaCopia(c, "Caminho"); } }, "Copiar"))));
    if (bloq) txt.append(h("div", { class: "aviso-dep" }, "Aguardando o item de que depende."));
    if (st.obs) txt.append(h("div", { class: "comentario" }, h("b", {}, "Comentário: "), st.obs));
    txt.append(notasEl(rel, "I:" + it.num));
    const esc = h("td", { "data-label": "Escolha", class: "c-esc" });
    if (acionavel(it)) esc.append("(", chipEl(f, v), ")"); else esc.append("—");
    tb.append(h("tr", { class: "item" + (bloq ? " bloq" : "") + (k === "ign" ? " ign" : "") + (k === "ok" ? " feito" : ""), id: "it-" + it.num.replace(/[^\w-]/g, "_"), "data-fk": chave(f), onclick: ev => { if (!ev.target.closest("button,a,table")) setFoco(f); } },
      h("td", { "data-label": "Item", class: "c-item" }, h("b", {}, it.num), " ", it.titulo || "(sem título)"),
      txt,
      h("td", { "data-label": "Depende de", class: "c-dep" }, ligacoes(it.dependeDe)),
      h("td", { "data-label": "Bloqueia", class: "c-blq" }, ligacoes(it.bloqueia)),
      esc));
    if (it.tabela) tb.append(h("tr", { class: "subtab" }, h("td", { colspan: "5" }, tabelaEl(rel, it))));
  });
  return h("table", { class: "rel" }, h("thead", {}, h("tr", {}, ["Item", "O que fazer", "Depende de", "Bloqueia", "Escolha"].map(t => h("th", {}, t)))), tb);
}
function notasEl(rel, k) {
  const s = rel.st[k]; if (!s || !s.notas || !s.notas.length) return h("span");
  return h("div", { class: "notas" }, s.notas.map((t, i) => h("div", { class: "nota" }, h("span", {}, "🎙"), h("span", { style: "flex:1" }, t), h("button", { tabindex: "-1", title: "Apagar nota", onclick: ev => { ev.stopPropagation(); s.notas.splice(i, 1); salvar(); remontar(); } }, "×"))));
}
function irPara(num) {
  const rel = relAtual(); if (!rel) return;
  const id = "it-" + num.replace(/[^\w-]/g, "_");
  let el = document.getElementById(id);
  if (el) { const sec = el.closest(".sec"); if (sec && sec.classList.contains("rec")) { rel.rec[sec.id.replace("sec-", "")] = false; salvar(); remontar(); el = document.getElementById(id); } }
  if (!el) { aviso("Item " + num + " não encontrado."); return; }
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove("alvo"); void el.offsetWidth; el.classList.add("alvo");
}

/* ---- tabelas reais do relatório (com linhas visíveis, como no Word) ---- */
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
  const media = cel.reduce((a, x) => a + String(x && typeof x === "object" ? "" : x).length, 0) / (cel.length || 1);
  return media > 45 ? "justify" : "left";
}
function tabelaEl(rel, it) {
  const t = it.tabela, hs = hashTxt(JSON.stringify(t));
  let L = rel.larg[it.num]; if (!L || L.h !== hs) L = rel.larg[it.num] = { h: hs, w: {} };
  const alinDe = j => rel.alin[`${it.num}|${j}`] || (t.colunas[j] && t.colunas[j].alin) || alinPadrao(it, j);
  const tr = h("tr", {});
  t.colunas.forEach((c, j) => {
    const a = alinDe(j), th = h("th", { style: L.w[j] ? `width:${L.w[j]}px` : null });
    th.append(h("div", {}, c.nome), h("div", { class: "alins" }, ["left", "center", "right", "justify"].map(x => h("button", { tabindex: "-1", class: x === a ? "on" : "", title: { left: "Esquerda", center: "Centralizado", right: "Direita", justify: "Justificado" }[x], onclick: ev => { ev.stopPropagation(); rel.alin[`${it.num}|${j}`] = x; salvar(); remontar(); } }, icoAlin(x)))));
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
        td.append(chipEl(f, s && s.v != null ? s.v : (x.chip.valor || "A fazer")));
        if (s && s.obs) td.append(h("div", { class: "comentario" }, s.obs));
      } else if (x && typeof x === "object" && x.caminho) {
        td.append(h("code", { class: "cod" }, x.caminho), " ", h("button", { class: "mini", tabindex: "-1", onclick: async () => { (await copiar(x.caminho)) ? aviso("Caminho copiado.") : caixaCopia(x.caminho, "Caminho"); } }, "Copiar"));
      } else td.append(x == null ? "" : String(x && x.texto != null ? x.texto : x));
      row.append(td);
    });
    corpo.append(row);
  });
  return h("div", { class: "tabs" }, h("table", { class: "tab" }, h("thead", {}, tr), corpo),
    h("div", { class: "tab-ferr" }, h("button", { class: "mini", tabindex: "-1", onclick: () => { rel.larg[it.num] = { h: hs, w: {} }; salvar(); remontar(); } }, "Ajustar tabela")));
}
function ajustarTabelas() {
  document.querySelectorAll(".tabs").forEach(box => {
    const t = box.querySelector("table.tab"), cols = t.querySelectorAll("thead th").length || 1;
    t.classList.remove("cartoes");
    const cart = box.clientWidth / cols < 115;
    t.classList.toggle("cartoes", cart); box.classList.toggle("cart", cart);
  });
}

/* ---- documentos (modo Texto): cada parágrafo é um campo, como num formulário do Word ---- */
function capituloEl(rel, sec, cap) {
  const ck = `cap-${sec.num}-${cap.num}`, aberto = !rel.rec[ck], s = statusCap(rel, sec, cap), fk = { t: "K", sec: sec.num, cap: cap.num };
  const rotuloCap = s.cor === "verde" ? "Aprovado" : s.cor === "azul" ? "Ajustar" : "Pendente";
  const kst = rel.st[chave(fk)] || {};
  const tb = h("table", { class: "tex" }, h("thead", {}, h("tr", {}, h("th", {}, "Tópico / parágrafo"), h("th", { class: "col-s" }, "Situação"))), h("tbody", {}, cap.paragrafos.map(p => paragrafoEl(rel, sec, p))));
  return h("div", { class: "capitulo" + (aberto ? "" : " rec"), "data-fk": chave(fk) },
    h("div", { class: "cap-hl" },
      h("button", { class: "cap-h", tabindex: "-1", onclick: () => { rel.rec[ck] = aberto; salvar(); remontar(); } }, h("span", { class: "seta" }, "▾"), h("span", { class: "n" }, `${cap.num} ${cap.titulo}`), h("span", { class: "suave", style: "font-size:13px" }, `${s.verdes} de ${s.total}`)),
      "Capítulo: ", chipEl(fk, rotuloCap, "cap"),
      h("button", { class: "mini", tabindex: "-1", onclick: () => copiarTexto(textoCapitulo(rel, sec, cap), "Capítulo copiado.") }, "Copiar capítulo")),
    kst.obs ? h("div", { class: "comentario", style: "padding:6px 14px" }, h("b", {}, "Comentário: "), kst.obs) : null,
    h("div", { class: "cap-b" }, tb));
}
function paragrafoEl(rel, sec, p) {
  const f = { t: "P", sec: sec.num, id: p.id }, k = chave(f), st = rel.st[k] || {}, sit = sitDe(rel, sec, p), txt = textoDe(rel, sec, p);
  const campo = h("div", { class: "ptexto", tabindex: "0", "data-pf": k, role: "textbox", "aria-label": `Parágrafo ${p.id}. Enter para editar.`,
    onfocus: () => { rel.foco = f; marcarFoco(f); },
    onkeydown: ev => { if (campo.isContentEditable) return; if (ev.key === "Enter" || ev.key === "F2") { ev.preventDefault(); editarPar(campo, rel, sec, p); } } });
  renderTexto(campo, txt, novo => alterarPar(rel, sec, p, novo));
  const mic = h("button", { class: "mic" + (audioOn && rel.foco && chave(rel.foco) === k ? " gravando" : ""), tabindex: "-1", title: "Ditar uma nota para este parágrafo", onclick: e => { e.stopPropagation(); setFoco(f); alternarAudio(); } }, "🎙");
  const tdT = h("td", {}, h("div", { class: "pid" }, p.id, st.alterado ? h("span", { class: "alt" }, "alterado por você") : null, h("button", { class: "mini", tabindex: "-1", onclick: ev => { ev.stopPropagation(); copiarTexto(textoDe(rel, sec, p), "Parágrafo copiado."); } }, "Copiar parágrafo")), campo,
    st.obs ? h("div", { class: "comentario" }, h("b", {}, "Comentário: "), st.obs) : null, notasEl(rel, k));
  if (DB.ui.revisar && rel.foco && chave(rel.foco) === k) tdT.append(h("div", { class: "rev-acoes" }, h("a", { onclick: async () => { const t = PERGUNTA + "\n\n" + textoDe(rel, sec, p); const ok = await copiar(t); window.open(URLS.gemini, "_blank", "noopener"); ok ? aviso("Copiado, cole no Gemini") : caixaCopia(t, "Texto para o Gemini"); } }, "Revisar no Gemini")));
  const tr = h("tr", { "data-fk": k, onclick: ev => { if (!ev.target.closest("button,a")) { const antes = rel.foco && chave(rel.foco); setFoco(f); if (DB.ui.revisar && antes !== k) remontar(); } } }, tdT, h("td", { class: "col-s" }, chipEl(f, ROTULO_SIT[sit]), mic));
  campo.addEventListener("dblclick", () => editarPar(campo, rel, sec, p));
  let ult = 0;
  campo.addEventListener("pointerup", ev => { if (ev.pointerType === "mouse") return; const t = Date.now(); if (t - ult < 350) editarPar(campo, rel, sec, p); ult = t; });
  return tr;
}
function editarPar(el, rel, sec, p) {
  if (el.isContentEditable) return;
  const original = textoDe(rel, sec, p), k = `P:${sec.num}:${p.id}`;
  el.textContent = original;
  try { el.contentEditable = "plaintext-only"; } catch (e) {}
  if (!el.isContentEditable) el.contentEditable = "true";
  el.focus();
  const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  let cancel = false;
  el.addEventListener("keydown", ev => { if (ev.key === "Escape") { cancel = true; el.blur(); } else if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); el.blur(); } });
  el.addEventListener("blur", () => {
    el.removeAttribute("contenteditable");
    const novo = el.innerText.replace(/ /g, " ").replace(/\n+$/g, "");
    refoco = `[data-pf="${k}"]`;
    if (!cancel && novo !== original) alterarPar(rel, sec, p, novo); else remontar();
  }, { once: true });
}
function alterarPar(rel, sec, p, novo) {
  const k = `P:${sec.num}:${p.id}`, s = stOf(rel, k);
  if (!s.alterado) s.base = p.texto;
  s.texto = novo; s.alterado = true; s.sit = "azul"; s.tocado = true; delete s.viaCap; rel.foco = { t: "P", sec: sec.num, id: p.id };
  if (!refoco) refoco = `[data-pf="${k}"]`;
  salvar(); remontar();
}

/* ================= caixa de opções (o "dropdown" do chip) ================= */
const COR_OPC = { "A fazer": "#4a90e2", "Aguardando": "#4a90e2", "Feito": "#1f9d6b", "Seguir": "#1f9d6b", "Ignorar": "#2e9c3a", "Não consegui": "#f0a020", "Pendente": "#d6453d", "Aprovado": "#2f8f4e", "Ajustar": "#3f6fd1", "Em análise": "#4a90e2", "Responder": "#3f6fd1", "Respondido": "#2f8f4e", "Arquivar": "#8a8f98" };
function corOpcao(o, f) {
  if (f.t === "K") return o === OPC_CAP[0] ? "#2f8f4e" : o === OPC_CAP[1] ? "#3f6fd1" : "#d6453d";
  return COR_OPC[o] || "#1f9d6b";
}
function abrirPop(f, ancora) {
  const rel = relAtual(); if (!rel) return;
  const inf = infoAlvo(rel, f); if (!inf) return;
  fecharPop(false);
  rel.foco = f; marcarFoco(f);
  const s = rel.st[chave(f)] || {};
  pop = { f, inf, ancora, q: "", hl: Math.max(0, inf.opcoes.indexOf(inf.valor)), itens: [] };
  const P = $("#painel"); P.replaceChildren(); P.className = "aberto"; P.setAttribute("role", "dialog");
  const q = h("input", { id: "pop-q", type: "text", placeholder: "Procurar ou adicionar opção…", "aria-label": "Procurar ou adicionar opção", autocomplete: "off", oninput: e => { pop.q = e.target.value; pop.hl = 0; listar(); } });
  const lista = h("div", { class: "pop-ops", role: "listbox" });
  const com = h("textarea", { id: "pop-com", placeholder: "Escreva um comentário (opcional)…", rows: "2", "aria-label": "Comentário" }); com.value = s.obs || "";
  const mic = h("button", { id: "pop-mic", class: "mini", type: "button", title: "Ditar o comentário", onclick: () => { audioOn && audioAlvo === com ? desligarAudio() : (desligarAudio(), ligarAudio(com)); } }, "🎙 Ditar");
  P.append(h("div", { class: "pop-cab" }, h("b", {}, inf.titulo), inf.sub ? h("span", {}, inf.sub.length > 90 ? inf.sub.slice(0, 90) + "…" : inf.sub) : null),
    h("div", { class: "pop-busca" }, h("span", { class: "lupa" }, "⌕"), q), lista, h("div", { class: "pop-sep" }),
    h("div", { class: "pop-com" }, com, h("div", { class: "pop-com-b" }, mic, h("span", { class: "suave" }, "Enter salva só o comentário"))),
    h("div", { class: "pop-rod" }, h("span", { class: "suave" }, "↑↓ escolhe · Enter confirma · Esc fecha"), kind(inf.valor) !== "pend" || s.obs ? h("a", { onclick: () => escolherDoPop({ valor: inf.padrao, limpar: true }) }, "Limpar") : null));
  function listar() {
    const t = norm(pop.q.trim());
    pop.itens = inf.opcoes.filter(o => !t || norm(o).includes(t)).map(o => ({ valor: o }));
    if (inf.custom && pop.q.trim() && !inf.opcoes.some(o => norm(o) === t)) pop.itens.push({ add: pop.q.trim() });
    pop.hl = Math.min(pop.hl, Math.max(0, pop.itens.length - 1));
    lista.replaceChildren();
    pop.itens.forEach((it, i) => lista.append(h("button", { type: "button", tabindex: "-1", role: "option", class: "pop-op" + (i === pop.hl ? " hl" : ""), "aria-selected": it.valor === inf.valor ? "true" : "false",
      onmousedown: e => e.preventDefault(), onclick: () => escolherDoPop(it) },
      h("i", { class: "pd", style: `background:${it.add != null ? "#8a8f98" : corOpcao(it.valor, f)}` }), h("span", { class: "pl" }, it.add != null ? `Adicionar “${it.add}”` : it.valor), it.valor === inf.valor ? h("span", { class: "ck" }, "✓") : null)));
    if (!pop.itens.length) lista.append(h("div", { class: "suave", style: "padding:8px 12px" }, "Nenhuma opção. Use o comentário."));
    const hl = lista.querySelector(".hl"); if (hl) hl.scrollIntoView({ block: "nearest" });
  }
  P.onkeydown = e => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fecharPop(true); return; }
    const ae = document.activeElement;
    if (e.key === "Tab") {
      const ordem = [q, com, mic], i = ordem.indexOf(ae), n = ordem.length;
      e.preventDefault(); ordem[(i + (e.shiftKey ? -1 : 1) + n) % n].focus(); return;
    }
    if (ae === q) {
      if (e.key === "ArrowDown") { e.preventDefault(); if (pop.hl >= pop.itens.length - 1) com.focus(); else { pop.hl++; listar(); } }
      else if (e.key === "ArrowUp") { e.preventDefault(); pop.hl = Math.max(0, pop.hl - 1); listar(); }
      else if (e.key === "Enter") { e.preventDefault(); if (pop.itens[pop.hl]) escolherDoPop(pop.itens[pop.hl]); }
    } else if (ae === com) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); salvarComentarioPop(); }
      else if (e.key === "ArrowUp" && com.selectionStart === 0) { e.preventDefault(); q.focus(); }
    }
  };
  posicionarPop(P, ancora);
  listar(); q.focus();
}
function posicionarPop(P, a) {
  ["left", "right", "top", "bottom", "width", "maxHeight"].forEach(k => { P.style[k] = ""; });
  if (innerWidth <= 720 || !a) return;
  const r = a.getBoundingClientRect(), w = 350;
  P.style.width = w + "px"; P.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + "px"; P.style.right = "auto";
  const baixo = innerHeight - r.bottom - 12, cima = r.top - 12;
  if (baixo >= 380 || baixo >= cima) { P.style.top = (r.bottom + 6) + "px"; P.style.bottom = "auto"; P.style.maxHeight = Math.max(240, baixo) + "px"; }
  else { P.style.bottom = (innerHeight - r.top + 6) + "px"; P.style.top = "auto"; P.style.maxHeight = Math.max(240, cima) + "px"; }
}
function fecharPop(devolver) {
  const P = $("#painel"), tinha = pop; P.className = ""; P.replaceChildren(); pop = null;
  if (audioAlvo) desligarAudio();
  if (tinha && devolver) { const e = document.querySelector(`[data-chip="${CSS.escape(chave(tinha.f))}"]`); if (e) e.focus(); }
}
function escolherDoPop(item) {
  const rel = relAtual(); if (!rel || !pop) return;
  const f = pop.f, obsCampo = $("#pop-com") ? $("#pop-com").value.trim() : null, antes = JSON.stringify(rel.st);
  const valor = item.add != null ? item.add : item.valor;
  fecharPop(false);
  aplicarValor(rel, f, valor, item.limpar ? "" : obsCampo, item.add != null);
  if (item.limpar) { const s = stOf(rel, chave(f)); if (f.t === "I" || f.t === "C" || f.t === "E") delete s.v; s.tocado = true; }
  refoco = `[data-chip="${chave(f)}"]`;
  salvar();
  const prox = DB.ui.avancar && !item.limpar && kind(valor) !== "pend" ? vizinho(rel, 1) : null;
  if (prox) refoco = `[data-chip="${chave(prox)}"]`;
  remontar();
  aviso("Registrado.", () => { rel.st = JSON.parse(antes); salvar(); remontar(); });
}
function salvarComentarioPop() {
  const rel = relAtual(); if (!rel || !pop) return;
  const f = pop.f, s = stOf(rel, chave(f)), t = $("#pop-com").value.trim();
  fecharPop(false); s.obs = t; s.tocado = true; refoco = `[data-chip="${chave(f)}"]`; salvar(); remontar(); aviso(t ? "Comentário salvo." : "Comentário apagado.");
}
document.addEventListener("mousedown", e => { if (pop && !e.target.closest("#painel") && !e.target.closest("[data-chip]")) fecharPop(false); });
function irVizinho(dir) {
  const rel = relAtual(); if (!rel) return;
  const n = vizinho(rel, dir); if (!n) { aviso("Não há outro pendente."); return; }
  if (!focarAlvo(n)) { const e = document.querySelector(`[data-pf="${CSS.escape(chave(n))}"]`); if (e) e.focus(); }
}
document.addEventListener("keydown", e => {
  if (pop || e.ctrlKey && e.key !== "k" || e.metaKey || e.altKey) return;
  if ((e.ctrlKey && e.key === "k") || (e.key === "/" && !eh(e.target))) { e.preventDefault(); DB.ui.lateral = true; aplicarTema(); const b = $("#busca"); if (b) { b.focus(); b.select(); } return; }
  if (eh(e.target) || vista !== "rel") return;
  if (e.key === "n" || e.key === "N") { e.preventDefault(); irVizinho(1); }
  else if (e.key === "p" || e.key === "P") { e.preventDefault(); irVizinho(-1); }
});

/* ================= saída: copiar relatório (só decisões e comentários) ================= */
function aspas(t) { return `"${String(t).replace(/\s+/g, " ").trim()}"`; }
function rotuloRel(rel) { return nomeRel(rel) || rel.dados.titulo; }
function linhaItem(rel, it, f) {
  const k = chave(f), s = rel.st[k] || {}, inf = infoAlvo(rel, f), v = inf.valor, kd = kind(v);
  const prefixo = f.t === "I" ? it.num : `${it.num} (linha ${f.r + 1}, ${it.tabela.colunas[f.c].nome})`;
  const temNotas = s.notas && s.notas.length;
  if (kd === "pend" && !s.obs && !temNotas) return null;
  let tag, extra = "";
  if (s.outro) { tag = "[Escolheu]"; extra = ` outro: ${aspas(v)}`; }
  else if (f.t === "I" && it.tipo === "decisao" && it.opcoes.length && it.opcoes.includes(v) && v !== "Ignorar") { tag = "[Escolheu]"; extra = ` opção ${String.fromCharCode(65 + it.opcoes.indexOf(v))}: ${aspas(v.toLowerCase())}`; }
  else tag = `[${v}]`;
  let l = `${prefixo} ${tag}${extra}`, usada = null;
  if (s.obs) l += ` — comentário: ${s.obs}`;
  else if (kd === "nao" && temNotas) { usada = s.notas[s.notas.length - 1]; l += ` — nota: ${usada}`; }
  return { l, usada };
}
function montarSaida(rel, soFoco) {
  const d = rel.dados, blocos = [], notas = [], foco = rel.foco ? chave(rel.foco) : null;
  const tocou = s => s && (s.tocado || s.obs || (s.notas && s.notas.length));
  d.secoes.forEach(sec => {
    if (sec.tipo === "texto") {
      sec.capitulos.forEach(cap => {
        const ls = [], kk = `K:${sec.num}:${cap.num}`, ks = rel.st[kk];
        if (ks && tocou(ks) && (!soFoco || foco === kk)) ls.push(`Todo o capítulo [${ks.v === OPC_CAP[0] ? "Aprovado" : ks.v === OPC_CAP[1] ? "Ajustar" : "Pendente"}]` + (ks.obs ? ` — comentário: ${ks.obs}` : ""));
        cap.paragrafos.forEach(p => {
          const k = `P:${sec.num}:${p.id}`, s = rel.st[k]; if (!tocou(s)) return;
          if (soFoco && k !== foco) return;
          if (s.viaCap && !s.obs && !s.alterado && !(s.notas && s.notas.length)) return;
          const sit = sitDe(rel, sec, p); let l = `${p.id} [${ROTULO_SIT[sit]}]`;
          if (s.alterado) l += ` texto alterado: ${aspas(textoDe(rel, sec, p))}`;
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
        if (acionavel(it)) fs.push({ t: "I", num: it.num });
        if (it.tabela) it.tabela.linhas.forEach((ln, r) => ln.forEach((cel, c) => { if (cel && typeof cel === "object" && cel.chip) fs.push({ t: "C", num: it.num, r, c }); }));
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
      const resp = e.resposta && DB.rels[e.resposta];
      ls.push(`${e.id} ${aspas(e.arquivo)} p. ${e.paginas || "todas"} [${(s && s.v) || "Pendente"}]` + (e.caminho ? ` — arquivo: ${e.caminho}` : "") + (resp ? ` — resposta: ${nomeRel(resp)}` : "") + (s && s.obs ? ` — comentário: ${s.obs}` : ""));
    });
    if (ls.length) blocos.push(`## Recebidos\n\n${ls.join("\n\n")}`);
  }
  if (!soFoco) (rel.notasGeral || []).forEach(n => notas.push(`(geral) ${aspas(n)}`));
  let t = `[OMEGA] ${rotuloRel(rel)} · relatório ${d.id} rev ${d.rev} | ${agora()}\n\n`;
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

/* ================= copiar em partes ================= */
function textoCapitulo(rel, sec, c) { return `${c.num} ${c.titulo}\n\n` + c.paragrafos.map(p => textoDe(rel, sec, p)).join("\n\n"); }
function textoSecao(rel, sec) { return `${sec.titulo}\n\n` + sec.capitulos.map(c => textoCapitulo(rel, sec, c)).join("\n\n"); }
function textoRelatorio(rel) {
  const d = rel.dados; let t = `${d.titulo}\n[${d.id} rev ${d.rev}]\n`;
  d.secoes.forEach(s => {
    t += `\n${s.num} ${s.titulo}\n\n`;
    if (s.tipo === "texto") t += s.capitulos.map(c => textoCapitulo(rel, s, c)).join("\n\n") + "\n";
    else s.itens.forEach(it => {
      const v = valorItem(rel, it), st = rel.st["I:" + it.num] || {};
      t += `${it.num} ${it.titulo}${v ? ` [${v}]` : ""}${it.texto ? "\n" + it.texto : ""}\n`;
      if (it.dependeDe.length) t += `Depende de: ${it.dependeDe.join(", ")}\n`;
      it.caminhos.forEach(c => { t += `Caminho: ${c}\n`; });
      if (st.obs) t += `Comentário: ${st.obs}\n`;
      t += "\n";
    });
  });
  return t;
}
async function copiarTexto(t, msg) { (await copiar(t)) ? aviso(msg) : caixaCopia(t, "Texto"); }
function copiarInteiro() { const rel = relAtual(); if (!rel) { aviso("Abra um relatório primeiro."); return; } copiarTexto(textoRelatorio(rel), "Relatório inteiro copiado."); }
async function copiarTudoEnviar() {
  const rel = relAtual(); if (!rel) { aviso("Abra um relatório primeiro."); return; }
  const t = montarSaida(rel, false) + "\n---\nRELATÓRIO COMPLETO\n\n" + textoRelatorio(rel);
  const ok = await copiar(t);
  if (rel.conversa) { window.open(rel.conversa, "_blank", "noopener"); ok ? aviso("Copiado. Na conversa, toque no campo de texto e cole.") : caixaCopia(t, "Tudo"); }
  else {
    ok ? aviso("Copiado. Cole o link da conversa deste relatório na lateral para abrir direto da próxima vez.") : caixaCopia(t, "Tudo");
    DB.ui.lateral = true; salvar(); aplicarTema(); const i = $("#in-conv"); if (i) i.focus();
  }
}

/* ================= Claude / Gemini (só abrir conversa nova; o trabalho é pelo relatório) ================= */
const URLS = { claude: "https://claude.ai/new", gemini: "https://gemini.google.com/app" };
const PERGUNTA = "Revise apenas o português (ortografia, acentuação, concordância e pontuação) do texto abaixo. Não mude o sentido nem o vocabulário jurídico. Devolva o texto corrigido e, depois, uma lista curta das alterações.";

/* ================= áudio (ditado) ================= */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let reconhecedor = null, audioOn = false, audioAlvo = null;
function corrigirSiglas(t) {
  return t.replace(/\b(l[aá]\s+n[ao])\s+(?:s[eé]\s*)?in?fra\b/gi, (m, a) => a + " SEINFRA")
    .replace(/\b(?:isso\s+[eé]|s[eé]|sei|cei|ce)\s*[- ]?\s*in?fra\b/gi, "SEINFRA")
    .replace(/\bseinfra\b/gi, "SEINFRA");
}
function anexarNota(t) {
  const rel = relAtual(); if (!rel || !t) return;
  if (audioAlvo && document.contains(audioAlvo)) { audioAlvo.value = (audioAlvo.value ? audioAlvo.value + " " : "") + t; return; }
  if (rel.foco) { const s = stOf(rel, chave(rel.foco)); (s.notas = s.notas || []).push(t); s.tocado = true; }
  else (rel.notasGeral = rel.notasGeral || []).push(t);
  salvar(); if (!eh(document.activeElement)) remontar();
}
function mostrarOuvindo(t) { const o = $("#ouvindo"); o.style.display = t ? "block" : "none"; o.textContent = t ? "🎙 " + t : ""; }
function ligarAudio(alvo) {
  if (!SR) { aviso("Este navegador não tem ditado por voz. Use o Chrome."); return; }
  if (audioOn) { if (alvo) audioAlvo = alvo; return; }
  audioOn = true; audioAlvo = alvo || null;
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
function desligarAudio() { audioOn = false; audioAlvo = null; try { reconhecedor && reconhecedor.stop(); } catch (e) {} mostrarOuvindo(""); atualizarAudioBt(); }
function alternarAudio() { audioOn ? desligarAudio() : ligarAudio(); }
function atualizarAudioBt() { document.querySelectorAll("[data-aud]").forEach(b => { b.classList.toggle("gravando", audioOn); b.classList.toggle("on", audioOn); }); }

/* ================= revisar tudo, impressão, novo documento ================= */
function sobreposicao(conteudo, titulo) {
  const fundo = h("div", { class: "sobre", onclick: e => { if (e.target === fundo) fundo.remove(); } },
    h("div", { class: "cartao sobre-c" }, h("div", { class: "sobre-t" }, h("b", {}, titulo), h("button", { class: "mini", onclick: () => fundo.remove() }, "Fechar")), conteudo));
  document.body.append(fundo); return fundo;
}
function revisarTudo(rel, sec) {
  carregarDic(() => {
    if (DICSTATE !== "ok") { aviso("Dicionário não encontrado. Deixe o arquivo dicionario-ptbr.js ao lado do index.html."); return; }
    document.querySelectorAll(".sobre").forEach(x => x.remove());
    const achados = [];
    sec.capitulos.forEach(c => c.paragrafos.forEach(p => { const t = textoDe(rel, sec, p); marcas(t).forEach(mk => achados.push({ p, t, mk })); }));
    const corpo = h("div", {});
    if (!achados.length) corpo.append(h("p", {}, "Nenhum problema encontrado neste texto."));
    else {
      const simples = achados.filter(a => a.mk.tipo === "regra");
      if (simples.length) corpo.append(h("div", { class: "linha" }, h("button", { class: "btn", onclick: () => {
        const porP = new Map(); simples.forEach(a => { (porP.get(a.p) || porP.set(a.p, []).get(a.p)).push(a.mk); });
        porP.forEach((mks, p) => { let t = textoDe(rel, sec, p); mks.sort((x, y) => y.ini - x.ini).forEach(mk => { t = t.slice(0, mk.ini) + mk.sug[0] + t.slice(mk.fim); }); alterarPar(rel, sec, p, t); });
        aviso(`${simples.length} correção(ões) de espaço e pontuação aplicadas.`); revisarTudo(rel, sec);
      } }, `Corrigir espaços e pontuação em tudo (${simples.length})`)));
      achados.forEach(a => {
        const sug = a.mk.tipo === "palavra" ? sugestoes(a.mk.txt) : a.mk.sug;
        corpo.append(h("div", { class: "achado" },
          h("div", { class: "suave" }, `${a.p.id}: …${a.t.slice(Math.max(0, a.mk.ini - 28), a.mk.ini)}`, h("b", { class: "err" }, a.mk.tipo === "regra" && !a.mk.txt.trim() ? "␣" : a.mk.txt), `${a.t.slice(a.mk.fim, a.mk.fim + 28)}…`, a.mk.msg ? `  (${a.mk.msg})` : ""),
          h("div", { class: "linha", style: "margin:4px 0 10px" }, sug.map(w => h("button", { class: "mini", onclick: () => { alterarPar(rel, sec, a.p, a.t.slice(0, a.mk.ini) + w + a.t.slice(a.mk.fim)); revisarTudo(rel, sec); } }, w === "" ? "remover espaço" : w === " " ? "um espaço só" : w)),
            h("button", { class: "mini", onclick: () => { if (a.mk.tipo === "palavra") ignoradas.add(a.mk.txt.toLowerCase()); revisarTudo(rel, sec); } }, "Ignorar"))));
      });
    }
    sobreposicao(corpo, `Revisar tudo — ${sec.titulo}`);
  });
}
function previaImpressao(rel, sec) {
  const folha = h("div", { class: "folha" }, h("div", { class: "f-tit" }, sec.titulo),
    sec.capitulos.map(c => [h("div", { class: "f-cap" }, `${c.num}. ${c.titulo}`), c.paragrafos.map(p => h("p", { class: "f-par" }, textoDe(rel, sec, p)))]));
  const ov = h("div", { id: "impressao" },
    h("div", { class: "imp-barra nao-imprimir" }, h("b", {}, "Visualização de impressão (A4)"), h("span", { class: "esp" }),
      h("button", { class: "btn", onclick: () => window.print() }, "Imprimir / Salvar como PDF"), h("button", { class: "btn sec", onclick: () => { ov.remove(); document.body.classList.remove("imprimindo"); } }, "Fechar")),
    h("div", { class: "imp-pag" }, folha));
  document.body.append(ov); document.body.classList.add("imprimindo");
}
const MODELOS = {
  "Ofício": ["Ofício nº ___/2026", "A(o) Senhor(a) [Nome do destinatário]\n[Cargo / órgão]", "Assunto: [assunto]", "Prezado(a) Senhor(a),", "[Escreva aqui o corpo do ofício.]", "Atenciosamente,", "Nome do Signatário\nCargo do Signatário"],
  "Nota técnica": ["Nota Técnica nº ___/2026", "Assunto: [assunto]", "1. Objeto\n[Escreva aqui.]", "2. Análise\n[Escreva aqui.]", "3. Conclusão\n[Escreva aqui.]", "Nome do Signatário\nCargo do Signatário"],
  "Comunicação interna (CI)": ["CI nº ___/2026", "De: [setor de origem]\nPara: [setor de destino]", "Assunto: [assunto]", "[Escreva aqui o texto da comunicação.]", "Nome do Signatário\nCargo do Signatário"],
  "Despacho": ["Despacho", "[Escreva aqui o despacho.]", "Nome do Signatário\nCargo do Signatário"],
  "Anexo": ["Anexo ao documento nº ___", "[Escreva aqui o conteúdo do anexo.]"]
};
function novoDocumento(vinculo) {
  const corpo = h("div", {}, h("p", { class: "suave" }, "Cria um documento em branco, em campos, para você escrever (Tab passa de campo em campo). Dá para visualizar a impressão e copiar para o Claude."),
    Object.keys(MODELOS).map(nome => h("button", { class: "op", onclick: () => {
      const num = Math.max(0, ...Object.values(DB.rels).map(r => parseFloat(r.dados.numero) || 0)) + 1;
      const d = normalizar({ id: "doc-" + Date.now().toString(36), rev: 1, numero: num, titulo: `${nome} (novo)`, pasta: { rotulo: nome }, secoes: [{ num: "T1", titulo: nome, tipo: "texto", capitulos: [{ num: "1", titulo: "Documento", paragrafos: MODELOS[nome].map((t, i) => ({ id: `1.${i + 1}`, texto: t })) }] }] });
      DB.rels[d.id] = novaRel(d);
      if (vinculo && DB.rels[vinculo.relId]) { const o = DB.rels[vinculo.relId], e = (o.entrada || []).find(x => x.id === vinculo.entradaId); if (e) { e.resposta = d.id; const s = stOf(o, "E:" + e.id); s.v = "Em análise"; s.tocado = true; } d.pasta.caminho = o.dados.pasta.caminho || ""; d.pasta.rotulo = nome + " — " + (e ? e.arquivo : ""); }
      DB.atual = d.id; vista = "rel"; salvar(); document.querySelectorAll(".sobre").forEach(x => x.remove()); montar(); scrollTo(0, 0); aviso("Documento criado. Tab passa de campo em campo; Enter edita.");
    } }, h("span", {}, nome))));
  sobreposicao(corpo, "Novo documento");
}

/* ================= PDF e pastas do computador ================= */
let pdfUrl = null, pdfNome = "", pdfVoltar = null, pdfCaminho = null;
function abrirPDFLocal() {
  const i = h("input", { type: "file", accept: "application/pdf,image/*,.txt", onchange: () => { const f = i.files[0]; if (!f) return; if (pdfUrl && pdfUrl.startsWith("blob:")) URL.revokeObjectURL(pdfUrl); pdfUrl = URL.createObjectURL(f); pdfCaminho = null; pdfNome = f.name; pdfVoltar = null; vista = "pdf"; montar(); fecharLateralPequena(); } });
  i.click();
}
function telaPDF(m) {
  const fr = h("iframe", { class: "visor", src: pdfUrl || "about:blank", title: pdfNome });
  m.append(h("div", { class: "linha", style: "margin-top:0" },
    h("button", { class: "btn sec", onclick: () => { vista = pdfVoltar ? "pastas" : "rel"; montar(); } }, "← Voltar"),
    h("b", { style: "align-self:center" }, pdfNome),
    h("span", { class: "esp" }),
    h("button", { class: "btn", onclick: () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { window.open(pdfUrl, "_blank"); aviso("Use o botão de imprimir da nova aba."); } } }, "Imprimir"),
    pdfCaminho && /\.pdf$/i.test(pdfNome) ? h("button", { class: "btn sec", onclick: () => abrirMesaServidor(pdfCaminho, pdfNome) }, "Mesa PDF") : null,
    h("button", { class: "btn sec", onclick: () => window.open(pdfUrl, "_blank") }, "Abrir em outra aba")), fr);
}
let pastaAtual = null, listaPasta = null;
async function api(rota, corpo) {
  const r = await fetch("api/" + rota, corpo ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) } : undefined);
  if (!r.ok) throw new Error(r.status); return r;
}
async function carregarAPI() {
  if (!/^https?:$/.test(location.protocol)) return;
  try { const j = await (await fetch("api/status", { cache: "no-store" })).json(); API = { ok: true, raizes: j.raizes || [], scripts: j.scripts || [] }; desenharBusca(); } catch (e) { API = { ok: false, raizes: [], scripts: [] }; }
}
function abrirPastaView(caminho) { pastaAtual = caminho; listaPasta = null; vista = "pastas"; montar(); }
function abrirArquivoView(caminho) {
  const nome = caminho.split(/[\\/]/).pop(), ext = (nome.split(".").pop() || "").toLowerCase();
  if (["pdf", "png", "jpg", "jpeg", "gif", "txt"].includes(ext)) { pdfUrl = "api/arquivo?caminho=" + encodeURIComponent(caminho); pdfCaminho = caminho; pdfNome = nome; pdfVoltar = caminho.replace(/[\\/][^\\/]*$/, ""); pastaAtual = pdfVoltar; vista = "pdf"; montar(); }
  else api("abrir-pasta", { caminho, arquivo: true }).then(() => aviso("Mostrando o arquivo no Explorador…")).catch(() => aviso("Não consegui abrir. Use o Iniciar Omega.bat."));
}
function telaPastas(m) {
  m.append(h("h1", {}, "Pastas do computador"));
  if (!API.ok) { m.append(h("p", { class: "suave just" }, "Para ver as pastas aqui, abra o Omega pelo Iniciar Omega.bat (servidor local) e informe as pastas em dados/config.json, por exemplo: {\"raizes\": [\"C:\\\\CL\"]}. Veja o COMO_USAR.md.")); return; }
  if (!API.raizes.length) { m.append(h("p", { class: "suave just" }, "Nenhuma pasta liberada. Crie o arquivo dados/config.json com {\"raizes\": [\"C:\\\\CL\"]} e reinicie o Iniciar Omega.bat.")); return; }
  const cam = h("div", { class: "migalhas" }), lista = h("div", {});
  m.append(cam, lista);
  if (!pastaAtual) {
    API.raizes.forEach(r => lista.append(h("button", { class: "lat-bt res", onclick: () => abrirPastaView(r) }, h("span", { class: "rn" }, "📁"), h("span", { class: "rt" }, r))));
    lista.append(h("p", { class: "suave" }, "Dica: digite na busca da lateral (nome da pasta ou do objeto) e toque no resultado."));
    return;
  }
  const raiz = API.raizes.find(r => pastaAtual.toLowerCase().startsWith(r.toLowerCase())) || "";
  cam.append(h("button", { class: "mini", onclick: () => abrirPastaView(null) }, "Raízes"), " ", h("code", {}, pastaAtual), " ",
    pastaAtual.toLowerCase() !== raiz.toLowerCase() ? h("button", { class: "mini", onclick: () => abrirPastaView(pastaAtual.replace(/[\\/][^\\/]*$/, "")) }, "↑ Subir") : null, " ",
    h("button", { class: "mini", onclick: () => api("abrir-pasta", { caminho: pastaAtual }).then(() => aviso("Abrindo no Explorador…")).catch(() => aviso("Não consegui abrir.")) }, "Abrir no Explorador"));
  cam.append(" ", botaoSubir(pastaAtual, () => abrirPastaView(pastaAtual)), " ", h("button", { class: "mini", onclick: async () => { const n = prompt("Nome da nova pasta:"); if (!n) return; try { await api("criar-pasta", { caminho: juntar(pastaAtual, n) }); abrirPastaView(pastaAtual); } catch (e) { aviso("Não consegui criar a pasta."); } } }, "Nova pasta"));
  listaArquivos(lista, pastaAtual, { aoPasta: abrirPastaView });
}
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
        if (!x || typeof x.rels !== "object") throw new Error("não é um estado do Omega");
        if (!confirm("Substituir tudo o que está neste aparelho pelo estado colado?")) return;
        DB = Object.assign({ rels: {}, atual: null, dic: [], ui: DB.ui }, x); DB.ui = Object.assign({ tema: "maisescuro", lateral: true, avancar: false, audioSempre: false, revisar: true }, DB.ui);
        vista = "rel"; salvar(); montar(); aviso("Estado colado.");
      } catch (e) { aviso("Não entendi o texto: " + e.message); }
    } }, "Colar estado")));
}

/* ================= recarregar relatório sozinho ================= */
let ultimoHash = null, pollTimer = null;
async function procurarPasta(avisar) {
  if (!/^https?:$/.test(location.protocol)) { if (avisar) aviso("Abra o Omega pelo endereço do servidor (servidor.js) para ler a pasta dados."); return; }
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
  try { const [hd] = await showOpenFilePicker({ types: [{ description: "Relatório JSON", accept: { "application/json": [".json"] } }] }); handleArq = hd; idbSet("handle", hd); ultMod = 0; vigiarArquivo(); aviso("Acompanhando " + hd.name + ". Quando o arquivo mudar, o Omega recarrega."); } catch (e) {}
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


/* ================= objetos, arquivos da pasta C:, scripts, Mesa PDF, recebidos ================= */
const OPC_ENT = ["Pendente", "Em análise", "Responder", "Respondido", "Arquivar"];
const sepDe = p => p.includes("\\") ? "\\" : "/";
const juntar = (d, n) => d.replace(/[\\/]+$/, "") + sepDe(d) + n;
const slug = s => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "objeto";
const botao = (t, fn) => h("button", { class: "mini", tabindex: "-1", onclick: fn }, t);
function emailGmail(assunto, corpo) { window.open("https://mail.google.com/mail/?view=cm&fs=1&su=" + encodeURIComponent(assunto) + "&body=" + encodeURIComponent(corpo), "_blank", "noopener"); }
async function enviarArquivo(dir, file) {
  const r = await fetch("api/enviar?caminho=" + encodeURIComponent(dir) + "&nome=" + encodeURIComponent(file.name), { method: "POST", body: file });
  if (!r.ok) throw new Error("erro " + r.status);
  return (await r.json()).caminho;
}
function menuSimples(ancora, itens) {
  fecharBalao();
  const r = ancora.getBoundingClientRect();
  const m = h("div", { class: "bal", style: `left:${Math.max(8, Math.min(r.left, innerWidth - 260))}px;top:${Math.max(8, Math.min(r.bottom + 4, innerHeight - 50 - itens.length * 42))}px` }, itens.map(i => h("button", { onclick: () => { m.remove(); i.fn(); } }, i.rotulo)));
  document.body.append(m);
  setTimeout(() => document.addEventListener("click", function f(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener("click", f); } }), 0);
}
/* script do C: (cadastrado em dados/config.json) rodando, com o resultado na tela */
function scriptsPara(nome, ehDir) {
  const ext = "." + ((nome.split(".").pop() || "").toLowerCase());
  return (API.scripts || []).filter(s => (s.aplicaA === "pasta") === !!ehDir && (!s.extensoes.length || s.extensoes.includes(ext)));
}
async function executarScript(sc, caminho, aoFim) {
  let job;
  try { const r = await fetch("api/executar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ script: sc.id, caminho }) }); const j = await r.json(); if (!r.ok) throw new Error(j.erro || r.status); job = j.job; }
  catch (e) { aviso("Não consegui executar: " + e.message); return; }
  const pre = h("pre", { class: "copia", style: "max-height:50vh;overflow:auto" }, "Executando…"), est = h("p", { class: "suave" }, "Rodando…");
  const ov = sobreposicao(h("div", {}, est, pre), sc.nome);
  const volta = async () => {
    if (!document.contains(ov)) return;
    try {
      const j = await (await fetch("api/job?id=" + job, { cache: "no-store" })).json();
      pre.textContent = j.saida || "(sem saída)";
      if (j.status === "rodando") { est.textContent = "Rodando…"; setTimeout(volta, 1000); return; }
      est.textContent = j.status === "ok" ? "Terminou." : `Terminou com erro (código ${j.codigo}).`;
      aviso(j.status === "ok" ? sc.nome + ": pronto." : sc.nome + ": terminou com erro."); if (aoFim) aoFim(j);
    } catch (e) { est.textContent = "Perdi contato com o servidor."; }
  };
  volta();
}
/* lista de arquivos de uma pasta, com as ações de gerenciador */
async function listaArquivos(box, caminho, opc) {
  opc = opc || {}; box.replaceChildren(h("p", { class: "suave" }, "Carregando…"));
  let j;
  try { j = await (await api("listar?caminho=" + encodeURIComponent(caminho))).json(); }
  catch (e) { box.replaceChildren(h("p", { class: "suave" }, "Não consegui listar esta pasta (não existe ou está fora das pastas liberadas em dados/config.json).")); return false; }
  const recarregar = () => listaArquivos(box, caminho, opc);
  const tb = h("tbody", {});
  if (!j.length) tb.append(h("tr", {}, h("td", { colspan: "3", class: "suave" }, "Pasta vazia.")));
  j.forEach(x => {
    const ext = (x.nome.split(".").pop() || "").toLowerCase(), ac = h("div", { class: "arq-ac" });
    if (!x.dir) ac.append(botao("Ver", () => abrirArquivoView(x.caminho)));
    if (ext === "pdf") ac.append(botao("Mesa PDF", () => abrirMesaServidor(x.caminho, x.nome)));
    if (ext === "json") ac.append(botao("Abrir como relatório", async () => { try { carregarRelatorio(await (await api("arquivo?caminho=" + encodeURIComponent(x.caminho))).json()); } catch (e) { aviso("Esse JSON não é um relatório do Omega."); } }));
    ac.append(botao("Renomear", async () => {
      const n = prompt("Novo nome para " + x.nome + ":", x.nome); if (!n || n === x.nome) return;
      try { await api("renomear", { caminho: x.caminho, novoNome: n }); aviso("Renomeado."); recarregar(); } catch (e) { aviso("Não consegui renomear (já existe um com esse nome, ou o nome é inválido)."); }
    }));
    const sc = scriptsPara(x.nome, x.dir);
    if (sc.length) ac.append(botao("Executar ▾", ev => menuSimples(ev.currentTarget, sc.map(s => ({ rotulo: s.nome, fn: () => executarScript(s, x.caminho, recarregar) })))));
    ac.append(botao("Explorador", () => api("abrir-pasta", { caminho: x.caminho, arquivo: !x.dir }).catch(() => aviso("Não consegui abrir."))));
    tb.append(h("tr", {}, h("td", { class: "arq-n" }, h("button", { class: "arq-nome", tabindex: "-1", onclick: () => x.dir ? (opc.aoPasta ? opc.aoPasta(x.caminho) : abrirPastaView(x.caminho)) : abrirArquivoView(x.caminho) }, (x.dir ? "📁 " : ext === "pdf" ? "📄 " : "▫ ") + x.nome)),
      h("td", { class: "suave arq-t" }, x.dir ? "" : Math.max(1, Math.round(x.tam / 1024)) + " KB · " + new Date(x.data).toLocaleDateString("pt-BR")), h("td", {}, ac)));
  });
  box.replaceChildren(h("table", { class: "arq" }, tb));
  return true;
}
function botaoSubir(dir, aoSubir) {
  const i = h("input", { type: "file", multiple: true, class: "oculto", onchange: async () => {
    const fs = [...i.files]; i.value = ""; if (!fs.length) return;
    let n = 0; for (const f of fs) { try { aviso(`Enviando ${f.name}…`); await enviarArquivo(dir, f); n++; } catch (e) { aviso("Não consegui enviar " + f.name + " (pasta fora das liberadas?)."); } }
    if (n) { aviso(`${n} arquivo(s) enviado(s) para a pasta.`); if (aoSubir) aoSubir(); }
  } });
  return h("span", {}, i, h("button", { class: "btn", "data-subir": "1", onclick: () => i.click() }, "Subir arquivo"));
}
function painelArquivos(rel) {
  const cam = rel.dados.pasta.caminho; if (!cam || !API.ok) return null;
  const aberto = !rel.rec.__arq, corpo = h("div", { class: "arq-corpo" });
  let atual = cam;
  const abrir = d => { atual = d; recarga(); };
  const recarga = () => { corpo.replaceChildren(); const topo = h("div", { class: "migalhas" }, h("code", {}, atual), atual !== cam ? botao("↑ Subir", () => abrir(atual.replace(/[\\/][^\\/]*$/, "") || cam)) : null, botaoSubir(atual, recarga), botao("Atualizar", recarga), botao("Abrir no Explorador", () => api("abrir-pasta", { caminho: atual }).catch(() => aviso("Não consegui abrir."))));
    const lista = h("div", {}); corpo.append(topo, lista); listaArquivos(lista, atual, { aoPasta: abrir }); };
  if (aberto) recarga();
  return h("section", { class: "sec" + (aberto ? "" : " rec"), id: "sec-__arq" },
    h("div", { class: "sec-hl" }, h("button", { class: "sec-h", tabindex: "-1", onclick: () => { rel.rec.__arq = aberto; salvar(); remontar(); } }, h("span", { class: "seta" }, "▾"), h("h2", { class: "n" }, "Arquivos deste objeto"))), h("div", { class: "sec-b" }, corpo));
}

/* ---- Recebidos: arquivos/páginas que chegaram e o que fazer com eles ---- */
function tabelaRecebidos(rel) {
  const ent = rel.entrada || []; if (!ent.length) return null;
  const tb = h("tbody", {});
  ent.forEach(e => {
    const f = { t: "E", id: e.id }, s = rel.st[chave(f)] || {}, v = s.v || "Pendente", resp = e.resposta && DB.rels[e.resposta];
    const ac = h("div", { class: "arq-ac" });
    if (e.caminho && API.ok) ac.append(botao("Ver", () => abrirArquivoView(e.caminho)));
    if (resp) ac.append(botao("Abrir resposta", () => abrirRelatorio(e.resposta))); else ac.append(botao("Responder", () => novoDocumento({ relId: rel.dados.id, entradaId: e.id })));
    ac.append(botao("Remover", () => { if (confirm("Tirar este recebido da lista?")) { rel.entrada = rel.entrada.filter(x => x.id !== e.id); delete rel.st[chave(f)]; salvar(); remontar(); } }));
    tb.append(h("tr", { class: "item", "data-fk": chave(f) },
      h("td", { "data-label": "Arquivo", class: "c-item" }, h("b", {}, e.arquivo)),
      h("td", { "data-label": "Páginas", class: "c-dep" }, e.paginas || "todas"),
      h("td", { "data-label": "O que fazer", class: "c-texto" }, ac, s.obs ? h("div", { class: "comentario" }, h("b", {}, "Comentário: "), s.obs) : null, resp ? h("div", { class: "suave" }, "Resposta: " + nomeRel(resp)) : null),
      h("td", { "data-label": "Situação", class: "c-esc" }, "(", chipEl(f, v), ")")));
  });
  return h("section", { class: "sec" }, h("div", { class: "sec-hl" }, h("h2", { class: "n", style: "padding:8px 0" }, `Recebidos (${ent.length})`)),
    h("table", { class: "rel" }, h("thead", {}, h("tr", {}, ["Arquivo", "Páginas", "O que fazer", "Situação"].map(t => h("th", {}, t)))), tb));
}

/* ---- Novo objeto ---- */
function novoObjeto() {
  const proximo = Math.max(0, ...Object.values(DB.rels).map(r => parseFloat(r.dados.numero) || 0)) + 1;
  const campo = (rot, el) => h("label", { class: "campo" }, h("span", {}, rot), el);
  const nome = h("input", { type: "text", placeholder: "Ex.: Canal do Malhado" }), num = h("input", { type: "text" }), cam = h("input", { type: "text", placeholder: "C:\\CL\\... (opcional)" }), conv = h("input", { type: "url", placeholder: "https://claude.ai/chat/… (opcional)" });
  num.value = proximo;
  const criar = h("input", { type: "checkbox" }); criar.checked = API.ok;
  const corpo = h("div", {},
    campo("Nome do objeto (o mesmo da pasta e da conversa)", nome), campo("Número", num), campo("Pasta no computador", cam),
    h("label", { class: "lat-chk" }, criar, "Criar a pasta se não existir (precisa do Iniciar Omega.bat)"), campo("Link da conversa no Claude", conv),
    h("div", { class: "linha" }, h("button", { class: "btn", id: "obj-criar", onclick: async () => {
      const rot = nome.value.trim(); if (!rot) { aviso("Dê um nome ao objeto."); nome.focus(); return; }
      const id = "obj-" + slug(rot) + "-" + Date.now().toString(36).slice(-4);
      if (conv.value.trim() && !/^https?:\/\//i.test(conv.value.trim())) { aviso("O link da conversa precisa começar com https://"); return; }
      if (cam.value.trim() && criar.checked && API.ok) { try { await api("criar-pasta", { caminho: cam.value.trim() }); } catch (e) { aviso("Não consegui criar a pasta (fora das pastas liberadas?). O objeto será criado mesmo assim."); } }
      const d = normalizar({ id, rev: 1, numero: num.value.trim() || proximo, titulo: rot, pasta: { rotulo: rot, caminho: cam.value.trim() }, secoes: [] });
      DB.rels[id] = novaRel(d); if (conv.value.trim()) DB.rels[id].conversa = conv.value.trim();
      DB.atual = id; vista = "rel"; salvar(); document.querySelectorAll(".sobre").forEach(x => x.remove()); montar(); scrollTo(0, 0);
      aviso("Objeto criado. Suba arquivos, use a Mesa PDF ou peça o relatório ao Claude com o id " + id);
    } }, "Criar objeto")));
  sobreposicao(corpo, "Novo objeto"); setTimeout(() => nome.focus(), 50);
}

/* ---- Mesa PDF: ler, escolher páginas, extrair, cadastrar como recebido, responder, imprimir, e-mail ---- */
let mesa = null, pdfLibPronto = null;
function carregarPDFLib() {
  if (window.PDFLib) return Promise.resolve();
  return pdfLibPronto || (pdfLibPronto = new Promise((ok, no) => { const s = h("script", { src: "pdf-lib.min.js" }); s.onload = ok; s.onerror = () => { pdfLibPronto = null; no(new Error("pdf-lib.min.js não encontrado")); }; document.head.append(s); }));
}
function abrirMesaLocal() {
  const i = h("input", { type: "file", accept: "application/pdf", onchange: () => { const f = i.files[0]; if (!f) return; mesa = { blob: f, url: URL.createObjectURL(f), nome: f.name, caminho: null, total: null, relId: DB.atual, extraido: null }; vista = "mesa"; montar(); fecharLateralPequena(); } });
  i.click();
}
function abrirMesaServidor(caminho, nome) { mesa = { blob: null, url: "api/arquivo?caminho=" + encodeURIComponent(caminho), nome, caminho, total: null, relId: DB.atual, extraido: null }; vista = "mesa"; montar(); }
async function bytesMesa() { return mesa.blob ? await mesa.blob.arrayBuffer() : await (await fetch(mesa.url)).arrayBuffer(); }
function lerPaginas(txt, total) {
  const out = new Set();
  String(txt || "").split(/[,;\s]+/).filter(Boolean).forEach(p => {
    const m = p.match(/^(\d+)(?:-(\d*))?$/); if (!m) return;
    const a = +m[1], b = m[2] === undefined ? a : (m[2] === "" ? total : +m[2]);
    for (let i = Math.max(1, a); i <= Math.min(b, total || b); i++) out.add(i);
  });
  return [...out].sort((x, y) => x - y);
}
function rotuloPaginas(ps) { const r = []; for (let i = 0; i < ps.length;) { let j = i; while (ps[j + 1] === ps[j] + 1) j++; r.push(j > i ? `${ps[i]}-${ps[j]}` : `${ps[i]}`); i = j + 1; } return r.join(","); }
function telaMesa(m) {
  if (!mesa) { m.append(h("p", {}, "Nenhum PDF aberto."), h("button", { class: "btn", onclick: abrirMesaLocal }, "Escolher PDF")); return; }
  const visor = h("iframe", { class: "visor", id: "mesa-visor", src: mesa.url, title: mesa.nome });
  const info = h("p", { class: "suave", id: "mesa-info" }, "Contando páginas…"), pags = h("input", { type: "text", id: "mesa-pags", placeholder: "Ex.: 2-4, 7", "aria-label": "Páginas" });
  const ext = h("div", { id: "mesa-ext" });
  const sel = h("select", { id: "mesa-obj" }, Object.keys(DB.rels).map(id => h("option", { value: id }, nomeRel(DB.rels[id])))); if (mesa.relId && DB.rels[mesa.relId]) sel.value = mesa.relId;
  const escolhidas = () => lerPaginas(pags.value, mesa.total);
  const ir = () => { const e = escolhidas(); visor.src = mesa.url + "#page=" + (e[0] || 1); };
  carregarPDFLib().then(async () => { try { const d = await PDFLib.PDFDocument.load(await bytesMesa(), { ignoreEncryption: true }); mesa.total = d.getPageCount(); info.textContent = `${mesa.total} página(s). Escreva as páginas que quer (ex.: 2-4, 7).`; } catch (e) { info.textContent = "Não consegui ler este PDF para contar páginas (o botão Extrair pode não funcionar)."; } }).catch(e => { info.textContent = e.message; });
  async function extrair() {
    const e = escolhidas(); if (!e.length) { aviso("Escreva as páginas, por exemplo 2-4, 7."); return; }
    try {
      await carregarPDFLib(); const src = await PDFLib.PDFDocument.load(await bytesMesa(), { ignoreEncryption: true }), out = await PDFLib.PDFDocument.create();
      (await out.copyPages(src, e.map(x => x - 1))).forEach(p => out.addPage(p));
      const blob = new Blob([await out.save()], { type: "application/pdf" }), base = mesa.nome.replace(/\.pdf$/i, "");
      mesa.extraido = { blob, nome: `${base}_p${rotuloPaginas(e)}.pdf`, paginas: rotuloPaginas(e), n: e.length, url: URL.createObjectURL(blob) };
      desenhaExt();
    } catch (er) { aviso("Não consegui extrair: " + er.message); }
  }
  function desenhaExt() {
    ext.replaceChildren(); const x = mesa.extraido; if (!x) return;
    ext.append(h("p", {}, h("b", {}, "Pronto: "), `${x.nome} (${x.n} página(s))`),
      h("div", { class: "linha" },
        h("button", { class: "btn sec", onclick: () => { visor.src = x.url; } }, "Ver o extraído"),
        h("button", { class: "btn sec", onclick: () => { const a = h("a", { href: x.url, download: x.nome }); document.body.append(a); a.click(); a.remove(); } }, "Baixar"),
        h("button", { class: "btn sec", id: "mesa-salvar", onclick: salvarNaPasta }, "Salvar na pasta do objeto"),
        h("button", { class: "btn sec", onclick: () => { try { visor.contentWindow.focus(); visor.contentWindow.print(); } catch (e) { window.open(x.url, "_blank"); } } }, "Imprimir"),
        h("button", { class: "btn sec", onclick: () => { emailGmail("Documento: " + x.nome, "Segue em anexo: " + x.nome + "\n\n(anexe o arquivo: ele está na pasta do objeto ou nos Downloads)"); } }, "E-mail (Gmail)")));
  }
  async function salvarNaPasta() {
    const rel = DB.rels[sel.value], dir = rel && rel.dados.pasta.caminho, x = mesa.extraido;
    if (!dir) { aviso("O objeto escolhido não tem pasta. Defina em Novo objeto."); return null; }
    if (!API.ok) { aviso("Para gravar na pasta, abra o Omega pelo Iniciar Omega.bat. Use Baixar por enquanto."); return null; }
    try { const f = new File([x.blob], x.nome, { type: "application/pdf" }); const c = await enviarArquivo(dir, f); aviso("Salvo na pasta: " + c); x.caminho = c; return c; } catch (e) { aviso("Não consegui salvar na pasta."); return null; }
  }
  function cadastrar() {
    const rel = DB.rels[sel.value]; if (!rel) return null;
    const e = escolhidas(), x = mesa.extraido;
    const reg = { id: "R" + Date.now().toString(36), arquivo: x ? x.nome : mesa.nome, paginas: x ? x.paginas : (e.length ? rotuloPaginas(e) : "todas"), caminho: (x && x.caminho) || mesa.caminho || "", criado: Date.now() };
    (rel.entrada = rel.entrada || []).push(reg); const s = stOf(rel, "E:" + reg.id); s.v = "Pendente"; s.tocado = true; salvar();
    aviso(`Cadastrado como recebido em ${nomeRel(rel)} (Pendente).`); return { rel, reg };
  }
  const scs = scriptsPara(mesa.nome, false);
  m.append(h("div", { class: "linha", style: "margin-top:0" }, h("button", { class: "btn sec", onclick: () => { vista = mesa.caminho ? "pastas" : "rel"; if (mesa.caminho) pastaAtual = mesa.caminho.replace(/[\\/][^\\/]*$/, ""); montar(); } }, "← Voltar"), h("b", { style: "align-self:center" }, "Mesa PDF — " + mesa.nome)),
    h("div", { class: "mesa-grade" }, visor, h("div", { class: "mesa-ctrl" }, info,
      h("label", { class: "campo" }, h("span", {}, "Páginas"), pags),
      h("div", { class: "linha" }, h("button", { class: "btn sec", id: "mesa-ir", onclick: ir }, "Ir para a página"), h("button", { class: "btn", id: "mesa-extrair", onclick: extrair }, "Extrair páginas")),
      ext, h("hr"),
      h("label", { class: "campo" }, h("span", {}, "Objeto"), sel),
      h("div", { class: "linha" },
        h("button", { class: "btn sec", id: "mesa-cadastrar", onclick: () => { cadastrar(); } }, "Cadastrar como recebido (Pendente)"),
        h("button", { class: "btn sec", id: "mesa-responder", onclick: () => { const c = cadastrar(); if (c) novoDocumento({ relId: c.rel.dados.id, entradaId: c.reg.id }); } }, "Responder (novo documento)")),
      h("div", { class: "linha" }, h("button", { class: "btn sec", onclick: () => { try { visor.contentWindow.focus(); visor.contentWindow.print(); } catch (e) { window.open(mesa.url, "_blank"); } } }, "Imprimir o PDF aberto"),
        h("button", { class: "btn sec", onclick: () => emailGmail("PDF: " + mesa.nome, "Segue em anexo: " + mesa.nome) }, "E-mail (Gmail)")),
      h("hr"),
      h("div", {}, h("b", {}, "Scripts do C:"),
        API.ok ? (scs.length ? h("div", { class: "linha" }, scs.map(s => h("button", { class: "btn sec", onclick: async () => {
          let cam = mesa.caminho;
          if (!cam) { const rel = DB.rels[sel.value], dir = rel && rel.dados.pasta.caminho; if (!dir) { aviso("Escolha um objeto que tenha pasta para enviar o PDF antes."); return; } try { cam = await enviarArquivo(dir, mesa.blob instanceof File ? mesa.blob : new File([mesa.blob], mesa.nome)); mesa.caminho = cam; } catch (e) { aviso("Não consegui enviar o PDF para a pasta."); return; } }
          executarScript(s, cam);
        } }, s.nome))) : h("p", { class: "suave" }, "Nenhum script cadastrado para PDF em dados/config.json.")) : h("p", { class: "suave" }, "Abra pelo Iniciar Omega.bat para usar os scripts (OCR, notas, renomear)."))))); 
}

/* ---- 💬: copia a mensagem (e salva o retorno na pasta) e vai para a conversa ---- */
async function irConversa(id) {
  const r = DB.rels[id]; if (!r) return;
  if (!r.conversa) { DB.atual = id; vista = "rel"; DB.ui.lateral = true; salvar(); montar(); const i = $("#in-conv"); if (i) i.focus(); aviso("Cole o link da conversa deste objeto no campo da lateral e tecle Enter."); return; }
  const rotulo = nomeRel(r), msg = r.msg || `Leia o relatório de retorno do Omega do objeto ${rotulo} (rev ${r.dados.rev}).`, texto = montarSaida(r, false);
  let salvo = null;
  if (API.ok && r.dados.pasta.caminho) { try { salvo = (await (await api("salvar", { caminho: r.dados.pasta.caminho, nome: `RETORNO_OMEGA_rev${r.dados.rev}.txt`, texto })).json()).caminho; } catch (e) {} }
  const copia = salvo ? `${msg} O arquivo está em: ${salvo}` : `${msg}\n\n${texto}`;
  const ok = await copiar(copia);
  window.open(r.conversa, "_blank", "noopener");
  if (ok) aviso(salvo ? "Retorno salvo na pasta e mensagem copiada. Na conversa, cole com Ctrl+V." : "Relatório copiado. Na conversa, cole com Ctrl+V.");
  else caixaCopia(copia, "Mensagem para a conversa");
}

/* ================= início ================= */
addEventListener("resize", () => { ajustarTabelas(); aplicarTema(); if (pop) fecharPop(false); });
if (innerWidth < 900) DB.ui.lateral = false;
montar();
if (new URLSearchParams(location.search).has("exemplo")) abrirExemplo();
lerEstadoServidor().then(() => { procurarPasta(false); carregarAPI(); });
restaurarHandle();
if (DB.ui.audioSempre) setTimeout(() => ligarAudio(), 800);
if (("serviceWorker" in navigator) && (location.protocol === "https:" || location.hostname === "localhost")) navigator.serviceWorker.register("sw.js").catch(() => {});
