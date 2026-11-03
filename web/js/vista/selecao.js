/* Reino de Pedra — seleção de um grupo de pessoas na Vista. Toque único num soldado abre a folha dele; o modo
   seleção (botão nos controles do mapa, na folha, ou toque longo) faz cada toque somar ou tirar uma pessoa e o
   arrasto desenhar um laço. No computador, Shift+clique soma e Shift+arrastar laça. Com o grupo pronto, a barra
   mostra "7 selecionados · 4 lanceiros, 3 arqueiros" e o botão Missão, que entra no envio de tropas de sempre
   (tocar no destino e confirmar) com as pessoas escolhidas pelo id.
   RP.selecao: ids(), n(), tem(id), alternar(id), definir(ids), limpar(), modo, ativarModo(bool), lacar(pontosTela), missao() */
(function () {
  'use strict';
  var RP = window.RP, M = RP.mapaModelo;
  var sel = {}, modo = false;

  RP.shift = false;
  window.addEventListener('keydown', function (e) { if (e.key === 'Shift') RP.shift = true; });
  window.addEventListener('keyup', function (e) { if (e.key === 'Shift') RP.shift = false; });
  window.addEventListener('blur', function () { RP.shift = false; });

  function pessoa(id) { return M.pessoa ? M.pessoa(id) : null; }
  function ids() { return Object.keys(sel).map(Number); }
  function n() { return ids().length; }
  function grupo() {
    var g = {};
    ids().forEach(function (id) { var p = pessoa(id); if (p && RP.pessoasVista.ehSoldado(p)) g[p.oficio] = (g[p.oficio] || 0) + 1; });
    return g;
  }
  /* onde estão os selecionados: um local (todos guarnecidos nele), uma marcha (todos nela) ou misturados */
  function origem() {
    var locais = {}, marchas = {}, civis = 0;
    ids().forEach(function (id) {
      var p = pessoa(id); if (!p) return;
      if (!RP.pessoasVista.ehSoldado(p)) { civis++; return; }
      if (p.grupoId && p.grupoId > 0) marchas[p.grupoId] = true; else if (p.localId) locais[p.localId] = true;
    });
    var ls = Object.keys(locais), ms = Object.keys(marchas);
    if (civis) return { erro: 'Só soldados recebem missão. Civis trocam de trabalho pela folha deles.' };
    if (ls.length + ms.length > 1) return { erro: 'Escolha soldados que estejam no mesmo lugar: uma guarnição ou um exército.' };
    if (ls.length === 1) return { de: +ls[0] };
    if (ms.length === 1) return { marchaId: +ms[0] };
    return { erro: 'Ninguém selecionado.' };
  }

  function barra() {
    var tela = RP.$('[data-tela=mapa]'); if (!tela) return;
    var topo = RP.$('.mapa-topo', tela); if (!topo) return;
    var b = RP.$('.selecao-barra', topo);
    if (!b) { b = document.createElement('div'); b.className = 'ordem-barra selecao-barra'; b.setAttribute('role', 'status'); topo.appendChild(b); }
    var k = n(), emEnvio = RP.envio && RP.envio.ativo();
    b.hidden = !k && !modo || emEnvio;
    tela.classList.toggle('em-selecao', modo);
    RP.$$('[data-selecao]', tela).forEach(function (x) { x.setAttribute('aria-pressed', String(modo)); });
    if (b.hidden) return;
    var g = grupo(), partes = RP.partesGrupo ? RP.partesGrupo(g) : '', civis = k - RP.somaGrupo(g);
    var resumo = k ? (partes || '') + (civis ? (partes ? ', ' : '') + civis + (civis === 1 ? ' civil' : ' civis') : '') : (modo ? 'Toque nas pessoas ou arraste um laço' : '');
    b.innerHTML = '<span class="ordem-ico">' + RP.icone('populacao') + '</span><span class="ordem-txt"><b>' + (k ? k + (k === 1 ? ' selecionado' : ' selecionados') : 'Modo seleção') + '</b><small>' + RP.esc(resumo) + '</small></span>' +
      (k ? '<button type="button" class="btn btn-p btn-primario" data-selecao-missao>' + RP.icone('alvo') + 'Missão</button>' : '') +
      '<button type="button" class="btn btn-p btn-fantasma btn-icone" data-selecao-limpar aria-label="Limpar seleção">' + RP.icone('fechar') + '</button>';
  }

  function dentro(pt, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
      if (((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  RP.selecao = {
    ids: ids, n: n, grupo: grupo,
    get modo() { return modo; },
    tem: function (id) { return !!sel[id]; },
    alternar: function (id) { if (sel[id]) delete sel[id]; else sel[id] = true; barra(); },
    definir: function (lista) { sel = {}; (lista || []).forEach(function (id) { sel[id] = true; }); barra(); },
    somar: function (lista) { (lista || []).forEach(function (id) { sel[id] = true; }); barra(); },
    limpar: function () { sel = {}; modo = false; barra(); },
    ativarModo: function (b) {
      modo = b !== false;
      if (modo) RP.aviso({ titulo: 'Modo seleção', texto: 'Toque nas pessoas para somar ou tirar. Arraste para laçar um grupo.', icone: 'populacao', ms: 2600 });
      barra();
    },
    /* laço em coordenadas de tela: seleciona (soma) quem está dentro */
    lacar: function (pts) {
      if (!pts || pts.length < 3) return;
      var pegou = 0;
      RP.pessoasVista.ultimos().forEach(function (f) { if (dentro(f, pts)) { sel[f.id] = true; pegou++; } });
      if (!pegou) RP.aviso({ titulo: 'Ninguém dentro do laço', texto: 'Aproxime o zoom para laçar as pessoas uma a uma.', icone: 'info', ms: 2200 });
      barra();
    },
    barra: barra,
    /* o grupo recebe uma missão: entra no envio de tropas com as pessoas pelo id */
    missao: function () {
      var o = origem();
      if (o.erro) { RP.aviso({ titulo: o.erro, icone: 'alerta', tipo: 'alerta' }); return; }
      modo = false;
      if (o.marchaId) RP.envio.iniciar({ marchaId: o.marchaId });
      else RP.envio.iniciar({ de: o.de, pessoas: ids() });
      barra();
    }
  };

  document.addEventListener('click', function (e) {
    var b;
    if (e.target.closest('[data-selecao-missao]')) RP.selecao.missao();
    else if (e.target.closest('[data-selecao-limpar]')) RP.selecao.limpar();
    else if ((b = e.target.closest('[data-selecao]'))) RP.selecao.ativarModo(!modo);
  });
  window.addEventListener('keydown', function (e) {
    if (document.documentElement.getAttribute('data-tela') !== 'mapa' || e.target.closest('input, textarea, select')) return;
    if (e.key === 'Escape' && (n() || modo)) { RP.selecao.limpar(); RP.fecharFolha(); }
    else if (e.key === 'Enter' && n() && !(RP.envio && RP.envio.ativo())) RP.selecao.missao();
  });
  /* dados novos (alguém morreu, saiu): tira da seleção quem não existe mais */
  document.addEventListener('rp:mapa-dados', function () {
    var antes = n();
    ids().forEach(function (id) { if (!pessoa(id)) delete sel[id]; });
    if (n() !== antes) barra();
  });
  document.addEventListener('rp:tela', function (ev) { if (ev.detail !== 'mapa') { sel = {}; modo = false; } barra(); });
})();
