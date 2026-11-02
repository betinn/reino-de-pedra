/* Reino de Pedra — ícones e símbolos de mapa (SVG próprios).
   Grade 24×24. Três classes de traço, estilizadas por direção em base.css:
     ic-s  silhueta (preenchida em A; traço + aguada em B)
     ic-d  detalhe sobre a silhueta (entalhe escuro em A; traço em B)
     ic-l  linha estrutural (sempre na cor do ícone)
   Símbolos de mapa (prefixo m-) usam coordenadas centradas em (0,0), hexágono R=30. */
(function () {
  'use strict';
  var RP = (window.RP = window.RP || {});

  function serra() {
    var pts = [], n = 12, i, a, b;
    for (i = 0; i < n; i++) {
      a = (i / n) * Math.PI * 2;
      b = ((i + 0.62) / n) * Math.PI * 2;
      pts.push((12 + 9.6 * Math.cos(a)).toFixed(2) + ' ' + (12 + 9.6 * Math.sin(a)).toFixed(2));
      pts.push((12 + 7.2 * Math.cos(b)).toFixed(2) + ' ' + (12 + 7.2 * Math.sin(b)).toFixed(2));
    }
    return 'M' + pts.join('L') + 'Z';
  }

  function estrela(cx, cy, r1, r2, n) {
    var p = [], i, a, r;
    for (i = 0; i < n * 2; i++) {
      a = -Math.PI / 2 + (i * Math.PI) / n;
      r = i % 2 ? r2 : r1;
      p.push((cx + r * Math.cos(a)).toFixed(2) + ' ' + (cy + r * Math.sin(a)).toFixed(2));
    }
    return 'M' + p.join('L') + 'Z';
  }
  RP.estrelaPath = estrela;

  var espada =
    '<path class="ic-s" d="M3 3h2.6l10.2 10.2-2.6 2.6L3 5.6Z"/>' +
    '<path class="ic-s" d="M11.4 17.4l6-6 1.5 1.5-6 6Z"/>' +
    '<path class="ic-l" d="M17.2 17.2l2.6 2.6"/>' +
    '<circle class="ic-s" cx="20.8" cy="20.8" r="1.4"/>';

  var I = {
    /* recursos básicos */
    madeira:
      '<rect class="ic-s" x="2.5" y="12.5" width="19" height="7" rx="3.5"/>' +
      '<rect class="ic-s" x="5" y="5" width="15.5" height="7" rx="3.5"/>' +
      '<circle class="ic-d" cx="18" cy="16" r="1.7"/><circle class="ic-d" cx="17" cy="8.5" r="1.7"/>',
    pedra:
      '<path class="ic-s" d="M3 18.5 6.5 9 12.5 5.5 19 8.5 21.5 16.5 15 20.5Z"/>' +
      '<path class="ic-d" d="M9.5 10.5 12 14l4.5 1M12 14l-1.5 4"/>',
    comida:
      '<path class="ic-l" d="M12 21.5V8"/>' +
      '<ellipse class="ic-s" cx="12" cy="5.2" rx="2" ry="3.2"/>' +
      '<ellipse class="ic-s" cx="8.6" cy="9.6" rx="1.9" ry="3.1" transform="rotate(-38 8.6 9.6)"/>' +
      '<ellipse class="ic-s" cx="15.4" cy="9.6" rx="1.9" ry="3.1" transform="rotate(38 15.4 9.6)"/>' +
      '<ellipse class="ic-s" cx="8.6" cy="14.8" rx="1.9" ry="3.1" transform="rotate(-38 8.6 14.8)"/>' +
      '<ellipse class="ic-s" cx="15.4" cy="14.8" rx="1.9" ry="3.1" transform="rotate(38 15.4 14.8)"/>',
    ferro:
      '<path class="ic-s" d="M2.5 19 6 12.5h12l3.5 6.5Z"/>' +
      '<path class="ic-s" d="M6.5 11.5 9 6.5h6l2.5 5Z"/>',
    populacao:
      '<circle class="ic-s" cx="9" cy="7.5" r="3.3"/>' +
      '<path class="ic-s" d="M2.5 20.5c0-4.1 2.9-7 6.5-7s6.5 2.9 6.5 7Z"/>' +
      '<circle class="ic-s" cx="16.8" cy="8.6" r="2.7"/>' +
      '<path class="ic-s" d="M15.6 13.8c.4-.1.8-.2 1.2-.2 2.9 0 5 2.6 5 6.9h-4.4c0-2.8-.6-5.1-1.8-6.7Z"/>',
    /* valiosos e lendários */
    ouro:
      '<path class="ic-s" d="M3.5 15.5v3c0 1.4 3.8 2.5 8.5 2.5s8.5-1.1 8.5-2.5v-3Z"/>' +
      '<ellipse class="ic-s" cx="12" cy="15.5" rx="8.5" ry="2.6"/>' +
      '<path class="ic-s" d="M6 9v3.4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V9Z"/>' +
      '<ellipse class="ic-s" cx="12" cy="9" rx="6" ry="2.5"/>' +
      '<path class="ic-d" d="M10.2 9h3.6"/>',
    prata:
      '<circle class="ic-s" cx="12" cy="12" r="9"/>' +
      '<circle class="ic-d" cx="12" cy="12" r="6"/>' +
      '<path class="ic-d" d="M12 8.6v6.8M8.6 12h6.8"/>',
    sal:
      '<path class="ic-s" d="M2.5 20.5c1.6-5.4 5.2-9 9.5-9s7.9 3.6 9.5 9Z"/>' +
      '<rect class="ic-s" x="9.8" y="3.6" width="3.6" height="3.6" transform="rotate(45 11.6 5.4)"/>' +
      '<rect class="ic-s" x="15.4" y="6.4" width="2.8" height="2.8" transform="rotate(45 16.8 7.8)"/>' +
      '<rect class="ic-s" x="5.4" y="7" width="2.6" height="2.6" transform="rotate(45 6.7 8.3)"/>',
    cavalo:
      '<path class="ic-s" d="M6.5 21.5h12c-.3-3.5-.9-6.8-1.7-9.1-1-3-3.1-5.6-6.3-6.7L9.6 2.5 8.3 6C6.1 7.5 4.5 9.9 4 12.6l2.6 1.7 3.2-1.7c.4 1.3-.3 2.5-1.3 3.5-1.2 1.4-2 3.2-2 5.4Z"/>' +
      '<circle class="ic-d" cx="9.5" cy="9.3" r=".5"/>',
    ervas:
      '<path class="ic-l" d="M12 21.5c.3-5.5.2-10.5 0-15"/>' +
      '<path class="ic-s" d="M11.8 9.2C8.6 9.3 6.2 7.4 5.6 4.2c3.2-.1 5.6 1.8 6.2 5Z"/>' +
      '<path class="ic-s" d="M12.2 12.8c3.2.1 5.6-1.8 6.2-5-3.2-.1-5.6 1.8-6.2 5Z"/>' +
      '<path class="ic-s" d="M11.8 17.4c-3.3.1-5.8-1.9-6.4-5.2 3.3-.1 5.8 1.9 6.4 5.2Z"/>',
    gema:
      '<path class="ic-s" d="M7 4h10l4.5 5.5L12 21 2.5 9.5Z"/>' +
      '<path class="ic-d" d="M2.8 9.5h18.4M9 4.3 7.7 9.5 12 20.5l4.3-11L15 4.3"/>',
    lendario:
      '<path class="ic-s" d="M11 2.5c.8 4.9 2.8 6.9 7.7 7.7-4.9.8-6.9 2.8-7.7 7.7-.8-4.9-2.8-6.9-7.7-7.7 4.9-.8 6.9-2.8 7.7-7.7Z"/>' +
      '<path class="ic-s" d="M18.5 14.5c.4 2.1 1.3 3 3.4 3.4-2.1.4-3 1.3-3.4 3.4-.4-2.1-1.3-3-3.4-3.4 2.1-.4 3-1.3 3.4-3.4Z"/>',
    ruina:
      '<path class="ic-s" d="M2.5 21.5v-2.3h19v2.3Z"/>' +
      '<path class="ic-s" d="M4.5 5.5h7v2.2h-7Z"/>' +
      '<path class="ic-s" d="M5.6 7.7h4.8v11.5H5.6Z"/>' +
      '<path class="ic-s" d="M13.8 19.2v-8.4l1.6-1.3 1.2 1 1.8-1.7 1.2.9v9.5Z"/>' +
      '<path class="ic-d" d="M8 9.5v7.5"/>',
    /* locais do reino */
    castelo:
      '<path class="ic-s" d="M2.5 21.5V7h1.9v2h1.8V7H8v4h1.5V4.5h1.7V6h1.6V4.5h1.7V11H16V7h1.8v2h1.8V7h1.9v14.5h-7v-4a2.5 2.5 0 0 0-5 0v4Z"/>' +
      '<path class="ic-d" d="M5.2 12.5v2.6M18.8 12.5v2.6M12 8.2v2"/>',
    vila:
      '<path class="ic-s" d="M2 21.5v-9l4.5-4 4.5 4v9Z"/>' +
      '<path class="ic-s" d="M12.5 21.5V10l4.75-4.5L22 10v11.5Z"/>' +
      '<path class="ic-d" d="M5.5 21.5v-4h2v4M16.2 21.5v-5h2.1v5"/>',
    moradia:
      '<path class="ic-s" d="M3.5 21.5V11L12 3.5l8.5 7.5v10.5Z"/>' +
      '<path class="ic-d" d="M10 21.5v-5.5h4v5.5"/>',
    mina:
      '<path class="ic-s" d="M1.5 21.5C3 13 7 7.5 12 7.5S21 13 22.5 21.5Z"/>' +
      '<path class="ic-d" d="M8 21.5v-6.5h8v6.5M7 15h10"/>' +
      '<path class="ic-l" d="M12 7.5V3.5M10 4.8h4"/>',
    serraria:
      '<path class="ic-s" d="' + serra() + '"/>' +
      '<circle class="ic-d" cx="12" cy="12" r="2.4"/>',
    pasto:
      '<path class="ic-s" d="M2 9.5h20V12H2Z"/>' +
      '<path class="ic-s" d="M2 15.5h20V18H2Z"/>' +
      '<path class="ic-s" d="M4 6.5l1.5-2 1.5 2v15H4Z"/>' +
      '<path class="ic-s" d="M10.5 6.5l1.5-2 1.5 2v15h-3Z"/>' +
      '<path class="ic-s" d="M17 6.5l1.5-2 1.5 2v15h-3Z"/>',
    armazem:
      '<path class="ic-s" d="M2.5 21.5V10L12 3.5l9.5 6.5v11.5Z"/>' +
      '<path class="ic-d" d="M7.5 21.5v-8h9v8M7.5 13.5l9 8M16.5 13.5l-9 8"/>',
    ferraria:
      '<path class="ic-s" d="M2.5 7.5h14c0 2.2 2 3.7 5 3.7v1.6h-6.3c-1.2 0-2 .9-2 2v.7l2.3 2.5v2.5h-9V18l2.3-2.5v-.7c0-1.1-.8-2-2-2C4.6 12.8 2.5 10.6 2.5 7.5Z"/>',
    quartel:
      '<path class="ic-s" d="M2 21.5 12 7l10 14.5Z"/>' +
      '<path class="ic-d" d="M12 7v14.5M9.4 21.5 12 15.5l2.6 6"/>' +
      '<path class="ic-l" d="M12 7V2.5"/>' +
      '<path class="ic-s" d="M12 2.5h5.5L16 4.2l1.5 1.8H12Z"/>',
    muralha:
      '<path class="ic-s" d="M2 21.5V8h3.2v2.2h2.4V8h3.2v2.2h2.4V8h3.2v2.2h2.4V8H22v13.5Z"/>' +
      '<path class="ic-d" d="M2 15h20M7 15v6.5M17 15v6.5M12 10.2V15"/>',
    /* unidades e exploradores */
    tropas: espada + '<g transform="matrix(-1 0 0 1 24 0)">' + espada + '</g>',
    explorador:
      '<path class="ic-s" d="M2.6 13.6 14.8 5.4l2 3L4.6 16.6Z"/>' +
      '<path class="ic-s" d="M15 4.4l3.6-2.2 2.9 4.6-3.6 2.2Z"/>' +
      '<path class="ic-l" d="M9.2 12.6 6.8 21.5M10.4 11.8l4.4 9.7"/>',
    bota:
      '<path class="ic-s" d="M7.5 2.5H14v9l5.5 2.6c1.5.7 2.5 2 2.5 3.6v3.8H5.5v-7.3c1.1-.7 2-1.7 2-3.2Z"/>' +
      '<path class="ic-d" d="M5.5 18.5H22M7.5 6.2H14"/>',
    picareta:
      '<path class="ic-s" d="M4.4 20.4l9.4-11 1.8 1.5-9.4 11Z"/>' +
      '<path class="ic-s" d="M3 8.2C6.8 3.4 13 1.9 19.6 3.4c1.4 3.7 1.3 7.6-.4 11.9-1.3-4.3-3.6-6.9-7.2-8.4C9 5.9 5.9 6.4 3 8.2Z"/>',
    batedor:
      '<path class="ic-s" d="M12 2.5c-5 0-8.5 4.5-8.5 10.5 0 3 .7 6 2 8.5h13c1.3-2.5 2-5.5 2-8.5 0-6-3.5-10.5-8.5-10.5Z"/>' +
      '<path class="ic-d" d="M7.3 13.2c1.1-3 2.7-4.6 4.7-4.6s3.6 1.6 4.7 4.6c-1.1 2.6-2.7 4.1-4.7 4.1s-3.6-1.5-4.7-4.1Z"/>' +
      '<path class="ic-d" d="M10 13h.2M13.8 13h.2"/>',
    cerco:
      '<path class="ic-s" d="M3 17.5h18v2.5H3Z"/>' +
      '<circle class="ic-s" cx="6.5" cy="20.5" r="2"/><circle class="ic-s" cx="17.5" cy="20.5" r="2"/>' +
      '<path class="ic-l" d="M8 17.5 12 6l4 11.5M5 4l14 6"/>' +
      '<circle class="ic-s" cx="19.5" cy="10.5" r="2"/>',
    /* interface */
    mapa:
      '<path class="ic-s" d="M2.5 5.5 8.5 3l7 2.5 6-2.5v15.5l-6 2.5-7-2.5-6 2.5Z"/>' +
      '<path class="ic-d" d="M8.5 3v15.5M15.5 5.5V21"/>',
    relatorios:
      '<path class="ic-s" d="M6 3.5h12.5a2.5 2.5 0 0 1 0 5H18v10a2.5 2.5 0 0 1-2.5 2.5h-10a2.5 2.5 0 0 1 0-5H6Z"/>' +
      '<path class="ic-d" d="M9 9h6M9 12.3h6M9 15.6h4"/>',
    menu: '<path class="ic-l" d="M4 6.5h16M4 12h16M4 17.5h16"/>',
    sino:
      '<path class="ic-s" d="M12 3c-3.6 0-6 2.8-6 6.5v3.8L4 17h16l-2-3.7V9.5C18 5.8 15.6 3 12 3Z"/>' +
      '<path class="ic-s" d="M9.5 18.5a2.5 2.5 0 0 0 5 0Z"/>',
    mais: '<path class="ic-l" d="M12 5v14M5 12h14" style="stroke-width:2.6"/>',
    menos: '<path class="ic-l" d="M5 12h14" style="stroke-width:2.6"/>',
    alvo:
      '<circle class="ic-l" cx="12" cy="12" r="7"/>' +
      '<path class="ic-l" d="M12 1.8v4.4M12 17.8v4.4M1.8 12h4.4M17.8 12h4.4"/>' +
      '<circle class="ic-f" cx="12" cy="12" r="2"/>',
    camadas:
      '<path class="ic-s" d="M12 3 21.5 8.5 12 14 2.5 8.5Z"/>' +
      '<path class="ic-l" d="M3 12.5l9 5.2 9-5.2M3 16.5l9 5.2 9-5.2"/>',
    fechar: '<path class="ic-l" d="M5.5 5.5l13 13M18.5 5.5l-13 13" style="stroke-width:2.4"/>',
    voltar: '<path class="ic-l" d="M15 4.5 7.5 12l7.5 7.5" style="stroke-width:2.4"/>',
    avancar: '<path class="ic-l" d="M9 4.5 16.5 12 9 19.5" style="stroke-width:2.4"/>',
    relogio:
      '<circle class="ic-s" cx="12" cy="12" r="9"/>' +
      '<path class="ic-d" d="M12 7v5.2l3.4 2.1"/>',
    escudo: '<path class="ic-s" d="M12 2.5 20 5.5v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6Z"/>',
    alerta:
      '<path class="ic-s" d="M12 2.8 22.5 20.5h-21Z"/>' +
      '<path class="ic-d" d="M12 9v5.5M12 17.3v.2" style="stroke-width:2.2"/>',
    olho:
      '<path class="ic-s" d="M1.5 12C4 7 7.8 4.5 12 4.5S20 7 22.5 12C20 17 16.2 19.5 12 19.5S4 17 1.5 12Z"/>' +
      '<circle class="ic-d" cx="12" cy="12" r="3.6"/>',
    bandeira:
      '<path class="ic-l" d="M5 22V2.5"/>' +
      '<path class="ic-s" d="M5 3.5h14l-3.2 4.2L19 12H5Z"/>',
    estandarte:
      '<path class="ic-l" d="M3.5 3h17M12 3V1.5"/>' +
      '<path class="ic-s" d="M6 3h12v17l-6-4-6 4Z"/>' +
      '<path class="ic-d" d="M9 8h6M9 11h6"/>',
    interrogacao:
      '<circle class="ic-s" cx="12" cy="12" r="9.5"/>' +
      '<path class="ic-d" d="M9.3 9.4c0-1.6 1.2-2.8 2.8-2.8s2.8 1.1 2.8 2.6c0 2.2-2.8 2.3-2.8 4.6M12.1 16.9v.3" style="stroke-width:2"/>',
    coroa:
      '<path class="ic-s" d="M3 7.5 7.5 12 12 4l4.5 8L21 7.5l-1.8 10H4.8Z"/>' +
      '<path class="ic-s" d="M4.8 19h14.4v2.5H4.8Z"/>',
    martelo:
      '<path class="ic-s" d="M3.2 18.9l8.4-8.4 1.9 1.9-8.4 8.4Z"/>' +
      '<path class="ic-s" d="M9.7 6.2 14.2 1.7l3.5 3.5-1 1 4.6 4.6-1.9 1.9-4.6-4.6-2.4 2.4Z"/>',
    cadeado:
      '<path class="ic-s" d="M5 10.5h14V21H5Z"/>' +
      '<path class="ic-l" d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>' +
      '<path class="ic-d" d="M12 14.5v2.5"/>',
    bussola:
      '<circle class="ic-s" cx="12" cy="12" r="9.5"/>' +
      '<path class="ic-d" d="M15.6 8.4 13.2 13.2 8.4 15.6l2.4-4.8Z"/>',
    info:
      '<circle class="ic-s" cx="12" cy="12" r="9.5"/>' +
      '<path class="ic-d" d="M12 11v6M12 7.4v.2" style="stroke-width:2.2"/>',
    check: '<path class="ic-l" d="M4.5 12.5l5 5 10-11" style="stroke-width:2.6"/>',
    subir: '<path class="ic-l" d="M12 19V5M6 11l6-6 6 6" style="stroke-width:2.4"/>',
    seta: '<path class="ic-l" d="M4 12h15M13 6l6 6-6 6" style="stroke-width:2.4"/>',
    nevoa:
      '<path class="ic-s" d="M6.5 18.5a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6-1.4A4.3 4.3 0 0 1 18 18.5Z"/>',
    rota: '<path class="ic-l" d="M4 21c2-6 9-4 9-10S8 6 11 3" style="stroke-dasharray:3 3"/><circle class="ic-f" cx="4" cy="21" r="1.8"/><circle class="ic-f" cx="11" cy="3" r="1.8"/>',
    ponte:
      '<path class="ic-s" d="M2 10h20v3H2Z"/>' +
      '<path class="ic-s" d="M3 13h3v7H3ZM18 13h3v7h-3Z"/>' +
      '<path class="ic-d" d="M6 20c0-4 2.7-6.5 6-6.5s6 2.5 6 6.5"/>',
    temporada:
      '<path class="ic-s" d="M7 2.5h10v4.2L13.4 12l3.6 5.3v4.2H7v-4.2l3.6-5.3L7 6.7Z"/>' +
      '<path class="ic-d" d="M9.5 19h5M10.5 6h3"/>'
  };

  /* Símbolos de terreno e marcadores do mapa (centrados em 0,0) */
  var M = {
    'm-arvores-1':
      '<path class="m-arv" d="M-10 5-3.5-10 3 5Z"/><path class="m-tr" d="M-10 5-3.5-10 3 5Z"/>' +
      '<path class="m-arv-2" d="M2 10 8.5-5 15 10Z"/><path class="m-tr" d="M2 10 8.5-5 15 10Z"/>' +
      '<path class="m-arv" d="M-15 14-8.5 0-2 14Z"/><path class="m-tr" d="M-15 14-8.5 0-2 14Z"/>',
    'm-arvores-2':
      '<circle class="m-arv-2" cx="-6" cy="-3" r="6.5"/><circle class="m-tr" cx="-6" cy="-3" r="6.5"/>' +
      '<circle class="m-arv" cx="7" cy="0" r="6"/><circle class="m-tr" cx="7" cy="0" r="6"/>' +
      '<circle class="m-arv" cx="-1" cy="9" r="5.5"/><circle class="m-tr" cx="-1" cy="9" r="5.5"/>',
    'm-colina':
      '<path class="m-col" d="M-18 8Q-9-8 0 8Z"/><path class="m-col-l" d="M-14 5Q-9-3-5 1"/><path class="m-tr" d="M-18 8Q-9-8 0 8"/>' +
      '<path class="m-col" d="M-3 12Q6-3 15 12Z"/><path class="m-col-l" d="M1 9Q6 1 10 5"/><path class="m-tr" d="M-3 12Q6-3 15 12"/>',
    'm-monte':
      '<path class="m-mon" d="M3 13 11-1 19 13Z"/><path class="m-tr" d="M3 13 11-1 19 13"/>' +
      '<path class="m-mon" d="M-18 13-3-14 12 13Z"/>' +
      '<path class="m-mon-s" d="M-3-14 12 13H0Z"/>' +
      '<path class="m-neve" d="M-3-14-8.4-4.3-6-5.5-4-3.6-2.2-6 .6-4.3Z"/>' +
      '<path class="m-tr" d="M-18 13-3-14 12 13"/>',
    'm-junco':
      '<path class="m-jun" d="M-9 7V-5M-6 7V-1M-12 7V0M6 4V-7M9 4V-2M3 4V-3"/>' +
      '<path class="m-agua" d="M-15 10h9M1 7h10M-5 14h8"/>',
    'm-grama': '<path class="m-gra" d="M-9 6-10.5 2M-7.5 6V1.5M-6 6-4.5 2.5M5-2 3.5-6M6.5-2V-6.5M8-2 9.5-5.5"/>',
    'm-ponte':
      '<path class="m-ponte" d="M-14-4h28v8h-28Z"/>' +
      '<path class="m-ponte-l" d="M-10-4v8M-5-4v8M0-4v8M5-4v8M10-4v8"/>',
    'm-vau':
      '<ellipse class="m-vau" cx="-9" cy="2" rx="3.6" ry="2.6"/><ellipse class="m-vau" cx="0" cy="-1" rx="3.6" ry="2.6"/><ellipse class="m-vau" cx="9" cy="2" rx="3.6" ry="2.6"/>'
  };

  var sprite = '<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">';
  Object.keys(I).forEach(function (k) {
    sprite += '<symbol id="i-' + k + '" viewBox="0 0 24 24">' + I[k] + '</symbol>';
  });
  sprite += '<defs>';
  Object.keys(M).forEach(function (k) {
    sprite += '<g id="' + k + '">' + M[k] + '</g>';
  });
  sprite += '</defs></svg>';

  RP.injetarIcones = function () {
    if (document.getElementById('rp-sprite')) return;
    var d = document.createElement('div');
    d.id = 'rp-sprite';
    d.innerHTML = sprite;
    document.body.insertBefore(d, document.body.firstChild);
  };

  RP.listaIcones = Object.keys(I);

  /* Retorna o markup de um ícone. classe: classes extras (ex.: "ico-p r-madeira"). */
  RP.icone = function (nome, classe, titulo) {
    return '<svg class="ico ' + (classe || '') + '" aria-hidden="' + (titulo ? 'false' : 'true') + '"' +
      (titulo ? ' role="img" aria-label="' + titulo + '"' : '') +
      '><use href="#i-' + nome + '"/></svg>';
  };
})();
