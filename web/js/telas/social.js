/* Reino de Pedra — social: peças comuns de Aliança, Comércio e Mensagens; Bandeiras (#/bandeiras, #/bandeira-nova?alvo=c,l);
   mensageiros, cargas entre reinos e bandeiras no mapa; reforço a aliado e derrubar bandeira pelo envio de tropas;
   entradas em Mais. Porte de prototipo/js/social.js (bandeiras). */
(function () {
  'use strict';
  var RP = window.RP, H = RP.hex;
  var S = RP.social = RP.social || {};

  /* ---------------------------------------------------------------- peças comuns */
  S.RECURSOS = RP.ORDEM_REC.concat(RP.VALIOSOS);
  S.cargaTxt = function (c) {
    return Object.keys(c || {}).filter(function (k) { return c[k] > 0; }).map(function (k) { return RP.num(c[k]) + ' ' + RP.nomeRecurso(k); }).join(', ') || '—';
  };
  S.cargaHTML = function (c) {
    var ks = Object.keys(c || {}).filter(function (k) { return c[k] > 0; });
    return ks.length ? '<span class="custos">' + ks.map(function (k) { return '<span class="custo">' + RP.icone(k, 'ico-p r-' + k) + RP.num(c[k]) + '</span>'; }).join('') + '</span>' : '<span class="fraco">nada</span>';
  };
  S.valor = function (c) {
    var v = (RP.config && RP.config.valor) || {};
    return Object.keys(c || {}).reduce(function (s, k) { return s + (c[k] || 0) * (v[k] || 1); }, 0);
  };
  S.brasao = function (id, t) { return id ? RP.iconeReino(id, t || 32) : RP.brasao(null, { tamanho: t || 32, desconhecido: true }); };
  S.nome = function (id) { return id ? id.nome : 'Sem dono'; };
  S.recadoHTML = function (t) { return t ? '<p class="msg-texto">“' + RP.esc(t) + '”</p>' : ''; };
  S.campoRecado = function (id, valor, max) {
    return '<div class="campo" style="margin-top:var(--esp-3)"><label for="' + id + '">Recado (opcional)</label><input id="' + id + '" type="text" maxlength="' + max + '" value="' + RP.esc(valor || '') + '" placeholder="Ex.: Entrega pela Estrada do Rei." autocomplete="off">' +
      '<span class="campo-ajuda">Até ' + max + ' caracteres. Vai junto com a proposta.</span></div>';
  };
  /* stepper simples de quantidade: data-q="<chave>:<passo>" */
  S.stepper = function (chave, q, passo, min) {
    return '<span class="stepper"><button type="button" class="btn btn-icone" data-q="' + chave + ':-' + passo + '" aria-label="Menos"' + (q - passo < (min || 0) ? ' disabled' : '') + '>' + RP.icone('menos') + '</button>' +
      '<output class="num">' + RP.num(q) + '</output><button type="button" class="btn btn-icone" data-q="' + chave + ':' + passo + '" aria-label="Mais">' + RP.icone('mais') + '</button></span>';
  };
  S.passo = function (k) { var v = ((RP.config && RP.config.valor) || {})[k] || 1; return v >= 10 ? 5 : 100; };
  S.chipsRecurso = function (attr, sel, lista) {
    return '<div class="obj-add-lista">' + (lista || S.RECURSOS).map(function (k) {
      return '<button type="button" class="btn btn-p chip-sel" ' + attr + '="' + k + '" aria-pressed="' + (sel === k) + '">' + RP.icone(k, 'ico-p r-' + k) + RP.esc(RP.nomeRecurso(k)) + '</button>';
    }).join('') + '</div>';
  };
  S.linha = function (r, v) { return '<div class="info-linha"><span class="fraco">' + r + '</span><span>' + v + '</span></div>'; };
  S.vazio = function (t) { return '<p class="fraco">' + t + '</p>'; };
  /* recarrega a tela se ela está à vista */
  S.redesenhar = function (nome, f) {
    var el = RP.$('[data-tela="' + nome + '"]');
    if (el && !el.hidden && document.documentElement.getAttribute('data-tela') === nome) f(el);
  };

  /* ---------------------------------------------------------------- avisos em tempo real */
  ['alianca', 'comercio', 'mensagem'].forEach(function (t) { RP.ouvir(t, function () { RP.recarregarReino(); document.dispatchEvent(new CustomEvent('rp:social', { detail: t })); }); });

  /* ---------------------------------------------------------------- entradas em Mais, Reino e Tropas */
  RP.itensMais = RP.itensMais || [];
  RP.itensMais.push(
    { icone: 'troca', titulo: 'Comércio e diplomacia', texto: 'Trocas, pactos e resgates', href: '#/comercio' },
    { icone: 'mensagem', titulo: 'Mensagens', texto: 'Mensageiros para outros reinos', href: '#/mensagens' },
    { icone: 'bandeira', titulo: 'Bandeiras', texto: 'Sinais para outros jogadores', href: '#/bandeiras' }
  );
  RP.extrasReino = RP.extrasReino || [];
  RP.extrasReino.push(function (r) {
    var s = r.social; if (!s) return '';
    var itens = [];
    if (s.convites) itens.push(['#/alianca', 'estandarte', s.convites > 1 ? s.convites + ' convites para aliança' : 'Convite para aliança', 'Aceite ou recuse em Aliança.']);
    if (s.pedidosEntrada) itens.push(['#/alianca', 'estandarte', s.pedidosEntrada + (s.pedidosEntrada > 1 ? ' pedidos de entrada' : ' pedido de entrada'), 'Reinos querem entrar na aliança.']);
    if (s.pedidosRecursos) itens.push(['#/alianca', 'carroca', 'Aliado pede recursos', 'Envie ou recuse em Aliança.']);
    if (s.propostas) itens.push(['#/comercio', 'troca', s.propostas + (s.propostas > 1 ? ' propostas' : ' proposta') + ' de outros reinos', 'Trocas e pactos esperando resposta.']);
    if (s.resgates) itens.push(['#/comercio', 'explorador', 'Resgate pedido', 'Seu explorador foi capturado. Pague ou deixe.']);
    if (s.mensagensNovas) itens.push(['#/mensagens', 'mensagem', s.mensagensNovas + (s.mensagensNovas > 1 ? ' mensagens novas' : ' mensagem nova'), 'Chegou por mensageiro.']);
    return itens.map(function (i) {
      return '<a class="card linha" href="' + i[0] + '"><span class="ico-placa">' + RP.icone(i[1]) + '</span><span style="flex:1;min-width:0"><b>' + RP.esc(i[2]) + '</b><br><small class="fraco">' + RP.esc(i[3]) + '</small></span>' + RP.icone('avancar', 'ico-p') + '</a>';
    }).join('');
  });
  RP.extrasFolhaLocal = RP.extrasFolhaLocal || [];
  RP.extrasFolhaLocal.push(function (l) {
    return (l.reforcosAliados || []).map(function (e) {
      return '<div class="card linha">' + S.brasao(e.reino, 28) + '<span style="flex:1;min-width:0"><b>Reforço de ' + RP.esc(S.nome(e.reino)) + '</b><br><small class="fraco">' +
        RP.esc(RP.partesGrupo ? RP.partesGrupo(e.tropas) : '') + ' · defendem aqui, mas são do aliado</small></span><span class="selo selo-aliado">' + RP.icone('estandarte') + 'Aliado</span></div>';
    }).join('');
  });

  /* ---------------------------------------------------------------- mapa: marchas, bandeiras e ações */
  RP.NOMES_MARCHA = RP.NOMES_MARCHA || {};
  RP.NOMES_MARCHA.mensageiro = 'Mensageiro';
  RP.NOMES_MARCHA.remessa = 'Carga';
  RP.mapa.tiposMarcha.mensageiro = RP.mapa.tiposMarcha.mensageiro || { nome: 'Mensageiro', icone: 'mensagem' };
  /* carga entre reinos: carregadores a pé, com sacos e toras */
  RP.mapa.tiposMarcha.remessa = RP.mapa.tiposMarcha.remessa || {
    nome: 'Carga', icone: 'carroca',
    desenharCena: function (c, o, info) {
      var A = info.A, P = info.pal, ux = Math.cos(info.ang), uy = Math.sin(info.ang);
      for (var k = 2; k >= 0; k--) {
        var lado = ((k % 2) * 2 - 1) * 3;
        c.save(); c.translate(-ux * k * 8 - uy * lado, (-uy * k * 8 + ux * lado) * A.K);
        A.pessoa(c, 0, 0, info.t, P, { roupa: P.roupa[k % 5], dir: info.dir, andando: true, fase: k * 0.9, carga: k === 1 ? 'tronco' : 'saco' });
        c.restore();
      }
    }
  };
  RP.TIPOS_BANDEIRA = { reivindicacao: 'Reivindicação', ameaca: 'Ameaça', alianca: 'Aliança', aviso: 'Aviso' };

  var tb = RP.mapa.tiposObjeto.bandeira;
  if (tb) {
    tb.nome = function (o) { return o.dono === 'meu' ? 'Sua bandeira' : 'Bandeira de ' + (o.autor && o.autor.nome ? o.autor.nome : '?'); };
    tb.folha = function (o) {
      return S.linha('Tipo', RP.esc(RP.TIPOS_BANDEIRA[o.tipoBandeira] || 'Aviso')) +
        S.linha('Quem colocou', o.dono === 'meu' ? 'Você' : RP.esc(S.nome(o.autor))) +
        (o.recado ? '<p class="bandeira-texto">“' + RP.esc(o.recado) + '”</p>' : '');
    };
    tb.acoes = function (o) {
      if (o.dono === 'meu') return '<button type="button" class="btn btn-p btn-fantasma" data-remover-bandeira="' + o.id + '">' + RP.icone('fechar') + 'Remover</button>';
      return '<button type="button" class="btn btn-p" data-derrubar-bandeira="' + o.id + '" data-hex="' + o.hex + '">' + RP.icone('tropas') + 'Derrubar</button>';
    };
  }
  function objs(h, d) { return (d && d.porHex && d.porHex[h]) || []; }
  function localEm(h, d) { return objs(h, d).filter(function (o) { return o.tipo === 'local'; })[0]; }
  function bandeirasAlheias(h, d) { return objs(h, d).filter(function (o) { return o.tipo === 'bandeira' && o.dono !== 'meu'; }); }

  RP.mapa.extrasFolhaHex.push(function (h, d) {
    var l = localEm(h, d);
    if (l && l.dono === 'aliado' && l.reino) return S.linha('Aliado', '<span class="linha">' + S.brasao(l.reino, 20) + RP.esc(l.reino.nome) + '</span>');
    return '';
  });
  RP.mapa.acoesFolhaHex.push(function (h, d) {
    if (RP.envio && RP.envio.ativo()) return '';
    var e = RP.mapaModelo.estado(h), html = '', l = localEm(h, d);
    if (l && l.dono === 'aliado' && l.reino) html += '<a class="btn btn-p" href="#/pedido?reino=' + l.reino.id + '">' + RP.icone('carroca') + 'Pedir recursos</a>';
    if (l && (l.dono === 'aliado' || l.dono === 'outro') && l.reino && !l.ruina) html += '<a class="btn btn-p btn-fantasma" href="#/mensagem?para=' + l.reino.id + '">' + RP.icone('mensagem') + 'Mensageiro</a>';
    var minha = objs(h, d).some(function (o) { return o.tipo === 'bandeira' && o.dono === 'meu'; });
    if (!e.nunca && !minha) html += '<a class="btn btn-p btn-fantasma" href="#/bandeira-nova?alvo=' + H.c(h) + ',' + H.l(h) + '">' + RP.icone('bandeira') + 'Bandeira</a>';
    return html;
  });

  /* envio de tropas: reforçar local de aliado e derrubar bandeira alheia */
  RP.ordensEnvio = RP.ordensEnvio || [];
  RP.ordensEnvio.push({
    ordem: 'reforcar', rotulo: 'Reforçar aliado', verbo: 'Reforçar', icone: 'escudo', titulo: 'Reforçar',
    quando: function (h, d) { var l = localEm(h, d); return !!l && l.dono === 'aliado' && !l.ruina; },
    descricao: function (h, d) {
      var l = localEm(h, d);
      return S.linha('Ordem', 'Entram na defesa do local de ' + RP.esc(S.nome(l && l.reino))) + S.linha('Teto', 'Continuam ocupando a sua população') + S.linha('Volta', 'Só por ordem sua (em Tropas)');
    }
  });
  RP.ordensEnvio.push({
    ordem: 'derrubar-bandeira', rotulo: 'Derrubar bandeira', verbo: 'Derrubar', icone: 'bandeira', titulo: 'Derrubar bandeira',
    quando: function (h, d) { return bandeirasAlheias(h, d).length > 0; },
    descricao: function (h, d) {
      var b = bandeirasAlheias(h, d)[0];
      return S.linha('Bandeira', RP.esc(b ? '“' + b.recado + '”' : '')) + S.linha('Aviso', 'O dono é avisado de quem foi') + S.linha('Depois', 'As tropas voltam');
    },
    dados: function (h, d) { var b = bandeirasAlheias(h, d)[0]; return b ? { bandeira: b.id } : {}; }
  });

  /* tropas: reforços seus em locais de aliados, com a ordem de volta */
  RP.extrasTropas = RP.extrasTropas || [];
  var meusReforcos = [];
  function carregarReforcos() {
    RP.get('/alianca').then(function (d) {
      meusReforcos = d.reforcos.meus;
      var box = RP.$('[data-reforcos-aliados]'); if (box) box.outerHTML = htmlReforcos();
    }).catch(function () { /* offline */ });
  }
  function htmlReforcos() {
    if (!meusReforcos.length) return '<div data-reforcos-aliados hidden></div>';
    return '<div data-reforcos-aliados><div class="secao-titulo">Reforço em aliados</div><div class="pilha">' + meusReforcos.map(function (e) {
      return '<div class="card linha">' + S.brasao(e.aliado, 28) + '<span style="flex:1;min-width:0"><b>' + RP.esc(e.local) + '</b><br><small class="fraco">' + RP.esc(RP.partesGrupo(e.tropas)) + ' · de ' + RP.esc(S.nome(e.aliado)) + '</small></span>' +
        '<button type="button" class="btn btn-p" data-reforco-volta="' + e.localId + '">' + RP.icone('voltar') + 'Voltar</button></div>';
    }).join('') + '</div></div>';
  }
  RP.extrasTropas.push(function () { setTimeout(carregarReforcos, 0); return htmlReforcos(); });

  /* ---------------------------------------------------------------- cliques comuns (mapa e telas) */
  document.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-reforco-volta]'))) {
      RP.tentar(RP.post('/alianca/reforcos/' + b.getAttribute('data-reforco-volta') + '/retornar')).then(function () {
        RP.aviso({ titulo: 'Reforço voltando', texto: 'As tropas saem do local do aliado.', icone: 'voltar', tipo: 'sucesso' });
        carregarReforcos(); RP.recarregarReino(); if (RP.carregarTropas) RP.carregarTropas().catch(function () { /* offline */ });
      }).catch(function () { /* aviso já mostrado */ });
    } else if ((b = e.target.closest('[data-remover-bandeira]'))) {
      RP.tentar(RP.del('/bandeiras/' + b.getAttribute('data-remover-bandeira'))).then(function () {
        RP.fecharFolha();
        RP.aviso({ titulo: 'Bandeira removida', icone: 'bandeira', tipo: 'sucesso', ms: 1800 });
        if (RP.mapaModelo) RP.mapaModelo.carregar().catch(function () { /* offline */ });
        S.redesenhar('bandeiras', desenharBandeiras);
      }).catch(function () { /* aviso já mostrado */ });
    } else if ((b = e.target.closest('[data-derrubar-bandeira]'))) {
      var hex = +b.getAttribute('data-hex');
      RP.fecharFolha();
      RP.modal({
        titulo: 'Derrubar esta bandeira?',
        corpo: '<p class="suave">Escolha as tropas e clique na bandeira: elas vão até lá, derrubam e voltam. O dono é avisado de quem foi.</p>',
        acoes: [{ rotulo: RP.icone('tropas') + 'Escolher tropas', classe: 'btn-primario', acao: function () {
          RP.ir('mapa?centro=' + hex);
          setTimeout(function () { if (RP.envio) RP.envio.iniciar({}); }, 80);
        } }, { rotulo: 'Cancelar' }]
      });
    }
  });

  /* ================================================================ Bandeiras */
  var TIPOS_B = [
    { id: 'reivindicacao', icone: 'coroa', txt: 'Diz que o lugar é seu ou será.' },
    { id: 'ameaca', icone: 'tropas', txt: 'Avisa que quem passar será atacado.' },
    { id: 'alianca', icone: 'escudo', txt: 'Convida vizinhos para um acordo.' },
    { id: 'aviso', icone: 'info', txt: 'Qualquer recado: rota, perigo, combinado.' }
  ];
  var dadosB = null;
  function itemBandeira(b, minha) {
    return '<div class="card band-item"><div class="linha">' + (minha ? RP.iconeReino(RP.reino, 30) : S.brasao(b.autor, 30)) +
      '<span style="flex:1;min-width:0"><b>“' + RP.esc(b.recado) + '”</b><br><small class="fraco">' + RP.esc(RP.TIPOS_BANDEIRA[b.tipo] || 'Aviso') + ' · ' + (minha ? 'você' : RP.esc(S.nome(b.autor))) + ' · ' + b.c + ', ' + b.l + '</small></span></div>' +
      '<div class="linha band-acoes"><a class="btn btn-p" href="#/mapa?foco=' + b.hex + '">' + RP.icone('mapa') + 'Ver</a>' +
      (minha ? '<button type="button" class="btn btn-p btn-fantasma" data-remover-bandeira="' + b.id + '">' + RP.icone('fechar') + 'Remover</button>'
        : '<button type="button" class="btn btn-p" data-derrubar-bandeira="' + b.id + '" data-hex="' + b.hex + '">' + RP.icone('tropas') + 'Derrubar</button>') + '</div></div>';
  }
  function desenharBandeiras(el) {
    RP.get('/bandeiras').then(function (d) {
      dadosB = d;
      RP.$('.band-conteudo', el).innerHTML =
        '<div class="secao-titulo" style="margin-top:0">Suas bandeiras · ' + d.minhas.length + ' de ' + d.max + '</div><div class="pilha">' + (d.minhas.length ? d.minhas.map(function (b) { return itemBandeira(b, true); }).join('') : S.vazio('Nenhuma bandeira colocada. Clique num hexágono do mapa e escolha Bandeira.')) + '</div>' +
        '<div class="secao-titulo">De outros reinos</div><div class="pilha">' + (d.vistas.length ? d.vistas.map(function (b) { return itemBandeira(b, false); }).join('') : S.vazio('Nenhuma bandeira de outro reino.')) + '</div>' +
        RP.comoFunciona('<p>Bandeiras são sinais para outros jogadores: valor social, sem efeito no jogo. <b>Sempre mostram quem as colocou.</b></p><p>Qualquer jogador pode derrubá-las com tropas no local; você é avisado de quem foi.</p>') + '<div style="height:120px"></div>';
    }).catch(function (e) { RP.$('.band-conteudo', el).innerHTML = S.vazio(RP.esc(e.message)); });
  }
  RP.registrarTela('bandeiras', {
    secao: 'mais',
    montar: function (el) {
      el.innerHTML = RP.topoVoltar('Bandeiras', 'mais', 'Sinais para outros jogadores') + '<div class="conteudo-tela band-conteudo"></div>' +
        '<div class="rodape-acao"><a class="btn btn-primario btn-bloco btn-grande" href="#/bandeira-nova">' + RP.icone('bandeira') + 'Colocar bandeira</a></div>';
    },
    entrar: function (el) { desenharBandeiras(el); }
  });

  var nova = { alvo: null, tipo: 'aviso', texto: '' };
  function flagSVG(tam) {
    return '<svg viewBox="0 0 40 52" width="' + tam + '" height="' + Math.round(tam * 1.3) + '" aria-hidden="true"><path d="M8 50V4" class="bn-mastro"/>' +
      '<path d="M8 5h26l-6 8 6 8H8z" class="bn-pano"/><circle cx="8" cy="3.5" r="3" class="bn-topo"/></svg>';
  }
  function desenharNova(el) {
    var max = (dadosB && dadosB.caracteres) || 60, min = (dadosB && dadosB.minimo) || 3;
    var a = nova.alvo, h = a ? H.idx(a[0], a[1]) : null, e = h != null && RP.mapaModelo ? RP.mapaModelo.estado(h) : { nunca: true };
    var ter = h != null && RP.mapaModelo ? RP.mapaModelo.terreno(h) : null;
    var lugar = a ? (ter ? ({ planicie: 'Planície', floresta: 'Floresta', colina: 'Colina', montanha: 'Montanha', pantano: 'Pântano' }[ter] || 'Terreno') : 'Lugar explorado') + ' · ' + a[0] + ', ' + a[1] : 'Escolha no mapa';
    var n = nova.texto.trim().length;
    RP.$('.bn-conteudo', el).innerHTML =
      '<div class="secao-titulo" style="margin-top:0">Onde</div><div class="card linha destino-card"><span class="ico-placa">' + RP.icone(a ? 'alvo' : 'mapa') + '</span><div style="flex:1"><b>' + RP.esc(lugar) + '</b><br><small class="fraco">' +
      (e.nunca && a ? 'Só em lugar que o seu reino já explorou.' : 'Em qualquer hexágono que você já explorou.') + '</small></div><a class="btn btn-p" href="#/mapa">' + RP.icone('mapa') + 'Trocar</a></div>' +
      '<div class="secao-titulo">Tipo</div><div class="escolhas escolhas-linhas">' + TIPOS_B.map(function (tb2) {
        return '<button type="button" class="escolha escolha-linha" data-tipo-bandeira="' + tb2.id + '" aria-pressed="' + (nova.tipo === tb2.id) + '"><span class="ico-placa">' + RP.icone(tb2.icone) + '</span><span class="escolha-txt"><b>' + RP.TIPOS_BANDEIRA[tb2.id] + '</b><small class="fraco">' + tb2.txt + '</small></span></button>';
      }).join('') + '</div>' +
      '<div class="secao-titulo">Recado</div><div class="campo"><label for="texto-bandeira">Texto da bandeira</label><input id="texto-bandeira" type="text" maxlength="' + max + '" value="' + RP.esc(nova.texto) + '" placeholder="Ex.: Estrada do Rei: passagem livre." autocomplete="off"><span class="campo-ajuda"><span data-contador>' + n + '</span>/' + max + ' · todos verão seu brasão e nome</span></div>' +
      '<div class="card band-previa" style="margin-top:var(--esp-3)" aria-label="Prévia">' + flagSVG(40) + '<div><span class="rotulo">' + RP.TIPOS_BANDEIRA[nova.tipo] + '</span><b class="band-previa-texto">“' + RP.esc(nova.texto.trim() || 'Seu recado aqui') + '”</b><div class="linha" style="margin-top:6px">' + RP.iconeReino(RP.reino, 20) + '<small class="fraco">' + RP.esc(RP.reino ? RP.reino.nome : '') + '</small></div></div></div><div style="height:120px"></div>';
    RP.$('[data-colocar]', el).classList.toggle('btn-inativo', n < min || !a);
    var inp = RP.$('#texto-bandeira', el);
    inp.addEventListener('input', function () {
      nova.texto = inp.value;
      RP.$('[data-contador]', el).textContent = inp.value.trim().length;
      RP.$('.band-previa-texto', el).textContent = '“' + (inp.value.trim() || 'Seu recado aqui') + '”';
      RP.$('[data-colocar]', el).classList.toggle('btn-inativo', inp.value.trim().length < min || !nova.alvo);
    });
  }
  RP.registrarTela('bandeira-nova', {
    secao: 'mais',
    montar: function (el) {
      el.innerHTML = RP.topoVoltar('Colocar bandeira', 'bandeiras') + '<div class="conteudo-tela bn-conteudo"></div><div class="rodape-acao"><button type="button" class="btn btn-primario btn-bloco btn-grande" data-colocar>' + RP.icone('bandeira') + 'Colocar bandeira</button></div>';
      el.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-tipo-bandeira]'))) { nova.tipo = b.getAttribute('data-tipo-bandeira'); desenharNova(el); return; }
        if (e.target.closest('[data-colocar]')) {
          if (!nova.alvo) { RP.aviso({ titulo: 'Escolha o lugar', texto: 'Clique num hexágono do mapa e escolha Bandeira.', icone: 'mapa', tipo: 'alerta' }); return; }
          var min = (dadosB && dadosB.minimo) || 3;
          if (nova.texto.trim().length < min) { RP.aviso({ titulo: 'Escreva o recado', texto: 'Pelo menos ' + min + ' letras.', icone: 'info', tipo: 'alerta' }); RP.$('#texto-bandeira', el).focus(); return; }
          RP.tentar(RP.post('/bandeiras', { c: nova.alvo[0], l: nova.alvo[1], tipo: nova.tipo, recado: nova.texto.trim() })).then(function (x) {
            nova.texto = '';
            RP.aviso({ titulo: 'Bandeira colocada', texto: 'Todos a veem no mapa.', icone: 'bandeira', tipo: 'sucesso' });
            if (RP.mapaModelo) RP.mapaModelo.carregar().catch(function () { /* offline */ });
            RP.ir('mapa?foco=' + x.hex);
          }).catch(function () { /* aviso já mostrado */ });
        }
      });
    },
    entrar: function (el, params) {
      var a = params.get('alvo');
      if (a) nova.alvo = a.split(',').map(Number);
      var pronto = function () { desenharNova(el); };
      (dadosB ? Promise.resolve() : RP.get('/bandeiras').then(function (d) { dadosB = d; })).then(function () {
        return RP.mapaModelo ? RP.mapaModelo.garantir() : null;
      }).then(pronto, pronto);
    }
  });
})();
