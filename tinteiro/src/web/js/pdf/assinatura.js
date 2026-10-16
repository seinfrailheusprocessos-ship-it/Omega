// Assinatura (imagem): desenhar com o mouse/dedo, importar uma foto/imagem ou reutilizar uma guardada.
// Também prepara qualquer imagem (carimbo) para entrar no PDF.
import { h, vazio } from "../util/dom.js";
import { icon, iconButton } from "../util/icons.js";
import { Modal } from "../ui/modal.js";
import { notice } from "../ui/notice.js";

const CHAVE = "tinteiro.assinaturas";
const MAX_GUARDADAS = 8;

export function assinaturasGuardadas() {
  try { const l = JSON.parse(localStorage.getItem(CHAVE) || "[]"); return Array.isArray(l) ? l.filter(x => x && typeof x.png === "string") : []; }
  catch (e) { return []; }
}
function gravarLista(lista) {
  try { localStorage.setItem(CHAVE, JSON.stringify(lista.slice(0, MAX_GUARDADAS))); return true; }
  catch (e) { notice("Não foi possível guardar a assinatura neste aparelho (pouco espaço)."); return false; }
}
function guardarAssinatura(dataUrl) {
  const lista = assinaturasGuardadas().filter(x => x.png !== dataUrl);
  lista.unshift({ id: Date.now().toString(36), png: dataUrl, criada: Date.now() });
  return gravarLista(lista);
}

const blobParaBytes = async b => new Uint8Array(await b.arrayBuffer());
const canvasParaBlob = (c, tipo = "image/png", q) => new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error("Falha ao gerar a imagem."))), tipo, q));
const dataUrlParaBytes = async u => new Uint8Array(await (await fetch(u)).arrayBuffer());
function bytesParaDataUrl(bytes, tipo = "image/png") {
  return new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(new Blob([bytes], { type: tipo })); });
}

/** recorta a área não transparente (com uma folga) */
function recortar(canvas, folga = 6) {
  const ctx = canvas.getContext("2d");
  const { width: w, height: hh } = canvas;
  const d = ctx.getImageData(0, 0, w, hh).data;
  let x0 = w, y0 = hh, x1 = -1, y1 = -1;
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return null;
  x0 = Math.max(0, x0 - folga); y0 = Math.max(0, y0 - folga); x1 = Math.min(w - 1, x1 + folga); y1 = Math.min(hh - 1, y1 + folga);
  const out = document.createElement("canvas");
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext("2d").drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

/**
 * normaliza uma imagem para entrar no PDF: PNG (com transparência) ou JPEG, já com a orientação
 * correta das fotos de celular e no máximo `max` pixels no maior lado.
 */
export async function prepararImagem(dados, mime = "", { max = 2400, removerFundo = false, cortar = false } = {}) {
  const blob = dados instanceof Blob ? dados : new Blob([dados], { type: mime || "image/png" });
  let bmp;
  try { bmp = await createImageBitmap(blob); }
  catch (e) { throw new Error("Formato de imagem não reconhecido. Use PNG ou JPG."); }
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  let c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
  const ctx = c.getContext("2d", { willReadFrequently: removerFundo || cortar });
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  const tipoOrig = (blob.type || mime || "").toLowerCase();
  let transparente = /png|gif|webp|svg/.test(tipoOrig);
  if (removerFundo) {
    const img = ctx.getImageData(0, 0, c.width, c.height), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const sat = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
      if (lum > 215 && sat < 60) d[i + 3] = 0;
      else if (lum > 160 && sat < 60) d[i + 3] = Math.round(d[i + 3] * (215 - lum) / 55);
    }
    ctx.putImageData(img, 0, 0);
    transparente = true;
  }
  if (cortar) c = recortar(c, 4) || c;
  const png = transparente;
  const saida = await canvasParaBlob(c, png ? "image/png" : "image/jpeg", 0.9);
  return { bytes: await blobParaBytes(saida), tipo: png ? "png" : "jpg", w: c.width, h: c.height };
}

/** abre a janela de assinatura. Devolve { bytes, tipo, w, h } ou null */
export function abrirAssinatura({ mobile = false } = {}) {
  return new Promise(resolve => {
    const m = new Modal({ titulo: "Assinatura", classe: "pdf-modal-assinatura" });
    let feito = false;
    const fim = v => { if (feito) return; feito = true; resolve(v); m.close(); };
    m.aoFechar.push(() => fim(null));

    // ---------- abas
    const guardadas = assinaturasGuardadas();
    const abas = h("div.pdf-abas", { role: "tablist" });
    const paineis = h("div.pdf-abas-paineis");
    const listaAbas = [];
    let abaAtual = null;
    const aba = (id, titulo, painel) => {
      const b = h("button.pdf-aba", { type: "button", role: "tab", text: titulo, onclick: () => mostrar(id) });
      abas.appendChild(b); paineis.appendChild(painel);
      listaAbas.push({ id, b, painel });
    };
    const mostrar = id => {
      abaAtual = id;
      for (const a of listaAbas) { a.b.classList.toggle("is-active", a.id === id); a.b.setAttribute("aria-selected", a.id === id ? "true" : "false"); a.painel.classList.toggle("is-hidden", a.id !== id); }
      atualizarBotao();
      if (id === "desenhar") requestAnimationFrame(redimensionar);
    };

    // ---------- desenhar
    const canvas = h("canvas.pdf-assin-canvas", { "aria-label": "Área para desenhar a assinatura" });
    const dica = h("div.pdf-assin-dica", { text: mobile ? "Assine aqui com o dedo" : "Assine aqui com o mouse, caneta ou dedo" });
    const quadro = h("div.pdf-assin-quadro", canvas, h("div.pdf-assin-linha"), dica);
    const tracos = [];
    let cor = "#1b2a6b", esp = 2.6, atual = null;
    const cores = [["#111111", "Preto"], ["#1b2a6b", "Azul"], ["#0b57d0", "Azul claro"]];
    const corBtns = cores.map(([c, nome]) => {
      const b = h("button.pdf-cor-bolinha", { type: "button", title: nome, "aria-label": "Cor " + nome, style: { "--cor": c }, onclick: () => { cor = c; corBtns.forEach(x => x.classList.toggle("is-active", x === b)); for (const t of tracos) t.cor = c; desenhar(); } });
      if (c === cor) b.classList.add("is-active");
      return b;
    });
    const espessuras = [[1.6, "Fina"], [2.6, "Média"], [4, "Grossa"]];
    const espBtns = espessuras.map(([e, nome]) => {
      const b = h("button.pdf-esp-btn", { type: "button", title: "Traço " + nome.toLowerCase(), "aria-label": "Traço " + nome.toLowerCase(), onclick: () => { esp = e; espBtns.forEach(x => x.classList.toggle("is-active", x === b)); for (const t of tracos) t.esp = e; desenhar(); } }, h("span", { style: { height: e + "px" } }));
      if (e === esp) b.classList.add("is-active");
      return b;
    });
    const limpar = h("button", { type: "button", onclick: () => { tracos.length = 0; desenhar(); atualizarBotao(); } }, icon("eraser"), h("span", { text: "Limpar" }));
    const guardarDesenho = h("input", { type: "checkbox", id: "pdf-assin-guardar1", checked: true });
    const painelDesenhar = h("div.pdf-assin-painel",
      quadro,
      h("div.pdf-assin-controles", h("div.pdf-assin-grupo", corBtns), h("div.pdf-assin-grupo", espBtns), h("div.pdf-assin-espaco"), limpar),
      h("label.pdf-assin-check", guardarDesenho, h("span", { text: "Guardar para usar de novo" })));

    let dpr = 1;
    function redimensionar() {
      const r = canvas.getBoundingClientRect();
      if (!r.width) return;
      dpr = Math.min(3, window.devicePixelRatio || 1);
      canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
      desenhar();
    }
    function tracar(ctx, t, k) {
      const p = t.pts;
      ctx.strokeStyle = t.cor; ctx.lineWidth = t.esp * k; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(p[0][0] * k, p[0][1] * k);
      if (p.length < 3) { const u = p[p.length - 1]; ctx.lineTo(u[0] * k + 0.01, u[1] * k); }
      else {
        for (let i = 1; i < p.length - 1; i++) ctx.quadraticCurveTo(p[i][0] * k, p[i][1] * k, (p[i][0] + p[i + 1][0]) / 2 * k, (p[i][1] + p[i + 1][1]) / 2 * k);
        const u = p[p.length - 1]; ctx.lineTo(u[0] * k, u[1] * k);
      }
      ctx.stroke();
    }
    function desenhar() {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const t of tracos) tracar(ctx, t, dpr);
      dica.classList.toggle("is-hidden", tracos.length > 0);
    }
    const ponto = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    canvas.addEventListener("pointerdown", e => {
      if (e.button > 0) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      atual = { cor, esp, pts: [ponto(e)] };
      tracos.push(atual);
      desenhar();
    });
    canvas.addEventListener("pointermove", e => {
      if (!atual) return;
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of evs.length ? evs : [e]) atual.pts.push(ponto(ev));
      desenhar();
    });
    const soltar = () => { if (atual) { atual = null; atualizarBotao(); } };
    canvas.addEventListener("pointerup", soltar);
    canvas.addEventListener("pointercancel", soltar);
    const ro = new ResizeObserver(() => redimensionar());
    ro.observe(canvas);
    m.aoFechar.push(() => ro.disconnect());

    async function exportarDesenho() {
      // redesenha numa escala maior para ficar nítida na impressão
      const r = canvas.getBoundingClientRect();
      const k = 2.5;
      const c = document.createElement("canvas");
      c.width = Math.round(r.width * k); c.height = Math.round(r.height * k);
      const ctx = c.getContext("2d");
      for (const t of tracos) tracar(ctx, t, k);
      const rec = recortar(c, Math.round(3 * k));
      if (!rec) return null;
      const blob = await canvasParaBlob(rec);
      return { bytes: await blobParaBytes(blob), tipo: "png", w: rec.width, h: rec.height };
    }

    // ---------- importar
    const entrada = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/*", style: { display: "none" } });
    const previa = h("div.pdf-assin-previa", h("div.u-faint", { text: "Nenhuma imagem escolhida." }));
    const removerFundo = h("input", { type: "checkbox", id: "pdf-assin-fundo", checked: true });
    const guardarImport = h("input", { type: "checkbox", id: "pdf-assin-guardar2", checked: true });
    let importada = null, arquivo = null;
    async function processar() {
      if (!arquivo) return;
      try {
        importada = await prepararImagem(arquivo, arquivo.type, { max: 1600, removerFundo: removerFundo.checked, cortar: removerFundo.checked });
        const url = URL.createObjectURL(new Blob([importada.bytes], { type: importada.tipo === "png" ? "image/png" : "image/jpeg" }));
        vazio(previa).appendChild(h("img", { src: url, alt: "Prévia da assinatura" }));
        m.aoFechar.push(() => URL.revokeObjectURL(url));
      } catch (e) { importada = null; vazio(previa).appendChild(h("div.u-faint", { text: e.message || "Não foi possível ler a imagem." })); }
      atualizarBotao();
    }
    entrada.addEventListener("change", () => { arquivo = entrada.files?.[0] || null; processar(); });
    removerFundo.addEventListener("change", processar);
    const painelImportar = h("div.pdf-assin-painel",
      h("div.pdf-assin-controles", h("button", { type: "button", onclick: () => entrada.click() }, icon("upload"), h("span", { text: "Escolher imagem…" })), h("span.u-muted.pdf-assin-nota", { text: "PNG ou JPG — pode ser uma foto da assinatura em papel branco." })),
      previa,
      h("label.pdf-assin-check", removerFundo, h("span", { text: "Remover fundo branco" })),
      h("label.pdf-assin-check", guardarImport, h("span", { text: "Guardar para usar de novo" })),
      entrada);

    // ---------- guardadas
    const grade = h("div.pdf-assin-grade");
    function montarGrade() {
      vazio(grade);
      const lista = assinaturasGuardadas();
      if (!lista.length) { grade.appendChild(h("div.u-faint.pdf-assin-vazio", { text: "Nenhuma assinatura guardada ainda. Desenhe ou importe uma e deixe marcado “Guardar para usar de novo”." })); return; }
      for (const s of lista) {
        const card = h("div.pdf-assin-cartao", { role: "button", tabindex: "0", title: "Usar esta assinatura", "aria-label": "Usar assinatura guardada" },
          h("img", { src: s.png, alt: "Assinatura guardada", draggable: "false" }),
          iconButton("trash", "Apagar esta assinatura guardada", () => { gravarLista(assinaturasGuardadas().filter(x => x.id !== s.id)); montarGrade(); }, "clickable-icon pdf-assin-apagar"));
        const usar = async () => { const bytes = await dataUrlParaBytes(s.png); const bmp = await createImageBitmap(new Blob([bytes], { type: "image/png" })); fim({ bytes, tipo: "png", w: bmp.width, h: bmp.height }); bmp.close?.(); };
        card.addEventListener("click", usar);
        card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); usar(); } });
        grade.appendChild(card);
      }
    }
    montarGrade();
    const painelGuardadas = h("div.pdf-assin-painel", grade);

    aba("desenhar", "Desenhar", painelDesenhar);
    aba("importar", "Importar imagem", painelImportar);
    aba("guardadas", "Guardadas", painelGuardadas);
    m.contentEl.append(abas, paineis);

    const bts = m.botoes([
      { texto: "Cancelar", acao: () => fim(null) },
      { texto: "Usar assinatura", cta: true, acao: async () => {
        try {
          if (abaAtual === "desenhar") {
            const r = await exportarDesenho();
            if (!r) { notice("Desenhe a assinatura primeiro."); return; }
            if (guardarDesenho.checked) guardarAssinatura(await bytesParaDataUrl(r.bytes));
            fim(r);
          } else if (abaAtual === "importar") {
            if (!importada) { notice("Escolha uma imagem primeiro."); return; }
            if (guardarImport.checked) guardarAssinatura(await bytesParaDataUrl(importada.bytes, importada.tipo === "png" ? "image/png" : "image/jpeg"));
            fim(importada);
          }
        } catch (e) { notice("Não foi possível usar a assinatura: " + (e.message || e)); }
      } },
    ]);
    const usarBtn = bts.lastChild;
    function atualizarBotao() {
      const ok = abaAtual === "desenhar" ? tracos.length > 0 : abaAtual === "importar" ? !!importada : false;
      usarBtn.disabled = !ok;
      usarBtn.classList.toggle("is-hidden", abaAtual === "guardadas");
    }
    m.open();
    mostrar(guardadas.length ? "guardadas" : "desenhar");
  });
}
