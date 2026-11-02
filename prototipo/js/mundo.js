/* Reino de Pedra — modelo do mundo do protótipo (compartilhado pelo mapa tático e pela vista).
   Terreno, rios, rotas, névoa, marchas, fauna, perigo e ruínas. Tudo derivado de dados fixos;
   posições de marchas e animais dependem do relógio para dar vida às telas. */
(function () {
  'use strict';
  var RP = window.RP, H = RP.hex, D = RP.dados;

  var forcados = D.locais.map(function (x) { return [x.c, x.l, x.terreno]; })
    .concat(D.jazidas.map(function (j) { return [j.c, j.l, j.terreno]; }))
    .concat(D.ruinas.map(function (r) { return [r.c, r.l, r.terreno]; }));
  var T = H.gerarTerreno(forcados);
  var rios = H.FEICOES.rios.map(function (r) { return H.caminho(r); });
  var rioSet = {};
  rios.forEach(function (r) { r.forEach(function (h) { rioSet[h[0] + ',' + h[1]] = 1; }); });
  var rotas = D.rotas.map(function (r) { return { d: r, hexes: H.caminho(r.pts) }; });
  var rotaSet = {};
  rotas.forEach(function (r) { r.hexes.forEach(function (h) { rotaSet[h[0] + ',' + h[1]] = 1; }); });

  function k(c, l) { return c + ',' + l; }
  function dentro(c, l) { return c >= 0 && l >= 0 && c < H.COLS && l < H.LINS; }
  function noRaio(c, l, raio, fn) {
    for (var ll = l - raio; ll <= l + raio; ll++) {
      for (var cc = c - raio - 1; cc <= c + raio + 1; cc++) {
        if (dentro(cc, ll) && H.dist([c, l], [cc, ll]) <= raio) fn(cc, ll);
      }
    }
  }

  /* ---------------------------------------------------------------- caminhos */
  function pontosCaminho(hexes) { return hexes.map(function (h) { return H.centro(h[0], h[1]); }); }
  function comprimento(p) { var s = 0; for (var i = 1; i < p.length; i++) s += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y); return s; }
  function pontoEm(p, frac) {
    var alvo = comprimento(p) * Math.max(0, Math.min(1, frac)), s = 0, i, seg;
    for (i = 1; i < p.length; i++) {
      seg = Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
      if (s + seg >= alvo) {
        var t = seg ? (alvo - s) / seg : 0;
        return { x: p[i - 1].x + (p[i].x - p[i - 1].x) * t, y: p[i - 1].y + (p[i].y - p[i - 1].y) * t, i: i, ang: Math.atan2(p[i].y - p[i - 1].y, p[i].x - p[i - 1].x) };
      }
      s += seg;
    }
    var n = p.length - 1;
    return { x: p[n].x, y: p[n].y, i: n, ang: Math.atan2(p[n].y - p[n - 1].y, p[n].x - p[n - 1].x) };
  }

  /* Marchas avançam em tempo real até a chegada */
  var marchas = D.marchas.map(function (m) {
    var hexes = H.caminho(m.pts), p = pontosCaminho(hexes);
    var o = { d: m, hexes: hexes, p: p };
    o.posicao = function (agora) {
      var dec = ((agora || Date.now()) - RP.t0) / 1000;
      var frac = m.pos + (1 - m.pos) * Math.min(1, dec / m.seg);
      var a = pontoEm(p, frac), h = H.pixelParaHex(a.x, a.y);
      a.hex = [h.c, h.l]; a.frac = frac;
      return a;
    };
    var ini = o.posicao(RP.t0);
    o.atual = ini; o.hex = ini.hex;
    return o;
  });

  /* ---------------------------------------------------------------- visão e névoa */
  var EST = {};
  D.explorado.forEach(function (a) {
    noRaio(a.c, a.l, a.raio, function (c, l) {
      var e = EST[k(c, l)];
      if (!e || e.horas > a.horas) EST[k(c, l)] = { v: 'explorado', horas: a.horas };
    });
  });
  function raioVisao(m) { return m.d.tipo === 'explorador' ? D.visao.explorador[m.d.sub] : D.visao.exercito; }
  marchas.forEach(function (m) {
    if (m.d.dono !== 'meu') return;
    for (var i = 0; i < m.atual.i; i++) {
      noRaio(m.hexes[i][0], m.hexes[i][1], raioVisao(m), function (c, l) {
        var e = EST[k(c, l)];
        if (!e || e.horas > 1) EST[k(c, l)] = { v: 'explorado', horas: 1 };
      });
    }
  });
  function ver(c, l, raio) { noRaio(c, l, raio, function (cc, ll) { EST[k(cc, ll)] = { v: 'visivel', horas: 0 }; }); }
  D.locais.forEach(function (x) { if (x.reino === 'meu') ver(x.c, x.l, x.tipo === 'castelo' ? D.visao.castelo : D.visao.local); });
  marchas.forEach(function (m) { if (m.d.dono === 'meu') ver(m.hex[0], m.hex[1], raioVisao(m)); });
  function estado(c, l) { return EST[k(c, l)] || { v: 'desconhecido' }; }

  /* ---------------------------------------------------------------- fauna e perigo */
  var NIVEIS = ['baixo', 'medio', 'alto'];
  var NOME_NIVEL = { baixo: 'Baixo', medio: 'Médio', alto: 'Alto' };
  var ANIMAL = {
    lobos: { nome: 'Lobos', um: 'lobo', icone: 'lobo' },
    javalis: { nome: 'Javalis', um: 'javali', icone: 'javali' },
    ursos: { nome: 'Ursos', um: 'urso', icone: 'urso' },
    crocodilos: { nome: 'Crocodilos', um: 'crocodilo', icone: 'crocodilo' }
  };
  var castelo = D.locais.filter(function (x) { return x.id === 'castelo'; })[0];
  var PERIGO = {};
  D.fauna.forEach(function (f) {
    f.centro = H.centro(f.c, f.l);
    noRaio(f.c, f.l, f.raio, function (c, l) {
      var n = NIVEIS.indexOf(f.nivel);
      if (rotaSet[k(c, l)]) n -= 1;                                      /* rotas reduzem a presença */
      if (H.dist([c, l], [castelo.c, castelo.l]) <= 4) n = Math.min(n, 0); /* fauna fraca perto do reino inicial */
      if (n < 0) return;
      var atual = PERIGO[k(c, l)];
      if (!atual || NIVEIS.indexOf(atual.nivel) < n) PERIGO[k(c, l)] = { nivel: NIVEIS[n], fauna: f };
    });
  });
  /* posição do bando: passeia pelo território ao longo do tempo */
  function posFauna(f, t) {
    var ph = H.hash(f.c, f.l, 31) * 6.28;
    var r = f.raio * H.W * 0.45;
    var x = f.centro.x + Math.sin(t / 47 + ph) * r * 0.8 + Math.sin(t / 13 + ph * 2) * r * 0.2;
    var y = f.centro.y + Math.cos(t / 59 + ph) * r * 0.7;
    var h = H.pixelParaHex(x, y);
    return { x: x, y: y, hex: [h.c, h.l] };
  }
  function faunaVisivel(f, t) {
    var p = posFauna(f, t === undefined ? performance.now() / 1000 : t);
    return estado(p.hex[0], p.hex[1]).v === 'visivel' ? p : null;
  }
  function perigoHex(c, l) {
    var e = estado(c, l);
    if (e.v === 'desconhecido') return null;
    return PERIGO[k(c, l)] || null;
  }
  /* risco de uma marcha pequena passar por área perigosa (exploradores sozinhos, grupos pequenos) */
  function riscoMarcha(m) {
    if (m.d.dono !== 'meu') return null;
    var pior = null;
    m.hexes.slice(Math.max(0, m.atual.i - 1)).forEach(function (h) {
      var p = perigoHex(h[0], h[1]);
      if (p && (!pior || NIVEIS.indexOf(p.nivel) > NIVEIS.indexOf(pior.nivel))) pior = p;
    });
    return pior;
  }

  /* ---------------------------------------------------------------- índices por hex */
  var porHex = {};
  function indexar(tipo, obj, c, l) { (porHex[k(c, l)] = porHex[k(c, l)] || []).push({ tipo: tipo, o: obj }); }
  D.locais.forEach(function (x) { indexar('local', x, x.c, x.l); });
  D.jazidas.forEach(function (j) { indexar('jazida', j, j.c, j.l); });
  D.ruinas.forEach(function (r) { indexar('ruina', r, r.c, r.l); });
  D.bandeiras.forEach(function (b) { indexar('bandeira', b, b.c, b.l); });
  rotas.forEach(function (r) { r.hexes.forEach(function (h) { indexar('rota', r.d, h[0], h[1]); }); });
  D.vaus.forEach(function (v) { indexar('vau', v, v.c, v.l); });

  /* Explorar não revela o dono de locais de outros reinos (só o seu é conhecido) */
  var NOME_TIPO = { castelo: 'Castelo', vila: 'Vila', mina: 'Mina', serraria: 'Serraria', pasto: 'Pasto', armazem: 'Armazém', ferraria: 'Ferraria', quartel: 'Quartel' };
  function donoAparente(reino) { return reino === 'meu' ? 'meu' : 'desconhecido'; }
  function nomeAparente(x) { return x.reino === 'meu' ? x.nome : NOME_TIPO[x.tipo]; }

  function achar(lista, id) { return lista.filter(function (x) { return x.id === id; })[0]; }

  RP.mundo = {
    T: T, rios: rios, rioSet: rioSet, rotas: rotas, rotaSet: rotaSet, marchas: marchas, porHex: porHex,
    chave: k, dentro: dentro, noRaio: noRaio, estado: estado, donoAparente: donoAparente, nomeAparente: nomeAparente,
    pontoEm: pontoEm, comprimento: comprimento,
    NIVEIS: NIVEIS, NOME_NIVEL: NOME_NIVEL, ANIMAL: ANIMAL,
    posFauna: posFauna, faunaVisivel: faunaVisivel, perigoHex: perigoHex, riscoMarcha: riscoMarcha,
    local: function (id) { return achar(D.locais, id); },
    jazida: function (id) { return achar(D.jazidas, id); },
    ruina: function (id) { return achar(D.ruinas, id); },
    bandeira: function (id) { return achar(D.bandeiras, id); },
    fauna: function (id) { return achar(D.fauna, id); },
    marcha: function (id) { return marchas.filter(function (m) { return m.d.id === id; })[0]; },
    castelo: function () { return H.centro(castelo.c, castelo.l); }
  };
})();
