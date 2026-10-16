// Editor de planilhas (.xlsx e .csv): grade com fórmulas, formatação, abas, busca e gravação sem estragar o arquivo.
import { FileView } from "../views/base.js";
import { h, vazio, debounce, escapeHtml } from "../util/dom.js";
import { icon, iconButton } from "../util/icons.js";
import { Menu } from "../ui/menu.js";
import { notice, erro } from "../ui/notice.js";
import { confirmar, perguntar } from "../ui/modal.js";
import { extname, stem } from "../util/path.js";
import { lerXlsx } from "./xlsx-leitor.js";
import { dadosCsv } from "./csv.js";
import { Pasta } from "./modelo.js";
import { Grade } from "./grade.js";
import { gravarXlsx, gravarCsv } from "./gravacao.js";
import { chave, nomeCelula, nomeIntervalo, lerIntervalo, lerCelula, MAX_LINHAS, MAX_COLUNAS, citarFolha } from "./enderecos.js";
import { FORMATOS_PADRAO, mudarCasas, casasDecimais, formatoGeral, hojeSerial } from "./formatos.js";
import { paraIngles, paraPortugues, transladarFormula } from "./formula.js";
import { listaFuncoesPt, DICAS } from "./funcoes.js";

// área de transferência interna (para colar fórmulas e formatos entre células e entre planilhas abertas)
let transferencia = null;

const PALETA = [
  ["000000", "434343", "666666", "999999", "B7B7B7", "CCCCCC", "D9D9D9", "EFEFEF", "F3F3F3", "FFFFFF"],
  ["C00000", "FF0000", "FFC000", "FFFF00", "92D050", "00B050", "00B0F0", "0070C0", "002060", "7030A0"],
  ["F4CCCC", "FCE5CD", "FFF2CC", "D9EAD3", "D0E0E3", "CFE2F3", "D9D2E9", "EAD1DC", "DDEBF7", "E2EFDA"],
  ["EA9999", "F9CB9C", "FFE599", "B6D7A8", "A2C4C9", "9FC5E8", "B4A7D6", "D5A6BD", "9BC2E6", "A9D08E"],
  ["CC0000", "E69138", "F1C232", "6AA84F", "45818E", "3D85C6", "674EA7", "A64D79", "2F75B5", "548235"],
  ["990000", "B45F06", "BF9000", "38761D", "134F5C", "0B5394", "351C75", "741B47", "1F4E79", "375623"],
];
const NOMES_FORMATO = { geral: "Geral", numero: "Número", moeda: "Moeda", contabil: "Contábil", percentual: "Percentual", data: "Data", hora: "Hora", texto: "Texto", personalizado: "Personalizado" };
const TAMANHOS = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48];
const fmtN = n => n.toLocaleString("pt-BR", { maximumFractionDigits: 10 });

export class SheetView extends FileView {
  getViewType() { return "sheet"; }
  getIcon() { return "file-spreadsheet"; }
  get csv() { return extname(this.file.path) === "csv"; }

  async onLoadFile(dados) {
    let estrutura;
    if (this.csv) estrutura = dadosCsv(dados, stem(this.file.path).slice(0, 31) || "Planilha1");
    else estrutura = await lerXlsx(dados);
    if (this.destruido) return;
    this.pasta?.destruir();
    this.pasta = new Pasta(estrutura);
    this.montar();
  }

  podeEditar() { return !this.somenteLeitura && !this.salvandoAgora; }

  // ================================================================ interface
  montar() {
    const pasta = this.pasta;
    const mobile = !!this.app.isMobile;
    vazio(this.contentEl);
    this.contentEl.classList.add("sheet-view-content");
    this.raiz = h("div.sheet-view" + (mobile ? ".is-mobile" : "") + (this.somenteLeitura ? ".is-readonly" : "") + (this.csv ? ".is-csv" : ""));
    this.barraFerramentas = this.somenteLeitura ? null : this.montarFerramentas();
    // barra de fórmulas
    this.caixaNome = h("input.sheet-namebox", { type: "text", spellcheck: "false", "aria-label": "Endereço da célula", title: "Endereço da célula — digite (ex.: B5) e Enter para ir" });
    this.entradaFormula = h("textarea.sheet-formula-input", { rows: "1", spellcheck: "false", wrap: "off", "aria-label": "Conteúdo da célula", placeholder: this.somenteLeitura ? "" : "Digite um valor ou uma fórmula (ex.: =SOMA(A1:A5))" });
    if (this.somenteLeitura) this.entradaFormula.readOnly = true;
    this.botaoFx = h("div.sheet-fx", { title: "Inserir função", text: "fx" });
    this.botaoFx.addEventListener("mousedown", e => e.preventDefault());
    this.botaoFx.addEventListener("click", e => this.menuFuncoes(e));
    const barraFormula = h("div.sheet-formula-bar", this.caixaNome, h("div.sheet-formula-sep"), this.botaoFx, this.entradaFormula);
    // busca
    this.barraBusca = this.montarBusca();
    // grade
    this.grade = new Grade({ pasta, mobile, somenteLeitura: !!this.somenteLeitura, barra: this.entradaFormula });
    // abas
    this.abasEl = h("div.sheet-tabs");
    this.raiz.append(...[this.barraFerramentas, barraFormula, this.barraBusca, this.grade.el, this.abasEl].filter(Boolean));
    this.contentEl.appendChild(this.raiz);
    this.ligar();
    // planilha inicial: a aba ativa do arquivo (se visível)
    let f = pasta.folhas[pasta.abaAtiva];
    if (!f || f.estado !== "visible") f = pasta.folhas.find(x => x.estado === "visible") || pasta.folhas[0];
    this.grade.folha = null;
    this.grade.trocarFolha(f);
    if (this.csv) this.autoajustarCsv();
    this.desenharAbas();
    this.grade.redimensionar();
    this.atualizarTudo();
    if (!this.acaoBusca && this.acoesEl && !this.somenteLeitura) this.acaoBusca = this.addAction("search", "Procurar na planilha (Ctrl+F)", () => this.abrirBusca());
    if (this.app.workspace?.activeLeaf === this.leaf) this.focus();
  }

  montarFerramentas() {
    const b = (ic, titulo, fn, extra = "") => { const el = iconButton(ic, titulo, () => { if (this.podeEditar()) fn(); }, "clickable-icon sheet-tool" + (extra ? " " + extra : "")); el.addEventListener("mousedown", e => e.preventDefault()); return el; };
    const sep = () => h("div.sheet-tool-sep");
    const texto = (t, titulo, fn, cls = "") => { const el = h("div.sheet-tool.sheet-tool-text" + cls, { title: titulo, role: "button", text: t }); el.addEventListener("mousedown", e => e.preventDefault()); el.addEventListener("click", e => { if (this.podeEditar()) fn(e); }); return el; };
    this.bt = {};
    const T = this.bt;
    T.desfazer = b("undo", "Desfazer (Ctrl+Z)", () => this.desfazer());
    T.refazer = b("redo", "Refazer (Ctrl+Y)", () => this.refazer());
    const grupos = [[T.desfazer, T.refazer]];
    if (!this.csv) {
      T.tamanho = texto("11", "Tamanho da fonte", e => this.menuTamanho(e), ".mod-dropdown.mod-size");
      T.negrito = b("bold", "Negrito (Ctrl+B)", () => this.alternarFonte("b"));
      T.italico = b("italic", "Itálico (Ctrl+I)", () => this.alternarFonte("i"));
      T.sublinhado = b("underline", "Sublinhado (Ctrl+U)", () => this.alternarFonte("u"));
      T.tachado = b("strikethrough", "Tachado (Ctrl+5)", () => this.alternarFonte("s"));
      T.corTexto = b("baseline", "Cor do texto", () => this.paletaCor(T.corTexto, "corTexto"), "mod-color");
      T.corFundo = b("paint-bucket", "Cor de preenchimento", () => this.paletaCor(T.corFundo, "fundo"), "mod-color");
      T.corTexto.appendChild(h("span.sheet-color-bar", { style: { background: "#C00000" } }));
      T.corFundo.appendChild(h("span.sheet-color-bar", { style: { background: "#FFFF00" } }));
      T.esquerda = b("align-left", "Alinhar à esquerda", () => this.alinhar("left"));
      T.centro = b("align-center", "Centralizar", () => this.alinhar("center"));
      T.direita = b("align-right", "Alinhar à direita", () => this.alinhar("right"));
      T.quebra = b("wrap", "Quebrar texto automaticamente", () => this.alternarQuebra());
      T.mesclar = b("merge", "Mesclar e centralizar", () => this.alternarMesclar());
      T.bordas = b("grid", "Bordas", () => this.menuBordas(T.bordas));
      T.formato = texto("Geral", "Formato de número", e => this.menuFormato(e), ".mod-dropdown.mod-format");
      T.moeda = b("dollar", "Moeda (R$)", () => this.aplicarFormato(FORMATOS_PADRAO.moeda));
      T.percentual = b("percent", "Percentual (%)", () => this.aplicarFormato("0%"));
      T.numero = b("hash", "Número com separador de milhar (1.234,56)", () => this.aplicarFormato(FORMATOS_PADRAO.numero));
      T.data = b("calendar", "Data (dd/mm/aaaa)", () => this.aplicarFormato(FORMATOS_PADRAO.data));
      T.menosCasas = texto(",0←", "Diminuir casas decimais", () => this.casas(-1), ".mod-decimal");
      T.maisCasas = texto(",00→", "Aumentar casas decimais", () => this.casas(1), ".mod-decimal");
      grupos.push([T.tamanho], [T.negrito, T.italico, T.sublinhado, T.tachado], [T.corTexto, T.corFundo, T.bordas], [T.esquerda, T.centro, T.direita, T.quebra, T.mesclar], [T.formato, T.moeda, T.percentual, T.numero, T.data, T.menosCasas, T.maisCasas]);
    }
    T.soma = b("sigma", "Soma automática (Alt+=)", () => this.autoSoma());
    T.linhas = b("rows", "Linhas: inserir ou excluir", () => this.menuEixo(T.linhas, "lin"));
    T.colunas = b("columns", "Colunas: inserir ou excluir", () => this.menuEixo(T.colunas, "col"));
    grupos.push([T.soma], [T.linhas, T.colunas]);
    const el = h("div.sheet-toolbar");
    grupos.forEach((g, i) => { if (i) el.appendChild(sep()); el.append(...g); });
    if (this.csv) el.appendChild(h("div.sheet-toolbar-note", { text: `CSV · separador “${this.pasta.csv.sep === "\t" ? "tab" : this.pasta.csv.sep}” · ${this.pasta.csv.codificacao === "utf-8" ? "UTF-8" : this.pasta.csv.codificacao === "windows-1252" ? "Windows-1252" : this.pasta.csv.codificacao.toUpperCase()}`, title: "Arquivos CSV guardam só os valores (sem formatação). Ao salvar, o separador, a codificação e as quebras de linha originais são mantidos." }));
    return el;
  }

  montarBusca() {
    this.buscaInput = h("input.sheet-find-input", { type: "search", placeholder: "Procurar…", spellcheck: "false" });
    this.trocaInput = h("input.sheet-find-input", { type: "text", placeholder: "Substituir por…", spellcheck: "false" });
    this.buscaInfo = h("div.sheet-find-count");
    this.buscaTodas = h("label.sheet-find-option", h("input", { type: "checkbox" }), h("span", { text: "Todas as abas" }));
    const linhaTroca = h("div.sheet-find-row.mod-replace.is-hidden", this.trocaInput,
      h("button", { text: "Substituir", onclick: () => this.substituir(false) }), h("button", { text: "Substituir tudo", onclick: () => this.substituir(true) }));
    this.linhaTroca = linhaTroca;
    const el = h("div.sheet-findbar.is-hidden",
      h("div.sheet-find-row", this.buscaInput, this.buscaInfo,
        iconButton("arrow-up", "Anterior (Shift+Enter)", () => this.proximo(-1), "clickable-icon"),
        iconButton("arrow-down", "Próximo (Enter)", () => this.proximo(1), "clickable-icon"),
        this.buscaTodas,
        this.somenteLeitura || false ? null : iconButton("replace", "Substituir", () => { linhaTroca.classList.toggle("is-hidden"); this.trocaInput.focus(); }, "clickable-icon"),
        iconButton("x", "Fechar (Esc)", () => this.fecharBusca(), "clickable-icon")),
      linhaTroca);
    const buscar = debounce(() => this.buscar(), 200);
    this.buscaInput.addEventListener("input", buscar);
    this.buscaTodas.querySelector("input").addEventListener("change", () => this.buscar());
    const teclas = e => {
      if (e.key === "Enter") { e.preventDefault(); if (e.target === this.trocaInput) this.substituir(false); else { buscar.cancel(); if (!this.resultados || this.consultaFeita !== this.buscaInput.value) this.buscar(); else this.proximo(e.shiftKey ? -1 : 1); } }
      else if (e.key === "Escape") { e.preventDefault(); this.fecharBusca(); }
    };
    this.buscaInput.addEventListener("keydown", teclas);
    this.trocaInput.addEventListener("keydown", teclas);
    return el;
  }

  ligar() {
    const g = this.grade, pasta = this.pasta;
    const status = debounce(() => this.app.atualizarStatus(), 60);
    this.atualizarStatusDepois = status;
    g.on("selecao", () => { this.atualizarCaixas(); this.atualizarBotoes(); status(); });
    g.on("edicao", () => { this.raiz.classList.toggle("is-editing", !!g.ed); if (!g.ed) this.atualizarCaixas(); });
    g.on("confirmar", p => { p.resultado = this.confirmarCelula(p); });
    g.on("erro", msg => notice(msg, { tempo: 5000 }));
    g.on("menu", ({ evento, tipo }) => this.menuContexto(evento, tipo));
    g.on("copiar", ({ evento, recortar }) => this.copiar(evento, recortar));
    g.on("colar", ({ evento }) => this.colar(evento));
    g.on("apagar", () => this.apagar());
    g.on("preencher", ({ origem, destino }) => { if (!this.podeEditar()) return; const r = pasta.preencher(g.folha, origem, destino); if (r.erro) notice(r.erro); else g.selecionarArea({ r1: Math.min(origem.r1, destino.r1), c1: Math.min(origem.c1, destino.c1), r2: Math.max(origem.r2, destino.r2), c2: Math.max(origem.c2, destino.c2) }, g.sel.ativa); });
    g.on("redimensionar", ({ eixo, i1, i2, px }) => {
      if (!this.podeEditar()) return;
      if (eixo === "col") pasta.larguraColunas(g.folha, i1, i2, g.charsDePx(px));
      else pasta.alturaLinhas(g.folha, i1, i2, Math.round(px * 0.75 * 4) / 4);
    });
    g.on("autoajustar", b => { if (this.podeEditar()) this.autoajustar(b.eixo, b.i); });
    g.on("trocarFolha", f => this.mostrarFolha(f));
    g.on("atalho", a => this.atalho(a));
    g.on("zoom", () => status());
    pasta.on("mudou", ev => {
      if (ev && (ev.estrutura || ev.geometria)) g.reconstruirEixos();
      g.atualizarExtensao();
      g.posicionarEditor();
      g.desenhar();
      if (!this.somenteLeitura) this.setDirty(true);
      this.atualizarCaixas(); this.atualizarBotoes(); status();
    });
    pasta.on("abas", () => this.desenharAbas());
    pasta.on("historico", () => this.atualizarBotoes());
    this.caixaNome.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); this.irPara(this.caixaNome.value); }
      else if (e.key === "Escape") { e.preventDefault(); this.atualizarCaixas(); g.focar(); }
    });
    this.caixaNome.addEventListener("focus", () => this.caixaNome.select());
    this.raiz.addEventListener("keydown", e => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === "f" || e.key === "F" || e.key === "l" || e.key === "L") && e.target !== this.grade.ta) { e.preventDefault(); this.abrirBusca(); }
    });
  }

  atualizarTudo() { this.atualizarCaixas(); this.atualizarBotoes(); this.app.atualizarStatus?.(); }

  /** caixa de nome e barra de fórmulas */
  atualizarCaixas() {
    const g = this.grade;
    if (!g) return;
    const a = g.area();
    const unica = a.r1 === a.r2 && a.c1 === a.c2 || g.folha.mesclaEm(g.sel.ativa.r, g.sel.ativa.c) && nomeIntervalo(g.folha.mesclaEm(g.sel.ativa.r, g.sel.ativa.c)) === nomeIntervalo(a);
    if (document.activeElement !== this.caixaNome) this.caixaNome.value = g.arrasto && !unica ? `${a.r2 - a.r1 + 1}L × ${a.c2 - a.c1 + 1}C` : nomeCelula(g.sel.ativa.r, g.sel.ativa.c);
    if (!g.ed) this.entradaFormula.value = g.folha.especial ? "" : this.pasta.textoEdicao(g.folha, g.sel.ativa.r, g.sel.ativa.c);
  }

  atualizarBotoes() {
    const T = this.bt;
    if (!T || !this.grade) return;
    T.desfazer.classList.toggle("is-disabled", !this.pasta.podeDesfazer);
    T.refazer.classList.toggle("is-disabled", !this.pasta.podeRefazer);
    if (this.csv) return;
    const { r, c } = this.grade.sel.ativa;
    const info = this.pasta.infoEstilo(this.grade.folha, r, c);
    if (!info) return;
    T.negrito.classList.toggle("is-active", !!info.b);
    T.italico.classList.toggle("is-active", !!info.i);
    T.sublinhado.classList.toggle("is-active", !!info.u);
    T.tachado.classList.toggle("is-active", !!info.tachado);
    T.esquerda.classList.toggle("is-active", info.h === "left");
    T.centro.classList.toggle("is-active", info.h === "center" || info.h === "centerContinuous");
    T.direita.classList.toggle("is-active", info.h === "right");
    T.quebra.classList.toggle("is-active", !!info.quebra);
    T.mesclar.classList.toggle("is-active", !!this.grade.folha.mesclaEm(r, c));
    T.formato.textContent = NOMES_FORMATO[info.tipoFormato] || "Geral";
    T.tamanho.textContent = String(Math.round(info.tam * 10) / 10).replace(".", ",");
  }

  // ================================================================ abas
  desenharAbas() {
    const el = this.abasEl;
    if (!el) return;
    vazio(el);
    const pasta = this.pasta;
    const visiveis = pasta.folhas.filter(f => f.estado === "visible");
    if (this.csv) { el.classList.add("is-hidden"); return; }
    if (!this.somenteLeitura) {
      const mais = iconButton("plus", "Nova planilha", () => this.novaFolha(), "clickable-icon sheet-tab-add");
      mais.addEventListener("mousedown", e => e.preventDefault());
      el.appendChild(mais);
    }
    const lista = h("div.sheet-tabs-list");
    for (const f of visiveis) {
      const aba = h("div.sheet-tab" + (f === this.grade.folha ? ".is-active" : ""), { title: f.nome, role: "tab" }, h("span.sheet-tab-name", { text: f.nome }));
      if (f.corAba) aba.appendChild(h("span.sheet-tab-color", { style: { background: f.corAba } }));
      aba.addEventListener("mousedown", e => { if (e.button === 0) { e.preventDefault(); this.mostrarFolha(f); } });
      aba.addEventListener("dblclick", () => { if (!this.somenteLeitura) this.renomearFolha(f, aba); });
      aba.addEventListener("contextmenu", e => { e.preventDefault(); this.menuAba(e, f, aba); });
      lista.appendChild(aba);
    }
    el.appendChild(lista);
    const ocultas = pasta.folhas.length - visiveis.length;
    if (ocultas) el.appendChild(h("div.sheet-tabs-note", { text: ocultas === 1 ? "1 aba oculta" : `${ocultas} abas ocultas`, title: "Abas ocultas no Excel continuam no arquivo." }));
    lista.querySelector(".is-active")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  mostrarFolha(f) {
    if (!f || f === this.grade.folha) return;
    const editandoFormula = this.grade.ed && this.grade.textoAtual().startsWith("=");
    if (this.grade.ed && !editandoFormula) { if (!this.grade.confirmarEdicao({ mover: false })) return; }
    this.grade.trocarFolha(f);
    if (editandoFormula && this.grade.ed) this.grade.focar();
    this.desenharAbas();
    this.atualizarTudo();
  }

  async novaFolha() {
    if (!this.podeEditar()) return;
    let n = this.pasta.folhas.length + 1, nome;
    do { nome = "Planilha" + n++; } while (this.pasta.folhaPorNome(nome));
    const r = this.pasta.adicionarFolha(nome);
    if (r.erro) return notice(r.erro);
    this.setDirty(true);
    this.mostrarFolha(r.folha);
  }

  renomearFolha(f, abaEl) {
    if (!this.podeEditar()) return;
    const nomeEl = abaEl?.querySelector(".sheet-tab-name");
    if (!nomeEl || this.app.isMobile) {
      perguntar({ titulo: "Renomear planilha", valor: f.nome, ok: "Renomear" }).then(n => { if (n) this.aplicarNome(f, n); });
      return;
    }
    const inp = h("input.sheet-tab-input", { type: "text", value: f.nome, maxlength: "31", spellcheck: "false" });
    nomeEl.replaceWith(inp);
    inp.focus(); inp.select();
    let feito = false;
    const fim = ok => { if (feito) return; feito = true; if (ok && inp.value.trim() && inp.value.trim() !== f.nome) this.aplicarNome(f, inp.value.trim()); else this.desenharAbas(); this.grade.focar(); };
    inp.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); fim(true); } else if (e.key === "Escape") { e.preventDefault(); fim(false); } });
    inp.addEventListener("blur", () => fim(true));
    inp.addEventListener("mousedown", e => e.stopPropagation());
  }
  aplicarNome(f, nome) {
    const r = this.pasta.renomearFolha(f, nome);
    if (r.erro) { notice(r.erro); this.desenharAbas(); return; }
    this.setDirty(true);
    this.desenharAbas();
    this.atualizarCaixas();
  }

  async excluirFolha(f) {
    if (!this.podeEditar()) return;
    const ok = await confirmar({ titulo: "Excluir planilha", texto: `Excluir a aba “${f.nome}” e todo o seu conteúdo? Esta ação não pode ser desfeita (mas o arquivo anterior fica no histórico de versões ao salvar).`, ok: "Excluir", perigo: true });
    if (!ok) return;
    const atual = this.grade.folha === f;
    const r = this.pasta.excluirFolha(f);
    if (r.erro) return notice(r.erro);
    this.setDirty(true);
    if (atual) { this.grade.folha = null; this.grade.trocarFolha(this.pasta.folhas.find(x => x.estado === "visible") || this.pasta.folhas[0]); }
    this.desenharAbas();
    this.atualizarTudo();
  }

  menuAba(e, f, aba) {
    const m = new Menu();
    if (!this.somenteLeitura) {
      m.addItem({ title: "Renomear", icon: "pencil", onClick: () => this.renomearFolha(f, aba) });
      m.addItem({ title: "Inserir nova planilha", icon: "plus", onClick: () => this.novaFolha() });
      m.addSeparator();
      m.addItem({ title: "Excluir planilha", icon: "trash", warning: true, onClick: () => this.excluirFolha(f) });
    } else m.addItem({ title: f.nome, disabled: true });
    m.showAtMouseEvent(e);
  }

  // ================================================================ edição
  confirmarCelula(p) {
    if (!this.podeEditar()) return { erro: "Somente leitura." };
    const pasta = this.pasta;
    const folha = p.folha;
    if (p.preencherSelecao && p.area && !(p.area.r1 === p.area.r2 && p.area.c1 === p.area.c2)) {
      const itens = [];
      const ehFormula = p.texto.startsWith("=") && p.texto.length > 1;
      const fEn = ehFormula ? paraIngles(p.texto.slice(1)) : null;
      const a = p.area;
      if ((a.r2 - a.r1 + 1) * (a.c2 - a.c1 + 1) > 100000) return { erro: "Área muito grande." };
      for (let r = a.r1; r <= a.r2; r++) for (let c = a.c1; c <= a.c2; c++) {
        const t = ehFormula ? "=" + paraPortugues(transladarFormula(fEn, r - p.r, c - p.c)) : p.texto;
        itens.push({ r, c, texto: t });
      }
      return pasta.definir(folha, itens, { nome: "Preencher seleção" });
    }
    const quebra = p.texto.includes("\n") && !p.texto.startsWith("=") && !this.csv;
    const res = pasta.definir(folha, [{ r: p.r, c: p.c, texto: p.texto, quebra }], { nome: "Editar célula" });
    if (res.erro) return res;
    // texto com várias linhas: aumenta a altura da linha (como o Excel)
    if (quebra) {
      const l = folha.linhas.get(p.r);
      if (!l || !l.custom) {
        const info = pasta.infoEstilo(folha, p.r, p.c);
        const pt = Math.min(409, Math.max(folha.alturaPadrao, p.texto.split("\n").length * (info?.tam || 11) * 1.32 + 3));
        if (!l || !l.ht || l.ht < pt) { pasta.alturaLinhas(folha, p.r, p.r, Math.round(pt * 4) / 4); pasta.agrupar(2, "Editar célula"); }
      }
    }
    return res;
  }

  apagar() {
    if (!this.podeEditar()) return;
    const g = this.grade;
    const r = this.pasta.limpar(g.folha, this.areaUsada(g.area()), { conteudo: true });
    if (r.erro) notice(r.erro);
  }

  /** área selecionada limitada ao que está em uso (para "selecionar tudo") */
  areaUsada(a) {
    const f = this.grade.folha;
    if (a.r2 >= MAX_LINHAS - 1 || a.c2 >= MAX_COLUNAS - 1) return { r1: a.r1, c1: a.c1, r2: Math.min(a.r2, Math.max(a.r1, f.limite.r)), c2: Math.min(a.c2, Math.max(a.c1, f.limite.c)) };
    return a;
  }

  desfazer() {
    if (!this.podeEditar()) return;
    if (this.grade.ed) this.grade.cancelarEdicao();
    const e = this.pasta.desfazer();
    if (!e) return;
    this.depoisDeHistorico(e);
  }
  refazer() {
    if (!this.podeEditar()) return;
    if (this.grade.ed) this.grade.confirmarEdicao({ mover: false });
    const e = this.pasta.refazer();
    if (e) this.depoisDeHistorico(e);
  }
  depoisDeHistorico(e) {
    if (e.abas) this.desenharAbas();
    if (e.folha && e.folha !== this.grade.folha && this.pasta.folhas.includes(e.folha)) this.mostrarFolha(e.folha);
    if (this.grade.folha && !this.pasta.folhas.includes(this.grade.folha)) { this.grade.folha = null; this.grade.trocarFolha(this.pasta.folhas[0]); this.desenharAbas(); }
    this.grade.reconstruirEixos();
    this.grade.desenhar();
    this.atualizarTudo();
  }

  // ================================================================ formatação
  formatar(mudanca, nome) {
    if (!this.podeEditar()) return;
    if (this.csv) return notice("Arquivos CSV não guardam formatação. Para formatar, salve uma cópia como planilha do Excel.");
    if (this.grade.ed) this.grade.confirmarEdicao({ mover: false });
    const r = this.pasta.formatar(this.grade.folha, this.grade.area(), mudanca, { nome });
    if (r.erro) notice(r.erro);
    this.grade.focar();
  }
  alternarFonte(k) {
    const { r, c } = this.grade.sel.ativa;
    const info = this.pasta.infoEstilo(this.grade.folha, r, c);
    if (!info) return this.formatar({});
    const atual = k === "u" ? info.u : k === "s" ? info.tachado : info[k];
    this.formatar({ [k]: k === "u" ? (atual ? null : "single") : !atual }, { b: "Negrito", i: "Itálico", u: "Sublinhado", s: "Tachado" }[k]);
  }
  alinhar(h2) {
    const { r, c } = this.grade.sel.ativa;
    const info = this.pasta.infoEstilo(this.grade.folha, r, c);
    this.formatar({ h: info && info.h === h2 ? null : h2 }, "Alinhar");
  }
  alternarQuebra() {
    const { r, c } = this.grade.sel.ativa;
    const info = this.pasta.infoEstilo(this.grade.folha, r, c);
    this.formatar({ quebra: !(info && info.quebra) }, "Quebrar texto");
  }
  aplicarFormato(codigo) { this.formatar({ formato: codigo }, "Formato de número"); }
  casas(d) {
    const { r, c } = this.grade.sel.ativa;
    let fmt = this.pasta.formato(this.grade.folha, r, c);
    if (/^general$/i.test(fmt)) {
      const v = this.pasta.valor(this.grade.folha, r, c);
      const atual = typeof v === "number" ? (formatoGeral(v).split(",")[1] || "").length : 0;
      const n = Math.max(0, atual + d);
      fmt = n ? "0." + "0".repeat(n) : "0";
    } else fmt = mudarCasas(fmt, d);
    this.aplicarFormato(fmt);
  }

  paletaCor(botao, campo) {
    if (this.csv) return notice("Arquivos CSV não guardam formatação.");
    const pop = h("div.sheet-popover.sheet-palette");
    const fechar = () => { pop.remove(); document.removeEventListener("mousedown", fora, true); document.removeEventListener("keydown", tecla, true); };
    const fora = e => { if (!pop.contains(e.target)) fechar(); };
    const tecla = e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fechar(); this.grade.focar(); } };
    const aplicar = cor => {
      fechar();
      const barra = botao.querySelector(".sheet-color-bar");
      if (cor && barra) barra.style.background = "#" + cor;
      this.formatar({ [campo]: cor }, campo === "fundo" ? "Cor de preenchimento" : "Cor do texto");
    };
    pop.appendChild(h("div.sheet-palette-none", { role: "button", text: campo === "fundo" ? "Sem preenchimento" : "Automática", onclick: () => aplicar(null) }));
    const grade = h("div.sheet-palette-grid");
    for (const linha of PALETA) for (const cor of linha) grade.appendChild(h("div.sheet-palette-swatch", { title: "#" + cor, style: { background: "#" + cor }, onclick: () => aplicar(cor) }));
    pop.appendChild(grade);
    const outra = h("input", { type: "color", value: "#1f4e79" });
    outra.addEventListener("change", () => aplicar(outra.value.slice(1).toUpperCase()));
    pop.appendChild(h("label.sheet-palette-more", icon("palette"), h("span", { text: "Mais cores…" }), outra));
    document.body.appendChild(pop);
    const b = botao.getBoundingClientRect();
    pop.style.left = Math.max(4, Math.min(b.left, window.innerWidth - pop.offsetWidth - 4)) + "px";
    pop.style.top = (b.bottom + 4) + "px";
    setTimeout(() => { document.addEventListener("mousedown", fora, true); document.addEventListener("keydown", tecla, true); }, 0);
  }

  menuTamanho(e) {
    const m = new Menu();
    const { r, c } = this.grade.sel.ativa;
    const atual = this.pasta.infoEstilo(this.grade.folha, r, c)?.tam;
    for (const t of TAMANHOS) m.addItem({ title: String(t), checked: atual === t, onClick: () => this.formatar({ tam: t }, "Tamanho da fonte") });
    m.showBelow(e.currentTarget);
  }

  menuFormato(e) {
    const m = new Menu();
    const { r, c } = this.grade.sel.ativa;
    const tipo = this.pasta.infoEstilo(this.grade.folha, r, c)?.tipoFormato;
    const it = (titulo, ex, codigo, t) => m.addItem({ title: titulo + (ex ? "   " + ex : ""), checked: tipo === t, onClick: () => this.aplicarFormato(codigo) });
    it("Geral", "", "General", "geral");
    it("Número", "1.234,56", FORMATOS_PADRAO.numero, "numero");
    it("Moeda", "R$ 1.234,56", FORMATOS_PADRAO.moeda, "moeda");
    it("Contábil", "R$  1.234,56", FORMATOS_PADRAO.contabil, "contabil");
    it("Percentual", "12,34%", FORMATOS_PADRAO.percentual, "percentual");
    it("Data", "16/10/2026", FORMATOS_PADRAO.data, "data");
    it("Data e hora", "16/10/2026 14:30", FORMATOS_PADRAO.dataHora, null);
    it("Hora", "14:30:00", FORMATOS_PADRAO.hora, "hora");
    it("Texto", "", "@", "texto");
    m.addSeparator();
    m.addItem({ title: "Aumentar casas decimais", onClick: () => this.casas(1) });
    m.addItem({ title: "Diminuir casas decimais", onClick: () => this.casas(-1) });
    m.addItem({ title: "Personalizado…", onClick: async () => {
      const atual = this.pasta.formato(this.grade.folha, r, c);
      const cod = await perguntar({ titulo: "Formato personalizado (código do Excel)", valor: atual, ok: "Aplicar" });
      if (cod) this.aplicarFormato(cod);
    } });
    m.showBelow(e.currentTarget);
  }

  menuBordas(botao) {
    if (this.csv) return notice("Arquivos CSV não guardam formatação.");
    const m = new Menu();
    const aplicar = (tipo, nome) => {
      if (!this.podeEditar()) return;
      const g = this.areaUsada(this.grade.area());
      const fn = (r, c) => {
        switch (tipo) {
          case "todas": return { bordas: { l: "thin", r: "thin", t: "thin", b: "thin" } };
          case "nenhuma": return { bordas: { l: null, r: null, t: null, b: null } };
          case "externas": { const b = {}; if (r === g.r1) b.t = "thin"; if (r === g.r2) b.b = "thin"; if (c === g.c1) b.l = "thin"; if (c === g.c2) b.r = "thin"; return Object.keys(b).length ? { bordas: b } : null; }
          case "espessa": { const b = {}; if (r === g.r1) b.t = "medium"; if (r === g.r2) b.b = "medium"; if (c === g.c1) b.l = "medium"; if (c === g.c2) b.r = "medium"; return Object.keys(b).length ? { bordas: b } : null; }
          case "inferior": return r === g.r2 ? { bordas: { b: "thin" } } : null;
          case "superior": return r === g.r1 ? { bordas: { t: "thin" } } : null;
          case "esquerda": return c === g.c1 ? { bordas: { l: "thin" } } : null;
          case "direita": return c === g.c2 ? { bordas: { r: "thin" } } : null;
          case "dupla": return r === g.r2 ? { bordas: { b: "double" } } : null;
          default: return null;
        }
      };
      const res = this.pasta.formatarPorCelula(this.grade.folha, g, fn, { nome });
      if (res.erro) notice(res.erro);
      this.grade.focar();
    };
    m.addItem({ title: "Todas as bordas", icon: "grid", onClick: () => aplicar("todas", "Todas as bordas") });
    m.addItem({ title: "Bordas externas", icon: "square", onClick: () => aplicar("externas", "Bordas externas") });
    m.addItem({ title: "Borda externa espessa", icon: "square", onClick: () => aplicar("espessa", "Borda espessa") });
    m.addSeparator();
    m.addItem({ title: "Borda inferior", onClick: () => aplicar("inferior", "Borda inferior") });
    m.addItem({ title: "Borda superior", onClick: () => aplicar("superior", "Borda superior") });
    m.addItem({ title: "Borda esquerda", onClick: () => aplicar("esquerda", "Borda esquerda") });
    m.addItem({ title: "Borda direita", onClick: () => aplicar("direita", "Borda direita") });
    m.addItem({ title: "Borda inferior dupla", onClick: () => aplicar("dupla", "Borda dupla") });
    m.addSeparator();
    m.addItem({ title: "Sem bordas", icon: "eraser", onClick: () => aplicar("nenhuma", "Sem bordas") });
    m.showBelow(botao);
  }

  async alternarMesclar() {
    if (this.csv) return notice("Arquivos CSV não guardam células mescladas.");
    if (this.grade.ed) this.grade.confirmarEdicao({ mover: false });
    const f = this.grade.folha, g = this.grade.area();
    if (f.mesclas.some(m => m.r1 <= g.r2 && g.r1 <= m.r2 && m.c1 <= g.c2 && g.c1 <= m.c2)) { const r = this.pasta.desmesclar(f, g); if (r.erro) notice(r.erro); return; }
    let outros = 0;
    this.pasta.paraCadaCelula(f, g, (r, c) => { if ((r !== g.r1 || c !== g.c1) && this.grade.temValor(r, c)) outros++; });
    if (outros) {
      const ok = await confirmar({ titulo: "Mesclar células", texto: "Mesclar mantém apenas o valor da célula superior esquerda; os outros valores serão apagados. Continuar?", ok: "Mesclar" });
      if (!ok) return;
    }
    const r = this.pasta.mesclar(f, g, true);
    if (r.erro) notice(r.erro);
    this.grade.selecionarArea(g);
  }

  // ================================================================ linhas e colunas
  menuEixo(botao, eixo, evento = null) {
    const m = new Menu();
    this.itensEixo(m, eixo);
    if (evento) m.showAtMouseEvent(evento); else m.showBelow(botao);
  }
  itensEixo(m, eixo) {
    const a = this.grade.area();
    if (eixo === "lin") {
      const n = Math.min(a.r2 - a.r1 + 1, 1000);
      const s = n > 1 ? `${n} linhas` : "linha";
      m.addItem({ title: `Inserir ${s} acima`, icon: "arrow-up", onClick: () => this.inserir("lin", a.r1, n) });
      m.addItem({ title: `Inserir ${s} abaixo`, icon: "arrow-down", onClick: () => this.inserir("lin", Math.min(a.r2, MAX_LINHAS - 2) + 1, n) });
      m.addItem({ title: n > 1 ? `Excluir ${n} linhas` : "Excluir linha", icon: "trash", warning: true, onClick: () => this.excluir("lin", a.r1, a.r2 - a.r1 + 1) });
    } else {
      const n = Math.min(a.c2 - a.c1 + 1, 500);
      const s = n > 1 ? `${n} colunas` : "coluna";
      m.addItem({ title: `Inserir ${s} à esquerda`, icon: "arrow-left", onClick: () => this.inserir("col", a.c1, n) });
      m.addItem({ title: `Inserir ${s} à direita`, icon: "arrow-right", onClick: () => this.inserir("col", Math.min(a.c2, MAX_COLUNAS - 2) + 1, n) });
      m.addItem({ title: n > 1 ? `Excluir ${n} colunas` : "Excluir coluna", icon: "trash", warning: true, onClick: () => this.excluir("col", a.c1, a.c2 - a.c1 + 1) });
    }
  }
  inserir(eixo, em, n) {
    if (!this.podeEditar()) return;
    if (this.grade.ed) this.grade.confirmarEdicao({ mover: false });
    const r = this.pasta.mudarEixo(this.grade.folha, eixo, em, n);
    if (r.erro) return notice(r.erro);
    const g = this.grade;
    if (eixo === "lin") g.selecionarArea({ r1: em, c1: g.area().c1 === 0 && g.area().c2 >= MAX_COLUNAS - 1 ? 0 : g.sel.ativa.c, r2: em + n - 1, c2: g.area().c1 === 0 && g.area().c2 >= MAX_COLUNAS - 1 ? MAX_COLUNAS - 1 : g.sel.ativa.c });
    else g.selecionarArea({ r1: g.sel.ativa.r, c1: em, r2: g.sel.ativa.r, c2: em + n - 1 });
    g.focar();
  }
  async excluir(eixo, em, n) {
    if (!this.podeEditar()) return;
    if (this.grade.ed) this.grade.confirmarEdicao({ mover: false });
    const f = this.grade.folha;
    const max = eixo === "lin" ? MAX_LINHAS : MAX_COLUNAS;
    n = Math.min(n, max - em);
    if (n > 5000) { if (!(await confirmar({ titulo: "Excluir", texto: `Excluir ${n.toLocaleString("pt-BR")} ${eixo === "lin" ? "linhas" : "colunas"}?`, ok: "Excluir", perigo: true }))) return; }
    const r = this.pasta.mudarEixo(f, eixo, em, -n);
    if (r.erro) return notice(r.erro);
    this.grade.selecionar(eixo === "lin" ? em : this.grade.sel.ativa.r, eixo === "col" ? em : this.grade.sel.ativa.c);
    this.grade.focar();
  }

  autoajustar(eixo, i) {
    const f = this.grade.folha, g = this.grade;
    if (eixo === "col") {
      let max = 0;
      const ctx = g.medidor;
      let n = 0;
      this.pasta.paraCadaCelula(f, { r1: 0, c1: i, r2: MAX_LINHAS - 1, c2: i }, (r, c) => {
        if (n++ > 20000 || f.mesclaEm(r, c)) return;
        const e = this.pasta.exibir(f, r, c); if (!e) return;
        const rs = this.pasta.estilos ? this.pasta.estilos.render(f.estilo(r, c)) : null;
        ctx.font = `${rs && rs.b ? "bold " : ""}${((rs ? rs.tam : 11) * 4 / 3).toFixed(2)}px ${rs ? rs.familia : "Calibri, Carlito, sans-serif"}`;
        for (const l of String(e.texto).split("\n")) max = Math.max(max, ctx.measureText(l).width);
      });
      const px = max ? Math.min(800, Math.ceil(max + 10)) : 64;
      this.pasta.larguraColunas(f, i, i, g.charsDePx(px));
    } else this.pasta.alturaLinhas(f, i, i, null);
  }

  autoajustarCsv() {
    const f = this.grade.folha, g = this.grade, ctx = g.medidor;
    ctx.font = "14.67px Calibri, Carlito, sans-serif";
    const larg = [];
    let n = 0;
    for (const [k, cel] of f.celulas) {
      if (n++ > 30000) break;
      const c = k % MAX_COLUNAS;
      if (c > 200) continue;
      const t = String(cel.raw ?? "").split("\n")[0];
      larg[c] = Math.max(larg[c] || 0, ctx.measureText(t).width);
    }
    f.colunas = [];
    larg.forEach((w, c) => { if (w == null) return; const px = Math.max(48, Math.min(360, Math.ceil(w + 12))); f.colunas.push({ min: c, max: c, attrs: { width: String(g.charsDePx(px)), customWidth: "1" } }); });
    g.reconstruirEixos();
  }

  // ================================================================ soma automática, datas, ir para
  autoSoma() {
    if (!this.podeEditar()) return;
    const g = this.grade, f = g.folha, pasta = this.pasta;
    if (g.ed) g.confirmarEdicao({ mover: false });
    const a = g.area();
    const num = (r, c) => typeof pasta.valor(f, r, c) === "number";
    if (a.r1 === a.r2 && a.c1 === a.c2 || f.mesclaEm(a.r1, a.c1)) {
      const { r, c } = g.sel.ativa;
      let ref = null;
      // acima
      let r1 = r - 1; while (r1 >= 0 && !num(r1, c) && r1 > r - 3 && !g.temValor(r1, c)) r1--;
      if (r1 >= 0 && num(r1, c)) { let r0 = r1; while (r0 - 1 >= 0 && num(r0 - 1, c)) r0--; ref = nomeIntervalo({ r1: r0, c1: c, r2: r1, c2: c }); }
      else { let c1 = c - 1; if (c1 >= 0 && num(r, c1)) { let c0 = c1; while (c0 - 1 >= 0 && num(r, c0 - 1)) c0--; ref = nomeIntervalo({ r1: r, c1: c0, r2: r, c2: c1 }); } }
      g.iniciarEdicao({ modo: "editar", texto: "=SOMA(" + (ref || "") + ")" });
      if (!ref) { const n = g.ta.value.length - 1; g.ta.setSelectionRange(n, n); }
      g.atualizarAjudas();
      return;
    }
    // intervalo: soma abaixo de cada coluna (ou à direita, se for uma linha só)
    const itens = [];
    if (a.r1 === a.r2) itens.push({ r: a.r1, c: a.c2 + 1, texto: "=SOMA(" + nomeIntervalo(a) + ")" });
    else for (let c = a.c1; c <= a.c2; c++) itens.push({ r: a.r2 + 1, c, texto: "=SOMA(" + nomeIntervalo({ r1: a.r1, c1: c, r2: a.r2, c2: c }) + ")" });
    const r = pasta.definir(f, itens, { nome: "Soma automática" });
    if (r.erro) notice(r.erro);
  }

  inserirData(hora = false) {
    if (!this.podeEditar()) return;
    const d = new Date();
    const p = n => String(n).padStart(2, "0");
    const t = hora ? `${p(d.getHours())}:${p(d.getMinutes())}` : `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
    if (this.grade.ed) { this.grade.inserirNoEditor(t); return; }
    const { r, c } = this.grade.sel.ativa;
    const res = this.pasta.definir(this.grade.folha, [{ r, c, texto: t }], { nome: "Inserir data" });
    if (res.erro) notice(res.erro);
    void hojeSerial;
  }

  irPara(txt) {
    const t = String(txt || "").trim();
    const g = this.grade;
    let alvo = t, folha = g.folha;
    const m = /^(?:'((?:[^']|'')+)'|([^!]+))!(.+)$/.exec(t);
    if (m) { folha = this.pasta.folhaPorNome((m[1] || m[2]).replace(/''/g, "'")); alvo = m[3]; if (!folha) { notice("Planilha não encontrada."); return; } }
    const area = lerIntervalo(alvo.toUpperCase());
    if (!area) { notice("Endereço inválido. Exemplos: B5, A1:C10, Resumo!B2"); this.atualizarCaixas(); return; }
    if (folha !== g.folha) this.mostrarFolha(folha);
    if (area.r1 === area.r2 && area.c1 === area.c2) g.selecionar(area.r1, area.c1);
    else { g.selecionarArea(area); g.rolarAte(area.r1, area.c1); g.desenhar(); }
    g.focar();
  }

  menuFuncoes(e) {
    if (!this.podeEditar()) return;
    const m = new Menu();
    m.addLabel("Inserir função");
    for (const n of ["SOMA", "MÉDIA", "SE", "PROCV", "CONT.SE", "SOMASE", "ARRED", "MÁXIMO", "MÍNIMO", "HOJE", "CONCATENAR", "SEERRO", "CONT.VALORES"]) {
      m.addItem({ title: n, onClick: () => {
        const g = this.grade;
        if (!g.ed) g.iniciarEdicao({ modo: "editar", texto: "=" + n + "()" });
        else g.inserirNoEditor((g.textoAtual().startsWith("=") ? "" : "=") + n + "()");
        const el = g.ed.origem === "barra" ? this.entradaFormula : g.ta;
        const p = el.value.lastIndexOf(")"); el.setSelectionRange(p, p);
        g.atualizarAjudas();
      } });
    }
    void listaFuncoesPt; void DICAS;
    m.showBelow(e.currentTarget);
  }

  // ================================================================ copiar e colar
  copiar(evento, recortar) {
    const g = this.grade, f = g.folha;
    const a = this.areaUsada(g.area());
    const cel = (a.r2 - a.r1 + 1) * (a.c2 - a.c1 + 1);
    if (cel > 2000000) { notice("Área grande demais para copiar."); return; }
    const linhas = [];
    let html = "<table>";
    for (let r = a.r1; r <= a.r2; r++) {
      const l = [];
      html += "<tr>";
      for (let c = a.c1; c <= a.c2; c++) {
        const t = this.pasta.textoCopia(f, r, c);
        l.push(/[\t\n\r"]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t);
        html += "<td>" + escapeHtml(t).replace(/\n/g, "<br>") + "</td>";
      }
      html += "</tr>";
      linhas.push(l.join("\t"));
    }
    html += "</table>";
    const tsv = linhas.join("\r\n") + "\r\n";
    try { evento.clipboardData.setData("text/plain", tsv); evento.clipboardData.setData("text/html", html); } catch (e) { navigator.clipboard?.writeText(tsv); }
    transferencia = { tsv, dados: this.pasta.copiar(f, a), recortar: recortar && this.podeEditar(), view: this };
    g.copia = { folha: f, g: a };
    g.desenhar();
    if (recortar && this.podeEditar()) notice("Selecione o destino e cole (Ctrl+V) para mover.", { tempo: 2500 });
  }

  colar(evento) {
    if (!this.podeEditar()) return;
    const txt = evento ? evento.clipboardData.getData("text/plain") : null;
    this.colarTexto(txt);
  }

  colarTexto(txt, modo = "tudo") {
    const g = this.grade, f = g.folha, pasta = this.pasta;
    const a = g.area();
    const { r, c } = { r: a.r1, c: a.c1 };
    const norm = s => (s || "").replace(/\r\n/g, "\n").replace(/\n+$/, "");
    let res;
    const interno = transferencia && (txt == null || norm(txt) === norm(transferencia.tsv)) && transferencia.view.pasta;
    if (interno) {
      const t = transferencia;
      res = pasta.colarInterno(f, r, c, t.dados, { modo, repetirEm: a });
      if (!res.erro && t.recortar && t.view === this && modo === "tudo") {
        // recortar: apaga a origem (o que não foi sobrescrito)
        const o = t.dados.g, of = t.dados.folha;
        const itens = [];
        for (let rr = o.r1; rr <= o.r2; rr++) for (let cc = o.c1; cc <= o.c2; cc++) {
          if (of === f && rr >= res.area.r1 && rr <= res.area.r2 && cc >= res.area.c1 && cc <= res.area.c2) continue;
          if (of.celulas.has(chave(rr, cc))) itens.push({ r: rr, c: cc, cel: null, hf: null });
        }
        if (itens.length) { const r2 = pasta.definir(of, itens, { nome: "Mover" }); if (!r2.erro) pasta.agrupar(2, "Mover"); }
        transferencia = null;
        g.copia = null;
      }
    } else {
      if (txt == null || txt === "") return;
      const linhas = lerTsv(txt);
      if (!linhas.length) return;
      if (modo === "valores" || modo === "tudo") res = pasta.colarTexto(f, r, c, linhas, a);
    }
    if (!res) return;
    if (res.erro) { notice(res.erro); return; }
    if (res.area) g.selecionarArea(res.area, { r, c });
    g.focar();
  }

  async colarDoMenu(modo = "tudo") {
    if (!this.podeEditar()) return;
    let txt = null;
    if (!(transferencia && transferencia.view)) {
      try { txt = await navigator.clipboard.readText(); } catch (e) { notice("Use Ctrl+V para colar (o navegador não permitiu ler a área de transferência)."); return; }
    }
    this.colarTexto(txt, modo);
  }

  copiarDoMenu(recortar) {
    const ta = this.grade.ta;
    ta.focus({ preventScroll: true });
    ta.value = " "; ta.select();
    const ok = document.execCommand(recortar ? "cut" : "copy");
    ta.value = "";
    if (!ok) notice("Use Ctrl+C para copiar.");
  }

  // ================================================================ menus
  menuContexto(e, tipo) {
    const g = this.grade, f = g.folha;
    const m = new Menu();
    const ed = this.podeEditar() && !f.especial;
    if (tipo === "canto") { g.selecionarTudo(); }
    m.addItem({ title: "Recortar", icon: "scissors", hotkey: "Ctrl+X", disabled: !ed, onClick: () => this.copiarDoMenu(true) });
    m.addItem({ title: "Copiar", icon: "copy", hotkey: "Ctrl+C", onClick: () => this.copiarDoMenu(false) });
    m.addItem({ title: "Colar", icon: "files", hotkey: "Ctrl+V", disabled: !ed, onClick: () => this.colarDoMenu("tudo") });
    if (!this.csv) m.addItem({ title: "Colar somente valores", disabled: !ed, onClick: () => this.colarDoMenu("valores") });
    if (ed) {
      m.addSeparator();
      if (tipo !== "coluna") this.itensEixo(m, "lin");
      if (tipo !== "linha") { if (tipo !== "coluna") m.addSeparator(); this.itensEixo(m, "col"); }
      if (tipo === "coluna" || tipo === "linha") {
        const a = g.area();
        const eixo = tipo === "coluna" ? "col" : "lin";
        const [x1, x2] = eixo === "col" ? [a.c1, a.c2] : [a.r1, a.r2];
        m.addSeparator();
        m.addItem({ title: "Ocultar", icon: "eye-off", onClick: () => this.pasta.ocultar(f, eixo, x1, x2, true) });
        m.addItem({ title: "Reexibir", icon: "eye", onClick: () => this.pasta.ocultar(f, eixo, Math.max(0, x1 - 1), x2 + 1, false) });
        m.addItem({ title: eixo === "col" ? "Largura da coluna…" : "Altura da linha…", icon: "maximize", onClick: () => this.perguntarTamanho(eixo, x1, x2) });
      }
      m.addSeparator();
      m.addItem({ title: "Limpar conteúdo", icon: "eraser", hotkey: "Delete", onClick: () => this.apagar() });
      if (!this.csv) {
        m.addItem({ title: "Limpar formatação", onClick: () => { const r = this.pasta.limpar(f, this.areaUsada(g.area()), { conteudo: false, formatos: true }); if (r.erro) notice(r.erro); } });
        m.addItem({ title: f.mesclaEm(g.sel.ativa.r, g.sel.ativa.c) ? "Desfazer mesclagem" : "Mesclar e centralizar", icon: "merge", onClick: () => this.alternarMesclar() });
      }
      m.addSeparator();
      m.addItem({ title: "Classificar de A a Z", icon: "sort", onClick: () => this.classificar(true) });
      m.addItem({ title: "Classificar de Z a A", onClick: () => this.classificar(false) });
      if (!this.csv) {
        m.addSeparator();
        const { r, c } = g.sel.ativa;
        if (f.congelar.linhas || f.congelar.colunas) m.addItem({ title: "Descongelar painéis", icon: "grid", onClick: () => this.pasta.congelarPainel(f, 0, 0) });
        else {
          m.addItem({ title: `Congelar até ${nomeCelula(r, c)}`, icon: "grid", onClick: () => this.pasta.congelarPainel(f, r, c) });
          m.addItem({ title: "Congelar primeira linha", onClick: () => this.pasta.congelarPainel(f, 1, 0) });
        }
      }
    }
    m.showAtMouseEvent(e);
  }

  async perguntarTamanho(eixo, x1, x2) {
    const g = this.grade, f = g.folha;
    const atual = eixo === "col" ? (f.colunaInfo(x1)?.attrs.width ? parseFloat(f.colunaInfo(x1).attrs.width) : g.charsDePx(g.col.tam(x1) / g.escala)) : (f.linhas.get(x1)?.ht || f.alturaPadrao);
    const v = await perguntar({ titulo: eixo === "col" ? "Largura da coluna (em caracteres)" : "Altura da linha (em pontos)", valor: String(Math.round(atual * 100) / 100).replace(".", ","), ok: "Aplicar" });
    if (v == null) return;
    const n = parseFloat(v.replace(",", "."));
    if (!isFinite(n) || n < 0 || n > (eixo === "col" ? 255 : 409)) return notice("Valor inválido.");
    if (eixo === "col") this.pasta.larguraColunas(f, x1, x2, n); else this.pasta.alturaLinhas(f, x1, x2, n);
  }

  async classificar(crescente) {
    if (!this.podeEditar()) return;
    const g = this.grade, f = g.folha;
    let a = this.areaUsada(g.area());
    let cabecalho = false;
    if (a.r1 === a.r2 && a.c1 === a.c2) {
      a = this.regiaoAtual(a.r1, a.c1);
      // primeira linha parece cabeçalho? (texto sobre números, ou negrito)
      const info = this.pasta.infoEstilo(f, a.r1, a.c1);
      const v0 = this.pasta.valor(f, a.r1, g.sel.ativa.c), v1 = this.pasta.valor(f, a.r1 + 1, g.sel.ativa.c);
      cabecalho = (typeof v0 === "string" && typeof v1 !== "string") || !!info?.b;
    }
    const r = this.pasta.classificar(f, a, g.sel.ativa.c, crescente, cabecalho);
    if (r.erro) notice(r.erro);
    else g.selecionarArea(a, g.sel.ativa);
  }

  /** bloco contíguo de dados ao redor da célula (como o Ctrl+A do Excel) */
  regiaoAtual(r, c) {
    const g = this.grade;
    let a = { r1: r, c1: c, r2: r, c2: c };
    let mudou = true;
    const tem = (rr, cc) => rr >= 0 && cc >= 0 && g.temValor(rr, cc);
    while (mudou) {
      mudou = false;
      for (let cc = a.c1 - 1; cc <= a.c2 + 1; cc++) { if (tem(a.r1 - 1, cc)) { a.r1--; mudou = true; break; } }
      for (let cc = a.c1 - 1; cc <= a.c2 + 1; cc++) { if (tem(a.r2 + 1, cc)) { a.r2++; mudou = true; break; } }
      for (let rr = a.r1 - 1; rr <= a.r2 + 1; rr++) { if (tem(rr, a.c1 - 1)) { a.c1--; mudou = true; break; } }
      for (let rr = a.r1 - 1; rr <= a.r2 + 1; rr++) { if (tem(rr, a.c2 + 1)) { a.c2++; mudou = true; break; } }
      if (a.r2 - a.r1 > 200000 || a.c2 - a.c1 > 2000) break;
    }
    return a;
  }

  onPaneMenu(m) {
    if (!this.pasta) return;
    m.addItem({ title: "Procurar na planilha", icon: "search", onClick: () => this.abrirBusca() });
    if (!this.somenteLeitura) m.addItem({ title: "Substituir…", icon: "replace", onClick: () => this.abrirBusca(true) });
    m.addSeparator();
    m.addItem({ title: "Aumentar zoom", icon: "zoom-in", onClick: () => this.grade.definirZoom(this.grade.zoom * 1.15) });
    m.addItem({ title: "Diminuir zoom", icon: "zoom-out", onClick: () => this.grade.definirZoom(this.grade.zoom / 1.15) });
    m.addItem({ title: "Zoom 100%", onClick: () => this.grade.definirZoom(1) });
    if (!this.somenteLeitura && !this.csv) {
      m.addSeparator();
      m.addItem({ title: "Nova planilha (aba)", icon: "plus", onClick: () => this.novaFolha() });
      const f = this.grade.folha;
      if (f.congelar.linhas || f.congelar.colunas) m.addItem({ title: "Descongelar painéis", icon: "grid", onClick: () => this.pasta.congelarPainel(f, 0, 0) });
      else m.addItem({ title: "Congelar painéis até a célula selecionada", icon: "grid", onClick: () => this.pasta.congelarPainel(f, this.grade.sel.ativa.r, this.grade.sel.ativa.c) });
    }
  }

  // ================================================================ atalhos e comandos
  atalho(a) {
    const { e, ctrl, k } = a;
    const sh = e.shiftKey, alt = e.altKey;
    const K = k.length === 1 ? k.toLowerCase() : k;
    const faz = fn => { a.tratado = true; fn(); };
    if (ctrl && !alt) {
      if (K === "z" && !sh) return faz(() => this.desfazer());
      if ((K === "y" && !sh) || (K === "z" && sh)) return faz(() => this.refazer());
      if (K === "f" || K === "l") return faz(() => this.abrirBusca());
      if (K === "h" || K === "u" && sh) return faz(() => this.abrirBusca(true));
      if (K === "g") return faz(() => { this.caixaNome.focus(); this.caixaNome.select(); });
      if (K === "PageDown" || K === "PageUp") return faz(() => this.trocarAba(K === "PageDown" ? 1 : -1));
      if (!this.podeEditar()) return;
      if (K === "b") return faz(() => this.alternarFonte("b"));
      if (K === "i") return faz(() => this.alternarFonte("i"));
      if (K === "u") return faz(() => this.alternarFonte("u"));
      if (K === "5") return faz(() => this.alternarFonte("s"));
      if (K === "d") return faz(() => this.preencherCtrl("baixo"));
      if (K === "r") return faz(() => this.preencherCtrl("direita"));
      if (K === ";" || e.code === "Semicolon" || e.code === "Slash" && !sh) return faz(() => this.inserirData(sh));
      if (K === ":" ) return faz(() => this.inserirData(true));
    }
    if (alt && !ctrl && (k === "=" || e.code === "Equal")) return faz(() => this.autoSoma());
  }

  trocarAba(d) {
    const vis = this.pasta.folhas.filter(f => f.estado === "visible");
    const i = vis.indexOf(this.grade.folha);
    this.mostrarFolha(vis[(i + d + vis.length) % vis.length]);
  }

  preencherCtrl(sentido) {
    const g = this.grade, a = g.area();
    let origem, destino;
    if (sentido === "baixo") {
      if (a.r1 === a.r2) { if (a.r1 === 0) return; origem = { ...a, r1: a.r1 - 1, r2: a.r1 - 1 }; destino = a; }
      else { origem = { ...a, r2: a.r1 }; destino = { ...a, r1: a.r1 + 1 }; }
    } else {
      if (a.c1 === a.c2) { if (a.c1 === 0) return; origem = { ...a, c1: a.c1 - 1, c2: a.c1 - 1 }; destino = a; }
      else { origem = { ...a, c2: a.c1 }; destino = { ...a, c1: a.c1 + 1 }; }
    }
    const r = this.pasta.preencher(g.folha, origem, destino, { serie: false });
    if (r.erro) notice(r.erro);
  }

  getCommands() {
    if (!this.pasta) return [];
    const C = (id, nome, fn, tecla) => ({ id: "planilha-" + id, nome, fn: () => { fn(); this.grade?.focar(); }, tecla });
    const lista = [
      C("procurar", "Planilha: procurar", () => this.abrirBusca(), "Ctrl+F"),
      C("ir-para", "Planilha: ir para a célula…", () => { this.caixaNome.focus(); this.caixaNome.select(); }, "Ctrl+G"),
      C("zoom-mais", "Planilha: aumentar zoom", () => this.grade.definirZoom(this.grade.zoom * 1.15)),
      C("zoom-menos", "Planilha: diminuir zoom", () => this.grade.definirZoom(this.grade.zoom / 1.15)),
      C("aba-proxima", "Planilha: ir para a próxima aba", () => this.trocarAba(1), "Ctrl+PageDown"),
      C("aba-anterior", "Planilha: ir para a aba anterior", () => this.trocarAba(-1), "Ctrl+PageUp"),
    ];
    if (this.somenteLeitura) return lista;
    lista.push(
      C("substituir", "Planilha: substituir", () => this.abrirBusca(true), "Ctrl+H"),
      C("desfazer", "Planilha: desfazer", () => this.desfazer(), "Ctrl+Z"),
      C("refazer", "Planilha: refazer", () => this.refazer(), "Ctrl+Y"),
      C("soma", "Planilha: soma automática", () => this.autoSoma(), "Alt+="),
      C("inserir-linha", "Planilha: inserir linha acima", () => this.inserir("lin", this.grade.area().r1, 1)),
      C("inserir-linha-abaixo", "Planilha: inserir linha abaixo", () => this.inserir("lin", this.grade.area().r2 + 1, 1)),
      C("inserir-coluna", "Planilha: inserir coluna à esquerda", () => this.inserir("col", this.grade.area().c1, 1)),
      C("excluir-linha", "Planilha: excluir linhas selecionadas", () => { const a = this.grade.area(); this.excluir("lin", a.r1, a.r2 - a.r1 + 1); }),
      C("excluir-coluna", "Planilha: excluir colunas selecionadas", () => { const a = this.grade.area(); this.excluir("col", a.c1, a.c2 - a.c1 + 1); }),
      C("preencher-abaixo", "Planilha: preencher abaixo", () => this.preencherCtrl("baixo"), "Ctrl+D"),
      C("preencher-direita", "Planilha: preencher à direita", () => this.preencherCtrl("direita"), "Ctrl+R"),
      C("classificar-az", "Planilha: classificar de A a Z", () => this.classificar(true)),
      C("classificar-za", "Planilha: classificar de Z a A", () => this.classificar(false)),
      C("data-hoje", "Planilha: inserir a data de hoje", () => this.inserirData(false), "Ctrl+;"),
      C("limpar", "Planilha: limpar conteúdo", () => this.apagar(), "Delete"),
    );
    if (!this.csv) lista.push(
      C("negrito", "Planilha: negrito", () => this.alternarFonte("b"), "Ctrl+B"),
      C("italico", "Planilha: itálico", () => this.alternarFonte("i"), "Ctrl+I"),
      C("sublinhado", "Planilha: sublinhado", () => this.alternarFonte("u"), "Ctrl+U"),
      C("mesclar", "Planilha: mesclar e centralizar / desfazer mesclagem", () => this.alternarMesclar()),
      C("moeda", "Planilha: formato moeda (R$)", () => this.aplicarFormato(FORMATOS_PADRAO.moeda)),
      C("percentual", "Planilha: formato percentual", () => this.aplicarFormato("0%")),
      C("data", "Planilha: formato data", () => this.aplicarFormato(FORMATOS_PADRAO.data)),
      C("geral", "Planilha: formato geral", () => this.aplicarFormato("General")),
      C("limpar-formatos", "Planilha: limpar formatação", () => this.pasta.limpar(this.grade.folha, this.areaUsada(this.grade.area()), { conteudo: false, formatos: true })),
      C("nova-aba", "Planilha: nova aba", () => this.novaFolha()),
      C("renomear-aba", "Planilha: renomear aba", () => this.renomearFolha(this.grade.folha, this.abasEl.querySelector(".sheet-tab.is-active"))),
      C("excluir-aba", "Planilha: excluir aba", () => this.excluirFolha(this.grade.folha)),
      C("congelar", "Planilha: congelar painéis até a célula selecionada", () => this.pasta.congelarPainel(this.grade.folha, this.grade.sel.ativa.r, this.grade.sel.ativa.c)),
      C("descongelar", "Planilha: descongelar painéis", () => this.pasta.congelarPainel(this.grade.folha, 0, 0)),
    );
    return lista;
  }

  getMobileToolbar() {
    if (!this.pasta || this.somenteLeitura) return [];
    const g = () => this.grade;
    return [
      { icon: "check", title: "Confirmar", fn: () => g().confirmarEdicao({ dr: 1, dc: 0 }) },
      { icon: "x", title: "Cancelar edição", fn: () => g().cancelarEdicao() },
      { icon: "undo", title: "Desfazer", fn: () => this.desfazer() },
      { icon: "redo", title: "Refazer", fn: () => this.refazer() },
      { icon: "sigma", title: "Soma automática", fn: () => this.autoSoma() },
      { icon: "rows", title: "Inserir linha abaixo", fn: () => this.inserir("lin", this.grade.area().r2 + 1, 1) },
      { icon: "columns", title: "Inserir coluna à direita", fn: () => this.inserir("col", this.grade.area().c2 + 1, 1) },
      ...(this.csv ? [] : [{ icon: "bold", title: "Negrito", fn: () => this.alternarFonte("b") }, { icon: "dollar", title: "Moeda", fn: () => this.aplicarFormato(FORMATOS_PADRAO.moeda) }]),
      { icon: "search", title: "Procurar", fn: () => this.abrirBusca() },
    ];
  }

  getStatus() {
    const g = this.grade;
    if (!g || !this.pasta || g.folha?.especial) return [];
    const a = g.area();
    const itens = [];
    const unica = a.r1 === a.r2 && a.c1 === a.c2 || (g.folha.mesclaEm(a.r1, a.c1) && nomeIntervalo(g.folha.mesclaEm(a.r1, a.c1)) === nomeIntervalo(a));
    if (!unica) {
      const st = this.pasta.estatisticas(g.folha, this.areaUsada(a));
      if (st.numeros > 0) {
        itens.push({ texto: "Soma: " + this.pasta.formatarNumeroStatus(st.soma, st.formato), title: "Soma dos números selecionados" });
        itens.push({ texto: "Média: " + this.pasta.formatarNumeroStatus(st.media, st.formato), title: "Média dos números selecionados" });
      }
      if (st.contagem > 0) itens.push({ texto: "Contagem: " + st.contagem.toLocaleString("pt-BR"), title: "Células preenchidas" });
    }
    const v = this.pasta.valor(g.folha, g.sel.ativa.r, g.sel.ativa.c);
    if (v && typeof v === "object" && v.tipo === "CYCLE") itens.push({ texto: "Referência circular", icon: "alert-circle" });
    itens.push({ texto: (g.folha.nome && !this.csv ? g.folha.nome + " · " : "") + (unica ? nomeCelula(g.sel.ativa.r, g.sel.ativa.c) : nomeIntervalo(a)), title: "Célula selecionada" });
    if (Math.abs(g.zoom - 1) > 0.01) itens.push({ texto: Math.round(g.zoom * 100) + "%", title: "Zoom (Ctrl + roda do mouse)", onClick: () => g.definirZoom(1) });
    void fmtN;
    return itens;
  }

  // ================================================================ busca
  abrirBusca(substituir = false) {
    if (!this.barraBusca) return;
    this.barraBusca.classList.remove("is-hidden");
    if (substituir && !this.somenteLeitura) this.linhaTroca.classList.remove("is-hidden");
    const { r, c } = this.grade.sel.ativa;
    if (!this.buscaInput.value) { const v = this.pasta.valor(this.grade.folha, r, c); if (typeof v === "string" && v.length < 60 && !this.resultados) this.buscaInput.value = ""; }
    this.buscaInput.focus(); this.buscaInput.select();
    this.grade.redimensionar();
  }
  fecharBusca() {
    this.barraBusca.classList.add("is-hidden");
    this.linhaTroca.classList.add("is-hidden");
    this.grade.realce = null;
    this.resultados = null;
    this.grade.redimensionar();
    this.grade.focar();
  }
  buscar() {
    const q = this.buscaInput.value;
    this.consultaFeita = q;
    if (!q) { this.resultados = null; this.buscaInfo.textContent = ""; this.grade.realce = null; this.grade.desenhar(); return; }
    const todas = this.buscaTodas.querySelector("input").checked;
    this.resultados = this.pasta.procurar(q, { todasFolhas: todas, folha: this.grade.folha });
    // começa a partir da célula atual
    const { r, c } = this.grade.sel.ativa;
    let i = this.resultados.findIndex(x => x.folha === this.grade.folha && (x.r > r || (x.r === r && x.c >= c)));
    this.indiceBusca = i < 0 ? 0 : i;
    this.mostrarResultado();
  }
  proximo(d) {
    if (!this.resultados) return this.buscar();
    if (!this.resultados.length) return;
    this.indiceBusca = (this.indiceBusca + d + this.resultados.length) % this.resultados.length;
    this.mostrarResultado();
  }
  mostrarResultado() {
    const n = this.resultados.length;
    this.buscaInfo.textContent = n ? `${this.indiceBusca + 1} de ${n}` : "Nenhum resultado";
    this.buscaInfo.classList.toggle("mod-empty", !n);
    if (!n) { this.grade.realce = null; this.grade.desenhar(); return; }
    const x = this.resultados[this.indiceBusca];
    if (x.folha !== this.grade.folha) this.mostrarFolha(x.folha);
    this.grade.selecionar(x.r, x.c);
    this.grade.realce = { folha: x.folha, r: x.r, c: x.c };
    this.grade.desenhar();
  }
  substituir(tudo) {
    if (!this.podeEditar()) return;
    const q = this.buscaInput.value, novo = this.trocaInput.value;
    if (!q) return;
    if (!this.resultados) this.buscar();
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const alvos = tudo ? this.resultados : [this.resultados[this.indiceBusca]].filter(Boolean);
    const porFolha = new Map();
    let n = 0;
    for (const x of alvos) {
      const cel = x.folha.cel(x.r, x.c);
      if (cel && cel.f != null) continue; // não mexe em fórmulas
      const t = this.pasta.textoEdicao(x.folha, x.r, x.c);
      const t2 = t.replace(re, novo.replace(/\$/g, "$$$$"));
      if (t2 === t) continue;
      if (!porFolha.has(x.folha)) porFolha.set(x.folha, []);
      porFolha.get(x.folha).push({ r: x.r, c: x.c, texto: t2 });
      n++;
    }
    let partes = 0;
    for (const [f, itens] of porFolha) { const r = this.pasta.definir(f, itens, { nome: "Substituir" }); if (!r.erro) partes++; }
    if (partes > 1) this.pasta.agrupar(partes, "Substituir");
    notice(n ? `${n} ${n === 1 ? "substituição feita" : "substituições feitas"}.` : "Nada para substituir (fórmulas não são alteradas).", { tempo: 2500 });
    this.buscar();
  }

  destacarBusca(q) {
    if (!this.pasta || !q) return;
    const r = this.pasta.procurar(q, { todasFolhas: true });
    if (!r.length) return;
    const x = r[0];
    if (x.folha !== this.grade.folha) this.mostrarFolha(x.folha);
    this.grade.selecionar(x.r, x.c);
    this.grade.realce = { folha: x.folha, r: x.r, c: x.c };
    this.grade.desenhar();
    this.grade.focar();
  }

  // ================================================================ estado, gravação, ciclo de vida
  getState() {
    const st = super.getState();
    if (this.grade) { st.aba = this.grade.folha?.nome; st.celula = nomeCelula(this.grade.sel.ativa.r, this.grade.sel.ativa.c); }
    return st;
  }
  async setState(st) {
    if (!this.grade || !st) return;
    if (st.aba) { const f = this.pasta.folhaPorNome(st.aba); if (f && f.estado === "visible") this.mostrarFolha(f); }
    if (st.celula) { const p = lerCelula(st.celula); if (p) this.grade.selecionar(p.r, p.c); }
  }

  async getSaveData() {
    if (!this.pasta || this.somenteLeitura) return null;
    if (this.grade.ed && !this.grade.confirmarEdicao({ mover: false })) throw new Error("Corrija a fórmula da célula em edição antes de salvar.");
    this.salvandoAgora = true;
    try {
      if (this.csv) {
        const r = gravarCsv(this.pasta);
        this.confirmarGravacao = r.confirmar;
        if (r.aviso) notice(r.aviso, { tempo: 8000 });
        return r.bytes;
      }
      const r = await gravarXlsx(this.pasta);
      this.confirmarGravacao = r.confirmar;
      return r.bytes;
    } catch (e) {
      this.salvandoAgora = false;
      throw e;
    }
  }

  async save(o = {}) {
    if (!this.pasta || this.somenteLeitura) return false;
    let ok = false;
    try { ok = await super.save(o); }
    finally {
      if (ok && this.confirmarGravacao) { try { this.confirmarGravacao(); } catch (e) { console.error(e); } }
      this.confirmarGravacao = null;
      this.salvandoAgora = false;
    }
    if (ok) { this.setDirty(false); this.app.atualizarStatus?.(); }
    return ok;
  }

  focus() { setTimeout(() => this.grade?.focar(), 0); }
  onResize() { this.grade?.redimensionar(); }
  async onClose() {
    this.grade?.destruir();
    this.pasta?.destruir();
    if (transferencia && transferencia.view === this) transferencia = null;
    this.grade = null; this.pasta = null;
    this.acaoBusca?.remove(); this.acaoBusca = null;
  }
}

/** lê texto colado (tabulações e quebras; campos entre aspas como o Excel gera) */
function lerTsv(txt) {
  const t = txt.replace(/\r\n?/g, "\n");
  const linhas = [];
  let campo = "", linha = [], i = 0, aspas = false;
  while (i < t.length) {
    const ch = t[i];
    if (aspas) {
      if (ch === '"') { if (t[i + 1] === '"') { campo += '"'; i += 2; continue; } aspas = false; i++; continue; }
      campo += ch; i++; continue;
    }
    if (ch === '"' && campo === "") { aspas = true; i++; continue; }
    if (ch === "\t") { linha.push(campo); campo = ""; i++; continue; }
    if (ch === "\n") { linha.push(campo); linhas.push(linha); linha = []; campo = ""; i++; continue; }
    campo += ch; i++;
  }
  if (campo !== "" || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

export { citarFolha, MAX_COLUNAS };
