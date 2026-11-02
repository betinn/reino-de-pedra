/* Reino de Pedra — Fauna, caça e rotas: tela Caça (alvo, rendimento, grupo com força × perigo, caminho), fauna e
   camada Perigo no mapa (com a idade da informação), foto envelhecida dos locais, avistamentos, folha do bando e
   obra de rota/ponte num hexágono. Porte de prototipo/js/acoes.js (Caça) e mapa.js (fauna, perigo).
   Tipos de objeto do mapa: fauna, perigo, avistamento, espionado, camada-perigo (RP.mapa.tiposObjeto). */
(function () {
  'use strict';
  var RP = window.RP, H = RP.hex;
  var NIVEL_N = { 1: 'baixo', 2: 'medio', 3: 'alto' };
  var ANIMAL_LETRA = { l: 'lobos', j: 'javalis', u: 'ursos', c: 'crocodilos' };

  function linha(r, v) { return '<div class="info-linha"><span class="fraco">' + r + '</span><span>' + v + '</span></div>'; }
  function cssVar(n, padrao) { var v = getComputedStyle(document.documentElement).getPropertyValue(n); return (v || '').trim() || padrao; }
  function haTxt(t) { return RP.fmtHa(Math.max(0, RP.agora() - t) / 3600000); }
  function objetosHex(h, dados) { return (dados && dados.porHex && dados.porHex[h]) || []; }
  function camada(dados) { return dados && dados.objetos ? dados.objetos.filter(function (o) { return o.tipo === 'camada-perigo'; })[0] : null; }
  RP.perigoConhecido = function (dados, h) {
    var c = camada(dados); if (!c) return null;
    var n = +c.niveis[h]; if (!n) return null;
    return { nivel: NIVEL_N[n], animal: ANIMAL_LETRA[c.animais[h]], idade: dados.idade ? dados.idade[h] : 0 };
  };

  /* ---------------------------------------------------------------- ícones como imagem para o canvas */
  var imgs = {};
  function imagem(id, claro) {
    var k = id + (claro ? '-c' : '');
    if (imgs[k]) return imgs[k].complete ? imgs[k] : null;
    var s = document.getElementById('i-' + id); if (!s) return null;
    var cor = claro ? (cssVar('--barra-texto', 'white')) : '#1b0e04', borda = claro ? cssVar('--barra-fundo', 'black') : '#1b0e04';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><style>.ic-s{fill:' + cor + ';stroke:' + borda + ';stroke-width:1;stroke-linejoin:round}' +
      '.ic-d{fill:none;stroke:' + borda + ';stroke-width:1.4;stroke-linecap:round}.ic-l{fill:none;stroke:' + cor + ';stroke-width:2;stroke-linecap:round;stroke-linejoin:round}</style>' + s.innerHTML + '</svg>';
    var im = new Image();
    im.onload = function () { if (RP.mapa.desenhar) RP.mapa.desenhar(); };
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    imgs[k] = im;
    return null;
  }
  function corNivel(n) { return cssVar('--perigo-' + n, n === 'alto' ? 'firebrick' : n === 'medio' ? 'darkorange' : 'goldenrod'); }

  /* ---------------------------------------------------------------- camada Perigo (liga e desliga) */
  var perigoLigado = RP.pref('camada-perigo') === '1';
  RP.mapa.camadas = RP.mapa.camadas || {};
  RP.mapa.camadas.perigo = { nome: 'Perigo', icone: 'pata', ligada: function () { return perigoLigado; }, alternar: alternarPerigo };
  function alternarPerigo() {
    perigoLigado = !perigoLigado; RP.pref('camada-perigo', perigoLigado ? '1' : '0');
    RP.$$('[data-camada-perigo]').forEach(function (b) { b.setAttribute('aria-pressed', String(perigoLigado)); });
    if (perigoLigado) RP.aviso({ titulo: 'Camada Perigo', texto: 'Áreas conhecidas com fauna hostil. Informação antiga aparece mais apagada.', icone: 'pata', ms: 2200 });
    if (RP.mapa.desenhar) RP.mapa.desenhar();
  }
  document.addEventListener('rp:tela', function (ev) {
    if (ev.detail !== 'mapa') return;
    var ctl = RP.$('[data-tela=mapa] .mapa-controles');
    if (ctl && !RP.$('[data-camada-perigo]', ctl)) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'btn btn-icone'; b.setAttribute('data-camada-perigo', ''); b.setAttribute('aria-pressed', String(perigoLigado));
      b.setAttribute('aria-label', 'Camada Perigo'); b.innerHTML = RP.icone('pata');
      ctl.appendChild(b);
    }
  });
  document.addEventListener('click', function (e) { if (e.target.closest('[data-camada-perigo]')) alternarPerigo(); });

  function hexPath(ctx, x, y, r) {
    ctx.beginPath();
    for (var i = 0; i < 6; i++) { var a = (Math.PI / 180) * (60 * i - 30); if (i) ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); else ctx.moveTo(x + r * Math.cos(a), y + r * Math.sin(a)); }
    ctx.closePath();
  }
  function desenharCamada(ctx, dados, cam) {
    var c = camada(dados); if (!c || !perigoLigado) return;
    var cv = ctx.canvas, w = cv.clientWidth / cam.z, hh = cv.clientHeight / cam.z;
    var x0 = cam.x - w / 2 - H.W, x1 = cam.x + w / 2 + H.W, y0 = cam.y - hh / 2 - H.R * 2, y1 = cam.y + hh / 2 + H.R * 2;
    for (var h = 0; h < c.niveis.length; h++) {
      var n = +c.niveis[h]; if (!n) continue;
      var p = H.centroH(h); if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      var idade = dados.idade ? dados.idade[h] : 0;
      ctx.globalAlpha = (0.18 + 0.08 * n) * (idade > 0 ? 0.6 : 1);
      ctx.fillStyle = corNivel(NIVEL_N[n]); hexPath(ctx, p.x, p.y, H.R - 1); ctx.fill();
      ctx.globalAlpha = idade > 0 ? 0.35 : 0.6; ctx.strokeStyle = corNivel(NIVEL_N[n]); ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------------------------------------------------------- desenho tático dos objetos do sistema */
  function desenharFauna(ctx, o, p, cam) {
    ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, 7);
    ctx.fillStyle = cssVar('--ent-fundo', '#22262c'); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = corNivel(o.nivel); ctx.stroke();
    var im = imagem((RP.ANIMAIS[o.animal] || {}).icone || 'pata', true);
    if (im) ctx.drawImage(im, p.x - 9, p.y - 9, 18, 18);
    if (o.qtd && cam.z > 0.5) {
      ctx.fillStyle = corNivel(o.nivel); ctx.beginPath(); ctx.arc(p.x + 11, p.y - 11, 7, 0, 7); ctx.fill();
      ctx.fillStyle = '#1b0e04'; ctx.font = '700 10px "Barlow Semi Condensed", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(o.qtd), p.x + 11, p.y - 10.5); ctx.textBaseline = 'alphabetic';
    }
  }
  function desenharPlaca(ctx, o, p, cam) {
    ctx.globalAlpha = o.foto ? 0.78 : 1;
    ctx.beginPath(); ctx.moveTo(p.x, p.y - 13); ctx.lineTo(p.x + 13, p.y + 10); ctx.lineTo(p.x - 13, p.y + 10); ctx.closePath();
    ctx.fillStyle = corNivel(o.nivel); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#1b0e04'; ctx.stroke();
    var im = imagem('pata', false); if (im) ctx.drawImage(im, p.x - 7, p.y - 5, 14, 14);
    if (o.foto && cam.z > 0.7) {
      ctx.fillStyle = cssVar('--cor-texto-2', '#bfb6a8'); ctx.font = '11px "Barlow Semi Condensed", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(haTxt(o.visto), p.x, p.y + 24);
    }
    ctx.globalAlpha = 1;
  }
  function desenharAvistamento(ctx, o, p, cam) {
    ctx.setLineDash([4, 4]); ctx.lineWidth = 2; ctx.strokeStyle = cssVar('--cor-alerta', '#e8b947');
    ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    var im = imagem(o.avistado === 'espiao' ? 'batedor' : 'tropas', true); if (im) { ctx.globalAlpha = 0.7; ctx.drawImage(im, p.x - 9, p.y - 9, 18, 18); ctx.globalAlpha = 1; }
    if (cam.z > 0.6) { ctx.fillStyle = cssVar('--cor-alerta', '#e8b947'); ctx.font = '11px "Barlow Semi Condensed", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(haTxt(o.quando), p.x, p.y + 26); }
  }
  /* locais vistos há tempo: véu e anel tracejado por cima do marcador (informação antiga, parada) */
  function desenharFoto(ctx, o, p, cam) {
    ctx.fillStyle = 'rgba(13,15,18,.45)'; ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, 7); ctx.fill();
    ctx.setLineDash([3, 3]); ctx.lineWidth = 1.5; ctx.strokeStyle = cssVar('--cor-alerta', '#e8b947'); ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    var im = imagem('relogio', true); if (im && cam.z > 0.55) ctx.drawImage(im, p.x + 6, p.y - 16, 11, 11);
  }
  function desenharExplorador(ctx, o, p) {
    ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, 7);
    ctx.fillStyle = o.dono === 'meu' ? cssVar('--cor-info', 'steelblue') : cssVar('--cor-perigo', 'firebrick'); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.stroke();
    var im = imagem('explorador', true); if (im) ctx.drawImage(im, p.x - 7, p.y - 7, 14, 14);
  }
  function posMarcha(o, t) {
    var tp = o.tempos, cm = o.caminho;
    if (!cm || !cm.length) return H.centroH(o.hex);
    if (!tp || tp.length < 2 || t <= tp[0]) return H.centroH(cm[0]);
    if (t >= tp[tp.length - 1]) return H.centroH(cm[cm.length - 1]);
    for (var i = 0; i < tp.length - 1; i++) if (t < tp[i + 1]) {
      var a = H.centroH(cm[i]), b = H.centroH(cm[i + 1]), f = (t - tp[i]) / Math.max(1, tp[i + 1] - tp[i]);
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    }
    return H.centroH(cm[cm.length - 1]);
  }

  RP.mapa.tiposObjeto = RP.mapa.tiposObjeto || {};
  RP.mapa.tiposObjeto.fauna = {
    nome: 'Fauna', icone: 'pata', desenharTatico: desenharFauna,
    folha: function (o) { return folhaFauna(o); }
  };
  RP.mapa.tiposObjeto.perigo = {
    nome: 'Área de perigo', icone: 'pata', desenharTatico: desenharPlaca,
    folha: function (o) { return folhaFauna(o); }
  };
  RP.mapa.tiposObjeto.avistamento = { nome: 'Avistamento', icone: 'olho', desenharTatico: desenharAvistamento, folha: function () { return null; } };
  RP.mapa.tiposObjeto.espionado = { nome: 'Espionado', icone: 'batedor', desenharTatico: function () { /* só na folha */ }, folha: function () { return null; } };
  RP.mapa.tiposObjeto['camada-perigo'] = { nome: 'Perigo', icone: 'pata', camada: true, desenharTatico: function () { /* desenhada como camada */ }, folha: function () { return null; } };

  /* mapa atual: desenhosExtras recebe o canvas já em coordenadas de mundo */
  RP.mapa.desenhosExtras = RP.mapa.desenhosExtras || [];
  RP.mapa.desenhosExtras.push(function (ctx, dados, cam, agora) {
    desenharCamada(ctx, dados, cam);
    dados.objetos.forEach(function (o) {
      if (o.hex == null && o.tipo !== 'marcha') return;
      if (o.tipo === 'fauna') desenharFauna(ctx, o, H.centroH(o.hex), cam);
      else if (o.tipo === 'perigo' && !(dados.porHex[o.hex] || []).some(function (x) { return x.tipo === 'fauna'; })) desenharPlaca(ctx, o, H.centroH(o.hex), cam);
      else if (o.tipo === 'avistamento') desenharAvistamento(ctx, o, H.centroH(o.hex), cam);
      else if (o.foto && o.tipo === 'local') desenharFoto(ctx, o, H.centroH(o.hex), cam);
      else if (o.tipo === 'marcha' && o.marcha === 'explorador') desenharExplorador(ctx, o, posMarcha(o, agora));
    });
  });

  /* ---------------------------------------------------------------- folha do hexágono: fauna, perigo e rota */
  function folhaFauna(o) {
    var A = RP.ANIMAIS[o.animal] || { nome: 'Animais', icone: 'pata', um: 'animal' };
    var vivo = o.tipo === 'fauna';
    return '<div class="perigo-linha nivel-' + o.nivel + '">' + RP.icone(A.icone) + '<span><b>' + A.nome + (o.qtd ? ' (≈ ' + o.qtd + ')' : '') + ' · perigo ' + RP.NOME_NIVEL[o.nivel].toLowerCase() + '</b>' +
      (vivo ? ' <span class="selo selo-visivel">à vista</span>' : ' <span class="fraco">(visto ' + haTxt(o.visto) + ')</span>') +
      '<br><small>Ameaça exploradores sozinhos, grupos pequenos e caravanas. Rotas reduzem a presença; um bando abatido volta em 24 h.</small></span></div>';
  }
  RP.mapa.extrasFolhaHex.push(function (h, dados) {
    var obj = objetosHex(h, dados), html = '';
    var f = obj.filter(function (o) { return o.tipo === 'fauna'; })[0] || obj.filter(function (o) { return o.tipo === 'perigo'; })[0];
    if (f) html += folhaFauna(f);
    else {
      var p = RP.perigoConhecido(dados, h);
      if (p) {
        var A = RP.ANIMAIS[p.animal] || { nome: 'Animais', icone: 'pata' };
        html += '<div class="perigo-linha nivel-' + p.nivel + '">' + RP.icone(A.icone) + '<span><b>Perigo ' + RP.NOME_NIVEL[p.nivel].toLowerCase() + '</b> · área de ' + A.nome.toLowerCase() +
          (p.idade > 0 ? ' <span class="fraco">(visto ' + RP.fmtHa(p.idade / 60) + ')</span>' : '') + '<br><small>Ameaça exploradores sozinhos, grupos pequenos e caravanas.</small></span></div>';
      }
    }
    if (dados && dados.rotas && dados.rotas.indexOf(h) >= 0) html += linha('Rota', dados.pontes && dados.pontes.indexOf(h) >= 0 ? 'ponte pública' : 'rota pública');
    return html;
  });
  RP.mapa.acoesFolhaHex.push(function (h, dados) {
    if ((RP.envio && RP.envio.ativo())) return '';
    var obj = objetosHex(h, dados), html = '';
    var f = obj.filter(function (o) { return o.tipo === 'fauna'; })[0] || obj.filter(function (o) { return o.tipo === 'perigo'; })[0];
    if (f) html += '<a class="btn btn-p btn-primario" href="#/caca?fauna=' + f.id + '">' + RP.icone('lobo') + 'Caçar</a>';
    var t = dados && dados.terreno ? dados.terreno[h] : '?';
    if (t && t !== '?' && !(dados.rotas && dados.rotas.indexOf(h) >= 0)) {
      var rio = t !== t.toLowerCase();
      html += '<button type="button" class="btn btn-p" data-rota-aqui="' + h + '">' + RP.icone(rio ? 'ponte' : 'rota') + (rio ? 'Construir ponte aqui' : 'Construir rota aqui') + '</button>';
    }
    return html;
  });

  function folhaRota(h) {
    RP.tentar(RP.get('/rotas/previa?hex=' + h)).then(function (p) {
      var corpo = '<p class="nota-regra">' + RP.icone('rota', 'ico-p') + '<span>Rotas são <b>ruas públicas</b>: qualquer reino vê, usa e ganha a mesma velocidade, inclusive inimigos. Rotas também reduzem a presença de animais.</span></p>' +
        '<div class="info">' + linha('Hexágono', H.c(h) + ', ' + H.l(h)) + linha('Terreno', p.terreno ? RP.esc(H.NOME_TERRENO[p.terreno] || p.terreno) + (p.rio ? ' com rio' : '') : '—') +
        linha('Obra', p.ponte ? 'Ponte (o rio sem ponte só se cruza pelo vau, mais lento)' : 'Rota (custo e tempo crescem com o terreno)') +
        linha('Custo', RP.custoHTML(p.custo)) + linha('Tempo', '<span class="tempo">' + RP.icone('relogio', 'ico-p') + RP.fmtDuracao(p.seg) + '</span>') + '</div>' +
        (p.motivo ? '<p class="txt-alerta" style="margin-top:var(--esp-2)">' + RP.esc(p.motivo) + '</p>' : '<p class="fraco" style="font-size:var(--fs-2);margin-top:var(--esp-2)">O material sai dos locais mais próximos e vai a pé até lá. A obra só começa quando ele chega.</p>');
      RP.abrirFolha({
        titulo: p.ponte ? 'Construir ponte' : 'Construir rota', sobreNav: false,
        icone: '<span class="ico-placa folha-ico">' + RP.icone(p.ponte ? 'ponte' : 'rota') + '</span>',
        corpo: corpo,
        acoes: '<button type="button" class="btn btn-p btn-primario' + (p.motivo ? ' btn-inativo' : '') + '" data-rota-confirmar="' + h + '">' + RP.icone('martelo') + 'Construir</button>'
      });
    }, function () { /* aviso já mostrado */ });
  }
  document.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-rota-aqui]'))) { folhaRota(+b.getAttribute('data-rota-aqui')); return; }
    if ((b = e.target.closest('[data-rota-confirmar]'))) {
      if (b.classList.contains('btn-inativo')) return;
      RP.tentar(RP.post('/rotas', { hex: +b.getAttribute('data-rota-confirmar') })).then(function (it) {
        RP.fecharFolha();
        RP.aviso({ titulo: 'Na fila: ' + it.rotulo, texto: it.materialCompleto ? '' : 'Os carregadores levam o material até lá.', icone: 'rota', tipo: 'sucesso' });
        RP.recarregarReino(); if (RP.mapa.recarregar) RP.mapa.recarregar();
      });
    }
  });

  /* ---------------------------------------------------------------- construção: aba Rotas */
  RP.extrasConstrucao = RP.extrasConstrucao || [];
  RP.extrasConstrucao.push({
    aba: 'rotas', nome: 'Rotas',
    html: function (r) {
      var d = RP.exploracao.dados, g = d && d.regras;
      if (!d) { RP.exploracao.carregar().then(function () { if (RP.$('[data-tela=construcao]') && !RP.$('[data-tela=construcao]').hidden) RP.recarregarReino(); }, function () { /* offline */ }); }
      var obras = ((r.filas || {}).obras || []).filter(function (i) { return i.tipo === 'rota'; });
      var tabela = g ? '<div class="info">' + Object.keys(g.terreno).map(function (t) {
        var c = {}; Object.keys(g.rota.custo).forEach(function (k) { c[k] = Math.round(g.rota.custo[k] * g.terreno[t]); });
        return linha(RP.esc(H.NOME_TERRENO[t] || t), RP.custoHTML(c) + ' <span class="tempo">' + RP.fmtDuracao(g.rota.tempo * g.terreno[t]) + '</span>');
      }).join('') + linha('Ponte (rio)', RP.custoHTML(g.ponte.custo) + ' <span class="tempo">' + RP.fmtDuracao(g.ponte.tempo) + '</span>') + '</div>' : '';
      return '<p class="nota-regra">' + RP.icone('rota', 'ico-p') + '<span>Rotas são <b>ruas públicas</b>: todos usam e ganham a mesma velocidade. Num rio, a rota é uma ponte. Rotas só aparecem nas áreas que você já explorou e reduzem a presença de animais.</span></p>' +
        '<div class="card pilha"><b>Custo por hexágono</b>' + tabela + '<a class="btn btn-p" href="#/mapa">' + RP.icone('alvo') + 'Escolher no mapa</a>' +
        '<small class="fraco">No mapa, toque num hexágono explorado e em "Construir rota aqui".</small></div>' +
        (obras.length ? '<div class="secao-titulo">Na fila</div><div class="card pilha">' + obras.map(function (i) { i.fila = 'obras'; return RP.itemFilaServidor(i); }).join('') + '</div>' : '');
    }
  });

  /* ---------------------------------------------------------------- Caça */
  var caca = { fauna: null, de: null, grupo: {}, seguro: false, previa: null, chave: '' };
  function bandos() { var d = RP.exploracao.dados; return d ? d.bandos : []; }
  function bando(id) { return bandos().filter(function (b) { return b.id === id; })[0]; }
  function localCaca() {
    var t = RP.tropas; if (!t) return null;
    var com = t.locais.filter(function (l) { return RP.somaGrupo(l.guarnicao) > 0; });
    return com.filter(function (l) { return l.id === caca.de; })[0] || com.filter(function (l) { return l.tipo === 'castelo'; })[0] || com[0] || null;
  }
  function forcaGrupo(g) {
    return Object.keys(g || {}).reduce(function (s, k) { var u = RP.unidade(k); return s + (g[k] || 0) * (u ? u.forcaFauna : 0); }, 0);
  }
  function riscoLocal(nivel, forca, lim) {
    if (forca >= 2 * lim) return 'nenhum';
    if (forca >= lim) return { baixo: 'nenhum', medio: 'baixo', alto: 'medio' }[nivel];
    return nivel;
  }
  function previaCaca(el) {
    var b = bando(caca.fauna), l = localCaca();
    if (!b || !l || !RP.somaGrupo(caca.grupo)) { caca.previa = null; caca.chave = ''; return; }
    var corpo = { deLocalId: l.id, tropas: caca.grupo, destinoHex: b.hex }, chave = JSON.stringify(corpo);
    if (chave === caca.chave) return;
    caca.chave = chave; caca.previa = null;
    RP.post('/exploracao/previa', corpo).then(function (p) { if (caca.chave === chave) { caca.previa = p; desenharCaca(el); } },
      function (e) { if (caca.chave === chave) { caca.previa = { erro: e.message }; desenharCaca(el); } });
  }
  function desenharCaca(el) {
    var d = RP.exploracao.dados, alvoEl = RP.$('.caca-conteudo', el);
    if (!d || !RP.tropas) { alvoEl.innerHTML = '<p class="fraco">Carregando…</p>'; return; }
    var lista = bandos();
    if (!lista.length) {
      alvoEl.innerHTML = '<div class="card pilha"><b>Nenhum animal conhecido</b><p class="fraco">Explore florestas, colinas, montanhas e pântanos para achar bandos. Animais à vista e áreas de perigo já vistas aparecem aqui.</p>' +
        '<a class="btn btn-p" href="#/exploradores">' + RP.icone('explorador') + 'Exploradores</a></div>';
      RP.$('.rodape-resumo', el).innerHTML = ''; RP.$('[data-cacar]', el).classList.add('btn-inativo');
      return;
    }
    if (!bando(caca.fauna)) caca.fauna = lista[0].id;
    var b = bando(caca.fauna), A = RP.ANIMAIS[b.animal] || { nome: b.animal, icone: 'pata' }, rend = d.regras.caca[b.animal] || {};
    var l = localCaca(), disp = l ? l.guarnicao : {};
    Object.keys(caca.grupo).forEach(function (k) { if ((caca.grupo[k] || 0) > (disp[k] || 0)) caca.grupo[k] = disp[k] || 0; });
    var lim = d.regras.limites[b.nivel], forca = forcaGrupo(caca.grupo), total = RP.somaGrupo(caca.grupo);
    var risco = riscoLocal(b.nivel, forca, lim);
    previaCaca(el);
    var p = caca.previa;
    var origens = RP.tropas.locais.filter(function (x) { return RP.somaGrupo(x.guarnicao) > 0; });
    var h = '<div class="secao-titulo" style="margin-top:0">Alvo</div><div class="escolhas escolhas-lista">' + lista.map(function (x) {
      var AA = RP.ANIMAIS[x.animal] || { nome: x.animal, icone: 'pata' };
      return '<button type="button" class="escolha escolha-linha" data-caca-fauna="' + x.id + '" aria-pressed="' + (x.id === caca.fauna) + '"><span class="ico-placa nivel-' + x.nivel + '">' + RP.icone(AA.icone) + '</span>' +
        '<span class="escolha-txt"><b>' + AA.nome + (x.qtd ? ' (≈ ' + x.qtd + ')' : '') + '</b><small class="fraco">Hexágono ' + H.c(x.hex) + ', ' + H.l(x.hex) + ' · ' + (x.vivo ? 'à vista agora' : 'visto ' + RP.fmtHa(x.idadeMin / 60)) + '</small></span>' + RP.seloNivel(x.nivel, RP.NOME_NIVEL[x.nivel]) + '</button>';
    }).join('') + '</div>' +
      '<div class="card rend-card"><span class="rotulo">Rendimento por bando · ' + A.nome.toLowerCase() + '</span><div class="linha" style="flex-wrap:wrap;margin-top:6px">' +
      ['comida', 'couro', 'peles'].map(function (k) { return '<span class="selo selo-g">' + RP.icone(k, 'r-' + k) + RP.NOMES_REC[k] + ' <b class="num">' + RP.num(rend[k] || 0) + '</b></span>'; }).join('') + '</div>' +
      '<p class="fraco" style="font-size:var(--fs-2);margin-top:var(--esp-2)">' + RP.fmtDuracao(d.regras.cacaMin * 60) + ' no local; o grupo traz o que couber na carga. O bando volta em ' + d.regras.voltaH + ' h: caçar não limpa a região para sempre.' +
      (b.vivo ? '' : ' Última posição conhecida ' + RP.fmtHa(b.idadeMin / 60) + ': o bando pode ter saído da área.') + '</p></div>' +
      '<div class="secao-titulo">Grupo de caça</div>' +
      (origens.length > 1 ? '<div class="abas abas-rolagem" role="group" aria-label="De onde saem">' + origens.map(function (x) {
        return '<button type="button" class="aba" data-caca-de="' + x.id + '" aria-pressed="' + (l && x.id === l.id) + '">' + RP.esc(x.nome) + '</button>';
      }).join('') + '</div>' : '') +
      '<div class="card pilha" data-caca-grupo>' + RP.grupoTropas.linhas(caca.grupo, disp) +
      '<div class="forca"><div class="linha-entre"><span class="rotulo">Força do grupo: ' + RP.num(forca) + ' de ' + RP.num(lim * 2) + '</span><span class="fraco">' + total + ' ' + (total === 1 ? 'unidade' : 'unidades') + '</span></div>' +
      '<div class="barra barra-grossa forca-' + risco + '"><i style="width:' + Math.min(100, (100 * forca) / (lim * 2)).toFixed(0) + '%"></i></div>' +
      '<div class="forca-marcas"><span>Grupo pequeno</span><span>Passa ileso</span></div></div></div>' +
      (!total ? '' : risco === 'nenhum' ? '<div class="risco-linha ok">' + RP.icone('escudo') + '<span><b>Grupo forte o bastante</b><br><small>Com o dobro da força dos animais, ninguém se fere.</small></span></div>'
        : '<div class="perigo-linha nivel-' + risco + '">' + RP.icone(A.icone) + '<span><b>Risco ' + RP.NOME_NIVEL[risco].toLowerCase() + ' na caçada</b><br><small>O grupo perde ' + Math.round(100 * (forca >= lim ? d.regras.perda.acima : d.regras.perda.abaixo)) + '% na luta. Tropas mortas não voltam; se ninguém sobrar, não há caça.</small></span></div>') +
      '<div class="secao-titulo">Caminho</div>' +
      (!total ? '<p class="fraco">Escolha quem vai caçar.</p>' : !p ? '<p class="fraco">Calculando o caminho…</p>' : p.erro ? '<p class="txt-alerta">' + RP.esc(p.erro) + '</p>' : !p.curta.ok ? '<p class="fraco">Sem caminho possível.</p>' :
        '<div class="pilha">' + RP.opcaoCaminhoExp('curta', p.curta, caca.seguro) + (p.segura.ok && (p.segura.hexes !== p.curta.hexes || p.segura.min !== p.curta.min) ? RP.opcaoCaminhoExp('segura', p.segura, caca.seguro) : '') + '</div>' +
        RP.blocoRisco((caca.seguro && p.segura.ok ? p.segura : p.curta).risco, false)) +
      '<p class="fraco" style="font-size:var(--fs-2);margin:var(--esp-3) 0 var(--esp-6)">O tempo de viagem segue a unidade mais lenta do grupo. Caçar não conta para a veterania.</p>';
    alvoEl.innerHTML = h;
    var esc = p && p.curta && p.curta.ok ? (caca.seguro && p.segura.ok ? p.segura : p.curta) : null;
    RP.$('.rodape-resumo', el).innerHTML = esc && total ? '<div class="resumo-linha"><b>' + total + ' caçadores → ' + A.nome.toLowerCase() + '</b><span class="tempo">' + RP.icone('relogio', 'ico-p') + 'chega em ' + RP.fmtDuracao(esc.min * 60) + '</span></div>' : '<div class="resumo-linha fraco">Monte o grupo de caça.</div>';
    RP.$('[data-cacar]', el).classList.toggle('btn-inativo', !esc || !total);
  }
  RP.registrarTela('caca', {
    secao: 'tropas',
    montar: function (el) {
      el.innerHTML = RP.topoVoltar('Caça', 'tropas', 'Comida, couro e peles') + '<div class="conteudo-tela caca-conteudo"></div>' +
        '<div class="rodape-acao rodape-com-resumo"><div class="rodape-resumo"></div><button type="button" class="btn btn-primario btn-bloco btn-grande" data-cacar>' + RP.icone('lobo') + 'Sair para caçar</button></div>';
      var vivo = function () { if (!el.hidden) desenharCaca(el); };
      document.addEventListener('rp:exploracao', vivo);
      document.addEventListener('rp:tropas', vivo);
      el.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-caca-fauna]'))) { caca.fauna = +b.getAttribute('data-caca-fauna'); desenharCaca(el); return; }
        if ((b = e.target.closest('[data-caca-de]'))) { caca.de = +b.getAttribute('data-caca-de'); caca.grupo = {}; desenharCaca(el); return; }
        if ((b = e.target.closest('[data-exp-caminho]'))) { caca.seguro = b.getAttribute('data-exp-caminho') === 'segura'; desenharCaca(el); return; }
        var l = localCaca();
        if (e.target.closest('[data-caca-grupo]') && l && RP.grupoTropas.clique(e, caca.grupo, l.guarnicao)) { desenharCaca(el); return; }
        if (e.target.closest('[data-cacar]')) {
          var bd = bando(caca.fauna), p = caca.previa;
          if (!RP.somaGrupo(caca.grupo)) { RP.aviso({ titulo: 'Grupo vazio', texto: 'Escolha quem vai caçar.', icone: 'info', tipo: 'alerta' }); return; }
          if (!bd || !l || !p || !p.curta || !p.curta.ok) return;
          RP.tentar(RP.post('/tropas/enviar', { deLocalId: l.id, tropas: caca.grupo, destinoHex: bd.hex, ordem: 'cacar', seguro: !!(caca.seguro && p.segura.ok) })).then(function (ex) {
            RP.aviso({ titulo: 'Caçadores a caminho', texto: 'Chegam ' + RP.fmtHora(ex.chegada) + '.', icone: 'lobo', tipo: 'sucesso' });
            caca.grupo = {}; caca.chave = '';
            RP.carregarTropas().catch(function () { /* offline */ }); RP.recarregarReino();
            RP.ir('mapa?foco=' + bd.hex);
          });
        }
      });
    },
    entrar: function (el, params) {
      if (params.get('fauna')) caca.fauna = +params.get('fauna');
      caca.chave = '';
      desenharCaca(el);
      Promise.all([RP.exploracao.carregar(), RP.carregarTropas()]).then(function () { desenharCaca(el); }, function () { /* aviso já mostrado */ });
    }
  });
  RP.ORDENS_NOMES = RP.ORDENS_NOMES || {};
  RP.ORDENS_NOMES.cacar = 'Caçar';
  RP.acoesTropas = RP.acoesTropas || [];
  RP.acoesTropas.push({ href: '#/caca', icone: 'lobo', titulo: 'Caça', texto: 'Comida, couro e peles' });
  RP.itensMais = RP.itensMais || [];
  RP.itensMais.push({ icone: 'lobo', titulo: 'Caça', texto: 'Comida, couro e peles', href: '#/caca' });

  RP.desenhosRelatorio = RP.desenhosRelatorio || {};
  RP.desenhosRelatorio.caca = function (rel) {
    var d = rel.dados || {};
    return '<p class="suave">' + RP.esc(d.resumo || '') + '</p>' +
      (d.ganho && Object.keys(d.ganho).length ? '<div class="card linha-entre"><span class="fraco">Ganho</span>' + '<span class="custos">' + Object.keys(d.ganho).map(function (k) { return '<span class="custo">' + RP.icone(k, 'ico-p r-' + k) + RP.num(d.ganho[k]) + '</span>'; }).join('') + '</span></div>' : '') +
      (d.linhas && d.linhas.length ? '<div class="card info">' + d.linhas.map(function (x) { return linha(RP.esc(x.rotulo), RP.esc(x.valor)); }).join('') + '</div>' : '') +
      '<div class="linha" style="margin-top:var(--esp-3)"><a class="btn btn-p btn-primario" href="#/caca">' + RP.icone('lobo') + 'Caçar de novo</a>' +
      (d.hex != null ? '<a class="btn btn-p" href="#/mapa?foco=' + d.hex + '">' + RP.icone('mapa') + 'Ver no mapa</a>' : '') + '</div>';
  };
})();
