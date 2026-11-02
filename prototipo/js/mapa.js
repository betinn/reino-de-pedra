/* Reino de Pedra — tela do mapa do mundo.
   SVG com camadas (terreno, rios, rotas, véu de explorado, névoa, entidades),
   pan/zoom por gesto (arrastar, pinça, roda) e por botões, e minimapa em canvas. */
(function () {
  'use strict';
  var RP = window.RP, H = RP.hex, D = RP.dados;

  /* ================================================================ modelo do mundo */
  var forcados = D.locais.map(function (x) { return [x.c, x.l, x.terreno]; })
    .concat(D.jazidas.map(function (j) { return [j.c, j.l, j.terreno]; }));
  var T = H.gerarTerreno(forcados);
  var rios = H.FEICOES.rios.map(function (r) { return H.caminho(r); });
  var rioSet = {};
  rios.forEach(function (r) { r.forEach(function (h) { rioSet[h[0] + ',' + h[1]] = 1; }); });
  var rotas = D.rotas.map(function (r) { return { d: r, hexes: H.caminho(r.pts) }; });

  function k(c, l) { return c + ',' + l; }
  function dentro(c, l) { return c >= 0 && l >= 0 && c < H.COLS && l < H.LINS; }
  function noRaio(c, l, raio, fn) {
    for (var ll = l - raio; ll <= l + raio; ll++) {
      for (var cc = c - raio - 1; cc <= c + raio + 1; cc++) {
        if (dentro(cc, ll) && H.dist([c, l], [cc, ll]) <= raio) fn(cc, ll);
      }
    }
  }

  /* posição atual das marchas (fração do caminho) */
  function pontosCaminho(hexes) { return hexes.map(function (h) { return H.centro(h[0], h[1]); }); }
  function comprimento(p) { var s = 0; for (var i = 1; i < p.length; i++) s += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y); return s; }
  function pontoEm(p, frac) {
    var alvo = comprimento(p) * frac, s = 0, i, seg;
    for (i = 1; i < p.length; i++) {
      seg = Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
      if (s + seg >= alvo) {
        var t = (alvo - s) / seg;
        return { x: p[i - 1].x + (p[i].x - p[i - 1].x) * t, y: p[i - 1].y + (p[i].y - p[i - 1].y) * t, i: i };
      }
      s += seg;
    }
    return { x: p[p.length - 1].x, y: p[p.length - 1].y, i: p.length - 1 };
  }
  var marchas = D.marchas.map(function (m) {
    var hexes = H.caminho(m.pts), p = pontosCaminho(hexes), atual = pontoEm(p, m.pos);
    var h = H.pixelParaHex(atual.x, atual.y);
    return { d: m, hexes: hexes, p: p, atual: atual, hex: [h.c, h.l] };
  });

  /* ================================================================ visão e névoa */
  var EST = {};
  D.explorado.forEach(function (a) {
    noRaio(a.c, a.l, a.raio, function (c, l) {
      var e = EST[k(c, l)];
      if (!e || e.horas > a.horas) EST[k(c, l)] = { v: 'explorado', horas: a.horas };
    });
  });
  marchas.forEach(function (m) {
    if (m.d.dono !== 'meu') return;
    var raio = m.d.tipo === 'explorador' ? D.visao.explorador[m.d.sub] : D.visao.exercito;
    for (var i = 0; i < m.atual.i; i++) {
      noRaio(m.hexes[i][0], m.hexes[i][1], raio, function (c, l) {
        var e = EST[k(c, l)];
        if (!e || e.horas > 1) EST[k(c, l)] = { v: 'explorado', horas: 1 };
      });
    }
  });
  function ver(c, l, raio) { noRaio(c, l, raio, function (cc, ll) { EST[k(cc, ll)] = { v: 'visivel', horas: 0 }; }); }
  D.locais.forEach(function (x) { if (x.reino === 'meu') ver(x.c, x.l, x.tipo === 'castelo' ? D.visao.castelo : D.visao.local); });
  marchas.forEach(function (m) {
    if (m.d.dono !== 'meu') return;
    ver(m.hex[0], m.hex[1], m.d.tipo === 'explorador' ? D.visao.explorador[m.d.sub] : D.visao.exercito);
  });
  function estado(c, l) { return EST[k(c, l)] || { v: 'desconhecido' }; }

  /* índices por hex */
  var porHex = {};
  function indexar(tipo, obj, c, l) { (porHex[k(c, l)] = porHex[k(c, l)] || []).push({ tipo: tipo, o: obj }); }
  D.locais.forEach(function (x) { indexar('local', x, x.c, x.l); });
  D.jazidas.forEach(function (j) { indexar('jazida', j, j.c, j.l); });
  D.bandeiras.forEach(function (b) { indexar('bandeira', b, b.c, b.l); });
  rotas.forEach(function (r) { r.hexes.forEach(function (h) { indexar('rota', r.d, h[0], h[1]); }); });
  D.vaus.forEach(function (v) { indexar('vau', v, v.c, v.l); });

  /* ================================================================ desenho */
  function n1(v) { return v.toFixed(1); }
  function curvaPts(p) {
    if (p.length < 2) return '';
    var d = 'M' + n1(p[0].x) + ' ' + n1(p[0].y), i, p0, p1, p2, p3;
    for (i = 0; i < p.length - 1; i++) {
      p0 = p[i - 1] || p[i]; p1 = p[i]; p2 = p[i + 1]; p3 = p[i + 2] || p2;
      d += 'C' + n1(p1.x + (p2.x - p0.x) / 6) + ' ' + n1(p1.y + (p2.y - p0.y) / 6) + ' ' + n1(p2.x - (p3.x - p1.x) / 6) + ' ' + n1(p2.y - (p3.y - p1.y) / 6) + ' ' + n1(p2.x) + ' ' + n1(p2.y);
    }
    return d;
  }

  var SIMBOLO = { floresta: ['m-arvores-1', 'm-arvores-2'], colina: ['m-colina'], montanha: ['m-monte'], pantano: ['m-junco'], planicie: ['m-grama'] };

  function svgTerreno(filtro) {
    var h = '', c, l, ce, t, e, alt, s, sim, rr;
    for (l = 0; l < H.LINS; l++) {
      for (c = 0; c < H.COLS; c++) {
        if (filtro && !filtro(c, l)) continue;
        e = estado(c, l);
        if (!filtro && e.v === 'desconhecido') continue;
        t = T[l][c]; ce = H.centro(c, l);
        alt = H.hash(c, l, 3) > 0.55 ? '-2' : '';
        h += '<polygon class="hx t-' + t + alt + '" points="' + H.cantos(ce.x, ce.y, H.R + 0.6) + '"/>';
        sim = SIMBOLO[t];
        if (sim && !(t === 'planicie' && H.hash(c, l, 5) > 0.32)) {
          s = sim[Math.floor(H.hash(c, l, 7) * sim.length)];
          rr = 0.82 + H.hash(c, l, 9) * 0.25;
          h += '<use class="sim" href="#' + s + '" transform="translate(' + n1(ce.x + (H.hash(c, l, 11) - 0.5) * 6) + ' ' + n1(ce.y + (H.hash(c, l, 13) - 0.5) * 5) + ') scale(' + rr.toFixed(2) + ')"/>';
        }
      }
    }
    return h;
  }
  function svgRios() {
    return rios.map(function (r) {
      var d = H.curva(r);
      return '<path class="rio-margem" d="' + d + '"/><path class="rio-agua" d="' + d + '"/><path class="rio-brilho" d="' + d + '"/>';
    }).join('');
  }
  function svgRotas() {
    var h = '';
    rotas.forEach(function (r) {
      var d = H.curva(r.hexes);
      h += '<path class="rota-borda" d="' + d + '"/><path class="rota" d="' + d + '"/>';
    });
    rotas.forEach(function (r) {
      r.hexes.forEach(function (hx, i) {
        if (!rioSet[k(hx[0], hx[1])]) return;
        var a = H.centro(r.hexes[Math.max(0, i - 1)][0], r.hexes[Math.max(0, i - 1)][1]);
        var b = H.centro(r.hexes[Math.min(r.hexes.length - 1, i + 1)][0], r.hexes[Math.min(r.hexes.length - 1, i + 1)][1]);
        var ce = H.centro(hx[0], hx[1]);
        var ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
        h += '<use class="ponte" href="#m-ponte" transform="translate(' + n1(ce.x) + ' ' + n1(ce.y) + ') rotate(' + ang.toFixed(0) + ')"/>';
      });
    });
    D.vaus.forEach(function (v) {
      var ce = H.centro(v.c, v.l);
      h += '<use class="vau" href="#m-vau" transform="translate(' + n1(ce.x) + ' ' + n1(ce.y) + ') rotate(-30)"/>';
    });
    return h;
  }
  var DIRS_PAR = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
  var DIRS_IMP = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];
  var ARESTA = [[0, 1], [5, 0], [4, 5], [3, 4], [2, 3], [1, 2]];
  function cantoXY(cx, cy, i) { var a = (Math.PI / 180) * (60 * i - 30); return [cx + H.R * Math.cos(a), cy + H.R * Math.sin(a)]; }
  function svgNevoa() {
    var veu = '', nev = '', borda = '', c, l, e, ce, i, dirs, nc, nl, ne, ar, p1, p2;
    for (l = 0; l < H.LINS; l++) {
      for (c = 0; c < H.COLS; c++) {
        e = estado(c, l); ce = H.centro(c, l);
        if (e.v === 'explorado') veu += '<polygon points="' + H.cantos(ce.x, ce.y, H.R + 0.6) + '"/>';
        if (e.v === 'desconhecido') {
          nev += '<polygon class="nv-' + (1 + Math.floor(H.hash(c, l, 17) * 3)) + '" points="' + H.cantos(ce.x, ce.y, H.R + 1) + '"/>';
          continue;
        }
        dirs = (l & 1) ? DIRS_IMP : DIRS_PAR;
        for (i = 0; i < 6; i++) {
          nc = c + dirs[i][0]; nl = l + dirs[i][1];
          ne = dentro(nc, nl) ? estado(nc, nl).v : 'fora';
          if (ne === 'desconhecido') {
            ar = ARESTA[i]; p1 = cantoXY(ce.x, ce.y, ar[0]); p2 = cantoXY(ce.x, ce.y, ar[1]);
            borda += 'M' + n1(p1[0]) + ' ' + n1(p1[1]) + 'L' + n1(p2[0]) + ' ' + n1(p2[1]);
          }
        }
      }
    }
    var rotulos = [[5, 9], [39, 16], [22, 31], [14, 3], [41, 1], [2, 21], [28, 29]].filter(function (p) { return estado(p[0], p[1]).v === 'desconhecido'; })
      .map(function (p) { var ce = H.centro(p[0], p[1]); return '<text class="nevoa-rotulo" x="' + n1(ce.x) + '" y="' + n1(ce.y) + '">Terra incógnita</text>'; }).join('');
    return '<g class="camada-explorado">' + veu + '</g><g class="camada-nevoa">' + nev + rotulos + '</g><path class="borda-nevoa" d="' + borda + '"/>';
  }

  function corDono(reino) { return 'dono-' + (D.reinos[reino] ? D.reinos[reino].cor : 'desconhecido'); }
  function rotuloSvg(txt, y, cls) {
    return '<text class="ent-rotulo ' + (cls || '') + '" y="' + y + '">' + RP.esc(txt) + '</text>';
  }

  function svgLocal(x, opt) {
    opt = opt || {};
    var ce = H.centro(x.c, x.l), e = estado(x.c, x.l);
    if (!opt.todos && e.v === 'desconhecido') return '';
    var castelo = x.tipo === 'castelo';
    var antigo = e.v === 'explorado' ? ' antigo' : '';
    var nomeReino = D.reinos[x.reino].nome;
    var h = '<g class="ent local' + (castelo ? ' castelo' : '') + ' ' + corDono(x.reino) + antigo + (x.ameaca ? ' ameacado' : '') + '" data-ent="local:' + x.id + '" transform="translate(' + n1(ce.x) + ' ' + n1(ce.y) + ')">' +
      '<circle class="ponto" r="' + (castelo ? 9 : 6) + '"/><g class="ent-k">' +
      '<circle class="alvo-toque" r="24"/>';
    if (x.ameaca) h += '<circle class="anel-ameaca" r="' + (castelo ? 27 : 21) + '"/>';
    if (castelo) {
      h += '<circle class="lc-base" r="21"/><circle class="lc-anel" r="16.5"/>' +
        '<use href="#i-castelo" x="-13" y="-14" width="26" height="26"/>' +
        '<g transform="translate(9 -30)">' + RP.brasao(D.reinos[x.reino].brasao, { tamanho: 20, desconhecido: !D.reinos[x.reino].brasao }) + '</g>' +
        rotuloSvg(x.reino === 'meu' ? D.reinos.meu.nome : nomeReino, 38, 'rotulo-castelo');
    } else {
      h += '<circle class="lc-base" r="15"/><use href="#i-' + x.tipo + '" x="-10" y="-10.5" width="20" height="20"/>' +
        rotuloSvg(x.nome, 30, '');
    }
    if (antigo) h += '<g class="selo-antigo-mapa" transform="translate(' + (castelo ? 16 : 11) + ' ' + (castelo ? 14 : 10) + ')"><circle r="7.5"/><use href="#i-relogio" x="-6" y="-6" width="12" height="12"/></g>';
    return h + '</g></g>';
  }
  function svgJazida(j) {
    var ce = H.centro(j.c, j.l), e = estado(j.c, j.l);
    if (e.v === 'desconhecido') return '';
    return '<g class="ent jazida ' + j.classe + (e.v === 'explorado' ? ' antigo' : '') + '" data-ent="jazida:' + j.id + '" transform="translate(' + n1(ce.x) + ' ' + n1(ce.y) + ')">' +
      '<circle class="ponto" r="5"/><g class="ent-k"><circle class="alvo-toque" r="22"/>' +
      (j.classe === 'lendario' ? '<circle class="brilho-lendario" r="20"/>' : '') +
      '<rect class="jz-base" x="-12" y="-12" width="24" height="24" rx="4" transform="rotate(45)"/>' +
      '<use class="r-' + j.tipo + '" href="#i-' + j.tipo + '" x="-9.5" y="-9.5" width="19" height="19"/>' +
      rotuloSvg(j.nome, 31, '') + '</g></g>';
  }
  function svgBandeira(b) {
    var ce = H.centro(b.c, b.l), e = estado(b.c, b.l);
    if (e.v === 'desconhecido') return '';
    return '<g class="ent bandeira ' + corDono(b.reino) + (e.v === 'explorado' ? ' antigo' : '') + '" data-ent="bandeira:' + b.id + '" transform="translate(' + n1(ce.x + 4) + ' ' + n1(ce.y + 4) + ')">' +
      '<g class="ent-k"><circle class="alvo-toque" r="20"/>' +
      '<ellipse class="bd-sombra" cx="-6" cy="14" rx="6" ry="2.2"/>' +
      '<path class="bd-mastro" d="M-6 14V-20"/>' +
      '<path class="bd-pano" d="M-6-19H13L8.5-12.5 13-6H-6Z"/>' +
      '<circle class="bd-topo" cx="-6" cy="-21" r="2.2"/></g></g>';
  }
  function iconeMarcha(m) {
    if (m.d.tipo === 'explorador') return { cavalo: 'cavalo', pe: 'bota', prospector: 'picareta', batedor: 'batedor' }[m.d.sub];
    return 'tropas';
  }
  function svgMarchas() {
    var rotasH = '', tokens = '';
    marchas.forEach(function (m) {
      var meu = m.d.dono === 'meu';
      var e = estado(m.hex[0], m.hex[1]);
      if (!meu && e.v !== 'visivel') return;
      var resto = [m.atual].concat(m.p.slice(m.atual.i));
      var fimP = m.p[m.p.length - 1];
      var cls = corDono(m.d.dono) + (m.d.hostil ? ' hostil' : '');
      rotasH += '<path class="marcha-rota ' + cls + '" d="' + curvaPts(resto) + '"/>' +
        '<circle class="marcha-destino ' + cls + '" cx="' + n1(fimP.x) + '" cy="' + n1(fimP.y) + '" r="7"/>';
      var explorador = m.d.tipo === 'explorador';
      var r = explorador ? 12 : 15;
      tokens += '<g class="ent marcha ' + cls + (explorador ? ' explorador' : '') + '" data-ent="marcha:' + m.d.id + '" transform="translate(' + n1(m.atual.x) + ' ' + n1(m.atual.y) + ')">' +
        '<g class="ent-k"><circle class="alvo-toque" r="24"/>' +
        (m.d.hostil ? '<circle class="anel-ameaca" r="' + (r + 6) + '"/>' : '') +
        '<circle class="mc-base" r="' + r + '"/>' +
        '<use href="#i-' + iconeMarcha(m) + '" x="' + (-r * 0.66) + '" y="' + (-r * 0.66) + '" width="' + (r * 1.32) + '" height="' + (r * 1.32) + '"/>' +
        (m.d.hostil ? '<g class="mc-selo" transform="translate(12 -12)"><circle r="8"/><text y="4.5">?</text></g>' : '') +
        (m.d.estandarte ? '<g class="mc-estandarte" transform="translate(13 -15)"><use href="#i-estandarte" x="-8" y="-8" width="16" height="16"/></g>' : '') +
        '<g class="mc-eta" transform="translate(0 ' + (r + 13) + ')"><rect x="-24" y="-10" width="48" height="20" rx="10"/><text y="4.5" data-fim="' + RP.fim(m.d.seg) + '">' + RP.fmtResta(m.d.seg * 1000) + '</text></g>' +
        '</g></g>';
    });
    return { rotas: rotasH, tokens: tokens };
  }

  /* ================================================================ tela */
  var tela, vp, svg, mundo, sel, mm, mmCtx, mmVista;
  var vista = { x: 0, y: 0, s: 0.85 };
  var MIN = 0.2, MAX = 2.2;
  var camadas = { rotas: true, bandeiras: true, recursos: true, marchas: true, rotulos: true };

  function fatorK(s) { var f = Math.max(0.72, Math.min(1.15, Math.pow(s, 0.35))); return f / s; }
  function limitar() {
    var vw = vp.clientWidth, vh = vp.clientHeight, ww = H.LARGURA * vista.s, wh = H.ALTURA * vista.s;
    vista.x = ww <= vw ? (vw - ww) / 2 : Math.min(vw * 0.5, Math.max(vw * 0.5 - ww, vista.x));
    vista.y = wh <= vh ? (vh - wh) / 2 : Math.min(vh * 0.5, Math.max(vh * 0.5 - wh, vista.y));
  }
  var rafAplicar = 0, ultimaVista = { x: 0, y: 0, s: 0.85 };
  function aplicar() {
    if (!isFinite(vista.x) || !isFinite(vista.y) || !isFinite(vista.s)) vista = { x: ultimaVista.x, y: ultimaVista.y, s: ultimaVista.s };
    limitar();
    ultimaVista = { x: vista.x, y: vista.y, s: vista.s };
    mundo.setAttribute('transform', 'translate(' + vista.x.toFixed(1) + ' ' + vista.y.toFixed(1) + ') scale(' + vista.s.toFixed(4) + ')');
    svg.style.setProperty('--k', fatorK(vista.s).toFixed(3));
    var z = vista.s < 0.3 ? 'zoom-mundo' : vista.s < 0.46 ? 'zoom-longe' : vista.s < 0.95 ? 'zoom-medio' : 'zoom-perto';
    if (svg.getAttribute('data-zoom') !== z) svg.setAttribute('data-zoom', z);
    if (!rafAplicar) rafAplicar = requestAnimationFrame(function () { rafAplicar = 0; desenharVistaMinimapa(); });
  }
  function zoomEm(px, py, ns) {
    ns = Math.max(MIN, Math.min(MAX, ns));
    var wx = (px - vista.x) / vista.s, wy = (py - vista.y) / vista.s;
    vista.s = ns; vista.x = px - wx * ns; vista.y = py - wy * ns;
    aplicar();
  }
  var anim = 0;
  function animarPara(alvo, dur) {
    cancelAnimationFrame(anim);
    var ini = { x: vista.x, y: vista.y, s: vista.s }, t0 = performance.now();
    dur = dur || 320;
    (function passo(t) {
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      vista.x = ini.x + (alvo.x - ini.x) * e; vista.y = ini.y + (alvo.y - ini.y) * e; vista.s = ini.s + (alvo.s - ini.s) * e;
      aplicar();
      if (p < 1) anim = requestAnimationFrame(passo);
    })(t0);
  }
  function centrar(wx, wy, s, animar) {
    s = s || vista.s;
    var vw = vp.clientWidth, vh = vp.clientHeight;
    var fy = RP.folhaAberta() ? 0.3 : 0.5;
    var alvo = { s: s, x: vw / 2 - wx * s, y: vh * fy - wy * s };
    if (animar === false) { vista = alvo; aplicar(); } else animarPara(alvo);
  }
  function zoomBotao(f) {
    var vw = vp.clientWidth, vh = vp.clientHeight;
    var ns = Math.max(MIN, Math.min(MAX, vista.s * f));
    var wx = (vw / 2 - vista.x) / vista.s, wy = (vh / 2 - vista.y) / vista.s;
    animarPara({ s: ns, x: vw / 2 - wx * ns, y: vh / 2 - wy * ns }, 220);
  }

  /* ---------------------------------------------------------------- gestos */
  function gestos() {
    var pts = new Map(), arrasto = null, pinca = null, toque = null;
    vp.addEventListener('pointerdown', function (e) {
      cancelAnimationFrame(anim);
      if (e.isPrimary) { pts.clear(); pinca = null; } /* novo gesto: descarta ponteiros que não terminaram */
      vp.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) {
        arrasto = { x: e.clientX, y: e.clientY };
        toque = { x: e.clientX, y: e.clientY, t: performance.now(), movido: false };
      } else if (pts.size === 2) {
        var a = Array.from(pts.values());
        var r = vp.getBoundingClientRect();
        var mx = (a[0].x + a[1].x) / 2 - r.left, my = (a[0].y + a[1].y) / 2 - r.top;
        pinca = { d: Math.max(1, Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y)), s: vista.s, wx: (mx - vista.x) / vista.s, wy: (my - vista.y) / vista.s };
        toque = null; arrasto = null;
      }
    });
    vp.addEventListener('pointermove', function (e) {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinca && pts.size >= 2) {
        var a = Array.from(pts.values()), r = vp.getBoundingClientRect();
        var d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        var mx = (a[0].x + a[1].x) / 2 - r.left, my = (a[0].y + a[1].y) / 2 - r.top;
        vista.s = Math.max(MIN, Math.min(MAX, pinca.s * d / pinca.d));
        vista.x = mx - pinca.wx * vista.s; vista.y = my - pinca.wy * vista.s;
        aplicar();
      } else if (arrasto) {
        vista.x += e.clientX - arrasto.x; vista.y += e.clientY - arrasto.y;
        arrasto = { x: e.clientX, y: e.clientY };
        if (toque && Math.hypot(e.clientX - toque.x, e.clientY - toque.y) > 8) toque.movido = true;
        aplicar();
      }
    });
    function fim(e) {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (toque && !toque.movido && e.type === 'pointerup' && performance.now() - toque.t < 600) tocar(e.clientX, e.clientY);
      toque = null;
      if (pts.size === 1) { var a = Array.from(pts.values())[0]; arrasto = { x: a.x, y: a.y }; pinca = null; }
      if (pts.size === 0) { arrasto = null; pinca = null; }
    }
    vp.addEventListener('pointerup', fim);
    vp.addEventListener('pointercancel', fim);
    vp.addEventListener('lostpointercapture', fim);
    vp.addEventListener('wheel', function (e) {
      e.preventDefault();
      var r = vp.getBoundingClientRect();
      zoomEm(e.clientX - r.left, e.clientY - r.top, vista.s * Math.exp(-e.deltaY * 0.0016));
    }, { passive: false });
  }

  function tocar(cx, cy) {
    var alvo = document.elementFromPoint(cx, cy);
    var ent = alvo && alvo.closest && alvo.closest('[data-ent]');
    if (ent) { var p = ent.getAttribute('data-ent').split(':'); abrirEntidade(p[0], p[1]); return; }
    var r = vp.getBoundingClientRect();
    var wx = (cx - r.left - vista.x) / vista.s, wy = (cy - r.top - vista.y) / vista.s;
    var h = H.pixelParaHex(wx, wy);
    if (dentro(h.c, h.l)) abrirHex(h.c, h.l);
  }

  /* ---------------------------------------------------------------- seleção e folhas */
  function selecionar(c, l) {
    if (c === null) { sel.setAttribute('hidden', ''); return; }
    var ce = H.centro(c, l);
    sel.setAttribute('points', H.cantos(ce.x, ce.y, H.R - 1.5));
    sel.removeAttribute('hidden');
  }
  function seloEstado(e) {
    if (e.v === 'visivel') return '<span class="selo selo-visivel">' + RP.icone('olho') + 'Visível agora</span>';
    if (e.v === 'explorado') return '<span class="selo selo-antigo">' + RP.icone('relogio') + 'Visto ' + RP.fmtHa(e.horas) + '</span>';
    return '<span class="selo selo-desconhecido">' + RP.icone('nevoa') + 'Desconhecido</span>';
  }
  function coordTxt(c, l) { return '<span class="fraco num">' + c + ' · ' + l + '</span>'; }
  function botao(rotulo, icone, cls, attr) {
    return '<button type="button" class="btn btn-p ' + (cls || '') + '" ' + (attr || '') + '>' + RP.icone(icone) + rotulo + '</button>';
  }
  function notaAntiga(e) {
    return e.v === 'explorado' ? '<p class="nota-antiga">' + RP.icone('relogio', 'ico-p') + 'Último estado conhecido, ' + RP.fmtHa(e.horas) + '. Pode ter mudado.</p>' : '';
  }
  function abrirFolhaMapa(o, c, l) {
    selecionar(c, l);
    tela.classList.add('com-folha');
    o.sobreNav = true;
    o.aoFechar = function (troca) { if (!troca) { selecionar(null); tela.classList.remove('com-folha'); } };
    RP.abrirFolha(o);
  }

  function itemConteudo(it, e) {
    var o = it.o;
    if (it.tipo === 'local') {
      var r = D.reinos[o.reino];
      return '<button type="button" class="conteudo" data-abrir="local:' + o.id + '">' +
        '<span class="ico-placa ' + corDono(o.reino) + '">' + RP.icone(o.tipo) + '</span><span><b>' + RP.esc(o.nome) + '</b><small>' + RP.TIPOS_LOCAL[o.tipo] + ' · ' + RP.esc(o.reino === 'meu' ? 'Seu reino' : r.nome) + '</small></span>' + RP.icone('avancar', 'ico-p') + '</button>';
    }
    if (it.tipo === 'jazida') {
      return '<button type="button" class="conteudo" data-abrir="jazida:' + o.id + '">' +
        '<span class="ico-placa">' + RP.icone(o.tipo, 'r-' + o.tipo) + '</span><span><b>' + RP.esc(o.nome) + '</b><small>' + (o.classe === 'lendario' ? 'Lendário' : 'Valioso') + ' · ' + Math.round(o.restante * 100) + '% restante</small></span>' + RP.icone('avancar', 'ico-p') + '</button>';
    }
    if (it.tipo === 'bandeira') {
      return '<button type="button" class="conteudo" data-abrir="bandeira:' + o.id + '">' +
        '<span class="ico-placa ' + corDono(o.reino) + '">' + RP.icone('bandeira') + '</span><span><b>“' + RP.esc(o.texto) + '”</b><small>Bandeira · ' + RP.TIPOS_BANDEIRA[o.tipo] + '</small></span>' + RP.icone('avancar', 'ico-p') + '</button>';
    }
    if (it.tipo === 'rota') {
      return '<div class="conteudo"><span class="ico-placa">' + RP.icone('rota') + '</span><span><b>' + RP.esc(o.nome) + '</b><small>Rota pública · construída por ' + RP.esc(o.por === 'meu' ? 'você' : D.reinos[o.por].nome) + '. Qualquer jogador usa.</small></span></div>';
    }
    if (it.tipo === 'vau') {
      return '<div class="conteudo"><span class="ico-placa">' + RP.icone('pedra') + '</span><span><b>' + RP.esc(o.nome) + '</b><small>Vau: travessia do rio sem ponte</small></span></div>';
    }
    return '';
  }

  function abrirHex(c, l) {
    var e = estado(c, l);
    if (e.v === 'desconhecido') {
      abrirFolhaMapa({
        titulo: 'Terra desconhecida',
        subtitulo: '<div class="linha">' + seloEstado(e) + coordTxt(c, l) + '</div>',
        icone: '<span class="ico-placa folha-ico">' + RP.icone('nevoa') + '</span>',
        corpo: '<p class="suave">Ninguém do seu reino passou por aqui. Terreno, recursos e reinos só aparecem depois de explorados.</p>',
        acoes: botao('Enviar explorador', 'explorador', 'btn-primario', 'data-em-breve="Exploradores"') + botao('Colocar bandeira', 'bandeira', '', 'data-em-breve="Bandeiras"')
      }, c, l);
      return;
    }
    var t = T[l][c], info = H.TERRENOS[t];
    var itens = (porHex[k(c, l)] || []).filter(function (it) { return it.tipo !== 'local' || true; });
    var lista = itens.map(function (it) { return itemConteudo(it, e); }).join('');
    var temJazida = itens.some(function (it) { return it.tipo === 'jazida'; });
    var acoes = (temJazida ? botao('Extrair', 'picareta', 'btn-primario', 'data-em-breve="Extração de recurso"') : botao('Explorar área', 'explorador', 'btn-primario', 'data-em-breve="Exploradores"')) +
      botao('Colocar bandeira', 'bandeira', '', 'data-em-breve="Bandeiras"');
    abrirFolhaMapa({
      titulo: info.nome,
      subtitulo: '<div class="linha">' + seloEstado(e) + coordTxt(c, l) + '</div>',
      icone: '<span class="ico-placa folha-ico terreno-ico t-' + t + '"></span>',
      corpo: '<p class="suave">' + info.efeito + '</p>' + notaAntiga(e) + (lista ? '<div class="conteudos">' + lista + '</div>' : ''),
      acoes: acoes
    }, c, l);
  }

  function linhaInfo(rotulo, valor) { return '<div class="info-linha"><span class="fraco">' + rotulo + '</span><span>' + valor + '</span></div>'; }

  function abrirEntidade(tipo, id) {
    var o, e, corpo = '', acoes = '', reino;
    if (tipo === 'local') {
      o = D.locais.filter(function (x) { return x.id === id; })[0];
      e = estado(o.c, o.l); reino = D.reinos[o.reino];
      var meu = o.reino === 'meu';
      corpo = notaAntiga(e) + '<div class="info">' +
        linhaInfo('Tipo', RP.TIPOS_LOCAL[o.tipo]) +
        linhaInfo('Dono', '<span class="linha">' + RP.brasao(reino.brasao, { tamanho: 18, desconhecido: !reino.brasao }) + RP.esc(meu ? 'Seu reino' : reino.nome) + '</span>') +
        linhaInfo('Terreno', H.TERRENOS[T[o.l][o.c]].nome) +
        (meu ? linhaInfo('Nível', o.nivel) + linhaInfo('Guarnição', o.guarnicao) + linhaInfo('Postura', '<span class="selo selo-info">' + o.postura + '</span>') : linhaInfo('Defesa', '<span class="fraco">Desconhecida · espione para saber</span>')) +
        '</div>';
      if (o.ameaca) {
        var mh = marchas.filter(function (m) { return m.d.alvo === o.id; })[0];
        if (mh) corpo = '<button type="button" class="faixa-alerta" data-abrir="marcha:' + mh.d.id + '">' + RP.icone('alerta') + '<span class="txt"><b>Forças desconhecidas a caminho</b><br>Chegada em <span data-fim="' + RP.fim(mh.d.seg) + '">' + RP.fmtResta(mh.d.seg * 1000) + '</span></span>' + RP.icone('avancar', 'ico-p') + '</button>' + corpo;
      }
      acoes = meu
        ? botao('Abrir no reino', 'castelo', 'btn-primario', 'data-ir="reino?local=' + o.id + '"') + botao('Postura', 'escudo', '', 'data-em-breve="Posturas"')
        : botao('Atacar este local', 'tropas', 'btn-primario', 'data-em-breve="Envio de ataque"') + botao('Espionar', 'batedor', '', 'data-em-breve="Exploradores (batedor de elite)"');
      abrirFolhaMapa({
        titulo: RP.esc(o.reino === 'meu' && o.tipo === 'castelo' ? 'Castelo de ' + D.reinos.meu.nome : o.nome),
        subtitulo: '<div class="linha">' + seloEstado(e) + coordTxt(o.c, o.l) + '</div>',
        icone: '<span class="ico-placa folha-ico ' + corDono(o.reino) + '">' + RP.icone(o.tipo) + '</span>',
        corpo: corpo, acoes: acoes
      }, o.c, o.l);
    } else if (tipo === 'jazida') {
      o = D.jazidas.filter(function (x) { return x.id === id; })[0];
      e = estado(o.c, o.l);
      var reivind = D.bandeiras.filter(function (b) { return H.dist([b.c, b.l], [o.c, o.l]) <= 1 && b.tipo === 'reivindicacao'; })[0];
      corpo = notaAntiga(e) + '<div class="info">' +
        linhaInfo('Classe', o.classe === 'lendario' ? '<span class="selo selo-destaque">' + RP.icone('lendario') + 'Lendário</span>' : '<span class="selo selo-destaque">Valioso</span>') +
        linhaInfo('Terreno', H.TERRENOS[T[o.l][o.c]].nome) +
        '</div><div class="timer" style="margin-top:var(--esp-3)"><div class="timer-topo"><b>Jazida restante</b><span class="timer-resta">' + Math.round(o.restante * 100) + '%</span></div><div class="barra barra-sucesso"><i style="width:' + (o.restante * 100) + '%"></i></div></div>' +
        '<p class="fraco" style="margin-top:var(--esp-2);font-size:var(--fs-2)">Jazidas são finitas e se esgotam com a extração.</p>' +
        (reivind ? '<p class="nota-antiga" style="margin-top:var(--esp-3)">' + RP.icone('bandeira', 'ico-p') + 'Há uma bandeira de ' + RP.esc(D.reinos[reivind.reino].nome) + ' ao lado: “' + RP.esc(reivind.texto) + '”</p>' : '');
      acoes = botao('Extrair', 'picareta', 'btn-primario', 'data-em-breve="Extração de recurso"') + botao('Colocar bandeira', 'bandeira', '', 'data-em-breve="Bandeiras"');
      abrirFolhaMapa({
        titulo: RP.esc(o.nome),
        subtitulo: '<div class="linha">' + seloEstado(e) + coordTxt(o.c, o.l) + '</div>',
        icone: '<span class="ico-placa folha-ico">' + RP.icone(o.tipo, 'r-' + o.tipo) + '</span>',
        corpo: corpo, acoes: acoes
      }, o.c, o.l);
    } else if (tipo === 'bandeira') {
      o = D.bandeiras.filter(function (x) { return x.id === id; })[0];
      e = estado(o.c, o.l); reino = D.reinos[o.reino];
      corpo = notaAntiga(e) + '<blockquote class="bandeira-texto">“' + RP.esc(o.texto) + '”</blockquote><div class="info">' +
        linhaInfo('Tipo', RP.TIPOS_BANDEIRA[o.tipo]) +
        linhaInfo('Colocada por', '<span class="linha">' + RP.brasao(reino.brasao, { tamanho: 18 }) + RP.esc(o.reino === 'meu' ? 'Você' : reino.nome) + '</span>') +
        '</div><p class="fraco" style="margin-top:var(--esp-3);font-size:var(--fs-2)">Bandeiras são sinais sociais: não dão bônus nem bloqueiam passagem.</p>';
      acoes = botao('Colocar bandeira aqui', 'bandeira', 'btn-primario', 'data-em-breve="Bandeiras"');
      abrirFolhaMapa({
        titulo: 'Bandeira de ' + RP.esc(o.reino === 'meu' ? D.reinos.meu.nome : reino.nome),
        subtitulo: '<div class="linha">' + seloEstado(e) + coordTxt(o.c, o.l) + '</div>',
        icone: '<span class="ico-placa folha-ico ' + corDono(o.reino) + '">' + RP.icone('bandeira') + '</span>',
        corpo: corpo, acoes: acoes
      }, o.c, o.l);
    } else if (tipo === 'marcha') {
      var m = marchas.filter(function (x) { return x.d.id === id; })[0];
      o = m.d; reino = D.reinos[o.dono];
      var alvoNome = alvoTexto(o.alvo);
      if (o.hostil) {
        corpo = '<div class="info">' +
          linhaInfo('Identidade', '<span class="selo selo-perigo">' + RP.icone('interrogacao') + 'Desconhecida</span>') +
          linhaInfo('Forças', o.resumo) + linhaInfo('Vindo do', o.origem) + linhaInfo('Alvo provável', alvoNome) +
          linhaInfo('Chegada', '<b class="num" data-fim="' + RP.fim(o.seg) + '">' + RP.fmtResta(o.seg * 1000) + '</b>') +
          '</div><p class="fraco" style="margin-top:var(--esp-3);font-size:var(--fs-2)">Sem estandarte, o atacante não é revelado. Batedores podem descobrir quem é.</p>';
        acoes = botao('Enviar reforços', 'escudo', 'btn-primario', 'data-em-breve="Batalha / reforços"') + botao('Espionar', 'batedor', '', 'data-em-breve="Exploradores (batedor de elite)"');
      } else if (o.dono === 'meu') {
        corpo = '<div class="info">' + linhaInfo('Ordem', o.resumo) + (alvoNome ? linhaInfo('Destino', alvoNome) : '') +
          '</div>' + '<div style="margin-top:var(--esp-3)">' + RP.timerHTML('Chegada', o.seg, o.seg * 2.2) + '</div>';
        acoes = botao(o.tipo === 'explorador' ? 'Mudar ordem' : 'Ver tropa', o.tipo === 'explorador' ? 'explorador' : 'tropas', 'btn-primario', 'data-em-breve="' + (o.tipo === 'explorador' ? 'Exploradores' : 'Tropas') + '"') + botao('Retornar', 'voltar', '', 'data-em-breve="Exploradores"');
      } else {
        corpo = '<div class="info">' +
          linhaInfo('Identidade', '<span class="linha">' + RP.brasao(reino.brasao, { tamanho: 18 }) + RP.esc(reino.nome) + '</span>') +
          linhaInfo('Estandarte', '<span class="selo selo-info">' + RP.icone('estandarte') + 'Levado: identidade revelada</span>') +
          linhaInfo('Forças', o.resumo) + linhaInfo('Destino provável', alvoNome) +
          linhaInfo('Chegada', '<b class="num" data-fim="' + RP.fim(o.seg) + '">' + RP.fmtResta(o.seg * 1000) + '</b>') + '</div>';
        acoes = botao('Seguir no mapa', 'alvo', 'btn-primario', 'data-centrar-marcha="' + o.id + '"') + botao('Espionar', 'batedor', '', 'data-em-breve="Exploradores (batedor de elite)"');
      }
      abrirFolhaMapa({
        titulo: RP.esc(o.nome),
        subtitulo: '<div class="linha"><span class="selo ' + (o.hostil ? 'selo-perigo' : 'selo-info') + '">' + RP.icone('seta') + 'Em marcha</span></div>',
        icone: '<span class="ico-placa folha-ico marcha-ico ' + corDono(o.dono) + (o.hostil ? ' hostil' : '') + '">' + RP.icone(iconeMarcha(m)) + '</span>',
        corpo: corpo, acoes: acoes
      }, m.hex[0], m.hex[1]);
    }
  }
  function alvoTexto(id) {
    if (!id) return '';
    var x = D.locais.filter(function (l) { return l.id === id; })[0];
    if (x) return RP.esc(x.nome) + (x.reino === 'meu' ? ' (seu)' : '');
    var j = D.jazidas.filter(function (l) { return l.id === id; })[0];
    return j ? RP.esc(j.nome) : '';
  }

  function abrirCamadas() {
    var tog = function (k, rot, ic) {
      return '<button type="button" class="alternar" data-camada="' + k + '" aria-pressed="' + camadas[k] + '">' + RP.icone(ic) + '<span>' + rot + '</span><i aria-hidden="true"></i></button>';
    };
    var terr = Object.keys(H.TERRENOS).map(function (t) {
      return '<div class="legenda-item"><span class="amostra-hex t-' + t + '"></span><span><b>' + H.TERRENOS[t].nome + '</b><small>' + H.TERRENOS[t].efeito + '</small></span></div>';
    }).join('');
    RP.abrirFolha({
      titulo: 'Camadas e legenda', veu: true,
      corpo: '<div class="alternar-grade">' + tog('rotas', 'Rotas', 'rota') + tog('marchas', 'Marchas', 'tropas') + tog('recursos', 'Jazidas', 'ouro') + tog('bandeiras', 'Bandeiras', 'bandeira') + tog('rotulos', 'Nomes', 'info') + '</div>' +
        '<div class="secao-titulo">Névoa</div>' +
        '<div class="legenda-item"><span class="amostra-hex nevoa-vis t-planicie"></span><span><b>Visível</b><small>Dentro da visão de locais, tropas e exploradores. Tudo ao vivo.</small></span></div>' +
        '<div class="legenda-item"><span class="amostra-hex nevoa-exp t-planicie"></span><span><b>Explorado</b><small>Mostra o último estado conhecido e há quanto tempo foi visto.</small></span></div>' +
        '<div class="legenda-item"><span class="amostra-hex nevoa-desc"></span><span><b>Desconhecido</b><small>Nunca visto. Envie exploradores.</small></span></div>' +
        '<div class="secao-titulo">Terrenos</div>' + terr +
        '<div class="secao-titulo">Donos</div>' +
        '<div class="legenda-item"><span class="ponto-dono dono-meu"></span><span><b>Seu reino</b></span></div>' +
        '<div class="legenda-item"><span class="ponto-dono dono-rival-1"></span><span><b>Outros reinos</b><small>Cada reino tem sua cor e brasão.</small></span></div>' +
        '<div class="legenda-item"><span class="ponto-dono dono-desconhecido"></span><span><b>Desconhecido</b><small>Dono ou atacante não identificado.</small></span></div>'
    });
  }

  /* ---------------------------------------------------------------- minimapa */
  var mmEscala = 1;
  function desenharMinimapa() {
    if (!mm) return;
    var cs = getComputedStyle(document.documentElement);
    var cor = function (n) { return cs.getPropertyValue(n).trim(); };
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = mm.clientWidth, h = mm.clientHeight;
    mm.width = w * dpr; mm.height = h * dpr;
    mmEscala = w / H.LARGURA;
    var ctx = mmCtx; ctx.setTransform(dpr * mmEscala, 0, 0, dpr * mmEscala, 0, 0);
    ctx.fillStyle = cor('--nevoa-1'); ctx.fillRect(0, 0, H.LARGURA, H.ALTURA);
    var cores = {}, veu = cor('--explorado-veu');
    ['planicie', 'floresta', 'colina', 'montanha', 'pantano', 'rio'].forEach(function (t) { cores[t] = cor('--t-' + t); });
    var c, l, e, ce;
    for (l = 0; l < H.LINS; l++) {
      for (c = 0; c < H.COLS; c++) {
        e = estado(c, l); if (e.v === 'desconhecido') continue;
        ce = H.centro(c, l);
        ctx.fillStyle = rioSet[k(c, l)] ? cor('--rio-agua') : cores[T[l][c]];
        ctx.fillRect(ce.x - H.W / 2 - 1, ce.y - H.R * 0.8, H.W + 2, H.R * 1.6);
        if (e.v === 'explorado') { ctx.fillStyle = veu; ctx.fillRect(ce.x - H.W / 2 - 1, ce.y - H.R * 0.8, H.W + 2, H.R * 1.6); }
      }
    }
    var corD = { meu: cor('--cor-meu'), 'rival-1': cor('--cor-rival-1'), 'rival-2': cor('--cor-rival-2'), desconhecido: cor('--cor-desconhecido') };
    D.locais.forEach(function (x) {
      if (estado(x.c, x.l).v === 'desconhecido') return;
      var p = H.centro(x.c, x.l);
      ctx.fillStyle = corD[D.reinos[x.reino].cor];
      ctx.beginPath(); ctx.arc(p.x, p.y, x.tipo === 'castelo' ? 34 : 20, 0, Math.PI * 2); ctx.fill();
    });
    marchas.forEach(function (m) {
      if (!m.d.hostil || estado(m.hex[0], m.hex[1]).v !== 'visivel') return;
      ctx.fillStyle = cor('--cor-perigo');
      ctx.beginPath(); ctx.arc(m.atual.x, m.atual.y, 26, 0, Math.PI * 2); ctx.fill();
    });
    desenharVistaMinimapa();
  }
  function desenharVistaMinimapa() {
    if (!mmVista || !vp) return;
    var vw = vp.clientWidth, vh = vp.clientHeight;
    var x = -vista.x / vista.s, y = -vista.y / vista.s, w = vw / vista.s, h = vh / vista.s;
    var mw = mm.clientWidth, mh = mm.clientHeight;
    var x0 = Math.max(0, x * mmEscala), y0 = Math.max(0, y * mmEscala);
    var x1 = Math.min(mw, (x + w) * mmEscala), y1 = Math.min(mh, (y + h) * mmEscala);
    mmVista.style.transform = 'translate(' + x0.toFixed(1) + 'px,' + y0.toFixed(1) + 'px)';
    mmVista.style.width = Math.max(6, x1 - x0).toFixed(1) + 'px';
    mmVista.style.height = Math.max(6, y1 - y0).toFixed(1) + 'px';
  }
  function gestosMinimapa(box) {
    var ativo = false;
    function ir(e) {
      var r = mm.getBoundingClientRect();
      var wx = (e.clientX - r.left) / mmEscala, wy = (e.clientY - r.top) / mmEscala;
      var vw = vp.clientWidth, vh = vp.clientHeight;
      vista.x = vw / 2 - wx * vista.s; vista.y = vh / 2 - wy * vista.s;
      aplicar();
    }
    box.addEventListener('pointerdown', function (e) { ativo = true; box.setPointerCapture(e.pointerId); cancelAnimationFrame(anim); ir(e); });
    box.addEventListener('pointermove', function (e) { if (ativo) ir(e); });
    box.addEventListener('pointerup', function () { ativo = false; });
    box.addEventListener('pointercancel', function () { ativo = false; });
  }

  /* ---------------------------------------------------------------- montagem */
  function montar(el) {
    tela = el;
    var mh = svgMarchas();
    var hostis = marchas.filter(function (m) { return m.d.hostil && estado(m.hex[0], m.hex[1]).v === 'visivel'; });
    var faixa = hostis.map(function (m) {
      return '<button type="button" class="faixa-alerta" data-abrir="marcha:' + m.d.id + '" data-centrar-marcha="' + m.d.id + '">' + RP.icone('alerta', 'pulso') +
        '<span class="txt"><b>Forças desconhecidas</b> → ' + alvoTexto(m.d.alvo) + '<br>chegada em <b class="num" data-fim="' + RP.fim(m.d.seg) + '">' + RP.fmtResta(m.d.seg * 1000) + '</b></span>' + RP.icone('avancar', 'ico-p') + '</button>';
    }).join('');
    el.innerHTML =
      '<div class="mapa-vp" role="application" aria-label="Mapa do mundo. Arraste para mover, use dois dedos ou os botões para zoom.">' +
      '<svg class="mapa-svg" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><pattern id="hachura" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
      '<rect width="9" height="9" class="hachura-fundo"/><path d="M0 0V9" class="hachura-linha"/></pattern></defs>' +
      '<g class="mundo">' +
      '<rect class="mapa-fundo-rect" x="-4000" y="-4000" width="' + (H.LARGURA + 8000) + '" height="' + (H.ALTURA + 8000) + '"/>' +
      '<g class="camada-terreno">' + svgTerreno() + '</g>' +
      '<g class="camada-rios">' + svgRios() + '</g>' +
      '<g class="camada-rotas">' + svgRotas() + '</g>' +
      svgNevoa() +
      '<g class="camada-marcha-rotas">' + mh.rotas + '</g>' +
      '<polygon class="selecao" hidden points="0,0"/>' +
      '<g class="camada-jazidas">' + D.jazidas.map(svgJazida).join('') + '</g>' +
      '<g class="camada-locais">' + D.locais.map(function (x) { return svgLocal(x); }).join('') + '</g>' +
      '<g class="camada-bandeiras">' + D.bandeiras.map(svgBandeira).join('') + '</g>' +
      '<g class="camada-marchas">' + mh.tokens + '</g>' +
      '</g></svg></div>' +
      '<div class="mapa-topo">' + RP.barraRecursos() + faixa + '</div>' +
      '<div class="mapa-controles" role="toolbar" aria-label="Controles do mapa">' +
      '<button type="button" class="btn btn-icone" data-zoom="1.5" aria-label="Aproximar">' + RP.icone('mais') + '</button>' +
      '<button type="button" class="btn btn-icone" data-zoom="0.6667" aria-label="Afastar">' + RP.icone('menos') + '</button>' +
      '<button type="button" class="btn btn-icone" data-centrar-castelo aria-label="Centralizar no castelo">' + RP.icone('alvo') + '</button>' +
      '<button type="button" class="btn btn-icone" data-camadas aria-label="Camadas e legenda">' + RP.icone('camadas') + '</button>' +
      '</div>' +
      '<div class="minimapa" aria-label="Minimapa: toque para ir até um ponto"><canvas></canvas><div class="mm-vista"></div></div>';

    vp = RP.$('.mapa-vp', el); svg = RP.$('.mapa-svg', el); mundo = RP.$('.mundo', el); sel = RP.$('.selecao', el);
    mm = RP.$('.minimapa canvas', el); mmCtx = mm.getContext('2d'); mmVista = RP.$('.mm-vista', el);
    gestos();
    gestosMinimapa(RP.$('.minimapa', el));

    el.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-zoom]'))) zoomBotao(+b.getAttribute('data-zoom'));
      else if (e.target.closest('[data-centrar-castelo]')) { var cc = castelo(); centrar(cc.x, cc.y, Math.max(vista.s, 0.85)); }
      else if (e.target.closest('[data-camadas]')) abrirCamadas();
    });
    document.addEventListener('rp:direcao', function () { desenharMinimapa(); });
    window.addEventListener('resize', function () { if (!el.hidden) { aplicar(); desenharMinimapa(); } });
  }
  /* cliques dentro da folha (conteúdo do hex, alertas) */
  document.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-camada]'))) {
      var c = b.getAttribute('data-camada');
      camadas[c] = !camadas[c];
      b.setAttribute('aria-pressed', String(camadas[c]));
      svg.classList.toggle('sem-' + c, !camadas[c]);
      return;
    }
    if ((b = e.target.closest('[data-centrar-marcha]'))) {
      var m = marchas.filter(function (x) { return x.d.id === b.getAttribute('data-centrar-marcha'); })[0];
      if (m) setTimeout(function () { centrar(m.atual.x, m.atual.y, Math.max(vista.s, 0.9)); }, 20);
    }
    if ((b = e.target.closest('[data-abrir]')) && tela && !tela.hidden) {
      var p = b.getAttribute('data-abrir').split(':');
      abrirEntidade(p[0], p[1]);
      return;
    }
    if ((b = e.target.closest('[data-ir]'))) RP.ir(b.getAttribute('data-ir'));
  });

  function castelo() { var x = D.locais.filter(function (l) { return l.id === 'castelo'; })[0]; return H.centro(x.c, x.l); }

  var primeiraVez = true;
  RP.registrarTela('mapa', {
    nav: true, fixa: true,
    montar: montar,
    entrar: function (el, params) {
      requestAnimationFrame(function () {
        desenharMinimapa();
        var foco = params.get('foco');
        var x = foco && D.locais.filter(function (l) { return l.id === foco; })[0];
        if (x) {
          var ce = H.centro(x.c, x.l);
          abrirEntidade('local', x.id);
          centrar(ce.x, ce.y, Math.max(vista.s, 0.95), !primeiraVez);
        } else if (primeiraVez) {
          var cc = castelo(), pa = H.centro(20, 14); centrar((cc.x + pa.x) / 2, (cc.y + pa.y) / 2 + 30, 0.8, false);
        } else aplicar();
        primeiraVez = false;
      });
    },
    sair: function () { selecionar(null); tela.classList.remove('com-folha'); }
  });

  /* Vista compacta do território, usada em "Meu reino" */
  RP.mapa = {
    terreno: T,
    estado: estado,
    vistaReino: function () {
      var meus = D.locais.filter(function (x) { return x.reino === 'meu'; });
      var cs = meus.map(function (x) { return x.c; }), ls = meus.map(function (x) { return x.l; });
      var c0 = Math.min.apply(null, cs) - 1, c1 = Math.max.apply(null, cs) + 1, l0 = Math.min.apply(null, ls) - 1, l1 = Math.max.apply(null, ls) + 1;
      var a = H.centro(c0, l0), b = H.centro(c1, l1);
      var x0 = a.x - H.W * 0.5, y0 = a.y - H.R * 0.6, w = b.x - a.x + H.W * 1.5, h = b.y - a.y + H.R * 1.2;
      var filtro = function (c, l) { return c >= c0 - 2 && c <= c1 + 2 && l >= l0 - 2 && l <= l1 + 2; };
      return '<svg class="mapa-svg vista-reino" viewBox="' + [x0, y0, w, h].map(n1).join(' ') + '" style="--k:1.35" data-zoom="zoom-medio" role="img" aria-label="Vista do território com o castelo e os locais do reino">' +
        '<g class="camada-terreno">' + svgTerreno(filtro) + '</g><g class="camada-rios">' + svgRios() + '</g><g class="camada-rotas">' + svgRotas() + '</g>' +
        '<g class="camada-locais">' + meus.map(function (x) { return svgLocal(x, { todos: true }); }).join('') + '</g></svg>';
    }
  };
})();
