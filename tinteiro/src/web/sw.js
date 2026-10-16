// Service worker: guarda a interface para funcionar sem internet (PWA no iPhone/Android).
const VERSAO = "__VERSAO__";
const ARQUIVOS = __ARQUIVOS__;
const CACHE = "tinteiro-" + VERSAO;
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(["./", ...ARQUIVOS.filter(a => !a.startsWith("vendor/pdfjs/cmaps/"))])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("tinteiro-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.includes("/api/") || u.pathname.includes("/raw/")) return;
  // interface: cache primeiro, atualiza em segundo plano
  e.respondWith(caches.open(CACHE).then(async c => {
    const r = await c.match(e.request, { ignoreSearch: true });
    const rede = fetch(e.request).then(resp => { if (resp.ok && u.pathname.includes("/vendor/pdfjs/cmaps/")) c.put(e.request, resp.clone()); return resp; }).catch(() => null);
    if (r) return r;
    const resp = await rede;
    return resp || (await c.match("./")) || Response.error();
  }));
});
