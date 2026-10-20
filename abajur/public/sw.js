/* Abajur: funciona sem internet (casca do app em cache) e recebe o que for compartilhado pelo WhatsApp. */
var VERSAO = 'abajur-e1-2';
var CASCA = ['./', 'index.html', 'manifest.webmanifest', 'css/app.css', 'fonts/figtree.woff2', 'icons/logo.svg', 'icons/icone-192.png', 'icons/icone-96.png',
  'js/nucleo.js', 'js/carga.js', 'js/dados.js', 'js/ima.js', 'js/receber.js', 'js/ativacao.js', 'dados/carga-santos.json', 'js/deteccao.js', 'js/fotos.js', 'js/zip.js', 'js/inicio.js', 'js/cadastro.js', 'js/atender.js', 'js/pdf.js',
  'js/clientes.js', 'js/agenda.js', 'js/mais.js', 'js/app.js', 'vendor/pdf-lib.min.js'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(VERSAO).then(function (c) { return c.addAll(CASCA); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== VERSAO && k !== 'abajur-ocr' && k !== 'abajur-compartilhado'; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method === 'POST' && u.pathname.endsWith('/compartilhar')) { e.respondWith(receber(e.request)); return; }
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.indexOf('/vendor/ocr/') > -1) {
    e.respondWith(caches.open('abajur-ocr').then(function (c) { return c.match(e.request).then(function (r) { return r || fetch(e.request).then(function (n) { if (n.ok) c.put(e.request, n.clone()); return n; }); }); }));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (r) {
    var rede = fetch(e.request).then(function (n) { if (n.ok) caches.open(VERSAO).then(function (c) { c.put(e.request, n.clone()); }); return n; }).catch(function () { return r || caches.match('index.html'); });
    return r || rede;
  }));
});
function receber(req) {
  return req.formData().then(function (fd) {
    var base = new URL('./', self.registration.scope).href;
    var fs = fd.getAll('arquivos').filter(function (f) { return f && f.size; });
    var txt = [fd.get('titulo'), fd.get('texto'), fd.get('url')].filter(Boolean).join('\n');
    if (!fs.length) return Response.redirect(base + '?texto=' + encodeURIComponent(txt) + '#atender', 303);
    return caches.open('abajur-compartilhado').then(function (c) {
      var ps = fs.map(function (f, i) { return c.put(new Request(base + 'compartilhado/' + Date.now() + '-' + i + '/' + encodeURIComponent(f.name || 'arquivo')), new Response(f, { headers: { 'Content-Type': f.type || 'application/octet-stream' } })); });
      if (txt) ps.push(c.put(new Request(base + 'compartilhado/' + Date.now() + '-t/texto'), new Response(new Blob([txt], { type: 'text/plain' }))));
      return Promise.all(ps);
    }).then(function () { return Response.redirect(base + '?compartilhado=1#atender', 303); });
  });
}
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(function (l) { if (l.length) return l[0].focus(); return self.clients.openWindow('./#agenda'); }));
});
