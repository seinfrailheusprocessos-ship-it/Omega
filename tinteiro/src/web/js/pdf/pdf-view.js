// Editor de PDF: visualizar (pdf.js), anotar, inserir texto, assinar, organizar páginas e salvar (pdf-lib).
// build "legacy": funciona também em navegadores/WebView um pouco mais antigos (Chrome 110+)
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { h, vazio, debounce, modKey } from "../util/dom.js";
import { icon, iconButton } from "../util/icons.js";
import { FileView } from "../views/base.js";
import { basename, dirname, stem, extname } from "../util/path.js";
import { Menu } from "../ui/menu.js";
import { Modal, confirmar } from "../ui/modal.js";
import { notice, erro } from "../ui/notice.js";
import { SuggestModal, fuzzy, linhaSugestao } from "../ui/suggest.js";
import {
  PX_POR_PT, novoId, girar, telaParaPagina, paginaParaTela, limparTexto, ajustarTexto, eixos, pontoDaCaixa, caixaAnot,
  acertou, transladar, simplificar, caminhoSuave, juntarRetangulos, dimensionarCamada, desenharDestaques, desenharAnotacoes, tracoProvisorio,
} from "./anotacoes.js";
import { gerarPdf, examinarBytes } from "./salvar.js";
import { abrirAssinatura, prepararImagem } from "./assinatura.js";

const urlVendor = p => new URL("vendor/pdfjs/" + p, document.baseURI).href;
pdfjs.GlobalWorkerOptions.workerSrc = urlVendor("pdf.worker.min.mjs");
const OPCOES_PDFJS = () => ({
  cMapUrl: urlVendor("cmaps/"), cMapPacked: true, standardFontDataUrl: urlVendor("standard_fonts/"), wasmUrl: urlVendor("wasm/"),
  isEvalSupported: false, enableXfa: false,
});

const ZOOMS = [25, 33, 50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200, 250, 300, 400, 500];
const CORES_TINTA = [["#1b2a6b", "Azul-escuro"], ["#111111", "Preto"], ["#0b57d0", "Azul"], ["#d92d20", "Vermelho"], ["#15803d", "Verde"], ["#7c3aed", "Roxo"], ["#ea580c", "Laranja"], ["#ffffff", "Branco"]];
const CORES_DESTAQUE = [["#ffd400", "Amarelo"], ["#7ee081", "Verde"], ["#7cc4ff", "Azul"], ["#ff9ecf", "Rosa"], ["#ffb067", "Laranja"]];
const ESPESSURAS = [0.75, 1.5, 2, 3, 5, 8];
const TAMANHOS = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64];
const FERRAMENTAS = [
  ["selecionar", "pointer", "Selecionar e mover"],
  ["destaque", "highlighter", "Marca-texto"],
  ["caneta", "pen", "Caneta (desenho livre)"],
  ["retangulo", "square", "Retângulo"],
  ["texto", "type", "Inserir texto"],
  ["assinatura", "signature", "Assinar"],
  ["imagem", "image", "Inserir imagem ou carimbo"],
  ["borracha", "eraser", "Borracha (apaga anotações)"],
];
const DICAS = {
  destaque: "Marca-texto: selecione o texto com o mouse (ou arraste sobre uma área).",
  caneta: "Caneta: desenhe sobre a página. Para rolar com o dedo, use dois dedos.",
  retangulo: "Retângulo: arraste sobre a página para desenhar uma caixa.",
  texto: "Texto: clique (ou toque) onde quer escrever.",
  borracha: "Borracha: clique ou passe sobre uma anotação para apagá-la.",
};
const PADRAO = {
  caneta: { cor: "#1b2a6b", esp: 2 }, retangulo: { cor: "#d92d20", esp: 2 }, destaque: { cor: "#ffd400" }, texto: { cor: "#111111", tam: 12 },
  miniaturas: true,
};
const CHAVE_OPCOES = "tinteiro.pdf.opcoes";

const norm = g => ((g % 360) + 360) % 360;
const px = n => `calc(var(--scale-factor) * ${Math.round(n * 100) / 100}px)`;
const limitar = (v, a, b) => Math.max(a, Math.min(b, v));
function dobrarChar(c) {
  const d = c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (d.length === c.length) return d;
  const l = c.toLowerCase();
  return l.length === c.length ? l : c;
}
function dobrar(s) { let o = ""; for (const c of s) o += dobrarChar(c); return o; }
function faixaTexto(nums) {
  const ord = [...nums].sort((a, b) => a - b), out = [];
  for (let i = 0; i < ord.length; i++) {
    let j = i;
    while (j + 1 < ord.length && ord[j + 1] === ord[j] + 1) j++;
    out.push(j > i ? `${ord[i]}-${ord[j]}` : String(ord[i]));
    i = j;
  }
  return out.join(", ");
}
/** "1-3, 5" → [0,1,2,4] (null se inválido) */
function lerFaixas(txt, n) {
  const t = String(txt || "").trim();
  if (!t || /^tod/i.test(t)) return [...Array(n).keys()];
  const out = [];
  for (const parte of t.split(/[,;]+/)) {
    const m = /^\s*(\d+)\s*(?:[-–a]\s*(\d+))?\s*$/i.exec(parte);
    if (!m) return null;
    const a = +m[1], b = m[2] ? +m[2] : a;
    if (a < 1 || b < 1 || a > n || b > n) return null;
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) out.push(i - 1);
  }
  return out.length ? out : null;
}
/** bolinha de cor (a variável CSS precisa de setProperty) */
export function bolinha(cor, nome, ativa, onclick) {
  const b = h("button.pdf-cor-bolinha" + (ativa ? ".is-active" : ""), { type: "button", title: nome, "aria-label": "Cor " + nome, onclick });
  b.style.setProperty("--cor", cor);
  return b;
}
/** libera um documento do pdf.js (na versão 6 isso é feito pela tarefa de carregamento) */
function destruir(doc) {
  try { return Promise.resolve(doc?.loadingTask ? doc.loadingTask.destroy() : doc?.destroy?.()).catch(() => {}); }
  catch (e) { return Promise.resolve(); }
}
function carregarOpcoes() {
  try { const o = JSON.parse(localStorage.getItem(CHAVE_OPCOES) || "{}"); return { ...structuredClone(PADRAO), ...o, caneta: { ...PADRAO.caneta, ...o.caneta }, retangulo: { ...PADRAO.retangulo, ...o.retangulo }, destaque: { ...PADRAO.destaque, ...o.destaque }, texto: { ...PADRAO.texto, ...o.texto } }; }
  catch (e) { return structuredClone(PADRAO); }
}

export class PdfView extends FileView {
  getViewType() { return "pdf"; }
  getIcon() { return "file-text"; }
  getState() { return { ...super.getState(), ...(this.paginas?.length ? { pagina: this.atual + 1 } : {}) }; }
  async setState(s) { if (s?.pagina > 1 && this.paginas?.length) requestAnimationFrame(() => this.irParaPagina(Math.min(this.paginas.length, s.pagina) - 1, { suave: false })); }

  // =================================================================== abrir
  async onLoadFile(dados) {
    this.fechado = false;
    this.senhaCancelada = false;
    this.ro = !!this.somenteLeitura;
    this.mobile = !!this.app.isMobile;
    this.fontes = []; this.paginas = []; this.imagens = new Map();
    this.est = new Map(); this.minis = new Map(); this.pdfPaginas = new Map(); this.textos = new Map();
    this.escala = PX_POR_PT; this.escalaRender = PX_POR_PT; this.modoZoom = "largura";
    this.ferramenta = "selecionar"; this.sel = null; this.editando = null; this.acao = null;
    this.desfazerPilha = []; this.refazerPilha = []; this.seqRev = 0; this.rev = 0; this.revSalva = 0;
    this.selPaginas = new Set(); this.atual = 0; this.renderizando = 0; this.lru = [];
    this.busca = null; this.buscaSeq = 0; this.sumario = null;
    this.opcoes = carregarOpcoes();
    this.limpezas = [];
    this.montar();
    try { await this.abrirBytes(new Uint8Array(dados)); }
    catch (e) {
      if (this.fechado) return;
      const senha = this.senhaCancelada || e?.name === "PasswordException";
      vazio(this.paginasEl).appendChild(h("div.view-error",
        h("p", { text: senha ? "Este PDF é protegido por senha." : "Não foi possível abrir este PDF." }),
        h("p.u-muted", { text: senha ? "A senha não foi informada." : (e.message || String(e)) }),
        senha ? h("button.mod-cta", { text: "Digitar a senha", onclick: () => this.recarregar() }) : null));
      if (!senha) console.error(e);
    }
  }

  async abrirBytes(bytes, { manterPosicao = null } = {}) {
    const { protegido, assinado } = examinarBytes(bytes);
    const fonte = await this.carregarFonte(bytes, basename(this.file.path));
    if (this.fechado) { destruir(fonte.doc); return; }
    // libera o documento anterior (depois de salvar ele é recarregado a partir do arquivo novo)
    for (const st of this.est.values()) this.descartarPagina(st);
    for (const m of this.minis.values()) { m.el.remove(); this.obsMini?.unobserve(m.el); }
    this.est.clear(); this.minis.clear();
    for (const f of this.fontes) destruir(f.doc);
    this.pdfPaginas = new Map([...this.pdfPaginas].filter(([k]) => k.startsWith(fonte.id + ":")));
    this.textos.clear(); this.lru = [];
    // as anotações já foram gravadas no arquivo: as imagens em memória não são mais usadas
    for (const im of this.imagens.values()) URL.revokeObjectURL(im.url);
    this.imagens.clear();
    this.fontes = [fonte];
    this.bloqueado = !this.ro && (protegido || fonte.senha);
    this.assinadoDigital = assinado; this.avisouAssinado = false;
    this.paginas = fonte.infos.map((_, i) => ({ uid: novoId("p"), fonte: fonte.id, indice: i, rot: 0, anots: [] }));
    this.desfazerPilha = []; this.refazerPilha = [];
    this.rev = this.revSalva = ++this.seqRev;
    this.sel = null; this.editando = null; this.selPaginas.clear();
    this.atual = Math.min(manterPosicao?.pagina || 0, this.paginas.length - 1);
    this.raiz.classList.toggle("is-readonly", this.ro || this.bloqueado);
    if (this.bloqueado) { this.ro = true; notice("Este PDF é protegido por senha. Ele pode ser lido e impresso, mas não alterado aqui.", { tempo: 7000 }); }
    if (this.modoZoom) this.escala = this.escalaRender = this.calcularAjuste(this.modoZoom);
    this.paginasEl.style.setProperty("--scale-factor", this.escala);
    this.sincronizar();
    this.atualizarBarra();
    if (manterPosicao) requestAnimationFrame(() => { this.rolagem.scrollTop = manterPosicao.top; this.rolagem.scrollLeft = manterPosicao.left; });
    this.carregarSumario();
    if (this.busca?.termo) this.buscar(this.busca.termo, { pular: false });
    this.app.atualizarStatus();
  }

  pedirSenha(motivo) {
    return new Promise(res => {
      const m = new Modal({ titulo: "PDF protegido por senha" });
      const inp = h("input", { type: "password", placeholder: "Senha", autocomplete: "current-password", style: { width: "100%" } });
      m.contentEl.append(h("p", { text: motivo === pdfjs.PasswordResponses.INCORRECT_PASSWORD ? "Senha incorreta. Tente de novo." : "Este arquivo pede uma senha para abrir." }), h("form", { onsubmit: e => e.preventDefault() }, inp));
      let feito = false;
      const fim = v => { if (!feito) { feito = true; res(v); m.close(); } };
      m.aoFechar.push(() => fim(null));
      inp.addEventListener("keydown", e => { if (e.key === "Enter") fim(inp.value); });
      m.botoes([{ texto: "Cancelar", acao: () => fim(null) }, { texto: "Abrir", cta: true, acao: () => fim(inp.value) }]);
      m.open();
      setTimeout(() => inp.focus(), 30);
    });
  }

  async carregarFonte(bytes, nome) {
    const tarefa = pdfjs.getDocument({ data: bytes.slice(), ...OPCOES_PDFJS() });
    let senha = false;
    tarefa.onPassword = (atualizar, motivo) => {
      senha = true;
      this.pedirSenha(motivo).then(s => { if (s == null) { this.senhaCancelada = true; tarefa.destroy(); } else atualizar(s); });
    };
    const doc = await tarefa.promise;
    const id = novoId("f");
    const infos = await Promise.all(Array.from({ length: doc.numPages }, (_, i) => doc.getPage(i + 1).then(pg => {
      this.pdfPaginas.set(`${id}:${i}`, Promise.resolve(pg));
      return { view: pg.view.slice(), rotate: norm(pg.rotate || 0) };
    })));
    return { id, nome, bytes, doc, infos, senha };
  }

  fonte(id) { return this.fontes.find(f => f.id === id); }
  info(p) { return this.fonte(p.fonte).infos[p.indice]; }
  geo(p) {
    const inf = this.info(p);
    const W = inf.view[2] - inf.view[0], H = inf.view[3] - inf.view[1], R = norm(inf.rotate + (p.rot || 0));
    return { W, H, R, dw: R % 180 ? H : W, dh: R % 180 ? W : H, view: inf.view };
  }
  paginaPdf(p) {
    const k = `${p.fonte}:${p.indice}`;
    if (!this.pdfPaginas.has(k)) this.pdfPaginas.set(k, this.fonte(p.fonte).doc.getPage(p.indice + 1));
    return this.pdfPaginas.get(k);
  }
  porUid(uid) { return this.paginas.find(p => p.uid === uid); }

  // =================================================================== interface
  montar() {
    const ro = this.ro;
    this.contentEl.classList.add("pdf-view-content");
    this.raiz = h("div.pdf-view" + (this.mobile ? ".is-mobile" : "") + (ro ? ".is-readonly" : ""));
    this.raiz.dataset.ferramenta = this.ferramenta;
    this.paginasEl = h("div.pdf-paginas");
    this.rolagem = h("div.pdf-rolagem", { tabindex: "0", "aria-label": "Páginas do PDF" }, this.paginasEl);
    this.miniPainel = this.criarPainelMiniaturas();
    this.buscaEl = this.criarBusca();
    this.corpo = h("div.pdf-corpo", this.miniPainel, this.miniFundo, this.rolagem, this.buscaEl);
    this.raiz.append(this.criarBarra(), this.corpo);
    if (this.mobile && !ro) this.raiz.appendChild(h("div.pdf-barra-inferior.pdf-so-edicao", this.criarFerramentas()));
    this.contentEl.appendChild(this.raiz);
    this.alternarMiniaturas(this.mobile ? false : this.opcoes.miniaturas !== false, { guardar: false });

    // observadores
    this.obs = new IntersectionObserver(ents => {
      for (const e of ents) { const st = this.est.get(e.target.dataset.uid); if (st) st.visivel = e.isIntersecting; }
      this.agendarRender();
    }, { root: this.rolagem, rootMargin: "300px 0px" });
    this.obsMini = new IntersectionObserver(ents => {
      for (const e of ents) { const m = this.minis.get(e.target.dataset.uid); if (m) m.visivel = e.isIntersecting; }
      this.agendarRender();
    }, { root: this.miniLista, rootMargin: "200px 0px" });
    const ajustar = debounce(() => { if (this.modoZoom && this.paginas.length) this.definirZoom(this.calcularAjuste(this.modoZoom), { modo: this.modoZoom }); }, 80);
    this.obsTamanho = new ResizeObserver(() => { ajustar(); this.medirBarra(); });
    this.obsTamanho.observe(this.rolagem);
    this.obsTamanho.observe(this.raiz);

    // eventos
    this.rolagem.addEventListener("scroll", () => {
      if (this._rafScroll) return;
      this._rafScroll = requestAnimationFrame(() => { this._rafScroll = 0; this.aoRolar(); });
    }, { passive: true });
    this.rolagem.addEventListener("wheel", e => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const k = Math.exp(-limitar(e.deltaY, -60, 60) * (e.deltaMode === 1 ? 0.05 : 0.0035));
      this.definirZoom(this.escala * k, { foco: e });
    }, { passive: false });
    this.rolagem.addEventListener("pointerdown", e => this.aoPressionar(e));
    this.rolagem.addEventListener("dblclick", e => this.aoDuploClique(e));
    this.rolagem.addEventListener("contextmenu", e => this.aoMenuContexto(e));
    this.ouvir(window, "pointermove", e => { if (this.acao && e.pointerId === this.acao.pointerId) this.acao.mover(e); });
    this.ouvir(window, "pointerup", e => {
      if (this.acao && e.pointerId === this.acao.pointerId) { const a = this.acao; this.acao = null; a.soltar(e); }
      if (this.destacandoTexto) { this.destacandoTexto = false; setTimeout(() => this.destacarSelecao(), 0); }
    });
    this.ouvir(window, "pointercancel", e => { if (this.acao && e.pointerId === this.acao.pointerId) this.cancelarAcao(); });
    this.ouvir(document, "keydown", e => this.aoTeclar(e));
    this.configurarToque();
    this.configurarSoltarArquivos();
  }

  ouvir(alvo, ev, fn, opts) { alvo.addEventListener(ev, fn, opts); this.limpezas.push(() => alvo.removeEventListener(ev, fn, opts)); }

  botao(ic, titulo, fn, classe = "") { return iconButton(ic, titulo, fn, "clickable-icon pdf-btn" + (classe ? " " + classe : "")); }

  criarBarra() {
    const ro = this.ro, sep = () => h("div.pdf-toolbar-sep");
    this.btnMini = this.botao("sidebar-left", "Mostrar/ocultar miniaturas das páginas", () => this.alternarMiniaturas());
    this.pagInput = h("input.pdf-pagina-input", { type: "text", inputmode: "numeric", "aria-label": "Página atual", title: "Página atual (digite e tecle Enter)", value: "1" });
    this.pagInput.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); const n = parseInt(this.pagInput.value, 10); if (n >= 1) this.irParaPagina(Math.min(n, this.paginas.length) - 1); this.rolagem.focus({ preventScroll: true }); }
      if (e.key === "Escape") { this.pagInput.value = String(this.atual + 1); this.rolagem.focus({ preventScroll: true }); }
    });
    this.pagInput.addEventListener("focus", () => this.pagInput.select());
    this.pagInput.addEventListener("blur", () => { this.pagInput.value = String(this.atual + 1); });
    this.pagTotal = h("span.pdf-pagina-total", { text: "/ 0" });
    const navegacao = h("div.pdf-pagina-nav", this.mobile ? null : this.botao("chevron-left", "Página anterior", () => this.irParaPagina(this.atual - 1)), this.pagInput, this.pagTotal, this.mobile ? null : this.botao("chevron-right", "Próxima página", () => this.irParaPagina(this.atual + 1)));
    this.zoomBtn = h("button.pdf-zoom-valor", { type: "button", title: "Opções de zoom", "aria-label": "Opções de zoom", onclick: e => this.menuZoom(e) }, "100%");
    const zoom = h("div.pdf-zoom", this.botao("zoom-out", "Diminuir zoom (Ctrl −)", () => this.zoomPasso(-1)), this.zoomBtn, this.botao("zoom-in", "Aumentar zoom (Ctrl +)", () => this.zoomPasso(1)));
    this.btnDesfazer = this.botao("undo", "Desfazer (Ctrl+Z)", () => this.desfazer());
    this.btnRefazer = this.botao("redo", "Refazer (Ctrl+Y)", () => this.refazer());
    this.btnSalvar = this.botao("save", "Salvar (Ctrl+S)", () => this.save(), "pdf-btn-salvar pdf-so-edicao");
    const busca = this.botao("search", "Procurar no PDF (Ctrl+F)", () => this.abrirBusca());
    const mais = this.botao("more-horizontal", "Mais opções do PDF", e => this.menuMais(e));
    const paginas = ro ? [] : [
      this.botao("rotate-ccw", "Girar página para a esquerda", () => this.girarPaginas(-90)),
      this.botao("rotate-cw", "Girar página para a direita", () => this.girarPaginas(90)),
      this.botao("trash", "Excluir página", () => this.excluirPaginas()),
      this.botao("merge", "Juntar: inserir páginas de outro PDF", e => this.menuJuntar(e)),
    ];
    const barra = h("div.pdf-toolbar");
    if (this.mobile) {
      barra.append(this.btnMini, navegacao, h("div.pdf-toolbar-espaco"), ro ? null : h("div.pdf-so-edicao.pdf-contents", this.btnDesfazer, this.btnRefazer), busca, mais, ro ? null : this.btnSalvar);
    } else {
      this.ferramentasEl = ro ? null : this.criarFerramentas();
      barra.append(
        h("div.pdf-toolbar-grupo.mod-esquerda", this.btnMini, sep(), zoom, sep(), navegacao),
        this.ferramentasEl ? h("div.pdf-toolbar-grupo.mod-centro.pdf-so-edicao", this.ferramentasEl) : h("div.pdf-toolbar-espaco"),
        h("div.pdf-toolbar-grupo.mod-direita", ro ? null : h("div.pdf-so-edicao.pdf-contents", this.btnDesfazer, this.btnRefazer, sep(), ...paginas, sep()), busca, ro ? null : this.btnSalvar, mais));
    }
    this.barraEl = barra;
    return barra;
  }

  /** ferramentas na mesma linha quando cabem; senão vão para uma segunda linha */
  medirBarra() {
    if (this.mobile || !this.barraEl) return;
    const w = this.raiz.clientWidth;
    if (!w) return;
    this.raiz.classList.remove("is-estreita");
    const b = this.barraEl;
    this.raiz.classList.toggle("is-estreita", b.scrollWidth > b.clientWidth + 1);
    this.raiz.classList.toggle("is-muito-estreita", w < 640);
  }

  criarFerramentas() {
    const g = h("div.pdf-ferramentas", { role: "toolbar", "aria-label": "Ferramentas de edição" });
    this.btnFerr = new Map();
    for (const [id, ic, titulo] of FERRAMENTAS) {
      const b = this.botao(ic, titulo, e => this.escolherFerramenta(id, e), "pdf-ferramenta");
      b.dataset.ferramenta = id;
      this.btnFerr.set(id, b);
      g.appendChild(b);
    }
    this.btnCor = h("div.clickable-icon.pdf-btn.pdf-btn-cor", { role: "button", title: "Cor", "aria-label": "Cor", onclick: e => this.menuCor(e.currentTarget) }, h("span.pdf-cor-amostra"));
    this.btnTam = h("div.clickable-icon.pdf-btn.pdf-btn-tam", { role: "button", title: "Espessura", "aria-label": "Espessura", onclick: e => this.menuTamanho(e.currentTarget) }, h("span.pdf-tam-rotulo"));
    this.opcoesEl = h("div.pdf-opcoes-ferramenta", h("div.pdf-toolbar-sep"), this.btnCor, this.btnTam);
    g.appendChild(this.opcoesEl);
    return g;
  }

  criarPainelMiniaturas() {
    this.miniLista = h("div.pdf-mini-lista", { tabindex: "0", role: "listbox", "aria-label": "Miniaturas das páginas", "aria-multiselectable": "true" });
    this.miniContagem = h("span.pdf-mini-contagem");
    const cab = h("div.pdf-mini-cabecalho", h("span.pdf-mini-titulo", { text: "Páginas" }), this.miniContagem, h("div.pdf-toolbar-espaco"),
      this.ro ? null : this.botao("merge", "Inserir páginas de outro PDF", e => this.menuJuntar(e), "pdf-so-edicao"),
      this.ro ? null : this.botao("scissors", "Extrair páginas para um novo PDF", () => this.extrairPaginas(), "pdf-so-edicao"),
      this.mobile ? this.botao("x", "Fechar", () => this.alternarMiniaturas(false)) : null);
    this.miniDica = this.ro ? null : h("div.pdf-mini-dica.pdf-so-edicao", { text: this.mobile ? "Toque e segure para arrastar" : "Arraste para reordenar" });
    this.miniIndicador = h("div.pdf-mini-indicador.is-hidden");
    this.miniLista.appendChild(this.miniIndicador);
    this.miniLista.addEventListener("touchmove", e => { if (this.arrastoMini && e.cancelable) e.preventDefault(); }, { passive: false });
    this.miniLista.addEventListener("contextmenu", e => e.preventDefault());
    this.miniFundo = this.mobile ? h("div.pdf-mini-fundo", { onclick: () => this.alternarMiniaturas(false) }) : null;
    return h("div.pdf-miniaturas", cab, this.miniLista, this.miniDica);
  }

  criarBusca() {
    this.buscaInput = h("input.pdf-busca-input", { type: "text", placeholder: "Procurar no PDF…", "aria-label": "Procurar no PDF", enterkeyhint: "search", spellcheck: "false", autocomplete: "off" });
    this.buscaInfo = h("span.pdf-busca-info");
    const atrasada = debounce(() => this.buscar(this.buscaInput.value), 250);
    this.buscaInput.addEventListener("input", atrasada);
    this.buscaInput.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); atrasada.cancel(); if (this.busca?.termo !== this.buscaInput.value) this.buscar(this.buscaInput.value); else this.buscaPasso(e.shiftKey ? -1 : 1); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); this.fecharBusca(); }
    });
    return h("div.pdf-busca.is-hidden", { role: "search" }, h("span.pdf-busca-icone", icon("search")), this.buscaInput, this.buscaInfo,
      this.botao("arrow-up", "Resultado anterior (Shift+Enter)", () => this.buscaPasso(-1)),
      this.botao("arrow-down", "Próximo resultado (Enter)", () => this.buscaPasso(1)),
      this.botao("x", "Fechar busca (Esc)", () => this.fecharBusca()));
  }

  alternarMiniaturas(mostrar = !this.miniAberto, { guardar = true } = {}) {
    this.miniAberto = mostrar;
    this.miniPainel.classList.toggle("is-open", mostrar);
    this.miniFundo?.classList.toggle("is-open", mostrar);
    this.btnMini?.classList.toggle("is-active", mostrar);
    if (guardar && !this.mobile) { this.opcoes.miniaturas = mostrar; this.guardarOpcoes(); }
    if (mostrar) requestAnimationFrame(() => { this.minis.get(this.paginas[this.atual]?.uid)?.el.scrollIntoView({ block: "nearest" }); this.agendarRender(); });
  }

  guardarOpcoes() { try { localStorage.setItem(CHAVE_OPCOES, JSON.stringify(this.opcoes)); } catch (e) {} }

  dica(id) {
    if (!DICAS[id]) return;
    let vistas = [];
    try { vistas = JSON.parse(localStorage.getItem("tinteiro.pdf.dicas") || "[]"); } catch (e) {}
    if (vistas.includes(id)) return;
    vistas.push(id);
    try { localStorage.setItem("tinteiro.pdf.dicas", JSON.stringify(vistas)); } catch (e) {}
    this.avisoDica?.hide();
    this.avisoDica = notice(DICAS[id], { tempo: 4500 });
  }

  // =================================================================== páginas (DOM)
  /** deixa o DOM igual ao modelo (ordem, rotação, anotações, miniaturas) */
  sincronizar() {
    const uids = new Set(this.paginas.map(p => p.uid));
    for (const [uid, st] of this.est) if (!uids.has(uid)) { this.descartarPagina(st); this.est.delete(uid); }
    for (const [uid, m] of this.minis) if (!uids.has(uid)) { this.obsMini.unobserve(m.el); m.el.remove(); this.minis.delete(uid); }
    let ant = null, antMini = null;
    this.paginas.forEach((p, i) => {
      let st = this.est.get(p.uid);
      if (!st) { st = this.criarPagina(p); this.est.set(p.uid, st); }
      const esperado = ant ? ant.nextSibling : this.paginasEl.firstChild;
      if (st.el !== esperado) this.paginasEl.insertBefore(st.el, esperado);
      ant = st.el;
      this.geometriaPagina(p, st);
      st.el.setAttribute("aria-label", `Página ${i + 1}`);
      st.el.dataset.numero = String(i + 1);
      this.redesenharAnotacoes(p, { mini: false });
      let m = this.minis.get(p.uid);
      if (!m) { m = this.criarMini(p); this.minis.set(p.uid, m); }
      const espMini = antMini ? antMini.nextSibling : this.miniLista.firstChild;
      if (m.el !== espMini) this.miniLista.insertBefore(m.el, espMini);
      antMini = m.el;
      this.geometriaMini(p, m);
      m.num.textContent = String(i + 1);
      this.desenharMini(p, m);
    });
    this.miniLista.appendChild(this.miniIndicador);
    if (this.sel && !this.porUid(this.sel.uid)?.anots.some(a => a.id === this.sel.id)) this.sel = null;
    for (const uid of [...this.selPaginas]) if (!uids.has(uid)) this.selPaginas.delete(uid);
    this.atual = limitar(this.atual, 0, Math.max(0, this.paginas.length - 1));
    this.miniContagem.textContent = String(this.paginas.length);
    this.atualizarSelecaoMini();
    this.atualizarIndicador();
    this.desenharSelecao();
    this.agendarRender();
    if (this.busca?.termo) this.buscarDepois();
  }

  criarPagina(p) {
    const st = {
      el: h("div.pdf-pagina", { dataset: { uid: p.uid }, role: "region" }),
      canvasBox: h("div.pdf-canvas-box"),
      destaques: h("div.pdf-camada.pdf-camada-destaques"),
      texto: h("div.textLayer"),
      links: h("div.pdf-camada.pdf-camada-links"),
      anot: h("div.pdf-camada.pdf-camada-anotacoes"),
      canvas: null, chave: null, tarefa: null, visivel: false, R: null, textLayer: null,
    };
    st.el.append(st.canvasBox, st.destaques, st.texto, st.links, st.anot);
    this.obs.observe(st.el);
    return st;
  }

  geometriaPagina(p, st) {
    const g = this.geo(p);
    st.el.style.width = px(g.dw); st.el.style.height = px(g.dh);
    if (st.R !== g.R || st.W !== g.W || st.H !== g.H) {
      st.R = g.R; st.W = g.W; st.H = g.H;
      dimensionarCamada(st.destaques, g.W, g.H, g.R);
      dimensionarCamada(st.anot, g.W, g.H, g.R);
      dimensionarCamada(st.links, g.W, g.H, g.R);
      st.textLayer?.cancel(); st.textLayer = null; st.texto.textContent = "";
      st.chave = null; st.el.classList.remove("is-renderizada");
    }
  }

  descartarPagina(st) {
    this.obs?.unobserve(st.el);
    try { st.tarefa?.cancel?.(); } catch (e) {}
    try { st.textLayer?.cancel(); } catch (e) {}
    if (st.canvas) { st.canvas.width = st.canvas.height = 0; }
    st.el.remove();
  }

  criarMini(p) {
    const m = {
      canvasBox: h("div.pdf-canvas-box"),
      dest: h("div.pdf-camada.pdf-camada-destaques"),
      anot: h("div.pdf-camada.pdf-camada-anotacoes"),
      num: h("div.pdf-mini-numero"),
      chave: null, visivel: false,
    };
    m.pag = h("div.pdf-mini-pagina", m.canvasBox, m.dest, m.anot);
    m.el = h("div.pdf-miniatura", { dataset: { uid: p.uid }, role: "option" }, m.pag,
      h("div.pdf-mini-rodape", m.num, this.ro ? null : iconButton("more-vertical", "Opções da página", e => this.menuPagina(e, p.uid), "clickable-icon pdf-mini-mais")));
    m.el.addEventListener("pointerdown", e => this.miniPressionar(e, p.uid));
    m.el.addEventListener("contextmenu", e => { e.preventDefault(); if (!this.ro && !this.arrastoMini && e.pointerType !== "touch") this.menuPagina(e, p.uid); });
    this.obsMini.observe(m.el);
    return m;
  }

  geometriaMini(p, m) {
    const g = this.geo(p);
    const larg = this.mobile ? 128 : 112;
    const s = Math.min(larg / g.dw, (larg * 1.42) / g.dh);
    if (m.s !== s || m.R !== g.R) {
      m.s = s; m.R = g.R;
      m.pag.style.setProperty("--scale-factor", s);
      m.pag.style.width = px(g.dw); m.pag.style.height = px(g.dh);
      dimensionarCamada(m.dest, g.W, g.H, g.R);
      dimensionarCamada(m.anot, g.W, g.H, g.R);
      m.chave = null;
    }
  }

  desenharMini(p, m = this.minis.get(p.uid)) {
    if (!m) return;
    desenharDestaques(m.dest, p.anots);
    desenharAnotacoes(m.anot, p.anots, { imagens: this.imagens });
  }

  // =================================================================== renderização (pdf.js)
  agendarRender() {
    if (this._rafRender || this.fechado) return;
    this._rafRender = requestAnimationFrame(() => { this._rafRender = 0; this.renderizarPendentes(); });
  }

  renderizarPendentes() {
    if (this.fechado) return;
    const pend = [];
    this.paginas.forEach((p, i) => {
      const st = this.est.get(p.uid);
      if (st && st.visivel && !st.tarefa && st.chave !== this.chaveRender(p)) pend.push([Math.abs(i - this.atual), p]);
    });
    pend.sort((a, b) => a[0] - b[0]);
    while (this.renderizando < 2 && pend.length) this.renderizarPagina(pend.shift()[1]);
    if (this.renderizando || pend.length || !this.miniAberto) return;
    // miniaturas só quando as páginas grandes já estão prontas
    const p = this.paginas.find(q => { const m = this.minis.get(q.uid); return m && m.visivel && !m.tarefa && m.chave !== String(this.geo(q).R); });
    if (p) this.renderizarMini(p);
  }

  chaveRender(p) { return `${this.escalaRender.toFixed(4)}|${this.geo(p).R}`; }

  async renderizarPagina(p) {
    const st = this.est.get(p.uid);
    const chave = this.chaveRender(p), g = this.geo(p);
    this.renderizando++;
    st.tarefa = { cancel() {} };
    try {
      const pg = await this.paginaPdf(p);
      if (this.fechado || this.est.get(p.uid) !== st) return;
      const vp = pg.getViewport({ scale: this.escalaRender, rotation: g.R });
      let dpr = Math.min(window.devicePixelRatio || 1, 3);
      const maxPix = this.mobile ? 8e6 : 16e6;
      if (vp.width * vp.height * dpr * dpr > maxPix) dpr = Math.sqrt(maxPix / (vp.width * vp.height));
      const c = document.createElement("canvas");
      c.className = "pdf-canvas";
      c.width = Math.max(1, Math.floor(vp.width * dpr)); c.height = Math.max(1, Math.floor(vp.height * dpr));
      const tarefa = pg.render({ canvas: c, viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined });
      st.tarefa = tarefa;
      await tarefa.promise;
      if (this.fechado || this.est.get(p.uid) !== st) { c.width = c.height = 0; return; }
      if (st.canvas) st.canvas.width = st.canvas.height = 0;
      st.canvasBox.replaceChildren(c);
      st.canvas = c; st.chave = chave;
      st.el.classList.add("is-renderizada");
      this.usar(p.uid);
      await this.camadaTexto(p, st, pg, vp);
      if (!st.linksFeitos) { st.linksFeitos = true; this.camadaLinks(p, st, pg).catch(() => {}); }
      st.el.dataset.renderizada = "1";
    } catch (e) {
      if (e?.name !== "RenderingCancelledException" && !this.fechado) console.error("Falha ao desenhar a página", e);
    } finally {
      if (st.tarefa && st.tarefa.cancel) st.tarefa = null;
      this.renderizando--;
      this.agendarRender();
    }
  }

  /** guarda no máximo ~14 páginas desenhadas na memória */
  usar(uid) {
    this.lru = this.lru.filter(u => u !== uid);
    this.lru.push(uid);
    const lim = this.mobile ? 8 : 14;
    while (this.lru.length > lim) {
      const idx = this.lru.findIndex(u => !this.est.get(u)?.visivel);
      if (idx < 0) break;
      const [velho] = this.lru.splice(idx, 1);
      const st = this.est.get(velho);
      if (!st) continue;
      if (st.canvas) { st.canvas.width = st.canvas.height = 0; st.canvas.remove(); st.canvas = null; }
      st.textLayer?.cancel(); st.textLayer = null; st.texto.textContent = "";
      st.chave = null; st.el.classList.remove("is-renderizada"); delete st.el.dataset.renderizada;
    }
  }

  async camadaTexto(p, st, pg, vp) {
    if (st.textLayer && st.textoR === vp.rotation) { st.textLayer.update({ viewport: vp }); return; }
    try { st.textLayer?.cancel(); } catch (e) {}
    st.texto.textContent = "";
    const t = await this.textoDaPagina(p);
    if (this.fechado || this.est.get(p.uid) !== st) return;
    const tl = new pdfjs.TextLayer({ textContentSource: t.conteudo, container: st.texto, viewport: vp });
    st.textLayer = tl; st.textoR = vp.rotation;
    try { await tl.render(); } catch (e) { if (e?.name !== "AbortException") throw e; return; }
    if (st.textLayer !== tl) return;
    st.texto.appendChild(h("div.endOfContent"));
    st.divsRealcados = [];
    this.aplicarRealces(p, st);
  }

  async camadaLinks(p, st, pg) {
    const anots = await pg.getAnnotations({ intent: "display" });
    const [x0, , , y1] = this.info(p).view;
    for (const a of anots) {
      if (a.subtype !== "Link" || !a.rect) continue;
      const [ax0, ay0, ax1, ay1] = a.rect;
      const el = h("a.pdf-link", { href: a.url || "#", title: a.url || "Ir para o destino", rel: "noopener noreferrer", target: "_blank",
        style: { left: px(Math.min(ax0, ax1) - x0), top: px(y1 - Math.max(ay0, ay1)), width: px(Math.abs(ax1 - ax0)), height: px(Math.abs(ay1 - ay0)) } });
      el.addEventListener("click", ev => {
        ev.preventDefault();
        if (this.ferramenta !== "selecionar") return;
        if (a.url) window.open(a.url, "_blank", "noopener");
        else if (a.dest) this.irParaDestino(this.fonte(p.fonte), a.dest);
      });
      st.links.appendChild(el);
    }
  }

  async renderizarMini(p) {
    const m = this.minis.get(p.uid);
    const chave = String(this.geo(p).R);
    m.tarefa = true;
    try {
      const pg = await this.paginaPdf(p);
      if (this.fechado || this.minis.get(p.uid) !== m) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vp = pg.getViewport({ scale: m.s * dpr, rotation: this.geo(p).R });
      const c = document.createElement("canvas");
      c.className = "pdf-canvas";
      c.width = Math.max(1, Math.floor(vp.width)); c.height = Math.max(1, Math.floor(vp.height));
      await pg.render({ canvas: c, viewport: vp }).promise;
      if (this.fechado || this.minis.get(p.uid) !== m) return;
      m.canvasBox.replaceChildren(c);
      m.chave = chave;
      m.el.classList.add("is-renderizada");
    } catch (e) {
      if (e?.name !== "RenderingCancelledException" && !this.fechado) console.error(e);
    } finally { m.tarefa = false; this.agendarRender(); }
  }

  // =================================================================== rolagem, página atual e zoom
  margem() { return this.mobile ? 8 : 24; }

  aoRolar() {
    if (!this.paginas.length) return;
    const y = this.rolagem.scrollTop + this.rolagem.clientHeight * 0.35;
    let lo = 0, hi = this.paginas.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      const el = this.est.get(this.paginas[mid].uid)?.el;
      if (el && el.offsetTop <= y) lo = mid; else hi = mid - 1;
    }
    if (lo !== this.atual) { this.atual = lo; this.atualizarIndicador(true); }
    this.agendarRender();
  }

  atualizarIndicador(rolarMini = false) {
    const n = this.paginas.length;
    if (document.activeElement !== this.pagInput) this.pagInput.value = n ? String(this.atual + 1) : "0";
    this.pagTotal.textContent = `/ ${n}`;
    this.pagInput.style.width = `${Math.max(2, String(n).length) + 1.2}ch`;
    const uid = this.paginas[this.atual]?.uid;
    for (const [u, m] of this.minis) m.el.classList.toggle("is-active", u === uid);
    if (rolarMini && this.miniAberto && !this.arrastoMini) this.minis.get(uid)?.el.scrollIntoView({ block: "nearest" });
    if (this.estaAtiva()) this.app.atualizarStatus();
  }

  irParaPagina(i, { suave = false, yPagina = null, xPagina = null } = {}) {
    if (!this.paginas.length) return;
    i = limitar(i, 0, this.paginas.length - 1);
    const p = this.paginas[i], st = this.est.get(p.uid);
    if (!st) return;
    let top = st.el.offsetTop - (this.mobile ? 8 : 12), left = this.rolagem.scrollLeft;
    if (yPagina != null) {
      const g = this.geo(p);
      const [dx, dy] = paginaParaTela(xPagina ?? 0, yPagina, g.W, g.H, g.R);
      top = st.el.offsetTop + dy * this.escala - 40;
      if (xPagina != null) left = st.el.offsetLeft + dx * this.escala - 40;
    }
    this.rolagem.scrollTo({ top: Math.max(0, top), left: Math.max(0, left), behavior: suave ? "smooth" : "auto" });
    this.atual = i;
    this.atualizarIndicador(true);
  }

  calcularAjuste(modo) {
    const r = this.rolagem;
    const m = this.margem();
    const larg = Math.max(80, (r.clientWidth || 800) - 2 * m - (this.mobile ? 0 : 4));
    const alt = Math.max(80, (r.clientHeight || 600) - 2 * m);
    if (!this.paginas.length) return PX_POR_PT;
    let s;
    if (modo === "pagina") { const g = this.geo(this.paginas[this.atual] || this.paginas[0]); s = Math.min(larg / g.dw, alt / g.dh); }
    else {
      // no computador: largura mais comum (mediana) — uma página deitada no meio não deixa as outras pequenas;
      // no celular: a página mais larga, para nunca precisar arrastar para os lados
      const ws = this.paginas.map(p => this.geo(p).dw).sort((a, b) => a - b);
      s = larg / (this.mobile ? ws[ws.length - 1] : ws[Math.floor((ws.length - 1) / 2)]);
    }
    return limitar(s, 0.1 * PX_POR_PT, 5 * PX_POR_PT);
  }

  definirZoom(s, { modo = null, foco = null } = {}) {
    s = limitar(s, 0.1 * PX_POR_PT, 5 * PX_POR_PT);
    this.modoZoom = modo;
    if (Math.abs(s - this.escala) < 1e-4) { this.atualizarBarra(); return; }
    const r = this.rolagem, rr = r.getBoundingClientRect();
    const fx = foco ? foco.clientX - rr.left : r.clientWidth / 2;
    // com ponto de foco (roda/pinça) ele fica parado; ao ajustar à tela, fica parado o topo do que se está lendo
    const fy = foco ? foco.clientY - rr.top : modo ? 0 : r.clientHeight * 0.35;
    const cy = r.scrollTop + fy, cx = r.scrollLeft + fx;
    // âncora: página sob o foco e a posição relativa dentro dela
    let ancora = null;
    for (const p of this.paginas) {
      const el = this.est.get(p.uid)?.el;
      if (el && el.offsetTop + el.offsetHeight >= cy) { ancora = { el, fy: (cy - el.offsetTop) / el.offsetHeight, fx: (cx - el.offsetLeft) / Math.max(1, el.offsetWidth) }; break; }
    }
    this.escala = s;
    this.paginasEl.style.setProperty("--scale-factor", s);
    if (ancora) {
      r.scrollTop = ancora.el.offsetTop + ancora.fy * ancora.el.offsetHeight - fy;
      if (r.scrollWidth > r.clientWidth) r.scrollLeft = ancora.el.offsetLeft + ancora.fx * ancora.el.offsetWidth - fx;
    }
    this.atualizarBarra();
    this.posicionarBarraAnot();
    clearTimeout(this._tZoom);
    this._tZoom = setTimeout(() => {
      this.escalaRender = this.escala;
      for (const st of this.est.values()) if (st.tarefa?.cancel && st.chave !== null) { try { st.tarefa.cancel(); } catch (e) {} }
      this.agendarRender();
    }, 140);
    if (this.estaAtiva()) this.app.atualizarStatus();
  }

  zoomPasso(d) {
    const pct = (this.escala / PX_POR_PT) * 100;
    const novo = d > 0 ? ZOOMS.find(z => z > pct + 0.5) ?? 500 : [...ZOOMS].reverse().find(z => z < pct - 0.5) ?? 25;
    this.definirZoom((novo / 100) * PX_POR_PT);
  }

  menuZoom(e) {
    const m = new Menu();
    m.addItem({ title: "Ajustar à largura", icon: "maximize", checked: this.modoZoom === "largura", onClick: () => this.definirZoom(this.calcularAjuste("largura"), { modo: "largura" }) });
    m.addItem({ title: "Página inteira", icon: "minimize", checked: this.modoZoom === "pagina", onClick: () => this.definirZoom(this.calcularAjuste("pagina"), { modo: "pagina" }) });
    m.addSeparator();
    const atual = Math.round((this.escala / PX_POR_PT) * 100);
    for (const z of [50, 75, 100, 125, 150, 200, 300, 400]) m.addItem({ title: z + "%", checked: !this.modoZoom && atual === z, onClick: () => this.definirZoom((z / 100) * PX_POR_PT) });
    if (e?.currentTarget) m.showBelow(e.currentTarget); else m.showAtPosition({ x: 100, y: 100 });
  }

  // =================================================================== barra
  atualizarBarra() {
    if (!this.raiz) return;
    this.zoomBtn.textContent = Math.round((this.escala / PX_POR_PT) * 100) + "%";
    this.raiz.dataset.ferramenta = this.ferramenta;
    for (const [id, b] of this.btnFerr || []) { b.classList.toggle("is-active", id === this.ferramenta); b.setAttribute("aria-pressed", id === this.ferramenta ? "true" : "false"); }
    this.btnDesfazer?.classList.toggle("is-disabled", !this.desfazerPilha.length);
    this.btnRefazer?.classList.toggle("is-disabled", !this.refazerPilha.length);
    this.btnSalvar?.classList.toggle("is-dirty", !!this.dirty);
    // opções (cor/tamanho) da ferramenta ou da anotação selecionada
    const alvo = this.alvoOpcoes();
    if (this.opcoesEl) {
      this.opcoesEl.classList.toggle("is-hidden", !alvo);
      if (alvo) {
        this.btnCor.querySelector(".pdf-cor-amostra").style.background = alvo.cor;
        const temTam = alvo.tam != null || alvo.esp != null;
        this.btnTam.classList.toggle("is-hidden", !temTam || this.mobile);
        this.btnTam.querySelector(".pdf-tam-rotulo").textContent = alvo.tam != null ? `${alvo.tam}` : alvo.esp != null ? `${String(alvo.esp).replace(".", ",")} pt` : "";
        const tt = alvo.tam != null ? "Tamanho da letra" : "Espessura do traço";
        this.btnTam.title = tt; this.btnTam.setAttribute("aria-label", tt);
      }
    }
  }

  /** objeto cujas cores/tamanhos a barra mostra: anotação selecionada ou padrão da ferramenta */
  alvoOpcoes() {
    const a = this.anotSelecionada();
    if (a && a.tipo !== "imagem") return a;
    return { caneta: this.opcoes.caneta, retangulo: this.opcoes.retangulo, destaque: this.opcoes.destaque, texto: this.opcoes.texto }[this.ferramenta] || null;
  }

  menuCor(ancora, alvo = this.alvoOpcoes()) {
    if (!alvo) return;
    const a = this.anotSelecionada();
    const ehDestaque = alvo === this.opcoes.destaque || a?.tipo === "destaque";
    const cores = ehDestaque ? CORES_DESTAQUE : CORES_TINTA;
    this.popover(ancora, fechar => {
      const box = h("div.pdf-popover-opcoes", h("div.pdf-paleta", cores.map(([c, nome]) =>
        bolinha(c, nome, alvo.cor === c, () => { this.aplicarOpcao({ cor: c }); fechar(); }))));
      // no celular a cor e o tamanho ficam juntos (a barra de baixo não tem espaço para os dois)
      if (this.mobile && (alvo.tam != null || alvo.esp != null)) {
        const ehTexto = alvo.tam != null, lista = ehTexto ? TAMANHOS : ESPESSURAS;
        const atual = () => (ehTexto ? alvo.tam : alvo.esp);
        const rot = () => (ehTexto ? `${atual()} pt` : `${String(atual()).replace(".", ",")} pt`);
        const valor = h("span.pdf-popover-valor", { text: rot() });
        const passo = d => {
          const v = atual();
          const novo = d > 0 ? lista.find(t => t > v) ?? v : [...lista].reverse().find(t => t < v) ?? v;
          if (novo !== v) this.aplicarOpcao(ehTexto ? { tam: novo } : { esp: novo });
          valor.textContent = rot();
        };
        box.appendChild(h("div.pdf-popover-tam", h("span.pdf-popover-rotulo", { text: ehTexto ? "Tamanho da letra" : "Espessura" }),
          this.botao("minus", ehTexto ? "Letra menor" : "Traço mais fino", () => passo(-1)), valor, this.botao("plus", ehTexto ? "Letra maior" : "Traço mais grosso", () => passo(1))));
      }
      return box;
    });
  }

  menuTamanho(ancora) {
    const alvo = this.alvoOpcoes();
    if (!alvo) return;
    const ehTexto = alvo.tam != null;
    const lista = ehTexto ? TAMANHOS : ESPESSURAS;
    this.popover(ancora, fechar => h("div.pdf-lista-tam", lista.map(v =>
      h("button.pdf-tam-item" + ((ehTexto ? alvo.tam : alvo.esp) === v ? ".is-active" : ""), { type: "button", onclick: () => { this.aplicarOpcao(ehTexto ? { tam: v } : { esp: v }); fechar(); } },
        ehTexto ? h("span", { text: `${v} pt` }) : [h("span.pdf-tam-traco", { style: { height: Math.max(1, Math.min(10, v * 1.2)) + "px" } }), h("span", { text: `${String(v).replace(".", ",")} pt` })]))));
  }

  /** muda cor/tamanho da anotação selecionada (ou o padrão da ferramenta) */
  aplicarOpcao(mud) {
    const a = this.anotSelecionada();
    if (a && a.tipo !== "imagem") {
      const p = this.porUid(this.sel.uid);
      const ed = this.editando && this.editando.id === a.id;
      if (!ed) this.registrar();
      if (mud.cor) a.cor = mud.cor;
      if (mud.tam != null && a.tipo === "texto") { a.tam = mud.tam; ajustarTexto(a); }
      if (mud.esp != null && a.esp != null) a.esp = mud.esp;
      // a escolha também vira o padrão daquele tipo
      const pad = this.opcoes[a.tipo === "tinta" ? "caneta" : a.tipo];
      if (pad) { if (mud.cor) pad.cor = mud.cor; if (mud.tam != null && pad.tam != null) pad.tam = mud.tam; if (mud.esp != null && pad.esp != null) pad.esp = mud.esp; this.guardarOpcoes(); }
      if (ed) { this.redesenharAnotacoes(p); this.editando.alterado = true; this.focarEditor(); this.atualizarBarra(); }
      else this.alterou([p.uid]);
      return;
    }
    const alvo = this.alvoOpcoes();
    if (!alvo) return;
    Object.assign(alvo, mud);
    this.guardarOpcoes();
    this.atualizarBarra();
  }

  popover(ancora, construir) {
    this.fecharPopover?.();
    const el = h("div.pdf-popover", { role: "dialog" });
    const fechar = () => { el.remove(); document.removeEventListener("pointerdown", fora, true); document.removeEventListener("keydown", tecla, true); if (this.fecharPopover === fechar) this.fecharPopover = null; };
    const fora = e => { if (!el.contains(e.target) && !ancora.contains(e.target)) fechar(); };
    const tecla = e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fechar(); } };
    el.appendChild(construir(fechar));
    document.body.appendChild(el);
    const r = ancora.getBoundingClientRect(), pr = el.getBoundingClientRect();
    const abaixo = r.bottom + pr.height + 8 < window.innerHeight;
    el.style.left = limitar(r.left + r.width / 2 - pr.width / 2, 6, window.innerWidth - pr.width - 6) + "px";
    el.style.top = (abaixo ? r.bottom + 6 : r.top - pr.height - 6) + "px";
    setTimeout(() => { document.addEventListener("pointerdown", fora, true); document.addEventListener("keydown", tecla, true); }, 0);
    this.fecharPopover = fechar;
    return fechar;
  }

  // =================================================================== ferramentas
  escolherFerramenta(id, e) {
    if (this.ro) return;
    if (id === "assinatura") { this.inserirAssinatura(); return; }
    if (id === "imagem") { this.menuImagem(e?.currentTarget || this.btnFerr.get("imagem")); return; }
    this.concluirEdicao();
    if (id === "destaque" && this.destacarSelecao()) { /* destacou o texto que já estava selecionado */ }
    if (id !== "selecionar" && this.sel) this.selecionar(null);
    this.ferramenta = id;
    this.atualizarBarra();
    this.desenharSelecao();
    this.dica(id);
  }

  anotSelecionada() {
    if (!this.sel) return null;
    return this.porUid(this.sel.uid)?.anots.find(a => a.id === this.sel.id) || null;
  }

  selecionar(uid, id) {
    const antes = this.sel ? this.sel.uid : null;
    this.sel = uid ? { uid, id } : null;
    if (antes && antes !== uid) { const p = this.porUid(antes); if (p) this.redesenharAnotacoes(p, { mini: false }); }
    if (uid) this.redesenharAnotacoes(this.porUid(uid), { mini: false });
    this.desenharSelecao();
    this.atualizarBarra();
  }

  /** ponto do evento no espaço da página (sem rotação, pontos) */
  ponto(e, st, p) {
    const g = this.geo(p);
    const r = st.el.getBoundingClientRect();
    const s = r.width / g.dw;
    let [x, y] = telaParaPagina((e.clientX - r.left) / s, (e.clientY - r.top) / s, g.W, g.H, g.R);
    return { x: limitar(x, 0, g.W), y: limitar(y, 0, g.H), s, g };
  }

  anotEm(p, pt, tipo = null) {
    const tol = (this.mobile ? 12 : 5) / pt.s;
    for (let i = p.anots.length - 1; i >= 0; i--) {
      const a = p.anots[i];
      if (tipo && a.tipo !== tipo) continue;
      if (acertou(a, pt.x, pt.y, tol)) return a;
    }
    return null;
  }

  aoPressionar(e) {
    if (this.gesto) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const alvo = e.target;
    if (alvo.closest(".pdf-barra-anot")) return;
    if (this.editando && !alvo.closest(".pdf-anot.is-editing")) {
      this.concluirEdicao();
      if (this.ferramenta === "texto") { e.preventDefault(); return; }
    }
    if (alvo.closest(".pdf-anot.is-editing")) return;
    const pagEl = alvo.closest(".pdf-pagina");
    if (!pagEl || this.ro) { if (this.sel) this.selecionar(null); return; }
    const p = this.porUid(pagEl.dataset.uid), st = this.est.get(p?.uid);
    if (!p || !st) return;
    const pt = this.ponto(e, st, p);
    const alca = alvo.closest(".pdf-alca");
    if (alca) { e.preventDefault(); this.iniciarAlca(e, p, st, alca.dataset.alca, pt); return; }
    if (alvo.closest(".pdf-selecao-caixa") && this.sel?.uid === p.uid) { e.preventDefault(); this.iniciarArrasto(e, p, st, this.anotSelecionada(), pt); return; }
    switch (this.ferramenta) {
      case "selecionar": {
        const a = this.anotEm(p, pt);
        if (!a) { if (this.sel) this.selecionar(null); return; }
        e.preventDefault();
        this.selecionar(p.uid, a.id);
        this.iniciarArrasto(e, p, st, a, pt, { aoClicar: a.tipo === "texto" && e.detail >= 2 ? () => this.editarTexto(p, a) : null });
        return;
      }
      case "texto": {
        const a = this.anotEm(p, pt, "texto");
        if (a) { e.preventDefault(); this.selecionar(p.uid, a.id); this.iniciarArrasto(e, p, st, a, pt, { aoClicar: () => this.editarTexto(p, a) }); return; }
        if (e.pointerType === "touch") {
          // no toque, só cria a caixa num toque simples (arrastar continua rolando a página)
          const x0 = e.clientX, y0 = e.clientY;
          this.acao = { pointerId: e.pointerId, mover: ev => { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 10) this.acao = null; }, soltar: () => this.criarTexto(p, pt), cancelar: () => {} };
          return;
        }
        e.preventDefault();
        this.criarTexto(p, pt);
        return;
      }
      case "caneta": e.preventDefault(); this.iniciarTinta(e, p, st, pt); return;
      case "retangulo": e.preventDefault(); this.iniciarCaixa(e, p, st, pt, "retangulo"); return;
      case "destaque":
        if (e.pointerType !== "touch" && alvo.closest(".textLayer") && alvo.tagName === "SPAN") { this.destacandoTexto = true; return; }
        e.preventDefault(); this.iniciarCaixa(e, p, st, pt, "destaque"); return;
      case "borracha": e.preventDefault(); this.iniciarBorracha(e, p, st, pt); return;
    }
  }

  aoDuploClique(e) {
    if (this.ro || this.ferramenta !== "selecionar") return;
    const pagEl = e.target.closest(".pdf-pagina");
    if (!pagEl) return;
    const p = this.porUid(pagEl.dataset.uid), st = this.est.get(p.uid);
    const a = this.anotEm(p, this.ponto(e, st, p), "texto");
    if (a) { e.preventDefault(); this.editarTexto(p, a); }
  }

  aoMenuContexto(e) {
    const pagEl = e.target.closest(".pdf-pagina");
    if (!pagEl || e.target.closest("textarea")) return;
    if (window.getSelection()?.toString()) return; // deixa o menu normal para copiar
    e.preventDefault();
    const p = this.porUid(pagEl.dataset.uid);
    const i = this.paginas.indexOf(p);
    const m = new Menu();
    const a = this.anotSelecionada();
    if (a && !this.ro) {
      if (a.tipo === "texto") m.addItem({ title: "Editar texto", icon: "pencil", onClick: () => this.editarTexto(this.porUid(this.sel.uid), a) });
      m.addItem({ title: "Excluir anotação", icon: "trash", warning: true, onClick: () => this.excluirSelecionada() });
      m.addSeparator();
    }
    m.addLabel(`Página ${i + 1}`);
    if (!this.ro) this.itensPagina(m, [p]);
    m.addItem({ title: "Procurar no PDF…", icon: "search", onClick: () => this.abrirBusca() });
    m.showAtMouseEvent(e);
  }

  coalescidos(e) { const l = e.getCoalescedEvents ? e.getCoalescedEvents() : null; return l && l.length ? l : [e]; }

  iniciarTinta(e, p, st, pt) {
    const cfg = this.opcoes.caneta;
    const pts = [[pt.x, pt.y]];
    const desenhar = () => tracoProvisorio(st.anot, { d: caminhoSuave(pts), stroke: cfg.cor, "stroke-width": cfg.esp });
    desenhar();
    this.acao = {
      pointerId: e.pointerId,
      mover: ev => {
        for (const c of this.coalescidos(ev)) {
          const q = this.ponto(c, st, p), u = pts[pts.length - 1];
          if (Math.hypot(q.x - u[0], q.y - u[1]) * q.s >= 1.2) pts.push([q.x, q.y]);
        }
        desenhar();
      },
      soltar: () => {
        tracoProvisorio(st.anot, null);
        const pontos = simplificar(pts, 0.35 / Math.max(0.5, pt.s / PX_POR_PT)).map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
        this.registrar();
        p.anots.push({ id: novoId(), tipo: "tinta", pontos, cor: cfg.cor, esp: cfg.esp });
        this.alterou([p.uid]);
      },
      cancelar: () => tracoProvisorio(st.anot, null),
    };
  }

  iniciarCaixa(e, p, st, pt, tipo) {
    const cfg = this.opcoes[tipo];
    const camada = tipo === "destaque" ? st.destaques : st.anot;
    const x0 = pt.x, y0 = pt.y;
    let x1 = x0, y1 = y0;
    const caixa = () => ({ x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) });
    const desenhar = () => {
      const c = caixa();
      tracoProvisorio(camada, tipo === "destaque"
        ? { tag: "rect", x: c.x, y: c.y, width: c.w, height: c.h, fill: cfg.cor, stroke: "none" }
        : { tag: "rect", x: c.x, y: c.y, width: c.w, height: c.h, stroke: cfg.cor, "stroke-width": cfg.esp, fill: "none" });
    };
    desenhar();
    this.acao = {
      pointerId: e.pointerId,
      mover: ev => { const q = this.ponto(ev, st, p); x1 = q.x; y1 = q.y; desenhar(); },
      soltar: () => {
        tracoProvisorio(camada, null);
        let c = caixa();
        const minimo = 4 / pt.s;
        if (c.w < minimo || c.h < minimo) {
          if (tipo === "destaque") return;
          // toque simples: cria uma caixa padrão no lugar
          const g = pt.g, [dw, dh] = g.R % 180 ? [70, 140] : [140, 70];
          c = { x: limitar(x0 - dw / 2, 0, Math.max(0, g.W - dw)), y: limitar(y0 - dh / 2, 0, Math.max(0, g.H - dh)), w: dw, h: dh };
        }
        this.registrar();
        const a = tipo === "destaque" ? { id: novoId(), tipo, rects: [c], cor: cfg.cor } : { id: novoId(), tipo, ...c, cor: cfg.cor, esp: cfg.esp };
        p.anots.push(a);
        this.alterou([p.uid]);
        if (tipo === "retangulo") this.selecionar(p.uid, a.id);
      },
      cancelar: () => tracoProvisorio(camada, null),
    };
  }

  iniciarBorracha(e, p, st, pt) {
    const apagar = new Set();
    const testar = q => {
      const a = this.anotEm(p, q);
      if (a && !apagar.has(a.id)) {
        apagar.add(a.id);
        for (const el of this.raiz.querySelectorAll(`[data-id="${a.id}"]`)) el.classList.add("is-apagando");
      }
    };
    testar(pt);
    this.acao = {
      pointerId: e.pointerId,
      mover: ev => { for (const c of this.coalescidos(ev)) testar(this.ponto(c, st, p)); },
      soltar: () => {
        if (!apagar.size) return;
        this.registrar();
        p.anots = p.anots.filter(a => !apagar.has(a.id));
        if (this.sel && apagar.has(this.sel.id)) this.sel = null;
        this.alterou([p.uid]);
      },
      cancelar: () => { for (const el of this.raiz.querySelectorAll(".is-apagando")) el.classList.remove("is-apagando"); },
    };
  }

  iniciarArrasto(e, p, st, a, pt, { aoClicar = null } = {}) {
    if (!a) return;
    const orig = structuredClone(a), R = pt.g.R, s = pt.s, g = pt.g;
    const x0 = e.clientX, y0 = e.clientY;
    const lim = e.pointerType === "touch" ? 8 : 3;
    let moveu = false;
    this.acao = {
      pointerId: e.pointerId,
      mover: ev => {
        const dxs = ev.clientX - x0, dys = ev.clientY - y0;
        if (!moveu && Math.hypot(dxs, dys) < lim) return;
        if (!moveu) { moveu = true; this.registrar(); this.raiz.classList.add("is-arrastando-anot"); }
        let [dx, dy] = girar([dxs / s, dys / s], -R);
        // mantém o centro da anotação dentro da página
        const b = caixaAnot(orig), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        dx = limitar(dx, -cx, g.W - cx); dy = limitar(dy, -cy, g.H - cy);
        Object.assign(a, transladar(orig, dx, dy));
        this.redesenharAnotacoes(p, { mini: false });
      },
      soltar: () => {
        this.raiz.classList.remove("is-arrastando-anot");
        if (moveu) this.alterou([p.uid]);
        else aoClicar?.();
      },
      cancelar: () => { this.raiz.classList.remove("is-arrastando-anot"); if (moveu) { Object.assign(a, orig); this.desfazerPilha.pop(); this.redesenharAnotacoes(p); } },
    };
  }

  iniciarAlca(e, p, st, alca, pt) {
    const a = this.anotSelecionada();
    if (!a) return;
    const orig = structuredClone(a), R = pt.g.R, s = pt.s;
    const x0 = e.clientX, y0 = e.clientY;
    const b0 = a.tipo === "retangulo" ? { x: a.x, y: a.y, w: a.w, h: a.h } : caixaAnot(a);
    let moveu = false;
    this.acao = {
      pointerId: e.pointerId,
      mover: ev => {
        if (!moveu) { moveu = true; this.registrar(); this.raiz.classList.add("is-arrastando-anot"); }
        const [dx, dy] = girar([(ev.clientX - x0) / s, (ev.clientY - y0) / s], -R);
        if (a.tipo === "texto") {
          const [u] = eixos(orig);
          const proj = dx * u[0] + dy * u[1];
          a.largura = Math.max(a.tam * 1.5, orig.cw + (alca === "fim" ? proj : -proj));
          if (alca === "inicio") { const desl = orig.cw - a.largura; a.x = orig.x + u[0] * desl; a.y = orig.y + u[1] * desl; }
          ajustarTexto(a);
        } else {
          // cantos: n = norte (y menor), s = sul, o = oeste (x menor), l = leste
          const fixo = { x: alca.includes("o") ? b0.x + b0.w : b0.x, y: alca.includes("n") ? b0.y + b0.h : b0.y };
          const movel = { x: (alca.includes("o") ? b0.x : b0.x + b0.w) + dx, y: (alca.includes("n") ? b0.y : b0.y + b0.h) + dy };
          let w = Math.abs(movel.x - fixo.x), hh = Math.abs(movel.y - fixo.y);
          if (a.tipo === "imagem" && !ev.shiftKey) {
            const k = Math.max(w / b0.w, hh / b0.h);
            w = b0.w * k; hh = b0.h * k;
          }
          w = Math.max(6, w); hh = Math.max(6, hh);
          const nx = movel.x < fixo.x ? fixo.x - w : fixo.x, ny = movel.y < fixo.y ? fixo.y - hh : fixo.y;
          if (a.tipo === "retangulo") Object.assign(a, { x: nx, y: ny, w, h: hh });
          else this.caixaParaAnot(a, { x: nx, y: ny, w, h: hh });
        }
        this.redesenharAnotacoes(p, { mini: false });
      },
      soltar: () => { this.raiz.classList.remove("is-arrastando-anot"); if (moveu) this.alterou([p.uid]); },
      cancelar: () => { this.raiz.classList.remove("is-arrastando-anot"); if (moveu) { Object.assign(a, orig); this.desfazerPilha.pop(); this.redesenharAnotacoes(p); } },
    };
  }

  /** define origem/tamanho de uma caixa (imagem/texto) a partir do retângulo envolvente */
  caixaParaAnot(a, b) {
    const r = norm(a.rot || 0);
    const giro = r % 180 !== 0;
    a.cw = giro ? b.h : b.w; a.ch = giro ? b.w : b.h;
    if (r === 0) { a.x = b.x; a.y = b.y; }
    else if (r === 90) { a.x = b.x; a.y = b.y + b.h; }
    else if (r === 180) { a.x = b.x + b.w; a.y = b.y + b.h; }
    else { a.x = b.x + b.w; a.y = b.y; }
  }

  cancelarAcao() {
    const a = this.acao;
    this.acao = null;
    a?.cancelar?.();
  }

  // =================================================================== texto
  criarTexto(p, pt) {
    const cfg = this.opcoes.texto;
    const snap = this.instantaneo();
    const a = { id: novoId(), tipo: "texto", x: pt.x, y: pt.y, rot: pt.g.R, texto: "", tam: cfg.tam, cor: cfg.cor, largura: null, cw: 0, ch: 0 };
    ajustarTexto(a);
    const [, v] = eixos(a);
    a.x -= v[0] * a.ch / 2; a.y -= v[1] * a.ch / 2;
    p.anots.push(a);
    this.editarTexto(p, a, { novo: true, snap });
  }

  editarTexto(p, a, { novo = false, snap = null } = {}) {
    if (this.ro) return;
    if (this.editando?.id !== a.id) this.concluirEdicao();
    this.sel = { uid: p.uid, id: a.id };
    this.editando = { uid: p.uid, id: a.id, novo, snap: snap || this.instantaneo(), original: JSON.stringify(a) };
    this.redesenharAnotacoes(p, { mini: false });
    this.desenharSelecao();
    this.atualizarBarra();
  }

  criarEditor(el, a, p) {
    const ta = h("textarea.pdf-anot-editor", { spellcheck: "true", "aria-label": "Texto da anotação", rows: "1", autocapitalize: "sentences" });
    ta.value = a.texto;
    ta.addEventListener("input", () => {
      a.texto = ta.value;
      ajustarTexto(a);
      this.redesenharAnotacoes(p, { mini: false });
      this.posicionarBarraAnot();
    });
    ta.addEventListener("keydown", e => {
      if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) { e.preventDefault(); e.stopPropagation(); this.concluirEdicao(); this.rolagem.focus({ preventScroll: true }); }
    });
    ta.addEventListener("pointerdown", e => e.stopPropagation());
    el.appendChild(ta);
    try { ta.focus({ preventScroll: true }); } catch (e) {}
    this.focarEditor(ta);
  }

  focarEditor(ta = this.raiz.querySelector(".pdf-anot.is-editing textarea")) {
    if (!ta) return;
    requestAnimationFrame(() => { ta.focus({ preventScroll: true }); const n = ta.value.length; ta.setSelectionRange(n, n); });
  }

  concluirEdicao() {
    const ed = this.editando;
    if (!ed) return;
    this.editando = null;
    const p = this.porUid(ed.uid);
    const a = p?.anots.find(x => x.id === ed.id);
    if (!a) return;
    a.texto = limparTexto(a.texto).replace(/\s+$/, "");
    if (!a.texto.trim()) {
      p.anots = p.anots.filter(x => x !== a);
      if (this.sel?.id === a.id) this.sel = null;
      if (!ed.novo) { this.empilhar(ed.snap); this.alterou([p.uid]); }
      else { this.redesenharAnotacoes(p); this.desenharSelecao(); this.atualizarBarra(); }
      return;
    }
    ajustarTexto(a);
    if (ed.novo || ed.alterado || JSON.stringify(a) !== ed.original) { this.empilhar(ed.snap); this.alterou([p.uid]); }
    else { this.redesenharAnotacoes(p); this.desenharSelecao(); }
  }

  mudarTamanho(d) {
    const a = this.anotSelecionada();
    if (a?.tipo === "texto") {
      const i = TAMANHOS.findIndex(t => t >= a.tam);
      const novo = d > 0 ? TAMANHOS.find(t => t > a.tam) ?? a.tam : [...TAMANHOS].reverse().find(t => t < a.tam) ?? a.tam;
      if (novo !== a.tam || i < 0) this.aplicarOpcao({ tam: novo });
    } else if (a && a.esp != null) {
      const novo = d > 0 ? ESPESSURAS.find(t => t > a.esp) ?? a.esp : [...ESPESSURAS].reverse().find(t => t < a.esp) ?? a.esp;
      if (novo !== a.esp) this.aplicarOpcao({ esp: novo });
    }
  }

  // =================================================================== imagens e assinatura
  registrarImagem(im) {
    const id = novoId("i");
    const url = URL.createObjectURL(new Blob([im.bytes], { type: im.tipo === "png" ? "image/png" : "image/jpeg" }));
    this.imagens.set(id, { ...im, url });
    return id;
  }

  /** coloca uma imagem (assinatura/carimbo) na página atual, centralizada na área visível */
  colocarImagem(im, { larguraPadrao = 170, ponto = null, pagina = null } = {}) {
    const p = pagina || this.paginas[this.atual];
    if (!p) return;
    const g = this.geo(p), st = this.est.get(p.uid);
    const id = this.registrarImagem(im);
    const prop = im.h / Math.max(1, im.w);
    let cw = Math.min(larguraPadrao, (g.R % 180 ? g.H : g.W) * 0.45);
    let ch = cw * prop;
    if (ch > g.H * 0.4) { ch = g.H * 0.4; cw = ch / prop; }
    let centro = ponto;
    if (!centro) {
      // centro da parte visível da página
      const r = st.el.getBoundingClientRect(), rr = this.rolagem.getBoundingClientRect();
      const top = Math.max(r.top, rr.top), bot = Math.min(r.bottom, rr.bottom);
      const cyTela = bot > top ? (top + bot) / 2 : r.top + r.height / 2;
      const q = this.ponto({ clientX: r.left + r.width / 2, clientY: cyTela }, st, p);
      centro = { x: q.x, y: q.y };
    }
    const a = { id: novoId(), tipo: "imagem", img: id, rot: g.R, x: 0, y: 0, cw, ch };
    const bw = g.R % 180 ? ch : cw, bh = g.R % 180 ? cw : ch;
    this.caixaParaAnot(a, { x: limitar(centro.x - bw / 2, 0, Math.max(0, g.W - bw)), y: limitar(centro.y - bh / 2, 0, Math.max(0, g.H - bh)), w: bw, h: bh });
    this.registrar();
    p.anots.push(a);
    if (this.ferramenta !== "selecionar") this.ferramenta = "selecionar";
    this.alterou([p.uid]);
    this.selecionar(p.uid, a.id);
    return a;
  }

  async inserirAssinatura() {
    if (this.ro) return;
    this.concluirEdicao();
    const r = await abrirAssinatura({ mobile: this.mobile });
    if (!r || this.fechado) return;
    this.colocarImagem(r, { larguraPadrao: 160 });
    notice(this.mobile ? "Arraste a assinatura até o lugar certo. Use os cantos para mudar o tamanho." : "Arraste a assinatura até o lugar certo. Use os cantos para mudar o tamanho.", { tempo: 4500 });
  }

  menuImagem(ancora) {
    const m = new Menu();
    m.addItem({ title: "Imagem do computador…", icon: "upload", onClick: () => this.inserirImagemArquivo() });
    m.addItem({ title: "Imagem do cofre…", icon: "image", onClick: () => this.inserirImagemCofre() });
    if (ancora) m.showBelow(ancora); else m.showAtPosition({ x: 120, y: 120 });
  }

  async inserirImagemArquivo() {
    const f = await this.escolherArquivo("image/png,image/jpeg,image/webp,image/gif,image/*");
    if (!f) return;
    await this.inserirImagemBytes(f.bytes, f.tipo);
  }

  async inserirImagemBytes(bytes, tipo, opts = {}) {
    try {
      const im = await prepararImagem(bytes, tipo);
      this.colocarImagem(im, { larguraPadrao: 200, ...opts });
    } catch (e) { erro("Não foi possível inserir a imagem.", e); }
  }

  inserirImagemCofre() {
    const exts = ["png", "jpg", "jpeg", "webp", "gif", "bmp"];
    const lista = this.app.vault.files().filter(f => exts.includes(f.ext));
    if (!lista.length) { notice("Não há imagens no cofre."); return; }
    const m = new SuggestModal({ placeholder: "Escolha a imagem…", instrucoes: [["↑↓", "para navegar"], ["↵", "para inserir"], ["esc", "para cancelar"]], vazioTexto: "Nenhuma imagem encontrada." });
    m.getSuggestions = q => q.trim() ? lista.map(e => ({ e, r: fuzzy(q, e.path) })).filter(x => x.r).sort((a, b) => b.r.score - a.r.score) : lista.map(e => ({ e }));
    m.renderSuggestion = (it, el) => linhaSugestao(el, { titulo: it.e.name, nota: it.e.parent || "", iconeFlair: "file-image" });
    m.onChooseSuggestion = async it => {
      try { await this.inserirImagemBytes(new Uint8Array(await this.app.vault.read(it.e.path)), ""); }
      catch (e) { erro("Não foi possível ler a imagem.", e); }
    };
    m.open();
  }

  /** repete a imagem (rubrica/assinatura) na mesma posição em todas as outras páginas */
  repetirEmTodas(p, a) {
    const g0 = this.geo(p);
    this.registrar();
    let n = 0;
    for (const q of this.paginas) {
      if (q === p) continue;
      const g = this.geo(q);
      const c = structuredClone(a);
      c.id = novoId();
      const b = caixaAnot(a);
      // mesma posição relativa ao canto da página como ela aparece na tela
      const [dx, dy] = paginaParaTela(b.x + b.w / 2, b.y + b.h / 2, g0.W, g0.H, g0.R);
      const fx = dx / g0.dw, fy = dy / g0.dh;
      const [x, y] = telaParaPagina(fx * g.dw, fy * g.dh, g.W, g.H, g.R);
      c.rot = norm(a.rot - g0.R + g.R);
      const bw = c.rot % 180 ? c.ch : c.cw, bh = c.rot % 180 ? c.cw : c.ch;
      this.caixaParaAnot(c, { x: limitar(x - bw / 2, 0, Math.max(0, g.W - bw)), y: limitar(y - bh / 2, 0, Math.max(0, g.H - bh)), w: bw, h: bh });
      q.anots.push(c);
      n++;
    }
    if (!n) { this.desfazerPilha.pop(); notice("O documento só tem uma página."); return; }
    this.alterou("estrutura");
    notice(`Imagem repetida em mais ${n} ${n === 1 ? "página" : "páginas"}.`);
  }

  // =================================================================== destaque a partir da seleção de texto
  destacarSelecao() {
    if (this.ro) return false;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return false;
    const range = sel.getRangeAt(0);
    if (!this.paginasEl.contains(range.commonAncestorContainer)) return false;
    const raiz = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentNode;
    const andar = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, { acceptNode: n => (range.intersectsNode(n) && n.parentElement?.closest(".textLayer") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    const porPagina = new Map();
    for (let n = andar.currentNode.nodeType === 3 && range.intersectsNode(andar.currentNode) ? andar.currentNode : andar.nextNode(); n; n = andar.nextNode()) {
      const pagEl = n.parentElement.closest(".pdf-pagina");
      if (!pagEl) continue;
      const r = document.createRange();
      r.selectNodeContents(n);
      if (n === range.startContainer) r.setStart(n, range.startOffset);
      if (n === range.endContainer) r.setEnd(n, range.endOffset);
      const p = this.porUid(pagEl.dataset.uid), st = this.est.get(p.uid);
      for (const cr of r.getClientRects()) {
        if (cr.width < 1 || cr.height < 1) continue;
        const folga = cr.height * 0.08;
        const a = this.ponto({ clientX: cr.left, clientY: cr.top - folga }, st, p), b = this.ponto({ clientX: cr.right, clientY: cr.bottom + folga }, st, p);
        const rr = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
        if (!porPagina.has(p.uid)) porPagina.set(p.uid, []);
        porPagina.get(p.uid).push(rr);
      }
    }
    if (!porPagina.size) return false;
    this.registrar();
    const cor = this.opcoes.destaque.cor;
    for (const [uid, rs] of porPagina) {
      const rects = juntarRetangulos(rs).map(r => ({ x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.w.toFixed(2), h: +r.h.toFixed(2) }));
      if (rects.length) this.porUid(uid).anots.push({ id: novoId(), tipo: "destaque", rects, cor });
    }
    sel.removeAllRanges();
    this.alterou([...porPagina.keys()]);
    return true;
  }

  // =================================================================== desenho das anotações e da seleção
  redesenharAnotacoes(p, { mini = true } = {}) {
    if (!p) return;
    const st = this.est.get(p.uid);
    if (st) {
      const ctx = {
        imagens: this.imagens,
        selecionada: this.sel?.uid === p.uid ? this.sel.id : null,
        editando: this.editando?.uid === p.uid ? this.editando.id : null,
        aoCriarEditor: (el, a) => this.criarEditor(el, a, p),
      };
      desenharDestaques(st.destaques, p.anots, ctx);
      desenharAnotacoes(st.anot, p.anots, ctx);
      if (this.sel?.uid === p.uid) this.desenharSelecao();
    }
    if (mini) this.desenharMini(p);
  }

  desenharSelecao() {
    for (const el of this.raiz.querySelectorAll(".pdf-selecao")) el.remove();
    this.barraAnot?.remove();
    this.barraAnot = null;
    const a = this.anotSelecionada();
    if (!a) return;
    const p = this.porUid(this.sel.uid), st = this.est.get(p.uid);
    if (!st) return;
    const b = a.tipo === "retangulo" ? { x: a.x, y: a.y, w: a.w, h: a.h } : caixaAnot(a);
    const caixa = h("div.pdf-selecao-caixa", { style: { left: px(b.x), top: px(b.y), width: px(b.w), height: px(b.h) } });
    const sel = h("div.pdf-selecao" + (this.editando ? ".is-editing" : ""), caixa);
    const alca = (nome, x, y) => sel.appendChild(h("div.pdf-alca", { dataset: { alca: nome }, style: { left: px(x), top: px(y) } }));
    if (!this.editando && (a.tipo === "imagem" || a.tipo === "retangulo")) {
      alca("no", b.x, b.y); alca("ne", b.x + b.w, b.y); alca("so", b.x, b.y + b.h); alca("se", b.x + b.w, b.y + b.h);
    } else if (a.tipo === "texto") {
      const fora = (this.mobile ? 13 : 7) / this.escala;
      const [x1, y1] = pontoDaCaixa(a, a.cw + fora, a.ch / 2), [x0, y0] = pontoDaCaixa(a, -fora, a.ch / 2);
      alca("fim", x1, y1);
      if (!this.mobile) alca("inicio", x0, y0);
    }
    if (a.tipo === "texto" || a.tipo === "imagem") caixa.classList.add("mod-sem-borda");
    st.anot.appendChild(sel);
    if (!this.ro) this.criarBarraAnot(p, st, a);
  }

  criarBarraAnot(p, st, a) {
    const b = (ic, t, fn, cls = "") => iconButton(ic, t, e => { e.stopPropagation(); fn(e); }, "clickable-icon pdf-btn" + (cls ? " " + cls : ""));
    const itens = [];
    if (a.tipo !== "imagem") {
      const amostra = h("div.clickable-icon.pdf-btn.pdf-btn-cor", { role: "button", title: "Cor", "aria-label": "Cor", onclick: e => { e.stopPropagation(); this.menuCor(e.currentTarget); } }, h("span.pdf-cor-amostra", { style: { background: a.cor } }));
      itens.push(amostra);
    }
    if (a.tipo === "texto") itens.push(b("minus", "Letra menor", () => this.mudarTamanho(-1)), h("span.pdf-barra-valor", { text: String(a.tam) }), b("plus", "Letra maior", () => this.mudarTamanho(1)));
    if (a.tipo === "tinta" || a.tipo === "retangulo") itens.push(b("minus", "Traço mais fino", () => this.mudarTamanho(-1)), h("span.pdf-barra-valor", { text: String(a.esp).replace(".", ",") }), b("plus", "Traço mais grosso", () => this.mudarTamanho(1)));
    if (a.tipo === "texto" && !this.editando) itens.push(b("pencil", "Editar texto", () => this.editarTexto(p, a)));
    if (a.tipo === "texto" && this.editando) itens.push(b("check", "Concluir texto", () => { this.concluirEdicao(); this.rolagem.focus({ preventScroll: true }); }));
    if (a.tipo === "imagem" && this.paginas.length > 1) itens.push(b("files", "Repetir em todas as páginas (rubrica)", () => this.repetirEmTodas(p, a)));
    itens.push(b("trash", "Excluir anotação (Delete)", () => this.excluirSelecionada(), "mod-perigo"));
    this.barraAnot = h("div.pdf-barra-anot", { role: "toolbar", "aria-label": "Opções da anotação" }, itens);
    this.barraAnot.addEventListener("pointerdown", e => { e.stopPropagation(); if (this.editando) e.preventDefault(); });
    st.el.appendChild(this.barraAnot);
    this.posicionarBarraAnot();
  }

  posicionarBarraAnot() {
    const bar = this.barraAnot, a = this.anotSelecionada();
    if (!bar || !a) return;
    const p = this.porUid(this.sel.uid), g = this.geo(p), s = this.escala;
    const bx = caixaAnot(a);
    const cantos = [[bx.x, bx.y], [bx.x + bx.w, bx.y], [bx.x, bx.y + bx.h], [bx.x + bx.w, bx.y + bx.h]].map(([x, y]) => paginaParaTela(x, y, g.W, g.H, g.R));
    const minX = Math.min(...cantos.map(c => c[0])) * s, maxX = Math.max(...cantos.map(c => c[0])) * s;
    const minY = Math.min(...cantos.map(c => c[1])) * s, maxY = Math.max(...cantos.map(c => c[1])) * s;
    const bw = bar.offsetWidth, bh = bar.offsetHeight, pw = g.dw * s;
    let top = minY - bh - 10;
    if (top < 4) top = maxY + 10;
    bar.style.left = limitar((minX + maxX) / 2 - bw / 2, 4, Math.max(4, pw - bw - 4)) + "px";
    bar.style.top = top + "px";
  }

  excluirSelecionada() {
    const a = this.anotSelecionada();
    if (!a || this.ro) return;
    const p = this.porUid(this.sel.uid);
    if (this.editando?.id === a.id) {
      const ed = this.editando; this.editando = null;
      p.anots = p.anots.filter(x => x !== a); this.sel = null;
      if (!ed.novo) { this.empilhar(ed.snap); this.alterou([p.uid]); } else { this.redesenharAnotacoes(p); this.desenharSelecao(); this.atualizarBarra(); }
      return;
    }
    this.registrar();
    p.anots = p.anots.filter(x => x !== a);
    this.sel = null;
    this.alterou([p.uid]);
  }

  // =================================================================== desfazer / alterações
  instantaneo() { return { paginas: structuredClone(this.paginas), rev: this.rev, nFontes: this.fontes.length }; }
  empilhar(s) {
    this.desfazerPilha.push(s);
    if (this.desfazerPilha.length > 200) this.desfazerPilha.shift();
    this.refazerPilha = [];
  }
  registrar() { this.empilhar(this.instantaneo()); }

  /** algo mudou: ["uid", ...] (só anotações dessas páginas) ou "estrutura" (páginas) */
  alterou(oque) {
    this.rev = ++this.seqRev;
    this.setDirty(this.rev !== this.revSalva);
    if (oque === "estrutura") this.sincronizar();
    else for (const uid of oque) this.redesenharAnotacoes(this.porUid(uid));
    this.desenharSelecao();
    this.atualizarBarra();
    if (this.assinadoDigital && !this.avisouAssinado) {
      this.avisouAssinado = true;
      notice("Atenção: este PDF tem assinatura digital (certificado). Ao salvar alterações, essa assinatura digital deixa de valer.", { tempo: 9000 });
    }
  }

  desfazer() {
    this.concluirEdicao();
    const s = this.desfazerPilha.pop();
    if (!s) return;
    this.refazerPilha.push(this.instantaneo());
    this.restaurar(s);
  }
  refazer() {
    this.concluirEdicao();
    const s = this.refazerPilha.pop();
    if (!s) return;
    this.desfazerPilha.push(this.instantaneo());
    this.restaurar(s);
  }
  restaurar(s) {
    const uidAtual = this.paginas[this.atual]?.uid;
    this.paginas = s.paginas;
    this.rev = s.rev;
    this.sel = null;
    const i = this.paginas.findIndex(p => p.uid === uidAtual);
    if (i >= 0) this.atual = i;
    this.setDirty(this.rev !== this.revSalva);
    this.sincronizar();
    this.atualizarBarra();
  }

  setDirty(v) { super.setDirty(v); this.btnSalvar?.classList.toggle("is-dirty", !!v); }

  // =================================================================== páginas: girar, excluir, mover, juntar, extrair
  alvoPaginas() {
    const sel = this.paginas.filter(p => this.selPaginas.has(p.uid));
    return sel.length > 1 ? sel : [this.paginas[this.atual]].filter(Boolean);
  }

  girarPaginas(d, lista = this.alvoPaginas()) {
    if (this.ro || !lista.length) return;
    this.concluirEdicao();
    this.registrar();
    for (const p of lista) p.rot = norm((p.rot || 0) + d);
    this.alterou("estrutura");
    if (this.modoZoom) this.definirZoom(this.calcularAjuste(this.modoZoom), { modo: this.modoZoom });
  }

  async excluirPaginas(lista = this.alvoPaginas()) {
    if (this.ro || !lista.length) return;
    this.concluirEdicao();
    if (lista.length >= this.paginas.length) { notice("Não é possível excluir todas as páginas: o PDF precisa ter pelo menos uma."); return; }
    const nums = lista.map(p => this.paginas.indexOf(p) + 1);
    const ok = await confirmar({
      titulo: lista.length > 1 ? `Excluir ${lista.length} páginas?` : `Excluir a página ${nums[0]}?`,
      texto: (lista.length > 1 ? `As páginas ${faixaTexto(nums)} serão retiradas do documento.` : "A página será retirada do documento.") + " Enquanto não salvar, dá para desfazer com Ctrl+Z.",
      ok: "Excluir", perigo: true,
    });
    if (!ok || this.fechado) return;
    this.registrar();
    const fora = new Set(lista.map(p => p.uid));
    const primeiro = Math.min(...lista.map(p => this.paginas.indexOf(p)));
    this.paginas = this.paginas.filter(p => !fora.has(p.uid));
    this.selPaginas.clear();
    this.atual = Math.min(primeiro, this.paginas.length - 1);
    this.alterou("estrutura");
    this.irParaPagina(this.atual);
  }

  /** move as páginas para antes da posição `destino` (índice na lista atual) */
  moverPaginas(lista, destino) {
    if (this.ro || !lista.length) return false;
    const fora = new Set(lista.map(p => p.uid));
    const antes = this.paginas.slice(0, destino).filter(p => !fora.has(p.uid)).length;
    const resto = this.paginas.filter(p => !fora.has(p.uid));
    const movidas = this.paginas.filter(p => fora.has(p.uid));
    const nova = [...resto.slice(0, antes), ...movidas, ...resto.slice(antes)];
    if (nova.every((p, i) => p === this.paginas[i])) return false;
    this.concluirEdicao();
    this.registrar();
    this.paginas = nova;
    this.atual = nova.indexOf(movidas[0]);
    this.alterou("estrutura");
    this.irParaPagina(this.atual);
    return true;
  }

  itensPagina(m, lista) {
    const i0 = this.paginas.indexOf(lista[0]), n = lista.length;
    const rot = n > 1 ? ` (${n} páginas)` : "";
    m.addItem({ title: "Girar para a esquerda" + rot, icon: "rotate-ccw", onClick: () => this.girarPaginas(-90, lista) });
    m.addItem({ title: "Girar para a direita" + rot, icon: "rotate-cw", onClick: () => this.girarPaginas(90, lista) });
    m.addSeparator();
    m.addItem({ title: "Mover para cima", icon: "arrow-up", disabled: i0 <= 0, onClick: () => this.moverPaginas(lista, i0 - 1) });
    m.addItem({ title: "Mover para baixo", icon: "arrow-down", disabled: this.paginas.indexOf(lista[n - 1]) >= this.paginas.length - 1, onClick: () => this.moverPaginas(lista, this.paginas.indexOf(lista[n - 1]) + 2) });
    m.addItem({ title: "Mover para o início", icon: "chevron-left", disabled: i0 <= 0, onClick: () => this.moverPaginas(lista, 0) });
    m.addItem({ title: "Mover para o fim", icon: "chevron-right", disabled: this.paginas.indexOf(lista[n - 1]) >= this.paginas.length - 1, onClick: () => this.moverPaginas(lista, this.paginas.length) });
    m.addSeparator();
    m.addItem({ title: "Inserir páginas de outro PDF depois desta…", icon: "file-plus", onClick: () => { this.atual = this.paginas.indexOf(lista[n - 1]); this.menuJuntar(null, "depois"); } });
    m.addItem({ title: "Extrair para um novo PDF" + rot, icon: "scissors", onClick: () => this.extrairPaginas(lista) });
    m.addSeparator();
    m.addItem({ title: n > 1 ? `Excluir ${n} páginas` : "Excluir página", icon: "trash", warning: true, onClick: () => this.excluirPaginas(lista) });
  }

  menuPagina(e, uid) {
    const p = this.porUid(uid);
    if (!p) return;
    const lista = this.selPaginas.has(uid) && this.selPaginas.size > 1 ? this.paginas.filter(q => this.selPaginas.has(q.uid)) : [p];
    const m = new Menu();
    m.addLabel(lista.length > 1 ? `${lista.length} páginas selecionadas` : `Página ${this.paginas.indexOf(p) + 1}`);
    this.itensPagina(m, lista);
    if (e?.clientX != null && e.type === "contextmenu") m.showAtMouseEvent(e);
    else if (e?.currentTarget) m.showBelow(e.currentTarget);
    else m.showAtPosition({ x: 100, y: 100 });
  }

  menuJuntar(e, posicao = null) {
    const m = new Menu();
    m.addItem({ title: "PDF do cofre…", icon: "files", onClick: () => this.juntarPdf("cofre", posicao) });
    m.addItem({ title: "PDF do computador…", icon: "upload", onClick: () => this.juntarPdf("computador", posicao) });
    if (e?.currentTarget) m.showBelow(e.currentTarget); else m.showAtPosition({ x: 140, y: 120 });
  }

  escolherArquivo(accept) {
    return new Promise(res => {
      const inp = h("input", { type: "file", accept, style: { display: "none" } });
      document.body.appendChild(inp);
      let feito = false;
      const fim = v => { if (!feito) { feito = true; inp.remove(); res(v); } };
      inp.addEventListener("change", async () => {
        const f = inp.files?.[0];
        if (!f) return fim(null);
        try { fim({ bytes: new Uint8Array(await f.arrayBuffer()), nome: f.name, tipo: f.type }); }
        catch (e) { erro("Não foi possível ler o arquivo.", e); fim(null); }
      });
      inp.addEventListener("cancel", () => fim(null));
      inp.click();
    });
  }

  escolherPdfDoCofre() {
    return new Promise(res => {
      const lista = this.app.vault.files().filter(f => f.ext === "pdf" && f.path !== this.file.path).sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
      if (!lista.length) { notice("Não há outros PDFs no cofre."); res(null); return; }
      const m = new SuggestModal({ placeholder: "Escolha o PDF para juntar…", instrucoes: [["↑↓", "para navegar"], ["↵", "para escolher"], ["esc", "para cancelar"]], vazioTexto: "Nenhum PDF encontrado." });
      let escolhido = false;
      m.getSuggestions = q => {
        if (!q.trim()) return lista.map(e => ({ e }));
        return lista.map(e => ({ e, r: fuzzy(q, e.name) })).filter(x => x.r).sort((a, b) => b.r.score - a.r.score);
      };
      m.renderSuggestion = (it, el) => linhaSugestao(el, { titulo: it.e.name, ranges: it.r?.ranges, nota: it.e.parent ? it.e.parent + "/" : "", iconeFlair: "file-text" });
      m.onChooseSuggestion = async it => {
        escolhido = true;
        try { res({ bytes: new Uint8Array(await this.app.vault.read(it.e.path)), nome: it.e.name }); }
        catch (e) { erro("Não foi possível ler o PDF.", e); res(null); }
      };
      m.onClose = () => setTimeout(() => { if (!escolhido) res(null); }, 0);
      m.open();
    });
  }

  perguntarInsercao(fonte, posicaoPadrao) {
    return new Promise(res => {
      const n = fonte.infos.length, atual = this.atual + 1;
      const m = new Modal({ titulo: "Inserir páginas", classe: "pdf-modal-inserir" });
      const faixa = h("input", { type: "text", placeholder: `Todas (ex.: 1-${Math.min(3, n)}${n > 3 ? ", 5" : ""})`, "aria-label": "Quais páginas" });
      const radio = (valor, texto) => h("label.pdf-radio", h("input", { type: "radio", name: "pdf-pos", value: valor }), h("span", { text: texto }));
      const opcoes = h("div.pdf-radios",
        radio("depois", `Depois da página ${atual} (a que está aberta)`),
        radio("inicio", "No início do documento"),
        radio("fim", "No final do documento"));
      const padrao = posicaoPadrao || "fim";
      opcoes.querySelector(`input[value="${padrao}"]`).checked = true;
      m.contentEl.append(
        h("p", { text: `“${fonte.nome}” tem ${n} ${n === 1 ? "página" : "páginas"}.` }),
        h("div.pdf-campo", h("label", { text: "Quais páginas" }), faixa),
        h("div.pdf-campo", h("label", { text: "Onde inserir" }), opcoes));
      let feito = false;
      const fim = v => { if (!feito) { feito = true; res(v); m.close(); } };
      m.aoFechar.push(() => fim(null));
      const ok = () => {
        const indices = lerFaixas(faixa.value, n);
        if (!indices) { notice(`Páginas inválidas. Use números de 1 a ${n}, por exemplo: 1-3, 5`); faixa.focus(); return; }
        fim({ indices, posicao: opcoes.querySelector("input:checked")?.value || "fim" });
      };
      faixa.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); ok(); } });
      m.botoes([{ texto: "Cancelar", acao: () => fim(null) }, { texto: "Inserir", cta: true, acao: ok }]);
      m.open();
      setTimeout(() => faixa.focus(), 30);
    });
  }

  async juntarPdf(origem, posicao = null) {
    if (this.ro) return;
    this.concluirEdicao();
    let dados = origem;
    if (origem === "cofre") dados = await this.escolherPdfDoCofre();
    else if (origem === "computador") dados = await this.escolherArquivo("application/pdf,.pdf");
    if (!dados || this.fechado) return;
    if (examinarBytes(dados.bytes).protegido) { notice("Esse PDF é protegido por senha e não pode ser juntado."); return; }
    let fonte;
    try { fonte = await this.carregarFonte(dados.bytes, dados.nome || "PDF"); }
    catch (e) { erro("Não foi possível ler esse PDF.", e); return; }
    if (fonte.senha) { destruir(fonte.doc); notice("Esse PDF é protegido por senha e não pode ser juntado."); return; }
    const escolha = await this.perguntarInsercao(fonte, posicao);
    if (!escolha || this.fechado) { destruir(fonte.doc); return; }
    this.fontes.push(fonte);
    this.registrar();
    const novas = escolha.indices.map(i => ({ uid: novoId("p"), fonte: fonte.id, indice: i, rot: 0, anots: [] }));
    const pos = escolha.posicao === "inicio" ? 0 : escolha.posicao === "depois" ? this.atual + 1 : this.paginas.length;
    this.paginas.splice(pos, 0, ...novas);
    this.alterou("estrutura");
    if (this.modoZoom) this.definirZoom(this.calcularAjuste(this.modoZoom), { modo: this.modoZoom });
    this.irParaPagina(pos);
    notice(`${novas.length} ${novas.length === 1 ? "página inserida" : "páginas inseridas"} de “${fonte.nome}”. Salve para gravar no arquivo.`, { tempo: 5000 });
  }

  async extrairPaginas(lista = this.alvoPaginas()) {
    if (!lista.length) return;
    this.concluirEdicao();
    const nums = lista.map(p => this.paginas.indexOf(p) + 1);
    const nomeBase = `${stem(this.file.path)} - ${nums.length === 1 ? "página " + nums[0] : "páginas " + faixaTexto(nums).replace(/, /g, " e ")}`;
    const caminho = this.app.vault.nomeLivre(dirname(this.file.path), nomeBase, "pdf");
    const aviso = notice("Criando o novo PDF…", { tempo: 0 });
    try {
      const bytes = await this.gerar(lista);
      await this.app.vault.create(caminho, bytes);
      aviso.hide();
      notice(`Criado: ${basename(caminho)}`);
      this.app.abrirArquivo(caminho, { novaAba: true });
    } catch (e) { aviso.hide(); erro("Não foi possível criar o novo PDF.", e); }
  }

  // =================================================================== miniaturas: clique, seleção e arrastar
  miniPressionar(e, uid) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.target.closest(".pdf-mini-mais")) return;
    const x0 = e.clientX, y0 = e.clientY, toque = e.pointerType === "touch";
    let arrastando = false, cancelado = false, timer = null;
    const comecar = () => { if (this.ro) return; arrastando = true; this.iniciarArrastoMini(e, uid); };
    if (toque && !this.ro) timer = setTimeout(() => { if (!cancelado) { comecar(); navigator.vibrate?.(12); } }, 380);
    const mover = ev => {
      if (ev.pointerId !== e.pointerId) return;
      const d = Math.hypot(ev.clientX - x0, ev.clientY - y0);
      if (!arrastando) {
        if (toque) { if (d > 10) { cancelado = true; clearTimeout(timer); } return; }
        if (d > 6 && !this.ro) comecar(); else return;
      }
      this.moverArrastoMini(ev);
    };
    const soltar = ev => {
      if (ev.pointerId !== e.pointerId) return;
      clearTimeout(timer);
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
      if (arrastando) this.soltarArrastoMini(ev, ev.type === "pointerup");
      else if (!cancelado && ev.type === "pointerup") this.miniClique(e, uid);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
  }

  miniClique(e, uid) {
    const i = this.paginas.findIndex(p => p.uid === uid);
    if (i < 0) return;
    if (e.shiftKey && this.ancoraSel != null && !this.ro) {
      const a = Math.min(this.ancoraSel, i), b = Math.max(this.ancoraSel, i);
      this.selPaginas = new Set(this.paginas.slice(a, b + 1).map(p => p.uid));
    } else if (modKey(e) && !this.ro) {
      if (this.selPaginas.size <= 1) this.selPaginas = new Set([this.paginas[this.atual]?.uid].filter(Boolean));
      if (this.selPaginas.has(uid)) this.selPaginas.delete(uid); else this.selPaginas.add(uid);
      this.ancoraSel = i;
    } else {
      this.selPaginas = new Set([uid]);
      this.ancoraSel = i;
      this.irParaPagina(i);
      if (this.mobile) this.alternarMiniaturas(false);
    }
    this.atualizarSelecaoMini();
  }

  atualizarSelecaoMini() {
    const multi = this.selPaginas.size > 1;
    for (const [u, m] of this.minis) { const s = multi && this.selPaginas.has(u); m.el.classList.toggle("is-selected", s); m.el.setAttribute("aria-selected", s ? "true" : "false"); }
  }

  iniciarArrastoMini(e, uid) {
    const lista = this.selPaginas.has(uid) && this.selPaginas.size > 1 ? this.paginas.filter(p => this.selPaginas.has(p.uid)) : [this.porUid(uid)];
    const m = this.minis.get(uid);
    const fantasma = h("div.pdf-mini-fantasma", m.pag.cloneNode(true), lista.length > 1 ? h("span.pdf-mini-fantasma-num", { text: String(lista.length) }) : null);
    document.body.appendChild(fantasma);
    for (const p of lista) this.minis.get(p.uid)?.el.classList.add("is-arrastada");
    this.arrastoMini = { lista, fantasma, destino: null };
    this.miniLista.classList.add("is-arrastando");
    this.moverArrastoMini(e);
  }

  moverArrastoMini(ev) {
    const d = this.arrastoMini;
    if (!d) return;
    d.fantasma.style.left = ev.clientX + 12 + "px";
    d.fantasma.style.top = ev.clientY + 12 + "px";
    const lr = this.miniLista.getBoundingClientRect();
    // rolagem automática perto das bordas
    clearInterval(d.auto);
    const borda = 36;
    if (ev.clientY < lr.top + borda || ev.clientY > lr.bottom - borda) {
      const passo = ev.clientY < lr.top + borda ? -10 : 10;
      d.auto = setInterval(() => { this.miniLista.scrollTop += passo; this.calcularDestinoMini(d.ultimo); }, 16);
    }
    d.ultimo = { clientX: ev.clientX, clientY: ev.clientY };
    this.calcularDestinoMini(d.ultimo);
  }

  calcularDestinoMini(pos) {
    const d = this.arrastoMini;
    if (!d || !pos) return;
    let destino = this.paginas.length, ref = null;
    for (let i = 0; i < this.paginas.length; i++) {
      const el = this.minis.get(this.paginas[i].uid)?.el;
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (pos.clientY < r.top + r.height / 2) { destino = i; ref = el; break; }
    }
    d.destino = destino;
    const ind = this.miniIndicador;
    ind.classList.remove("is-hidden");
    const ultimo = this.minis.get(this.paginas[this.paginas.length - 1]?.uid)?.el;
    const topo = ref ? ref.offsetTop - 5 : (ultimo ? ultimo.offsetTop + ultimo.offsetHeight + 3 : 0);
    ind.style.top = topo + "px";
  }

  soltarArrastoMini(ev, ok) {
    const d = this.arrastoMini;
    if (!d) return;
    clearInterval(d.auto);
    d.fantasma.remove();
    this.miniIndicador.classList.add("is-hidden");
    this.miniLista.classList.remove("is-arrastando");
    for (const m of this.minis.values()) m.el.classList.remove("is-arrastada");
    this.arrastoMini = null;
    if (ok && d.destino != null) this.moverPaginas(d.lista, d.destino);
  }

  // =================================================================== busca no PDF
  async textoDaPagina(p) {
    const k = `${p.fonte}:${p.indice}`;
    if (!this.textos.has(k)) {
      this.textos.set(k, (async () => {
        const pg = await this.paginaPdf(p);
        const conteudo = await pg.getTextContent();
        let texto = "";
        const item = [];
        conteudo.items.forEach((it, i) => {
          if (it.str === undefined) return;
          texto += it.str;
          for (let j = 0; j < it.str.length; j++) item.push(i);
          if (it.hasEOL) { texto += "\n"; item.push(-1); }
        });
        let off = 0;
        const offs = [];
        for (let c = 0; c < item.length; c++) { offs.push(c > 0 && item[c] === item[c - 1] ? ++off : (off = 0)); }
        return { conteudo, texto, dobrado: dobrar(texto), item, off: offs };
      })());
    }
    return this.textos.get(k);
  }

  abrirBusca(termo = null) {
    this.buscaEl.classList.remove("is-hidden");
    if (termo != null) this.buscaInput.value = termo;
    else { const s = window.getSelection()?.toString().trim(); if (s && s.length < 80 && !s.includes("\n")) this.buscaInput.value = s; }
    this.buscaInput.focus();
    this.buscaInput.select();
    if (this.buscaInput.value && this.busca?.termo !== this.buscaInput.value) this.buscar(this.buscaInput.value);
  }

  fecharBusca() {
    this.buscaEl.classList.add("is-hidden");
    this.busca = null;
    this.buscaSeq++;
    this.buscaInfo.textContent = "";
    for (const p of this.paginas) { const st = this.est.get(p.uid); if (st) this.aplicarRealces(p, st); }
    this.rolagem.focus({ preventScroll: true });
  }

  buscarDepois() { clearTimeout(this._tBusca); this._tBusca = setTimeout(() => { if (this.busca?.termo) this.buscar(this.busca.termo, { pular: false }); }, 200); }

  async buscar(termo, { pular = true, primeiro = false } = {}) {
    const id = ++this.buscaSeq;
    const t = String(termo || "").trim();
    const anterior = this.busca?.resultados?.[this.busca.indice];
    this.busca = { termo, resultados: [], indice: -1, carregando: true };
    if (!t) { this.busca = null; this.buscaInfo.textContent = ""; for (const p of this.paginas) { const st = this.est.get(p.uid); if (st) this.aplicarRealces(p, st); } return; }
    this.buscaInfo.textContent = "Procurando…";
    const re = new RegExp(dobrar(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"), "g");
    const res = [];
    for (const p of this.paginas) {
      let tx;
      try { tx = await this.textoDaPagina(p); } catch (e) { continue; }
      if (id !== this.buscaSeq) return;
      for (const m of tx.dobrado.matchAll(re)) if (m[0].length) res.push({ uid: p.uid, ini: m.index, fim: m.index + m[0].length });
    }
    if (id !== this.buscaSeq) return;
    this.busca.resultados = res;
    this.busca.carregando = false;
    if (!res.length) { this.buscaInfo.textContent = "Nenhum resultado"; this.busca.indice = -1; }
    else {
      let i = 0;
      if (!pular && anterior) i = Math.max(0, res.findIndex(r => r.uid === anterior.uid && r.ini >= anterior.ini));
      else if (!primeiro) { const k = res.findIndex(r => this.paginas.findIndex(p => p.uid === r.uid) >= this.atual); i = k >= 0 ? k : 0; }
      this.busca.indice = i;
    }
    for (const p of this.paginas) { const st = this.est.get(p.uid); if (st) this.aplicarRealces(p, st); }
    this.atualizarInfoBusca();
    if (res.length && pular) this.irParaResultado();
  }

  atualizarInfoBusca() {
    const b = this.busca;
    if (!b || b.carregando) return;
    this.buscaInfo.textContent = b.resultados.length ? `${b.indice + 1} de ${b.resultados.length}` : "Nenhum resultado";
  }

  buscaPasso(d) {
    const b = this.busca;
    if (!b) { if (this.buscaInput.value) this.buscar(this.buscaInput.value); return; }
    if (!b.resultados.length) return;
    const ant = b.resultados[b.indice];
    b.indice = (b.indice + d + b.resultados.length) % b.resultados.length;
    const novo = b.resultados[b.indice];
    for (const uid of new Set([ant?.uid, novo.uid])) { const p = this.porUid(uid), st = this.est.get(uid); if (p && st) this.aplicarRealces(p, st); }
    this.atualizarInfoBusca();
    this.irParaResultado();
  }

  async irParaResultado() {
    const b = this.busca, r = b?.resultados[b.indice];
    if (!r) return;
    const i = this.paginas.findIndex(p => p.uid === r.uid);
    if (i < 0) return;
    const p = this.paginas[i], st = this.est.get(p.uid);
    const span = st?.texto.querySelector(".highlight.selected");
    if (span) {
      const sr = span.getBoundingClientRect(), rr = this.rolagem.getBoundingClientRect();
      const dentro = sr.top >= rr.top + 40 && sr.bottom <= rr.bottom - 40 && sr.left >= rr.left && sr.right <= rr.right;
      if (!dentro) this.rolagem.scrollBy({ top: sr.top - rr.top - this.rolagem.clientHeight / 3, left: sr.left < rr.left || sr.right > rr.right ? sr.left - rr.left - 40 : 0 });
      this.atual = i; this.atualizarIndicador(true);
      return;
    }
    // página ainda não desenhada: calcula a posição pelo texto
    const tx = await this.textoDaPagina(p);
    let k = r.ini;
    while (k < r.fim && tx.item[k] < 0) k++;
    const it = tx.conteudo.items[tx.item[k]];
    if (it?.transform) {
      const [x0, , , y1] = this.info(p).view;
      this.irParaPagina(i, { yPagina: y1 - it.transform[5] - (Math.abs(it.transform[3]) || 10), xPagina: this.escala * this.geo(p).dw > this.rolagem.clientWidth ? it.transform[4] - x0 : null });
      this.rolagem.scrollTop -= this.rolagem.clientHeight / 3 - 40;
    } else this.irParaPagina(i);
  }

  aplicarRealces(p, st) {
    if (!st?.textLayer) return;
    const divs = st.textLayer.textDivs, strs = st.textLayer.textContentItemsStr;
    for (const i of st.divsRealcados || []) if (divs[i]) divs[i].textContent = strs[i];
    st.divsRealcados = [];
    const b = this.busca;
    if (!b || !b.resultados.length) return;
    const tx = this.textos.get(`${p.fonte}:${p.indice}`);
    if (!tx || !(tx instanceof Promise)) return;
    tx.then(t => {
      if (st.textLayer?.textDivs !== divs || this.busca !== b) return;
      const sel = b.resultados[b.indice];
      const porItem = new Map();
      for (const r of b.resultados) {
        if (r.uid !== p.uid) continue;
        for (let c = r.ini; c < r.fim; c++) {
          const it = t.item[c];
          if (it < 0) continue;
          if (!porItem.has(it)) porItem.set(it, []);
          const lista = porItem.get(it), o = t.off[c], ehSel = r === sel;
          const u = lista[lista.length - 1];
          if (u && u.fim === o && u.sel === ehSel) u.fim = o + 1; else lista.push({ ini: o, fim: o + 1, sel: ehSel });
        }
      }
      for (const [it, segs] of porItem) {
        const div = divs[it];
        if (!div) continue;
        const s = strs[it];
        const frag = document.createDocumentFragment();
        let ult = 0;
        for (const sg of segs) {
          if (sg.ini > ult) frag.appendChild(document.createTextNode(s.slice(ult, sg.ini)));
          frag.appendChild(h("span.highlight" + (sg.sel ? ".selected" : ""), { text: s.slice(sg.ini, sg.fim) }));
          ult = sg.fim;
        }
        if (ult < s.length) frag.appendChild(document.createTextNode(s.slice(ult)));
        div.replaceChildren(frag);
        st.divsRealcados.push(it);
      }
    });
  }

  destacarBusca(q) {
    if (!q || !this.paginas?.length) return;
    this.abrirBusca(q);
    this.buscar(q, { primeiro: true });
  }

  // =================================================================== sumário (painel Estrutura)
  async carregarSumario() {
    const f = this.fontes[0];
    let ol = null;
    try { ol = await f.doc.getOutline(); } catch (e) {}
    if (this.fechado || this.fontes[0] !== f) return;
    const out = [];
    const anda = (itens, nivel) => { for (const it of itens || []) { out.push({ nivel, texto: (it.title || "").trim() || "(sem título)", dest: it.dest, url: it.url, fonte: f.id }); anda(it.items, nivel + 1); } };
    anda(ol, 1);
    this.sumario = out;
    this.app.emit("outline-changed");
  }

  getOutline() { return this.sumario?.length ? this.sumario : null; }
  revealOutline(it) {
    if (it.url) { window.open(it.url, "_blank", "noopener"); return; }
    const f = this.fonte(it.fonte) || this.fontes[0];
    this.irParaDestino(f, it.dest);
  }

  async irParaDestino(fonte, dest) {
    try {
      let d = dest;
      if (typeof d === "string") d = await fonte.doc.getDestination(d);
      if (!Array.isArray(d)) return;
      const ref = d[0];
      const idx = ref && typeof ref === "object" ? await fonte.doc.getPageIndex(ref) : Number.isInteger(ref) ? ref : null;
      if (idx == null) return;
      const pos = this.paginas.findIndex(p => p.fonte === fonte.id && p.indice === idx);
      if (pos < 0) { notice("Essa página foi excluída deste documento."); return; }
      const tipo = d[1]?.name;
      const view = fonte.infos[idx].view;
      let topo = null;
      if (tipo === "XYZ" && d[3] != null) topo = d[3];
      else if ((tipo === "FitH" || tipo === "FitBH") && d[2] != null) topo = d[2];
      this.irParaPagina(pos, topo != null ? { yPagina: limitar(view[3] - topo, 0, view[3] - view[1]) } : {});
    } catch (e) { console.error(e); }
  }

  // =================================================================== teclado, toque e soltar arquivos
  estaAtiva() {
    const v = this.app.workspace?.activeLeaf?.view;
    return !this.fechado && !!this.raiz?.isConnected && (v === this || v?.interno === this);
  }

  aoTeclar(e) {
    if (!this.estaAtiva() || document.querySelector(".modal-container")) return;
    const t = e.target;
    const digitando = t?.closest?.("input, textarea, select, [contenteditable=true], .cm-editor");
    const mod = modKey(e), k = e.key;
    if (mod && !e.altKey && (k === "f" || k === "F")) { e.preventDefault(); this.abrirBusca(); return; }
    if (k === "F3") { e.preventDefault(); this.buscaPasso(e.shiftKey ? -1 : 1); return; }
    if (digitando && !this.raiz.contains(t)) return;
    if (digitando) return;
    if (mod && !e.altKey && (k === "z" || k === "Z")) { if (this.ro) return; e.preventDefault(); if (e.shiftKey) this.refazer(); else this.desfazer(); return; }
    if (mod && !e.altKey && (k === "y" || k === "Y")) { if (this.ro) return; e.preventDefault(); this.refazer(); return; }
    if (mod && (k === "=" || k === "+")) { e.preventDefault(); this.zoomPasso(1); return; }
    if (mod && k === "-") { e.preventDefault(); this.zoomPasso(-1); return; }
    if (mod && k === "0") { e.preventDefault(); this.definirZoom(this.calcularAjuste("largura"), { modo: "largura" }); return; }
    if (mod) return;
    if ((k === "Delete" || k === "Backspace") && !this.ro) {
      if (this.sel) { e.preventDefault(); this.excluirSelecionada(); return; }
      if (k === "Delete" && this.miniLista.contains(document.activeElement)) { e.preventDefault(); this.excluirPaginas(); return; }
    }
    if (k === "Escape") {
      if (this.acao) { this.cancelarAcao(); return; }
      if (this.sel) { this.selecionar(null); return; }
      if (!this.buscaEl.classList.contains("is-hidden")) { this.fecharBusca(); return; }
      if (this.ferramenta !== "selecionar") { this.escolherFerramenta("selecionar"); return; }
      return;
    }
    if (this.sel && !this.ro && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(k)) {
      e.preventDefault();
      const a = this.anotSelecionada(), p = this.porUid(this.sel.uid), g = this.geo(p);
      const passo = e.shiftKey ? 10 : 1;
      const [dx, dy] = girar(k === "ArrowLeft" ? [-passo, 0] : k === "ArrowRight" ? [passo, 0] : k === "ArrowUp" ? [0, -passo] : [0, passo], -g.R);
      if (!this._empurrando) { this.registrar(); this._empurrando = true; }
      clearTimeout(this._tEmpurrar);
      this._tEmpurrar = setTimeout(() => { this._empurrando = false; }, 700);
      Object.assign(a, transladar(structuredClone(a), dx, dy));
      this.alterou([p.uid]);
      return;
    }
    if (k === "PageDown" || k === "PageUp" || k === "Home" || k === "End") {
      if (document.activeElement !== this.rolagem) {
        e.preventDefault();
        if (k === "Home") this.irParaPagina(0); else if (k === "End") this.irParaPagina(this.paginas.length - 1);
        else this.rolagem.scrollBy({ top: (k === "PageDown" ? 1 : -1) * this.rolagem.clientHeight * 0.9 });
      }
    }
  }

  /** gesto de dois dedos: aproximar/afastar (zoom) e rolar, inclusive com a caneta ativa */
  configurarToque() {
    const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const meio = (a, b) => ({ clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 });
    this.ouvir(this.rolagem, "touchstart", e => {
      if (e.touches.length === 2) {
        this.cancelarAcao();
        const [a, b] = e.touches;
        this.gesto = { d0: dist(a, b), s0: this.escala, m: meio(a, b) };
      }
    }, { passive: true });
    this.ouvir(this.rolagem, "touchmove", e => {
      if (!this.gesto || e.touches.length !== 2) return;
      if (e.cancelable) e.preventDefault();
      const [a, b] = e.touches;
      const m = meio(a, b);
      const s = this.gesto.s0 * (dist(a, b) / Math.max(10, this.gesto.d0));
      if (Math.abs(s - this.escala) / this.escala > 0.01) this.definirZoom(s, { foco: m });
      this.rolagem.scrollLeft -= m.clientX - this.gesto.m.clientX;
      this.rolagem.scrollTop -= m.clientY - this.gesto.m.clientY;
      this.gesto.m = m;
    }, { passive: false });
    const fim = e => { if (this.gesto && e.touches.length < 2) this.gesto = null; };
    this.ouvir(this.rolagem, "touchend", fim, { passive: true });
    this.ouvir(this.rolagem, "touchcancel", fim, { passive: true });
  }

  configurarSoltarArquivos() {
    const temArquivos = e => [...(e.dataTransfer?.types || [])].includes("Files");
    this.ouvir(this.corpo, "dragover", e => { if (!temArquivos(e) || this.ro) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; this.corpo.classList.add("is-soltando"); });
    this.ouvir(this.corpo, "dragleave", e => { if (!this.corpo.contains(e.relatedTarget)) this.corpo.classList.remove("is-soltando"); });
    this.ouvir(this.corpo, "drop", async e => {
      this.corpo.classList.remove("is-soltando");
      if (!temArquivos(e) || this.ro) return;
      e.preventDefault();
      const f = e.dataTransfer.files?.[0];
      if (!f) return;
      const bytes = new Uint8Array(await f.arrayBuffer());
      if (/pdf$/i.test(f.type) || extname(f.name) === "pdf") { await this.juntarPdf({ bytes, nome: f.name }, "depois"); return; }
      if (/^image\//.test(f.type)) {
        const pagEl = e.target.closest?.(".pdf-pagina");
        const p = pagEl ? this.porUid(pagEl.dataset.uid) : null;
        const ponto = p ? (({ x, y }) => ({ x, y }))(this.ponto(e, this.est.get(p.uid), p)) : null;
        await this.inserirImagemBytes(bytes, f.type, { pagina: p, ponto });
        return;
      }
      notice("Solte um PDF (para juntar) ou uma imagem (para inserir na página).");
    });
  }

  // =================================================================== salvar, imprimir
  gerar(lista = this.paginas) {
    return gerarPdf({ fontes: this.fontes, paginas: lista, info: p => this.info(p), imagens: this.imagens });
  }

  async getSaveData() {
    if (this.ro || this.bloqueado || !this.fontes.length) return null;
    this.concluirEdicao();
    const bytes = await this.gerar(this.paginas);
    this.bytesSalvos = bytes;
    return bytes;
  }

  async save(o = {}) {
    if (this.ro || this.bloqueado) { if (this.bloqueado) notice("Este PDF é protegido e não pode ser alterado."); return false; }
    this.concluirEdicao();
    if (!this.dirty && o.explicit !== false) { notice("Nenhuma alteração para salvar.", { tempo: 1800 }); return true; }
    this.btnSalvar?.classList.add("is-salvando");
    const ok = await super.save(o);
    this.btnSalvar?.classList.remove("is-salvando");
    const b = this.bytesSalvos;
    this.bytesSalvos = null;
    if (ok && b && !this.fechado && !this.destruido) {
      const pos = { pagina: this.atual, top: this.rolagem.scrollTop, left: this.rolagem.scrollLeft };
      try { await this.abrirBytes(b, { manterPosicao: pos }); } catch (e) { erro("O arquivo foi salvo, mas não foi possível recarregá-lo.", e); }
    }
    return ok;
  }

  async imprimir() {
    this.concluirEdicao();
    const aviso = notice("Preparando a impressão…", { tempo: 0 });
    let doc = null;
    const urls = [];
    try {
      const bytes = this.dirty && !this.ro ? await this.gerar(this.paginas) : this.fontes[0].bytes;
      doc = await pdfjs.getDocument({ data: bytes.slice(), ...OPCOES_PDFJS() }).promise;
      const imgs = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const pg = await doc.getPage(i);
        const vp = pg.getViewport({ scale: 150 / 72 });
        const c = document.createElement("canvas");
        c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
        await pg.render({ canvas: c, viewport: vp }).promise;
        const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.92));
        const u = URL.createObjectURL(blob);
        urls.push(u);
        imgs.push(`<img src="${u}" style="aspect-ratio:${c.width}/${c.height}">`);
        c.width = c.height = 0;
      }
      const fr = document.createElement("iframe");
      fr.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0;visibility:hidden";
      document.body.appendChild(fr);
      const d = fr.contentDocument;
      d.open();
      d.write(`<!doctype html><html><head><meta charset="utf-8"><title>${stem(this.file.path).replace(/</g, "&lt;")}</title><style>@page{margin:0}html,body{margin:0;padding:0;background:#fff}img{display:block;width:100%;height:auto;page-break-after:always;break-after:page}img:last-child{page-break-after:auto;break-after:auto}</style></head><body>${imgs.join("")}</body></html>`);
      d.close();
      const imagens = [...d.images];
      await Promise.all(imagens.map(im => (im.complete ? null : new Promise(r => { im.onload = im.onerror = r; }))));
      aviso.hide();
      const limpar = () => { setTimeout(() => { fr.remove(); urls.forEach(u => URL.revokeObjectURL(u)); }, 1000); };
      fr.contentWindow.addEventListener("afterprint", limpar, { once: true });
      fr.contentWindow.focus();
      fr.contentWindow.print();
      setTimeout(limpar, 120000);
    } catch (e) {
      aviso.hide();
      urls.forEach(u => URL.revokeObjectURL(u));
      erro("Não foi possível preparar a impressão.", e);
    } finally { destruir(doc); }
  }

  // =================================================================== integração com o app
  menuMais(e) {
    const m = new Menu();
    this.onPaneMenu(m, { completo: true });
    m.showBelow(e.currentTarget);
  }

  onPaneMenu(m, { completo = false } = {}) {
    if (!this.paginas?.length) return;
    m.addItem({ title: "Procurar no PDF…", icon: "search", hotkey: "Ctrl+F", onClick: () => this.abrirBusca() });
    m.addItem({ title: this.miniAberto ? "Ocultar miniaturas" : "Mostrar miniaturas", icon: "sidebar-left", onClick: () => this.alternarMiniaturas() });
    if (completo || this.mobile) {
      m.addItem({ title: "Ajustar à largura", icon: "maximize", onClick: () => this.definirZoom(this.calcularAjuste("largura"), { modo: "largura" }) });
      m.addItem({ title: "Página inteira", icon: "minimize", onClick: () => this.definirZoom(this.calcularAjuste("pagina"), { modo: "pagina" }) });
      if (this.mobile) {
        m.addItem({ title: "Aumentar zoom", icon: "zoom-in", onClick: () => this.zoomPasso(1) });
        m.addItem({ title: "Diminuir zoom", icon: "zoom-out", onClick: () => this.zoomPasso(-1) });
      }
    }
    if (!this.ro) {
      m.addSeparator();
      const lista = this.alvoPaginas();
      const rot = lista.length > 1 ? ` (${lista.length} páginas)` : "";
      m.addItem({ title: "Girar página para a esquerda" + rot, icon: "rotate-ccw", onClick: () => this.girarPaginas(-90, lista) });
      m.addItem({ title: "Girar página para a direita" + rot, icon: "rotate-cw", onClick: () => this.girarPaginas(90, lista) });
      m.addItem({ title: "Inserir páginas de outro PDF…", icon: "merge", onClick: () => this.menuJuntar(null) });
      m.addItem({ title: "Extrair páginas para um novo PDF" + rot, icon: "scissors", onClick: () => this.extrairPaginas(lista) });
      m.addItem({ title: lista.length > 1 ? `Excluir ${lista.length} páginas` : "Excluir página atual", icon: "trash", warning: true, onClick: () => this.excluirPaginas(lista) });
    }
    m.addSeparator();
    m.addItem({ title: "Imprimir", icon: "printer", onClick: () => this.imprimir() });
  }

  getCommands() {
    if (!this.paginas?.length) return [];
    const C = (id, nome, fn, tecla) => ({ id: "pdf-" + id, nome: "PDF: " + nome, fn, tecla });
    const lista = [
      C("buscar", "Procurar no PDF", () => this.abrirBusca(), "Ctrl+F"),
      C("ir", "Ir para a página…", () => { this.pagInput.focus(); }),
      C("miniaturas", "Mostrar/ocultar miniaturas", () => this.alternarMiniaturas()),
      C("ajustar", "Ajustar à largura", () => this.definirZoom(this.calcularAjuste("largura"), { modo: "largura" }), "Ctrl+0"),
      C("zoom-mais", "Aumentar zoom", () => this.zoomPasso(1), "Ctrl+="),
      C("zoom-menos", "Diminuir zoom", () => this.zoomPasso(-1), "Ctrl+-"),
      C("imprimir", "Imprimir", () => this.imprimir()),
    ];
    if (!this.ro) lista.push(
      C("desfazer", "Desfazer", () => this.desfazer(), "Ctrl+Z"),
      C("refazer", "Refazer", () => this.refazer(), "Ctrl+Y"),
      C("assinar", "Assinar", () => this.inserirAssinatura()),
      C("texto", "Inserir texto", () => this.escolherFerramenta("texto")),
      C("marca-texto", "Marca-texto", () => this.escolherFerramenta("destaque")),
      C("caneta", "Caneta", () => this.escolherFerramenta("caneta")),
      C("imagem", "Inserir imagem do computador", () => this.inserirImagemArquivo()),
      C("girar-direita", "Girar página para a direita", () => this.girarPaginas(90)),
      C("girar-esquerda", "Girar página para a esquerda", () => this.girarPaginas(-90)),
      C("excluir-pagina", "Excluir página atual", () => this.excluirPaginas()),
      C("juntar-cofre", "Juntar páginas de outro PDF do cofre", () => this.juntarPdf("cofre")),
      C("juntar-computador", "Juntar páginas de um PDF do computador", () => this.juntarPdf("computador")),
      C("extrair", "Extrair páginas para um novo PDF", () => this.extrairPaginas()),
    );
    return lista;
  }

  getStatus() {
    if (!this.paginas?.length) return [];
    const itens = [
      { texto: `Página ${this.atual + 1} de ${this.paginas.length}`, title: "Ir para a página…", onClick: () => { this.pagInput.focus(); } },
      { texto: `${Math.round((this.escala / PX_POR_PT) * 100)}%`, title: "Zoom", onClick: e => this.menuZoom(e) },
    ];
    if (this.bloqueado) itens.unshift({ icon: "lock", texto: "Protegido", title: "PDF protegido por senha: somente leitura" });
    return itens;
  }

  getMobileToolbar() {
    if (this.ro) return [];
    return [
      { icon: "minus", title: "Letra menor", fn: () => this.mudarTamanho(-1) },
      { icon: "plus", title: "Letra maior", fn: () => this.mudarTamanho(1) },
      { icon: "palette", title: "Cor", fn: () => { const b = this.barraAnot?.querySelector(".pdf-btn-cor"); if (b) this.menuCor(b); } },
      { icon: "check", title: "Concluir", fn: () => this.concluirEdicao() },
      { icon: "trash", title: "Excluir", fn: () => this.excluirSelecionada() },
      { icon: "undo", title: "Desfazer", fn: () => this.desfazer() },
    ];
  }

  onResize() {
    if (this.modoZoom && this.paginas?.length) this.definirZoom(this.calcularAjuste(this.modoZoom), { modo: this.modoZoom });
  }

  focus() { if (!this.editando) this.rolagem?.focus({ preventScroll: true }); }

  async onClose() {
    this.fechado = true;
    this.fecharPopover?.();
    this.cancelarAcao();
    clearTimeout(this._tZoom); clearTimeout(this._tBusca);
    if (this._rafRender) cancelAnimationFrame(this._rafRender);
    this._rafRender = 0;
    this.limpezas?.forEach(f => f());
    this.limpezas = [];
    this.obs?.disconnect(); this.obsMini?.disconnect(); this.obsTamanho?.disconnect();
    for (const st of this.est?.values() || []) this.descartarPagina(st);
    this.est?.clear(); this.minis?.clear();
    for (const f of this.fontes || []) await destruir(f.doc);
    this.fontes = [];
    for (const im of this.imagens?.values() || []) URL.revokeObjectURL(im.url);
    this.imagens?.clear();
    this.pdfPaginas?.clear(); this.textos?.clear();
    if (this.sumario) { this.sumario = null; this.app.emit("outline-changed"); }
  }
}
