/* Reino de Pedra — batalha animada na Vista: no hexágono de uma batalha em andamento (objeto `batalha` do mapa, com
   `fim` e `papel`), duas fileiras de figuras lutam até o fim previsto: estocadas, flechas e poeira. É só animação:
   o resultado vem da fórmula do servidor (#/batalha mostra a série). O combate registra a folha e o Mapa tático;
   aqui entra só o desenho da Vista (e o rótulo com o tempo que falta). */
(function () {
  'use strict';
  var RP = window.RP, A = RP.arte, P = A.P;
  var tb = RP.mapa.tiposObjeto.batalha = RP.mapa.tiposObjeto.batalha || {};

  tb.alvo = { w: 64, h: 40 };
  tb.rotuloDy = -46;
  tb.rotulo = function (o, info) {
    var ag = info.agora || RP.agora();
    return { txt: 'Batalha' + (o.fim && o.fim > ag ? ' · ' + RP.fmtResta(o.fim - ag) : ''), cls: 'perigo', cor: A.cores().perigo };
  };
  tb.desenharCena = function (c, o, info) {
    var t = info.t, Cs = A.cores(), S = RP.sprites;
    var corAtk = o.papel === 'ataque' ? Cs.meu : P.hostil, corDef = o.papel === 'defesa' ? Cs.meu : o.papel === 'ataque' ? P.hostil : Cs.desconhecido;
    var escAtk = o.papel === 'ataque' ? Cs.meu : P.hostilEscudo, escDef = o.papel === 'defesa' ? Cs.meu : P.hostilEscudo;
    /* poeira da luta */
    for (var w = 0; w < 4; w++) {
      var a = (t * 0.6 + w / 4) % 1;
      A.elipse(c, (w - 1.5) * 9 + Math.sin(w * 3) * 4, 2 - a * 5, 5 + a * 7, 2.5 + a * 3, 'rgba(160,140,110,' + (0.28 * (1 - a)).toFixed(2) + ')');
    }
    /* fileiras: atacantes vindos da esquerda, defensores à direita; cada figura com a própria fase */
    for (var i = 0; i < 5; i++) {
      var lin = i % 2, col = Math.floor(i / 2), caiu = A.hash(i, 7, Math.floor(t / 3)) > 0.86;
      var xa = -14 - col * 9 - lin * 4, ya = (lin - 0.5) * 9 + col * 2, xd = 14 + col * 9 + lin * 4, yd = (lin - 0.5) * 9 - col * 2;
      if (!caiu) S.pessoa(c, xa, ya, t, { roupa: corAtk, cinto: P.cinto, dir: 1, fase: i * 1.1, capacete: o.papel === 'ataque' ? P.metal : P.hostilEsc, lanca: i !== 2, escudo: escAtk, estocada: true, arco: i === 2, atirando: i === 2 });
      else S.pessoa(c, xa, ya, t, { roupa: corAtk, dir: 1, sentado: true });
      var caiuD = A.hash(i, 11, Math.floor(t / 3)) > 0.86;
      if (!caiuD) S.pessoa(c, xd, yd, t, { roupa: corDef, cinto: P.cinto, dir: -1, fase: i * 0.9 + 0.5, capacete: o.papel === 'defesa' ? P.metal : P.hostilEsc, lanca: i !== 1, escudo: escDef, estocada: true, arco: i === 1, atirando: i === 1 });
      else S.pessoa(c, xd, yd, t, { roupa: corDef, dir: -1, sentado: true });
    }
    /* flechas cruzando */
    for (var f = 0; f < 3; f++) {
      var k = (t * 0.9 + f / 3) % 1, de = f % 2 ? -1 : 1;
      var fx = de * (26 - 52 * k), fy = -12 - Math.sin(k * Math.PI) * 10 + (f - 1) * 3;
      A.linha(c, fx - de * 3, fy + 0.4, fx + de * 3, fy - 0.4, P.madeiraEsc, 0.8);
    }
    /* clarão das espadas */
    if (Math.sin(t * 9) > 0.92) { c.fillStyle = 'rgba(255,245,200,.7)'; c.beginPath(); c.arc(Math.sin(t * 7) * 8, -8, 1.6, 0, 6.2832); c.fill(); }
  };
})();
