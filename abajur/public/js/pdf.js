/* PDF do orçamento: tela de cadastro/ajuste antes de gerar; modelo refinado (timbre, fotos, tabela) ou simples; compartilhar. */
(function () {
  'use strict';
  var $ = A.$;
  var WIN = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
  function san(s) {
    return String(s == null ? '' : s).replace(/−/g, '-').replace(/[•●]/g, '•').replace(/\t/g, ' ').split('').filter(function (c) {
      var n = c.charCodeAt(0); return (n >= 32 && n <= 126) || (n >= 160 && n <= 255) || WIN.indexOf(c) > -1 || c === '\n';
    }).join('');
  }

  /* ---------- tela de ajuste ---------- */
  A.ajustePdf = function () {
    var a = A.S.rascunho; if (!a) return;
    if (!A.chavesAt().length) { A.toast('Sem peças no orçamento'); return; }
    var c = A.cliente(a.cliente);
    var h = '<p class="lead">Confira e ajuste antes de gerar. Tudo aqui atualiza o orçamento.</p>';
    h += A.secao('1', 'Cliente', '<div class="card">' + (c ?
      '<div class="row" style="margin-bottom:8px"><b class="grow">' + A.esc(c.nome) + '</b><span class="code">' + c.codigo + '</span><button class="btn sm" id="trc">Trocar</button></div>' +
      '<div class="g2"><div class="fld"><label class="f">Nome no PDF</label><input class="inp" data-c="nome" value="' + A.esc(c.nome) + '"></div><div class="fld"><label class="f">Telefone</label><input class="inp" data-c="tel" inputmode="tel" value="' + A.esc(A.telBR(c.tel)) + '"></div></div>' +
      '<div class="fld"><label class="f">Cidade</label><input class="inp" data-c="cidade" value="' + A.esc(c.cidade || '') + '"></div>'
      : '<button class="btn full" id="trc">' + A.ic('users') + 'Vincular cliente</button>') + '</div>', { aberta: true });
    h += A.secao('2', 'Orçamento', '<div class="card"><div class="g3"><div class="fld"><label class="f">Número</label><input class="inp" id="pnum" value="' + A.esc(A.numeroAt()) + '"></div><div class="fld"><label class="f">Validade (dias)</label><input class="inp" type="number" id="pval" value="' + (a.validade || A.S.cfg.validade) + '"></div><div class="fld"><label class="f">Prazo (dias)</label><input class="inp" type="number" id="ppz" value="' + a.prazo + '"></div></div>' +
      '<label class="f">Modelo</label><div class="chips" id="pmod"><button class="chip" data-m="refinado">Refinado, com fotos</button><button class="chip" data-m="simples">Simples, só tabela</button></div>' +
      '<label class="f">Fotos por linha</label><div class="chips" id="plin"><button class="chip" data-l="3">3</button><button class="chip" data-l="2">2</button><button class="chip" data-l="1">1</button></div>' +
      '<div class="fld"><label class="f">Observações no PDF</label><textarea class="inp" id="pobs" style="min-height:60px">' + A.esc(a.obs || '') + '</textarea></div></div>', { aberta: true });
    h += A.secao('3', 'Peças, descontos e total', '<div id="plns"></div><div class="card"><div class="g2"><div><label class="f"><span class="pc">%</span> Desconto geral</label><input class="inp" type="number" id="pdg" step="any" inputmode="decimal"></div><div><label class="f">Total final (R$)</label><input class="inp" type="number" id="ptf" step="any" inputmode="decimal"></div></div><div id="ptot" style="margin-top:8px"></div></div>', { aberta: true });
    h += A.secao('4', 'Timbre do ateliê', '<div class="card">' + (A.S.atelie.logo ? '<div class="row"><img alt="" src="' + A.S.atelie.logo + '" style="height:44px;border-radius:6px;background:#fff;padding:3px"><b class="grow">' + A.esc(A.S.atelie.nome) + '</b></div>' :
      '<div class="xbox"><b>X</b> Logo do ateliê Osmundo ainda não recebido. O PDF sai só com o nome. Envie em Mais › Ateliê e timbre.</div>') + '</div>');
    h += '<div class="btns"><button class="btn p" id="gerar">' + A.ic('pdf') + 'Gerar PDF</button></div><div id="pres"></div>';
    var o = A.sheet('PDF do orçamento', h);
    var v = o.sc;
    function rMod() {
      A.$$('#pmod .chip', v).forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-m') === a.modelo); });
      A.$$('#plin .chip', v).forEach(function (b) { b.setAttribute('aria-pressed', +b.getAttribute('data-l') === +a.fotosLinha); });
    }
    function rLns() {
      $('#plns', v).innerHTML = A.chavesAt().map(function (k) {
        var l = a.L[k], e = A.item(k);
        return '<div class="line" data-k="' + A.esc(k) + '"><div class="nm"><span class="grow">' + A.esc(e.nome) + '</span><span class="tag">' + (l.tam ? l.tam + ' cm' : '') + (l.qtd > 1 ? ' · ' + l.qtd + 'x' : '') + '</span></div><div class="f">' +
          '<div class="s2"><label>Valor (R$)</label><input class="inp" type="number" data-f="valor" value="' + A.r2(A.baseAt(k)) + '" step="any" inputmode="decimal"></div>' +
          '<div class="s2"><label><span class="pc">%</span> Desc.</label><input class="inp" type="number" data-f="desc" value="' + A.r2(l.desc || 0) + '" step="any" inputmode="decimal"></div>' +
          '<div class="s2"><label>Final (R$)</label><input class="inp" type="number" data-f="final" value="' + A.r2(A.finAt(k)) + '" step="any" inputmode="decimal"></div></div></div>';
      }).join('');
      rTot();
    }
    function rTot() {
      var t = A.totaisAtendimento();
      $('#ptot', v).innerHTML = '<div class="tot"><span>Subtotal</span><span>' + A.brl(t.sub) + '</span></div>' + (t.id > 0.004 ? '<div class="tot"><span>Descontos por peça</span><span>− ' + A.brl(t.id) + '</span></div>' : '') +
        '<div class="tot"><span>Desconto geral (' + A.pct(a.descGeral || 0) + ')</span><span>− ' + A.brl(t.gd) + '</span></div><div class="tot big"><span>Total</span><span>' + A.brl(t.tot) + '</span></div>' +
        '<div class="tot"><span>Desconto total sobre o bruto</span><span>' + A.pct(t.ef) + '</span></div><div class="tot"><span>Sinal de ' + A.S.cfg.sinal + '%</span><span>' + A.brl(t.sinal) + '</span></div>';
      var f = $('#ptf', v); if (document.activeElement !== f) f.value = A.r2(t.tot);
      var d = $('#pdg', v); if (document.activeElement !== d) d.value = A.r2(a.descGeral || 0);
      A.save(); if (A.atualizarAtender) A.atualizarAtender();
    }
    function sync(ln, k, skip) {
      [['valor', A.r2(A.baseAt(k))], ['desc', A.r2(a.L[k].desc || 0)], ['final', A.r2(A.finAt(k))]].forEach(function (x) { if (x[0] === skip) return; var el = A.$('[data-f="' + x[0] + '"]', ln); if (el && document.activeElement !== el) el.value = x[1]; });
    }
    v.addEventListener('input', function (e) {
      var t = e.target;
      if (t.hasAttribute('data-c')) { var cc = A.cliente(a.cliente); if (cc) { var f0 = t.getAttribute('data-c'); cc[f0] = f0 === 'tel' ? t.value.replace(/\D/g, '') : t.value; A.save(); } return; }
      if (t.id === 'pnum') { a.num = t.value.trim() || null; A.save(); return; }
      if (t.id === 'pval') { a.validade = parseInt(t.value, 10) || A.S.cfg.validade; A.save(); return; }
      if (t.id === 'ppz') { a.prazo = parseInt(t.value, 10) || 1; rTot(); return; }
      if (t.id === 'pobs') { a.obs = t.value; A.save(); return; }
      if (t.id === 'pdg') { a.descGeral = Math.max(0, Math.min(100, parseFloat(t.value) || 0)); rTot(); return; }
      if (t.id === 'ptf') { var t0 = A.totaisAtendimento(), tv = parseFloat(t.value) || 0; a.descGeral = t0.aft > 0 ? Math.max(0, Math.min(100, (1 - tv / t0.aft) * 100)) : 0; rTot(); return; }
      var ln = t.closest('.line'); if (!ln) return;
      var k = ln.getAttribute('data-k'), f = t.getAttribute('data-f'), l = a.L[k];
      if (f === 'valor') { l.over = parseFloat(t.value) || 0; }
      else if (f === 'desc') { l.desc = Math.max(0, Math.min(100, parseFloat(t.value) || 0)); }
      else if (f === 'final') { var bb = A.baseAt(k), fv = parseFloat(t.value) || 0; l.desc = bb > 0 ? Math.max(0, Math.min(100, (1 - fv / bb) * 100)) : 0; }
      sync(ln, k, f); rTot();
    });
    v.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-m')) { a.modelo = b.getAttribute('data-m'); rMod(); A.save(); return; }
      if (b.hasAttribute('data-l')) { a.fotosLinha = +b.getAttribute('data-l'); rMod(); A.save(); return; }
      if (b.id === 'trc') { A.escolherCliente(function (id) { a.cliente = id; A.save(); o.close(); setTimeout(A.ajustePdf, 420); }); return; }
      if (b.id === 'gerar') {
        b.disabled = true; b.textContent = 'Gerando…';
        A.salvarOrcamento(true);
        A.gerarPdf().then(function (file) {
          b.disabled = false; b.innerHTML = A.ic('pdf') + 'Gerar de novo';
          A._ultimoPdf = file;
          $('#pres', v).innerHTML = '<div class="card" style="margin-top:10px"><div class="row"><span class="ico" style="width:34px;height:34px;border-radius:10px;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center">' + A.ic('pdf') + '</span><div class="grow"><b>' + A.esc(file.name) + '</b><br><small class="lead">' + Math.round(file.size / 1024) + ' KB</small></div></div>' +
            '<div class="btns"><button class="btn p" id="psh">' + A.ic('share') + 'Compartilhar PDF</button><button class="btn" id="pdl">' + A.ic('save') + 'Baixar</button></div><div class="btns"><button class="btn" id="pcp">' + A.ic('copy') + 'Copiar texto</button></div></div>';
          $('#pres', v).scrollIntoView({ behavior: 'smooth', block: 'end' });
        }).catch(function (er) { b.disabled = false; b.innerHTML = A.ic('pdf') + 'Gerar PDF'; A.toast('Erro ao gerar o PDF'); console.error(er); });
        return;
      }
      if (b.id === 'psh') { A.compartilhar(A._ultimoPdf); return; }
      if (b.id === 'pdl') { A.baixar(A._ultimoPdf); return; }
      if (b.id === 'pcp') { A.copiar(A.textoOrcamento(), 'Texto copiado'); return; }
    });
    rMod(); rLns();
  };
  A.compartilhar = function (file) {
    if (!file) return;
    if (navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], title: file.name }).catch(function () {});
    else { A.baixar(file); A.toast('Compartilhamento indisponível: PDF baixado'); }
  };
  A.baixar = function (file) {
    var u = URL.createObjectURL(file), l = document.createElement('a'); l.href = u; l.download = file.name; document.body.appendChild(l); l.click(); l.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
  };

  /* ---------- geração ---------- */
  A.gerarPdf = function () {
    var L = window.PDFLib, a = A.S.rascunho, t = A.totaisAtendimento(), c = A.cliente(a.cliente), at = A.S.atelie;
    var refinado = a.modelo !== 'simples';
    var doc, F = {}, pg, W = 595.28, H = 841.89, M = 46, y;
    var INK = L.rgb(0.12, 0.11, 0.14), MUT = L.rgb(0.42, 0.41, 0.45), GOLD = L.rgb(0.66, 0.53, 0.35), LINE = L.rgb(0.85, 0.83, 0.80), SOFT = L.rgb(0.965, 0.957, 0.945);
    function txt(s, x, yy, f, sz, cor) { pg.drawText(san(s), { x: x, y: yy, font: f, size: sz, color: cor || INK }); }
    function largura(s, f, sz) { return f.widthOfTextAtSize(san(s), sz); }
    function dir(s, xr, yy, f, sz, cor) { txt(s, xr - largura(s, f, sz), yy, f, sz, cor); }
    function quebra(s, f, sz, max) {
      var out = [];
      san(s).split('\n').forEach(function (par) {
        var w = par.split(' '), cur = '';
        w.forEach(function (p) { var n = cur ? cur + ' ' + p : p; if (largura(n, f, sz) > max && cur) { out.push(cur); cur = p; } else cur = n; });
        out.push(cur);
      });
      return out;
    }
    function novaPagina() { pg = doc.addPage([W, H]); y = H - M; }
    function cabe(h) { if (y - h < M + 30) { novaPagina(); cabecalhoCurto(); } }
    function cabecalhoCurto() { txt(at.nome, M, y - 10, F.b, 10, MUT); dir('Orçamento nº ' + A.numeroAt(), W - M, y - 10, F.r, 9, MUT); y -= 26; linha(GOLD, 0.6); y -= 14; }
    function linha(cor, esp) { pg.drawLine({ start: { x: M, y: y }, end: { x: W - M, y: y }, thickness: esp || 0.5, color: cor || LINE }); }
    var hoje = A.hoje(), val = a.validade || A.S.cfg.validade, ate = A.iso(new Date(Date.now() + val * 864e5));
    return L.PDFDocument.create().then(function (d) {
      doc = d; doc.setTitle('Orçamento ' + A.numeroAt() + ' · ' + at.nome); doc.setCreator('ATÊLI'); doc.setProducer('ATÊLI');
      return Promise.all([doc.embedFont(L.StandardFonts.Helvetica), doc.embedFont(L.StandardFonts.HelveticaBold), doc.embedFont(L.StandardFonts.HelveticaOblique), doc.embedFont(L.StandardFonts.TimesRomanItalic)]);
    }).then(function (fs) {
      F.r = fs[0]; F.b = fs[1]; F.i = fs[2]; F.s = fs[3];
      return at.logo ? (/^data:image\/png/.test(at.logo) ? doc.embedPng(at.logo) : doc.embedJpg(at.logo)).catch(function () { return null; }) : null;
    }).then(function (logo) {
      novaPagina();
      // timbre
      var x0 = M;
      if (logo) { var lh = 52, lw = logo.width * lh / logo.height; pg.drawImage(logo, { x: M, y: y - lh, width: lw, height: lh }); x0 = M + lw + 12; }
      txt(at.nome, x0, y - 18, F.b, refinado ? 19 : 16);
      if (at.slogan) txt(at.slogan, x0, y - 33, F.i, 10, MUT);
      var ct = [at.tel ? A.telBR(at.tel) : '', at.instagram ? '@' + String(at.instagram).replace(/^@/, '') : '', at.cidade].filter(Boolean).join('  ·  ');
      if (ct) txt(ct, x0, y - 46, F.r, 8.5, MUT);
      dir('ORÇAMENTO', W - M, y - 14, F.b, 10, refinado ? GOLD : INK);
      dir('Nº ' + A.numeroAt(), W - M, y - 29, F.b, 13);
      dir('Data ' + A.dataBR(hoje) + '   Válido até ' + A.dataBR(ate), W - M, y - 43, F.r, 8.5, MUT);
      y -= 62; linha(refinado ? GOLD : LINE, refinado ? 1 : 0.6); y -= 18;
      // cliente
      if (c) {
        txt('CLIENTE', M, y, F.b, 8, MUT);
        txt(c.nome.replace(/\s*\(EXEMPLO\)/, ''), M, y - 15, F.b, 12);
        var cd = ['Código ' + c.codigo, c.tel ? A.telBR(c.tel) : '', c.cidade].filter(Boolean).join('   ·   ');
        txt(cd, M, y - 29, F.r, 9, MUT);
        y -= 46;
      }
      // fotos
      var ids = a.comFotos !== false && refinado ? Object.keys(a.sel).filter(function (k) { return a.sel[k]; }) : [];
      return Promise.all(ids.map(function (id) { var f = A.fotoPorId(id); return A.fotoBytes(f).then(function (b) { return b ? { f: f, b: b } : null; }); }));
    }).then(function (fts) {
      fts = fts.filter(Boolean);
      return Promise.all(fts.map(function (x) { return doc.embedJpg(x.b.bytes).then(function (img) { return { f: x.f, img: img }; }).catch(function () { return null; }); }));
    }).then(function (imgs) {
      imgs = imgs.filter(Boolean);
      if (imgs.length) {
        var cols = Math.max(1, Math.min(3, +a.fotosLinha || 3)), gap = 10, cw = (W - 2 * M - gap * (cols - 1)) / cols, ch = cols === 1 ? Math.min(cw * 0.75, 380) : cw * 1.18;
        for (var i = 0; i < imgs.length; i += cols) {
          cabe(ch + 20);
          for (var j = 0; j < cols && i + j < imgs.length; j++) {
            var im = imgs[i + j], x = M + j * (cw + gap);
            pg.drawRectangle({ x: x, y: y - ch, width: cw, height: ch, color: SOFT });
            var k = Math.min(cw / im.img.width, ch / im.img.height), w = im.img.width * k, h = im.img.height * k;
            pg.drawImage(im.img, { x: x + (cw - w) / 2, y: y - ch + (ch - h) / 2, width: w, height: h });
            var cap = (A.item(im.f.item) || {}).nome || '';
            txt(cap, x, y - ch - 11, F.r, 8, MUT);
          }
          y -= ch + 22;
        }
        y -= 4;
      }
      // tabela
      var col = [M, M + 230, M + 278, M + 312, M + 392, W - M];
      cabe(40);
      txt('PEÇA', col[0], y, F.b, 8, MUT); txt('TAM.', col[1], y, F.b, 8, MUT); txt('QTD', col[2], y, F.b, 8, MUT);
      dir('VALOR', col[4] - 8, y, F.b, 8, MUT); txt('DESC.', col[4], y, F.b, 8, MUT); dir('FINAL', col[5], y, F.b, 8, MUT);
      y -= 7; linha(refinado ? GOLD : LINE, 0.7); y -= 14;
      t.ks.forEach(function (k) {
        var e = A.item(k), l = a.L[k], nl = quebra(e.nome, F.r, 10, col[1] - col[0] - 8);
        cabe(nl.length * 12 + 10);
        nl.forEach(function (s, i) { txt(s, col[0], y - i * 12, F.r, 10); });
        txt(l.tam ? l.tam + ' cm' : '-', col[1], y, F.r, 10); txt(String(l.qtd || 1), col[2] + 6, y, F.r, 10);
        dir(A.brl(A.baseAt(k)), col[4] - 8, y, F.r, 10, (l.desc > 0 ? MUT : INK)); txt(l.desc > 0 ? '-' + A.pct(l.desc) : '', col[4], y, F.r, 9.5, MUT);
        dir(A.brl(A.finAt(k)), col[5], y, F.b, 10);
        y -= nl.length * 12 + 4; linha(LINE, 0.4); y -= 12;
      });
      // totais
      var tl = [['Subtotal', A.brl(t.sub)]];
      if (t.id > 0.004) tl.push(['Descontos por peça', '- ' + A.brl(t.id)]);
      if (a.descGeral > 0) tl.push(['Desconto geral (' + A.pct(a.descGeral) + ')', '- ' + A.brl(t.gd)]);
      cabe(tl.length * 15 + 60);
      tl.forEach(function (r) { txt(r[0], col[3], y, F.r, 10, MUT); dir(r[1], col[5], y, F.r, 10); y -= 15; });
      y -= 2;
      if (refinado) pg.drawRectangle({ x: col[3] - 8, y: y - 9, width: W - M - col[3] + 8, height: 25, color: SOFT });
      txt('TOTAL', col[3], y, F.b, 11); dir(A.brl(t.tot), col[5] - (refinado ? 4 : 0), y, F.b, 13);
      y -= 24;
      if (t.ef > 0.004) { txt('Desconto total sobre o bruto: ' + A.pct(t.ef), col[3], y, F.r, 8.5, MUT); y -= 13; }
      var temSinal = A.S.pagamentos.some(function (p) { return a.pags[p.id] && /sinal/i.test(p.txt); });
      if (temSinal) { txt('Sinal de ' + A.S.cfg.sinal + '%: ' + A.brl(t.sinal), col[3], y, F.r, 8.5, MUT); y -= 13; }
      y -= 12;
      // condições
      var cond = ['Prazo: ' + a.prazo + ' dias após a confirmação do sinal.'];
      var pgs = A.S.pagamentos.filter(function (p) { return a.pags[p.id]; }).map(function (p) { return p.txt; });
      if (pgs.length) cond.push('Pagamento: ' + pgs.join('; ') + '.');
      A.S.textos.forEach(function (x) { if (a.txts[x.id]) cond.push(A.vars(x.txt)); });
      if (a.obs) cond.push('Observações: ' + a.obs);
      cabe(30);
      txt('CONDIÇÕES', M, y, F.b, 8, MUT); y -= 6; linha(refinado ? GOLD : LINE, 0.6); y -= 14;
      cond.forEach(function (s) {
        quebra(s, F.r, 9.5, W - 2 * M).forEach(function (ln) { cabe(14); txt(ln, M, y, F.r, 9.5); y -= 13; });
        y -= 3;
      });
      // assinatura
      if (at.assinatura) {
        cabe(54); y -= 22;
        dir(at.assinatura, W - M, y, F.s, 24, refinado ? GOLD : INK);
        y -= 8; pg.drawLine({ start: { x: W - M - 170, y: y }, end: { x: W - M, y: y }, thickness: 0.5, color: LINE }); y -= 12;
        dir(at.nome, W - M, y, F.r, 8.5, MUT);
      }
      // rodapé com numeração
      var pags = doc.getPages();
      pags.forEach(function (p, i) {
        pg = p;
        var rod = [at.nome, at.tel ? A.telBR(at.tel) : '', at.instagram ? '@' + String(at.instagram).replace(/^@/, '') : ''].filter(Boolean).join('  ·  ');
        txt(rod, M, 24, F.r, 7.5, MUT); dir('Página ' + (i + 1) + ' de ' + pags.length, W - M, 24, F.r, 7.5, MUT);
      });
      return doc.save();
    }).then(function (bytes) {
      var nome = 'Orcamento_' + A.numeroAt() + (c ? '_' + A.norm(c.nome.replace(/\s*\(EXEMPLO\)/, '')).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') : '') + '.pdf';
      return new File([bytes], nome, { type: 'application/pdf' });
    });
  };
})();
