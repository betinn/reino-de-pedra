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
      descricao: function () { return linha('Ordem', 'Vão até lá e ficam no lugar') + linha('Postura', 'Atacar apenas quem atacar'); } },
    reforcar: { rotulo: 'Reforçar', verbo: 'Reforçar', icone: 'escudo', titulo: 'Reforçar',
      descricao: function () { return linha('Ordem', 'Entram na defesa do local ao chegar'); } }
  };
  function linha(r, v) { return '<div class="info-linha"><span class="fraco">' + r + '</span><span>' + v + '</span></div>'; }
  function defOrdem(id) { return ORDENS_BASE[id] || RP.ordensEnvio.filter(function (o) { return o.ordem === id; })[0]; }

  function localDe() { return est && est.de ? RP.tropas && RP.tropas.locais.filter(function (l) { return l.id === est.de; })[0] : null; }
  function exercitoDe() { return est && est.marchaId ? RP.exercito(est.marchaId) : null; }
  function disponiveis() { var l = localDe(); return l ? l.guarnicao : {}; }
  function grupoAtual() { var e = exercitoDe(); return e ? e.tropas : est.grupo; }

  function grupoPadrao(l) {
    var g = {};
    Object.keys(l.guarnicao || {}).forEach(function (k) { var n = l.guarnicao[k]; if (n > 0) g[k] = Math.max(1, Math.floor(n / 2)); });
    return g;
  }

  function iniciar(o) {
    RP.carregarTropas().then(function (t) {
      if (o.marchaId) {
        if (!RP.exercito(o.marchaId)) { RP.aviso({ titulo: 'Este exército não está mais em campo', icone: 'info' }); return; }
        est = { marchaId: o.marchaId, seguro: RP.exercito(o.marchaId).seguro };
      } else {
        var l = t.locais.filter(function (x) { return x.id === o.de; })[0] || t.locais.filter(function (x) { return RP.somaGrupo(x.guarnicao) > 0; })[0];
        if (!l || !RP.somaGrupo(l.guarnicao)) { RP.aviso({ titulo: 'Nenhuma tropa para enviar', texto: 'Recrute no castelo ou no quartel.', icone: 'tropas', tipo: 'alerta' }); return; }
        est = { de: l.id, grupo: grupoPadrao(l), seguro: false };
      }
      barra();
      RP.aviso({ titulo: 'Toque no destino', texto: 'Um local seu, ou qualquer hexágono.', icone: 'alvo', ms: 1800 });
    }, function () { /* aviso já mostrado */ });
  }
  function cancelar() { est = null; barra(); }

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
      (n ? RP.esc(RP.partesGrupo(g)) : 'nenhuma tropa escolhida') + (l ? ' · de ' + RP.esc(l.nome) : est.marchaId ? ' · exército em campo' : '') + '</small></span>' +
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
      obj.filter(function (o) { return o.tipo === 'marcha' && o.dono === 'meu' && o.marcha === 'exercito'; }).forEach(function (o) {
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
    var corpo = est.marchaId ? { marchaId: est.marchaId, destinoHex: h } : { deLocalId: est.de, tropas: est.grupo, destinoHex: h };
    if (!RP.somaGrupo(grupoAtual())) { folhaGrupo(); return; }
    RP.tentar(RP.post('/tropas/previa', corpo)).then(function (p) { est.previa = p; folhaConfirmar(); });
  }
  function folhaConfirmar() {
    var d = defOrdem(est.ordem), p = est.previa, h = est.hex, g = grupoAtual();
    var mesma = p.segura.ok && p.curta.ok && p.segura.hexes === p.curta.hexes && p.segura.min === p.curta.min;
    if (mesma || !p.segura.ok) est.seguro = false;
    var esc = est.seguro ? p.segura : p.curta;
    var dados = RP.mapa.dados(), obj = objetos(h, dados), local = obj.filter(function (o) { return o.tipo === 'local'; })[0];
    var corpo = '<div class="info">' + linha('Tropas', RP.selosGrupo(g)) +
      (d.descricao ? d.descricao(h, dados, est) : '') +
      linha('Carga', 'até ' + RP.num(p.carga)) +
      linha('Chegada', esc && esc.ok ? 'em ' + RP.fmtDuracao(esc.min * 60) + ' · ' + RP.fmtHora(RP.agora() + esc.min * 60000) : '—') + '</div>' +
      (p.curta.ok ? '<div class="secao-titulo">Caminho</div><div class="pilha">' + opcaoCaminho('curta', p.curta) + (mesma ? '' : opcaoCaminho('segura', p.segura)) + '</div>' +
        (mesma ? '<p class="fraco" style="font-size:var(--fs-2)">A rota curta já é a mais segura que se conhece.</p>' : '')
        : '<p class="txt-alerta">Não há caminho até o destino.</p>');
    RP.abrirFolha({
      titulo: RP.esc(local ? d.titulo + ' ' + local.nome : d.titulo || d.rotulo), sobreNav: false,
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
      : RP.post('/tropas/enviar', { deLocalId: e.de, tropas: e.grupo, destinoHex: e.hex, ordem: e.ordem, seguro: !!e.seguro, dados: extra });
    RP.tentar(p).then(function (ex) {
      RP.fecharFolha(); cancelar();
      RP.aviso({ titulo: e.marchaId ? 'Nova ordem dada' : 'Tropas a caminho', texto: ex && ex.chegada ? (RP.partesGrupo(ex.tropas) + ' · chegam ' + RP.fmtHora(ex.chegada) + '.') : '', icone: d.icone || 'seta', tipo: 'sucesso' });
      if (RP.mapa.recarregar) RP.mapa.recarregar();
      RP.recarregarReino(); RP.carregarTropas().catch(function () { /* offline */ });
    });
  }

  /* ---------------------------------------------------------------- escolher tropas (e de onde saem) */
  function folhaGrupo() {
    var t = RP.tropas, l = localDe();
    var origens = t.locais.filter(function (x) { return RP.somaGrupo(x.guarnicao) > 0; });
    RP.abrirFolha({
      titulo: 'Tropas do envio', sobreNav: true,
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

  /* ---------------------------------------------------------------- exércitos no mapa (ícone de tropas) */
  var imgTropas = null;
  function iconeTropas() {
    if (imgTropas) return imgTropas.complete ? imgTropas : null;
    var s = document.getElementById('i-tropas'); if (!s) return null;
    var cs = getComputedStyle(document.documentElement);
    var claro = (cs.getPropertyValue('--barra-texto') || '').trim() || 'white', escuro = (cs.getPropertyValue('--barra-fundo') || '').trim() || 'black';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><style>.ic-s{fill:' + claro + ';stroke:' + escuro + ';stroke-width:1;stroke-linejoin:round}' +
      '.ic-d{fill:none;stroke:' + escuro + ';stroke-width:1.4;stroke-linecap:round}.ic-l{fill:none;stroke:' + claro + ';stroke-width:2;stroke-linecap:round;stroke-linejoin:round}</style>' + s.innerHTML + '</svg>';
    imgTropas = new Image();
    imgTropas.onload = function () { if (RP.mapa.desenhar) RP.mapa.desenhar(); };
    imgTropas.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return null;
  }
  function posicao(o, t) {
    var tp = o.tempos, cm = o.caminho;
    if (!cm || !cm.length) return H.centroH(o.hex);
    if (!tp || tp.length < 2 || t <= tp[0]) return H.centroH(cm[0]);
    if (t >= tp[tp.length - 1]) return H.centroH(cm[cm.length - 1]);
    for (var i = 0; i < tp.length - 1; i++) {
      if (t < tp[i + 1]) {
        var a = H.centroH(cm[i]), b = H.centroH(cm[i + 1]), f = (t - tp[i]) / Math.max(1, tp[i + 1] - tp[i]);
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
      }
    }
    return H.centroH(cm[cm.length - 1]);
  }
  RP.mapa.desenhosExtras.push(function (ctx, dados, cam, agora) {
    var img = iconeTropas(), cs = getComputedStyle(document.documentElement);
    var corMeu = (cs.getPropertyValue('--cor-info') || '').trim() || 'steelblue', corOutro = (cs.getPropertyValue('--cor-perigo') || '').trim() || 'firebrick';
    dados.objetos.forEach(function (o) {
      if (o.tipo !== 'marcha' || o.marcha !== 'exercito') return;
      var p = posicao(o, agora);
      ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, 7);
      ctx.fillStyle = o.dono === 'meu' ? corMeu : corOutro; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.stroke();
      if (img) ctx.drawImage(img, p.x - 9, p.y - 9, 18, 18);
    });
  });
})();
