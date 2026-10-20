/* Detecção por dicionário de sinônimos (sem IA): ignora acento e maiúscula, abreviações, 1 erro em palavras de 5+ letras,
   sinônimo mais longo primeiro, medidas em cm associadas ao item, quantidade antes do item, "santo"/"santa" sozinhos abrem o grupo. */
(function () {
  'use strict';
  var ABREV = { sto: 'santo', sta: 'santa', s: 'sao', sra: 'senhora', sr: 'senhor', nsa: 'nossa', ns: 'nossa senhora', nssa: 'nossa', n: 'nossa', sr: 'senhor', sant: 'santa', cms: 'cm', centimetro: 'cm', centimetros: 'cm', centimetos: 'cm' };
  var NUM = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10 };

  function tokens(texto) {
    var out = [], spans = [], re = /[A-Za-zÀ-ÖØ-öø-ÿ0-9]+/g, m;
    while ((m = re.exec(texto))) {
      var si = spans.length; spans.push({ a: m.index, b: m.index + m[0].length });
      A.norm(m[0]).split(/(?<=\d)(?=[a-z])|(?<=[a-z])(?=\d)/).forEach(function (p) {
        if (!p) return;
        var v = ABREV[p] || p;
        String(v).split(' ').forEach(function (w) { out.push({ t: w, raw: p, span: si }); });
      });
    }
    // "N S", "N. Sra." -> nossa senhora; o "n" sozinho só vira "nossa" antes de "s"/"sra"/"senhora"
    out.forEach(function (x, i) {
      if (x.raw !== 'n') return;
      var nx = out[i + 1];
      if (nx && nx.raw === 's') nx.t = 'senhora';
      else if (!(nx && nx.t === 'senhora')) x.t = 'n';
    });
    return { tk: out, spans: spans };
  }
  A.tokens = tokens;
  function palavras(s) { return tokens(s).tk.map(function (x) { return x.t; }); }

  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 1) return 2;
    var m = [], i, j;
    for (i = 0; i <= a.length; i++) m[i] = [i];
    for (j = 1; j <= b.length; j++) m[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++)
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return m[a.length][b.length];
  }
  function fz(a, b) { return a === b || (a.length >= 5 && b.length >= 5 && lev(a, b) <= 1); }
  A.fz = fz;

  A.analisar = function (texto, S) {
    S = S || A.S;
    var T = tokens(texto), tk = T.tk.map(function (x) { return x.t; }), used = tk.map(function () { return false; });
    var pares = [];
    S.itens.forEach(function (e) {
      if (e.fora) return;
      var lista = e.syn.concat([e.nome]);
      lista.forEach(function (sy) { var w = palavras(sy); if (w.length) pares.push({ k: e.id, w: w }); });
    });
    pares.sort(function (a, b) { return b.w.length - a.w.length || b.w.join(' ').length - a.w.join(' ').length; });
    var achou = {};
    pares.forEach(function (p) {
      for (var i = 0; i + p.w.length <= tk.length; i++) {
        var ok = true;
        for (var j = 0; j < p.w.length; j++) { if (used[i + j] || !fz(tk[i + j], p.w[j])) { ok = false; break; } }
        if (!ok) continue;
        for (var j2 = 0; j2 < p.w.length; j2++) used[i + j2] = true;
        if (!achou[p.k]) achou[p.k] = { k: p.k, pos: i, fim: i + p.w.length - 1, idx: [] };
        for (var j3 = 0; j3 < p.w.length; j3++) achou[p.k].idx.push(i + j3);
        i += p.w.length - 1;
      }
    });
    var hits = Object.keys(achou).map(function (k) { return achou[k]; }).sort(function (a, b) { return a.pos - b.pos; });
    // grupos: termos genéricos que sobraram
    var grupos = [], gidx = [];
    var gp = [];
    S.grupos.forEach(function (g) { g.termos.forEach(function (t) { var w = palavras(t); if (w.length) gp.push({ g: g.nome, w: w }); }); });
    gp.sort(function (a, b) { return b.w.length - a.w.length; });
    gp.forEach(function (p) {
      for (var i = 0; i + p.w.length <= tk.length; i++) {
        var ok = true;
        for (var j = 0; j < p.w.length; j++) { if (used[i + j] || tk[i + j] !== p.w[j]) { ok = false; break; } }
        if (!ok) continue;
        for (var j2 = 0; j2 < p.w.length; j2++) { used[i + j2] = true; gidx.push(i + j2); }
        if (grupos.indexOf(p.g) < 0) grupos.push(p.g);
      }
    });
    // medidas em cm -> item mais próximo antes (ou o primeiro depois)
    var midx = [];
    hits.forEach(function (h) { h.cm = null; h.qtd = null; });
    for (var i = 0; i < tk.length - 1; i++) {
      if (/^\d{1,3}$/.test(tk[i]) && tk[i + 1] === 'cm' && hits.length) {
        var best = null;
        hits.forEach(function (h) { if (h.pos < i && (!best || h.pos > best.pos)) best = h; });
        if (!best || best.cm != null) best = hits.filter(function (h) { return h.pos > i && h.cm == null; })[0] || best;
        if (best && best.cm == null) { best.cm = parseInt(tk[i], 10); midx.push(i, i + 1); }
      }
    }
    // quantidade logo antes do item ("2 santo antonio", "duas santa clara")
    hits.forEach(function (h) {
      var p = h.pos - 1; if (p < 0) return;
      var q = NUM[tk[p]] || (/^\d{1,2}$/.test(tk[p]) && tk[p + 1] !== 'cm' ? parseInt(tk[p], 10) : 0);
      if (q > 0 && q <= 50) h.qtd = q;
    });
    // trechos para destacar no texto original
    var marca = {};
    hits.forEach(function (h) { h.idx.forEach(function (x) { marca[T.tk[x].span] = 'm'; }); });
    gidx.concat(midx).forEach(function (x) { marca[T.tk[x].span] = 'm'; });
    var html = '', ult = 0;
    T.spans.forEach(function (s, si) {
      if (!marca[si]) return;
      html += A.esc(texto.slice(ult, s.a)) + '<mark class="m">' + A.esc(texto.slice(s.a, s.b)) + '</mark>'; ult = s.b;
    });
    html += A.esc(texto.slice(ult));
    return { hits: hits, grupos: grupos, html: html };
  };
  A.item = function (id) { for (var i = 0; i < A.S.itens.length; i++) if (A.S.itens[i].id === id) return A.S.itens[i]; return null; };
  A.tamanhos = function (e) { return Object.keys(e.precos || {}).map(Number).sort(function (a, b) { return a - b; }); };
  A.maisProximo = function (e, cm) { var ks = A.tamanhos(e); if (!ks.length) return cm || null; var b = ks[0]; ks.forEach(function (k) { if (Math.abs(k - cm) < Math.abs(b - cm)) b = k; }); return b; };
})();
