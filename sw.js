const V = "omega-v33", A = ["./", "index.html", "estilo.css", "app.js", "dicionario-ptbr.js", "pdf-lib.min.js", "pdf-mesa.js", "icone.svg", "manifest.webmanifest", "dados/relatorio.exemplo.json"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(A).catch(() => {})).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.pathname.includes("/api/") || u.pathname.endsWith("/dados/relatorio.json") || u.pathname.endsWith("/dados/estado.json")) return; // sempre direto da rede
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(V).then(ch => ch.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
