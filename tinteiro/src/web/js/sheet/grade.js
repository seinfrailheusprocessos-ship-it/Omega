// Grade da planilha: desenho em <canvas> (só a parte visível — aguenta dezenas de milhares de linhas),
// seleção, teclado, mouse/toque, edição na célula e na barra de fórmulas, alça de preenchimento.
import { h } from "../util/dom.js";
import { Emitter } from "../util/events.js";
import { Eixo } from "./eixo.js";
import { chave, linhaDaChave, colunaDaChave, letraColuna, nomeCelula, nomeIntervalo, citarFolha, lerIntervalo, MAX_LINHAS, MAX_COLUNAS, intersecta } from "./enderecos.js";
import { referenciasDoTexto, podeApontar, alternarAbsoluta, tokenizar } from "./formula.js";
import { formatoGeral } from "./formatos.js";
import { listaFuncoesPt, DICAS } from "./funcoes.js";

const CORES_REF = ["#4f81f7", "#e8533f", "#9b59d0", "#2e9e5b", "#d08a1c", "#d0479a", "#178f9c"];
const semAcento = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
let FUNCOES = null;

export class Grade extends Emitter {
  constructor({ pasta, mobile = false, somenteLeitura = false, barra = null }) {
    super();
    this.pasta = pasta;
    this.mobile = mobile;
    this.somenteLeitura = somenteLeitura;
    this.barra = barra; // <textarea> da barra de fórmulas
    this.folha = pasta.folhas[Math.min(pasta.abaAtiva, pasta.folhas.length - 1)] || pasta.folhas[0];
    this.zoom = 1;
    this.sel = { ancora: { r: 0, c: 0 }, foco: { r: 0, c: 0 }, ativa: { r: 0, c: 0 } };
    this.ed = null;
    this.copia = null; // área copiada (formigas)
    this.realce = null; // célula encontrada pela busca
    this.extR = 0; this.extC = 0;
    this.cabAlt = mobile ? 26 : 22;
    this.dpr = window.devicePixelRatio || 1;
    this.medidor = document.createElement("canvas").getContext("2d");

    this.el = h("div.sheet-grid");
    this.spacer = h("div.sheet-spacer");
    this.scroller = h("div.sheet-scroller", this.spacer);
    this.canvas = h("canvas.sheet-canvas");
    this.ctx = this.canvas.getContext("2d", { alpha: false });
    this.ta = h("textarea.sheet-editor.is-idle", { spellcheck: "false", autocomplete: "off", autocorrect: "off", autocapitalize: "off", "aria-label": "Célula da planilha", rows: "1", wrap: "off" });
    this.lista = h("div.sheet-autocomplete.is-hidden");
    this.dica = h("div.sheet-func-hint.is-hidden");
    this.alca = h("div.sheet-touch-handle.is-hidden");
    this.linhaGuia = h("div.sheet-resize-guide.is-hidden");
    this.especialEl = h("div.sheet-special.is-hidden");
    this.el.append(this.scroller, this.canvas, this.ta, this.alca, this.linhaGuia, this.lista, this.dica, this.especialEl);
    if (mobile) { this.ta.setAttribute("inputmode", "none"); this.ta.readOnly = true; }
    if (somenteLeitura) this.ta.readOnly = true;

    this.lerTema();
    this.reconstruirEixos();
    this.ligarEventos();
    this.ro = new ResizeObserver(() => this.redimensionar());
    this.ro.observe(this.el);
    this.mo = new MutationObserver(() => { this.lerTema(); this.desenhar(); });
    this.mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }

  destruir() { this.ro?.disconnect(); this.mo?.disconnect(); clearInterval(this.autoRolagem); cancelAnimationFrame(this.raf); }

  // ============================================================ tema e medidas
  lerTema() {
    const sonda = h("div", { style: { position: "absolute", visibility: "hidden", pointerEvents: "none" } });
    document.body.appendChild(sonda);
    const ler = v => { sonda.style.color = ""; sonda.style.color = `var(${v})`; return getComputedStyle(sonda).color || "#888"; };
    const escuro = document.body.classList.contains("theme-dark");
    this.tema = {
      escuro,
      fundo: ler("--background-primary"), cab: ler("--background-secondary"), borda: ler("--background-modifier-border"),
      texto: ler("--text-normal"), textoCab: ler("--text-muted"), fraco: ler("--text-faint"), acento: ler("--interactive-accent"),
      fonte: getComputedStyle(document.body).getPropertyValue("--font-interface").trim() || "sans-serif",
    };
    sonda.remove();
    const rgb = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(this.tema.acento) || [0, 130, 100, 240];
    this.tema.acentoFundo = `rgba(${rgb[1]},${rgb[2]},${rgb[3]},0.12)`;
    this.tema.acentoCab = `rgba(${rgb[1]},${rgb[2]},${rgb[3]},${escuro ? 0.28 : 0.18})`;
    this.tema.acentoCabForte = `rgba(${rgb[1]},${rgb[2]},${rgb[3]},${escuro ? 0.45 : 0.32})`;
    this.tema.grade = escuro ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.11)";
    this.pasta.estilos?.definirTemaEscuro(escuro);
  }

  /** largura de dígito da fonte padrão (unidade de largura de coluna do Excel) */
  get mdw() {
    if (this._mdw) return this._mdw;
    const f = this.pasta.estilos?.fontePadrao || { nome: "Calibri", tam: 11 };
    const fam = this.pasta.estilos ? this.pasta.estilos.render(0).familia : "Calibri, Carlito, sans-serif";
    this.medidor.font = `${f.tam * 96 / 72}px ${fam}`;
    let w = Math.round(this.medidor.measureText("0").width);
    if (!w || w < 5 || w > 14) w = 7;
    this._mdw = w;
    return w;
  }
  larguraPx(chars) { const m = this.mdw; return Math.trunc(((256 * chars + Math.trunc(128 / m)) / 256) * m); }
  charsDePx(px) { return Math.round(px / this.mdw * 256) / 256; }

  reconstruirEixos() {
    const f = this.folha;
    const z = this.zoom * (f.zoom || 100) / 100;
    this.escala = z;
    const altPadrao = Math.round(f.alturaPadrao * 4 / 3);
    const faixasL = [];
    const linhas = [...f.linhas.entries()].sort((a, b) => a[0] - b[0]);
    for (const [r, l] of linhas) {
      if (l.oculta) faixasL.push({ a: r, b: r, t: 0 });
      else if (l.ht != null) faixasL.push({ a: r, b: r, t: Math.max(1, Math.round(l.ht * 4 / 3 * z)) });
    }
    const pxPadrao = f.larguraPadrao ? this.larguraPx(f.larguraPadrao) : Math.ceil((f.larguraBase * this.mdw + 5) / 8) * 8;
    const faixasC = [];
    for (const col of f.colunas) {
      const oculta = col.attrs.hidden === "1" || col.attrs.hidden === "true";
      const larg = col.attrs.width != null ? this.larguraPx(parseFloat(col.attrs.width)) : pxPadrao;
      faixasC.push({ a: col.min, b: Math.min(col.max, MAX_COLUNAS - 1), t: oculta ? 0 : Math.max(0, Math.round(larg * z)) });
    }
    this.lin = new Eixo(Math.round(altPadrao * z), faixasL, MAX_LINHAS);
    this.col = new Eixo(Math.round(pxPadrao * z), faixasC, MAX_COLUNAS);
    this.atualizarExtensao();
  }

  atualizarExtensao(forcar = false) {
    const f = this.folha;
    const visL = Math.ceil((this.scroller.clientHeight || 800) / Math.max(8, this.lin.padrao));
    const visC = Math.ceil((this.scroller.clientWidth || 1200) / Math.max(20, this.col.padrao));
    const r = Math.max(f.limite.r + 1 + visL, this.sel.foco.r + visL, visL * 2, 60);
    const c = Math.max(f.limite.c + 1 + Math.ceil(visC / 2), this.sel.foco.c + visC, visC * 2, 26);
    if (forcar || r > this.extR) this.extR = Math.min(MAX_LINHAS, Math.max(r, this.extR));
    if (forcar || c > this.extC) this.extC = Math.min(MAX_COLUNAS, Math.max(c, this.extC));
    this.larguraCab = Math.max(this.mobile ? 34 : 38, 14 + String(this.extR).length * 7.5);
    this.spacer.style.width = Math.ceil(this.larguraCab + this.col.pos(this.extC)) + "px";
    this.spacer.style.height = Math.ceil(this.cabAlt + this.lin.pos(this.extR)) + "px";
  }

  redimensionar() {
    const W = this.scroller.clientWidth, H = this.scroller.clientHeight;
    if (!W || !H) return;
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.style.width = W + "px"; this.canvas.style.height = H + "px";
    this.canvas.width = Math.round(W * this.dpr); this.canvas.height = Math.round(H * this.dpr);
    this.W = W; this.H = H;
    this.atualizarExtensao();
    this.desenhar(true);
  }

  // ============================================================ geometria da tela
  congelado() {
    const f = this.folha;
    let fr = f.congelar.linhas || 0, fc = f.congelar.colunas || 0;
    let fh = this.lin.pos(fr), fw = this.col.pos(fc);
    if (fh > (this.H - this.cabAlt) * 0.75) { fr = 0; fh = 0; }
    if (fw > (this.W - this.larguraCab) * 0.75) { fc = 0; fw = 0; }
    return { fr, fc, fh, fw };
  }
  medir() {
    const { fr, fc, fh, fw } = this.congelado();
    const sx = this.scroller.scrollLeft, sy = this.scroller.scrollTop;
    const hw = this.larguraCab, hh = this.cabAlt;
    const baseX = this.col.pos(fc), baseY = this.lin.pos(fr);
    const c0 = this.col.indice(baseX + sx), r0 = this.lin.indice(baseY + sy);
    const c1 = Math.min(this.extC - 1, this.col.indice(baseX + sx + Math.max(0, this.W - hw - fw)));
    const r1 = Math.min(this.extR - 1, this.lin.indice(baseY + sy + Math.max(0, this.H - hh - fh)));
    this.g = { fr, fc, fh, fw, sx, sy, hw, hh, baseX, baseY, c0, r0, c1, r1 };
    return this.g;
  }
  x(c) { const g = this.g; return c < g.fc ? g.hw + this.col.pos(c) : g.hw + g.fw + this.col.pos(c) - g.baseX - g.sx; }
  y(r) { const g = this.g; return r < g.fr ? g.hh + this.lin.pos(r) : g.hh + g.fh + this.lin.pos(r) - g.baseY - g.sy; }
  /** retângulo na tela da célula (ou da mescla que a contém) */
  retangulo(r, c, comMescla = true) {
    const m = comMescla ? this.folha.mesclaEm(r, c) : null;
    if (m) return { x: this.x(m.c1), y: this.y(m.r1), w: this.col.pos(m.c2 + 1) - this.col.pos(m.c1), h: this.lin.pos(m.r2 + 1) - this.lin.pos(m.r1), m };
    return { x: this.x(c), y: this.y(r), w: this.col.tam(c), h: this.lin.tam(r) };
  }
  /** célula sob o ponto (coordenadas relativas ao canvas) */
  celulaEm(px, py) {
    const g = this.g || this.medir();
    let c, r;
    const x = px - g.hw, y = py - g.hh;
    if (x < g.fw) c = this.col.indice(Math.max(0, x)); else c = this.col.indice(g.baseX + g.sx + x - g.fw);
    if (y < g.fh) r = this.lin.indice(Math.max(0, y)); else r = this.lin.indice(g.baseY + g.sy + y - g.fh);
    return { r: Math.min(r, MAX_LINHAS - 1), c: Math.min(c, MAX_COLUNAS - 1) };
  }
  ponto(e) { const b = this.canvas.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; }

  // ============================================================ seleção
  area() {
    const a = this.sel.ancora, b = this.sel.foco;
    let g = { r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c), r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c) };
    return this.expandirMesclas(g);
  }
  expandirMesclas(g) {
    const ms = this.folha.mesclas;
    if (!ms.length) return g;
    let mudou = true;
    while (mudou) {
      mudou = false;
      for (const m of ms) if (intersecta(m, g) && (m.r1 < g.r1 || m.r2 > g.r2 || m.c1 < g.c1 || m.c2 > g.c2)) {
        g = { r1: Math.min(g.r1, m.r1), c1: Math.min(g.c1, m.c1), r2: Math.max(g.r2, m.r2), c2: Math.max(g.c2, m.c2) }; mudou = true;
      }
    }
    return g;
  }
  selecionar(r, c, { estender = false, rolar = true, manterAtiva = false } = {}) {
    r = Math.max(0, Math.min(MAX_LINHAS - 1, r)); c = Math.max(0, Math.min(MAX_COLUNAS - 1, c));
    if (estender) this.sel.foco = { r, c };
    else {
      const m = this.folha.mesclaEm(r, c);
      const p = m ? { r: m.r1, c: m.c1 } : { r, c };
      this.sel = { ancora: { ...p }, foco: m ? { r: m.r2, c: m.c2 } : { ...p }, ativa: manterAtiva ? this.sel.ativa : { ...p } };
    }
    this.sel.tipo = null;
    if (rolar) this.rolarAte(estender ? this.sel.foco.r : this.sel.ativa.r, estender ? this.sel.foco.c : this.sel.ativa.c);
    this.mudouSelecao();
  }
  selecionarArea(g, ativa = null) {
    this.sel = { ancora: { r: g.r1, c: g.c1 }, foco: { r: g.r2, c: g.c2 }, ativa: ativa || { r: g.r1, c: g.c1 } };
    this.mudouSelecao();
  }
  selecionarTudo() { this.sel = { ancora: { r: 0, c: 0 }, foco: { r: MAX_LINHAS - 1, c: MAX_COLUNAS - 1 }, ativa: { ...this.sel.ativa }, tipo: "tudo" }; this.mudouSelecao(); }
  mudouSelecao() {
    this.atualizarExtensao();
    this.posicionarEditor();
    this.emit("selecao");
    this.desenhar();
  }

  rolarAte(r, c) {
    const g = this.medir();
    const s = this.scroller;
    if (c >= g.fc) {
      const x0 = this.col.pos(c) - g.baseX, x1 = this.col.pos(c + 1) - g.baseX;
      const larg = this.W - g.hw - g.fw;
      if (x0 < s.scrollLeft) s.scrollLeft = x0;
      else if (x1 > s.scrollLeft + larg) s.scrollLeft = Math.min(x0, x1 - larg);
    }
    if (r >= g.fr) {
      const y0 = this.lin.pos(r) - g.baseY, y1 = this.lin.pos(r + 1) - g.baseY;
      const alt = this.H - g.hh - g.fh;
      if (y0 < s.scrollTop) s.scrollTop = y0;
      else if (y1 > s.scrollTop + alt) s.scrollTop = Math.min(y0, y1 - alt);
    }
    this.medir();
  }

  temValor(r, c) { const v = this.pasta.valor(this.folha, r, c); return v !== null && v !== undefined && v !== ""; }

  /** movimento com as setas; ctrl = ir até a borda dos dados */
  mover(dr, dc, { estender = false, ctrl = false } = {}) {
    const f = this.folha;
    const base = estender ? this.sel.foco : this.sel.ativa;
    let r = base.r, c = base.c;
    if (!estender) {
      const m = f.mesclaEm(r, c);
      if (m) { if (dr > 0) r = m.r2; if (dc > 0) c = m.c2; if (dr < 0) r = m.r1; if (dc < 0) c = m.c1; }
    }
    if (ctrl) {
      const dentro = (rr, cc) => rr >= 0 && cc >= 0 && rr < MAX_LINHAS && cc < MAX_COLUNAS;
      let nr = r + dr, nc = c + dc;
      if (!dentro(nr, nc)) return;
      if (this.temValor(r, c) && this.temValor(nr, nc)) {
        // vai até a última célula preenchida do bloco
        while (dentro(nr + dr, nc + dc) && this.temValor(nr + dr, nc + dc)) { nr += dr; nc += dc; }
      } else {
        // procura a próxima célula preenchida; sem dados adiante, para no limite usado (ou na borda)
        const limR = Math.max(f.limite.r, r), limC = Math.max(f.limite.c, c);
        while (!this.temValor(nr, nc)) {
          const ar = nr + dr, ac = nc + dc;
          if (!dentro(ar, ac)) break;
          if ((dr > 0 && ar > limR) || (dc > 0 && ac > limC)) break;
          nr = ar; nc = ac;
        }
      }
      r = nr; c = nc;
    } else {
      r += dr; c += dc;
      // pula linhas/colunas ocultas
      while (dr && r > 0 && r < MAX_LINHAS - 1 && this.lin.oculto(r)) r += dr;
      while (dc && c > 0 && c < MAX_COLUNAS - 1 && this.col.oculto(c)) c += dc;
    }
    this.selecionar(r, c, { estender });
  }

  /** Enter/Tab dentro de uma seleção: percorre a área */
  avancar(dr, dc) {
    const g = this.area();
    if (g.r1 === g.r2 && g.c1 === g.c2 || this.sel.tipo) { this.mover(dr, dc); return; }
    let { r, c } = this.sel.ativa;
    if (dc) { c += dc; if (c > g.c2) { c = g.c1; r++; if (r > g.r2) r = g.r1; } else if (c < g.c1) { c = g.c2; r--; if (r < g.r1) r = g.r2; } }
    else { r += dr; if (r > g.r2) { r = g.r1; c++; if (c > g.c2) c = g.c1; } else if (r < g.r1) { r = g.r2; c--; if (c < g.c1) c = g.c2; } }
    this.sel.ativa = { r, c };
    this.rolarAte(r, c);
    this.mudouSelecao();
  }

  pagina(sentido, horizontal = false) {
    const g = this.medir();
    if (horizontal) {
      const n = Math.max(1, g.c1 - g.c0);
      this.scroller.scrollLeft += sentido * (this.col.pos(g.c1) - this.col.pos(g.c0));
      this.selecionar(this.sel.ativa.r, Math.max(0, this.sel.ativa.c + sentido * n));
    } else {
      const n = Math.max(1, g.r1 - g.r0);
      this.scroller.scrollTop += sentido * (this.lin.pos(g.r1) - this.lin.pos(g.r0));
      this.selecionar(Math.max(0, this.sel.ativa.r + sentido * n), this.sel.ativa.c);
    }
  }

  trocarFolha(folha) {
    if (folha === this.folha) return;
    this.folha = folha;
    this.copia = null;
    this.reconstruirEixos();
    this.scroller.scrollLeft = 0; this.scroller.scrollTop = 0;
    const p = folha.topo?.ativa || { r: 0, c: 0 };
    if (!this.ed) { this.sel = { ancora: { ...p }, foco: { ...p }, ativa: { ...p } }; this.rolarAte(p.r, p.c); }
    this.especialEl.classList.toggle("is-hidden", !folha.especial);
    if (folha.especial) this.especialEl.textContent = "Esta aba contém um gráfico ou outro conteúdo especial. Ela é mantida intacta ao salvar.";
    this.mudouSelecao();
  }

  definirZoom(z) {
    z = Math.max(0.5, Math.min(2.5, Math.round(z * 100) / 100));
    if (Math.abs(z - this.zoom) < 0.001) return;
    const g = this.medir();
    const fr = g.sy / Math.max(1, this.lin.pos(this.extR)), fcx = g.sx / Math.max(1, this.col.pos(this.extC));
    this.zoom = z;
    this.reconstruirEixos();
    this.scroller.scrollTop = fr * this.lin.pos(this.extR);
    this.scroller.scrollLeft = fcx * this.col.pos(this.extC);
    this.posicionarEditor();
    this.desenhar();
    this.emit("zoom", z);
  }

  // ============================================================ desenho
  desenhar(agora = false) {
    if (agora) { cancelAnimationFrame(this.raf); this.raf = 0; this.pintar(); return; }
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.pintar(); });
  }

  pintar() {
    if (!this.W) return;
    const ctx = this.ctx, T = this.tema, dpr = this.dpr;
    const g = this.medir();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = T.fundo;
    ctx.fillRect(0, 0, this.W, this.H);
    if (this.folha.especial) { this.pintarCabecalhos(g); return; }
    // quatro regiões: canto congelado, linhas congeladas, colunas congeladas, área principal
    const regioes = [];
    const cx = g.hw, cy = g.hh;
    if (g.fr && g.fc) regioes.push({ x: cx, y: cy, w: g.fw, h: g.fh, r0: 0, r1: g.fr - 1, c0: 0, c1: g.fc - 1 });
    if (g.fr) regioes.push({ x: cx + g.fw, y: cy, w: this.W - cx - g.fw, h: g.fh, r0: 0, r1: g.fr - 1, c0: g.c0, c1: g.c1 });
    if (g.fc) regioes.push({ x: cx, y: cy + g.fh, w: g.fw, h: this.H - cy - g.fh, r0: g.r0, r1: g.r1, c0: 0, c1: g.fc - 1 });
    regioes.push({ x: cx + g.fw, y: cy + g.fh, w: this.W - cx - g.fw, h: this.H - cy - g.fh, r0: g.r0, r1: g.r1, c0: g.c0, c1: g.c1 });
    for (const reg of regioes) {
      if (reg.w <= 0 || reg.h <= 0) continue;
      ctx.save();
      ctx.beginPath(); ctx.rect(reg.x, reg.y, reg.w, reg.h); ctx.clip();
      this.pintarRegiao(reg);
      ctx.restore();
    }
    // linhas dos painéis congelados
    ctx.fillStyle = T.fraco;
    if (g.fr) ctx.fillRect(0, Math.round(g.hh + g.fh) - 1, this.W, 1);
    if (g.fc) ctx.fillRect(Math.round(g.hw + g.fw) - 1, 0, 1, this.H);
    this.pintarCabecalhos(g);
  }

  pintarRegiao(reg) {
    const ctx = this.ctx, T = this.tema, f = this.folha, pasta = this.pasta, est = pasta.estilos;
    const lw = this.espessura();
    // 1) linhas de grade
    if (f.grade) {
      ctx.fillStyle = T.grade;
      for (let c = reg.c0; c <= reg.c1 + 1; c++) { if (this.col.tam(c) <= 0 && c <= reg.c1) continue; const x = this.snap(this.x(c)); ctx.fillRect(x - lw, reg.y, lw, reg.h); }
      for (let r = reg.r0; r <= reg.r1 + 1; r++) { if (this.lin.tam(r) <= 0 && r <= reg.r1) continue; const y = this.snap(this.y(r)); ctx.fillRect(reg.x, y - lw, reg.w, lw); }
    }
    // mesclas visíveis
    const mesclas = f.mesclas.filter(m => m.r2 >= reg.r0 && m.r1 <= reg.r1 && m.c2 >= reg.c0 && m.c1 <= reg.c1);
    const coberta = new Set();
    for (const m of mesclas) for (let r = Math.max(m.r1, reg.r0); r <= Math.min(m.r2, reg.r1); r++) for (let c = Math.max(m.c1, reg.c0); c <= Math.min(m.c2, reg.c1); c++) coberta.add(chave(r, c));
    // 2) preenchimentos
    const fundoCel = (r, c, w, hgt, x, y) => {
      const s = f.estilo(r, c);
      const rs = est ? est.render(s) : null;
      if (rs && rs.fundo) { ctx.fillStyle = rs.fundo; ctx.fillRect(x - lw, y - lw, w + lw, hgt + lw); }
    };
    for (let r = reg.r0; r <= reg.r1; r++) {
      const hgt = this.lin.tam(r); if (hgt <= 0) continue;
      const y = this.y(r);
      for (let c = reg.c0; c <= reg.c1; c++) {
        const w = this.col.tam(c); if (w <= 0) continue;
        if (coberta.has(chave(r, c))) continue;
        fundoCel(r, c, w, hgt, this.x(c), y);
      }
    }
    for (const m of mesclas) {
      const rt = this.retangulo(m.r1, m.c1);
      const rs = est ? est.render(f.estilo(m.r1, m.c1)) : null;
      ctx.fillStyle = rs && rs.fundo ? rs.fundo : T.fundo;
      ctx.fillRect(rt.x, rt.y, rt.w - lw, rt.h - lw);
      if (rs && rs.fundo) ctx.fillRect(rt.x - lw, rt.y - lw, rt.w + lw, rt.h + lw);
    }
    // 3) textos
    const cIni = Math.max(0, reg.c0 - 12);
    for (let r = reg.r0; r <= reg.r1; r++) {
      const hgt = this.lin.tam(r); if (hgt <= 0) continue;
      for (let c = cIni; c <= reg.c1; c++) {
        if (coberta.has(chave(r, c))) continue;
        if (c < reg.c0) { const cel = f.celulas.get(chave(r, c)); if (!cel) continue; }
        this.pintarTexto(r, c, reg, null);
      }
    }
    for (const m of mesclas) this.pintarTexto(m.r1, m.c1, reg, m);
    // 4) bordas
    if (est) {
      for (let r = reg.r0; r <= reg.r1; r++) {
        if (this.lin.tam(r) <= 0) continue;
        for (let c = reg.c0; c <= reg.c1; c++) {
          if (this.col.tam(c) <= 0) continue;
          const k = chave(r, c);
          const cel = f.celulas.get(k);
          const s = cel ? cel.s : f.estiloNovo(r, c);
          if (!s) continue;
          const rs = est.render(s);
          if (rs.bordas) this.pintarBordas(rs.bordas, this.retangulo(r, c, false));
        }
      }
    }
    // 5) sobreposições: realce de referências, cópia, seleção
    this.pintarSobreposicoes();
  }

  espessura() { return Math.max(1, Math.round(this.dpr * 0.75)) / this.dpr; }
  snap(v) { return Math.round(v * this.dpr) / this.dpr; }

  pintarTexto(r, c, reg, m) {
    const f = this.folha, pasta = this.pasta, ctx = this.ctx;
    const e = pasta.exibir(f, r, c);
    if (!e || e.texto === "") return;
    const cel = f.celulas.get(chave(r, c));
    const s = cel ? cel.s : f.estiloNovo(r, c);
    const rs = pasta.estilos ? pasta.estilos.render(s) : null;
    const z = this.escala;
    const px = (rs ? rs.tam : 11) * 4 / 3 * z;
    ctx.font = `${rs && rs.i ? "italic " : ""}${rs && rs.b ? "bold " : ""}${px.toFixed(2)}px ${rs ? rs.familia : "Calibri, Carlito, sans-serif"}`;
    let x0, w, y0, hgt;
    if (m) { const rt = this.retangulo(r, c); x0 = rt.x; y0 = rt.y; w = rt.w; hgt = rt.h; }
    else { x0 = this.x(c); y0 = this.y(r); w = this.col.tam(c); hgt = this.lin.tam(r); }
    if (w <= 0) return;
    let cor = e.cor || (rs && rs.corTexto) || (rs && rs.fundo ? "#000000" : this.tema.texto);
    if (e.cor && this.tema.escuro && !(rs && rs.fundo) && e.cor === "#000000") cor = this.tema.texto;
    ctx.fillStyle = cor;
    const pad = 3 * z;
    let alinhar = rs && rs.h && rs.h !== "general" ? rs.h : e.alinhar || "left";
    if (alinhar === "fill" || alinhar === "justify" || alinhar === "distributed") alinhar = "left";
    if (alinhar === "centerContinuous") alinhar = "center";
    const recuo = rs && rs.recuo ? rs.recuo * 9 * z : 0;
    const quebra = rs && rs.quebra && !e.numero;
    const vAlin = rs ? rs.v : "bottom";
    let texto = e.texto;
    // números que não cabem: tenta menos casas, senão ###
    if (e.numero && !e.esquerda) {
      let larg = ctx.measureText(texto).width;
      if (larg > w - 2 * pad) {
        const v = pasta.valor(f, r, c);
        if (typeof v === "number" && (!rs || /^general$/i.test(rs.formato))) {
          for (let n = 10; n >= 1 && larg > w - 2 * pad; n--) { texto = formatoGeral(v, n); larg = ctx.measureText(texto).width; }
        }
        if (larg > w - 2 * pad) { const lh = ctx.measureText("#").width || 6; texto = "#".repeat(Math.max(1, Math.floor((w - 2 * pad) / lh))); }
      }
    }
    const linhas = quebra ? this.quebrarLinhas(texto, w - 2 * pad - recuo) : texto.includes("\n") ? texto.split("\n") : [texto];
    const alturaLinha = px * 1.22;
    const totalAlt = linhas.length * alturaLinha;
    let yBase;
    if (vAlin === "top") yBase = y0 + 2 * z + px * 0.95;
    else if (vAlin === "center" || vAlin === "distributed" || vAlin === "justify") yBase = y0 + (hgt - totalAlt) / 2 + px * 0.95;
    else yBase = y0 + hgt - totalAlt - 2 * z + px * 0.95 + (alturaLinha - px) * 0.2;
    // área de recorte: célula, ou células vizinhas vazias (texto que transborda)
    let cx0 = x0, cx1 = x0 + w;
    const largTexto = linhas.length === 1 ? ctx.measureText(texto).width + 2 * pad + recuo : 0;
    if (!quebra && !m && linhas.length === 1 && !e.numero && largTexto > w && typeof pasta.valor(f, r, c) === "string") {
      if (alinhar === "left" || alinhar === "center") { let cc = c + 1; while (cx1 - x0 < largTexto * (alinhar === "center" ? 0.5 : 1) + (alinhar === "center" ? w / 2 : 0) && cc <= reg.c1 + 1 && cc < MAX_COLUNAS && this.vazia(r, cc)) { cx1 += this.col.tam(cc); cc++; } }
      if (alinhar === "right" || alinhar === "center") { let cc = c - 1; while (x0 - cx0 < largTexto * (alinhar === "center" ? 0.5 : 1) && cc >= 0 && this.vazia(r, cc)) { cx0 -= this.col.tam(cc); cc--; } }
    }
    // texto transbordando: esconde as linhas de grade das células vizinhas vazias (como o Excel)
    if (cx1 > x0 + w || cx0 < x0) {
      const lw = this.espessura(), est = pasta.estilos;
      const fundoDe = cc => { const rs2 = est ? est.render(f.estilo(r, cc)) : null; return rs2 && rs2.fundo ? rs2.fundo : this.tema.fundo; };
      let xx = x0 + w;
      for (let cc = c + 1; xx < cx1 - 0.5; cc++) { const wc = this.col.tam(cc); ctx.fillStyle = fundoDe(cc); ctx.fillRect(xx - lw, y0, wc, hgt - lw); xx += wc; }
      xx = x0;
      for (let cc = c - 1; xx > cx0 + 0.5 && cc >= 0; cc--) { const wc = this.col.tam(cc); ctx.fillStyle = fundoDe(cc); ctx.fillRect(xx - wc, y0, wc, hgt - lw); xx -= wc; }
      ctx.fillStyle = cor;
    }
    ctx.save();
    ctx.beginPath(); ctx.rect(cx0, y0, cx1 - cx0 - 1, hgt); ctx.clip();
    if (e.esquerda != null) {
      // formato contábil: símbolo à esquerda, número à direita
      ctx.textAlign = "left"; ctx.fillText(e.esquerda.replace(/\s+$/, ""), x0 + pad, yBase);
      ctx.textAlign = "right"; ctx.fillText(e.direita.replace(/^\s+/, ""), x0 + w - pad, yBase);
    } else {
      linhas.forEach((l, i) => {
        const yy = yBase + i * alturaLinha;
        let xx;
        if (alinhar === "right") { ctx.textAlign = "right"; xx = x0 + w - pad - recuo; }
        else if (alinhar === "center") { ctx.textAlign = "center"; xx = x0 + w / 2; }
        else { ctx.textAlign = "left"; xx = x0 + pad + recuo; }
        ctx.fillText(l, xx, yy);
        if (rs && (rs.u || rs.s)) {
          const lt = ctx.measureText(l).width;
          const xi = alinhar === "right" ? xx - lt : alinhar === "center" ? xx - lt / 2 : xx;
          ctx.fillRect(xi, rs.u ? yy + Math.max(1, px * 0.1) : yy - px * 0.3, lt, Math.max(1, px / 14));
        }
      });
    }
    ctx.restore();
  }
  vazia(r, c) {
    if (this.folha.mesclaEm(r, c)) return false;
    const cel = this.folha.celulas.get(chave(r, c));
    if (!cel) return true;
    const v = this.pasta.valor(this.folha, r, c);
    return v === null || v === undefined || v === "";
  }
  quebrarLinhas(texto, larg) {
    const out = [];
    for (const par of texto.split("\n")) {
      const palavras = par.split(/(\s+)/);
      let atual = "";
      for (const p of palavras) {
        const t = atual + p;
        if (atual && this.ctx.measureText(t).width > larg) { out.push(atual.trimEnd()); atual = p.trimStart(); }
        else atual = t;
      }
      out.push(atual);
    }
    return out;
  }

  pintarBordas(b, rt) {
    const ctx = this.ctx;
    const lado = (def, x, y, w, hgt, horizontal) => {
      ctx.fillStyle = def.cor; ctx.strokeStyle = def.cor;
      const bw = def.w;
      if (def.duplo) {
        if (horizontal) { ctx.fillRect(x, y - 1, w, 1); ctx.fillRect(x, y + 1, w, 1); }
        else { ctx.fillRect(x - 1, y, 1, hgt); ctx.fillRect(x + 1, y, 1, hgt); }
        return;
      }
      if (def.dash) {
        ctx.save(); ctx.lineWidth = bw; ctx.setLineDash(def.dash); ctx.beginPath();
        if (horizontal) { ctx.moveTo(x, y + 0.5 - (bw > 1 ? 0 : 0)); ctx.lineTo(x + w, y + 0.5); }
        else { ctx.moveTo(x + 0.5, y); ctx.lineTo(x + 0.5, y + hgt); }
        ctx.stroke(); ctx.restore();
        return;
      }
      const off = Math.floor((bw - 1) / 2);
      if (horizontal) ctx.fillRect(x - off, y - off, w + 2 * off + 1, bw);
      else ctx.fillRect(x - off, y - off, bw, hgt + 2 * off + 1);
    };
    const x = this.snap(rt.x), y = this.snap(rt.y), x2 = this.snap(rt.x + rt.w), y2 = this.snap(rt.y + rt.h);
    if (b.t) lado(b.t, x - 1, y - 1, x2 - x, 0, true);
    if (b.b) lado(b.b, x - 1, y2 - 1, x2 - x, 0, true);
    if (b.l) lado(b.l, x - 1, y - 1, 0, y2 - y, false);
    if (b.r) lado(b.r, x2 - 1, y - 1, 0, y2 - y, false);
  }

  retanguloArea(a) {
    const x1 = this.x(a.c1), y1 = this.y(a.r1);
    const x2 = this.x(Math.min(a.c2, this.extC + 5) + 1), y2 = this.y(Math.min(a.r2, this.extR + 5) + 1);
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }

  pintarSobreposicoes() {
    const ctx = this.ctx, T = this.tema;
    // referências da fórmula em edição
    if (this.ed && this.ed.refs) {
      this.ed.refs.forEach((ref, i) => {
        if (ref.folha ? ref.folha.toLocaleLowerCase("pt-BR") !== this.folha.nome.toLocaleLowerCase("pt-BR") : this.folha !== this.ed.folha) return;
        const rt = this.retanguloArea(ref);
        const cor = CORES_REF[i % CORES_REF.length];
        ctx.fillStyle = cor + "1f"; ctx.fillRect(rt.x, rt.y, rt.w, rt.h);
        ctx.strokeStyle = cor; ctx.lineWidth = 2; ctx.setLineDash(this.ed.apontar && i === this.ed.indiceApontado ? [4, 3] : []);
        ctx.strokeRect(rt.x + 0.5, rt.y + 0.5, rt.w - 2, rt.h - 2); ctx.setLineDash([]);
      });
    }
    // área copiada
    if (this.copia && this.copia.folha === this.folha) {
      const rt = this.retanguloArea(this.copia.g);
      ctx.save(); ctx.strokeStyle = T.acento; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]);
      ctx.strokeRect(rt.x + 0.5, rt.y + 0.5, rt.w - 2, rt.h - 2); ctx.restore();
    }
    // realce de busca
    if (this.realce && this.realce.folha === this.folha) {
      const rt = this.retangulo(this.realce.r, this.realce.c);
      ctx.fillStyle = "rgba(255, 208, 0, 0.35)"; ctx.fillRect(rt.x, rt.y, rt.w - 1, rt.h - 1);
    }
    if (this.ed && this.ed.folha !== this.folha) return;
    const a = this.area();
    const rt = this.retanguloArea(a);
    const at = this.retangulo(this.sel.ativa.r, this.sel.ativa.c);
    const umaCelula = a.r1 === a.r2 && a.c1 === a.c2 || (at.m && at.m.r1 === a.r1 && at.m.r2 === a.r2 && at.m.c1 === a.c1 && at.m.c2 === a.c2);
    if (!umaCelula) {
      ctx.fillStyle = T.acentoFundo;
      ctx.beginPath();
      ctx.rect(rt.x, rt.y, rt.w, rt.h);
      ctx.rect(at.x + at.w, at.y, -at.w, at.h); // recorta a célula ativa
      ctx.fill("evenodd");
    }
    // preenchimento em andamento
    if (this.arrasto && this.arrasto.tipo === "preencher" && this.arrasto.destino) {
      const d = this.retanguloArea(this.arrasto.destino);
      ctx.save(); ctx.strokeStyle = T.textoCab; ctx.setLineDash([3, 2]); ctx.lineWidth = 1; ctx.strokeRect(d.x + 0.5, d.y + 0.5, d.w - 1, d.h - 1); ctx.restore();
    }
    ctx.strokeStyle = T.acento; ctx.lineWidth = 2;
    ctx.strokeRect(rt.x + 0.5, rt.y + 0.5, rt.w - 2, rt.h - 2);
    if (!umaCelula) { ctx.lineWidth = 1; ctx.strokeRect(at.x + 1.5, at.y + 1.5, at.w - 4, at.h - 4); }
    // alça de preenchimento
    if (!this.mobile && !this.somenteLeitura && !this.ed && this.sel.tipo !== "tudo") {
      ctx.fillStyle = T.acento;
      ctx.fillRect(rt.x + rt.w - 4, rt.y + rt.h - 4, 6, 6);
      ctx.fillStyle = T.fundo;
      ctx.fillRect(rt.x + rt.w - 5, rt.y + rt.h - 5, 1, 7); ctx.fillRect(rt.x + rt.w - 5, rt.y + rt.h - 5, 7, 1);
    }
  }

  pintarCabecalhos(g) {
    const ctx = this.ctx, T = this.tema;
    const hw = g.hw, hh = g.hh;
    const a = this.area();
    const tudo = this.sel.tipo === "tudo";
    const colsInteiras = a.r1 === 0 && a.r2 >= MAX_LINHAS - 1, linsInteiras = a.c1 === 0 && a.c2 >= MAX_COLUNAS - 1;
    const lw = this.espessura();
    const fonte = `${this.mobile ? 12 : 11.5}px ${T.fonte}`;
    // colunas
    ctx.save();
    ctx.fillStyle = T.cab; ctx.fillRect(hw, 0, this.W - hw, hh);
    ctx.beginPath(); ctx.rect(hw, 0, this.W - hw, hh); ctx.clip();
    ctx.font = fonte; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const colunas = [];
    for (let c = 0; c < g.fc; c++) colunas.push(c);
    for (let c = g.c0; c <= g.c1; c++) colunas.push(c);
    for (const c of colunas) {
      const w = this.col.tam(c); if (w <= 0) continue;
      const x = this.x(c);
      if (c < g.fc ? false : x + w < hw + g.fw) continue;
      const selc = c >= a.c1 && c <= a.c2 && !this.folha.especial;
      if (selc) { ctx.fillStyle = colsInteiras || tudo ? T.acentoCabForte : T.acentoCab; ctx.fillRect(x, 0, w, hh); }
      ctx.fillStyle = T.borda; ctx.fillRect(this.snap(x + w) - lw, 0, lw, hh);
      ctx.fillStyle = selc ? T.texto : T.textoCab;
      if (w > 8) ctx.fillText(letraColuna(c), x + w / 2, hh / 2 + 0.5);
      if (selc) { ctx.fillStyle = T.acento; ctx.fillRect(x, hh - 2, w, 2); }
    }
    ctx.restore();
    // linhas
    ctx.save();
    ctx.fillStyle = T.cab; ctx.fillRect(0, hh, hw, this.H - hh);
    ctx.beginPath(); ctx.rect(0, hh, hw, this.H - hh); ctx.clip();
    ctx.font = fonte; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    const linhas = [];
    for (let r = 0; r < g.fr; r++) linhas.push(r);
    for (let r = g.r0; r <= g.r1; r++) linhas.push(r);
    for (const r of linhas) {
      const hgt = this.lin.tam(r); if (hgt <= 0) continue;
      const y = this.y(r);
      if (r >= g.fr && y + hgt < hh + g.fh) continue;
      const selr = r >= a.r1 && r <= a.r2 && !this.folha.especial;
      if (selr) { ctx.fillStyle = linsInteiras || tudo ? T.acentoCabForte : T.acentoCab; ctx.fillRect(0, y, hw, hgt); }
      ctx.fillStyle = T.borda; ctx.fillRect(0, this.snap(y + hgt) - lw, hw, lw);
      ctx.fillStyle = selr ? T.texto : T.textoCab;
      if (hgt > 8) ctx.fillText(String(r + 1), hw - 7, y + hgt / 2 + 0.5);
      if (selr) { ctx.fillStyle = T.acento; ctx.fillRect(hw - 2, y, 2, hgt); }
    }
    ctx.restore();
    // canto
    ctx.fillStyle = T.cab; ctx.fillRect(0, 0, hw, hh);
    ctx.fillStyle = tudo ? T.acento : T.fraco;
    ctx.beginPath(); ctx.moveTo(hw - 4, 5); ctx.lineTo(hw - 4, hh - 4); ctx.lineTo(hw - hh + 5, hh - 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = T.borda;
    ctx.fillRect(0, this.snap(hh) - lw, this.W, lw);
    ctx.fillRect(this.snap(hw) - lw, 0, lw, this.H);
  }

  // ============================================================ eventos
  ligarEventos() {
    const s = this.scroller;
    s.addEventListener("scroll", () => {
      const g = this.medir();
      // cresce a área rolável perto do fim (como o Excel)
      if (s.scrollTop + s.clientHeight > s.scrollHeight - s.clientHeight * 0.5 && this.extR < MAX_LINHAS) { this.extR = Math.min(MAX_LINHAS, this.extR + Math.max(50, g.r1 - g.r0) * 2); this.atualizarExtensao(); }
      if (s.scrollLeft + s.clientWidth > s.scrollWidth - s.clientWidth * 0.5 && this.extC < MAX_COLUNAS) { this.extC = Math.min(MAX_COLUNAS, this.extC + Math.max(10, g.c1 - g.c0) * 2); this.atualizarExtensao(); }
      this.posicionarEditor();
      this.desenhar(true);
    }, { passive: true });
    s.addEventListener("pointerdown", e => this.aoApertar(e));
    s.addEventListener("pointermove", e => this.aoMover(e));
    s.addEventListener("pointerup", e => this.aoSoltar(e));
    s.addEventListener("pointercancel", () => this.fimArrasto());
    s.addEventListener("dblclick", e => this.aoDuploClique(e));
    s.addEventListener("contextmenu", e => this.aoMenu(e));
    s.addEventListener("wheel", e => { if (e.ctrlKey) { e.preventDefault(); this.definirZoom(this.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)); } }, { passive: false });
    // pinça (celular)
    let pinca = null;
    s.addEventListener("touchstart", e => { if (e.touches.length === 2) { const [a, b] = e.touches; pinca = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: this.zoom }; } }, { passive: true });
    s.addEventListener("touchmove", e => { if (pinca && e.touches.length === 2) { e.preventDefault(); const [a, b] = e.touches; const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); this.definirZoom(pinca.z * d / pinca.d); } }, { passive: false });
    s.addEventListener("touchend", e => { if (e.touches.length < 2) pinca = null; }, { passive: true });
    // alça de seleção no celular
    this.alca.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); this.alca.setPointerCapture(e.pointerId); this.arrasto = { tipo: "alca" }; });
    this.alca.addEventListener("pointermove", e => { if (this.arrasto?.tipo !== "alca") return; const p = this.ponto(e); const cel = this.celulaEm(p.x, p.y); this.sel.foco = cel; this.mudouSelecao(); });
    this.alca.addEventListener("pointerup", () => { this.arrasto = null; });
    // editor
    const ta = this.ta;
    ta.addEventListener("keydown", e => this.aoTeclar(e));
    ta.addEventListener("input", () => this.aoDigitar("celula"));
    ta.addEventListener("compositionstart", () => { if (!this.ed) this.iniciarEdicao({ modo: "entrar", texto: null, compondo: true }); });
    ta.addEventListener("copy", e => this.aoCopiar(e, false));
    ta.addEventListener("cut", e => this.aoCopiar(e, true));
    ta.addEventListener("paste", e => this.aoColar(e));
    ta.addEventListener("keyup", () => { if (this.ed) this.atualizarAjudas(); });
    ta.addEventListener("click", () => { if (this.ed) this.atualizarAjudas(); });
    ta.addEventListener("blur", () => { this.lista.classList.add("is-hidden"); });
    if (this.barra) {
      const b = this.barra;
      b.addEventListener("focus", () => {
        if (this.somenteLeitura || this.folha.especial) return;
        if (!this.ed) this.iniciarEdicao({ modo: "editar", origem: "barra", focar: false });
        else this.ed.origem = "barra";
      });
      b.addEventListener("input", () => this.aoDigitar("barra"));
      b.addEventListener("keydown", e => this.aoTeclar(e, true));
      b.addEventListener("keyup", () => this.ed && this.atualizarAjudas());
      b.addEventListener("click", () => this.ed && this.atualizarAjudas());
      b.addEventListener("paste", e => { if (!this.ed) e.preventDefault(); });
    }
    this.lista.addEventListener("mousedown", e => { e.preventDefault(); const it = e.target.closest(".sheet-autocomplete-item"); if (it) this.aceitarSugestao(+it.dataset.i); });
  }

  focar() { if (this.ed && this.ed.origem === "barra") this.barra?.focus({ preventScroll: true }); else this.ta.focus({ preventScroll: true }); }

  areaDoPonto(p) {
    const g = this.g || this.medir();
    if (p.x < g.hw && p.y < g.hh) return "canto";
    if (p.y < g.hh) return "coluna";
    if (p.x < g.hw) return "linha";
    return "celula";
  }

  /** borda de coluna/linha próxima (para redimensionar) */
  bordaProxima(p, tipo) {
    const g = this.g || this.medir();
    const tol = this.mobile ? 8 : 4;
    if (tipo === "coluna") {
      const { c } = this.celulaEm(p.x, g.hh + 1);
      const x2 = this.x(c) + this.col.tam(c);
      if (Math.abs(p.x - x2) <= tol) return { eixo: "col", i: c };
      if (Math.abs(p.x - this.x(c)) <= tol && c > 0) { let k = c - 1; while (k > 0 && this.col.tam(k) <= 0) k--; return { eixo: "col", i: k }; }
    } else if (tipo === "linha") {
      const { r } = this.celulaEm(g.hw + 1, p.y);
      const y2 = this.y(r) + this.lin.tam(r);
      if (Math.abs(p.y - y2) <= tol) return { eixo: "lin", i: r };
      if (Math.abs(p.y - this.y(r)) <= tol && r > 0) { let k = r - 1; while (k > 0 && this.lin.tam(k) <= 0) k--; return { eixo: "lin", i: k }; }
    }
    return null;
  }

  naAlca(p) {
    if (this.mobile || this.somenteLeitura || this.ed) return false;
    const rt = this.retanguloArea(this.area());
    return Math.abs(p.x - (rt.x + rt.w - 1)) <= 5 && Math.abs(p.y - (rt.y + rt.h - 1)) <= 5;
  }

  aoApertar(e) {
    if (e.target !== this.scroller && e.target !== this.spacer) return;
    const p = this.ponto(e);
    // clique na barra de rolagem
    if (p.x > this.W || p.y > this.H) return;
    if (e.pointerType === "touch") { this.toque = { x: e.clientX, y: e.clientY, t: Date.now(), p }; return; }
    if (e.button === 2) { // botão direito: seleciona se clicou fora da seleção
      const tipo = this.areaDoPonto(p);
      if (tipo === "celula") { const cel = this.celulaEm(p.x, p.y); const a = this.area(); if (!(cel.r >= a.r1 && cel.r <= a.r2 && cel.c >= a.c1 && cel.c <= a.c2)) { this.confirmarSeEditando(); this.selecionar(cel.r, cel.c, { rolar: false }); } }
      else if (tipo === "coluna") { const { c } = this.celulaEm(p.x, this.g.hh + 1); const a = this.area(); if (!(a.r1 === 0 && a.r2 >= MAX_LINHAS - 1 && c >= a.c1 && c <= a.c2)) this.selecionarColunas(c, c); }
      else if (tipo === "linha") { const { r } = this.celulaEm(this.g.hw + 1, p.y); const a = this.area(); if (!(a.c1 === 0 && a.c2 >= MAX_COLUNAS - 1 && r >= a.r1 && r <= a.r2)) this.selecionarLinhas(r, r); }
      return;
    }
    if (e.button !== 0) return;
    e.preventDefault();
    const tipo = this.areaDoPonto(p);
    if (tipo === "coluna" || tipo === "linha") {
      const b = !this.somenteLeitura && this.bordaProxima(p, tipo);
      if (b) { this.iniciarRedimensionar(e, b); return; }
    }
    // modo de apontar: clique insere referência na fórmula
    if (this.ed && tipo === "celula" && this.podeApontarAgora()) {
      const cel = this.celulaEm(p.x, p.y);
      this.apontar(cel, cel);
      this.scroller.setPointerCapture(e.pointerId);
      this.arrasto = { tipo: "apontar", inicio: cel };
      return;
    }
    if (tipo === "celula" && this.naAlca(p)) {
      this.scroller.setPointerCapture(e.pointerId);
      this.arrasto = { tipo: "preencher", origem: this.area(), destino: null };
      return;
    }
    this.confirmarSeEditando();
    if (this.ed) return; // fórmula com erro: continua editando
    if (tipo === "canto") { this.selecionarTudo(); this.focar(); return; }
    this.scroller.setPointerCapture(e.pointerId);
    if (tipo === "coluna") {
      const { c } = this.celulaEm(p.x, this.g.hh + 1);
      if (e.shiftKey) this.selecionarColunas(this.sel.ancora.c, c); else this.selecionarColunas(c, c);
      this.arrasto = { tipo: "colunas", inicio: e.shiftKey ? this.sel.ancora.c : c };
    } else if (tipo === "linha") {
      const { r } = this.celulaEm(this.g.hw + 1, p.y);
      if (e.shiftKey) this.selecionarLinhas(this.sel.ancora.r, r); else this.selecionarLinhas(r, r);
      this.arrasto = { tipo: "linhas", inicio: e.shiftKey ? this.sel.ancora.r : r };
    } else {
      const cel = this.celulaEm(p.x, p.y);
      this.selecionar(cel.r, cel.c, { estender: e.shiftKey, rolar: false });
      this.arrasto = { tipo: "celulas" };
    }
    this.focar();
  }

  selecionarColunas(c1, c2) { this.sel = { ancora: { r: 0, c: c1 }, foco: { r: MAX_LINHAS - 1, c: c2 }, ativa: { r: this.g ? Math.max(this.g.r0, 0) : 0, c: Math.min(c1, c2) }, tipo: "colunas" }; this.sel.ativa.r = this.lin.indice(this.g ? this.g.baseY + this.g.sy : 0); this.mudouSelecao(); }
  selecionarLinhas(r1, r2) { this.sel = { ancora: { r: r1, c: 0 }, foco: { r: r2, c: MAX_COLUNAS - 1 }, ativa: { r: Math.min(r1, r2), c: this.col.indice(this.g ? this.g.baseX + this.g.sx : 0) }, tipo: "linhas" }; this.mudouSelecao(); }

  aoMover(e) {
    const p = this.ponto(e);
    if (e.pointerType === "touch") return;
    if (!this.arrasto) {
      const tipo = this.areaDoPonto(p);
      let cursor = "cell";
      if (tipo === "coluna") cursor = !this.somenteLeitura && this.bordaProxima(p, tipo) ? "col-resize" : "s-resize";
      else if (tipo === "linha") cursor = !this.somenteLeitura && this.bordaProxima(p, tipo) ? "row-resize" : "e-resize";
      else if (tipo === "canto") cursor = "default";
      else if (this.naAlca(p)) cursor = "crosshair";
      else if (this.ed && this.podeApontarAgora()) cursor = "copy";
      this.scroller.style.cursor = cursor;
      return;
    }
    this.ultimoPonto = p;
    this.arrastar(p);
    this.iniciarAutoRolagem();
  }

  arrastar(p) {
    const a = this.arrasto;
    if (!a) return;
    const g = this.g;
    const px = Math.max(g.hw + 1, Math.min(this.W - 1, p.x)), py = Math.max(g.hh + 1, Math.min(this.H - 1, p.y));
    const cel = this.celulaEm(px, py);
    if (a.tipo === "celulas") { if (cel.r !== this.sel.foco.r || cel.c !== this.sel.foco.c) { this.sel.foco = cel; this.mudouSelecao(); } }
    else if (a.tipo === "colunas") { const c = this.celulaEm(px, g.hh + 1).c; this.selecionarColunas(a.inicio, c); }
    else if (a.tipo === "linhas") { const r = this.celulaEm(g.hw + 1, py).r; this.selecionarLinhas(a.inicio, r); }
    else if (a.tipo === "apontar") this.apontar(a.inicio, cel);
    else if (a.tipo === "preencher") {
      const o = a.origem;
      let d = null;
      const abaixo = cel.r - o.r2, acima = o.r1 - cel.r, direita = cel.c - o.c2, esquerda = o.c1 - cel.c;
      const mx = Math.max(abaixo, acima, direita, esquerda);
      if (mx > 0) {
        if (mx === abaixo) d = { ...o, r2: cel.r };
        else if (mx === acima) d = { ...o, r1: cel.r };
        else if (mx === direita) d = { ...o, c2: cel.c };
        else d = { ...o, c1: cel.c };
      }
      a.destino = d;
      this.desenhar();
    }
  }

  iniciarAutoRolagem() {
    if (this.autoRolagem) return;
    this.autoRolagem = setInterval(() => {
      const p = this.ultimoPonto;
      if (!this.arrasto || !p || !["celulas", "colunas", "linhas", "apontar", "preencher"].includes(this.arrasto.tipo)) { clearInterval(this.autoRolagem); this.autoRolagem = null; return; }
      const g = this.g; let dx = 0, dy = 0;
      if (p.x > this.W - 10) dx = 30; else if (p.x < g.hw + g.fw && this.arrasto.tipo !== "linhas") dx = -30;
      if (p.y > this.H - 10) dy = 30; else if (p.y < g.hh + g.fh && this.arrasto.tipo !== "colunas") dy = -30;
      if (dx || dy) { this.scroller.scrollLeft += dx; this.scroller.scrollTop += dy; this.medir(); this.arrastar(p); }
    }, 50);
  }

  aoSoltar(e) {
    if (e.pointerType === "touch" && this.toque) {
      const t = this.toque; this.toque = null;
      if (Math.hypot(e.clientX - t.x, e.clientY - t.y) > 10 || Date.now() - t.t > 600) return;
      this.tocar(t.p);
      return;
    }
    const a = this.arrasto;
    if (a && a.tipo === "preencher" && a.destino) {
      const destino = a.destino;
      this.arrasto = null;
      this.emit("preencher", { origem: a.origem, destino });
    }
    this.fimArrasto();
  }
  fimArrasto() { this.arrasto = null; clearInterval(this.autoRolagem); this.autoRolagem = null; this.desenhar(); }

  /** toque (celular): seleciona; tocar de novo na célula ativa ou duplo toque edita */
  tocar(p) {
    const tipo = this.areaDoPonto(p);
    if (this.ed && tipo === "celula" && this.podeApontarAgora()) { const cel = this.celulaEm(p.x, p.y); this.apontar(cel, cel); return; }
    this.confirmarSeEditando();
    if (this.ed) return;
    if (tipo === "canto") { this.selecionarTudo(); return; }
    if (tipo === "coluna") { const { c } = this.celulaEm(p.x, this.g.hh + 1); this.selecionarColunas(c, c); return; }
    if (tipo === "linha") { const { r } = this.celulaEm(this.g.hw + 1, p.y); this.selecionarLinhas(r, r); return; }
    const cel = this.celulaEm(p.x, p.y);
    const agora = Date.now();
    const a = this.sel.ativa;
    const m = this.folha.mesclaEm(cel.r, cel.c);
    const mesma = (m ? m.r1 === a.r && m.c1 === a.c : cel.r === a.r && cel.c === a.c) && !this.sel.tipo;
    const duplo = this.ultimoToque && agora - this.ultimoToque.t < 400 && this.ultimoToque.r === cel.r && this.ultimoToque.c === cel.c;
    this.ultimoToque = { t: agora, r: cel.r, c: cel.c };
    if ((mesma || duplo) && !this.somenteLeitura) { this.selecionar(cel.r, cel.c, { rolar: false }); this.iniciarEdicao({ modo: "editar" }); return; }
    this.selecionar(cel.r, cel.c, { rolar: false });
  }

  aoDuploClique(e) {
    const p = this.ponto(e);
    const tipo = this.areaDoPonto(p);
    if (tipo === "coluna" || tipo === "linha") {
      const b = !this.somenteLeitura && this.bordaProxima(p, tipo);
      if (b) { this.emit("autoajustar", b); }
      return;
    }
    if (tipo !== "celula" || this.somenteLeitura || this.folha.especial) return;
    if (this.ed) return;
    const cel = this.celulaEm(p.x, p.y);
    this.selecionar(cel.r, cel.c, { rolar: false });
    this.iniciarEdicao({ modo: "editar" });
  }

  aoMenu(e) {
    e.preventDefault();
    if (this.ed) return;
    const p = this.ponto(e);
    this.emit("menu", { evento: e, tipo: this.areaDoPonto(p) });
  }

  iniciarRedimensionar(e, b) {
    this.scroller.setPointerCapture(e.pointerId);
    const ini = b.eixo === "col" ? this.x(b.i) : this.y(b.i);
    const guia = this.linhaGuia;
    guia.classList.remove("is-hidden");
    guia.classList.toggle("mod-vertical", b.eixo === "col");
    const mover = ev => {
      const q = this.ponto(ev);
      const pos = b.eixo === "col" ? Math.max(ini, q.x) : Math.max(ini, q.y);
      if (b.eixo === "col") { guia.style.left = pos + "px"; guia.style.top = "0"; }
      else { guia.style.top = pos + "px"; guia.style.left = "0"; }
      guia.dataset.tam = String(pos - ini);
      guia.title = "";
    };
    mover(e);
    const fim = ev => {
      this.scroller.removeEventListener("pointermove", mover);
      this.scroller.removeEventListener("pointerup", fim);
      guia.classList.add("is-hidden");
      const q = this.ponto(ev);
      const tam = Math.max(0, (b.eixo === "col" ? q.x : q.y) - ini);
      this.arrasto = null;
      if (Math.abs(tam - (b.eixo === "col" ? this.col.tam(b.i) : this.lin.tam(b.i))) < 1) return;
      // se a coluna/linha faz parte de uma seleção inteira, aplica a todas
      const a = this.area();
      let i1 = b.i, i2 = b.i;
      if (b.eixo === "col" && a.r1 === 0 && a.r2 >= MAX_LINHAS - 1 && b.i >= a.c1 && b.i <= a.c2) { i1 = a.c1; i2 = a.c2; }
      if (b.eixo === "lin" && a.c1 === 0 && a.c2 >= MAX_COLUNAS - 1 && b.i >= a.r1 && b.i <= a.r2) { i1 = a.r1; i2 = a.r2; }
      this.emit("redimensionar", { eixo: b.eixo, i1, i2, px: tam / this.escala });
    };
    this.arrasto = { tipo: "redimensionar" };
    this.scroller.addEventListener("pointermove", mover);
    this.scroller.addEventListener("pointerup", fim);
  }

  // ============================================================ teclado
  aoTeclar(e, daBarra = false) {
    if (e.isComposing || e.keyCode === 229) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key;
    if (this.ed) { this.teclaEditando(e, ctrl, daBarra); return; }
    if (daBarra) return;
    // atalhos tratados pela visualização (negrito, desfazer, procurar…)
    const atalho = { e, ctrl, k, tratado: false };
    this.emit("atalho", atalho);
    if (atalho.tratado) { e.preventDefault(); return; }
    const sh = e.shiftKey;
    const nav = (dr, dc) => { e.preventDefault(); this.mover(dr, dc, { estender: sh, ctrl }); };
    switch (k) {
      case "ArrowUp": return nav(-1, 0);
      case "ArrowDown": return nav(1, 0);
      case "ArrowLeft": return nav(0, -1);
      case "ArrowRight": return nav(0, 1);
      case "Tab": e.preventDefault(); return this.avancar(0, sh ? -1 : 1);
      case "Enter": e.preventDefault(); if (ctrl) return; return this.avancar(sh ? -1 : 1, 0);
      case "Home": e.preventDefault(); if (ctrl) this.selecionar(this.folha.congelar.linhas || 0, this.folha.congelar.colunas || 0, { estender: sh }); else this.selecionar(this.sel.ativa.r, 0, { estender: sh }); return;
      case "End": {
        e.preventDefault();
        if (ctrl) { this.selecionar(Math.max(0, this.folha.limite.r), Math.max(0, this.folha.limite.c), { estender: sh }); return; }
        let c = this.folha.limite.c; while (c > 0 && !this.temValor(this.sel.ativa.r, c)) c--;
        this.selecionar(this.sel.ativa.r, Math.max(0, c), { estender: sh }); return;
      }
      case "PageDown": e.preventDefault(); return this.pagina(1, e.altKey);
      case "PageUp": e.preventDefault(); return this.pagina(-1, e.altKey);
      case "Escape": if (this.copia) { this.copia = null; this.desenhar(); } this.realce = null; this.emit("esc"); return;
      case "F2": e.preventDefault(); if (!this.somenteLeitura && !this.folha.especial) this.iniciarEdicao({ modo: "editar" }); return;
      case "Delete": e.preventDefault(); if (!this.somenteLeitura) this.emit("apagar"); return;
      case "Backspace": e.preventDefault(); if (!this.somenteLeitura && !this.folha.especial) { this.emit("apagarAtiva"); this.iniciarEdicao({ modo: "entrar", texto: "" }); } return;
      case "ContextMenu": e.preventDefault(); { const rt = this.retangulo(this.sel.ativa.r, this.sel.ativa.c); const b = this.canvas.getBoundingClientRect(); this.emit("menu", { evento: { clientX: b.left + rt.x + rt.w / 2, clientY: b.top + rt.y + rt.h / 2, preventDefault() {} }, tipo: "celula" }); } return;
      default: break;
    }
    if (k === " " && sh && !ctrl) { e.preventDefault(); this.selecionarLinhas(this.area().r1, this.area().r2); return; }
    if (k === " " && ctrl && !sh) { e.preventDefault(); this.selecionarColunas(this.area().c1, this.area().c2); return; }
    if (ctrl && (k === "a" || k === "A") && !sh) { e.preventDefault(); this.selecionarTudo(); return; }
    if (ctrl && (k === "c" || k === "C" || k === "x" || k === "X")) {
      // garante que o evento "copy" aconteça mesmo sem texto selecionado
      this.ta.value = " "; this.ta.select();
      setTimeout(() => { if (!this.ed) this.ta.value = ""; }, 0);
      return;
    }
    if (ctrl && (k === "v" || k === "V")) { if (this.somenteLeitura) e.preventDefault(); return; }
    if (this.somenteLeitura || this.folha.especial) { if (k.length === 1 && !ctrl) e.preventDefault(); return; }
    // tecla imprimível: começa a editar (o caractere chega pelo evento "input")
  }

  teclaEditando(e, ctrl, daBarra) {
    const k = e.key, sh = e.shiftKey;
    const el = daBarra ? this.barra : this.ta;
    // lista de sugestões de funções
    if (this.sugestoes && this.sugestoes.length && !this.lista.classList.contains("is-hidden")) {
      if (k === "ArrowDown" || k === "ArrowUp") { e.preventDefault(); this.sugIdx = (this.sugIdx + (k === "ArrowDown" ? 1 : -1) + this.sugestoes.length) % this.sugestoes.length; this.sugNavegou = true; this.mostrarSugestoes(); return; }
      if (k === "Tab" || (k === "Enter" && this.sugNavegou && !e.altKey && !ctrl)) { e.preventDefault(); this.aceitarSugestao(this.sugIdx); return; }
      if (k === "Escape") { e.preventDefault(); this.lista.classList.add("is-hidden"); return; }
    }
    if (k === "Escape") { e.preventDefault(); this.cancelarEdicao(); return; }
    if (k === "Enter") {
      if (e.altKey) { e.preventDefault(); this.inserirNoEditor("\n"); return; }
      e.preventDefault();
      if (ctrl) { this.confirmarEdicao({ preencherSelecao: true }); return; }
      this.confirmarEdicao({ dr: sh ? -1 : 1, dc: 0 });
      return;
    }
    if (k === "Tab") { e.preventDefault(); this.confirmarEdicao({ dr: 0, dc: sh ? -1 : 1 }); return; }
    if (k === "F2") { e.preventDefault(); this.ed.modo = this.ed.modo === "entrar" ? "editar" : "entrar"; this.ed.apontar = null; this.emit("edicao"); return; }
    if (k === "F4") {
      e.preventDefault();
      const t = el.value, pos = el.selectionStart;
      if (!t.startsWith("=")) return;
      const r = alternarAbsoluta(t.slice(1), pos - 1);
      if (r) { el.value = "=" + r.texto; el.setSelectionRange(r.fim + 1, r.fim + 1); this.aoDigitar(daBarra ? "barra" : "celula"); }
      return;
    }
    const setas = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (setas[k] && this.ed.modo === "entrar" && !daBarra) {
      e.preventDefault();
      const [dr, dc] = setas[k];
      if (this.podeApontarAgora()) {
        const ap = this.ed.apontar;
        const base = ap ? (sh ? ap.foco : ap.foco) : { r: this.ed.r, c: this.ed.c };
        const novo = { r: Math.max(0, base.r + dr), c: Math.max(0, base.c + dc) };
        if (sh && ap) this.apontar(ap.ancora, novo); else this.apontar(novo, novo);
        return;
      }
      this.confirmarEdicao({ dr, dc });
      return;
    }
    if (ctrl && (k === "z" || k === "Z") && el.value === this.ed.original) { e.preventDefault(); this.cancelarEdicao(); this.emit("atalho", { e, ctrl, k, tratado: false }); return; }
    // ao digitar algo, o próximo clique/seta insere uma nova referência
    if (k.length === 1 || k === "Backspace" || k === "Delete") this.ed.apontar = null;
  }

  inserirNoEditor(txt) {
    const el = this.ed && this.ed.origem === "barra" ? this.barra : this.ta;
    const a = el.selectionStart, b = el.selectionEnd;
    el.value = el.value.slice(0, a) + txt + el.value.slice(b);
    el.setSelectionRange(a + txt.length, a + txt.length);
    this.aoDigitar(this.ed && this.ed.origem === "barra" ? "barra" : "celula");
  }

  // ============================================================ edição
  textoAtual() { return this.ed ? (this.ed.origem === "barra" ? this.barra.value : this.ta.value) : ""; }

  /** opções: modo "entrar" (digitando: setas confirmam) ou "editar" (F2: setas movem o cursor); texto inicial */
  iniciarEdicao({ modo = "editar", texto = null, origem = "celula", focar = true, compondo = false } = {}) {
    if (this.somenteLeitura || this.folha.especial) return;
    const { r, c } = this.sel.ativa;
    const original = this.pasta.textoEdicao(this.folha, r, c);
    const cel = this.folha.cel(r, c);
    if (cel && (cel.parte != null || (cel.mat && lerIntervalo(cel.mat) && (lerIntervalo(cel.mat).r1 !== lerIntervalo(cel.mat).r2 || lerIntervalo(cel.mat).c1 !== lerIntervalo(cel.mat).c2)))) {
      this.emit("erro", "Esta célula faz parte de uma fórmula de matriz. Edite-a no Excel.");
      return;
    }
    this.ed = { folha: this.folha, r, c, original, modo, origem, apontar: null, refs: null };
    const inicial = texto != null ? texto : compondo ? this.ta.value : original;
    if (origem === "celula") {
      if (texto != null || !compondo) this.ta.value = inicial;
      this.ta.classList.remove("is-idle");
      if (this.mobile) { this.ta.readOnly = false; this.ta.setAttribute("inputmode", "text"); this.ta.blur(); }
      if (focar) this.ta.focus({ preventScroll: true });
      if (!compondo) { const n = this.ta.value.length; this.ta.setSelectionRange(n, n); }
    }
    if (this.barra && origem !== "barra") this.barra.value = this.ta.value;
    this.copia = null;
    this.posicionarEditor();
    this.atualizarAjudas();
    this.emit("edicao");
    this.desenhar();
  }

  aoDigitar(origem) {
    if (!this.ed) {
      if (origem === "barra") return;
      if (this.somenteLeitura || this.folha.especial) { this.ta.value = ""; return; }
      // digitou com a célula selecionada: substitui o conteúdo
      const t = this.ta.value;
      this.iniciarEdicao({ modo: "entrar", texto: t });
      return;
    }
    if (origem === "barra") { this.ed.origem = "barra"; this.ta.value = this.barra.value; }
    else if (this.barra) this.barra.value = this.ta.value;
    this.posicionarEditor();
    this.atualizarAjudas();
    this.emit("digitando");
  }

  confirmarSeEditando() { if (this.ed) this.confirmarEdicao({ dr: 0, dc: 0, mover: false }); }

  confirmarEdicao({ dr = 1, dc = 0, preencherSelecao = false, mover = true } = {}) {
    const ed = this.ed;
    if (!ed) return true;
    const texto = this.textoAtual();
    if (texto === ed.original && !preencherSelecao) { this.terminarEdicao(); if (mover && (dr || dc)) { this.voltarParaFolha(ed); this.avancar(dr, dc); } return true; }
    if (/^\{=.*\}$/s.test(texto) && texto !== ed.original) { this.emit("erro", "Fórmulas de matriz {=…} só podem ser criadas no Excel."); return false; }
    const r = this.emitirConfirmacao(ed, texto, preencherSelecao);
    if (r && r.erro) { this.emit("erro", r.erro); this.focar(); return false; }
    this.terminarEdicao();
    this.voltarParaFolha(ed);
    if (mover && (dr || dc) && !preencherSelecao) this.avancar(dr, dc);
    return true;
  }
  emitirConfirmacao(ed, texto, preencherSelecao) {
    const pedido = { folha: ed.folha, r: ed.r, c: ed.c, texto, preencherSelecao, area: this.area(), resultado: null };
    this.emit("confirmar", pedido);
    return pedido.resultado;
  }
  voltarParaFolha(ed) { if (ed.folha !== this.folha) { this.emit("trocarFolha", ed.folha); } }

  cancelarEdicao() {
    const ed = this.ed;
    this.terminarEdicao();
    if (ed) this.voltarParaFolha(ed);
    this.desenhar();
  }

  terminarEdicao() {
    this.ed = null;
    this.ta.value = "";
    this.ta.classList.add("is-idle");
    this.lista.classList.add("is-hidden");
    this.dica.classList.add("is-hidden");
    if (this.mobile) { this.ta.readOnly = true; this.ta.setAttribute("inputmode", "none"); }
    this.posicionarEditor();
    this.emit("edicao");
    this.emit("selecao");
    this.desenhar();
    if (document.activeElement === this.barra) this.ta.focus({ preventScroll: true });
  }

  podeApontarAgora() {
    if (!this.ed) return false;
    const el = this.ed.origem === "barra" ? this.barra : this.ta;
    const t = el.value;
    if (!t.startsWith("=")) return false;
    const pos = el.selectionStart;
    if (this.ed.apontar && this.ed.apontar.fim === pos) return true;
    return podeApontar(t, pos);
  }

  /** insere/atualiza a referência apontada (clique, arrasto, setas) */
  apontar(a, b) {
    const ed = this.ed;
    const el = ed.origem === "barra" ? this.barra : this.ta;
    let t = el.value;
    let ini = el.selectionStart;
    if (ed.apontar && ed.apontar.fim === el.selectionStart) ini = ed.apontar.inicio;
    const fim = el.selectionStart;
    const g = this.expandirMesclas({ r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c), r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c) });
    let ref = g.r1 === g.r2 && g.c1 === g.c2 ? nomeCelula(g.r1, g.c1) : nomeIntervalo(g);
    if (this.folha !== ed.folha) ref = citarFolha(this.folha.nome) + "!" + ref;
    t = t.slice(0, ini) + ref + t.slice(fim);
    el.value = t;
    const nf = ini + ref.length;
    el.setSelectionRange(nf, nf);
    ed.apontar = { inicio: ini, fim: nf, ancora: a, foco: b };
    if (el === this.barra) this.ta.value = t; else if (this.barra) this.barra.value = t;
    this.rolarAte(b.r, b.c);
    this.posicionarEditor();
    this.atualizarAjudas();
    this.desenhar();
  }

  /** referências coloridas, sugestões de funções e dica de argumentos */
  atualizarAjudas() {
    const ed = this.ed;
    if (!ed) return;
    const el = ed.origem === "barra" ? this.barra : this.ta;
    const t = el.value;
    if (!t.startsWith("=")) { ed.refs = null; this.lista.classList.add("is-hidden"); this.dica.classList.add("is-hidden"); this.desenhar(); return; }
    try { ed.refs = referenciasDoTexto(t.slice(1)); } catch (err) { ed.refs = null; }
    if (ed.apontar) ed.indiceApontado = (ed.refs || []).findIndex(r => r.inicio + 1 === ed.apontar.inicio);
    // palavra antes do cursor
    const pos = el.selectionStart;
    const antes = t.slice(0, pos);
    const m = /([\p{L}_][\p{L}\p{N}_.]*)$/u.exec(antes);
    let mostrar = false;
    if (m && el.selectionStart === el.selectionEnd && !/["']/.test(contarAspas(antes))) {
      const palavra = m[1];
      const anterior = antes.slice(0, antes.length - palavra.length);
      if (/[=(;,+\-*/^&<> ]$/.test(anterior) && !/^[A-Za-z]{1,3}\d+$/.test(palavra)) {
        if (!FUNCOES) FUNCOES = listaFuncoesPt();
        const P = semAcento(palavra.toUpperCase());
        this.sugestoes = FUNCOES.filter(n => semAcento(n).startsWith(P)).slice(0, 12);
        if (this.sugestoes.length && !(this.sugestoes.length === 1 && this.sugestoes[0] === palavra.toUpperCase())) {
          if (!this.sugPalavra || this.sugPalavra.inicio !== pos - palavra.length) this.sugNavegou = false;
          this.sugIdx = 0; this.sugPalavra = { inicio: pos - palavra.length, fim: pos };
          mostrar = true;
        }
      }
    }
    if (mostrar) this.mostrarSugestoes(); else this.lista.classList.add("is-hidden");
    // dica da função em que o cursor está
    let dicaTxt = null;
    if (!mostrar) {
      try {
        const toks = tokenizar(antes.slice(1), { pt: true });
        const pilha = [];
        for (let i = 0; i < toks.length; i++) {
          const tk = toks[i];
          if (tk.t === "func") pilha.push(tk.raw.toUpperCase());
          else if (tk.t === "abre" && !(toks[i - 1] && toks[i - 1].t === "func")) pilha.push(null);
          else if (tk.t === "fecha") pilha.pop();
        }
        const f = pilha.reverse().find(Boolean);
        if (f && DICAS[f]) dicaTxt = DICAS[f];
      } catch (err) { /* ignora */ }
    }
    if (dicaTxt) { this.dica.textContent = dicaTxt; this.dica.classList.remove("is-hidden"); this.posicionarAjudas(); }
    else this.dica.classList.add("is-hidden");
    this.desenhar();
  }

  mostrarSugestoes() {
    this.lista.replaceChildren(...this.sugestoes.map((n, i) => h("div.sheet-autocomplete-item" + (i === this.sugIdx ? ".is-selected" : ""), { dataset: { i: String(i) } },
      h("span.sheet-autocomplete-name", { text: n }), DICAS[n] ? h("span.sheet-autocomplete-desc", { text: DICAS[n].replace(/^[^—]*—\s*/, "") }) : null)));
    this.lista.classList.remove("is-hidden");
    this.posicionarAjudas();
    this.lista.children[this.sugIdx]?.scrollIntoView({ block: "nearest" });
  }
  aceitarSugestao(i) {
    const n = this.sugestoes?.[i];
    if (!n || !this.ed) return;
    const el = this.ed.origem === "barra" ? this.barra : this.ta;
    const { inicio, fim } = this.sugPalavra;
    const t = el.value;
    const depois = t.slice(fim);
    const ins = n + (depois.startsWith("(") ? "" : "(");
    el.value = t.slice(0, inicio) + ins + depois;
    const p = inicio + ins.length;
    el.setSelectionRange(p, p);
    this.lista.classList.add("is-hidden");
    this.aoDigitar(this.ed.origem === "barra" ? "barra" : "celula");
    el.focus({ preventScroll: true });
  }
  posicionarAjudas() {
    const alvo = this.ed && this.ed.origem === "barra" && this.barra ? this.barra : this.ta;
    const b = alvo.getBoundingClientRect(), base = this.el.getBoundingClientRect();
    let x = b.left - base.left, y = b.bottom - base.top + 2;
    if (alvo === this.barra) { x = Math.max(0, b.left - base.left); y = 0; }
    for (const el of [this.lista, this.dica]) {
      el.style.left = Math.max(0, Math.min(x, this.W - 280)) + "px";
      el.style.top = Math.max(0, Math.min(y, this.H - 40)) + "px";
    }
    if (!this.lista.classList.contains("is-hidden")) this.dica.style.top = (parseFloat(this.lista.style.top) + this.lista.offsetHeight + 2) + "px";
  }

  /** coloca o editor sobre a célula ativa (invisível quando não está editando) */
  posicionarEditor() {
    if (!this.W) return;
    this.medir();
    const ed = this.ed;
    const r = ed ? ed.r : this.sel.ativa.r, c = ed ? ed.c : this.sel.ativa.c;
    const ta = this.ta;
    const fora = ed && ed.folha !== this.folha;
    let rt = this.retangulo(r, c);
    const g = this.g;
    // mantém dentro da área visível (para não rolar a página ao focar)
    const x = Math.max(g.hw, Math.min(rt.x, this.W - 20)), y = Math.max(g.hh, Math.min(rt.y, this.H - 20));
    if (!ed) {
      ta.style.left = x + "px"; ta.style.top = y + "px"; ta.style.width = Math.max(10, Math.min(rt.w, this.W - x)) + "px"; ta.style.height = Math.max(10, Math.min(rt.h, this.H - y)) + "px";
      ta.style.font = ""; ta.style.color = ""; ta.style.background = "";
    } else {
      const s = this.folha.estilo(r, c);
      const rs = this.pasta.estilos ? this.pasta.estilos.render(s) : null;
      const px = (rs ? rs.tam : 11) * 4 / 3 * this.escala;
      ta.style.font = `${rs && rs.i ? "italic " : ""}${rs && rs.b ? "bold " : ""}${px.toFixed(2)}px ${rs ? rs.familia : "Calibri, Carlito, sans-serif"}`;
      ta.style.lineHeight = (px * 1.22).toFixed(1) + "px";
      ta.style.color = rs && rs.corTexto ? rs.corTexto : rs && rs.fundo ? "#000000" : "";
      ta.style.background = rs && rs.fundo ? rs.fundo : "";
      ta.style.left = rt.x + "px"; ta.style.top = rt.y + "px";
      this.medidor.font = ta.style.font;
      const linhas = ta.value.split("\n");
      const largTexto = Math.max(...linhas.map(l => this.medidor.measureText(l).width)) + 12;
      const maxW = Math.max(rt.w, this.W - rt.x - 4);
      const w = Math.min(maxW, Math.max(rt.w, largTexto));
      ta.style.width = w + "px";
      const alt = Math.max(rt.h, linhas.length * px * 1.22 + 6);
      ta.style.height = Math.min(alt, this.H - rt.y - 2) + "px";
      ta.classList.toggle("is-offscreen", fora || rt.x + 4 > this.W || rt.y + 4 > this.H || rt.x + rt.w < g.hw || rt.y + rt.h < g.hh);
    }
    // alça de seleção do celular
    if (this.mobile && !ed && !this.somenteLeitura) {
      const a = this.retanguloArea(this.area());
      const hx = a.x + a.w, hy = a.y + a.h;
      const visivel = hx > g.hw && hy > g.hh && hx < this.W && hy < this.H;
      this.alca.classList.toggle("is-hidden", !visivel);
      this.alca.style.left = hx + "px"; this.alca.style.top = hy + "px";
    } else this.alca.classList.add("is-hidden");
  }

  // ============================================================ área de transferência
  aoCopiar(e, recortar) {
    if (this.ed) return; // copiar texto dentro do editor
    e.preventDefault();
    this.emit("copiar", { evento: e, recortar });
  }
  aoColar(e) {
    if (this.ed) return;
    e.preventDefault();
    if (this.somenteLeitura || this.folha.especial) return;
    this.emit("colar", { evento: e });
  }
}

function contarAspas(s) { const n = (s.match(/"/g) || []).length; return n % 2 ? '"' : ""; }
