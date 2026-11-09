/* Reino de Pedra — Recrutamento: escolher o local (castelo ou quartel), quantidade por unidade (−/+, +5, +10, Máx.),
   resumo com custo, população e tempo, e bloqueios por requisito. O material vem sozinho até o local.
   Porte de prototipo/js/acoes.js (Recrutamento); os dados vêm de GET /tropas. */
(function () {
  'use strict';
  var RP = window.RP;
  var pedido = {}, localSel = null;
  var VEL_PONTOS = { 'Lenta': 2, 'Média': 3, 'Rápida': 5 };

  function locaisRecruta() { return (RP.tropas ? RP.tropas.locais : []).filter(function (l) { return l.recruta; }); }
  function localAtual() {
    var ls = locaisRecruta();
    return ls.filter(function (l) { return l.id === localSel; })[0] || ls.filter(function (l) { return l.tipo === 'castelo'; })[0] || ls[0];
  }
  function filaRecrut() { return (RP.reino && RP.reino.filas && RP.reino.filas.recrutamento) || []; }

  /* o que já foi escolhido nas outras unidades (para não passar da população e do estoque do reino) */
  function usado(excetoId) {
    var pop = 0, custo = {};
    Object.keys(pedido).forEach(function (id) {
      var q = pedido[id], u = RP.unidade(id); if (!q || !u || id === excetoId) return;
      pop += u.pop * q;
      Object.keys(u.custo).forEach(function (k) { custo[k] = (custo[k] || 0) + u.custo[k] * q; });
    });
    return { pop: pop, custo: custo };
  }
  function maxRecrutavel(u) {
    var us = usado(u.id), livres = 10 - filaRecrut().length - Object.keys(pedido).filter(function (id) { return pedido[id] && id !== u.id; }).length;
    if (livres <= 0) return 0;
    /* falta de recurso não limita: o item aguarda na fila; a gente, sim (os que aguardam já contam com a deles) */
    var m = Math.floor(((RP.reino ? RP.reino.pop - (RP.reino.popAguardando || 0) : 0) - us.pop) / u.pop);
    return Math.max(0, m);
  }
  function maxDe(lista, campo) { return Math.max.apply(null, lista.map(function (u) { return u[campo]; })) || 1; }
  function bloqueioNoLocal(u, l) {
    if (u.bloqueio) return u.bloqueio;
    if (l && l.unidades.indexOf(u.id) < 0) return 'Só no quartel';
    return null;
  }
  function fortes(u) { return u.vence ? [RP.FAMILIAS[u.vence] || u.vence] : []; }
  function fracos(u) {
    var fam = {};
    RP.tropas.unidades.forEach(function (x) { if (x.vence === u.fam) fam[x.fam] = 1; });
    return Object.keys(fam).map(function (f) { return RP.FAMILIAS[f] || f; });
  }

  function cartaoUnidade(u, l, maxes) {
    var q = pedido[u.id] || 0, max = maxRecrutavel(u), bloq = bloqueioNoLocal(u, l), ui = RP.UNIDADES_UI[u.id] || {};
    var custo = Object.assign({}, u.custo, { populacao: u.pop });
    return '<div class="card unid-card' + (bloq ? ' bloqueado' : '') + (q ? ' ativo' : '') + '" data-unidade="' + u.id + '">' +
      '<div class="unid-topo"><span class="ico-placa ico-placa-g">' + RP.icone(RP.iconeUnidade(u.id)) + '</span><div class="unid-titulos"><b>' + RP.esc(u.nome) + '</b><small class="fraco">' + RP.esc(ui.papel || RP.FAMILIAS[u.fam] || '') + '</small></div>' +
      (bloq ? '<span class="selo selo-desconhecido">' + RP.icone('cadeado') + RP.esc(bloq) + '</span>' : '<span class="selo">' + RP.icone('relogio') + RP.fmtResta(u.tempo * 1000).replace(/^00:/, '0:') + '/un.</span>') + '</div>' +
      (u.so === 'defesa' ? '<p class="fraco" style="font-size:var(--fs-2)">Só defende: não sai para atacar.</p>' : '') +
      '<div class="unid-vantagens">' + fortes(u).map(function (x) { return '<span class="selo selo-visivel">Forte contra ' + RP.esc(x.toLowerCase()) + '</span>'; }).join('') +
      fracos(u).map(function (x) { return '<span class="selo selo-perigo">Fraco contra ' + RP.esc(x.toLowerCase()) + '</span>'; }).join('') + '</div>' +
      '<div class="unid-atrib"><span>Ataque ' + u.atk + RP.pontos(Math.ceil(5 * u.atk / maxes.atk)) + '</span><span>Defesa ' + u.def + RP.pontos(Math.ceil(5 * u.def / maxes.def)) + '</span>' +
      '<span>Velocidade' + RP.pontos(VEL_PONTOS[u.vel] || 1) + '</span><span>Carga ' + u.carga + RP.pontos(Math.ceil(5 * u.carga / maxes.carga)) + '</span></div>' +
      '<div class="linha unid-custo">' + RP.custoHTML(custo, 1, '*') + '<small class="fraco">por unidade</small></div>' +
      (bloq ? '' : '<div class="unid-qtd">' + RP.stepper(u.id, q, max) +
        '<div class="chips-rapidos"><button type="button" class="btn btn-p" data-somar="5">+5</button><button type="button" class="btn btn-p" data-somar="10">+10</button><button type="button" class="btn btn-p" data-somar="max">Máx. ' + max + '</button></div></div>') +
      '</div>';
  }

  function resumo() {
    var custo = {}, pop = 0, tempo = 0, partes = [];
    Object.keys(pedido).forEach(function (id) {
      var q = pedido[id], u = RP.unidade(id); if (!q || !u) return;
      Object.keys(u.custo).forEach(function (k) { custo[k] = (custo[k] || 0) + u.custo[k] * q; });
      pop += u.pop * q; tempo += u.tempo * q; partes.push(q + ' ' + RP.nomeUnidade(id, q));
    });
    if (pop) custo.populacao = pop;
    return { custo: custo, pop: pop, tempo: tempo, txt: partes.join(', ') };
  }

  function filaHTML() {
    var f = filaRecrut();
    return '<div class="card pilha fila-card"><div class="card-titulo" style="margin:0">' + RP.icone('tropas') + '<h3>Fila de recrutamento</h3><span class="selo">' + f.length + ' de 10</span></div>' +
      (f.length ? f.map(function (i) { i.fila = 'recrutamento'; return RP.itemFilaServidor(i); }).join('') : '<p class="fraco">Nada sendo recrutado.</p>') +
      '<p class="fraco" style="font-size:var(--fs-2)">Um item por vez; cada unidade escolhida vira um item. Na vez de cada item, o reino separa o material e as pessoas (sem recurso, ele aguarda e começa sozinho quando houver). O treino começa quando o material chega ao local, e cada tropa entra no local assim que fica pronta.</p></div>';
  }

  function desenhar(el) {
    var t = RP.tropas, r = RP.reino, box = RP.$('.recrut-conteudo', el);
    if (!t || !r) { box.innerHTML = '<p class="fraco">Carregando…</p>'; return; }
    var l = localAtual(), ls = locaisRecruta();
    if (!l) { box.innerHTML = '<p class="fraco">Nenhum local recruta agora. O castelo e o quartel treinam tropas.</p>'; return; }
    localSel = l.id;
    RP.$('.topo-titulos small', el).textContent = l.nome + ' · nível ' + l.nivel;
    var maxes = { atk: maxDe(t.unidades, 'atk'), def: maxDe(t.unidades, 'def'), carga: maxDe(t.unidades, 'carga') };
    var unidades = t.unidades.slice().sort(function (a, b) { return (bloqueioNoLocal(a, l) ? 1 : 0) - (bloqueioNoLocal(b, l) ? 1 : 0); });
    box.innerHTML =
      (ls.length > 1 ? '<div class="secao-titulo" style="margin-top:0">Onde recrutar</div><div class="escolhas recrut-locais">' + ls.map(function (x) {
        return '<button type="button" class="escolha escolha-linha" data-recrut-local="' + x.id + '" aria-pressed="' + (x.id === l.id) + '"><span class="ico-placa">' + RP.icone(RP.iconeLocal(x)) + '</span>' +
          '<span class="escolha-txt"><b>' + RP.esc(x.nome) + '</b><small class="fraco">' + (x.tipo === 'castelo' ? 'Milícia, lanceiro e arqueiro' : 'Todas as unidades') + '</small></span></button>';
      }).join('') + '</div>' : '') +
      '<div class="card pop-mini">' + (RP.popSomaHTML ? RP.popSomaHTML(r) : '') +
      '<p class="fraco" style="font-size:var(--fs-2);margin-top:6px">Recrutar transforma população em tropas quando chega a vez do item. Tropas mortas não voltam.</p></div>' +
      (filaRecrut().length ? filaHTML() : '') + '<div class="secao-titulo">Unidades</div><div class="pilha">' + unidades.map(function (u) { return cartaoUnidade(u, l, maxes); }).join('') + '</div>';
    var rs = resumo();
    RP.$('.rodape-resumo', el).innerHTML = rs.pop
      ? '<div class="resumo-linha"><b>' + RP.esc(rs.txt) + '</b><span class="tempo">' + RP.icone('relogio', 'ico-p') + RP.fmtDuracao(rs.tempo) + '</span></div>' + RP.custoHTML(rs.custo, 1, '*')
      : '<div class="resumo-linha fraco">Escolha a quantidade de cada unidade.</div>';
    RP.$('[data-recrutar]', el).classList.toggle('btn-inativo', !rs.pop);
  }

  function recrutar(el) {
    var rs = resumo(), l = localAtual();
    if (!rs.pop) { RP.aviso({ titulo: 'Nada escolhido', texto: 'Use + e − em cada unidade.', icone: 'info', tipo: 'alerta' }); return; }
    var ids = Object.keys(pedido).filter(function (id) { return pedido[id]; }), itens = [];
    var botao = RP.$('[data-recrutar]', el); botao.disabled = true;
    ids.reduce(function (p, id) {
      return p.then(function () {
        return RP.post('/recrutamento', { localId: l.id, unidade: id, qtd: pedido[id] }).then(function (it) { itens.push(it); delete pedido[id]; });
      });
    }, Promise.resolve()).then(function () {
      var chega = itens.reduce(function (m, it) { return Math.max(m, it.materialChegaEm || 0); }, 0);
      var espera = itens.some(function (it) { return it.aguardando; });
      RP.aviso({ titulo: 'Recrutamento na fila', texto: rs.txt + '.' + (espera ? ' Aguarda a vez e os recursos: começa sozinho quando houver.' : ' População −' + RP.num(rs.pop) + '.') + (chega ? ' O material chega em ' + RP.fmtResta(chega - RP.agora()) + '.' : ''), icone: chega ? 'carroca' : 'tropas', tipo: 'sucesso', ms: 4200 });
      if (RP.painel && window.matchMedia('(max-width: 899px)').matches) RP.ir('tropas');
    }, function (e) {
      RP.aviso({ titulo: e.message, texto: itens.length ? 'Parte do pedido entrou na fila.' : '', icone: 'alerta', tipo: 'perigo' });
    }).then(function () {
      botao.disabled = false;
      return Promise.all([RP.carregarReino(), RP.carregarTropas()]);
    }).then(function () { desenhar(el); }, function () { desenhar(el); });
  }

  RP.registrarTela('recrutamento', {
    secao: 'tropas',
    montar: function (el) {
      el.innerHTML = RP.topoVoltar('Recrutamento', 'tropas', ' ') + '<div class="conteudo-tela recrut-conteudo"></div>' +
        '<div class="rodape-acao rodape-com-resumo"><div class="rodape-resumo"></div><button type="button" class="btn btn-primario btn-bloco btn-grande" data-recrutar>' + RP.icone('tropas') + 'Recrutar</button></div>';
      document.addEventListener('rp:tropas', function () { if (!el.hidden) desenhar(el); });
      document.addEventListener('rp:reino', function () { if (!el.hidden) desenhar(el); });
      el.addEventListener('click', function (e) {
        var b, card = e.target.closest('[data-unidade]'), u = card && RP.unidade(card.getAttribute('data-unidade'));
        if ((b = e.target.closest('[data-recrut-local]'))) { localSel = +b.getAttribute('data-recrut-local'); pedido = {}; desenhar(el); return; }
        if ((b = e.target.closest('[data-passo]')) && u) { pedido[u.id] = Math.max(0, Math.min(maxRecrutavel(u), (pedido[u.id] || 0) + +b.getAttribute('data-passo'))); desenhar(el); return; }
        if ((b = e.target.closest('[data-somar]')) && u) {
          var v = b.getAttribute('data-somar');
          pedido[u.id] = v === 'max' ? maxRecrutavel(u) : Math.min(maxRecrutavel(u), (pedido[u.id] || 0) + +v);
          desenhar(el); return;
        }
        if (e.target.closest('[data-recrutar]')) recrutar(el);
      });
    },
    entrar: function (el, p) {
      if (p.get('local')) { localSel = +p.get('local'); pedido = {}; }
      desenhar(el);
      RP.carregarTropas().catch(function () { /* aviso já mostrado */ });
    }
  });
})();
