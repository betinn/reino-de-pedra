/* Reino de Pedra — geometria hexagonal e terreno mock (determinístico).
   Hexágonos "pointy-top", coordenadas offset odd-r (col, lin).
   O terreno é desenhado à mão por "feições" (cordilheiras, florestas, pântanos, rios)
   com ruído suave nas bordas. Não é lógica de jogo: só arte fixa do protótipo. */
(function () {
  'use strict';
  var RP = (window.RP = window.RP || {});

  var R = 30;
  var W = Math.sqrt(3) * R;
  var VS = 1.5 * R;
  var COLS = 44;
  var LINS = 34;

  function centro(c, l) {
    return { x: W * (c + 0.5 * (l & 1)) + W / 2, y: VS * l + R };
  }
  function cantos(cx, cy, r) {
    var p = [], i, a;
    for (i = 0; i < 6; i++) {
      a = (Math.PI / 180) * (60 * i - 30);
      p.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1));
    }
    return p.join(' ');
  }
  function paraCubo(c, l) {
    var x = c - (l - (l & 1)) / 2;
    return { x: x, z: l, y: -x - l };
  }
  function deCubo(x, z) {
    return { c: x + (z - (z & 1)) / 2, l: z };
  }
  function arredCubo(fx, fy, fz) {
    var rx = Math.round(fx), ry = Math.round(fy), rz = Math.round(fz);
    var dx = Math.abs(rx - fx), dy = Math.abs(ry - fy), dz = Math.abs(rz - fz);
    if (dx > dy && dx > dz) rx = -ry - rz;
    else if (dy > dz) ry = -rx - rz;
    else rz = -rx - ry;
    return { x: rx, y: ry, z: rz };
  }
  function dist(a, b) {
    var A = paraCubo(a[0], a[1]), B = paraCubo(b[0], b[1]);
    return Math.max(Math.abs(A.x - B.x), Math.abs(A.y - B.y), Math.abs(A.z - B.z));
  }
  function pixelParaHex(px, py) {
    var x = px - W / 2, y = py - R;
    var q = ((Math.sqrt(3) / 3) * x - (1 / 3) * y) / R;
    var r = ((2 / 3) * y) / R;
    var cu = arredCubo(q, -q - r, r);
    return deCubo(cu.x, cu.z);
  }
  function linha(a, b) {
    var A = paraCubo(a[0], a[1]), B = paraCubo(b[0], b[1]);
    var n = dist(a, b), out = [], i, t, cu, o;
    for (i = 0; i <= n; i++) {
      t = n === 0 ? 0 : i / n;
      cu = arredCubo(A.x + (B.x - A.x) * t + 1e-6, A.y + (B.y - A.y) * t + 1e-6, A.z + (B.z - A.z) * t - 2e-6);
      o = deCubo(cu.x, cu.z);
      out.push([o.c, o.l]);
    }
    return out;
  }
  function caminho(pontos) {
    var out = [], i, seg;
    for (i = 0; i < pontos.length - 1; i++) {
      seg = linha(pontos[i], pontos[i + 1]);
      if (i > 0) seg.shift();
      out = out.concat(seg);
    }
    return out;
  }
  /* Curva suave (Catmull-Rom → Bézier) passando pelos centros */
  function curva(hexes) {
    var p = hexes.map(function (h) { return centro(h[0], h[1]); });
    if (p.length < 2) return '';
    var d = 'M' + p[0].x.toFixed(1) + ' ' + p[0].y.toFixed(1), i, p0, p1, p2, p3;
    for (i = 0; i < p.length - 1; i++) {
      p0 = p[i - 1] || p[i]; p1 = p[i]; p2 = p[i + 1]; p3 = p[i + 2] || p2;
      d += 'C' + (p1.x + (p2.x - p0.x) / 6).toFixed(1) + ' ' + (p1.y + (p2.y - p0.y) / 6).toFixed(1) + ' ' +
        (p2.x - (p3.x - p1.x) / 6).toFixed(1) + ' ' + (p2.y - (p3.y - p1.y) / 6).toFixed(1) + ' ' +
        p2.x.toFixed(1) + ' ' + p2.y.toFixed(1);
    }
    return d;
  }
  function vizinhos(c, l) {
    var imp = l & 1;
    var d = imp
      ? [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]]
      : [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
    return d.map(function (v) { return [c + v[0], l + v[1]]; })
      .filter(function (h) { return h[0] >= 0 && h[1] >= 0 && h[0] < COLS && h[1] < LINS; });
  }

  /* ----- ruído determinístico ----- */
  function hash(x, y, s) {
    var h = (x * 374761393 + y * 668265263 + (s || 0) * 2246822519) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967295;
  }
  function suav(t) { return t * t * (3 - 2 * t); }
  function ruido(x, y, s) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    var u = suav(xf), v = suav(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, s) {
    return (ruido(x, y, s) * 0.65 + ruido(x * 2.1, y * 2.1, s + 7) * 0.35) * 2 - 1;
  }

  /* espaço "isotrópico" para medir distâncias entre hexes */
  function iso(c, l) { return { x: c + 0.5 * (l & 1), y: l * 0.866 }; }
  function distSeg(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1);
    t = Math.max(0, Math.min(1, t));
    var x = a.x + dx * t - p.x, y = a.y + dy * t - p.y;
    return Math.sqrt(x * x + y * y);
  }
  function distLinha(p, pts) {
    var m = 1e9, i;
    for (i = 0; i < pts.length - 1; i++) m = Math.min(m, distSeg(p, iso(pts[i][0], pts[i][1]), iso(pts[i + 1][0], pts[i + 1][1])));
    return m;
  }
  function distPonto(p, c) { var q = iso(c[0], c[1]); return Math.sqrt((p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y)); }

  var FEICOES = {
    cordilheiras: [
      { pts: [[23, 3], [25, 8], [26, 13], [25, 18], [26, 22]], nucleo: 1.3, franja: 2.6 },
      { pts: [[2, 2], [6, 3], [9, 5]], nucleo: 1.1, franja: 2.2 },
      { pts: [[39, 1], [42, 4]], nucleo: 1.0, franja: 2.0 }
    ],
    colinas: [[[10, 22], 2.4], [[33, 12], 2.2], [[38, 30], 2.2], [[19, 27], 1.6], [[30, 3], 1.6], [[4, 17], 1.8]],
    pantanos: [[[6, 27], 3.4], [[31, 30], 2.4], [[41, 20], 1.8]],
    florestas: [[[16, 23], 2.6], [[7, 13], 3.6], [[29, 16], 2.8], [[36, 22], 3.0], [[18, 8], 2.8], [[40, 7], 2.8], [[3, 31], 2.2], [[21, 30], 2.4], [[12, 2], 2.4], [[34, 33], 2.0]],
    rios: [
      [[24, 9], [22, 13], [20, 17], [19, 21], [17, 25], [15, 29], [14, 33]],
      [[42, 11], [39, 16], [39, 22], [40, 27], [42, 33]]
    ]
  };

  var NOMES_TERRENO = {
    planicie: { nome: 'Planície', efeito: 'Deslocamento rápido · comida' },
    floresta: { nome: 'Floresta', efeito: 'Deslocamento lento · madeira e caça' },
    colina: { nome: 'Colina', efeito: 'Deslocamento normal · ferro e pedra' },
    montanha: { nome: 'Montanha', efeito: 'Deslocamento lento · ouro e pedras preciosas' },
    pantano: { nome: 'Pântano', efeito: 'Deslocamento muito lento · ervas raras' },
    rio: { nome: 'Rio', efeito: 'Travessia exige ponte ou vau' }
  };

  function gerarTerreno(forcados) {
    var t = [], c, l, p, n, tipo, i, f, d;
    var rioSet = {};
    FEICOES.rios.forEach(function (r) { caminho(r).forEach(function (h) { rioSet[h[0] + ',' + h[1]] = 1; }); });
    for (l = 0; l < LINS; l++) {
      t[l] = [];
      for (c = 0; c < COLS; c++) {
        p = iso(c, l);
        n = fbm(c * 0.33, l * 0.33, 11) * 0.9;
        tipo = 'planicie';
        for (i = 0; i < FEICOES.florestas.length; i++) {
          f = FEICOES.florestas[i];
          if (distPonto(p, f[0]) < f[1] + n * 1.1) { tipo = 'floresta'; break; }
        }
        for (i = 0; i < FEICOES.colinas.length; i++) {
          f = FEICOES.colinas[i];
          if (distPonto(p, f[0]) < f[1] + n * 0.8) { tipo = 'colina'; break; }
        }
        for (i = 0; i < FEICOES.pantanos.length; i++) {
          f = FEICOES.pantanos[i];
          if (distPonto(p, f[0]) < f[1] + n * 0.9) { tipo = 'pantano'; break; }
        }
        for (i = 0; i < FEICOES.cordilheiras.length; i++) {
          f = FEICOES.cordilheiras[i];
          d = distLinha(p, f.pts);
          if (d < f.nucleo + n * 0.7) { tipo = 'montanha'; break; }
          if (d < f.franja + n * 0.9 && tipo !== 'pantano') tipo = 'colina';
        }
        if (rioSet[c + ',' + l]) tipo = 'rio';
        t[l][c] = tipo;
      }
    }
    (forcados || []).forEach(function (fz) { t[fz[1]][fz[0]] = fz[2]; });
    return t;
  }

  RP.hex = {
    R: R, W: W, VS: VS, COLS: COLS, LINS: LINS,
    LARGURA: W * (COLS + 0.5) + 0, ALTURA: VS * (LINS - 1) + 2 * R,
    centro: centro, cantos: cantos, dist: dist, pixelParaHex: pixelParaHex,
    linha: linha, caminho: caminho, curva: curva, vizinhos: vizinhos,
    hash: hash, FEICOES: FEICOES, TERRENOS: NOMES_TERRENO,
    gerarTerreno: gerarTerreno
  };
})();
