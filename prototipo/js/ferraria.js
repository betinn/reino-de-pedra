/* Reino de Pedra — Ferraria e eras, armas e armaduras, equipamento lendário, veterania, feridos e teto de bônus.
   Números do balanceamento (balanceamento/README.md). */
(function () {
  'use strict';
  var RP = window.RP, D = RP.dados, W = RP.mundo, U = RP.util;
  var TETO = 50;   /* soma máxima de bônus de combate, em % */

  /* ================================================================ eras */
  RP.ERAS = {
    ferro: { nome: 'Era do Ferro', libera: 'Armas e armaduras do nível 1', inicial: true },
    aco: { nome: 'Era do Aço', req: [['ferraria', 7]], custo: { ouro: 80, ferro: 1500, madeira: 1000 }, tempo: 6 * 3600,
      libera: 'Armas e armaduras dos níveis 2 e 3, cavaleiro de elite e equipamento lendário' },
    cerco: { nome: 'Era do Cerco Avançado', req: [['era', 'aco'], ['quartel', 8]], custo: { ouro: 150, madeira: 4000, pedra: 3000, ferro: 1500 }, tempo: 12 * 3600,
      libera: 'Trebuchet e portões dos níveis 4 e 5' }
  };
  RP.eraFeita = function (k) { return k === 'ferro' || !!(D.eras[k] && D.eras[k].feita); };
  function nivelLocal(id) { var x = W.local(id); return x ? x.nivel : 0; }
  /* requisitos: [['ferraria', 7], ['era', 'aco']] → lista { txt, ok } */
  function requisitos(req) {
    return (req || []).map(function (r) {
      if (r[0] === 'era') return { txt: RP.ERAS[r[1]].nome, ok: RP.eraFeita(r[1]) };
      return { txt: RP.TIPOS_LOCAL[r[0]] + ' nível ' + r[1], ok: nivelLocal(r[0]) >= r[1] };
    });
  }
  function reqOk(req) { return requisitos(req).every(function (r) { return r.ok; }); }
  function reqHTML(req) {
    return '<span class="req-lista">' + requisitos(req).map(function (r) {
      return '<span class="selo ' + (r.ok ? 'selo-visivel' : 'selo-desconhecido') + '">' + RP.icone(r.ok ? 'check' : 'cadeado') + RP.esc(r.txt) + '</span>';
    }).join('') + '</span>';
  }

  /* ================================================================ armas e armaduras */
  var FAM = {
    infantaria: { nome: 'Infantaria', icone: 'tropas', unidades: ['milicia', 'lanceiro'] },
    arqueiros: { nome: 'Arqueiros', icone: 'alvo', unidades: ['arqueiro'] },
    cavalaria: { nome: 'Cavalaria', icone: 'cavalo', unidades: ['cavalaria', 'elite'] }
  };
  var NIVEIS = [
    { custo: { ferro: 1500, madeira: 800, couro: 200 }, tempo: 2 * 3600, req: [['ferraria', 3]] },
    { custo: { ferro: 3000, madeira: 1500, aco: 60 }, tempo: 6 * 3600, req: [['era', 'aco']] },
    { custo: { ferro: 6000, madeira: 3000, aco: 150, ouro: 50 }, tempo: 12 * 3600, req: [['era', 'aco'], ['ferraria', 9]] }
  ];
  var POR_NIVEL = 8;
  var LINHA = { armas: { nome: 'Armas', icone: 'espada', efeito: 'ataque' }, armaduras: { nome: 'Armaduras', icone: 'escudo', efeito: 'defesa' } };
  RP.FAMILIAS = FAM;
  function famDe(unidade) { return Object.keys(FAM).filter(function (f) { return FAM[f].unidades.indexOf(unidade) >= 0; })[0]; }
  function nivelLinha(f, l) { return D.ferraria.linhas[f][l]; }
  function naFila(f, l) { return D.ferraria.fila.filter(function (q) { return q.fam === f && q.linha === l; }).length; }

  /* ================================================================ veterania */
  var MARCAS = [2, 5, 9], BONUS_VET = [5, 10, 15];
  RP.veterania = function (marcas) {
    var n = 0; MARCAS.forEach(function (m, i) { if (marcas >= m) n = i + 1; });
    return { marcas: marcas, nivel: n, bonus: n ? BONUS_VET[n - 1] : 0, prox: n < MARCAS.length ? MARCAS[n] : null, nome: n ? 'Veterana ' + ['I', 'II', 'III'][n - 1] : 'Sem veterania' };
  };
  RP.seloVeterania = function (marcas) {
    var v = RP.veterania(marcas || 0);
    return '<span class="selo' + (v.nivel ? ' selo-destaque' : '') + '">' + RP.icone('estandarte') + v.nome + (v.nivel ? ' · +' + v.bonus + '%' : '') + ' · ' + v.marcas + (v.marcas === 1 ? ' marca' : ' marcas') + '</span>';
  };

  /* ================================================================ teto de bônus
     grupo: { lanceiro: 10, ... }; modo 'ataque' | 'defesa'; origem: id do local de onde saem (veterania e relíquia) */
  RP.bonusGrupo = function (grupo, modo, origem) {
    var n = Object.keys(grupo).reduce(function (s, k) { return s + (grupo[k] || 0); }, 0), partes = [];
    if (!n) return { soma: 0, total: 0, partes: partes, teto: TETO };
    var linha = modo === 'defesa' ? 'armaduras' : 'armas', arm = 0;
    Object.keys(grupo).forEach(function (k) { var f = famDe(k); if (f && grupo[k]) arm += grupo[k] * nivelLinha(f, linha) * POR_NIVEL; });
    arm = arm / n;
    if (arm) partes.push({ nome: LINHA[linha].nome, v: arm });
    var vet = RP.veterania(D.veterania[origem || 'castelo'] || 0).bonus;
    if (vet) partes.push({ nome: 'Veterania', v: vet });
    var rel = RP.reliquiaEm && RP.reliquiaEm(origem || 'castelo');
    if (rel && rel.dono === 'meu' && rel.tipo === (modo === 'defesa' ? 'resistencia' : 'ataque')) partes.push({ nome: 'Relíquia', v: rel.bonus });
    if (D.lendario.meu && D.lendario.meu.tipo === modo) partes.push({ nome: 'Lendário', v: 25 * Math.min(1, 50 / n) });
    var leg = D.legado.reliquias.filter(function (r) { return r.equipada && r.tipo === modo; }).reduce(function (s, r) { return s + r.bonus; }, 0);
    if (leg) partes.push({ nome: 'Legado', v: leg });
    var soma = partes.reduce(function (s, p) { return s + p.v; }, 0);
    return { soma: soma, total: Math.min(TETO, soma), partes: partes, teto: TETO };
  };
  RP.bonusTxt = function (b) {
    if (!b.partes.length) return 'Sem bônus de combate';
    return '+' + Math.round(b.total) + '%' + (b.soma > b.teto ? ' (teto)' : '') + ' · ' + b.partes.map(function (p) { return p.nome.toLowerCase() + ' +' + Math.round(p.v) + '%'; }).join(' · ');
  };

  /* ================================================================ feridos */
  var ERVAS = 5, CURA_SEG = 2 * 3600;
  function totalFeridos() { return D.feridos.reduce(function (s, f) { return s + f.qtd; }, 0); }
  var NOMES = { milicia: ['miliciano', 'milicianos'], cavalaria: ['cavaleiro', 'cavaleiros'], elite: ['cavaleiro de elite', 'cavaleiros de elite'] };
  function nomeUn(id, q) { var n = NOMES[id] || [U.unidade(id).nome.toLowerCase(), U.unidade(id).nome.toLowerCase() + 's']; return n[q > 1 ? 1 : 0]; }
  RP.nomeUnidade = nomeUn;
  RP.feridosHTML = function () {
    var n = totalFeridos(), cur = D.curas.filter(function (c) { return c.fim > Date.now(); });
    if (!n && !cur.length) return '';
    var ervas = Math.floor(RP.qtdRecurso('ervas', '*')), podem = Math.min(n, Math.floor(ervas / ERVAS));
    var menor = D.feridos.length ? Math.min.apply(null, D.feridos.map(function (f) { return 24 - f.horas; })) : 0;
    return '<div class="card pilha feridos-card"><div class="card-titulo" style="margin:0">' + RP.icone('ferido', 'r-ervas') + '<h3>Feridos</h3>' + (n ? '<span class="selo selo-perigo">' + n + '</span>' : '') + '</div>' +
      (n ? '<div class="lista">' + D.feridos.map(function (f) {
        return '<div class="lista-item"><span class="ico-placa">' + RP.icone(U.unidade(f.unidade).icone) + '</span><span style="flex:1;min-width:0"><b>' + f.qtd + ' ' + nomeUn(f.unidade, f.qtd) + '</b><br><small class="fraco">' + RP.esc(f.origem) + ' · morrem em ' + Math.round(24 - f.horas) + ' h sem ervas</small></span></div>';
      }).join('') + '</div>' +
      '<p class="fraco" style="font-size:var(--fs-2)">30% das baixas de quem vence, ou recua pela tática, voltam feridos. Cada um é curado no castelo com ' + ERVAS + ' ervas raras em 2 h. Ervas no reino: <b>' + ervas + '</b>' + (podem < n ? ', dá para ' + podem + ' de ' + n + '.' : '.') + '</p>' +
      '<button type="button" class="btn btn-p btn-primario' + (podem ? '' : ' btn-inativo') + '" data-curar>' + RP.icone('ervas') + 'Curar ' + (podem || '') + (podem === 1 ? ' ferido' : ' feridos') + ' · ' + podem * ERVAS + ' ervas</button>' +
      (podem < n ? '<a class="btn btn-p btn-fantasma" href="#/extracao?jazida=j-ervas">' + RP.icone('picareta') + 'Extrair ervas</a>' : '') +
      (menor && menor < 6 ? '<p class="nota-antiga">' + RP.icone('alerta', 'ico-p') + 'O primeiro grupo morre em ' + Math.round(menor) + ' h.</p>' : '') : '') +
      cur.map(function (c) { return RP.itemFilaHTML(c); }).join('') + '</div>';
  };
  RP.curarFeridos = function () {
    var n = totalFeridos(), podem = Math.min(n, Math.floor(RP.qtdRecurso('ervas', '*') / ERVAS));
    if (!podem) { RP.aviso({ titulo: 'Sem ervas raras', texto: 'Cada ferido pede ' + ERVAS + ' ervas. Extraia ervas no pântano ou troque com outro reino.', icone: 'ervas', tipo: 'alerta' }); return false; }
    var plano = RP.requisitar({ ervas: podem * ERVAS }, RP.SEDE, 'cura de feridos');
    if (!plano) return false;
    var resta = podem, leva = {};
    D.feridos.sort(function (a, b) { return b.horas - a.horas; });   /* primeiro quem morre antes */
    D.feridos.forEach(function (f) { var t = Math.min(f.qtd, resta); if (t) { leva[f.unidade] = (leva[f.unidade] || 0) + t; f.qtd -= t; resta -= t; } });
    D.feridos = D.feridos.filter(function (f) { return f.qtd > 0; });
    var aguarda = plano.viagens.length ? plano.chegada : 0, fim = Math.max(Date.now(), aguarda) + CURA_SEG * 1000;
    D.curas.push({ rotulo: 'Cura de ' + podem + (podem === 1 ? ' ferido' : ' feridos'), fim: fim, total: CURA_SEG, aguarda: aguarda, leva: leva });
    RP.aviso({ titulo: 'Cura na fila', texto: podem * ERVAS + ' ervas' + (aguarda ? ' a caminho do castelo' : ' no castelo') + '. Os curados voltam à guarnição em ' + RP.fmtResta(fim - Date.now()) + '.', icone: 'ervas', tipo: 'sucesso' });
    ['reino', 'agora'].forEach(RP.invalidarTela);
    return true;
  };
  document.addEventListener('rp:tique', function () {
    var agora = Date.now();
    D.curas = D.curas.filter(function (c) {
      if (c.fim > agora) return true;
      Object.keys(c.leva).forEach(function (k) { D.disponiveis[k] = (D.disponiveis[k] || 0) + c.leva[k]; });
      RP.aviso({ titulo: 'Feridos curados', texto: Object.keys(c.leva).map(function (k) { return c.leva[k] + ' ' + nomeUn(k, c.leva[k]); }).join(', ') + ' de volta à guarnição.', icone: 'ervas', tipo: 'sucesso' });
      ['tropas', 'agora'].forEach(RP.invalidarTela);
      return false;
    });
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-curar]')) return;
    if (RP.curarFeridos()) { var t = e.target.closest('.tela'); if (t) { var box = RP.$('[data-feridos]', t); if (box) box.innerHTML = RP.feridosHTML(); } }
  });

  /* resumo da ferraria para o hub de Tropas */
  RP.ferrariaResumoHTML = function () {
    return '<a class="card linha ferraria-atalho" href="#/ferraria"><span class="ico-placa ico-placa-g">' + RP.icone('ferraria') + '</span><span style="flex:1;min-width:0"><b>Ferraria e eras</b><br><small class="fraco">' + RP.esc(RP.ERAS[eraAtual()].nome) + ' · ' +
      Object.keys(FAM).map(function (f) { var a = nivelLinha(f, 'armas'), d = nivelLinha(f, 'armaduras'); return FAM[f].nome.toLowerCase() + ' +' + a * POR_NIVEL + '% / +' + d * POR_NIVEL + '%'; }).join(' · ') + '</small></span>' + RP.icone('avancar', 'ico-p') + '</a>';
  };
  function eraAtual() { return RP.eraFeita('cerco') ? 'cerco' : RP.eraFeita('aco') ? 'aco' : 'ferro'; }

  /* ================================================================ tela Ferraria */
  function filaHTML() {
    var f = D.ferraria.fila;
    return '<div class="card pilha fila-card"><div class="card-titulo" style="margin:0">' + RP.icone('martelo') + '<h3>Fila da ferraria</h3><span class="selo">' + f.length + ' de ' + D.ferraria.vagas + '</span></div>' +
      (f.length ? f.map(RP.itemFilaHTML).join('') + '<p class="fila-termina">' + RP.icone('relogio', 'ico-p') + 'Fila termina ' + RP.fmtHora(RP.fimItem(f[f.length - 1])) + '</p>' : '<p class="fraco">Nada sendo forjado.</p>') +
      '<p class="fraco" style="font-size:var(--fs-2)">Fila própria, separada das obras: uma forja por vez.</p></div>';
  }
  function cardEra(k) {
    var e = RP.ERAS[k], feita = RP.eraFeita(k), emFila = D.ferraria.fila.some(function (q) { return q.era === k; });
    var plano = !feita && !e.inicial ? RP.planoRequisicao(e.custo, 'ferraria') : null;
    return '<div class="card era-card' + (feita ? ' feita' : '') + '"><div class="linha-entre"><b>' + e.nome + '</b>' +
      (feita ? '<span class="selo selo-visivel">' + RP.icone('check') + (e.inicial ? 'Inicial' : 'Feita no dia ' + D.eras[k].dia) + '</span>' : emFila ? '<span class="selo selo-info">Na fila</span>' : '<span class="selo">' + RP.icone('relogio') + RP.fmtDuracao(e.tempo) + '</span>') + '</div>' +
      '<small class="fraco">Libera: ' + RP.esc(e.libera) + '</small>' +
      (!feita && !e.inicial ? '<div class="linha obra-custo">' + RP.custoHTML(e.custo, 1, '*') + '</div>' + reqHTML(e.req) +
        (plano && plano.completo && plano.viagens.length ? '<small class="obra-estoque vem">' + RP.icone('carroca', 'ico-p') + RP.esc(RP.textoPlano(plano, 'ferraria')) + '</small>' : '') +
        (emFila ? '' : '<button type="button" class="btn btn-p btn-primario' + (reqOk(e.req) && plano.completo ? '' : ' btn-inativo') + '" data-pesquisar="' + k + '">' + RP.icone('ferraria') + 'Pesquisar</button>') : '') + '</div>';
  }
  function cardFamilia(f) {
    var F = FAM[f];
    return '<div class="card pilha fam-card"><div class="card-titulo" style="margin:0"><span class="ico-placa">' + RP.icone(F.icone) + '</span><h3>' + F.nome + '</h3><small class="fraco">' + F.unidades.map(function (u) { return U.unidade(u).nome.toLowerCase(); }).join(', ') + '</small></div>' +
      Object.keys(LINHA).map(function (l) {
        var nv = nivelLinha(f, l), fila = naFila(f, l), prox = nv + fila, N = NIVEIS[prox], L = LINHA[l];
        var trilha = '<span class="trilha-niveis" role="img" aria-label="' + L.nome + ' nível ' + nv + ' de 3">' + [1, 2, 3].map(function (i) { return '<i class="' + (i <= nv ? 'on' : i <= prox ? 'fila' : '') + '"></i>'; }).join('') + '</span>';
        return '<div class="linha-forja"><div class="linha-entre"><span class="linha">' + RP.icone(L.icone, 'ico-p') + '<b>' + L.nome + '</b>' + trilha + '</span><span class="num">+' + nv * POR_NIVEL + '% ' + L.efeito + '</span></div>' +
          (N ? '<div class="linha obra-custo">' + RP.custoHTML(N.custo, 1, '*') + '<span class="tempo">' + RP.icone('relogio', 'ico-p') + RP.fmtDuracao(N.tempo) + '</span></div>' +
            (reqOk(N.req) ? '' : reqHTML(N.req)) +
            '<button type="button" class="btn btn-p' + (reqOk(N.req) ? '' : ' btn-inativo') + '" data-forjar="' + f + ':' + l + '">' + RP.icone('martelo') + 'Forjar nível ' + (prox + 1) + (fila ? ' (depois da fila)' : '') + '</button>'
            : '<small class="fraco">Nível máximo' + (fila ? ' (na fila)' : '') + '.</small>') + '</div>';
      }).join('') + '</div>';
  }
  function cardLendario() {
    var req = [['era', 'aco'], ['ferraria', 8]], min = Math.floor(RP.qtdRecurso('minerio', '*')), custo = { minerio: 100, ferro: 1500, aco: 100 };
    var jz = W.jazida('j-minerio'), conhecida = jz && W.estado(jz.c, jz.l).v !== 'desconhecido';
    return '<div class="card pilha lend-card"><div class="card-titulo" style="margin:0"><span class="ico-placa">' + RP.icone('minerio', 'r-minerio') + '</span><h3>Equipamento lendário</h3><span class="selo">1 por reino</span></div>' +
      '<p class="suave" style="font-size:var(--fs-2)">Forjado com minério raro: <b>+25% de ataque ou de defesa</b> para um exército de até 50 tropas (num exército maior, o bônus se dilui). Se o exército for derrotado, o equipamento fica no campo e o vencedor o leva.</p>' +
      '<div class="linha obra-custo">' + RP.custoHTML(custo, 1, '*') + '<span class="tempo">' + RP.icone('relogio', 'ico-p') + '24 h</span></div>' + reqHTML(req) +
      '<small class="fraco">Minério raro no reino: ' + min + ' de 100.' + (conhecida ? ' Há um veio conhecido no mapa.' : '') + '</small>' +
      '<div class="linha" style="flex-wrap:wrap">' + (conhecida ? '<a class="btn btn-p" href="#/extracao?jazida=j-minerio">' + RP.icone('picareta') + 'Extrair minério raro</a>' : '') +
      '<button type="button" class="btn btn-p' + (reqOk(req) && min >= 100 ? '' : ' btn-inativo') + '" data-forjar-lendario>' + RP.icone('lendario') + 'Forjar</button></div>' +
      (D.lendario.vistos.length ? '<div class="secao-titulo" style="margin:var(--esp-2) 0 0">Vistos em outros reinos</div>' + D.lendario.vistos.map(function (v) {
        return '<div class="linha">' + RP.brasao(D.reinos[v.reino].brasao, { tamanho: 26 }) + '<span style="flex:1;min-width:0"><b>' + RP.esc(v.nome) + '</b> · +25% ' + v.tipo + '<br><small class="fraco">' + RP.esc(D.reinos[v.reino].nome) + ' · ' + RP.esc(v.exercito) + ' · espionado ' + RP.fmtHa(v.horas) + '</small></span></div>';
      }).join('') + '<p class="fraco" style="font-size:var(--fs-2)">Derrotar esse exército deixa o equipamento no campo para você levar.</p>' : '') + '</div>';
  }
  function cardTeto() {
    var exemplos = [['Guarnição do castelo, atacando', { lanceiro: 20, arqueiro: 15 }, 'ataque', 'castelo'], ['Guarda da Vila do Moinho, defendendo', { lanceiro: 12 }, 'defesa', 'vila-moinho']];
    return '<div class="card pilha"><div class="card-titulo" style="margin:0">' + RP.icone('escudo') + '<h3>Teto de bônus: +' + TETO + '%</h3></div>' +
      '<p class="suave" style="font-size:var(--fs-2)">Armas e armaduras, veterania, relíquias, equipamento lendário e legado somam no máximo +' + TETO + '%. Sem o teto, tudo junto passaria de +80%. Torres e portões ficam fora do teto.</p>' +
      '<div class="lista">' + exemplos.map(function (x) {
        var b = RP.bonusGrupo(x[1], x[2], x[3]);
        return '<div class="lista-item"><span style="flex:1;min-width:0"><b>' + x[0] + '</b><br><small class="fraco">' + RP.esc(RP.bonusTxt(b)) + '</small></span><b class="num">+' + Math.round(b.total) + '%</b></div>';
      }).join('') + '</div></div>';
  }
  function desenhar(el) {
    var x = W.local('ferraria');
    RP.$('.topo small', el).textContent = x.nome + ' · nível ' + x.nivel + ' · ' + RP.ERAS[eraAtual()].nome;
    RP.$('.fer-conteudo', el).innerHTML = filaHTML() +
      '<div class="secao-titulo">Eras</div><div class="pilha">' + ['ferro', 'aco', 'cerco'].map(cardEra).join('') + '</div>' +
      '<div class="secao-titulo">Armas e armaduras</div><p class="fraco" style="font-size:var(--fs-2);margin-bottom:var(--esp-2)">+' + POR_NIVEL + '% por nível, até o nível 3, para cada família. O nível 1 rende mais que recrutar só com exércitos grandes (≈ 200 a 375 tropas da família), mas não ocupa população.</p>' +
      '<div class="pilha">' + Object.keys(FAM).map(cardFamilia).join('') + '</div>' +
      '<div class="secao-titulo">Lendário</div>' + cardLendario() +
      '<div class="secao-titulo">Bônus de combate</div>' + cardTeto() + '<div style="height:var(--esp-8)"></div>';
  }
  function enfileirar(item, custo, tempo, rot) {
    var f = D.ferraria.fila;
    if (f.length >= D.ferraria.vagas) { RP.aviso({ titulo: 'Fila da ferraria cheia', texto: 'Espere uma forja terminar.', icone: 'relogio', tipo: 'alerta' }); return false; }
    var plano = RP.requisitar(custo, 'ferraria', rot);
    if (!plano) { RP.aviso({ titulo: 'Recursos insuficientes', texto: RP.textoPlano(RP.planoRequisicao(custo, 'ferraria'), 'ferraria'), icone: 'alerta', tipo: 'perigo' }); return false; }
    var aguarda = plano.viagens.length ? plano.chegada : 0, fim = RP.fimNaFila(f, tempo, aguarda);
    f.push(Object.assign(item, { rotulo: rot, fim: fim, total: tempo, aguarda: aguarda }));
    RP.aviso({ titulo: rot + ' na fila', texto: aguarda ? 'O material chega em ' + RP.fmtResta(aguarda - Date.now()) + '.' : 'Termina ' + RP.fmtHora(fim) + '.', icone: aguarda ? 'carroca' : 'martelo', tipo: 'sucesso' });
    RP.invalidarTela('tropas');
    return true;
  }
  RP.registrarTela('ferraria', {
    secao: 'reino',
    montar: function (el) {
      el.innerHTML = U.topo('Ferraria e eras', 'reino', 'Ferraria do Rei') + '<div class="conteudo-tela fer-conteudo"></div>';
      el.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-pesquisar]'))) {
          var k = b.getAttribute('data-pesquisar'), era = RP.ERAS[k];
          if (!reqOk(era.req)) { RP.aviso({ titulo: 'Falta requisito', texto: requisitos(era.req).filter(function (r) { return !r.ok; }).map(function (r) { return r.txt; }).join(', ') + '.', icone: 'cadeado', tipo: 'alerta' }); return; }
          if (enfileirar({ era: k }, era.custo, era.tempo, era.nome)) desenhar(el);
          return;
        }
        if ((b = e.target.closest('[data-forjar]'))) {
          var p = b.getAttribute('data-forjar').split(':'), f = p[0], l = p[1], prox = nivelLinha(f, l) + naFila(f, l), N = NIVEIS[prox];
          if (!N) return;
          if (!reqOk(N.req)) { RP.aviso({ titulo: 'Falta requisito', texto: requisitos(N.req).filter(function (r) { return !r.ok; }).map(function (r) { return r.txt; }).join(', ') + '.', icone: 'cadeado', tipo: 'alerta' }); return; }
          if (enfileirar({ fam: f, linha: l, para: prox + 1 }, N.custo, N.tempo, LINHA[l].nome + ' de ' + FAM[f].nome.toLowerCase() + ' → nível ' + (prox + 1))) desenhar(el);
          return;
        }
        if (e.target.closest('[data-forjar-lendario]')) {
          RP.aviso({ titulo: 'Ainda não dá', texto: 'Precisa da ferraria nível 8 e de 100 de minério raro no reino.', icone: 'cadeado', tipo: 'alerta' });
        }
      });
    },
    entrar: function (el) { desenhar(el); }
  });
})();
