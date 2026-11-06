/* Reino de Pedra — seleção de tropas e pessoas na Vista. Tocar num soldado da guarnição seleciona ele; tocar numa tropa em
   campo seleciona ela inteira. Com a tropa selecionada, tocar num hexágono oferece "Enviar tropa", tocar em outra tropa oferece
   juntar e tocar nela de novo abre a folha dela. O modo seleção (botão nos controles do mapa, ou toque longo) faz cada toque
   somar ou tirar e o arrasto desenhar um laço; no computador, Shift+clique soma e Shift+arrastar laça. A barra mostra
   "7 selecionados · 4 lanceiros, 3 arqueiros", com Missão e Patrulha. Civis não recebem ordens: o toque abre a folha e a pessoa
   fica marcada enquanto ela estiver aberta.
   RP.selecao: ids(), n(), tem(id), soldados(), alternar(id), alternarLista(ids), definir(ids), limpar(), focar(id), soltar(id),
     modo, ativarModo(bool), lacar(pontosTela), origem(), destino(hex), tocarTropa(t), estaEm(hex), missao(), patrulha() */
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
  function soldados() { return n() > 0 && ids().every(function (id) { var p = pessoa(id); return p && RP.pessoasVista.ehSoldado(p); }); }
  function marcha(id) { return ((M.dados && M.dados.marchas) || []).filter(function (x) { return x.id === id; })[0]; }
  /* onde estão os selecionados: um local (todos guarnecidos nele), uma marcha (todos nela; parte: ids, se é só uma parte dela) ou misturados */
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
    if (ms.length === 1) {
      var mc = marcha(+ms[0]), inteira = mc && (mc.pessoaIds || []).filter(function (id) { var p = pessoa(id); return p && RP.pessoasVista.ehSoldado(p); }).every(function (id) { return !!sel[id]; });
      return { marchaId: +ms[0], parte: inteira ? null : ids() };
    }
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
    var tropa = soldados(), resumo = k ? (partes || '') + (civis ? (partes ? ', ' : '') + civis + (civis === 1 ? ' civil' : ' civis') : '') + (tropa ? ' · toque no destino' : '') : (modo ? 'Toque nas pessoas ou arraste um laço' : '');
    b.innerHTML = '<span class="ordem-ico">' + RP.icone('populacao') + '</span><span class="ordem-txt"><b>' + (k ? k + (k === 1 ? ' selecionado' : ' selecionados') : 'Modo seleção') + '</b><small>' + RP.esc(resumo) + '</small></span>' +
      (tropa ? '<button type="button" class="btn btn-p btn-primario" data-selecao-missao>' + RP.icone('alvo') + 'Missão</button>' +
        '<button type="button" class="btn btn-p" data-selecao-patrulha>' + RP.icone('rota') + 'Patrulha</button>' : '') +
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
    ids: ids, n: n, grupo: grupo, soldados: soldados, origem: origem,
    get modo() { return modo; },
    tem: function (id) { return !!sel[id]; },
    alternar: function (id) { if (sel[id]) delete sel[id]; else sel[id] = true; barra(); },
    /* soma a lista; se todos já estavam, tira */
    alternarLista: function (lista) {
      var todos = lista.every(function (id) { return !!sel[id]; });
      lista.forEach(function (id) { if (todos) delete sel[id]; else sel[id] = true; });
      barra();
    },
    /* marca quem está com a folha aberta (civil, ou soldado ocupado), sem virar tropa selecionada */
    focar: function (id) { sel = {}; sel[id] = true; barra(); },
    soltar: function (id) { if (n() === 1 && sel[id] && !soldados()) { sel = {}; barra(); } },
    /* a seleção inclui quem está neste hexágono */
    estaEm: function (h) { return ids().some(function (id) { var p = pessoa(id); return p && p.hex === h; }); },
    /* a tropa selecionada recebe este hexágono como destino: abre a folha dele com "Enviar tropa" */
    destino: function (h) {
      var o = origem();
      if (o.erro) { RP.aviso({ titulo: o.erro, icone: 'alerta', tipo: 'alerta' }); return; }
      RP.envio.iniciar({ de: o.de, marchaId: o.marchaId, pessoas: o.marchaId ? o.parte : ids(), hex: h });
    },
    /* toque numa tropa: t = { ids, marchaId, localId, hex, obj } */
    tocarTropa: function (t) {
      if (RP.envio.ativo()) RP.envio.cancelar();
      var nova = !soldados();
      if (nova) { RP.selecao.definir(t.ids); RP.carregarTropas().catch(function () { /* offline */ }); return; }
      if (t.ids.every(function (id) { return !!sel[id]; })) {
        if (t.marchaId) RP.mapa.folhaObjeto(t.obj); else if (t.pilha) RP.folhaPessoasDoHex(t.hex); else RP.folhaPessoa(t.ids[0]);
        return;
      }
      var o = origem();
      if (o.erro) { RP.selecao.definir(t.ids); return; }
      if (o.de && t.localId === o.de) { RP.selecao.somar(t.ids); return; }   /* mesma guarnição: soma ao grupo */
      if (t.marchaId) { RP.envio.folhaJuntar(o, t); return; }
      RP.selecao.destino(t.hex);   /* soldado de outra guarnição: a tropa vai para aquele local */
    },
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
      if (o.marchaId) RP.envio.iniciar({ marchaId: o.marchaId, pessoas: o.parte });
      else RP.envio.iniciar({ de: o.de, pessoas: ids() });
      barra();
    },
    /* a tropa selecionada recebe uma patrulha: desenhar a linha no mapa */
    patrulha: function () {
      var o = origem();
      if (o.erro) { RP.aviso({ titulo: o.erro, icone: 'alerta', tipo: 'alerta' }); return; }
      modo = false;
      RP.envio.iniciar({ de: o.de, marchaId: o.marchaId, pessoas: o.marchaId ? o.parte : ids(), linha: true });
      barra();
    }
  };

  document.addEventListener('click', function (e) {
    var b;
    if (e.target.closest('[data-selecao-missao]')) RP.selecao.missao();
    else if (e.target.closest('[data-selecao-patrulha]')) RP.selecao.patrulha();
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
