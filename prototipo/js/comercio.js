/* Reino de Pedra — Comércio e diplomacia: troca direta, ofertas de outros reinos, pacto de não agressão,
   resgate de exploradores e limite para reinos sob escudo de novato.
   Sem mercado global: só com reinos conhecidos, e as cargas viajam pelo mapa, visíveis e roubáveis. */
(function () {
  'use strict';
  var RP = window.RP, D = RP.dados, W = RP.mundo, U = RP.util, C = D.comercio;
  var CASTELO = { lumen: 'a-castelo', fenda: 'f-castelo', valdren: 'v-castelo', corvo: 'c-castelo', mirante: 'mi-castelo' };
  var TODOS = RP.ORDEM_REC.concat(D.valiosos.map(function (v) { return v.id; }));
  var tela = null;

  function reino(id) { return D.reinos[id]; }
  function brasao(id, t) { return RP.brasao(reino(id).brasao, { tamanho: t || 32 }); }
  function txt(c) { return RP.cargaTxt(c); }
  function cargaHTML(c) { return '<span class="custos">' + Object.keys(c).map(function (k) { return '<span class="custo">' + RP.icone(k, 'ico-p r-' + k) + RP.num(c[k]) + '</span>'; }).join('') + '</span>'; }
  function valor(c) { return RP.valorDe(c); }
  function porId(lista, id) { return lista.filter(function (q) { return q.id === id; })[0]; }
  function invalidar() { ['mapa', 'agora', 'reino'].forEach(RP.invalidarTela); }

  /* ---------------------------------------------------------------- novato: limite diário de desequilíbrio */
  function novato(id) { return id === 'meu' ? (RP.estado.recemFundado ? { horas: 72 } : null) : reino(id).novato || null; }
  RP.novatoRestante = function (id) { return novato(id) ? Math.max(0, C.novatoDia - (C.novatoUsado[id] || 0)) : Infinity; };
  function deseq(da, quer) { return Math.abs(valor(da) - valor(quer)); }
  function checaNovato(id, da, quer) {
    var d = deseq(da, quer), q = novato(id) ? id : novato('meu') ? 'meu' : null;
    if (!q) return null;
    var r = RP.novatoRestante(q);
    return d > r ? (q === 'meu' ? 'Seu reino está' : reino(q).nome + ' está') + ' sob escudo de novato: a diferença entre o que dá e recebe fica em até ' + RP.num(C.novatoDia) + ' de valor por dia. Hoje restam ' + RP.num(r) + '; esta troca tem ' + RP.num(d) + '.' : null;
  }
  function notaNovato(id) {
    if (!novato(id)) return '';
    return '<p class="nota-antiga">' + RP.icone('escudo', 'ico-p') + '<span>' + RP.esc(reino(id).nome) + ' está sob escudo de novato: trocas, ajudas e pagamentos com diferença de valor somam até ' + RP.num(C.novatoDia) + ' por dia (restam ' + RP.num(RP.novatoRestante(id)) + ' hoje). Ninguém pode cobrar pacto dele.</span></p>';
  }

  /* ---------------------------------------------------------------- cargas que viajam */
  function caminho(de, para) { var a = W.local(de), b = W.local(para); return RP.caminho([a.c, a.l], [b.c, b.l], { vel: 'Lenta' }); }
  /* carga de outro reino chegando ao seu castelo (entra no estoque ao chegar) */
  function cargaChegando(de, carga, rotulo) {
    var cam = caminho(CASTELO[de], RP.SEDE);
    if (!cam) return null;
    var m = W.adicionarMarcha({ id: 'm-troca-' + Date.now() + '-' + de, dono: de, tipo: 'caravana', veiculos: { carroca: 1 }, grupo: {}, alvo: RP.SEDE, troca: true,
      nome: rotulo, cargaTxt: txt(carga), resumo: txt(carga) + ' → Castelo de ' + RP.estado.nome, seg: cam.seg }, cam.hexes);
    D.caravanas.push({ marcha: m.d.id, de: CASTELO[de], para: RP.SEDE, carga: carga, veiculos: {}, escolta: {}, chegada: m.d.chegada, ajuda: de });
    return m;
  }
  /* sua parte sai dos locais mais próximos, levada por carregadores, até o castelo do outro reino */
  function enviarParte(para, carga, rotulo) { return RP.requisitar(carga, CASTELO[para], rotulo); }
  function contaNovato(id, da, quer) { var q = novato(id) ? id : novato('meu') ? 'meu' : null; if (q) C.novatoUsado[q] = (C.novatoUsado[q] || 0) + deseq(da, quer); }

  /* ---------------------------------------------------------------- pactos */
  function pactosAtivos() { return C.pactos.filter(function (p) { return p.estado === 'ativo' && RP.fimItem(p) > Date.now(); }); }
  RP.pactoCom = function (id) { return C.pactos.filter(function (p) { return p.com === id && (p.estado === 'ativo' || p.estado === 'aguardando'); })[0]; };
  function iniciarPacto(p) { p.estado = 'ativo'; p.fim = Date.now() + p.dias * 86400000; RP.aviso({ titulo: 'Pacto em vigor', texto: 'Com ' + reino(p.com).nome + ' por ' + p.dias + (p.dias > 1 ? ' dias' : ' dia') + '. O jogo impede ataques entre vocês.', icone: 'pacto', tipo: 'sucesso' }); invalidar(); }
  document.addEventListener('rp:tique', function () {
    var mudou = false;
    C.pactos.forEach(function (p) { if (p.estado === 'aguardando' && p.chegada <= Date.now()) { iniciarPacto(p); mudou = true; } });
    if (mudou && tela && !tela.hidden) desenhar(tela);
  });
  function aceitarPacto(pp, dePara) {
    /* dePara: 'eu pago' → minha carga vai; 'eles pagam' → a deles vem; sem carga → começa já */
    if (pactosAtivos().length + C.pactos.filter(function (p) { return p.estado === 'aguardando'; }).length >= C.pactosMax) {
      RP.aviso({ titulo: 'Limite de pactos', texto: 'Cada reino tem até ' + C.pactosMax + ' pactos ativos.', icone: 'pacto', tipo: 'alerta' }); return false;
    }
    var p = { id: 'pc-' + Date.now(), com: pp.com, dias: pp.dias, pagou: dePara === 'eu pago' ? 'meu' : dePara === 'eles pagam' ? pp.com : null, carga: pp.carga || {}, estado: 'aguardando' };
    if (p.pagou === 'meu') {
      var pl = enviarParte(p.com, p.carga, 'pacto com ' + reino(p.com).nome);
      if (!pl) { RP.aviso({ titulo: 'Recursos insuficientes', texto: RP.textoPlano(RP.planoRequisicao(p.carga, CASTELO[p.com]), CASTELO[p.com]), icone: 'alerta', tipo: 'perigo' }); return false; }
      p.chegada = pl.chegada;
    } else if (p.pagou) { var m = cargaChegando(p.com, p.carga, 'Pagamento de ' + reino(p.com).nome); p.chegada = m ? m.d.chegada : Date.now(); }
    else p.chegada = Date.now();
    contaNovato(p.com, p.pagou === 'meu' ? p.carga : {}, p.pagou && p.pagou !== 'meu' ? p.carga : {});
    C.pactos.push(p);
    if (p.chegada <= Date.now()) iniciarPacto(p);
    else RP.aviso({ titulo: 'Pacto aceito', texto: 'Começa quando o pagamento chegar, em ' + RP.fmtResta(p.chegada - Date.now()) + '. Se a carga for roubada, não começa.', icone: 'pacto', tipo: 'sucesso' });
    invalidar();
    return true;
  }

  /* ---------------------------------------------------------------- tela Comércio */
  function seloValor(da, quer) {
    var a = valor(da), b = valor(quer), d = a ? Math.round(100 * (a - b) / b) : 0;
    return '<span class="selo ' + (d > 2 ? 'selo-visivel' : d < -2 ? 'selo-perigo' : '') + '">' + (d > 2 ? 'A seu favor +' + d + '%' : d < -2 ? 'Contra você ' + d + '%' : 'Equilibrada') + '</span>';
  }
  function cardOferta(o) {
    var pl = RP.planoRequisicao(o.quer, CASTELO[o.de]), aviso = checaNovato(o.de, o.quer, o.da);
    return '<div class="card pilha"><div class="linha">' + brasao(o.de) + '<span style="flex:1;min-width:0"><b>' + RP.esc(reino(o.de).nome) + '</b><br><small class="fraco">' + RP.esc(C.conhecidos[o.de] ? 'conhecido por ' + C.conhecidos[o.de] : '') + ' · ' + RP.fmtHa(o.horas) + '</small></span>' + seloValor(o.da, o.quer) + '</div>' +
      '<div class="troca-linhas"><div><span class="rotulo">Você recebe</span>' + cargaHTML(o.da) + '<small class="fraco">valor ' + RP.num(valor(o.da)) + '</small></div>' +
      '<div><span class="rotulo">Você dá</span>' + RP.custoHTML(o.quer, 1, '*') + '<small class="fraco">valor ' + RP.num(valor(o.quer)) + '</small></div></div>' +
      '<small class="obra-estoque' + (pl.completo ? ' vem' : ' falta') + '">' + RP.icone('carroca', 'ico-p') + RP.esc(pl.completo ? 'Sua parte sai dos locais mais próximos e leva ≈ ' + RP.fmtDuracao(pl.seg) + '. As duas cargas podem ser roubadas no caminho.' : 'Faltam ' + txt(pl.faltaReino) + ' no reino todo.') + '</small>' +
      (aviso ? '<p class="nota-antiga">' + RP.icone('escudo', 'ico-p') + RP.esc(aviso) + '</p>' : '') +
      '<div class="linha relq-acoes"><button type="button" class="btn btn-p btn-primario' + (pl.completo && !aviso ? '' : ' btn-inativo') + '" data-aceitar-troca="' + o.id + '">' + RP.icone('troca') + 'Aceitar</button><button type="button" class="btn btn-p btn-fantasma" data-recusar-troca="' + o.id + '">Recusar</button></div></div>';
  }
  function cardPactoAtivo(p) {
    var fim = RP.fimItem(p), esp = p.estado === 'aguardando';
    return '<div class="card linha">' + brasao(p.com, 28) + '<span style="flex:1;min-width:0"><b>Pacto com ' + RP.esc(reino(p.com).nome) + '</b><br><small class="fraco">' + p.dias + (p.dias > 1 ? ' dias' : ' dia') + ' · ' +
      (p.pagou === 'meu' ? 'você pagou ' + txt(p.carga) : p.pagou ? 'eles pagaram ' + txt(p.carga) : 'sem pagamento') + '</small></span>' +
      (esp ? '<span class="selo selo-info">' + RP.icone('carroca') + 'começa em <span data-fim="' + p.chegada + '">' + RP.fmtResta(p.chegada - Date.now()) + '</span></span>'
        : '<span class="selo selo-visivel">' + RP.icone('pacto') + 'termina em <span data-fim="' + fim + '">' + RP.fmtResta(fim - Date.now()) + '</span></span>') + '</div>';
  }
  function cardPropostaPacto(pp) {
    var cobra = pp.cobra && Object.keys(pp.cobra).length, pl = cobra ? RP.planoRequisicao(pp.cobra, CASTELO[pp.de]) : { completo: true };
    return '<div class="card pilha"><div class="linha">' + brasao(pp.de) + '<span style="flex:1;min-width:0"><b>' + RP.esc(reino(pp.de).nome) + ' propõe ' + pp.dias + ' dias sem ataques</b><br><small class="fraco">' + (cobra ? 'Cobra ' + RP.esc(txt(pp.cobra)) + ' (valor ' + RP.num(valor(pp.cobra)) + ')' : 'Sem pagamento') + ' · ' + RP.fmtHa(pp.horas) + '</small></span></div>' +
      '<p class="fraco" style="font-size:var(--fs-2)">Se aceitar, o pacto começa quando o pagamento chegar. Enquanto durar, o jogo impede ataques, saques e interceptações entre vocês: não dá para quebrar.</p>' +
      '<div class="linha relq-acoes"><button type="button" class="btn btn-p btn-primario' + (pl.completo ? '' : ' btn-inativo') + '" data-aceitar-pacto="' + pp.id + '">' + RP.icone('pacto') + (cobra ? 'Aceitar e pagar' : 'Aceitar') + '</button><button type="button" class="btn btn-p btn-fantasma" data-recusar-pacto="' + pp.id + '">Recusar</button></div></div>';
  }
  function cardCaptura(c) {
    var resta = Math.max(0, 24 - c.horas);
    if (c.meu) return '<div class="card pilha"><div class="linha"><span class="ico-placa">' + RP.icone('explorador') + '</span><span style="flex:1;min-width:0"><b>Seu ' + RP.esc(c.quem.toLowerCase()) + ' foi capturado</b><br><small class="fraco">' + RP.esc(reino(c.por).nome) + ' pede ' + RP.esc(txt(c.resgate)) + ' · decide em ' + Math.round(resta) + ' h</small></span></div>' +
      '<p class="fraco" style="font-size:var(--fs-2)">Quem captura vê de que reino o explorador é. Sem decisão em 24 h, ele é libertado; se você não pagar, o captor ainda pode executá-lo.</p>' +
      '<div class="linha relq-acoes"><button type="button" class="btn btn-p btn-primario" data-pagar-resgate="' + c.id + '">' + RP.icone('carroca') + 'Pagar resgate</button><button type="button" class="btn btn-p btn-fantasma" data-ignorar-resgate="' + c.id + '">Não pagar</button></div></div>';
    return '<div class="card pilha"><div class="linha"><span class="ico-placa">' + RP.icone('batedor') + '</span><span style="flex:1;min-width:0"><b>' + RP.esc(c.quem) + ' capturado</b><br><small class="fraco">De ' + RP.esc(reino(c.de).nome) + ' · pego pela guarnição da ' + RP.esc(c.onde) + ' · ' + Math.round(resta) + ' h para decidir</small></span></div>' +
      (c.pedido ? '<p class="selo selo-info">' + RP.icone('relogio') + 'Resgate pedido: ' + RP.esc(txt(c.pedido)) + '</p>' :
        '<div class="linha relq-acoes" style="flex-wrap:wrap"><button type="button" class="btn btn-p btn-primario" data-pedir-resgate="' + c.id + '">' + RP.icone('troca') + 'Pedir 30 de prata</button><button type="button" class="btn btn-p" data-libertar="' + c.id + '">Libertar</button><button type="button" class="btn btn-p btn-fantasma" data-executar="' + c.id + '">Executar</button></div>') + '</div>';
  }
  function desenhar(el) {
    var ofertas = C.ofertas.filter(function (o) { return o.estado === 'aberta'; }), propostas = C.propostasPacto.filter(function (p) { return p.estado === 'aberta'; });
    var capt = C.capturados.filter(function (c) { return !c.fim; }), pactos = C.pactos.filter(function (p) { return p.estado === 'aguardando' || (p.estado === 'ativo' && RP.fimItem(p) > Date.now()); });
    RP.$('.com-conteudo', el).innerHTML =
      '<div class="nota-regra">' + RP.icone('troca', 'ico-p') + '<span><b>Sem mercado global.</b> Troca direta só com reinos que você conhece: aliados, espionados ou identificados por estandarte ou bandeira. A proposta revela quem propõe, e as cargas <b>viajam</b> pelo mapa: podem ser roubadas.</span></div>' +
      '<div class="linha" style="margin-top:var(--esp-3)"><a class="btn btn-p btn-primario" href="#/troca" style="flex:1">' + RP.icone('troca') + 'Propor troca</a><a class="btn btn-p" href="#/pacto" style="flex:1">' + RP.icone('pacto') + 'Propor pacto</a></div>' +
      (ofertas.length ? '<div class="secao-titulo">Ofertas para você</div><div class="pilha">' + ofertas.map(cardOferta).join('') + '</div>' : '') +
      '<div class="secao-titulo">Pactos de não agressão</div><div class="pilha">' + propostas.map(cardPropostaPacto).join('') + pactos.map(cardPactoAtivo).join('') +
      (!propostas.length && !pactos.length ? '<p class="fraco">Nenhum pacto.</p>' : '') + '</div>' +
      '<p class="fraco" style="font-size:var(--fs-2);margin-top:var(--esp-2)">De 1 a 7 dias, até ' + C.pactosMax + ' ativos. Qualquer lado propõe e o pagamento pode ir em qualquer direção. Tropas enviadas a um local do outro descobrem o pacto ao chegar e voltam sem combate.</p>' +
      (capt.length ? '<div class="secao-titulo">Exploradores capturados</div><div class="pilha">' + capt.map(cardCaptura).join('') + '</div>' : '') +
      '<div class="secao-titulo">Suas propostas</div><div class="pilha">' + (C.minhas.length ? C.minhas.map(function (o) {
        return '<div class="card linha">' + brasao(o.para, 28) + '<span style="flex:1;min-width:0"><b>' + RP.esc(txt(o.da)) + ' por ' + RP.esc(txt(o.quer)) + '</b><br><small class="fraco">' + RP.esc(reino(o.para).nome) + ' · ' + (o.estado === 'aguardando' ? 'aguardando resposta' : o.estado === 'aceita' ? 'aceita · cargas a caminho' : o.estado) + '</small></span></div>';
      }).join('') : '<p class="fraco">Nenhuma proposta enviada.</p>') + '</div>' +
      '<div class="secao-titulo">Valor de referência</div><div class="card pilha"><p class="fraco" style="font-size:var(--fs-2)">Em recursos básicos. Orienta as trocas, sem obrigar: vale o que os dois combinarem.</p>' +
      '<div class="valor-grade">' + TODOS.filter(function (k) { return D.valorRef[k] > 1 || k === 'madeira'; }).map(function (k) {
        return '<span class="selo selo-g">' + RP.icone(k, 'ico-p r-' + k) + (k === 'madeira' ? 'Básicos' : RP.esc(RP.nomeRecurso(k).replace(/^./, function (c) { return c.toUpperCase(); }))) + ' <b class="num">' + D.valorRef[k] + '</b></span>';
      }).join('') + '</div></div><div style="height:var(--esp-8)"></div>';
  }
  RP.registrarTela('comercio', {
    secao: 'mais',
    montar: function (el) {
      tela = el;
      el.innerHTML = U.topo('Comércio e diplomacia', 'mais', 'Trocas, pactos e resgates') + '<div class="conteudo-tela com-conteudo"></div>';
      el.addEventListener('click', function (e) {
        var b, o, p, c;
        if ((b = e.target.closest('[data-aceitar-troca]'))) {
          o = porId(C.ofertas, b.getAttribute('data-aceitar-troca'));
          var av = checaNovato(o.de, o.quer, o.da);
          if (av) { RP.aviso({ titulo: 'Limite do novato', texto: av, icone: 'escudo', tipo: 'alerta', ms: 4200 }); return; }
          if (!enviarParte(o.de, o.quer, 'troca com ' + reino(o.de).nome)) { RP.aviso({ titulo: 'Recursos insuficientes', texto: RP.textoPlano(RP.planoRequisicao(o.quer, CASTELO[o.de]), CASTELO[o.de]), icone: 'alerta', tipo: 'perigo' }); return; }
          var m = cargaChegando(o.de, o.da, 'Troca de ' + reino(o.de).nome);
          contaNovato(o.de, o.quer, o.da);
          o.estado = 'aceita';
          RP.aviso({ titulo: 'Troca aceita', texto: 'Sua parte já saiu. ' + txt(o.da) + (m ? ' chega em ' + RP.fmtDuracao(m.d.seg) : '') + '. As duas cargas podem ser roubadas.', icone: 'troca', tipo: 'sucesso', ms: 4000 });
          invalidar(); desenhar(el); return;
        }
        if ((b = e.target.closest('[data-recusar-troca]'))) { porId(C.ofertas, b.getAttribute('data-recusar-troca')).estado = 'recusada'; RP.aviso({ titulo: 'Oferta recusada', texto: 'O outro reino é avisado.', icone: 'info', tipo: 'alerta' }); RP.invalidarTela('agora'); desenhar(el); return; }
        if ((b = e.target.closest('[data-aceitar-pacto]'))) {
          p = porId(C.propostasPacto, b.getAttribute('data-aceitar-pacto'));
          if (aceitarPacto({ com: p.de, dias: p.dias, carga: p.cobra }, p.cobra ? 'eu pago' : null)) { p.estado = 'aceita'; desenhar(el); }
          return;
        }
        if ((b = e.target.closest('[data-recusar-pacto]'))) { porId(C.propostasPacto, b.getAttribute('data-recusar-pacto')).estado = 'recusada'; RP.aviso({ titulo: 'Pacto recusado', texto: 'Sem pacto, nada impede um ataque entre vocês.', icone: 'info', tipo: 'alerta' }); RP.invalidarTela('agora'); desenhar(el); return; }
        if ((b = e.target.closest('[data-pagar-resgate]'))) {
          c = porId(C.capturados, b.getAttribute('data-pagar-resgate'));
          if (!enviarParte(c.por, c.resgate, 'resgate')) { RP.aviso({ titulo: 'Recursos insuficientes', texto: 'Faltam ' + txt(c.resgate) + '.', icone: 'alerta', tipo: 'perigo' }); return; }
          c.fim = 'pago';
          RP.aviso({ titulo: 'Resgate a caminho', texto: 'Quando chegar, o ' + c.quem.toLowerCase() + ' é solto e volta para casa.', icone: 'explorador', tipo: 'sucesso' });
          invalidar(); desenhar(el); return;
        }
        if ((b = e.target.closest('[data-ignorar-resgate]'))) { porId(C.capturados, b.getAttribute('data-ignorar-resgate')).fim = 'ignorado'; RP.aviso({ titulo: 'Resgate não pago', texto: 'O captor decide até o fim do prazo; sem decisão, o explorador é libertado.', icone: 'explorador', tipo: 'alerta' }); RP.invalidarTela('agora'); desenhar(el); return; }
        if ((b = e.target.closest('[data-pedir-resgate]'))) { c = porId(C.capturados, b.getAttribute('data-pedir-resgate')); c.pedido = { prata: 30 }; RP.aviso({ titulo: 'Resgate pedido', texto: reino(c.de).nome + ' recebe o pedido pelo sino e fica sabendo que foi você.', icone: 'prata', tipo: 'sucesso' }); desenhar(el); return; }
        if ((b = e.target.closest('[data-libertar]'))) { porId(C.capturados, b.getAttribute('data-libertar')).fim = 'libertado'; RP.aviso({ titulo: 'Explorador libertado', texto: 'Volta para o reino dele.', icone: 'explorador', tipo: 'sucesso' }); RP.invalidarTela('agora'); desenhar(el); return; }
        if ((b = e.target.closest('[data-executar]'))) {
          var cx = porId(C.capturados, b.getAttribute('data-executar'));
          RP.modal({ titulo: 'Executar o ' + RP.esc(cx.quem.toLowerCase()) + '?', corpo: '<p class="suave">' + RP.esc(reino(cx.de).nome) + ' perde o explorador e é avisado. Não há volta.</p>',
            acoes: [{ rotulo: 'Executar', classe: 'btn-perigo', acao: function () { cx.fim = 'executado'; RP.invalidarTela('agora'); desenhar(el); } }, { rotulo: 'Voltar' }] });
        }
      });
    },
    entrar: function (el) { desenhar(el); }
  });

  /* ---------------------------------------------------------------- tela Propor troca */
  var tr = { reino: 'mirante', da: 'madeira', qDa: 500, quer: 'ouro', qQuer: 20 };
  function stepRec(lado, q) {
    return '<span class="stepper"><button type="button" class="btn btn-icone" data-tr-d="' + lado + ':-1" aria-label="Menos"' + (q <= passo(lado) ? ' disabled' : '') + '>' + RP.icone('menos') + '</button><output class="num">' + RP.num(q) + '</output><button type="button" class="btn btn-icone" data-tr-d="' + lado + ':1" aria-label="Mais">' + RP.icone('mais') + '</button></span>';
  }
  function passo(lado) { var k = lado === 'da' ? tr.da : tr.quer; return D.valorRef[k] >= 10 ? 5 : 100; }
  function chips(lado, sel) {
    return '<div class="obj-add-lista">' + TODOS.map(function (k) {
      return '<button type="button" class="btn btn-p chip-sel" data-tr-rec="' + lado + ':' + k + '" aria-pressed="' + (sel === k) + '">' + RP.icone(k, 'ico-p r-' + k) + RP.esc(RP.nomeRecurso(k)) + '</button>';
    }).join('') + '</div>';
  }
  function cargas() { var a = {}, b = {}; a[tr.da] = tr.qDa; b[tr.quer] = tr.qQuer; return { da: a, quer: b }; }
  function desenharTroca(el) {
    var cg = cargas(), pl = RP.planoRequisicao(cg.da, CASTELO[tr.reino]), av = checaNovato(tr.reino, cg.da, cg.quer);
    RP.$('.tr-conteudo', el).innerHTML =
      '<div class="secao-titulo" style="margin-top:0">Com quem</div><div class="escolhas escolhas-lista">' + Object.keys(C.conhecidos).map(function (id) {
        return '<button type="button" class="escolha escolha-linha" data-tr-reino="' + id + '" aria-pressed="' + (tr.reino === id) + '">' + brasao(id, 30) + '<span class="escolha-txt"><b>' + RP.esc(reino(id).nome) + '</b><small class="fraco">Conhecido por ' + RP.esc(C.conhecidos[id]) + (novato(id) ? ' · sob escudo de novato' : '') + '</small></span></button>';
      }).join('') + '</div>' + notaNovato(tr.reino) +
      '<div class="secao-titulo">Você dá</div>' + chips('da', tr.da) + '<div class="card linha-entre" style="margin-top:var(--esp-2)"><span class="linha">' + RP.icone(tr.da, 'r-' + tr.da) + '<span><b>' + RP.esc(RP.nomeRecurso(tr.da)) + '</b><br><small class="fraco">no reino: ' + RP.num(RP.qtdRecurso(tr.da, '*')) + '</small></span></span>' + stepRec('da', tr.qDa) + '</div>' +
      '<div class="secao-titulo">Você quer</div>' + chips('quer', tr.quer) + '<div class="card linha-entre" style="margin-top:var(--esp-2)"><span class="linha">' + RP.icone(tr.quer, 'r-' + tr.quer) + '<b>' + RP.esc(RP.nomeRecurso(tr.quer)) + '</b></span>' + stepRec('quer', tr.qQuer) + '</div>' +
      '<div class="card pilha" style="margin-top:var(--esp-3)"><div class="linha-entre"><span class="fraco">Valor de referência</span><span class="num">' + RP.num(valor(cg.da)) + ' por ' + RP.num(valor(cg.quer)) + '</span></div>' +
      '<div class="linha-entre"><span class="fraco">Equilíbrio</span>' + seloValor(cg.quer, cg.da) + '</div>' +
      '<small class="obra-estoque' + (pl.completo ? ' vem' : ' falta') + '">' + RP.icone('carroca', 'ico-p') + RP.esc(pl.completo ? 'Se aceitarem, sua parte sai dos locais mais próximos (≈ ' + RP.fmtDuracao(pl.seg) + ').' : 'Faltam ' + txt(pl.faltaReino) + ' no reino todo.') + '</small>' +
      (av ? '<p class="nota-antiga">' + RP.icone('escudo', 'ico-p') + RP.esc(av) + '</p>' : '') +
      '<p class="fraco" style="font-size:var(--fs-2)">A proposta revela que foi você. As duas cargas viajam visíveis no mapa e podem ser roubadas.</p></div><div style="height:var(--esp-8)"></div>';
    RP.$('.rodape-resumo', el).innerHTML = '<div class="resumo-linha"><b>' + RP.esc(txt(cg.da)) + ' por ' + RP.esc(txt(cg.quer)) + '</b></div><div class="resumo-linha fraco">para ' + RP.esc(reino(tr.reino).nome) + '</div>';
    RP.$('[data-tr-enviar]', el).classList.toggle('btn-inativo', !pl.completo || !!av || tr.da === tr.quer);
  }
  RP.registrarTela('troca', {
    secao: 'mais',
    montar: function (el) {
      el.innerHTML = U.topo('Propor troca', 'comercio', 'Troca direta') + '<div class="conteudo-tela tr-conteudo"></div>' +
        '<div class="rodape-acao rodape-com-resumo"><div class="rodape-resumo"></div><button type="button" class="btn btn-primario btn-bloco btn-grande" data-tr-enviar>' + RP.icone('troca') + 'Enviar proposta</button></div>';
      el.addEventListener('click', function (e) {
        var b, p;
        if ((b = e.target.closest('[data-tr-reino]'))) { tr.reino = b.getAttribute('data-tr-reino'); desenharTroca(el); return; }
        if ((b = e.target.closest('[data-tr-rec]'))) {
          p = b.getAttribute('data-tr-rec').split(':');
          if (p[0] === 'da') { tr.da = p[1]; tr.qDa = passo('da') * 4; } else { tr.quer = p[1]; tr.qQuer = passo('quer') * 4; }
          desenharTroca(el); return;
        }
        if ((b = e.target.closest('[data-tr-d]'))) {
          p = b.getAttribute('data-tr-d').split(':');
          if (p[0] === 'da') tr.qDa = Math.max(passo('da'), tr.qDa + +p[1] * passo('da')); else tr.qQuer = Math.max(passo('quer'), tr.qQuer + +p[1] * passo('quer'));
          desenharTroca(el); return;
        }
        if (e.target.closest('[data-tr-enviar]')) {
          var cg = cargas(), av = checaNovato(tr.reino, cg.da, cg.quer);
          if (tr.da === tr.quer) { RP.aviso({ titulo: 'Recursos iguais', texto: 'Escolha recursos diferentes.', icone: 'info', tipo: 'alerta' }); return; }
          if (av) { RP.aviso({ titulo: 'Limite do novato', texto: av, icone: 'escudo', tipo: 'alerta', ms: 4200 }); return; }
          if (!RP.planoRequisicao(cg.da, CASTELO[tr.reino]).completo) { RP.aviso({ titulo: 'Recursos insuficientes', texto: 'Você não tem ' + txt(cg.da) + ' no reino.', icone: 'alerta', tipo: 'perigo' }); return; }
          var o = { id: 'tr-' + Date.now(), para: tr.reino, da: cg.da, quer: cg.quer, horas: 0, estado: 'aguardando' }, quem = reino(tr.reino).nome;
          C.minhas.unshift(o);
          RP.aviso({ titulo: 'Proposta enviada', texto: quem + ' recebe pelo sino e vê que foi você.', icone: 'troca', tipo: 'sucesso' });
          /* no protótipo, o outro reino aceita depois de alguns segundos */
          setTimeout(function () {
            if (!enviarParte(o.para, o.da, 'troca com ' + quem)) { o.estado = 'cancelada: faltou recurso'; return; }
            cargaChegando(o.para, o.quer, 'Troca de ' + quem); contaNovato(o.para, o.da, o.quer);
            o.estado = 'aceita';
            RP.aviso({ titulo: quem + ' aceitou', texto: 'Sua parte saiu; ' + txt(o.quer) + ' a caminho do castelo.', icone: 'troca', tipo: 'sucesso' });
            invalidar(); if (tela && !tela.hidden) desenhar(tela);
          }, 3500);
          RP.ir('comercio');
        }
      });
    },
    entrar: function (el, params) { if (params.get('reino') && C.conhecidos[params.get('reino')]) tr.reino = params.get('reino'); desenharTroca(el); }
  });

  /* ---------------------------------------------------------------- tela Propor pacto */
  var pc = { reino: 'valdren', dias: 3, direcao: 'eu pago', rec: 'prata', q: 50 };
  var DIRECOES = [['eu pago', 'Eu pago', 'Você paga para não ser atacado'], ['eu cobro', 'Eu cobro', 'Eles pagam para você não atacar'], ['sem', 'Sem pagamento', 'Trégua mútua']];
  function desenharPacto(el) {
    var alvos = Object.keys(C.conhecidos).filter(function (id) { return !W.aliado(id); });
    if (alvos.indexOf(pc.reino) < 0) pc.reino = alvos[0];
    if (pc.direcao === 'eu cobro' && novato(pc.reino)) pc.direcao = 'eu pago';
    var carga = {}; carga[pc.rec] = pc.q;
    var ja = RP.pactoCom(pc.reino), cheio = pactosAtivos().length >= C.pactosMax;
    RP.$('.pc-conteudo', el).innerHTML =
      '<div class="nota-regra">' + RP.icone('pacto', 'ico-p') + '<span><b>O jogo garante o pacto.</b> Enquanto durar, nenhum dos dois consegue atacar, saquear ou interceptar o outro. Começa quando o pagamento chega.</span></div>' +
      '<div class="secao-titulo">Com quem</div><div class="escolhas escolhas-lista">' + alvos.map(function (id) {
        var p = RP.pactoCom(id);
        return '<button type="button" class="escolha escolha-linha" data-pc-reino="' + id + '" aria-pressed="' + (pc.reino === id) + '">' + brasao(id, 30) + '<span class="escolha-txt"><b>' + RP.esc(reino(id).nome) + '</b><small class="fraco">' + (p ? 'Pacto ' + (p.estado === 'ativo' ? 'em vigor' : 'aguardando pagamento') : 'Conhecido por ' + RP.esc(C.conhecidos[id])) + (novato(id) ? ' · sob escudo de novato' : '') + '</small></span></button>';
      }).join('') + '</div>' + notaNovato(pc.reino) +
      '<div class="secao-titulo">Duração</div><div class="card linha-entre"><span><b>' + pc.dias + (pc.dias > 1 ? ' dias' : ' dia') + '</b><br><small class="fraco">de 1 a 7</small></span>' +
      '<span class="stepper"><button type="button" class="btn btn-icone" data-pc-dias="-1" aria-label="Menos"' + (pc.dias <= 1 ? ' disabled' : '') + '>' + RP.icone('menos') + '</button><output class="num">' + pc.dias + '</output><button type="button" class="btn btn-icone" data-pc-dias="1" aria-label="Mais"' + (pc.dias >= 7 ? ' disabled' : '') + '>' + RP.icone('mais') + '</button></span></div>' +
      '<div class="secao-titulo">Pagamento</div><div class="escolhas">' + DIRECOES.map(function (d) {
        var bloq = d[0] === 'eu cobro' && novato(pc.reino);
        return '<button type="button" class="escolha' + (bloq ? ' bloqueado' : '') + '" data-pc-dir="' + d[0] + '" aria-pressed="' + (pc.direcao === d[0]) + '"' + (bloq ? ' aria-disabled="true"' : '') + '><b>' + d[1] + '</b><small class="fraco">' + (bloq ? 'Não se cobra de reino sob escudo' : d[2]) + '</small></button>';
      }).join('') + '</div>' +
      (pc.direcao !== 'sem' ? '<div class="card linha-entre" style="margin-top:var(--esp-2)"><span class="linha">' + RP.icone(pc.rec, 'r-' + pc.rec) + '<span><b>' + RP.esc(RP.nomeRecurso(pc.rec)) + '</b><br><small class="fraco">valor ' + RP.num(valor(carga)) + '</small></span></span>' +
        '<span class="stepper"><button type="button" class="btn btn-icone" data-pc-q="-1" aria-label="Menos"' + (pc.q <= 10 ? ' disabled' : '') + '>' + RP.icone('menos') + '</button><output class="num">' + RP.num(pc.q) + '</output><button type="button" class="btn btn-icone" data-pc-q="1" aria-label="Mais">' + RP.icone('mais') + '</button></span></div>' +
        '<div class="obj-add-lista" style="margin-top:var(--esp-2)">' + ['prata', 'ouro', 'ferro', 'comida'].map(function (k) { return '<button type="button" class="btn btn-p chip-sel" data-pc-rec="' + k + '" aria-pressed="' + (pc.rec === k) + '">' + RP.icone(k, 'ico-p r-' + k) + RP.esc(RP.nomeRecurso(k)) + '</button>'; }).join('') + '</div>' : '') +
      (ja ? '<p class="nota-antiga">' + RP.icone('pacto', 'ico-p') + 'Já há um pacto com este reino.</p>' : cheio ? '<p class="nota-antiga">' + RP.icone('alerta', 'ico-p') + 'Você já tem ' + C.pactosMax + ' pactos ativos, o máximo.</p>' : '') +
      '<p class="fraco" style="font-size:var(--fs-2);margin:var(--esp-3) 0 var(--esp-8)">Até ' + C.pactosMax + ' pactos ativos por reino. Tropas enviadas a um local do outro descobrem o pacto ao chegar e voltam sem combate.</p>';
    RP.$('.rodape-resumo', el).innerHTML = '<div class="resumo-linha"><b>' + pc.dias + (pc.dias > 1 ? ' dias' : ' dia') + ' sem ataques com ' + RP.esc(reino(pc.reino).nome) + '</b></div><div class="resumo-linha fraco">' + (pc.direcao === 'sem' ? 'sem pagamento' : (pc.direcao === 'eu pago' ? 'você paga ' : 'eles pagam ') + RP.esc(txt(carga))) + '</div>';
    RP.$('[data-pc-enviar]', el).classList.toggle('btn-inativo', !!ja || cheio);
  }
  RP.registrarTela('pacto', {
    secao: 'mais',
    montar: function (el) {
      el.innerHTML = U.topo('Propor pacto', 'comercio', 'Não agressão') + '<div class="conteudo-tela pc-conteudo"></div>' +
        '<div class="rodape-acao rodape-com-resumo"><div class="rodape-resumo"></div><button type="button" class="btn btn-primario btn-bloco btn-grande" data-pc-enviar>' + RP.icone('pacto') + 'Enviar proposta</button></div>';
      el.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-pc-reino]'))) { pc.reino = b.getAttribute('data-pc-reino'); desenharPacto(el); return; }
        if ((b = e.target.closest('[data-pc-dias]'))) { pc.dias = Math.max(1, Math.min(7, pc.dias + +b.getAttribute('data-pc-dias'))); desenharPacto(el); return; }
        if ((b = e.target.closest('[data-pc-dir]'))) { if (b.getAttribute('aria-disabled') === 'true') { RP.aviso({ titulo: 'Reino sob escudo', texto: 'Ninguém pode cobrar pacto de um reino sob escudo de novato.', icone: 'escudo', tipo: 'alerta' }); return; } pc.direcao = b.getAttribute('data-pc-dir'); desenharPacto(el); return; }
        if ((b = e.target.closest('[data-pc-rec]'))) { pc.rec = b.getAttribute('data-pc-rec'); pc.q = D.valorRef[pc.rec] >= 10 ? 50 : 500; desenharPacto(el); return; }
        if ((b = e.target.closest('[data-pc-q]'))) { var st = D.valorRef[pc.rec] >= 10 ? 10 : 100; pc.q = Math.max(st, pc.q + +b.getAttribute('data-pc-q') * st); desenharPacto(el); return; }
        if (e.target.closest('[data-pc-enviar]')) {
          if (RP.pactoCom(pc.reino)) { RP.aviso({ titulo: 'Já há pacto', texto: 'Espere o atual terminar.', icone: 'pacto', tipo: 'alerta' }); return; }
          if (pactosAtivos().length >= C.pactosMax) { RP.aviso({ titulo: 'Limite de pactos', texto: 'Até ' + C.pactosMax + ' ativos.', icone: 'pacto', tipo: 'alerta' }); return; }
          var carga = {}; if (pc.direcao !== 'sem') carga[pc.rec] = pc.q;
          var quem = reino(pc.reino).nome, dados = { com: pc.reino, dias: pc.dias, carga: carga }, dir = pc.direcao === 'eu pago' ? 'eu pago' : pc.direcao === 'eu cobro' ? 'eles pagam' : null;
          if (dir === 'eu pago' && !RP.planoRequisicao(carga, CASTELO[pc.reino]).completo) { RP.aviso({ titulo: 'Recursos insuficientes', texto: 'Você não tem ' + txt(carga) + ' no reino.', icone: 'alerta', tipo: 'perigo' }); return; }
          RP.aviso({ titulo: 'Proposta enviada', texto: quem + ' recebe pelo sino.', icone: 'pacto', tipo: 'sucesso' });
          setTimeout(function () {
            RP.aviso({ titulo: quem + ' aceitou o pacto', texto: dir ? 'Começa quando o pagamento chegar.' : 'Começa agora.', icone: 'pacto', tipo: 'sucesso' });
            aceitarPacto(dados, dir);
            if (tela && !tela.hidden) desenhar(tela);
          }, 3500);
          RP.ir('comercio');
        }
      });
    },
    entrar: function (el, params) { if (params.get('reino')) pc.reino = params.get('reino'); desenharPacto(el); }
  });

  /* ---------------------------------------------------------------- pendências desta área (usadas em "Precisa de você") */
  RP.pendenciasComercio = function () {
    if (!RP.sistema('comercio')) return [];
    var L = [];
    C.propostasPacto.forEach(function (p) { if (p.estado === 'aberta') L.push({ g: 'urgente', ic: 'pacto', t: reino(p.de).nome + ' propõe um pacto', d: p.dias + ' dias · ' + (p.cobra ? 'cobra ' + txt(p.cobra) : 'sem pagamento'), href: '#/comercio', bt: 'Responder' }); });
    C.capturados.forEach(function (c) { if (!c.fim && c.meu) L.push({ g: 'urgente', ic: 'explorador', t: 'Explorador capturado', d: reino(c.por).nome + ' pede ' + txt(c.resgate), href: '#/comercio', bt: 'Decidir' }); });
    C.capturados.forEach(function (c) { if (!c.fim && !c.meu && !c.pedido) L.push({ g: 'oportunidade', ic: 'batedor', t: 'Batedor inimigo capturado', d: 'de ' + reino(c.de).nome + ' · resgate, libertar ou executar', href: '#/comercio', bt: 'Decidir' }); });
    C.ofertas.forEach(function (o) { if (o.estado === 'aberta') L.push({ g: 'oportunidade', ic: 'troca', t: reino(o.de).nome + ' oferece ' + txt(o.da), d: 'em troca de ' + txt(o.quer), href: '#/comercio', bt: 'Ver' }); });
    return L;
  };
})();
