/* Reino de Pedra — Enviar tropas pelo mapa. Com a tropa selecionada, clicar num hexágono oferece "Enviar tropa", que parte na
   hora, sem prévia; "Ver o caminho" abre a rota curta ou segura, e as outras ordens (atacar, caçar...) têm a confirmação delas.
   Sem seleção, o botão direito oferece "Enviar tropas para cá": um painel rápido com de onde saem e quantas vão.
   O mesmo painel serve a uma ordem já escolhida (escavar, extrair): a ordem declara painel: { titulo, subtitulo, preparar,
   grupo, opcoes, resumo, antes } e RP.envio.paraOrdem(hex, ordem) abre.
   Também dá nova ordem a um exército em campo, desenha no mapa a linha exata de uma patrulha e junta e separa tropas.
   Ponto de extensão: RP.ordensEnvio.push({ ordem, rotulo, icone, verbo, descricao(hex, dados, envio), quando(hex, dados, envio) })
   — o combate acrescenta "atacar". Porte da ordem rápida de prototipo/js/mapa.js e militar.js. */
(function () {
  'use strict';
  var RP = window.RP, H = RP.hex;
  RP.ordensEnvio = RP.ordensEnvio || [];
  RP.NOMES_MARCHA = RP.NOMES_MARCHA || {};
  RP.NOMES_MARCHA.exercito = 'Exército';
  RP.NOMES_MARCHA.carregadores = 'Carregadores';

  /* estado do envio: { de: localId | marchaId, pessoas, grupo, seguro, hex, ordem, previa, implicito, linha, circuito, painel, fixa, semOrigem }.
     implicito: começou no clique num hexágono com a tropa selecionada; fechar a folha desfaz. linha: hexágonos desenhados.
     painel: é o envio rápido do botão direito, que vive na folha, sem a barra do topo. fixa: a ordem do painel já foi
     escolhida (escavar, extrair). semOrigem: o painel abriu sem nenhuma tropa disponível e diz isso. */
  var est = null, tracos = [], tracando = false, sep = null, juntando = null;
  RP.envio = {
    ativo: function () { return !!est; },
    estado: function () { return est; },
    implicito: function () { return !!(est && est.implicito); },
    desenhando: function () { return !!(est && est.linha); },
    painel: function () { return !!(est && est.painel); },
    traco: function (c, hs, fechar, z, ag, forte) { traco(c, hs, fechar, z, ag, forte); },
    iniciar: function (o) { iniciar(o); },
    cancelar: function () { cancelar(); },
    /* desenho da linha: um clique soma um trecho; arrastar soma hexágono a hexágono até soltar */
    ponto: function (h) { tracos.push(est.linha.length); somarHex(h); },
    tracar: function (h) { if (!tracando) { tracando = true; tracos.push(est.linha.length); } somarHex(h); },
    tracarFim: function () { tracando = false; },
    folhaJuntar: function (o, t) { folhaJuntar(o, t); },
    folhaSeparar: function (id) { folhaSeparar(id); }
  };

  var ORDENS_BASE = {
    mover: { rotulo: 'Mover tropas para cá', verbo: 'Mover', icone: 'seta', titulo: 'Mover para cá',
      descricao: function () { return linha('Ordem', 'Vão até lá e ficam no lugar') + linha('Comportamento', 'Revidar: defendem e saem atrás de quem atacar'); } },
    reforcar: { rotulo: 'Reforçar', verbo: 'Reforçar', icone: 'escudo', titulo: 'Reforçar',
      descricao: function () { return linha('Ordem', 'Entram na defesa do local ao chegar'); } },
    /* a linha desenhada no mapa: o percurso anda por ela uma vez e para no fim; a patrulha repete até nova ordem */
    percorrer: { rotulo: 'Só uma vez', verbo: 'Percorrer', icone: 'seta', titulo: 'Percurso', dados: dadosLinha },
    patrulhar: { rotulo: 'Patrulhar', verbo: 'Patrulhar', icone: 'alvo', titulo: 'Patrulhar', dados: dadosLinha }
  };
  function dadosLinha() { return { pontos: est.linha.slice(), circuito: !!est.circuito }; }
  function linha(r, v) { return '<div class="info-linha"><span class="fraco">' + r + '</span><span>' + v + '</span></div>'; }
  function defOrdem(id) { return ORDENS_BASE[id] || RP.ordensEnvio.filter(function (o) { return o.ordem === id; })[0]; }

  function localDe() { return est && est.de ? RP.tropas && RP.tropas.locais.filter(function (l) { return l.id === est.de; })[0] : null; }
  function exercitoDe() { return est && est.marchaId ? RP.exercito(est.marchaId) : null; }
  function disponiveis() { var l = localDe(); return l ? l.guarnicao : {}; }
  function grupoAtual() { var e = exercitoDe(); return e && !est.pessoas ? e.tropas : est.grupo; }
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
        if (o.pessoas && o.pessoas.length) { est.pessoas = o.pessoas.slice(); est.grupo = grupoDeIds(o.pessoas); }   /* só parte da tropa */
      } else if (o.pessoas && o.pessoas.length) {
        est = { de: o.de, pessoas: o.pessoas.slice(), grupo: grupoDeIds(o.pessoas), seguro: false };
      } else {
        var l = t.locais.filter(function (x) { return x.id === o.de; })[0] || t.locais.filter(function (x) { return RP.somaGrupo(x.guarnicao) > 0; })[0];
        if (!l || !RP.somaGrupo(l.guarnicao)) { RP.aviso({ titulo: 'Nenhuma tropa para enviar', texto: 'Recrute no castelo ou no quartel.', icone: 'tropas', tipo: 'alerta' }); return; }
        est = { de: l.id, grupo: grupoPadrao(l), seguro: false };
      }
      est.implicito = o.hex != null && !o.linha;
      /* ordem rápida (botão direito): parte sem passar pela barra; só mostra a barra se precisar de escolha */
      if (o.hex != null && o.rapido) { ordemRapida(o.hex); if (est) { barra(); if (RP.selecao) RP.selecao.barra(); } return; }
      barra();
      if (RP.selecao) RP.selecao.barra();
      if (o.linha) { comecarLinha(o.hex); return; }
      if (o.hex != null) { RP.mapa.folhaHex(o.hex); return; }
      RP.aviso({ titulo: 'Clique no destino', texto: 'Botão direito ou esquerdo num local seu, ou em qualquer hexágono.', icone: 'alvo', ms: 1800 });
    }, function () { /* aviso já mostrado */ });
  }
  function cancelar() { est = null; tracos = []; tracando = false; barra(); if (RP.selecao) RP.selecao.barra(); if (RP.mapa.redesenhar) RP.mapa.redesenhar(); }
  /* a ordem de trabalho do hexágono: escavar a ruína ou extrair da jazida (as ordens que têm painel) */
  RP.envio.trabalhoAqui = function (h) {
    return RP.ordensEnvio.filter(function (o) { return o.painel && o.quando(h, RP.mapa.dados()); })[0] || null;
  };
  /* a ordem que parte na hora para um hexágono: reforçar um local seu, ou mover para um hexágono sem local.
     Ruína e jazida pedem escolha, salvo para quem já está parado nelas: aí a ordem é trabalhar. */
  function ordemDireta(h) {
    var local = objetos(h, RP.mapa.dados()).filter(function (o) { return o.tipo === 'local'; })[0];
    if (local) return local.dono === 'meu' && !local.ruina && local.id !== est.de ? 'reforcar' : null;
    var trab = RP.envio.trabalhoAqui(h), e = exercitoDe();
    return !trab ? 'mover' : e && e.hex === h && e.estado === 'parado' ? trab.ordem : null;
  }
  /* botão direito no destino: a ordem direta parte na hora; destino que pede escolha (atacar, caçar, extrair...) abre a folha dele */
  function ordemRapida(h) {
    var d = ordemDireta(h);
    est.implicito = true;
    if (!d) { RP.mapa.folhaHex(h); return; }
    est.hex = h; est.ordem = d;
    if (RP.somaGrupo(grupoAtual())) enviar(); else folhaGrupo();
  }
  RP.envio.rapido = function (h, completa) {
    if (!est) return;
    if (est.painel && est.fixa) {   /* outro destino que serve à mesma ordem continua nela; senão, vira o envio comum */
      var df = defOrdem(est.fixa);
      if (df.quando(h, RP.mapa.dados(), est)) RP.envio.paraOrdem(h, est.fixa); else RP.envio.paraCa(h);
      return;
    }
    if (est.painel) { est.hex = h; est.ordem = ordemDireta(h); est.previa = null; abrirPainel(); return; }   /* outro destino, mesmas tropas */
    if (completa) { est.implicito = true; RP.mapa.folhaHex(h); return; }
    ordemRapida(h);
  };

  /* ---------------------------------------------------------------- envio rápido: botão direito sem tropa selecionada
     Parte do local mais perto (ou do último usado), com as últimas tropas enviadas assim; Enter envia. Um destino que pede
     escolha (atacar, caçar, extrair...) termina na folha do hexágono, com as ordens dele e as tropas já escolhidas. */
  function ultimoRapido() { try { return JSON.parse(RP.pref('envio-rapido') || 'null'); } catch (e) { return null; } }
  function grupoLembrado(l) {
    var u = ultimoRapido(), g = {};
    Object.keys((u && u.grupo) || {}).forEach(function (k) { var n = Math.min(u.grupo[k], (l.guarnicao || {})[k] || 0); if (n > 0) g[k] = n; });
    return RP.somaGrupo(g) ? g : null;
  }
  function painelDaOrdem() { var d = est && est.fixa && defOrdem(est.fixa); return (d && d.painel) || null; }
  /* as tropas que o painel já traz; a ordem pode ajustar (carga, limite por jazida) */
  function ajustarAoPainel(g, l) { var pd = painelDaOrdem(); return pd && pd.grupo ? pd.grupo(g, l, est) : g; }
  /* de onde podem sair: locais com guarnição e tropas em campo livres, do mais perto ao mais longe.
     Com ordem fixa, vale também quem já está no hexágono (a guarnição do posto, a tropa parada na ruína). */
  function origensPara(h, fixa) {
    var t = RP.tropas; if (!t) return [];
    var alvo = fixa ? null : objetos(h, RP.mapa.dados()).filter(function (o) { return o.tipo === 'local'; })[0];
    return t.locais.filter(function (l) { return RP.somaGrupo(l.guarnicao) > 0 && !(alvo && alvo.id === l.id); })
      .map(function (l) { return { id: l.id, nome: l.nome, d: H.dist(l.hex, h) }; })
      .concat(t.exercitos.filter(function (e) { return !e.bloqueio && e.podeOrdem !== false && e.estado !== 'trabalhando' && (fixa || e.hex !== h); })
        .map(function (e) { return { marchaId: e.id, nome: 'Em campo · ' + e.resumo, d: H.dist(e.hex, h) }; }))
      .sort(function (a, b) { return a.d - b.d; }).slice(0, 8);
  }
  function origemPainel(o) {
    est.de = o.id; est.marchaId = o.marchaId; est.previa = null;
    if (o.marchaId) est.grupo = null;
    else { var l = localDe(); est.grupo = l ? ajustarAoPainel(grupoLembrado(l) || grupoPadrao(l), l) : {}; }
    est.ordem = est.fixa || ordemDireta(est.hex);
  }
  function corpoPainel() {
    if (est.semOrigem) return '<div class="envio-resumo" data-envio-resumo></div>';
    var ors = origensPara(est.hex, !!est.fixa), pd = painelDaOrdem();
    return (ors.length > 1 ? '<div class="abas abas-rolagem envio-origens" role="group" aria-label="De onde saem">' + ors.map(function (x) {
      return '<button type="button" class="aba" ' + (x.marchaId ? 'data-envio-ex="' + x.marchaId + '" aria-pressed="' + (x.marchaId === est.marchaId) : 'data-envio-de="' + x.id + '" aria-pressed="' + (x.id === est.de)) + '">' + RP.esc(x.nome) + '</button>';
    }).join('') + '</div>' : '') +
      (est.marchaId ? '<div class="card">' + RP.selosGrupo(grupoAtual()) + '</div>' :
        '<div class="envio-atalhos"><button type="button" class="btn btn-p btn-fantasma" data-envio-atalho="ultimas">Últimas</button><button type="button" class="btn btn-p btn-fantasma" data-envio-atalho="metade">Metade</button><button type="button" class="btn btn-p btn-fantasma" data-envio-atalho="todas">Todas</button></div>' +
        '<div class="card pilha" data-envio-grupo>' + RP.grupoTropas.linhas(est.grupo, disponiveis()) + '</div>') +
      (pd && pd.opcoes ? pd.opcoes(est) : '') +
      '<div class="envio-resumo" data-envio-resumo></div>';
  }
  function acoesPainel() {
    /* sem tropa: a saída é recrutar ou ver quem está fora */
    if (est.semOrigem) return '<a class="btn btn-p btn-primario" href="#/recrutamento" data-tecla="Enter">' + RP.icone('tropas') + 'Recrutar</a><a class="btn btn-p" href="#/tropas">' + RP.icone('seta') + 'Ver as tropas</a>';
    var d = est.fixa ? defOrdem(est.fixa) : null;
    return '<button type="button" class="btn btn-p btn-primario" data-envio-rapido data-tecla="Enter">' + RP.icone(d ? d.icone : 'seta') + (d ? RP.esc(d.verbo) : est.ordem ? 'Enviar' : 'Escolher a ordem') + '</button>' +
      (est.ordem && !est.fixa ? '<button type="button" class="btn btn-p btn-fantasma" data-envio-mais data-tecla="Q">' + RP.icone('alvo') + 'Mais ordens</button>' : '');
  }
  function abrirPainel() {
    var h = est.hex, local = objetos(h, RP.mapa.dados()).filter(function (o) { return o.tipo === 'local'; })[0], pd = painelDaOrdem(), df = est.fixa ? defOrdem(est.fixa) : null;
    RP.abrirFolha({
      titulo: pd ? pd.titulo(h) : 'Enviar tropas para cá',
      subtitulo: '<span class="fraco">' + (pd ? pd.subtitulo(h, est) : (local ? RP.esc(local.nome || RP.TIPOS_LOCAL[local.local] || 'Local') + ' · ' : '') + 'hexágono ' + H.c(h) + ', ' + H.l(h) + ' · ' + (est.ordem === 'reforcar' ? 'entram na defesa do local' : est.ordem === 'mover' ? 'vão até lá e ficam no lugar' : 'escolha a ordem depois')) + '</span>',
      icone: '<span class="ico-placa folha-ico">' + RP.icone(df ? df.icone : 'tropas') + '</span>',
      corpo: corpoPainel(), acoes: acoesPainel(),
      aoFechar: function (troca) { if (!troca && est && est.painel) cancelar(); }
    });
    previaPainel();
  }
  function pintarPainel() { RP.atualizarFolha(corpoPainel(), acoesPainel()); previaPainel(); }
  RP.envio.repintarPainel = function () { if (est && est.painel && RP.folhaAberta()) pintarPainel(); };
  var pedidoPainel = 0;
  function previaPainel() {
    var g = grupoAtual(), n = RP.somaGrupo(g), box = RP.$('[data-envio-resumo]'), ok = RP.$('[data-envio-rapido]'), meu = ++pedidoPainel, pd = painelDaOrdem();
    est.previa = null;
    if (RP.mapa.redesenhar) RP.mapa.redesenhar();
    if (ok) ok.classList.toggle('btn-inativo', !n);
    if (!box) return;
    if (est.semOrigem) { box.innerHTML = '<p class="nota-antiga nota-perigo">' + RP.icone('alerta', 'ico-p') + '<span><b>Nenhuma tropa disponível.</b> Todas estão em marcha ou trabalhando, ou ainda não há soldados. Recrute no castelo ou mande voltar quem está fora.</span></p>'; return; }
    if (!n) { box.innerHTML = '<p class="fraco">Escolha quem vai.</p>'; return; }
    box.innerHTML = '<p class="fraco">' + RP.esc(RP.partesGrupo(g)) + ' · calculando o caminho…</p>';
    var corpo = est.marchaId ? { marchaId: est.marchaId, destinoHex: est.hex } : { deLocalId: est.de, tropas: est.grupo, destinoHex: est.hex };
    var extra = pd && pd.resumo ? pd.resumo(est, g).catch(function (er) { return '<p class="txt-alerta">' + RP.esc(er.message) + '</p>'; }) : Promise.resolve('');
    Promise.all([RP.post('/tropas/previa', corpo), extra]).then(function (x) {
      var p = x[0];
      if (meu !== pedidoPainel || !est || !est.painel) return;
      est.previa = p;
      var b = RP.$('[data-envio-resumo]'), bt = RP.$('[data-envio-rapido]'); if (!b) return;
      if (bt) bt.classList.toggle('btn-inativo', !p.curta.ok);
      b.innerHTML = (p.curta.ok ? '<p><b>' + RP.esc(RP.partesGrupo(g)) + '</b> · ' + (p.curta.min > 0 ? 'chegam em <b>' + RP.fmtDuracao(p.curta.min * 60) + '</b>' : 'já estão lá') + '</p>' : '<p class="txt-alerta">Não há caminho até o destino.</p>') + x[1] + RP.faunaVereditoHTML(p, est.hex, g);
      if (RP.mapa.redesenhar) RP.mapa.redesenhar();
    }, function (e) { var b = RP.$('[data-envio-resumo]'); if (meu === pedidoPainel && b) b.innerHTML = '<p class="txt-alerta">' + RP.esc(e.message) + '</p>'; });
  }
  /* o painel de uma ordem já escolhida: abre sempre, mesmo sem tropa disponível (aí diz isso e oferece a saída) */
  RP.envio.paraOrdem = function (h, ordem) {
    var def = defOrdem(ordem); if (!def) return;
    RP.carregarTropas().then(function () {
      var novo = { hex: h, seguro: false, implicito: true, painel: true, fixa: ordem, ordem: ordem, grupo: {} };
      return (def.painel && def.painel.preparar ? def.painel.preparar(novo) : Promise.resolve()).then(function () {
        var ors = origensPara(h, true), u = ultimoRapido();
        est = novo; est.semOrigem = !ors.length;
        /* quem já está parado no hexágono vem primeiro: trabalha sem sair do lugar */
        if (ors.length) origemPainel(ors.filter(function (x) { return x.marchaId && !x.d; })[0] || (u && ors.filter(function (x) { return x.id === u.de; })[0]) || ors[0]);
        barra(); abrirPainel();
      });
    }).catch(function () { /* aviso já mostrado */ });
  };
  RP.envio.podePara = function (h) { return !RP.tropas || origensPara(h).length > 0; };
  RP.envio.paraCa = function (h) {
    RP.carregarTropas().then(function () {
      var ors = origensPara(h), u = ultimoRapido();
      if (!ors.length) { RP.aviso({ titulo: 'Nenhuma tropa para enviar', texto: 'Recrute no castelo ou no quartel.', icone: 'tropas', tipo: 'alerta' }); return; }
      est = { hex: h, seguro: false, implicito: true, painel: true };
      origemPainel((u && ors.filter(function (x) { return x.id === u.de; })[0]) || ors[0]);
      barra(); abrirPainel();
    }, function () { /* aviso já mostrado */ });
  };

  /* ---------------------------------------------------------------- linha da patrulha, desenhada no mapa */
  function comecarLinha(h) {
    est.implicito = false; est.linha = h != null ? [h] : []; est.circuito = false; tracos = []; tracando = false;
    RP.fecharFolha(); barra();
  }
  /* soma o hexágono à linha, em linha reta desde o último (o dedo pode pular hexágonos) */
  function somarHex(h) {
    var l = est && est.linha; if (!l || h < 0) return;
    var ult = l[l.length - 1]; if (ult === h) return;
    var novos = ult == null ? [h] : H.reta(ult, h).slice(1), max = RP.tropas.maxLinha;
    if (l.length + novos.length > max) { RP.aviso({ titulo: 'A linha chegou ao tamanho máximo', texto: max + ' hexágonos.', icone: 'alerta', tipo: 'alerta', ms: 2000 }); return; }
    Array.prototype.push.apply(l, novos);
    barra();
    if (RP.mapa.redesenhar) RP.mapa.redesenhar();
  }
  /* uma linha no chão: borda clara, tracejado azul que anda no sentido da marcha e um ponto em cada ponta */
  function traco(c, hs, fechar, z, ag, forte) {
    if (!hs.length) return;
    var cor = RP.arte.cores().selecaoPes, lw = Math.max(2.2, 4.4 / z);
    c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
    c.beginPath();
    hs.forEach(function (h, i) { var p = H.centroH(h); if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); });
    if (fechar) c.closePath();
    c.globalAlpha = forte ? 0.95 : 0.7;
    c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = lw * 1.8; c.stroke();
    c.strokeStyle = cor; c.lineWidth = lw; c.setLineDash([lw * 3, lw * 2.4]); c.lineDashOffset = -ag / 90; c.stroke(); c.setLineDash([]);
    [hs[0], hs[hs.length - 1]].forEach(function (h) {
      var p = H.centroH(h);
      c.fillStyle = '#fff'; c.beginPath(); c.arc(p.x, p.y, lw * 1.5, 0, 6.2832); c.fill();
      c.fillStyle = cor; c.beginPath(); c.arc(p.x, p.y, lw, 0, 6.2832); c.fill();
    });
    c.restore();
  }
  /* no chão, nas duas visões: a linha que está sendo desenhada e a linha de quem está selecionado */
  function desenharLinhas(c, d, cam, ag) {
    if (est && est.linha) traco(c, est.linha, est.circuito, cam.z, ag, true);
    if (est && est.painel && est.previa && est.previa.curta.ok) traco(c, est.previa.curta.caminho, false, cam.z, ag, true);
    if (!RP.selecao || !RP.selecao.n() || !RP.mapaModelo.pessoa) return;
    var vistas = {};
    RP.selecao.ids().forEach(function (id) {
      var p = RP.mapaModelo.pessoa(id), g = p && p.grupoId;
      if (!g || g < 0 || vistas[g]) return;
      vistas[g] = true;
      var e = RP.exercito(g), hs = e && e.dados && e.dados.pontos;
      if (hs && (e.ordem === 'patrulhar' || e.ordem === 'percorrer')) traco(c, hs, false, cam.z, ag, false);
    });
  }
  RP.mapa.desenhosExtras.push(desenharLinhas);
  RP.mapa.desenhosExtrasCena.push(desenharLinhas);

  /* ---------------------------------------------------------------- barra "Clique no destino" */
  function barra() {
    var tela = RP.$('[data-tela=mapa]'); if (!tela) return;
    var topo = RP.$('.mapa-topo', tela); if (!topo) return;
    var b = RP.$('.ordem-barra:not(.rota-barra)', topo);
    if (!b) { b = document.createElement('div'); b.className = 'ordem-barra'; b.setAttribute('role', 'status'); topo.appendChild(b); }
    var ver = !!est && !est.painel;
    b.hidden = !ver;
    tela.classList.toggle('em-ordem', ver);
    tela.classList.toggle('em-desenho', !!(est && est.linha));
    if (!ver) return;
    var g = grupoAtual(), l = localDe(), n = RP.somaGrupo(g);
    if (est.linha) {
      var k = est.linha.length, ok = k >= 2 ? '' : ' btn-inativo';
      b.innerHTML = '<span class="ordem-ico">' + RP.icone('alvo') + '</span><span class="ordem-txt"><b>Desenhe a linha da patrulha</b><small>' +
        (k ? k + (k === 1 ? ' hexágono' : ' hexágonos') + ' · ' + (est.circuito ? 'dá a volta pelo circuito' : 'vai e volta pela linha') : 'Arraste no mapa ou clique de hexágono em hexágono') + '</small></span>' +
        '<span class="ordem-botoes"><button type="button" class="btn btn-p btn-primario' + ok + '" data-linha-enviar="patrulhar">' + RP.icone('alvo') + 'Patrulhar<kbd class="tecla">Enter</kbd></button>' +
        '<button type="button" class="btn btn-p' + ok + '" data-linha-enviar="percorrer">' + RP.icone('seta') + 'Só uma vez</button>' +
        '<button type="button" class="btn btn-p btn-fantasma" data-linha-circuito aria-pressed="' + !!est.circuito + '">' + (est.circuito ? 'Circuito: sim' : 'Circuito: não') + '<kbd class="tecla">O</kbd></button>' +
        '<button type="button" class="btn btn-p btn-fantasma" data-linha-desfazer>Desfazer<kbd class="tecla">Z</kbd></button>' +
        '<button type="button" class="btn btn-p btn-fantasma btn-icone" data-envio-cancelar aria-label="Cancelar a linha" data-dica="Cancelar <kbd class=\'tecla\'>Esc</kbd>">' + RP.icone('fechar') + '</button></span>';
      return;
    }
    b.innerHTML = '<span class="ordem-ico">' + RP.icone('alvo') + '</span><span class="ordem-txt"><b>Clique no destino</b><small>' +
      (n ? RP.esc(RP.partesGrupo(g)) : 'nenhuma tropa escolhida') + (est.pessoas ? ' · ' + est.pessoas.length + ' escolhid' + (est.pessoas.length === 1 ? 'a' : 'as') + ' pelo nome' : '') + (l ? ' · de ' + RP.esc(l.nome) : est.marchaId ? ' · exército em campo' : '') + ' · botão direito parte na hora; esquerdo mostra as ordens</small></span>' +
      (est.de ? '<button type="button" class="btn btn-p" data-envio-tropas>' + RP.icone('tropas') + 'Tropas</button>' : '') +
      '<button type="button" class="btn btn-p btn-fantasma btn-icone" data-envio-cancelar aria-label="Cancelar envio" data-dica="Cancelar <kbd class=\'tecla\'>Esc</kbd>">' + RP.icone('fechar') + '</button>';
  }
  RP.teclas.registrar('Enter', { descricao: 'Patrulhar pela linha desenhada', grupo: 'Tropas', oculta: true, quando: function () { return !!(est && est.linha && !RP.folhaAberta()); }, acao: function () { var b = RP.$('[data-linha-enviar="patrulhar"]'); if (b) b.click(); } });
  RP.teclas.registrar('O', { descricao: 'Linha da patrulha: circuito sim/não', grupo: 'Tropas', quando: function () { return !!(est && est.linha); }, acao: function () { est.circuito = !est.circuito; barra(); if (RP.mapa.redesenhar) RP.mapa.redesenhar(); } });
  RP.teclas.registrar('Z', { descricao: 'Linha da patrulha: desfazer o último trecho', grupo: 'Tropas', quando: function () { return !!(est && est.linha); }, acao: function () { var b = RP.$('[data-linha-desfazer]'); if (b) b.click(); } });

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
    /* "Enviar tropa" parte na hora: um local seu (entra na guarnição) ou um hexágono sem local (fica lá). Na ruína ou na jazida, o trabalho vem em destaque. */
    var local = obj.filter(function (o) { return o.tipo === 'local'; })[0], botoes = [];
    var direta = local && local.dono === 'meu' && !local.ruina ? (local.id !== est.de ? 'reforcar' : null) : !local ? 'mover' : null, trab = RP.envio.trabalhoAqui(h);
    RP.ordensEnvio.forEach(function (o) { try { if (o.quando(h, dados, est)) botoes.push(o.ordem); } catch (e) { console.error(e); } });
    return (direta ? '<button type="button" class="btn btn-p' + (trab ? '' : ' btn-primario') + '" data-envio-ja="' + direta + '" data-envio-hex="' + h + '">' + RP.icone('seta') + (direta === 'reforcar' ? 'Reforçar' : 'Mover para cá') + '</button>' : '') +
      botoes.map(function (id, i) {
        var d = defOrdem(id);
        return '<button type="button" class="btn btn-p' + ((trab ? d !== trab : i || direta) ? '' : ' btn-primario') + '" data-envio-ordem="' + RP.esc(id) + '" data-envio-hex="' + h + '"' + (d.tecla ? ' data-tecla="' + d.tecla + '"' : '') + '>' + RP.icone(d.icone || 'seta') + RP.esc(d.rotulo) + '</button>';
      }).join('') +
      '<button type="button" class="btn btn-p" data-envio-linha="' + h + '" data-tecla="Q">' + RP.icone('alvo') + 'Patrulhar daqui</button>' +
      (direta ? '<button type="button" class="btn btn-p btn-fantasma" data-envio-ordem="' + direta + '" data-envio-hex="' + h + '" data-tecla="V">' + RP.icone('rota') + 'Ver o caminho</button>' : '');
  });
  RP.mapa.extrasFolhaHex.push(function (h) {
    if (!RP.tropas) return '';
    return RP.tropas.exercitos.filter(function (e) { return e.hex === h; }).map(function (e) {
      return linha('Exército', RP.esc(e.resumo) + ' · ' + (e.estado === 'parado' ? 'parado' : e.estado === 'retornando' ? 'voltando' : e.estado === 'trabalhando' ? RP.nomeTrabalho(e.trabalho).toLowerCase() : 'em marcha'));
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
      var cls = e.nunca || !t ? 'mr-nevoa' : 't-' + t;
      out += '<polygon class="hx ' + cls + (e.v === 'explorado' && !e.nunca ? ' mr-antigo' : '') + '" points="' + H.cantos(ce.x, ce.y, H.R + 0.6) + '"/>';
      if (t && !e.nunca && M.rio(h)) out += '<circle class="mr-rio" cx="' + ce.x.toFixed(0) + '" cy="' + ce.y.toFixed(0) + '" r="' + (H.R * 0.4).toFixed(0) + '"/>';
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
      (p.forcaInimiga && RP.forcaInimigaHTML ? '<div class="secao-titulo">Força inimiga</div>' + RP.forcaInimigaHTML(p.forcaInimiga) : '') +
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
        (d.ajuste ? '<a class="btn btn-p" data-envio-ajuste href="' + d.ajuste(h, est) + '">' + RP.icone('escudo') + 'Ajustar tática e objetivos</a>' : '') +
        (est.de ? '<button type="button" class="btn btn-p" data-envio-tropas>' + RP.icone('tropas') + 'Tropas</button>' : '') +
        '<button type="button" class="btn btn-p btn-fantasma" data-envio-trocar>' + RP.icone('alvo') + 'Trocar destino</button>'
    });
  }
  function enviar() {
    var e = est, d = defOrdem(e.ordem), nota = '';
    if (e.enviando) return;   /* Enter segurado não manda duas vezes */
    e.enviando = true;
    var extra = d.dados ? d.dados(e.hex, RP.mapa.dados(), e) : undefined;
    /* o que a ordem faz antes de partir (pôr o posto na fila); devolve uma nota para o aviso */
    var antes = e.painel && d.painel && d.painel.antes ? d.painel.antes(e) : Promise.resolve('');
    RP.tentar(antes.then(function (n) {
      nota = n || '';
      return e.marchaId
        ? RP.post('/tropas/' + e.marchaId + '/ordem', { ordem: e.ordem, destinoHex: e.hex, seguro: !!e.seguro, dados: extra, pessoas: e.pessoas || undefined })
        : RP.post('/tropas/enviar', e.pessoas ? { deLocalId: e.de, pessoas: e.pessoas, destinoHex: e.hex, ordem: e.ordem, seguro: !!e.seguro, dados: extra } : { deLocalId: e.de, tropas: e.grupo, destinoHex: e.hex, ordem: e.ordem, seguro: !!e.seguro, dados: extra });
    })).then(function (ex) {
      if (e.painel && e.de) RP.pref('envio-rapido', JSON.stringify({ de: e.de, grupo: e.grupo }));
      RP.fecharFolha(); cancelar();
      /* a tropa continua selecionada (são as mesmas pessoas): dá para mandar de novo sem clicar nela */
      if (RP.selecao) RP.selecao.barra();
      RP.aviso({ titulo: e.linha ? (e.ordem === 'patrulhar' ? 'Patrulha a caminho' : 'Percurso a caminho') : e.marchaId ? 'Nova ordem dada' : 'Tropas a caminho', texto: (ex && ex.chegada && !e.linha ? (RP.partesGrupo(ex.tropas) + (ex.hex === e.hex || (e.previa && e.previa.curta && !(e.previa.curta.min > 0)) ? ' · já estão lá.' : ' · chegam ' + RP.fmtEm(ex.chegada) + '.')) : '') + nota, icone: d.icone || 'seta', tipo: 'sucesso' });
      if (RP.mapa.recarregar) RP.mapa.recarregar();
      RP.recarregarReino(); RP.carregarTropas().catch(function () { /* offline */ });
    }).catch(function () { e.enviando = false; /* aviso já mostrado: o painel segue aberto */ });
  }

  /* ---------------------------------------------------------------- juntar e separar tropas */
  function atualizarDepois() {
    if (RP.mapa.recarregar) RP.mapa.recarregar();
    RP.recarregarReino(); RP.carregarTropas().catch(function () { /* offline */ });
  }
  /* o = origem da seleção ({ de | marchaId, parte }); t = a tropa tocada depois ({ ids, marchaId, hex }) */
  function folhaJuntar(o, t) {
    var g = RP.selecao.grupo(), M = RP.mapaModelo, longe = true;
    if (o.marchaId) { var mc = M.dados.marchas.filter(function (x) { return x.id === o.marchaId; })[0]; longe = !mc || M.posMarcha(mc, RP.agora()).hex !== t.hex; }
    juntando = { o: o, t: t, ids: RP.selecao.ids() };
    RP.abrirFolha({
      titulo: 'Juntar tropas',
      icone: '<span class="ico-placa folha-ico dono-meu">' + RP.icone('tropas') + '</span>',
      corpo: '<div class="info">' + linha('Selecionada', RP.selosGrupo(g)) + linha('Com', RP.selosGrupo(grupoDeIds(t.ids))) + '</div>' +
        (longe ? '<p class="nota-regra">' + RP.icone('seta', 'ico-p') + '<span>A tropa selecionada vai até a outra e as duas viram uma ao chegar.</span></p>' : ''),
      acoes: '<button type="button" class="btn btn-p btn-primario" data-tropa-juntar>' + RP.icone('tropas') + 'Juntar</button>' +
        '<button type="button" class="btn btn-p btn-fantasma" data-tropa-trocar>' + RP.icone('populacao') + 'Selecionar a outra</button>'
    });
  }
  function juntar() {
    var j = juntando; if (!j) return;
    var corpo = j.o.marchaId ? { deMarchaId: j.o.marchaId, paraMarchaId: j.t.marchaId, pessoas: j.o.parte || undefined } : { deLocalId: j.o.de, paraMarchaId: j.t.marchaId, pessoas: j.ids };
    RP.tentar(RP.post('/tropas/juntar', corpo)).then(function (ex) {
      juntando = null; RP.fecharFolha(); RP.selecao.limpar();
      var feito = ex.id === j.t.marchaId;
      RP.aviso({ titulo: feito ? 'Tropas juntas' : 'Tropa a caminho', texto: feito ? RP.partesGrupo(ex.tropas) : 'Viram uma só ao chegar.', icone: 'tropas', tipo: 'sucesso' });
      atualizarDepois();
    });
  }
  /* escolher quem sai: um clique marca, o resto fica; a tropa nova nasce selecionada, pronta para receber destino */
  function folhaSeparar(id) {
    var M = RP.mapaModelo, mc = M.dados.marchas.filter(function (x) { return x.id === id; })[0];
    var gente = ((mc && mc.pessoaIds) || []).map(function (x) { return M.pessoa(x); }).filter(function (p) { return p && RP.pessoasVista.ehSoldado(p); });
    if (gente.length < 2) { RP.aviso({ titulo: 'Esta tropa tem uma pessoa só', icone: 'info' }); return; }
    sep = { id: id, sai: {} };
    RP.abrirFolha({
      titulo: 'Separar tropa', subtitulo: '<span class="fraco">Clique em quem sai. Quem sai forma outra tropa, parada aqui.</span>',
      icone: '<span class="ico-placa folha-ico dono-meu">' + RP.icone('tropas') + '</span>',
      corpo: '<div class="lista pessoas-lista">' + gente.map(function (p) {
        return '<button type="button" class="lista-item pessoa-item" data-separar-p="' + p.id + '" aria-pressed="false"><span class="ico-placa dono-meu">' + RP.icone(RP.iconeUnidade(p.oficio)) + '</span>' +
          '<div style="flex:1;min-width:0"><b>' + RP.esc(p.nome) + '</b><div class="fraco">' + RP.esc(RP.nomeUnidade(p.oficio, 1)) + '</div></div></button>';
      }).join('') + '</div>',
      acoes: '<button type="button" class="btn btn-p btn-primario btn-inativo" data-separar-ok>' + RP.icone('tropas') + 'Separar</button>'
    });
  }
  function separar() {
    var ids = Object.keys(sep.sai).map(Number), id = sep.id;
    if (!ids.length) { RP.aviso({ titulo: 'Clique em quem sai', icone: 'info' }); return; }
    RP.tentar(RP.post('/tropas/' + id + '/separar', { pessoas: ids })).then(function (novo) {
      sep = null; RP.fecharFolha();
      RP.aviso({ titulo: 'Tropa nova', texto: RP.partesGrupo(novo.tropas) + '. Clique no destino para enviar.', icone: 'tropas', tipo: 'sucesso' });
      var p = RP.mapa.recarregar ? RP.mapa.recarregar() : null;
      RP.recarregarReino(); RP.carregarTropas().catch(function () { /* offline */ });
      Promise.resolve(p).then(function () { RP.selecao.definir(ids); }, function () { /* offline */ });
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
    if ((b = e.target.closest('[data-tropa-trabalhar]'))) {
      var idTrab = +b.getAttribute('data-tropa-trabalhar'), oTrab = RP.selecao && RP.selecao.n() ? RP.selecao.origem() : null;
      RP.fecharFolha(); iniciar({ marchaId: idTrab, pessoas: oTrab && oTrab.marchaId === idTrab ? oTrab.parte : null, hex: +b.getAttribute('data-hex'), rapido: true });
      return;
    }
    if ((b = e.target.closest('[data-envio-painel]'))) { RP.envio.paraOrdem(+b.getAttribute('data-envio-hex'), b.getAttribute('data-envio-painel')); return; }
    if (e.target.closest('[data-tropa-juntar]')) { juntar(); return; }
    if (e.target.closest('[data-tropa-trocar]') && juntando) { var jt = juntando.t; juntando = null; RP.fecharFolha(); RP.selecao.definir(jt.ids); return; }
    if ((b = e.target.closest('[data-tropa-separar]'))) { folhaSeparar(+b.getAttribute('data-tropa-separar')); return; }
    if ((b = e.target.closest('[data-tropa-patrulhar]'))) { RP.fecharFolha(); iniciar({ marchaId: +b.getAttribute('data-tropa-patrulhar'), linha: true }); return; }
    if ((b = e.target.closest('[data-separar-p]')) && sep) {
      var pid = b.getAttribute('data-separar-p'), marca = !sep.sai[pid];
      if (marca) sep.sai[pid] = true; else delete sep.sai[pid];
      b.classList.toggle('selecionada', marca); b.setAttribute('aria-pressed', String(marca));
      var ok = RP.$('[data-separar-ok]'), q = Object.keys(sep.sai).length;
      if (ok) { ok.classList.toggle('btn-inativo', !q); ok.lastChild.textContent = q ? 'Separar ' + q + (q === 1 ? ' pessoa' : ' pessoas') : 'Separar'; }
      return;
    }
    if (e.target.closest('[data-separar-ok]') && sep) { separar(); return; }
    if (!est) return;
    if (e.target.closest('[data-envio-ajuste]')) { RP.fecharFolha(); cancelar(); return; }   /* o link abre a tela do ataque */
    if ((b = e.target.closest('[data-envio-rapido]'))) {
      if (b.classList.contains('btn-inativo')) return;
      if (est.ordem) enviar(); else { est.painel = false; RP.mapa.folhaHex(est.hex); }
      return;
    }
    if (e.target.closest('[data-envio-mais]')) { est.painel = false; RP.mapa.folhaHex(est.hex); return; }
    if ((b = e.target.closest('[data-envio-ex]'))) { origemPainel({ marchaId: +b.getAttribute('data-envio-ex') }); pintarPainel(); return; }
    if ((b = e.target.closest('[data-envio-atalho]'))) {
      var la = localDe(), qual = b.getAttribute('data-envio-atalho'), disp = disponiveis(), ga = {};
      if (qual === 'ultimas') ga = (la && (grupoLembrado(la) || grupoPadrao(la))) || {};
      else Object.keys(disp).forEach(function (k) { if (disp[k] > 0) ga[k] = qual === 'todas' ? disp[k] : Math.ceil(disp[k] / 2); });
      est.grupo = la ? ajustarAoPainel(ga, la) : ga; pintarPainel();
      return;
    }
    if ((b = e.target.closest('[data-envio-ja]'))) {
      est.hex = +b.getAttribute('data-envio-hex'); est.ordem = b.getAttribute('data-envio-ja');
      if (RP.somaGrupo(grupoAtual())) enviar(); else folhaGrupo();
      return;
    }
    if ((b = e.target.closest('[data-envio-linha]'))) { comecarLinha(+b.getAttribute('data-envio-linha')); return; }
    if ((b = e.target.closest('[data-linha-enviar]')) && est.linha) {
      if (est.linha.length < 2) { RP.aviso({ titulo: 'Desenhe pelo menos dois hexágonos', icone: 'info', ms: 2000 }); return; }
      est.ordem = b.getAttribute('data-linha-enviar'); est.hex = est.linha[0];
      enviar(); return;
    }
    if (e.target.closest('[data-linha-circuito]')) { est.circuito = !est.circuito; barra(); return; }
    if (e.target.closest('[data-linha-desfazer]')) {
      if (tracos.length) est.linha.length = tracos.pop(); else est.linha.length = 0;
      barra(); if (RP.mapa.redesenhar) RP.mapa.redesenhar();
      return;
    }
    if (e.target.closest('[data-envio-cancelar]')) { RP.fecharFolha(); cancelar(); return; }
    if (e.target.closest('[data-envio-tropas]')) { folhaGrupo(); return; }
    if (e.target.closest('[data-envio-por-quantidade]')) { var lq = localDe(); est.pessoas = null; est.grupo = lq ? grupoPadrao(lq) : {}; if (RP.selecao) RP.selecao.limpar(); folhaGrupo(); barra(); return; }
    if ((b = e.target.closest('[data-envio-de]'))) {
      var l = RP.tropas.locais.filter(function (x) { return x.id === +b.getAttribute('data-envio-de'); })[0];
      if (l && est.painel) { origemPainel({ id: l.id }); pintarPainel(); }
      else if (l) { est.de = l.id; est.grupo = grupoPadrao(l); folhaGrupo(); barra(); }
      return;
    }
    if (e.target.closest('[data-envio-grupo]') && RP.grupoTropas.clique(e, est.grupo, disponiveis())) {
      RP.$('[data-envio-grupo]').innerHTML = RP.grupoTropas.linhas(est.grupo, disponiveis()); barra(); if (est.painel) previaPainel(); return;
    }
    if (e.target.closest('[data-envio-pronto]')) { RP.fecharFolha(); barra(); if (est.hex != null && est.ordem) confirmar(est.hex, est.ordem); return; }
    if ((b = e.target.closest('[data-envio-ordem]'))) { confirmar(+b.getAttribute('data-envio-hex'), b.getAttribute('data-envio-ordem')); return; }
    if ((b = e.target.closest('[data-caminho]')) && est.previa) { est.seguro = b.getAttribute('data-caminho') === 'segura'; folhaConfirmar(); return; }
    if (e.target.closest('[data-envio-trocar]')) { RP.fecharFolha(); est.hex = null; RP.aviso({ titulo: 'Clique no novo destino', icone: 'alvo', ms: 1600 }); return; }
    if (e.target.closest('[data-envio-confirmar]')) { if (est.previa && est.previa.curta.ok) enviar(); }
  });

  /* entrar no mapa com #/mapa?enviar=<local> ou #/mapa?mover=<exército> começa o envio; ?centro=<hex>&ordem=<ordem> abre o painel da ordem */
  document.addEventListener('rp:tela', function (ev) {
    if (ev.detail !== 'mapa') return;   /* uma janela aberta não cancela o envio: o mapa continua embaixo */
    var q = new URLSearchParams((location.hash.split('?')[1]) || '');
    RP.carregarTropas().catch(function () { /* offline */ });
    var limpar = function () { try { history.replaceState(null, '', '#/mapa'); } catch (e) { /* ignora */ } };
    if (q.get('enviar')) { limpar(); iniciar({ de: +q.get('enviar') }); }
    else if (q.get('mover')) { limpar(); iniciar({ marchaId: +q.get('mover') }); }
    else if (q.get('ordem') && q.get('centro')) { limpar(); RP.envio.paraOrdem(+q.get('centro'), q.get('ordem')); }   /* centra (o mapa cuida) e abre o painel da ordem */
    else barra();
  });

  /* ---------------------------------------------------------------- exércitos no mapa: o Mapa e a Vista desenham pelo tipo */
  RP.mapa.tiposMarcha = RP.mapa.tiposMarcha || {};
  RP.mapa.tiposMarcha.exercito = RP.mapa.tiposMarcha.exercito || { nome: 'Exército', icone: 'tropas' };
})();
