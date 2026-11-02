/* Reino de Pedra — Extração, Envio de tropas (ataque e reforço), Posturas e Batalha em andamento.
   Valores e curvas são ilustrativos: a batalha é roteirizada para o protótipo, não simulada. */
(function () {
  'use strict';
  var RP = window.RP, H = RP.hex, D = RP.dados, W = RP.mundo, U = RP.util;

  function unidadesDisp(ids) { return ids.filter(function (id) { return U.unidade(id); }); }
  function somaGrupo(g) { return Object.keys(g).reduce(function (s, k) { return s + (g[k] || 0); }, 0); }
  function perfilGrupo(g) {
    var vels = Object.keys(g).filter(function (k) { return g[k]; }).map(function (k) { return U.unidade(k).vel; });
    return { vel: U.velPalavra(vels.length ? Math.min.apply(null, vels) : 3) };
  }
  function linhasGrupo(g, ids, maxDe) {
    return ids.map(function (id) {
      var u = U.unidade(id), disp = maxDe(id);
      return '<div class="linha-entre grupo-linha" data-unidade-grupo="' + id + '"><span class="linha">' + RP.icone(u.icone) +
        '<span><b>' + u.nome + '</b><br><small class="fraco">' + disp + ' disponíve' + (disp === 1 ? 'l' : 'is') + ' · carga ' + u.carga + ' · vel. ' + U.velPalavra(u.vel).toLowerCase() + '</small></span></span>' +
        U.stepper(id, g[id] || 0, disp) + '</div>';
    }).join('');
  }
  function passoGrupo(e, g, maxDe) {
    var b = e.target.closest('[data-passo]'), linha = e.target.closest('[data-unidade-grupo]');
    if (!b || !linha) return false;
    var id = linha.getAttribute('data-unidade-grupo');
    g[id] = Math.max(0, Math.min(maxDe(id), (g[id] || 0) + +b.getAttribute('data-passo')));
    return true;
  }
  function dispDe(id) { return D.disponiveis[id] || 0; }
  function partesGrupo(g) {
    return Object.keys(g).filter(function (k) { return g[k]; }).map(function (k) { return g[k] + ' ' + U.unidade(k).nome.toLowerCase() + (g[k] > 1 ? 's' : ''); }).join(', ');
  }
  function forcaGrupo(g) { return Object.keys(g).reduce(function (s, k) { var u = U.unidade(k); return s + (g[k] || 0) * (u.atk + u.def) / 2; }, 0); }
  /* usados também pelas telas de relíquias (transporte e interceptação) */
  U.grupo = { soma: somaGrupo, perfil: perfilGrupo, linhas: linhasGrupo, passo: passoGrupo, partes: partesGrupo, forca: forcaGrupo, disp: function (id) { return D.disponiveis[id] || 0; } };

  /* ================================================================ Extração */
  var ext = { jazida: null, grupo: { lanceiro: 1, arqueiro: 0, cavalaria: 0 }, posto: false, caminho: 'curta', destinoRel: null };
  /* locais seus que podem receber uma relíquia (um por local, contando as que já estão a caminho) */
  function locaisLivres() {
    return D.locais.filter(function (x) {
      return x.reino === 'meu' && !RP.reliquiaEm(x.id) && !D.reliquias.some(function (r) { return r.transito && r.transito.para === x.id; }) &&
        !D.escavacoes.some(function (q) { return q.destino === x.id; });
    });
  }
  /* ruínas antigas entram como escavação: lenta, finita, rende 1 relíquia e esgota a ruína */
  function jazidasExtraiveis() { return D.jazidas.filter(function (j) { return (j.classe !== 'lendario' || D.ruinasComReliquia.indexOf(j.id) >= 0) && W.estado(j.c, j.l).v !== 'desconhecido'; }); }
  function horasEscavar(r) { return r ? Math.max(4, 72 / r) : 0; }   /* ilustrativo: ≈12 h com 1 lanceiro, nunca menos de 4 h */
  function escavacaoDe(id) { return D.escavacoes.filter(function (q) { return q.jazida === id; })[0]; }
  /* ritmo ilustrativo: mais unidades (com retorno decrescente), mais carga, posto e rota aumentam; nada é obrigatório */
  function ritmo(g, posto, naRota) {
    var n = somaGrupo(g); if (!n) return 0;
    var carga = Object.keys(g).reduce(function (s, k) { return s + (g[k] || 0) * U.unidade(k).carga; }, 0) / n;
    return 6 * Math.pow(n, 0.8) * (carga / 2) * (posto ? 1.5 : 1) * (naRota ? 1.2 : 1);
  }
  function graficoCenarios(cen, horas) {
    var max = Math.max.apply(null, cen.map(function (c) { return c.v; })) || 1;
    return '<div class="grafico-barras" role="img" aria-label="' + (horas ? 'Horas até achar a relíquia' : 'Comparação de rendimento por hora') + '">' + cen.map(function (c) {
      var val = horas ? '≈ ' + Math.round(c.v) + ' h' : Math.round(c.v) + '/h';
      return '<div class="gb-linha' + (c.atual ? ' atual' : '') + '" tabindex="0" data-dica="' + RP.esc(c.nome + ': ' + (horas ? 'cerca de ' + Math.round(c.v) + ' horas' : Math.round(c.v) + ' por hora')) + '">' +
        '<span class="gb-rotulo">' + RP.esc(c.nome) + '</span><span class="gb-trilho"><i style="width:' + Math.max(2, (80 * c.v) / max).toFixed(1) + '%"></i></span>' +
        '<span class="gb-valor num">' + val + '</span></div>';
    }).join('') + '</div>';
  }
  function destinoRelHTML(j) {
    var livres = locaisLivres(), perfil = perfilGrupo(ext.grupo);
    if (!livres.length) return '<div class="secao-titulo">Ao achar, levar para</div><p class="nota-antiga">' + RP.icone('info', 'ico-p') + '<span>Todos os seus locais já guardam uma relíquia. Mova uma antes de escavar.</span></p>';
    var ops = livres.map(function (x) { var c = RP.caminho([j.c, j.l], [x.c, x.l], perfil); return { x: x, seg: c ? c.seg : Infinity }; }).sort(function (a, b) { return a.seg - b.seg; });
    if (!ext.destinoRel || !livres.some(function (x) { return x.id === ext.destinoRel; })) ext.destinoRel = ops[0].x.id;
    return '<div class="secao-titulo">Ao achar, levar para</div><div class="escolhas escolhas-lista">' + ops.slice(0, 4).map(function (o) {
      return '<button type="button" class="escolha escolha-linha" data-destino-escav="' + o.x.id + '" aria-pressed="' + (o.x.id === ext.destinoRel) + '"><span class="ico-placa dono-meu">' + RP.icone(o.x.tipo) + '</span>' +
        '<span class="escolha-txt"><b>' + RP.esc(o.x.tipo === 'castelo' ? 'Castelo de ' + RP.estado.nome : o.x.nome) + '</b><small class="fraco">' + RP.TIPOS_LOCAL[o.x.tipo] + ' · volta em ' + (isFinite(o.seg) ? RP.fmtDuracao(o.seg) : '—') + '</small></span></button>';
    }).join('') + '</div><p class="fraco" style="font-size:var(--fs-2);margin-top:var(--esp-2)">A relíquia não vai sozinha: o próprio grupo a carrega até lá e, no caminho, ela pode ser roubada. Grupo maior, escolta maior.</p>';
  }
  function desenharExtracao(el) {
    var lista = jazidasExtraiveis();
    if (!ext.jazida || !lista.some(function (j) { return j.id === ext.jazida; })) ext.jazida = lista[0].id;
    var j = W.jazida(ext.jazida), ativa = D.extracoes.filter(function (x) { return x.jazida === j.id; })[0];
    var escav = j.classe === 'lendario', emEscav = escav && escavacaoDe(j.id);
    var op = U.opcoesCaminho(U.castelo(), [j.c, j.l], perfilGrupo(ext.grupo));
    if (ext.caminho === 'segura' && !op.segura) ext.caminho = 'curta';
    var esc = op[ext.caminho] || op.curta, naRota = esc && esc.naRota > 0;
    var r = ritmo(ext.grupo, ext.posto, naRota), n = somaGrupo(ext.grupo);
    var custoPosto = D.construcoes.filter(function (x) { return x.id === 'posto'; })[0];
    var cen = [
      { nome: '1 lanceiro, sem preparo', v: ritmo({ lanceiro: 1 }, false, false) },
      { nome: 'Seu grupo', v: ritmo(ext.grupo, false, naRota), atual: !ext.posto },
      { nome: 'Seu grupo + posto', v: ritmo(ext.grupo, true, naRota), atual: ext.posto }
    ];
    if (escav) cen.forEach(function (c) { c.v = horasEscavar(c.v); });
    var estoque = Math.round(j.restante * 4000), dias = r ? estoque / (r * 24) : 0, hEsc = horasEscavar(r);
    var h = '<div class="nota-regra">' + RP.icone(escav ? 'lendario' : 'info', 'ico-p') + (escav
      ? '<span><b>Escavação.</b> Ruínas antigas guardam <b>1 relíquia</b>. Escavar é lento e esgota a ruína; o tipo da relíquia (ataque, produção ou resistência) só se conhece ao achar. Uma única unidade já escava.</span></div>'
      : '<span><b>Nada é obrigatório.</b> Uma única unidade sem preparo já extrai. Mais tropas, unidades com mais carga, posto e rota só aumentam velocidade e rendimento.</span></div>') +
      '<div class="secao-titulo">Jazida</div><div class="escolhas escolhas-lista">' + lista.map(function (x) {
        var e = W.estado(x.c, x.l), lend = x.classe === 'lendario', at = lend ? escavacaoDe(x.id) : D.extracoes.some(function (q) { return q.jazida === x.id; });
        return '<button type="button" class="escolha escolha-linha" data-jazida="' + x.id + '" aria-pressed="' + (x.id === ext.jazida) + '"><span class="ico-placa">' + RP.icone(x.tipo, 'r-' + (lend ? 'lendario' : x.tipo)) + '</span>' +
          '<span class="escolha-txt"><b>' + RP.esc(x.nome) + '</b><small class="fraco">' + (lend ? 'Escavação · guarda 1 relíquia' : Math.round(x.restante * 100) + '% restante') + ' · ' + (e.v === 'visivel' ? 'visível' : 'visto ' + RP.fmtHa(e.horas)) + '</small></span>' +
          (at ? '<span class="selo selo-visivel">' + (lend ? 'Escavando' : 'Extraindo') + '</span>' : '') + '</button>';
      }).join('') + '</div>' +
      (emEscav ? '<div class="card linha" style="margin-top:var(--esp-3)">' + RP.icone('picareta') + '<span style="flex:1"><b>Escavação em andamento</b><br><small class="fraco">' + RP.esc(partesGrupo(emEscav.grupo)) + ' · relíquia encontrada em</small></span><b class="num" data-fim="' + emEscav.fim + '">' + RP.fmtResta(emEscav.fim - Date.now()) + '</b></div>' : '') +
      (ativa ? '<div class="card linha" style="margin-top:var(--esp-3)">' + RP.icone('picareta') + '<span style="flex:1"><b>Extração em andamento</b><br><small class="fraco">' + U.unidade('lanceiro').nome + 's: ' + ativa.grupo.lanceiro + ' · ' + (ativa.posto ? 'com posto' : 'sem posto') + ' · há ' + ativa.horas + ' h</small></span><b class="num">' + ativa.ritmo + '/h</b></div>' : '') +
      '<div class="secao-titulo">Grupo</div><div class="card pilha">' + linhasGrupo(ext.grupo, ['lanceiro', 'arqueiro', 'cavalaria'], dispDe) +
      '<button type="button" class="alternar" data-posto aria-pressed="' + ext.posto + '" style="width:100%">' + RP.icone('picareta') + '<span>Construir posto de ' + (escav ? 'escavação' : 'extração') + ' <small class="fraco">(' + RP.fmtDuracao(custoPosto.tempo) + ')</small></span><i aria-hidden="true"></i></button>' +
      (ext.posto ? '<div class="linha" style="flex-wrap:wrap">' + RP.custoHTML(custoPosto.custo, 1, RP.SEDE) + '<small class="fraco">sai do castelo com o grupo e entra na fila de obras</small></div>' : '') + '</div>' +
      (escav && !emEscav ? destinoRelHTML(j) : '') +
      (escav
        ? '<div class="secao-titulo">Quanto cada escolha encurta a escavação</div><div class="card">' + graficoCenarios(cen, true) +
          '<div class="ext-numeros"><div><span class="fraco">Escavação</span><b class="num">' + (hEsc ? '≈ ' + Math.round(hEsc) + ' h' : '—') + '</b></div><div><span class="fraco">Viagem</span><b class="num">' + (esc ? RP.fmtDuracao(esc.seg) : '—') + '</b></div>' +
          '<div><span class="fraco">Rende</span><b class="num">1 relíquia</b></div></div>' +
          '<p class="fraco" style="font-size:var(--fs-2);margin-top:var(--esp-2)">Mais tropas e posto encurtam, mas escavar com cuidado leva no mínimo 4 h. Depois da relíquia, a ruína se esgota.</p></div>'
        : '<div class="secao-titulo">Como cada escolha muda o rendimento</div><div class="card">' + graficoCenarios(cen) +
          '<div class="ext-numeros"><div><span class="fraco">Ritmo</span><b class="num">' + Math.round(r) + '/h</b></div><div><span class="fraco">Por viagem</span><b class="num">' + Math.round(r * 0.9) + '</b></div>' +
          '<div><span class="fraco">Jazida dura</span><b class="num">' + (dias ? '≈ ' + (dias >= 1 ? Math.round(dias) + ' dias' : Math.round(dias * 24) + ' h') : '—') + '</b></div></div>' +
          '<p class="fraco" style="font-size:var(--fs-2);margin-top:var(--esp-2)">' + (naRota ? 'O caminho usa rota pública: viagens mais rápidas (+20%).' : 'Sem rota pública no caminho. Construir uma rota acelera as viagens.') + ' Jazidas são finitas.</p></div>') +
      '<div class="secao-titulo">Caminho</div>' +
      (esc ? '<div class="card mini-rota-card">' + U.miniRota(op, ext.caminho, j.nome) + '</div><div class="pilha" style="margin-top:var(--esp-3)">' + U.opcaoCaminho('curta', op.curta, ext.caminho) + U.opcaoCaminho('segura', op.segura, ext.caminho) + '</div>' +
        U.blocoRisco(esc.perigo ? (forcaGrupo(ext.grupo) >= 12 ? 'nenhum' : esc.perigo.nivel) : null, esc.perigo, false) : '<p class="fraco">Sem caminho possível.</p>');
    RP.$('.ext-conteudo', el).innerHTML = h;
    RP.$('.rodape-resumo', el).innerHTML = emEscav ? '<div class="resumo-linha fraco">Esta ruína já está sendo escavada.</div>'
      : n && esc ? '<div class="resumo-linha"><b>' + partesGrupo(ext.grupo) + ' → ' + RP.esc(j.nome) + '</b><span class="tempo">' + RP.icone('relogio', 'ico-p') + RP.fmtDuracao(esc.seg) + '</span></div>' + (escav ? '<div class="resumo-linha fraco">depois ≈ ' + Math.round(hEsc) + ' h escavando</div>' : '') : '<div class="resumo-linha fraco">Escolha ao menos uma unidade.</div>';
    RP.$('.topo h1', el).textContent = escav ? 'Escavação de ruína' : 'Extração de recurso';
    var bt = RP.$('[data-extrair]', el);
    bt.innerHTML = RP.icone('picareta') + (escav ? 'Enviar para escavar' : 'Enviar para extrair');
    bt.classList.toggle('btn-inativo', !n || !esc || !!emEscav);
    ext._esc = esc; ext._r = r; ext._horas = hEsc; ext._ocupada = !!emEscav;
  }
  RP.registrarTela('extracao', {
    secao: 'tropas',
    montar: function (el) {
      el.innerHTML = U.topo('Extração de recurso', 'tropas') + '<div class="conteudo-tela ext-conteudo"></div>' +
        '<div class="rodape-acao rodape-com-resumo"><div class="rodape-resumo"></div><button type="button" class="btn btn-primario btn-bloco btn-grande" data-extrair>' + RP.icone('picareta') + 'Enviar para extrair</button></div>';
      el.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-jazida]'))) { ext.jazida = b.getAttribute('data-jazida'); desenharExtracao(el); return; }
        if ((b = e.target.closest('[data-caminho]'))) { ext.caminho = b.getAttribute('data-caminho'); desenharExtracao(el); return; }
        if (e.target.closest('[data-posto]')) { ext.posto = !ext.posto; desenharExtracao(el); return; }
        if ((b = e.target.closest('[data-destino-escav]'))) { ext.destinoRel = b.getAttribute('data-destino-escav'); desenharExtracao(el); return; }
        if (passoGrupo(e, ext.grupo, dispDe)) { desenharExtracao(el); return; }
        if (e.target.closest('[data-extrair]')) {
          var esc = ext._esc, n = somaGrupo(ext.grupo), j = W.jazida(ext.jazida);
          if (ext._ocupada) { RP.aviso({ titulo: 'Já em escavação', texto: 'Esta ruína já está sendo escavada.', icone: 'picareta', tipo: 'alerta' }); return; }
          if (!n || !esc) { RP.aviso({ titulo: 'Escolha o grupo', texto: 'Uma unidade já basta.', icone: 'info', tipo: 'alerta' }); return; }
          var escav = j.classe === 'lendario';
          if (escav && !ext.destinoRel) { RP.aviso({ titulo: 'Sem local livre', texto: 'Mova uma relíquia antes de escavar.', icone: 'lendario', tipo: 'alerta' }); return; }
          if (ext.posto) {
            var cp = D.construcoes.filter(function (x) { return x.id === 'posto'; })[0], falta = RP.faltas(cp.custo, 1, RP.SEDE);
            if (falta.length) { RP.aviso({ titulo: 'Sem recursos para o posto', texto: 'Faltam ' + falta.join(', ') + '. Envie sem posto ou espere.', icone: 'alerta', tipo: 'perigo' }); return; }
            RP.gastar(cp.custo, 1, RP.SEDE);   /* o material sai do castelo com o grupo */
            var ult = D.filas.obras.length ? RP.fimItem(D.filas.obras[D.filas.obras.length - 1]) : Date.now();
            D.filas.obras.push({ local: null, rotulo: 'Posto de ' + (escav ? 'escavação' : 'extração') + ' · ' + j.nome, fim: Math.max(ult, Date.now()) + cp.tempo * 1000, total: cp.tempo });
          }
          Object.keys(ext.grupo).forEach(function (k) { D.disponiveis[k] = dispDe(k) - (ext.grupo[k] || 0); });
          var m = W.adicionarMarcha({ id: 'm-ext-' + Date.now(), dono: 'meu', tipo: 'extracao', grupo: Object.assign({}, ext.grupo), alvo: j.id,
            nome: escav ? 'Grupo de escavação' : 'Grupo de extração', resumo: partesGrupo(ext.grupo) + ' → ' + j.nome, seg: esc.seg }, esc.hexes);
          if (escav) {
            var chega = Date.now() + esc.seg * 1000;
            D.escavacoes.push({ jazida: j.id, grupo: Object.assign({}, ext.grupo), chega: chega, fim: chega + Math.round(ext._horas * 3600) * 1000, destino: ext.destinoRel });
            RP.invalidarTela('reliquias');
          } else D.extracoes.push({ id: 'ex-' + Date.now(), jazida: j.id, grupo: Object.assign({}, ext.grupo), posto: ext.posto, ritmo: Math.round(ext._r), horas: 0, aCaminho: true });
          ext.grupo = { lanceiro: 1, arqueiro: 0, cavalaria: 0 }; ext.posto = false;
          RP.aviso({ titulo: 'Grupo a caminho', texto: 'Chega em ' + RP.fmtDuracao(esc.seg) + (escav ? ' e escava por ≈ ' + Math.round(ext._horas) + ' h.' : ' e começa a extrair.'), icone: 'picareta', tipo: 'sucesso' });
          U.irParaMarcha(m);
        }
      });
    },
    entrar: function (el, params) { if (params.get('jazida')) ext.jazida = params.get('jazida'); desenharExtracao(el); }
  });

  /* ================================================================ Envio de tropas: ataque e reforço */
  var env = { modo: 'ataque', alvo: null, listaAberta: true, tipo: 'saque', grupo: { lanceiro: 0, arqueiro: 0, cavalaria: 0, ariete: 0 }, estandarte: false, caminho: 'curta',
    obj: {}, objAlvo: null, tatica: 'media', encher: false };
  var LEVA_RELIQUIA = { saque: true, ocupacao: true, cerco: true };   /* sabotagem e massacre não levam a relíquia */
  function reliquiaAlvo(x) { var r = x && x.reino && x.reino !== 'meu' ? RP.reliquiaEm(x.id, true) : null; return r && r.dono !== 'meu' ? r : null; }
  function alvosAtaque() { return D.locais.filter(function (x) { return x.reino !== 'meu' && W.estado(x.c, x.l).v !== 'desconhecido'; }); }
  function destinosReforco() { return D.locais.filter(function (x) { return x.reino === 'meu' && x.tipo !== 'castelo'; }); }
  function ruinasConhecidas() { return D.ruinas.filter(function (r) { return W.estado(r.c, r.l).v !== 'desconhecido'; }); }
  function nomeAlvo(x) { return x.reino ? W.nomeAparente(x) : x.nome; }
  function acharAlvo(id) { return W.local(id) || W.ruina(id); }

  /* ---------------------------------------------------------------- objetivos e tática do ataque
     As tropas perseguem os objetivos na ordem escolhida e sabem quando parar e voltar.
     Valores e limites ilustrativos. */
  var TATICAS = [
    { id: 'conservadora', nome: 'Conservadora', icone: 'escudo', txt: 'Recua com 25% de baixas.', perdas: 25 },
    { id: 'media', nome: 'Média', icone: 'tropas', txt: 'Recua com 40% de baixas.', perdas: 40 },
    { id: 'agressiva', nome: 'Agressiva', icone: 'alvo', txt: 'Recua com 60% de baixas.', perdas: 60 },
    { id: 'sem-limite', nome: 'Sem limite', icone: 'estandarte', txt: 'Não recua por baixas: luta até cumprir ou cair.', perdas: null }
  ];
  var REC_SAQUE = ['madeira', 'pedra', 'comida', 'ferro', 'couro', 'peles'];
  var NOME_REC = { madeira: 'madeira', pedra: 'pedra', comida: 'comida', ferro: 'ferro', couro: 'couro', peles: 'peles' };
  function tatica() { return TATICAS.filter(function (t) { return t.id === env.tatica; })[0]; }
  function recursoDoAlvo(x) {
    var i = ((x.info || [])[0] || '').toLowerCase();
    return REC_SAQUE.indexOf(i) >= 0 ? i : ({ mina: 'ferro', serraria: 'madeira', vila: 'comida', pasto: 'couro', armazem: 'madeira', ferraria: 'ferro' }[x.tipo] || 'madeira');
  }
  function objPadrao(tipo, x, rel) {
    var l = [];
    if (tipo === 'ocupacao') l.push({ k: 'tomar', fixo: true });
    if (rel && LEVA_RELIQUIA[tipo]) l.push({ k: 'reliquia' });
    if (tipo === 'saque') l.push({ k: 'recurso', r: recursoDoAlvo(x), q: 1000 });
    if (tipo === 'sabotagem') l.push({ k: 'construcao', q: 1 });
    if (tipo === 'massacre') l.push({ k: 'populacao', q: 100 });
    if (tipo === 'cerco') l.push({ k: 'muralha', q: 2 });
    return l;
  }
  function catalogo(tipo, rel) {
    var c = [];
    if (rel && LEVA_RELIQUIA[tipo]) c.push({ k: 'reliquia' });
    if (tipo === 'saque' || tipo === 'cerco') REC_SAQUE.forEach(function (r) { c.push({ k: 'recurso', r: r, q: 1000 }); });
    if (tipo === 'sabotagem' || tipo === 'cerco') c.push({ k: 'muralha', q: 1 });
    if (tipo === 'sabotagem') c.push({ k: 'construcao', q: 1 });
    if (tipo === 'massacre') c.push({ k: 'populacao', q: 100 });
    return c;
  }
  function chaveObj(o) { return o.k + (o.r ? ':' + o.r : ''); }
  function objetivos() {
    var x = acharAlvo(env.alvo);
    if (env.objAlvo !== env.alvo) { env.obj = {}; env.objAlvo = env.alvo; }
    if (!env.obj[env.tipo]) env.obj[env.tipo] = objPadrao(env.tipo, x, reliquiaAlvo(x));
    return env.obj[env.tipo];
  }
  function nomeObj(o, x, rel) {
    if (o.k === 'reliquia') return rel ? rel.nome : 'Relíquia';
    if (o.k === 'recurso') return RP.num(o.q) + ' de ' + NOME_REC[o.r];
    if (o.k === 'muralha') return 'Muralha −' + o.q + (o.q > 1 ? ' níveis' : ' nível');
    if (o.k === 'construcao') return RP.TIPOS_LOCAL[x.tipo] + ' −' + o.q + (o.q > 1 ? ' níveis' : ' nível');
    if (o.k === 'populacao') return RP.num(o.q) + ' de população';
    if (o.k === 'tomar') return 'Tomar o local';
    return '';
  }
  function rotuloAdd(o) { return o.k === 'reliquia' ? 'Relíquia' : o.k === 'recurso' ? NOME_REC[o.r].charAt(0).toUpperCase() + NOME_REC[o.r].slice(1) : o.k === 'muralha' ? 'Muralha' : o.k === 'construcao' ? 'Construção' : 'População'; }
  function iconeObj(o, x) { return { reliquia: 'lendario', recurso: o.r, muralha: 'muralha', construcao: x.tipo, populacao: 'populacao', tomar: 'bandeira' }[o.k]; }
  /* o que a espionagem diz sobre cada objetivo */
  function previsaoObj(o, x, rel, esp) {
    if (o.k === 'tomar') return 'O local passa a ser seu até alguém retomar.';
    if (o.k === 'reliquia') return env.tipo === 'ocupacao' ? 'Fica no local tomado.' : 'Volta com as tropas e pode ser interceptada na volta.';
    if (!esp) return '<a href="#/exploradores?tipo=batedor&alvo=' + x.c + ',' + x.l + '">Desconhecido · espione antes</a>';
    if (o.k === 'recurso') {
      var est = esp.estoque && esp.estoque[o.r];
      if (!est) return 'Não visto no alvo (espionagem ' + RP.fmtHa(esp.horas) + ').';
      return '≈ ' + RP.num(est) + ' no alvo (espionagem ' + RP.fmtHa(esp.horas) + ')' + (est < o.q ? ' · <b class="txt-alerta">pode faltar</b>' : '') + '.';
    }
    if (o.k === 'muralha') return 'Espionagem: ' + RP.esc(esp.defesa) + '.';
    if (o.k === 'populacao') return 'A população reage como milícia.';
    return 'Espionado ' + RP.fmtHa(esp.horas) + '.';
  }
  function passoObj(o, d) {
    if (o.k === 'recurso') o.q = Math.max(500, Math.min(50000, o.q + d * 500));   /* d = ±1: 500; d = 10: +5.000 */
    else if (o.k === 'muralha' || o.k === 'construcao') o.q = Math.max(1, Math.min(3, o.q + Math.sign(d)));
    else if (o.k === 'populacao') o.q = Math.max(25, Math.min(1000, o.q + d * 25));
  }
  function textoObjs(lista, x, rel) { return lista.map(function (o) { return nomeObj(o, x, rel); }).join(', '); }
  function cargaObjs(lista) { return lista.reduce(function (s, o) { return s + (o.k === 'recurso' ? o.q : 0); }, 0); }
  function quandoVoltam(lista, x, rel, cap) {
    var t = tatica(), itens = [], temRec = lista.some(function (o) { return o.k === 'recurso'; }), levaCarga = env.tipo === 'saque' || env.tipo === 'cerco';
    itens.push(env.tipo === 'ocupacao' ? 'Ao tomar o local, ficam nele como guarnição.' : 'Ao cumprir os objetivos' + (levaCarga && env.encher ? ' e completar a carga com o que houver' : '') + ', voltam.');
    if (levaCarga && (temRec || env.encher)) itens.push('Se a carga encher antes' + (cap ? ' (' + RP.num(cap) + ')' : '') + ', voltam.');
    itens.push(t.perdas ? 'Se tiverem ' + t.perdas + '% de baixas, recuam com o que já pegaram.' : 'Não recuam por baixas: lutam até cumprir ou cair.');
    return itens;
  }
  function htmlObjetivos(x, rel, esp, cap) {
    var lista = objetivos(), cat = catalogo(env.tipo, rel).filter(function (c) { return !lista.some(function (o) { return chaveObj(o) === chaveObj(c); }); });
    var levaCarga = env.tipo === 'saque' || env.tipo === 'cerco', soma = cargaObjs(lista), t = tatica();
    var h = '<div class="secao-titulo">4. Objetivos</div>' +
      '<p class="fraco" style="font-size:var(--fs-2);margin-bottom:var(--esp-2)">As tropas perseguem os objetivos nesta ordem. Se um não existir no local, passam ao próximo.</p>' +
      '<div class="card pilha obj-lista">' + (lista.length ? lista.map(function (o, i) {
        var ajustavel = o.k !== 'reliquia' && o.k !== 'tomar', primeiro = i === 0 || (lista[i - 1] && lista[i - 1].fixo);
        return '<div class="obj-item' + (o.k === 'reliquia' && rel ? ' tipo-' + rel.tipo : '') + '">' +
          '<div class="obj-linha"><span class="obj-n" aria-label="Prioridade ' + (i + 1) + '">' + (i + 1) + '</span><span class="ico-placa' + (o.k === 'reliquia' ? ' obj-relq' : '') + '">' + RP.icone(iconeObj(o, x), o.k === 'recurso' ? 'r-' + o.r : '') + '</span>' +
          '<span class="obj-txt"><b>' + RP.esc(nomeObj(o, x, rel)) + '</b><small class="fraco">' + previsaoObj(o, x, rel, esp) + '</small></span>' +
          (o.fixo ? '' : '<button type="button" class="btn btn-icone btn-fantasma" data-obj-subir="' + i + '" aria-label="Subir prioridade de ' + RP.esc(nomeObj(o, x, rel)) + '"' + (primeiro ? ' disabled' : '') + '>' + RP.icone('subir') + '</button>' +
            '<button type="button" class="btn btn-icone btn-fantasma" data-obj-tirar="' + i + '" aria-label="Remover ' + RP.esc(nomeObj(o, x, rel)) + '">' + RP.icone('fechar') + '</button>') + '</div>' +
          (ajustavel ? '<div class="obj-qtd"><div class="stepper"><button type="button" class="btn btn-icone" data-obj-passo="' + i + '" data-d="-1" aria-label="Menos">' + RP.icone('menos') + '</button>' +
            '<output class="num">' + (o.k === 'recurso' ? RP.numCurto(o.q) : o.k === 'populacao' ? o.q : '−' + o.q) + '</output>' +
            '<button type="button" class="btn btn-icone" data-obj-passo="' + i + '" data-d="1" aria-label="Mais">' + RP.icone('mais') + '</button></div>' +
            (o.k === 'recurso' ? '<button type="button" class="btn btn-p" data-obj-passo="' + i + '" data-d="10">+5k</button>' : '') + '</div>' : '') + '</div>';
      }).join('') : '<p class="fraco">Sem objetivos. Adicione ao menos um.</p>') +
      (cat.length ? '<div class="obj-add"><span class="fraco">Adicionar</span><div class="obj-add-lista">' + cat.map(function (c) {
        return '<button type="button" class="btn btn-p" data-obj-add="' + chaveObj(c) + '">' + RP.icone(iconeObj(c, x), c.k === 'recurso' ? 'ico-p r-' + c.r : c.k === 'reliquia' ? 'ico-p r-lendario' : 'ico-p') + rotuloAdd(c) + '</button>';
      }).join('') + '</div></div>' : '') +
      (levaCarga && soma ? '<div class="obj-carga"><div class="linha-entre"><span class="fraco">Carga dos objetivos</span><b class="num' + (soma > cap ? ' txt-perigo' : '') + '">' + RP.num(soma) + ' de ' + RP.num(cap) + '</b></div>' +
        '<div class="barra' + (soma > cap ? ' barra-perigo' : '') + '" role="progressbar" aria-label="Carga dos objetivos em relação à capacidade das tropas"><i style="width:' + Math.min(100, cap ? (100 * soma) / cap : 100).toFixed(1) + '%"></i></div>' +
        (soma > cap ? '<p class="nota-antiga">' + RP.icone('alerta', 'ico-p') + '<span>Os objetivos passam da carga. As tropas param quando a carga encher: leve mais tropas (cavalaria carrega mais) ou reduza.</span></p>' : '') + '</div>' : '') +
      '</div>' +
      '<div class="secao-titulo">5. Tática</div><div class="escolhas escolhas-lista" role="radiogroup" aria-label="Tática">' + TATICAS.map(function (tt) {
        return '<button type="button" class="escolha escolha-linha" role="radio" data-tatica="' + tt.id + '" aria-checked="' + (env.tatica === tt.id) + '"><span class="ico-placa">' + RP.icone(tt.icone) + '</span><span class="escolha-txt"><b>' + tt.nome + '</b><small class="fraco">' + tt.txt + '</small></span></button>';
      }).join('') + '</div>' +
      (levaCarga ? '<button type="button" class="alternar" data-encher aria-pressed="' + env.encher + '" style="width:100%;margin-top:var(--esp-3)">' + RP.icone('ouro') + '<span>Depois dos objetivos, encher a carga<br><small class="fraco">com o que houver no local</small></span><i aria-hidden="true"></i></button>' : '') +
      '<div class="card quando-voltam"><span class="rotulo">Quando param</span><ul class="regras-lista">' + quandoVoltam(lista, x, rel, cap).map(function (q, i, arr) {
        return '<li>' + RP.icone(i === 0 ? 'check' : i === arr.length - 1 ? 'escudo' : 'ouro', 'ico-p') + '<span>' + RP.esc(q) + '</span></li>';
      }).join('') + '</ul>' +
      (lista.some(function (o) { return o.k === 'reliquia'; }) && env.tipo !== 'ocupacao' ? '<p class="nota-antiga">' + RP.icone('lendario', 'ico-p') + '<span>A relíquia não volta sozinha: vem com as tropas e pode ser interceptada no caminho de volta.</span></p>' : '') + '</div>';
    return h;
  }

  function desenharEnvio(el) {
    var ataque = env.modo === 'ataque', ocupar = env.modo === 'ocupar';
    var lista = ataque ? alvosAtaque() : ocupar ? ruinasConhecidas() : destinosReforco();
    if (!env.alvo || !lista.some(function (x) { return x.id === env.alvo; })) env.alvo = lista[0].id;
    var x = acharAlvo(env.alvo), e = W.estado(x.c, x.l), esp = x.espionado;
    if (env.tipo === 'cerco' && x.tipo !== 'castelo') env.tipo = 'saque';
    var op = U.opcoesCaminho(U.castelo(), [x.c, x.l], perfilGrupo(env.grupo));
    if (env.caminho === 'segura' && !op.segura) env.caminho = 'curta';
    var esc = op[env.caminho] || op.curta, n = somaGrupo(env.grupo), carga = Object.keys(env.grupo).reduce(function (s, k) { return s + (env.grupo[k] || 0) * U.unidade(k).carga * 25; }, 0);
    var saques = D.saquesRecentes[x.id] || 0;   /* escudo de novato não aparece aqui: só é descoberto ao chegar */
    var rel = ataque ? reliquiaAlvo(x) : null, levaRel = rel && LEVA_RELIQUIA[env.tipo];
    var muroAlvo = ataque && RP.muros.de(x.id), estMuro = muroAlvo && RP.muros.estado(muroAlvo);
    if (estMuro === 'desconhecido') muroAlvo = null;
    var h = (ocupar ? '<div class="nota-regra">' + RP.icone('bandeira', 'ico-p') + '<span>Ruínas e terra livre não têm dono. Ocupar toma o local; depois você pode reconstruí-lo.</span></div>' : '') +
      '<div class="secao-titulo"' + (ocupar ? '' : ' style="margin-top:0"') + '>' + (ataque ? '1. Alvo' : '1. Destino') + '</div><div class="escolhas escolhas-lista">' + lista.filter(function (q) { return env.listaAberta || q.id === env.alvo; }).map(function (q) {
      var ee = W.estado(q.c, q.l), ru = !q.reino;
      return '<button type="button" class="escolha escolha-linha" data-alvo="' + q.id + '" aria-pressed="' + (q.id === env.alvo) + '"><span class="ico-placa dono-' + (ru ? 'desconhecido' : D.reinos[W.donoAparente(q)].cor) + '">' + RP.icone(ru ? (q.tipo === 'livre' ? 'estaca' : 'escombros') : q.tipo) + '</span>' +
        '<span class="escolha-txt"><b>' + RP.esc(nomeAlvo(q)) + '</b><small class="fraco">' + (ru ? 'Sem dono · ' + (ee.v === 'visivel' ? 'visível' : 'visto ' + RP.fmtHa(ee.horas)) : ataque ? (q.espionado ? D.reinos[q.reino].nome + ' · espionado' : 'Dono desconhecido') + ' · ' + (ee.v === 'visivel' ? 'visível' : 'visto ' + RP.fmtHa(ee.horas)) : RP.esc(q.guarnicao)) + '</small></span>' +
        (reliquiaAlvo(q) ? '<span class="selo selo-relq tipo-' + reliquiaAlvo(q).tipo + '" title="Relíquia espionada">' + RP.icone('lendario') + 'Relíquia</span>' : '') +
        (q.ameaca ? '<span class="selo selo-perigo">Ameaçado</span>' : '') + '</button>';
    }).join('') + '</div>' + (!env.listaAberta && lista.length > 1 ? '<button type="button" class="btn btn-p btn-fantasma trocar-alvo" data-trocar-alvo>' + RP.icone('menu') + 'Trocar ' + (ataque ? 'alvo' : 'destino') + ' (' + lista.length + ' opções)</button>' : '');
    if (ataque) {
      h += '<div class="card pilha" style="margin-top:var(--esp-3)"><div class="info">' +
        '<div class="info-linha"><span class="fraco">Dono</span><span>' + (esp ? RP.esc(D.reinos[x.reino].nome) : 'Desconhecido') + '</span></div>' +
        '<div class="info-linha"><span class="fraco">Defesa</span><span>' + (esp ? RP.esc(esp.defesa) : '<a href="#/exploradores?tipo=batedor&alvo=' + x.c + ',' + x.l + '">Desconhecida · espionar</a>') + '</span></div>' +
        (rel ? '<div class="info-linha"><span class="fraco">Relíquia</span><span>' + RP.esc(rel.nome) + ' · ' + RP.RELIQUIA[rel.tipo].nome.toLowerCase() + ' +' + rel.bonus + '%</span></div>' : '') +
        (muroAlvo ? '<div class="info-linha"><span class="fraco">Muralha</span><span>' + RP.esc(RP.muros.descricao(muroAlvo).replace(' com null arqueiros', '')) + '</span></div>' : '') + '</div>' +
        (muroAlvo && muroAlvo.torres ? '<p class="nota-antiga">' + RP.icone('torre', 'ico-p') + '<span>Arqueiros nas torres atiram do alto e ficam protegidos até vocês entrarem ou derrubarem o muro. Aríetes derrubam muros.</span></p>' : '') +
        (rel && rel.tipo === 'resistencia' ? '<p class="nota-antiga">' + RP.icone('escudo', 'ico-p') + '<span>A relíquia de resistência dá +' + rel.bonus + '% de defesa a este local. Leve mais tropas.</span></p>' : '') +
        '<p class="fraco" style="font-size:var(--fs-2)">Se o alvo estiver sob escudo de novato, você só descobre ao chegar: as tropas voltam sem combate.</p></div>' +
        '<div class="secao-titulo">2. Tipo de ataque</div><div class="escolhas">' + D.tiposAtaque.map(function (t) {
          var bloq = t.soCastelo && x.tipo !== 'castelo';
          return '<button type="button" class="escolha' + (bloq ? ' bloqueado' : '') + '" data-tipo-ataque="' + t.id + '" aria-pressed="' + (env.tipo === t.id) + '"' + (bloq ? ' aria-disabled="true"' : '') + '>' +
            '<span class="linha"><span class="ico-placa">' + RP.icone(t.icone) + '</span><b>' + t.nome + '</b></span><small class="fraco">' + t.txt + '</small>' + (bloq ? '<span class="selo selo-desconhecido">' + RP.icone('cadeado') + 'Só castelos</span>' : '') + '</button>';
        }).join('') + '</div>' +
        (rel && !levaRel ? '<p class="nota-antiga" style="margin-top:var(--esp-3)">' + RP.icone('lendario', 'ico-p') + '<span>' + (env.tipo === 'sabotagem' ? 'Sabotagem' : 'Massacre') + ' não leva a relíquia. Para tomá-la, use saque, ocupação ou cerco.</span></p>' : '') +
        (env.tipo === 'saque' && saques ? '<div class="nota-antiga" style="margin-top:var(--esp-3)">' + RP.icone('info', 'ico-p') + 'Você saqueou este alvo ' + saques + (saques > 1 ? ' vezes' : ' vez') + ' nas últimas 24 h: rendimento −' + Math.min(80, saques * 20) + '%. Saques repetidos rendem cada vez menos.</div>' : '');
    }
    h += '<div class="secao-titulo">' + (ataque ? '3. Tropas' : '2. Tropas') + '</div><div class="card pilha">' + linhasGrupo(env.grupo, ['lanceiro', 'arqueiro', 'cavalaria', 'ariete'], dispDe) +
      '<div class="ext-numeros"><div><span class="fraco">Tropas</span><b class="num">' + n + '</b></div><div><span class="fraco">Força</span><b class="num">' + Math.round(forcaGrupo(env.grupo)) + '</b></div>' +
      (ataque ? '<div><span class="fraco">Carga</span><b class="num">' + RP.num(carga) + '</b></div>' : '<div><span class="fraco">Velocidade</span><b>' + perfilGrupo(env.grupo).vel + '</b></div>') + '</div>' +
      (ataque && env.tipo === 'cerco' && !env.grupo.ariete ? '<p class="nota-antiga">' + RP.icone('cerco', 'ico-p') + 'Sem máquinas de cerco, muralhas quase não sofrem dano.</p>' : '') + '</div>';
    if (ataque) {
      h += htmlObjetivos(x, rel, esp, carga);
      h += '<div class="secao-titulo">6. Estandarte</div>' +
        '<button type="button" class="alternar" data-estandarte aria-pressed="' + env.estandarte + '" style="width:100%">' + RP.icone('estandarte') + '<span>Levar o estandarte de ' + RP.esc(RP.estado.nome) + '</span><i aria-hidden="true"></i></button>' +
        '<div class="card previa-relatorio"><span class="rotulo">O defensor verá no relatório</span><div class="linha" style="margin-top:6px">' +
        (env.estandarte ? RP.brasao(RP.estado.brasao, { tamanho: 28 }) + '<span><b>Reino de ' + RP.esc(RP.estado.nome) + '</b><br><small class="fraco">identificado pelo estandarte</small></span>'
          : RP.brasao(null, { tamanho: 28, desconhecido: true }) + '<span><b>Forças desconhecidas</b><br><small class="fraco">tropas, tipo e direção de origem</small></span>') + '</div></div>';
    }
    h += '<div class="secao-titulo">' + (ataque ? '7. Caminho' : '3. Caminho') + '</div>' +
      (esc ? '<div class="card mini-rota-card">' + U.miniRota(op, env.caminho, nomeAlvo(x)) + '</div><div class="pilha" style="margin-top:var(--esp-3)">' + U.opcaoCaminho('curta', op.curta, env.caminho) + U.opcaoCaminho('segura', op.segura, env.caminho) + '</div>' +
        '<p class="fraco" style="font-size:var(--fs-2);margin:var(--esp-3) 0 var(--esp-6)">A viagem segue a unidade mais lenta (' + perfilGrupo(env.grupo).vel.toLowerCase() + '). ' + (ataque ? 'O atacante chega só com as tropas enviadas.' : 'Reforços entram na defesa ao chegar, inclusive durante uma batalha.') + '</p>' : '<p class="fraco">Sem caminho possível.</p>');
    RP.$('.env-conteudo', el).innerHTML = h;
    var tipoNome = ataque ? D.tiposAtaque.filter(function (t) { return t.id === env.tipo; })[0].nome : ocupar ? 'Ocupação' : 'Reforço';
    var objs = ataque ? objetivos() : [], semObj = ataque && !objs.length;
    RP.$('.rodape-resumo', el).innerHTML = semObj && n ? '<div class="resumo-linha fraco">Escolha ao menos um objetivo.</div>'
      : n && esc ? '<div class="resumo-linha"><b>' + tipoNome + ' · ' + RP.esc(nomeAlvo(x)) + '</b><span class="tempo">' + RP.icone('relogio', 'ico-p') + 'chega em ' + RP.fmtDuracao(esc.seg) + '</span></div><div class="resumo-linha fraco">' + partesGrupo(env.grupo) +
        (ataque ? ' · ' + RP.esc(textoObjs(objs, x, rel)) + ' · ' + tatica().nome.toLowerCase() : '') + '</div>' : '<div class="resumo-linha fraco">Escolha as tropas.</div>';
    var btn = RP.$('[data-enviar-tropas]', el);
    btn.innerHTML = RP.icone(ataque ? 'tropas' : ocupar ? 'bandeira' : 'escudo') + (ataque ? 'Enviar ataque' : ocupar ? 'Enviar para ocupar' : 'Enviar reforços');
    btn.classList.toggle('btn-inativo', !n || !esc || semObj);
    env._carga = carga;
    env._esc = esc;
  }
  RP.registrarTela('envio', {
    secao: 'tropas',
    montar: function (el) {
      el.innerHTML = '<div class="envio-topo"></div><div class="conteudo-tela env-conteudo"></div>' +
        '<div class="rodape-acao rodape-com-resumo"><div class="rodape-resumo"></div><button type="button" class="btn btn-primario btn-bloco btn-grande" data-enviar-tropas></button></div>';
      el.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-alvo]'))) { env.alvo = b.getAttribute('data-alvo'); env.listaAberta = false; desenharEnvio(el); return; }
        if (e.target.closest('[data-trocar-alvo]')) { env.listaAberta = true; desenharEnvio(el); return; }
        if ((b = e.target.closest('[data-tipo-ataque]'))) { if (b.getAttribute('aria-disabled') === 'true') { RP.aviso({ titulo: 'Só castelos', texto: 'Cerco ao castelo exige um castelo como alvo.', icone: 'cadeado', tipo: 'alerta' }); return; } env.tipo = b.getAttribute('data-tipo-ataque'); desenharEnvio(el); return; }
        if ((b = e.target.closest('[data-caminho]'))) { env.caminho = b.getAttribute('data-caminho'); desenharEnvio(el); return; }
        if (e.target.closest('[data-estandarte]')) { env.estandarte = !env.estandarte; desenharEnvio(el); return; }
        if ((b = e.target.closest('[data-obj-subir]'))) { var li = objetivos(), i = +b.getAttribute('data-obj-subir'); if (i > 0 && !li[i - 1].fixo) { var tmp = li[i - 1]; li[i - 1] = li[i]; li[i] = tmp; } desenharEnvio(el); return; }
        if ((b = e.target.closest('[data-obj-tirar]'))) { objetivos().splice(+b.getAttribute('data-obj-tirar'), 1); desenharEnvio(el); return; }
        if ((b = e.target.closest('[data-obj-passo]'))) { passoObj(objetivos()[+b.getAttribute('data-obj-passo')], +b.getAttribute('data-d')); desenharEnvio(el); return; }
        if ((b = e.target.closest('[data-obj-add]'))) {
          var xa = acharAlvo(env.alvo), c = catalogo(env.tipo, reliquiaAlvo(xa)).filter(function (q) { return chaveObj(q) === b.getAttribute('data-obj-add'); })[0];
          if (c) { var lo = objetivos(); if (c.k === 'reliquia') lo.splice(lo.length && lo[0].fixo ? 1 : 0, 0, c); else lo.push(c); }
          desenharEnvio(el); return;
        }
        if ((b = e.target.closest('[data-tatica]'))) { env.tatica = b.getAttribute('data-tatica'); desenharEnvio(el); return; }
        if (e.target.closest('[data-encher]')) { env.encher = !env.encher; desenharEnvio(el); return; }
        if (passoGrupo(e, env.grupo, dispDe)) { desenharEnvio(el); return; }
        if (e.target.closest('[data-enviar-tropas]')) {
          var x = acharAlvo(env.alvo), n = somaGrupo(env.grupo), esc = env._esc, ataque = env.modo === 'ataque', ocupar = env.modo === 'ocupar';
          if (!n || !esc) { RP.aviso({ titulo: 'Escolha as tropas', texto: 'Use + e − em cada unidade.', icone: 'info', tipo: 'alerta' }); return; }
          if (ataque && !objetivos().length) { RP.aviso({ titulo: 'Escolha um objetivo', texto: 'As tropas precisam saber o que buscar e quando voltar.', icone: 'alvo', tipo: 'alerta' }); return; }
          var tipo = ataque ? D.tiposAtaque.filter(function (t) { return t.id === env.tipo; })[0] : null;
          var relX = ataque ? reliquiaAlvo(x) : null, objs = ataque ? objetivos().map(function (o) { return Object.assign({}, o); }) : null, tat = tatica();
          var enviar = function () {
            Object.keys(env.grupo).forEach(function (k) { D.disponiveis[k] = dispDe(k) - (env.grupo[k] || 0); });
            var m = W.adicionarMarcha({ id: 'm-env-' + Date.now(), dono: 'meu', tipo: 'exercito', estandarte: ataque && env.estandarte, alvo: x.id, grupo: Object.assign({}, env.grupo),
              objetivos: ataque ? textoObjs(objs, x, relX) : undefined, tatica: ataque ? tat.nome : undefined,
              voltam: ataque ? quandoVoltam(objs, x, relX, env._carga) : undefined,
              nome: ataque ? tipo.nome + ': ' + nomeAlvo(x) : ocupar ? 'Ocupação: ' + x.nome : 'Reforço: ' + x.nome, resumo: partesGrupo(env.grupo) + (ataque ? (env.estandarte ? ' · com estandarte' : ' · sem estandarte') : ''), seg: esc.seg }, esc.hexes);
            env.grupo = { lanceiro: 0, arqueiro: 0, cavalaria: 0, ariete: 0 };
            RP.aviso({ titulo: ataque ? 'Ataque a caminho' : ocupar ? 'Tropas a caminho da ruína' : 'Reforços a caminho', texto: 'Chegam em ' + RP.fmtDuracao(esc.seg) + '.', icone: ataque ? 'tropas' : 'escudo', tipo: 'sucesso' });
            U.irParaMarcha(m);
          };
          if (!ataque) { enviar(); return; }
          RP.modal({
            titulo: 'Confirmar ' + tipo.nome.toLowerCase(),
            corpo: '<p class="suave">' + RP.esc(W.nomeAparente(x)) + ' · ' + (x.espionado ? RP.esc(D.reinos[x.reino].nome) : 'dono desconhecido') + '<br>' + partesGrupo(env.grupo) + ' · chegada em ' + RP.fmtDuracao(esc.seg) + '</p>' +
              '<ol class="obj-confirma">' + objs.map(function (o) { return '<li>' + RP.icone(iconeObj(o, x), 'ico-p' + (o.k === 'recurso' ? ' r-' + o.r : o.k === 'reliquia' ? ' r-lendario' : '')) + RP.esc(nomeObj(o, x, relX)) + '</li>'; }).join('') + '</ol>' +
              '<p class="suave" style="font-size:var(--fs-2)">Tática ' + tat.nome.toLowerCase() + '. ' + RP.esc(quandoVoltam(objs, x, relX, env._carga).join(' ')) + '</p>' +
              '<p class="selo ' + (env.estandarte ? 'selo-info' : 'selo-desconhecido') + '" style="margin-top:var(--esp-3)">' + RP.icone('estandarte') + (env.estandarte ? 'Com estandarte: o defensor saberá que foi você' : 'Sem estandarte: você não será identificado') + '</p>',
            acoes: [{ rotulo: RP.icone('tropas') + 'Enviar ataque', classe: 'btn-primario', acao: enviar }, { rotulo: 'Voltar' }]
          });
        }
      });
    },
    entrar: function (el, params) {
      env.modo = ['reforco', 'ocupar'].indexOf(params.get('modo')) >= 0 ? params.get('modo') : 'ataque';
      env.listaAberta = !(params.get('alvo') || params.get('destino'));
      if (params.get('alvo')) env.alvo = params.get('alvo');
      if (params.get('destino')) env.alvo = params.get('destino');
      RP.$('.envio-topo', el).innerHTML = U.topo(env.modo === 'ataque' ? 'Envio de ataque' : env.modo === 'ocupar' ? 'Ocupar ruína' : 'Enviar reforços', 'tropas');
      desenharEnvio(el);
    }
  });

  /* ================================================================ Posturas */
  var POSTURAS = [
    { id: 'Atacar qualquer ameaça', curto: 'Qualquer ameaça', icone: 'tropas', txt: 'Sai para combater qualquer força hostil que entrar no alcance, mesmo sem ser atacada.' },
    { id: 'Apenas defender', curto: 'Só defender', icone: 'escudo', txt: 'Nunca sai do lugar. Luta só quando o próprio local é atacado.' },
    { id: 'Atacar quem atacar', curto: 'Quem atacar', icone: 'alvo', txt: 'Defende e revida: persegue quem atacou este local ou os vizinhos.' }
  ];
  function seletorPostura(id, atual) {
    return '<div class="abas abas-postura" role="radiogroup" aria-label="Postura">' + POSTURAS.map(function (p) {
      return '<button type="button" class="aba" role="radio" data-postura="' + id + '" data-valor="' + p.id + '" aria-checked="' + (atual === p.id) + '" aria-label="' + p.id + '">' + p.curto + '</button>';
    }).join('') + '</div>';
  }
  function desenharPosturas(el, foco) {
    var meus = D.locais.filter(function (x) { return x.reino === 'meu'; });
    var exercitos = W.marchas.filter(function (m) { return m.d.dono === 'meu' && m.d.tipo !== 'explorador' && m.d.chegada > Date.now(); });
    RP.$('.post-conteudo', el).innerHTML =
      '<div class="pilha">' + POSTURAS.map(function (p) { return '<div class="postura-exp">' + RP.icone(p.icone) + '<span><b>' + p.id + '</b><br><small class="fraco">' + p.txt + '</small></span></div>'; }).join('') + '</div>' +
      '<p class="fraco" style="font-size:var(--fs-2);margin-top:var(--esp-2)">A postura vale com você offline. A população sempre defende o próprio local como milícia.</p>' +
      '<div class="secao-titulo">Guarnições</div>' +
      '<div class="card linha-entre aplicar-todos"><span><b>Aplicar a todas</b><br><small class="fraco">Muda todas as guarnições de uma vez</small></span>' + seletorPostura('*', null) + '</div>' +
      '<div class="pilha" style="margin-top:var(--esp-3)">' + meus.map(function (x) {
        return '<div class="card postura-item' + (foco === x.id ? ' foco' : '') + '" id="post-' + x.id + '"><div class="linha"><span class="ico-placa dono-meu">' + RP.icone(x.tipo) + '</span><span style="flex:1;min-width:0"><b>' + RP.esc(x.tipo === 'castelo' ? 'Castelo de ' + RP.estado.nome : x.nome) + '</b><br><small class="fraco">' + RP.esc(x.guarnicao) + '</small></span>' + (x.ameaca ? '<span class="selo selo-perigo">Ameaçado</span>' : '') + '</div>' + seletorPostura(x.id, x.postura) + '</div>';
      }).join('') + '</div>' +
      '<div class="secao-titulo">Exércitos em campo</div>' + (exercitos.length ? '<div class="pilha">' + exercitos.map(function (m) {
        m.d.postura = m.d.postura || 'Atacar quem atacar';
        return '<div class="card postura-item"><div class="linha"><span class="ico-placa dono-meu">' + RP.icone(RP.mapa.iconeMarcha(m)) + '</span><span style="flex:1;min-width:0"><b>' + RP.esc(m.d.nome) + '</b><br><small class="fraco">' + RP.esc(m.d.resumo) + '</small></span></div>' + seletorPostura('m:' + m.d.id, m.d.postura) + '</div>';
      }).join('') + '</div>' : '<p class="fraco">Nenhum exército em campo.</p>') + '<div style="height:var(--esp-8)"></div>';
    if (foco) setTimeout(function () { var f = document.getElementById('post-' + foco); if (f) f.scrollIntoView({ block: 'center' }); }, 50);
  }
  RP.registrarTela('posturas', {
    secao: 'tropas',
    montar: function (el) {
      el.innerHTML = U.topo('Posturas', 'tropas', 'Como cada tropa reage sem você') + '<div class="conteudo-tela post-conteudo"></div>';
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-postura]');
        if (!b) return;
        var alvo = b.getAttribute('data-postura'), v = b.getAttribute('data-valor');
        if (alvo === '*') D.locais.forEach(function (x) { if (x.reino === 'meu') x.postura = v; });
        else if (alvo.indexOf('m:') === 0) W.marcha(alvo.slice(2)).d.postura = v;
        else W.local(alvo).postura = v;
        RP.invalidarTela('reino');
        RP.aviso({ titulo: 'Postura salva', texto: (alvo === '*' ? 'Todas as guarnições' : 'Agora') + ': ' + v.toLowerCase() + '.', icone: 'escudo', tipo: 'sucesso', ms: 1800 });
        desenharPosturas(el);
      });
    },
    entrar: function (el, params) { desenharPosturas(el, params.get('local')); }
  });

  /* ================================================================ Batalha em andamento (roteirizada) */
  var B = D.batalha;
  var bat = { reforco: null, recuo: null };
  function tBat(agora) { return ((agora || Date.now()) - (RP.t0 + B.inicio * 1000)) / 1000; }
  function sm(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  function forcas(t) {
    var a = B.atacante.forca * (1 - 0.42 * sm(t / B.duracao)) + Math.sin(t / 37) * 2;
    var d = B.defensor.forca * (1 - 0.62 * sm(t / B.duracao)) + Math.sin(t / 29 + 1) * 2;
    if (bat.reforco && t > bat.reforco.t) {
      var k = 1 - Math.exp(-(t - bat.reforco.t) / 50);
      d += bat.reforco.forca * k; a -= bat.reforco.forca * 0.7 * (1 - Math.exp(-(t - bat.reforco.t) / 80));
    }
    if (bat.recuo && t > bat.recuo) d = forcas(bat.recuo).d * Math.exp(-(t - bat.recuo) / 25);
    return { a: Math.max(0, a), d: Math.max(0, d) };
  }
  RP.batalha = {
    ativa: function () { var t = tBat(); return t >= 0 && t < B.duracao && !(bat.recuo && t > bat.recuo + 90); },
    forcas: function () { return forcas(tBat()); },
    restante: function () { return Math.max(0, B.duracao - tBat()); },
    estado: bat
  };
  function tendencia() {
    var f = forcas(B.duracao);
    if (bat.recuo) return { txt: 'Recuo: a vila será saqueada, a população se protege', cls: 'perigo' };
    if (f.d > f.a * 1.05) return { txt: 'Tendência: seu lado vence', cls: 'sucesso' };
    if (f.a > f.d * 1.05) return { txt: 'Tendência: os atacantes levam vantagem', cls: 'perigo' };
    return { txt: 'Tendência: equilibrado', cls: 'alerta' };
  }
  /* gráfico de linhas: força dos dois lados ao longo do tempo; tracejado = tendência até o fim */
  function graficoBatalha() {
    var Wd = 340, Hd = 170, ml = 30, mr = 12, mt = 10, mb = 24, pw = Wd - ml - mr, ph = Hd - mt - mb;
    var agora = Math.min(B.duracao, Math.max(0, tBat())), passo = 15, pts = [];
    for (var t = 0; t <= B.duracao; t += passo) pts.push({ t: t, f: forcas(t) });
    var maxY = 140;
    var X = function (t) { return ml + (t / B.duracao) * pw; }, Y = function (v) { return mt + ph - (v / maxY) * ph; };
    function caminho(lado, ate, desde) {
      return pts.filter(function (p) { return p.t <= ate + 0.01 && p.t >= (desde || 0) - passo; }).map(function (p, i) { return (i ? 'L' : 'M') + X(p.t).toFixed(1) + ' ' + Y(p.f[lado]).toFixed(1); }).join('');
    }
    var fa = forcas(agora), h = '';
    [0, 50, 100].forEach(function (v) { h += '<line class="gl-grade" x1="' + ml + '" x2="' + (ml + pw) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/><text class="gl-eixo" x="' + (ml - 6) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + v + '</text>'; });
    [0, 5, 10, 15].forEach(function (m) { var tx = m * 60; if (tx > B.duracao) return; h += '<text class="gl-eixo" x="' + X(tx) + '" y="' + (Hd - 6) + '" text-anchor="middle">' + m + ' min</text>'; });
    h += '<path class="gl-linha gl-a gl-proj" d="' + caminho('a', B.duracao, agora) + '"/><path class="gl-linha gl-d gl-proj" d="' + caminho('d', B.duracao, agora) + '"/>';
    h += '<path class="gl-linha gl-a" d="' + caminho('a', agora) + '"/><path class="gl-linha gl-d" d="' + caminho('d', agora) + '"/>';
    if (bat.reforco) h += '<line class="gl-marco" x1="' + X(bat.reforco.t) + '" x2="' + X(bat.reforco.t) + '" y1="' + mt + '" y2="' + (mt + ph) + '"/><text class="gl-eixo" x="' + (X(bat.reforco.t) + 3) + '" y="' + (mt + 10) + '">reforços</text>';
    h += '<line class="gl-agora" x1="' + X(agora) + '" x2="' + X(agora) + '" y1="' + mt + '" y2="' + (mt + ph) + '"/>';
    h += '<circle class="gl-ponto gl-a" cx="' + X(agora) + '" cy="' + Y(fa.a) + '" r="4.5"/><circle class="gl-ponto gl-d" cx="' + X(agora) + '" cy="' + Y(fa.d) + '" r="4.5"/>';
    var ya = Y(fa.a), yd = Y(fa.d); if (Math.abs(ya - yd) < 14) { if (ya < yd) { ya -= 7; yd += 7; } else { ya += 7; yd -= 7; } }
    var lx = X(agora) + 8, ancora = 'start';
    if (lx > ml + pw - 50) { lx = X(agora) - 8; ancora = 'end'; }
    h += '<text class="gl-rot" text-anchor="' + ancora + '" x="' + lx + '" y="' + (yd + 4) + '">Você ' + Math.round(fa.d) + '</text><text class="gl-rot" text-anchor="' + ancora + '" x="' + lx + '" y="' + (ya + 4) + '">Eles ' + Math.round(fa.a) + '</text>';
    h += '<line class="gl-cruz" x1="0" x2="0" y1="' + mt + '" y2="' + (mt + ph) + '" hidden/><rect class="gl-alvo" x="' + ml + '" y="' + mt + '" width="' + pw + '" height="' + ph + '"/>';
    return '<div class="grafico-linha"><svg viewBox="0 0 ' + Wd + ' ' + Hd + '" role="img" aria-label="Força dos dois lados ao longo da batalha. Agora: você ' + Math.round(fa.d) + ', atacantes ' + Math.round(fa.a) + '." data-ml="' + ml + '" data-pw="' + pw + '">' + h + '</svg><div class="gl-dica" hidden></div></div>' +
      '<div class="legenda-grafico"><span><i class="lg-d"></i>Seu lado</span><span><i class="lg-a"></i>Forças desconhecidas</span><span><i class="lg-proj"></i>Tendência</span></div>';
  }
  function tabelaBatalha() {
    var linhas = '';
    for (var t = 0; t <= Math.min(B.duracao, tBat()); t += 60) { var f = forcas(t); linhas += '<tr><td>' + Math.round(t / 60) + ' min</td><td class="num">' + Math.round(f.d) + '</td><td class="num">' + Math.round(f.a) + '</td></tr>'; }
    return '<table class="tabela"><thead><tr><th>Tempo</th><th>Seu lado</th><th>Atacantes</th></tr></thead><tbody>' + linhas + '</tbody></table>';
  }
  function ligarGrafico(el) {
    var box = RP.$('.grafico-linha', el); if (!box) return;
    var svg = RP.$('svg', box), dica = RP.$('.gl-dica', box), cruz = RP.$('.gl-cruz', svg);
    var ml = +svg.getAttribute('data-ml'), pw = +svg.getAttribute('data-pw');
    function mostrar(ev) {
      var r = svg.getBoundingClientRect(), esc = 340 / r.width, x = (ev.clientX - r.left) * esc;
      var t = Math.round(Math.max(0, Math.min(1, (x - ml) / pw)) * B.duracao / 15) * 15, xx = ml + (t / B.duracao) * pw, f = forcas(t);
      cruz.setAttribute('x1', xx); cruz.setAttribute('x2', xx); cruz.removeAttribute('hidden');
      dica.hidden = false;
      dica.textContent = '';
      var linha1 = document.createElement('div'); linha1.className = 'gl-dica-t'; linha1.textContent = (t <= tBat() ? '' : 'Tendência · ') + Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
      dica.appendChild(linha1);
      [['d', 'Seu lado', f.d], ['a', 'Forças desconhecidas', f.a]].forEach(function (q) {
        var row = document.createElement('div'); row.className = 'gl-dica-l';
        var k = document.createElement('i'); k.className = 'lg-' + q[0]; row.appendChild(k);
        var v = document.createElement('b'); v.textContent = Math.round(q[2]); row.appendChild(v);
        var n = document.createElement('span'); n.textContent = q[1]; row.appendChild(n);
        dica.appendChild(row);
      });
      dica.style.left = Math.min(r.width - 150, Math.max(0, xx / esc - 75)) + 'px';
    }
    function esconder() { cruz.setAttribute('hidden', ''); dica.hidden = true; }
    svg.addEventListener('pointermove', mostrar);
    svg.addEventListener('pointerdown', mostrar);
    svg.addEventListener('pointerleave', esconder);
  }
  var cenaBatalha = null;
  function partesDinamicas() {
    var f = forcas(Math.max(0, tBat())), tend = tendencia(), total = f.a + f.d || 1;
    return {
      lados: '<div class="bat-lados"><div class="bat-lado meu"><span class="rotulo">Seu lado</span><b class="num">' + Math.round(f.d) + '</b><small class="fraco">' + RP.esc(B.defensor.resumo) + '</small></div>' +
      '<div class="bat-vs">×</div><div class="bat-lado eles"><span class="rotulo">' + RP.esc(B.atacante.nome) + '</span><b class="num">' + Math.round(f.a) + '</b><small class="fraco">' + RP.esc(B.atacante.resumo) + ' · vindas do ' + B.atacante.origem + '</small></div></div>' +
      '<div class="barra-dupla" role="img" aria-label="Seu lado ' + Math.round((100 * f.d) / total) + '%, atacantes ' + Math.round((100 * f.a) / total) + '%"><i class="d" style="width:' + ((100 * f.d) / total).toFixed(1) + '%"></i><i class="a" style="width:' + ((100 * f.a) / total).toFixed(1) + '%"></i></div>' +
      '<p class="tendencia ' + tend.cls + '">' + RP.icone(tend.cls === 'sucesso' ? 'check' : 'alerta', 'ico-p') + tend.txt + '</p>',
      grafico: graficoBatalha(),
      eventos: B.eventos.filter(function (ev) { return ev.t <= tBat(); }).reverse().map(function (ev) {
        return '<li><span class="selo">' + Math.floor(ev.t / 60) + ' min</span><span>' + RP.esc(ev.txt) + '</span></li>';
      }).join('') +
      (bat.reforco ? '<li><span class="selo selo-info">' + (tBat() >= bat.reforco.t ? 'chegaram' : 'a caminho') + '</span><span>' + RP.esc(bat.reforco.nome) + '</span></li>' : '') +
      (bat.recuo ? '<li><span class="selo selo-perigo">recuo</span><span>Você ordenou o recuo. A população se protege na mata.</span></li>' : ''),
      restante: Math.max(0, B.duracao - tBat())
    };
  }
  function atualizarBatalha(el) {
    var p = partesDinamicas();
    RP.$('.bat-dinamico', el).innerHTML = p.lados;
    RP.$('.bat-grafico', el).innerHTML = p.grafico;
    RP.$('.bat-eventos', el).innerHTML = p.eventos;
    RP.$('.bat-fim', el).textContent = p.restante ? 'Termina em cerca de ' + RP.fmtResta(p.restante * 1000) + '.' : 'Encerrada.';
    ligarGrafico(el);
  }
  function desenharBatalha(el) {
    RP.$('.bat-conteudo', el).innerHTML =
      '<div class="bat-dinamico"></div>' +
      '<div class="secao-titulo">Força ao longo da batalha</div><div class="card"><div class="bat-grafico"></div>' +
      '<details class="ver-tabela"><summary>Ver como tabela</summary>' + tabelaBatalha() + '</details></div>' +
      '<div class="secao-titulo">Acontecimentos</div><ol class="diario bat-eventos"></ol>' +
      '<p class="fraco" style="font-size:var(--fs-2);margin:var(--esp-3) 0 var(--esp-8)">Combate semi-automático: as tropas lutam sozinhas; você decide reforços e recuo. <span class="bat-fim"></span></p>';
    atualizarBatalha(el);
    RP.$('[data-reforcar]', el).classList.toggle('btn-inativo', !!bat.reforco || !!bat.recuo);
    RP.$('[data-recuar]', el).classList.toggle('btn-inativo', !!bat.recuo);
  }
  RP.registrarTela('batalha', {
    secao: 'tropas',
    montar: function (el) {
      var x = W.local(B.local), ce = H.centro(x.c, x.l);
      el.innerHTML = U.topo('Batalha em andamento', 'mapa', RP.esc(x.nome) + ' · ' + B.atacante.tipo) +
        '<div class="bat-vista"><canvas class="bat-cena" aria-label="Vista da batalha na ' + RP.esc(x.nome) + '"></canvas><a class="btn btn-p reino-vista-abrir" href="#/mapa?modo=cena&centro=' + x.id + '">' + RP.icone('vista') + 'Ver no mundo</a></div>' +
        '<div class="conteudo-tela bat-conteudo"></div>' +
        '<div class="rodape-acao bat-acoes"><button type="button" class="btn btn-primario" data-reforcar>' + RP.icone('escudo') + 'Enviar reforços</button><button type="button" class="btn" data-recuar>' + RP.icone('voltar') + 'Recuar</button></div>';
      cenaBatalha = new RP.Cena(RP.$('.bat-cena', el), { tocavel: true, panHorizontal: true, limites: { x0: ce.x - 120, x1: ce.x + 120, y0: ce.y - 10, y1: ce.y + 10 }, aoTocar: function () {} });
      cenaBatalha.posicao = ce;
      el.addEventListener('click', function (e) {
        if (e.target.closest('[data-reforcar]')) {
          if (bat.reforco || bat.recuo) return;
          RP.abrirFolha({
            titulo: 'Enviar reforços', veu: true,
            subtitulo: '<span class="fraco">Reforços entram na batalha ao chegar</span>',
            corpo: '<div class="pilha">' + B.reforcos.map(function (r) {
              return '<button type="button" class="rota-opcao segura" data-reforco="' + r.id + '"><i class="rota-cor"></i><span><b>' + RP.esc(r.nome) + '</b><small>Força +' + r.forca + '</small></span><span class="rota-tempo">' + RP.icone('relogio', 'ico-p') + RP.fmtDuracao(r.seg) + '</span></button>';
            }).join('') + '<a class="btn btn-p" href="#/envio?modo=reforco&destino=' + B.local + '">' + RP.icone('tropas') + 'Montar outro grupo</a></div>'
          });
          return;
        }
        if (e.target.closest('[data-recuar]')) {
          if (bat.recuo) return;
          RP.modal({
            titulo: 'Recuar da batalha?',
            corpo: '<p class="suave">A guarnição e a milícia deixam a Vila do Vau. A população se protege, mas o local será saqueado.</p>',
            acoes: [{ rotulo: RP.icone('voltar') + 'Recuar', classe: 'btn-perigo', acao: function () { bat.recuo = tBat(); desenharBatalha(el); RP.aviso({ titulo: 'Recuo ordenado', texto: 'Suas tropas deixam a vila.', icone: 'voltar', tipo: 'alerta' }); } }, { rotulo: 'Continuar lutando' }]
          });
        }
      });
      document.addEventListener('click', function (e) {
        var b = e.target.closest('[data-reforco]');
        if (!b) return;
        var r = B.reforcos.filter(function (q) { return q.id === b.getAttribute('data-reforco'); })[0];
        bat.reforco = { t: tBat() + r.seg, forca: r.forca, nome: r.nome };
        RP.fecharFolha();
        RP.aviso({ titulo: 'Reforços a caminho', texto: r.nome + ' chegam em ' + RP.fmtDuracao(r.seg) + '.', icone: 'escudo', tipo: 'sucesso' });
        desenharBatalha(el);
      });
      document.addEventListener('rp:tique', function () {
        if (el.hidden) return;
        if (Math.floor(Date.now() / 1000) % 5 === 0) atualizarBatalha(el);
      });
    },
    entrar: function (el) {
      desenharBatalha(el);
      requestAnimationFrame(function () {
        cenaBatalha.redimensionar();
        if (!cenaBatalha.posicionada) { cenaBatalha.centrar(cenaBatalha.posicao.x, cenaBatalha.posicao.y - 6, 2.1, 0.55, false); cenaBatalha.posicionada = true; }
        cenaBatalha.iniciar();
      });
    },
    sair: function () { if (cenaBatalha) cenaBatalha.parar(); }
  });
})();
