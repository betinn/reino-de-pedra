/* Reino de Pedra — núcleo do cliente: utilidades, gestos, folha, modal, avisos, timers, estado do reino,
   barra de recursos e navegação entre telas. Portado de prototipo/js/nucleo.js; os dados vêm do servidor.
   Cada tela se registra com RP.registrarTela(nome, { montar, entrar, sair, nav, secao, fixa, publica }). */
(function () {
  'use strict';
  var RP = (window.RP = window.RP || {});
  var raiz = document.documentElement;

  /* ---------------------------------------------------------------- utilidades */
  RP.$ = function (sel, el) { return (el || document).querySelector(sel); };
  RP.$$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };
  RP.num = function (n) { return Math.round(n).toLocaleString('pt-BR'); };
  RP.esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };
  RP.fmtResta = function (ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    if (s <= 0) return 'concluído';
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    if (h > 0) return h + ' h ' + String(m).padStart(2, '0') + ' min';
    return String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
  };
  RP.fmtHa = function (horas) {
    if (horas < 1) return horas * 60 >= 1 ? 'há ' + Math.round(horas * 60) + ' min' : 'há instantes';
    if (horas < 48) return 'há ' + Math.round(horas) + ' h';
    return 'há ' + Math.round(horas / 24) + ' dias';
  };
  /* horário absoluto legível: "hoje às 14:20", "amanhã às 06:40" */
  RP.fmtHora = function (ms) {
    var d = new Date(ms), hoje = new Date(), am = new Date(); am.setDate(hoje.getDate() + 1);
    var hh = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    if (d.toDateString() === hoje.toDateString()) return 'hoje às ' + hh;
    if (d.toDateString() === am.toDateString()) return 'amanhã às ' + hh;
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }) + ' às ' + hh;
  };
  RP.fmtDuracao = function (seg) {
    var h = Math.floor(seg / 3600), m = Math.round((seg % 3600) / 60);
    return h ? h + ' h ' + (m ? m + ' min' : '') : m + ' min';
  };

  /* número curto para barras estreitas: 640 · 2,3k · 12k */
  RP.numCurto = function (n) {
    n = Math.round(n);
    if (n < 1000) return String(n);
    if (n < 10000) return (Math.floor(n / 100) / 10).toLocaleString('pt-BR') + 'k';
    return Math.floor(n / 1000) + 'k';
  };

  /* preferências do visitante (só conveniência; funciona sem armazenamento) */
  RP.pref = function (chave, valor) {
    try {
      if (valor === undefined) return localStorage.getItem('rp-' + chave);
      localStorage.setItem('rp-' + chave, valor);
    } catch (e) { return null; }
  };

  /* ---------------------------------------------------------------- gestos (arrastar, pinça, roda, toque)
     h = { inicio(), arrasto(dx, dy), pinca(fator, mx, my, mx0, my0), roda(fator, x, y), toque(x, y), fim() }
     Coordenadas relativas ao elemento. */
  RP.gestos = function (el, h) {
    var pts = new Map(), arr = null, pin = null, toq = null;
    function rel(e) { var r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    el.addEventListener('pointerdown', function (e) {
      if (e.isPrimary) { pts.clear(); pin = null; } /* novo gesto: descarta ponteiros que não terminaram */
      try { el.setPointerCapture(e.pointerId); } catch (er) { /* ignora */ }
      pts.set(e.pointerId, rel(e));
      if (h.inicio) h.inicio();
      if (pts.size === 1) { var p = rel(e); arr = p; toq = { x: p.x, y: p.y, cx: e.clientX, cy: e.clientY, t: performance.now(), movido: false }; }
      else if (pts.size === 2) {
        var a = Array.from(pts.values());
        pin = { d: Math.max(1, Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y)), mx: (a[0].x + a[1].x) / 2, my: (a[0].y + a[1].y) / 2 };
        toq = null; arr = null;
        if (h.inicioPinca) h.inicioPinca();
      }
    });
    el.addEventListener('pointermove', function (e) {
      if (!pts.has(e.pointerId)) return;
      var p = rel(e);
      pts.set(e.pointerId, p);
      if (pin && pts.size >= 2) {
        var a = Array.from(pts.values());
        var d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        h.pinca(d / pin.d, (a[0].x + a[1].x) / 2, (a[0].y + a[1].y) / 2, pin.mx, pin.my);
      } else if (arr) {
        var dx = p.x - arr.x, dy = p.y - arr.y;
        if (toq && Math.hypot(p.x - toq.x, p.y - toq.y) > 8) toq.movido = true;
        if (!toq || toq.movido) { h.arrasto(dx, dy); arr = p; }
      }
    });
    function fim(e) {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (toq && !toq.movido && e.type === 'pointerup' && performance.now() - toq.t < 600 && h.toque) h.toque(toq.x, toq.y, toq.cx, toq.cy);
      toq = null;
      if (pts.size === 1) { arr = Array.from(pts.values())[0]; pin = null; }
      if (pts.size === 0) { arr = null; pin = null; if (h.fim) h.fim(); }
    }
    el.addEventListener('pointerup', fim);
    el.addEventListener('pointercancel', fim);
    el.addEventListener('lostpointercapture', fim);
    if (h.roda) el.addEventListener('wheel', function (e) {
      e.preventDefault();
      var p = rel(e);
      h.roda(Math.exp(-e.deltaY * 0.0016), p.x, p.y);
    }, { passive: false });
  };

  /* ---------------------------------------------------------------- avisos (toasts) */
  RP.aviso = function (o) {
    var box = RP.$('#avisos');
    var el = document.createElement('div');
    el.className = 'aviso aviso-' + (o.tipo || 'info');
    el.setAttribute('role', o.tipo === 'perigo' ? 'alert' : 'status');
    el.innerHTML = RP.icone(o.icone || 'info', '', '') + '<div><b>' + RP.esc(o.titulo) + '</b>' + (o.texto ? '<span>' + RP.esc(o.texto) + '</span>' : '') + '</div>';
    box.appendChild(el);
    var sair = function () { el.classList.add('sai'); setTimeout(function () { el.remove(); }, 240); };
    el.addEventListener('click', sair);
    setTimeout(sair, o.ms || 3200);
  };

  /* ---------------------------------------------------------------- folha inferior */
  var folha = null, veu = null, aoFecharFolha = null, folhaAbertaEstado = false;
  function garantirFolha() {
    if (folha) return;
    veu = document.createElement('div');
    veu.className = 'veu';
    folha = document.createElement('section');
    folha.className = 'folha';
    folha.setAttribute('role', 'dialog');
    folha.setAttribute('aria-modal', 'false');
    document.body.appendChild(veu);
    document.body.appendChild(folha);
    veu.addEventListener('click', function () { RP.fecharFolha(); });
    /* arrastar para baixo fecha */
    var y0 = null, dy = 0;
    folha.addEventListener('pointerdown', function (e) {
      if (!e.target.closest('.folha-pega, .folha-topo') || e.target.closest('button')) return;
      y0 = e.clientY; dy = 0; folha.style.transition = 'none';
      folha.setPointerCapture(e.pointerId);
    });
    folha.addEventListener('pointermove', function (e) {
      if (y0 === null) return;
      dy = Math.max(0, e.clientY - y0);
      folha.style.transform = 'translateY(' + dy + 'px)';
    });
    var solta = function () {
      if (y0 === null) return;
      folha.style.transition = ''; folha.style.transform = '';
      if (dy > 70) RP.fecharFolha();
      y0 = null;
    };
    folha.addEventListener('pointerup', solta);
    folha.addEventListener('pointercancel', solta);
  }
  RP.abrirFolha = function (o) {
    garantirFolha();
    if (aoFecharFolha) { var f = aoFecharFolha; aoFecharFolha = null; f(true); }
    folha.classList.toggle('sobre-nav', !!o.sobreNav);
    veu.classList.toggle('ativo', !!o.veu);
    folha.innerHTML =
      '<div class="folha-pega" aria-hidden="true"></div>' +
      '<header class="folha-topo">' + (o.icone || '') +
      '<div class="folha-titulos"><h2 id="folha-titulo">' + o.titulo + '</h2>' + (o.subtitulo ? '<div class="folha-sub">' + o.subtitulo + '</div>' : '') + '</div>' +
      '<button class="btn btn-fantasma btn-icone" type="button" data-fechar-folha aria-label="Fechar">' + RP.icone('fechar') + '</button></header>' +
      '<div class="folha-corpo">' + (o.corpo || '') + '</div>' +
      (o.acoes ? '<footer class="folha-acoes">' + o.acoes + '</footer>' : '');
    folha.setAttribute('aria-labelledby', 'folha-titulo');
    aoFecharFolha = o.aoFechar || null;
    folhaAbertaEstado = true;
    requestAnimationFrame(function () { folha.classList.add('aberta'); });
    RP.$('[data-fechar-folha]', folha).addEventListener('click', function () { RP.fecharFolha(); });
    return folha;
  };
  RP.fecharFolha = function () {
    if (!folha) return;
    folhaAbertaEstado = false;
    folha.classList.remove('aberta');
    veu.classList.remove('ativo');
    if (aoFecharFolha) { var f = aoFecharFolha; aoFecharFolha = null; f(false); }
  };
  RP.folhaAberta = function () { return folhaAbertaEstado; };

  /* ---------------------------------------------------------------- modal */
  RP.modal = function (o) {
    var fundo = document.createElement('div');
    fundo.className = 'modal-fundo';
    fundo.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-t">' + (o.topo || '') +
      '<h2 id="modal-t">' + o.titulo + '</h2>' + (o.corpo || '') +
      '<div class="acoes">' + (o.acoes || []).map(function (a, i) {
        return '<button type="button" class="btn btn-bloco ' + (a.classe || '') + '" data-i="' + i + '">' + a.rotulo + '</button>';
      }).join('') + '</div></div>';
    document.body.appendChild(fundo);
    requestAnimationFrame(function () { fundo.classList.add('ativo'); });
    var fechar = function () { fundo.classList.remove('ativo'); setTimeout(function () { fundo.remove(); }, 240); };
    fundo.addEventListener('click', function (e) {
      var b = e.target.closest('[data-i]');
      if (b) { fechar(); var a = o.acoes[+b.getAttribute('data-i')]; if (a.acao) a.acao(); }
      else if (e.target === fundo && o.fecharFora !== false) fechar();
    });
    var bt = RP.$('.btn', fundo);
    if (bt) setTimeout(function () { bt.focus(); }, 50);
    return fechar;
  };

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var m = RP.$$('.modal-fundo.ativo').pop();
    if (m) { m.click(); return; }
    if (RP.folhaAberta()) RP.fecharFolha();
  });

  /* ---------------------------------------------------------------- timers ao vivo */
  /* barra de tempo. fimAbs (ms) opcional; sem ele, seg conta a partir da abertura da página.
     Itens que ainda não começaram aparecem como "Na fila". */
  RP.timerHTML = function (rotulo, seg, total, extra, fimAbs) {
    var f = fimAbs || (RP.agora() + seg * 1000), ini = f - total * 1000, agora = RP.agora();
    var pct = Math.max(0, Math.min(100, (100 * (agora - ini)) / (f - ini)));
    return '<div class="timer">' +
      '<div class="timer-topo"><b>' + rotulo + '</b>' + (ini > agora ? '<span class="selo">Na fila</span>' : '') + '<span class="timer-resta" data-fim="' + f + '">' + RP.fmtResta(f - agora) + '</span></div>' +
      '<div class="barra ' + (extra || '') + '" role="progressbar" aria-label="Progresso: ' + RP.esc(rotulo.replace(/<[^>]+>/g, '').trim()) + '"><i data-ini="' + ini + '" data-barra-fim="' + f + '" style="width:' +
      pct.toFixed(1) + '%"></i></div></div>';
  };
  RP.fimItem = function (it) { return it.fim || (RP.agora() + (it.seg || 0) * 1000); };
  /* item de fila (obra ou recrutamento): enquanto o material não chega, mostra a espera */
  RP.itemFilaHTML = function (o) {
    var esp = o.aguarda && o.aguarda > RP.agora();
    return RP.timerHTML(RP.esc(o.rotulo) + (esp ? ' <span class="selo selo-antigo selo-material">' + RP.icone('carroca') + 'material chega em <span data-fim="' + o.aguarda + '">' + RP.fmtResta(o.aguarda - RP.agora()) + '</span></span>' : ''), o.seg, o.total, '', o.fim);
  };
  /* próxima posição livre na fila, respeitando a chegada do material */
  RP.fimNaFila = function (fila, seg, aguarda) {
    var ult = fila.length ? RP.fimItem(fila[fila.length - 1]) : RP.agora();
    return Math.max(ult, RP.agora(), aguarda || 0) + seg * 1000;
  };
  /* ---------------------------------------------------------------- estado do reino (vem do servidor)
     RP.reino é o último GET /reino. Estoques andam sozinhos entre atualizações: estoque + taxa × tempo,
     até a capacidade do local (igual ao cálculo do servidor). */
  RP.reino = null;
  RP.NOMES_REC = { madeira: 'Madeira', pedra: 'Pedra', comida: 'Comida', ferro: 'Ferro', couro: 'Couro', peles: 'Peles',
    sal: 'Sal', ervas: 'Ervas raras', prata: 'Prata', aco: 'Aço de qualidade', ouro: 'Ouro', gema: 'Pedras preciosas', cavalo: 'Cavalos de raça', minerio: 'Minério raro' };
  RP.VALIOSOS = ['ouro', 'prata', 'aco', 'cavalo', 'sal', 'ervas', 'gema', 'minerio'];
  RP.nomeRecurso = function (k) { return (RP.NOMES_REC[k] || (k === 'populacao' ? 'População' : k)).toLowerCase(); };
  var recebidoEm = 0;
  RP.carregarReino = function () {
    return RP.get('/reino').then(function (r) {
      RP.reino = r; recebidoEm = RP.agora(); RP.sincronizar(r.agora);
      RP.locaisPorId = {};
      (r.locais || []).forEach(function (l) { RP.locaisPorId[l.id] = l; });
      document.dispatchEvent(new CustomEvent('rp:reino', { detail: r }));
      return r;
    });
  };
  /* recarrega o reino no máximo a cada 400 ms (vários avisos seguidos viram uma busca) */
  var recarga = null;
  RP.recarregarReino = function () {
    if (recarga) return;
    recarga = setTimeout(function () { recarga = null; RP.carregarReino().catch(function () { /* offline */ }); }, 400);
  };
  RP.local = function (id) { return RP.locaisPorId ? RP.locaisPorId[id] : null; };
  RP.castelo = function () { return RP.reino ? RP.local(RP.reino.casteloId) : null; };
  RP.qtdRecurso = function (k, localId) {
    var r = RP.reino; if (!r) return 0;
    if (k === 'populacao') return r.pop;
    if (localId === '*') return (r.locais || []).reduce(function (s, l) { return s + RP.qtdRecurso(k, l.id); }, 0);
    var l = RP.local(localId || r.casteloId); if (!l) return 0;
    var base = (l.estoque || {})[k] || 0, t = (l.taxa || {})[k] || 0;
    if (!t) return base;
    var cap = (l.cap || {})[k] || Infinity;
    if (base >= cap) return base;
    return Math.min(cap, base + t * (RP.agora() - recebidoEm) / 3600000);
  };
  RP.totalRecurso = function (k) { return RP.qtdRecurso(k, '*'); };
  RP.temRecurso = function (k, v, local) { return RP.qtdRecurso(k, local || '*') >= v; };
  RP.valorDe = function (c) {
    var v = (RP.config && RP.config.valor) || {};
    return Object.keys(c || {}).reduce(function (s, k) { return s + (c[k] || 0) * (v[k] || 1); }, 0);
  };
  /* custo em selos; marca em vermelho o que falta no reino todo (a requisição busca nos locais) */
  RP.custoHTML = function (custo, mult, local) {
    mult = mult || 1;
    return '<span class="custos">' + Object.keys(custo || {}).map(function (k) {
      var v = custo[k] * mult, tem = RP.temRecurso(k, v, local);
      return '<span class="custo' + (tem ? '' : ' falta') + '">' + RP.icone(k === 'populacao' ? 'populacao' : k, 'ico-p r-' + k) + RP.num(v) + '</span>';
    }).join('') + '</span>';
  };
  RP.faltas = function (custo, mult, local) {
    mult = mult || 1;
    return Object.keys(custo || {}).filter(function (k) { return RP.qtdRecurso(k, local || '*') < custo[k] * mult; })
      .map(function (k) { return RP.num(Math.ceil(custo[k] * mult - RP.qtdRecurso(k, local || '*'))) + ' ' + RP.nomeRecurso(k); });
  };

  function tique() {
    var agora = RP.agora();
    RP.$$('[data-fim]').forEach(function (el) { el.textContent = RP.fmtResta(+el.getAttribute('data-fim') - agora); });
    RP.$$('[data-barra-fim]').forEach(function (el) {
      var i = +el.getAttribute('data-ini'), f = +el.getAttribute('data-barra-fim');
      el.style.width = Math.max(0, Math.min(100, (100 * (agora - i)) / Math.max(1, f - i))).toFixed(2) + '%';
    });
    RP.$$('[data-rec]').forEach(function (el) {
      var q = RP.qtdRecurso(el.getAttribute('data-rec'), el.getAttribute('data-local') || undefined);
      el.textContent = el.hasAttribute('data-curto') ? RP.numCurto(q) : RP.num(q);
    });
    RP.$$('[data-pop]').forEach(function (el) { var p = RP.reino ? RP.reino.pop : 0; el.textContent = el.hasAttribute('data-curto') ? RP.numCurto(p) : RP.num(p); });
    document.dispatchEvent(new CustomEvent('rp:tique'));
  }
  setInterval(tique, 1000);

  /* ---------------------------------------------------------------- barra de recursos (estoque do castelo) */
  var ORDEM_REC = ['madeira', 'pedra', 'comida', 'ferro', 'couro', 'peles'];
  RP.ORDEM_REC = ORDEM_REC;
  RP.naoLidas = 0;
  RP.barraRecursos = function (opt) {
    opt = opt || {};
    var r = RP.reino, c = RP.castelo();
    var h = '<div class="recursos" role="group" aria-label="Recursos no castelo (sede)">';
    ORDEM_REC.forEach(function (k) {
      var q = RP.qtdRecurso(k), cap = c && c.cap && c.cap[k];
      h += '<button class="rec' + (cap && q >= cap * 0.95 ? ' rec-cheio' : '') + '" type="button" data-abrir-recursos aria-label="' + RP.NOMES_REC[k] + ' no castelo: ' + RP.num(q) + '">' +
        RP.icone(k, 'r-' + k) + '<span class="rec-num" data-rec="' + k + '" data-curto>' + RP.numCurto(q) + '</span></button>';
    });
    h += '<button class="rec" type="button" data-abrir-recursos aria-label="População">' + RP.icone('populacao', 'r-populacao') +
      '<span class="rec-num" data-pop data-curto>' + RP.numCurto(r ? r.pop : 0) + '</span></button>';
    if (!opt.semSino) h += '<button class="btn-sino" type="button" data-abrir-notificacoes aria-label="Notificações (' + RP.naoLidas + ' novas)">' +
      RP.icone('sino') + '<span class="contador"' + (RP.naoLidas ? '' : ' hidden') + '>' + RP.naoLidas + '</span></button>';
    return h + '</div>';
  };
  RP.estoqueHTML = function (localId, so) {
    var l = RP.local(localId); if (!l) return '<span class="fraco">vazio</span>';
    var ks = (so || ORDEM_REC.concat(RP.VALIOSOS)).filter(function (k) { return RP.qtdRecurso(k, localId) >= 1; });
    return ks.length ? '<span class="custos">' + ks.map(function (k) {
      return '<span class="custo">' + RP.icone(k, 'ico-p r-' + k) + '<span data-rec="' + k + '" data-local="' + localId + '" data-curto>' + RP.numCurto(RP.qtdRecurso(k, localId)) + '</span></span>';
    }).join('') + '</span>' : '<span class="fraco">vazio</span>';
  };
  RP.folhaRecursos = function () {
    var r = RP.reino; if (!r) return;
    var c = RP.castelo();
    var corpo = '<p class="nota-regra">' + RP.icone('carroca', 'ico-p') + '<span>Recursos ficam <b>onde estão</b>. A barra mostra o estoque do castelo. Obras e recrutamento buscam sozinhos o que falta nos locais mais próximos.</span></p>' +
      '<div class="secao-titulo">No castelo</div><div class="lista">';
    ORDEM_REC.concat(RP.VALIOSOS).forEach(function (k) {
      var q = RP.qtdRecurso(k), tot = RP.totalRecurso(k);
      if (tot < 1 && ORDEM_REC.indexOf(k) < 0) return;
      var cap = c && c.cap && c.cap[k];
      corpo += '<div class="lista-item"><span class="ico-placa">' + RP.icone(k, 'r-' + k) + '</span><div style="flex:1;min-width:0">' +
        '<div class="linha-entre"><b>' + RP.NOMES_REC[k] + '</b><span class="num"><b data-rec="' + k + '">' + RP.num(q) + '</b>' + (cap ? ' <span class="fraco">/ ' + RP.num(cap) + '</span>' : '') + '</span></div>' +
        (cap ? '<div class="barra" style="margin:6px 0 4px"><i style="width:' + Math.min(100, 100 * q / cap).toFixed(1) + '%"></i></div>' : '') +
        '<div class="suave" style="font-size:var(--fs-2)">No reino todo: <span data-rec="' + k + '" data-local="*">' + RP.num(tot) + '</span></div></div></div>';
    });
    corpo += '</div><div class="secao-titulo">Onde estão</div><div class="lista">' + r.locais.filter(function (l) { return l.id !== r.casteloId; }).map(function (l) {
      var t = Object.keys(l.taxa || {});
      return '<div class="lista-item"><span class="ico-placa dono-meu">' + RP.icone(RP.iconeLocal(l)) + '</span><div style="flex:1;min-width:0"><b>' + RP.esc(l.nome) + '</b>' +
        (t.length ? '<small class="fraco"> · +' + RP.num(l.taxa[t[0]]) + ' ' + RP.nomeRecurso(t[0]) + '/h</small>' : '') + '<div>' + RP.estoqueHTML(l.id) + '</div></div></div>';
    }).join('') + '</div>' +
      (RP.sistema('logistica') && RP.telas.caravana ? '<div class="linha" style="margin-top:var(--esp-3)"><a class="btn btn-p" href="#/caravana" style="flex:1">' + RP.icone('carroca') + 'Transportar à mão</a></div>' : '');
    RP.abrirFolha({ titulo: 'Recursos', corpo: corpo, veu: true });
  };
  RP.iconeLocal = function (l) {
    var t = l.tipo || l.local;
    if (t === 'mina' && l.produz === 'pedra') return 'mina';
    return { castelo: 'castelo', vila: 'vila', pasto: 'pasto', serraria: 'serraria', mina: 'mina', quartel: 'quartel', armazem: 'armazem', ferraria: 'ferraria', posto: 'picareta' }[t] || 'castelo';
  };
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-abrir-recursos]')) RP.folhaRecursos();
    else if (e.target.closest('[data-abrir-notificacoes]')) RP.ir(RP.telas.notificacoes ? 'notificacoes' : 'reino');
  });

  /* ---------------------------------------------------------------- sistemas apresentados aos poucos
     Nada é bloqueado: menus de um sistema só aparecem depois do gatilho. O servidor diz quais já
     apareceram em RP.reino.sistemas ({ logistica: true, ... }); sem a informação, tudo aparece. */
  RP.SISTEMAS = {
    logistica: { nome: 'Transporte de recursos', icone: 'carroca', txt: 'Caravanas e carroças para levar recursos à mão.' },
    espionagem: { nome: 'Espionagem', icone: 'batedor', txt: 'Batedores de elite revelam dono, defesa e relíquias de um local.' },
    defesas: { nome: 'Torres de arqueiros', icone: 'torre', txt: 'Arqueiros no alto protegem os locais em volta.' },
    reliquias: { nome: 'Relíquias', icone: 'lendario', txt: 'Uma por reino no mundo; fortalecem um local e atraem confronto.' },
    alianca: { nome: 'Alianças', icone: 'estandarte', txt: 'Reinos aliados pedem recursos uns aos outros.' },
    comercio: { nome: 'Comércio e diplomacia', icone: 'troca', txt: 'Trocas diretas, pactos, resgates e mensageiros para outros reinos.' }
  };
  RP.sistema = function (k) { var s = RP.reino && RP.reino.sistemas; return !s || s[k] !== false; };
  /* ---------------------------------------------------------------- navegação entre telas */
  RP.telas = {};
  var montadas = {}, atual = null;
  RP.registrarTela = function (nome, def) { RP.telas[nome] = def; };

  function rotear() {
    var h = location.hash.replace(/^#\/?/, '') || 'inicio';
    var partes = h.split('?');
    var nome = RP.telas[partes[0]] ? partes[0] : (RP.reino ? 'reino' : 'inicio');
    var params = new URLSearchParams(partes[1] || '');
    var def = RP.telas[nome];
    /* telas do jogo exigem conta e reino; sem eles, vai para a entrada ou a criação */
    if (!def.publica && !RP.conta) { nome = 'inicio'; def = RP.telas[nome]; }
    else if (!def.publica && !def.semReino && !RP.reino) { nome = RP.conta && !RP.conta.reino ? 'criar' : 'inicio'; def = RP.telas[nome]; }
    if (atual && atual !== nome) {
      var ant = RP.telas[atual];
      if (ant.sair) ant.sair();
      montadas[atual].hidden = true;
    }
    RP.fecharFolha();
    RP.$$('.modal-fundo').forEach(function (m) { m.remove(); });
    if (!montadas[nome]) {
      var s = document.createElement('section');
      s.className = 'tela tela-' + nome;
      s.setAttribute('data-tela', nome);
      RP.$('#telas').appendChild(s);
      def.montar(s, params);
      montadas[nome] = s;
    }
    montadas[nome].hidden = false;
    raiz.setAttribute('data-tela', nome);
    raiz.classList.toggle('tela-fixa', !!def.fixa);
    var nav = RP.$('#nav');
    nav.hidden = !def.nav;
    RP.$$('a', nav).forEach(function (a) {
      if (a.getAttribute('data-nav') === (def.secao || nome)) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    if (atual !== nome && !def.fixa) window.scrollTo(0, 0);
    atual = nome;
    if (def.entrar) def.entrar(montadas[nome], params);
    document.dispatchEvent(new CustomEvent('rp:tela', { detail: nome }));
  }
  RP.ir = function (h) { location.hash = '#/' + h; };
  /* descarta uma tela montada para que seja reconstruída na próxima visita */
  RP.invalidarTela = function (nome) {
    if (montadas[nome] && atual !== nome) { montadas[nome].remove(); delete montadas[nome]; }
  };

  RP.rotear = rotear;
  RP.iniciar = function () {
    RP.injetarIcones();
    var nav = RP.$('#nav');
    var itens = [['mapa', 'mapa', 'Mapa'], ['reino', 'castelo', 'Reino'], ['tropas', 'tropas', 'Tropas'], ['relatorios', 'relatorios', 'Relatórios'], ['mais', 'menu', 'Mais']];
    nav.innerHTML = '<div class="nav-itens">' + itens.filter(function (i) { return RP.telas[i[0]]; }).map(function (i) {
      return '<a href="#/' + i[0] + '" data-nav="' + i[0] + '">' + RP.icone(i[1]) + '<span>' + i[2] + '</span></a>';
    }).join('') + '</div>';
    window.addEventListener('hashchange', rotear);
    RP.get('/mundo').then(function (m) { RP.mundo = m; RP.sincronizar(m.agora); RP.hex.configurar(m.cols, m.lins); }).catch(function () { /* sem rede */ })
      .then(function () { return RP.entrarNoJogo(); })
      .then(rotear, rotear);
  };

  /* ---------------------------------------------------------------- sessão
     Descobre a conta logada (cookie) e carrega o reino. Sem sessão, fica na entrada. */
  RP.conta = null;
  RP.entrarNoJogo = function () {
    return RP.get('/conta', { sem401: true }).then(function (c) {
      RP.conta = c;
      if (!c.reino) return null;
      return RP.carregarReino().then(function () { RP.conectarEventos(); });
    }).catch(function () { RP.conta = null; });
  };
  RP.aoSair = function () {
    RP.conta = null; RP.reino = null; RP.desconectarEventos();
    Object.keys(montadas).forEach(function (n) { montadas[n].remove(); delete montadas[n]; });
    atual = null;
    RP.ir('inicio');
  };
  RP.sair = function () { RP.post('/conta/sair').catch(function () { /* ignora */ }).then(RP.aoSair); };
  RP.ouvir('reino', function () { RP.recarregarReino(); });
  RP.ouvir('marchas', function () { RP.recarregarReino(); });
})();
