/* Reino de Pedra — Comércio e diplomacia (#/comercio), Propor troca (#/troca?reino=<id>) e Propor pacto (#/pacto?reino=<id>).
   Sem mercado global: troca só com reinos conhecidos; as cargas saem dos locais mais próximos e viajam visíveis (roubáveis).
   Pacto garantido pelo jogo, resgate de explorador e limite do novato. Porte de prototipo/js/comercio.js. */
(function () {
  'use strict';
  var RP = window.RP, S = RP.social;
  var dados = null;

  function carregar() {
    return RP.get('/comercio').then(function (d) {
      dados = d; RP.sincronizar(d.agora);
      RP.config = RP.config || {}; RP.config.valor = d.valor; RP.config.novatoDia = d.novatoDia;
      return d;
    });
  }
  function conhecido(id) { return dados.conhecidos.filter(function (c) { return c.reino.id === id; })[0]; }
  function dias(n) { return n + (n > 1 ? ' dias' : ' dia'); }
  function seloValor(recebe, da) {
    var a = S.valor(recebe), b = S.valor(da), d = b ? Math.round(100 * (a - b) / b) : 0;
    return '<span class="selo ' + (d > 2 ? 'selo-visivel' : d < -2 ? 'selo-perigo' : '') + '">' + (d > 2 ? 'A seu favor +' + d + '%' : d < -2 ? 'Contra você ' + d + '%' : 'Equilibrada') + '</span>';
  }
  function notaNovato(c) {
    if (!c || !c.escudo) return '';
    return '<p class="nota-antiga">' + RP.icone('escudo', 'ico-p') + '<span>' + RP.esc(c.reino.nome) + ' está sob escudo de novato: trocas, ajudas e pagamentos com diferença de valor somam até ' + RP.num(dados.novatoDia) + ' por dia (restam ' + RP.num(c.novatoRestante) + ' hoje). Ninguém pode cobrar pacto dele.</span></p>';
  }
  function restoNovato(c, dif) {
    var lim = Infinity;
    if (c && c.novatoRestante != null) lim = Math.min(lim, c.novatoRestante);
    if (dados.eu.novatoRestante != null) lim = Math.min(lim, dados.eu.novatoRestante);
    return dif > lim ? 'Passa do limite de hoje do reino sob escudo de novato (restam ' + RP.num(lim) + '; esta tem ' + RP.num(dif) + ').' : null;
  }

  /* ---------------------------------------------------------------- tela Comércio */
  function cardTroca(p) {
    var c = conhecido(p.de.id), aviso = restoNovato(c, Math.abs(S.valor(p.da) - S.valor(p.quer)));
    return '<div class="card pilha"><div class="linha">' + S.brasao(p.de) + '<span style="flex:1;min-width:0"><b>' + RP.esc(S.nome(p.de)) + '</b><br><small class="fraco">troca · responda até ' + RP.fmtHora(p.ate) + '</small></span>' + seloValor(p.da, p.quer) + '</div>' +
      '<div class="troca-linhas"><div><span class="rotulo">Você recebe</span>' + S.cargaHTML(p.da) + '<small class="fraco">valor ' + RP.num(p.valorDa) + '</small></div>' +
      '<div><span class="rotulo">Você dá</span>' + RP.custoHTML(p.quer, 1, '*') + '<small class="fraco">valor ' + RP.num(p.valorQuer) + '</small></div></div>' + S.recadoHTML(p.recado) +
      '<small class="obra-estoque vem">' + RP.icone('carroca', 'ico-p') + 'Sua parte sai dos locais mais próximos. As duas cargas viajam visíveis e podem ser roubadas.</small>' +
      (aviso ? '<p class="nota-antiga">' + RP.icone('escudo', 'ico-p') + RP.esc(aviso) + '</p>' : '') +
      '<div class="linha relq-acoes"><button type="button" class="btn btn-p btn-primario' + (aviso ? ' btn-inativo' : '') + '" data-aceitar="' + p.id + '">' + RP.icone('troca') + 'Aceitar</button><button type="button" class="btn btn-p btn-fantasma" data-recusar="' + p.id + '">Recusar</button></div></div>';
  }
  function cardPropostaPacto(p) {
    var paga = Object.keys(p.da).length ? 'eles' : Object.keys(p.quer).length ? 'eu' : null;
    return '<div class="card pilha"><div class="linha">' + S.brasao(p.de) + '<span style="flex:1;min-width:0"><b>' + RP.esc(S.nome(p.de)) + ' propõe ' + dias(p.dias) + ' sem ataques</b><br><small class="fraco">' +
      (paga === 'eu' ? 'Cobra ' + RP.esc(S.cargaTxt(p.quer)) + ' (valor ' + RP.num(p.valorQuer) + ')' : paga === 'eles' ? 'Paga ' + RP.esc(S.cargaTxt(p.da)) + ' (valor ' + RP.num(p.valorDa) + ')' : 'Sem pagamento') + ' · até ' + RP.fmtHora(p.ate) + '</small></span></div>' + S.recadoHTML(p.recado) +
      '<p class="fraco" style="font-size:var(--fs-2)">Se aceitar, o pacto começa quando o pagamento chegar. Enquanto durar, o jogo impede ataques, saques e interceptações entre vocês: não dá para quebrar.</p>' +
      '<div class="linha relq-acoes"><button type="button" class="btn btn-p btn-primario" data-aceitar="' + p.id + '">' + RP.icone('pacto') + (paga === 'eu' ? 'Aceitar e pagar' : 'Aceitar') + '</button><button type="button" class="btn btn-p btn-fantasma" data-recusar="' + p.id + '">Recusar</button></div></div>';
  }
  function cardPacto(p) {
    var ag = RP.agora(), esp = p.estado === 'aguardando';
    return '<div class="card linha">' + S.brasao(p.com, 28) + '<span style="flex:1;min-width:0"><b>Pacto com ' + RP.esc(S.nome(p.com)) + '</b><br><small class="fraco">' + dias(p.dias) + ' · ' +
      (p.pagador === 'eu' ? 'você paga ' + RP.esc(S.cargaTxt(p.pagamento)) : p.pagador ? 'eles pagam ' + RP.esc(S.cargaTxt(p.pagamento)) : 'sem pagamento') + '</small></span>' +
      (esp ? '<span class="selo selo-info">' + RP.icone('carroca') + 'começa ' + RP.barraTempo(p.partida, p.chegada || ag, { classe: 'curta', cor: 'info', rotulo: 'Pagamento a caminho' }) + '</span>'
        : '<span class="selo selo-visivel">' + RP.icone('pacto') + 'termina ' + RP.barraTempo(p.inicio, p.fim, { classe: 'curta', cor: 'sucesso', rotulo: 'Pacto em vigor' }) + '</span>') + '</div>';
  }
  function cardResgate(x) {
    var ag = RP.agora(), indo = x.chegada && x.chegada > ag;
    return '<div class="card pilha"><div class="linha"><span class="ico-placa">' + RP.icone('explorador') + '</span><span style="flex:1;min-width:0"><b>Seu ' + RP.esc(x.nome.toLowerCase()) + ' foi capturado</b><br><small class="fraco">' + RP.esc(S.nome(x.captor)) + ' pede ' + RP.esc(S.cargaTxt(x.resgate)) + ' · prazo ' + RP.fmtHora(x.ate) + '</small></span></div>' +
      '<p class="fraco" style="font-size:var(--fs-2)">Pago, a carga viaja até o castelo de quem capturou e, ao chegar, o explorador é solto. Se for roubada, ele continua preso. Sem pagamento, o captor decide; sem decisão até o prazo, ele é libertado.</p>' +
      (indo ? '<span class="selo selo-info">' + RP.icone('carroca') + 'resgate chega ' + RP.barraTempo(x.partida, x.chegada, { classe: 'curta', cor: 'info', rotulo: 'Resgate a caminho' }) + '</span>'
        : x.recusado ? '<span class="selo">Você disse que não paga</span>'
        : '<div class="linha relq-acoes"><button type="button" class="btn btn-p btn-primario" data-pagar-resgate="' + x.prisioneiroId + '">' + RP.icone('carroca') + 'Pagar resgate</button><a class="btn btn-p" href="#/exploradores">' + RP.icone('troca') + 'Contrapropor ou resgatar</a><button type="button" class="btn btn-p btn-fantasma" data-recusar-resgate="' + x.prisioneiroId + '">Não pagar</button></div>') + '</div>';
  }
  function cardMinha(p) {
    var est = p.estado === 'aberta' ? 'aguardando resposta' : p.estado === 'aceita' ? 'aceita' + (p.chegada && p.chegada > RP.agora() ? ' · cargas chegam ' + RP.barraTempo(p.partida, p.chegada, { classe: 'curta', cor: 'info', rotulo: 'Cargas a caminho' }) : '') : p.estado === 'recusada' ? 'recusada' : p.estado === 'cancelada' ? 'cancelada' : p.estado;
    var txt = p.tipo === 'troca' ? S.cargaTxt(p.da) + ' por ' + S.cargaTxt(p.quer) : 'Pacto de ' + dias(p.dias) + (Object.keys(p.da).length ? ' · você paga ' + S.cargaTxt(p.da) : Object.keys(p.quer).length ? ' · cobra ' + S.cargaTxt(p.quer) : '');
    return '<div class="card linha">' + S.brasao(p.para, 28) + '<span style="flex:1;min-width:0"><b>' + RP.esc(txt) + '</b><br><small class="fraco">' + RP.esc(S.nome(p.para)) + ' · ' + est + '</small>' + (p.recado ? '<small class="fraco">“' + RP.esc(p.recado) + '”</small>' : '') + '</span>' +
      (p.estado === 'aberta' ? '<button type="button" class="btn btn-p btn-fantasma" data-cancelar="' + p.id + '">Cancelar</button>' : '') + '</div>';
  }
  function desenhar(el) {
    return carregar().then(function (d) {
      var ofertas = d.paraMim.filter(function (p) { return p.estado === 'aberta' && p.tipo === 'troca'; });
      var propostas = d.paraMim.filter(function (p) { return p.estado === 'aberta' && p.tipo === 'pacto'; });
      RP.$('.com-conteudo', el).innerHTML =
        '<div class="nota-regra">' + RP.icone('troca', 'ico-p') + '<span><b>Sem mercado global.</b> Troca direta só com reinos que você conhece: aliados, espionados ou identificados por estandarte, bandeira ou mensagem. A proposta revela quem propõe, e as cargas <b>viajam</b> pelo mapa: podem ser roubadas.</span></div>' +
        (d.eu.escudo ? '<p class="nota-antiga">' + RP.icone('escudo', 'ico-p') + '<span>Seu reino está sob escudo de novato: a diferença entre o que dá e recebe fica em até ' + RP.num(d.novatoDia) + ' de valor por dia (restam ' + RP.num(d.eu.novatoRestante) + ' hoje).</span></p>' : '') +
        '<div class="linha" style="margin-top:var(--esp-3)"><a class="btn btn-p btn-primario" href="#/troca" style="flex:1">' + RP.icone('troca') + 'Propor troca</a><a class="btn btn-p" href="#/pacto" style="flex:1">' + RP.icone('pacto') + 'Propor pacto</a></div>' +
        (ofertas.length ? '<div class="secao-titulo">Ofertas para você</div><div class="pilha">' + ofertas.map(cardTroca).join('') + '</div>' : '') +
        '<div class="secao-titulo">Pactos de não agressão</div><div class="pilha">' + propostas.map(cardPropostaPacto).join('') + d.pactos.map(cardPacto).join('') +
        (!propostas.length && !d.pactos.length ? S.vazio('Nenhum pacto.') : '') + '</div>' +
        '<p class="fraco" style="font-size:var(--fs-2);margin-top:var(--esp-2)">De ' + d.pacto.diasMin + ' a ' + d.pacto.diasMax + ' dias, até ' + d.pacto.ativosMax + ' ativos. Qualquer lado propõe e o pagamento pode ir em qualquer direção. Tropas enviadas a um local do outro descobrem o pacto ao chegar e voltam sem combate.</p>' +
        (d.resgates.length ? '<div class="secao-titulo">Exploradores capturados</div><div class="pilha">' + d.resgates.map(cardResgate).join('') + '</div>' : '') +
        '<div class="secao-titulo">Suas propostas</div><div class="pilha">' + (d.minhas.length ? d.minhas.map(cardMinha).join('') : S.vazio('Nenhuma proposta enviada.')) + '</div>' +
        '<div class="secao-titulo">Valor de referência</div><div class="card pilha"><p class="fraco" style="font-size:var(--fs-2)">Em recursos básicos. Orienta as trocas, sem obrigar: vale o que os dois combinarem.</p>' +
        '<div class="valor-grade">' + S.RECURSOS.filter(function (k) { return (d.valor[k] || 0) > 1 || k === 'madeira'; }).map(function (k) {
          return '<span class="selo selo-g">' + RP.icone(k, 'ico-p r-' + k) + (k === 'madeira' ? 'Básicos' : RP.esc(RP.NOMES_REC[k] || k)) + ' <b class="num">' + d.valor[k] + '</b></span>';
        }).join('') + '</div></div><div style="height:var(--esp-8)"></div>';
    }).catch(function (e) { RP.$('.com-conteudo', el).innerHTML = S.vazio(RP.esc(e.message)); });
  }
  function acao(p, titulo, texto, icone, el) {
    return RP.tentar(p).then(function () {
      RP.aviso({ titulo: titulo, texto: texto, icone: icone || 'troca', tipo: 'sucesso', ms: 3600 });
      RP.recarregarReino(); if (RP.mapaModelo) RP.mapaModelo.velho = true;
      return desenhar(el);
    }).catch(function () { /* aviso já mostrado */ });
  }
  RP.registrarTela('comercio', {
    secao: 'mais',
    montar: function (el) {
      el.innerHTML = RP.topoVoltar('Comércio e diplomacia', 'mais', 'Trocas, pactos e resgates') + '<div class="conteudo-tela com-conteudo"></div>';
      el.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-aceitar]'))) {
          if (b.classList.contains('btn-inativo')) { RP.aviso({ titulo: 'Limite do novato', texto: 'A diferença de valor passa do limite de hoje.', icone: 'escudo', tipo: 'alerta' }); return; }
          var p = dados.paraMim.filter(function (x) { return x.id === +b.getAttribute('data-aceitar'); })[0];
          acao(RP.post('/propostas/' + p.id + '/aceitar'), p.tipo === 'troca' ? 'Troca aceita' : 'Pacto aceito',
            p.tipo === 'troca' ? 'Sua parte já saiu. As duas cargas podem ser roubadas.' : 'Começa quando o pagamento chegar (sem pagamento, agora).', p.tipo === 'troca' ? 'troca' : 'pacto', el);
          return;
        }
        if ((b = e.target.closest('[data-recusar]'))) { acao(RP.post('/propostas/' + b.getAttribute('data-recusar') + '/recusar'), 'Proposta recusada', 'O outro reino é avisado.', 'info', el); return; }
        if ((b = e.target.closest('[data-cancelar]'))) { acao(RP.post('/propostas/' + b.getAttribute('data-cancelar') + '/cancelar'), 'Proposta cancelada', null, 'info', el); return; }
        if ((b = e.target.closest('[data-pagar-resgate]'))) { acao(RP.post('/comercio/resgates/' + b.getAttribute('data-pagar-resgate') + '/pagar'), 'Resgate a caminho', 'Quando chegar, o explorador é solto e volta para casa.', 'explorador', el); return; }
        if ((b = e.target.closest('[data-recusar-resgate]'))) { acao(RP.post('/comercio/resgates/' + b.getAttribute('data-recusar-resgate') + '/recusar'), 'Resgate não pago', 'Quem capturou decide até o fim do prazo.', 'explorador', el); }
      });
    },
    entrar: function (el) { desenhar(el); }
  });
  document.addEventListener('rp:social', function (e) { if (e.detail === 'comercio') S.redesenhar('comercio', desenhar); });

  /* escolher reino: só conhecidos */
  function escolhaReinos(attr, sel, filtro) {
    var lista = dados.conhecidos.filter(filtro || function () { return true; });
    if (!lista.length) return S.vazio('Você ainda não conhece outros reinos. Espione um local, receba uma mensagem ou veja uma bandeira.');
    return '<div class="escolhas escolhas-lista">' + lista.map(function (c) {
      return '<button type="button" class="escolha escolha-linha" ' + attr + '="' + c.reino.id + '" aria-pressed="' + (sel === c.reino.id) + '">' + S.brasao(c.reino, 30) + '<span class="escolha-txt"><b>' + RP.esc(c.reino.nome) + '</b><small class="fraco">' +
        (c.aliado ? 'Aliado' : c.pacto ? 'Pacto ' + (c.pacto === 'ativo' ? 'em vigor' : 'aguardando pagamento') : 'Reino conhecido') + (c.escudo ? ' · sob escudo de novato' : '') + '</small></span></button>';
    }).join('') + '</div>';
  }

  /* ---------------------------------------------------------------- Propor troca */
  var tr = { reino: null, da: 'madeira', qDa: 50, quer: 'ouro', qQuer: 2, recado: '' };
  function cargas() { var a = {}, b = {}; a[tr.da] = tr.qDa; b[tr.quer] = tr.qQuer; return { da: a, quer: b }; }
  function desenharTroca(el) {
    if (!dados.conhecidos.some(function (c) { return c.reino.id === tr.reino; })) tr.reino = dados.conhecidos.length ? dados.conhecidos[0].reino.id : null;
    var cg = cargas(), c = tr.reino ? conhecido(tr.reino) : null, temDa = RP.qtdRecurso(tr.da, '*') >= tr.qDa;
    var av = c ? restoNovato(c, Math.abs(S.valor(cg.da) - S.valor(cg.quer))) : null;
    RP.$('.tr-conteudo', el).innerHTML =
      '<div class="secao-titulo" style="margin-top:0">Com quem</div>' + escolhaReinos('data-tr-reino', tr.reino) + notaNovato(c) +
      '<div class="secao-titulo">Você dá</div>' + S.chipsRecurso('data-tr-da', tr.da) + '<div class="card linha-entre" style="margin-top:var(--esp-2)"><span class="linha">' + RP.icone(tr.da, 'r-' + tr.da) + '<span><b>' + RP.esc(RP.NOMES_REC[tr.da] || tr.da) + '</b><br><small class="fraco">no reino: ' + RP.num(RP.qtdRecurso(tr.da, '*')) + '</small></span></span>' + S.stepper('da', tr.qDa, S.passo(tr.da), S.passo(tr.da)) + '</div>' +
      '<div class="secao-titulo">Você quer</div>' + S.chipsRecurso('data-tr-quer', tr.quer) + '<div class="card linha-entre" style="margin-top:var(--esp-2)"><span class="linha">' + RP.icone(tr.quer, 'r-' + tr.quer) + '<b>' + RP.esc(RP.NOMES_REC[tr.quer] || tr.quer) + '</b></span>' + S.stepper('quer', tr.qQuer, S.passo(tr.quer), S.passo(tr.quer)) + '</div>' +
      '<div class="card pilha" style="margin-top:var(--esp-3)"><div class="linha-entre"><span class="fraco">Valor de referência</span><span class="num">' + RP.num(S.valor(cg.da)) + ' por ' + RP.num(S.valor(cg.quer)) + '</span></div>' +
      '<div class="linha-entre"><span class="fraco">Equilíbrio</span>' + seloValor(cg.quer, cg.da) + '</div>' +
      '<small class="obra-estoque' + (temDa ? ' vem' : ' falta') + '">' + RP.icone('carroca', 'ico-p') + RP.esc(temDa ? 'Se aceitarem, sua parte sai dos locais mais próximos, a pé.' : 'Faltam ' + RP.num(tr.qDa - RP.qtdRecurso(tr.da, '*')) + ' de ' + RP.nomeRecurso(tr.da) + ' no reino todo.') + '</small>' +
      (av ? '<p class="nota-antiga">' + RP.icone('escudo', 'ico-p') + RP.esc(av) + '</p>' : '') +
      '<p class="fraco" style="font-size:var(--fs-2)">A proposta revela que foi você. As duas cargas viajam visíveis no mapa e podem ser roubadas.</p></div>' +
      S.campoRecado('recado-troca', tr.recado, dados.recadoMax) + '<div style="height:var(--esp-8)"></div>';
    RP.$('.rodape-resumo', el).innerHTML = '<div class="resumo-linha"><b>' + RP.esc(S.cargaTxt(cg.da)) + ' por ' + RP.esc(S.cargaTxt(cg.quer)) + '</b></div><div class="resumo-linha fraco">para ' + RP.esc(c ? c.reino.nome : '—') + '</div>';
    RP.$('[data-tr-enviar]', el).classList.toggle('btn-inativo', !c || !temDa || !!av || tr.da === tr.quer);
  }
  RP.registrarTela('troca', {
    secao: 'mais',
    montar: function (el) {
      el.innerHTML = RP.topoVoltar('Propor troca', 'comercio', 'Troca direta') + '<div class="conteudo-tela tr-conteudo"></div>' +
        '<div class="rodape-acao rodape-com-resumo"><div class="rodape-resumo"></div><button type="button" class="btn btn-primario btn-bloco btn-grande" data-tr-enviar>' + RP.icone('troca') + 'Enviar proposta</button></div>';
      el.addEventListener('input', function (e) { if (e.target.id === 'recado-troca') tr.recado = e.target.value; });
      el.addEventListener('click', function (e) {
        var b, p;
        if ((b = e.target.closest('[data-tr-reino]'))) { tr.reino = +b.getAttribute('data-tr-reino'); desenharTroca(el); return; }
        if ((b = e.target.closest('[data-tr-da]'))) { tr.da = b.getAttribute('data-tr-da'); tr.qDa = S.passo(tr.da) * 4; desenharTroca(el); return; }
        if ((b = e.target.closest('[data-tr-quer]'))) { tr.quer = b.getAttribute('data-tr-quer'); tr.qQuer = S.passo(tr.quer) * 4; desenharTroca(el); return; }
        if ((b = e.target.closest('[data-q]'))) {
          p = b.getAttribute('data-q').split(':');
          if (p[0] === 'da') tr.qDa = Math.max(S.passo(tr.da), tr.qDa + +p[1]); else tr.qQuer = Math.max(S.passo(tr.quer), tr.qQuer + +p[1]);
          desenharTroca(el); return;
        }
        if (e.target.closest('[data-tr-enviar]')) {
          if (tr.da === tr.quer) { RP.aviso({ titulo: 'Recursos iguais', texto: 'Escolha recursos diferentes.', icone: 'info', tipo: 'alerta' }); return; }
          var cg = cargas();
          RP.tentar(RP.post('/comercio/troca', { reinoId: tr.reino, da: cg.da, quer: cg.quer, recado: (tr.recado || '').trim() })).then(function (x) {
            tr.recado = '';
            RP.aviso({ titulo: 'Proposta enviada', texto: S.nome(x.para) + ' recebe pelo sino e vê que foi você.', icone: 'troca', tipo: 'sucesso' });
            RP.ir('comercio');
          }).catch(function () { /* aviso já mostrado */ });
        }
      });
    },
    entrar: function (el, params) {
      if (params.get('reino')) tr.reino = +params.get('reino');
      carregar().then(function () { desenharTroca(el); }).catch(function (e) { RP.$('.tr-conteudo', el).innerHTML = S.vazio(RP.esc(e.message)); });
    }
  });

  /* ---------------------------------------------------------------- Propor pacto */
  var pc = { reino: null, dias: 3, direcao: 'eu', rec: 'prata', q: 50, recado: '' };
  var DIRECOES = [['eu', 'Eu pago', 'Você paga para não ser atacado'], ['outro', 'Eu cobro', 'Eles pagam para você não atacar'], ['sem', 'Sem pagamento', 'Trégua mútua']];
  function desenharPacto(el) {
    var alvos = dados.conhecidos.filter(function (c) { return !c.aliado; });
    if (!alvos.some(function (c) { return c.reino.id === pc.reino; })) pc.reino = alvos.length ? alvos[0].reino.id : null;
    var c = pc.reino ? conhecido(pc.reino) : null;
    if (pc.direcao === 'outro' && c && c.escudo) pc.direcao = 'eu';
    var carga = {}; carga[pc.rec] = pc.q;
    var ja = c && c.pacto, cheio = dados.pactos.length >= dados.pacto.ativosMax;
    RP.$('.pc-conteudo', el).innerHTML =
      '<div class="nota-regra">' + RP.icone('pacto', 'ico-p') + '<span><b>O jogo garante o pacto.</b> Enquanto durar, nenhum dos dois consegue atacar, saquear ou interceptar o outro. Começa quando o pagamento chega; se for roubado no caminho, não começa.</span></div>' +
      '<div class="secao-titulo">Com quem</div>' + escolhaReinos('data-pc-reino', pc.reino, function (x) { return !x.aliado; }) + notaNovato(c) +
      '<div class="secao-titulo">Duração</div><div class="card linha-entre"><span><b>' + dias(pc.dias) + '</b><br><small class="fraco">de ' + dados.pacto.diasMin + ' a ' + dados.pacto.diasMax + '</small></span>' +
      '<span class="stepper"><button type="button" class="btn btn-icone" data-pc-dias="-1" aria-label="Menos"' + (pc.dias <= dados.pacto.diasMin ? ' disabled' : '') + '>' + RP.icone('menos') + '</button><output class="num">' + pc.dias + '</output><button type="button" class="btn btn-icone" data-pc-dias="1" aria-label="Mais"' + (pc.dias >= dados.pacto.diasMax ? ' disabled' : '') + '>' + RP.icone('mais') + '</button></span></div>' +
      '<div class="secao-titulo">Pagamento</div><div class="escolhas">' + DIRECOES.map(function (d) {
        var bloq = d[0] === 'outro' && c && c.escudo;
        return '<button type="button" class="escolha' + (bloq ? ' bloqueado' : '') + '" data-pc-dir="' + d[0] + '" aria-pressed="' + (pc.direcao === d[0]) + '"' + (bloq ? ' aria-disabled="true"' : '') + '><b>' + d[1] + '</b><small class="fraco">' + (bloq ? 'Não se cobra de reino sob escudo' : d[2]) + '</small></button>';
      }).join('') + '</div>' +
      (pc.direcao !== 'sem' ? '<div class="card linha-entre" style="margin-top:var(--esp-2)"><span class="linha">' + RP.icone(pc.rec, 'r-' + pc.rec) + '<span><b>' + RP.esc(RP.NOMES_REC[pc.rec] || pc.rec) + '</b><br><small class="fraco">valor ' + RP.num(S.valor(carga)) + '</small></span></span>' +
        S.stepper('q', pc.q, S.passo(pc.rec) * 2, S.passo(pc.rec) * 2) + '</div>' + S.chipsRecurso('data-pc-rec', pc.rec, ['prata', 'ouro', 'ferro', 'comida', 'madeira']) : '') +
      (ja ? '<p class="nota-antiga">' + RP.icone('pacto', 'ico-p') + 'Já há um pacto com este reino.</p>' : cheio ? '<p class="nota-antiga">' + RP.icone('alerta', 'ico-p') + 'Você já tem ' + dados.pacto.ativosMax + ' pactos, o máximo.</p>' : '') +
      S.campoRecado('recado-pacto', pc.recado, dados.recadoMax) + '<div style="height:var(--esp-8)"></div>';
    RP.$('.rodape-resumo', el).innerHTML = '<div class="resumo-linha"><b>' + dias(pc.dias) + ' sem ataques com ' + RP.esc(c ? c.reino.nome : '—') + '</b></div><div class="resumo-linha fraco">' +
      (pc.direcao === 'sem' ? 'sem pagamento' : (pc.direcao === 'eu' ? 'você paga ' : 'eles pagam ') + RP.esc(S.cargaTxt(carga))) + '</div>';
    RP.$('[data-pc-enviar]', el).classList.toggle('btn-inativo', !c || !!ja || cheio);
  }
  RP.registrarTela('pacto', {
    secao: 'mais',
    montar: function (el) {
      el.innerHTML = RP.topoVoltar('Propor pacto', 'comercio', 'Não agressão') + '<div class="conteudo-tela pc-conteudo"></div>' +
        '<div class="rodape-acao rodape-com-resumo"><div class="rodape-resumo"></div><button type="button" class="btn btn-primario btn-bloco btn-grande" data-pc-enviar>' + RP.icone('pacto') + 'Enviar proposta</button></div>';
      el.addEventListener('input', function (e) { if (e.target.id === 'recado-pacto') pc.recado = e.target.value; });
      el.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-pc-reino]'))) { pc.reino = +b.getAttribute('data-pc-reino'); desenharPacto(el); return; }
        if ((b = e.target.closest('[data-pc-dias]'))) { pc.dias = Math.max(dados.pacto.diasMin, Math.min(dados.pacto.diasMax, pc.dias + +b.getAttribute('data-pc-dias'))); desenharPacto(el); return; }
        if ((b = e.target.closest('[data-pc-dir]'))) {
          if (b.getAttribute('aria-disabled') === 'true') { RP.aviso({ titulo: 'Reino sob escudo', texto: 'Ninguém pode cobrar pacto de um reino sob escudo de novato.', icone: 'escudo', tipo: 'alerta' }); return; }
          pc.direcao = b.getAttribute('data-pc-dir'); desenharPacto(el); return;
        }
        if ((b = e.target.closest('[data-pc-rec]'))) { pc.rec = b.getAttribute('data-pc-rec'); pc.q = S.passo(pc.rec) * 10; desenharPacto(el); return; }
        if ((b = e.target.closest('[data-q]'))) { pc.q = Math.max(S.passo(pc.rec) * 2, pc.q + +b.getAttribute('data-q').split(':')[1]); desenharPacto(el); return; }
        if (e.target.closest('[data-pc-enviar]')) {
          var carga = {}; if (pc.direcao !== 'sem') carga[pc.rec] = pc.q;
          RP.tentar(RP.post('/comercio/pacto', { reinoId: pc.reino, dias: pc.dias, pagador: pc.direcao === 'sem' ? null : pc.direcao, pagamento: carga, recado: (pc.recado || '').trim() })).then(function (x) {
            pc.recado = '';
            RP.aviso({ titulo: 'Proposta enviada', texto: S.nome(x.para) + ' recebe pelo sino.', icone: 'pacto', tipo: 'sucesso' });
            RP.ir('comercio');
          }).catch(function () { /* aviso já mostrado */ });
        }
      });
    },
    entrar: function (el, params) {
      if (params.get('reino')) pc.reino = +params.get('reino');
      carregar().then(function () { desenharPacto(el); }).catch(function (e) { RP.$('.pc-conteudo', el).innerHTML = S.vazio(RP.esc(e.message)); });
    }
  });

})();
