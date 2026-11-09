/* Reino de Pedra — Mapa tático: hexágonos com ícones, nomes, camadas e legenda (design system §6).
   Terreno, rios, rotas, perigo, véu de explorado e névoa vão para um Canvas com cache (leve para 60 × 48 no
   celular); os marcadores ficam numa camada SVG por cima, com as mesmas classes e ícones do protótipo
   (zoom semântico, contraescala, anéis de ameaça), e o toque acha o marcador pelo elemento.
   Cores sempre dos tokens (lidas do CSS). */
(function () {
  'use strict';
  var RP = window.RP, H = RP.hex, M = RP.mapaModelo, A = RP.arte;
  var SMIN = 0.2, SMAX = 2.2;

  function n1(v) { return v.toFixed(1); }
  function token(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  var T = null;
  function tokens() {
    if (T) return T;
    T = { fundo: token('--mapa-fundo'), linha: token('--hex-linha'), rioAgua: token('--rio-agua'), rioMargem: token('--rio-margem'), rioBrilho: token('--rio-brilho'),
      rota: token('--rota-cor'), rotaBorda: token('--rota-borda'), veu: token('--explorado-veu'), hachura: token('--explorado-hachura'),
      nevoa: [token('--nevoa-1'), token('--nevoa-2'), token('--nevoa-3')], bordaNevoa: token('--borda-nevoa') || 'rgba(217, 178, 92, .28)', rotuloNevoa: token('--nevoa-rotulo'), fonteTitulo: token('--fonte-titulo'),
      pg: { baixo: token('--perigo-baixo'), medio: token('--perigo-medio'), alto: token('--perigo-alto') }, t: {} };
    ['planicie', 'floresta', 'colina', 'montanha', 'pantano'].forEach(function (k) { T.t[k] = [token('--t-' + k), token('--t-' + k + '-2')]; });
    return T;
  }
  /* símbolos de terreno do sprite (icones.js): lidos do próprio DOM, com as cores calculadas pelo CSS */
  var SIMB = {};
  function simbolo(id) {
    if (SIMB[id]) return SIMB[id];
    var g = document.getElementById(id), out = [];
    if (!g) return out;
    Array.prototype.forEach.call(g.children, function (el) {
      var p = new Path2D(), tag = el.tagName.toLowerCase(), cs = getComputedStyle(el), num = function (a) { return +el.getAttribute(a) || 0; };
      if (tag === 'path') p = new Path2D(el.getAttribute('d'));
      else if (tag === 'circle') p.arc(num('cx'), num('cy'), num('r'), 0, 6.2832);
      else if (tag === 'ellipse') p.ellipse(num('cx'), num('cy'), num('rx'), num('ry'), 0, 0, 6.2832);
      else return;
      out.push({ p: p, fill: cs.fill && cs.fill !== 'none' ? cs.fill : null, stroke: cs.stroke && cs.stroke !== 'none' ? cs.stroke : null, lw: parseFloat(cs.strokeWidth) || 1, cap: cs.strokeLinecap || 'butt' });
    });
    return (SIMB[id] = out);
  }
  function desenharSimbolo(c, id) {
    simbolo(id).forEach(function (s) {
      if (s.fill) { c.fillStyle = s.fill; c.fill(s.p); }
      if (s.stroke) { c.strokeStyle = s.stroke; c.lineWidth = s.lw; c.lineCap = s.cap; c.lineJoin = 'round'; c.stroke(s.p); }
    });
  }
  var SIMBOLO = { floresta: ['m-arvores-1', 'm-arvores-2'], colina: ['m-colina'], montanha: ['m-monte'], pantano: ['m-junco'], planicie: ['m-grama'] };
  var HACHURA = null;
  function hachura(c) {
    if (HACHURA) return HACHURA;
    var tk = tokens(), cv = document.createElement('canvas'); cv.width = cv.height = 9;
    var g = cv.getContext('2d'); g.strokeStyle = tk.hachura; g.lineWidth = 2.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 9); g.stroke();
    HACHURA = c.createPattern(cv, 'repeat');
    if (HACHURA.setTransform && window.DOMMatrix) HACHURA.setTransform(new DOMMatrix().rotate(45));
    return HACHURA;
  }
  function hexPath(c, x, y, r) {
    c.beginPath();
    for (var i = 0; i < 6; i++) { var a = (Math.PI / 180) * (60 * i - 30); if (i) c.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); else c.moveTo(x + r * Math.cos(a), y + r * Math.sin(a)); }
    c.closePath();
  }
  function cantoXY(cx, cy, i) { var a = (Math.PI / 180) * (60 * i - 30); return [cx + H.R * Math.cos(a), cy + H.R * Math.sin(a)]; }
  /* aresta comum com cada vizinho (mesma ordem de H.vizinhos para linhas pares/ímpares) */
  var ARESTA = [[0, 1], [5, 0], [4, 5], [3, 4], [2, 3], [1, 2]];
  function vizinhosComDirecao(h) {
    var c = H.c(h), l = H.l(h), d = (l & 1) ? [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]] : [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
    return d.map(function (v, i) { var nc = c + v[0], nl = l + v[1]; return { i: i, h: H.dentro(nc, nl) ? H.idx(nc, nl) : -1 }; });
  }

  /* ================================================================ Tatico */
  function Tatico(el, opt) {
    this.el = el; this.opt = opt || {};
    el.innerHTML = '<canvas class="tatico-cv" aria-hidden="true"></canvas><svg class="mapa-svg" xmlns="http://www.w3.org/2000/svg"><g class="mundo"></g></svg>';
    this.cv = el.querySelector('canvas'); this.ctx = this.cv.getContext('2d');
    this.svg = el.querySelector('svg'); this.g = el.querySelector('.mundo');
    this.cam = { x: H.LARGURA / 2, y: H.ALTURA / 2, s: 0.75 };
    this.w = 0; this.h = 0; this.dpr = 1; this.ci = null; this.raf = 0; this.anim = 0; this.ativo = false; this.gesto = false; this.ultimaMudanca = 0;
    this.cache = document.createElement('canvas'); this.cctx = this.cache.getContext('2d');
    this.selecao = -1; this.fundar = null; this.versaoSvg = -1;
    this.ligarGestos();
    var self = this;
    /* a coluna do painel abre com transição, sem 'resize' da janela no fim: mede de novo quando o elemento muda */
    if (window.ResizeObserver) new ResizeObserver(function () {
      var w = self.w, h = self.h;
      self.redimensionar();
      if (w !== self.w || h !== self.h) self.pedirQuadro();
    }).observe(el);
  }
  /* uma escuta do relógio para todos os mapas ativos (sem vazamento por instância) */
  var ativos = [];
  document.addEventListener('rp:tique', function () { ativos.forEach(function (t) { t.atualizarMoveis(); }); });
  var TP = Tatico.prototype;

  TP.redimensionar = function () {
    var w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w !== this.w || h !== this.h) { this.w = w; this.h = h; this.cv.width = Math.round(w * this.dpr); this.cv.height = Math.round(h * this.dpr); this.ci = null; }
  };
  TP.tela = function (x, y) { return { x: (x - this.cam.x) * this.cam.s + this.w / 2, y: (y - this.cam.y) * this.cam.s + this.h / 2 }; };
  TP.mundo = function (sx, sy) { return { x: (sx - this.w / 2) / this.cam.s + this.cam.x, y: (sy - this.h / 2) / this.cam.s + this.cam.y }; };
  TP.centro = function () { return { x: this.cam.x, y: this.cam.y }; };
  TP.retanguloMundo = function () { var s = this.cam.s; return { x: this.cam.x - this.w / (2 * s), y: this.cam.y - this.h / (2 * s), w: this.w / s, h: this.h / s }; };
  TP.limitar = function () {
    this.cam.s = Math.max(SMIN, Math.min(SMAX, this.cam.s));
    this.cam.x = Math.max(0, Math.min(H.LARGURA, this.cam.x)); this.cam.y = Math.max(0, Math.min(H.ALTURA, this.cam.y));
    if (!isFinite(this.cam.x) || !isFinite(this.cam.y) || !isFinite(this.cam.s)) this.cam = { x: H.LARGURA / 2, y: H.ALTURA / 2, s: 0.75 };
  };
  TP.mudou = function () {
    this.limitar(); this.ultimaMudanca = performance.now();
    if (this.opt.aoMover) this.opt.aoMover();
    this.pedirQuadro();
  };
  TP.pedirQuadro = function () {
    var self = this;
    if (this.raf || !this.ativo) return;
    this.raf = requestAnimationFrame(function () { self.raf = 0; self.quadro(); });
  };
  TP.centrar = function (wx, wy, s, fy, animar) {
    this.redimensionar();
    s = Math.max(SMIN, Math.min(SMAX, s || this.cam.s));
    fy = fy == null ? 0.5 : fy;
    var alvo = { s: s, x: wx, y: wy - (this.h * fy - this.h / 2) / s };
    if (animar === false || !this.ativo) { cancelAnimationFrame(this.anim); this.cam = alvo; this.mudou(); return; }
    this.animarPara(alvo, 320);
  };
  TP.animarPara = function (alvo, dur) {
    var self = this, ini = { x: this.cam.x, y: this.cam.y, s: this.cam.s }, t0 = performance.now();
    cancelAnimationFrame(this.anim);
    (function passo(t) {
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      self.cam = { x: ini.x + (alvo.x - ini.x) * e, y: ini.y + (alvo.y - ini.y) * e, s: ini.s + (alvo.s - ini.s) * e };
      self.mudou();
      if (p < 1 && self.ativo) self.anim = requestAnimationFrame(passo);
    })(t0);
  };
  TP.zoomBotao = function (f) {
    var ns = this.cam.s * f;
    if (ns > SMAX * 1.05 && this.opt.aoAproximarDemais) { this.opt.aoAproximarDemais(); return; }
    this.animarPara({ x: this.cam.x, y: this.cam.y, s: Math.max(SMIN, Math.min(SMAX, ns)) }, 220);
  };
  TP.ligarGestos = function () {
    var self = this, p0 = null, avisado = false, tracando = false, ponto = null, toque = null;
    function tracar(p) { var w = self.mundo(p.x, p.y), h = H.pixelParaHex(w.x, w.y); if (h >= 0) self.opt.aoTracar(h); }
    this.el.addEventListener('pointerdown', function (e) { var r = self.el.getBoundingClientRect(); toque = { x: e.clientX - r.left, y: e.clientY - r.top }; });
    RP.gestos(this.el, {
      inicio: function () { cancelAnimationFrame(self.anim); self.gesto = true; avisado = false; tracando = !!(self.opt.desenhando && self.opt.desenhando()); ponto = null; },
      inicioPinca: function () { p0 = { x: self.cam.x, y: self.cam.y, s: self.cam.s }; if (tracando) { tracando = false; self.opt.aoTracarFim(); } },
      arrasto: function (dx, dy) {
        /* desenhando a linha de uma patrulha: arrastar risca hexágono a hexágono */
        if (tracando) {
          if (!ponto) { ponto = toque || { x: self.w / 2, y: self.h / 2 }; tracar(ponto); }
          ponto = { x: ponto.x + dx, y: ponto.y + dy };
          tracar(ponto);
          self.pedirQuadro();
          return;
        }
        self.cam.x -= dx / self.cam.s; self.cam.y -= dy / self.cam.s; self.mudou();
      },
      pinca: function (f, mx, my, mx0, my0) {
        var wx = (mx0 - self.w / 2) / p0.s + p0.x, wy = (my0 - self.h / 2) / p0.s + p0.y, ns = p0.s * f;
        /* aproximar além do limite volta à Vista, como afastar na Vista traz ao Mapa */
        if (ns > SMAX * 1.25 && self.opt.aoAproximarDemais) { if (!avisado) { avisado = true; self.opt.aoAproximarDemais(); } return; }
        ns = Math.max(SMIN, Math.min(SMAX, ns));
        self.cam = { s: ns, x: wx - (mx - self.w / 2) / ns, y: wy - (my - self.h / 2) / ns };
        self.mudou();
      },
      roda: function (f, x, y) {
        var ns = self.cam.s * f;
        if (ns > SMAX * 1.1 && self.opt.aoAproximarDemais) { self.opt.aoAproximarDemais(); return; }
        ns = Math.max(SMIN, Math.min(SMAX, ns));
        var w = self.mundo(x, y);
        self.cam = { s: ns, x: w.x - (x - self.w / 2) / ns, y: w.y - (y - self.h / 2) / ns };
        self.mudou();
      },
      toque: function (x, y, cx, cy, duplo, shift) { self.tocar(x, y, cx, cy, { botao: 0, duplo: !!duplo, shift: !!shift }); },
      cliqueDireito: function (x, y, cx, cy, shift) { self.tocar(x, y, cx, cy, { botao: 2, shift: !!shift }); },
      passar: function (x, y) {
        var r = self.el.getBoundingClientRect(), a = document.elementFromPoint(r.left + x, r.top + y);
        self.el.classList.toggle('sobre-objeto', !!(a && a.closest && a.closest('[data-k]')));
        if (self.opt.aoPassar) { var w = self.mundo(x, y); self.opt.aoPassar(H.pixelParaHex(w.x, w.y)); }
      },
      fim: function () { self.gesto = false; self.ultimaMudanca = performance.now(); self.pedirQuadro(); if (tracando) { tracando = false; self.opt.aoTracarFim(); } }
    });
  };
  TP.tocar = function (x, y, cx, cy, extra) {
    var d = M.dados; if (!d) return;
    extra = extra || {};
    this.redimensionar();
    var alvo = document.elementFromPoint(cx, cy), ent = alvo && alvo.closest && alvo.closest('[data-k]');
    var w = this.mundo(x, y), h = H.pixelParaHex(w.x, w.y);
    if (ent) {
      var o = d.objetos[+ent.getAttribute('data-k')];
      if (o) { this.opt.aoTocar({ ent: [o.tipo, o.id != null ? o.id : o._k], obj: o, hex: o.hex != null ? o.hex : h, botao: extra.botao || 0, duplo: !!extra.duplo, shift: !!extra.shift, cx: cx, cy: cy }); return; }
    }
    if (h >= 0) this.opt.aoTocar({ hex: h, botao: extra.botao || 0, duplo: !!extra.duplo, shift: !!extra.shift, cx: cx, cy: cy });
  };
  /* desloca a câmera em pixels da tela (teclado) */
  TP.deslocar = function (dx, dy) { cancelAnimationFrame(this.anim); this.cam.x += dx / this.cam.s; this.cam.y += dy / this.cam.s; this.mudou(); };

  TP.iniciar = function () {
    this.ativo = true; if (ativos.indexOf(this) < 0) ativos.push(this);
    this.redimensionar(); this.atualizarSvg(); this.quadro();
  };
  TP.parar = function () {
    this.ativo = false; cancelAnimationFrame(this.raf); cancelAnimationFrame(this.anim); this.raf = 0;
    var i = ativos.indexOf(this); if (i >= 0) ativos.splice(i, 1);
  };
  TP.invalidar = function () { this.ci = null; this.versaoSvg = -1; if (this.ativo) { this.atualizarSvg(); this.quadro(); } };

  /* ---------------------------------------------------------------- canvas: terreno com cache */
  TP.precisaCache = function () {
    var r = this.ci;
    if (!r || r.versao !== M.versao || r.perigo !== this.chavePerigo()) return true;
    var v = this.retanguloMundo();
    if (v.x < r.x || v.y < r.y || v.x + v.w > r.x + r.w || v.y + v.h > r.y + r.h) return true;
    var rel = this.cam.s / r.s;
    return !this.gesto && (rel > 1.15 || rel < 0.87) && performance.now() - this.ultimaMudanca > 120;
  };
  TP.chavePerigo = function () { var MAPA = RP.mapa; return MAPA.camadas.perigo && MAPA.perigoHex ? 1 : 0; };
  TP.construirCache = function () {
    var s = this.cam.s, MG = 0.4, cw = this.w * (1 + 2 * MG), ch = this.h * (1 + 2 * MG);
    var dprC = Math.min(this.dpr, Math.sqrt(8e6 / (cw * ch)));
    this.cache.width = Math.round(cw * dprC); this.cache.height = Math.round(ch * dprC);
    var r = { x: this.cam.x - cw / s / 2, y: this.cam.y - ch / s / 2, w: cw / s, h: ch / s, s: s, cw: cw, ch: ch, versao: M.versao, perigo: this.chavePerigo() };
    this.ci = r;
    var S = s * dprC, c = this.cctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = tokens().fundo; c.fillRect(0, 0, this.cache.width, this.cache.height);
    c.setTransform(S, 0, 0, S, -r.x * S, -r.y * S);
    desenharTerreno(c, r, s);
  };

  function desenharTerreno(c, r, s) {
    var d = M.dados, tk = tokens(), MAPA = RP.mapa;
    if (!d) return;
    var c0 = Math.max(0, Math.floor(r.x / H.W) - 1), c1 = Math.min(H.COLS - 1, Math.ceil((r.x + r.w) / H.W) + 1);
    var l0 = Math.max(0, Math.floor(r.y / H.VS) - 1), l1 = Math.min(H.LINS - 1, Math.ceil((r.y + r.h) / H.VS) + 1);
    var cc, ll, h, p, t, conhecidos = [], desconhecidos = [], e;
    for (ll = l0; ll <= l1; ll++) for (cc = c0; cc <= c1; cc++) {
      h = H.idx(cc, ll); e = M.estado(h);
      var it = { h: h, c: cc, l: ll, p: H.centro(cc, ll), e: e };
      conhecidos.push(it);
      if (e.nunca) desconhecidos.push(it);
    }
    /* terreno */
    conhecidos.forEach(function (x) {
      t = d.ter[x.h];
      c.fillStyle = tk.t[t][A.hash(x.c, x.l, 3) > 0.55 ? 1 : 0];
      hexPath(c, x.p.x, x.p.y, H.R + 0.6); c.fill();
      c.strokeStyle = tk.linha; c.lineWidth = 1; c.stroke();
    });
    /* símbolos (somem de muito longe) */
    if (s >= 0.3) conhecidos.forEach(function (x) {
      t = d.ter[x.h]; var sim = SIMBOLO[t];
      if (!sim || d.rio[x.h] || (t === 'planicie' && A.hash(x.c, x.l, 5) > 0.32)) return;
      var id = sim[Math.floor(A.hash(x.c, x.l, 7) * sim.length) % sim.length], k = 0.82 + A.hash(x.c, x.l, 9) * 0.25;
      c.save(); c.translate(x.p.x + (A.hash(x.c, x.l, 11) - 0.5) * 6, x.p.y + (A.hash(x.c, x.l, 13) - 0.5) * 5); c.scale(k, k);
      desenharSimbolo(c, id); c.restore();
    });
    /* rios e rotas */
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = tk.rioMargem; c.lineWidth = 13; c.stroke(d.curvaRios);
    c.strokeStyle = tk.rioAgua; c.lineWidth = 9; c.stroke(d.curvaRios);
    c.setLineDash([10, 18]); c.strokeStyle = tk.rioBrilho; c.lineWidth = 2; c.stroke(d.curvaRios); c.setLineDash([]);
    if (MAPA.camadas.rotas !== false) {
      c.strokeStyle = tk.rotaBorda; c.lineWidth = 8; c.stroke(d.curvaRotas);
      c.strokeStyle = tk.rota; c.lineWidth = 4.5; c.stroke(d.curvaRotas);
      conhecidos.forEach(function (x) {
        if (!d.rio[x.h] || !d.rotaH[x.h]) return;
        c.save(); c.translate(x.p.x, x.p.y);
        if (d.ponteH[x.h]) { c.rotate(anguloRota(x.h)); desenharSimbolo(c, 'm-ponte'); }
        else { c.rotate(-Math.PI / 6); desenharSimbolo(c, 'm-vau'); }
        c.restore();
      });
    }
    /* camada Perigo (preenchida pelo sistema de fauna) */
    if (MAPA.camadas.perigo && MAPA.perigoHex) conhecidos.forEach(function (x) {
      var n = MAPA.perigoHex(x.h, d); if (!n || !tk.pg[n]) return;
      hexPath(c, x.p.x, x.p.y, H.R - 1);
      c.globalAlpha = n === 'alto' ? 0.36 : n === 'medio' ? 0.3 : 0.22; c.fillStyle = tk.pg[n]; c.fill();
      c.globalAlpha = 0.6; c.strokeStyle = tk.pg[n]; c.lineWidth = 1.5; c.stroke(); c.globalAlpha = 1;
    });
    /* véu de explorado (último estado conhecido) */
    var hp = hachura(c);
    conhecidos.forEach(function (x) {
      if (x.e.v !== 'explorado') return;
      hexPath(c, x.p.x, x.p.y, H.R + 0.6);
      c.fillStyle = tk.veu; c.fill(); c.fillStyle = hp; c.fill();
    });
    /* névoa: o chão aparece embaçado (é a riqueza dele que ela cobre); a fronteira ganha filete dourado */
    c.globalAlpha = 0.4;
    desconhecidos.forEach(function (x) {
      c.fillStyle = tk.nevoa[Math.floor(A.hash(x.c, x.l, 17) * 3) % 3];
      hexPath(c, x.p.x, x.p.y, H.R + 1); c.fill();
    });
    c.globalAlpha = 1;
    c.strokeStyle = tk.bordaNevoa; c.lineWidth = 1.5; c.lineCap = 'round';
    c.beginPath();
    conhecidos.forEach(function (x) {
      if (x.e.nunca) return;
      vizinhosComDirecao(x.h).forEach(function (v) {
        if (v.h < 0 || !M.estado(v.h).nunca) return;
        var ar = ARESTA[v.i], p1 = cantoXY(x.p.x, x.p.y, ar[0]), p2 = cantoXY(x.p.x, x.p.y, ar[1]);
        c.moveTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]);
      });
    });
    c.stroke();
  }
  function anguloRota(h) {
    var ce = H.centroH(h), vs = H.vizinhos(h).filter(function (v) { return M.rota(v); });
    if (!vs.length) return 0;
    var a = H.centroH(vs[0]);
    if (vs.length === 1) return Math.atan2(a.y - ce.y, a.x - ce.x);
    var b = H.centroH(vs[1]);
    return Math.atan2(b.y - a.y, b.x - a.x);
  }

  TP.quadro = function () {
    if (!this.w) this.redimensionar();
    if (!this.w) return;
    var c = this.ctx, dpr = this.dpr, s = this.cam.s, self = this, MAPA = RP.mapa, d = M.dados;
    if (this.precisaCache()) this.construirCache();
    var r = this.ci, esc = s / r.s, o = this.tela(r.x, r.y);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = tokens().fundo; c.fillRect(0, 0, this.cv.width, this.cv.height);
    c.imageSmoothingEnabled = true;
    c.drawImage(this.cache, o.x * dpr, o.y * dpr, r.cw * esc * dpr, r.ch * esc * dpr);
    /* desenhos de sistemas no espaço do mundo, sob os marcadores */
    var W = s * dpr, ox = (this.w / 2 - this.cam.x * s) * dpr, oy = (this.h / 2 - this.cam.y * s) * dpr, agora = RP.agora();
    if (d) {
      d.objs.forEach(function (ob) {
        var tp = MAPA.tiposObjeto[ob.tipo];
        if (!tp || !tp.desenharTatico || (tp.camada && MAPA.camadas[tp.camada] === false)) return;
        c.setTransform(W, 0, 0, W, ox, oy);
        try { tp.desenharTatico(c, ob, { estado: M.estado(ob.hex), s: s, agora: agora }); } catch (e) { console.error(e); }
      });
      MAPA.desenhosExtras.forEach(function (f) { c.setTransform(W, 0, 0, W, ox, oy); try { f(c, d, { x: self.cam.x, y: self.cam.y, z: s }, agora); } catch (e) { console.error(e); } });
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    this.aplicarSvg();
  };

  /* ---------------------------------------------------------------- SVG: marcadores */
  function fatorK(s) { var f = Math.max(0.72, Math.min(1.15, Math.pow(s, 0.35))); return f / s; }
  TP.aplicarSvg = function () {
    var s = this.cam.s, tx = this.w / 2 - this.cam.x * s, ty = this.h / 2 - this.cam.y * s;
    this.g.setAttribute('transform', 'translate(' + n1(tx) + ' ' + n1(ty) + ') scale(' + s.toFixed(4) + ')');
    this.svg.style.setProperty('--k', fatorK(s).toFixed(3));
    var z = s < 0.3 ? 'zoom-mundo' : s < 0.46 ? 'zoom-longe' : s < 0.95 ? 'zoom-medio' : 'zoom-perto';
    if (this.svg.getAttribute('data-zoom') !== z) this.svg.setAttribute('data-zoom', z);
  };

  function rotuloSvg(txt, y, cls) { return '<text class="ent-rotulo ' + (cls || '') + '" y="' + y + '">' + RP.esc(txt) + '</text>'; }
  function classeDono(dono) { return 'dono-' + (dono === 'meu' || dono === 'aliado' ? dono : 'desconhecido'); }
  var ICONE_MARCHA = { carregadores: 'madeira', mensageiro: 'mensagem', caravana: 'carroca' };
  function iconeMarcha(o) {
    var t = String(o.marcha || ''), def = RP.mapa.tiposMarcha[t];
    if (def && def.icone) return def.icone;
    if (ICONE_MARCHA[t]) return ICONE_MARCHA[t];
    if (/batedor/.test(t)) return 'batedor';
    if (/explor|prospector/.test(t)) return 'explorador';
    if (/caca/.test(t)) return 'lobo';
    if (/extra|escava/.test(t)) return 'picareta';
    return 'tropas';
  }
  function curvaPts(p) {
    if (p.length < 2) return '';
    var dd = 'M' + n1(p[0].x) + ' ' + n1(p[0].y), i, p0, p1, p2, p3;
    for (i = 0; i < p.length - 1; i++) {
      p0 = p[i - 1] || p[i]; p1 = p[i]; p2 = p[i + 1]; p3 = p[i + 2] || p2;
      dd += 'C' + n1(p1.x + (p2.x - p0.x) / 6) + ' ' + n1(p1.y + (p2.y - p0.y) / 6) + ' ' + n1(p2.x - (p3.x - p1.x) / 6) + ' ' + n1(p2.y - (p3.y - p1.y) / 6) + ' ' + n1(p2.x) + ' ' + n1(p2.y);
    }
    return dd;
  }
  function restoCaminho(o, pos) {
    var cm = o.caminho || [], pts = [{ x: pos.x, y: pos.y }];
    for (var i = pos.i + 1; i < cm.length; i++) pts.push(H.centroH(cm[i]));
    return curvaPts(pts);
  }
  function revelada() { return true; }   /* toda marcha tem dono à vista */

  function svgLocal(o, ameacado) {
    var p = H.centroH(o.hex), castelo = o.local === 'castelo', meu = o.dono === 'meu';
    if (o.ruina || o.dono === 'livre') {
      return '<g class="ent ruina" data-k="' + o._k + '" transform="translate(' + n1(p.x) + ' ' + n1(p.y) + ')"><circle class="ponto" r="5"/><g class="ent-k"><circle class="alvo-toque" r="22"/><circle class="ru-base" r="14"/>' +
        '<use href="#i-' + (o.ruina ? 'escombros' : 'estaca') + '" x="-9.5" y="-10" width="19" height="19"/>' + rotuloSvg(o.ruina ? 'Ruína' : 'Terra livre', 29) + '</g></g>';
    }
    var h = '<g class="ent local' + (castelo ? ' castelo' : '') + ' ' + classeDono(o.dono) + (ameacado ? ' ameacado' : '') + '" data-k="' + o._k + '" transform="translate(' + n1(p.x) + ' ' + n1(p.y) + ')">' +
      '<circle class="ponto" r="' + (castelo ? 9 : 6) + '"/><g class="ent-k"><circle class="alvo-toque" r="24"/>';
    if (ameacado) h += '<circle class="anel-ameaca" r="' + (castelo ? 27 : 21) + '"/>';
    if (castelo) {
      var r = RP.reino, dono = meu && r ? r : o.reino, brasao;
      if (dono && dono.iconeProprio) brasao = '<image href="/api/v1/reinos/' + dono.id + '/icone?v=' + (dono.iconeVersao || 0) + '" width="20" height="20"/>';
      else brasao = RP.brasao(dono ? dono.brasao : o.brasao, { tamanho: 20 });
      h += '<circle class="lc-base" r="21"/><circle class="lc-anel" r="16.5"/><use href="#i-castelo" x="-13" y="-14" width="26" height="26"/>' +
        '<g transform="translate(9 -30)">' + brasao + '</g>' + rotuloSvg(meu && r ? r.nome : o.reino ? o.reino.nome : 'Castelo', 38, 'rotulo-castelo');
    } else {
      h += '<circle class="lc-base" r="15"/><use href="#i-' + RP.iconeLocal({ tipo: o.local }) + '" x="-10" y="-10.5" width="20" height="20"/>' + rotuloSvg(o.nome || '', 30);
      if (o.nivel) h += '<g class="lc-nivel" transform="translate(12 -12)"><circle r="7.5"/><text y="3.5">' + o.nivel + '</text></g>';
    }
    /* quantas pessoas suas estão aqui (um marcador por grupo, com o número) */
    var np = meu && M.dados && M.dados.pessoasPorHex && M.dados.pessoasPorHex[o.hex] ? M.dados.pessoasPorHex[o.hex].length : 0;
    if (np) h += '<g class="lc-pessoas" transform="translate(' + (castelo ? -18 : -12) + ' 12)"><circle r="7.5"/><text y="3.2">' + np + '</text></g>';
    if (o.reliquia) h += '<g class="relq-badge tipo-' + (o.reliquia.tipo || 'desconhecido') + '" transform="translate(' + (castelo ? -17 : -12) + ' ' + (castelo ? -15 : -11) + ')"><circle r="8"/><use href="#i-lendario" x="-6" y="-6" width="12" height="12"/></g>';
    return h + '</g></g>';
  }
  function svgJazida(o, antigo) {
    var p = H.centroH(o.hex), ruina = o.tipo === 'ruina-antiga', lend = ruina || o.recurso === 'minerio';
    var ic = ruina ? 'ruina' : o.recurso, nome = ruina ? (o.esgotada ? 'Ruína escavada' : 'Ruína antiga') : (RP.NOMES_REC[o.recurso] || o.recurso);
    return '<g class="ent jazida ' + (lend ? 'lendario' : 'valioso') + (antigo || o.esgotada ? ' antigo' : '') + '" data-k="' + o._k + '" transform="translate(' + n1(p.x) + ' ' + n1(p.y) + ')">' +
      '<circle class="ponto" r="5"/><g class="ent-k"><circle class="alvo-toque" r="22"/>' +
      (lend && !o.esgotada ? '<circle class="brilho-lendario" r="20"/>' : '') +
      '<rect class="jz-base" x="-12" y="-12" width="24" height="24" rx="4" transform="rotate(45)"/>' +
      '<use class="r-' + (ruina ? 'lendario' : o.recurso) + '" href="#i-' + ic + '" x="-9.5" y="-9.5" width="19" height="19"/>' + rotuloSvg(nome, 31) +
      (antigo ? '<g class="selo-antigo-mapa" transform="translate(11 10)"><circle r="7.5"/><use href="#i-relogio" x="-6" y="-6" width="12" height="12"/></g>' : '') + '</g></g>';
  }
  function svgGenerico(o, tipo, info) {
    var p = tipo && tipo.pos ? tipo.pos(o, performance.now() / 1000) : H.centroH(o.hex);
    var dentro;
    if (tipo && tipo.svgTatico) { try { dentro = tipo.svgTatico(o, info); } catch (e) { console.error(e); dentro = ''; } }
    else dentro = '<circle class="gen-base" r="13"/><use href="#i-' + (tipo && tipo.icone ? tipo.icone(o) : 'interrogacao') + '" x="-9" y="-9" width="18" height="18"/>' + rotuloSvg(o.nome || o.rotulo || o.tipo, 28);
    if (!dentro) return '';
    var extra = tipo && tipo.classe ? ' ' + tipo.classe(o, info) : '';
    return '<g class="ent obj-' + String(o.tipo).replace(/[^a-z0-9-]/gi, '') + extra + (info.antigo ? ' antigo' : '') + '" data-k="' + o._k + '"' + (tipo && tipo.pos ? ' data-movel="' + o._k + '"' : '') + ' transform="translate(' + n1(p.x) + ' ' + n1(p.y) + ')">' +
      '<circle class="ponto" r="5"/><g class="ent-k"><circle class="alvo-toque" r="22"/>' + dentro + '</g></g>';
  }
  function svgMarcha(o, pos, agora) {
    var rev = revelada(o), cls = classeDono(o.dono) + (rev ? '' : ' hostil'), expl = /explor|batedor|prospector|mensageiro/.test(String(o.marcha || ''));
    var r = expl ? 12 : 15, ic = iconeMarcha(o), cheg = M.chegadaConhecida(o);
    return '<g class="ent marcha ' + cls + (expl ? ' explorador' : '') + '" data-k="' + o._k + '" data-marcha="' + o._k + '" transform="translate(' + n1(pos.x) + ' ' + n1(pos.y) + ')">' +
      '<g class="ent-k"><circle class="alvo-toque" r="24"/>' + (rev ? '' : '<circle class="anel-ameaca" r="' + (r + 6) + '"/>') +
      '<circle class="mc-base" r="' + r + '"/><use href="#i-' + ic + '" x="' + (-r * 0.66) + '" y="' + (-r * 0.66) + '" width="' + (r * 1.32) + '" height="' + (r * 1.32) + '"/>' +
      (rev ? '' : '<g class="mc-selo" transform="translate(12 -12)"><circle r="8"/><text y="4.5">?</text></g>') +
      (o.reliquia ? '<g class="relq-badge tipo-' + (o.reliquia.tipo || 'desconhecido') + '" transform="translate(-14 13)"><circle r="8"/><use href="#i-lendario" x="-6" y="-6" width="12" height="12"/></g>' : '') +
      (cheg && cheg > agora ? '<g class="mc-eta" transform="translate(0 ' + (r + 13) + ')"><rect x="-26" y="-10" width="52" height="20" rx="10"/><text y="4.5" data-fim="' + cheg + '">' + RP.fmtResta(cheg - agora) + '</text></g>' : '') +
      '</g></g>';
  }

  /* reconstrói os marcadores (dados novos, camadas, fundar); posições de marchas andam em atualizarMoveis */
  TP.atualizarSvg = function () {
    var d = M.dados, MAPA = RP.mapa, cam = MAPA.camadas, agora = RP.agora();
    if (!d) { this.g.innerHTML = ''; return; }
    var fundo = '', rotas = '', ruinas = '', jazidas = '', locais = '', outros = '', marchas = '';
    var meusHex = {}, ameacados = {};
    d.objs.forEach(function (o) { if (o.tipo === 'local' && o.dono === 'meu') meusHex[o.hex] = true; });
    d.objs.forEach(function (o) {
      var e = M.estado(o.hex), tipo = MAPA.tiposObjeto[o.tipo];
      if (e.v === 'desconhecido' && !(tipo && tipo.atravessaNevoa)) return;
      var antigo = e.v === 'explorado';
      if (o.tipo === 'local') { if (o.ruina || o.dono === 'livre') ruinas += svgLocal(o); else locais += svgLocal(o, ameacados[o.hex]); return; }
      if (o.tipo === 'jazida' || o.tipo === 'ruina-antiga') { if (o.tipo === 'ruina-antiga' || cam.recursos !== false) jazidas += svgJazida(o, antigo); return; }
      if (tipo && tipo.camada && cam[tipo.camada] === false) return;
      var info = { antigo: antigo, estado: e, agora: agora };
      if (tipo && tipo.svgFundo) { try { fundo += tipo.svgFundo(o, info) || ''; } catch (er) { console.error(er); } }
      outros += svgGenerico(o, tipo, info);
    });
    /* fundações na fila: estaca no hexágono escolhido */
    ((RP.reino && RP.reino.filas && RP.reino.filas.obras) || []).forEach(function (it) {
      if (it.localId || it.hex == null || it.tipo !== 'fundar') return;
      var p = H.centroH(it.hex);
      ruinas += '<g class="ent ruina obra-fundar" transform="translate(' + n1(p.x) + ' ' + n1(p.y) + ')"><circle class="ponto" r="5"/><g class="ent-k"><circle class="alvo-toque" r="20"/><circle class="ru-base" r="13"/>' +
        '<use href="#i-martelo" x="-9" y="-9" width="18" height="18"/>' + rotuloSvg(it.rotulo || 'Fundação', 28) + '</g></g>';
    });
    if (cam.marchas !== false) d.marchas.forEach(function (m) {
      var pos = M.posMarcha(m, agora), cheg = M.chegada(m);
      if (M.sumiu(m, agora)) return;
      if (!M.marchaVisivel(m, pos)) return;
      var cls = classeDono(m.dono) + (revelada(m) ? '' : ' hostil'), fim = m.caminho && m.caminho.length ? H.centroH(m.caminho[m.caminho.length - 1]) : pos;
      if (m.dono === 'meu') rotas += '<path class="marcha-rota ' + cls + '" data-rota="' + m._k + '" d="' + restoCaminho(m, pos) + '"/><circle class="marcha-destino ' + cls + '" cx="' + n1(fim.x) + '" cy="' + n1(fim.y) + '" r="7"/>';
      marchas += svgMarcha(m, pos, agora);
    });
    var fundar = this.fundar ? this.svgFundar() : '';
    this.g.innerHTML = '<g class="camada-fundo">' + fundo + '</g><g class="camada-fundar">' + fundar + '</g><g class="camada-marcha-rotas">' + rotas + '</g>' +
      '<polygon class="selecao" hidden points="0,0"/>' +
      '<g class="camada-ruinas">' + ruinas + '</g><g class="camada-jazidas">' + jazidas + '</g><g class="camada-locais">' + locais + '</g>' +
      '<g class="camada-objetos">' + outros + '</g><g class="camada-marchas">' + marchas + '</g>';
    this.svg.classList.toggle('sem-rotulos', cam.rotulos === false);
    this.versaoSvg = M.versao;
    this.mostrarSelecao();
    this.aplicarSvg();
  };
  /* hexágonos onde o tipo escolhido pode ser fundado (o servidor confirma ao tocar) */
  TP.svgFundar = function () {
    var d = M.dados, r = RP.reino, f = r && r.fundaveis && r.fundaveis[this.fundar], dd = '';
    if (!d || !f) return '';
    var n = H.COLS * H.LINS, emFila = {};
    ((r.filas && r.filas.obras) || []).forEach(function (it) { if (it.tipo === 'fundar') H.pegada(it.hex, 3).forEach(function (x) { emFila[x] = true; }); });
    /* a construção ocupa a pegada inteira (P.ocupa: 7, 3 ou 1 hexágonos): todos precisam ser conhecidos, sem rio e livres */
    function livre(x) { return d.idade[x] >= 0 && !d.rio[x] && !(d.porHex[x] && d.porHex[x].length) && !emFila[x]; }
    for (var h = 0; h < n; h++) {
      if (d.idade[h] < 0 || f.terrenos.indexOf(d.ter[h]) < 0) continue;
      var pg = H.pegada(h, f.ocupa || 1);
      if (pg.length < (f.ocupa || 1) || !pg.every(livre)) continue;
      var p = H.centroH(h);
      dd += 'M' + H.cantos(p.x, p.y, H.R - 3).split(' ').join('L') + 'Z';
    }
    return '<path class="fundar-ok" d="' + dd + '"/>';
  };
  TP.definirFundar = function (tipo) { this.fundar = tipo || null; if (this.ativo) this.atualizarSvg(); };
  TP.selecionar = function (h) { this.selecao = h == null ? -1 : h; this.mostrarSelecao(); };
  TP.mostrarSelecao = function () {
    var sel = this.g.querySelector('.selecao');
    if (!sel) return;
    if (this.selecao < 0) { sel.setAttribute('hidden', ''); return; }
    var p = H.centroH(this.selecao);
    sel.setAttribute('points', H.cantos(p.x, p.y, H.R - 1.5));
    sel.removeAttribute('hidden');
  };
  /* marchas e objetos móveis andam a cada segundo; quem sai da área vista some */
  TP.atualizarMoveis = function () {
    var d = M.dados; if (!d || !this.ativo) return;
    if (this.versaoSvg !== M.versao || this.versaoMoveis !== M.versaoMoveis) { this.versaoMoveis = M.versaoMoveis; this.atualizarSvg(); return; }
    var agora = RP.agora(), g = this.g, MAPA = RP.mapa;
    d.marchas.forEach(function (m) {
      var el = g.querySelector('[data-marcha="' + m._k + '"]');
      if (!el) return;
      var pos = M.posMarcha(m, agora), vis = M.marchaVisivel(m, pos) && !M.sumiu(m, agora);
      el.style.display = vis ? '' : 'none';
      el.setAttribute('transform', 'translate(' + n1(pos.x) + ' ' + n1(pos.y) + ')');
      var rt = g.querySelector('[data-rota="' + m._k + '"]');
      if (rt) { rt.style.display = vis ? '' : 'none'; rt.setAttribute('d', restoCaminho(m, pos)); }
    });
    Array.prototype.forEach.call(g.querySelectorAll('[data-movel]'), function (el) {
      var o = d.objetos[+el.getAttribute('data-movel')], tp = o && MAPA.tiposObjeto[o.tipo];
      if (!tp || !tp.pos) return;
      var p = tp.pos(o, performance.now() / 1000);
      if (p) el.setAttribute('transform', 'translate(' + n1(p.x) + ' ' + n1(p.y) + ')');
    });
  };

  Tatico.SMIN = SMIN; Tatico.SMAX = SMAX;
  RP.Tatico = Tatico;
  /* contorno (arestas de fronteira) de um conjunto de hexágonos, como caminho SVG: alcance de torres, áreas */
  function contorno(hexes) {
    var dentro = {}, dd = '';
    hexes.forEach(function (h) { dentro[h] = true; });
    hexes.forEach(function (h) {
      var p = H.centroH(h);
      vizinhosComDirecao(h).forEach(function (v) {
        if (v.h >= 0 && dentro[v.h]) return;
        var ar = ARESTA[v.i], a = cantoXY(p.x, p.y, ar[0]), b = cantoXY(p.x, p.y, ar[1]);
        dd += 'M' + n1(a[0]) + ' ' + n1(a[1]) + 'L' + n1(b[0]) + ' ' + n1(b[1]);
      });
    });
    return dd;
  }
  /* hexágonos a até r passos de h */
  function noRaio(h, r) {
    var out = [], c = H.c(h), l = H.l(h);
    for (var ll = l - r; ll <= l + r; ll++) for (var cc = c - r - 1; cc <= c + r + 1; cc++) {
      if (!H.dentro(cc, ll)) continue;
      var x = H.idx(cc, ll);
      if (H.dist(h, x) <= r) out.push(x);
    }
    return out;
  }
  RP.mapaTatico = { iconeMarcha: iconeMarcha, revelada: revelada, classeDono: classeDono, rotuloSvg: rotuloSvg, tokens: tokens, hexPath: hexPath, contorno: contorno, noRaio: noRaio, n1: n1 };
})();
