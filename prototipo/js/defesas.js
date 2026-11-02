/* Reino de Pedra — Torres de arqueiros e avistamentos.
   Sem muros: a defesa construída são torres de arqueiros, construções próprias com alcance.
   Arqueiros no alto atiram protegidos em quem entra no alcance e defendem os locais em volta;
   o invasor precisa derrubar a torre (aríetes) ou passar debaixo dela.
   Avistamentos (espiões e exércitos vistos por suas tropas) somem do mapa depois de 10 h.
   Valores ilustrativos. */
(function () {
  'use strict';
  var RP = window.RP, D = RP.dados, W = RP.mundo, H = RP.hex;
  var CUSTO_TORRE = { pedra: 400, madeira: 150 }, TEMPO_TORRE = 1800, ARQ_NIVEL = 4, NIVEL_MAX = 3;
  var VALIDADE_H = 10;

  function chave(c, l) { return c + ',' + l; }
  function nomeLocal(id) { var x = W.local(id); return x ? (x.reino === 'meu' && x.tipo === 'castelo' ? 'Castelo de ' + RP.estado.nome : W.nomeAparente(x)) : '—'; }
  function alcance(t) { return Math.min(NIVEL_MAX, t.nivel) + 1; }   /* nível 1: 2 hexágonos; 2: 3; 3: 4 */
  function arqueiros(t) { return t.nivel * ARQ_NIVEL; }
  /* hexágonos no alcance */
  function areaDe(c, l, r) {
    var set = {};
    for (var ll = l - r; ll <= l + r; ll++) for (var cc = c - r - 1; cc <= c + r + 1; cc++) {
      if (W.dentro(cc, ll) && H.dist([c, l], [cc, ll]) <= r) set[chave(cc, ll)] = [cc, ll];
    }
    return set;
  }
  /* contorno da área: arestas que dão para fora dela */
  function bordasDe(set) {
    var out = [];
    Object.keys(set).forEach(function (kk) {
      var h = set[kk], ce = H.centro(h[0], h[1]);
      for (var i = 0; i < 6; i++) {
        var a1 = (Math.PI / 180) * (60 * i - 30), a2 = (Math.PI / 180) * (60 * (i + 1) - 30);
        var a = { x: ce.x + H.R * Math.cos(a1), y: ce.y + H.R * Math.sin(a1) }, b = { x: ce.x + H.R * Math.cos(a2), y: ce.y + H.R * Math.sin(a2) };
        var m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, fora = H.pixelParaHex(2 * m.x - ce.x, 2 * m.y - ce.y);
        if (!set[chave(fora.c, fora.l)]) out.push({ a: a, b: b });
      }
    });
    return out;
  }
  var cache = {};
  function bordas(t) { var kk = t.c + ',' + t.l + ',' + alcance(t); return cache[kk] || (cache[kk] = bordasDe(areaDe(t.c, t.l, alcance(t)))); }
  /* locais do mesmo dono dentro do alcance */
  function protege(t) { return D.locais.filter(function (x) { return x.reino === t.dono && H.dist([t.c, t.l], [x.c, x.l]) <= alcance(t); }); }
  function torresDe(localId) { var x = W.local(localId); return x ? D.torres.filter(function (t) { return t.dono === x.reino && H.dist([t.c, t.l], [x.c, x.l]) <= alcance(t); }) : []; }
  /* o que se sabe da torre: as suas e de aliados sempre; as dos outros quando o hexágono já foi explorado */
  function estadoTorre(t) { return t.dono === 'meu' || W.aliado(t.dono) ? 'visivel' : W.estado(t.c, t.l).v; }
  function descricao(t) { return 'nível ' + t.nivel + ' · alcance ' + alcance(t) + ' hexágonos' + (t.dono === 'meu' || W.aliado(t.dono) ? ' · ' + arqueiros(t) + ' arqueiros' : ''); }
  RP.torres = { alcance: alcance, arqueiros: arqueiros, bordas: bordas, protege: protege, de: torresDe, estado: estadoTorre, descricao: descricao, area: areaDe };

  /* ---------------------------------------------------------------- obras: requisição automática do material */
  function noFila(local, rotulo, seg, custo) {
    var p = RP.requisitar(custo, local, rotulo);
    if (!p) return 0;
    var aguarda = p.viagens.length ? p.chegada : 0, fim = RP.fimNaFila(D.filas.obras, seg, aguarda);
    D.filas.obras.push({ local: local, rotulo: rotulo, fim: fim, total: seg, aguarda: aguarda });
    return fim;
  }
  function linhaPlano(custo, local) {
    var p = RP.planoRequisicao(custo, local);
    return { ok: p.completo, html: '<small class="obra-estoque' + (!p.completo ? ' falta' : p.viagens.length ? ' vem' : '') + '">' + RP.icone(p.viagens.length ? 'carroca' : 'check', 'ico-p') + RP.esc(RP.textoPlano(p, local)) + '</small>' };
  }
  function custoNivel(t) { return { pedra: 300 * (t.nivel + 1), madeira: 100 * (t.nivel + 1) }; }
  /* local mais próximo da torre (de onde sai o material) */
  function localBase(t) { return D.locais.filter(function (x) { return x.reino === 'meu'; }).sort(function (a, b) { return H.dist([t.c, t.l], [a.c, a.l]) - H.dist([t.c, t.l], [b.c, b.l]); })[0]; }
  /* hexágono livre ao lado de um local para erguer uma torre nova */
  function vagaAoLado(local) {
    var oc = {};
    D.locais.concat(D.jazidas, D.ruinas, D.torres).forEach(function (o) { oc[chave(o.c, o.l)] = 1; });
    return H.vizinhos(local.c, local.l).filter(function (h) {
      return W.dentro(h[0], h[1]) && !oc[chave(h[0], h[1])] && !W.rioSet[W.chave(h[0], h[1])] && W.T[h[1]][h[0]] !== 'pantano';
    })[0];
  }

  /* ---------------------------------------------------------------- prévia (SVG): alcance e locais protegidos */
  function previa(c, l, r, rotulo) {
    var set = areaDe(c, l, r), c0 = Math.max(0, c - r - 1), c1 = Math.min(H.COLS - 1, c + r + 1), l0 = Math.max(0, l - r - 1), l1 = Math.min(H.LINS - 1, l + r + 1);
    var a = H.centro(c0, l0), b = H.centro(c1, l1), vb = [a.x - H.W, a.y - H.R, b.x - a.x + 2 * H.W, b.y - a.y + 2 * H.R];
    var h = '', cc, ll;
    for (ll = l0; ll <= l1; ll++) for (cc = c0; cc <= c1; cc++) {
      var ce = H.centro(cc, ll), e = W.estado(cc, ll);
      h += '<polygon class="hx ' + (e.v === 'desconhecido' ? 'mr-nevoa' : W.rioSet[W.chave(cc, ll)] ? 'mr-rio' : 't-' + W.T[ll][cc]) + (set[chave(cc, ll)] ? ' alcance-dentro' : '') + '" points="' + H.cantos(ce.x, ce.y, H.R + 0.6) + '"/>';
    }
    h += '<path class="alcance-linha" d="' + bordasDe(set).map(function (s) { return 'M' + s.a.x.toFixed(1) + ' ' + s.a.y.toFixed(1) + 'L' + s.b.x.toFixed(1) + ' ' + s.b.y.toFixed(1); }).join('') + '"/>';
    D.locais.filter(function (x) { return x.reino === 'meu' && set[chave(x.c, x.l)]; }).forEach(function (x) {
      var p = H.centro(x.c, x.l);
      h += '<g transform="translate(' + p.x.toFixed(0) + ' ' + p.y.toFixed(0) + ')"><circle class="mr-pino" r="13"/><use href="#i-' + x.tipo + '" x="-9" y="-9" width="18" height="18" class="mr-pino-ico"/></g>';
    });
    var pt = H.centro(c, l);
    h += '<g transform="translate(' + pt.x.toFixed(0) + ' ' + pt.y.toFixed(0) + ')"><circle class="torre-pino" r="14"/><use href="#i-torre" x="-10" y="-10" width="20" height="20" class="torre-pino-ico"/></g>';
    return '<svg class="mini-rota mapa-svg torre-previa" viewBox="' + vb.map(function (v) { return v.toFixed(0); }).join(' ') + '" role="img" aria-label="' + RP.esc(rotulo) + '">' + h + '</svg>';
  }

  /* ---------------------------------------------------------------- aba Defesas da construção */
  var sel = null;
  function cartaoTorre(t) {
    var base = localBase(t), cn = custoNivel(t), pn = linhaPlano(cn, base.id), pr = protege(t);
    return '<div class="card pilha torre-card"><div class="linha"><span class="ico-placa ico-placa-g">' + RP.icone('torre') + '</span><span style="flex:1;min-width:0"><b>' + RP.esc(t.nome) + '</b><br><small class="fraco">ao lado de ' + RP.esc(nomeLocal(base.id)) + '</small></span><span class="selo">Nv ' + t.nivel + '</span></div>' +
      (t.obra && t.obra > Date.now() ? '<p class="nota-antiga">' + RP.icone('martelo', 'ico-p') + '<span>Em obra · termina em <b class="num" data-fim="' + t.obra + '">' + RP.fmtResta(t.obra - Date.now()) + '</b></span></p>' : '') +
      '<div class="ext-numeros"><div><span class="fraco">Alcance</span><b class="num">' + alcance(t) + ' hex.</b></div><div><span class="fraco">Arqueiros no alto</span><b class="num">' + arqueiros(t) + '</b></div><div><span class="fraco">Protege</span><b class="num">' + pr.length + (pr.length === 1 ? ' local' : ' locais') + '</b></div></div>' +
      '<div class="card mini-rota-card">' + previa(t.c, t.l, alcance(t), 'Alcance da ' + t.nome) + '</div>' +
      '<small class="fraco">Protege: ' + RP.esc(pr.map(function (x) { return nomeLocal(x.id); }).join(', ') || 'nenhum local') + '</small>' +
      (t.nivel < NIVEL_MAX ? '<div class="torre-acao"><div class="linha-entre"><span><b>Subir para nível ' + (t.nivel + 1) + '</b><small class="fraco"> · alcance ' + (alcance(t) + 1) + ', +' + ARQ_NIVEL + ' arqueiros</small><br>' + RP.custoHTML(cn, 1, '*') + '</span>' +
        '<button type="button" class="btn btn-p btn-primario' + (pn.ok ? '' : ' btn-inativo') + '" data-torre-nivel="' + t.id + '">' + RP.icone('martelo') + 'Subir</button></div>' + pn.html + '</div>' : '<p class="fraco" style="font-size:var(--fs-2)">Nível máximo.</p>') + '</div>';
  }
  function htmlDefesas() {
    var meus = D.locais.filter(function (x) { return x.reino === 'meu'; }), castelo = W.local('castelo');
    var minhas = D.torres.filter(function (t) { return t.dono === 'meu'; });
    if (sel && !W.local(sel)) sel = null;
    var base = sel && W.local(sel), vaga = base && vagaAoLado(base), pl = base ? linhaPlano(CUSTO_TORRE, base.id) : null;
    return '<div class="nota-regra">' + RP.icone('torre', 'ico-p') + '<span>Torres põem <b>arqueiros no alto</b>. Eles atiram protegidos em quem entra no alcance e defendem os locais em volta. O invasor precisa <b>derrubar a torre</b> (aríetes) ou passar debaixo dela.</span></div>' +
      '<div class="secao-titulo">Castelo</div><div class="card linha"><span class="ico-placa ico-placa-g">' + RP.icone('castelo') + '</span><span style="flex:1"><b>' + RP.esc(nomeLocal(castelo.id)) + '</b><br><small class="fraco">Portões nível 3 e 4 torres próprias · aríetes derrubam portões</small></span><span class="selo">Nv 3</span></div>' +
      '<div class="secao-titulo">Suas torres</div><div class="pilha">' + (minhas.length ? minhas.map(cartaoTorre).join('') : '<p class="fraco">Nenhuma torre fora do castelo.</p>') + '</div>' +
      '<div class="secao-titulo">Nova torre</div><div class="card pilha">' +
      '<p class="fraco" style="font-size:var(--fs-2)">Escolha perto de qual local erguer. A torre protege todos os seus locais no alcance.</p>' +
      '<div class="obj-add-lista">' + meus.filter(function (x) { return x.tipo !== 'castelo'; }).map(function (x) {
        return '<button type="button" class="btn btn-p chip-sel" data-torre-sel="' + x.id + '" aria-pressed="' + (sel === x.id) + '">' + RP.icone(x.tipo, 'ico-p') + RP.esc(x.nome) + '</button>';
      }).join('') + '</div>' +
      (base ? (vaga ? '<div class="card mini-rota-card">' + previa(vaga[0], vaga[1], 2, 'Prévia da nova torre') + '</div>' +
          '<div class="ext-numeros"><div><span class="fraco">Alcance</span><b class="num">2 hex.</b></div><div><span class="fraco">Arqueiros</span><b class="num">' + ARQ_NIVEL + '</b></div><div><span class="fraco">Tempo</span><b class="num">' + RP.fmtDuracao(TEMPO_TORRE) + '</b></div></div>' +
          '<div class="linha" style="flex-wrap:wrap">' + RP.custoHTML(CUSTO_TORRE, 1, '*') + '</div>' + pl.html +
          '<button type="button" class="btn btn-p btn-primario' + (pl.ok ? '' : ' btn-inativo') + '" data-torre-construir>' + RP.icone('torre') + 'Erguer torre</button>'
        : '<p class="nota-antiga">' + RP.icone('info', 'ico-p') + '<span>Sem espaço livre ao lado deste local.</span></p>') : '') + '</div>' +
      '<div style="height:var(--esp-8)"></div>';
  }
  function clique(e, redesenhar) {
    var b;
    if ((b = e.target.closest('[data-torre-sel]'))) { var id = b.getAttribute('data-torre-sel'); sel = sel === id ? null : id; redesenhar(); return true; }
    if (e.target.closest('[data-torre-construir]')) {
      var base = W.local(sel), vaga = base && vagaAoLado(base);
      if (!vaga) return true;
      var nome = 'Torre de ' + base.nome.replace(/^(Vila|Mina|Serraria|Pasto|Armazém|Ferraria|Quartel)( d[aoe]s?)? /, '');
      var fim = noFila(base.id, 'Torre de arqueiros · ' + base.nome, TEMPO_TORRE, CUSTO_TORRE);
      if (!fim) { RP.aviso({ titulo: 'Recursos insuficientes', texto: RP.textoPlano(RP.planoRequisicao(CUSTO_TORRE, base.id), base.id), icone: 'alerta', tipo: 'perigo' }); return true; }
      D.torres.push({ id: 'to-' + Date.now(), nome: nome, dono: 'meu', c: vaga[0], l: vaga[1], nivel: 1, obra: fim });
      RP.aviso({ titulo: 'Torre na fila de obras', texto: 'Termina em ' + RP.fmtResta(fim - Date.now()) + '. Depois, ' + ARQ_NIVEL + ' arqueiros sobem para o alto.', icone: 'torre', tipo: 'sucesso' });
      sel = null; RP.invalidarTela('mapa'); RP.invalidarTela('reino'); redesenhar(); return true;
    }
    if ((b = e.target.closest('[data-torre-nivel]'))) {
      var t = D.torres.filter(function (q) { return q.id === b.getAttribute('data-torre-nivel'); })[0], cn = custoNivel(t), lb = localBase(t);
      var f1 = noFila(lb.id, t.nome + ' → nível ' + (t.nivel + 1), TEMPO_TORRE * t.nivel, cn);
      if (!f1) { RP.aviso({ titulo: 'Recursos insuficientes', texto: RP.textoPlano(RP.planoRequisicao(cn, lb.id), lb.id), icone: 'alerta', tipo: 'perigo' }); return true; }
      RP.aviso({ titulo: t.nome + ' na fila', texto: 'Nível ' + (t.nivel + 1) + ' termina em ' + RP.fmtResta(f1 - Date.now()) + '.', icone: 'torre', tipo: 'sucesso' });
      redesenhar(); return true;
    }
    return false;
  }
  RP.defesas = { html: htmlDefesas, clique: clique };

  /* ---------------------------------------------------------------- avistamentos */
  function idade(a) { return a.horas + (Date.now() - RP.t0) / 3600000; }
  RP.avist = {
    VALIDADE_H: VALIDADE_H,
    ativos: function () { return D.avistamentos.filter(function (a) { return idade(a) < VALIDADE_H; }); },
    idade: idade,
    restante: function (a) { return Math.max(0, VALIDADE_H - idade(a)); },
    porId: function (id) { return D.avistamentos.filter(function (a) { return a.id === id; })[0]; }
  };
  /* limpeza: o que passou da validade sai do mapa */
  function limpar() {
    var antes = D.avistamentos.length;
    D.avistamentos = D.avistamentos.filter(function (a) { return idade(a) < VALIDADE_H; });
    return antes - D.avistamentos.length;
  }
  limpar();
  setInterval(function () { if (limpar()) RP.invalidarTela('mapa'); }, 60000);
})();
