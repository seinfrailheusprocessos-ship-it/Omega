/* Imagens recebidas (WhatsApp, print, Instagram): o ímã compara com o catálogo pelo hash.
   Distância pequena = casou; intermediária = dúvida (revisão); grande = não casou (escolha manual). Também a calibração dos limites. */
(function () {
  'use strict';
  function catalogo() {
    var fora = {}; A.S.itens.forEach(function (e) { if (e.fora) fora[e.id] = 1; });
    return A.F.filter(function (f) { return f.h && !fora[f.item]; });
  }
  A.catalogoIma = catalogo;
  function miniDataUrl(bm) {
    var k = Math.min(1, 220 / Math.max(bm.width, bm.height)), c = document.createElement('canvas');
    c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k);
    c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.7);
  }
  /* uma imagem -> {estado, cands:[{id,dist}], mini} */
  A.ima = function (blob) {
    return A.abrirBitmap(blob).then(function (bm) {
      var q = A.hashConsulta(bm), mini = miniDataUrl(bm);
      if (bm.close) bm.close();
      var cat = catalogo();
      if (!cat.length) return { estado: 'semcat', cands: [], mini: mini };
      var r = A.compararHashes(q, cat).slice(0, 6), L = A.limitesIma(), d = r[0] ? r[0].dist : 99;
      return { estado: d <= L.casa ? 'casou' : d <= L.duvida ? 'duvida' : 'nao', cands: r, mini: mini };
    });
  };

  /* entrada no atendimento */
  A.receberImagens = function (arquivos, origem) {
    var a = A.S.rascunho || A.novoAtendimento();
    a.recebidas = a.recebidas || [];
    var lista = Array.prototype.slice.call(arquivos), feitas = 0, txtPossivel = [];
    function prox() {
      if (!lista.length) return Promise.resolve();
      var f = lista.shift();
      return A.ima(f).then(function (r) {
        var rec = { id: A.uid(), origem: origem || 'imagem', mini: r.mini, estado: r.estado, cands: r.cands, escolhido: null };
        if (r.estado === 'casou') aplicar(rec, r.cands[0].id);
        if (r.estado === 'nao' || r.estado === 'semcat') txtPossivel.push(f);
        a.recebidas.unshift(rec); feitas++;
      }).catch(function () {}).then(prox);
    }
    return prox().then(function () {
      A.save();
      if (A.atualizarAtender) A.atualizarAtender();
      var c = a.recebidas.slice(0, feitas), ok = c.filter(function (x) { return x.estado === 'casou'; }).length, dv = c.filter(function (x) { return x.estado === 'duvida'; }).length;
      A.toast('Ímã: ' + ok + ' casou' + (dv ? ', ' + dv + ' em dúvida' : '') + (c.length - ok - dv ? ', ' + (c.length - ok - dv) + ' sem par' : ''));
      return txtPossivel;
    });
  };
  function aplicar(rec, fotoId) {
    var a = A.S.rascunho, f = A.fotoPorId(fotoId); if (!f) return;
    rec.escolhido = fotoId; rec.item = f.item;
    a.sel[fotoId] = 1;
    if (a.extras.indexOf(f.item) < 0 && !a.res.hits.some(function (h) { return h.k === f.item; })) a.extras.push(f.item);
    a.tab = 'k:' + f.item;
  }
  A.recebidasHTML = function () {
    var a = A.S.rascunho; if (!a || !a.recebidas || !a.recebidas.length) return '';
    var ROT = { casou: ['ok', 'casou'], duvida: ['wa', 'dúvida'], nao: ['rd', 'sem par'], semcat: ['rd', 'catálogo não lido'], manual: ['ac', 'escolhida'], descartada: ['', 'descartada'] };
    return '<div class="h4" style="margin-top:12px">Imagens recebidas <span class="sp"></span><button data-rec-limpar>Limpar</button></div>' + a.recebidas.map(function (r) {
      var f = r.escolhido && A.fotoPorId(r.escolhido), e = f && A.item(f.item), d = r.cands[0] ? r.cands[0].dist : null, rot = ROT[r.estado] || ['', r.estado];
      return '<button class="ev" data-rec="' + r.id + '"><img alt="" src="' + r.mini + '" style="width:44px;height:52px;object-fit:cover;border-radius:7px">' +
        (f ? '<img alt="" src="' + A.fotoUrl(f) + '" style="width:44px;height:52px;object-fit:cover;border-radius:7px">' : '') +
        '<span class="grow"><b>' + (e ? A.esc(e.nome) : r.estado === 'semcat' ? 'Ative a pasta Santos' : 'Escolher manualmente') + '</b><br><small class="lead">' + A.esc(r.origem) + (d != null ? ' · distância ' + A.r2(d) : '') + '</small></span>' +
        '<span class="tag ' + rot[0] + '">' + rot[1] + '</span></button>';
    }).join('');
  };
  A.revisarRecebida = function (id, depois) {
    var a = A.S.rascunho, r = (a.recebidas || []).filter(function (x) { return x.id === id; })[0]; if (!r) return;
    var h = '<div class="g2"><div><label class="f">Recebida</label><img alt="" src="' + r.mini + '" style="width:100%;border-radius:10px;border:1px solid var(--line)"></div><div class="lead" style="margin:18px 0 0">O ímã só compara identidade com as fotos do catálogo; não interpreta a imagem.<br><br>Limites: casou até ' + A.limitesIma().casa + ', dúvida até ' + A.limitesIma().duvida + '.</div></div>' +
      '<div class="h4">Candidatas do catálogo (toque na certa)</div><div class="pgrid">' + r.cands.map(function (c) {
        var f = A.fotoPorId(c.id); if (!f) return ''; var e = A.item(f.item);
        return '<button class="ph' + (r.escolhido === c.id ? ' sel' : '') + '" data-c="' + c.id + '"><img alt="" src="' + A.fotoUrl(f) + '"><em>' + A.esc((e ? e.nome : '') + ' · ' + A.r2(c.dist)) + '</em></button>';
      }).join('') + '</div>' + (r.cands.length ? '' : '<div class="empty">Sem candidatas: o catálogo ainda não foi lido (Mais › Ativação inicial).</div>') +
      '<div class="btns"><button class="btn" data-cat>' + A.ic('folder') + 'Escolher categoria</button><button class="btn d" data-desc>Descartar</button></div>';
    var o = A.sheet('Revisar imagem', h, { onclose: depois });
    o.sc.addEventListener('click', function (e) {
      var b = e.target.closest('[data-c]');
      if (b) { if (r.escolhido) delete a.sel[r.escolhido]; aplicar(r, b.getAttribute('data-c')); r.estado = r.estado === 'casou' ? 'casou' : 'manual'; A.save(); o.close(); return; }
      if (e.target.closest('[data-cat]')) { o.close(); setTimeout(function () { A.escolherItem(function (k) { r.estado = 'manual'; r.item = k; if (a.extras.indexOf(k) < 0) a.extras.push(k); a.tab = 'k:' + k; A.save(); if (A.atualizarAtender) A.atualizarAtender(); }); }, 380); return; }
      if (e.target.closest('[data-desc]')) { if (r.escolhido) delete a.sel[r.escolhido]; r.escolhido = null; r.estado = 'descartada'; A.save(); o.close(); }
    });
  };

  /* calibração com as fotos reais: mesma foto alterada (WhatsApp, recorte, print) × fotos diferentes */
  function alterar(bm, tipo) {
    var c = document.createElement('canvas'), g = c.getContext('2d'), W = bm.width, H = bm.height;
    if (tipo === 'whats') { c.width = Math.round(W * 0.5); c.height = Math.round(H * 0.5); g.drawImage(bm, 0, 0, c.width, c.height); return carregarDe(c.toDataURL('image/jpeg', 0.45)); }
    if (tipo === 'recorte') { var m = 0.07; c.width = Math.round(W * (1 - 2 * m)); c.height = Math.round(H * (1 - 2 * m)); g.drawImage(bm, W * m, H * m, c.width, c.height, 0, 0, c.width, c.height); return carregarDe(c.toDataURL('image/jpeg', 0.8)); }
    // print do Instagram: tela alta com barras e a foto cortada em quadrado no meio
    var q = Math.min(W, H); c.width = 400; c.height = 860; g.fillStyle = '#ffffff'; g.fillRect(0, 0, 400, 860); g.fillStyle = '#222'; g.fillRect(0, 0, 400, 70); g.fillRect(0, 790, 400, 70);
    g.drawImage(bm, (W - q) / 2, (H - q) / 2, q, q, 0, 200, 400, 400);
    return carregarDe(c.toDataURL('image/jpeg', 0.8));
  }
  function carregarDe(url) { return fetch(url).then(function (r) { return r.blob(); }).then(A.abrirBitmap); }
  function pct(arr, p) { if (!arr.length) return null; var s = arr.slice().sort(function (a, b) { return a - b; }); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]; }
  A.calibrarIma = function (prog) {
    var cat = catalogo(); if (cat.length < 5) return Promise.reject(new Error('poucas'));
    var amostra = cat.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 60), mesma = [], outras = [], i = 0;
    function prox() {
      if (i >= amostra.length) return Promise.resolve();
      var f = amostra[i++]; prog(i, amostra.length);
      return fetch(A.fotoUrl(f)).then(function (r) { return r.blob(); }).then(A.abrirBitmap).then(function (bm) {
        return Promise.all(['whats', 'recorte', 'print'].map(function (t) { return alterar(bm, t); })).then(function (bms) {
          bms.forEach(function (b) {
            var r = A.compararHashes(A.hashConsulta(b), cat);
            var proprio = r.filter(function (x) { return x.id === f.id; })[0], outro = r.filter(function (x) { return x.id !== f.id; })[0];
            if (proprio) mesma.push(proprio.dist); if (outro) outras.push(outro.dist);
          });
        });
      }).catch(function () {}).then(prox);
    }
    return prox().then(function () {
      var m95 = pct(mesma, 0.95), o05 = pct(outras, 0.05);
      var casa = Math.max(4, Math.min(Math.ceil(m95 + 1), Math.floor(o05 - 3))), duvida = Math.max(casa + 2, Math.floor(o05 - 1));
      return { mesma: mesma, outras: outras, m50: pct(mesma, 0.5), m95: m95, o05: o05, o50: pct(outras, 0.5), sugestao: { casa: casa, duvida: duvida } };
    });
  };
})();
