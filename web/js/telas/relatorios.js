/* Reino de Pedra — Relatórios (lista e detalhe). Sistemas registram desenhos próprios:
   RP.desenhosRelatorio[tipo] = function (rel) { return html; }. Sem desenho próprio, usa resumo + linhas. */
(function () {
  'use strict';
  var RP = window.RP;
  RP.desenhosRelatorio = RP.desenhosRelatorio || {};
  RP.FILTROS_RELATORIO = RP.FILTROS_RELATORIO || [['', 'Todos']];
  var ICONE_TIPO = { ataque: 'espada', defesa: 'escudo', exploracao: 'explorador', espionagem: 'batedor', fauna: 'pata', caca: 'lobo', extracao: 'picareta', reliquia: 'lendario', comercio: 'troca', alianca: 'estandarte', mensagem: 'mensagem', sistema: 'info' };
  RP.iconeRelatorio = function (t) { return ICONE_TIPO[t] || 'relatorios'; };

  function desenharPadrao(rel) {
    var d = rel.dados || {};
    return (d.resumo ? '<p class="suave">' + RP.esc(d.resumo) + '</p>' : '') +
      (d.linhas && d.linhas.length ? '<div class="info">' + d.linhas.map(function (l) {
        return '<div class="info-linha"><span class="fraco">' + RP.esc(l.rotulo) + '</span><span>' + RP.esc(l.valor) + '</span></div>';
      }).join('') + '</div>' : '') +
      (d.hex != null ? '<a class="btn btn-p" href="#/mapa?foco=' + d.hex + '">' + RP.icone('mapa') + 'Ver no mapa</a>' : '');
  }

  RP.registrarTela('relatorios', {
    nav: true,
    montar: function (el) {
      RP.ouvir('relatorio', function () { if (!el.hidden) carregar(el); });
    },
    entrar: function (el, p) { el.setAttribute('data-filtro', p.get('tipo') || ''); carregar(el); }
  });

  function carregar(el) {
    var f = el.getAttribute('data-filtro') || '';
    RP.get('/relatorios' + (f ? '?tipo=' + encodeURIComponent(f) : '')).then(function (lista) {
      el.innerHTML = '<header class="topo"><h1>Relatórios</h1></header>' +
        (RP.FILTROS_RELATORIO.length > 1 ? '<div class="abas" role="tablist">' + RP.FILTROS_RELATORIO.map(function (x) {
          return '<a class="aba" role="tab" href="#/relatorios' + (x[0] ? '?tipo=' + x[0] : '') + '" aria-selected="' + (x[0] === f) + '">' + x[1] + '</a>';
        }).join('') + '</div>' : '') +
        '<div class="conteudo-tela"><div class="lista">' + (lista.length ? lista.map(function (r) {
          return '<a class="lista-item' + (r.lido ? '' : ' nao-lido') + '" href="#/relatorio?id=' + r.id + '"><span class="ico-placa">' + RP.icone(RP.iconeRelatorio(r.tipo)) + '</span>' +
            '<div style="flex:1;min-width:0"><b>' + RP.esc(r.titulo) + '</b>' + (r.resumo ? '<div class="fraco">' + RP.esc(r.resumo) + '</div>' : '') +
            '<small class="fraco">' + RP.fmtHora(r.quando) + '</small></div>' + RP.icone('avancar', 'ico-p') + '</a>';
        }).join('') : '<p class="fraco">Nenhum relatório ainda.</p>') + '</div></div>';
    }).catch(function () { /* aviso já mostrado */ });
  }

  RP.registrarTela('relatorio', {
    nav: true, secao: 'relatorios',
    entrar: function (el, p) {
      el.innerHTML = '<header class="topo"><a class="btn btn-fantasma btn-icone" href="#/relatorios" aria-label="Voltar">' + RP.icone('voltar') + '</a><h1>Relatório</h1></header><div class="conteudo-tela"><p class="fraco">Carregando…</p></div>';
      RP.get('/relatorios/' + encodeURIComponent(p.get('id'))).then(function (rel) {
        var corpo = (RP.desenhosRelatorio[rel.tipo] || desenharPadrao)(rel);
        RP.$('.conteudo-tela', el).innerHTML = '<div class="card pilha"><div class="linha">' + '<span class="ico-placa">' + RP.icone(RP.iconeRelatorio(rel.tipo)) + '</span>' +
          '<div><h2>' + RP.esc(rel.titulo) + '</h2><small class="fraco">' + RP.fmtHora(rel.quando) + '</small></div></div>' + corpo + '</div>';
      }).catch(function (e) { RP.$('.conteudo-tela', el).innerHTML = '<p class="fraco">' + RP.esc(e.message) + '</p>'; });
    }
  });
})();
