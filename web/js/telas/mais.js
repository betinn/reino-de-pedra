/* Reino de Pedra — Mais: conta, ícone do reino, sair. Outros sistemas acrescentam entradas em RP.itensMais. */
(function () {
  'use strict';
  var RP = window.RP;
  /* { icone, titulo, texto, href, sistema? } — sistemas novos fazem RP.itensMais.push(...) */
  RP.itensMais = RP.itensMais || [];

  /* sons: ligar e desligar, volume e sons do mundo (trabalho e batalhas à vista); ficam no aparelho */
  function cartaoSons() {
    if (!RP.sons) return '';
    var s = RP.sons.config();
    return '<div class="card pilha" data-sons>' +
      '<label class="linha-entre"><b>Sons</b><input type="checkbox" data-som-ligado' + (s.ligado ? ' checked' : '') + ' aria-label="Sons ligados"></label>' +
      '<label class="linha-entre"><span>Volume</span><input type="range" min="0" max="100" step="5" value="' + Math.round(s.volume * 100) + '" data-som-volume aria-label="Volume dos sons"' + (s.ligado ? '' : ' disabled') + '></label>' +
      '<label class="linha-entre"><span>Sons do mundo<div class="fraco" style="font-size:var(--fs-2)">Machado, picareta, obras e batalhas à vista na Vista</div></span><input type="checkbox" data-som-mundo' + (s.mundo ? ' checked' : '') + (s.ligado ? '' : ' disabled') + ' aria-label="Sons do mundo"></label>' +
      '</div>';
  }

  RP.registrarTela('mais', {
    nav: true,
    entrar: function (el) {
      var r = RP.reino;
      el.innerHTML = '<header class="topo"><h1>Mais</h1></header><div class="conteudo-tela pilha">' +
        '<div class="card linha">' + RP.iconeReino(r, 48) + '<div style="flex:1"><b>' + RP.esc(r.nome) + '</b><div class="fraco">' + RP.esc((RP.conta && RP.conta.email) || '') + '</div></div></div>' +
        '<div class="lista">' + [{ icone: 'relatorios', titulo: 'Relatórios', texto: 'Batalhas, caçadas, exploração', href: '#/relatorios' }, { icone: 'sino', titulo: 'Notificações', texto: 'O que avisar e quando', href: '#/notificacoes' }].concat(RP.itensMais).filter(function (i) { return !i.sistema || RP.sistema(i.sistema); }).map(function (i) {
          return '<a class="lista-item" href="' + i.href + '"><span class="ico-placa">' + RP.icone(i.icone) + '</span><div style="flex:1"><b>' + RP.esc(i.titulo) + '</b>' + (i.texto ? '<div class="fraco">' + RP.esc(i.texto) + '</div>' : '') + '</div>' + RP.icone('avancar', 'ico-p') + '</a>';
        }).join('') + '</div>' +
        cartaoSons() +
        '<button type="button" class="btn btn-bloco" data-sair>' + RP.icone('voltar') + 'Sair da conta</button>' +
        '</div>';
    },
    montar: function (el) {
      el.addEventListener('click', function (e) { if (e.target.closest('[data-sair]')) RP.sair(); });
      el.addEventListener('change', function (e) {
        var t = e.target;
        if (t.matches('[data-som-ligado]')) {
          RP.sons.definir({ ligado: t.checked });
          el.querySelectorAll('[data-som-volume], [data-som-mundo]').forEach(function (x) { x.disabled = !t.checked; });
          if (t.checked) RP.sons.tocarJa('confirmar');
        } else if (t.matches('[data-som-mundo]')) RP.sons.definir({ mundo: t.checked });
        else if (t.matches('[data-som-volume]')) { RP.sons.definir({ volume: +t.value / 100 }); RP.sons.tocarJa('moedas'); }
      });
      el.addEventListener('input', function (e) { if (e.target.matches('[data-som-volume]')) RP.sons.definir({ volume: +e.target.value / 100 }); });
    }
  });
})();
