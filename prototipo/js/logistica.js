/* Reino de Pedra — Logística: recursos ficam nos locais e precisam ser transportados.
   Caravanas de carroças (construídas com recursos) e tropas levam cargas de um local a outro;
   no caminho ficam visíveis e podem ser roubadas. Valores ilustrativos. */
(function () {
  'use strict';
  var RP = window.RP, D = RP.dados, W = RP.mundo, U = RP.util, G = U.grupo;
  var CARGA_UN = 20;   /* carga por ponto de "carga" da unidade: lanceiro 40, cavalaria 80 (balanceamento v1) */
  var VELS = ['Lenta', 'Média', 'Rápida'];

  function nomeLocal(id) { var x = W.local(id); return x ? (x.reino === 'meu' && x.tipo === 'castelo' ? 'Castelo de ' + RP.estado.nome : x.nome) : '—'; }
  function meus() { return D.locais.filter(function (x) { return x.reino === 'meu'; }); }
  function todosRec() { return RP.ORDEM_REC.concat(D.valiosos.map(function (v) { return v.id; })); }
  function cargaTxt(c) { return Object.keys(c).filter(function (k) { return c[k]; }).map(function (k) { return RP.num(c[k]) + ' de ' + RP.nomeRecurso(k); }).join(', '); }
  function somaCarga(c) { return Object.keys(c).reduce(function (s, k) { return s + (c[k] || 0); }, 0); }
  function capacidade(veic, esc) {
    var v = Object.keys(veic).reduce(function (s, k) { return s + (veic[k] || 0) * D.veiculos[k].carga; }, 0);
    var t = Object.keys(esc).reduce(function (s, k) { return s + (esc[k] || 0) * U.unidade(k).carga * CARGA_UN; }, 0);
    return { veiculos: v, tropas: t, total: v + t };
  }
  function velocidade(veic, esc) {
    var vs = Object.keys(veic).filter(function (k) { return veic[k]; }).map(function (k) { return VELS.indexOf(D.veiculos[k].vel); });
    if (G.soma(esc)) vs.push(VELS.indexOf(G.perfil(esc).vel));
    return VELS[vs.length ? Math.min.apply(null, vs) : 1];
  }
  RP.cargaTxt = cargaTxt;

  /* ---------------------------------------------------------------- requisição automática
     Construir (ou recrutar) gera uma requisição: o que falta no local vem dos locais mais próximos,
     levado por carregadores (população) sem ação do jogador. A carga é visível e pode ser roubada. */
  var CARGA_CARREGADOR = 50, camCache = {};
  function camLocais(a, b) {
    var kk = a + '>' + b;
    if (!(kk in camCache)) { var x = W.local(a), y = W.local(b); camCache[kk] = RP.caminho([x.c, x.l], [y.c, y.l], { vel: 'Média' }); }
    return camCache[kk];
  }
  RP.planoRequisicao = function (custo, destino) {
    var falta = {}, fontes = {}, ordem = [];
    Object.keys(custo).forEach(function (k) { if (k === 'populacao') return; var d = custo[k] - RP.qtdRecurso(k, destino); if (d > 0) falta[k] = Math.ceil(d); });
    var resta = Object.assign({}, falta);
    if (Object.keys(falta).length) {
      meus().filter(function (x) { return x.id !== destino; }).map(function (x) { return { id: x.id, cam: camLocais(x.id, destino) }; })
        .filter(function (o) { return o.cam; }).sort(function (a, b) { return a.cam.seg - b.cam.seg; })
        .forEach(function (o) {
          Object.keys(resta).forEach(function (k) {
            var t = Math.min(resta[k], Math.floor(RP.qtdRecurso(k, o.id)));
            if (t <= 0) return;
            if (!fontes[o.id]) { fontes[o.id] = { local: o.id, seg: o.cam.seg, hexes: o.cam.hexes, carga: {} }; ordem.push(fontes[o.id]); }
            fontes[o.id].carga[k] = t; resta[k] -= t;
          });
        });
    }
    var faltaReino = {};
    Object.keys(resta).forEach(function (k) { if (resta[k] > 0) faltaReino[k] = resta[k]; });
    var seg = ordem.reduce(function (s, v) { return Math.max(s, v.seg); }, 0);
    return { falta: falta, viagens: ordem, faltaReino: faltaReino, seg: seg, chegada: Date.now() + seg * 1000, completo: !Object.keys(faltaReino).length };
  };
  /* texto curto do plano: "o resto vem do Castelo e do Armazém Real (≈ 9 min)" */
  RP.textoPlano = function (p, destino) {
    if (!p.completo) return 'Faltam ' + cargaTxt(p.faltaReino) + ' no reino todo.';
    if (!p.viagens.length) return 'Material em ' + nomeLocal(destino) + '.';
    var nomes = p.viagens.map(function (v) { return nomeLocal(v.local); });
    return 'Parte do material vem ' + (nomes.length > 1 ? 'de ' + nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1] : 'de ' + nomes[0]) + ' · chega em ≈ ' + RP.fmtDuracao(p.seg) + '.';
  };
  RP.requisitar = function (custo, destino, para) {
    var p = RP.planoRequisicao(custo, destino), agora = Date.now();
    if (!p.completo) return null;
    var noLocal = {};
    Object.keys(custo).forEach(function (k) { if (k !== 'populacao') { var v = Math.min(custo[k], RP.qtdRecurso(k, destino)); if (v > 0) noLocal[k] = v; } });
    RP.gastar(noLocal, 1, destino);
    p.viagens.forEach(function (v, i) {
      Object.keys(v.carga).forEach(function (k) { RP.mudarEstoque(v.local, k, -v.carga[k]); });
      var n = Math.max(1, Math.ceil(somaCarga(v.carga) / CARGA_CARREGADOR));
      var m = W.adicionarMarcha({ id: 'm-abast-' + agora + '-' + i, dono: 'meu', tipo: 'caravana', carregadores: n, veiculos: {}, grupo: {}, alvo: destino, nome: 'Material a caminho',
        cargaTxt: cargaTxt(v.carga), resumo: n + ' carregador' + (n > 1 ? 'es' : '') + ' · ' + nomeLocal(v.local) + ' → ' + nomeLocal(destino) + (para ? ' · para ' + para : ''), seg: v.seg }, v.hexes);
      D.caravanas.push({ marcha: m.d.id, de: v.local, para: destino, carga: v.carga, veiculos: {}, escolta: {}, chegada: m.d.chegada, consumo: true, obra: para });
    });
    return p;
  };

  /* ---------------------------------------------------------------- exemplos em andamento */
  (function () {
    /* sua caravana: Serraria → Castelo, com 500 de madeira já reservada na serraria */
    var de = W.local('serraria'), para = W.local('castelo');
    var cam = RP.caminho([de.c, de.l], [para.c, para.l], { vel: 'Lenta' });
    if (cam) {
      var total = Math.max(cam.seg, 1500), passou = Math.round(total * 0.45);
      var m = W.adicionarMarcha({ id: 'm-carav', dono: 'meu', tipo: 'caravana', veiculos: { carroca: 1 }, grupo: { lanceiro: 2 }, alvo: 'castelo',
        nome: 'Caravana', resumo: '1 carroça e 2 lanceiros levam 500 de madeira → ' + nomeLocal('castelo'), cargaTxt: '500 de madeira', seg: total }, cam.hexes);
      m.d.inicio = Date.now() - passou * 1000; m.d.chegada = m.d.inicio + total * 1000; m.atual = m.posicao(); m.hex = m.atual.hex;
      D.caravanas.push({ marcha: 'm-carav', de: 'serraria', para: 'castelo', carga: { madeira: 500 }, veiculos: { carroca: 1 }, escolta: { lanceiro: 2 }, chegada: m.d.chegada });
    }
    /* caravana de dono desconhecido cruzando a área visível: interceptável */
    var cx = RP.caminho([27, 19], [20, 12], { vel: 'Lenta' });
    if (cx) {
      var tx = Math.max(cx.seg, 2400), px = Math.round(tx * 0.6);
      var mx = W.adicionarMarcha({ id: 'm-carav-x', dono: 'desconhecido', tipo: 'caravana', veiculos: { carroca: 2 }, rumo: 'noroeste',
        nome: 'Caravana desconhecida', resumo: '2 carroças carregadas · ≈ 6 tropas de escolta', cargaTxt: '≈ 1.000 de ferro (pelo peso das carroças)', seg: tx }, cx.hexes);
      mx.d.inicio = Date.now() - px * 1000; mx.d.chegada = mx.d.inicio + tx * 1000; mx.atual = mx.posicao(); mx.hex = mx.atual.hex;
    }
  })();

  /* chegada: a carga entra no estoque do destino; carroças e escolta voltam a ficar livres */
  document.addEventListener('rp:tique', function () {
    var agora = Date.now(), mudou = false;
    D.caravanas = D.caravanas.filter(function (cv) {
      if (cv.chegada > agora) return true;
      /* requisição: a carga é consumida pela obra; caravana manual: entra no estoque do destino */
      if (!cv.consumo) Object.keys(cv.carga).forEach(function (k) { RP.mudarEstoque(cv.para, k, cv.carga[k]); });
      Object.keys(cv.veiculos).forEach(function (k) { D.veiculos[k].qtd += cv.veiculos[k] || 0; });
      Object.keys(cv.escolta).forEach(function (k) { D.disponiveis[k] = (D.disponiveis[k] || 0) + (cv.escolta[k] || 0); });
      RP.aviso(cv.consumo ? { titulo: 'Material chegou', texto: nomeLocal(cv.para) + (cv.obra ? ': ' + cv.obra : '') + '.', icone: 'martelo', tipo: 'sucesso' }
        : { titulo: 'Caravana chegou', texto: nomeLocal(cv.para) + ' recebeu ' + cargaTxt(cv.carga) + '.', icone: 'carroca', tipo: 'sucesso' });
      mudou = true;
      return false;
    });
    if (mudou) { RP.invalidarTela('reino'); RP.invalidarTela('construcao'); RP.invalidarTela('recrutamento'); if (tela && !tela.hidden) desenhar(tela); }
  });

  /* ---------------------------------------------------------------- tela Caravana */
  var cv = { de: null, para: null, carga: {}, veic: { carroca: 0, carrocao: 0 }, escolta: { lanceiro: 0, arqueiro: 0, cavalaria: 0 }, caminho: 'curta', abertoDe: true, abertoPara: true, pedido: null };
  var tela = null;
  function escolhaLocal(x, attr, ativo, extra) {
    return '<button type="button" class="escolha escolha-linha" ' + attr + '="' + x.id + '" aria-pressed="' + ativo + '"><span class="ico-placa dono-meu">' + RP.icone(x.tipo) + '</span>' +
      '<span class="escolha-txt"><b>' + RP.esc(nomeLocal(x.id)) + '</b><small class="fraco">' + (extra || '') + '</small></span></button>';
  }
  function linhaCarga(k) {
    var q = cv.carga[k] || 0, disp = Math.floor(RP.qtdRecurso(k, cv.de));
    return '<div class="linha-entre grupo-linha"><span class="linha">' + RP.icone(k, 'r-' + k) + '<span><b>' + RP.nomeRecurso(k).charAt(0).toUpperCase() + RP.nomeRecurso(k).slice(1) + '</b><br><small class="fraco">' + RP.num(disp) + ' na origem</small></span></span>' +
      '<span class="linha" style="gap:4px"><span class="stepper"><button type="button" class="btn btn-icone" data-cv-rec="' + k + '" data-d="-1" aria-label="Menos ' + RP.nomeRecurso(k) + '"' + (q <= 0 ? ' disabled' : '') + '>' + RP.icone('menos') + '</button>' +
      '<output class="num">' + RP.numCurto(q) + '</output><button type="button" class="btn btn-icone" data-cv-rec="' + k + '" data-d="1" aria-label="Mais ' + RP.nomeRecurso(k) + '"' + (q >= disp ? ' disabled' : '') + '>' + RP.icone('mais') + '</button></span>' +
      '<button type="button" class="btn btn-p" data-cv-rec="' + k + '" data-d="max" aria-label="Tudo de ' + RP.nomeRecurso(k) + '">Tudo</button></span></div>';
  }
  function linhaVeic(k) {
    var v = D.veiculos[k], q = cv.veic[k] || 0;
    return '<div class="linha-entre grupo-linha"><span class="linha">' + RP.icone('carroca') + '<span><b>' + v.nome + '</b><br><small class="fraco">' + v.qtd + ' livre' + (v.qtd === 1 ? '' : 's') + ' · leva ' + RP.num(v.carga) + ' · ' + v.vel.toLowerCase() + '</small></span></span>' +
      '<span class="stepper"><button type="button" class="btn btn-icone" data-cv-veic="' + k + '" data-d="-1" aria-label="Menos ' + v.nome.toLowerCase() + '"' + (q <= 0 ? ' disabled' : '') + '>' + RP.icone('menos') + '</button>' +
      '<output class="num">' + q + '</output><button type="button" class="btn btn-icone" data-cv-veic="' + k + '" data-d="1" aria-label="Mais ' + v.nome.toLowerCase() + '"' + (q >= v.qtd ? ' disabled' : '') + '>' + RP.icone('mais') + '</button></span></div>';
  }
  /* escolhe origem, carga e carroças a partir do que falta no destino */
  function preencherPedido() {
    var p = cv.pedido; if (!p) return;
    var ks = Object.keys(p), outros = meus().filter(function (x) { return x.id !== cv.para; });
    var melhor = outros.map(function (x) { return { x: x, tem: ks.reduce(function (s, k) { return s + Math.min(p[k], RP.qtdRecurso(k, x.id)); }, 0) }; }).sort(function (a, b) { return b.tem - a.tem; })[0];
    cv.de = melhor ? melhor.x.id : RP.SEDE;
    cv.carga = {};
    ks.forEach(function (k) { var q = Math.min(p[k], Math.floor(RP.qtdRecurso(k, cv.de))); if (q > 0) cv.carga[k] = q; });
    var precisa = somaCarga(cv.carga);
    cv.veic = { carroca: Math.min(D.veiculos.carroca.qtd, Math.ceil(precisa / D.veiculos.carroca.carga)), carrocao: 0 };
    cv.abertoDe = false; cv.abertoPara = false; cv.pedido = null;
  }
  function desenhar(el) {
    var lista = meus();
    if (!cv.para || !W.local(cv.para)) cv.para = RP.SEDE;
    var origens = lista.filter(function (x) { return x.id !== cv.para && todosRec().some(function (k) { return RP.qtdRecurso(k, x.id) >= 1; }); });
    if (!cv.de || cv.de === cv.para || !origens.some(function (x) { return x.id === cv.de; })) { cv.de = origens[0] ? origens[0].id : null; cv.carga = {}; }
    var de = W.local(cv.de), para = W.local(cv.para), cast = W.local(RP.SEDE);
    Object.keys(cv.carga).forEach(function (k) { cv.carga[k] = Math.min(cv.carga[k], Math.floor(RP.qtdRecurso(k, cv.de))); });
    var soma = somaCarga(cv.carga), cap = capacidade(cv.veic, cv.escolta), vel = velocidade(cv.veic, cv.escolta), perfil = { vel: vel };
    var usaVeic = G.soma(cv.veic) > 0 || G.soma(cv.escolta) > 0;
    var ida = !de || de.id === cast.id ? { seg: 0, hexes: de ? [[de.c, de.l]] : [] } : RP.caminho([cast.c, cast.l], [de.c, de.l], perfil);
    var op = de && para ? U.opcoesCaminho([de.c, de.l], [para.c, para.l], perfil) : { curta: null, segura: null };
    if (cv.caminho === 'segura' && !op.segura) cv.caminho = 'curta';
    var volta = op[cv.caminho] || op.curta, forca = G.forca(cv.escolta);
    var recsOrigem = de ? todosRec().filter(function (k) { return RP.qtdRecurso(k, de.id) >= 1 || cv.carga[k]; }) : [];
    var h = '<div class="nota-regra">' + RP.icone('carroca', 'ico-p') + '<span>Recursos só servem <b>onde estão</b>. A caravana sai do castelo, busca a carga na origem e a leva ao destino. No caminho ela fica visível e <b>pode ser roubada</b>.</span></div>' +
      '<div class="secao-titulo">1. Para onde</div><div class="escolhas escolhas-lista">' + lista.filter(function (x) { return cv.abertoPara || x.id === cv.para; }).map(function (x) {
        return escolhaLocal(x, 'data-cv-para', x.id === cv.para, RP.TIPOS_LOCAL[x.tipo]);
      }).join('') + '</div>' + (!cv.abertoPara ? '<button type="button" class="btn btn-p btn-fantasma trocar-alvo" data-cv-trocar="para">' + RP.icone('menu') + 'Trocar destino (' + lista.length + ' opções)</button>' : '') +
      '<div class="secao-titulo">2. De onde</div>' + (origens.length ? '<div class="escolhas escolhas-lista">' + origens.filter(function (x) { return cv.abertoDe || x.id === cv.de; }).map(function (x) {
        return escolhaLocal(x, 'data-cv-de', x.id === cv.de, RP.estoqueHTML(x.id));
      }).join('') + '</div>' + (!cv.abertoDe ? '<button type="button" class="btn btn-p btn-fantasma trocar-alvo" data-cv-trocar="de">' + RP.icone('menu') + 'Trocar origem (' + origens.length + ' opções)</button>' : '') : '<p class="fraco">Nenhum outro local com estoque.</p>') +
      (de ? '<div class="secao-titulo">3. Carga</div><div class="card pilha">' + recsOrigem.map(linhaCarga).join('') + '</div>' : '') +
      '<div class="secao-titulo">4. Quem leva</div><div class="card pilha">' + Object.keys(D.veiculos).map(linhaVeic).join('') +
      '<p class="fraco" style="font-size:var(--fs-2)">Escolta: protege e também carrega um pouco.</p>' + G.linhas(cv.escolta, ['lanceiro', 'arqueiro', 'cavalaria'], G.disp) +
      '<div class="obj-carga"><div class="linha-entre"><span class="fraco">Carga</span><b class="num' + (soma > cap.total ? ' txt-perigo' : '') + '">' + RP.num(soma) + ' de ' + RP.num(cap.total) + '</b></div>' +
      '<div class="barra' + (soma > cap.total ? ' barra-perigo' : '') + '" role="progressbar" aria-label="Carga em relação à capacidade"><i style="width:' + Math.min(100, cap.total ? (100 * soma) / cap.total : (soma ? 100 : 0)).toFixed(1) + '%"></i></div>' +
      (soma > cap.total ? '<p class="nota-antiga">' + RP.icone('alerta', 'ico-p') + '<span>Não cabe. Adicione carroças ou tropas, ou leve menos.</span></p>' : '') +
      '<div class="ext-numeros"><div><span class="fraco">Carroças</span><b class="num">' + RP.num(cap.veiculos) + '</b></div><div><span class="fraco">Escolta</span><b class="num">' + RP.num(cap.tropas) + '</b></div><div><span class="fraco">Velocidade</span><b>' + vel + '</b></div></div></div>' +
      (usaVeic ? (forca < 15 ? '<p class="nota-antiga">' + RP.icone('alerta', 'ico-p') + '<span><b>Pouco protegida.</b> Animais e saqueadores atacam caravanas fracas. Uma escolta maior reduz o risco.</span></p>'
        : '<div class="risco-linha ok">' + RP.icone('escudo') + '<span><b>Escolta forte</b><br><small>Roubar esta caravana exige um exército.</small></span></div>') : '') + '</div>' +
      '<div class="secao-titulo">5. Caminho</div>' +
      (de && para && volta && ida ? (ida.seg ? '<div class="card linha"><span class="ico-placa dono-meu">' + RP.icone('castelo') + '</span><span style="flex:1"><b>Buscar</b><br><small class="fraco">Castelo → ' + RP.esc(nomeLocal(de.id)) + '</small></span><span class="rota-tempo">' + RP.icone('relogio', 'ico-p') + RP.fmtDuracao(ida.seg) + '</span></div>' : '') +
        '<div class="card mini-rota-card" style="margin-top:var(--esp-3)">' + U.miniRota(op, cv.caminho, nomeLocal(para.id), de.tipo) + '</div>' +
        '<div class="pilha" style="margin-top:var(--esp-3)">' + U.opcaoCaminho('curta', op.curta, cv.caminho) + U.opcaoCaminho('segura', op.segura, cv.caminho) + '</div>' +
        U.blocoRisco(volta.perigo ? (forca >= 12 ? 'nenhum' : volta.perigo.nivel) : null, volta.perigo, false) + '<div style="height:var(--esp-6)"></div>'
        : '<p class="fraco">Escolha origem e destino.</p>');
    RP.$('.cv-conteudo', el).innerHTML = h;
    var total = volta && ida ? ida.seg + volta.seg : 0, ok = soma > 0 && usaVeic && soma <= cap.total && total;
    RP.$('.rodape-resumo', el).innerHTML = ok
      ? '<div class="resumo-linha"><b>' + RP.esc(cargaTxt(cv.carga)) + ' → ' + RP.esc(nomeLocal(cv.para)) + '</b><span class="tempo">' + RP.icone('relogio', 'ico-p') + RP.fmtDuracao(total) + '</span></div><div class="resumo-linha fraco">' + [G.soma(cv.veic) ? (cv.veic.carroca ? cv.veic.carroca + ' carroça' + (cv.veic.carroca > 1 ? 's' : '') : '') + (cv.veic.carrocao ? ' ' + cv.veic.carrocao + ' carroção' : '') : '', G.soma(cv.escolta) ? 'escolta: ' + G.partes(cv.escolta) : 'sem escolta'].filter(Boolean).join(' · ') + '</div>'
      : '<div class="resumo-linha fraco">' + (!soma ? 'Escolha a carga.' : !usaVeic ? 'Escolha carroças ou tropas para levar.' : soma > cap.total ? 'A carga não cabe.' : 'Escolha o caminho.') + '</div>';
    RP.$('[data-enviar-caravana]', el).classList.toggle('btn-inativo', !ok);
    cv._ok = ok; cv._ida = ida; cv._volta = volta;
  }
  RP.registrarTela('caravana', {
    secao: 'reino',
    montar: function (el) {
      tela = el;
      el.innerHTML = U.topo('Transportar recursos', 'reino', 'Caravana') + '<div class="conteudo-tela cv-conteudo"></div>' +
        '<div class="rodape-acao rodape-com-resumo"><div class="rodape-resumo"></div><button type="button" class="btn btn-primario btn-bloco btn-grande" data-enviar-caravana>' + RP.icone('carroca') + 'Enviar caravana</button></div>';
      el.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-cv-para]'))) { cv.para = b.getAttribute('data-cv-para'); cv.abertoPara = false; desenhar(el); return; }
        if ((b = e.target.closest('[data-cv-de]'))) { cv.de = b.getAttribute('data-cv-de'); cv.carga = {}; cv.abertoDe = false; desenhar(el); return; }
        if ((b = e.target.closest('[data-cv-trocar]'))) { if (b.getAttribute('data-cv-trocar') === 'de') cv.abertoDe = true; else cv.abertoPara = true; desenhar(el); return; }
        if ((b = e.target.closest('[data-cv-rec]'))) {
          var k = b.getAttribute('data-cv-rec'), d = b.getAttribute('data-d'), disp = Math.floor(RP.qtdRecurso(k, cv.de));
          cv.carga[k] = d === 'max' ? disp : Math.max(0, Math.min(disp, (cv.carga[k] || 0) + (+d) * 100));
          desenhar(el); return;
        }
        if ((b = e.target.closest('[data-cv-veic]'))) { var v = b.getAttribute('data-cv-veic'); cv.veic[v] = Math.max(0, Math.min(D.veiculos[v].qtd, (cv.veic[v] || 0) + +b.getAttribute('data-d'))); desenhar(el); return; }
        if ((b = e.target.closest('[data-caminho]'))) { cv.caminho = b.getAttribute('data-caminho'); desenhar(el); return; }
        if (G.passo(e, cv.escolta, G.disp)) { desenhar(el); return; }
        if (e.target.closest('[data-enviar-caravana]')) {
          if (!cv._ok) { RP.aviso({ titulo: 'Caravana incompleta', texto: 'Escolha a carga e quem leva.', icone: 'carroca', tipo: 'alerta' }); return; }
          var agora = Date.now(), ida = cv._ida, volta = cv._volta, seg = ida.seg + volta.seg, carga = {}, veic = {}, esc = {};
          Object.keys(cv.carga).forEach(function (k) { if (cv.carga[k]) { carga[k] = cv.carga[k]; RP.mudarEstoque(cv.de, k, -cv.carga[k]); } });
          Object.keys(cv.veic).forEach(function (k) { if (cv.veic[k]) { veic[k] = cv.veic[k]; D.veiculos[k].qtd -= cv.veic[k]; } });
          Object.keys(cv.escolta).forEach(function (k) { if (cv.escolta[k]) { esc[k] = cv.escolta[k]; D.disponiveis[k] = G.disp(k) - cv.escolta[k]; } });
          var m = W.adicionarMarcha({ id: 'm-cv-' + agora, dono: 'meu', tipo: 'caravana', veiculos: veic, grupo: esc, alvo: cv.para, cargaTxt: cargaTxt(carga), nome: 'Caravana',
            resumo: cargaTxt(carga) + ' · ' + nomeLocal(cv.de) + ' → ' + nomeLocal(cv.para), seg: seg }, ida.hexes.concat(volta.hexes.slice(1)));
          D.caravanas.push({ marcha: m.d.id, de: cv.de, para: cv.para, carga: carga, veiculos: veic, escolta: esc, chegada: m.d.chegada });
          RP.aviso({ titulo: 'Caravana a caminho', texto: cargaTxt(carga) + ' chega a ' + nomeLocal(cv.para) + ' em ' + RP.fmtDuracao(seg) + '.', icone: 'carroca', tipo: 'sucesso' });
          cv.carga = {}; cv.veic = { carroca: 0, carrocao: 0 }; cv.escolta = { lanceiro: 0, arqueiro: 0, cavalaria: 0 };
          RP.invalidarTela('reino'); RP.invalidarTela('construcao'); RP.invalidarTela('recrutamento');
          U.irParaMarcha(m);
        }
      });
    },
    entrar: function (el, params) {
      if (params.get('para')) { cv.para = params.get('para'); cv.abertoPara = false; }
      if (params.get('de')) { cv.de = params.get('de'); cv.carga = {}; cv.abertoDe = false; }
      if (params.get('leva')) {
        cv.pedido = {};
        params.get('leva').split(',').forEach(function (p) { var kv = p.split(':'); if (kv[1]) cv.pedido[kv[0]] = +kv[1]; });
        preencherPedido();
      }
      desenhar(el);
    }
  });
})();
