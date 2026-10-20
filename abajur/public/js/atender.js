/* Atender: mensagem -> reconhecimento -> fotos por abas -> orçamento com desconto por peça e geral -> texto, PDF e envio. */
(function () {
  'use strict';
  var $ = A.$, $$ = A.$$;
  function AT() {
    if (!A.S.rascunho) A.novoAtendimento();
    return A.S.rascunho;
  }
  A.novoAtendimento = function (texto, clienteId) {
    var pags = {}, txts = {};
    A.S.pagamentos.forEach(function (p) { if (p.on) pags[p.id] = 1; });
    A.S.textos.forEach(function (t) { if (t.on) txts[t.id] = 1; });
    A.S.rascunho = { texto: texto || '', res: { hits: [], grupos: [], html: '' }, tab: null, tag: 'todas', sel: {}, L: {}, extras: [], descGeral: 0, prazo: A.S.cfg.prazo,
      pags: pags, txts: txts, cliente: clienteId || null, orcId: null, num: null, obs: '', validade: A.S.cfg.validade, modelo: A.S.cfg.modeloPdf, fotosLinha: A.S.cfg.fotosLinha, comFotos: true };
    A.save();
    return A.S.rascunho;
  };
  A.cliente = function (id) { for (var i = 0; i < A.S.clientes.length; i++) if (A.S.clientes[i].id === id) return A.S.clientes[i]; return null; };

  /* ---------- cálculo ---------- */
  function linhaPadrao(k, cm, qtd) {
    var e = A.item(k), ks = A.tamanhos(e), nota = '';
    var tam = cm != null ? A.maisProximo(e, cm) : (ks[1] || ks[0] || null);
    if (cm != null && ks.length && tam !== cm) nota = 'Pediu ' + cm + ' cm; usei ' + tam + ' cm. Ajuste se quiser.';
    if (cm != null && !ks.length) tam = cm;
    return { tam: tam, qtd: qtd || 1, over: null, desc: 0, nota: nota };
  }
  function chaves() {
    var a = AT(), ks = a.res.hits.map(function (h) { return h.k; });
    Object.keys(a.sel).forEach(function (id) { if (!a.sel[id]) return; var f = A.fotoPorId(id); if (f && ks.indexOf(f.item) < 0 && A.item(f.item)) ks.push(f.item); });
    a.extras.forEach(function (k) { if (ks.indexOf(k) < 0 && A.item(k)) ks.push(k); });
    ks.forEach(function (k) { if (!a.L[k]) a.L[k] = linhaPadrao(k, null, 1); });
    return ks;
  }
  function precoUnit(k) { var e = A.item(k), l = AT().L[k]; return e && l && e.precos && e.precos[l.tam] != null ? +e.precos[l.tam] : null; }
  function base(k) { var l = AT().L[k]; if (l.over != null) return l.over; var p = precoUnit(k); return p == null ? 0 : p * (l.qtd || 1); }
  function fin(k) { return base(k) * (1 - (AT().L[k].desc || 0) / 100); }
  function totais() {
    var ks = chaves(), sub = 0, aft = 0;
    ks.forEach(function (k) { sub += base(k); aft += fin(k); });
    var gd = aft * (AT().descGeral || 0) / 100, tot = aft - gd;
    return { ks: ks, sub: sub, id: sub - aft, aft: aft, gd: gd, tot: tot, ef: sub > 0 ? (1 - tot / sub) * 100 : 0, sinal: tot * (A.S.cfg.sinal || 50) / 100 };
  }
  A.totaisAtendimento = totais; A.baseAt = base; A.finAt = fin; A.chavesAt = chaves; A.numeroAt = numero;
  function vars(t) {
    var a = AT(), c = A.cliente(a.cliente), tt = totais();
    return String(t).replace(/\{cliente\}/g, c ? primeiroNome(c.nome) : 'cliente').replace(/\{prazo\}/g, a.prazo).replace(/\{validade\}/g, a.validade || A.S.cfg.validade)
      .replace(/\{total\}/g, A.brl(tt.tot)).replace(/\{sinal\}/g, A.brl(tt.sinal));
  }
  A.vars = vars;
  function primeiroNome(n) { return String(n || '').replace(/\s*\(EXEMPLO\)/, '').split(' ')[0]; }
  function numero() { var a = AT(); return a.num || String(A.S.cfg.seqOrc).padStart(4, '0'); }
  A.textoOrcamento = function () {
    var a = AT(), t = totais(), c = A.cliente(a.cliente);
    if (!t.ks.length) return 'Reconheça um santo ou marque fotos para gerar o orçamento.';
    var L = ['Olá, ' + (c ? primeiroNome(c.nome) : 'tudo bem') + '! Segue o seu orçamento (nº ' + numero() + '):', ''];
    t.ks.forEach(function (k) {
      var e = A.item(k), l = a.L[k], b = base(k), d = l.desc || 0;
      L.push('• ' + e.nome + (l.tam ? ', ' + l.tam + ' cm' : '') + (l.qtd > 1 ? ' (' + l.qtd + 'x)' : '') + ': ' + (d > 0 ? A.brl(b) + ' − ' + A.pct(d) + ' = ' + A.brl(fin(k)) : A.brl(b)));
    });
    L.push('');
    if (t.id > 0.004 || a.descGeral > 0) L.push('Subtotal: ' + A.brl(t.aft));
    if (a.descGeral > 0) L.push('Desconto geral (' + A.pct(a.descGeral) + '): − ' + A.brl(t.gd));
    L.push('*Total: ' + A.brl(t.tot) + '*');
    if (t.ef > 0.004) L.push('Desconto total: ' + A.pct(t.ef) + ' sobre ' + A.brl(t.sub));
    L.push('');
    L.push('Prazo: ' + a.prazo + ' dias após a confirmação do sinal.');
    var pg = A.S.pagamentos.filter(function (p) { return a.pags[p.id]; }).map(function (p) { return p.txt; });
    if (pg.length) L.push('Pagamento: ' + pg.join('; ') + '.');
    if (pg.some(function (p) { return /sinal/i.test(p); })) L.push('Sinal (' + A.S.cfg.sinal + '%): ' + A.brl(t.sinal));
    A.S.textos.forEach(function (x) { if (a.txts[x.id]) L.push(vars(x.txt)); });
    var nf = Object.keys(a.sel).filter(function (k) { return a.sel[k]; }).length;
    L.push('');
    if (nf) L.push('Envio as fotos em seguida (' + nf + ').');
    L.push('Qualquer dúvida, é só chamar.');
    return L.join('\n');
  };

  /* ---------- tela ---------- */
  function html() {
    var a = AT(), c = A.cliente(a.cliente);
    var sub = c ? A.esc(c.nome) + ' · <span class="code">' + c.codigo + '</span>' : 'Mensagem, fotos e orçamento';
    var h = A.topo('Atender', sub, '<button class="ib" data-novo-at aria-label="Novo atendimento">' + A.ic('edit') + '</button>');
    h += '<div class="steps" id="stp"></div>';
    h += A.secao('1', 'Mensagem do cliente', '<div class="card"><textarea class="inp" id="msg" placeholder="Cole aqui a mensagem do cliente">' + A.esc(a.texto) + '</textarea>' +
      '<div class="g2" style="grid-template-columns:repeat(4,1fr);margin-top:8px"><button class="btn sm" data-in="colar">' + A.ic('paste') + 'Colar</button><button class="btn sm" data-in="print">' + A.ic('image') + 'Print</button><button class="btn sm" data-in="audio" id="bAud">' + A.ic('mic') + 'Áudio</button><button class="btn sm" data-in="conversa">' + A.ic('chat') + 'Conversa</button></div>' +
      '<div id="inSt" class="lead" style="margin:8px 0 0"></div><button class="btn p full" id="go" style="margin-top:8px">Analisar mensagem</button></div>', { aberta: true, attr: ' data-s="1"' });
    h += A.secao('2', 'O app entendeu', '<div class="card" id="ent"></div>', { aberta: true, attr: ' data-s="2"' });
    h += A.secao('3', 'Escolher fotos', '<div class="card"><div class="tabs" id="tabs" role="tablist"></div><div class="chips" id="tags"></div><div class="pgrid" id="pg"></div><p class="lead" style="margin:8px 0 0">Toque para marcar. Toque longo abre a foto e as etiquetas.</p></div>', { aberta: true, attr: ' data-s="3"', ct: '<span id="nsel"></span>' });
    h += A.secao('4', 'Orçamento', '<div id="lin"></div><button class="btn sm" id="addp" style="margin-bottom:10px">' + A.ic('plus') + 'Adicionar peça</button>' +
      '<div class="card"><div class="g3"><div><label class="f" for="dg"><span class="pc">%</span> Desconto geral</label><input class="inp" type="number" id="dg" min="0" max="100" step="any" inputmode="decimal"></div><div><label class="f" for="tf">Total final (R$)</label><input class="inp" type="number" id="tf" step="any" inputmode="decimal"></div><div><label class="f" for="pz">Prazo (dias)</label><input class="inp" type="number" id="pz" min="1" inputmode="numeric"></div></div><div id="tot" style="margin-top:8px"></div></div>' +
      '<div class="h4">Pagamento</div><div class="chips" id="pags"></div><div class="h4">Textos fixos</div><div class="chips" id="txts"></div>', { aberta: true, attr: ' data-s="4"' });
    h += A.secao('5', 'Texto e envio', '<textarea class="out" id="out" aria-label="Texto do orçamento"></textarea>' +
      '<div class="btns"><button class="btn p" id="cp">' + A.ic('copy') + 'Copiar texto</button><button class="btn" id="pdf">' + A.ic('pdf') + 'PDF</button></div>' +
      '<div class="btns"><button class="btn" id="wa">' + A.ic('wa') + 'WhatsApp</button><button class="btn" id="salvar">' + A.ic('save') + 'Salvar orçamento</button></div>' +
      '<div class="h4">Respostas rápidas</div><div class="chips" id="rr"></div>', { aberta: true, attr: ' data-s="5"' });
    return h;
  }

  function init(v) {
    var a = AT();
    function r() { rEnt(); rTabs(); rFotos(); rLinhas(); rPagTxt(); rPassos(); }
    function rPassos() {
      var t = totais(), n = [a.texto.trim().length > 0, a.res.hits.length + a.res.grupos.length > 0, Object.keys(a.sel).some(function (k) { return a.sel[k]; }), t.ks.length > 0, !!a.orcId];
      $('#stp', v).innerHTML = n.map(function (x) { return '<i class="' + (x ? 'd' : '') + '"></i>'; }).join('');
      var ns = Object.keys(a.sel).filter(function (k) { return a.sel[k]; }).length; var e = $('#nsel', v); if (e) e.textContent = ns ? ns + ' marcada' + (ns > 1 ? 's' : '') : '';
    }
    function rEnt() {
      var c = A.cliente(a.cliente), h = '';
      if (a.res.html) h += '<div style="line-height:1.65;margin-bottom:8px;white-space:pre-wrap;max-height:180px;overflow:auto">' + a.res.html + '</div>';
      a.res.hits.forEach(function (x, i) {
        var e = A.item(x.k); if (!e) return;
        h += '<button class="hit' + (x.cm == null ? ' warn' : '') + '" data-hit="' + i + '">' + A.esc(e.nome) + (x.qtd > 1 ? ' <small>' + x.qtd + 'x</small>' : '') + ' <small>' + (x.cm != null ? x.cm + ' cm' : 'sem medida') + '</small></button>';
      });
      a.res.grupos.forEach(function (g) { h += '<span class="hit gen">Todos: ' + A.esc(g) + '</span>'; });
      if (!a.res.hits.length && !a.res.grupos.length) h += '<div class="empty">' + (a.texto ? 'Nada reconhecido. Escreva o nome de um santo, como "Santo Antônio", "Clara" ou "oratório", ou acrescente o sinônimo no Catálogo.' : 'Cole a mensagem e toque em Analisar.') + '</div>';
      h += '<div class="h4" style="margin-top:12px">Cliente</div><button class="ev" id="cli"><span class="bar" style="background:var(--accent-bg)"></span><span class="grow">' +
        (c ? '<b>' + A.esc(c.nome) + '</b> <span class="code">' + c.codigo + '</span><br><small class="lead">' + A.telBR(c.tel) + '</small>' : '<b>Vincular cliente</b><br><small class="lead">buscar na lista ou cadastrar pelo + Novo</small>') + '</span>' + A.ic('chev') + '</button>';
      $('#ent', v).innerHTML = h;
    }
    function abas() {
      var t = [];
      a.res.hits.forEach(function (x) { var e = A.item(x.k); if (e) t.push(['k:' + x.k, e.nome]); });
      a.res.grupos.forEach(function (g) { t.push(['g:' + g, 'Todos: ' + g]); });
      chaves().forEach(function (k) { if (!t.some(function (x) { return x[0] === 'k:' + k; })) t.push(['k:' + k, A.item(k).nome]); });
      return t;
    }
    function rTabs() {
      var t = abas(); if (!a.tab || !t.some(function (x) { return x[0] === a.tab; })) a.tab = t.length ? t[0][0] : null;
      $('#tabs', v).innerHTML = t.map(function (x) {
        var n = (x[0].slice(0, 2) === 'k:' ? A.fotosDo(x[0].slice(2)) : A.fotosDoGrupo(x[0].slice(2))).filter(function (f) { return a.sel[f.id]; }).length;
        return '<button role="tab" data-tab="' + A.esc(x[0]) + '" aria-selected="' + (x[0] === a.tab) + '">' + A.esc(x[1]) + (n ? ' · ' + n : '') + '</button>';
      }).join('');
    }
    function fotosAba() { if (!a.tab) return []; return a.tab.slice(0, 2) === 'k:' ? A.fotosDo(a.tab.slice(2)) : A.fotosDoGrupo(a.tab.slice(2)); }
    function rFotos() {
      var ps = fotosAba(), tags = [];
      ps.forEach(function (f) { (f.tags || []).forEach(function (t) { if (tags.indexOf(t) < 0) tags.push(t); }); });
      $('#tags', v).innerHTML = tags.length ? ['todas'].concat(tags).map(function (t) { return '<button class="chip" data-tag="' + A.esc(t) + '" aria-pressed="' + (a.tag === t) + '">' + A.esc(t) + '</button>'; }).join('') : '';
      var l = ps.filter(function (f) { return a.tag === 'todas' || (f.tags || []).indexOf(a.tag) > -1; });
      $('#pg', v).innerHTML = l.length ? l.map(function (f) { return A.fotoHTML(f, a.sel[f.id]); }).join('') : '<div class="empty" style="grid-column:1/-1">Sem fotos para mostrar. Analise uma mensagem com um santo.</div>';
    }
    function rLinhas() {
      var ks = chaves();
      if (!ks.length) { $('#lin', v).innerHTML = '<div class="empty">Sem peças ainda. Reconheça um santo, marque fotos ou adicione uma peça.</div>'; rTot(); return; }
      $('#lin', v).innerHTML = ks.map(function (k, i) {
        var e = A.item(k), l = a.L[k], tams = A.tamanhos(e);
        if (l.tam != null && tams.indexOf(+l.tam) < 0) tams.push(+l.tam);
        var so = tams.map(function (s) { return '<option value="' + s + '"' + (+s === +l.tam ? ' selected' : '') + '>' + s + ' cm</option>'; }).join('') || '<option value="">—</option>';
        var qo = ''; for (var n = 1; n <= 20; n++) qo += '<option value="' + n + '"' + (n === l.qtd ? ' selected' : '') + '>' + n + 'x</option>';
        var semPreco = precoUnit(k) == null && l.over == null;
        return '<div class="line" data-k="' + A.esc(k) + '"><div class="nm"><span class="num" style="font-family:var(--mono);font-size:11.5px;color:var(--mut)">4.' + (i + 1) + '</span><span class="grow">' + A.esc(e.nome) + '</span>' + (e.exemplo ? '<span class="tag wa">preço exemplo</span>' : '') + '<button class="ib" data-rm aria-label="Remover peça" style="width:30px;height:30px">' + A.ic('x') + '</button></div>' +
          (l.nota ? '<div class="nt">' + A.esc(l.nota) + '</div>' : '') + (semPreco ? '<div style="margin-top:4px">' + A.X('sem preço para este tamanho: digite o valor') + '</div>' : '') +
          '<div class="f"><div class="s3"><label>Tamanho</label><select class="inp" data-f="tam">' + so + '</select></div><div class="s3"><label>Quantidade</label><select class="inp" data-f="qtd">' + qo + '</select></div>' +
          '<div class="s2"><label>Valor (R$)</label><input class="inp" type="number" data-f="valor" value="' + A.r2(base(k)) + '" inputmode="decimal" step="any"></div>' +
          '<div class="s2"><label><span class="pc">%</span> Desc.</label><input class="inp" type="number" data-f="desc" value="' + A.r2(l.desc || 0) + '" min="0" max="100" inputmode="decimal" step="any"></div>' +
          '<div class="s2"><label>Final (R$)</label><input class="inp" type="number" data-f="final" value="' + A.r2(fin(k)) + '" inputmode="decimal" step="any"></div></div></div>';
      }).join('');
      rTot();
    }
    function sync(ln, k, skip) {
      function set(f, val) { if (f === skip) return; var el = $('[data-f="' + f + '"]', ln); if (el && document.activeElement !== el) el.value = val; }
      set('valor', A.r2(base(k))); set('desc', A.r2(a.L[k].desc || 0)); set('final', A.r2(fin(k)));
    }
    function rTot() {
      var t = totais();
      $('#tot', v).innerHTML = '<div class="tot"><span>Subtotal</span><span>' + A.brl(t.sub) + '</span></div>' +
        (t.id > 0.004 ? '<div class="tot"><span>Descontos por peça</span><span>− ' + A.brl(t.id) + '</span></div>' : '') +
        '<div class="tot"><span>Desconto geral (' + A.pct(a.descGeral || 0) + ')</span><span>− ' + A.brl(t.gd) + '</span></div>' +
        '<div class="tot big"><span>Total</span><span>' + A.brl(t.tot) + '</span></div>' +
        '<div class="tot"><span>Desconto total sobre o bruto</span><span>' + A.pct(t.ef) + '</span></div>' +
        '<div class="tot"><span>Sinal de ' + A.S.cfg.sinal + '%</span><span>' + A.brl(t.sinal) + '</span></div>';
      var f = $('#tf', v); if (f && document.activeElement !== f) f.value = A.r2(t.tot);
      var d = $('#dg', v); if (d && document.activeElement !== d) d.value = A.r2(a.descGeral || 0);
      var p = $('#pz', v); if (p && document.activeElement !== p) p.value = a.prazo;
      rTexto(); rPassos(); A.save();
    }
    function rTexto() { var o = $('#out', v); if (o && document.activeElement !== o) o.value = A.textoOrcamento(); }
    function rPagTxt() {
      $('#pags', v).innerHTML = A.S.pagamentos.map(function (p) { return '<button class="chip" data-pag="' + p.id + '" aria-pressed="' + (!!a.pags[p.id]) + '">' + A.esc(p.txt) + '</button>'; }).join('');
      $('#txts', v).innerHTML = A.S.textos.map(function (x) { return '<button class="chip" data-txt="' + x.id + '" aria-pressed="' + (!!a.txts[x.id]) + '">' + A.esc(x.titulo) + '</button>'; }).join('');
      $('#rr', v).innerHTML = A.S.respostas.map(function (x) { return '<button class="chip" data-rr="' + x.id + '">' + A.ic('zap') + A.esc(x.titulo) + '</button>'; }).join('');
    }
    A.atualizarAtender = function () { r(); };

    function analisar() {
      a.texto = $('#msg', v).value;
      a.res = A.analisar(a.texto);
      a.sel = {}; a.L = {}; a.extras = []; a.tag = 'todas'; a.orcId = null; a.num = null;
      a.res.hits.forEach(function (h) { a.L[h.k] = linhaPadrao(h.k, h.cm, h.qtd); });
      a.tab = null; A.save(); r();
      if (a.res.hits.length || a.res.grupos.length) setTimeout(function () { var s = $('[data-s="3"]', v); if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 120);
    }
    A.analisarTexto = function (t, anexar) { var m = $('#msg', v); if (!m) return; m.value = anexar && m.value ? m.value + '\n' + t : t; analisar(); };

    v.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.classList.contains('sh')) return;
      if (b.id === 'go') return analisar();
      if (b.hasAttribute('data-novo-at')) return A.confirmar('Começar um atendimento novo?', function () { A.novoAtendimento(); A.render(); }, 'Novo atendimento');
      if (b.hasAttribute('data-in')) return entrada(b.getAttribute('data-in'), b);
      if (b.hasAttribute('data-hit')) return menuHit(+b.getAttribute('data-hit'));
      if (b.id === 'cli') return A.escolherCliente(function (id) { a.cliente = id; A.save(); A.render(); });
      if (b.hasAttribute('data-tab')) { a.tab = b.getAttribute('data-tab'); a.tag = 'todas'; rTabs(); rFotos(); return; }
      if (b.hasAttribute('data-tag')) { a.tag = b.getAttribute('data-tag'); rFotos(); return; }
      if (b.hasAttribute('data-p')) {
        var id = b.getAttribute('data-p'); a.sel[id] = a.sel[id] ? 0 : 1; if (!a.sel[id]) delete a.sel[id];
        b.classList.toggle('sel', !!a.sel[id]); b.setAttribute('aria-pressed', !!a.sel[id]);
        rTabs(); rLinhas(); return;
      }
      if (b.hasAttribute('data-rm')) { var k = b.closest('.line').getAttribute('data-k'); rmPeca(k); return; }
      if (b.id === 'addp') return A.escolherItem(function (k) { if (a.extras.indexOf(k) < 0) a.extras.push(k); if (!a.L[k]) a.L[k] = linhaPadrao(k, null, 1); r(); });
      if (b.hasAttribute('data-pag')) { var p = b.getAttribute('data-pag'); a.pags[p] = a.pags[p] ? 0 : 1; rPagTxt(); rTexto(); A.save(); return; }
      if (b.hasAttribute('data-txt')) { var x = b.getAttribute('data-txt'); a.txts[x] = a.txts[x] ? 0 : 1; rPagTxt(); rTexto(); A.save(); return; }
      if (b.hasAttribute('data-rr')) { var rr = A.S.respostas.filter(function (q) { return q.id === b.getAttribute('data-rr'); })[0]; if (rr) A.copiar(vars(rr.txt), 'Resposta "' + rr.titulo + '" copiada'); return; }
      if (b.id === 'cp') return A.copiar($('#out', v).value, 'Texto copiado');
      if (b.id === 'wa') { var c = A.cliente(a.cliente); if (!c) { A.toast('Vincule o cliente para abrir a conversa'); return; } window.open(A.wa(c.tel, $('#out', v).value), '_blank'); salvarOrc(true); return; }
      if (b.id === 'salvar') { salvarOrc(); return; }
      if (b.id === 'pdf') return A.ajustePdf();
    });
    function rmPeca(k) {
      a.res.hits = a.res.hits.filter(function (h) { return h.k !== k; });
      a.extras = a.extras.filter(function (x) { return x !== k; });
      Object.keys(a.sel).forEach(function (id) { var f = A.fotoPorId(id); if (f && f.item === k) delete a.sel[id]; });
      delete a.L[k]; r();
    }
    function menuHit(i) {
      var h = a.res.hits[i]; if (!h) return;
      A.menu(A.item(h.k).nome, [
        { t: 'Trocar por outro item do catálogo', ic: 'swipe', fn: function () { A.escolherItem(function (k) { var l = a.L[h.k]; delete a.L[h.k]; h.k = k; a.L[k] = linhaPadrao(k, h.cm, h.qtd); if (l) a.L[k].desc = l.desc; r(); }); } },
        { t: 'Acrescentar um sinônimo a este item', s: 'para reconhecer da próxima vez', ic: 'book', fn: function () { A.pedirTexto('Novo sinônimo de ' + A.item(h.k).nome, '', function (s) { A.item(h.k).syn.push(A.norm(s)); A.save(); A.toast('Sinônimo salvo'); }, 'ex.: sto antonio'); } },
        { t: 'Remover', ic: 'trash', d: 1, fn: function () { rmPeca(h.k); } }
      ]);
    }
    v.addEventListener('input', function (e) {
      var t = e.target;
      if (t.id === 'msg') { a.texto = t.value; A.save(); return; }
      if (t.id === 'out') return;
      if (t.id === 'dg') { a.descGeral = Math.max(0, Math.min(100, parseFloat(t.value) || 0)); rTot(); return; }
      if (t.id === 'tf') { var t0 = totais(), tv = parseFloat(t.value) || 0; a.descGeral = t0.aft > 0 ? Math.max(0, Math.min(100, (1 - tv / t0.aft) * 100)) : 0; rTot(); return; }
      if (t.id === 'pz') { a.prazo = parseInt(t.value, 10) || 1; rTexto(); A.save(); return; }
      var ln = t.closest('.line'); if (!ln) return;
      var k = ln.getAttribute('data-k'), f = t.getAttribute('data-f'), l = a.L[k];
      if (f === 'valor') { l.over = parseFloat(t.value) || 0; sync(ln, k, 'valor'); rTot(); }
      else if (f === 'desc') { l.desc = Math.max(0, Math.min(100, parseFloat(t.value) || 0)); sync(ln, k, 'desc'); rTot(); }
      else if (f === 'final') { var bb = base(k), fv = parseFloat(t.value) || 0; l.desc = bb > 0 ? Math.max(0, Math.min(100, (1 - fv / bb) * 100)) : 0; sync(ln, k, 'final'); rTot(); }
    });
    v.addEventListener('change', function (e) {
      var t = e.target, ln = t.closest('.line'); if (!ln) return;
      var k = ln.getAttribute('data-k'), f = t.getAttribute('data-f'), l = a.L[k];
      if (f === 'tam') { l.tam = +t.value; l.over = null; l.nota = ''; rLinhas(); }
      else if (f === 'qtd') { l.qtd = +t.value; l.over = null; rLinhas(); }
    });
    A.toqueLongo(v, '[data-p]', function (el) { A.abrirFoto(el.getAttribute('data-p'), function () { rFotos(); }); });
    r();
    if (A._pendenteEntrada) { var pe = A._pendenteEntrada; A._pendenteEntrada = null; setTimeout(pe, 50); }
  }

  /* ---------- salvar orçamento ---------- */
  function salvarOrc(silencioso) {
    var a = AT(), t = totais();
    if (!t.ks.length) { A.toast('Sem peças no orçamento'); return null; }
    var novo = !a.orcId;
    if (novo) { a.orcId = A.uid(); a.num = numero(); A.S.cfg.seqOrc++; }
    var o = A.S.orcamentos.filter(function (x) { return x.id === a.orcId; })[0];
    var snap = {
      id: a.orcId, num: a.num, data: A.hoje(), cliente: a.cliente, texto: a.texto,
      linhas: t.ks.map(function (k) { var l = a.L[k]; return { k: k, nome: A.item(k).nome, tam: l.tam, qtd: l.qtd, base: A.r2(base(k)), desc: l.desc || 0, final: A.r2(fin(k)) }; }),
      fotos: Object.keys(a.sel).filter(function (k) { return a.sel[k]; }), descGeral: a.descGeral, total: A.r2(t.tot), sub: A.r2(t.sub), prazo: a.prazo,
      pags: Object.keys(a.pags).filter(function (k) { return a.pags[k]; }), txts: Object.keys(a.txts).filter(function (k) { return a.txts[k]; }),
      status: (o && o.status) || 'enviado', rascunho: JSON.parse(JSON.stringify(a))
    };
    if (o) Object.assign(o, snap); else A.S.orcamentos.unshift(snap);
    var c = A.cliente(a.cliente);
    if (c && novo) c.eventos.unshift({ data: new Date().toISOString().slice(0, 16), txt: 'Orçamento ' + a.num + ' (' + A.brl(t.tot) + ')', ref: a.orcId });
    if (novo) {
      var cat = A.S.categorias.filter(function (k) { return A.norm(k.nome).indexOf('orcamento') > -1; })[0];
      A.S.cx.unshift({ id: A.uid(), cat: cat ? cat.id : null, tipo: 'orcamento', titulo: 'Orçamento ' + a.num + (c ? ' · ' + c.nome : ''), ref: a.orcId, quando: A.hoje() });
    }
    A.save();
    if (!silencioso) A.toast('Orçamento ' + a.num + ' salvo' + (c ? ' na pasta de ' + primeiroNome(c.nome) : ''));
    return snap;
  }
  A.salvarOrcamento = salvarOrc;
  A.abrirOrcamento = function (id) {
    var o = A.S.orcamentos.filter(function (x) { return x.id === id; })[0]; if (!o) return;
    A.S.rascunho = JSON.parse(JSON.stringify(o.rascunho)); A.save(); A.ir('atender');
  };

  /* ---------- entradas: colar, print, áudio, conversa ---------- */
  function status(t) { var e = $('#inSt'); if (e) e.innerHTML = t; }
  function entrada(tipo, b) {
    if (tipo === 'colar') {
      if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(function (t) { if (t) A.analisarTexto(t); else A.toast('Área de transferência vazia'); }, function () { $('#msg').focus(); A.toast('Toque e segure na caixa e escolha Colar'); });
      else { $('#msg').focus(); A.toast('Toque e segure na caixa e escolha Colar'); }
      return;
    }
    if (tipo === 'print') return escolherArquivo('image/*', function (f) { A.lerPrint(f); });
    if (tipo === 'conversa') return escolherArquivo('.txt,.zip,text/plain,application/zip', function (f) { A.importarConversa(f); });
    if (tipo === 'audio') {
      A.menu('Áudio', [
        { t: 'Ditar agora', s: 'fala e o texto entra na caixa', ic: 'mic', fn: function () { ditado(b); } },
        { t: 'Arquivo de áudio do cliente', s: 'transcrição no aparelho: chega no APK (E2)', ic: 'chat', fn: function () { A.toast('Transcrição de arquivo de áudio entra no APK (E2)'); } }
      ]);
    }
  }
  function escolherArquivo(accept, fn) {
    var i = document.createElement('input'); i.type = 'file'; i.accept = accept;
    i.addEventListener('change', function () { if (i.files && i.files[0]) fn(i.files[0]); }); i.click();
  }
  var rec = null;
  function ditado(b) {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { A.toast('Ditado indisponível neste navegador'); return; }
    if (rec) { rec.stop(); return; }
    rec = new SR(); rec.lang = 'pt-BR'; rec.continuous = true; rec.interimResults = false;
    var m = $('#msg'), ini = m.value;
    rec.onresult = function (e) { var t = ''; for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript + ' '; m.value = (ini ? ini + ' ' : '') + t.trim(); AT().texto = m.value; A.save(); };
    rec.onend = function () { rec = null; if (b) b.classList.remove('on'); status(''); var bb = $('#bAud'); if (bb) bb.classList.remove('p'); };
    rec.onerror = function () { A.toast('Ditado interrompido'); };
    rec.start(); status('Ouvindo… toque em Áudio de novo para parar.'); var bb = $('#bAud'); if (bb) bb.classList.add('p');
  }
  /* leitura do print no aparelho (Tesseract, código aberto; carrega só quando usado) */
  var ocrP = null;
  function carregarOcr() {
    if (ocrP) return ocrP;
    ocrP = new Promise(function (ok, no) { var s = document.createElement('script'); s.src = 'vendor/ocr/tesseract.min.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); })
      .then(function () {
        var base = new URL('vendor/ocr/', location.href).href;
        return Tesseract.createWorker('por', 1, { workerPath: base + 'worker.min.js', corePath: base + 'core', langPath: base + 'lang', gzip: true,
          logger: function (m) { if (m.status === 'recognizing text') status('Lendo o print… ' + Math.round(m.progress * 100) + '%'); else status('Preparando leitor de print…'); } });
      });
    ocrP.catch(function () { ocrP = null; });
    return ocrP;
  }
  A.lerPrint = function (file) {
    status('Preparando leitor de print…');
    carregarOcr().then(function (w) { return w.recognize(file); }).then(function (r) {
      var t = (r.data.text || '').replace(/\n{3,}/g, '\n\n').trim();
      status(''); if (!t) { A.toast('Não achei texto no print'); return; }
      A.analisarTexto(t, true); A.toast('Texto do print lido');
    }).catch(function () { status(A.X('não foi possível ler o print neste aparelho')); });
  };
  A.importarConversa = function (file) {
    status('Lendo a conversa…');
    A.lerConversa(file).then(function (cv) {
      status('');
      if (!cv.msgs.length) { A.toast('Não reconheci o formato da conversa'); return; }
      var doCliente = cv.msgs.filter(function (m) { return m.autor === cv.cliente; }).slice(-40);
      var o = A.sheet('Conversa: ' + cv.nome, '<p class="lead">' + cv.msgs.length + ' mensagens · ' + cv.autores.length + ' pessoas. As últimas ' + doCliente.length + ' mensagens de <b>' + A.esc(cv.cliente) + '</b> vão para a análise.</p>' +
        '<div class="fld"><label class="f">Quem é o cliente nesta conversa?</label><select class="inp" id="qc">' + cv.autores.map(function (x) { return '<option' + (x === cv.cliente ? ' selected' : '') + '>' + A.esc(x) + '</option>'; }).join('') + '</select></div>' +
        '<div class="switch"><span>Guardar a conversa na pasta do cliente</span><input type="checkbox" id="gc" checked></div>' +
        '<div class="btns"><button class="btn p" id="ok">Analisar</button></div>');
      A.$('#ok', o.el).addEventListener('click', function () {
        var quem = A.$('#qc', o.el).value, guardar = A.$('#gc', o.el).checked;
        var msgs = cv.msgs.filter(function (m) { return m.autor === quem; }).slice(-40);
        o.close();
        A.analisarTexto(msgs.map(function (m) { return m.txt; }).join('\n'));
        if (guardar) A.vincularConversa(quem, cv);
      });
    }).catch(function () { status(''); A.toast('Não consegui abrir esse arquivo'); });
  };
  A.vincularConversa = function (quem, cv) {
    var tel = /\d{8}/.test(quem.replace(/\D/g, '')) ? quem.replace(/\D/g, '') : '';
    var c = A.S.clientes.filter(function (x) { return (tel && A.telLimpo(x.tel) === A.telLimpo(tel)) || A.norm(x.nome) === A.norm(quem); })[0];
    function guardar(c) {
      var p = c.pessoas[0];
      var txt = cv.msgs.slice(-300).map(function (m) { return m.data + ' ' + m.hora + ' · ' + m.autor + ': ' + m.txt; }).join('\n');
      p.conversas.unshift({ id: A.uid(), data: new Date().toISOString().slice(0, 16), txt: txt, importada: true });
      c.eventos.unshift({ data: new Date().toISOString().slice(0, 16), txt: 'Conversa do WhatsApp importada (' + cv.msgs.length + ' mensagens)' });
      AT().cliente = c.id; A.save(); A.render(); A.toast('Conversa guardada na pasta de ' + c.nome);
    }
    if (c) guardar(c);
    else A.novoCliente({ nome: tel ? '' : quem, tel: tel }, function (nc) { guardar(nc); });
  };

  A.telas.atender = { html: html, init: init };
})();
