/* Reino de Pedra — "Vista": cena imersiva 2.5D do mundo (câmera alta e inclinada), portada de prototipo/js/cena.js
   e alimentada pelos dados reais (RP.mapaModelo). Mesmas coordenadas, mesma névoa e mesmos objetos do Mapa tático.

   Camadas:
     cache estático  chão, rios, estradas, pontes, vegetação, relevo e bancos de névoa (refeito ao sair da área coberta,
                     ao mudar o zoom ou quando chegam dados novos)
     quadro animado  construções, pessoas, tropas, animais, fumaça, brilho do rio, névoa à deriva, rótulos
   Desempenho: desenha só o visível, no máximo ~30 quadros/s, pausa com a aba oculta e quando a tela sai. */
(function () {
  'use strict';
  var RP = window.RP, H = RP.hex, A = RP.arte, M = RP.mapaModelo;
  var K = A.K, P = A.P, PA = A.PA;
  var SMIN = 0.85, SMAX = 3.2, QUADRO_MS = 33;

  /* uma única escuta de visibilidade para todas as cenas (sem vazamento por instância) */
  var ativas = [];
  document.addEventListener('visibilitychange', function () {
    ativas.forEach(function (c) { if (document.hidden) c.pausar(); else c.continuar(); });
  });
  /* inclinação da câmera: K vem da arte e muda quando o jogador inclina (lembrada no aparelho) */
  A.aoMudarK.push(function (k) { K = k; ativas.forEach(function (c) { c.invalidar(); }); });
  /* a vegetação 3D ficou pronta (ou foi refeita): o cache do chão é refeito com ela */
  document.addEventListener('rp:natureza', function () { ativas.forEach(function (c) { c.invalidar(); }); });
  var kSalvo = parseFloat(RP.pref('inclinacao'));
  if (isFinite(kSalvo) && kSalvo > 0) A.definirK(kSalvo);

  function Cena(cv, opt) {
    this.cv = cv; this.ctx = cv.getContext('2d'); this.opt = opt || {};
    this.cam = { x: H.LARGURA / 2, y: H.ALTURA / 2, s: 1.7 };
    this.w = 0; this.h = 0; this.dpr = 1;
    this.cache = document.createElement('canvas'); this.cctx = this.cache.getContext('2d'); this.ci = null;
    this.rodando = false; this.raf = 0; this.anim = 0; this.alvos = []; this.gesto = false; this.ultimaMudanca = 0;
    this.vida = null; this.chaveVida = '';
    if (this.opt.interativa) this.ligarGestos();
    else if (this.opt.tocavel) this.ligarToqueSimples();
    observarTamanho(this);
  }
  var C = Cena.prototype;

  /* o canvas muda de tamanho sem 'resize' da janela (a coluna do painel abre com transição): mede de novo
     sempre que o elemento muda, para que o toque e o desenho usem a mesma largura e altura */
  function observarTamanho(cena) {
    if (!window.ResizeObserver) return;
    new ResizeObserver(function () {
      var w = cena.w, h = cena.h;
      cena.redimensionar();
      if ((w !== cena.w || h !== cena.h) && cena.rodando) cena.quadro(performance.now());
    }).observe(cena.cv);
  }

  /* ---------------------------------------------------------------- câmera */
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
  C.mudou = function () {
    this.limitar(); this.ultimaMudanca = performance.now();
    if (this.opt.aoMover) this.opt.aoMover();
    if (!this.rodando) this.quadro(performance.now());
  };
  /* fy: fração da altura onde o ponto fica (0,3 quando há folha aberta) */
  C.centrar = function (wx, wy, s, fy, animar) {
    this.redimensionar();
    s = Math.max(SMIN, Math.min(SMAX, s || this.cam.s));
    fy = fy == null ? 0.5 : fy;
    var alvo = { s: s, x: wx, y: wy - (this.h * fy - this.h / 2) / (K * s) };
    if (animar === false || !this.rodando) { cancelAnimationFrame(this.anim); this.cam = alvo; this.mudou(); return; }
    this.animarPara(alvo, 380);
  };
  C.animarPara = function (alvo, dur) {
    var self = this, ini = { x: this.cam.x, y: this.cam.y, s: this.cam.s }, t0 = performance.now();
    cancelAnimationFrame(this.anim);
    (function passo(t) {
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      self.cam = { x: ini.x + (alvo.x - ini.x) * e, y: ini.y + (alvo.y - ini.y) * e, s: ini.s + (alvo.s - ini.s) * e };
      self.mudou();
      if (p < 1 && self.rodando) self.anim = requestAnimationFrame(passo);
    })(t0);
  };
  C.zoomBotao = function (f) {
    var ns = this.cam.s * f;
    if (ns < SMIN * 0.95 && this.opt.aoAfastarDemais) { this.opt.aoAfastarDemais(); return; }
    this.animarPara({ x: this.cam.x, y: this.cam.y, s: Math.max(SMIN, Math.min(SMAX, ns)) }, 240);
  };
  /* inclina a câmera (k = achatamento do chão; null volta ao padrão). Devolve true se ficou no padrão. */
  C.inclinar = function (k) {
    var novo = k == null ? A.K_PADRAO : Math.max(A.K_MIN, Math.min(A.K_MAX, k));
    if (Math.abs(novo - A.K) > 1e-4) { A.definirK(novo); RP.pref('inclinacao', String(novo)); }
    if (!this.rodando) this.quadro(performance.now());
    return Math.abs(novo - A.K_PADRAO) < 1e-4;
  };
  C.inclinarPor = function (dyPx) { this.inclinar(A.K - dyPx * 0.0028); };
  C.ligarGestos = function () {
    var self = this, p0 = null, avisado = false, lacando = false, ponto = null;
    function modoSel() { return !!(self.opt.modoSelecao && self.opt.modoSelecao()); }
    RP.gestos(this.cv, {
      inicio: function () { cancelAnimationFrame(self.anim); self.gesto = true; avisado = false; lacando = modoSel(); ponto = null; },
      inicioPinca: function () { p0 = { x: self.cam.x, y: self.cam.y, s: self.cam.s }; lacando = false; self.laco = null; },
      inclinar: function (dy) { self.inclinarPor(dy); },
      /* no modo seleção (ou com Shift), arrastar desenha um laço em vez de mover a câmera */
      arrasto: function (dx, dy) {
        if (lacando) {
          ponto = ponto ? { x: ponto.x + dx, y: ponto.y + dy } : null;
          if (!ponto) { ponto = self.ultimoToque || { x: self.w / 2, y: self.h / 2 }; ponto = { x: ponto.x + dx, y: ponto.y + dy }; }
          (self.laco = self.laco || []).push({ x: ponto.x, y: ponto.y });
          if (!self.rodando) self.quadro(performance.now());
          return;
        }
        self.cam.x -= dx / self.cam.s; self.cam.y -= dy / (K * self.cam.s); self.mudou();
      },
      toqueLongo: function (x, y) { if (self.opt.aoToqueLongo) self.opt.aoToqueLongo(x, y); },
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
      fim: function () {
        self.gesto = false; self.ultimaMudanca = performance.now();
        if (self.laco && self.laco.length > 2 && self.opt.aoLaco) self.opt.aoLaco(self.laco);
        self.laco = null; lacando = false;
      }
    });
    /* o laço começa onde o dedo pousou */
    this.cv.addEventListener('pointerdown', function (e) { var r = self.cv.getBoundingClientRect(); self.ultimoToque = { x: e.clientX - r.left, y: e.clientY - r.top }; });
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
  /* O toque vale para o hexágono sob o ponteiro. A caixa de um objeto (castelo alto, marcha) passa da borda do
     hexágono dele; ela só ganha quando o objeto está no hexágono tocado, ou quando o toque cai no próprio objeto
     (marcha, que fica entre hexágonos) ou em hexágono sem nada. Ao escolher destino (opt.escolhendoHex), nunca
     troca o hexágono tocado pelo vizinho. */
  C.tocar = function (x, y) {
    if (!this.opt.aoTocar) return;
    var w0 = this.w, h0 = this.h;
    this.redimensionar();
    if (w0 !== this.w || h0 !== this.h) this.quadro(performance.now()); /* refaz os alvos na medida nova */
    var w = this.mundo(x, y), h = H.pixelParaHex(w.x, w.y), a = this.alvoEm(x, y, h);
    if (a) { this.opt.aoTocar({ ent: a.ent, obj: a.obj, hex: a.hex }); return; }
    if (h >= 0) this.opt.aoTocar({ hex: h });
  };
  C.alvoEm = function (x, y, h) {
    var dentro = [], i, a;
    for (i = this.alvos.length - 1; i >= 0; i--) {
      a = this.alvos[i];
      if (x >= a.x0 && x <= a.x1 && y >= a.y0 && y <= a.y1) dentro.push(a);
    }
    if (!dentro.length) return null;
    for (i = 0; i < dentro.length; i++) if (dentro[i].hex === h) return dentro[i];
    for (i = 0; i < dentro.length; i++) if (dentro[i].ent && dentro[i].ent[0] === 'marcha' && dentro[i].perto(x, y)) return dentro[i];
    var escolhendo = this.opt.escolhendoHex && this.opt.escolhendoHex();
    if (escolhendo || this.temAlvoNoHex(h)) return null;
    return dentro[0];
  };
  C.temAlvoNoHex = function (h) {
    for (var i = 0; i < this.alvos.length; i++) if (this.alvos[i].hex === h) return true;
    return false;
  };

  /* ---------------------------------------------------------------- laço (≤ 30 quadros/s) */
  C.iniciar = function () {
    if (this.rodando) return;
    this.rodando = true; this.redimensionar();
    if (ativas.indexOf(this) < 0) ativas.push(this);
    this.continuar();
  };
  C.continuar = function () {
    var self = this, ultimo = 0;
    cancelAnimationFrame(this.raf);
    if (!this.rodando || document.hidden) return;
    (function laco(t) {
      if (!self.rodando || document.hidden) return;
      self.raf = requestAnimationFrame(laco);
      if (t - ultimo < QUADRO_MS) return;
      ultimo = t;
      self.quadro(t);
    })(performance.now());
  };
  C.pausar = function () { cancelAnimationFrame(this.raf); this.raf = 0; };
  C.parar = function () {
    this.rodando = false; cancelAnimationFrame(this.raf); cancelAnimationFrame(this.anim); this.raf = 0;
    var i = ativas.indexOf(this); if (i >= 0) ativas.splice(i, 1);
  };
  /* força o redesenho do chão (dados novos) */
  C.invalidar = function () { this.ci = null; this.vida = null; if (!this.rodando) this.quadro(performance.now()); };

  /* ---------------------------------------------------------------- cache estático */
  C.precisaCache = function () {
    var r = this.ci;
    if (!r || r.versao !== M.versao) return true;
    var v = this.retanguloMundo();
    if (v.x < r.x || v.y < r.y || v.x + v.w > r.x + r.w || v.y + v.h > r.y + r.h) return true;
    var rel = this.cam.s / r.s;
    return !this.gesto && (rel > 1.12 || rel < 0.9) && performance.now() - this.ultimaMudanca > 160;
  };
  C.construirCache = function () {
    var s = this.cam.s, MG = 0.45;
    var cw = this.w * (1 + 2 * MG), ch = this.h * (1 + 2 * MG);
    var dprC = Math.min(this.dpr, Math.sqrt(9e6 / (cw * ch)));
    this.cache.width = Math.round(cw * dprC); this.cache.height = Math.round(ch * dprC);
    var rw = cw / s, rh = ch / (K * s);
    var r = { x: this.cam.x - rw / 2, y: this.cam.y - rh / 2, w: rw, h: rh, s: s, cw: cw, ch: ch, versao: M.versao };
    this.ci = r;
    var S = s * dprC;
    desenharEstatico(this.cctx, { S: S, ox: -r.x * S, oy: -r.y * S * K, pw: this.cache.width, ph: this.cache.height }, r, this.opt.camadas || RP.mapa.camadas || {});
  };

  function chao(c, V) { c.setTransform(V.S, 0, 0, V.S * K, V.ox, V.oy); }
  function obj(c, V, x, y) { c.setTransform(V.S, 0, 0, V.S, V.ox + x * V.S, V.oy + y * V.S * K); }
  function hexesNoRetangulo(r, margem) {
    var c0 = Math.max(0, Math.floor(r.x / H.W) - margem), c1 = Math.min(H.COLS - 1, Math.ceil((r.x + r.w) / H.W) + margem);
    var l0 = Math.max(0, Math.floor(r.y / H.VS) - margem), l1 = Math.min(H.LINS - 1, Math.ceil((r.y + r.h) / H.VS) + margem + 2);
    var out = [];
    for (var l = l0; l <= l1; l++) for (var c = c0; c <= c1; c++) out.push(H.idx(c, l));
    return out;
  }
  function ocupado(h) { return M.objetosEm(h).length > 0; }
  function corChao(t, c, l, pal) { var arr = pal[t] || pal.planicie; return arr[Math.floor(A.hash(c, l, 3) * arr.length) % arr.length]; }
  function hexagono(c, x, y, r) {
    c.beginPath();
    for (var i = 0; i < 6; i++) { var a = (Math.PI / 180) * (60 * i - 30); c.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); }
    c.closePath();
  }
  /* direção da estrada num hexágono (para a ponte): pelos vizinhos com rota */
  function anguloRota(h) {
    var ce = H.centroH(h), vs = H.vizinhos(h).filter(function (v) { return M.rota(v); });
    if (!vs.length) return 0;
    var a = H.centroH(vs[0]), b = vs[1] != null ? H.centroH(vs[1]) : ce;
    if (vs.length === 1) return Math.atan2(a.y - ce.y, a.x - ce.x);
    return Math.atan2(b.y - a.y, b.x - a.x);
  }
  /* ponte: segue a estrada; sem estrada dos lados, atravessa o rio (perpendicular ao curso) */
  function anguloPonte(h) {
    if (H.vizinhos(h).some(function (v) { return M.rota(v); })) return anguloRota(h);
    var d = M.dados, ce = H.centroH(h), rs = H.vizinhos(h).filter(function (v) { return d.rio[v]; });
    if (!rs.length) return 0;
    var a = H.centroH(rs[0]), b = rs[1] != null ? H.centroH(rs[1]) : ce;
    return (rs.length === 1 ? Math.atan2(a.y - ce.y, a.x - ce.x) : Math.atan2(b.y - a.y, b.x - a.x)) + Math.PI / 2;
  }

  function desenharEstatico(c, V, r, camadas) {
    var d = M.dados;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = P.nevoa; c.fillRect(0, 0, V.pw, V.ph);
    if (!d) return;
    /* E: escala dos detalhes pelo tamanho do hexágono (a arte foi feita para R = 30; desde a decisão 0026, R = 15) */
    var E = H.R / 30, hexes = hexesNoRetangulo(r, 4), conhecidos = [], itens = [];
    hexes.forEach(function (h) {
      var e = M.estado(h);
      if (e.v === 'desconhecido') return;
      conhecidos.push({ h: h, c: H.c(h), l: H.l(h), e: e, pal: e.v === 'explorado' ? PA : P, t: d.ter[h], rio: d.rio[h], ce: H.centroH(h) });
    });
    /* chão */
    chao(c, V);
    conhecidos.forEach(function (x) { c.fillStyle = corChao(x.t, x.c, x.l, x.pal); hexagono(c, x.ce.x, x.ce.y, H.R + 2); c.fill(); });
    var ORDEM = { planicie: 0, pantano: 2, colina: 3, floresta: 4, montanha: 5 };
    conhecidos.slice().sort(function (a, b) { return ORDEM[a.t] - ORDEM[b.t]; }).forEach(function (x) {
      c.fillStyle = corChao(x.t, x.c, x.l, x.pal);
      for (var i = 0; i < 4; i++) {
        var a = A.hash(x.c, x.l, 40 + i) * 6.28, dd = H.R * (0.55 + A.hash(x.c, x.l, 50 + i) * 0.35);
        c.beginPath(); c.arc(x.ce.x + Math.cos(a) * dd, x.ce.y + Math.sin(a) * dd, H.R * (0.38 + A.hash(x.c, x.l, 60 + i) * 0.2), 0, 6.2832); c.fill();
      }
    });
    /* transição entre terrenos: uma mancha da cor do vizinho sobre a aresta compartilhada, dos dois lados */
    var porH = {}; conhecidos.forEach(function (x) { porH[x.h] = x; });
    c.globalAlpha = 0.28;
    conhecidos.forEach(function (x) {
      if (x.rio) return;
      H.vizinhos(x.h).forEach(function (v) {
        var y = porH[v]; if (!y || y.rio || y.t === x.t || v < x.h) return;
        var mx = (x.ce.x + y.ce.x) / 2, my = (x.ce.y + y.ce.y) / 2;
        c.fillStyle = corChao(y.t, y.c, y.l, y.pal); c.beginPath(); c.ellipse(mx, my, H.R * 0.5, H.R * 0.42, 0, 0, 6.2832); c.fill();
        c.fillStyle = corChao(x.t, x.c, x.l, x.pal); c.beginPath(); c.ellipse(mx, my, H.R * 0.34, H.R * 0.28, 0, 0, 6.2832); c.fill();
      });
    });
    c.globalAlpha = 1;
    /* detalhes do chão */
    conhecidos.forEach(function (x) {
      var pal = x.pal, i, px, py;
      if (x.t === 'planicie') {
        for (i = 0; i < 3; i++) {
          px = x.ce.x + (A.hash(x.c, x.l, 70 + i) - 0.5) * H.W * 0.9; py = x.ce.y + (A.hash(x.c, x.l, 80 + i) - 0.5) * H.R * 1.4;
          c.fillStyle = i % 3 ? pal.grama : pal.grama2; c.fillRect(px, py, 2.2, 2.2);
        }
        if (A.hash(x.c, x.l, 90) > 0.6) for (i = 0; i < 4; i++) { c.fillStyle = [pal.flor1, pal.flor2, pal.flor3][i % 3]; c.fillRect(x.ce.x + (A.hash(x.c, x.l, 91 + i) - 0.5) * 30 * E, x.ce.y + (A.hash(x.c, x.l, 95 + i) - 0.5) * 24 * E, 1.6, 1.6); }
      } else if (x.t === 'pantano') {
        for (i = 0; i < 2; i++) {
          px = x.ce.x + (A.hash(x.c, x.l, 100 + i) - 0.5) * 34 * E; py = x.ce.y + (A.hash(x.c, x.l, 104 + i) - 0.5) * 28 * E;
          c.fillStyle = pal.poca; c.beginPath(); c.ellipse(px, py, (7 + i * 2) * E * 1.4, (5 + i) * E * 1.4, 0, 0, 6.2832); c.fill();
          c.fillStyle = pal.pocaLuz; c.beginPath(); c.ellipse(px - 2 * E, py - 1.5 * E, 3 * E * 1.4, 1.4 * E * 1.4, 0, 0, 6.2832); c.fill();
        }
      } else if (x.t === 'floresta') {
        c.fillStyle = pal.folhaSombra; c.globalAlpha = 0.35;
        c.beginPath(); c.arc(x.ce.x, x.ce.y, H.R * 0.8, 0, 6.2832); c.fill(); c.globalAlpha = 1;
      }
    });
    /* grade de hexágonos (camada opcional) */
    if (camadas && camadas.grade) {
      c.strokeStyle = 'rgba(16,20,26,.3)'; c.lineWidth = 1.1; c.lineJoin = 'round';
      conhecidos.forEach(function (x) { hexagono(c, x.ce.x, x.ce.y, H.R - 0.5); c.stroke(); });
    }
    /* rios e estradas (só sobre o que é conhecido) */
    c.lineCap = 'round'; c.lineJoin = 'round';
    /* rio em camadas: margem de terra úmida, borda rasa clara, água, canal fundo escuro no meio e reflexos */
    c.strokeStyle = 'rgba(92,78,50,0.5)'; c.lineWidth = 31 * E * 1.2; c.stroke(d.curvaRios);
    c.strokeStyle = 'rgba(120,150,96,0.45)'; c.lineWidth = 27 * E * 1.2; c.stroke(d.curvaRios);
    c.strokeStyle = P.aguaMargem; c.lineWidth = 23 * E * 1.2; c.stroke(d.curvaRios);
    c.strokeStyle = P.agua; c.lineWidth = 17 * E * 1.2; c.stroke(d.curvaRios);
    c.strokeStyle = 'rgba(22,58,98,.42)'; c.lineWidth = 9 * E * 1.2; c.stroke(d.curvaRios);
    c.strokeStyle = 'rgba(16,44,78,.35)'; c.lineWidth = 4 * E * 1.2; c.stroke(d.curvaRios);
    c.setLineDash([3, 11]); c.strokeStyle = 'rgba(220,240,255,.22)'; c.lineWidth = 1.4; c.stroke(d.curvaRios); c.setLineDash([]);
    c.strokeStyle = P.estradaBorda; c.lineWidth = 12 * E * 1.2; c.stroke(d.curvaRotas);
    c.strokeStyle = P.estrada; c.lineWidth = 8.5 * E * 1.2; c.stroke(d.curvaRotas);
    c.setLineDash([2, 7]); c.strokeStyle = 'rgba(90,70,40,.35)'; c.lineWidth = 1.2; c.stroke(d.curvaRotas); c.setLineDash([]);
    /* pontes (de madeira) e vaus (pedras), planos no chão */
    conhecidos.forEach(function (x) {
      if (!x.rio || !d.rotaH[x.h]) return;
      if (d.ponteH[x.h] && RP.natureza && RP.natureza.pronto) {
        /* ponte 3D em arco, de pedra, na direção da estrada: desenhada em pé, junto dos outros objetos */
        itens.push({ y: x.ce.y + 1, x: x.ce.x, f: 'ponte', ang: anguloPonte(x.h), pal: x.pal });
      } else if (d.ponteH[x.h]) {
        c.save(); c.translate(x.ce.x, x.ce.y); c.rotate(anguloPonte(x.h)); c.scale(E * 1.2, E * 1.2);
        c.fillStyle = P.madeiraEsc; c.fillRect(-20, -8, 40, 16); c.fillStyle = P.madeiraLuz; c.fillRect(-19, -6.5, 38, 13);
        c.strokeStyle = P.madeiraEsc; c.lineWidth = 0.8; for (var q = -16; q <= 16; q += 4) { c.beginPath(); c.moveTo(q, -6.5); c.lineTo(q, 6.5); c.stroke(); }
        c.restore();
      } else {
        [[-12, 4], [-4, -2], [4, 3], [12, -3]].forEach(function (p) { p = [p[0] * E, p[1] * E]; c.fillStyle = '#8f897f'; c.beginPath(); c.ellipse(x.ce.x + p[0], x.ce.y + p[1], 4.5, 3.4, 0, 0, 6.2832); c.fill(); c.fillStyle = '#b8b2a8'; c.beginPath(); c.ellipse(x.ce.x + p[0] - 1, x.ce.y + p[1] - 1, 2.5, 1.6, 0, 0, 6.2832); c.fill(); });
      }
    });

    /* vegetação e relevo (objetos em pé, ordenados por profundidade) */
    conhecidos.forEach(function (x) {
      if (x.rio) {
        /* na água: vitórias-régias, pedras e, raramente, uma canoa (nunca sobre a ponte ou o vau) */
        var hr = A.hash(x.c, x.l, 230), dx = (A.hash(x.c, x.l, 231) - 0.5) * 8 * E, dy = (A.hash(x.c, x.l, 232) - 0.5) * 5 * E;
        if (d.rotaH[x.h]) return;
        if (hr < 0.16) itens.push({ y: x.ce.y + dy, x: x.ce.x + dx, f: 'agua', s: 1, pal: x.pal });
        else if (hr < 0.24) itens.push({ y: x.ce.y + dy, x: x.ce.x + dx, f: 'pedraRio', s: 0.6, pal: x.pal });
        else if (hr > 0.985) itens.push({ y: x.ce.y, x: x.ce.x, f: 'canoa', s: 1, pal: x.pal });
        return;
      }
      /* margem: juncos e pedras do lado que dá para o rio */
      var vr = H.vizinhos(x.h).filter(function (v) { return d.rio[v] && d.ter[v]; })[0];
      if (vr != null && !ocupado(x.h) && A.hash(x.c, x.l, 240) < 0.45) {
        var cv = H.centroH(vr);
        itens.push({ y: x.ce.y + (cv.y - x.ce.y) * 0.45, x: x.ce.x + (cv.x - x.ce.x) * 0.45, f: 'margem', s: 1, pal: x.pal });
      }
      var pal = x.pal, i, px, py, cheio = ocupado(x.h), rota = d.rotaH[x.h];
      function livre(xx, yy) { return !cheio; }
      if (x.t === 'floresta') {
        for (i = 0; i < 2; i++) {
          px = x.ce.x + (A.hash(x.c, x.l, 110 + i) - 0.5) * H.W * 0.95; py = x.ce.y + (A.hash(x.c, x.l, 120 + i) - 0.5) * H.R * 1.5;
          if (!livre(px, py) || (rota && Math.abs(A.hash(x.c, x.l, 130 + i) - 0.5) < 0.2)) continue;
          itens.push({ y: py, x: px, f: A.hash(x.c, x.l, 140 + i) > 0.4 ? 'con' : 'fol', s: 0.85 + A.hash(x.c, x.l, 150 + i) * 0.45, alt: i & 1, pal: pal });
        }
      } else if (x.t === 'planicie') {
        if (A.hash(x.c, x.l, 160) > 0.93) { px = x.ce.x + (A.hash(x.c, x.l, 161) - 0.5) * 30 * E; py = x.ce.y + (A.hash(x.c, x.l, 162) - 0.5) * 24 * E; if (livre(px, py)) itens.push({ y: py, x: px, f: 'fol', s: 0.9, pal: pal }); }
        if (A.hash(x.c, x.l, 163) > 0.86) { px = x.ce.x + (A.hash(x.c, x.l, 164) - 0.5) * 34 * E; py = x.ce.y + (A.hash(x.c, x.l, 165) - 0.5) * 26 * E; if (livre(px, py)) itens.push({ y: py, x: px, f: 'arb', s: 1, pal: pal }); }
      } else if (x.t === 'colina') {
        px = x.ce.x + (A.hash(x.c, x.l, 170) - 0.5) * 16 * E; py = x.ce.y + (A.hash(x.c, x.l, 171) - 0.5) * 10 * E;
        if (livre(px, py) && A.hash(x.c, x.l, 174) > 0.55) itens.push({ y: py, x: px, f: 'mon', s: 1, pal: pal });
        px = x.ce.x + (A.hash(x.c, x.l, 172) - 0.5) * 36 * E; py = x.ce.y + (10 + A.hash(x.c, x.l, 173) * 8) * E;
        if (livre(px, py) && A.hash(x.c, x.l, 175) > 0.6) itens.push({ y: py, x: px, f: 'roc', s: 0.7, pal: pal });
      } else if (x.t === 'montanha') {
        /* picos em parte dos hexágonos (com hexágonos pequenos, um pico em cada um viraria um paliteiro) */
        if (!cheio && A.hash(x.c, x.l, 183) > 0.45) itens.push({ y: x.ce.y + 6 * E, x: x.ce.x + (A.hash(x.c, x.l, 180) - 0.5) * 10 * E, f: 'pic', s: 0.75 + A.hash(x.c, x.l, 181) * 0.45, pal: pal });
        else if (!cheio) itens.push({ y: x.ce.y + 8 * E, x: x.ce.x - 6 * E, f: A.hash(x.c, x.l, 184) > 0.3 ? 'mor' : 'roc', s: 0.8, pal: pal });
      } else if (x.t === 'pantano') {
        for (i = 0; i < 2; i++) { px = x.ce.x + (A.hash(x.c, x.l, 190 + i) - 0.5) * 40 * E; py = x.ce.y + (A.hash(x.c, x.l, 195 + i) - 0.5) * 30 * E; if (livre(px, py)) itens.push({ y: py, x: px, f: 'jun', s: 1, pal: pal }); }
        if (A.hash(x.c, x.l, 199) > 0.85 && livre(x.ce.x + 8 * E, x.ce.y + 4 * E)) itens.push({ y: x.ce.y + 4 * E, x: x.ce.x + 8 * E, f: 'fol', s: 0.7, pal: pal });
      }
    });
    /* bancos de névoa nos hexágonos desconhecidos */
    hexes.forEach(function (h) {
      if (M.estado(h).v !== 'desconhecido') return;
      var ce = H.centroH(h);
      itens.push({ y: ce.y + H.R * 0.55, x: ce.x, f: 'nev', c: H.c(h), l: H.l(h) });
    });
    itens.sort(function (a, b) { return a.y - b.y; });
    var pf = A.puff();
    itens.forEach(function (it) {
      if (it.f === 'nev') {
        chao(c, V); c.fillStyle = P.nevoa; hexagono(c, it.x, it.y - H.R * 0.55, H.R + 3); c.fill();
        obj(c, V, it.x, it.y - H.R * 0.55);
        for (var i = 0; i < 2; i++) {
          var px = (A.hash(it.c, it.l, 200 + i) - 0.5) * 40 * E, py = ((A.hash(it.c, it.l, 210 + i) - 0.5) * 18 - 10) * E, ps = (64 + A.hash(it.c, it.l, 220 + i) * 30) * E * 1.15;
          c.drawImage(pf, px - ps / 2, py - ps / 2, ps, ps * 0.8);
        }
        return;
      }
      obj(c, V, it.x, it.y);
      /* vegetação e relevo 3D (RP.natureza): variante e tamanho tirados da posição, para cada lugar ter sempre a mesma */
      if (it.f === 'ponte' && RP.natureza && RP.natureza.ponte(c, it.ang, it.pal !== P)) return;
      if (RP.natureza && RP.natureza.pronto) {
        var hv = A.hash(Math.round(it.x * 10), Math.round(it.y * 10), 7), hs = A.hash(Math.round(it.x * 10), Math.round(it.y * 10), 11);
        var esc = it.f === 'pic' ? it.s * (0.65 + hs * 0.9) : it.f === 'mon' ? 0.7 + hs * 0.7 : it.f === 'mor' ? 0.6 + hs * 0.7 : it.f === 'roc' ? 0.6 + hs * 0.5 : it.f === 'arb' || it.f === 'jun' || it.f === 'margem' || it.f === 'agua' ? 0.8 + hs * 0.5 : it.f === 'pedraRio' || it.f === 'canoa' ? 0.9 + hs * 0.3 : it.s * (0.8 + hs * 0.45);
        if (RP.natureza.desenhar(c, it.f, hv, esc, it.pal !== P)) return;
      }
      if (it.f === 'con') A.arvoreConifera(c, 0, 0, it.s, it.pal, it.alt);
      else if (it.f === 'fol') A.arvoreFolhosa(c, 0, 0, it.s, it.pal);
      else if (it.f === 'arb') A.arbusto(c, 0, 0, it.s, it.pal, it.pal.flor2);
      else if (it.f === 'mon') A.monte(c, 0, 0, 44, 18, it.pal);
      else if (it.f === 'roc' || it.f === 'mor') A.rocha(c, 0, 0, it.s, it.pal);
      else if (it.f === 'pic') A.pico(c, 0, 0, 56 * it.s, 52 * it.s, it.pal);
      else if (it.f === 'jun' || it.f === 'margem') A.junco(c, 0, 0, 1, it.pal);
    });
    c.setTransform(1, 0, 0, 1, 0, 0);
  }

  /* ---------------------------------------------------------------- vida: trabalho nos seus locais */
  function prepararVida() {
    var r = RP.reino; if (!r) return [];
    var locais = (r.locais || []).filter(function (l) { return !l.ruina; });
    var pos = {}; locais.forEach(function (l) { pos[l.id] = H.centroH(l.hex); });
    var cas = pos[r.casteloId], arm = locais.filter(function (l) { return l.tipo === 'armazem'; }).map(function (l) { return pos[l.id]; })[0] || cas;
    var tr = [];
    function ida(a, b, o) { if (a && b) tr.push(Object.assign({ a: a, b: b, vel: 11 }, o)); }
    function off(p, dx, dz) { return { x: p.x + dx, y: p.y + dz }; }
    /* as pessoas de verdade vêm da camada de pessoas (vista/pessoas.js); aqui ficam só os cavalos do pasto e o alvo de palha do quartel */
    locais.forEach(function (x) {
      var p = pos[x.id];
      if (x.tipo === 'pasto') { for (var k2 = 0; k2 < 4; k2++) tr.push({ cavaloPasto: true, centro: p, fase: k2 * 1.7, cor: P.cavalo[k2 % 4] }); }
      else if (x.tipo === 'quartel') tr.push({ alvoPalha: off(p, 26, -14), soRecrutando: true });
    });
    void cas; void arm; void ida;
    return tr;
  }
  function itensFila(nome) { return (RP.reino && RP.reino.filas && RP.reino.filas[nome]) || []; }
  function emAndamento(it, agora) { return it.inicio && it.fim && it.inicio <= agora && it.fim > agora; }
  function obraDe(localId, agora) {
    var o = itensFila('obras').filter(function (x) { return x.localId === localId && (!x.fim || x.fim > agora); })[0];
    if (!o) return null;
    return { ativa: emAndamento(o, agora), fim: o.fim, material: o.materialCompleto };
  }
  function recrutando(agora) { return itensFila('recrutamento').some(function (it) { return emAndamento(it, agora); }); }

  /* ---------------------------------------------------------------- quadro animado */
  C.quadro = function (agora) {
    if (!this.w) this.redimensionar();
    if (!this.w) return;
    var c = this.ctx, dpr = this.dpr, s = this.cam.s, t = agora / 1000, self = this, d = M.dados, MAPA = RP.mapa;
    var ag = RP.agora(), Cs = A.cores();
    if (this.precisaCache()) this.construirCache();
    var r = this.ci, esc = s / r.s;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = P.nevoa; c.fillRect(0, 0, this.cv.width, this.cv.height);
    var o0 = this.tela(r.x, r.y);
    c.imageSmoothingEnabled = true;
    c.drawImage(this.cache, o0.x * dpr, o0.y * dpr, r.cw * esc * dpr, r.ch * esc * dpr);
    this.alvos = [];
    if (!d) return;

    var V = { S: s * dpr, ox: (this.w / 2 - this.cam.x * s) * dpr, oy: (this.h / 2 - this.cam.y * K * s) * dpr };
    var vis = this.retanguloMundo(), cam = { x0: vis.x - 80, x1: vis.x + vis.w + 80, y0: vis.y - 60, y1: vis.y + vis.h + 120 };
    function naTela(x, y) { return x > cam.x0 && x < cam.x1 && y > cam.y0 && y < cam.y1; }
    var camadas = this.opt.camadas || MAPA.camadas || {};

    /* brilho do rio (só onde se vê agora: informação antiga não se mexe) */
    chao(c, V);
    c.setLineDash([6, 22]); c.lineDashOffset = -t * 14; c.strokeStyle = 'rgba(215,238,255,.5)'; c.lineWidth = 2; c.lineCap = 'round';
    c.stroke(d.curvaRiosVivos);
    c.setLineDash([]);

    /* seleção */
    var sel = this.opt.selecao && this.opt.selecao();
    if (sel != null && sel >= 0) {
      var cs = H.centroH(sel);
      c.strokeStyle = Cs.selecao; c.lineWidth = 3 / s; c.globalAlpha = 0.65 + Math.sin(t * 4) * 0.3;
      hexagono(c, cs.x, cs.y, H.R - 2); c.stroke(); c.globalAlpha = 1;
    }
    /* desenhos extras de sistemas no chão (mesma assinatura do Mapa: ctx no espaço do mundo) */
    (MAPA.desenhosExtrasCena || []).forEach(function (f) { try { chao(c, V); f(c, d, { x: self.cam.x, y: self.cam.y, z: s }, ag); } catch (e) { console.error(e); } });

    var itens = [], rotulos = [];
    function alvo(x, y, w, h, ent, o) { return { x: x, y: y, w: w, h: h, ent: ent, obj: o }; }
    function rot(x, y, dy, txt, cls, cor) { rotulos.push({ x: x, y: y, dy: dy, txt: txt, cls: cls, cor: cor }); }

    /* ameaças: marchas alheias a caminho de um local seu */
    var meusHex = {}, ameacados = {};
    ((RP.reino && RP.reino.locais) || []).forEach(function (l) { meusHex[l.hex] = l; });
    d.marchas.forEach(function (m) { if (m.dono !== 'meu' && m.dono !== 'aliado' && m.caminho && meusHex[m.caminho[m.caminho.length - 1]] && M.chegada(m) > ag) ameacados[m.caminho[m.caminho.length - 1]] = true; });

    /* objetos parados (locais, jazidas, ruínas e tipos de outros sistemas) */
    d.objs.forEach(function (o) {
      var tipo = MAPA.tiposObjeto[o.tipo];
      if (tipo && tipo.camada && camadas[tipo.camada] === false) return;
      if (o.tipo === 'jazida' && camadas.recursos === false) return;
      var h = o.hex, e = M.estado(h);
      if (e.v === 'desconhecido' && !(tipo && tipo.atravessaNevoa)) return;
      var antigo = e.v === 'explorado', pal = antigo ? PA : P, anim = !antigo;
      var p = tipo && tipo.pos ? tipo.pos(o, t) : H.centroH(h);
      if (!p || !naTela(p.x, p.y)) return;
      if (o.tipo === 'local') {
        var meu = o.dono === 'meu', loc = meu ? RP.local(o.id) : null, castelo = o.local === 'castelo';
        var x = { tipo: o.local, nivel: o.nivel, produz: loc ? loc.produz : null, ruina: o.ruina, moinho: o.local === 'vila' && (o.nivel || 0) >= 3 };
        var obra = meu ? obraDe(o.id, ag) : null;
        itens.push({ y: p.y, d: function () {
          obj(c, V, p.x, p.y);
          if (o.ruina || o.dono === 'livre') A.ruina(c, x, t, pal);
          else A.local(c, x, t, pal, A.corDono(o.dono, o), anim);
          if (obra) { obj(c, V, p.x, p.y); if (obra.ativa) A.andaime(c, castelo ? 30 : 20, P); else A.materiais(c, P); }
        }, alvo: alvo(p.x, p.y, castelo ? 64 : 50, castelo ? 66 : 42, ['local', o.id], o) });
        if (obra && obra.ativa) {
          itens.push({ y: p.y + 14, d: function () { obj(c, V, p.x + 16, p.y + 14); RP.sprites.pessoa(c, 0, 0, t, { roupa: P.roupa[4], dir: -1, trabalho: 'martelo', fase: 0.5 }); } });
          rot(p.x, p.y, -52, 'Obra · ' + RP.fmtResta(obra.fim - ag), 'obra', Cs.alerta);
        }
        if (o.local === 'pasto' && !antigo && !o.ruina) {
          itens.push({ y: p.y - 18, d: function () { obj(c, V, p.x, p.y); A.cerca(c, P, false); } });
          itens.push({ y: p.y + 18, d: function () { obj(c, V, p.x, p.y); A.cerca(c, P, true); } });
        }
        if (o.reliquia) {
          var rx = p.x + (castelo ? -46 : -18), ry = p.y + (castelo ? 30 : 12);
          itens.push({ y: ry, d: function () { obj(c, V, rx, ry); A.pedestalReliquia(c, t, pal, o.reliquia.tipo || 'desconhecido', anim); }, alvo: alvo(rx, ry - 12, 26, 34, ['local', o.id], o) });
        }
        if (castelo && !o.ruina) rot(p.x, p.y, 26, meu ? (RP.reino ? RP.reino.nome : o.nome) : 'Castelo', 'castelo', A.corDono(o.dono, o));
        if (meu && ameacados[h]) rot(p.x, p.y, -46, 'Ameaçado', 'perigo', Cs.perigo);
        return;
      }
      if (o.tipo === 'jazida') {
        itens.push({ y: p.y, d: function () { obj(c, V, p.x, p.y); A.jazida(c, o.recurso, t, pal, anim); }, alvo: alvo(p.x, p.y, 46, 34, ['jazida', o.id], o) });
        if (o.recurso === 'cavalo' && !antigo) for (var q = 0; q < 3; q++) (function (q) {
          var hx = p.x + Math.sin(t * 0.21 + q * 2.1) * 16, hy = p.y + Math.cos(t * 0.17 + q * 1.3) * 12, dir = Math.cos(t * 0.21 + q * 2.1) >= 0 ? 1 : -1;
          itens.push({ y: hy, d: function () { obj(c, V, hx, hy); A.cavalo(c, 0, 0, t, P, { cor: P.cavalo[(q + 2) % 4], dir: dir, andando: Math.sin(t * 0.4 + q) > 0, pastando: Math.sin(t * 0.4 + q) <= 0, fase: q }); } });
        })(q);
        return;
      }
      if (o.tipo === 'ruina-antiga') {
        itens.push({ y: p.y, d: function () { obj(c, V, p.x, p.y); A.jazida(c, 'ruina', t, pal, anim, o.esgotada); }, alvo: alvo(p.x, p.y, 50, 40, ['ruina-antiga', o.id], o) });
        return;
      }
      /* tipos de outros sistemas, ou marcador genérico */
      var info = { t: t, pal: pal, anim: anim, antigo: antigo, A: A, estado: e, agora: ag };
      itens.push({ y: p.y, d: function () {
        obj(c, V, p.x, p.y);
        try { if (tipo && tipo.desenharCena) tipo.desenharCena(c, o, info); else A.marco(c, t, pal, anim); } catch (er) { console.error(er); }
      }, alvo: alvo(p.x, p.y - 6, (tipo && tipo.alvo && tipo.alvo.w) || 40, (tipo && tipo.alvo && tipo.alvo.h) || 36, [o.tipo, o.id != null ? o.id : o._k], o) });
      var rt = tipo && tipo.rotulo ? tipo.rotulo(o, info) : (tipo ? null : (o.nome || o.rotulo || o.tipo));
      if (rt) rot(p.x, p.y, (tipo && tipo.rotuloDy) || -30, typeof rt === 'string' ? rt : rt.txt, rt.cls || 'nivel', rt.cor || Cs.destaque);
    });

    /* fundações na fila (hexágono livre): estacas, material e tempo */
    itensFila('obras').forEach(function (it) {
      if (it.localId || it.hex == null || it.tipo !== 'fundar') return;
      var e = M.estado(it.hex); if (e.v === 'desconhecido') return;
      var p = H.centroH(it.hex); if (!naTela(p.x, p.y)) return;
      var ativa = emAndamento(it, ag);
      itens.push({ y: p.y, d: function () {
        obj(c, V, p.x, p.y); A.ruina(c, { ruina: false }, t, P);
        if (ativa) { A.andaime(c, 16, P); } else A.materiais(c, P, -36);
      }, alvo: alvo(p.x, p.y, 44, 34, ['hex', it.hex], null) });
      if (ativa) itens.push({ y: p.y + 12, d: function () { obj(c, V, p.x + 14, p.y + 12); RP.sprites.pessoa(c, 0, 0, t, { roupa: P.roupa[2], dir: -1, trabalho: 'martelo', fase: 0.2 }); } });
      rot(p.x, p.y, -36, ativa ? 'Obra · ' + RP.fmtResta(it.fim - ag) : 'Aguardando material', 'obra', Cs.alerta);
    });

    /* pessoas trabalhando nos seus locais */
    var chave = M.versao + ':' + (RP.reino ? RP.reino.locais.length + ':' + RP.reino.casteloId : '');
    if (!this.vida || this.chaveVida !== chave) { this.vida = prepararVida(); this.chaveVida = chave; }
    var recr = recrutando(ag), corMeu = Cs.meu;
    this.vida.forEach(function (o) {
      if (o.cavaloPasto) {
        var hx = o.centro.x + Math.sin(t * 0.3 + o.fase) * 18, hy = o.centro.y + Math.cos(t * 0.23 + o.fase * 1.3) * 11;
        if (!naTela(hx, hy)) return;
        var dir = Math.cos(t * 0.3 + o.fase) >= 0 ? 1 : -1, mov = Math.sin(t * 0.5 + o.fase) > -0.2;
        itens.push({ y: hy, d: function () { obj(c, V, hx, hy); A.cavalo(c, 0, 0, t, P, { cor: o.cor, dir: dir, andando: mov, pastando: !mov, fase: o.fase }); } });
        return;
      }
      if (o.soRecrutando && !recr) return;
      if (o.alvoPalha) {
        if (!naTela(o.alvoPalha.x, o.alvoPalha.y)) return;
        itens.push({ y: o.alvoPalha.y, d: function () { obj(c, V, o.alvoPalha.x, o.alvoPalha.y); A.linha(c, -2, 0, 0, -8, P.madeiraEsc, 1.2); A.linha(c, 2, 0, 0, -8, P.madeiraEsc, 1.2); A.elipse(c, 0, -10, 4.5, 4.5, '#d8c98f'); A.elipse(c, 0, -10, 3, 3, '#c0392b'); A.elipse(c, 0, -10, 1.4, 1.4, '#f1e6c2'); } });
        return;
      }
      if (o.arqueiro) {
        if (!naTela(o.fixo.x, o.fixo.y)) return;
        var fa = ((t * 0.8 + o.fase) % 1.6) / 1.6;
        itens.push({ y: o.fixo.y, d: function () {
          obj(c, V, o.fixo.x, o.fixo.y);
          A.pessoa(c, 0, 0, t, P, { roupa: corMeu, cinto: '#2b2520', dir: 1, arco: true, atirando: true, fase: o.fase });
          if (fa > 0.55) {
            var k = (fa - 0.55) / 0.45, dx = o.alvoTiro.x - o.fixo.x, dy = (o.alvoTiro.y - o.fixo.y) * K;
            var fx = dx * k, fy = dy * k - 9.5 - Math.sin(k * Math.PI) * 6;
            A.linha(c, fx - 3, fy + 0.4, fx + 3, fy - 0.4, P.madeiraEsc, 0.8);
          }
        } });
        return;
      }
      var x, y, dir = o.dir || 1, andando = false, ida = true;
      if (o.fixo) { x = o.fixo.x; y = o.fixo.y; }
      else {
        var dist = Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y), per = Math.max(1, dist / o.vel), fase = ((t + o.fase * 7) / per) % 2, f = fase < 1 ? fase : 2 - fase;
        x = o.a.x + (o.b.x - o.a.x) * f; y = o.a.y + (o.b.y - o.a.y) * f; andando = true; ida = fase < 1;
        dir = ((o.b.x - o.a.x) >= 0) === ida ? 1 : -1;
      }
      if (!naTela(x, y)) return;
      var carga = o.carga && (o.fixo || ida) ? o.carga : null;
      itens.push({ y: y, d: function () {
        obj(c, V, x, y);
        if (o.soldado) A.pessoa(c, 0, 0, t, P, { roupa: corMeu, cinto: '#2b2520', dir: dir, andando: andando, fase: o.fase, capacete: P.metal, lanca: true, escudo: corMeu, estocada: o.estocada });
        else A.pessoa(c, 0, 0, t, P, { roupa: o.roupa, dir: dir, andando: andando, fase: o.fase, trabalho: o.trabalho, carga: carga, corCarga: o.corCarga });
      } });
    });

    /* pessoas do reino (e as de outros reinos à vista), onde estão */
    if (RP.pessoasVista) RP.pessoasVista.desenhar({
      c: c, V: V, cena: self, itens: itens, rot: rot, t: t, ag: ag, s: s, naTela: naTela, cor: corMeu,
      obj: function (x, y) { obj(c, V, x, y); }, alvo: alvo
    });

    /* marchas */
    if (camadas.marchas !== false) d.marchas.forEach(function (m) {
      var pos = M.posMarcha(m, ag), cheg = M.chegada(m);
      if (M.sumiu(m, ag)) return;
      if (!M.marchaVisivel(m, pos) || !naTela(pos.x, pos.y)) return;
      self.desenharMarcha(c, V, m, pos, t, ag, itens, rot);
      var am = alvoTela(self, pos.x, pos.y, 60, 44, ['marcha', m.id], m); am.hex = pos.hex; self.alvos.push(am);
    });

    itens.sort(function (a, b) { return a.y - b.y; });
    itens.forEach(function (it) {
      it.d();
      if (it.alvo) { var a = it.alvo; self.alvos.push(alvoTela(self, a.x, a.y, a.w, a.h, a.ent, a.obj)); }
    });

    /* névoa à deriva sobre o desconhecido */
    var pf = A.puff();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    hexesNoRetangulo(vis, 0).forEach(function (h) {
      var cc = H.c(h), ll = H.l(h);
      if (A.hash(cc, ll, 230) > 0.3 || M.estado(h).v !== 'desconhecido') return;
      var ce = H.centroH(h), ph = A.hash(cc, ll, 231) * 6.28;
      var p = self.tela(ce.x + Math.sin(t * 0.07 + ph) * 22, ce.y + Math.cos(t * 0.05 + ph) * 12);
      var sz = 110 * s;
      c.globalAlpha = 0.45; c.drawImage(pf, p.x - sz / 2, p.y - sz * 0.75, sz, sz * 0.7); c.globalAlpha = 1;
    });
    /* objetos que atravessam a névoa (faróis) são redesenhados por cima dela */
    d.objs.forEach(function (o) {
      var tipo = MAPA.tiposObjeto[o.tipo];
      if (!tipo || !tipo.sobreNevoa) return;
      var p = H.centroH(o.hex); if (!naTela(p.x, p.y)) return;
      obj(c, V, p.x, p.y);
      try { tipo.sobreNevoa(c, o, { t: t, A: A, estado: M.estado(o.hex) }); } catch (er) { console.error(er); }
    });

    /* rótulos (espaço de tela) */
    if (camadas.rotulos !== false) {
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      /* pílulas não se cobrem: a que bate em outra sobe uma linha */
      var postas = [], ALT = 22;
      rotulos.map(function (rt) {
        var p = self.tela(rt.x, rt.y);
        return { x: p.x, y: p.y + rt.dy * Math.min(1.4, s / 1.4), w: rt.txt.length * 6.4 + 18, rt: rt };
      }).sort(function (a, b) { return b.y - a.y; }).forEach(function (q) {
        for (var n = 0; n < 6; n++) {
          var bate = postas.some(function (o) { return Math.abs(o.y - q.y) < ALT && Math.abs(o.x - q.x) < (o.w + q.w) / 2; });
          if (!bate) break;
          q.y -= ALT;
        }
        postas.push(q);
        A.pilula(c, q.x, q.y, q.rt.txt, q.rt.cls, q.rt.cor);
      });
    }
    /* laço da seleção (espaço de tela) */
    if (this.laco && this.laco.length > 1) {
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.beginPath(); c.moveTo(this.laco[0].x, this.laco[0].y);
      for (var li = 1; li < this.laco.length; li++) c.lineTo(this.laco[li].x, this.laco[li].y);
      c.closePath();
      c.fillStyle = Cs.selecao; c.globalAlpha = 0.12; c.fill(); c.globalAlpha = 1;
      c.strokeStyle = Cs.selecao; c.lineWidth = 2; c.setLineDash([6, 4]); c.stroke(); c.setLineDash([]);
    }
  };

  /* pessoas de uma marcha, uma por figura: as próprias pelo nome (pessoaIds); sem os nomes, pelas tropas; de outros
     reinos, pelo tamanho aproximado que o servidor manda ("poucas", "≈ 10"). Nunca uma formação fixa. */
  var MAX_MARCHA = 16;
  function figurasDaMarcha(m, revelado) {
    var lista = [];
    (m.pessoaIds || []).forEach(function (id) { var p = M.pessoa(id); if (p) lista.push(p); });
    if (lista.length) return lista;
    var tr = m.tropas || {}, k = 0;
    Object.keys(tr).forEach(function (u) { for (var i = 0; i < tr[u]; i++) lista.push({ id: m.id * 100 + k++, oficio: u, estado: 'marcha' }); });
    if (/explor|batedor|prospector/.test(String(m.marcha))) lista.unshift({ id: m.id * 100 + 99, oficio: m.oficio || 'explorador-pe', estado: 'marcha' });
    if (lista.length) return lista;
    var tam = String(m.tamanho || ''), n = /\d+/.test(tam) ? +tam.match(/\d+/)[0] : 3;
    for (var j = 0; j < Math.max(1, n); j++) lista.push({ id: m.id * 100 + j, oficio: j % 3 === 1 ? 'arqueiro' : 'lanceiro', estado: 'marcha' });
    return lista;
  }
  /* o que cada um faz no trabalho do exército parado: escavar (pá e picareta), extrair e coletar (picareta ou machado), caçar */
  function trabalhoDe(trab, i, p, centro) {
    var o = { dir: p.x <= centro.x ? 1 : -1 };
    if (!trab) return o;
    o.lanca = false; o.escudo = null; o.arco = false;
    if (trab === 'escavar') o.trabalho = i % 2 ? 'picareta' : 'pa';
    else if (trab === 'extrair') o.trabalho = 'picareta';
    else if (trab === 'coletar') o.trabalho = i % 3 === 2 ? 'martelo' : 'picareta';
    else if (trab === 'cacar') { o.lanca = true; o.estocada = true; }
    return o;
  }

  /* uma marcha na Vista: formação, carregadores, explorador... Forças sem estandarte: cinza, sem bandeira */
  C.desenharMarcha = function (c, V, m, pos, t, ag, itens, rot) {
    var Cs = A.cores(), MAPA = RP.mapa, propria = m.dono === 'meu' || m.dono === 'aliado';
    var revelado = propria || !!(m.estandarte && (m.cor || m.brasao));
    var cor = revelado ? A.corDono(m.dono, m) : P.hostil;
    var dir = Math.cos(pos.ang) >= 0 ? 1 : -1, ux = Math.cos(pos.ang), uy = Math.sin(pos.ang);
    var tipo = String(m.marcha || ''), def = MAPA.tiposMarcha[tipo], cheg = M.chegadaConhecida(m), prefixo = '';
    function pt(f, l) { return { x: pos.x - ux * f - uy * l, y: pos.y - uy * f + ux * l }; }
    function add(p, fn) { itens.push({ y: p.y, d: function () { obj(c, V, p.x, p.y); fn(); } }); }
    /* pessoas selecionadas dentro desta marcha: anel no chão */
    if (RP.selecao && RP.selecao.n() && m.pessoaIds && m.pessoaIds.some(function (id) { return RP.selecao.tem(id); })) {
      itens.push({ y: pos.y - 0.1, d: function () { obj(c, V, pos.x, pos.y); c.strokeStyle = Cs.selecao; c.lineWidth = 1.6; c.beginPath(); c.ellipse(0, 1, 16, 16 * K * 0.55, 0, 0, 6.2832); c.stroke(); } });
      prefixo = 'Selecionado · ';
    }
    if (def && def.desenharCena) {
      add(pos, function () { try { def.desenharCena(c, m, { t: t, pal: P, A: A, dir: dir, ang: pos.ang, cor: cor, revelado: revelado }); } catch (er) { console.error(er); } });
      prefixo = def.nome ? def.nome + ' · ' : '';
    } else if (tipo === 'carregadores') {
      var mp = RP.reino && (RP.reino.marchas || []).filter(function (x) { return x.id === m.id; })[0];
      var n = Math.max(1, Math.min(5, (mp && mp.pessoas) || 3));
      for (var k = 0; k < n; k++) (function (k) {
        add(pt(k * 8, ((k % 2) * 2 - 1) * 3), function () { RP.sprites.pessoa(c, 0, 0, t, { roupa: P.roupa[k % 5], dir: dir, andando: true, fase: k * 0.9, carga: k % 3 === 1 ? 'tronco' : 'saco' }); });
      })(k);
      prefixo = 'Material · ';
    } else if (tipo === 'pessoas') {
      /* civis andando entre locais do reino (troca de trabalho, volta para casa): sem carga, sem armas */
      var mq = RP.reino && (RP.reino.marchas || []).filter(function (x) { return x.id === m.id; })[0];
      var np = Math.max(1, Math.min(5, (mq && mq.pessoas) || 1));
      for (var j = 0; j < np; j++) (function (j) {
        add(pt(j * 8, ((j % 2) * 2 - 1) * 3), function () { RP.sprites.pessoa(c, 0, 0, t, { roupa: P.roupa[(j + 2) % 5], dir: dir, andando: true, fase: j * 0.7 }); });
      })(j);
      prefixo = (np === 1 ? 'Pessoa' : np + ' pessoas') + ' · ';
    } else if (/explor|batedor|prospector/.test(tipo)) {
      /* o explorador é uma pessoa da marcha (oficio explorador-cavalo, prospector...); a escolta vem atrás, uma figura por pessoa */
      var andaE = !(m.parado || (cheg && cheg <= ag));
      figurasDaMarcha(m, revelado).forEach(function (f, i) {
        add(i ? pt(10 + Math.floor((i - 1) / 2) * 9, ((i % 2) * 2 - 1) * 6) : pos, function () {
          RP.pessoasVista.figura(c, f, t, dir, cor, !revelado, { andando: andaE, ang: pos.ang });
          if (propria) RP.pessoasVista.barraVida(c, f);
        });
      });
    } else if (tipo === 'mensageiro') {
      /* bandeira branca: evidente que não é ataque */
      add(pos, function () { A.cavalo(c, 0, 0, t, P, { pelagem: 3, semente: m.id, dir: dir, ang: pos.ang, andando: true, galope: true, cavaleiro: revelado ? cor : '#6b6458', bandeira: '#f3efe4' }); });
      prefixo = 'Mensageiro · ';
    } else if (tipo === 'caravana') {
      var nv = 2;
      for (var q = 0; q < nv; q++) (function (q) { add(pt(q * 22, 0), function () { A.carroca(c, t, P, dir, revelado ? cor : '#8a8174', q * 1.7); }); })(q);
      prefixo = 'Caravana · ';
    } else {
      /* exército: exatamente as pessoas da marcha (as próprias pelo nome; as de outros reinos, pelo tamanho aproximado) */
      var figs = figurasDaMarcha(m, revelado), nfig = Math.min(figs.length, MAX_MARCHA);
      var parada = !!(m.parado || (cheg && cheg <= ag && propria)), trab = m.estado === 'trabalhando' ? m.ordem : null;
      var porFila = nfig <= 3 ? nfig : nfig <= 8 ? 3 : 4;
      for (var i = 0; i < nfig; i++) (function (i, f) {
        var fila = Math.floor(i / porFila), col = i % porFila - (Math.min(porFila, nfig) - 1) / 2, p;
        if (parada) {
          /* parados ou trabalhando: espalhados em volta do ponto, de frente para ele */
          var a = (i / Math.max(1, nfig)) * 6.2832 + 0.4, r = nfig === 1 ? 0 : 9 + (i % 2) * 4;
          p = { x: pos.x + Math.cos(a) * r * 1.3, y: pos.y + Math.sin(a) * r * 0.6 + 4 };
        } else p = pt(fila * 10 - Math.sin(t * 2 + i) * 0.6, col * 8);
        var extra = parada ? trabalhoDe(trab, i, p, pos) : { andando: true, ang: pos.ang };
        if (trab === 'coletar' && m.recurso === 'madeira') { extra.trabalho = null; extra.ferramenta = 'machado'; }   /* madeira: machado; pedra: picareta */
        if (!parada && m.cargaUsada > 0 && f.oficio !== 'cavalaria' && f.oficio !== 'elite') extra.carga = m.recurso === 'madeira' ? 'tronco' : i % 2 ? 'saco' : 'minerio';
        add(p, function () {
          RP.pessoasVista.figura(c, f, t, extra.dir || dir, revelado ? cor : P.hostil, !revelado, extra);
          if (propria) RP.pessoasVista.barraVida(c, f);
          if (i === 0 && revelado && !trab && nfig > 2) A.bandeira(c, -dir * 2, -26, 18, cor, t, 10, 7);
        });
      })(i, figs[i]);
      if (figs.length > nfig) prefixo = figs.length + ' · ';
      if (trab) prefixo = ({ escavar: 'Escavando', extrair: 'Extraindo', cacar: 'Caçando', coletar: 'Coletando' }[trab] || 'Trabalhando') + ' · ' + prefixo;
      if (!parada) {
        var po = pt(10 + Math.ceil(nfig / Math.max(1, porFila)) * 10, 0);
        itens.push({ y: pos.y + 6, d: function () { obj(c, V, po.x, po.y); for (var w = 0; w < 3; w++) { var a = (t * 0.8 + w / 3) % 1; A.elipse(c, Math.sin(w * 3) * 6 - dir * a * 6, -a * 6, 4 + a * 6, 2 + a * 3, 'rgba(160,140,110,' + (0.3 * (1 - a)).toFixed(2) + ')'); } } });
      }
    }
    if (m.reliquia) { var pb = pt(12, 0); add({ x: pb.x, y: pb.y + 1 }, function () { A.bauReliquia(c, t, P, m.reliquia.tipo || 'desconhecido'); }); prefixo = 'Relíquia · '; }
    var desconhecida = !revelado && tipo !== 'mensageiro';
    var tempo = !cheg ? '' : cheg > ag ? RP.fmtResta(cheg - ag) : (propria ? 'parada' : '');
    rot(pos.x, pos.y, -40, (desconhecida ? '? ' : '') + prefixo + tempo, desconhecida ? 'perigo' : 'marcha', desconhecida ? Cs.perigo : cor);
  };

  function alvoTela(cena, x, y, w, h, ent, o) {
    var p = cena.tela(x, y), s = cena.cam.s;
    return { x0: p.x - (w / 2) * s, x1: p.x + (w / 2) * s, y0: p.y - h * s, y1: p.y + 10 * s, ent: ent, obj: o, hex: o && o.hex != null ? o.hex : (ent && ent[0] === 'hex' ? ent[1] : null),
      /* perto do pé do objeto (metade da caixa): a marcha fica entre hexágonos */
      perto: function (tx, ty) { return Math.abs(tx - p.x) <= (w / 4) * s && ty >= p.y - (h / 2) * s && ty <= p.y + 10 * s; } };
  }

  Cena.SMIN = SMIN; Cena.SMAX = SMAX;
  RP.Cena = Cena;
})();
