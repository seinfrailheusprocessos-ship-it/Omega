/* Início: categorias numeradas e recolhíveis com caixinhas; arrastar para reordenar e mover entre categorias; deslizar abre ações configuráveis. */
(function () {
  'use strict';
  var $ = A.$, $$ = A.$$;
  A.TIPOS = { demanda: ['task', 'Demanda'], lembrete: ['bell', 'Lembrete'], nota: ['note', 'Nota'], cliente: ['users', 'Cliente'], orcamento: ['doc', 'Orçamento'], evento: ['cal', 'Evento'] };
  A.ACOES = {
    fixar: { t: 'Fixar', ic: 'pin', cor: '#7c5cf0' }, estrela: { t: 'Estrela', ic: 'star', cor: '#b97a14' }, arquivar: { t: 'Arquivar', ic: 'arch', cor: '#6a6872' },
    alarme: { t: 'Alarme', ic: 'bell', cor: '#3f7de0' }, excluir: { t: 'Excluir', ic: 'trash', cor: '#d44a4a' }, concluir: { t: 'Feito', ic: 'check', cor: '#2f9a63' },
    mover: { t: 'Mover', ic: 'move', cor: '#55706a' }, editar: { t: 'Editar', ic: 'edit', cor: '#5a5a66' }
  };
  A.cx = function (id) { for (var i = 0; i < A.S.cx.length; i++) if (A.S.cx[i].id === id) return A.S.cx[i]; return null; };
  A.cat = function (id) { for (var i = 0; i < A.S.categorias.length; i++) if (A.S.categorias[i].id === id) return A.S.categorias[i]; return null; };

  function sub(x) {
    var p = [];
    if (x.quando) p.push(A.quando(x.quando));
    if (x.para) p.push('para ' + x.para);
    if (x.area) p.push(x.area);
    if (x.notaCat && x.tipo === 'nota') p.push(x.notaCat);
    var c = x.cliente && A.cliente(x.cliente); if (c) p.push(c.nome);
    if (x.tipo === 'cliente') { var cc = A.cliente(x.ref); if (cc) p.push(cc.codigo + ' · ' + A.telBR(cc.tel)); }
    if (x.tipo === 'orcamento') { var o = A.S.orcamentos.filter(function (q) { return q.id === x.ref; })[0]; if (o) p.push(A.brl(o.total) + ' · ' + o.status); }
    if (x.texto && !p.length) p.push(x.texto.slice(0, 80));
    return p.join(' · ') || A.TIPOS[x.tipo][1];
  }
  A.cxHTML = function (x, num) {
    var g = A.S.cfg.gestos, T = A.TIPOS[x.tipo] || ['note', ''];
    function bts(l) { return l.map(function (k) { var a = A.ACOES[k]; if (!a) return ''; var on = (k === 'fixar' && x.fixado) || (k === 'estrela' && x.estrela) || (k === 'concluir' && x.feito); return '<button data-ac="' + k + '" style="background:' + a.cor + '">' + A.ic(a.ic) + (on ? 'Desfazer' : a.t) + '</button>'; }).join(''); }
    var atrasado = x.quando && !x.feito && x.quando.slice(0, 10) < A.hoje();
    return '<div class="cx' + (x.feito ? ' done' : '') + '" data-cx="' + x.id + '"><div class="acts"><div>' + bts(g.dir) + '</div><div>' + bts(g.esq.slice().reverse()) + '</div></div>' +
      '<div class="face"><span class="num">' + num + '</span><span class="ico">' + A.ic(T[0]) + '</span><span class="tx"><span class="tt" style="display:block">' + A.esc(x.titulo) + '</span><span class="sub" style="display:block' + (atrasado ? ';color:var(--red)' : '') + '">' + A.esc(sub(x)) + '</span></span>' +
      '<span class="flags">' + (x.fixado ? A.ic('pin') : '') + (x.estrela ? A.ic('star') : '') + (x.alarme ? A.ic('bell') : '') + '</span></div></div>';
  };
  function lista(catId) {
    var l = A.S.cx.filter(function (x) { return x.cat === catId && !x.arquivado; });
    return l.filter(function (x) { return x.fixado; }).concat(l.filter(function (x) { return !x.fixado; }));
  }

  function html() {
    var ab = A.S.cfg.abertas || {};
    var hoje = A.S.cx.filter(function (x) { return !x.arquivado && !x.feito && x.quando && x.quando.slice(0, 10) <= A.hoje() && (x.tipo === 'lembrete' || x.tipo === 'demanda'); }).length;
    var h = A.topo('Início', hoje ? hoje + ' para hoje ou atrasado' + (hoje > 1 ? 's' : '') : 'Tudo em dia', '<button class="ib" data-all aria-label="Recolher ou expandir tudo">' + A.ic('all') + '</button>');
    if (!A.S.cfg.ativado) h += '<button class="card row" data-ativ style="width:100%;text-align:left;border-color:var(--accent)"><span class="ico" style="width:34px;height:34px;border-radius:10px;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center">' + A.ic('folder') + '</span><span class="grow"><b>Ativação inicial</b><br><small class="lead">' + (A.F.length ? A.F.length + ' fotos lidas · revisar e concluir' : 'carregar o catálogo e ler a pasta Santos uma vez') + '</small></span>' + A.ic('chev') + '</button>';
    if (A.S.clientes.some(function (c) { return c.exemplo; })) h += '<div class="xbox"><b>X</b> Dados de exemplo (clientes, preços, textos e fotos) até chegarem os reais. Apague em Mais › Dados.</div>';
    A.S.categorias.forEach(function (k, i) {
      var l = lista(k.id);
      var corpo = '<div class="items" data-cat="' + k.id + '">' + (l.length ? l.map(function (x, j) { return A.cxHTML(x, (i + 1) + '.' + (j + 1)); }).join('') : '<div class="empty" data-vazio>Arraste caixinhas para cá ou use + Novo.</div>') + '</div>';
      h += A.secao(i + 1, k.nome, corpo, { aberta: ab[k.id] !== false, cor: k.cor, ct: l.length, attr: ' data-sec="' + k.id + '"', more: '<span class="more" role="button" tabindex="0" data-catmenu="' + k.id + '" aria-label="Opções da categoria">' + A.ic('dots') + '</span>' });
    });
    var arq = A.S.cx.filter(function (x) { return x.arquivado; }).length;
    var solt = A.S.cx.filter(function (x) { return !x.arquivado && !x.cat; }).length;
    h += '<div class="row" style="margin-top:14px;gap:6px;flex-wrap:wrap">' + (arq ? '<button class="chip" data-arq>' + A.ic('arch') + 'Arquivados (' + arq + ')</button>' : '') +
      (solt ? '<button class="chip" data-soltas>' + A.ic('note') + 'Fora do Início (' + solt + ')</button>' : '') + '<button class="chip" data-novacat>' + A.ic('plus') + 'Categoria</button></div>';
    h += '<p class="lead" style="margin-top:14px">Toque longo e arraste para reordenar ou levar a outra categoria. Deslize para a direita ou para a esquerda para ver as ações.</p>';
    return h;
  }

  function init(v) {
    v.addEventListener('click', function (e) {
      var m = e.target.closest('[data-catmenu]'); if (m) { e.stopPropagation(); menuCat(m.getAttribute('data-catmenu')); return; }
      if (e.target.closest('[data-all]')) { var algum = $$('.sec:not(.open)', v).length > 0; A.abrirSecoes(v, algum); A.S.cfg.abertas = {}; A.S.categorias.forEach(function (k) { A.S.cfg.abertas[k.id] = algum; }); A.save(); return; }
      if (e.target.closest('[data-arq]')) return listaSheet('Arquivados', function (x) { return x.arquivado; });
      if (e.target.closest('[data-soltas]')) return listaSheet('Fora do Início', function (x) { return !x.arquivado && !x.cat; });
      if (e.target.closest('[data-novacat]')) return A.novo('categoria');
      if (e.target.closest('[data-ativ]')) return A.ir('ativacao');
    }, true);
    v.addEventListener('click', function (e) {
      var sh = e.target.closest('.sh'); if (!sh) return;
      var s = sh.parentElement, id = s.getAttribute('data-sec'); if (!id) return;
      A.S.cfg.abertas = A.S.cfg.abertas || {}; A.S.cfg.abertas[id] = s.classList.contains('open'); A.save();
    });
    gestos(v);
  }
  function listaSheet(t, filtro) {
    var l = A.S.cx.filter(filtro);
    var o = A.sheet(t, l.length ? '<div class="items">' + l.map(function (x, i) { return A.cxHTML(x, String(i + 1)); }).join('') + '</div>' : '<div class="empty">Nada aqui.</div>', { onclose: function () { A.render(); } });
    gestos(o.sc, true);
  }
  function menuCat(id) {
    var k = A.cat(id), i = A.S.categorias.indexOf(k);
    A.menu(k.nome, [
      { t: 'Renomear', ic: 'edit', fn: function () { A.pedirTexto('Nome da categoria', k.nome, function (n) { k.nome = n; A.save(); A.render(); }); } },
      { t: 'Cor', ic: 'tag', fn: function () { escolherCor(function (c) { k.cor = c; A.save(); A.render(); }); } },
      { t: 'Subir', ic: 'up', fn: function () { if (i > 0) { A.S.categorias.splice(i, 1); A.S.categorias.splice(i - 1, 0, k); A.save(); A.render(); } } },
      { t: 'Descer', ic: 'down', fn: function () { if (i < A.S.categorias.length - 1) { A.S.categorias.splice(i, 1); A.S.categorias.splice(i + 1, 0, k); A.save(); A.render(); } } },
      { t: 'Nova caixinha aqui', ic: 'plus', fn: function () { A.novo(null, { cat: id }); } },
      { t: 'Excluir categoria', s: 'as caixinhas saem do Início, nada é apagado', ic: 'trash', d: 1, fn: function () {
        A.confirmar('Excluir "' + k.nome + '"?', function () { A.S.cx.forEach(function (x) { if (x.cat === id) x.cat = null; }); A.S.categorias.splice(A.S.categorias.indexOf(k), 1); A.save(); A.render(); }, 'Excluir');
      } }
    ]);
  }
  var CORES = ['#7c5cf0', '#3f7de0', '#2f9a63', '#b97a14', '#d44a4a', '#c0568f', '#55706a', '#6a6872'];
  function escolherCor(fn) {
    var o = A.sheet('Cor', '<div class="chips">' + CORES.map(function (c) { return '<button class="chip" data-cor="' + c + '"><span class="sw" style="background:' + c + ';width:16px;height:16px"></span></button>'; }).join('') + '</div>');
    o.sc.addEventListener('click', function (e) { var b = e.target.closest('[data-cor]'); if (b) { o.close(); fn(b.getAttribute('data-cor')); } });
  }
  A.CORES = CORES; A.escolherCor = escolherCor;

  /* ---------- ações ---------- */
  A.acao = function (k, id, depois) {
    var x = A.cx(id); if (!x) return;
    var fim = function () { A.save(); (depois || A.render)(); };
    if (k === 'fixar') { x.fixado = !x.fixado; A.toast(x.fixado ? 'Fixado no topo' : 'Desafixado'); fim(); }
    else if (k === 'estrela') { x.estrela = !x.estrela; fim(); }
    else if (k === 'arquivar') { x.arquivado = !x.arquivado; A.toast(x.arquivado ? 'Arquivado' : 'Desarquivado'); fim(); }
    else if (k === 'concluir') { x.feito = !x.feito; fim(); }
    else if (k === 'excluir') A.confirmar('Excluir "' + x.titulo + '"?', function () { A.S.cx.splice(A.S.cx.indexOf(x), 1); fim(); }, 'Excluir');
    else if (k === 'mover') {
      A.menu('Mover para', A.S.categorias.map(function (c) { return { t: c.nome, ic: 'folder', fn: function () { x.cat = c.id; fim(); } }; }).concat([{ t: 'Tirar do Início', ic: 'x', fn: function () { x.cat = null; fim(); } }]));
    }
    else if (k === 'alarme') {
      var q = x.quando || A.hoje() + 'T09:00';
      var o = A.sheet('Alarme', '<div class="g2"><div class="fld"><label class="f">Dia</label><input class="inp" type="date" id="ad" value="' + q.slice(0, 10) + '"></div><div class="fld"><label class="f">Hora</label><input class="inp" type="time" id="ah" value="' + (q.slice(11, 16) || '09:00') + '"></div></div>' +
        '<div class="btns"><button class="btn p" id="aok">Salvar alarme</button>' + (x.alarme ? '<button class="btn d" id="arm">Tirar alarme</button>' : '') + '</div>');
      A.$('#aok', o.el).addEventListener('click', function () { x.quando = A.$('#ad', o.el).value + 'T' + A.$('#ah', o.el).value; x.alarme = true; o.close(); A.pedirNotificacao(); fim(); });
      var rm = A.$('#arm', o.el); if (rm) rm.addEventListener('click', function () { x.alarme = false; o.close(); fim(); });
    }
    else if (k === 'editar') A.editarCx(id);
  };
  A.abrirCx = function (id) {
    var x = A.cx(id); if (!x) return;
    if (x.tipo === 'cliente') return A.ir('cliente', x.ref);
    if (x.tipo === 'orcamento') return A.abrirOrcamento(x.ref);
    A.editarCx(id);
  };

  /* ---------- gestos: deslizar e arrastar ---------- */
  function gestos(root, soDeslizar) {
    var cur = null; // {el, face, x0, y0, dx, modo, id, pid}
    var aberto = null, timer = null;
    function recolher(el) { A.$('.face', el).style.transform = ''; setTimeout(function () { if (!A.$('.face', el).style.transform) el.classList.remove('sw-on'); }, 320); }
    function fecharAberto(exceto) { if (aberto && aberto !== exceto) { recolher(aberto); aberto = null; } }
    root.addEventListener('pointerdown', function (e) {
      var el = e.target.closest('.cx'); if (!el || e.target.closest('.acts button')) return;
      if (e.button && e.button !== 0) return;
      cur = { el: el, face: A.$('.face', el), x0: e.clientX, y0: e.clientY, dx: 0, modo: null, pid: e.pointerId, ini: aberto === el ? parseFloat((A.$('.face', el).style.transform.match(/-?[\d.]+/) || [0])[0]) : 0 };
      if (!soDeslizar) timer = setTimeout(function () { if (cur && !cur.modo) iniciarArrasto(e); }, 420);
    });
    root.addEventListener('pointermove', function (e) {
      if (!cur || e.pointerId !== cur.pid) return;
      var dx = e.clientX - cur.x0, dy = e.clientY - cur.y0;
      if (cur.modo === 'drag') { moverArrasto(e); return; }
      if (!cur.modo) {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) { cur.modo = 'swipe'; clearTimeout(timer); cur.el.classList.add('sw-on'); fecharAberto(cur.el); cur.el.classList.add('dragging'); try { cur.el.setPointerCapture(e.pointerId); } catch (x) {} }
        else if (Math.abs(dy) > 10) { clearTimeout(timer); cur = null; return; }
        else return;
      }
      var d = cur.ini + dx, lim = 68 * 3 + 20;
      d = Math.max(-lim, Math.min(lim, d)); cur.dx = d;
      cur.face.style.transform = 'translateX(' + d + 'px)';
    });
    function fim(e) {
      clearTimeout(timer);
      if (!cur) return;
      if (cur.modo === 'drag') { soltarArrasto(); cur = null; return; }
      if (cur.modo === 'swipe') {
        cur.el.classList.remove('dragging');
        var g = A.S.cfg.gestos, n = cur.dx > 0 ? g.dir.length : g.esq.length, w = n * 68;
        if (Math.abs(cur.dx) > 56 && n) { cur.face.style.transform = 'translateX(' + (cur.dx > 0 ? w : -w) + 'px)'; aberto = cur.el; }
        else { recolher(cur.el); if (aberto === cur.el) aberto = null; }
        cur.el._semClique = true; setTimeout(function (el) { el._semClique = false; }.bind(null, cur.el), 50);
      }
      cur = null;
    }
    root.addEventListener('pointerup', fim);
    root.addEventListener('pointercancel', function () { clearTimeout(timer); if (cur && cur.modo === 'drag') { soltarArrasto(); } else if (cur && cur.modo === 'swipe') { recolher(cur.el); cur.el.classList.remove('dragging'); } cur = null; });
    root.addEventListener('touchmove', function (e) { if (cur && cur.modo === 'drag') e.preventDefault(); }, { passive: false });
    root.addEventListener('contextmenu', function (e) { if (e.target.closest('.cx')) e.preventDefault(); });
    root.addEventListener('click', function (e) {
      var b = e.target.closest('.acts button');
      if (b) { var id = b.closest('.cx').getAttribute('data-cx'); fecharAberto(); A.acao(b.getAttribute('data-ac'), id, soDeslizar ? function () { A.render(); A.fecharTodas(); } : null); return; }
      var el = e.target.closest('.cx'); if (!el) { fecharAberto(); return; }
      if (el._semClique || el._arrastou) { el._arrastou = false; return; }
      if (aberto === el) { fecharAberto(); return; }
      fecharAberto();
      A.abrirCx(el.getAttribute('data-cx'));
    });

    /* arrastar */
    var flut = null, oy = 0, rolar = null;
    function iniciarArrasto(e) {
      if (!cur) return;
      cur.modo = 'drag'; fecharAberto();
      if (navigator.vibrate) navigator.vibrate(15);
      var r = cur.el.getBoundingClientRect();
      flut = cur.el.cloneNode(true); flut.classList.add('floating');
      flut.style.left = r.left + 'px'; flut.style.top = r.top + 'px'; flut.style.width = r.width + 'px';
      document.body.appendChild(flut);
      oy = cur.y0 - r.top;
      cur.el.classList.add('ghost');
      try { cur.el.setPointerCapture(cur.pid); } catch (x) {}
      A.$$('.sec', root).forEach(function (s) { s.classList.add('open'); });
    }
    function moverArrasto(e) {
      flut.style.top = (e.clientY - oy) + 'px';
      var y = e.clientY;
      clearInterval(rolar); rolar = null;
      if (y < 90) rolar = setInterval(function () { window.scrollBy(0, -10); }, 16);
      else if (y > window.innerHeight - 140) rolar = setInterval(function () { window.scrollBy(0, 10); }, 16);
      flut.style.display = 'none';
      var alvo = document.elementFromPoint(e.clientX, y);
      flut.style.display = '';
      A.$$('.sh.drop', root).forEach(function (s) { s.classList.remove('drop'); });
      if (!alvo) return;
      var outro = alvo.closest('.cx');
      if (outro && outro !== cur.el && root.contains(outro)) {
        var rr = outro.getBoundingClientRect();
        if (y < rr.top + rr.height / 2) outro.parentNode.insertBefore(cur.el, outro); else outro.parentNode.insertBefore(cur.el, outro.nextSibling);
        return;
      }
      var itens = alvo.closest('.items');
      if (itens && root.contains(itens) && itens !== cur.el.parentNode) { var vz = A.$('[data-vazio]', itens); if (vz) vz.remove(); itens.appendChild(cur.el); return; }
      var sh = alvo.closest('.sh');
      if (sh && root.contains(sh)) { sh.classList.add('drop'); var its = A.$('.items', sh.parentElement); if (its && its !== cur.el.parentNode) { var vz2 = A.$('[data-vazio]', its); if (vz2) vz2.remove(); its.insertBefore(cur.el, its.firstChild); } }
    }
    function soltarArrasto() {
      clearInterval(rolar); rolar = null;
      if (flut) flut.remove(); flut = null;
      var el = cur.el; el.classList.remove('ghost'); el._arrastou = true; setTimeout(function () { el._arrastou = false; }, 80);
      A.$$('.sh.drop', root).forEach(function (s) { s.classList.remove('drop'); });
      // nova ordem a partir da tela
      var vistos = {}, nova = [];
      A.$$('.items[data-cat]', root).forEach(function (box) {
        var cat = box.getAttribute('data-cat');
        A.$$('.cx', box).forEach(function (c) { var x = A.cx(c.getAttribute('data-cx')); if (x) { x.cat = cat; nova.push(x); vistos[x.id] = 1; } });
      });
      A.S.cx.forEach(function (x) { if (!vistos[x.id]) nova.push(x); });
      // quem foi solto entre fixados vira fixado só se caiu acima do primeiro não fixado (mantém a regra: fixados no topo)
      A.S.cx = nova; A.save(); A.render();
    }
  }
  A.gestos = gestos;

  A.telas.inicio = { html: html, init: init };
})();
