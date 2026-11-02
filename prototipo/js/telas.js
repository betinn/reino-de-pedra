/* Reino de Pedra — telas: entrada, criação do reino, meu reino e telas-guia dos próximos blocos. */
(function () {
  'use strict';
  var RP = window.RP, D = RP.dados, H = RP.hex;

  /* ================================================================ cena da entrada (SVG próprio) */
  function cenaEntrada() {
    var estrelas = '';
    for (var i = 0; i < 28; i++) {
      estrelas += '<circle cx="' + (H.hash(i, 1, 1) * 390).toFixed(0) + '" cy="' + (H.hash(i, 2, 1) * 190).toFixed(0) + '" r="' + (0.6 + H.hash(i, 3, 1) * 1.1).toFixed(1) + '"/>';
    }
    var brasas = '';
    for (i = 0; i < 14; i++) {
      brasas += '<circle cx="' + (150 + H.hash(i, 4, 2) * 100).toFixed(0) + '" cy="' + (150 + H.hash(i, 5, 2) * 120).toFixed(0) + '" r="' + (0.8 + H.hash(i, 6, 2) * 1.4).toFixed(1) + '"/>';
    }
    return '<svg class="cena" viewBox="0 0 390 420" preserveAspectRatio="xMidYMax slice" aria-hidden="true">' +
      '<defs><linearGradient id="cena-ceu" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" class="ceu-1"/><stop offset=".62" class="ceu-2"/><stop offset="1" class="ceu-3"/></linearGradient>' +
      '<radialGradient id="cena-brilho"><stop offset="0" class="brilho-1"/><stop offset="1" class="brilho-2"/></radialGradient></defs>' +
      '<rect width="390" height="420" fill="url(#cena-ceu)"/>' +
      '<g class="cena-estrelas">' + estrelas + '</g>' +
      '<circle cx="200" cy="268" r="150" fill="url(#cena-brilho)"/>' +
      '<path class="cena-monte-3" d="M0 300 40 250 70 270 110 215 150 255 190 228 230 262 275 205 320 250 350 232 390 262V420H0Z"/>' +
      '<path class="cena-neve" d="M110 215 101 226 108 224 113 230 118 225 123 228ZM275 205 265 217 272 215 277 221 282 214 288 219Z"/>' +
      '<path class="cena-monte-2" d="M0 334 45 292 80 312 120 288 152 304V420H0ZM238 304 280 272 320 298 355 278 390 300V420H238Z"/>' +
      '<path class="cena-monte-1" d="M0 420V338C60 326 120 304 160 300 190 296 230 296 260 304 310 316 350 332 390 338V420Z"/>' +
      '<path class="cena-rota" d="M24 420C64 392 112 378 150 360 176 348 190 330 195 305"/>' +
      '<path class="cena-castelo" d="M130 304V232H136V240H140V232H146V240H150V232H156V268H162V262H168V268H172V262H178V268H180V204H186V212H192V204H198V212H204V204H210V268H216V262H222V268H226V262H232V268H234V232H240V240H244V232H250V240H254V232H260V304Z"/>' +
      '<path class="cena-portao" d="M187 304V288a8 8 0 0 1 16 0V304Z"/>' +
      '<g class="cena-janela"><rect x="141" y="250" width="4" height="9" rx="2"/><rect x="245" y="250" width="4" height="9" rx="2"/><rect x="193" y="222" width="4" height="10" rx="2"/><rect x="166" y="279" width="3" height="7" rx="1.5"/><rect x="221" y="279" width="3" height="7" rx="1.5"/></g>' +
      '<path class="cena-mastro" d="M195 204V178"/><path class="cena-flamula" d="M195 179H216L210 185 216 191H195Z"/>' +
      '<g class="cena-brasas">' + brasas + '</g>' +
      '</svg>';
  }

  RP.registrarTela('inicio', {
    montar: function (el) {
      var t = D.temporada;
      el.innerHTML =
        '<div class="inicio-cena">' + cenaEntrada() + '</div>' +
        '<div class="inicio-conteudo">' +
        '<h1 class="titulo-jogo">Reino de Pedra</h1>' +
        '<p class="subtitulo-jogo">Estratégia e Conquista</p>' +
        '<div class="inicio-acoes">' +
        '<a class="btn btn-primario btn-bloco btn-grande" href="#/criar">' + RP.icone('castelo') + 'Fundar meu reino</a>' +
        '<a class="btn btn-bloco" href="#/reino" data-continuar><span>Continuar como <span data-nome-reino>' + RP.esc(RP.estado.nome) + '</span></span></a>' +
        '</div>' +
        '<p class="inicio-temporada">' + RP.icone('temporada', 'ico-p') + 'Temporada ' + t.numero + ' · termina em ' + t.diasRestantes + ' dias · ' + RP.num(t.reinos) + ' reinos</p>' +
        '</div>';
    },
    entrar: function (el) {
      RP.$$('[data-nome-reino]', el).forEach(function (s) { s.textContent = RP.estado.nome; });
    }
  });

  /* ================================================================ criação do reino */
  var rascunho = null;
  function opcoesForma() {
    return Object.keys(RP.FORMAS).map(function (f) {
      var cfg = Object.assign({}, rascunho.brasao, { forma: f });
      return '<button type="button" class="opcao" data-forma="' + f + '" aria-pressed="' + (rascunho.brasao.forma === f) + '">' + RP.brasao(cfg, { tamanho: 34, semSimbolo: true }) + RP.FORMAS[f].nome + '</button>';
    }).join('');
  }
  function opcoesDivisao() {
    return Object.keys(RP.DIVISOES).map(function (d) {
      var cfg = Object.assign({}, rascunho.brasao, { divisao: d });
      return '<button type="button" class="opcao" data-divisao="' + d + '" aria-pressed="' + (rascunho.brasao.divisao === d) + '">' + RP.brasao(cfg, { tamanho: 34, semSimbolo: true }) + RP.DIVISOES[d].nome + '</button>';
    }).join('');
  }
  function opcoesSimbolo() {
    return Object.keys(RP.SIMBOLOS).map(function (s) {
      var cfg = Object.assign({}, rascunho.brasao, { simbolo: s, divisao: 'pleno' });
      return '<button type="button" class="opcao" data-simbolo="' + s + '" aria-pressed="' + (rascunho.brasao.simbolo === s) + '">' + RP.brasao(cfg, { tamanho: 34 }) + RP.SIMBOLOS[s].nome + '</button>';
    }).join('');
  }
  function amostras(campo) {
    return Object.keys(RP.TINTURAS).map(function (t) {
      return '<button type="button" class="amostra" style="background:var(--tin-' + t + ')" data-cor="' + campo + ':' + t + '" aria-label="' + RP.TINTURAS[t].nome + '" aria-pressed="' + (rascunho.brasao[campo] === t) + '"></button>';
    }).join('');
  }
  function contrasteOk(b) {
    /* regra heráldica simples: metal sobre cor ou cor sobre metal */
    return !!RP.TINTURAS[b.cor1].metal !== !!RP.TINTURAS[b.corSimbolo].metal;
  }
  function validarNome(n) {
    n = n.trim();
    if (n.length < 3) return 'Use pelo menos 3 letras.';
    if (n.length > 24) return 'Use no máximo 24 caracteres.';
    if (!/^[A-Za-zÀ-ÿ' -]+$/.test(n)) return 'Use apenas letras, espaço, hífen ou apóstrofo.';
    return '';
  }
  function atualizarCriar(el) {
    var b = rascunho.brasao;
    RP.$('.criar-previa-brasao', el).innerHTML = RP.brasao(b, { tamanho: 112 });
    RP.$('.criar-previa-nome', el).textContent = rascunho.nome.trim() ? 'Reino de ' + rascunho.nome.trim() : 'Seu reino';
    RP.$('[data-grade="forma"]', el).innerHTML = opcoesForma();
    RP.$('[data-grade="divisao"]', el).innerHTML = opcoesDivisao();
    RP.$('[data-grade="simbolo"]', el).innerHTML = opcoesSimbolo();
    ['cor1', 'cor2', 'corSimbolo'].forEach(function (c) { RP.$('[data-amostras="' + c + '"]', el).innerHTML = amostras(c); });
    RP.$('[data-bloco-cor2]', el).hidden = b.divisao === 'pleno';
    var erro = validarNome(rascunho.nome);
    var msg = RP.$('.campo-erro', el);
    msg.textContent = rascunho.tocado ? erro : '';
    RP.$('[data-fundar]', el).classList.toggle('btn-inativo', !!erro); /* continua tocável: o toque mostra o motivo */
    var dica = RP.$('[data-dica-contraste]', el);
    var ok = contrasteOk(b);
    dica.hidden = ok;
  }

  RP.registrarTela('criar', {
    montar: function (el) {
      rascunho = { nome: '', tocado: false, brasao: { forma: 'portugues', divisao: 'cortado', cor1: 'azul', cor2: 'vermelho', simbolo: 'torre', corSimbolo: 'ouro' } };
      el.innerHTML =
        '<header class="topo"><a class="btn btn-fantasma btn-icone" href="#/inicio" aria-label="Voltar">' + RP.icone('voltar') + '</a><h1>Fundar reino</h1></header>' +
        '<div class="conteudo-tela pilha-4">' +
        '<div class="card card-moldura criar-previa"><div class="criar-previa-brasao"></div><p class="criar-previa-nome"></p></div>' +
        '<div class="campo"><label for="nome-reino">Nome do reino</label>' +
        '<input id="nome-reino" type="text" maxlength="24" autocomplete="off" autocapitalize="words" placeholder="Ex.: Pedralva" enterkeyhint="done">' +
        '<span class="campo-ajuda">De 3 a 24 letras. Outros jogadores verão este nome quando você levar seu estandarte.</span><span class="campo-erro" role="alert"></span></div>' +
        '<div class="secao-titulo">Brasão</div>' +
        '<div class="pilha"><span class="rotulo">Forma</span><div class="opcoes opcoes-3" data-grade="forma"></div></div>' +
        '<div class="pilha"><span class="rotulo">Divisão</span><div class="opcoes opcoes-3" data-grade="divisao"></div></div>' +
        '<div class="pilha"><span class="rotulo">Cor do campo</span><div class="amostras" data-amostras="cor1"></div></div>' +
        '<div class="pilha" data-bloco-cor2><span class="rotulo">Segunda cor</span><div class="amostras" data-amostras="cor2"></div></div>' +
        '<div class="pilha"><span class="rotulo">Símbolo</span><div class="opcoes" data-grade="simbolo"></div></div>' +
        '<div class="pilha"><span class="rotulo">Cor do símbolo</span><div class="amostras" data-amostras="corSimbolo"></div>' +
        '<p class="nota-antiga" data-dica-contraste>' + RP.icone('info', 'ico-p') + 'Dica: símbolo de metal (ouro ou prata) sobre cor, ou cor sobre metal, é lido de longe no mapa.</p></div>' +
        '<div class="secao-titulo">Início</div>' +
        '<div class="card pilha">' +
        '<div class="linha">' + RP.icone('bussola') + '<div style="flex:1"><b>Região inicial: aleatória</b><div class="fraco" style="font-size:var(--fs-2)">A escolha de região é desbloqueada pela Linhagem.</div></div>' + RP.icone('cadeado', 'fraco') + '</div>' +
        '<div class="linha">' + RP.icone('escudo') + '<div style="flex:1"><b>Escudo de novato</b><div class="fraco" style="font-size:var(--fs-2)">Seus locais ficam protegidos contra ataques no começo.</div></div></div>' +
        '<div class="linha">' + RP.icone('castelo') + '<div style="flex:1"><b>Castelo e recursos básicos</b><div class="fraco" style="font-size:var(--fs-2)">O reino já produz o suficiente para tropas básicas, sem depender de exploração.</div></div></div>' +
        '</div>' +
        '</div>' +
        '<div class="rodape-acao"><button type="button" class="btn btn-primario btn-bloco btn-grande" data-fundar>' + RP.icone('castelo') + 'Fundar reino</button></div>';

      var inp = RP.$('#nome-reino', el);
      inp.addEventListener('input', function () { rascunho.nome = inp.value; atualizarCriar(el); });
      inp.addEventListener('blur', function () { rascunho.tocado = true; atualizarCriar(el); });
      el.addEventListener('click', function (e) {
        var b, bb = rascunho.brasao;
        if ((b = e.target.closest('[data-forma]'))) bb.forma = b.getAttribute('data-forma');
        else if ((b = e.target.closest('[data-divisao]'))) bb.divisao = b.getAttribute('data-divisao');
        else if ((b = e.target.closest('[data-simbolo]'))) bb.simbolo = b.getAttribute('data-simbolo');
        else if ((b = e.target.closest('[data-cor]'))) { var p = b.getAttribute('data-cor').split(':'); bb[p[0]] = p[1]; }
        else if (e.target.closest('[data-fundar]')) { rascunho.tocado = true; atualizarCriar(el); fundar(el); return; }
        else return;
        atualizarCriar(el);
      });
      atualizarCriar(el);
    }
  });

  function fundar(el) {
    if (validarNome(rascunho.nome)) { RP.$('#nome-reino', el).focus(); return; }
    RP.estado.nome = rascunho.nome.trim();
    RP.estado.brasao = Object.assign({}, rascunho.brasao);
    RP.estado.recemFundado = true;
    RP.salvarReino();
    D.reinos.meu.nome = RP.estado.nome;
    D.reinos.meu.brasao = RP.estado.brasao;
    RP.invalidarTela('mapa');
    RP.invalidarTela('reino');
    RP.modal({
      topo: '<div class="modal-brasao">' + RP.brasao(RP.estado.brasao, { tamanho: 96 }) + '</div>',
      titulo: 'Reino de ' + RP.esc(RP.estado.nome) + ' fundado',
      corpo: '<p class="suave">O castelo foi erguido numa região do mapa. O entorno já é conhecido; o resto do mundo está coberto pela névoa.</p>' +
        '<p class="selo selo-visivel" style="margin-top:var(--esp-3)">' + RP.icone('escudo') + 'Escudo de novato ativo</p>',
      acoes: [
        { rotulo: RP.icone('castelo') + 'Ver meu reino', classe: 'btn-primario', acao: function () { RP.ir('reino'); } },
        { rotulo: RP.icone('mapa') + 'Abrir o mapa', acao: function () { RP.ir('mapa'); } }
      ],
      fecharFora: false
    });
  }

  /* ================================================================ meu reino */
  var NOME_PROD = { madeira: 'madeira', pedra: 'pedra', comida: 'comida', ferro: 'ferro' };
  function meusLocais() { return D.locais.filter(function (x) { return x.reino === 'meu'; }); }
  function categoria(x) {
    if (x.ameaca) return 'ameaca';
    if (x.tipo === 'quartel' || x.tipo === 'ferraria') return 'militar';
    return 'producao';
  }
  function cardLocal(x) {
    var terr = H.TERRENOS[RP.mundo.T[x.l][x.c]].nome;
    var ameacas = D.marchas.filter(function (m) { return m.alvo === x.id && m.hostil; });
    var linha2 = x.prod ? '<span class="lc-prod">' + RP.icone(x.prod.r, 'ico-p r-' + x.prod.r) + '+' + x.prod.v + ' ' + NOME_PROD[x.prod.r] + '/h' + (x.jazida ? ' · jazida ' + Math.round(x.jazida * 100) + '%' : '') + '</span>'
      : '<span class="lc-prod">' + RP.esc((x.info || [])[0] || '') + '</span>';
    return '<div class="card local-card" role="button" tabindex="0" data-local="' + x.id + '" data-cat="' + categoria(x) + '">' +
      '<span class="ico-placa dono-meu">' + RP.icone(x.tipo) + '</span>' +
      '<div class="lc-corpo"><div class="linha-entre"><b class="lc-nome">' + RP.esc(x.nome) + '</b><span class="selo">Nv ' + x.nivel + '</span></div>' +
      '<small class="fraco">' + RP.TIPOS_LOCAL[x.tipo] + ' · ' + terr + ' · ' + RP.icone('escudo', 'ico-p') + RP.esc(x.postura) + '</small>' + linha2 + linhaRel(x) +
      (RP.torres.de(x.id).length ? '<span class="lc-torre">' + RP.icone('torre', 'ico-p') + 'Protegido por ' + RP.esc(RP.torres.de(x.id).map(function (t) { return t.nome; }).join(', ')) + '</span>' : '') +
      '<span class="lc-estoque"><span class="fraco">Estoque</span>' + RP.estoqueHTML(x.id) + '</span>' +
      (x.obra ? RP.timerHTML(RP.icone('martelo', 'ico-p') + ' ' + x.obra.rotulo, x.obra.seg, x.obra.total) : '') +
      (x.fila ? RP.timerHTML(RP.icone('tropas', 'ico-p') + ' ' + x.fila.rotulo, x.fila.seg, x.fila.total) : '') +
      ameacas.map(function (m) {
        return '<div class="lc-ameaca">' + RP.icone('alerta', 'ico-p pulso') + '<span><b>Forças desconhecidas</b> a caminho · <b class="num" data-fim="' + m.chegada + '">' + RP.fmtResta(m.chegada - Date.now()) + '</b></span></div>';
      }).join('') +
      '</div></div>';
  }
  /* relíquia guardada no local (só as suas aparecem aqui) */
  function linhaRel(x) {
    var r = RP.reliquiaEm(x.id);
    return r ? '<span class="lc-relq tipo-' + r.tipo + '">' + RP.icone('lendario', 'ico-p') + '<b>' + RP.esc(r.nome) + '</b>&nbsp;· ' + RP.RELIQUIA[r.tipo].efeito(r.bonus) + '</span>' : '';
  }
  function folhaLocal(x) {
    var terr = H.TERRENOS[RP.mundo.T[x.l][x.c]];
    var corpo = '<div class="info">' +
      '<div class="info-linha"><span class="fraco">Tipo</span><span>' + RP.TIPOS_LOCAL[x.tipo] + '</span></div>' +
      '<div class="info-linha"><span class="fraco">Terreno</span><span>' + terr.nome + '</span></div>' +
      '<div class="info-linha"><span class="fraco">Nível</span><span>' + x.nivel + '</span></div>' +
      (x.info || []).map(function (i) { return '<div class="info-linha"><span class="fraco">Detalhe</span><span>' + RP.esc(i) + '</span></div>'; }).join('') +
      '<div class="info-linha"><span class="fraco">Guarnição</span><span>' + RP.esc(x.guarnicao) + '</span></div>' +
      '<div class="info-linha"><span class="fraco">Postura</span><span class="selo selo-info">' + RP.esc(x.postura) + '</span></div>' +
      (RP.torres.de(x.id).length ? '<div class="info-linha"><span class="fraco">Torres</span><span>' + RP.esc(RP.torres.de(x.id).map(function (t) { return t.nome + ' (' + RP.torres.descricao(t) + ')'; }).join('; ')) + '</span></div>' : '') +
      '<div class="info-linha"><span class="fraco">Estoque</span><span>' + RP.estoqueHTML(x.id) + '</span></div>' +
      '</div><p class="fraco" style="margin-top:var(--esp-2);font-size:var(--fs-2)">Obras aqui usam o estoque deste local. Para trazer material, mande uma caravana.</p>' + (RP.reliquiaEm(x.id) ? '<div style="margin-top:var(--esp-3)">' + RP.seloReliquia(RP.reliquiaEm(x.id)) + '</div>' : '') +
      '<p class="fraco" style="margin-top:var(--esp-3);font-size:var(--fs-2)">Cada local é um alvo com defesa própria: guarnição, população como milícia e torres de arqueiros no alcance.' + (RP.reliquiaEm(x.id) ? ' Quem vencer um saque ou uma ocupação aqui leva a relíquia.' : '') + '</p>';
    RP.abrirFolha({
      titulo: RP.esc(x.nome), veu: true,
      subtitulo: '<span class="fraco">' + RP.TIPOS_LOCAL[x.tipo] + ' · Nível ' + x.nivel + '</span>',
      icone: '<span class="ico-placa folha-ico dono-meu">' + RP.icone(x.tipo) + '</span>',
      corpo: corpo,
      acoes: '<a class="btn btn-p btn-primario" href="#/mapa?foco=' + x.id + '">' + RP.icone('mapa') + 'Ver no mapa</a>' +
        '<a class="btn btn-p" href="#/construcao">' + RP.icone('martelo') + 'Melhorar</a>' +
        (RP.sistema('logistica') ? '<a class="btn btn-p" href="#/caravana?para=' + x.id + '">' + RP.icone('carroca') + 'Trazer recursos</a>' : '') +
        '<a class="btn btn-p" href="#/posturas?local=' + x.id + '">' + RP.icone('escudo') + 'Postura</a>' +
        (x.tipo === 'quartel' ? '<a class="btn btn-p" href="#/recrutamento">' + RP.icone('tropas') + 'Recrutar</a>' : '') +
        (RP.reliquiaEm(x.id) ? '<a class="btn btn-p" href="#/reliquias">' + RP.icone('lendario') + 'Relíquia</a>' : '')
    });
  }

  function cardReliquias() {
    var minhas = D.reliquias.filter(function (r) { return r.dono === 'meu'; }), roubadas = D.reliquias.filter(function (r) { return r.roubada; });
    var conhecidas = D.reliquias.filter(function (r) { return r.dono && r.dono !== 'meu' && r.espionada !== undefined; });
    return '<div class="secao-titulo">Relíquias</div><a class="card pilha reino-relq" href="#/reliquias">' +
      '<div class="linha-entre"><span class="linha"><span class="relq-ico">' + RP.icone('lendario') + '</span><b>' + minhas.length + (minhas.length === 1 ? ' relíquia' : ' relíquias') + ' com você</b></span>' + RP.icone('avancar', 'ico-p') + '</div>' +
      '<div class="linha" style="flex-wrap:wrap">' + minhas.map(function (r) { return '<span class="selo selo-relq tipo-' + r.tipo + '">' + RP.icone(RP.RELIQUIA[r.tipo].icone) + RP.esc(r.nome) + '</span>'; }).join('') + '</div>' +
      (roubadas.length ? '<span class="lc-ameaca">' + RP.icone('alerta', 'ico-p' + (RP.ladroesDe(roubadas[0]) ? ' pulso' : '')) + '<span><b>' + RP.esc(roubadas[0].nome) + '</b> foi roubada · ' + (RP.ladroesDe(roubadas[0]) ? 'ainda a caminho: dá para interceptar' : 'paradeiro desconhecido') + '</span></span>' : '') +
      '<small class="fraco">' + conhecidas.length + ' de outros reinos conhecida' + (conhecidas.length === 1 ? '' : 's') + ' por espionagem · ' + D.ruinasComReliquia.length + (D.ruinasComReliquia.length === 1 ? ' ruína antiga' : ' ruínas antigas') + ' para escavar</small></a>';
  }

  RP.registrarTela('reino', {
    nav: true,
    montar: function (el) {
      var p = D.populacao, t = D.temporada;
      var locais = meusLocais();
      var castelo = locais.filter(function (x) { return x.tipo === 'castelo'; })[0];
      var outros = locais.filter(function (x) { return x.tipo !== 'castelo'; });
      var moradias = p.moradias.reduce(function (s, m) { return s + m.qtd; }, 0);
      var nAmeaca = outros.filter(function (x) { return x.ameaca; }).length;
      el.innerHTML =
        '<header class="topo topo-reino">' + RP.brasao(RP.estado.brasao, { tamanho: 36 }) +
        '<div class="topo-titulos"><h1>Reino de ' + RP.esc(RP.estado.nome) + '</h1><small>' + RP.icone('temporada', 'ico-p') + 'Temporada ' + t.numero + ' · ' + t.diasRestantes + ' dias restantes</small></div>' +
        '<button type="button" class="btn btn-fantasma btn-icone btn-sino-topo" data-abrir-notificacoes aria-label="Notificações">' + RP.icone('sino') + '<span class="contador">' + D.notificacoesNaoLidas + '</span></button>' +
        '</header>' +
        '<div class="reino-vista">' +
        '<canvas class="reino-cena" aria-label="Vista do reino: castelo, locais e pessoas trabalhando. Arraste para os lados; toque numa construção para ver detalhes."></canvas>' +
        '<div class="reino-vista-dica">' + RP.icone('vista', 'ico-p') + 'Arraste para os lados · toque nas construções</div>' +
        '<a class="btn btn-p reino-vista-abrir" href="#/mapa?modo=cena&amp;centro=castelo">' + RP.icone('mapa') + 'Abrir no mundo</a>' +
        '</div>' +
        '<div class="conteudo-tela conteudo-reino">' +
        '<div class="reino-recursos">' + RP.barraRecursos({ semSino: true }) + '</div>' +
        '<div class="reino-pendencias">' + RP.pendenciasResumo() + '</div>' +
        (RP.estado.recemFundado ? '<div class="card faixa-escudo">' + RP.icone('escudo') + '<div><b>Escudo de novato ativo</b><br><span class="suave">Ninguém pode atacar seus locais enquanto o escudo durar.</span></div></div>' : '') +

        '<div class="card pop-card">' +
        '<div class="card-titulo">' + RP.icone('populacao', 'r-populacao') + '<h2>População</h2><span class="selo selo-visivel">' + RP.icone('subir') + '+' + p.taxa + '/h</span></div>' +
        '<div class="pop-num num"><b data-pop>' + RP.num(RP.popAtual()) + '</b><span>/ ' + RP.num(p.teto) + '</span></div>' +
        '<div class="barra barra-grossa" role="progressbar" aria-label="População em relação ao teto"><i data-pop-barra style="width:' + (100 * RP.popAtual() / p.teto).toFixed(1) + '%"></i></div>' +
        '<ul class="pop-linhas">' +
        '<li>' + RP.icone('comida', 'ico-p r-comida') + '<span>Crescimento acelerado: <b>+' + p.bonusComida + '%</b> pelo excedente de comida</span></li>' +
        '<li>' + RP.icone('moradia', 'ico-p') + '<span>Teto definido por <b>' + moradias + ' moradias</b>: ' + p.moradias.map(function (m) { return RP.esc(m.local.replace('Castelo de Pedralva', 'Castelo')) + ' ' + m.qtd; }).join(' · ') + '</span></li>' +
        '<li>' + RP.icone('escudo', 'ico-p') + '<span>Na defesa, a população atua como <b>milícia</b> em cada local.</span></li>' +
        '<li>' + RP.icone('tropas', 'ico-p') + '<span>Recrutar consome população. Tropas mortas não retornam.</span></li>' +
        '</ul>' +
        '<div class="linha" style="margin-top:var(--esp-3)"><a class="btn btn-p" href="#/construcao?aba=populacao">' + RP.icone('moradia') + 'Construir moradia</a><a class="btn btn-p" href="#/recrutamento">' + RP.icone('tropas') + 'Recrutar</a></div>' +
        '</div>' +

        '<div class="secao-titulo">Filas</div>' +
        '<div class="card pilha">' +
        '<div class="card-titulo" style="margin:0">' + RP.icone('martelo') + '<h3>Obras</h3><span class="selo">' + D.filas.obras.length + ' de ' + D.filas.vagasObras + '</span></div>' +
        D.filas.obras.map(RP.itemFilaHTML).join('') +
        '<div class="card-titulo" style="margin:var(--esp-2) 0 0">' + RP.icone('tropas') + '<h3>Recrutamento</h3><span class="selo">' + D.filas.recrutamento.length + ' de ' + D.filas.vagasRecrutamento + '</span></div>' +
        D.filas.recrutamento.map(RP.itemFilaHTML).join('') +
        '<div class="linha" style="margin-top:var(--esp-2)"><a class="btn btn-p btn-primario" href="#/construcao" style="flex:1">' + RP.icone('martelo') + 'Construir</a><a class="btn btn-p" href="#/recrutamento" style="flex:1">' + RP.icone('tropas') + 'Recrutar</a></div>' +
        '</div>' +

        '<div class="secao-titulo">Castelo (capital)</div>' +
        '<div class="card card-moldura castelo-card" role="button" tabindex="0" data-local="' + castelo.id + '">' +
        '<div class="castelo-topo"><span class="ico-placa ico-placa-g dono-meu">' + RP.icone('castelo') + '</span><div><h2>Castelo de ' + RP.esc(RP.estado.nome) + '</h2><span class="fraco">Sede do reino · Planície</span></div></div>' +
        '<div class="castelo-dados">' +
        '<div><span class="fraco">Nível</span><b>' + castelo.nivel + '</b></div>' +
        '<div><span class="fraco">Portões</span><b>3</b></div>' +
        '<div><span class="fraco">Guarnição</span><b>35</b></div>' +
        '<div><span class="fraco">Milícia</span><b data-pop>' + RP.num(RP.popAtual()) + '</b></div>' +
        '</div>' +
        '<div class="linha"><span class="selo selo-info">' + RP.icone('escudo') + RP.esc(castelo.postura) + '</span><span class="fraco" style="font-size:var(--fs-2)">' + RP.esc(castelo.guarnicao) + '</span></div>' +
        '<span class="lc-estoque"><span class="fraco">Estoque</span>' + RP.estoqueHTML(castelo.id) + '</span>' +
        linhaRel(castelo) +
        '</div>' +

        '<div class="secao-titulo">Locais (' + outros.length + ')</div>' +
        '<div class="abas" role="tablist" aria-label="Filtrar locais">' +
        '<button class="aba" role="tab" aria-selected="true" data-filtro="todos">Todos</button>' +
        '<button class="aba" role="tab" aria-selected="false" data-filtro="producao">Produção</button>' +
        '<button class="aba" role="tab" aria-selected="false" data-filtro="militar">Militar</button>' +
        '<button class="aba" role="tab" aria-selected="false" data-filtro="ameaca">Sob ameaça' + (nAmeaca ? ' <span class="contador contador-inline">' + nAmeaca + '</span>' : '') + '</button>' +
        '</div>' +
        '<div class="locais-lista">' + outros.map(cardLocal).join('') + '</div>' +

        (RP.sistema('reliquias') ? cardReliquias() : '') +
        '<div class="secao-titulo">Valiosos</div>' +
        '<div class="linha" style="flex-wrap:wrap">' + D.valiosos.map(function (v) {
          return '<span class="selo selo-destaque selo-g">' + RP.icone(v.id, 'r-' + v.id) + v.nome + ' <b class="num">' + RP.num(RP.totalRecurso(v.id)) + '</b></span>';
        }).join('') + '</div>' +
        '<p class="fraco" style="margin:var(--esp-3) 0 var(--esp-8);font-size:var(--fs-2)">Ficam no Armazém Real. Liberam unidades e tecnologias melhores: leve-os até onde forem usados. Encontre jazidas com prospectores.</p>' +
        '</div>';

      el.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-filtro]'))) {
          var f = b.getAttribute('data-filtro');
          RP.$$('[data-filtro]', el).forEach(function (a) { a.setAttribute('aria-selected', String(a === b)); });
          RP.$$('.locais-lista .local-card', el).forEach(function (c) {
            var cat = c.getAttribute('data-cat');
            c.hidden = !(f === 'todos' || cat === f || (f === 'producao' && cat === 'ameaca'));
          });
          return;
        }
        if ((b = e.target.closest('[data-local]'))) abrirLocal(b.getAttribute('data-local'));
      });
      /* vista imersiva do reino */
      var meus = locais.map(function (x) { return H.centro(x.c, x.l); });
      var xs = meus.map(function (q) { return q.x; }), ys = meus.map(function (q) { return q.y; });
      var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
      var cc = H.centro(castelo.c, castelo.l);
      cenaReino = new RP.Cena(RP.$('.reino-cena', el), {
        tocavel: true, panHorizontal: true,
        limites: { x0: x0 + 60, x1: x1 - 60, y0: (y0 + y1) / 2 - 20, y1: (y0 + y1) / 2 + 20 },
        aoTocar: function (alvo) {
          if (alvo.ent && alvo.ent[0] === 'local') abrirLocal(alvo.ent[1]);
          else if (alvo.ent) RP.ir('mapa?modo=cena&abrir=' + alvo.ent.join(':'));
        }
      });
      cenaReino.posicaoInicial = { x: cc.x + 20, y: (y0 + y1) / 2 + 10, alturaMundo: y1 - y0 + 120 };
      el.addEventListener('keydown', function (e) {
        var b = e.target.closest('[data-local]');
        if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrirLocal(b.getAttribute('data-local')); }
      });
      document.addEventListener('rp:tique', function () {
        var bar = RP.$('[data-pop-barra]', el);
        if (bar) bar.style.width = (100 * RP.popAtual() / p.teto).toFixed(2) + '%';
      });
    },
    entrar: function (el, params) {
      var id = params.get('local');
      if (id) setTimeout(function () { abrirLocal(id); }, 60);
      requestAnimationFrame(function () {
        cenaReino.redimensionar();
        if (!cenaReino.posicionada) {
          var pi = cenaReino.posicaoInicial;
          var s = Math.max(1, Math.min(1.5, cenaReino.h / (pi.alturaMundo * RP.cenaK)));
          cenaReino.centrar(pi.x, pi.y, s, 0.5, false);
          cenaReino.posicionada = true;
        }
        cenaReino.iniciar();
      });
    },
    sair: function () { if (cenaReino) cenaReino.parar(); }
  });
  var cenaReino = null;
  function abrirLocal(id) {
    var x = D.locais.filter(function (l) { return l.id === id; })[0];
    if (x) folhaLocal(x);
  }

  /* ================================================================ telas-guia (próximos blocos) */
  function guia(titulo, intro, itens) {
    return '<header class="topo"><h1>' + titulo + '</h1><button type="button" class="btn btn-fantasma btn-icone btn-sino-topo" data-abrir-notificacoes aria-label="Notificações">' + RP.icone('sino') + '<span class="contador">' + D.notificacoesNaoLidas + '</span></button></header>' +
      '<div class="conteudo-tela pilha"><p class="suave">' + intro + '</p>' +
      itens.filter(Boolean).map(function (i) {
        if (i[3]) return '<a class="card guia-item" href="' + i[3] + '"><span class="ico-placa">' + RP.icone(i[0]) + '</span><span><b>' + i[1] + '</b><small class="fraco">' + i[2] + '</small></span>' + RP.icone('avancar', 'ico-p') + '</a>';
        return '<button type="button" class="card guia-item" data-em-breve="' + i[1] + '"><span class="ico-placa">' + RP.icone(i[0]) + '</span><span><b>' + i[1] + '</b><small class="fraco">' + i[2] + '</small></span><span class="selo">Próximo bloco</span></button>';
      }).join('') + '</div>';
  }
  RP.registrarTela('mais', {
    nav: true,
    montar: function (el) {
      desenharMais(el);
      el.addEventListener('click', function (e) {
        var b;
        if (e.target.closest('[data-jogador-novo]')) {
          var novo = Object.keys(RP.SISTEMAS).every(function (k) { return !RP.sistema(k); });
          Object.keys(RP.SISTEMAS).forEach(function (k) { RP.dados.descobertas[k] = novo; });
          RP.aviso({ titulo: novo ? 'Todos os sistemas à vista' : 'Como jogador novo', texto: novo ? 'Como um jogador no dia 34.' : 'Transporte manual, espionagem, torres, relíquias e alianças somem até o gatilho de cada um.', icone: 'bandeira', ms: 2600 });
          ['reino', 'construcao', 'exploradores', 'agora', 'mapa'].forEach(RP.invalidarTela);
          desenharMais(el); return;
        }
        if ((b = e.target.closest('[data-simular]'))) { RP.revelarSistema(b.getAttribute('data-simular')); desenharMais(el); return; }
        if (!e.target.closest('[data-reiniciar]')) return;
        try { sessionStorage.removeItem('rp-reino'); } catch (er) { /* ignora */ }
        location.hash = '#/inicio';
        location.reload();
      });
    },
    entrar: function (el) { desenharMais(el); }
  });
  function desenharMais(el) {
      el.innerHTML = guia('Mais', 'Temporada, legado, bandeiras e avisos.', [
        ['temporada', 'Temporada e legado', 'Tempo restante, linhagem, relíquias, títulos e brasões', '#/temporada'],
        ['alvo', 'Precisa de você', 'O que pede atenção, oportunidades e o andamento do reino', '#/agora'],
        RP.sistema('alianca') ? ['estandarte', 'Aliança', RP.dados.alianca.nome + ' · ' + RP.dados.alianca.membros.length + ' de ' + RP.dados.alianca.limite + ' · pedidos de recursos', '#/alianca'] : null,
        RP.sistema('reliquias') ? ['lendario', 'Relíquias', 'Suas, as espionadas, as concentrações à vista e as ruínas', '#/reliquias'] : null,
        ['coroa', 'Ranking da temporada', 'Baixas, perdas, tropas e famílias', '#/ranking'],
        ['bandeira', 'Bandeiras', 'Sinais que você colocou e os de perto', '#/bandeiras'],
        ['sino', 'Notificações', 'Avisos recentes e o que chega no celular', '#/notificacoes'],
        ['escudo', 'Posturas', 'Como cada guarnição reage sem você', '#/posturas'],
        ['coroa', 'Retorno após regência', 'O que o regente fez enquanto você esteve fora (exemplo)', '#/regencia'],
        ['escombros', 'Exílio', 'Recomeço após perder todos os locais (exemplo)', '#/exilio']
      ]) +
        '<div class="conteudo-tela pilha" style="padding-top:0"><div class="secao-titulo">Protótipo</div>' +
        '<div class="card pilha"><p class="fraco" style="font-size:var(--fs-2)">Dados fictícios. Nada aqui é salvo em servidor.</p>' +
        '<button type="button" class="btn btn-p" data-reiniciar>Reiniciar protótipo</button></div>' +
        '<div class="secao-titulo">Sistemas apresentados aos poucos</div><div class="card pilha" data-sistemas></div></div>';
      (function () {
        var novo = Object.keys(RP.SISTEMAS).every(function (k) { return !RP.sistema(k); });
        RP.$('[data-sistemas]', el).innerHTML = '<p class="fraco" style="font-size:var(--fs-2)">Nada é bloqueado e não há missão: cada sistema aparece quando passa a fazer sentido. Este jogador (dia 34) já viu todos. Veja como seria para quem começa:</p>' +
          '<button type="button" class="alternar" data-jogador-novo aria-pressed="' + novo + '" style="width:100%">' + RP.icone('bandeira') + '<span>Ver como jogador novo</span><i aria-hidden="true"></i></button>' +
          '<div class="lista">' + Object.keys(RP.SISTEMAS).map(function (k) {
            var s = RP.SISTEMAS[k], v = RP.sistema(k);
            return '<div class="lista-item"><span class="ico-placa">' + RP.icone(s.icone) + '</span><span style="flex:1;min-width:0"><b>' + s.nome + '</b><br><small class="fraco">' + s.gatilho + '</small></span>' +
              (v ? '<span class="selo selo-visivel">' + RP.icone('check') + 'À vista</span>' : '<button type="button" class="btn btn-p" data-simular="' + k + '">Simular</button>') + '</div>';
          }).join('') + '</div>';
      })();
  }

  /* ================================================================ retorno após regência */
  RP.registrarTela('regencia', {
    montar: function (el) {
      var r = D.regencia, rec = D.recursos;
      el.innerHTML =
        '<header class="topo"><a class="btn btn-fantasma btn-icone" href="#/mais" aria-label="Voltar">' + RP.icone('voltar') + '</a><h1>Retorno ao reino</h1></header>' +
        '<div class="conteudo-tela pilha-4">' +
        '<div class="card card-moldura regencia-topo">' + RP.brasao(RP.estado.brasao, { tamanho: 64 }) +
        '<div><h2>Bem-vindo de volta</h2><p class="suave">Você ficou <b>' + r.diasFora + ' dias</b> fora. Nesse período, um regente governou ' + RP.esc(RP.estado.nome) + ' em seu nome.</p></div></div>' +
        '<div class="card pilha"><div class="card-titulo" style="margin:0">' + RP.icone('coroa') + '<h3>Como foi a regência</h3></div>' +
        '<p class="suave" style="font-size:var(--fs-2)">O regente é conservador: defende e produz, sem expandir nem atacar. Abandonar o reino nunca rende mais do que jogar.</p>' +
        '<div class="regencia-numeros">' +
        '<div><span class="fraco">Ataques sofridos</span><b>' + r.ataques.total + '</b><small>' + r.ataques.repelidos + ' repelidos</small></div>' +
        '<div><span class="fraco">Locais</span><b>' + r.restou.locais + '</b><small>' + r.perdas.length + ' perdido</small></div>' +
        '<div><span class="fraco">População</span><b>' + RP.num(r.restou.populacao) + '</b><small>de ' + RP.num(D.populacao.teto) + '</small></div>' +
        '</div></div>' +
        '<div class="card pilha"><div class="card-titulo" style="margin:0">' + RP.icone('martelo') + '<h3>Produzido</h3></div>' +
        '<div class="regencia-recursos">' + Object.keys(r.producao).map(function (kk) {
          return '<span class="selo selo-g">' + RP.icone(kk, 'r-' + kk) + rec[kk].nome + ' <b class="num">+' + RP.num(r.producao[kk]) + '</b></span>';
        }).join('') + '</div></div>' +
        r.perdas.map(function (pp) { return '<div class="faixa-alerta">' + RP.icone('alerta') + '<span class="txt"><b>' + RP.esc(pp.local) + '</b><br>' + RP.esc(pp.como) + '</span></div>'; }).join('') +
        '<div class="card"><div class="card-titulo">' + RP.icone('relatorios') + '<h3>Diário do regente</h3></div><ol class="diario">' +
        r.acoes.map(function (a) { return '<li><span class="selo">Dia ' + a.dia + '</span><span>' + RP.esc(a.txt) + '</span></li>'; }).join('') + '</ol></div>' +
        '</div>' +
        '<div class="rodape-acao"><a class="btn btn-primario btn-bloco btn-grande" href="#/reino">' + RP.icone('castelo') + 'Retomar o reino</a></div>';
    }
  });
})();
