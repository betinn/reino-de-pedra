/* Reino de Pedra — Enviar tropas pelo mapa: escolher as tropas de um local → tocar no destino → rota curta ou
   segura → confirmar. Também dá nova ordem a um exército em campo (mover de novo) e desenha os exércitos no mapa.
   Ponto de extensão: RP.ordensEnvio.push({ ordem, rotulo, icone, verbo, descricao(hex, dados, envio), quando(hex, dados, envio) })
   — o combate acrescenta "atacar". Porte da ordem rápida de prototipo/js/mapa.js e militar.js. */
(function () {
  'use strict';
  var RP = window.RP, H = RP.hex;
  RP.ordensEnvio = RP.ordensEnvio || [];
  RP.NOMES_MARCHA = RP.NOMES_MARCHA || {};
  RP.NOMES_MARCHA.exercito = 'Exército';
  RP.NOMES_MARCHA.carregadores = 'Carregadores';

  /* estado do envio: { de: localId | marchaId, grupo, seguro, hex, ordem, previa } */
  var est = null;
  RP.envio = {
    ativo: function () { return !!est; },
    estado: function () { return est; },
    iniciar: function (o) { iniciar(o); },
    cancelar: function () { cancelar(); }
  };

  var ORDENS_BASE = {
    mover: { rotulo: 'Mover tropas para cá', verbo: 'Mover', icone: 'seta', titulo: 'Mover para cá',
      descricao: function () { return linha('Ordem', 'Vão até lá e ficam no lugar') + linha('Comportamento', 'Revidar: defendem e saem atrás de quem atacar'); } },
    reforcar: { rotulo: 'Reforçar', verbo: 'Reforçar', icone: 'escudo', titulo: 'Reforçar',
      descricao: function () { return linha('Ordem', 'Entram na defesa do local ao chegar'); } }
  };
  function linha(r, v) { return '<div class="info-linha"><span class="fraco">' + r + '</span><span>' + v + '</span></div>'; }
  function defOrdem(id) { return ORDENS_BASE[id] || RP.ordensEnvio.filter(function (o) { return o.ordem === id; })[0]; }

  function localDe() { return est && est.de ? RP.tropas && RP.tropas.locais.filter(function (l) { return l.id === est.de; })[0] : null; }
  function exercitoDe() { return est && est.marchaId ? RP.exercito(est.marchaId) : null; }
  function disponiveis() { var l = localDe(); return l ? l.guarnicao : {}; }
  function grupoAtual() { var e = exercitoDe(); return e ? e.tropas : est.grupo; }
  /* contagem por unidade das pessoas escolhidas pelo id (vem do mapa, que sabe o ofício de cada uma) */
  function grupoDeIds(ids) {
    var g = {}, M = RP.mapaModelo;
    (ids || []).forEach(function (id) { var p = M && M.pessoa ? M.pessoa(id) : null; if (p) g[p.oficio] = (g[p.oficio] || 0) + 1; });
    return g;
  }

  /* RP.grupoPadraoEnvio(local) → grupo ou null: o combate devolve as tropas do último ataque (ordem rápida) */
  function grupoPadrao(l) {
    var g0 = RP.grupoPadraoEnvio && RP.grupoPadraoEnvio(l);
    if (g0) return g0;
    var g = {};
    Object.keys(l.guarnicao || {}).forEach(function (k) { var n = l.guarnicao[k]; if (n > 0) g[k] = Math.max(1, Math.floor(n / 2)); });
    return g;
  }

  function iniciar(o) {
    RP.carregarTropas().then(function (t) {
      if (o.marchaId) {
        if (!RP.exercito(o.marchaId)) { RP.aviso({ titulo: 'Este exército não está mais em campo', icone: 'info' }); return; }
        est = { marchaId: o.marchaId, seguro: RP.exercito(o.marchaId).seguro };
      } else if (o.pessoas && o.pessoas.length) {
        est = { de: o.de, pessoas: o.pessoas.slice(), grupo: grupoDeIds(o.pessoas), seguro: false };
      } else {
        var l = t.locais.filter(function (x) { return x.id === o.de; })[0] || t.locais.filter(function (x) { return RP.somaGrupo(x.guarnicao) > 0; })[0];
        if (!l || !RP.somaGrupo(l.guarnicao)) { RP.aviso({ titulo: 'Nenhuma tropa para enviar', texto: 'Recrute no castelo ou no quartel.', icone: 'tropas', tipo: 'alerta' }); return; }
        est = { de: l.id, grupo: grupoPadrao(l), seguro: false };
      }
      barra();
      if (RP.selecao) RP.selecao.barra();
      RP.aviso({ titulo: 'Toque no destino', texto: 'Um local seu, ou qualquer hexágono.', icone: 'alvo', ms: 1800 });
    }, function () { /* aviso já mostrado */ });
  }
  function cancelar() { est = null; barra(); if (RP.selecao) RP.selecao.barra(); }

  /* ---------------------------------------------------------------- barra "Toque no destino" */
  function barra() {
    var tela = RP.$('[data-tela=mapa]'); if (!tela) return;
    var topo = RP.$('.mapa-topo', tela); if (!topo) return;
    var b = RP.$('.ordem-barra', topo);
    if (!b) { b = document.createElement('div'); b.className = 'ordem-barra'; b.setAttribute('role', 'status'); topo.appendChild(b); }
    b.hidden = !est;
    tela.classList.toggle('em-ordem', !!est);
    if (!est) return;
    var g = grupoAtual(), l = localDe(), n = RP.somaGrupo(g);
    b.innerHTML = '<span class="ordem-ico">' + RP.icone('alvo') + '</span><span class="ordem-txt"><b>Toque no destino</b><small>' +
      (n ? RP.esc(RP.partesGrupo(g)) : 'nenhuma tropa escolhida') + (est.pessoas ? ' · ' + est.pessoas.length + ' escolhid' + (est.pessoas.length === 1 ? 'a' : 'as') + ' pelo nome' : '') + (l ? ' · de ' + RP.esc(l.nome) : est.marchaId ? ' · exército em campo' : '') + '</small></span>' +
      (est.de ? '<button type="button" class="btn btn-p" data-envio-tropas>' + RP.icone('tropas') + 'Tropas</button>' : '') +
      '<button type="button" class="btn btn-p btn-fantasma btn-icone" data-envio-cancelar aria-label="Cancelar envio">' + RP.icone('fechar') + '</button>';
  }

  /* ---------------------------------------------------------------- folha do hexágono */
  function objetos(h, dados) { return (dados && dados.porHex && dados.porHex[h]) || []; }
  RP.mapa.acoesFolhaHex.push(function (h, dados) {
    var obj = objetos(h, dados);
    if (!est) {
      var html = '';
      var meu = obj.filter(function (o) { return o.tipo === 'local' && o.dono === 'meu'; })[0], l = meu && RP.local(meu.id);
      if (l && RP.somaGrupo(l.guarnicao)) html += '<button type="button" class="btn btn-p" data-envio-iniciar="' + l.id + '">' + RP.icone('tropas') + 'Enviar tropas daqui</button>';
      ((dados && dados.marchas) || []).filter(function (o) {
        return o.dono === 'meu' && o.marcha === 'exercito' && RP.mapaModelo && RP.mapaModelo.posMarcha(o, RP.agora()).hex === h;
      }).forEach(function (o) {
        html += '<button type="button" class="btn btn-p" data-exercito="' + o.id + '">' + RP.icone('tropas') + 'Ordens ao exército</button>';
      });
      return html;
    }
    var local = obj.filter(function (o) { return o.tipo === 'local'; })[0], botoes = [];
    if (local && local.dono === 'meu' && !local.ruina) { if (local.id !== est.de) botoes.push('reforcar'); }
    else if (!local) botoes.push('mover');
    RP.ordensEnvio.forEach(function (o) { try { if (o.quando(h, dados, est)) botoes.push(o.ordem); } catch (e) { console.error(e); } });
    if (!botoes.length) return '<p class="fraco">Escolha um local seu ou um hexágono livre.</p>';
    return botoes.map(function (id, i) {
      var d = defOrdem(id);
      return '<button type="button" class="btn btn-p' + (i ? '' : ' btn-primario') + '" data-envio-ordem="' + RP.esc(id) + '" data-envio-hex="' + h + '">' + RP.icone(d.icone || 'seta') + RP.esc(d.rotulo) + '</button>';
    }).join('');
  });
  RP.mapa.extrasFolhaHex.push(function (h) {
    if (!RP.tropas) return '';
    return RP.tropas.exercitos.filter(function (e) { return e.hex === h; }).map(function (e) {
      return linha('Exército', RP.esc(e.resumo) + ' · ' + (e.estado === 'parado' ? 'parado' : e.estado === 'retornando' ? 'voltando' : 'em marcha'));
    }).join('');
  });

  /* ---------------------------------------------------------------- confirmação */
  function opcaoCaminho(nome, r) {
    if (!r || !r.ok) return '';
    return '<button type="button" class="rota-opcao ' + nome + '" data-caminho="' + nome + '" aria-pressed="' + ((nome === 'segura') === !!est.seguro) + '">' +
      '<i class="rota-cor" aria-hidden="true"></i><span><b>' + (nome === 'curta' ? 'Rota curta' : 'Rota segura') + '</b><small>' + r.hexes + ' hexágonos' +
      (nome === 'segura' ? ' · evita a fauna conhecida' : ' · o caminho mais rápido') + '</small></span>' +
      '<span class="rota-tempo">' + RP.icone('relogio', 'ico-p') + RP.fmtDuracao(r.min * 60) + '</span></button>';
  }
  function confirmar(h, ordem) {
    est.hex = h; est.ordem = ordem;
    var corpo = est.marchaId ? { marchaId: est.marchaId, destinoHex: h } : est.pessoas ? { deLocalId: est.de, pessoas: est.pessoas, destinoHex: h } : { deLocalId: est.de, tropas: est.grupo, destinoHex: h };
    if (!RP.somaGrupo(grupoAtual())) { folhaGrupo(); return; }
    RP.tentar(RP.post('/tropas/previa', corpo)).then(function (p) { est.previa = p; folhaConfirmar(); });
  }
  /* minimapa do caminho (SVG): terreno conhecido, névoa, rio e os caminhos curto e seguro, com o escolhido em destaque.
     O mundo atrás do painel continua à vista; o minimapa mostra o caminho inteiro de uma vez. */
  RP.miniRota = function (previa, seguro, rotulo) {
    var M = RP.mapaModelo, curta = previa.curta && previa.curta.ok ? previa.curta.caminho : null, segura = previa.segura && previa.segura.ok ? previa.segura.caminho : null;
    var todos = [].concat(curta || [], segura || []);
    if (!todos.length || !M) return '';
    var cs = todos.map(H.c), ls = todos.map(H.l);
    var c0 = Math.max(0, Math.min.apply(null, cs) - 1), c1 = Math.min(H.COLS - 1, Math.max.apply(null, cs) + 1);
    var l0 = Math.max(0, Math.min.apply(null, ls) - 1), l1 = Math.min(H.LINS - 1, Math.max.apply(null, ls) + 1);
    var a = H.centro(c0, l0), b = H.centro(c1, l1);
    var vb = [a.x - H.W, a.y - H.R, b.x - a.x + 2 * H.W, b.y - a.y + 2 * H.R], out = '', c, l;
    for (l = l0; l <= l1; l++) for (c = c0; c <= c1; c++) {
      var h = H.idx(c, l), ce = H.centro(c, l), e = M.estado(h), t = M.terreno(h);
      var cls = e.v === 'desconhecido' || !t ? 'mr-nevoa' : 't-' + t;
      out += '<polygon class="hx ' + cls + (e.v === 'explorado' ? ' mr-antigo' : '') + '" points="' + H.cantos(ce.x, ce.y, H.R + 0.6) + '"/>';
      if (t && e.v !== 'desconhecido' && M.rio(h)) out += '<circle class="mr-rio" cx="' + ce.x.toFixed(0) + '" cy="' + ce.y.toFixed(0) + '" r="' + (H.R * 0.4).toFixed(0) + '"/>';
    }
    function linhaCaminho(hs, cls) {
      return '<polyline class="mr-caminho ' + cls + '" points="' + hs.map(function (x) { var q = H.centroH(x); return q.x.toFixed(0) + ',' + q.y.toFixed(0); }).join(' ') + '"/>';
    }
    if (segura) out += linhaCaminho(segura, 'mr-segura' + (seguro ? ' ativo' : ''));
    if (curta) out += linhaCaminho(curta, 'mr-curta' + (seguro ? '' : ' ativo'));
    var o = H.centroH(todos[0]), dd = H.centroH((seguro && segura ? segura : curta || segura).slice(-1)[0]);
    out += '<g transform="translate(' + o.x.toFixed(0) + ' ' + o.y.toFixed(0) + ')"><circle class="mr-pino" r="15"/></g>';
    out += '<g transform="translate(' + dd.x.toFixed(0) + ' ' + dd.y.toFixed(0) + ')"><circle class="mr-destino" r="14"/><circle class="mr-destino-c" r="5"/></g>';
    return '<div class="card mini-rota-card"><svg class="mini-rota mapa-svg" viewBox="' + vb.map(function (v) { return v.toFixed(0); }).join(' ') + '" role="img" aria-label="Caminho até ' + RP.esc(rotulo || 'o destino') + '">' + out + '</svg></div>';
  };
  function folhaConfirmar() {
    var d = defOrdem(est.ordem), p = est.previa, h = est.hex, g = grupoAtual();
    var mesma = p.segura.ok && p.curta.ok && p.segura.hexes === p.curta.hexes && p.segura.min === p.curta.min;
    if (mesma || !p.segura.ok) est.seguro = false;
    var esc = est.seguro ? p.segura : p.curta;
    var dados = RP.mapa.dados(), obj = objetos(h, dados), local = obj.filter(function (o) { return o.tipo === 'local'; })[0];
    var ex = exercitoDe();
    var corpo = '<div class="info">' + linha('Tropas', RP.selosGrupo(g)) +
      (d.descricao ? d.descricao(h, dados, est) : '') +
      linha('Chegada', esc && esc.ok ? '<b>em ' + RP.fmtDuracao(esc.min * 60) + '</b>' : '—') + '</div>' +
      '<div style="margin-top:var(--esp-2)">' + RP.cargaHTML(ex ? ex.carga : {}, p.carga) + '</div>' +
      RP.faunaVereditoHTML(p, h, g) +
      (p.curta.ok ? '<div class="secao-titulo">Caminho</div>' + RP.miniRota(p, est.seguro, local ? local.nome : 'o destino') + '<div class="pilha">' + opcaoCaminho('curta', p.curta) + (mesma ? '' : opcaoCaminho('segura', p.segura)) + '</div>' +
        (mesma ? '<p class="fraco" style="font-size:var(--fs-2)">A rota curta já é a mais segura que se conhece.</p>' : '')
        : '<p class="txt-alerta">Não há caminho até o destino.</p>');
    RP.abrirFolha({
      titulo: RP.esc(local ? d.titulo + ' ' + local.nome : d.titulo || d.rotulo),
      subtitulo: '<span class="fraco">Hexágono ' + H.c(h) + ', ' + H.l(h) + ' · velocidade ' + RP.esc((RP.VELOCIDADES[p.vel] || p.vel)) + ' (a unidade mais lenta)</span>',
      icone: '<span class="ico-placa folha-ico">' + RP.icone(d.icone || 'seta') + '</span>',
      corpo: corpo,
      acoes: '<button type="button" class="btn btn-p btn-primario' + (p.curta.ok ? '' : ' btn-inativo') + '" data-envio-confirmar>' + RP.icone(d.icone || 'seta') + RP.esc(d.verbo || d.rotulo) + '</button>' +
        (est.de ? '<button type="button" class="btn btn-p" data-envio-tropas>' + RP.icone('tropas') + 'Tropas</button>' : '') +
        '<button type="button" class="btn btn-p btn-fantasma" data-envio-trocar>' + RP.icone('alvo') + 'Trocar destino</button>'
    });
  }
  function enviar() {
    var e = est, d = defOrdem(e.ordem);
    var extra = d.dados ? d.dados(e.hex, RP.mapa.dados(), e) : undefined;
    var p = e.marchaId
      ? RP.post('/tropas/' + e.marchaId + '/ordem', { ordem: e.ordem, destinoHex: e.hex, seguro: !!e.seguro, dados: extra })
      : RP.post('/tropas/enviar', e.pessoas ? { deLocalId: e.de, pessoas: e.pessoas, destinoHex: e.hex, ordem: e.ordem, seguro: !!e.seguro, dados: extra } : { deLocalId: e.de, tropas: e.grupo, destinoHex: e.hex, ordem: e.ordem, seguro: !!e.seguro, dados: extra });
    RP.tentar(p).then(function (ex) {
      RP.fecharFolha(); cancelar();
      if (RP.selecao) RP.selecao.limpar();
      RP.aviso({ titulo: e.marchaId ? 'Nova ordem dada' : 'Tropas a caminho', texto: ex && ex.chegada ? (RP.partesGrupo(ex.tropas) + ' · chegam ' + RP.fmtEm(ex.chegada) + '.') : '', icone: d.icone || 'seta', tipo: 'sucesso' });
      if (RP.mapa.recarregar) RP.mapa.recarregar();
      RP.recarregarReino(); RP.carregarTropas().catch(function () { /* offline */ });
    });
  }

  /* ---------------------------------------------------------------- força da fauna × força do grupo
     Toda ordem para um hexágono com animais conhecidos mostra as duas forças lado a lado e um veredito simples.
     Os números vêm do servidor (previa.fauna, previa.forcaFauna, unidades[].forcaFauna); aqui só se desenha.
     Regra: com o dobro da força do bando passa ileso; acima do limite vence com perdas; abaixo, perde parte. */
  RP.VEREDITO_FAUNA = {
    perde: ['Vai perder', 'Grupo fraco demais para esse bando. Tropas mortas não voltam.', 'alerta'],
    perdeParte: ['Vai perder parte', 'Mais fraco que o bando: perde uma parte das tropas na luta.', 'alerta'],
    venceComPerdas: ['Vence com perdas', 'Mais forte que o bando, mas sai ferido.', 'escudo'],
    ileso: ['Vence sem perdas', 'Com o dobro da força do bando, ninguém se fere.', 'check']
  };
  function faunaConhecida(h) {
    var dados = RP.mapa.dados && RP.mapa.dados(), obj = objetos(h, dados);
    var f = obj.filter(function (o) { return o.tipo === 'fauna'; })[0] || obj.filter(function (o) { return o.tipo === 'perigo'; })[0];
    if (!f) return null;
    var regras = RP.exploracao && RP.exploracao.dados && RP.exploracao.dados.regras, lim = regras && regras.limites ? regras.limites[f.nivel] : null;
    if (!lim) return null;
    var idade = RP.mapaModelo ? RP.mapaModelo.estado(h) : null;
    return { animal: f.animal, qtd: f.qtd, nivel: f.nivel, forca: lim, vistoHaMin: idade && idade.v === 'explorado' ? Math.round(idade.horas * 60) : 0 };
  }
  function vereditoDe(forca, lim) { return forca >= 2 * lim ? 'ileso' : forca >= lim ? 'venceComPerdas' : forca > 0 ? 'perdeParte' : 'perde'; }
  /* quantas unidades do tipo mais forte do grupo (ou milícia) bastam para vencer e para passar ileso */
  function minimos(grupo, lim) {
    var ids = Object.keys(grupo || {}).filter(function (k) { return grupo[k] > 0; });
    var id = ids.sort(function (a, b) { var ua = RP.unidade(a), ub = RP.unidade(b); return ((ub && ub.forcaFauna) || 0) - ((ua && ua.forcaFauna) || 0); })[0] || 'milicia';
    var u = RP.unidade(id); if (!u || !u.forcaFauna) return null;
    return { nome: RP.nomeUnidade(id, 2), vencer: Math.ceil(lim / u.forcaFauna), ileso: Math.ceil(2 * lim / u.forcaFauna) };
  }
  RP.faunaVereditoHTML = function (previa, h, grupo) {
    var f = (previa && previa.fauna) || faunaConhecida(h);
    if (!f || !f.forca) return '';
    var forca = (previa && previa.forcaFauna) || 0, lim = f.forca, v = f.veredito || vereditoDe(forca, lim), V = RP.VEREDITO_FAUNA[v];
    var A = (RP.ANIMAIS || {})[f.animal] || { nome: f.animal || 'animais', icone: 'pata' }, mins = minimos(grupo, lim), topo = Math.max(2 * lim, forca) || 1;
    var nivel = (RP.NOME_NIVEL || {})[f.nivel] || f.nivel || '';
    return '<div class="card pilha" style="gap:6px;margin-top:var(--esp-3)"><div class="linha-entre"><span class="linha">' + RP.icone(A.icone, 'ico-p') + '<b>' + RP.esc(A.nome) + (f.qtd ? ' (≈ ' + f.qtd + ')' : '') + '</b></span>' +
      '<span class="selo selo-perigo-' + RP.esc(f.nivel || 'medio') + '">perigo ' + RP.esc(String(nivel).toLowerCase()) + '</span></div>' +
      (f.vistoHaMin ? '<small class="fraco">Visto ' + RP.fmtHa(f.vistoHaMin / 60) + ': o bando pode ter se movido.</small>' : '') +
      '<div class="forca-duas"><div class="fd-linha"><span class="fraco">Bando</span><div class="barra fd-bando"><i style="width:' + (100 * lim / topo).toFixed(0) + '%"></i></div><b class="num">' + RP.num(lim) + '</b></div>' +
      '<div class="fd-linha"><span class="fraco">Seu grupo</span><div class="barra fd-grupo"><i style="width:' + (100 * forca / topo).toFixed(0) + '%"></i></div><b class="num">' + RP.num(forca) + '</b></div></div>' +
      '<div class="veredito ' + v + '">' + RP.icone(V[2]) + '<span>' + V[0] + '<small>' + V[1] + '</small></span></div>' +
      (mins ? '<small class="fraco">Mande pelo menos <b>' + mins.vencer + ' ' + RP.esc(mins.nome) + '</b> para vencer e <b>' + mins.ileso + '</b> para passar ileso.</small>' : '') + '</div>';
  };

  /* ---------------------------------------------------------------- escolher tropas (e de onde saem) */
  function folhaGrupo() {
    var t = RP.tropas, l = localDe();
    if (est.pessoas) {
      var M = RP.mapaModelo;
      RP.abrirFolha({
        titulo: 'Quem vai',
        subtitulo: '<span class="fraco">Escolhid' + (est.pessoas.length === 1 ? 'a' : 'as') + ' pelo nome, de ' + RP.esc(l ? l.nome : '—') + '.</span>',
        corpo: '<div class="lista pessoas-lista">' + est.pessoas.map(function (id) {
          var p = M && M.pessoa ? M.pessoa(id) : null;
          return '<div class="lista-item"><span class="ico-placa dono-meu">' + RP.icone(RP.iconeUnidade(p ? p.oficio : 'lanceiro')) + '</span><div style="flex:1"><b>' + RP.esc(p ? p.nome : '#' + id) + '</b><div class="fraco">' + RP.esc(p ? RP.nomeUnidade(p.oficio, 1) : '') + '</div></div></div>';
        }).join('') + '</div>',
        acoes: '<button type="button" class="btn btn-p btn-primario" data-envio-pronto>' + RP.icone('check') + 'Pronto</button>' +
          '<button type="button" class="btn btn-p btn-fantasma" data-envio-por-quantidade>' + RP.icone('tropas') + 'Escolher por quantidade</button>'
      });
      return;
    }
    var origens = t.locais.filter(function (x) { return RP.somaGrupo(x.guarnicao) > 0; });
    RP.abrirFolha({
      titulo: 'Tropas do envio',
      subtitulo: '<span class="fraco">Saem de ' + RP.esc(l ? l.nome : '—') + '. O resto fica defendendo.</span>',
      corpo: (origens.length > 1 ? '<div class="abas abas-rolagem envio-origens" role="group" aria-label="De onde saem">' + origens.map(function (x) {
        return '<button type="button" class="aba" data-envio-de="' + x.id + '" aria-pressed="' + (x.id === est.de) + '">' + RP.esc(x.nome) + '</button>';
      }).join('') + '</div>' : '') +
        '<div class="card pilha" data-envio-grupo>' + RP.grupoTropas.linhas(est.grupo, disponiveis()) + '</div>',
      acoes: '<button type="button" class="btn btn-p btn-primario" data-envio-pronto>' + RP.icone('check') + 'Pronto</button>'
    });
  }

  document.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-envio-iniciar]'))) { RP.fecharFolha(); iniciar({ de: +b.getAttribute('data-envio-iniciar') }); return; }
    if (!est) return;
    if (e.target.closest('[data-envio-cancelar]')) { RP.fecharFolha(); cancelar(); return; }
    if (e.target.closest('[data-envio-tropas]')) { folhaGrupo(); return; }
    if (e.target.closest('[data-envio-por-quantidade]')) { var lq = localDe(); est.pessoas = null; est.grupo = lq ? grupoPadrao(lq) : {}; if (RP.selecao) RP.selecao.limpar(); folhaGrupo(); barra(); return; }
    if ((b = e.target.closest('[data-envio-de]'))) {
      var l = RP.tropas.locais.filter(function (x) { return x.id === +b.getAttribute('data-envio-de'); })[0];
      if (l) { est.de = l.id; est.grupo = grupoPadrao(l); folhaGrupo(); barra(); }
      return;
    }
    if (e.target.closest('[data-envio-grupo]') && RP.grupoTropas.clique(e, est.grupo, disponiveis())) {
      RP.$('[data-envio-grupo]').innerHTML = RP.grupoTropas.linhas(est.grupo, disponiveis()); barra(); return;
    }
    if (e.target.closest('[data-envio-pronto]')) { RP.fecharFolha(); barra(); if (est.hex != null && est.ordem) confirmar(est.hex, est.ordem); return; }
    if ((b = e.target.closest('[data-envio-ordem]'))) { confirmar(+b.getAttribute('data-envio-hex'), b.getAttribute('data-envio-ordem')); return; }
    if ((b = e.target.closest('[data-caminho]')) && est.previa) { est.seguro = b.getAttribute('data-caminho') === 'segura'; folhaConfirmar(); return; }
    if (e.target.closest('[data-envio-trocar]')) { RP.fecharFolha(); est.hex = null; RP.aviso({ titulo: 'Toque no novo destino', icone: 'alvo', ms: 1600 }); return; }
    if (e.target.closest('[data-envio-confirmar]')) { if (est.previa && est.previa.curta.ok) enviar(); }
  });

  /* entrar no mapa com #/mapa?enviar=<local> ou #/mapa?mover=<exército> começa o envio */
  document.addEventListener('rp:tela', function (ev) {
    if (ev.detail !== 'mapa') { if (est) cancelar(); return; }
    var q = new URLSearchParams((location.hash.split('?')[1]) || '');
    RP.carregarTropas().catch(function () { /* offline */ });
    var limpar = function () { try { history.replaceState(null, '', '#/mapa'); } catch (e) { /* ignora */ } };
    if (q.get('enviar')) { limpar(); iniciar({ de: +q.get('enviar') }); }
    else if (q.get('mover')) { limpar(); iniciar({ marchaId: +q.get('mover') }); }
    else barra();
  });

  /* ---------------------------------------------------------------- exércitos no mapa: o Mapa e a Vista desenham pelo tipo */
  RP.mapa.tiposMarcha = RP.mapa.tiposMarcha || {};
  RP.mapa.tiposMarcha.exercito = RP.mapa.tiposMarcha.exercito || { nome: 'Exército', icone: 'tropas' };
})();
