/* Reino de Pedra — Vista do território no topo de Meu reino: a mesma cena do mundo, enquadrada nos seus locais,
   arrastável para os lados; tocar numa construção abre a folha do local, e "Abrir no mundo" leva à Vista inteira.
   reino.js chama RP.vistaReino.html() / montar(el) a cada desenho e parar() ao sair. */
(function () {
  'use strict';
  var RP = window.RP, H = RP.hex, M = RP.mapaModelo, K = RP.arte.K;
  var cena = null, ultimaCam = null;

  function enquadramento() {
    var r = RP.reino, locais = (r && r.locais) || [], c = RP.castelo();
    if (!c) return null;
    var ps = locais.map(function (l) { return H.centroH(l.hex); }), cc = H.centroH(c.hex);
    var xs = ps.map(function (p) { return p.x; }), ys = ps.map(function (p) { return p.y; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var lx0 = Math.min(cc.x, x0 + 60), lx1 = Math.max(cc.x, x1 - 60), ym = (y0 + y1) / 2;
    return { castelo: cc, limites: { x0: lx0, x1: lx1, y0: ym - 20, y1: ym + 20 }, x: cc.x + 20, y: ym + 10, altura: y1 - y0 + 120 };
  }

  RP.vistaReino = {
    html: function () {
      var c = RP.castelo();
      return '<canvas class="reino-cena" aria-label="Vista do reino: castelo, locais e pessoas trabalhando. Arraste para os lados; toque numa construção para ver detalhes."></canvas>' +
        '<div class="reino-vista-dica">' + RP.icone('vista', 'ico-p') + 'Arraste para os lados · toque nas construções</div>' +
        '<a class="btn btn-p reino-vista-abrir" href="#/mapa?modo=cena' + (c ? '&amp;centro=' + c.hex : '') + '">' + RP.icone('mapa') + 'Abrir no mundo</a>';
    },
    montar: function (el) {
      var cv = el && el.querySelector('canvas'), q = enquadramento();
      if (!cv || !q) return;
      M.ativar('reino');
      M.emDia().catch(function () { /* sem rede: mostra a névoa */ });
      var abrir = el.querySelector('.reino-vista-abrir');
      if (abrir) abrir.setAttribute('href', '#/mapa?modo=cena&centro=' + RP.castelo().hex);
      /* mesmo canvas: só atualiza o enquadramento (local novo) e garante que está rodando */
      if (cena && cena.cv === cv) { cena.opt.limites = q.limites; cena.iniciar(); cena.vida = null; return; }
      if (cena) { ultimaCam = cena.cam; cena.parar(); }
      cena = new RP.Cena(cv, {
        tocavel: true, panHorizontal: true, limites: q.limites,
        aoTocar: function (alvo) {
          if (alvo.ent && alvo.ent[0] === 'local' && RP.local(alvo.ent[1])) { RP.folhaLocal(alvo.ent[1]); return; }
          var h = alvo.hex != null ? alvo.hex : alvo.obj && alvo.obj.hex;
          if (h != null && h >= 0) RP.ir('mapa?modo=cena&foco=' + h);
        }
      });
      var esta = cena;
      requestAnimationFrame(function () {
        if (esta !== cena) return;
        cena.redimensionar();
        if (ultimaCam) cena.centrar(ultimaCam.x, ultimaCam.y, ultimaCam.s, 0.5, false);
        else cena.centrar(q.x, q.y, Math.max(1, Math.min(1.5, cena.h / (q.altura * K))), 0.5, false);
        cena.iniciar();
      });
    },
    parar: function () {
      if (cena) { ultimaCam = cena.cam; cena.parar(); }
      M.desativar('reino');
    }
  };
  document.addEventListener('rp:mapa-dados', function () { if (cena && cena.rodando) cena.invalidar(); });
  /* ao trocar de conta, a câmera volta ao castelo do novo reino */
  document.addEventListener('rp:tela', function (e) { if (e.detail === 'inicio') ultimaCam = null; });
})();
