/* Reino de Pedra — camada de pessoas na Vista: cada pessoa do reino desenhada onde está (GET /mapa manda
   `pessoas`, com nome, ofício, estado e o hexágono do local; quem está em marcha vai com a marcha).
     trabalhando  ferramenta do ofício, ao lado da construção
     ociosa       parada perto do castelo
     guarnecida   soldados em formação, por unidade (lança e escudo, arco, cavalo); explorador e mensageiro livres
     treinando    estocadas no pátio
     ferida       sentada
   Com o zoom afastado, ou com mais de MAX_FIG pessoas no hexágono, vira uma pilha com contador. Pessoas de outros
   reinos à vista (`pessoasOutras`, só contagens) aparecem em roupa crua, sem nome. Cada figura é um alvo de toque
   (ent ['pessoa', id]); a pilha, ['pessoas', hex]. A seleção (RP.selecao) ganha um anel no chão. */
(function () {
  'use strict';
  var RP = window.RP, H = RP.hex, A = RP.arte, M = RP.mapaModelo;
  var P = A.P;
  var MAX_FIG = 12, ZOOM_PILHA = 1.25;
  var SOLDADOS = { milicia: 1, lanceiro: 1, arqueiro: 1, cavalaria: 1, elite: 1, ariete: 1, trebuchet: 1 };
  var ROUPA = { agricultor: 1, lenhador: 2, pedreiro: 3, mineiro: 3, ocioso: 0, mensageiro: 4 };
  var FERRAMENTA = { agricultor: 'picareta', lenhador: 'picareta', pedreiro: 'picareta', mineiro: 'picareta' };
  var ultimos = [];   /* figuras desenhadas no último quadro, em coordenadas de tela (para o laço) */

  function ehSoldado(p) { return !!SOLDADOS[p.oficio]; }
  function ehExplorador(p) { return /^explorador|^prospector|^batedor/.test(p.oficio); }

  /* posição de cada pessoa em volta do local: soldados em formação ao sul; civis em arco pelos lados; estável pela ordem */
  function posicoes(pessoas, centro) {
    var sold = pessoas.filter(ehSoldado), civ = pessoas.filter(function (p) { return !ehSoldado(p); }), out = {};
    /* tudo na frente da construção (sul), para ninguém ficar escondido atrás dela */
    sold.forEach(function (p, i) {
      var col = i % 4, lin = Math.floor(i / 4);
      out[p.id] = { x: centro.x - 12 + col * 8 + (lin % 2) * 4, y: centro.y + 26 + lin * 7 };
    });
    civ.forEach(function (p, i) {
      var a = 0.3 + (i % 7) * 0.41 + (i >= 7 ? 0.2 : 0), r = 30 + (i >= 7 ? 10 : 0) + (i % 2) * 4;
      out[p.id] = { x: centro.x + Math.cos(a) * r * 1.3, y: centro.y + Math.sin(a) * r * 0.5 + 8 };
    });
    return out;
  }

  /* figura de uma pessoa (o.cor: cor do dono, para soldados; roupa crua sem dono) */
  function figura(c, p, t, dir, cor, cru) {
    var fase = (p.id % 13) * 0.53, est = p.estado;
    if (ehSoldado(p)) {
      var roupa = cru ? '#a39d90' : cor, metal = P.metal;
      if (p.oficio === 'cavalaria' || p.oficio === 'elite') { A.cavalo(c, 0, 0, t, P, { cor: P.cavalo[p.id % 4], dir: dir, andando: false, fase: fase, cavaleiro: roupa, capacete: metal }); return; }
      if (p.oficio === 'ariete' || p.oficio === 'trebuchet') { A.pessoa(c, 0, 0, t, P, { roupa: roupa, cinto: P.cinto, dir: dir, fase: fase, capacete: metal, trabalho: est === 'treinando' ? 'martelo' : null }); return; }
      if (p.oficio === 'arqueiro') { A.pessoa(c, 0, 0, t, P, { roupa: roupa, cinto: P.cinto, dir: dir, fase: fase, capacete: metal, arco: true, atirando: est === 'treinando' }); return; }
      A.pessoa(c, 0, 0, t, P, { roupa: roupa, cinto: P.cinto, dir: dir, fase: fase, capacete: p.oficio === 'milicia' ? null : metal, lanca: true, escudo: p.oficio === 'milicia' ? null : roupa, estocada: est === 'treinando' });
      return;
    }
    if (ehExplorador(p)) { A.pessoa(c, 0, 0, t, P, { roupa: /batedor/.test(p.oficio) ? '#2f3a2c' : '#6b5a3a', capuz: /batedor/.test(p.oficio) ? '#26301f' : null, dir: dir, fase: fase, carga: /prospector/.test(p.oficio) ? 'picareta' : null }); return; }
    if (p.oficio === 'mensageiro') { A.pessoa(c, 0, 0, t, P, { roupa: P.roupa[4], dir: dir, fase: fase }); A.bandeira(c, -dir * 3, -18, 14, '#f3efe4', t, 8, 6); return; }
    var roupaC = cru ? '#a39d90' : P.roupa[(ROUPA[p.oficio] != null ? ROUPA[p.oficio] : p.id) % 5];
    if (est === 'ferida') { A.pessoa(c, 0, 0, t, P, { roupa: roupaC, dir: dir, sentado: true, fase: fase }); return; }
    if (est === 'treinando') { A.pessoa(c, 0, 0, t, P, { roupa: roupaC, cinto: P.cinto, dir: dir, fase: fase, lanca: true, estocada: true }); return; }
    A.pessoa(c, 0, 0, t, P, { roupa: roupaC, dir: dir, fase: fase, trabalho: est === 'trabalhando' ? (FERRAMENTA[p.oficio] || 'martelo') : null });
  }

  function anel(c, cor) {
    c.strokeStyle = cor; c.lineWidth = 1.4; c.globalAlpha = 0.9;
    c.beginPath(); c.ellipse(0, 0.5, 6.5, 6.5 * A.K * 0.55, 0, 0, 6.2832); c.stroke(); c.globalAlpha = 1;
  }

  var V = RP.pessoasVista = {
    ultimos: function () { return ultimos; },
    /* chamado pela Vista a cada quadro. q = { c, V, obj(x,y), alvo(x,y,w,h,ent,o), itens, rot, t, ag, s, naTela, cor } */
    desenhar: function (q) {
      var d = M.dados; if (!d) return;
      var sel = RP.selecao, Cs = A.cores(), s = q.s, c = q.c;
      ultimos = [];
      var porHex = d.pessoasPorHex || {};
      Object.keys(porHex).forEach(function (hs) {
        var h = +hs, lista = porHex[h], ce = H.centroH(h);
        if (!lista.length || !q.naTela(ce.x, ce.y)) return;
        var pilha = s < ZOOM_PILHA || lista.length > MAX_FIG;
        if (pilha) {
          var mostra = lista.slice(0, 3), ns = lista.filter(ehSoldado).length, nc = lista.length - ns;
          mostra.forEach(function (p, i) {
            var x = ce.x - 6 + i * 6, y = ce.y + 22 + (i % 2) * 2;
            q.itens.push({ y: y, d: function () { q.obj(x, y); figura(c, p, q.t, 1, q.cor, false); } });
          });
          var txt = (nc ? nc + (nc === 1 ? ' pessoa' : ' pessoas') : '') + (nc && ns ? ' · ' : '') + (ns ? ns + (ns === 1 ? ' soldado' : ' soldados') : '');
          var selN = sel ? lista.filter(function (p) { return sel.tem(p.id); }).length : 0;
          q.rot(ce.x, ce.y + 22, 10, (selN ? selN + ' sel · ' : '') + txt, selN ? 'selecao' : 'marcha', selN ? Cs.selecao : Cs.meu);
          q.itens.push({ y: ce.y + 22, d: function () {}, alvo: q.alvo(ce.x, ce.y + 24, 40, 24, ['pessoas', h], { hex: h }) });
          lista.forEach(function (p) { var tp = q.cena.tela(ce.x, ce.y + 22); ultimos.push({ id: p.id, x: tp.x, y: tp.y, hex: h }); });
          return;
        }
        var pos = posicoes(lista, ce);
        lista.forEach(function (p, i) {
          var pp = pos[p.id], dir = (p.id + i) % 3 === 0 ? -1 : 1, selecionada = sel && sel.tem(p.id);
          q.itens.push({ y: pp.y, d: function () {
            q.obj(pp.x, pp.y);
            if (selecionada) anel(c, Cs.selecao);
            figura(c, p, q.t, dir, q.cor, false);
          }, alvo: q.alvo(pp.x, pp.y, 12, 22, ['pessoa', p.id], p) });
          var tp = q.cena.tela(pp.x, pp.y);
          ultimos.push({ id: p.id, x: tp.x, y: tp.y, hex: h });
        });
      });
      /* outros reinos: figuras sem nome nem dono, só onde se vê agora */
      (d.pessoasOutras || []).forEach(function (o) {
        var ce = H.centroH(o.hex);
        if (!q.naTela(ce.x, ce.y) || M.estado(o.hex).v !== 'visivel') return;
        var n = Math.min(MAX_FIG, (o.civis || 0) + (o.soldados || 0)), lista = [];
        for (var i = 0; i < n; i++) lista.push({ id: o.hex * 100 + i, oficio: i < (o.soldados || 0) ? 'lanceiro' : 'ocioso', estado: i < (o.soldados || 0) ? 'guarnecida' : 'ociosa' });
        var pos = posicoes(lista, ce);
        lista.forEach(function (p, i) {
          var pp = pos[p.id];
          q.itens.push({ y: pp.y, d: function () { q.obj(pp.x, pp.y); figura(c, p, q.t, i % 2 ? -1 : 1, P.hostil, true); } });
        });
        if (n < (o.civis || 0) + (o.soldados || 0)) q.rot(ce.x, ce.y + 22, 10, ((o.civis || 0) + (o.soldados || 0)) + ' pessoas', 'marcha', '#a39d90');
      });
    },
    ehSoldado: ehSoldado,
    ehExplorador: ehExplorador
  };
})();
