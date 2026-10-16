// Editor de documentos Word (.docx): mostra o documento com a formatação original e edita no próprio lugar.
// Ao salvar, só os parágrafos tocados mudam no XML; o resto do arquivo fica byte a byte igual.
import JSZip from "jszip";
import { parseAsync, renderDocument } from "./vendor/docx-preview.mjs";
import { Reconciliador, W, ehW, filhos, filhoW, novoW, textoDoRun } from "./reconciliar.js";
import { h, vazio, debounce } from "../util/dom.js";
import { icon, iconButton } from "../util/icons.js";
import { FileView } from "../views/base.js";
import { notice, erro } from "../ui/notice.js";
import { Menu } from "../ui/menu.js";
import { basename, stem } from "../util/path.js";

let seqDoc = 0;
const FONTES = ["Arial", "Calibri", "Cambria", "Courier New", "Garamond", "Georgia", "Tahoma", "Times New Roman", "Trebuchet MS", "Verdana", "Aptos"];
const TAMANHOS = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72];

export class DocxView extends FileView {
  getViewType() { return "docx"; }

  async onLoadFile(dados) {
    this.dadosOriginais = dados;
    this.contentEl.classList.add("docx-view-content");
    this.classe = "docx-t" + (++seqDoc);
    this.barra = this.somenteLeitura ? null : this.montarBarra();
    this.area = h("div.docx-area");
    this.estilosEl = h("div.docx-estilos");
    this.paginas = h("div.docx-paginas.tinteiro-docx");
    this.area.append(this.estilosEl, this.paginas);
    this.contentEl.append(...[this.barra, this.area].filter(Boolean));
    this.zoom = Number(localStorage.getItem("tinteiro.docx.zoom")) || 0; // 0 = automático
    await this.desenhar(dados);
    if (!this.somenteLeitura) {
      this.addAction("save", "Salvar (Ctrl+S)", () => this.save({ explicit: true }), "mod-save");
      if (this.app.backend.caps.openExternal) this.addAction("external-link", "Abrir no Word", () => this.abrirNoWord());
    }
    this.area.addEventListener("wheel", e => { if (!e.ctrlKey) return; e.preventDefault(); this.definirZoom((this.zoomAtual || 1) * (e.deltaY < 0 ? 1.1 : 1 / 1.1)); }, { passive: false });
  }

  async desenhar(dados, { manterRolagem = false } = {}) {
    const rolagem = this.area.scrollTop;
    this.observador?.disconnect();
    const rec = new Reconciliador();
    this.rec = rec;
    this.zip = await JSZip.loadAsync(dados);
    this.doc = await parseAsync(dados, { keepOrigin: true, className: this.classe, inWrapper: true, ignoreLastRenderedPageBreak: true, breakPages: true, experimental: true, renderChanges: false, useBase64URL: false });
    // partes XML → caminho no zip, e a declaração <?xml ?> original de cada uma
    this.partes = new Map();
    this.declaracoes = new Map();
    for (const p of this.doc.parts) {
      if (!p._xmlDocument) continue;
      this.partes.set(p._xmlDocument, p.path);
      const txt = await this.zip.file(p.path)?.async("string");
      const m = txt && /^﻿?(<\?xml[^?]*\?>)(\r?\n)?/.exec(txt);
      this.declaracoes.set(p.path, m ? m[1] + (m[2] || "") : "");
    }
    const nos = await renderDocument(this.doc, { className: this.classe, inWrapper: true, ignoreLastRenderedPageBreak: true, breakPages: true, experimental: true, registrar: (el, modelo) => rec.registrar(el, modelo) });
    vazio(this.estilosEl); vazio(this.paginas);
    for (const n of nos) (n.nodeName === "STYLE" ? this.estilosEl : this.paginas).appendChild(n);
    this.wrapper = this.paginas.querySelector(`.${this.classe}-wrapper`) || this.paginas.firstElementChild;
    this.prepararEdicao();
    rec.fotografar(this.paginas);
    this.calcularEstrutura();
    this.aplicarZoom();
    if (manterRolagem) this.area.scrollTop = rolagem;
    // o observador só anota quais parágrafos foram tocados; "não salvo" vem dos eventos de edição
    this.observador = new MutationObserver(regs => {
      if (this.somenteLeitura) return;
      const relevantes = regs.filter(r => !(r.type === "attributes" && (r.attributeName === "data-x" || r.target.dataset?.tab || r.target.tagName === "IMG")));
      if (relevantes.length) rec.marcar(relevantes);
    });
    this.observador.observe(this.paginas, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["style", "class"] });
    this.app.emit("outline-changed");
    this.app.atualizarStatus();
  }

  /** deixa o corpo e as células editáveis; cabeçalho, rodapé e imagens ficam protegidos */
  prepararEdicao() {
    const rec = this.rec;
    const corpoXml = this.doc.documentPart._xmlDocument.getElementsByTagNameNS(W, "body")[0];
    const artigos = [...this.paginas.querySelectorAll(`section.${this.classe} > article`)];
    const hostCorpo = { els: artigos, container: corpoXml, paragrafos: new Set(), tabelas: new Set() };
    rec.hosts = [hostCorpo];
    const hostDe = new Map(artigos.map(a => [a, hostCorpo]));
    for (const td of this.paginas.querySelectorAll("td")) {
      const x = rec.xmlDe(td);
      if (!x || !ehW(x, "tc")) continue;
      const host = { els: [td], container: x, paragrafos: new Set(), tabelas: new Set() };
      rec.hosts.push(host);
      hostDe.set(td, host);
    }
    const hostDoElemento = el => { for (let e = el.parentElement; e; e = e.parentElement) if (hostDe.has(e)) return hostDe.get(e); return null; };
    for (const p of this.paginas.querySelectorAll("p")) {
      const x = rec.reg.get(p)?.xml;
      if (!x || !ehW(x, "p")) continue;
      const host = hostDoElemento(p);
      if (host && host.els[0].closest("header,footer") === null) host.paragrafos.add(x);
      // parágrafo vazio precisa de altura para o cursor
      if (!p.textContent && !p.querySelector("br,img,[data-desenho]")) p.appendChild(document.createElement("br"));
    }
    for (const t of this.paginas.querySelectorAll("table")) {
      const x = rec.reg.get(t)?.xml;
      const host = hostDoElemento(t);
      if (x && host) host.tabelas.add(x);
    }
    if (this.somenteLeitura) return;
    for (const a of artigos) { a.contentEditable = "true"; a.spellcheck = this.app.config.verificarOrtografia !== false; a.setAttribute("lang", "pt-BR"); }
    for (const t of this.paginas.querySelectorAll("article table")) t.contentEditable = "false";
    for (const td of this.paginas.querySelectorAll("article td")) { if (td.style.display !== "none") td.contentEditable = "true"; }
    for (const hf of this.paginas.querySelectorAll("header, footer")) { hf.contentEditable = "false"; hf.title = "Cabeçalho e rodapé não são editados aqui (use “Abrir no Word”)."; }
    document.execCommand("defaultParagraphSeparator", false, "p");
    if (this._eventos) return;
    this._eventos = true;
    this.paginas.addEventListener("keydown", e => this.tecla(e));
    this.paginas.addEventListener("input", () => { this.setDirty(true); this.atualizarStatus(); });
    this.paginas.addEventListener("paste", e => this.colar(e));
    this.paginas.addEventListener("drop", e => { if (e.dataTransfer?.files?.length) e.preventDefault(); });
    this.paginas.addEventListener("contextmenu", e => this.menuContexto(e));
    document.addEventListener("selectionchange", this._sel = debounce(() => this.atualizarBarra(), 80));
  }

  // ------------------------------------------------------------ barra de formatação
  montarBarra() {
    const b = (ic, t, fn) => { const el = iconButton(ic, t, fn, "clickable-icon docx-tool"); el.addEventListener("mousedown", e => e.preventDefault()); return el; };
    this.selFonte = h("select.docx-select.mod-fonte", { title: "Fonte" }, FONTES.map(f => h("option", { value: f, text: f })));
    this.selTam = h("select.docx-select.mod-tamanho", { title: "Tamanho" }, TAMANHOS.map(t => h("option", { value: String(t), text: String(t).replace(".", ",") })));
    this.selFonte.addEventListener("change", () => this.aplicarFonte(this.selFonte.value));
    this.selTam.addEventListener("change", () => this.aplicarTamanho(Number(this.selTam.value)));
    for (const s of [this.selFonte, this.selTam]) { s.addEventListener("mousedown", () => this.guardarSelecao()); s.addEventListener("focus", () => this.guardarSelecao()); }
    this.botoes = {
      b: b("bold", "Negrito (Ctrl+B)", () => this.cmd("bold")),
      i: b("italic", "Itálico (Ctrl+I)", () => this.cmd("italic")),
      u: b("underline", "Sublinhado (Ctrl+U)", () => this.cmd("underline")),
      s: b("strikethrough", "Tachado", () => this.cmd("strikeThrough")),
      esq: b("align-left", "Alinhar à esquerda", () => this.cmd("justifyLeft")),
      cen: b("align-center", "Centralizar", () => this.cmd("justifyCenter")),
      dir: b("align-right", "Alinhar à direita", () => this.cmd("justifyRight")),
      jus: b("align-justify", "Justificar", () => this.cmd("justifyFull")),
    };
    const cor = h("input.docx-cor", { type: "color", value: "#c00000", title: "Cor do texto" });
    cor.addEventListener("mousedown", () => this.guardarSelecao());
    cor.addEventListener("input", () => { this.restaurarSelecao(); this.cmd("foreColor", cor.value); });
    const sep = () => h("div.docx-sep");
    this.zoomEl = h("div.docx-zoom-valor", { title: "Zoom (Ctrl + roda do mouse)" });
    return h("div.docx-toolbar",
      b("undo", "Desfazer (Ctrl+Z)", () => this.cmd("undo")), b("redo", "Refazer (Ctrl+Y)", () => this.cmd("redo")), sep(),
      this.selFonte, this.selTam, sep(),
      this.botoes.b, this.botoes.i, this.botoes.u, this.botoes.s,
      h("label.docx-cor-btn.clickable-icon", { title: "Cor do texto" }, icon("baseline"), cor),
      b("highlighter", "Marca-texto", () => this.cmd("hiliteColor", "#ffff00")),
      b("eraser", "Limpar cor e marca-texto", () => { this.cmd("hiliteColor", "transparent"); }), sep(),
      this.botoes.esq, this.botoes.cen, this.botoes.dir, this.botoes.jus, sep(),
      b("search", "Procurar no documento (Ctrl+F)", () => this.abrirBusca()),
      h("div.docx-spacer"),
      b("zoom-out", "Diminuir zoom", () => this.definirZoom((this.zoomAtual || 1) / 1.15)),
      this.zoomEl,
      b("zoom-in", "Aumentar zoom", () => this.definirZoom((this.zoomAtual || 1) * 1.15)),
      b("maximize", "Ajustar à largura", () => { this.zoom = 0; localStorage.setItem("tinteiro.docx.zoom", "0"); this.aplicarZoom(); }));
  }

  guardarSelecao() { const s = getSelection(); if (s.rangeCount && this.paginas.contains(s.anchorNode)) this.selSalva = s.getRangeAt(0).cloneRange(); }
  restaurarSelecao() { if (this.selSalva) { const s = getSelection(); s.removeAllRanges(); s.addRange(this.selSalva); } }

  cmd(nome, valor = null) {
    if (this.somenteLeitura) return;
    const s = getSelection();
    if (!s.rangeCount || !this.paginas.contains(s.anchorNode)) { if (nome !== "undo" && nome !== "redo") return; this.focus(); }
    document.execCommand("styleWithCSS", false, nome === "hiliteColor" || nome === "foreColor");
    document.execCommand(nome, false, valor);
    this.atualizarBarra();
  }

  /** envolve a seleção com um <span> marcado (tamanho/fonte vão para o arquivo pelo atributo) */
  envolverSelecao(atributo, valor, estilo) {
    this.restaurarSelecao();
    const s = getSelection();
    if (!s.rangeCount || s.isCollapsed || !this.paginas.contains(s.anchorNode)) { notice("Selecione o texto primeiro."); return; }
    // usa o comando nativo (desfazer funciona) e troca o <font> gerado por <span> com o valor exato
    document.execCommand("styleWithCSS", false, false);
    document.execCommand("fontName", false, "__tinteiro__");
    for (const f of this.paginas.querySelectorAll('font[face="__tinteiro__"]')) {
      const sp = document.createElement("span");
      sp.dataset[atributo] = valor;
      Object.assign(sp.style, estilo);
      while (f.firstChild) sp.appendChild(f.firstChild);
      f.replaceWith(sp);
    }
    this.atualizarBarra();
  }
  aplicarFonte(f) { this.envolverSelecao("fonte", f, { fontFamily: `"${f}"` }); }
  aplicarTamanho(t) { this.envolverSelecao("tam", String(t), { fontSize: t + "pt" }); }

  atualizarBarra() {
    if (!this.botoes) return;
    const s = getSelection();
    if (!s.rangeCount || !this.paginas.contains(s.anchorNode)) return;
    const el = s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement;
    const cs = getComputedStyle(el);
    this.botoes.b.classList.toggle("is-active", Number(cs.fontWeight) >= 600);
    this.botoes.i.classList.toggle("is-active", cs.fontStyle === "italic");
    this.botoes.u.classList.toggle("is-active", cs.textDecorationLine.includes("underline"));
    this.botoes.s.classList.toggle("is-active", cs.textDecorationLine.includes("line-through"));
    const bloco = el.closest("p, td") || el;
    const al = getComputedStyle(bloco).textAlign;
    this.botoes.esq.classList.toggle("is-active", al === "left" || al === "start");
    this.botoes.cen.classList.toggle("is-active", al === "center");
    this.botoes.dir.classList.toggle("is-active", al === "right" || al === "end");
    this.botoes.jus.classList.toggle("is-active", al === "justify");
    const fam = cs.fontFamily.split(",")[0].replace(/["']/g, "").trim();
    if (document.activeElement !== this.selFonte) { if (![...this.selFonte.options].some(o => o.value === fam)) this.selFonte.appendChild(h("option", { value: fam, text: fam })); this.selFonte.value = fam; }
    const pt = Math.round(parseFloat(cs.fontSize) * 0.75 * 2) / 2;
    if (document.activeElement !== this.selTam) { if (![...this.selTam.options].some(o => Number(o.value) === pt)) this.selTam.appendChild(h("option", { value: String(pt), text: String(pt).replace(".", ",") })); this.selTam.value = String(pt); }
  }

  tecla(e) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.shiftKey && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === "b") { e.preventDefault(); this.cmd("bold"); return; }
      if (k === "i") { e.preventDefault(); this.cmd("italic"); return; }
      if (k === "u") { e.preventDefault(); this.cmd("underline"); return; }
      if (k === "f") { e.preventDefault(); this.abrirBusca(); return; }
      if (k === "e") { e.preventDefault(); this.cmd("justifyCenter"); return; }
      if (k === "j") { e.preventDefault(); this.cmd("justifyFull"); return; }
      if (k === "l") { e.preventDefault(); this.cmd("justifyLeft"); return; }
      if (k === "r") { e.preventDefault(); this.cmd("justifyRight"); return; }
    }
    if (e.key === "Tab") {
      const td = e.target.closest?.("td") || getSelection().anchorNode?.parentElement?.closest("td");
      if (td) {
        e.preventDefault();
        const cels = [...td.closest("table").querySelectorAll("td")].filter(c => c.style.display !== "none" && c.closest("table") === td.closest("table"));
        const i = cels.indexOf(td);
        const alvo = cels[i + (e.shiftKey ? -1 : 1)];
        if (alvo) { alvo.focus(); const r = document.createRange(); r.selectNodeContents(alvo); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
        return;
      }
      e.preventDefault();
      document.execCommand("insertText", false, "\t");
      return;
    }
    if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); document.execCommand("insertLineBreak"); }
  }

  colar(e) {
    // cola só texto (sem trazer estilos de outros programas para dentro do XML)
    const t = e.clipboardData?.getData("text/plain");
    if (t === undefined || t === null) return;
    e.preventDefault();
    const linhas = t.replace(/\r\n?/g, "\n").split("\n");
    linhas.forEach((l, i) => { if (i) document.execCommand("insertParagraph"); if (l) document.execCommand("insertText", false, l); });
  }

  // ------------------------------------------------------------ zoom
  larguraPagina() { const s = this.paginas.querySelector(`section.${this.classe}`); return s ? s.offsetWidth : 794; }
  aplicarZoom() {
    const disp = this.area.clientWidth - (this.app.isMobile ? 16 : 48);
    const auto = Math.min(1, disp / (this.larguraPagina() + 2));
    const z = this.zoom || auto;
    this.zoomAtual = z;
    if (this.wrapper) this.wrapper.style.zoom = String(z);
    if (this.zoomEl) this.zoomEl.textContent = Math.round(z * 100) + "%";
  }
  definirZoom(z) { this.zoom = Math.max(0.3, Math.min(3, z)); localStorage.setItem("tinteiro.docx.zoom", String(this.zoom)); this.aplicarZoom(); }
  onResize() { if (!this.zoom) this.aplicarZoom(); }

  // ------------------------------------------------------------ salvar
  async getSaveData() {
    if (this.somenteLeitura) return null;
    this.rec.marcar(this.observador.takeRecords());
    this.rec.aplicar();
    for (const doc of this.rec.alteradas) {
      const caminho = this.partes.get(doc);
      if (!caminho) continue;
      const xml = this.declaracoes.get(caminho) + new XMLSerializer().serializeToString(doc);
      this.zip.file(caminho, xml, { createFolders: false });
    }
    this.rec.alteradas.clear();
    return this.zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 }, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }

  async save(o = {}) {
    const ok = await super.save(o);
    if (ok) { this.calcularEstrutura(); this.app.emit("outline-changed"); }
    return ok;
  }

  async canClose() { return super.canClose(); }

  async onClose() {
    this.observador?.disconnect();
    if (this._sel) document.removeEventListener("selectionchange", this._sel);
  }

  focus() {
    if (this.somenteLeitura) return;
    const s = getSelection();
    if (s.rangeCount && this.paginas.contains(s.anchorNode)) return;
    const a = this.paginas.querySelector("article");
    if (a) a.focus({ preventScroll: true });
  }

  // ------------------------------------------------------------ menu, tabelas
  menuContexto(e) {
    const td = e.target.closest("td");
    if (!td || this.somenteLeitura) return;
    e.preventDefault();
    const m = new Menu();
    m.addItem({ title: "Inserir linha abaixo", icon: "plus", onClick: () => this.operacaoTabela(td, "linha-abaixo") });
    m.addItem({ title: "Inserir linha acima", icon: "plus", onClick: () => this.operacaoTabela(td, "linha-acima") });
    m.addItem({ title: "Excluir linha", icon: "trash", onClick: () => this.operacaoTabela(td, "excluir-linha") });
    m.addSeparator();
    m.addItem({ title: "Copiar", icon: "copy", onClick: () => document.execCommand("copy") });
    m.addItem({ title: "Colar", onClick: async () => { try { const t = await navigator.clipboard.readText(); document.execCommand("insertText", false, t); } catch (err) { notice("Use Ctrl+V para colar."); } } });
    m.showAtMouseEvent(e);
  }

  /** muda a estrutura da tabela no XML e redesenha o documento */
  async operacaoTabela(td, op) {
    const tr = td.closest("tr");
    const trXml = this.rec.xmlDe(tr);
    if (!trXml || !ehW(trXml, "tr")) return notice("Não foi possível alterar esta tabela.");
    this.rec.marcar(this.observador.takeRecords());
    this.rec.aplicar();
    if (op === "excluir-linha") {
      const tbl = trXml.parentNode;
      if (filhos(tbl).filter(c => ehW(c, "tr")).length <= 1) return notice("A tabela precisa de pelo menos uma linha.");
      trXml.remove();
    } else {
      const novo = trXml.cloneNode(true);
      // limpa o texto das células da cópia, mantendo bordas, larguras e estilos
      for (const tc of filhos(novo).filter(c => ehW(c, "tc"))) {
        const ps = filhos(tc).filter(c => ehW(c, "p"));
        for (const x of filhos(tc)) if (!ehW(x, "tcPr") && x !== ps[0]) x.remove();
        if (ps[0]) for (const x of filhos(ps[0])) if (!ehW(x, "pPr")) x.remove();
        else tc.appendChild(novoW(tc.ownerDocument, "p"));
        const vm = filhoW(filhoW(tc, "tcPr") || tc, "vMerge");
        if (vm && vm.getAttributeNS(W, "val") === "restart") vm.removeAttributeNS(W, "val");
      }
      trXml.parentNode.insertBefore(novo, op === "linha-acima" ? trXml : trXml.nextSibling);
    }
    this.rec.alteradas.add(trXml.ownerDocument);
    const dados = await this.getSaveDataSemAplicar();
    await this.desenhar(dados, { manterRolagem: true });
    this.setDirty(true);
  }

  async getSaveDataSemAplicar() {
    for (const doc of this.rec.alteradas) {
      const caminho = this.partes.get(doc);
      if (caminho) this.zip.file(caminho, this.declaracoes.get(caminho) + new XMLSerializer().serializeToString(doc), { createFolders: false });
    }
    this.rec.alteradas.clear();
    return this.zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  }

  abrirNoWord() {
    if (this.dirty) notice("Salve antes (Ctrl+S) para o Word abrir a versão com suas alterações.");
    this.app.abrirNoPrograma(this.file.path);
  }

  // ------------------------------------------------------------ busca no documento
  abrirBusca() {
    if (this.buscaEl) { this.buscaInput.focus(); this.buscaInput.select(); return; }
    this.buscaInput = h("input", { type: "search", placeholder: "Procurar no documento…", spellcheck: "false" });
    this.buscaInfo = h("span.docx-busca-info");
    this.buscaEl = h("div.docx-busca", this.buscaInput, this.buscaInfo,
      iconButton("arrow-up", "Anterior", () => this.proximo(-1)), iconButton("arrow-down", "Próximo", () => this.proximo(1)),
      iconButton("x", "Fechar", () => this.fecharBusca()));
    this.contentEl.insertBefore(this.buscaEl, this.area);
    this.buscaInput.addEventListener("input", debounce(() => this.buscar(this.buscaInput.value), 150));
    this.buscaInput.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); this.proximo(e.shiftKey ? -1 : 1); } if (e.key === "Escape") this.fecharBusca(); });
    const sel = getSelection().toString().trim();
    if (sel && sel.length < 80) { this.buscaInput.value = sel; this.buscar(sel); }
    this.buscaInput.focus();
  }
  fecharBusca() { this.buscaEl?.remove(); this.buscaEl = null; if (window.CSS?.highlights) CSS.highlights.delete("tinteiro-busca"); }
  buscar(q) {
    this.achados = [];
    this.achadoAtual = -1;
    const dob = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (q) {
      const alvo = dob(q);
      const tw = document.createTreeWalker(this.paginas, NodeFilter.SHOW_TEXT);
      for (let n = tw.nextNode(); n; n = tw.nextNode()) {
        const t = dob(n.data);
        let i = t.indexOf(alvo);
        while (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + alvo.length); this.achados.push(r); i = t.indexOf(alvo, i + alvo.length); }
      }
    }
    if (window.CSS?.highlights && window.Highlight) CSS.highlights.set("tinteiro-busca", new Highlight(...this.achados));
    this.buscaInfo && (this.buscaInfo.textContent = q ? `${this.achados.length} encontrado${this.achados.length === 1 ? "" : "s"}` : "");
    if (this.achados.length) this.proximo(1);
  }
  proximo(d) {
    if (!this.achados?.length) return;
    this.achadoAtual = (this.achadoAtual + d + this.achados.length) % this.achados.length;
    const r = this.achados[this.achadoAtual];
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    r.startContainer.parentElement.scrollIntoView({ block: "center" });
    if (this.buscaInfo) this.buscaInfo.textContent = `${this.achadoAtual + 1} de ${this.achados.length}`;
  }
  destacarBusca(q) { this.abrirBusca(); this.buscaInput.value = q; this.buscar(q); }

  // ------------------------------------------------------------ estrutura, status, impressão
  calcularEstrutura() {
    const niveis = new Map();
    try {
      const st = this.doc.stylesPart?._xmlDocument;
      if (st) for (const s of st.getElementsByTagNameNS(W, "style")) {
        const id = s.getAttributeNS(W, "styleId");
        const nome = (filhoW(s, "name")?.getAttributeNS(W, "val") || "").toLowerCase();
        const ol = filhoW(filhoW(s, "pPr") || s, "outlineLvl")?.getAttributeNS(W, "val");
        const m = /^(heading|título|titulo)\s*(\d)$/.exec(nome);
        if (ol !== undefined && ol !== null && ol !== "" && Number(ol) < 9) niveis.set(id, Number(ol) + 1);
        else if (m) niveis.set(id, Number(m[2]));
        else if (nome === "title" || nome === "título") niveis.set(id, 1);
      }
    } catch (e) {}
    this.estrutura = [];
    for (const p of this.paginas.querySelectorAll("article p")) {
      const x = this.rec.xmlDe(p);
      if (!x || !ehW(x, "p")) continue;
      const ppr = filhoW(x, "pPr");
      let nivel = null;
      const ol = ppr && filhoW(ppr, "outlineLvl")?.getAttributeNS(W, "val");
      if (ol !== null && ol !== undefined && ol !== "" && Number(ol) < 9) nivel = Number(ol) + 1;
      else { const est = ppr && filhoW(ppr, "pStyle")?.getAttributeNS(W, "val"); if (est && niveis.has(est)) nivel = niveis.get(est); }
      const texto = p.textContent.trim();
      if (nivel && texto) this.estrutura.push({ nivel, texto: texto.slice(0, 120), el: p });
    }
  }
  getOutline() { return this.estrutura || []; }
  revealOutline(it) { it.el.scrollIntoView({ block: "start", behavior: "smooth" }); }

  atualizarStatus = debounce(() => this.app.atualizarStatus(), 400);
  getStatus() {
    if (!this.paginas) return [];
    const txt = this.paginas.querySelector("article") ? [...this.paginas.querySelectorAll("article")].map(a => a.innerText).join("\n") : "";
    const palavras = (txt.match(/[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu) || []).length;
    const paginas = this.paginas.querySelectorAll(`section.${this.classe}`).length;
    return [{ texto: `${palavras.toLocaleString("pt-BR")} palavras` }, { texto: `${paginas} ${paginas === 1 ? "seção" : "seções"}`, title: "Quebras de página e seções do documento" }];
  }

  getCommands() {
    return [
      { id: "docx-buscar", nome: "Procurar no documento", fn: () => this.abrirBusca(), tecla: "Ctrl+F" },
      { id: "docx-word", nome: "Abrir este documento no Word", fn: () => this.abrirNoWord() },
      { id: "docx-imprimir", nome: "Imprimir documento", fn: () => this.imprimir() },
    ];
  }
  onPaneMenu(m) {
    m.addItem({ title: "Procurar no documento", icon: "search", onClick: () => this.abrirBusca() });
    m.addItem({ title: "Imprimir", icon: "printer", onClick: () => this.imprimir() });
    if (this.app.backend.caps.openExternal) m.addItem({ title: "Abrir no Word", icon: "external-link", onClick: () => this.abrirNoWord() });
  }
  getMobileToolbar() {
    const c = n => () => this.cmd(n);
    return [
      { icon: "undo", title: "Desfazer", fn: c("undo") }, { icon: "redo", title: "Refazer", fn: c("redo") },
      { icon: "bold", title: "Negrito", fn: c("bold") }, { icon: "italic", title: "Itálico", fn: c("italic") }, { icon: "underline", title: "Sublinhado", fn: c("underline") },
      { icon: "align-left", title: "Esquerda", fn: c("justifyLeft") }, { icon: "align-center", title: "Centro", fn: c("justifyCenter") }, { icon: "align-justify", title: "Justificar", fn: c("justifyFull") },
      { icon: "highlighter", title: "Marca-texto", fn: () => this.cmd("hiliteColor", "#ffff00") },
    ];
  }

  imprimir() {
    const fr = document.createElement("iframe");
    fr.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
    document.body.appendChild(fr);
    const d = fr.contentDocument;
    const corpo = this.wrapper.cloneNode(true);
    corpo.style.zoom = "1";
    for (const e of corpo.querySelectorAll("[contenteditable]")) e.removeAttribute("contenteditable");
    d.open();
    d.write(`<!doctype html><html><head><meta charset="utf-8"><title>${stem(this.file.path)}</title>${this.estilosEl.innerHTML}<style>@page{margin:0;size:auto}body{margin:0;background:white}.${this.classe}-wrapper{background:white!important;padding:0!important;display:block!important}.${this.classe}-wrapper>section.${this.classe}{box-shadow:none!important;margin:0!important;page-break-after:always}</style></head><body>${corpo.outerHTML}</body></html>`);
    d.close();
    setTimeout(() => { fr.contentWindow.focus(); fr.contentWindow.print(); setTimeout(() => fr.remove(), 1500); }, 500);
  }
}
