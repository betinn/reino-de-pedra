/* Reino de Pedra — Mapa tático (Canvas 2D): terreno explorado, névoa, informação envelhecida, locais e marchas.
   Toque num hexágono abre a folha com o que se sabe dele e as ações possíveis. */
(function () {
  'use strict';
  var RP = window.RP, H = RP.hex;

  var COR_TERRENO = { p: '#5d6b3a', f: '#2f4a2c', c: '#7a6a45', m: '#6d6a68', b: '#3e4a3a' };
  var dados = null, cv = null, ctx = null, cam = { x: 0, y: 0, z: 0.6 }, alvoFundar = null, selecionado = -1, anim = 0;
  /* RP.NOMES_MARCHA: sistemas dão nome aos seus tipos de marcha ({ exercito: 'Exército' }) */
  RP.mapa = { dados: function () { return dados; }, extrasFolhaHex: [], acoesFolhaHex: [], desenhosExtras: [] };

  function carregar() {
    return RP.get('/mapa').then(function (d) {
      dados = d; RP.sincronizar(d.agora); H.configurar(d.cols, d.lins);
      dados.porHex = {};
      d.objetos.forEach(function (o) {
        var h = o.hex != null ? o.hex : (o.caminho ? o.caminho[0] : -1);
        if (h < 0) return;
        (dados.porHex[h] = dados.porHex[h] || []).push(o);
      });
      desenhar();
      return d;
    });
  }
  RP.mapa.recarregar = carregar;

  function tela(px, py) { return { x: (px - cv.width / 2 / devicePixelRatio) / cam.z + cam.x, y: (py - cv.height / 2 / devicePixelRatio) / cam.z + cam.y }; }
  function centralizar(h) { var p = H.centroH(h); cam.x = p.x; cam.y = p.y; }

  function posMarcha(o, t) {
    var tp = o.tempos, cm = o.caminho;
    if (!tp || tp.length < 2) return H.centroH(cm ? cm[0] : o.hex);
    if (t <= tp[0]) return H.centroH(cm[0]);
    if (t >= tp[tp.length - 1]) return H.centroH(cm[cm.length - 1]);
    for (var i = 0; i < tp.length - 1; i++) {
      if (t < tp[i + 1]) {
        var a = H.centroH(cm[i]), b = H.centroH(cm[i + 1]), f = (t - tp[i]) / Math.max(1, tp[i + 1] - tp[i]);
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
      }
    }
    return H.centroH(cm[cm.length - 1]);
  }

  function hexPath(cx, cy, r) {
    ctx.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = (Math.PI / 180) * (60 * i - 30);
      var x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function desenhar() {
    if (!cv || !dados) return;
    var dpr = devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0d0f12'; ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
    var x0 = cam.x - w / 2 / cam.z - H.W, x1 = cam.x + w / 2 / cam.z + H.W, y0 = cam.y - h / 2 / cam.z - H.R * 2, y1 = cam.y + h / 2 / cam.z + H.R * 2;
    var ter = dados.terreno, idade = dados.idade, rotas = {}, pontes = {};
    (dados.rotas || []).forEach(function (x) { rotas[x] = 1; });
    (dados.pontes || []).forEach(function (x) { pontes[x] = 1; });
    var lMin = Math.max(0, Math.floor(y0 / H.VS)), lMax = Math.min(H.LINS - 1, Math.ceil(y1 / H.VS));
    for (var l = lMin; l <= lMax; l++) {
      for (var c = 0; c < H.COLS; c++) {
        var p = H.centro(c, l);
        if (p.x < x0 || p.x > x1) continue;
        var i = H.idx(c, l), t = ter[i];
        hexPath(p.x, p.y, H.R + 0.6);
        if (t === '?') { ctx.fillStyle = '#1a1d22'; ctx.fill(); continue; }
        var low = t.toLowerCase();
        ctx.fillStyle = COR_TERRENO[low] || '#555'; ctx.fill();
        if (t !== low) { ctx.fillStyle = 'rgba(80,140,200,.55)'; hexPath(p.x, p.y, H.R * 0.55); ctx.fill(); }
        if (rotas[i]) { ctx.fillStyle = 'rgba(217,178,92,.6)'; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, 7); ctx.fill(); }
        if (pontes[i]) { ctx.strokeStyle = '#d9b25c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x - 12, p.y); ctx.lineTo(p.x + 12, p.y); ctx.stroke(); }
        if (idade[i] > 0) { hexPath(p.x, p.y, H.R + 0.6); ctx.fillStyle = 'rgba(13,15,18,' + Math.min(0.55, 0.25 + idade[i] / 2880) + ')'; ctx.fill(); }
        ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; hexPath(p.x, p.y, H.R); ctx.stroke();
      }
    }
    var agora = RP.agora();
    dados.objetos.forEach(function (o) {
      if (o.tipo === 'marcha') {
        var q = posMarcha(o, agora);
        if (o.dono === 'meu' && o.caminho) {
          ctx.strokeStyle = 'rgba(94,166,234,.45)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.beginPath();
          o.caminho.forEach(function (hh, k) { var pp = H.centroH(hh); if (k) ctx.lineTo(pp.x, pp.y); else ctx.moveTo(pp.x, pp.y); });
          ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.fillStyle = o.dono === 'meu' ? '#5ea6ea' : '#f0645a';
        ctx.beginPath(); ctx.arc(q.x, q.y, 7, 0, 7); ctx.fill();
        ctx.strokeStyle = '#0d0f12'; ctx.lineWidth = 2; ctx.stroke();
        return;
      }
      var pp = H.centroH(o.hex);
      if (o.tipo === 'local') {
        ctx.fillStyle = o.dono === 'meu' ? '#5ea6ea' : '#9aa0a8';
        if (o.local === 'castelo') { ctx.fillRect(pp.x - 11, pp.y - 11, 22, 22); ctx.fillStyle = '#0d0f12'; ctx.fillRect(pp.x - 4, pp.y - 2, 8, 13); }
        else { ctx.beginPath(); ctx.arc(pp.x, pp.y, 9, 0, 7); ctx.fill(); }
        if (cam.z > 0.7 && o.nome) { ctx.fillStyle = '#efe9dd'; ctx.font = '11px "Barlow Semi Condensed", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(o.nome, pp.x, pp.y + 24); }
      } else if (o.tipo === 'jazida') {
        ctx.fillStyle = '#d9b25c'; ctx.beginPath(); ctx.moveTo(pp.x, pp.y - 9); ctx.lineTo(pp.x + 8, pp.y); ctx.lineTo(pp.x, pp.y + 9); ctx.lineTo(pp.x - 8, pp.y); ctx.fill();
      } else if (o.tipo === 'ruina-antiga') {
        ctx.strokeStyle = o.esgotada ? '#6b6560' : '#c9a0ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(pp.x, pp.y, 9, Math.PI, 0); ctx.stroke();
      }
    });
    RP.mapa.desenhosExtras.forEach(function (f) { try { f(ctx, dados, cam, agora); } catch (e) { console.error(e); } });
    if (selecionado >= 0) { var s = H.centroH(selecionado); ctx.strokeStyle = '#e07a2e'; ctx.lineWidth = 3; hexPath(s.x, s.y, H.R - 2); ctx.stroke(); }
    ctx.restore();
  }
  RP.mapa.desenhar = desenhar;

  var ativo = false;
  function laco() {
    if (!ativo) return;
    desenhar();
    setTimeout(function () { anim = requestAnimationFrame(laco); }, 250);
  }

  function folhaHex(h) {
    selecionado = h; desenhar();
    var t = dados.terreno[h], obj = dados.porHex[h] || [];
    var conhecido = t !== '?';
    var nomeT = conhecido ? H.NOME_TERRENO[H.TERRENO[t.toLowerCase()]] + (t !== t.toLowerCase() ? ' com rio' : '') : 'Névoa';
    var idade = dados.idade[h];
    var corpo = '<div class="info"><div class="info-linha"><span class="fraco">Terreno</span><span>' + nomeT + '</span></div>' +
      '<div class="info-linha"><span class="fraco">Informação</span><span>' + (idade === 0 ? '<span class="selo selo-visivel">ao vivo</span>' : idade > 0 ? '<span class="selo selo-antigo">' + RP.fmtHa(idade / 60) + '</span>' : 'nunca explorado') + '</span></div>' +
      obj.map(function (o) {
        if (o.tipo === 'local') return '<div class="info-linha"><span class="fraco">' + (o.dono === 'meu' ? 'Seu local' : 'Local') + '</span><span>' + RP.esc(o.nome) + (o.nivel ? ' · Nv ' + o.nivel : '') + '</span></div>';
        if (o.tipo === 'jazida') return '<div class="info-linha"><span class="fraco">Jazida</span><span>' + RP.NOMES_REC[o.recurso] + ' · ' + Math.round(o.restante * 100) + '% restante</span></div>';
        if (o.tipo === 'ruina-antiga') return '<div class="info-linha"><span class="fraco">Ruína antiga</span><span>' + (o.esgotada ? 'já escavada' : 'guarda uma relíquia') + '</span></div>';
        if (o.tipo === 'marcha') return '<div class="info-linha"><span class="fraco">' + (o.dono === 'meu' ? 'Sua marcha' : 'Forças desconhecidas') + '</span><span>' + RP.esc((RP.NOMES_MARCHA || {})[o.marcha] || o.marcha) + '</span></div>';
        return '';
      }).join('') +
      RP.mapa.extrasFolhaHex.map(function (f) { return f(h, dados) || ''; }).join('') + '</div>';
    var acoes = '';
    if (alvoFundar) acoes += '<button type="button" class="btn btn-p btn-primario" data-fundar-aqui="' + h + '">' + RP.icone('castelo') + 'Fundar ' + RP.esc((RP.NOMES_FUNDAR[alvoFundar] || '').toLowerCase()) + ' aqui</button>';
    else if (conhecido && !obj.length) acoes += '<a class="btn btn-p" href="#/construcao?aba=novos">' + RP.icone('castelo') + 'Fundar local</a>';
    acoes += RP.mapa.acoesFolhaHex.map(function (f) { return f(h, dados) || ''; }).join('');
    var meu = obj.filter(function (o) { return o.tipo === 'local' && o.dono === 'meu'; })[0];
    if (meu) acoes += '<button type="button" class="btn btn-p" data-local="' + meu.id + '">' + RP.icone('info') + 'Detalhes</button>';
    RP.abrirFolha({ titulo: 'Hexágono ' + H.c(h) + ', ' + H.l(h), corpo: corpo, acoes: acoes, sobreNav: false, aoFechar: function () { selecionado = -1; desenhar(); } });
  }
  RP.mapa.folhaHex = folhaHex;

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-fundar-aqui]');
    if (!b) return;
    var h = +b.getAttribute('data-fundar-aqui'), tipo = alvoFundar;
    RP.tentar(RP.post('/obras', { acao: 'fundar', tipo: tipo, hex: h })).then(function (it) {
      RP.fecharFolha(); alvoFundar = null; atualizarFaixa();
      RP.aviso({ titulo: 'Na fila: ' + it.rotulo, texto: 'Os carregadores levam o material até lá.', icone: 'castelo', tipo: 'sucesso' });
      RP.recarregarReino(); carregar();
    });
  });

  function atualizarFaixa() {
    var f = RP.$('.mapa-faixa');
    if (!f) return;
    f.hidden = !alvoFundar;
    if (alvoFundar) f.innerHTML = RP.icone('alvo', 'ico-p') + '<span>Toque num hexágono livre e explorado para fundar: <b>' + RP.esc(RP.NOMES_FUNDAR[alvoFundar]) + '</b></span><button type="button" class="btn btn-p" data-cancelar-fundar>Cancelar</button>';
  }

  RP.registrarTela('mapa', {
    nav: true, fixa: true,
    montar: function (el) {
      el.innerHTML = '<div class="mapa-topo">' + RP.barraRecursos() + '</div>' +
        '<div class="mapa-faixa card" hidden></div>' +
        '<canvas class="mapa-canvas" aria-label="Mapa tático. Arraste para mover, pinça ou roda para zoom, toque num hexágono para detalhes."></canvas>' +
        '<div class="mapa-controles"><button type="button" class="btn btn-icone" data-zoom="1.25" aria-label="Aproximar">' + RP.icone('mais') + '</button>' +
        '<button type="button" class="btn btn-icone" data-zoom="0.8" aria-label="Afastar">' + RP.icone('menos') + '</button>' +
        '<button type="button" class="btn btn-icone" data-centro aria-label="Ir para o castelo">' + RP.icone('castelo') + '</button></div>';
      cv = RP.$('.mapa-canvas', el); ctx = cv.getContext('2d');
      RP.gestos(cv, {
        arrasto: function (dx, dy) { cam.x -= dx / cam.z; cam.y -= dy / cam.z; desenhar(); },
        pinca: function (f) { cam.z = Math.max(0.25, Math.min(2.5, cam.z * Math.pow(f, 0.08))); desenhar(); },
        roda: function (f) { cam.z = Math.max(0.25, Math.min(2.5, cam.z * f)); desenhar(); },
        toque: function (x, y) { var p = tela(x, y), h = H.pixelParaHex(p.x, p.y); if (h >= 0 && dados) folhaHex(h); }
      });
      el.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-zoom]'))) { cam.z = Math.max(0.25, Math.min(2.5, cam.z * +b.getAttribute('data-zoom'))); desenhar(); }
        else if (e.target.closest('[data-centro]')) { var c = RP.castelo(); if (c) { centralizar(c.hex); desenhar(); } }
        else if (e.target.closest('[data-cancelar-fundar]')) { alvoFundar = null; atualizarFaixa(); }
      });
      window.addEventListener('resize', desenhar);
      RP.ouvir('mapa', function () { if (!el.hidden) carregar(); });
      RP.ouvir('marchas', function () { if (!el.hidden) carregar(); });
      var c = RP.castelo(); if (c) centralizar(c.hex);
    },
    entrar: function (el, p) {
      alvoFundar = p.get('fundar'); atualizarFaixa();
      carregar().then(function () {
        var foco = p.get('foco');
        if (foco != null && foco !== '') { centralizar(+foco); desenhar(); }
      }).catch(function () { /* aviso já mostrado */ });
      ativo = true; cancelAnimationFrame(anim); laco();
    },
    sair: function () { ativo = false; cancelAnimationFrame(anim); anim = 0; }
  });
})();
