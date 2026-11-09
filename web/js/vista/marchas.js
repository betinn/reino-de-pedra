/* Reino de Pedra — como uma marcha aparece de longe: o marcador de gente andando (Mapa tático e Vista afastada) e o
   rastro animado atrás de quem anda.

   Marcador: bonecos em pé, de contorno escuro, com dois passos de caminhada; nada de disco, que é a forma dos locais.
   Tropa é um trio de lanceiros com flâmula (sempre três: o tamanho de uma marcha é segredo). Explorador é uma pessoa só,
   de chapéu, mochila e cajado, dentro de um círculo tracejado que gira. O desenho vem de uma lista de camadas, a mesma para
   o SVG do Mapa e o Canvas da Vista.

   Rastro: só com as posições que o cliente já viu, amostradas enquanto o mapa está aberto. Começa vazio ao abrir a página,
   nunca passa de MAX_HEX hexágonos, fica atrás da unidade (ao dar meia-volta, recomeça) e some quando ela para ou sai do feed.
   O estilo depende só do tipo da marcha, que é público: nada nele diz o tamanho. Batedor não tem rastro. */
(function () {
  'use strict';
  var RP = window.RP, H = RP.hex, A = RP.arte, M = RP.mapaModelo;

  /* ---------------------------------------------------------------- arte: camadas { d, fi, st, w } */
  var ESC = '#17130e', METAL = '#dfe5ea', CLARO = '#f4ecd8', PELE = '#e6bd94', COURO = '#6e4b2a', CAVALO = '#7c5634', BRANCO = '#fbf8f0';
  var DONO = 'dono';

  function n(v) { return +v.toFixed(2); }
  function circ(x, y, r) { return 'M' + n(x - r) + ' ' + n(y) + 'a' + n(r) + ' ' + n(r) + ' 0 1 0 ' + n(2 * r) + ' 0a' + n(r) + ' ' + n(r) + ' 0 1 0 ' + n(-2 * r) + ' 0Z'; }
  function seg() {
    var d = '', a = arguments;
    for (var i = 0; i < a.length; i += 2) d += (i ? 'L' : 'M') + n(a[i]) + ' ' + n(a[i + 1]);
    return d;
  }
  /* uma figura de frente para a direita, com os pés em (x, y); passo 0 é a passada aberta, passo 1 são as pernas juntas (também é o parado) */
  function pessoa(L, x, y, e, passo, cor) {
    var ca = y - 8.4 * e, om = y - 15 * e;
    if (passo === 0) {
      L.push({ d: seg(x, ca, x + 4.6 * e, y) + seg(x, ca, x - 4.3 * e, y), st: cor, w: 2.5 * e });
      L.push({ d: seg(x, om, x + 4 * e, y - 10 * e) + seg(x, om, x - 3.8 * e, y - 10.2 * e), st: cor, w: 1.9 * e });
    } else {
      L.push({ d: seg(x, ca, x + 1.7 * e, y - 4.2 * e, x + 0.8 * e, y) + seg(x, ca, x - 1 * e, y), st: cor, w: 2.5 * e });
      L.push({ d: seg(x, om, x + 1.2 * e, y - 9 * e), st: cor, w: 1.9 * e });
    }
    L.push({ d: seg(x, om, x, ca), st: cor, w: 4.3 * e });
    L.push({ d: circ(x, y - 19.4 * e, 2.9 * e), fi: PELE });
  }
  function soldado(L, x, y, e, passo, flamula) {
    var tx = x + 6.2 * e, ty = y - 29 * e;
    L.push({ d: seg(tx, y - 1 * e, tx, ty), st: COURO, w: 1.3 * e });
    L.push({ d: 'M' + n(tx - 1.7 * e) + ' ' + n(ty + 1) + 'L' + n(tx) + ' ' + n(ty - 4 * e) + 'L' + n(tx + 1.7 * e) + ' ' + n(ty + 1) + 'Z', fi: METAL });
    if (flamula) L.push({ d: 'M' + n(tx) + ' ' + n(ty + 1) + 'L' + n(tx - 10 * e) + ' ' + n(ty + 3.4 * e) + 'L' + n(tx) + ' ' + n(ty + 6.8 * e) + 'Z', fi: DONO });
    pessoa(L, x, y, e, passo, DONO);
    /* elmo */
    L.push({ d: 'M' + n(x - 3.3 * e) + ' ' + n(y - 19.2 * e) + 'A' + n(3.3 * e) + ' ' + n(3.5 * e) + ' 0 0 1 ' + n(x + 3.3 * e) + ' ' + n(y - 19.2 * e) + 'Z', fi: METAL });
    /* escudo */
    L.push({ d: circ(x + 1.8 * e, y - 11.6 * e, 3.5 * e), fi: METAL });
    L.push({ d: circ(x + 1.8 * e, y - 11.6 * e, 2.1 * e), fi: DONO });
  }
  function explorador(L, x, y, e, passo, ferramenta) {
    /* mochila, atrás das costas */
    L.push({ d: 'M' + n(x - 6.2 * e) + ' ' + n(y - 16.2 * e) + 'h' + n(4.2 * e) + 'v' + n(8.4 * e) + 'h' + n(-4.2 * e) + 'Z', fi: COURO });
    if (ferramenta === 'picareta') {
      L.push({ d: seg(x + 7 * e, y - 6 * e, x - 1 * e, y - 22 * e), st: COURO, w: 1.3 * e });
      L.push({ d: 'M' + n(x - 5.4 * e) + ' ' + n(y - 21 * e) + 'Q' + n(x - 1 * e) + ' ' + n(y - 25.4 * e) + ' ' + n(x + 3.6 * e) + ' ' + n(y - 24.2 * e), st: METAL, w: 1.6 * e });
    } else {
      /* cajado com a ponta curva */
      L.push({ d: 'M' + n(x + 6.4 * e) + ' ' + n(y) + 'L' + n(x + 6.4 * e) + ' ' + n(y - 21 * e) + 'Q' + n(x + 6.4 * e) + ' ' + n(y - 24.2 * e) + ' ' + n(x + 3.4 * e) + ' ' + n(y - 23.4 * e), st: CLARO, w: 1.4 * e });
    }
    pessoa(L, x, y, e, passo, CLARO);
    /* chapéu de aba larga, na cor do dono */
    L.push({ d: seg(x - 5 * e, y - 20.4 * e, x + 5 * e, y - 20.4 * e), st: DONO, w: 1.7 * e });
    L.push({ d: 'M' + n(x - 2.6 * e) + ' ' + n(y - 20.4 * e) + 'L' + n(x - 2 * e) + ' ' + n(y - 24 * e) + 'L' + n(x + 2 * e) + ' ' + n(y - 24 * e) + 'L' + n(x + 2.6 * e) + ' ' + n(y - 20.4 * e) + 'Z', fi: DONO });
  }
  /* cavalo e cavaleiro: explorador a cavalo e mensageiro */
  function cavaleiro(L, x, y, e, passo, cor, mastro) {
    var px = passo === 0
      ? seg(x - 7 * e, y - 8 * e, x - 11 * e, y) + seg(x - 5 * e, y - 8 * e, x - 2 * e, y) + seg(x + 6 * e, y - 8 * e, x + 3 * e, y) + seg(x + 8 * e, y - 8 * e, x + 12 * e, y)
      : seg(x - 7 * e, y - 8 * e, x - 7 * e, y) + seg(x - 5 * e, y - 8 * e, x - 5 * e, y) + seg(x + 6 * e, y - 8 * e, x + 6 * e, y) + seg(x + 8 * e, y - 8 * e, x + 8 * e, y);
    L.push({ d: px, st: CAVALO, w: 1.9 * e });
    L.push({ d: 'M' + n(x - 10 * e) + ' ' + n(y - 12.4 * e) + 'Q' + n(x - 14 * e) + ' ' + n(y - 11 * e) + ' ' + n(x - 13.4 * e) + ' ' + n(y - 5.4 * e), st: ESC, w: 1.6 * e });
    L.push({ d: 'M' + n(x - 10 * e) + ' ' + n(y - 13 * e) + 'L' + n(x + 8 * e) + ' ' + n(y - 13.4 * e) + 'L' + n(x + 12.4 * e) + ' ' + n(y - 21 * e) + 'L' + n(x + 16 * e) + ' ' + n(y - 20 * e) + 'L' + n(x + 15.4 * e) + ' ' + n(y - 16.6 * e) + 'L' + n(x + 11.6 * e) + ' ' + n(y - 9 * e) + 'L' + n(x - 8.6 * e) + ' ' + n(y - 7.4 * e) + 'Z', fi: CAVALO });
    L.push({ d: seg(x - 1 * e, y - 13 * e, x, y - 21 * e), st: cor, w: 4 * e });
    L.push({ d: seg(x - 0.6 * e, y - 18 * e, x + 4 * e, y - 14.6 * e), st: cor, w: 1.8 * e });
    L.push({ d: circ(x + 0.4 * e, y - 24.6 * e, 2.7 * e), fi: PELE });
    if (mastro) {
      L.push({ d: seg(x - 4 * e, y - 13 * e, x - 4 * e, y - 33 * e), st: COURO, w: 1.3 * e });
      L.push({ d: 'M' + n(x - 4 * e) + ' ' + n(y - 33 * e) + 'L' + n(x - 15 * e) + ' ' + n(y - 30 * e) + 'L' + n(x - 4 * e) + ' ' + n(y - 26 * e) + 'Z', fi: BRANCO });
    } else L.push({ d: seg(x - 3.8 * e, y - 25.6 * e, x + 4.6 * e, y - 25.6 * e), st: DONO, w: 1.7 * e });
  }
  /* carroça puxada: a roda troca de raios para parecer rodar */
  function carroca(L, x, y, e, passo) {
    var ra = 4.2 * e, r1 = x - 6 * e, r2 = x + 4 * e, cy = y - ra, s = ra * 0.7;
    L.push({ d: 'M' + n(x - 13 * e) + ' ' + n(y - 15 * e) + 'h' + n(21 * e) + 'v' + n(7 * e) + 'h' + n(-21 * e) + 'Z', fi: COURO });
    L.push({ d: 'M' + n(x - 11 * e) + ' ' + n(y - 15 * e) + 'Q' + n(x - 3 * e) + ' ' + n(y - 25 * e) + ' ' + n(x + 6 * e) + ' ' + n(y - 15 * e) + 'Z', fi: CLARO });
    L.push({ d: seg(x + 8 * e, y - 10.5 * e, x + 15 * e, y - 8 * e), st: COURO, w: 1.5 * e });
    L.push({ d: circ(r1, cy, ra) + circ(r2, cy, ra), fi: COURO });
    var raio = passo === 0
      ? seg(r1 - s, cy, r1 + s, cy) + seg(r1, cy - s, r1, cy + s) + seg(r2 - s, cy, r2 + s, cy) + seg(r2, cy - s, r2, cy + s)
      : seg(r1 - s * 0.7, cy - s * 0.7, r1 + s * 0.7, cy + s * 0.7) + seg(r1 - s * 0.7, cy + s * 0.7, r1 + s * 0.7, cy - s * 0.7) + seg(r2 - s * 0.7, cy - s * 0.7, r2 + s * 0.7, cy + s * 0.7) + seg(r2 - s * 0.7, cy + s * 0.7, r2 + s * 0.7, cy - s * 0.7);
    L.push({ d: raio, st: DONO, w: 1 * e });
  }

  var FIGURAS = {
    /* sempre o mesmo trio, seja a marcha de quem for: o marcador não diz o tamanho */
    tropa: function (L, q) { soldado(L, -11, 8, 0.8, 1 - q); soldado(L, -3.5, 10, 0.88, q); soldado(L, 5, 12, 1, 1 - q, true); },
    explorador: function (L, q) { explorador(L, 0, 12, 1.08, q); },
    prospector: function (L, q) { explorador(L, 0, 12, 1.08, q, 'picareta'); },
    'explorador-cavalo': function (L, q) { cavaleiro(L, -1, 12, 1, q, CLARO); },
    mensageiro: function (L, q) { cavaleiro(L, 1, 12, 1, q, DONO, true); },
    caravana: function (L, q) { carroca(L, -1, 11, 1.08, q); },
    carregadores: function (L, q) {
      L.push({ d: circ(-5.4, -2.4, 4.1), fi: COURO });
      pessoa(L, 0, 12, 1.05, q, CLARO);
    },
    pessoas: function (L, q) { pessoa(L, 0, 12, 1.05, q, CLARO); }
  };
  /* junta as camadas seguidas de mesmo estilo num caminho só (menos elementos, e a figura sai inteira) */
  function camadas(nome, q) {
    var L = [], out = [];
    FIGURAS[nome](L, q);
    L.forEach(function (x) {
      var u = out[out.length - 1];
      if (u && u.fi === x.fi && u.st === x.st && u.w === x.w) u.d += x.d; else out.push({ d: x.d, fi: x.fi, st: x.st, w: x.w });
    });
    return out;
  }
  var CONTORNO = 2.2;

  /* ---------------------------------------------------------------- qual figura */
  function oficioDe(m) {
    if (m.oficio) return String(m.oficio);
    var ids = m.pessoaIds || [];
    for (var i = 0; i < ids.length; i++) { var p = M.pessoa(ids[i]); if (p && /^(explorador|prospector|batedor)/.test(p.oficio)) return p.oficio; }
    return '';
  }
  function ehExplorador(m) { return /explor|batedor|prospector/.test(String(m.marcha || '')) || /^(explorador|prospector|batedor)/.test(oficioDe(m)); }
  /* batedor de elite é furtivo: nenhum rastro, nem no mapa do dono */
  function furtiva(m) { return /batedor/.test(String(m.marcha || '')) || /^batedor/.test(oficioDe(m)); }
  function figuraDe(m) {
    var t = String(m.marcha || '');
    if (t === 'caravana' || t === 'carregadores' || t === 'pessoas' || t === 'mensageiro') return t;
    if (ehExplorador(m)) { var of = oficioDe(m); return /cavalo/.test(of) ? 'explorador-cavalo' : /prospector/.test(of + t) ? 'prospector' : 'explorador'; }
    return 'tropa';
  }

  /* ---------------------------------------------------------------- SVG: cada figura definida uma vez e usada por <use> */
  function corSvg(c) { return c === DONO ? 'var(--dono)' : c; }
  function svgCamadas(L) {
    var fundo = '', cima = '';
    L.forEach(function (x) {
      fundo += '<path d="' + x.d + '" style="fill:' + (x.fi ? ESC : 'none') + ';stroke:' + ESC + ';stroke-width:' + n((x.w || 0) + CONTORNO) + '"/>';
      cima += '<path d="' + x.d + '" style="fill:' + (x.fi ? corSvg(x.fi) : 'none') + ';stroke:' + (x.st ? corSvg(x.st) : 'none') + (x.w ? ';stroke-width:' + n(x.w) : '') + '"/>';
    });
    return fundo + cima;
  }
  function injetarDefs() {
    if (document.getElementById('rp-marchas-defs')) return;
    var h = '<svg id="rp-marchas-defs" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden" xmlns="http://www.w3.org/2000/svg"><defs>';
    Object.keys(FIGURAS).forEach(function (k) {
      [0, 1].forEach(function (q) { h += '<g id="mcf-' + k + '-' + q + '" stroke-linecap="round" stroke-linejoin="round">' + svgCamadas(camadas(k, q)) + '</g>'; });
    });
    var d = document.createElement('div');
    d.innerHTML = h + '</defs></svg>';
    document.body.appendChild(d.firstChild);
  }
  /* o miolo do marcador, centrado em (0, 0): sombra, sinal de rumo, sonar de quem explora e os dois passos da figura */
  function svgMarcador(m, andando, ang) {
    injetarDefs();
    var fig = figuraDe(m), expl = ehExplorador(m), vira = Math.cos(ang) < 0;
    return '<g class="mc-esc">' +
      '<ellipse class="mc-chao" cy="12.5" rx="' + (fig === 'tropa' ? 17 : 12) + '" ry="4"/>' +
      (expl ? '<circle class="mc-sonar" r="19"/>' : '') +
      '<g class="mc-rumo" transform="rotate(' + n(ang * 180 / Math.PI) + ')"><path class="mc-rumo-f" d="M23 -5.5 29.5 0 23 5.5"/><path class="mc-rumo-c" d="M23 -5.5 29.5 0 23 5.5"/></g>' +
      '<g class="mc-fig" transform="scale(' + (vira ? -1 : 1) + ' 1)"><use class="mc-passo-a" href="#mcf-' + fig + '-0"/><use class="mc-passo-b" href="#mcf-' + fig + '-1"/></g>' +
      '</g>';
  }

  /* ---------------------------------------------------------------- Canvas: a mesma figura na Vista afastada */
  var PATHS = {};
  function pathsDe(nome, q) {
    var k = nome + q;
    if (!PATHS[k]) PATHS[k] = camadas(nome, q).map(function (x) { return { p: new Path2D(x.d), fi: x.fi, st: x.st, w: x.w }; });
    return PATHS[k];
  }
  function desenharFigura(c, m, cor, t, andando, ang) {
    var L = pathsDe(figuraDe(m), andando && !semAnimar ? Math.floor(t * 4 + (m.id % 7) * 0.37) % 2 : 1), i, x;
    c.lineCap = 'round'; c.lineJoin = 'round';
    if (Math.cos(ang) < 0) c.scale(-1, 1);
    c.strokeStyle = ESC; c.fillStyle = ESC;
    for (i = 0; i < L.length; i++) { x = L[i]; c.lineWidth = (x.w || 0) + CONTORNO; c.stroke(x.p); if (x.fi) c.fill(x.p); }
    for (i = 0; i < L.length; i++) {
      x = L[i];
      if (x.fi) { c.fillStyle = x.fi === DONO ? cor : x.fi; c.fill(x.p); }
      if (x.st) { c.strokeStyle = x.st === DONO ? cor : x.st; c.lineWidth = x.w; c.stroke(x.p); }
    }
  }

  /* ---------------------------------------------------------------- rastro: amostragem */
  var MAX_HEX = 5, ESPERA_MS = 4000, SUMIR_MS = 1500, AMOSTRA_MS = 100, MAX_DESENHO = 60;
  var rastros = new Map(), ultimaAmostra = 0;
  var semAnimar = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function hexes() { return H.W || 26; }
  function comprimento(pts) {
    var s = 0;
    for (var i = 1; i < pts.length; i++) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return s;
  }
  /* corta a cauda para o rastro (com a cabeça) nunca passar de MAX_HEX hexágonos */
  function aparar(r, cab) {
    var max = MAX_HEX * hexes(), tot = comprimento(r.pts) + (r.pts.length ? Math.hypot(cab.x - r.pts[r.pts.length - 1].x, cab.y - r.pts[r.pts.length - 1].y) : 0);
    while (tot > max && r.pts.length > 1) {
      var a = r.pts[0], b = r.pts[1], l = Math.hypot(b.x - a.x, b.y - a.y), sobra = tot - max;
      if (l <= sobra) { r.pts.shift(); tot -= l; continue; }
      r.pts[0] = { x: a.x + (b.x - a.x) * sobra / l, y: a.y + (b.y - a.y) * sobra / l };
      break;
    }
  }
  function acompanhar(m, ag, agora) {
    var r = rastros.get(m.id), pos = M.posMarcha(m, ag);
    if (!r) {
      r = { pts: [], ux: pos.x, uy: pos.y, ut: agora, mov: -1e9, ang: pos.ang };
      rastros.set(m.id, r);
    }
    r.visto = agora; r.fim = 0; r.m = m; r.ang = pos.ang;
    var salto = Math.hypot(pos.x - r.ux, pos.y - r.uy), dt = agora - r.ut, H1 = hexes();
    r.ux = pos.x; r.uy = pos.y; r.ut = agora;
    if (salto > 0.02) r.mov = agora;
    /* parada: não acumula; aba oculta ou salto grande: não liga dois pontos que não se viu percorrer */
    if (salto > H1 * 6 || (dt > 2500 && salto > H1 * 1.5)) { r.pts = []; }
    if (salto <= 0.02) return;
    var u = r.pts[r.pts.length - 1];
    if (!u) { r.pts.push({ x: pos.x, y: pos.y }); return; }
    var dx = pos.x - u.x, dy = pos.y - u.y, d = Math.hypot(dx, dy);
    if (d < H1 * 0.34) return;
    var p = r.pts[r.pts.length - 2];
    /* meia-volta: o que era o caminho de trás ficaria à frente; o rastro recomeça daqui */
    if (p && (u.x - p.x) * dx + (u.y - p.y) * dy < -0.5 * d * Math.hypot(u.x - p.x, u.y - p.y)) { r.pts = [{ x: u.x, y: u.y }]; }
    r.pts.push({ x: pos.x, y: pos.y });
    aparar(r, pos);
  }
  /* olha todas as marchas (no máximo a cada AMOSTRA_MS) e limpa quem parou ou saiu do feed */
  function amostrar(agora) {
    var d = M.dados;
    if (agora - ultimaAmostra < AMOSTRA_MS) return;
    ultimaAmostra = agora;
    if (!d) { rastros.clear(); return; }
    var ag = RP.agora();
    (d.marchas || []).forEach(function (m) { if (furtiva(m)) rastros.delete(m.id); else acompanhar(m, ag, agora); });
    rastros.forEach(function (r, id) {
      if (r.visto !== agora) {
        if (!r.fim) r.fim = agora;
        if (agora - r.fim > SUMIR_MS) rastros.delete(id);
      } else if (r.pts.length && agora - r.mov > ESPERA_MS + SUMIR_MS) r.pts = [];
    });
  }
  /* anda agora? O feed de outro reino só diz o passo atual: a espera cobre o tempo até o próximo pedido */
  function andando(m, ag, agora) {
    if (m.parado || m.estado === 'trabalhando') return false;
    var tp = m.tempos;
    if (tp && tp.length >= 2 && ag < tp[tp.length - 1]) return true;
    var r = rastros.get(m.id);
    return !!(r && agora - r.mov < ESPERA_MS);
  }
  function opacidade(r, agora) {
    if (r.fim) return Math.max(0, 1 - (agora - r.fim) / SUMIR_MS);
    var par = agora - r.mov - ESPERA_MS;
    return par <= 0 ? 1 : Math.max(0, 1 - par / SUMIR_MS);
  }
  /* alguém anda, ou há rastro para apagar, à vista? (vis: retângulo do mapa na tela) */
  function haMovimento(vis) {
    var d = M.dados, ag = RP.agora(), agora = performance.now(), mg = (MAX_HEX + 2) * hexes();
    function naVista(x, y) { return x > vis.x - mg && x < vis.x + vis.w + mg && y > vis.y - mg && y < vis.y + vis.h + mg; }
    var tem = false;
    rastros.forEach(function (r) { if (r.pts.length && naVista(r.ux, r.uy)) tem = true; });
    if (tem) return true;
    return !!(d && (d.marchas || []).some(function (m) { if (!andando(m, ag, agora)) return false; var p = M.posMarcha(m, ag); return naVista(p.x, p.y); }));
  }

  /* ---------------------------------------------------------------- rastro: desenho (ctx no espaço do mundo, no chão) */
  var FAIXAS = 4;
  /* estilos: largura da faixa, distância entre as marcas e o tipo de marca; só dependem do tipo da marcha */
  var ESTILO = {
    tropa: { largura: 8, passo: 11, marca: 'seta', alfa: 0.85 },
    explorador: { largura: 3.4, passo: 5.5, marca: 'pegada', alfa: 0.75 },
    rodas: { largura: 2.2, passo: 8, marca: 'sulco', alfa: 0.8 }
  };
  function estiloDe(m) {
    var t = String(m.marcha || '');
    if (t === 'caravana') return ESTILO.rodas;
    return t === 'exercito' || figuraDe(m) === 'tropa' ? ESTILO.tropa : ESTILO.explorador;
  }
  /* percorre a linha da cauda à cabeça: f(x, y, ux, uy, frac) a cada distância pedida (com fase, para as marcas andarem) */
  function marcas(pts, total, passo, fase, f) {
    var i = 1, a = pts[0], b = pts[1], la = Math.hypot(b.x - a.x, b.y - a.y), feito = 0, s = fase % passo, k = 0;
    while (s < total) {
      while (s > feito + la && i < pts.length - 1) { feito += la; i++; a = pts[i - 1]; b = pts[i]; la = Math.hypot(b.x - a.x, b.y - a.y); }
      if (la > 0) {
        var q = (s - feito) / la, ux = (b.x - a.x) / la, uy = (b.y - a.y) / la;
        f(a.x + (b.x - a.x) * q, a.y + (b.y - a.y) * q, ux, uy, s / total, k);
      }
      s += passo; k++;
    }
  }
  function linhaFaixa(c, pts, de, ate, total) {
    /* o trecho da linha entre as frações de e ate do comprimento */
    var feito = 0, i, a, b, la, abriu = false;
    for (i = 1; i < pts.length; i++) {
      a = pts[i - 1]; b = pts[i]; la = Math.hypot(b.x - a.x, b.y - a.y);
      var s0 = feito / total, s1 = (feito + la) / total;
      feito += la;
      if (s1 < de || s0 > ate || !la) continue;
      var q0 = Math.max(0, (de - s0) / (s1 - s0)), q1 = Math.min(1, (ate - s0) / (s1 - s0));
      if (!abriu) { c.moveTo(a.x + (b.x - a.x) * q0, a.y + (b.y - a.y) * q0); abriu = true; }
      c.lineTo(a.x + (b.x - a.x) * q1, a.y + (b.y - a.y) * q1);
    }
  }
  function desenharRastro(c, r, cor, op, cab, t, u) {
    var pts = r.pts.slice(), e = estiloDe(r.m), idx;
    if (cab) pts.push(cab);
    if (pts.length < 2) return;
    var total = comprimento(pts);
    if (total < 1) return;
    c.lineCap = 'round'; c.lineJoin = 'round';
    /* a faixa: mais forte perto da unidade, some na cauda */
    for (idx = 0; idx < FAIXAS; idx++) {
      var a0 = idx / FAIXAS, a1 = (idx + 1) / FAIXAS, al = op * e.alfa * (idx + 1) / FAIXAS;
      c.beginPath(); linhaFaixa(c, pts, a0, a1, total);
      c.globalAlpha = al * 0.55; c.strokeStyle = ESC; c.lineWidth = (e.largura + 2) * u; c.stroke();
      c.globalAlpha = al; c.strokeStyle = cor; c.lineWidth = e.largura * u; c.stroke();
    }
    /* as marcas andam da cauda para a cabeça, no sentido em que a unidade vai */
    var fase = semAnimar ? 0 : t * 14 * u, passo = e.passo * u, porFaixa = [];
    for (idx = 0; idx < FAIXAS; idx++) porFaixa.push(new Path2D());
    marcas(pts, total, passo, fase, function (x, y, ux, uy, fr, k) {
      var p = porFaixa[Math.min(FAIXAS - 1, Math.floor(fr * FAIXAS))], nx = -uy, ny = ux;
      if (e.marca === 'seta') {
        var w = 3.2 * u, l = 2.6 * u;
        p.moveTo(x - ux * l + nx * w, y - uy * l + ny * w); p.lineTo(x + ux * l, y + uy * l); p.lineTo(x - ux * l - nx * w, y - uy * l - ny * w);
      } else if (e.marca === 'pegada') {
        var lado = (k % 2 ? 1 : -1) * 1.7 * u, px = x + nx * lado, py = y + ny * lado;
        p.moveTo(px - ux * 1.5 * u, py - uy * 1.5 * u); p.lineTo(px + ux * 1.5 * u, py + uy * 1.5 * u);
      } else {
        [-3.2, 3.2].forEach(function (o) { var qx = x + nx * o * u, qy = y + ny * o * u; p.moveTo(qx - ux * 2.5 * u, qy - uy * 2.5 * u); p.lineTo(qx + ux * 2.5 * u, qy + uy * 2.5 * u); });
      }
    });
    for (idx = 0; idx < FAIXAS; idx++) {
      var alfa = op * (0.25 + 0.75 * (idx + 1) / FAIXAS);
      c.globalAlpha = alfa; c.strokeStyle = ESC; c.lineWidth = (e.marca === 'seta' ? 3 : 2.4) * u; c.stroke(porFaixa[idx]);
      c.strokeStyle = e.marca === 'seta' ? CLARO : cor; c.lineWidth = (e.marca === 'seta' ? 1.5 : 1.3) * u; c.stroke(porFaixa[idx]);
    }
    c.globalAlpha = 1;
  }
  /* desenha os rastros à vista; vis: retângulo do mapa na tela; u: unidades do mundo por unidade do desenho (zoom) */
  function desenhar(c, vis, t, u) {
    var agora = performance.now(), ag = RP.agora(), feitos = 0, mg = MAX_HEX * hexes();
    rastros.forEach(function (r) {
      if (feitos >= MAX_DESENHO || !r.pts.length || !r.m) return;
      var ult = r.pts[r.pts.length - 1];
      if (ult.x < vis.x - mg || ult.x > vis.x + vis.w + mg || ult.y < vis.y - mg || ult.y > vis.y + vis.h + mg) return;
      var op = opacidade(r, agora);
      if (op <= 0.01) return;
      /* a cabeça é onde a unidade está agora, para o rastro chegar nos pés dela */
      var cab = r.fim ? null : M.posMarcha(r.m, ag);
      desenharRastro(c, r, A.corDono(r.m.dono, r.m), op, cab, t, u);
      feitos++;
    });
  }

  RP.marchasMapa = {
    figuraDe: figuraDe, ehExplorador: ehExplorador, furtiva: furtiva,
    svgMarcador: svgMarcador, desenharFigura: desenharFigura,
    amostrar: amostrar, andando: andando, haMovimento: haMovimento, desenhar: desenhar,
    /* para conferir em teste: { id: { pontos, comprimento em hexágonos } } */
    estado: function () {
      var o = {};
      rastros.forEach(function (r, id) { o[id] = { pontos: r.pts.length, hexagonos: +(comprimento(r.pts) / hexes()).toFixed(2) }; });
      return o;
    }
  };
})();
