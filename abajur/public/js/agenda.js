/* Agenda: lembretes (Financeiro, Pessoal, Clientes), calendário com períodos sobrepostos, bloco de notas por categorias e calculadora de datas. */
(function () {
  'use strict';
  var $ = A.$, $$ = A.$$;
  var aba = 'lembretes', para = 'Todos', mes = null, selIni = null, verFeitos = false;
  var MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  var SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  function addDias(iso, n) { var d = A.parseIso(iso); d.setDate(d.getDate() + n); return A.iso(d); }

  function html(arg) {
    if (arg) aba = arg;
    var h = A.topo('Agenda', 'Lembretes, calendário e notas');
    h += '<div class="tabs" role="tablist">' + [['lembretes', 'Lembretes'], ['calendario', 'Calendário'], ['notas', 'Pessoal · notas'], ['calc', 'Calculadora']].map(function (x) {
      return '<button role="tab" data-aba="' + x[0] + '" aria-selected="' + (aba === x[0]) + '">' + x[1] + '</button>';
    }).join('') + '</div><div id="ag"></div>';
    return h;
  }
  function init(v) {
    v.addEventListener('click', function (e) { var b = e.target.closest('[data-aba]'); if (b) { aba = b.getAttribute('data-aba'); selIni = null; A.ir('agenda', aba); } });
    var box = $('#ag', v);
    ({ lembretes: lembretes, calendario: calendario, notas: notas, calc: calc })[aba](box);
  }

  /* ---------- lembretes ---------- */
  function lembretes(box) {
    var pessoas = ['Todos'].concat(A.S.cfg.pessoas);
    var h = '<div class="chips" id="lp">' + pessoas.map(function (p) { return '<button class="chip" data-pa="' + A.esc(p) + '" aria-pressed="' + (p === para) + '">' + (p === 'Todos' ? 'Para todos' : 'Para ' + A.esc(p)) + '</button>'; }).join('') +
      '<button class="chip" data-vf aria-pressed="' + verFeitos + '">' + A.ic('check') + 'Feitos</button></div>';
    if (A.S.cfg.pessoas.indexOf('Ela') > -1) h += '<div class="xbox"><b>X</b> Nome da assistente ainda não informado (aparece como "Ela"). Ajuste em Mais › Ateliê e timbre.</div>';
    function filtro(x) { return x.tipo === 'lembrete' && !x.arquivado && (verFeitos || !x.feito) && (para === 'Todos' || x.para === para || x.para === 'Os dois'); }
    var todos = A.S.cx.filter(filtro).sort(function (a, b) { return (a.quando || '9') < (b.quando || '9') ? -1 : 1; });
    function bloco(l, pre) { return l.length ? '<div class="items">' + l.map(function (x, i) { return A.cxHTML(x, pre + '.' + (i + 1)); }).join('') + '</div>' : '<div class="empty">Nenhum lembrete. Use + Novo › Lembrete.</div>'; }
    var fin = todos.filter(function (x) { return x.area === 'Financeiro'; }), pes = todos.filter(function (x) { return x.area === 'Pessoal'; });
    var cli = todos.filter(function (x) { return x.area === 'Clientes' || (x.cliente && x.area !== 'Financeiro' && x.area !== 'Pessoal'); });
    var sem = todos.filter(function (x) { return fin.indexOf(x) < 0 && pes.indexOf(x) < 0 && cli.indexOf(x) < 0; });
    h += A.secao(1, 'Financeiro do ateliê', bloco(fin, 1), { aberta: true, ct: fin.length, cor: '#b97a14' });
    h += A.secao(2, 'Pessoal', bloco(pes, 2), { aberta: true, ct: pes.length, cor: '#d44a4a' });
    var lc = A.S.clientes.map(function (c) {
      var l = cli.filter(function (x) { return x.cliente === c.id; });
      return '<div class="card" style="padding:10px"><button class="row" data-cli="' + c.id + '" style="width:100%;text-align:left"><b class="grow">' + A.esc(c.nome) + '</b><span class="code">' + c.codigo + '</span><span class="tag' + (l.length ? ' wa' : '') + '">' + l.length + '</span>' + A.ic('chev') + '</button>' +
        (l.length ? '<div class="items" style="padding-top:8px">' + l.map(function (x, i) { return A.cxHTML(x, '3.' + (i + 1)); }).join('') + '</div>' : '') + '</div>';
    }).join('');
    var semCli = cli.filter(function (x) { return !x.cliente; });
    h += A.secao(3, 'Clientes', (semCli.length ? bloco(semCli, 3) : '') + (lc || '<div class="empty">Nenhum cliente.</div>'), { aberta: true, ct: cli.length, cor: '#3f7de0' });
    if (sem.length) h += A.secao(4, 'Sem área', bloco(sem, 4), { aberta: true, ct: sem.length });
    h += '<p class="lead">Com o app aberto, o lembrete toca na hora. Aviso com o app fechado: ' + A.X('APK (E2)') + '</p>';
    box.innerHTML = h;
    box.addEventListener('click', function (e) {
      var p = e.target.closest('[data-pa]'); if (p) { para = p.getAttribute('data-pa'); A.render(); return; }
      if (e.target.closest('[data-vf]')) { verFeitos = !verFeitos; A.render(); return; }
      var c = e.target.closest('[data-cli]'); if (c) A.ir('cliente', c.getAttribute('data-cli'));
    });
    A.gestos(box, true);
  }

  /* ---------- calendário ---------- */
  function eventosDia(iso) { return A.S.eventos.filter(function (e) { return e.ini <= iso && (e.fim || e.ini) >= iso; }); }
  function devDia(iso) { if (!A.S.cfg.mostrarDevocionais) return []; var md = iso.slice(5); return A.S.devocionais.filter(function (d) { return d[0] === md; }); }
  function calendario(box) {
    if (!mes) { var h0 = new Date(); mes = new Date(h0.getFullYear(), h0.getMonth(), 1); }
    function r() {
      var y = mes.getFullYear(), m = mes.getMonth(), ini = new Date(y, m, 1 - new Date(y, m, 1).getDay()), hoje = A.hoje();
      var ultimo = A.iso(new Date(y, m + 1, 0)), primeiro = A.iso(new Date(y, m, 1));
      var g = '';
      for (var i = 0; i < 42; i++) {
        var d = new Date(ini); d.setDate(ini.getDate() + i); var iso = A.iso(d);
        var evs = eventosDia(iso), dv = devDia(iso);
        var cls = 'd' + (d.getMonth() !== m ? ' o' : '') + (iso === hoje ? ' t' : '') + (iso === selIni ? ' s' : '');
        g += '<button class="' + cls + '" data-d="' + iso + '" aria-label="' + A.dataBR(iso) + (evs.length ? ', ' + evs.length + ' evento(s)' : '') + '"><span class="n">' + d.getDate() + '</span><span class="bars">' +
          evs.slice(0, 3).map(function (e) { return '<i style="background:' + (e.cor || '#7c5cf0') + '"></i>'; }).join('') + '</span>' + (dv.length ? '<span class="dv"></span>' : '') + '</button>';
        if (i === 34 && A.iso(d) >= ultimo) break;
      }
      var lista = A.S.eventos.filter(function (e) { return e.ini <= ultimo && (e.fim || e.ini) >= primeiro; }).sort(function (a, b) { return a.ini < b.ini ? -1 : 1; });
      var dvs = A.S.cfg.mostrarDevocionais ? A.S.devocionais.filter(function (d) { return +d[0].slice(0, 2) === m + 1; }) : [];
      var h = '<div class="cal" id="cal"><div class="hd"><button class="ib" data-mv="-1" aria-label="Mês anterior">' + A.ic('left') + '</button><b>' + MESES[m] + ' ' + y + '</b><button class="ib" data-mv="1" aria-label="Próximo mês">' + A.ic('chev') + '</button></div>' +
        '<div class="wk">' + SEM.map(function (s) { return '<div>' + s + '</div>'; }).join('') + '</div><div class="gr">' + g + '</div></div>';
      if (selIni) h += '<div class="sel-hint"><span class="grow">Início ' + A.dataBR(selIni) + '. Toque no dia final (ou no mesmo dia).</span><button data-cancel>Cancelar</button></div>';
      h += '<div class="btns"><button class="btn sm" data-hoje>Hoje</button><button class="btn sm" data-mes>' + A.ic('cal') + 'Evento no mês todo</button><button class="btn sm" data-tdev aria-pressed="' + A.S.cfg.mostrarDevocionais + '">' + (A.S.cfg.mostrarDevocionais ? 'Ocultar' : 'Mostrar') + ' devocionais</button></div>';
      h += '<div class="h4">Eventos de ' + MESES[m].toLowerCase() + '</div>' + (lista.length ? lista.map(function (e) {
        return '<button class="ev" data-ev="' + e.id + '"><span class="bar" style="background:' + (e.cor || '#7c5cf0') + '"></span><span class="grow"><b>' + A.esc(e.titulo) + '</b><br><small class="lead">' + A.dataBR(e.ini) + (e.fim && e.fim !== e.ini ? ' a ' + A.dataBR(e.fim) + ' · ' + (Math.round((A.parseIso(e.fim) - A.parseIso(e.ini)) / 864e5) + 1) + ' dias' : '') + '</small></span>' + A.ic('chev') + '</button>';
      }).join('') : '<div class="empty">Toque no dia inicial e no final para criar um evento.</div>');
      if (dvs.length) h += '<div class="h4">Datas devocionais</div>' + dvs.map(function (d) { return '<button class="ev" data-dv="' + d[0] + '|' + A.esc(d[1]) + '"><span class="bar" style="background:var(--gold)"></span><span class="grow"><b>' + A.esc(d[1]) + '</b><br><small class="lead">' + d[0].slice(3) + '/' + d[0].slice(0, 2) + ' · avisar clientes, planejar Instagram</small></span></button>'; }).join('');
      box.innerHTML = h;
    }
    box.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-mv')) { mes = new Date(mes.getFullYear(), mes.getMonth() + +b.getAttribute('data-mv'), 1); r(); return; }
      if (b.hasAttribute('data-hoje')) { var h0 = new Date(); mes = new Date(h0.getFullYear(), h0.getMonth(), 1); r(); return; }
      if (b.hasAttribute('data-cancel')) { selIni = null; r(); return; }
      if (b.hasAttribute('data-tdev')) { A.S.cfg.mostrarDevocionais = !A.S.cfg.mostrarDevocionais; A.save(); r(); return; }
      if (b.hasAttribute('data-mes')) { A.editarEvento(null, { ini: A.iso(mes), fim: A.iso(new Date(mes.getFullYear(), mes.getMonth() + 1, 0)), titulo: MESES[mes.getMonth()] }); return; }
      if (b.hasAttribute('data-ev')) { A.editarEvento(b.getAttribute('data-ev')); return; }
      if (b.hasAttribute('data-dv')) { var p = b.getAttribute('data-dv').split('|'); A.menu(p[1], [
        { t: 'Lembrete para avisar clientes', ic: 'bell', fn: function () { var ano = mes.getFullYear(); A.editarCx(null, { tipo: 'lembrete', titulo: 'Avisar clientes: ' + p[1], quando: addDias(ano + '-' + p[0], -7) + 'T09:00', area: 'Clientes' }); } },
        { t: 'Evento no calendário', ic: 'cal', fn: function () { var ano = mes.getFullYear(); A.editarEvento(null, { titulo: p[1], ini: ano + '-' + p[0], fim: ano + '-' + p[0], cor: '#a8875a' }); } }
      ]); return; }
      if (b.hasAttribute('data-d')) {
        var iso = b.getAttribute('data-d');
        if (!selIni) { selIni = iso; r(); return; }
        var a = selIni < iso ? selIni : iso, z = selIni < iso ? iso : selIni; selIni = null; r();
        A.editarEvento(null, { ini: a, fim: z });
      }
    };
    // deslizar para trocar de mês
    var x0 = null;
    box.addEventListener('touchstart', function (e) { if (e.target.closest('#cal')) x0 = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', function (e) { if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 70) { mes = new Date(mes.getFullYear(), mes.getMonth() + (dx < 0 ? 1 : -1), 1); r(); } });
    r();
  }
  A.editarEvento = function (id, pre) {
    var e = id ? A.S.eventos.filter(function (x) { return x.id === id; })[0] : Object.assign({ id: A.uid(), titulo: '', ini: A.hoje(), fim: A.hoje(), cor: '#7c5cf0' }, pre || {});
    var c = e.cliente && A.cliente(e.cliente);
    var o = A.sheet(id ? 'Evento' : 'Novo evento', '<div class="fld"><label class="f">Título</label><input class="inp" id="vt" autofocus value="' + A.esc(e.titulo) + '"></div>' +
      '<div class="g2"><div class="fld"><label class="f">Início</label><input class="inp" type="date" id="vi" value="' + e.ini + '"></div><div class="fld"><label class="f">Fim</label><input class="inp" type="date" id="vf" value="' + (e.fim || e.ini) + '"></div></div>' +
      '<p class="lead" id="vd"></p><label class="f">Cor</label><div class="chips" id="vc">' + A.CORES.map(function (k) { return '<button class="chip" data-cor="' + k + '" aria-pressed="' + (k === e.cor) + '"><span class="sw" style="background:' + k + ';width:16px;height:16px"></span></button>'; }).join('') + '</div>' +
      '<div class="fld"><label class="f">Observações</label><textarea class="inp" id="vo" style="min-height:60px">' + A.esc(e.obs || '') + '</textarea></div>' +
      '<label class="f">Cliente</label><button class="ev" id="vcli"><span class="bar" style="background:var(--accent-bg)"></span><span class="grow">' + (c ? A.esc(c.nome) : 'Sem cliente vinculado') + '</span></button>' +
      '<div class="btns"><button class="btn p" id="vok">Salvar</button>' + (id ? '<button class="btn d" id="vdel">Excluir</button>' : '') + '</div>');
    function dur() { var a = A.$('#vi', o.sc).value, b = A.$('#vf', o.sc).value; if (a && b) A.$('#vd', o.sc).textContent = (Math.round((A.parseIso(b) - A.parseIso(a)) / 864e5) + 1) + ' dia(s), de ' + A.dataBR(a) + ' a ' + A.dataBR(b); }
    o.sc.addEventListener('input', dur); dur();
    o.sc.addEventListener('click', function (ev) {
      var k = ev.target.closest('[data-cor]'); if (k) { e.cor = k.getAttribute('data-cor'); A.$$('#vc .chip', o.sc).forEach(function (q) { q.setAttribute('aria-pressed', q === k); }); return; }
      if (ev.target.closest('#vcli')) return A.escolherCliente(function (cid) { e.cliente = cid; A.$('#vcli .grow', o.sc).textContent = A.cliente(cid).nome; });
      if (ev.target.closest('#vok')) {
        e.titulo = A.$('#vt', o.sc).value.trim() || 'Evento'; e.ini = A.$('#vi', o.sc).value || A.hoje(); e.fim = A.$('#vf', o.sc).value || e.ini;
        if (e.fim < e.ini) { var t = e.fim; e.fim = e.ini; e.ini = t; }
        e.obs = A.$('#vo', o.sc).value;
        if (!id) A.S.eventos.push(e);
        A.save(); o.close(); if (A.rota.tela === 'agenda') A.render(); A.toast('Evento salvo');
      }
      if (ev.target.closest('#vdel')) A.confirmar('Excluir "' + e.titulo + '"?', function () { A.S.eventos.splice(A.S.eventos.indexOf(e), 1); A.save(); o.close(); A.render(); }, 'Excluir');
    });
  };

  /* ---------- notas ---------- */
  function notas(box) {
    var ns = A.S.cx.filter(function (x) { return x.tipo === 'nota' && !x.arquivado; });
    var soltas = ns.filter(function (x) { return !x.quando && !x.cliente; });
    function bloco(l, pre) { return l.length ? '<div class="items">' + l.map(function (x, i) { return A.cxHTML(x, pre + '.' + (i + 1)); }).join('') + '</div>' : '<div class="empty">Vazio.</div>'; }
    var h = '<p class="lead">Bloco de notas por categorias. Nota sem data e sem cliente fica solta; toque nela para vincular a uma data, cliente ou virar lembrete.</p>';
    h += A.secao(1, 'Soltas', bloco(soltas, 1), { aberta: true, ct: soltas.length });
    A.S.notaCats.forEach(function (k, i) {
      var l = ns.filter(function (x) { return (x.notaCat || A.S.notaCats[0]) === k; });
      h += A.secao(i + 2, k, bloco(l, i + 2), { aberta: true, ct: l.length, more: '<span class="more" role="button" tabindex="0" data-nc="' + A.esc(k) + '" aria-label="Opções da categoria">' + A.ic('dots') + '</span>' });
    });
    box.innerHTML = h;
    box.addEventListener('click', function (e) {
      var m = e.target.closest('[data-nc]'); if (!m) return; e.stopPropagation();
      var k = m.getAttribute('data-nc');
      A.menu(k, [
        { t: 'Renomear', ic: 'edit', fn: function () { A.pedirTexto('Nome da categoria', k, function (n) { A.S.notaCats[A.S.notaCats.indexOf(k)] = n; A.S.cx.forEach(function (x) { if (x.notaCat === k) x.notaCat = n; }); A.save(); A.render(); }); } },
        { t: 'Nova nota aqui', ic: 'plus', fn: function () { A.editarCx(null, { tipo: 'nota', notaCat: k }); } },
        { t: 'Excluir categoria', s: 'as notas vão para ' + A.S.notaCats[0], ic: 'trash', d: 1, fn: function () { if (A.S.notaCats.length < 2) { A.toast('Mantenha ao menos uma categoria'); return; } A.S.notaCats.splice(A.S.notaCats.indexOf(k), 1); A.S.cx.forEach(function (x) { if (x.notaCat === k) x.notaCat = A.S.notaCats[0]; }); A.save(); A.render(); } }
      ]);
    }, true);
    A.gestos(box, true);
  }

  /* ---------- calculadora de datas ---------- */
  function uteis(a, b) { var n = 0, d = A.parseIso(a), z = A.parseIso(b); while (d < z) { d.setDate(d.getDate() + 1); var w = d.getDay(); if (w && w !== 6) n++; } return n; }
  function somaUteis(iso, n) { var d = A.parseIso(iso), s = n < 0 ? -1 : 1, k = Math.abs(n); while (k > 0) { d.setDate(d.getDate() + s); var w = d.getDay(); if (w && w !== 6) k--; } return A.iso(d); }
  function calc(box) {
    var h0 = A.hoje();
    box.innerHTML = A.secao(1, 'Dias entre duas datas', '<div class="card"><div class="g2"><div class="fld"><label class="f">De</label><input class="inp" type="date" id="ca" value="' + h0 + '"></div><div class="fld"><label class="f">Até</label><input class="inp" type="date" id="cb" value="' + addDias(h0, 25) + '"></div></div><div id="cr1"></div><button class="btn sm" id="cev1">' + A.ic('cal') + 'Criar evento com este período</button></div>', { aberta: true }) +
      A.secao(2, 'Somar ou subtrair dias', '<div class="card"><div class="g2"><div class="fld"><label class="f">Data</label><input class="inp" type="date" id="cd" value="' + h0 + '"></div><div class="fld"><label class="f">Dias (use − para voltar)</label><input class="inp" type="number" id="cn" value="' + A.S.cfg.prazo + '" inputmode="numeric"></div></div>' +
      '<div class="chips" id="ct"><button class="chip" data-t="c" aria-pressed="true">Corridos</button><button class="chip" data-t="u" aria-pressed="false">Úteis (seg a sex)</button></div><div id="cr2"></div><button class="btn sm" id="cev2">' + A.ic('cal') + 'Criar evento até essa data</button></div>', { aberta: true });
    var tipo = 'c';
    function sem(iso) { return ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][A.parseIso(iso).getDay()]; }
    function r() {
      var a = $('#ca', box).value, b = $('#cb', box).value;
      if (a && b) { var lo = a < b ? a : b, hi = a < b ? b : a, n = Math.round((A.parseIso(hi) - A.parseIso(lo)) / 864e5);
        $('#cr1', box).innerHTML = '<div class="tot big"><span>' + n + ' dias corridos</span><span></span></div><div class="tot"><span>Contando o primeiro e o último</span><span>' + (n + 1) + ' dias</span></div><div class="tot"><span>Dias úteis (seg a sex)</span><span>' + uteis(lo, hi) + '</span></div><div class="tot"><span>Semanas</span><span>' + A.r2(n / 7).toLocaleString('pt-BR') + '</span></div>'; }
      var d = $('#cd', box).value, k = parseInt($('#cn', box).value, 10) || 0;
      if (d) { var res = tipo === 'c' ? addDias(d, k) : somaUteis(d, k); box._res = res;
        $('#cr2', box).innerHTML = '<div class="tot big"><span>' + A.dataBR(res) + '</span><span>' + sem(res) + '</span></div>'; }
    }
    box.addEventListener('input', r);
    box.addEventListener('click', function (e) {
      var t = e.target.closest('[data-t]'); if (t) { tipo = t.getAttribute('data-t'); $$('#ct .chip', box).forEach(function (q) { q.setAttribute('aria-pressed', q === t); }); r(); return; }
      if (e.target.closest('#cev1')) { var a = $('#ca', box).value, b = $('#cb', box).value; A.editarEvento(null, { ini: a < b ? a : b, fim: a < b ? b : a }); }
      if (e.target.closest('#cev2')) { var d = $('#cd', box).value, z = box._res; A.editarEvento(null, { ini: d < z ? d : z, fim: d < z ? z : d }); }
    });
    r();
  }

  A.telas.agenda = { html: html, init: init };
})();
