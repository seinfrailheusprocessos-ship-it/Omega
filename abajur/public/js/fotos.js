/* Fotos: lê a pasta Santos do aparelho (subpasta = categoria), guarda só índice, hashes e miniaturas; etiquetas por foto. */
(function () {
  'use strict';
  A.F = [];            // índice: {id,item,grupo,pasta,nome,caminho,tags}
  var blobs = {}, urls = {};
  var TONS = [['#6b5a4d', '#2e2926'], ['#5d6a60', '#262b28'], ['#6a5a63', '#2a2428'], ['#68624a', '#2b2920'], ['#4f5f6e', '#22282d']];

  A.carregarFotos = function () {
    return A.fotoAll().then(function (l) {
      A.F = (l || []).map(function (f) { blobs[f.id] = f.thumb; var m = Object.assign({}, f); delete m.thumb; if (m.h && typeof m.h !== 'object') { m.h0 = m.h; delete m.h; } return m; });
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
    A.S.itens.forEach(function (e) { if (e.grupo === g && !e.fora) r = r.concat(A.fotosDo(e.id).slice(0, 3)); });
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

  /* ---------- leitura da pasta Santos: subpasta = categoria; casa pelo nome da carga e confirma pelo hash ---------- */
  function ehImagem(n) { return /\.(jpe?g|png|webp|heic|heif|gif|bmp)$/i.test(n); }
  function miniatura(bm) {
    var MAX = 640, w = bm.width, h = bm.height, k = Math.min(1, MAX / Math.max(w, h));
    var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
    c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
    return new Promise(function (ok) { c.toBlob(function (b) { ok({ blob: b, w: c.width, h: c.height }); }, 'image/jpeg', 0.82); });
  }
  A.porPasta = function (pasta) {
    var k = A.norm(pasta);
    for (var i = 0; i < A.S.itens.length; i++) { var e = A.S.itens[i]; if ((e.pastas || []).some(function (p) { return A.norm(p) === k; })) return e; }
    return null;
  };
  A.limitesIma = function () { return A.S.cfg.ima || { casa: 10, duvida: 18 }; };
  A.indexar = function (lista, nomeRaiz, prog, completo) {
    var exist = {}; A.F.forEach(function (f) { exist[f.caminho] = f; });
    var vistos = {}, novas = 0, i = 0, res = { total: lista.length, novas: 0, confirmadas: 0, divergentes: 0, soNome: 0, foraCarga: 0, categoriasNovas: [] };
    var casa = A.limitesIma().casa;
    function prox() {
      if (i >= lista.length) return Promise.resolve();
      var x = lista[i++]; prog(i, lista.length);
      var partes = x.partes, cam = partes.join('/'), pasta = partes.length >= 2 ? partes[0] : '', nome = partes[partes.length - 1];
      vistos[cam] = 1;
      var ja = exist[cam];
      if (ja && ja.tam === x.file.size && ja.mod === x.file.lastModified && ja.h) return prox();
      var e = A.porPasta(pasta);
      if (!e) { e = A.novaCategoria(pasta, 0); e.novo = true; A.S.itens.push(e); A.garantirGrupo(e.grupo); res.categoriasNovas.push(e.nome); }
      return A.abrirBitmap(x.file).then(function (bm) {
        var hs = A.hashCatalogo(bm);
        return miniatura(bm).then(function (m) {
          if (bm.close) bm.close();
          var c = A.naCarga(pasta, nome), st = 'nova';
          if (c) st = c.h && c.h.f ? (A.distHash(c.h.f, hs.f) <= casa ? 'confirmada' : 'divergente') : 'nome';
          res[{ nova: 'foraCarga', confirmada: 'confirmadas', divergente: 'divergentes', nome: 'soNome' }[st]]++;
          var f = { id: ja ? ja.id : A.uid(), item: e.id, pasta: pasta, nome: nome.replace(/\.[^.]+$/, ''), arquivo: nome, caminho: cam, tags: ja ? ja.tags || [] : [], w: m.w, h0: m.h, tam: x.file.size, mod: x.file.lastModified, h: hs, st: st };
          if (ja) A.F.splice(A.F.indexOf(ja), 1);
          A.F.push(f); blobs[f.id] = m.blob; if (urls[f.id]) { URL.revokeObjectURL(urls[f.id]); delete urls[f.id]; }
          novas++;
          return A.fotoPut(Object.assign({ thumb: m.blob }, f));
        });
      }).catch(function (er) { res.erros = (res.erros || 0) + 1; console.error('indexar', cam, er && er.message); }).then(prox);
    }
    return prox().then(function () {
      if (completo) A.F.slice().forEach(function (f) { if (!vistos[f.caminho]) { A.F.splice(A.F.indexOf(f), 1); A.fotoDel(f.id); } });
      A.S.itens.forEach(function (e) { e.n = A.F.filter(function (f) { return f.item === e.id; }).length || e.n || 0; });
      res.novas = novas;
      res.faltando = [];
      if (A.carga && completo) {
        A.carga.categorias.forEach(function (c) { c.arquivos.forEach(function (a) { if (!vistos[c.pasta + '/' + a.nome]) res.faltando.push(c.pasta + '/' + a.nome); }); });
        (A.carga.soltas || []).forEach(function (a) { if (!vistos[a.nome]) res.faltando.push(a.nome); });
      }
      if (nomeRaiz) A.S.cfg.pastaNome = nomeRaiz;
      A.S.cfg.ultimaLeitura = res; A.save();
      return res;
    });
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
          else if (e.kind === 'directory' && nivel < 3) arr.push(rec(e, partes.concat([e.name]), nivel + 1));
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
        var raiz = '';
        var lista = Array.prototype.slice.call(inp.files || []).filter(function (f) { return ehImagem(f.name); }).map(function (f) {
          var p = (f.webkitRelativePath || f.name).split('/'); raiz = p.length > 1 ? p[0] : ''; return { file: f, partes: p.length > 1 ? p.slice(1) : [f.name] };
        });
        ok({ lista: lista, raiz: raiz });
      });
      inp.click();
    });
  }
  function resumo(r) {
    return '<div class="tot"><span>Fotos lidas</span><span>' + r.total + '</span></div><div class="tot"><span>Novas ou atualizadas</span><span>' + r.novas + '</span></div>' +
      '<div class="tot"><span>Confirmadas pelo hash</span><span>' + r.confirmadas + '</span></div><div class="tot"><span>Casadas só pelo nome (carga sem hash)</span><span>' + r.soNome + '</span></div>' +
      '<div class="tot"><span>Nome igual, imagem diferente</span><span>' + r.divergentes + '</span></div><div class="tot"><span>Fora da carga (novas)</span><span>' + r.foraCarga + '</span></div>' +
      (r.faltando && r.faltando.length ? '<div class="tot"><span>Da carga e não achadas no aparelho</span><span>' + r.faltando.length + '</span></div>' : '') +
      (r.categoriasNovas.length ? '<p class="lead">Categorias novas: ' + A.esc(r.categoriasNovas.join(', ')) + '</p>' : '');
  }
  A.resumoLeitura = resumo;
  A.escolherPasta = function (atualizar) {
    var p;
    if (window.showDirectoryPicker) {
      p = (atualizar ? A.kvGet('pastaHandle') : Promise.resolve(null)).then(function (h) {
        if (h) return h.requestPermission({ mode: 'read' }).then(function (st) { return st === 'granted' ? h : window.showDirectoryPicker({ mode: 'read', id: 'santos' }); });
        return window.showDirectoryPicker({ mode: 'read', id: 'santos' });
      }).then(function (h) {
        A.kvSet('pastaHandle', h).catch(function () {});
        return lerHandle(h).then(function (l) { return { lista: l, raiz: h.name }; });
      });
    } else p = pedirPorInput();
    return p.then(function (r) {
      if (!r.lista.length) { A.toast('Nenhuma foto encontrada nessa pasta'); return null; }
      var o = A.sheet('Lendo a pasta ' + (r.raiz || ''), '<p class="lead">' + r.lista.length + ' fotos. Só o índice, os hashes e as miniaturas ficam no app; as fotos continuam na pasta.</p><div class="prog"><i id="pg"></i></div><p class="lead" id="pgt"></p><div id="pres"></div>');
      return A.indexar(r.lista, r.raiz, function (i, n) {
        var b = A.$('#pg', o.el), t = A.$('#pgt', o.el); if (b) b.style.width = (i / n * 100) + '%'; if (t) t.textContent = i + ' de ' + n;
      }, true).then(function (res) {
        var d = A.$('#pres', o.el); if (d) d.innerHTML = '<div class="card">' + resumo(res) + '</div><button class="btn p full" data-x>Concluir</button>';
        var bx = A.$('#pres [data-x]', o.el); if (bx) bx.addEventListener('click', o.close);
        A.render(); return res;
      });
    }).catch(function (e) { if (e && e.name !== 'AbortError') A.toast('Não foi possível ler a pasta'); return null; });
  };
  /* ao abrir o app: se a permissão da pasta continua valendo, indexa sozinho as fotos novas */
  A.verificarPastaNova = function () {
    if (!window.showDirectoryPicker || !A.S.cfg.ativado) return Promise.resolve();
    return A.kvGet('pastaHandle').then(function (h) {
      if (!h || !h.queryPermission) return;
      return h.queryPermission({ mode: 'read' }).then(function (st) {
        if (st !== 'granted') return;
        return lerHandle(h).then(function (l) {
          var ex = {}; A.F.forEach(function (f) { ex[f.caminho] = f; });
          var novas = l.filter(function (x) { var f = ex[x.partes.join('/')]; return !f || f.tam !== x.file.size || f.mod !== x.file.lastModified; });
          if (!novas.length) return;
          return A.indexar(novas, h.name, function () {}, false).then(function (r) { A.toast(r.novas + ' foto(s) nova(s) no catálogo' + (r.categoriasNovas.length ? ' e ' + r.categoriasNovas.length + ' categoria(s) nova(s)' : '')); if (A.rota.tela === 'catalogo' || A.rota.tela === 'inicio') A.render(); });
        });
      });
    }).catch(function () {});
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
