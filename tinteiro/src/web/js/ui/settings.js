// Janela de configurações.
import { h, vazio } from "../util/dom.js";
import { icon } from "../util/icons.js";
import { Modal } from "./modal.js";
import { notice, erro } from "./notice.js";
import { VERSAO } from "../app.js";

function item(nome, desc, controle) {
  return h("div.setting-item", h("div.setting-item-info", h("div.setting-item-name", { text: nome }), desc ? h("div.setting-item-description", typeof desc === "string" ? { text: desc } : null, typeof desc === "string" ? null : desc) : null), h("div.setting-item-control", controle));
}
function interruptor(valor, aoMudar) {
  const el = h("div.checkbox-container" + (valor ? ".is-enabled" : ""), { role: "switch", tabindex: "0" });
  const alt = () => { valor = !valor; el.classList.toggle("is-enabled", valor); aoMudar(valor); };
  el.addEventListener("click", alt);
  el.addEventListener("keydown", e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); alt(); } });
  return el;
}
function seletor(opcoes, valor, aoMudar) {
  const s = h("select", opcoes.map(([v, t]) => h("option", { value: v, text: t, selected: v === valor })));
  s.addEventListener("change", () => aoMudar(s.value));
  return s;
}

export function abrirConfiguracoes(app, abaInicial = "geral") {
  const m = new Modal({ classe: "mod-settings" });
  m.titleEl.remove();
  const cab = h("div.vertical-tab-header");
  const conteudo = h("div.vertical-tab-content-container");
  m.contentEl.replaceWith(cab, conteudo);
  m.modalEl.querySelector(".modal-close-button").style.zIndex = 5;
  const abas = [
    ["geral", "Geral", "settings", geral],
    ["aparencia", "Aparência", "palette", aparencia],
    ["editor", "Editor", "pencil", editor],
    ["sincronizacao", app.backend.kind === "local" ? "Sincronização" : "Celular e sincronização", "smartphone", sincronizacao],
    ["sobre", "Sobre e atualizações", "info", sobre],
  ];
  cab.appendChild(h("div.vertical-tab-header-group-title", { text: "Opções" }));
  const itens = {};
  const mostrar = id => {
    for (const [k, el] of Object.entries(itens)) el.classList.toggle("is-active", k === id);
    vazio(conteudo);
    const aba = abas.find(a => a[0] === id) || abas[0];
    const c = h("div.vertical-tab-content");
    c.appendChild(h("h2", { text: aba[1] }));
    conteudo.appendChild(c);
    aba[3](app, c, m);
  };
  for (const [id, nome, ic] of abas) {
    itens[id] = h("div.vertical-tab-nav-item", { onclick: () => mostrar(id) }, icon(ic), h("span", { text: nome }));
    cab.appendChild(itens[id]);
  }
  m.open();
  mostrar(abaInicial);
}

async function geral(app, c) {
  const info = app.backend.info || {};
  if (app.backend.caps.settings) {
    let s = {};
    try { s = await app.backend.settings(); } catch (e) {}
    const inp = h("input", { type: "text", value: s.root || info.root || "", spellcheck: "false" });
    const escolher = h("button", { text: "Escolher…", onclick: async () => { try { const r = await app.backend.chooseFolder(); if (r.path) inp.value = r.path; } catch (e) { notice("Digite o caminho completo da pasta."); } } });
    const aplicar = h("button.mod-cta", { text: "Usar esta pasta", onclick: async () => {
      try { await app.backend.saveSettings({ root: inp.value.trim() }); notice("Pasta raiz trocada. Recarregando…"); setTimeout(() => location.reload(), 600); }
      catch (e) { erro("Não foi possível usar essa pasta.", e); }
    } });
    c.appendChild(item("Pasta raiz", "Pasta onde ficam seus arquivos. Padrão: C:\\CL", [inp, escolher, aplicar]));
    if (app.backend.caps.reveal) c.appendChild(item("Abrir a pasta raiz", "Abre no Explorador de Arquivos do Windows.", h("button", { text: "Abrir", onclick: () => app.backend.reveal("") })));
  } else {
    c.appendChild(item("Arquivos", app.backend.kind === "local" ? "Cópia guardada neste aparelho e sincronizada com o computador." : `Pasta do computador: ${info.root || ""}`, null));
  }
  c.appendChild(item("Abrir sempre em nova aba", "Ao tocar num arquivo, abre numa aba nova em vez de trocar a aba atual.", interruptor(!!app.config.sempreNovaAba, v => { app.config.sempreNovaAba = v; app.salvarConfig(); })));
  c.appendChild(item("Histórico de versões", "Toda vez que você salva, a versão anterior é guardada (até 60 por arquivo) na pasta oculta .tinteiro\\historico dentro da pasta raiz.", null));
}

function aparencia(app, c) {
  c.appendChild(item("Tema", "Claro, escuro ou seguir o sistema.", seletor([["sistema", "Igual ao sistema"], ["claro", "Claro"], ["escuro", "Escuro"]], app.config.tema, v => { app.config.tema = v; app.salvarConfig(); app.aplicarTema(); })));
  const tam = h("input", { type: "number", min: "10", max: "30", value: String(app.config.tamanhoFonte || 16), style: { width: "70px" } });
  tam.addEventListener("change", () => { app.config.tamanhoFonte = Math.max(10, Math.min(30, Number(tam.value) || 16)); app.salvarConfig(); app.aplicarTema(); });
  c.appendChild(item("Tamanho da fonte das notas", "Em pixels. Padrão: 16.", tam));
  c.appendChild(item("Largura de leitura", "Limita a largura do texto das notas para facilitar a leitura.", interruptor(app.config.larguraLegivel !== false, v => { app.config.larguraLegivel = v; app.salvarConfig(); app.aplicarTema(); notice("Vale para as notas abertas a partir de agora."); })));
}

function editor(app, c) {
  c.appendChild(item("Modo padrão das notas", "Como as notas Markdown abrem.", seletor([["editar", "Edição com pré-visualização ao vivo"], ["ler", "Modo leitura"]], app.config.modoPadraoMd || "editar", v => { app.config.modoPadraoMd = v; app.salvarConfig(); })));
  c.appendChild(item("Verificar ortografia", "Sublinha palavras com erro nas notas (português).", interruptor(app.config.verificarOrtografia !== false, v => { app.config.verificarOrtografia = v; app.salvarConfig(); })));
  c.appendChild(item("Word, Excel e PDF", "Esses arquivos são salvos quando você pede (Ctrl+S ou o botão Salvar). Notas e textos salvam sozinhos.", null));
}

async function sincronizacao(app, c, m) {
  if (app.backend.kind === "local") {
    const { telaSyncCelular } = await import("../mobile/sync-ui.js");
    return telaSyncCelular(app, c, m);
  }
  if (!app.backend.caps.pairing) { c.appendChild(h("p", { text: "Abra esta tela no computador para parear o celular." })); return; }
  let p;
  try { p = await app.backend.pairing(); } catch (e) { c.appendChild(h("p", { text: "Não foi possível ler os dados de pareamento." })); return; }
  const QR = (await import("qrcode")).default;
  const qrBox = h("div.qr-box");
  const canvas = document.createElement("canvas");
  qrBox.appendChild(canvas);
  await QR.toCanvas(canvas, p.link, { width: 220, margin: 1, errorCorrectionLevel: "M" });
  c.appendChild(h("p.setting-item-description", { style: { fontSize: "14px" }, text: "Os arquivos ficam no computador e o celular guarda uma cópia que funciona sem internet. Quando o celular está no mesmo Wi-Fi do computador (com o Tinteiro aberto), as alterações dos dois lados são trocadas sozinhas." }));
  c.appendChild(h("div.pairing-grid", qrBox, h("div", { style: { flex: "1 1 260px", minWidth: "240px" } },
    h("div.setting-item-name", { text: "Para parear:" }),
    h("ol", { style: { lineHeight: "1.7", paddingLeft: "20px", marginTop: "6px" } },
      h("li", { text: "Instale o Tinteiro no celular (APK no Android)." }),
      h("li", { text: "No celular, abra o Tinteiro, toque em ☰ (menu) → Configurações → Sincronização → Ler QR do computador." }),
      h("li", { text: "Aponte a câmera para este código." })),
    h("div.setting-item-description", { text: "Endereço deste computador na rede:" }),
    h("div.code-line", { text: (p.urls || []).join("   ") || "sem rede" }),
    h("div.setting-item-description", { style: { marginTop: "8px" }, text: "Código de acesso:" }),
    h("div.code-line", { text: p.token }))));
  const ts = p.tailscale || {};
  const tsDesc = ts.installed
    ? (ts.running ? `Tailscale ligado (${ts.dnsName || ts.ip}). ${ts.serving ? "Acesso seguro ativo: " + ts.httpsUrl : "Clique em “Ativar acesso seguro” para o iPhone e para sincronizar fora de casa."}` : "Tailscale instalado, mas desligado. Abra o Tailscale e entre na sua conta.")
    : "Para sincronizar fora de casa e para usar no iPhone, instale o Tailscale (gratuito) no computador e no celular, com a mesma conta.";
  const tsCtl = [];
  if (ts.installed && ts.running) tsCtl.push(h("button.mod-cta", { text: ts.serving ? "Mostrar QR do iPhone" : "Ativar acesso seguro", onclick: async () => {
    try {
      const r = ts.serving ? { ok: true, status: ts } : await app.backend.tailscaleServe();
      if (r.enableUrl) { window.open(r.enableUrl, "_blank"); notice("Autorize o HTTPS na página do Tailscale que abriu e clique de novo aqui."); return; }
      const st = r.status || ts;
      if (!st.httpsUrl) { notice(r.message || "Não foi possível ativar."); return; }
      const link = `${st.httpsUrl}/#pair=${encodeURIComponent(p.token)}`;
      const md = new Modal({ titulo: "iPhone: abra este código na câmera" });
      const cv = document.createElement("canvas");
      await QR.toCanvas(cv, link, { width: 240, margin: 1 });
      md.contentEl.append(h("div.qr-box", cv), h("p", { style: { marginTop: "12px" }, text: "1) Aponte a câmera do iPhone e toque no link. 2) No Safari, toque em Compartilhar → Adicionar à Tela de Início. Pronto: o Tinteiro funciona offline e sincroniza quando houver internet." }), h("div.code-line", { text: link }));
      md.open();
    } catch (e) { erro("Falhou.", e); }
  } }));
  c.appendChild(item("Fora de casa e iPhone (Tailscale)", tsDesc, tsCtl));
  c.appendChild(item("Trocar código de acesso", "Desconecta todos os celulares pareados (eles precisarão ler o QR de novo).", h("button.mod-warning", { text: "Gerar novo código", onclick: async () => { await app.backend.resetPairing(); notice("Código trocado."); m.close(); app.abrirConfiguracoes("sincronizacao"); } })));
  let s = {};
  try { s = await app.backend.settings(); } catch (e) {}
  c.appendChild(item("Aceitar conexões do celular", "Deixa o celular acessar este computador pela rede Wi-Fi (o Windows pode pedir para permitir).", interruptor(s.lan !== false, async v => { await app.backend.saveSettings({ lan: v }); notice(v ? "Conexões do celular ligadas." : "Conexões do celular desligadas."); })));
}

function sobre(app, c) {
  c.appendChild(item("Versão", `Tinteiro ${VERSAO}`, app.desktop ? h("button", { text: "Procurar atualização", onclick: () => app.desktop.checkUpdates?.(true) }) : null));
  c.appendChild(item("Atualizações", app.desktop ? "O app procura atualização sozinho ao abrir e a cada 6 horas. Quando baixar, aparece “Atualização pronta” na barra de baixo: clique para reiniciar." : "No celular, a atualização vem do computador na sincronização.", null));
  c.appendChild(item("Licenças", "Usa CodeMirror (MIT), pdf.js (Apache 2.0), pdf-lib (MIT), docx-preview (Apache 2.0), HyperFormula (GPL v3), JSZip (MIT), Lucide (ISC), markdown-it (MIT).", null));
}
