/* Reino de Pedra — Defesas e avistamentos.
   Muros envolvem um ou vários locais e são caros, porque dão muita vantagem contra invasões.
   Torres põem arqueiros no alto: atiram protegidos até o invasor entrar ou derrubar o muro.
   Avistamentos (espiões e exércitos vistos por suas tropas) somem do mapa depois de 10 h.
   Valores ilustrativos. */
(function () {
  'use strict';
  var RP = window.RP, D = RP.dados, W = RP.mundo, H = RP.hex;
  var CUSTO_TRECHO = { pedra: 100, madeira: 40 }, TEMPO_TRECHO = 8 * 60, DIST_MAX = 3;
  var CUSTO_TORRE = { pedra: 400, madeira: 150 }, TEMPO_TORRE = 1800, ARQ_TORRE = 4;
  var VALIDADE_H = 10;

  function chave(c, l) { return c + ',' + l; }
  function nomeLocal(id) { var x = W.local(id); return x ? (x.reino === 'meu' && x.tipo === 'castelo' ? 'Castelo de ' + RP.estado.nome : W.nomeAparente(x)) : '—'; }
  /* cadeia pelos vizinhos mais próximos: o muro passa pelos hexágonos entre os locais */
  function cadeia(ids) {
    var pts = ids.map(function (id) { return W.local(id); }).filter(Boolean);
    if (!pts.length) return [];
    var ordem = [pts[0]], resto = pts.slice(1);
    while (resto.length) {
      var u = ordem[ordem.length - 1];
      resto.sort(function (a, b) { return H.dist([u.c, u.l], [a.c, a.l]) - H.dist([u.c, u.l], [b.c, b.l]); });
      ordem.push(resto.shift());
    }
    return ordem;
  }
  function area(ids) {
    var ordem = cadeia(ids), set = {}, lista = ordem.length > 1 ? H.caminho(ordem.map(function (p) { return [p.c, p.l]; })) : ordem.map(function (p) { return [p.c, p.l]; });
    lista.forEach(function (h) { set[chave(h[0], h[1])] = h; });
    return set;
  }
  function valido(ids) {
    var ordem = cadeia(ids);
    for (var i = 1; i < ordem.length; i++) if (H.dist([ordem[i - 1].c, ordem[i - 1].l], [ordem[i].c, ordem[i].l]) > DIST_MAX) return false;
    return ordem.length > 0;
  }
  /* trechos do muro: arestas dos hexágonos da área que dão para fora dela */
  function bordasDe(set) {
    var out = [];
    Object.keys(set).forEach(function (kk) {
      var h = set[kk], ce = H.centro(h[0], h[1]);
      for (var i = 0; i < 6; i++) {
        var a1 = (Math.PI / 180) * (60 * i - 30), a2 = (Math.PI / 180) * (60 * (i + 1) - 30);
        var a = { x: ce.x + H.R * Math.cos(a1), y: ce.y + H.R * Math.sin(a1) }, b = { x: ce.x + H.R * Math.cos(a2), y: ce.y + H.R * Math.sin(a2) };
        var m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, fora = H.pixelParaHex(2 * m.x - ce.x, 2 * m.y - ce.y);
        if (!set[chave(fora.c, fora.l)]) out.push({ a: a, b: b, hex: h });
      }
    });
    return out;
  }
  var cache = {};
  function bordas(m) { var kk = m.locais.join('|'); return cache[kk] || (cache[kk] = bordasDe(area(m.locais))); }
  function torresDe(m) {
    var bs = bordas(m), out = [];
    for (var i = 0; i < (m.torres || 0); i++) out.push(bs[Math.floor(((i + 0.5) * bs.length) / m.torres) % bs.length].a);
    return out;
  }
  function muroDe(localId) { return D.muros.filter(function (m) { return m.locais.indexOf(localId) >= 0; })[0]; }
  /* o que se sabe do muro: os seus sempre; os dos outros quando a área já foi explorada */
  function estadoMuro(m) {
    if (m.dono === 'meu') return 'visivel';
    var est = m.locais.map(function (id) { var x = W.local(id); return W.estado(x.c, x.l).v; });
    return est.indexOf('visivel') >= 0 ? 'visivel' : est.indexOf('explorado') >= 0 ? 'explorado' : 'desconhecido';
  }
  function descricao(m) {
    return 'nível ' + m.nivel + (m.torres ? ' · ' + m.torres + (m.torres > 1 ? ' torres' : ' torre') + (m.arqueiros ? ' com ' + m.arqueiros + ' arqueiros' : ' com arqueiros') : ' · sem torres') +
      (m.locais.length > 1 ? ' · envolve ' + m.locais.length + ' locais' : '');
  }
  RP.muros = { area: area, bordas: bordas, torres: torresDe, de: muroDe, estado: estadoMuro, descricao: descricao, valido: valido };

  /* ---------------------------------------------------------------- estoque somado da área do muro */
  function faltaArea(custo, ids) {
    var f = {};
    Object.keys(custo).forEach(function (k) {
      var tem = ids.reduce(function (s, id) { return s + RP.qtdRecurso(k, id); }, 0);
      if (tem < custo[k]) f[k] = Math.ceil(custo[k] - tem);
    });
    return f;
  }
  function gastarArea(custo, ids) {
    Object.keys(custo).forEach(function (k) {
      var resta = custo[k];
      ids.forEach(function (id) { var t = Math.min(resta, RP.qtdRecurso(k, id)); if (t > 0) { RP.mudarEstoque(id, k, -t); resta -= t; } });
    });
  }
  function mult(c, n) { var o = {}; Object.keys(c).forEach(function (k) { o[k] = Math.round(c[k] * n); }); return o; }
  function custoMuro(n) { return mult(CUSTO_TRECHO, n); }
  function custoNivel(m) { return mult(CUSTO_TRECHO, bordas(m).length * 0.5 * (m.nivel + 1)); }
  function noFila(local, rotulo, seg) {
    var f = D.filas, ult = f.obras.length ? RP.fimItem(f.obras[f.obras.length - 1]) : Date.now(), fim = Math.max(ult, Date.now()) + seg * 1000;
    f.obras.push({ local: local, rotulo: rotulo, fim: fim, total: seg });
    return fim;
  }

  /* ---------------------------------------------------------------- prévia (SVG) */
  function previa(ids, rotulo) {
    var set = area(ids), hs = Object.keys(set).map(function (kk) { return set[kk]; });
    if (!hs.length) return '';
    var cs = hs.map(function (h) { return h[0]; }), ls = hs.map(function (h) { return h[1]; });
    var c0 = Math.max(0, Math.min.apply(null, cs) - 1), c1 = Math.min(H.COLS - 1, Math.max.apply(null, cs) + 1);
    var l0 = Math.max(0, Math.min.apply(null, ls) - 1), l1 = Math.min(H.LINS - 1, Math.max.apply(null, ls) + 1);
    var a = H.centro(c0, l0), b = H.centro(c1, l1), vb = [a.x - H.W, a.y - H.R, b.x - a.x + 2 * H.W, b.y - a.y + 2 * H.R];
    var h = '', c, l;
    for (l = l0; l <= l1; l++) for (c = c0; c <= c1; c++) {
      var ce = H.centro(c, l), e = W.estado(c, l);
      h += '<polygon class="hx ' + (e.v === 'desconhecido' ? 'mr-nevoa' : W.rioSet[W.chave(c, l)] ? 'mr-rio' : 't-' + W.T[l][c]) + (set[chave(c, l)] ? ' muro-dentro' : '') + '" points="' + H.cantos(ce.x, ce.y, H.R + 0.6) + '"/>';
    }
    h += '<path class="muro-linha" d="' + bordasDe(set).map(function (s) { return 'M' + s.a.x.toFixed(1) + ' ' + s.a.y.toFixed(1) + 'L' + s.b.x.toFixed(1) + ' ' + s.b.y.toFixed(1); }).join('') + '"/>';
    ids.forEach(function (id) { var x = W.local(id), p = H.centro(x.c, x.l); h += '<g transform="translate(' + p.x.toFixed(0) + ' ' + p.y.toFixed(0) + ')"><circle class="mr-pino" r="13"/><use href="#i-' + x.tipo + '" x="-9" y="-9" width="18" height="18" class="mr-pino-ico"/></g>'; });
    return '<svg class="mini-rota mapa-svg muro-previa" viewBox="' + vb.map(function (v) { return v.toFixed(0); }).join(' ') + '" role="img" aria-label="' + RP.esc(rotulo) + '">' + h + '</svg>';
  }

  /* ---------------------------------------------------------------- aba Defesas da construção */
  var sel = [];
  function cartaoMuro(m) {
    var bs = bordas(m), cn = custoNivel(m), fn = faltaArea(cn, m.locais), ft = faltaArea(CUSTO_TORRE, m.locais);
    return '<div class="card pilha muro-card"><div class="linha"><span class="ico-placa ico-placa-g">' + RP.icone('muralha') + '</span><span style="flex:1;min-width:0"><b>' + RP.esc(m.nome) + '</b><br><small class="fraco">' + m.locais.map(nomeLocal).join(', ') + '</small></span><span class="selo">Nv ' + m.nivel + '</span></div>' +
      (m.obra ? '<p class="nota-antiga">' + RP.icone('martelo', 'ico-p') + '<span>Em obra · termina em <b class="num" data-fim="' + m.obra + '">' + RP.fmtResta(m.obra - Date.now()) + '</b></span></p>' : '') +
      '<div class="ext-numeros"><div><span class="fraco">Trechos</span><b class="num">' + bs.length + '</b></div><div><span class="fraco">Torres</span><b class="num">' + (m.torres || 0) + '</b></div><div><span class="fraco">Arqueiros no alto</span><b class="num">' + (m.arqueiros || 0) + '</b></div></div>' +
      '<div class="card mini-rota-card">' + previa(m.locais, m.nome) + '</div>' +
      '<div class="muro-acao"><div class="linha-entre"><span><b>Subir para nível ' + (m.nivel + 1) + '</b><br>' + RP.custoHTML(cn) + '</span>' +
      (Object.keys(fn).length ? '<a class="btn btn-p" href="' + RP.linkTrazer(m.locais[0], fn) + '">' + RP.icone('carroca') + 'Trazer</a>' : '<button type="button" class="btn btn-p btn-primario" data-muro-nivel="' + m.id + '">' + RP.icone('martelo') + 'Subir</button>') + '</div></div>' +
      '<div class="muro-acao"><div class="linha-entre"><span><b>Torre de arqueiros</b><small class="fraco"> · +' + ARQ_TORRE + ' no alto</small><br>' + RP.custoHTML(CUSTO_TORRE) + '</span>' +
      (Object.keys(ft).length ? '<a class="btn btn-p" href="' + RP.linkTrazer(m.locais[0], ft) + '">' + RP.icone('carroca') + 'Trazer</a>' : '<button type="button" class="btn btn-p btn-primario" data-muro-torre="' + m.id + '">' + RP.icone('torre') + 'Erguer</button>') + '</div></div>' +
      '<p class="fraco" style="font-size:var(--fs-2)">O material precisa estar nos locais dentro do muro.</p></div>';
  }
  function htmlDefesas() {
    var meus = D.locais.filter(function (x) { return x.reino === 'meu'; }), murados = {};
    D.muros.forEach(function (m) { if (m.dono === 'meu') m.locais.forEach(function (id) { murados[id] = m; }); });
    var livres = meus.filter(function (x) { return x.tipo !== 'castelo' && !murados[x.id]; });
    sel = sel.filter(function (id) { return livres.some(function (x) { return x.id === id; }); });
    var ok = sel.length && valido(sel), n = sel.length ? bordasDe(area(sel)).length : 0, custo = custoMuro(n), falta = sel.length ? faltaArea(custo, sel) : {};
    var castelo = W.local('castelo');
    return '<div class="nota-regra">' + RP.icone('muralha', 'ico-p') + '<span>Muros envolvem <b>um ou vários locais</b>. São <b>caros</b> porque dão muita vantagem contra invasões. Torres põem <b>arqueiros no alto</b>: atiram protegidos até o invasor entrar ou derrubar o muro.</span></div>' +
      '<div class="secao-titulo">Seus muros</div><div class="pilha">' +
      '<div class="card linha"><span class="ico-placa ico-placa-g">' + RP.icone('castelo') + '</span><span style="flex:1"><b>Muralha do castelo</b><br><small class="fraco">Vem com o ' + RP.esc(nomeLocal(castelo.id)) + ' · nível 3 · 4 torres</small></span><span class="selo">Nv 3</span></div>' +
      D.muros.filter(function (m) { return m.dono === 'meu'; }).map(cartaoMuro).join('') + '</div>' +
      '<div class="secao-titulo">Nova muralha</div><div class="card pilha">' +
      '<p class="fraco" style="font-size:var(--fs-2)">Escolha os locais que ela vai envolver. Locais vizinhos (até ' + DIST_MAX + ' hexágonos entre si) cabem no mesmo muro.</p>' +
      '<div class="obj-add-lista">' + livres.map(function (x) {
        return '<button type="button" class="btn btn-p chip-sel" data-muro-sel="' + x.id + '" aria-pressed="' + (sel.indexOf(x.id) >= 0) + '">' + RP.icone(x.tipo, 'ico-p') + RP.esc(x.nome) + '</button>';
      }).join('') + '</div>' +
      (sel.length ? (ok ? '<div class="card mini-rota-card">' + previa(sel, 'Prévia da nova muralha') + '</div>' +
          '<div class="ext-numeros"><div><span class="fraco">Trechos</span><b class="num">' + n + '</b></div><div><span class="fraco">Tempo</span><b class="num">' + RP.fmtDuracao(n * TEMPO_TRECHO) + '</b></div><div><span class="fraco">Locais</span><b class="num">' + sel.length + '</b></div></div>' +
          '<div class="linha" style="flex-wrap:wrap">' + RP.custoHTML(custo) + '<small class="fraco">somando os estoques dos locais envolvidos</small></div>' +
          (Object.keys(falta).length ? '<p class="nota-antiga">' + RP.icone('alerta', 'ico-p') + '<span>Faltam ' + Object.keys(falta).map(function (k) { return RP.num(falta[k]) + ' de ' + RP.nomeRecurso(k); }).join(', ') + ' nesses locais.</span></p>' +
            '<a class="btn btn-p btn-primario" href="' + RP.linkTrazer(sel[0], falta) + '">' + RP.icone('carroca') + 'Trazer recursos</a>'
            : '<button type="button" class="btn btn-p btn-primario" data-muro-construir>' + RP.icone('muralha') + 'Construir muralha</button>')
        : '<p class="nota-antiga">' + RP.icone('info', 'ico-p') + '<span>Locais distantes demais para um muro só. Faça muros separados.</span></p>') : '') + '</div>' +
      '<div style="height:var(--esp-8)"></div>';
  }
  /* cliques da aba; devolve true se tratou */
  function clique(e, redesenhar) {
    var b;
    if ((b = e.target.closest('[data-muro-sel]'))) {
      var id = b.getAttribute('data-muro-sel'), i = sel.indexOf(id);
      if (i >= 0) sel.splice(i, 1); else sel.push(id);
      redesenhar(); return true;
    }
    if (e.target.closest('[data-muro-construir]')) {
      var n = bordasDe(area(sel)).length, custo = custoMuro(n);
      if (Object.keys(faltaArea(custo, sel)).length) return true;
      gastarArea(custo, sel);
      var fim = noFila(sel[0], 'Muralha · ' + sel.map(nomeLocal).join(', '), n * TEMPO_TRECHO);
      D.muros.push({ id: 'mu-' + Date.now(), nome: sel.length > 1 ? 'Muralha de ' + nomeLocal(sel[0]) + ' e vizinhos' : 'Muralha de ' + nomeLocal(sel[0]), dono: 'meu', locais: sel.slice(), nivel: 1, torres: 0, arqueiros: 0, obra: fim });
      RP.aviso({ titulo: 'Muralha na fila de obras', texto: n + ' trechos · termina em ' + RP.fmtResta(fim - Date.now()) + '.', icone: 'muralha', tipo: 'sucesso' });
      sel = []; RP.invalidarTela('mapa'); RP.invalidarTela('reino'); redesenhar(); return true;
    }
    if ((b = e.target.closest('[data-muro-nivel]'))) {
      var m = D.muros.filter(function (q) { return q.id === b.getAttribute('data-muro-nivel'); })[0], cn = custoNivel(m);
      gastarArea(cn, m.locais);
      var f1 = noFila(m.locais[0], m.nome + ' → nível ' + (m.nivel + 1), bordas(m).length * TEMPO_TRECHO * 0.6);
      RP.aviso({ titulo: m.nome + ' na fila', texto: 'Nível ' + (m.nivel + 1) + ' termina em ' + RP.fmtResta(f1 - Date.now()) + '.', icone: 'muralha', tipo: 'sucesso' });
      redesenhar(); return true;
    }
    if ((b = e.target.closest('[data-muro-torre]'))) {
      var mt = D.muros.filter(function (q) { return q.id === b.getAttribute('data-muro-torre'); })[0];
      gastarArea(CUSTO_TORRE, mt.locais);
      var f2 = noFila(mt.locais[0], 'Torre de arqueiros · ' + mt.nome, TEMPO_TORRE);
      RP.aviso({ titulo: 'Torre na fila de obras', texto: 'Termina em ' + RP.fmtResta(f2 - Date.now()) + '. Depois, ' + ARQ_TORRE + ' arqueiros sobem para o alto.', icone: 'torre', tipo: 'sucesso' });
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
