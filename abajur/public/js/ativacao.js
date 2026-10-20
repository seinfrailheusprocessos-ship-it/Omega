/* Ativação inicial: carga (categorias, arquivos e hashes), pasta Santos do aparelho uma vez, uniões sugeridas,
   pastas fora do catálogo, grupos editáveis e calibração do ímã. */
(function () {
  'use strict';
  var $ = A.$, $$ = A.$$;
  function html() {
    var c = A.carga, ul = A.S.cfg.ultimaLeitura, L = A.limitesIma();
    var h = A.topo('Ativação inicial', A.S.cfg.ativado ? 'Concluída · pode refazer qualquer passo' : 'Faça uma vez, no celular dela', '', true);
    var n = 0;
    // 1 carga
    var tot = c ? c.categorias.reduce(function (s, x) { return s + x.arquivos.length; }, 0) + (c.soltas || []).length : 0;
    h += A.secao(++n, 'Carga inicial do catálogo', '<div class="card">' + (c ?
      '<div class="tot"><span>Fonte</span><span>' + A.esc(c.fonte || 'Santos') + '</span></div><div class="tot"><span>Categorias (subpastas)</span><span>' + c.categorias.length + '</span></div><div class="tot"><span>Fotos</span><span>' + tot + (c.soltas && c.soltas.length ? ' (' + c.soltas.length + ' soltas na raiz)' : '') + '</span></div>' +
      '<div class="tot"><span>Hashes (dHash e pHash)</span><span>' + (c.hashes ? 'sim' : A.X('ainda não')) + '</span></div>' +
      (c.hashes ? '' : '<p class="lead">Sem hashes na carga, o app casa pelo nome e calcula os hashes no próprio celular ao ler a pasta. Para a confirmação dupla, rodar no computador ferramentas/gerar-carga.html e importar o arquivo aqui.</p>')
      : '<p class="lead" style="margin-top:0">Opcional. Sem carga, o app monta o catálogo lendo a pasta Santos do aparelho (passo 2).</p>') + '<div class="btns"><button class="btn" data-impc>' + A.ic('share') + 'Importar carga (.json)</button></div></div>', { aberta: !c || !c.hashes, ct: c ? c.categorias.length : '' });
    // 2 pasta
    h += A.secao(++n, 'Pasta Santos do aparelho', '<div class="card"><p class="lead" style="margin-top:0">Escolha a pasta <b>Santos</b> (Fotos_Camera › Santos). O app pede permissão uma única vez, não copia as fotos: guarda só índice, hashes e miniaturas.</p>' +
      (ul ? A.resumoLeitura(ul) + (ul.faltando && ul.faltando.length ? '<details style="margin-top:6px"><summary class="lead">Ver as ' + ul.faltando.length + ' que não foram achadas</summary><p class="lead">' + A.esc(ul.faltando.slice(0, 200).join(' · ')) + '</p></details>' : '') : '') +
      '<div class="btns"><button class="btn p" data-pasta>' + A.ic('folder') + (A.S.cfg.pastaNome ? 'Ler de novo a pasta ' + A.esc(A.S.cfg.pastaNome) : 'Escolher a pasta Santos') + '</button></div></div>', { aberta: !ul, ct: A.F.length ? A.F.length + ' fotos' : '' });
    // 3 uniões
    var un = A.sugerirUnioes(A.S.itens);
    h += A.secao(++n, 'Pastas parecidas: unir?', un.length ? un.map(function (u) {
      var a = A.item(u.a), b = A.item(u.b);
      return '<div class="card" data-un="' + A.esc(u.id) + '"><div class="row" style="margin-bottom:8px"><b class="grow">' + A.esc(a.nome) + ' + ' + A.esc(b.nome) + '</b><span class="tag">' + ((a.n || 0) + (b.n || 0)) + ' fotos</span></div>' +
        '<div class="chips" style="margin:0"><button class="chip" data-unir="' + u.a + '|' + u.b + '">Unir em ' + A.esc(a.nome) + '</button><button class="chip" data-unir="' + u.b + '|' + u.a + '">Unir em ' + A.esc(b.nome) + '</button><button class="chip" data-manter>Manter separadas</button></div></div>';
    }).join('') : '<div class="empty">Nenhuma sugestão pendente.</div>', { aberta: un.length > 0, ct: un.length });
    // 4 fora
    var fora = A.S.itens.filter(function (e) { return e.fora; });
    h += A.secao(++n, 'Fora do catálogo até confirmar', fora.length ? fora.map(function (e) {
      return '<div class="card row"><span class="grow"><b>' + A.esc(e.nome) + '</b><br><small class="lead">' + (e.n || 0) + ' fotos · não aparece no atendimento nem no ímã</small></span><button class="btn sm" data-incluir="' + A.esc(e.id) + '">Incluir</button></div>';
    }).join('') : '<div class="empty">Tudo incluído.</div>', { ct: fora.length });
    // 5 grupos
    var grupos = A.S.grupos.map(function (g) { return g.nome; });
    h += A.secao(++n, 'Categorias e grupos', '<p class="lead">Grupos sugeridos; mude o grupo de qualquer categoria. Renomear, criar e excluir: Catálogo e + Novo.</p>' + grupos.map(function (g) {
      var l = A.S.itens.filter(function (e) { return e.grupo === g && !e.fora; });
      if (!l.length) return '';
      return '<div class="h4">' + A.esc(g) + ' <span class="sp"></span>' + l.length + '</div>' + l.map(function (e) {
        return '<div class="card row" style="padding:8px 10px"><span class="grow">' + A.esc(e.nome) + (e.novo ? ' <span class="tag ac">nova</span>' : '') + '</span><select class="inp" data-gr="' + A.esc(e.id) + '" style="width:auto;max-width:52%;padding:6px 8px;font-size:13px">' +
          grupos.map(function (x) { return '<option' + (x === e.grupo ? ' selected' : '') + '>' + A.esc(x) + '</option>'; }).join('') + '</select></div>';
      }).join('');
    }).join(''), { ct: A.S.itens.filter(function (e) { return !e.fora; }).length });
    // 6 ímã
    h += A.secao(++n, 'Ímã: limites e calibração', '<div class="card"><p class="lead" style="margin-top:0">Distância de 0 a 64 (média dos dois hashes). Até o 1º limite: casou. Até o 2º: dúvida (revisão). Acima: não casou.</p>' +
      '<div class="g2"><div class="fld"><label class="f">Casou até</label><input class="inp" type="number" data-lim="casa" value="' + L.casa + '" step="0.5"></div><div class="fld"><label class="f">Dúvida até</label><input class="inp" type="number" data-lim="duvida" value="' + L.duvida + '" step="0.5"></div></div>' +
      (A.S.cfg.imaCalibrado ? '' : '<div class="xbox"><b>X</b> Limites padrão; calibrar com as fotos reais depois de ler a pasta.</div>') +
      '<div id="calres"></div><div class="btns"><button class="btn" data-cal>' + A.ic('zap') + 'Calibrar com as fotos reais</button><button class="btn" data-teste>' + A.ic('image') + 'Testar uma imagem</button></div></div>');
    h += '<div class="btns"><button class="btn p" data-fim>' + A.ic('check') + (A.S.cfg.ativado ? 'Ativação concluída' : 'Concluir ativação') + '</button></div>';
    return h;
  }
  function init(v) {
    v.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || b.classList.contains('sh')) return;
      if (b.hasAttribute('data-pasta')) { A.escolherPasta(!!A.S.cfg.pastaNome); return; }
      if (b.hasAttribute('data-impc')) return importar();
      if (b.hasAttribute('data-unir')) { var p = b.getAttribute('data-unir').split('|'); var nm = A.item(p[0]).nome, nb = A.item(p[1]).nome; A.unirItens(p[0], p[1]); A.toast(nb + ' unida a ' + nm); A.render(); return; }
      if (b.hasAttribute('data-manter')) { var id = b.closest('[data-un]').getAttribute('data-un'); A.S.unioes = A.S.unioes || {}; A.S.unioes[id] = 'manter'; A.save(); A.render(); return; }
      if (b.hasAttribute('data-incluir')) {
        var it = A.item(b.getAttribute('data-incluir'));
        A.menu('Incluir ' + it.nome + ' em qual grupo?', A.S.grupos.map(function (g) { return { t: g.nome, ic: 'folder', fn: function () { it.fora = false; it.grupo = g.nome; if (!it.syn.length && it.pastas[0]) it.syn = A.sinonimosAuto(it.pastas[0], g.nome); A.save(); A.render(); } }; }));
        return;
      }
      if (b.hasAttribute('data-cal')) return calibrar(v, b);
      if (b.hasAttribute('data-teste')) return testar();
      if (b.hasAttribute('data-fim')) { A.S.cfg.ativado = true; A.S.itens.forEach(function (x) { delete x.novo; }); A.save(); A.toast('Ativação concluída'); A.ir('inicio'); }
    });
    v.addEventListener('change', function (e) {
      var t = e.target, g = t.getAttribute('data-gr');
      if (g) { var it = A.item(g); it.grupo = t.value; A.save(); A.toast(it.nome + ' em ' + t.value); }
      var l = t.getAttribute('data-lim');
      if (l) { A.S.cfg.ima = A.S.cfg.ima || { casa: 10, duvida: 18 }; A.S.cfg.ima[l] = parseFloat(t.value) || A.S.cfg.ima[l]; A.save(); }
    });
  }
  function importar() {
    var i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json';
    i.addEventListener('change', function () {
      var f = i.files && i.files[0]; if (!f) return;
      f.text().then(function (t) { var r = A.importarCarga(JSON.parse(t)); A.toast('Carga importada' + (A.carga.hashes ? ' com hashes · ' + r.confirmadas + ' confirmadas, ' + r.divergentes + ' divergentes' : '')); A.render(); }).catch(function () { A.toast('Arquivo de carga inválido'); });
    });
    i.click();
  }
  function calibrar(v, b) {
    if (A.catalogoIma().length < 5) { A.toast('Leia a pasta Santos antes de calibrar'); return; }
    b.disabled = true;
    var box = $('#calres', v);
    A.calibrarIma(function (i, n) { box.innerHTML = '<div class="prog"><i style="width:' + (i / n * 100) + '%"></i></div><p class="lead">Testando ' + i + ' de ' + n + ' fotos (WhatsApp, recorte e print do Instagram)…</p>'; }).then(function (r) {
      b.disabled = false;
      box.innerHTML = '<div class="tot"><span>Mesma foto alterada: típica / 95%</span><span>' + A.r2(r.m50) + ' / ' + A.r2(r.m95) + '</span></div><div class="tot"><span>Fotos diferentes: 5% mais parecidas / típica</span><span>' + A.r2(r.o05) + ' / ' + A.r2(r.o50) + '</span></div>' +
        '<div class="tot big"><span>Sugestão: casou até ' + r.sugestao.casa + ', dúvida até ' + r.sugestao.duvida + '</span><span></span></div><button class="btn p full" data-aplicar style="margin-top:8px">Usar a sugestão</button>';
      A.$('[data-aplicar]', box).addEventListener('click', function () { A.S.cfg.ima = r.sugestao; A.S.cfg.imaCalibrado = true; A.save(); A.toast('Limites calibrados'); A.render(); });
    }).catch(function () { b.disabled = false; A.toast('Não foi possível calibrar'); });
  }
  function testar() {
    var i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
    i.addEventListener('change', function () {
      var f = i.files && i.files[0]; if (!f) return;
      A.ima(f).then(function (r) {
        var ROT = { casou: 'Casou', duvida: 'Dúvida', nao: 'Não casou', semcat: 'Catálogo não lido' };
        A.sheet('Teste do ímã: ' + ROT[r.estado], '<div class="g2"><img alt="" src="' + r.mini + '" style="width:100%;border-radius:10px"><div class="lead">Menor distância: ' + (r.cands[0] ? A.r2(r.cands[0].dist) : '—') + '</div></div><div class="pgrid">' +
          r.cands.map(function (c) { var f2 = A.fotoPorId(c.id), e = f2 && A.item(f2.item); return f2 ? '<div class="ph"><img alt="" src="' + A.fotoUrl(f2) + '"><em>' + A.esc((e ? e.nome : '') + ' · ' + A.r2(c.dist)) + '</em></div>' : ''; }).join('') + '</div>');
      });
    });
    i.click();
  }
  A.telas.ativacao = { html: html, init: init, aba: 'mais' };
})();
