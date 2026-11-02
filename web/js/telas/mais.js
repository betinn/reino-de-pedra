/* Reino de Pedra — Mais: conta, ícone do reino, sair. Outros sistemas acrescentam entradas em RP.itensMais. */
(function () {
  'use strict';
  var RP = window.RP;
  /* { icone, titulo, texto, href, sistema? } — sistemas novos fazem RP.itensMais.push(...) */
  RP.itensMais = RP.itensMais || [];

  RP.registrarTela('mais', {
    nav: true,
    entrar: function (el) {
      var r = RP.reino;
      el.innerHTML = '<header class="topo"><h1>Mais</h1></header><div class="conteudo-tela pilha">' +
        '<div class="card linha">' + RP.iconeReino(r, 48) + '<div style="flex:1"><b>' + RP.esc(r.nome) + '</b><div class="fraco">' + RP.esc((RP.conta && RP.conta.email) || '') + '</div></div></div>' +
        '<div class="lista">' + RP.itensMais.filter(function (i) { return !i.sistema || RP.sistema(i.sistema); }).map(function (i) {
          return '<a class="lista-item" href="' + i.href + '"><span class="ico-placa">' + RP.icone(i.icone) + '</span><div style="flex:1"><b>' + RP.esc(i.titulo) + '</b>' + (i.texto ? '<div class="fraco">' + RP.esc(i.texto) + '</div>' : '') + '</div>' + RP.icone('avancar', 'ico-p') + '</a>';
        }).join('') + '</div>' +
        '<button type="button" class="btn btn-bloco" data-sair>' + RP.icone('voltar') + 'Sair da conta</button>' +
        '</div>';
    },
    montar: function (el) {
      el.addEventListener('click', function (e) { if (e.target.closest('[data-sair]')) RP.sair(); });
    }
  });
})();
