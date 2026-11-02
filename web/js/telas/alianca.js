/* Reino de Pedra — Aliança (#/alianca: membros, cargos, convites, pedidos de entrada e de recursos, trégua, conversa)
   e Pedir recursos (#/pedido?reino=<id>). Dados de GET /alianca. Porte de prototipo/js/alianca.js e mensagens.js (conversa). */
(function () {
  'use strict';
  var RP = window.RP, S = RP.social;
  var CARGOS = { lider: 'Líder', conselheiro: 'Conselheiro', membro: 'Membro' };
  var dados = null;

  function carregar() { return RP.get('/alianca').then(function (d) { dados = d; RP.sincronizar(d.agora); return d; }); }
  function tempoTxt(min) { return min == null ? '' : ' · castelo a ' + RP.fmtDuracao(min * 60); }

  function pedidoCard(p) {
    var de = p.de;
    return '<div class="card pilha"><div class="linha">' + S.brasao(de, 32) + '<span style="flex:1;min-width:0"><b>' + RP.esc(S.nome(de)) + ' pede ' + RP.esc(S.cargaTxt(p.quer)) + '</b><br><small class="fraco">' +
      (p.local ? 'para ' + RP.esc(p.local) + ' · ' : '') + 'responda até ' + RP.fmtHora(p.ate) + '</small></span></div>' + S.recadoHTML(p.recado) +
      '<small class="obra-estoque vem">' + RP.icone('carroca', 'ico-p') + 'Sai dos seus locais mais próximos, a pé. Viaja visível e pode ser roubada no caminho.</small>' +
      '<div class="linha relq-acoes"><button type="button" class="btn btn-p btn-primario" data-proposta-aceitar="' + p.id + '">' + RP.icone('carroca') + 'Enviar</button>' +
      '<button type="button" class="btn btn-p btn-fantasma" data-proposta-recusar="' + p.id + '">Recusar</button></div></div>';
  }
  function meuPedido(p) {
    var ag = RP.agora(), indo = p.estado === 'aceita' && p.chegada && p.chegada > ag;
    var est = p.estado === 'aberta' ? 'aguardando resposta' : p.estado === 'aceita' ? (indo ? 'a caminho, chega em <b class="num" data-fim="' + p.chegada + '">' + RP.fmtResta(p.chegada - ag) + '</b>' : 'entregue') : p.estado === 'recusada' ? 'recusado' : p.estado;
    return '<div class="card linha">' + S.brasao(p.para, 28) + '<span style="flex:1;min-width:0"><b>' + RP.esc(S.cargaTxt(p.quer)) + '</b><br><small class="fraco">' + RP.esc(S.nome(p.para)) + (p.local ? ' · para ' + RP.esc(p.local) : '') + ' · ' + est + '</small></span>' +
      (p.estado === 'aberta' ? '<button type="button" class="btn btn-p btn-fantasma" data-proposta-cancelar="' + p.id + '">Cancelar</button>' : '') + '</div>';
  }
  function conversaHTML(a, max) {
    return '<div class="card pilha conversa"><ol class="conversa-lista">' + (a.conversa.length ? a.conversa.slice(-20).map(function (c) {
      return '<li class="' + (c.minha ? 'minha' : '') + '">' + S.brasao(c.reino, 22) + '<span><b>' + RP.esc(S.nome(c.reino)) + '</b> <small class="fraco">' + RP.fmtHa((RP.agora() - c.quando) / 3600000) + '</small><br>' + RP.esc(c.texto) + '</span></li>';
    }).join('') : '<li class="fraco">Ninguém escreveu ainda.</li>') + '</ol>' +
      '<div class="conversa-envio"><label class="sr" for="texto-conversa">Mensagem para a aliança</label><input id="texto-conversa" type="text" maxlength="' + max + '" placeholder="Escreva para a aliança" autocomplete="off">' +
      '<button type="button" class="btn btn-p btn-primario" data-conversa-enviar>' + RP.icone('seta') + 'Enviar</button></div>' +
      '<p class="fraco" style="font-size:var(--fs-2)">O único chat do jogo: só membros leem. Para outros reinos, use um mensageiro.</p></div>';
  }

  function semAlianca(d) {
    var h = '<div class="nota-regra">' + RP.icone('estandarte', 'ico-p') + '<span>Aliados se reconhecem no mapa, veem as marchas uns dos outros, <b>pedem recursos</b> e reforçam os locais uns dos outros. Locais de aliados não são alvo. No máximo <b>' + d.limite + ' reinos</b> por aliança.</span></div>';
    if (d.livreEm) h += '<p class="nota-antiga">' + RP.icone('relogio', 'ico-p') + 'Você saiu de uma aliança: só entra em outra em <b class="num" data-fim="' + d.livreEm + '">' + RP.fmtResta(d.livreEm - RP.agora()) + '</b>.</p>';
    if (d.convitesRecebidos.length) h += '<div class="secao-titulo">Convites</div><div class="pilha">' + d.convitesRecebidos.map(function (c) {
      return '<div class="card pilha"><div class="linha">' + RP.brasao(c.alianca.brasao, { tamanho: 40 }) + '<span style="flex:1;min-width:0"><b>' + RP.esc(c.alianca.nome) + '</b><br><small class="fraco">' + c.alianca.membros + ' de ' + d.limite + ' reinos · convite de ' + RP.esc(S.nome(c.por)) + ' · até ' + RP.fmtHora(c.ate) + '</small></span></div>' +
        '<div class="linha relq-acoes"><button type="button" class="btn btn-p btn-primario" data-convite-aceitar="' + c.alianca.id + '">' + RP.icone('check') + 'Entrar</button><button type="button" class="btn btn-p btn-fantasma" data-convite-recusar="' + c.alianca.id + '">Recusar</button></div></div>';
    }).join('') + '</div>';
    if (d.aliancasConhecidas.length) h += '<div class="secao-titulo">Alianças de reinos que você conhece</div><div class="pilha">' + d.aliancasConhecidas.map(function (a) {
      return '<div class="card linha">' + RP.brasao(a.brasao, { tamanho: 32 }) + '<span style="flex:1;min-width:0"><b>' + RP.esc(a.nome) + '</b><br><small class="fraco">' + a.membros + ' de ' + d.limite + ' · com ' + RP.esc(a.conhecidos.join(', ')) + '</small></span>' +
        (a.pedido ? '<span class="selo selo-info">' + RP.icone('relogio') + 'Pedido enviado</span>' : a.cheia ? '<span class="selo">Completa</span>' : '<button type="button" class="btn btn-p" data-pedir-entrada="' + a.id + '">Pedir para entrar</button>') + '</div>';
    }).join('') + '</div>';
    h += '<div class="secao-titulo">Fundar uma aliança</div><div class="card pilha"><div class="campo"><label for="nome-alianca">Nome da aliança</label><input id="nome-alianca" type="text" minlength="' + d.nome.min + '" maxlength="' + d.nome.max + '" placeholder="Ex.: Liga do Vale" autocomplete="off">' +
      '<span class="campo-ajuda">De ' + d.nome.min + ' a ' + d.nome.max + ' letras. Você será o líder e convida reinos que conhece.</span></div>' +
      '<button type="button" class="btn btn-p btn-primario" data-fundar-alianca>' + RP.icone('estandarte') + 'Fundar aliança</button></div><div style="height:var(--esp-8)"></div>';
    return h;
  }

  function comAlianca(d) {
    var a = d.alianca, lider = a.meuCargo === 'lider', gerencia = a.meuCargo !== 'membro';
    var nCons = a.membros.filter(function (x) { return x.cargo === 'conselheiro'; }).length;
    var paraMim = d.pedidosRecursos.filter(function (p) { return !p.minha && p.estado === 'aberta'; }), meus = d.pedidosRecursos.filter(function (p) { return p.minha; });
    var h = '<div class="card card-moldura linha al-topo">' + RP.brasao(a.brasao, { tamanho: 56 }) + '<span style="flex:1;min-width:0"><h2>' + RP.esc(a.nome) + '</h2><small class="fraco">Desde ' + RP.fmtHora(a.criadaEm) + ' · você é ' + CARGOS[a.meuCargo].toLowerCase() + '</small></span><span class="selo">' + a.membros.length + ' de ' + d.limite + '</span></div>' +
      '<div class="nota-regra">' + RP.icone('estandarte', 'ico-p') + '<span>Aliados se reconhecem no mapa e podem <b>pedir recursos</b> uns aos outros. A ajuda <b>viaja</b>: leva tempo e pode ser roubada no caminho. Locais de aliados não são alvo; não há ataque conjunto.</span></div>';
    if (paraMim.length) h += '<div class="secao-titulo">Pedidos para você</div><div class="pilha">' + paraMim.map(pedidoCard).join('') + '</div>';
    if (gerencia && a.pedidos && a.pedidos.length) h += '<div class="secao-titulo">Pedidos de entrada</div><div class="pilha">' + a.pedidos.map(function (p) {
      return '<div class="card linha">' + S.brasao(p.reino, 30) + '<span style="flex:1;min-width:0"><b>' + RP.esc(S.nome(p.reino)) + '</b><br><small class="fraco">quer entrar · até ' + RP.fmtHora(p.ate) + '</small></span>' +
        '<button type="button" class="btn btn-p btn-primario" data-entrada-aceitar="' + p.reino.id + '">' + RP.icone('check') + 'Aceitar</button><button type="button" class="btn btn-p btn-fantasma btn-icone" data-entrada-recusar="' + p.reino.id + '" aria-label="Recusar">' + RP.icone('fechar') + '</button></div>';
    }).join('') + '</div>';
    h += '<div class="secao-titulo">Membros</div><div class="card lista">' + a.membros.map(function (x) {
      var nome = RP.esc(S.nome(x.reino)) + (x.eu ? ' (você)' : '');
      return '<div class="lista-item">' + S.brasao(x.reino, 32) + '<span style="flex:1;min-width:0"><b>' + (x.cargo === 'lider' ? RP.icone('coroa', 'ico-p cor-destaque') + ' ' : '') + nome + '</b><br><small class="fraco">' + CARGOS[x.cargo] + tempoTxt(x.minutos) + (x.escudo ? ' · sob escudo de novato' : '') + '</small></span>' +
        (x.eu ? '' : (lider ? '<button type="button" class="btn btn-p btn-fantasma btn-icone" data-cargo="' + x.reino.id + '" data-cargo-atual="' + x.cargo + '" aria-label="Cargo de ' + RP.esc(S.nome(x.reino)) + '">' + RP.icone('coroa') + '</button>' : '') +
          '<a class="btn btn-p" href="#/pedido?reino=' + x.reino.id + '">' + RP.icone('carroca') + 'Pedir</a>') + '</div>';
    }).join('') + '</div>' +
      '<p class="fraco" style="font-size:var(--fs-2);margin-top:var(--esp-2)">Líder convida, expulsa e promove. Até ' + d.conselheirosMax + ' conselheiros (agora ' + nCons + ') convidam e aceitam pedidos de entrada. Se o líder entrar em regência, a liderança passa ao conselheiro mais antigo.</p>';
    if (gerencia && a.membros.length < d.limite) {
      var cands = d.conhecidos.filter(function (c) { return !c.naAlianca && !(a.convites || []).some(function (v) { return v.reino && v.reino.id === c.reino.id; }); });
      h += '<div class="secao-titulo">Convidar · ' + (d.limite - a.membros.length) + ' vagas</div>' + (cands.length ? '<div class="escolhas escolhas-lista">' + cands.map(function (c) {
        return '<button type="button" class="escolha escolha-linha" data-convidar="' + c.reino.id + '">' + S.brasao(c.reino, 30) + '<span class="escolha-txt"><b>' + RP.esc(c.reino.nome) + '</b><small class="fraco">Reino que você conhece · toque para convidar</small></span>' + RP.icone('mais', 'ico-p') + '</button>';
      }).join('') + '</div>' : S.vazio('Você só convida reinos que conhece: espionados, identificados por estandarte, bandeira ou mensagem.'));
      if ((a.convites || []).length) h += '<div class="pilha" style="margin-top:var(--esp-2)">' + a.convites.map(function (v) {
        return '<div class="card linha">' + S.brasao(v.reino, 24) + '<span style="flex:1"><b>' + RP.esc(S.nome(v.reino)) + '</b><br><small class="fraco">convidado por ' + RP.esc(v.por || '') + ' · vale até ' + RP.fmtHora(v.ate) + '</small></span><span class="selo selo-info">' + RP.icone('relogio') + 'Convite</span></div>';
      }).join('') + '</div>';
    }
    h += '<div class="secao-titulo">Conversa</div>' + conversaHTML(a, d.conversaMax);
    if (a.treguas.length) h += '<div class="secao-titulo">Em trégua</div><div class="pilha">' + a.treguas.map(function (t) {
      return '<div class="card linha">' + S.brasao(t.reino, 28) + '<span style="flex:1;min-width:0"><b>' + RP.esc(S.nome(t.reino)) + '</b><br><small class="fraco">' + (t.como === 'expulso' ? 'Foi expulso' : 'Saiu da aliança') + ' · nenhum lado ataca até o fim da trégua</small></span><span class="selo selo-info">' + RP.icone('pacto') + '<span data-fim="' + t.ate + '">' + RP.fmtResta(t.ate - RP.agora()) + '</span></span></div>';
    }).join('') + '</div>';
    if (d.reforcos.recebidos.length || d.reforcos.meus.length) h += '<div class="secao-titulo">Reforços</div><div class="pilha">' +
      d.reforcos.recebidos.map(function (e) { return '<div class="card linha">' + S.brasao(e.reino, 28) + '<span style="flex:1;min-width:0"><b>' + RP.esc(S.nome(e.reino)) + ' defende ' + RP.esc(e.local) + '</b><br><small class="fraco">' + RP.esc(RP.partesGrupo(e.tropas)) + ' · continuam sendo dele</small></span></div>'; }).join('') +
      d.reforcos.meus.map(function (e) { return '<div class="card linha">' + S.brasao(e.aliado, 28) + '<span style="flex:1;min-width:0"><b>Suas tropas em ' + RP.esc(e.local) + '</b><br><small class="fraco">' + RP.esc(RP.partesGrupo(e.tropas)) + '</small></span><button type="button" class="btn btn-p" data-reforco-volta="' + e.localId + '">' + RP.icone('voltar') + 'Voltar</button></div>'; }).join('') + '</div>';
    h += '<div class="secao-titulo">Seus pedidos</div><div class="pilha">' + (meus.length ? meus.map(meuPedido).join('') : S.vazio('Nenhum pedido feito. Toque em Pedir ao lado de um aliado.')) + '</div>' +
      '<div class="secao-titulo">Sair</div><div class="card pilha"><p class="fraco" style="font-size:var(--fs-2)">Qualquer membro sai quando quiser. Ao sair ou ser expulso, vale uma <b>trégua de ' + d.treguaH + ' h</b> entre o reino e a aliança, garantida pelo jogo, e só se entra em outra aliança depois de ' + d.treguaH + ' h. A visão das marchas acaba na hora.</p>' +
      '<button type="button" class="btn btn-p btn-fantasma" data-sair-alianca>' + RP.icone('voltar') + 'Sair da aliança</button></div><div style="height:var(--esp-8)"></div>';
    return h;
  }

  function desenhar(el) {
    return carregar().then(function (d) {
      RP.$('.al-conteudo', el).innerHTML = d.alianca ? comAlianca(d) : semAlianca(d);
      var sub = RP.$('.topo-titulos small', el); if (sub) sub.textContent = d.alianca ? d.alianca.nome : 'Sem aliança';
      var lista = RP.$('.conversa-lista', el); if (lista) lista.scrollTop = lista.scrollHeight;
    }).catch(function (e) { RP.$('.al-conteudo', el).innerHTML = S.vazio(RP.esc(e.message)); });
  }
  function acao(p, titulo, texto, el) {
    return RP.tentar(p).then(function () {
      if (titulo) RP.aviso({ titulo: titulo, texto: texto, icone: 'estandarte', tipo: 'sucesso' });
      RP.recarregarReino(); if (RP.mapaModelo) RP.mapaModelo.velho = true;
      return desenhar(el);
    }).catch(function () { /* aviso já mostrado */ });
  }

  RP.registrarTela('alianca', {
    secao: 'mais',
    montar: function (el) {
      el.innerHTML = RP.topoVoltar('Aliança', 'mais', ' ') + '<div class="conteudo-tela al-conteudo"></div>';
      el.addEventListener('click', function (e) {
        var b;
        if (e.target.closest('[data-fundar-alianca]')) { acao(RP.post('/alianca', { nome: (RP.$('#nome-alianca', el).value || '').trim() }), 'Aliança fundada', 'Convide reinos que você conhece.', el); return; }
        if ((b = e.target.closest('[data-convite-aceitar]'))) { acao(RP.post('/aliancas/' + b.getAttribute('data-convite-aceitar') + '/convite/aceitar'), 'Você entrou na aliança', 'Aliados se reconhecem no mapa.', el); return; }
        if ((b = e.target.closest('[data-convite-recusar]'))) { acao(RP.post('/aliancas/' + b.getAttribute('data-convite-recusar') + '/convite/recusar'), 'Convite recusado', null, el); return; }
        if ((b = e.target.closest('[data-pedir-entrada]'))) { acao(RP.post('/aliancas/' + b.getAttribute('data-pedir-entrada') + '/entrar'), 'Pedido enviado', 'O líder e os conselheiros respondem.', el); return; }
        if ((b = e.target.closest('[data-entrada-aceitar]'))) { acao(RP.post('/alianca/pedidos-entrada/' + b.getAttribute('data-entrada-aceitar') + '/aceitar'), 'Novo membro', null, el); return; }
        if ((b = e.target.closest('[data-entrada-recusar]'))) { acao(RP.post('/alianca/pedidos-entrada/' + b.getAttribute('data-entrada-recusar') + '/recusar'), 'Pedido recusado', null, el); return; }
        if ((b = e.target.closest('[data-convidar]'))) { acao(RP.post('/alianca/convidar', { reinoId: +b.getAttribute('data-convidar') }), 'Convite enviado', 'O reino recebe pelo sino e fica sabendo que foi você.', el); return; }
        if ((b = e.target.closest('[data-proposta-aceitar]'))) { acao(RP.post('/propostas/' + b.getAttribute('data-proposta-aceitar') + '/aceitar'), 'Ajuda a caminho', 'Pode ser roubada no caminho.', el); return; }
        if ((b = e.target.closest('[data-proposta-recusar]'))) { acao(RP.post('/propostas/' + b.getAttribute('data-proposta-recusar') + '/recusar'), 'Pedido recusado', 'O aliado é avisado.', el); return; }
        if ((b = e.target.closest('[data-proposta-cancelar]'))) { acao(RP.post('/propostas/' + b.getAttribute('data-proposta-cancelar') + '/cancelar'), 'Pedido cancelado', null, el); return; }
        if ((b = e.target.closest('[data-cargo]'))) {
          var id = +b.getAttribute('data-cargo'), cons = b.getAttribute('data-cargo-atual') === 'conselheiro';
          var m = dados.alianca.membros.filter(function (x) { return x.reino.id === id; })[0];
          RP.modal({
            titulo: RP.esc(S.nome(m.reino)),
            corpo: '<p class="suave">Cargo atual: <b>' + CARGOS[m.cargo] + '</b>. Conselheiros convidam e aceitam pedidos de entrada (até ' + dados.conselheirosMax + '). Quem é expulso fica em trégua de ' + dados.treguaH + ' h com a aliança.</p>',
            acoes: [
              cons ? { rotulo: 'Rebaixar a membro', acao: function () { acao(RP.post('/alianca/membros/' + id + '/rebaixar'), 'Cargo mudado', null, RP.$('[data-tela=alianca]')); } }
                : { rotulo: RP.icone('coroa') + 'Promover a conselheiro', classe: 'btn-primario', acao: function () { acao(RP.post('/alianca/membros/' + id + '/promover'), 'Novo conselheiro', null, RP.$('[data-tela=alianca]')); } },
              { rotulo: 'Expulsar', classe: 'btn-perigo', acao: function () { acao(RP.post('/alianca/membros/' + id + '/expulsar'), 'Reino expulso', 'Trégua de ' + dados.treguaH + ' h entre ele e a aliança.', RP.$('[data-tela=alianca]')); } },
              { rotulo: 'Voltar' }]
          });
          return;
        }
        if (e.target.closest('[data-sair-alianca]')) {
          RP.modal({
            titulo: 'Sair da ' + RP.esc(dados.alianca.nome) + '?',
            corpo: '<p class="suave">A visão das marchas dos aliados acaba na hora. Por ' + dados.treguaH + ' h, nenhum lado pode atacar o outro, e você só entra em outra aliança depois disso. Seus reforços em locais de aliados voltam para casa.' +
              (dados.alianca.meuCargo === 'lider' ? ' A liderança passa ao conselheiro mais antigo.' : '') + '</p>',
            acoes: [{ rotulo: 'Sair', classe: 'btn-perigo', acao: function () { acao(RP.post('/alianca/sair'), 'Você saiu da aliança', 'Trégua de ' + dados.treguaH + ' h.', RP.$('[data-tela=alianca]')); } }, { rotulo: 'Ficar' }]
          });
          return;
        }
        if (e.target.closest('[data-conversa-enviar]')) enviarConversa(el);
      });
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'texto-conversa') enviarConversa(el); });
    },
    entrar: function (el) { desenhar(el); }
  });
  function enviarConversa(el) {
    var inp = RP.$('#texto-conversa', el), t = inp ? inp.value.trim() : '';
    if (!t) return;
    RP.tentar(RP.post('/alianca/conversa', { texto: t })).then(function () { desenhar(el).then(function () { var i = RP.$('#texto-conversa', el); if (i) i.focus(); }); }).catch(function () { /* aviso já mostrado */ });
  }
  document.addEventListener('rp:social', function (e) {
    if (e.detail !== 'alianca') return;
    S.redesenhar('alianca', function (el) {
      var inp = RP.$('#texto-conversa', el), rascunho = inp ? inp.value : '';
      desenhar(el).then(function () { var i = RP.$('#texto-conversa', el); if (i && rascunho) i.value = rascunho; });
    });
  });

  /* ---------------------------------------------------------------- Pedir recursos a um aliado */
  var pr = { reino: null, rec: 'pedra', q: 300, local: null, recado: '' };
  function desenharPedido(el) {
    var d = dados, a = d && d.alianca;
    if (!a) { RP.$('.pd-conteudo', el).innerHTML = S.vazio('Você não está numa aliança.'); return; }
    var outros = a.membros.filter(function (x) { return !x.eu; });
    if (!outros.length) { RP.$('.pd-conteudo', el).innerHTML = S.vazio('Ainda não há outros membros na aliança.'); return; }
    var m = outros.filter(function (x) { return x.reino.id === pr.reino; })[0] || outros[0];
    pr.reino = m.reino.id;
    var locais = (RP.reino.locais || []).filter(function (l) { return !l.ruina; });
    if (!pr.local || !locais.some(function (l) { return l.id === pr.local; })) pr.local = RP.reino.casteloId;
    var carga = {}; carga[pr.rec] = pr.q;
    var v = S.valor(carga), excede = m.novatoRestante != null && v > m.novatoRestante;
    var nomeLocal = (locais.filter(function (l) { return l.id === pr.local; })[0] || {}).nome || '';
    RP.$('.pd-conteudo', el).innerHTML =
      '<div class="secao-titulo" style="margin-top:0">A quem</div><div class="escolhas escolhas-lista">' + outros.map(function (x) {
        return '<button type="button" class="escolha escolha-linha" data-pr-reino="' + x.reino.id + '" aria-pressed="' + (x.reino.id === pr.reino) + '">' + S.brasao(x.reino, 30) + '<span class="escolha-txt"><b>' + RP.esc(x.reino.nome) + '</b><small class="fraco">' + CARGOS[x.cargo] + tempoTxt(x.minutos) + '</small></span></button>';
      }).join('') + '</div>' +
      (m.escudo ? '<p class="nota-antiga">' + RP.icone('escudo', 'ico-p') + '<span>' + RP.esc(m.reino.nome) + ' está sob escudo de novato: ajudas, trocas e pagamentos somam até ' + RP.num(RP.config.novatoDia || 0) + ' de valor por dia (restam ' + RP.num(m.novatoRestante) + ' hoje).</span></p>' : '') +
      '<div class="secao-titulo">O quê</div>' + S.chipsRecurso('data-pr-rec', pr.rec) +
      '<div class="secao-titulo">Quanto</div><div class="card linha-entre"><span class="linha">' + RP.icone(pr.rec, 'r-' + pr.rec) + '<span><b>' + RP.esc(RP.NOMES_REC[pr.rec] || pr.rec) + '</b><br><small class="fraco">valor ' + RP.num(v) + '</small></span></span>' +
      '<span class="linha" style="gap:4px">' + S.stepper('q', pr.q, S.passo(pr.rec), S.passo(pr.rec)) + '<button type="button" class="btn btn-p" data-q="q:' + S.passo(pr.rec) * 10 + '">+' + RP.numCurto(S.passo(pr.rec) * 10) + '</button></span></div>' +
      '<div class="secao-titulo">Para onde</div><div class="obj-add-lista">' + locais.map(function (x) {
        return '<button type="button" class="btn btn-p chip-sel" data-pr-local="' + x.id + '" aria-pressed="' + (pr.local === x.id) + '">' + RP.icone(RP.iconeLocal(x), 'ico-p') + RP.esc(x.nome) + '</button>';
      }).join('') + '</div>' +
      S.campoRecado('recado-pedido', pr.recado, d.recadoMax) +
      '<div class="card pilha" style="margin-top:var(--esp-3)"><div class="linha-entre"><span class="fraco">Castelo deles até o seu</span><b class="num">' + (m.minutos != null ? '≈ ' + RP.fmtDuracao(m.minutos * 60) : '—') + '</b></div>' +
      '<p class="fraco" style="font-size:var(--fs-2)">Se aceitarem, a carga sai dos locais mais próximos deles, a pé. Fica visível no mapa e pode ser roubada no caminho.</p></div>' +
      (excede ? '<p class="nota-antiga nota-perigo">' + RP.icone('alerta', 'ico-p') + 'Passa do limite de hoje do reino sob escudo.</p>' : '') + '<div style="height:var(--esp-8)"></div>';
    RP.$('.rodape-resumo', el).innerHTML = '<div class="resumo-linha"><b>' + RP.num(pr.q) + ' de ' + RP.esc(RP.nomeRecurso(pr.rec)) + ' → ' + RP.esc(nomeLocal) + '</b></div><div class="resumo-linha fraco">pedido a ' + RP.esc(m.reino.nome) + '</div>';
    RP.$('[data-pr-enviar]', el).classList.toggle('btn-inativo', excede);
  }
  RP.registrarTela('pedido', {
    secao: 'mais',
    montar: function (el) {
      el.innerHTML = RP.topoVoltar('Pedir recursos', 'alianca', 'A um aliado') + '<div class="conteudo-tela pd-conteudo"></div>' +
        '<div class="rodape-acao rodape-com-resumo"><div class="rodape-resumo"></div><button type="button" class="btn btn-primario btn-bloco btn-grande" data-pr-enviar>' + RP.icone('carroca') + 'Pedir</button></div>';
      el.addEventListener('input', function (e) { if (e.target.id === 'recado-pedido') pr.recado = e.target.value; });
      el.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-pr-reino]'))) { pr.reino = +b.getAttribute('data-pr-reino'); desenharPedido(el); return; }
        if ((b = e.target.closest('[data-pr-rec]'))) { pr.rec = b.getAttribute('data-pr-rec'); pr.q = S.passo(pr.rec) * 3; desenharPedido(el); return; }
        if ((b = e.target.closest('[data-pr-local]'))) { pr.local = +b.getAttribute('data-pr-local'); desenharPedido(el); return; }
        if ((b = e.target.closest('[data-q]'))) { var d = +b.getAttribute('data-q').split(':')[1]; pr.q = Math.max(S.passo(pr.rec), Math.min(1e6, pr.q + d)); desenharPedido(el); return; }
        if (e.target.closest('[data-pr-enviar]')) {
          var carga = {}; carga[pr.rec] = pr.q;
          RP.tentar(RP.post('/alianca/pedidos', { aliadoId: pr.reino, recursos: carga, localId: pr.local, recado: (pr.recado || '').trim() })).then(function (p) {
            pr.recado = '';
            RP.aviso({ titulo: 'Pedido enviado', texto: S.nome(p.para) + ' recebe o pedido pelo sino.', icone: 'carroca', tipo: 'sucesso' });
            RP.ir('alianca');
          }).catch(function () { /* aviso já mostrado */ });
        }
      });
    },
    entrar: function (el, params) {
      if (params.get('reino')) pr.reino = +params.get('reino');
      RP.config = RP.config || {};
      var pronto = function () { desenharPedido(el); };
      Promise.all([carregar(), RP.config.valor ? null : RP.get('/comercio').then(function (c) { RP.config.valor = c.valor; RP.config.novatoDia = c.novatoDia; })]).then(pronto, pronto);
    }
  });
})();
