/* Reino de Pedra — Transporte de recursos: caravana manual (#/caravana), veículos e salgadeira na Construção,
   "Trazer recursos" nos locais, valiosos e peças comuns das telas de valiosos (RP.valiosos).
   Porte de prototipo/js/logistica.js com dados reais: prévia e envio em /api/v1/caravanas. */
(function () {
  'use strict';
  var RP = window.RP;

  /* ---------------------------------------------------------------- peças comuns (caravana, extração, relíquias) */
  var V = RP.valiosos = RP.valiosos || {};
  V.nomeLocal = function (id) { var l = RP.local(id); return l ? l.nome : '—'; };
  V.deposito = function (l) { return l && (l.tipo === 'armazem' || l.tipo === 'castelo') && !l.ruina; };
  V.ehValioso = function (k) { var v = RP.reino && RP.reino.valiosos; return (v && v.ids ? v.ids : RP.VALIOSOS).indexOf(k) >= 0; };
  V.min = function (r) { return r && r.ok && r.min != null ? r.min : null; };
  V.fmtMin = function (min) { return min == null ? '—' : RP.fmtDuracao(Math.max(60, Math.round(min * 60))); };
  V.fmtHoras = function (h) {
    if (h == null || !isFinite(h)) return '—';
    if (h < 1) return Math.max(1, Math.round(h * 60)) + ' min';
    if (h < 48) return (Math.round(h * 10) / 10).toLocaleString('pt-BR') + ' h';
    return Math.round(h / 24) + ' dias';
  };
  V.fmtRitmo = function (v) { return v < 10 ? (Math.round(v * 10) / 10).toLocaleString('pt-BR') : RP.num(v); };
  /* opção de caminho (curta ou segura), igual ao envio pelo mapa */
  V.opcaoCaminho = function (nome, r, seguro, attr) {
    if (!r || !r.ok) return '';
    return '<button type="button" class="rota-opcao ' + nome + '" ' + (attr || 'data-caminho') + '="' + nome + '" aria-pressed="' + ((nome === 'segura') === !!seguro) + '">' +
      '<i class="rota-cor" aria-hidden="true"></i><span><b>' + (nome === 'curta' ? 'Rota curta' : 'Rota segura') + '</b><small>' + r.hexes + ' hexágonos' +
      (nome === 'segura' ? ' · evita a fauna conhecida' : ' · o caminho mais rápido') + '</small></span>' +
      '<span class="rota-tempo">' + RP.icone('relogio', 'ico-p') + V.fmtMin(r.min) + '</span></button>';
  };
  /* caminhos curto e seguro de uma prévia { curta, segura } */
  V.caminhos = function (v, seguro, attr) {
    if (!v || !v.curta || !v.curta.ok) return '<p class="fraco">Sem caminho possível.</p>';
    var mesma = !v.segura || !v.segura.ok || (v.segura.hexes === v.curta.hexes && v.segura.min === v.curta.min);
    return '<div class="pilha">' + V.opcaoCaminho('curta', v.curta, mesma ? false : seguro, attr) + (mesma ? '' : V.opcaoCaminho('segura', v.segura, seguro, attr)) + '</div>' +
      (mesma ? '<p class="fraco" style="font-size:var(--fs-2)">A rota curta já é a mais segura que se conhece.</p>' : '');
  };
  V.escolhida = function (v, seguro) { return v ? (seguro && v.segura && v.segura.ok ? v.segura : v.curta) : null; };
  /* gráfico de barras horizontais (comparação de cenários) */
  V.grafico = function (cen, fmt, rotulo) {
    var max = Math.max.apply(null, cen.map(function (c) { return isFinite(c.v) ? c.v : 0; })) || 1;
    return '<div class="grafico-barras" role="img" aria-label="' + RP.esc(rotulo) + '">' + cen.map(function (c) {
      var val = fmt(c.v);
      return '<div class="gb-linha' + (c.atual ? ' atual' : '') + '" tabindex="0" data-dica="' + RP.esc(c.nome + ': ' + val) + '">' +
        '<span class="gb-rotulo">' + RP.esc(c.nome) + '</span><span class="gb-trilho"><i style="width:' + Math.max(2, (80 * (isFinite(c.v) ? c.v : 0)) / max).toFixed(1) + '%"></i></span>' +
        '<span class="gb-valor num">' + val + '</span></div>';
    }).join('') + '</div>';
  };
  V.escolhaLocal = function (l, attr, ativo, extra) {
    return '<button type="button" class="escolha escolha-linha" ' + attr + '="' + l.id + '" aria-pressed="' + ativo + '"><span class="ico-placa dono-meu">' + RP.icone(RP.iconeLocal(l)) + '</span>' +
      '<span class="escolha-txt"><b>' + RP.esc(l.nome) + '</b><small class="fraco">' + (extra || '') + '</small></span></button>';
  };
  /* aviso de escolta fraca: só aviso, nunca bloqueia */
  V.notaEscolta = function (fraca, txtFraca, txtForte) {
    return fraca ? '<p class="nota-antiga">' + RP.icone('alerta', 'ico-p') + '<span>' + txtFraca + '</span></p>'
      : '<div class="risco-linha ok">' + RP.icone('escudo') + '<span>' + txtForte + '</span></div>';
  };
  V.locaisComTropas = function () { return RP.tropas ? RP.tropas.locais.filter(function (l) { return RP.somaGrupo(l.guarnicao) > 0 && !l.ruina; }) : []; };
  V.guarnicao = function (id) { var l = RP.tropas && RP.tropas.locais.filter(function (x) { return x.id === id; })[0]; return l ? l.guarnicao : {}; };
  V.cargaTropas = function (g) { return Object.keys(g || {}).reduce(function (s, k) { var u = RP.unidade(k); return s + (g[k] || 0) * (u ? u.carga : 0); }, 0); };
  V.cargaTxt = function (c) { return Object.keys(c || {}).filter(function (k) { return c[k] > 0; }).map(function (k) { return RP.num(c[k]) + ' de ' + RP.nomeRecurso(k); }).join(', '); };
  /* como RP.tentar (mostra o erro do servidor), mas sem deixar a promessa rejeitada solta */
  V.tentar = function (p) { var q = RP.tentar(p); return { then: function (f) { return q.then(f).catch(function () { /* aviso já mostrado */ }); } }; };
  V.debounce = function (f, ms) { var t = 0; return function () { clearTimeout(t); t = setTimeout(f, ms || 250); }; };

  /* o valor de referência vem do servidor junto com o reino (RP.valorDe usa RP.config.valor) */
  document.addEventListener('rp:reino', function (e) {
    var v = e.detail && e.detail.valiosos;
    if (v && v.valor) { RP.config = RP.config || {}; RP.config.valor = v.valor; }
  });

  RP.NOMES_MARCHA = RP.NOMES_MARCHA || {};
  RP.NOMES_MARCHA.caravana = 'Caravana';
  RP.mapa.tiposMarcha.caravana = RP.mapa.tiposMarcha.caravana || { nome: 'Caravana', icone: 'carroca' };

  /* ---------------------------------------------------------------- tela Caravana */
  var cv = null, tela = null;
  function novo() { return { para: null, de: null, carga: {}, veic: {}, escolta: {}, base: null, seguro: false, abertoDe: true, abertoPara: true, previa: null, pedido: null }; }
  function meus() { return (RP.reino && RP.reino.locais || []).filter(function (l) { return !l.ruina; }); }
  function recursos() { return RP.ORDEM_REC.concat(RP.VALIOSOS); }
  function temEstoque(l) { return recursos().some(function (k) { return RP.qtdRecurso(k, l.id) >= 1; }); }
  function veiculos() { return (RP.reino && RP.reino.veiculos) || {}; }
  function somaCarga() { return Object.keys(cv.carga).reduce(function (s, k) { return s + (cv.carga[k] || 0); }, 0); }
  function capacidade() {
    var vv = veiculos(), cap = Object.keys(cv.veic).reduce(function (s, k) { return s + (cv.veic[k] || 0) * (vv[k] ? vv[k].carga : 0); }, 0);
    return { veiculos: cap, tropas: V.cargaTropas(cv.escolta), total: cap + V.cargaTropas(cv.escolta) };
  }
  function usaVeiculo() { return RP.somaGrupo(cv.veic) > 0; }
  function baseId() { return usaVeiculo() ? RP.reino.casteloId : (cv.base || RP.reino.casteloId); }

  /* preenche origem, carga e carroças a partir do que se quer levar (?leva=madeira:300,pedra:150) */
  function preencherPedido() {
    var p = cv.pedido; if (!p) return;
    var ks = Object.keys(p);
    var melhor = meus().filter(function (l) { return l.id !== cv.para; }).map(function (l) {
      return { l: l, tem: ks.reduce(function (s, k) { return s + Math.min(p[k], RP.qtdRecurso(k, l.id)); }, 0) };
    }).sort(function (a, b) { return b.tem - a.tem; })[0];
    if (melhor && melhor.tem > 0) cv.de = melhor.l.id;
    cv.carga = {};
    ks.forEach(function (k) { var q = Math.min(p[k], Math.floor(RP.qtdRecurso(k, cv.de))); if (q > 0) cv.carga[k] = q; });
    var c = veiculos().carroca;
    if (c && c.livres) cv.veic = { carroca: Math.min(c.livres, Math.max(1, Math.ceil(somaCarga() / c.carga))) };
    cv.abertoDe = false; cv.abertoPara = false; cv.pedido = null;
  }

  var pedirPrevia = V.debounce(function () {
    if (!cv || !cv.de || !cv.para || !somaCarga()) { if (cv) { cv.previa = null; desenhar(); } return; }
    var corpo = corpoEnvio();
    RP.post('/caravanas/previa', corpo).then(function (p) {
      if (JSON.stringify(corpo) !== JSON.stringify(corpoEnvio())) return;   // mudou enquanto esperava
      cv.previa = p; desenhar();
    }, function () { /* offline */ });
  }, 250);
  function corpoEnvio() {
    var carga = {}, veic = {}, esc = {};
    Object.keys(cv.carga).forEach(function (k) { if (cv.carga[k] > 0) carga[k] = cv.carga[k]; });
    Object.keys(cv.veic).forEach(function (k) { if (cv.veic[k] > 0) veic[k] = cv.veic[k]; });
    Object.keys(cv.escolta).forEach(function (k) { if (cv.escolta[k] > 0) esc[k] = cv.escolta[k]; });
    return { origemLocalId: cv.de, destinoLocalId: cv.para, carga: carga, veiculos: veic, tropas: esc, baseLocalId: baseId(), seguro: !!cv.seguro };
  }

  function linhaCarga(k, para) {
    var q = cv.carga[k] || 0, disp = Math.floor(RP.qtdRecurso(k, cv.de)), bloq = V.ehValioso(k) && !V.deposito(para), nome = RP.NOMES_REC[k] || k;
    return '<div class="linha-entre grupo-linha' + (bloq ? ' bloqueado' : '') + '"><span class="linha">' + RP.icone(k, 'r-' + k) + '<span><b>' + RP.esc(nome) + '</b><br><small class="fraco">' + RP.num(disp) + ' na origem' + (bloq ? ' · fica no armazém ou castelo' : '') + '</small></span></span>' +
      '<span class="linha grupo-ctrl"><span class="stepper"><button type="button" class="btn btn-icone" data-cv-rec="' + k + '" data-d="-1" aria-label="Menos ' + RP.esc(nome.toLowerCase()) + '"' + (q <= 0 ? ' disabled' : '') + '>' + RP.icone('menos') + '</button>' +
      '<output class="num">' + RP.numCurto(q) + '</output><button type="button" class="btn btn-icone" data-cv-rec="' + k + '" data-d="1" aria-label="Mais ' + RP.esc(nome.toLowerCase()) + '"' + (q >= disp || bloq ? ' disabled' : '') + '>' + RP.icone('mais') + '</button></span>' +
      '<button type="button" class="btn btn-p btn-fantasma" data-cv-rec="' + k + '" data-d="max" aria-label="Tudo de ' + RP.esc(nome.toLowerCase()) + '"' + (bloq || !disp ? ' disabled' : '') + '>Tudo</button></span></div>';
  }
  function linhaVeic(k) {
    var v = veiculos()[k], q = cv.veic[k] || 0;
    return '<div class="linha-entre grupo-linha"><span class="linha">' + RP.icone('carroca') + '<span><b>' + RP.esc(v.nome) + '</b><br><small class="fraco">' + v.livres + ' livre' + (v.livres === 1 ? '' : 's') + ' · leva ' + RP.num(v.carga) + ' · ' + (RP.VELOCIDADES[v.vel] || v.vel) + '</small></span></span>' +
      '<span class="stepper"><button type="button" class="btn btn-icone" data-cv-veic="' + k + '" data-d="-1" aria-label="Menos ' + RP.esc(v.nome.toLowerCase()) + '"' + (q <= 0 ? ' disabled' : '') + '>' + RP.icone('menos') + '</button>' +
      '<output class="num">' + q + '</output><button type="button" class="btn btn-icone" data-cv-veic="' + k + '" data-d="1" aria-label="Mais ' + RP.esc(v.nome.toLowerCase()) + '"' + (q >= v.livres ? ' disabled' : '') + '>' + RP.icone('mais') + '</button></span></div>';
  }

  function desenhar() {
    var el = tela; if (!el || el.hidden || !RP.reino) return;
    var lista = meus();
    if (!cv.para || !RP.local(cv.para)) cv.para = RP.reino.casteloId;
    var origens = lista.filter(function (l) { return l.id !== cv.para && temEstoque(l); });
    if (!cv.de || cv.de === cv.para || !origens.some(function (l) { return l.id === cv.de; })) { cv.de = origens[0] ? origens[0].id : null; cv.carga = {}; }
    var para = RP.local(cv.para), de = cv.de && RP.local(cv.de);
    Object.keys(cv.carga).forEach(function (k) { cv.carga[k] = Math.max(0, Math.min(cv.carga[k], Math.floor(RP.qtdRecurso(k, cv.de)))); if (V.ehValioso(k) && !V.deposito(para)) cv.carga[k] = 0; });
    var soma = somaCarga(), cap = capacidade(), p = cv.previa;
    var bases = V.locaisComTropas();
    if (!usaVeiculo() && cv.base && !bases.some(function (l) { return l.id === cv.base; })) cv.base = null;
    var bId = baseId(), disp = V.guarnicao(bId);
    Object.keys(cv.escolta).forEach(function (k) { cv.escolta[k] = Math.min(cv.escolta[k] || 0, disp[k] || 0); });
    var recs = de ? recursos().filter(function (k) { return RP.qtdRecurso(k, de.id) >= 1 || cv.carga[k]; }) : [];
    var h = RP.comoFunciona('<p>Recursos só servem <b>onde estão</b>. A caravana sai do castelo, busca a carga na origem e a leva ao destino.</p><p>No caminho ela fica visível e <b>pode ser roubada</b>. Escolta protege e também carrega um pouco.</p>') +
      '<div class="secao-titulo">1. Para onde</div><div class="escolhas escolhas-lista">' + lista.filter(function (l) { return cv.abertoPara || l.id === cv.para; }).map(function (l) {
        return V.escolhaLocal(l, 'data-cv-para', l.id === cv.para, RP.nomeTipoLocal(l) + (V.deposito(l) ? ' · guarda valiosos' : ''));
      }).join('') + '</div>' + (!cv.abertoPara ? '<button type="button" class="btn btn-p btn-fantasma trocar-alvo" data-cv-trocar="para">' + RP.icone('menu') + 'Trocar destino (' + lista.length + ' opções)</button>' : '') +
      '<div class="secao-titulo">2. De onde</div>' + (origens.length ? '<div class="escolhas escolhas-lista">' + origens.filter(function (l) { return cv.abertoDe || l.id === cv.de; }).map(function (l) {
        return V.escolhaLocal(l, 'data-cv-de', l.id === cv.de, RP.estoqueHTML(l.id));
      }).join('') + '</div>' + (!cv.abertoDe ? '<button type="button" class="btn btn-p btn-fantasma trocar-alvo" data-cv-trocar="de">' + RP.icone('menu') + 'Trocar origem (' + origens.length + ' opções)</button>' : '') : '<p class="fraco">Nenhum outro local com estoque.</p>') +
      (de ? '<div class="secao-titulo">3. Carga</div><div class="card pilha">' + recs.map(function (k) { return linhaCarga(k, para); }).join('') +
        (!V.deposito(para) && recs.some(V.ehValioso) ? '<p class="fraco" style="font-size:var(--fs-2)">Valiosos ficam no armazém ou no castelo.</p>' : '') + '</div>' : '') +
      '<div class="secao-titulo">4. Quem leva</div><div class="card pilha">' + Object.keys(veiculos()).map(linhaVeic).join('') +
      '<p class="fraco" style="font-size:var(--fs-2)">Escolta: protege e também carrega um pouco.' + (usaVeiculo() ? ' Sai do castelo com as carroças.' : '') + '</p>' +
      (!usaVeiculo() && bases.length > 1 ? '<div class="abas abas-rolagem" role="group" aria-label="De onde saem as tropas">' + bases.map(function (l) {
        return '<button type="button" class="aba" data-cv-base="' + l.id + '" aria-pressed="' + (l.id === bId) + '">' + RP.esc(l.nome) + '</button>';
      }).join('') + '</div>' : '') +
      '<div data-cv-escolta>' + RP.grupoTropas.linhas(cv.escolta, disp) + '</div>' +
      '<div class="obj-carga"><div class="linha-entre"><span class="fraco">Carga</span><b class="num' + (soma > cap.total ? ' txt-perigo' : '') + '">' + RP.num(soma) + ' de ' + RP.num(cap.total) + '</b></div>' +
      '<div class="barra' + (soma > cap.total ? ' barra-perigo' : '') + '" role="progressbar" aria-label="Carga em relação à capacidade"><i style="width:' + Math.min(100, cap.total ? (100 * soma) / cap.total : (soma ? 100 : 0)).toFixed(1) + '%"></i></div>' +
      (soma > cap.total ? '<p class="nota-antiga">' + RP.icone('alerta', 'ico-p') + '<span>Não cabe. Adicione carroças ou tropas, ou leve menos.</span></p>' : '') +
      '<div class="ext-numeros"><div><span class="fraco">Carroças</span><b class="num">' + RP.num(cap.veiculos) + '</b></div><div><span class="fraco">Escolta</span><b class="num">' + RP.num(cap.tropas) + '</b></div><div><span class="fraco">Velocidade</span><b>' + (p ? RP.esc(RP.VELOCIDADES[p.vel] || p.vel) : '—') + '</b></div></div></div>' +
      (p && (usaVeiculo() || RP.somaGrupo(cv.escolta)) ? V.notaEscolta(p.poucoProtegida, '<b>Pouco protegida.</b> Animais e saqueadores atacam caravanas fracas. Uma escolta com força ' + RP.num(p.escoltaMin) + ' ou mais reduz o risco.',
        '<b>Escolta forte</b><br><small>Roubar esta caravana exige um exército.</small>') : '') + '</div>' +
      '<div class="secao-titulo">5. Caminho</div>' + caminhoHTML(de, para, p) + '<div style="height:var(--esp-6)"></div>';
    RP.$('.cv-conteudo', el).innerHTML = h;
    var ok = p && p.ok;
    RP.$('.rodape-resumo', el).innerHTML = ok
      ? '<div class="resumo-linha"><b>' + RP.esc(V.cargaTxt(cv.carga)) + ' → ' + RP.esc(V.nomeLocal(cv.para)) + '</b><span class="tempo">' + RP.icone('relogio', 'ico-p') + V.fmtMin(p.totalMin) + '</span></div>' +
        '<div class="resumo-linha fraco">' + [usaVeiculo() ? RP.esc(partesVeic(cv.veic)) : '', RP.somaGrupo(cv.escolta) ? 'escolta: ' + RP.esc(RP.partesGrupo(cv.escolta)) : 'sem escolta'].filter(Boolean).join(' · ') + '</div>'
      : '<div class="resumo-linha fraco">' + RP.esc(!soma ? 'Escolha a carga.' : !usaVeiculo() && !RP.somaGrupo(cv.escolta) ? 'Escolha carroças ou tropas para levar.' : soma > cap.total ? 'A carga não cabe.' : p && p.problema ? p.problema : 'Calculando o caminho…') + '</div>';
    RP.$('[data-enviar-caravana]', el).classList.toggle('btn-inativo', !ok);
  }
  function partesVeic(v) {
    return Object.keys(v).filter(function (k) { return v[k] > 0; }).map(function (k) { return v[k] + ' ' + (k === 'carrocao' ? (v[k] > 1 ? 'carroções' : 'carroção') : (v[k] > 1 ? 'carroças' : 'carroça')); }).join(', ');
  }
  function caminhoHTML(de, para, p) {
    if (!de || !para) return '<p class="fraco">Escolha origem e destino.</p>';
    if (!p) return '<p class="fraco">Escolha a carga e quem leva para ver o caminho.</p>';
    var base = RP.local(p.baseLocalId);
    return (p.buscar && p.buscar.ok ? '<div class="card linha"><span class="ico-placa dono-meu">' + RP.icone(base ? RP.iconeLocal(base) : 'castelo') + '</span><span style="flex:1"><b>Buscar</b><br><small class="fraco">' + RP.esc(base ? base.nome : 'Castelo') + ' → ' + RP.esc(de.nome) + '</small></span><span class="rota-tempo">' + RP.icone('relogio', 'ico-p') + V.fmtMin(p.buscar.min) + '</span></div>' : '') +
      (p.levar && p.levar.ok ? '<div class="card linha" style="margin-top:var(--esp-3)"><span class="ico-placa dono-meu">' + RP.icone('carroca') + '</span><span style="flex:1"><b>Levar</b><br><small class="fraco">' + RP.esc(de.nome) + ' → ' + RP.esc(para.nome) + '</small></span><span class="rota-tempo">' + RP.icone('relogio', 'ico-p') + V.fmtMin(p.levar.min) + '</span></div>' : '') +
      '<div class="abas" role="radiogroup" aria-label="Caminho" style="margin-top:var(--esp-3)"><button type="button" class="aba" role="radio" data-cv-seguro="0" aria-checked="' + !cv.seguro + '">Rota curta</button><button type="button" class="aba" role="radio" data-cv-seguro="1" aria-checked="' + !!cv.seguro + '">Rota segura</button></div>' +
      (p.problema ? '<p class="nota-antiga">' + RP.icone('alerta', 'ico-p') + '<span>' + RP.esc(p.problema) + '</span></p>' : '') +
      '<p class="fraco" style="font-size:var(--fs-2)">A carga sai da origem quando a caravana chega lá. Depois de entregar, carroças e escolta voltam.</p>';
  }
  function mudou() { cv.previa = cv.previa && cv.previa.ok ? cv.previa : null; desenhar(); pedirPrevia(); }

  RP.registrarTela('caravana', {
    secao: 'reino',
    montar: function (el) {
      tela = el;
      el.innerHTML = RP.topoVoltar('Transportar recursos', 'reino', 'Caravana') + '<div class="conteudo-tela cv-conteudo"></div>' +
        '<div class="rodape-acao rodape-com-resumo"><div class="rodape-resumo"></div><button type="button" class="btn btn-primario btn-bloco btn-grande" data-enviar-caravana>' + RP.icone('carroca') + 'Enviar caravana</button></div>';
      document.addEventListener('rp:reino', function () { if (!el.hidden) desenhar(); });
      document.addEventListener('rp:tropas', function () { if (!el.hidden) desenhar(); });
      el.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-cv-para]'))) { cv.para = +b.getAttribute('data-cv-para'); cv.abertoPara = false; mudou(); return; }
        if ((b = e.target.closest('[data-cv-de]'))) { cv.de = +b.getAttribute('data-cv-de'); cv.carga = {}; cv.abertoDe = false; mudou(); return; }
        if ((b = e.target.closest('[data-cv-trocar]'))) { if (b.getAttribute('data-cv-trocar') === 'de') cv.abertoDe = true; else cv.abertoPara = true; desenhar(); return; }
        if ((b = e.target.closest('[data-cv-rec]'))) {
          var k = b.getAttribute('data-cv-rec'), d = b.getAttribute('data-d'), disp = Math.floor(RP.qtdRecurso(k, cv.de));
          cv.carga[k] = d === 'max' ? disp : Math.max(0, Math.min(disp, (cv.carga[k] || 0) + (+d) * 100));
          mudou(); return;
        }
        if ((b = e.target.closest('[data-cv-veic]'))) {
          var v = b.getAttribute('data-cv-veic'), livres = (veiculos()[v] || {}).livres || 0;
          cv.veic[v] = Math.max(0, Math.min(livres, (cv.veic[v] || 0) + +b.getAttribute('data-d')));
          mudou(); return;
        }
        if ((b = e.target.closest('[data-cv-base]'))) { cv.base = +b.getAttribute('data-cv-base'); cv.escolta = {}; mudou(); return; }
        if ((b = e.target.closest('[data-cv-seguro]'))) { cv.seguro = b.getAttribute('data-cv-seguro') === '1'; mudou(); return; }
        if (e.target.closest('[data-cv-escolta]') && RP.grupoTropas.clique(e, cv.escolta, V.guarnicao(baseId()))) { mudou(); return; }
        if (e.target.closest('[data-enviar-caravana]')) {
          if (!cv.previa || !cv.previa.ok) { RP.aviso({ titulo: 'Caravana incompleta', texto: (cv.previa && cv.previa.problema) || 'Escolha a carga e quem leva.', icone: 'carroca', tipo: 'alerta' }); return; }
          var corpo = corpoEnvio(), origem = RP.local(cv.de);
          V.tentar(RP.post('/caravanas', corpo)).then(function (r) {
            RP.aviso({ titulo: 'Caravana a caminho', texto: V.cargaTxt(corpo.carga) + ' chega a ' + V.nomeLocal(corpo.destinoLocalId) + ' em ' + V.fmtMin(cv.previa.totalMin) + '.' + (r.poucoProtegida ? ' Pouco protegida.' : ''), icone: 'carroca', tipo: 'sucesso' });
            cv = novo();
            RP.recarregarReino(); RP.recarregarTropas();
            RP.ir('mapa?centro=' + (origem ? origem.hex : ''));
          });
        }
      });
    },
    entrar: function (el, params) {
      cv = cv || novo();
      if (params.get('para')) { cv.para = +params.get('para'); cv.abertoPara = false; }
      if (params.get('de')) { cv.de = +params.get('de'); cv.carga = {}; cv.abertoDe = false; }
      if (params.get('leva')) {
        cv.pedido = {};
        params.get('leva').split(',').forEach(function (x) { var kv = x.split(':'); if (kv[1]) cv.pedido[kv[0]] = +kv[1]; });
      }
      Promise.all([RP.carregarReino(), RP.carregarTropas()]).then(function () { preencherPedido(); desenhar(); pedirPrevia(); }, function () { desenhar(); });
      desenhar();
    }
  });

  /* ---------------------------------------------------------------- Construção: veículos e salgadeira */
  RP.extrasConstrucao.push({
    aba: 'valiosos', nome: 'Valiosos',
    html: function (r) {
      var vv = r.veiculos || {}, val = r.valiosos || {}, sal = val.salgadeira, h = '';
      if (RP.sistema('logistica')) {
        h += '<div class="secao-titulo">Veículos</div><p class="nota-regra">' + RP.icone('carroca', 'ico-p') + '<span>Carroças ficam no castelo. Saem com a caravana, buscam a carga na origem, levam e voltam.</span></p>' +
          Object.keys(vv).map(function (k) {
            var v = vv[k];
            return '<div class="card pilha"><div class="linha-entre"><span class="linha">' + RP.icone('carroca') + '<b>' + RP.esc(v.nome) + '</b></span><span class="selo">' + v.livres + ' livre' + (v.livres === 1 ? '' : 's') + (v.emUso ? ' · ' + v.emUso + ' na estrada' : '') + (v.naFila ? ' · ' + v.naFila + ' na fila' : '') + '</span></div>' +
              '<p class="suave">Leva ' + RP.num(v.carga) + ' · ' + (RP.VELOCIDADES[v.vel] || v.vel) + (v.custo.cavalo ? ' · usa ' + v.custo.cavalo + ' cavalos de raça' : '') + '</p>' +
              '<div class="linha-entre">' + RP.custoHTML(v.custo) + '<span class="fraco">' + RP.fmtDuracao(v.seg) + '</span></div>' +
              '<button type="button" class="btn btn-p" data-fazer-veiculo="' + k + '">' + RP.icone('martelo') + 'Fazer 1 ' + RP.esc(v.nome.toLowerCase()) + '</button></div>';
          }).join('') +
          '<a class="btn btn-p btn-bloco" href="#/caravana">' + RP.icone('carroca') + 'Transportar recursos</a>';
      }
      if (sal) {
        var comida = r.locais.filter(function (l) { return l.podeSalgadeira; });
        h += '<div class="secao-titulo">Salgadeira</div><div class="card pilha"><div class="linha">' + RP.icone('sal', 'r-sal') + '<b>Salgadeira</b><span class="selo selo-destaque">Usa sal</span></div>' +
          '<p class="suave">O local de comida guarda ' + sal.horas + ' h de comida em vez de ' + sal.horasBase + ' h. Mais estoque também atrai saque.</p>' +
          '<div class="linha-entre">' + RP.custoHTML(sal.custo) + '<span class="fraco">' + RP.fmtDuracao(sal.seg) + '</span></div>' +
          (comida.length ? comida.map(function (l) {
            return l.salgadeira ? '<div class="linha">' + RP.icone('check', 'ico-p') + '<span>' + RP.esc(l.nome) + ': com salgadeira</span></div>'
              : '<button type="button" class="btn btn-p" data-salgadeira="' + l.id + '">' + RP.icone('martelo') + 'Em ' + RP.esc(l.nome) + '</button>';
          }).join('') : '<p class="fraco">Funde uma vila ou um pasto para guardar comida.</p>') + '</div>';
      }
      if (val.posto) {
        h += '<div class="secao-titulo">Posto de extração</div><div class="card pilha"><div class="linha">' + RP.icone('picareta') + '<b>Posto de extração ou escavação</b><span class="selo">Opcional</span></div>' +
          '<p class="suave">No hexágono de uma jazida descoberta ou de uma ruína antiga: acelera a extração e a escavação e serve de base para as tropas.</p>' +
          '<div class="linha-entre">' + RP.custoHTML(val.posto.custo) + '<span class="fraco">' + RP.fmtDuracao(val.posto.seg) + '</span></div>' +
          '<a class="btn btn-p" href="#/extracao">' + RP.icone('picareta') + 'Escolher jazida ou ruína</a></div>';
      }
      return h;
    }
  });
  document.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-fazer-veiculo]'))) {
      V.tentar(RP.post('/veiculos', { tipo: b.getAttribute('data-fazer-veiculo'), qtd: 1 })).then(function (it) {
        RP.aviso({ titulo: 'Na fila: ' + it.rotulo, texto: it.materialCompleto ? '' : 'O material está a caminho.', icone: 'carroca', tipo: 'sucesso' }); RP.recarregarReino();
      });
    } else if ((b = e.target.closest('[data-salgadeira]'))) {
      V.tentar(RP.post('/salgadeira', { localId: +b.getAttribute('data-salgadeira') })).then(function (it) {
        RP.fecharFolha(); RP.aviso({ titulo: 'Na fila: ' + it.rotulo, texto: it.materialCompleto ? '' : 'O material está a caminho.', icone: 'sal', tipo: 'sucesso' }); RP.recarregarReino();
      });
    }
  });

  /* ---------------------------------------------------------------- folha do local: salgadeira, obra esperando material, trazer recursos */
  function obraEsperando(l) {
    return ((RP.reino && RP.reino.filas && RP.reino.filas.obras) || []).filter(function (i) { return i.localId === l.id && !i.materialCompleto; })[0];
  }
  RP.extrasFolhaLocal.push(function (l) {
    var h = '';
    if (l.podeSalgadeira) h += '<div class="info-linha"><span class="fraco">Salgadeira</span><span>' + (l.salgadeira ? 'guarda ' + RP.reino.valiosos.salgadeira.horas + ' h de comida' : 'não tem') + '</span></div>';
    var it = obraEsperando(l);
    if (it) h += '<div class="info-linha"><span class="fraco">Obra</span><span>' + RP.esc(it.rotulo) + ' · ' + (it.materialChegaEm ? 'material chega ' + RP.barraTempo(it.materialPartida, it.materialChegaEm, { classe: 'curta', cor: 'info', rotulo: 'Material a caminho' }) : 'aguardando material') + '</span></div>';
    return h;
  });
  /* o que falta no local para a próxima obra (a próxima melhoria), para a caravana já vir preenchida */
  function faltaNoLocal(l) {
    var it = obraEsperando(l), custo = it ? null : l.melhoria && l.melhoria.custo;
    if (it) { var f = {}; Object.keys(it.custo).forEach(function (k) { var d = it.custo[k] - (it.entregue[k] || 0); if (d > 0) f[k] = Math.ceil(d); }); return f; }
    var falta = {};
    Object.keys(custo || {}).forEach(function (k) { var d = custo[k] - RP.qtdRecurso(k, l.id); if (d > 0) falta[k] = Math.ceil(d); });
    return falta;
  }
  RP.acoesFolhaLocal.push(function (l) {
    var h = '';
    if (RP.sistema('logistica') && !l.ruina) {
      var f = faltaNoLocal(l), leva = Object.keys(f).map(function (k) { return k + ':' + f[k]; }).join(',');
      h += '<a class="btn btn-p" href="#/caravana?para=' + l.id + (leva ? '&leva=' + leva : '') + '">' + RP.icone('carroca') + 'Trazer recursos</a>';
    }
    if (l.podeSalgadeira && !l.salgadeira) h += '<button type="button" class="btn btn-p" data-salgadeira="' + l.id + '">' + RP.icone('sal') + 'Salgadeira</button>';
    return h;
  });

  /* ---------------------------------------------------------------- Mais */
  RP.itensMais.push({ icone: 'carroca', titulo: 'Transportar recursos', texto: 'Caravanas de carroças e tropas entre seus locais', href: '#/caravana', sistema: 'logistica' });
})();
