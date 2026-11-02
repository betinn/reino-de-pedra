/* Reino de Pedra — "Precisa de você".
   Responde ao "abri o jogo, e agora?" sem missões nem obrigação: só lista o que pede atenção,
   as oportunidades à vista e como anda o reino. Nada aqui força o jogador a fazer algo. */
(function () {
  'use strict';
  var RP = window.RP, D = RP.dados, W = RP.mundo, U = RP.util;

  function nomeLocal(id) { var x = W.local(id); return x ? (x.reino === 'meu' && x.tipo === 'castelo' ? 'Castelo de ' + RP.estado.nome : W.nomeAparente(x)) : '—'; }
  function tempo(fim) { return '<b class="num" data-fim="' + fim + '">' + RP.fmtResta(fim - Date.now()) + '</b>'; }

  RP.pendencias = function () {
    var L = [], agora = Date.now();
    /* urgente */
    if (RP.batalha && RP.batalha.ativa()) {
      var bx = W.local(D.batalha.local);
      L.push({ g: 'urgente', ic: 'tropas', t: 'Batalha na ' + bx.nome, d: 'termina em ' + tempo(agora + RP.batalha.restante() * 1000), href: '#/batalha', bt: 'Acompanhar' });
    }
    W.marchas.forEach(function (m) {
      var x = m.d.alvo && W.local(m.d.alvo);
      if (m.d.hostil && x && x.reino === 'meu' && m.d.chegada > agora)
        L.push({ g: 'urgente', ic: 'alerta', t: 'Ataque a caminho: ' + x.nome, d: 'forças desconhecidas · chegam em ' + tempo(m.d.chegada), href: '#/mapa?ordem=1&destino=' + x.id, bt: 'Reforçar' });
    });
    if (RP.sistema('reliquias')) D.reliquias.forEach(function (r) {
      var m = RP.ladroesDe && RP.ladroesDe(r);
      if (m) L.push({ g: 'urgente', ic: 'lendario', t: r.nome + ' sendo levada', d: 'some na névoa em ' + tempo(m.d.chegada), href: '#/interceptar?marcha=' + m.d.id, bt: 'Interceptar' });
    });
    if (RP.sistema('alianca')) D.pedidos.forEach(function (pd) {
      if (pd.para === 'meu' && pd.estado === 'aberto')
        L.push({ g: 'urgente', ic: 'estandarte', t: D.reinos[pd.de].nome + ' pede ' + RP.cargaTxt(pd.carga), d: 'aliado · ' + RP.esc(pd.motivo), href: '#/alianca', bt: 'Responder' });
    });
    /* oportunidades */
    W.marchas.forEach(function (m) {
      if (m.d.tipo !== 'caravana' || m.d.troca || m.d.dono === 'meu' || W.aliado(m.d.dono) || m.d.chegada <= agora) return;
      var p = m.posicao();
      if (W.estado(p.hex[0], p.hex[1]).v === 'visivel')
        L.push({ g: 'oportunidade', ic: 'carroca', t: 'Caravana desconhecida à vista', d: RP.esc(m.d.cargaTxt) + ' · sai de vista em ' + tempo(m.d.chegada), href: '#/interceptar?marcha=' + m.d.id, bt: 'Interceptar' });
    });
    if (RP.sistema('reliquias')) D.locais.forEach(function (x) {
      var c = RP.concentracao && RP.concentracao(x.id);
      if (c && c.visivel) L.push({ g: 'oportunidade', ic: 'lendario', t: c.n + ' relíquias juntas à vista', d: (c.nivel === 'farol' ? 'farol' : 'brilho') + ' · ' + RP.esc(nomeLocal(x.id)) + ' · dono desconhecido', href: '#/reliquias', bt: 'Ver' });
    });
    if (RP.sistema('reliquias')) D.ruinasComReliquia.forEach(function (id) {
      var j = W.jazida(id);
      if (W.estado(j.c, j.l).v !== 'desconhecido' && !D.escavacoes.some(function (q) { return q.jazida === id; }))
        L.push({ g: 'oportunidade', ic: 'ruina', t: 'Ruína antiga com relíquia', d: 'ninguém escavando', href: '#/extracao?jazida=' + id, bt: 'Escavar' });
    });
    L = L.concat(RP.pendenciasComercio ? RP.pendenciasComercio() : [], RP.sistema('comercio') && RP.pendenciasMensagens ? RP.pendenciasMensagens() : []);
    /* no seu reino */
    var nf = D.feridos.reduce(function (s, f) { return s + f.qtd; }, 0);
    if (nf) {
      var morre = Math.min.apply(null, D.feridos.map(function (f) { return 24 - f.horas; }));
      L.push({ g: morre < 6 ? 'urgente' : 'reino', ic: 'ferido', t: nf + (nf > 1 ? ' feridos esperando ervas' : ' ferido esperando ervas'), d: 'os primeiros morrem em ' + Math.round(morre) + ' h sem cura · ' + Math.floor(RP.qtdRecurso('ervas', '*')) + ' ervas no reino', href: '#/tropas', bt: 'Curar' });
    }
    var esperando = D.filas.obras.filter(function (o) { return o.aguarda && o.aguarda > agora; });
    if (esperando.length) L.push({ g: 'reino', ic: 'carroca', t: esperando.length + (esperando.length > 1 ? ' obras esperando material' : ' obra esperando material'), d: 'o último chega em ' + tempo(Math.max.apply(null, esperando.map(function (o) { return o.aguarda; }))), href: '#/construcao', bt: 'Ver' });
    var fo = D.filas.obras, fr = D.filas.recrutamento;
    L.push(fo.length ? { g: 'reino', ic: 'martelo', t: 'Obras: ' + fo.length + ' de ' + D.filas.vagasObras, d: 'a fila termina ' + RP.fmtHora(RP.fimItem(fo[fo.length - 1])), href: '#/construcao', bt: 'Planejar' }
      : { g: 'reino', ic: 'martelo', t: 'Nenhuma obra na fila', d: 'o reino pode crescer enquanto você estiver fora', href: '#/construcao', bt: 'Construir' });
    if (!fr.length) L.push({ g: 'reino', ic: 'tropas', t: 'Nada sendo recrutado', d: 'a fila aceita até ' + D.filas.vagasRecrutamento + ' itens', href: '#/recrutamento', bt: 'Recrutar' });
    var paradas = Object.keys(D.disponiveis).reduce(function (s, k) { return s + (D.disponiveis[k] || 0); }, 0);
    if (paradas) L.push({ g: 'reino', ic: 'tropas', t: paradas + ' tropas paradas no castelo', d: 'defendem o castelo; podem receber outra ordem', href: '#/tropas', bt: 'Ordens' });
    (RP.avist && RP.sistema('espionagem') ? RP.avist.ativos() : []).forEach(function (a) {
      L.push({ g: 'reino', ic: a.tipo === 'espiao' ? 'batedor' : 'tropas', t: (a.tipo === 'espiao' ? 'Espião visto' : 'Exército visto') + ' há ' + Math.max(1, Math.round(RP.avist.idade(a))) + ' h', d: 'por ' + RP.esc(a.por) + ' · rumo ' + RP.esc(a.rumo), href: '#/mapa?modo=tatico&abrir=avist:' + a.id, bt: 'Ver' });
    });
    return L;
  };
  var GRUPOS = [['urgente', 'Agora'], ['oportunidade', 'Oportunidades'], ['reino', 'No seu reino']];
  function itemHTML(p) {
    return '<div class="card linha pend-item pend-' + p.g + '"><span class="ico-placa">' + RP.icone(p.ic) + '</span><span style="flex:1;min-width:0"><b>' + RP.esc(p.t) + '</b><br><small class="fraco">' + p.d + '</small></span>' +
      '<a class="btn btn-p' + (p.g === 'urgente' ? ' btn-primario' : '') + '" href="' + p.href + '">' + p.bt + '</a></div>';
  }
  /* resumo para o topo de Meu reino */
  RP.pendenciasResumo = function () {
    var L = RP.pendencias(), top = L.filter(function (p) { return p.g === 'urgente'; }).concat(L.filter(function (p) { return p.g === 'oportunidade'; })).slice(0, 3);
    if (!top.length) top = L.slice(0, 2);
    return '<div class="secao-titulo" style="margin-top:0">Precisa de você</div><div class="pilha">' + top.map(itemHTML).join('') + '</div>' +
      '<a class="btn btn-p btn-fantasma ver-tudo" href="#/agora">' + RP.icone('menu') + 'Ver tudo (' + L.length + ')</a>';
  };
  RP.registrarTela('agora', {
    secao: 'reino',
    montar: function (el) { el.innerHTML = U.topo('Precisa de você', 'reino', 'Nada aqui é obrigatório') + '<div class="conteudo-tela ag-conteudo"></div>'; },
    entrar: function (el) {
      var L = RP.pendencias();
      RP.$('.ag-conteudo', el).innerHTML = '<p class="fraco" style="font-size:var(--fs-2)">O que pede atenção agora, o que está à vista e como anda o reino. Você decide o que fazer.</p>' +
        GRUPOS.map(function (g) {
          var it = L.filter(function (p) { return p.g === g[0]; });
          return it.length ? '<div class="secao-titulo">' + g[1] + '</div><div class="pilha">' + it.map(itemHTML).join('') + '</div>' : '';
        }).join('') + '<div style="height:var(--esp-8)"></div>';
    }
  });
})();
