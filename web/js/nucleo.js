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
  /* Todas as formatações de tempo aguentam valor vazio ou inválido: nunca mostram NaN nem "Invalid Date". */
  RP.fmtResta = function (ms) {
    if (ms == null || !isFinite(+ms)) return '—';
    var s = Math.max(0, Math.round(+ms / 1000));
    if (s <= 0) return 'concluído';
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    if (h > 0) return h + ' h ' + String(m).padStart(2, '0') + ' min';
    return String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
  };
  RP.fmtHa = function (horas) {
    if (horas == null || !isFinite(+horas)) return 'há algum tempo';
    if (horas < 1) return horas * 60 >= 1 ? 'há ' + Math.round(horas * 60) + ' min' : 'há instantes';
    if (horas < 48) return 'há ' + Math.round(horas) + ' h';
    return 'há ' + Math.round(horas / 24) + ' dias';
  };
  /* horário absoluto legível: "hoje às 14:20", "amanhã às 06:40" */
  RP.fmtHora = function (ms) {
    if (ms == null || !isFinite(+ms) || +ms <= 0) return 'em breve';
    var d = new Date(+ms), hoje = new Date(), am = new Date(); am.setDate(hoje.getDate() + 1);
    var hh = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    if (d.toDateString() === hoje.toDateString()) return 'hoje às ' + hh;
    if (d.toDateString() === am.toDateString()) return 'amanhã às ' + hh;
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }) + ' às ' + hh;
  };
  RP.fmtDuracao = function (seg) {
    if (seg == null || !isFinite(+seg)) return '—';
    seg = Math.max(0, +seg);
    var h = Math.floor(seg / 3600), m = Math.round((seg % 3600) / 60);
    if (!h && !m) return seg >= 1 ? Math.round(seg) + ' s' : 'agora';
    if (h >= 48) return Math.round(h / 24) + ' dias';
    return h ? h + ' h' + (m ? ' ' + m + ' min' : '') : m + ' min';
  };
  /* "pronto em 5 min" / "em 2 h 10 min" a partir de um instante absoluto (ms do servidor) */
  RP.fmtEm = function (ms) {
    if (ms == null || !isFinite(+ms)) return 'em breve';
    var s = (+ms - RP.agora()) / 1000;
    return s <= 0 ? 'agora' : 'em ' + RP.fmtDuracao(s);
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
    var pts = new Map(), arr = null, pin = null, toq = null, meio = null;
    function rel(e) { var r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    /* botão do meio do mouse: arrastar inclina a câmera (sem o rolar automático do navegador) */
    el.addEventListener('mousedown', function (e) { if (e.button === 1) e.preventDefault(); });
    el.addEventListener('auxclick', function (e) { if (e.button === 1) e.preventDefault(); });
    el.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button === 1) {
        e.preventDefault();
        if (!h.inclinar) return;
        try { el.setPointerCapture(e.pointerId); } catch (er) { /* ignora */ }
        meio = { id: e.pointerId, y: e.clientY };
        return;
      }
      if (e.isPrimary) { pts.clear(); pin = null; } /* novo gesto: descarta ponteiros que não terminaram */
      try { el.setPointerCapture(e.pointerId); } catch (er) { /* ignora */ }
      pts.set(e.pointerId, rel(e));
      if (h.inicio) h.inicio();
      if (pts.size === 1) { var p = rel(e); arr = p; toq = { x: p.x, y: p.y, cx: e.clientX, cy: e.clientY, t: performance.now(), movido: false }; }
      else if (pts.size === 2) {
        var a = Array.from(pts.values());
        pin = { d: Math.max(1, Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y)), mx: (a[0].x + a[1].x) / 2, my: (a[0].y + a[1].y) / 2, ultMy: (a[0].y + a[1].y) / 2, modo: null };
        toq = null; arr = null;
        if (h.inicioPinca) h.inicioPinca();
      }
    });
    el.addEventListener('pointermove', function (e) {
      if (meio && e.pointerId === meio.id) { h.inclinar(e.clientY - meio.y); meio.y = e.clientY; return; }
      if (!pts.has(e.pointerId)) return;
      var p = rel(e);
      pts.set(e.pointerId, p);
      if (pin && pts.size >= 2) {
        var a = Array.from(pts.values());
        var d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), my = (a[0].y + a[1].y) / 2;
        /* dois dedos: a distância muda → zoom (pinça); os dois sobem ou descem juntos → inclinar. Decide uma vez por gesto. */
        if (!pin.modo && h.inclinar) {
          if (Math.abs(d - pin.d) > 14) pin.modo = 'pinca';
          else if (Math.abs(my - pin.my) > 14) pin.modo = 'inclinar';
        }
        if (pin.modo === 'inclinar') { h.inclinar(my - pin.ultMy); pin.ultMy = my; return; }
        pin.ultMy = my;
        if (pin.modo === 'pinca' || !h.inclinar) h.pinca(d / pin.d, (a[0].x + a[1].x) / 2, my, pin.mx, pin.my);
      } else if (arr) {
        var dx = p.x - arr.x, dy = p.y - arr.y;
        if (toq && Math.hypot(p.x - toq.x, p.y - toq.y) > 8) toq.movido = true;
        if (!toq || toq.movido) { h.arrasto(dx, dy); arr = p; }
      }
    });
    function fim(e) {
      if (meio && e.pointerId === meio.id) { meio = null; if (h.fim) h.fim(); return; }
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

  /* ---------------------------------------------------------------- avisos (toasts)
     Pequenos, num canto, no máximo 3 de cada vez e somem sozinhos: o centro do jogo fica livre. */
  RP.aviso = function (o) {
    var box = RP.$('#avisos');
    while (box.children.length >= 3) box.firstChild.remove();
    var el = document.createElement('div');
    el.className = 'aviso aviso-' + (o.tipo || 'info');
    el.setAttribute('role', o.tipo === 'perigo' ? 'alert' : 'status');
    el.innerHTML = RP.icone(o.icone || 'info', '', '') + '<div><b>' + RP.esc(o.titulo) + '</b>' + (o.texto ? '<span>' + RP.esc(o.texto) + '</span>' : '') + '</div>';
    box.appendChild(el);
    var sair = function () { el.classList.add('sai'); setTimeout(function () { el.remove(); }, 240); };
    el.addEventListener('click', sair);
    setTimeout(sair, o.ms || (o.texto ? 3600 : 2400));
  };

  /* ---------------------------------------------------------------- folha (painel de seleção)
     Painel baixo no celular e coluna lateral no computador, nunca a tela toda e sem véu escuro sobre o jogo.
     Mostra no máximo 3 ações; as demais ficam em "Mais ações". A ação principal (btn-primario) vem primeiro. */
  var folha = null, aoFecharFolha = null, folhaAbertaEstado = false;
  function limitarAcoes(html) {
    if (!html) return '';
    var t = document.createElement('div'); t.innerHTML = html;
    var btns = Array.prototype.filter.call(t.children, function (el) { return el.classList.contains('btn'); });
    var pri = btns.filter(function (b) { return b.classList.contains('btn-primario'); })[0];
    if (pri && t.firstElementChild !== pri) t.insertBefore(pri, t.firstElementChild);
    btns = Array.prototype.filter.call(t.children, function (el) { return el.classList.contains('btn'); });
    if (btns.length <= 3) return t.innerHTML;
    var mais = document.createElement('div'); mais.className = 'folha-mais'; mais.hidden = true;
    btns.slice(2).forEach(function (b) { mais.appendChild(b); });
    var bt = document.createElement('button'); bt.type = 'button'; bt.className = 'btn btn-p btn-fantasma';
    bt.setAttribute('data-folha-mais', ''); bt.setAttribute('aria-expanded', 'false');
    bt.innerHTML = RP.icone('menu') + 'Mais ações';
    t.appendChild(bt); t.appendChild(mais);
    return t.innerHTML;
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-folha-mais]'); if (!b) return;
    var box = b.parentNode.querySelector('.folha-mais'), ab = box.hidden;
    box.hidden = !ab; b.setAttribute('aria-expanded', String(ab));
    b.innerHTML = RP.icone(ab ? 'fechar' : 'menu') + (ab ? 'Menos' : 'Mais ações');
  });
  function garantirFolha() {
    if (folha) return;
    folha = document.createElement('section');
    folha.className = 'folha';
    folha.setAttribute('role', 'dialog');
    folha.setAttribute('aria-modal', 'false');
    document.body.appendChild(folha);
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
    var acoes = limitarAcoes(o.acoes);
    folha.innerHTML =
      '<div class="folha-pega" aria-hidden="true"></div>' +
      '<header class="folha-topo">' + (o.icone || '') +
      '<div class="folha-titulos"><h2 id="folha-titulo">' + o.titulo + '</h2>' + (o.subtitulo ? '<div class="folha-sub">' + o.subtitulo + '</div>' : '') + '</div>' +
      '<button class="btn btn-fantasma btn-icone" type="button" data-fechar-folha aria-label="Fechar">' + RP.icone('fechar') + '</button></header>' +
      '<div class="folha-corpo">' + (o.corpo || '') + '</div>' +
      (acoes ? '<footer class="folha-acoes">' + acoes + '</footer>' : '');
    folha.setAttribute('aria-labelledby', 'folha-titulo');
    aoFecharFolha = o.aoFechar || null;
    folhaAbertaEstado = true;
    raiz.classList.add('com-folha');
    requestAnimationFrame(function () { folha.classList.add('aberta'); });
    RP.$('[data-fechar-folha]', folha).addEventListener('click', function () { RP.fecharFolha(); });
    folha.scrollTop = 0; var corpo = RP.$('.folha-corpo', folha); if (corpo) corpo.scrollTop = 0;
    return folha;
  };
  RP.fecharFolha = function () {
    if (!folha) return;
    folhaAbertaEstado = false;
    folha.classList.remove('aberta');
    raiz.classList.remove('com-folha');
    if (aoFecharFolha) { var f = aoFecharFolha; aoFecharFolha = null; f(false); }
  };
  RP.folhaAberta = function () { return folhaAbertaEstado; };
  /* troca só o corpo (e as ações) da folha aberta, sem fechar nem animar */
  RP.atualizarFolha = function (corpo, acoes) {
    if (!folha || !folhaAbertaEstado) return;
    var c = RP.$('.folha-corpo', folha); if (c && corpo != null) c.innerHTML = corpo;
    var a = RP.$('.folha-acoes', folha);
    if (acoes != null) { if (a) a.innerHTML = limitarAcoes(acoes); else if (acoes) { a = document.createElement('footer'); a.className = 'folha-acoes'; a.innerHTML = limitarAcoes(acoes); folha.appendChild(a); } }
  };

  /* ---------------------------------------------------------------- confirmação curta
     Fica no mesmo lugar da folha (embaixo no celular, na coluna no computador), sem escurecer o jogo. */
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
  /* ---------------------------------------------------------------- produção do reino
     Soma das taxas por hora de todos os locais; "quando enche" é o primeiro local que chega à capacidade. */
  RP.producao = function (k) {
    var r = RP.reino; if (!r) return 0;
    return (r.locais || []).reduce(function (s, l) { return s + ((l.taxa || {})[k] || 0); }, 0);
  };
  RP.capacidade = function (k) {
    var r = RP.reino; if (!r) return 0;
    return (r.locais || []).reduce(function (s, l) { return s + ((l.cap || {})[k] || 0); }, 0);
  };
  /* ms até o primeiro local produtor de k encher (null se nada produz ou nada enche) */
  RP.encheEm = function (k) {
    var r = RP.reino; if (!r) return null;
    var min = null;
    (r.locais || []).forEach(function (l) {
      var t = (l.taxa || {})[k], cap = (l.cap || {})[k];
      if (!t || !cap) return;
      var ms = Math.max(0, (cap - RP.qtdRecurso(k, l.id)) / t * 3600000);
      if (min === null || ms < min) min = ms;
    });
    return min;
  };
  /* ms até o reino ter qtd de k pela produção atual (0 se já tem; Infinity se nada produz) */
  RP.tempoParaTer = function (k, qtd, local) {
    var falta = qtd - RP.qtdRecurso(k, local || '*');
    if (falta <= 0) return 0;
    var t = RP.producao(k);
    return t > 0 ? falta / t * 3600000 : Infinity;
  };
  RP.fmtTempoParaTer = function (ms) {
    if (ms === 0) return 'agora';
    if (!isFinite(ms)) return 'nada produz isso';
    return 'em ' + RP.fmtDuracao(ms / 1000);
  };
  /* "faltam 120 madeira · pronto em 12 min" (ou vazio se nada falta) */
  RP.faltaHTML = function (custo, mult, local) {
    mult = mult || 1;
    var falta = [], pior = 0;
    Object.keys(custo || {}).forEach(function (k) {
      if (k === 'populacao') { if ((RP.reino ? RP.reino.pop : 0) < custo[k] * mult) falta.push('gente'); return; }
      var f = custo[k] * mult - RP.qtdRecurso(k, local || '*');
      if (f <= 0) return;
      falta.push(RP.num(Math.ceil(f)) + ' ' + RP.nomeRecurso(k));
      pior = Math.max(pior, RP.tempoParaTer(k, custo[k] * mult, local));
    });
    if (!falta.length) return '';
    return '<span class="custo-falta">' + RP.icone('relogio', 'ico-p') + 'faltam ' + RP.esc(falta.join(', ')) + (pior ? ' · pronto ' + RP.fmtTempoParaTer(pior) : '') + '</span>';
  };
  /* custo em selos; marca em vermelho o que falta no reino todo (o material vem sozinho dos locais) e diz quando dá */
  RP.custoHTML = function (custo, mult, local, semFalta) {
    mult = mult || 1;
    return '<span class="custos">' + Object.keys(custo || {}).map(function (k) {
      var v = custo[k] * mult, tem = RP.temRecurso(k, v, local);
      return '<span class="custo' + (tem ? '' : ' falta') + '">' + RP.icone(k === 'populacao' ? 'populacao' : k, 'ico-p r-' + k) + RP.num(v) + '</span>';
    }).join('') + (semFalta ? '' : RP.faltaHTML(custo, mult, local)) + '</span>';
  };
  RP.faltas = function (custo, mult, local) {
    mult = mult || 1;
    return Object.keys(custo || {}).filter(function (k) { return RP.qtdRecurso(k, local || '*') < custo[k] * mult; })
      .map(function (k) { return RP.num(Math.ceil(custo[k] * mult - RP.qtdRecurso(k, local || '*'))) + ' ' + RP.nomeRecurso(k); });
  };
  /* ---------------------------------------------------------------- carga de uma tropa (o mesmo desenho em todas as telas)
     "Carga: 40 de couro, 10 de peles · 130 de 300 (170 livres)" com barra; vazia: "Carga: vazia · 300 livres". */
  RP.cargaTexto = function (carga) {
    var ks = Object.keys(carga || {}).filter(function (k) { return carga[k] >= 1; });
    return ks.length ? ks.map(function (k) { return RP.num(carga[k]) + ' de ' + RP.nomeRecurso(k); }).join(', ') : 'vazia';
  };
  RP.cargaUsada = function (carga) { return Object.keys(carga || {}).reduce(function (s, k) { return s + (carga[k] || 0); }, 0); };
  RP.cargaHTML = function (carga, max, opt) {
    opt = opt || {};
    var usada = RP.cargaUsada(carga), cap = max || 0, livre = Math.max(0, cap - usada);
    var pct = cap ? Math.min(100, 100 * usada / cap) : 0, cls = pct >= 99.5 ? 'cheia' : usada > 0 ? 'parcial' : 'vazia';
    return '<div class="carga carga-' + cls + '">' +
      '<div class="carga-topo"><span>' + (opt.rotulo || 'Carga') + ': <b>' + RP.esc(RP.cargaTexto(carga)) + '</b></span>' +
      '<span class="num fraco">' + (cap ? (usada > 0 ? RP.num(usada) + ' de ' + RP.num(cap) + ' · ' : '') + RP.num(livre) + ' livres' : '') + '</span></div>' +
      (cap ? '<div class="barra" role="progressbar" aria-label="Carga: ' + Math.round(pct) + '%"><i style="width:' + pct.toFixed(0) + '%"></i></div>' : '') +
      (opt.extra ? '<small class="fraco">' + opt.extra + '</small>' : '') + '</div>';
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
  /* resumo da produção do reino por recurso: estoque, por hora, por minuto e quando enche; e a conta "quero X" */
  RP.producaoHTML = function (opt) {
    opt = opt || {};
    var r = RP.reino; if (!r) return '';
    var h = '<div class="prod-tabela" role="table" aria-label="Produção do reino">' +
      '<div class="prod-cab" role="row"><span>Recurso</span><span>Tenho</span><span>Por hora</span><span>Enche</span></div>';
    ORDEM_REC.concat(RP.VALIOSOS).forEach(function (k) {
      var tot = RP.totalRecurso(k), taxa = RP.producao(k);
      if (tot < 1 && !taxa && ORDEM_REC.indexOf(k) < 0) return;
      var enche = RP.encheEm(k);
      h += '<button type="button" class="prod-linha" role="row" data-prod-rec="' + k + '" aria-pressed="' + (opt.rec === k) + '">' +
        '<span>' + RP.icone(k, 'ico-p r-' + k) + RP.NOMES_REC[k] + '</span>' +
        '<span class="num"><b data-rec="' + k + '" data-local="*">' + RP.num(tot) + '</b></span>' +
        '<span class="num">' + (taxa ? '+' + RP.num(taxa) + '<small class="fraco"> · ' + (taxa / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '/min</small>' : '<span class="fraco">—</span>') + '</span>' +
        '<span class="num fraco">' + (enche === null ? '—' : enche <= 0 ? '<span class="txt-alerta">cheio</span>' : RP.fmtDuracao(enche / 1000)) + '</span></button>';
    });
    return h + '</div>';
  };
  RP.contaRecursoHTML = function (k, qtd) {
    k = k || 'madeira'; qtd = qtd || '';
    return '<form class="conta-rec" data-conta-rec><label class="rotulo" for="conta-qtd">Quando terei…</label><div class="linha">' +
      '<input id="conta-qtd" name="qtd" type="number" inputmode="numeric" min="1" placeholder="1000" value="' + RP.esc(qtd) + '" aria-label="Quantidade">' +
      '<select name="rec" aria-label="Recurso">' + ORDEM_REC.concat(RP.VALIOSOS).filter(function (x) { return ORDEM_REC.indexOf(x) >= 0 || RP.producao(x) > 0; }).map(function (x) { return '<option value="' + x + '"' + (x === k ? ' selected' : '') + '>' + RP.NOMES_REC[x] + '</option>'; }).join('') + '</select>' +
      '</div><output class="conta-saida" aria-live="polite">' + (qtd ? RP.esc(contaTexto(k, +qtd)) : 'Digite uma quantidade.') + '</output></form>';
  };
  function contaTexto(k, qtd) {
    if (!qtd || qtd <= 0) return 'Digite uma quantidade.';
    var ms = RP.tempoParaTer(k, qtd), tem = RP.totalRecurso(k);
    if (ms === 0) return 'Você já tem ' + RP.num(tem) + ' de ' + RP.nomeRecurso(k) + '.';
    if (!isFinite(ms)) return 'Nenhum local produz ' + RP.nomeRecurso(k) + ' agora.';
    return RP.num(qtd) + ' de ' + RP.nomeRecurso(k) + ' ' + RP.fmtTempoParaTer(ms) + ' (tem ' + RP.num(tem) + ', +' + RP.num(RP.producao(k)) + '/h).';
  }
  document.addEventListener('input', function (e) {
    var f = e.target.closest('[data-conta-rec]'); if (!f) return;
    RP.$('.conta-saida', f).textContent = contaTexto(f.rec.value, +f.qtd.value);
  });
  document.addEventListener('submit', function (e) { if (e.target.closest('[data-conta-rec]')) e.preventDefault(); });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-prod-rec]'); if (!b) return;
    var f = RP.$('[data-conta-rec]'); if (!f) return;
    f.rec.value = b.getAttribute('data-prod-rec'); f.qtd.focus();
    RP.$('.conta-saida', f).textContent = contaTexto(f.rec.value, +f.qtd.value);
  });
  RP.folhaRecursos = function () {
    var r = RP.reino; if (!r) return;
    var corpo = RP.producaoHTML() + RP.contaRecursoHTML() +
      '<details class="detalhe"><summary>Onde estão os recursos</summary>' +
      '<p class="fraco" style="font-size:var(--fs-2)">Recursos ficam onde são produzidos. Obras e recrutamento buscam sozinhos o que falta nos locais mais próximos; a barra do topo mostra o castelo.</p><div class="lista">' +
      r.locais.map(function (l) {
        var t = Object.keys(l.taxa || {});
        return '<div class="lista-item"><span class="ico-placa dono-meu">' + RP.icone(RP.iconeLocal(l)) + '</span><div style="flex:1;min-width:0"><b>' + RP.esc(l.nome) + '</b>' +
          (t.length && l.tipo !== 'castelo' ? '<small class="fraco"> · +' + RP.num(l.taxa[t[0]]) + ' ' + RP.nomeRecurso(t[0]) + '/h</small>' : '') + '<div>' + RP.estoqueHTML(l.id) + '</div></div></div>';
      }).join('') + '</div></details>';
    RP.abrirFolha({
      titulo: 'Recursos e produção', subtitulo: '<span class="fraco">Reino todo · toque num recurso para calcular</span>',
      icone: '<span class="ico-placa folha-ico">' + RP.icone('madeira', 'r-madeira') + '</span>', corpo: corpo,
      acoes: (RP.sistema('logistica') && RP.telas.caravana ? '<a class="btn btn-p" href="#/caravana">' + RP.icone('carroca') + 'Transportar à mão</a>' : '')
    });
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
  /* ---------------------------------------------------------------- navegação entre telas
     O jogo nunca fica escondido: a tela de fundo (o mundo, "mapa") é montada uma vez em #mundo e segue
     rodando. As outras telas são painéis em #telas (painel baixo no celular, coluna no computador), que
     nunca cobrem o mundo inteiro. Telas públicas (entrada, criação) ocupam a tela toda, sem mundo. */
  RP.telas = {};
  var montadas = {}, atual = null, fundoNome = null;
  RP.registrarTela = function (nome, def) { RP.telas[nome] = def; if (def.fundo) fundoNome = nome; };

  function garantirFundo(params) {
    var def = RP.telas[fundoNome];
    if (!def || !RP.reino) return null;
    if (!montadas[fundoNome]) {
      var s = document.createElement('section');
      s.className = 'tela tela-' + fundoNome;
      s.setAttribute('data-tela', fundoNome);
      RP.$('#mundo').appendChild(s);
      def.montar(s, params);
      montadas[fundoNome] = s;
      RP.$('#mundo').hidden = false;
      if (def.entrar) def.entrar(s, params || new URLSearchParams(''));
    }
    RP.$('#mundo').hidden = false;
    return montadas[fundoNome];
  }
  function rotear() {
    var h = location.hash.replace(/^#\/?/, '') || 'inicio';
    var partes = h.split('?');
    var nome = RP.telas[partes[0]] ? partes[0] : (RP.reino ? 'reino' : 'inicio');
    var params = new URLSearchParams(partes[1] || '');
    var def = RP.telas[nome];
    /* telas do jogo exigem conta e reino; sem eles, vai para a entrada ou a criação */
    if (!def.publica && !RP.conta) { nome = 'inicio'; def = RP.telas[nome]; }
    else if (!def.publica && !def.semReino && !RP.reino) { nome = RP.conta && !RP.conta.reino ? 'criar' : 'inicio'; def = RP.telas[nome]; }
    var cheia = !!def.publica || !!def.semReino || !RP.reino;
    if (atual && atual !== nome && !RP.telas[atual].fundo) {
      var ant = RP.telas[atual];
      if (ant.sair) ant.sair();
      montadas[atual].hidden = true;
    }
    RP.fecharFolha();
    RP.$$('.modal-fundo').forEach(function (m) { m.remove(); });
    raiz.classList.toggle('jogo', !cheia);
    raiz.classList.toggle('tela-cheia', cheia);
    if (cheia) RP.$('#mundo').hidden = true;
    else if (!def.fundo) garantirFundo();
    if (def.fundo) {
      var jaMontado = !!montadas[fundoNome];
      garantirFundo(params);
      if (jaMontado && def.entrar) def.entrar(montadas[fundoNome], params);
      RP.painel.fechar();
    } else {
      if (!montadas[nome]) {
        var s = document.createElement('section');
        s.className = 'tela tela-' + nome;
        s.setAttribute('data-tela', nome);
        RP.$('#telas').appendChild(s);
        def.montar(s, params);
        montadas[nome] = s;
      }
      montadas[nome].hidden = false;
      if (!cheia) RP.painel.abrir();
    }
    raiz.setAttribute('data-tela', nome);
    var nav = RP.$('#nav');
    nav.hidden = !def.nav && !(def.secao && !cheia);
    RP.$$('a', nav).forEach(function (a) {
      if (a.getAttribute('data-nav') === (def.secao || nome)) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    if (atual !== nome) { window.scrollTo(0, 0); var t = RP.$('#telas'); if (t) t.scrollTop = 0; if (montadas[nome]) montadas[nome].scrollTop = 0; }
    atual = nome;
    if (def.entrar && !def.fundo) def.entrar(montadas[nome], params);
    document.dispatchEvent(new CustomEvent('rp:tela', { detail: nome }));
    RP.painel.redimensionado();
  }
  RP.ir = function (h) { location.hash = '#/' + h; };
  RP.telaAtual = function () { return atual; };
  /* descarta uma tela montada para que seja reconstruída na próxima visita */
  RP.invalidarTela = function (nome) {
    if (montadas[nome] && atual !== nome) { montadas[nome].remove(); delete montadas[nome]; }
  };

  /* ---------------------------------------------------------------- painel (as telas que não são o mundo)
     Aberto: ocupa até ~42% da altura no celular, ou uma coluna à direita no computador.
     Recolhido: vira uma barra pequena com o título; o mundo fica inteiro à vista. */
  RP.painel = {
    aberto: false, recolhido: false,
    abrir: function () { this.aberto = true; this.recolhido = false; aplicarPainel(); },
    fechar: function () { this.aberto = false; this.recolhido = false; aplicarPainel(); },
    recolher: function () { if (!this.aberto) return; this.recolhido = true; aplicarPainel(); },
    expandir: function () { if (!this.aberto) return; this.recolhido = false; aplicarPainel(); },
    alternar: function () { if (this.recolhido) this.expandir(); else this.recolher(); },
    /* o mundo mudou de tamanho (coluna abriu/fechou): quem desenha o mundo se ajusta */
    redimensionado: function () { requestAnimationFrame(function () { window.dispatchEvent(new Event('resize')); }); }
  };
  function tituloPainel() {
    var sec = atual && montadas[atual], h1 = sec && sec.querySelector('h1');
    return h1 ? h1.textContent.trim() : '';
  }
  function aplicarPainel() {
    raiz.classList.toggle('painel-aberto', RP.painel.aberto && !RP.painel.recolhido);
    raiz.classList.toggle('painel-recolhido', RP.painel.aberto && RP.painel.recolhido);
    var barra = RP.$('#painel-barra');
    if (barra) {
      barra.hidden = !(RP.painel.aberto && RP.painel.recolhido);
      var t = RP.$('span', barra); if (t) t.textContent = tituloPainel() || 'Voltar ao painel';
    }
    RP.painel.redimensionado();
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('#painel-barra')) RP.painel.expandir();
    else if (e.target.closest('[data-painel-recolher]')) RP.painel.recolher();
  });
  /* arrastar a pega do painel para baixo recolhe (celular) */
  function gestoPainel(el) {
    var y0 = null, dy = 0;
    el.addEventListener('pointerdown', function (e) {
      if (!e.target.closest('.painel-pega')) return;
      y0 = e.clientY; dy = 0; try { el.setPointerCapture(e.pointerId); } catch (x) { /* ignora */ }
    });
    el.addEventListener('pointermove', function (e) { if (y0 !== null) dy = e.clientY - y0; });
    var solta = function () { if (y0 === null) return; if (dy > 50) RP.painel.recolher(); y0 = null; };
    el.addEventListener('pointerup', solta); el.addEventListener('pointercancel', solta);
  }

  RP.rotear = rotear;
  RP.NAV = [
    { tela: 'mapa', icone: 'mapa', rotulo: 'Mapa', cor: 'mapa' },
    { tela: 'reino', icone: 'castelo', rotulo: 'Reino', cor: 'reino' },
    { tela: 'tropas', icone: 'tropas', rotulo: 'Exército', cor: 'tropas' },
    { tela: 'agora', icone: 'sino', rotulo: 'Atenção', cor: 'agora', contador: true },
    { tela: 'mais', icone: 'menu', rotulo: 'Mais', cor: 'mais' }
  ];
  RP.iniciar = function () {
    RP.injetarIcones();
    var nav = RP.$('#nav');
    nav.innerHTML = '<div class="nav-itens">' + RP.NAV.filter(function (i) { return RP.telas[i.tela]; }).map(function (i) {
      return '<a href="#/' + i.tela + '" data-nav="' + i.tela + '" class="nav-' + i.cor + '">' + RP.icone(i.icone) + '<span>' + i.rotulo + '</span>' +
        (i.contador ? '<span class="contador" data-nav-contador hidden>0</span>' : '') + '</a>';
    }).join('') + '</div>';
    var telas = RP.$('#telas');
    telas.insertAdjacentHTML('afterbegin', '<div class="painel-pega" aria-hidden="true"></div>');
    gestoPainel(telas);
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
    Object.keys(montadas).forEach(function (n) { if (RP.telas[n].sair) { try { RP.telas[n].sair(); } catch (e) { /* ignora */ } } montadas[n].remove(); delete montadas[n]; });
    atual = null;
    RP.$('#mundo').hidden = true;
    RP.painel.fechar();
    RP.ir('inicio');
  };
  RP.sair = function () { RP.post('/conta/sair').catch(function () { /* ignora */ }).then(RP.aoSair); };
  RP.ouvir('reino', function () { RP.recarregarReino(); });
  RP.ouvir('marchas', function () { RP.recarregarReino(); });
})();
