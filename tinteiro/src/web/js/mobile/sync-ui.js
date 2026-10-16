// Configurações de sincronização no celular: parear pelo QR do computador, status, opções.
import { h, vazio, formatData, formatBytes } from "../util/dom.js";
import { icon } from "../util/icons.js";
import { notice, erro } from "../ui/notice.js";
import { confirmar } from "../ui/modal.js";

function item(nome, desc, controle) {
  return h("div.setting-item", h("div.setting-item-info", h("div.setting-item-name", { text: nome }), desc ? h("div.setting-item-description", { text: desc }) : null), h("div.setting-item-control", controle));
}

export async function telaSyncCelular(app, c, modal) {
  const s = app.backend.sync;
  const corpo = h("div");
  c.appendChild(corpo);
  const desenhar = async () => {
    vazio(corpo);
    if (!s.pareado) {
      corpo.append(
        h("p.setting-item-description", { style: { fontSize: "14px" }, text: "Pareie este celular com o Tinteiro do computador para ter aqui os mesmos arquivos. As alterações são trocadas sozinhas quando o celular está no mesmo Wi-Fi do computador (com o Tinteiro aberto). Fora de casa, use o Tailscale (gratuito)." }),
        item("Ler QR do computador", "No computador: Configurações → Celular e sincronização.", h("button.mod-cta", { onclick: () => lerQR(app, desenhar) }, icon("camera"), h("span", { text: "Ler QR" }))),
        item("Digitar endereço e código", "Se a câmera não funcionar.", h("button", { text: "Digitar…", onclick: () => digitar(app, desenhar) })));
      return;
    }
    const cfg = s.cfg;
    const usado = await s.espacoUsado();
    const regs = (await app.backend.banco.all("arquivos")).filter(r => r.type === "file" && !r.apagado);
    const offline = regs.filter(r => r.temDados).length;
    corpo.append(
      item("Computador", `${cfg.computador} — pasta “${cfg.cofre}”. Endereço: ${cfg.urls.join(", ")}`, h("button.mod-cta", { onclick: async () => { await s.sincronizar(); desenhar(); } }, icon("refresh"), h("span", { text: "Sincronizar agora" }))),
      item("Situação", `${(s.mensagem || s.estado).replace(/\.+$/, "")}. Última sincronização: ${s.ultima ? formatData(s.ultima) : "nunca"}.`, null),
      item("Arquivos neste celular", `${regs.length} arquivos (${offline} disponíveis sem internet). Espaço usado: ${formatBytes(usado)}.`, null),
      item("Baixar todos os arquivos", "Ligado: todos os arquivos ficam no celular para usar sem internet. Desligado: só os que você abrir.", interruptor(s.opcoes.baixarTudo, async v => { await s.salvarOpcoes({ baixarTudo: v }); })),
      item("Endereço seguro (Tailscale)", "Para sincronizar fora de casa: o endereço https do computador no Tailscale.", h("button", { text: "Adicionar…", onclick: async () => {
        const v = prompt("Endereço do computador no Tailscale (ex.: https://meu-pc.tail1234.ts.net)");
        if (!v) return;
        const url = v.trim().replace(/\/+$/, "");
        if (!cfg.urls.includes(url)) cfg.urls.push(url);
        await app.backend.banco.put("meta", cfg, "pareamento");
        notice("Endereço adicionado.");
        desenhar();
      } })),
      item("Parear de novo", "Use se o código do computador mudou.", h("button", { onclick: () => lerQR(app, desenhar) }, icon("camera"), h("span", { text: "Ler QR" }))),
      item("Desparear", "Este celular para de sincronizar (os arquivos continuam aqui).", h("button.mod-warning", { text: "Desparear", onclick: async () => { if (await confirmar({ titulo: "Desparear", texto: "Parar de sincronizar com o computador?", perigo: true, ok: "Desparear" })) { await s.desparear(); desenhar(); } } })),
    );
  };
  const off = s.on("estado", () => { if (corpo.isConnected) desenhar(); });
  modal.aoFechar.push(off);
  await desenhar();
}

function interruptor(valor, aoMudar) {
  const el = h("div.checkbox-container" + (valor ? ".is-enabled" : ""), { role: "switch", tabindex: "0" });
  el.addEventListener("click", () => { valor = !valor; el.classList.toggle("is-enabled", valor); aoMudar(valor); });
  return el;
}

async function concluirPareamento(app, texto, depois) {
  try {
    await app.backend.sync.parear(texto.trim());
    notice("Pareado! Baixando os arquivos do computador…");
    await app.backend.sync.sincronizar();
    await app.vault.refresh();
    depois && depois();
  } catch (e) { erro("Não foi possível parear. Confira se o celular está no mesmo Wi-Fi e se o Tinteiro está aberto no computador.", e); }
}

async function digitar(app, depois) {
  const { Modal } = await import("../ui/modal.js");
  const m = new Modal({ titulo: "Parear com o computador" });
  const end = h("input", { type: "text", placeholder: "192.168.0.10:27182", inputmode: "url", autocapitalize: "off" });
  const cod = h("input", { type: "text", placeholder: "código de acesso", autocapitalize: "off", spellcheck: "false" });
  m.contentEl.append(h("p", { text: "Os dados aparecem no computador em Configurações → Celular e sincronização." }), h("div.setting-item-name", { text: "Endereço" }), end, h("div.setting-item-name", { style: { marginTop: "10px" }, text: "Código de acesso" }), cod);
  m.botoes([{ texto: "Cancelar", acao: () => m.close() }, { texto: "Parear", cta: true, acao: async () => {
    let e = end.value.trim(); if (!e) return;
    if (!/^https?:\/\//.test(e)) e = "http://" + e;
    m.close();
    try { await app.backend.sync.parear(e, cod.value.trim()); notice("Pareado! Sincronizando…"); await app.backend.sync.sincronizar(); await app.vault.refresh(); depois && depois(); }
    catch (err) { erro("Não foi possível parear.", err); }
  } }]);
  m.open();
}

/** câmera + leitura de QR (jsQR) */
export async function lerQR(app, depois) {
  const jsQR = (await import("jsqr")).default;
  const tela = h("div.qr-scanner");
  const video = h("video", { playsinline: true, muted: true, autoplay: true });
  const msg = h("div.qr-scanner-msg", { text: "Aponte para o QR que aparece no computador" });
  const fechar = () => { parar(); tela.remove(); };
  tela.append(video, h("div.qr-scanner-moldura"), msg, h("button.qr-scanner-fechar", { text: "Cancelar", onclick: fechar }));
  document.body.appendChild(tela);
  let stream = null, rodando = true;
  const parar = () => { rodando = false; stream?.getTracks().forEach(t => t.stop()); };
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
  } catch (e) {
    msg.textContent = "Não consegui usar a câmera. Permita o acesso à câmera ou use “Digitar…”.";
    return;
  }
  video.srcObject = stream;
  await video.play().catch(() => {});
  const cv = document.createElement("canvas");
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  const ler = () => {
    if (!rodando) return;
    if (video.readyState >= 2) {
      const w = Math.min(640, video.videoWidth), hh = Math.round(video.videoHeight * w / video.videoWidth);
      cv.width = w; cv.height = hh;
      ctx.drawImage(video, 0, 0, w, hh);
      const img = ctx.getImageData(0, 0, w, hh);
      const r = jsQR(img.data, w, hh, { inversionAttempts: "dontInvert" });
      if (r && r.data && /\/parear|tinteiro:\/\/|#pair=/.test(r.data)) { fechar(); concluirPareamento(app, r.data, depois); return; }
    }
    requestAnimationFrame(ler);
  };
  ler();
}
