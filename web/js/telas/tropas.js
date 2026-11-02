/* Reino de Pedra — Tropas (guarnições, exércitos em campo, em treino, ordens) e Posturas.
   Também as peças comuns das telas militares: dados de GET /tropas (RP.tropas), apresentação das unidades,
   seletor de grupo (−/+) e a folha de um exército em campo. Porte de prototipo/js/acoes.js e militar.js. */
(function () {
  'use strict';
  var RP = window.RP;

  /* ---------------------------------------------------------------- dados (GET /tropas) */
  RP.tropas = null;
  var carregando = null;
  RP.carregarTropas = function () {
    if (carregando) return carregando;
    carregando = RP.get('/tropas').then(function (t) {
      carregando = null; RP.tropas = t; RP.sincronizar(t.agora);
      RP.tropas.unidadesPorId = {};
      t.unidades.forEach(function (u) { RP.tropas.unidadesPorId[u.id] = u; });
      document.dispatchEvent(new CustomEvent('rp:tropas', { detail: t }));
      return t;
    }, function (e) { carregando = null; throw e; });
    return carregando;
  };
  var recarga = null;
  RP.recarregarTropas = function () {
    if (recarga) return;
    recarga = setTimeout(function () { recarga = null; RP.carregarTropas().catch(function () { /* offline */ }); }, 400);
  };
  /* telas que mostram tropas pedem recarga quando algo muda no reino ou nas marchas */
  RP.telasTropas = ['tropas', 'recrutamento', 'posturas'];
  function precisaTropas() {
    var t = document.documentElement.getAttribute('data-tela');
    return RP.telasTropas.indexOf(t) >= 0 || (RP.envio && RP.envio.ativo());
  }
  RP.ouvir('reino', function () { if (precisaTropas()) RP.recarregarTropas(); });
  RP.ouvir('marchas', function () { if (precisaTropas()) RP.recarregarTropas(); });

  /* ---------------------------------------------------------------- apresentação das unidades */
  RP.UNIDADES_UI = {
    milicia: { icone: 'populacao', papel: 'Defesa barata, perto de casa' },
    lanceiro: { icone: 'tropas', papel: 'Infantaria de linha' },
    arqueiro: { icone: 'alvo', papel: 'Ataque à distância' },
    cavalaria: { icone: 'cavalo', papel: 'Rápida, boa para saque' },
    elite: { icone: 'cavalo', papel: 'Mais forte por pessoa; usa 1 cavalo de raça' },
    ariete: { icone: 'cerco', papel: 'Cerco: derruba portões e torres' },
    trebuchet: { icone: 'cerco', papel: 'Cerco a distância' }
  };
  RP.FAMILIAS = { infantaria: 'Infantaria', arqueiros: 'Arqueiros', cavalaria: 'Cavalaria', cerco: 'Cerco' };
  RP.VELOCIDADES = { 'Lenta': 'lenta', 'Média': 'média', 'Rápida': 'rápida' };
  RP.unidade = function (id) { return RP.tropas && RP.tropas.unidadesPorId[id]; };
  RP.iconeUnidade = function (id) { return (RP.UNIDADES_UI[id] || {}).icone || 'tropas'; };
  RP.nomeUnidade = function (id, n) {
    var u = RP.unidade(id); if (!u) return id;
    if (n === 1) return id === 'cavalaria' ? 'cavaleiro' : u.nome.toLowerCase();
    return u.plural;
  };
  RP.partesGrupo = function (g) {
    return Object.keys(g || {}).filter(function (k) { return g[k] > 0; }).map(function (k) { return g[k] + ' ' + RP.nomeUnidade(k, g[k]); }).join(', ');
  };
  RP.somaGrupo = function (g) { return Object.keys(g || {}).reduce(function (s, k) { return s + (g[k] > 0 ? g[k] : 0); }, 0); };
  RP.selosGrupo = function (g) {
    var ks = Object.keys(g || {}).filter(function (k) { return g[k] > 0; });
    if (!ks.length) return '<span class="fraco">nenhuma tropa</span>';
    return '<span class="tropas-selos">' + ks.map(function (k) {
      return '<span class="selo selo-g">' + RP.icone(RP.iconeUnidade(k)) + g[k] + ' ' + RP.esc(RP.nomeUnidade(k, g[k])) + '</span>';
    }).join('') + '</span>';
  };

  /* ---------------------------------------------------------------- peças comuns */
  RP.topoVoltar = function (titulo, voltar, sub) {
    return '<header class="topo"><a class="btn btn-fantasma btn-icone" href="#/' + voltar + '" aria-label="Voltar">' + RP.icone('voltar') + '</a>' +
      '<div class="topo-titulos"><h1>' + titulo + '</h1>' + (sub ? '<small>' + sub + '</small>' : '') + '</div></header>';
  };
  RP.stepper = function (id, valor, max) {
    return '<div class="stepper" data-stepper="' + id + '"><button type="button" class="btn btn-icone" data-passo="-1" aria-label="Menos"' + (valor <= 0 ? ' disabled' : '') + '>' + RP.icone('menos') + '</button>' +
      '<output class="num" aria-live="polite">' + valor + '</output>' +
      '<button type="button" class="btn btn-icone" data-passo="1" aria-label="Mais"' + (valor >= max ? ' disabled' : '') + '>' + RP.icone('mais') + '</button></div>';
  };
  RP.pontos = function (v) {
    var h = ''; for (var i = 1; i <= 5; i++) h += '<i class="' + (i <= v ? 'on' : '') + '"></i>';
    return '<span class="pontos" role="img" aria-label="' + v + ' de 5">' + h + '</span>';
  };
  /* seletor de grupo: uma linha por unidade disponível no local, com −/+ (e "todas") */
  RP.grupoTropas = {
    linhas: function (grupo, disp) {
      var ids = Object.keys(disp || {}).filter(function (k) { return disp[k] > 0; });
      if (!ids.length) return '<p class="fraco">Nenhuma tropa neste local.</p>';
      return ids.map(function (id) {
        var u = RP.unidade(id) || { carga: 0, vel: '' }, n = disp[id];
        return '<div class="linha-entre grupo-linha" data-unidade-grupo="' + id + '"><span class="linha">' + RP.icone(RP.iconeUnidade(id)) +
          '<span><b>' + RP.esc(u.nome || id) + '</b><br><small class="fraco">' + n + ' disponíve' + (n === 1 ? 'l' : 'is') + ' · carga ' + u.carga + ' · vel. ' + (RP.VELOCIDADES[u.vel] || '') + '</small></span></span>' +
          '<span class="linha grupo-ctrl">' + RP.stepper(id, grupo[id] || 0, n) + '<button type="button" class="btn btn-p btn-fantasma" data-grupo-todas="' + id + '">Todas</button></span></div>';
      }).join('');
    },
    /* trata o clique; devolve true se mudou o grupo */
    clique: function (e, grupo, disp) {
      var linha = e.target.closest('[data-unidade-grupo]'); if (!linha) return false;
      var id = linha.getAttribute('data-unidade-grupo'), max = (disp || {})[id] || 0, b;
      if ((b = e.target.closest('[data-passo]'))) { grupo[id] = Math.max(0, Math.min(max, (grupo[id] || 0) + +b.getAttribute('data-passo'))); return true; }
      if (e.target.closest('[data-grupo-todas]')) { grupo[id] = max; return true; }
      return false;
    }
  };
  RP.POSTURAS_INFO = [
    { id: 'atacarQualquer', curto: 'Qualquer ameaça', icone: 'tropas', txt: 'Sai para combater qualquer força hostil que entrar no alcance, mesmo sem ser atacada.' },
    { id: 'apenasDefender', curto: 'Só defender', icone: 'escudo', txt: 'Nunca sai do lugar. Luta só quando o próprio local é atacado.' },
    { id: 'atacarQuemAtacar', curto: 'Quem atacar', icone: 'alvo', txt: 'Defende e revida: persegue quem atacou este local ou os vizinhos.' }
  ];
  RP.ORDENS_NOMES = { mover: 'Mover', reforcar: 'Reforçar', retornar: 'Retornar' };

  /* exército em campo: título curto e linha de estado */
  RP.tituloExercito = function (e) {
    if (e.estado === 'retornando') return 'Voltando' + (e.alvo ? ' a ' + e.alvo : '');
    if (e.estado === 'parado') return 'Tropas em campo';
    if (e.ordem === 'reforcar') return 'Reforço: ' + (e.alvo || 'local');
    if (e.ordem === 'mover') return e.alvo ? 'Indo para ' + e.alvo : 'Tropas em marcha';
    return (RP.ORDENS_NOMES[e.ordem] || e.ordem) + (e.alvo ? ': ' + e.alvo : '');
  };
  RP.estadoExercito = function (e) {
    var onde = e.destinoC + ', ' + e.destinoL;
    if (e.estado === 'parado') return 'parado no hexágono ' + onde;
    return (e.estado === 'retornando' ? 'volta' : 'chega') + ' ' + RP.fmtHora(e.chegada) + ' · destino ' + onde;
  };
  RP.exercito = function (id) { return RP.tropas && RP.tropas.exercitos.filter(function (e) { return e.id === id; })[0]; };

  RP.folhaExercito = function (id) {
    var abrir = function () {
      var e = RP.exercito(id);
      if (!e) { RP.aviso({ titulo: 'Este exército não está mais em campo', icone: 'info' }); return; }
      var carga = Object.keys(e.carga || {});
      var corpo = '<div class="info">' +
        '<div class="info-linha"><span class="fraco">Tropas</span><span>' + RP.selosGrupo(e.tropas) + '</span></div>' +
        '<div class="info-linha"><span class="fraco">Ordem</span><span>' + RP.esc(RP.ORDENS_NOMES[e.ordem] || e.ordem) + '</span></div>' +
        '<div class="info-linha"><span class="fraco">' + (e.estado === 'parado' ? 'Onde' : 'Chegada') + '</span><span>' + (e.estado === 'parado' ? 'hexágono ' + e.destinoC + ', ' + e.destinoL : '<b class="num" data-fim="' + e.chegada + '">' + RP.fmtResta(e.chegada - RP.agora()) + '</b>') + '</span></div>' +
        '<div class="info-linha"><span class="fraco">Saíram de</span><span>' + RP.esc(e.origem || '—') + '</span></div>' +
        '<div class="info-linha"><span class="fraco">Carga</span><span>' + (carga.length ? RP.custoHTML(e.carga) : 'vazia') + ' <small class="fraco">até ' + RP.num(e.cargaMax) + '</small></span></div>' +
        '<div class="info-linha"><span class="fraco">Velocidade</span><span>' + RP.esc(e.vel) + (e.seguro ? ' · rota segura' : ' · rota curta') + '</span></div>' +
        '<div class="info-linha"><span class="fraco">Postura</span><span class="selo selo-info">' + RP.esc(RP.POSTURAS[e.postura] || '') + '</span></div>' +
        '</div>';
      RP.abrirFolha({
        titulo: RP.esc(RP.tituloExercito(e)), veu: true,
        subtitulo: '<span class="fraco">' + RP.esc(e.resumo) + '</span>',
        icone: '<span class="ico-placa folha-ico dono-meu">' + RP.icone('tropas') + '</span>',
        corpo: corpo,
        acoes: (e.estado !== 'retornando' ? '<button type="button" class="btn btn-p btn-primario" data-exercito-voltar="' + e.id + '">' + RP.icone('voltar') + 'Voltar</button>' : '') +
          '<button type="button" class="btn btn-p" data-exercito-mover="' + e.id + '">' + RP.icone('seta') + 'Mover</button>' +
          '<a class="btn btn-p" href="#/posturas?marcha=' + e.id + '">' + RP.icone('escudo') + 'Postura</a>' +
          '<a class="btn btn-p" href="#/mapa?foco=' + e.hex + '">' + RP.icone('mapa') + 'Ver no mapa</a>'
      });
    };
    if (RP.exercito(id)) abrir(); else RP.carregarTropas().then(abrir, function () { /* aviso já mostrado */ });
  };

  RP.voltarExercito = function (id) {
    return RP.tentar(RP.post('/tropas/' + id + '/ordem', { ordem: 'retornar' })).then(function (e) {
      RP.fecharFolha();
      RP.aviso({ titulo: 'Retorno ordenado', texto: e && e.chegada ? 'Chegam ' + RP.fmtHora(e.chegada) + '.' : 'As tropas voltaram.', icone: 'voltar', tipo: 'sucesso' });
      RP.recarregarTropas(); RP.recarregarReino();
      if (RP.mapa && RP.mapa.recarregar && document.documentElement.getAttribute('data-tela') === 'mapa') RP.mapa.recarregar();
    });
  };
  document.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-exercito-voltar]'))) RP.voltarExercito(+b.getAttribute('data-exercito-voltar'));
    else if ((b = e.target.closest('[data-exercito-mover]'))) { RP.fecharFolha(); RP.ir('mapa?mover=' + b.getAttribute('data-exercito-mover')); }
    else if ((b = e.target.closest('[data-exercito]'))) RP.folhaExercito(+b.getAttribute('data-exercito'));
  });

  /* na folha do local: enviar as tropas paradas lá */
  RP.acoesFolhaLocal = RP.acoesFolhaLocal || [];
  RP.acoesFolhaLocal.push(function (l) {
    return RP.somaGrupo(l.guarnicao) ? '<a class="btn btn-p" href="#/mapa?enviar=' + l.id + '">' + RP.icone('tropas') + 'Enviar tropas</a>' : '';
  });
  RP.acoesFolhaLocal.push(function (l) {
    return l.recruta ? '<a class="btn btn-p" href="#/recrutamento?local=' + l.id + '">' + RP.icone('tropas') + 'Recrutar</a>' : '';
  });

  /* ---------------------------------------------------------------- Tropas (hub) */
  /* outros sistemas acrescentam cartões de ação: { href, icone, titulo, texto } */
  RP.acoesTropas = RP.acoesTropas || [];
  /* e blocos acima da lista (feridos, batalha...): function (tropas) { return html; } */
  RP.extrasTropas = RP.extrasTropas || [];

  function emCampoHTML(t) {
    if (!t.exercitos.length) return '<p class="fraco">Nenhuma tropa fora dos locais.</p>';
    return t.exercitos.map(function (e) {
      return '<div class="card emcampo exercito-card"><button type="button" class="emcampo-abrir" data-exercito="' + e.id + '" aria-label="Detalhes: ' + RP.esc(RP.tituloExercito(e)) + '"></button>' +
        '<span class="ico-placa dono-meu">' + RP.icone('tropas') + '</span>' +
        '<span class="emcampo-corpo"><b>' + RP.esc(RP.tituloExercito(e)) + '</b><small class="fraco">' + RP.esc(e.resumo) + '</small>' +
        '<small class="fraco">' + RP.esc(RP.estadoExercito(e)) + '</small>' +
        '<span class="exercito-acoes">' +
        (e.estado !== 'retornando' ? '<button type="button" class="btn btn-p" data-exercito-voltar="' + e.id + '">' + RP.icone('voltar') + 'Voltar</button>' : '') +
        '<button type="button" class="btn btn-p" data-exercito-mover="' + e.id + '">' + RP.icone('seta') + 'Mover</button></span></span>' +
        '<span class="emcampo-tempo">' + (e.estado === 'parado' ? '<span class="selo">Parado</span>' : '<b class="num" data-fim="' + e.chegada + '">' + RP.fmtResta(e.chegada - RP.agora()) + '</b><small class="fraco">' + (e.estado === 'retornando' ? 'volta' : 'chega') + '</small>') + '</span></div>';
    }).join('');
  }
  function guarnicoesHTML(t) {
    var com = t.locais.filter(function (l) { return RP.somaGrupo(l.guarnicao) > 0; }), sem = t.locais.filter(function (l) { return !RP.somaGrupo(l.guarnicao); });
    return (com.length ? com.map(function (l) {
      return '<div class="card pilha guarnicao-card"><div class="linha-entre"><span class="linha">' + RP.icone(RP.iconeLocal(l)) + '<b>' + RP.esc(l.nome) + '</b></span>' +
        '<span class="selo selo-info">' + RP.icone('escudo', 'ico-p') + RP.esc(RP.POSTURAS[l.postura] || '') + '</span></div>' +
        RP.selosGrupo(l.guarnicao) +
        '<div class="linha"><a class="btn btn-p" href="#/mapa?enviar=' + l.id + '">' + RP.icone('tropas') + 'Enviar tropas</a>' +
        (l.recruta ? '<a class="btn btn-p btn-fantasma" href="#/recrutamento?local=' + l.id + '">' + RP.icone('mais') + 'Recrutar</a>' : '') + '</div></div>';
    }).join('') : '<p class="fraco">Nenhuma tropa nas guarnições. A população defende cada local como milícia.</p>') +
      (sem.length ? '<p class="fraco guarnicao-sem">Sem tropas: ' + sem.map(function (l) { return RP.esc(l.nome); }).join(', ') + '.</p>' : '');
  }
  function treinoHTML(t) {
    var f = (RP.reino && RP.reino.filas && RP.reino.filas.recrutamento) || [];
    return '<div class="card pilha"><div class="card-titulo" style="margin:0">' + RP.icone('tropas') + '<h3>Recrutamento</h3><span class="selo">' + f.length + ' de 10</span></div>' +
      (f.length ? f.map(function (i) { i.fila = 'recrutamento'; return RP.itemFilaServidor(i); }).join('') : '<p class="fraco">Nada sendo recrutado.</p>') + '</div>';
  }
  function desenharTropas(el) {
    var t = RP.tropas, r = RP.reino;
    if (!t || !r) { RP.$('.tropas-conteudo', el).innerHTML = '<p class="fraco">Carregando…</p>'; return; }
    var acoes = [['recrutamento', 'tropas', 'Recrutar', 'Milícia, lanceiro e arqueiro no castelo; todas no quartel'],
      ['mapa?enviar=' + (primeiroComTropas(t) || r.casteloId), 'alvo', 'Enviar tropas', 'Toque no destino no mapa: mover ou reforçar'],
      ['posturas', 'escudo', 'Posturas', 'Como cada tropa reage sem você']]
      .map(function (a) { return { href: '#/' + a[0], icone: a[1], titulo: a[2], texto: a[3] }; }).concat(RP.acoesTropas);
    RP.$('.tropas-conteudo', el).innerHTML =
      RP.extrasTropas.map(function (f) { return f(t) || ''; }).join('') +
      '<div class="card pop-mini"><div class="linha-entre"><span class="linha">' + RP.icone('populacao', 'r-populacao') + '<b class="num" data-pop>' + RP.num(r.pop) + '</b><span class="fraco">civis livres</span></span>' +
      '<span class="fraco">' + RP.num(t.ocupando) + ' tropas · teto ' + RP.num(t.teto) + '</span></div>' +
      '<p class="fraco" style="font-size:var(--fs-2);margin-top:6px">Tropas moram no reino: em guarnição, em campo ou em treino, ocupam o teto. Cada soldado é um trabalhador a menos.</p></div>' +
      '<div class="secao-titulo">Em campo</div><div class="pilha">' + emCampoHTML(t) + '</div>' +
      '<div class="secao-titulo">Em treino</div>' + treinoHTML(t) +
      '<div class="secao-titulo">Guarnições</div><div class="pilha">' + guarnicoesHTML(t) + '</div>' +
      '<div class="secao-titulo">Ordens</div><div class="grade-acoes">' + acoes.map(function (a) {
        return '<a class="card acao-card" href="' + a.href + '"><span class="ico-placa ico-placa-g">' + RP.icone(a.icone) + '</span><b>' + RP.esc(a.titulo) + '</b><small class="fraco">' + RP.esc(a.texto || '') + '</small></a>';
      }).join('') + '</div><div style="height:var(--esp-6)"></div>';
  }
  function primeiroComTropas(t) {
    var c = t.locais.filter(function (l) { return RP.somaGrupo(l.guarnicao) > 0; });
    var castelo = c.filter(function (l) { return l.tipo === 'castelo'; })[0];
    return (castelo || c[0] || {}).id;
  }

  RP.registrarTela('tropas', {
    nav: true,
    montar: function (el) {
      el.innerHTML = '<header class="topo"><h1>Tropas</h1><button type="button" class="btn btn-fantasma btn-icone btn-sino-topo" data-abrir-notificacoes aria-label="Notificações">' + RP.icone('sino') + '<span class="contador"' + (RP.naoLidas ? '' : ' hidden') + '>' + RP.naoLidas + '</span></button></header>' +
        '<div class="conteudo-tela tropas-conteudo"></div>';
      var vivo = function () { if (!el.hidden) desenharTropas(el); };
      document.addEventListener('rp:tropas', vivo);
      document.addEventListener('rp:reino', vivo);
    },
    entrar: function (el) { desenharTropas(el); RP.carregarTropas().catch(function () { /* aviso já mostrado */ }); }
  });

  /* ---------------------------------------------------------------- Posturas */
  function seletorPostura(alvo, atual) {
    return '<div class="abas abas-postura" role="radiogroup" aria-label="Postura">' + RP.POSTURAS_INFO.map(function (p) {
      return '<button type="button" class="aba" role="radio" data-postura="' + alvo + '" data-valor="' + p.id + '" aria-checked="' + (atual === p.id) + '" aria-label="' + RP.esc(RP.POSTURAS[p.id]) + '">' + p.curto + '</button>';
    }).join('') + '</div>';
  }
  function desenharPosturas(el, foco) {
    var t = RP.tropas;
    if (!t) { RP.$('.post-conteudo', el).innerHTML = '<p class="fraco">Carregando…</p>'; return; }
    RP.$('.post-conteudo', el).innerHTML =
      '<div class="pilha">' + RP.POSTURAS_INFO.map(function (p) { return '<div class="postura-exp">' + RP.icone(p.icone) + '<span><b>' + RP.esc(RP.POSTURAS[p.id]) + '</b><br><small class="fraco">' + p.txt + '</small></span></div>'; }).join('') + '</div>' +
      '<p class="fraco" style="font-size:var(--fs-2);margin-top:var(--esp-2)">A postura vale com você offline. A população sempre defende o próprio local como milícia. Padrão: guarnições só defendem; exércitos em campo atacam apenas quem atacar.</p>' +
      '<div class="secao-titulo">Guarnições</div>' +
      '<div class="card linha-entre aplicar-todos"><span><b>Aplicar a todas</b><br><small class="fraco">Muda todas as guarnições de uma vez</small></span>' + seletorPostura('*', null) + '</div>' +
      '<div class="pilha" style="margin-top:var(--esp-3)">' + t.locais.map(function (l) {
        return '<div class="card postura-item' + (foco === 'l' + l.id ? ' foco' : '') + '" id="post-l' + l.id + '"><div class="linha"><span class="ico-placa dono-meu">' + RP.icone(RP.iconeLocal(l)) + '</span><span style="flex:1;min-width:0"><b>' + RP.esc(l.nome) + '</b><br><small class="fraco">' + (RP.somaGrupo(l.guarnicao) ? RP.esc(RP.partesGrupo(l.guarnicao)) : 'sem tropas, só a milícia') + '</small></span></div>' + seletorPostura('l' + l.id, l.postura) + '</div>';
      }).join('') + '</div>' +
      '<div class="secao-titulo">Exércitos em campo</div>' + (t.exercitos.length ?
        (t.exercitos.length > 1 ? '<div class="card linha-entre aplicar-todos"><span><b>Aplicar a todos</b><br><small class="fraco">Muda todos os exércitos em campo</small></span>' + seletorPostura('*m', null) + '</div>' : '') +
        '<div class="pilha" style="margin-top:var(--esp-3)">' + t.exercitos.map(function (e) {
          return '<div class="card postura-item' + (foco === 'm' + e.id ? ' foco' : '') + '" id="post-m' + e.id + '"><div class="linha"><span class="ico-placa dono-meu">' + RP.icone('tropas') + '</span><span style="flex:1;min-width:0"><b>' + RP.esc(RP.tituloExercito(e)) + '</b><br><small class="fraco">' + RP.esc(e.resumo) + '</small></span></div>' + seletorPostura('m' + e.id, e.postura) + '</div>';
        }).join('') + '</div>' : '<p class="fraco">Nenhum exército em campo.</p>') + '<div style="height:var(--esp-8)"></div>';
    if (foco) setTimeout(function () { var f = document.getElementById('post-' + foco); if (f) f.scrollIntoView({ block: 'center' }); }, 50);
  }
  RP.registrarTela('posturas', {
    secao: 'tropas',
    montar: function (el) {
      el.innerHTML = RP.topoVoltar('Posturas', 'tropas', 'Como cada tropa reage sem você') + '<div class="conteudo-tela post-conteudo"></div>';
      document.addEventListener('rp:tropas', function () { if (!el.hidden) desenharPosturas(el); });
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-postura]');
        if (!b) return;
        var alvo = b.getAttribute('data-postura'), v = b.getAttribute('data-valor'), corpo = { postura: v };
        if (alvo === '*') corpo.todas = true;
        else if (alvo === '*m') corpo.todosExercitos = true;
        else if (alvo[0] === 'm') corpo.marchaId = +alvo.slice(1);
        else corpo.localId = +alvo.slice(1);
        RP.tentar(RP.put('/tropas/postura', corpo)).then(function () {
          RP.aviso({ titulo: 'Postura salva', texto: (alvo === '*' ? 'Todas as guarnições' : alvo === '*m' ? 'Todos os exércitos' : 'Agora') + ': ' + RP.POSTURAS[v].toLowerCase() + '.', icone: 'escudo', tipo: 'sucesso', ms: 1800 });
          RP.carregarTropas(); RP.recarregarReino();
        });
      });
    },
    entrar: function (el, p) {
      var foco = p.get('local') ? 'l' + p.get('local') : p.get('marcha') ? 'm' + p.get('marcha') : null;
      desenharPosturas(el, foco);
      RP.carregarTropas().then(function () { desenharPosturas(el, foco); }, function () { /* aviso já mostrado */ });
    }
  });
})();
