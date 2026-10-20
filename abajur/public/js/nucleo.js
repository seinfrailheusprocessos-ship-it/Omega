/* Núcleo: utilidades, banco local (IndexedDB), estado, ícones, avisos, folhas e rotas. */
var A = window.A = {};
(function () {
  'use strict';
  A.$ = function (s, r) { return (r || document).querySelector(s); };
  A.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  A.esc = function (t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  A.uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };
  A.r2 = function (x) { return Math.round((+x || 0) * 100) / 100; };
  A.brl = function (v) { return 'R$ ' + A.r2(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  A.pct = function (d) { return A.r2(d).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%'; };
  A.num = function (v) { if (typeof v === 'number') return v; v = String(v || '').replace(/[^\d,.-]/g, ''); if (v.indexOf(',') > -1) v = v.replace(/\./g, '').replace(',', '.'); return parseFloat(v) || 0; };
  A.norm = function (s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  };
  A.hoje = function () { var d = new Date(); return A.iso(d); };
  A.iso = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  A.parseIso = function (s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  A.dataBR = function (s) { if (!s) return ''; var p = String(s).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; };
  A.dataCurta = function (s) { if (!s) return ''; var p = String(s).slice(0, 10).split('-'); return p[2] + '/' + p[1]; };
  A.quando = function (s) {
    if (!s) return '';
    var d = String(s).slice(0, 10), h = String(s).slice(11, 16);
    var dif = Math.round((A.parseIso(d) - A.parseIso(A.hoje())) / 864e5);
    var t = dif === 0 ? 'hoje' : dif === 1 ? 'amanhã' : dif === -1 ? 'ontem' : A.dataCurta(d);
    return t + (h ? ' ' + h : '');
  };
  A.telLimpo = function (t) { var d = String(t || '').replace(/\D/g, ''); if (d.length >= 10 && d.length <= 11) d = '55' + d; return d; };
  A.telBR = function (t) {
    var d = String(t || '').replace(/\D/g, ''); if (d.indexOf('55') === 0 && d.length > 11) d = d.slice(2);
    if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 3) + ' ' + d.slice(3, 7) + '-' + d.slice(7);
    if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return t || '';
  };
  A.wa = function (tel, txt) { var d = A.telLimpo(tel); return 'https://wa.me/' + d + (txt ? '?text=' + encodeURIComponent(txt) : ''); };

  /* ---------- ícones (traço fino) ---------- */
  var P = {
    home: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-6h4v6"/>',
    chat: '<path d="M4 5h16v11H9l-5 4V5z"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.5 2.7-5.5 6-5.5s6 2 6 5.5"/><path d="M16 5.5a3 3 0 010 5.6M18 15c2 .7 3 2.3 3 5"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/>',
    all: '<path d="M7 9l5-5 5 5M7 15l5 5 5-5"/>',
    chev: '<path d="M9 5l7 7-7 7"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    dots: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8z"/>',
    pin: '<path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v8"/>',
    arch: '<rect x="3.5" y="4" width="17" height="5" rx="1"/><path d="M5 9v10h14V9M10 13h4"/>',
    bell: '<path d="M6 16V11a6 6 0 0112 0v5l2 2H4zM10 20a2 2 0 004 0"/>',
    trash: '<path d="M4 7h16M10 7V4h4v3M6 7l1 13h10l1-13"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    move: '<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    note: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
    task: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/>',
    tag: '<path d="M3.5 12V4h8l9 9-8 8z"/><circle cx="8" cy="8.5" r="1.4"/>',
    folder: '<path d="M3.5 7a2 2 0 012-2h4l2 2h7a2 2 0 012 2v8.5a2 2 0 01-2 2h-13a2 2 0 01-2-2z"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21"/>',
    paste: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/>',
    share: '<path d="M12 15V3M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/>',
    wa: '<path d="M4 20l1.3-4A8 8 0 1112 20a8 8 0 01-3.9-1z"/><path d="M9 9c0 3 3 6 6 6l1-1.5-2-1-1 1c-1-.5-2-1.5-2.5-2.5l1-1-1-2z"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/>',
    zap: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
    book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 19V5M8 7h7"/>',
    swipe: '<path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"/>',
    save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8 7h8M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>',
    money: '<rect x="3" y="6" width="18" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.5"/>',
    heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z"/>',
    pdf: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M8.5 16.5v-4h1.5a1.2 1.2 0 010 2.4H8.5M13 12.5v4h1a2 2 0 000-4z"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
    up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
    box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4V7z"/><path d="M3 7l9 4 9-4M12 11v10"/>'
  };
  A.ic = function (n, cls) { return '<svg class="i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (P[n] || '') + '</svg>'; };
  A.CHEV = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true">' + P.chev + '</svg>';
  A.LOGO = '';
  A.logo = function (cls) { return '<span class="lg ' + (cls || '') + '" aria-hidden="true">' + A.LOGO + '</span>'; };
  A.X = function (t) { return '<span class="xp">' + A.esc(t) + '</span>'; };

  /* ---------- IndexedDB ---------- */
  var dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (ok, no) {
      var r = indexedDB.open('abajur', 1);
      r.onupgradeneeded = function () { var d = r.result; d.createObjectStore('kv'); d.createObjectStore('fotos', { keyPath: 'id' }); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { no(r.error); };
    });
    return dbp;
  }
  function tx(store, mode, fn) {
    return db().then(function (d) {
      return new Promise(function (ok, no) {
        var t = d.transaction(store, mode); var s = t.objectStore(store); var res = fn(s);
        t.oncomplete = function () { ok(res && res.result !== undefined ? res.result : res); };
        t.onerror = function () { no(t.error); };
      });
    });
  }
  A.kvGet = function (k) { return tx('kv', 'readonly', function (s) { return s.get(k); }); };
  A.kvSet = function (k, v) { return tx('kv', 'readwrite', function (s) { s.put(v, k); }); };
  A.fotoPut = function (f) { return tx('fotos', 'readwrite', function (s) { s.put(f); }); };
  A.fotoDel = function (id) { return tx('fotos', 'readwrite', function (s) { s.delete(id); }); };
  A.fotoClear = function () { return tx('fotos', 'readwrite', function (s) { s.clear(); }); };
  A.fotoAll = function () { return tx('fotos', 'readonly', function (s) { return s.getAll(); }); };

  /* ---------- estado ---------- */
  A.S = null;
  var saveT = null;
  A.save = function () {
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      A.kvSet('estado', JSON.parse(JSON.stringify(A.S))).catch(function () { A.toast('Não foi possível salvar no aparelho'); });
      try { localStorage.setItem('abajur-estado', JSON.stringify(A.S)); } catch (e) {}
    }, 250);
  };
  A.load = function () {
    return A.kvGet('estado').catch(function () { return null; }).then(function (s) {
      if (!s) { try { var l = localStorage.getItem('abajur-estado'); if (l) s = JSON.parse(l); } catch (e) {} }
      A.S = A.migrar(s || A.semente());
      return A.S;
    });
  };
  A.migrar = function (s) {
    var b = A.semente();
    Object.keys(b).forEach(function (k) { if (s[k] === undefined) s[k] = b[k]; });
    Object.keys(b.cfg).forEach(function (k) { if (s.cfg[k] === undefined) s.cfg[k] = b.cfg[k]; });
    Object.keys(b.atelie).forEach(function (k) { if (s.atelie[k] === undefined) s.atelie[k] = b.atelie[k]; });
    return s;
  };

  /* ---------- aviso ---------- */
  A.toast = function (m) {
    var t = A.$('#toast'); t.textContent = m; t.classList.add('show');
    clearTimeout(A.toast.t); A.toast.t = setTimeout(function () { t.classList.remove('show'); }, 2000);
  };
  A.copiar = function (t, msg) {
    function fb() {
      var ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;left:0;top:0;opacity:0';
      document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta); A.toast(ok ? (msg || 'Copiado') : 'Selecione e copie manualmente');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { A.toast(msg || 'Copiado'); }, fb); else fb();
  };

  /* ---------- folhas (modais de baixo para cima) ---------- */
  var pilha = [];
  A.sheet = function (titulo, html, opts) {
    opts = opts || {};
    var bg = document.createElement('div'); bg.className = 'sheet-bg';
    var sh = document.createElement('div'); sh.className = 'sheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
    sh.innerHTML = '<div class="grab"></div><header><h2>' + A.esc(titulo) + '</h2>' + (opts.acao || '') + '<button class="ib" data-x aria-label="Fechar">' + A.ic('x') + '</button></header><div class="sc">' + html + '</div>';
    document.body.appendChild(bg); document.body.appendChild(sh);
    requestAnimationFrame(function () { bg.classList.add('on'); sh.classList.add('on'); });
    var o = { el: sh, sc: A.$('.sc', sh), close: function () { fechar(o); }, onclose: opts.onclose };
    bg.addEventListener('click', o.close);
    A.$('[data-x]', sh).addEventListener('click', o.close);
    // arrastar a alça para baixo fecha
    var g = A.$('.grab', sh), y0 = null;
    sh.addEventListener('touchstart', function (e) { if (e.target === g || e.target.closest('header')) y0 = e.touches[0].clientY; }, { passive: true });
    sh.addEventListener('touchmove', function (e) { if (y0 == null) return; var dy = e.touches[0].clientY - y0; if (dy > 0) sh.style.transform = 'translateY(' + dy + 'px)'; }, { passive: true });
    sh.addEventListener('touchend', function (e) { if (y0 == null) return; var dy = e.changedTouches[0].clientY - y0; y0 = null; sh.style.transform = ''; if (dy > 110) o.close(); });
    pilha.push(o);
    o._bg = bg;
    setTimeout(function () { var f = A.$('[autofocus]', sh); if (f) f.focus(); }, 380);
    return o;
  };
  function fechar(o) {
    var i = pilha.indexOf(o); if (i < 0) return; pilha.splice(i, 1);
    o.el.classList.remove('on'); o._bg.classList.remove('on');
    setTimeout(function () { o.el.remove(); o._bg.remove(); }, 380);
    if (o.onclose) o.onclose();
  }
  A.fecharTodas = function () { pilha.slice().forEach(fechar); };
  A.menu = function (titulo, itens) {
    var h = '<div class="menu">' + itens.map(function (it, i) {
      return '<button data-i="' + i + '" class="' + (it.d ? 'd' : '') + '"><span class="ico">' + A.ic(it.ic || 'chev') + '</span><span class="grow">' + A.esc(it.t) + (it.s ? '<small>' + A.esc(it.s) + '</small>' : '') + '</span></button>';
    }).join('') + '</div>';
    var o = A.sheet(titulo, h);
    o.sc.addEventListener('click', function (e) { var b = e.target.closest('[data-i]'); if (!b) return; var it = itens[+b.getAttribute('data-i')]; o.close(); setTimeout(function () { it.fn(); }, 60); });
    return o;
  };
  A.confirmar = function (t, fn, sim) {
    A.menu(t, [{ t: sim || 'Confirmar', ic: 'check', d: 1, fn: fn }, { t: 'Cancelar', ic: 'x', fn: function () {} }]);
  };
  A.pedirTexto = function (titulo, valor, fn, ph) {
    var o = A.sheet(titulo, '<input class="inp" id="pt" autofocus value="' + A.esc(valor || '') + '" placeholder="' + A.esc(ph || '') + '"><div class="btns"><button class="btn p" id="ptok">Salvar</button></div>');
    function ok() { var v = A.$('#pt', o.el).value.trim(); if (!v) return; o.close(); fn(v); }
    A.$('#ptok', o.el).addEventListener('click', ok);
    A.$('#pt', o.el).addEventListener('keydown', function (e) { if (e.key === 'Enter') ok(); });
  };

  /* ---------- rotas ---------- */
  A.telas = {};
  A.rota = { tela: 'inicio', arg: null };
  A.ir = function (tela, arg, semHist) {
    A.fecharTodas();
    A.rota = { tela: tela, arg: arg };
    if (!semHist) try { history.pushState({ t: tela, a: arg }, '', '#' + tela + (arg ? '/' + encodeURIComponent(arg) : '')); } catch (e) {}
    A.render();
    window.scrollTo(0, 0);
  };
  A.render = function () {
    var t = A.telas[A.rota.tela] || A.telas.inicio;
    var velho = A.$('#view'), v = document.createElement('main'); v.id = 'view'; v.className = 'view';
    v.innerHTML = t.html(A.rota.arg); velho.parentNode.replaceChild(v, velho);
    if (t.init) t.init(v, A.rota.arg);
    var aba = t.aba || A.rota.tela;
    A.$$('.tabbar button').forEach(function (b) { if (b.getAttribute('data-go') === aba) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  };
  window.addEventListener('popstate', function (e) {
    if (A.$('.sheet')) { A.fecharTodas(); try { history.pushState(e.state, '', location.hash); } catch (x) {} return; }
    var s = e.state || { t: 'inicio' }; A.rota = { tela: s.t, arg: s.a }; A.render();
  });

  /* ---------- topo padrão ---------- */
  A.topo = function (titulo, sub, extra, voltar) {
    return '<header class="top">' + (voltar ? '<button class="back" data-back aria-label="Voltar">' + A.ic('left') + '</button>' : A.logo()) +
      '<h1>' + A.esc(titulo) + (sub ? '<small>' + sub + '</small>' : '') + '</h1>' + (extra || '') +
      '<button class="ib" data-tema aria-label="Alternar tema claro e escuro">' + A.ic(A.escuro() ? 'sun' : 'moon') + '</button></header>';
  };
  A.escuro = function () { var d = document.documentElement.getAttribute('data-theme'); return d ? d === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches; };
  A.aplicarTema = function () {
    var t = A.S && A.S.cfg.tema;
    if (t === 'claro') document.documentElement.setAttribute('data-theme', 'light');
    else if (t === 'escuro') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    var m = A.$('meta[name="theme-color"]'); if (m) m.setAttribute('content', A.escuro() ? '#1c1c1e' : '#ecebe8');
  };

  /* ---------- seção numerada recolhível ---------- */
  A.secao = function (num, titulo, corpo, o) {
    o = o || {};
    return '<section class="sec' + (o.aberta ? ' open' : '') + '"' + (o.attr || '') + '><button class="sh" aria-expanded="' + (!!o.aberta) + '">' +
      '<span class="num">' + num + '</span>' + (o.cor ? '<span class="sw" style="background:' + o.cor + '"></span>' : '') +
      '<span class="tt">' + A.esc(titulo) + '</span><span class="ct">' + (o.ct != null ? o.ct : '') + '</span>' + (o.more || '') + A.CHEV +
      '</button><div class="collapse"><div class="in">' + corpo + '</div></div></section>';
  };
  A.abrirSecoes = function (root, v) { A.$$('.sec', root).forEach(function (s) { s.classList.toggle('open', v); var b = A.$(':scope>.sh', s); if (b) b.setAttribute('aria-expanded', v); }); };
})();
