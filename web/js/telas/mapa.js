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
  ['carregadores:Carregadores', 'pessoas:Pessoas', 'mensageiro:Mensageiro', 'caravana:Caravana', 'exercito:Exército'].forEach(function (x) { var p = x.split(':'); if (!NOME_MARCHA[p[0]]) NOME_MARCHA[p[0]] = p[1]; });

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
    var p = H.centroH(h);
    if (modo === 'cena') cena.centrar(p.x, p.y, Math.max(cena.cam.s, 1.8), 0.5, animar);
    else tat.centrar(p.x, p.y, Math.max(tat.cam.s, 0.9), 0.5, animar);
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
  /* construções, marchas e bandeiras são públicas: "nunca explorado" só faz sentido para o chão */
  function seloObjeto(e) { return e.nunca ? '' : seloEstado(e); }
  function seloEstado(e) {
    if (e.v === 'visivel') return '<span class="selo selo-visivel">' + RP.icone('olho') + 'Visível agora</span>';
    if (e.nunca) return '<span class="selo selo-desconhecido">' + RP.icone('nevoa') + 'Nunca explorado</span>';
    if (e.v === 'explorado') return '<span class="selo selo-antigo">' + RP.icone('relogio') + 'Visto ' + RP.fmtHa(e.horas) + '</span>';
    return '<span class="selo selo-desconhecido">' + RP.icone('nevoa') + 'Desconhecido</span>';
  }
  function coordTxt(h) { return '<span class="fraco num">' + H.c(h) + ' · ' + H.l(h) + '</span>'; }
  function linhaInfo(r, v) { return '<div class="info-linha"><span class="fraco">' + r + '</span><span>' + v + '</span></div>'; }
  function notaAntiga(e) { return e.v === 'explorado' && !e.nunca ? '<p class="nota-antiga">' + RP.icone('relogio', 'ico-p') + 'Último estado conhecido, ' + RP.fmtHa(e.horas) + '. Pode ter mudado.</p>' : ''; }
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
    if (o.tipo === 'marcha') return (MAPA.tiposMarcha[o.marcha] || {}).nome || NOME_MARCHA[o.marcha] || 'Marcha';
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
    return o.reino ? o.reino.nome : 'Outro reino';
  }
  function itemConteudo(o) {
    var cls = o.tipo === 'local' ? ' ' + RP.mapaTatico.classeDono(o.dono) : '';
    var sub = o.tipo === 'local' ? (RP.TIPOS_LOCAL[o.local] || '') + ' · ' + donoTxt(o) : o.tipo === 'jazida' ? Math.round((o.restante || 0) * 100) + '% restante' : '';
    return '<button type="button" class="conteudo" data-abrir-obj="' + o._k + '"><span class="ico-placa' + cls + '">' + RP.icone(iconeObjeto(o), o.tipo === 'jazida' ? 'r-' + o.recurso : '') + '</span>' +
      '<span><b>' + RP.esc(nomeObjeto(o)) + '</b>' + (sub ? '<small>' + RP.esc(sub) + '</small>' : '') + '</span>' + RP.icone('avancar', 'ico-p') + '</button>';
  }

  /* As folhas do mapa são montadas (montarHex, montarObjeto, montarMarcha...) separadas de abrir: o mesmo objeto
     { titulo, corpo, acoes } vale para a folha na base da tela e para o menu de contexto do botão direito. */
  function folhaHex(h) {
    if (!M.dados || h < 0) return;
    if (alvoFundar) { folhaFundar(h); return; }
    abrirFolhaMapa(montarHex(h), h);
  }
  function montarHex(h) {
    var e = M.estado(h), t = M.terreno(h), d = M.dados, objs = M.objetosEm(h), emEnvio = RP.envio && RP.envio.ativo();
    /* a tropa selecionada escolheu este hexágono sem pedir: fechar a folha desfaz */
    function fechou(troca) { if (!troca && RP.envio && RP.envio.implicito()) RP.envio.cancelar(); }
    var vivos = d.marchas.filter(function (m) { var p = M.posMarcha(m, RP.agora()); return p.hex === h && M.marchaVisivel(m, p); });
    if (e.v === 'desconhecido') return { titulo: 'Fora do mapa', corpo: '', acoes: '', aoFechar: fechou };
    var corpo = notaAntiga(e) + (e.nunca ? '<p class="suave">Ninguém do seu reino passou por aqui: a riqueza do chão e os animais só aparecem depois de explorados.</p>' : '') + '<div class="info">' + linhaInfo('Terreno', TERRENOS[t][1]) +
      (M.rio(h) ? linhaInfo('Rio', M.ponte(h) ? 'com ponte' : 'travessia pelo vau, mais lenta') : '') +
      (M.rota(h) ? linhaInfo('Rota', 'rua pública, mais rápida') : '') +
      objs.concat(vivos).map(function (o) { var tp = MAPA.tiposObjeto[o.tipo]; return tp && tp.folha ? tp.folha(o, d) || '' : ''; }).join('') +
      MAPA.extrasFolhaHex.map(function (f) { return f(h, d) || ''; }).join('') + '</div>' +
      (objs.length || vivos.length ? '<div class="secao-titulo">Neste hexágono</div><div class="lista-conteudo pilha">' + objs.concat(vivos).map(itemConteudo).join('') + '</div>' : '');
    var acoes = '';
    var livre = !objs.length && !M.rio(h) && !e.nunca;
    /* escolhendo destino, as ações são as ordens da tropa */
    if (livre && !emEnvio) acoes += '<a class="btn btn-p btn-primario" href="#/construcao?aba=novos" data-tecla="B">' + RP.icone('castelo') + 'Fundar local</a>';
    var meu = objs.filter(function (o) { return o.tipo === 'local' && o.dono === 'meu'; })[0];
    if (meu && !emEnvio) acoes += '<button type="button" class="btn btn-p btn-primario" data-local="' + meu.id + '" data-tecla="I">' + RP.icone('info') + 'Detalhes</button>';
    if (!emEnvio) objs.forEach(function (o) { var tp = MAPA.tiposObjeto[o.tipo]; if (tp && tp.acoes) acoes += tp.acoes(o, d) || ''; });
    acoes += MAPA.acoesFolhaHex.map(function (f) { return f(h, d) || ''; }).join('');
    return {
      titulo: nomeTerreno(h), subtitulo: '<div class="linha">' + seloEstado(e) + coordTxt(h) + '</div>',
      icone: '<span class="ico-placa folha-ico terreno-ico t-' + t + '"></span>',
      corpo: corpo, acoes: acoes, aoFechar: fechou
    };
  }

  function folhaObjeto(o) {
    if (o.tipo === 'marcha') { folhaMarcha(o); return; }
    var tl = MAPA.tiposObjeto[o.tipo], link = tl && tl.link && tl.link(o);
    if (link) { RP.ir(link); return; }   /* a batalha abre a tela dela, sem folha no meio */
    if (o.tipo === 'local' && o.dono === 'meu' && RP.local(o.id)) { RP.folhaLocal(o.id); return; }
    abrirFolhaMapa(montarObjeto(o), o.hex);
  }
  /* o que atacar um local de outro reino pode render: o recurso que ele produz (ou guarda), relíquia e o próprio local.
     Quanto há guardado não sai daqui. */
  var PRODUZ_TIPO = { vila: ['comida'], pasto: ['comida'], serraria: ['madeira'], mina: ['ferro', 'pedra'] };
  function ganhosLocal(o) {
    var rec = o.produz ? [o.produz] : PRODUZ_TIPO[o.local] || [];
    var nomes = rec.map(function (k) { return RP.nomeRecurso(k); }).join(' ou ');
    var guarda = o.local === 'castelo' || o.local === 'armazem';
    var saque = guarda ? 'recursos guardados, inclusive os valiosos' : nomes ? nomes + ' que o local produz e guarda (até 10 h de produção)' : 'o que estiver guardado no local';
    return linhaInfo('Saque', RP.esc(saque)) +
      (o.local === 'castelo' ? linhaInfo('Cerco', 'relíquias e recursos guardados; se o castelo cai, vira ruína')
        : linhaInfo('Ocupação', 'o local passa a ser seu' + (nomes ? ' e a produzir ' + RP.esc(nomes) + ' para você' : '') + ', no mesmo nível'));
  }
  function montarObjeto(o) {
    var d = M.dados, h = o.hex;
    var e = M.estado(h), tp = MAPA.tiposObjeto[o.tipo], corpo = notaAntiga(e) + '<div class="info">', acoes = '';
    if (o.tipo === 'local') {
      corpo += linhaInfo('Tipo', RP.esc(RP.TIPOS_LOCAL[o.local] || o.local)) + linhaInfo('Dono', RP.esc(donoTxt(o))) + (o.nivel ? linhaInfo('Nível', o.nivel) : '') + linhaInfo('Terreno', RP.esc(nomeTerreno(h)));
      if (o.reliquias) corpo += linhaInfo('Relíquia', o.reliquias + (o.reliquias > 1 ? ' guardadas' : ' guardada'));
      if (o.dono === 'livre' || o.ruina) corpo += '</div><p class="nota-regra">' + RP.icone('escombros', 'ico-p') + '<span>Ruínas e terra livre podem ser ocupadas ou reconstruídas.</span></p><div>';
      if (o.dono !== 'meu' && !o.ruina && o.dono !== 'livre') corpo += '</div><div class="secao-titulo">Atacar pode render</div><div class="info">' + ganhosLocal(o) + '</div><div>';
      /* o último reconhecimento deste local, como foi visto na hora: não se atualiza sozinho, vale de qualquer distância */
      var rec = o.dono !== 'meu' && d.reconhecidos && d.reconhecidos[o.id];
      if (rec && RP.forcaInimigaHTML) corpo += '</div><div class="secao-titulo">Visto no reconhecimento</div>' + RP.forcaInimigaHTML(rec) + '<div>';
    } else if (o.tipo === 'jazida') {
      corpo += linhaInfo('Recurso', RP.esc(RP.NOMES_REC[o.recurso] || o.recurso)) + linhaInfo('Restante', Math.round((o.restante || 0) * 100) + '%') +
        ((RP.config && RP.config.valor && RP.config.valor[o.recurso]) ? linhaInfo('Vale', RP.config.valor[o.recurso] + ' básicos cada') : '');
      corpo += '</div><p class="nota-regra">' + RP.icone('picareta', 'ico-p') + '<span>Nada é obrigatório: qualquer tropa pode coletar. Mais tropas, posto e rotas rendem mais.</span></p><div>';
    } else if (o.tipo === 'ruina-antiga') {
      corpo += linhaInfo('Relíquia', o.esgotada === true ? 'já escavada' : o.esgotada === false ? 'guarda 1 relíquia' : 'é preciso ir ver se ainda guarda');
      if (o.esgotada !== true) corpo += '</div><div class="secao-titulo">Escavar pode render</div>' + RP.ganhosRuina(d.reliquiaTipos) + '<div>';
      corpo += '</div><p class="nota-regra">' + RP.icone('lendario', 'ico-p') + '<span>Uma unidade já escava. Mais tropas e um posto encurtam o tempo.</span></p><div>';
    } else if (tp && tp.folha) corpo += tp.folha(o, d) || '';
    else corpo += linhaInfo('Tipo', RP.esc(o.tipo));
    corpo += '</div>';
    if (tp && tp.acoes) acoes += tp.acoes(o, d) || '';
    acoes += '<button type="button" class="btn btn-p btn-fantasma" data-abrir-hex="' + h + '" data-tecla="X">' + RP.icone('hexagonos') + 'Hexágono</button>';
    return {
      titulo: RP.esc(nomeObjeto(o)), subtitulo: '<div class="linha">' + (o.tipo === 'jazida' ? seloEstado(e) : seloObjeto(e)) + coordTxt(h) + '</div>',
      icone: '<span class="ico-placa folha-ico' + (o.tipo === 'local' ? ' ' + RP.mapaTatico.classeDono(o.dono) : '') + '">' + RP.icone(iconeObjeto(o), o.tipo === 'jazida' ? 'r-' + o.recurso : '') + '</span>',
      corpo: corpo, acoes: acoes
    };
  }
  function folhaMarcha(o) {
    if (o.dono === 'meu') { folhaMarchaPropria(o); return; }
    var m = montarMarchaAlheia(o);
    abrirFolhaMapa(m, m.hex);
  }
  function montarMarchaAlheia(o) {
    var ag = RP.agora(), pos = M.posMarcha(o, ag), def = MAPA.tiposMarcha[o.marcha] || {};
    var titulo = def.nome || NOME_MARCHA[o.marcha] || 'Marcha';
    var corpo = '<div class="info">' + linhaInfo('De quem', o.dono === 'aliado' ? 'Aliado · ' + RP.esc(donoTxt({ reino: o.reino })) : RP.esc(donoTxt(o))) + '</div>' +
      (o.reliquia ? '<p class="nota-regra">' + RP.icone('lendario', 'ico-p') + '<span>Leva uma relíquia.</span></p>' : '');
    return {
      hex: pos.hex, titulo: titulo, subtitulo: '<div class="linha">' + seloObjeto(M.estado(pos.hex)) + coordTxt(pos.hex) + '</div>',
      icone: '<span class="ico-placa folha-ico marcha-ico ' + RP.mapaTatico.classeDono(o.dono) + '">' + RP.icone(RP.mapaTatico.iconeMarcha(o)) + '</span>',
      corpo: corpo, acoes: ''
    };
  }
  /* Marcha própria: sempre controlável pelo mapa, em qualquer ponto do caminho. Mostra o que é, destino, chegada e
     carga (o servidor manda carga/cargaMax/tropas/estado em GET /mapa; GET /tropas completa para exércitos), com
     até 3 ações: mandar para outro lugar, voltar ao castelo e parar aqui. Exploradores usam as ordens deles. */
  var ESTADO_MARCHA = { marchando: 'em marcha', parado: 'parada', retornando: 'voltando', trabalhando: 'trabalhando' };
  function ehExplorador(tipo) { return /explor|batedor|prospector/.test(String(tipo || '')); }
  function folhaMarchaPropria(o) {
    var m = montarMarchaPropria(o);
    abrirFolhaMapa(m, m.hex);
    /* exércitos: completa com GET /tropas (carga, bloqueio) se ainda não veio */
    if (o.marcha === 'exercito' && !RP.exercito(o.id)) RP.carregarTropas().then(function () { if (RP.folhaAberta() && RP.exercito(o.id)) folhaMarchaPropria(o); }, function () { /* offline */ });
  }
  function montarMarchaPropria(o) {
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
      (cheg && cheg > ag ? linhaInfo(estado === 'retornando' ? 'Chega em casa' : 'Chegada', RP.barraTempo(o.tempos && o.tempos[0], cheg, { rotulo: estado === 'retornando' ? 'Volta para casa' : 'Marcha até o destino' })) : '') +
      (d.trabalho ? linhaInfo(d.trabalho.tipo === 'caca' ? 'Caçando' : d.trabalho.tipo === 'escavacao' ? 'Escavando' : 'Extraindo', (d.trabalho.coletado && RP.cargaUsada(d.trabalho.coletado) ? 'já juntou ' + RP.esc(RP.cargaTexto(d.trabalho.coletado)) : 'começando') + (d.trabalho.destino ? ' · leva para ' + RP.esc(d.trabalho.destino) : '')) +
        (d.trabalho.fim ? linhaInfo(d.trabalho.tipo === 'extracao' ? 'Carga cheia' : 'Termina', RP.barraTempo(d.trabalho.inicio, d.trabalho.fim, { cor: 'sucesso', rotulo: 'Trabalho' })) : '') : '') +
      '</div>' +
      (d.cargaMax != null || (d.carga && RP.cargaUsada(d.carga)) ? '<div style="margin-top:var(--esp-3)">' + RP.cargaHTML(d.carga, d.cargaMax) + '</div>' : '') +
      (d.bloqueio ? '<p class="nota-antiga nota-perigo" style="margin-top:var(--esp-3)">' + RP.icone('alerta', 'ico-p') + RP.esc(d.bloqueio) + '</p>' : '');
    var acoes = '';
    if (ehExplorador(o.marcha)) {
      acoes = '<a class="btn btn-p btn-primario" href="#/exploradores?ativo=' + o.id + '">' + RP.icone('seta') + 'Novo destino</a>' +
        (estado !== 'retornando' ? '<button type="button" class="btn btn-p" data-marcha-voltar-exp="' + o.id + '" data-tecla="V">' + RP.icone('voltar') + 'Voltar ao castelo</button>' : '');
    } else if (o.marcha === 'exercito' || ex) {
      var pode = !d.bloqueio && d.podeOrdem !== false, divide = pode && estado !== 'trabalhando' && RP.somaGrupo(d.tropas || {}) > 1;
      acoes = (pode ? '<button type="button" class="btn btn-p btn-primario" data-exercito-mover="' + o.id + '">' + RP.icone('seta') + 'Novo destino</button>' : '') +
        (pode ? '<button type="button" class="btn btn-p" data-tropa-patrulhar="' + o.id + '" data-tecla="Q">' + RP.icone('rota') + 'Patrulhar</button>' : '') +
        (pode && estado !== 'retornando' ? '<button type="button" class="btn btn-p" data-exercito-voltar="' + o.id + '" data-tecla="V">' + RP.icone('voltar') + 'Voltar ao castelo</button>' : '') +
        (pode && estado !== 'parado' ? '<button type="button" class="btn btn-p" data-exercito-parar="' + o.id + '" data-hex="' + pos.hex + '" data-tecla="H">' + RP.icone('alvo') + 'Parar aqui</button>' : '') +
        (divide ? '<button type="button" class="btn btn-p" data-tropa-separar="' + o.id + '" data-tecla="K">' + RP.icone('tropas') + 'Separar</button>' : '') +
        '<button type="button" class="btn btn-p" data-exercito="' + o.id + '" data-tecla="I">' + RP.icone('info') + 'Detalhes</button>' +
        '<a class="btn btn-p" href="#/posturas?marcha=' + o.id + '" data-tecla="C">' + RP.icone('escudo') + 'Comportamento</a>';
    } else if (o.marcha === 'caravana' && RP.telas.caravana) {
      acoes = '<a class="btn btn-p" href="#/caravana">' + RP.icone('carroca') + 'Caravanas</a>';
    }
    return {
      hex: pos.hex, titulo: RP.esc(nome), subtitulo: '<div class="linha"><span class="selo selo-visivel">' + RP.icone('olho') + 'Sua tropa</span>' + coordTxt(pos.hex) + '</div>',
      icone: '<span class="ico-placa folha-ico marcha-ico dono-meu">' + RP.icone(RP.mapaTatico.iconeMarcha(o)) + '</span>',
      corpo: corpo, acoes: acoes
    };
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

  /* ---------------------------------------------------------------- fundar pelo mapa */
  function atualizarFaixaFundar() {
    var f = tela && RP.$('.mapa-faixa', tela);
    if (!f) return;
    f.hidden = !alvoFundar;
    if (alvoFundar) f.innerHTML = RP.icone('alvo', 'ico-p') + '<span>Clique num hexágono destacado para fundar: <b>' + RP.esc((RP.NOMES_FUNDAR || {})[alvoFundar] || alvoFundar) + '</b></span>' +
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

  /* a tropa que o clique achou: um soldado parado na guarnição, os soldados de uma pilha, ou um exército seu em campo (todos os soldados dele) */
  function tropaDoToque(alvo) {
    var e = alvo.ent, o = alvo.obj, PV = RP.pessoasVista;
    if (e && e[0] === 'pessoas') {
      var lista = (((M.dados && M.dados.pessoasPorHex) || {})[e[1]] || []).filter(function (x) { return PV.ehSoldado(x) && x.estado === 'guarnecida'; });
      return lista.length ? { ids: lista.map(function (x) { return x.id; }), localId: lista[0].localId, hex: e[1], pilha: true } : null;
    }
    if (e && e[0] === 'pessoa') {
      var p = M.pessoa(e[1]);
      return p && PV.ehSoldado(p) && p.estado === 'guarnecida' ? { ids: [p.id], localId: p.localId, hex: p.hex } : null;
    }
    if (!o || o.tipo !== 'marcha' || o.dono !== 'meu' || o.marcha !== 'exercito') return null;
    var ids = (o.pessoaIds || []).filter(function (id) { var q = M.pessoa(id); return q && PV.ehSoldado(q); });
    return ids.length ? { ids: ids, marchaId: o.id, hex: M.posMarcha(o, RP.agora()).hex, obj: o } : null;
  }
  /* Mouse na mesa (decisão 0030): o botão esquerdo seleciona e abre (tropa, local, pessoa, hexágono); o direito dá a
     ordem à tropa selecionada no ponto clicado (ou abre o menu do que está sob o mouse quando nada está selecionado);
     Shift + direito mostra todas as ordens; o duplo clique num soldado seleciona todos do mesmo tipo no lugar. */
  function aoTocar(alvo) {
    var hh = alvo.hex != null ? alvo.hex : (alvo.obj && alvo.obj.hex), E = RP.envio, S = RP.selecao, ent = alvo.ent;
    /* rota do explorador: qualquer clique é um ponto */
    if (RP.rotaExp && RP.rotaExp.ativa()) { if (hh != null && hh >= 0) RP.rotaExp.ponto(hh); return; }
    if (alvo.botao === 2) { cliqueDireito(alvo); return; }
    if (E && E.painel()) RP.fecharFolha();   /* o clique no mundo larga o envio rápido */
    if (alvoFundar) { if (hh != null && hh >= 0) folhaFundar(hh); return; }
    if (E && E.desenhando()) { if (hh != null && hh >= 0) E.ponto(hh); return; }
    /* ordem pedida ("Novo destino", "Missão"): o clique escolhe o hexágono (a folha dele traz as ordens), nunca abre o painel do local */
    if (E && E.ativo() && !E.implicito()) { if (hh != null && hh >= 0) folhaHex(hh); return; }
    if (ent && ent[0] === 'link') { RP.ir(ent[1]); return; }
    /* a batalha divide o hexágono com as tropas: clicar no marcador dela abre a tela, sem selecionar ninguém */
    var tlk = alvo.obj && !alvo.shift && MAPA.tiposObjeto[alvo.obj.tipo], lk = tlk && tlk.link && tlk.link(alvo.obj);
    if (lk) { RP.ir(lk); return; }
    var t = tropaDoToque(alvo);
    /* duplo clique num soldado da guarnição: todos do mesmo tipo naquele lugar */
    if (alvo.duplo && t && !t.marchaId && ent) {
      var p0 = M.pessoa(t.ids[0]), iguais = (((M.dados && M.dados.pessoasPorHex) || {})[t.hex] || []).filter(function (x) { return p0 && x.oficio === p0.oficio && x.estado === 'guarnecida'; });
      if (iguais.length) { S.definir(iguais.map(function (x) { return x.id; })); return; }
    }
    /* no modo seleção (ou com Shift), soma ou tira da seleção */
    if (S && (S.modo || RP.shift || alvo.shift) && (t || (ent && ent[0] === 'pessoa'))) { S.alternarLista(t ? t.ids : [ent[1]]); return; }
    if (t) { S.tocarTropa(t); return; }
    if (ent && ent[0] === 'pessoa') { S.focar(ent[1]); RP.folhaPessoa(ent[1]); return; }
    if (ent && ent[0] === 'pessoas') { RP.folhaPessoasDoHex(ent[1]); return; }
    /* clique em qualquer outro lugar: abre o que foi clicado (a ordem para a tropa selecionada é pelo botão direito) */
    if (S && S.n() && !S.modo) S.limpar();
    if (E && E.ativo() && E.implicito()) E.cancelar();
    if (alvo.obj) folhaObjeto(alvo.obj);
    else if (alvo.hex != null && alvo.hex >= 0) folhaHex(alvo.hex);
  }
  function aoPassar(h) { if (RP.rotaExp) RP.rotaExp.passar(h); }
  function cliqueDireito(alvo) {
    var hh = alvo.hex != null ? alvo.hex : (alvo.obj && alvo.obj.hex), E = RP.envio, S = RP.selecao, ent = alvo.ent;
    if (alvoFundar) { if (hh != null && hh >= 0) folhaFundar(hh); return; }
    if (E && E.desenhando()) { if (hh != null && hh >= 0) E.ponto(hh); return; }
    var t = tropaDoToque(alvo), tropa = S && S.soldados();
    if (tropa || (E && E.ativo())) {
      if (hh == null || hh < 0) return;
      /* direito em outra tropa sua em campo: juntar */
      if (t && t.marchaId && tropa && !t.ids.every(function (id) { return S.tem(id); })) {
        var o = S.origem();
        if (!o.erro) { E.folhaJuntar(o, t); return; }
      }
      var completa = !!(RP.shift || alvo.shift);
      if (tropa) S.ordem(hh, completa); else E.rapido(hh, completa);
      return;
    }
    menuDoAlvo(alvo);
  }
  /* primeiro item do menu: o envio rápido de tropas para este hexágono */
  function itemEnviar(h) {
    return RP.envio && RP.envio.podePara(h) ? [{ rotulo: 'Enviar tropas para cá', icone: 'tropas', classe: 'primario', acao: function () { RP.envio.paraCa(h); } }] : [];
  }
  /* menu de contexto do que está sob o mouse: os mesmos botões da folha, sem abrir a folha */
  function menuDoAlvo(alvo) {
    var x = alvo.cx || 0, y = alvo.cy || 0, o = alvo.obj, ent = alvo.ent, hh = alvo.hex;
    if (ent && ent[0] === 'pessoa') {
      var p = M.pessoa(ent[1]);
      RP.menuContexto({ x: x, y: y, titulo: p ? RP.esc(p.nome) : 'Pessoa', itens: [
        { rotulo: 'Abrir', icone: 'info', tecla: 'I', acao: function () { RP.selecao.focar(ent[1]); RP.folhaPessoa(ent[1]); } },
        p && RP.pessoasVista.ehSoldado(p) && p.estado === 'guarnecida' ? { rotulo: 'Selecionar', icone: 'populacao', acao: function () { RP.selecao.definir([p.id]); } } : null
      ].filter(Boolean) });
      return;
    }
    if (ent && ent[0] === 'pessoas') {
      RP.menuContexto({ x: x, y: y, titulo: 'Pessoas aqui', itens: [{ rotulo: 'Ver quem está aqui', icone: 'populacao', acao: function () { RP.folhaPessoasDoHex(ent[1]); } }] });
      return;
    }
    if (o && o.tipo === 'marcha') {
      var m = o.dono === 'meu' ? montarMarchaPropria(o) : montarMarchaAlheia(o);
      RP.menuContexto({ x: x, y: y, titulo: m.titulo, acoes: m.acoes + '<button type="button" class="btn btn-fantasma" data-abrir-obj="' + o._k + '" data-tecla="I">' + RP.icone('info') + 'Abrir</button>' });
      return;
    }
    if (o && o.tipo === 'local' && o.dono === 'meu' && RP.local(o.id)) {
      var l = RP.local(o.id);
      RP.menuContexto({ x: x, y: y, titulo: RP.esc(l.nome), itens: itemEnviar(l.hex), acoes: RP.acoesLocal(l) + '<button type="button" class="btn btn-fantasma" data-local="' + l.id + '" data-tecla="I">' + RP.icone('info') + 'Abrir</button>' });
      return;
    }
    if (o) {
      var mo = montarObjeto(o);
      RP.menuContexto({ x: x, y: y, titulo: mo.titulo, itens: o.hex != null ? itemEnviar(o.hex) : [], acoes: mo.acoes + '<button type="button" class="btn btn-fantasma" data-abrir-obj="' + o._k + '" data-tecla="I">' + RP.icone('info') + 'Abrir</button>' });
      return;
    }
    if (hh != null && hh >= 0 && M.dados) {
      var mh = montarHex(hh);
      RP.menuContexto({ x: x, y: y, titulo: mh.titulo, itens: itemEnviar(hh), acoes: mh.acoes + '<button type="button" class="btn btn-fantasma" data-abrir-hex="' + hh + '" data-tecla="I">' + RP.icone('info') + 'Abrir</button>' });
    }
  }

  /* ---------------------------------------------------------------- teclado: andar pelo mapa, câmera, visão, exércitos */
  var teclasPan = {}, rafPan = 0, ultimoPan = 0;
  var PAN = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0] };
  function passoPan(t) {
    rafPan = 0;
    var dx = 0, dy = 0, k;
    for (k in teclasPan) if (teclasPan[k] && PAN[k]) { dx += PAN[k][0]; dy += PAN[k][1]; }
    if (!dx && !dy || !ativa()) { ultimoPan = 0; return; }
    var dt = Math.min(50, t - (ultimoPan || t)); ultimoPan = t;
    var v = 0.9 * dt; /* px por ms */
    visao().deslocar(dx * v, dy * v);
    rafPan = requestAnimationFrame(passoPan);
  }
  window.addEventListener('keydown', function (e) {
    if (!ativa() || e.ctrlKey || e.metaKey || e.altKey || (e.target.closest && e.target.closest('input, textarea, select'))) return;
    var k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    if (!PAN[k]) return;
    e.preventDefault();
    teclasPan[k] = true;
    if (!rafPan) { ultimoPan = 0; rafPan = requestAnimationFrame(passoPan); }
  });
  window.addEventListener('keyup', function (e) { var k = e.key.length === 1 ? e.key.toUpperCase() : e.key; if (PAN[k]) delete teclasPan[k]; });
  window.addEventListener('blur', function () { teclasPan = {}; });
  ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].forEach(function (k, i) { RP.teclas.registrar(k, { descricao: ['Mapa para cima', 'Mapa para baixo', 'Mapa para a esquerda', 'Mapa para a direita'][i] + ' (ou W A S D)', grupo: 'Mapa', acao: function () {}, oculta: i > 0 }); });
  RP.teclas.registrar('Space', { descricao: 'Centralizar no castelo', grupo: 'Mapa', acao: function () { if (ativa()) irCastelo(true); } });
  RP.teclas.registrar('M', { descricao: 'Vista ⇄ Mapa tático', grupo: 'Mapa', acao: function () { if (ativa()) definirModo(modo === 'cena' ? 'tatico' : 'cena'); } });
  RP.teclas.registrar('G', { descricao: 'Grade de hexágonos', grupo: 'Mapa', acao: function () { MAPA.camadas.grade = !MAPA.camadas.grade; if (tat) { tat.ci = null; tat.atualizarSvg(); tat.pedirQuadro(); } if (cena) cena.invalidar(); } });
  RP.teclas.registrar('L', { descricao: 'Camadas e legenda', grupo: 'Mapa', acao: function () { if (ativa()) abrirCamadas(); } });
  RP.teclas.registrar('=', { descricao: 'Aproximar (ou roda do mouse)', grupo: 'Mapa', acao: function () { if (ativa()) visao().zoomBotao(1.5); } });
  RP.teclas.registrar('+', { descricao: 'Aproximar', grupo: 'Mapa', acao: function () { if (ativa()) visao().zoomBotao(1.5); }, oculta: true });
  RP.teclas.registrar('-', { descricao: 'Afastar', grupo: 'Mapa', acao: function () { if (ativa()) visao().zoomBotao(0.6667); } });
  RP.teclas.registrar('Home', { descricao: 'Câmera de volta ao padrão', grupo: 'Mapa', acao: function () { if (!ativa()) return; if (modo !== 'cena') definirModo('cena'); cena.inclinar(null); cena.girar(null); } });
  /* Tab passa pelos exércitos em campo (e pelas guarnições com soldados): seleciona e centra */
  var ciclo = -1;
  function proximaTropa(e) {
    if (!ativa() || !M.dados) return;
    var lista = [];
    M.dados.marchas.filter(function (o) { return o.dono === 'meu' && o.marcha === 'exercito'; }).forEach(function (o) {
      var ids = (o.pessoaIds || []).filter(function (id) { var q = M.pessoa(id); return q && RP.pessoasVista.ehSoldado(q); });
      if (ids.length) lista.push({ ids: ids, hex: M.posMarcha(o, RP.agora()).hex });
    });
    (RP.reino && RP.reino.locais || []).forEach(function (l) {
      var ids = (((M.dados.pessoasPorHex) || {})[l.hex] || []).filter(function (x) { return RP.pessoasVista.ehSoldado(x) && x.estado === 'guarnecida'; }).map(function (x) { return x.id; });
      if (ids.length) lista.push({ ids: ids, hex: l.hex });
    });
    if (!lista.length) { RP.aviso({ titulo: 'Nenhuma tropa', texto: 'Recrute no castelo ou no quartel.', icone: 'tropas', ms: 1800 }); return; }
    ciclo = (e && e.shiftKey ? ciclo - 1 + lista.length : ciclo + 1) % lista.length;
    var t = lista[ciclo];
    RP.fecharFolha();
    RP.selecao.definir(t.ids);
    centrarHex(t.hex, true);
  }
  RP.teclas.registrar('Tab', { descricao: 'Próxima tropa (Shift: anterior)', grupo: 'Tropas', acao: proximaTropa });

  /* ---------------------------------------------------------------- faixas de ameaça */
  function atualizarFaixas() {
    var box = tela && RP.$('.mapa-faixas', tela), d = M.dados;
    if (!box || !d) return;
    var ag = RP.agora();
    /* exércitos de outros reinos dentro da visão: de quem são, sem tamanho nem destino */
    var hostis = d.marchas.filter(function (m) { var p = M.posMarcha(m, ag); return m.dono === 'outro' && m.marcha === 'exercito' && M.estado(p.hex).v === 'visivel'; });
    var faixas = hostis.map(function (m) {
      return '<button type="button" class="faixa-alerta" data-faixa-marcha="' + m._k + '">' + RP.icone('alerta', 'pulso') +
        '<span class="txt"><b>Exército de ' + RP.esc(m.reino ? m.reino.nome : 'outro reino') + '</b><br>em movimento à vista</span>' + RP.icone('avancar', 'ico-p') + '</button>';
    });
    box.innerHTML = faixas.slice(0, 2).join('') + (faixas.length > 2
      ? '<div class="faixas-extra" id="faixas-extra" hidden>' + faixas.slice(2).join('') + '</div><button type="button" class="faixa-mais" data-faixas-mais aria-expanded="false" aria-controls="faixas-extra">' +
        RP.icone('alerta', 'ico-p') + '<span>+' + (faixas.length - 2) + (faixas.length - 2 > 1 ? ' alertas' : ' alerta') + '</span></button>' : '');
  }

  /* ---------------------------------------------------------------- camadas e legenda */
  function abrirCamadas() {
    var cam = MAPA.camadas, d = M.dados;
    var temFauna = !!MAPA.perigoHex || !!(d && d.objs.some(function (o) { return o.tipo === 'fauna'; }));
    var tog = function (k, rot, ic) { return '<button type="button" class="alternar" data-camada="' + k + '" aria-pressed="' + (k === 'perigo' || k === 'grade' ? !!cam[k] : cam[k] !== false) + '">' + RP.icone(ic) + '<span>' + rot + '</span><i aria-hidden="true"></i></button>'; };
    var terr = Object.keys(TERRENOS).map(function (t) { return '<div class="legenda-item"><span class="amostra-hex t-' + t + '"></span><span><b>' + TERRENOS[t][0] + '</b><small>' + TERRENOS[t][1] + '</small></span></div>'; }).join('') +
      '<div class="legenda-item"><span class="amostra-hex t-rio"></span><span><b>Rio</b><small>Exige ponte ou vau. Sem ponte, a travessia é mais lenta.</small></span></div>';
    RP.abrirFolha({
      titulo: 'Camadas e legenda', veu: true,
      corpo: '<div class="alternar-grade">' + (MAPA.perigoHex ? tog('perigo', 'Perigo', 'pata') : '') + (temFauna ? tog('fauna', 'Animais', 'lobo') : '') +
        tog('rotas', 'Rotas', 'rota') + tog('marchas', 'Marchas', 'tropas') + tog('recursos', 'Jazidas', 'ouro') + tog('bandeiras', 'Bandeiras', 'bandeira') + tog('rotulos', 'Nomes', 'info') + tog('grade', 'Grade', 'hexagonos') + '</div>' +
        (MAPA.perigoHex ? '<p class="fraco legenda-nota">A camada Perigo pinta as áreas conhecidas com fauna hostil, para escolher entre rota curta e perigosa ou longa e segura. Vale no Mapa; na Vista os animais aparecem desenhados.</p>' : '') +
        '<div class="secao-titulo">Névoa</div>' +
        '<div class="legenda-item"><span class="amostra-hex t-planicie"></span><span><b>Visível</b><small>Dentro da visão de locais, tropas e exploradores. Tudo ao vivo.</small></span></div>' +
        '<div class="legenda-item"><span class="amostra-hex nevoa-exp t-planicie"></span><span><b>Explorado</b><small>Mostra o último estado conhecido e há quanto tempo foi visto.</small></span></div>' +
        '<div class="legenda-item"><span class="amostra-hex nevoa-desc"></span><span><b>Nunca explorado</b><small>Cobre a riqueza do chão e os animais, não reinos nem marchas. Envie exploradores.</small></span></div>' +
        (MAPA.perigoHex ? '<div class="secao-titulo">Perigo</div>' +
          '<div class="legenda-item"><span class="amostra-hex pg-amostra pg-baixo t-planicie"></span><span><b>Baixo</b><small>Animais fracos ou área cortada por rota.</small></span></div>' +
          '<div class="legenda-item"><span class="amostra-hex pg-amostra pg-medio t-planicie"></span><span><b>Médio</b></span></div>' +
          '<div class="legenda-item"><span class="amostra-hex pg-amostra pg-alto t-planicie"></span><span><b>Alto</b><small>Evite com exploradores sozinhos e grupos pequenos.</small></span></div>' : '') +
        '<div class="secao-titulo">Terrenos</div>' + terr +
        '<div class="secao-titulo">Donos</div>' +
        '<div class="legenda-item"><span class="ponto-dono dono-meu"></span><span><b>Seu reino</b></span></div>' +
        '<div class="legenda-item"><span class="ponto-dono dono-desconhecido"></span><span><b>Outro reino</b><small>Todo local e toda marcha mostram o dono.</small></span></div>' +
        '<div class="legenda-item"><span class="ponto-dono dono-aliado"></span><span><b>Aliado</b><small>Membros da sua aliança.</small></span></div>' +
        '<div class="legenda-item"><span class="ico-placa">' + RP.icone('escombros') + '</span><span><b>Ruína / terra livre</b><small>Sem dono. Podem ser ocupadas e reconstruídas.</small></span></div>' +
        MAPA.legendaExtras.map(function (f) { return f() || ''; }).join('')
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-camada]');
    if (!b) return;
    var k = b.getAttribute('data-camada'), cam = MAPA.camadas;
    cam[k] = k === 'perigo' || k === 'grade' ? !cam[k] : cam[k] === false;
    b.setAttribute('aria-pressed', String(k === 'perigo' || k === 'grade' ? !!cam[k] : cam[k] !== false));
    if (tat) { tat.ci = null; tat.atualizarSvg(); tat.pedirQuadro(); }
    if (cena) cena.invalidar();
  });

  /* ---------------------------------------------------------------- minimapa */
  /* O minimapa mostra a parte do mundo que o reino conhece (com folga), não o mundo inteiro: num mapa de 312 × 240 o
     que se conhece no começo seria um ponto. O recorte cresce conforme a exploração e mantém a proporção da caixa. */
  var mmOx = 0, mmOy = 0;
  function recorteMinimapa(d, w, h) {
    var n = H.COLS * H.LINS, i, p, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (i = 0; i < n; i++) {
      if (!d.ter[i]) continue;
      p = H.centroH(i);
      if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
    }
    if (!isFinite(x0)) return { x: 0, y: 0, w: H.LARGURA, h: H.ALTURA };
    var folga = H.W * 12, bw = Math.max(x1 - x0 + 2 * folga, H.W * 70), bh = Math.max(y1 - y0 + 2 * folga, H.VS * 50), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    /* mantém a proporção da caixa do minimapa */
    if (bw / bh > w / h) bh = bw * h / w; else bw = bh * w / h;
    bw = Math.min(bw, H.LARGURA); bh = Math.min(bh, H.ALTURA);
    var rx = Math.max(0, Math.min(H.LARGURA - bw, cx - bw / 2)), ry = Math.max(0, Math.min(H.ALTURA - bh, cy - bh / 2));
    return { x: rx, y: ry, w: bw, h: bh };
  }
  function desenharMinimapa() {
    var d = M.dados; if (!mm || !d) return;
    var box = mm.parentNode, w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1), tk = RP.mapaTatico.tokens();
    mm.width = Math.round(w * dpr); mm.height = Math.round(h * dpr);
    var rc = recorteMinimapa(d, w, h);
    mmEscala = w / rc.w; mmOx = rc.x; mmOy = rc.y;
    var c = mmCtx; c.setTransform(dpr * mmEscala, 0, 0, dpr * mmEscala, -rc.x * dpr * mmEscala, -rc.y * dpr * mmEscala);
    c.fillStyle = tk.nevoa[0]; c.fillRect(rc.x, rc.y, rc.w, rc.h);
    var n = H.COLS * H.LINS, i, p, e;
    for (i = 0; i < n; i++) {
      if (!d.ter[i]) continue;
      p = H.centroH(i); e = d.idade[i];
      c.fillStyle = d.rio[i] ? tk.rioAgua : tk.t[d.ter[i]][0];
      c.fillRect(p.x - H.W / 2 - 1, p.y - H.R * 0.8, H.W + 2, H.R * 1.6);
      if (e !== 0) { c.fillStyle = tk.veu; c.fillRect(p.x - H.W / 2 - 1, p.y - H.R * 0.8, H.W + 2, H.R * 1.6); }
    }
    var Cs = A.cores();
    d.objs.forEach(function (o) {
      if (o.tipo !== 'local' || o.dono === 'livre') return;
      p = H.centroH(o.hex);
      c.fillStyle = A.corDono(o.dono, o);
      c.beginPath(); c.arc(p.x, p.y, o.local === 'castelo' ? 34 : 20, 0, 6.2832); c.fill();
    });
    mmVersao = M.versao;
    desenharVistaMinimapa();
  }
  function desenharVistaMinimapa() {
    if (!mmVista || !mm) return;
    var r = visao().retanguloMundo(), mw = mm.clientWidth, mh = mm.clientHeight;
    var x0 = Math.max(0, (r.x - mmOx) * mmEscala), y0 = Math.max(0, (r.y - mmOy) * mmEscala), x1 = Math.min(mw, (r.x + r.w - mmOx) * mmEscala), y1 = Math.min(mh, (r.y + r.h - mmOy) * mmEscala);
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
      var r = mm.getBoundingClientRect(), wx = mmOx + (e.clientX - r.left) / mmEscala, wy = mmOy + (e.clientY - r.top) / mmEscala;
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
      '<canvas class="cena-cv" aria-label="Vista do mundo. Arraste para mover, roda do mouse para zoom. Clique em construções, tropas e hexágonos; botão direito dá ordens."></canvas>' +
      '<div class="mapa-vp" role="application" aria-label="Mapa tático. Arraste para mover, roda do mouse para zoom. Clique num hexágono para detalhes; botão direito dá ordens."></div>' +
      '<div class="mapa-topo"><div class="mapa-faixas"></div><div class="mapa-faixa card" role="status" hidden></div></div>' +
      '<div class="mapa-base"></div>' +
      '<div class="mapa-controles" role="toolbar" aria-label="Controles do mapa">' +
      '<button type="button" class="btn btn-icone" data-zoom="1.5" aria-label="Aproximar" data-dica="Aproximar <kbd class=\'tecla\'>+</kbd> <small>ou a roda do mouse</small>">' + RP.icone('mais') + '</button>' +
      '<button type="button" class="btn btn-icone" data-zoom="0.6667" aria-label="Afastar" data-dica="Afastar <kbd class=\'tecla\'>−</kbd>">' + RP.icone('menos') + '</button>' +
      '<button type="button" class="btn btn-icone" data-centrar-castelo aria-label="Centralizar no castelo" data-dica="Castelo <kbd class=\'tecla\'>Espaço</kbd>">' + RP.icone('alvo') + '</button>' +
      '<button type="button" class="btn btn-icone" data-inclinar aria-label="Câmera de volta ao padrão" data-dica="<b>Câmera</b><small>Botão direito ou do meio arrastando: inclina e gira. Clique aqui para voltar ao padrão</small><kbd class=\'tecla\'>Home</kbd>">' + RP.icone('vista') + '</button>' +
      '<button type="button" class="btn btn-icone" data-selecao aria-pressed="false" aria-label="Modo seleção" data-dica="<b>Modo seleção</b><small>Clique soma ou tira; arrastar laça. Ou segure Shift</small>">' + RP.icone('populacao') + '</button>' +
      '<button type="button" class="btn btn-icone" data-camadas aria-label="Camadas e legenda" data-dica="Camadas e legenda <kbd class=\'tecla\'>L</kbd>">' + RP.icone('camadas') + '</button>' +
      '<button type="button" class="btn btn-icone" data-atalhos aria-label="Atalhos" data-dica="Mouse e teclado <kbd class=\'tecla\'>F1</kbd>">' + RP.icone('info') + '</button></div>' +
      '<div class="modo-mapa abas" role="group" aria-label="Tipo de visão" data-dica="Trocar a visão <kbd class=\'tecla\'>M</kbd>">' +
      '<button type="button" class="aba" data-modo-btn="cena" aria-pressed="true">' + RP.icone('vista') + 'Vista</button>' +
      '<button type="button" class="aba" data-modo-btn="tatico" aria-pressed="false">' + RP.icone('hexagonos') + 'Mapa</button></div>' +
      '<div class="minimapa" role="group" aria-label="Minimapa: clique para ir até um ponto"><canvas></canvas><div class="mm-vista"></div></div>';
    mm = RP.$('.minimapa canvas', el); mmCtx = mm.getContext('2d'); mmVista = RP.$('.mm-vista', el);
    cena = new RP.Cena(RP.$('.cena-cv', el), {
      interativa: true, camadas: MAPA.camadas,
      selecao: function () { return selecao; },
      escolhendoHex: function () { return !!alvoFundar || !!(RP.rotaExp && RP.rotaExp.ativa()) || !!(RP.envio && RP.envio.ativo() && !RP.envio.implicito()); },
      aoTocar: aoTocar, aoMover: pedirMinimapa, aoPassar: aoPassar,
      desenhando: function () { return !!(RP.envio && RP.envio.desenhando()); },
      aoTracar: function (h) { RP.envio.tracar(h); }, aoTracarFim: function () { RP.envio.tracarFim(); },
      modoSelecao: function () { return !!(RP.selecao && (RP.selecao.modo || RP.shift)); },
      aoLaco: function (pts) { if (RP.selecao) RP.selecao.lacar(pts); },
      aoToqueLongo: function () { if (RP.selecao && !RP.selecao.modo && !alvoFundar && !(RP.envio && RP.envio.ativo()) && !(RP.rotaExp && RP.rotaExp.ativa())) RP.selecao.ativarModo(true); },
      aoAfastarDemais: function () {
        definirModo('tatico', { s: 0.75 });
        RP.aviso({ titulo: 'Mapa tático', texto: 'Afastou além da Vista. Aproxime, aperte M ou clique em Vista para voltar.', icone: 'hexagonos', ms: 2200 });
      }
    });
    tat = new RP.Tatico(RP.$('.mapa-vp', el), {
      aoTocar: aoTocar, aoMover: pedirMinimapa, aoPassar: aoPassar,
      desenhando: function () { return !!(RP.envio && RP.envio.desenhando()); },
      aoTracar: function (h) { RP.envio.tracar(h); }, aoTracarFim: function () { RP.envio.tracarFim(); },
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
        var padrao = cena.inclinar(null) && Math.abs(cena.giro()) < 1e-4;
        cena.girar(null);
        RP.aviso({ titulo: padrao ? 'Câmera no padrão' : 'Câmera de volta ao padrão', texto: 'Botão direito ou do meio: arraste para cima e para baixo para inclinar, para os lados para girar.', icone: 'vista', ms: 2600 });
      }
      else if (e.target.closest('[data-camadas]')) abrirCamadas();
      else if (e.target.closest('[data-atalhos]')) RP.ajudaTeclas();
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
  document.addEventListener('rp:vivo', function () { if (ativa()) atualizarFaixas(); });
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
  /* só refaz o quadro (a Vista já roda sozinha; o Mapa tático desenha quando pedem) */
  MAPA.redesenhar = function () { if (ativa() && modo === 'tatico') tat.pedirQuadro(); };
  MAPA.folhaHex = folhaHex;
  MAPA.folhaObjeto = folhaObjeto;
  MAPA.centrar = function (h, animar) { if (ativa()) centrarHex(h, animar); };
  MAPA.modo = function () { return modo; };
  /* a visão ativa (RP.Cena ou RP.Tatico): centro(), centrar(x, y, s), retanguloMundo() */
  MAPA.visao = function () { return visao(); };
  MAPA.selecao = function () { return selecao; };
})();
