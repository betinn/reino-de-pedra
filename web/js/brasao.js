/* Reino de Pedra — gerador de brasão simples (SVG, viewBox 0 0 100 120).
   cfg = { forma, divisao, cor1, cor2, simbolo, corSimbolo }
   Cores são nomes de tintura (ouro, prata, vermelho, azul, verde, purpura, negro, castanho). */
(function () {
  'use strict';
  var RP = (window.RP = window.RP || {});
  var seq = 0;

  var TINTURAS = {
    ouro: { nome: 'Ouro', metal: true },
    prata: { nome: 'Prata', metal: true },
    vermelho: { nome: 'Vermelho' },
    azul: { nome: 'Azul' },
    verde: { nome: 'Verde' },
    purpura: { nome: 'Púrpura' },
    negro: { nome: 'Negro' },
    castanho: { nome: 'Castanho' }
  };

  var FORMAS = {
    portugues: { nome: 'Português', d: 'M8 8H92V66C92 92 73 111 50 113 27 111 8 92 8 66Z' },
    classico: { nome: 'Clássico', d: 'M8 8H92V52C92 82 72 102 50 114 28 102 8 82 8 52Z' },
    redondo: { nome: 'Rodela', d: 'M50 12A47 47 0 1 1 49.99 12Z' }
  };

  function cor(t) { return 'var(--tin-' + t + ')'; }

  var DIVISOES = {
    pleno: { nome: 'Pleno', f: function (a) { return '<rect width="100" height="120" style="fill:' + a + '"/>'; } },
    partido: {
      nome: 'Partido',
      f: function (a, b) { return '<rect width="50" height="120" style="fill:' + a + '"/><rect x="50" width="50" height="120" style="fill:' + b + '"/>'; }
    },
    cortado: {
      nome: 'Cortado',
      f: function (a, b) { return '<rect width="100" height="60" style="fill:' + a + '"/><rect y="60" width="100" height="60" style="fill:' + b + '"/>'; }
    },
    esquartelado: {
      nome: 'Esquartelado',
      f: function (a, b) {
        return '<rect width="50" height="60" style="fill:' + a + '"/><rect x="50" width="50" height="60" style="fill:' + b + '"/>' +
          '<rect y="60" width="50" height="60" style="fill:' + b + '"/><rect x="50" y="60" width="50" height="60" style="fill:' + a + '"/>';
      }
    },
    banda: {
      nome: 'Em banda',
      f: function (a, b) { return '<rect width="100" height="120" style="fill:' + b + '"/><path d="M0 0H100V120Z" style="fill:' + a + '"/>'; }
    },
    chaveirao: {
      nome: 'Chaveirão',
      f: function (a, b) { return '<rect width="100" height="120" style="fill:' + a + '"/><path d="M0 96 50 50 100 96V122L50 76 0 122Z" style="fill:' + b + '"/>'; }
    }
  };

  /* Símbolos centrados em (0,0), cabem em ~56×56 */
  var SIMBOLOS = {
    torre: {
      nome: 'Torre',
      d: 'M-15 26V-4h-4V-22h7.5v6h4.5v-6h14v6h4.5v-6H19V-4h-4v30ZM-4.5 26V14a4.5 4.5 0 0 1 9 0v12Z',
      regra: 'evenodd'
    },
    espada: { nome: 'Espada', d: 'M-3.2-26 0-31 3.2-26V9h-6.4ZM-14 9h28v5.5h-28ZM-2.8 14.5h5.6v10h-5.6ZM0 24a4.6 4.6 0 1 1 0 9.2A4.6 4.6 0 0 1 0 24Z' },
    estrela: { nome: 'Estrela', d: null },
    coroa: { nome: 'Coroa', d: 'M-22 10-26-16-11-3 0-22 11-3 26-16 22 10ZM-22 13h44v8h-44Z' },
    chave: {
      nome: 'Chave',
      d: 'M0-30a10 10 0 1 1 0 20A10 10 0 0 1 0-30ZM0-24.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9ZM-3-11h6v26h7v6h-7v4h7v6H-3Z',
      regra: 'evenodd'
    },
    martelo: { nome: 'Martelo', d: 'M-20-26H20v14H-20ZM-3.5-12h7v40h-7Z' },
    lua: { nome: 'Crescente', d: 'M8-24A24 24 0 1 0 8 24 18.5 18.5 0 1 1 8-24Z' },
    montes: { nome: 'Montes', d: 'M-28 20-11-10-3 2 8-18 28 20Z' }
  };

  function simboloPath(nome) {
    var s = SIMBOLOS[nome] || SIMBOLOS.torre;
    if (nome === 'estrela') return { d: RP.estrelaPath(0, 0, 25, 10.5, 5), regra: 'nonzero' };
    return { d: s.d, regra: s.regra || 'nonzero' };
  }

  RP.TINTURAS = TINTURAS;
  RP.FORMAS = FORMAS;
  RP.DIVISOES = DIVISOES;
  RP.SIMBOLOS = SIMBOLOS;

  /* opt: { tamanho, classe, semSimbolo, desconhecido } */
  RP.brasao = function (cfg, opt) {
    opt = opt || {};
    var id = 'rpb' + (++seq);
    var tam = opt.tamanho || 48;
    var alt = Math.round(tam * 1.2);
    var cls = 'brasao ' + (opt.classe || '');
    if (!cfg || opt.desconhecido) {
      var dq = FORMAS.classico.d;
      return '<svg class="' + cls + '" viewBox="0 0 100 120" width="' + tam + '" height="' + alt + '" aria-hidden="true">' +
        '<path d="' + dq + '" style="fill:var(--cor-superficie-3);stroke:var(--brasao-borda);stroke-width:5"/>' +
        '<text x="50" y="76" text-anchor="middle" font-size="54" font-weight="700" style="fill:var(--cor-texto-2);font-family:var(--fonte-titulo)">?</text></svg>';
    }
    var forma = (FORMAS[cfg.forma] || FORMAS.portugues).d;
    var div = DIVISOES[cfg.divisao] || DIVISOES.pleno;
    var simb = simboloPath(cfg.simbolo);
    var escala = cfg.forma === 'redondo' ? 0.82 : 0.9;
    var cy = cfg.forma === 'redondo' ? 59 : 58;
    return '<svg class="' + cls + '" viewBox="0 0 100 120" width="' + tam + '" height="' + alt + '" aria-hidden="true">' +
      '<defs><clipPath id="' + id + '"><path d="' + forma + '"/></clipPath>' +
      '<linearGradient id="' + id + 'l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient></defs>' +
      '<g clip-path="url(#' + id + ')">' + div.f(cor(cfg.cor1), cor(cfg.cor2 || cfg.cor1)) +
      (opt.semSimbolo ? '' : '<path transform="translate(50 ' + cy + ') scale(' + escala + ')" d="' + simb.d + '" fill-rule="' + simb.regra + '" style="fill:' + cor(cfg.corSimbolo) + '" stroke="rgba(0,0,0,.45)" stroke-width="1.6" stroke-linejoin="round"/>') +
      '<rect width="100" height="120" fill="url(#' + id + 'l)" class="brasao-luz"/></g>' +
      '<path d="' + forma + '" fill="none" style="stroke:var(--brasao-borda)" stroke-width="6" stroke-linejoin="round"/>' +
      '<path d="' + forma + '" fill="none" style="stroke:var(--brasao-filete)" stroke-width="1.6" stroke-linejoin="round"/>' +
      '</svg>';
  };
})();
