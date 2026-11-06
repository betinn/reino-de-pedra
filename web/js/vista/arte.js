/* Reino de Pedra — arte procedural da Vista (Canvas 2D, sem bibliotecas), portada de prototipo/js/cena.js.
   Primitivas desenham no espaço do objeto: origem no chão, y para baixo; o chão é achatado por K.
   Paleta de cena (design system §5.2); cores de dono vêm dos tokens. Nada aqui é regra de jogo. */
(function () {
  'use strict';
  var RP = window.RP;

  var K = 0.62;      /* achatamento do chão: inclinação da câmera (padrão; o jogador inclina entre K_MIN e K_MAX) */
  var K_PADRAO = 0.62, K_MIN = 0.42, K_MAX = 0.92;
  var OB = 0.45;     /* deslocamento oblíquo do topo das construções (mostra a lateral direita) */

  /* ================================================================ paleta */
  var P = {
    planicie: ['#7f9c47', '#829f4a', '#7c9944'], floresta: ['#4d6f35', '#557a3a'], colina: ['#9b8758', '#a38f5f'],
    montanha: ['#80796f', '#8a8378'], pantano: ['#5b6a45', '#617049'], rio: ['#6e8a52'],
    grama: '#5d7b31', grama2: '#93ad55', flor1: '#e9d36b', flor2: '#e39a8a', flor3: '#f3efe2',
    copa: '#2e5427', copa2: '#3b6a2f', copaLuz: '#5f8f43', tronco: '#5a3d24',
    folha: '#4f7d36', folhaLuz: '#77a44f', folhaSombra: '#355a26',
    colinaLuz: '#b6a26f', colinaSombra: '#7c6b45',
    rocha: '#8f8b85', rochaLuz: '#b6b2ab', rochaSombra: '#605d59',
    monte: '#8a837a', monteLuz: '#aba398', monteSombra: '#5d5852', neve: '#eef1f4',
    poca: '#4a6764', pocaLuz: '#6f8f8a', junco: '#3d4a2b', juncoLuz: '#7d8c45',
    agua: '#3a7fb0', aguaMargem: '#56693f', estrada: '#b09768', estradaBorda: '#86704c',
    terra: '#9a8159', terraEsc: '#7d6646', campo: '#c9b25a', campo2: '#a99540',
    pedra: '#aaa398', pedraLuz: '#c4beb3', pedraSombra: '#7e786e', pedraTopo: '#bbb5aa',
    parede: '#d8ccb3', paredeSombra: '#ada087', madeira: '#7a5634', madeiraEsc: '#563b22', madeiraLuz: '#9c7448',
    telhado: '#a4523b', telhadoSombra: '#7c3b2a', telhado2: '#8a6a45', telhado2Sombra: '#6a5034',
    porta: '#2e2218', janela: '#f2c46a', lona: '#d9cfb8', lonaSombra: '#b3a78e',
    pele: '#e3b58e', cabelo: '#4a3222', calca: '#3b3026', metal: '#9aa1a8', metalEsc: '#5f656c',
    roupa: ['#8a6a4a', '#6b7f5a', '#a8573e', '#5b6b7f', '#9a8a5a'],
    lobo: '#8e9196', loboEsc: '#5e6166', javali: '#5a4030', javaliEsc: '#3c2a1f', urso: '#4b3426', ursoEsc: '#2f2118',
    croc: '#4c6638', crocEsc: '#33472a', presa: '#efe8d8',
    cavalo: ['#7a4e2c', '#3a2a20', '#cfc4b2', '#9a6a3e'],
    ouro: '#f0c440', prata: '#dfe5eb', gema: '#6fd3e3', sal: '#f4f1ea', lend: '#c98cf0', erva1: '#9a6fd0', erva2: '#5fb6c9',
    aco: '#b9c4cf', minerioFerro: '#6d7a88', minerioPedra: '#c3bdb2',
    nevoa: '#232830',
    hostil: '#3d4149', hostilEsc: '#2d3036', hostilEscudo: '#4b4f57', cinto: '#1e1b18'
  };
  function rgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mix(a, b, t) {
    if (a.charAt(0) !== '#') return a;
    var x = rgb(a), y = rgb(b), g = (x[0] + x[1] + x[2]) / 3;
    var r = [0, 1, 2].map(function (i) { var dess = x[i] + (g - x[i]) * 0.55; return Math.round(dess + (y[i] - dess) * t); });
    return '#' + r.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
  }
  /* paleta da informação antiga: dessaturada e escurecida (42% de #30363f) */
  var PA = {};
  Object.keys(P).forEach(function (k) { PA[k] = Array.isArray(P[k]) ? P[k].map(function (c) { return mix(c, '#30363f', 0.42); }) : mix(P[k], '#30363f', 0.42); });

  /* ruído determinístico inteiro (igual ao protótipo), para a arte não "tremer" entre quadros */
  function hash(x, y, s) {
    var h = (x * 374761393 + y * 668265263 + (s || 0) * 2246822519) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967295;
  }

  /* cores de dono e de estado: sempre dos tokens */
  var CORES = null;
  function cores() {
    if (CORES) return CORES;
    var cs = getComputedStyle(document.documentElement), g = function (n) { return cs.getPropertyValue(n).trim(); };
    CORES = {
      meu: g('--cor-meu'), aliado: g('--cor-aliado'), desconhecido: g('--cor-desconhecido'), perigo: g('--cor-perigo'),
      selecao: g('--selecao'), selecaoPes: g('--selecao-pes'), alerta: g('--cor-alerta'), sucesso: g('--cor-sucesso'), destaque: g('--cor-destaque'),
      lendario: g('--rec-lendario'), baixo: g('--perigo-baixo'), medio: g('--perigo-medio'), alto: g('--perigo-alto'),
      fonteTitulo: g('--fonte-titulo'), fonteTexto: g('--fonte-texto')
    };
    return CORES;
  }
  /* pano cru para bandeiras de dono desconhecido (sem cor de reino) */
  var CRU = '#a39d90';
  function tintura(nome) { return nome ? getComputedStyle(document.documentElement).getPropertyValue('--tin-' + nome).trim() || null : null; }
  /* cor de um dono como o servidor o descreve: 'meu', 'aliado', 'desconhecido', 'livre' (ou cor revelada em o.cor / o.brasao) */
  function corDono(dono, o) {
    var C = cores();
    if (dono === 'meu') return C.meu;
    if (dono === 'aliado') return C.aliado;
    if (o && o.cor) return o.cor;
    if (o && o.brasao && o.brasao.cor1) return tintura(o.brasao.cor1) || CRU;
    return CRU;
  }
  function corNivel(n) { var C = cores(); return C[n] || C.baixo; }

  /* sprite de nuvem (névoa) */
  var PUFF = null;
  function puff() {
    if (PUFF) return PUFF;
    PUFF = document.createElement('canvas'); PUFF.width = PUFF.height = 128;
    var g = PUFF.getContext('2d'), gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, 'rgba(120,128,142,.85)'); gr.addColorStop(0.55, 'rgba(88,96,110,.5)'); gr.addColorStop(1, 'rgba(60,66,78,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return PUFF;
  }

  /* ================================================================ primitivas */
  function gz(dz) { return dz * K; }
  function elipse(c, x, y, rx, ry, cor) { c.fillStyle = cor; c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, 6.2832); c.fill(); }
  function poli(c, pts, cor, traco, lw) {
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (var i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.closePath();
    if (cor) { c.fillStyle = cor; c.fill(); }
    if (traco) { c.strokeStyle = traco; c.lineWidth = lw || 1; c.stroke(); }
  }
  function linha(c, x1, y1, x2, y2, cor, lw) { c.strokeStyle = cor; c.lineWidth = lw; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
  function sombra(c, x, y, rx, a) { elipse(c, x, y, rx, rx * K * 0.55, 'rgba(8,10,14,' + (a || 0.26) + ')'); }

  /* caixa oblíqua: (x,y) = centro da base frontal; w largura, d profundidade, h altura */
  function caixa(c, x, y, w, d, h, cf, cl, ct) {
    var oy = d * K, ox = oy * OB, L = x - w / 2, R = x + w / 2, B = y, Tp = y - h;
    poli(c, [R, B, R, Tp, R + ox, Tp - oy, R + ox, B - oy], cl);
    c.fillStyle = cf; c.fillRect(L, Tp, w, h);
    if (ct) poli(c, [L, Tp, R, Tp, R + ox, Tp - oy, L + ox, Tp - oy], ct);
  }
  function ameias(c, x, y, w, d, h, cor) {
    var oy = d * K, ox = oy * OB, n = Math.max(2, Math.round(w / 5)), i, mw = w / (n * 2 - 1);
    for (i = 0; i < n; i++) { c.fillStyle = cor; c.fillRect(x - w / 2 + i * mw * 2, y - h - 3, mw, 3); }
    for (i = 0; i < 2; i++) c.fillRect(x + w / 2 + ox * (0.3 + i * 0.45) - 1, y - h - oy * (0.3 + i * 0.45) - 3, 2, 3);
  }
  function casa(c, x, y, w, d, h, rh, pal, o) {
    o = o || {};
    var oy = d * K, ox = oy * OB, L = x - w / 2, R = x + w / 2, Tp = y - h, ry = Tp - oy / 2 - rh;
    var parede = o.parede || pal.parede, paredeS = o.paredeS || pal.paredeSombra, tel = o.telhado || pal.telhado, telS = o.telhadoS || pal.telhadoSombra;
    poli(c, [R, y, R, Tp, R + ox, Tp - oy, R + ox, y - oy], paredeS);
    poli(c, [R, Tp, R + ox, Tp - oy, R + ox / 2, ry], paredeS);
    c.fillStyle = parede; c.fillRect(L, Tp, w, h);
    c.fillStyle = pal.madeiraEsc; c.fillRect(L, Tp, w, 1.2); c.fillRect(L, y - 1.2, w, 1.2);
    if (o.porta !== false) { c.fillStyle = pal.porta; c.fillRect(x - 2 + (o.portaX || 0), y - Math.min(7, h - 1.5), 4, Math.min(7, h - 1.5)); }
    if (o.janela !== false && w > 11) { c.fillStyle = o.luz ? pal.janela : pal.porta; c.fillRect(L + 2.5, Tp + 2.8, 2.6, 2.6); c.fillRect(R - 5.1, Tp + 2.8, 2.6, 2.6); }
    poli(c, [L - 1.5, Tp + 1, R + 1.5, Tp + 1, R + ox / 2 + 1.5, ry, L + ox / 2 - 1.5, ry], tel);
    c.strokeStyle = telS; c.lineWidth = 0.8;
    for (var i = 1; i < 3; i++) { var f = i / 3; c.beginPath(); c.moveTo(L - 1.5 + (ox / 2) * f, Tp + 1 + (ry - Tp - 1) * f); c.lineTo(R + 1.5 + (ox / 2) * f, Tp + 1 + (ry - Tp - 1) * f); c.stroke(); }
    linha(c, L + ox / 2 - 1.5, ry, R + ox / 2 + 1.5, ry, telS, 1.2);
    return { chamine: { x: R - 3 + ox / 2, y: ry + 2 } };
  }
  function torre(c, x, y, r, h, pal, o) {
    o = o || {};
    var pedra = o.cor || pal.pedra, luz = o.luz || pal.pedraLuz, sb = o.sombra || pal.pedraSombra;
    elipse(c, x, y, r, r * K, sb);
    c.fillStyle = luz; c.fillRect(x - r, y - h, r, h);
    c.fillStyle = pedra; c.fillRect(x - r * 0.25, y - h, r * 0.6, h);
    c.fillStyle = sb; c.fillRect(x + r * 0.35, y - h, r * 0.65, h);
    elipse(c, x, y - h, r, r * K, pal.pedraTopo);
    if (o.cone) {
      poli(c, [x - r - 1.5, y - h, x + r + 1.5, y - h, x, y - h - r * 2.6], o.cone);
      poli(c, [x, y - h - r * 2.6, x + r + 1.5, y - h, x + r * 0.3, y - h + 0.8], 'rgba(0,0,0,.22)');
    } else {
      for (var i = -2; i <= 2; i++) { c.fillStyle = i > 0 ? sb : luz; c.fillRect(x + i * r * 0.42 - 1.2, y - h - 3 + Math.abs(i) * 0.5, 2.4, 3); }
    }
    if (o.janela) { c.fillStyle = pal.porta; c.fillRect(x - 1, y - h * 0.6, 2, 3.5); }
  }
  function bandeira(c, x, y, h, cor, t, larg, alt2) {
    larg = larg || 9; alt2 = alt2 || 5;
    linha(c, x, y, x, y - h, '#2b2520', 1.2);
    c.fillStyle = cor; c.beginPath(); c.moveTo(x, y - h);
    for (var i = 0; i <= 4; i++) c.lineTo(x + (larg * i) / 4, y - h + Math.sin(t * 5 - i * 1.2) * 1.2 * (i / 4));
    for (i = 4; i >= 0; i--) c.lineTo(x + (larg * i) / 4, y - h + alt2 + Math.sin(t * 5 - i * 1.2) * 1.2 * (i / 4));
    c.closePath(); c.fill();
  }
  function arvoreConifera(c, x, y, s, pal, alt) {
    sombra(c, x + 2, y, 6 * s, 0.22);
    c.fillStyle = pal.tronco; c.fillRect(x - 1 * s, y - 4 * s, 2 * s, 4 * s);
    var cor = alt ? pal.copa2 : pal.copa;
    for (var i = 0; i < 3; i++) {
      var by = y - 3 * s - i * 6 * s, w = (8 - i * 2) * s;
      poli(c, [x - w, by, x + w, by, x, by - 10 * s], cor);
      poli(c, [x, by - 10 * s, x + w, by, x + w * 0.15, by], pal.folhaSombra);
      poli(c, [x - w, by, x - w * 0.2, by - 2 * s, x, by - 10 * s], pal.copaLuz);
    }
  }
  function arvoreFolhosa(c, x, y, s, pal) {
    sombra(c, x + 2, y, 7.5 * s, 0.22);
    c.fillStyle = pal.tronco; c.fillRect(x - 1.2 * s, y - 7 * s, 2.4 * s, 7 * s);
    elipse(c, x + 2 * s, y - 11 * s, 6.5 * s, 5.5 * s, pal.folhaSombra);
    elipse(c, x - 1.5 * s, y - 12.5 * s, 6.5 * s, 6 * s, pal.folha);
    elipse(c, x - 3 * s, y - 14.5 * s, 3.6 * s, 3 * s, pal.folhaLuz);
  }
  function arbusto(c, x, y, s, pal, flor) {
    elipse(c, x, y - 2 * s, 4 * s, 2.8 * s, pal.folhaSombra);
    elipse(c, x - 1 * s, y - 3 * s, 3 * s, 2.2 * s, pal.folha);
    if (flor) { elipse(c, x - 1.5 * s, y - 4 * s, 0.9 * s, 0.9 * s, flor); elipse(c, x + 1.5 * s, y - 3 * s, 0.9 * s, 0.9 * s, flor); }
  }
  function rocha(c, x, y, s, pal) {
    sombra(c, x + 1, y, 4.5 * s, 0.2);
    poli(c, [x - 4.5 * s, y, x - 3 * s, y - 4 * s, x + 0.5 * s, y - 5.5 * s, x + 4 * s, y - 3 * s, x + 4.5 * s, y], pal.rocha);
    poli(c, [x + 0.5 * s, y - 5.5 * s, x + 4 * s, y - 3 * s, x + 4.5 * s, y, x + 1 * s, y], pal.rochaSombra);
    poli(c, [x - 3 * s, y - 4 * s, x + 0.5 * s, y - 5.5 * s, x - 0.5 * s, y - 3 * s], pal.rochaLuz);
  }
  function monte(c, x, y, w, h, pal) {
    sombra(c, x + 3, y, w * 0.55, 0.18);
    c.fillStyle = pal.colinaSombra; c.beginPath(); c.ellipse(x, y, w / 2, h, 0, Math.PI, 0); c.fill();
    c.fillStyle = pal.colina[1]; c.beginPath(); c.ellipse(x - w * 0.08, y, w * 0.42, h * 0.95, 0, Math.PI, 0); c.fill();
    c.fillStyle = pal.colinaLuz; c.beginPath(); c.ellipse(x - w * 0.18, y - h * 0.25, w * 0.2, h * 0.6, 0, Math.PI, 0); c.fill();
  }
  function pico(c, x, y, w, h, pal) {
    sombra(c, x + 4, y, w * 0.55, 0.22);
    poli(c, [x - w / 2, y, x - w * 0.05, y - h, x + w / 2, y], pal.monte);
    poli(c, [x - w * 0.05, y - h, x + w / 2, y, x + w * 0.08, y], pal.monteSombra);
    poli(c, [x - w / 2, y, x - w * 0.05, y - h, x - w * 0.22, y - h * 0.35], pal.monteLuz);
    poli(c, [x - w * 0.05, y - h, x - w * 0.17, y - h * 0.72, x - w * 0.09, y - h * 0.76, x, y - h * 0.68, x + w * 0.1, y - h * 0.78], pal.neve);
  }
  function junco(c, x, y, s, pal) {
    c.strokeStyle = pal.junco; c.lineWidth = 0.9;
    for (var i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(x + i * 1.2 * s, y); c.lineTo(x + i * 1.8 * s, y - (6 + (i & 1) * 2) * s); c.stroke(); }
    elipse(c, x + 0.6 * s, y - 7 * s, 0.8 * s, 1.8 * s, pal.juncoLuz);
  }
  function fumaca(c, x, y, t, escura, forca) {
    forca = forca || 1;
    for (var i = 0; i < 5; i++) {
      var a = (t * 0.35 + i / 5) % 1;
      var r = (2 + a * 6) * forca;
      c.fillStyle = escura ? 'rgba(52,52,56,' + (0.45 * (1 - a)).toFixed(3) + ')' : 'rgba(225,225,228,' + (0.4 * (1 - a)).toFixed(3) + ')';
      c.beginPath(); c.arc(x + Math.sin(a * 3 + i) * 2 + a * 7, y - a * 28 * forca, r, 0, 6.2832); c.fill();
    }
  }
  function brilho(c, x, y, t, fase, cor) {
    var a = Math.max(0, Math.sin(t * 2.4 + fase));
    if (a < 0.2) return;
    c.strokeStyle = cor; c.globalAlpha = a; c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(x - 2.6 * a, y); c.lineTo(x + 2.6 * a, y); c.moveTo(x, y - 2.6 * a); c.lineTo(x, y + 2.6 * a); c.stroke();
    c.globalAlpha = 1;
  }

  /* relíquia guardada: pedestal de pedra, gema na cor do tipo e coluna de luz pulsante */
  var COR_REL = { ataque: '#f47b60', producao: '#e8c04a', resistencia: '#57c2c9', desconhecido: '#d796f2' };
  function pedestalReliquia(c, t, pal, tipo, vivo) {
    var cor = COR_REL[tipo] || COR_REL.desconhecido, pulso = vivo ? 0.5 + Math.sin(t * 2.2) * 0.5 : 0.3;
    c.scale(1.25, 1.25);
    sombra(c, 0, 0, 7, 0.3);
    caixa(c, 0, 0, 10, 7, 6, pal.pedra, pal.pedraSombra, pal.pedraTopo);
    caixa(c, 0, -6, 7, 5, 3, pal.pedraSombra, pal.pedraSombra, pal.pedra);
    if (vivo) {
      var gr = c.createLinearGradient(0, -10, 0, -58);
      gr.addColorStop(0, cor); gr.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = 0.22 + pulso * 0.25; c.fillStyle = gr;
      c.beginPath(); c.moveTo(-4, -10); c.lineTo(4, -10); c.lineTo(2, -58); c.lineTo(-2, -58); c.closePath(); c.fill();
      c.globalAlpha = 1;
    }
    var gy = -14 - (vivo ? Math.sin(t * 1.6) * 1.2 : 0);
    poli(c, [0, gy - 5, 3.4, gy, 0, gy + 4, -3.4, gy], cor);
    poli(c, [0, gy - 5, 3.4, gy, 0, gy], 'rgba(255,255,255,.45)');
    if (vivo) { brilho(c, 4, gy - 6, t, 0, '#fff'); brilho(c, -5, gy - 2, t, 2.1, '#fff'); }
  }
  /* relíquia carregada por uma marcha: baú nos ombros, gema na cor do tipo */
  function bauReliquia(c, t, pal, tipo) {
    var cor = COR_REL[tipo] || COR_REL.desconhecido, pulso = 0.5 + Math.sin(t * 2.6) * 0.5, by = -11 + Math.sin(t * 8) * 0.6;
    elipse(c, 0, by - 3, 11 + pulso * 3, 7 + pulso * 2, 'rgba(255,240,200,' + (0.10 + pulso * 0.10).toFixed(3) + ')');
    linha(c, -9, by + 1, 9, by + 1, pal.madeiraEsc, 1.4);
    caixa(c, 0, by, 9, 6, 6, pal.madeira, pal.madeiraEsc, pal.madeira);
    c.fillStyle = '#d6b25a'; c.fillRect(-4.5, by - 3.6, 9, 1.2);
    poli(c, [0, by - 13, 2.8, by - 9.5, 0, by - 6.5, -2.8, by - 9.5], cor);
    brilho(c, 4, by - 13, t, 0.7, '#fff');
  }

  /* pessoa: o = { roupa, dir, andando, fase, capacete, lanca, escudo, carga, trabalho, sentado, arco, atirando, capuz, cinto } */
  function pessoa(c, x, y, t, pal, o) {
    var dir = o.dir || 1, ph = t * 8 + (o.fase || 0), anda = o.andando ? Math.sin(ph) : 0;
    var by = y - Math.abs(anda) * 0.5;
    if (!o.sentado) {
      sombra(c, x, y, 4.2, 0.24);
      linha(c, x - 0.9, by - 5.5, x - 0.9 + anda * 2.3, y, pal.calca, 1.7);
      linha(c, x + 0.9, by - 5.5, x + 0.9 - anda * 2.3, y, pal.calca, 1.7);
    }
    poli(c, [x - 3.1, by - 5, x + 3.1, by - 5, x + 2.3, by - 11.5, x - 2.3, by - 11.5], o.roupa);
    if (o.cinto) { c.fillStyle = o.cinto; c.fillRect(x - 2.8, by - 7.2, 5.6, 1.1); }
    var braco = o.trabalho ? Math.sin(t * 6 + (o.fase || 0)) : anda * 0.6;
    if (o.trabalho) {
      var ang = -1.6 + braco * 1.1;
      var hx = x + dir * 1.5 + Math.cos(ang) * dir * 7, hy = by - 10 + Math.sin(ang) * 7;
      linha(c, x + dir * 1.5, by - 10, hx, hy, pal.madeira, 1.3);
      if (o.trabalho === 'martelo') { c.fillStyle = pal.metalEsc; c.fillRect(hx - 1.5, hy - 1.5, 3, 3); }
      else { linha(c, hx - 2.5 * dir, hy + 1.5, hx + 2.5 * dir, hy - 1.5, pal.metal, 1.4); }
    } else {
      linha(c, x - 2.4, by - 10.5, x - 2.6 - braco * 1.6, by - 6.5, o.roupa, 1.4);
    }
    elipse(c, x, by - 14, 2.5, 2.5, pal.pele);
    if (o.capacete) { c.fillStyle = o.capacete; c.beginPath(); c.arc(x, by - 14.4, 2.7, Math.PI, 0); c.fill(); c.fillRect(x - 0.3, by - 14.4, 0.6, 2.2); }
    else { c.fillStyle = pal.cabelo; c.beginPath(); c.arc(x, by - 14.6, 2.55, Math.PI * 1.05, -0.05); c.fill(); }
    if (o.lanca) {
      var lx = x + dir * 3, inc = o.estocada ? Math.max(0, Math.sin(t * 4 + (o.fase || 0))) * 3 : 0;
      linha(c, lx + dir * inc, by - 3, lx + dir * (1.5 + inc), by - 24, pal.madeira, 1.1);
      poli(c, [lx + dir * (1.5 + inc) - 1, by - 24, lx + dir * (1.5 + inc) + 1, by - 24, lx + dir * (1.7 + inc), by - 27.5], pal.metal);
    }
    if (o.escudo) { elipse(c, x - dir * 2.6, by - 8.5, 2.9, 3.4, o.escudo); c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 0.6; c.stroke(); }
    if (o.arco) {
      var ax = x + dir * 3.2, ay = by - 9.5;
      c.strokeStyle = pal.madeiraEsc; c.lineWidth = 1.1; c.beginPath(); c.arc(ax - dir * 2, ay, 6, dir > 0 ? -1.15 : Math.PI - 1.15, dir > 0 ? 1.15 : Math.PI + 1.15); c.stroke();
      var puxa = o.atirando ? Math.max(0, Math.sin(t * 3 + (o.fase || 0))) * 2.5 : 0;
      linha(c, ax - dir * 2 + dir * 6 * Math.cos(1.15), ay - 6 * Math.sin(1.15), ax - dir * puxa, ay, '#e8dfcc', 0.5);
      linha(c, ax - dir * puxa, ay, ax - dir * 2 + dir * 6 * Math.cos(1.15), ay + 6 * Math.sin(1.15), '#e8dfcc', 0.5);
    }
    if (o.capuz) { c.fillStyle = o.capuz; c.beginPath(); c.arc(x, by - 14.2, 3, Math.PI * 0.95, Math.PI * 2.05); c.lineTo(x + 2.4, by - 11.5); c.lineTo(x - 2.4, by - 11.5); c.fill(); }
    if (o.carga === 'tronco') { c.save(); c.translate(x, by - 14.5); c.rotate(-0.15 * dir); c.fillStyle = pal.madeiraLuz; c.fillRect(-6, -1.6, 12, 3.2); elipse(c, 6, 0, 1.1, 1.6, '#c9a676'); c.restore(); }
    else if (o.carga === 'saco') elipse(c, x + dir * 2, by - 15.5, 2.8, 2.4, '#cdb98f');
    else if (o.carga === 'minerio') elipse(c, x + dir * 2, by - 15.5, 2.9, 2.2, o.corCarga || pal.minerioFerro);
    else if (o.carga === 'picareta') { linha(c, x - dir * 2, by - 6, x + dir * 4, by - 16, pal.madeira, 1); linha(c, x + dir * 1.5, by - 17, x + dir * 6.5, by - 14.5, pal.metal, 1.3); }
  }
  function cavalo(c, x, y, t, pal, o) {
    var dir = o.dir || 1, ph = t * (o.galope ? 11 : 6) + (o.fase || 0), cor = o.cor || pal.cavalo[0];
    var mov = o.andando ? 1 : 0, pasta = o.pastando;
    sombra(c, x, y, 8.5, 0.24);
    [[-5, 0], [-3.5, 1.6], [3.5, 3.1], [5, 4.7]].forEach(function (p) { linha(c, x + p[0] * dir, y - 7, x + p[0] * dir + Math.sin(ph + p[1]) * 2.2 * mov, y, o.escuro || '#2c2018', 1.5); });
    elipse(c, x, y - 9, 7.8, 3.8, cor);
    var hx = x + dir * (pasta ? 9 : 10), hy = y - (pasta ? 6 : 16);
    poli(c, [x + dir * 4.5, y - 11.5, x + dir * 7, y - 8.5, hx + dir * 1.5, hy + 1.8, hx - dir * 1.2, hy - 1.6], cor);
    elipse(c, hx + dir * 1.2, hy + 0.6, 2.9, 1.6, cor);
    linha(c, x + dir * 4.2, y - 12, hx - dir * 1, hy - 1.8, o.escuro || '#2c2018', 1.3);
    linha(c, x - dir * 7.5, y - 10, x - dir * (10 + Math.sin(t * 3) * 0.6), y - 5, o.escuro || '#2c2018', 1.6);
    if (o.cavaleiro) pessoa(c, x - dir * 0.5, y - 9.5, t, pal, { roupa: o.cavaleiro, dir: dir, sentado: true, capacete: o.capacete });
  }
  /* carroça puxada a boi, com sacos de carga; rodas giram */
  function carroca(c, t, pal, dir, cor, fase) {
    cavalo(c, dir * 14, 0, t, pal, { cor: '#6e5137', escuro: '#3a2a1c', dir: dir, andando: true, fase: fase });
    sombra(c, -2 * dir, 0, 10, 0.25);
    linha(c, dir * 4, -6, dir * 10, -8.5, pal.madeiraEsc, 1.3);
    caixa(c, -2 * dir, -3, 13, 7, 6, pal.madeira, pal.madeiraEsc, pal.madeiraLuz);
    c.fillStyle = cor; c.fillRect(-8.5 - 2 * dir, -6.2, 13, 1.4);
    elipse(c, -6 * dir, -11, 3.6, 2.6, '#d8c9a2'); elipse(c, -1 * dir, -11.5, 3.6, 2.6, '#cbb88d'); elipse(c, -3.5 * dir, -14, 3, 2.2, '#e0d3ae');
    [-7, 3].forEach(function (wx) {
      var rx = wx * dir - 2 * dir, g = t * 5 + (fase || 0);
      elipse(c, rx, -2, 3.3, 3.3, '#2c2018'); elipse(c, rx, -2, 1.5, 1.5, pal.madeira);
      linha(c, rx - Math.cos(g) * 2.8, -2 - Math.sin(g) * 2.8, rx + Math.cos(g) * 2.8, -2 + Math.sin(g) * 2.8, pal.madeira, 0.7);
    });
  }
  function animal(c, tipo, x, y, t, pal, dir, mov, fase) {
    var ph = t * 9 + fase, a = mov ? 1 : 0, i;
    if (tipo === 'lobos') {
      sombra(c, x, y, 6.5, 0.22);
      [[-4, 0], [-2.5, 1.6], [3, 3.1], [4.5, 4.7]].forEach(function (p) { linha(c, x + p[0] * dir, y - 5, x + p[0] * dir + Math.sin(ph + p[1]) * 1.8 * a, y, pal.loboEsc, 1.1); });
      elipse(c, x, y - 6.5, 6, 2.6, pal.lobo);
      linha(c, x - dir * 5.5, y - 7, x - dir * 9, y - 9 + Math.sin(t * 4 + fase), pal.lobo, 1.6);
      elipse(c, x + dir * 6.4, y - 8.2, 2.6, 2, pal.lobo);
      poli(c, [x + dir * 7.5, y - 8.8, x + dir * 11, y - 7.6, x + dir * 7.8, y - 6.9], pal.lobo);
      poli(c, [x + dir * 5.4, y - 9.6, x + dir * 5.9, y - 12, x + dir * 6.8, y - 9.9], pal.loboEsc);
    } else if (tipo === 'javalis') {
      sombra(c, x, y, 6.5, 0.24);
      [[-3.5, 0], [-2, 1.6], [2.5, 3.1], [3.8, 4.7]].forEach(function (p) { linha(c, x + p[0] * dir, y - 3.5, x + p[0] * dir + Math.sin(ph + p[1]) * 1.3 * a, y, pal.javaliEsc, 1.3); });
      elipse(c, x, y - 5.5, 6.2, 3.7, pal.javali);
      poli(c, [x + dir * 4.5, y - 8.5, x + dir * 9.5, y - 5, x + dir * 9.5, y - 3, x + dir * 4.5, y - 3], pal.javaliEsc);
      linha(c, x + dir * 8, y - 3.6, x + dir * 9.5, y - 6.2, pal.presa, 0.9);
      linha(c, x - dir * 3, y - 9, x + dir * 3, y - 9.2, pal.javaliEsc, 1.4);
    } else if (tipo === 'ursos') {
      sombra(c, x, y, 9.5, 0.26);
      [[-5.5, 0], [-3.5, 1.6], [4, 3.1], [6, 4.7]].forEach(function (p) { linha(c, x + p[0] * dir, y - 5, x + p[0] * dir + Math.sin(ph * 0.6 + p[1]) * 1.6 * a, y, pal.ursoEsc, 2.6); });
      elipse(c, x, y - 8, 8.8, 5.6, pal.urso);
      elipse(c, x - dir * 1, y - 11, 6, 3, pal.ursoEsc);
      elipse(c, x + dir * 8.4, y - 9.5, 3.7, 3.3, pal.urso);
      elipse(c, x + dir * 11.2, y - 8.6, 1.8, 1.4, pal.ursoEsc);
      elipse(c, x + dir * 7, y - 12.6, 1.2, 1.2, pal.ursoEsc);
    } else if (tipo === 'crocodilos') {
      var sw = Math.sin(t * 1.5 + fase) * 1.2;
      elipse(c, x, y - 0.5, 10, 2.4, 'rgba(20,40,60,.35)');
      c.fillStyle = pal.croc; c.beginPath();
      c.moveTo(x - dir * 11, y - 0.5 + sw); c.quadraticCurveTo(x - dir * 4, y - 3.2, x + dir * 4, y - 2.4);
      c.lineTo(x + dir * 12, y - 1.6); c.lineTo(x + dir * 12, y - 0.4); c.quadraticCurveTo(x, y + 0.6, x - dir * 11, y - 0.5 + sw); c.fill();
      for (i = -3; i <= 2; i++) elipse(c, x + dir * i * 2.2, y - 2.6, 0.7, 0.5, pal.crocEsc);
      elipse(c, x + dir * 4.5, y - 3, 0.8, 0.8, '#e2d36a');
    }
  }

  /* ================================================================ construções
     x = { tipo, nivel, produz, ruina, moinho } — o nível muda o porte e acrescenta detalhes */
  function porte(nivel) { return nivel ? Math.min(1.22, 0.86 + nivel * 0.036) : 1; }
  function local(c, x, t, pal, cor, anim) {
    var tipo = x.tipo, nv = x.nivel || 3, i, k = porte(x.nivel);
    c.save(); c.scale(k, k);
    if (tipo === 'castelo') {
      elipse(c, 0, 4, 36, 36 * K * 0.85, pal.terra);
      caixa(c, 0, gz(-20), 50, 4, 15, pal.pedra, pal.pedraSombra, pal.pedraTopo); ameias(c, 0, gz(-20), 50, 4, 15, pal.pedraLuz);
      torre(c, -25, gz(-20), 6.5, 24, pal); torre(c, 25, gz(-20), 6.5, 24, pal);
      caixa(c, -25, gz(14), 4, 34, 14, pal.pedra, pal.pedraSombra, pal.pedraTopo);
      caixa(c, 25, gz(14), 4, 34, 14, pal.pedra, pal.pedraSombra, pal.pedraTopo);
      caixa(c, 0, gz(2), 20, 14, 31 + Math.min(10, nv), pal.pedraLuz, pal.pedraSombra, pal.pedraTopo); ameias(c, 0, gz(2), 20, 14, 31 + Math.min(10, nv), pal.pedra);
      c.fillStyle = cor; c.fillRect(-7, gz(2) - 27, 4, 10); c.fillRect(3, gz(2) - 27, 4, 10);
      c.fillStyle = pal.porta; c.fillRect(-1.2, gz(2) - 22, 2.4, 4);
      caixa(c, 0, gz(14), 50, 4, 13, pal.pedra, pal.pedraSombra, pal.pedraTopo); ameias(c, 0, gz(14), 50, 4, 13, pal.pedraLuz);
      c.fillStyle = pal.porta; c.beginPath(); c.moveTo(-5, gz(14)); c.lineTo(-5, gz(14) - 7); c.arc(0, gz(14) - 7, 5, Math.PI, 0); c.lineTo(5, gz(14)); c.fill();
      c.strokeStyle = pal.metalEsc; c.lineWidth = 0.6; for (i = -3; i <= 3; i += 2) { c.beginPath(); c.moveTo(i, gz(14)); c.lineTo(i, gz(14) - 10); c.stroke(); }
      torre(c, -25, gz(14), 7, 22, pal); torre(c, 25, gz(14), 7, 22, pal);
      if (nv >= 6) { torre(c, -12, gz(-8), 5, 38, pal, { cone: pal.telhado }); }
      var hk = 31 + Math.min(10, nv);
      bandeira(c, 3, gz(2) - hk - 3, 15, cor, anim ? t : 0, 11, 6);
      bandeira(c, -25, gz(14) - 25, 8, cor, anim ? t + 1 : 0, 7, 4);
      bandeira(c, 25, gz(14) - 25, 8, cor, anim ? t + 2 : 0, 7, 4);
    } else if (tipo === 'vila') {
      elipse(c, 0, 0, 30, 30 * K * 0.8, pal.terra);
      poli(c, [-30, gz(4), -10, gz(4), -6, gz(18), -26, gz(18)], pal.campo);
      c.strokeStyle = pal.campo2; c.lineWidth = 0.8; for (i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-29 + i * 0.8, gz(6.5 + i * 2.6)); c.lineTo(-9.5 + i * 0.8, gz(6.5 + i * 2.6)); c.stroke(); }
      poli(c, [12, gz(-22), 30, gz(-22), 32, gz(-8), 14, gz(-8)], pal.grama2);
      var r1 = casa(c, -9, gz(-6), 14, 10, 9, 7, pal, { luz: true });
      casa(c, 10, gz(-1), 12, 9, 8, 6, pal, { telhado: pal.telhado2, telhadoS: pal.telhado2Sombra });
      if (nv >= 4) casa(c, 22, gz(-14), 10, 8, 7, 5, pal, { luz: true });
      casa(c, -1, gz(12), 13, 10, 9, 7, pal, { luz: true });
      if (nv >= 7) casa(c, 18, gz(14), 11, 8, 8, 6, pal, { telhado: pal.telhado2, telhadoS: pal.telhado2Sombra });
      elipse(c, 15, gz(12) - (nv >= 7 ? 20 : 0), 3.2, 2, pal.pedraSombra); elipse(c, 15, gz(12) - 2.5 - (nv >= 7 ? 20 : 0), 3.2, 2, pal.pedra);
      if (x.moinho) {
        caixa(c, -24, gz(-16), 7, 6, 20, pal.parede, pal.paredeSombra);
        poli(c, [-28, gz(-16) - 20, -20, gz(-16) - 20, -24, gz(-16) - 27], pal.telhado2);
        c.save(); c.translate(-24, gz(-16) - 22); c.rotate(anim ? t * 0.9 : 0.3);
        for (i = 0; i < 4; i++) { c.rotate(Math.PI / 2); poli(c, [0, -1, 15, -1, 15, -4.5, 3, -3.5], pal.lona); linha(c, 0, 0, 15, 0, pal.madeiraEsc, 0.9); }
        c.restore(); elipse(c, -24, gz(-16) - 22, 1.3, 1.3, pal.madeiraEsc);
      }
      if (anim) fumaca(c, r1.chamine.x, r1.chamine.y, t, false, 0.8);
    } else if (tipo === 'mina') {
      var minerio = x.produz === 'pedra' ? pal.minerioPedra : pal.minerioFerro;
      monte(c, 0, gz(-2), 50, 22, pal);
      c.fillStyle = '#17120d'; c.beginPath(); c.moveTo(-6, gz(4)); c.lineTo(-6, gz(4) - 8); c.arc(0, gz(4) - 8, 6, Math.PI, 0); c.lineTo(6, gz(4)); c.fill();
      linha(c, -7, gz(4), -7, gz(4) - 12, pal.madeira, 2); linha(c, 7, gz(4), 7, gz(4) - 12, pal.madeira, 2); linha(c, -8.5, gz(4) - 12, 8.5, gz(4) - 12, pal.madeiraEsc, 2.2);
      linha(c, -2.5, gz(4), -3.5, gz(22), pal.metalEsc, 0.9); linha(c, 2.5, gz(4), 3.5, gz(22), pal.metalEsc, 0.9);
      caixa(c, 4, gz(16), 8, 5, 4, pal.madeira, pal.madeiraEsc, null); elipse(c, 4.8, gz(16) - 4.5, 4, 2, minerio);
      poli(c, [-22, gz(14), -12, gz(14), -17, gz(14) - 7], minerio); poli(c, [-17, gz(14) - 7, -12, gz(14), -16, gz(14)], 'rgba(0,0,0,.2)');
      if (nv >= 5) { poli(c, [16, gz(10), 26, gz(10), 21, gz(10) - 6], minerio); }
    } else if (tipo === 'serraria') {
      elipse(c, 0, 0, 28, 28 * K * 0.8, pal.terraEsc);
      for (i = 0; i < 3; i++) { c.fillStyle = pal.madeiraLuz; c.fillRect(-26, gz(10) - 3 - i * 3.2, 14, 3); elipse(c, -12, gz(10) - 1.5 - i * 3.2, 1.6, 1.6, '#c9a676'); }
      if (nv >= 4) { c.fillStyle = pal.madeiraLuz; c.fillRect(-24, gz(10) - 12.6, 10, 3); elipse(c, -14, gz(10) - 11.1, 1.6, 1.6, '#c9a676'); }
      [[-2, -8], [16, -8], [-2, 6], [16, 6]].forEach(function (p) { linha(c, p[0], gz(p[1]), p[0], gz(p[1]) - 13, pal.madeiraEsc, 1.6); });
      caixa(c, 7, gz(6) - 13, 22, 16, 1.5, pal.telhado2, pal.telhado2Sombra, pal.telhado2);
      caixa(c, 7, gz(0), 16, 4, 3, pal.madeira, pal.madeiraEsc, pal.madeiraLuz);
      c.fillStyle = pal.madeiraLuz; c.fillRect(0, gz(0) - 5, 14, 2.2);
      c.save(); c.translate(7, gz(0) - 6); c.rotate(anim ? t * 6 : 0); c.strokeStyle = pal.metal; c.lineWidth = 0.9; c.beginPath(); c.arc(0, 0, 3.5, 0, 6.2832); c.stroke(); linha(c, -3.5, 0, 3.5, 0, pal.metal, 0.7); c.restore();
      elipse(c, 20, gz(14), 3, 1.8, '#a07c50'); elipse(c, 25, gz(4), 2.6, 1.6, '#a07c50');
    } else if (tipo === 'pasto') {
      elipse(c, 0, 0, 32, 32 * K * 0.85, pal.grama2);
      if (nv >= 3) casa(c, -22, gz(-14), 10, 7, 6, 5, pal, { telhado: pal.telhado2, telhadoS: pal.telhado2Sombra, janela: false });
    } else if (tipo === 'armazem') {
      elipse(c, 0, 0, 30, 30 * K * 0.8, pal.terra);
      casa(c, 0, gz(4), 30, 18, 13, 11, pal, { telhado: pal.telhado2, telhadoS: pal.telhado2Sombra, porta: false, janela: false });
      c.fillStyle = pal.madeiraEsc; c.fillRect(-5, gz(4) - 10, 10, 10); linha(c, -5, gz(4) - 10, 5, gz(4), pal.madeira, 1); linha(c, 5, gz(4) - 10, -5, gz(4), pal.madeira, 1);
      caixa(c, -20, gz(14), 6, 5, 5, pal.madeiraLuz, pal.madeira, '#b8935f'); caixa(c, -13, gz(16), 5, 5, 4, pal.madeiraLuz, pal.madeira, '#b8935f');
      elipse(c, 17, gz(14) - 2, 3, 2.6, '#cdb98f'); elipse(c, 21, gz(15) - 2, 2.8, 2.4, '#bfa97d');
    } else if (tipo === 'ferraria') {
      elipse(c, 0, 0, 26, 26 * K * 0.8, pal.terraEsc);
      casa(c, -4, gz(2), 18, 12, 10, 7, pal, { parede: pal.pedra, paredeS: pal.pedraSombra, luz: true });
      caixa(c, 4, gz(-4) - 8, 4, 4, 14, pal.pedraSombra, '#5d574f', pal.pedra);
      var g = anim ? 0.55 + Math.sin(t * 7) * 0.2 : 0.4;
      elipse(c, -4, gz(2) - 3, 3.5, 2.4, 'rgba(255,150,60,' + g.toFixed(2) + ')');
      caixa(c, 11, gz(12), 6, 3, 2.5, pal.metalEsc, '#3e4349', pal.metal); c.fillStyle = pal.metalEsc; c.fillRect(10, gz(12) - 6, 2.5, 3.5);
      if (anim) {
        fumaca(c, 6, gz(-4) - 23, t, true, 1);
        if (Math.sin(t * 6) > 0.85) for (i = 0; i < 4; i++) elipse(c, 13 + Math.sin(i * 2.3 + t * 20) * 4, gz(12) - 6 - Math.abs(Math.cos(i + t * 15)) * 4, 0.5, 0.5, '#ffd27a');
      }
    } else if (tipo === 'quartel') {
      elipse(c, 0, 0, 30, 30 * K * 0.8, pal.terra);
      var tendas = nv >= 4 ? [[-14, -8], [8, -10], [-4, 8], [16, 6]] : [[-14, -8], [8, -10], [-4, 8]];
      tendas.forEach(function (p, j) {
        var tx = p[0], ty = gz(p[1]);
        sombra(c, tx + 3, ty, 9, 0.2);
        poli(c, [tx - 9, ty, tx + 9, ty, tx, ty - 15], j === 1 ? cor : pal.lona);
        poli(c, [tx, ty - 15, tx + 9, ty, tx + 12, ty - 3.5, tx + 3, ty - 17], pal.lonaSombra);
        poli(c, [tx - 2, ty, tx + 2, ty, tx, ty - 6], pal.porta);
      });
      linha(c, 19, gz(10), 19, gz(10) - 10, pal.madeira, 1.4); linha(c, 15, gz(10) - 7, 23, gz(10) - 7, pal.madeira, 1.4); elipse(c, 19, gz(10) - 11.5, 2.4, 2.4, '#cdb98f');
      bandeira(c, 22, gz(-4), 20, cor, anim ? t : 0, 9, 5);
    } else if (tipo === 'posto') {
      elipse(c, 0, 0, 20, 20 * K * 0.8, pal.terraEsc);
      casa(c, 0, gz(2), 13, 9, 7, 5, pal, { telhado: pal.telhado2, telhadoS: pal.telhado2Sombra, janela: false });
      caixa(c, -14, gz(10), 7, 5, 4, pal.madeira, pal.madeiraEsc, null);
    } else {
      /* tipo novo de local: casa simples */
      elipse(c, 0, 0, 22, 22 * K * 0.8, pal.terra);
      casa(c, 0, gz(4), 16, 11, 9, 7, pal, {});
    }
    c.restore();
  }
  /* ruína (local destruído) ou terra livre */
  function ruina(c, x, t, pal) {
    if (!x.ruina) {
      elipse(c, 0, 0, 22, 22 * K * 0.8, pal.terra);
      [[-14, -6], [14, -6], [14, 8], [-14, 8]].forEach(function (p) { linha(c, p[0], gz(p[1]), p[0], gz(p[1]) - 7, pal.madeiraEsc, 1.6); });
      c.strokeStyle = '#cdb98f'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(-14, gz(-6) - 6); c.lineTo(14, gz(-6) - 6); c.lineTo(14, gz(8) - 6); c.lineTo(-14, gz(8) - 6); c.closePath(); c.stroke();
      return;
    }
    elipse(c, 0, 0, 30, 30 * K * 0.8, pal.terraEsc);
    var esc = { cor: pal.rochaSombra, luz: pal.rocha, sombra: '#4a4744' };
    if (x.tipo === 'castelo') {
      poli(c, [-24, gz(-16), -24, gz(-16) - 12, -18, gz(-16) - 9, -14, gz(-16) - 13, -8, gz(-16) - 6, -8, gz(-16)], pal.rocha);
      poli(c, [6, gz(-16), 6, gz(-16) - 8, 12, gz(-16) - 11, 20, gz(-16) - 7, 24, gz(-16) - 10, 24, gz(-16)], pal.rocha);
      torre(c, -24, gz(12), 6.5, 11, pal, esc);
      poli(c, [-16, gz(12), -16, gz(12) - 7, -8, gz(12) - 4, -4, gz(12)], pal.rochaSombra);
      torre(c, 22, gz(10), 6, 7, pal, esc);
    } else {
      [[-10, -4], [9, 0], [-1, 12]].forEach(function (p) {
        var px = p[0], py = gz(p[1]);
        poli(c, [px - 6, py, px - 6, py - 7, px - 2, py - 9, px + 1, py - 5, px + 6, py - 6, px + 6, py], pal.rochaSombra);
        c.fillStyle = '#211b15'; c.fillRect(px - 1.5, py - 5, 3, 5);
      });
    }
    rocha(c, 4, gz(4), 0.8, pal); rocha(c, -6, gz(18), 0.6, pal); rocha(c, 16, gz(16), 0.7, pal);
  }
  /* jazida (recurso valioso) ou ruína antiga (lendária) */
  function jazida(c, recurso, t, pal, anim, esgotada) {
    var i;
    if (recurso === 'sal') {
      elipse(c, 0, 0, 22, 22 * K * 0.8, pal.sal);
      [[-8, -2], [5, -6], [9, 6]].forEach(function (p) { poli(c, [p[0] - 4, gz(p[1]), p[0] + 4, gz(p[1]), p[0], gz(p[1]) - 6], '#ffffff'); poli(c, [p[0], gz(p[1]) - 6, p[0] + 4, gz(p[1]), p[0] + 1, gz(p[1])], '#d7d2c7'); });
      return;
    }
    if (recurso === 'ervas') {
      [[-10, -4, pal.erva1], [6, -8, pal.erva2], [10, 6, pal.erva1], [-4, 8, pal.erva2], [-14, 6, pal.erva2]].forEach(function (p) { arbusto(c, p[0], gz(p[1]), 1.2, pal, p[2]); });
      return;
    }
    if (recurso === 'cavalo') return; /* manada desenhada como animais */
    if (recurso === 'ruina') {
      elipse(c, 0, 0, 26, 26 * K * 0.8, pal.terraEsc);
      if (!esgotada) { var g = anim ? 0.25 + Math.sin(t * 1.6) * 0.12 : 0.15; elipse(c, 0, -6, 24, 14, 'rgba(201,140,240,' + g.toFixed(2) + ')'); }
      [[-10, -2, 22], [8, -6, 16], [-2, 10, 9]].forEach(function (p) { var x = p[0], y = gz(p[1]); c.fillStyle = pal.pedraLuz; c.fillRect(x - 2.5, y - p[2], 5, p[2]); c.fillStyle = pal.pedraSombra; c.fillRect(x + 0.8, y - p[2], 1.7, p[2]); c.fillStyle = pal.pedraTopo; c.fillRect(x - 3.5, y - p[2] - 2, 7, 2); });
      c.save(); c.translate(12, gz(10)); c.rotate(-0.25); c.fillStyle = pal.pedra; c.fillRect(-9, -3, 18, 4); c.restore();
      if (anim && !esgotada) for (i = 0; i < 4; i++) { var a = (t * 0.25 + i / 4) % 1; elipse(c, Math.sin(i * 2 + t) * 10, -6 - a * 26, 1, 1, 'rgba(222,180,255,' + (1 - a).toFixed(2) + ')'); }
      return;
    }
    var veio = recurso === 'ouro' ? pal.ouro : recurso === 'prata' ? pal.prata : recurso === 'aco' ? pal.aco : recurso === 'minerio' ? pal.lend : pal.gema;
    rocha(c, -8, gz(2), 1.6, pal); rocha(c, 7, gz(-3), 1.3, pal); rocha(c, 2, gz(8), 1.1, pal);
    if (recurso === 'gema' || recurso === 'minerio') {
      [[-3, 2, 9], [3, 3, 12], [8, 6, 7]].forEach(function (p) { poli(c, [p[0] - 2, gz(p[1]), p[0], gz(p[1]) - p[2], p[0] + 2, gz(p[1])], veio); poli(c, [p[0], gz(p[1]) - p[2], p[0] + 2, gz(p[1]), p[0] + 0.5, gz(p[1])], 'rgba(0,0,0,.25)'); });
    } else {
      linha(c, -12, gz(2) - 3, -6, gz(2) - 6, veio, 1.2); linha(c, 5, gz(-3) - 3, 9, gz(-3) - 5, veio, 1.2); linha(c, 0, gz(8) - 2, 3, gz(8) - 4, veio, 1);
    }
    if (anim) { brilho(c, -9, gz(2) - 6, t, 0, '#fff7d0'); brilho(c, 8, gz(-3) - 5, t, 2.1, '#fff7d0'); brilho(c, 2, gz(8) - 4, t, 4.2, '#fff7d0'); }
  }
  function placaPerigo(c, nivel, pal) {
    linha(c, 0, 0, 0, -12, pal.madeiraEsc, 1.6);
    poli(c, [-6, -12, 6, -12, 0, -22], corNivel(nivel), '#2b2520', 0.8);
    c.fillStyle = '#2b2520'; c.fillRect(-0.5, -19.5, 1, 4); c.fillRect(-0.5, -14.6, 1, 1);
  }
  /* marcador de objeto de tipo desconhecido: marco de pedra com fita */
  function marco(c, t, pal, anim) {
    sombra(c, 0, 0, 6, 0.24);
    poli(c, [-5, 0, -3.5, -9, 3.5, -10, 5, 0], pal.pedra);
    poli(c, [3.5, -10, 5, 0, 1.5, 0], pal.pedraSombra);
    bandeira(c, 0, -9, 10, cores().destaque, anim ? t : 0, 7, 4);
  }
  function andaime(c, r, pal) {
    var h = r * 1.3;
    [[-r, 6], [r, 6], [-r * 0.7, -8], [r * 0.9, -6]].forEach(function (q) { linha(c, q[0], gz(q[1]), q[0], gz(q[1]) - h, pal.madeiraLuz, 1.4); });
    [0.35, 0.7].forEach(function (f) { linha(c, -r - 2, gz(6) - h * f, r + 2, gz(6) - h * f, pal.madeira, 1.6); });
    linha(c, -r, gz(6), -r * 0.7, gz(-8) - h * 0.7, pal.madeira, 0.9);
    linha(c, r, gz(6) - h * 0.35, r * 0.2, gz(6) - h * 0.7, pal.madeira, 0.9);
  }
  function materiais(c, pal, dx) {
    dx = dx || 0;
    for (var i = 0; i < 3; i++) { c.fillStyle = pal.madeiraLuz; c.fillRect(18 + dx, gz(14) - 3 - i * 2.6, 12, 2.4); }
    rocha(c, 34 + dx, gz(16), 0.7, pal); rocha(c, 38 + dx, gz(12), 0.6, pal);
  }
  function cerca(c, pal, frente) {
    var rx = 30, rz = 22, n = 14, i, a, x, y, px = null, py = null;
    for (i = 0; i <= n; i++) {
      a = (i / n) * Math.PI * 2;
      x = Math.cos(a) * rx; y = gz(Math.sin(a) * rz);
      if ((Math.sin(a) > 0) === frente) {
        linha(c, x, y, x, y - 6, pal.madeiraEsc, 1.3);
        if (px !== null) { linha(c, px, py - 5, x, y - 5, pal.madeira, 1); linha(c, px, py - 2.5, x, y - 2.5, pal.madeira, 1); }
        px = x; py = y;
      } else px = null;
    }
  }
  /* rótulo em pílula (espaço de tela) */
  function pilula(c, x, y, txt, cls, cor) {
    var C = cores();
    c.font = (cls === 'castelo' ? '700 13px ' + C.fonteTitulo : '700 12px ' + C.fonteTexto);
    var w = c.measureText(txt).width + 16, h = 20;
    c.fillStyle = 'rgba(13,15,18,.82)';
    c.beginPath();
    if (c.roundRect) c.roundRect(x - w / 2, y - h / 2, w, h, 10); else c.rect(x - w / 2, y - h / 2, w, h);
    c.fill();
    c.strokeStyle = cor || 'rgba(255,255,255,.2)'; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = cls === 'perigo' ? '#ffb3a8' : '#efe9dd'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(txt, x, y + 0.5);
  }

  RP.arte = {
    K: K, OB: OB, P: P, PA: PA, mix: mix, hash: hash, cores: cores, corDono: corDono, corNivel: corNivel, tintura: tintura, CRU: CRU, COR_REL: COR_REL,
    puff: puff, gz: gz, elipse: elipse, poli: poli, linha: linha, sombra: sombra, caixa: caixa, ameias: ameias, casa: casa, torre: torre,
    bandeira: bandeira, arvoreConifera: arvoreConifera, arvoreFolhosa: arvoreFolhosa, arbusto: arbusto, rocha: rocha, monte: monte, pico: pico,
    junco: junco, fumaca: fumaca, brilho: brilho, pedestalReliquia: pedestalReliquia, bauReliquia: bauReliquia, pessoa: pessoa, cavalo: cavalo,
    carroca: carroca, animal: animal, local: local, ruina: ruina, jazida: jazida, placaPerigo: placaPerigo, marco: marco, andaime: andaime,
    materiais: materiais, cerca: cerca, pilula: pilula,
    K_PADRAO: K_PADRAO, K_MIN: K_MIN, K_MAX: K_MAX, aoMudarK: []
  };
  /* inclinação dos sprites 3D: K em passos, para inclinar não refazer tudo a cada movimento do arrasto. kVizinhos: as outras
     inclinações, da mais perto para a mais longe, para usar um sprite pronto enquanto o novo não sai. */
  var PASSO_K3D = 0.04;
  RP.arte.K3D = K_PADRAO;
  RP.arte.kVizinhos = function () {
    var out = [], n = Math.ceil((K_MAX - K_MIN) / PASSO_K3D);
    for (var d = 1; d <= n; d++) [d, -d].forEach(function (s) { var k = RP.arte.K3D + s * PASSO_K3D; if (k > K_MIN - PASSO_K3D && k < K_MAX + PASSO_K3D) out.push(k.toFixed(2)); });
    return out;
  };
  /* altura na tela de algo em pé com h unidades: visto de cima, o que é alto encurta */
  RP.arte.emPe = function (h) { return h * Math.cos(Math.asin(Math.min(0.95, K))); };
  /* inclinação da câmera: muda o achatamento do chão para toda a arte; quem desenha ouve em aoMudarK */
  RP.arte.definirK = function (k) {
    K = Math.max(K_MIN, Math.min(K_MAX, k)); RP.arte.K = K;
    RP.arte.K3D = K_PADRAO + Math.round((K - K_PADRAO) / PASSO_K3D) * PASSO_K3D;
    RP.arte.aoMudarK.forEach(function (f) { try { f(K); } catch (e) { console.error(e); } });
  };
  /* giro da câmera em volta do ponto olhado (radianos; 0 = norte do mapa para cima). AZ reprojeta o chão e as posições
     (aoMudarAz). Construções giram em 3D ao vivo, por passos (estruturas.js); pessoas escolhem entre os 8 sprites de direção
     pelo AZ de agora; a vegetação fica em pé, sempre com o mesmo sprite. */
  RP.arte.AZ = 0; RP.arte.aoMudarAz = [];
  RP.arte.definirAz = function (az) {
    az = Math.atan2(Math.sin(az), Math.cos(az));
    RP.arte.AZ = az;
    RP.arte.aoMudarAz.forEach(function (f) { try { f(az); } catch (e) { console.error(e); } });
  };
})();
