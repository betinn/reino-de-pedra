/* Reino de Pedra — tela do mundo: duas visões do mesmo mapa, alternáveis e com o mesmo centro.
     Vista (cena 2.5D, js/vista/cena.js) e Mapa tático (js/vista/tatico.js), com zoom semântico (afastar além da
     Vista passa ao Mapa), minimapa, camadas e legenda, folhas de detalhe e a escolha do hexágono para fundar.
   Rotas: #/mapa?modo=cena|tatico, ?foco=<hex> (centra e abre a folha), ?centro=<hex> (só centra), ?fundar=<tipo>.
   API pública (RP.mapa): dados(), recarregar(), desenhar(), folhaHex(h), centrar(h), modo(), camadas,
     extrasFolhaHex[], acoesFolhaHex[], desenhosExtras[], legendaExtras[], tiposObjeto{}, tiposMarcha{}, perigoHex. */
(function () {
  'use strict';
  var RP = window.RP, H = RP.hex, M = RP.mapaModelo, MAPA = RP.mapa, A = RP.arte;

  var TERRENOS = {
    planicie: ['Planície', 'Deslocamento rápido · comida, cavalos de raça e sal'],
    floresta: ['Floresta', 'Deslocamento lento · madeira e caça'],
    colina: ['Colina', 'Deslocamento normal · ferro, pedra, aço e prata'],
    montanha: ['Montanha', 'Deslocamento lento · ouro, prata, pedras preciosas e minério raro'],
    pantano: ['Pântano', 'Deslocamento muito lento · ervas raras']
  };
  var NOME_MARCHA = RP.NOMES_MARCHA = RP.NOMES_MARCHA || {};
  ['carregadores:Carregadores', 'mensageiro:Mensageiro', 'caravana:Caravana', 'exercito:Exército'].forEach(function (x) { var p = x.split(':'); if (!NOME_MARCHA[p[0]]) NOME_MARCHA[p[0]] = p[1]; });

  var tela = null, cena = null, tat = null, modo = 'cena', selecao = -1, alvoFundar = null, posicionado = false;
  var mm = null, mmCtx = null, mmVista = null, mmVersao = -1, mmEscala = 1, rafMm = 0;

  function ativa() { return tela && !tela.hidden; }
  function visao() { return modo === 'cena' ? cena : tat; }

  /* ---------------------------------------------------------------- modos e câmera */
  function definirModo(m, opt) {
    opt = opt || {};
    var de = visao(), centro = de.centro(), sAtual = de.cam.s;
    if (m !== modo) { de.parar(); }
    modo = m;
    tela.setAttribute('data-modo', m);
    RP.pref('modo-mapa', m);
    RP.$$('[data-modo-btn]', tela).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-modo-btn') === m)); });
    if (m === 'cena') {
      cena.redimensionar();
      cena.centrar(opt.x != null ? opt.x : centro.x, opt.y != null ? opt.y : centro.y, opt.s || (de === cena ? sAtual : Math.max(1.4, Math.min(2.6, sAtual * 2.2))), 0.5, false);
      cena.iniciar();
    } else {
      tat.iniciar();
      tat.centrar(opt.x != null ? opt.x : centro.x, opt.y != null ? opt.y : centro.y, opt.s || (de === tat ? sAtual : Math.max(0.55, Math.min(1.2, sAtual * 0.45))), 0.5, false);
    }
    pedirMinimapa();
  }
  function centrarHex(h, animar) {
    var p = H.centroH(h), fy = RP.folhaAberta() ? 0.3 : 0.5;
    if (modo === 'cena') cena.centrar(p.x, p.y, Math.max(cena.cam.s, 1.8), fy, animar);
    else tat.centrar(p.x, p.y, Math.max(tat.cam.s, 0.9), fy, animar);
  }
  function irCastelo(animar) {
    var c = RP.castelo(); if (!c) return;
    var p = H.centroH(c.hex);
    if (modo === 'cena') cena.centrar(p.x, p.y, 1.7, 0.5, animar); else tat.centrar(p.x, p.y, Math.max(0.75, tat.cam.s), 0.5, animar);
  }
  function selecionar(h) {
    selecao = h == null ? -1 : h;
    if (tat) tat.selecionar(selecao);
  }

  /* ---------------------------------------------------------------- folhas */
  function seloEstado(e) {
    if (e.v === 'visivel') return '<span class="selo selo-visivel">' + RP.icone('olho') + 'Visível agora</span>';
    if (e.v === 'explorado') return '<span class="selo selo-antigo">' + RP.icone('relogio') + 'Visto ' + RP.fmtHa(e.horas) + '</span>';
    return '<span class="selo selo-desconhecido">' + RP.icone('nevoa') + 'Desconhecido</span>';
  }
  function coordTxt(h) { return '<span class="fraco num">' + H.c(h) + ' · ' + H.l(h) + '</span>'; }
  function linhaInfo(r, v) { return '<div class="info-linha"><span class="fraco">' + r + '</span><span>' + v + '</span></div>'; }
  function notaAntiga(e) { return e.v === 'explorado' ? '<p class="nota-antiga">' + RP.icone('relogio', 'ico-p') + 'Último estado conhecido, ' + RP.fmtHa(e.horas) + '. Pode ter mudado.</p>' : ''; }
  function abrirFolhaMapa(o, h) {
    selecionar(h);
    tela.classList.add('com-folha');
    var depois = o.aoFechar;
    o.aoFechar = function (troca) { if (!troca) { selecionar(null); tela.classList.remove('com-folha'); } if (depois) depois(troca); };
    RP.abrirFolha(o);
  }
  function nomeTerreno(h) {
    var t = M.terreno(h);
    if (!t) return 'Terra desconhecida';
    return TERRENOS[t][0] + (M.rio(h) ? ' com rio' : '');
  }
  function nomeObjeto(o) {
    var tp = MAPA.tiposObjeto[o.tipo];
    if (tp && tp.nome) return tp.nome(o);
    if (o.tipo === 'marcha') return RP.mapaTatico.revelada(o) ? (MAPA.tiposMarcha[o.marcha] || {}).nome || NOME_MARCHA[o.marcha] || 'Sua marcha' : 'Forças desconhecidas';
    if (o.tipo === 'local') return o.ruina ? 'Ruína' : o.dono === 'livre' ? 'Terra livre' : o.nome || RP.TIPOS_LOCAL[o.local] || 'Local';
    if (o.tipo === 'jazida') return 'Jazida de ' + RP.nomeRecurso(o.recurso);
    if (o.tipo === 'ruina-antiga') return 'Ruína antiga';
    return o.nome || o.rotulo || o.tipo;
  }
  function iconeObjeto(o) {
    var tp = MAPA.tiposObjeto[o.tipo];
    if (tp && tp.icone) return tp.icone(o);
    if (o.tipo === 'marcha') return RP.mapaTatico.iconeMarcha(o);
    if (o.tipo === 'local') return o.ruina ? 'escombros' : o.dono === 'livre' ? 'estaca' : RP.iconeLocal({ tipo: o.local });
    if (o.tipo === 'jazida') return o.recurso;
    if (o.tipo === 'ruina-antiga') return 'ruina';
    return 'interrogacao';
  }
  function donoTxt(o) {
    if (o.dono === 'meu') return 'Seu reino';
    if (o.dono === 'aliado') return 'Aliado';
    if (o.dono === 'livre' || o.ruina) return 'Sem dono';
    return 'Dono desconhecido';
  }
  function itemConteudo(o) {
    var cls = o.tipo === 'local' ? ' ' + RP.mapaTatico.classeDono(o.dono) : '';
    var sub = o.tipo === 'local' ? (RP.TIPOS_LOCAL[o.local] || '') + ' · ' + donoTxt(o) : o.tipo === 'jazida' ? Math.round((o.restante || 0) * 100) + '% restante' : '';
    return '<button type="button" class="conteudo" data-abrir-obj="' + o._k + '"><span class="ico-placa' + cls + '">' + RP.icone(iconeObjeto(o), o.tipo === 'jazida' ? 'r-' + o.recurso : '') + '</span>' +
      '<span><b>' + RP.esc(nomeObjeto(o)) + '</b>' + (sub ? '<small>' + RP.esc(sub) + '</small>' : '') + '</span>' + RP.icone('avancar', 'ico-p') + '</button>';
  }

  function folhaHex(h) {
    if (!M.dados || h < 0) return;
    if (alvoFundar) { folhaFundar(h); return; }
    var e = M.estado(h), t = M.terreno(h), d = M.dados, objs = M.objetosEm(h);
    var vivos = d.marchas.filter(function (m) { var p = M.posMarcha(m, RP.agora()); return p.hex === h && M.marchaVisivel(m, p); });
    if (e.v === 'desconhecido') {
      abrirFolhaMapa({
        titulo: 'Terra desconhecida', subtitulo: '<div class="linha">' + seloEstado(e) + coordTxt(h) + '</div>',
        icone: '<span class="ico-placa folha-ico">' + RP.icone('nevoa') + '</span>',
        corpo: '<p class="suave">Ninguém do seu reino passou por aqui. Terreno, recursos, animais e reinos só aparecem depois de explorados.</p>' +
          MAPA.extrasFolhaHex.map(function (f) { return f(h, d) || ''; }).join(''),
        acoes: MAPA.acoesFolhaHex.map(function (f) { return f(h, d) || ''; }).join('')
      }, h);
      return;
    }
    var corpo = notaAntiga(e) + '<div class="info">' + linhaInfo('Terreno', TERRENOS[t][1]) +
      (M.rio(h) ? linhaInfo('Rio', M.ponte(h) ? 'com ponte' : 'travessia pelo vau, mais lenta') : '') +
      (M.rota(h) ? linhaInfo('Rota', 'rua pública, mais rápida') : '') +
      objs.concat(vivos).map(function (o) { var tp = MAPA.tiposObjeto[o.tipo]; return tp && tp.folha ? tp.folha(o, d) || '' : ''; }).join('') +
      MAPA.extrasFolhaHex.map(function (f) { return f(h, d) || ''; }).join('') + '</div>' +
      (objs.length || vivos.length ? '<div class="secao-titulo">Neste hexágono</div><div class="lista-conteudo pilha">' + objs.concat(vivos).map(itemConteudo).join('') + '</div>' : '');
    var acoes = '';
    var livre = !objs.length && !M.rio(h);
    if (livre) acoes += '<a class="btn btn-p btn-primario" href="#/construcao?aba=novos">' + RP.icone('castelo') + 'Fundar local</a>';
    var meu = objs.filter(function (o) { return o.tipo === 'local' && o.dono === 'meu'; })[0];
    if (meu) acoes += '<button type="button" class="btn btn-p btn-primario" data-local="' + meu.id + '">' + RP.icone('info') + 'Detalhes</button>';
    objs.forEach(function (o) { var tp = MAPA.tiposObjeto[o.tipo]; if (tp && tp.acoes) acoes += tp.acoes(o, d) || ''; });
    acoes += MAPA.acoesFolhaHex.map(function (f) { return f(h, d) || ''; }).join('');
    abrirFolhaMapa({
      titulo: nomeTerreno(h), subtitulo: '<div class="linha">' + seloEstado(e) + coordTxt(h) + '</div>',
      icone: '<span class="ico-placa folha-ico terreno-ico t-' + t + '"></span>',
      corpo: corpo, acoes: acoes
    }, h);
  }

  function folhaObjeto(o) {
    var d = M.dados, h = o.hex;
    if (o.tipo === 'marcha') { folhaMarcha(o); return; }
    if (o.tipo === 'local' && o.dono === 'meu' && RP.local(o.id)) { RP.folhaLocal(o.id); return; }
    var e = M.estado(h), tp = MAPA.tiposObjeto[o.tipo], corpo = notaAntiga(e) + '<div class="info">', acoes = '';
    if (o.tipo === 'local') {
      corpo += linhaInfo('Tipo', RP.esc(RP.TIPOS_LOCAL[o.local] || o.local)) + linhaInfo('Dono', donoTxt(o)) + linhaInfo('Terreno', RP.esc(nomeTerreno(h)));
      if (o.dono !== 'livre' && !o.ruina) corpo += '</div><p class="nota-regra">' + RP.icone('olho', 'ico-p') + '<span>Explorar não revela o dono. Só a espionagem com batedores de elite mostra quem é.</span></p><div>';
      else corpo += '</div><p class="nota-regra">' + RP.icone('escombros', 'ico-p') + '<span>Ruínas e terra livre podem ser ocupadas ou reconstruídas.</span></p><div>';
    } else if (o.tipo === 'jazida') {
      corpo += linhaInfo('Recurso', RP.esc(RP.NOMES_REC[o.recurso] || o.recurso)) + linhaInfo('Restante', Math.round((o.restante || 0) * 100) + '%') +
        ((RP.config && RP.config.valor && RP.config.valor[o.recurso]) ? linhaInfo('Vale', RP.config.valor[o.recurso] + ' básicos cada') : '');
      corpo += '</div><p class="nota-regra">' + RP.icone('picareta', 'ico-p') + '<span>Nada é obrigatório: qualquer tropa pode coletar. Mais tropas, posto e rotas rendem mais.</span></p><div>';
    } else if (o.tipo === 'ruina-antiga') {
      corpo += linhaInfo('Relíquia', o.esgotada ? 'já escavada' : 'guarda uma relíquia de tipo desconhecido');
      corpo += '</div><p class="nota-regra">' + RP.icone('lendario', 'ico-p') + '<span>Uma unidade já escava. Mais tropas e um posto encurtam o tempo.</span></p><div>';
    } else if (tp && tp.folha) corpo += tp.folha(o, d) || '';
    else corpo += linhaInfo('Tipo', RP.esc(o.tipo));
    corpo += '</div>';
    if (tp && tp.acoes) acoes += tp.acoes(o, d) || '';
    acoes += '<button type="button" class="btn btn-p btn-fantasma" data-abrir-hex="' + h + '">' + RP.icone('hexagonos') + 'Hexágono</button>';
    abrirFolhaMapa({
      titulo: RP.esc(nomeObjeto(o)), subtitulo: '<div class="linha">' + seloEstado(e) + coordTxt(h) + '</div>',
      icone: '<span class="ico-placa folha-ico' + (o.tipo === 'local' ? ' ' + RP.mapaTatico.classeDono(o.dono) : '') + '">' + RP.icone(iconeObjeto(o), o.tipo === 'jazida' ? 'r-' + o.recurso : '') + '</span>',
      corpo: corpo, acoes: acoes
    }, h);
  }
  function folhaMarcha(o) {
    if (o.dono === 'meu') { folhaMarchaPropria(o); return; }
    var ag = RP.agora(), pos = M.posMarcha(o, ag), cheg = M.chegada(o), rev = RP.mapaTatico.revelada(o), def = MAPA.tiposMarcha[o.marcha] || {};
    var nome = def.nome || NOME_MARCHA[o.marcha] || 'Tropas';
    var titulo = rev ? nome : 'Forças desconhecidas';
    var corpo = '<div class="info">' + linhaInfo('Quem', o.dono === 'aliado' ? 'Aliado' : rev ? 'Identificado pelo estandarte' : 'Desconhecido · sem estandarte') +
      (o.tamanho ? linhaInfo('Tamanho', RP.esc(o.tamanho)) : '') +
      (cheg && fimConhecido(o) ? linhaInfo('Chegada', '<span data-fim="' + cheg + '">' + RP.fmtResta(cheg - ag) + '</span>') : '') +
      (o.caminho ? linhaInfo('Rumo', destinoTxt(o)) : '') + '</div>' +
      (rev ? '' : '<p class="nota-regra">' + RP.icone('estandarte', 'ico-p') + '<span>Ser atacado não revela o atacante. Só o estandarte ou a espionagem mostram quem é.</span></p>');
    abrirFolhaMapa({
      titulo: titulo, subtitulo: '<div class="linha">' + seloEstado(M.estado(pos.hex)) + coordTxt(pos.hex) + '</div>',
      icone: '<span class="ico-placa folha-ico marcha-ico ' + RP.mapaTatico.classeDono(o.dono) + (rev ? '' : ' hostil') + '">' + RP.icone(RP.mapaTatico.iconeMarcha(o)) + '</span>',
      corpo: corpo, acoes: ''
    }, pos.hex);
  }
  /* Marcha própria: sempre controlável pelo mapa, em qualquer ponto do caminho. Mostra o que é, destino, chegada e
     carga (o servidor manda carga/cargaMax/tropas/estado em GET /mapa; GET /tropas completa para exércitos), com
     até 3 ações: mandar para outro lugar, voltar ao castelo e parar aqui. Exploradores usam as ordens deles. */
  var ESTADO_MARCHA = { marchando: 'em marcha', parado: 'parada', retornando: 'voltando', trabalhando: 'trabalhando' };
  function ehExplorador(tipo) { return /explor|batedor|prospector/.test(String(tipo || '')); }
  function folhaMarchaPropria(o) {
    var ag = RP.agora(), pos = M.posMarcha(o, ag), cheg = M.chegada(o), def = MAPA.tiposMarcha[o.marcha] || {};
    var ex = o.marcha === 'exercito' ? RP.exercito(o.id) : null, d = ex || o;
    var nome = def.nome || NOME_MARCHA[o.marcha] || 'Sua marcha';
    var estado = d.estado || (cheg && cheg > ag ? 'marchando' : 'parado');
    var destino = d.alvo || (o.caminho && o.caminho.length ? nomeDestino(o.caminho[o.caminho.length - 1]) : null);
    var tropas = d.tropas && RP.somaGrupo(d.tropas) ? RP.selosGrupo(d.tropas) : (o.pessoas ? o.pessoas + ' pessoas' : (d.resumo ? RP.esc(d.resumo) : ''));
    var corpo = '<div class="info">' +
      (tropas ? linhaInfo('Quem', tropas) : '') +
      linhaInfo('Estado', (ESTADO_MARCHA[estado] || estado) + (d.ordem && d.ordem !== 'mover' && d.ordem !== 'retornar' && RP.ORDENS_NOMES && RP.ORDENS_NOMES[d.ordem] ? ' · ' + RP.esc(RP.ORDENS_NOMES[d.ordem].toLowerCase()) : '')) +
      (destino ? linhaInfo(estado === 'retornando' ? 'Volta para' : 'Destino', RP.esc(destino)) : '') +
      (cheg && cheg > ag ? linhaInfo(estado === 'retornando' ? 'Chega em casa' : 'Chegada', '<b class="num" data-fim="' + cheg + '">' + RP.fmtResta(cheg - ag) + '</b>') : '') +
      (d.trabalho ? linhaInfo(d.trabalho.tipo === 'caca' ? 'Caçando' : d.trabalho.tipo === 'escavacao' ? 'Escavando' : 'Extraindo', (d.trabalho.coletado && RP.cargaUsada(d.trabalho.coletado) ? 'já juntou ' + RP.esc(RP.cargaTexto(d.trabalho.coletado)) : 'começando') + (d.trabalho.destino ? ' · leva para ' + RP.esc(d.trabalho.destino) : '')) : '') +
      '</div>' +
      (d.cargaMax != null || (d.carga && RP.cargaUsada(d.carga)) ? '<div style="margin-top:var(--esp-3)">' + RP.cargaHTML(d.carga, d.cargaMax) + '</div>' : '') +
      (d.bloqueio ? '<p class="nota-antiga nota-perigo" style="margin-top:var(--esp-3)">' + RP.icone('alerta', 'ico-p') + RP.esc(d.bloqueio) + '</p>' : '');
    var acoes = '';
    if (ehExplorador(o.marcha)) {
      acoes = '<a class="btn btn-p btn-primario" href="#/exploradores?ativo=' + o.id + '">' + RP.icone('seta') + 'Novo destino</a>' +
        (estado !== 'retornando' ? '<button type="button" class="btn btn-p" data-marcha-voltar-exp="' + o.id + '">' + RP.icone('voltar') + 'Voltar ao castelo</button>' : '');
    } else if (o.marcha === 'exercito' || ex) {
      var pode = !d.bloqueio && d.podeOrdem !== false;
      acoes = (pode ? '<button type="button" class="btn btn-p btn-primario" data-exercito-mover="' + o.id + '">' + RP.icone('seta') + 'Novo destino</button>' : '') +
        (pode && estado !== 'retornando' ? '<button type="button" class="btn btn-p" data-exercito-voltar="' + o.id + '">' + RP.icone('voltar') + 'Voltar ao castelo</button>' : '') +
        (pode && estado !== 'parado' ? '<button type="button" class="btn btn-p" data-exercito-parar="' + o.id + '" data-hex="' + pos.hex + '">' + RP.icone('alvo') + 'Parar aqui</button>' : '') +
        (!pode && d.bloqueio && RP.telas.batalha ? '<a class="btn btn-p btn-perigo" href="#/tropas">' + RP.icone('escudo') + 'Recuar</a>' : '') +
        '<button type="button" class="btn btn-p" data-exercito="' + o.id + '">' + RP.icone('info') + 'Detalhes</button>' +
        '<a class="btn btn-p" href="#/posturas?marcha=' + o.id + '">' + RP.icone('escudo') + 'Comportamento</a>';
    } else if (o.marcha === 'caravana' && RP.telas.caravana) {
      acoes = '<a class="btn btn-p" href="#/caravana">' + RP.icone('carroca') + 'Caravanas</a>';
    }
    abrirFolhaMapa({
      titulo: RP.esc(nome), subtitulo: '<div class="linha"><span class="selo selo-visivel">' + RP.icone('olho') + 'Sua tropa</span>' + coordTxt(pos.hex) + '</div>',
      icone: '<span class="ico-placa folha-ico marcha-ico dono-meu">' + RP.icone(RP.mapaTatico.iconeMarcha(o)) + '</span>',
      corpo: corpo, acoes: acoes
    }, pos.hex);
    /* exércitos: completa com GET /tropas (carga, bloqueio) se ainda não veio */
    if (o.marcha === 'exercito' && !ex) RP.carregarTropas().then(function () { if (RP.folhaAberta() && RP.exercito(o.id)) folhaMarchaPropria(o); }, function () { /* offline */ });
  }
  function nomeDestino(h) {
    var l = RP.reino && (RP.reino.locais || []).filter(function (x) { return x.hex === h; })[0];
    if (l) return l.nome;
    var o = M.objetosEm(h).filter(function (x) { return x.tipo === 'local'; })[0];
    return o ? (o.nome || RP.TIPOS_LOCAL[o.local] || 'local') + ' (' + H.c(h) + ', ' + H.l(h) + ')' : 'hexágono ' + H.c(h) + ', ' + H.l(h);
  }
  document.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-exercito-parar]'))) {
      var id = +b.getAttribute('data-exercito-parar'), hx = +b.getAttribute('data-hex');
      RP.tentar(RP.post('/tropas/' + id + '/ordem', { ordem: 'mover', destinoHex: hx })).then(function () {
        RP.fecharFolha(); RP.aviso({ titulo: 'Tropas param aqui', texto: 'Ficam no lugar e atacam só quem atacar.', icone: 'alvo', tipo: 'sucesso' });
        M.carregar().catch(function () { /* offline */ }); RP.recarregarTropas();
      });
    } else if ((b = e.target.closest('[data-marcha-voltar-exp]'))) {
      RP.tentar(RP.post('/exploradores/' + b.getAttribute('data-marcha-voltar-exp') + '/ordem', { ordem: 'retornar' })).then(function () {
        RP.fecharFolha(); RP.aviso({ titulo: 'Explorador voltando', icone: 'voltar', tipo: 'sucesso' });
        M.carregar().catch(function () { /* offline */ }); if (RP.exploracao && RP.exploracao.carregar) RP.exploracao.carregar();
      });
    }
  });
  /* de marcha alheia, o servidor manda só o trecho à vista: o fim dos tempos é a chegada só quando ela vem a um local seu */
  function fimConhecido(o) { return o.dono === 'meu' || o.dono === 'aliado' || !!o.paraMim; }
  function destinoTxt(o) {
    var fim = o.caminho[o.caminho.length - 1], l = RP.reino && (RP.reino.locais || []).filter(function (x) { return x.hex === fim; })[0];
    return l ? RP.esc(l.nome) + ' (seu)' : 'incerto';
  }

  /* ---------------------------------------------------------------- fundar pelo mapa */
  function atualizarFaixaFundar() {
    var f = tela && RP.$('.mapa-faixa', tela);
    if (!f) return;
    f.hidden = !alvoFundar;
    if (alvoFundar) f.innerHTML = RP.icone('alvo', 'ico-p') + '<span>Toque num hexágono destacado para fundar: <b>' + RP.esc((RP.NOMES_FUNDAR || {})[alvoFundar] || alvoFundar) + '</b></span>' +
      '<button type="button" class="btn btn-p" data-cancelar-fundar>Cancelar</button>';
    tela.classList.toggle('em-fundar', !!alvoFundar);
    if (tat) tat.definirFundar(alvoFundar);
  }
  function folhaFundar(h) {
    var r = RP.reino, tipo = alvoFundar, nome = (RP.NOMES_FUNDAR || {})[tipo] || tipo, e = M.estado(h);
    var corpo = '<div class="info">' + linhaInfo('Terreno', RP.esc(nomeTerreno(h))) +
      (r && r.custos ? linhaInfo('Custo', RP.custoHTML(r.custos.novoLocal)) + linhaInfo('Tempo da obra', RP.fmtDuracao(r.custos.novoLocalSeg)) : '') + '</div>' +
      '<p class="nota-regra">' + RP.icone('carroca', 'ico-p') + '<span>A obra entra na fila e só começa quando o material chega. Os carregadores vão a pé, sem escolta.</span></p>' +
      '<p class="nota-antiga nota-perigo" data-motivo hidden></p>';
    abrirFolhaMapa({
      titulo: 'Fundar ' + RP.esc(nome.toLowerCase()) + ' aqui?', subtitulo: '<div class="linha">' + seloEstado(e) + coordTxt(h) + '</div>',
      icone: '<span class="ico-placa folha-ico">' + RP.icone('castelo') + '</span>',
      corpo: corpo,
      acoes: '<button type="button" class="btn btn-p btn-primario" data-fundar-aqui="' + h + '">' + RP.icone('martelo') + 'Fundar aqui</button>' +
        '<button type="button" class="btn btn-p btn-fantasma" data-fechar-fundar>' + RP.icone('alvo') + 'Outro lugar</button>'
    }, h);
    RP.get('/fundar/motivo?tipo=' + encodeURIComponent(tipo) + '&hex=' + h).then(function (x) {
      var nota = RP.$('[data-motivo]'), bt = RP.$('[data-fundar-aqui="' + h + '"]');
      if (!x || !x.motivo || !nota) return;
      nota.hidden = false; nota.innerHTML = RP.icone('alerta', 'ico-p') + RP.esc(x.motivo);
      if (bt) bt.classList.add('btn-inativo');
    }).catch(function () { /* sem rede: o servidor confirma ao fundar */ });
  }
  document.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-fundar-aqui]'))) {
      if (b.classList.contains('btn-inativo')) { var n = RP.$('[data-motivo]'); RP.aviso({ titulo: n ? n.textContent : 'Não dá para fundar aqui.', icone: 'alerta', tipo: 'alerta' }); return; }
      var h = +b.getAttribute('data-fundar-aqui'), tipo = alvoFundar;
      RP.tentar(RP.post('/obras', { acao: 'fundar', tipo: tipo, hex: h })).then(function (it) {
        RP.fecharFolha(); alvoFundar = null; atualizarFaixaFundar();
        RP.aviso({ titulo: 'Na fila: ' + it.rotulo, texto: 'Os carregadores levam o material até lá.', icone: 'castelo', tipo: 'sucesso' });
        RP.recarregarReino(); M.carregar().catch(function () { /* aviso já mostrado */ });
      }).catch(function () { /* aviso já mostrado */ });
    } else if (e.target.closest('[data-fechar-fundar]')) RP.fecharFolha();
    else if ((b = e.target.closest('[data-abrir-obj]')) && ativa() && M.dados) {
      var o = M.dados.objetos[+b.getAttribute('data-abrir-obj')];
      if (o) folhaObjeto(o);
    } else if ((b = e.target.closest('[data-abrir-hex]')) && ativa()) folhaHex(+b.getAttribute('data-abrir-hex'));
  });

  function aoTocar(alvo) {
    var hh = alvo.hex != null ? alvo.hex : (alvo.obj && alvo.obj.hex);
    if (alvoFundar) { if (hh != null && hh >= 0) folhaFundar(hh); return; }
    /* escolhendo destino de tropas: o toque escolhe o hexágono (a folha dele traz as ordens), nunca abre o painel do local */
    if (RP.envio && RP.envio.ativo()) { if (hh != null && hh >= 0) folhaHex(hh); return; }
    if (alvo.obj) folhaObjeto(alvo.obj);
    else if (alvo.hex != null && alvo.hex >= 0) folhaHex(alvo.hex);
  }

  /* ---------------------------------------------------------------- faixas de ameaça */
  function atualizarFaixas() {
    var box = tela && RP.$('.mapa-faixas', tela), d = M.dados;
    if (!box || !d) return;
    var ag = RP.agora();
    var hostis = d.marchas.filter(function (m) { var p = M.posMarcha(m, ag); return !RP.mapaTatico.revelada(m) && M.chegada(m) > ag && M.marchaVisivel(m, p); });
    var faixas = hostis.map(function (m) {
      return '<button type="button" class="faixa-alerta" data-faixa-marcha="' + m._k + '">' + RP.icone('alerta', 'pulso') +
        '<span class="txt"><b>Forças desconhecidas</b> → ' + destinoTxt(m) + '<br>' + (fimConhecido(m) ? 'chegada em <b class="num" data-fim="' + M.chegada(m) + '">' + RP.fmtResta(M.chegada(m) - ag) + '</b>' : 'em movimento à vista') + '</span>' + RP.icone('avancar', 'ico-p') + '</button>';
    });
    box.innerHTML = faixas.slice(0, 2).join('') + (faixas.length > 2
      ? '<div class="faixas-extra" id="faixas-extra" hidden>' + faixas.slice(2).join('') + '</div><button type="button" class="faixa-mais" data-faixas-mais aria-expanded="false" aria-controls="faixas-extra">' +
        RP.icone('alerta', 'ico-p') + '<span>+' + (faixas.length - 2) + (faixas.length - 2 > 1 ? ' alertas' : ' alerta') + '</span></button>' : '');
  }

  /* ---------------------------------------------------------------- camadas e legenda */
  function abrirCamadas() {
    var cam = MAPA.camadas, d = M.dados;
    var temFauna = !!MAPA.perigoHex || !!(d && d.objs.some(function (o) { return o.tipo === 'fauna'; }));
    var tog = function (k, rot, ic) { return '<button type="button" class="alternar" data-camada="' + k + '" aria-pressed="' + (cam[k] !== false && (k !== 'perigo' || cam.perigo)) + '">' + RP.icone(ic) + '<span>' + rot + '</span><i aria-hidden="true"></i></button>'; };
    var terr = Object.keys(TERRENOS).map(function (t) { return '<div class="legenda-item"><span class="amostra-hex t-' + t + '"></span><span><b>' + TERRENOS[t][0] + '</b><small>' + TERRENOS[t][1] + '</small></span></div>'; }).join('') +
      '<div class="legenda-item"><span class="amostra-hex t-rio"></span><span><b>Rio</b><small>Exige ponte ou vau. Sem ponte, a travessia é mais lenta.</small></span></div>';
    RP.abrirFolha({
      titulo: 'Camadas e legenda', veu: true,
      corpo: '<div class="alternar-grade">' + (MAPA.perigoHex ? tog('perigo', 'Perigo', 'pata') : '') + (temFauna ? tog('fauna', 'Animais', 'lobo') : '') +
        tog('rotas', 'Rotas', 'rota') + tog('marchas', 'Marchas', 'tropas') + tog('recursos', 'Jazidas', 'ouro') + tog('bandeiras', 'Bandeiras', 'bandeira') + tog('rotulos', 'Nomes', 'info') + '</div>' +
        (MAPA.perigoHex ? '<p class="fraco legenda-nota">A camada Perigo pinta as áreas conhecidas com fauna hostil, para escolher entre rota curta e perigosa ou longa e segura. Vale no Mapa; na Vista os animais aparecem desenhados.</p>' : '') +
        '<div class="secao-titulo">Névoa</div>' +
        '<div class="legenda-item"><span class="amostra-hex t-planicie"></span><span><b>Visível</b><small>Dentro da visão de locais, tropas e exploradores. Tudo ao vivo.</small></span></div>' +
        '<div class="legenda-item"><span class="amostra-hex nevoa-exp t-planicie"></span><span><b>Explorado</b><small>Mostra o último estado conhecido e há quanto tempo foi visto.</small></span></div>' +
        '<div class="legenda-item"><span class="amostra-hex nevoa-desc"></span><span><b>Desconhecido</b><small>Nunca visto. Envie exploradores.</small></span></div>' +
        (MAPA.perigoHex ? '<div class="secao-titulo">Perigo</div>' +
          '<div class="legenda-item"><span class="amostra-hex pg-amostra pg-baixo t-planicie"></span><span><b>Baixo</b><small>Animais fracos ou área cortada por rota.</small></span></div>' +
          '<div class="legenda-item"><span class="amostra-hex pg-amostra pg-medio t-planicie"></span><span><b>Médio</b></span></div>' +
          '<div class="legenda-item"><span class="amostra-hex pg-amostra pg-alto t-planicie"></span><span><b>Alto</b><small>Evite com exploradores sozinhos e grupos pequenos.</small></span></div>' : '') +
        '<div class="secao-titulo">Terrenos</div>' + terr +
        '<div class="secao-titulo">Donos</div>' +
        '<div class="legenda-item"><span class="ponto-dono dono-meu"></span><span><b>Seu reino</b></span></div>' +
        '<div class="legenda-item"><span class="ponto-dono dono-desconhecido"></span><span><b>Dono desconhecido</b><small>Locais de outros reinos e forças sem estandarte. Explorar não revela o dono.</small></span></div>' +
        '<div class="legenda-item"><span class="ponto-dono dono-aliado"></span><span><b>Aliado</b><small>Membros da sua aliança se reconhecem.</small></span></div>' +
        '<div class="legenda-item"><span class="ico-placa">' + RP.icone('escombros') + '</span><span><b>Ruína / terra livre</b><small>Sem dono. Podem ser ocupadas e reconstruídas.</small></span></div>' +
        MAPA.legendaExtras.map(function (f) { return f() || ''; }).join('')
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-camada]');
    if (!b) return;
    var k = b.getAttribute('data-camada'), cam = MAPA.camadas;
    cam[k] = k === 'perigo' ? !cam.perigo : cam[k] === false;
    b.setAttribute('aria-pressed', String(k === 'perigo' ? cam.perigo : cam[k] !== false));
    if (tat) { tat.ci = null; tat.atualizarSvg(); tat.pedirQuadro(); }
  });

  /* ---------------------------------------------------------------- minimapa */
  function desenharMinimapa() {
    var d = M.dados; if (!mm || !d) return;
    var box = mm.parentNode, w = box.clientWidth;
    if (!w) return;
    var h = Math.round(w * H.ALTURA / H.LARGURA);
    if (box.style.height !== h + 'px') box.style.height = h + 'px';
    var dpr = Math.min(2, window.devicePixelRatio || 1), tk = RP.mapaTatico.tokens();
    mm.width = Math.round(w * dpr); mm.height = Math.round(h * dpr);
    mmEscala = w / H.LARGURA;
    var c = mmCtx; c.setTransform(dpr * mmEscala, 0, 0, dpr * mmEscala, 0, 0);
    c.fillStyle = tk.nevoa[0]; c.fillRect(0, 0, H.LARGURA, H.ALTURA);
    var n = H.COLS * H.LINS, i, p, e;
    for (i = 0; i < n; i++) {
      if (!d.ter[i]) continue;
      p = H.centroH(i); e = d.idade[i];
      c.fillStyle = d.rio[i] ? tk.rioAgua : tk.t[d.ter[i]][0];
      c.fillRect(p.x - H.W / 2 - 1, p.y - H.R * 0.8, H.W + 2, H.R * 1.6);
      if (e > 0) { c.fillStyle = tk.veu; c.fillRect(p.x - H.W / 2 - 1, p.y - H.R * 0.8, H.W + 2, H.R * 1.6); }
    }
    var Cs = A.cores();
    d.objs.forEach(function (o) {
      if (o.tipo !== 'local' || M.estado(o.hex).v === 'desconhecido') return;
      p = H.centroH(o.hex);
      c.fillStyle = o.dono === 'meu' ? Cs.meu : o.dono === 'aliado' ? Cs.aliado : Cs.desconhecido;
      c.beginPath(); c.arc(p.x, p.y, o.local === 'castelo' ? 34 : 20, 0, 6.2832); c.fill();
    });
    mmVersao = M.versao;
    desenharVistaMinimapa();
  }
  function desenharVistaMinimapa() {
    if (!mmVista || !mm) return;
    var r = visao().retanguloMundo(), mw = mm.clientWidth, mh = mm.clientHeight;
    var x0 = Math.max(0, r.x * mmEscala), y0 = Math.max(0, r.y * mmEscala), x1 = Math.min(mw, (r.x + r.w) * mmEscala), y1 = Math.min(mh, (r.y + r.h) * mmEscala);
    mmVista.style.transform = 'translate(' + x0.toFixed(1) + 'px,' + y0.toFixed(1) + 'px)';
    mmVista.style.width = Math.max(6, x1 - x0).toFixed(1) + 'px';
    mmVista.style.height = Math.max(6, y1 - y0).toFixed(1) + 'px';
  }
  function pedirMinimapa() {
    if (rafMm) return;
    rafMm = requestAnimationFrame(function () { rafMm = 0; if (mmVersao !== M.versao) desenharMinimapa(); else desenharVistaMinimapa(); });
  }
  function gestosMinimapa(box) {
    var arrastando = false;
    function ir(e) {
      var r = mm.getBoundingClientRect(), wx = (e.clientX - r.left) / mmEscala, wy = (e.clientY - r.top) / mmEscala;
      visao().centrar(wx, wy, null, 0.5, false);
      pedirMinimapa();
    }
    box.addEventListener('pointerdown', function (e) { arrastando = true; try { box.setPointerCapture(e.pointerId); } catch (x) { /* ignora */ } ir(e); });
    box.addEventListener('pointermove', function (e) { if (arrastando) ir(e); });
    box.addEventListener('pointerup', function () { arrastando = false; });
    box.addEventListener('pointercancel', function () { arrastando = false; });
  }

  /* ---------------------------------------------------------------- montagem */
  function montar(el) {
    tela = el;
    el.innerHTML =
      '<canvas class="cena-cv" aria-label="Vista do mundo. Arraste para mover, use dois dedos ou os botões para zoom. Toque em construções, tropas e hexágonos."></canvas>' +
      '<div class="mapa-vp" role="application" aria-label="Mapa tático. Arraste para mover, use dois dedos ou os botões para zoom. Toque num hexágono para detalhes."></div>' +
      '<div class="mapa-topo">' + RP.barraRecursos() + '<div class="mapa-faixas"></div><div class="mapa-faixa card" role="status" hidden></div></div>' +
      '<div class="mapa-controles" role="toolbar" aria-label="Controles do mapa">' +
      '<button type="button" class="btn btn-icone" data-zoom="1.5" aria-label="Aproximar">' + RP.icone('mais') + '</button>' +
      '<button type="button" class="btn btn-icone" data-zoom="0.6667" aria-label="Afastar">' + RP.icone('menos') + '</button>' +
      '<button type="button" class="btn btn-icone" data-centrar-castelo aria-label="Centralizar no castelo">' + RP.icone('alvo') + '</button>' +
      '<button type="button" class="btn btn-icone" data-inclinar aria-label="Inclinação da câmera: toque para voltar ao padrão. Arraste com o botão do meio ou com dois dedos para inclinar." title="Inclinação: botão do meio ou dois dedos; toque para voltar ao padrão">' + RP.icone('vista') + '</button>' +
      '<button type="button" class="btn btn-icone" data-camadas aria-label="Camadas e legenda">' + RP.icone('camadas') + '</button></div>' +
      '<div class="modo-mapa abas" role="group" aria-label="Tipo de visão">' +
      '<button type="button" class="aba" data-modo-btn="cena" aria-pressed="true">' + RP.icone('vista') + 'Vista</button>' +
      '<button type="button" class="aba" data-modo-btn="tatico" aria-pressed="false">' + RP.icone('hexagonos') + 'Mapa</button></div>' +
      '<div class="minimapa" role="group" aria-label="Minimapa: toque para ir até um ponto"><canvas></canvas><div class="mm-vista"></div></div>';
    mm = RP.$('.minimapa canvas', el); mmCtx = mm.getContext('2d'); mmVista = RP.$('.mm-vista', el);
    cena = new RP.Cena(RP.$('.cena-cv', el), {
      interativa: true, camadas: MAPA.camadas,
      selecao: function () { return selecao; },
      escolhendoHex: function () { return !!alvoFundar || !!(RP.envio && RP.envio.ativo()); },
      aoTocar: aoTocar, aoMover: pedirMinimapa,
      aoAfastarDemais: function () {
        definirModo('tatico', { s: 0.75 });
        RP.aviso({ titulo: 'Mapa tático', texto: 'Afastou além da Vista. Aproxime ou toque em Vista para voltar.', icone: 'hexagonos', ms: 2200 });
      }
    });
    tat = new RP.Tatico(RP.$('.mapa-vp', el), {
      aoTocar: aoTocar, aoMover: pedirMinimapa,
      aoAproximarDemais: function () { definirModo('cena', { s: 1.4 }); }
    });
    gestosMinimapa(RP.$('.minimapa', el));
    tela.setAttribute('data-modo', 'cena');

    el.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-faixas-mais]'))) {
        var ab = b.getAttribute('aria-expanded') !== 'true', ex = RP.$('#faixas-extra', el);
        b.setAttribute('aria-expanded', String(ab)); ex.hidden = !ab;
        b.querySelector('span').textContent = ab ? 'Menos alertas' : '+' + ex.children.length + (ex.children.length > 1 ? ' alertas' : ' alerta');
      } else if ((b = e.target.closest('[data-faixa-marcha]'))) {
        var m = M.dados && M.dados.objetos[+b.getAttribute('data-faixa-marcha')];
        if (m) { folhaMarcha(m); var p = M.posMarcha(m, RP.agora()); visao().centrar(p.x, p.y, null, 0.3); }
      } else if ((b = e.target.closest('[data-zoom]'))) visao().zoomBotao(+b.getAttribute('data-zoom'));
      else if (e.target.closest('[data-centrar-castelo]')) irCastelo(true);
      else if (e.target.closest('[data-inclinar]')) {
        if (modo !== 'cena') { definirModo('cena'); return; }
        var padrao = cena.inclinar(null);
        RP.aviso({ titulo: padrao ? 'Câmera no padrão' : 'Inclinação', texto: 'Arraste com o botão do meio ou com dois dedos para inclinar.', icone: 'vista', ms: 2200 });
      }
      else if (e.target.closest('[data-camadas]')) abrirCamadas();
      else if ((b = e.target.closest('[data-modo-btn]'))) { var md = b.getAttribute('data-modo-btn'); if (md !== modo) definirModo(md); }
      else if (e.target.closest('[data-cancelar-fundar]')) { alvoFundar = null; atualizarFaixaFundar(); RP.fecharFolha(); }
    });
  }
  /* escutas globais uma vez só: a tela é montada de novo depois de sair da conta */
  window.addEventListener('resize', function () {
    if (!ativa()) return;
    if (modo === 'cena') cena.redimensionar(); else { tat.redimensionar(); tat.pedirQuadro(); }
    desenharMinimapa();
  });
  document.addEventListener('rp:mapa-dados', function () {
    if (!ativa()) return;
    cena.invalidar(); tat.invalidar(); desenharMinimapa(); atualizarFaixas();
  });
  document.addEventListener('rp:reino', function () { if (ativa() && modo === 'tatico') tat.atualizarSvg(); });
  document.addEventListener('rp:tique', function () { if (ativa() && M.dados && RP.agora() % 10000 < 1000) atualizarFaixas(); });

  /* O mundo é a tela de fundo: montado uma vez, nunca escondido enquanto há reino (os painéis ficam por cima).
     `entrar` roda na montagem e a cada #/mapa (foco, centro, fundar, modo); `sair` só ao sair da conta. */
  RP.registrarTela('mapa', {
    nav: true, fixa: true, fundo: true,
    montar: montar,
    entrar: function (el, p) {
      M.ativar('mapa');
      alvoFundar = p.get('fundar') || null;
      atualizarFaixaFundar();
      var pedido = p.get('modo') || (alvoFundar ? 'tatico' : RP.pref('modo-mapa')) || 'cena';
      if (pedido !== 'cena' && pedido !== 'tatico') pedido = 'cena';
      M.emDia().then(function () {
        if (!ativa()) return;
        var foco = p.get('foco'), centro = p.get('centro'), alvo = foco !== null && foco !== '' ? +foco : centro !== null && centro !== '' ? +centro : null;
        var c = RP.castelo(), pc = alvo != null && alvo >= 0 ? H.centroH(alvo) : c ? H.centroH(c.hex) : { x: H.LARGURA / 2, y: H.ALTURA / 2 };
        if (!posicionado || alvo != null || p.get('modo')) {
          if (!posicionado) { cena.cam.s = 1.7; tat.cam.s = 0.75; cena.invalidar(); tat.invalidar(); }
          if (pedido !== modo) visao().parar();
          modo = pedido;
          definirModo(pedido, { x: pc.x, y: pc.y, s: posicionado ? null : (pedido === 'cena' ? 1.7 : 0.75) });
          posicionado = true;
        } else definirModo(modo);
        desenharMinimapa(); atualizarFaixas();
        if (alvo != null && alvo >= 0 && foco !== null && foco !== '') {
          var o = M.objetosEm(alvo).filter(function (x) { return x.tipo === 'local'; })[0];
          if (o) folhaObjeto(o); else folhaHex(alvo);
          centrarHex(alvo, false);
        }
      }).catch(function () { /* aviso já mostrado */ });
    },
    sair: function () {
      M.desativar('mapa');
      selecionar(null); if (tela) tela.classList.remove('com-folha');
      if (cena) cena.parar();
      if (tat) tat.parar();
      posicionado = false;
    }
  });
  /* ao voltar a #/mapa sem parâmetros, a câmera fica onde estava; a folha aberta fecha com a troca de rota */
  document.addEventListener('rp:tela', function (ev) { if (ev.detail !== 'mapa' && tela) { selecionar(null); tela.classList.remove('com-folha'); } });

  /* ---------------------------------------------------------------- API pública */
  MAPA.recarregar = function () { return M.carregar(); };
  MAPA.desenhar = function () {
    if (!ativa()) return;
    if (modo === 'cena') cena.invalidar(); else { tat.ci = null; tat.atualizarSvg(); tat.quadro(); }
  };
  MAPA.folhaHex = folhaHex;
  MAPA.folhaObjeto = folhaObjeto;
  MAPA.centrar = function (h, animar) { if (ativa()) centrarHex(h, animar); };
  MAPA.modo = function () { return modo; };
  /* a visão ativa (RP.Cena ou RP.Tatico): centro(), centrar(x, y, s), retanguloMundo() */
  MAPA.visao = function () { return visao(); };
  MAPA.selecao = function () { return selecao; };
})();
