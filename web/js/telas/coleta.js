/* Reino de Pedra — Coleta de madeira e pedra no mapa (#/coleta?hex=<hex>): tropas e civis sem trabalho cortam árvores
   (floresta) ou quebram pedra (colina, montanha) num hexágono explorado sem local e levam a carga ao local mais próximo
   que guarda o recurso. Dados: GET /coleta, POST /coleta/previa, POST /coleta. Também a ordem "Coletar" no envio pelo
   mapa (RP.ordensEnvio, só tropas) e o botão na folha do hexágono (RP.mapa.acoesFolhaHex). */
(function () {
  'use strict';
  var RP = window.RP, V = RP.valiosos, M = RP.mapaModelo;
  var RECURSO = { floresta: 'madeira', colina: 'pedra', montanha: 'pedra' };

  var col = { hex: null, de: null, grupo: {}, civis: 0, repetir: true, seguro: false, previa: null, dados: null };
  var tela = null;

  /* recurso do hexágono pelo terreno conhecido, se dá para coletar ali (explorado, sem local) */
  function recursoEm(h, dados) {
    if (h == null || !M.dados) return null;
    var t = M.terreno(h), rec = RECURSO[t];
    if (!rec || M.estado(h).nunca) return null;
    var objs = (dados && dados.porHex && dados.porHex[h]) || M.objetosEm(h);
    if (objs.some(function (o) { return o.tipo === 'local' && !o.ruina; })) return null;
    return rec;
  }
  RP.coletaRecurso = recursoEm;
  function verbo(rec) { return rec === 'madeira' ? 'Cortar madeira' : 'Quebrar pedra'; }
  function grupoAtual() { var g = {}; Object.keys(col.grupo).forEach(function (k) { if (col.grupo[k] > 0) g[k] = col.grupo[k]; }); return g; }
  function localDe() { return col.dados ? col.dados.locais.filter(function (l) { return l.id === col.de; })[0] : null; }

  function carregar() {
    return Promise.all([RP.get('/coleta'), RP.carregarTropas()]).then(function (x) {
      col.dados = x[0]; RP.sincronizar(x[0].agora);
      var ls = col.dados.locais;
      if (!col.de || !ls.some(function (l) { return l.id === col.de; })) {
        var c = ls.filter(function (l) { return l.tipo === 'castelo'; })[0] || ls[0];
        col.de = c ? c.id : null;
        col.grupo = {}; col.civis = c ? c.ociosos : 0;
      }
      var l = localDe();
      if (l) col.civis = Math.min(col.civis, l.ociosos);
    });
  }

  var pedirPrevia = V.debounce(function () {
    var g = grupoAtual();
    if (!col.de || col.hex == null || (!RP.somaGrupo(g) && !col.civis)) { col.previa = null; desenhar(); return; }
    var chave = col.de + '|' + col.hex + '|' + col.civis + '|' + JSON.stringify(g);
    RP.post('/coleta/previa', { deLocalId: col.de, tropas: g, civis: col.civis, hex: col.hex }).then(function (p) {
      if (chave !== col.de + '|' + col.hex + '|' + col.civis + '|' + JSON.stringify(grupoAtual())) return;
      col.previa = p; desenhar();
    }, function (e) { col.previa = { erro: e.message }; desenhar(); });
  }, 200);

  function grupoCard(e) {
    var t = e.trabalho, rec = t && t.recurso, carga = V.cargaTxt(e.carga);
    var titulo = e.estado === 'trabalhando' ? verbo(rec) : e.ordem === 'entregar-coleta' ? 'Levando a carga' + (e.alvo ? ' para ' + e.alvo : '') : 'A caminho da coleta';
    var quem = [e.total ? e.resumo : '', e.civis ? e.civis + (e.civis === 1 ? ' civil' : ' civis') : ''].filter(Boolean).join(' e ');
    var tempo = t && t.fim ? '<b class="num" data-fim="' + t.fim + '">' + RP.fmtResta(t.fim - RP.agora()) + '</b><small class="fraco">carga cheia</small>'
      : e.chegada && e.estado !== 'parado' ? '<b class="num" data-fim="' + e.chegada + '">' + RP.fmtResta(e.chegada - RP.agora()) + '</b><small class="fraco">chega</small>' : '';
    return '<div class="card emcampo"><span class="ico-placa dono-meu">' + RP.icone(rec || 'madeira', 'r-' + (rec || 'madeira')) + '</span>' +
      '<span class="emcampo-corpo"><b>' + RP.esc(titulo) + '</b><small class="fraco">' + RP.esc(quem) + (e.dados && e.dados.repetir ? ' · repete' : '') + '</small>' +
      '<small class="fraco">Carga ' + RP.esc(carga || '0') + ' de ' + RP.num(e.cargaMax) + '</small>' +
      '<span class="exercito-acoes"><button type="button" class="btn btn-p" data-col-voltar="' + e.id + '">' + RP.icone('voltar') + 'Voltar</button>' +
      '<a class="btn btn-p btn-fantasma" href="#/mapa?foco=' + e.hex + '">' + RP.icone('mapa') + 'Ver</a></span></span>' +
      '<span class="emcampo-tempo">' + tempo + '</span></div>';
  }

  function desenhar() {
    var el = tela; if (!el || el.hidden) return;
    var d = col.dados, cont = RP.$('.col-conteudo', el);
    if (!d) { cont.innerHTML = '<p class="fraco">Carregando…</p>'; return; }
    var rec = recursoEm(col.hex), p = col.previa, g = grupoAtual(), n = RP.somaGrupo(g) + col.civis, l = localDe();
    RP.$('.topo h1', el).textContent = rec ? verbo(rec) : 'Coleta';
    var h = '<div class="nota-regra">' + RP.icone('info', 'ico-p') + '<span><b>Madeira e pedra do mapa.</b> Civis sem trabalho e tropas cortam árvores na floresta ou quebram pedra na colina e na montanha, e levam a carga ao local mais próximo que guarda o recurso. Cada hexágono acaba e volta a encher com o tempo.</span></div>';
    if (d.grupos.length) h += '<div class="secao-titulo">Em andamento</div><div class="pilha">' + d.grupos.map(grupoCard).join('') + '</div>';
    if (col.hex == null || !rec) {
      h += '<p class="fraco" style="margin-top:var(--esp-3)">Clique num hexágono de floresta, colina ou montanha que você já explorou e escolha <b>Coletar</b>.</p>';
      cont.innerHTML = h + '<div style="height:var(--esp-6)"></div>';
      RP.$('.rodape-resumo', el).innerHTML = '<div class="resumo-linha fraco">Escolha o hexágono no mapa.</div>';
      RP.$('[data-coletar]', el).classList.add('btn-inativo');
      return;
    }
    var disp = p && !p.erro ? p.disponivel : null;
    h += '<div class="secao-titulo">Hexágono ' + RP.hex.c(col.hex) + ', ' + RP.hex.l(col.hex) + '</div><div class="card info">' +
      '<div class="info-linha"><span class="fraco">Recurso</span><span class="linha">' + RP.icone(rec, 'ico-p r-' + rec) + RP.esc(RP.nomeRecurso(rec)) + '</span></div>' +
      (disp != null ? '<div class="info-linha"><span class="fraco">Tem agora</span><span><b class="num">' + RP.num(disp) + '</b> de ' + RP.num(p.estoque) + (disp < p.estoque ? ' · volta a encher com o tempo' : '') + '</span></div>' : '') + '</div>';
    h += '<div class="secao-titulo">Quem vai</div><div class="card pilha">';
    if (d.locais.length > 1) h += '<div class="abas abas-rolagem" role="group" aria-label="De onde saem">' + d.locais.map(function (x) {
      return '<button type="button" class="aba" data-col-de="' + x.id + '" aria-pressed="' + (x.id === col.de) + '">' + RP.esc(x.nome) + '</button>';
    }).join('') + '</div>';
    if (!l) h += '<p class="fraco">Nenhum local com tropas ou civis sem trabalho.</p>';
    else {
      h += '<div class="linha-entre grupo-linha"><span class="linha">' + RP.icone('populacao') + '<span><b>Civis sem trabalho</b><br><small class="fraco">' + l.ociosos + ' em ' + RP.esc(l.nome) + ' · levam ' + RP.num(d.regras.cargaCivil) + ' cada · a pé</small></span></span>' +
        '<span class="linha grupo-ctrl" data-col-civis>' + RP.stepper('civis', col.civis, l.ociosos) + '</span></div>';
      h += '<div data-col-grupo>' + RP.grupoTropas.linhas(col.grupo, l.guarnicao) + '</div>';
      h += '<button type="button" class="alternar" data-col-repetir aria-pressed="' + col.repetir + '" style="width:100%">' + RP.icone('relogio') + '<span>Repetir <small class="fraco">(volta depois de cada entrega)</small></span><i aria-hidden="true"></i></button>';
    }
    h += '</div>';
    if (p && p.erro) h += '<p class="nota-antiga">' + RP.icone('alerta', 'ico-p') + '<span>' + RP.esc(p.erro) + '</span></p>';
    else if (p && p.motivo) h += '<p class="nota-antiga">' + RP.icone('alerta', 'ico-p') + '<span>' + RP.esc(p.motivo) + '</span></p>';
    else if (p && n) {
      h += '<div class="card"><div class="ext-numeros"><div><span class="fraco">Ritmo</span><b class="num">' + V.fmtRitmo(p.ritmo) + '/h</b></div>' +
        '<div><span class="fraco">Carga</span><b class="num">' + RP.num(p.cargaMax) + '</b></div><div><span class="fraco">Enche em</span><b class="num">≈ ' + V.fmtHoras(p.horasCarga) + '</b></div></div>' +
        '<p class="fraco" style="font-size:var(--fs-2);margin-top:var(--esp-2)">Leva a ' + RP.esc(p.deposito || 'o castelo') + '. Até ' + p.maxPessoas + ' pessoas por hexágono' + (p.jaNoHex ? ' (' + p.jaNoHex + ' suas já estão lá)' : '') + '; quanto mais gente, menos cada uma rende.</p></div>';
      if (p.viagem) h += '<div class="secao-titulo">Caminho</div>' + V.caminhos(p.viagem, col.seguro);
    }
    cont.innerHTML = h + '<div style="height:var(--esp-6)"></div>';
    var esc = p && p.viagem ? V.escolhida(p.viagem, col.seguro) : null, ok = n && esc && esc.ok && p && !p.erro && !p.motivo;
    RP.$('.rodape-resumo', el).innerHTML = ok
      ? '<div class="resumo-linha"><b>' + n + (n === 1 ? ' pessoa' : ' pessoas') + ' → ' + RP.esc(RP.nomeRecurso(rec)) + '</b><span class="tempo">' + RP.icone('relogio', 'ico-p') + V.fmtMin(esc.min) + '</span></div>'
      : '<div class="resumo-linha fraco">' + (!n ? 'Escolha civis ou tropas.' : p && (p.erro || p.motivo) ? RP.esc(p.erro || p.motivo) : 'Calculando…') + '</div>';
    var bt = RP.$('[data-coletar]', el);
    bt.innerHTML = RP.icone(rec) + 'Enviar para coletar';
    bt.classList.toggle('btn-inativo', !ok);
  }

  function enviar() {
    var g = grupoAtual(), p = col.previa;
    if ((!RP.somaGrupo(g) && !col.civis) || !p || p.erro || p.motivo) { RP.aviso({ titulo: 'Escolha quem vai', texto: 'Uma pessoa já basta.', icone: 'info', tipo: 'alerta' }); return; }
    V.tentar(RP.post('/coleta', { deLocalId: col.de, tropas: g, civis: col.civis, hex: col.hex, repetir: col.repetir, seguro: !!col.seguro })).then(function (ex) {
      var viagem = V.escolhida(p.viagem, col.seguro);
      RP.aviso({ titulo: 'A caminho da coleta', texto: 'Chega em ' + V.fmtMin(viagem && viagem.min) + ' e começa a ' + (recursoEm(col.hex) === 'madeira' ? 'cortar madeira.' : 'quebrar pedra.'), icone: recursoEm(col.hex) || 'madeira', tipo: 'sucesso' });
      col.grupo = {}; col.previa = null;
      if (RP.mapa.recarregar) RP.mapa.recarregar();
      RP.recarregarReino(); RP.carregarTropas().catch(function () { /* offline */ });
      carregar().then(function () { desenhar(); pedirPrevia(); });
      return ex;
    });
  }

  RP.registrarTela('coleta', {
    secao: 'tropas',
    montar: function (el) {
      tela = el;
      el.innerHTML = RP.topoVoltar('Coleta', 'tropas') + '<div class="conteudo-tela col-conteudo"></div>' +
        '<div class="rodape-acao rodape-com-resumo"><div class="rodape-resumo"></div><button type="button" class="btn btn-primario btn-bloco btn-grande" data-coletar>' + RP.icone('madeira') + 'Enviar para coletar</button></div>';
      var atualizar = V.debounce(function () { if (!el.hidden) carregar().then(desenhar, function () { /* offline */ }); }, 500);
      RP.ouvir('marchas', atualizar);
      el.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-col-de]'))) {
          col.de = +b.getAttribute('data-col-de'); col.grupo = {}; var l = localDe(); col.civis = l ? l.ociosos : 0;
          col.previa = null; desenhar(); pedirPrevia(); return;
        }
        if ((b = e.target.closest('[data-col-civis] [data-passo]'))) {
          var lc = localDe(); col.civis = Math.max(0, Math.min(lc ? lc.ociosos : 0, col.civis + +b.getAttribute('data-passo')));
          desenhar(); pedirPrevia(); return;
        }
        if (e.target.closest('[data-col-repetir]')) { col.repetir = !col.repetir; desenhar(); return; }
        if ((b = e.target.closest('[data-caminho]'))) { col.seguro = b.getAttribute('data-caminho') === 'segura'; desenhar(); return; }
        var lg = localDe();
        if (e.target.closest('[data-col-grupo]') && lg && RP.grupoTropas.clique(e, col.grupo, lg.guarnicao)) { desenhar(); pedirPrevia(); return; }
        if ((b = e.target.closest('[data-col-voltar]'))) {
          V.tentar(RP.post('/tropas/' + b.getAttribute('data-col-voltar') + '/ordem', { ordem: 'retornar' })).then(function () {
            RP.aviso({ titulo: 'Coleta encerrada', texto: 'Voltam com o que já tiraram.', icone: 'voltar', tipo: 'sucesso' });
            carregar().then(desenhar);
          });
          return;
        }
        if (e.target.closest('[data-coletar]')) enviar();
      });
    },
    entrar: function (el, params) {
      if (params.get('hex')) { col.hex = +params.get('hex'); col.previa = null; }
      desenhar();
      carregar().then(function () { desenhar(); pedirPrevia(); }, function () { /* aviso já mostrado */ });
    }
  });

  /* ---------------------------------------------------------------- mapa: ordem de envio e botão na folha do hexágono */
  RP.ordensEnvio = RP.ordensEnvio || [];
  RP.ordensEnvio.push({
    ordem: 'coletar', rotulo: 'Coletar aqui', verbo: 'Coletar', icone: 'madeira', titulo: 'Coletar em',
    descricao: function (h) {
      var rec = recursoEm(h);
      return '<div class="info-linha"><span class="fraco">Ordem</span><span>' + (rec === 'pedra' ? 'Quebram pedra' : 'Cortam madeira') + ' até a carga encher, levam ao local mais próximo e voltam</span></div>';
    },
    dados: function () { return { repetir: true }; },
    quando: function (h, dados) { return !!recursoEm(h, dados); },
    /* no submenu: só quem carrega, até o limite do hexágono */
    preparar: function () { return carregar().catch(function () { /* o servidor confere ao enviar */ }); },
    grupo: function (g, l, e) {
      var cabe = vagasNoHex(e.hex), r = {}, n = 0;
      Object.keys(g).forEach(function (k) {
        var u = RP.unidade(k), q = u && u.carga > 0 ? Math.min(g[k], cabe - n) : 0;
        if (q > 0) { r[k] = q; n += q; }
      });
      return r;
    }
  });
  function vagasNoHex(h) {
    var d = col.dados, max = d && d.regras ? d.regras.maxPessoas : 6;
    /* quem já vai ou já está neste hexágono: a marcha termina nele */
    var ja = ((M.dados && M.dados.marchas) || []).filter(function (x) { return x.dono === 'meu' && x.ordem === 'coletar' && x.caminho && x.caminho[x.caminho.length - 1] === h; })
      .reduce(function (s, x) { return s + ((x.pessoaIds && x.pessoaIds.length) || 0); }, 0);
    return Math.max(0, max - ja);
  }
  /* civis sem trabalho no submenu: do local mais perto que tem algum, até o limite do hexágono */
  function civisPara(h) {
    var ls = ((col.dados && col.dados.locais) || []).filter(function (l) { return l.ociosos > 0; })
      .sort(function (a, b) { return RP.hex.dist(a.hex, h) - RP.hex.dist(b.hex, h); }), l = ls[0];
    return l ? { local: l, n: Math.min(l.ociosos, vagasNoHex(h)) } : null;
  }
  RP.coletaCivis = {
    opcao: civisPara,
    enviar: function (h, localVisto) {
      return carregar().catch(function () { /* o servidor confere ao enviar */ }).then(function () {
        var c = civisPara(h), de = c ? c.local.id : localVisto, n = c ? c.n : 1;
        return V.tentar(RP.post('/coleta', { deLocalId: de, tropas: {}, civis: n, hex: h, repetir: true, seguro: false })).then(function (ex) {
          RP.aviso({ titulo: 'A caminho da coleta', texto: n + (n === 1 ? ' civil chega ' : ' civis chegam ') + RP.fmtEm(ex.chegada) + ' e ' + (n === 1 ? 'começa' : 'começam') + ' a ' + (recursoEm(h) === 'madeira' ? 'cortar madeira.' : 'quebrar pedra.'), icone: recursoEm(h) || 'madeira', tipo: 'sucesso' });
          if (RP.mapa.recarregar) RP.mapa.recarregar();
          RP.recarregarReino(); RP.carregarTropas().catch(function () { /* offline */ });
        });
      }).catch(function () { /* aviso já mostrado */ });
    }
  };
  RP.mapa.acoesFolhaHex.push(function (h, dados) {
    if (RP.envio && RP.envio.ativo()) return '';
    var rec = recursoEm(h, dados);
    if (!rec) return '';
    return '<a class="btn btn-p" href="#/coleta?hex=' + h + '" data-submenu="coletar">' + RP.icone(rec, 'r-' + rec) + (rec === 'madeira' ? 'Cortar madeira' : 'Quebrar pedra') + '</a>';
  });
  RP.ORDENS_NOMES = RP.ORDENS_NOMES || {};
  RP.ORDENS_NOMES.coletar = 'Coletar';
  RP.ORDENS_NOMES['entregar-coleta'] = 'Levar a coleta';
  RP.acoesTropas = RP.acoesTropas || [];
  RP.acoesTropas.push({ href: '#/coleta', icone: 'madeira', titulo: 'Coleta', texto: 'Madeira e pedra do mapa' });
  RP.itensMais = RP.itensMais || [];
  RP.itensMais.push({ icone: 'madeira', titulo: 'Coleta', texto: 'Civis e tropas cortam madeira e quebram pedra no mapa', href: '#/coleta' });
  RP.FILTROS_RELATORIO = RP.FILTROS_RELATORIO || [['', 'Todos']];
  RP.FILTROS_RELATORIO.push(['coleta', 'Coleta']);
})();
