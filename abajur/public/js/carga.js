/* Carga inicial do catálogo: uma categoria por subpasta da pasta Santos, sinônimos automáticos, grupos sugeridos,
   pastas fora do catálogo até confirmação e sugestões de união. Tudo editável depois pela própria usuária. */
(function () {
  'use strict';
  function n(s) { return A.norm(s).replace(/[^a-z0-9]+/g, ' ').trim(); }
  var ART = /^(da|de|do|das|dos) (.+)$/;

  A.GRUPOS_SUGERIDOS = [
    { nome: 'Nossa Senhora', termos: ['nossa senhora', 'virgem maria'] },
    { nome: 'Santas', termos: ['santa', 'santas'] },
    { nome: 'Santos', termos: ['santo', 'santos'] },
    { nome: 'Anjos e Arcanjos', termos: ['arcanjo', 'arcanjos'] },
    { nome: 'Jesus, Família e Natal', termos: [] },
    { nome: 'Oratórios', termos: [] },
    { nome: 'Orixás e tradição afro', termos: ['orixa', 'orixas'] },
    { nome: 'Pronta entrega', termos: ['pronta entrega', 'a pronta entrega'] }
  ];
  A.GRUPO_FORA = 'Fora do catálogo';
  var FORA = ['azulejo', 'desenhos', 'diversos', 'mural', 'profissionais'];

  /* grupo sugerido pelo nome da pasta (as 65 conhecidas e regras para pastas novas) */
  var MAPA = {
    'Nossa Senhora': ['de loreto', 'assuncao', 'rosario', 'piedade', 'perpetuo socorro', 'nossa senhora da vitoria', 'n s rainha dos anjos', 'mae rainha', 'fatima', 'coracao de maria', 'conceicao', 'aparecida', 'divina pastora', 'lourdes', 'guadalupe', 'carmo', 'penha', 'desatadora dos nos', 'auxiliadora', 'nazare'],
    'Santas': ['clara', 'santas maes', 'santana', 'rita de cassia', 'rita', 'madre teresa', 'luzia', 'dulce', 'catarina', 'barbara', 'teresinha', 'edwiges', 'cecilia', 'filomena', 'efigenia', 'paulina', 'josefina', 'monica', 'helena', 'ines', 'joana', 'faustina', 'zelia', 'rosa'],
    'Anjos e Arcanjos': ['anjos', 'rafael', 'miguel arcanjo', 'gabriel', 'anjo da guarda', 'querubins'],
    'Jesus, Família e Natal': ['sagrada familia', 'presepio', 'menino', 'jesus', 'divino', 'menino jesus', 'cristo', 'bom jesus', 'senhor do bonfim', 'santa ceia', 'crucifixo', 'natal', 'sagrado coracao de jesus'],
    'Oratórios': ['oratorios', 'oratorio'],
    'Orixás e tradição afro': ['orixas', 'sereias', 'iemanja', 'oxum', 'ogum', 'oxossi', 'iansa', 'xango', 'oxala', 'nana', 'obaluae', 'omulu', 'preto velho', 'caboclo', 'ibeji'],
    'Pronta entrega': ['pecas para pronta entrega', 'pronta entrega']
  };
  A.grupoSugerido = function (pasta) {
    var k = n(pasta);
    if (!k) return A.GRUPO_FORA;
    if (FORA.indexOf(k) > -1) return A.GRUPO_FORA;
    for (var g in MAPA) if (MAPA[g].indexOf(k) > -1) return g;
    if (ART.test(k) || /^(nossa senhora|n s|ns|n sra|mae) /.test(k)) return 'Nossa Senhora';
    if (/pronta entrega/.test(k)) return 'Pronta entrega';
    if (/oratori/.test(k)) return 'Oratórios';
    if (/^santa |^sta /.test(k)) return 'Santas';
    if (/anjo|arcanjo/.test(k)) return 'Anjos e Arcanjos';
    if (/jesus|cristo|presep|natal|familia/.test(k)) return 'Jesus, Família e Natal';
    if (/orixa|iemanja|oxum|ogum|xango|oxala|iansa|oxossi|sereia/.test(k)) return 'Orixás e tradição afro';
    return 'Santos';
  };

  /* sinônimos automáticos: nome da pasta + variações */
  var EXTRA = {
    'antonio': ['santo antonio', 'sao antonio', 'antonio', 'santo antonio de padua'],
    'santana': ['santana', 'santa ana', 'sant ana', 'sant anna', 'senhora santana'],
    'menino': ['menino jesus', 'menino deus', 'menino'],
    'jesus': ['jesus', 'jesus cristo', 'cristo', 'coracao de jesus', 'sagrado coracao de jesus'],
    'divino': ['divino espirito santo', 'espirito santo', 'divino'],
    'cosme e damiao': ['sao cosme e damiao', 'cosme e damiao', 'cosme damiao', 'cosme'],
    'miguel arcanjo': ['sao miguel arcanjo', 'sao miguel', 'miguel arcanjo', 'arcanjo miguel', 'miguel'],
    'gabriel': ['sao gabriel', 'arcanjo gabriel', 'gabriel'],
    'rafael': ['sao rafael', 'arcanjo rafael', 'rafael'],
    'anjos': ['anjos', 'anjo da guarda', 'anjinho', 'anjinhos', 'querubim', 'querubins'],
    'oratorios': ['oratorio', 'oratorios', 'capelinha'],
    'orixas': ['orixa', 'orixas', 'iemanja', 'yemanja', 'janaina', 'oxum', 'ogum', 'oxossi', 'iansa', 'xango', 'oxala', 'nana', 'obaluae', 'omulu'],
    'sereias': ['sereia', 'sereias'],
    'presepio': ['presepio', 'presepe'],
    'sagrada familia': ['sagrada familia', 'familia sagrada'],
    'santos negros': ['santos negros', 'santo negro', 'sao benedito', 'benedito', 'santa efigenia', 'efigenia'],
    'santas maes': ['santas maes', 'santa mae'],
    'madre teresa': ['madre teresa', 'madre teresa de calcuta', 'santa teresa de calcuta', 'teresa de calcuta'],
    'dulce': ['irma dulce', 'santa dulce', 'santa dulce dos pobres', 'dulce dos pobres', 'dulce'],
    'lucas': ['sao lucas', 'santo lucas', 'sao lucas evangelista'],
    'joao batista': ['sao joao batista', 'joao batista', 'sao joao'],
    'jose': ['sao jose', 'jose'],
    'judas tadeu': ['sao judas tadeu', 'sao judas', 'judas tadeu'],
    'francisco': ['sao francisco', 'sao francisco de assis', 'francisco de assis', 'francisco'],
    'mae rainha': ['mae rainha', 'mae rainha tres vezes admiravel'],
    'n s rainha dos anjos': ['nossa senhora rainha dos anjos', 'rainha dos anjos'],
    'nossa senhora da vitoria': ['nossa senhora da vitoria'],
    'coracao de maria': ['imaculado coracao de maria', 'coracao de maria'],
    'conceicao': ['nossa senhora da conceicao', 'imaculada conceicao', 'conceicao', 'imaculada'],
    'aparecida': ['nossa senhora aparecida', 'aparecida'],
    'fatima': ['nossa senhora de fatima', 'fatima'],
    'assuncao': ['nossa senhora da assuncao', 'assuncao'],
    'rosario': ['nossa senhora do rosario', 'rosario'],
    'piedade': ['nossa senhora da piedade', 'piedade', 'pieta'],
    'perpetuo socorro': ['nossa senhora do perpetuo socorro', 'perpetuo socorro'],
    'divina pastora': ['nossa senhora divina pastora', 'divina pastora'],
    'pecas para pronta entrega': ['pronta entrega', 'pecas prontas']
  };
  var NAO_SOZINHO = ['vida', 'o', 'graca', 'estrela'];
  A.sinonimosAuto = function (pasta, grupo) {
    var k = n(pasta), out = [];
    function add(s) { s = n(s); if (s.length >= 3 && out.indexOf(s) < 0) out.push(s); }
    if (EXTRA[k]) EXTRA[k].forEach(add);
    var m = k.match(ART);
    if (m) {
      add('nossa senhora ' + k); add('senhora ' + k);
      if (m[2].length >= 4 && NAO_SOZINHO.indexOf(m[2]) < 0) add(k);
    } else if (/^(n s|ns|nossa senhora) /.test(k)) {
      add(k.replace(/^(n s|ns) /, 'nossa senhora '));
    } else if (!EXTRA[k]) {
      add(k);
      if (grupo === 'Santos' && !/^(sao|santo|santos) /.test(k)) { add('sao ' + k); add('santo ' + k); }
      if (grupo === 'Santas' && !/^(santa|santas) /.test(k)) add('santa ' + k);
      if (grupo === 'Nossa Senhora' && !/^nossa senhora/.test(k)) add('nossa senhora ' + k);
      if (/s$/.test(k) && k.length > 5) add(k.replace(/s$/, ''));
    }
    return out;
  };

  /* pastas parecidas: sugeridas para unir, sempre com confirmação */
  var PARE = ['da', 'de', 'do', 'das', 'dos', 'e', 'nossa', 'senhora', 'n', 's', 'ns', 'sra', 'mae', 'santo', 'santa', 'sao', 'sto', 'sta'];
  function chave(nome) { return n(nome).split(' ').filter(function (w) { return PARE.indexOf(w) < 0; }).map(function (w) { return w.length > 4 ? w.replace(/s$/, '') : w; }); }
  A.sugerirUnioes = function (itens) {
    var l = itens.filter(function (e) { return !e.fora; }), pares = [], feitos = A.S && A.S.unioes || {};
    for (var i = 0; i < l.length; i++) for (var j = i + 1; j < l.length; j++) {
      var a = chave(l[i].nome), b = chave(l[j].nome);
      if (!a.length || !b.length || a[0] !== b[0]) continue;
      var id = [l[i].id, l[j].id].sort().join('|');
      if (feitos[id]) continue;
      pares.push({ id: id, a: l[i].id, b: l[j].id });
    }
    return pares;
  };
  A.unirItens = function (aId, bId) {
    var a = A.item(aId), b = A.item(bId); if (!a || !b || a === b) return;
    (b.pastas || []).forEach(function (p) { if ((a.pastas || (a.pastas = [])).indexOf(p) < 0) a.pastas.push(p); });
    b.syn.concat([n(b.nome)]).forEach(function (s) { if (a.syn.indexOf(s) < 0) a.syn.push(s); });
    Object.keys(b.precos || {}).forEach(function (t) { if (a.precos[t] == null) a.precos[t] = b.precos[t]; });
    a.n = (a.n || 0) + (b.n || 0);
    A.F.forEach(function (f) { if (f.item === bId) f.item = aId; });
    A.fotoAll().then(function (l) { l.forEach(function (r) { if (r.item === bId) { r.item = aId; A.fotoPut(r); } }); });
    A.S.itens.splice(A.S.itens.indexOf(b), 1);
    A.S.unioes = A.S.unioes || {}; A.S.unioes[[aId, bId].sort().join('|')] = 'unir';
    A.save();
  };

  /* preços de exemplo por grupo, até chegar a tabela real */
  var PRECO_EX = {
    'Nossa Senhora': { 20: 260, 30: 460, 40: 720 }, 'Santas': { 20: 250, 30: 450, 40: 700 }, 'Santos': { 20: 250, 30: 450, 40: 700 },
    'Anjos e Arcanjos': { 20: 260, 30: 470, 40: 720 }, 'Jesus, Família e Natal': { 15: 150, 20: 210, 30: 330 }, 'Oratórios': { 25: 380, 40: 620 },
    'Orixás e tradição afro': { 30: 480, 40: 760 }, 'Pronta entrega': {}
  };
  A.novaCategoria = function (pasta, nArq) {
    var g = A.grupoSugerido(pasta), fora = g === A.GRUPO_FORA;
    var id = n(pasta).replace(/ /g, '-') || 'raiz';
    while (A.item(id)) id += '-2';
    return { id: id, nome: pasta || 'Fotos soltas (raiz)', grupo: g, syn: fora ? [] : A.sinonimosAuto(pasta, g), precos: JSON.parse(JSON.stringify(PRECO_EX[g] || {})), exemplo: !fora,
      pastas: [pasta || ''], fora: fora, n: nArq || 0, auto: true };
  };
  A.garantirGrupo = function (g) { if (g && !A.S.grupos.some(function (x) { return x.nome === g; })) A.S.grupos.push({ nome: g, termos: [] }); };

  /* aplica a carga: substitui o catálogo de exemplo pelas categorias reais (mantém preços já editados) */
  A.aplicarCarga = function (carga) {
    var antigos = {}; (A.S.itens || []).forEach(function (e) { if (!e.exemplo) antigos[n(e.nome)] = e; });
    A.S.itens = [];
    A.S.grupos = JSON.parse(JSON.stringify(A.GRUPOS_SUGERIDOS));
    carga.categorias.forEach(function (c) {
      var e = A.novaCategoria(c.pasta, c.n);
      var v = antigos[n(c.pasta)]; if (v) { e.precos = v.precos; e.exemplo = false; }
      A.S.itens.push(e);
    });
    if (carga.soltas && carga.soltas.length) { var r = A.novaCategoria('', carga.soltas.length); A.S.itens.push(r); }
    A.S.cargaVersao = carga.versao;
    A.save();
  };
  A.carga = null;
  A.carregarCarga = function () {
    return A.kvGet('carga').catch(function () { return null; }).then(function (local) {
      return fetch('dados/carga-santos.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (rede) {
        // a carga com hashes vence a sem hashes; entre iguais, a mais nova
        var c = local;
        if (rede && (!c || (rede.hashes && !c.hashes) || (rede.hashes === c.hashes && rede.versao > c.versao))) { c = rede; A.kvSet('carga', rede).catch(function () {}); }
        A.carga = c;
        if (c && !A.S.cfg.ativado && A.S.cargaVersao !== c.versao && !A.S.cargaVersao) A.aplicarCarga(c);
        return c;
      });
    });
  };
  A.importarCarga = function (obj) {
    if (!obj || !obj.categorias) throw new Error('carga');
    A.carga = obj; A.kvSet('carga', obj);
    if (!A.S.cargaVersao) A.aplicarCarga(obj);
    else {
      // catálogo já em uso: não mexe nas edições dela; só acrescenta pastas novas e reconfirma as fotos pelo hash
      obj.categorias.forEach(function (c) { if (!A.porPasta(c.pasta)) { var e = A.novaCategoria(c.pasta, c.n); e.novo = true; A.S.itens.push(e); A.garantirGrupo(e.grupo); } });
      A.S.cargaVersao = obj.versao;
    }
    A.save();
    return A.reconfirmar();
  };
  /* confere de novo todas as fotos já lidas contra a carga (nome e hash) */
  A.reconfirmar = function () {
    var r = { confirmadas: 0, divergentes: 0, soNome: 0, foraCarga: 0 }, casa = A.limitesIma().casa;
    A.F.forEach(function (f) {
      var c = A.naCarga(f.pasta, f.arquivo || f.nome);
      f.st = c ? (c.h && c.h.f && f.h ? (A.distHash(c.h.f, f.h.f) <= casa ? 'confirmada' : 'divergente') : 'nome') : 'nova';
      r[{ nova: 'foraCarga', confirmada: 'confirmadas', divergente: 'divergentes', nome: 'soNome' }[f.st]]++;
    });
    A.fotoAll().then(function (l) { var m = {}; A.F.forEach(function (f) { m[f.id] = f.st; }); l.forEach(function (x) { if (m[x.id] && x.st !== m[x.id]) { x.st = m[x.id]; A.fotoPut(x); } }); });
    if (A.S.cfg.ultimaLeitura) Object.assign(A.S.cfg.ultimaLeitura, r);
    A.save();
    return r;
  };
  /* consulta na carga: pasta + arquivo -> {tam, h} */
  A.naCarga = function (pasta, arq) {
    if (!A.carga) return null;
    var lista = pasta ? (A.carga.categorias.filter(function (c) { return c.pasta === pasta || n(c.pasta) === n(pasta); })[0] || {}).arquivos : A.carga.soltas;
    if (!lista) return null;
    var a = A.norm(arq);
    return lista.filter(function (x) { return A.norm(x.nome) === a; })[0] || null;
  };
})();
