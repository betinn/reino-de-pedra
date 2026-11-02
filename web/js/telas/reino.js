/* Reino de Pedra — Meu reino (população, filas, castelo, locais) e Construção (melhorar, moradias, fundar). */
(function () {
  'use strict';
  var RP = window.RP;

  RP.TIPOS_LOCAL = { castelo: 'Castelo', vila: 'Vila', pasto: 'Pasto', serraria: 'Serraria', mina: 'Mina', quartel: 'Quartel', armazem: 'Armazém', ferraria: 'Ferraria', posto: 'Posto de extração' };
  RP.POSTURAS = { apenasDefender: 'Apenas defender', atacarQuemAtacar: 'Atacar apenas quem atacar', atacarQualquer: 'Atacar qualquer ameaça' };
  RP.nomeTipoLocal = function (l) { return l.tipo === 'mina' && l.produz === 'pedra' ? 'Pedreira' : RP.TIPOS_LOCAL[l.tipo] || l.tipo; };

  /* ---------------------------------------------------------------- itens de fila */
  RP.itemFilaServidor = function (it) {
    var ini = it.inicio, fim = it.fim;
    var aguarda = !it.materialCompleto ? (it.materialChegaEm || 0) : 0;
    var rot = RP.esc(it.rotulo);
    var cancelar = '<button type="button" class="btn btn-fantasma btn-icone btn-mini" data-cancelar="' + it.id + '" data-fila="' + (it.fila || 'obras') + '" aria-label="Cancelar ' + rot + '">' + RP.icone('fechar') + '</button>';
    if (ini && fim) return '<div class="item-fila">' + RP.timerHTML(rot, 0, (fim - ini) / 1000, '', fim) + cancelar + '</div>';
    var estado = !it.materialCompleto
      ? '<span class="selo selo-antigo selo-material">' + RP.icone('carroca') + (aguarda ? 'material chega em <span data-fim="' + aguarda + '">' + RP.fmtResta(aguarda - RP.agora()) + '</span>' : 'aguardando material') + '</span>'
      : '<span class="selo">Na fila</span>';
    return '<div class="item-fila"><div class="timer"><div class="timer-topo"><b>' + rot + '</b>' + estado + '<span class="fraco">' + RP.fmtDuracao(it.duracao) + '</span></div></div>' + cancelar + '</div>';
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-cancelar]');
    if (!b) return;
    RP.modal({
      titulo: 'Cancelar este item?',
      corpo: '<p class="suave">O material que já chegou fica no local da obra. O que está a caminho chega e fica lá também.</p>',
      acoes: [
        { rotulo: 'Cancelar item', classe: 'btn-perigo', acao: function () { RP.tentar(RP.del('/filas/' + b.getAttribute('data-fila') + '/' + b.getAttribute('data-cancelar'))).then(RP.recarregarReino); } },
        { rotulo: 'Manter' }
      ]
    });
  });

  function filaHTML(nome, titulo, icone) {
    var f = (RP.reino.filas || {})[nome] || [];
    return '<div class="card-titulo" style="margin:0">' + RP.icone(icone) + '<h3>' + titulo + '</h3><span class="selo">' + f.length + ' de 10</span></div>' +
      (f.length ? f.map(function (i) { i.fila = nome; return RP.itemFilaServidor(i); }).join('') : '<p class="fraco">Fila vazia.</p>');
  }

  function cardLocal(l) {
    var t = Object.keys(l.taxa || {}).filter(function () { return l.tipo !== 'castelo'; });
    return '<div class="card local-card" role="button" tabindex="0" data-local="' + l.id + '">' +
      '<span class="ico-placa dono-meu">' + RP.icone(RP.iconeLocal(l)) + '</span>' +
      '<div class="lc-corpo"><div class="linha-entre"><b class="lc-nome">' + RP.esc(l.nome) + '</b><span class="selo">Nv ' + l.nivel + '</span></div>' +
      '<small class="fraco">' + RP.nomeTipoLocal(l) + ' · ' + (RP.hex.NOME_TERRENO[l.terreno] || '') + ' · ' + RP.icone('escudo', 'ico-p') + (RP.POSTURAS[l.postura] || '') + '</small>' +
      (t.length ? '<span class="lc-prod">' + RP.icone(t[0], 'ico-p r-' + t[0]) + '+' + RP.num(l.taxa[t[0]]) + ' ' + RP.nomeRecurso(t[0]) + '/h</span>' : '') +
      '<span class="lc-estoque"><span class="fraco">Estoque</span>' + RP.estoqueHTML(l.id) + '</span>' +
      (RP.extrasCardLocal || []).map(function (f) { return f(l) || ''; }).join('') +
      '</div></div>';
  }
  /* sistemas acrescentam linhas ao card do local: RP.extrasCardLocal.push(function (local) { return html; }) */
  RP.extrasCardLocal = RP.extrasCardLocal || [];
  RP.extrasFolhaLocal = RP.extrasFolhaLocal || [];
  RP.acoesFolhaLocal = RP.acoesFolhaLocal || [];
  RP.extrasReino = RP.extrasReino || [];

  RP.folhaLocal = function (id) {
    var l = RP.local(id); if (!l) return;
    var m = l.melhoria;
    var g = Object.keys(l.guarnicao || {}).filter(function (k) { return l.guarnicao[k] > 0; });
    var corpo = '<div class="info">' +
      '<div class="info-linha"><span class="fraco">Tipo</span><span>' + RP.nomeTipoLocal(l) + '</span></div>' +
      '<div class="info-linha"><span class="fraco">Terreno</span><span>' + (RP.hex.NOME_TERRENO[l.terreno] || '') + '</span></div>' +
      '<div class="info-linha"><span class="fraco">Nível</span><span>' + l.nivel + '</span></div>' +
      (l.trabalhadores ? '<div class="info-linha"><span class="fraco">Trabalhadores</span><span>' + l.trabalhadores + '</span></div>' : '') +
      (l.moradias ? '<div class="info-linha"><span class="fraco">Moradias</span><span>' + l.moradias + '</span></div>' : '') +
      '<div class="info-linha"><span class="fraco">Guarnição</span><span>' + (g.length ? g.map(function (k) { return l.guarnicao[k] + ' ' + k; }).join(' · ') : 'nenhuma') + '</span></div>' +
      '<div class="info-linha"><span class="fraco">Postura</span><span class="selo selo-info">' + (RP.POSTURAS[l.postura] || '') + '</span></div>' +
      '<div class="info-linha"><span class="fraco">Estoque</span><span>' + RP.estoqueHTML(l.id) + '</span></div>' +
      RP.extrasFolhaLocal.map(function (f) { return f(l) || ''; }).join('') +
      '</div>' +
      (m ? '<div class="secao-titulo">Melhorar para o nível ' + m.nivel + '</div><div class="card pilha">' + RP.custoHTML(m.custo) +
        '<span class="fraco">' + RP.icone('relogio', 'ico-p') + RP.fmtDuracao(m.seg) + (m.bloqueio ? ' · ' + RP.esc(m.bloqueio) : '') + '</span></div>' : '');
    RP.abrirFolha({
      titulo: RP.esc(l.nome), veu: true,
      subtitulo: '<span class="fraco">' + RP.nomeTipoLocal(l) + ' · Nível ' + l.nivel + '</span>',
      icone: '<span class="ico-placa folha-ico dono-meu">' + RP.icone(RP.iconeLocal(l)) + '</span>',
      corpo: corpo,
      acoes: (m && !m.bloqueio ? '<button type="button" class="btn btn-p btn-primario" data-melhorar="' + l.id + '">' + RP.icone('martelo') + 'Melhorar</button>' : '') +
        (l.tipo === 'castelo' || l.tipo === 'vila' ? '<button type="button" class="btn btn-p" data-moradia="' + l.id + '">' + RP.icone('moradia') + 'Moradia</button>' : '') +
        '<a class="btn btn-p" href="#/mapa?foco=' + l.hex + '">' + RP.icone('mapa') + 'Ver no mapa</a>' +
        RP.acoesFolhaLocal.map(function (f) { return f(l) || ''; }).join('')
    });
  };

  document.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-melhorar]'))) {
      RP.tentar(RP.post('/obras', { acao: 'melhorar', localId: +b.getAttribute('data-melhorar') })).then(function (it) {
        RP.fecharFolha(); RP.aviso({ titulo: 'Na fila: ' + it.rotulo, texto: it.materialCompleto ? '' : 'O material está a caminho.', icone: 'martelo', tipo: 'sucesso' }); RP.recarregarReino();
      });
    } else if ((b = e.target.closest('[data-moradia]'))) {
      RP.tentar(RP.post('/obras', { acao: 'moradia', localId: +b.getAttribute('data-moradia') })).then(function (it) {
        RP.fecharFolha(); RP.aviso({ titulo: 'Na fila: ' + it.rotulo, icone: 'moradia', tipo: 'sucesso' }); RP.recarregarReino();
      });
    } else if ((b = e.target.closest('[data-local]')) && RP.local(+b.getAttribute('data-local'))) {
      RP.folhaLocal(+b.getAttribute('data-local'));
    }
  });

  function desenhar(el) {
    var r = RP.reino; if (!r) return;
    var c = RP.castelo(), outros = r.locais.filter(function (l) { return l.id !== r.casteloId; });
    var resta = RP.mundo ? Math.max(0, Math.ceil((RP.mundo.fim - RP.agora()) / 86400000)) : 0;
    el.innerHTML =
      '<header class="topo topo-reino">' + RP.iconeReino(r, 36) +
      '<div class="topo-titulos"><h1>Reino de ' + RP.esc(r.nome) + '</h1><small>' + RP.icone('temporada', 'ico-p') + (RP.mundo ? 'Temporada ' + RP.mundo.temporada + ' · ' + resta + ' dias restantes' : '') + '</small></div>' +
      '<button type="button" class="btn btn-fantasma btn-icone btn-sino-topo" data-abrir-notificacoes aria-label="Notificações">' + RP.icone('sino') + '<span class="contador"' + (RP.naoLidas ? '' : ' hidden') + '>' + RP.naoLidas + '</span></button>' +
      '</header>' +
      (RP.vistaReino ? '<div class="reino-vista">' + RP.vistaReino.html() + '</div>' : '') +
      '<div class="conteudo-tela conteudo-reino">' +
      '<div class="reino-recursos">' + RP.barraRecursos({ semSino: true }) + '</div>' +
      RP.extrasReino.map(function (f) { return f(r) || ''; }).join('') +
      (r.escudoAte ? '<div class="card faixa-escudo">' + RP.icone('escudo') + '<div><b>' + (r.escudoExilio ? 'Escudo de exílio ativo' : 'Escudo de novato ativo') + '</b><br><span class="suave">Termina em <span data-fim="' + r.escudoAte + '">' + RP.fmtResta(r.escudoAte - RP.agora()) + '</span>. Quem atacar só descobre ao chegar.</span></div></div>' : '') +
      '<div class="card pop-card"><div class="card-titulo">' + RP.icone('populacao', 'r-populacao') + '<h2>População</h2></div>' +
      '<div class="pop-num num"><b data-pop>' + RP.num(r.pop) + '</b><span>/ ' + RP.num(r.teto) + '</span></div>' +
      '<div class="barra barra-grossa" role="progressbar" aria-label="População em relação ao teto"><i style="width:' + Math.min(100, 100 * (r.pop + r.tropas) / r.teto).toFixed(1) + '%"></i></div>' +
      '<ul class="pop-linhas">' +
      '<li>' + RP.icone('tropas', 'ico-p') + '<span><b>' + RP.num(r.tropas) + ' tropas</b> também moram no reino e ocupam o teto.</span></li>' +
      '<li>' + RP.icone('martelo', 'ico-p') + '<span>Os locais pedem <b>' + RP.num(r.trabalhadores) + ' trabalhadores</b>' + (r.eficiencia < 1 ? ': produzem <b>' + Math.round(r.eficiencia * 100) + '%</b> por falta de gente' : '') + '.</span></li>' +
      '<li>' + RP.icone('moradia', 'ico-p') + '<span>Teto: castelo + <b>' + r.moradias + ' moradias</b>. Próxima: ' + RP.custoHTML(r.custos.moradia) + '</span></li>' +
      '</ul></div>' +
      '<div class="secao-titulo">Filas</div><div class="card pilha">' + filaHTML('obras', 'Obras', 'martelo') +
      (RP.telas.recrutamento ? filaHTML('recrutamento', 'Recrutamento', 'tropas') : '') +
      '<div class="linha" style="margin-top:var(--esp-2)"><a class="btn btn-p btn-primario" href="#/construcao" style="flex:1">' + RP.icone('martelo') + 'Construir</a>' +
      (RP.telas.recrutamento ? '<a class="btn btn-p" href="#/recrutamento" style="flex:1">' + RP.icone('tropas') + 'Recrutar</a>' : '') + '</div></div>' +
      '<div class="secao-titulo">Castelo (capital)</div>' + (c ? cardLocal(c) : '') +
      '<div class="secao-titulo">Locais</div><div class="pilha">' + outros.map(cardLocal).join('') + '</div>' +
      '</div>';
    if (RP.vistaReino) RP.vistaReino.montar(RP.$('.reino-vista', el));
  }

  RP.registrarTela('reino', {
    nav: true,
    montar: function (el) {
      document.addEventListener('rp:reino', function () { if (RP.$('[data-tela=reino]') && !RP.$('[data-tela=reino]').hidden) desenhar(el); });
    },
    entrar: function (el) { desenhar(el); RP.recarregarReino(); },
    sair: function () { if (RP.vistaReino && RP.vistaReino.parar) RP.vistaReino.parar(); }
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
    var abas = [['economia', 'Locais'], ['populacao', 'População'], ['novos', 'Novos locais']].concat(RP.extrasConstrucao.map(function (x) { return [x.aba, x.nome]; }));
    var corpo = '';
    if (aba === 'economia') {
      corpo = r.locais.map(function (l) {
        var m = l.melhoria;
        return '<div class="card pilha"><div class="linha-entre"><span class="linha">' + RP.icone(RP.iconeLocal(l)) + '<b>' + RP.esc(l.nome) + '</b></span><span class="selo">Nv ' + l.nivel + '</span></div>' +
          (m ? '<div class="linha-entre">' + RP.custoHTML(m.custo) + '<span class="fraco">' + RP.fmtDuracao(m.seg) + '</span></div>' +
            (m.bloqueio ? '<p class="fraco">' + RP.esc(m.bloqueio) + '</p>' : '<button type="button" class="btn btn-p" data-melhorar="' + l.id + '">' + RP.icone('martelo') + 'Melhorar para o nível ' + m.nivel + '</button>')
            : '<p class="fraco">Nível máximo.</p>') + '</div>';
      }).join('');
    } else if (aba === 'populacao') {
      var lugares = r.locais.filter(function (l) { return l.tipo === 'castelo' || l.tipo === 'vila'; });
      corpo = '<div class="card pilha"><b>Moradia</b><p class="suave">+60 de teto de população. Cada moradia custa mais que a anterior.</p>' +
        '<div class="linha-entre">' + RP.custoHTML(r.custos.moradia) + '<span class="fraco">' + RP.fmtDuracao(r.custos.moradiaSeg) + '</span></div>' +
        lugares.map(function (l) { return '<button type="button" class="btn btn-p" data-moradia="' + l.id + '">' + RP.icone('moradia') + 'Em ' + RP.esc(l.nome) + '</button>'; }).join('') + '</div>';
    } else if (aba === 'novos') {
      corpo = '<p class="nota-regra">' + RP.icone('mapa', 'ico-p') + '<span>Novos locais podem ser fundados em <b>qualquer hexágono livre já explorado</b>, sem limite de distância. O custo cresce a cada novo local, e o material vai até lá a pé.</span></p>' +
        '<div class="card pilha"><div class="linha-entre"><b>Custo do próximo local</b><span class="fraco">' + RP.fmtDuracao(r.custos.novoLocalSeg) + '</span></div>' + RP.custoHTML(r.custos.novoLocal) + '</div>' +
        Object.keys(r.fundaveis || {}).map(function (k) {
          var f = r.fundaveis[k];
          return '<div class="card pilha"><div class="linha-entre"><span class="linha">' + RP.icone(RP.iconeLocal({ tipo: f.tipo, produz: f.produz })) + '<b>' + NOMES_FUNDAR[k] + '</b></span>' +
            '<span class="fraco">' + f.terrenos.map(function (t) { return RP.hex.NOME_TERRENO[t]; }).join(' ou ') + '</span></div>' +
            '<p class="suave">' + DESC_FUNDAR[k] + '</p>' +
            '<a class="btn btn-p" href="#/mapa?fundar=' + k + '">' + RP.icone('alvo') + 'Escolher no mapa</a></div>';
        }).join('');
    } else {
      var x = RP.extrasConstrucao.filter(function (e) { return e.aba === aba; })[0];
      corpo = x ? x.html(r) : '';
    }
    el.innerHTML = '<header class="topo"><a class="btn btn-fantasma btn-icone" href="#/reino" aria-label="Voltar">' + RP.icone('voltar') + '</a><h1>Construção</h1></header>' +
      '<div class="reino-recursos">' + RP.barraRecursos({ semSino: true }) + '</div>' +
      '<div class="abas" role="tablist">' + abas.map(function (a) { return '<a role="tab" class="aba" href="#/construcao?aba=' + a[0] + '" aria-selected="' + (a[0] === aba) + '">' + a[1] + '</a>'; }).join('') + '</div>' +
      '<div class="conteudo-tela pilha">' + '<div class="card pilha">' + filaHTML('obras', 'Obras', 'martelo') + '</div>' + corpo + '</div>';
  }

  RP.registrarTela('construcao', {
    nav: true, secao: 'reino',
    montar: function (el) {
      document.addEventListener('rp:reino', function () { if (!el.hidden) desenharConstrucao(el, el.getAttribute('data-aba')); });
    },
    entrar: function (el, p) { el.setAttribute('data-aba', p.get('aba') || 'economia'); desenharConstrucao(el, p.get('aba')); }
  });
})();
