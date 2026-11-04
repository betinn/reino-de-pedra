/* Reino de Pedra — Exploradores: tipo, ordem (explorar, seguir rota, patrulhar, espionar), destino escolhido no mapa,
   caminho curto x seguro com o risco da fauna conhecida, escolta opcional; exploradores em campo e novas ordens;
   prisioneiros (decidir resgate, libertar ou executar); relatórios de espionagem e captura.
   Porte de prototipo/js/acoes.js (Exploradores) e social.js; os dados vêm de GET /exploracao. */
(function () {
  'use strict';
  var RP = window.RP, H = RP.hex;

  RP.NOMES_MARCHA = RP.NOMES_MARCHA || {};
  RP.NOMES_MARCHA.explorador = 'Explorador';
  RP.ANIMAIS = {
    lobos: { nome: 'Lobos', um: 'lobo', icone: 'lobo' }, javalis: { nome: 'Javalis', um: 'javali', icone: 'javali' },
    ursos: { nome: 'Ursos', um: 'urso', icone: 'urso' }, crocodilos: { nome: 'Crocodilos', um: 'crocodilo', icone: 'crocodilo' }
  };
  RP.NOME_NIVEL = { baixo: 'Baixo', medio: 'Médio', alto: 'Alto', nenhum: 'Nenhum' };
  RP.ICONE_EXPLORADOR = { pe: 'bota', cavalo: 'cavalo', prospector: 'picareta', batedor: 'batedor' };
  RP.CARAC_EXPLORADOR = {
    pe: 'Sem penalidade em floresta e pântano.', cavalo: 'Penalizado em floresta e montanha.',
    prospector: 'Único que revela jazidas valiosas e lendárias.', batedor: 'Furtivo: espiona locais e revela o dono.'
  };
  var ORDENS = {
    explorar: { nome: 'Explorar área', txt: 'Vai até o destino revelando o caminho e volta ao castelo.' },
    rota: { nome: 'Seguir rota', txt: 'Passa pelos pontos, em ordem, e espera no último. Em circuito, recomeça do primeiro até nova ordem.' },
    aguardar: { nome: 'Esperando ordens', txt: 'Chegou ao destino e espera: mande explorar outro lugar, seguir rota, patrulhar ou voltar.' },
    patrulhar: { nome: 'Patrulhar', txt: 'Vai e volta entre o ponto de partida e o destino até nova ordem, mantendo a área à vista.' },
    espionar: { nome: 'Espionar', txt: 'Fica alguns minutos no local de outro reino e traz dono, defesa, estoque e relíquias.' },
    retornar: { nome: 'Retornar', txt: 'Volta ao castelo.' }
  };
  RP.ORDENS_EXPLORADOR = ORDENS;

  /* ---------------------------------------------------------------- dados (GET /exploracao) */
  RP.exploracao = { dados: null };
  var carregando = null;
  RP.exploracao.carregar = function () {
    if (carregando) return carregando;
    carregando = RP.get('/exploracao').then(function (d) {
      carregando = null; RP.exploracao.dados = d; RP.sincronizar(d.agora);
      document.dispatchEvent(new CustomEvent('rp:exploracao', { detail: d }));
      return d;
    }, function (e) { carregando = null; throw e; });
    return carregando;
  };
  var recarga = null;
  RP.exploracao.recarregar = function () {
    if (recarga) return;
    recarga = setTimeout(function () { recarga = null; RP.exploracao.carregar().catch(function () { /* offline */ }); }, 400);
  };
  function telaAtual() { return document.documentElement.getAttribute('data-tela'); }
  ['reino', 'marchas', 'relatorio'].forEach(function (t) {
    RP.ouvir(t, function () { if (telaAtual() === 'exploradores' || telaAtual() === 'caca') RP.exploracao.recarregar(); });
  });
  if (RP.telasTropas) RP.telasTropas.push('exploradores', 'caca');
  RP.exploracao.tipo = function (id) { var d = RP.exploracao.dados; return d && d.tipos.filter(function (t) { return t.id === id; })[0]; };
  RP.exploracao.ativo = function (id) { var d = RP.exploracao.dados; return d && d.exploradores.filter(function (e) { return e.id === id; })[0]; };

  /* ---------------------------------------------------------------- peças comuns (risco, caminho) */
  function linha(r, v) { return '<div class="info-linha"><span class="fraco">' + r + '</span><span>' + v + '</span></div>'; }
  RP.linhaInfo = RP.linhaInfo || linha;
  function pct(x) { return Math.round((x || 0) * 100) + '%'; }
  function coord(h) { return H.c(h) + ', ' + H.l(h); }
  RP.seloNivel = function (n, txt) { return '<span class="selo selo-perigo-' + n + '">' + RP.icone('pata') + (txt || 'Perigo ' + RP.NOME_NIVEL[n].toLowerCase()) + '</span>'; };

  /* risco da fauna conhecida no caminho (vem da prévia do servidor) */
  RP.blocoRisco = function (rs, sozinho) {
    if (!rs || !rs.nivel) return '<div class="risco-linha ok">' + RP.icone('check') + '<span><b>Sem fauna perigosa conhecida no caminho</b><br><small>Área desconhecida pode esconder animais.</small></span></div>';
    var A = RP.ANIMAIS[rs.animal] || { nome: 'Animais', icone: 'pata' };
    if (rs.risco === 'nenhum') return '<div class="risco-linha ok">' + RP.icone('escudo') + '<span><b>Grupo forte o bastante</b><br><small>Com o dobro da força dos animais (' + RP.num(rs.limite) + ' aqui), o grupo passa ileso por ' + A.nome.toLowerCase() + '.</small></span></div>';
    return '<div class="perigo-linha nivel-' + rs.risco + '">' + RP.icone(A.icone) + '<span><b>Risco ' + RP.NOME_NIVEL[rs.risco].toLowerCase() + '</b> · ' + A.nome.toLowerCase() + ' no caminho' +
      (rs.trechos > 1 ? ' (' + rs.trechos + ' áreas)' : '') + '<br><small>Chance de ataque de ' + pct(rs.chance) + ' em cada região assim. ' +
      (sozinho ? 'Um explorador sozinho atacado morre. Escolha a rota segura ou leve escolta.' : 'Atacado, o grupo perde até 25%. Reforce o grupo ou use a rota segura.') + '</small></span></div>';
  };
  RP.opcaoCaminhoExp = function (nome, r, seguro) {
    if (!r || !r.ok) return '';
    var rs = r.risco || {};
    return '<button type="button" class="rota-opcao ' + nome + '" data-exp-caminho="' + nome + '" aria-pressed="' + ((nome === 'segura') === !!seguro) + '">' +
      '<i class="rota-cor" aria-hidden="true"></i><span><b>' + (nome === 'curta' ? 'Rota curta' : 'Rota segura') + '</b><small>' + r.hexes + ' hexágonos' +
      (r.rotas ? ' · ' + r.rotas + ' em rota pública' : '') + (rs.risco && rs.risco !== 'nenhum' ? ' · risco ' + RP.NOME_NIVEL[rs.risco].toLowerCase() : ' · sem risco conhecido') + '</small></span>' +
      '<span class="rota-tempo">' + RP.icone('relogio', 'ico-p') + RP.fmtDuracao(r.min * 60) + '</span></button>';
  };

  /* ---------------------------------------------------------------- escolher o destino no mapa */
  var escolhendo = null;   /* 'destino' | 'ponto' */
  function escolherNoMapa(modo) {
    escolhendo = modo;
    RP.ir('mapa');
    RP.aviso({ titulo: modo === 'ponto' ? 'Toque no próximo ponto' : 'Toque no destino', texto: 'Depois, "Escolher este destino".', icone: 'alvo', ms: 2200 });
  }
  document.addEventListener('rp:tela', function (ev) { if (ev.detail !== 'mapa' && ev.detail !== 'exploradores') escolhendo = null; });

  /* ---------------------------------------------------------------- estado do formulário */
  var ex = { tipo: 'cavalo', ordem: 'explorar', alvo: null, pontos: [], circuito: false, seguro: false, comEscolta: false, escolta: {}, previa: null, ativo: null, chave: '' };

  function tiposVisiveis(d) { return d.tipos.filter(function (t) { return t.id !== 'batedor' || RP.sistema('espionagem'); }); }
  function destinoAtual() { return ex.ordem === 'rota' ? ex.pontos[0] : ex.alvo; }

  function pedirPrevia(el) {
    var h = destinoAtual();
    var corpo = ex.ativo ? { marchaId: ex.ativo, destinoHex: h } : { tipo: ex.tipo, destinoHex: h, escolta: ex.comEscolta ? ex.escolta : {} };
    var chave = JSON.stringify(corpo);
    if (h == null) { ex.previa = null; ex.chave = ''; return; }
    if (chave === ex.chave) return;
    ex.chave = chave; ex.previa = null;
    RP.post('/exploracao/previa', corpo).then(function (p) {
      if (ex.chave !== chave) return;
      ex.previa = p; desenhar(el);
    }, function (e) { if (ex.chave === chave) { ex.previa = { erro: e.message }; desenhar(el); } });
  }

  function ativoHTML(d) {
    if (!d.exploradores.length) return '';
    return '<div class="secao-titulo" style="margin-top:0">Em campo</div><div class="pilha">' + d.exploradores.map(function (e) {
      var est = e.estado === 'espionando' ? 'espionando · termina em <b class="num" data-fim="' + e.espionandoAte + '">' + RP.fmtResta(e.espionandoAte - RP.agora()) + '</b>'
        : e.estado === 'parado' ? '<b>no destino, esperando ordens</b>'
        : (e.estado === 'retornando' ? 'volta' : 'chega') + ' em <b class="num" data-fim="' + e.chegada + '">' + RP.fmtResta(e.chegada - RP.agora()) + '</b>';
      return '<div class="card emcampo exp-ativo' + (ex.ativo === e.id ? ' foco' : '') + '"><span class="ico-placa dono-meu">' + RP.icone(RP.ICONE_EXPLORADOR[e.tipoExp] || 'explorador') + '</span>' +
        '<span class="emcampo-corpo"><b>' + RP.esc(e.nome) + '</b><small class="fraco">' + RP.esc((ORDENS[e.ordem] || {}).nome || e.ordem) + ' · ' + (e.ordem === 'rota' ? e.pontos.length + ' pontos' + (e.circuito ? ' em circuito' : '') : 'destino ' + e.alvoC + ', ' + e.alvoL) +
        (RP.somaGrupo(e.escolta) ? ' · escolta: ' + RP.esc(RP.partesGrupo(e.escolta)) : '') + '</small><small class="fraco">' + est + '</small>' +
        '<span class="exercito-acoes">' + (e.estado !== 'retornando' ? '<button type="button" class="btn btn-p" data-exp-voltar="' + e.id + '">' + RP.icone('voltar') + 'Voltar</button>' : '') +
        '<button type="button" class="btn btn-p" data-exp-nova="' + e.id + '">' + RP.icone('seta') + 'Nova ordem</button>' +
        '<a class="btn btn-p btn-fantasma" href="#/mapa?foco=' + e.hex + '">' + RP.icone('mapa') + 'Mapa</a></span></span></div>';
    }).join('') + '</div>';
  }

  function presosHTML(d) {
    var h = '';
    if (d.presos.length) {
      h += '<div class="secao-titulo">Capturados por você</div><div class="pilha">' + d.presos.map(function (p) {
        return '<div class="card pilha preso-card"><div class="linha">' + RP.iconeReino(p.origem, 32) + '<span style="flex:1;min-width:0"><b>' + RP.esc(p.nome) + ' de ' + RP.esc(p.origem ? p.origem.nome : '?') + '</b><br>' +
          '<small class="fraco">Pego no hexágono ' + p.c + ', ' + p.l + ' · ' + (p.estado === 'resgate' ? 'resgate pedido: ' + RP.esc(resgateTxt(p.resgate)) : 'sem decisão') + '</small></span></div>' +
          '<div class="linha-entre"><span class="fraco" style="font-size:var(--fs-2)">Libertado sozinho em <b class="num" data-fim="' + p.ate + '">' + RP.fmtResta(p.ate - RP.agora()) + '</b></span></div>' +
          '<div class="linha preso-acoes"><button type="button" class="btn btn-p btn-primario" data-preso-resgate="' + p.id + '">' + RP.icone('troca') + 'Pedir resgate</button>' +
          '<button type="button" class="btn btn-p" data-preso-acao="libertar" data-preso="' + p.id + '">' + RP.icone('check') + 'Libertar</button>' +
          '<button type="button" class="btn btn-p btn-perigo" data-preso-acao="executar" data-preso="' + p.id + '">' + RP.icone('espada') + 'Executar</button></div></div>';
      }).join('') + '</div>';
    }
    if (d.capturados.length) {
      h += '<div class="secao-titulo">Seus exploradores presos</div><div class="pilha">' + d.capturados.map(function (p) {
        return '<div class="card linha"><span class="ico-placa">' + RP.icone(RP.ICONE_EXPLORADOR[p.tipoExp] || 'explorador') + '</span><span style="flex:1;min-width:0"><b>' + RP.esc(p.nome) + '</b><br>' +
          '<small class="fraco">' + (p.captor ? 'Com ' + RP.esc(p.captor.nome) + ', que pede ' + RP.esc(resgateTxt(p.resgate)) : 'Com quem o pegou, perto de ' + p.c + ', ' + p.l) + '</small><br>' +
          '<small class="fraco">Volta em até <span data-fim="' + p.ate + '">' + RP.fmtResta(p.ate - RP.agora()) + '</span>, se não for executado.</small></span></div>';
      }).join('') + '</div>';
    }
    return h;
  }
  function resgateTxt(r) { return Object.keys(r || {}).map(function (k) { return RP.num(r[k]) + ' ' + RP.nomeRecurso(k); }).join(', ') || '—'; }

  function espiaHTML(d) {
    var e = d.regras.espiao, p = ex.previa && ex.previa.espiao;
    var regra = '<p class="fraco" style="font-size:var(--fs-2)">Visto, metade das vezes o batedor é capturado e o relatório não volta; na outra, foge com o relatório. Nos dois casos, o alvo vê "espião visto" por ' + d.regras.avistamentoH + ' h. O batedor fica ' + RP.fmtDuracao(e.tempoNoLocal) + ' no local.</p>';
    var min = e.base, max = e.max;
    if (!p) return '<div class="card pilha espia-card"><b>Chance de ser visto: ' + pct(min) + ' a ' + pct(max) + '</b><p class="fraco" style="font-size:var(--fs-2)">Escolha um local de outro reino como destino para ver a estimativa. Torres no alcance e guarnição grande aumentam a chance.</p>' + regra + '</div>';
    var est = p.estimativa;
    return '<div class="card pilha espia-card"><div class="linha-entre"><b>Chance de ser visto</b><b class="num">' + (est != null ? '≈ ' + pct(est) : pct(min) + ' a ' + pct(max)) + '</b></div>' +
      '<div class="barra"><i style="width:' + Math.round(100 * (est != null ? est : min) / max) + '%"></i></div>' +
      '<small class="fraco">' + RP.esc(p.nome) + ': ' + pct(e.base) + ' de base + ' + pct(e.porTorre) + ' por torre no alcance + ' + (Math.round(e.porTropa * 1000) / 10).toLocaleString('pt-BR') + '% por tropa da guarnição' +
      (p.antigo ? ' (espionagem ' + RP.fmtHa((RP.agora() - p.antigo.quando) / 3600000) + ': ' + p.antigo.tropas + ' tropas, ' + p.antigo.torres + ' torres)' : ', ainda desconhecida') + '. Máximo de ' + pct(max) + '.</small>' + regra + '</div>';
  }

  function destinoHTML() {
    var dm = RP.mapa && RP.mapa.dados && RP.mapa.dados();
    function nome(h) {
      var t = dm && dm.terreno ? dm.terreno[h] : null;
      return (t && t !== '?' ? H.NOME_TERRENO[H.TERRENO[t.toLowerCase()]] : 'Terra desconhecida') + ' · ' + coord(h);
    }
    if (ex.ordem === 'rota') {
      return '<div class="card pilha destino-card">' + (ex.pontos.length ? ex.pontos.map(function (h, i) {
        return '<div class="linha-entre"><span class="linha"><span class="obj-n">' + (i + 1) + '</span>' + RP.esc(nome(h)) + '</span><button type="button" class="btn btn-icone btn-fantasma" data-exp-tirar="' + i + '" aria-label="Tirar o ponto ' + (i + 1) + '">' + RP.icone('fechar') + '</button></div>';
      }).join('') : '<p class="fraco">Nenhum ponto ainda.</p>') +
        '<button type="button" class="btn btn-p" data-exp-escolher="ponto">' + RP.icone('mais') + 'Adicionar ponto no mapa</button>' +
        (ex.pontos.length > 1 ? '<button type="button" class="btn btn-p btn-fantasma" data-exp-circuito aria-pressed="' + !!ex.circuito + '">' + RP.icone('seta') +
          (ex.circuito ? 'Em circuito: recomeça do primeiro ponto' : 'Uma vez só: espera no último ponto') + '</button>' : '') + '</div>';
    }
    if (ex.alvo == null) return '<div class="card linha destino-card"><span class="ico-placa">' + RP.icone('alvo') + '</span><div style="flex:1"><b>Sem destino</b><br><small class="fraco">Toque num hexágono do mapa.</small></div><button type="button" class="btn btn-p" data-exp-escolher="destino">' + RP.icone('mapa') + 'Escolher</button></div>';
    var idade = dm && dm.idade ? dm.idade[ex.alvo] : null;
    return '<div class="card linha destino-card"><span class="ico-placa">' + RP.icone(idade === -1 ? 'nevoa' : 'alvo') + '</span><div style="flex:1;min-width:0"><b>' + RP.esc(nome(ex.alvo)) + '</b><br><small class="fraco">' +
      (idade == null ? '' : idade === -1 ? 'Nunca visto' : idade === 0 ? 'Visível agora' : 'Visto ' + RP.fmtHa(idade / 60)) + '</small></div>' +
      '<button type="button" class="btn btn-p" data-exp-escolher="destino">' + RP.icone('mapa') + 'Trocar</button></div>';
  }

  function desenhar(el) {
    var d = RP.exploracao.dados, alvoEl = RP.$('.exp-conteudo', el);
    if (!d) { alvoEl.innerHTML = '<p class="fraco">Carregando…</p>'; return; }
    var ativo = ex.ativo && RP.exploracao.ativo(ex.ativo);
    if (ex.ativo && !ativo) ex.ativo = null;
    if (ativo) ex.tipo = ativo.tipoExp;
    if (ex.tipo === 'batedor' && !RP.sistema('espionagem')) ex.tipo = 'pe';
    if (ex.ordem === 'espionar' && ex.tipo !== 'batedor') ex.ordem = 'explorar';
    if (ex.ordem === 'espionar') ex.comEscolta = false;
    var tipo = RP.exploracao.tipo(ex.tipo), p = ex.previa;
    pedirPrevia(el);
    var h = presosHTML(d) + ativoHTML(d);
    if (ativo) {
      h += '<div class="card card-moldura pilha"><div class="linha"><span class="ico-placa dono-meu">' + RP.icone(RP.ICONE_EXPLORADOR[ativo.tipoExp]) + '</span><div style="flex:1"><b>Nova ordem: ' + RP.esc(ativo.nome) + '</b><br><small class="fraco">Sai de onde está agora.</small></div>' +
        '<button type="button" class="btn btn-p btn-fantasma" data-exp-nova="">' + RP.icone('fechar') + 'Cancelar</button></div></div>';
    } else {
      /* camada 1: uma linha por tipo (nome e quantos livres); o detalhe só do escolhido; treinar fica junto dele */
      h += '<div class="secao-titulo"' + (d.exploradores.length || d.presos.length || d.capturados.length ? '' : ' style="margin-top:0"') + '>1. Tipo</div><div class="escolhas escolhas-linhas">' + tiposVisiveis(d).map(function (x) {
        return '<button type="button" class="escolha escolha-linha" data-exp-tipo="' + x.id + '" aria-pressed="' + (ex.tipo === x.id) + '">' +
          '<span class="ico-placa">' + RP.icone(RP.ICONE_EXPLORADOR[x.id] || 'explorador') + '</span><span class="escolha-txt"><b>' + RP.esc(x.curto) + '</b>' +
          '<small class="fraco">' + (x.livres ? x.livres + ' livre' + (x.livres > 1 ? 's' : '') : 'nenhum livre') + (x.emTreino ? ' · ' + x.emTreino + ' em treino' : '') + '</small></span></button>';
      }).join('') + '</div>' +
        '<div class="card pilha exp-detalhe"><small class="fraco">Velocidade <b>' + RP.esc((RP.VELOCIDADES || {})[tipo.vel] || tipo.vel) + '</b> · visão <b>' + tipo.visao + (tipo.jazidas ? ' (jazidas a ' + tipo.jazidas + ')' : '') + '</b> · força <b>' + tipo.forca + '</b> contra fauna. ' + RP.esc(RP.CARAC_EXPLORADOR[tipo.id] || '') + '</small>' +
        '<div class="linha-entre exp-treino"><span><small class="fraco">Treinar: ' + RP.fmtDuracao(tipo.tempo) + ' · 1 de população</small><br>' + RP.custoHTML(tipo.custo) + '</span>' +
        '<button type="button" class="btn btn-p' + (tipo.livres ? ' btn-fantasma' : '') + '" data-exp-treinar="' + tipo.id + '">' + RP.icone('mais') + 'Treinar</button></div></div>';
    }
    var ordens = ['explorar', 'rota', 'patrulhar'].concat(ex.tipo === 'batedor' ? ['espionar'] : []);
    h += '<div class="secao-titulo">' + (ativo ? '' : '2. ') + 'Ordem</div><div class="abas abas-rolagem" role="group" aria-label="Ordem">' + ordens.map(function (k) {
      return '<button type="button" class="aba" data-exp-ordem="' + k + '" aria-pressed="' + (ex.ordem === k) + '">' + ORDENS[k].nome + '</button>';
    }).join('') + '</div>' +
      '<p class="fraco" style="font-size:var(--fs-2);margin-top:var(--esp-2)">' + ORDENS[ex.ordem].txt + '</p>' +
      (ex.ordem === 'espionar' ? espiaHTML(d) : '') +
      '<div class="secao-titulo">' + (ativo ? '' : '3. ') + 'Destino</div>' + destinoHTML();
    var sozinho = !(ex.comEscolta && RP.somaGrupo(ex.escolta));
    if (destinoAtual() != null) {
      h += '<div class="secao-titulo">' + (ativo ? '' : '4. ') + 'Caminho</div>';
      if (!p) h += '<p class="fraco">Calculando o caminho…</p>';
      else if (p.erro) h += '<p class="txt-alerta">' + RP.esc(p.erro) + '</p>';
      else if (!p.curta.ok) h += '<p class="fraco">Sem caminho possível até o destino.</p>';
      else {
        var mesma = p.segura.ok && p.segura.hexes === p.curta.hexes && p.segura.min === p.curta.min;
        if (mesma || !p.segura.ok) ex.seguro = false;
        var esc = ex.seguro ? p.segura : p.curta;
        h += '<div class="pilha">' + RP.opcaoCaminhoExp('curta', p.curta, ex.seguro) + (mesma ? '' : RP.opcaoCaminhoExp('segura', p.segura, ex.seguro)) + '</div>' +
          (mesma ? '<p class="fraco" style="font-size:var(--fs-2)">A rota curta já é a mais segura que se conhece.</p>' : '') +
          RP.blocoRisco(esc.risco, sozinho) + '<p class="fraco" style="font-size:var(--fs-2)">Força do grupo contra fauna: ' + RP.num(p.forca) + '.</p>';
      }
    }
    if (!ativo && ex.ordem !== 'espionar') h += escoltaHTML(d);
    h += '<div style="height:var(--esp-8)"></div>';
    alvoEl.innerHTML = h;
    var ok = destinoAtual() != null && p && p.curta && p.curta.ok && (ativo || (tipo && tipo.livres > 0));
    var escP = p && p.curta && p.curta.ok ? (ex.seguro && p.segura.ok ? p.segura : p.curta) : null;
    RP.$('.rodape-resumo', el).innerHTML = escP ? '<div class="resumo-linha"><b>' + RP.esc((ativo ? ativo.nome : tipo.nome) + ' · ' + ORDENS[ex.ordem].nome) + '</b><span class="tempo">' + RP.icone('relogio', 'ico-p') + 'chega em ' + RP.fmtDuracao(escP.min * 60) + '</span></div>' : '';
    var bt = RP.$('[data-exp-enviar]', el);
    bt.innerHTML = RP.icone(RP.ICONE_EXPLORADOR[ex.tipo] || 'explorador') + (ativo ? 'Dar nova ordem' : 'Enviar explorador');
    bt.classList.toggle('btn-inativo', !ok);
  }

  function escoltaHTML(d) {
    var disp = (d.castelo && d.castelo.guarnicao) || {};
    var tem = RP.somaGrupo(disp) > 0;
    return '<button type="button" class="alternar" data-exp-escolta aria-pressed="' + !!ex.comEscolta + '" style="margin-top:var(--esp-3);width:100%"' + (tem ? '' : ' disabled') + '>' + RP.icone('escudo') +
      '<span>Levar escolta · mais seguro, no passo do mais lento' + (tem ? '' : ' (sem tropas no castelo)') + '</span><i aria-hidden="true"></i></button>' +
      (ex.comEscolta && tem ? '<div class="card pilha" data-exp-grupo style="margin-top:var(--esp-2)">' + RP.grupoTropas.linhas(ex.escolta, disp) + '</div>' : '');
  }

  function enviar(el) {
    var d = RP.exploracao.dados, p = ex.previa, ativo = ex.ativo && RP.exploracao.ativo(ex.ativo), tipo = RP.exploracao.tipo(ex.tipo);
    if (destinoAtual() == null) { RP.aviso({ titulo: 'Escolha o destino', icone: 'alvo', tipo: 'alerta' }); return; }
    if (!ativo && (!tipo || !tipo.livres)) { RP.aviso({ titulo: 'Nenhum ' + (tipo ? tipo.nome.toLowerCase() : 'explorador') + ' livre', texto: 'Treine um novo ou espere um voltar.', icone: 'explorador', tipo: 'alerta' }); return; }
    if (!p || !p.curta || !p.curta.ok) return;
    var corpo = { ordem: ex.ordem, destinoHex: ex.ordem === 'rota' ? null : ex.alvo, pontos: ex.ordem === 'rota' ? ex.pontos : null, circuito: ex.ordem === 'rota' && !!ex.circuito, seguro: !!ex.seguro };
    var req = ativo ? RP.post('/exploradores/' + ativo.id + '/ordem', corpo)
      : RP.post('/exploradores/enviar', Object.assign({ tipo: ex.tipo, escolta: ex.comEscolta ? ex.escolta : null }, corpo));
    RP.tentar(req).then(function (e) {
      RP.aviso({ titulo: ativo ? 'Nova ordem dada' : 'Explorador enviado', texto: e && e.chegada ? 'Chega ' + RP.fmtEm(e.chegada) + '.' : '', icone: RP.ICONE_EXPLORADOR[ex.tipo] || 'explorador', tipo: 'sucesso' });
      ex.ativo = null; ex.escolta = {}; ex.comEscolta = false; ex.chave = '';
      RP.exploracao.carregar().then(function () { desenhar(el); }, function () { /* offline */ });
      RP.recarregarReino();
      void d;
    });
  }

  RP.registrarTela('exploradores', {
    secao: 'tropas',
    montar: function (el) {
      el.innerHTML = RP.topoVoltar('Exploradores', 'tropas', 'Revelar o mapa, patrulhar e espionar') + '<div class="conteudo-tela exp-conteudo"></div>' +
        '<div class="rodape-acao rodape-com-resumo"><div class="rodape-resumo"></div><button type="button" class="btn btn-primario btn-bloco btn-grande" data-exp-enviar>' + RP.icone('explorador') + 'Enviar explorador</button></div>';
      document.addEventListener('rp:exploracao', function () { if (!el.hidden) desenhar(el); });
      el.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-exp-tipo]'))) { ex.tipo = b.getAttribute('data-exp-tipo'); desenhar(el); return; }
        if ((b = e.target.closest('[data-exp-ordem]'))) { ex.ordem = b.getAttribute('data-exp-ordem'); if (ex.ordem === 'rota' && !ex.pontos.length && ex.alvo != null) ex.pontos = [ex.alvo]; desenhar(el); return; }
        if ((b = e.target.closest('[data-exp-caminho]'))) { ex.seguro = b.getAttribute('data-exp-caminho') === 'segura'; desenhar(el); return; }
        if ((b = e.target.closest('[data-exp-escolher]'))) { escolherNoMapa(b.getAttribute('data-exp-escolher')); return; }
        if ((b = e.target.closest('[data-exp-tirar]'))) { ex.pontos.splice(+b.getAttribute('data-exp-tirar'), 1); desenhar(el); return; }
        if (e.target.closest('[data-exp-circuito]')) { ex.circuito = !ex.circuito; desenhar(el); return; }
        if (e.target.closest('[data-exp-escolta]')) { ex.comEscolta = !ex.comEscolta; desenhar(el); return; }
        if (e.target.closest('[data-exp-grupo]') && RP.exploracao.dados && RP.grupoTropas.clique(e, ex.escolta, RP.exploracao.dados.castelo.guarnicao)) { desenhar(el); return; }
        if ((b = e.target.closest('[data-exp-nova]'))) {
          var id = b.getAttribute('data-exp-nova');
          ex.ativo = id ? +id : null; ex.chave = '';
          var a = ex.ativo && RP.exploracao.ativo(ex.ativo);
          if (a) { ex.ordem = a.ordem === 'retornar' || a.ordem === 'aguardar' ? 'explorar' : a.ordem; ex.alvo = a.ordem === 'aguardar' ? null : a.alvo; ex.pontos = (a.pontos || []).slice(); ex.circuito = !!a.circuito; }
          desenhar(el); window.scrollTo(0, 0); return;
        }
        if ((b = e.target.closest('[data-exp-treinar]'))) {
          RP.tentar(RP.post('/exploradores/treinar', { tipo: b.getAttribute('data-exp-treinar'), qtd: 1 })).then(function (it) {
            RP.aviso({ titulo: 'Na fila: ' + it.rotulo, texto: RP.textoFilaItem(it), icone: 'explorador', tipo: 'sucesso' });
            RP.exploracao.carregar(); RP.recarregarReino();
          });
          return;
        }
        if (e.target.closest('[data-exp-enviar]')) enviar(el);
      });
    },
    entrar: function (el, params) {
      var a = params.get('alvo');
      if (a != null && a !== '') { var h = a.indexOf(',') > 0 ? H.idx(+a.split(',')[0], +a.split(',')[1]) : +a; if (ex.ordem === 'rota' && escolhendo === 'ponto') ex.pontos.push(h); else ex.alvo = h; }
      if (params.get('tipo')) ex.tipo = params.get('tipo');
      if (params.get('ordem')) ex.ordem = params.get('ordem');
      if (params.get('ativo')) ex.ativo = +params.get('ativo');
      escolhendo = null; ex.chave = '';
      desenhar(el);
      RP.exploracao.carregar().catch(function () { /* aviso já mostrado */ });
      if (!RP.mapa.dados || !RP.mapa.dados()) { if (RP.mapa.recarregar) RP.mapa.recarregar().then(function () { desenhar(el); }, function () { /* offline */ }); }
    }
  });

  /* ---------------------------------------------------------------- prisioneiros (decidir) */
  document.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-exp-voltar]'))) {
      RP.tentar(RP.post('/exploradores/' + b.getAttribute('data-exp-voltar') + '/ordem', { ordem: 'retornar' })).then(function () {
        RP.fecharFolha(); RP.aviso({ titulo: 'Explorador voltando', icone: 'voltar', tipo: 'sucesso' }); RP.exploracao.carregar();
        if (RP.mapa.recarregar && telaAtual() === 'mapa') RP.mapa.recarregar();
      });
      return;
    }
    if ((b = e.target.closest('[data-preso-acao]'))) {
      var acao = b.getAttribute('data-preso-acao'), id = b.getAttribute('data-preso');
      var fazer = function () {
        RP.tentar(RP.post('/prisioneiros/' + id, { acao: acao })).then(function () {
          RP.fecharFolha(); RP.aviso({ titulo: acao === 'executar' ? 'Explorador executado' : 'Explorador libertado', icone: acao === 'executar' ? 'espada' : 'check', tipo: 'sucesso' });
          RP.exploracao.carregar(); RP.recarregarReino();
        });
      };
      if (acao === 'executar') RP.modal({ titulo: 'Executar o prisioneiro?', corpo: '<p class="suave">O dono é avisado de que ele não volta.</p>', acoes: [{ rotulo: 'Executar', classe: 'btn-perigo', acao: fazer }, { rotulo: 'Manter preso' }] });
      else fazer();
      return;
    }
    if ((b = e.target.closest('[data-preso-resgate]'))) { folhaResgate(+b.getAttribute('data-preso-resgate')); return; }
    if ((b = e.target.closest('[data-resgate-enviar]'))) {
      var r = {};
      RP.$$('[data-resgate-rec]').forEach(function (inp) { var v = Math.floor(+inp.value || 0); if (v > 0) r[inp.getAttribute('data-resgate-rec')] = v; });
      RP.tentar(RP.post('/prisioneiros/' + b.getAttribute('data-resgate-enviar'), { acao: 'resgate', resgate: r })).then(function () {
        RP.fecharFolha(); RP.aviso({ titulo: 'Resgate pedido', texto: 'O dono foi avisado e sabe quem pede.', icone: 'troca', tipo: 'sucesso' }); RP.exploracao.carregar();
      });
    }
  });
  function folhaResgate(id) {
    var d = RP.exploracao.dados, p = d && d.presos.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var recs = ['prata', 'ouro', 'comida', 'madeira', 'ferro'];
    RP.abrirFolha({
      titulo: 'Pedir resgate', veu: true,
      subtitulo: '<span class="fraco">' + RP.esc(p.nome) + ' de ' + RP.esc(p.origem ? p.origem.nome : '?') + '</span>',
      corpo: '<p class="nota-regra">' + RP.icone('info', 'ico-p') + '<span>O pedido revela quem você é ao dono. Pago, o explorador volta para casa; sem pagamento até o prazo, ele é libertado do mesmo jeito.</span></p>' +
        '<div class="pilha">' + recs.map(function (k) {
          return '<label class="linha-entre resgate-campo"><span class="linha">' + RP.icone(k, 'r-' + k) + RP.esc(RP.NOMES_REC[k]) + '</span><input class="campo" type="number" min="0" step="1" inputmode="numeric" value="' + (k === 'prata' ? 20 : 0) + '" data-resgate-rec="' + k + '" aria-label="' + RP.esc(RP.NOMES_REC[k]) + '"></label>';
        }).join('') + '</div>',
      acoes: '<button type="button" class="btn btn-p btn-primario" data-resgate-enviar="' + id + '">' + RP.icone('troca') + 'Pedir resgate</button>'
    });
  }

  /* ---------------------------------------------------------------- no mapa: explorar, espionar, escolher destino */
  function objetosHex(h, dados) { return (dados && dados.porHex && dados.porHex[h]) || []; }
  RP.mapa.acoesFolhaHex.push(function (h, dados) {
    if (escolhendo) return '<button type="button" class="btn btn-p btn-primario" data-exp-aqui="' + h + '">' + RP.icone('alvo') + (escolhendo === 'ponto' ? 'Adicionar este ponto' : 'Escolher este destino') + '</button>';
    if (RP.envio && RP.envio.ativo()) return '';
    var obj = objetosHex(h, dados), html = '';
    var meu = obj.filter(function (o) { return o.tipo === 'local' && o.dono === 'meu'; })[0];
    var alheio = obj.filter(function (o) { return o.tipo === 'local' && o.dono === 'desconhecido' && !o.ruina; })[0];
    if (!meu) html += '<a class="btn btn-p" href="#/exploradores?alvo=' + h + '&ordem=explorar">' + RP.icone('explorador') + 'Explorar área</a>';
    if (alheio && RP.sistema('espionagem')) html += '<a class="btn btn-p" href="#/exploradores?alvo=' + h + '&tipo=batedor&ordem=espionar">' + RP.icone('batedor') + 'Espionar</a>';
    RP.mapa.marchasEm(h, dados).filter(function (o) { return o.tipo === 'marcha' && o.dono === 'meu' && o.marcha === 'explorador'; }).forEach(function (o) {
      html += '<a class="btn btn-p" href="#/exploradores?ativo=' + o.id + '">' + RP.icone('explorador') + 'Ordens ao explorador</a>';
    });
    return html;
  });
  RP.mapa.extrasFolhaHex.push(function (h, dados) {
    var obj = objetosHex(h, dados), html = '';
    obj.forEach(function (o) {
      if (o.tipo === 'local' && o.foto) html += linha('Último estado', '<span class="selo selo-antigo">' + RP.icone('relogio') + 'visto ' + RP.fmtHa((RP.agora() - o.visto) / 3600000) + '</span>');
      if (o.tipo === 'espionado') html += linha('Espionagem', (o.dono ? RP.iconeReino(o.dono, 20) + ' <b>' + RP.esc(o.dono.nome) + '</b>' : '') + ' · nível ' + o.nivel + ' · ' + RP.fmtHa((RP.agora() - o.quando) / 3600000));
      if (o.tipo === 'avistamento') html += linha(o.avistado === 'espiao' ? 'Espião visto' : 'Tropas vistas', RP.fmtHa((RP.agora() - o.quando) / 3600000) + ' · some em <span data-fim="' + o.ate + '">' + RP.fmtResta(o.ate - RP.agora()) + '</span>');
    });
    return html;
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-exp-aqui]');
    if (!b) return;
    var h = +b.getAttribute('data-exp-aqui');
    if (escolhendo === 'ponto') ex.pontos.push(h); else ex.alvo = h;
    escolhendo = null; ex.chave = '';
    RP.fecharFolha(); RP.ir('exploradores');
  });

  /* ---------------------------------------------------------------- entradas (Tropas, Mais, Reino) */
  RP.acoesTropas = RP.acoesTropas || [];
  RP.acoesTropas.push({ href: '#/exploradores', icone: 'explorador', titulo: 'Exploradores', texto: 'Revelar o mapa, patrulhar e espionar' });
  RP.itensMais = RP.itensMais || [];
  RP.itensMais.push({ icone: 'explorador', titulo: 'Exploradores', texto: 'Revelar o mapa, patrulhar e espionar', href: '#/exploradores' });
  RP.extrasTropas = RP.extrasTropas || [];
  RP.extrasTropas.push(function () {
    var x = RP.reino && RP.reino.exploracao;
    if (!x || !(x.emCampo || x.presos || x.capturados)) return '';
    var partes = [];
    if (x.emCampo) partes.push(x.emCampo + (x.emCampo > 1 ? ' exploradores em campo' : ' explorador em campo'));
    if (x.capturados) partes.push(x.capturados + ' preso' + (x.capturados > 1 ? 's' : '') + ' por outro reino');
    if (x.presos) partes.push(x.presos + ' prisioneiro' + (x.presos > 1 ? 's' : '') + ' seu' + (x.presos > 1 ? 's' : ''));
    return '<a class="card linha exp-resumo" href="#/exploradores"><span class="ico-placa dono-meu">' + RP.icone('explorador') + '</span><span style="flex:1;min-width:0"><b>Exploradores</b><br><small class="fraco">' + RP.esc(partes.join(' · ')) + '</small></span>' + RP.icone('avancar', 'ico-p') + '</a>';
  });
  RP.extrasReino = RP.extrasReino || [];
  RP.extrasReino.push(function (r) {
    var x = r.exploracao;
    if (!x || !x.presos) return '';
    return '<a class="card faixa-alerta" href="#/exploradores">' + RP.icone('batedor') + '<div><b>' + x.presos + (x.presos > 1 ? ' exploradores presos' : ' explorador preso') + '</b><br><span class="suave">Peça resgate, liberte ou execute. Sem decisão em 24 h, é libertado.</span></div></a>';
  });

  /* ---------------------------------------------------------------- relatórios */
  RP.desenhosRelatorio = RP.desenhosRelatorio || {};
  RP.FILTROS_RELATORIO = RP.FILTROS_RELATORIO || [['', 'Todos']];
  RP.FILTROS_RELATORIO.push(['exploracao', 'Exploração'], ['espionagem', 'Espionagem'], ['fauna', 'Fauna'], ['captura', 'Capturas']);
  var iconeRel = RP.iconeRelatorio;
  RP.iconeRelatorio = function (t) { return t === 'captura' ? 'batedor' : t === 'caca' ? 'lobo' : iconeRel ? iconeRel(t) : 'relatorios'; };
  function linhasPadrao(d) {
    return (d.linhas && d.linhas.length ? '<div class="card info">' + d.linhas.map(function (l) { return linha(RP.esc(l.rotulo), RP.esc(l.valor)); }).join('') + '</div>' : '');
  }
  function verNoMapa(d) { return d.hex != null ? '<a class="btn btn-p" href="#/mapa?foco=' + d.hex + '">' + RP.icone('mapa') + 'Ver no mapa</a>' : ''; }
  function estoqueTxt(e) { var ks = Object.keys(e || {}); return ks.length ? '<span class="custos">' + ks.map(function (k) { return '<span class="custo">' + RP.icone(k, 'ico-p r-' + k) + RP.num(e[k]) + '</span>'; }).join('') + '</span>' : 'vazio'; }

  RP.desenhosRelatorio.espionagem = function (rel) {
    var d = rel.dados || {}, df = d.defesa || {}, l = d.local || {};
    return (d.dono ? '<div class="card linha atacante">' + RP.iconeReino(d.dono, 40) + '<span><b>' + RP.esc(d.dono.nome) + '</b><br><small class="fraco">Dono de ' + RP.esc(l.nome || 'local') + ', revelado pela espionagem</small></span></div>' : '') +
      '<div class="card info">' + linha('Local', RP.esc((l.nome || '') + ' · nível ' + (l.nivel || '?'))) +
      linha('Guarnição', df.tropas ? RP.selosGrupo ? RP.selosGrupo(df.guarnicao) : RP.num(df.tropas) : 'nenhuma') +
      linha('Torres no alcance', String(df.torres || 0)) + linha('Milícia', '≈ ' + RP.num(df.milicia || 0)) +
      linha('Postura', RP.esc((RP.POSTURAS || {})[(df.postura || '').charAt(0).toLowerCase() + (df.postura || '').slice(1)] || df.postura || '')) +
      linha('Estoque', estoqueTxt(d.estoque)) +
      linha('Batedor', d.visto ? '<span class="selo selo-perigo">Visto</span>' : '<span class="selo selo-visivel">Não foi visto</span>') + '</div>' +
      ((d.reliquias || []).length ? '<div class="secao-titulo">Relíquias guardadas</div><div class="pilha">' + d.reliquias.map(function (x) {
        return '<div class="card relq-card tipo-' + RP.esc(x.tipo) + '"><div class="linha"><span class="relq-ico">' + RP.icone('lendario') + '</span><span style="flex:1;min-width:0"><b>' + RP.esc(x.nome) + '</b><br><small class="fraco">Saque, ocupação ou cerco vitorioso neste local a levam.</small></span></div></div>';
      }).join('') + '</div>' : '') +
      '<p class="fraco" style="font-size:var(--fs-2);margin-top:var(--esp-3)">' + RP.esc(d.resumo || '') + ' Chance de ser visto: ' + pct(d.chance) + '.</p>' +
      '<div class="linha" style="margin-top:var(--esp-3)">' + verNoMapa(d) + '</div>';
  };
  RP.desenhosRelatorio.captura = function (rel) {
    var d = rel.dados || {};
    var preso = d.prisioneiro && RP.exploracao.dados && RP.exploracao.dados.presos.some(function (p) { return p.id === d.prisioneiro; });
    return (d.origem ? '<div class="card linha atacante">' + RP.iconeReino(d.origem, 40) + '<span><b>' + RP.esc(d.origem.nome) + '</b><br><small class="fraco">' + (d.prisioneiro ? 'Reino de origem do explorador' : 'Quem pede o resgate') + '</small></span></div>' : '') +
      '<p class="suave">' + RP.esc(d.resumo || '') + '</p>' + linhasPadrao(d) +
      (d.ate ? '<p class="fraco" style="font-size:var(--fs-2);margin-top:var(--esp-2)">Prazo: ' + RP.fmtHora(d.ate) + '.</p>' : '') +
      '<div class="linha" style="margin-top:var(--esp-3)">' + (d.prisioneiro ? '<a class="btn btn-p btn-primario" href="#/exploradores">' + RP.icone('batedor') + (preso !== false ? 'Decidir' : 'Exploradores') + '</a>' : '') + verNoMapa(d) + '</div>';
  };
  RP.desenhosRelatorio.fauna = function (rel) {
    var d = rel.dados || {};
    return '<div class="perigo-linha nivel-alto">' + RP.icone('pata') + '<span><b>' + RP.esc(d.resumo || '') + '</b><br><small>Exploradores sozinhos e grupos pequenos correm risco. Prefira a rota segura ou leve escolta.</small></span></div>' +
      linhasPadrao(d) + '<div class="linha" style="margin-top:var(--esp-3)"><a class="btn btn-p btn-primario" href="#/caca">' + RP.icone('lobo') + 'Caçar animais</a>' + verNoMapa(d) + '</div>';
  };
  RP.desenhosRelatorio.exploracao = function (rel) {
    var d = rel.dados || {};
    return '<p class="suave">' + RP.esc(d.resumo || '') + '</p>' + linhasPadrao(d) +
      '<div class="linha" style="margin-top:var(--esp-3)">' + verNoMapa(d) + '<a class="btn btn-p" href="#/exploradores">' + RP.icone('explorador') + 'Explorar mais</a></div>';
  };
})();
