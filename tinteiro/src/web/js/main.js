// Ponto de entrada: escolhe de onde vêm os arquivos e inicia o app.
import { App } from "./app.js";
import { HttpBackend } from "./backends/http.js";
import { h } from "./util/dom.js";

async function iniciar() {
  const raiz = document.getElementById("app");
  const params = new URLSearchParams(location.hash.slice(1));
  const nativo = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const local = /^(127\.0\.0\.1|localhost|\[::1\])$/.test(location.hostname) && !nativo;
  const forcarLocal = new URLSearchParams(location.search).get("modo") === "local"; // testes
  const celular = nativo || forcarLocal || (matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 820);
  const consulta = new URLSearchParams(location.search);
  const tokenUrl = params.get("token") || params.get("pair") || consulta.get("pair");
  if (tokenUrl) { localStorage.setItem("tinteiro.token", tokenUrl); history.replaceState(null, "", location.pathname + (consulta.get("modo") ? "?modo=" + consulta.get("modo") : "")); }
  const token = tokenUrl || localStorage.getItem("tinteiro.token");

  let backend, plataforma;
  if (!nativo && !forcarLocal && (local || !celular) && token) {
    backend = new HttpBackend(location.origin, token);
    plataforma = window.tinteiroDesktop ? "desktop" : "web";
  } else {
    const { LocalBackend } = await import("./backends/local.js");
    backend = new LocalBackend();
    plataforma = nativo ? "android" : "pwa";
    // aberto a partir do computador (rede de casa ou Tailscale): já fica pareado com ele
    if (tokenUrl && !nativo) backend.parearCom(location.origin, tokenUrl);
  }
  try {
    await backend.connect();
  } catch (e) {
    document.body.classList.add("is-ready", "theme-dark");
    raiz.appendChild(h("div.boot-error", h("h2", { text: "Não foi possível abrir os arquivos" }), h("p", { text: e.message || String(e) }),
      h("p", { text: "Se você abriu pelo navegador, use o atalho do Tinteiro ou o link de pareamento mostrado no computador." })));
    return;
  }
  // iPhone: ao "Adicionar à Tela de Início", o app instalado já nasce pareado com o computador
  const tk = backend.sync?.cfg?.token;
  if (plataforma === "pwa" && tk && backend.sync.cfg.urls?.includes(location.origin)) { const l = document.querySelector('link[rel="manifest"]'); if (l) l.href = "manifest.webmanifest?pair=" + encodeURIComponent(tk); }
  const app = new App({ backend, plataforma });
  window.tinteiro = app;
  await app.start(raiz);
  if (plataforma === "pwa" && "serviceWorker" in navigator && (location.protocol === "https:" || /^(127\.0\.0\.1|localhost)$/.test(location.hostname))) navigator.serviceWorker.register("sw.js").catch(() => {});
}
iniciar();
