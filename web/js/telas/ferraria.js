/* Reino de Pedra — Ferraria e eras (#/ferraria): fila própria da ferraria, eras com requisitos, trilha de armas e armaduras
   por família com custo, requisito e Forjar (o material vem sozinho até a ferraria), equipamento lendário (requisitos,
   minério raro, onde extrair, onde está e levar no próximo envio) e o teto de bônus com exemplos do próprio reino.
   Porte de prototipo/js/ferraria.js; os dados vêm de GET /ferraria. O sistema aparece ao ter a primeira ferraria. */
(function () {
  'use strict';
  var RP = window.RP;

  RP.SISTEMAS = RP.SISTEMAS || {};
  RP.SISTEMAS.ferraria = { nome: 'Ferraria e eras', icone: 'ferraria', txt: 'Eras, armas e armaduras por família e o equipamento lendário.' };

  var FAM = {
    infantaria: { nome: 'Infantaria', icone: 'tropas' },
    arqueiros: { nome: 'Arqueiros', icone: 'alvo' },
    cavalaria: { nome: 'Cavalaria', icone: 'cavalo' }
  };
  var LINHA = { armas: { nome: 'Armas', icone: 'espada' }, armaduras: { nome: 'Armaduras', icone: 'escudo' } };
  var ERA_FERRO = { id: 'ferro', nome: 'Era do Ferro', libera: 'Armas e armaduras do nível 1', inicial: true, feita: true };
  var NOMES_ERA = { ferro: 'Era do Ferro' };
  RP.FAMILIAS_FORJA = FAM;

  function pct(x) { return Math.round((x || 0) * 100); }
  function linha(r, v) { return '<div class="info-linha"><span class="fraco">' + r + '</span><span>' + v + '</span></div>'; }

  /* ---------------------------------------------------------------- dados (GET /ferraria) */
  RP.ferraria = { dados: null };
  var carregando = null;
  RP.ferraria.carregar = function () {
    if (carregando) return carregando;
    carregando = RP.get('/ferraria').then(function (d) {
      carregando = null; RP.ferraria.dados = d; RP.sincronizar(d.agora);
      document.dispatchEvent(new CustomEvent('rp:ferraria', { detail: d }));
      return d;
    }, function (e) { carregando = null; throw e; });
    return carregando;
  };
  var recarga = null;
  RP.ferraria.recarregar = function () {
    if (recarga) return;
    recarga = setTimeout(function () { recarga = null; RP.ferraria.carregar().catch(function () { /* offline */ }); }, 400);
  };
  function naTela() { return document.documentElement.getAttribute('data-tela') === 'ferraria'; }
  ['reino', 'relatorio'].forEach(function (t) { RP.ouvir(t, function () { if (naTela()) RP.ferraria.recarregar(); }); });

  /* ---------------------------------------------------------------- peças */
  function reqHTML(req) {
    if (!req || !req.length) return '';
    return '<span class="req-lista">' + req.map(function (r) {
      return '<span class="selo ' + (r.ok ? 'selo-visivel' : 'selo-desconhecido') + '">' + RP.icone(r.ok ? 'check' : 'cadeado') + RP.esc(r.texto) + '</span>';
    }).join('') + '</span>';
  }
  function nomeUnidades(ids) {
    return ids.map(function (u) { return RP.unidade && RP.unidade(u) ? RP.unidade(u).nome.toLowerCase() : u; }).join(', ');
  }
  function eraAtualNome(d) { var e = (d.eras || []).filter(function (x) { return x.id === d.era; })[0]; return e ? e.nome : ERA_FERRO.nome; }

  function filaHTML(d) {
    var f = d.fila || [];
    var fim = f.length ? f[f.length - 1].fim : null;
    return '<div class="card pilha fila-card"><div class="card-titulo" style="margin:0">' + RP.icone('martelo') + '<h3>Fila da ferraria</h3><span class="selo">' + f.length + ' de ' + d.vagas + '</span></div>' +
      (f.length ? f.map(function (i) { i.fila = 'ferraria'; return RP.itemFilaServidor(i); }).join('') +
        (fim ? '<p class="fila-termina">' + RP.icone('relogio', 'ico-p') + 'Fila termina ' + RP.fmtHora(fim) + '</p>' : '') : '<p class="fraco">Nada sendo forjado.</p>') +
      '<p class="fraco fer-nota">Fila própria, separada das obras: uma pesquisa ou forja por vez.</p></div>';
  }

  function cardEra(e) {
    var feita = e.feita, selo = feita ? '<span class="selo selo-visivel">' + RP.icone('check') + (e.inicial ? 'Inicial' : 'Pesquisada') + '</span>'
      : e.emFila ? '<span class="selo selo-info">Na fila</span>' : '<span class="selo">' + RP.icone('relogio') + RP.fmtDuracao(e.tempo) + '</span>';
    return '<div class="card era-card' + (feita ? ' feita' : '') + '"><div class="linha-entre"><b>' + RP.esc(e.nome) + '</b>' + selo + '</div>' +
      '<small class="fraco">Libera: ' + RP.esc(e.libera) + '</small>' +
      (!feita && !e.inicial ? '<div class="linha obra-custo">' + RP.custoHTML(e.custo, 1, '*') + '</div>' + reqHTML(e.req) +
        (e.emFila ? '' : '<button type="button" class="btn btn-p btn-primario' + (e.bloqueio ? ' btn-inativo' : '') + '" data-pesquisar="' + e.id + '"' +
          (e.bloqueio ? ' data-motivo="' + RP.esc(e.bloqueio) + '"' : '') + '>' + RP.icone('ferraria') + 'Pesquisar</button>') : '') + '</div>';
  }

  function cardFamilia(d, f) {
    var F = FAM[f.id] || { nome: f.id, icone: 'tropas' };
    return '<div class="card pilha fam-card"><div class="card-titulo" style="margin:0"><span class="ico-placa">' + RP.icone(F.icone) + '</span><h3>' + RP.esc(F.nome) + '</h3><small class="fraco">' + RP.esc(nomeUnidades(f.unidades)) + '</small></div>' +
      f.linhas.map(function (l) {
        var L = LINHA[l.id], n = l.nivel, prox = n + l.naFila, N = l.proximo, max = d.niveisMax;
        var trilha = '<span class="trilha-niveis" role="img" aria-label="' + L.nome + ' nível ' + n + ' de ' + max + '">' +
          Array.apply(null, Array(max)).map(function (_, i) { return '<i class="' + (i + 1 <= n ? 'on' : i + 1 <= prox ? 'fila' : '') + '"></i>'; }).join('') + '</span>';
        return '<div class="linha-forja"><div class="linha-entre"><span class="linha">' + RP.icone(L.icone, 'ico-p') + '<b>' + L.nome + '</b>' + trilha + '</span><span class="num">+' + pct(l.bonus) + '% ' + l.efeito + '</span></div>' +
          (N ? '<div class="linha obra-custo">' + RP.custoHTML(N.custo, 1, '*') + '<span class="tempo">' + RP.icone('relogio', 'ico-p') + RP.fmtDuracao(N.tempo) + '</span></div>' +
            (N.req.every(function (r) { return r.ok; }) ? '' : reqHTML(N.req)) +
            '<button type="button" class="btn btn-p' + (N.bloqueio ? ' btn-inativo' : '') + '" data-forjar="' + f.id + ':' + l.id + '"' + (N.bloqueio ? ' data-motivo="' + RP.esc(N.bloqueio) + '"' : '') + '>' +
            RP.icone('martelo') + 'Forjar nível ' + N.nivel + (l.naFila ? ' (depois da fila)' : '') + '</button>'
            : '<small class="fraco">Nível máximo' + (l.naFila ? ' (na fila)' : '') + '.</small>') + '</div>';
      }).join('') + '</div>';
  }

  function ondeTxt(o) {
    if (!o) return 'em lugar desconhecido';
    return o.tipo === 'local' ? 'guardado em ' + o.nome : 'com o exército em campo (' + o.nome + ')';
  }
  function cardMeu(d, e) {
    var lend = d.lendario, o = e.onde, fator = o ? o.fator : 1;
    return '<div class="lista-item lend-meu"><span class="ico-placa">' + RP.icone('lendario', 'r-minerio') + '</span><span style="flex:1;min-width:0"><b>' + RP.esc(e.nome) + '</b> · +' + pct(lend.bonus) + '% de ' + e.tipo +
      (e.capturado ? ' <span class="selo selo-destaque">Capturado</span>' : '') + '<br><small class="fraco">Está ' + RP.esc(ondeTxt(o)) +
      (o ? ' · vale ' + (fator < 1 ? '+' + Math.round(lend.bonus * fator * 100) + '% (diluído entre ' + RP.num(o.tropas) + (o.tipo === 'local' ? ' defensores, com a milícia)' : ' tropas)') : 'inteiro') : '') + '</small>' +
      (o && o.tipo === 'local' ? '<label class="lend-levar"><input type="checkbox" data-lend-levar="' + e.id + '"' + (e.levar ? ' checked' : '') + '> Levar com o próximo exército que sair daqui</label>' : '') +
      '</span>' + (o ? '<a class="btn btn-p btn-fantasma btn-icone" href="#/mapa?foco=' + o.hex + '" aria-label="Ver no mapa">' + RP.icone('mapa') + '</a>' : '') + '</div>';
  }
  function cardLendario(d) {
    var L = d.lendario, prec = L.custo.minerio || 0, falta = L.bloqueio;
    var meus = L.meus || [], vistos = L.vistos || [];
    return '<div class="card pilha lend-card"><div class="card-titulo" style="margin:0"><span class="ico-placa">' + RP.icone('minerio', 'r-minerio') + '</span><h3>Equipamento lendário</h3><span class="selo">' + (L.porReino === 1 ? '1 por reino' : L.porReino + ' por reino') + '</span></div>' +
      '<p class="suave fer-nota">Forjado com minério raro: <b>+' + pct(L.bonus) + '% de ataque ou de defesa</b> para um grupo de até ' + L.tropas + ' tropas (num grupo maior, o bônus se dilui). Se o grupo for derrotado, o equipamento fica no campo e o vencedor o leva.</p>' +
      (L.forjados < L.porReino || L.emFila ? '<div class="linha obra-custo">' + RP.custoHTML(L.custo, 1, '*') + '<span class="tempo">' + RP.icone('relogio', 'ico-p') + RP.fmtDuracao(L.tempo) + '</span></div>' + reqHTML(L.req) +
        '<small class="fraco">Minério raro no reino: <b>' + RP.num(L.minerio) + '</b> de ' + RP.num(prec) + '.' + (L.jazidas.length ? ' ' + (L.jazidas.length === 1 ? 'Há um veio conhecido' : 'Há ' + L.jazidas.length + ' veios conhecidos') + ' no mapa.' : ' Um prospector revela veios de minério raro nas montanhas.') + '</small>' +
        '<div class="linha lend-acoes">' + L.jazidas.map(function (j) { return '<a class="btn btn-p" href="#/mapa?foco=' + j.hex + '">' + RP.icone('picareta') + 'Extrair minério raro</a>'; }).join('') +
        (L.emFila ? '<span class="selo selo-info">Na fila</span>' : '<button type="button" class="btn btn-p btn-primario' + (falta ? ' btn-inativo' : '') + '" data-forjar-lendario' + (falta ? ' data-motivo="' + RP.esc(falta) + '"' : '') + '>' + RP.icone('lendario') + 'Forjar</button>') + '</div>'
        : '<small class="fraco">Seu reino já forjou o equipamento lendário desta temporada.</small>') +
      (meus.length ? '<div class="secao-titulo lend-sub">Seus</div><div class="lista">' + meus.map(function (e) { return cardMeu(d, e); }).join('') + '</div>' : '') +
      (vistos.length ? '<div class="secao-titulo lend-sub">Vistos em outros reinos</div><div class="lista">' + vistos.map(function (v) {
        return '<a class="lista-item" href="#/relatorio?id=' + v.relatorio + '"><span class="ico-placa">' + RP.icone('lendario') + '</span><span style="flex:1;min-width:0"><b>' + RP.esc(v.nome) + '</b> · +' + pct(L.bonus) + '% de ' + RP.esc(v.tipo) +
          '<br><small class="fraco">' + RP.esc((v.dono || '') + (v.local ? ' · ' + v.local : '')) + ' · espionado ' + RP.fmtHa((RP.agora() - v.quando) / 3600000) + '</small></span></a>';
      }).join('') + '</div><p class="fraco fer-nota">Vencer o grupo que o leva deixa o equipamento no campo para você levar.</p>' : '') + '</div>';
  }

  function cardTeto(d) {
    var ex = d.exemplos || [];
    return '<div class="card pilha"><div class="card-titulo" style="margin:0">' + RP.icone('escudo') + '<h3>Limite de bônus: +' + pct(d.teto) + '%</h3></div>' +
      '<p class="suave fer-nota">Armas e armaduras, veterania, relíquias, equipamento lendário e legado somam no máximo +' + pct(d.teto) + '%. Torres e portões ficam fora desse limite.</p>' +
      '<p class="fraco fer-nota">Armas e armaduras valem para as tropas da família: num exército misto, contam na proporção da força de cada família. A milícia é infantaria; os arqueiros no alto das torres usam as armaduras dos arqueiros.</p>' +
      (ex.length ? '<div class="lista">' + ex.map(function (x) {
        var partes = x.partes.length ? x.partes.map(function (p) { return p.nome.toLowerCase() + ' +' + pct(p.v) + '%'; }).join(' · ') : 'sem bônus';
        return '<div class="lista-item"><span style="flex:1;min-width:0"><b>' + RP.esc(x.titulo) + '</b><br><small class="fraco">' + RP.esc(x.tropas) + '</small><br><small class="fraco">' + RP.esc(partes) + (x.noTeto ? ' (no limite)' : '') + '</small></span><b class="num">+' + pct(x.total) + '%</b></div>';
      }).join('') + '</div>' : '<p class="fraco">Sem tropas nas guarnições para dar exemplos.</p>') + '</div>';
  }

  function desenhar(el) {
    var d = RP.ferraria.dados, box = RP.$('.fer-conteudo', el);
    if (!d) { box.innerHTML = '<p class="fraco">Carregando…</p>'; return; }
    RP.$('.topo-titulos small', el).textContent = d.ferraria ? d.ferraria.nome + ' · nível ' + d.ferraria.nivel + ' · ' + eraAtualNome(d) : eraAtualNome(d);
    box.innerHTML = (d.ferraria ? '' : '<div class="nota-regra">' + RP.icone('ferraria', 'ico-p') + '<span>Seu reino ainda não tem ferraria. Funde uma em planície ou colina para pesquisar eras e forjar.</span></div>' +
        '<a class="btn btn-p btn-primario fer-fundar" href="#/mapa?fundar=ferraria">' + RP.icone('alvo') + 'Fundar ferraria</a>') +
      ((d.fila || []).length ? filaHTML(d) : '') +
      (function () {
        /* camadas: a próxima era fica à vista; as já feitas e as seguintes, um toque adiante */
        var eras = [ERA_FERRO].concat(d.eras), prox = eras.filter(function (e) { return !e.feita; })[0];
        return '<div class="secao-titulo">Próxima era</div>' + (prox ? cardEra(prox) : '<p class="fraco">Todas as eras pesquisadas.</p>') +
          RP.secaoRecolhida('Todas as eras', '<div class="pilha">' + eras.filter(function (e) { return e !== prox; }).map(cardEra).join('') + '</div>');
      })() +
      /* sem ferraria, armas e armaduras ficam recolhidas: a ação de agora é fundar */
      RP.secaoRecolhida('Armas e armaduras', '<div class="pilha">' + d.familias.map(function (f) { return cardFamilia(d, f); }).join('') + '</div>', !!d.ferraria) +
      RP.secaoRecolhida('Lendário', cardLendario(d)) +
      RP.secaoRecolhida('Bônus de combate', cardTeto(d)) +
      RP.comoFunciona('<p>Armas e armaduras: +' + pct(d.bonusNivel) + '% por nível, até o nível ' + d.niveisMax + ', para cada família. Armas dão ataque; armaduras, defesa. O bônus não ocupa população.</p>' +
        '<p>A ferraria tem fila própria, separada das obras: uma pesquisa ou forja por vez.</p>' +
        '<p>O material vem sozinho para a ferraria: o que faltar sai dos locais mais próximos, e o ouro, do armazém.</p>') + '<div style="height:var(--esp-8)"></div>';
  }

  /* ---------------------------------------------------------------- ações */
  function aposFila(el, it) {
    RP.aviso({ titulo: 'Na fila: ' + it.rotulo, texto: it.materialCompleto ? '' : 'O material está a caminho da ferraria.', icone: it.materialCompleto ? 'martelo' : 'carroca', tipo: 'sucesso' });
    RP.recarregarReino();
    RP.ferraria.carregar().then(function () { desenhar(el); }, function () { /* offline */ });
  }
  function bloqueado(b) {
    var m = b.getAttribute('data-motivo');
    if (!m) return false;
    RP.aviso({ titulo: 'Ainda não dá', texto: m, icone: 'cadeado', tipo: 'alerta' });
    return true;
  }
  function escolherLendario(el) {
    var L = RP.ferraria.dados.lendario;
    RP.modal({
      titulo: 'Forjar equipamento lendário',
      corpo: '<p class="suave">Escolha o efeito. +' + pct(L.bonus) + '% para um grupo de até ' + L.tropas + ' tropas; depois de forjado, não muda.</p>',
      acoes: [
        { rotulo: RP.icone('espada') + 'De ataque', classe: 'btn-primario', acao: function () { RP.tentar(RP.post('/ferraria/lendario', { tipo: 'ataque' })).then(function (it) { aposFila(el, it); }); } },
        { rotulo: RP.icone('escudo') + 'De defesa', classe: 'btn-primario', acao: function () { RP.tentar(RP.post('/ferraria/lendario', { tipo: 'defesa' })).then(function (it) { aposFila(el, it); }); } },
        { rotulo: 'Agora não' }
      ]
    });
  }

  RP.registrarTela('ferraria', {
    secao: 'tropas',
    montar: function (el) {
      el.innerHTML = RP.topoVoltar('Ferraria e eras', 'tropas', ' ') + '<div class="conteudo-tela fer-conteudo"></div>';
      document.addEventListener('rp:ferraria', function () { if (!el.hidden) desenhar(el); });
      document.addEventListener('rp:tropas', function () { if (!el.hidden) desenhar(el); });
      el.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-pesquisar]'))) {
          if (bloqueado(b)) return;
          RP.tentar(RP.post('/ferraria/eras', { era: b.getAttribute('data-pesquisar') })).then(function (it) { aposFila(el, it); });
        } else if ((b = e.target.closest('[data-forjar]'))) {
          if (bloqueado(b)) return;
          var p = b.getAttribute('data-forjar').split(':');
          RP.tentar(RP.post('/ferraria/forjar', { familia: p[0], linha: p[1] })).then(function (it) { aposFila(el, it); });
        } else if ((b = e.target.closest('[data-forjar-lendario]'))) {
          if (bloqueado(b)) return;
          escolherLendario(el);
        }
      });
      el.addEventListener('change', function (e) {
        var c = e.target.closest('[data-lend-levar]'); if (!c) return;
        RP.tentar(RP.post('/ferraria/lendario/' + c.getAttribute('data-lend-levar') + '/levar', { levar: c.checked })).then(function () {
          RP.aviso({ titulo: c.checked ? 'Vai com o próximo exército' : 'Fica no local', texto: c.checked ? 'O próximo exército que sair deste local leva o equipamento.' : '', icone: 'lendario', tipo: 'sucesso', ms: 2400 });
          RP.recarregarReino(); RP.ferraria.recarregar();
        }, function () { c.checked = !c.checked; });
      });
    },
    entrar: function (el) {
      desenhar(el);
      RP.ferraria.carregar().then(function () { desenhar(el); }, function () { /* aviso já mostrado */ });
      if (RP.carregarTropas && !RP.tropas) RP.carregarTropas().catch(function () { /* offline */ });
    }
  });

  /* ---------------------------------------------------------------- acessos: Tropas, Construção, Mais, folhas */
  function resumoHTML() {
    var f = RP.reino && RP.reino.ferraria; if (!f) return '';
    var txt = Object.keys(FAM).map(function (k) {
      var a = (f.forja || {})[k + ':armas'] || 0, d = (f.forja || {})[k + ':armaduras'] || 0;
      return FAM[k].nome.toLowerCase() + ' +' + pct(a * f.bonusNivel) + '% / +' + pct(d * f.bonusNivel) + '%';
    }).join(' · ');
    var fila = ((RP.reino.filas || {}).ferraria || []).length;
    return '<a class="card linha ferraria-atalho" href="#/ferraria"><span class="ico-placa ico-placa-g">' + RP.icone('ferraria') + '</span><span style="flex:1;min-width:0"><b>Ferraria e eras</b><br><small class="fraco">' +
      RP.esc(f.eraNome || NOMES_ERA.ferro) + ' · ' + RP.esc(txt) + (fila ? ' · ' + fila + ' na fila' : '') +
      ((f.lendarios || []).length ? ' · ' + f.lendarios.length + ' lendário' + (f.lendarios.length > 1 ? 's' : '') : '') + '</small></span>' + RP.icone('avancar', 'ico-p') + '</a>';
  }
  RP.extrasTropas = RP.extrasTropas || [];
  RP.extrasTropas.push(function () { return RP.sistema('ferraria') ? resumoHTML() : ''; });

  RP.itensMais = RP.itensMais || [];
  RP.itensMais.push({ icone: 'ferraria', titulo: 'Ferraria e eras', texto: 'Eras, armas e armaduras e o equipamento lendário', href: '#/ferraria', sistema: 'ferraria' });

  /* Construção: aba Ferraria (só depois que o sistema aparece) */
  RP.extrasConstrucao = RP.extrasConstrucao || [];
  var abaPosta = false;
  function porAba() {
    if (abaPosta || !RP.sistema('ferraria')) return;
    abaPosta = true;
    RP.extrasConstrucao.push({ aba: 'ferraria', nome: 'Ferraria', html: function (r) {
      var f = ((r.filas || {}).ferraria || []);
      return '<div class="card pilha"><div class="card-titulo" style="margin:0">' + RP.icone('martelo') + '<h3>Fila da ferraria</h3><span class="selo">' + f.length + ' de 10</span></div>' +
        (f.length ? f.map(function (i) { i.fila = 'ferraria'; return RP.itemFilaServidor(i); }).join('') : '<p class="fraco">Nada sendo forjado.</p>') + '</div>' +
        resumoHTML() + '<a class="btn btn-p btn-primario" href="#/ferraria">' + RP.icone('ferraria') + 'Abrir a ferraria</a>';
    } });
  }
  document.addEventListener('rp:reino', porAba);

  /* folha do local (Meu reino): ferraria e equipamento lendário na guarnição */
  RP.extrasCardLocal = RP.extrasCardLocal || [];
  RP.extrasCardLocal.push(function (l) {
    return (l.lendarios || []).map(function (e) { return '<span class="selo selo-destaque lc-lend">' + RP.icone('lendario') + RP.esc(e.nome) + '</span>'; }).join('');
  });
  RP.extrasFolhaLocal = RP.extrasFolhaLocal || [];
  RP.extrasFolhaLocal.push(function (l) {
    return (l.lendarios || []).map(function (e) {
      return linha('Lendário', RP.esc(e.nome) + ' · +' + (e.tipo === 'ataque' ? 'ataque' : 'defesa') + (e.levar ? ' · <span class="selo selo-info">vai no próximo envio</span>' : ''));
    }).join('');
  });
  RP.acoesFolhaLocal = RP.acoesFolhaLocal || [];
  RP.acoesFolhaLocal.push(function (l) {
    return l.tipo === 'ferraria' ? '<a class="btn btn-p" href="#/ferraria">' + RP.icone('ferraria') + 'Ferraria e eras</a>' : '';
  });
  /* folha do hexágono no mapa: a própria ferraria */
  if (RP.mapa && RP.mapa.acoesFolhaHex) RP.mapa.acoesFolhaHex.push(function (h, dados) {
    if (RP.envio && RP.envio.ativo()) return '';
    var obj = ((dados && dados.porHex && dados.porHex[h]) || []).filter(function (o) { return o.tipo === 'local' && o.dono === 'meu'; })[0];
    var l = obj && RP.local(obj.id);
    return l && l.tipo === 'ferraria' ? '<a class="btn btn-p" href="#/ferraria">' + RP.icone('ferraria') + 'Ferraria e eras</a>' : '';
  });

  /* relatório de espionagem: o equipamento lendário visto na guarnição */
  RP.desenhosRelatorio = RP.desenhosRelatorio || {};
  var espionagem = RP.desenhosRelatorio.espionagem;
  RP.desenhosRelatorio.espionagem = function (rel) {
    var base = espionagem ? espionagem(rel) : '', eqs = (rel.dados && rel.dados.lendario) || [];
    if (!eqs.length) return base;
    return base + '<div class="secao-titulo">Equipamento lendário</div><div class="pilha">' + eqs.map(function (e) {
      return '<div class="card linha"><span class="ico-placa">' + RP.icone('lendario', 'r-minerio') + '</span><span style="flex:1;min-width:0"><b>' + RP.esc(e.nome) + '</b> · ' + RP.esc(e.tipo) +
        '<br><small class="fraco">Na guarnição. Vencer esse grupo deixa o equipamento no campo para você levar.</small></span></div>';
    }).join('') + '</div>';
  };
})();
