/* Reino de Pedra — Extração de recursos descobertos e escavação de ruínas antigas (#/extracao?hex=<hex>).
   Porte de prototipo/js/militar.js (Extração) com dados reais: GET /extracao, POST /extracao/previa, POST /extracao,
   POST /postos. Também as ordens "Extrair" e "Escavar" no envio pelo mapa. */
(function () {
  'use strict';
  var RP = window.RP, V = RP.valiosos;

  var ext = { hex: null, de: null, grupo: {}, repetir: false, posto: false, destino: null, seguro: false, previa: null, dados: null };
  var tela = null;

  function alvos() {
    var d = ext.dados; if (!d) return [];
    return d.jazidas.filter(function (j) { return j.restante > 0; }).map(function (j) { return { hex: j.hex, tipo: 'jazida', j: j }; })
      .concat(d.ruinas.filter(function (r) { return !r.esgotada; }).map(function (r) { return { hex: r.hex, tipo: 'ruina', r: r }; }));
  }
  function alvo() { return alvos().filter(function (a) { return a.hex === ext.hex; })[0]; }
  function idadeTxt(min) { return !min ? 'visível' : 'visto ' + RP.fmtHa(min / 60); }
  function grupoAtual() { var g = {}; Object.keys(ext.grupo).forEach(function (k) { if (ext.grupo[k] > 0) g[k] = ext.grupo[k]; }); return g; }

  function carregar() {
    return Promise.all([RP.get('/extracao'), RP.carregarTropas()]).then(function (x) {
      ext.dados = x[0]; RP.sincronizar(x[0].agora);
      var a = alvos();
      if (!a.some(function (y) { return y.hex === ext.hex; })) ext.hex = a.length ? a[0].hex : null;
      var bases = V.locaisComTropas();
      var posto = bases.filter(function (l) { return l.hex === ext.hex; })[0];
      if (posto) ext.de = posto.id;
      if (!ext.de || !bases.some(function (l) { return l.id === ext.de; })) ext.de = bases.length ? (bases.filter(function (l) { return l.tipo === 'castelo'; })[0] || bases[0]).id : null;
      ajustarGrupo();
    });
  }
  function ajustarGrupo() {
    var disp = V.guarnicao(ext.de);
    Object.keys(ext.grupo).forEach(function (k) { ext.grupo[k] = Math.min(ext.grupo[k] || 0, disp[k] || 0); });
    if (!RP.somaGrupo(ext.grupo)) {
      var k0 = Object.keys(disp).filter(function (k) { return disp[k] > 0 && (RP.unidade(k) || {}).carga > 0; })[0] || Object.keys(disp).filter(function (k) { return disp[k] > 0; })[0];
      if (k0) { ext.grupo = {}; ext.grupo[k0] = 1; }
    }
  }

  var pedirPrevia = V.debounce(function () {
    var g = grupoAtual();
    if (!ext.de || ext.hex == null || !RP.somaGrupo(g)) { ext.previa = null; desenhar(); return; }
    var chave = ext.de + '|' + ext.hex + '|' + JSON.stringify(g);
    RP.post('/extracao/previa', { deLocalId: ext.de, tropas: g, hex: ext.hex }).then(function (p) {
      if (chave !== ext.de + '|' + ext.hex + '|' + JSON.stringify(grupoAtual())) return;
      ext.previa = p;
      if (p.tipo === 'escavacao' && (!ext.destino || !p.destinos.some(function (x) { return x.id === ext.destino; }))) ext.destino = RP.reino.casteloId;
      desenhar();
    }, function (e) { ext.previa = { erro: e.message }; desenhar(); });
  }, 200);

  function grupoCard(g) {
    var dados = ext.dados, j = g.jazidaId && dados.jazidas.filter(function (x) { return x.id === g.jazidaId; })[0];
    var titulo = g.estado === 'extraindo' ? 'Extraindo ' + RP.nomeRecurso(j ? j.recurso : '') : g.estado === 'escavando' ? 'Escavando a ruína' : g.estado === 'entregando' ? 'Levando a carga a ' + (g.deposito || 'um depósito') : g.ordem === 'escavar' ? 'A caminho da ruína' : 'A caminho da jazida';
    var tempo = g.estado === 'escavando' && g.escavaFim ? RP.barraTempo(g.escavaInicio, g.escavaFim, { classe: 'curta', cor: 'sucesso', rotulo: 'Escavação' }) + '<small class="fraco">relíquia</small>'
      : g.estado === 'extraindo' && g.cheiaEm ? RP.barraTempo(g.extraiInicio, g.cheiaEm, { classe: 'curta', cor: 'sucesso', rotulo: 'Extração' }) + '<small class="fraco">carga cheia</small>'
      : g.chegada ? RP.barraTempo(g.partida, g.chegada, { classe: 'curta', rotulo: 'Marcha' }) + '<small class="fraco">chega</small>' : '';
    var carga = Object.keys(g.carga || {}).map(function (k) { return RP.num(g.carga[k]) + ' de ' + RP.nomeRecurso(k); }).join(', ');
    return '<div class="card emcampo"><span class="ico-placa dono-meu">' + RP.icone('picareta') + '</span>' +
      '<span class="emcampo-corpo"><b>' + RP.esc(titulo) + '</b><small class="fraco">' + RP.esc(g.resumo) + (g.repetir ? ' · repete' : '') + '</small>' +
      (g.ritmo ? '<small class="fraco">' + V.fmtRitmo(g.ritmo) + '/h · carga ' + RP.esc(carga || '0') + ' de ' + RP.num(g.cargaMax) + '</small>' : carga ? '<small class="fraco">Levam ' + RP.esc(carga) + '</small>' : '') +
      '<span class="exercito-acoes">' + (g.estado !== 'entregando' ? '<button type="button" class="btn btn-p" data-ext-voltar="' + g.id + '">' + RP.icone('voltar') + 'Voltar</button>' : '') +
      '<a class="btn btn-p btn-fantasma" href="#/mapa?foco=' + g.hex + '">' + RP.icone('mapa') + 'Ver</a></span></span>' +
      '<span class="emcampo-tempo">' + tempo + '</span></div>';
  }

  function desenhar() {
    var el = tela; if (!el || el.hidden) return;
    var d = ext.dados, cont = RP.$('.ext-conteudo', el);
    if (!d) { cont.innerHTML = '<p class="fraco">Carregando…</p>'; return; }
    var a = alvo(), escav = a && a.tipo === 'ruina', p = ext.previa, g = grupoAtual(), n = RP.somaGrupo(g);
    RP.$('.topo h1', el).textContent = escav ? 'Escavação de ruína' : 'Extração de recurso';
    var lista = alvos();
    var h = '<div class="nota-regra">' + RP.icone(escav ? 'lendario' : 'info', 'ico-p') + (escav
      ? '<span><b>Escavação.</b> Ruínas antigas guardam <b>1 relíquia</b>. Escavar é lento e esgota a ruína; o tipo da relíquia só se conhece ao achar. Uma única unidade já escava.</span></div>' +
        '<div class="secao-titulo">Escavar pode render</div><div class="card">' + RP.ganhosRuina(d.reliquiaTipos) + '</div>'
      : '<span><b>Nada é obrigatório.</b> Uma única unidade sem preparo já extrai. Mais tropas, unidades com mais carga, posto e rota só aumentam o rendimento.</span></div>');
    h += '<div class="secao-titulo">Jazidas e ruínas</div>' + (lista.length ? '<div class="escolhas escolhas-lista">' + lista.map(function (x) {
      var ativo = x.hex === ext.hex, sel = ' data-ext-hex="' + x.hex + '" aria-pressed="' + ativo + '"';
      if (x.tipo === 'ruina') return '<button type="button" class="escolha escolha-linha"' + sel + '><span class="ico-placa">' + RP.icone('ruina', 'r-lendario') + '</span>' +
        '<span class="escolha-txt"><b>Ruína antiga</b><small class="fraco">Escavação · ' + RP.esc(RP.ganhosRuina(d.reliquiaTipos, true)) + ' · ' + idadeTxt(x.r.idadeMin) + (x.r.posto === 'meu' ? ' · com posto' : '') + '</small></span></button>';
      var j = x.j;
      return '<button type="button" class="escolha escolha-linha"' + sel + '><span class="ico-placa">' + RP.icone(j.recurso, 'r-' + j.recurso) + '</span>' +
        '<span class="escolha-txt"><b>' + RP.esc(j.nome) + '</b><small class="fraco">' + (j.lendaria ? 'Lendário · ' : '') + RP.num(j.restante) + ' restantes · vale ' + j.valor + ' · ' + idadeTxt(j.idadeMin) +
        (j.posto === 'meu' ? ' · com posto' : j.posto === 'outro' ? ' · posto de outro reino' : '') + '</small></span>' +
        (j.tropas ? '<span class="selo selo-visivel">' + j.tropas + ' extraindo</span>' : '') + '</button>';
    }).join('') + '</div>' : '<p class="fraco">Nenhuma jazida descoberta nem ruína antiga conhecida. Prospectores revelam jazidas valiosas; ruínas aparecem ao explorar.</p>');
    var meus = d.grupos;
    if (meus.length) h += '<div class="secao-titulo">Em andamento</div><div class="pilha">' + meus.map(grupoCard).join('') + '</div>';
    if (a) {
      var bases = V.locaisComTropas(), disp = V.guarnicao(ext.de), postoEstado = a.tipo === 'jazida' ? a.j.posto : a.r.posto;
      h += '<div class="secao-titulo">Grupo</div><div class="card pilha">' +
        (bases.length > 1 ? '<div class="abas abas-rolagem" role="group" aria-label="De onde saem">' + bases.map(function (l) {
          return '<button type="button" class="aba" data-ext-de="' + l.id + '" aria-pressed="' + (l.id === ext.de) + '">' + RP.esc(l.nome) + '</button>';
        }).join('') + '</div>' : '') +
        (bases.length ? '<div data-ext-grupo>' + RP.grupoTropas.linhas(ext.grupo, disp) + '</div>' : '<p class="fraco">Nenhuma tropa nos locais. Recrute no castelo ou no quartel.</p>') +
        (!escav ? '<button type="button" class="alternar" data-ext-repetir aria-pressed="' + ext.repetir + '" style="width:100%">' + RP.icone('relogio') + '<span>Repetir <small class="fraco">(volta à jazida depois de entregar)</small></span><i aria-hidden="true"></i></button>' : '') +
        (!postoEstado ? '<button type="button" class="alternar" data-ext-posto aria-pressed="' + ext.posto + '" style="width:100%">' + RP.icone('picareta') + '<span>Construir posto de ' + (escav ? 'escavação' : 'extração') + ' <small class="fraco">(' + RP.fmtDuracao(d.posto.seg) + ')</small></span><i aria-hidden="true"></i></button>' +
          (ext.posto ? '<div class="linha" style="flex-wrap:wrap">' + RP.custoHTML(d.posto.custo) + '<small class="fraco">entra na fila de obras; o material vai até a jazida a pé</small></div>' : '')
          : postoEstado === 'fila' ? '<p class="fraco">' + RP.icone('martelo', 'ico-p') + 'Posto na fila de obras.</p>'
          : postoEstado === 'meu' ? '<p class="fraco">' + RP.icone('check', 'ico-p') + 'Com posto: rende mais.</p>' : '') + '</div>';
      if (p && p.erro) h += '<p class="nota-antiga">' + RP.icone('alerta', 'ico-p') + '<span>' + RP.esc(p.erro) + '</span></p>';
      else if (p && p.tipo === 'escavacao' && escav) {
        h += '<div class="secao-titulo">Ao achar, levar para</div><div class="escolhas escolhas-lista">' + p.destinos.slice(0, 5).map(function (x) {
          var l = RP.local(x.id) || x;
          return '<button type="button" class="escolha escolha-linha" data-ext-destino="' + x.id + '" aria-pressed="' + (x.id === ext.destino) + '"><span class="ico-placa dono-meu">' + RP.icone(RP.iconeLocal(l)) + '</span>' +
            '<span class="escolha-txt"><b>' + RP.esc(x.nome) + '</b><small class="fraco">volta em ' + V.fmtMin(x.min) + (x.n ? ' · já tem ' + x.n + ' relíquia' + (x.n > 1 ? 's' : '') : '') + '</small></span></button>';
        }).join('') + '</div><p class="fraco" style="font-size:var(--fs-2);margin-top:var(--esp-2)">A relíquia não vai sozinha: o próprio grupo a carrega até lá e, no caminho, ela pode ser roubada.' + (p.poucoProtegida ? ' Grupo pequeno, escolta fraca.' : '') + '</p>' +
          '<div class="secao-titulo">Quanto cada escolha encurta a escavação</div><div class="card">' + V.grafico(p.cenarios.map(function (c) { return { nome: c.nome, v: c.v, atual: c.atual && !ext.posto || (ext.posto && /posto/.test(c.nome)) }; }), function (v) { return '≈ ' + V.fmtHoras(v); }, 'Horas até achar a relíquia') +
          '<div class="ext-numeros"><div><span class="fraco">Escavação</span><b class="num">≈ ' + V.fmtHoras(ext.posto ? p.cenarios[2].v : p.horas) + '</b></div><div><span class="fraco">Viagem</span><b class="num">' + V.fmtMin(V.min(V.escolhida(p.viagem, ext.seguro))) + '</b></div><div><span class="fraco">Rende</span><b class="num">1 relíquia</b></div></div>' +
          '<p class="fraco" style="font-size:var(--fs-2);margin-top:var(--esp-2)">Mais tropas e posto encurtam, mas escavar com cuidado leva no mínimo ' + V.fmtHoras(p.minimo) + '. Depois da relíquia, a ruína se esgota.</p></div>';
      } else if (p && p.tipo === 'extracao' && !escav) {
        var rit = ext.posto ? p.cenarios[2].v : p.ritmo, dur = rit ? p.restante / rit : null;
        h += '<div class="secao-titulo">Como cada escolha muda o rendimento</div><div class="card">' + V.grafico(p.cenarios.map(function (c) { return { nome: c.nome, v: c.v, atual: ext.posto ? /posto/.test(c.nome) : c.atual }; }), function (v) { return V.fmtRitmo(v) + '/h'; }, 'Comparação de rendimento por hora') +
          '<div class="ext-numeros"><div><span class="fraco">Ritmo</span><b class="num">' + V.fmtRitmo(rit) + '/h</b></div><div><span class="fraco">Em valor</span><b class="num">' + V.fmtRitmo(rit * p.valor) + '/h</b></div>' +
          '<div><span class="fraco">Jazida dura</span><b class="num">' + (dur ? '≈ ' + V.fmtHoras(dur) : '—') + '</b></div></div>' +
          '<p class="fraco" style="font-size:var(--fs-2);margin-top:var(--esp-2)">' + (p.rota ? 'O caminho até o depósito usa rota pública: +20% de rendimento.' : 'Sem rota pública no caminho até o depósito. Uma rota aumenta o rendimento.') +
          ' A carga enche em ≈ ' + V.fmtHoras(rit ? p.cargaMax / rit : null) + ' e vai para ' + RP.esc(p.deposito || 'o castelo') + '. O ritmo é medido em valor: ' + RP.esc(RP.nomeRecurso(p.recurso)) + ' vale ' + p.valor + (p.valor > 1 ? ' básicos, então sai mais devagar' : '') + '. Até ' + p.maxTropas + ' tropas por jazida' + (p.jaNaJazida ? ' (' + p.jaNaJazida + ' suas já estão lá)' : '') + '.</p></div>';
      }
      h += '<div class="secao-titulo">Caminho</div>' + (p && p.viagem ? V.caminhos(p.viagem, ext.seguro) : '<p class="fraco">Escolha ao menos uma unidade.</p>');
    }
    h += '<div style="height:var(--esp-6)"></div>';
    cont.innerHTML = h;
    var esc = p && p.viagem ? V.escolhida(p.viagem, ext.seguro) : null, ok = a && n && esc && esc.ok && !(p && p.erro);
    RP.$('.rodape-resumo', el).innerHTML = ok
      ? '<div class="resumo-linha"><b>' + RP.esc(RP.partesGrupo(g)) + ' → ' + (escav ? 'ruína antiga' : RP.esc(a.j.nome)) + '</b><span class="tempo">' + RP.icone('relogio', 'ico-p') + V.fmtMin(esc.min) + '</span></div>' +
        (escav && p.horas ? '<div class="resumo-linha fraco">depois ≈ ' + V.fmtHoras(ext.posto ? p.cenarios[2].v : p.horas) + ' escavando</div>' : '')
      : '<div class="resumo-linha fraco">' + (!a ? 'Escolha uma jazida ou ruína.' : !n ? 'Escolha ao menos uma unidade.' : p && p.erro ? RP.esc(p.erro) : 'Calculando…') + '</div>';
    var bt = RP.$('[data-extrair]', el);
    bt.innerHTML = RP.icone('picareta') + (escav ? 'Enviar para escavar' : 'Enviar para extrair');
    bt.classList.toggle('btn-inativo', !ok);
  }

  function enviar() {
    var a = alvo(), g = grupoAtual(), p = ext.previa;
    if (!a || !RP.somaGrupo(g) || !p || p.erro) { RP.aviso({ titulo: 'Escolha o grupo', texto: 'Uma unidade já basta.', icone: 'info', tipo: 'alerta' }); return; }
    var escav = a.tipo === 'ruina';
    var corpo = { deLocalId: ext.de, tropas: g, hex: a.hex, repetir: !escav && ext.repetir, seguro: !!ext.seguro, destinoLocalId: escav ? ext.destino : null };
    var antes = ext.posto ? RP.post('/postos', { hex: a.hex }).then(function () { return true; }, function (e) {
      RP.aviso({ titulo: 'Posto não construído', texto: e.message, icone: 'alerta', tipo: 'alerta' }); return false;
    }) : Promise.resolve(false);
    antes.then(function (comPosto) {
      return V.tentar(RP.post('/extracao', corpo)).then(function (gr) {
        var viagem = V.escolhida(p.viagem, ext.seguro);
        RP.aviso({ titulo: 'Grupo a caminho', texto: (gr.chegada ? 'Chega em ' + V.fmtMin(viagem && viagem.min) : 'Começou agora') + (escav ? ' e escava por ≈ ' + V.fmtHoras(p.horas) + '.' : ' e começa a extrair.') + (comPosto ? ' Posto na fila de obras.' : ''), icone: 'picareta', tipo: 'sucesso' });
        ext.grupo = {}; ext.posto = false; ext.previa = null;
        RP.recarregarReino(); RP.carregarTropas().catch(function () { /* offline */ });
        carregar().then(function () { desenhar(); pedirPrevia(); });
      });
    });
  }

  RP.registrarTela('extracao', {
    secao: 'tropas',
    montar: function (el) {
      tela = el;
      el.innerHTML = RP.topoVoltar('Extração de recurso', 'tropas') + '<div class="conteudo-tela ext-conteudo"></div>' +
        '<div class="rodape-acao rodape-com-resumo"><div class="rodape-resumo"></div><button type="button" class="btn btn-primario btn-bloco btn-grande" data-extrair>' + RP.icone('picareta') + 'Enviar para extrair</button></div>';
      var atualizar = V.debounce(function () { if (!el.hidden) carregar().then(desenhar, function () { /* offline */ }); }, 500);
      RP.ouvir('marchas', atualizar);
      el.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-ext-hex]'))) { ext.hex = +b.getAttribute('data-ext-hex'); ext.posto = false; ext.previa = null; desenhar(); pedirPrevia(); return; }
        if ((b = e.target.closest('[data-ext-de]'))) { ext.de = +b.getAttribute('data-ext-de'); ext.grupo = {}; ajustarGrupo(); ext.previa = null; desenhar(); pedirPrevia(); return; }
        if ((b = e.target.closest('[data-ext-destino]'))) { ext.destino = +b.getAttribute('data-ext-destino'); desenhar(); return; }
        if (e.target.closest('[data-ext-repetir]')) { ext.repetir = !ext.repetir; desenhar(); return; }
        if (e.target.closest('[data-ext-posto]')) { ext.posto = !ext.posto; desenhar(); return; }
        if ((b = e.target.closest('[data-caminho]'))) { ext.seguro = b.getAttribute('data-caminho') === 'segura'; desenhar(); return; }
        if (e.target.closest('[data-ext-grupo]') && RP.grupoTropas.clique(e, ext.grupo, V.guarnicao(ext.de))) { desenhar(); pedirPrevia(); return; }
        if ((b = e.target.closest('[data-ext-voltar]'))) {
          V.tentar(RP.post('/tropas/' + b.getAttribute('data-ext-voltar') + '/ordem', { ordem: 'retornar' })).then(function () {
            RP.aviso({ titulo: 'Tropas voltando', texto: 'Levam o que já tiraram.', icone: 'voltar', tipo: 'sucesso' });
            carregar().then(desenhar);
          });
          return;
        }
        if (e.target.closest('[data-extrair]')) enviar();
      });
    },
    entrar: function (el, params) {
      if (params.get('hex')) { ext.hex = +params.get('hex'); ext.previa = null; ext.posto = false; }
      desenhar();
      carregar().then(function () { desenhar(); pedirPrevia(); }, function () { /* aviso já mostrado */ });
    }
  });

  /* ---------------------------------------------------------------- mapa: ordens de envio e atalhos na folha do hexágono */
  function objs(h, d) { return (d && d.porHex && d.porHex[h]) || []; }
  function jazidaEm(h, d) { return objs(h, d).filter(function (o) { return o.tipo === 'jazida' && o.restante > 0; })[0]; }
  function ruinaEm(h, d) { return objs(h, d).filter(function (o) { return o.tipo === 'ruina-antiga' && !o.esgotada; })[0]; }
  RP.ordensEnvio.push({
    ordem: 'extrair', rotulo: 'Extrair aqui', verbo: 'Extrair', icone: 'picareta', titulo: 'Extrair',
    descricao: function () { return '<div class="info-linha"><span class="fraco">Ordem</span><span>Extraem até a carga encher e levam ao armazém ou castelo</span></div>'; },
    dados: function () { return { repetir: false }; },
    quando: function (h, d) { return !!jazidaEm(h, d); }
  });
  RP.ordensEnvio.push({
    ordem: 'escavar', rotulo: 'Escavar a ruína', verbo: 'Escavar', icone: 'picareta', titulo: 'Escavar',
    descricao: function () { return '<div class="info-linha"><span class="fraco">Ordem</span><span>Escavam até achar a relíquia e a levam ao castelo</span></div>'; },
    dados: function () { return { destinoLocalId: RP.reino.casteloId }; },
    quando: function (h, d) { return !!ruinaEm(h, d); }
  });
  /* na folha da jazida ou da ruína (tocada no mapa) */
  function acaoObjeto(tipo, rotulo, ok) {
    var tp = RP.mapa.tiposObjeto[tipo] = RP.mapa.tiposObjeto[tipo] || {}, antes = tp.acoes;
    tp.acoes = function (o, d) {
      return (antes ? antes(o, d) || '' : '') + (ok(o) && !(RP.envio && RP.envio.ativo()) ? '<a class="btn btn-p btn-primario" href="#/extracao?hex=' + o.hex + '">' + RP.icone('picareta') + rotulo + '</a>' : '');
    };
  }
  acaoObjeto('jazida', 'Extrair', function (o) { return o.restante > 0; });
  acaoObjeto('ruina-antiga', 'Escavar', function (o) { return !o.esgotada; });

  RP.acoesTropas.push({ href: '#/extracao', icone: 'picareta', titulo: 'Extração', texto: 'Jazidas descobertas e ruínas antigas' });
  RP.itensMais.push({ icone: 'picareta', titulo: 'Extração', texto: 'Jazidas descobertas, postos e escavação de ruínas', href: '#/extracao' });
  RP.FILTROS_RELATORIO.push(['extracao', 'Extração']);
})();
