/* Reino de Pedra — modelo do mundo no cliente, compartilhado pela Vista (2.5D), pelo Mapa tático, pelo minimapa
   e pela Vista de Meu reino. Vem de GET /api/v1/mapa (VisaoMapa no servidor): o servidor já escondeu o que o
   reino não pode saber; aqui só se organiza para desenhar.
     terreno: uma letra por hexágono (p, f, c, m, b), '?' = névoa, maiúscula = rio
     idade:   minutos desde a última vista (0 = ao vivo, -1 = nunca)
     objetos: [{ tipo: 'local' | 'marcha' | 'jazida' | 'ruina-antiga' | tipos de outros sistemas, hex, ... }]
   Também cria o ponto de extensão RP.mapa (tipos de objeto, extras de folha, camadas) para sistemas
   registrarem desenhos sem editar este arquivo. */
(function () {
  'use strict';
  var RP = window.RP, H = RP.hex;

  var LETRA = { p: 'planicie', f: 'floresta', c: 'colina', m: 'montanha', b: 'pantano' };

  /* ---------------------------------------------------------------- pontos de extensão (antes de qualquer tela) */
  var MAPA = RP.mapa = RP.mapa || {};
  /* extrasFolhaHex/acoesFolhaHex: f(hex, dados) → HTML; desenhosExtras (Mapa) e desenhosExtrasCena (Vista, no chão):
     f(ctx, dados, cam, agora) com o ctx no espaço do mundo; legendaExtras: f() → HTML na folha de camadas */
  ['extrasFolhaHex', 'acoesFolhaHex', 'desenhosExtras', 'desenhosExtrasCena', 'legendaExtras'].forEach(function (k) { MAPA[k] = MAPA[k] || []; });
  /* RP.mapa.tiposObjeto[tipo] = { (todos opcionais; sem registro, o objeto ganha um marcador genérico)
       camada: 'fauna' | 'bandeiras' | ...       camada que liga/desliga o tipo
       nome(o), icone(o)                         nome curto e ícone (folhas, listas)
       classe(o, info), svgTatico(o, info)       classes e markup SVG do marcador no Mapa, centrado em (0,0)
       svgFundo(o, info)                         SVG sob os marcadores (contorno do alcance, área)
       desenharTatico(ctx, o, info)              Canvas no espaço do mundo, sob os marcadores
       desenharCena(c, o, info)                  Vista, a partir do chão (info: { t, pal, anim, antigo, estado, A: RP.arte })
       rotulo(o, info) → texto ou { txt, cls, cor }, rotuloDy, alvo: { w, h }   pílula e área de toque na Vista
       atravessaNevoa, sobreNevoa(c, o, info)    aparece mesmo na névoa (farol) e desenha por cima dela
       pos(o, t) → { x, y }                      objetos que se movem
       folha(o, dados), acoes(o, dados) → HTML   linhas e botões nas folhas
     } (info.antigo: informação antiga, último estado conhecido) */
  MAPA.tiposObjeto = MAPA.tiposObjeto || {};
  /* este mapa desenha tiposObjeto sozinho (sistemas não precisam desenhar por desenhosExtras) */
  MAPA.desenhaTiposObjeto = true;
  /* marchas que estão agora no hexágono h (dados.porHex não tem marchas: elas andam) */
  MAPA.marchasEm = function (h, dados) {
    var d = dados || (RP.mapaModelo && RP.mapaModelo.dados), t = RP.agora();
    if (!d || !d.marchas || !RP.mapaModelo) return [];
    return d.marchas.filter(function (o) { return RP.mapaModelo.posMarcha(o, t).hex === h; });
  };
  /* RP.mapa.tiposMarcha[o.marcha] = { nome, icone, desenharCena(c, o, info) } — tipos novos de marcha (explorador, caravana...) */
  MAPA.tiposMarcha = MAPA.tiposMarcha || {};
  /* camada Perigo: o sistema de fauna define RP.mapa.perigoHex = function (hex, dados) → 'baixo' | 'medio' | 'alto' | null */
  if (!('perigoHex' in MAPA)) MAPA.perigoHex = null;
  MAPA.camadas = MAPA.camadas || { perigo: false, fauna: true, rotas: true, marchas: true, recursos: true, bandeiras: true, rotulos: true };

  /* ---------------------------------------------------------------- modelo */
  var M = { dados: null, versao: 0 };

  function preparar(d) {
    H.configurar(d.cols, d.lins);
    var n = d.cols * d.lins, i, ch, low;
    d.ter = new Array(n); d.rio = new Uint8Array(n); d.rotaH = new Uint8Array(n); d.ponteH = new Uint8Array(n);
    for (i = 0; i < n; i++) {
      ch = d.terreno.charAt(i);
      if (ch === '?' || !ch) { d.ter[i] = null; continue; }
      low = ch.toLowerCase();
      d.ter[i] = LETRA[low] || 'planicie';
      d.rio[i] = ch !== low ? 1 : 0;
    }
    (d.rotas || []).forEach(function (h) { d.rotaH[h] = 1; });
    (d.pontes || []).forEach(function (h) { d.ponteH[h] = 1; });
    d.porHex = {}; d.marchas = []; d.objs = [];
    (d.objetos || []).forEach(function (o, k) {
      o._k = k;
      if (o.tipo === 'marcha') { d.marchas.push(o); return; }
      d.objs.push(o);
      if (o.hex != null && o.hex >= 0) (d.porHex[o.hex] = d.porHex[o.hex] || []).push(o);
    });
    d.recebidoEm = RP.agora();
    var rios = ligacoes(function (h) { return d.rio[h] && d.ter[h]; });
    d.curvaRios = curvas(rios);
    d.curvaRiosVivos = curvas(rios, function (h) { return d.idade[h] === 0; });
    d.curvaRotas = curvas(ligacoes(function (h) { return d.rotaH[h] && d.ter[h]; }));
  }

  /* Ligações entre hexágonos vizinhos do conjunto (rio, rota). Atalhos que fecham triângulos (um rio que
     serpenteia toca o hexágono de dois passos atrás) são cortados, a começar pelos que ligam os hexágonos
     com mais vizinhos, para a linha seguir o curso em vez de virar uma malha. */
  function ligacoes(teste) {
    var n = H.COLS * H.LINS, viz = {}, h, k;
    for (h = 0; h < n; h++) if (teste(h)) viz[h] = H.vizinhos(h).filter(teste);
    function grau(x) { return viz[x].length; }
    function emTriangulo(a, b) { return viz[a].some(function (c) { return c !== b && viz[b].indexOf(c) >= 0; }); }
    for (k = 0; k < 4000; k++) {
      var melhor = null, nota = -1;
      Object.keys(viz).forEach(function (s) {
        var a = +s;
        viz[a].forEach(function (b) {
          if (b < a || !emTriangulo(a, b)) return;
          var g = grau(a) + grau(b);
          if (g > nota) { nota = g; melhor = [a, b]; }
        });
      });
      if (!melhor) break;
      viz[melhor[0]].splice(viz[melhor[0]].indexOf(melhor[1]), 1);
      viz[melhor[1]].splice(viz[melhor[1]].indexOf(melhor[0]), 1);
    }
    return viz;
  }
  /* Curvas suaves por hexágono: de meio de aresta a meio de aresta, com o centro como controle.
     Hexágonos vizinhos se encontram no mesmo ponto e na mesma direção, então a linha sai contínua. */
  function curvas(viz, filtro) {
    var p = new Path2D();
    Object.keys(viz).forEach(function (s) {
      var h = +s;
      if (filtro && !filtro(h)) return;
      var ce = H.centroH(h), mids = viz[h].filter(function (v) { return !filtro || filtro(v); })
        .map(function (v) { var q = H.centroH(v); return { x: (ce.x + q.x) / 2, y: (ce.y + q.y) / 2 }; });
      if (!mids.length) { p.moveTo(ce.x - H.R * 0.3, ce.y); p.lineTo(ce.x + H.R * 0.3, ce.y); }
      else if (mids.length === 1) { p.moveTo(ce.x, ce.y); p.lineTo(mids[0].x, mids[0].y); }
      else if (mids.length === 2) { p.moveTo(mids[0].x, mids[0].y); p.quadraticCurveTo(ce.x, ce.y, mids[1].x, mids[1].y); }
      else mids.forEach(function (m) { p.moveTo(ce.x, ce.y); p.lineTo(m.x, m.y); });
    });
    return p;
  }

  /* estado de um hexágono: visivel (ao vivo), explorado (último estado conhecido, com idade) ou desconhecido */
  M.estado = function (h) {
    var d = M.dados;
    if (!d || h < 0 || h >= d.idade.length) return { v: 'desconhecido' };
    var i = d.idade[h];
    if (i < 0) return { v: 'desconhecido' };
    if (i === 0) return { v: 'visivel', horas: 0 };
    return { v: 'explorado', horas: (i + (RP.agora() - d.recebidoEm) / 60000) / 60 };
  };
  M.terreno = function (h) { return M.dados ? M.dados.ter[h] : null; };
  M.rio = function (h) { return !!(M.dados && M.dados.rio[h]); };
  M.rota = function (h) { return !!(M.dados && M.dados.rotaH[h]); };
  M.ponte = function (h) { return !!(M.dados && M.dados.ponteH[h]); };
  M.objetosEm = function (h) { return (M.dados && M.dados.porHex[h]) || []; };
  M.local = function (id) { return M.dados ? M.dados.objs.filter(function (o) { return o.tipo === 'local' && o.id === id; })[0] : null; };

  /* posição de uma marcha no instante t (ms do servidor), pelo caminho e pelos tempos de chegada a cada hexágono */
  M.posMarcha = function (o, t) {
    var tp = o.tempos, cm = o.caminho;
    if (!cm || !cm.length) { var c0 = H.centroH(o.hex); return { x: c0.x, y: c0.y, ang: 0, hex: o.hex, i: 0 }; }
    if (!tp || tp.length < 2 || t <= tp[0]) return ponto(cm, 0, 0);
    if (t >= tp[tp.length - 1]) return ponto(cm, cm.length - 1, 0);
    for (var i = 0; i < tp.length - 1; i++) if (t < tp[i + 1]) return ponto(cm, i, (t - tp[i]) / Math.max(1, tp[i + 1] - tp[i]));
    return ponto(cm, cm.length - 1, 0);
  };
  function ponto(cm, i, f) {
    var a = H.centroH(cm[i]), j = Math.min(cm.length - 1, i + 1), b = H.centroH(cm[j]);
    if (j === i && i > 0) { var p = H.centroH(cm[i - 1]); return { x: a.x, y: a.y, ang: Math.atan2(a.y - p.y, a.x - p.x), hex: cm[i], i: i }; }
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, ang: Math.atan2(b.y - a.y, b.x - a.x), hex: f < 0.5 ? cm[i] : cm[j], i: i };
  }
  /* fim dos tempos: chegada das próprias, das de aliados e das que vêm a um local seu (paraMim); de outras marchas alheias o servidor
     manda só o trecho à vista, e o fim é quando ela sai da vista (some do mapa) */
  M.chegada = function (o) { return o.tempos && o.tempos.length ? o.tempos[o.tempos.length - 1] : 0; };
  M.chegadaConhecida = function (o) { return o.dono === 'meu' || o.dono === 'aliado' || o.paraMim ? M.chegada(o) : 0; };
  /* marcha alheia que já chegou some do mapa 5 s depois; a própria (e a de aliado) nunca some: o servidor a tira quando acaba */
  M.sumiu = function (o, t) { var c = M.chegada(o); return !!(c && t > c + 5000 && o.dono !== 'meu' && o.dono !== 'aliado'); };
  /* marchas alheias só aparecem enquanto estão onde o reino vê agora */
  M.marchaVisivel = function (o, pos) { return o.dono === 'meu' || o.dono === 'aliado' || M.estado(pos.hex).v === 'visivel'; };

  /* carregamento compartilhado; quem desenha o mundo se declara ativo para receber atualizações ao vivo */
  var pendente = null, ativos = {}, espera = 0;
  M.carregar = function () {
    if (pendente) return pendente;
    pendente = RP.get('/mapa').then(function (d) {
      pendente = null;
      RP.sincronizar(d.agora);
      preparar(d);
      M.dados = d; M.versao++;
      document.dispatchEvent(new CustomEvent('rp:mapa-dados', { detail: d }));
      return d;
    }, function (e) { pendente = null; throw e; });
    return pendente;
  };
  M.garantir = function () { return M.dados ? Promise.resolve(M.dados) : M.carregar(); };
  M.ativar = function (nome) { ativos[nome] = true; };
  M.desativar = function (nome) { delete ativos[nome]; };
  function aoAviso() {
    if (!Object.keys(ativos).length) { M.velho = true; return; }
    clearTimeout(espera);
    espera = setTimeout(function () { M.carregar().catch(function () { /* offline: mantém o último */ }); }, 300);
  }
  RP.ouvir('mapa', aoAviso);
  RP.ouvir('marchas', aoAviso);
  /* ao voltar a uma tela do mundo, recarrega se chegou aviso enquanto ninguém olhava */
  M.emDia = function () { if (M.velho || !M.dados) { M.velho = false; return M.carregar(); } return Promise.resolve(M.dados); };

  /* outra conta (ou reino novo) não vê o mapa da anterior */
  document.addEventListener('rp:tela', function (e) {
    if ((e.detail === 'inicio' || e.detail === 'criar') && M.dados) { M.dados = null; M.versao++; }
  });

  RP.mapaModelo = M;
  MAPA.dados = function () { return M.dados; };
})();
