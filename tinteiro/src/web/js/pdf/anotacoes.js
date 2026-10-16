// Anotações do PDF: geometria (rotação de página), texto (métricas da Helvetica), testes de clique
// e desenho das camadas na tela (usado na página grande e nas miniaturas).
//
// Coordenadas: todas as anotações ficam no "espaço da página sem rotação", em pontos (1/72"),
// com origem no canto superior esquerdo da área visível (CropBox) e y crescendo para baixo.
// Na hora de salvar: xPdf = view[0] + x ; yPdf = view[3] - y.
import { StandardFontEmbedder, StandardFonts } from "pdf-lib";

export const PX_POR_PT = 96 / 72;          // zoom 100% = tamanho real
export const FONTE_CSS = 'Helvetica, Arial, "Liberation Sans", "Nimbus Sans", "Helvetica Neue", sans-serif';
export const ALTURA_LINHA = 1.2;            // em múltiplos do tamanho da letra
export const MARGEM_TEXTO = 2;              // pontos
// posição da linha de base dentro da linha (métricas da Arial/Helvetica: ascendente .905, descendente .212)
export const BASE_LINHA = (ALTURA_LINHA - 1.117) / 2 + 0.905;

const SVG = "http://www.w3.org/2000/svg";
let seq = 0;
export const novoId = (p = "a") => p + Date.now().toString(36) + (++seq).toString(36) + Math.random().toString(36).slice(2, 6);

// ------------------------------------------------------------------ rotação
const norm = g => ((g % 360) + 360) % 360;
/** gira um vetor no sentido horário da tela (y para baixo), como o rotate() do CSS */
export function girar([x, y], graus) {
  switch (norm(graus)) {
    case 90: return [-y, x];
    case 180: return [-x, -y];
    case 270: return [y, -x];
    default: return [x, y];
  }
}
/** ponto na página exibida (já girada R graus) → espaço da página sem rotação */
export function telaParaPagina(dx, dy, W, H, R) {
  switch (norm(R)) {
    case 90: return [dy, H - dx];
    case 180: return [W - dx, H - dy];
    case 270: return [W - dy, dx];
    default: return [dx, dy];
  }
}
export function paginaParaTela(x, y, W, H, R) {
  switch (norm(R)) {
    case 90: return [H - y, x];
    case 180: return [W - x, H - y];
    case 270: return [y, W - x];
    default: return [x, y];
  }
}

// ------------------------------------------------------------------ texto (Helvetica, WinAnsi)
let fonte = null, suportados = null;
const metricas = () => (fonte ??= StandardFontEmbedder.for(StandardFonts.Helvetica));
const TROCAS = {
  "\t": "    ", " ": " ", " ": " ", " ": " ", " ": " ", "​": "", "−": "-", "‐": "-", "‑": "-", "‒": "–",
  "―": "—", "≤": "<=", "≥": ">=", "≠": "!=", "→": "->", "←": "<-", "✓": "v", "✔": "v", "′": "'", "″": '"',
  "·": "·", "№": "Nº", " ": " ", " ": " ",
};
/** troca o que a fonte padrão do PDF não sabe escrever (emojis etc.) */
export function limparTexto(s) {
  suportados ??= new Set(metricas().encoding.supportedCodePoints);
  let out = "";
  for (const ch of String(s || "").replace(/\r\n?/g, "\n").normalize("NFC")) {
    if (ch === "\n") { out += ch; continue; }
    const cp = ch.codePointAt(0);
    if (suportados.has(cp)) { out += ch; continue; }
    if (TROCAS[ch] !== undefined) { out += TROCAS[ch]; continue; }
    if (/\p{Extended_Pictographic}|️|‍/u.test(ch)) continue;
    const base = ch.normalize("NFD").replace(/\p{M}/gu, "");
    out += base && [...base].every(c => suportados.has(c.codePointAt(0))) ? base : "?";
  }
  return out;
}
export function larguraTexto(s, tam) { return s ? metricas().widthOfTextAtSize(s, tam) : 0; }

function quebrarParagrafo(par, tam, largura) {
  const out = [];
  let atual = "";
  const cabe = s => larguraTexto(s.trimEnd(), tam) <= largura + 0.01;
  for (const token of par.match(/\S+\s*|\s+/g) || [""]) {
    if (cabe(atual + token)) { atual += token; continue; }
    if (atual.trim()) { out.push(atual.trimEnd()); atual = ""; }
    let t = token;
    while (!cabe(t) && t.trim().length > 1) {
      let n = t.length - 1;
      while (n > 1 && !cabe(t.slice(0, n))) n--;
      out.push(t.slice(0, n));
      t = t.slice(n);
    }
    atual = t;
  }
  out.push(atual.trimEnd());
  return out;
}

/** calcula as linhas e o tamanho (cw × ch, em pontos) de uma caixa de texto */
export function layoutTexto(a) {
  const texto = limparTexto(a.texto);
  const util = a.largura ? Math.max(4, a.largura - 2 * MARGEM_TEXTO) : null;
  const linhas = [];
  for (const par of texto.split("\n")) linhas.push(...(util ? quebrarParagrafo(par, a.tam, util) : [par]));
  const lh = a.tam * ALTURA_LINHA;
  const maior = Math.max(0, ...linhas.map(l => larguraTexto(l, a.tam)));
  const cw = a.largura || Math.max(maior, a.tam * 0.6) + 2 * MARGEM_TEXTO;
  const ch = linhas.length * lh + 2 * MARGEM_TEXTO;
  return { linhas, cw, ch, lh };
}
export function ajustarTexto(a) { const l = layoutTexto(a); a.cw = l.cw; a.ch = l.ch; return l; }

// ------------------------------------------------------------------ caixas (texto e imagem)
/** eixos da caixa (texto/imagem) no espaço da página: u = direção do texto, v = "para baixo" */
export function eixos(a) { return [girar([1, 0], -a.rot), girar([0, 1], -a.rot)]; }
/** ponto (s, t) dentro da caixa → página */
export function pontoDaCaixa(a, s, t) { const [u, v] = eixos(a); return [a.x + s * u[0] + t * v[0], a.y + s * u[1] + t * v[1]]; }
export function pontoNaCaixa(a, px, py) { const [u, v] = eixos(a); const qx = px - a.x, qy = py - a.y; return [qx * u[0] + qy * u[1], qx * v[0] + qy * v[1]]; }

/** retângulo envolvente da anotação (espaço da página) */
export function caixaAnot(a) {
  if (a.tipo === "texto" || a.tipo === "imagem") {
    const pts = [pontoDaCaixa(a, 0, 0), pontoDaCaixa(a, a.cw, 0), pontoDaCaixa(a, 0, a.ch), pontoDaCaixa(a, a.cw, a.ch)];
    return envolver(pts, 0);
  }
  if (a.tipo === "retangulo") return { x: a.x - a.esp / 2, y: a.y - a.esp / 2, w: a.w + a.esp, h: a.h + a.esp };
  if (a.tipo === "tinta") return envolver(a.pontos, a.esp / 2);
  if (a.tipo === "destaque") return envolver(a.rects.flatMap(r => [[r.x, r.y], [r.x + r.w, r.y + r.h]]), 0);
  return { x: 0, y: 0, w: 0, h: 0 };
}
function envolver(pts, m) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  if (!isFinite(x0)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: x0 - m, y: y0 - m, w: x1 - x0 + 2 * m, h: y1 - y0 + 2 * m };
}

function distSeg(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** o ponto (espaço da página) toca a anotação? tol em pontos */
export function acertou(a, x, y, tol) {
  switch (a.tipo) {
    case "texto": case "imagem": {
      const [s, t] = pontoNaCaixa(a, x, y);
      return s >= -tol / 2 && t >= -tol / 2 && s <= a.cw + tol / 2 && t <= a.ch + tol / 2;
    }
    case "retangulo": {
      const t = a.esp / 2 + tol;
      const dentro = x >= a.x - t && x <= a.x + a.w + t && y >= a.y - t && y <= a.y + a.h + t;
      const miolo = x > a.x + t && x < a.x + a.w - t && y > a.y + t && y < a.y + a.h - t;
      return dentro && !miolo;
    }
    case "tinta": {
      const p = a.pontos, lim = a.esp / 2 + tol;
      if (p.length === 1) return Math.hypot(x - p[0][0], y - p[0][1]) <= lim;
      for (let i = 1; i < p.length; i++) if (distSeg(x, y, p[i - 1], p[i]) <= lim) return true;
      return false;
    }
    case "destaque": return a.rects.some(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  }
  return false;
}

/** cópia deslocada (dx, dy) — usada ao arrastar */
export function transladar(o, dx, dy) {
  switch (o.tipo) {
    case "texto": case "imagem": case "retangulo": return { x: o.x + dx, y: o.y + dy };
    case "tinta": return { pontos: o.pontos.map(([x, y]) => [x + dx, y + dy]) };
    case "destaque": return { rects: o.rects.map(r => ({ ...r, x: r.x + dx, y: r.y + dy })) };
  }
  return {};
}

// ------------------------------------------------------------------ traçado livre
/** simplifica pontos (Ramer–Douglas–Peucker) */
export function simplificar(pts, eps) {
  if (pts.length < 3) return pts.slice();
  const manter = new Uint8Array(pts.length); manter[0] = manter[pts.length - 1] = 1;
  const pilha = [[0, pts.length - 1]];
  while (pilha.length) {
    const [i, j] = pilha.pop();
    let max = 0, k = -1;
    for (let m = i + 1; m < j; m++) { const d = distSeg(pts[m][0], pts[m][1], pts[i], pts[j]); if (d > max) { max = d; k = m; } }
    if (max > eps && k > 0) { manter[k] = 1; pilha.push([i, k], [k, j]); }
  }
  return pts.filter((_, i) => manter[i]);
}
const r2 = n => Math.round(n * 100) / 100;
/** caminho SVG suavizado (curvas pelos pontos médios) */
export function caminhoSuave(pts) {
  if (!pts.length) return "";
  if (pts.length === 1) return `M${r2(pts[0][0])} ${r2(pts[0][1])}l0.01 0`;
  if (pts.length === 2) return `M${r2(pts[0][0])} ${r2(pts[0][1])}L${r2(pts[1][0])} ${r2(pts[1][1])}`;
  let d = `M${r2(pts[0][0])} ${r2(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += `Q${r2(pts[i][0])} ${r2(pts[i][1])} ${r2(mx)} ${r2(my)}`;
  }
  const u = pts[pts.length - 1];
  return d + `L${r2(u[0])} ${r2(u[1])}`;
}

/** junta retângulos da mesma linha (destaque a partir de seleção de texto) */
export function juntarRetangulos(rs) {
  const lista = rs.filter(r => r.w > 0.5 && r.h > 0.5).sort((a, b) => a.y - b.y || a.x - b.x);
  const out = [];
  for (const r of lista) {
    const u = out.find(o => Math.abs(o.y + o.h / 2 - (r.y + r.h / 2)) < Math.min(o.h, r.h) * 0.5 && r.x <= o.x + o.w + Math.min(o.h, r.h) * 0.6 && r.x + r.w >= o.x - Math.min(o.h, r.h) * 0.6);
    if (u) { const x0 = Math.min(u.x, r.x), y0 = Math.min(u.y, r.y), x1 = Math.max(u.x + u.w, r.x + r.w), y1 = Math.max(u.y + u.h, r.y + r.h); Object.assign(u, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }); }
    else out.push({ ...r });
  }
  return out;
}

// ------------------------------------------------------------------ desenho das camadas (DOM)
const px = n => `calc(var(--scale-factor) * ${r2(n)}px)`;
function svgEl(tag, attrs) { const e = document.createElementNS(SVG, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }

/** prepara uma camada (div) do tamanho da página sem rotação, girada como a página */
export function dimensionarCamada(el, W, H, R) {
  el.style.width = px(W); el.style.height = px(H);
  el.setAttribute("data-main-rotation", String(norm(R)));
  let svg = el.querySelector(":scope > svg");
  if (!svg) { svg = svgEl("svg", { class: "pdf-camada-svg", preserveAspectRatio: "none" }); el.prepend(svg); }
  svg.setAttribute("viewBox", `0 0 ${r2(W)} ${r2(H)}`);
  return svg;
}

/** desenha os destaques (marca-texto) — ficam por baixo do texto */
export function desenharDestaques(camada, anots, { selecionada = null } = {}) {
  const svg = camada.querySelector(":scope > svg");
  const vistos = new Set();
  let ant = null;
  for (const a of anots) {
    if (a.tipo !== "destaque") continue;
    vistos.add(a.id);
    let g = svg.querySelector(`:scope > g[data-id="${a.id}"]`);
    if (!g) { g = svgEl("g", { "data-id": a.id }); svg.appendChild(g); }
    g.setAttribute("fill", a.cor);
    g.classList.toggle("is-selected", a.id === selecionada);
    const chave = a.rects.map(r => `${r2(r.x)},${r2(r.y)},${r2(r.w)},${r2(r.h)}`).join(";");
    if (g.dataset.chave !== chave) {
      g.dataset.chave = chave;
      while (g.firstChild) g.firstChild.remove();
      for (const r of a.rects) g.appendChild(svgEl("rect", { x: r2(r.x), y: r2(r.y), width: r2(r.w), height: r2(r.h), rx: Math.min(1.5, r.h / 6) }));
    }
    if ((ant ? ant.nextElementSibling : svg.firstElementChild) !== g) { if (ant) ant.after(g); else svg.prepend(g); }
    ant = g;
  }
  for (const g of [...svg.children]) if (!vistos.has(g.dataset.id)) g.remove();
}

/**
 * desenha tinta, retângulos, textos e imagens.
 * ctx: { imagens: Map(id→{url}), selecionada: id, editando: id, interativa: bool, aoCriarEditor(el, a) }
 */
export function desenharAnotacoes(camada, anots, ctx = {}) {
  const svg = camada.querySelector(":scope > svg");
  const vistosSvg = new Set(), vistosEl = new Set();
  let antSvg = null, antEl = svg;
  for (const a of anots) {
    if (a.tipo === "tinta" || a.tipo === "retangulo") {
      vistosSvg.add(a.id);
      let e = svg.querySelector(`:scope > [data-id="${a.id}"]`);
      const tag = a.tipo === "tinta" ? "path" : "rect";
      if (!e || e.tagName !== tag) { e?.remove(); e = svgEl(tag, { "data-id": a.id, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }); }
      e.setAttribute("stroke", a.cor);
      e.setAttribute("stroke-width", r2(a.esp));
      if (a.tipo === "tinta") { const d = caminhoSuave(a.pontos); if (e.getAttribute("d") !== d) e.setAttribute("d", d); }
      else { e.setAttribute("x", r2(a.x)); e.setAttribute("y", r2(a.y)); e.setAttribute("width", r2(Math.max(0.1, a.w))); e.setAttribute("height", r2(Math.max(0.1, a.h))); e.setAttribute("stroke-linejoin", "miter"); }
      e.classList.toggle("is-selected", a.id === ctx.selecionada);
      // só move o nó se a ordem estiver errada (mover tira o foco de quem está sendo editado)
      if ((antSvg ? antSvg.nextElementSibling : svg.firstElementChild) !== e) { if (antSvg) antSvg.after(e); else svg.prepend(e); }
      antSvg = e;
    } else if (a.tipo === "texto" || a.tipo === "imagem") {
      vistosEl.add(a.id);
      let el = camada.querySelector(`:scope > .pdf-anot[data-id="${a.id}"]`);
      if (!el) { el = document.createElement("div"); el.className = "pdf-anot pdf-anot-" + a.tipo; el.dataset.id = a.id; }
      // coloca no lugar antes de montar o conteúdo (o editor de texto precisa estar na página para receber o foco)
      if (antEl.nextElementSibling !== el) antEl.after(el);
      antEl = el;
      el.style.left = px(a.x); el.style.top = px(a.y); el.style.width = px(a.cw); el.style.height = px(a.ch);
      el.style.transform = a.rot ? `rotate(${-a.rot}deg)` : "";
      el.classList.toggle("is-selected", a.id === ctx.selecionada);
      if (a.tipo === "imagem") {
        const url = ctx.imagens?.get(a.img)?.url || "";
        let img = el.querySelector("img");
        if (!img) { img = document.createElement("img"); img.draggable = false; img.alt = ""; el.appendChild(img); }
        if (img.getAttribute("src") !== url) img.setAttribute("src", url);
      } else {
        const editando = a.id === ctx.editando;
        el.classList.toggle("is-editing", editando);
        el.style.color = a.cor;
        el.style.fontSize = px(a.tam);
        el.style.lineHeight = px(a.tam * ALTURA_LINHA);
        el.style.padding = px(MARGEM_TEXTO);
        if (editando) {
          el.querySelector(".pdf-anot-linhas")?.remove();
          if (!el.querySelector("textarea")) ctx.aoCriarEditor?.(el, a);
          const ta = el.querySelector("textarea");
          if (ta) ta.style.whiteSpace = a.largura ? "pre-wrap" : "pre";
        } else {
          el.querySelector("textarea")?.remove();
          const { linhas } = layoutTexto(a);
          const chave = a.tam + "|" + linhas.join("\n");
          let box = el.querySelector(".pdf-anot-linhas");
          if (!box) { box = document.createElement("div"); box.className = "pdf-anot-linhas"; el.appendChild(box); }
          if (box.dataset.chave !== chave) {
            box.dataset.chave = chave;
            box.textContent = "";
            for (const l of linhas) { const d = document.createElement("div"); d.textContent = l || "​"; box.appendChild(d); }
          }
        }
      }
    }
  }
  for (const e of [...svg.children]) if (e.dataset.id && !vistosSvg.has(e.dataset.id)) e.remove();
  for (const el of [...camada.querySelectorAll(":scope > .pdf-anot")]) if (!vistosEl.has(el.dataset.id)) el.remove();
}

/** traço provisório enquanto o usuário desenha */
export function tracoProvisorio(camada, attrs) {
  const svg = camada.querySelector(":scope > svg");
  let e = svg.querySelector(":scope > .pdf-provisorio");
  if (!attrs) { e?.remove(); return null; }
  const tag = attrs.tag || "path";
  if (!e || e.tagName !== tag) { e?.remove(); e = svgEl(tag, { class: "pdf-provisorio", fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }); svg.appendChild(e); }
  for (const k in attrs) if (k !== "tag") e.setAttribute(k, attrs[k]);
  return e;
}
