/* "+ Novo": um único ponto para todo cadastro. Também os seletores de cliente e de item usados pelas telas. */
(function () {
  'use strict';
  var $ = A.$, $$ = A.$$;
  var LETRAS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // sem 0, O, 1, I, L
  A.novoCodigo = function () {
    var c; do { c = ''; for (var i = 0; i < 4; i++) c += LETRAS[Math.floor(Math.random() * LETRAS.length)]; }
    while (A.S.clientes.some(function (x) { return x.codigo === c; }));
    return c;
  };

  A.novo = function (tipo, pre) {
    pre = pre || {};
    if (tipo) return abrir(tipo, pre);
    A.menu('+ Novo', [
      { t: 'Demanda', s: 'tarefa, com ou sem data', ic: 'task', fn: function () { abrir('demanda', pre); } },
      { t: 'Lembrete', s: 'Financeiro, Pessoal ou Clientes', ic: 'bell', fn: function () { abrir('lembrete', pre); } },
      { t: 'Nota', s: 'bloco de notas; sem data fica solta', ic: 'note', fn: function () { abrir('nota', pre); } },
      { t: 'Evento no calendário', s: 'dia ou período', ic: 'cal', fn: function () { abrir('evento', pre); } },
      { t: 'Cliente', s: 'código curto ligado ao telefone', ic: 'users', fn: function () { abrir('cliente', pre); } },
      { t: 'Orçamento', s: 'novo atendimento', ic: 'doc', fn: function () { A.novoAtendimento('', pre.cliente || null); A.ir('atender'); } },
      { t: 'Pessoa ligada a um cliente', s: 'arquiteto, assessor, contador, outro ateliê', ic: 'link', fn: function () { abrir('pessoa', pre); } },
      { t: 'Categoria do Início', ic: 'folder', fn: function () { abrir('categoria', pre); } },
      { t: 'Categoria de notas', ic: 'book', fn: function () { abrir('notacat', pre); } },
      { t: 'Item do catálogo', s: 'santo, peça ou produto', ic: 'image', fn: function () { abrir('item', pre); } },
      { t: 'Resposta rápida', ic: 'zap', fn: function () { abrir('resposta', pre); } },
      { t: 'Texto fixo do orçamento', ic: 'doc', fn: function () { abrir('texto', pre); } },
      { t: 'Etiqueta de foto', ic: 'tag', fn: function () { abrir('etiqueta', pre); } },
      { t: 'Forma de pagamento', ic: 'money', fn: function () { abrir('pagamento', pre); } }
    ]);
  };
  function abrir(tipo, pre) {
    if (tipo === 'demanda' || tipo === 'lembrete' || tipo === 'nota') return A.editarCx(null, Object.assign({ tipo: tipo }, pre));
    if (tipo === 'cliente') return A.novoCliente(pre, function (c) { A.ir('cliente', c.id); });
    if (tipo === 'evento') return A.editarEvento(null, pre);
    if (tipo === 'pessoa' && pre.cliente) return A.editarPessoa(pre.cliente, null);
    if (tipo === 'pessoa') return A.escolherCliente(function (id) { A.editarPessoa(id, null); }, 'Pessoa ligada a qual cliente?');
    if (tipo === 'categoria') return A.pedirTexto('Nova categoria do Início', '', function (n) { var k = { id: A.uid(), nome: n, cor: A.CORES[A.S.categorias.length % A.CORES.length] }; A.S.categorias.push(k); A.save(); A.ir('inicio'); });
    if (tipo === 'notacat') return A.pedirTexto('Nova categoria de notas', '', function (n) { if (A.S.notaCats.indexOf(n) < 0) A.S.notaCats.push(n); A.save(); A.toast('Categoria criada'); A.render(); });
    if (tipo === 'item') return A.editarItem(null);
    if (tipo === 'resposta') return A.editarTexto('respostas', null);
    if (tipo === 'texto') return A.editarTexto('textos', null);
    if (tipo === 'etiqueta') return A.pedirTexto('Nova etiqueta', '', function (n) { if (A.S.etiquetas.indexOf(n) < 0) A.S.etiquetas.push(n); A.save(); A.toast('Etiqueta criada'); });
    if (tipo === 'pagamento') return A.pedirTexto('Nova forma de pagamento', '', function (n) { A.S.pagamentos.push({ id: A.uid(), txt: n, on: false }); A.save(); A.toast('Forma de pagamento criada'); A.render(); });
  }

  /* ---------- demanda, lembrete, nota ---------- */
  A.editarCx = function (id, pre) {
    var x = id ? A.cx(id) : Object.assign({ id: A.uid(), tipo: 'demanda', titulo: '', cat: A.S.categorias[0] ? A.S.categorias[0].id : null }, pre || {});
    if (!id && x.tipo === 'nota' && !(pre && pre.cat)) x.cat = null;
    if (!id && x.tipo === 'lembrete' && !x.quando) x.quando = A.hoje() + 'T09:00';
    if (!id && x.tipo === 'lembrete' && !x.para) x.para = A.S.cfg.pessoas[1] || 'Ela';
    var novo = !id, T = A.TIPOS[x.tipo];
    function chips(nome, ops, val) { return '<div class="chips" data-ch="' + nome + '">' + ops.map(function (o) { return '<button class="chip" data-v="' + A.esc(o) + '" aria-pressed="' + (o === val) + '">' + A.esc(o) + '</button>'; }).join('') + '</div>'; }
    var h = '<div class="chips" data-ch="tipo">' + ['demanda', 'lembrete', 'nota'].map(function (t) { return '<button class="chip" data-v="' + t + '" aria-pressed="' + (t === x.tipo) + '">' + A.ic(A.TIPOS[t][0]) + A.TIPOS[t][1] + '</button>'; }).join('') + '</div>';
    h += '<div class="fld"><label class="f">Título</label><input class="inp" id="et" autofocus value="' + A.esc(x.titulo) + '"></div>';
    h += '<div class="fld"><label class="f">Detalhes</label><textarea class="inp" id="ex" style="min-height:70px">' + A.esc(x.texto || '') + '</textarea></div>';
    var q = x.quando || '';
    h += '<div class="g2"><div class="fld"><label class="f">Dia ' + (x.tipo === 'nota' ? '(sem data = solta)' : '(opcional)') + '</label><input class="inp" type="date" id="ed" value="' + q.slice(0, 10) + '"></div><div class="fld"><label class="f">Hora</label><input class="inp" type="time" id="eh" value="' + q.slice(11, 16) + '"></div></div>';
    h += '<div data-so="lembrete"><label class="f">Para</label>' + chips('para', A.S.cfg.pessoas.concat(['Os dois']), x.para) + '<label class="f">Área</label>' + chips('area', ['Financeiro', 'Pessoal', 'Clientes'], x.area) + '</div>';
    h += '<div data-so="nota"><label class="f">Categoria de notas</label>' + chips('notaCat', A.S.notaCats, x.notaCat || A.S.notaCats[0]) + '</div>';
    var c = x.cliente && A.cliente(x.cliente);
    h += '<label class="f">Cliente</label><button class="ev" id="ecli"><span class="bar" style="background:var(--accent-bg)"></span><span class="grow">' + (c ? A.esc(c.nome) + ' <span class="code">' + c.codigo + '</span>' : 'Sem cliente vinculado') + '</span>' + A.ic('chev') + '</button>';
    h += '<div class="fld"><label class="f">Caixinha no Início</label><select class="inp" id="ecat"><option value="">Não mostrar no Início</option>' + A.S.categorias.map(function (k) { return '<option value="' + k.id + '"' + (k.id === x.cat ? ' selected' : '') + '>' + A.esc(k.nome) + '</option>'; }).join('') + '</select></div>';
    if (!novo && x.tipo !== 'nota') h += '<div class="switch"><span>Feito</span><input type="checkbox" id="efeito"' + (x.feito ? ' checked' : '') + '></div>';
    h += '<div class="btns"><button class="btn p" id="eok">Salvar</button>' + (novo ? '' : '<button class="btn d" id="edel">Excluir</button>') + '</div>';
    var o = A.sheet((novo ? 'Novo: ' : '') + T[1], h);
    function vis() { A.$$('[data-so]', o.sc).forEach(function (d) { d.hidden = d.getAttribute('data-so') !== x.tipo; }); }
    vis();
    o.sc.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ch] .chip');
      if (b) {
        var ch = b.parentElement.getAttribute('data-ch'), v = b.getAttribute('data-v');
        x[ch] = v; A.$$('.chip', b.parentElement).forEach(function (q) { q.setAttribute('aria-pressed', q === b); });
        if (ch === 'tipo') { vis(); A.$('header h2', o.el).textContent = (novo ? 'Novo: ' : '') + A.TIPOS[v][1]; }
        if (ch === 'area' && v === 'Clientes') A.escolherCliente(function (cid) { x.cliente = cid; var cc = A.cliente(cid); A.$('#ecli .grow', o.sc).innerHTML = A.esc(cc.nome) + ' <span class="code">' + cc.codigo + '</span>'; });
        return;
      }
      if (e.target.closest('#ecli')) return A.escolherCliente(function (cid) { x.cliente = cid; var cc = A.cliente(cid); A.$('#ecli .grow', o.sc).innerHTML = A.esc(cc.nome) + ' <span class="code">' + cc.codigo + '</span>'; });
      if (e.target.closest('#eok')) {
        x.titulo = A.$('#et', o.sc).value.trim() || A.$('#ex', o.sc).value.trim().slice(0, 60);
        if (!x.titulo) { A.toast('Escreva um título'); return; }
        x.texto = A.$('#ex', o.sc).value;
        var d = A.$('#ed', o.sc).value, hh = A.$('#eh', o.sc).value;
        x.quando = d ? d + (hh ? 'T' + hh : '') : '';
        if (x.tipo === 'lembrete' && d && hh) { x.alarme = true; A.pedirNotificacao(); }
        x.cat = A.$('#ecat', o.sc).value || null;
        var fe = A.$('#efeito', o.sc); if (fe) x.feito = fe.checked;
        if (x.tipo !== 'lembrete') { delete x.para; delete x.area; }
        if (x.tipo !== 'nota') delete x.notaCat; else if (!x.notaCat) x.notaCat = A.S.notaCats[0];
        if (novo) A.S.cx.unshift(x);
        var cc2 = x.cliente && A.cliente(x.cliente);
        if (cc2 && novo) cc2.eventos.unshift({ data: new Date().toISOString().slice(0, 16), txt: A.TIPOS[x.tipo][1] + ': ' + x.titulo });
        A.save(); o.close(); A.render(); A.toast('Salvo');
        return;
      }
      if (e.target.closest('#edel')) { A.confirmar('Excluir "' + x.titulo + '"?', function () { A.S.cx.splice(A.S.cx.indexOf(x), 1); A.save(); o.close(); A.render(); }, 'Excluir'); }
    });
  };

  /* ---------- clientes ---------- */
  A.novoCliente = function (pre, cb) {
    pre = pre || {};
    var catCli = A.S.categorias.filter(function (k) { return A.norm(k.nome).indexOf('cliente') > -1; })[0];
    var h = '<div class="fld"><label class="f">Nome</label><input class="inp" id="cn" autofocus value="' + A.esc(pre.nome || '') + '"></div>' +
      '<div class="fld"><label class="f">Telefone do primeiro contato (WhatsApp)</label><input class="inp" id="ct" inputmode="tel" placeholder="(73) 9 9999-0000" value="' + A.esc(pre.tel ? A.telBR(pre.tel) : '') + '"></div>' +
      '<div class="g2"><div class="fld"><label class="f">Cidade</label><input class="inp" id="cc"></div><div class="fld"><label class="f">E-mail</label><input class="inp" id="ce" inputmode="email"></div></div>' +
      '<div class="fld"><label class="f">Caixinha no Início</label><select class="inp" id="ck"><option value="">Não mostrar no Início</option>' + A.S.categorias.map(function (k) { return '<option value="' + k.id + '"' + (catCli && k.id === catCli.id ? ' selected' : '') + '>' + A.esc(k.nome) + '</option>'; }).join('') + '</select></div>' +
      '<p class="lead">O código de 4 caracteres é criado ao salvar e fica ligado a este telefone.</p><div class="btns"><button class="btn p" id="cok">Salvar cliente</button></div>';
    var o = A.sheet('Novo cliente', h);
    A.$('#cok', o.el).addEventListener('click', function () {
      var nome = A.$('#cn', o.el).value.trim(), tel = A.$('#ct', o.el).value.replace(/\D/g, '');
      if (!nome && !tel) { A.toast('Informe nome ou telefone'); return; }
      var dup = tel && A.S.clientes.filter(function (c) { return A.telLimpo(c.tel) === A.telLimpo(tel); })[0];
      if (dup) { o.close(); A.toast('Telefone já é de ' + dup.nome + ' (' + dup.codigo + ')'); if (cb) cb(dup); return; }
      var c = { id: A.uid(), codigo: A.novoCodigo(), nome: nome || A.telBR(tel), tel: tel, telCodigo: tel, email: A.$('#ce', o.el).value.trim(), cidade: A.$('#cc', o.el).value.trim(), obs: '', criado: A.hoje(),
        pessoas: [{ id: A.uid(), nome: nome || A.telBR(tel), papel: 'Cliente', tel: tel, conversas: [] }], eventos: [{ data: new Date().toISOString().slice(0, 16), txt: 'Cliente cadastrado' }] };
      A.S.clientes.unshift(c);
      var k = A.$('#ck', o.el).value; if (k) A.S.cx.unshift({ id: A.uid(), cat: k, tipo: 'cliente', titulo: c.nome, ref: c.id });
      A.save(); o.close(); A.toast('Cliente ' + c.codigo + ' criado');
      if (cb) setTimeout(function () { cb(c); }, 60);
    });
  };
  A.escolherCliente = function (cb, titulo) {
    var o = A.sheet(titulo || 'Cliente', '<input class="inp" id="bq" placeholder="Buscar por nome, telefone ou código" autofocus><div id="bl" style="margin-top:8px"></div><button class="btn full" id="bn" style="margin-top:6px">' + A.ic('plus') + 'Novo cliente</button>');
    function r() {
      var q = A.norm(A.$('#bq', o.el).value.trim()), qd = q.replace(/\D/g, '');
      var l = A.S.clientes.filter(function (c) { return !q || A.norm(c.nome).indexOf(q) > -1 || A.norm(c.codigo) === q || (qd.length > 2 && String(c.tel).indexOf(qd) > -1); }).slice(0, 60);
      A.$('#bl', o.el).innerHTML = l.length ? l.map(function (c) { return '<button class="ev" data-c="' + c.id + '"><span class="bar" style="background:var(--accent-bg)"></span><span class="grow"><b>' + A.esc(c.nome) + '</b> <span class="code">' + c.codigo + '</span><br><small class="lead">' + A.telBR(c.tel) + '</small></span></button>'; }).join('') : '<div class="empty">Nenhum cliente encontrado.</div>';
    }
    A.$('#bq', o.el).addEventListener('input', r);
    o.sc.addEventListener('click', function (e) {
      var b = e.target.closest('[data-c]'); if (b) { o.close(); cb(b.getAttribute('data-c')); return; }
      if (e.target.closest('#bn')) { o.close(); setTimeout(function () { A.novoCliente({ nome: A.$('#bq', o.el).value }, function (c) { cb(c.id); }); }, 380); }
    });
    r();
  };
  A.editarPessoa = function (cid, pid) {
    var c = A.cliente(cid), p = pid ? c.pessoas.filter(function (x) { return x.id === pid; })[0] : { id: A.uid(), nome: '', papel: 'Arquiteto', tel: '', conversas: [] };
    var papeis = ['Cliente', 'Arquiteto', 'Assessor', 'Contador', 'Outro ateliê', 'Familiar', 'Outro'];
    var o = A.sheet(pid ? p.nome : 'Pessoa ligada a ' + c.nome, '<div class="fld"><label class="f">Nome</label><input class="inp" id="pn" autofocus value="' + A.esc(p.nome) + '"></div>' +
      '<label class="f">Papel</label><div class="chips" id="pp">' + papeis.map(function (x) { return '<button class="chip" data-v="' + x + '" aria-pressed="' + (x === p.papel) + '">' + x + '</button>'; }).join('') + '</div>' +
      '<div class="fld"><label class="f">Telefone</label><input class="inp" id="pt" inputmode="tel" value="' + A.esc(A.telBR(p.tel)) + '"></div>' +
      '<div class="btns"><button class="btn p" id="pok">Salvar</button>' + (pid && c.pessoas[0] !== p ? '<button class="btn d" id="pdel">Excluir</button>' : '') + '</div>');
    o.sc.addEventListener('click', function (e) {
      var b = e.target.closest('#pp .chip'); if (b) { p.papel = b.getAttribute('data-v'); A.$$('#pp .chip', o.sc).forEach(function (q) { q.setAttribute('aria-pressed', q === b); }); return; }
      if (e.target.closest('#pok')) {
        p.nome = A.$('#pn', o.sc).value.trim() || p.papel; p.tel = A.$('#pt', o.sc).value.replace(/\D/g, '');
        if (!pid) { c.pessoas.push(p); c.eventos.unshift({ data: new Date().toISOString().slice(0, 16), txt: p.papel + ' ligado: ' + p.nome }); }
        A.save(); o.close(); A.ir('cliente', cid);
      }
      if (e.target.closest('#pdel')) A.confirmar('Excluir ' + p.nome + '?', function () { c.pessoas.splice(c.pessoas.indexOf(p), 1); A.save(); o.close(); A.render(); }, 'Excluir');
    });
  };

  /* ---------- itens do catálogo ---------- */
  A.escolherItem = function (cb) {
    var o = A.sheet('Escolher peça', '<input class="inp" id="iq" placeholder="Buscar santo ou peça" autofocus><div id="il" style="margin-top:8px"></div>');
    function r() {
      var q = A.norm(A.$('#iq', o.el).value.trim()), h = '';
      A.S.grupos.forEach(function (g) {
        var l = A.S.itens.filter(function (e) { return !e.fora && e.grupo === g.nome && (!q || A.norm(e.nome).indexOf(q) > -1 || e.syn.some(function (s) { return s.indexOf(q) > -1; })); });
        if (!l.length) return;
        h += '<div class="h4">' + A.esc(g.nome) + '</div>' + l.map(function (e) { return '<button class="ev" data-k="' + A.esc(e.id) + '"><span class="grow">' + A.esc(e.nome) + '</span><small class="lead">' + A.tamanhos(e).map(function (t) { return t + ' cm'; }).join(' · ') + '</small></button>'; }).join('');
      });
      A.$('#il', o.el).innerHTML = h || '<div class="empty">Nada encontrado.</div>';
    }
    A.$('#iq', o.el).addEventListener('input', r);
    o.sc.addEventListener('click', function (e) { var b = e.target.closest('[data-k]'); if (b) { o.close(); cb(b.getAttribute('data-k')); } });
    r();
  };
  A.editarItem = function (id) {
    var e = id ? A.item(id) : { id: '', nome: '', grupo: (A.S.grupos[0] || {}).nome || 'Santos', syn: [], precos: {} };
    var tams = A.tamanhos(e);
    function lp(t, p) { return '<div class="row prl" style="margin-bottom:6px"><input class="inp" type="number" data-t value="' + (t == null ? '' : t) + '" placeholder="cm" style="width:90px" inputmode="numeric"><input class="inp" type="number" data-pr value="' + (p == null ? '' : p) + '" placeholder="R$" inputmode="decimal" step="any"><button class="ib" data-rmp aria-label="Remover tamanho">' + A.ic('x') + '</button></div>'; }
    var h = '<div class="fld"><label class="f">Nome</label><input class="inp" id="in" autofocus value="' + A.esc(e.nome) + '"></div>' +
      '<div class="fld"><label class="f">Grupo (pasta de 1º nível)</label><input class="inp" id="ig" list="igl" value="' + A.esc(e.grupo) + '"><datalist id="igl">' + A.S.grupos.map(function (g) { return '<option value="' + A.esc(g.nome) + '">'; }).join('') + '</datalist></div>' +
      '<div class="fld"><label class="f">Como os clientes escrevem (separe por vírgula)</label><textarea class="inp" id="is" style="min-height:60px">' + A.esc(e.syn.join(', ')) + '</textarea></div>' +
      '<label class="f">Tamanhos e preços' + (e.exemplo ? ' ' + A.X('preços de exemplo') : '') + '</label><div id="ip">' + (tams.length ? tams.map(function (t) { return lp(t, e.precos[t]); }).join('') : lp(null, null)) + '</div>' +
      '<button class="btn sm" id="iadd">' + A.ic('plus') + 'Tamanho</button>' +
      '<div class="btns"><button class="btn p" id="iok">Salvar</button>' + (id ? '<button class="btn d" id="idel">Excluir</button>' : '') + '</div>';
    var o = A.sheet(id ? e.nome : 'Novo item do catálogo', h);
    o.sc.addEventListener('click', function (ev) {
      if (ev.target.closest('#iadd')) { A.$('#ip', o.sc).insertAdjacentHTML('beforeend', lp(null, null)); return; }
      var rm = ev.target.closest('[data-rmp]'); if (rm) { rm.closest('.prl').remove(); return; }
      if (ev.target.closest('#iok')) {
        var nome = A.$('#in', o.sc).value.trim(); if (!nome) { A.toast('Informe o nome'); return; }
        e.nome = nome; e.grupo = A.$('#ig', o.sc).value.trim() || 'Outros';
        if (!A.S.grupos.some(function (g) { return g.nome === e.grupo; })) A.S.grupos.push({ nome: e.grupo, termos: [] });
        e.syn = A.$('#is', o.sc).value.split(',').map(function (s) { return A.norm(s.trim()); }).filter(Boolean);
        var pr = {}; A.$$('.prl', o.sc).forEach(function (r) { var t = A.$('[data-t]', r).value, p = A.$('[data-pr]', r).value; if (t) pr[+t] = p === '' ? null : A.num(p); });
        Object.keys(pr).forEach(function (k) { if (pr[k] == null) delete pr[k]; });
        if (JSON.stringify(pr) !== JSON.stringify(e.precos)) delete e.exemplo;
        e.precos = pr;
        if (!id) { e.id = A.norm(nome).replace(/[^a-z0-9]+/g, '-'); while (A.item(e.id)) e.id += '-2'; A.S.itens.push(e); }
        A.save(); o.close(); A.render(); A.toast('Catálogo atualizado');
      }
      if (ev.target.closest('#idel')) A.confirmar('Excluir ' + e.nome + ' do catálogo?', function () { A.S.itens.splice(A.S.itens.indexOf(e), 1); A.save(); o.close(); A.render(); }, 'Excluir');
    });
  };

  /* ---------- respostas rápidas e textos fixos ---------- */
  A.editarTexto = function (lista, id) {
    var arr = A.S[lista], x = id ? arr.filter(function (q) { return q.id === id; })[0] : { id: A.uid(), titulo: '', txt: '' };
    var o = A.sheet((id ? '' : 'Novo: ') + (lista === 'respostas' ? 'Resposta rápida' : 'Texto fixo'), '<div class="fld"><label class="f">Título (atalho)</label><input class="inp" id="tt" autofocus value="' + A.esc(x.titulo) + '"></div>' +
      '<div class="fld"><label class="f">Texto</label><textarea class="inp" id="tx">' + A.esc(x.txt) + '</textarea></div><p class="lead">Variáveis: {cliente}, {prazo}, {validade}, {total}, {sinal}</p>' +
      '<div class="btns"><button class="btn p" id="tok">Salvar</button>' + (id ? '<button class="btn d" id="tdel">Excluir</button>' : '') + '</div>');
    o.sc.addEventListener('click', function (e) {
      if (e.target.closest('#tok')) { x.titulo = A.$('#tt', o.sc).value.trim(); x.txt = A.$('#tx', o.sc).value; if (!x.titulo) { A.toast('Informe o título'); return; } delete x.exemplo; if (!id) arr.push(x); A.save(); o.close(); A.render(); }
      if (e.target.closest('#tdel')) A.confirmar('Excluir "' + x.titulo + '"?', function () { arr.splice(arr.indexOf(x), 1); A.save(); o.close(); A.render(); }, 'Excluir');
    });
  };

  /* ---------- avisos de lembrete (com o app aberto; em segundo plano: APK) ---------- */
  A.pedirNotificacao = function () { try { if (window.Notification && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {} };
  A.verificarAlarmes = function () {
    var agora = new Date(), mudou = false;
    A.S.cx.forEach(function (x) {
      if (!x.alarme || x.feito || x.avisado === x.quando || !x.quando || x.quando.length < 16) return;
      var d = new Date(x.quando); if (d > agora) return;
      x.avisado = x.quando; mudou = true;
      A.toast('Lembrete: ' + x.titulo);
      try {
        if (window.Notification && Notification.permission === 'granted') {
          if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then(function (r) { r.showNotification('Lembrete', { body: x.titulo, icon: 'icons/icone-192.png', badge: 'icons/icone-96.png', tag: x.id }); });
          else new Notification('Lembrete', { body: x.titulo });
        }
      } catch (e) {}
    });
    if (mudou) A.save();
  };
})();
