/* Reino de Pedra — a porta de entrada é o próprio mundo: o mapa real, ao vivo, sem login. Só o que todo jogador vê (feed público).
   Por cima: selo AO VIVO, crônica de batalhas, reinos e alianças, o pedido de convite e a entrada de quem já joga.
   Conta nova só nasce de um link de convite (#/convite/<token>). */
(function () {
  'use strict';
  var RP = window.RP, H = RP.hex, M = RP.mapaModelo, MAPA = RP.mapa;
  var tela = null, cena = null, tat = null, modo = 'cena', posicionado = false, aba = 'cronica';

  function visao() { return modo === 'cena' ? cena : tat; }
  function definirModo(m, s) {
    var de = visao(), c = de.centro();
    if (m !== modo) de.parar();
    modo = m;
    tela.setAttribute('data-modo', m);
    if (m === 'cena') { cena.redimensionar(); cena.centrar(c.x, c.y, s || 1.2, 0.5, false); cena.iniciar(); }
    else { tat.iniciar(); tat.centrar(c.x, c.y, s || 0.5, 0.5, false); }
  }
  function irPara(h, s) {
    var p = H.centroH(h);
    visao().centrar(p.x, p.y, s || (modo === 'cena' ? Math.max(cena.cam.s, 1.4) : Math.max(tat.cam.s, 0.8)), 0.5, true);
  }

  /* onde a câmera começa: uma batalha em andamento; sem nenhuma, o maior castelo */
  function pontoInicial() {
    var d = M.dados, b = d.objs.filter(function (o) { return o.tipo === 'batalha'; })[0];
    if (b) return b.hex;
    var castelos = d.objs.filter(function (o) { return o.tipo === 'local' && o.local === 'castelo' && !o.ruina; });
    castelos.sort(function (x, y) { return (y.nivel || 0) - (x.nivel || 0) || x.id - y.id; });
    return castelos.length ? castelos[0].hex : H.idx(Math.floor(H.COLS / 2), Math.floor(H.LINS / 2));
  }

  /* ---------------------------------------------------------------- painel: crônica, reinos, alianças */
  function nomeReino(id) { var d = M.dados, r = d && d.reinos && d.reinos[id]; return r ? r.nome : '?'; }
  function linhaBatalha(b) {
    var f = (b.listaFrentes || []).map(function (x) {
      return '<small>' + RP.esc(nomeReino(x.atacanteId)) + ' perdeu ' + x.baixasAtaque + ' · ' + RP.esc(nomeReino(x.defensorId)) + ' perdeu ' + x.baixasDefesa + '</small>' +
        '<span class="pub-barra" title="Parte da força de cada lado"><i style="width:' + Math.round((x.parteAtaque || 0.5) * 100) + '%"></i></span>';
    }).join('');
    return '<li class="cronica-item cronica-agora" data-cronica-hex="' + b.hex + '"><span><b>Agora:</b> batalha em ' + RP.esc(b.local || 'um local') + '</span>' + f + '</li>';
  }
  function desenharPainel() {
    if (!tela) return;
    var v = M.ultimoVivo, w = M.mundoPublico, box = RP.$('[data-pub-painel]', tela);
    if (!box) return;
    RP.$$('[data-pub-aba]', tela).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-pub-aba') === aba)); });
    if (aba === 'cronica') {
      var bat = M.dados ? M.dados.objs.filter(function (o) { return o.tipo === 'batalha'; }) : [];
      var msgs = v ? v.mensagens || [] : [];
      box.innerHTML = '<ol class="pub-lista">' + bat.map(linhaBatalha).join('') + msgs.map(M.mensagemHTML).join('') + '</ol>' +
        (!bat.length && !msgs.length ? '<p class="fraco">Nenhuma batalha ainda. Quando alguém atacar, aparece aqui.</p>' : '');
    } else if (aba === 'reinos' && w) {
      var rk = {};
      w.ranking.forEach(function (x) { rk[x.reinoId] = x; });
      box.innerHTML = '<ol class="pub-lista">' + w.reinos.slice().sort(function (a, b) { return ((rk[b.id] || {}).baixas || 0) - ((rk[a.id] || {}).baixas || 0) || a.nome.localeCompare(b.nome); }).map(function (r) {
        var x = rk[r.id] || {};
        return '<li class="pub-reino" data-pub-reino="' + r.id + '">' + RP.brasao(r.brasao, { tamanho: 26 }) + '<span><b>' + RP.esc(r.nome) + '</b><small class="fraco">' +
          (x.baixas || 0) + ' baixas causadas · ' + (x.perdas || 0) + ' perdas · ' + (x.familias || 0) + ' famílias</small></span></li>';
      }).join('') + '</ol>';
    } else if (aba === 'aliancas' && w) {
      var nomes = function (ids) { return ids.map(function (i) { return RP.esc(nomeReino(i)); }).join(', '); };
      box.innerHTML = '<ol class="pub-lista">' + w.aliancas.map(function (a) {
        return '<li class="pub-reino">' + RP.brasao(a.brasao, { tamanho: 26 }) + '<span><b>' + RP.esc(a.nome) + '</b><small class="fraco">' + nomes(a.membros) + '</small></span></li>';
      }).join('') + w.pactos.map(function (p) {
        return '<li class="cronica-item"><span>Pacto: ' + RP.esc(nomeReino(p.a)) + ' e ' + RP.esc(nomeReino(p.b)) + '</span><small class="fraco">termina em ' + RP.fmtResta(p.fim - RP.agora()) + '</small></li>';
      }).join('') + '</ol>' + (!w.aliancas.length && !w.pactos.length ? '<p class="fraco">Nenhuma aliança nem pacto ainda.</p>' : '');
    }
    var cont = RP.$('[data-pub-cont]', tela);
    if (cont && w && v) {
      var marchas = v.marchas.length, batalhas = v.batalhas.length;
      cont.textContent = 'Temporada ' + w.temporada + ' · dia ' + w.dia + ' de ' + w.dias + ' · ' + w.reinos.length + ' reinos · ' + marchas + (marchas === 1 ? ' marcha' : ' marchas') + ' · ' + batalhas + (batalhas === 1 ? ' batalha' : ' batalhas') + ' agora';
    }
  }

  /* ---------------------------------------------------------------- toques: uma folha só com o que é público */
  function linha(r, v) { return '<div class="info-linha"><span class="fraco">' + r + '</span><span>' + v + '</span></div>'; }
  function aoTocar(a) {
    var o = a.obj, h = a.hex;
    if (!o && h != null) o = M.objetosEm(h).filter(function (x) { return x.tipo === 'local' || x.tipo === 'batalha'; })[0];
    if (!o) return;
    var dono = o.reino ? RP.esc(o.reino.nome) : 'Sem dono', corpo = '', titulo = 'Mapa';
    if (o.tipo === 'local') {
      titulo = o.ruina ? 'Ruína' : o.dono === 'livre' ? 'Terra livre' : RP.esc(o.nome || 'Local');
      corpo = linha('Dono', dono) + (o.nivel ? linha('Nível', o.nivel) : '') + linha('Tipo', RP.esc(RP.TIPOS_LOCAL[o.local] || o.local)) +
        (o.reliquias ? linha('Relíquia', o.reliquias + (o.reliquias > 1 ? ' guardadas' : ' guardada') + ' (tipo em segredo)') : '');
    } else if (o.tipo === 'marcha') {
      titulo = (MAPA.tiposMarcha[o.marcha] || {}).nome || (RP.NOMES_MARCHA || {})[o.marcha] || 'Marcha';
      corpo = linha('De quem', dono) + (o.reliquia ? linha('Leva', 'uma relíquia') : '') + '<p class="nota-regra">' + RP.icone('olho', 'ico-p') + '<span>O tamanho e o destino de uma marcha ninguém vê.</span></p>';
    } else if (o.tipo === 'batalha') {
      titulo = 'Batalha em ' + RP.esc(o.local || 'um local');
      corpo = (o.listaFrentes || []).map(function (x) { return linha(RP.esc(nomeReino(x.atacanteId)) + ' ataca', RP.esc(nomeReino(x.defensorId))); }).join('');
    } else if (o.tipo === 'torre') { titulo = 'Torre de arqueiros'; corpo = linha('Dono', dono) + linha('Nível', o.nivel); }
    else if (o.tipo === 'ruina-antiga') { titulo = 'Ruína antiga'; corpo = '<p class="suave">O que ela guarda, só quem escava descobre.</p>'; }
    else if (o.tipo === 'bandeira') { titulo = 'Bandeira de ' + (o.autor ? RP.esc(o.autor.nome) : '?'); corpo = '<p class="suave">“' + RP.esc(o.recado) + '”</p>'; }
    else return;
    RP.abrirFolha({ titulo: titulo, corpo: '<div class="info">' + corpo + '</div>', acoes: '' });
  }

  /* ---------------------------------------------------------------- pedido de convite e entrada */
  function acoesHTML() {
    if (RP.conta) {
      return (RP.reino
        ? '<button type="button" class="btn btn-primario btn-bloco btn-grande" data-continuar>' + RP.icone('castelo') + 'Continuar como ' + RP.esc(RP.reino.nome) + '</button>'
        : '<a class="btn btn-primario btn-bloco btn-grande" href="#/criar">' + RP.icone('castelo') + 'Fundar meu reino</a>') +
        '<button type="button" class="btn btn-bloco" data-sair>Sair da conta</button>';
    }
    return '<form class="pub-form" data-form-convite novalidate>' +
      '<label for="pub-email">Entrada só por convite. Deixe seu e-mail:</label>' +
      '<div class="pub-form-linha"><input id="pub-email" name="email" type="email" autocomplete="email" inputmode="email" required maxlength="254" placeholder="voce@exemplo.com">' +
      '<input class="pub-oculto" name="site" type="text" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<button type="submit" class="btn btn-primario">' + RP.icone('estandarte') + 'Pedir convite</button></div>' +
      '<span class="campo-erro" role="alert"></span><span class="pub-ok" role="status" hidden></span></form>' +
      '<button type="button" class="btn btn-fantasma btn-bloco" data-abrir-entrar>Já jogo: entrar</button>';
  }
  function abrirEntrar() {
    RP.modal({
      titulo: 'Entrar',
      corpo: '<form class="pilha-4" data-form-entrar novalidate>' +
        '<div class="campo"><label for="ent-email">E-mail</label><input id="ent-email" name="email" type="email" autocomplete="email" inputmode="email" required maxlength="254"></div>' +
        '<div class="campo"><label for="ent-senha">Senha</label><input id="ent-senha" name="senha" type="password" autocomplete="current-password" required maxlength="128">' +
        '<span class="campo-erro" role="alert"></span></div>' +
        '<button type="submit" class="btn btn-primario btn-bloco btn-grande">' + RP.icone('avancar') + 'Entrar</button></form>',
      acoes: []
    });
    var inp = document.getElementById('ent-email'); if (inp) setTimeout(function () { inp.focus(); }, 30);
  }
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f.matches && f.matches('[data-form-entrar]')) {
      e.preventDefault();
      var email = f.email.value.trim(), senha = f.senha.value, erro = RP.$('.campo-erro', f), bt = RP.$('[type=submit]', f);
      erro.textContent = '';
      if (!email || !senha) { erro.textContent = 'Preencha e-mail e senha.'; return; }
      bt.disabled = true;
      RP.post('/conta/entrar', { email: email, senha: senha }, { sem401: true })
        .then(function () { return RP.entrarNoJogo(); })
        .then(function () { RP.fecharModais && RP.fecharModais(); RP.ir(RP.reino ? 'mapa' : 'criar'); RP.rotear(); })
        .catch(function (x) { erro.textContent = x.message; })
        .then(function () { bt.disabled = false; });
    }
    if (f.matches && f.matches('[data-form-convite]')) {
      e.preventDefault();
      var er = RP.$('.campo-erro', f), ok = RP.$('.pub-ok', f), b2 = RP.$('[type=submit]', f), em = f.email.value.trim();
      er.textContent = ''; ok.hidden = true;
      if (!em) { er.textContent = 'Escreva seu e-mail.'; return; }
      b2.disabled = true;
      RP.post('/convites/pedir', { email: em, site: f.site.value }, { sem401: true })
        .then(function () { f.email.value = ''; ok.textContent = 'Pedido recebido. Se o convite sair, ele chega nesse e-mail.'; ok.hidden = false; })
        .catch(function (x) { er.textContent = x.message; })
        .then(function () { b2.disabled = false; });
    }
  });

  /* ---------------------------------------------------------------- tela */
  function montar(el) {
    tela = el;
    el.classList.add('publico');
    el.setAttribute('data-modo', 'cena');
    el.innerHTML =
      '<canvas class="cena-cv" aria-label="Mapa real do jogo, ao vivo. Arraste para mover, roda do mouse para zoom."></canvas>' +
      '<div class="mapa-vp" role="application" aria-label="Mapa tático do mundo, ao vivo."></div>' +
      '<header class="pub-topo"><div class="pub-marca"><h1 class="titulo-jogo">Reino de Pedra</h1><p class="subtitulo-jogo">Estratégia e Conquista</p></div>' +
      '<div class="pub-aovivo" role="status"><span class="pub-selo"><i aria-hidden="true"></i>AO VIVO</span><span class="pub-cont" data-pub-cont>Abrindo o mundo…</span></div></header>' +
      '<div class="pub-zoom" role="toolbar" aria-label="Zoom"><button type="button" class="btn btn-icone" data-pub-zoom="1.5" aria-label="Aproximar">' + RP.icone('mais') + '</button>' +
      '<button type="button" class="btn btn-icone" data-pub-zoom="0.6667" aria-label="Afastar">' + RP.icone('menos') + '</button></div>' +
      '<aside class="pub-lado" aria-label="O que está acontecendo"><div class="abas" role="group">' +
      '<button type="button" class="aba" data-pub-aba="cronica">Crônica</button><button type="button" class="aba" data-pub-aba="reinos">Reinos</button><button type="button" class="aba" data-pub-aba="aliancas">Alianças</button></div>' +
      '<div class="pub-painel" data-pub-painel></div></aside>' +
      '<section class="pub-convite card" aria-label="Entrar no jogo"><p class="pub-frase">Tudo o que você vê está acontecendo agora.</p><div data-acoes></div></section>';
    cena = new RP.Cena(RP.$('.cena-cv', el), {
      interativa: true, camadas: MAPA.camadas, aoTocar: aoTocar,
      aoAfastarDemais: function () { definirModo('tatico', 0.5); }
    });
    tat = new RP.Tatico(RP.$('.mapa-vp', el), { aoTocar: aoTocar, aoAproximarDemais: function () { definirModo('cena', 1.2); } });
    el.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-pub-aba]'))) { aba = b.getAttribute('data-pub-aba'); desenharPainel(); }
      else if ((b = e.target.closest('[data-pub-zoom]'))) visao().zoomBotao(+b.getAttribute('data-pub-zoom'));
      else if ((b = e.target.closest('[data-cronica-hex]'))) irPara(+b.getAttribute('data-cronica-hex'));
      else if ((b = e.target.closest('[data-pub-reino]'))) {
        var id = +b.getAttribute('data-pub-reino'), c = M.dados.objs.filter(function (o) { return o.tipo === 'local' && o.local === 'castelo' && o.reinoId === id; })[0];
        if (c) irPara(c.hex);
      }
      else if (e.target.closest('[data-abrir-entrar]')) abrirEntrar();
      else if (e.target.closest('[data-continuar]')) RP.ir('mapa');
      else if (e.target.closest('[data-sair]')) RP.sair();
    });
  }
  document.addEventListener('rp:mapa-dados', function () {
    if (!tela || !M.publico || tela.hidden) return;
    cena.invalidar(); tat.invalidar();
    if (!posicionado) {
      posicionado = true;
      var p = H.centroH(pontoInicial());
      cena.centrar(p.x, p.y, 1.2, 0.5, false); tat.centrar(p.x, p.y, 0.5, 0.5, false);
      if (modo === 'cena') cena.iniciar(); else tat.iniciar();
    }
    desenharPainel();
  });
  document.addEventListener('rp:vivo', function () { if (tela && M.publico && !tela.hidden) desenharPainel(); });
  window.addEventListener('resize', function () { if (tela && !tela.hidden && M.publico) { if (modo === 'cena') cena.redimensionar(); else { tat.redimensionar(); tat.pedirQuadro(); } } });

  RP.registrarTela('inicio', {
    publica: true,
    montar: montar,
    entrar: function (el) {
      RP.$('[data-acoes]', el).innerHTML = acoesHTML();
      M.ativar('publico');
      M.carregarPublico().catch(function () { var c = RP.$('[data-pub-cont]', el); if (c) c.textContent = 'Servidor indisponível no momento.'; });
    },
    sair: function () {
      M.desativar('publico');
      if (cena) cena.parar();
      if (tat) tat.parar();
      posicionado = false;
      M.sairDoPublico();
    }
  });

  /* ---------------------------------------------------------------- link de convite */
  RP.abrirConvite = function (token) {
    RP.post('/convites/validar', { token: token }, { sem401: true }).then(function (r) {
      RP.criarOpcoes = { convite: { token: token, email: r.email } };
      RP.invalidarTela('criar');
      location.replace('#/criar');   /* o token sai da barra de endereços e do histórico */
    }).catch(function (x) {
      history.replaceState(null, '', location.pathname);
      RP.rotear();
      RP.aviso({ titulo: x.message, icone: 'alerta', tipo: 'perigo', ms: 8000 });
    });
  };
})();
