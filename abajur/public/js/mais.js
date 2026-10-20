/* Mais: catálogo de fotos, respostas rápidas, textos e pagamentos, etiquetas, ateliê e timbre, gestos, tema, dados e pendências. */
(function () {
  'use strict';
  var $ = A.$, $$ = A.$$;

  A.PENDENCIAS = function () {
    var p = [];
    if (/PROVISÓRIO/.test(A.LOGO_SRC || '')) p.push(['Logo do Abajur', 'abajur_logo.jpg não chegou ao ambiente; o ícone atual é provisório. Rodar ferramentas/vetorizar-logo.sh quando o arquivo estiver na pasta.']);
    if (!A.carga || !A.carga.hashes) p.push(['Hashes da carga inicial', 'A carga tem as 65 categorias e os 735 nomes, sem hashes. Rodar ferramentas/gerar-carga.html no computador do Lucas (pasta Santos) e importar em Ativação inicial; até lá o celular calcula os hashes sozinho.']);
    if (!A.F.length) p.push(['Pasta Santos no celular', 'Ler uma vez em Mais › Ativação inicial.']);
    if (A.F.length && !A.S.cfg.imaCalibrado) p.push(['Calibrar o ímã', 'Com as fotos reais lidas: Ativação inicial › Ímã › Calibrar.']);
    if (!A.S.atelie.logo) p.push(['Logo do ateliê Osmundo (timbre do PDF)', 'Enviar em Mais › Ateliê e timbre.']);
    if (A.S.itens.some(function (e) { return e.exemplo; })) p.push(['Tabela de preços e tamanhos', 'Preços de exemplo; ajustar em Catálogo.']);
    if (A.S.textos.some(function (e) { return e.exemplo; }) || A.S.respostas.some(function (e) { return e.exemplo; })) p.push(['Textos fixos e respostas rápidas', 'Textos de exemplo; ajustar aqui em Mais.']);
    if (A.S.cfg.pessoas.indexOf('Ela') > -1) p.push(['Nome da assistente', 'Aparece como "Ela" nos lembretes.']);
    if (A.S.clientes.some(function (c) { return c.exemplo; })) p.push(['Dados de exemplo', 'Clientes, caixinhas e evento de exemplo; apagar em Dados e backup.']);
    return p;
  };

  function html() {
    var h = A.topo('Mais', 'Catálogo, textos e configurações');
    var n = 0, pend = A.PENDENCIAS();
    h += A.secao(++n, 'Pendências', pend.length ? pend.map(function (x) { return '<div class="xbox"><b>X ' + A.esc(x[0]) + '</b><br>' + A.esc(x[1]) + '</div>'; }).join('') : '<div class="empty">Nada pendente.</div>', { ct: pend.length, aberta: pend.length > 0 });
    h += '<button class="card row" data-go="ativacao" style="width:100%;text-align:left"><span class="ico" style="width:34px;height:34px;border-radius:10px;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center">' + A.ic('zap') + '</span><span class="grow"><b>Ativação inicial e ímã</b><br><small class="lead">' + (A.S.cfg.ativado ? 'concluída' : 'pendente') + ' · carga, pasta Santos, uniões, grupos, calibração</small></span>' + A.ic('chev') + '</button>';
    h += '<button class="card row" data-go="catalogo" style="width:100%;text-align:left"><span class="ico" style="width:34px;height:34px;border-radius:10px;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center">' + A.ic('image') + '</span><span class="grow"><b>Catálogo e fotos</b><br><small class="lead">' + A.S.itens.length + ' itens · ' + (A.F.length || 'sem') + ' fotos' + (A.S.cfg.pastaNome ? ' · pasta ' + A.esc(A.S.cfg.pastaNome) : '') + '</small></span>' + A.ic('chev') + '</button>';
    h += A.secao(++n, 'Respostas rápidas', A.S.respostas.map(function (r) { return '<button class="ev" data-rr="' + r.id + '"><span class="bar" style="background:var(--accent-bg)"></span><span class="grow"><b>' + A.esc(r.titulo) + '</b>' + (r.exemplo ? ' <span class="tag wa">exemplo</span>' : '') + '<br><small class="lead">' + A.esc(r.txt.slice(0, 90)) + '</small></span><span class="ib" data-cp="' + r.id + '" role="button" aria-label="Copiar">' + A.ic('copy') + '</span></button>'; }).join('') + '<p class="lead">Nova resposta: + Novo › Resposta rápida.</p>', { ct: A.S.respostas.length });
    h += A.secao(++n, 'Textos fixos do orçamento', '<p class="lead">Ligados por padrão entram em todo orçamento novo.</p>' + A.S.textos.map(function (t) { return '<div class="card row"><div class="grow" data-tx="' + t.id + '" style="cursor:pointer"><b>' + A.esc(t.titulo) + '</b>' + (t.exemplo ? ' <span class="tag wa">exemplo</span>' : '') + '<br><small class="lead">' + A.esc(t.txt) + '</small></div><input type="checkbox" data-txon="' + t.id + '"' + (t.on ? ' checked' : '') + ' aria-label="Ligado por padrão"></div>'; }).join(''), { ct: A.S.textos.length });
    h += A.secao(++n, 'Formas de pagamento', A.S.pagamentos.map(function (p) { return '<div class="card row"><span class="grow">' + A.esc(p.txt) + '</span><input type="checkbox" data-pgon="' + p.id + '"' + (p.on ? ' checked' : '') + ' aria-label="Ligada por padrão"><button class="ib" data-pgdel="' + p.id + '" aria-label="Excluir">' + A.ic('trash') + '</button></div>'; }).join(''), { ct: A.S.pagamentos.length });
    h += A.secao(++n, 'Etiquetas de foto', '<div class="chips">' + A.S.etiquetas.map(function (t) { return '<button class="chip" data-etq="' + A.esc(t) + '">' + A.esc(t) + ' ' + A.ic('x') + '</button>'; }).join('') + '</div><p class="lead">Toque para excluir. Nova: + Novo › Etiqueta de foto.</p>', { ct: A.S.etiquetas.length });
    var at = A.S.atelie;
    h += A.secao(++n, 'Ateliê e timbre', '<div class="card">' +
      '<div class="row" style="margin-bottom:10px">' + (at.logo ? '<img alt="Logo do ateliê" src="' + at.logo + '" style="height:56px;border-radius:8px;background:#fff;padding:4px">' : A.X('logo do ateliê')) + '<span class="grow"></span><button class="btn sm" data-logo>' + A.ic('image') + (at.logo ? 'Trocar' : 'Enviar logo') + '</button>' + (at.logo ? '<button class="btn sm d" data-logorm>Tirar</button>' : '') + '</div>' +
      [['nome', 'Nome do ateliê'], ['slogan', 'Frase do timbre'], ['tel', 'Telefone'], ['cidade', 'Cidade'], ['instagram', 'Instagram'], ['assinatura', 'Assinatura no PDF']].map(function (f) { return '<div class="fld"><label class="f">' + f[1] + '</label><input class="inp" data-at="' + f[0] + '" value="' + A.esc(at[f[0]] || '') + '"></div>'; }).join('') +
      '<div class="g2"><div class="fld"><label class="f">Quem usa (1)</label><input class="inp" data-ps="0" value="' + A.esc(A.S.cfg.pessoas[0] || '') + '"></div><div class="fld"><label class="f">Quem usa (2)</label><input class="inp" data-ps="1" value="' + A.esc(A.S.cfg.pessoas[1] || '') + '"></div></div>' +
      '<div class="g3"><div class="fld"><label class="f">Prazo padrão (dias)</label><input class="inp" type="number" data-cfg="prazo" value="' + A.S.cfg.prazo + '"></div><div class="fld"><label class="f">Sinal (%)</label><input class="inp" type="number" data-cfg="sinal" value="' + A.S.cfg.sinal + '"></div><div class="fld"><label class="f">Validade (dias)</label><input class="inp" type="number" data-cfg="validade" value="' + A.S.cfg.validade + '"></div></div></div>');
    var g = A.S.cfg.gestos;
    function gs(lado) { return '<div class="chips" data-lado="' + lado + '">' + Object.keys(A.ACOES).map(function (k) { var i = g[lado].indexOf(k); return '<button class="chip" data-ac="' + k + '" aria-pressed="' + (i > -1) + '">' + (i > -1 ? (i + 1) + ' · ' : '') + A.ACOES[k].t + '</button>'; }).join('') + '</div>'; }
    h += A.secao(++n, 'Gestos das caixinhas', '<p class="lead">Até 3 ações por lado, na ordem em que forem tocadas.</p><label class="f">Deslizar para a direita</label>' + gs('dir') + '<label class="f">Deslizar para a esquerda</label>' + gs('esq'));
    h += A.secao(++n, 'Tema', '<div class="chips" id="tm">' + [['auto', 'Seguir o celular'], ['claro', 'Claro'], ['escuro', 'Escuro']].map(function (x) { return '<button class="chip" data-tm="' + x[0] + '" aria-pressed="' + (A.S.cfg.tema === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>');
    h += A.secao(++n, 'Dados e backup', '<p class="lead">Tudo fica no aparelho. O backup é um arquivo .json: salve na pasta do OneDrive ou do Syncthing.</p>' +
      '<div class="btns"><button class="btn" data-exp>' + A.ic('save') + 'Exportar backup</button><button class="btn" data-imp>' + A.ic('share') + 'Importar backup</button></div>' +
      '<div class="btns"><button class="btn d" data-limpex>Apagar dados de exemplo</button></div><div class="btns"><button class="btn d" data-zerar>Apagar tudo</button></div>');
    h += A.secao(++n, 'Sobre', '<div class="card row">' + A.logo() + '<div class="grow"><b>Abajur</b> · versão E1 (protótipo)<br><small class="lead">Código aberto, sem custo, tudo no aparelho. pdf-lib (MIT), Tesseract.js (Apache-2.0), fonte Figtree (OFL).</small></div></div>');
    return h;
  }
  function init(v) {
    v.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-go]'))) return A.ir(b.getAttribute('data-go'));
      if ((b = e.target.closest('[data-cp]'))) { e.stopPropagation(); var r = A.S.respostas.filter(function (x) { return x.id === b.getAttribute('data-cp'); })[0]; A.copiar(A.vars(r.txt), 'Copiado'); return; }
      if ((b = e.target.closest('[data-rr]'))) return A.editarTexto('respostas', b.getAttribute('data-rr'));
      if ((b = e.target.closest('[data-tx]'))) return A.editarTexto('textos', b.getAttribute('data-tx'));
      if ((b = e.target.closest('[data-pgdel]'))) { var id = b.getAttribute('data-pgdel'); A.S.pagamentos = A.S.pagamentos.filter(function (p) { return p.id !== id; }); A.save(); A.render(); return; }
      if ((b = e.target.closest('[data-etq]'))) { var t = b.getAttribute('data-etq'); A.confirmar('Excluir a etiqueta "' + t + '"?', function () { A.S.etiquetas.splice(A.S.etiquetas.indexOf(t), 1); A.save(); A.render(); }, 'Excluir'); return; }
      if (e.target.closest('[data-logo]')) return enviarLogo();
      if (e.target.closest('[data-logorm]')) { A.S.atelie.logo = null; A.save(); A.render(); return; }
      if ((b = e.target.closest('[data-lado] [data-ac]'))) {
        var lado = b.parentElement.getAttribute('data-lado'), k = b.getAttribute('data-ac'), l = A.S.cfg.gestos[lado], i = l.indexOf(k);
        if (i > -1) l.splice(i, 1); else { if (l.length >= 3) { A.toast('No máximo 3 por lado'); return; } l.push(k); }
        A.save(); A.render(); return;
      }
      if ((b = e.target.closest('[data-tm]'))) { A.S.cfg.tema = b.getAttribute('data-tm'); A.save(); A.aplicarTema(); A.render(); return; }
      if (e.target.closest('[data-exp]')) return exportar();
      if (e.target.closest('[data-imp]')) return importar();
      if (e.target.closest('[data-limpex]')) return A.confirmar('Apagar clientes, caixinhas e evento de exemplo?', function () {
        A.S.clientes = A.S.clientes.filter(function (c) { return !c.exemplo; });
        A.S.cx = A.S.cx.filter(function (x) { return !/\(EXEMPLO\)/.test(x.titulo); });
        A.S.eventos = A.S.eventos.filter(function (x) { return !/\(EXEMPLO\)/.test(x.titulo); });
        A.S.orcamentos = A.S.orcamentos.filter(function (o) { return A.cliente(o.cliente) || !o.cliente; });
        A.save(); A.render(); A.toast('Exemplos apagados');
      }, 'Apagar');
      if (e.target.closest('[data-zerar]')) return A.confirmar('Apagar TUDO deste aparelho? Exporte o backup antes.', function () {
        A.S = A.semente(); A.S.clientes = []; A.S.cx = []; A.S.eventos = []; A.fotoClear(); A.F = []; A.save(); A.render(); A.toast('Tudo apagado');
      }, 'Apagar tudo');
    });
    v.addEventListener('change', function (e) {
      var t = e.target, id;
      if ((id = t.getAttribute('data-txon'))) { A.S.textos.filter(function (x) { return x.id === id; })[0].on = t.checked; A.save(); }
      if ((id = t.getAttribute('data-pgon'))) { A.S.pagamentos.filter(function (x) { return x.id === id; })[0].on = t.checked; A.save(); }
    });
    v.addEventListener('input', function (e) {
      var t = e.target, f;
      if ((f = t.getAttribute('data-at'))) { A.S.atelie[f] = f === 'tel' ? t.value.replace(/\D/g, '') : t.value; A.save(); }
      if ((f = t.getAttribute('data-ps')) != null) { A.S.cfg.pessoas[+f] = t.value.trim() || (+f ? 'Ela' : 'Lucas'); A.S.cx.forEach(function () {}); A.save(); }
      if ((f = t.getAttribute('data-cfg'))) { A.S.cfg[f] = parseInt(t.value, 10) || A.S.cfg[f]; A.save(); }
    });
  }
  function enviarLogo() {
    var i = document.createElement('input'); i.type = 'file'; i.accept = 'image/png,image/jpeg';
    i.addEventListener('change', function () {
      var f = i.files && i.files[0]; if (!f) return;
      var img = new Image();
      img.onload = function () {
        var k = Math.min(1, 600 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        A.S.atelie.logo = c.toDataURL('image/png'); A.save(); A.render(); A.toast('Logo salvo');
      };
      img.src = URL.createObjectURL(f);
    });
    i.click();
  }
  function exportar() {
    var dados = JSON.stringify({ app: 'abajur', v: 1, data: new Date().toISOString(), estado: A.S, fotos: A.F }, null, 1);
    var f = new File([dados], 'abajur-backup-' + A.hoje() + '.json', { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: f.name }).catch(function () { A.baixar(f); });
    else A.baixar(f);
  }
  function importar() {
    var i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json';
    i.addEventListener('change', function () {
      var f = i.files && i.files[0]; if (!f) return;
      f.text().then(function (t) {
        var d = JSON.parse(t); if (d.app !== 'abajur' || !d.estado) throw new Error('arquivo');
        A.confirmar('Substituir os dados deste aparelho pelo backup de ' + A.dataBR(String(d.data).slice(0, 10)) + '?', function () {
          A.S = A.migrar(d.estado); A.save(); A.aplicarTema(); A.ir('inicio'); A.toast('Backup importado. Escolha a pasta de fotos de novo para as miniaturas.');
        }, 'Importar');
      }).catch(function () { A.toast('Arquivo de backup inválido'); });
    });
    i.click();
  }

  /* ---------- catálogo ---------- */
  var cbusca = '';
  function htmlCat() {
    var h = A.topo('Catálogo', A.S.itens.length + ' itens · ' + (A.F.length ? A.F.length + ' fotos' : 'fotos de exemplo'), '', true);
    h += '<div class="btns" style="margin-top:0"><button class="btn p" data-pasta>' + A.ic('folder') + (A.S.cfg.pastaNome ? 'Atualizar pasta' : 'Escolher pasta de fotos') + '</button></div>';
    h += '<p class="lead">Uma categoria por subpasta da pasta Santos; grupos editáveis. O app guarda só índice, hashes e miniaturas; as fotos continuam na pasta do celular.' + (A.S.cfg.pastaNome ? ' Pasta atual: <b>' + A.esc(A.S.cfg.pastaNome) + '</b>.' : '') + '</p>';
    h += '<input class="inp" id="kq" placeholder="Buscar santo ou sinônimo" value="' + A.esc(cbusca) + '" style="margin-bottom:10px"><div id="kl"></div>';
    return h;
  }
  function initCat(v) {
    function r() {
      var q = A.norm(cbusca.trim()), h = '', n = 0;
      A.S.grupos.forEach(function (g) {
        var l = A.S.itens.filter(function (e) { return !e.fora && e.grupo === g.nome && (!q || A.norm(e.nome).indexOf(q) > -1 || e.syn.some(function (s) { return s.indexOf(q) > -1; })); });
        if (!l.length && q) return;
        n++;
        var corpo = l.map(function (e, i) {
          var fs = A.fotosDo(e.id), f0 = fs[0], real = A.F.some(function (f) { return f.item === e.id; });
          return '<button class="card row" data-k="' + A.esc(e.id) + '" style="width:100%;text-align:left"><span class="num" style="font-family:var(--mono);font-size:11.5px;color:var(--mut);min-width:28px">' + n + '.' + (i + 1) + '</span>' +
            (f0 ? '<img alt="" src="' + A.fotoUrl(f0) + '" style="width:40px;height:46px;object-fit:cover;border-radius:7px">' : '') +
            '<span class="grow"><b>' + A.esc(e.nome) + '</b><br><small class="lead">' + A.esc(e.syn.slice(0, 4).join(', ')) + '</small></span>' +
            '<span class="tag ' + (real ? 'ok' : 'wa') + '">' + (real ? fs.length + ' fotos' : (e.n ? e.n + ' na carga' : 'exemplo')) + '</span></button>';
        }).join('') || '<div class="empty">Sem itens.</div>';
        h += A.secao(n, g.nome, corpo, { ct: l.length, aberta: !!q, more: '<span class="more" role="button" tabindex="0" data-g="' + A.esc(g.nome) + '" aria-label="Opções do grupo">' + A.ic('dots') + '</span>' });
      });
      var fora = A.S.itens.filter(function (e) { return e.fora; });
      if (fora.length && !q) h += A.secao(++n, A.GRUPO_FORA, fora.map(function (e) { return '<button class="card row" data-k="' + A.esc(e.id) + '" style="width:100%;text-align:left"><span class="grow"><b>' + A.esc(e.nome) + '</b><br><small class="lead">até confirmação · incluir em Ativação inicial</small></span><span class="tag">' + (e.n || 0) + '</span></button>'; }).join(''), { ct: fora.length });
      $('#kl', v).innerHTML = h || '<div class="empty">Nada encontrado.</div>';
    }
    $('#kq', v).addEventListener('input', function (e) { cbusca = e.target.value; r(); });
    v.addEventListener('click', function (e) {
      var g = e.target.closest('[data-g]');
      if (g) { e.stopPropagation(); menuGrupo(g.getAttribute('data-g')); return; }
      if (e.target.closest('[data-pasta]')) return A.escolherPasta(!!A.S.cfg.pastaNome);
      var k = e.target.closest('[data-k]'); if (k) verItem(k.getAttribute('data-k'));
    }, true);
    r();
  }
  function menuGrupo(nome) {
    var g = A.S.grupos.filter(function (x) { return x.nome === nome; })[0];
    A.menu(nome, [
      { t: 'Renomear grupo', ic: 'edit', fn: function () { A.pedirTexto('Nome do grupo', nome, function (n) { A.S.itens.forEach(function (e) { if (e.grupo === nome) e.grupo = n; }); g.nome = n; A.save(); A.render(); }); } },
      { t: 'Palavras que abrem o grupo inteiro', s: g.termos.join(', ') || 'nenhuma', ic: 'book', fn: function () { A.pedirTexto('Palavras (separe por vírgula)', g.termos.join(', '), function (t) { g.termos = t.split(',').map(function (s) { return A.norm(s.trim()); }).filter(Boolean); A.save(); A.render(); }, 'ex.: santo, santos'); } },
      { t: 'Excluir grupo vazio', ic: 'trash', d: 1, fn: function () { if (A.S.itens.some(function (e) { return e.grupo === nome; })) { A.toast('O grupo ainda tem itens'); return; } A.S.grupos.splice(A.S.grupos.indexOf(g), 1); A.save(); A.render(); } }
    ]);
  }
  function verItem(id) {
    var e = A.item(id), fs = A.fotosDo(id);
    var h = '<div class="row" style="margin-bottom:8px"><span class="grow lead" style="margin:0">' + A.esc(e.grupo) + ((e.pastas || []).filter(Boolean).length ? ' · pasta ' + A.esc(e.pastas.join(', ')) : '') + '</span><button class="btn sm" data-ed>' + A.ic('edit') + 'Editar</button></div>' +
      '<div class="card"><div class="h4" style="margin-top:0">Tamanhos e preços</div>' + (A.tamanhos(e).length ? A.tamanhos(e).map(function (t) { return '<div class="tot"><span>' + t + ' cm</span><span>' + A.brl(e.precos[t]) + '</span></div>'; }).join('') : A.X('sem preços cadastrados')) +
      '<div class="h4">Reconhece</div><div class="chips">' + e.syn.map(function (s) { return '<span class="chip">' + A.esc(s) + '</span>'; }).join('') + '</div></div>' +
      '<div class="h4">Fotos (toque para etiquetar)</div><div class="pgrid">' + fs.map(function (f) { return A.fotoHTML(f, false); }).join('') + '</div>';
    var o = A.sheet(e.nome, h);
    o.sc.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-ed]')) { o.close(); setTimeout(function () { A.editarItem(id); }, 380); return; }
      var p = ev.target.closest('[data-p]'); if (p) A.abrirFoto(p.getAttribute('data-p'));
    });
  }

  A.telas.mais = { html: html, init: init };
  A.telas.catalogo = { html: htmlCat, init: initCat, aba: 'mais' };
})();
