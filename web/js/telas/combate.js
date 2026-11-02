/* Reino de Pedra — Combate: envio de ataque (#/envio), ordem rápida "Atacar"/"Ocupar" no mapa, batalha em andamento
   (#/batalha), relatórios de ataque e defesa, torres e portões (aba Defesas da construção) e torres/batalhas no mapa.
   Porte de prototipo/js/militar.js (envio, batalha) e defesas.js, com os dados do servidor:
   POST /ataques/previa e /ataques, GET /batalhas/{id}, POST /batalhas/{id}/recuar, GET /defesas, torres e portões. */
(function () {
  'use strict';
  var RP = window.RP, H = RP.hex;

  RP.TIPOS_ATAQUE = {
    saque: { nome: 'Saque', icone: 'carroca', txt: 'Leva recursos e relíquias do local, até a carga.' },
    sabotagem: { nome: 'Sabotagem', icone: 'martelo', txt: 'Derruba níveis do local e torres.' },
    massacre: { nome: 'Massacre', icone: 'espada', txt: 'Mata população do local. Não leva nada.' },
    ocupacao: { nome: 'Ocupação', icone: 'bandeira', txt: 'Toma o local. Ele fica seu até alguém retomar.' },
    cerco: { nome: 'Cerco', icone: 'cerco', txt: 'Ataque ao castelo: portões, torres, relíquias e recursos.' }
  };
  var TATICAS = [
    { id: 'conservadora', nome: 'Conservadora', icone: 'escudo' },
    { id: 'media', nome: 'Média', icone: 'tropas' },
    { id: 'agressiva', nome: 'Agressiva', icone: 'alvo' },
    { id: 'semLimite', nome: 'Sem limite', icone: 'estandarte' }
  ];
  var LEVA_CARGA = { saque: true, cerco: true };
  function linha(r, v) { return '<div class="info-linha"><span class="fraco">' + r + '</span><span>' + v + '</span></div>'; }
  function limites() { return (RP.reino && RP.reino.combate && RP.reino.combate.taticas) || {}; }
  RP.textoTatica = function (id, lims) {
    var v = (lims || limites())[id];
    return v == null ? 'Não recuam por baixas: lutam até cumprir ou cair.' : 'Recuam com ' + Math.round(v * 100) + '% de baixas.';
  };
  function objetosHex(h, dados) { return (dados && dados.porHex && dados.porHex[h]) || []; }
  function localAlheio(h, dados) { return objetosHex(h, dados).filter(function (o) { return o.tipo === 'local' && o.dono !== 'meu'; })[0]; }
  function semDono(o) { return o && (o.dono === 'livre' || o.ruina); }
  function grupoParam(g) { return Object.keys(g || {}).filter(function (k) { return g[k] > 0; }).map(function (k) { return k + ':' + g[k]; }).join(','); }
  RP.nomeObjetivo = function (o) { return o.texto || o.k; };

  /* ================================================================ ordem rápida pelo mapa: tropa → destino → Atacar */
  RP.ordensEnvio = RP.ordensEnvio || [];
  RP.ordensEnvio.push({
    ordem: 'atacar', rotulo: 'Atacar', verbo: 'Atacar', icone: 'espada', titulo: 'Atacar',
    quando: function (h, dados) { var l = localAlheio(h, dados); return !!l && !semDono(l); },
    descricao: function (h, dados, est) {
      var torres = ((dados && dados.objetos) || []).filter(function (o) { return o.tipo === 'torre' && o.dono !== 'meu' && H.dist(o.hex, h) <= o.alcance; });
      return linha('Tipo', 'Saque') + linha('Objetivos', 'Relíquia à vista e o recurso principal do local') +
        linha('Tática', 'Média · ' + RP.textoTatica('media').toLowerCase()) + linha('Estandarte', 'Não levado: o alvo não sabe quem foi') +
        (torres.length ? linha('Torres no alcance', String(torres.length)) : '') +
        (est && est.de ? '<div class="info-linha"><span class="fraco">Detalhes</span><a href="#/envio?alvo=' + h + '&de=' + est.de + '&grupo=' + grupoParam(est.grupo) + '">Ajustar tipo, objetivos e tática</a></div>' : '');
    },
    dados: function () { return { tipo: 'saque', tatica: 'media', objetivos: [] }; }
  });
  RP.ordensEnvio.push({
    ordem: 'ocupar', rotulo: 'Ocupar', verbo: 'Ocupar', icone: 'bandeira', titulo: 'Ocupar',
    quando: function (h, dados) { return semDono(localAlheio(h, dados)); },
    descricao: function () { return linha('Objetivo', 'Tomar o local: fica seu, com as tropas como guarnição'); },
    dados: function () { return { tipo: 'ocupacao' }; }
  });
  RP.NOMES_MARCHA = RP.NOMES_MARCHA || {};

  /* folha do hexágono: atacar um local alheio; torres e batalhas */
  var modoTorre = false;
  RP.mapa.acoesFolhaHex.push(function (h, dados) {
    if (modoTorre) return '<button type="button" class="btn btn-p btn-primario" data-torre-aqui="' + h + '">' + RP.icone('torre') + 'Erguer torre aqui</button>';
    if (RP.envio && RP.envio.ativo()) return '';
    var l = localAlheio(h, dados), html = '';
    if (l) html += '<a class="btn btn-p btn-primario" href="#/envio?alvo=' + h + '">' + RP.icone(semDono(l) ? 'bandeira' : 'espada') + (semDono(l) ? 'Ocupar este local' : 'Atacar este local') + '</a>';
    objetosHex(h, dados).filter(function (o) { return o.tipo === 'batalha' && o.id; }).forEach(function (o) {
      html += '<a class="btn btn-p" href="#/batalha?id=' + o.id + '">' + RP.icone('espada') + 'Ver a batalha</a>';
    });
    return html;
  });
  function folhaTorre(o) {
    return linha('Torre de arqueiros', 'nível ' + o.nivel + ' · alcance ' + o.alcance + ' hex.' + (o.arqueiros ? ' · ' + o.arqueiros + ' arqueiros' : '')) +
      (o.dono === 'meu' ? '' : linha('Informação', o.aoVivo ? '<span class="selo selo-visivel">ao vivo</span>' : '<span class="selo selo-antigo">último estado visto</span>'));
  }
  function folhaBatalha(o) {
    return linha('Batalha', (o.papel === 'defesa' ? 'seu local sob ataque' : o.papel === 'ataque' ? 'suas tropas atacam' : 'em andamento') +
      ' · termina em <b class="num" data-fim="' + o.fim + '">' + RP.fmtResta(o.fim - RP.agora()) + '</b>');
  }
  RP.mapa.extrasFolhaHex.push(function (h, dados) {
    if (RP.mapa.desenhaTiposObjeto) return '';
    return objetosHex(h, dados).map(function (o) { return o.tipo === 'torre' ? folhaTorre(o) : o.tipo === 'batalha' ? folhaBatalha(o) : ''; }).join('');
  });

  /* ---------------------------------------------------------------- desenho no mapa tático */
  var cacheBordas = {};
  function bordas(hex, r) {
    var k = hex + ':' + r; if (cacheBordas[k]) return cacheBordas[k];
    var set = {}, out = [];
    for (var l = H.l(hex) - r; l <= H.l(hex) + r; l++) for (var c = H.c(hex) - r - 1; c <= H.c(hex) + r + 1; c++) {
      if (H.dentro(c, l) && H.dist(hex, H.idx(c, l)) <= r) set[H.idx(c, l)] = 1;
    }
    Object.keys(set).forEach(function (s) {
      var ce = H.centroH(+s);
      for (var i = 0; i < 6; i++) {
        var a1 = (Math.PI / 180) * (60 * i - 30), a2 = (Math.PI / 180) * (60 * (i + 1) - 30);
        var a = { x: ce.x + H.R * Math.cos(a1), y: ce.y + H.R * Math.sin(a1) }, b = { x: ce.x + H.R * Math.cos(a2), y: ce.y + H.R * Math.sin(a2) };
        var fora = H.pixelParaHex(a.x + b.x - ce.x, a.y + b.y - ce.y);
        if (fora < 0 || !set[fora]) out.push([a, b]);
      }
    });
    return (cacheBordas[k] = out);
  }
  function cor(nome, padrao) { return (getComputedStyle(document.documentElement).getPropertyValue(nome) || '').trim() || padrao; }
  function desenharTorre(ctx, o, p, cam) {
    var dono = o.dono === 'meu' ? cor('--cor-meu', 'steelblue') : cor('--cor-desconhecido', 'gray');
    if (!cam || cam.z > 0.45) {
      ctx.save(); ctx.setLineDash([5, 5]); ctx.lineWidth = 2; ctx.strokeStyle = dono; ctx.globalAlpha = o.aoVivo === false ? 0.3 : 0.55;
      ctx.beginPath(); bordas(o.hex, o.alcance).forEach(function (s) { ctx.moveTo(s[0].x, s[0].y); ctx.lineTo(s[1].x, s[1].y); }); ctx.stroke(); ctx.restore();
    }
    ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, 7); ctx.fillStyle = cor('--torre-cor', 'silver'); ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = dono; ctx.stroke();
    ctx.fillStyle = cor('--torre-borda', 'black');
    ctx.fillRect(p.x - 4, p.y - 6, 8, 11); ctx.fillRect(p.x - 6, p.y - 8, 3, 3); ctx.fillRect(p.x - 1.5, p.y - 8, 3, 3); ctx.fillRect(p.x + 3, p.y - 8, 3, 3);
  }
  function desenharBatalha(ctx, o, p, cam, agora) {
    var t = ((agora || Date.now()) % 1600) / 1600;
    ctx.save();
    ctx.strokeStyle = cor('--cor-perigo', 'firebrick'); ctx.lineWidth = 3; ctx.globalAlpha = 1 - t * 0.7;
    ctx.beginPath(); ctx.arc(p.x, p.y, 16 + t * 10, 0, 7); ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p.x - 8, p.y - 8); ctx.lineTo(p.x + 8, p.y + 8); ctx.moveTo(p.x + 8, p.y - 8); ctx.lineTo(p.x - 8, p.y + 8); ctx.stroke();
    ctx.restore();
  }
  RP.mapa.tiposObjeto = RP.mapa.tiposObjeto || {};
  /* a torre já tem arte própria no Mapa e na Vista (web/js/vista/tipos.js): aqui só a folha do combate */
  RP.mapa.tiposObjeto.torre = Object.assign({ nome: 'Torre de arqueiros', icone: 'torre' }, RP.mapa.tiposObjeto.torre || {}, { folha: folhaTorre });
  RP.mapa.tiposObjeto.batalha = Object.assign({ nome: 'Batalha', icone: 'espada' }, RP.mapa.tiposObjeto.batalha || {}, {
    desenharTatico: function (ctx, o, info) { desenharBatalha(ctx, o, H.centroH(o.hex), null, (info && info.agora) || RP.agora()); }, folha: folhaBatalha });
  /* o mapa que desenha RP.mapa.tiposObjeto sozinho marca RP.mapa.desenhaTiposObjeto = true; senão desenhamos aqui */
  RP.mapa.desenhosExtras.push(function (ctx, dados, cam, agora) {
    if (RP.mapa.desenhaTiposObjeto) return;
    (dados.objetos || []).forEach(function (o) {
      if (o.tipo === 'torre') desenharTorre(ctx, o, H.centroH(o.hex), cam);
      else if (o.tipo === 'batalha') desenharBatalha(ctx, o, H.centroH(o.hex), cam, agora);
    });
  });

  /* ---------------------------------------------------------------- escolher no mapa o hexágono de uma torre */
  function faixaTorre() {
    var tela = RP.$('[data-tela=mapa]'); if (!tela) return;
    var f = RP.$('.combate-faixa', tela);
    if (!f) { f = document.createElement('div'); f.className = 'combate-faixa card'; tela.appendChild(f); }
    f.hidden = !modoTorre;
    if (modoTorre) f.innerHTML = RP.icone('torre', 'ico-p') + '<span>Toque num hexágono livre, perto de um local seu, para erguer a <b>torre de arqueiros</b>.</span><button type="button" class="btn btn-p" data-torre-cancelar>Cancelar</button>';
  }
  document.addEventListener('rp:tela', function (ev) {
    if (ev.detail !== 'mapa') { modoTorre = false; return; }
    var q = new URLSearchParams((location.hash.split('?')[1]) || '');
    modoTorre = q.get('torre') === '1';
    faixaTorre();
  });
  document.addEventListener('click', function (e) {
    var b;
    if (e.target.closest('[data-torre-cancelar]')) { modoTorre = false; faixaTorre(); return; }
    if ((b = e.target.closest('[data-torre-aqui]'))) {
      RP.tentar(RP.post('/defesas/torres', { hex: +b.getAttribute('data-torre-aqui') })).then(function (it) {
        RP.fecharFolha(); modoTorre = false; faixaTorre();
        RP.aviso({ titulo: 'Na fila: ' + it.rotulo, texto: 'Os carregadores levam o material até lá.', icone: 'torre', tipo: 'sucesso' });
        RP.recarregarReino(); if (RP.mapa.recarregar) RP.mapa.recarregar();
      });
    }
  });

  /* ================================================================ Envio de ataque (#/envio?alvo=<hex>&de=<local>&grupo=k:n) */
  var env = null, previaTimer = null, seqPrevia = 0, modelos = null;
  function disponiveis() {
    var l = RP.tropas && RP.tropas.locais.filter(function (x) { return x.id === env.de; })[0], d = {};
    Object.keys((l && l.guarnicao) || {}).forEach(function (k) { var u = RP.unidade(k); if (!u || u.so !== 'defesa') d[k] = l.guarnicao[k]; });
    return d;
  }
  function origens() {
    return (RP.tropas ? RP.tropas.locais : []).filter(function (l) {
      return Object.keys(l.guarnicao || {}).some(function (k) { var u = RP.unidade(k); return l.guarnicao[k] > 0 && (!u || u.so !== 'defesa'); });
    });
  }
  function grupoPadrao() {
    var d = disponiveis(), g = {};
    Object.keys(d).forEach(function (k) { if (d[k] > 0) g[k] = Math.max(1, Math.floor(d[k] / 2)); });
    return g;
  }
  function corpoPrevia() {
    return { deLocalId: env.de, tropas: env.grupo, destinoHex: env.hex, tipo: env.tipo, objetivos: env.objetivos, tatica: env.tatica,
      completar: env.completar, estandarte: env.estandarte, seguro: env.seguro };
  }
  function pedirPrevia(el) {
    clearTimeout(previaTimer);
    previaTimer = setTimeout(function () {
      var meu = ++seqPrevia;
      RP.post('/ataques/previa', corpoPrevia()).then(function (p) {
        if (meu !== seqPrevia || !env) return;
        env.previa = p; env.erro = null;
        env.tipo = p.plano.tipo; env.tatica = p.plano.tatica; env.completar = p.plano.completar;
        env.objetivos = p.plano.objetivos.map(function (o) { return { k: o.k, r: o.r, q: o.q, texto: o.texto }; });
        if (!p.segura.ok || (p.curta.ok && p.segura.min === p.curta.min && p.segura.hexes === p.curta.hexes)) env.seguro = false;
        desenharEnvio(el);
      }, function (e) {
        if (meu !== seqPrevia || !env) return;
        env.erro = e.message; desenharEnvio(el);
      });
    }, 180);
  }
  function passoObj(o, d) {
    if (o.k === 'recurso') o.q = Math.max(500, Math.round((o.q + d * 500) / 100) * 100);
    else if (o.k === 'populacao') o.q = Math.max(25, o.q + d * 25);
    else if (o.k === 'torre' || o.k === 'portoes' || o.k === 'construcao') o.q = Math.max(1, o.q + Math.sign(d));
  }
  function iconeObj(o) { return { reliquia: 'lendario', recurso: o.r, torre: 'torre', portoes: 'castelo', construcao: 'martelo', populacao: 'populacao', tomar: 'bandeira' }[o.k] || 'alvo'; }
  function chave(o) { return o.k + (o.r ? ':' + o.r : ''); }
  function opcaoCaminho(nome, r) {
    if (!r || !r.ok) return '';
    return '<button type="button" class="rota-opcao ' + nome + '" data-env-caminho="' + nome + '" aria-pressed="' + ((nome === 'segura') === !!env.seguro) + '">' +
      '<i class="rota-cor" aria-hidden="true"></i><span><b>' + (nome === 'curta' ? 'Rota curta' : 'Rota segura') + '</b><small>' + r.hexes + ' hexágonos' +
      (nome === 'segura' ? ' · evita a fauna conhecida' : ' · o caminho mais rápido') + '</small></span>' +
      '<span class="rota-tempo">' + RP.icone('relogio', 'ico-p') + RP.fmtDuracao(r.min * 60) + '</span></button>';
  }
  function htmlObjetivos(p) {
    var lista = env.objetivos || [], cap = p.carga, soma = lista.reduce(function (s, o) { return s + (o.k === 'recurso' ? o.q : 0); }, 0);
    var h = '<div class="secao-titulo">4. Objetivos</div>' +
      '<p class="fraco env-nota">As tropas perseguem os objetivos nesta ordem. Se um não existir no local, passam ao próximo.</p>' +
      '<div class="card pilha obj-lista">' + (lista.length ? lista.map(function (o, i) {
        var fixo = o.k === 'tomar', ajustavel = ['reliquia', 'tomar'].indexOf(o.k) < 0, primeiro = i === 0 || lista[i - 1].k === 'tomar';
        return '<div class="obj-item"><div class="obj-linha"><span class="obj-n" aria-label="Prioridade ' + (i + 1) + '">' + (i + 1) + '</span>' +
          '<span class="ico-placa' + (o.k === 'reliquia' ? ' obj-relq' : '') + '">' + RP.icone(iconeObj(o), o.k === 'recurso' ? 'r-' + o.r : o.k === 'reliquia' ? 'r-lendario' : '') + '</span>' +
          '<span class="obj-txt"><b>' + RP.esc(RP.nomeObjetivo(o)) + '</b><small class="fraco">' + RP.esc(previsaoObj(o)) + '</small></span>' +
          (fixo ? '' : '<button type="button" class="btn btn-icone btn-fantasma" data-obj-subir="' + i + '" aria-label="Subir prioridade"' + (primeiro ? ' disabled' : '') + '>' + RP.icone('subir') + '</button>' +
            '<button type="button" class="btn btn-icone btn-fantasma" data-obj-tirar="' + i + '" aria-label="Remover objetivo">' + RP.icone('fechar') + '</button>') + '</div>' +
          (ajustavel ? '<div class="obj-qtd"><div class="stepper"><button type="button" class="btn btn-icone" data-obj-passo="' + i + '" data-d="-1" aria-label="Menos">' + RP.icone('menos') + '</button>' +
            '<output class="num">' + (o.k === 'recurso' ? RP.numCurto(o.q) : o.k === 'populacao' ? RP.num(o.q) : '−' + o.q) + '</output>' +
            '<button type="button" class="btn btn-icone" data-obj-passo="' + i + '" data-d="1" aria-label="Mais">' + RP.icone('mais') + '</button></div>' +
            (o.k === 'recurso' ? '<button type="button" class="btn btn-p" data-obj-passo="' + i + '" data-d="10">+5k</button>' : '') + '</div>' : '') + '</div>';
      }).join('') : '<p class="fraco">Sem objetivos: as tropas usam os automáticos.</p>') +
      (p.catalogo.length ? '<div class="obj-add"><span class="fraco">Adicionar</span><div class="obj-add-lista">' + p.catalogo.map(function (c) {
        return '<button type="button" class="btn btn-p" data-obj-add="' + RP.esc(chave(c)) + '">' + RP.icone(iconeObj(c), c.k === 'recurso' ? 'ico-p r-' + c.r : 'ico-p') + RP.esc(rotuloAdd(c)) + '</button>';
      }).join('') + '</div></div>' : '') +
      (LEVA_CARGA[env.tipo] && soma ? '<div class="obj-carga"><div class="linha-entre"><span class="fraco">Carga dos objetivos</span><b class="num' + (soma > cap ? ' txt-perigo' : '') + '">' + RP.num(soma) + ' de ' + RP.num(cap) + '</b></div>' +
        '<div class="barra' + (soma > cap ? ' barra-perigo' : '') + '" role="progressbar" aria-label="Carga dos objetivos em relação à capacidade das tropas"><i style="width:' + Math.min(100, cap ? (100 * soma) / cap : 100).toFixed(1) + '%"></i></div></div>' : '') +
      '</div>';
    var lims = p.taticas || limites();
    h += '<div class="secao-titulo">5. Tática</div><div class="escolhas escolhas-lista" role="radiogroup" aria-label="Tática">' + TATICAS.map(function (t) {
      return '<button type="button" class="escolha escolha-linha" role="radio" data-env-tatica="' + t.id + '" aria-checked="' + (env.tatica === t.id) + '"><span class="ico-placa">' + RP.icone(t.icone) + '</span>' +
        '<span class="escolha-txt"><b>' + t.nome + '</b><small class="fraco">' + RP.esc(RP.textoTatica(t.id, lims)) + '</small></span></button>';
    }).join('') + '</div>' +
      (LEVA_CARGA[env.tipo] ? '<button type="button" class="alternar env-alternar" data-env-completar aria-pressed="' + !!env.completar + '">' + RP.icone('ouro') + '<span>Depois dos objetivos, completar a carga<br><small class="fraco">com o que houver no local</small></span><i aria-hidden="true"></i></button>' : '') +
      '<div class="card quando-voltam"><span class="rotulo">Quando param</span><ul class="regras-lista">' + p.quandoParam.map(function (q, i, arr) {
        return '<li>' + RP.icone(i === 0 ? 'check' : i === arr.length - 1 ? 'escudo' : 'ouro', 'ico-p') + '<span>' + RP.esc(q) + '</span></li>';
      }).join('') + '</ul>' +
      (lista.some(function (o) { return o.k === 'reliquia'; }) && env.tipo !== 'ocupacao' ? '<p class="nota-antiga">' + RP.icone('lendario', 'ico-p') + '<span>A relíquia não volta sozinha: vem com as tropas e pode ser interceptada no caminho de volta.</span></p>' : '') + '</div>';
    return h;
  }
  function rotuloAdd(o) {
    return { reliquia: 'Relíquia', torre: 'Torre', portoes: 'Portões', construcao: 'Construção', populacao: 'População', tomar: 'Tomar' }[o.k] ||
      (RP.NOMES_REC[o.r] || o.r);
  }
  function previsaoObj(o) {
    if (o.k === 'tomar') return 'O local passa a ser seu até alguém retomar.';
    if (o.k === 'reliquia') return env.tipo === 'ocupacao' ? 'Fica no local tomado.' : 'Volta com as tropas; não ocupa carga.';
    if (o.k === 'torre') { var n = env.previa ? env.previa.alvo.torres.length : 0; return n ? n + (n > 1 ? ' torres conhecidas' : ' torre conhecida') + ' no alcance. Aríetes derrubam.' : 'Nenhuma torre conhecida no alcance.'; }
    if (o.k === 'portoes') return 'Aríetes e trebuchets derrubam portões.';
    if (o.k === 'populacao') return 'A população reage como milícia.';
    if (o.k === 'construcao') return 'O local perde níveis; no nível 1, é destruído.';
    if (o.k === 'recurso') return 'Até a carga e o que houver no local.';
    return '';
  }
  /* ---------------------------------------------------------------- modelos de ataque e "repetir último" (GET/POST /ataques/modelos) */
  function carregarModelos(el) {
    return RP.get('/ataques/modelos').then(function (m) { modelos = m; if (el && env) desenharEnvio(el); return m; }, function () { return null; });
  }
  function htmlModelos() {
    if (!modelos) return '';
    var u = modelos.ultimo;
    return '<div class="modelos"><span class="rotulo">Modelos</span><div class="obj-add-lista">' +
      (u ? '<button type="button" class="btn btn-p chip-sel" data-env-ultimo aria-pressed="' + (env.modelo === 'ultimo') + '">' + RP.icone('voltar', 'ico-p') + 'Repetir último</button>' : '') +
      modelos.modelos.map(function (md) {
        return '<span class="chip-modelo"><button type="button" class="btn btn-p chip-sel" data-env-modelo="' + md.id + '" aria-pressed="' + (env.modelo === md.id) + '">' + RP.esc(md.nome) + '</button>' +
          '<button type="button" class="btn btn-icone btn-fantasma btn-mini" data-env-modelo-apagar="' + md.id + '" aria-label="Apagar o modelo ' + RP.esc(md.nome) + '">' + RP.icone('fechar') + '</button></span>';
      }).join('') +
      (modelos.modelos.length < modelos.max ? '<button type="button" class="btn btn-p btn-fantasma" data-env-salvar-modelo>' + RP.icone('mais', 'ico-p') + 'Salvar atual</button>' : '') + '</div>' +
      '<p class="fraco env-nota">Um toque preenche tipo, tropas, objetivos e tática. Confira e envie.</p></div>';
  }
  function aplicarModelo(md, id) {
    var tipos = (env.previa && env.previa.tipos) || [];
    env.tipo = !tipos.length || tipos.indexOf(md.tipo) >= 0 ? md.tipo : null;
    env.tatica = md.tatica; env.estandarte = !!md.estandarte; env.completar = !!md.completar;
    if (md.deLocalId && origens().some(function (x) { return x.id === md.deLocalId; })) env.de = md.deLocalId;
    var d = disponiveis(), g = {};
    Object.keys(md.tropas || {}).forEach(function (k) { var n = Math.min(md.tropas[k], d[k] || 0); if (n > 0) g[k] = n; });
    if (RP.somaGrupo(g)) env.grupo = g;
    env.objetivos = env.tipo ? (md.objetivos || []).map(function (o) { return { k: o.k, r: o.r, q: o.q || 0 }; }) : [];
    env.modelo = id;
  }
  function salvarModelo(el) {
    RP.modal({
      titulo: 'Salvar modelo',
      corpo: '<p class="suave">Guarda tipo, tropas, objetivos e tática, sem o alvo. O recurso principal do alvo vale para qualquer local.</p>' +
        '<div class="campo"><label for="env-modelo-nome">Nome</label><input id="env-modelo-nome" maxlength="' + ((modelos && modelos.nomeMax) || 30) + '" value="' + RP.esc((RP.TIPOS_ATAQUE[env.tipo] || {}).nome || 'Ataque') + ' ' + RP.somaGrupo(env.grupo) + '"></div>',
      acoes: [{ rotulo: RP.icone('check') + 'Salvar', classe: 'btn-primario', acao: function () {
        var inp = document.getElementById('env-modelo-nome'), alvoProd = env.previa && env.previa.alvo && env.previa.alvo.produz;
        RP.tentar(RP.post('/ataques/modelos', { nome: inp ? inp.value : '', tipo: env.tipo, tatica: env.tatica, estandarte: env.estandarte, completar: env.completar, tropas: env.grupo,
          objetivos: (env.objetivos || []).map(function (o) { return { k: o.k, r: o.k === 'recurso' && alvoProd && o.r === alvoProd ? 'auto' : o.r, q: o.q }; }) })).then(function (md) {
          RP.aviso({ titulo: 'Modelo salvo', texto: md.nome + ': aparece no topo do envio.', icone: 'check', tipo: 'sucesso' });
          carregarModelos(el);
        });
      } }, { rotulo: 'Voltar' }]
    });
  }

  function desenharEnvio(el) {
    var cont = RP.$('.env-conteudo', el); if (!cont || !env) return;
    var p = env.previa;
    if (!p) { cont.innerHTML = env.erro ? '<p class="txt-alerta">' + RP.esc(env.erro) + '</p>' : '<p class="fraco">Carregando…</p>'; rodape(el); return; }
    var a = p.alvo, tipos = p.tipos, n = RP.somaGrupo(env.grupo), ors = origens();
    var h = (env.erro ? '<p class="nota-antiga nota-perigo">' + RP.icone('alerta', 'ico-p') + '<span>' + RP.esc(env.erro) + '</span></p>' : '') +
      (p.bloqueio ? '<div class="faixa-alerta">' + RP.icone('pacto') + '<span class="txt"><b>Não dá para enviar</b><br>' + RP.esc(p.bloqueio) + '</span></div>' : '') +
      htmlModelos() +
      '<div class="secao-titulo"' + (modelos ? '' : ' style="margin-top:0"') + '>1. Alvo</div><div class="card pilha"><div class="linha">' +
      '<span class="ico-placa dono-desconhecido">' + RP.icone(RP.iconeLocal({ tipo: a.local }) || 'castelo') + '</span>' +
      '<span style="flex:1;min-width:0"><b>' + RP.esc(a.nome) + '</b><br><small class="fraco">' + (a.dono === 'livre' ? 'Sem dono' : 'Dono desconhecido') + ' · hexágono ' + a.c + ', ' + a.l + '</small></span>' +
      '<a class="btn btn-p btn-fantasma" href="#/mapa?foco=' + a.hex + '">' + RP.icone('mapa') + 'Mapa</a></div>' +
      '<div class="info">' + linha('Dono', a.dono === 'livre' ? 'nenhum' : 'desconhecido') +
      (a.torres.length ? linha('Torres no alcance', a.torres.length + ' · ' + a.torres.map(function (t) { return 'nível ' + t.nivel; }).join(', ')) : '') + '</div>' +
      (a.torres.length ? '<p class="nota-antiga">' + RP.icone('torre', 'ico-p') + '<span>Arqueiros nas torres atiram do alto, protegidos. Aríetes derrubam torres; derrubar a torre é objetivo de sabotagem e de cerco.</span></p>' : '') + '</div>';
    h += '<div class="secao-titulo">2. Tipo de ataque</div><div class="escolhas">' + Object.keys(RP.TIPOS_ATAQUE).map(function (id) {
      var t = RP.TIPOS_ATAQUE[id], ok = tipos.indexOf(id) >= 0;
      return '<button type="button" class="escolha' + (ok ? '' : ' bloqueado') + '" data-env-tipo="' + id + '" aria-pressed="' + (env.tipo === id) + '"' + (ok ? '' : ' aria-disabled="true"') + '>' +
        '<span class="linha"><span class="ico-placa">' + RP.icone(t.icone) + '</span><b>' + t.nome + '</b></span><small class="fraco">' + t.txt + '</small>' +
        (ok ? '' : '<span class="selo selo-desconhecido">' + RP.icone('cadeado') + (id === 'cerco' ? 'Só castelos' : a.dono === 'livre' ? 'Local sem dono' : id === 'ocupacao' ? 'Castelo: use o cerco' : 'Não serve') + '</span>') + '</button>';
    }).join('') + '</div>';
    (p.avisos || []).filter(function (x) { return x.tipo === 'alerta'; }).forEach(function (x) {
      h += '<p class="nota-antiga" style="margin-top:var(--esp-3)">' + RP.icone('alerta', 'ico-p') + '<span>' + RP.esc(x.texto) + '</span></p>';
    });
    h += '<div class="secao-titulo">3. Tropas</div>' +
      (ors.length > 1 ? '<div class="abas abas-rolagem envio-origens" role="group" aria-label="De onde saem">' + ors.map(function (x) {
        return '<button type="button" class="aba" data-env-de="' + x.id + '" aria-pressed="' + (x.id === env.de) + '">' + RP.esc(x.nome) + '</button>';
      }).join('') + '</div>' : '') +
      '<div class="card pilha" data-env-grupo>' + (ors.length ? RP.grupoTropas.linhas(env.grupo, disponiveis()) : '<p class="fraco">Nenhuma tropa que ataca. Milícia só defende.</p>') +
      '<div class="ext-numeros"><div><span class="fraco">Tropas</span><b class="num">' + n + '</b></div><div><span class="fraco">Carga</span><b class="num">' + RP.num(p.carga) + '</b></div>' +
      '<div><span class="fraco">Velocidade</span><b>' + RP.esc(RP.VELOCIDADES[p.vel] || p.vel) + '</b></div></div>' +
      (env.tipo === 'cerco' && !(env.grupo.ariete || env.grupo.trebuchet) ? '<p class="nota-antiga">' + RP.icone('cerco', 'ico-p') + '<span>Sem aríetes, portões e torres não sofrem dano.</span></p>' : '') + '</div>';
    h += htmlObjetivos(p);
    h += '<div class="secao-titulo">6. Estandarte</div>' +
      '<button type="button" class="alternar env-alternar" data-env-estandarte aria-pressed="' + !!env.estandarte + '">' + RP.icone('estandarte') + '<span>Levar o estandarte de ' + RP.esc(RP.reino.nome) + '</span><i aria-hidden="true"></i></button>' +
      '<div class="card previa-relatorio"><span class="rotulo">O defensor verá no relatório</span><div class="linha" style="margin-top:6px">' +
      (env.estandarte ? RP.iconeReino(RP.reino, 28) + '<span><b>' + RP.esc(p.defensorVera.nome) + '</b><br><small class="fraco">identificado pelo estandarte</small></span>'
        : RP.brasao(null, { tamanho: 28, desconhecido: true }) + '<span><b>Forças desconhecidas</b><br><small class="fraco">tropas, tipo e direção de origem</small></span>') + '</div></div>';
    var mesma = p.segura.ok && p.curta.ok && p.segura.hexes === p.curta.hexes && p.segura.min === p.curta.min;
    h += '<div class="secao-titulo">7. Caminho</div>' + (p.curta.ok ? '<div class="pilha">' + opcaoCaminho('curta', p.curta) + (mesma ? '' : opcaoCaminho('segura', p.segura)) + '</div>' +
      '<p class="fraco env-nota">A viagem segue a unidade mais lenta (' + RP.esc(RP.VELOCIDADES[p.vel] || p.vel) + '). O atacante chega só com as tropas enviadas.' + (mesma ? ' A rota curta já é a mais segura que se conhece.' : '') + '</p>'
      : '<p class="fraco">' + (n ? 'Não há caminho até o alvo.' : 'Escolha as tropas para ver o caminho.') + '</p>');
    (p.avisos || []).filter(function (x) { return x.tipo === 'info'; }).forEach(function (x) { h += '<p class="fraco env-nota">' + RP.icone('info', 'ico-p') + ' ' + RP.esc(x.texto) + '</p>'; });
    h += '<div style="height:var(--esp-8)"></div>';
    cont.innerHTML = h;
    rodape(el);
  }
  function rotaEscolhida() { var p = env.previa; return p ? (env.seguro && p.segura.ok ? p.segura : p.curta) : null; }
  function rodape(el) {
    var p = env && env.previa, r = rotaEscolhida(), n = env ? RP.somaGrupo(env.grupo) : 0, ok = p && n && r && r.ok && !p.bloqueio;
    var t = env && RP.TIPOS_ATAQUE[env.tipo];
    RP.$('.rodape-resumo', el).innerHTML = !p ? '' : !n ? '<div class="resumo-linha fraco">Escolha as tropas.</div>'
      : '<div class="resumo-linha"><b>' + RP.esc((t ? t.nome : '') + ' · ' + p.alvo.nome) + '</b>' + (r && r.ok ? '<span class="tempo">' + RP.icone('relogio', 'ico-p') + 'chega em ' + RP.fmtDuracao(r.min * 60) + '</span>' : '') + '</div>' +
        '<div class="resumo-linha fraco">' + RP.esc(RP.partesGrupo(env.grupo)) + ' · ' + RP.esc((env.objetivos || []).map(RP.nomeObjetivo).join(', ')) + ' · tática ' + RP.esc((TATICAS.filter(function (x) { return x.id === env.tatica; })[0] || {}).nome || '').toLowerCase() + '</div>';
    var b = RP.$('[data-env-enviar]', el);
    b.innerHTML = RP.icone(env && env.tipo === 'ocupacao' ? 'bandeira' : 'espada') + (env && env.tipo === 'ocupacao' ? 'Enviar para ocupar' : 'Enviar ataque');
    b.classList.toggle('btn-inativo', !ok);
  }
  function confirmarEnvio(el) {
    var p = env.previa, r = rotaEscolhida(), t = RP.TIPOS_ATAQUE[env.tipo];
    if (p.bloqueio) { RP.aviso({ titulo: 'Não dá para enviar', texto: p.bloqueio, icone: 'alerta', tipo: 'alerta' }); return; }
    if (!RP.somaGrupo(env.grupo)) { RP.aviso({ titulo: 'Escolha as tropas', texto: 'Use + e − em cada unidade.', icone: 'info', tipo: 'alerta' }); return; }
    if (!r || !r.ok) { RP.aviso({ titulo: 'Sem caminho até o alvo', icone: 'alerta', tipo: 'alerta' }); return; }
    var enviar = function () {
      RP.tentar(RP.post('/ataques', corpoPrevia())).then(function (ex) {
        var hex = env.hex;
        RP.aviso({ titulo: env.tipo === 'ocupacao' ? 'Tropas a caminho para ocupar' : 'Ataque a caminho', texto: 'Chegam ' + RP.fmtHora(ex.chegada) + '.', icone: 'espada', tipo: 'sucesso' });
        RP.recarregarReino(); RP.carregarTropas().catch(function () { /* offline */ });
        env = null;
        RP.ir('mapa?foco=' + hex);
      });
    };
    RP.modal({
      titulo: 'Confirmar ' + t.nome.toLowerCase(),
      corpo: '<p class="suave">' + RP.esc(p.alvo.nome) + ' · ' + (p.alvo.dono === 'livre' ? 'sem dono' : 'dono desconhecido') + '<br>' + RP.esc(RP.partesGrupo(env.grupo)) + ' · chegada em ' + RP.fmtDuracao(r.min * 60) + '</p>' +
        '<ol class="obj-confirma">' + env.objetivos.map(function (o) { return '<li>' + RP.icone(iconeObj(o), 'ico-p' + (o.k === 'recurso' ? ' r-' + o.r : o.k === 'reliquia' ? ' r-lendario' : '')) + RP.esc(RP.nomeObjetivo(o)) + '</li>'; }).join('') + '</ol>' +
        '<p class="suave" style="font-size:var(--fs-2)"><b>Quando param:</b> ' + RP.esc(p.quandoParam.join(' ')) + '</p>' +
        '<p class="selo ' + (env.estandarte ? 'selo-info' : 'selo-desconhecido') + '" style="margin-top:var(--esp-3)">' + RP.icone('estandarte') + (env.estandarte ? 'Com estandarte: o defensor saberá que foi você' : 'Sem estandarte: você não será identificado') + '</p>',
      acoes: [{ rotulo: RP.icone('espada') + (env.tipo === 'ocupacao' ? 'Enviar' : 'Enviar ataque'), classe: 'btn-primario', acao: enviar }, { rotulo: 'Voltar' }]
    });
  }
  RP.registrarTela('envio', {
    secao: 'tropas',
    montar: function (el) {
      el.innerHTML = RP.topoVoltar('Envio de ataque', 'mapa', 'Tipo, tropas, objetivos, tática e caminho') + '<div class="conteudo-tela env-conteudo"></div>' +
        '<div class="rodape-acao rodape-com-resumo"><div class="rodape-resumo"></div><button type="button" class="btn btn-primario btn-bloco btn-grande" data-env-enviar></button></div>';
      el.addEventListener('click', function (e) {
        if (!env) return;
        var b, lista = env.objetivos || [];
        if ((b = e.target.closest('[data-env-tipo]'))) {
          if (b.getAttribute('aria-disabled') === 'true') { RP.aviso({ titulo: b.querySelector('.selo') ? b.querySelector('.selo').textContent : 'Não serve', texto: 'Este tipo de ataque não serve para este alvo.', icone: 'cadeado', tipo: 'alerta' }); return; }
          if (env.tipo !== b.getAttribute('data-env-tipo')) { env.tipo = b.getAttribute('data-env-tipo'); env.objetivos = []; env.completar = false; pedirPrevia(el); }
          return;
        }
        if ((b = e.target.closest('[data-env-de]'))) { env.de = +b.getAttribute('data-env-de'); env.grupo = grupoPadrao(); pedirPrevia(el); return; }
        if (e.target.closest('[data-env-grupo]') && RP.grupoTropas.clique(e, env.grupo, disponiveis())) { pedirPrevia(el); desenharEnvio(el); return; }
        if ((b = e.target.closest('[data-obj-subir]'))) { var i = +b.getAttribute('data-obj-subir'); if (i > 0 && lista[i - 1].k !== 'tomar') { var x = lista[i - 1]; lista[i - 1] = lista[i]; lista[i] = x; } pedirPrevia(el); desenharEnvio(el); return; }
        if ((b = e.target.closest('[data-obj-tirar]'))) { lista.splice(+b.getAttribute('data-obj-tirar'), 1); if (!lista.length) lista.push({ k: 'reliquia', texto: 'Relíquia' }); pedirPrevia(el); desenharEnvio(el); return; }
        if ((b = e.target.closest('[data-obj-passo]'))) { passoObj(lista[+b.getAttribute('data-obj-passo')], +b.getAttribute('data-d')); pedirPrevia(el); desenharEnvio(el); return; }
        if ((b = e.target.closest('[data-obj-add]'))) {
          var c = env.previa.catalogo.filter(function (q) { return chave(q) === b.getAttribute('data-obj-add'); })[0];
          if (c) { var novo = { k: c.k, r: c.r, q: c.q, texto: c.texto }; if (c.k === 'reliquia') lista.splice(lista.length && lista[0].k === 'tomar' ? 1 : 0, 0, novo); else lista.push(novo); }
          pedirPrevia(el); desenharEnvio(el); return;
        }
        if ((b = e.target.closest('[data-env-tatica]'))) { env.tatica = b.getAttribute('data-env-tatica'); env.modelo = null; pedirPrevia(el); return; }
        if (e.target.closest('[data-env-completar]')) { env.completar = !env.completar; pedirPrevia(el); return; }
        if (e.target.closest('[data-env-estandarte]')) { env.estandarte = !env.estandarte; pedirPrevia(el); return; }
        if ((b = e.target.closest('[data-env-caminho]'))) { env.seguro = b.getAttribute('data-env-caminho') === 'segura'; desenharEnvio(el); return; }
        if (e.target.closest('[data-env-enviar]')) { if (env.previa) confirmarEnvio(el); return; }
        if (e.target.closest('[data-env-ultimo]') && modelos && modelos.ultimo) {
          aplicarModelo(modelos.ultimo, 'ultimo'); RP.aviso({ titulo: 'Último ataque', texto: 'Tropas, objetivos e tática preenchidos.', icone: 'voltar', tipo: 'sucesso', ms: 1800 }); pedirPrevia(el); desenharEnvio(el); return;
        }
        if ((b = e.target.closest('[data-env-modelo]')) && modelos) {
          var md = modelos.modelos.filter(function (q) { return q.id === +b.getAttribute('data-env-modelo'); })[0];
          if (md) { aplicarModelo(md, md.id); RP.aviso({ titulo: 'Modelo: ' + md.nome, texto: 'Tipo, tropas, objetivos e tática preenchidos.', icone: 'check', tipo: 'sucesso', ms: 1800 }); pedirPrevia(el); desenharEnvio(el); }
          return;
        }
        if ((b = e.target.closest('[data-env-modelo-apagar]'))) {
          RP.tentar(RP.del('/ataques/modelos/' + b.getAttribute('data-env-modelo-apagar'))).then(function () { carregarModelos(el); });
          return;
        }
        if (e.target.closest('[data-env-salvar-modelo]')) salvarModelo(el);
      });
      document.addEventListener('rp:tropas', function () { if (!el.hidden && env) desenharEnvio(el); });
    },
    entrar: function (el, q) {
      var hex = +q.get('alvo');
      env = { hex: hex, de: q.get('de') ? +q.get('de') : null, grupo: {}, tipo: null, objetivos: [], tatica: null, completar: false, estandarte: false, seguro: false, previa: null, modelo: null };
      desenharEnvio(el);
      var repetir = q.get('repetir') === '1';
      Promise.all([RP.carregarTropas(), carregarModelos()]).then(function () {
        if (!env) return;
        var ors = origens();
        if (!env.de || !ors.some(function (x) { return x.id === env.de; })) env.de = (ors.filter(function (x) { return x.tipo === 'castelo'; })[0] || ors[0] || {}).id || RP.reino.casteloId;
        if (q.get('grupo')) {
          var d = disponiveis();
          q.get('grupo').split(',').forEach(function (p) { var kv = p.split(':'); if (d[kv[0]]) env.grupo[kv[0]] = Math.min(+kv[1] || 0, d[kv[0]]); });
        } else env.grupo = grupoPadrao();
        if (repetir && modelos && modelos.ultimo) aplicarModelo(modelos.ultimo, 'ultimo');
        pedirPrevia(el);
      }, function (e) { env.erro = e.message; desenharEnvio(el); });
    },
    sair: function () { clearTimeout(previaTimer); }
  });

  /* ================================================================ gráfico de força dos lados (design system: .grafico-linha) */
  /* serie: [{ t (ms desde o início), meu, eles, proj }]; duracao em ms; agora (ms desde o início) */
  RP.graficoBatalha = function (serie, duracao, agora, rotulos) {
    rotulos = rotulos || { meu: 'Seu lado', eles: 'Eles' };
    var Wd = 340, Hd = 170, ml = 34, mr = 12, mt = 10, mb = 24, pw = Wd - ml - mr, ph = Hd - mt - mb;
    duracao = Math.max(1, duracao);
    var maxY = Math.max(1, Math.max.apply(null, serie.map(function (p) { return Math.max(p.meu, p.eles); }))) * 1.1;
    var X = function (t) { return ml + Math.max(0, Math.min(1, t / duracao)) * pw; }, Y = function (v) { return mt + ph - (v / maxY) * ph; };
    function caminho(lado, proj) {
      var pts = serie.filter(function (p) { return proj ? p.proj || p.t === agora : !p.proj; });
      if (proj && pts.length) { var ult = serie.filter(function (p) { return !p.proj; }).pop(); if (ult) pts.unshift(ult); }
      return pts.map(function (p, i) { return (i ? 'L' : 'M') + X(p.t).toFixed(1) + ' ' + Y(p[lado]).toFixed(1); }).join('');
    }
    var passoY = Math.pow(10, Math.floor(Math.log(maxY / 2) / Math.LN10)), h = '';
    var linhasY = [0, 1, 2].map(function (i) { return Math.round((i * maxY) / 2 / passoY) * passoY; });
    linhasY.forEach(function (v) { h += '<line class="gl-grade" x1="' + ml + '" x2="' + (ml + pw) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/><text class="gl-eixo" x="' + (ml - 6) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + RP.numCurto(v) + '</text>'; });
    var minutos = duracao / 60000, passoM = minutos > 12 ? 5 : minutos > 5 ? 2 : 1;
    for (var mm = 0; mm <= minutos + 0.01; mm += passoM) h += '<text class="gl-eixo" x="' + X(mm * 60000) + '" y="' + (Hd - 6) + '" text-anchor="middle">' + mm + ' min</text>';
    h += '<path class="gl-linha gl-a gl-proj" d="' + caminho('eles', true) + '"/><path class="gl-linha gl-d gl-proj" d="' + caminho('meu', true) + '"/>';
    h += '<path class="gl-linha gl-a" d="' + caminho('eles', false) + '"/><path class="gl-linha gl-d" d="' + caminho('meu', false) + '"/>';
    var atual = serie.filter(function (p) { return !p.proj; }).pop() || serie[0];
    if (atual) {
      var xa = X(atual.t);
      h += '<line class="gl-agora" x1="' + xa + '" x2="' + xa + '" y1="' + mt + '" y2="' + (mt + ph) + '"/>';
      h += '<circle class="gl-ponto gl-a" cx="' + xa + '" cy="' + Y(atual.eles) + '" r="4.5"/><circle class="gl-ponto gl-d" cx="' + xa + '" cy="' + Y(atual.meu) + '" r="4.5"/>';
      var ya = Y(atual.eles), yd = Y(atual.meu);
      if (Math.abs(ya - yd) < 14) { if (ya < yd) { ya -= 7; yd += 7; } else { ya += 7; yd -= 7; } }
      var lx = xa + 8, anc = 'start'; if (lx > ml + pw - 60) { lx = xa - 8; anc = 'end'; }
      h += '<text class="gl-rot" text-anchor="' + anc + '" x="' + lx + '" y="' + (yd + 4) + '">' + RP.esc(rotulos.meuCurto || 'Você') + ' ' + RP.num(atual.meu) + '</text>' +
        '<text class="gl-rot" text-anchor="' + anc + '" x="' + lx + '" y="' + (ya + 4) + '">' + RP.esc(rotulos.elesCurto || 'Eles') + ' ' + RP.num(atual.eles) + '</text>';
    }
    h += '<line class="gl-cruz" x1="0" x2="0" y1="' + mt + '" y2="' + (mt + ph) + '" hidden/><rect class="gl-alvo" x="' + ml + '" y="' + mt + '" width="' + pw + '" height="' + ph + '"/>';
    return '<div class="grafico-linha" data-grafico-bat><svg viewBox="0 0 ' + Wd + ' ' + Hd + '" role="img" aria-label="Força dos dois lados ao longo da batalha' +
      (atual ? '. Agora: ' + RP.esc(rotulos.meu) + ' ' + RP.num(atual.meu) + ', ' + RP.esc(rotulos.eles) + ' ' + RP.num(atual.eles) : '') + '." data-ml="' + ml + '" data-pw="' + pw + '" data-dur="' + duracao + '">' + h + '</svg><div class="gl-dica" hidden></div></div>' +
      '<div class="legenda-grafico"><span><i class="lg-d"></i>' + RP.esc(rotulos.meu) + '</span><span><i class="lg-a"></i>' + RP.esc(rotulos.eles) + '</span><span><i class="lg-proj"></i>Tendência</span></div>';
  };
  /* cruz + dica ao tocar/passar no gráfico */
  RP.ligarGraficoBatalha = function (el, serie, rotulos) {
    var box = RP.$('[data-grafico-bat]', el); if (!box) return;
    var svg = RP.$('svg', box), dica = RP.$('.gl-dica', box), cruz = RP.$('.gl-cruz', svg);
    var ml = +svg.getAttribute('data-ml'), pw = +svg.getAttribute('data-pw'), dur = +svg.getAttribute('data-dur');
    function mostrar(ev) {
      var r = svg.getBoundingClientRect(), esc = 340 / r.width, x = (ev.clientX - r.left) * esc;
      var t = Math.max(0, Math.min(1, (x - ml) / pw)) * dur;
      var p = serie.reduce(function (a, b) { return Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a; }, serie[0]);
      if (!p) return;
      var xx = ml + (p.t / dur) * pw;
      cruz.setAttribute('x1', xx); cruz.setAttribute('x2', xx); cruz.removeAttribute('hidden');
      dica.hidden = false; dica.textContent = '';
      var t1 = document.createElement('div'); t1.className = 'gl-dica-t';
      var s = Math.round(p.t / 1000); t1.textContent = (p.proj ? 'Tendência · ' : '') + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
      dica.appendChild(t1);
      [['d', rotulos.meu, p.meu], ['a', rotulos.eles, p.eles]].forEach(function (q) {
        var row = document.createElement('div'); row.className = 'gl-dica-l';
        var k = document.createElement('i'); k.className = 'lg-' + q[0]; row.appendChild(k);
        var v = document.createElement('b'); v.textContent = RP.num(q[2]); row.appendChild(v);
        var nm = document.createElement('span'); nm.textContent = q[1]; row.appendChild(nm);
        dica.appendChild(row);
      });
      dica.style.left = Math.min(r.width - 150, Math.max(0, xx / esc - 75)) + 'px';
    }
    svg.addEventListener('pointermove', mostrar);
    svg.addEventListener('pointerdown', mostrar);
    svg.addEventListener('pointerleave', function () { cruz.setAttribute('hidden', ''); dica.hidden = true; });
  };
  function tabelaSerie(serie, rotulos) {
    var vistos = {}, linhas = serie.filter(function (p) { var k = Math.round(p.t / 60000); if (p.proj || vistos[k]) return false; vistos[k] = 1; return true; }).map(function (p) {
      return '<tr><td>' + Math.round(p.t / 60000) + ' min</td><td class="num">' + RP.num(p.meu) + '</td><td class="num">' + RP.num(p.eles) + '</td></tr>';
    }).join('');
    return '<details class="ver-tabela"><summary>Ver como tabela</summary><table class="tabela"><thead><tr><th>Tempo</th><th>' + RP.esc(rotulos.meu) + '</th><th>' + RP.esc(rotulos.eles) + '</th></tr></thead><tbody>' + linhas + '</tbody></table></details>';
  }

  /* ================================================================ Batalha em andamento (#/batalha?id=) */
  var bat = null, batTimer = null;
  function carregarBatalha(el, id) {
    return RP.get('/batalhas/' + id).then(function (b) { bat = b; RP.sincronizar(b.agora); desenharBatalhaTela(el); return b; },
      function (e) { RP.$('.bat-conteudo', el).innerHTML = '<p class="fraco">' + RP.esc(e.message) + '</p>'; });
  }
  function rotulosBat(b) { return { meu: b.papel === 'defesa' ? 'Seu lado' : 'Suas tropas', eles: b.eles.nome, meuCurto: 'Você', elesCurto: 'Eles' }; }
  function tendenciaHTML(b) {
    if (b.encerrada) {
      var r = b.resultado, ok = r === 'vitoria';
      var txt = { vitoria: 'Vitória', derrota: 'Derrota', recuo: b.papel === 'ataque' ? 'Suas tropas recuaram' : 'Você recuou', recuou: 'Você recuou: o local foi saqueado', 'defesa-recuou': 'A defesa fugiu' }[r] || r;
      return '<p class="tendencia ' + (ok || r === 'defesa-recuou' ? 'sucesso' : 'perigo') + '">' + RP.icone(ok ? 'check' : 'alerta', 'ico-p') + RP.esc(txt) + '</p>';
    }
    var m = { vencendo: ['sucesso', 'Tendência: seu lado vence'], perdendo: ['perigo', 'Tendência: o outro lado leva vantagem'], recuo: ['alerta', 'Tendência: suas tropas recuam no limite da tática'], equilibrado: ['alerta', 'Tendência: equilibrado'] }[b.tendencia] || ['alerta', ''];
    return '<p class="tendencia ' + m[0] + '">' + RP.icone(m[0] === 'sucesso' ? 'check' : 'alerta', 'ico-p') + m[1] + '</p>';
  }
  function ladoTxt(l, b, meu) {
    var partes = RP.partesGrupo(l.tropas) || 'sem tropas';
    if (l.milicia) partes += ' · milícia ' + RP.num(l.milicia);
    if (l.arqueirosNoAlto) partes += ' · ' + RP.num(l.arqueirosNoAlto) + ' arqueiros no alto';
    if (l.portoes) partes += ' · portões ' + l.portoes;
    if (!meu && l.direcao) partes += ' · vindas do ' + l.direcao;
    return partes;
  }
  function desenharBatalhaTela(el) {
    var b = bat; if (!b) return;
    var agora = RP.agora(), dur = b.fim - b.inicio, rot = rotulosBat(b);
    var tot = (b.forca.meu + b.forca.eles) || 1;
    var sub = RP.esc(b.nome) + ' · ' + RP.esc(b.tipoNome) + (b.papel === 'ataque' && b.tatica ? ' · tática ' + RP.esc((TATICAS.filter(function (x) { return x.id === b.tatica; })[0] || {}).nome || '').toLowerCase() : '');
    RP.$('.bat-sub', el).innerHTML = sub;
    RP.$('.bat-conteudo', el).innerHTML =
      '<div class="card pilha"><div class="bat-lados"><div class="bat-lado meu"><span class="rotulo">' + RP.esc(rot.meu) + '</span><b class="num">' + RP.num(b.forca.meu) + '</b><small class="fraco">' + RP.esc(ladoTxt(b.meu, b, true)) + '</small></div>' +
      '<div class="bat-vs">×</div><div class="bat-lado eles"><span class="rotulo">' + RP.esc(b.eles.nome) + '</span><b class="num">' + RP.num(b.forca.eles) + '</b><small class="fraco">' + RP.esc(ladoTxt(b.eles, b, false)) + '</small></div></div>' +
      '<div class="barra-dupla" role="img" aria-label="' + RP.esc(rot.meu) + ' ' + Math.round(100 * b.forca.meu / tot) + '%, ' + RP.esc(b.eles.nome) + ' ' + Math.round(100 * b.forca.eles / tot) + '%"><i class="d" style="width:' + (100 * b.forca.meu / tot).toFixed(1) + '%"></i><i class="a" style="width:' + (100 * b.forca.eles / tot).toFixed(1) + '%"></i></div>' +
      tendenciaHTML(b) +
      (b.eles.atacante ? '<div class="linha bat-estandarte">' + RP.brasao(b.eles.atacante.brasao, { tamanho: 28 }) + '<span><b>Reino de ' + RP.esc(b.eles.atacante.nome) + '</b><br><small class="fraco">identificado pelo estandarte</small></span></div>' : '') + '</div>' +
      '<div class="secao-titulo">Força ao longo da batalha</div><div class="card">' + RP.graficoBatalha(b.serie, dur, Math.min(agora, b.fim) - b.inicio, rot) + tabelaSerie(b.serie, rot) + '</div>' +
      '<div class="secao-titulo">Acontecimentos</div><ol class="diario">' + b.diario.slice().reverse().map(function (d) {
        var s = Math.round(d.t / 1000);
        return '<li><span class="selo' + (d.lado === 'meu' ? ' selo-info' : d.lado === 'eles' ? ' selo-perigo' : '') + '">' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + '</span><span>' + RP.esc(d.txt) + '</span></li>';
      }).join('') + '</ol>' +
      '<p class="fraco env-nota">Combate semi-automático: as tropas lutam sozinhas; você decide reforços e recuo. ' +
      (b.encerrada ? 'Encerrada.' : 'Termina em <b class="num" data-fim="' + b.fim + '">' + RP.fmtResta(b.fim - agora) + '</b>.') + '</p>' +
      (b.encerrada && b.relatorioId ? '<a class="btn btn-p" href="#/relatorio?id=' + b.relatorioId + '">' + RP.icone('relatorios') + 'Ver o relatório</a>' : '') +
      '<div style="height:var(--esp-8)"></div>';
    RP.ligarGraficoBatalha(el, b.serie, rot);
    var ac = RP.$('.bat-acoes', el);
    ac.hidden = b.encerrada;
    RP.$('[data-bat-reforcar]', ac).classList.toggle('btn-inativo', !b.reforcos.length);
  }
  function folhaReforcos() {
    var b = bat; if (!b) return;
    RP.abrirFolha({
      titulo: b.papel === 'defesa' ? 'Enviar reforços' : 'Mais tropas para o ataque', veu: true,
      subtitulo: '<span class="fraco">Entram na batalha se chegarem antes do fim (' + RP.fmtHora(b.fim) + ').</span>',
      corpo: b.reforcos.length ? '<div class="pilha">' + b.reforcos.map(function (r) {
        return '<button type="button" class="rota-opcao ' + (r.aTempo ? 'segura' : 'curta') + '" data-bat-reforco="' + r.localId + '"><i class="rota-cor" aria-hidden="true"></i><span><b>' + RP.esc(r.nome) + '</b><small>' +
          RP.esc(RP.partesGrupo(r.tropas)) + (r.aTempo ? '' : ' · chegam depois do fim') + '</small></span><span class="rota-tempo">' + RP.icone('relogio', 'ico-p') + RP.fmtDuracao(r.min * 60) + '</span></button>';
      }).join('') + '</div><p class="fraco env-nota">Todas as tropas do local vão. Para escolher quantas, envie pelo mapa.</p>' : '<p class="fraco">Nenhum local seu com tropas que cheguem até lá.</p>'
    });
  }
  function enviarReforco(localId) {
    var b = bat, r = b.reforcos.filter(function (x) { return x.localId === localId; })[0]; if (!r) return;
    var tropas = {};
    Object.keys(r.tropas).forEach(function (k) { var u = RP.unidade(k); if (b.ordemReforco !== 'atacar' || !u || u.so !== 'defesa') tropas[k] = r.tropas[k]; });
    var p = b.ordemReforco === 'atacar' ? RP.post('/ataques', { deLocalId: localId, tropas: tropas, destinoHex: b.hex })
      : RP.post('/tropas/enviar', { deLocalId: localId, tropas: tropas, destinoHex: b.hex, ordem: b.ordemReforco });
    RP.tentar(p).then(function (ex) {
      RP.fecharFolha();
      RP.aviso({ titulo: 'Reforços a caminho', texto: RP.partesGrupo(tropas) + ' · chegam ' + RP.fmtHora(ex.chegada) + '.', icone: 'escudo', tipo: 'sucesso' });
      RP.recarregarReino();
    });
  }
  RP.registrarTela('batalha', {
    secao: 'tropas',
    montar: function (el) {
      el.innerHTML = '<header class="topo"><a class="btn btn-fantasma btn-icone" href="#/tropas" aria-label="Voltar">' + RP.icone('voltar') + '</a><div class="topo-titulos"><h1>Batalha</h1><small class="bat-sub"></small></div></header>' +
        '<div class="conteudo-tela bat-conteudo"><p class="fraco">Carregando…</p></div>' +
        '<div class="rodape-acao bat-acoes" hidden><button type="button" class="btn btn-primario" data-bat-reforcar>' + RP.icone('escudo') + 'Enviar reforços</button><button type="button" class="btn" data-bat-recuar>' + RP.icone('voltar') + 'Recuar</button></div>';
      el.addEventListener('click', function (e) {
        var b;
        if (e.target.closest('[data-bat-reforcar]')) { RP.carregarTropas().then(folhaReforcos, folhaReforcos); return; }
        if (e.target.closest('[data-bat-recuar]') && bat && !bat.encerrada) {
          RP.modal({
            titulo: 'Recuar da batalha?',
            corpo: '<p class="suave">' + (bat.papel === 'defesa' ? 'A guarnição deixa o local e vai ao local seu mais próximo. A população se protege, mas o local será saqueado.'
              : 'Suas tropas param de lutar e voltam com as baixas que já tiveram. Os objetivos ficam para outra vez.') + '</p>',
            acoes: [{ rotulo: RP.icone('voltar') + 'Recuar', classe: 'btn-perigo', acao: function () {
              RP.tentar(RP.post('/batalhas/' + bat.id + '/recuar')).then(function (nb) { bat = nb; desenharBatalhaTela(el); RP.aviso({ titulo: 'Recuo ordenado', icone: 'voltar', tipo: 'alerta' }); RP.recarregarReino(); });
            } }, { rotulo: 'Continuar lutando' }]
          });
        }
      });
      document.addEventListener('click', function (e) {
        var b = e.target.closest('[data-bat-reforco]');
        if (b) enviarReforco(+b.getAttribute('data-bat-reforco'));
      });
      RP.ouvir('batalha', function (d) { if (!el.hidden && bat && d && d.id === bat.id) carregarBatalha(el, bat.id); });
    },
    entrar: function (el, q) {
      bat = null;
      var id = q.get('id');
      clearInterval(batTimer);
      if (!id) {
        RP.$('.bat-sub', el).textContent = 'Suas batalhas';
        RP.$('.bat-acoes', el).hidden = true;
        RP.get('/batalhas').then(function (l) {
          RP.$('.bat-conteudo', el).innerHTML = l.length ? '<div class="lista">' + l.map(function (b) {
            return '<a class="lista-item" href="#/batalha?id=' + b.id + '"><span class="ico-placa">' + RP.icone(b.papel === 'defesa' ? 'escudo' : 'espada') + '</span><div style="flex:1;min-width:0"><b>' + RP.esc(b.nome) + '</b><div class="fraco">' +
              RP.esc(b.tipoNome) + ' · ' + (b.encerrada ? 'encerrada' : 'termina em <span data-fim="' + b.fim + '">' + RP.fmtResta(b.fim - RP.agora()) + '</span>') + '</div></div>' + RP.icone('avancar', 'ico-p') + '</a>';
          }).join('') + '</div>' : '<p class="fraco">Nenhuma batalha agora.</p>';
        });
        return;
      }
      carregarBatalha(el, id);
      if (!RP.tropas) RP.carregarTropas().then(function () { desenharBatalhaTela(el); }, function () { /* offline */ });
      /* a curva anda com o tempo: redesenha a cada 5 s e busca de novo a cada 20 s */
      var n = 0;
      batTimer = setInterval(function () {
        if (el.hidden || !bat || bat.encerrada) return;
        n++;
        if (n % 4 === 0 || RP.agora() > bat.fim) carregarBatalha(el, bat.id); else desenharBatalhaTela(el);
      }, 5000);
    },
    sair: function () { clearInterval(batTimer); }
  });

  /* faixa "Batalha em andamento" no reino e nas tropas */
  function faixaBatalhas() {
    var l = (RP.reino && RP.reino.batalhas) || [];
    return l.map(function (b) {
      return '<a class="faixa-alerta faixa-batalha" href="#/batalha?id=' + b.id + '">' + RP.icone(b.papel === 'defesa' ? 'alerta' : 'espada') + '<span class="txt"><b>' +
        (b.papel === 'defesa' ? 'Batalha em ' + RP.esc(b.nome) : 'Suas tropas atacam: ' + RP.esc(b.nome)) + '</b><br>' + RP.esc(b.tipoNome) + ' · termina em <span class="num" data-fim="' + b.fim + '">' + RP.fmtResta(b.fim - RP.agora()) + '</span></span>' + RP.icone('avancar', 'ico-p') + '</a>';
    }).join('');
  }
  RP.extrasReino = RP.extrasReino || [];
  RP.extrasReino.push(faixaBatalhas);
  RP.extrasTropas = RP.extrasTropas || [];
  RP.extrasTropas.push(faixaBatalhas);
  RP.acoesTropas = RP.acoesTropas || [];
  RP.acoesTropas.push({ href: '#/batalha', icone: 'espada', titulo: 'Batalhas', texto: 'Em andamento e recentes' });
  RP.ouvir('batalha', function () { RP.recarregarReino(); });

  /* ================================================================ locais: defesa (torres, portões) e batalha */
  RP.extrasCardLocal = RP.extrasCardLocal || [];
  RP.extrasCardLocal.push(function (l) {
    var d = l.defesa; if (!d) return '';
    return (d.batalhaId ? '<span class="selo selo-perigo">' + RP.icone('espada') + 'Batalha</span>' : '') +
      (d.torres ? '<span class="lc-torre">' + RP.icone('torre', 'ico-p') + d.torres + (d.torres > 1 ? ' torres' : ' torre') + ' · ' + d.arqueirosNoAlto + ' arqueiros no alto</span>' : '');
  });
  RP.extrasFolhaLocal = RP.extrasFolhaLocal || [];
  RP.extrasFolhaLocal.push(function (l) {
    var d = l.defesa; if (!d) return '';
    var partes = [];
    if (d.torres) partes.push(d.torres + (d.torres > 1 ? ' torres' : ' torre') + ' · ' + d.arqueirosNoAlto + ' arqueiros no alto');
    if (d.portoes != null) partes.push('portões nível ' + d.portoes);
    return partes.length ? linha('Defesa', RP.esc(partes.join(' · '))) : '';
  });
  RP.acoesFolhaLocal = RP.acoesFolhaLocal || [];
  RP.acoesFolhaLocal.push(function (l) {
    return (l.defesa && l.defesa.batalhaId ? '<a class="btn btn-p btn-primario" href="#/batalha?id=' + l.defesa.batalhaId + '">' + RP.icone('espada') + 'Batalha</a>' : '') +
      (l.tipo === 'castelo' ? '<a class="btn btn-p" href="#/construcao?aba=defesas">' + RP.icone('torre') + 'Defesas</a>' : '');
  });

  /* ================================================================ Construção → Defesas: portões e torres */
  var defesas = null, buscando = false;
  function buscarDefesas() {
    if (buscando) return;
    buscando = true;
    RP.get('/defesas').then(function (d) {
      buscando = false; defesas = d;
      var c = RP.$('[data-defesas]'); if (c) c.innerHTML = htmlDefesas(d);
    }, function () { buscando = false; });
  }
  function barraEstrutura(v, max) {
    return max ? '<div class="barra" role="progressbar" aria-label="Estrutura"><i style="width:' + Math.min(100, 100 * v / max).toFixed(1) + '%"></i></div><small class="fraco">Estrutura ' + RP.num(v) + ' de ' + RP.num(max) + '</small>' : '';
  }
  function htmlDefesas(d) {
    var c = d.castelo, h = '<div class="nota-regra">' + RP.icone('torre', 'ico-p') + '<span>Não há muros. Torres põem <b>arqueiros no alto</b>, que atiram protegidos e defendem seus locais no alcance. O invasor precisa <b>derrubar a torre</b> (aríetes) para se livrar deles.</span></div>';
    if (c) {
      var p = c.proximo;
      h += '<div class="secao-titulo">Castelo</div><div class="card pilha torre-card"><div class="linha"><span class="ico-placa ico-placa-g">' + RP.icone('castelo') + '</span><span style="flex:1;min-width:0"><b>' + RP.esc(c.nome) + '</b><br><small class="fraco">Portões nível ' + c.portoes + ' · defesa ×' + String(c.multiplicador).replace('.', ',') +
        (c.torres ? ' · ' + c.torres + (c.torres > 1 ? ' torres' : ' torre') + ' no alcance' : '') + '</small></span><span class="selo">Portões ' + c.portoes + '</span></div>' +
        barraEstrutura(c.estrutura, c.estruturaMax) +
        (p ? '<div class="torre-acao"><div class="linha-entre"><span><b>Portões nível ' + p.nivel + '</b><small class="fraco"> · defesa ×' + String(p.multiplicador).replace('.', ',') + '</small><br>' + RP.custoHTML(p.custo) + ' <span class="tempo">' + RP.icone('relogio', 'ico-p') + RP.fmtDuracao(p.seg) + '</span></span>' +
          (p.bloqueio ? '<span class="selo selo-desconhecido">' + RP.icone('cadeado') + RP.esc(p.bloqueio) + '</span>' : '<button type="button" class="btn btn-p btn-primario" data-def-portoes>' + RP.icone('martelo') + 'Subir</button>') + '</div></div>'
          : '<p class="fraco">Portões no nível máximo.</p>') +
        '<small class="fraco">Aríetes e trebuchets derrubam portões no cerco.</small></div>';
    }
    h += '<div class="secao-titulo">Suas torres</div><div class="pilha">' + (d.torres.length ? d.torres.map(function (t) {
      var p = t.proximo;
      return '<div class="card pilha torre-card"><div class="linha"><span class="ico-placa ico-placa-g">' + RP.icone('torre') + '</span><span style="flex:1;min-width:0"><b>Torre de arqueiros</b><br><small class="fraco">hexágono ' + t.c + ', ' + t.l + '</small></span><span class="selo">Nv ' + t.nivel + '</span></div>' +
        '<div class="ext-numeros"><div><span class="fraco">Alcance</span><b class="num">' + t.alcance + ' hex.</b></div><div><span class="fraco">Arqueiros no alto</span><b class="num">' + t.arqueiros + '</b></div><div><span class="fraco">Protege</span><b class="num">' + t.protege.length + (t.protege.length === 1 ? ' local' : ' locais') + '</b></div></div>' +
        barraEstrutura(t.estrutura, t.estruturaMax) +
        '<small class="fraco">Protege: ' + RP.esc(t.protege.map(function (x) { return x.nome; }).join(', ') || 'nenhum local') + '</small>' +
        (p ? '<div class="torre-acao"><div class="linha-entre"><span><b>Subir para nível ' + p.nivel + '</b><small class="fraco"> · alcance ' + p.alcance + ', ' + p.arqueiros + ' arqueiros</small><br>' + RP.custoHTML(p.custo) + ' <span class="tempo">' + RP.icone('relogio', 'ico-p') + RP.fmtDuracao(p.seg) + '</span></span>' +
          '<button type="button" class="btn btn-p btn-primario" data-def-torre="' + t.id + '">' + RP.icone('martelo') + 'Subir</button></div></div>' : '<p class="fraco">Nível máximo.</p>') +
        '<a class="btn btn-p btn-fantasma" href="#/mapa?foco=' + t.hex + '">' + RP.icone('mapa') + 'Ver no mapa</a></div>';
    }).join('') : '<p class="fraco">Nenhuma torre ainda.</p>') + '</div>';
    var n = d.novaTorre;
    h += '<div class="secao-titulo">Nova torre</div><div class="card pilha">' +
      '<p class="fraco env-nota">A torre ocupa um hexágono livre a até ' + n.distanciaMax + ' de um local seu e protege todos os seus locais no alcance.</p>' +
      '<div class="ext-numeros"><div><span class="fraco">Alcance</span><b class="num">' + n.alcance + ' hex.</b></div><div><span class="fraco">Arqueiros</span><b class="num">' + n.arqueiros + '</b></div><div><span class="fraco">Tempo</span><b class="num">' + RP.fmtDuracao(n.seg) + '</b></div></div>' +
      '<div class="linha" style="flex-wrap:wrap">' + RP.custoHTML(n.custo) + '</div>' +
      '<a class="btn btn-p btn-primario" href="#/mapa?torre=1">' + RP.icone('alvo') + 'Escolher no mapa</a></div>';
    return h;
  }
  RP.extrasConstrucao = RP.extrasConstrucao || [];
  RP.extrasConstrucao.push({ aba: 'defesas', nome: 'Defesas', html: function () {
    buscarDefesas();
    return '<div class="pilha" data-defesas>' + (defesas ? htmlDefesas(defesas) : '<p class="fraco">Carregando…</p>') + '</div>';
  } });
  document.addEventListener('click', function (e) {
    var b, p = null;
    if (e.target.closest('[data-def-portoes]')) p = RP.post('/defesas/portoes');
    else if ((b = e.target.closest('[data-def-torre]'))) p = RP.post('/defesas/torres/' + b.getAttribute('data-def-torre') + '/nivel');
    if (!p) return;
    RP.tentar(p).then(function (it) {
      RP.aviso({ titulo: 'Na fila: ' + it.rotulo, texto: it.materialCompleto ? '' : 'O material está a caminho.', icone: 'martelo', tipo: 'sucesso' });
      RP.recarregarReino(); buscarDefesas();
    });
  });

  /* ================================================================ relatórios de ataque e de defesa */
  RP.FILTROS_RELATORIO = RP.FILTROS_RELATORIO || [['', 'Todos']];
  RP.FILTROS_RELATORIO.push(['ataque', 'Ataques'], ['defesa', 'Defesas']);
  RP.desenhosRelatorio = RP.desenhosRelatorio || {};
  var SELO_RES = { vitoria: ['selo-visivel', 'Vitória'], derrota: ['selo-perigo', 'Derrota'], recuo: ['selo-antigo', 'Recuo'], recuou: ['selo-antigo', 'Você recuou'], 'defesa-recuou': ['selo-visivel', 'A defesa fugiu'], 'sem-combate': ['selo-desconhecido', 'Sem combate'] };
  function seloRes(r) { var s = SELO_RES[r] || ['', r || '']; return '<span class="selo ' + s[0] + '">' + RP.esc(s[1]) + '</span>'; }
  function ganhoHTML(g, sinal) {
    var ks = Object.keys(g || {}); if (!ks.length) return '';
    return '<span class="custos">' + ks.map(function (k) { return '<span class="custo ' + (sinal === '−' ? 'falta-perda' : 'ganho') + '">' + RP.icone(k, 'ico-p r-' + k) + sinal + RP.num(g[k]) + '</span>'; }).join('') + '</span>';
  }
  function graficoRel(d, papel) {
    var s = d.serie || []; if (s.length < 2) return '';
    var serie = s.map(function (p) { return { t: p.t, meu: papel === 'ataque' ? p.a : p.d, eles: papel === 'ataque' ? p.d : p.a, proj: false }; });
    var rot = papel === 'ataque' ? { meu: 'Suas tropas', eles: 'Defesa', meuCurto: 'Você', elesCurto: 'Eles' } : { meu: 'Seu lado', eles: d.atacante ? d.atacante.nome : 'Forças desconhecidas', meuCurto: 'Você', elesCurto: 'Eles' };
    return '<div class="secao-titulo">Força ao longo da batalha</div><div class="card">' + RP.graficoBatalha(serie, serie[serie.length - 1].t || 1, serie[serie.length - 1].t, rot) + '</div>';
  }
  /* os nomes das unidades vêm de GET /tropas: no primeiro relatório aberto, carrega e redesenha */
  document.addEventListener('rp:tela', function (ev) {
    if (ev.detail !== 'relatorio' || RP.tropas) return;
    RP.carregarTropas().then(function () { if (document.documentElement.getAttribute('data-tela') === 'relatorio') RP.rotear(); }, function () { /* offline */ });
  });
  RP.desenhosRelatorio.ataque = function (rel) {
    var d = rel.dados || {}, t = d.tropas || {};
    var h = (d.resumo ? '<p class="suave">' + RP.esc(d.resumo) + '</p>' : '') + '<div class="info">' +
      linha('Alvo', RP.esc(d.alvo || '')) + linha('Tipo', RP.esc(d.tipoNome || '')) +
      (d.tatica ? linha('Tática', RP.esc((TATICAS.filter(function (x) { return x.id === d.tatica; })[0] || {}).nome || d.tatica)) : '') +
      linha('Resultado', seloRes(d.resultado)) +
      (d.forcas ? linha('Forças', RP.num(d.forcas.ataque) + ' × ' + RP.num(d.forcas.defesa)) : '') +
      linha('Tropas', RP.selosGrupo(t.enviadas)) +
      linha('Suas perdas', RP.somaGrupo(t.perdas) ? RP.esc(RP.partesGrupo(t.perdas)) : 'nenhuma') +
      (RP.somaGrupo(t.feridos) ? linha('Feridos', RP.esc(RP.partesGrupo(t.feridos))) : '') +
      (d.defesa ? linha('Defesa vista', RP.esc((RP.partesGrupo(d.defesa.tropas) || 'sem tropas') + (d.defesa.milicia || d.tipo !== 'interceptacao' ? ' · milícia ' + RP.num(d.defesa.milicia) : '') + (d.defesa.arqueirosNoAlto ? ' · ' + d.defesa.arqueirosNoAlto + ' arqueiros no alto' : '') + (d.defesa.portoes ? ' · portões ' + d.defesa.portoes : ''))) +
        linha('Perdas deles', RP.somaGrupo(d.defesa.perdas) ? RP.esc(RP.partesGrupo(d.defesa.perdas)) : 'nenhuma') : '') +
      (d.levaram && Object.keys(d.levaram).length ? linha('Levaram', ganhoHTML(d.levaram, '+')) : '') +
      (d.reliquias && d.reliquias.length ? linha('Relíquia', RP.esc(d.reliquias.join(', '))) : '') +
      linha('Estandarte', d.estandarte ? 'Levado: o defensor sabe que foi você' : 'Não levado: o alvo não sabe quem foi') + '</div>';
    if (d.objetivos && d.objetivos.length) h += '<div class="secao-titulo">Objetivos</div><div class="card lista">' + d.objetivos.map(function (o, i) {
      var ic = o.estado === 'cumprido' ? 'check' : o.estado === 'parcial' ? 'alerta' : 'fechar', cls = o.estado === 'cumprido' ? 'selo-visivel' : o.estado === 'parcial' ? 'selo-antigo' : 'selo-perigo';
      return '<div class="lista-item"><span class="obj-n">' + (i + 1) + '</span><span style="flex:1;min-width:0"><b>' + RP.esc(o.texto) + '</b><br><small class="fraco">' + RP.esc(o.obtido || '') + '</small></span><span class="selo ' + cls + '">' + RP.icone(ic) + RP.esc(o.estado) + '</span></div>';
    }).join('') + '</div>';
    if (d.porQueVoltaram) h += '<p class="nota-regra">' + RP.icone('voltar', 'ico-p') + '<span><b>Por que voltaram:</b> ' + RP.esc(d.porQueVoltaram) + '</span></p>';
    if (d.rendimento != null && d.rendimento < 1) h += '<p class="nota-antiga">' + RP.icone('info', 'ico-p') + '<span>Saque repetido a este alvo: rendimento ' + Math.round(d.rendimento * 100) + '%. Saques repetidos rendem cada vez menos.</span></p>';
    h += graficoRel(d, 'ataque');
    h += '<div class="linha rel-acoes">' + (d.hex != null && d.tipo !== 'interceptacao' ? '<a class="btn btn-p btn-primario" href="#/envio?alvo=' + d.hex + '">' + RP.icone('espada') + 'Atacar de novo</a>' : '') +
      (d.hex != null ? '<a class="btn btn-p" href="#/mapa?foco=' + d.hex + '">' + RP.icone('mapa') + 'Ver no mapa</a>' : '') + '</div>';
    return h;
  };
  RP.desenhosRelatorio.defesa = function (rel) {
    var d = rel.dados || {}, p = d.perdas || {}, a = d.atacante;
    var h = (d.resumo ? '<p class="suave">' + RP.esc(d.resumo) + '</p>' : '') +
      '<div class="secao-titulo">Atacante</div><div class="card linha atacante">' +
      (a ? RP.brasao(a.brasao, { tamanho: 40 }) + '<span><b>Reino de ' + RP.esc(a.nome) + '</b><br><small class="fraco">Identificado: levava o estandarte</small></span>'
        : RP.brasao(null, { tamanho: 40, desconhecido: true }) + '<span><b>Forças desconhecidas</b><br><small class="fraco">Sem estandarte. Batedores podem descobrir quem foi.</small></span>') + '</div>' +
      '<div class="card info" style="margin-top:var(--esp-3)">' + linha('Local', RP.esc(d.local || '')) + linha('Tipo de ataque', RP.esc(d.tipoNome || '')) +
      linha('Tropas vistas', RP.selosGrupo(d.tropasVistas)) + (d.direcao ? linha('Vindas do', RP.esc(d.direcao)) : '') + linha('Resultado', seloRes(d.resultado)) +
      (d.perdas ? linha('Suas perdas', (RP.somaGrupo(p.guarnicao) ? RP.esc(RP.partesGrupo(p.guarnicao)) : 'nenhuma tropa') + (p.milicia ? ' · ' + RP.num(p.milicia) + ' da milícia' : '')) +
        (RP.somaGrupo(p.feridos) ? linha('Feridos', RP.esc(RP.partesGrupo(p.feridos))) : '') +
        linha('Baixas deles', RP.somaGrupo(p.atacantes) ? RP.esc(RP.partesGrupo(p.atacantes)) : 'nenhuma') : '') +
      (d.levaram && Object.keys(d.levaram).length ? linha('Levaram', ganhoHTML(d.levaram, '−')) : '') +
      (d.reliquias && d.reliquias.length ? linha('Relíquia levada', RP.esc(d.reliquias.join(', '))) : '') +
      (d.danos && d.danos.length ? linha('Danos', RP.esc(d.danos.join(', '))) : '') + '</div>';
    h += graficoRel(d, 'defesa');
    h += '<div class="linha rel-acoes">' + (d.hex != null ? '<a class="btn btn-p btn-primario" href="#/mapa?foco=' + d.hex + '">' + RP.icone('mapa') + 'Ver no mapa</a>' : '') +
      (RP.telas.exploradores ? '<a class="btn btn-p" href="#/exploradores?tipo=batedor">' + RP.icone('batedor') + 'Enviar batedor</a>' : '') + '</div>';
    return h;
  };
})();
