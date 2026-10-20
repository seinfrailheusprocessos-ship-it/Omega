/* Leitor mínimo de ZIP (exportação do WhatsApp): acha o .txt da conversa e descompacta com o próprio navegador. */
(function () {
  'use strict';
  function u16(d, o) { return d.getUint16(o, true); }
  function u32(d, o) { return d.getUint32(o, true); }
  A.zipListar = function (buf) {
    var d = new DataView(buf), n = buf.byteLength, eocd = -1;
    for (var i = n - 22; i >= Math.max(0, n - 65557); i--) if (u32(d, i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('zip inválido');
    var tot = u16(d, eocd + 10), off = u32(d, eocd + 16), out = [];
    for (var k = 0; k < tot; k++) {
      if (u32(d, off) !== 0x02014b50) break;
      var met = u16(d, off + 10), csz = u32(d, off + 20), nl = u16(d, off + 28), el = u16(d, off + 30), cl = u16(d, off + 32), lo = u32(d, off + 42);
      var nome = new TextDecoder().decode(new Uint8Array(buf, off + 46, nl));
      out.push({ nome: nome, metodo: met, tam: csz, local: lo });
      off += 46 + nl + el + cl;
    }
    return out;
  };
  A.zipLer = function (buf, ent) {
    var d = new DataView(buf), lo = ent.local;
    var ini = lo + 30 + u16(d, lo + 26) + u16(d, lo + 28);
    var dados = new Uint8Array(buf, ini, ent.tam);
    if (ent.metodo === 0) return Promise.resolve(dados);
    if (!window.DecompressionStream) return Promise.reject(new Error('sem descompressão'));
    var s = new Blob([dados]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(s).arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
  };
  /* conversa exportada (.txt ou .zip) -> {nome, msgs:[{data,hora,autor,txt}]} */
  A.lerConversa = function (file) {
    var nomeArq = file.name || '';
    var p = /\.zip$/i.test(nomeArq) ? file.arrayBuffer().then(function (buf) {
      var l = A.zipListar(buf).filter(function (e) { return /\.txt$/i.test(e.nome); });
      if (!l.length) throw new Error('sem txt');
      l.sort(function (a, b) { return (/_chat|conversa|chat/i.test(b.nome) ? 1 : 0) - (/_chat|conversa|chat/i.test(a.nome) ? 1 : 0); });
      return A.zipLer(buf, l[0]).then(function (u) { return new TextDecoder().decode(u); });
    }) : file.text();
    return p.then(function (txt) { return A.parseConversa(txt, nomeArq); });
  };
  A.parseConversa = function (txt, nomeArq) {
    var nome = (nomeArq || '').replace(/\.(txt|zip)$/i, '').replace(/^(Conversa do WhatsApp com|WhatsApp Chat with|WhatsApp Chat -)\s*/i, '').trim();
    var re1 = /^‎?\[?(\d{1,2}\/\d{1,2}\/\d{2,4})[ ,]+(\d{1,2}:\d{2})(?::\d{2})?\]?\s*(?:-\s*)?([^:]{1,60}):\s([\s\S]*)$/;
    var msgs = [], cur = null;
    txt.replace(/\r/g, '').split('\n').forEach(function (ln) {
      var m = ln.match(re1);
      if (m) { cur = { data: m[1], hora: m[2], autor: m[3].replace(/‎/g, '').trim(), txt: m[4] }; msgs.push(cur); }
      else if (cur) cur.txt += '\n' + ln;
    });
    var cont = {}; msgs.forEach(function (m) { cont[m.autor] = (cont[m.autor] || 0) + 1; });
    var autores = Object.keys(cont);
    var cliente = autores.filter(function (a) { return nome && A.norm(a) === A.norm(nome); })[0] || autores.filter(function (a) { return /\d{4}/.test(a); })[0] || autores[0] || nome;
    return { nome: nome || cliente || 'Conversa', cliente: cliente, autores: autores, msgs: msgs };
  };
})();
