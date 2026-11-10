/* Reino de Pedra — camada de pessoas na Vista: cada pessoa do reino desenhada onde está (GET /mapa manda
   `pessoas`, com nome, ofício, estado e o hexágono do local; quem está em marcha vai com a marcha).
     trabalhando  ferramenta do ofício, ao lado da construção
     ociosa       parada perto do castelo
     guarnecida   soldados em formação, por unidade (lança e escudo, arco, cavalo); explorador e mensageiro livres
     treinando    estocadas no pátio
     ferida       sentada
   Ninguém do reino fica escondido: quem está sem trabalho fica em volta do castelo conversando, sentado ou passeando; a
   guarnição fica em formação, com um ou outro soldado de ronda; quem trabalha larga a ferramenta de vez em quando para
   levar a carga até a construção ou descansar; explorador parado olha em volta e aponta. O que cada um faz sai do
   relógio e do id da pessoa (cada uma com o próprio compasso), sem nada novo do servidor.
   Com o zoom bem afastado, ou acima de MAX_CASTELO / MAX_LOCAL pessoas no local, vira uma pilha com contador. Pessoas de outros
   reinos à vista (`pessoasOutras`, só contagens) aparecem em roupa crua, sem nome. Cada figura é um alvo de toque
   (ent ['pessoa', id]); a pilha, ['pessoas', hex]. Quem está selecionado (RP.selecao) ganha um círculo azul em volta dos pés. */
(function () {
  'use strict';
  var RP = window.RP, H = RP.hex, A = RP.arte, M = RP.mapaModelo;
  var P = A.P;
  var MAX_FIG = 12, MAX_CASTELO = 64, MAX_LOCAL = 30, ZOOM_PILHA = 1.05;
  var SOLDADOS = { milicia: 1, lanceiro: 1, arqueiro: 1, cavalaria: 1, elite: 1, ariete: 1, trebuchet: 1 };
  var ROUPA = { agricultor: 1, lenhador: 2, pedreiro: 3, mineiro: 3, ocioso: 0, mensageiro: 4 };
  /* ferramenta e roupa de cada ofício civil: reconhecíveis sem texto */
  var OFICIO = {
    agricultor: { ferramenta: 'enxada', chapeu: 'palha', roupa: '#8a7a4a' },
    lenhador: { ferramenta: 'machado', roupa: '#6b4f33', cinto: '#2b2520' },
    pedreiro: { trabalho: 'picareta', roupa: '#8d8578', cinto: '#2b2520' },
    mineiro: { trabalho: 'picareta', roupa: '#5b5f6b', capacete: '#4a3f33' }
  };
  var FAMILIA = { milicia: 'infantaria', lanceiro: 'infantaria', arqueiro: 'arqueiros', cavalaria: 'cavalaria', elite: 'cavalaria', ariete: 'cerco', trebuchet: 'cerco' };
  /* nível das armaduras da família na ferraria do reino (RP.reino.ferraria.forja: "familia:armaduras" → nível) */
  function armadura(oficio) {
    var f = RP.reino && RP.reino.ferraria && RP.reino.ferraria.forja; if (!f) return 1;
    return (f[(FAMILIA[oficio] || 'infantaria') + ':armaduras'] || 0) >= 2 ? f[(FAMILIA[oficio] || 'infantaria') + ':armaduras'] : 1;
  }
  var ultimos = [];   /* figuras desenhadas no último quadro, em coordenadas de tela (para o laço) */
  /* o local do reino num hexágono (para saber se é o castelo); refeito quando o reino muda */
  var locaisHex = null, locaisDe = null;
  function localDoHex(h) {
    var r = RP.reino; if (!r) return null;
    if (locaisDe !== r.locais) { locaisDe = r.locais; locaisHex = {}; (r.locais || []).forEach(function (l) { locaisHex[l.hex] = l; }); }
    return locaisHex[h] || null;
  }
  /* castelos de outros reinos, pelo que o mapa mostra a todos */
  var castelosDe = null, castelosHex = {};
  function castelosAlheios() {
    var d = M.dados;
    if (d && castelosDe !== d.objs) { castelosDe = d.objs; castelosHex = {}; d.objs.forEach(function (o) { if (o.tipo === 'local' && o.local === 'castelo') castelosHex[o.hex] = true; }); }
    return castelosHex;
  }

  function ehSoldado(p) { return !!SOLDADOS[p.oficio]; }
  /* som do trabalho de quem está à vista (RP.sons.mundo): lenhador no machado, pedreiro e mineiro na picareta */
  function somDe(p) {
    if (p.estado !== 'trabalhando' || ehSoldado(p)) return null;
    return p.oficio === 'lenhador' ? 'machado' : p.oficio === 'pedreiro' || p.oficio === 'mineiro' ? 'picareta' : p.oficio === 'agricultor' ? null : 'martelo';
  }
  function ehExplorador(p) { return /^explorador|^prospector|^batedor/.test(p.oficio); }

  /* ---------------------------------------------------------------- onde cada um fica e o que faz agora
     Tudo na frente e dos lados da construção (o sul do mapa), para ninguém passar a vida escondido atrás dela.
     Pontos em unidades do mundo, a partir do centro do local. O castelo ocupa 7 hexágonos; os outros locais, 3. */
  var PONTOS = {
    castelo: {
      encontro: [[24, 46], [48, 30], [62, 8], [14, 66], [44, 60], [-62, 14], [68, 38], [-20, 78]],
      formacao: { x: -46, y: 48, cols: 5 }, livres: { x: 6, y: 84 }, feridos: { x: -72, y: 58 }, treino: { x: 62, y: 56 }, ronda: [66, 50], porta: [0, 30]
    },
    local: {
      encontro: [[32, 24], [-32, 26], [2, 44], [46, 10], [-46, 12]],
      formacao: { x: -16, y: 28, cols: 4 }, livres: { x: 22, y: 40 }, feridos: { x: -44, y: 34 }, treino: { x: 38, y: 34 }, ronda: [46, 30], porta: [0, 16]
    }
  };
  function suave(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); }
  /* a vez de cada pessoa: um trecho de `dur` segundos, com início próprio; k = qual trecho, f = quanto dele já passou */
  function vez(p, t, dur) { var u = (t + (p.id % 97) * 1.37) / dur, k = Math.floor(u); return { k: k, f: u - k }; }
  function sorte(p, k, s) { return A.hash(p.id % 9973, k % 9973, s); }
  function emPe(P0, pt) { return { x: P0.x + pt[0], y: P0.y + pt[1] }; }
  function lado(a, b) { return b.x >= a.x ? 1 : -1; }
  function andar(a, b, f) { var e = suave(f); return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, ang: Math.atan2(b.y - a.y, b.x - a.x), mexe: f > 0.03 && f < 0.97 }; }

  /* quem está sem trabalho: passeia de um ponto de encontro a outro, conversa com quem está no mesmo ponto, ou senta */
  function ocioso(p, t, ce, G, conversa) {
    var dur = 11 + (p.id % 5), v = vez(p, t, dur), n = G.encontro.length;
    /* o ponto em que a pessoa está é o do último passeio (procura para trás; sem passeio recente, o ponto dela) */
    function ponto(k) { var e = G.encontro[Math.floor(sorte(p, k, 31) * n) % n], j = (p.id % 4) - 1.5; return { x: ce.x + e[0] + j * 5.5, y: ce.y + e[1] + ((p.id >> 2) % 3 - 1) * 4, s: Math.floor(sorte(p, k, 31) * n) % n }; }
    function passeia(k) { return sorte(p, k, 32) < 0.38; }
    function onde(k) { for (var i = 0; i < 6; i++) if (passeia(k - i)) return ponto(k - i); return ponto(-1 - (p.id % 7)); }
    var aqui = onde(v.k - 1), r = sorte(p, v.k, 32);
    if (passeia(v.k)) {
      var d = ponto(v.k), m = andar(aqui, d, Math.min(1, v.f / 0.7));
      if (m.mexe) return { x: m.x, y: m.y, dir: lado(aqui, d), extra: { andando: true, ang: m.ang, dir4: true }, s: -1 };
      return { x: d.x, y: d.y, dir: lado(aqui, d), extra: { pose: 'parado' }, s: d.s };
    }
    var olha = ((p.id >> 1) % 2) ? 1 : -1;
    if (r < 0.74) return { x: aqui.x, y: aqui.y, dir: olha, extra: { pose: conversa && conversa[aqui.s] > 1 ? 'conversar' : (r < 0.5 ? 'parado' : 'olhar') }, s: aqui.s, conversa: true };
    return { x: aqui.x, y: aqui.y, dir: olha, extra: { sentado: true }, s: aqui.s };
  }
  /* quem trabalha: quase sempre na ferramenta; de vez em quando leva a carga até a construção e volta, ou descansa */
  function trabalhador(p, i, t, ce, G) {
    var a = 0.45 + (i % 6) * 0.44 + (i >= 6 ? 0.22 : 0), r0 = G === PONTOS.castelo ? 58 : 36;
    var posto = { x: ce.x + Math.cos(a) * r0 * 1.2, y: ce.y + Math.sin(a) * r0 * 0.62 + 8 }, dirP = (p.id + i) % 3 === 0 ? -1 : 1;
    var v = vez(p, t, 9 + (p.id % 4)), r = sorte(p, v.k, 41);
    if (r < 0.64) return { x: posto.x, y: posto.y, dir: dirP, extra: null, trabalha: true };
    if (r < 0.84) {
      var porta = emPe(ce, G.porta), ida = v.f < 0.5, m = ida ? andar(posto, porta, v.f / 0.42) : andar(porta, posto, (v.f - 0.56) / 0.42);
      if (!m.mexe) return { x: m.x, y: m.y, dir: dirP, extra: { pose: 'parado', ferramenta: null, trabalho: null } };
      return { x: m.x, y: m.y, dir: lado(ida ? posto : porta, ida ? porta : posto), extra: { andando: true, ang: m.ang, dir4: true, ferramenta: null, trabalho: null, carga: ida ? CARGA[p.oficio] || 'saco' : null, pose: ida ? 'carregar' : 'andando' } };
    }
    return { x: posto.x, y: posto.y, dir: dirP, extra: { pose: r < 0.93 ? 'parado' : 'olhar', ferramenta: null, trabalho: null } };
  }
  var CARGA = { lenhador: 'tronco', pedreiro: 'minerio', mineiro: 'minerio', agricultor: 'saco' };
  /* a guarnição: em formação; a cada 6 soldados, um faz a ronda em volta do local */
  function soldado(p, i, t, ce, G) {
    var f = G.formacao;
    if (i % 6 === 5 && p.estado !== 'treinando' && !/cavalaria|elite|ariete|trebuchet/.test(p.oficio)) {
      var u = (t / (46 + (p.id % 9)) + (p.id % 13) / 13) * 6.2832, rx = G.ronda[0], ry = G.ronda[1];
      return { x: ce.x + Math.cos(u) * rx, y: ce.y + 10 + Math.sin(u) * ry, dir: -Math.sin(u) >= 0 ? 1 : -1, extra: { andando: true, ang: Math.atan2(Math.cos(u) * ry, -Math.sin(u) * rx) } };
    }
    var n = i - Math.floor((i + 1) / 6), col = n % f.cols, lin = Math.floor(n / f.cols);
    var pos = { x: ce.x + f.x + col * 9 + (lin % 2) * 4.5, y: ce.y + f.y + lin * 8 };
    if (p.estado === 'treinando') {
      var tr = G.treino, v = vez(p, t, 5);
      return { x: ce.x + tr.x + (i % 3) * 9, y: ce.y + tr.y + Math.floor(i / 3) * 8, dir: i % 2 ? -1 : 1, extra: p.oficio === 'lanceiro' && sorte(p, v.k, 51) < 0.4 ? { pose: 'aparar', estocada: false } : null };
    }
    return { x: pos.x, y: pos.y, dir: 1, extra: null };
  }
  /* explorador ou mensageiro esperando ordem: olha em volta, aponta, descansa */
  function livre(p, i, t, ce, G) {
    var v = vez(p, t, 7 + (p.id % 3)), r = sorte(p, v.k, 61), montado = /cavalo/.test(p.oficio) || p.oficio === 'mensageiro';
    return { x: ce.x + G.livres.x + i * 11, y: ce.y + G.livres.y + (i % 2) * 5, dir: sorte(p, v.k, 62) < 0.5 ? -1 : 1, extra: montado ? null : { pose: r < 0.45 ? 'olhar' : r < 0.7 ? 'apontar' : 'parado' } };
  }
  /* todas as pessoas de um local, cada uma no seu lugar de agora: [{ p, x, y, dir, extra, trabalha }] */
  function arrumar(lista, ce, castelo, t) {
    var G = castelo ? PONTOS.castelo : PONTOS.local, out = [], nS = 0, nL = 0, nF = 0, nT = 0, ociosos = [];
    lista.forEach(function (p) {
      var o;
      if (p.estado === 'ferida') { o = { x: ce.x + G.feridos.x + (nF % 4) * 8, y: ce.y + G.feridos.y + Math.floor(nF / 4) * 8, dir: nF % 2 ? -1 : 1, extra: null }; nF++; }
      else if (ehSoldado(p)) o = soldado(p, nS++, t, ce, G);
      else if (ehExplorador(p) || p.oficio === 'mensageiro') o = p.estado === 'treinando' ? { x: ce.x + G.treino.x + 6 + nL * 8, y: ce.y + G.treino.y - 10, dir: 1, extra: null } : livre(p, nL++, t, ce, G);
      else if (p.estado === 'trabalhando' || p.estado === 'carregando') o = trabalhador(p, nT++, t, ce, G);
      else if (p.estado === 'treinando') { o = { x: ce.x + G.treino.x + (nS % 3) * 9, y: ce.y + G.treino.y + 16, dir: -1, extra: null }; }
      else { ociosos.push(p); return; }
      o.p = p; out.push(o);
    });
    /* quem conversa precisa de companhia: conta quem está parado em cada ponto de encontro e só então escolhe a pose */
    var conta = {}, meio = {}, previa = ociosos.map(function (p) { var o = ocioso(p, t, ce, G, null); if (o.conversa) { conta[o.s] = (conta[o.s] || 0) + 1; meio[o.s] = (meio[o.s] || 0) + o.x; } return o; });
    ociosos.forEach(function (p, i) {
      var o = previa[i].conversa ? ocioso(p, t, ce, G, conta) : previa[i];
      /* quem conversa olha para a roda */
      if (o.conversa && conta[o.s] > 1) o.dir = meio[o.s] / conta[o.s] >= o.x ? 1 : -1;
      o.p = p; out.push(o);
    });
    return out;
  }

  /* figura de uma pessoa (o.cor: cor do dono, para soldados; roupa crua sem dono), pelos sprites pré-desenhados */
  /* extra: opções da marcha por cima das do ofício ({ andando, correndo, ang, trabalho, ferramenta, carga, estocada, atirando }) */
  function figura(c, p, t, dir, cor, cru, extra) {
    var fase = (p.id % 13) * 0.53, est = p.estado, S = RP.sprites, ex = extra || {};
    function op(o) { o.dir = dir; o.fase = fase; o.semente = p.id; o.feminina = cru ? null : p.feminina; return Object.assign(o, ex); }
    if (ehSoldado(p)) {
      var roupa = cru ? '#a39d90' : cor, arm = cru ? 1 : armadura(p.oficio), metal = arm >= 3 ? '#c9d1d9' : arm >= 2 ? '#aeb6be' : P.metal;
      if (p.oficio === 'cavalaria' || p.oficio === 'elite') {
        A.cavalo(c, 0, 0, t, P, op({ pelagem: p.id % 5, andando: !!ex.andando, galope: !!ex.correndo, cavaleiro: roupa, capacete: metal, armadura: p.oficio === 'elite' ? Math.max(2, arm) : arm, lanca: true, escudo: p.oficio === 'elite' ? roupa : null }));
        return;
      }
      if (p.oficio === 'ariete' || p.oficio === 'trebuchet') { S.pessoa(c, 0, 0, t, op({ roupa: roupa, cinto: P.cinto, capacete: metal, armadura: arm, trabalho: est === 'treinando' ? 'martelo' : null })); return; }
      if (p.oficio === 'arqueiro') { S.pessoa(c, 0, 0, t, op({ roupa: roupa, cinto: P.cinto, capacete: metal, armadura: arm, arco: true, atirando: est === 'treinando' })); return; }
      S.pessoa(c, 0, 0, t, op({ roupa: roupa, cinto: P.cinto, capacete: p.oficio === 'milicia' ? null : metal, armadura: p.oficio === 'milicia' ? 1 : arm, lanca: true, escudo: p.oficio === 'milicia' ? null : roupa, estocada: est === 'treinando' }));
      return;
    }
    if (ehExplorador(p)) {
      if (/cavalo/.test(p.oficio)) { A.cavalo(c, 0, 0, t, P, op({ pelagem: (p.id + 2) % 5, andando: !!ex.andando, galope: !!(ex.andando || ex.correndo), pastando: !ex.andando && ex.pose === 'olhar', cavaleiro: '#6b5a3a', capuz: '#4a3d28' })); return; }
      S.pessoa(c, 0, 0, t, op({ roupa: /batedor/.test(p.oficio) ? '#2f3a2c' : '#6b5a3a', capuz: /batedor/.test(p.oficio) ? '#26301f' : null, carga: /prospector/.test(p.oficio) ? 'picareta' : null }));
      return;
    }
    if (p.oficio === 'mensageiro') { S.pessoa(c, 0, 0, t, op({ roupa: P.roupa[4], bandeira: '#f3efe4' })); return; }
    var of = OFICIO[p.oficio] || {}, roupaC = cru ? '#a39d90' : of.roupa || P.roupa[(ROUPA[p.oficio] != null ? ROUPA[p.oficio] : p.id) % 5];
    if (est === 'ferida') { S.pessoa(c, 0, 0, t, op({ roupa: roupaC, sentado: true })); return; }
    if (est === 'treinando') { S.pessoa(c, 0, 0, t, op({ roupa: roupaC, cinto: P.cinto, lanca: true, estocada: true })); return; }
    var o = { roupa: roupaC, chapeu: cru ? null : of.chapeu, cinto: of.cinto, capacete: of.capacete };
    if (est === 'trabalhando') { if (of.ferramenta) o.ferramenta = of.ferramenta; else o.trabalho = of.trabalho || 'martelo'; }
    else if (est === 'carregando') o.carga = 'saco';
    S.pessoa(c, 0, 0, t, op(o));
  }

  /* vida de agora (a recuperação anda entre as cargas do mapa) e barra sobre a figura de quem está ferido (cheia, não aparece) */
  function vidaAgora(p) {
    if (!p || p.vidaMax == null || p.vida == null) return null;
    var d = M.dados, h = d && d.recebidoEm ? Math.max(0, RP.agora() - d.recebidoEm) / 3600000 : 0;
    return Math.min(p.vidaMax, p.vida + (p.vidaH || 0) * h);
  }
  function barraVida(c, p, y) {
    var v = vidaAgora(p); if (v == null || v >= p.vidaMax - 0.05) return;
    var f = Math.max(0, v / p.vidaMax), Cs = A.cores(), w = 14, yy = y == null ? -A.emPe(24) - 6 : y;
    c.fillStyle = 'rgba(20,16,12,0.7)'; c.fillRect(-w / 2 - 1, yy - 1, w + 2, 4);
    c.fillStyle = f > 0.6 ? Cs.sucesso : f > 0.3 ? Cs.alerta : Cs.perigo; c.fillRect(-w / 2, yy, w * f, 2);
  }

  /* círculo azul em volta dos pés de quem está selecionado: deitado no chão, com borda clara para aparecer em qualquer
     terreno, e pulsando de leve. Quem monta tem um círculo maior. */
  function anel(c, p, t) {
    var r = (/cavalaria|elite|cavalo/.test(p.oficio) ? 15 : 10) * (1 + Math.sin(t * 5) * 0.06), a0 = c.globalAlpha, cor = A.cores().selecaoPes;
    c.beginPath(); c.ellipse(0, 0.6, r, r * A.K, 0, 0, 6.2832);
    c.fillStyle = cor; c.globalAlpha = a0 * 0.3; c.fill();
    c.globalAlpha = a0; c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 3.6; c.stroke();
    c.strokeStyle = cor; c.lineWidth = 2.4; c.stroke();
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
        var loc = localDoHex(h), castelo = !!(loc && loc.tipo === 'castelo');
        var pilha = s < ZOOM_PILHA || lista.length > (castelo ? MAX_CASTELO : MAX_LOCAL);
        if (pilha) {
          /* na pilha, quem está selecionado vem na frente, para o círculo aparecer */
          var marcados = sel ? lista.filter(function (p) { return sel.tem(p.id); }) : [];
          var mostra = marcados.concat(lista.filter(function (p) { return marcados.indexOf(p) < 0; })).slice(0, 3), ns = lista.filter(ehSoldado).length, nc = lista.length - ns;
          mostra.forEach(function (p, i) {
            var x = ce.x - 6 + i * 6, y = ce.y + 22 + (i % 2) * 2;
            q.itens.push({ y: y, x: x, silhueta: true, d: function () { q.obj(x, y); if (sel && sel.tem(p.id)) anel(c, p, q.t); figura(c, p, q.t, 1, q.cor, false); } });
          });
          var txt = (nc ? nc + (nc === 1 ? ' pessoa' : ' pessoas') : '') + (nc && ns ? ' · ' : '') + (ns ? ns + (ns === 1 ? ' soldado' : ' soldados') : '');
          var selN = sel ? lista.filter(function (p) { return sel.tem(p.id); }).length : 0;
          q.rot(ce.x, ce.y + 22, selN ? 22 : 10, (selN ? selN + ' sel · ' : '') + txt, selN ? 'selecao' : 'marcha', selN ? Cs.selecao : Cs.meu);
          q.itens.push({ y: ce.y + 22, d: function () {}, alvo: q.alvo(ce.x, ce.y + 24, 40, 24, ['pessoas', h], { hex: h }) });
          lista.forEach(function (p) { var tp = q.cena.tela(ce.x, ce.y + 22); ultimos.push({ id: p.id, x: tp.x, y: tp.y, hex: h }); });
          return;
        }
        arrumar(lista, ce, castelo, q.t).forEach(function (pp) {
          var p = pp.p, selecionada = sel && sel.tem(p.id);
          q.itens.push({ y: pp.y, x: pp.x, silhueta: true, som: pp.trabalha ? somDe(p) : null, d: function () {
            q.obj(pp.x, pp.y);
            if (selecionada) anel(c, p, q.t);
            figura(c, p, q.t, pp.dir, q.cor, false, pp.extra);
            barraVida(c, p);
          }, alvo: q.alvo(pp.x, pp.y, 14, 28, ['pessoa', p.id], p) });
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
        /* o mesmo vaivém das pessoas do reino: a contagem continua arredondada e ninguém tem nome nem cor */
        arrumar(lista, ce, castelosAlheios()[o.hex] === true, q.t).forEach(function (pp) {
          q.itens.push({ y: pp.y, x: pp.x, silhueta: true, d: function () { q.obj(pp.x, pp.y); figura(c, pp.p, q.t, pp.dir, P.hostil, true, pp.extra); } });
        });
        if (n < (o.civis || 0) + (o.soldados || 0)) q.rot(ce.x, ce.y + 22, 10, ((o.civis || 0) + (o.soldados || 0)) + ' pessoas', 'marcha', '#a39d90');
      });
    },
    ehSoldado: ehSoldado,
    ehExplorador: ehExplorador,
    /* círculo azul de quem está selecionado, nos pés da figura: anel(c, pessoa, t) */
    anel: anel,
    /* figura de uma pessoa fora dos locais (marchas): figura(c, pessoa, t, dir, cor, cru, extra) */
    figura: figura,
    /* barra de vida sobre a figura (só de quem está ferido) e a vida de agora de uma pessoa do mapa */
    barraVida: barraVida,
    vidaAgora: vidaAgora
  };
})();
