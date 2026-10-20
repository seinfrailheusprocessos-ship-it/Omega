/* Ímã: identidade de imagem por hash perceptual (dHash + pHash, 64 bits cada), tudo no aparelho.
   Nunca interpreta o conteúdo; só mede o quanto uma imagem é a mesma foto do catálogo.
   O mesmo código roda na ferramenta de carga do computador (ferramentas/gerar-carga.html). */
(function (G) {
  'use strict';
  var A = G.A || (G.A = {});
  var LADO = 160; // tamanho intermediário antes da média por área

  /* ---------- redução e cinza ---------- */
  function cinza(src, sx, sy, sw, sh) {
    var k = Math.min(1, LADO / Math.max(sw, sh)), w = Math.max(8, Math.round(sw * k)), h = Math.max(8, Math.round(sh * k));
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
    var d = g.getImageData(0, 0, w, h).data, out = new Float32Array(w * h);
    for (var i = 0, j = 0; i < out.length; i++, j += 4) out[i] = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
    return { w: w, h: h, px: out };
  }
  function media(img, W, H) { // média por área (determinística)
    var out = new Float32Array(W * H), cnt = new Float32Array(W * H);
    for (var y = 0; y < img.h; y++) {
      var ty = Math.min(H - 1, Math.floor((y + 0.5) * H / img.h));
      for (var x = 0; x < img.w; x++) { var tx = Math.min(W - 1, Math.floor((x + 0.5) * W / img.w)); out[ty * W + tx] += img.px[y * img.w + x]; cnt[ty * W + tx]++; }
    }
    for (var i = 0; i < out.length; i++) out[i] = cnt[i] ? out[i] / cnt[i] : 0;
    return out;
  }
  function hex(bits) { var s = ''; for (var i = 0; i < 64; i += 4) s += ((bits[i] << 3) | (bits[i + 1] << 2) | (bits[i + 2] << 1) | bits[i + 3]).toString(16); return s; }
  function dhash(img) { var m = media(img, 9, 8), b = []; for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) b.push(m[y * 9 + x] > m[y * 9 + x + 1] ? 1 : 0); return hex(b); }
  var COS = null;
  function phash(img) {
    var N = 32, m = media(img, N, N);
    if (!COS) { COS = new Float32Array(N * N); for (var u = 0; u < N; u++) for (var x = 0; x < N; x++) COS[u * N + x] = Math.cos((2 * x + 1) * u * Math.PI / (2 * N)); }
    var t = new Float32Array(8 * N), v = [];
    for (var u2 = 0; u2 < 8; u2++) for (var y = 0; y < N; y++) { var s = 0; for (var x2 = 0; x2 < N; x2++) s += m[y * N + x2] * COS[u2 * N + x2]; t[u2 * N + y] = s; }
    for (var vv = 0; vv < 8; vv++) for (var uu = 0; uu < 8; uu++) { var s2 = 0; for (var y2 = 0; y2 < N; y2++) s2 += t[uu * N + y2] * COS[vv * N + y2]; v.push(s2); }
    var ord = v.slice(1).sort(function (a, b) { return a - b; }), med = (ord[31] + ord[32]) / 2;
    return hex(v.map(function (q) { return q > med ? 1 : 0; }));
  }
  function hashRet(src, sx, sy, sw, sh) { var g = cinza(src, sx, sy, sw, sh); return { d: dhash(g), p: phash(g) }; }

  /* recortes do catálogo: inteira, quadrado central e 4:5 central (como o Instagram corta) */
  A.hashCatalogo = function (bm) {
    var W = bm.width, H = bm.height, q = Math.min(W, H), r = {};
    r.f = hashRet(bm, 0, 0, W, H);
    r.q = hashRet(bm, (W - q) / 2, (H - q) / 2, q, q);
    var rw = W, rh = Math.round(W * 1.25); if (rh > H) { rh = H; rw = Math.round(H * 0.8); }
    r.r = hashRet(bm, (W - rw) / 2, (H - rh) / 2, rw, rh);
    return r;
  };

  /* recortes da imagem recebida: inteira, sem bordas lisas, bloco da foto num print e quadrados ao longo da tela */
  function semBordas(bm) {
    var g = cinza(bm, 0, 0, bm.width, bm.height), w = g.w, h = g.h, px = g.px;
    function lisa(a, n, passo, i0) { var mn = 1e9, mx = -1e9; for (var k = 0; k < n; k++) { var v = px[i0 + k * passo]; if (v < mn) mn = v; if (v > mx) mx = v; } return mx - mn < 14; }
    var t = 0, b = h - 1, l = 0, r = w - 1;
    while (t < b && lisa(0, w, 1, t * w)) t++;
    while (b > t && lisa(0, w, 1, b * w)) b--;
    while (l < r && lisa(0, h, w, l)) l++;
    while (r > l && lisa(0, h, w, r)) r--;
    var kx = bm.width / w, ky = bm.height / h;
    return { x: l * kx, y: t * ky, w: (r - l + 1) * kx, h: (b - t + 1) * ky };
  }
  function blocoFoto(bm) {
    var g = cinza(bm, 0, 0, bm.width, bm.height), w = g.w, h = g.h, px = g.px, ocup = [];
    for (var y = 0; y < h; y++) { var s = 0, s2 = 0; for (var x = 0; x < w; x++) { var v = px[y * w + x]; s += v; s2 += v * v; } var m = s / w; ocup.push(Math.sqrt(Math.max(0, s2 / w - m * m)) > 18); }
    var melhor = [0, 0], ini = -1;
    for (var y2 = 0; y2 <= h; y2++) { if (y2 < h && ocup[y2]) { if (ini < 0) ini = y2; } else if (ini >= 0) { if (y2 - ini > melhor[1] - melhor[0]) melhor = [ini, y2]; ini = -1; } }
    if (melhor[1] - melhor[0] < h * 0.2) return null;
    var ky = bm.height / h; return { x: 0, y: melhor[0] * ky, w: bm.width, h: (melhor[1] - melhor[0]) * ky };
  }
  A.hashConsulta = function (bm) {
    var W = bm.width, H = bm.height, rs = [{ x: 0, y: 0, w: W, h: H }];
    var sb = semBordas(bm); if (sb.w > W * 0.3 && sb.h > H * 0.2 && (sb.w < W * 0.98 || sb.h < H * 0.98)) rs.push(sb);
    if (H / W > 1.3) {
      var bf = blocoFoto(bm); if (bf) rs.push(bf);
      for (var f = 0.08; f <= 0.5; f += 0.06) { if (f * H + W <= H) rs.push({ x: 0, y: f * H, w: W, h: W }); if (f * H + W * 1.25 <= H) rs.push({ x: 0, y: f * H, w: W, h: W * 1.25 }); }
    }
    return rs.map(function (r) { return hashRet(bm, r.x, r.y, r.w, r.h); });
  };

  /* ---------- distância ---------- */
  var POP = new Uint8Array(256); for (var i = 0; i < 256; i++) POP[i] = (i & 1) + POP[i >> 1];
  function ham(a, b) { var n = 0; for (var i = 0; i < 16; i += 2) n += POP[parseInt(a.substr(i, 2), 16) ^ parseInt(b.substr(i, 2), 16)]; return n; }
  A.ham = ham;
  function dist(x, y) { return (ham(x.d, y.d) + ham(x.p, y.p)) / 2; }
  A.distHash = dist;
  /* consulta: [{d,p}] ; catálogo: [{id, h:{f,q,r}}] -> lista ordenada [{id, dist}] */
  A.compararHashes = function (consulta, catalogo) {
    var r = [];
    catalogo.forEach(function (c) {
      if (!c.h) return;
      var m = 99;
      consulta.forEach(function (q) { ['f', 'q', 'r'].forEach(function (k) { if (c.h[k]) { var d = dist(q, c.h[k]); if (d < m) m = d; } }); });
      r.push({ id: c.id, dist: m });
    });
    return r.sort(function (a, b) { return a.dist - b.dist; });
  };
  A.abrirBitmap = function (blob) {
    if (G.createImageBitmap) return createImageBitmap(blob, { imageOrientation: 'from-image' }).catch(function () { return createImageBitmap(blob); });
    return new Promise(function (ok, no) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = no; i.src = URL.createObjectURL(blob); });
  };
})(window);
