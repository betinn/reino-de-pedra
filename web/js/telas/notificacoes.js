/* Reino de Pedra — Notificações: lista, contador no sino, preferências por categoria e aviso do navegador. */
(function () {
  'use strict';
  var RP = window.RP;

  function atualizarContador() {
    RP.$$('.btn-sino .contador, .btn-sino-topo .contador').forEach(function (c) { c.textContent = RP.naoLidas; c.hidden = !RP.naoLidas; });
  }
  RP.carregarContador = function () {
    return RP.get('/notificacoes').then(function (n) { RP.naoLidas = n.naoLidas; atualizarContador(); return n; });
  };
  document.addEventListener('rp:reino', function () { if (!RP._contadorCarregado) { RP._contadorCarregado = true; RP.carregarContador().catch(function () { /* offline */ }); } });

  RP.ouvir('notificacao', function (n) {
    RP.naoLidas++; atualizarContador();
    if (!n.tocar) return;
    if (document.hidden && window.Notification && Notification.permission === 'granted') {
      try { var x = new Notification(n.titulo, { body: n.texto || '', tag: 'rp-' + n.id }); x.onclick = function () { window.focus(); if (n.link) RP.ir(n.link); }; } catch (e) { /* ignora */ }
    } else {
      RP.aviso({ titulo: n.titulo, texto: n.texto || '', icone: 'sino', tipo: n.categoria === 'ataques' ? 'perigo' : 'info' });
    }
  });

  RP.registrarTela('notificacoes', {
    nav: true, secao: 'reino',
    montar: function (el) {
      el.addEventListener('change', function (e) {
        var c = e.target.closest('[data-categoria]');
        if (!c) return;
        var o = {}; o[c.getAttribute('data-categoria')] = c.checked;
        RP.tentar(RP.put('/notificacoes/preferencias', { categorias: o }));
      });
      el.addEventListener('click', function (e) {
        if (e.target.closest('[data-permitir]') && window.Notification) Notification.requestPermission().then(function () { desenhar(el); });
      });
    },
    entrar: function (el) { desenhar(el); }
  });

  function desenhar(el) {
    Promise.all([RP.get('/notificacoes'), RP.get('/notificacoes/preferencias')]).then(function (r) {
      var n = r[0], pref = r[1];
      var perm = window.Notification ? Notification.permission : 'denied';
      el.innerHTML = '<header class="topo"><a class="btn btn-fantasma btn-icone" href="#/reino" aria-label="Voltar">' + RP.icone('voltar') + '</a><h1>Notificações</h1></header>' +
        '<div class="conteudo-tela pilha"><div class="lista">' + (n.itens.length ? n.itens.map(function (x) {
          return '<a class="lista-item' + (x.lida ? '' : ' nao-lido') + '" href="#/' + RP.esc(x.link || 'reino') + '"><span class="ico-placa">' + RP.icone('sino') + '</span><div style="flex:1;min-width:0"><b>' + RP.esc(x.titulo) + '</b>' +
            (x.texto ? '<div class="fraco">' + RP.esc(x.texto) + '</div>' : '') + '<small class="fraco">' + RP.fmtHora(x.quando) + '</small></div></a>';
        }).join('') : '<p class="fraco">Nada por aqui.</p>') + '</div>' +
        '<div class="secao-titulo">O que avisar</div><div class="card pilha">' +
        (perm === 'default' ? '<button type="button" class="btn btn-p" data-permitir>' + RP.icone('sino') + 'Avisar também fora da página</button>' : '') +
        pref.map(function (p) {
          return '<label class="linha-entre"><span>' + RP.esc(p.nome) + '</span><input type="checkbox" data-categoria="' + p.id + '"' + (p.ligada ? ' checked' : '') + '></label>';
        }).join('') + '<p class="fraco" style="font-size:var(--fs-2)">Cada categoria liga e desliga. Não há horário de silêncio.</p></div></div>';
      RP.post('/notificacoes/lidas').then(function () { RP.naoLidas = 0; atualizarContador(); });
    }).catch(function () { /* aviso já mostrado */ });
  }
})();
