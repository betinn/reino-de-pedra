/* Reino de Pedra — núcleo do protótipo: direção visual, rotas de tela,
   componentes compartilhados (folha, modal, aviso), timers e barra de recursos. */
(function () {
  'use strict';
  var RP = (window.RP = window.RP || {});
  var raiz = document.documentElement;

  /* ---------------------------------------------------------------- utilidades */
  RP.t0 = Date.now();
  RP.fim = function (seg) { return RP.t0 + seg * 1000; };
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

  /* ---------------------------------------------------------------- reino do jogador (pode vir da criação) */
  RP.estado = { nome: RP.dados.jogador.nome, brasao: RP.dados.jogador.brasao, recemFundado: false };
  try {
    var salvo = JSON.parse(sessionStorage.getItem('rp-reino') || 'null');
    if (salvo && salvo.nome) { RP.estado.nome = salvo.nome; RP.estado.brasao = salvo.brasao; RP.estado.recemFundado = !!salvo.recemFundado; }
  } catch (e) { /* ignora */ }
  RP.salvarReino = function () {
    try { sessionStorage.setItem('rp-reino', JSON.stringify(RP.estado)); } catch (e) { /* ignora */ }
  };
  RP.dados.reinos.meu.nome = RP.estado.nome;
  RP.dados.reinos.meu.brasao = RP.estado.brasao;

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
  RP.emBreve = function (tela) {
    RP.aviso({ titulo: tela, texto: 'Esta tela entra no próximo bloco do protótipo.', icone: 'martelo', tipo: 'alerta' });
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
    var f = fimAbs || RP.fim(seg), ini = f - total * 1000, agora = Date.now();
    var pct = Math.max(0, Math.min(100, (100 * (agora - ini)) / (f - ini)));
    return '<div class="timer">' +
      '<div class="timer-topo"><b>' + rotulo + '</b>' + (ini > agora ? '<span class="selo">Na fila</span>' : '') + '<span class="timer-resta" data-fim="' + f + '">' + RP.fmtResta(f - agora) + '</span></div>' +
      '<div class="barra ' + (extra || '') + '" role="progressbar" aria-label="Progresso: ' + RP.esc(rotulo.replace(/<[^>]+>/g, '').trim()) + '"><i data-ini="' + ini + '" data-barra-fim="' + f + '" style="width:' +
      pct.toFixed(1) + '%"></i></div></div>';
  };
  RP.fimItem = function (it) { return it.fim || RP.fim(it.seg); };
  /* item de fila (obra ou recrutamento): enquanto o material não chega, mostra a espera */
  RP.itemFilaHTML = function (o) {
    var esp = o.aguarda && o.aguarda > Date.now();
    return RP.timerHTML(RP.esc(o.rotulo) + (esp ? ' <span class="selo selo-antigo selo-material">' + RP.icone('carroca') + 'material chega em <span data-fim="' + o.aguarda + '">' + RP.fmtResta(o.aguarda - Date.now()) + '</span></span>' : ''), o.seg, o.total, '', o.fim);
  };
  /* próxima posição livre na fila, respeitando a chegada do material */
  RP.fimNaFila = function (fila, seg, aguarda) {
    var ult = fila.length ? RP.fimItem(fila[fila.length - 1]) : Date.now();
    return Math.max(ult, Date.now(), aguarda || 0) + seg * 1000;
  };
  /* ---------------------------------------------------------------- estoques por local
     Recursos ficam no local onde foram produzidos ou guardados e só podem ser usados ali.
     Para usar em outro lugar, tropas ou carroças precisam levá-los. A população é do reino. */
  RP.SEDE = 'castelo';
  var CAP_LOCAL = { castelo: 3000, armazem: 5000 };
  RP.capLocal = function (id) { return CAP_LOCAL[id] || 2000; };
  function prodLocal(id, k) {
    var x = RP.dados.locais.filter(function (q) { return q.id === id; })[0];
    return x && x.prod && x.prod.r === k ? x.prod.v : 0;
  }
  RP.prodLocal = prodLocal;
  RP.qtdRecurso = function (k, local) {
    if (k === 'populacao') return RP.popAtual();
    if (local === '*') return RP.totalRecurso(k);   /* no reino todo */
    local = local || RP.SEDE;
    var e = RP.dados.estoques[local] || {}, base = e[k] || 0, t = prodLocal(local, k);
    if (!t) return base;
    return Math.max(base, Math.min(RP.capLocal(local), base + (t * (Date.now() - RP.t0)) / 3600000));
  };
  RP.totalRecurso = function (k) { return Object.keys(RP.dados.estoques).reduce(function (s, id) { return s + RP.qtdRecurso(k, id); }, 0); };
  RP.mudarEstoque = function (local, k, delta) {
    var e = RP.dados.estoques[local] = RP.dados.estoques[local] || {};
    var atual = RP.qtdRecurso(k, local), t = prodLocal(local, k);
    /* a produção segue acumulando: guarda a base de forma que o valor atual mude só pelo delta */
    e[k] = atual + delta - (t ? (t * (Date.now() - RP.t0)) / 3600000 : 0);
  };
  RP.nomeRecurso = function (k) {
    if (RP.dados.recursos[k]) return RP.dados.recursos[k].nome.toLowerCase();
    var v = RP.dados.valiosos.filter(function (x) { return x.id === k; })[0];
    return v ? v.nome.toLowerCase() : k === 'populacao' ? 'população' : k;
  };
  RP.custoHTML = function (custo, mult, local) {
    mult = mult || 1;
    return '<span class="custos">' + Object.keys(custo).map(function (k) {
      var v = custo[k] * mult, tem = RP.temRecurso(k, v, local);
      return '<span class="custo' + (tem ? '' : ' falta') + '">' + RP.icone(k === 'populacao' ? 'populacao' : k, 'ico-p r-' + k) + RP.num(v) + '</span>';
    }).join('') + '</span>';
  };
  RP.temRecurso = function (k, v, local) { return RP.qtdRecurso(k, local) >= v; };
  /* o que falta no local, como objeto { recurso: quantidade } */
  RP.faltaObj = function (custo, mult, local) {
    mult = mult || 1;
    var f = {};
    Object.keys(custo).forEach(function (k) { var d = custo[k] * mult - RP.qtdRecurso(k, local); if (d > 0) f[k] = Math.ceil(d); });
    return f;
  };
  RP.faltas = function (custo, mult, local) {
    var f = RP.faltaObj(custo, mult, local);
    return Object.keys(f).map(function (k) { return RP.num(f[k]) + ' ' + RP.nomeRecurso(k); });
  };
  RP.gastar = function (custo, mult, local) {
    mult = mult || 1;
    Object.keys(custo).forEach(function (k) {
      var v = custo[k] * mult;
      if (k === 'populacao') RP.dados.populacao.atual -= v;
      else RP.mudarEstoque(local || RP.SEDE, k, -v);
    });
  };
  /* link para trazer o que falta até um local (abre a caravana já preenchida) */
  RP.linkTrazer = function (local, falta) {
    var leva = Object.keys(falta).filter(function (k) { return k !== 'populacao'; }).map(function (k) { return k + ':' + falta[k]; }).join(',');
    return '#/caravana?para=' + local + (leva ? '&leva=' + leva : '');
  };
  function tique() {
    var agora = Date.now();
    RP.$$('[data-fim]').forEach(function (el) { el.textContent = RP.fmtResta(+el.getAttribute('data-fim') - agora); });
    RP.$$('[data-barra-fim]').forEach(function (el) {
      var i = +el.getAttribute('data-ini'), f = +el.getAttribute('data-barra-fim');
      el.style.width = Math.max(0, Math.min(100, (100 * (agora - i)) / (f - i))).toFixed(2) + '%';
    });
    RP.$$('[data-rec]').forEach(function (el) {
      var q = RP.qtdRecurso(el.getAttribute('data-rec'), el.getAttribute('data-local') || RP.SEDE);
      el.textContent = el.hasAttribute('data-curto') ? RP.numCurto(q) : RP.num(q);
    });
    var p = RP.dados.populacao;
    RP.$$('[data-pop]').forEach(function (el) { el.textContent = el.hasAttribute('data-curto') ? RP.numCurto(RP.popAtual()) : RP.num(RP.popAtual()); });
    document.dispatchEvent(new CustomEvent('rp:tique'));
  }
  RP.popAtual = function () { var p = RP.dados.populacao; return Math.min(p.teto, p.atual + (p.taxa * (Date.now() - RP.t0)) / 3600000); };
  setInterval(tique, 1000);

  /* ---------------------------------------------------------------- barra de recursos */
  var ORDEM_REC = ['madeira', 'pedra', 'comida', 'ferro', 'couro', 'peles'];
  RP.ORDEM_REC = ORDEM_REC;
  RP.barraRecursos = function (opt) {
    opt = opt || {};
    var h = '<div class="recursos" role="group" aria-label="Recursos no Castelo de ' + RP.esc(RP.estado.nome || '') + ' (sede)">';
    ORDEM_REC.forEach(function (k) {
      var r = RP.dados.recursos[k], q = RP.qtdRecurso(k, RP.SEDE);
      h += '<button class="rec' + (q >= RP.capLocal(RP.SEDE) * 0.95 ? ' rec-cheio' : '') + '" type="button" data-abrir-recursos aria-label="' + r.nome + ' no castelo: ' + RP.num(q) + '">' +
        RP.icone(k, 'r-' + k) + '<span class="rec-num" data-rec="' + k + '" data-curto>' + RP.numCurto(q) + '</span></button>';
    });
    h += '<button class="rec" type="button" data-abrir-recursos aria-label="População">' + RP.icone('populacao', 'r-populacao') +
      '<span class="rec-num" data-pop data-curto>' + RP.numCurto(RP.popAtual()) + '</span></button>';
    if (!opt.semSino) h += '<button class="btn-sino" type="button" data-abrir-notificacoes aria-label="Notificações (' + RP.dados.notificacoesNaoLidas + ' novas)">' +
      RP.icone('sino') + '<span class="contador">' + RP.dados.notificacoesNaoLidas + '</span></button>';
    return h + '</div>';
  };
  /* estoque de um local em selos (só o que tem) */
  RP.estoqueHTML = function (local, so) {
    var ks = (so || ORDEM_REC.concat(RP.dados.valiosos.map(function (v) { return v.id; }))).filter(function (k) { return RP.qtdRecurso(k, local) >= 1; });
    return ks.length ? '<span class="custos">' + ks.map(function (k) { return '<span class="custo">' + RP.icone(k, 'ico-p r-' + k) + '<span data-rec="' + k + '" data-local="' + local + '" data-curto>' + RP.numCurto(RP.qtdRecurso(k, local)) + '</span></span>'; }).join('') + '</span>' : '<span class="fraco">vazio</span>';
  };
  RP.folhaRecursos = function () {
    var d = RP.dados, sede = RP.SEDE, corpo = '<p class="nota-regra">' + RP.icone('carroca', 'ico-p') + '<span>Recursos ficam <b>onde estão</b>. A barra mostra o estoque do castelo (sede). Para construir ou recrutar em outro local, leve os recursos até lá com tropas ou carroças.</span></p>' +
      '<div class="secao-titulo">No castelo</div><div class="lista">';
    ORDEM_REC.forEach(function (k) {
      var r = d.recursos[k], q = RP.qtdRecurso(k, sede), tot = RP.totalRecurso(k), pct = (100 * q) / RP.capLocal(sede);
      corpo += '<div class="lista-item"><span class="ico-placa">' + RP.icone(k, 'r-' + k) + '</span><div style="flex:1;min-width:0">' +
        '<div class="linha-entre"><b>' + r.nome + '</b><span class="num"><b data-rec="' + k + '">' + RP.num(q) + '</b> <span class="fraco">/ ' + RP.num(RP.capLocal(sede)) + '</span></span></div>' +
        '<div class="barra" style="margin:6px 0 4px"><i style="width:' + Math.min(100, pct).toFixed(1) + '%"></i></div>' +
        '<div class="linha-entre" style="font-size:var(--fs-2)"><span class="suave">No reino todo: ' + RP.num(tot) + (r.taxa ? ' · +' + r.taxa + '/h nos locais' : r.origem ? ' · ' + r.origem.toLowerCase() : '') + '</span></div></div></div>';
    });
    corpo += '</div><div class="secao-titulo">Onde estão</div><div class="lista">' + d.locais.filter(function (x) { return x.reino === 'meu' && x.id !== sede; }).map(function (x) {
      return '<div class="lista-item"><span class="ico-placa dono-meu">' + RP.icone(x.tipo) + '</span><div style="flex:1;min-width:0"><b>' + RP.esc(x.nome) + '</b>' + (x.prod ? '<small class="fraco"> · +' + x.prod.v + ' ' + RP.nomeRecurso(x.prod.r) + '/h</small>' : '') + '<br>' + RP.estoqueHTML(x.id) + '</div></div>';
    }).join('') + '</div>' +
      '<div class="linha" style="margin-top:var(--esp-3)"><a class="btn btn-p btn-primario" href="#/caravana" style="flex:1">' + RP.icone('carroca') + 'Transportar recursos</a></div>' +
      '<p class="fraco" style="margin-top:var(--esp-4);font-size:var(--fs-2)">Cada local acumula a própria produção. Valiosos e lendários vêm de jazidas descobertas no mapa.</p>';
    RP.abrirFolha({ titulo: 'Recursos', corpo: corpo, veu: true });
  };
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-abrir-recursos]')) RP.folhaRecursos();
    else if (e.target.closest('[data-abrir-notificacoes]')) RP.ir('notificacoes');
    else if (e.target.closest('[data-em-breve]')) RP.emBreve(e.target.closest('[data-em-breve]').getAttribute('data-em-breve'));
  });

  /* ---------------------------------------------------------------- navegação entre telas */
  RP.telas = {};
  var montadas = {}, atual = null;
  RP.registrarTela = function (nome, def) { RP.telas[nome] = def; };

  function rotear() {
    var h = location.hash.replace(/^#\/?/, '') || 'inicio';
    var partes = h.split('?');
    var nome = RP.telas[partes[0]] ? partes[0] : 'inicio';
    var params = new URLSearchParams(partes[1] || '');
    var def = RP.telas[nome];
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

  RP.iniciar = function () {
    RP.injetarIcones();
    var nav = RP.$('#nav');
    var itens = [['mapa', 'mapa', 'Mapa'], ['reino', 'castelo', 'Reino'], ['tropas', 'tropas', 'Tropas'], ['relatorios', 'relatorios', 'Relatórios'], ['mais', 'menu', 'Mais']];
    nav.innerHTML = '<div class="nav-itens">' + itens.map(function (i) {
      return '<a href="#/' + i[0] + '" data-nav="' + i[0] + '">' + RP.icone(i[1]) + '<span>' + i[2] + '</span></a>';
    }).join('') + '</div>';
    window.addEventListener('hashchange', rotear);
    rotear();
  };
})();
