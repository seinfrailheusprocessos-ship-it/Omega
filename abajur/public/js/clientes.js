/* Clientes: o cliente é o centro. Lista com busca; pasta do cliente com pessoas ligadas, conversas, orçamentos, santos, lembretes e linha do tempo. */
(function () {
  'use strict';
  var $ = A.$, $$ = A.$$;
  function iniciais(n) { return String(n || '?').replace(/\s*\(EXEMPLO\)/, '').split(/\s+/).slice(0, 2).map(function (p) { return p[0] || ''; }).join('').toUpperCase(); }
  function orcs(cid) { return A.S.orcamentos.filter(function (o) { return o.cliente === cid; }); }
  function santos(cid) { var s = []; orcs(cid).forEach(function (o) { o.linhas.forEach(function (l) { if (s.indexOf(l.nome) < 0) s.push(l.nome); }); }); return s; }
  var filtro = 'recentes', busca = '';

  function htmlLista() {
    var h = A.topo('Clientes', A.S.clientes.length + ' na lista');
    h += '<input class="inp" id="cq" placeholder="Buscar por nome, telefone, código ou santo" value="' + A.esc(busca) + '" style="margin-bottom:8px">';
    h += '<div class="chips" id="cf">' + [['recentes', 'Recentes'], ['orc', 'Com orçamento'], ['todos', 'Todos (A–Z)']].map(function (x) { return '<button class="chip" data-f="' + x[0] + '" aria-pressed="' + (filtro === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>';
    h += '<div id="cl"></div>';
    return h;
  }
  function initLista(v) {
    function r() {
      var q = A.norm(busca.trim()), qd = q.replace(/\D/g, '');
      var l = A.S.clientes.filter(function (c) {
        if (filtro === 'orc' && !orcs(c.id).length) return false;
        if (!q) return true;
        return A.norm(c.nome).indexOf(q) > -1 || A.norm(c.codigo) === q || (qd.length > 2 && String(c.tel).indexOf(qd) > -1) ||
          santos(c.id).some(function (s) { return A.norm(s).indexOf(q) > -1; }) || c.pessoas.some(function (p) { return A.norm(p.nome).indexOf(q) > -1; });
      });
      if (filtro === 'todos') l.sort(function (a, b) { return A.norm(a.nome) < A.norm(b.nome) ? -1 : 1; });
      else l.sort(function (a, b) { return ((b.eventos[0] || {}).data || b.criado) > ((a.eventos[0] || {}).data || a.criado) ? 1 : -1; });
      $('#cl', v).innerHTML = l.length ? l.map(function (c, i) {
        var ult = c.eventos[0], o = orcs(c.id)[0];
        return '<div class="card row" data-c="' + c.id + '" style="cursor:pointer"><span class="ico" style="width:38px;height:38px;border-radius:50%;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center;font-weight:700;font-size:13px">' + iniciais(c.nome) + '</span>' +
          '<div class="grow"><div class="row" style="gap:6px"><b style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + A.esc(c.nome) + '</b><span class="code">' + c.codigo + '</span></div>' +
          '<div class="lead" style="margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + A.esc(ult ? A.quando(ult.data) + ' · ' + ult.txt : A.telBR(c.tel)) + '</div></div>' +
          (o ? '<span class="tag ' + (o.status === 'aprovado' ? 'ok' : o.status === 'recusado' ? 'rd' : 'wa') + '">' + o.status + '</span>' : '') +
          (c.tel ? '<a class="ib" href="' + A.wa(c.tel) + '" target="_blank" rel="noopener" aria-label="WhatsApp" data-wa>' + A.ic('wa') + '</a>' : '') + '</div>';
      }).join('') : '<div class="empty">Nenhum cliente. Use + Novo para cadastrar.</div>';
    }
    $('#cq', v).addEventListener('input', function (e) { busca = e.target.value; r(); });
    v.addEventListener('click', function (e) {
      var f = e.target.closest('[data-f]'); if (f) { filtro = f.getAttribute('data-f'); $$('#cf .chip', v).forEach(function (b) { b.setAttribute('aria-pressed', b === f); }); r(); return; }
      if (e.target.closest('[data-wa]')) return;
      var c = e.target.closest('[data-c]'); if (c) A.ir('cliente', c.getAttribute('data-c'));
    });
    r();
  }

  /* ---------- pasta do cliente ---------- */
  function htmlFicha(id) {
    var c = A.cliente(id); if (!c) return A.topo('Cliente', '', '', true) + '<div class="empty">Cliente não encontrado.</div>';
    var h = A.topo(c.nome, 'Código <span class="code">' + c.codigo + '</span> · ligado a ' + A.esc(A.telBR(c.telCodigo || c.tel) || 'sem telefone'), '', true);
    h += '<div class="btns" style="margin:0 0 12px"><a class="btn p" href="' + A.wa(c.tel) + '" target="_blank" rel="noopener">' + A.ic('wa') + 'WhatsApp</a><a class="btn" href="tel:+' + A.telLimpo(c.tel) + '">' + A.ic('phone') + 'Ligar</a><button class="btn" data-cod>' + A.ic('copy') + c.codigo + '</button></div>';
    var n = 0;
    h += A.secao(++n, 'Dados', '<div class="card">' +
      [['nome', 'Nome'], ['tel', 'Telefone'], ['cidade', 'Cidade'], ['email', 'E-mail']].map(function (f) {
        return '<div class="fld"><label class="f">' + f[1] + '</label><input class="inp" data-cf="' + f[0] + '" value="' + A.esc(f[0] === 'tel' ? A.telBR(c.tel) : c[f[0]] || '') + '"' + (f[0] === 'tel' ? ' inputmode="tel"' : '') + '></div>';
      }).join('') + '<div class="fld"><label class="f">Observações</label><textarea class="inp" data-cf="obs" style="min-height:60px">' + A.esc(c.obs || '') + '</textarea></div>' +
      '<p class="lead" style="margin:0">O código ' + c.codigo + ' não muda se o nome ou o telefone mudarem; fica ligado ao primeiro contato.</p></div>');
    h += A.secao(++n, 'Pessoas e conversas', c.pessoas.map(function (p, i) {
      var cv = p.conversas || [];
      return '<div class="card" data-p="' + p.id + '"><div class="row" style="margin-bottom:8px"><span class="num" style="font-family:var(--mono);font-size:11.5px;color:var(--mut)">' + n + '.' + (i + 1) + '</span><b class="grow">' + A.esc(p.nome) + '</b><span class="tag ac">' + A.esc(p.papel) + '</span>' +
        (p.tel ? '<a class="ib" href="' + A.wa(p.tel) + '" target="_blank" rel="noopener" aria-label="WhatsApp de ' + A.esc(p.nome) + '">' + A.ic('wa') + '</a>' : '') + '<button class="ib" data-ep aria-label="Editar pessoa">' + A.ic('edit') + '</button></div>' +
        (cv.length ? cv.slice(0, 3).map(function (m) { return '<div class="bubble"><small>' + A.quando(m.data) + (m.importada ? ' · conversa importada' : '') + '</small>' + A.esc(m.txt.length > 600 ? '…' + m.txt.slice(-600) : m.txt) + '</div>'; }).join('') + (cv.length > 3 ? '<button class="btn sm" data-vt>Ver todas (' + cv.length + ')</button>' : '') : '<div class="empty" style="padding:0 0 6px">Sem conversas registradas.</div>') +
        '<div class="row" style="margin-top:8px"><textarea class="inp" data-nc placeholder="Registrar conversa ou colar mensagem" style="min-height:44px"></textarea><button class="btn sm p" data-sc aria-label="Salvar conversa">' + A.ic('save') + '</button></div></div>';
    }).join('') + '<p class="lead">Arquiteto, assessor, contador ou outro ateliê entram aqui pelo + Novo › Pessoa ligada a um cliente.</p>', { ct: c.pessoas.length });
    var os = orcs(id);
    h += A.secao(++n, 'Orçamentos e pedidos', os.length ? os.map(function (o) {
      return '<div class="card" data-o="' + o.id + '"><div class="row"><b class="grow">Orçamento ' + A.esc(o.num) + '</b><span class="lead" style="margin:0">' + A.dataCurta(o.data) + '</span><b>' + A.brl(o.total) + '</b></div><div class="lead" style="margin:4px 0">' + A.esc(o.linhas.map(function (l) { return l.nome + (l.tam ? ' ' + l.tam + ' cm' : ''); }).join(', ')) + '</div>' +
        '<div class="chips" style="margin:0">' + ['enviado', 'aprovado', 'recusado'].map(function (s) { return '<button class="chip" data-st="' + s + '" aria-pressed="' + (o.status === s) + '">' + s + '</button>'; }).join('') + '<button class="chip" data-ab>' + A.ic('edit') + 'Abrir</button></div></div>';
    }).join('') : '<div class="empty">Nenhum orçamento ainda. Use + Novo › Orçamento.</div>', { ct: os.length });
    var ss = santos(id);
    h += A.secao(++n, 'Santos e peças pedidos', ss.length ? '<div class="chips">' + ss.map(function (s) { return '<span class="chip">' + A.esc(s) + '</span>'; }).join('') + '</div>' : '<div class="empty">Aparecem aqui conforme os orçamentos.</div>', { ct: ss.length });
    var lx = A.S.cx.filter(function (x) { return x.cliente === id && !x.arquivado; });
    h += A.secao(++n, 'Lembretes, demandas e notas', lx.length ? '<div class="items">' + lx.map(function (x, i) { return A.cxHTML(x, n + '.' + (i + 1)); }).join('') + '</div>' : '<div class="empty">Nada ligado a este cliente.</div>', { ct: lx.length, attr: ' data-lx' });
    h += A.secao(++n, 'Linha do tempo', '<div class="tl">' + c.eventos.map(function (e) { return '<div>' + A.esc(e.txt) + '<small>' + A.dataBR(e.data) + ' ' + String(e.data).slice(11, 16) + '</small></div>'; }).join('') + '</div>', { ct: c.eventos.length });
    h += '<div class="btns"><button class="btn d" data-del>' + A.ic('trash') + 'Excluir cliente</button></div>';
    return h;
  }
  function initFicha(v, id) {
    var c = A.cliente(id); if (!c) return;
    A.ctxCliente = id;
    v.addEventListener('input', function (e) {
      var f = e.target.getAttribute('data-cf'); if (!f) return;
      c[f] = f === 'tel' ? e.target.value.replace(/\D/g, '') : e.target.value;
      if (f === 'nome') { c.pessoas[0].nome = c.nome; A.S.cx.forEach(function (x) { if (x.tipo === 'cliente' && x.ref === id) x.titulo = c.nome; }); }
      if (f === 'tel' && !c.pessoas[0].tel) c.pessoas[0].tel = c.tel;
      A.save();
    });
    v.addEventListener('click', function (e) {
      if (e.target.closest('[data-cod]')) return A.copiar(c.codigo, 'Código ' + c.codigo + ' copiado');
      var pc = e.target.closest('[data-p]');
      if (pc) {
        var p = c.pessoas.filter(function (x) { return x.id === pc.getAttribute('data-p'); })[0];
        if (e.target.closest('[data-ep]')) return A.editarPessoa(id, p.id);
        if (e.target.closest('[data-sc]')) { var t = A.$('[data-nc]', pc).value.trim(); if (!t) return; p.conversas.unshift({ id: A.uid(), data: new Date().toISOString().slice(0, 16), txt: t }); A.save(); A.render(); A.toast('Conversa registrada'); return; }
        if (e.target.closest('[data-vt]')) { A.sheet('Conversas de ' + p.nome, p.conversas.map(function (m) { return '<div class="bubble"><small>' + A.quando(m.data) + '</small>' + A.esc(m.txt) + '</div>'; }).join('')); return; }
      }
      var oc = e.target.closest('[data-o]');
      if (oc) {
        var o = A.S.orcamentos.filter(function (x) { return x.id === oc.getAttribute('data-o'); })[0];
        var st = e.target.closest('[data-st]');
        if (st) { o.status = st.getAttribute('data-st'); c.eventos.unshift({ data: new Date().toISOString().slice(0, 16), txt: 'Orçamento ' + o.num + ' ' + o.status }); A.save(); A.render(); return; }
        if (e.target.closest('[data-ab]')) return A.abrirOrcamento(o.id);
      }
      if (e.target.closest('[data-del]')) A.confirmar('Excluir ' + c.nome + ' e tudo da pasta?', function () {
        A.S.clientes.splice(A.S.clientes.indexOf(c), 1);
        A.S.cx = A.S.cx.filter(function (x) { return !(x.tipo === 'cliente' && x.ref === id); });
        A.save(); A.ir('clientes');
      }, 'Excluir');
    });
    var lx = A.$('[data-lx]', v); if (lx) A.gestos(lx, true);
  }

  A.telas.clientes = { html: htmlLista, init: initLista };
  A.telas.cliente = { html: htmlFicha, init: initFicha, aba: 'clientes' };
})();
