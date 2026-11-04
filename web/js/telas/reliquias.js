/* Reino de Pedra — Relíquias lendárias (#/reliquias) e mover com escolta (#/transporte?rel=<id>).
   Porte de prototipo/js/reliquias.js com dados reais (GET /reliquias, POST /reliquias/{id}/previa e /mover).
   No mapa: relíquias guardadas nos seus locais (pedestal), baú nas marchas que levam relíquia, brilho e farol. */
(function () {
  'use strict';
  var RP = window.RP, V = RP.valiosos;

  var TIPOS = {
    ataque: { nome: 'Ataque', icone: 'tropas', txt: 'Tropas que saem do local atacam mais forte.' },
    producao: { nome: 'Produção', icone: 'martelo', txt: 'O local produz mais.' },
    resistencia: { nome: 'Resistência', icone: 'escudo', txt: 'O local se defende melhor.' }
  };
  RP.RELIQUIA = TIPOS;
  var dados = null, tela = null;

  function seloTipo(t) { var x = TIPOS[t] || { nome: t, icone: 'lendario' }; return '<span class="selo selo-relq tipo-' + t + '">' + RP.icone(x.icone) + x.nome + '</span>'; }
  function cabRel(r, extra) {
    return '<div class="linha"><span class="relq-ico">' + RP.icone('lendario') + '</span><span style="flex:1;min-width:0"><b>' + RP.esc(r.nome) + '</b><br>' + seloTipo(r.tipo) + '</span>' + (extra || '') + '</div>' +
      '<p class="relq-efeito">' + RP.icone('subir', 'ico-p') + RP.esc(r.efeito) + '</p>';
  }
  function nivelPor(n) { return !dados ? null : n >= dados.farol ? 'farol' : n >= dados.brilho ? 'brilho' : null; }
  RP.TEXTO_CONC = { brilho: 'Brilha: quem já explorou a área vê que há relíquias aqui.', farol: 'Farol: visível para todos os reinos, até na névoa.' };

  function cartaoMinha(r) {
    var corpo;
    if (r.estado === 'levada' && r.marcha) corpo = '<p class="nota-antiga">' + RP.icone('tropas', 'ico-p') + '<span>Sendo levada' + (r.marcha.destino ? ' a ' + RP.esc(r.marcha.destino) : '') + ' por ' + RP.esc(r.marcha.tropas) + ' · chega ' + RP.barraTempo(r.marcha.partida, r.marcha.chegada, { classe: 'curta', rotulo: 'Relíquia a caminho' }) + '. Pode ser roubada no caminho.</span></p>';
    else if (r.estado === 'buscando' && r.escolta) corpo = '<p class="nota-antiga">' + RP.icone('tropas', 'ico-p') + '<span>Escolta a caminho de ' + RP.esc(r.local ? r.local.nome : '') + ' para buscar · chega ' + RP.barraTempo(r.escolta.partida, r.escolta.coleta, { classe: 'curta', rotulo: 'Escolta a caminho' }) + '. Depois leva a ' + RP.esc(r.escolta.destino || '') + '. Até lá, continua fortalecendo o local.</span></p>';
    else corpo = '<p class="fraco" style="font-size:var(--fs-2)">Guardada em <b style="color:var(--cor-texto)">' + RP.esc(r.local ? r.local.nome : '—') + '</b>' + (r.local && r.local.n > 1 ? ' · ' + r.local.n + ' relíquias juntas' : '') + '</p>';
    var hex = r.marcha ? null : r.local && r.local.hex;
    return '<div class="card relq-card tipo-' + r.tipo + '">' + cabRel(r) + corpo + '<small class="fraco">' + RP.esc(r.origem) + '</small>' +
      '<div class="linha relq-acoes">' + (r.estado === 'guardada' ? '<a class="btn btn-p" href="#/transporte?rel=' + r.id + '">' + RP.icone('seta') + 'Mover</a>' : '') +
      (hex != null ? '<a class="btn btn-p btn-fantasma" href="#/mapa?modo=cena&centro=' + hex + '">' + RP.icone('vista') + 'Ver na Vista</a>' : '') +
      (r.marcha ? '<a class="btn btn-p btn-fantasma" href="#/mapa?centro=' + r.marcha.destinoHex + '">' + RP.icone('mapa') + 'Ver no mapa</a>' : '') + '</div></div>';
  }
  function cartaoAVista(x) {
    var espionar = RP.telas.exploradores ? '<a class="btn btn-p btn-primario" href="#/exploradores?tipo=batedor&alvo=' + x.c + ',' + x.l + '">' + RP.icone('batedor') + 'Espionar</a>' : '';
    return '<div class="card relq-card"><div class="linha"><span class="relq-ico">' + RP.icone('lendario') + '</span><span style="flex:1;min-width:0"><b>' + x.n + ' relíquias juntas</b><br><small class="fraco">' + RP.esc(x.nome) + ' · dono desconhecido · tipos desconhecidos</small></span><span class="selo selo-destaque">' + (x.nivel === 'farol' ? 'Farol' : 'Brilho') + '</span></div>' +
      '<p class="fraco" style="font-size:var(--fs-2)">' + RP.TEXTO_CONC[x.nivel] + ' Espione para saber de quem são e o que fazem.</p>' +
      '<div class="linha relq-acoes">' + espionar + '<a class="btn btn-p btn-fantasma" href="#/mapa?foco=' + x.hex + '">' + RP.icone('mapa') + 'Ver no mapa</a></div></div>';
  }
  function cartaoConhecida(r) {
    return '<div class="card relq-card tipo-' + (r.tipo || '') + '">' + cabRel({ nome: r.nome || 'Relíquia', tipo: r.tipo || 'desconhecido', efeito: r.efeito || '' }) +
      '<p class="fraco" style="font-size:var(--fs-2)">' + RP.esc(r.onde || '') + (r.espionadaEm ? ' · espionado ' + RP.fmtHa((RP.agora() - r.espionadaEm) / 3600000) : '') + '</p></div>';
  }
  function cartaoRuina(ru) {
    var g = ru.escavando;
    return '<div class="card relq-card"><div class="linha"><span class="ico-placa">' + RP.icone('ruina', 'r-lendario') + '</span><span style="flex:1"><b>Ruína antiga</b><br><small class="fraco">' +
      (ru.esgotada ? 'Já escavada' : 'Guarda 1 relíquia · tipo só se conhece ao achar') + ' · ' + (ru.idadeMin ? 'visto ' + RP.fmtHa(ru.idadeMin / 60) : 'visível') + (ru.posto === 'meu' ? ' · com posto' : '') + '</small></span></div>' +
      (g ? '<p class="nota-antiga">' + RP.icone('picareta', 'ico-p') + '<span>' + (g.fim ? 'Escavação em andamento · relíquia encontrada ' + RP.barraTempo(g.inicio, g.fim, { classe: 'curta', cor: 'sucesso', rotulo: 'Escavação' })
        : 'Grupo a caminho · chega ' + RP.barraTempo(g.partida, g.chegada, { classe: 'curta', rotulo: 'Marcha até a ruína' })) + ' · ' + RP.esc(g.tropas) + (g.destino ? '. A relíquia vai para ' + RP.esc(g.destino) : '') + '.</span></p>'
        : ru.esgotada ? '' : '<div class="linha relq-acoes"><a class="btn btn-p btn-primario" href="#/extracao?hex=' + ru.hex + '">' + RP.icone('picareta') + 'Escavar</a><a class="btn btn-p btn-fantasma" href="#/mapa?foco=' + ru.hex + '">' + RP.icone('mapa') + 'Ver</a></div>') + '</div>';
  }

  function desenhar() {
    var el = tela; if (!el || el.hidden) return;
    var c = RP.$('.relq-conteudo', el);
    if (!dados) { c.innerHTML = '<p class="fraco">Carregando…</p>'; return; }
    var d = dados;
    c.innerHTML = '<div class="nota-regra">' + RP.icone('lendario', 'ico-p') + '<span>Há <b>uma relíquia para cada reino</b> do mundo. Guarde-a num local para fortalecê-lo. Relíquias <b>não andam sozinhas</b>: tropas as carregam, e no caminho podem ser <b>roubadas</b>. Só a <b>espionagem</b> revela onde estão as dos outros.</span></div>' +
      '<div class="ext-numeros"><div><span class="fraco">Com você</span><b class="num">' + d.minhas.length + '</b></div><div><span class="fraco">Conhecidas</span><b class="num">' + d.conhecidas.length + '</b></div><div><span class="fraco">No mundo</span><b class="num">' + RP.num(d.noMundo) + '</b></div></div>' +
      '<div class="relq-tipos">' + Object.keys(TIPOS).map(function (k) {
        var t = d.tipos[k] || {};
        return '<div class="relq-tipo tipo-' + k + '">' + RP.icone(TIPOS[k].icone) + '<b>' + TIPOS[k].nome + ' +' + Math.round((t.bonus || 0) * 100) + '%</b><small class="fraco">' + TIPOS[k].txt + '</small></div>';
      }).join('') + '</div>' +
      '<div class="secao-titulo">Suas relíquias</div><div class="pilha">' + (d.minhas.length ? d.minhas.map(cartaoMinha).join('') : '<p class="fraco">Nenhuma relíquia com você. Escave uma ruína antiga ou tome a de outro reino.</p>') + '</div>' +
      '<p class="fraco" style="font-size:var(--fs-2);margin-top:var(--esp-2)">Relíquias no mesmo local somam bônus, mas chamam atenção: ' + d.brilho + ' brilham para quem já explorou a área; ' + d.farol + ' ou mais viram farol, visível para todos. Quem vencer um saque, uma ocupação ou um cerco no local leva as relíquias.</p>' +
      (d.aVista.length ? '<div class="secao-titulo">À vista no mapa</div><div class="pilha">' + d.aVista.map(cartaoAVista).join('') + '</div>' : '') +
      '<div class="secao-titulo">Conhecidas por espionagem</div><div class="pilha">' + (d.conhecidas.length ? d.conhecidas.map(cartaoConhecida).join('') : '<p class="fraco">Espione locais de outros reinos para descobrir relíquias.</p>') + '</div>' +
      '<div class="secao-titulo">Ruínas antigas</div><div class="pilha">' + (d.ruinas.length ? d.ruinas.map(cartaoRuina).join('') : '<p class="fraco">Nenhuma ruína antiga conhecida. Explore o mapa para achá-las.</p>') + '</div><div style="height:var(--esp-8)"></div>';
  }
  function carregar() {
    return RP.get('/reliquias').then(function (d) { dados = d; RP.sincronizar(d.agora); return d; });
  }

  RP.registrarTela('reliquias', {
    secao: 'reino',
    montar: function (el) {
      tela = el;
      el.innerHTML = RP.topoVoltar('Relíquias', 'reino', 'Lendárias · uma por reino no mundo') + '<div class="conteudo-tela relq-conteudo"></div>';
      var atualizar = V.debounce(function () { if (!el.hidden) carregar().then(desenhar, function () { /* offline */ }); }, 400);
      RP.ouvir('marchas', atualizar);
      RP.ouvir('mapa', atualizar);
    },
    entrar: function () { desenhar(); carregar().then(desenhar, function () { /* aviso já mostrado */ }); }
  });

  /* ---------------------------------------------------------------- Mover: a escolta sai de um local, busca e leva */
  var tr = { rel: null, destino: null, de: null, grupo: {}, seguro: false, previa: null };
  var telaTr = null;
  function relAtual() { return dados && dados.minhas.filter(function (r) { return r.id === tr.rel; })[0]; }
  var pedirPrevia = V.debounce(function () {
    var r = relAtual();
    if (!r || !tr.destino || !tr.de || !RP.somaGrupo(tr.grupo)) { tr.previa = null; desenharTr(); return; }
    var corpo = { deLocalId: tr.de, tropas: tr.grupo, destinoLocalId: tr.destino }, chave = JSON.stringify(corpo);
    RP.post('/reliquias/' + r.id + '/previa', corpo).then(function (p) {
      if (chave !== JSON.stringify({ deLocalId: tr.de, tropas: tr.grupo, destinoLocalId: tr.destino })) return;
      tr.previa = p; desenharTr();
    }, function (e) { tr.previa = { erro: e.message }; desenharTr(); });
  }, 200);
  function desenharTr() {
    var el = telaTr; if (!el || el.hidden) return;
    var c = RP.$('.tr-conteudo', el), r = relAtual();
    if (!r) { c.innerHTML = '<p class="fraco">Carregando…</p>'; return; }
    var origem = r.local, destinos = (RP.reino.locais || []).filter(function (l) { return !l.ruina && (!origem || l.id !== origem.id); });
    if (!tr.destino || !destinos.some(function (l) { return l.id === tr.destino; })) tr.destino = destinos[0] ? destinos[0].id : null;
    var bases = V.locaisComTropas();
    if (!tr.de || !bases.some(function (l) { return l.id === tr.de; })) {
      var noLocal = origem && bases.filter(function (l) { return l.id === origem.id; })[0];
      tr.de = (noLocal || bases.filter(function (l) { return l.tipo === 'castelo'; })[0] || bases[0] || {}).id || null;
    }
    var disp = V.guarnicao(tr.de), p = tr.previa, n = RP.somaGrupo(tr.grupo);
    Object.keys(tr.grupo).forEach(function (k) { tr.grupo[k] = Math.min(tr.grupo[k] || 0, disp[k] || 0); });
    var deLocal = RP.local(tr.de), buscar = p && !p.erro ? V.escolhida(p.buscar, tr.seguro) : null, levar = p && !p.erro && p.levar ? V.escolhida(p.levar, tr.seguro) : null;
    var mesmo = origem && tr.de === origem.id;
    function depois(l) { var x = (RP.local(l.id) || {}).reliquias; return (x ? x.length : 0) + 1; }
    c.innerHTML = '<div class="card relq-card tipo-' + r.tipo + '">' + cabRel(r) + '<p class="fraco" style="font-size:var(--fs-2)">Hoje em <b style="color:var(--cor-texto)">' + RP.esc(origem ? origem.nome : '—') + '</b></p></div>' +
      '<div class="nota-regra" style="margin-top:var(--esp-3)">' + RP.icone('tropas', 'ico-p') + '<span>A relíquia <b>não anda sozinha</b>. Suas tropas ' + (mesmo ? 'levam a relíquia' : 'saem, buscam a relíquia e a levam') + ' até o destino. Até ser pega, ela continua fortalecendo ' + RP.esc(origem ? origem.nome : 'o local') + '. No caminho, fica visível e <b>pode ser roubada</b>.</span></div>' +
      '<div class="secao-titulo">1. Destino</div><div class="escolhas escolhas-lista">' + destinos.map(function (l) {
        var k = depois(l), nv = nivelPor(k);
        return '<button type="button" class="escolha escolha-linha" data-destino-tr="' + l.id + '" aria-pressed="' + (l.id === tr.destino) + '"><span class="ico-placa dono-meu">' + RP.icone(RP.iconeLocal(l)) + '</span>' +
          '<span class="escolha-txt"><b>' + RP.esc(l.nome) + '</b><small class="fraco">' + RP.esc(RP.nomeTipoLocal(l)) + (k > 1 ? ' · ficaria com ' + k + ' relíquias' : '') + '</small></span>' +
          (nv ? '<span class="selo selo-antigo">' + (nv === 'farol' ? 'Farol' : 'Brilho') + '</span>' : '') + '</button>';
      }).join('') + '</div>' +
      (p && p.nivelDepois && nivelPor(p.depois) ? '<p class="nota-antiga">' + RP.icone('lendario', 'ico-p') + '<span>Com ' + p.depois + ' relíquias no destino, os bônus somam, mas o local ' + (p.nivelDepois === 'farol' ? 'vira farol: visível para todos os reinos, até na névoa.' : 'passa a brilhar para quem já explorou a área.') + '</span></p>' : '') +
      '<div class="secao-titulo">2. Escolta</div><div class="card pilha">' +
      (bases.length > 1 ? '<div class="abas abas-rolagem" role="group" aria-label="De onde sai a escolta">' + bases.map(function (l) {
        return '<button type="button" class="aba" data-tr-de="' + l.id + '" aria-pressed="' + (l.id === tr.de) + '">' + RP.esc(l.nome) + '</button>';
      }).join('') + '</div>' : '') +
      (bases.length ? '<div data-tr-grupo>' + RP.grupoTropas.linhas(tr.grupo, disp) + '</div>' : '<p class="fraco">Nenhuma tropa nos locais. A relíquia só se move com tropas.</p>') +
      '<div class="ext-numeros"><div><span class="fraco">Tropas</span><b class="num">' + n + '</b></div><div><span class="fraco">Força</span><b class="num">' + (p && !p.erro ? RP.num(p.forca) : '—') + '</b></div><div><span class="fraco">Velocidade</span><b>' + (p && !p.erro ? RP.esc(RP.VELOCIDADES[p.vel] || p.vel) : '—') + '</b></div></div>' +
      (p && !p.erro && n ? V.notaEscolta(p.poucoProtegida, '<b>Escolta pequena.</b> Quem a vir no caminho pode roubar a relíquia com poucas tropas.', '<b>Escolta forte</b><br><small>Roubar no caminho exige um exército. Ainda assim, ela fica visível no mapa.</small>') : '') + '</div>' +
      '<div class="secao-titulo">3. Caminho</div>' +
      (p && p.erro ? '<p class="nota-antiga">' + RP.icone('alerta', 'ico-p') + '<span>' + RP.esc(p.erro) + '</span></p>'
        : p ? (!mesmo && buscar ? '<div class="card linha"><span class="ico-placa dono-meu">' + RP.icone(RP.iconeLocal(deLocal || {})) + '</span><span style="flex:1"><b>Buscar</b><br><small class="fraco">' + RP.esc(deLocal ? deLocal.nome : '') + ' → ' + RP.esc(origem ? origem.nome : '') + '</small></span><span class="rota-tempo">' + RP.icone('relogio', 'ico-p') + V.fmtMin(buscar.min) + '</span></div>' : '') +
          '<div style="margin-top:var(--esp-3)">' + V.caminhos(p.levar, tr.seguro) + '</div>' : '<p class="fraco">Escolha o destino e a escolta.</p>') + '<div style="height:var(--esp-6)"></div>';
    var total = buscar && levar && buscar.ok && levar.ok ? (mesmo ? 0 : buscar.min) + levar.min : null;
    RP.$('.rodape-resumo', el).innerHTML = n && total != null
      ? '<div class="resumo-linha"><b>' + RP.esc(r.nome) + ' → ' + RP.esc(V.nomeLocal(tr.destino)) + '</b><span class="tempo">' + RP.icone('relogio', 'ico-p') + V.fmtMin(total) + '</span></div><div class="resumo-linha fraco">escolta: ' + RP.esc(RP.partesGrupo(tr.grupo)) + (!mesmo ? ' · busca em ' + V.fmtMin(buscar.min) : '') + '</div>'
      : '<div class="resumo-linha fraco">' + (tr.destino ? 'Escolha a escolta: a relíquia só se move com tropas.' : 'Nenhum destino.') + '</div>';
    RP.$('[data-enviar-escolta]', el).classList.toggle('btn-inativo', !n || total == null);
  }
  RP.registrarTela('transporte', {
    secao: 'reino',
    montar: function (el) {
      telaTr = el;
      el.innerHTML = RP.topoVoltar('Mover relíquia', 'reliquias', 'Sempre com escolta') + '<div class="conteudo-tela tr-conteudo"></div>' +
        '<div class="rodape-acao rodape-com-resumo"><div class="rodape-resumo"></div><button type="button" class="btn btn-primario btn-bloco btn-grande" data-enviar-escolta>' + RP.icone('tropas') + 'Enviar escolta</button></div>';
      el.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-destino-tr]'))) { tr.destino = +b.getAttribute('data-destino-tr'); desenharTr(); pedirPrevia(); return; }
        if ((b = e.target.closest('[data-tr-de]'))) { tr.de = +b.getAttribute('data-tr-de'); tr.grupo = {}; tr.previa = null; desenharTr(); return; }
        if ((b = e.target.closest('[data-caminho]'))) { tr.seguro = b.getAttribute('data-caminho') === 'segura'; desenharTr(); return; }
        if (e.target.closest('[data-tr-grupo]') && RP.grupoTropas.clique(e, tr.grupo, V.guarnicao(tr.de))) { desenharTr(); pedirPrevia(); return; }
        if (e.target.closest('[data-enviar-escolta]')) {
          var r = relAtual();
          if (!r || !RP.somaGrupo(tr.grupo)) { RP.aviso({ titulo: 'Escolha a escolta', texto: 'A relíquia só se move carregada por tropas.', icone: 'tropas', tipo: 'alerta' }); return; }
          V.tentar(RP.post('/reliquias/' + r.id + '/mover', { deLocalId: tr.de, tropas: tr.grupo, destinoLocalId: tr.destino, seguro: !!tr.seguro })).then(function (res) {
            RP.aviso({ titulo: 'Escolta a caminho', texto: r.nome + ' vai para ' + V.nomeLocal(tr.destino) + '.' + (res.poucoProtegida ? ' Escolta pequena: pode ser roubada.' : ''), icone: 'lendario', tipo: 'sucesso' });
            tr.grupo = {}; tr.previa = null;
            RP.recarregarReino(); RP.carregarTropas().catch(function () { /* offline */ });
            RP.ir('reliquias');
          });
        }
      });
    },
    entrar: function (el, params) {
      var id = +params.get('rel');
      if (id && id !== tr.rel) { tr.rel = id; tr.destino = null; tr.grupo = {}; tr.previa = null; }
      desenharTr();
      Promise.all([carregar(), RP.carregarTropas()]).then(function () {
        var r = relAtual();
        if (!r || r.estado !== 'guardada') { var q = dados.minhas.filter(function (x) { return x.estado === 'guardada'; })[0]; tr.rel = q ? q.id : null; }
        if (!tr.rel) { RP.ir('reliquias'); return; }
        desenharTr(); pedirPrevia();
      }, function () { /* aviso já mostrado */ });
    }
  });

  /* ---------------------------------------------------------------- mapa: relíquias nos locais e nas marchas, brilho e farol */
  /* o servidor manda { tipo: 'reliquia-em', local | marcha, reliquia: { tipo } }: vira o campo "reliquia" do local ou da marcha
     (pedestal na Vista, selo no Mapa, baú na marcha). Roda na captura, antes de as visões desenharem os dados novos. */
  window.addEventListener('rp:mapa-dados', function (e) {
    var d = e.detail; if (!d || !d.objs) return;
    var marcas = d.objs.filter(function (o) { return o.tipo === 'reliquia-em'; });
    if (!marcas.length) return;
    marcas.forEach(function (x) {
      var alvo = x.local != null ? d.objs.filter(function (o) { return o.tipo === 'local' && o.id === x.local; })[0]
        : d.marchas.filter(function (o) { return o.id === x.marcha; })[0];
      if (alvo) { alvo.reliquia = x.reliquia; alvo.reliquias = x.n; }
    });
    d.objs = d.objs.filter(function (o) { return o.tipo !== 'reliquia-em'; });
    Object.keys(d.porHex).forEach(function (h) { d.porHex[h] = d.porHex[h].filter(function (o) { return o.tipo !== 'reliquia-em'; }); });
  }, true);

  var TIPOS_OBJ = RP.mapa.tiposObjeto, A = RP.arte, TT = RP.mapaTatico;
  var folhaConc = function (o) {
    return '<div class="info-linha"><span class="fraco">Relíquias</span><span>' + (o.n || '') + ' juntas · dono e tipos desconhecidos</span></div>' +
      '<p class="nota-regra">' + RP.icone('lendario', 'ico-p') + '<span>' + RP.TEXTO_CONC[o.tipo === 'farol' ? 'farol' : 'brilho'] + ' Espione para saber de quem são.</span></p>';
  };
  var acoesConc = function () { return '<a class="btn btn-p" href="#/reliquias">' + RP.icone('lendario') + 'Relíquias</a>'; };
  TIPOS_OBJ.brilho = TIPOS_OBJ.brilho || {
    nome: function (o) { return (o.n || 2) + ' relíquias · brilho'; },
    icone: function () { return 'lendario'; },
    classe: function () { return 'farol brilho'; },
    svgTatico: function (o) { return '<circle class="farol-halo" r="16" style="opacity:.55"/><circle class="farol-base" r="11"/><use href="#i-lendario" x="-8" y="-8" width="16" height="16"/>' + TT.rotuloSvg((o.n || 2) + ' relíquias', 27, 'rotulo-farol'); },
    desenharCena: function (c, o, info) {
      var pulso = 0.5 + Math.sin((info.t || 0) * 1.6) * 0.5;
      A.elipse(c, 0, -4, 18 + pulso * 4, 8 + pulso * 2, 'rgba(215,150,242,' + (info.antigo ? 0.12 : 0.22 + pulso * 0.15).toFixed(2) + ')');
      A.elipse(c, 0, -4, 6, 3, 'rgba(215,150,242,.55)');
    },
    rotulo: function (o) { return { txt: (o.n || 2) + ' relíquias · brilho', cls: 'nivel', cor: '#d796f2' }; },
    rotuloDy: -30,
    folha: folhaConc, acoes: acoesConc
  };
  if (TIPOS_OBJ.farol) {
    if (!TIPOS_OBJ.farol.folha) TIPOS_OBJ.farol.folha = folhaConc;
    if (!TIPOS_OBJ.farol.acoes) TIPOS_OBJ.farol.acoes = acoesConc;
  }

  /* relíquias guardadas: linha na folha e no card do local */
  RP.extrasFolhaLocal.push(function (l) {
    if (!l.reliquias || !l.reliquias.length) return '';
    return '<div class="info-linha"><span class="fraco">Relíquias</span><span>' + l.reliquias.map(function (r) { return seloTipo(r.tipo) + ' ' + RP.esc(r.nome); }).join('<br>') +
      (l.nivelReliquias === 'farol' ? '<br><small class="fraco">Farol: todos veem</small>' : l.nivelReliquias === 'brilho' ? '<br><small class="fraco">Brilha para quem explorou a área</small>' : '') + '</span></div>';
  });
  RP.extrasCardLocal.push(function (l) {
    return l.reliquias && l.reliquias.length ? '<span class="lc-relq">' + l.reliquias.map(function (r) { return seloTipo(r.tipo); }).join('') + '</span>' : '';
  });
  RP.acoesFolhaLocal.push(function (l) {
    return l.reliquias && l.reliquias.length ? '<a class="btn btn-p" href="#/transporte?rel=' + l.reliquias[0].id + '">' + RP.icone('lendario') + 'Mover relíquia</a>' : '';
  });
  RP.extrasReino.push(function (r) {
    if (!RP.sistema('reliquias') || !r.reliquias || !r.reliquias.length) return '';
    return '<a class="card linha relq-resumo" href="#/reliquias"><span class="relq-ico">' + RP.icone('lendario') + '</span><span style="flex:1;min-width:0"><b>' + r.reliquias.length + ' relíquia' + (r.reliquias.length > 1 ? 's' : '') + '</b><br><small class="fraco">' +
      RP.esc(r.reliquias.map(function (x) { return x.nome; }).join(' · ')) + '</small></span>' + RP.icone('avancar', 'ico-p') + '</a>';
  });
  RP.itensMais.push({ icone: 'lendario', titulo: 'Relíquias', texto: 'As suas, as à vista e as ruínas antigas', href: '#/reliquias', sistema: 'reliquias' });
  RP.FILTROS_RELATORIO.push(['reliquia', 'Relíquias']);
})();
