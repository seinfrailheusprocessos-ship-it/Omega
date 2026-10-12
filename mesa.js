"use strict";
/* Omega — Mesa PDF por gesto (miniaturas; arrastar para a direita extrai; segurar seleciona várias)
   e Revisão da separação feita pelo script do pipeline. */

const MESA = { arq: null, nome: "", base: "", total: 0, doc: null, sel: new Set(), modoSel: false, rolando: false, ult: null, carregando: false, obs: null };
let pdfJsPronto = null;
function carregarPdfJs() {
  if (window.pdfjsLib && window.pdfjsLib.__omegaOk) return Promise.resolve();
  return pdfJsPronto || (pdfJsPronto = new Promise((ok, no) => {
    const s = h("script", { src: "pdf-mesa.js" });
    s.onload = () => {
      try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([window.__PDF_WORKER_SRC], { type: "text/javascript" })); window.pdfjsLib.__omegaOk = true; ok(); }
      catch (e) { pdfJsPronto = null; no(e); }
    };
    s.onerror = () => { pdfJsPronto = null; no(new Error("O leitor de PDF não carregou.")); };
    document.head.append(s);
  }));
}
function escolherPDF() {
  const i = h("input", { type: "file", accept: "application/pdf", style: "display:none", onchange: async () => {
    const f = i.files[0]; i.remove(); if (!f) return;
    MESA.arq = f; MESA.nome = f.name; MESA.base = f.name.replace(/\.pdf$/i, ""); MESA.total = 0; MESA.doc = null; MESA.sel.clear(); MESA.modoSel = false; pararRolagemMesa();
    MESA.carregando = true; if (VISTA !== "mesa") ir("mesa"); else redesenharTudo();
    try {
      await carregarPdfJs();
      MESA.doc = await window.pdfjsLib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
      MESA.total = MESA.doc.numPages;
    } catch (e) { console.error(e); aviso("Não consegui ler este PDF: " + (e.message || e)); MESA.arq = null; }
    MESA.carregando = false;
    if (VISTA === "mesa") redesenharTudo();
  } });
  document.body.append(i); i.click();
}
function rotuloPaginas(ps) { const a = [...ps].sort((x, y) => x - y), r = []; for (let i = 0; i < a.length;) { let j = i; while (a[j + 1] === a[j] + 1) j++; r.push(j > i ? `${a[i]}-${a[j]}` : `${a[i]}`); i = j + 1; } return r.join(","); }
function rotuloSel(ps) { const a = [...ps].sort((x, y) => x - y); if (!a.length) return "nenhuma"; if (a.length === 1) return `p. ${a[0]}`; return `p. ${a.slice(0, -1).join(", ")} e ${a[a.length - 1]} (${a.length})`; }
function nomeSugerido(ps) { const rel = relAtual(), cod = rel ? codigoRel(rel) : ""; return `${cod ? cod + "-" : ""}${slug(MESA.base)}-p${rotuloPaginas(ps)}.pdf`; }

/* ---- miniaturas: desenhadas só quando aparecem na tela ---- */
const THUMBS = new Map();
async function desenharMiniatura(n, box) {
  if (!MESA.doc) return;
  const chaveM = MESA.nome + ":" + n;
  if (THUMBS.has(chaveM)) { box.replaceChildren(THUMBS.get(chaveM)); return; }
  try {
    const pg = await MESA.doc.getPage(n), v0 = pg.getViewport({ scale: 1 }), esc = 220 / v0.width, vp = pg.getViewport({ scale: esc });
    const c = document.createElement("canvas"); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
    THUMBS.set(chaveM, c); if (THUMBS.size > 400) THUMBS.delete(THUMBS.keys().next().value);
    box.replaceChildren(c);
  } catch (e) { box.replaceChildren(h("span", { class: "carregando" }, "sem prévia")); }
}

/* ---- rolagem sozinha durante a seleção (velocidade ajustável; um toque para) ---- */
let rafMesa = 0, ultMesa = 0, restoMesa = 0;
function passoMesa(t) {
  if (!MESA.rolando) return;
  const dt = ultMesa ? Math.min(100, t - ultMesa) : 16; ultMesa = t;
  restoMesa += (PREF.velMesa || 3) * 14 * dt / 1000; const px = Math.floor(restoMesa); restoMesa -= px;
  if (px) scrollBy(0, px);
  if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) { pararRolagemMesa(); return; }
  rafMesa = requestAnimationFrame(passoMesa);
}
function ligarRolagemMesa() { if (MESA.rolando) return; MESA.rolando = true; ultMesa = 0; restoMesa = 0; rafMesa = requestAnimationFrame(passoMesa); desenharBarraSel(); }
function pararRolagemMesa() { MESA.rolando = false; cancelAnimationFrame(rafMesa); desenharBarraSel(); }

/* ---- gestos sobre cada página ---- */
function ligarGestos(th, n) {
  let x0 = 0, y0 = 0, t0 = 0, longo = null, arrastando = false, segurou = false, id = null;
  th.addEventListener("pointerdown", e => {
    if (e.button > 0) return;
    x0 = e.clientX; y0 = e.clientY; t0 = Date.now(); arrastando = false; segurou = false; id = e.pointerId;
    clearTimeout(longo);
    if (e.pointerType !== "mouse") longo = setTimeout(() => {
      segurou = true; MESA.modoSel = true; MESA.sel.add(n); if (navigator.vibrate) try { navigator.vibrate(15); } catch (er) {}
      atualizarSelecao(); ligarRolagemMesa();
    }, 500);
  });
  th.addEventListener("pointermove", e => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    if (!arrastando && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) clearTimeout(longo);
    if (!arrastando && dx > 14 && Math.abs(dx) > Math.abs(dy) * 1.4) { arrastando = true; try { th.setPointerCapture(id); } catch (er) {} th.classList.add("drag"); if (MESA.rolando) pararRolagemMesa(); }
    if (arrastando) { th.style.transform = `translate(${Math.max(0, dx)}px, ${dy * 0.3}px) rotate(${Math.min(3, dx / 60)}deg)`; const dz = $(".dz"); if (dz) { const r = dz.getBoundingClientRect(); dz.classList.toggle("sobre", e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom); } }
  });
  const fim = e => {
    if (e.pointerId !== id) return; id = null; clearTimeout(longo);
    if (arrastando) {
      const dx = e.clientX - x0; th.classList.remove("drag"); th.style.transform = "";
      const dz = $(".dz"); let dentro = false; if (dz) { const r = dz.getBoundingClientRect(); dentro = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; dz.classList.remove("sobre"); }
      if (dentro || dx > (CEL ? 70 : 120)) { const ps = MESA.sel.has(n) && MESA.sel.size ? [...MESA.sel] : [n]; extrairFluxo(ps); }
      arrastando = false; return;
    }
    if (segurou) return;
    if (Date.now() - t0 > 600) return;
    tocarPagina(n, e, th);
  };
  th.addEventListener("pointerup", fim);
  th.addEventListener("pointercancel", e => { if (e.pointerId === id) { id = null; clearTimeout(longo); th.classList.remove("drag"); th.style.transform = ""; arrastando = false; } });
  th.addEventListener("contextmenu", e => e.preventDefault());
}
function tocarPagina(n, e, th) {
  const toque = e.pointerType !== "mouse";
  if (!toque || MESA.modoSel) {
    if (!toque && e.shiftKey && MESA.ult) { const a = Math.min(MESA.ult, n), b = Math.max(MESA.ult, n); for (let i = a; i <= b; i++) MESA.sel.add(i); }
    else if (MESA.sel.has(n)) MESA.sel.delete(n); else MESA.sel.add(n);
    MESA.ult = n; MESA.modoSel = MESA.sel.size > 0;
    if (!MESA.modoSel) pararRolagemMesa();
    atualizarSelecao();
    /* selecionou uma de baixo: a tela pula para a próxima fileira */
    if (toque && MESA.sel.has(n)) { const r = th.getBoundingClientRect(); if (r.bottom > innerHeight * 0.7) scrollBy({ top: r.height + 10, behavior: "smooth" }); }
    return;
  }
  verPagina(n);
}
async function verPagina(n) {
  const box = h("div", { style: "background:#fff;border-radius:6px;overflow:hidden;min-height:200px;display:flex;align-items:center;justify-content:center" }, h("span", { style: "color:#888" }, "Carregando…"));
  dialogo(`Página ${n} de ${MESA.total}`, [box, h("p", { class: "sub" }, "Segure uma página para marcar várias. Arraste para a direita para extrair.")],
    [{ rotulo: "Fechar" }, { rotulo: MESA.sel.has(n) ? "Desmarcar" : "Selecionar", fn: () => { if (MESA.sel.has(n)) MESA.sel.delete(n); else MESA.sel.add(n); MESA.modoSel = MESA.sel.size > 0; atualizarSelecao(); } },
      { rotulo: "Extrair esta página", pri: true, fn: () => { setTimeout(() => extrairFluxo([n]), 50); } }]);
  try { const pg = await MESA.doc.getPage(n), v0 = pg.getViewport({ scale: 1 }), esc = Math.min(2, (Math.min(innerWidth - 64, 560)) / v0.width), vp = pg.getViewport({ scale: esc }); const c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height; c.style.width = "100%"; await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise; box.replaceChildren(c); } catch (er) { box.textContent = "Sem prévia."; }
}
function atualizarSelecao() {
  $$(".th[data-p]").forEach(th => { const n = +th.dataset.p, s = MESA.sel.has(n); th.classList.toggle("sel", s); const ck = th.querySelector(".ck"); if (s && !ck) th.append(h("span", { class: "ck" }, ico("check"))); else if (!s && ck) ck.remove(); });
  const info = $("#mesa-sel"); if (info) info.replaceChildren(...painelSelecao());
  desenharBarraSel();
}
function painelSelecao() {
  const ps = [...MESA.sel];
  return [h("div", { class: "sub" }, "Selecionadas"), h("div", { style: "font-weight:600;margin:2px 0 8px" }, rotuloSel(ps)),
    ps.length ? h("div", { style: "color:var(--stx);font-size:12px" }, "Nome sugerido:", h("br"), h("span", { style: "color:var(--tx);word-break:break-all" }, nomeSugerido(ps))) : h("div", { class: "sub" }, "Clique nas páginas (Shift marca um intervalo) ou arraste uma para cá."),
    ps.length ? h("div", { style: "display:flex;gap:6px;margin-top:10px;flex-wrap:wrap" }, h("button", { type: "button", class: "btn sm pri", onclick: () => extrairFluxo(ps) }, ico("scissor"), "Extrair"), h("button", { type: "button", class: "btn sm", onclick: () => { MESA.sel.clear(); MESA.modoSel = false; atualizarSelecao(); } }, "Limpar")) : null];
}
let barraSel = null;
function desenharBarraSel() {
  if (barraSel) { barraSel.remove(); barraSel = null; }
  if (!CEL || VISTA !== "mesa" || !MESA.sel.size) return;
  barraSel = h("div", { class: "barra-sel", role: "group", "aria-label": "Seleção da Mesa PDF" },
    h("b", {}, `${MESA.sel.size} selecionada${MESA.sel.size === 1 ? "" : "s"}`),
    h("button", { type: "button", class: "btn sm", onclick: () => extrairFluxo([...MESA.sel]) }, ico("scissor"), "Extrair"),
    h("button", { type: "button", class: "btn sm", "aria-label": "Renomear o arquivo de origem", onclick: renomearBase }, ico("pen")),
    h("button", { type: "button", class: "btn sm pri", onclick: () => extrairFluxo([...MESA.sel]) }, "Salvar"),
    h("div", { style: "flex-basis:100%;display:flex;align-items:center;gap:8px" },
      h("button", { type: "button", class: "btn sm", "aria-label": MESA.rolando ? "Parar a rolagem" : "Rolar sozinho", onclick: () => MESA.rolando ? pararRolagemMesa() : ligarRolagemMesa() }, ico(MESA.rolando ? "pause" : "play"), MESA.rolando ? "Parar" : "Rolar"),
      h("span", { class: "sub" }, "velocidade"),
      h("button", { type: "button", class: "btn sm", "aria-label": "Mais devagar", onclick: () => { PREF.velMesa = Math.max(1, (PREF.velMesa || 3) - 1); salvarPref(); desenharBarraSel(); } }, ico("minus")),
      h("b", { class: "num" }, String(PREF.velMesa || 3)),
      h("button", { type: "button", class: "btn sm", "aria-label": "Mais rápido", onclick: () => { PREF.velMesa = Math.min(10, (PREF.velMesa || 3) + 1); salvarPref(); desenharBarraSel(); } }, ico("plus")),
      h("button", { type: "button", class: "btn sm", style: "margin-left:auto", onclick: () => { MESA.sel.clear(); MESA.modoSel = false; pararRolagemMesa(); atualizarSelecao(); } }, "Limpar")));
  document.body.append(barraSel);
}
/* um toque fora das páginas para a rolagem */
document.addEventListener("pointerdown", e => { if (MESA.rolando && VISTA === "mesa" && !e.target.closest(".th, .barra-sel")) pararRolagemMesa(); }, true);
function renomearBase() {
  if (!MESA.arq) { aviso("Abra um PDF primeiro."); return; }
  const inp = h("input", { type: "text", value: MESA.base });
  dialogo("Renomear (nome base dos extraídos)", [campoComMic(inp)], [{ rotulo: "Cancelar" }, { rotulo: "OK", pri: true, fn: () => { MESA.base = inp.value.trim() || MESA.base; atualizarSelecao(); } }]);
  setTimeout(() => inp.focus(), 50);
}

/* ---- extrair: renomear, escolher destino, gerar e entregar ---- */
function extrairFluxo(ps) {
  ps = [...new Set(ps)].sort((a, b) => a - b);
  if (!ps.length) { aviso("Selecione as páginas."); return; }
  if (MESA.rolando) pararRolagemMesa();
  const inp = h("input", { type: "text", value: nomeSugerido(ps), "aria-label": "Nome do arquivo" });
  dialogo("Renomear o extraído", [h("p", { class: "sub" }, rotuloSel(ps)), campoComMic(inp)],
    [{ rotulo: "Cancelar" }, { rotulo: "Continuar", pri: true, fn: () => { let nome = inp.value.trim() || nomeSugerido(ps); if (!/\.pdf$/i.test(nome)) nome += ".pdf"; setTimeout(() => escolherDestino(ps, nome), 30); } }]);
  setTimeout(() => { inp.focus(); try { inp.setSelectionRange(0, inp.value.replace(/\.pdf$/i, "").length); } catch (e) {} }, 60);
}
function escolherDestino(ps, nome) {
  const rel = relAtual(), origem = rel ? `${codigoRel(rel)} ${nomeCurto(rel)}`.trim() : "";
  const op = (rot, sub, fn) => h("button", { type: "button", class: "o", onclick: () => { fecharDialogo(); fn(); } }, h("span", {}, rot), h("span", { class: "sub" }, sub));
  dialogo(`Onde guardar ${nome}?`, [h("p", { class: "sub" }, "O Omega entrega o arquivo para você baixar e anota o destino; o Claude move para a pasta quando estiver com o seu computador."),
    h("div", { class: "opcoes-dlg" },
      op("Salvar na pasta de origem", origem || "pasta do relatório aberto", () => gerarExtraido(ps, nome, { tipo: "origem", pasta: rel ? codigoRel(rel) : "", descricao: origem ? `pasta de origem (${origem})` : "pasta de origem" })),
      op("Salvar em pasta existente", "escolher na lista", () => escolherPastaExistente(ps, nome)),
      op("Criar pasta nova", "dar um nome ou código", () => criarPastaNova(ps, nome)),
      op("Criar resposta", `pasta ${nome.replace(/\.pdf$/i, "")}`, () => gerarExtraido(ps, nome, { tipo: "resposta", pasta: nome.replace(/\.pdf$/i, ""), descricao: `nova pasta de resposta ${nome.replace(/\.pdf$/i, "")}` }))
    )], [{ rotulo: "Cancelar" }]);
}
function escolherPastaExistente(ps, nome) {
  const { nos } = construirArvore();
  const cods = Object.keys(nos).sort(cmpCodigo);
  dialogo("Pasta existente", h("div", { class: "opcoes-dlg" }, cods.map(c => h("button", { type: "button", class: "o", onclick: () => { fecharDialogo(); gerarExtraido(ps, nome, { tipo: "existente", pasta: c, descricao: `pasta ${c} ${nomePasta(c)}` }); } }, h("span", { class: "n", style: "min-width:48px;color:var(--mut)" }, c), h("span", {}, nomePasta(c))))), [{ rotulo: "Cancelar" }]);
}
function criarPastaNova(ps, nome) {
  const inp = h("input", { type: "text", placeholder: "Ex.: 3.1.5 ou Anexos do laudo" });
  dialogo("Criar pasta nova", [h("p", { class: "sub" }, "O Claude cria a pasta no computador ao mover o arquivo."), campoComMic(inp)],
    [{ rotulo: "Cancelar" }, { rotulo: "Salvar", pri: true, fn: () => { const p = inp.value.trim(); if (!p) { aviso("Dê um nome à pasta."); return false; } setTimeout(() => gerarExtraido(ps, nome, { tipo: "nova", pasta: p, descricao: `pasta nova ${p}` }), 30); } }]);
  setTimeout(() => inp.focus(), 50);
}
async function gerarExtraido(ps, nome, destino) {
  if (!MESA.arq) { aviso("Abra o PDF de novo."); return; }
  try {
    aviso("Extraindo…");
    await carregarPDFLib();
    const src = await PDFLib.PDFDocument.load(await MESA.arq.arrayBuffer(), { ignoreEncryption: true }), out = await PDFLib.PDFDocument.create();
    (await out.copyPages(src, ps.map(x => x - 1))).forEach(p => out.addPage(p));
    const blob = new Blob([await out.save()], { type: "application/pdf" });
    const ok = await baixar(nome, blob);
    const id = "X" + Date.now().toString(36);
    const reg = { id, arquivo: nome, origem: MESA.nome, paginas: rotuloPaginas(ps), destino, relatorio: PREF.atual || null, criado: new Date().toISOString(), baixado: !!ok };
    Banco.gravarDoc("extracoes/" + id, reg);
    const rel = relAtual();
    if (rel && !rel.local) {
      (rel.entrada = rel.entrada || []).push({ id, arquivo: nome, paginas: reg.paginas, destino: destino.descricao, criado: reg.criado });
      Banco.marcar(rel, null, "entrada");
      const s = stOf(rel, "E:" + id); s.v = destino.tipo === "resposta" ? "Responder" : "Pendente"; tocar(rel, "E:" + id);
    }
    ps.forEach(n => { const th = document.querySelector(`.th[data-p="${n}"]`); if (th) { th.classList.add("extraindo"); setTimeout(() => th.classList.remove("extraindo"), 1500); } });
    MESA.sel.clear(); MESA.modoSel = false; atualizarSelecao();
    aviso(ok ? `Extraído: ${nome}. Destino anotado: ${destino.descricao}.` : `Destino anotado (${destino.descricao}); o download não foi confirmado.`);
  } catch (e) { console.error(e); aviso("Não consegui extrair: " + (e.message || e)); }
}

TELAS.mesa = {
  nav: "mesa",
  topo(T) {
    if (CEL) { ap(T, botaoLat(), h("span", { class: "ttl" }, "Mesa PDF"), h("button", { class: "ib", type: "button", title: "Abrir PDF", "aria-label": "Abrir PDF", onclick: escolherPDF }, ico("plus")), h("button", { class: "ib", type: "button", title: "Revisão da separação", "aria-label": "Revisão da separação", onclick: () => ir("revisao") }, ico("check"))); return; }
    ap(T, botaoLat(), h("span", { class: "ttl" }, "Mesa PDF"),
      h("button", { type: "button", class: "tb", onclick: renomearBase }, ico("pen"), h("span", { class: "tbl" }, "Renomear")),
      h("button", { type: "button", class: "tb", onclick: () => extrairFluxo([...MESA.sel]) }, ico("scissor"), h("span", { class: "tbl" }, "Extrair seleção")),
      h("button", { type: "button", class: "tb", onclick: () => ir("revisao") }, ico("layers"), h("span", { class: "tbl" }, "Enviar à revisão")));
  },
  corpo(m) {
    const wrap = h("div", { class: "mesa" }); ap(m, wrap);
    const esq = h("div", { class: "mesa-esq" }); ap(wrap, esq);
    if (CEL) ap(esq, h("div", { class: "meta" }, MESA.arq ? `${MESA.nome} · ${MESA.total || "…"} págs` : "Nenhum PDF aberto"));
    else ap(esq, h("div", { class: "mesa-cab" }, h("h1", { class: "rt", style: "font-size:16px" }, "Mesa PDF"), h("span", { class: "sub" }, MESA.arq ? `${MESA.nome} · ${MESA.total || "…"} págs` : "nenhum PDF aberto"),
      h("span", { style: "margin-left:auto" }), h("button", { type: "button", class: "btn sm", onclick: escolherPDF }, ico("plus"), "Abrir PDF"),
      h("button", { type: "button", class: "btn sm pri", onclick: () => MESA.sel.size ? extrairFluxo([...MESA.sel]) : aviso("Selecione as páginas para salvar.") }, "Salvar…")));
    if (!MESA.arq) {
      ap(esq, h("div", { class: "vazio" }, h("b", {}, "Abra um PDF para separar páginas."), h("span", {}, CEL ? "Segure uma página para marcar várias; arraste para a direita para extrair." : "Clique para marcar páginas (Shift marca um intervalo) e arraste para a direita para extrair."),
        h("button", { type: "button", class: "btn pri", onclick: escolherPDF }, ico("plus"), "Abrir PDF")));
      return;
    }
    if (MESA.carregando || !MESA.doc) { ap(esq, h("p", { class: "mut" }, "Lendo o PDF…")); return; }
    const grade = h("div", { class: "grade" });
    if (MESA.obs) MESA.obs.disconnect();
    MESA.obs = new IntersectionObserver(ents => ents.forEach(en => { if (en.isIntersecting) { MESA.obs.unobserve(en.target); desenharMiniatura(+en.target.dataset.p, en.target.querySelector(".pgm")); } }), { rootMargin: "400px 0px" });
    for (let n = 1; n <= MESA.total; n++) {
      const th = h("div", { class: "th" + (MESA.sel.has(n) ? " sel" : ""), "data-p": n, role: "button", tabindex: "0", "aria-label": `Página ${n}` },
        h("div", { class: "pgm" }, h("span", { class: "carregando" }, "…")), h("div", { class: "lb" }, h("span", {}, `p. ${n}`), h("span", {})), MESA.sel.has(n) ? h("span", { class: "ck" }, ico("check")) : null);
      th.addEventListener("keydown", e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (MESA.sel.has(n)) MESA.sel.delete(n); else MESA.sel.add(n); MESA.modoSel = MESA.sel.size > 0; atualizarSelecao(); } else if (e.key === "ArrowRight" && e.shiftKey) { extrairFluxo(MESA.sel.size ? [...MESA.sel] : [n]); } });
      ligarGestos(th, n); grade.append(th); MESA.obs.observe(th);
    }
    ap(esq, grade, h("div", { class: "sub", style: "margin-top:14px" }, CEL ? "Segure uma página para marcar várias · arraste para a direita para extrair · a lista rola sozinha enquanto você marca" : "Segure ou clique para marcar várias · arraste para a direita para extrair · Shift+→ extrai pelo teclado"));
    if (!CEL) ap(wrap, h("div", { class: "mesa-dir" }, h("div", { class: "dz", style: "flex:1" }, ico("scissor"), h("b", {}, "Solte aqui", h("br"), "para extrair"), h("span", { class: "sub" }, "cria um novo PDF com as páginas escolhidas")),
      h("div", { class: "card", id: "mesa-sel" }, ...painelSelecao())));
    setTimeout(desenharBarraSel, 0);
  }
};
/* ao sair da Mesa, some a barra de seleção e para a rolagem */
function aoSairDaMesa() { if (VISTA !== "mesa") { if (barraSel) { barraSel.remove(); barraSel = null; } if (MESA.rolando) pararRolagemMesa(); } }

/* ================= Revisão da separação (lote gravado pelo pipeline no banco) ================= */
const ST_REV = { ok: ["OK", "cg"], revisar_nome: ["Revisar nome", "cb"], pasta_duvidosa: ["Pasta duvidosa", "cr"], solto: ["Solto", "cb"] };
let EDIT_REV = null;
function lotesOrdenados() { return Object.keys(PIPE).sort((a, b) => (Date.parse(PIPE[b].criado) || 0) - (Date.parse(PIPE[a].criado) || 0) || b.localeCompare(a)); }
function decRev(lote, i) { return ((REVISAO[lote] || {}).itens || {})[i] || null; }
function gravarRev(lote, i, dados) {
  const r = REVISAO[lote] = REVISAO[lote] || { itens: {} }; r.itens = r.itens || {};
  r.itens[i] = Object.assign({}, r.itens[i] || {}, dados, { t: Date.now() }); r.atualizado = new Date().toISOString();
  Banco.gravarDoc("revisao/" + lote, { itens: { [i]: r.itens[i] }, atualizado: r.atualizado }, true);
}
TELAS.revisao = {
  nav: "mesa",
  topo(T) { ap(T, botaoLat(), h("span", { class: "ttl" }, CEL ? "Revisão da separação" : "Revisão · pipeline")); },
  corpo(m) {
    const col = h("div", { class: "col" }); ap(m, col);
    const lotes = lotesOrdenados();
    if (!lotes.length) {
      if (!CEL) ap(col, h("h1", { class: "rt" }, "Revisão da separação"));
      ap(col, h("div", { class: "vazio" }, h("b", {}, "Nenhum lote do pipeline ainda."), h("span", {}, "Quando o script separar um PDF escaneado, o Claude grava o lote aqui e você aprova arquivo por arquivo."),
        h("button", { type: "button", class: "btn", onclick: () => ir("mesa") }, "Ir à Mesa PDF")));
      return;
    }
    let lote = PREF.lote && PIPE[PREF.lote] ? PREF.lote : lotes[0];
    const L = PIPE[lote], arqs = Array.isArray(L.arquivos) ? L.arquivos : Array.isArray(L.docs) ? L.docs : [];
    const status = (a, i) => { const d = decRev(lote, i); return d && d.acao === "aprovado" ? "aprovado" : (a.status || (a.confianca != null && a.confianca < 0.7 ? "pasta_duvidosa" : "ok")); };
    const cont = { ok: 0, revisar: 0, duvidoso: 0, aprovado: 0 };
    arqs.forEach((a, i) => { const s = status(a, i); if (s === "aprovado") cont.aprovado++; else if (s === "ok") cont.ok++; else if (s === "pasta_duvidosa") cont.duvidoso++; else cont.revisar++; });
    if (!CEL) ap(col, h("h1", { class: "rt" }, "Revisão da separação"), h("div", { class: "meta" }, h("span", {}, `${L.origem || lote} → ${arqs.length} arquivo${arqs.length === 1 ? "" : "s"}`),
      h("span", { class: "prog" }, cont.ok ? h("span", {}, dot("g"), cont.ok) : null, cont.revisar ? h("span", {}, dot("b"), cont.revisar) : null, cont.duvidoso ? h("span", {}, dot("r"), cont.duvidoso) : null, cont.aprovado ? h("span", { class: "mut" }, `${cont.aprovado} aprovado${cont.aprovado === 1 ? "" : "s"}`) : null)));
    else ap(col, h("div", { class: "meta" }, `${arqs.length} arquivos · ${cont.ok} OK · ${cont.revisar} revisar · ${cont.duvidoso} duvidoso${cont.aprovado ? ` · ${cont.aprovado} aprovado` : ""}`));
    if (lotes.length > 1) ap(col, h("div", { class: "campo-texto", style: "margin-bottom:12px" }, h("select", { "aria-label": "Lote", onchange: e => { PREF.lote = e.target.value; salvarPref(); redesenharTudo(); } }, lotes.map(k => h("option", { value: k, selected: k === lote ? true : null }, `${PIPE[k].origem || k}${PIPE[k].criado ? " · " + dataHora(Date.parse(PIPE[k].criado)) : ""}`)))));
    arqs.forEach((a, i) => {
      const d = decRev(lote, i) || {}, s = status(a, i), nome = d.arquivo || a.arquivo || a.nome || `arquivo ${i + 1}`, dest = d.destino || a.destino || a.pasta || "";
      const [rot, cls] = s === "aprovado" ? ["Aprovado", "cg"] : ST_REV[s] || [s, "cb"];
      const mini = h("div", { class: "mini-pg", style: CEL ? "width:34px;height:46px" : "" }, h("i"), h("i"), h("i"));
      const card = h("div", { class: "card rev-card" + (s === "aprovado" ? " aprovado" : "") }, mini,
        h("div", { class: "info" }, h("div", { class: "nm", title: nome }, nome), h("div", { class: "sub" }, CEL ? (dest || "sem pasta") : `${a.tipo || "documento"}${a.paginas ? " · p. " + a.paginas : ""} → ${dest || "sem pasta"}`), d.obs ? h("div", { class: "sub" }, "Obs.: " + d.obs) : null),
        h("span", { class: "chip " + cls }, rot),
        h("div", { class: "acoes-rev", style: CEL ? "" : "display:flex;gap:8px" },
          h("button", { type: "button", class: "btn sm", onclick: () => { EDIT_REV = EDIT_REV === `${lote}:${i}` ? null : `${lote}:${i}`; redesenharTudo(); } }, ico("pen"), "Editar"),
          s === "aprovado" ? h("button", { type: "button", class: "btn sm", onclick: () => { gravarRev(lote, i, { acao: "pendente" }); redesenharTudo(); } }, "Desfazer")
            : h("button", { type: "button", class: "btn sm pri", onclick: () => { gravarRev(lote, i, { acao: "aprovado", arquivo: nome, destino: dest }); aviso(`Aprovado: ${nome}.`); redesenharTudo(); } }, ico("check"), "Aprovar")));
      ap(col, card);
      if (EDIT_REV === `${lote}:${i}`) {
        const n = h("input", { type: "text", value: nome }), p = h("input", { type: "text", value: dest }), o = h("textarea", { rows: "2" }); o.value = d.obs || "";
        ap(col, h("div", { class: "card rev-edit", style: "margin:-4px 0 12px" },
          h("label", {}, h("span", { class: "sub" }, "Nome do arquivo (maiúsculas, partes com _, sem N. e sem barra)"), campoComMic(n)), h("label", {}, h("span", { class: "sub" }, "Pasta de destino"), campoComMic(p)), h("label", {}, h("span", { class: "sub" }, "Observação para o Claude"), campoComMic(o)),
          h("div", { class: "botoes", style: "margin-top:4px" }, h("button", { type: "button", class: "btn pri", onclick: () => { gravarRev(lote, i, { acao: "editado", arquivo: n.value.trim(), destino: p.value.trim(), obs: o.value.trim() }); EDIT_REV = null; aviso("Correção guardada."); redesenharTudo(); } }, "Salvar correção"),
            h("button", { type: "button", class: "btn", onclick: () => { gravarRev(lote, i, { acao: "separar_de_novo", obs: o.value.trim() }); EDIT_REV = null; aviso("Marcado para separar de novo. Abra o PDF original na Mesa."); ir("mesa"); } }, ico("scissor"), "Separar de novo na Mesa"),
            h("button", { type: "button", class: "btn", onclick: () => { EDIT_REV = null; redesenharTudo(); } }, "Cancelar"))));
      }
    });
    const okIdx = arqs.map((a, i) => i).filter(i => status(arqs[i], i) === "ok");
    ap(col, h("div", { class: "botoes", style: "margin-top:6px" },
      h("button", { type: "button", class: "btn pri", disabled: !okIdx.length, onclick: () => { okIdx.forEach(i => gravarRev(lote, i, { acao: "aprovado", arquivo: arqs[i].arquivo || arqs[i].nome, destino: arqs[i].destino || arqs[i].pasta || "" })); aviso(`${okIdx.length} aprovado(s).`); redesenharTudo(); } }, ico("check"), `Aprovar os que estão OK (${okIdx.length})`),
      h("button", { type: "button", class: "btn", onclick: () => ir("mesa") }, "Voltar à Mesa PDF")));
  }
};
