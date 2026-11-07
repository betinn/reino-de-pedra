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
     h = { inicio(), arrasto(dx, dy), pinca(fator, mx, my, mx0, my0), roda(fator, x, y), toque(x, y, cx, cy, duplo), fim(),
           cliqueDireito(x, y, cx, cy), passar(x, y) }
     Mouse: botão esquerdo seleciona e arrasta o mapa; botão direito sem mover é o clique de ordem (cliqueDireito); botão
     direito ou do meio arrastando inclina (vertical) e gira (horizontal) a câmera. Dois cliques rápidos no mesmo ponto
     chegam como clique com duplo = true. Coordenadas relativas ao elemento. */
  RP.gestos = function (el, h) {
    var pts = new Map(), arr = null, pin = null, toq = null, meio = null, longo = 0, ultimoToque = null;
    function rel(e) { var r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    /* botões do meio e direito do mouse: arrastar para cima e para baixo inclina a câmera; para os lados, gira
       (sem o rolar automático nem o menu do navegador). O direito sem arrastar é o clique de ordem. */
    el.addEventListener('mousedown', function (e) { if (e.button === 1) e.preventDefault(); });
    el.addEventListener('auxclick', function (e) { if (e.button === 1) e.preventDefault(); });
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    el.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && (e.button === 1 || e.button === 2)) {
        e.preventDefault();
        try { el.setPointerCapture(e.pointerId); } catch (er) { /* ignora */ }
        meio = { id: e.pointerId, x: e.clientX, y: e.clientY, modo: null, direito: e.button === 2, x0: e.clientX, y0: e.clientY, movido: false };
        return;
      }
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.isPrimary) { pts.clear(); pin = null; } /* novo gesto: descarta ponteiros que não terminaram */
      try { el.setPointerCapture(e.pointerId); } catch (er) { /* ignora */ }
      pts.set(e.pointerId, rel(e));
      if (h.inicio) h.inicio();
      if (pts.size === 1) {
        var p = rel(e); arr = p; toq = { x: p.x, y: p.y, cx: e.clientX, cy: e.clientY, t: performance.now(), movido: false };
        /* clique longo (sem mover): modo seleção na Vista */
        if (h.toqueLongo) { clearTimeout(longo); longo = setTimeout(function () { if (toq && !toq.movido && pts.size === 1) { toq.longo = true; h.toqueLongo(toq.x, toq.y); } }, 550); }
      }
      else if (pts.size === 2) {
        var a = Array.from(pts.values());
        var ang0 = Math.atan2(a[1].y - a[0].y, a[1].x - a[0].x);
        pin = { d: Math.max(1, Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y)), mx: (a[0].x + a[1].x) / 2, my: (a[0].y + a[1].y) / 2, ultMy: (a[0].y + a[1].y) / 2, ang: ang0, ultAng: ang0, modo: null };
        toq = null; arr = null;
        if (h.inicioPinca) h.inicioPinca();
      }
    });
    el.addEventListener('pointermove', function (e) {
      if (meio && e.pointerId === meio.id) {
        /* decide pelo primeiro movimento claro: vertical inclina, horizontal gira (um por arrasto, para não misturar) */
        var mdx = e.clientX - meio.x, mdy = e.clientY - meio.y;
        if (!meio.modo && Math.max(Math.abs(e.clientX - meio.x0), Math.abs(e.clientY - meio.y0)) > 6) { meio.modo = Math.abs(mdx) > Math.abs(mdy) && h.girar ? 'girar' : 'inclinar'; meio.movido = true; }
        if (meio.modo === 'inclinar' && h.inclinar) { h.inclinar(mdy); meio.x = e.clientX; meio.y = e.clientY; }
        else if (meio.modo === 'girar' && h.girar) { h.girar(mdx * 0.006); meio.x = e.clientX; meio.y = e.clientY; }
        return;
      }
      /* mouse passando, sem botão: quem desenha troca o cursor sobre o que é clicável */
      if (!pts.size && e.pointerType === 'mouse' && h.passar) { var pp = rel(e); h.passar(pp.x, pp.y); return; }
      if (!pts.has(e.pointerId)) return;
      var p = rel(e);
      pts.set(e.pointerId, p);
      if (pin && pts.size >= 2) {
        var a = Array.from(pts.values());
        var d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), my = (a[0].y + a[1].y) / 2;
        /* dois dedos: a distância muda → zoom (pinça); os dois sobem ou descem juntos → inclinar; os dois rodam em
           volta do meio → girar. Decide uma vez por gesto. */
        var ang = Math.atan2(a[1].y - a[0].y, a[1].x - a[0].x), dAng = Math.atan2(Math.sin(ang - pin.ang), Math.cos(ang - pin.ang));
        if (!pin.modo && (h.inclinar || h.girar)) {
          if (h.girar && Math.abs(dAng) > 0.2) pin.modo = 'girar';
          else if (Math.abs(d - pin.d) > 14) pin.modo = 'pinca';
          else if (h.inclinar && Math.abs(my - pin.my) > 14) pin.modo = 'inclinar';
        }
        if (pin.modo === 'girar') { h.girar(Math.atan2(Math.sin(ang - pin.ultAng), Math.cos(ang - pin.ultAng))); pin.ultAng = ang; return; }
        pin.ultAng = ang;
        if (pin.modo === 'inclinar') { h.inclinar(my - pin.ultMy); pin.ultMy = my; return; }
        pin.ultMy = my;
        if (pin.modo === 'pinca' || (!h.inclinar && !h.girar)) h.pinca(d / pin.d, (a[0].x + a[1].x) / 2, my, pin.mx, pin.my);
      } else if (arr) {
        var dx = p.x - arr.x, dy = p.y - arr.y;
        if (toq && Math.hypot(p.x - toq.x, p.y - toq.y) > 8) toq.movido = true;
        if (!toq || toq.movido) { h.arrasto(dx, dy); arr = p; }
      }
    });
    function fim(e) {
      if (meio && e.pointerId === meio.id) {
        var m = meio; meio = null;
        if (m.direito && !m.movido && e.type === 'pointerup' && h.cliqueDireito) { var pd = rel(e); h.cliqueDireito(pd.x, pd.y, e.clientX, e.clientY, !!e.shiftKey); }
        if (h.fim) h.fim();
        return;
      }
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      clearTimeout(longo);
      if (toq && !toq.movido && !toq.longo && e.type === 'pointerup' && performance.now() - toq.t < 600 && h.toque) {
        var agora = performance.now(), duplo = !!(ultimoToque && agora - ultimoToque.t < 380 && Math.hypot(ultimoToque.x - toq.x, ultimoToque.y - toq.y) < 10);
        ultimoToque = duplo ? null : { x: toq.x, y: toq.y, t: agora };
        h.toque(toq.x, toq.y, toq.cx, toq.cy, duplo, !!e.shiftKey);
      }
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
    el.innerHTML = RP.icone(o.icone || 'info', '', '') + '<div><b>' + RP.esc(o.titulo) + '</b>' + (o.texto ? '<span>' + RP.esc(o.texto) + '</span>' : '') +
      (o.link ? '<small class="aviso-abrir">Clique para abrir</small>' : '') + '</div>';
    if (o.link) el.classList.add('aviso-link');
    box.appendChild(el);
    var sair = function () { el.classList.add('sai'); setTimeout(function () { el.remove(); }, 240); };
    el.addEventListener('click', function () { if (o.link) RP.ir(o.link); sair(); });
    setTimeout(sair, o.ms || (o.texto ? 3600 : 2400));
  };

  /* ---------------------------------------------------------------- folha (painel de seleção na base da tela)
     É o painel inferior central da mesa (decisão 0030): o que está escolhido (hexágono, local, pessoa, tropa) ou o passo
     de uma ordem (quem vai, confirmação). À esquerda, título e informação; à direita, a coluna de comandos, com a ação
     principal (btn-primario) primeiro e a tecla de atalho de cada botão (atributo data-tecla). Até 6 comandos à vista;
     o resto em "Mais". Enter aciona a principal; Esc fecha. A janela de tela (#telas) pode ficar aberta ao mesmo tempo. */
  var folha = null, aoFecharFolha = null, folhaAbertaEstado = false, MAX_ACOES = 6;
  function marcarTeclas(t) {
    RP.$$('.btn[data-tecla]', t).forEach(function (b) {
      if (b.querySelector('kbd.tecla')) return;
      b.insertAdjacentHTML('beforeend', '<kbd class="tecla">' + RP.esc(RP.teclas.rotulo(b.getAttribute('data-tecla'))) + '</kbd>');
    });
  }
  function limitarAcoes(html) {
    if (!html) return '';
    var t = document.createElement('div'); t.innerHTML = html;
    var btns = Array.prototype.filter.call(t.children, function (el) { return el.classList.contains('btn'); });
    var pri = btns.filter(function (b) { return b.classList.contains('btn-primario'); })[0];
    if (pri && t.firstElementChild !== pri) t.insertBefore(pri, t.firstElementChild);
    btns = Array.prototype.filter.call(t.children, function (el) { return el.classList.contains('btn'); });
    marcarTeclas(t);
    if (btns.length <= MAX_ACOES) return t.innerHTML;
    var mais = document.createElement('div'); mais.className = 'folha-mais'; mais.hidden = true;
    btns.slice(MAX_ACOES - 1).forEach(function (b) { mais.appendChild(b); });
    var bt = document.createElement('button'); bt.type = 'button'; bt.className = 'btn btn-p btn-fantasma';
    bt.setAttribute('data-folha-mais', ''); bt.setAttribute('aria-expanded', 'false');
    bt.innerHTML = RP.icone('menu') + 'Mais';
    t.appendChild(bt); t.appendChild(mais);
    return t.innerHTML;
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-folha-mais]'); if (!b) return;
    var box = b.parentNode.querySelector('.folha-mais'), ab = box.hidden;
    box.hidden = !ab; b.setAttribute('aria-expanded', String(ab));
    b.innerHTML = RP.icone(ab ? 'fechar' : 'menu') + (ab ? 'Menos' : 'Mais');
  });
  function garantirFolha() {
    if (folha) return;
    folha = document.createElement('section');
    folha.className = 'folha';
    folha.setAttribute('role', 'dialog');
    folha.setAttribute('aria-modal', 'false');
    document.body.appendChild(folha);
  }
  RP.abrirFolha = function (o) {
    garantirFolha();
    if (aoFecharFolha) { var f = aoFecharFolha; aoFecharFolha = null; f(true); }
    fecharModais(true);
    RP.fecharMenu();
    var acoes = limitarAcoes(o.acoes);
    folha.innerHTML =
      '<header class="folha-topo">' + (o.icone || '') +
      '<div class="folha-titulos"><h2 id="folha-titulo">' + o.titulo + '</h2>' + (o.subtitulo ? '<div class="folha-sub">' + o.subtitulo + '</div>' : '') + '</div>' +
      '<button class="btn btn-fantasma btn-icone" type="button" data-fechar-folha aria-label="Fechar" data-dica="Fechar <kbd class=\'tecla\'>Esc</kbd>">' + RP.icone('fechar') + '</button></header>' +
      '<div class="folha-corpo">' + (o.corpo || '') + '</div>' +
      (acoes ? '<footer class="folha-acoes">' + acoes + '</footer>' : '');
    folha.classList.toggle('sem-acoes', !acoes);
    folha.setAttribute('aria-labelledby', 'folha-titulo');
    aoFecharFolha = o.aoFechar || null;
    var jaAberta = folhaAbertaEstado;
    folhaAbertaEstado = true;
    raiz.classList.add('com-folha');
    setTimeout(function () { folha.classList.add('aberta'); }, 16);
    if (RP.sons && !jaAberta) RP.sons.tocar('folha');
    RP.$('[data-fechar-folha]', folha).addEventListener('click', function () { RP.fecharFolha(); });
    folha.scrollTop = 0; var corpo = RP.$('.folha-corpo', folha); if (corpo) corpo.scrollTop = 0;
    return folha;
  };
  RP.fecharFolha = function () {
    if (!folha) return;
    var estava = folhaAbertaEstado;
    folhaAbertaEstado = false;
    folha.classList.remove('aberta');
    raiz.classList.remove('com-folha');
    if (aoFecharFolha) { var f = aoFecharFolha; aoFecharFolha = null; f(false); }
    if (estava) { if (RP.sons) RP.sons.tocar('fechar'); document.dispatchEvent(new CustomEvent('rp:folha-fechou')); }
  };
  RP.folhaAberta = function () { return folhaAbertaEstado; };
  /* troca só o corpo (e as ações) da folha aberta, sem fechar nem animar */
  RP.atualizarFolha = function (corpo, acoes) {
    if (!folha || !folhaAbertaEstado) return;
    var c = RP.$('.folha-corpo', folha); if (c && corpo != null) c.innerHTML = corpo;
    var a = RP.$('.folha-acoes', folha);
    if (acoes != null) { if (a) a.innerHTML = limitarAcoes(acoes); else if (acoes) { a = document.createElement('footer'); a.className = 'folha-acoes'; a.innerHTML = limitarAcoes(acoes); folha.appendChild(a); } folha.classList.toggle('sem-acoes', !acoes); }
  };
  /* a tecla de um comando da folha aberta (data-tecla) ou a ação principal (Enter); devolve true se acionou */
  function teclaDaFolha(tecla) {
    if (!folhaAbertaEstado) return false;
    var b = null;
    if (tecla === 'Enter') b = RP.$('.folha-acoes .btn-primario', folha);
    else RP.$$('.folha-acoes .btn[data-tecla]', folha).forEach(function (x) { if (!b && RP.teclas.igual(x.getAttribute('data-tecla'), tecla)) b = x; });
    if (!b || b.classList.contains('btn-inativo') || b.disabled) return false;
    b.click();
    return true;
  }

  /* ---------------------------------------------------------------- confirmação curta
     Diálogo pequeno no centro, sobre um véu leve: o mundo continua à vista. Enter confirma (primeira ação), Esc fecha.
     Só existe uma confirmação por vez (uma nova substitui a anterior). */
  function fecharModais(sem) {
    RP.$$('.modal-fundo').forEach(function (m) { m.remove(); });
    raiz.classList.remove('com-modal');
  }
  RP.modal = function (o) {
    fecharModais(true);
    RP.fecharMenu();
    raiz.classList.add('com-modal');
    var fundo = document.createElement('div');
    fundo.className = 'modal-fundo';
    fundo.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-t">' + (o.topo || '') +
      '<h2 id="modal-t">' + o.titulo + '</h2>' + (o.corpo || '') +
      '<div class="acoes">' + (o.acoes || []).map(function (a, i) {
        return '<button type="button" class="btn btn-bloco ' + (a.classe || '') + '" data-i="' + i + '">' + a.rotulo + (i === 0 ? '<kbd class="tecla">Enter</kbd>' : '') + '</button>';
      }).join('') + '</div></div>';
    document.body.appendChild(fundo);
    setTimeout(function () { fundo.classList.add('ativo'); }, 16);
    var fechar = function () {
      if (!fundo.parentNode) return;
      fundo.classList.remove('ativo');
      fundo.classList.add('saindo');
      if (!RP.$$('.modal-fundo:not(.saindo)').some(function (m) { return m !== fundo; })) raiz.classList.remove('com-modal');
      setTimeout(function () { fundo.remove(); }, 240);
    };
    fundo.addEventListener('click', function (e) {
      var b = e.target.closest('[data-i]');
      if (b) { fechar(); var a = o.acoes[+b.getAttribute('data-i')]; if (a.acao) a.acao(); }
      else if (e.target === fundo && o.fecharFora !== false) fechar();
    });
    fundo.addEventListener('rp:fechar-modal', function () { if (o.fecharFora !== false) fechar(); });
    fundo.addEventListener('rp:confirmar-modal', function () { var b = RP.$('[data-i="0"]', fundo); if (b) b.click(); });
    var bt = RP.$('.btn', fundo);
    if (bt) setTimeout(function () { bt.focus(); }, 50);
    return fechar;
  };

  /* ---------------------------------------------------------------- dicas (tooltip)
     Qualquer elemento com data-dica (HTML curto) mostra a dica ao passar o mouse. data-dica-rec="madeira" monta a dica
     do recurso na hora (estoque, por hora, quando enche). */
  var dicaEl = null, dicaTimer = 0, dicaAlvo = null;
  function dicaRecurso(k) {
    var tot = RP.totalRecurso(k), taxa = RP.producao(k), enche = RP.encheEm(k), c = RP.castelo(), noCastelo = RP.qtdRecurso(k);
    return '<b>' + RP.esc(RP.NOMES_REC[k] || k) + '</b>' +
      '<span>No castelo: <b style="display:inline">' + RP.num(noCastelo) + '</b>' + (c && c.cap && c.cap[k] ? ' de ' + RP.num(c.cap[k]) : '') + ' · no reino: ' + RP.num(tot) + '</span>' +
      '<small>' + (taxa ? '+' + RP.num(taxa) + ' por hora' + (enche != null ? (enche <= 0 ? ' · estoque cheio, produção parada' : ' · enche em ' + RP.fmtDuracao(enche / 1000)) : '') : 'nenhum local produz') + '</small>' +
      '<small>Clique: produção e estoques do reino</small>';
  }
  function mostrarDica(el) {
    if (!dicaEl) dicaEl = RP.$('#dica');
    if (!dicaEl) return;
    var html = el.hasAttribute('data-dica-rec') ? dicaRecurso(el.getAttribute('data-dica-rec')) : el.hasAttribute('data-dica-pop') ? '<b>População</b><span>' + RP.esc(RP.reino ? RP.num(RP.reino.pop) + ' civis + ' + RP.num(RP.reino.tropas) + ' soldados de ' + RP.num(RP.reino.teto) + ' moradores' : '') + '</span><small>Clique: Meu reino</small>' : el.getAttribute('data-dica');
    if (!html) return;
    dicaEl.innerHTML = html; dicaEl.hidden = false;
    var r = el.getBoundingClientRect(), w = dicaEl.offsetWidth, h = dicaEl.offsetHeight;
    var x = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    var y = r.bottom + 8; if (y + h > window.innerHeight - 8) y = r.top - h - 8;
    dicaEl.style.left = x + 'px'; dicaEl.style.top = y + 'px';
    dicaEl.classList.add('on');
    dicaAlvo = el;
  }
  RP.esconderDica = function () { clearTimeout(dicaTimer); dicaTimer = 0; dicaAlvo = null; if (dicaEl) { dicaEl.classList.remove('on'); dicaEl.hidden = true; } };
  document.addEventListener('mouseover', function (e) {
    var el = e.target.closest && e.target.closest('[data-dica], [data-dica-rec], [data-dica-pop]');
    if (!el || el === dicaAlvo) return;
    RP.esconderDica();
    dicaTimer = setTimeout(function () { if (el.isConnected && el.matches(':hover')) mostrarDica(el); }, 320);
  });
  document.addEventListener('mouseout', function (e) {
    var el = e.target.closest && e.target.closest('[data-dica], [data-dica-rec], [data-dica-pop]');
    if (el && (!e.relatedTarget || !el.contains(e.relatedTarget))) RP.esconderDica();
  });
  document.addEventListener('mousedown', function () { RP.esconderDica(); }, true);
  window.addEventListener('blur', function () { RP.esconderDica(); });

  /* ---------------------------------------------------------------- menu de contexto (botão direito)
     RP.menuContexto({ x, y, titulo, acoes, itens }). `acoes` é o mesmo HTML de botões das folhas: cada .btn vira um item
     do menu e, clicado, faz exatamente o que o botão faria (links navegam; botões disparam o clique que os sistemas já
     tratam por delegação). `itens` são objetos { rotulo, icone, tecla, classe, acao, href }. */
  var menuEl = null;
  RP.fecharMenu = function () { if (menuEl) { menuEl.remove(); menuEl = null; } };
  RP.menuAberto = function () { return !!menuEl; };
  function itensDeHTML(html) {
    var t = document.createElement('div'); t.innerHTML = html || '';
    return RP.$$('.btn', t).filter(function (b) { return !b.hasAttribute('data-folha-mais'); }).map(function (b) {
      var ico = b.querySelector('svg.ico'), k = b.querySelector('kbd'); if (k) k.remove();
      return {
        rotulo: b.textContent.trim(), iconeHTML: ico ? ico.outerHTML : '', tecla: b.getAttribute('data-tecla'),
        classe: b.classList.contains('btn-primario') ? 'primario' : b.classList.contains('btn-perigo') ? 'perigo' : b.classList.contains('btn-inativo') ? 'inativo' : '',
        href: b.tagName === 'A' ? b.getAttribute('href') : null,
        acao: b.tagName === 'A' ? null : function () {
          var c = b.cloneNode(true); c.hidden = true; c.style.display = 'none'; document.body.appendChild(c);
          c.click(); setTimeout(function () { c.remove(); }, 0);
        }
      };
    });
  }
  RP.menuContexto = function (o) {
    RP.fecharMenu(); RP.esconderDica();
    var itens = (o.itens || []).concat(o.acoes ? itensDeHTML(o.acoes) : []);
    menuEl = document.createElement('div');
    menuEl.className = 'menu-ctx' + (o.classe ? ' ' + o.classe : ''); menuEl.setAttribute('role', 'menu');
    menuEl.innerHTML = (o.titulo ? '<div class="menu-ctx-titulo">' + o.titulo + '</div>' : '') +
      (itens.length ? itens.map(function (it, i) {
        if (it.sep) return '<div class="menu-ctx-sep"></div>';
        var tag = it.href ? 'a' : 'button';
        return '<' + tag + (it.href ? ' href="' + it.href + '"' : ' type="button"') + ' class="menu-ctx-item ' + (it.classe || '') + '" role="menuitem" data-mi="' + i + '">' +
          (it.iconeHTML || (it.icone ? RP.icone(it.icone) : '')) + '<span>' + RP.esc(it.rotulo) + '</span>' + (it.tecla ? '<kbd class="tecla">' + RP.esc(RP.teclas.rotulo(it.tecla)) + '</kbd>' : '') + '</' + tag + '>';
      }).join('') : '<div class="menu-ctx-vazio">' + RP.esc(o.vazio || 'Nada a fazer aqui.') + '</div>');
    document.body.appendChild(menuEl);
    var w = menuEl.offsetWidth, h = menuEl.offsetHeight;
    menuEl.style.left = Math.max(4, Math.min(window.innerWidth - w - 4, o.x)) + 'px';
    menuEl.style.top = Math.max(4, Math.min(window.innerHeight - h - 4, o.y)) + 'px';
    menuEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mi]'); if (!b) return;
      var it = itens[+b.getAttribute('data-mi')];
      RP.fecharMenu();
      if (it && it.acao) it.acao();
    });
    menuEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    var primeiro = RP.$('.menu-ctx-item', menuEl); if (primeiro) primeiro.focus();
    return menuEl;
  };
  document.addEventListener('pointerdown', function (e) { if (menuEl && !menuEl.contains(e.target)) RP.fecharMenu(); }, true);
  window.addEventListener('wheel', function () { RP.fecharMenu(); }, { passive: true });
  window.addEventListener('resize', function () { RP.fecharMenu(); });

  /* ---------------------------------------------------------------- atalhos de teclado
     RP.teclas.registrar('R', { descricao, grupo, acao, quando }) — a tecla vale no jogo (não em campos de texto).
     Ordem de quem recebe a tecla: menu de contexto → confirmação → folha (data-tecla, Enter) → atalhos globais.
     Esc fecha o que estiver mais em cima: menu, confirmação, folha, seleção, janela. */
  var registro = [];
  function normal(t) {
    if (!t) return '';
    if (t === ' ') return 'Space';
    return t.length === 1 ? t.toUpperCase() : t;
  }
  RP.teclas = {
    registrar: function (tecla, o) { registro.push({ tecla: normal(tecla), ctrl: !!o.ctrl, shift: !!o.shift, descricao: o.descricao, grupo: o.grupo || 'Geral', acao: o.acao, quando: o.quando, oculta: !!o.oculta }); },
    igual: function (a, b) { return normal(a) === normal(b); },
    rotulo: function (t) { t = normal(t); return { Space: 'Espaço', Escape: 'Esc', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter' }[t] || t; },
    lista: function () { return registro.filter(function (r) { return !r.oculta; }); },
    normal: normal
  };
  function emCampo(e) { return e.target && e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]'); }
  document.addEventListener('keydown', function (e) {
    if (emCampo(e)) { if (e.key === 'Escape') e.target.blur(); return; }
    var t = normal(e.key);
    if (t === 'Escape') {
      if (menuEl) { RP.fecharMenu(); return; }
      var m = RP.$$('.modal-fundo.ativo').pop();
      if (m) { m.dispatchEvent(new CustomEvent('rp:fechar-modal')); return; }
      if (RP.$('.atalhos-fundo')) { RP.$('.atalhos-fundo').remove(); return; }
      if (RP.folhaAberta()) { RP.fecharFolha(); return; }
      if (RP.rotaExp && RP.rotaExp.ativa()) { RP.rotaExp.cancelar(); return; }
      if (RP.selecao && (RP.selecao.n() || RP.selecao.modo)) { RP.selecao.limpar(); return; }
      if (RP.envio && RP.envio.ativo()) { RP.envio.cancelar(); return; }
      if (RP.painel.aberto) { RP.ir('mapa'); return; }
      return;
    }
    if (menuEl) return;
    var md = RP.$$('.modal-fundo.ativo').pop();
    if (md) { if (t === 'Enter') { e.preventDefault(); md.dispatchEvent(new CustomEvent('rp:confirmar-modal')); } return; }
    if (!e.ctrlKey && !e.metaKey && !e.altKey && teclaDaFolha(t)) { e.preventDefault(); return; }
    if (!raiz.classList.contains('jogo')) return;
    for (var i = 0; i < registro.length; i++) {
      var r = registro[i];
      if (r.tecla !== t || r.ctrl !== (e.ctrlKey || e.metaKey) || (r.shift && !e.shiftKey)) continue;
      if (r.quando && !r.quando()) continue;
      e.preventDefault();
      r.acao(e);
      return;
    }
  });
  RP.ajudaTeclas = function () {
    if (RP.$('.atalhos-fundo')) { RP.$('.atalhos-fundo').remove(); return; }
    var grupos = {};
    RP.teclas.lista().forEach(function (r) { (grupos[r.grupo] = grupos[r.grupo] || []).push(r); });
    var fundo = document.createElement('div'); fundo.className = 'atalhos-fundo';
    fundo.innerHTML = '<div class="atalhos" role="dialog" aria-label="Atalhos"><h2>Mouse e teclado</h2><div class="atalhos-grade">' +
      '<div><h3>Mouse</h3>' + [['Clique', 'seleciona: tropa, local, pessoa ou hexágono'], ['Botão direito', 'ordem para a tropa selecionada, ou o menu do que está sob o mouse'], ['Shift + direito', 'todas as ordens possíveis'], ['Arrastar', 'move o mapa'], ['Roda', 'zoom'], ['Direito ou meio arrastando', 'inclina e gira a câmera'], ['Shift + clique', 'soma à seleção · Shift + arrastar laça'], ['Duplo clique', 'seleciona todos do mesmo tipo no lugar'], ['Passar o mouse', 'dica de recursos, botões e tropas']].map(function (p) {
        return '<div class="atalhos-linha"><span>' + p[1] + '</span><span><kbd class="tecla">' + p[0] + '</kbd></span></div>';
      }).join('') + '</div>' +
      Object.keys(grupos).map(function (g) {
        return '<div><h3>' + RP.esc(g) + '</h3>' + grupos[g].map(function (r) {
          return '<div class="atalhos-linha"><span>' + RP.esc(r.descricao) + '</span><span>' + (r.ctrl ? '<kbd class="tecla">Ctrl</kbd>' : '') + (r.shift ? '<kbd class="tecla">Shift</kbd>' : '') + '<kbd class="tecla">' + RP.esc(RP.teclas.rotulo(r.tecla)) + '</kbd></span></div>';
        }).join('') + '</div>';
      }).join('') + '</div><div class="fechar"><button type="button" class="btn btn-p" data-fechar-atalhos>Fechar<kbd class="tecla">Esc</kbd></button></div></div>';
    document.body.appendChild(fundo);
    fundo.addEventListener('click', function (e) { if (e.target === fundo || e.target.closest('[data-fechar-atalhos]')) fundo.remove(); });
  };
  RP.teclas.registrar('F1', { descricao: 'Atalhos (esta ajuda)', grupo: 'Geral', acao: RP.ajudaTeclas });
  RP.teclas.registrar('?', { descricao: 'Atalhos (esta ajuda)', grupo: 'Geral', acao: RP.ajudaTeclas, oculta: true });
  /* ---------------------------------------------------------------- timers ao vivo */
  function pctTempo(ini, fim, agora) { return Math.max(0, Math.min(100, (100 * (agora - ini)) / Math.max(1, fim - ini))); }
  /* Barra de progresso com o cronômetro ao lado: o componente único para tudo que tem tempo (obra, treino, forja,
     cura, marcha, escavação, extração, caça...). inicio e fim em ms do servidor (RP.agora()); o tique de 1 s anda
     a barra e o cronômetro sozinhos. Sem início conhecido, mostra só o cronômetro. Já terminado: barra cheia.
     opt: { rotulo (para leitores de tela), classe ('curta' = barra fina), cor ('sucesso' | 'perigo' | 'info') } */
  RP.barraTempo = function (inicio, fim, opt) {
    opt = opt || {};
    fim = +fim;
    if (!fim || !isFinite(fim)) return '';
    var agora = RP.agora(), ini = +inicio;
    var resta = '<b class="num barra-tempo-resta" data-fim="' + fim + '">' + RP.fmtResta(fim - agora) + '</b>';
    if (!ini || !isFinite(ini) || ini >= fim) return '<span class="barra-tempo sem-inicio' + (opt.classe ? ' ' + opt.classe : '') + '">' + resta + '</span>';
    var pct = pctTempo(ini, fim, agora);
    return '<span class="barra-tempo' + (opt.classe ? ' ' + opt.classe : '') + '">' +
      '<span class="barra' + (opt.cor ? ' barra-' + opt.cor : '') + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(pct) + '" aria-label="' + RP.esc(opt.rotulo || 'Progresso') + '">' +
      '<i data-ini="' + ini + '" data-barra-fim="' + fim + '" style="width:' + pct.toFixed(1) + '%"></i></span>' + resta + '</span>';
  };
  /* barra de tempo com rótulo em cima (itens de fila). fimAbs (ms) opcional; sem ele, seg conta a partir de agora.
     Itens que ainda não começaram aparecem como "Na fila". */
  RP.timerHTML = function (rotulo, seg, total, extra, fimAbs) {
    var f = fimAbs || (RP.agora() + seg * 1000), ini = f - total * 1000, agora = RP.agora();
    return '<div class="timer">' +
      '<div class="timer-topo"><b>' + rotulo + '</b>' + (ini > agora ? '<span class="selo">Na fila</span>' : '') + '</div>' +
      RP.barraTempo(ini, f, { rotulo: 'Progresso: ' + rotulo.replace(/<[^>]+>/g, '').trim(), cor: extra ? String(extra).replace(/^barra-/, '') : '' }) + '</div>';
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
    var falta = [], pior = 0, semProducao = [];
    Object.keys(custo || {}).forEach(function (k) {
      if (k === 'populacao') { if ((RP.reino ? RP.reino.pop : 0) < custo[k] * mult) falta.push('gente'); return; }
      var f = custo[k] * mult - RP.qtdRecurso(k, local || '*');
      if (f <= 0) return;
      falta.push(RP.num(Math.ceil(f)) + ' ' + RP.nomeRecurso(k));
      var t = RP.tempoParaTer(k, custo[k] * mult, local);
      if (isFinite(t)) pior = Math.max(pior, t); else semProducao.push(RP.nomeRecurso(k));
    });
    if (!falta.length) return '';
    /* o que nenhum local produz (ouro, valiosos) não tem "pronto em": vem de extração, comércio ou saque */
    var quando = semProducao.length ? ' · ' + RP.esc(semProducao.join(', ')) + ' não se produz: extraia ou troque' : pior ? ' · pronto ' + RP.fmtTempoParaTer(pior) : '';
    return '<span class="custo-falta">' + RP.icone('relogio', 'ico-p') + 'faltam ' + RP.esc(falta.join(', ')) + quando + '</span>';
  };
  /* informação em camadas: regras e detalhes que não são a decisão de agora ficam recolhidos, um clique adiante */
  RP.comoFunciona = function (html, titulo) {
    return '<details class="recolhido como-funciona"><summary>' + RP.icone('info', 'ico-p') + (titulo || 'Como funciona') + '</summary><div class="recolhido-corpo">' + html + '</div></details>';
  };
  RP.secaoRecolhida = function (titulo, html, aberta) {
    return '<details class="recolhido secao-recolhida"' + (aberta ? ' open' : '') + '><summary class="secao-titulo">' + titulo + '</summary><div class="recolhido-corpo">' + html + '</div></details>';
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
      var p = pctTempo(+el.getAttribute('data-ini'), +el.getAttribute('data-barra-fim'), agora);
      el.style.width = p.toFixed(2) + '%';
      var b = el.parentNode; if (b && b.hasAttribute('aria-valuenow')) b.setAttribute('aria-valuenow', String(Math.round(p)));
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
      var taxa = RP.producao(k);
      h += '<button class="rec' + (cap && q >= cap * 0.95 ? ' rec-cheio' : '') + '" type="button" data-abrir-recursos data-dica-rec="' + k + '" aria-label="' + RP.NOMES_REC[k] + ' no castelo: ' + RP.num(q) + '">' +
        RP.icone(k, 'r-' + k) + '<span class="rec-num" data-rec="' + k + '" data-curto>' + RP.numCurto(q) + '</span>' + (taxa ? '<span class="rec-taxa">+' + RP.numCurto(taxa) + '/h</span>' : '') + '</button>';
    });
    h += '<button class="rec" type="button" data-ir="reino" data-dica-pop aria-label="População">' + RP.icone('populacao', 'r-populacao') +
      '<span class="rec-num" data-pop data-curto>' + RP.numCurto(r ? r.pop : 0) + '</span>' + (r ? '<span class="rec-taxa">de ' + RP.numCurto(r.teto) + '</span>' : '') + '</button>';
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
      titulo: 'Recursos e produção', subtitulo: '<span class="fraco">Reino todo · clique num recurso para calcular</span>',
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
    fecharModais(true);
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
    var topo = RP.$('#topo-jogo');
    if (topo) { var tinha = !topo.hidden; topo.hidden = cheia; if (!cheia && (!tinha || !topo.children.length)) RP.montarTopo(); }
    if (atual !== nome) { window.scrollTo(0, 0); var t = RP.$('#telas'); if (t) t.scrollTop = 0; if (montadas[nome]) montadas[nome].scrollTop = 0; }
    atual = nome;
    marcarNav();
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

  /* ---------------------------------------------------------------- janela (as telas que não são o mundo)
     Uma tela por vez, numa janela flutuante sobre o mundo (canto superior direito por padrão), arrastável pela barra
     de título e fechada pelo X, por Esc ou pela mesma tecla que a abriu. O mundo nunca muda de tamanho. */
  RP.painel = {
    aberto: false, recolhido: false,
    abrir: function () { this.aberto = true; this.recolhido = false; aplicarPainel(); },
    fechar: function () { this.aberto = false; this.recolhido = false; aplicarPainel(); },
    recolher: function () { RP.ir('mapa'); },
    expandir: function () { if (!this.aberto) return; this.recolhido = false; aplicarPainel(); },
    alternar: function () { if (this.aberto) RP.ir('mapa'); },
    redimensionado: function () { requestAnimationFrame(function () { window.dispatchEvent(new Event('resize')); }); }
  };
  function tituloPainel() {
    var sec = atual && montadas[atual], h1 = sec && sec.querySelector('h1');
    return h1 ? h1.textContent.trim() : '';
  }
  function aplicarPainel() {
    raiz.classList.toggle('painel-aberto', RP.painel.aberto);
    raiz.classList.remove('painel-recolhido');
    var telas = RP.$('#telas');
    if (telas && !RP.$('.janela-x', telas)) {
      telas.insertAdjacentHTML('afterbegin', '<button type="button" class="janela-x" data-janela-fechar aria-label="Fechar a janela" data-dica="Fechar <kbd class=\'tecla\'>Esc</kbd>">' + RP.icone('fechar') + '</button>');
    }
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-janela-fechar]') || e.target.closest('[data-painel-recolher]')) RP.ir('mapa');
  });
  /* arrastar a janela pela barra de título */
  function gestoPainel(el) {
    var ini = null;
    el.addEventListener('pointerdown', function (e) {
      var topo = e.target.closest('.tela > .topo');
      if (!topo || e.target.closest('button, a, input, select') || e.button !== 0) return;
      var r = el.getBoundingClientRect();
      ini = { x: e.clientX, y: e.clientY, left: r.left, top: r.top };
      try { el.setPointerCapture(e.pointerId); } catch (x) { /* ignora */ }
      e.preventDefault();
    });
    el.addEventListener('pointermove', function (e) {
      if (!ini) return;
      var w = el.offsetWidth, h = el.offsetHeight;
      var x = Math.max(0, Math.min(window.innerWidth - w, ini.left + e.clientX - ini.x));
      var y = Math.max(0, Math.min(window.innerHeight - 48, ini.top + e.clientY - ini.y));
      el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.right = 'auto';
      el.style.maxHeight = 'calc(100vh - ' + Math.round(y + 16) + 'px)';
    });
    var solta = function () { ini = null; };
    el.addEventListener('pointerup', solta); el.addEventListener('pointercancel', solta);
  }

  RP.rotear = rotear;
  /* destinos da barra do topo: cada um abre a janela da tela, com a tecla de atalho */
  RP.NAV = [
    { tela: 'reino', icone: 'castelo', rotulo: 'Reino', cor: 'reino', tecla: 'R' },
    { tela: 'construcao', icone: 'martelo', rotulo: 'Construir', cor: 'reino', tecla: 'B' },
    { tela: 'tropas', icone: 'tropas', rotulo: 'Exército', cor: 'tropas', tecla: 'E' },
    { tela: 'recrutamento', icone: 'populacao', rotulo: 'Recrutar', cor: 'tropas', tecla: 'T' },
    { tela: 'pessoas', icone: 'populacao', rotulo: 'Pessoas', cor: 'mais', tecla: 'P' },
    { tela: 'agora', icone: 'sino', rotulo: 'Atenção', cor: 'agora', tecla: 'N', contador: true },
    { tela: 'mais', icone: 'menu', rotulo: 'Mais', cor: 'mais', tecla: null, menu: true }
  ];
  /* itens do menu "Mais": o que o jogo oferece além das janelas da barra (os sistemas somam em RP.itensMais) */
  RP.itensMenuMais = function () {
    var base = [{ icone: 'relatorios', titulo: 'Relatórios', href: '#/relatorios' }, { icone: 'sino', titulo: 'Notificações', href: '#/notificacoes' }];
    return base.concat(RP.itensMais || []).filter(function (i) { return !i.sistema || RP.sistema(i.sistema); });
  };
  function abrirMenuMais(botao) {
    var r = botao.getBoundingClientRect();
    RP.menuContexto({
      x: r.right - 240, y: r.bottom + 4, titulo: 'Mais',
      itens: RP.itensMenuMais().map(function (i) { return { rotulo: i.titulo, icone: i.icone, href: i.href }; })
        .concat([{ sep: true }, { rotulo: 'Atalhos do teclado', icone: 'info', tecla: 'F1', acao: RP.ajudaTeclas }, { rotulo: 'Sons e conta', icone: 'menu', href: '#/mais' }])
    });
  }
  RP.montarTopo = function () {
    var topo = RP.$('#topo-jogo'); if (!topo) return;
    var r = RP.reino;
    topo.innerHTML = '<div class="topo-esq">' +
      '<button type="button" class="topo-reino-btn" data-ir="reino" data-dica="<b>Meu reino</b><small>Moradores, produção, filas e construções</small><kbd class=\'tecla\'>R</kbd>">' + (r ? RP.iconeReino(r, 30) : '') + '<span><b>' + RP.esc(r ? r.nome : '') + '</b><small>' + (RP.mundo ? 'Temporada ' + RP.mundo.temporada + ' · ' + Math.max(0, Math.ceil((RP.mundo.fim - RP.agora()) / 86400000)) + ' dias' : '') + '</small></span></button>' +
      '</div>' + RP.barraRecursos({ semSino: true }) + '<div class="topo-dir">' +
      RP.NAV.filter(function (i) { return RP.telas[i.tela]; }).map(function (i) {
        return '<button type="button" class="topo-btn nav-' + i.cor + '" data-nav="' + i.tela + '"' + (i.menu ? ' data-menu-mais' : ' data-ir="' + i.tela + '"') +
          ' data-dica="<b>' + RP.esc(i.rotulo) + '</b>' + (i.tecla ? '<kbd class=\'tecla\'>' + i.tecla + '</kbd>' : '') + '">' + RP.icone(i.icone) + '<span>' + i.rotulo + '</span>' +
          (i.contador ? '<span class="contador" data-nav-contador' + (RP.naoLidas ? '' : ' hidden') + '>' + RP.naoLidas + '</span>' : '') +
          (i.tecla ? '<kbd class="tecla" aria-hidden="true">' + i.tecla + '</kbd>' : '') + '</button>';
      }).join('') + '</div>';
    marcarNav();
  };
  function marcarNav() {
    var def = atual && RP.telas[atual];
    RP.$$('#topo-jogo [data-nav]').forEach(function (a) {
      var alvo = a.getAttribute('data-nav');
      if (def && !def.fundo && (alvo === atual || (alvo !== 'construcao' && alvo !== 'recrutamento' && alvo !== 'pessoas' && alvo === def.secao))) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }
  document.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-menu-mais]'))) { if (RP.menuAberto()) RP.fecharMenu(); else abrirMenuMais(b); }
    else if ((b = e.target.closest('[data-ir]'))) { var t = b.getAttribute('data-ir'); if (atual === t && RP.painel.aberto) RP.ir('mapa'); else RP.ir(t); }
  });
  document.addEventListener('rp:reino', function () { var t = RP.$('#topo-jogo'); if (t && !t.hidden) { var b = RP.$('.topo-reino-btn', t); if (b && RP.reino) b.innerHTML = RP.iconeReino(RP.reino, 30) + '<span><b>' + RP.esc(RP.reino.nome) + '</b><small>' + (RP.mundo ? 'Temporada ' + RP.mundo.temporada + ' · ' + Math.max(0, Math.ceil((RP.mundo.fim - RP.agora()) / 86400000)) + ' dias' : '') + '</small></span>'; } });
  RP.NAV.forEach(function (i) {
    if (!i.tecla) return;
    RP.teclas.registrar(i.tecla, { descricao: i.rotulo + ' (abre e fecha a janela)', grupo: 'Janelas', acao: function () { if (!RP.telas[i.tela]) return; if (atual === i.tela && RP.painel.aberto) RP.ir('mapa'); else RP.ir(i.tela); } });
  });
  RP.iniciar = function () {
    RP.injetarIcones();
    var telas = RP.$('#telas');
    gestoPainel(telas);
    window.addEventListener('hashchange', rotear);
    RP.get('/mundo').then(function (m) { RP.mundo = m; RP.aceleracao = m.aceleracao > 0 ? m.aceleracao : 1; RP.sincronizar(m.agora); RP.hex.configurar(m.cols, m.lins); }).catch(function () { /* sem rede */ })
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
    RP.fecharFolha(); RP.fecharMenu();
    RP.painel.fechar();
    var topo = RP.$('#topo-jogo'); if (topo) { topo.hidden = true; topo.innerHTML = ''; }
    RP.ir('inicio');
  };
  RP.sair = function () { RP.post('/conta/sair').catch(function () { /* ignora */ }).then(RP.aoSair); };
  RP.ouvir('reino', function () { RP.recarregarReino(); });
  RP.ouvir('marchas', function () { RP.recarregarReino(); });
})();
