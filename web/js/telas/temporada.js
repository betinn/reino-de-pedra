/* Reino de Pedra — Temporada e legado (#/temporada), Ranking (#/ranking) e Precisa de você (#/agora).
   Portado de prototipo/js/legado.js, agora.js e social.js (ranking); os dados vêm do servidor:
   GET /temporada, POST /temporada/reliquias/{id}, /temporada/titulo, /temporada/exilio, GET /ranking, GET /agora (?n=3). */
(function () {
  'use strict';
  var RP = window.RP;
  var TIPO_LEG = { producao: 'produção', ataque: 'ataque', defesa: 'defesa', crescimento: 'crescimento' };
  function pct(v) { return (Math.round(v * 1000) / 10).toLocaleString('pt-BR') + '%'; }
  function topo(titulo, voltar, sub) { return RP.topoVoltar ? RP.topoVoltar(titulo, voltar, sub) : '<header class="topo"><h1>' + titulo + '</h1></header>'; }

  /* ================================================================ Temporada e legado */
  var temp = null;
  function carregarTemporada(el) {
    return RP.get('/temporada').then(function (t) { temp = t; desenharTemporada(el); }, function (e) {
      RP.$('.temp-conteudo', el).innerHTML = '<p class="fraco">' + RP.esc(e.message || 'Sem conexão.') + '</p>';
    });
  }
  function desenharTemporada(el) {
    var t = temp; if (!t) return;
    var L = t.linhagem, passados = Math.min(t.dias, t.dia), eq = t.reliquias.filter(function (r) { return r.equipada; });
    var vaiSubir = L.diasAtivos >= L.diasPedidos;
    var h = '<div class="card card-moldura temp-hero"><span class="rotulo">Temporada ' + t.numero + '</span><h2>Dia ' + passados + ' de ' + t.dias + '</h2>' +
      '<div class="temp-dias"><b>' + t.diasRestantes + '</b><span>' + (t.diasRestantes === 1 ? 'dia restante' : 'dias restantes') + '</span></div>' +
      '<div class="barra barra-grossa" role="progressbar" aria-label="Dia ' + passados + ' de ' + t.dias + '"><i style="width:' + ((100 * passados) / t.dias).toFixed(1) + '%"></i></div>' +
      '<div class="linha-entre fraco" style="font-size:var(--fs-1);margin-top:4px"><span>Dia 1</span><span>Termina ' + RP.fmtHora(t.fim) + '</span></div>' +
      '<p class="suave" style="margin-top:var(--esp-3);font-size:var(--fs-2)">Ao fim, mapa e reinos recomeçam do zero. O território não tem placar: não existe "mapa conquistado".</p></div>' +
      '<a class="card linha rank-atalho" href="#/ranking"><span class="ico-placa">' + RP.icone('coroa') + '</span><span style="flex:1"><b>Ranking da temporada</b><br><small class="fraco">Baixas, perdas, tropas e famílias' +
      (t.conquistas ? ' · ' + RP.esc(t.conquistas[0].agora) : '') + '</small></span>' + RP.icone('avancar', 'ico-p') + '</a>' +
      '<div class="temp-duas"><div class="card"><span class="rotulo">Fica com você</span><ul class="regras-lista">' +
      ['Linhagem', 'Relíquias da temporada', 'Títulos', 'Brasões e cosméticos'].map(function (x) { return '<li>' + RP.icone('check', 'ico-p r-ervas') + x + '</li>'; }).join('') + '</ul></div>' +
      '<div class="card"><span class="rotulo">Recomeça</span><ul class="regras-lista">' +
      ['Mapa e névoa', 'Reino e locais', 'Recursos e tropas'].map(function (x) { return '<li>' + RP.icone('relogio', 'ico-p') + x + '</li>'; }).join('') + '</ul></div></div>';

    /* linhagem */
    h += '<div class="secao-titulo">Linhagem</div><div class="card pilha"><div class="linha"><span class="linhagem-nivel">' + L.nivel + '</span><span style="flex:1"><b>' + RP.esc(t.tituloAtivo || 'Linhagem nível ' + L.nivel) + '</b><br><small class="fraco">Nível ' + L.nivel + ' de ' + L.max +
      ' · ' + L.temporadasJogadas + (L.temporadasJogadas === 1 ? ' temporada jogada' : ' temporadas jogadas') + ' · ' + L.reliquiasGanhas + (L.reliquiasGanhas === 1 ? ' relíquia ganha' : ' relíquias ganhas') + '</small></span></div>' +
      '<p class="suave" style="font-size:var(--fs-2)">Sobe 1 nível por temporada jogada (ativo em pelo menos ' + L.diasPedidos + ' dos ' + t.dias + ' dias) e 1 por relíquia da temporada ganha.</p>' +
      '<div class="linha-entre" style="font-size:var(--fs-2)"><span>Nesta temporada: ativo em <b>' + Math.min(L.diasAtivos, L.diasPedidos) + ' de ' + L.diasPedidos + '</b> dias</span>' +
      (vaiSubir && L.nivel < L.max ? '<span class="selo selo-visivel">' + RP.icone('check') + 'Nível ' + (L.nivel + 1) + ' no fim</span>' : '') + '</div>' +
      '<div class="barra"><i style="width:' + Math.min(100, (100 * L.diasAtivos) / L.diasPedidos).toFixed(0) + '%"></i></div>' +
      '<ul class="linhagem-lista">' + L.desbloqueios.map(function (d) {
        return '<li class="' + (d.feito ? 'feito' : '') + '"><span class="selo' + (d.feito ? ' selo-visivel' : '') + '">Nv ' + d.nivel + '</span><span>' + RP.esc(d.txt) + '</span>' + RP.icone(d.feito ? 'check' : 'cadeado', 'ico-p') + '</li>';
      }).join('') + '</ul><p class="fraco" style="font-size:var(--fs-2)">A linhagem desbloqueia opções e cosméticos, nunca poder.</p></div>';

    /* região do exílio (nível 7) */
    if (t.regiaoExilioLiberada) {
      h += '<div class="secao-titulo">Região do exílio</div><div class="card pilha"><p class="suave" style="font-size:var(--fs-2)">Se o reino cair sem outros locais, o castelo do exílio nasce na região escolhida (a vaga livre mais perto). Sem escolha, o sorteio é longe de quem derrubou.</p>' +
        '<div class="regioes" role="group" aria-label="Região do exílio">' + [{ id: '', nome: 'Sorteio' }].concat(t.regioes).map(function (r) {
          return '<button type="button" class="aba" data-exilio="' + r.id + '" aria-pressed="' + ((t.regiaoExilio || '') === r.id) + '">' + RP.esc(r.nome) + '</button>';
        }).join('') + '</div></div>';
    }

    /* relíquias da temporada */
    var vale = t.vale, cheio = t.soma > t.teto;
    h += '<div class="secao-titulo">Relíquias da temporada</div><div class="card pilha">' +
      '<div class="linha-entre"><span><b>Equipadas: ' + eq.length + ' de ' + t.equipadasMax + '</b><br><small class="fraco">' + pct(t.soma) + ' somados · limite de ' + pct(t.teto) + (cheio ? ' (vale ' + pct(t.teto) + ')' : '') + '</small></span><b class="num">+' + pct(vale) + '</b></div>' +
      '<div class="barra"><i style="width:' + Math.min(100, (100 * t.soma) / t.teto).toFixed(0) + '%"></i></div>' +
      (t.reliquias.length ? '<div class="reliquias">' + t.reliquias.map(function (r) {
        return '<div class="card reliquia ganha' + (r.equipada ? ' equipada' : '') + '"><span class="reliquia-ico">' + RP.icone('lendario', 'r-lendario') + '</span><b>' + RP.esc(r.nome) + '</b><span class="selo selo-destaque">+' + pct(r.bonus) + ' ' + TIPO_LEG[r.tipo] + '</span>' +
          '<small class="fraco">' + RP.esc(r.como) + '</small><button type="button" class="btn btn-p' + (r.equipada ? '' : ' btn-primario') + '" data-equipar="' + r.id + '" data-equipada="' + r.equipada + '">' + (r.equipada ? 'Tirar' : 'Equipar') + '</button></div>';
      }).join('') + '</div>' : '<p class="fraco">Nenhuma ainda. Elas são entregues no fim da temporada.</p>') + '</div>';
    if (t.conquistas) h += '<div class="secao-titulo">Como ganhar nesta temporada</div><div class="card lista">' + t.conquistas.map(function (c) {
      return '<div class="lista-item"><span class="ico-placa">' + RP.icone(c.ok ? 'check' : 'lendario', c.ok ? 'r-ervas' : 'r-lendario') + '</span><span style="flex:1;min-width:0"><b>' + RP.esc(c.nome) + '</b><br><small class="fraco">' + RP.esc(c.como) + ' · ' + RP.esc(c.agora) + '</small></span>' + (c.ok ? '<span class="selo selo-visivel">No caminho</span>' : '') + '</div>';
    }).join('') + '</div>';
    h += '<p class="fraco" style="font-size:var(--fs-2);margin-top:var(--esp-2)">Entregues no fim da temporada. Cada uma dá de +' + pct(t.relMin) + ' a +' + pct(t.relMax) + ' (produção, ataque, defesa ou crescimento da população), e esse limite também conta no limite de bônus de combate (+' + pct(t.tetoBonus) + '). Não confundir com as relíquias lendárias do mapa, que ficam na temporada.</p>';

    /* títulos */
    h += '<div class="secao-titulo">Títulos</div><div class="card lista">' + t.titulos.map(function (ti) {
      var acao = !ti.ganho ? '<span class="selo selo-desconhecido">Bloqueado</span>' : ti.ativo ? '<button type="button" class="btn btn-p" data-titulo="">Tirar</button>'
        : t.titulosLiberados ? '<button type="button" class="btn btn-p" data-titulo="' + RP.esc(ti.nome) + '">Usar</button>' : '<span class="selo">Ganho</span>';
      return '<div class="lista-item"><span class="ico-placa">' + RP.icone(ti.ganho ? 'coroa' : 'cadeado') + '</span><span style="flex:1;min-width:0"><b>' + RP.esc(ti.nome) + '</b><br><small class="fraco">' + RP.esc(ti.como) + '</small></span>' + acao + '</div>';
    }).join('') + '</div>' + (t.titulosLiberados ? '' : '<p class="fraco" style="font-size:var(--fs-2);margin-top:var(--esp-2)">Usar títulos libera no nível ' + nivelDe(t, 'titulos') + ' da linhagem.</p>');

    /* brasões */
    var meu = RP.reino && RP.reino.brasao;
    var bras = (meu ? [{ brasao: meu, nome: 'Atual' }] : []).concat(t.brasoes);
    if (t.brasao.moldura && meu) bras.push({ brasao: Object.assign({}, meu, { moldura: true }), nome: 'Brasão da casa' });
    else bras.push({ brasao: Object.assign({}, meu || { forma: 'classico', divisao: 'pleno', cor1: 'negro', cor2: 'ouro', simbolo: 'coroa', corSimbolo: 'ouro' }, { moldura: true }), nome: 'Nível ' + nivelDe(t, 'moldura') + ': brasão da casa', bloqueado: true });
    h += '<div class="secao-titulo">Brasões e cosméticos</div><div class="brasoes-grade">' + bras.map(function (b) {
      return '<div class="card brasao-item' + (b.bloqueado ? ' bloqueado' : '') + '">' + RP.brasao(b.brasao, { tamanho: 56 }) + '<small>' + RP.esc(b.nome) + '</small></div>';
    }).join('') + '</div><p class="fraco" style="font-size:var(--fs-2);margin-top:var(--esp-2)">Brasões antigos ficam no seu histórico e podem ser usados ao fundar o próximo reino.' +
      (t.brasao.extras ? ' Cores e formas da linhagem liberadas.' : ' Cores e formas extras no nível ' + nivelDe(t, 'brasoes') + '.') + '</p>';

    /* histórico */
    h += '<div class="secao-titulo">Suas temporadas</div><div class="card lista">' + (t.historico.length ? t.historico.map(function (x) {
      return '<div class="lista-item"><span class="linhagem-nivel pequeno">' + x.temporada + '</span><span style="flex:1;min-width:0"><b>' + RP.esc(x.nomeReino ? 'Reino de ' + x.nomeReino : 'Temporada ' + x.temporada) + '</b><br><small class="fraco">' + RP.esc(x.resumo) +
        ' · ativo em ' + x.diasAtivos + ' dias' + (x.contou ? ' · contou para a linhagem' : '') + '</small></span></div>';
    }).join('') : '<div class="lista-item"><span class="fraco">Esta é a sua primeira temporada.</span></div>') + '</div><div style="height:var(--esp-8)"></div>';
    RP.$('.temp-conteudo', el).innerHTML = h;
  }
  function nivelDe(t, k) { var d = t.linhagem.desbloqueios.filter(function (x) { return x.chave === k; })[0]; return d ? d.nivel : '?'; }

  RP.registrarTela('temporada', {
    secao: 'mais', nav: true,
    montar: function (el) {
      el.innerHTML = topo('Temporada e legado', 'mais') + '<div class="conteudo-tela temp-conteudo"><p class="fraco">Carregando…</p></div>';
      el.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-equipar]'))) {
          var equipar = b.getAttribute('data-equipada') !== 'true';
          RP.tentar(RP.post('/temporada/reliquias/' + b.getAttribute('data-equipar'), { equipada: equipar })).then(function (t) {
            temp = t; desenharTemporada(el);
            RP.aviso({ titulo: equipar ? 'Relíquia equipada' : 'Relíquia guardada', texto: 'Bônus do legado: +' + pct(t.vale), icone: 'lendario', tipo: 'sucesso', ms: 1800 });
          }).catch(function () { /* aviso já mostrado */ });
        } else if ((b = e.target.closest('[data-titulo]'))) {
          var nome = b.getAttribute('data-titulo');
          RP.tentar(RP.post('/temporada/titulo', { nome: nome || null })).then(function (t) {
            temp = t; desenharTemporada(el);
            RP.aviso({ titulo: nome ? 'Título em uso' : 'Sem título', texto: nome || '', icone: 'coroa', tipo: 'sucesso', ms: 1800 });
          }).catch(function () { /* aviso já mostrado */ });
        } else if ((b = e.target.closest('[data-exilio]'))) {
          RP.tentar(RP.post('/temporada/exilio', { regiao: b.getAttribute('data-exilio') || null })).then(function (t) { temp = t; desenharTemporada(el); }).catch(function () { /* aviso */ });
        }
      });
    },
    entrar: function (el) { desenharTemporada(el); carregarTemporada(el); }
  });

  /* ================================================================ Ranking da temporada */
  var CAT_RANK = [
    { id: 'baixas', nome: 'Baixas', txt: 'Tropas inimigas abatidas', icone: 'tropas' },
    { id: 'perdas', nome: 'Perdas', txt: 'Tropas próprias perdidas (menos é melhor)', icone: 'escudo' },
    { id: 'tropas', nome: 'Tropas', txt: 'Tamanho do exército hoje', icone: 'estandarte' },
    { id: 'familias', nome: 'Famílias', txt: 'População civil do reino', icone: 'populacao' }
  ];
  var catRank = 'baixas', rank = null;
  function desenharRanking(el) {
    var R = rank; if (!R) return;
    var cat = CAT_RANK.filter(function (c) { return c.id === catRank; })[0], dados = R.categorias[catRank];
    var max = Math.max(1, dados.top.reduce(function (s, r) { return Math.max(s, r[catRank]); }, 0));
    function linhaRank(r, meu) {
      var outros = CAT_RANK.filter(function (c) { return c.id !== catRank; }).map(function (c) { return c.nome.toLowerCase() + ' ' + RP.num(r[c.id]); }).join(' · ');
      return '<li class="rank-linha' + (meu ? ' meu' : '') + (r.pos <= R.premiados && R.premiadas.indexOf(catRank) >= 0 ? ' podio' : '') + '"><span class="rank-pos num">' + r.pos + 'º</span>' + RP.brasao(r.brasao, { tamanho: 28 }) +
        '<span class="rank-corpo"><span class="linha-entre"><b>' + RP.esc('Reino de ' + r.nome) + '</b><b class="num rank-valor">' + RP.num(r[catRank]) + '</b></span>' +
        '<span class="rank-barra" aria-hidden="true"><i style="width:' + Math.max(2, (100 * r[catRank]) / max).toFixed(1) + '%"></i></span><small class="fraco">' + outros + '</small></span></li>';
    }
    var eu = dados.eu;
    RP.$('.rank-conteudo', el).innerHTML =
      '<div class="nota-regra">' + RP.icone('info', 'ico-p') + '<span>O ranking não mede território: a disputa pelo mapa continua sem placar. Famílias = população civil, sem as tropas. Os ' + R.premiados + ' primeiros de baixas, tropas ou famílias ganham uma relíquia da temporada.</span></div>' +
      '<div class="abas" role="tablist" aria-label="Categoria do ranking" style="margin-top:var(--esp-3)">' + CAT_RANK.map(function (c) { return '<button class="aba" role="tab" data-cat-rank="' + c.id + '" aria-selected="' + (c.id === catRank) + '">' + c.nome + '</button>'; }).join('') + '</div>' +
      (eu ? '<div class="card rank-eu"><span class="ico-placa">' + RP.icone(cat.icone) + '</span><span style="flex:1"><span class="rotulo">' + cat.txt + '</span><b class="rank-eu-pos">Você: ' + eu.pos + 'º</b><small class="fraco">de ' + RP.num(R.reinos) + ' reinos</small></span><b class="num rank-eu-valor">' + RP.num(eu[catRank]) + '</b></div>' : '') +
      '<div class="secao-titulo">Os 10 primeiros · ' + cat.nome.toLowerCase() + '</div><ol class="card rank-lista">' + dados.top.map(function (r) { return linhaRank(r, r.meu); }).join('') + '</ol>' +
      (eu ? '<div class="secao-titulo">Sua posição</div><ol class="card rank-lista">' + linhaRank(eu, true) + '</ol>' : '') + '<div style="height:var(--esp-8)"></div>';
    RP.$('.topo-titulos small', el).textContent = 'Temporada ' + R.temporada + ' · ' + RP.num(R.reinos) + ' reinos';
  }
  RP.registrarTela('ranking', {
    secao: 'mais', nav: true,
    montar: function (el) {
      el.innerHTML = topo('Ranking da temporada', 'temporada', ' ') + '<div class="conteudo-tela rank-conteudo"><p class="fraco">Carregando…</p></div>';
      el.addEventListener('click', function (e) { var b = e.target.closest('[data-cat-rank]'); if (b) { catRank = b.getAttribute('data-cat-rank'); desenharRanking(el); } });
    },
    entrar: function (el) {
      desenharRanking(el);
      RP.get('/ranking').then(function (r) { rank = r; desenharRanking(el); }, function () { /* offline */ });
    }
  });

  /* ================================================================ Precisa de você */
  var GRUPOS = [['urgente', 'Agora'], ['oportunidade', 'Oportunidades'], ['reino', 'No seu reino']];
  function itemHTML(p) {
    var resta = p.fim ? ' <b class="num" data-fim="' + p.fim + '">' + RP.fmtResta(p.fim - RP.agora()) + '</b>' : '';
    return '<div class="card linha pend-item pend-' + p.grupo + '"><span class="ico-placa">' + RP.icone(p.icone) + '</span><span style="flex:1;min-width:0"><b>' + RP.esc(p.titulo) + '</b><br><small class="fraco">' + RP.esc(p.texto) + resta + '</small></span>' +
      '<a class="btn btn-p' + (p.grupo === 'urgente' ? ' btn-primario' : '') + '" href="' + RP.esc(p.href) + '">' + RP.esc(p.botao) + '</a></div>';
  }
  RP.agoraItemHTML = itemHTML;
  RP.registrarTela('agora', {
    nav: true,
    montar: function (el) { el.innerHTML = '<header class="topo"><h1>Atenção</h1><small class="fraco" style="margin-left:auto">Nada aqui é obrigatório</small></header><div class="conteudo-tela ag-conteudo"><p class="fraco">Carregando…</p></div>'; },
    entrar: function (el) {
      RP.get('/agora').then(function (a) {
        RP.$('.ag-conteudo', el).innerHTML = '<div class="acoes-tela" style="margin-top:0"><a class="btn btn-p" href="#/relatorios">' + RP.icone('relatorios') + 'Relatórios</a><a class="btn btn-p" href="#/notificacoes">' + RP.icone('sino') + 'Notificações' + (RP.naoLidas ? ' <span class="contador contador-inline">' + RP.naoLidas + '</span>' : '') + '</a></div>' +
          GRUPOS.map(function (g) {
            var it = a.itens.filter(function (p) { return p.grupo === g[0]; });
            return it.length ? '<div class="secao-titulo">' + g[1] + '</div><div class="pilha">' + it.map(itemHTML).join('') + '</div>' : '';
          }).join('') + (a.itens.length ? '' : '<p class="suave">Nada pede atenção agora.</p>') + '<div style="height:var(--esp-8)"></div>';
      }, function (e) { RP.$('.ag-conteudo', el).innerHTML = '<p class="fraco">' + RP.esc(e.message || 'Sem conexão.') + '</p>'; });
    }
  });

  /* resumo no topo de Meu reino: os 3 mais urgentes (busca no máximo a cada 20 s; mostra o último enquanto busca) */
  var resumo = { html: '', em: 0, buscando: false };
  function resumoHTML(a) {
    if (!a.itens.length) return '';
    return '<div class="secao-titulo" style="margin-top:0">Precisa de você</div><div class="pilha">' + a.itens.map(itemHTML).join('') + '</div>' +
      '<a class="btn btn-p btn-fantasma ver-tudo" href="#/agora">' + RP.icone('menu') + 'Ver tudo (' + a.total + ')</a>';
  }
  function buscarResumo() {
    if (resumo.buscando || RP.agora() - resumo.em < 20000) return;
    resumo.buscando = true;
    RP.get('/agora?n=3').then(function (a) {
      resumo = { html: resumoHTML(a), em: RP.agora(), buscando: false };
      RP.$$('[data-agora-resumo]').forEach(function (x) { x.innerHTML = resumo.html; });
    }, function () { resumo.buscando = false; });
  }
  RP.ouvir('reino', function () { resumo.em = 0; });
  RP.extrasReino = RP.extrasReino || [];
  RP.extrasReino.push(function () {
    setTimeout(buscarResumo, 0);
    return '<div class="agora-resumo" data-agora-resumo>' + resumo.html + '</div>';
  });

  /* ================================================================ entradas em Mais e fim da temporada */
  RP.itensMais = RP.itensMais || [];
  RP.itensMais.unshift(
    { icone: 'temporada', titulo: 'Temporada e legado', texto: 'Tempo restante, linhagem, relíquias, títulos e brasões', href: '#/temporada' },
    { icone: 'alvo', titulo: 'Precisa de você', texto: 'O que pede atenção, oportunidades e o andamento do reino', href: '#/agora' },
    { icone: 'coroa', titulo: 'Ranking da temporada', texto: 'Baixas, perdas, tropas e famílias', href: '#/ranking' }
  );
  /* a temporada terminou: o mundo recomeça; a conta e o legado ficam */
  var ouvindoTemporada = false;
  var conectar = RP.conectarEventos, desconectar = RP.desconectarEventos;
  RP.conectarEventos = function () { conectar(); if (!ouvindoTemporada && RP.ouvirTipoSse) { ouvindoTemporada = true; RP.ouvirTipoSse('temporada'); } };
  RP.desconectarEventos = function () { ouvindoTemporada = false; desconectar(); };
  RP.ouvir('temporada', function (d) {
    RP.modal({
      topo: '<div class="modal-brasao">' + RP.icone('temporada') + '</div>',
      titulo: 'A temporada ' + (d.fim || '') + ' terminou',
      corpo: '<p class="suave">O mapa e os reinos recomeçam do zero. Sua linhagem, as relíquias da temporada, os títulos e os brasões ficam com você.</p>',
      acoes: [{ rotulo: RP.icone('castelo') + 'Fundar meu novo reino', classe: 'btn-primario', acao: function () { location.hash = '#/criar'; location.reload(); } }],
      fecharFora: false
    });
  });
})();
