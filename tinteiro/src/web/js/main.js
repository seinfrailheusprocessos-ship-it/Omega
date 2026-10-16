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
  let token = params.get("token") || params.get("pair");
  if (token) { localStorage.setItem("tinteiro.token", token); history.replaceState(null, "", location.pathname + location.search); }
  token = token || localStorage.getItem("tinteiro.token");

  let backend, plataforma;
  if (!nativo && !forcarLocal && (local || !celular) && token) {
    backend = new HttpBackend(location.origin, token);
    plataforma = window.tinteiroDesktop ? "desktop" : "web";
  } else {
    const { LocalBackend } = await import("./backends/local.js");
    backend = new LocalBackend();
    plataforma = nativo ? "android" : "pwa";
    // aberto a partir do computador (rede de casa ou Tailscale): já fica pareado com ele
    if (token && !nativo) backend.parearCom(location.origin, token);
  }
  try {
    await backend.connect();
  } catch (e) {
    document.body.classList.add("is-ready", "theme-dark");
    raiz.appendChild(h("div.boot-error", h("h2", { text: "Não foi possível abrir os arquivos" }), h("p", { text: e.message || String(e) }),
      h("p", { text: "Se você abriu pelo navegador, use o atalho do Tinteiro ou o link de pareamento mostrado no computador." })));
    return;
  }
  const app = new App({ backend, plataforma });
  window.tinteiro = app;
  await app.start(raiz);
  if (plataforma === "pwa" && "serviceWorker" in navigator && (location.protocol === "https:" || /^(127\.0\.0\.1|localhost)$/.test(location.hostname))) navigator.serviceWorker.register("sw.js").catch(() => {});
}
iniciar();
