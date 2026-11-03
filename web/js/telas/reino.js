/* Reino de Pedra — Meu reino (o que tenho: moradores, produção, filas e construções) e Construção (melhorar, moradias, fundar).
   É um painel sobre o mundo (o mundo continua atrás). Linguagem para quem nunca jogou: "moradores" em vez de teto,
   "pessoas trabalhando" em vez de guarnição/trabalhadores, "comportamento" em vez de postura. */
(function () {
  'use strict';
  var RP = window.RP;

  RP.TIPOS_LOCAL = { castelo: 'Castelo', vila: 'Vila', pasto: 'Pasto', serraria: 'Serraria', mina: 'Mina', quartel: 'Quartel', armazem: 'Armazém', ferraria: 'Ferraria', posto: 'Posto de extração' };
  RP.POSTURAS = { apenasDefender: 'Só defender', atacarQuemAtacar: 'Revidar quem atacar', atacarQualquer: 'Atacar qualquer ameaça' };
  RP.nomeTipoLocal = function (l) { return l.tipo === 'mina' && l.produz === 'pedra' ? 'Pedreira' : RP.TIPOS_LOCAL[l.tipo] || l.tipo; };

  /* ---------------------------------------------------------------- itens de fila */
  RP.itemFilaServidor = function (it) {
    var ini = it.inicio, fim = it.fim;
    var aguarda = !it.materialCompleto ? (it.materialChegaEm || 0) : 0;
    var rot = RP.esc(it.rotulo);
    var cancelar = '<button type="button" class="btn btn-fantasma btn-icone btn-mini" data-cancelar="' + it.id + '" data-fila="' + (it.fila || 'obras') + '" aria-label="Cancelar ' + rot + '">' + RP.icone('fechar') + '</button>';
    if (ini && fim && (it.qtd || 1) > 1 && it.proximoFim) {
      /* várias unidades: cada uma fica pronta no seu tempo; a barra anda por unidade */
      var q = it.qtd, porUn = (fim - ini) / q, pf = it.proximoFim, iu = pf - porUn, ag = RP.agora();
      var pct = Math.max(0, Math.min(100, (100 * (ag - iu)) / porUn));
      return '<div class="item-fila"><div class="timer"><div class="timer-topo"><b>' + rot + '</b><span class="timer-resta" data-fim="' + pf + '">' + RP.fmtResta(pf - ag) + '</span></div>' +
        '<div class="barra" role="progressbar" aria-label="Progresso da próxima unidade: ' + rot + '"><i data-ini="' + iu + '" data-barra-fim="' + pf + '" style="width:' + pct.toFixed(1) + '%"></i></div>' +
        '<small class="fraco fila-prontos">' + (it.prontos || 0) + ' de ' + q + ' prontos · todos em <span data-fim="' + fim + '">' + RP.fmtResta(fim - ag) + '</span></small></div>' + cancelar + '</div>';
    }
    if (ini && fim) return '<div class="item-fila">' + RP.timerHTML(rot, 0, (fim - ini) / 1000, '', fim) + cancelar + '</div>';
    var estado = !it.materialCompleto
      ? '<span class="selo selo-antigo selo-material">' + RP.icone('carroca') + (aguarda ? 'material chega em <span data-fim="' + aguarda + '">' + RP.fmtResta(aguarda - RP.agora()) + '</span>' : 'esperando material') + '</span>'
      : '<span class="selo">Na fila</span>';
    return '<div class="item-fila"><div class="timer"><div class="timer-topo"><b>' + rot + '</b>' + estado + '<span class="fraco">' + RP.fmtDuracao(it.duracao) + '</span></div></div>' + cancelar + '</div>';
  };
  /* texto curto para o aviso depois de pôr algo na fila: hora de fim só quando já começou (nunca "Invalid Date") */
  RP.textoFilaItem = function (it) {
    if (!it) return '';
    if (!it.materialCompleto) return 'O material está a caminho; começa quando chegar.';
    if (it.inicio && it.fim && (it.qtd || 1) > 1 && it.proximoFim) return 'A primeira fica pronta ' + RP.fmtEm(it.proximoFim) + '; todas ' + RP.fmtEm(it.fim) + '.';
    if (it.inicio && it.fim) return 'Pronto ' + RP.fmtEm(it.fim) + '.';
    return 'Na fila: começa quando o item anterior terminar.';
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-cancelar]');
    if (!b) return;
    RP.modal({
      titulo: 'Cancelar este item?',
      corpo: '<p class="suave">O material que já chegou fica no local da obra. O que está a caminho chega e fica lá também. Num item de várias unidades, as que já ficaram prontas continuam suas.</p>',
      acoes: [
        { rotulo: 'Cancelar item', classe: 'btn-perigo', acao: function () { RP.tentar(RP.del('/filas/' + b.getAttribute('data-fila') + '/' + b.getAttribute('data-cancelar'))).then(RP.recarregarReino); } },
        { rotulo: 'Manter' }
      ]
    });
  });

  function filaHTML(nome, titulo, icone) {
    var f = (RP.reino.filas || {})[nome] || [];
    if (!f.length) return '';
    return '<div class="card-titulo" style="margin:var(--esp-2) 0 0">' + RP.icone(icone) + '<h3>' + titulo + '</h3><span class="selo">' + f.length + ' de 10</span></div>' +
      f.map(function (i) { i.fila = nome; return RP.itemFilaServidor(i); }).join('');
  }

  /* uma linha por construção: ícone, nome, nível, produção por hora, guardado e capacidade */
  function obraDoLocal(l) {
    return ((RP.reino.filas || {}).obras || []).filter(function (o) { return o.localId === l.id; })[0];
  }
  function linhaLocal(l) {
    var ks = Object.keys(l.taxa || {}), k = ks[0], obra = obraDoLocal(l);
    var est = k ? RP.qtdRecurso(k, l.id) : 0, cap = k && l.cap ? l.cap[k] : 0, pct = cap ? Math.min(100, 100 * est / cap) : 0;
    var sub = RP.nomeTipoLocal(l) + (l.tipo === 'castelo' ? ' · sede' : '') + (obra ? ' · ' + (obra.inicio && obra.fim ? 'obra termina em <span data-fim="' + obra.fim + '">' + RP.fmtResta(obra.fim - RP.agora()) + '</span>' : 'obra esperando material') : '');
    return '<button type="button" class="linha-local' + (obra ? ' obra' : '') + '" data-local="' + l.id + '">' +
      '<span class="ico-placa dono-meu">' + RP.icone(RP.iconeLocal(l)) + '</span>' +
      '<span class="ll-nome"><span>' + RP.esc(l.nome) + '</span><span class="selo-nv">Nv ' + l.nivel + '</span></span>' +
      '<span class="ll-sub">' + sub + '</span>' +
      (l.tipo === 'castelo'
        ? '<span class="ll-prod">' + RP.icone('populacao', 'ico-p r-populacao') + RP.num(RP.reino.pop) + '</span><span class="ll-estoque">' + ks.length + ' recursos básicos</span>'
        : k ? '<span class="ll-prod">' + RP.icone(k, 'ico-p r-' + k) + '+' + RP.num(l.taxa[k]) + '/h</span>' +
          '<span class="ll-estoque' + (pct >= 95 ? ' cheio' : '') + '"><span data-rec="' + k + '" data-local="' + l.id + '" data-curto>' + RP.numCurto(est) + '</span>' + (cap ? ' de ' + RP.numCurto(cap) + '<span class="mini-barra"><i style="width:' + pct.toFixed(0) + '%"></i></span>' : '') + '</span>'
        : '<span class="ll-prod fraco">' + (RP.somaGrupo(l.guarnicao) ? RP.somaGrupo(l.guarnicao) + ' tropas' : '') + '</span><span class="ll-estoque">' + (l.tipo === 'armazem' ? 'guarda o excedente' : l.tipo === 'quartel' ? 'recruta tropas' : l.tipo === 'ferraria' ? 'armas e eras' : '') + '</span>') +
      (function () { var x = RP.extrasCardLocal.map(function (f) { return f(l) || ''; }).join(''); return x ? '<span class="ll-extra">' + x + '</span>' : ''; })() +
      '</button>';
  }
  /* sistemas acrescentam linhas ao card do local: RP.extrasCardLocal.push(function (local) { return html; }) */
  RP.extrasCardLocal = RP.extrasCardLocal || [];
  RP.extrasFolhaLocal = RP.extrasFolhaLocal || [];
  RP.acoesFolhaLocal = RP.acoesFolhaLocal || [];
  RP.extrasReino = RP.extrasReino || [];

  RP.folhaLocal = function (id) {
    var l = RP.local(id); if (!l) return;
    var m = l.melhoria, ks = Object.keys(l.taxa || {}), k = ks[0];
    var g = Object.keys(l.guarnicao || {}).filter(function (x) { return l.guarnicao[x] > 0; });
    var obra = obraDoLocal(l);
    var corpo = '<div class="info">' +
      (k && l.tipo !== 'castelo' ? '<div class="info-linha"><span class="fraco">Produz</span><span>' + RP.icone(k, 'ico-p r-' + k) + ' +' + RP.num(l.taxa[k]) + ' ' + RP.nomeRecurso(k) + ' por hora</span></div>' : '') +
      '<div class="info-linha"><span class="fraco">Guardado aqui</span><span>' + RP.estoqueHTML(l.id) + '</span></div>' +
      (l.trabalhadores ? '<div class="info-linha"><span class="fraco">Pessoas trabalhando</span><span>' + l.trabalhadores + '</span></div>' : '') +
      (l.moradias ? '<div class="info-linha"><span class="fraco">Moradias</span><span>' + l.moradias + '</span></div>' : '') +
      '<div class="info-linha"><span class="fraco">Tropas aqui</span><span>' + (g.length ? RP.esc(RP.partesGrupo(l.guarnicao)) : 'nenhuma, só a população defende') + '</span></div>' +
      '<div class="info-linha"><span class="fraco">Comportamento</span><span class="selo selo-info">' + (RP.POSTURAS[l.postura] || '') + '</span></div>' +
      (obra ? '<div class="info-linha"><span class="fraco">Obra</span><span>' + RP.esc(obra.rotulo) + ' · ' + (obra.inicio && obra.fim ? 'termina em <span data-fim="' + obra.fim + '">' + RP.fmtResta(obra.fim - RP.agora()) + '</span>' : 'esperando material') + '</span></div>' : '') +
      '<div class="info-linha"><span class="fraco">Onde</span><span>' + (RP.hex.NOME_TERRENO[l.terreno] || '') + '</span></div>' +
      RP.extrasFolhaLocal.map(function (f) { return f(l) || ''; }).join('') +
      '</div>' +
      (m ? '<div class="secao-titulo">Melhorar para o nível ' + m.nivel + '</div><div class="card pilha">' + RP.custoHTML(m.custo) +
        '<span class="fraco">' + RP.icone('relogio', 'ico-p') + RP.fmtDuracao(m.seg) + ' de obra' + (m.bloqueio ? ' · ' + RP.esc(m.bloqueio) : '') + '</span></div>' : '');
    RP.abrirFolha({
      titulo: RP.esc(l.nome),
      subtitulo: '<span class="fraco">' + RP.nomeTipoLocal(l) + ' · Nível ' + l.nivel + '</span>',
      icone: '<span class="ico-placa folha-ico dono-meu">' + RP.icone(RP.iconeLocal(l)) + '</span>',
      corpo: corpo,
      acoes: (m && !m.bloqueio ? '<button type="button" class="btn btn-p btn-primario" data-melhorar="' + l.id + '">' + RP.icone('martelo') + 'Melhorar</button>' : '') +
        (l.tipo === 'castelo' || l.tipo === 'vila' ? '<button type="button" class="btn btn-p" data-moradia="' + l.id + '">' + RP.icone('moradia') + 'Moradia</button>' : '') +
        '<a class="btn btn-p" href="#/mapa?foco=' + l.hex + '">' + RP.icone('mapa') + 'Ver no mapa</a>' +
        RP.acoesFolhaLocal.map(function (f) { return f(l) || ''; }).join('') +
        '<a class="btn btn-p" href="#/posturas?local=' + l.id + '">' + RP.icone('escudo') + 'Comportamento</a>'
    });
  };

  document.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-melhorar]'))) {
      RP.tentar(RP.post('/obras', { acao: 'melhorar', localId: +b.getAttribute('data-melhorar') })).then(function (it) {
        RP.fecharFolha(); RP.aviso({ titulo: 'Na fila: ' + it.rotulo, texto: RP.textoFilaItem(it), icone: 'martelo', tipo: 'sucesso' }); RP.recarregarReino();
      });
    } else if ((b = e.target.closest('[data-moradia]'))) {
      RP.tentar(RP.post('/obras', { acao: 'moradia', localId: +b.getAttribute('data-moradia') })).then(function (it) {
        RP.fecharFolha(); RP.aviso({ titulo: 'Na fila: ' + it.rotulo, texto: RP.textoFilaItem(it), icone: 'moradia', tipo: 'sucesso' }); RP.recarregarReino();
      });
    } else if ((b = e.target.closest('[data-local]')) && RP.local(+b.getAttribute('data-local'))) {
      RP.folhaLocal(+b.getAttribute('data-local'));
    }
  });

  /* população como soma: "População 120 + Tropas 16 = 136 de 160 moradores" */
  RP.popSomaHTML = function (r) {
    r = r || RP.reino; if (!r) return '';
    var tot = r.pop + r.tropas;
    return '<div class="pop-soma"><span>População <b data-pop>' + RP.num(r.pop) + '</b></span><span class="op">+</span><span>Tropas <b>' + RP.num(r.tropas) + '</b></span>' +
      '<span class="total">' + RP.num(tot) + ' de ' + RP.num(r.teto) + ' moradores</span></div>' +
      '<div class="barra" role="progressbar" aria-label="Moradores: ' + RP.num(tot) + ' de ' + RP.num(r.teto) + '"><i style="width:' + Math.min(100, 100 * tot / r.teto).toFixed(1) + '%"></i></div>';
  };

  function desenhar(el) {
    var r = RP.reino; if (!r) return;
    var locais = r.locais.slice().sort(function (a, b) { return (a.id === r.casteloId ? -1 : b.id === r.casteloId ? 1 : 0) || b.nivel - a.nivel; });
    var resta = RP.mundo ? Math.max(0, Math.ceil((RP.mundo.fim - RP.agora()) / 86400000)) : 0;
    var obras = (r.filas || {}).obras || [], recr = (r.filas || {}).recrutamento || [];
    el.innerHTML =
      '<header class="topo topo-reino">' + RP.iconeReino(r, 32) +
      '<div class="topo-titulos"><h1>' + RP.esc(r.nome) + '</h1><small>' + RP.icone('temporada', 'ico-p') + (RP.mundo ? 'Temporada ' + RP.mundo.temporada + ' · ' + resta + ' dias' : '') + '</small></div>' +
      '<button type="button" class="btn btn-fantasma btn-icone" data-painel-recolher aria-label="Recolher o painel e ver o mundo">' + RP.icone('mapa') + '</button>' +
      '</header>' +
      '<div class="conteudo-tela conteudo-reino">' +
      '<div class="acoes-tela" style="margin-top:0"><a class="btn btn-p btn-primario" href="#/construcao">' + RP.icone('martelo') + 'Construir</a>' +
      (RP.telas.recrutamento ? '<a class="btn btn-p" href="#/recrutamento">' + RP.icone('tropas') + 'Recrutar</a>' : '') +
      '<button type="button" class="btn btn-p" data-abrir-recursos>' + RP.icone('relogio') + 'Produção</button></div>' +
      RP.extrasReino.map(function (f) { return f(r) || ''; }).join('') +
      (r.escudoAte ? '<div class="card faixa-escudo">' + RP.icone('escudo') + '<div><b>' + (r.escudoExilio ? 'Escudo de exílio' : 'Escudo de novato') + '</b><br><span class="suave">Ninguém ataca você por <span data-fim="' + r.escudoAte + '">' + RP.fmtResta(r.escudoAte - RP.agora()) + '</span>.</span></div></div>' : '') +
      '<div class="card pop-card">' + RP.popSomaHTML(r) +
      '<ul class="pop-linhas">' +
      '<li>' + RP.icone('martelo', 'ico-p') + '<span>As construções precisam de <b>' + RP.num(r.trabalhadores) + ' pessoas</b> trabalhando' + (r.eficiencia < 1 ? ': faltam braços, produzem <b>' + Math.round(r.eficiencia * 100) + '%</b>' : '') + '. Cada soldado é uma pessoa a menos no trabalho.</span></li>' +
      '<li>' + RP.icone('moradia', 'ico-p') + '<span>Castelo + <b>' + r.moradias + ' moradias</b> abrigam ' + RP.num(r.teto) + '. Próxima moradia: ' + RP.custoHTML(r.custos.moradia) + '</span></li>' +
      '</ul></div>' +
      (obras.length || recr.length ? '<div class="card pilha" style="gap:var(--esp-2)">' + filaHTML('obras', 'Obras', 'martelo') + (RP.telas.recrutamento ? filaHTML('recrutamento', 'Recrutamento', 'tropas') : '') + '</div>' : '') +
      '<div class="secao-titulo">Minhas construções <span class="selo">' + locais.length + '</span></div><div class="card lista-compacta" style="padding:4px var(--esp-2)">' + locais.map(linhaLocal).join('') + '</div>' +
      '</div>';
  }

  RP.registrarTela('reino', {
    nav: true,
    montar: function (el) {
      document.addEventListener('rp:reino', function () { if (RP.$('[data-tela=reino]') && !RP.$('[data-tela=reino]').hidden) desenhar(el); });
    },
    entrar: function (el) { desenhar(el); RP.recarregarReino(); }
  });

  /* ---------------------------------------------------------------- construção */
  var NOMES_FUNDAR = { vila: 'Vila', pasto: 'Pasto', serraria: 'Serraria', pedreira: 'Pedreira', mina: 'Mina de ferro', quartel: 'Quartel', armazem: 'Armazém', ferraria: 'Ferraria' };
  var DESC_FUNDAR = {
    vila: 'Produz comida e abriga moradias.', pasto: 'Produz comida.', serraria: 'Produz madeira.', pedreira: 'Produz pedra.', mina: 'Produz ferro.',
    quartel: 'Recrutamento de tropas.', armazem: 'Guarda o excedente e os valiosos.', ferraria: 'Eras, armas e armaduras.'
  };
  RP.NOMES_FUNDAR = NOMES_FUNDAR;
  RP.extrasConstrucao = RP.extrasConstrucao || [];

  function desenharConstrucao(el, aba) {
    var r = RP.reino; if (!r) return;
    aba = aba || 'economia';
    var extras = RP.extrasConstrucao.filter(function (x) { return !x.sistema || RP.sistema(x.sistema); });
    var abas = [['economia', 'Melhorar'], ['populacao', 'Moradias'], ['novos', 'Novo local']].concat(extras.map(function (x) { return [x.aba, x.nome]; }));
    var corpo = '';
    if (aba === 'economia') {
      corpo = r.locais.slice().sort(function (a, b) { return a.nivel - b.nivel; }).map(function (l) {
        var m = l.melhoria;
        return '<div class="card pilha" style="gap:var(--esp-2)"><div class="linha-entre"><span class="linha">' + RP.icone(RP.iconeLocal(l)) + '<b>' + RP.esc(l.nome) + '</b></span><span class="selo-nv">Nv ' + l.nivel + (m ? ' → ' + m.nivel : '') + '</span></div>' +
          (m ? '<div class="linha-entre" style="align-items:flex-start">' + RP.custoHTML(m.custo) + '<span class="fraco" style="white-space:nowrap">' + RP.fmtDuracao(m.seg) + '</span></div>' +
            (m.bloqueio ? '<p class="fraco">' + RP.esc(m.bloqueio) + '</p>' : '<button type="button" class="btn btn-p" data-melhorar="' + l.id + '">' + RP.icone('martelo') + 'Melhorar</button>')
            : '<p class="fraco">Nível máximo.</p>') + '</div>';
      }).join('');
    } else if (aba === 'populacao') {
      var lugares = r.locais.filter(function (l) { return l.tipo === 'castelo' || l.tipo === 'vila'; });
      corpo = '<div class="card pilha"><b>Moradia</b><p class="suave">+60 moradores. Cada moradia custa mais que a anterior.</p>' +
        '<div class="linha-entre" style="align-items:flex-start">' + RP.custoHTML(r.custos.moradia) + '<span class="fraco">' + RP.fmtDuracao(r.custos.moradiaSeg) + '</span></div>' +
        lugares.map(function (l) { return '<button type="button" class="btn btn-p" data-moradia="' + l.id + '">' + RP.icone('moradia') + 'Em ' + RP.esc(l.nome) + '</button>'; }).join('') + '</div>';
    } else if (aba === 'novos') {
      corpo = '<p class="nota-regra">' + RP.icone('mapa', 'ico-p') + '<span>Novos locais podem ser fundados em <b>qualquer hexágono livre já explorado</b>. O custo cresce a cada novo local, e o material vai até lá a pé.</span></p>' +
        '<div class="card pilha"><div class="linha-entre"><b>Custo do próximo local</b><span class="fraco">' + RP.fmtDuracao(r.custos.novoLocalSeg) + '</span></div>' + RP.custoHTML(r.custos.novoLocal) + '</div>' +
        Object.keys(r.fundaveis || {}).map(function (k) {
          var f = r.fundaveis[k];
          return '<div class="card pilha"><div class="linha-entre"><span class="linha">' + RP.icone(RP.iconeLocal({ tipo: f.tipo, produz: f.produz })) + '<b>' + NOMES_FUNDAR[k] + '</b></span>' +
            '<span class="fraco">' + f.terrenos.map(function (t) { return RP.hex.NOME_TERRENO[t]; }).join(' ou ') + '</span></div>' +
            '<p class="suave">' + DESC_FUNDAR[k] + '</p>' +
            '<a class="btn btn-p" href="#/mapa?fundar=' + k + '">' + RP.icone('alvo') + 'Escolher no mapa</a></div>';
        }).join('');
    } else {
      var x = extras.filter(function (e) { return e.aba === aba; })[0];
      corpo = x ? x.html(r) : '';
    }
    el.innerHTML = '<header class="topo"><a class="btn btn-fantasma btn-icone" href="#/reino" aria-label="Voltar">' + RP.icone('voltar') + '</a><h1>Construção</h1></header>' +
      '<div class="abas abas-rolagem" role="tablist" style="margin:var(--esp-2) var(--esp-3) 0">' + abas.map(function (a) { return '<a role="tab" class="aba" href="#/construcao?aba=' + a[0] + '" aria-selected="' + (a[0] === aba) + '">' + a[1] + '</a>'; }).join('') + '</div>' +
      '<div class="conteudo-tela pilha">' + (((r.filas || {}).obras || []).length ? '<div class="card pilha" style="gap:var(--esp-2)">' + filaHTML('obras', 'Obras', 'martelo') + '</div>' : '') + corpo + '</div>';
    /* a aba escolhida fica à vista (no celular, "Ferraria" e as outras extras passam da largura) */
    var faixa = RP.$('.abas', el), sel = faixa && RP.$('[aria-selected="true"]', faixa);
    if (sel) faixa.scrollLeft = Math.max(0, sel.offsetLeft - faixa.offsetLeft - (faixa.clientWidth - sel.offsetWidth) / 2);
  }

  RP.registrarTela('construcao', {
    nav: true, secao: 'reino',
    montar: function (el) {
      document.addEventListener('rp:reino', function () { if (!el.hidden) desenharConstrucao(el, el.getAttribute('data-aba')); });
    },
    entrar: function (el, p) { el.setAttribute('data-aba', p.get('aba') || 'economia'); desenharConstrucao(el, p.get('aba')); }
  });
})();
