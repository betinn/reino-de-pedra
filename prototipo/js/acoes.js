/* Reino de Pedra — telas de ação: Tropas (hub), Construção, Recrutamento, Exploradores e Caça.
   Também o cálculo ilustrativo de caminhos (rota curta x rota segura) e o minimapa de rota.
   Tempos e custos são fictícios; nada aqui é balanceamento. */
(function () {
  'use strict';
  var RP = window.RP, H = RP.hex, D = RP.dados, W = RP.mundo;
  var NIV = W.NIVEIS;

  /* ================================================================ caminhos */
  var CUSTO = { planicie: 1, colina: 1.25, floresta: 1.8, montanha: 2.3, pantano: 2.8, rio: 1 };
  var PENA = { baixo: 0.6, medio: 5, alto: 12 };
  var MIN_POR = { 'Lenta': 2.4, 'Média': 1.6, 'Rápida': 1 };   /* minutos por unidade de custo: deslocamento curto */
  function ehVau(c, l) { return D.vaus.some(function (v) { return v.c === c && v.l === l; }); }
  function custoHex(c, l, perfil) {
    var k = W.chave(c, l), e = W.estado(c, l), t = W.T[l][c];
    if (W.rioSet[k] && !W.rotaSet[k] && !ehVau(c, l)) return Infinity;       /* rio exige ponte ou vau */
    var base = e.v === 'desconhecido' ? 1.6 : CUSTO[t];
    if (perfil.semPenalidade && (t === 'floresta' || t === 'pantano')) base = 1;
    if (perfil.penaliza && (t === 'floresta' || t === 'montanha')) base *= 1.6;
    if (W.rotaSet[k]) base *= 0.55;
    if (ehVau(c, l)) base = Math.max(base, 1.4);
    return base;
  }
  function caminho(origem, destino, perfil) {
    var N = H.COLS * H.LINS, dist = new Float64Array(N).fill(Infinity), ant = new Int32Array(N).fill(-1), feito = new Uint8Array(N);
    var idx = function (c, l) { return l * H.COLS + c; };
    var s = idx(origem[0], origem[1]), alvo = idx(destino[0], destino[1]);
    dist[s] = 0;
    for (var it = 0; it < N; it++) {
      var u = -1, best = Infinity;
      for (var i = 0; i < N; i++) if (!feito[i] && dist[i] < best) { best = dist[i]; u = i; }
      if (u < 0 || u === alvo) break;
      feito[u] = 1;
      var uc = u % H.COLS, ul = Math.floor(u / H.COLS);
      H.vizinhos(uc, ul).forEach(function (v) {
        var cst = custoHex(v[0], v[1], perfil);
        if (!isFinite(cst)) return;
        if (perfil.evitarPerigo) { var p = W.perigoHex(v[0], v[1]); if (p) cst += PENA[p.nivel]; }
        var j = idx(v[0], v[1]);
        if (dist[u] + cst < dist[j]) { dist[j] = dist[u] + cst; ant[j] = u; }
      });
    }
    if (!isFinite(dist[alvo])) return null;
    var hexes = [], x = alvo;
    while (x >= 0) { hexes.unshift([x % H.COLS, Math.floor(x / H.COLS)]); x = ant[x]; }
    var real = 0, pior = null, rota = 0, nPerigo = 0;
    hexes.slice(1).forEach(function (h) {
      real += custoHex(h[0], h[1], perfil);
      if (W.rotaSet[W.chave(h[0], h[1])]) rota++;
      var p = W.perigoHex(h[0], h[1]);
      if (p && p.nivel !== 'baixo') nPerigo++;
      if (p && (!pior || NIV.indexOf(p.nivel) > NIV.indexOf(pior.nivel))) pior = p;
    });
    return { hexes: hexes, seg: Math.round(real * MIN_POR[perfil.vel] * 60), perigo: pior, naRota: rota, nPerigo: nPerigo };
  }
  function opcoesCaminho(origem, destino, perfil) {
    var curta = caminho(origem, destino, Object.assign({}, perfil, { evitarPerigo: false }));
    var segura = caminho(origem, destino, Object.assign({}, perfil, { evitarPerigo: true }));
    if (curta && segura && segura.hexes.join() === curta.hexes.join()) segura = null;
    return { curta: curta, segura: segura };
  }
  RP.caminho = caminho;

  /* minimapa de rota (SVG): terreno conhecido, névoa, perigo, rotas e o(s) caminho(s) */
  function miniRota(op, escolhida, destinoLabel, origemIcone) {
    var todos = [].concat(op.curta ? op.curta.hexes : [], op.segura ? op.segura.hexes : []);
    if (!todos.length) return '';
    var cs = todos.map(function (h) { return h[0]; }), ls = todos.map(function (h) { return h[1]; });
    var c0 = Math.max(0, Math.min.apply(null, cs) - 1), c1 = Math.min(H.COLS - 1, Math.max.apply(null, cs) + 1);
    var l0 = Math.max(0, Math.min.apply(null, ls) - 1), l1 = Math.min(H.LINS - 1, Math.max.apply(null, ls) + 1);
    var a = H.centro(c0, l0), b = H.centro(c1, l1);
    var vb = [a.x - H.W, a.y - H.R, b.x - a.x + 2 * H.W, b.y - a.y + 2 * H.R];
    var h = '', c, l, ce, e, k, p;
    for (l = l0; l <= l1; l++) for (c = c0; c <= c1; c++) {
      ce = H.centro(c, l); e = W.estado(c, l); k = W.chave(c, l);
      var cls = e.v === 'desconhecido' ? 'mr-nevoa' : W.rioSet[k] ? 'mr-rio' : 't-' + W.T[l][c];
      h += '<polygon class="hx ' + cls + (e.v === 'explorado' ? ' mr-antigo' : '') + '" points="' + H.cantos(ce.x, ce.y, H.R + 0.6) + '"/>';
      p = W.perigoHex(c, l);
      if (p) h += '<polygon class="mr-pg nivel-' + p.nivel + '" points="' + H.cantos(ce.x, ce.y, H.R - 2) + '"/>';
    }
    /* rotas só onde já foi explorado: trechos contínuos de hexes conhecidos */
    W.rotas.forEach(function (r) {
      var trecho = [];
      r.hexes.concat([null]).forEach(function (x) {
        if (x && W.estado(x[0], x[1]).v !== 'desconhecido') trecho.push(x);
        else { if (trecho.length > 1) h += '<path class="mr-estrada" d="' + H.curva(trecho) + '"/>'; trecho = []; }
      });
    });
    function linhaCaminho(rr, cls) {
      return '<polyline class="mr-caminho ' + cls + '" points="' + rr.hexes.map(function (x) { var q = H.centro(x[0], x[1]); return q.x.toFixed(0) + ',' + q.y.toFixed(0); }).join(' ') + '"/>';
    }
    if (op.segura) h += linhaCaminho(op.segura, 'mr-segura' + (escolhida === 'segura' ? ' ativo' : ''));
    if (op.curta) h += linhaCaminho(op.curta, 'mr-curta' + (escolhida === 'curta' ? ' ativo' : ''));
    var o = H.centro(todos[0][0], todos[0][1]), d = H.centro(todos[todos.length - 1][0], todos[todos.length - 1][1]);
    h += '<g transform="translate(' + o.x.toFixed(0) + ' ' + o.y.toFixed(0) + ')"><circle class="mr-pino" r="15"/><use href="#i-' + (origemIcone || 'castelo') + '" x="-10" y="-11" width="20" height="20" class="mr-pino-ico"/></g>';
    h += '<g transform="translate(' + d.x.toFixed(0) + ' ' + d.y.toFixed(0) + ')"><circle class="mr-destino" r="14"/><circle class="mr-destino-c" r="5"/></g>';
    return '<svg class="mini-rota mapa-svg" viewBox="' + vb.map(function (v) { return v.toFixed(0); }).join(' ') + '" role="img" aria-label="Caminho até ' + RP.esc(destinoLabel || 'o destino') + '">' + h + '</svg>';
  }

  /* ================================================================ peças comuns */
  function topo(titulo, voltar, sub) {
    return '<header class="topo"><a class="btn btn-fantasma btn-icone" href="#/' + voltar + '" aria-label="Voltar">' + RP.icone('voltar') + '</a>' +
      '<div class="topo-titulos"><h1>' + titulo + '</h1>' + (sub ? '<small>' + sub + '</small>' : '') + '</div></header>';
  }
  function perigoTxt(p, n) {
    if (!p) return 'sem perigo conhecido';
    return 'perigo ' + W.NOME_NIVEL[p.nivel].toLowerCase() + ' (' + W.ANIMAL[p.fauna.tipo].nome.toLowerCase() + ')' + (n ? ' em ' + n + (n > 1 ? ' hexágonos' : ' hexágono') : '');
  }
  function seloNivel(n, txt) { return '<span class="selo selo-perigo-' + n + '">' + RP.icone('pata') + (txt || 'Perigo ' + W.NOME_NIVEL[n].toLowerCase()) + '</span>'; }
  function opcaoCaminho(nome, r, escolhida, extra) {
    if (!r) return '';
    return '<button type="button" class="rota-opcao' + (nome === 'segura' ? ' segura' : ' curta') + '" data-caminho="' + nome + '" aria-pressed="' + (escolhida === nome) + '">' +
      '<i class="rota-cor" aria-hidden="true"></i><span><b>' + (nome === 'curta' ? 'Rota curta' : 'Rota segura') + '</b><small>' + r.hexes.length + ' hexágonos' + (r.naRota ? ' · ' + r.naRota + ' em rota pública' : '') + ' · ' + perigoTxt(r.perigo, r.nPerigo) + '</small></span>' +
      '<span class="rota-tempo">' + RP.icone('relogio', 'ico-p') + RP.fmtDuracao(r.seg) + '</span>' + (extra || '') + '</button>';
  }
  function stepper(id, valor, max) {
    return '<div class="stepper" data-stepper="' + id + '"><button type="button" class="btn btn-icone" data-passo="-1" aria-label="Menos"' + (valor <= 0 ? ' disabled' : '') + '>' + RP.icone('menos') + '</button>' +
      '<output class="num" aria-live="polite">' + valor + '</output>' +
      '<button type="button" class="btn btn-icone" data-passo="1" aria-label="Mais"' + (valor >= max ? ' disabled' : '') + '>' + RP.icone('mais') + '</button></div>';
  }
  function pontos(v) { var h = ''; for (var i = 1; i <= 5; i++) h += '<i class="' + (i <= v ? 'on' : '') + '"></i>'; return '<span class="pontos" role="img" aria-label="' + v + ' de 5">' + h + '</span>'; }
  function velPalavra(v) { return v <= 2 ? 'Lenta' : v >= 5 ? 'Rápida' : 'Média'; }
  function unidade(id) { return D.unidades.filter(function (u) { return u.id === id; })[0]; }
  function castelo() { var x = W.local('castelo'); return [x.c, x.l]; }
  function irParaMarcha(m) {
    RP.invalidarTela('mapa'); RP.invalidarTela('reino'); RP.invalidarTela('tropas');
    RP.ir('mapa?modo=cena&abrir=marcha:' + m.d.id);
  }

  /* ================================================================ Tropas (hub) */
  function emCampoHTML() {
    var meus = W.marchas.filter(function (m) { return m.d.dono === 'meu' && m.d.chegada > Date.now(); });
    if (!meus.length) return '<p class="fraco">Nenhuma tropa ou explorador fora do reino.</p>';
    return meus.map(function (m) {
      var ic = RP.mapa.iconeMarcha(m), risco = W.riscoMarcha(m);
      return '<a class="card emcampo" href="#/mapa?modo=cena&abrir=marcha:' + m.d.id + '"><span class="ico-placa dono-meu">' + RP.icone(ic) + '</span>' +
        '<span class="emcampo-corpo"><b>' + RP.esc(m.d.nome) + '</b><small class="fraco">' + RP.esc(m.d.resumo) + '</small>' +
        (risco && risco.nivel !== 'baixo' ? seloNivel(risco.nivel, 'Rota com ' + W.ANIMAL[risco.fauna.tipo].nome.toLowerCase()) : '') + '</span>' +
        '<span class="emcampo-tempo"><b class="num" data-fim="' + m.d.chegada + '">' + RP.fmtResta(m.d.chegada - Date.now()) + '</b><small class="fraco">Ver na Vista</small></span></a>';
    }).join('');
  }
  RP.registrarTela('tropas', {
    nav: true,
    montar: function (el) {
      var disp = D.disponiveis;
      el.innerHTML = '<header class="topo"><h1>Tropas</h1><button type="button" class="btn btn-fantasma btn-icone btn-sino-topo" data-abrir-notificacoes aria-label="Notificações">' + RP.icone('sino') + '<span class="contador">' + D.notificacoesNaoLidas + '</span></button></header>' +
        '<div class="conteudo-tela">' +
        '<div data-batalha-atalho></div><div data-repetir-atalho></div><div data-feridos></div>' +
        '<div class="secao-titulo" style="margin-top:0">Em campo</div><div class="pilha" data-emcampo></div>' +
        '<div class="secao-titulo">Guarnição do castelo</div><div class="card"><div class="linha" style="flex-wrap:wrap">' +
        Object.keys(disp).filter(function (u) { return disp[u]; }).map(function (u) { return '<span class="selo selo-g">' + RP.icone(unidade(u).icone) + disp[u] + ' ' + unidade(u).nome.toLowerCase() + (disp[u] > 1 ? 's' : '') + '</span>'; }).join('') +
        '</div><div class="linha" style="margin-top:var(--esp-2)">' + RP.seloVeterania(D.veterania.castelo) + '</div>' +
        '<p class="fraco" style="margin-top:var(--esp-2);font-size:var(--fs-2)">Postura: apenas defender. A população também defende como milícia. Veterania: 1 marca por vitória com perdas abaixo de 50% contra inimigo com pelo menos 30% da força; recrutas novos diluem as marcas.</p></div>' +
        '<div data-ferraria-atalho style="margin-top:var(--esp-3)"></div>' +
        '<div class="secao-titulo">Ordens</div><div class="grade-acoes">' +
        [['recrutamento', 'tropas', 'Recrutar', 'Milícia, lanceiro, arqueiro, cavalaria e cerco'],
          ['exploradores', 'explorador', 'Exploradores', 'Revelar o mapa, patrulhar e espionar'],
          ['mapa?ordem=1', 'alvo', 'Enviar tropas', 'Toque no destino no mapa: atacar, reforçar, ocupar ou mover'],
          ['extracao', 'picareta', 'Extração', 'Coletar recursos descobertos'],
          ['caca', 'lobo', 'Caça', 'Comida, couro e peles'],
          ['posturas', 'escudo', 'Posturas', 'Como cada tropa reage sem você']].map(function (a) {
          return '<a class="card acao-card" href="#/' + a[0] + '"><span class="ico-placa ico-placa-g">' + RP.icone(a[1]) + '</span><b>' + a[2] + '</b><small class="fraco">' + a[3] + '</small></a>';
        }).join('') + '</div></div>';
    },
    entrar: function (el) {
      RP.$('[data-emcampo]', el).innerHTML = emCampoHTML();
      RP.$('[data-feridos]', el).innerHTML = RP.feridosHTML();
      RP.$('[data-ferraria-atalho]', el).innerHTML = RP.ferrariaResumoHTML();
      var ue = D.ultimoEnvio, ux = ue && W.local(ue.alvo);
      RP.$('[data-repetir-atalho]', el).innerHTML = ux ? '<a class="card linha repetir-card" href="#/envio?alvo=' + ux.id + '&repetir=1"><span class="ico-placa">' + RP.icone('voltar') + '</span><span style="flex:1;min-width:0"><b>Repetir último ataque</b><br><small class="fraco">' +
        RP.esc(W.nomeAparente(ux)) + ' · ' + RP.esc(D.tiposAtaque.filter(function (t) { return t.id === ue.tipo; })[0].nome.toLowerCase()) + ' · mesmas tropas, objetivos e tática</small></span>' + RP.icone('avancar', 'ico-p') + '</a>' : '';
      var bt = RP.batalha && RP.batalha.ativa(), x = W.local(D.batalha.local);
      RP.$('[data-batalha-atalho]', el).innerHTML = bt ? '<a class="faixa-alerta faixa-batalha" href="#/batalha" style="margin-bottom:var(--esp-2)">' + RP.icone('tropas', 'pulso') + '<span class="txt"><b>Batalha em andamento</b> · ' + RP.esc(x.nome) + '<br>termina em <b class="num" data-fim="' + (Date.now() + RP.batalha.restante() * 1000) + '">' + RP.fmtResta(RP.batalha.restante() * 1000) + '</b></span>' + RP.icone('avancar', 'ico-p') + '</a>' : '';
    }
  });

  /* ================================================================ Construção */
  var abaObra = 'todos';
  function filaObrasHTML() {
    var f = D.filas;
    return '<div class="card pilha fila-card"><div class="card-titulo" style="margin:0">' + RP.icone('martelo') + '<h3>Obras</h3><span class="selo">' + f.obras.length + ' de ' + f.vagasObras + ' vagas</span></div>' +
      (f.obras.length ? f.obras.map(RP.itemFilaHTML).join('') : '<p class="fraco">Nenhuma obra em andamento.</p>') +
      (f.obras.length ? '<p class="fila-termina">' + RP.icone('relogio', 'ico-p') + 'Fila termina ' + RP.fmtHora(RP.fimItem(f.obras[f.obras.length - 1])) + '</p>' : '') +
      '<p class="fraco" style="font-size:var(--fs-2)">Uma obra por vez; as próximas começam quando a anterior termina. Planeje horas ou a noite inteira.</p></div>';
  }
  /* obras usam o estoque do local onde acontecem; obras novas, o do castelo (o material sai de lá) */
  function localObra(o) { return o.local || RP.SEDE; }
  function nomeLocalObra(o) { var x = W.local(localObra(o)); return x.tipo === 'castelo' ? 'no castelo' : 'em ' + x.nome; }
  function cartaoObra(o) {
    var bloqueado = !!o.requisito, loc = localObra(o), plano = !bloqueado && !o.novo ? RP.planoRequisicao(o.custo, loc) : null, falta = plano && !plano.completo ? Object.keys(plano.faltaReino) : [];
    var nivel = o.selo ? '<span class="selo selo-destaque">' + RP.esc(o.selo) + '</span>' : o.tec ? '<span class="selo selo-destaque">Tecnologia</span>' : o.novo ? '<span class="selo selo-info">Novo</span>' : o.veiculo ? '<span class="selo">' + D.veiculos[o.veiculo].qtd + ' livre' + (D.veiculos[o.veiculo].qtd === 1 ? '' : 's') + '</span>' : '<span class="selo">Nv ' + o.de + ' → ' + o.para + '</span>';
    var acao = bloqueado ? '<span class="selo selo-desconhecido">' + RP.icone('cadeado') + RP.esc(o.requisito) + '</span>'
      : o.novo ? '<button type="button" class="btn btn-p" data-escolher-local="' + o.id + '">' + RP.icone('mapa') + 'Escolher no mapa</button>'
      : '<button type="button" class="btn btn-p btn-primario' + (falta.length ? ' btn-inativo' : '') + '" data-construir="' + o.id + '">' + RP.icone(o.veiculo ? 'carroca' : 'martelo') + 'Construir</button>';
    return '<div class="card obra-card' + (bloqueado ? ' bloqueado' : '') + '" data-cat="' + o.cat + (o.novo ? ' novos' : '') + '">' +
      '<span class="ico-placa ico-placa-g">' + RP.icone(o.icone) + '</span><div class="obra-corpo">' +
      '<div class="linha-entre"><b>' + RP.esc(o.nome) + '</b>' + nivel + '</div>' +
      '<small class="fraco">' + RP.esc(o.onde) + '</small>' +
      '<span class="obra-efeito">' + RP.icone('subir', 'ico-p') + RP.esc(o.efeito) + '</span>' +
      '<div class="linha obra-custo">' + RP.custoHTML(o.custo, 1, '*') + (o.porHex ? '<small class="fraco">por hexágono</small>' : '') + '<span class="tempo">' + RP.icone('relogio', 'ico-p') + RP.fmtDuracao(o.tempo) + '</span></div>' +
      (plano ? '<small class="obra-estoque' + (falta.length ? ' falta' : plano.viagens.length ? ' vem' : '') + '">' + RP.icone(plano.viagens.length ? 'carroca' : 'check', 'ico-p') + RP.esc(RP.textoPlano(plano, loc)) + '</small>' : '') +
      '<div class="obra-acao">' + acao + '</div></div></div>';
  }
  function desenharConstrucao(el) {
    var cats = [['todos', 'Todos'], ['economia', 'Economia'], ['populacao', 'População'], ['militar', 'Militar'], ['defesas', 'Defesas'], ['transporte', 'Transporte'], ['novos', 'Novos locais']]
      .filter(function (c) { return (c[0] !== 'defesas' || RP.sistema('defesas')) && (c[0] !== 'transporte' || RP.sistema('logistica')); });
    if (!cats.some(function (c) { return c[0] === abaObra; })) abaObra = 'todos';
    RP.$('.obras-conteudo', el).innerHTML = filaObrasHTML() +
      '<div class="secao-titulo">Construir</div>' +
      '<div class="abas abas-rolagem" role="tablist" aria-label="Filtrar construções">' + cats.map(function (c) { return '<button class="aba" role="tab" data-aba-obra="' + c[0] + '" aria-selected="' + (abaObra === c[0]) + '">' + c[1] + '</button>'; }).join('') + '</div>' +
      (abaObra === 'defesas' ? RP.defesas.html()
        : (abaObra === 'transporte' ? '<p class="nota-regra" style="margin-top:var(--esp-3)">' + RP.icone('carroca', 'ico-p') + '<span>Recursos só servem onde estão. Carroças levam muito mais que tropas; ficam no castelo e saem para buscar e entregar. <a href="#/caravana">Transportar agora</a></span></p>' : '') +
        (abaObra === 'todos' || abaObra === 'militar' ? '<a class="card linha ferraria-atalho" href="#/ferraria" style="margin-top:var(--esp-3)"><span class="ico-placa ico-placa-g">' + RP.icone('ferraria') + '</span><span style="flex:1;min-width:0"><b>Eras, armas e armaduras</b><br><small class="fraco">Na ferraria, com fila própria · ' + RP.esc(RP.ERAS[RP.eraFeita('cerco') ? 'cerco' : RP.eraFeita('aco') ? 'aco' : 'ferro'].nome) + '</small></span>' + RP.icone('avancar', 'ico-p') + '</a>' : '') +
        '<div class="obras-lista">' + D.construcoes.filter(function (o) {
          if (o.cat === 'transporte' && !RP.sistema('logistica')) return false;
          return abaObra === 'todos' || o.cat === abaObra || (abaObra === 'novos' && o.novo);
        }).map(cartaoObra).join('') + '</div>') +
      '<p class="fraco" style="margin:var(--esp-4) 0 var(--esp-8);font-size:var(--fs-2)">Construções básicas levam minutos; as fortes e as tecnologias levam mais tempo. Não há atalho pago para encurtar timers.</p>';
  }
  RP.registrarTela('construcao', {
    secao: 'reino',
    montar: function (el) {
      el.innerHTML = topo('Construção', 'reino', 'Reino de ' + RP.esc(RP.estado.nome)) + '<div class="conteudo-tela obras-conteudo"></div>';
      el.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-aba-obra]'))) { abaObra = b.getAttribute('data-aba-obra'); desenharConstrucao(el); return; }
        if (RP.defesas.clique(e, function () { desenharConstrucao(el); })) return;
        if ((b = e.target.closest('[data-escolher-local]'))) {
          var qual = b.getAttribute('data-escolher-local'), txt = {
            'vila-nova': 'Qualquer hexágono livre, a qualquer distância e sem limite de locais: quanto mais longe, mais o material demora a chegar.',
            rota: 'Trace a rota no mapa: custo e tempo por hexágono, multiplicados pelo terreno.',
            ponte: 'Toque num trecho de rio: a ponte vira parte da rota pública.',
            posto: 'Toque numa jazida descoberta.'
          }[qual] || 'Toque no mapa e confirme.';
          RP.aviso({ titulo: 'Escolha no mapa', texto: txt + ' No protótipo, este passo é só ilustrado.', icone: 'mapa', tipo: 'alerta', ms: 4200 });
          return;
        }
        if ((b = e.target.closest('[data-construir]'))) {
          var o = D.construcoes.filter(function (x) { return x.id === b.getAttribute('data-construir'); })[0];
          var f = D.filas, loc = localObra(o), rot = o.nome + (o.tec || o.veiculo || o.selo ? '' : ' → nível ' + o.para);
          if (f.obras.length >= f.vagasObras) { RP.aviso({ titulo: 'Fila de obras cheia', texto: 'Espere uma obra terminar.', icone: 'relogio', tipo: 'alerta' }); return; }
          /* requisição: o que falta no local vem sozinho dos locais mais próximos */
          var plano = RP.requisitar(o.custo, loc, rot);
          if (!plano) { RP.aviso({ titulo: 'Recursos insuficientes', texto: RP.textoPlano(RP.planoRequisicao(o.custo, loc), loc), icone: 'alerta', tipo: 'perigo' }); return; }
          var aguarda = plano.viagens.length ? plano.chegada : 0, fim = RP.fimNaFila(f.obras, o.tempo, aguarda);
          f.obras.push({ local: o.local, rotulo: rot, fim: fim, total: o.tempo, aguarda: aguarda });
          RP.aviso({ titulo: o.nome + ' na fila', texto: aguarda ? 'O material está a caminho e chega em ' + RP.fmtResta(aguarda - Date.now()) + '. Acompanhe na Vista.' : 'Termina em ' + RP.fmtResta(fim - Date.now()) + '. Acompanhe a obra na Vista.', icone: aguarda ? 'carroca' : 'martelo', tipo: 'sucesso' });
          RP.invalidarTela('reino');
          desenharConstrucao(el);
        }
      });
    },
    entrar: function (el, params) { if (params.get('aba')) abaObra = params.get('aba'); desenharConstrucao(el); }
  });

  /* ================================================================ Recrutamento */
  var pedido = {}, LOCAL_RECRUT = 'quartel';   /* recruta com o estoque do quartel */
  function maxRecrutavel(u) {
    var m = Math.floor(RP.popAtual() / u.pop);
    Object.keys(u.custo).forEach(function (k) { m = Math.min(m, Math.floor(RP.qtdRecurso(k, '*') / u.custo[k])); });
    return Math.max(0, m);
  }
  function filaRecrutHTML() {
    var f = D.filas;
    return '<div class="card pilha fila-card"><div class="card-titulo" style="margin:0">' + RP.icone('tropas') + '<h3>Fila de recrutamento</h3><span class="selo">' + f.recrutamento.length + ' de ' + f.vagasRecrutamento + '</span></div>' +
      (f.recrutamento.length ? f.recrutamento.map(RP.itemFilaHTML).join('') +
        '<p class="fila-termina">' + RP.icone('relogio', 'ico-p') + 'Fila termina ' + RP.fmtHora(RP.fimItem(f.recrutamento[f.recrutamento.length - 1])) + '</p>' : '<p class="fraco">Nada sendo recrutado.</p>') + '</div>';
  }
  function requisitoDe(u) { return u.requisito || (u.era && !RP.eraFeita(u.era) ? RP.ERAS[u.era].nome : null); }
  function cartaoUnidade(u) {
    var q = pedido[u.id] || 0, max = maxRecrutavel(u), req = requisitoDe(u);
    return '<div class="card unid-card' + (req ? ' bloqueado' : '') + (q ? ' ativo' : '') + '" data-unidade="' + u.id + '">' +
      '<div class="unid-topo"><span class="ico-placa ico-placa-g">' + RP.icone(u.icone) + '</span><div class="unid-titulos"><b>' + u.nome + '</b><small class="fraco">' + u.papel + '</small></div>' +
      (req ? '<span class="selo selo-desconhecido">' + RP.icone('cadeado') + RP.esc(req) + '</span>' : '<span class="selo">' + RP.icone('relogio') + RP.fmtResta(u.tempo * 1000).replace(/^00:/, '0:') + '/un.</span>') + '</div>' +
      (u.nota ? '<p class="fraco" style="font-size:var(--fs-2)">' + RP.esc(u.nota) + '</p>' : '') +
      (req && u.era ? '<p class="fraco" style="font-size:var(--fs-2)">Pesquise a era na <a href="#/ferraria">ferraria</a>.</p>' : '') +
      '<div class="unid-vantagens">' + u.forte.map(function (x) { return '<span class="selo selo-visivel">Forte contra ' + x.toLowerCase() + '</span>'; }).join('') +
      u.fraco.map(function (x) { return '<span class="selo selo-perigo">Fraco contra ' + x.toLowerCase() + '</span>'; }).join('') + '</div>' +
      '<div class="unid-atrib"><span>Ataque' + pontos(u.atk) + '</span><span>Defesa' + pontos(u.def) + '</span><span>Velocidade' + pontos(u.vel) + '</span><span>Carga' + pontos(u.carga) + '</span></div>' +
      '<div class="linha unid-custo">' + RP.custoHTML(Object.assign({}, u.custo, { populacao: u.pop }), 1, '*') + '<small class="fraco">por unidade</small></div>' +
      (req ? '' : '<div class="unid-qtd">' + stepper(u.id, q, max) +
        '<div class="chips-rapidos"><button type="button" class="btn btn-p" data-somar="5">+5</button><button type="button" class="btn btn-p" data-somar="10">+10</button><button type="button" class="btn btn-p" data-somar="max">Máx. ' + max + '</button></div></div>') +
      '</div>';
  }
  function resumoRecrut() {
    var custo = {}, pop = 0, tempo = 0, partes = [];
    Object.keys(pedido).forEach(function (id) {
      var q = pedido[id]; if (!q) return;
      var u = unidade(id);
      Object.keys(u.custo).forEach(function (k) { custo[k] = (custo[k] || 0) + u.custo[k] * q; });
      pop += u.pop * q; tempo += u.tempo * q; partes.push(q + ' ' + u.nome.toLowerCase() + (q > 1 ? 's' : ''));
    });
    if (pop) custo.populacao = pop;
    return { custo: custo, pop: pop, tempo: tempo, txt: partes.join(', ') };
  }
  function desenharRecrut(el) {
    var p = D.populacao;
    RP.$('.recrut-conteudo', el).innerHTML =
      '<div class="card pop-mini"><div class="linha-entre"><span class="linha">' + RP.icone('populacao', 'r-populacao') + '<b class="num">' + RP.num(RP.popAtual()) + '</b><span class="fraco">/ ' + RP.num(p.teto) + '</span></span><span class="selo selo-visivel">+' + p.taxa + '/h</span></div>' +
      '<p class="fraco" style="font-size:var(--fs-2);margin-top:6px">Recrutar consome população. Tropas mortas não retornam.</p></div>' +
      '<div class="card pilha"><div class="linha"><span class="linha">' + RP.icone('quartel') + '<b>Estoque do quartel</b></span></div>' +
      RP.estoqueHTML(LOCAL_RECRUT) + '<p class="fraco" style="font-size:var(--fs-2)">O que faltar no quartel vem sozinho dos locais mais próximos, levado por carregadores.</p></div>' +
      filaRecrutHTML() + '<div class="secao-titulo">Unidades</div><div class="pilha">' + D.unidades.map(cartaoUnidade).join('') + '</div>';
    var r = resumoRecrut(), falta = RP.faltas(r.custo, 1, '*'), pl = r.pop ? RP.planoRequisicao(r.custo, LOCAL_RECRUT) : null;
    RP.$('.rodape-resumo', el).innerHTML = r.pop
      ? '<div class="resumo-linha"><b>' + RP.esc(r.txt) + '</b><span class="tempo">' + RP.icone('relogio', 'ico-p') + RP.fmtDuracao(r.tempo) + '</span></div>' + RP.custoHTML(r.custo, 1, '*') +
        (pl && pl.viagens.length ? '<div class="resumo-linha fraco">' + RP.esc(RP.textoPlano(pl, LOCAL_RECRUT)) + '</div>' : '')
      : '<div class="resumo-linha fraco">Escolha a quantidade de cada unidade.</div>';
    RP.$('[data-recrutar]', el).classList.toggle('btn-inativo', !r.pop || falta.length > 0);
  }
  RP.registrarTela('recrutamento', {
    secao: 'tropas',
    montar: function (el) {
      var q = W.local('quartel');
      el.innerHTML = topo('Recrutamento', 'tropas', RP.esc(q.nome) + ' · nível ' + q.nivel) + '<div class="conteudo-tela recrut-conteudo"></div>' +
        '<div class="rodape-acao rodape-com-resumo"><div class="rodape-resumo"></div><button type="button" class="btn btn-primario btn-bloco btn-grande" data-recrutar>' + RP.icone('tropas') + 'Recrutar</button></div>';
      el.addEventListener('click', function (e) {
        var b, card = e.target.closest('[data-unidade]'), u = card && unidade(card.getAttribute('data-unidade'));
        if ((b = e.target.closest('[data-passo]')) && u) { pedido[u.id] = Math.max(0, Math.min(maxRecrutavel(u), (pedido[u.id] || 0) + +b.getAttribute('data-passo'))); desenharRecrut(el); return; }
        if ((b = e.target.closest('[data-somar]')) && u) {
          var v = b.getAttribute('data-somar');
          pedido[u.id] = v === 'max' ? maxRecrutavel(u) : Math.min(maxRecrutavel(u), (pedido[u.id] || 0) + +v);
          desenharRecrut(el); return;
        }
        if (e.target.closest('[data-recrutar]')) {
          var r = resumoRecrut(), falta = RP.faltas(r.custo, 1, '*'), f = D.filas;
          if (!r.pop) { RP.aviso({ titulo: 'Nada escolhido', texto: 'Use + e − em cada unidade.', icone: 'info', tipo: 'alerta' }); return; }
          if (falta.length) { RP.aviso({ titulo: 'Recursos insuficientes', texto: 'Faltam ' + falta.join(', ') + ' no reino todo.', icone: 'alerta', tipo: 'perigo' }); return; }
          var tipos = Object.keys(pedido).filter(function (id) { return pedido[id]; });
          if (f.recrutamento.length + tipos.length > f.vagasRecrutamento) { RP.aviso({ titulo: 'Fila cheia', texto: 'Cabem ' + (f.vagasRecrutamento - f.recrutamento.length) + ' tipos de unidade agora.', icone: 'relogio', tipo: 'alerta' }); return; }
          var pl = RP.requisitar(r.custo, LOCAL_RECRUT, 'recrutamento');
          RP.gastar({ populacao: r.pop });
          var aguarda = pl && pl.viagens.length ? pl.chegada : 0;
          tipos.forEach(function (id) {
            var un = unidade(id), qq = pedido[id], dur = un.tempo * qq, fimR = RP.fimNaFila(f.recrutamento, dur, aguarda);
            f.recrutamento.push({ unidade: id, qtd: qq, rotulo: qq + ' ' + un.nome.toLowerCase() + (qq > 1 ? 's' : '') + ' · Quartel da Guarda', fim: fimR, total: dur, aguarda: aguarda });
          });
          RP.aviso({ titulo: 'Recrutamento na fila', texto: r.txt + '. População −' + r.pop + '.', icone: 'tropas', tipo: 'sucesso' });
          pedido = {};
          RP.invalidarTela('reino');
          desenharRecrut(el);
        }
      });
    },
    entrar: function (el) { desenharRecrut(el); }
  });

  /* ================================================================ Exploradores */
  var ORDENS = {
    explorar: { nome: 'Explorar área', txt: 'Vai até o destino e revela a região ao redor.' },
    rota: { nome: 'Seguir rota', txt: 'Percorre a rota pública mais próxima, revelando as margens.' },
    patrulhar: { nome: 'Patrulhar', txt: 'Vai e volta entre o castelo e o destino, mantendo a área à vista.' },
    retornar: { nome: 'Retornar', txt: 'Volta ao castelo pelo caminho mais seguro.' }
  };
  var ex = { tipo: 'cavalo', ordem: 'explorar', alvo: [19, 5], caminho: 'segura', escolta: false };
  function perfilExplorador(t, escolta) {
    var tipo = D.exploradores.filter(function (x) { return x.id === t; })[0];
    if (escolta) return { vel: 'Lenta', semPenalidade: false, penaliza: false };
    return { vel: tipo.velocidade, semPenalidade: t === 'pe', penaliza: t === 'cavalo' };
  }
  /* fauna (balanceamento): força do grupo = soma de (ataque + defesa)/2. Com o dobro do limite, passa ileso;
     acima do limite, o risco cai um nível. Chance de ataque por região atravessada; num ataque, perde 5% (acima) ou 25% (abaixo). */
  var LIMITE_FAUNA = { baixo: 40, medio: 120, alto: 300 }, ATAQUE_FAUNA = { baixo: 10, medio: 25, alto: 50 };
  var FORCA_UN = { milicia: 10, lanceiro: 32.5, arqueiro: 30, cavalaria: 37.5, elite: 50, ariete: 10, trebuchet: 5 };
  function forcaFauna(g) { return Object.keys(g || {}).reduce(function (s, k) { return s + (g[k] || 0) * (FORCA_UN[k] || 0); }, 0); }
  function riscoFauna(nivel, forca) {
    var lim = LIMITE_FAUNA[nivel];
    if (forca >= lim * 2) return 'nenhum';
    var n = NIV.indexOf(nivel) - (forca >= lim ? 1 : 0);
    return n < 0 ? 'nenhum' : NIV[n];
  }
  function riscoGrupo(perigo, forca) { return perigo ? riscoFauna(perigo.nivel, forca) : null; }
  RP.fauna = { limite: LIMITE_FAUNA, ataque: ATAQUE_FAUNA, forca: forcaFauna, risco: riscoFauna };
  function blocoRisco(risco, perigo, sozinho) {
    if (!perigo) return '<div class="risco-linha ok">' + RP.icone('check') + '<span><b>Sem fauna perigosa conhecida no caminho</b><br><small>Área desconhecida pode esconder animais.</small></span></div>';
    if (risco === 'nenhum') return '<div class="risco-linha ok">' + RP.icone('escudo') + '<span><b>Grupo forte o bastante</b><br><small>Com o dobro da força dos animais (' + LIMITE_FAUNA[perigo.nivel] + ' aqui), o grupo passa ileso por ' + W.ANIMAL[perigo.fauna.tipo].nome.toLowerCase() + '.</small></span></div>';
    return '<div class="perigo-linha nivel-' + risco + '">' + RP.icone(W.ANIMAL[perigo.fauna.tipo].icone) + '<span><b>Risco ' + W.NOME_NIVEL[risco].toLowerCase() + '</b> · ' + W.ANIMAL[perigo.fauna.tipo].nome.toLowerCase() + ' no caminho<br><small>Chance de ataque de ' + ATAQUE_FAUNA[perigo.nivel] + '% em cada região assim. ' + (sozinho ? 'Um explorador sozinho atacado morre. Escolha a rota segura ou leve escolta.' : 'Atacado, o grupo perde até 25%. Reforce o grupo ou use a rota segura.') + '</small></span></div>';
  }
  /* espionagem (balanceamento): 15% + 10% por torre no alcance + 0,5% por tropa da guarnição, até 60% */
  function espiaHTML(alvo) {
    var x = D.locais.filter(function (q) { return q.c === alvo[0] && q.l === alvo[1] && q.reino !== 'meu' && !W.aliado(q.reino); })[0];
    var regra = '<p class="fraco" style="font-size:var(--fs-2)">Visto, metade das vezes o batedor é capturado e o relatório não volta; na outra, foge com o relatório. Nos dois casos, o alvo vê "espião visto" por 10 h. O batedor fica 10 min no local.</p>';
    if (!x) return '<div class="card pilha espia-card"><b>Chance de ser visto: 15% a 60%</b><p class="fraco" style="font-size:var(--fs-2)">Escolha um local de outro reino como destino para ver a estimativa. Torres no alcance e guarnição grande aumentam a chance.</p>' + regra + '</div>';
    var torres = RP.torres.de(x.id).length, m = x.espionado && /(\d+)/.exec(x.espionado.defesa || ''), tropas = m ? +m[1] : null;
    var min = Math.min(60, 15 + 10 * torres), est = tropas != null ? Math.min(60, min + 0.5 * tropas) : null;
    return '<div class="card pilha espia-card"><div class="linha-entre"><b>Chance de ser visto</b><b class="num">' + (est != null ? '≈ ' + Math.round(est) + '%' : min + '% a ' + Math.min(60, min + 20) + '%') + '</b></div>' +
      '<div class="barra"><i style="width:' + ((est != null ? est : min) / 60 * 100).toFixed(0) + '%"></i></div>' +
      '<small class="fraco">' + RP.esc(W.nomeAparente(x)) + ': 15% de base' + (torres ? ' + ' + torres * 10 + '% de ' + torres + (torres > 1 ? ' torres' : ' torre') + ' no alcance' : '') + (tropas != null ? ' + ' + Math.round(0.5 * tropas) + '% por ' + tropas + ' tropas (espionagem antiga)' : ' + até 20% pela guarnição, ainda desconhecida') + '. Máximo de 60%.</small>' + regra + '</div>';
  }
  function desenharExploradores(el, params) {
    var ativo = params && params.get('ativo') && W.marcha(params.get('ativo'));
    if (ex.tipo === 'batedor' && !RP.sistema('espionagem')) ex.tipo = 'pe';
    var tipoInfo = D.exploradores.filter(function (x) { return x.id === ex.tipo; })[0];
    var op = opcoesCaminho(castelo(), ex.alvo, perfilExplorador(ex.tipo, ex.escolta));
    if (ex.caminho === 'segura' && !op.segura) ex.caminho = 'curta';
    var esc = op[ex.caminho] || op.curta;
    var t = W.T[ex.alvo[1]][ex.alvo[0]], e = W.estado(ex.alvo[0], ex.alvo[1]);
    var destino = (e.v === 'desconhecido' ? 'Terra desconhecida' : H.TERRENOS[t].nome) + ' · ' + ex.alvo[0] + ', ' + ex.alvo[1];
    var risco = esc ? riscoGrupo(esc.perigo, tipoInfo.forca + (ex.escolta ? 5 * FORCA_UN.lanceiro : 0)) : null;
    var h = '';
    if (ativo) {
      h += '<div class="card card-moldura pilha"><div class="linha"><span class="ico-placa dono-meu">' + RP.icone(RP.mapa.iconeMarcha(ativo)) + '</span><div style="flex:1"><b>' + RP.esc(ativo.d.nome) + '</b><br><small class="fraco">' + RP.esc(ativo.d.resumo) + '</small></div><b class="num" data-fim="' + ativo.d.chegada + '">' + RP.fmtResta(ativo.d.chegada - Date.now()) + '</b></div>' +
        '<span class="rotulo">Nova ordem</span><div class="abas" role="group">' + Object.keys(ORDENS).map(function (k) { return '<button type="button" class="aba" data-ordem-ativo="' + k + '" aria-pressed="' + ((params.get('ordem') || 'explorar') === k) + '">' + ORDENS[k].nome + '</button>'; }).join('') + '</div>' +
        '<button type="button" class="btn btn-primario" data-confirmar-ordem="' + ativo.d.id + '">' + RP.icone('check') + 'Confirmar ordem</button></div><div class="secao-titulo">Enviar outro explorador</div>';
    }
    h += '<div class="secao-titulo"' + (ativo ? ' hidden' : ' style="margin-top:0"') + '>1. Tipo</div><div class="escolhas">' + D.exploradores.filter(function (x) { return x.id !== 'batedor' || RP.sistema('espionagem'); }).map(function (x) {
      return '<button type="button" class="escolha" data-tipo-exp="' + x.id + '" aria-pressed="' + (ex.tipo === x.id) + '">' +
        '<span class="linha"><span class="ico-placa">' + RP.icone(x.icone) + '</span><b>' + x.nome + '</b></span>' +
        '<span class="escolha-atrib"><span>Velocidade <b>' + x.velocidade + '</b></span><span>Visão <b>' + x.visao + '</b></span><span>Custo <b>' + x.custo + '</b></span></span>' +
        '<small class="fraco">' + x.carac + '</small>' +
        '<small class="fraco">Treino: ' + RP.esc(RP.cargaTxt(x.treino)) + ' · ' + RP.fmtDuracao(x.tempo) + ' · 1 de população · força ' + x.forca + ' contra fauna</small>' +
        (x.livres ? '<span class="selo selo-visivel">' + x.livres + ' livre' + (x.livres > 1 ? 's' : '') + '</span>' : '<span class="selo selo-desconhecido">Nenhum livre · treinar ' + RP.custoHTML(x.treino) + '</span>') + '</button>';
    }).join('') + '</div>' +
      '<div class="secao-titulo">2. Ordem</div><div class="abas" role="group" aria-label="Ordem">' + ['explorar', 'rota', 'patrulhar'].map(function (k) { return '<button type="button" class="aba" data-ordem="' + k + '" aria-pressed="' + (ex.ordem === k) + '">' + ORDENS[k].nome + '</button>'; }).join('') + '</div>' +
      '<p class="fraco" style="font-size:var(--fs-2);margin-top:var(--esp-2)">' + ORDENS[ex.ordem].txt + (ex.tipo === 'batedor' ? ' Batedor de elite furtivo: espiona exércitos e reinos e revela o dono de locais.' : '') + (ex.tipo === 'prospector' ? ' Só o prospector revela jazidas valiosas e lendárias.' : '') + '</p>' +
      (ex.tipo === 'batedor' ? espiaHTML(ex.alvo) : '') +
      '<div class="secao-titulo">3. Destino</div><div class="card linha destino-card"><span class="ico-placa">' + RP.icone(e.v === 'desconhecido' ? 'nevoa' : 'alvo') + '</span><div style="flex:1"><b>' + destino + '</b><br><small class="fraco">' + (e.v === 'explorado' ? 'Visto ' + RP.fmtHa(e.horas) : e.v === 'visivel' ? 'Visível agora' : 'Nunca visto') + '</small></div>' +
      '<a class="btn btn-p" href="#/mapa?modo=tatico">' + RP.icone('mapa') + 'Trocar</a></div>' +
      '<div class="secao-titulo">4. Caminho</div>' +
      (esc ? '<div class="card mini-rota-card">' + miniRota(op, ex.caminho, destino) + '</div>' +
        '<div class="pilha" style="margin-top:var(--esp-3)">' + opcaoCaminho('curta', op.curta, ex.caminho) + opcaoCaminho('segura', op.segura, ex.caminho) + '</div>' +
        '<button type="button" class="alternar" data-escolta aria-pressed="' + ex.escolta + '" style="margin-top:var(--esp-3);width:100%">' + RP.icone('escudo') + '<span>Levar escolta (5 lanceiros) · mais seguro, mais lento</span><i aria-hidden="true"></i></button>' +
        blocoRisco(risco, esc.perigo, !ex.escolta)
        : '<p class="fraco">Sem caminho possível até o destino (rio sem ponte ou vau).</p>');
    RP.$('.exp-conteudo', el).innerHTML = h;
    RP.$('.rodape-resumo', el).innerHTML = esc ? '<div class="resumo-linha"><b>' + tipoInfo.nome + ' · ' + ORDENS[ex.ordem].nome + '</b><span class="tempo">' + RP.icone('relogio', 'ico-p') + 'chega em ' + RP.fmtDuracao(esc.seg) + '</span></div>' : '';
    RP.$('[data-enviar-exp]', el).classList.toggle('btn-inativo', !esc || !tipoInfo.livres);
    ex._esc = esc;
  }
  RP.registrarTela('exploradores', {
    secao: 'tropas',
    montar: function (el) {
      el.innerHTML = topo('Exploradores', 'tropas') + '<div class="conteudo-tela exp-conteudo"></div>' +
        '<div class="rodape-acao rodape-com-resumo"><div class="rodape-resumo"></div><button type="button" class="btn btn-primario btn-bloco btn-grande" data-enviar-exp>' + RP.icone('explorador') + 'Enviar explorador</button></div>';
      el.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-tipo-exp]'))) { ex.tipo = b.getAttribute('data-tipo-exp'); desenharExploradores(el, el._params); return; }
        if ((b = e.target.closest('[data-ordem]'))) { ex.ordem = b.getAttribute('data-ordem'); desenharExploradores(el, el._params); return; }
        if ((b = e.target.closest('[data-caminho]'))) { ex.caminho = b.getAttribute('data-caminho'); desenharExploradores(el, el._params); return; }
        if (e.target.closest('[data-escolta]')) { ex.escolta = !ex.escolta; desenharExploradores(el, el._params); return; }
        if ((b = e.target.closest('[data-ordem-ativo]'))) { RP.$$('[data-ordem-ativo]', el).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); return; }
        if ((b = e.target.closest('[data-confirmar-ordem]'))) {
          var sel = RP.$('[data-ordem-ativo][aria-pressed="true"]', el);
          var m = W.marcha(b.getAttribute('data-confirmar-ordem'));
          m.d.resumo = 'Ordem: ' + ORDENS[sel.getAttribute('data-ordem-ativo')].nome.toLowerCase();
          RP.aviso({ titulo: 'Nova ordem enviada', texto: m.d.nome + ': ' + ORDENS[sel.getAttribute('data-ordem-ativo')].txt, icone: 'explorador', tipo: 'sucesso' });
          return;
        }
        if (e.target.closest('[data-enviar-exp]')) {
          var tipo = D.exploradores.filter(function (x) { return x.id === ex.tipo; })[0], esc = ex._esc;
          if (!tipo.livres) { RP.aviso({ titulo: 'Nenhum ' + tipo.nome.toLowerCase() + ' livre', texto: 'Treine um novo ou espere um voltar.', icone: 'explorador', tipo: 'alerta' }); return; }
          if (!esc) return;
          tipo.livres--;
          if (ex.escolta) D.disponiveis.lanceiro = Math.max(0, D.disponiveis.lanceiro - 5);
          var m = W.adicionarMarcha({ id: 'm-exp-' + Date.now(), dono: 'meu', tipo: 'explorador', sub: ex.tipo, escolta: ex.escolta,
            nome: 'Explorador ' + tipo.nome.toLowerCase(), resumo: 'Ordem: ' + ORDENS[ex.ordem].nome.toLowerCase() + (ex.escolta ? ' · com escolta' : ''), seg: esc.seg }, esc.hexes);
          RP.aviso({ titulo: 'Explorador enviado', texto: 'Chega em ' + RP.fmtDuracao(esc.seg) + '. Acompanhe na Vista.', icone: 'explorador', tipo: 'sucesso' });
          irParaMarcha(m);
        }
      });
    },
    entrar: function (el, params) {
      el._params = params;
      var a = params.get('alvo');
      if (a) ex.alvo = a.split(',').map(Number);
      if (params.get('tipo')) ex.tipo = params.get('tipo');
      desenharExploradores(el, params);
    }
  });

  /* ================================================================ Caça */
  var caca = { fauna: null, grupo: { lanceiro: 0, arqueiro: 4, cavalaria: 0 }, caminho: 'segura' };
  function faunaConhecida() { return D.fauna.filter(function (f) { return W.estado(f.c, f.l).v !== 'desconhecido'; }); }
  function forcaGrupo(g) { return forcaFauna(g); }
  function perfilGrupo(g) {
    var vels = Object.keys(g).filter(function (k) { return g[k]; }).map(function (k) { return unidade(k).vel; });
    var v = vels.length ? Math.min.apply(null, vels) : 3;
    return { vel: velPalavra(v) };
  }
  function desenharCaca(el) {
    var lista = faunaConhecida();
    if (!caca.fauna || !lista.some(function (f) { return f.id === caca.fauna; })) caca.fauna = lista[0].id;
    var f = W.fauna(caca.fauna), A = W.ANIMAL[f.tipo], rend = D.caca[f.tipo];
    var vivo = W.faunaVisivel(f), e = W.estado(f.c, f.l);
    var op = opcoesCaminho(castelo(), [f.c, f.l], perfilGrupo(caca.grupo));
    if (caca.caminho === 'segura' && !op.segura) caca.caminho = 'curta';
    var esc = op[caca.caminho] || op.curta;
    var total = caca.grupo.lanceiro + caca.grupo.arqueiro + caca.grupo.cavalaria;
    var lim = LIMITE_FAUNA[f.nivel], forca = forcaGrupo(caca.grupo);
    var riscoAlvo = riscoFauna(f.nivel, forca);
    var h = '<div class="secao-titulo" style="margin-top:0">Alvo</div><div class="escolhas escolhas-lista">' + lista.map(function (x) {
      var ee = W.estado(x.c, x.l), vv = W.faunaVisivel(x), AA = W.ANIMAL[x.tipo];
      return '<button type="button" class="escolha escolha-linha" data-fauna="' + x.id + '" aria-pressed="' + (x.id === caca.fauna) + '"><span class="ico-placa nivel-' + x.nivel + '">' + RP.icone(AA.icone) + '</span>' +
        '<span class="escolha-txt"><b>' + AA.nome + ' (≈ ' + x.qtd + ')</b><small class="fraco">' + H.TERRENOS[W.T[x.l][x.c]].nome + ' · ' + (vv ? 'à vista agora' : 'visto ' + RP.fmtHa(ee.horas)) + '</small></span>' + seloNivel(x.nivel, W.NOME_NIVEL[x.nivel]) + '</button>';
    }).join('') + '</div>' +
      '<div class="card rend-card"><span class="rotulo">Rendimento estimado · ' + A.nome.toLowerCase() + '</span><div class="linha" style="flex-wrap:wrap;margin-top:6px">' +
      ['comida', 'couro', 'peles'].map(function (r) { return '<span class="selo selo-g">' + RP.icone(r, 'r-' + r) + D.recursos[r].nome + ' <b class="num">' + rend[r] + '</b></span>'; }).join('') + '</div>' +
      '<p class="fraco" style="font-size:var(--fs-2);margin-top:var(--esp-2)">Por bando abatido, com 20 min no local. O bando volta em 24 h: caçar não limpa a região para sempre.' + (vivo ? '' : ' Última posição conhecida ' + RP.fmtHa(e.horas) + '.') + '</p></div>' +
      '<div class="secao-titulo">Grupo de caça</div><div class="card pilha">' + ['arqueiro', 'lanceiro', 'cavalaria'].map(function (id) {
        var u = unidade(id), disp = D.disponiveis[id] || 0;
        return '<div class="linha-entre grupo-linha" data-unidade-caca="' + id + '"><span class="linha">' + RP.icone(u.icone) + '<span><b>' + u.nome + '</b><br><small class="fraco">' + disp + ' na guarnição</small></span></span>' + stepper(id, caca.grupo[id], disp) + '</div>';
      }).join('') +
      '<div class="forca"><div class="linha-entre"><span class="rotulo">Força do grupo: ' + Math.round(forca) + ' de ' + lim * 2 + '</span><span class="fraco">' + total + ' ' + (total === 1 ? 'unidade' : 'unidades') + '</span></div>' +
      '<div class="barra barra-grossa forca-' + riscoAlvo + '"><i style="width:' + Math.min(100, (100 * forca) / (lim * 2)).toFixed(0) + '%"></i></div>' +
      '<div class="forca-marcas"><span>Grupo pequeno</span><span>Passa ileso</span></div></div></div>' +
      (riscoAlvo === 'nenhum' ? '<div class="risco-linha ok">' + RP.icone('escudo') + '<span><b>Grupo forte o bastante</b><br><small>Grupos médios passam praticamente ilesos.</small></span></div>'
        : '<div class="perigo-linha nivel-' + riscoAlvo + '">' + RP.icone(A.icone) + '<span><b>Risco ' + W.NOME_NIVEL[riscoAlvo].toLowerCase() + ' na caçada</b><br><small>Grupos pequenos podem perder unidades. Tropas mortas não retornam.</small></span></div>') +
      '<div class="secao-titulo">Caminho</div>' +
      (esc ? '<div class="card mini-rota-card">' + miniRota(op, caca.caminho, A.nome) + '</div><div class="pilha" style="margin-top:var(--esp-3)">' + opcaoCaminho('curta', op.curta, caca.caminho) + opcaoCaminho('segura', op.segura, caca.caminho) + '</div>' : '<p class="fraco">Sem caminho possível.</p>') +
      '<p class="fraco" style="font-size:var(--fs-2);margin:var(--esp-3) 0 var(--esp-6)">O tempo de viagem segue a unidade mais lenta do grupo.</p>';
    RP.$('.caca-conteudo', el).innerHTML = h;
    RP.$('.rodape-resumo', el).innerHTML = esc && total ? '<div class="resumo-linha"><b>' + total + ' caçadores → ' + A.nome.toLowerCase() + '</b><span class="tempo">' + RP.icone('relogio', 'ico-p') + 'chega em ' + RP.fmtDuracao(esc.seg) + '</span></div>' : '<div class="resumo-linha fraco">Monte o grupo de caça.</div>';
    RP.$('[data-cacar]', el).classList.toggle('btn-inativo', !esc || !total);
    caca._esc = esc;
  }
  RP.registrarTela('caca', {
    secao: 'tropas',
    montar: function (el) {
      el.innerHTML = topo('Caça', 'tropas', 'Comida, couro e peles') + '<div class="conteudo-tela caca-conteudo"></div>' +
        '<div class="rodape-acao rodape-com-resumo"><div class="rodape-resumo"></div><button type="button" class="btn btn-primario btn-bloco btn-grande" data-cacar>' + RP.icone('lobo') + 'Sair para caçar</button></div>';
      el.addEventListener('click', function (e) {
        var b, linha;
        if ((b = e.target.closest('[data-fauna]'))) { caca.fauna = b.getAttribute('data-fauna'); desenharCaca(el); return; }
        if ((b = e.target.closest('[data-caminho]'))) { caca.caminho = b.getAttribute('data-caminho'); desenharCaca(el); return; }
        if ((b = e.target.closest('[data-passo]')) && (linha = e.target.closest('[data-unidade-caca]'))) {
          var id = linha.getAttribute('data-unidade-caca');
          caca.grupo[id] = Math.max(0, Math.min(D.disponiveis[id] || 0, caca.grupo[id] + +b.getAttribute('data-passo')));
          desenharCaca(el); return;
        }
        if (e.target.closest('[data-cacar]')) {
          var g = caca.grupo, total = g.lanceiro + g.arqueiro + g.cavalaria, esc = caca._esc, f = W.fauna(caca.fauna);
          if (!total) { RP.aviso({ titulo: 'Grupo vazio', texto: 'Escolha quem vai caçar.', icone: 'info', tipo: 'alerta' }); return; }
          if (!esc) return;
          Object.keys(g).forEach(function (k) { D.disponiveis[k] = (D.disponiveis[k] || 0) - g[k]; });
          var partes = Object.keys(g).filter(function (k) { return g[k]; }).map(function (k) { return g[k] + ' ' + unidade(k).nome.toLowerCase() + (g[k] > 1 ? 's' : ''); });
          var m = W.adicionarMarcha({ id: 'm-caca-' + Date.now(), dono: 'meu', tipo: 'caca', grupo: Object.assign({}, g), alvoFauna: f.id,
            nome: 'Grupo de caça', resumo: partes.join(', ') + ' → ' + W.ANIMAL[f.tipo].nome.toLowerCase(), seg: esc.seg }, esc.hexes);
          caca.grupo = { lanceiro: 0, arqueiro: 0, cavalaria: 0 };
          RP.aviso({ titulo: 'Caçadores a caminho', texto: 'Chegam em ' + RP.fmtDuracao(esc.seg) + '.', icone: 'lobo', tipo: 'sucesso' });
          irParaMarcha(m);
        }
      });
    },
    entrar: function (el, params) { if (params.get('fauna')) caca.fauna = params.get('fauna'); desenharCaca(el); }
  });

  /* peças compartilhadas com as telas militares e sociais */
  RP.util = {
    opcoesCaminho: opcoesCaminho, miniRota: miniRota, opcaoCaminho: opcaoCaminho, stepper: stepper, topo: topo,
    unidade: unidade, castelo: castelo, irParaMarcha: irParaMarcha, seloNivel: seloNivel, perigoTxt: perigoTxt,
    pontos: pontos, velPalavra: velPalavra, blocoRisco: blocoRisco
  };

  /* retorno de marcha (ilustrativo) */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-retornar]');
    if (!b) return;
    var m = W.marcha(b.getAttribute('data-retornar'));
    RP.aviso({ titulo: 'Retorno ordenado', texto: (m ? m.d.nome : 'A tropa') + ' volta ao castelo pelo caminho mais seguro.', icone: 'voltar', tipo: 'sucesso' });
    RP.fecharFolha();
  });
})();
