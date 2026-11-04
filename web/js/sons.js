/* Reino de Pedra — sons de efeito (Web Audio).

   RP.sons.tocar(nome, { vol, pan })  toca um som curto (uma variante sorteada, com o tom um pouco diferente a cada vez)
   RP.sons.mundo(fontes, cena)       sons do mundo à vista na Vista: quem trabalha, treina ou luta perto do centro da tela
   RP.sons.ligado() / definir({ ligado, volume, mundo })

   Os arquivos ficam em web/sons (MP3 mono, de pacotes CC0 da Kenney; ver web/sons/LICENCAS.md) e só são baixados
   na primeira vez que tocam. O navegador só deixa tocar depois de um toque do jogador: o contexto de áudio nasce no
   primeiro toque ou tecla. Preferências no aparelho (RP.pref): sons, volume e sons do mundo. */
(function () {
  'use strict';
  var RP = window.RP;

  /* nome → arquivos (variantes), volume base e intervalo mínimo entre dois toques do mesmo som (ms) */
  var SONS = {
    clique: { f: ['clique-1', 'clique-2'], vol: 0.25, gap: 40 },
    folha: { f: ['folha-1', 'folha-2', 'folha-3'], vol: 0.35, gap: 120 },
    fechar: { f: ['fechar-1'], vol: 0.25, gap: 120 },
    erro: { f: ['erro-1'], vol: 0.4, gap: 300 },
    confirmar: { f: ['confirmar-1'], vol: 0.35, gap: 200 },
    marchar: { f: ['marchar-1', 'marchar-2'], vol: 0.6, gap: 200 },
    atacar: { f: ['atacar-1', 'atacar-2', 'atacar-3'], vol: 0.55, gap: 200 },
    construir: { f: ['construir-1', 'construir-2', 'construir-3'], vol: 0.55, gap: 200 },
    recrutar: { f: ['recrutar-1', 'recrutar-2'], vol: 0.6, gap: 200 },
    moedas: { f: ['moedas-1', 'moedas-2'], vol: 0.5, gap: 200 },
    pergaminho: { f: ['pergaminho-1'], vol: 0.45, gap: 300 },
    sino: { f: ['sino-1', 'sino-2'], vol: 0.45, gap: 800 },
    batalha: { f: ['batalha-1', 'batalha-2', 'batalha-3', 'batalha-4'], vol: 0.4, gap: 120 },
    machado: { f: ['machado-1', 'machado-2', 'machado-3'], vol: 0.45, gap: 90 },
    picareta: { f: ['picareta-1', 'picareta-2', 'picareta-3'], vol: 0.35, gap: 90 },
    martelo: { f: ['martelo-1', 'martelo-2'], vol: 0.35, gap: 90 },
    forja: { f: ['forja-1', 'forja-2'], vol: 0.35, gap: 150 },
    reliquia: { f: ['reliquia-1'], vol: 0.45, gap: 500 },
    pano: { f: ['pano-1', 'pano-2'], vol: 0.35, gap: 150 }
  };

  function pref(k, padrao) { var v = RP.pref(k); return v == null ? padrao : v; }
  var cfg = { ligado: pref('sons', '1') !== '0', volume: Math.max(0, Math.min(1, parseFloat(pref('volume', '0.7')) || 0)), mundo: pref('sons-mundo', '1') !== '0' };
  var ctx = null, mestre = null, buffers = {}, ultimo = {};

  /* o contexto de áudio só nasce depois de um gesto do jogador (regra dos navegadores) */
  function destravar() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }
    mestre = ctx.createGain(); mestre.gain.value = cfg.volume; mestre.connect(ctx.destination);
    /* os mais comuns já ficam prontos */
    ['clique', 'folha', 'fechar', 'confirmar'].forEach(function (n) { SONS[n].f.forEach(carregar); });
  }
  ['pointerdown', 'keydown'].forEach(function (t) { window.addEventListener(t, destravar, { capture: true, passive: true }); });

  function carregar(arq) {
    if (buffers[arq] || !ctx) return buffers[arq];
    buffers[arq] = fetch('sons/' + arq + '.mp3').then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(function (a) { return new Promise(function (ok, falha) { ctx.decodeAudioData(a, ok, falha); }); })
      .then(function (b) { buffers[arq] = b; return b; })
      .catch(function () { buffers[arq] = null; return null; });
    return buffers[arq];
  }

  function tocar(nome, o) {
    o = o || {};
    var s = SONS[nome]; if (!s || !cfg.ligado || !ctx || ctx.state !== 'running') return;
    var agora = performance.now(); if (agora - (ultimo[nome] || 0) < s.gap) return;
    ultimo[nome] = agora;
    var arq = s.f[Math.floor(Math.random() * s.f.length)], b = buffers[arq];
    if (!b) { carregar(arq); return; }        /* primeira vez: baixa e toca da próxima */
    if (typeof b.then === 'function') return;
    var fonte = ctx.createBufferSource(); fonte.buffer = b;
    fonte.playbackRate.value = 0.94 + Math.random() * 0.12;
    var g = ctx.createGain(); g.gain.value = s.vol * (o.vol == null ? 1 : o.vol);
    var saida = g;
    if (o.pan && ctx.createStereoPanner) { var p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); g.connect(p); saida = p; }
    fonte.connect(g); saida.connect(mestre);
    fonte.start();
  }
  /* toca já na primeira vez (espera o arquivo): para ações do jogador, que acontecem uma vez */
  function tocarJa(nome, o) {
    var s = SONS[nome]; if (!s || !cfg.ligado || !ctx) return;
    var pend = s.f.map(carregar).filter(function (b) { return b && typeof b.then === 'function'; });
    if (!pend.length) { tocar(nome, o); return; }
    Promise.all(pend).then(function () { tocar(nome, o); });
  }

  /* ---------------------------------------------------------------- sons do mundo (Vista)
     fontes: [{ som, x, y }] em pixels de tela. A cada quadro, cada tipo de som pode tocar de novo depois de um
     intervalo sorteado; toca a fonte mais perto do centro, mais alto quanto mais perto e quanto maior o zoom, e
     puxado para o lado em que ela está. Longe (zoom pequeno), o mundo fica quieto. */
  var RITMO = { machado: [700, 1400], picareta: [600, 1300], martelo: [700, 1500], forja: [900, 1800], batalha: [180, 420] };
  var proximo = {};
  function mundo(fontes, cena) {
    if (!cfg.ligado || !cfg.mundo || !ctx || ctx.state !== 'running' || !fontes.length || document.hidden) return;
    var zoom = Math.max(0, Math.min(1, (cena.cam.s - 1.0) / 1.6));
    if (zoom <= 0.02) return;
    var w = cena.w, h = cena.h, agora = performance.now(), melhor = {};
    fontes.forEach(function (f) {
      if (!RITMO[f.som]) return;
      var d = Math.hypot((f.x - w / 2) / (w / 2), (f.y - h / 2) / (h / 2));
      if (d > 1.3) return;
      if (!melhor[f.som] || d < melhor[f.som].d) melhor[f.som] = { d: d, x: f.x, n: (melhor[f.som] ? melhor[f.som].n : 0) + 1 };
      else melhor[f.som].n++;
    });
    Object.keys(melhor).forEach(function (som) {
      if (agora < (proximo[som] || 0)) return;
      var r = RITMO[som], m = melhor[som], muitos = Math.min(2.5, 1 + (m.n - 1) * 0.25);
      proximo[som] = agora + (r[0] + Math.random() * (r[1] - r[0])) / muitos;
      var vol = zoom * Math.max(0, 1 - m.d / 1.3) * (0.55 + 0.45 * Math.min(1, m.n / 4));
      if (vol > 0.03) tocar(som, { vol: vol, pan: (m.x - w / 2) / (w / 2) * 0.7 });
    });
  }

  RP.sons = {
    tocar: tocar, tocarJa: tocarJa, mundo: mundo,
    ligado: function () { return cfg.ligado; },
    config: function () { return { ligado: cfg.ligado, volume: cfg.volume, mundo: cfg.mundo }; },
    definir: function (o) {
      if (o.ligado != null) { cfg.ligado = !!o.ligado; RP.pref('sons', cfg.ligado ? '1' : '0'); }
      if (o.volume != null) { cfg.volume = Math.max(0, Math.min(1, +o.volume)); RP.pref('volume', String(cfg.volume)); if (mestre) mestre.gain.value = cfg.volume; }
      if (o.mundo != null) { cfg.mundo = !!o.mundo; RP.pref('sons-mundo', cfg.mundo ? '1' : '0'); }
    }
  };

  /* ---------------------------------------------------------------- ganchos da interface */
  /* toque em qualquer botão, aba ou item de lista: clique curto */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button, a.lista-item, .aba, [role="tab"], .nav a, input[type="checkbox"]');
    if (b && !b.disabled) tocar('clique');
  }, true);

  /* ações confirmadas pelo servidor: som do que foi feito. Caminho do pedido → som. */
  var ACOES = [
    [/^\/ataques|^\/interceptacao$/, 'atacar'],
    [/^\/tropas\/enviar|^\/tropas\/\d+\/ordem|^\/exploradores\/enviar|^\/exploradores\/\d+/, 'marchar'],
    [/^\/obras|^\/rotas|^\/postos|^\/defesas\/|^\/salgadeira/, 'construir'],
    [/^\/recrutamento|^\/exploradores\/treinar|^\/mensageiros\/treinar|^\/veiculos/, 'recrutar'],
    [/^\/ferraria\//, 'forja'],
    [/^\/comercio\/|^\/propostas\/|^\/alianca\/pedidos/, 'moedas'],
    [/^\/mensagens$|^\/alianca|^\/aliancas\//, 'pergaminho'],
    [/^\/reliquias\//, 'reliquia'],
    [/^\/extracao$|^\/coleta/, 'picareta'],
    [/^\/feridos\/curar/, 'pano']
  ];
  RP.sons.aoPedido = function (metodo, caminho) {
    if (metodo === 'GET' || /previa|lidas|preferencias|\/postura$/.test(caminho)) return;
    for (var i = 0; i < ACOES.length; i++) if (ACOES[i][0].test(caminho)) { tocarJa(ACOES[i][1]); return; }
  };
  RP.sons.aoErro = function () { tocar('erro'); };

  /* notificações do jogo (chegam pelo servidor em tempo real): som pela categoria */
  var CATEGORIA = { ataques: 'sino', batalhas: 'batalha', obras: 'construir', tropas: 'marchar', exploracao: 'folha', recursos: 'moedas',
    reliquias: 'reliquia', alianca: 'pergaminho', comercio: 'moedas', mensagens: 'pergaminho', reino: 'sino', temporada: 'sino' };
  if (RP.ouvir) RP.ouvir('notificacao', function (n) { if (n && n.tocar) tocarJa(CATEGORIA[n.categoria] || 'confirmar', { vol: n.categoria === 'ataques' ? 1.2 : 0.9 }); });
})();
