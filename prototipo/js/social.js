/* Reino de Pedra — Relatórios, Notificações e Bandeiras. */
(function () {
  'use strict';
  var RP = window.RP, H = RP.hex, D = RP.dados, W = RP.mundo, U = RP.util;

  /* ================================================================ contadores (sino e aba Relatórios) */
  RP.atualizarContadores = function () {
    var nNot = D.notificacoes.filter(function (n) { return !n.lido; }).length;
    var nRel = D.relatorios.filter(function (r) { return !r.lido; }).length;
    RP.$$('[data-abrir-notificacoes] .contador').forEach(function (c) { c.textContent = nNot; c.hidden = !nNot; });
    RP.$$('[data-abrir-notificacoes]').forEach(function (b) { b.setAttribute('aria-label', 'Notificações' + (nNot ? ' (' + nNot + ' novas)' : '')); });
    var a = RP.$('#nav a[data-nav="relatorios"]');
    if (a) {
      var c = RP.$('.contador', a);
      if (!c) { c = document.createElement('span'); c.className = 'contador'; a.appendChild(c); }
      c.textContent = nRel; c.hidden = !nRel;
    }
  };
  document.addEventListener('rp:tela', function () { RP.atualizarContadores(); });

  /* ================================================================ Relatórios */
  var TIPO_REL = {
    batalha: { nome: 'Batalha', icone: 'tropas', cls: 'perigo', filtro: 'ataques' },
    ataque: { nome: 'Ataque sofrido', icone: 'alerta', cls: 'perigo', filtro: 'ataques' },
    saque: { nome: 'Seu saque', icone: 'ouro', cls: 'destaque', filtro: 'saques' },
    exploracao: { nome: 'Exploração', icone: 'explorador', cls: 'info', filtro: 'exploracao' },
    espionagem: { nome: 'Espionagem', icone: 'batedor', cls: 'info', filtro: 'espionagem' },
    fauna: { nome: 'Fauna', icone: 'pata', cls: 'perigo', filtro: 'outros' },
    caca: { nome: 'Caça', icone: 'lobo', cls: 'sucesso', filtro: 'outros' },
    extracao: { nome: 'Extração', icone: 'picareta', cls: 'sucesso', filtro: 'outros' },
    bloqueio: { nome: 'Ataque sem combate', icone: 'escudo', cls: 'info', filtro: 'saques' },
    roubo: { nome: 'Relíquia roubada', icone: 'lendario', cls: 'perigo', filtro: 'ataques' }
  };
  function reliquia(id) { return D.reliquias.filter(function (q) { return q.id === id; })[0]; }
  var filtroRel = 'todos';
  function resumoRel(r) {
    if (r.tipo === 'ataque') return (r.atacante ? D.reinos[r.atacante].nome + ' (estandarte)' : 'Forças desconhecidas') + ' · ' + r.resultado.toLowerCase();
    if (r.tipo === 'saque') return 'Levou ' + Object.keys(r.levado).map(function (k) { return r.levado[k] + ' ' + k; }).join(', ');
    if (r.tipo === 'exploracao') return r.quem + ' · ' + r.revelados + ' hexágonos revelados';
    if (r.tipo === 'espionagem') return 'Dono revelado: ' + D.reinos[r.dono].nome + (r.reliquia ? ' · guarda uma relíquia' : '');
    if (r.tipo === 'roubo') return reliquia(r.reliquia).nome + ' levada por forças desconhecidas' + (RP.ladroesDe(reliquia(r.reliquia)) ? ' · ainda a caminho' : '');
    if (r.tipo === 'fauna') return r.quem + ' · ' + W.ANIMAL[r.animal].nome.toLowerCase();
    if (r.tipo === 'caca') return '+' + r.ganho.comida + ' comida, +' + r.ganho.couro + ' couro';
    if (r.tipo === 'extracao') return '+' + r.ganho.prata + ' prata';
    if (r.tipo === 'batalha') return 'Em andamento · toque para acompanhar';
    if (r.tipo === 'bloqueio') return 'Alvo sob escudo de novato · tropas voltaram';
    return '';
  }
  function itemRel(r) {
    var t = TIPO_REL[r.tipo];
    return '<a class="card rel-item' + (r.lido ? '' : ' nao-lido') + '" href="#/' + (r.tipo === 'batalha' ? 'batalha' : 'relatorio?id=' + r.id) + '">' +
      '<span class="ico-placa ico-' + t.cls + '">' + RP.icone(t.icone) + '</span><span class="rel-corpo"><b>' + RP.esc(r.titulo) + '</b><small class="fraco">' + RP.esc(resumoRel(r)) + '</small></span>' +
      '<span class="rel-tempo"><small class="fraco">' + RP.fmtHa(r.horas) + '</small>' + (r.lido ? '' : '<i class="ponto-novo" role="img" aria-label="Não lido"></i>') + '</span></a>';
  }
  function desenharRelatorios(el) {
    var filtros = [['todos', 'Todos'], ['ataques', 'Ataques'], ['saques', 'Saques'], ['exploracao', 'Exploração'], ['espionagem', 'Espionagem'], ['outros', 'Outros']];
    var lista = D.relatorios.filter(function (r) { return filtroRel === 'todos' || TIPO_REL[r.tipo].filtro === filtroRel; });
    RP.$('.rel-conteudo', el).innerHTML =
      '<div class="abas" role="tablist" aria-label="Filtrar relatórios">' + filtros.map(function (f) { return '<button class="aba" role="tab" data-filtro-rel="' + f[0] + '" aria-selected="' + (filtroRel === f[0]) + '">' + f[1] + '</button>'; }).join('') + '</div>' +
      '<div class="pilha" style="margin-top:var(--esp-3)">' + (lista.length ? lista.map(itemRel).join('') : '<p class="fraco">Nenhum relatório neste filtro.</p>') + '</div>' +
      '<p class="fraco" style="font-size:var(--fs-2);margin:var(--esp-4) 0 var(--esp-8)">Quem ataca sem estandarte aparece como forças desconhecidas: só tropas, tipo e direção de origem.</p>';
  }
  RP.registrarTela('relatorios', {
    nav: true,
    montar: function (el) {
      el.innerHTML = '<header class="topo"><h1>Relatórios</h1><button type="button" class="btn btn-fantasma btn-icone btn-sino-topo" data-abrir-notificacoes aria-label="Notificações">' + RP.icone('sino') + '<span class="contador"></span></button></header><div class="conteudo-tela rel-conteudo"></div>';
      el.addEventListener('click', function (e) { var b = e.target.closest('[data-filtro-rel]'); if (b) { filtroRel = b.getAttribute('data-filtro-rel'); desenharRelatorios(el); } });
    },
    entrar: function (el) { desenharRelatorios(el); }
  });

  function linha(r, v) { return '<div class="info-linha"><span class="fraco">' + r + '</span><span>' + v + '</span></div>'; }
  function ganhoHTML(g) { return '<span class="custos">' + Object.keys(g).map(function (k) { return '<span class="custo ganho">' + RP.icone(k, 'ico-p r-' + k) + '+' + RP.num(g[k]) + '</span>'; }).join('') + '</span>'; }
  function perdaHTML(g) { return '<span class="custos">' + Object.keys(g).map(function (k) { return '<span class="custo falta-perda">' + RP.icone(k, 'ico-p r-' + k) + '−' + RP.num(g[k]) + '</span>'; }).join('') + '</span>'; }
  function relatorioHTML(r) {
    var t = TIPO_REL[r.tipo], x = r.local && W.local(r.local), h = '', acoes = '';
    var cab = '<div class="card card-moldura rel-cab"><span class="ico-placa ico-placa-g ico-' + t.cls + '">' + RP.icone(t.icone) + '</span><div><span class="rotulo">' + t.nome + ' · ' + RP.fmtHa(r.horas) + '</span><h2>' + RP.esc(r.titulo) + '</h2></div></div>';
    if (r.tipo === 'ataque') {
      h += '<div class="secao-titulo">Atacante</div><div class="card linha atacante">' +
        (r.atacante ? RP.brasao(D.reinos[r.atacante].brasao, { tamanho: 40 }) + '<span><b>' + RP.esc(D.reinos[r.atacante].nome) + '</b><br><small class="fraco">Identificado: levava o estandarte</small></span>'
          : RP.brasao(null, { tamanho: 40, desconhecido: true }) + '<span><b>Forças desconhecidas</b><br><small class="fraco">Sem estandarte. Batedores podem descobrir quem foi.</small></span>') + '</div>' +
        '<div class="card info" style="margin-top:var(--esp-3)">' + linha('Local', RP.esc(x.nome)) + linha('Tipo de ataque', r.tipoAtaque) + linha('Forças', RP.esc(r.forcas)) + linha('Vindas do', r.origem) +
        linha('Resultado', '<span class="selo ' + (r.resultado === 'Repelido' ? 'selo-visivel' : 'selo-perigo') + '">' + r.resultado + '</span>') +
        linha('Suas perdas', RP.esc(r.perdas.meu)) + linha('Perdas deles', RP.esc(r.perdas.deles)) + (r.levado ? linha('Levado', perdaHTML(r.levado)) : '') + '</div>';
      acoes = '<a class="btn btn-p btn-primario" href="#/exploradores?tipo=batedor&alvo=' + x.c + ',' + x.l + '">' + RP.icone('batedor') + 'Enviar batedor</a><a class="btn btn-p" href="#/mapa?modo=cena&centro=' + x.id + '">' + RP.icone('vista') + 'Ver local</a>';
    } else if (r.tipo === 'saque') {
      h += '<div class="card info">' + linha('Alvo', RP.esc(x.nome) + ' · ' + RP.esc(D.reinos[x.reino].nome)) + linha('Tropas', RP.esc(r.tropas)) + linha('Resultado', '<span class="selo selo-visivel">' + r.resultado + '</span>') +
        linha('Levado', ganhoHTML(r.levado)) + linha('Suas perdas', RP.esc(r.perdas.meu)) + linha('Perdas deles', RP.esc(r.perdas.deles)) + linha('Estandarte', r.estandarte ? 'Levado' : 'Não levado: o alvo não sabe quem foi') + '</div>' +
        (r.objetivos ? '<div class="secao-titulo">Objetivos · tática ' + RP.esc(r.tatica.toLowerCase()) + '</div><div class="card lista">' + r.objetivos.map(function (o, i) {
          var ic = o.estado === 'ok' ? 'check' : o.estado === 'parcial' ? 'alerta' : 'fechar', cls = o.estado === 'ok' ? 'selo-visivel' : o.estado === 'parcial' ? 'selo-antigo' : 'selo-perigo';
          return '<div class="lista-item"><span class="obj-n">' + (i + 1) + '</span><span style="flex:1;min-width:0"><b>' + RP.esc(o.txt) + '</b><br><small class="fraco">' + RP.esc(o.nota) + '</small></span><span class="selo ' + cls + '">' + RP.icone(ic) + RP.esc(o.obtido) + '</span></div>';
        }).join('') + '</div>' +
          '<p class="nota-regra" style="margin-top:var(--esp-3)">' + RP.icone('voltar', 'ico-p') + '<span><b>Por que voltaram:</b> ' + RP.esc(r.retorno) + '</span></p>' : '') +
        (r.decrescente ? '<p class="nota-antiga" style="margin-top:var(--esp-3)">' + RP.icone('info', 'ico-p') + r.decrescente.vezes + 'º saque a este alvo em 24 h: rendimento −' + r.decrescente.reducao + '%. Saques repetidos rendem cada vez menos.</p>' : '');
      acoes = '<a class="btn btn-p btn-primario" href="#/envio?alvo=' + x.id + '">' + RP.icone('tropas') + 'Atacar de novo</a><a class="btn btn-p" href="#/mapa?modo=tatico&abrir=local:' + x.id + '">' + RP.icone('mapa') + 'Ver no mapa</a>';
    } else if (r.tipo === 'exploracao') {
      h += '<div class="card info">' + linha('Quem', RP.esc(r.quem)) + linha('Revelado', r.revelados + ' hexágonos') + '</div><div class="secao-titulo">Achados</div><ul class="regras-lista card">' +
        r.achados.map(function (a) { return '<li>' + RP.icone('olho', 'ico-p') + RP.esc(a) + '</li>'; }).join('') + '</ul>';
      acoes = '<a class="btn btn-p btn-primario" href="#/mapa?modo=tatico">' + RP.icone('mapa') + 'Ver no mapa</a><a class="btn btn-p" href="#/exploradores">' + RP.icone('explorador') + 'Explorar mais</a>';
    } else if (r.tipo === 'espionagem') {
      h += '<div class="card linha atacante">' + RP.brasao(D.reinos[r.dono].brasao, { tamanho: 40 }) + '<span><b>' + RP.esc(D.reinos[r.dono].nome) + '</b><br><small class="fraco">Dono de ' + RP.esc(x.nome) + ', revelado pela espionagem</small></span></div>' +
        '<div class="card info" style="margin-top:var(--esp-3)">' + linha('Quem', RP.esc(r.quem)) + linha('Defesa', RP.esc(r.defesa)) + linha('Produção', RP.esc(r.producao)) + (r.estoque ? linha('Estoque', RP.esc(r.estoque)) : '') + linha('Tropas vistas', RP.esc(r.tropasVistas)) +
        linha('Batedor', r.descoberto ? '<span class="selo selo-perigo">Descoberto</span>' : '<span class="selo selo-visivel">Não foi descoberto</span>') + '</div>' +
        (r.reliquia ? '<div class="secao-titulo">Relíquia encontrada</div><div class="card relq-card tipo-' + reliquia(r.reliquia).tipo + '"><div class="linha"><span class="relq-ico">' + RP.icone('lendario') + '</span><span style="flex:1;min-width:0"><b>' + RP.esc(reliquia(r.reliquia).nome) + '</b><br><small class="fraco">Guardada em ' + RP.esc(x.nome) + '</small></span></div>' +
          '<p class="relq-efeito">' + RP.icone('subir', 'ico-p') + RP.RELIQUIA[reliquia(r.reliquia).tipo].efeito(reliquia(r.reliquia).bonus) + '</p><small class="fraco">Saque, ocupação ou cerco vitorioso neste local levam a relíquia.</small></div>' : '');
      acoes = '<a class="btn btn-p btn-primario" href="#/envio?alvo=' + x.id + '">' + RP.icone('tropas') + (r.reliquia ? 'Planejar roubo' : 'Planejar ataque') + '</a><a class="btn btn-p" href="#/mapa?modo=tatico&abrir=local:' + x.id + '">' + RP.icone('mapa') + 'Ver no mapa</a>';
    } else if (r.tipo === 'fauna') {
      var f = D.fauna.filter(function (q) { return q.tipo === r.animal; }).sort(function (a, b) { return a.nivel === 'alto' ? -1 : 1; })[0];
      h += '<div class="card info">' + linha('Quem', RP.esc(r.quem)) + linha('Animais', W.ANIMAL[r.animal].nome) + linha('Onde', RP.esc(r.onde)) + '</div>' +
        '<div class="perigo-linha nivel-alto">' + RP.icone(W.ANIMAL[r.animal].icone) + '<span><b>' + RP.esc(r.resultado) + '</b><br><small>Exploradores sozinhos e grupos pequenos correm risco. Prefira a rota segura ou leve escolta.</small></span></div>';
      acoes = '<a class="btn btn-p btn-primario" href="#/caca?fauna=' + (f ? f.id : '') + '">' + RP.icone('lobo') + 'Caçar estes animais</a><a class="btn btn-p" href="#/exploradores">' + RP.icone('explorador') + 'Novo explorador</a>';
    } else if (r.tipo === 'caca') {
      h += '<div class="card info">' + linha('Grupo', RP.esc(r.grupo)) + linha('Animais', W.ANIMAL[r.animal].nome) + linha('Ganho', ganhoHTML(r.ganho)) + linha('Perdas', RP.esc(r.perdas)) + '</div>' +
        '<p class="fraco" style="font-size:var(--fs-2);margin-top:var(--esp-3)">Os animais reaparecem com o tempo.</p>';
      acoes = '<a class="btn btn-p btn-primario" href="#/caca">' + RP.icone('lobo') + 'Caçar de novo</a>';
    } else if (r.tipo === 'bloqueio') {
      h += '<div class="card info">' + linha('Alvo', RP.esc(W.nomeAparente(x)) + ' · dono desconhecido') + linha('Tipo de ataque', r.tipoAtaque) + linha('Tropas', RP.esc(r.tropas)) +
        linha('Resultado', '<span class="selo selo-info">' + RP.icone('escudo') + 'Sem combate</span>') + linha('Perdas', 'Nenhuma') + '</div>' +
        '<p class="nota-regra" style="margin-top:var(--esp-3)">' + RP.icone('info', 'ico-p') + '<span>O alvo estava sob escudo de novato. O escudo só é descoberto ao chegar: suas tropas voltaram para o castelo.</span></p>';
      acoes = '<a class="btn btn-p btn-primario" href="#/envio">' + RP.icone('tropas') + 'Escolher outro alvo</a><a class="btn btn-p" href="#/mapa?modo=tatico&abrir=local:' + x.id + '">' + RP.icone('mapa') + 'Ver no mapa</a>';
    } else if (r.tipo === 'roubo') {
      var rl = reliquia(r.reliquia);
      h += '<div class="secao-titulo">Atacante</div><div class="card linha atacante">' + RP.brasao(null, { tamanho: 40, desconhecido: true }) + '<span><b>Forças desconhecidas</b><br><small class="fraco">Sem estandarte. Batedores podem descobrir quem foi e onde a relíquia está.</small></span></div>' +
        '<div class="card relq-card roubada tipo-' + rl.tipo + '" style="margin-top:var(--esp-3)"><div class="linha"><span class="relq-ico">' + RP.icone('lendario') + '</span><span style="flex:1;min-width:0"><b>' + RP.esc(rl.nome) + '</b><br><small class="fraco">Estava em ' + RP.esc(x.nome) + '</small></span><span class="selo selo-perigo">' + (RP.ladroesDe(rl) ? 'Em fuga' : 'Perdida') + '</span></div>' +
          '<p class="relq-efeito">' + RP.icone('menos', 'ico-p') + 'Você perdeu: ' + RP.RELIQUIA[rl.tipo].efeito(rl.bonus) + '</p></div>' +
        '<div class="card info" style="margin-top:var(--esp-3)">' + linha('Tipo de ataque', r.tipoAtaque) + linha('Forças', RP.esc(r.forcas)) + linha('Vindas do', r.origem) +
        linha('Resultado', '<span class="selo selo-perigo">Local saqueado</span>') + linha('Suas perdas', RP.esc(r.perdas.meu)) + linha('Perdas deles', RP.esc(r.perdas.deles)) + (r.levado ? linha('Também levado', perdaHTML(r.levado)) : '') + '</div>' +
        (RP.ladroesDe(rl)
          ? '<p class="nota-antiga nota-perigo" style="margin-top:var(--esp-3)">' + RP.icone('alerta', 'ico-p pulso') + '<span>As tropas que levam a relíquia ainda estão a caminho, rumo ao ' + RP.esc(RP.ladroesDe(rl).d.rumo) + '. Somem na névoa em <b class="num" data-fim="' + RP.ladroesDe(rl).d.chegada + '">' + RP.fmtResta(RP.ladroesDe(rl).d.chegada - Date.now()) + '</b>: dá para interceptar.</span></p>'
          : '<p class="nota-regra" style="margin-top:var(--esp-3)">' + RP.icone('info', 'ico-p') + '<span>As forças chegaram ao destino. Relíquias de outros reinos só aparecem depois de espionadas: espione na direção ' + (r.origem === 'leste' ? 'do leste' : 'de origem') + ' para achar a sua.</span></p>');
      acoes = RP.ladroesDe(rl)
        ? '<a class="btn btn-p btn-primario" href="#/interceptar?marcha=' + RP.ladroesDe(rl).d.id + '">' + RP.icone('alvo') + 'Interceptar</a><a class="btn btn-p" href="#/mapa?modo=cena&abrir=marcha:' + RP.ladroesDe(rl).d.id + '">' + RP.icone('vista') + 'Ver na Vista</a>'
        : '<a class="btn btn-p btn-primario" href="#/exploradores?tipo=batedor">' + RP.icone('batedor') + 'Espionar para achar</a><a class="btn btn-p" href="#/reliquias">' + RP.icone('lendario') + 'Relíquias</a>';
    } else if (r.tipo === 'extracao') {
      var j = W.jazida(r.jazida);
      h += '<div class="card info">' + linha('Jazida', RP.esc(j.nome)) + linha('Ganho', ganhoHTML(r.ganho)) + '</div>' +
        '<div class="card timer" style="margin-top:var(--esp-3)"><div class="timer-topo"><b>Jazida restante</b><span class="timer-resta">' + Math.round(r.restante * 100) + '%</span></div><div class="barra barra-sucesso"><i style="width:' + (r.restante * 100) + '%"></i></div></div>';
      acoes = '<a class="btn btn-p btn-primario" href="#/extracao?jazida=' + j.id + '">' + RP.icone('picareta') + 'Ver extração</a>';
    }
    return { html: cab + h, acoes: acoes };
  }
  RP.registrarTela('relatorio', {
    secao: 'relatorios',
    montar: function (el) { el.innerHTML = U.topo('Relatório', 'relatorios') + '<div class="conteudo-tela rel-detalhe"></div><div class="rodape-acao rel-acoes"></div>'; },
    entrar: function (el, params) {
      var r = D.relatorios.filter(function (q) { return q.id === params.get('id'); })[0] || D.relatorios[1];
      r.lido = true;
      var o = relatorioHTML(r);
      RP.$('.rel-detalhe', el).innerHTML = o.html + '<div style="height:120px"></div>';
      RP.$('.rel-acoes', el).innerHTML = o.acoes;
      RP.atualizarContadores();
    }
  });

  /* ================================================================ Notificações */
  var CAT = {
    ataque: { nome: 'Ataques e batalhas', icone: 'alerta', cls: 'perigo' },
    construcao: { nome: 'Construções', icone: 'martelo', cls: 'destaque' },
    recrutamento: { nome: 'Recrutamento', icone: 'tropas', cls: 'destaque' },
    exploracao: { nome: 'Exploração e espionagem', icone: 'explorador', cls: 'info' },
    fauna: { nome: 'Fauna', icone: 'pata', cls: 'alerta' },
    social: { nome: 'Bandeiras perto de você', icone: 'bandeira', cls: 'info' },
    temporada: { nome: 'Temporada', icone: 'temporada', cls: 'destaque' }
  };
  function itemNot(n) {
    var c = CAT[n.cat];
    return '<a class="not-item' + (n.lido ? '' : ' nao-lido') + '" href="#/' + n.ir + '" data-notificacao="' + n.id + '">' +
      '<span class="ico-placa ico-' + c.cls + '">' + RP.icone(c.icone) + '</span><span class="not-corpo"><b>' + RP.esc(n.titulo) + '</b><span class="suave">' + RP.esc(n.texto) + '</span><small class="fraco">' + RP.fmtHa(n.horas) + '</small></span>' +
      (n.lido ? '' : '<i class="ponto-novo" role="img" aria-label="Não lida"></i>') + '</a>';
  }
  function push(titulo, texto, quando, critico) {
    return '<div class="push' + (critico ? ' critico' : '') + '"><div class="push-topo"><span class="push-app">' + RP.icone('castelo') + '</span><span>REINO DE PEDRA</span><span>' + quando + '</span></div><b>' + RP.esc(titulo) + '</b><span>' + RP.esc(texto) + '</span></div>';
  }
  function desenharNotificacoes(el) {
    var grupos = [['Agora', function (n) { return n.horas < 1; }], ['Hoje', function (n) { return n.horas >= 1 && n.horas < 24; }], ['Antes', function (n) { return n.horas >= 24; }]];
    var pref = D.preferenciasPush;
    RP.$('.not-conteudo', el).innerHTML =
      '<div class="linha-entre"><span class="fraco">' + D.notificacoes.filter(function (n) { return !n.lido; }).length + ' não lidas</span><button type="button" class="btn btn-p btn-fantasma" data-ler-todas>' + RP.icone('check') + 'Marcar todas como lidas</button></div>' +
      grupos.map(function (g) {
        var l = D.notificacoes.filter(g[1]);
        return l.length ? '<div class="secao-titulo">' + g[0] + '</div><div class="card lista-not">' + l.map(itemNot).join('') + '</div>' : '';
      }).join('') +
      '<div class="secao-titulo">No celular</div><p class="fraco" style="font-size:var(--fs-2);margin-bottom:var(--esp-3)">Assim os avisos chegam com o jogo fechado. Você escolhe, por categoria, o que chega.</p>' +
      '<div class="pushes">' + push('Vila do Vau está sendo atacada', 'Forças desconhecidas. Toque para enviar reforços ou recuar.', 'agora', true) +
      push('Explorador chegou ao destino', 'Explorador a cavalo revelou 14 hexágonos ao norte.', '2 h') +
      push('Fila de obras concluída', 'Todas as 3 obras terminaram durante a noite.', '06:40') + '</div>' +
      '<div class="secao-titulo">Avisar no celular</div><div class="card pilha">' + Object.keys(CAT).map(function (k) {
        var c = CAT[k];
        return '<button type="button" class="alternar" data-pref="' + k + '" aria-pressed="' + !!pref[k] + '">' + RP.icone(c.icone) + '<span>' + c.nome + '</span><i aria-hidden="true"></i></button>';
      }).join('') + '</div>' +
      '<div style="height:var(--esp-8)"></div>';
  }
  RP.registrarTela('notificacoes', {
    montar: function (el) {
      el.innerHTML = '<header class="topo"><button type="button" class="btn btn-fantasma btn-icone" data-voltar aria-label="Voltar">' + RP.icone('voltar') + '</button><div class="topo-titulos"><h1>Notificações</h1></div></header><div class="conteudo-tela not-conteudo"></div>';
      el.addEventListener('click', function (e) {
        var b;
        if (e.target.closest('[data-ler-todas]')) { D.notificacoes.forEach(function (n) { n.lido = true; }); desenharNotificacoes(el); RP.atualizarContadores(); return; }
        if ((b = e.target.closest('[data-notificacao]'))) { D.notificacoes.filter(function (n) { return n.id === b.getAttribute('data-notificacao'); })[0].lido = true; return; }
        if ((b = e.target.closest('[data-pref]'))) {
          var k = b.getAttribute('data-pref'); D.preferenciasPush[k] = !D.preferenciasPush[k]; b.setAttribute('aria-pressed', String(D.preferenciasPush[k]));
        }
      });
    },
    entrar: function (el) { desenharNotificacoes(el); }
  });
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-voltar]')) { if (history.length > 1) history.back(); else RP.ir('mapa'); }
  });

  /* ================================================================ Bandeiras */
  var LIMITE_BANDEIRAS = 20;
  var TIPOS_B = [
    { id: 'reivindicacao', icone: 'coroa', txt: 'Diz que o lugar é seu ou será.' },
    { id: 'ameaca', icone: 'tropas', txt: 'Avisa que quem passar será atacado.' },
    { id: 'alianca', icone: 'escudo', txt: 'Convida vizinhos para um acordo.' },
    { id: 'aviso', icone: 'info', txt: 'Qualquer recado: rota, perigo, combinado.' }
  ];
  function minhas() { return D.bandeiras.filter(function (b) { return b.reino === 'meu'; }); }
  function itemBandeira(b, minha) {
    var r = D.reinos[b.reino], e = W.estado(b.c, b.l);
    return '<div class="card band-item"><div class="linha">' + RP.brasao(r.brasao, { tamanho: 30, desconhecido: !r.brasao }) +
      '<span style="flex:1;min-width:0"><b>“' + RP.esc(b.texto) + '”</b><br><small class="fraco">' + RP.TIPOS_BANDEIRA[b.tipo] + ' · ' + (minha ? 'você' : RP.esc(r.nome)) + ' · ' + b.c + ', ' + b.l + (e.v === 'explorado' ? ' · visto ' + RP.fmtHa(e.horas) : '') + '</small></span></div>' +
      '<div class="linha band-acoes"><a class="btn btn-p" href="#/mapa?modo=cena&abrir=bandeira:' + b.id + '">' + RP.icone('vista') + 'Ver</a>' +
      (minha ? '<button type="button" class="btn btn-p btn-fantasma" data-remover-bandeira="' + b.id + '">' + RP.icone('fechar') + 'Remover</button>'
        : (b.derrubarEm ? '<span class="selo selo-info">' + RP.icone('tropas') + 'Derrubando · <span data-fim="' + b.derrubarEm + '">' + RP.fmtResta(b.derrubarEm - Date.now()) + '</span></span>'
          : '<button type="button" class="btn btn-p" data-derrubar="' + b.id + '">' + RP.icone('tropas') + 'Derrubar</button>') +
          '<button type="button" class="btn btn-p btn-fantasma btn-icone" data-denunciar="' + b.id + '" aria-label="Denunciar texto" title="Denunciar texto">' + RP.icone('alerta') + '</button>') + '</div></div>';
  }
  function desenharBandeiras(el) {
    var m = minhas(), outras = D.bandeiras.filter(function (b) { return b.reino !== 'meu' && W.estado(b.c, b.l).v !== 'desconhecido'; });
    RP.$('.band-conteudo', el).innerHTML =
      '<div class="nota-regra">' + RP.icone('bandeira', 'ico-p') + '<span>Bandeiras são sinais para outros jogadores: valor social, sem efeito no jogo. <b>Sempre mostram quem as colocou.</b> Qualquer jogador pode derrubá-las com tropas no local.</span></div>' +
      '<div class="secao-titulo">Suas bandeiras · ' + m.length + ' de ' + LIMITE_BANDEIRAS + '</div><div class="pilha">' + (m.length ? m.map(function (b) { return itemBandeira(b, true); }).join('') : '<p class="fraco">Nenhuma bandeira colocada.</p>') + '</div>' +
      '<div class="secao-titulo">Perto de você</div><div class="pilha">' + outras.map(function (b) { return itemBandeira(b, false); }).join('') + '</div><div style="height:120px"></div>';
  }
  /* derrubar bandeira alheia: uma tropa vai até o local (o dono não é avisado de quem foi) */
  var telaBandeiras = null;
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-derrubar]');
    if (!b) return;
    var band = W.bandeira(b.getAttribute('data-derrubar'));
    if (!band || band.derrubarEm) return;
    var c0 = W.local('castelo'), r = RP.caminho([c0.c, c0.l], [band.c, band.l], { vel: 'Lenta' });
    if (!r) { RP.aviso({ titulo: 'Sem caminho até a bandeira', icone: 'alerta', tipo: 'alerta' }); return; }
    RP.modal({
      titulo: 'Derrubar esta bandeira?',
      corpo: '<p class="suave">“' + RP.esc(band.texto) + '”<br>Um lanceiro do castelo vai até o local e derruba a bandeira. Chegada em ' + RP.fmtDuracao(r.seg) + '.</p>',
      acoes: [{ rotulo: RP.icone('tropas') + 'Derrubar', classe: 'btn-primario', acao: function () {
        W.adicionarMarcha({ id: 'm-derrubar-' + Date.now(), dono: 'meu', tipo: 'exercito', nome: 'Derrubar bandeira', resumo: '1 lanceiro → bandeira de ' + D.reinos[band.reino].nome, seg: r.seg }, r.hexes);
        band.derrubarEm = Date.now() + r.seg * 1000;
        D.disponiveis.lanceiro = Math.max(0, (D.disponiveis.lanceiro || 0) - 1);
        RP.fecharFolha();
        RP.invalidarTela('mapa'); RP.invalidarTela('tropas');
        RP.aviso({ titulo: 'Lanceiro a caminho', texto: 'A bandeira cai em ' + RP.fmtDuracao(r.seg) + '.', icone: 'tropas', tipo: 'sucesso' });
        if (telaBandeiras && !telaBandeiras.hidden) desenharBandeiras(telaBandeiras);
      } }, { rotulo: 'Cancelar' }]
    });
  });
  document.addEventListener('rp:tique', function () {
    var agora = Date.now(), caidas = D.bandeiras.filter(function (b) { return b.derrubarEm && b.derrubarEm <= agora; });
    if (!caidas.length) return;
    D.bandeiras = D.bandeiras.filter(function (b) { return !(b.derrubarEm && b.derrubarEm <= agora); });
    caidas.forEach(function (b) { var k = W.chave(b.c, b.l); if (W.porHex[k]) W.porHex[k] = W.porHex[k].filter(function (it) { return it.o !== b; }); });
    RP.invalidarTela('mapa');
    caidas.forEach(function (b) { RP.aviso({ titulo: 'Bandeira derrubada', texto: '“' + b.texto + '”', icone: 'bandeira', tipo: 'sucesso' }); });
    if (telaBandeiras && !telaBandeiras.hidden) desenharBandeiras(telaBandeiras);
  });

  RP.registrarTela('bandeiras', {
    secao: 'mais',
    montar: function (el) {
      telaBandeiras = el;
      el.innerHTML = U.topo('Bandeiras', 'mais') + '<div class="conteudo-tela band-conteudo"></div><div class="rodape-acao"><a class="btn btn-primario btn-bloco btn-grande" href="#/bandeira-nova">' + RP.icone('bandeira') + 'Colocar bandeira</a></div>';
      el.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-remover-bandeira]'))) {
          var id = b.getAttribute('data-remover-bandeira');
          D.bandeiras = D.bandeiras.filter(function (q) { return q.id !== id; });
          RP.invalidarTela('mapa');
          RP.aviso({ titulo: 'Bandeira removida', icone: 'bandeira', tipo: 'sucesso', ms: 1800 });
          desenharBandeiras(el);
        } else if ((b = e.target.closest('[data-denunciar]'))) {
          RP.modal({ titulo: 'Denunciar texto da bandeira?', corpo: '<p class="suave">A bandeira some para você agora e o texto vai para revisão. Use para ofensas ou assédio.</p>',
            acoes: [{ rotulo: 'Denunciar', classe: 'btn-perigo', acao: function () { RP.aviso({ titulo: 'Denúncia enviada', texto: 'Obrigado. A bandeira foi ocultada para você.', icone: 'check', tipo: 'sucesso' }); } }, { rotulo: 'Cancelar' }] });
        }
      });
    },
    entrar: function (el) { desenharBandeiras(el); }
  });

  var nova = { alvo: null, tipo: 'aviso', texto: '' };
  function flagSVG(cor, tam) {
    return '<svg viewBox="0 0 40 52" width="' + tam + '" height="' + Math.round(tam * 1.3) + '" aria-hidden="true"><path d="M8 50V4" stroke="#d8cdb8" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M8 5h26l-6 8 6 8H8z" style="fill:' + cor + '" stroke="#0b0c0e" stroke-width="1.5" stroke-linejoin="round"/><circle cx="8" cy="3.5" r="3" fill="#d9b25c"/></svg>';
  }
  function desenharNova(el) {
    var a = nova.alvo, e = W.estado(a[0], a[1]), t = W.T[a[1]][a[0]];
    var lugar = (e.v === 'desconhecido' ? 'Terra desconhecida' : H.TERRENOS[t].nome) + ' · ' + a[0] + ', ' + a[1];
    var tipoNome = RP.TIPOS_BANDEIRA[nova.tipo], cor = getComputedStyle(document.documentElement).getPropertyValue('--cor-meu').trim();
    var n = nova.texto.trim().length;
    RP.$('.bn-conteudo', el).innerHTML =
      '<div class="secao-titulo" style="margin-top:0">Onde</div><div class="card linha destino-card"><span class="ico-placa">' + RP.icone(e.v === 'desconhecido' ? 'nevoa' : 'alvo') + '</span><div style="flex:1"><b>' + lugar + '</b><br><small class="fraco">Bandeiras podem ir em qualquer lugar, até na névoa.</small></div><a class="btn btn-p" href="#/mapa?modo=tatico">' + RP.icone('mapa') + 'Trocar</a></div>' +
      '<div class="secao-titulo">Tipo</div><div class="escolhas">' + TIPOS_B.map(function (tb) {
        return '<button type="button" class="escolha" data-tipo-bandeira="' + tb.id + '" aria-pressed="' + (nova.tipo === tb.id) + '"><span class="linha"><span class="ico-placa">' + RP.icone(tb.icone) + '</span><b>' + RP.TIPOS_BANDEIRA[tb.id] + '</b></span><small class="fraco">' + tb.txt + '</small></button>';
      }).join('') + '</div>' +
      '<div class="secao-titulo">Recado</div><div class="campo"><label for="texto-bandeira">Texto da bandeira</label><input id="texto-bandeira" type="text" maxlength="60" value="' + RP.esc(nova.texto) + '" placeholder="Ex.: Estrada do Rei: passagem livre." autocomplete="off"><span class="campo-ajuda"><span data-contador>' + n + '</span>/60 · todos verão seu brasão e nome</span></div>' +
      '<div class="secao-titulo">Prévia</div><div class="card band-previa">' + flagSVG(cor, 40) + '<div><span class="rotulo">' + tipoNome + '</span><b class="band-previa-texto">“' + RP.esc(nova.texto.trim() || 'Seu recado aqui') + '”</b><div class="linha" style="margin-top:6px">' + RP.brasao(RP.estado.brasao, { tamanho: 20 }) + '<small class="fraco">Reino de ' + RP.esc(RP.estado.nome) + '</small></div></div></div><div style="height:120px"></div>';
    RP.$('[data-colocar]', el).classList.toggle('btn-inativo', n < 3);
    var inp = RP.$('#texto-bandeira', el);
    inp.addEventListener('input', function () {
      nova.texto = inp.value;
      RP.$('[data-contador]', el).textContent = inp.value.trim().length;
      RP.$('.band-previa-texto', el).textContent = '“' + (inp.value.trim() || 'Seu recado aqui') + '”';
      RP.$('[data-colocar]', el).classList.toggle('btn-inativo', inp.value.trim().length < 3);
    });
  }
  RP.registrarTela('bandeira-nova', {
    secao: 'mais',
    montar: function (el) {
      el.innerHTML = U.topo('Colocar bandeira', 'bandeiras') + '<div class="conteudo-tela bn-conteudo"></div><div class="rodape-acao"><button type="button" class="btn btn-primario btn-bloco btn-grande" data-colocar>' + RP.icone('bandeira') + 'Colocar bandeira</button></div>';
      el.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-tipo-bandeira]'))) { nova.tipo = b.getAttribute('data-tipo-bandeira'); desenharNova(el); return; }
        if (e.target.closest('[data-colocar]')) {
          if (nova.texto.trim().length < 3) { RP.aviso({ titulo: 'Escreva o recado', texto: 'Pelo menos 3 letras.', icone: 'info', tipo: 'alerta' }); RP.$('#texto-bandeira', el).focus(); return; }
          if (minhas().length >= LIMITE_BANDEIRAS) { RP.aviso({ titulo: 'Limite de ' + LIMITE_BANDEIRAS + ' bandeiras', texto: 'Remova uma antes de colocar outra.', icone: 'bandeira', tipo: 'alerta' }); return; }
          var id = 'b-' + Date.now();
          D.bandeiras.push({ id: id, reino: 'meu', tipo: nova.tipo, texto: nova.texto.trim().slice(0, 60), c: nova.alvo[0], l: nova.alvo[1] });
          W.porHex[W.chave(nova.alvo[0], nova.alvo[1])] = (W.porHex[W.chave(nova.alvo[0], nova.alvo[1])] || []).concat([{ tipo: 'bandeira', o: D.bandeiras[D.bandeiras.length - 1] }]);
          nova.texto = '';
          RP.invalidarTela('mapa'); RP.invalidarTela('bandeiras');
          RP.aviso({ titulo: 'Bandeira colocada', texto: 'Visível para quem passar por ali.', icone: 'bandeira', tipo: 'sucesso' });
          RP.ir('mapa?modo=cena&abrir=bandeira:' + id);
        }
      });
    },
    entrar: function (el, params) {
      var a = params.get('alvo');
      nova.alvo = a ? a.split(',').map(Number) : (nova.alvo || [16, 21]);
      desenharNova(el);
    }
  });
  /* ================================================================ Ranking da temporada */
  var CAT_RANK = [
    { id: 'baixas', nome: 'Baixas', txt: 'Tropas inimigas abatidas', icone: 'tropas' },
    { id: 'perdas', nome: 'Perdas', txt: 'Tropas próprias perdidas', icone: 'escudo' },
    { id: 'tropas', nome: 'Tropas', txt: 'Tamanho do exército hoje', icone: 'estandarte' },
    { id: 'familias', nome: 'Famílias', txt: 'População do reino', icone: 'populacao' }
  ];
  var catRank = 'baixas';
  function nomeRank(r) { return r.reino ? (r.reino === 'meu' ? 'Reino de ' + RP.estado.nome : D.reinos[r.reino].nome) : r.nome; }
  function brasaoRank(r) { return r.reino ? (r.reino === 'meu' ? RP.estado.brasao : D.reinos[r.reino].brasao) : r.brasao; }
  function desenharRanking(el) {
    var cat = CAT_RANK.filter(function (c) { return c.id === catRank; })[0];
    var lista = D.ranking.reinos.slice().sort(function (a, b) { return b[catRank] - a[catRank]; });
    var top = lista.filter(function (r) { return r.reino !== 'meu'; }).slice(0, 10), eu = lista.filter(function (r) { return r.reino === 'meu'; })[0];
    var max = top[0][catRank], pos = D.ranking.minhaPosicao[catRank];
    function linhaRank(r, p, meu) {
      var outros = CAT_RANK.filter(function (c) { return c.id !== catRank; }).map(function (c) { return c.nome.toLowerCase() + ' ' + RP.num(r[c.id]); }).join(' · ');
      return '<li class="rank-linha' + (meu ? ' meu' : '') + (p <= 3 ? ' podio' : '') + '"><span class="rank-pos num">' + p + 'º</span>' + RP.brasao(brasaoRank(r), { tamanho: 28 }) +
        '<span class="rank-corpo"><span class="linha-entre"><b>' + RP.esc(nomeRank(r)) + '</b><b class="num rank-valor">' + RP.num(r[catRank]) + '</b></span>' +
        '<span class="rank-barra" aria-hidden="true"><i style="width:' + Math.max(2, (100 * r[catRank]) / max).toFixed(1) + '%"></i></span><small class="fraco">' + outros + '</small></span></li>';
    }
    RP.$('.rank-conteudo', el).innerHTML =
      '<div class="nota-regra">' + RP.icone('info', 'ico-p') + '<span>O ranking não mede território: a disputa pelo mapa continua sem placar. Famílias = população do reino.</span></div>' +
      '<div class="abas" role="tablist" aria-label="Categoria do ranking" style="margin-top:var(--esp-3)">' + CAT_RANK.map(function (c) { return '<button class="aba" role="tab" data-cat-rank="' + c.id + '" aria-selected="' + (c.id === catRank) + '">' + c.nome + '</button>'; }).join('') + '</div>' +
      '<div class="card rank-eu"><span class="ico-placa">' + RP.icone(cat.icone) + '</span><span style="flex:1"><span class="rotulo">' + cat.txt + '</span><b class="rank-eu-pos">Você: ' + pos + 'º</b><small class="fraco">de ' + RP.num(D.temporada.reinos) + ' reinos</small></span><b class="num rank-eu-valor">' + RP.num(eu[catRank]) + '</b></div>' +
      '<div class="secao-titulo">Os 10 primeiros · ' + cat.nome.toLowerCase() + '</div><ol class="card rank-lista">' + top.map(function (r, i) { return linhaRank(r, i + 1, false); }).join('') + '</ol>' +
      '<div class="secao-titulo">Sua posição</div><ol class="card rank-lista">' + linhaRank(eu, pos, true) + '</ol><div style="height:var(--esp-8)"></div>';
  }
  RP.registrarTela('ranking', {
    secao: 'mais',
    montar: function (el) {
      el.innerHTML = U.topo('Ranking da temporada', 'temporada', 'Temporada ' + D.temporada.numero + ' · ' + RP.num(D.temporada.reinos) + ' reinos') + '<div class="conteudo-tela rank-conteudo"></div>';
      el.addEventListener('click', function (e) { var b = e.target.closest('[data-cat-rank]'); if (b) { catRank = b.getAttribute('data-cat-rank'); desenharRanking(el); } });
    },
    entrar: function (el) { desenharRanking(el); }
  });
})();
