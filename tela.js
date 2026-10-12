"use strict";
/* Omega — interface: lateral, barra congelada, início, relatório, escolhas, bolinhas, menus, ditado, revisor. */

/* ================= estado da interface ================= */
const MQ = matchMedia("(max-width: 759px)");
let CEL = MQ.matches;
let VISTA = "inicio";
let DRAWER = false;
let BUSCA = "";
const ABERTAS = {};           // relatório -> seções abertas nesta visita (abre sempre tudo recolhido)
const ULT_TOQUE = {};         // detecção de toque duplo por chave (sobrevive ao redesenho)
let PEND_MONTAR = false;
const TELAS = {};             // vista -> { topo(T), corpo(m), nav }
const toqueGrosso = () => matchMedia("(pointer: coarse)").matches || CEL;
function relAtual() { return PREF.atual && REL[PREF.atual] ? REL[PREF.atual] : null; }

/* ================= montagem ================= */
function aplicarLayout() {
  const R = document.documentElement;
  R.classList.toggle("cel", CEL);
  R.classList.toggle("lat-fechada", !CEL && !PREF.lat);
  R.classList.toggle("lat-aberta", CEL && DRAWER);
  if (PREF.tema === "maisescuro") delete R.dataset.tema; else R.dataset.tema = PREF.tema;
  const sc = $("#scrim-lat"); if (sc) sc.hidden = !(CEL && DRAWER);
}
function editandoAgora() {
  const a = document.activeElement;
  return !!(a && ehCampo(a) && (a.closest("#main") || a.closest(".pop") || a.closest(".sheet") || a.closest(".dlg"))) || !!POP;
}
function montar(opts) {
  if (editandoAgora() && !(opts && opts.forcar)) { PEND_MONTAR = true; return; }
  PEND_MONTAR = false;
  aplicarLayout();
  desenharLateral();
  desenharTopo();
  desenharMain();
  desenharNav();
}
document.addEventListener("focusout", () => setTimeout(() => { if (PEND_MONTAR && !editandoAgora()) { const y = scrollY; montar(); scrollTo(0, y); } }, 60));
function desenharMain() {
  const m = $("#main"); m.replaceChildren();
  const t = TELAS[VISTA] || TELAS.inicio;
  try { t.corpo(m); } catch (e) { console.error(e); ap(m, h("div", { class: "col" }, h("p", {}, "Erro ao montar a tela: " + e.message))); }
}
function desenharTopo() {
  const T = $("#topo"); T.replaceChildren();
  const t = TELAS[VISTA] || TELAS.inicio;
  t.topo(T);
}
function ir(vista, opts) {
  VISTA = vista; DRAWER = false; fecharPop(); fecharMenus(); fecharDialogo();
  if (typeof aoSairDaMesa === "function") aoSairDaMesa();
  if (Rolagem.ligada && vista !== "rel") Rolagem.parar();
  montar({ forcar: true });
  if (!opts || !opts.manterScroll) scrollTo(0, 0);
}
function abrirRelatorio(id, alvo) {
  if (!REL[id]) return;
  PREF.atual = id; PREF.visto[id] = Date.now(); salvarPref();
  ABERTAS[id] = {};
  ir("rel");
  if (alvo) setTimeout(() => irPara(alvo), 30);
}
function botaoLat() {
  if (CEL) return h("button", { class: "ib", type: "button", title: "Menu", "aria-label": "Abrir o menu", onclick: () => { DRAWER = true; aplicarLayout(); } }, ico("menu"));
  if (!PREF.lat) return h("button", { class: "ib", type: "button", title: "Mostrar a lateral", "aria-label": "Mostrar a lateral", onclick: alternarLateral }, ico("side"));
  return null;
}
function alternarLateral() { if (CEL) { DRAWER = !DRAWER; aplicarLayout(); return; } PREF.lat = !PREF.lat; salvarPref(); montar({ forcar: true }); }

/* ================= lateral: busca, últimos trabalhados, pastas ================= */
function caixaBusca(id) {
  const inp = h("input", { id, type: "search", placeholder: "Buscar relatório ou pasta", "aria-label": "Buscar relatório ou pasta", autocomplete: "off", value: BUSCA,
    oninput: e => { BUSCA = e.target.value; redesenharListas(id); },
    onkeydown: e => { if (e.key === "Escape") { BUSCA = ""; e.target.value = ""; redesenharListas(id); } else if (e.key === "Enter") { const b = document.querySelector(".lat-lista .row, .lista-ini .row"); if (b) b.click(); } } });
  return h("label", { class: "search" }, ico("search"), inp);
}
function redesenharListas(origem) {
  const L = $("#lat .lat-lista"); if (L) L.replaceChildren(...conteudoLista());
  if (VISTA === "inicio" && CEL) { const box = $(".lista-ini"); if (box) box.replaceChildren(...conteudoLista(true)); }
  if (origem === "busca-ini") { const o = $("#busca-lat"); if (o) o.value = BUSCA; } else { const o = $("#busca-ini"); if (o) o.value = BUSCA; }
}
function desenharLateral() {
  const L = $("#lat"); const lista0 = L.querySelector(".lat-lista"), sy = lista0 ? lista0.scrollTop : 0;
  const tinhaFoco = document.activeElement && document.activeElement.id === "busca-lat";
  L.replaceChildren(
    h("div", { class: "brand" }, h("button", { type: "button", onclick: () => ir("inicio"), title: "Início" }, h("b", {}, "Ω"), "Omega"),
      h("button", { class: "ib", type: "button", title: "Recolher a lateral", "aria-label": "Recolher a lateral", onclick: alternarLateral }, ico("side"))),
    caixaBusca("busca-lat"),
    h("div", { class: "lat-lista" }, ...conteudoLista()),
    h("div", { class: "sfoot" }, seletorTema(), h("button", { class: "ib", type: "button", title: "Ferramentas e ajustes", "aria-label": "Ferramentas e ajustes", onclick: e => menuEngrenagem(e.currentTarget) }, ico("gear"))));
  const l2 = L.querySelector(".lat-lista"); if (l2) l2.scrollTop = sy;
  if (tinhaFoco) { const b = $("#busca-lat"); b.focus(); try { b.setSelectionRange(b.value.length, b.value.length); } catch (e) {} }
}
function seletorTema() {
  return h("div", { class: "seg", role: "group", "aria-label": "Iluminação" }, [["claro", "Claro"], ["escuro", "Escuro"], ["maisescuro", "Mais escuro"]].map(([k, t]) =>
    h("button", { type: "button", class: PREF.tema === k ? "on" : "", "aria-pressed": PREF.tema === k ? "true" : "false", onclick: () => { PREF.tema = k; salvarPref(); aplicarLayout(); desenharLateral(); } }, t)));
}
function relsOrdenados() { return Object.values(REL).sort((a, b) => ultimaAtividade(b) - ultimaAtividade(a)); }
function linhaRel(rel, extraCls, mostrarData) {
  const on = PREF.atual === rel.id && (VISTA === "rel" || VISTA === "resposta");
  return h("button", { type: "button", class: "row" + (on ? " on" : "") + (extraCls ? " " + extraCls : ""), onclick: () => { abrirRelatorio(rel.id); }, title: rel.dados.titulo },
    dot(corRel(rel)), h("span", { class: "n" }, codigoRel(rel)), h("span", { class: "nm" }, nomeCurto(rel)), mostrarData ? h("span", { class: "dir" }, dataCurta(ultimaAtividade(rel))) : null);
}
function conteudoLista(inicio) {
  const out = [];
  const rels = relsOrdenados();
  if (BUSCA.trim()) return resultadosBusca(BUSCA);
  if (!inicio) {
    out.push(h("div", { class: "sl" }, "Últimos trabalhados"));
    if (!rels.length) out.push(h("div", { class: "vazio-lat" }, Banco.estado === "conectando" ? "Carregando…" : "Nenhum relatório ainda."));
    rels.slice(0, 5).forEach(r => out.push(linhaRel(r)));
  }
  out.push(h("div", { class: "sl" }, "Pastas"));
  out.push(...arvoreEl());
  return out;
}
function construirArvore() {
  const P = pastas(), nos = {}, semCod = [];
  const add = cod => { if (!cod || nos[cod]) return; nos[cod] = { cod, filhos: [], rel: null }; const pai = pastaPai(cod); if (pai) { add(pai); nos[pai].filhos.push(cod); } };
  Object.keys(P).forEach(add);
  Object.values(REL).forEach(r => { const c = codigoRel(r); if (c) { add(c); nos[c].rel = r; } else semCod.push(r); });
  Object.values(nos).forEach(n => n.filhos.sort(cmpCodigo));
  const raizes = Object.keys(nos).filter(c => !pastaPai(c)).sort(cmpCodigo);
  return { nos, raizes, semCod };
}
function arvoreEl(filtro) {
  const { nos, raizes, semCod } = construirArvore(), out = [];
  const visivel = filtro || null;
  const desenhar = (cod, nivel) => {
    const n = nos[cod]; if (visivel && !visivel.has(cod)) return;
    const temFilhos = n.filhos.length > 0, aberto = visivel ? true : !!PREF.abertos[cod];
    const nome = n.rel ? (n.rel.dados.pasta.rotulo || nomeCurto(n.rel)) : nomePasta(cod);
    const on = n.rel && PREF.atual === n.rel.id && (VISTA === "rel" || VISTA === "resposta");
    const cls = "row" + (nivel ? " i" + Math.min(4, nivel) : "") + (on ? " on" : "") + (!n.rel && PREF.pastaSel === cod && VISTA === "inicio" && !CEL ? " on" : "");
    const chev = temFilhos ? h("span", { class: "chev", role: "button", "aria-label": aberto ? "Recolher" : "Abrir", onclick: e => { e.stopPropagation(); PREF.abertos[cod] = !aberto; salvarPref(); redesenharListas(); } }, ico(aberto ? "cl" : "cr")) : (nivel ? null : h("span", { class: "chev" }));
    out.push(h("button", { type: "button", class: cls, title: n.rel ? n.rel.dados.titulo : nome,
      onclick: () => {
        if (n.rel) { abrirRelatorio(n.rel.id); return; }
        PREF.abertos[cod] = !aberto || PREF.pastaSel !== cod ? true : false; PREF.pastaSel = cod; salvarPref();
        if (VISTA === "inicio" && !CEL) montar({ forcar: true }); else redesenharListas();
      } },
      chev, ico(temFilhos || !n.rel ? "folder" : "file"), n.rel ? dot(corRel(n.rel)) : null, h("span", { class: "n" }, cod), h("span", { class: "nm" }, nome)));
    if (temFilhos && aberto) n.filhos.forEach(c => desenhar(c, nivel + 1));
  };
  raizes.forEach(c => desenhar(c, 0));
  if (semCod.length && !visivel) { out.push(h("div", { class: "sl" }, "Sem código")); semCod.forEach(r => out.push(linhaRel(r))); }
  return out;
}
function resultadosBusca(q) {
  const toks = norm(q).split(/\s+/).filter(Boolean), out = [];
  const casa = s => toks.every(t => norm(s).includes(t));
  const rels = relsOrdenados().filter(r => casa(`${codigoRel(r)} ${nomeCurto(r)} ${r.dados.titulo} ${r.dados.id} ${r.dados.pasta.rotulo}`));
  const P = pastas(), pastasOk = Object.keys(P).filter(c => casa(`${c} ${P[c].nome || ""}`)).sort(cmpCodigo);
  const itens = [];
  Object.values(REL).forEach(r => r.dados.secoes.forEach(sec => {
    if (sec.tipo === "texto") sec.capitulos.forEach(c => c.paragrafos.forEach(p => { if (casa(`${p.id} ${textoDe(r, sec, p)}`)) itens.push({ r, num: p.id, titulo: textoDe(r, sec, p).slice(0, 80), alvo: `P:${sec.num}:${p.id}` }); }));
    else sec.itens.forEach(it => { if (casa(`${it.num} ${it.titulo} ${it.texto}`)) itens.push({ r, num: it.num, titulo: it.titulo, alvo: it.num }); });
  }));
  if (rels.length) { out.push(h("div", { class: "sl" }, "Relatórios")); rels.forEach(r => out.push(linhaRel(r))); }
  if (pastasOk.length) {
    out.push(h("div", { class: "sl" }, "Pastas"));
    pastasOk.forEach(c => out.push(h("button", { type: "button", class: "row", onclick: () => { PREF.pastaSel = c; PREF.abertos[c] = true; let p = pastaPai(c); while (p) { PREF.abertos[p] = true; p = pastaPai(p); } BUSCA = ""; salvarPref(); ir("inicio"); } }, ico("folder"), h("span", { class: "n" }, c), h("span", { class: "nm" }, P[c].nome || c))));
  }
  if (itens.length) { out.push(h("div", { class: "sl" }, `Itens (${itens.length > 40 ? "40+" : itens.length})`)); itens.slice(0, 40).forEach(x => out.push(h("button", { type: "button", class: "row", onclick: () => abrirRelatorio(x.r.id, x.alvo), title: x.titulo }, h("span", { class: "n" }, x.num), h("span", { class: "nm" }, x.titulo || "(sem título)"), h("span", { class: "dir" }, codigoRel(x.r))))); }
  if (!out.length) out.push(h("div", { class: "vazio-lat" }, "Nada encontrado."));
  return out;
}

/* ================= barra inferior (celular) ================= */
function desenharNav() {
  const N = $("#nav"); N.replaceChildren();
  if (!CEL) return;
  const ativo = (TELAS[VISTA] && TELAS[VISTA].nav) || "inicio";
  const b = (k, t, i, fn) => h("button", { type: "button", class: ativo === k ? "on" : "", "aria-current": ativo === k ? "page" : null, onclick: fn }, ico(i), t);
  ap(N, b("inicio", "Início", "home", () => ir("inicio")),
    b("rel", "Relatório", "eye", () => { if (relAtual()) ir("rel"); else { const r = relsOrdenados()[0]; if (r) abrirRelatorio(r.id); else aviso("Nenhum relatório ainda."); } }),
    b("mesa", "Mesa PDF", "layers", () => ir("mesa")),
    b("doc", "Documentos", "doc", () => ir("docs")));
}

/* ================= início ================= */
TELAS.inicio = {
  nav: "inicio",
  topo(T) { ap(T, botaoLat(), h("span", { class: "ttl" }, CEL ? "Omega" : "Início")); },
  corpo(m) {
    const col = h("div", { class: "col" }); ap(m, col);
    const rels = relsOrdenados(), comPend = rels.filter(r => contarPendencias(r) > 0).length;
    const hoje = new Date(), dataHoje = `${pad(hoje.getDate())}/${pad(hoje.getMonth() + 1)}/${hoje.getFullYear()}`;
    if (CEL) ap(col, h("div", { style: "margin-bottom:6px" }, caixaBusca("busca-ini")));
    else ap(col, h("h1", { class: "rt" }, "Início"), h("div", { class: "meta" }, `${comPend} relatório${comPend === 1 ? "" : "s"} com pendência · ${dataHoje}`));
    avisoBanco(col);
    if (CEL && BUSCA.trim()) { ap(col, h("div", { class: "lista-ini" }, ...conteudoLista(true))); return; }
    if (!rels.length) {
      ap(col, h("div", { class: "vazio" }, h("b", {}, Banco.estado === "conectando" ? "Carregando os relatórios…" : "Nenhum relatório ainda."),
        h("span", {}, "Na conversa do objeto, peça ao Claude o relatório no Omega. Ele aparece aqui sozinho."),
        h("button", { type: "button", class: "btn", onclick: abrirExemplo }, "Abrir exemplo")));
    } else {
      ap(col, h("div", { class: "sl", style: "padding-left:0" }, "Últimos trabalhados"));
      const ult = rels.slice(0, 3);
      if (CEL) ult.forEach(r => ap(col, h("button", { type: "button", class: "mcard cartao-rel", onclick: () => abrirRelatorio(r.id) },
        h("span", {}, dot(corRel(r)), h("b", { style: "margin-left:6px" }, codigoRel(r)), " ", nomeCurto(r)), h("span", { class: "sub" }, `${resumoPend(r)} · ${dataCurta(ultimaAtividade(r))}`))));
      else ap(col, h("div", { class: "cards3" }, ult.map(r => h("button", { type: "button", class: "card cartao-rel", onclick: () => abrirRelatorio(r.id) },
        h("span", { style: "display:flex;gap:8px;align-items:center" }, dot(corRel(r)), h("span", { class: "sub" }, codigoRel(r) || "sem código")),
        h("span", { class: "nm" }, nomeCurto(r)), h("span", { class: "sub" }, `${resumoPend(r)} · rev ${r.dados.rev}`)))));
    }
    blocoPrazos(col, rels);
    if (CEL) { ap(col, h("div", { class: "lista-ini" }, ...conteudoLista(true))); return; }
    blocoPasta(col, rels);
  }
};
function resumoPend(r) {
  const c = contar(r); const n = c.vermelho + c.azul;
  if (!c.total) return "sem decisões";
  if (!n) return "tudo verde · pronto p/ documento";
  if (!c.vermelho) return `${n} decis${n === 1 ? "ão" : "ões"}`;
  return `${n} pendência${n === 1 ? "" : "s"}`;
}
function avisoBanco(col) {
  if (Banco.estado === "local") ap(col, h("div", { class: "card", style: "margin:0 0 14px;border-color:var(--cr-bd)" }, h("b", {}, "Sem banco nesta tela. "), h("span", { class: "mut" }, "As decisões ficam só neste aparelho até o Omega abrir dentro do Claude.")));
}
function diasAte(data) {
  let d = null; const m1 = String(data).match(/^(\d{4})-(\d{2})-(\d{2})/), m2 = String(data).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m1) d = new Date(+m1[1], +m1[2] - 1, +m1[3]); else if (m2) d = new Date(+m2[3], +m2[2] - 1, +m2[1]);
  if (!d || isNaN(d)) return null;
  const hoje = new Date(); const h0 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return { dias: Math.round((d - h0) / 864e5), d };
}
function blocoPrazos(col, rels) {
  const ps = [];
  rels.forEach(r => r.dados.prazos.forEach(p => { const x = diasAte(p.data); if (x) ps.push(Object.assign({ r }, p, x)); }));
  if (!ps.length) return;
  ps.sort((a, b) => a.dias - b.dias || ((b.tipo === "oficio") - (a.tipo === "oficio")));
  ap(col, h("div", { class: "sl", style: "padding-left:0;margin-top:18px" }, "Prazos"),
    h("div", { class: "card lista-card" }, ps.slice(0, 12).map(p => h("button", { type: "button", class: "prazo", style: "width:100%;text-align:left", onclick: () => abrirRelatorio(p.r.id) },
      h("span", { class: "d" }, `${pad(p.d.getDate())}/${pad(p.d.getMonth() + 1)}`), h("span", {}, p.titulo, h("span", { class: "sub" }, ` · ${codigoRel(p.r)} ${nomeCurto(p.r)}`)),
      h("span", { class: "rest" + (p.dias <= 3 ? " urg" : "") }, p.dias < 0 ? `vencido há ${-p.dias} dia${p.dias === -1 ? "" : "s"}` : p.dias === 0 ? "hoje" : `${p.dias} dia${p.dias === 1 ? "" : "s"}`)))));
}
function blocoPasta(col, rels) {
  let sel = PREF.pastaSel;
  if (!sel || !(pastas()[sel] || Object.values(REL).some(r => pastaPai(codigoRel(r)) === sel))) { const r = rels.find(x => pastaPai(codigoRel(x))); sel = r ? pastaPai(codigoRel(r)) : null; }
  if (!sel) return;
  const caminho = []; let p = sel; while (p) { caminho.unshift(`${p} ${nomePasta(p)}`); p = pastaPai(p); }
  const filhos = Object.values(REL).filter(r => pastaPai(codigoRel(r)) === sel).sort((a, b) => cmpCodigo(codigoRel(a), codigoRel(b)));
  const subp = Object.keys(pastas()).filter(c => pastaPai(c) === sel).sort(cmpCodigo);
  ap(col, h("div", { class: "sl", style: "padding-left:0;margin-top:18px" }, caminho.join(" › ").toUpperCase()));
  const box = h("div", { class: "card lista-card" });
  subp.forEach(c => ap(box, h("button", { type: "button", class: "row", onclick: () => { PREF.pastaSel = c; PREF.abertos[c] = true; salvarPref(); montar({ forcar: true }); } }, ico("folder"), h("span", { class: "n" }, c), h("span", { class: "nm" }, nomePasta(c)))));
  filhos.forEach(r => ap(box, h("button", { type: "button", class: "row", onclick: () => abrirRelatorio(r.id) }, dot(corRel(r)), h("span", { class: "n" }, codigoRel(r)), h("span", { class: "nm" }, r.dados.pasta.rotulo || nomeCurto(r)), h("span", { class: "dir" }, dataCurta(ultimaAtividade(r))))));
  if (!subp.length && !filhos.length) ap(box, h("div", { class: "row mut" }, "Pasta vazia."));
  ap(col, box);
  const rd = (pastas()[sel] || {}).readme;
  if (rd) ap(col, h("div", { class: "card", style: "margin-top:18px" }, h("div", { class: "sub" }, `README da pasta ${sel} (memorial)`), h("div", { style: "margin-top:4px;color:var(--stx);white-space:pre-wrap" }, rd)));
}
async function abrirExemplo() {
  try {
    const r = await fetch("exemplo.json"); const d = normalizar(await r.json());
    d.id = "exemplo-local"; d.exemplo = true;
    if (!REL[d.id]) { const rel = novaRel(d); rel.local = true; REL[d.id] = rel; Banco.salvarLocais(); }
    abrirRelatorio(d.id);
  } catch (e) { aviso("Não consegui abrir o exemplo."); }
}

/* ================= relatório ================= */
TELAS.rel = {
  nav: "rel",
  topo(T) { topoRelatorio(T, "rel"); },
  corpo(m) {
    const rel = relAtual(); if (!rel) { VISTA = "inicio"; TELAS.inicio.corpo(m); return; }
    PREF.visto[rel.id] = Date.now(); salvarPref();
    const col = h("div", { class: "col", id: "col-rel" }); ap(m, col);
    ap(col, cabecalhoRel(rel));
    if (rel.novaLeva) { rel.novaLeva = false; setTimeout(() => aviso(`Nova revisão (rev ${rel.dados.rev}) carregada. Suas decisões foram mantidas.`), 50); }
    if (!rel.dados.secoes.length) ap(col, h("div", { class: "card" }, h("b", {}, "Objeto sem relatório. "), "Peça o relatório ao Claude usando este código: ", copiaLinha(rel.dados.id)));
    const fi = fichaEl(rel); if (fi) ap(col, fi);
    const ent = recebidosEl(rel); if (ent) ap(col, ent);
    rel.dados.secoes.forEach(sec => ap(col, secaoEl(rel, sec)));
  }
};
function topoRelatorio(T, ativo) {
  const rel = relAtual();
  if (CEL) {
    ap(T, botaoLat(), h("span", { class: "ttl" }, ativo === "resposta" ? "Resposta ao Claude" : rel ? nomeRel(rel) : "Relatório"),
      h("button", { class: "ib" + (ativo === "rel" ? " on" : ""), type: "button", title: "Relatório", "aria-label": "Relatório", onclick: () => ir("rel") }, ico("eye")),
      h("button", { class: "ib", type: "button", title: "Documento", "aria-label": "Documento", onclick: e => abrirDocumento(rel, e.currentTarget) }, ico("doc")),
      h("button", { class: "ib" + (ativo === "resposta" ? " on" : ""), type: "button", title: "Copiar e enviar", "aria-label": "Copiar e enviar", onclick: e => menuCopiar(e.currentTarget) }, ico("copy")),
      h("button", { class: "ib", type: "button", title: "Foco", "aria-label": "Foco", onclick: e => menuFoco(e.currentTarget) }, ico("focus")),
      rel ? elEnviar(rel, { class: "ib", title: "Enviar ao Claude", "aria-label": "Enviar ao Claude" }, ico("send")) : null);
    return;
  }
  const tb = (rot, i, fn, on, attrs) => h("button", Object.assign({ type: "button", class: "tb" + (on ? " on" : ""), title: rot, onclick: fn }, attrs || {}), ico(i), h("span", { class: "tbl" }, rot));
  ap(T, botaoLat(), h("span", { class: "ttl" }, rel ? rel.dados.titulo : "Relatório"),
    tb("Relatório", "eye", () => ir("rel"), ativo === "rel"),
    tb("PDF", "file", () => rel && previaRelatorio(rel)),
    tb("Documento", "doc", e => abrirDocumento(rel, e.currentTarget)),
    tb("Resposta", "spark", () => ir("resposta"), ativo === "resposta"),
    h("span", { class: "sep" }),
    tb("Copiar relatório", "copy", e => menuCopiar(e.currentTarget), false, { "aria-haspopup": "menu" }),
    tb("Copiar item", "copy", () => copiarSaida(true)),
    tb("Foco", "focus", e => menuFoco(e.currentTarget), false, { "aria-haspopup": "menu" }));
}
function progEl(c) {
  return h("span", { class: "prog", id: "prog-rel", title: `${c.verde} de ${c.total} resolvidos` },
    c.vermelho ? h("span", {}, dot("r"), c.vermelho) : null, c.verde ? h("span", {}, dot("g"), c.verde) : null, c.azul ? h("span", {}, dot("b"), c.azul) : null,
    c.total ? h("span", { class: "mut", style: "font-size:11.5px" }, `${c.verde} de ${c.total}`) : null);
}
function cabecalhoRel(rel) {
  const d = rel.dados, cod = codigoRel(rel), pai = pastaPai(cod);
  const quando = Date.parse(d.atualizado) || rel.remotoEm;
  return h("div", { id: "cab-rel" }, h("h1", { class: "rt" }, d.titulo),
    h("div", { class: "meta" }, cod ? h("span", {}, `${cod}${pai ? " · " + nomePasta(pai).toUpperCase() : ""}`) : null, h("span", {}, `rev ${d.rev}`),
      quando ? h("span", {}, `atualizado ${dataHora(quando)}`) : null, d.exemplo ? h("span", { class: "ex" }, "exemplo") : null, progEl(contar(rel))));
}
function atualizarCabecalho(rel) { const c = $("#cab-rel"); if (c) c.replaceWith(cabecalhoRel(rel)); }
function rotuloSecao(rel, sec, aberto) {
  if (sec.tipo === "texto") { const n = sec.capitulos.reduce((a, c) => a + c.paragrafos.length, 0); return aberto ? `texto · ${n} parágrafo${n === 1 ? "" : "s"}` : "texto"; }
  if (sec.itens.length && sec.itens.every(it => it.tabela)) return sec.itens.length === 1 ? "tabela" : `${sec.itens.length} tabelas`;
  return `${sec.itens.length} ite${sec.itens.length === 1 ? "m" : "ns"}`;
}
function dots3(c) { return [c.vermelho ? h("span", {}, dot("r"), c.vermelho) : null, c.verde ? h("span", {}, dot("g"), c.verde) : null, c.azul ? h("span", {}, dot("b"), c.azul) : null]; }
function secaoEl(rel, sec) {
  const ab = ABERTAS[rel.id] = ABERTAS[rel.id] || {};
  const aberto = !!ab[sec.num], c = contar(rel, sec);
  const el = h("section", { class: "sec", "data-sec": sec.num, id: "sec-" + sec.num });
  ap(el, h("button", { type: "button", class: "sec-h", "aria-expanded": aberto ? "true" : "false", onclick: () => { ab[sec.num] = !aberto; redesenharSecao(rel, sec); } },
    h("span", { class: "chev" }, ico(aberto ? "cl" : "cr")), h("span", { class: "n" }, sec.num), h("span", { class: "tt" }, sec.titulo),
    h("span", { class: "cnt" }, ...dots3(c), " ", rotuloSecao(rel, sec, aberto))));
  if (!aberto) return el;
  if (sec.tipo === "texto") ap(el, ...textoEl(rel, sec));
  else {
    let mostrou = 0;
    sec.itens.forEach(it => { if (PREF.soPend && itemResolvido(rel, it)) return; mostrou++; ap(el, it.tabela ? tabelaItemEl(rel, sec, it) : itemEl(rel, sec, it)); });
    if (!mostrou) ap(el, h("div", { class: "it mut" }, "Tudo resolvido nesta seção."));
  }
  return el;
}
function itemResolvido(rel, it) {
  if (it.tabela) return alvosSecao(rel, { tipo: "itens", itens: [it] }).every(f => corAlvo(rel, f) === "verde");
  if (!acionavel(it)) return true;
  return resolvido(kind(valorItem(rel, it)));
}
/* redesenha uma seção sem a tela pular: o elemento tocado (âncora) fica no mesmo lugar */
function redesenharSecao(rel, sec, focarSel, ancora) {
  const velho = document.querySelector(`section[data-sec="${CSS.escape(sec.num)}"]`);
  const sel = ancora ? `[data-fk="${CSS.escape(ancora)}"]` : null;
  const a0 = sel && document.querySelector(sel), y0 = a0 ? a0.getBoundingClientRect().top : null;
  const novo = secaoEl(rel, sec);
  if (velho) velho.replaceWith(novo); else { const col = $("#col-rel"); if (col) ap(col, novo); }
  if (y0 != null) { const a1 = document.querySelector(sel); if (a1) { const d = a1.getBoundingClientRect().top - y0; if (Math.abs(d) > 1) scrollBy({ top: d, behavior: "instant" }); } }
  atualizarCabecalho(rel);
  const L = $("#lat .lat-lista"); if (L) { const sy = L.scrollTop; L.replaceChildren(...conteudoLista()); L.scrollTop = sy; }
  if (focarSel && !CEL) { const e = document.querySelector(focarSel); if (e) e.focus({ preventScroll: true }); }
}
function redesenharTudo() { const y = scrollY; montar({ forcar: true }); scrollTo(0, y); }

/* ---- item ---- */
function chipEl(rel, f, valor, tipo, extraCls) {
  const b = h("button", { type: "button", class: `chip ${corChip(valor, tipo)}${extraCls ? " " + extraCls : ""}`, "data-chip": chave(f), "aria-haspopup": "listbox", title: "Escolher" }, valor, ico("cl"));
  b.addEventListener("click", e => { e.stopPropagation(); abrirEscolhas(rel, f, b); });
  b.addEventListener("keydown", e => { if (e.key === "ArrowDown") { e.preventDefault(); abrirEscolhas(rel, f, b); } });
  return b;
}
function copiaLinha(texto) {
  const url = /^https?:\/\//i.test(texto);
  return h("div", { class: "copia-l" }, url ? h("code", {}, h("a", { href: texto, target: "_blank", rel: "noopener" }, texto)) : h("code", {}, texto),
    h("button", { type: "button", class: "btn sm", onclick: e => { e.stopPropagation(); copiar(texto, "Copiado."); } }, ico("copy"), "Copiar"));
}
function itemEl(rel, sec, it) {
  const f = { t: "I", num: it.num }, k = chave(f), st = rel.st[k] || {}, v = valorItem(rel, it), kd = kind(v);
  const bloq = acionavel(it) && bloqueado(rel, it), emFoco = rel.foco && chave(rel.foco) === k;
  const el = h("div", { class: "it" + (emFoco ? " foco" : "") + (bloq ? " bloq" : "") + (kd === "ign" ? " ign" : ""), "data-fk": k, id: "it-" + it.num.replace(/[^\w-]/g, "_") });
  ap(el, h("div", { class: "it-h" }, h("span", { class: "n" }, it.num), h("span", { class: "it-t" }, it.titulo || "(sem título)"), h("span", { class: "tag" }, TIPO_ROT[it.tipo] || it.tipo)));
  if (it.texto) ap(el, h("div", { class: "it-x" }, it.texto));
  const a = h("div", { class: "it-a" }, chipEl(rel, f, v, it.tipo));
  if (!CEL && it.tipo === "acao" && (kd === "pend" || kd === "nao")) ["Feito", "Ignorar"].forEach(o => ap(a, h("button", { type: "button", class: "chip cn leve", title: `Marcar ${o}`, onclick: e => { e.stopPropagation(); escolherDireto(rel, f, o); } }, o)));
  ap(el, a);
  if (it.dependeDe.length || it.bloqueia.length) ap(el, h("div", { class: "it-dep" },
    it.dependeDe.length ? h("span", {}, "Depende de ", ligacoes(it.dependeDe)) : null, it.bloqueia.length ? h("span", {}, "Bloqueia ", ligacoes(it.bloqueia)) : null));
  if (bloq) ap(el, h("div", { class: "aviso-dep" }, "Aguardando o item de que depende."));
  if (it.caminhos.length) ap(el, h("div", { class: "cams" }, it.caminhos.map(copiaLinha)));
  if (st.notas && st.notas.length) ap(el, h("div", { class: "notas" }, st.notas.map(n => h("div", {}, "🎙 ", n))));
  if (emFoco || st.obs) ap(el, caixaComentario(rel, f, "Comentário (opcional)…"));
  el.addEventListener("click", e => { if (e.target.closest("button,a,textarea,input,.cm")) return; definirFoco(rel, f); });
  return el;
}
function ligacoes(nums) { const sp = h("span", {}); nums.forEach((n, i) => { if (i) sp.append(", "); sp.append(h("a", { role: "link", tabindex: "0", onclick: e => { e.stopPropagation(); irPara(n); } }, n)); }); return sp; }
/* foco: só troca a marcação e acrescenta a caixa de comentário abaixo do item tocado (nada acima dele se move) */
function definirFoco(rel, f) {
  const k = chave(f), antes = rel.foco ? chave(rel.foco) : null;
  if (antes === k) return;
  rel.foco = f; Banco.marcar(rel, null);
  $$("#main .it.foco, #main .par.foco").forEach(e => e.classList.remove("foco"));
  if (f.t === "P") {
    const el = document.querySelector(`.par[data-fk="${CSS.escape(k)}"]`); if (el) el.classList.add("foco");
    const sec = secDe(rel, f.sec), p = parDe(rel, f), area = document.querySelector(`[data-cmarea="${CSS.escape(sec.num)}"]`);
    if (area && p) area.replaceWith(areaParagrafo(rel, sec, p));
    return;
  }
  const kIt = f.t === "C" || f.t === "T" ? `I:${f.num}` : k;
  const el = document.querySelector(`.it[data-fk="${CSS.escape(kIt)}"]`);
  if (!el) return;
  el.classList.add("foco");
  if (!el.querySelector(":scope > .cm") && (f.t === "I" || f.t === "C" || f.t === "T")) {
    const it = achar(rel, f.num);
    const cm = caixaComentario(rel, { t: "I", num: f.num }, it && it.tabela ? "Comentário sobre a tabela…" : "Comentário (opcional)…");
    if (it && it.tabela) cm.style.marginLeft = "0";
    ap(el, cm);
  }
}
function secDaChave(rel, k) {
  const p = k.split(":");
  if (p[0] === "P" || p[0] === "K") return secDe(rel, p[1]);
  if (p[0] === "I" || p[0] === "C" || p[0] === "T") return secDoItem(rel, p[1]);
  return null;
}
function escolherDireto(rel, f, valor) {
  const antes = clone(rel.st);
  aplicarValor(rel, f, valor, null, false);
  definirFocoSilencioso(rel, f);
  const sec = secDaChave(rel, chave(f)); if (sec) redesenharSecao(rel, sec, `[data-chip="${CSS.escape(chave(f))}"]`, chave(f));
  aviso(`Registrado: ${valor}.`, () => desfazer(rel, antes), "Desfazer");
}
function definirFocoSilencioso(rel, f) { rel.foco = f; Banco.marcar(rel, null); }
function desfazer(rel, antes) {
  const t = Date.now();
  new Set([...Object.keys(rel.st), ...Object.keys(antes)]).forEach(k => {
    if (JSON.stringify(rel.st[k]) === JSON.stringify(antes[k])) return;
    rel.st[k] = antes[k] ? Object.assign(clone(antes[k]), { t, rev: rel.dados.rev }) : { t, rev: rel.dados.rev };
    Banco.marcar(rel, k);
  });
  redesenharTudo(); aviso("Desfeito.");
}

/* ---- caixa de comentário: toque duplo (celular) ou clique (computador) para escrever ---- */
function caixaComentario(rel, f, placeholder) {
  const k = chave(f), s = rel.st[k] || {};
  const box = h("div", { class: "cm", "data-cm": k });
  const mostrar = () => {
    const txt = (rel.st[k] || {}).obs || "";
    box.replaceChildren(ico("pen", "color:var(--ic);margin-top:2px"), h("span", { class: "t" + (txt ? " cheio" : "") }, txt || (toqueGrosso() ? placeholder.replace(/…$/, "") + " · toque duplo" : placeholder)),
      h("button", { type: "button", class: "mic", title: "Ditar (Ctrl+Shift+M)", "aria-label": "Ditar", onclick: e => { e.stopPropagation(); const ta = editar(); Ditado.iniciar(ta); } }, ico("mic")));
    box.classList.remove("on");
  };
  let ta = null, tSalvar = null;
  const salvarObs = () => { const novo = ta.value.replace(/\s+$/, ""); const st2 = stOf(rel, k); if ((st2.obs || "") === novo) return; st2.obs = novo; tocar(rel, k); };
  const editar = () => {
    if (ta && box.contains(ta)) return ta;
    definirFocoSilencioso(rel, f);
    ta = h("textarea", { rows: "1", "aria-label": placeholder, placeholder });
    ta.value = (rel.st[k] || {}).obs || "";
    const auto = () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; };
    ta.addEventListener("input", () => { auto(); clearTimeout(tSalvar); tSalvar = setTimeout(salvarObs, 700); });
    ta.addEventListener("keydown", e => { if (e.key === "Escape") { e.preventDefault(); ta.blur(); } });
    ta.addEventListener("blur", () => { clearTimeout(tSalvar); salvarObs(); if (Ditado.alvo === ta) return; setTimeout(() => { if (document.activeElement !== ta && Ditado.alvo !== ta) { mostrar(); atualizarCabecalho(rel); } }, 120); });
    box.replaceChildren(ico("pen", "color:var(--ic);margin-top:2px"), ta,
      h("button", { type: "button", class: "mic", title: "Ditar (Ctrl+Shift+M)", "aria-label": "Ditar", onmousedown: e => e.preventDefault(), onclick: e => { e.stopPropagation(); Ditado.alternar(ta); } }, ico("mic")));
    box.classList.add("on");
    ta.focus(); try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) {}
    auto();
    return ta;
  };
  box.editar = editar;
  mostrar();
  box.addEventListener("click", e => { if (e.target.closest(".mic") || box.contains(ta) && ta && box.contains(ta)) return; if (!toqueGrosso()) editar(); });
  aoToqueDuplo(box, k + ":cm", () => editar());
  return box;
}
/* toque duplo pelo tempo entre dois toques (o elemento pode ser redesenhado entre eles) */
function aoToqueDuplo(el, chaveT, fn) {
  el.addEventListener("pointerup", e => {
    if (e.pointerType === "mouse") return;
    const t = Date.now(), u = ULT_TOQUE[chaveT];
    if (u && t - u.t < 380 && Math.abs(u.x - e.clientX) < 30 && Math.abs(u.y - e.clientY) < 30) { delete ULT_TOQUE[chaveT]; e.preventDefault(); fn(e); }
    else ULT_TOQUE[chaveT] = { t, x: e.clientX, y: e.clientY };
  });
  el.addEventListener("dblclick", e => { if (!toqueGrosso()) fn(e); });
}

/* ---- tabela: no computador, tabela; no celular, cartões ---- */
const REG_NUM = /^[\s\-+R$€%.,\d]+$/, REG_DATA = /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/;
function papelColunas(it) {
  const t = it.tabela, n = t.colunas.length, pap = [];
  for (let j = 0; j < n; j++) {
    const cel = t.linhas.filter(l => !linhaTotal(l)).map(l => l[j]).filter(x => x != null && x !== "");
    if (cel.length && cel.every(x => typeof x === "object" && x.chip)) pap.push("chip");
    else if (cel.length && cel.every(x => typeof x !== "object" && (REG_NUM.test(String(x)) || REG_DATA.test(String(x))))) pap.push("num");
    else { const media = cel.reduce((a, x) => a + String(x && typeof x === "object" ? (x.texto || x.caminho || "") : x).length, 0) / (cel.length || 1); pap.push(media > 45 ? "longo" : media <= 4 ? "curto" : "texto"); }
  }
  return pap;
}
function linhaTotal(l) { return l.some(x => typeof x === "string" && /^total\b/i.test(x.trim())); }
function valorCelula(rel, it, r, c) { const s = rel.st[`T:${it.num}:${r}:${c}`]; const x = it.tabela.linhas[r][c]; const orig = x == null ? "" : typeof x === "object" ? (x.texto != null ? String(x.texto) : x.caminho || "") : String(x); return s && s.texto != null && (s.base == null || s.base === orig) ? { v: s.texto, alt: true, orig } : { v: orig, alt: false, orig }; }
function tabelaItemEl(rel, sec, it) {
  const f = { t: "I", num: it.num }, k = chave(f), st = rel.st[k] || {}, emFoco = rel.foco && chave(rel.foco).includes(":" + it.num);
  const t = it.tabela, pap = papelColunas(it), temCel = pap.includes("chip");
  const el = h("div", { class: "it tab-it" + (emFoco ? " foco" : ""), "data-fk": k, id: "it-" + it.num.replace(/[^\w-]/g, "_") });
  ap(el, h("div", { class: "sub", style: "margin-bottom:6px" }, `${it.titulo ? it.titulo + " – " : ""}${CEL ? "toque duplo no cartão para editar" : "toque duplo na célula para editar"}`));
  if (it.texto) ap(el, h("div", { class: "it-x", style: "margin-left:0" }, it.texto));
  if (CEL) ap(el, ...cartoesTabela(rel, it, pap));
  else {
    const thead = h("tr", {}, t.colunas.map((c, j) => h("th", { class: pap[j] === "num" ? "r" : pap[j] === "chip" ? "" : "" }, c.nome)));
    const corpo = h("tbody", {});
    t.linhas.forEach((ln, r) => {
      const tot = linhaTotal(ln), tr = h("tr", { class: tot ? "total" : "" });
      t.colunas.forEach((c, j) => {
        const x = ln[j];
        if (x && typeof x === "object" && x.chip) {
          const fc = { t: "C", num: it.num, r, c: j }, s = rel.st[chave(fc)], v = s && s.v != null ? s.v : (x.chip.valor || "A fazer");
          ap(tr, h("td", { "data-fk": chave(fc) }, chipEl(rel, fc, v, x.chip.tipo === "decisao" ? "decisao" : "acao"), s && s.obs ? h("div", { class: "sub", style: "margin-top:4px" }, s.obs) : null));
          return;
        }
        if (x && typeof x === "object" && x.caminho) { ap(tr, h("td", {}, copiaLinha(x.caminho))); return; }
        const vc = valorCelula(rel, it, r, j);
        const td = h("td", { class: [pap[j] === "num" ? "r" : pap[j] === "longo" ? "j" : "", (j === 1 || (pap[j] === "num" && j === t.colunas.length - 1 - (pap[pap.length - 1] === "chip" ? 1 : 0))) ? "forte" : "", vc.alt ? "alterada" : "", "editavel"].filter(Boolean).join(" "), title: vc.alt ? `Original: ${vc.orig}` : null }, vc.v);
        td.addEventListener("dblclick", () => editarCelula(rel, it, r, j, td));
        ap(tr, td);
      });
      ap(corpo, tr);
    });
    ap(el, h("div", { class: "tabw" }, h("table", { class: "tb2" }, h("thead", {}, thead), corpo)));
  }
  if (acionavel(it) && !temCel) ap(el, h("div", { class: "it-a", style: "margin:10px 0 0" }, chipEl(rel, f, valorItem(rel, it), it.tipo)));
  if (it.caminhos.length) ap(el, h("div", { class: "cams", style: "margin-left:0" }, it.caminhos.map(copiaLinha)));
  if (emFoco || st.obs) { const cm = caixaComentario(rel, f, "Comentário sobre a tabela…"); cm.style.marginLeft = "0"; ap(el, cm); }
  el.addEventListener("click", e => { if (e.target.closest("button,a,textarea,input,.cm,td[contenteditable]")) return; definirFoco(rel, f); });
  return el;
}
function cartoesTabela(rel, it, pap) {
  const t = it.tabela, out = [];
  const iChip = pap.indexOf("chip"), nums = pap.map((p, j) => p === "num" && j > 0 ? j : -1).filter(j => j >= 0);
  const iDesc = pap.findIndex((p, j) => j > 0 && (p === "texto" || p === "longo")), iUn = pap.findIndex((p, j) => j > 0 && p === "curto");
  const nomes = t.colunas.map(c => norm(c.nome));
  const vezes = nums.length >= 3 && nomes.some(n => /qt|quant/.test(n)) && nomes.some(n => /unit/.test(n));
  t.linhas.forEach((ln, r) => {
    const val = j => valorCelula(rel, it, r, j).v;
    if (linhaTotal(ln)) { const ult = nums.length ? val(nums[nums.length - 1]) : ""; out.push(h("div", { class: "mcard total" }, h("div", { class: "k" }, h("span", {}, "Total"), h("span", { style: "color:var(--tx);font-weight:600" }, ult)))); return; }
    const chipCel = iChip >= 0 && ln[iChip] && ln[iChip].chip ? (() => { const fc = { t: "C", num: it.num, r, c: iChip }, s = rel.st[chave(fc)]; return chipEl(rel, fc, s && s.v != null ? s.v : (ln[iChip].chip.valor || "A fazer"), ln[iChip].chip.tipo === "decisao" ? "decisao" : "acao"); })() : null;
    const card = h("div", { class: "mcard", "data-fk": iChip >= 0 ? `C:${it.num}:${r}:${iChip}` : null });
    ap(card, h("div", { class: "k" }, h("span", {}, [val(0), iUn >= 0 ? val(iUn) : ""].filter(Boolean).join(" · ")), chipCel));
    if (iDesc >= 0) ap(card, h("div", { class: "tit" }, val(iDesc)));
    const usados = new Set([0, iChip, iDesc, iUn]);
    if (nums.length) {
      const ult = nums[nums.length - 1], antes = nums.slice(0, -1);
      ap(card, h("div", { class: "k" }, h("span", {}, antes.map(val).join(vezes ? " × " : " · ")), h("span", { style: "color:var(--tx)" }, val(ult))));
      nums.forEach(j => usados.add(j));
    }
    t.colunas.forEach((c, j) => { if (usados.has(j)) return; const x = ln[j]; if (x && typeof x === "object" && x.caminho) { ap(card, copiaLinha(x.caminho)); return; } const v = val(j); if (v) ap(card, h("div", { class: "kv" }, h("span", {}, c.nome), h("span", {}, v))); });
    aoToqueDuplo(card, `card:${it.num}:${r}`, () => editarLinhaDialogo(rel, it, r, pap));
    out.push(card);
  });
  return out;
}
function salvarCelula(rel, it, r, c, novo) {
  const k = `T:${it.num}:${r}:${c}`, vc = valorCelula(rel, it, r, c);
  if (novo === vc.v) return false;
  const s = stOf(rel, k); s.base = vc.orig; s.texto = novo === vc.orig ? null : novo; s.alterado = s.texto != null; tocar(rel, k); return true;
}
function editarCelula(rel, it, r, c, td) {
  const original = td.textContent;
  try { td.contentEditable = "plaintext-only"; } catch (e) {}
  if (!td.isContentEditable) td.contentEditable = "true";
  td.focus();
  const sel = getSelection(), rg = document.createRange(); rg.selectNodeContents(td); sel.removeAllRanges(); sel.addRange(rg);
  let cancel = false;
  const tecla = e => { if (e.key === "Escape") { cancel = true; td.blur(); } else if (e.key === "Enter") { e.preventDefault(); td.blur(); } };
  td.addEventListener("keydown", tecla);
  td.addEventListener("blur", () => {
    td.removeEventListener("keydown", tecla); td.removeAttribute("contenteditable");
    const novo = td.innerText.replace(/\n+/g, " ").trim();
    if (!cancel && novo !== original) { salvarCelula(rel, it, r, c, novo); aviso("Célula alterada."); }
    const sec = secDoItem(rel, it.num); if (sec) redesenharSecao(rel, sec);
  }, { once: true });
}
function editarLinhaDialogo(rel, it, r, pap) {
  const t = it.tabela, campos = [];
  t.colunas.forEach((c, j) => { if (pap[j] === "chip" || (t.linhas[r][j] && typeof t.linhas[r][j] === "object")) return; const inp = h("input", { type: "text", value: valorCelula(rel, it, r, j).v }); campos.push({ j, inp }); });
  dialogo(`${it.num} · linha ${r + 1}`, campos.map(x => h("label", {}, h("span", { class: "sub" }, t.colunas[x.j].nome), campoComMic(x.inp))), [
    { rotulo: "Cancelar" },
    { rotulo: "Salvar", pri: true, fn: () => { let n = 0; campos.forEach(x => { if (salvarCelula(rel, it, r, x.j, x.inp.value.trim())) n++; }); if (n) aviso(n === 1 ? "Célula alterada." : `${n} células alteradas.`); const sec = secDoItem(rel, it.num); if (sec) redesenharSecao(rel, sec); } }]);
}

/* ---- ficha do objeto (README / memorial descritivo da pasta), recolhida como as seções ---- */
function fichaEl(rel) {
  const d = rel.dados; if (!d.readme && !d.pasta.caminho) return null;
  const ab = ABERTAS[rel.id] = ABERTAS[rel.id] || {}, aberto = !!ab.__ficha;
  const el = h("section", { class: "sec", "data-sec": "__ficha" });
  ap(el, h("button", { type: "button", class: "sec-h", "aria-expanded": aberto ? "true" : "false", onclick: () => { ab.__ficha = !aberto; el.replaceWith(fichaEl(rel)); } },
    h("span", { class: "chev" }, ico(aberto ? "cl" : "cr")), h("span", { class: "n" }, "0"), h("span", { class: "tt" }, "Ficha do objeto (README)"), h("span", { class: "cnt" }, d.pasta.caminho ? "pasta" : "")));
  if (aberto) ap(el, h("div", { class: "it", style: "padding-left:30px" }, d.readme ? h("div", { class: "it-x", style: "margin-left:0;white-space:pre-wrap" }, d.readme) : null,
    d.pasta.caminho ? h("div", { class: "cams", style: "margin-left:0" }, copiaLinha(d.pasta.caminho)) : null, d.pasta.drive ? h("div", { class: "cams", style: "margin-left:0" }, copiaLinha(d.pasta.drive)) : null));
  return el;
}

/* ---- recebidos (entradas cadastradas pela Mesa PDF) ---- */
function recebidosEl(rel) {
  const ent = rel.entrada || []; if (!ent.length) return null;
  const el = h("section", { class: "sec" }, h("div", { class: "sec-h" }, h("span", { class: "chev" }), h("span", { class: "n" }, "R"), h("span", { class: "tt" }, "Recebidos"), h("span", { class: "cnt" }, `${ent.length}`)));
  ent.forEach(e => {
    const f = { t: "E", id: e.id }, s = rel.st[chave(f)] || {}, v = s.v || "Pendente";
    ap(el, h("div", { class: "it", "data-fk": chave(f) }, h("div", { class: "it-h" }, h("span", { class: "n" }, e.id), h("span", { class: "it-t" }, e.arquivo), h("span", { class: "tag" }, `p. ${e.paginas || "todas"}`)),
      e.destino ? h("div", { class: "it-x" }, "Destino: ", e.destino) : null, h("div", { class: "it-a" }, chipEl(rel, f, v, "acao"))));
  });
  return el;
}

/* ---- modo texto: bolinhas (toque troca a cor; segurar volta; toque duplo edita) ---- */
function textoEl(rel, sec) {
  const out = [];
  out.push(h("div", { class: "sub", style: "margin:6px 0 0 2px" }, CEL ? "Toque na bolinha para trocar a cor" : "Toque na bolinha para trocar a cor · toque duplo no texto para editar"));
  out.push(h("div", { class: "sec-ac", style: "margin-top:8px" },
    h("button", { type: "button", class: "btn sm", onclick: () => previaSecao(rel, sec) }, ico("eye"), "Prévia oficial"),
    h("button", { type: "button", class: "btn sm", onclick: () => revisarTudo(rel, sec) }, ico("spark"), "Revisar tudo"),
    h("button", { type: "button", class: "btn sm" + (PREF.revisar ? " pri" : ""), onclick: alternarRevisao, "aria-pressed": PREF.revisar ? "true" : "false" }, "Sublinhar erros"),
    h("button", { type: "button", class: "btn sm", onclick: () => copiar(textoSecao(rel, sec), "Texto inteiro copiado.") }, ico("copy"), "Copiar texto")));
  sec.capitulos.forEach(cap => {
    const fk = { t: "K", sec: sec.num, cap: cap.num }, stc = statusCap(rel, sec, cap);
    const tituloCap = cap.titulo ? (/^(documento)$/i.test(cap.titulo) ? cap.titulo : `${cap.num} – ${cap.titulo}`) : cap.num;
    out.push(h("div", { class: "cap", "data-fk": chave(fk) }, h("span", {}, tituloCap), dot(stc.cor === "verde" ? "g" : stc.cor === "azul" ? "b" : "r"), h("span", { class: "cnt" }, `${stc.verdes} de ${stc.total}`),
      h("span", { class: "cap-ac" }, chipEl(rel, fk, "Capítulo", "cap", "cn leve"), h("button", { type: "button", class: "btn sm", title: "Copiar capítulo", "aria-label": "Copiar capítulo", onclick: () => copiar(textoCapitulo(rel, sec, cap), "Capítulo copiado.") }, ico("copy")))));
    cap.paragrafos.forEach(p => { if (PREF.soPend && sitDe(rel, sec, p) === "verde") return; out.push(paragrafoEl(rel, sec, p)); });
  });
  const focado = rel.foco && rel.foco.t === "P" && rel.foco.sec === sec.num ? parDe(rel, rel.foco) : null;
  const alvoCm = focado || (sec.capitulos[0] && sec.capitulos[0].paragrafos[0]);
  if (alvoCm) out.push(areaParagrafo(rel, sec, alvoCm));
  return out;
}
/* fim da seção de texto: ações e comentário do parágrafo em foco (fica abaixo de tudo, para nada pular) */
function areaParagrafo(rel, sec, p) {
  const k = `P:${sec.num}:${p.id}`;
  const cm = caixaComentario(rel, { t: "P", sec: sec.num, id: p.id }, `Comentário do parágrafo ${p.id}…`); cm.style.marginLeft = "0";
  return h("div", { "data-cmarea": sec.num, style: CEL ? "" : "margin-left:26px" },
    h("div", { class: "par-ac", style: "margin:8px 0 0" }, h("span", { class: "sub", style: "align-self:center" }, `Parágrafo ${p.id}`),
      h("button", { type: "button", class: "btn sm", onclick: () => copiar(textoDe(rel, sec, p), "Parágrafo copiado.") }, ico("copy"), "Copiar"),
      h("a", { class: "btn sm", href: URLS.gemini, target: "_blank", rel: "noopener", onclick: () => copiar(PERGUNTA + "\n\n" + textoDe(rel, sec, p), "Copiado. Cole no Gemini.") }, ico("spark"), "Gemini"),
      h("button", { type: "button", class: "btn sm", onclick: () => { const pt = document.querySelector(`[data-pt="${CSS.escape(k)}"]`); if (pt) editarPar(rel, sec, p, pt); } }, ico("pen"), "Editar")),
    cm);
}
function paragrafoEl(rel, sec, p) {
  const f = { t: "P", sec: sec.num, id: p.id }, k = chave(f), st = rel.st[k] || {}, sit = sitDe(rel, sec, p), txt = textoDe(rel, sec, p);
  const emFoco = rel.foco && chave(rel.foco) === k;
  const dotb = h("span", { class: "dotb " + sit });
  const bol = h("button", { type: "button", class: "bol", "aria-label": `Parágrafo ${p.id}: ${ROTULO_SIT[sit]}. Toque para trocar; segure para voltar.` }, dotb);
  let longo = null, pular = false;
  bol.addEventListener("pointerdown", () => { pular = false; clearTimeout(longo); longo = setTimeout(() => { pular = true; mudarCor(rel, sec, p, CICLO_VOLTA[sitDe(rel, sec, p)]); }, 520); });
  ["pointerup", "pointerleave", "pointercancel"].forEach(ev => bol.addEventListener(ev, () => clearTimeout(longo)));
  bol.addEventListener("contextmenu", e => e.preventDefault());
  bol.addEventListener("click", e => { e.stopPropagation(); if (pular) { pular = false; return; } mudarCor(rel, sec, p, CICLO[sitDe(rel, sec, p)]); });
  const pt = h("div", { class: "pt", tabindex: "0", "data-pt": k, role: "textbox", "aria-readonly": "true", "aria-label": `Parágrafo ${p.id}. Enter para editar.` });
  renderTexto(pt, txt, novo => alterarPar(rel, sec, p, novo));
  pt.addEventListener("keydown", e => {
    if (pt.isContentEditable) return;
    if (e.key === "Enter" || e.key === "F2") { e.preventDefault(); editarPar(rel, sec, p, pt); }
    else if (e.key === " ") { e.preventDefault(); mudarCor(rel, sec, p, CICLO[sitDe(rel, sec, p)]); }
    else if (["1", "2", "3"].includes(e.key)) { e.preventDefault(); mudarCor(rel, sec, p, ["vermelho", "verde", "azul"][+e.key - 1]); }
  });
  pt.addEventListener("focus", () => { if (!toqueGrosso()) definirFoco(rel, f); });
  const el = h("div", { class: "par" + (emFoco ? " foco" : ""), "data-fk": k }, bol, pt,
    edicaoValida(st, p) ? h("span", { class: "alt", title: "Texto alterado por você" }, "alterado") : null,
    PREF.caixinha ? chipEl(rel, f, ROTULO_SIT[sit], "par", "pchip leve") : null);
  el.addEventListener("click", e => { if (e.target.closest("button,a,.err,textarea")) return; if (!(rel.foco && chave(rel.foco) === k)) definirFoco(rel, f); });
  aoToqueDuplo(pt, k, () => editarPar(rel, sec, p, pt));
  return el;
}
function mudarCor(rel, sec, p, nova) {
  const k = `P:${sec.num}:${p.id}`, s = stOf(rel, k);
  s.sit = nova; s.viaCap = false; tocar(rel, k);
  rel.foco = { t: "P", sec: sec.num, id: p.id };
  redesenharSecao(rel, sec, `[data-pt="${CSS.escape(k)}"]`, k);
  const todos = sec.capitulos.every(c => statusCap(rel, sec, c).cor === "verde");
  if (todos && nova === "verde") aviso("Documento todo verde: pronto para o Claude elaborar.");
}
function editarPar(rel, sec, p, pt) {
  if (!pt || pt.dataset.editando) return;
  pt.dataset.editando = "1";
  const original = textoDe(rel, sec, p), k = `P:${sec.num}:${p.id}`;
  const ta = h("textarea", { rows: "2", "aria-label": `Editar parágrafo ${p.id}` }); ta.value = original;
  const box = h("div", { class: "campo-texto", style: "flex:1;min-width:0" }, ta, h("button", { type: "button", class: "mic", title: "Ditar (Ctrl+Shift+M)", "aria-label": "Ditar", onmousedown: e => e.preventDefault(), onclick: () => Ditado.alternar(ta) }, ico("mic")));
  pt.replaceWith(box);
  const auto = () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; };
  ta.addEventListener("input", auto);
  let cancel = false;
  ta.addEventListener("keydown", e => { if (e.key === "Escape") { cancel = true; ta.blur(); } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ta.blur(); } });
  ta.addEventListener("blur", () => {
    setTimeout(() => {
      if (document.activeElement === ta || Ditado.alvo === ta) return;
      const novo = ta.value.replace(/\u00a0/g, " ").replace(/\n+$/g, "");
      if (!cancel && novo !== original) alterarPar(rel, sec, p, novo); else redesenharSecao(rel, sec);
    }, 120);
  });
  ta.focus(); try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) {}
  auto();
  rel.foco = { t: "P", sec: sec.num, id: p.id };
}
function alterarPar(rel, sec, p, novo) {
  const k = `P:${sec.num}:${p.id}`, s = stOf(rel, k);
  if (!edicaoValida(s, p)) s.base = p.texto;
  s.texto = novo; s.alterado = true; s.sit = "azul"; s.viaCap = false; tocar(rel, k);
  rel.foco = { t: "P", sec: sec.num, id: p.id };
  redesenharSecao(rel, sec, `[data-pt="${CSS.escape(k)}"]`);
}

/* ================= escolhas: caixinha colada no chip (computador) ou folha inferior (celular) ================= */
let POP = null;
function fecharPop() {
  if (!POP) return;
  const P = POP; POP = null;
  P.el && P.el.remove(); P.scrim && P.scrim.remove();
  if (P.ancora) P.ancora.classList.remove("aberto");
  document.removeEventListener("pointerdown", P.fora, true);
}
function abrirEscolhas(rel, f, ancora) {
  fecharMenus();
  if (POP && POP.ancora === ancora) { fecharPop(); return; }
  fecharPop();
  const inf = infoAlvo(rel, f); if (!inf) return;
  definirFocoSilencioso(rel, f);
  const opcoes = inf.opcoes.slice();
  const extras = [];
  if (inf.tipo === "decisao" && !opcoes.includes("Aguardando") && inf.valor !== "Aguardando" && f.t === "I") extras.push({ valor: "Aguardando", rot: "Voltar a Aguardando" });
  POP = { rel, f, ancora, inf, hl: Math.max(0, opcoes.indexOf(inf.valor)), t0: Date.now(), opcoes };
  ancora.classList.add("aberto");
  const cab = inf.tipo === "cap" ? `${f.cap} · capítulo inteiro` : f.t === "C" ? inf.titulo : `${(f.num || f.id || "")} · ${(inf.titulo.split(" · ").slice(1).join(" · ")) || inf.titulo}`;
  const linha = (o, i) => h("button", { type: "button", role: "option", class: "o" + (o === inf.valor ? " on" : "") + (i === POP.hl ? " hl" : ""), "aria-selected": o === inf.valor ? "true" : "false", "data-i": i,
    onclick: () => { if (Date.now() - POP.t0 < 350) return; escolher(o, false); } }, h("span", { class: "ck" }, o === inf.valor ? "✓" : ""), o, !CEL && i < 9 ? h("span", { class: "k" }, String(i + 1)) : null);
  const outraRow = () => {
    if (!inf.custom) return null;
    if (!CEL) {
      const inp = h("input", { type: "text", placeholder: "Outra… (digitar)", "aria-label": "Outra opção", onkeydown: e => {
        if (e.key === "Enter") { e.preventDefault(); const v = inp.value.trim(); if (v) escolher(v, !opcoes.includes(v)); else if (opcoes[POP.hl]) escolher(opcoes[POP.hl], false); }
        else if (e.key === "Escape") { e.preventDefault(); fecharPop(); ancora.focus(); }
        else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); P.focus(); moverHl(e.key === "ArrowDown" ? 1 : -1); } } });
      return h("div", { class: "o outra" }, ico("pen"), inp);
    }
    const b = h("button", { type: "button", class: "o outra", onclick: () => {
      if (Date.now() - POP.t0 < 350) return;
      const inp = h("input", { type: "text", placeholder: "Escreva a opção", "aria-label": "Outra opção", enterkeyhint: "done", onkeydown: e => { if (e.key === "Enter") { e.preventDefault(); const v = inp.value.trim(); if (v) escolher(v, !opcoes.includes(v)); } } });
      const ok = h("button", { type: "button", class: "btn sm pri", onclick: () => { const v = inp.value.trim(); if (v) escolher(v, !opcoes.includes(v)); } }, "OK");
      b.replaceWith(h("div", { class: "o outra" }, ico("pen"), inp, ok)); inp.focus();
    } }, ico("pen"), "Outra… (digitar)");
    return b;
  };
  let P;
  if (CEL) {
    const scrim = h("div", { class: "scrim", onclick: () => { if (POP && Date.now() - POP.t0 < 450) return; fecharPop(); } });
    P = h("div", { class: "sheet", role: "dialog", "aria-label": "Escolhas" }, h("div", { class: "grab" }), h("div", { class: "sub" }, cab),
      h("div", { role: "listbox" }, opcoes.map(linha), extras.map(x => h("button", { type: "button", class: "o", onclick: () => { if (Date.now() - POP.t0 < 350) return; escolher(x.valor, false); } }, h("span", { class: "ck" }), h("span", { class: "mut" }, x.rot))), outraRow()));
    arrastarParaFechar(P);
    $("#camada").append(scrim, P);
    POP.scrim = scrim;
  } else {
    P = h("div", { class: "pop", role: "listbox", tabindex: "-1", "aria-label": cab },
      opcoes.map(linha), extras.map(x => h("button", { type: "button", class: "o", onclick: () => escolher(x.valor, false) }, h("span", { class: "ck" }), h("span", { class: "mut" }, x.rot))), outraRow(),
      h("div", { class: "rod" }, "1–9 escolhe · ↑↓ Enter · N próximo · Esc fecha"));
    document.body.append(P);
    posicionarPop(P, ancora);
    P.addEventListener("keydown", e => teclaPop(e));
    P.focus({ preventScroll: true });
    POP.fora = ev => { if (!POP) return; if (P.contains(ev.target) || ancora.contains(ev.target)) return; fecharPop(); };
    setTimeout(() => document.addEventListener("pointerdown", POP && POP.fora, true), 0);
  }
  POP.el = P;
}
function posicionarPop(P, a) {
  const r = a.getBoundingClientRect(), w = P.offsetWidth, hh = P.offsetHeight;
  const esq = Math.max(8, Math.min(r.left, innerWidth - w - 8));
  const baixo = innerHeight - r.bottom - 8;
  const top = baixo >= hh + 6 || baixo >= r.top ? r.bottom + 4 : r.top - hh - 4;
  P.style.left = (esq + scrollX) + "px"; P.style.top = (top + scrollY) + "px";
}
function moverHl(d) {
  if (!POP) return;
  const n = POP.opcoes.length; POP.hl = (POP.hl + d + n) % n;
  $$(".o[data-i]", POP.el).forEach(b => b.classList.toggle("hl", +b.dataset.i === POP.hl));
}
function teclaPop(e) {
  if (!POP || CEL) return;
  if (e.target.tagName === "INPUT") return;
  const k = e.key;
  if (k === "Escape") { e.preventDefault(); const a = POP.ancora; fecharPop(); a.focus(); }
  else if (k === "ArrowDown" || k === "ArrowUp") { e.preventDefault(); moverHl(k === "ArrowDown" ? 1 : -1); }
  else if (k === "Enter" || k === " ") { e.preventDefault(); escolher(POP.opcoes[POP.hl], false); }
  else if (/^[1-9]$/.test(k) && POP.opcoes[+k - 1]) { e.preventDefault(); escolher(POP.opcoes[+k - 1], false); }
  else if (k === "n" || k === "N") { e.preventDefault(); fecharPop(); irProximo(1); }
  else if (k === "Tab") { e.preventDefault(); const inp = POP.el.querySelector("input"); if (inp) inp.focus(); }
  else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { const inp = POP.el.querySelector("input"); if (inp) { e.preventDefault(); inp.focus(); inp.value += k; } }
}
function escolher(valor, custom) {
  if (!POP) return;
  const { rel, f } = POP; const antes = clone(rel.st);
  fecharPop();
  aplicarValor(rel, f, valor, null, custom);
  const sec = secDaChave(rel, chave(f));
  const anc = f.t === "C" ? `I:${f.num}` : f.t === "K" ? chave(f) : chave(f);
  if (f.t === "E") redesenharTudo(); else if (sec) redesenharSecao(rel, sec, `[data-chip="${CSS.escape(chave(f))}"]`, document.querySelector(`[data-fk="${CSS.escape(chave(f))}"]`) ? chave(f) : anc);
  aviso(`Registrado: ${valor}.`, () => desfazer(rel, antes), "Desfazer");
  if (PREF.avancar && resolvido(kind(valor))) setTimeout(() => irProximo(1), 60);
}
function arrastarParaFechar(P) {
  let y0 = null;
  P.addEventListener("touchstart", e => { if (P.scrollTop <= 0) y0 = e.touches[0].clientY; }, { passive: true });
  P.addEventListener("touchmove", e => { if (y0 == null) return; const dy = e.touches[0].clientY - y0; if (dy > 0) P.style.transform = `translateY(${dy}px)`; }, { passive: true });
  P.addEventListener("touchend", e => { if (y0 == null) return; const dy = (e.changedTouches[0].clientY - y0); y0 = null; if (dy > 90) { fecharPop(); fecharMenus(); } else P.style.transform = ""; });
}

/* ================= navegação: próximo pendente, ir para item ================= */
function vizinho(rel, dir) {
  const lista = alvos(rel); if (!lista.length) return null;
  const atual = rel.foco ? lista.findIndex(f => chave(f) === chave(rel.foco)) : -1;
  for (const incluirBloq of [false, true]) {
    for (let p = 1; p <= lista.length; p++) {
      const i = (((atual < 0 ? (dir > 0 ? -1 : 0) : atual) + dir * p) % lista.length + lista.length) % lista.length;
      const f = lista[i], cor = corAlvo(rel, f);
      if (cor === "verde" || cor == null) continue;
      if (f.t === "I") { const it = achar(rel, f.num); if (!incluirBloq && it && bloqueado(rel, it)) continue; }
      if (chave(f) !== (rel.foco ? chave(rel.foco) : "")) return f;
    }
  }
  return null;
}
function irProximo(dir) {
  const rel = relAtual(); if (!rel || VISTA !== "rel") { if (rel) { VISTA = "rel"; montar({ forcar: true }); } else return; }
  const n = vizinho(rel, dir); if (!n) { aviso("Não há outro pendente."); return; }
  mostrarAlvo(rel, n, true);
}
function mostrarAlvo(rel, f, focar) {
  const sec = secDaChave(rel, chave(f)); if (!sec) return;
  (ABERTAS[rel.id] = ABERTAS[rel.id] || {})[sec.num] = true;
  rel.foco = f; Banco.marcar(rel, null);
  redesenharSecao(rel, sec);
  const k = chave(f);
  const el = document.querySelector(`[data-fk="${CSS.escape(k)}"]`) || document.querySelector(`[data-fk="I:${CSS.escape(f.num || "")}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove("alvo"); void el.offsetWidth; el.classList.add("alvo");
  if (focar && !CEL) { const c = el.querySelector(`[data-chip="${CSS.escape(k)}"]`) || el.querySelector("[data-pt]") || el.querySelector("[data-chip]"); if (c) c.focus({ preventScroll: true }); }
}
function irPara(alvo) {
  const rel = relAtual(); if (!rel) return;
  let f = null;
  if (/^P:/.test(alvo)) { const partes = alvo.split(":"); f = { t: "P", sec: partes[1], id: partes.slice(2).join(":") }; }
  else { const it = achar(rel, alvo); if (!it) { aviso("Item " + alvo + " não encontrado."); return; } f = { t: "I", num: it.num }; }
  mostrarAlvo(rel, f, true);
}

/* ================= menus (lista colada no botão no computador; folha inferior no celular) ================= */
let MENU = null;
function fecharMenus() { if (!MENU) return; const M = MENU; MENU = null; M.el.remove(); M.scrim && M.scrim.remove(); document.removeEventListener("pointerdown", M.fora, true); if (M.ancora && M.ancora.classList) M.ancora.classList.remove("on"); }
function menu(ancora, itens, opts) {
  if (MENU && MENU.ancora === ancora) { fecharMenus(); return; }
  fecharMenus(); fecharPop();
  if (ancora && ancora.classList) ancora.classList.add("on");
  const linha = it => {
    if (it.div) return h("div", { class: "div" });
    if (it.el) return it.el;
    const filhos = [it.ico ? ico(it.ico) : null, h("span", { style: "flex:1" }, it.rotulo), it.check != null ? h("span", { class: "k" }, it.check ? "✓" : "") : null, it.small ? h("small", {}, it.small) : null];
    if (it.href) return h("a", { class: "o" + (it.on ? " on" : ""), href: it.href, target: "_blank", rel: "noopener", onclick: () => { try { it.fn && it.fn(); } finally { fecharMenus(); } } }, ...filhos);
    return h("button", { type: "button", class: "o" + (it.on ? " on" : ""), onclick: () => { const fecha = it.manter ? false : true; if (fecha) fecharMenus(); it.fn && it.fn(); } }, ...filhos);
  };
  let M;
  if (CEL) {
    const t0 = Date.now();
    const scrim = h("div", { class: "scrim", onclick: () => { if (Date.now() - t0 < 450) return; fecharMenus(); } });
    M = h("div", { class: "sheet", role: "menu" }, h("div", { class: "grab" }), opts && opts.titulo ? h("div", { class: "sub" }, opts.titulo) : null, itens.filter(Boolean).map(linha));
    arrastarParaFechar(M);
    $("#camada").append(scrim, M);
    MENU = { el: M, scrim, ancora, fora: () => {} };
  } else {
    M = h("div", { class: "pop menu", role: "menu" }, itens.filter(Boolean).map(linha));
    document.body.append(M);
    const r = ancora.getBoundingClientRect(), w = M.offsetWidth;
    M.style.left = (Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + scrollX) + "px";
    M.style.top = (r.bottom + 4 + scrollY) + "px";
    const fora = ev => { if (!MENU) return; if (M.contains(ev.target) || ancora.contains(ev.target)) return; fecharMenus(); };
    MENU = { el: M, ancora, fora };
    setTimeout(() => document.addEventListener("pointerdown", fora, true), 0);
  }
  return M;
}
let SEL_TEXTO = "";
document.addEventListener("selectionchange", () => { const s = String(getSelection() || "").trim(); if (s) SEL_TEXTO = s; });
function textoParaGemini(rel) {
  if (SEL_TEXTO) return SEL_TEXTO;
  if (rel && rel.foco) {
    const f = rel.foco;
    if (f.t === "P") { const sec = secDe(rel, f.sec), p = parDe(rel, f); if (p) return textoDe(rel, sec, p); }
    if (f.t === "I") { const it = achar(rel, f.num); if (it) return `${it.titulo}\n${it.texto}`; }
  }
  const sec = rel && rel.dados.secoes.find(s => s.tipo === "texto");
  return sec ? textoSecao(rel, sec) : (rel ? textoRelatorio(rel) : "");
}
function linkConversa(rel) { return rel.conversa || rel.dados.conversa || ""; }
function elEnviar(rel, attrs, ...filhos) {
  const link = linkConversa(rel);
  const preparar = () => { copiar(msgEnvio(rel)); Banco.gravarAgora(rel.id); };
  if (link) return h("a", Object.assign({ href: link, target: "_blank", rel: "noopener", onclick: () => { preparar(); fecharMenus(); aviso("Decisões gravadas e mensagem copiada. Na conversa, cole e envie."); } }, attrs), ...filhos);
  return h("button", Object.assign({ type: "button", onclick: () => { preparar(); fecharMenus(); pedirLinkConversa(rel); } }, attrs), ...filhos);
}
function pedirLinkConversa(rel) {
  const inp = h("input", { type: "url", placeholder: "https://claude.ai/chat/…", value: linkConversa(rel) });
  const abrir = h("a", { class: "btn pri", href: linkConversa(rel) || "#", target: "_blank", rel: "noopener" }, "Salvar e abrir");
  const atualizar = () => { const v = inp.value.trim(); const ok = /^https:\/\/claude\.ai\//i.test(v); abrir.href = ok ? v : "#"; abrir.toggleAttribute("aria-disabled", !ok); abrir.style.opacity = ok ? "" : ".5"; };
  inp.addEventListener("input", atualizar); atualizar();
  abrir.addEventListener("click", e => { const v = inp.value.trim(); if (!/^https:\/\/claude\.ai\//i.test(v)) { e.preventDefault(); aviso("Cole o endereço da conversa (começa com https://claude.ai/)."); return; } rel.conversa = v; Banco.marcar(rel, null, "conversa"); fecharDialogo(); aviso("Link guardado no objeto. Mensagem copiada: cole na conversa."); });
  dialogo("Conversa deste objeto", [
    h("p", { class: "mut" }, "A mensagem já foi copiada. Cole aqui o endereço da conversa do objeto (fica guardado e da próxima vez abre direto)."),
    campoComMic(inp), copiaLinha(msgEnvio(rel))],
    [{ rotulo: "Cancelar" }, { el: h("a", { class: "btn", href: URLS.claude + "?q=" + encodeURIComponent(msgEnvio(rel)), target: "_blank", rel: "noopener", onclick: fecharDialogo }, "Abrir conversa nova") }, { el: abrir }]);
  setTimeout(() => inp.focus(), 50);
}
function menuCopiar(ancora) {
  const rel = relAtual(); if (!rel) return;
  const foco = rel.foco ? (rel.foco.num || rel.foco.id || rel.foco.cap || "") : "";
  menu(ancora, [
    { ico: "copy", rotulo: "Copiar relatório", fn: () => copiarSaida(false) },
    { ico: "copy", rotulo: "Copiar item em foco", small: foco, fn: () => copiarSaida(true) },
    { el: elEnviar(rel, { class: "o on" }, ico("send"), h("span", { style: "flex:1" }, "Enviar ao Claude")) },
    { ico: "link", rotulo: "Abrir conversa de continuação", href: URLS.claude + "?q=" + encodeURIComponent(fraseContinuacao(rel)), fn: () => copiar(fraseContinuacao(rel), "Frase de continuação copiada.") },
    { div: true },
    { ico: "spark", rotulo: "Abrir no Gemini", small: "conferir", href: URLS.gemini, fn: () => copiar(PERGUNTA + "\n\n" + textoParaGemini(rel), "Copiado. Cole no Gemini.") },
    { ico: "mail", rotulo: "Rascunho no Gmail", fn: () => abrirGmail(rel) },
    CEL ? { ico: "spark", rotulo: "Ver a resposta gerada", fn: () => ir("resposta") } : null,
    { ico: "copy", rotulo: "Copiar relatório inteiro (texto)", fn: () => copiar(textoRelatorio(rel), "Relatório inteiro copiado.") }
  ]);
}
function menuFoco(ancora) {
  const rel = relAtual(); if (!rel) return;
  const nPend = contarPendencias(rel), foco = rel.foco ? (rel.foco.num || rel.foco.id || "") : "";
  menu(ancora, [
    { ico: "focus", rotulo: "Ir ao item em foco", small: foco || "nenhum", fn: () => { if (rel.foco) { if (VISTA !== "rel") ir("rel"); setTimeout(() => mostrarAlvo(rel, rel.foco, true), 30); } else aviso("Toque num item para colocá-lo em foco."); } },
    { ico: "down", rotulo: "Próximo pendente", small: `${nPend} · N`, fn: () => irProximo(1) },
    { ico: "up", rotulo: "Pendente anterior", small: "P", fn: () => irProximo(-1) },
    { rotulo: "Só pendentes", check: PREF.soPend, fn: () => { PREF.soPend = !PREF.soPend; salvarPref(); if (VISTA !== "rel") ir("rel"); else redesenharTudo(); } },
    { rotulo: "Recolher tudo", fn: () => { ABERTAS[rel.id] = {}; if (VISTA !== "rel") ir("rel"); else redesenharTudo(); } },
    { rotulo: "Abrir tudo", fn: () => { const ab = ABERTAS[rel.id] = {}; rel.dados.secoes.forEach(s => { ab[s.num] = true; }); if (VISTA !== "rel") ir("rel"); else redesenharTudo(); } },
    { div: true },
    { ico: "play", rotulo: "Rolagem automática", check: Rolagem.ligada, fn: () => Rolagem.alternar() },
    { ico: "mic", rotulo: "Ditar no item em foco", small: "Ctrl+Shift+M", fn: () => Ditado.atalho() },
    { rotulo: "Sublinhar erros de português", check: PREF.revisar, fn: alternarRevisao },
    { ico: "link", rotulo: "Link da conversa do objeto…", small: linkConversa(rel) ? "guardado" : "", fn: () => pedirLinkConversa(rel) },
    rel.dados.pasta.caminho ? { ico: "folder", rotulo: "Copiar o caminho da pasta", fn: () => copiar(rel.dados.pasta.caminho, "Caminho copiado. No Explorador (Win+E), cole na barra de endereço.") } : null
  ], { titulo: "Foco" });
}
function menuEngrenagem(ancora) {
  menu(ancora, [
    { ico: "doc", rotulo: "Documentos", fn: () => ir("docs") },
    { ico: "pen", rotulo: "Documento avulso", fn: () => ir("avulso") },
    { ico: "layers", rotulo: "Mesa PDF", fn: () => ir("mesa") },
    { ico: "check", rotulo: "Revisão da separação", fn: () => ir("revisao") },
    { ico: "spark", rotulo: "Revisor de texto", fn: () => ir("revisor") },
    { div: true },
    { ico: "send", rotulo: "Claude: conversa nova", href: URLS.claude },
    { ico: "spark", rotulo: "Gemini", href: URLS.gemini },
    { ico: "mail", rotulo: "Gmail", href: "https://mail.google.com/" },
    { div: true },
    { rotulo: "Depois de escolher, ir ao próximo pendente", check: PREF.avancar, fn: () => { PREF.avancar = !PREF.avancar; salvarPref(); aviso(PREF.avancar ? "Ligado." : "Desligado."); } },
    { rotulo: "Caixinha nos parágrafos (atalho)", check: PREF.caixinha, fn: () => { PREF.caixinha = !PREF.caixinha; salvarPref(); redesenharTudo(); } },
    { rotulo: "Abrir o relatório de exemplo", fn: abrirExemplo },
    { el: h("div", { class: "rod" }, Banco.estado === "ok" ? "Banco conectado: decisões salvas no Claude." : Banco.estado === "local" ? "Sem banco: decisões só neste aparelho." : "Conectando ao banco…") }
  ], { titulo: "Ferramentas e ajustes" });
}
async function copiarSaida(soFoco) {
  const rel = relAtual(); if (!rel) { aviso("Abra um relatório primeiro."); return; }
  if (soFoco && !rel.foco) { aviso("Toque num item para colocá-lo em foco."); return; }
  copiar(montarSaida(rel, soFoco), soFoco ? "Item em foco copiado. Cole na conversa." : "Relatório copiado. Cole na conversa.");
}

/* ================= resposta ao Claude ================= */
TELAS.resposta = {
  nav: "rel",
  topo(T) { topoRelatorio(T, "resposta"); },
  corpo(m) {
    const rel = relAtual(); if (!rel) { VISTA = "inicio"; TELAS.inicio.corpo(m); return; }
    const col = h("div", { class: "col" }); ap(m, col);
    const n = contarPendencias(rel);
    if (!CEL) ap(col, h("h1", { class: "rt" }, "Resposta ao Claude"), h("div", { class: "meta" }, `Texto gerado a partir das suas marcações · ${n} pendência${n === 1 ? "" : "s"}`));
    else ap(col, h("div", { class: "meta" }, `${n} pendência${n === 1 ? "" : "s"} · rev ${rel.dados.rev}`));
    const txt = montarSaida(rel, false);
    ap(col, h("pre", { class: "code", style: CEL ? "font-size:10.5px;padding:11px" : "" }, ...colorirSaida(txt)));
    const b = CEL ? h("div", { style: "display:flex;flex-direction:column;gap:8px;margin-top:12px" }) : h("div", { class: "botoes" });
    ap(b, h("button", { type: "button", class: "btn pri", onclick: () => copiarSaida(false) }, ico("copy"), "Copiar relatório"));
    if (!CEL) ap(b, h("button", { type: "button", class: "btn", onclick: () => copiarSaida(true) }, ico("copy"), "Copiar item em foco"));
    ap(b, elEnviar(rel, { class: "btn" }, ico("send"), "Enviar ao Claude"),
      h("a", { class: "btn", href: URLS.claude + "?q=" + encodeURIComponent(fraseContinuacao(rel)), target: "_blank", rel: "noopener", onclick: () => copiar(fraseContinuacao(rel), "Frase de continuação copiada.") }, ico("link"), "Abrir conversa de continuação"));
    ap(col, b);
    ap(col, h("div", { class: "sub", style: "margin-top:12px" }, "Dica: depois de enviar, escreva na conversa “fiz observações”. O Claude lê só as suas decisões salvas."),
      h("div", { class: "sub", id: "estado-grav", style: "margin-top:6px" }, estadoGravacao(rel)));
  }
};
function estadoGravacao(rel) {
  if (rel.local) return "Relatório só deste aparelho (exemplo): não vai para o banco.";
  if (Banco.estado !== "ok") return Banco.estado === "local" ? "Sem banco: decisões só neste aparelho." : "Conectando ao banco…";
  if (Banco.pendente(rel.id)) return "Gravando…";
  return rel.gravadoEm ? `Decisões gravadas no banco às ${dataHora(rel.gravadoEm).slice(6)}.` : "Decisões em dia no banco.";
}
function colorirSaida(txt) {
  const out = [];
  txt.split("\n").forEach((l, i) => {
    if (i) out.push("\n");
    if (l.startsWith("[OMEGA]")) { out.push(h("span", { class: "k" }, "[OMEGA]"), l.slice(7)); return; }
    if (l.startsWith("## ")) { out.push(h("span", { class: "k" }, l)); return; }
    const c = l.indexOf(" — comentário: ");
    if (c > 0) { out.push(l.slice(0, c), "\n", h("span", { class: "m" }, "    └ " + l.slice(c + 15))); return; }
    out.push(l);
  });
  return out;
}

/* ================= rolagem automática ================= */
const Rolagem = (() => {
  let on = false, raf = 0, ult = 0, resto = 0, barra = null;
  function passo(t) {
    if (!on) return;
    const dt = ult ? Math.min(100, t - ult) : 16; ult = t;
    resto += PREF.vel * 12 * dt / 1000;
    const px = Math.floor(resto); resto -= px;
    if (px) window.scrollBy(0, px);
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) { parar(); aviso("Fim do relatório."); return; }
    raf = requestAnimationFrame(passo);
  }
  function desenharBarra() {
    if (barra) barra.remove();
    if (!on) { barra = null; return; }
    barra = h("div", { class: "barra-rol", role: "group", "aria-label": "Rolagem automática" }, h("span", { class: "sub" }, "Rolagem"),
      h("button", { type: "button", class: "btn sm", "aria-label": "Mais devagar", onclick: () => { PREF.vel = Math.max(1, PREF.vel - 1); salvarPref(); desenharBarra(); } }, ico("minus")),
      h("b", { class: "num" }, String(PREF.vel)),
      h("button", { type: "button", class: "btn sm", "aria-label": "Mais rápido", onclick: () => { PREF.vel = Math.min(10, PREF.vel + 1); salvarPref(); desenharBarra(); } }, ico("plus")),
      h("button", { type: "button", class: "btn sm pri", onclick: parar }, "Parar"));
    document.body.append(barra);
  }
  function ligar() { if (on) return; on = true; ult = 0; resto = 0; desenharBarra(); raf = requestAnimationFrame(passo); aviso("Rolagem automática: toque na tela para parar."); }
  function parar() { on = false; cancelAnimationFrame(raf); desenharBarra(); }
  const pararSeFora = e => { if (on && !(barra && barra.contains(e.target))) parar(); };
  addEventListener("wheel", () => { if (on) parar(); }, { passive: true });
  addEventListener("pointerdown", pararSeFora, true);
  addEventListener("keydown", e => { if (on && !(barra && barra.contains(e.target))) parar(); }, true);
  return { alternar: () => (on ? parar() : ligar()), parar, get ligada() { return on; } };
})();

/* ================= ditado (voz para texto, contínuo, em qualquer caixa) ================= */
function corrigirSiglas(t) {
  return t.replace(/\b(l[aá]\s+n[ao])\s+(?:s[eé]\s*)?in?fra\b/gi, (m, a) => a + " SEINFRA")
    .replace(/\b(?:isso\s+[eé]|voc[eê]\s+[eé]|s[eé]|sei|cei|ce)\s*[- ]?\s*in?fra\b/gi, "SEINFRA")
    .replace(/\bseinfra\b/gi, "SEINFRA");
}
const Ditado = (() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, ativo = false, alvo = null, antes = "", depois = "", final = "", bloqueado = false, falhas = 0, barra = null, tIni = 0;
  function campoTexto(el) { return el && (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && /^(text|search|url|email)$/i.test(el.type))); }
  function escrever(interino) {
    if (!alvo || !document.contains(alvo)) return;
    const sep = antes && !/\s$/.test(antes) && (final || interino) ? " " : "";
    const meio = corrigirSiglas((final + (interino ? (final && !/\s$/.test(final) ? " " : "") + interino : "")));
    alvo.value = antes + sep + meio + (depois && !/^\s/.test(depois) && meio ? " " : "") + depois;
    const pos = (antes + sep + meio).length;
    try { alvo.setSelectionRange(pos, pos); } catch (e) {}
    alvo.dispatchEvent(new Event("input", { bubbles: true }));
    if (alvo.tagName === "TEXTAREA") alvo.scrollTop = alvo.scrollHeight;
    const r = alvo.getBoundingClientRect();
    if (r.bottom > innerHeight - (CEL ? 150 : 40) || r.top < 60) alvo.scrollIntoView({ block: "nearest", behavior: "smooth" });
    if (barra) { const t = barra.querySelector(".ult"); if (t) t.textContent = (interino || final).slice(-60); }
  }
  function marcarMics() { $$(".mic").forEach(m => m.classList.remove("live")); if (ativo && alvo) { const box = alvo.closest(".cm, .campo-texto"); const m = box && box.querySelector(".mic"); if (m) m.classList.add("live"); } }
  function mostrarBarra() {
    if (barra) barra.remove(); barra = null;
    if (!ativo || !CEL) return;
    barra = h("div", { class: "barra-dit", role: "status" }, h("span", { class: "mic live" }, ico("mic")), h("div", { class: "txt" }, h("b", {}, "Ditando…"), h("div", { class: "sub ult" }, "não para sozinho · toque para parar")),
      h("button", { type: "button", class: "btn sm", onclick: parar }, "Parar"));
    document.body.append(barra);
  }
  function semMicrofone(el) {
    bloqueado = true; ativo = false; marcarMics(); mostrarBarra();
    if (el) { el.focus(); }
    aviso(CEL ? "O microfone do Claude não abre aqui. Toque no 🎤 do teclado (Gboard) para ditar." : "O Claude bloqueou o microfone neste painel. Use o ditado do Windows: Win+H com o cursor na caixa.");
  }
  function iniciar(el) {
    if (!campoTexto(el)) { aviso("Toque numa caixa de texto para ditar."); return; }
    if (ativo) parar();
    if (!SR || bloqueado) { semMicrofone(el); return; }
    alvo = el; ativo = true; final = ""; falhas = 0;
    const s = el.selectionStart ?? el.value.length, e2 = el.selectionEnd ?? el.value.length;
    antes = el.value.slice(0, s); depois = el.value.slice(e2);
    ligarRec();
    marcarMics(); mostrarBarra();
  }
  function ligarRec() {
    try { rec && rec.abort(); } catch (e) {}
    rec = new SR(); rec.lang = "pt-BR"; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
    tIni = Date.now();
    rec.onresult = ev => {
      let inter = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i], tx = r[0].transcript;
        if (r.isFinal) final += (final && !/\s$/.test(final) && !/^\s/.test(tx) ? " " : "") + tx.trim();
        else inter += tx;
      }
      falhas = 0; escrever(inter.trim());
    };
    rec.onerror = ev => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed" || ev.error === "audio-capture") { const el = alvo; parar(); semMicrofone(el); }
      else if (ev.error === "network") { falhas++; }
    };
    rec.onend = () => {
      if (!ativo) return;
      /* o navegador corta depois de pausas: religa sozinho, mantendo o texto já escrito */
      if (Date.now() - tIni < 1500) falhas++;
      if (falhas > 6) { parar(); aviso("O ditado parou várias vezes seguidas. Toque no microfone para recomeçar."); return; }
      antes = alvo ? alvo.value.slice(0, alvo.selectionStart ?? alvo.value.length) : antes; depois = alvo ? alvo.value.slice(alvo.selectionEnd ?? alvo.value.length) : depois; final = "";
      setTimeout(() => { if (ativo) { try { ligarRec(); } catch (e) { parar(); } } }, 250);
    };
    try { rec.start(); } catch (e) { const el = alvo; parar(); semMicrofone(el); }
  }
  function parar() {
    ativo = false;
    try { rec && rec.stop(); } catch (e) {}
    const el = alvo; alvo = null; marcarMics(); mostrarBarra();
    if (el && document.contains(el)) { el.dispatchEvent(new Event("input", { bubbles: true })); el.focus(); }
  }
  function alternar(el) { if (ativo && alvo === el) parar(); else iniciar(el); }
  function atalho() {
    if (ativo) { parar(); return; }
    const a = document.activeElement;
    if (campoTexto(a)) { iniciar(a); return; }
    const rel = relAtual();
    if (VISTA === "rel" && rel && rel.foco) {
      const k = chave(rel.foco);
      const box = document.querySelector(`[data-cm="${CSS.escape(k)}"]`);
      if (box && box.editar) { iniciar(box.editar()); return; }
    }
    aviso("Toque num item ou numa caixa de texto e use Ctrl+Shift+M.");
  }
  return { iniciar, parar, alternar, atalho, get alvo() { return ativo ? alvo : null; }, get ativo() { return ativo; } };
})();
/* campo com microfone (para formulários e diálogos) */
function campoComMic(el) {
  const box = h("div", { class: "campo-texto" }, el, h("button", { type: "button", class: "mic", title: "Ditar (Ctrl+Shift+M)", "aria-label": "Ditar", onmousedown: e => e.preventDefault(), onclick: () => Ditado.alternar(el) }, ico("mic")));
  if (el.tagName === "TEXTAREA" && toqueGrosso()) somenteComToqueDuplo(el);
  return box;
}
/* no celular, a caixa só abre o teclado com toque duplo (dá para tocar e rolar sem o teclado subir) */
function somenteComToqueDuplo(el) {
  el.readOnly = true; el.setAttribute("inputmode", "none");
  const liberar = () => { el.readOnly = false; el.removeAttribute("inputmode"); el.blur(); setTimeout(() => el.focus(), 0); };
  aoToqueDuplo(el, "campo:" + (el.id || Math.random()), liberar);
  el.addEventListener("blur", () => { if (Ditado.alvo === el) return; el.readOnly = true; el.setAttribute("inputmode", "none"); });
  el.liberar = liberar;
}

/* ================= diálogo (confirm/prompt não funcionam dentro do Claude) ================= */
let DLG = null;
function fecharDialogo() { if (!DLG) return; DLG.el.remove(); DLG.scrim.remove(); DLG = null; }
function dialogo(titulo, conteudo, botoes) {
  fecharDialogo();
  const scrim = h("div", { class: "scrim", onclick: fecharDialogo });
  const acoes = h("div", { class: "acoes" }, (botoes || [{ rotulo: "Fechar", pri: true }]).map(b => b.el || h("button", { type: "button", class: "btn" + (b.pri ? " pri" : ""), onclick: () => { const r = b.fn ? b.fn() : undefined; if (r !== false) fecharDialogo(); } }, b.rotulo)));
  const el = h("div", { class: "dlg", role: "dialog", "aria-modal": "true", "aria-label": titulo }, h("h3", {}, titulo), ...[].concat(conteudo), acoes);
  el.addEventListener("keydown", e => { if (e.key === "Escape") { e.stopPropagation(); fecharDialogo(); } });
  $("#camada").append(scrim, el);
  DLG = { el, scrim };
  return el;
}

/* ================= revisor de português (dicionário carregado só ao tocar) ================= */
let STEMS = null, SUF = null, PRE = null, maxS = 0, maxP = 0, DICSTATE = "nao";
const DICCBS = [];
function carregarDic(cb) {
  cb = cb || (() => {});
  if (DICSTATE === "ok") return cb();
  DICCBS.push(cb);
  if (DICSTATE === "carregando") return;
  DICSTATE = "carregando";
  const fim = est => { DICSTATE = est; DICCBS.splice(0).forEach(f => { try { f(); } catch (e) { console.error(e); } }); };
  const montarDic = () => {
    const linhas = window.OMEGA_DIC.split("\n"); STEMS = new Map(); SUF = new Map(); PRE = new Map();
    let k = 0;
    const fatia = () => {
      const lim = Math.min(k + 15000, linhas.length);
      for (; k < lim; k++) { const l = linhas[k], i = l.indexOf("/"), w = i < 0 ? l : l.slice(0, i); STEMS.set(w, (STEMS.get(w) || "") + (i < 0 ? "" : l.slice(i + 1))); }
      if (k < linhas.length) { setTimeout(fatia, 0); return; }
      for (const [flag, tipo, cross, regras] of window.OMEGA_AFF) {
        const mapa = tipo === "S" ? SUF : PRE;
        for (const [strip, add, cond] of regras) {
          if (!mapa.has(add)) mapa.set(add, []);
          mapa.get(add).push({ flag, cross, strip, cond, re: null });
          if (tipo === "S") maxS = Math.max(maxS, add.length); else maxP = Math.max(maxP, add.length);
        }
      }
      fim("ok");
    };
    setTimeout(fatia, 0);
  };
  if (window.OMEGA_DIC && window.OMEGA_AFF) return montarDic();
  const sc = document.createElement("script"); sc.src = "dicionario-ptbr.js";
  sc.onload = () => (window.OMEGA_DIC && window.OMEGA_AFF) ? montarDic() : fim("erro");
  sc.onerror = () => { sc.remove(); DICSTATE = "nao"; DICCBS.splice(0).forEach(f => { try { f(); } catch (e) {} }); };
  document.head.append(sc);
}
function alternarRevisao() {
  if (PREF.revisar) { PREF.revisar = false; redesenharTudo(); aviso("Sublinhado desligado."); return; }
  aviso("Carregando o dicionário…");
  carregarDic(() => { if (DICSTATE === "ok") { PREF.revisar = true; redesenharTudo(); aviso("Sublinhado ligado: toque na palavra para ver sugestões."); } else aviso("O dicionário não carregou. Tente de novo."); });
}
function condOk(r, s, tipo) { if (r.cond === ".") return true; if (!r.re) { try { r.re = new RegExp(tipo === "S" ? r.cond + "$" : "^" + r.cond); } catch (e) { r.re = /^/; } } return r.re.test(s); }
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
  if ((PREF.dic || []).includes(min)) return true;
  if (existe(min)) return true;
  if (min.includes("-")) { const ps = min.split("-").filter(Boolean); if (ps.length && ps.every(x => existe(x) || (PREF.dic || []).includes(x))) return true; if (existe(ps[0]) && ps.slice(1).every(x => CLITICOS.has(x))) return true; }
  return false;
}
const LETRAS = "abcdefghijklmnopqrstuvwxyzáàâãéêíóôõúüç";
function edicoes(p) { const r = new Set(); for (let i = 0; i <= p.length; i++) { const a = p.slice(0, i), b = p.slice(i); if (b) r.add(a + b.slice(1)); if (b.length > 1) r.add(a + b[1] + b[0] + b.slice(2)); for (const c of LETRAS) { if (b) r.add(a + c + b.slice(1)); r.add(a + c + b); } } return r; }
const SEMACENTO = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
function sugestoes(pal) {
  const min = pal.toLowerCase(), cap = pal[0] !== min[0], saida = [];
  const add = w => { if (!saida.includes(w) && w !== min) saida.push(w); };
  const e1 = edicoes(min), v = [...e1].filter(w => w.length > 1 && existe(w)), sa = SEMACENTO(min);
  v.sort((x, y) => (SEMACENTO(y) === sa) - (SEMACENTO(x) === sa) || Math.abs(x.length - min.length) - Math.abs(y.length - min.length));
  v.forEach(add);
  if (saida.length < 3 && min.length < 11) for (const w of e1) { if (saida.length >= 5) break; if (w.length < 3) continue; for (const w2 of edicoes(w)) if (w2.length > 1 && existe(w2)) { add(w2); if (saida.length >= 5) break; } }
  return saida.slice(0, 5).map(w => cap ? w[0].toUpperCase() + w.slice(1) : w);
}
const ignoradas = new Set();
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
function renderTexto(alvo, texto, aplicar, forcar) {
  alvo.replaceChildren();
  const ms = (PREF.revisar || forcar) ? marcas(texto) : [];
  if (!ms.length) { alvo.textContent = texto; return; }
  let u = 0;
  ms.forEach(x => {
    alvo.append(texto.slice(u, x.ini));
    alvo.append(h("span", { class: "err", role: "button", tabindex: "0", onclick: ev => { ev.stopPropagation(); balao(ev.currentTarget, x, novo => aplicar(texto.slice(0, x.ini) + novo + texto.slice(x.fim))); } }, x.tipo === "regra" && !x.txt.trim() ? "␣".repeat(Math.min(3, x.txt.length)) : x.txt));
    u = x.fim;
  });
  alvo.append(texto.slice(u));
}
function fecharBalao() { $$(".bal").forEach(x => x.remove()); }
function balao(el, marca, aplicar) {
  fecharBalao();
  const r = el.getBoundingClientRect(), s = marca.tipo === "palavra" ? sugestoes(marca.txt) : marca.sug;
  const b = h("div", { class: "bal", style: `left:${Math.max(8, Math.min(r.left, innerWidth - 310))}px;top:${Math.min(r.bottom + 6, innerHeight - 280)}px` },
    marca.msg ? h("span", { class: "sub", style: "padding:6px 10px" }, marca.msg) : null,
    s.length ? s.map(w => h("button", { type: "button", onclick: () => { b.remove(); aplicar(w); } }, w === "" ? "remover o espaço" : w === " " ? "usar um espaço só" : w)) : h("span", { class: "sub", style: "padding:6px 10px" }, "Sem sugestões"),
    h("button", { type: "button", onclick: () => { b.remove(); if (marca.tipo === "palavra") ignoradas.add(marca.txt.toLowerCase()); redesenharTudo(); } }, "Ignorar"),
    marca.tipo === "palavra" ? h("button", { type: "button", onclick: () => { b.remove(); PREF.dic = (PREF.dic || []).concat(marca.txt.toLowerCase()); salvarPref(); redesenharTudo(); aviso(`“${marca.txt.toLowerCase()}” entrou no seu dicionário.`); } }, "Adicionar ao meu dicionário") : null);
  document.body.append(b);
  setTimeout(() => document.addEventListener("pointerdown", function f(ev) { if (!b.contains(ev.target)) { b.remove(); document.removeEventListener("pointerdown", f, true); } }, true), 0);
}
/* lista todos os problemas de um conjunto de textos e aceita um a um */
function revisarLista(titulo, textos, aoAplicar) {
  aviso("Carregando o dicionário…");
  carregarDic(() => {
    if (DICSTATE !== "ok") { aviso("O dicionário não carregou."); return; }
    const pintar = () => {
      const achados = [];
      textos().forEach(x => marcas(x.texto).forEach(mk => achados.push({ x, mk })));
      const corpo = [];
      if (!achados.length) corpo.push(h("p", {}, "Nenhum problema encontrado."));
      else {
        const simples = achados.filter(a => a.mk.tipo === "regra");
        if (simples.length) corpo.push(h("button", { type: "button", class: "btn", onclick: () => {
          const porX = new Map(); simples.forEach(a => { (porX.get(a.x) || porX.set(a.x, []).get(a.x)).push(a.mk); });
          porX.forEach((mks, x) => { let t = x.texto; mks.sort((p, q) => q.ini - p.ini).forEach(mk => { t = t.slice(0, mk.ini) + mk.sug[0] + t.slice(mk.fim); }); x.aplicar(t); });
          aviso(`${simples.length} correção(ões) de espaço e pontuação aplicadas.`); aoAplicar && aoAplicar(); pintar();
        } }, `Corrigir espaços e pontuação em tudo (${simples.length})`));
        achados.forEach(a => {
          const sug = a.mk.tipo === "palavra" ? sugestoes(a.mk.txt) : a.mk.sug, t = a.x.texto;
          corpo.push(h("div", { class: "achado" },
            h("div", { class: "sub" }, `${a.x.id}: …${t.slice(Math.max(0, a.mk.ini - 28), a.mk.ini)}`, h("b", { class: "err" }, a.mk.tipo === "regra" && !a.mk.txt.trim() ? "␣" : a.mk.txt), `${t.slice(a.mk.fim, a.mk.fim + 28)}…`, a.mk.msg ? `  (${a.mk.msg})` : ""),
            h("div", { style: "display:flex;gap:6px;flex-wrap:wrap;margin-top:6px" }, sug.map(w => h("button", { type: "button", class: "btn sm", onclick: () => { a.x.aplicar(t.slice(0, a.mk.ini) + w + t.slice(a.mk.fim)); aoAplicar && aoAplicar(); pintar(); } }, w === "" ? "remover espaço" : w === " " ? "um espaço só" : w)),
              h("button", { type: "button", class: "btn sm", onclick: () => { if (a.mk.tipo === "palavra") ignoradas.add(a.mk.txt.toLowerCase()); pintar(); } }, "Ignorar"))));
        });
      }
      dialogo(titulo, h("div", {}, corpo), [{ rotulo: "Fechar", pri: true }]);
    };
    pintar();
  });
}
function revisarTudo(rel, sec) {
  revisarLista(`Revisar tudo · ${sec.titulo}`, () => sec.capitulos.flatMap(c => c.paragrafos.map(p => ({ id: p.id, texto: textoDe(rel, sec, p), aplicar: t => alterarParSilencioso(rel, sec, p, t) }))), () => redesenharSecao(rel, sec));
}
function alterarParSilencioso(rel, sec, p, novo) { const k = `P:${sec.num}:${p.id}`, s = stOf(rel, k); if (!edicaoValida(s, p)) s.base = p.texto; s.texto = novo; s.alterado = true; s.sit = "azul"; tocar(rel, k); }
TELAS.revisor = {
  nav: "doc",
  topo(T) { ap(T, botaoLat(), h("span", { class: "ttl" }, "Revisor de texto")); },
  corpo(m) {
    const col = h("div", { class: "col" }); ap(m, col);
    let rascunho = ""; try { rascunho = sessionStorage.getItem("omega.rev") || ""; } catch (e) {}
    const ta = h("textarea", { id: "rev-livre", rows: "8", placeholder: "Escreva ou cole o texto aqui…" }); ta.value = rascunho;
    const conf = h("div", { class: "card par", style: "display:block;min-height:60px" }), status = h("p", { class: "sub" });
    let tmr; const pintar = () => {
      try { sessionStorage.setItem("omega.rev", ta.value); } catch (e) {}
      if (DICSTATE !== "ok") { status.textContent = "Carregando o dicionário…"; carregarDic(() => { if (DICSTATE === "ok") pintar(); else status.textContent = "O dicionário não carregou."; }); return; }
      status.textContent = "Palavras sublinhadas não estão no dicionário. Toque numa delas.";
      const pt = h("div", { class: "pt" }); renderTexto(pt, ta.value, novo => { ta.value = novo; pintar(); }, true); conf.replaceChildren(pt);
    };
    ta.addEventListener("input", () => { clearTimeout(tmr); tmr = setTimeout(pintar, 500); });
    if (!CEL) ap(col, h("h1", { class: "rt" }, "Revisor de texto"));
    ap(col, h("div", { class: "meta" }, "Confere a ortografia neste aparelho. O dicionário só carrega aqui."), campoComMic(ta), status, conf,
      h("div", { class: "botoes" },
        h("button", { type: "button", class: "btn pri", onclick: () => copiar(ta.value, "Texto copiado.") }, ico("copy"), "Copiar texto corrigido"),
        h("a", { class: "btn", href: URLS.gemini, target: "_blank", rel: "noopener", onclick: () => copiar(PERGUNTA + "\n\n" + ta.value, "Copiado. Cole no Gemini.") }, ico("spark"), "Revisão final no Gemini"),
        h("button", { type: "button", class: "btn", onclick: () => { ta.value = ""; pintar(); } }, "Limpar")));
    if (ta.value) pintar(); else status.textContent = "O dicionário carrega quando você escrever.";
  }
};

/* ================= teclado ================= */
document.addEventListener("keydown", e => {
  if (e.ctrlKey && e.shiftKey && (e.key === "M" || e.key === "m")) { e.preventDefault(); Ditado.atalho(); return; }
  if (e.key === "Escape") { if (DLG) { fecharDialogo(); return; } if (MENU) { fecharMenus(); return; } if (POP) { fecharPop(); return; } if (DRAWER) { DRAWER = false; aplicarLayout(); return; } }
  if (POP || DLG) return;
  if (((e.ctrlKey || e.metaKey) && e.key === "k") || (e.key === "/" && !ehCampo(e.target))) {
    e.preventDefault(); if (CEL) { DRAWER = true; aplicarLayout(); } else if (!PREF.lat) { PREF.lat = true; salvarPref(); montar({ forcar: true }); }
    const b = $("#busca-lat"); if (b) { b.focus(); b.select(); } return;
  }
  if (ehCampo(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
  if (VISTA === "rel") {
    if (e.key === "n" || e.key === "N") { e.preventDefault(); irProximo(1); }
    else if (e.key === "p" || e.key === "P") { e.preventDefault(); irProximo(-1); }
  }
});

/* ================= início ================= */
function iniciar() {
  $("#scrim-lat").addEventListener("click", () => { DRAWER = false; aplicarLayout(); });
  aplicarLayout();
  montar({ forcar: true });
  MQ.addEventListener("change", () => { CEL = MQ.matches; DRAWER = false; fecharPop(); fecharMenus(); montar({ forcar: true }); });
  addEventListener("resize", () => { if (POP && !CEL && POP.el && POP.ancora && document.contains(POP.ancora)) posicionarPop(POP.el, POP.ancora); });
  aoMudar(o => {
    if (o.tipo === "gravado") { const e = $("#estado-grav"); const rel = relAtual(); if (e && rel) e.textContent = estadoGravacao(rel); return; }
    if (VISTA === "rel" && relAtual() == null && PREF.atual && !REL[PREF.atual]) VISTA = "inicio";
    const y = scrollY; montar(); scrollTo(0, y);
  });
  Banco.conectar();
}
