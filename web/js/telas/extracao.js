/* Reino de Pedra — Extração de recursos descobertos e escavação de ruínas antigas.
   A ordem sai pelo painel da base (RP.envio.paraOrdem): de onde saem, quem vai e Enter envia, como o "Enviar tropas para cá".
   Este arquivo declara as ordens "Extrair" e "Escavar", as opções delas no painel (repetir, posto, para onde vai a relíquia)
   e a lista #/extracao (jazidas, ruínas e grupos em andamento). Dados: GET /extracao, POST /extracao/previa, POST /postos. */
(function () {
  'use strict';
  var RP = window.RP, V = RP.valiosos;

  var ext = { dados: null };
  var tela = null;

  function carregar() {
    return RP.get('/extracao').then(function (d) { ext.dados = d; RP.sincronizar(d.agora); return d; });
  }
  function idadeTxt(min) { return !min ? 'visível' : 'visto ' + RP.fmtHa(min / 60); }
  function jazidaDados(h) { return ((ext.dados && ext.dados.jazidas) || []).filter(function (j) { return j.hex === h; })[0]; }
  function ruinaDados(h) { return ((ext.dados && ext.dados.ruinas) || []).filter(function (r) { return r.hex === h; })[0]; }

  /* ---------------------------------------------------------------- lista: o que se conhece e quem está trabalhando */
  function grupoCard(g) {
    var dados = ext.dados, j = g.jazidaId && dados.jazidas.filter(function (x) { return x.id === g.jazidaId; })[0];
    var titulo = g.estado === 'extraindo' ? 'Extraindo ' + RP.nomeRecurso(j ? j.recurso : '') : g.estado === 'escavando' ? 'Escavando a ruína' : g.estado === 'entregando' ? 'Levando a carga a ' + (g.deposito || 'um depósito') : g.ordem === 'escavar' ? 'A caminho da ruína' : 'A caminho da jazida';
    var tempo = g.estado === 'escavando' && g.escavaFim ? RP.barraTempo(g.escavaInicio, g.escavaFim, { classe: 'curta', cor: 'sucesso', rotulo: 'Escavação' }) + '<small class="fraco">relíquia</small>'
      : g.estado === 'extraindo' && g.cheiaEm ? RP.barraTempo(g.extraiInicio, g.cheiaEm, { classe: 'curta', cor: 'sucesso', rotulo: 'Extração' }) + '<small class="fraco">carga cheia</small>'
      : g.chegada ? RP.barraTempo(g.partida, g.chegada, { classe: 'curta', rotulo: 'Marcha' }) + '<small class="fraco">chega</small>' : '';
    var carga = Object.keys(g.carga || {}).map(function (k) { return RP.num(g.carga[k]) + ' de ' + RP.nomeRecurso(k); }).join(', ');
    return '<div class="card emcampo"><span class="ico-placa dono-meu">' + RP.icone('picareta') + '</span>' +
      '<span class="emcampo-corpo"><b>' + RP.esc(titulo) + '</b><small class="fraco">' + RP.esc(g.resumo) + (g.repetir ? ' · repete' : '') + '</small>' +
      (g.ritmo ? '<small class="fraco">' + V.fmtRitmo(g.ritmo) + '/h · carga ' + RP.esc(carga || '0') + ' de ' + RP.num(g.cargaMax) + '</small>' : carga ? '<small class="fraco">Levam ' + RP.esc(carga) + '</small>' : '') +
      '<span class="exercito-acoes">' + (g.estado !== 'entregando' ? '<button type="button" class="btn btn-p" data-ext-voltar="' + g.id + '">' + RP.icone('voltar') + 'Voltar</button>' : '') +
      '<a class="btn btn-p btn-fantasma" href="#/mapa?foco=' + g.hex + '">' + RP.icone('mapa') + 'Ver</a></span></span>' +
      '<span class="emcampo-tempo">' + tempo + '</span></div>';
  }
  function desenhar() {
    var el = tela; if (!el || el.hidden) return;
    var d = ext.dados, cont = RP.$('.ext-conteudo', el);
    if (!d) { cont.innerHTML = '<p class="fraco">Carregando…</p>'; return; }
    var jz = d.jazidas.filter(function (j) { return j.restante > 0; }), rs = d.ruinas.filter(function (r) { return !r.esgotada; });
    var h = '<div class="secao-titulo">Jazidas e ruínas</div>' + (jz.length || rs.length ? '<div class="escolhas escolhas-lista">' +
      rs.map(function (r) {
        return '<a class="escolha escolha-linha" href="#/mapa?centro=' + r.hex + '&ordem=escavar"><span class="ico-placa">' + RP.icone('ruina', 'r-lendario') + '</span>' +
          '<span class="escolha-txt"><b>Ruína antiga</b><small class="fraco">Escavação · ' + RP.esc(RP.ganhosRuina(d.reliquiaTipos, true)) + ' · ' + idadeTxt(r.idadeMin) + (r.posto === 'meu' ? ' · com posto' : '') + '</small></span></a>';
      }).join('') +
      jz.map(function (j) {
        return '<a class="escolha escolha-linha" href="#/mapa?centro=' + j.hex + '&ordem=extrair"><span class="ico-placa">' + RP.icone(j.recurso, 'r-' + j.recurso) + '</span>' +
          '<span class="escolha-txt"><b>' + RP.esc(j.nome) + '</b><small class="fraco">' + (j.lendaria ? 'Lendário · ' : '') + RP.num(j.restante) + ' restantes · vale ' + j.valor + ' · ' + idadeTxt(j.idadeMin) +
          (j.posto === 'meu' ? ' · com posto' : j.posto === 'outro' ? ' · posto de outro reino' : '') + '</small></span>' +
          (j.tropas ? '<span class="selo selo-visivel">' + j.tropas + ' extraindo</span>' : '') + '</a>';
      }).join('') + '</div>' : '<p class="fraco">Nenhuma jazida descoberta nem ruína antiga conhecida. Prospectores revelam jazidas valiosas; ruínas aparecem ao explorar.</p>');
    if (d.grupos.length) h += '<div class="secao-titulo">Em andamento</div><div class="pilha">' + d.grupos.map(grupoCard).join('') + '</div>';
    cont.innerHTML = h + '<div style="height:var(--esp-6)"></div>';
  }

  RP.registrarTela('extracao', {
    secao: 'tropas',
    montar: function (el) {
      tela = el;
      el.innerHTML = RP.topoVoltar('Extração', 'tropas') + '<div class="conteudo-tela ext-conteudo"></div>';
      var atualizar = V.debounce(function () { if (!el.hidden) carregar().then(desenhar, function () { /* offline */ }); }, 500);
      RP.ouvir('marchas', atualizar);
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-ext-voltar]');
        if (!b) return;
        V.tentar(RP.post('/tropas/' + b.getAttribute('data-ext-voltar') + '/ordem', { ordem: 'retornar' })).then(function () {
          RP.aviso({ titulo: 'Tropas voltando', texto: 'Levam o que já tiraram.', icone: 'voltar', tipo: 'sucesso' });
          carregar().then(desenhar);
        });
      });
    },
    entrar: function () {
      desenhar();
      carregar().then(desenhar, function () { /* aviso já mostrado */ });
    }
  });

  /* ---------------------------------------------------------------- painel da ordem: opções e o que muda com elas */
  function subtituloHex(h, e) { return 'hexágono ' + RP.hex.c(h) + ', ' + RP.hex.l(h) + (e.semOrigem ? '' : ' · de onde saem e quem vai'); }
  /* o posto entra na fila de obras antes da partida; se falhar, o grupo vai assim mesmo e o aviso diz por quê */
  function botaoPosto(e, estado, nome) {
    var pc = ext.dados && ext.dados.posto;
    if (estado === 'fila') return '<p class="fraco">' + RP.icone('martelo', 'ico-p') + 'Posto na fila de obras.</p>';
    if (estado || !pc) return '';
    return '<button type="button" class="alternar" data-painel-posto aria-pressed="' + !!e.opcoes.posto + '" data-dica="' + RP.esc('<b>Posto de ' + nome + '</b><small>Rende mais e serve de base. Entra na fila de obras; o material vai a pé.</small>' + RP.custoHTML(pc.custo) + '<small>' + RP.icone('relogio', 'ico-p') + RP.fmtDuracao(pc.seg) + ' de obra</small>') + '">' +
      RP.icone('picareta') + '<span>Construir posto de ' + nome + '</span><i aria-hidden="true"></i></button>';
  }
  function antesPosto(e) {
    if (!e.opcoes.posto) return Promise.resolve('');
    return RP.post('/postos', { hex: e.hex }).then(function () { return ' Posto na fila de obras.'; }, function (er) {
      RP.aviso({ titulo: 'Posto não construído', texto: er.message, icone: 'alerta', tipo: 'alerta' }); return '';
    });
  }
  /* ruína é pública, mas só se escava em área explorada: as tropas vão, revelam a área e a ordem se dá ao chegar */
  function ruinaFechada(h) { return !!RP.mapaModelo.estado(h).nunca; }
  function previaGrupo(e, g) { return RP.post('/extracao/previa', { deLocalId: e.de, tropas: g, hex: e.hex }); }

  var PAINEL_EXTRAIR = {
    titulo: function (h) { var j = jazidaDados(h); return j ? RP.esc(j.nome) : 'Extrair aqui'; },
    subtitulo: subtituloHex,
    preparar: function (e) { e.opcoes = { repetir: false, posto: false }; return carregar().catch(function () { /* o painel abre mesmo assim */ }); },
    /* só vai quem carrega, até o limite da jazida; sem ninguém assim, uma unidade que carregue */
    grupo: function (g, l, e) {
      var j = jazidaDados(e.hex), d = ext.dados, cabe = d ? Math.max(1, d.maxTropas - ((j && j.tropas) || 0)) : 6, r = {}, n = 0;
      Object.keys(g).forEach(function (k) {
        var u = RP.unidade(k), q = u && u.carga > 0 ? Math.min(g[k], cabe - n) : 0;
        if (q > 0) { r[k] = q; n += q; }
      });
      if (n) return r;
      var k0 = Object.keys(l.guarnicao || {}).filter(function (k) { return l.guarnicao[k] > 0 && (RP.unidade(k) || {}).carga > 0; })[0];
      if (k0) r[k0] = 1;
      return r;
    },
    opcoes: function (e) {
      var j = jazidaDados(e.hex);
      return '<div class="envio-opcoes"><button type="button" class="alternar" data-painel-repetir aria-pressed="' + !!e.opcoes.repetir + '">' + RP.icone('relogio') + '<span>Repetir <small class="fraco">(volta à jazida depois de entregar)</small></span><i aria-hidden="true"></i></button>' +
        botaoPosto(e, j && j.posto, 'extração') + '</div>';
    },
    resumo: function (e, g) {
      if (e.marchaId) return Promise.resolve('');
      return previaGrupo(e, g).then(function (p) {
        var rit = e.opcoes.posto ? p.cenarios[2].v : p.ritmo, dur = rit ? p.restante / rit : null;
        var excede = p.total + (p.jaNaJazida || 0) > p.maxTropas;
        return '<p class="fraco">' + (rit ? 'Rendem <b>' + V.fmtRitmo(rit) + '/h</b> de ' + RP.esc(RP.nomeRecurso(p.recurso)) + ': a carga enche em ≈ ' + V.fmtHoras(p.cargaMax / rit) + ' e vai para ' + RP.esc(p.deposito || 'o castelo') + '. A jazida dura ≈ ' + V.fmtHoras(dur) + '.' : 'Essas tropas não carregam nada.') + '</p>' +
          (excede ? '<p class="txt-alerta">Até ' + p.maxTropas + ' tropas por jazida' + (p.jaNaJazida ? ' (' + p.jaNaJazida + ' suas já estão lá)' : '') + '.</p>' : '');
      });
    },
    antes: antesPosto
  };
  var PAINEL_ESCAVAR = {
    titulo: function () { return 'Escavar a ruína'; },
    subtitulo: subtituloHex,
    preparar: function (e) { e.opcoes = { posto: false, destino: RP.reino.casteloId }; return carregar().catch(function () { /* o painel abre mesmo assim */ }); },
    antesDeIr: function (h) { return ruinaFechada(h) ? 'Esta ruína fica fora da área explorada: só dá para escavar depois de ver o lugar. As tropas vão até lá, revelam a área e, ao chegarem, você dá a ordem de escavar.' : null; },
    opcoes: function (e) {
      var r = ruinaDados(e.hex), locais = ((RP.reino && RP.reino.locais) || []).filter(function (l) { return !l.ruina; })
        .sort(function (a, b) { return (a.id === e.opcoes.destino ? -1 : b.id === e.opcoes.destino ? 1 : 0) || RP.hex.dist(a.hex, e.hex) - RP.hex.dist(b.hex, e.hex); }).slice(0, 5);
      return '<div class="envio-opcoes">' + (locais.length > 1 ? '<span class="envio-opcoes-rotulo">Ao achar, a relíquia vai para</span><div class="abas abas-rolagem" role="group" aria-label="Para onde vai a relíquia">' + locais.map(function (l) {
        return '<button type="button" class="aba" data-painel-destino="' + l.id + '" aria-pressed="' + (l.id === e.opcoes.destino) + '">' + RP.esc(l.nome) + '</button>';
      }).join('') + '</div>' : '') + botaoPosto(e, r && r.posto, 'escavação') + '</div>';
    },
    resumo: function (e, g) {
      if (e.marchaId) return Promise.resolve('<p class="fraco">Escavam até achar a relíquia; mais tropas e posto encurtam.</p>');
      return previaGrupo(e, g).then(function (p) {
        var horas = e.opcoes.posto ? p.cenarios[2].v : p.horas;
        return '<p class="fraco">Escavam por <b>≈ ' + V.fmtHoras(horas) + '</b> (no mínimo ' + V.fmtHoras(p.minimo) + ') e rendem 1 relíquia, que o grupo carrega e pode ser roubada no caminho.' + (p.poucoProtegida ? ' Grupo pequeno, escolta fraca.' : '') + '</p>';
      });
    },
    antes: antesPosto
  };
  document.addEventListener('click', function (e) {
    var E = RP.envio, st = E && E.painel() ? E.estado() : null, b;
    if (!st || !st.opcoes) return;
    if (e.target.closest('[data-painel-repetir]')) { st.opcoes.repetir = !st.opcoes.repetir; E.repintarPainel(); return; }
    if (e.target.closest('[data-painel-posto]')) { st.opcoes.posto = !st.opcoes.posto; E.repintarPainel(); return; }
    if ((b = e.target.closest('[data-painel-destino]'))) { st.opcoes.destino = +b.getAttribute('data-painel-destino'); E.repintarPainel(); }
  });

  /* ---------------------------------------------------------------- mapa: ordens de envio e botão na folha do hexágono */
  function objs(h, d) { return (d && d.porHex && d.porHex[h]) || []; }
  function jazidaEm(h, d) { return objs(h, d).filter(function (o) { return o.tipo === 'jazida' && o.restante > 0; })[0]; }
  function ruinaEm(h, d) { return objs(h, d).filter(function (o) { return o.tipo === 'ruina-antiga' && !o.esgotada; })[0]; }
  RP.ordensEnvio.push({
    ordem: 'extrair', rotulo: 'Extrair aqui', verbo: 'Extrair', icone: 'picareta', titulo: 'Extrair', painel: PAINEL_EXTRAIR,
    descricao: function () { return '<div class="info-linha"><span class="fraco">Ordem</span><span>Extraem até a carga encher e levam ao armazém ou castelo</span></div>'; },
    dados: function (h, d, e) { return { repetir: !!(e && e.opcoes && e.opcoes.repetir) }; },
    quando: function (h, d) { return !!jazidaEm(h, d); }
  });
  RP.ordensEnvio.push({
    ordem: 'escavar', rotulo: 'Escavar a ruína', verbo: 'Escavar', icone: 'picareta', titulo: 'Escavar', painel: PAINEL_ESCAVAR,
    descricao: function () { return '<div class="info-linha"><span class="fraco">Ordem</span><span>Escavam até achar a relíquia e a levam ao castelo</span></div>'; },
    dados: function (h, d, e) { return { destinoLocalId: (e && e.opcoes && e.opcoes.destino) || RP.reino.casteloId }; },
    quando: function (h, d) { return !!ruinaEm(h, d) && !ruinaFechada(h); }
  });
  /* na folha da jazida ou da ruína (tocada no mapa): abre o painel com as tropas */
  function acaoObjeto(tipo, rotulo, ordem, ok) {
    var tp = RP.mapa.tiposObjeto[tipo] = RP.mapa.tiposObjeto[tipo] || {}, antes = tp.acoes;
    tp.acoes = function (o, d) {
      return (antes ? antes(o, d) || '' : '') + (ok(o) && !(RP.envio && RP.envio.ativo()) ? '<button type="button" class="btn btn-p btn-primario" data-envio-painel="' + ordem + '" data-envio-hex="' + o.hex + '">' + RP.icone('picareta') + rotulo + '</button>' : '');
    };
  }
  acaoObjeto('jazida', 'Extrair', 'extrair', function (o) { return o.restante > 0; });
  acaoObjeto('ruina-antiga', 'Escavar', 'escavar', function (o) { return !o.esgotada; });

  RP.acoesTropas.push({ href: '#/extracao', icone: 'picareta', titulo: 'Extração', texto: 'Jazidas descobertas e ruínas antigas' });
  RP.itensMais.push({ icone: 'picareta', titulo: 'Extração', texto: 'Jazidas descobertas e ruínas antigas, com quem está trabalhando nelas', href: '#/extracao' });
  RP.FILTROS_RELATORIO.push(['extracao', 'Extração']);
})();
