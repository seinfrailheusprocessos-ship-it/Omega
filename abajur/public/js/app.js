/* Abertura do app: carrega dados e logo, liga barra inferior, "+ Novo", tema, seções recolhíveis, compartilhamento e alarmes. */
(function () {
  'use strict';
  var $ = A.$;

  document.addEventListener('click', function (e) {
    var sh = e.target.closest('.sh');
    if (sh && !e.target.closest('[data-catmenu],[data-nc],[data-g]')) { var s = sh.parentElement; var v = !s.classList.contains('open'); s.classList.toggle('open', v); sh.setAttribute('aria-expanded', v); return; }
    if (e.target.closest('[data-tema]')) {
      var nx = A.escuro() ? 'claro' : 'escuro';
      var sist = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
      A.S.cfg.tema = nx === sist ? 'auto' : nx; A.save(); A.aplicarTema(); A.render(); return;
    }
    if (e.target.closest('[data-back]')) { if (history.length > 1) history.back(); else A.ir('inicio'); return; }
    var go = e.target.closest('.tabbar [data-go]'); if (go) { A.ir(go.getAttribute('data-go')); return; }
    if (e.target.closest('#fab')) {
      var pre = {};
      if (A.rota.tela === 'cliente') pre.cliente = A.rota.arg;
      A.novo(null, pre);
    }
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { A.aplicarTema(); A.render(); });

  function lerLogo() {
    return fetch('icons/logo.svg').then(function (r) { return r.text(); }).then(function (t) {
      A.LOGO_SRC = t;
      A.LOGO = t.replace(/<!--[\s\S]*?-->/g, '').replace('<svg ', '<svg width="100%" height="100%" ');
    }).catch(function () { A.LOGO = ''; });
  }

  /* conteúdo compartilhado para o app (WhatsApp › Compartilhar › Abajur) */
  function compartilhado() {
    var u = new URL(location.href), q = u.searchParams;
    var texto = [q.get('titulo'), q.get('texto'), q.get('url')].filter(Boolean).join('\n');
    if (texto) { history.replaceState(null, '', location.pathname + '#atender'); A._pendenteEntrada = function () { A.analisarTexto(texto); }; return 'atender'; }
    if (q.get('compartilhado') && window.caches) {
      history.replaceState(null, '', location.pathname + '#atender');
      A._pendenteEntrada = function () {
        caches.open('abajur-compartilhado').then(function (c) {
          return c.keys().then(function (ks) {
            return Promise.all(ks.map(function (k) { return c.match(k).then(function (r) { return r.blob().then(function (b) { c.delete(k); var nome = decodeURIComponent(k.url.split('/').pop()); return new File([b], nome, { type: b.type }); }); }); }));
          });
        }).then(function (fs) {
          var imgs = fs.filter(function (f) { return /^image\//.test(f.type); });
          if (imgs.length) A.entradaImagens(imgs, 'compartilhada');
          fs.forEach(function (f) {
            if (/^text\//.test(f.type) && !/\.txt$/i.test(f.name)) f.text().then(function (t) { A.analisarTexto(t, true); });
            else if (/^image\//.test(f.type)) return;
            else if (/\.(zip|txt)$/i.test(f.name) || /zip/.test(f.type)) A.importarConversa(f);
            else if (/^audio\//.test(f.type)) A.toast('Transcrição de áudio chega no APK (E2)');
          });
        });
      };
      return 'atender';
    }
    return null;
  }

  function iniciar() {
    Promise.all([A.load(), lerLogo()]).then(function () { return A.carregarFotos(); }).then(function () { return A.carregarCarga(); }).then(function () {
      A.aplicarTema();
      $('#splashLogo').innerHTML = A.LOGO;
      var h = location.hash.replace(/^#/, '').split('/');
      var t = compartilhado() || (A.telas[h[0]] ? h[0] : 'inicio');
      A.rota = { tela: t, arg: h[1] ? decodeURIComponent(h[1]) : null };
      try { history.replaceState({ t: A.rota.tela, a: A.rota.arg }, '', '#' + A.rota.tela + (A.rota.arg ? '/' + encodeURIComponent(A.rota.arg) : '')); } catch (e) {}
      A.render();
      setTimeout(function () { $('#splash').classList.add('out'); }, 650);
      A.verificarAlarmes(); setInterval(A.verificarAlarmes, 30000);
      setTimeout(A.verificarPastaNova, 1500);
    }).catch(function (e) { console.error(e); $('#splash').classList.add('out'); A.toast('Erro ao abrir os dados do aparelho'); });
    if ('serviceWorker' in navigator && location.protocol !== 'file:' && !window.ABAJUR_SEM_SW) navigator.serviceWorker.register('sw.js').catch(function () {});
  }
  iniciar();
})();
