/* Reino de Pedra — batalha animada na Vista: no hexágono de uma batalha em andamento (objeto `batalha` do mapa), a luta
   acontece à vista, na frente da construção (que fica meio transparente enquanto durar, ver cena.js): a linha de quem
   defende de costas para o local, a de quem ataca de frente para ela, estocadas, escudos, flechas e poeira.

   Perdas à vista, só com o que a batalha já mostra a quem olha (a barra de força e as baixas ao vivo):
     - quantos ficam em pé de cada lado sai da PARTE da força de cada um (a barra) e do andamento da batalha, nunca do
       tamanho de verdade: 50 contra 50 e 5 contra 5 começam iguais na tela. Conforme um lado perde força, some gente dele.
     - cada baixa nova (o contador público) derruba um combatente daquele lado: ele cai de costas, fica no chão um tempo e
       some. O ritmo das quedas é o ritmo das baixas.
   É só desenho: o resultado vem da fórmula do servidor (#/batalha mostra a série). */
(function () {
  'use strict';
  var RP = window.RP, A = RP.arte, P = A.P;
  var tb = RP.mapa.tiposObjeto.batalha = RP.mapa.tiposObjeto.batalha || {};
  var LINHA = 7, CORPOS = 7, QUEDA_S = 0.75, CORPO_S = 16, ENTRA_S = 0.9, FOLGA = 21;   /* FOLGA: o chão entre as duas linhas */
  /* a cor de um reino numa batalha de que você não participa: a do brasão dele (a sua e a dos aliados, as de sempre) */
  function corDoReino(id, Cs, padrao) {
    var M = RP.mapaModelo, d = M && M.dados, r = d && d.reinos && d.reinos[id];
    if (!id) return padrao;
    if (RP.reino && id === RP.reino.id && !(M && M.publico)) return Cs.meu;
    if (d && (d.aliados || []).indexOf(id) >= 0) return Cs.aliado;
    return r && r.brasao ? A.corDono('outro', { brasao: r.brasao }) : padrao;
  }
  var estados = new Map();   /* por hexágono: baixas já vistas, quedas em andamento e corpos no chão */

  tb.alvo = { w: 64, h: 40 };
  tb.som = 'batalha';   /* espadas e escudos batendo, quando a batalha está à vista (RP.sons.mundo) */
  tb.rotuloDy = -46;
  tb.rotulo = function (o, info) {
    /* quem participa vê o selo como botão: clicar abre a tela da batalha */
    var ag = info.agora || RP.agora(), pl = RP.placarObjeto(o, ag);
    return { txt: (o.id ? 'Ver batalha' : 'Batalha') + (o.frentes > 1 ? ' · ' + o.frentes + ' ataques' : '') + (pl ? ' · ' + pl.meu.baixas + ' × ' + pl.eles.baixas : '') + (o.fim && o.fim > ag ? ' · ' + RP.fmtResta(o.fim - ag) : ''),
      cls: 'perigo', cor: A.cores().perigo, link: o.id ? 'batalha?id=' + o.id : null };
  };

  /* o que a batalha mostra a quem olha: parte da força de quem ataca (0 a 1), andamento (0 a 1) e baixas de cada lado */
  function leitura(o, ag) {
    var fr = o.listaFrentes;
    if (fr && fr.length) {
      var pa = 0, pr = 0, ba = 0, bd = 0;
      fr.forEach(function (f) { pa += f.parteAtaque; pr = Math.max(pr, f.progresso || 0); ba += f.baixasAtaque || 0; bd += f.baixasDefesa || 0; });
      return { parteA: pa / fr.length, prog: pr, baixasA: ba, baixasD: bd };
    }
    var pl = RP.placarObjeto(o, ag), prog = o.inicio && o.fim > o.inicio ? Math.max(0, Math.min(1, (ag - o.inicio) / (o.fim - o.inicio))) : 0.5;
    if (!pl) return { parteA: 0.5, prog: prog, baixasA: 0, baixasD: 0 };
    var atacando = o.papel === 'ataque';
    return { parteA: atacando ? pl.pct : 1 - pl.pct, prog: prog, baixasA: atacando ? pl.meu.baixas : pl.eles.baixas, baixasD: atacando ? pl.eles.baixas : pl.meu.baixas };
  }
  /* quantos em pé: a parte da força do lado, encolhendo com o andamento. Sempre pelo menos 1 enquanto a batalha durar. */
  function emPe(parte, prog) { return Math.max(1, Math.min(LINHA, Math.round(LINHA * 2 * parte * (1 - 0.4 * prog)))); }

  function estadoDe(o, L, agora) {
    var s = estados.get(o.hex);
    if (!s || agora - s.visto > 20) {
      /* batalha que acabou de aparecer: as baixas de antes não viram quedas agora */
      s = { bA: L.baixasA, bD: L.baixasD, quedas: [], corpos: [], troca: { A: [], D: [] } };
      estados.set(o.hex, s);
    }
    s.visto = agora;
    if (estados.size > 40) estados.forEach(function (v, k) { if (agora - v.visto > 30) estados.delete(k); });
    return s;
  }
  /* baixa nova: um combatente daquele lado cai. As baixas chegam em lotes (o feed vem a cada 3 s): cada queda ganha um
     atraso próprio, para não caírem todos juntos. Lote grande demais não vira fila sem fim: caem alguns, o resto só conta. */
  function novasQuedas(s, lado, n, vivos, agora) {
    for (var i = 0; i < Math.min(n, 4); i++) {
      var pend = s.quedas.filter(function (q) { return q.lado === lado; });
      if (pend.length >= 3) return;
      var livres = [];
      for (var k = 0; k < vivos; k++) if (!pend.some(function (q) { return q.slot === k; })) livres.push(k);
      if (!livres.length) return;
      var slot = livres[Math.floor(A.hash(Math.floor(agora * 10) % 9973, s.quedas.length + i * 7 + (lado === 'A' ? 3 : 11), 91) * livres.length) % livres.length];
      s.quedas.push({ lado: lado, slot: slot, t0: agora + i * 0.7 + A.hash(slot, i, 92) * 1.6 });
    }
  }

  /* lugar de cada combatente: quem defende numa linha em arco na frente do local, quem ataca de frente para ela */
  function lugar(ce, castelo, lado, i, n, t) {
    var base = castelo ? 42 : 24, fila = i >= 5 ? 1 : 0, col = fila ? i - 5 : i, nc = fila ? n - 5 : Math.min(n, 5);
    var x = (col - (nc - 1) / 2) * 11.5 + (fila ? 5.5 : 0), arco = (x * x) / 220;
    var vai = Math.sin(t * 1.3 + i * 2.1 + (lado === 'A' ? 0 : 1.7)) * 1.6;   /* avança e cede */
    if (lado === 'D') return { x: ce.x + x, y: ce.y + base - arco - fila * 8 + vai * 0.5 };
    return { x: ce.x + x, y: ce.y + base + FOLGA - arco * 0.6 + fila * 9 - vai };
  }

  /* as figuras da luta, cada uma na sua profundidade: add(x, y, desenho(c)) */
  tb.itensCena = function (o, ce, info, add) {
    var t = info.t, ag = info.agora || RP.agora(), Cs = A.cores(), S = RP.sprites;
    var corA = o.papel === 'ataque' ? Cs.meu : P.hostil, corD = o.papel === 'defesa' ? Cs.meu : o.papel === 'ataque' ? P.hostil : Cs.desconhecido;
    var escA = o.papel === 'ataque' ? Cs.meu : P.hostilEscudo, escD = o.papel === 'defesa' ? Cs.meu : P.hostilEscudo;
    var metA = o.papel === 'ataque' ? P.metal : P.hostilEsc, metD = o.papel === 'defesa' ? P.metal : P.hostilEsc;
    /* batalha vista de fora (vem do feed, sem papel): cada lado na cor do próprio reino, para se saber quem é quem */
    var f0 = !o.papel && o.listaFrentes && o.listaFrentes[0];
    if (f0) {
      corA = corDoReino(f0.atacanteId, Cs, P.hostil); corD = corDoReino(f0.defensorId, Cs, Cs.desconhecido || '#8a8174');
      escA = corA; escD = corD; metA = P.metal; metD = P.metal;
    }
    var castelo = !!info.castelo, L = leitura(o, ag), s = estadoDe(o, L, t);
    var nA = emPe(L.parteA, L.prog), nD = emPe(1 - L.parteA, L.prog);
    if (L.baixasA > s.bA) novasQuedas(s, 'A', L.baixasA - s.bA, nA, t);
    if (L.baixasD > s.bD) novasQuedas(s, 'D', L.baixasD - s.bD, nD, t);
    s.bA = Math.max(s.bA, L.baixasA); s.bD = Math.max(s.bD, L.baixasD);

    /* quedas que terminaram viram corpos; o lugar é reocupado por quem vem de trás */
    s.quedas = s.quedas.filter(function (q) {
      if (t < q.t0 + QUEDA_S) return true;
      var n = q.lado === 'A' ? nA : nD, p = lugar(ce, castelo, q.lado, Math.min(q.slot, n - 1), n, q.t0);
      s.corpos.push({ lado: q.lado, x: p.x + (A.hash(q.slot, 3, 93) - 0.5) * 6, y: p.y + (q.lado === 'A' ? 5 : -4), t0: t, sem: q.slot });
      s.troca[q.lado][q.slot] = t;
      return false;
    });
    while (s.corpos.length > CORPOS * 2) s.corpos.shift();
    s.corpos = s.corpos.filter(function (b) { return t - b.t0 < CORPO_S; });

    /* corpos no chão: somem aos poucos */
    s.corpos.forEach(function (b) {
      var idade = t - b.t0, alfa = idade > CORPO_S - 4 ? Math.max(0, (CORPO_S - idade) / 4) : 1, cor = b.lado === 'A' ? corA : corD;
      add(b.x, b.y - 0.5, function (c) {
        var a0 = c.globalAlpha; c.globalAlpha = a0 * alfa;
        S.pessoa(c, 0, 0, t, { roupa: cor, cinto: P.cinto, capacete: b.lado === 'A' ? metA : metD, pose: 'caido', sentado: true, ang: b.lado === 'A' ? -1.2 + b.sem : 1.9 + b.sem, semente: b.sem % 4 });
        c.globalAlpha = a0;
      });
    });

    function lado(L0, n, cor, esc, metal, ang) {
      for (var i = 0; i < n; i++) (function (i) {
        var p = lugar(ce, castelo, L0, i, n, t), arqueiro = i >= 5 || (n <= 5 && i === n - 1 && n > 2);
        var q = s.quedas.filter(function (x) { return x.lado === L0 && x.slot === i; })[0];
        var base = { roupa: cor, cinto: P.cinto, capacete: metal, ang: ang, semente: (i + (L0 === 'A' ? 0 : 2)) % 4, fase: i * 1.1 + (L0 === 'A' ? 0 : 0.5) };
        if (q && t >= q.t0) {
          /* caindo: a queda acontece uma vez, do começo ao fim */
          add(p.x, p.y, function (c) { S.pessoa(c, 0, 0, t, Object.assign(base, { pose: 'cair', quadro: (t - q.t0) / QUEDA_S, sentado: true })); });
          return;
        }
        /* quem acabou de entrar no lugar de um caído vem de trás andando */
        var entrou = s.troca[L0][i], e = entrou != null ? (t - entrou) / ENTRA_S : 1;
        if (e < 1) {
          var rec = (1 - e) * 12 * (L0 === 'A' ? 1 : -1);
          add(p.x, p.y + rec, function (c) { S.pessoa(c, 0, 0, t, Object.assign(base, { andando: true, lanca: !arqueiro, escudo: arqueiro ? null : esc, arco: arqueiro })); });
          return;
        }
        var vez = Math.floor((t + i * 1.9 + (L0 === 'A' ? 0 : 0.8)) / 1.8), apara = !arqueiro && A.hash(i, vez % 997, L0 === 'A' ? 95 : 96) < 0.32;
        add(p.x, p.y, function (c) {
          if (arqueiro) S.pessoa(c, 0, 0, t, Object.assign(base, { arco: true, atirando: true }));
          else if (apara) S.pessoa(c, 0, 0, t, Object.assign(base, { lanca: true, escudo: esc, pose: 'aparar', estocada: true }));
          else S.pessoa(c, 0, 0, t, Object.assign(base, { lanca: true, escudo: esc, estocada: true }));
        });
      })(i);
    }
    lado('D', nD, corD, escD, metD, Math.PI / 2);    /* quem defende olha para fora (o sul do mapa) */
    lado('A', nA, corA, escA, metA, -Math.PI / 2);   /* quem ataca olha para o local */

    /* entre as duas linhas: poeira, flechas cruzando e o clarão das armas */
    var meio = (castelo ? 42 : 24) + FOLGA / 2;
    add(ce.x, ce.y + meio, function (c) {
      for (var w = 0; w < 5; w++) {
        var a = (t * 0.6 + w / 5) % 1;
        A.elipse(c, (w - 2) * 10 + Math.sin(w * 3) * 4, 2 - a * 5, 5 + a * 7, 2.5 + a * 3, 'rgba(160,140,110,' + (0.26 * (1 - a)).toFixed(2) + ')');
      }
      for (var f = 0; f < 3; f++) {
        var k = (t * 0.8 + f / 3) % 1, de = f % 2 ? -1 : 1;
        var fx = (f - 1) * 16 + de * 3, fy = -de * (FOLGA - FOLGA * 2 * k) * 0.62 - 12 - Math.sin(k * Math.PI) * 9;
        A.linha(c, fx - 1, fy + de * 2.6, fx + 1, fy - de * 2.6, P.madeiraEsc, 0.8);
      }
      if (Math.sin(t * 9) > 0.9) { c.fillStyle = 'rgba(255,245,200,.75)'; c.beginPath(); c.arc(Math.sin(t * 7) * 16, -9, 1.7, 0, 6.2832); c.fill(); }
    });
  };

  /* sobre o local: a barra de quem ganha (a cor do seu lado contra a do outro). As figuras vêm de itensCena. */
  tb.desenharCena = function (c, o, info) {
    var Cs = A.cores(), pl = RP.placarObjeto(o, info.agora || RP.agora());
    if (pl) {
      c.fillStyle = 'rgba(20,18,14,.75)'; c.fillRect(-25, -37, 50, 6);
      c.fillStyle = P.hostil; c.fillRect(-24, -36, 48, 4);
      c.fillStyle = Cs.meu; c.fillRect(-24, -36, 48 * pl.pct, 4);
      return;
    }
    /* batalha de outros reinos: a parte da força de quem ataca, sem cor de lado */
    var L = leitura(o, info.agora || RP.agora());
    c.fillStyle = 'rgba(20,18,14,.75)'; c.fillRect(-25, -37, 50, 6);
    c.fillStyle = Cs.desconhecido || '#8a8174'; c.fillRect(-24, -36, 48, 4);
    c.fillStyle = P.hostil; c.fillRect(-24, -36, 48 * L.parteA, 4);
  };
  /* para conferir em teste: quantos em pé com esta parte da força e este andamento, e o estado de cada batalha à vista */
  RP.batalhaVista = { emPe: emPe, leitura: leitura, estado: function (hex) { return estados.get(hex); }, LINHA: LINHA };
})();
