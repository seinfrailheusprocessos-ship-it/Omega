/* Fotos: lê a pasta do aparelho (2 níveis: grupo e santo), guarda só índice e miniaturas; etiquetas por foto. */
(function () {
  'use strict';
  A.F = [];            // índice: {id,item,grupo,pasta,nome,caminho,tags}
  var blobs = {}, urls = {};
  var TONS = [['#6b5a4d', '#2e2926'], ['#5d6a60', '#262b28'], ['#6a5a63', '#2a2428'], ['#68624a', '#2b2920'], ['#4f5f6e', '#22282d']];

  A.carregarFotos = function () {
    return A.fotoAll().then(function (l) {
      A.F = (l || []).map(function (f) { blobs[f.id] = f.thumb; var m = Object.assign({}, f); delete m.thumb; return m; });
    }).catch(function () { A.F = []; });
  };
  function svgExemplo(nome, t) {
    var c = TONS[t % 5];
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 142"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c[0] + '"/><stop offset="1" stop-color="' + c[1] + '"/></linearGradient><linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9c2a8"/><stop offset="1" stop-color="#a9876a"/></linearGradient></defs><rect width="120" height="142" fill="url(#g)"/><circle cx="60" cy="42" r="13" fill="url(#s)"/><path d="M60 57c-17 4-25 23-26 56h52c-1-33-9-52-26-56z" fill="url(#s)"/><rect x="31" y="113" width="58" height="9" rx="3" fill="#8a6b52"/></svg>';
  }
  function exemplos(e) {
    var r = [], base = A.S.itens.indexOf(e);
    for (var i = 0; i < 6; i++) r.push({ id: 'ex:' + e.id + ':' + i, item: e.id, grupo: e.grupo, nome: e.nome + ' ' + (i + 1), exemplo: true, tags: [A.S.etiquetas[(base + i) % A.S.etiquetas.length]], tom: base + i });
    return r;
  }
  A.fotosDo = function (itemId) {
    var r = A.F.filter(function (f) { return f.item === itemId; });
    if (r.length) return r;
    var e = A.item(itemId); return e ? exemplos(e) : [];
  };
  A.fotosDoGrupo = function (g) {
    var r = [];
    A.S.itens.forEach(function (e) { if (e.grupo === g) r = r.concat(A.fotosDo(e.id).slice(0, 3)); });
    return r;
  };
  A.fotoPorId = function (id) {
    if (id.indexOf('ex:') === 0) { var p = id.split(':'); var e = A.item(p[1]); return e ? exemplos(e)[+p[2]] : null; }
    for (var i = 0; i < A.F.length; i++) if (A.F[i].id === id) return A.F[i];
    return null;
  };
  A.fotoUrl = function (f) {
    if (!f) return '';
    if (f.exemplo) return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgExemplo(f.nome, f.tom || 0));
    if (urls[f.id]) return urls[f.id];
    var b = blobs[f.id]; if (!b) return '';
    urls[f.id] = URL.createObjectURL(b); return urls[f.id];
  };
  /* bytes JPEG/PNG para o PDF */
  A.fotoBytes = function (f) {
    if (!f) return Promise.resolve(null);
    if (!f.exemplo && blobs[f.id]) return blobs[f.id].arrayBuffer().then(function (ab) { return { bytes: ab, tipo: 'jpg' }; });
    return new Promise(function (ok) {
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas'); c.width = 360; c.height = 426;
        c.getContext('2d').drawImage(img, 0, 0, 360, 426);
        c.toBlob(function (b) { b.arrayBuffer().then(function (ab) { ok({ bytes: ab, tipo: 'jpg' }); }); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { ok(null); };
      img.src = A.fotoUrl(f);
    });
  };
  A.fotoHTML = function (f, sel, extra) {
    return '<button class="ph' + (sel ? ' sel' : '') + '" data-p="' + A.esc(f.id) + '" aria-pressed="' + (!!sel) + '" aria-label="Foto ' + A.esc(f.nome) + '"' + (extra || '') + '>' +
      '<img loading="lazy" alt="" src="' + A.fotoUrl(f) + '">' + (f.exemplo ? '<span class="ex">EXEMPLO</span>' : '') + '<em>' + A.esc(f.nome) + '</em></button>';
  };

  /* ---------- leitura da pasta ---------- */
  function ehImagem(n) { return /\.(jpe?g|png|webp|heic|heif|gif|bmp)$/i.test(n); }
  function miniatura(file) {
    var MAX = 640;
    var p = window.createImageBitmap ? createImageBitmap(file) : new Promise(function (ok, no) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = no; i.src = URL.createObjectURL(file); });
    return p.then(function (bm) {
      var w = bm.width, h = bm.height, k = Math.min(1, MAX / Math.max(w, h));
      var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
      c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
      if (bm.close) bm.close();
      return new Promise(function (ok) { c.toBlob(function (b) { ok({ blob: b, w: c.width, h: c.height }); }, 'image/jpeg', 0.82); });
    });
  }
  function acharItem(nomePasta, grupo) {
    var n = A.norm(nomePasta).replace(/[^a-z0-9]+/g, ' ').trim();
    var best = null;
    A.S.itens.forEach(function (e) {
      var cands = [e.nome].concat(e.syn).map(function (s) { return A.norm(s).replace(/[^a-z0-9]+/g, ' ').trim(); });
      if (cands.indexOf(n) > -1 || cands.some(function (c) { return c.length >= 5 && A.fz(c, n); })) best = best || e;
    });
    if (best) { best.pasta = grupo + '/' + nomePasta; return best; }
    var novo = { id: n.replace(/ /g, '-') || A.uid(), nome: nomePasta, grupo: grupo, syn: [n], precos: {}, pasta: grupo + '/' + nomePasta };
    while (A.item(novo.id)) novo.id += '-2';
    A.S.itens.push(novo);
    return novo;
  }
  function garantirGrupo(g) {
    if (!A.S.grupos.some(function (x) { return x.nome === g; })) A.S.grupos.push({ nome: g, termos: [] });
  }
  A.indexar = function (lista, nomeRaiz, prog) {
    // lista: [{file, partes:[grupo?, santo?, arquivo]}]
    var antigas = {}; A.F.forEach(function (f) { antigas[f.caminho] = f.tags || []; });
    var novas = [], i = 0;
    return A.fotoClear().then(function () {
      blobs = {}; Object.keys(urls).forEach(function (k) { URL.revokeObjectURL(urls[k]); }); urls = {};
      function prox() {
        if (i >= lista.length) return Promise.resolve();
        var x = lista[i++]; prog(i, lista.length);
        var rel = x.partes, grupo, santo;
        if (rel.length >= 3) { grupo = rel[0]; santo = rel[1]; } else if (rel.length === 2) { grupo = rel[0]; santo = rel[0]; } else { grupo = 'Sem grupo'; santo = nomeRaiz || 'Fotos'; }
        garantirGrupo(grupo);
        var e = acharItem(santo, grupo);
        var cam = rel.join('/');
        return miniatura(x.file).then(function (m) {
          var f = { id: A.uid(), item: e.id, grupo: grupo, pasta: santo, nome: rel[rel.length - 1].replace(/\.[^.]+$/, ''), caminho: cam, tags: antigas[cam] || [], w: m.w, h: m.h };
          novas.push(f); blobs[f.id] = m.blob;
          var g = Object.assign({ thumb: m.blob }, f);
          return A.fotoPut(g);
        }).catch(function () {}).then(prox);
      }
      return prox();
    }).then(function () { A.F = novas; A.S.cfg.pastaNome = nomeRaiz; A.save(); return novas.length; });
  };
  function lerHandle(dir) {
    var lista = [];
    function rec(h, partes, nivel) {
      var it = h.values(), arr = [];
      function passo() {
        return it.next().then(function (r) {
          if (r.done) return Promise.all(arr);
          var e = r.value;
          if (e.kind === 'file' && ehImagem(e.name)) arr.push(e.getFile().then(function (f) { lista.push({ file: f, partes: partes.concat([e.name]) }); }));
          else if (e.kind === 'directory' && nivel < 2) arr.push(rec(e, partes.concat([e.name]), nivel + 1));
          return passo();
        });
      }
      return passo();
    }
    return rec(dir, [], 0).then(function () { return lista; });
  }
  function pedirPorInput() {
    return new Promise(function (ok) {
      var inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.setAttribute('webkitdirectory', ''); inp.setAttribute('directory', '');
      inp.addEventListener('change', function () {
        var fs = Array.prototype.slice.call(inp.files || []), raiz = '';
        var lista = fs.filter(function (f) { return ehImagem(f.name); }).map(function (f) {
          var p = (f.webkitRelativePath || f.name).split('/'); raiz = p[0]; return { file: f, partes: p.slice(1, 4).length ? p.slice(1) : [f.name] };
        }).filter(function (x) { return x.partes.length <= 3; });
        ok({ lista: lista, raiz: raiz });
      });
      inp.click();
    });
  }
  A.escolherPasta = function (atualizar) {
    var p;
    if (window.showDirectoryPicker) {
      p = (atualizar ? A.kvGet('pastaHandle') : Promise.resolve(null)).then(function (h) {
        if (h) return h.requestPermission({ mode: 'read' }).then(function (st) { return st === 'granted' ? h : window.showDirectoryPicker({ mode: 'read' }); });
        return window.showDirectoryPicker({ mode: 'read' });
      }).then(function (h) {
        A.kvSet('pastaHandle', h).catch(function () {});
        return lerHandle(h).then(function (l) { return { lista: l, raiz: h.name }; });
      });
    } else p = pedirPorInput();
    return p.then(function (r) {
      if (!r.lista.length) { A.toast('Nenhuma foto encontrada nessa pasta'); return 0; }
      var o = A.sheet('Lendo a pasta', '<p class="lead">' + r.lista.length + ' fotos em "' + A.esc(r.raiz) + '". Só o índice e as miniaturas ficam no app.</p><div class="prog"><i id="pg"></i></div><p class="lead" id="pgt"></p>');
      return A.indexar(r.lista, r.raiz, function (i, n) {
        var b = A.$('#pg', o.el), t = A.$('#pgt', o.el); if (b) b.style.width = (i / n * 100) + '%'; if (t) t.textContent = i + ' de ' + n;
      }).then(function (n) { o.close(); A.toast(n + ' fotos no catálogo'); A.render(); return n; });
    }).catch(function (e) { if (e && e.name !== 'AbortError') A.toast('Não foi possível ler a pasta'); });
  };

  /* ---------- detalhe e etiquetas ---------- */
  A.abrirFoto = function (id, depois) {
    var f = A.fotoPorId(id); if (!f) return;
    function corpo() {
      return '<div style="border-radius:12px;overflow:hidden;border:1px solid var(--line);margin-bottom:10px"><img alt="" src="' + A.fotoUrl(f) + '" style="width:100%;display:block;max-height:50vh;object-fit:contain;background:var(--bg)"></div>' +
        '<div class="row" style="margin-bottom:6px"><b class="grow">' + A.esc((A.item(f.item) || {}).nome || '') + '</b>' + (f.exemplo ? A.X('foto de exemplo') : '<span class="tag">' + A.esc(f.caminho || '') + '</span>') + '</div>' +
        '<div class="h4">Etiquetas desta foto</div><div class="chips" id="etq">' + A.S.etiquetas.map(function (t) {
          return '<button class="chip" data-t="' + A.esc(t) + '" aria-pressed="' + ((f.tags || []).indexOf(t) > -1) + '">' + A.esc(t) + '</button>';
        }).join('') + '</div>' + (f.exemplo ? '<p class="lead">Nas fotos de exemplo as etiquetas não ficam salvas.</p>' : '');
    }
    var o = A.sheet('Foto', corpo(), { onclose: depois });
    o.sc.addEventListener('click', function (e) {
      var b = e.target.closest('[data-t]'); if (!b) return;
      var t = b.getAttribute('data-t'); f.tags = f.tags || [];
      var i = f.tags.indexOf(t); if (i > -1) f.tags.splice(i, 1); else f.tags.push(t);
      b.setAttribute('aria-pressed', i < 0);
      if (!f.exemplo) A.fotoAll().then(function (l) { var r = l.filter(function (x) { return x.id === f.id; })[0]; if (r) { r.tags = f.tags; A.fotoPut(r); } });
    });
  };

  /* toque longo */
  A.toqueLongo = function (root, sel, fn) {
    var t = null, alvo = null, x0 = 0, y0 = 0;
    root.addEventListener('pointerdown', function (e) {
      var el = e.target.closest(sel); if (!el) return; alvo = el; x0 = e.clientX; y0 = e.clientY;
      t = setTimeout(function () { t = null; alvo._longo = true; if (navigator.vibrate) navigator.vibrate(12); fn(alvo); }, 480);
    });
    root.addEventListener('pointermove', function (e) { if (t && (Math.abs(e.clientX - x0) > 8 || Math.abs(e.clientY - y0) > 8)) { clearTimeout(t); t = null; } });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { root.addEventListener(ev, function () { if (t) { clearTimeout(t); t = null; } }); });
    root.addEventListener('click', function (e) { var el = e.target.closest(sel); if (el && el._longo) { el._longo = false; e.stopPropagation(); e.preventDefault(); } }, true);
  };
})();
