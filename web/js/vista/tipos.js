/* Reino de Pedra — desenhos padrão para objetos que outros sistemas mandam ao mapa (VisaoMapa.Extras):
   fauna, torre, bandeira, avistamento e farol, com a arte do protótipo na Vista e os marcadores do Mapa.
   Cada sistema pode substituir o seu registrando RP.mapa.tiposObjeto[tipo] depois deste arquivo.
   Campos esperados (todos opcionais além de tipo e hex) estão em docs/decisoes/0012-vista-e-mapa-no-cliente.md. */
(function () {
  'use strict';
  var RP = window.RP, H = RP.hex, M = RP.mapaModelo, A = RP.arte, TT = RP.mapaTatico, TIPOS = RP.mapa.tiposObjeto;

  function registrar(tipo, def) { if (!TIPOS[tipo]) TIPOS[tipo] = def; }
  var NOME_NIVEL = { baixo: 'Baixo', medio: 'Médio', alto: 'Alto' };
  var ANIMAL = { lobos: ['Lobos', 'lobo'], javalis: ['Javalis', 'javali'], ursos: ['Ursos', 'urso'], crocodilos: ['Crocodilos', 'crocodilo'] };
  function especie(o) { return o.animal || o.especie || 'lobos'; }
  function nivel(o) { return NOME_NIVEL[o.nivel] ? o.nivel : 'baixo'; }
  function aoVivo(o) { return o.aoVivo != null ? !!o.aoVivo : M.estado(o.hex).v === 'visivel'; }
  function rot(txt, y) { return TT.rotuloSvg(txt, y); }

  /* ---------------------------------------------------------------- fauna: bando ao vivo ou placa de perigo */
  registrar('fauna', {
    camada: 'fauna',
    nome: function (o) { return (ANIMAL[especie(o)] || ANIMAL.lobos)[0]; },
    icone: function (o) { return (ANIMAL[especie(o)] || ANIMAL.lobos)[1]; },
    classe: function (o) { return (aoVivo(o) ? 'fauna' : 'perigo') + ' nivel-' + nivel(o); },
    svgTatico: function (o) {
      var an = ANIMAL[especie(o)] || ANIMAL.lobos;
      if (aoVivo(o)) return '<circle class="fa-base" r="14"/><use href="#i-' + an[1] + '" x="-10" y="-10.5" width="20" height="20"/>' +
        (o.qtd ? '<g class="fa-qtd" transform="translate(13 -12)"><rect x="-11" y="-8" width="22" height="16" rx="8"/><text y="4">×' + o.qtd + '</text></g>' : '') + rot(an[0], 30);
      return '<path class="pg-base" d="M0-15 14 10H-14Z"/><use href="#i-pata" x="-6.5" y="-6" width="13" height="13"/>' + rot('Área de ' + an[0].toLowerCase(), 24);
    },
    desenharCena: function (c, o, info) {
      var t = info.t, tipo = especie(o);
      if (!aoVivo(o)) { A.placaPerigo(c, nivel(o), info.pal); return; }
      var n = Math.min(o.qtd || 3, tipo === 'ursos' ? 2 : 4), dir = Math.cos(t / 47 + (o.hex % 7)) >= 0 ? 1 : -1;
      for (var q = 0; q < n; q++) {
        var ax = Math.cos(q * 2.1 + t * 0.35) * 11 + (q - n / 2) * 6, ay = Math.sin(q * 1.7 + t * 0.3) * 7 * A.K;
        c.save(); c.translate(ax, ay); A.animal(c, tipo, 0, 0, t, info.pal, dir, true, q * 1.3); c.restore();
      }
    },
    rotulo: function (o, info) {
      var an = (ANIMAL[especie(o)] || ANIMAL.lobos)[0];
      var txt = aoVivo(o) ? an + ' · ' + NOME_NIVEL[nivel(o)].toLowerCase() : an + (info.estado.v === 'explorado' ? ' · ' + RP.fmtHa(info.estado.horas) : '');
      return { txt: txt, cls: 'nivel', cor: A.corNivel(nivel(o)) };
    },
    alvo: { w: 54, h: 30 },
    folha: function (o) {
      var an = (ANIMAL[especie(o)] || ANIMAL.lobos);
      return '<div class="perigo-linha nivel-' + nivel(o) + '">' + RP.icone(an[1]) + '<span><b>Perigo ' + NOME_NIVEL[nivel(o)].toLowerCase() + '</b> · ' + an[0].toLowerCase() + (o.qtd ? ' (' + o.qtd + ')' : '') +
        '<br><small>Ameaça exploradores sozinhos, grupos pequenos e caravanas.</small></span></div>';
    }
  });

  /* ---------------------------------------------------------------- torre de arqueiros: torre de pedra e alcance */
  registrar('torre', {
    camada: 'torres',
    nome: function (o) { return o.nome || 'Torre de arqueiros'; },
    icone: function () { return 'torre'; },
    classe: function (o) { return 'torre-mapa ' + TT.classeDono(o.dono) + (o.emObra ? ' em-obra' : ''); },
    svgFundo: function (o, info) {
      if (!o.alcance) return '';
      return '<g class="torre-alcance ' + TT.classeDono(o.dono) + (info.antigo ? ' antigo' : '') + '"><path d="' + TT.contorno(TT.noRaio(o.hex, o.alcance)) + '"/></g>';
    },
    svgTatico: function () { return '<circle class="torre-base" r="13"/><use href="#i-torre" x="-9" y="-9" width="18" height="18"/>'; },
    desenharCena: function (c, o, info) {
      var nv = o.nivel || 1, ht = 22 + nv * 6, nA = Math.min(3, nv), cor = A.corDono(o.dono, o);
      if (o.dono === 'meu' && !info.antigo && o.alcance) {
        var r = o.alcance * H.W;
        c.strokeStyle = cor; c.globalAlpha = 0.28; c.lineWidth = 1.4; c.setLineDash([4, 4]);
        c.beginPath(); c.ellipse(0, 0, r, r * A.K, 0, 0, 6.2832); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
      }
      c.globalAlpha = o.emObra ? 0.5 : 1;
      A.torre(c, 0, 0, 8, ht, info.pal);
      if (info.anim && !o.emObra) for (var q = 0; q < nA; q++) A.pessoa(c, (q - (nA - 1) / 2) * 4.5, -ht + 1, info.t, A.P, { roupa: cor, cinto: '#2b2520', dir: q % 2 ? -1 : 1, arco: true, fase: q * 1.3, capacete: A.P.metal });
      c.globalAlpha = 1;
    },
    alvo: { w: 30, h: 60 }
  });

  /* ---------------------------------------------------------------- bandeira: mastro com pano na cor de quem colocou */
  registrar('bandeira', {
    camada: 'bandeiras',
    nome: function (o) { return 'Bandeira' + (o.autor && o.autor.nome ? ' de ' + o.autor.nome : ''); },
    icone: function () { return 'bandeira'; },
    classe: function (o) { return 'bandeira ' + TT.classeDono(o.dono); },
    svgTatico: function (o) {
      var cor = o.dono === 'meu' || o.dono === 'aliado' ? '' : ' style="fill:' + RP.esc(A.corDono(o.dono, o.autor || o)) + '"';
      return '<ellipse class="bd-sombra" cx="-6" cy="14" rx="6" ry="2.2"/><path class="bd-mastro" d="M-6 14V-20"/><path class="bd-pano"' + cor + ' d="M-6-19H13L8.5-12.5 13-6H-6Z"/><circle class="bd-topo" cx="-6" cy="-21" r="2.2"/>';
    },
    desenharCena: function (c, o, info) {
      c.translate(12, 8 * A.K);
      A.sombra(c, 0, 0, 4, 0.2);
      A.bandeira(c, 0, 0, 26, A.corDono(o.dono, o.autor || o), info.anim ? info.t : 0, 13, 8);
      A.elipse(c, 0, -27, 1.4, 1.4, '#d9b25c');
    },
    folha: function (o) { return o.recado ? '<p class="bandeira-texto">“' + RP.esc(o.recado) + '”</p>' : ''; },
    alvo: { w: 26, h: 34 }
  });

  /* ---------------------------------------------------------------- avistamento: figura parada onde foi visto */
  function horasDesde(o) { return o.vistoEm ? Math.max(1, Math.round((RP.agora() - o.vistoEm) / 3600000)) : null; }
  function espiao(o) { return /espi|batedor/.test(String(o.alvo || o.forca || '')); }
  registrar('avistamento', {
    nome: function (o) { return espiao(o) ? 'Espião visto' : 'Exército visto'; },
    icone: function (o) { return espiao(o) ? 'batedor' : 'tropas'; },
    classe: function () { return 'avist'; },
    svgTatico: function (o) {
      var hh = horasDesde(o);
      return '<circle class="av-base" r="13"/><use href="#i-' + (espiao(o) ? 'batedor' : 'tropas') + '" x="-9" y="-9" width="18" height="18"/>' +
        '<g class="selo-antigo-mapa" transform="translate(11 10)"><circle r="7.5"/><use href="#i-relogio" x="-6" y="-6" width="12" height="12"/></g>' +
        rot((espiao(o) ? 'Espião' : 'Exército') + (hh ? ' · há ' + hh + ' h' : ''), 29);
    },
    desenharCena: function (c, o) {
      c.globalAlpha = 0.5;
      if (espiao(o)) A.pessoa(c, 0, 0, 0, A.PA, { roupa: '#2f3a2c', capuz: '#26301f', dir: 1, fase: 0.3 });
      else for (var z = 0; z < 3; z++) A.pessoa(c, (z - 1) * 7, (z % 2) * 4, 0, A.PA, { roupa: '#3d4149', cinto: '#1e1b18', capacete: '#2d3036', lanca: true, escudo: '#4b4f57', dir: 1, fase: z });
      c.globalAlpha = 1;
    },
    rotulo: function (o) { var hh = horasDesde(o); return { txt: (espiao(o) ? 'Espião' : 'Exército') + ' · visto' + (hh ? ' há ' + hh + ' h' : ''), cls: 'nivel', cor: A.cores().alerta }; }
  });

  /* ---------------------------------------------------------------- farol: 3 ou mais relíquias num local, visível até na névoa */
  registrar('farol', {
    atravessaNevoa: true,
    nome: function (o) { return (o.n || 3) + ' relíquias · farol'; },
    icone: function () { return 'lendario'; },
    classe: function () { return 'farol'; },
    svgTatico: function (o) { return '<circle class="farol-halo" r="20"/><circle class="farol-base" r="13"/><use href="#i-lendario" x="-9" y="-9" width="18" height="18"/>' + TT.rotuloSvg((o.n || 3) + ' relíquias', 30, 'rotulo-farol'); },
    desenharCena: function () { /* a coluna de luz vai por cima da névoa (sobreNevoa) */ },
    sobreNevoa: function (c, o, info) {
      var t = info.t, pulso = 0.5 + Math.sin(t * 1.8) * 0.5, gr = c.createLinearGradient(0, 0, 0, -160);
      gr.addColorStop(0, 'rgba(215,150,242,.75)'); gr.addColorStop(1, 'rgba(215,150,242,0)');
      c.globalAlpha = 0.35 + pulso * 0.3; c.fillStyle = gr;
      c.beginPath(); c.moveTo(-9, 0); c.lineTo(9, 0); c.lineTo(4, -160); c.lineTo(-4, -160); c.closePath(); c.fill();
      c.globalAlpha = 1;
      A.elipse(c, 0, -2, 14 + pulso * 4, 6 + pulso * 2, 'rgba(215,150,242,' + (0.25 + pulso * 0.2).toFixed(2) + ')');
    },
    rotulo: function (o) { return { txt: (o.n || 3) + ' relíquias · farol', cls: 'nivel', cor: '#d796f2' }; },
    rotuloDy: -44
  });
})();
