/* Reino de Pedra — modelo do mundo no cliente, compartilhado pela Vista (2.5D), pelo Mapa tático, pelo minimapa
   e pela Vista de Meu reino. Vem de GET /api/v1/mapa (VisaoMapa no servidor) ou, sem login, do feed público (/publico/*):
   o servidor já escondeu o que não se pode saber; aqui só se organiza para desenhar.
     terreno: uma letra por hexágono (p, f, c, m, b), maiúscula = rio. É público.
     idade:   minutos desde a última vista (0 = ao vivo, -1 = nunca explorado: a névoa cobre a riqueza do chão, não o resto)
     objetos: [{ tipo: 'local' | 'marcha' | 'jazida' | 'ruina-antiga' | tipos de outros sistemas, hex, ... }]
   Também cria o ponto de extensão RP.mapa (tipos de objeto, extras de folha, camadas) para sistemas
   registrarem desenhos sem editar este arquivo. */
(function () {
  'use strict';
  var RP = window.RP, H = RP.hex;

  var LETRA = { p: 'planicie', f: 'floresta', c: 'colina', m: 'montanha', b: 'pantano' };

  /* ---------------------------------------------------------------- pontos de extensão (antes de qualquer tela) */
  var MAPA = RP.mapa = RP.mapa || {};
  /* extrasFolhaHex/acoesFolhaHex: f(hex, dados) → HTML; desenhosExtras (Mapa) e desenhosExtrasCena (Vista, no chão):
     f(ctx, dados, cam, agora) com o ctx no espaço do mundo; legendaExtras: f() → HTML na folha de camadas */
  ['extrasFolhaHex', 'acoesFolhaHex', 'desenhosExtras', 'desenhosExtrasCena', 'legendaExtras'].forEach(function (k) { MAPA[k] = MAPA[k] || []; });
  /* RP.mapa.tiposObjeto[tipo] = { (todos opcionais; sem registro, o objeto ganha um marcador genérico)
       camada: 'fauna' | 'bandeiras' | ...       camada que liga/desliga o tipo
       nome(o), icone(o)                         nome curto e ícone (folhas, listas)
       classe(o, info), svgTatico(o, info)       classes e markup SVG do marcador no Mapa, centrado em (0,0)
       svgFundo(o, info)                         SVG sob os marcadores (contorno do alcance, área)
       desenharTatico(ctx, o, info)              Canvas no espaço do mundo, sob os marcadores
       desenharCena(c, o, info)                  Vista, a partir do chão (info: { t, pal, anim, antigo, estado, A: RP.arte })
       rotulo(o, info) → texto ou { txt, cls, cor }, rotuloDy, alvo: { w, h }   pílula e área de toque na Vista
       atravessaNevoa, sobreNevoa(c, o, info)    aparece mesmo na névoa (farol) e desenha por cima dela
       pos(o, t) → { x, y }                      objetos que se movem
       folha(o, dados), acoes(o, dados) → HTML   linhas e botões nas folhas
     } (info.antigo: informação antiga, último estado conhecido) */
  MAPA.tiposObjeto = MAPA.tiposObjeto || {};
  /* este mapa desenha tiposObjeto sozinho (sistemas não precisam desenhar por desenhosExtras) */
  MAPA.desenhaTiposObjeto = true;
  /* marchas que estão agora no hexágono h (dados.porHex não tem marchas: elas andam) */
  MAPA.marchasEm = function (h, dados) {
    var d = dados || (RP.mapaModelo && RP.mapaModelo.dados), t = RP.agora();
    if (!d || !d.marchas || !RP.mapaModelo) return [];
    return d.marchas.filter(function (o) { return RP.mapaModelo.posMarcha(o, t).hex === h; });
  };
  /* RP.mapa.tiposMarcha[o.marcha] = { nome, icone, desenharCena(c, o, info) } — tipos novos de marcha (explorador, caravana...) */
  MAPA.tiposMarcha = MAPA.tiposMarcha || {};
  /* camada Perigo: o sistema de fauna define RP.mapa.perigoHex = function (hex, dados) → 'baixo' | 'medio' | 'alto' | null */
  if (!('perigoHex' in MAPA)) MAPA.perigoHex = null;
  MAPA.camadas = MAPA.camadas || { perigo: false, fauna: true, rotas: true, marchas: true, recursos: true, bandeiras: true, rotulos: true, grade: false };

  /* ---------------------------------------------------------------- modelo */
  var M = { dados: null, versao: 0 };

  /* o terreno não muda: letras, rios e curvas são preparados uma vez só (o mapa inteiro é público e grande) */
  var chao = null;
  function prepararChao(d) {
    if (chao && chao.terreno === d.terreno) return chao;
    var n = d.cols * d.lins, ter = new Array(n), rio = new Uint8Array(n), i, ch, low;
    for (i = 0; i < n; i++) {
      ch = d.terreno.charAt(i);
      if (!ch) { ter[i] = null; continue; }
      low = ch.toLowerCase();
      ter[i] = LETRA[low] || 'planicie';
      rio[i] = ch !== low ? 1 : 0;
    }
    var rios = ligacoes(function (h) { return rio[h]; });
    chao = { terreno: d.terreno, ter: ter, rio: rio, rios: rios, curvaRios: curvas(rios) };
    return chao;
  }
  /* quem é o dono: o nome e o brasão vêm do dicionário de reinos */
  function enfeitar(d, o) {
    if (o.reinoId && d.reinos && d.reinos[o.reinoId]) { o.reino = d.reinos[o.reinoId]; o.brasao = o.reino.brasao; }
    return o;
  }
  function indexar(d) {
    d.porHex = {}; d.marchas = []; d.objs = [];
    (d.objetos || []).forEach(function (o, k) {
      o._k = k;
      enfeitar(d, o);
      if (o.tipo === 'marcha') { d.marchas.push(o); return; }
      d.objs.push(o);
      if (o.hex != null && o.hex >= 0) (d.porHex[o.hex] = d.porHex[o.hex] || []).push(o);
      /* construções ocupam vários hexágonos (o.ocupa): o toque em qualquer um deles acha o local; o desenho é um só, no centro */
      (o.ocupa || []).forEach(function (h) { if (h !== o.hex) (d.porHex[h] = d.porHex[h] || []).push(o); });
    });
  }
  function preparar(d) {
    H.configurar(d.cols, d.lins);
    var n = d.cols * d.lins, ch = prepararChao(d);
    d.ter = ch.ter; d.rio = ch.rio; d.curvaRios = ch.curvaRios;
    d.rotaH = new Uint8Array(n); d.ponteH = new Uint8Array(n);
    (d.rotas || []).forEach(function (h) { d.rotaH[h] = 1; });
    (d.pontes || []).forEach(function (h) { d.ponteH[h] = 1; });
    indexar(d);
    d.recebidoEm = RP.agora();
    /* pessoas do reino: por hexágono (as que estão num local) e por id (as de marcha vão com a marcha) */
    d.pessoasPorHex = {}; d.pessoaPorId = {};
    (d.pessoas || []).forEach(function (p) {
      d.pessoaPorId[p.id] = p;
      if (p.hex != null && p.hex >= 0) (d.pessoasPorHex[p.hex] = d.pessoasPorHex[p.hex] || []).push(p);
    });
    d.curvaRiosVivos = curvas(ch.rios, function (h) { return d.idade[h] === 0; });
    d.curvaRotas = curvas(ligacoes(function (h) { return d.rotaH[h] && d.ter[h]; }));
  }

  /* Ligações entre hexágonos vizinhos do conjunto (rio, rota). Atalhos que fecham triângulos (um rio que
     serpenteia toca o hexágono de dois passos atrás) são cortados, a começar pelos que ligam os hexágonos
     com mais vizinhos, para a linha seguir o curso em vez de virar uma malha. */
  function ligacoes(teste) {
    var n = H.COLS * H.LINS, viz = {}, h, k;
    for (h = 0; h < n; h++) if (teste(h)) viz[h] = H.vizinhos(h).filter(teste);
    function grau(x) { return viz[x].length; }
    function emTriangulo(a, b) { return viz[a].some(function (c) { return c !== b && viz[b].indexOf(c) >= 0; }); }
    /* cortar uma ligação só desfaz triângulos: basta olhar as que estão em triângulo agora (o mapa inteiro tem milhares de hexágonos de rio) */
    var candidatas = [];
    Object.keys(viz).forEach(function (s) { var a = +s; viz[a].forEach(function (b) { if (b > a && emTriangulo(a, b)) candidatas.push([a, b]); }); });
    for (k = 0; k < 4000; k++) {
      var melhor = null, nota = -1;
      candidatas = candidatas.filter(function (x) { return viz[x[0]].indexOf(x[1]) >= 0 && emTriangulo(x[0], x[1]); });
      candidatas.forEach(function (x) {
        var g = grau(x[0]) + grau(x[1]);
        if (g > nota) { nota = g; melhor = x; }
      });
      if (!melhor) break;
      viz[melhor[0]].splice(viz[melhor[0]].indexOf(melhor[1]), 1);
      viz[melhor[1]].splice(viz[melhor[1]].indexOf(melhor[0]), 1);
    }
    return viz;
  }
  /* Curvas suaves por hexágono: de meio de aresta a meio de aresta, com o centro como controle.
     Hexágonos vizinhos se encontram no mesmo ponto e na mesma direção, então a linha sai contínua. */
  function curvas(viz, filtro) {
    var p = new Path2D();
    Object.keys(viz).forEach(function (s) {
      var h = +s;
      if (filtro && !filtro(h)) return;
      var ce = H.centroH(h), mids = viz[h].filter(function (v) { return !filtro || filtro(v); })
        .map(function (v) { var q = H.centroH(v); return { x: (ce.x + q.x) / 2, y: (ce.y + q.y) / 2 }; });
      if (!mids.length) { p.moveTo(ce.x - H.R * 0.3, ce.y); p.lineTo(ce.x + H.R * 0.3, ce.y); }
      else if (mids.length === 1) { p.moveTo(ce.x, ce.y); p.lineTo(mids[0].x, mids[0].y); }
      else if (mids.length === 2) { p.moveTo(mids[0].x, mids[0].y); p.quadraticCurveTo(ce.x, ce.y, mids[1].x, mids[1].y); }
      else mids.forEach(function (m) { p.moveTo(ce.x, ce.y); p.lineTo(m.x, m.y); });
    });
    return p;
  }

  /* estado de um hexágono: visivel (ao vivo), explorado (último estado conhecido, com idade) ou nunca explorado
     (v 'explorado' com nunca: o chão é público, mas a riqueza e o perigo dele o reino ainda não conhece) */
  var NUNCA = { v: 'explorado', nunca: true, horas: null };
  M.estado = function (h) {
    var d = M.dados;
    if (!d || h < 0 || h >= d.idade.length) return { v: 'desconhecido' };
    var i = d.idade[h];
    if (i < 0) return NUNCA;
    if (i === 0) return { v: 'visivel', horas: 0 };
    return { v: 'explorado', horas: (i + (RP.agora() - d.recebidoEm) / 60000) / 60 };
  };
  M.terreno = function (h) { return M.dados ? M.dados.ter[h] : null; };
  M.rio = function (h) { return !!(M.dados && M.dados.rio[h]); };
  M.rota = function (h) { return !!(M.dados && M.dados.rotaH[h]); };
  M.ponte = function (h) { return !!(M.dados && M.dados.ponteH[h]); };
  M.objetosEm = function (h) { return (M.dados && M.dados.porHex[h]) || []; };
  M.pessoa = function (id) { return M.dados && M.dados.pessoaPorId ? M.dados.pessoaPorId[id] : null; };
  M.local = function (id) { return M.dados ? M.dados.objs.filter(function (o) { return o.tipo === 'local' && o.id === id; })[0] : null; };

  /* posição de uma marcha no instante t (ms do servidor), pelo caminho e pelos tempos de chegada a cada hexágono */
  M.posMarcha = function (o, t) {
    var tp = o.tempos, cm = o.caminho;
    if (!cm || !cm.length) { var c0 = H.centroH(o.hex); return { x: c0.x, y: c0.y, ang: 0, hex: o.hex, i: 0 }; }
    if (!tp || tp.length < 2 || t <= tp[0]) return ponto(cm, 0, 0);
    if (t >= tp[tp.length - 1]) return ponto(cm, cm.length - 1, 0);
    for (var i = 0; i < tp.length - 1; i++) if (t < tp[i + 1]) return ponto(cm, i, (t - tp[i]) / Math.max(1, tp[i + 1] - tp[i]));
    return ponto(cm, cm.length - 1, 0);
  };
  function ponto(cm, i, f) {
    var a = H.centroH(cm[i]), j = Math.min(cm.length - 1, i + 1), b = H.centroH(cm[j]);
    if (j === i && i > 0) { var p = H.centroH(cm[i - 1]); return { x: a.x, y: a.y, ang: Math.atan2(a.y - p.y, a.x - p.x), hex: cm[i], i: i }; }
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, ang: Math.atan2(b.y - a.y, b.x - a.x), hex: f < 0.5 ? cm[i] : cm[j], i: i };
  }
  /* de marcha alheia, o servidor manda só o hexágono atual e o próximo: o fim dos tempos não é chegada nenhuma (o destino é segredo) */
  M.chegada = function (o) { return o.tempos && o.tempos.length ? o.tempos[o.tempos.length - 1] : 0; };
  M.chegadaConhecida = function (o) { return o.dono === 'meu' ? M.chegada(o) : 0; };
  /* marchas são públicas: aparecem sempre, e o feed tira a que acabou */
  M.sumiu = function () { return false; };
  M.marchaVisivel = function () { return true; };

  /* carregamento compartilhado; quem desenha o mundo se declara ativo para receber atualizações ao vivo */
  var pendente = null, ativos = {}, espera = 0;
  M.carregar = function () {
    if (pendente) return pendente;
    pendente = RP.get('/mapa').then(function (d) {
      pendente = null;
      RP.sincronizar(d.agora);
      preparar(d);
      M.dados = d; M.versao++;
      document.dispatchEvent(new CustomEvent('rp:mapa-dados', { detail: d }));
      return d;
    }, function (e) { pendente = null; throw e; });
    return pendente;
  };
  M.garantir = function () { return M.dados ? Promise.resolve(M.dados) : M.carregar(); };

  /* ---------------------------------------------------------------- feed público (sem login; no jogo, para as marchas dos outros)
     Pedidos comuns, sem no-store: o servidor manda os mesmos bytes para todos e o navegador aproveita o cache e o ETag. */
  function feed(parte) {
    return fetch('/api/v1/publico/' + parte, { credentials: 'omit' }).then(function (r) {
      if (!r.ok) throw new Error('feed ' + r.status);
      return r.json();
    });
  }
  M.publico = false;
  M.mundoPublico = null;
  M.ultimoVivo = null;
  var assinaturaMoveis = '';
  M.versaoMoveis = 0;
  /* o mapa como um visitante o vê: ao vivo em toda parte, nada descoberto */
  function composto(c, w, v) {
    var reinos = {};
    w.reinos.forEach(function (r) { reinos[r.id] = r; });
    var objetos = w.locais.concat(w.torres, w.ruinas, w.bandeiras);
    objetos.forEach(function (o) { o.dono = o.reinoId ? 'outro' : 'livre'; });
    w.bandeiras.forEach(function (b) { b.autor = reinos[b.reinoId]; });
    /* local com relíquia: todos veem, sem o tipo */
    w.locais.forEach(function (l) { if (l.reliquias) objetos.push({ tipo: l.reliquias >= w.farolReliquias ? 'farol' : 'brilho', id: l.id, hex: l.hex, n: l.reliquias }); });
    var n = c.cols * c.lins;
    return {
      cols: c.cols, lins: c.lins, terreno: c.terreno, rotas: c.rotas, pontes: c.pontes, agora: v.agora, reinos: reinos, aliados: [],
      idade: new Int32Array(n), objetos: objetos.concat(vivosPara(v, {}, [])), reconhecidos: {}, pessoas: [], pessoasOutras: [],
    };
  }
  function vivosPara(v, meusHex, aliados, meuId) {
    var fora = v.marchas.filter(function (m) { return m.reinoId !== meuId; }).map(function (m) { m.dono = aliados.indexOf(m.reinoId) >= 0 ? 'aliado' : 'outro'; return m; });
    fora.sort(function (a, b) { return a.id - b.id; });
    var bat = v.batalhas.filter(function (b) { return !meusHex[b.hex]; }).map(function (b) { b.listaFrentes = b.frentes; b.frentes = b.frentes.length; b.vivos = []; return b; });
    return fora.concat(bat);
  }
  M.carregarPublico = function () {
    M.publico = true;
    return Promise.all([feed('chao'), feed('mundo'), feed('vivo')]).then(function (x) {
      if (!M.publico) return null;
      RP.sincronizar(x[2].agora);
      var d = composto(x[0], x[1], x[2]);
      preparar(d);
      M.dados = d; M.versao++; M.mundoPublico = x[1]; M.ultimoVivo = x[2];
      document.dispatchEvent(new CustomEvent('rp:mapa-dados', { detail: d }));
      document.dispatchEvent(new CustomEvent('rp:vivo', { detail: x[2] }));
      return d;
    });
  };
  M.sairDoPublico = function () { M.publico = false; M.dados = null; M.mundoPublico = null; M.versao++; };
  /* troca as marchas dos outros e as batalhas alheias pelas do feed, sem refazer o chão */
  M.aplicarVivo = function (v) {
    M.ultimoVivo = v;
    var d = M.dados;
    if (!d) return;
    if (Math.abs(RP.agora() - v.agora) > 6000 * (RP.aceleracao || 1)) RP.sincronizar(v.agora);
    var meuId = RP.reino ? RP.reino.id : null, meusHex = {};
    var fixos = (d.objetos || []).filter(function (o) {
      if (o.tipo === 'marcha') return o.dono === 'meu';
      if (o.tipo === 'batalha') { if (o.id) { meusHex[o.hex] = true; return true; } return false; }
      return true;
    });
    d.objetos = fixos.concat(vivosPara(v, meusHex, d.aliados || [], meuId));
    indexar(d);
    var ass = d.marchas.map(function (m) { return m.id; }).join() + '|' + d.objs.filter(function (o) { return o.tipo === 'batalha'; }).map(function (o) { return o.hex; }).join();
    if (ass !== assinaturaMoveis) { assinaturaMoveis = ass; M.versaoMoveis++; }
    document.dispatchEvent(new CustomEvent('rp:vivo', { detail: v }));
  };
  /* quem está numa tela do mundo vê o feed; sem ninguém olhando, nada é pedido */
  var TIQUE_VIVO_MS = 2500, tiques = 0;
  setInterval(function () {
    if (document.hidden || !Object.keys(ativos).length || !M.dados) return;
    feed('vivo').then(M.aplicarVivo).catch(function () { /* offline: mantém o último */ });
    tiques++;
    if (M.publico) { if (tiques % 8 === 0) M.carregarPublico().catch(function () { /* offline */ }); }
    else if (tiques % 16 === 0) M.carregar().catch(function () { /* offline */ });   /* construções e bandeiras dos outros */
  }, TIQUE_VIVO_MS);
  /* uma linha da crônica: o que aconteceu, quando e quem morreu */
  M.mensagemHTML = function (x) {
    var mortos = (x.mortos || []).map(function (n) { return RP.esc(n); }).join(', ') + (x.maisMortos ? ' e mais ' + x.maisMortos : '');
    return '<li class="cronica-item cronica-' + RP.esc(x.tipo) + '"' + (x.hex != null ? ' data-cronica-hex="' + x.hex + '"' : '') + '><span>' + RP.esc(x.texto) + '</span>' +
      (mortos ? '<small class="cronica-mortos">Mortos: ' + mortos + '</small>' : '') +
      '<small class="fraco">' + RP.fmtHa(Math.max(0, RP.agora() - x.quando) / 3600000) + '</small></li>';
  };
  M.ativar = function (nome) { ativos[nome] = true; };
  M.desativar = function (nome) { delete ativos[nome]; };
  function aoAviso() {
    if (M.publico) return;
    if (!Object.keys(ativos).length) { M.velho = true; return; }
    clearTimeout(espera);
    espera = setTimeout(function () { M.carregar().catch(function () { /* offline: mantém o último */ }); }, 300);
  }
  RP.ouvir('mapa', aoAviso);
  RP.ouvir('marchas', aoAviso);
  /* ao voltar a uma tela do mundo, recarrega se chegou aviso enquanto ninguém olhava */
  M.emDia = function () { if (M.velho || !M.dados) { M.velho = false; return M.carregar(); } return Promise.resolve(M.dados); };

  /* outra conta (ou reino novo) não vê o mapa da anterior */
  document.addEventListener('rp:tela', function (e) {
    if ((e.detail === 'inicio' || e.detail === 'criar') && M.dados && !M.publico) { M.dados = null; M.versao++; }
  });

  RP.mapaModelo = M;
  MAPA.dados = function () { return M.dados; };
})();
