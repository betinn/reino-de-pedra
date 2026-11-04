/* Reino de Pedra — Pessoas: a folha de uma pessoa (quem é, onde está, o que faz, até 3 ações) e a tela Pessoas
   (todo mundo, com filtro por ofício e por local), destino alternativo ao toque no mapa.
     civil    Trocar trabalho · Levar para… · Recrutar
     soldado  Missão · Selecionar o grupo · Voltar (atalhos: todos deste tipo aqui, ver no mapa)
   Dados: GET /reino/pessoas, GET /pessoas/{id}, POST /pessoas/{id}/trabalho, POST /pessoas/{id}/mover. */
(function () {
  'use strict';
  var RP = window.RP, M = RP.mapaModelo;
  var ESTADOS = { trabalhando: 'trabalhando', ociosa: 'sem trabalho', andando: 'a caminho', carregando: 'carregando', treinando: 'em treino', guarnecida: 'na guarnição', marchando: 'em marcha', ferida: 'ferida', capturada: 'capturada', coletando: 'coletando' };
  var ICONE = { ocioso: 'populacao', agricultor: 'comida', lenhador: 'madeira', pedreiro: 'pedra', mineiro: 'ferro', mensageiro: 'mensagem', milicia: 'populacao', lanceiro: 'tropas', arqueiro: 'alvo', cavalaria: 'cavalo', elite: 'cavalo', ariete: 'cerco', trebuchet: 'cerco', 'explorador-pe': 'explorador', 'explorador-cavalo': 'explorador', prospector: 'picareta', batedor: 'batedor' };
  function icone(p) { return ICONE[p.oficio] || 'populacao'; }
  function ehSoldado(p) { return !!(RP.pessoasVista && RP.pessoasVista.ehSoldado(p)); }

  function recarregarMapa() { if (M.carregar) M.carregar().catch(function () { /* offline */ }); }

  /* ---------------------------------------------------------------- folha da pessoa */
  function textoTempo(p) {
    if (p.estado === 'andando' && p.chegada) return ' · chega ' + RP.barraTempo(p.partida, p.chegada, { classe: 'curta', rotulo: 'Caminhada' });
    if (p.estado === 'treinando' && p.pronta) return ' · pront' + (p.feminina ? 'a' : 'o') + ' ' + RP.barraTempo(p.treinoInicio, p.pronta, { classe: 'curta', rotulo: 'Treino' });
    return '';
  }
  function corpoPessoa(f) {
    var p = f.pessoa;
    var vet = ehSoldado(p) && RP.config && RP.config.veterania ? nivelVeterania(p.marcas) : null;
    return '<div class="info">' +
      '<div class="info-linha"><span class="fraco">Agora</span><span>' + RP.esc(p.texto || '') + textoTempo(p) + '</span></div>' +
      (p.local ? '<div class="info-linha"><span class="fraco">Onde</span><span>' + RP.esc(p.local) + '</span></div>' : '') +
      (ehSoldado(p) ? '<div class="info-linha"><span class="fraco">Veterania</span><span>' + (vet ? vet : (p.marcas ? p.marcas + (p.marcas === 1 ? ' marca' : ' marcas') : 'recruta')) + '</span></div>' : '') +
      vidaHTML(p) +
      '</div>';
  }
  /* vida: cheia, só o número; ferida, a barra e quando volta inteira (a vida se recupera sozinha com o tempo) */
  function vidaHTML(p) {
    if (p.vidaMax == null || p.vida == null) return '';
    var v = Math.min(p.vidaMax, p.vida), f = v / p.vidaMax;
    if (f >= 0.999) return '<div class="info-linha"><span class="fraco">Vida</span><span>cheia · ' + RP.num(p.vidaMax) + '</span></div>';
    var cls = f > 0.6 ? 'barra-sucesso' : f > 0.3 ? 'barra-alerta' : 'barra-perigo';
    return '<div class="info-linha"><span class="fraco">Vida</span><span class="vida-folha"><span class="barra ' + cls + '" role="img" aria-label="Vida ' + Math.ceil(v) + ' de ' + p.vidaMax + '"><i style="width:' + (100 * f).toFixed(0) + '%"></i></span>' +
      '<span><b class="num">' + Math.ceil(v) + '</b> de ' + RP.num(p.vidaMax) + (p.vidaCheiaEm ? ' · inteira em <b class="num" data-fim="' + p.vidaCheiaEm + '">' + RP.fmtResta(p.vidaCheiaEm - RP.agora()) + '</b>' : '') + '</span></span></div>';
  }
  function nivelVeterania(marcas) {
    var v = RP.config.veterania, n = 0;
    (v.marcas || []).forEach(function (lim, i) { if (marcas + 1e-9 >= lim) n = i + 1; });
    return n ? 'nível ' + n + ' · +' + Math.round((v.bonus[n - 1] || 0) * 100) + '% · ' + marcas + ' marcas' : (marcas ? marcas + ' marca' + (marcas === 1 ? '' : 's') : 'recruta');
  }
  function acoesPessoa(f) {
    var p = f.pessoa, a = '';
    if (p.civil) {
      var pode = f.acoes && f.acoes.length;
      if (pode) a += '<button type="button" class="btn btn-p btn-primario" data-pessoa-trabalho="' + p.id + '">' + RP.icone('martelo') + 'Trocar trabalho</button>' +
        '<button type="button" class="btn btn-p" data-pessoa-levar="' + p.id + '">' + RP.icone('seta') + 'Levar para…</button>';
      if (RP.castelo()) a += '<a class="btn btn-p" href="#/recrutamento?local=' + RP.castelo().id + '">' + RP.icone('tropas') + 'Recrutar</a>';
      return a;
    }
    if (ehSoldado(p)) {
      var emMarcha = p.grupoId && p.grupoId > 0, livre = p.estado === 'guarnecida' || p.estado === 'marchando';
      if (livre) a += '<button type="button" class="btn btn-p btn-primario" data-pessoa-missao="' + p.id + '">' + RP.icone('alvo') + 'Missão</button>' +
        '<button type="button" class="btn btn-p" data-pessoa-grupo="' + p.id + '">' + RP.icone('tropas') + 'Selecionar o grupo</button>';
      if (emMarcha) a += '<button type="button" class="btn btn-p" data-exercito-voltar="' + p.grupoId + '">' + RP.icone('voltar') + 'Voltar</button>';
      if (livre) a += '<button type="button" class="btn btn-p" data-pessoa-tipo="' + p.id + '">' + RP.icone('populacao') + 'Todos deste tipo aqui</button>';
      if (p.hex != null) a += '<a class="btn btn-p" href="#/mapa?centro=' + p.hex + '">' + RP.icone('mapa') + 'Ver no mapa</a>';
      return a;
    }
    if (p.hex != null) a += '<a class="btn btn-p" href="#/mapa?centro=' + p.hex + '">' + RP.icone('mapa') + 'Ver no mapa</a>';
    if (/^explorador|^prospector|^batedor/.test(p.oficio)) a += '<a class="btn btn-p btn-primario" href="#/exploradores">' + RP.icone('explorador') + 'Exploradores</a>';
    return a;
  }
  RP.folhaPessoa = function (id) {
    RP.tentar(RP.get('/pessoas/' + id)).then(function (f) {
      var p = f.pessoa;
      RP.abrirFolha({
        titulo: RP.esc(p.nome),
        subtitulo: '<span class="fraco">' + RP.esc(p.oficioNome) + ' · ' + RP.esc(ESTADOS[p.estado] || p.estado) + '</span>',
        icone: '<span class="ico-placa folha-ico dono-meu">' + RP.icone(icone(p)) + '</span>',
        corpo: corpoPessoa(f), acoes: acoesPessoa(f)
      });
      RP.folhaPessoa.atual = f;
    });
  };

  /* trocar trabalho: os locais com vaga, do mais necessário ao menos; "sem trabalho" no castelo */
  function folhaTrabalho(f) {
    var p = f.pessoa, ts = f.trabalhos || [];
    RP.abrirFolha({
      titulo: 'Trabalho de ' + RP.esc(p.nome),
      subtitulo: '<span class="fraco">Da vaga mais necessária à menos. Ela caminha até lá.</span>',
      icone: '<span class="ico-placa folha-ico dono-meu">' + RP.icone('martelo') + '</span>',
      corpo: ts.length ? '<div class="lista">' + ts.map(function (t) {
        return '<button type="button" class="lista-item' + (t.atual ? ' atual' : '') + '" data-pessoa-ir="' + p.id + '" data-pessoa-local="' + t.localId + '" data-oficio="' + RP.esc(t.oficio) + '">' +
          '<span class="ico-placa">' + RP.icone(ICONE[t.oficio] || 'populacao') + '</span><div style="flex:1"><b>' + RP.esc(t.oficioNome) + '</b><div class="fraco">' + RP.esc(t.nome) +
          (t.vagas ? ' · ' + t.livres + ' de ' + t.vagas + (t.vagas === 1 ? ' vaga livre' : ' vagas livres') : ' · sem trabalho') + (t.atual ? ' · aqui' : '') + '</div></div>' + RP.icone('avancar', 'ico-p') + '</button>';
      }).join('') + '</div>' : '<p class="fraco">Nenhuma vaga livre: melhore um local ou funde outro.</p>',
      acoes: '<button type="button" class="btn btn-p btn-fantasma" data-pessoa-abrir="' + p.id + '">' + RP.icone('voltar') + 'Voltar</button>'
    });
  }
  /* levar para outro local: toma uma vaga lá se houver, senão fica sem trabalho */
  function folhaLevar(f) {
    var p = f.pessoa, ls = ((RP.reino && RP.reino.locais) || []).filter(function (l) { return !l.ruina; });
    RP.abrirFolha({
      titulo: 'Levar ' + RP.esc(p.nome) + ' para…',
      subtitulo: '<span class="fraco">Toma uma vaga lá se houver; senão fica sem trabalho.</span>',
      icone: '<span class="ico-placa folha-ico dono-meu">' + RP.icone('seta') + '</span>',
      corpo: '<div class="lista">' + ls.map(function (l) {
        return '<button type="button" class="lista-item' + (l.id === p.localId ? ' atual' : '') + '" data-pessoa-mover="' + p.id + '" data-pessoa-local="' + l.id + '">' +
          '<span class="ico-placa dono-meu">' + RP.icone(RP.iconeLocal(l)) + '</span><div style="flex:1"><b>' + RP.esc(l.nome) + '</b><div class="fraco">' +
          (l.vagas ? l.ocupadas + ' de ' + l.vagas + ' vaga' + (l.vagas === 1 ? '' : 's') + ' ocupada' + (l.ocupadas === 1 ? '' : 's') : 'sem vagas de trabalho') + ' · ' + (l.pessoas || 0) + (l.pessoas === 1 ? ' pessoa' : ' pessoas') + (l.id === p.localId ? ' · está aqui' : '') + '</div></div>' + RP.icone('avancar', 'ico-p') + '</button>';
      }).join('') + '</div>',
      acoes: '<button type="button" class="btn btn-p btn-fantasma" data-pessoa-abrir="' + p.id + '">' + RP.icone('voltar') + 'Voltar</button>'
    });
  }
  function depoisDeMudar(f, titulo) {
    var p = f.pessoa;
    RP.aviso({ titulo: titulo, texto: RP.esc(p.texto || ''), icone: 'check', tipo: 'sucesso' });
    RP.fecharFolha(); recarregarMapa(); RP.recarregarReino();
    if (RP.telaAtual() === 'pessoas') carregarLista();
  }

  document.addEventListener('click', function (e) {
    var b, f = RP.folhaPessoa.atual;
    if ((b = e.target.closest('[data-pessoa-abrir]'))) { RP.folhaPessoa(+b.getAttribute('data-pessoa-abrir')); return; }
    if ((b = e.target.closest('[data-pessoa-trabalho]')) && f) { folhaTrabalho(f); return; }
    if ((b = e.target.closest('[data-pessoa-levar]')) && f) { folhaLevar(f); return; }
    if ((b = e.target.closest('[data-pessoa-ir]'))) {
      var id = +b.getAttribute('data-pessoa-ir');
      RP.tentar(RP.post('/pessoas/' + id + '/trabalho', { localId: +b.getAttribute('data-pessoa-local'), oficio: b.getAttribute('data-oficio') })).then(function (r) { depoisDeMudar(r, r.pessoa.nome + ' vai trabalhar'); });
      return;
    }
    if ((b = e.target.closest('[data-pessoa-mover]'))) {
      var id2 = +b.getAttribute('data-pessoa-mover');
      RP.tentar(RP.post('/pessoas/' + id2 + '/mover', { localId: +b.getAttribute('data-pessoa-local') })).then(function (r) { depoisDeMudar(r, r.pessoa.nome + ' a caminho'); });
      return;
    }
    if ((b = e.target.closest('[data-pessoa-missao]'))) {
      RP.selecao.definir([+b.getAttribute('data-pessoa-missao')]);
      RP.fecharFolha();
      if (RP.telaAtual() !== 'mapa') { RP.ir('mapa'); setTimeout(function () { RP.selecao.missao(); }, 300); } else RP.selecao.missao();
      return;
    }
    if ((b = e.target.closest('[data-pessoa-grupo]')) || (b = e.target.closest('[data-pessoa-tipo]'))) {
      var pid = +(b.getAttribute('data-pessoa-grupo') || b.getAttribute('data-pessoa-tipo')), soTipo = b.hasAttribute('data-pessoa-tipo');
      var p = M.pessoa(pid) || (f && f.pessoa);
      if (!p) return;
      var ids = companheiros(p, soTipo);
      RP.selecao.definir(ids);
      RP.fecharFolha();
      if (RP.telaAtual() !== 'mapa') RP.ir('mapa' + (p.hex != null ? '?centro=' + p.hex : ''));
      RP.aviso({ titulo: ids.length + (ids.length === 1 ? ' selecionado' : ' selecionados'), texto: 'Toque em Missão na barra para dar a ordem.', icone: 'populacao', ms: 2600 });
      return;
    }
  });
  /* soldados no mesmo lugar que p (mesma guarnição ou mesmo exército), só do mesmo tipo se pedido */
  function companheiros(p, soTipo) {
    var todos = (M.dados && M.dados.pessoas) || [];
    return todos.filter(function (x) {
      if (!ehSoldado(x) || (soTipo && x.oficio !== p.oficio)) return false;
      if (p.grupoId && p.grupoId > 0) return x.grupoId === p.grupoId;
      return x.localId === p.localId && x.estado === 'guarnecida';
    }).map(function (x) { return x.id; });
  }

  /* ---------------------------------------------------------------- folha do hexágono: quem está nele (pilha) */
  RP.folhaPessoasDoHex = function (h) {
    var lista = ((M.dados && M.dados.pessoasPorHex) || {})[h] || [];
    var l = RP.reino && (RP.reino.locais || []).filter(function (x) { return x.hex === h; })[0];
    RP.abrirFolha({
      titulo: 'Pessoas em ' + RP.esc(l ? l.nome : 'hexágono ' + RP.hex.c(h) + ', ' + RP.hex.l(h)),
      subtitulo: '<span class="fraco">' + lista.length + (lista.length === 1 ? ' pessoa' : ' pessoas') + '</span>',
      icone: '<span class="ico-placa folha-ico dono-meu">' + RP.icone('populacao') + '</span>',
      corpo: '<div class="lista pessoas-lista">' + lista.map(linhaPessoa).join('') + '</div>',
      acoes: (lista.some(ehSoldado) ? '<button type="button" class="btn btn-p btn-primario" data-pessoa-grupo="' + lista.filter(ehSoldado)[0].id + '">' + RP.icone('tropas') + 'Selecionar os soldados</button>' : '') +
        (l ? '<a class="btn btn-p" href="#/pessoas?local=' + l.id + '">' + RP.icone('populacao') + 'Pessoas</a>' : '')
    });
  };
  function linhaPessoa(p) {
    var sel = RP.selecao && RP.selecao.tem(p.id);
    return '<button type="button" class="lista-item pessoa-item' + (sel ? ' selecionada' : '') + '" data-pessoa-abrir="' + p.id + '">' +
      '<span class="ico-placa' + (ehSoldado(p) ? ' dono-meu' : '') + '">' + RP.icone(icone(p)) + '</span><div style="flex:1;min-width:0"><b>' + RP.esc(p.nome) + '</b><div class="fraco">' +
      RP.esc(p.oficioNome || nomeOficio(p)) + ' · ' + RP.esc(ESTADOS[p.estado] || p.estado) + (p.local ? ' · ' + RP.esc(p.local) : '') + '</div></div>' + RP.icone('avancar', 'ico-p') + '</button>';
  }
  var NOMES = { ocioso: 'Sem ofício', agricultor: 'Agricultor', lenhador: 'Lenhador', pedreiro: 'Pedreiro', mineiro: 'Mineiro', mensageiro: 'Mensageiro', 'explorador-pe': 'Explorador', 'explorador-cavalo': 'Explorador a cavalo', prospector: 'Prospector', batedor: 'Batedor' };
  function nomeOficio(p) { return NOMES[p.oficio] || (RP.unidade && RP.unidade(p.oficio) ? RP.unidade(p.oficio).nome : p.oficio); }

  /* ---------------------------------------------------------------- tela Pessoas */
  var tela = null, dados = null, filtro = { oficio: '', local: '' };
  function carregarLista() {
    return RP.get('/reino/pessoas').then(function (d) { dados = d; desenhar(); }, function () { /* aviso já mostrado */ });
  }
  function desenhar() {
    if (!tela || !dados) return;
    var corpo = RP.$('.pessoas-conteudo', tela), ps = dados.pessoas;
    var oficios = {}; ps.forEach(function (p) { oficios[p.oficio] = (oficios[p.oficio] || 0) + 1; });
    var lista = ps.filter(function (p) { return (!filtro.oficio || p.oficio === filtro.oficio) && (!filtro.local || String(p.localId) === filtro.local); });
    corpo.innerHTML =
      '<div class="card linha-entre"><span>' + RP.icone('populacao', 'ico-p') + ' <b>' + dados.pop + '</b> civis + <b>' + dados.tropas + '</b> tropas de <b>' + dados.teto + '</b> moradores</span></div>' +
      '<div class="abas abas-rolagem" role="group" aria-label="Ofício">' + ['<button type="button" class="aba" data-f-oficio="" aria-pressed="' + !filtro.oficio + '">Todos (' + ps.length + ')</button>'].concat(Object.keys(oficios).sort().map(function (o) {
        return '<button type="button" class="aba" data-f-oficio="' + RP.esc(o) + '" aria-pressed="' + (filtro.oficio === o) + '">' + RP.esc(NOMES[o] || nomeOficio({ oficio: o })) + ' (' + oficios[o] + ')</button>';
      })).join('') + '</div>' +
      '<select class="campo pessoas-local" data-f-local aria-label="Local"><option value="">Todos os locais</option>' + dados.locais.map(function (l) {
        return '<option value="' + l.id + '"' + (filtro.local === String(l.id) ? ' selected' : '') + '>' + RP.esc(l.nome) + (l.vagas ? ' · ' + l.ocupadas + '/' + l.vagas + ' vagas' : '') + ' · ' + l.presentes + '</option>';
      }).join('') + '</select>' +
      (lista.length ? '<div class="lista pessoas-lista">' + lista.map(linhaPessoa).join('') + '</div>' : '<p class="fraco">Ninguém com esse filtro.</p>');
  }
  RP.registrarTela('pessoas', {
    secao: 'reino',
    montar: function (el) {
      tela = el;
      el.innerHTML = RP.topoVoltar('Pessoas', 'reino', 'Toque numa pessoa para ver o que faz e dar trabalho ou missão') + '<div class="conteudo-tela pilha pessoas-conteudo"></div>';
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-f-oficio]');
        if (b) { filtro.oficio = b.getAttribute('data-f-oficio'); desenhar(); }
      });
      el.addEventListener('change', function (e) { if (e.target.matches('[data-f-local]')) { filtro.local = e.target.value; desenhar(); } });
      RP.ouvir('reino', function () { if (tela && !tela.hidden) carregarLista(); });
    },
    entrar: function (el, p) {
      filtro.local = p.get('local') || '';
      if (p.get('oficio')) filtro.oficio = p.get('oficio');
      carregarLista();
    }
  });
  RP.itensMais = RP.itensMais || [];
  RP.itensMais.push({ icone: 'populacao', titulo: 'Pessoas', texto: 'Quem é quem no reino: trabalho, treino, missão', href: '#/pessoas' });
  RP.acoesFolhaLocal = RP.acoesFolhaLocal || [];
  RP.acoesFolhaLocal.push(function (l) { return '<a class="btn btn-p" href="#/pessoas?local=' + l.id + '">' + RP.icone('populacao') + 'Pessoas</a>'; });
})();
