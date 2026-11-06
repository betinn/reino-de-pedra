/* Reino de Pedra — geometria hexagonal (pointy-top, offset odd-r), igual ao servidor (Mapa/Hex.cs).
   Um hexágono é um índice inteiro: lin * cols + col. Tamanho do mapa vem do servidor (RP.hex.configurar). */
(function () {
  'use strict';
  var RP = (window.RP = window.RP || {});
  var R = 15, W = Math.sqrt(3) * R, VS = 1.5 * R;   /* metade do hexágono de antes (decisão 0026); construções e pessoas não mudam de tamanho */
  var H = {
    R: R, W: W, VS: VS, COLS: 60, LINS: 48,
    configurar: function (cols, lins) {
      H.COLS = cols; H.LINS = lins;
      H.LARGURA = W * (cols + 0.5); H.ALTURA = VS * (lins - 1) + 2 * R;
    },
    idx: function (c, l) { return l * H.COLS + c; },
    c: function (h) { return h % H.COLS; },
    l: function (h) { return Math.floor(h / H.COLS); },
    dentro: function (c, l) { return c >= 0 && l >= 0 && c < H.COLS && l < H.LINS; },
    centro: function (c, l) { return { x: W * (c + 0.5 * (l & 1)) + W / 2, y: VS * l + R }; },
    centroH: function (h) { return H.centro(H.c(h), H.l(h)); },
    cantos: function (cx, cy, r) {
      var p = [], i, a;
      for (i = 0; i < 6; i++) {
        a = (Math.PI / 180) * (60 * i - 30);
        p.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1));
      }
      return p.join(' ');
    },
    paraCubo: function (c, l) { var x = c - (l - (l & 1)) / 2; return { x: x, z: l, y: -x - l }; },
    dist: function (a, b) {
      var A = H.paraCubo(H.c(a), H.l(a)), B = H.paraCubo(H.c(b), H.l(b));
      return Math.max(Math.abs(A.x - B.x), Math.abs(A.y - B.y), Math.abs(A.z - B.z));
    },
    /* hexágonos em linha reta de a a b, inclusive, vizinhos em sequência (igual a Grade.Reta, em Mapa/Hex.cs) */
    reta: function (a, b) {
      var n = H.dist(a, b), A = H.paraCubo(H.c(a), H.l(a)), B = H.paraCubo(H.c(b), H.l(b)), out = [a];
      for (var i = 1; i <= n; i++) {
        var t = i / n, fx = A.x + (B.x - A.x) * t + 1e-6, fy = A.y + (B.y - A.y) * t + 2e-6, fz = A.z + (B.z - A.z) * t - 3e-6;
        var rx = Math.round(fx), ry = Math.round(fy), rz = Math.round(fz);
        var dx = Math.abs(rx - fx), dy = Math.abs(ry - fy), dz = Math.abs(rz - fz);
        if (dx > dy && dx > dz) rx = -ry - rz; else if (dy <= dz) rz = -rx - ry;
        var c = rx + (rz - (rz & 1)) / 2;
        if (H.dentro(c, rz)) out.push(H.idx(c, rz));
      }
      return out;
    },
    pixelParaHex: function (px, py) {
      var x = px - W / 2, y = py - R;
      var q = ((Math.sqrt(3) / 3) * x - (1 / 3) * y) / R, r = ((2 / 3) * y) / R;
      var fx = q, fz = r, fy = -q - r;
      var rx = Math.round(fx), ry = Math.round(fy), rz = Math.round(fz);
      var dx = Math.abs(rx - fx), dy = Math.abs(ry - fy), dz = Math.abs(rz - fz);
      if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
      var c = rx + (rz - (rz & 1)) / 2, l = rz;
      return H.dentro(c, l) ? H.idx(c, l) : -1;
    },
    vizinhos: function (h) {
      var c = H.c(h), l = H.l(h);
      var d = (l & 1) ? [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]] : [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
      return d.map(function (v) { return [c + v[0], l + v[1]]; }).filter(function (p) { return H.dentro(p[0], p[1]); })
        .map(function (p) { return H.idx(p[0], p[1]); });
    },
    /* hexágonos que uma construção ocupa (igual a Mapa/Pegada.cs): 7 = o hexágono e o anel; 3 = ele e os vizinhos de leste e oeste */
    pegada: function (h, tamanho) {
      if (tamanho >= 7) return [h].concat(H.vizinhos(h));
      if (tamanho < 3) return [h];
      var c = H.c(h), l = H.l(h), out = [h];
      if (H.dentro(c - 1, l)) out.push(H.idx(c - 1, l));
      if (H.dentro(c + 1, l)) out.push(H.idx(c + 1, l));
      return out;
    },
    /* ruído determinístico em [0,1) para arte procedural */
    hash: function (x, y, s) {
      var n = Math.sin(x * 127.1 + y * 311.7 + (s || 0) * 74.7) * 43758.5453;
      return n - Math.floor(n);
    },
    TERRENO: { p: 'planicie', f: 'floresta', c: 'colina', m: 'montanha', b: 'pantano' },
    NOME_TERRENO: { planicie: 'Planície', floresta: 'Floresta', colina: 'Colina', montanha: 'Montanha', pantano: 'Pântano' }
  };
  H.configurar(60, 48);
  RP.hex = H;
})();
