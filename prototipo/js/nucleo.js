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
    if (horas < 1) return 'há instantes';
    if (horas < 48) return 'há ' + Math.round(horas) + ' h';
    return 'há ' + Math.round(horas / 24) + ' dias';
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
  RP.timerHTML = function (rotulo, seg, total, extra) {
    var ini = RP.fim(seg - total), f = RP.fim(seg);
    return '<div class="timer">' +
      '<div class="timer-topo"><b>' + rotulo + '</b><span class="timer-resta" data-fim="' + f + '">' + RP.fmtResta(f - Date.now()) + '</span></div>' +
      '<div class="barra ' + (extra || '') + '" role="progressbar" aria-label="Progresso: ' + RP.esc(rotulo.replace(/<[^>]+>/g, '').trim()) + '"><i data-ini="' + ini + '" data-barra-fim="' + f + '" style="width:' +
      (100 * (1 - seg / total)).toFixed(1) + '%"></i></div></div>';
  };
  function tique() {
    var agora = Date.now();
    RP.$$('[data-fim]').forEach(function (el) { el.textContent = RP.fmtResta(+el.getAttribute('data-fim') - agora); });
    RP.$$('[data-barra-fim]').forEach(function (el) {
      var i = +el.getAttribute('data-ini'), f = +el.getAttribute('data-barra-fim');
      el.style.width = Math.min(100, (100 * (agora - i)) / (f - i)).toFixed(2) + '%';
    });
    RP.$$('[data-rec]').forEach(function (el) {
      var r = RP.dados.recursos[el.getAttribute('data-rec')];
      el.textContent = el.hasAttribute('data-curto') ? RP.numCurto(RP.qtdAtual(r)) : RP.num(RP.qtdAtual(r));
    });
    var p = RP.dados.populacao;
    RP.$$('[data-pop]').forEach(function (el) { el.textContent = el.hasAttribute('data-curto') ? RP.numCurto(RP.popAtual()) : RP.num(RP.popAtual()); });
    document.dispatchEvent(new CustomEvent('rp:tique'));
  }
  RP.qtdAtual = function (r) { return Math.min(r.cap, r.qtd + (r.taxa * (Date.now() - RP.t0)) / 3600000); };
  RP.popAtual = function () { var p = RP.dados.populacao; return Math.min(p.teto, p.atual + (p.taxa * (Date.now() - RP.t0)) / 3600000); };
  setInterval(tique, 1000);

  /* ---------------------------------------------------------------- barra de recursos */
  var ORDEM_REC = ['madeira', 'pedra', 'comida', 'ferro', 'couro', 'peles'];
  RP.ORDEM_REC = ORDEM_REC;
  RP.barraRecursos = function (opt) {
    opt = opt || {};
    var h = '<div class="recursos" role="group" aria-label="Recursos do reino">';
    ORDEM_REC.forEach(function (k) {
      var r = RP.dados.recursos[k], q = RP.qtdAtual(r);
      h += '<button class="rec' + (q >= r.cap * 0.95 ? ' rec-cheio' : '') + '" type="button" data-abrir-recursos aria-label="' + r.nome + ': ' + RP.num(q) + '">' +
        RP.icone(k, 'r-' + k) + '<span class="rec-num" data-rec="' + k + '" data-curto>' + RP.numCurto(q) + '</span></button>';
    });
    h += '<button class="rec" type="button" data-abrir-recursos aria-label="População">' + RP.icone('populacao', 'r-populacao') +
      '<span class="rec-num" data-pop data-curto>' + RP.numCurto(RP.popAtual()) + '</span></button>';
    if (!opt.semSino) h += '<button class="btn-sino" type="button" data-abrir-notificacoes aria-label="Notificações (' + RP.dados.notificacoesNaoLidas + ' novas)">' +
      RP.icone('sino') + '<span class="contador">' + RP.dados.notificacoesNaoLidas + '</span></button>';
    return h + '</div>';
  };
  RP.folhaRecursos = function (sobreNav) {
    var d = RP.dados, corpo = '<div class="lista">';
    ORDEM_REC.forEach(function (k) {
      var r = d.recursos[k], q = RP.qtdAtual(r), pct = (100 * q) / r.cap;
      corpo += '<div class="lista-item"><span class="ico-placa">' + RP.icone(k, 'r-' + k) + '</span><div style="flex:1;min-width:0">' +
        '<div class="linha-entre"><b>' + r.nome + '</b><span class="num"><b data-rec="' + k + '">' + RP.num(q) + '</b> <span class="fraco">/ ' + RP.num(r.cap) + '</span></span></div>' +
        '<div class="barra" style="margin:6px 0 4px"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
        '<div class="linha-entre" style="font-size:var(--fs-2)"><span class="suave">' + (r.taxa ? '+' + r.taxa + '/h' : r.origem) + '</span>' +
        (pct >= 95 ? '<span class="selo selo-antigo">Armazém quase cheio</span>' : '') + '</div></div></div>';
    });
    corpo += '</div><div class="secao-titulo">Valiosos</div><div class="linha" style="flex-wrap:wrap">';
    d.valiosos.forEach(function (v) {
      corpo += '<span class="selo selo-destaque" style="font-size:var(--fs-2);min-height:32px">' + RP.icone(v.id, 'r-' + v.id) + v.nome + ' <b class="num">' + v.qtd + '</b></span>';
    });
    corpo += '</div><p class="fraco" style="margin-top:var(--esp-4);font-size:var(--fs-2)">O reino base já produz recursos básicos. Valiosos e lendários vêm de jazidas descobertas no mapa.</p>';
    RP.abrirFolha({ titulo: 'Recursos', corpo: corpo, veu: true });
  };
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-abrir-recursos]')) RP.folhaRecursos();
    else if (e.target.closest('[data-abrir-notificacoes]')) RP.emBreve('Notificações');
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
