/* Reino de Pedra — tela do mapa do mundo.
   Duas vistas do mesmo mundo, alternáveis e com o mesmo centro:
     "Vista" (cena imersiva 2.5D, js/cena.js) e "Mapa" (tático em hexágonos SVG, este arquivo).
   Também concentra as folhas de detalhe (hexágono, local, jazida, fauna, ruína, bandeira, marcha)
   e o minimapa. */
(function () {
  'use strict';
  var RP = window.RP, H = RP.hex, D = RP.dados, W = RP.mundo;
  var T = W.T, estado = W.estado, k = W.chave, dentro = W.dentro, marchas = W.marchas;

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

  /* ================================================================ desenho tático (SVG) */
  var SIMBOLO = { floresta: ['m-arvores-1', 'm-arvores-2'], colina: ['m-colina'], montanha: ['m-monte'], pantano: ['m-junco'], planicie: ['m-grama'] };

  function svgTerreno() {
    var h = '', c, l, ce, t, alt, s, sim, rr;
    for (l = 0; l < H.LINS; l++) {
      for (c = 0; c < H.COLS; c++) {
        if (estado(c, l).v === 'desconhecido') continue;
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
    return W.rios.map(function (r) {
      var d = H.curva(r);
      return '<path class="rio-margem" d="' + d + '"/><path class="rio-agua" d="' + d + '"/><path class="rio-brilho" d="' + d + '"/>';
    }).join('');
  }
  function svgRotas() {
    var h = '';
    W.rotas.forEach(function (r) {
      var d = H.curva(r.hexes);
      h += '<path class="rota-borda" d="' + d + '"/><path class="rota" d="' + d + '"/>';
    });
    W.rotas.forEach(function (r) {
      r.hexes.forEach(function (hx, i) {
        if (!W.rioSet[k(hx[0], hx[1])]) return;
        var a = H.centro(r.hexes[Math.max(0, i - 1)][0], r.hexes[Math.max(0, i - 1)][1]);
        var b = H.centro(r.hexes[Math.min(r.hexes.length - 1, i + 1)][0], r.hexes[Math.min(r.hexes.length - 1, i + 1)][1]);
        var ce = H.centro(hx[0], hx[1]);
        h += '<use class="ponte" href="#m-ponte" transform="translate(' + n1(ce.x) + ' ' + n1(ce.y) + ') rotate(' + (Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI).toFixed(0) + ')"/>';
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
    var veu = '', nev = '', borda = '', perigo = '', c, l, e, ce, i, dirs, nc, nl, ne, ar, p1, p2, pg;
    for (l = 0; l < H.LINS; l++) {
      for (c = 0; c < H.COLS; c++) {
        e = estado(c, l); ce = H.centro(c, l);
        if (e.v === 'explorado') veu += '<polygon points="' + H.cantos(ce.x, ce.y, H.R + 0.6) + '"/>';
        if (e.v === 'desconhecido') {
          nev += '<polygon class="nv-' + (1 + Math.floor(H.hash(c, l, 17) * 3)) + '" points="' + H.cantos(ce.x, ce.y, H.R + 1) + '"/>';
          continue;
        }
        pg = W.perigoHex(c, l);
        if (pg) perigo += '<polygon class="pg-' + pg.nivel + '" points="' + H.cantos(ce.x, ce.y, H.R - 1) + '"/>';
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
    return '<g class="camada-perigo">' + perigo + '</g><g class="camada-explorado">' + veu + '</g><g class="camada-nevoa">' + nev + rotulos + '</g><path class="borda-nevoa" d="' + borda + '"/>';
  }

  function corDono(reino) { return 'dono-' + (D.reinos[reino] ? D.reinos[reino].cor : 'desconhecido'); }
  function rotuloSvg(txt, y, cls) { return '<text class="ent-rotulo ' + (cls || '') + '" y="' + y + '">' + RP.esc(txt) + '</text>'; }

  function svgLocal(x) {
    var ce = H.centro(x.c, x.l), e = estado(x.c, x.l);
    if (e.v === 'desconhecido') return '';
    var castelo = x.tipo === 'castelo';
    var antigo = e.v === 'explorado' ? ' antigo' : '';
    var h = '<g class="ent local' + (castelo ? ' castelo' : '') + ' ' + corDono(W.donoAparente(x)) + antigo + (x.ameaca ? ' ameacado' : '') + '" data-ent="local:' + x.id + '" transform="translate(' + n1(ce.x) + ' ' + n1(ce.y) + ')">' +
      '<circle class="ponto" r="' + (castelo ? 9 : 6) + '"/><g class="ent-k"><circle class="alvo-toque" r="24"/>';
    if (x.ameaca) h += '<circle class="anel-ameaca" r="' + (castelo ? 27 : 21) + '"/>';
    if (castelo) {
      h += '<circle class="lc-base" r="21"/><circle class="lc-anel" r="16.5"/>' +
        '<use href="#i-castelo" x="-13" y="-14" width="26" height="26"/>' +
        '<g transform="translate(9 -30)">' + RP.brasao(D.reinos[x.reino].brasao, { tamanho: 20, desconhecido: x.reino !== 'meu' }) + '</g>' +
        rotuloSvg(x.reino === 'meu' ? D.reinos.meu.nome : 'Castelo', 38, 'rotulo-castelo');
    } else {
      h += '<circle class="lc-base" r="15"/><use href="#i-' + x.tipo + '" x="-10" y="-10.5" width="20" height="20"/>' + rotuloSvg(W.nomeAparente(x), 30, '');
    }
    if (antigo) h += '<g class="selo-antigo-mapa" transform="translate(' + (castelo ? 16 : 11) + ' ' + (castelo ? 14 : 10) + ')"><circle r="7.5"/><use href="#i-relogio" x="-6" y="-6" width="12" height="12"/></g>';
    var rel = RP.reliquiaEm && RP.reliquiaEm(x.id, true);   /* só as suas e as já espionadas */
    if (rel) h += '<g class="relq-badge tipo-' + rel.tipo + '" transform="translate(' + (castelo ? -17 : -12) + ' ' + (castelo ? -15 : -11) + ')"><circle r="8"/><use href="#i-lendario" x="-6" y="-6" width="12" height="12"/></g>';
    return h + '</g></g>';
  }
  function svgRuina(r) {
    var ce = H.centro(r.c, r.l), e = estado(r.c, r.l);
    if (e.v === 'desconhecido') return '';
    return '<g class="ent ruina' + (e.v === 'explorado' ? ' antigo' : '') + '" data-ent="ruina:' + r.id + '" transform="translate(' + n1(ce.x) + ' ' + n1(ce.y) + ')">' +
      '<circle class="ponto" r="5"/><g class="ent-k"><circle class="alvo-toque" r="22"/><circle class="ru-base" r="14"/>' +
      '<use href="#i-' + (r.tipo === 'livre' ? 'estaca' : 'escombros') + '" x="-9.5" y="-10" width="19" height="19"/>' + rotuloSvg(r.nome, 29, '') + '</g></g>';
  }
  function svgJazida(j) {
    var ce = H.centro(j.c, j.l), e = estado(j.c, j.l);
    if (e.v === 'desconhecido') return '';
    return '<g class="ent jazida ' + j.classe + (e.v === 'explorado' ? ' antigo' : '') + '" data-ent="jazida:' + j.id + '" transform="translate(' + n1(ce.x) + ' ' + n1(ce.y) + ')">' +
      '<circle class="ponto" r="5"/><g class="ent-k"><circle class="alvo-toque" r="22"/>' +
      (j.classe === 'lendario' ? '<circle class="brilho-lendario" r="20"/>' : '') +
      '<rect class="jz-base" x="-12" y="-12" width="24" height="24" rx="4" transform="rotate(45)"/>' +
      '<use class="r-' + j.tipo + '" href="#i-' + j.tipo + '" x="-9.5" y="-9.5" width="19" height="19"/>' + rotuloSvg(j.nome, 31, '') + '</g></g>';
  }
  function svgBandeira(b) {
    var ce = H.centro(b.c, b.l), e = estado(b.c, b.l);
    if (e.v === 'desconhecido') return '';
    return '<g class="ent bandeira ' + corDono(b.reino) + (e.v === 'explorado' ? ' antigo' : '') + '" data-ent="bandeira:' + b.id + '" transform="translate(' + n1(ce.x + 4) + ' ' + n1(ce.y + 4) + ')">' +
      '<g class="ent-k"><circle class="alvo-toque" r="20"/><ellipse class="bd-sombra" cx="-6" cy="14" rx="6" ry="2.2"/>' +
      '<path class="bd-mastro" d="M-6 14V-20"/><path class="bd-pano" d="M-6-19H13L8.5-12.5 13-6H-6Z"/><circle class="bd-topo" cx="-6" cy="-21" r="2.2"/></g></g>';
  }
  function svgFauna(f) {
    var e = estado(f.c, f.l), A = W.ANIMAL[f.tipo];
    /* bando ao vivo (posição atualizada a cada segundo) */
    var vivo = '<g class="ent fauna nivel-' + f.nivel + '" data-ent="fauna:' + f.id + '" data-fauna-vivo="' + f.id + '" hidden>' +
      '<g class="ent-k"><circle class="alvo-toque" r="22"/><circle class="fa-base" r="14"/>' +
      '<use href="#i-' + A.icone + '" x="-10" y="-10.5" width="20" height="20"/>' +
      '<g class="fa-qtd" transform="translate(13 -12)"><rect x="-11" y="-8" width="22" height="16" rx="8"/><text y="4">×' + f.qtd + '</text></g>' +
      rotuloSvg(A.nome, 30, '') + '</g></g>';
    /* marcador de perigo da área conhecida (quando o bando não está à vista) */
    var marca = '';
    if (e.v !== 'desconhecido') {
      marca = '<g class="ent perigo nivel-' + f.nivel + (e.v === 'explorado' ? ' antigo' : '') + '" data-ent="fauna:' + f.id + '" data-fauna-marca="' + f.id + '" transform="translate(' + n1(f.centro.x) + ' ' + n1(f.centro.y) + ')">' +
        '<circle class="ponto" r="5"/><g class="ent-k"><circle class="alvo-toque" r="20"/><path class="pg-base" d="M0-15 14 10H-14Z"/>' +
        '<use href="#i-pata" x="-6.5" y="-6" width="13" height="13"/>' + rotuloSvg('Área de ' + A.nome.toLowerCase(), 24, '') + '</g></g>';
    }
    return marca + vivo;
  }
  function iconeMarcha(m) {
    if (m.d.tipo === 'explorador') return { cavalo: 'cavalo', pe: 'bota', prospector: 'picareta', batedor: 'batedor' }[m.d.sub];
    if (m.d.tipo === 'caca') return 'lobo';
    return 'tropas';
  }
  function svgMarchas() {
    var rotasH = '', tokens = '';
    marchas.forEach(function (m) {
      var meu = m.d.dono === 'meu';
      if (!meu && estado(m.hex[0], m.hex[1]).v !== 'visivel') return;
      var resto = [m.atual].concat(m.p.slice(m.atual.i));
      var fimP = m.p[m.p.length - 1];
      var cls = corDono(m.d.dono) + (m.d.hostil ? ' hostil' : '');
      rotasH += '<path class="marcha-rota ' + cls + '" d="' + curvaPts(resto) + '"/><circle class="marcha-destino ' + cls + '" cx="' + n1(fimP.x) + '" cy="' + n1(fimP.y) + '" r="7"/>';
      var explorador = m.d.tipo === 'explorador';
      var r = explorador ? 12 : 15;
      var risco = W.riscoMarcha(m);
      tokens += '<g class="ent marcha ' + cls + (explorador ? ' explorador' : '') + '" data-ent="marcha:' + m.d.id + '" data-marcha="' + m.d.id + '" transform="translate(' + n1(m.atual.x) + ' ' + n1(m.atual.y) + ')">' +
        '<g class="ent-k"><circle class="alvo-toque" r="24"/>' +
        (m.d.hostil ? '<circle class="anel-ameaca" r="' + (r + 6) + '"/>' : '') +
        '<circle class="mc-base" r="' + r + '"/>' +
        '<use href="#i-' + iconeMarcha(m) + '" x="' + (-r * 0.66) + '" y="' + (-r * 0.66) + '" width="' + (r * 1.32) + '" height="' + (r * 1.32) + '"/>' +
        (m.d.hostil ? '<g class="mc-selo" transform="translate(12 -12)"><circle r="8"/><text y="4.5">?</text></g>' : '') +
        (m.d.estandarte ? '<g class="mc-estandarte" transform="translate(13 -15)"><use href="#i-estandarte" x="-8" y="-8" width="16" height="16"/></g>' : '') +
        (RP.reliquiaNaMarcha(m.d.id) ? '<g class="relq-badge tipo-' + RP.reliquiaNaMarcha(m.d.id).tipo + '" transform="translate(-14 13)"><circle r="8"/><use href="#i-lendario" x="-6" y="-6" width="12" height="12"/></g>' : '') +
        (risco && risco.nivel !== 'baixo' ? '<g class="mc-risco nivel-' + risco.nivel + '" transform="translate(-13 -13)"><path d="M0-8 8 6H-8Z"/><text y="4">!</text></g>' : '') +
        '<g class="mc-eta" transform="translate(0 ' + (r + 13) + ')"><rect x="-24" y="-10" width="48" height="20" rx="10"/><text y="4.5" data-fim="' + m.d.chegada + '">' + RP.fmtResta(m.d.chegada - Date.now()) + '</text></g>' +
        '</g></g>';
    });
    return { rotas: rotasH, tokens: tokens };
  }

  /* ================================================================ tela */
  var tela, vp, svg, mundoG, sel, mm, mmCtx, mmVista, cenaCv, cena;
  var vista = { x: 0, y: 0, s: 0.85 }, ultimaVista = { x: 0, y: 0, s: 0.85 };
  var MIN = 0.2, MAX = 2.2;
  var camadas = { rotas: true, bandeiras: true, recursos: true, marchas: true, fauna: true, perigo: false, rotulos: true };
  var modo = 'cena';
  var selecao = null;

  function fatorK(s) { var f = Math.max(0.72, Math.min(1.15, Math.pow(s, 0.35))); return f / s; }
  function limitar() {
    var vw = vp.clientWidth, vh = vp.clientHeight, ww = H.LARGURA * vista.s, wh = H.ALTURA * vista.s;
    vista.x = ww <= vw ? (vw - ww) / 2 : Math.min(vw * 0.5, Math.max(vw * 0.5 - ww, vista.x));
    vista.y = wh <= vh ? (vh - wh) / 2 : Math.min(vh * 0.5, Math.max(vh * 0.5 - wh, vista.y));
  }
  var rafMm = 0;
  function aplicar() {
    if (!isFinite(vista.x) || !isFinite(vista.y) || !isFinite(vista.s)) vista = { x: ultimaVista.x, y: ultimaVista.y, s: ultimaVista.s };
    limitar();
    ultimaVista = { x: vista.x, y: vista.y, s: vista.s };
    mundoG.setAttribute('transform', 'translate(' + n1(vista.x) + ' ' + n1(vista.y) + ') scale(' + vista.s.toFixed(4) + ')');
    svg.style.setProperty('--k', fatorK(vista.s).toFixed(3));
    var z = vista.s < 0.3 ? 'zoom-mundo' : vista.s < 0.46 ? 'zoom-longe' : vista.s < 0.95 ? 'zoom-medio' : 'zoom-perto';
    if (svg.getAttribute('data-zoom') !== z) svg.setAttribute('data-zoom', z);
    pedirMinimapa();
  }
  function pedirMinimapa() { if (!rafMm) rafMm = requestAnimationFrame(function () { rafMm = 0; desenharVistaMinimapa(); }); }
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
  function centroTatico() { return { x: (vp.clientWidth / 2 - vista.x) / vista.s, y: (vp.clientHeight / 2 - vista.y) / vista.s }; }

  /* Centraliza na vista ativa. */
  function centrar(wx, wy, s, animar) {
    var fy = RP.folhaAberta() ? 0.3 : 0.5;
    if (modo === 'cena') { cena.centrar(wx, wy, s ? Math.max(s, 1.2) : null, fy, animar); return; }
    s = s || vista.s;
    var vw = vp.clientWidth, vh = vp.clientHeight;
    var alvo = { s: s, x: vw / 2 - wx * s, y: vh * fy - wy * s };
    if (animar === false) { vista = alvo; aplicar(); } else animarPara(alvo);
  }
  function zoomBotao(f) {
    if (modo === 'cena') { cena.zoomBotao(f); return; }
    var vw = vp.clientWidth, vh = vp.clientHeight;
    var ns = Math.max(MIN, Math.min(MAX, vista.s * f));
    var wx = (vw / 2 - vista.x) / vista.s, wy = (vh / 2 - vista.y) / vista.s;
    animarPara({ s: ns, x: vw / 2 - wx * ns, y: vh / 2 - wy * ns }, 220);
  }

  function definirModo(m, opt) {
    opt = opt || {};
    var centro = modo === 'cena' && cena ? cena.centro() : (vp ? centroTatico() : W.castelo());
    var sAtual = modo === 'cena' && cena ? cena.cam.s : vista.s;
    modo = m;
    tela.setAttribute('data-modo', m);
    RP.pref('modo-mapa', m);
    RP.$$('[data-modo-btn]', tela).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-modo-btn') === m)); });
    if (m === 'cena') {
      cena.redimensionar();
      cena.centrar(centro.x, centro.y, opt.s || Math.max(1.4, Math.min(2.6, sAtual * 2.2)), 0.5, false);
      if (!tela.hidden) cena.iniciar();
    } else {
      cena.parar();
      var s = opt.s || Math.max(0.55, Math.min(1.2, sAtual * 0.45));
      vista = { s: s, x: vp.clientWidth / 2 - centro.x * s, y: vp.clientHeight / 2 - centro.y * s };
      aplicar();
    }
    pedirMinimapa();
  }

  function tocarTatico(x, y, cx, cy) {
    var alvo = document.elementFromPoint(cx, cy);
    var ent = alvo && alvo.closest && alvo.closest('[data-ent]');
    if (ent) { var p = ent.getAttribute('data-ent').split(':'); abrirEntidade(p[0], p[1]); return; }
    var h = H.pixelParaHex((x - vista.x) / vista.s, (y - vista.y) / vista.s);
    if (dentro(h.c, h.l)) abrirHex(h.c, h.l);
  }

  /* ---------------------------------------------------------------- seleção e folhas */
  function selecionar(c, l) {
    selecao = c === null ? null : { c: c, l: l };
    if (!sel) return;
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
  function seloPerigo(nivel) { return '<span class="selo selo-perigo-' + nivel + '">' + RP.icone('pata') + 'Perigo ' + W.NOME_NIVEL[nivel].toLowerCase() + '</span>'; }
  function coordTxt(c, l) { return '<span class="fraco num">' + c + ' · ' + l + '</span>'; }
  function botao(rotulo, icone, cls, attr) { return '<button type="button" class="btn btn-p ' + (cls || '') + '" ' + (attr || '') + '>' + RP.icone(icone) + rotulo + '</button>'; }
  function notaAntiga(e) {
    return e.v === 'explorado' ? '<p class="nota-antiga">' + RP.icone('relogio', 'ico-p') + 'Último estado conhecido, ' + RP.fmtHa(e.horas) + '. Pode ter mudado.</p>' : '';
  }
  function linhaInfo(rotulo, valor) { return '<div class="info-linha"><span class="fraco">' + rotulo + '</span><span>' + valor + '</span></div>'; }
  function abrirFolhaMapa(o, c, l) {
    selecionar(c, l);
    tela.classList.add('com-folha');
    o.sobreNav = true;
    o.aoFechar = function (troca) { if (!troca) { selecionar(null); tela.classList.remove('com-folha'); } };
    RP.abrirFolha(o);
  }

  function itemConteudo(it) {
    var o = it.o;
    if (it.tipo === 'local') {
      return '<button type="button" class="conteudo" data-abrir="local:' + o.id + '"><span class="ico-placa ' + corDono(W.donoAparente(o)) + '">' + RP.icone(o.tipo) + '</span><span><b>' + RP.esc(W.nomeAparente(o)) + '</b><small>' + RP.TIPOS_LOCAL[o.tipo] + ' · ' + (o.reino === 'meu' ? 'Seu reino' : 'Dono desconhecido') + '</small></span>' + RP.icone('avancar', 'ico-p') + '</button>';
    }
    if (it.tipo === 'jazida') {
      return '<button type="button" class="conteudo" data-abrir="jazida:' + o.id + '"><span class="ico-placa">' + RP.icone(o.tipo, 'r-' + o.tipo) + '</span><span><b>' + RP.esc(o.nome) + '</b><small>' + (o.classe === 'lendario' ? 'Lendário · ' + (D.ruinasComReliquia.indexOf(o.id) >= 0 ? 'guarda 1 relíquia' : 'esgotada') : 'Valioso · ' + Math.round(o.restante * 100) + '% restante') + '</small></span>' + RP.icone('avancar', 'ico-p') + '</button>';
    }
    if (it.tipo === 'ruina') {
      return '<button type="button" class="conteudo" data-abrir="ruina:' + o.id + '"><span class="ico-placa">' + RP.icone(o.tipo === 'livre' ? 'estaca' : 'escombros') + '</span><span><b>' + RP.esc(o.nome) + '</b><small>Sem dono</small></span>' + RP.icone('avancar', 'ico-p') + '</button>';
    }
    if (it.tipo === 'bandeira') {
      return '<button type="button" class="conteudo" data-abrir="bandeira:' + o.id + '"><span class="ico-placa ' + corDono(o.reino) + '">' + RP.icone('bandeira') + '</span><span><b>“' + RP.esc(o.texto) + '”</b><small>Bandeira · ' + RP.TIPOS_BANDEIRA[o.tipo] + '</small></span>' + RP.icone('avancar', 'ico-p') + '</button>';
    }
    if (it.tipo === 'fauna') {
      return '<button type="button" class="conteudo" data-abrir="fauna:' + o.id + '"><span class="ico-placa nivel-' + o.nivel + '">' + RP.icone(W.ANIMAL[o.tipo].icone) + '</span><span><b>' + W.ANIMAL[o.tipo].nome + ' (≈ ' + o.qtd + ')</b><small>À vista agora · perigo ' + W.NOME_NIVEL[o.nivel].toLowerCase() + '</small></span>' + RP.icone('avancar', 'ico-p') + '</button>';
    }
    if (it.tipo === 'rota') {
      return '<div class="conteudo"><span class="ico-placa">' + RP.icone('rota') + '</span><span><b>' + RP.esc(o.nome) + '</b><small>Rota pública' + (o.por === 'meu' ? ' · construída por você' : '') + '. Qualquer jogador usa; reduz a presença de animais.</small></span></div>';
    }
    if (it.tipo === 'vau') {
      return '<div class="conteudo"><span class="ico-placa">' + RP.icone('pedra') + '</span><span><b>' + RP.esc(o.nome) + '</b><small>Vau: travessia do rio sem ponte</small></span></div>';
    }
    return '';
  }

  function blocoPerigo(c, l, e) {
    var p = W.perigoHex(c, l);
    if (!p) return '';
    var A = W.ANIMAL[p.fauna.tipo];
    return '<div class="perigo-linha nivel-' + p.nivel + '">' + RP.icone(A.icone) + '<span><b>Perigo ' + W.NOME_NIVEL[p.nivel].toLowerCase() + '</b> · área de ' + A.nome.toLowerCase() +
      (e.v === 'explorado' ? ' <span class="fraco">(visto ' + RP.fmtHa(e.horas) + ')</span>' : '') + '<br><small>Ameaça exploradores sozinhos, grupos pequenos e caravanas.</small></span></div>';
  }

  function abrirHex(c, l) {
    var e = estado(c, l);
    if (e.v === 'desconhecido') {
      abrirFolhaMapa({
        titulo: 'Terra desconhecida',
        subtitulo: '<div class="linha">' + seloEstado(e) + coordTxt(c, l) + '</div>',
        icone: '<span class="ico-placa folha-ico">' + RP.icone('nevoa') + '</span>',
        corpo: '<p class="suave">Ninguém do seu reino passou por aqui. Terreno, recursos, animais e reinos só aparecem depois de explorados.</p>',
        acoes: botao('Enviar explorador', 'explorador', 'btn-primario', 'data-ir="exploradores?alvo=' + c + ',' + l + '"') + botao('Colocar bandeira', 'bandeira', '', 'data-ir="bandeira-nova?alvo=' + c + ',' + l + '"')
      }, c, l);
      return;
    }
    var t = T[l][c], info = H.TERRENOS[t];
    var itens = (W.porHex[k(c, l)] || []).slice();
    var agora = performance.now() / 1000;
    D.fauna.forEach(function (f) { var p = W.faunaVisivel(f, agora); if (p && p.hex[0] === c && p.hex[1] === l) itens.unshift({ tipo: 'fauna', o: f }); });
    var lista = itens.map(itemConteudo).join('');
    var jazAqui = itens.filter(function (it) { return it.tipo === 'jazida' && it.o.classe !== 'lendario'; })[0], temJazida = !!jazAqui;
    var faunaAqui = itens.filter(function (it) { return it.tipo === 'fauna'; })[0];
    var acoes = (faunaAqui ? botao('Caçar', 'lobo', 'btn-primario', 'data-ir="caca?fauna=' + faunaAqui.o.id + '"') : temJazida ? botao('Extrair', 'picareta', 'btn-primario', 'data-ir="extracao?jazida=' + jazAqui.o.id + '"') : botao('Explorar área', 'explorador', 'btn-primario', 'data-ir="exploradores?alvo=' + c + ',' + l + '"')) +
      botao('Colocar bandeira', 'bandeira', '', 'data-ir="bandeira-nova?alvo=' + c + ',' + l + '"');
    abrirFolhaMapa({
      titulo: info.nome,
      subtitulo: '<div class="linha">' + seloEstado(e) + coordTxt(c, l) + '</div>',
      icone: '<span class="ico-placa folha-ico terreno-ico t-' + t + '"></span>',
      corpo: '<p class="suave">' + info.efeito + '</p>' + notaAntiga(e) + blocoPerigo(c, l, e) + (lista ? '<div class="conteudos">' + lista + '</div>' : ''),
      acoes: acoes
    }, c, l);
  }

  function alvoTexto(id) {
    if (!id) return '';
    var x = W.local(id);
    if (x) return RP.esc(x.nome) + (x.reino === 'meu' ? ' (seu)' : '');
    var j = W.jazida(id);
    return j ? RP.esc(j.nome) : '';
  }

  function abrirEntidade(tipo, id) {
    var o, e, corpo = '', acoes = '', reino;
    if (tipo === 'batalha') { RP.ir('batalha'); return; }
    if (tipo === 'local') {
      o = W.local(id); e = estado(o.c, o.l); reino = D.reinos[o.reino];
      var meu = o.reino === 'meu', esp = o.espionado;
      corpo = notaAntiga(e) + '<div class="info">' +
        linhaInfo('Tipo', RP.TIPOS_LOCAL[o.tipo]) +
        linhaInfo('Dono', meu ? '<span class="linha">' + RP.brasao(reino.brasao, { tamanho: 18 }) + 'Seu reino</span>'
          : esp ? '<span class="linha">' + RP.brasao(reino.brasao, { tamanho: 18 }) + RP.esc(reino.nome) + '</span>'
          : '<span class="selo selo-desconhecido">' + RP.icone('interrogacao') + 'Desconhecido</span>') +
        linhaInfo('Terreno', H.TERRENOS[T[o.l][o.c]].nome) +
        (meu ? linhaInfo('Nível', o.nivel) + linhaInfo('Guarnição', o.guarnicao) + linhaInfo('Postura', '<span class="selo selo-info">' + o.postura + '</span>')
          : linhaInfo('Defesa', esp ? RP.esc(esp.defesa) : '<span class="fraco">Desconhecida</span>')) +
        '</div>' + (RP.reliquiaEm(o.id, true) ? '<div style="margin-top:var(--esp-3)">' + RP.seloReliquia(RP.reliquiaEm(o.id, true)) + '</div>' : '') + (meu ? '' : esp
          ? '<p class="nota-antiga" style="margin-top:var(--esp-3)">' + RP.icone('batedor', 'ico-p') + 'Dono e defesa revelados por espionagem ' + RP.fmtHa(esp.horas) + '.</p>'
          : '<p class="fraco" style="margin-top:var(--esp-3);font-size:var(--fs-2)">Explorar não revela a quem pertence um local. Espionar com batedor de elite revela o dono e a defesa.</p>');
      if (o.ameaca) {
        var mh = marchas.filter(function (m) { return m.d.alvo === o.id; })[0];
        if (mh) corpo = '<button type="button" class="faixa-alerta" data-abrir="marcha:' + mh.d.id + '">' + RP.icone('alerta') + '<span class="txt"><b>Forças desconhecidas a caminho</b><br>Chegada em <span data-fim="' + mh.d.chegada + '">' + RP.fmtResta(mh.d.chegada - Date.now()) + '</span></span>' + RP.icone('avancar', 'ico-p') + '</button>' + corpo;
      }
      acoes = meu
        ? botao('Abrir no reino', 'castelo', 'btn-primario', 'data-ir="reino?local=' + o.id + '"') + botao('Postura', 'escudo', '', 'data-ir="posturas?local=' + o.id + '"')
        : botao(RP.reliquiaEm(o.id, true) ? 'Roubar a relíquia' : 'Atacar este local', 'tropas', 'btn-primario', 'data-ir="envio?alvo=' + o.id + '"') + botao(esp ? 'Espionar de novo' : 'Espionar', 'batedor', '', 'data-ir="exploradores?tipo=batedor&alvo=' + o.c + ',' + o.l + '"');
      abrirFolhaMapa({
        titulo: RP.esc(o.reino === 'meu' && o.tipo === 'castelo' ? 'Castelo de ' + D.reinos.meu.nome : W.nomeAparente(o)),
        subtitulo: '<div class="linha">' + seloEstado(e) + coordTxt(o.c, o.l) + '</div>',
        icone: '<span class="ico-placa folha-ico ' + corDono(W.donoAparente(o)) + '">' + RP.icone(o.tipo) + '</span>',
        corpo: corpo, acoes: acoes
      }, o.c, o.l);
    } else if (tipo === 'jazida') {
      o = W.jazida(id); e = estado(o.c, o.l);
      var reivind = D.bandeiras.filter(function (b) { return H.dist([b.c, b.l], [o.c, o.l]) <= 1 && b.tipo === 'reivindicacao'; })[0];
      var lend = o.classe === 'lendario', guarda = lend && D.ruinasComReliquia.indexOf(o.id) >= 0, escav = lend && D.escavacoes.filter(function (q) { return q.jazida === o.id; })[0];
      corpo = notaAntiga(e) + '<div class="info">' +
        linhaInfo('Classe', lend ? '<span class="selo selo-destaque">' + RP.icone('lendario') + 'Lendário</span>' : '<span class="selo selo-destaque">Valioso</span>') +
        linhaInfo('Terreno', H.TERRENOS[T[o.l][o.c]].nome) +
        (lend ? linhaInfo('Guarda', guarda ? '1 relíquia · tipo desconhecido' : '<span class="fraco">Esgotada</span>') : '') +
        '</div>' + (lend
          ? (escav ? '<p class="nota-antiga" style="margin-top:var(--esp-3)">' + RP.icone('picareta', 'ico-p') + '<span>Sua escavação acha a relíquia em <b class="num" data-fim="' + escav.fim + '">' + RP.fmtResta(escav.fim - Date.now()) + '</b>.</span></p>' : '') +
            '<p class="fraco" style="margin-top:var(--esp-3);font-size:var(--fs-2)">Escavar é lento e esgota a ruína. A relíquia achada pode ser guardada num local seu para fortalecê-lo.</p>'
          : '<div class="timer" style="margin-top:var(--esp-3)"><div class="timer-topo"><b>Jazida restante</b><span class="timer-resta">' + Math.round(o.restante * 100) + '%</span></div><div class="barra barra-sucesso"><i style="width:' + (o.restante * 100) + '%"></i></div></div>' +
            '<p class="fraco" style="margin-top:var(--esp-2);font-size:var(--fs-2)">Jazidas são finitas e se esgotam com a extração.</p>') + blocoPerigo(o.c, o.l, e) +
        (reivind ? '<p class="nota-antiga" style="margin-top:var(--esp-3)">' + RP.icone('bandeira', 'ico-p') + 'Há uma bandeira de ' + RP.esc(D.reinos[reivind.reino].nome) + ' ao lado: “' + RP.esc(reivind.texto) + '”</p>' : '');
      acoes = (lend ? (guarda && !escav ? botao('Escavar', 'picareta', 'btn-primario', 'data-ir="extracao?jazida=' + o.id + '"') : botao('Relíquias', 'lendario', 'btn-primario', 'data-ir="reliquias"')) : botao('Extrair', 'picareta', 'btn-primario', 'data-ir="extracao?jazida=' + o.id + '"')) + botao('Colocar bandeira', 'bandeira', '', 'data-ir="bandeira-nova?alvo=' + o.c + ',' + o.l + '"');
      abrirFolhaMapa({
        titulo: RP.esc(o.nome), subtitulo: '<div class="linha">' + seloEstado(e) + coordTxt(o.c, o.l) + '</div>',
        icone: '<span class="ico-placa folha-ico">' + RP.icone(o.tipo, 'r-' + (lend ? 'lendario' : o.tipo)) + '</span>', corpo: corpo, acoes: acoes
      }, o.c, o.l);
    } else if (tipo === 'fauna') {
      o = W.fauna(id); var A = W.ANIMAL[o.tipo];
      var vivo = W.faunaVisivel(o);
      e = vivo ? { v: 'visivel' } : estado(o.c, o.l);
      var perto = H.dist([o.c, o.l], [W.local('castelo').c, W.local('castelo').l]) <= 6;
      corpo = (vivo ? '' : notaAntiga(e)) + '<div class="info">' +
        linhaInfo('Perigo', seloPerigo(o.nivel)) +
        linhaInfo('Bando', '≈ ' + o.qtd + ' ' + (o.qtd > 1 ? A.nome.toLowerCase() : A.um)) +
        linhaInfo('Território', H.TERRENOS[T[o.l][o.c]].nome + ', raio de ' + o.raio + ' hex') +
        '</div><ul class="regras-lista">' +
        '<li>' + RP.icone('explorador', 'ico-p') + 'Ameaça exploradores sozinhos, grupos pequenos de extração e caravanas. Exércitos médios passam praticamente ilesos.</li>' +
        '<li>' + RP.icone('rota', 'ico-p') + 'Rotas construídas reduzem a presença de animais. Escolha entre rota curta e perigosa, longa e segura, ou leve escolta.</li>' +
        '<li>' + RP.icone('relogio', 'ico-p') + 'Os animais se movem e reaparecem: área limpa não fica segura para sempre.</li>' +
        (perto ? '<li>' + RP.icone('castelo', 'ico-p') + 'Perto do seu reino a fauna é mais fraca.</li>' : '') +
        '</ul><p class="fraco" style="margin-top:var(--esp-2);font-size:var(--fs-2)">Caçar rende comida, couro e peles.</p>';
      acoes = botao('Caçar', 'lobo', 'btn-primario', 'data-ir="caca?fauna=' + o.id + '"') + botao('Colocar bandeira', 'bandeira', '', 'data-ir="bandeira-nova?alvo=' + o.c + ',' + o.l + '"');
      abrirFolhaMapa({
        titulo: A.nome, subtitulo: '<div class="linha">' + seloEstado(e) + (vivo ? '' : '<span class="fraco">Último avistamento</span>') + '</div>',
        icone: '<span class="ico-placa folha-ico nivel-' + o.nivel + '">' + RP.icone(A.icone) + '</span>', corpo: corpo, acoes: acoes
      }, vivo ? vivo.hex[0] : o.c, vivo ? vivo.hex[1] : o.l);
    } else if (tipo === 'ruina') {
      o = W.ruina(id); e = estado(o.c, o.l);
      var livre = o.tipo === 'livre';
      corpo = notaAntiga(e) + '<div class="info">' + linhaInfo('Dono', '<span class="fraco">Nenhum</span>') + linhaInfo('Terreno', H.TERRENOS[T[o.l][o.c]].nome) + '</div>' +
        '<p class="suave" style="margin-top:var(--esp-3)">' + (livre ? 'Terra sem dono, onde antes havia um local. Pode ser ocupada e receber uma nova construção.' : 'Restos de um local sem dono. Não produz nem defende, mas pode ser ocupado e reconstruído.') + '</p>';
      acoes = botao('Ocupar', 'bandeira', 'btn-primario', 'data-ir="envio?modo=ocupar&alvo=' + o.id + '"') + (livre ? botao('Construir local', 'martelo', '', 'data-ir="construcao?aba=novos"') : botao('Reconstruir', 'martelo', '', 'data-ir="construcao?aba=novos"'));
      abrirFolhaMapa({
        titulo: RP.esc(o.nome), subtitulo: '<div class="linha">' + seloEstado(e) + coordTxt(o.c, o.l) + '</div>',
        icone: '<span class="ico-placa folha-ico">' + RP.icone(livre ? 'estaca' : 'escombros') + '</span>', corpo: corpo, acoes: acoes
      }, o.c, o.l);
    } else if (tipo === 'bandeira') {
      o = W.bandeira(id); e = estado(o.c, o.l); reino = D.reinos[o.reino];
      corpo = notaAntiga(e) + '<blockquote class="bandeira-texto">“' + RP.esc(o.texto) + '”</blockquote><div class="info">' +
        linhaInfo('Tipo', RP.TIPOS_BANDEIRA[o.tipo]) +
        linhaInfo('Colocada por', '<span class="linha">' + RP.brasao(reino.brasao, { tamanho: 18 }) + RP.esc(o.reino === 'meu' ? 'Você' : reino.nome) + '</span>') +
        '</div>' + (o.derrubarEm ? '<p class="nota-antiga" style="margin-top:var(--esp-3)">' + RP.icone('tropas', 'ico-p') + 'Suas tropas derrubam esta bandeira em <b class="num" data-fim="' + o.derrubarEm + '">' + RP.fmtResta(o.derrubarEm - Date.now()) + '</b>.</p>' : '') +
        '<p class="fraco" style="margin-top:var(--esp-3);font-size:var(--fs-2)">Bandeiras são sinais sociais: não dão bônus nem bloqueiam passagem. Qualquer jogador pode derrubá-las com tropas no local.</p>';
      acoes = botao('Colocar bandeira aqui', 'bandeira', 'btn-primario', 'data-ir="bandeira-nova?alvo=' + o.c + ',' + o.l + '"') + (o.reino === 'meu' ? botao('Suas bandeiras', 'menu', '', 'data-ir="bandeiras"') : botao('Derrubar', 'tropas', '', 'data-derrubar="' + o.id + '"'));
      abrirFolhaMapa({
        titulo: 'Bandeira de ' + RP.esc(o.reino === 'meu' ? D.reinos.meu.nome : reino.nome), subtitulo: '<div class="linha">' + seloEstado(e) + coordTxt(o.c, o.l) + '</div>',
        icone: '<span class="ico-placa folha-ico ' + corDono(o.reino) + '">' + RP.icone('bandeira') + '</span>', corpo: corpo, acoes: acoes
      }, o.c, o.l);
    } else if (tipo === 'marcha') {
      var m = W.marcha(id), pos = m.posicao();
      o = m.d; reino = D.reinos[o.dono];
      var alvoNome = alvoTexto(o.alvo);
      var risco = W.riscoMarcha(m);
      var avisoRisco = risco && risco.nivel !== 'baixo' ? '<div class="perigo-linha nivel-' + risco.nivel + '">' + RP.icone(W.ANIMAL[risco.fauna.tipo].icone) + '<span><b>Rota com ' + W.ANIMAL[risco.fauna.tipo].nome.toLowerCase() + ' (perigo ' + W.NOME_NIVEL[risco.nivel].toLowerCase() + ')</b><br><small>' + (o.tipo === 'explorador' ? 'Explorador sozinho' : 'Grupo pequeno') + ' corre risco. Considere escolta ou uma rota mais longa e segura.</small></span></div>' : '';
      var rlm = RP.reliquiaNaMarcha(o.id);
      if (o.hostil && rlm) {
        corpo = '<div class="info">' +
          linhaInfo('Identidade', '<span class="selo selo-perigo">' + RP.icone('interrogacao') + 'Desconhecida</span>') +
          linhaInfo('Forças', o.resumo) + linhaInfo('Rumo', o.rumo || '?') +
          linhaInfo('Some na névoa em', '<b class="num" data-fim="' + o.chegada + '">' + RP.fmtResta(o.chegada - Date.now()) + '</b>') +
          '</div><div style="margin-top:var(--esp-3)">' + RP.seloReliquia(rlm) + '</div>' +
          '<p class="fraco" style="margin-top:var(--esp-3);font-size:var(--fs-2)">Levam a sua relíquia. Alcance-os no caminho antes que sumam na névoa.</p>';
        acoes = botao('Interceptar', 'alvo', 'btn-primario', 'data-ir="interceptar?marcha=' + o.id + '"') + botao('Espionar', 'batedor', '', 'data-ir="exploradores?tipo=batedor&alvo=' + pos.hex[0] + ',' + pos.hex[1] + '"');
      } else if (o.hostil) {
        corpo = '<div class="info">' +
          linhaInfo('Identidade', '<span class="selo selo-perigo">' + RP.icone('interrogacao') + 'Desconhecida</span>') +
          linhaInfo('Forças', o.resumo) + linhaInfo('Vindo do', o.origem) + linhaInfo('Alvo provável', alvoNome) +
          linhaInfo('Chegada', '<b class="num" data-fim="' + o.chegada + '">' + RP.fmtResta(o.chegada - Date.now()) + '</b>') +
          '</div><p class="fraco" style="margin-top:var(--esp-3);font-size:var(--fs-2)">Sem estandarte, o atacante não é revelado. Batedores podem descobrir quem é.</p>';
        acoes = botao('Enviar reforços', 'escudo', 'btn-primario', 'data-ir="envio?modo=reforco&destino=' + o.alvo + '"') + botao('Espionar', 'batedor', '', 'data-ir="exploradores?tipo=batedor&alvo=' + pos.hex[0] + ',' + pos.hex[1] + '"');
      } else if (o.dono === 'meu') {
        corpo = avisoRisco + '<div class="info">' + linhaInfo('Ordem', o.resumo) + (alvoNome ? linhaInfo('Destino', alvoNome) : '') +
          (o.objetivos ? linhaInfo('Objetivos', RP.esc(o.objetivos)) + linhaInfo('Tática', RP.esc(o.tatica)) : '') + '</div>' +
          (o.voltam ? '<p class="fraco" style="margin-top:var(--esp-2);font-size:var(--fs-2)">' + RP.esc(o.voltam.join(' ')) + '</p>' : '') +
          (rlm ? '<div style="margin-top:var(--esp-3)">' + RP.seloReliquia(rlm) + '</div><p class="fraco" style="margin-top:var(--esp-2);font-size:var(--fs-2)">Carregando uma relíquia: visível no mapa e sujeita a roubo até chegar.</p>' : '') +
          '<div style="margin-top:var(--esp-3)">' + RP.timerHTML('Chegada', o.seg, o.seg * 2.2) + '</div>';
        acoes = o.tipo === 'explorador'
          ? botao('Mudar ordem', 'explorador', 'btn-primario', 'data-ir="exploradores?ativo=' + o.id + '"') + botao('Retornar', 'voltar', '', 'data-retornar="' + o.id + '"')
          : botao('Ver em Tropas', 'tropas', 'btn-primario', 'data-ir="tropas"') + botao('Retornar', 'voltar', '', 'data-retornar="' + o.id + '"');
      } else {
        corpo = '<div class="info">' +
          linhaInfo('Identidade', '<span class="linha">' + RP.brasao(reino.brasao, { tamanho: 18 }) + RP.esc(reino.nome) + '</span>') +
          linhaInfo('Estandarte', '<span class="selo selo-info">' + RP.icone('estandarte') + 'Levado: identidade revelada</span>') +
          linhaInfo('Forças', o.resumo) + linhaInfo('Destino provável', alvoNome) +
          linhaInfo('Chegada', '<b class="num" data-fim="' + o.chegada + '">' + RP.fmtResta(o.chegada - Date.now()) + '</b>') + '</div>';
        acoes = botao('Seguir', 'alvo', 'btn-primario', 'data-centrar-marcha="' + o.id + '"') + botao('Espionar', 'batedor', '', 'data-ir="exploradores?tipo=batedor&alvo=' + pos.hex[0] + ',' + pos.hex[1] + '"');
      }
      abrirFolhaMapa({
        titulo: RP.esc(o.nome),
        subtitulo: '<div class="linha"><span class="selo ' + (o.hostil ? 'selo-perigo' : 'selo-info') + '">' + RP.icone('seta') + 'Em marcha</span></div>',
        icone: '<span class="ico-placa folha-ico marcha-ico ' + corDono(o.dono) + (o.hostil ? ' hostil' : '') + '">' + RP.icone(iconeMarcha(m)) + '</span>',
        corpo: corpo, acoes: acoes
      }, pos.hex[0], pos.hex[1]);
    }
  }

  function abrirCamadas() {
    var tog = function (kk, rot, ic) {
      return '<button type="button" class="alternar" data-camada="' + kk + '" aria-pressed="' + camadas[kk] + '">' + RP.icone(ic) + '<span>' + rot + '</span><i aria-hidden="true"></i></button>';
    };
    var terr = Object.keys(H.TERRENOS).map(function (t) {
      return '<div class="legenda-item"><span class="amostra-hex t-' + t + '"></span><span><b>' + H.TERRENOS[t].nome + '</b><small>' + H.TERRENOS[t].efeito + '</small></span></div>';
    }).join('');
    var animais = Object.keys(W.ANIMAL).map(function (a) {
      var onde = { lobos: 'Florestas', javalis: 'Florestas', ursos: 'Montanhas e colinas', crocodilos: 'Pântanos e rios' }[a];
      return '<div class="legenda-item"><span class="ico-placa">' + RP.icone(W.ANIMAL[a].icone) + '</span><span><b>' + W.ANIMAL[a].nome + '</b><small>' + onde + '</small></span></div>';
    }).join('');
    RP.abrirFolha({
      titulo: 'Camadas e legenda', veu: true,
      corpo: '<div class="alternar-grade">' + tog('perigo', 'Perigo', 'pata') + tog('fauna', 'Animais', 'lobo') + tog('rotas', 'Rotas', 'rota') + tog('marchas', 'Marchas', 'tropas') + tog('recursos', 'Jazidas', 'ouro') + tog('bandeiras', 'Bandeiras', 'bandeira') + tog('rotulos', 'Nomes', 'info') + '</div>' +
        '<p class="fraco" style="margin-top:var(--esp-2);font-size:var(--fs-2)">A camada Perigo pinta as áreas conhecidas com fauna hostil, para escolher entre rota curta e perigosa ou longa e segura. Vale no Mapa; na Vista os animais aparecem desenhados.</p>' +
        '<div class="secao-titulo">Névoa</div>' +
        '<div class="legenda-item"><span class="amostra-hex nevoa-vis t-planicie"></span><span><b>Visível</b><small>Dentro da visão de locais, tropas e exploradores. Tudo ao vivo.</small></span></div>' +
        '<div class="legenda-item"><span class="amostra-hex nevoa-exp t-planicie"></span><span><b>Explorado</b><small>Mostra o último estado conhecido, inclusive o perigo, e há quanto tempo foi visto.</small></span></div>' +
        '<div class="legenda-item"><span class="amostra-hex nevoa-desc"></span><span><b>Desconhecido</b><small>Nunca visto. Envie exploradores.</small></span></div>' +
        '<div class="secao-titulo">Perigo</div>' +
        '<div class="legenda-item"><span class="amostra-hex pg-amostra pg-baixo t-planicie"></span><span><b>Baixo</b><small>Animais fracos ou área cortada por rota.</small></span></div>' +
        '<div class="legenda-item"><span class="amostra-hex pg-amostra pg-medio t-planicie"></span><span><b>Médio</b></span></div>' +
        '<div class="legenda-item"><span class="amostra-hex pg-amostra pg-alto t-planicie"></span><span><b>Alto</b><small>Evite com exploradores sozinhos e grupos pequenos.</small></span></div>' +
        '<div class="secao-titulo">Fauna hostil</div>' + animais +
        '<div class="secao-titulo">Terrenos</div>' + terr +
        '<div class="secao-titulo">Donos</div>' +
        '<div class="legenda-item"><span class="ponto-dono dono-meu"></span><span><b>Seu reino</b></span></div>' +
        '<div class="legenda-item"><span class="ponto-dono dono-desconhecido"></span><span><b>Dono desconhecido</b><small>Locais de outros reinos e atacantes sem estandarte. Explorar não revela o dono.</small></span></div>' +
        '<div class="legenda-item"><span class="ponto-dono dono-rival-1"></span><span><b>Identidade revelada</b><small>Exército com estandarte ou bandeira: cor do brasão de quem a colocou.</small></span></div>' +
        '<div class="legenda-item"><span class="ico-placa">' + RP.icone('escombros') + '</span><span><b>Ruína / terra livre</b><small>Sem dono. Podem ser ocupadas e reconstruídas.</small></span></div>'
    });
  }

  /* ---------------------------------------------------------------- atualização ao vivo (marchas e fauna no mapa tático) */
  function atualizarMoveis() {
    if (!svg || modo !== 'tatico') return;
    var agora = Date.now(), t = performance.now() / 1000;
    marchas.forEach(function (m) {
      var g = svg.querySelector('[data-marcha="' + m.d.id + '"]');
      if (!g) return;
      var p = m.posicao(agora);
      g.setAttribute('transform', 'translate(' + n1(p.x) + ' ' + n1(p.y) + ')');
    });
    D.fauna.forEach(function (f) {
      var vivo = svg.querySelector('[data-fauna-vivo="' + f.id + '"]'), marca = svg.querySelector('[data-fauna-marca="' + f.id + '"]');
      var p = W.faunaVisivel(f, t);
      if (p) { vivo.removeAttribute('hidden'); vivo.setAttribute('transform', 'translate(' + n1(p.x) + ' ' + n1(p.y) + ')'); }
      else vivo.setAttribute('hidden', '');
      if (marca) { if (p) marca.setAttribute('hidden', ''); else marca.removeAttribute('hidden'); }
    });
  }
  document.addEventListener('rp:tique', atualizarMoveis);

  /* ---------------------------------------------------------------- minimapa */
  var mmEscala = 1;
  function desenharMinimapa() {
    if (!mm) return;
    var cs = getComputedStyle(document.documentElement);
    var cor = function (n) { return cs.getPropertyValue(n).trim(); };
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = mm.clientWidth, h = mm.clientHeight;
    if (!w) return;
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
        ctx.fillStyle = W.rioSet[k(c, l)] ? cor('--rio-agua') : cores[T[l][c]];
        ctx.fillRect(ce.x - H.W / 2 - 1, ce.y - H.R * 0.8, H.W + 2, H.R * 1.6);
        if (e.v === 'explorado') { ctx.fillStyle = veu; ctx.fillRect(ce.x - H.W / 2 - 1, ce.y - H.R * 0.8, H.W + 2, H.R * 1.6); }
      }
    }
    var corD = { meu: cor('--cor-meu'), 'rival-1': cor('--cor-rival-1'), 'rival-2': cor('--cor-rival-2'), desconhecido: cor('--cor-desconhecido') };
    D.locais.forEach(function (x) {
      if (estado(x.c, x.l).v === 'desconhecido') return;
      var p = H.centro(x.c, x.l);
      ctx.fillStyle = corD[D.reinos[W.donoAparente(x)].cor];
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
    var r;
    if (modo === 'cena' && cena) r = cena.retanguloMundo();
    else r = { x: -vista.x / vista.s, y: -vista.y / vista.s, w: vp.clientWidth / vista.s, h: vp.clientHeight / vista.s };
    var mw = mm.clientWidth, mh = mm.clientHeight;
    var x0 = Math.max(0, r.x * mmEscala), y0 = Math.max(0, r.y * mmEscala);
    var x1 = Math.min(mw, (r.x + r.w) * mmEscala), y1 = Math.min(mh, (r.y + r.h) * mmEscala);
    mmVista.style.transform = 'translate(' + x0.toFixed(1) + 'px,' + y0.toFixed(1) + 'px)';
    mmVista.style.width = Math.max(6, x1 - x0).toFixed(1) + 'px';
    mmVista.style.height = Math.max(6, y1 - y0).toFixed(1) + 'px';
  }
  function gestosMinimapa(box) {
    var ativo = false;
    function ir(e) {
      var r = mm.getBoundingClientRect();
      var wx = (e.clientX - r.left) / mmEscala, wy = (e.clientY - r.top) / mmEscala;
      if (modo === 'cena') { cena.centrar(wx, wy, null, 0.5, false); pedirMinimapa(); return; }
      vista.x = vp.clientWidth / 2 - wx * vista.s; vista.y = vp.clientHeight / 2 - wy * vista.s;
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
    var bx = W.local(D.batalha.local);
    var faixaBatalha = RP.batalha && RP.batalha.ativa() ? '<a class="faixa-alerta faixa-batalha" href="#/batalha">' + RP.icone('tropas', 'pulso') +
      '<span class="txt"><b>Batalha em andamento</b> · ' + RP.esc(bx.nome) + '<br>toque para enviar reforços ou recuar</span>' + RP.icone('avancar', 'ico-p') + '</a>' : '';
    var faixas = (faixaBatalha ? [faixaBatalha] : []).concat(hostis.map(function (m) {
      var rl = RP.reliquiaNaMarcha(m.d.id);
      if (rl) return '<button type="button" class="faixa-alerta" data-abrir="marcha:' + m.d.id + '" data-centrar-marcha="' + m.d.id + '">' + RP.icone('lendario', 'pulso') +
        '<span class="txt"><b>' + RP.esc(rl.nome) + ' sendo levada</b> → ' + RP.esc(m.d.rumo || '?') + '<br>some na névoa em <b class="num" data-fim="' + m.d.chegada + '">' + RP.fmtResta(m.d.chegada - Date.now()) + '</b></span>' + RP.icone('avancar', 'ico-p') + '</button>';
      return '<button type="button" class="faixa-alerta" data-abrir="marcha:' + m.d.id + '" data-centrar-marcha="' + m.d.id + '">' + RP.icone('alerta', 'pulso') +
        '<span class="txt"><b>Forças desconhecidas</b> → ' + alvoTexto(m.d.alvo) + '<br>chegada em <b class="num" data-fim="' + m.d.chegada + '">' + RP.fmtResta(m.d.chegada - Date.now()) + '</b></span>' + RP.icone('avancar', 'ico-p') + '</button>';
    }));
    /* no máximo duas faixas à vista; o resto fica atrás de "+N alertas" para não cobrir o mapa */
    var faixa = faixas.slice(0, 2).join('') + (faixas.length > 2
      ? '<div class="faixas-extra" id="faixas-extra" hidden>' + faixas.slice(2).join('') + '</div>' +
        '<button type="button" class="faixa-mais" data-faixas-mais aria-expanded="false" aria-controls="faixas-extra">' + RP.icone('alerta', 'ico-p') + '<span>+' + (faixas.length - 2) + (faixas.length - 2 > 1 ? ' alertas' : ' alerta') + '</span></button>'
      : '');
    el.innerHTML =
      '<canvas class="cena-cv" aria-label="Vista do mundo. Arraste para mover, use dois dedos ou os botões para zoom. Toque em construções, tropas e animais."></canvas>' +
      '<div class="mapa-vp" role="application" aria-label="Mapa tático. Arraste para mover, use dois dedos ou os botões para zoom.">' +
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
      '<g class="camada-ruinas">' + D.ruinas.map(svgRuina).join('') + '</g>' +
      '<g class="camada-jazidas">' + D.jazidas.map(svgJazida).join('') + '</g>' +
      '<g class="camada-locais">' + D.locais.map(svgLocal).join('') + '</g>' +
      '<g class="camada-fauna">' + D.fauna.map(svgFauna).join('') + '</g>' +
      '<g class="camada-bandeiras">' + D.bandeiras.map(svgBandeira).join('') + '</g>' +
      '<g class="camada-marchas">' + mh.tokens + '</g>' +
      (RP.batalha && RP.batalha.ativa() ? (function () { var cb = H.centro(bx.c, bx.l); return '<g class="ent batalha-marca" data-ent="batalha:b" transform="translate(' + n1(cb.x) + ' ' + n1(cb.y - 26) + ')"><g class="ent-k"><circle class="alvo-toque" r="22"/><circle class="anel-ameaca" r="18"/><circle class="bt-base" r="14"/><use href="#i-tropas" x="-9" y="-9" width="18" height="18"/></g></g>'; })() : '') +
      '</g></svg></div>' +
      '<div class="mapa-topo">' + RP.barraRecursos() + faixa + '</div>' +
      '<div class="mapa-controles" role="toolbar" aria-label="Controles do mapa">' +
      '<button type="button" class="btn btn-icone" data-zoom="1.5" aria-label="Aproximar">' + RP.icone('mais') + '</button>' +
      '<button type="button" class="btn btn-icone" data-zoom="0.6667" aria-label="Afastar">' + RP.icone('menos') + '</button>' +
      '<button type="button" class="btn btn-icone" data-centrar-castelo aria-label="Centralizar no castelo">' + RP.icone('alvo') + '</button>' +
      '<button type="button" class="btn btn-icone" data-camadas aria-label="Camadas e legenda">' + RP.icone('camadas') + '</button>' +
      '</div>' +
      '<div class="modo-mapa abas" role="group" aria-label="Tipo de visão">' +
      '<button type="button" class="aba" data-modo-btn="cena" aria-pressed="true">' + RP.icone('vista') + 'Vista</button>' +
      '<button type="button" class="aba" data-modo-btn="tatico" aria-pressed="false">' + RP.icone('hexagonos') + 'Mapa</button></div>' +
      '<div class="minimapa" role="group" aria-label="Minimapa: toque para ir até um ponto"><canvas></canvas><div class="mm-vista"></div></div>';

    vp = RP.$('.mapa-vp', el); svg = RP.$('.mapa-svg', el); mundoG = RP.$('.mundo', el); sel = RP.$('.selecao', el);
    mm = RP.$('.minimapa canvas', el); mmCtx = mm.getContext('2d'); mmVista = RP.$('.mm-vista', el);
    cenaCv = RP.$('.cena-cv', el);

    var pin0 = null;
    RP.gestos(vp, {
      inicio: function () { cancelAnimationFrame(anim); },
      inicioPinca: function () { pin0 = { s: vista.s, x: vista.x, y: vista.y }; },
      arrasto: function (dx, dy) { vista.x += dx; vista.y += dy; aplicar(); },
      pinca: function (f, mx, my, mx0, my0) {
        var wx = (mx0 - pin0.x) / pin0.s, wy = (my0 - pin0.y) / pin0.s;
        vista.s = Math.max(MIN, Math.min(MAX, pin0.s * f));
        vista.x = mx - wx * vista.s; vista.y = my - wy * vista.s;
        aplicar();
      },
      roda: function (f, x, y) {
        var ns = Math.max(MIN, Math.min(MAX, vista.s * f)), wx = (x - vista.x) / vista.s, wy = (y - vista.y) / vista.s;
        vista.s = ns; vista.x = x - wx * ns; vista.y = y - wy * ns; aplicar();
      },
      toque: tocarTatico
    });

    cena = new RP.Cena(cenaCv, {
      interativa: true,
      camadas: camadas,
      selecao: function () { return selecao; },
      aoTocar: function (alvo) {
        if (alvo.ent) abrirEntidade(alvo.ent[0], alvo.ent[1]);
        else if (alvo.hex && dentro(alvo.hex[0], alvo.hex[1])) abrirHex(alvo.hex[0], alvo.hex[1]);
      },
      aoMover: pedirMinimapa,
      aoAfastarDemais: function () { definirModo('tatico', { s: 0.75 }); RP.aviso({ titulo: 'Mapa tático', texto: 'Afastou além da Vista. Aproxime ou toque em Vista para voltar.', icone: 'hexagonos', ms: 2200 }); }
    });
    gestosMinimapa(RP.$('.minimapa', el));

    el.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-faixas-mais]'))) {
        var ab = b.getAttribute('aria-expanded') !== 'true', ex = RP.$('#faixas-extra', el);
        b.setAttribute('aria-expanded', String(ab)); ex.hidden = !ab;
        b.querySelector('span').textContent = ab ? 'Menos alertas' : '+' + ex.children.length + (ex.children.length > 1 ? ' alertas' : ' alerta');
        return;
      }
      if ((b = e.target.closest('[data-zoom]'))) zoomBotao(+b.getAttribute('data-zoom'));
      else if (e.target.closest('[data-centrar-castelo]')) { var cc = W.castelo(); centrar(cc.x, cc.y, modo === 'cena' ? 1.8 : Math.max(vista.s, 0.85)); }
      else if (e.target.closest('[data-camadas]')) abrirCamadas();
      else if ((b = e.target.closest('[data-modo-btn]'))) { var m = b.getAttribute('data-modo-btn'); if (m !== modo) definirModo(m); }
    });
    window.addEventListener('resize', function () {
      if (el.hidden) return;
      if (modo === 'cena') cena.redimensionar(); else aplicar();
      desenharMinimapa();
    });
    modo = 'tatico';
    tela.setAttribute('data-modo', 'tatico');
  }

  /* cliques dentro da folha (conteúdo do hex, alertas, camadas) */
  document.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-camada]'))) {
      var c = b.getAttribute('data-camada');
      camadas[c] = !camadas[c];
      b.setAttribute('aria-pressed', String(camadas[c]));
      if (svg) svg.classList.toggle('sem-' + c, !camadas[c]);
      if (svg && c === 'perigo') svg.classList.toggle('com-perigo', camadas.perigo);
      return;
    }
    if ((b = e.target.closest('[data-centrar-marcha]'))) {
      var m = W.marcha(b.getAttribute('data-centrar-marcha'));
      if (m) setTimeout(function () { var p = m.posicao(); centrar(p.x, p.y, modo === 'cena' ? 2 : Math.max(vista.s, 0.9)); }, 20);
    }
    if ((b = e.target.closest('[data-abrir]')) && tela && !tela.hidden) {
      var p = b.getAttribute('data-abrir').split(':');
      abrirEntidade(p[0], p[1]);
      return;
    }
    if ((b = e.target.closest('[data-ir]'))) RP.ir(b.getAttribute('data-ir'));
  });

  var primeiraVez = true;
  RP.registrarTela('mapa', {
    nav: true, fixa: true,
    montar: montar,
    entrar: function (el, params) {
      requestAnimationFrame(function () {
        var pedido = params.get('modo') || RP.pref('modo-mapa') || 'cena';
        if (primeiraVez) {
          var cc = W.castelo(), pa = H.centro(20, 14);
          var cx = (cc.x + pa.x) / 2, cy = (cc.y + pa.y) / 2 + 30;
          vista = { s: 0.8, x: vp.clientWidth / 2 - cx * 0.8, y: vp.clientHeight / 2 - cy * 0.8 };
          aplicar();
          cena.redimensionar();
          cena.centrar(cc.x + 40, cc.y - 30, 1.7, 0.5, false);
          modo = pedido === 'cena' ? 'tatico' : 'cena';
          definirModoInicial(pedido);
        } else if (pedido !== modo && params.get('modo')) definirModo(pedido);
        else if (modo === 'cena') { cena.redimensionar(); cena.iniciar(); }
        else aplicar();
        desenharMinimapa();
        atualizarMoveis();
        var centroId = params.get('centro'), cx0 = centroId && W.local(centroId);
        if (cx0) { var cp = H.centro(cx0.c, cx0.l); centrar(cp.x, cp.y, modo === 'cena' ? 1.8 : 0.95, false); }
        var abrir = params.get('abrir');
        if (abrir) {
          var pa2 = abrir.split(':');
          abrirEntidade(pa2[0], pa2[1]);
          var sl = selecao; if (sl) { var cs2 = H.centro(sl.c, sl.l); centrar(cs2.x, cs2.y, modo === 'cena' ? 2 : 0.95, false); }
        }
        var foco = params.get('foco');
        var x = foco && W.local(foco);
        if (x) {
          var ce = H.centro(x.c, x.l);
          abrirEntidade('local', x.id);
          centrar(ce.x, ce.y, modo === 'cena' ? 2 : Math.max(vista.s, 0.95), !primeiraVez);
        }
        primeiraVez = false;
      });
    },
    sair: function () { selecionar(null); tela.classList.remove('com-folha'); if (cena) cena.parar(); }
  });
  function definirModoInicial(m) {
    modo = m;
    tela.setAttribute('data-modo', m);
    RP.$$('[data-modo-btn]', tela).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-modo-btn') === m)); });
    if (m === 'cena') cena.iniciar();
  }

  RP.mapa = {
    abrirEntidade: abrirEntidade, abrirHex: abrirHex,
    selecao: function () { return selecao; },
    iconeMarcha: iconeMarcha
  };
})();
