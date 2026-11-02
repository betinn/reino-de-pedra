/* Reino de Pedra — "Vista": cena imersiva 2.5D do mundo (câmera alta e inclinada).
   Canvas 2D, arte procedural própria, sem dependências. É referência visual para a
   implementação: mesmas coordenadas, mesma névoa e mesmas entidades do mapa tático.

   Camadas:
     cache estático  chão, rios, estradas, vegetação, relevo e bancos de névoa (refeito só ao mover muito ou mudar o zoom)
     quadro animado  construções, pessoas, tropas, animais, fumaça, brilho do rio, névoa à deriva, rótulos */
(function () {
  'use strict';
  var RP = window.RP, H = RP.hex, D = RP.dados, W = RP.mundo;

  var K = 0.62;      /* achatamento do chão: inclinação da câmera */
  var OB = 0.45;     /* deslocamento oblíquo do topo das construções (mostra a lateral direita) */
  var SMIN = 0.85, SMAX = 3.2;

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
    minerioFerro: '#6d7a88', minerioPedra: '#c3bdb2',
    nevoa: '#232830'
  };
  function rgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mix(a, b, t) {
    if (a.charAt(0) !== '#') return a;
    var x = rgb(a), y = rgb(b), g = (x[0] + x[1] + x[2]) / 3;
    var r = [0, 1, 2].map(function (i) { var dess = x[i] + (g - x[i]) * 0.55; return Math.round(dess + (y[i] - dess) * t); });
    return '#' + r.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
  }
  /* paleta da informação antiga: dessaturada e escurecida */
  var PA = {};
  Object.keys(P).forEach(function (kk) { PA[kk] = Array.isArray(P[kk]) ? P[kk].map(function (c) { return mix(c, '#30363f', 0.42); }) : mix(P[kk], '#30363f', 0.42); });

  var CORES = null;
  function cores() {
    if (CORES) return CORES;
    var cs = getComputedStyle(document.documentElement), g = function (n) { return cs.getPropertyValue(n).trim(); };
    CORES = { meu: g('--cor-meu'), 'rival-1': g('--cor-rival-1'), 'rival-2': g('--cor-rival-2'), desconhecido: '#a39d90', perigo: g('--cor-perigo'),
      selecao: g('--selecao'), alerta: g('--cor-alerta'), sucesso: g('--cor-sucesso'), fundo: g('--ent-fundo'), texto: g('--ent-texto') };
    return CORES;
  }
  function corReino(reino) { return cores()[(D.reinos[reino] || {}).cor || 'desconhecido'] || '#888'; }
  function corNivel(n) { return { baixo: '#e8b947', medio: '#ec8a3a', alto: '#ea4f43' }[n]; }

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

  /* ================================================================ primitivas (espaço do objeto: origem no chão, y para baixo) */
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
  /* casa com telhado de duas águas */
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
  function mound(c, x, y, w, h, pal) {
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
  var COR_REL = { ataque: '#f47b60', producao: '#e8c04a', resistencia: '#57c2c9' };
  function pedestalReliquia(c, t, pal, tipo, vivo) {
    var cor = COR_REL[tipo] || '#e8c04a', pulso = vivo ? 0.5 + Math.sin(t * 2.2) * 0.5 : 0.3;
    c.scale(1.25, 1.25);
    sombra(c, 0, 0, 7, 0.3);
    caixa(c, 0, 0, 10, 7, 6, pal.pedra, pal.pedraSombra, pal.pedraTopo || pal.pedra);
    caixa(c, 0, -6, 7, 5, 3, pal.pedraSombra, pal.pedraSombra, pal.pedra);
    if (vivo) {
      var gr = c.createLinearGradient(0, -10, 0, -58);
      gr.addColorStop(0, cor); gr.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = 0.22 + pulso * 0.25; c.fillStyle = gr;
      c.beginPath(); c.moveTo(-4, -10); c.lineTo(4, -10); c.lineTo(2, -58); c.lineTo(-2, -58); c.closePath(); c.fill();
      c.globalAlpha = 1;
      elipse(c, 0, -14, 7 + pulso * 3, 5 + pulso * 2, 'rgba(255,255,255,' + (0.05 + pulso * 0.08).toFixed(3) + ')');
    }
    var gy = -14 - (vivo ? Math.sin(t * 1.6) * 1.2 : 0);
    poli(c, [0, gy - 5, 3.4, gy, 0, gy + 4, -3.4, gy], cor);
    poli(c, [0, gy - 5, 3.4, gy, 0, gy], 'rgba(255,255,255,.45)');
    if (vivo) { brilho(c, 4, gy - 6, t, 0, '#fff'); brilho(c, -5, gy - 2, t, 2.1, '#fff'); }
  }

  /* pessoa: o = { roupa, dir, andando, fase, capacete, lanca, escudo, carga, trabalho, sentado } */
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
    else if (o.carga === 'minerio') { elipse(c, x + dir * 2, by - 15.5, 2.9, 2.2, o.corCarga || pal.minerioFerro); }
    else if (o.carga === 'picareta') { linha(c, x - dir * 2, by - 6, x + dir * 4, by - 16, pal.madeira, 1); linha(c, x + dir * 1.5, by - 17, x + dir * 6.5, by - 14.5, pal.metal, 1.3); }
  }
  function cavalo(c, x, y, t, pal, o) {
    var dir = o.dir || 1, ph = t * (o.galope ? 11 : 6) + (o.fase || 0), cor = o.cor || pal.cavalo[0];
    var mov = o.andando ? 1 : 0, pasta = o.pastando;
    sombra(c, x, y, 8.5, 0.24);
    var pernas = [[-5, 0], [-3.5, 1.6], [3.5, 3.1], [5, 4.7]];
    pernas.forEach(function (p) { linha(c, x + p[0] * dir, y - 7, x + p[0] * dir + Math.sin(ph + p[1]) * 2.2 * mov, y, o.escuro || '#2c2018', 1.5); });
    elipse(c, x, y - 9, 7.8, 3.8, cor);
    var hx = x + dir * (pasta ? 9 : 10), hy = y - (pasta ? 6 : 16);
    poli(c, [x + dir * 4.5, y - 11.5, x + dir * 7, y - 8.5, hx + dir * 1.5, hy + 1.8, hx - dir * 1.2, hy - 1.6], cor);
    elipse(c, hx + dir * 1.2, hy + 0.6, 2.9, 1.6, cor);
    linha(c, x + dir * 4.2, y - 12, hx - dir * 1, hy - 1.8, o.escuro || '#2c2018', 1.3);
    linha(c, x - dir * 7.5, y - 10, x - dir * (10 + Math.sin(t * 3) * 0.6), y - 5, o.escuro || '#2c2018', 1.6);
    if (o.cavaleiro) pessoa(c, x - dir * 0.5, y - 9.5, t, pal, { roupa: o.cavaleiro, dir: dir, sentado: true, capacete: o.capacete });
  }
  function animal(c, tipo, x, y, t, pal, dir, mov, fase) {
    var ph = t * 9 + fase, a = mov ? 1 : 0;
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
      for (var i = -3; i <= 2; i++) elipse(c, x + dir * i * 2.2, y - 2.6, 0.7, 0.5, pal.crocEsc);
      elipse(c, x + dir * 4.5, y - 3, 0.8, 0.8, '#e2d36a');
    }
  }

  /* ================================================================ construções */
  function desenharLocal(c, x, t, pal, cor, anim) {
    var tipo = x.tipo;
    if (tipo === 'castelo') {
      elipse(c, 0, 4, 36, 36 * K * 0.85, pal.terra);
      caixa(c, 0, gz(-20), 50, 4, 15, pal.pedra, pal.pedraSombra, pal.pedraTopo); ameias(c, 0, gz(-20), 50, 4, 15, pal.pedraLuz);
      torre(c, -25, gz(-20), 6.5, 24, pal); torre(c, 25, gz(-20), 6.5, 24, pal);
      caixa(c, -25, gz(14), 4, 34, 14, pal.pedra, pal.pedraSombra, pal.pedraTopo);
      caixa(c, 25, gz(14), 4, 34, 14, pal.pedra, pal.pedraSombra, pal.pedraTopo);
      caixa(c, 0, gz(2), 20, 14, 31, pal.pedraLuz, pal.pedraSombra, pal.pedraTopo); ameias(c, 0, gz(2), 20, 14, 31, pal.pedra);
      c.fillStyle = cor; c.fillRect(-7, gz(2) - 27, 4, 10); c.fillRect(3, gz(2) - 27, 4, 10);
      c.fillStyle = pal.porta; c.fillRect(-1.2, gz(2) - 22, 2.4, 4);
      caixa(c, 0, gz(14), 50, 4, 13, pal.pedra, pal.pedraSombra, pal.pedraTopo); ameias(c, 0, gz(14), 50, 4, 13, pal.pedraLuz);
      c.fillStyle = pal.porta; c.beginPath(); c.moveTo(-5, gz(14)); c.lineTo(-5, gz(14) - 7); c.arc(0, gz(14) - 7, 5, Math.PI, 0); c.lineTo(5, gz(14)); c.fill();
      c.strokeStyle = pal.metalEsc; c.lineWidth = 0.6; for (var i = -3; i <= 3; i += 2) { c.beginPath(); c.moveTo(i, gz(14)); c.lineTo(i, gz(14) - 10); c.stroke(); }
      torre(c, -25, gz(14), 7, 22, pal); torre(c, 25, gz(14), 7, 22, pal);
      bandeira(c, 3, gz(2) - 34, 15, cor, anim ? t : 0, 11, 6);
      bandeira(c, -25, gz(14) - 25, 8, cor, anim ? t + 1 : 0, 7, 4);
      bandeira(c, 25, gz(14) - 25, 8, cor, anim ? t + 2 : 0, 7, 4);
      return;
    }
    if (tipo === 'vila') {
      elipse(c, 0, 0, 30, 30 * K * 0.8, pal.terra);
      poli(c, [-30, gz(4), -10, gz(4), -6, gz(18), -26, gz(18)], pal.campo);
      c.strokeStyle = pal.campo2; c.lineWidth = 0.8; for (i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-29 + i * 0.8, gz(6.5 + i * 2.6)); c.lineTo(-9.5 + i * 0.8, gz(6.5 + i * 2.6)); c.stroke(); }
      poli(c, [12, gz(-22), 30, gz(-22), 32, gz(-8), 14, gz(-8)], pal.grama2);
      var r1 = casa(c, -9, gz(-6), 14, 10, 9, 7, pal, { luz: true });
      casa(c, 10, gz(-1), 12, 9, 8, 6, pal, { telhado: pal.telhado2, telhadoS: pal.telhado2Sombra });
      casa(c, -1, gz(12), 13, 10, 9, 7, pal, { luz: true });
      elipse(c, 15, gz(12), 3.2, 2, pal.pedraSombra); elipse(c, 15, gz(12) - 2.5, 3.2, 2, pal.pedra); elipse(c, 15, gz(12) - 2.5, 2, 1.2, '#2a4a5c');
      if (x.id === 'vila-moinho') {
        caixa(c, -24, gz(-16), 7, 6, 20, pal.parede, pal.paredeSombra);
        poli(c, [-28, gz(-16) - 20, -20, gz(-16) - 20, -24, gz(-16) - 27], pal.telhado2);
        c.save(); c.translate(-24, gz(-16) - 22); c.rotate(anim ? t * 0.9 : 0.3);
        for (i = 0; i < 4; i++) { c.rotate(Math.PI / 2); poli(c, [0, -1, 15, -1, 15, -4.5, 3, -3.5], pal.lona); linha(c, 0, 0, 15, 0, pal.madeiraEsc, 0.9); }
        c.restore(); elipse(c, -24, gz(-16) - 22, 1.3, 1.3, pal.madeiraEsc);
      }
      if (anim) fumaca(c, r1.chamine.x, r1.chamine.y, t, false, 0.8);
      return;
    }
    if (tipo === 'mina') {
      var minerio = x.prod && x.prod.r === 'pedra' ? pal.minerioPedra : pal.minerioFerro;
      mound(c, 0, gz(-2), 50, 22, pal);
      c.fillStyle = '#17120d'; c.beginPath(); c.moveTo(-6, gz(4)); c.lineTo(-6, gz(4) - 8); c.arc(0, gz(4) - 8, 6, Math.PI, 0); c.lineTo(6, gz(4)); c.fill();
      linha(c, -7, gz(4), -7, gz(4) - 12, pal.madeira, 2); linha(c, 7, gz(4), 7, gz(4) - 12, pal.madeira, 2); linha(c, -8.5, gz(4) - 12, 8.5, gz(4) - 12, pal.madeiraEsc, 2.2);
      linha(c, -2.5, gz(4), -3.5, gz(22), pal.metalEsc, 0.9); linha(c, 2.5, gz(4), 3.5, gz(22), pal.metalEsc, 0.9);
      caixa(c, 4, gz(16), 8, 5, 4, pal.madeira, pal.madeiraEsc, null); elipse(c, 4.8, gz(16) - 4.5, 4, 2, minerio);
      poli(c, [-22, gz(14), -12, gz(14), -17, gz(14) - 7], minerio); poli(c, [-17, gz(14) - 7, -12, gz(14), -16, gz(14)], 'rgba(0,0,0,.2)');
      return;
    }
    if (tipo === 'serraria') {
      elipse(c, 0, 0, 28, 28 * K * 0.8, pal.terraEsc);
      for (i = 0; i < 3; i++) { c.fillStyle = pal.madeiraLuz; c.fillRect(-26, gz(10) - 3 - i * 3.2, 14, 3); elipse(c, -12, gz(10) - 1.5 - i * 3.2, 1.6, 1.6, '#c9a676'); }
      c.fillStyle = pal.madeiraLuz; c.fillRect(-24, gz(10) - 12.6, 10, 3); elipse(c, -14, gz(10) - 11.1, 1.6, 1.6, '#c9a676');
      [[-2, -8], [16, -8], [-2, 6], [16, 6]].forEach(function (p) { linha(c, p[0], gz(p[1]), p[0], gz(p[1]) - 13, pal.madeiraEsc, 1.6); });
      caixa(c, 7, gz(6) - 13, 22, 16, 1.5, pal.telhado2, pal.telhado2Sombra, pal.telhado2);
      caixa(c, 7, gz(0), 16, 4, 3, pal.madeira, pal.madeiraEsc, pal.madeiraLuz);
      c.fillStyle = pal.madeiraLuz; c.fillRect(0, gz(0) - 5, 14, 2.2);
      c.save(); c.translate(7, gz(0) - 6); c.rotate(anim ? t * 6 : 0); c.strokeStyle = pal.metal; c.lineWidth = 0.9; c.beginPath(); c.arc(0, 0, 3.5, 0, 6.2832); c.stroke(); linha(c, -3.5, 0, 3.5, 0, pal.metal, 0.7); c.restore();
      elipse(c, 20, gz(14), 3, 1.8, '#a07c50'); elipse(c, 25, gz(4), 2.6, 1.6, '#a07c50');
      return;
    }
    if (tipo === 'pasto') {
      elipse(c, 0, 0, 32, 32 * K * 0.85, pal.grama2);
      return;
    }
    if (tipo === 'armazem') {
      elipse(c, 0, 0, 30, 30 * K * 0.8, pal.terra);
      casa(c, 0, gz(4), 30, 18, 13, 11, pal, { telhado: pal.telhado2, telhadoS: pal.telhado2Sombra, porta: false, janela: false });
      c.fillStyle = pal.madeiraEsc; c.fillRect(-5, gz(4) - 10, 10, 10); linha(c, -5, gz(4) - 10, 5, gz(4), pal.madeira, 1); linha(c, 5, gz(4) - 10, -5, gz(4), pal.madeira, 1);
      caixa(c, -20, gz(14), 6, 5, 5, pal.madeiraLuz, pal.madeira, '#b8935f'); caixa(c, -13, gz(16), 5, 5, 4, pal.madeiraLuz, pal.madeira, '#b8935f');
      elipse(c, 17, gz(14) - 2, 3, 2.6, '#cdb98f'); elipse(c, 21, gz(15) - 2, 2.8, 2.4, '#bfa97d');
      return;
    }
    if (tipo === 'ferraria') {
      elipse(c, 0, 0, 26, 26 * K * 0.8, pal.terraEsc);
      var rf = casa(c, -4, gz(2), 18, 12, 10, 7, pal, { parede: pal.pedra, paredeS: pal.pedraSombra, luz: true });
      caixa(c, 4, gz(-4) - 8, 4, 4, 14, pal.pedraSombra, '#5d574f', pal.pedra);
      var g = anim ? 0.55 + Math.sin(t * 7) * 0.2 : 0.4;
      elipse(c, -4, gz(2) - 3, 3.5, 2.4, 'rgba(255,150,60,' + g.toFixed(2) + ')');
      caixa(c, 11, gz(12), 6, 3, 2.5, pal.metalEsc, '#3e4349', pal.metal); c.fillStyle = pal.metalEsc; c.fillRect(10, gz(12) - 6, 2.5, 3.5);
      if (anim) {
        fumaca(c, 6, gz(-4) - 23, t, true, 1);
        if (Math.sin(t * 6) > 0.85) for (i = 0; i < 4; i++) elipse(c, 13 + Math.sin(i * 2.3 + t * 20) * 4, gz(12) - 6 - Math.abs(Math.cos(i + t * 15)) * 4, 0.5, 0.5, '#ffd27a');
      }
      return;
    }
    if (tipo === 'quartel') {
      elipse(c, 0, 0, 30, 30 * K * 0.8, pal.terra);
      [[-14, -8], [8, -10], [-4, 8]].forEach(function (p, j) {
        var tx = p[0], ty = gz(p[1]);
        sombra(c, tx + 3, ty, 9, 0.2);
        poli(c, [tx - 9, ty, tx + 9, ty, tx, ty - 15], j === 1 ? cor : pal.lona);
        poli(c, [tx, ty - 15, tx + 9, ty, tx + 12, ty - 3.5, tx + 3, ty - 17], pal.lonaSombra);
        poli(c, [tx - 2, ty, tx + 2, ty, tx, ty - 6], pal.porta);
      });
      linha(c, 19, gz(10), 19, gz(10) - 10, pal.madeira, 1.4); linha(c, 15, gz(10) - 7, 23, gz(10) - 7, pal.madeira, 1.4); elipse(c, 19, gz(10) - 11.5, 2.4, 2.4, '#cdb98f');
      bandeira(c, 22, gz(-4), 20, cor, anim ? t : 0, 9, 5);
      return;
    }
  }
  function desenharRuina(c, r, t, pal) {
    if (r.tipo === 'livre') {
      elipse(c, 0, 0, 22, 22 * K * 0.8, pal.terra);
      [[-14, -6], [14, -6], [14, 8], [-14, 8]].forEach(function (p) { linha(c, p[0], gz(p[1]), p[0], gz(p[1]) - 7, pal.madeiraEsc, 1.6); });
      c.strokeStyle = '#cdb98f'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(-14, gz(-6) - 6); c.lineTo(14, gz(-6) - 6); c.lineTo(14, gz(8) - 6); c.lineTo(-14, gz(8) - 6); c.closePath(); c.stroke();
      return;
    }
    elipse(c, 0, 0, 30, 30 * K * 0.8, pal.terraEsc);
    var esc = { cor: pal.rochaSombra, luz: pal.rocha, sombra: '#4a4744' };
    if (r.tipo === 'castelo') {
      poli(c, [-24, gz(-16), -24, gz(-16) - 12, -18, gz(-16) - 9, -14, gz(-16) - 13, -8, gz(-16) - 6, -8, gz(-16)], pal.rocha);
      poli(c, [6, gz(-16), 6, gz(-16) - 8, 12, gz(-16) - 11, 20, gz(-16) - 7, 24, gz(-16) - 10, 24, gz(-16)], pal.rocha);
      torre(c, -24, gz(12), 6.5, 11, pal, esc);
      poli(c, [-16, gz(12), -16, gz(12) - 7, -8, gz(12) - 4, -4, gz(12)], pal.rochaSombra);
      torre(c, 22, gz(10), 6, 7, pal, esc);
    } else {
      [[-10, -4], [9, 0], [-1, 12]].forEach(function (p) {
        var x = p[0], y = gz(p[1]);
        poli(c, [x - 6, y, x - 6, y - 7, x - 2, y - 9, x + 1, y - 5, x + 6, y - 6, x + 6, y], pal.rochaSombra);
        c.fillStyle = '#211b15'; c.fillRect(x - 1.5, y - 5, 3, 5);
      });
    }
    rocha(c, 4, gz(4), 0.8, pal); rocha(c, -6, gz(18), 0.6, pal); rocha(c, 16, gz(16), 0.7, pal);
  }
  function desenharJazida(c, j, t, pal, anim) {
    var i;
    if (j.tipo === 'sal') {
      elipse(c, 0, 0, 22, 22 * K * 0.8, pal.sal);
      [[-8, -2], [5, -6], [9, 6]].forEach(function (p) { poli(c, [p[0] - 4, gz(p[1]), p[0] + 4, gz(p[1]), p[0], gz(p[1]) - 6], '#ffffff'); poli(c, [p[0], gz(p[1]) - 6, p[0] + 4, gz(p[1]), p[0] + 1, gz(p[1])], '#d7d2c7'); });
      return;
    }
    if (j.tipo === 'ervas') {
      [[-10, -4, pal.erva1], [6, -8, pal.erva2], [10, 6, pal.erva1], [-4, 8, pal.erva2], [-14, 6, pal.erva2]].forEach(function (p) { arbusto(c, p[0], gz(p[1]), 1.2, pal, p[2]); });
      return;
    }
    if (j.tipo === 'cavalo') return; /* manada desenhada como animais */
    if (j.tipo === 'ruina') {
      elipse(c, 0, 0, 26, 26 * K * 0.8, pal.terraEsc);
      var g = anim ? 0.25 + Math.sin(t * 1.6) * 0.12 : 0.15;
      elipse(c, 0, -6, 24, 14, 'rgba(201,140,240,' + g.toFixed(2) + ')');
      [[-10, -2, 22], [8, -6, 16], [-2, 10, 9]].forEach(function (p) { var x = p[0], y = gz(p[1]); c.fillStyle = pal.pedraLuz; c.fillRect(x - 2.5, y - p[2], 5, p[2]); c.fillStyle = pal.pedraSombra; c.fillRect(x + 0.8, y - p[2], 1.7, p[2]); c.fillStyle = pal.pedraTopo; c.fillRect(x - 3.5, y - p[2] - 2, 7, 2); });
      c.save(); c.translate(12, gz(10)); c.rotate(-0.25); c.fillStyle = pal.pedra; c.fillRect(-9, -3, 18, 4); c.restore();
      if (anim) for (i = 0; i < 4; i++) { var a = (t * 0.25 + i / 4) % 1; elipse(c, Math.sin(i * 2 + t) * 10, -6 - a * 26, 1, 1, 'rgba(222,180,255,' + (1 - a).toFixed(2) + ')'); }
      return;
    }
    var veio = j.tipo === 'ouro' ? pal.ouro : j.tipo === 'prata' ? pal.prata : pal.gema;
    rocha(c, -8, gz(2), 1.6, pal); rocha(c, 7, gz(-3), 1.3, pal); rocha(c, 2, gz(8), 1.1, pal);
    if (j.tipo === 'gema') {
      [[-3, 2, 9], [3, 3, 12], [8, 6, 7]].forEach(function (p) { poli(c, [p[0] - 2, gz(p[1]), p[0], gz(p[1]) - p[2], p[0] + 2, gz(p[1])], veio); poli(c, [p[0], gz(p[1]) - p[2], p[0] + 2, gz(p[1]), p[0] + 0.5, gz(p[1])], '#3a9fb0'); });
    } else {
      linha(c, -12, gz(2) - 3, -6, gz(2) - 6, veio, 1.2); linha(c, 5, gz(-3) - 3, 9, gz(-3) - 5, veio, 1.2); linha(c, 0, gz(8) - 2, 3, gz(8) - 4, veio, 1);
    }
    if (anim) { brilho(c, -9, gz(2) - 6, t, 0, '#fff7d0'); brilho(c, 8, gz(-3) - 5, t, 2.1, '#fff7d0'); brilho(c, 2, gz(8) - 4, t, 4.2, '#fff7d0'); }
  }
  function desenharBandeira(c, b, t, pal, anim) {
    sombra(c, 0, 0, 4, 0.2);
    bandeira(c, 0, 0, 26, corReino(b.reino), anim ? t : 0, 13, 8);
    elipse(c, 0, -27, 1.4, 1.4, '#d9b25c');
  }
  function placaPerigo(c, f, pal) {
    linha(c, 0, 0, 0, -12, pal.madeiraEsc, 1.6);
    poli(c, [-6, -12, 6, -12, 0, -22], corNivel(f.nivel), '#2b2520', 0.8);
    c.fillStyle = '#2b2520'; c.fillRect(-0.5, -19.5, 1, 4); c.fillRect(-0.5, -14.6, 1, 1);
  }

  /* ================================================================ Cena */
  function Cena(cv, opt) {
    this.cv = cv; this.ctx = cv.getContext('2d'); this.opt = opt || {};
    this.cam = { x: 0, y: 0, s: 1.7 };
    this.w = 0; this.h = 0; this.dpr = 1;
    this.cache = document.createElement('canvas'); this.cctx = this.cache.getContext('2d'); this.ci = null;
    this.rodando = false; this.raf = 0; this.alvos = []; this.gesto = false; this.ultimaMudanca = 0; this.anim = 0;
    this.trilhos = this.prepararVida();
    this.brilhosRio = this.prepararRios();
    var self = this;
    if (this.opt.interativa) this.ligarGestos();
    else if (this.opt.tocavel) this.ligarToqueSimples();
    document.addEventListener('visibilitychange', function () { if (document.hidden) self.pausar(); else if (self.rodando) self.continuar(); });
  }
  var C = Cena.prototype;

  C.redimensionar = function () {
    var w = this.cv.clientWidth, h = this.cv.clientHeight;
    if (!w || !h) return;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w !== this.w || h !== this.h) { this.w = w; this.h = h; this.cv.width = Math.round(w * this.dpr); this.cv.height = Math.round(h * this.dpr); this.ci = null; }
  };
  C.tela = function (x, y) { return { x: (x - this.cam.x) * this.cam.s + this.w / 2, y: (y - this.cam.y) * K * this.cam.s + this.h / 2 }; };
  C.mundo = function (sx, sy) { return { x: (sx - this.w / 2) / this.cam.s + this.cam.x, y: (sy - this.h / 2) / (K * this.cam.s) + this.cam.y }; };
  C.centro = function () { return { x: this.cam.x, y: this.cam.y }; };
  C.retanguloMundo = function () {
    var s = this.cam.s; return { x: this.cam.x - this.w / (2 * s), y: this.cam.y - this.h / (2 * K * s), w: this.w / s, h: this.h / (K * s) };
  };
  C.limitar = function () {
    var lim = this.opt.limites;
    if (lim) { this.cam.x = Math.max(lim.x0, Math.min(lim.x1, this.cam.x)); this.cam.y = Math.max(lim.y0, Math.min(lim.y1, this.cam.y)); }
    else { this.cam.x = Math.max(0, Math.min(H.LARGURA, this.cam.x)); this.cam.y = Math.max(0, Math.min(H.ALTURA, this.cam.y)); }
    if (!isFinite(this.cam.x) || !isFinite(this.cam.y) || !isFinite(this.cam.s)) this.cam = { x: H.LARGURA / 2, y: H.ALTURA / 2, s: 1.7 };
  };
  C.mudou = function () { this.limitar(); this.ultimaMudanca = performance.now(); if (this.opt.aoMover) this.opt.aoMover(); if (!this.rodando) this.quadro(performance.now(), true); };
  C.centrar = function (wx, wy, s, fy, animar) {
    this.redimensionar();
    s = Math.max(SMIN, Math.min(SMAX, s || this.cam.s));
    fy = fy === undefined || fy === null ? 0.5 : fy;
    var alvo = { s: s, x: wx, y: wy - (this.h * fy - this.h / 2) / (K * s) };
    if (animar === false || !this.rodando) { this.cam = alvo; this.mudou(); return; }
    this.animarPara(alvo, 380);
  };
  C.animarPara = function (alvo, dur) {
    var self = this, ini = { x: this.cam.x, y: this.cam.y, s: this.cam.s }, t0 = performance.now();
    cancelAnimationFrame(this.anim);
    (function passo(t) {
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      self.cam = { x: ini.x + (alvo.x - ini.x) * e, y: ini.y + (alvo.y - ini.y) * e, s: ini.s + (alvo.s - ini.s) * e };
      self.mudou();
      if (p < 1) self.anim = requestAnimationFrame(passo);
    })(t0);
  };
  C.zoomBotao = function (f) {
    var ns = this.cam.s * f;
    if (ns < SMIN * 0.95 && this.opt.aoAfastarDemais) { this.opt.aoAfastarDemais(); return; }
    this.animarPara({ x: this.cam.x, y: this.cam.y, s: Math.max(SMIN, Math.min(SMAX, ns)) }, 240);
  };
  C.ligarGestos = function () {
    var self = this, p0 = null, avisado = false;
    RP.gestos(this.cv, {
      inicio: function () { cancelAnimationFrame(self.anim); self.gesto = true; avisado = false; },
      inicioPinca: function () { p0 = { x: self.cam.x, y: self.cam.y, s: self.cam.s }; },
      arrasto: function (dx, dy) { self.cam.x -= dx / self.cam.s; self.cam.y -= dy / (K * self.cam.s); self.mudou(); },
      pinca: function (f, mx, my, mx0, my0) {
        var wx = (mx0 - self.w / 2) / p0.s + p0.x, wy = (my0 - self.h / 2) / (K * p0.s) + p0.y, ns = p0.s * f;
        if (ns < SMIN * 0.8 && self.opt.aoAfastarDemais) { if (!avisado) { avisado = true; self.opt.aoAfastarDemais(); } return; }
        ns = Math.max(SMIN, Math.min(SMAX, ns));
        self.cam = { s: ns, x: wx - (mx - self.w / 2) / ns, y: wy - (my - self.h / 2) / (K * ns) };
        self.mudou();
      },
      roda: function (f, x, y) {
        var ns = self.cam.s * f;
        if (ns < SMIN * 0.9 && self.opt.aoAfastarDemais) { self.opt.aoAfastarDemais(); return; }
        ns = Math.max(SMIN, Math.min(SMAX, ns));
        var w = self.mundo(x, y);
        self.cam = { s: ns, x: w.x - (x - self.w / 2) / ns, y: w.y - (y - self.h / 2) / (K * ns) };
        self.mudou();
      },
      toque: function (x, y) { self.tocar(x, y); },
      fim: function () { self.gesto = false; self.ultimaMudanca = performance.now(); }
    });
  };
  C.ligarToqueSimples = function () {
    var self = this;
    RP.gestos(this.cv, {
      arrasto: function (dx) { if (self.opt.panHorizontal) { self.cam.x -= dx / self.cam.s; self.mudou(); } },
      pinca: function () {},
      toque: function (x, y) { self.tocar(x, y); },
      fim: function () { self.ultimaMudanca = performance.now(); }
    });
  };
  C.tocar = function (x, y) {
    for (var i = this.alvos.length - 1; i >= 0; i--) {
      var a = this.alvos[i];
      if (x >= a.x0 && x <= a.x1 && y >= a.y0 && y <= a.y1) { if (this.opt.aoTocar) this.opt.aoTocar({ ent: a.ent }); return; }
    }
    var w = this.mundo(x, y), h = H.pixelParaHex(w.x, w.y);
    if (this.opt.aoTocar) this.opt.aoTocar({ hex: [h.c, h.l] });
  };

  C.iniciar = function () { if (this.rodando) return; this.rodando = true; this.redimensionar(); this.continuar(); };
  C.continuar = function () {
    var self = this;
    cancelAnimationFrame(this.raf);
    var ultimo = 0;
    (function loop(t) {
      if (!self.rodando || document.hidden) return;
      self.raf = requestAnimationFrame(loop);
      if (!self.gesto && t - ultimo < 32) return; /* ~30 qps parado; quadro cheio durante gestos */
      ultimo = t;
      self.quadro(t);
    })(performance.now());
  };
  C.pausar = function () { cancelAnimationFrame(this.raf); };
  C.parar = function () { this.rodando = false; cancelAnimationFrame(this.raf); };

  /* ---------------------------------------------------------------- vida: trajetos de trabalho e passeios */
  C.prepararVida = function () {
    var meus = D.locais.filter(function (x) { return x.reino === 'meu'; });
    var pos = {}; meus.forEach(function (x) { pos[x.id] = H.centro(x.c, x.l); });
    var arm = pos.armazem, cas = pos.castelo, tr = [];
    function ida(a, b, o) { tr.push(Object.assign({ a: a, b: b, vel: 11 }, o)); }
    function off(p, dx, dz) { return { x: p.x + dx, y: p.y + dz }; }
    meus.forEach(function (x, i) {
      var p = pos[x.id];
      if (x.tipo === 'vila') {
        ida(off(p, -18, 12), off(p, 24, -10), { roupa: P.roupa[i % 5], fase: 0.3 });
        tr.push({ fixo: off(p, -18, 12), roupa: P.roupa[(i + 2) % 5], trabalho: 'picareta', dir: 1, fase: 2.1 });
        ida(p, cas, { roupa: P.roupa[(i + 1) % 5], fase: 1.2, carga: 'saco' });
      } else if (x.tipo === 'mina') {
        tr.push({ fixo: off(p, -9, 9), roupa: P.roupa[3], trabalho: 'picareta', dir: 1, fase: i });
        ida(off(p, 0, 16), arm, { roupa: P.roupa[0], carga: 'minerio', corCarga: x.prod.r === 'pedra' ? P.minerioPedra : P.minerioFerro, fase: i * 0.7 });
      } else if (x.tipo === 'serraria') {
        tr.push({ fixo: off(p, -4, 10), roupa: P.roupa[2], trabalho: 'picareta', dir: 1, fase: 1 });
        ida(off(p, -16, 14), arm, { roupa: P.roupa[1], carga: 'tronco', fase: 0.4 });
      } else if (x.tipo === 'ferraria') {
        tr.push({ fixo: off(p, 7, 12), roupa: '#5a4636', trabalho: 'martelo', dir: 1, fase: 0 });
      } else if (x.tipo === 'quartel') {
        [-10, -2, 6].forEach(function (dx, j) { tr.push({ fixo: off(p, dx, 22), soldado: true, dono: 'meu', estocada: true, dir: 1, fase: j * 0.6 }); });
        [0, 1].forEach(function (j) { tr.push({ fixo: off(p, -26 + j * 7, -2 + j * 6), arqueiro: true, alvoTiro: off(p, 26, -14), dir: 1, fase: j * 1.7, soRecrutando: true }); });
        tr.push({ alvoPalha: off(p, 26, -14), soRecrutando: true });
      } else if (x.tipo === 'castelo') {
        ida(off(p, -16, 26), off(p, 16, 26), { soldado: true, dono: 'meu', vel: 5, fase: 0 });
        ida(off(p, 18, 30), off(p, -14, 30), { soldado: true, dono: 'meu', vel: 5, fase: 1.4 });
      } else if (x.tipo === 'pasto') {
        for (var k2 = 0; k2 < 4; k2++) tr.push({ cavaloPasto: true, centro: p, fase: k2 * 1.7, cor: P.cavalo[k2 % 4] });
      } else if (x.tipo === 'armazem') {
        tr.push({ fixo: off(p, 12, 16), roupa: P.roupa[4], trabalho: 'picareta', dir: -1, fase: 2.5, carga: null });
      }
    });
    return tr.map(function (o) { o.local = o.local || null; return o; });
  };
  C.prepararRios = function () {
    var out = [];
    W.rios.forEach(function (r) {
      var run = [];
      r.concat([null]).forEach(function (h) {
        if (h && W.estado(h[0], h[1]).v !== 'desconhecido') run.push(h);
        else { if (run.length > 1) out.push(new Path2D(H.curva(run))); run = []; }
      });
    });
    return out;
  };

  /* ---------------------------------------------------------------- cache estático */
  C.precisaCache = function () {
    var r = this.ci;
    if (!r) return true;
    var v = this.retanguloMundo();
    if (v.x < r.x || v.y < r.y || v.x + v.w > r.x + r.w || v.y + v.h > r.y + r.h) return true;
    var rel = this.cam.s / r.s;
    if (!this.gesto && (rel > 1.12 || rel < 0.9) && performance.now() - this.ultimaMudanca > 160) return true;
    return false;
  };
  C.construirCache = function () {
    var s = this.cam.s, M = 0.45;
    var cw = this.w * (1 + 2 * M), ch = this.h * (1 + 2 * M);
    var dprC = Math.min(this.dpr, Math.sqrt(9e6 / (cw * ch)));
    this.cache.width = Math.round(cw * dprC); this.cache.height = Math.round(ch * dprC);
    var rw = cw / s, rh = ch / (K * s);
    var r = { x: this.cam.x - rw / 2, y: this.cam.y - rh / 2, w: rw, h: rh, s: s, cw: cw, ch: ch };
    this.ci = r;
    var S = s * dprC;
    desenharEstatico(this.cctx, { S: S, ox: -r.x * S, oy: -r.y * S * K, pw: this.cache.width, ph: this.cache.height }, r);
  };

  function chao(c, V) { c.setTransform(V.S, 0, 0, V.S * K, V.ox, V.oy); }
  function obj(c, V, x, y) { c.setTransform(V.S, 0, 0, V.S, V.ox + x * V.S, V.oy + y * V.S * K); }

  function hexesNoRetangulo(r, margem) {
    var c0 = Math.max(0, Math.floor(r.x / H.W) - margem), c1 = Math.min(H.COLS - 1, Math.ceil((r.x + r.w) / H.W) + margem);
    var l0 = Math.max(0, Math.floor(r.y / H.VS) - margem), l1 = Math.min(H.LINS - 1, Math.ceil((r.y + r.h) / H.VS) + margem + 2);
    var out = [];
    for (var l = l0; l <= l1; l++) for (var c = c0; c <= c1; c++) out.push([c, l]);
    return out;
  }
  function ocupado(c, l) { var it = W.porHex[W.chave(c, l)]; return it && it.some(function (i) { return i.tipo === 'local' || i.tipo === 'jazida' || i.tipo === 'ruina'; }); }
  function corChao(t, c, l, pal) { var arr = pal[t] || pal.planicie; return arr[Math.floor(H.hash(c, l, 3) * arr.length)]; }

  function desenharEstatico(c, V, r) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = P.nevoa; c.fillRect(0, 0, V.pw, V.ph);
    var hexes = hexesNoRetangulo(r, 2), conhecidos = [], itens = [];
    hexes.forEach(function (h) { var e = W.estado(h[0], h[1]); if (e.v !== 'desconhecido') conhecidos.push({ c: h[0], l: h[1], e: e, pal: e.v === 'explorado' ? PA : P, t: W.T[h[1]][h[0]], ce: H.centro(h[0], h[1]) }); });
    /* chão */
    chao(c, V);
    conhecidos.forEach(function (h) {
      c.fillStyle = corChao(h.t, h.c, h.l, h.pal);
      c.beginPath();
      for (var i = 0; i < 6; i++) { var a = (Math.PI / 180) * (60 * i - 30); c.lineTo(h.ce.x + (H.R + 2) * Math.cos(a), h.ce.y + (H.R + 2) * Math.sin(a)); }
      c.fill();
    });
    var ORDEM = { planicie: 0, rio: 1, pantano: 2, colina: 3, floresta: 4, montanha: 5 };
    conhecidos.slice().sort(function (a, b) { return ORDEM[a.t] - ORDEM[b.t]; }).forEach(function (h) {
      c.fillStyle = corChao(h.t, h.c, h.l, h.pal);
      for (var i = 0; i < 4; i++) {
        var a = H.hash(h.c, h.l, 40 + i) * 6.28, d = H.R * (0.55 + H.hash(h.c, h.l, 50 + i) * 0.35);
        c.beginPath(); c.arc(h.ce.x + Math.cos(a) * d, h.ce.y + Math.sin(a) * d, H.R * (0.38 + H.hash(h.c, h.l, 60 + i) * 0.2), 0, 6.2832); c.fill();
      }
    });
    /* detalhes do chão */
    conhecidos.forEach(function (h) {
      var pal = h.pal, i, x, y;
      if (h.t === 'planicie') {
        for (i = 0; i < 7; i++) {
          x = h.ce.x + (H.hash(h.c, h.l, 70 + i) - 0.5) * H.W * 0.9; y = h.ce.y + (H.hash(h.c, h.l, 80 + i) - 0.5) * H.R * 1.4;
          c.fillStyle = i % 3 ? pal.grama : pal.grama2; c.fillRect(x, y, 2.2, 2.2);
        }
        if (H.hash(h.c, h.l, 90) > 0.6) for (i = 0; i < 4; i++) { c.fillStyle = [pal.flor1, pal.flor2, pal.flor3][i % 3]; c.fillRect(h.ce.x + (H.hash(h.c, h.l, 91 + i) - 0.5) * 30, h.ce.y + (H.hash(h.c, h.l, 95 + i) - 0.5) * 24, 1.6, 1.6); }
      } else if (h.t === 'pantano') {
        for (i = 0; i < 3; i++) {
          x = h.ce.x + (H.hash(h.c, h.l, 100 + i) - 0.5) * 34; y = h.ce.y + (H.hash(h.c, h.l, 104 + i) - 0.5) * 28;
          c.fillStyle = pal.poca; c.beginPath(); c.ellipse(x, y, 7 + i * 2, 5 + i, 0, 0, 6.2832); c.fill();
          c.fillStyle = pal.pocaLuz; c.beginPath(); c.ellipse(x - 2, y - 1.5, 3, 1.4, 0, 0, 6.2832); c.fill();
        }
      } else if (h.t === 'floresta') {
        c.fillStyle = pal.folhaSombra; c.globalAlpha = 0.35;
        c.beginPath(); c.arc(h.ce.x, h.ce.y, H.R * 0.8, 0, 6.2832); c.fill(); c.globalAlpha = 1;
      }
    });
    /* rios e estradas */
    W.rios.forEach(function (rr) {
      var p = new Path2D(H.curva(rr));
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.strokeStyle = P.aguaMargem; c.lineWidth = 24; c.stroke(p);
      c.strokeStyle = P.agua; c.lineWidth = 16; c.stroke(p);
      c.strokeStyle = 'rgba(30,70,110,.35)'; c.lineWidth = 6; c.stroke(p);
    });
    W.rotas.forEach(function (rt) {
      var p = new Path2D(H.curva(rt.hexes));
      c.strokeStyle = P.estradaBorda; c.lineWidth = 12; c.stroke(p);
      c.strokeStyle = P.estrada; c.lineWidth = 8.5; c.stroke(p);
      c.setLineDash([2, 7]); c.strokeStyle = 'rgba(90,70,40,.35)'; c.lineWidth = 1.2; c.stroke(p); c.setLineDash([]);
    });
    /* pontes e vaus (planos, no chão) */
    W.rotas.forEach(function (rt) {
      rt.hexes.forEach(function (hx, i) {
        if (!W.rioSet[W.chave(hx[0], hx[1])] || W.estado(hx[0], hx[1]).v === 'desconhecido') return;
        var a = H.centro(rt.hexes[Math.max(0, i - 1)][0], rt.hexes[Math.max(0, i - 1)][1]), b = H.centro(rt.hexes[Math.min(rt.hexes.length - 1, i + 1)][0], rt.hexes[Math.min(rt.hexes.length - 1, i + 1)][1]);
        var ce = H.centro(hx[0], hx[1]);
        c.save(); c.translate(ce.x, ce.y); c.rotate(Math.atan2(b.y - a.y, b.x - a.x));
        c.fillStyle = P.madeiraEsc; c.fillRect(-20, -8, 40, 16); c.fillStyle = P.madeiraLuz; c.fillRect(-19, -6.5, 38, 13);
        c.strokeStyle = P.madeiraEsc; c.lineWidth = 0.8; for (var q = -16; q <= 16; q += 4) { c.beginPath(); c.moveTo(q, -6.5); c.lineTo(q, 6.5); c.stroke(); }
        c.restore();
      });
    });
    D.vaus.forEach(function (v) {
      if (W.estado(v.c, v.l).v === 'desconhecido') return;
      var ce = H.centro(v.c, v.l);
      [[-12, 4], [-4, -2], [4, 3], [12, -3]].forEach(function (p) { c.fillStyle = '#8f897f'; c.beginPath(); c.ellipse(ce.x + p[0], ce.y + p[1], 4.5, 3.4, 0, 0, 6.2832); c.fill(); c.fillStyle = '#b8b2a8'; c.beginPath(); c.ellipse(ce.x + p[0] - 1, ce.y + p[1] - 1, 2.5, 1.6, 0, 0, 6.2832); c.fill(); });
    });

    /* vegetação e relevo (objetos em pé, ordenados por profundidade) */
    conhecidos.forEach(function (h) {
      var pal = h.pal, i, x, y, cheio = ocupado(h.c, h.l), n;
      function livre(xx, yy) { return !cheio || Math.hypot(xx - h.ce.x, (yy - h.ce.y)) > 24; }
      if (h.t === 'floresta') {
        n = 6;
        for (i = 0; i < n; i++) {
          x = h.ce.x + (H.hash(h.c, h.l, 110 + i) - 0.5) * H.W * 0.95; y = h.ce.y + (H.hash(h.c, h.l, 120 + i) - 0.5) * H.R * 1.5;
          if (!livre(x, y) || W.rotaSet[W.chave(h.c, h.l)] && Math.abs(H.hash(h.c, h.l, 130 + i) - 0.5) < 0.2) continue;
          itens.push({ y: y, x: x, f: H.hash(h.c, h.l, 140 + i) > 0.4 ? 'con' : 'fol', s: 0.85 + H.hash(h.c, h.l, 150 + i) * 0.45, alt: i & 1, pal: pal });
        }
      } else if (h.t === 'planicie') {
        if (H.hash(h.c, h.l, 160) > 0.82) { x = h.ce.x + (H.hash(h.c, h.l, 161) - 0.5) * 30; y = h.ce.y + (H.hash(h.c, h.l, 162) - 0.5) * 24; if (livre(x, y)) itens.push({ y: y, x: x, f: 'fol', s: 0.9, pal: pal }); }
        if (H.hash(h.c, h.l, 163) > 0.7) { x = h.ce.x + (H.hash(h.c, h.l, 164) - 0.5) * 34; y = h.ce.y + (H.hash(h.c, h.l, 165) - 0.5) * 26; if (livre(x, y)) itens.push({ y: y, x: x, f: 'arb', s: 1, pal: pal }); }
      } else if (h.t === 'colina') {
        x = h.ce.x + (H.hash(h.c, h.l, 170) - 0.5) * 16; y = h.ce.y + (H.hash(h.c, h.l, 171) - 0.5) * 10;
        if (livre(x, y)) itens.push({ y: y, x: x, f: 'mon', s: 1, pal: pal });
        x = h.ce.x + (H.hash(h.c, h.l, 172) - 0.5) * 36; y = h.ce.y + 10 + H.hash(h.c, h.l, 173) * 8;
        if (livre(x, y)) itens.push({ y: y, x: x, f: 'roc', s: 0.9, pal: pal });
      } else if (h.t === 'montanha') {
        itens.push({ y: h.ce.y + 6, x: h.ce.x + (H.hash(h.c, h.l, 180) - 0.5) * 10, f: 'pic', s: 0.9 + H.hash(h.c, h.l, 181) * 0.35, pal: pal });
        if (H.hash(h.c, h.l, 182) > 0.45) itens.push({ y: h.ce.y - 8, x: h.ce.x + 16, f: 'pic', s: 0.55, pal: pal });
        itens.push({ y: h.ce.y + 16, x: h.ce.x - 14, f: 'roc', s: 0.8, pal: pal });
      } else if (h.t === 'pantano') {
        for (i = 0; i < 4; i++) { x = h.ce.x + (H.hash(h.c, h.l, 190 + i) - 0.5) * 40; y = h.ce.y + (H.hash(h.c, h.l, 195 + i) - 0.5) * 30; if (livre(x, y)) itens.push({ y: y, x: x, f: 'jun', s: 1, pal: pal }); }
        if (H.hash(h.c, h.l, 199) > 0.7) itens.push({ y: h.ce.y + 4, x: h.ce.x + 8, f: 'fol', s: 0.7, pal: pal });
      }
    });
    /* bancos de névoa nos hexes desconhecidos */
    hexes.forEach(function (h) {
      if (W.estado(h[0], h[1]).v !== 'desconhecido') return;
      var ce = H.centro(h[0], h[1]);
      itens.push({ y: ce.y + H.R * 0.55, x: ce.x, f: 'nev', c: h[0], l: h[1] });
    });
    itens.sort(function (a, b) { return a.y - b.y; });
    var pf = puff();
    itens.forEach(function (it) {
      if (it.f === 'nev') {
        chao(c, V); c.fillStyle = P.nevoa; c.beginPath();
        for (var i = 0; i < 6; i++) { var a = (Math.PI / 180) * (60 * i - 30); c.lineTo(it.x + (H.R + 3) * Math.cos(a), it.y - H.R * 0.55 + (H.R + 3) * Math.sin(a)); }
        c.fill();
        obj(c, V, it.x, it.y - H.R * 0.55);
        for (i = 0; i < 3; i++) {
          var px = (H.hash(it.c, it.l, 200 + i) - 0.5) * 40, py = (H.hash(it.c, it.l, 210 + i) - 0.5) * 18 - 10, ps = 64 + H.hash(it.c, it.l, 220 + i) * 30;
          c.drawImage(pf, px - ps / 2, py - ps / 2, ps, ps * 0.8);
        }
        return;
      }
      obj(c, V, it.x, it.y);
      if (it.f === 'con') arvoreConifera(c, 0, 0, it.s, it.pal, it.alt);
      else if (it.f === 'fol') arvoreFolhosa(c, 0, 0, it.s, it.pal);
      else if (it.f === 'arb') arbusto(c, 0, 0, it.s, it.pal, it.pal.flor2);
      else if (it.f === 'mon') mound(c, 0, 0, 44, 18, it.pal);
      else if (it.f === 'roc') rocha(c, 0, 0, it.s, it.pal);
      else if (it.f === 'pic') pico(c, 0, 0, 56 * it.s, 52 * it.s, it.pal);
      else if (it.f === 'jun') junco(c, 0, 0, 1, it.pal);
    });
    c.setTransform(1, 0, 0, 1, 0, 0);
  }

  /* ---------------------------------------------------------------- quadro animado */
  C.quadro = function (agora, semCache) {
    if (!this.w) this.redimensionar();
    if (!this.w) return;
    var c = this.ctx, dpr = this.dpr, s = this.cam.s, t = agora / 1000, self = this;
    if (this.precisaCache()) this.construirCache();
    var r = this.ci, esc = s / r.s;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = P.nevoa; c.fillRect(0, 0, this.cv.width, this.cv.height);
    var o = this.tela(r.x, r.y);
    c.imageSmoothingEnabled = true;
    c.drawImage(this.cache, o.x * dpr, o.y * dpr, r.cw * esc * dpr, r.ch * esc * dpr);

    var S = s * dpr, V = { S: S, ox: (this.w / 2 - this.cam.x * s) * dpr, oy: (this.h / 2 - this.cam.y * K * s) * dpr };
    var vis = this.retanguloMundo(), cam = { x0: vis.x - 80, x1: vis.x + vis.w + 80, y0: vis.y - 60, y1: vis.y + vis.h + 120 };
    function naTela(x, y) { return x > cam.x0 && x < cam.x1 && y > cam.y0 && y < cam.y1; }
    var camadas = this.opt.camadas || {};

    /* brilho do rio */
    chao(c, V);
    c.setLineDash([6, 22]); c.lineDashOffset = -t * 14; c.strokeStyle = 'rgba(215,238,255,.5)'; c.lineWidth = 2; c.lineCap = 'round';
    this.brilhosRio.forEach(function (p) { c.stroke(p); });
    c.setLineDash([]);

    /* seleção */
    var sel = this.opt.selecao && this.opt.selecao();
    if (sel) {
      var ce = H.centro(sel.c, sel.l);
      c.strokeStyle = cores().selecao; c.lineWidth = 3 / s; c.globalAlpha = 0.65 + Math.sin(t * 4) * 0.3;
      c.beginPath(); for (var i = 0; i < 6; i++) { var a = (Math.PI / 180) * (60 * i - 30); c.lineTo(ce.x + (H.R - 2) * Math.cos(a), ce.y + (H.R - 2) * Math.sin(a)); } c.closePath(); c.stroke();
      c.globalAlpha = 1;
    }

    /* coleta de objetos dinâmicos */
    var itens = [], rotulos = [];
    this.alvos = [];
    D.locais.forEach(function (x) {
      var e = W.estado(x.c, x.l); if (e.v === 'desconhecido') return;
      var p = H.centro(x.c, x.l); if (!naTela(p.x, p.y)) return;
      var antigo = e.v === 'explorado';
      var obra = x.reino === 'meu' ? obraDe(x.id) : null;
      itens.push({ y: p.y, d: function () {
        obj(c, V, p.x, p.y); desenharLocal(c, x, t, antigo ? PA : P, corReino(W.donoAparente(x)), !antigo);
        if (obra) { obj(c, V, p.x, p.y); if (obra.ativa) andaime(c, x.tipo === 'castelo' ? 30 : 20, t, P); else materiais(c, P); }
      }, alvo: { x: p.x, y: p.y, w: x.tipo === 'castelo' ? 64 : 50, h: x.tipo === 'castelo' ? 66 : 42, ent: ['local', x.id] } });
      if (obra && obra.ativa) {
        itens.push({ y: p.y + 14, d: function () { obj(c, V, p.x + 16, p.y + 14); pessoa(c, 0, 0, t, P, { roupa: P.roupa[4], dir: -1, trabalho: 'martelo', fase: 0.5 }); } });
        rotulos.push({ x: p.x, y: p.y, dy: -52, txt: 'Obra · ' + RP.fmtResta(obra.fim - Date.now()), cls: 'obra', cor: cores().alerta });
      }
      if (x.tipo === 'pasto' && !antigo) {
        itens.push({ y: p.y - 18, d: function () { obj(c, V, p.x, p.y); cerca(c, P, false); } });
        itens.push({ y: p.y + 18, d: function () { obj(c, V, p.x, p.y); cerca(c, P, true); } });
      }
      var rel = RP.reliquiaEm && RP.reliquiaEm(x.id, true);   /* relíquias de outros reinos só aparecem depois de espionadas */
      if (rel) {
        var rx = p.x + (x.tipo === 'castelo' ? -46 : -24), ry = p.y + (x.tipo === 'castelo' ? 30 : 16);
        itens.push({ y: ry, d: function () { obj(c, V, rx, ry); pedestalReliquia(c, t, antigo ? PA : P, rel.tipo, !antigo); }, alvo: { x: rx, y: ry - 12, w: 26, h: 34, ent: ['local', x.id] } });
      }
      if (x.tipo === 'castelo') rotulos.push({ x: p.x, y: p.y, dy: 26, txt: x.reino === 'meu' ? D.reinos.meu.nome : 'Castelo', cls: 'castelo', cor: corReino(W.donoAparente(x)) });
      if (x.ameaca) rotulos.push({ x: p.x, y: p.y, dy: -46, txt: 'Ameaçado', cls: 'perigo' });
    });
    D.ruinas.forEach(function (rr) {
      var e = W.estado(rr.c, rr.l); if (e.v === 'desconhecido') return;
      var p = H.centro(rr.c, rr.l); if (!naTela(p.x, p.y)) return;
      itens.push({ y: p.y, d: function () { obj(c, V, p.x, p.y); desenharRuina(c, rr, t, e.v === 'explorado' ? PA : P); }, alvo: { x: p.x, y: p.y, w: 50, h: 34, ent: ['ruina', rr.id] } });
    });
    if (camadas.recursos !== false) D.jazidas.forEach(function (j) {
      var e = W.estado(j.c, j.l); if (e.v === 'desconhecido') return;
      var p = H.centro(j.c, j.l); if (!naTela(p.x, p.y)) return;
      var antigo = e.v === 'explorado';
      itens.push({ y: p.y, d: function () { obj(c, V, p.x, p.y); desenharJazida(c, j, t, antigo ? PA : P, !antigo); }, alvo: { x: p.x, y: p.y, w: 46, h: 34, ent: ['jazida', j.id] } });
      if (j.tipo === 'cavalo' && !antigo) for (var q = 0; q < 3; q++) (function (q) {
        var hx = p.x + Math.sin(t * 0.21 + q * 2.1) * 16, hy = p.y + Math.cos(t * 0.17 + q * 1.3) * 12, dir = Math.cos(t * 0.21 + q * 2.1) >= 0 ? 1 : -1;
        itens.push({ y: hy, d: function () { obj(c, V, hx, hy); cavalo(c, 0, 0, t, P, { cor: P.cavalo[(q + 2) % 4], dir: dir, andando: Math.sin(t * 0.4 + q) > 0, pastando: Math.sin(t * 0.4 + q) <= 0, fase: q }); } });
      })(q);
    });
    if (camadas.bandeiras !== false) D.bandeiras.forEach(function (b) {
      var e = W.estado(b.c, b.l); if (e.v === 'desconhecido') return;
      var p = H.centro(b.c, b.l), bx = p.x + 12, by = p.y + 8; if (!naTela(bx, by)) return;
      itens.push({ y: by, d: function () { obj(c, V, bx, by); desenharBandeira(c, b, t, e.v === 'explorado' ? PA : P, e.v !== 'explorado'); }, alvo: { x: bx + 6, y: by, w: 22, h: 32, ent: ['bandeira', b.id] } });
    });
    /* pessoas trabalhando e passeando */
    this.trilhos.forEach(function (o) {
      if (o.cavaloPasto) {
        var hx = o.centro.x + Math.sin(t * 0.3 + o.fase) * 18, hy = o.centro.y + Math.cos(t * 0.23 + o.fase * 1.3) * 11;
        if (!naTela(hx, hy)) return;
        var dir = Math.cos(t * 0.3 + o.fase) >= 0 ? 1 : -1, mov = Math.sin(t * 0.5 + o.fase) > -0.2;
        itens.push({ y: hy, d: function () { obj(c, V, hx, hy); cavalo(c, 0, 0, t, P, { cor: o.cor, dir: dir, andando: mov, pastando: !mov, fase: o.fase }); } });
        return;
      }
      if (o.soRecrutando && !D.filas.recrutamento.some(function (r) { return RP.fimItem(r) - r.total * 1000 <= Date.now() && RP.fimItem(r) > Date.now(); })) return;
      if (o.alvoPalha) {
        if (!naTela(o.alvoPalha.x, o.alvoPalha.y)) return;
        itens.push({ y: o.alvoPalha.y, d: function () { obj(c, V, o.alvoPalha.x, o.alvoPalha.y); linha(c, -2, 0, 0, -8, P.madeiraEsc, 1.2); linha(c, 2, 0, 0, -8, P.madeiraEsc, 1.2); elipse(c, 0, -10, 4.5, 4.5, '#d8c98f'); elipse(c, 0, -10, 3, 3, '#c0392b'); elipse(c, 0, -10, 1.4, 1.4, '#f1e6c2'); } });
        return;
      }
      if (o.arqueiro) {
        if (!naTela(o.fixo.x, o.fixo.y)) return;
        var fa = ((t * 0.8 + o.fase) % 1.6) / 1.6;
        itens.push({ y: o.fixo.y, d: function () {
          obj(c, V, o.fixo.x, o.fixo.y);
          pessoa(c, 0, 0, t, P, { roupa: corReino('meu'), cinto: '#2b2520', dir: 1, arco: true, atirando: true, fase: o.fase });
          if (fa > 0.55) {
            var k = (fa - 0.55) / 0.45, dx = o.alvoTiro.x - o.fixo.x, dy = (o.alvoTiro.y - o.fixo.y) * K;
            var fx = dx * k, fy = dy * k - 9.5 - Math.sin(k * Math.PI) * 6;
            linha(c, fx - 3, fy + 0.4, fx + 3, fy - 0.4, P.madeiraEsc, 0.8);
          }
        } });
        return;
      }
      var x, y, dir = o.dir || 1, andando = false;
      if (o.fixo) { x = o.fixo.x; y = o.fixo.y; }
      else {
        var dist = Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y), per = dist / o.vel, fase = ((t + o.fase * 7) / per) % 2, f = fase < 1 ? fase : 2 - fase;
        x = o.a.x + (o.b.x - o.a.x) * f; y = o.a.y + (o.b.y - o.a.y) * f; andando = true;
        dir = ((o.b.x - o.a.x) >= 0) === (fase < 1) ? 1 : -1;
      }
      if (!naTela(x, y)) return;
      var carga = o.carga && (o.fixo || (((t + o.fase * 7) / (Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y) / o.vel)) % 2) < 1) ? o.carga : null;
      itens.push({ y: y, d: function () {
        obj(c, V, x, y);
        if (o.soldado) pessoa(c, 0, 0, t, P, { roupa: corReino(o.dono), cinto: '#2b2520', dir: dir, andando: andando, fase: o.fase, capacete: P.metal, lanca: true, escudo: corReino(o.dono), estocada: o.estocada });
        else pessoa(c, 0, 0, t, P, { roupa: o.roupa, dir: dir, andando: andando, fase: o.fase, trabalho: o.trabalho, carga: carga, corCarga: o.corCarga });
      } });
    });
    /* fauna */
    if (camadas.fauna !== false) D.fauna.forEach(function (f) {
      var p = W.faunaVisivel(f, t);
      if (p) {
        if (!naTela(p.x, p.y)) return;
        var n = Math.min(f.qtd, f.tipo === 'ursos' ? 2 : 4);
        var dir = Math.cos(t / 47 + H.hash(f.c, f.l, 31) * 6.28) >= 0 ? 1 : -1;
        for (var q = 0; q < n; q++) (function (q) {
          var ax = p.x + Math.cos(q * 2.1 + t * 0.35) * 11 + (q - n / 2) * 6, ay = p.y + Math.sin(q * 1.7 + t * 0.3) * 7;
          if (f.tipo === 'crocodilos') { var rio = proximoRio(p.x, p.y); if (rio) { ax = rio.x + (q - n / 2) * 14; ay = rio.y + q * 3; } }
          itens.push({ y: ay, d: function () { obj(c, V, ax, ay); animal(c, f.tipo, 0, 0, t, P, dir, true, q * 1.3); } });
        })(q);
        self.alvos.push(alvoTela(self, p.x, p.y, 54, 30, ['fauna', f.id]));
        rotulos.push({ x: p.x, y: p.y, dy: -30, txt: W.ANIMAL[f.tipo].nome + ' · ' + W.NOME_NIVEL[f.nivel].toLowerCase(), cls: 'nivel', cor: corNivel(f.nivel) });
      } else if (W.estado(f.c, f.l).v !== 'desconhecido') {
        var pc = f.centro; if (!naTela(pc.x, pc.y)) return;
        var e = W.estado(f.c, f.l);
        itens.push({ y: pc.y, d: function () { obj(c, V, pc.x, pc.y); placaPerigo(c, f, P); }, alvo: { x: pc.x, y: pc.y, w: 26, h: 30, ent: ['fauna', f.id] } });
        rotulos.push({ x: pc.x, y: pc.y, dy: -30, txt: W.ANIMAL[f.tipo].nome + (e.v === 'explorado' ? ' · ' + RP.fmtHa(e.horas) : ''), cls: 'nivel', cor: corNivel(f.nivel) });
      }
    });
    /* marchas */
    if (camadas.marchas !== false) W.marchas.forEach(function (m) {
      var pos = m.posicao(), meu = m.d.dono === 'meu';
      if (!meu && W.estado(pos.hex[0], pos.hex[1]).v !== 'visivel') return;
      if (!naTela(pos.x, pos.y)) return;
      var cor = m.d.hostil ? '#3d4149' : corReino(m.d.dono), dir = Math.cos(pos.ang) >= 0 ? 1 : -1;
      var ux = Math.cos(pos.ang), uy = Math.sin(pos.ang);
      if (m.d.tipo === 'explorador') {
        itens.push({ y: pos.y, d: function () {
          obj(c, V, pos.x, pos.y);
          if (m.d.sub === 'cavalo') cavalo(c, 0, 0, t, P, { cor: P.cavalo[3], dir: dir, andando: true, galope: !m.d.escolta, cavaleiro: corReino('meu') });
          else if (m.d.sub === 'batedor') pessoa(c, 0, 0, t, P, { roupa: '#2f3a2c', capuz: '#26301f', dir: dir, andando: true, fase: 0.3 });
          else pessoa(c, 0, 0, t, P, { roupa: '#6b5a3a', dir: dir, andando: true, carga: m.d.sub === 'prospector' ? 'picareta' : null });
        } });
        if (m.d.escolta) for (var e2 = 0; e2 < 3; e2++) (function (e2) {
          var sx = pos.x - ux * (12 + e2 * 7) - uy * (e2 - 1) * 7, sy = pos.y - uy * (12 + e2 * 7) + ux * (e2 - 1) * 7;
          itens.push({ y: sy, d: function () { obj(c, V, sx, sy); pessoa(c, 0, 0, t, P, { roupa: corReino('meu'), cinto: '#1e1b18', dir: dir, andando: true, fase: e2, capacete: P.metal, lanca: true, escudo: corReino('meu') }); } });
        })(e2);
      } else if (m.d.tipo === 'extracao' && m.d.grupo) {
        var ge = m.d.grupo, nE = Math.min(5, (ge.lanceiro || 0) + (ge.arqueiro || 0) + (ge.cavalaria || 0));
        for (var qe = 0; qe < nE; qe++) (function (qe) {
          var sx = pos.x - ux * qe * 9 - uy * ((qe % 2) * 2 - 1) * 4, sy = pos.y - uy * qe * 9 + ux * ((qe % 2) * 2 - 1) * 4;
          itens.push({ y: sy, d: function () { obj(c, V, sx, sy); pessoa(c, 0, 0, t, P, { roupa: corReino('meu'), cinto: '#1e1b18', dir: dir, andando: true, fase: qe * 1.3, carga: qe % 2 ? 'picareta' : 'saco', capacete: P.metal }); } });
        })(qe);
      } else if (m.d.tipo === 'caca') {
        var g = m.d.grupo || { arqueiro: 3 }, nC = Math.min(5, (g.arqueiro || 0) + (g.lanceiro || 0) + (g.cavalaria || 0));
        for (var qc = 0; qc < nC; qc++) (function (qc) {
          var sx = pos.x - ux * qc * 9 - uy * ((qc % 2) * 2 - 1) * 4, sy = pos.y - uy * qc * 9 + ux * ((qc % 2) * 2 - 1) * 4;
          var arq = qc < (g.arqueiro || 0);
          itens.push({ y: sy, d: function () { obj(c, V, sx, sy); pessoa(c, 0, 0, t, P, { roupa: arq ? '#5f6b3a' : corReino('meu'), capuz: arq ? '#4b5530' : null, dir: dir, andando: true, fase: qc * 1.1, arco: arq, lanca: !arq, capacete: arq ? null : P.metal }); } });
        })(qc);
      } else {
        var n = m.d.hostil ? 9 : m.d.estandarte ? 7 : 6;
        for (var q = 0; q < n; q++) (function (q) {
          var fila = Math.floor(q / 3), col = q % 3 - 1, av = Math.sin(t * 2 + q) * 0.8;
          var sx = pos.x - ux * (fila * 11 - av) - uy * col * 8, sy = pos.y - uy * (fila * 11 - av) + ux * col * 8;
          itens.push({ y: sy, d: function () {
            obj(c, V, sx, sy);
            pessoa(c, 0, 0, t, P, { roupa: cor, cinto: '#1e1b18', dir: dir, andando: true, fase: q * 0.9, capacete: m.d.hostil ? '#2d3036' : P.metal, lanca: q % 3 !== 1, escudo: m.d.hostil ? '#4b4f57' : cor });
            if (q === 1 && !m.d.hostil) bandeira(c, -dir * 2, -12, 18, m.d.estandarte ? estandarteCor(m.d.dono) : cor, t, 10, 7);
          } });
        })(q);
        itens.push({ y: pos.y + 6, d: function () { obj(c, V, pos.x - ux * 30, pos.y - uy * 30); for (var z = 0; z < 3; z++) { var a = (t * 0.8 + z / 3) % 1; elipse(c, Math.sin(z * 3) * 6 - dir * a * 6, -a * 6, 4 + a * 6, 2 + a * 3, 'rgba(160,140,110,' + (0.3 * (1 - a)).toFixed(2) + ')'); } } });
      }
      self.alvos.push(alvoTela(self, pos.x, pos.y, 60, 44, ['marcha', m.d.id]));
      rotulos.push({ x: pos.x, y: pos.y, dy: -40, txt: (m.d.hostil ? '? ' : '') + RP.fmtResta(m.d.chegada - Date.now()), cls: m.d.hostil ? 'perigo' : 'marcha', cor: m.d.hostil ? cores().perigo : corReino(m.d.dono) });
    });

    /* extrações em andamento: posto e trabalhadores na jazida */
    D.extracoes.forEach(function (ex) {
      if (ex.aCaminho) return;
      var j = W.jazida(ex.jazida), p = H.centro(j.c, j.l);
      if (!naTela(p.x, p.y) || W.estado(j.c, j.l).v !== 'visivel') return;
      if (ex.posto) itens.push({ y: p.y - 14, d: function () { obj(c, V, p.x + 22, p.y - 14); casa(c, 0, 0, 13, 9, 7, 5, P, { telhado: P.telhado2, telhadoS: P.telhado2Sombra, janela: false }); caixa(c, -14, gz(8), 7, 5, 4, P.madeira, P.madeiraEsc, null); } });
      var nT = Math.min(4, (ex.grupo.lanceiro || 0) + (ex.grupo.arqueiro || 0));
      for (var q = 0; q < nT; q++) (function (q) {
        var wx = p.x - 16 + q * 10, wy = p.y + 10 + (q % 2) * 6;
        itens.push({ y: wy, d: function () { obj(c, V, wx, wy); pessoa(c, 0, 0, t, P, { roupa: corReino('meu'), dir: q % 2 ? -1 : 1, trabalho: 'picareta', fase: q * 0.9, capacete: P.metal }); } });
      })(q);
      rotulos.push({ x: p.x, y: p.y, dy: -40, txt: 'Extraindo · ' + ex.ritmo + '/h', cls: 'marcha', cor: corReino('meu') });
    });
    /* escavações de ruínas antigas: trabalhadores cavando depois que o grupo chega */
    D.escavacoes.forEach(function (q) {
      if (q.chega > Date.now()) return;
      var j = W.jazida(q.jazida), p = H.centro(j.c, j.l);
      if (!naTela(p.x, p.y) || W.estado(j.c, j.l).v !== 'visivel') return;
      var nT = Math.max(1, Math.min(4, (q.grupo.lanceiro || 0) + (q.grupo.arqueiro || 0) + (q.grupo.cavalaria || 0)));
      for (var z = 0; z < nT; z++) (function (z) {
        var wx = p.x - 14 + z * 9, wy = p.y + 12 + (z % 2) * 5;
        itens.push({ y: wy, d: function () { obj(c, V, wx, wy); pessoa(c, 0, 0, t, P, { roupa: corReino('meu'), dir: z % 2 ? -1 : 1, trabalho: 'picareta', fase: z * 0.7, capacete: P.metal }); } });
      })(z);
      rotulos.push({ x: p.x, y: p.y, dy: -40, txt: 'Escavando · ' + RP.fmtResta(q.fim - Date.now()), cls: 'marcha', cor: corReino('meu') });
    });
    /* batalha em andamento */
    if (RP.batalha && RP.batalha.ativa()) {
      var bl = W.local(D.batalha.local), bp = H.centro(bl.c, bl.l), fz = RP.batalha.forcas(), recuo = RP.batalha.estado.recuo;
      if (naTela(bp.x, bp.y)) {
        var nA = Math.max(2, Math.min(9, Math.round(fz.a / 11))), nD = recuo ? 0 : Math.max(1, Math.min(9, Math.round(fz.d / 11)));
        for (var qa = 0; qa < nA; qa++) (function (qa) {
          var ax = bp.x - 30 + (qa % 3) * 7 + (recuo ? Math.sin(t * 0.5 + qa) * 10 : 0), ay = bp.y + 20 + Math.floor(qa / 3) * 7;
          itens.push({ y: ay, d: function () { obj(c, V, ax, ay); pessoa(c, 0, 0, t, P, { roupa: '#3d4149', cinto: '#1e1b18', dir: 1, capacete: '#2d3036', lanca: qa % 3 !== 2, arco: qa % 3 === 2, atirando: qa % 3 === 2, estocada: !recuo, escudo: '#4b4f57', fase: qa * 0.7, carga: recuo && qa % 2 ? 'saco' : null, andando: !!recuo }); } });
        })(qa);
        for (var qd = 0; qd < nD; qd++) (function (qd) {
          var dx = bp.x - 4 + (qd % 3) * 7, dy = bp.y + 18 + Math.floor(qd / 3) * 7, sold = qd < 2;
          itens.push({ y: dy, d: function () { obj(c, V, dx, dy); pessoa(c, 0, 0, t, P, sold ? { roupa: corReino('meu'), cinto: '#1e1b18', dir: -1, capacete: P.metal, lanca: true, escudo: corReino('meu'), estocada: true, fase: qd } : { roupa: P.roupa[qd % 5], dir: -1, trabalho: 'picareta', fase: qd * 0.8 }); } });
        })(qd);
        itens.push({ y: bp.y + 40, d: function () {
          obj(c, V, bp.x, bp.y);
          for (var z = 0; z < 6; z++) { var a = (t * 0.9 + z / 6) % 1; elipse(c, -9 + Math.sin(z * 2 + t * 3) * 3, gz(-6) - 14 - a * 18, 2.5 + a * 2, 3 + a * 3, 'rgba(255,' + Math.round(150 + 80 * (1 - a)) + ',60,' + (0.8 * (1 - a)).toFixed(2) + ')'); }
          fumaca(c, -9, gz(-6) - 30, t, true, 1.3);
          for (var f = 0; f < 3; f++) { var k = ((t * 0.7 + f / 3) % 1); linha(c, -24 + k * 26, 20 - Math.sin(k * Math.PI) * 14, -20 + k * 26, 19 - Math.sin(k * Math.PI) * 14, P.madeiraEsc, 0.8); }
          for (var dd = 0; dd < 3; dd++) { var a2 = (t * 0.6 + dd / 3) % 1; elipse(c, -12 + dd * 6, 22 - a2 * 6, 5 + a2 * 6, 2 + a2 * 3, 'rgba(160,140,110,' + (0.35 * (1 - a2)).toFixed(2) + ')'); }
        } });
        self.alvos.push(alvoTela(self, bp.x, bp.y + 24, 80, 60, ['batalha', D.batalha.id]));
        rotulos.push({ x: bp.x, y: bp.y, dy: -46, txt: 'Batalha · ' + RP.fmtResta(RP.batalha.restante() * 1000), cls: 'perigo', cor: cores().perigo });
      }
    }

    itens.sort(function (a, b) { return a.y - b.y; });
    itens.forEach(function (it) {
      it.d();
      if (it.alvo) { var a = it.alvo; self.alvos.push(alvoTela(self, a.x, a.y, a.w, a.h, a.ent)); }
    });

    /* névoa à deriva sobre o desconhecido */
    var pf = puff();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var hs = hexesNoRetangulo(vis, 0);
    hs.forEach(function (h) {
      if (H.hash(h[0], h[1], 230) > 0.3 || W.estado(h[0], h[1]).v !== 'desconhecido') return;
      var ce = H.centro(h[0], h[1]), ph = H.hash(h[0], h[1], 231) * 6.28;
      var p = self.tela(ce.x + Math.sin(t * 0.07 + ph) * 22, ce.y + Math.cos(t * 0.05 + ph) * 12);
      var sz = 110 * s;
      c.globalAlpha = 0.45; c.drawImage(pf, p.x - sz / 2, p.y - sz * 0.75, sz, sz * 0.7); c.globalAlpha = 1;
    });

    /* rótulos (espaço de tela) */
    if (camadas.rotulos !== false) rotulos.forEach(function (rt) {
      var p = self.tela(rt.x, rt.y);
      var y = p.y + rt.dy * Math.min(1.4, s / 1.4) ;
      pilula(c, p.x, y, rt.txt, rt.cls, rt.cor);
    });
  };

  function obraDe(localId) {
    var agora = Date.now(), o = D.filas.obras.filter(function (x) { return x.local === localId && RP.fimItem(x) > agora; })[0];
    if (!o) return null;
    var fim = RP.fimItem(o);
    return { ativa: fim - o.total * 1000 <= agora, fim: fim };
  }
  function andaime(c, r, t, pal) {
    var h = r * 1.3;
    [[-r, 6], [r, 6], [-r * 0.7, -8], [r * 0.9, -6]].forEach(function (q) { linha(c, q[0], gz(q[1]), q[0], gz(q[1]) - h, pal.madeiraLuz, 1.4); });
    [0.35, 0.7].forEach(function (f) { linha(c, -r - 2, gz(6) - h * f, r + 2, gz(6) - h * f, pal.madeira, 1.6); });
    linha(c, -r, gz(6), -r * 0.7, gz(-8) - h * 0.7, pal.madeira, 0.9);
    linha(c, r, gz(6) - h * 0.35, r * 0.2, gz(6) - h * 0.7, pal.madeira, 0.9);
  }
  function materiais(c, pal) {
    for (var i = 0; i < 3; i++) { c.fillStyle = pal.madeiraLuz; c.fillRect(18, gz(14) - 3 - i * 2.6, 12, 2.4); }
    rocha(c, 34, gz(16), 0.7, pal); rocha(c, 38, gz(12), 0.6, pal);
  }
  function estandarteCor(reino) { var b = D.reinos[reino].brasao; return b ? getComputedStyle(document.documentElement).getPropertyValue('--tin-' + b.cor1).trim() : corReino(reino); }
  function proximoRio(x, y) {
    var melhor = null, md = 1e9;
    W.rios.forEach(function (r) { r.forEach(function (h) { var p = H.centro(h[0], h[1]), d = Math.hypot(p.x - x, p.y - y); if (d < md) { md = d; melhor = p; } }); });
    return md < 70 ? melhor : null;
  }
  function cerca(c, pal, frente) {
    var rx = 30, rz = 22, n = 14, i, a, x, y, px = null, py = null;
    for (i = 0; i <= n; i++) {
      a = (i / n) * Math.PI * 2;
      var naFrente = Math.sin(a) > 0;
      x = Math.cos(a) * rx; y = gz(Math.sin(a) * rz);
      if (naFrente === frente) {
        linha(c, x, y, x, y - 6, pal.madeiraEsc, 1.3);
        if (px !== null) { linha(c, px, py - 5, x, y - 5, pal.madeira, 1); linha(c, px, py - 2.5, x, y - 2.5, pal.madeira, 1); }
        px = x; py = y;
      } else px = null;
    }
  }
  function alvoTela(cena, x, y, w, h, ent) {
    var p = cena.tela(x, y), s = cena.cam.s;
    return { x0: p.x - (w / 2) * s, x1: p.x + (w / 2) * s, y0: p.y - h * s, y1: p.y + 10 * s, ent: ent };
  }
  function pilula(c, x, y, txt, cls, cor) {
    c.font = (cls === 'castelo' ? '700 13px ' : '700 12px ') + getComputedStyle(document.documentElement).getPropertyValue(cls === 'castelo' ? '--fonte-titulo' : '--fonte-texto');
    var w = c.measureText(txt).width + 16, h = 20;
    c.fillStyle = 'rgba(13,15,18,.82)';
    c.beginPath();
    if (c.roundRect) c.roundRect(x - w / 2, y - h / 2, w, h, 10); else c.rect(x - w / 2, y - h / 2, w, h);
    c.fill();
    c.strokeStyle = cor || 'rgba(255,255,255,.2)'; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = cls === 'perigo' ? '#ffb3a8' : '#efe9dd'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(txt, x, y + 0.5);
  }

  RP.Cena = Cena;
  RP.cenaK = K;
})();
