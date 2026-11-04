/* Reino de Pedra — sprites de pessoa pré-desenhados: cada combinação de ofício, pose, direção e quadro de animação é
   desenhada uma vez (com RP.arte.pessoa, mais roupa e ferramenta do ofício) num canvas fora da tela e reaproveitada a cada
   quadro com drawImage. As figuras saem 30% mais altas que as do protótipo (escala das pessoas na Vista). A animação é
   quantizada em FRAMES quadros por ciclo, então o cache fica pequeno (um sprite por quadro, por combinação).
     RP.sprites.pessoa(c, x, y, t, o)   o = opções de RP.arte.pessoa + { chapeu, ferramenta: 'machado' | 'enxada', armadura: 0..3 } */
(function () {
  'use strict';
  var RP = window.RP, A = RP.arte, P = A.P;
  var ESC = 1.3, RES = 3, FRAMES = 6, MAX = 600;
  var W = 40, ALT = 44, PE = 6;   /* caixa do sprite em unidades do mundo: largura, altura acima do pé e folga abaixo */
  var cache = new Map();

  function chave(o, frame) {
    return [o.roupa, o.dir, o.andando ? 1 : 0, o.trabalho || '', o.carga || '', o.corCarga || '', o.capacete || '', o.lanca ? 1 : 0, o.escudo || '',
      o.arco ? 1 : 0, o.atirando ? 1 : 0, o.estocada ? 1 : 0, o.capuz || '', o.cinto || '', o.sentado ? 1 : 0, o.chapeu || '', o.ferramenta || '',
      o.armadura || 0, frame].join('|');
  }
  /* ritmo da animação (sin(t × ritmo + fase) em RP.arte.pessoa): ferramenta 6, estocada 4, arco 3, andar 8 */
  function ritmo(o) { return o.trabalho || o.ferramenta ? 6 : o.estocada ? 4 : o.atirando ? 3 : o.andando ? 8 : 0; }

  /* ferramenta do ofício na mão que trabalha (mesma conta do braço de RP.arte.pessoa) */
  function ferramenta(c, o, t) {
    var dir = o.dir || 1, ang = -1.6 + Math.sin(t * 6) * 1.1;
    var hx = dir * 1.5 + Math.cos(ang) * dir * 7, hy = -10 + Math.sin(ang) * 7;
    if (o.ferramenta === 'machado') {
      A.linha(c, dir * 1.5, -10, hx, hy, P.madeira, 1.4);
      A.poli(c, [hx - dir * 0.5, hy - 3.2, hx + dir * 3.6, hy - 2.6, hx + dir * 3.2, hy + 1.6, hx - dir * 0.5, hy + 1], P.metal);
      A.linha(c, hx + dir * 3.4, hy - 2.4, hx + dir * 3, hy + 1.4, P.metalEsc, 0.6);
    } else if (o.ferramenta === 'enxada') {
      var px = hx + dir * 4.5, py = hy + 5.5;
      A.linha(c, dir * 1.5, -10, px, py, P.madeira, 1.2);
      A.poli(c, [px - dir * 1.5, py - 0.5, px + dir * 2, py - 1.5, px + dir * 2.6, py + 2.2, px - dir * 0.8, py + 2.8], P.metalEsc);
    }
  }
  function chapeu(c, o) {
    if (o.chapeu === 'palha') { A.elipse(c, 0, -15.6, 4.4, 1.5, '#d8c27a'); A.elipse(c, 0, -16.4, 2.4, 1.6, '#cbb46a'); }
  }
  /* armadura pelo nível da ferraria: 1 sem nada além do capacete; 2 peitoral; 3 peitoral com friso dourado */
  function armadura(c, o) {
    if (!o.armadura || o.armadura < 2) return;
    c.fillStyle = P.metal; c.fillRect(-2.6, -11, 5.2, 4.6);
    c.fillStyle = P.metalEsc; c.fillRect(-2.6, -8.2, 5.2, 0.8);
    if (o.armadura >= 3) { c.fillStyle = P.ouro; c.fillRect(-2.6, -11, 5.2, 0.7); }
  }

  function sprite(o, frame) {
    var k = chave(o, frame), s = cache.get(k);
    if (s) return s;
    if (cache.size >= MAX) cache.clear();
    var cv = document.createElement('canvas');
    cv.width = Math.round(W * RES); cv.height = Math.round((ALT + PE) * RES);
    var c = cv.getContext('2d');
    c.setTransform(RES * ESC, 0, 0, RES * ESC, cv.width / 2, ALT * RES);
    var r = ritmo(o), t = r ? (frame / FRAMES) * 2 * Math.PI / r : 0;
    var op = Object.assign({}, o, { fase: 0 });
    if (o.ferramenta) op.trabalho = null;   /* a ferramenta própria entra depois, no lugar do martelo/picareta */
    A.pessoa(c, 0, 0, t, P, op);
    if (o.ferramenta) {
      /* o braço que trabalha (RP.arte.pessoa só o desenha com `trabalho`): mesma conta, sem a ferramenta dele */
      var dir = o.dir || 1, ang = -1.6 + Math.sin(t * 6) * 1.1;
      A.linha(c, dir * 1.5, -10, dir * 1.5 + Math.cos(ang) * dir * 7, -10 + Math.sin(ang) * 7, P.madeira, 1.3);
      ferramenta(c, o, t);
    }
    armadura(c, o);
    chapeu(c, o);
    cache.set(k, cv);
    return cv;
  }

  /* boneco 3D (RP.bonecos, módulo bonecos.js): quando o sprite dele já existe, é ele que aparece; enquanto não, a figura 2D */
  function boneco(c, x, y, t, o, tipo) {
    var B = RP.bonecos;
    if (!B || !B.pronto) return false;
    var s = tipo === 'montado' ? B.montado(o, t) : B.pessoa(o, t);
    if (!s) return false;
    var cx = B.CX[tipo];
    c.drawImage(s, x - cx.W / 2, y - cx.ALT, cx.W, cx.ALT + cx.PE);
    return true;
  }
  /* o cavalo da arte 2D vira o cavalo 3D (com o cavaleiro montado), onde quer que seja desenhado */
  var cavalo2D = A.cavalo;
  A.cavalo = function (c, x, y, t, pal, o) {
    if (o && !o.boi && boneco(c, x, y, t, o, 'montado')) return;
    cavalo2D(c, x, y, t, pal, o);
  };

  RP.sprites = {
    ESC: ESC, FRAMES: FRAMES,
    pessoa: function (c, x, y, t, o) {
      if (boneco(c, x, y, t, o, 'pessoa')) return;
      var r = ritmo(o), frame = 0;
      if (r) { frame = Math.floor(((t * r + (o.fase || 0)) / (2 * Math.PI)) * FRAMES) % FRAMES; if (frame < 0) frame += FRAMES; }
      c.drawImage(sprite(o, frame), x - W / 2, y - ALT, W, ALT + PE);
    },
    limpar: function () { cache.clear(); },
    tamanho: function () { return cache.size; }
  };
})();
