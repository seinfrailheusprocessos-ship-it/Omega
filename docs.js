"use strict";
/* Omega — documentos: padrão oficial (Arial 12, A4, margens 3,5/2,5/3/3 cm), prévia paginada, PDF, Word, documento avulso, Gmail. */

const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ANO = new Date().getFullYear();
const ehLicitacao = s => /licita|aditivo|preg[aã]o|concorr|dispensa|inexigib|\bdfd\b|\betp\b|termo de refer/i.test(s || "");
const TIPOS_DOC = ["Ofício", "Comunicação interna (CI)", "Despacho", "Nota técnica", "Portaria", "Documento"];

/* ---- baixar pelo Claude (capacidade downloads) ---- */
async function baixar(nome, dados) {
  let dl = null;
  try { dl = window.claude && typeof window.claude.use === "function" ? await window.claude.use("downloads") : null; } catch (e) {}
  if (!dl) { aviso("Baixar não está disponível nesta tela. Use Copiar texto."); return false; }
  try { const r = await dl.save({ filename: nome, data: dados }); if (r && r.status === "saved") aviso("Arquivo pronto: " + nome); return true; }
  catch (e) { aviso(e && e.code === "declined" ? "Download cancelado." : e && e.code === "rate_limited" ? "Já há um download aguardando confirmação." : "Não consegui baixar (" + (e && (e.code || e.message) || "erro") + ")."); return false; }
}
let pdfLibPronto = null;
function carregarPDFLib() {
  if (window.PDFLib) return Promise.resolve();
  return pdfLibPronto || (pdfLibPronto = new Promise((ok, no) => { const s = h("script", { src: "pdf-lib.min.js" }); s.onload = ok; s.onerror = () => { pdfLibPronto = null; no(new Error("pdf-lib não carregou")); }; document.head.append(s); }));
}

/* ---- brasão (guardado no banco: config/brasao) ---- */
function escolherBrasao(depois) {
  const i = h("input", { type: "file", accept: "image/png,image/jpeg", style: "display:none", onchange: () => {
    const f = i.files[0]; i.remove(); if (!f) return;
    const url = URL.createObjectURL(f), im = new Image();
    im.onload = () => {
      const k = Math.min(1, 300 / Math.max(im.width, im.height)), c = document.createElement("canvas");
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      CFG.brasao = { url: c.toDataURL("image/png"), w: c.width, h: c.height }; URL.revokeObjectURL(url);
      Banco.gravarDoc("config/brasao", CFG.brasao).then(ok => aviso(ok ? "Brasão guardado no banco." : "Brasão usado só nesta tela (sem banco)."));
      if (depois) depois();
    };
    im.onerror = () => aviso("Não consegui ler essa imagem.");
    im.src = url;
  } });
  document.body.append(i); i.click();
}
function brasaoBytes() { const b = String((CFG.brasao && CFG.brasao.url) || "").split(",")[1]; if (!b) return null; const bin = atob(b), u = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k); return u; }

/* ================= blocos do documento =================
   tit, proc, quadro{linhas:[[rótulo, valor]]}, dest, assunto, cap, par, fecho, assin{linhas} */
function tituloDoc(tipo, opt) {
  const n = opt.numerar ? ` N. ${(opt.numero || "").trim() || "___/" + ANO}` : "";
  if (tipo === "Ofício") return `OFÍCIO${n} – SEINFRA`;
  if (tipo === "Comunicação interna (CI)" || tipo === "CI") return `COMUNICAÇÃO INTERNA${n} – SEINFRA`;
  if (tipo === "Despacho") return `DESPACHO${n}`;
  if (tipo === "Nota técnica") return `NOTA TÉCNICA${n} – SEINFRA`;
  if (tipo === "Portaria") return `PORTARIA${n}`;
  return null;
}
function tipoDeTitulo(t) { return /of[ií]cio/i.test(t) ? "Ofício" : /\bci\b|comunica[cç][aã]o interna/i.test(t) ? "Comunicação interna (CI)" : /despacho/i.test(t) ? "Despacho" : /nota t[eé]cnica/i.test(t) ? "Nota técnica" : /portaria/i.test(t) ? "Portaria" : "Documento"; }
function montarBlocos(cfg, opt, sig) {
  const bl = [], tipo = cfg.tipo || "Documento";
  bl.push({ k: "tit", t: (tituloDoc(tipo, opt) || cfg.titulo || "DOCUMENTO").toUpperCase() });
  if (opt.processo) bl.push({ k: "proc", t: `PROCESSO ADMINISTRATIVO N.${cfg.processoNum ? " " + cfg.processoNum : ""}` });
  if (tipo === "Despacho") {
    const q = [["Assunto", cfg.assunto], ["Emissor", cfg.emissor || "SEINFRA"], ["Destinatário", cfg.destinatario], ["Objeto", cfg.objeto]].filter(x => x[1]);
    if (q.length) bl.push({ k: "quadro", linhas: q });
  } else {
    if (cfg.destinatario) bl.push({ k: "dest", t: cfg.destinatario });
    if (cfg.assunto) bl.push({ k: "assunto", t: cfg.assunto });
  }
  let temFecho = false, temAssin = false;
  (cfg.corpo || []).forEach(b => {
    const t = String(b.t || "").trim(); if (!t) return;
    if (b.k === "cap") { bl.push({ k: "cap", t }); return; }
    if (/^Ilh[ée]us,/i.test(t)) { bl.push({ k: "fecho" }); temFecho = true; return; }
    if (/^Nome do Signat[aá]rio/i.test(t)) { bl.push({ k: "assin", linhas: t.split(/\n/).map(x => x.trim()).filter(Boolean) }); temAssin = true; return; }
    bl.push({ k: "par", t });
  });
  if (!temFecho) bl.push({ k: "fecho" });
  if (!temAssin) {
    const lista = sig ? [sig] : (cfg.signatarios && cfg.signatarios.length ? cfg.signatarios : [{}]);
    lista.forEach(s => { const nome = (s.nome || "").trim(), cargo = (s.cargo || "").trim(); bl.push({ k: "assin", linhas: [nome || "Nome do Signatário", cargo || "Cargo do Signatário"] }); });
  }
  return bl;
}
/* documento a partir de uma seção de texto do relatório */
function cfgDaSecao(rel, sec) {
  const d = sec.doc || {}, tipo = d.tipo || tipoDeTitulo(sec.titulo);
  const formal = tipo !== "Documento";
  const unico = sec.capitulos.length === 1 && /^documento$/i.test(sec.capitulos[0].titulo || "");
  const corpo = [];
  sec.capitulos.forEach(c => {
    if (!unico && (!formal || d.capitulos)) corpo.push({ k: "cap", t: `${c.num}. ${c.titulo}` });
    c.paragrafos.forEach(p => corpo.push({ k: "par", t: textoDe(rel, sec, p) }));
  });
  return { tipo, titulo: d.titulo || sec.titulo, assunto: d.assunto || "", destinatario: d.destinatario || "", emissor: d.emissor || "", objeto: d.objeto || "", processoNum: d.processo || "", signatarios: Array.isArray(d.signatarios) ? d.signatarios : [], corpo, numero: d.numero || "" };
}
const textoPlano = bl => bl.map(b => b.k === "fecho" ? "Ilhéus, data da assinatura." : b.k === "assin" ? b.linhas.join("\n") : b.k === "quadro" ? b.linhas.map(l => `${l[0]}: ${l[1]}`).join("\n") : b.k === "assunto" ? "Assunto: " + b.t : b.t).join("\n\n");

/* ================= prévia oficial (A4, paginada como o PDF) ================= */
let PREVIA = null; // { titulo, gerar(opt) -> versoes, opt, atual, voltar, arquivo, rel }
function abrirPrevia(p) { PREVIA = Object.assign({ atual: 0, voltar: VISTA === "previa" ? "rel" : VISTA }, p); ir("previa"); }
function previaSecao(rel, sec) {
  const cfg = cfgDaSecao(rel, sec), lic = ehLicitacao(`${rel.dados.titulo} ${rel.dados.pasta.rotulo} ${sec.titulo} ${codigoRel(rel)}`) || /^[12](\.|$)/.test(codigoRel(rel));
  abrirPrevia({ titulo: sec.titulo, rel, sec, arquivo: `${codigoRel(rel) || rel.id}-${slug(sec.titulo)}`,
    opt: { timbre: true, carimbo: lic, processo: cfg.tipo === "Despacho" || (cfg.tipo === "Documento" && lic), numerar: true, numero: cfg.numero },
    gerar: opt => { const c = cfgDaSecao(rel, sec); return (c.signatarios.length > 1 ? c.signatarios : [null]).map((s, i) => ({ rotulo: s ? `Versão ${i + 1}: ${(s.nome || s.cargo || "sem nome").slice(0, 26)}` : "Documento", blocos: montarBlocos(c, opt, s) })); } });
}
function previaRelatorio(rel) {
  const gerar = opt => {
    const bl = [{ k: "tit", t: rel.dados.titulo.toUpperCase() }, { k: "dest", t: `${nomeRel(rel)} · relatório ${rel.dados.id} rev ${rel.dados.rev} · ${agora()}` }];
    rel.dados.secoes.forEach(sec => {
      bl.push({ k: "cap", t: `${sec.num}. ${sec.titulo}` });
      if (sec.tipo === "texto") sec.capitulos.forEach(c => { bl.push({ k: "par", t: `${c.num} – ${c.titulo}` }); c.paragrafos.forEach(p => bl.push({ k: "par", t: `${p.id} [${ROTULO_SIT[sitDe(rel, sec, p)]}] ${textoDe(rel, sec, p)}` })); });
      else sec.itens.forEach(it => {
        const v = acionavel(it) || it.tipo === "info" ? valorItem(rel, it) : "", s = rel.st["I:" + it.num] || {};
        bl.push({ k: "par", t: `${it.num} ${it.titulo}${v ? ` [${v}]` : ""}${it.texto ? " — " + it.texto : ""}${s.obs ? " Comentário: " + s.obs : ""}` });
        if (it.tabela) it.tabela.linhas.forEach((ln, r) => bl.push({ k: "par", t: "   " + ln.map((x, c) => x && typeof x === "object" ? (x.chip ? ((rel.st[`C:${it.num}:${r}:${c}`] || {}).v || x.chip.valor || "") : x.caminho || x.texto || "") : valorCelula(rel, it, r, c).v).join(" | ") }));
      });
    });
    return [{ rotulo: "Relatório", blocos: bl, semFecho: true }];
  };
  abrirPrevia({ titulo: rel.dados.titulo, rel, arquivo: `${codigoRel(rel) || rel.id}-relatorio-rev${rel.dados.rev}`, relatorio: true, opt: { timbre: false, carimbo: false, processo: false, numerar: false }, gerar });
}
function abrirDocumento(rel, ancora) {
  if (!rel) { ir("docs"); return; }
  const secs = rel.dados.secoes.filter(s => s.tipo === "texto");
  if (secs.length === 1 && !CEL) { previaSecao(rel, secs[0]); return; }
  const itens = secs.map(s => ({ ico: "doc", rotulo: s.titulo, small: statusDoc(rel, s).rot, fn: () => previaSecao(rel, s) }));
  itens.push({ div: true }, { ico: "file", rotulo: "PDF do relatório", fn: () => previaRelatorio(rel) }, { ico: "pen", rotulo: "Documento avulso", fn: () => ir("avulso") });
  if (!secs.length) itens.unshift({ el: h("div", { class: "rod" }, "Este relatório ainda não tem documento.") });
  menu(ancora, itens, { titulo: "Documento" });
}
function statusDoc(rel, sec) {
  let v = 0, t = 0, az = 0; sec.capitulos.forEach(c => { const s = statusCap(rel, sec, c); v += s.verdes; t += s.total; c.paragrafos.forEach(p => { if (sitDe(rel, sec, p) === "azul") az++; }); });
  return { cor: t && v === t ? "g" : az ? "b" : "r", rot: t && v === t ? "tudo verde" : `${v} de ${t}` };
}
const MM = 96 / 25.4, A4W = 210 * MM, A4H = 297 * MM, AREA_H = (297 - 35 - 30) * MM;
function timbreHTML() { const b = CFG.brasao && CFG.brasao.url; return `<div class="fd-timbre">${b ? `<img src="${b}" alt="Brasão">` : `<div class="fd-sembrasao">brasão</div>`}<div>ESTADO DA BAHIA</div><div>PREFEITURA MUNICIPAL DE ILHÉUS</div></div>`; }
const carimboSVG = `<svg class="fd-carimbo" viewBox="0 0 64 64" aria-label="Carimbo"><circle cx="32" cy="32" r="30" fill="none" stroke="#1a1a1a" stroke-width="1.4"/><text x="32" y="25" font-size="7.5" font-weight="700" text-anchor="middle" font-family="Arial" fill="#1a1a1a" stroke="none">LICITAÇÃO</text><text x="32" y="35" font-size="7.5" font-weight="700" text-anchor="middle" font-family="Arial" fill="#1a1a1a" stroke="none">P.M.I.</text><text x="32" y="46" font-size="7.5" text-anchor="middle" font-family="Arial" fill="#1a1a1a" stroke="none">Fls.____</text></svg>`;
function blocoHTML(b) {
  if (b.k === "tit") return `<p class="fd-tit">${esc(b.t)}</p>`;
  if (b.k === "proc") return `<p class="fd-proc">${esc(b.t)}</p>`;
  if (b.k === "quadro") return `<table class="fd-quadro">${b.linhas.map(l => `<tr><td>${esc(l[0])}</td><td>${esc(l[1]).replace(/\n/g, "<br>")}</td></tr>`).join("")}</table>`;
  if (b.k === "dest") return `<p class="fd-meta">${esc(b.t).replace(/\n/g, "<br>")}</p>`;
  if (b.k === "assunto") return `<p class="fd-meta"><b>Assunto:</b> ${esc(b.t)}</p>`;
  if (b.k === "cap") return `<p class="fd-cap">${esc(b.t)}</p>`;
  if (b.k === "par") return `<p>${esc(b.t).replace(/\n/g, "<br>")}</p>`;
  if (b.k === "fecho") return `<p class="fd-fecho">Ilhéus, <i>data da assinatura</i>.</p>`;
  if (b.k === "assin") return `<p class="fd-assin">${b.linhas.map(esc).join("<br>")}</p>`;
  return "";
}
/* agrupa o que não pode separar: capítulo + parágrafo seguinte; fecho + assinaturas */
function grupos(bl) {
  const g = [];
  for (let i = 0; i < bl.length; i++) {
    const b = bl[i];
    if (b.k === "cap" && bl[i + 1]) { g.push([b, bl[i + 1]]); i++; continue; }
    if (b.k === "fecho") { const x = [b]; while (bl[i + 1] && bl[i + 1].k === "assin") { i++; x.push(bl[i]); } g.push(x); continue; }
    g.push([b]);
  }
  return g;
}
function paginasHTML(bl, opt) {
  const medida = h("div", { class: "paper", style: "position:absolute;left:-10000px;top:0;visibility:hidden;height:auto;min-height:0" });
  const area = h("div", {}); medida.append(area); document.body.append(medida);
  const paginas = [[]];
  grupos(bl).forEach(gr => {
    const html = gr.map(blocoHTML).join("");
    const antes = area.innerHTML; area.innerHTML = antes + html;
    if (area.offsetHeight > AREA_H && paginas[paginas.length - 1].length) { paginas.push([]); area.innerHTML = html; }
    paginas[paginas.length - 1].push(html);
  });
  medida.remove();
  return paginas.map((p, i) => `${opt.carimbo ? carimboSVG : ""}${opt.timbre && i === 0 ? timbreHTML() : ""}<div>${p.join("")}</div>`);
}
TELAS.previa = {
  nav: "doc",
  topo(T) {
    if (!PREVIA) { ap(T, botaoLat(), h("span", { class: "ttl" }, "Prévia oficial")); return; }
    const voltar = () => ir(PREVIA.voltar && PREVIA.voltar !== "previa" ? PREVIA.voltar : "rel");
    if (CEL) {
      ap(T, h("button", { class: "ib", type: "button", "aria-label": "Fechar a prévia", onclick: voltar }, ico("x")), h("span", { class: "ttl" }, "Prévia oficial"),
        h("button", { class: "ib", type: "button", title: "Opções", "aria-label": "Opções da prévia", onclick: e => menuOpcoesPrevia(e.currentTarget) }, ico("gear")),
        h("button", { class: "ib", type: "button", title: "Baixar Word", "aria-label": "Baixar Word", onclick: baixarWordPrevia }, ico("doc")),
        h("button", { class: "ib on", type: "button", title: "Salvar PDF", "aria-label": "Salvar PDF", onclick: baixarPDFPrevia }, ico("file")));
      return;
    }
    ap(T, h("button", { type: "button", class: "tb", onclick: voltar }, ico("cle"), h("span", { class: "tbl" }, "Voltar")),
      h("span", { class: "ttl", style: "margin-left:6px" }, "Prévia oficial · Arial 12 · A4 · margens 3,5/2,5/3/3 cm"),
      h("button", { type: "button", class: "tb", onclick: () => copiar(textoPlano(versaoAtual().blocos), "Texto do documento copiado.") }, ico("copy"), h("span", { class: "tbl" }, "Copiar texto")),
      h("button", { type: "button", class: "tb", onclick: () => abrirGmail(PREVIA.rel, { assunto: PREVIA.titulo, texto: textoPlano(versaoAtual().blocos) }) }, ico("mail"), h("span", { class: "tbl" }, "Gmail")),
      h("button", { type: "button", class: "tb", onclick: baixarWordPrevia }, ico("doc"), h("span", { class: "tbl" }, "Word")),
      h("button", { type: "button", class: "tb pri", onclick: baixarPDFPrevia }, ico("file"), h("span", { class: "tbl" }, "Salvar PDF")));
  },
  corpo(m) {
    if (!PREVIA) { ap(m, h("div", { class: "col" }, h("p", {}, "Nenhum documento aberto."))); return; }
    const versoes = PREVIA.gerar(PREVIA.opt); PREVIA.versoes = versoes;
    if (PREVIA.atual >= versoes.length) PREVIA.atual = 0;
    const st = h("div", { class: "stage" }); ap(m, st);
    if (!CEL) ap(st, opcoesPrevia());
    if (versoes.length > 1) ap(st, h("div", { class: "seg" }, versoes.map((v, i) => h("button", { type: "button", class: i === PREVIA.atual ? "on" : "", onclick: () => { PREVIA.atual = i; redesenharTudo(); } }, v.rotulo))));
    const v = versoes[PREVIA.atual];
    const bl = v.semFecho ? v.blocos : v.blocos;
    const pags = paginasHTML(bl, PREVIA.opt);
    const larg = Math.min(innerWidth - (CEL ? 16 : (PREF.lat ? parseFloat(getComputedStyle($("#lat")).width) || 281 : 0) + 48), A4W);
    const esc2 = Math.min(CEL ? 1 : .78, larg / A4W);
    pags.forEach((html, i) => {
      const p = h("div", { class: "paper" }); p.innerHTML = html; p.style.transform = `scale(${esc2})`;
      ap(st, h("div", { class: "folha-esc", style: `width:${A4W * esc2}px;height:${A4H * esc2}px` }, p), h("div", { class: "sub" }, `página ${i + 1} de ${pags.length}`));
    });
  }
};
function versaoAtual() { const v = PREVIA.versoes || PREVIA.gerar(PREVIA.opt); return v[PREVIA.atual] || v[0]; }
function opcoesPrevia() {
  const o = PREVIA.opt;
  const marca = (rot, k) => h("label", {}, h("input", { type: "checkbox", checked: !!o[k], onchange: e => { o[k] = e.target.checked; redesenharTudo(); } }), rot);
  const num = h("input", { type: "text", value: o.numero || "", placeholder: `___/${ANO}`, "aria-label": "Número", onchange: e => { o.numero = e.target.value; redesenharTudo(); } });
  return h("div", { class: "prev-ops" }, marca("Timbre", "timbre"), marca("Carimbo LICITAÇÃO P.M.I.", "carimbo"), marca("Linha PROCESSO ADMINISTRATIVO N.", "processo"),
    PREVIA.relatorio ? null : h("label", {}, h("input", { type: "checkbox", checked: !!o.numerar, onchange: e => { o.numerar = e.target.checked; redesenharTudo(); } }), "Numerar", num),
    h("button", { type: "button", class: "btn sm", onclick: () => escolherBrasao(redesenharTudo) }, CFG.brasao ? "Trocar brasão" : "Colocar brasão"));
}
function menuOpcoesPrevia(ancora) {
  const o = PREVIA.opt, tg = k => () => { o[k] = !o[k]; redesenharTudo(); };
  menu(ancora, [
    { rotulo: "Timbre", check: o.timbre, fn: tg("timbre") }, { rotulo: "Carimbo LICITAÇÃO P.M.I.", check: o.carimbo, fn: tg("carimbo") },
    { rotulo: "Linha PROCESSO ADMINISTRATIVO N.", check: o.processo, fn: tg("processo") }, PREVIA.relatorio ? null : { rotulo: "Numerar", check: o.numerar, fn: tg("numerar") },
    PREVIA.relatorio ? null : { rotulo: "Número do documento…", small: o.numero || "", fn: () => { const inp = h("input", { type: "text", value: o.numero || "", placeholder: `___/${ANO}` }); dialogo("Número do documento", [campoComMic(inp)], [{ rotulo: "Cancelar" }, { rotulo: "OK", pri: true, fn: () => { o.numero = inp.value; o.numerar = true; redesenharTudo(); } }]); } },
    { div: true },
    { ico: "copy", rotulo: "Copiar texto", fn: () => copiar(textoPlano(versaoAtual().blocos), "Texto do documento copiado.") },
    { ico: "mail", rotulo: "Rascunho no Gmail", fn: () => abrirGmail(PREVIA.rel, { assunto: PREVIA.titulo, texto: textoPlano(versaoAtual().blocos) }) },
    { rotulo: CFG.brasao ? "Trocar brasão" : "Colocar brasão", fn: () => escolherBrasao(redesenharTudo) }
  ], { titulo: "Prévia oficial" });
}
function nomeArquivo() { const v = versaoAtual(); return (PREVIA.arquivo || slug(PREVIA.titulo)) + (PREVIA.versoes && PREVIA.versoes.length > 1 ? "-v" + (PREVIA.atual + 1) : "") + (v ? "" : ""); }
async function baixarPDFPrevia() { try { aviso("Gerando o PDF…"); const bytes = await gerarPDF(versaoAtual().blocos, PREVIA.opt); await baixar(nomeArquivo() + ".pdf", new Blob([bytes], { type: "application/pdf" })); } catch (e) { console.error(e); aviso("Não consegui gerar o PDF: " + e.message); } }
async function baixarWordPrevia() { try { await baixar(nomeArquivo() + ".docx", gerarDOCX(versaoAtual().blocos, PREVIA.opt)); } catch (e) { console.error(e); aviso("Não consegui gerar o Word: " + e.message); } }

/* ================= PDF (pdf-lib; Helvetica tem as mesmas medidas da Arial) ================= */
async function gerarPDF(bl, opt) {
  await carregarPDFLib();
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const pdf = await PDFDocument.create();
  const F = await pdf.embedFont(StandardFonts.Helvetica), B = await pdf.embedFont(StandardFonts.HelveticaBold), I = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const cm = 28.3465, W = 595.28, H = 841.89, mt = 3.5 * cm, ml = 2.5 * cm, mr = 3 * cm, mb = 3 * cm, cw = W - ml - mr, fs = 12, lh = fs * 1.15;
  const seguro = (s, f, tam) => Array.from(String(s).replace(/ /g, " ").replace(/[‘’]/g, "'")).map(ch => { try { f.widthOfTextAtSize(ch, tam || fs); return ch; } catch (e) { return "?"; } }).join("");
  const bb = brasaoBytes(); let img = null;
  if (bb && opt.timbre) { try { img = await pdf.embedPng(bb); } catch (e) { try { img = await pdf.embedJpg(bb); } catch (e2) {} } }
  let page, y, nPag = 0;
  const centro = (txt, f, tam, yy) => { const t = seguro(txt, f, tam), w = f.widthOfTextAtSize(t, tam); page.drawText(t, { x: (W - w) / 2, y: yy, size: tam, font: f }); };
  function nova() {
    page = pdf.addPage([W, H]); nPag++; y = H - mt;
    if (opt.carimbo) {
      const cx = W - 1.2 * cm - 31, cy = H - 0.9 * cm - 31, r = 30;
      page.drawCircle({ x: cx, y: cy, size: r, borderWidth: 1.2, borderColor: rgb(0.1, 0.1, 0.1) });
      [["LICITAÇÃO", B, 7.5, 7], ["P.M.I.", B, 7.5, -2], ["Fls.____", F, 7.5, -13]].forEach(([t, f, tam, dy]) => { const w = f.widthOfTextAtSize(t, tam); page.drawText(t, { x: cx - w / 2, y: cy + dy, size: tam, font: f }); });
    }
    if (nPag === 1 && opt.timbre) {
      let ty = H - 0.8 * cm;
      if (img) { const hh = 1.4 * cm, ww = img.width * hh / img.height; page.drawImage(img, { x: (W - ww) / 2, y: ty - hh, width: ww, height: hh }); ty -= hh + 10; } else ty -= 10;
      centro("ESTADO DA BAHIA", B, 9, ty); centro("PREFEITURA MUNICIPAL DE ILHÉUS", B, 9, ty - 11);
    }
  }
  nova();
  const garantir = alt => { if (y - alt < mb) nova(); };
  function quebrar(txt, f, tam, larg) {
    tam = tam || fs; larg = larg || cw; const linhas = [];
    String(txt).split("\n").forEach(par => {
      const pal = seguro(par, f, tam).split(/\s+/).filter(Boolean); let atual = [];
      pal.forEach(w => { const t = atual.concat(w).join(" "); if (atual.length && f.widthOfTextAtSize(t, tam) > larg) { linhas.push({ p: atual, fim: false }); atual = [w]; } else atual.push(w); });
      linhas.push({ p: atual, fim: true });
    });
    return linhas;
  }
  function escrever(txt, f, just, depois, x0, larg) {
    x0 = x0 || ml; larg = larg || cw;
    const L = quebrar(txt, f, fs, larg);
    L.forEach((ln, i) => {
      garantir(lh + (i === 0 && L.length > 1 ? lh : 0));
      const base = y - fs;
      if (just && !ln.fim && ln.p.length > 1) {
        const tot = ln.p.reduce((a, w) => a + f.widthOfTextAtSize(w, fs), 0), espaco = (larg - tot) / (ln.p.length - 1); let x = x0;
        ln.p.forEach(w => { page.drawText(w, { x, y: base, size: fs, font: f }); x += f.widthOfTextAtSize(w, fs) + espaco; });
      } else page.drawText(ln.p.join(" "), { x: x0, y: base, size: fs, font: f });
      y -= lh;
    });
    y -= depois;
  }
  function centrado(txt, f, depois) { quebrar(txt, f).forEach(ln => { garantir(lh); centro(ln.p.join(" "), f, fs, y - fs); y -= lh; }); y -= depois; }
  function quadro(linhas) {
    const t = 10, lt = t * 1.2, c1 = cw * 0.28, pad = 4;
    linhas.forEach(([rot, val]) => {
      const L1 = quebrar(rot, B, t, c1 - 2 * pad), L2 = quebrar(val, F, t, cw - c1 - 2 * pad);
      const alt = Math.max(L1.length, L2.length) * lt + 2 * pad;
      garantir(alt);
      const topo = y;
      page.drawRectangle({ x: ml, y: topo - alt, width: cw, height: alt, borderWidth: 0.8, borderColor: rgb(0, 0, 0) });
      page.drawLine({ start: { x: ml + c1, y: topo }, end: { x: ml + c1, y: topo - alt }, thickness: 0.8, color: rgb(0, 0, 0) });
      L1.forEach((ln, i) => page.drawText(ln.p.join(" "), { x: ml + pad, y: topo - pad - t - i * lt + 2, size: t, font: B }));
      L2.forEach((ln, i) => page.drawText(ln.p.join(" "), { x: ml + c1 + pad, y: topo - pad - t - i * lt + 2, size: t, font: F }));
      y -= alt;
    });
    y -= 12;
  }
  for (let i = 0; i < bl.length; i++) {
    const b = bl[i];
    if (b.k === "tit") centrado(b.t, B, 12);
    else if (b.k === "proc") centrado(b.t, B, 30);
    else if (b.k === "quadro") quadro(b.linhas);
    else if (b.k === "dest") escrever(b.t, F, false, 6);
    else if (b.k === "assunto") {
      const rot = "Assunto: ", wr = B.widthOfTextAtSize(rot, fs);
      const L = quebrar(b.t, F, fs, cw - wr);
      L.forEach((ln, j) => { garantir(lh); const base = y - fs; if (j === 0) page.drawText(rot, { x: ml, y: base, size: fs, font: B }); page.drawText(ln.p.join(" "), { x: ml + wr, y: base, size: fs, font: F }); y -= lh; });
      y -= 6;
    }
    else if (b.k === "cap") { garantir(12 + lh * 3 + 6); y -= 12; escrever(b.t, B, false, 6); }
    else if (b.k === "par") escrever(b.t, F, true, 6);
    else if (b.k === "fecho") {
      const ass = []; while (bl[i + 1] && bl[i + 1].k === "assin") { i++; ass.push(bl[i]); }
      const alt = 12 + lh + 40 + ass.reduce((a, x) => a + x.linhas.length * lh + 24, 0);
      garantir(alt); y -= 12;
      const a = "Ilhéus, ", b2 = "data da assinatura", c = ".", base = y - fs;
      page.drawText(a, { x: ml, y: base, size: fs, font: F }); const w1 = F.widthOfTextAtSize(a, fs);
      page.drawText(b2, { x: ml + w1, y: base, size: fs, font: I }); const w2 = I.widthOfTextAtSize(b2, fs);
      page.drawText(c, { x: ml + w1 + w2, y: base, size: fs, font: F });
      y -= lh + 40;
      ass.forEach((x, j) => { if (j) y -= 24; x.linhas.forEach(l => { centro(l, B, fs, y - fs); y -= lh; }); });
    } else if (b.k === "assin") { garantir(b.linhas.length * lh + 30); y -= 30; b.linhas.forEach(l => { centro(l, B, fs, y - fs); y -= lh; }); }
  }
  return await pdf.save();
}

/* ================= Word (.docx montado à mão: zip sem compressão) ================= */
const enc = new TextEncoder();
const TAB = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = u => { let c = -1; for (let i = 0; i < u.length; i++) c = TAB[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function zipar(arqs, tipo) {
  const partes = [], central = []; let off = 0;
  arqs.forEach(f => {
    const nm = enc.encode(f.nome), crc = crc32(f.dados), sz = f.dados.length;
    const lh = new Uint8Array(30 + nm.length), dv = new DataView(lh.buffer);
    dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true); dv.setUint16(12, 0x21, true); dv.setUint32(14, crc, true); dv.setUint32(18, sz, true); dv.setUint32(22, sz, true); dv.setUint16(26, nm.length, true); lh.set(nm, 30);
    const ch = new Uint8Array(46 + nm.length), cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(14, 0x21, true); cv.setUint32(16, crc, true); cv.setUint32(20, sz, true); cv.setUint32(24, sz, true); cv.setUint16(28, nm.length, true); cv.setUint32(42, off, true); ch.set(nm, 46);
    partes.push(lh, f.dados); central.push(ch); off += lh.length + sz;
  });
  const cd = central.reduce((a, c) => a + c.length, 0), fim = new Uint8Array(22), ev = new DataView(fim.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, arqs.length, true); ev.setUint16(10, arqs.length, true); ev.setUint32(12, cd, true); ev.setUint32(16, off, true);
  return new Blob([...partes, ...central, fim], { type: tipo || "application/zip" });
}
function gerarDOCX(bl, opt) {
  const rpr = (b, i, sz) => `<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>${b ? "<w:b/>" : ""}${i ? "<w:i/>" : ""}<w:sz w:val="${sz || 24}"/><w:szCs w:val="${sz || 24}"/></w:rPr>`;
  const run = (t, b, i, sz) => String(t).split("\n").map((l, k) => `<w:r>${rpr(b, i, sz)}${k ? "<w:br/>" : ""}<w:t xml:space="preserve">${esc(l)}</w:t></w:r>`).join("");
  const par = (conteudo, jc, antes, depois, extra) => `<w:p><w:pPr>${extra || ""}<w:spacing w:before="${antes}" w:after="${depois}" w:line="276" w:lineRule="auto"/><w:jc w:val="${jc}"/></w:pPr>${conteudo}</w:p>`;
  let x = "";
  for (let i = 0; i < bl.length; i++) {
    const b = bl[i];
    if (b.k === "tit") x += par(run(b.t, true), "center", 0, 240);
    else if (b.k === "proc") x += par(run(b.t, true), "center", 0, 600);
    else if (b.k === "quadro") {
      const borda = `<w:tcBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/></w:tcBorders>`;
      x += `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="2475"/><w:gridCol w:w="6363"/></w:tblGrid>` +
        b.linhas.map(l => `<w:tr><w:tc><w:tcPr><w:tcW w:w="2475" w:type="dxa"/>${borda}</w:tcPr>${par(run(l[0], true, false, 20), "left", 0, 0)}</w:tc><w:tc><w:tcPr><w:tcW w:w="6363" w:type="dxa"/>${borda}</w:tcPr>${par(run(l[1], false, false, 20), "left", 0, 0)}</w:tc></w:tr>`).join("") + `</w:tbl>` + par("", "left", 0, 120);
    }
    else if (b.k === "dest") x += par(run(b.t), "left", 0, 120);
    else if (b.k === "assunto") x += par(run("Assunto: ", true) + run(b.t), "left", 0, 120);
    else if (b.k === "cap") x += par(run(b.t, true), "left", 240, 120, "<w:keepNext/><w:keepLines/>");
    else if (b.k === "par") x += par(run(b.t), "both", 0, 120);
    else if (b.k === "fecho") {
      const temAssin = bl[i + 1] && bl[i + 1].k === "assin";
      x += par(run("Ilhéus, ") + run("data da assinatura", false, true) + run("."), "left", 240, 800, temAssin ? "<w:keepNext/><w:keepLines/>" : "<w:keepLines/>");
      while (bl[i + 1] && bl[i + 1].k === "assin") { i++; x += par(run(bl[i].linhas.join("\n"), true), "center", 0, 480, "<w:keepLines/>" + (bl[i + 1] && bl[i + 1].k === "assin" ? "<w:keepNext/>" : "")); }
    } else if (b.k === "assin") x += par(run(b.linhas.join("\n"), true), "center", 600, 240, "<w:keepLines/>");
  }
  const bb = brasaoBytes(), temImg = !!(bb && opt.timbre && CFG.brasao && CFG.brasao.w);
  const NS = `xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"`;
  const carimbo = opt.carimbo ? par(run("LICITAÇÃO P.M.I. Fls.____", true, false, 16), "right", 0, 0) : "";
  let imgXml = "";
  if (temImg) { const hh = Math.round(1.4 * 360000), ww = Math.round(CFG.brasao.w * hh / CFG.brasao.h); imgXml = par(`<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${ww}" cy="${hh}"/><wp:docPr id="1" name="Brasao"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="brasao.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImg"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${ww}" cy="${hh}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`, "center", 0, 0); }
  const timbre = opt.timbre ? imgXml + par(run("ESTADO DA BAHIA", true, false, 18), "center", 0, 0) + par(run("PREFEITURA MUNICIPAL DE ILHÉUS", true, false, 18), "center", 0, 0) : "";
  const cab1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${NS}>${carimbo}${timbre || par("", "left", 0, 0)}</w:hdr>`;
  const cab2 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${NS}>${carimbo || par("", "left", 0, 0)}</w:hdr>`;
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${x}<w:sectPr><w:headerReference w:type="first" r:id="rIdH1"/><w:headerReference w:type="default" r:id="rIdH2"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1985" w:right="1701" w:bottom="1701" w:left="1417" w:header="454" w:footer="709" w:gutter="0"/><w:titlePg/></w:sectPr></w:body></w:document>`;
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/header2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const drels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdH1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rIdH2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header2.xml"/></Relationships>`;
  const hrels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${temImg ? '<Relationship Id="rIdImg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/brasao.png"/>' : ""}</Relationships>`;
  const arqs = [{ nome: "[Content_Types].xml", dados: enc.encode(ct) }, { nome: "_rels/.rels", dados: enc.encode(rels) }, { nome: "word/document.xml", dados: enc.encode(doc) },
    { nome: "word/_rels/document.xml.rels", dados: enc.encode(drels) }, { nome: "word/header1.xml", dados: enc.encode(cab1) }, { nome: "word/header2.xml", dados: enc.encode(cab2) },
    { nome: "word/_rels/header1.xml.rels", dados: enc.encode(hrels) }];
  if (temImg) arqs.push({ nome: "word/media/brasao.png", dados: bb });
  return zipar(arqs, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
}

/* ================= Documentos ================= */
TELAS.docs = {
  nav: "doc",
  topo(T) { ap(T, botaoLat(), h("span", { class: "ttl" }, "Documentos")); },
  corpo(m) {
    const col = h("div", { class: "col" }); ap(m, col);
    if (!CEL) ap(col, h("h1", { class: "rt" }, "Documentos"));
    ap(col, h("div", { class: "meta" }, "Documentos dos relatórios e documento avulso"));
    ap(col, h("div", { class: "botoes", style: "margin:0 0 18px" }, h("button", { type: "button", class: "btn pri", onclick: () => ir("avulso") }, ico("pen"), "Documento avulso"),
      h("button", { type: "button", class: "btn", onclick: () => ir("revisor") }, ico("spark"), "Revisor de texto")));
    const rels = relsOrdenados().filter(r => r.dados.secoes.some(s => s.tipo === "texto"));
    if (!rels.length) ap(col, h("p", { class: "mut" }, "Nenhum relatório tem documento ainda. Quando o Claude escrever a minuta, ela aparece aqui."));
    rels.forEach(r => {
      ap(col, h("div", { class: "sl", style: "padding-left:0;margin-top:10px" }, `${codigoRel(r)} ${nomeCurto(r)}`));
      const box = h("div", { class: "card lista-card" });
      r.dados.secoes.filter(s => s.tipo === "texto").forEach(s => {
        const st = statusDoc(r, s);
        ap(box, h("div", { class: "row", style: "white-space:normal" }, dot(st.cor), h("span", { class: "nm", style: "flex:1" }, s.titulo), h("span", { class: "sub" }, st.rot),
          h("button", { type: "button", class: "btn sm", onclick: () => { PREF.atual = r.id; salvarPref(); previaSecao(r, s); } }, ico("eye"), "Prévia"),
          h("button", { type: "button", class: "btn sm", onclick: () => { PREF.atual = r.id; ABERTAS[r.id] = { [s.num]: true }; salvarPref(); ir("rel"); } }, "Abrir")));
      });
      ap(col, box);
    });
  }
};

/* ================= Documento avulso (fora do histórico; rascunho só neste aparelho) ================= */
let AV = null;
function avNovo() { return { tipo: "Ofício", numero: "", destinatario: "", assunto: "", emissor: "", objeto: "", corpo: "", sig: [{ nome: "", cargo: "" }], carimbo: false, timbre: true, processo: false }; }
function avCarregar() { if (AV) return AV; try { AV = JSON.parse(localStorage.getItem("omega.avulso") || "null"); } catch (e) {} if (!AV || typeof AV !== "object") AV = avNovo(); if (!Array.isArray(AV.sig) || !AV.sig.length) AV.sig = [{ nome: "", cargo: "" }]; return AV; }
let tAV = null;
function avSalvar() { clearTimeout(tAV); tAV = setTimeout(() => { try { localStorage.setItem("omega.avulso", JSON.stringify(AV)); } catch (e) {} }, 300); }
function avCfg(a) { return { tipo: a.tipo, titulo: a.tipo, assunto: a.assunto, destinatario: a.destinatario, emissor: a.emissor, objeto: a.objeto, signatarios: a.sig, corpo: String(a.corpo || "").split(/\n+/).map(t => ({ k: "par", t: t.trim() })).filter(x => x.t) }; }
function previaAvulso() {
  const a = avCarregar();
  abrirPrevia({ titulo: a.assunto || a.tipo, arquivo: slug(`${a.tipo}-${a.numero || "sem-numero"}`), opt: { timbre: a.timbre !== false, carimbo: !!a.carimbo, processo: a.tipo === "Despacho" || !!a.processo, numerar: true, numero: a.numero },
    gerar: opt => { const c = avCfg(a); return a.sig.map((s, i) => ({ rotulo: a.sig.length > 1 ? `Versão ${i + 1}: ${(s.nome || s.cargo || "sem nome").slice(0, 26)}` : "Documento", blocos: montarBlocos(c, opt, s) })); } });
}
TELAS.avulso = {
  nav: "doc",
  topo(T) { ap(T, botaoLat(), h("span", { class: "ttl" }, CEL ? "Documento avulso" : "Documentos › Avulso")); },
  corpo(m) {
    const a = avCarregar(), col = h("div", { class: "col" }); ap(m, col);
    if (!CEL) ap(col, h("h1", { class: "rt" }, "Documento avulso"), h("div", { class: "meta" }, "Sem relatório · direto para a prévia oficial"));
    const campo = (rot, el, extra) => h("div", { class: "campo" }, h("span", { class: "sub" }, rot), el, extra || null);
    const inp = (k, ph) => { const e = h("input", { type: "text", id: "av-" + k, value: a[k] || "", placeholder: ph || "", oninput: ev => { a[k] = ev.target.value; avSalvar(); } }); return campoComMic(e); };
    const tipo = h("select", { id: "av-tipo", "aria-label": "Tipo", onchange: e => { a.tipo = e.target.value; if (a.tipo === "Despacho") a.processo = true; avSalvar(); redesenharTudo(); } }, TIPOS_DOC.map(t => h("option", { value: t, selected: t === a.tipo ? true : null }, t)));
    const corpo = h("textarea", { id: "av-corpo", rows: CEL ? "5" : "6", placeholder: "Escreva o texto. Cada linha é um parágrafo.", oninput: e => { a.corpo = e.target.value; avSalvar(); } }); corpo.value = a.corpo || "";
    const esq = h("div", {}, campo("Tipo", h("div", { class: "campo-texto" }, tipo)), campo("Número (vazio fica ___/" + ANO + ")", inp("numero", `___/${ANO}`)), campo("Assunto", inp("assunto")),
      a.tipo === "Despacho" ? [campo("Emissor", inp("emissor", "SEINFRA")), campo("Destinatário", inp("destinatario")), campo("Objeto", inp("objeto"))] : campo("Destinatário", inp("destinatario")));
    const sigs = h("div", { class: "card", style: "display:flex;flex-direction:column;gap:8px" },
      a.sig.map((s, i) => h("div", { class: "sig" }, h("div", { class: "cmp" },
        h("input", { type: "text", value: s.nome, placeholder: "Nome do Signatário", "aria-label": "Nome do signatário", oninput: e => { s.nome = e.target.value; avSalvar(); } }),
        h("input", { type: "text", class: "cargo", value: s.cargo, placeholder: "Cargo do Signatário", "aria-label": "Cargo do signatário", oninput: e => { s.cargo = e.target.value; avSalvar(); } })),
        a.sig.length > 1 ? h("button", { type: "button", class: "ib", title: "Tirar este signatário", "aria-label": "Tirar este signatário", onclick: () => { a.sig.splice(i, 1); avSalvar(); redesenharTudo(); } }, ico("x")) : null)),
      h("button", { type: "button", class: "btn sm", style: "width:fit-content", onclick: () => { a.sig.push({ nome: "", cargo: "" }); avSalvar(); redesenharTudo(); } }, ico("plus"), "Adicionar signatário"),
      a.sig.length > 1 ? h("div", { class: "sub" }, "Uma versão do documento para cada signatário.") : null);
    const dir = h("div", {}, h("div", { class: "campo" }, h("span", { class: "sub" }, "Signatários"), sigs),
      h("div", { class: "prev-ops", style: "margin-top:4px" }, h("label", {}, h("input", { type: "checkbox", checked: !!a.carimbo, onchange: e => { a.carimbo = e.target.checked; avSalvar(); } }), "Carimbo LICITAÇÃO P.M.I."),
        h("label", {}, h("input", { type: "checkbox", checked: !!a.processo, onchange: e => { a.processo = e.target.checked; avSalvar(); } }), "Linha PROCESSO ADMINISTRATIVO N.")));
    ap(col, h("div", { class: "form2" }, esq, CEL ? null : dir), campo("Corpo do texto", campoComMic(corpo)), CEL ? dir : null);
    const botoes = h("div", { class: "botoes", style: CEL ? "position:sticky;bottom:calc(64px + env(safe-area-inset-bottom,0px));background:var(--bg);padding:10px 0;border-top:1px solid var(--div)" : "" },
      h("button", { type: "button", class: "btn pri", style: CEL ? "flex:1" : "", onclick: previaAvulso }, ico("eye"), CEL ? "Prévia" : "Prévia oficial"),
      h("button", { type: "button", class: "btn", style: CEL ? "flex:1" : "", onclick: () => { const bl = montarBlocos(avCfg(a), { numerar: true, numero: a.numero, processo: a.processo }, a.sig[0]); abrirGmail(null, { assunto: a.assunto || a.tipo, texto: textoPlano(bl) }); } }, ico("mail"), CEL ? "Gmail" : "Rascunho no Gmail"),
      h("button", { type: "button", class: "btn", onclick: () => revisarLista("Revisar português", () => [{ id: "Texto", texto: a.corpo || "", aplicar: t => { a.corpo = t; avSalvar(); const c = $("#av-corpo"); if (c) c.value = t; } }]) }, ico("spark"), "Revisar português"),
      h("button", { type: "button", class: "btn", onclick: () => dialogo("Limpar o documento avulso?", [h("p", {}, "O rascunho será apagado deste aparelho.")], [{ rotulo: "Cancelar" }, { rotulo: "Limpar", pri: true, fn: () => { AV = avNovo(); avSalvar(); redesenharTudo(); } }]) }, "Limpar"));
    ap(col, botoes);
  }
};

/* ================= Gmail: rascunho com texto (anexo vai à mão) ================= */
function abrirGmail(rel, preset) {
  preset = preset || {};
  let texto = preset.texto, assunto = preset.assunto;
  if (texto == null && rel) { const sec = rel.dados.secoes.find(s => s.tipo === "texto"); if (sec) { const c = cfgDaSecao(rel, sec); texto = textoPlano(montarBlocos(c, { numerar: true, processo: false }, null)); assunto = assunto || c.assunto || sec.titulo; } else { texto = ""; assunto = assunto || rel.dados.titulo; } }
  const para = h("input", { type: "text", placeholder: "e-mail do destinatário" });
  const as = h("input", { type: "text", value: assunto || "" });
  const tx = h("textarea", { rows: "8" }); tx.value = texto || "";
  const link = h("a", { class: "btn pri", target: "_blank", rel: "noopener" }, ico("mail"), "Abrir rascunho no Gmail");
  const atualizar = () => { const longo = tx.value.length > 1500; link.href = linkGmail(para.value.trim(), as.value, longo ? "" : tx.value); link.dataset.longo = longo ? "1" : ""; };
  [para, as, tx].forEach(e => e.addEventListener("input", atualizar)); atualizar();
  link.addEventListener("click", () => { if (link.dataset.longo) copiar(tx.value, "Texto longo: já copiei, é só colar no e-mail."); fecharDialogo(); });
  const sec = rel && rel.dados.secoes.find(s => s.tipo === "texto");
  dialogo("Rascunho no Gmail", [
    h("p", { class: "sub" }, "Abre o Gmail com o texto pronto; nada é enviado sozinho. O Gmail não aceita anexo por link: baixe o PDF e arraste para o e-mail."),
    h("label", {}, h("span", { class: "sub" }, "Para"), campoComMic(para)), h("label", {}, h("span", { class: "sub" }, "Assunto"), campoComMic(as)), h("label", {}, h("span", { class: "sub" }, "Texto"), campoComMic(tx)),
    sec ? h("button", { type: "button", class: "btn", onclick: async () => { const c = cfgDaSecao(rel, sec); try { const bytes = await gerarPDF(montarBlocos(c, { numerar: true, timbre: true, carimbo: false, processo: c.tipo === "Despacho" }, null), { timbre: true, carimbo: false }); baixar(`${codigoRel(rel) || rel.id}-${slug(sec.titulo)}.pdf`, new Blob([bytes], { type: "application/pdf" })); } catch (e) { aviso("Não consegui gerar o PDF."); } } }, ico("file"), "Baixar o PDF para anexar") : null],
    [{ rotulo: "Cancelar" }, { rotulo: "Copiar texto", fn: () => { copiar(tx.value, "Texto copiado."); return false; } }, { el: link }]);
}
