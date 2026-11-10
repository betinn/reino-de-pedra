/* Reino de Pedra — Aliança (#/alianca) e Pedir recursos (#/pedido?reino=<id>). Dados de GET /alianca.
   A conversa é o centro da janela: falas dos membros e, em linha de sistema, o que acontece na aliança (alguém entrou,
   um aliado sob ataque, um pedido de recursos...). O que dá para resolver numa linha se resolve nela: Enviar, Convidar,
   Aceitar, Ver no mapa. Menções com @Reino; @todos só para líder e conselheiros. Fala nova de outro membro vira aviso
   pequeno no centro da tela (categoria "Conversa da aliança" em Notificações), e o botão da barra mostra as não lidas.
   Criar e entrar com pouco atrito: fundar pede só o nome; aliança aberta entra com um clique; convite e pedido de
   entrada se respondem no próprio aviso; convidar, indicar, pedir entrada e mostrar um ponto se fazem pelo mapa. */
(function () {
  'use strict';
  var RP = window.RP, S = RP.social;
  var CARGOS = { lider: 'Líder', conselheiro: 'Conselheiro', membro: 'Membro' };
  var ICONE_EVENTO = {
    fundou: 'estandarte', entrou: 'mais', saiu: 'voltar', expulso: 'fechar', cargo: 'coroa', lider: 'coroa', modo: 'cadeado', recado: 'info',
    convite: 'estandarte', indicacao: 'estandarte', 'pedido-entrada': 'estandarte', ataque: 'alerta', vitoria: 'espada', derrota: 'espada',
    'pedido-recursos': 'carroca', ajuda: 'carroca', reforco: 'escudo', 'pedido-reforco': 'escudo', reliquia: 'lendario'
  };
  var JA_NOTIFICADO = { entrou: 1, saiu: 1, expulso: 1, lider: 1, 'pedido-entrada': 1 };
  /* marca: até onde estava lido quando a janela abriu. O que chegou depois fica marcado como novo enquanto ela estiver aberta. */
  var dados = null, rascunho = '', ponto = null, marca = null;

  function carregar() { return RP.get('/alianca').then(function (d) { dados = d; RP.sincronizar(d.agora); RP.aliancaDados = d; return d; }); }
  function tempoTxt(min) { return min == null ? '' : ' · castelo a ' + RP.fmtDuracao(min * 60); }
  function tela() { return RP.$('[data-tela=alianca]'); }
  /* a janela da aliança está aberta agora? (o que chega já está sendo lido) */
  function naTela() { return RP.telaAtual() === 'alianca' && RP.painel.aberto; }
  function ha(q) { return RP.fmtHa((RP.agora() - q) / 3600000); }

  /* ---------------------------------------------------------------- conversa */
  /* texto da fala com as menções em destaque: @Nome de um membro e @todos */
  function comMencoes(texto, membros) {
    var t = RP.esc(texto);
    (membros || []).map(function (x) { return S.nome(x.reino); }).concat(['todos']).sort(function (a, b) { return b.length - a.length; }).forEach(function (n) {
      var alvo = '@' + RP.esc(n), i = t.toLowerCase().indexOf(alvo.toLowerCase());
      if (i >= 0) t = t.slice(0, i) + '<b class="mencao">' + t.slice(i, i + alvo.length) + '</b>' + t.slice(i + alvo.length);
    });
    return t;
  }
  function botaoMapa(hex, rotulo) { return hex == null ? '' : '<button type="button" class="btn btn-p btn-fantasma" data-ver-mapa="' + hex + '">' + RP.icone('mapa') + (rotulo || 'Ver no mapa') + '</button>'; }
  function linhaHTML(c, a) {
    if (c.tipo === 'evento') {
      var ac = '';
      if (c.propostaId) ac += '<button type="button" class="btn btn-p btn-primario" data-proposta-aceitar="' + c.propostaId + '">' + RP.icone('carroca') + 'Enviar</button><button type="button" class="btn btn-p btn-fantasma" data-proposta-recusar="' + c.propostaId + '">Recusar</button>';
      if (c.convidar) ac += '<button type="button" class="btn btn-p btn-primario" data-convidar="' + c.convidar + '">' + RP.icone('estandarte') + 'Convidar</button>';
      if (c.aceitar) ac += '<button type="button" class="btn btn-p btn-primario" data-entrada-aceitar="' + c.aceitar + '">' + RP.icone('check') + 'Aceitar</button><button type="button" class="btn btn-p btn-fantasma" data-entrada-recusar="' + c.aceitar + '">Recusar</button>';
      if (c.reforcar) ac += '<button type="button" class="btn btn-p btn-primario" data-reforcar="' + c.hex + '">' + RP.icone('escudo') + 'Mandar reforço</button>';
      else ac += botaoMapa(c.hex);
      return '<li class="conv-evento conv-' + RP.esc(c.evento || '') + (c.id > marca ? ' conv-nova' : '') + '">' + RP.icone(ICONE_EVENTO[c.evento] || 'info', 'ico-p') +
        '<span><span class="conv-texto">' + RP.esc(c.texto) + '</span> <small class="fraco">' + ha(c.quando) + '</small>' + (ac ? '<span class="conv-acoes">' + ac + '</span>' : '') + '</span></li>';
    }
    return '<li class="conv-fala' + (c.minha ? ' minha' : '') + (c.mencionaVoce ? ' conv-mencao' : '') + (c.id > marca && !c.minha ? ' conv-nova' : '') + '">' + S.brasao(c.reino, 22) +
      '<span><b>' + RP.esc(S.nome(c.reino)) + '</b> <small class="fraco">' + ha(c.quando) + '</small><br><span class="conv-texto">' + comMencoes(c.texto, a.membros) + '</span>' +
      (c.hex != null ? '<span class="conv-acoes">' + botaoMapa(c.hex) + '</span>' : '') + '</span></li>';
  }
  function conversaHTML(a, d) {
    var lider = a.meuCargo === 'lider';
    var recado = a.recado ? '<div class="conv-recado">' + RP.icone('info', 'ico-p') + '<span><b>Recado do líder</b><br>' + RP.esc(a.recado.texto) + '</span>' + (lider ? '<button type="button" class="btn btn-p btn-fantasma" data-recado>Trocar</button>' : '') + '</div>'
      : (lider ? '<button type="button" class="btn btn-p btn-fantasma conv-recado-novo" data-recado>' + RP.icone('info') + 'Fixar um recado no topo</button>' : '');
    return '<div class="card pilha conversa">' + recado + '<ol class="conversa-lista" aria-live="polite">' +
      (a.conversa.length ? a.conversa.map(function (c) { return linhaHTML(c, a); }).join('') : '<li class="fraco">Ninguém escreveu ainda.</li>') + '</ol>' +
      (ponto != null ? '<div class="conv-ponto">' + RP.icone('mapa', 'ico-p') + '<span>Vai junto um ponto do mapa (' + RP.hex.c(ponto) + ', ' + RP.hex.l(ponto) + ').</span><button type="button" class="btn btn-p btn-fantasma btn-icone" data-tirar-ponto aria-label="Tirar o ponto">' + RP.icone('fechar') + '</button></div>' : '') +
      '<div class="conversa-envio"><label class="sr" for="texto-conversa">Mensagem para a aliança</label><input id="texto-conversa" type="text" maxlength="' + d.conversaMax + '" placeholder="Escreva para a aliança (@ menciona)" autocomplete="off" value="' + RP.esc(rascunho) + '">' +
      '<button type="button" class="btn btn-p btn-primario" data-conversa-enviar>' + RP.icone('seta') + 'Enviar</button></div>' +
      '<div class="conv-rapidos"><button type="button" class="btn btn-p btn-fantasma" data-mencionar>@ Mencionar</button>' +
      '<button type="button" class="btn btn-p btn-fantasma" data-pedir-reforco>' + RP.icone('escudo') + 'Preciso de reforço</button>' +
      '<a class="btn btn-p btn-fantasma" href="#/pedido">' + RP.icone('carroca') + 'Preciso de recursos</a></div></div>';
  }

  /* ---------------------------------------------------------------- pedidos de recursos (cards) */
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
    var est = p.estado === 'aberta' ? 'aguardando resposta' : p.estado === 'aceita' ? (indo ? 'a caminho, chega ' + RP.barraTempo(p.partida, p.chegada, { classe: 'curta', rotulo: 'Ajuda a caminho' }) : 'entregue') : p.estado === 'recusada' ? 'recusado' : p.estado;
    return '<div class="card linha">' + S.brasao(p.para, 28) + '<span style="flex:1;min-width:0"><b>' + RP.esc(S.cargaTxt(p.quer)) + '</b><br><small class="fraco">' + RP.esc(S.nome(p.para)) + (p.local ? ' · para ' + RP.esc(p.local) : '') + ' · ' + est + '</small></span>' +
      (p.estado === 'aberta' ? '<button type="button" class="btn btn-p btn-fantasma" data-proposta-cancelar="' + p.id + '">Cancelar</button>' : '') + '</div>';
  }

  /* ---------------------------------------------------------------- sem aliança: convites, entrar, fundar */
  function semAlianca(d) {
    var h = '<div class="nota-regra">' + RP.icone('estandarte', 'ico-p') + '<span>Aliados <b>conversam</b>, <b>pedem recursos</b> e reforçam os locais uns dos outros. Locais de aliados não são alvo. No máximo <b>' + d.limite + ' reinos</b> por aliança.</span></div>';
    if (d.livreEm) h += '<p class="nota-antiga">' + RP.icone('relogio', 'ico-p') + 'Você saiu de uma aliança: só entra em outra em <b class="num" data-fim="' + d.livreEm + '">' + RP.fmtResta(d.livreEm - RP.agora()) + '</b>.</p>';
    if (d.convitesRecebidos.length) h += '<div class="secao-titulo">Convites</div><div class="pilha">' + d.convitesRecebidos.map(function (c) {
      return '<div class="card pilha"><div class="linha">' + RP.brasao(c.alianca.brasao, { tamanho: 40 }) + '<span style="flex:1;min-width:0"><b>' + RP.esc(c.alianca.nome) + '</b><br><small class="fraco">' + c.alianca.membros + ' de ' + d.limite + ' reinos · convite de ' + RP.esc(S.nome(c.por)) + ' · até ' + RP.fmtHora(c.ate) + '</small></span></div>' +
        '<div class="linha relq-acoes"><button type="button" class="btn btn-p btn-primario" data-convite-aceitar="' + c.alianca.id + '">' + RP.icone('check') + 'Entrar</button><button type="button" class="btn btn-p btn-fantasma" data-convite-recusar="' + c.alianca.id + '">Recusar</button></div></div>';
    }).join('') + '</div>';
    /* fundar: só o nome; o resto se acerta depois */
    h += '<div class="secao-titulo">Fundar uma aliança</div><div class="card pilha"><div class="conversa-envio"><label class="sr" for="nome-alianca">Nome da aliança</label>' +
      '<input id="nome-alianca" type="text" minlength="' + d.nome.min + '" maxlength="' + d.nome.max + '" placeholder="Nome da aliança (ex.: Liga do Vale)" autocomplete="off">' +
      '<button type="button" class="btn btn-p btn-primario" data-fundar-alianca>' + RP.icone('estandarte') + 'Fundar</button></div>' +
      '<label class="linha" style="gap:var(--esp-2)"><input type="checkbox" id="alianca-aberta"><span>Aberta: quem pedir, entra na hora <small class="fraco">(dá para mudar depois)</small></span></label>' +
      '<span class="campo-ajuda">Você será o líder. O brasão é sorteado.</span></div>';
    if (d.aliancas.length) h += '<div class="secao-titulo">Alianças do mundo · as mais perto primeiro</div><div class="pilha">' + d.aliancas.slice().sort(function (x, y) { return (x.minutos == null ? 1e9 : x.minutos) - (y.minutos == null ? 1e9 : y.minutos); }).map(function (a) {
      return '<div class="card linha">' + RP.brasao(a.brasao, { tamanho: 32 }) + '<span style="flex:1;min-width:0"><b>' + RP.esc(a.nome) + '</b> ' + (a.aberta ? '<span class="selo selo-info">Aberta</span>' : '<span class="selo">Por convite</span>') +
        '<br><small class="fraco">' + a.membros + ' de ' + d.limite + ' · ' + RP.esc(a.nomes.join(', ')) + (a.minutos != null ? ' · a ' + RP.fmtDuracao(a.minutos * 60) : '') + '</small></span>' +
        (a.pedido ? '<span class="selo selo-info">' + RP.icone('relogio') + 'Pedido enviado</span>' : a.cheia ? '<span class="selo">Completa</span>' :
          '<button type="button" class="btn btn-p' + (a.aberta ? ' btn-primario' : '') + '" data-pedir-entrada="' + a.id + '" data-aberta="' + (a.aberta ? 1 : 0) + '">' + (a.aberta ? RP.icone('check') + 'Entrar' : 'Pedir para entrar') + '</button>') + '</div>';
    }).join('') + '</div>';
    return h + '<div style="height:var(--esp-8)"></div>';
  }

  /* ---------------------------------------------------------------- com aliança */
  function comAlianca(d) {
    var a = d.alianca, lider = a.meuCargo === 'lider', gerencia = a.meuCargo !== 'membro';
    var nCons = a.membros.filter(function (x) { return x.cargo === 'conselheiro'; }).length;
    var paraMim = d.pedidosRecursos.filter(function (p) { return !p.minha && p.estado === 'aberta'; }), meus = d.pedidosRecursos.filter(function (p) { return p.minha; });
    var h = '<div class="card card-moldura linha al-topo">' + RP.brasao(a.brasao, { tamanho: 48 }) + '<span style="flex:1;min-width:0"><h2>' + RP.esc(a.nome) + '</h2><small class="fraco">' + a.membros.length + ' de ' + d.limite + ' reinos · você é ' + CARGOS[a.meuCargo].toLowerCase() + '</small></span>' +
      (lider ? '<button type="button" class="btn btn-p btn-fantasma" data-alianca-modo="' + (a.aberta ? 0 : 1) + '" data-dica="' + (a.aberta ? 'Quem pedir, entra na hora. Clique para passar a ser por convite.' : 'Pedidos de entrada esperam você ou um conselheiro. Clique para abrir a aliança.') + '">' + RP.icone('cadeado') + (a.aberta ? 'Aberta' : 'Por convite') + '</button>'
        : '<span class="selo' + (a.aberta ? ' selo-info' : '') + '">' + (a.aberta ? 'Aberta' : 'Por convite') + '</span>') + '</div>';
    h += conversaHTML(a, d);
    if (paraMim.length) h += '<div class="secao-titulo">Pedidos para você</div><div class="pilha">' + paraMim.map(pedidoCard).join('') + '</div>';
    if (gerencia && a.pedidos && a.pedidos.length) h += '<div class="secao-titulo">Pedidos de entrada</div><div class="pilha">' + a.pedidos.map(function (p) {
      return '<div class="card linha">' + S.brasao(p.reino, 30) + '<span style="flex:1;min-width:0"><b>' + RP.esc(S.nome(p.reino)) + '</b><br><small class="fraco">quer entrar · até ' + RP.fmtHora(p.ate) + '</small></span>' +
        '<button type="button" class="btn btn-p btn-primario" data-entrada-aceitar="' + p.reino.id + '">' + RP.icone('check') + 'Aceitar</button><button type="button" class="btn btn-p btn-fantasma btn-icone" data-entrada-recusar="' + p.reino.id + '" aria-label="Recusar">' + RP.icone('fechar') + '</button></div>';
    }).join('') + '</div>';
    h += '<div class="secao-titulo">Membros</div><div class="card lista">' + a.membros.map(function (x) {
      var nome = RP.esc(S.nome(x.reino)) + (x.eu ? ' (você)' : '');
      var podeMexer = !x.eu && (lider || (a.meuCargo === 'conselheiro' && x.cargo === 'membro'));
      return '<div class="lista-item">' + S.brasao(x.reino, 32) + '<span style="flex:1;min-width:0"><b>' + (x.cargo === 'lider' ? RP.icone('coroa', 'ico-p cor-destaque') + ' ' : '') + nome + '</b><br><small class="fraco">' + CARGOS[x.cargo] + tempoTxt(x.minutos) + (x.escudo ? ' · sob escudo de novato' : '') + '</small></span>' +
        (x.eu ? '' : (podeMexer ? '<button type="button" class="btn btn-p btn-fantasma btn-icone" data-cargo="' + x.reino.id + '" aria-label="Cargo de ' + RP.esc(S.nome(x.reino)) + '">' + RP.icone('coroa') + '</button>' : '') +
          (x.castelo != null ? '<button type="button" class="btn btn-p btn-fantasma btn-icone" data-ver-mapa="' + x.castelo + '" aria-label="Ver o castelo no mapa">' + RP.icone('mapa') + '</button>' : '') +
          '<a class="btn btn-p" href="#/pedido?reino=' + x.reino.id + '">' + RP.icone('carroca') + 'Pedir</a>') + '</div>';
    }).join('') + '</div>' +
      '<p class="fraco" style="font-size:var(--fs-2);margin-top:var(--esp-2)">O líder convida, expulsa, promove e pode passar a liderança. Até ' + d.conselheirosMax + ' conselheiros (agora ' + nCons + ') convidam, aceitam pedidos de entrada e expulsam membros. Se o líder entrar em regência, a liderança passa ao conselheiro mais antigo.</p>';
    if (a.membros.length < d.limite) {
      var cands = d.reinos.filter(function (c) { return !c.naAlianca && !(a.convites || []).some(function (v) { return v.reino && v.reino.id === c.reino.id; }); }).slice(0, 8);
      h += '<div class="secao-titulo">' + (gerencia ? 'Convidar' : 'Indicar') + ' · ' + (d.limite - a.membros.length) + ' vagas · os vizinhos primeiro</div>' + (cands.length ? '<div class="escolhas escolhas-lista">' + cands.map(function (c) {
        return '<button type="button" class="escolha escolha-linha" ' + (gerencia ? 'data-convidar' : 'data-indicar') + '="' + c.reino.id + '">' + S.brasao(c.reino, 30) + '<span class="escolha-txt"><b>' + RP.esc(c.reino.nome) + '</b><small class="fraco">' + (c.minutos != null ? 'castelo a ' + RP.fmtDuracao(c.minutos * 60) + ' · ' : '') + (gerencia ? 'clique para convidar' : 'clique para indicar ao líder') + '</small></span>' + RP.icone('mais', 'ico-p') + '</button>';
      }).join('') + '</div>' : S.vazio('Nenhum reino sem aliança para convidar agora.'));
      if (gerencia && (a.convites || []).length) h += '<div class="pilha" style="margin-top:var(--esp-2)">' + a.convites.map(function (v) {
        return '<div class="card linha">' + S.brasao(v.reino, 24) + '<span style="flex:1"><b>' + RP.esc(S.nome(v.reino)) + '</b><br><small class="fraco">convidado por ' + RP.esc(v.por || '') + ' · vale até ' + RP.fmtHora(v.ate) + '</small></span><span class="selo selo-info">' + RP.icone('relogio') + 'Convite</span></div>';
      }).join('') + '</div>';
    }
    if (a.treguas.length) h += '<div class="secao-titulo">Em trégua</div><div class="pilha">' + a.treguas.map(function (t) {
      return '<div class="card linha">' + S.brasao(t.reino, 28) + '<span style="flex:1;min-width:0"><b>' + RP.esc(S.nome(t.reino)) + '</b><br><small class="fraco">' + (t.como === 'expulso' ? 'Foi expulso' : 'Saiu da aliança') + ' · nenhum lado ataca até o fim da trégua</small></span><span class="selo selo-info">' + RP.icone('pacto') + '<span data-fim="' + t.ate + '">' + RP.fmtResta(t.ate - RP.agora()) + '</span></span></div>';
    }).join('') + '</div>';
    if (d.reforcos.recebidos.length || d.reforcos.meus.length) h += '<div class="secao-titulo">Reforços</div><div class="pilha">' +
      d.reforcos.recebidos.map(function (e) { return '<div class="card linha">' + S.brasao(e.reino, 28) + '<span style="flex:1;min-width:0"><b>' + RP.esc(S.nome(e.reino)) + ' defende ' + RP.esc(e.local) + '</b><br><small class="fraco">' + RP.esc(RP.partesGrupo(e.tropas)) + ' · continuam sendo dele</small></span></div>'; }).join('') +
      d.reforcos.meus.map(function (e) { return '<div class="card linha">' + S.brasao(e.aliado, 28) + '<span style="flex:1;min-width:0"><b>Suas tropas em ' + RP.esc(e.local) + '</b><br><small class="fraco">' + RP.esc(RP.partesGrupo(e.tropas)) + '</small></span><button type="button" class="btn btn-p" data-reforco-volta="' + e.localId + '">' + RP.icone('voltar') + 'Voltar</button></div>'; }).join('') + '</div>';
    if (meus.length) h += '<div class="secao-titulo">Seus pedidos</div><div class="pilha">' + meus.map(meuPedido).join('') + '</div>';
    h += '<div class="secao-titulo">Sair</div><div class="card pilha"><p class="fraco" style="font-size:var(--fs-2)">Ao sair ou ser expulso, vale uma <b>trégua de ' + d.treguaH + ' h</b> entre o reino e a aliança, e só se entra em outra depois de ' + d.treguaH + ' h.</p>' +
      '<button type="button" class="btn btn-p btn-fantasma" data-sair-alianca>' + RP.icone('voltar') + 'Sair da aliança</button></div><div style="height:var(--esp-8)"></div>';
    return h;
  }

  function desenhar(el) {
    var inp0 = RP.$('#texto-conversa', el); if (inp0) rascunho = inp0.value;
    return carregar().then(function (d) {
      /* quem está escrevendo continua escrevendo: a fala que chega redesenha a lista, não tira o foco nem o cursor */
      var inp1 = RP.$('#texto-conversa', el), foco = inp1 && document.activeElement === inp1 ? [inp1.selectionStart, inp1.selectionEnd] : null;
      if (inp1) rascunho = inp1.value;
      if (marca == null && d.alianca) marca = d.alianca.lidaAte;
      RP.$('.al-conteudo', el).innerHTML = d.alianca ? comAlianca(d) : semAlianca(d);
      var inp2 = RP.$('#texto-conversa', el);
      if (foco && inp2) { inp2.focus(); try { inp2.setSelectionRange(foco[0], foco[1]); } catch (e) { /* ignora */ } }
      var sub = RP.$('.topo-titulos small', el); if (sub) sub.textContent = d.alianca ? d.alianca.nome : 'Sem aliança';
      var lista = RP.$('.conversa-lista', el); if (lista) lista.scrollTop = lista.scrollHeight;
      /* abriu a conversa: tudo lido */
      if (d.alianca && d.alianca.naoLidas) RP.post('/alianca/conversa/lida').catch(function () { /* fica para a próxima */ });
      contador(0);
    }).catch(function (e) { RP.$('.al-conteudo', el).innerHTML = S.vazio(RP.esc(e.message)); });
  }
  function acao(p, titulo, texto, el) {
    return RP.tentar(p).then(function () {
      if (titulo) RP.aviso({ titulo: titulo, texto: texto, icone: 'estandarte', tipo: 'sucesso' });
      RP.recarregarReino(); if (RP.mapaModelo) RP.mapaModelo.velho = true;
      var t = el || tela();
      return t && !t.hidden ? desenhar(t) : carregar();
    }).catch(function () { /* aviso já mostrado */ });
  }
  function verNoMapa(hex) { RP.ir('mapa?centro=' + hex); }

  /* ---------------------------------------------------------------- contador de não lidas (botão da barra) e aviso de fala nova */
  function contador(n) {
    RP.naoLidasAlianca = n;
    RP.$$('[data-nav-contador-alianca]').forEach(function (c) { c.textContent = n; c.hidden = !n; });
  }
  document.addEventListener('rp:reino', function () {
    var s = RP.reino && RP.reino.social, a = s && s.alianca;
    /* com a janela aberta, o que chega já está sendo lido */
    var aberta = naTela();
    contador(aberta ? 0 : (a ? a.naoLidas || 0 : (s && s.convites) || 0));
  });
  RP.ouvir('alianca', function (d) {
    if (!d || d.fala == null) return;
    if (naTela()) return;
    if (d.naoLidas != null) contador(d.naoLidas);
    /* fala de outro membro (ou evento da aliança): aviso pequeno, se a categoria "Conversa da aliança" está ligada.
       Os eventos que já chegam como notificação a todos os membros (entrou, saiu, liderança...) não se repetem aqui. */
    if (d.tocar && !document.hidden && !JA_NOTIFICADO[d.evento]) RP.aviso({ titulo: d.tipo === 'evento' ? 'Aliança' : (d.de || 'Aliança'), texto: d.texto || '', icone: d.tipo === 'evento' ? (ICONE_EVENTO[d.evento] || 'estandarte') : 'conversa', tipo: d.evento === 'ataque' ? 'alerta' : 'info', link: 'alianca', anuncio: true, pequeno: true, prioridade: 2, descartavel: true });
  });

  /* ---------------------------------------------------------------- tela */
  RP.registrarTela('alianca', {
    secao: 'alianca',
    montar: function (el) {
      /* janela da barra do topo (tecla J): sem seta de voltar */
      el.innerHTML = '<header class="topo"><div class="topo-titulos"><h1>Aliança</h1><small> </small></div></header><div class="conteudo-tela al-conteudo"></div>';
      el.addEventListener('input', function (e) { if (e.target.id === 'texto-conversa') rascunho = e.target.value; });
      el.addEventListener('click', function (e) {
        var b;
        if (e.target.closest('[data-fundar-alianca]')) {
          var ab = RP.$('#alianca-aberta', el);
          acao(RP.post('/alianca', { nome: (RP.$('#nome-alianca', el).value || '').trim(), aberta: !!(ab && ab.checked) }), 'Aliança fundada', 'Convide os vizinhos: eles estão logo abaixo.', el); return;
        }
        if ((b = e.target.closest('[data-convite-aceitar]'))) { acao(RP.post('/aliancas/' + b.getAttribute('data-convite-aceitar') + '/convite/aceitar'), null, null, el); return; }   /* o servidor já avisa "Você entrou na aliança" */
        if ((b = e.target.closest('[data-convite-recusar]'))) { acao(RP.post('/aliancas/' + b.getAttribute('data-convite-recusar') + '/convite/recusar'), 'Convite recusado', null, el); return; }
        if ((b = e.target.closest('[data-pedir-entrada]'))) {
          var aberta = b.getAttribute('data-aberta') === '1';
          acao(RP.post('/aliancas/' + b.getAttribute('data-pedir-entrada') + '/entrar'), aberta ? null : 'Pedido enviado', aberta ? null : 'O líder e os conselheiros respondem.', el); return;
        }
        if ((b = e.target.closest('[data-entrada-aceitar]'))) { acao(RP.post('/alianca/pedidos-entrada/' + b.getAttribute('data-entrada-aceitar') + '/aceitar'), null, null, el); return; }   /* o servidor avisa os membros: "X entrou na aliança" */
        if ((b = e.target.closest('[data-entrada-recusar]'))) { acao(RP.post('/alianca/pedidos-entrada/' + b.getAttribute('data-entrada-recusar') + '/recusar'), 'Pedido recusado', null, el); return; }
        if ((b = e.target.closest('[data-convidar]'))) { acao(RP.post('/alianca/convidar', { reinoId: +b.getAttribute('data-convidar') }), 'Convite enviado', 'O reino responde no próprio aviso.', el); return; }
        if ((b = e.target.closest('[data-indicar]'))) { acao(RP.post('/alianca/indicar', { reinoId: +b.getAttribute('data-indicar') }), 'Reino indicado', 'O líder e os conselheiros veem na conversa.', el); return; }
        if ((b = e.target.closest('[data-proposta-aceitar]'))) { acao(RP.post('/propostas/' + b.getAttribute('data-proposta-aceitar') + '/aceitar'), 'Ajuda a caminho', 'Pode ser roubada no caminho.', el); return; }
        if ((b = e.target.closest('[data-proposta-recusar]'))) { acao(RP.post('/propostas/' + b.getAttribute('data-proposta-recusar') + '/recusar'), 'Pedido recusado', 'O aliado é avisado.', el); return; }
        if ((b = e.target.closest('[data-proposta-cancelar]'))) { acao(RP.post('/propostas/' + b.getAttribute('data-proposta-cancelar') + '/cancelar'), 'Pedido cancelado', null, el); return; }
        if ((b = e.target.closest('[data-reforco-volta]'))) { acao(RP.post('/alianca/reforcos/' + b.getAttribute('data-reforco-volta') + '/retornar'), 'Tropas voltando', null, el); return; }
        if ((b = e.target.closest('[data-alianca-modo]'))) { acao(RP.post('/alianca/modo', { aberta: b.getAttribute('data-alianca-modo') === '1' }), b.getAttribute('data-alianca-modo') === '1' ? 'Aliança aberta' : 'Aliança por convite', null, el); return; }
        if ((b = e.target.closest('[data-ver-mapa]'))) { verNoMapa(b.getAttribute('data-ver-mapa')); return; }
        if ((b = e.target.closest('[data-reforcar]'))) {
          /* leva ao local no mapa e abre o envio de tropas para lá (o mesmo "Enviar tropas para cá") */
          var hx = +b.getAttribute('data-reforcar');
          verNoMapa(hx);
          if (RP.envio && RP.envio.paraCa) setTimeout(function () { try { RP.envio.paraCa(hx); } catch (er) { console.error(er); } }, 350);
          return;
        }
        if (e.target.closest('[data-tirar-ponto]')) { ponto = null; desenhar(el); return; }
        if (e.target.closest('[data-recado]')) {
          var atual = dados.alianca.recado ? dados.alianca.recado.texto : '';
          RP.modal({
            titulo: 'Recado fixado',
            corpo: '<p class="suave">Fica no topo da conversa, para todos. Até ' + (dados.recadoFixadoMax || 120) + ' caracteres; vazio tira o recado.</p><div class="campo"><label class="sr" for="recado-fixado">Recado</label><input id="recado-fixado" type="text" maxlength="' + (dados.recadoFixadoMax || 120) + '" value="' + RP.esc(atual) + '" autocomplete="off"></div>',
            acoes: [{ rotulo: 'Fixar', classe: 'btn-primario', acao: function () { var i = RP.$('#recado-fixado'); acao(RP.post('/alianca/recado', { texto: i ? i.value.trim() : '' }), 'Recado fixado', null, tela()); } }, { rotulo: 'Voltar' }]
          });
          return;
        }
        if (e.target.closest('[data-mencionar]')) {
          var r0 = e.target.closest('[data-mencionar]').getBoundingClientRect(), outros = dados.alianca.membros.filter(function (x) { return !x.eu; });
          var itens = outros.map(function (x) { return { rotulo: '@' + S.nome(x.reino), acao: function () { mencionar(el, S.nome(x.reino)); } }; });
          if (dados.alianca.meuCargo !== 'membro') itens.push({ sep: true }, { rotulo: '@todos', icone: 'estandarte', acao: function () { mencionar(el, 'todos'); } });
          if (itens.length) RP.menuContexto({ x: r0.left, y: r0.top - 8, titulo: 'Mencionar', itens: itens }); else RP.aviso({ titulo: 'Ainda não há outros membros', icone: 'info' });
          return;
        }
        if (e.target.closest('[data-pedir-reforco]')) {
          var r1 = e.target.closest('[data-pedir-reforco]').getBoundingClientRect();
          RP.menuContexto({ x: r1.left, y: r1.top - 8, titulo: 'Preciso de reforço em', itens: (RP.reino.locais || []).filter(function (l) { return !l.ruina; }).map(function (l) {
            return { rotulo: l.nome, icone: RP.iconeLocal(l), acao: function () { acao(RP.post('/alianca/reforco', { localId: l.id }), 'Pedido de reforço na conversa', l.nome, tela()); } };
          }) });
          return;
        }
        if ((b = e.target.closest('[data-cargo]'))) {
          var id = +b.getAttribute('data-cargo');
          var m = dados.alianca.membros.filter(function (x) { return x.reino.id === id; })[0], souLider = dados.alianca.meuCargo === 'lider', cons = m.cargo === 'conselheiro';
          var acoes = [];
          if (souLider) {
            acoes.push(cons ? { rotulo: 'Rebaixar a membro', acao: function () { acao(RP.post('/alianca/membros/' + id + '/rebaixar'), 'Cargo mudado', null, tela()); } }
              : { rotulo: RP.icone('coroa') + 'Promover a conselheiro', classe: 'btn-primario', acao: function () { acao(RP.post('/alianca/membros/' + id + '/promover'), 'Novo conselheiro', null, tela()); } });
            acoes.push({ rotulo: 'Passar a liderança', acao: function () { acao(RP.post('/alianca/membros/' + id + '/lider'), 'Liderança passada', S.nome(m.reino) + ' agora lidera. Você virou conselheiro.', tela()); } });
          }
          acoes.push({ rotulo: 'Expulsar', classe: 'btn-perigo', acao: function () { acao(RP.post('/alianca/membros/' + id + '/expulsar'), 'Reino expulso', 'Trégua de ' + dados.treguaH + ' h entre ele e a aliança.', tela()); } }, { rotulo: 'Voltar' });
          RP.modal({
            titulo: RP.esc(S.nome(m.reino)),
            corpo: '<p class="suave">Cargo atual: <b>' + CARGOS[m.cargo] + '</b>. Conselheiros convidam, aceitam pedidos de entrada e expulsam membros (até ' + dados.conselheirosMax + '). Quem é expulso fica em trégua de ' + dados.treguaH + ' h com a aliança.</p>',
            acoes: acoes
          });
          return;
        }
        if (e.target.closest('[data-sair-alianca]')) {
          RP.modal({
            titulo: 'Sair da ' + RP.esc(dados.alianca.nome) + '?',
            corpo: '<p class="suave">Por ' + dados.treguaH + ' h, nenhum lado pode atacar o outro, e você só entra em outra aliança depois disso. Seus reforços em locais de aliados voltam para casa.' +
              (dados.alianca.meuCargo === 'lider' ? ' A liderança passa ao conselheiro mais antigo.' : '') + '</p>',
            acoes: [{ rotulo: 'Sair', classe: 'btn-perigo', acao: function () { acao(RP.post('/alianca/sair'), 'Você saiu da aliança', 'Trégua de ' + dados.treguaH + ' h.', tela()); } }, { rotulo: 'Ficar' }]
          });
          return;
        }
        if (e.target.closest('[data-conversa-enviar]')) enviarConversa(el);
      });
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'texto-conversa') enviarConversa(el); });
    },
    entrar: function (el, params) {
      /* #/alianca?ponto=<hex>: "Mostrar à aliança" pelo mapa: o ponto vai junto com a próxima fala */
      if (params && params.get('ponto') != null && params.get('ponto') !== '') ponto = +params.get('ponto');
      marca = null;
      desenhar(el).then(function () { var i = RP.$('#texto-conversa', el); if (i && ponto != null) i.focus(); });
    }
  });
  function mencionar(el, nome) {
    var i = RP.$('#texto-conversa', el); if (!i) return;
    i.value = (i.value ? i.value.replace(/\s*$/, ' ') : '') + '@' + nome + ' '; rascunho = i.value; i.focus();
  }
  function enviarConversa(el) {
    var inp = RP.$('#texto-conversa', el), t = inp ? inp.value.trim() : '';
    if (!t && ponto == null) return;
    var corpo = { texto: t }; if (ponto != null) corpo.hex = ponto;
    RP.tentar(RP.post('/alianca/conversa', corpo)).then(function () {
      rascunho = ''; ponto = null; if (inp) inp.value = '';
      desenhar(el).then(function () { var i = RP.$('#texto-conversa', el); if (i) i.focus(); });
    }).catch(function () { /* aviso já mostrado */ });
  }
  document.addEventListener('rp:social', function (e) {
    if (e.detail !== 'alianca') return;
    S.redesenhar('alianca', function (el) { desenhar(el); });
  });

  /* ---------------------------------------------------------------- pelo mapa: convidar, indicar, pedir entrada, mostrar à aliança */
  function dadosCache() { if (!RP.aliancaDados && RP.reino) carregar().catch(function () { /* offline */ }); return RP.aliancaDados; }
  document.addEventListener('rp:social', function (e) { if (e.detail === 'alianca') RP.aliancaDados = null; });
  RP.mapa.acoesFolhaHex.push(function (h, dadosMapa) {
    if (RP.envio && RP.envio.ativo && RP.envio.ativo()) return '';
    var d = dadosCache(), soc = RP.reino && RP.reino.social, minha = soc && soc.alianca, html = '';
    var l = ((dadosMapa && dadosMapa.porHex && dadosMapa.porHex[h]) || []).filter(function (o) { return o.tipo === 'local' && o.dono === 'outro' && o.reinoId && !o.ruina; })[0];
    if (l && d) {
      var delas = d.aliancas.filter(function (a) { return (a.ids || []).indexOf(l.reinoId) >= 0; })[0];
      if (minha && !delas && d.alianca && d.alianca.membros.length < d.limite && !(d.alianca.convites || []).some(function (v) { return v.reino && v.reino.id === l.reinoId; }))
        html += '<button type="button" class="btn btn-p" ' + (minha.cargo !== 'membro' ? 'data-al-convidar' : 'data-al-indicar') + '="' + l.reinoId + '">' + RP.icone('estandarte') + (minha.cargo !== 'membro' ? 'Convidar para a aliança' : 'Indicar para a aliança') + '</button>';
      if (!minha && delas && !delas.cheia && !delas.pedido && !d.livreEm)
        html += '<button type="button" class="btn btn-p" data-al-entrar="' + delas.id + '" data-aberta="' + (delas.aberta ? 1 : 0) + '">' + RP.icone('estandarte') + (delas.aberta ? 'Entrar na ' : 'Pedir para entrar na ') + RP.esc(delas.nome) + '</button>';
    }
    if (minha) html += '<button type="button" class="btn btn-p btn-fantasma" data-al-mostrar="' + h + '">' + RP.icone('conversa') + 'Mostrar à aliança</button>';
    return html;
  });
  document.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-al-convidar]'))) { RP.fecharMenu && RP.fecharMenu(); acao(RP.post('/alianca/convidar', { reinoId: +b.getAttribute('data-al-convidar') }), 'Convite enviado', 'O reino responde no próprio aviso.'); return; }
    if ((b = e.target.closest('[data-al-indicar]'))) { RP.fecharMenu && RP.fecharMenu(); acao(RP.post('/alianca/indicar', { reinoId: +b.getAttribute('data-al-indicar') }), 'Reino indicado', 'O líder e os conselheiros veem na conversa.'); return; }
    if ((b = e.target.closest('[data-al-entrar]'))) {
      var aberta = b.getAttribute('data-aberta') === '1';
      RP.fecharMenu && RP.fecharMenu();
      acao(RP.post('/aliancas/' + b.getAttribute('data-al-entrar') + '/entrar'), aberta ? null : 'Pedido enviado', aberta ? null : 'O líder e os conselheiros respondem.'); return;
    }
    if ((b = e.target.closest('[data-al-mostrar]'))) { RP.fecharMenu && RP.fecharMenu(); RP.ir('alianca?ponto=' + b.getAttribute('data-al-mostrar')); return; }
    /* convite e pedido de entrada respondidos no próprio aviso */
    if ((b = e.target.closest('[data-aviso-alianca]'))) {
      var p = b.getAttribute('data-aviso-alianca').split(':'), rota = p[0] === 'convite' ? '/aliancas/' + p[1] + '/convite/' + p[2] : '/alianca/pedidos-entrada/' + p[1] + '/' + p[2];
      acao(RP.post(rota), p[2] === 'aceitar' ? null : 'Recusado', null);   /* quem aceita recebe o aviso do servidor */
    }
  });
  /* o que a notificação deixa responder sem abrir tela: vira botões no aviso (RP.aviso({ acoes })) */
  RP.acoesDeAviso = RP.acoesDeAviso || {};
  RP.acoesDeAviso['convite-alianca'] = function (a) { return [{ rotulo: 'Entrar', classe: 'btn-primario', attr: 'data-aviso-alianca="convite:' + a.id + ':aceitar"' }, { rotulo: 'Recusar', attr: 'data-aviso-alianca="convite:' + a.id + ':recusar"' }]; };
  RP.acoesDeAviso['pedido-entrada'] = function (a) { return [{ rotulo: 'Aceitar', classe: 'btn-primario', attr: 'data-aviso-alianca="pedido:' + a.id + ':aceitar"' }, { rotulo: 'Recusar', attr: 'data-aviso-alianca="pedido:' + a.id + ':recusar"' }]; };

  /* ---------------------------------------------------------------- Pedir recursos a um aliado */
  var pr = { reino: null, rec: 'pedra', q: 30, local: null, recado: '' };
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
      '<p class="fraco" style="font-size:var(--fs-2)">O pedido aparece na conversa da aliança. Se aceitarem, a carga sai dos locais mais próximos deles, a pé. Fica visível no mapa e pode ser roubada no caminho.</p></div>' +
      (excede ? '<p class="nota-antiga nota-perigo">' + RP.icone('alerta', 'ico-p') + 'Passa do limite de hoje do reino sob escudo.</p>' : '') + '<div style="height:var(--esp-8)"></div>';
    RP.$('.rodape-resumo', el).innerHTML = '<div class="resumo-linha"><b>' + RP.num(pr.q) + ' de ' + RP.esc(RP.nomeRecurso(pr.rec)) + ' → ' + RP.esc(nomeLocal) + '</b></div><div class="resumo-linha fraco">pedido a ' + RP.esc(m.reino.nome) + '</div>';
    RP.$('[data-pr-enviar]', el).classList.toggle('btn-inativo', excede);
  }
  RP.registrarTela('pedido', {
    secao: 'alianca',
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
            RP.aviso({ titulo: 'Pedido enviado', texto: S.nome(p.para) + ' vê na conversa e no sino.', icone: 'carroca', tipo: 'sucesso' });
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
