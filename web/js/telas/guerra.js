/* Reino de Pedra — Guerra (combate, parte 2): feridos e cura, selo de veterania, queda do castelo e exílio (#/exilio),
   interceptação (#/interceptar), avistamentos de forças desconhecidas no mapa, "Repetir último ataque" e as tropas do
   último ataque como padrão da ordem rápida. Porte de prototipo/js/ferraria.js (feridos, veterania), acoes.js (Tropas),
   legado.js (exílio) e reliquias.js (interceptar), com os dados do servidor:
   GET /feridos, POST /feridos/curar, POST /interceptacao/previa e /interceptacao, GET /exilio, POST /exilio/visto. */
(function () {
  'use strict';
  var RP = window.RP, H = RP.hex;
  function linha(r, v) { return '<div class="info-linha"><span class="fraco">' + r + '</span><span>' + v + '</span></div>'; }
  function semMilicia(g) {
    var d = {};
    Object.keys(g || {}).forEach(function (k) { var u = RP.unidade(k); if (g[k] > 0 && (!u || u.so !== 'defesa')) d[k] = g[k]; });
    return d;
  }

  /* ================================================================ veterania */
  RP.veterania = function (marcas) {
    var v = (RP.reino && RP.reino.veterania) || { marcas: [2, 5, 9], bonus: [0.05, 0.1, 0.15] }, n = 0;
    v.marcas.forEach(function (m, i) { if (marcas + 1e-9 >= m) n = i + 1; });
    return { marcas: marcas, nivel: n, bonus: n ? Math.round(v.bonus[n - 1] * 100) : 0, prox: n < v.marcas.length ? v.marcas[n] : null, nome: n ? 'Veterana ' + ['I', 'II', 'III'][n - 1] : 'Sem veterania' };
  };
  RP.seloVeterania = function (marcas) {
    var v = RP.veterania(marcas || 0), m = Math.floor((marcas || 0) * 10) / 10;
    return '<span class="selo vet-selo' + (v.nivel ? ' selo-destaque' : '') + '" title="' + (v.prox ? 'Próximo nível com ' + v.prox + ' marcas' : 'Nível máximo') + '">' + RP.icone('estandarte') + v.nome +
      (v.nivel ? ' · +' + v.bonus + '%' : '') + ' · ' + String(m).replace('.', ',') + (m === 1 ? ' marca' : ' marcas') + '</span>';
  };
  function marcasLocal(id) { var v = RP.reino && RP.reino.veterania; return v && v.locais ? v.locais[id] || 0 : 0; }
  function marcasExercito(id) { var v = RP.reino && RP.reino.veterania; return v && v.exercitos ? v.exercitos[id] || 0 : 0; }
  RP.extrasGuarnicao = RP.extrasGuarnicao || [];
  RP.extrasGuarnicao.push(function (l) { var m = marcasLocal(l.id); return m > 0 ? '<div class="linha">' + RP.seloVeterania(m) + '</div>' : ''; });
  RP.extrasExercito = RP.extrasExercito || [];
  RP.extrasExercito.push(function (e) { var m = marcasExercito(e.id); return m > 0 ? RP.seloVeterania(m) : ''; });
  RP.extrasFolhaExercito = RP.extrasFolhaExercito || [];
  RP.extrasFolhaExercito.push(function (e) { return linha('Veterania', RP.seloVeterania(marcasExercito(e.id))); });
  RP.extrasFolhaLocal = RP.extrasFolhaLocal || [];
  RP.extrasFolhaLocal.push(function (l) { return RP.somaGrupo(l.guarnicao) ? linha('Veterania', RP.seloVeterania(marcasLocal(l.id))) : ''; });
  RP.extrasCardLocal = RP.extrasCardLocal || [];
  RP.extrasCardLocal.push(function (l) { var m = marcasLocal(l.id); return m > 0 && RP.veterania(m).nivel ? RP.seloVeterania(m) : ''; });

  /* ================================================================ feridos (card em Tropas) */
  var feridos = null, buscandoF = false, chaveF = '';
  function buscarFeridos() {
    if (buscandoF) return;
    buscandoF = true;
    RP.get('/feridos').then(function (f) {
      buscandoF = false; feridos = f;
      RP.$$('[data-feridos]').forEach(function (c) { c.innerHTML = feridosHTML(); });
    }, function () { buscandoF = false; });
  }
  function feridosHTML() {
    var f = feridos;
    if (!f || (!f.total && !f.emCura)) return '';
    var n = f.total, podem = f.podem, por = f.porFerido, cur = (f.cura || []);
    var menor = f.lotes.length ? Math.min.apply(null, f.lotes.map(function (l) { return l.morreEm; })) : 0;
    return '<div class="card pilha feridos-card"><div class="card-titulo" style="margin:0">' + RP.icone('ferido', 'r-ervas') + '<h3>Feridos</h3>' + (n ? '<span class="selo selo-perigo">' + n + '</span>' : '') + '</div>' +
      (n ? '<div class="lista">' + f.lotes.map(function (l) {
        return '<div class="lista-item"><span class="ico-placa">' + RP.icone(RP.iconeUnidade(Object.keys(l.unidades)[0])) + '</span><span style="flex:1;min-width:0"><b>' + RP.esc(RP.partesGrupo(l.unidades)) + '</b><br><small class="fraco">' +
          RP.esc(l.origem) + ' · morrem em <span data-fim="' + l.morreEm + '">' + RP.fmtResta(l.morreEm - RP.agora()) + '</span> sem ervas</small></span></div>';
      }).join('') + '</div>' +
        '<p class="fraco" style="font-size:var(--fs-2)">' + Math.round(f.frac * 100) + '% das baixas de quem vence, ou recua pela tática, voltam feridos. Cada um é curado no castelo com ' + por + ' ervas raras em ' + RP.fmtDuracao(f.curaSeg).trim() +
        '. Ervas no reino: <b>' + RP.num(f.ervas) + '</b>' + (podem < n ? ', dá para ' + podem + ' de ' + n + '.' : '.') + '</p>' +
        '<button type="button" class="btn btn-p btn-primario' + (podem ? '' : ' btn-inativo') + '" data-curar>' + RP.icone('ervas') + 'Curar ' + (podem || '') + (podem === 1 ? ' ferido' : ' feridos') + ' · ' + RP.num(podem * por) + ' ervas</button>' +
        (menor && menor - RP.agora() < 6 * 3600000 ? '<p class="nota-antiga">' + RP.icone('alerta', 'ico-p') + '<span>O primeiro grupo morre em ' + RP.fmtResta(menor - RP.agora()) + '.</span></p>' : '') : '') +
      cur.map(function (i) { i.fila = 'cura'; return RP.itemFilaServidor(i); }).join('') + '</div>';
  }
  RP.extrasTropas = RP.extrasTropas || [];
  RP.extrasTropas.push(function () {
    var r = RP.reino, f = r && r.feridos;
    if (!f || (!f.total && !f.emCura)) { feridos = null; return '<div data-feridos></div>'; }
    var ch = f.total + ':' + f.emCura + ':' + JSON.stringify((r.filas || {}).cura || []).length;
    if (!feridos || ch !== chaveF) { chaveF = ch; buscarFeridos(); }
    return '<div data-feridos>' + feridosHTML() + '</div>';
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-curar]');
    if (!b) return;
    if (!feridos || !feridos.podem) {
      RP.aviso({ titulo: 'Sem ervas raras', texto: 'Cada ferido pede ' + ((feridos && feridos.porFerido) || 5) + ' ervas. Extraia ervas no pântano ou troque com outro reino.', icone: 'ervas', tipo: 'alerta' });
      return;
    }
    RP.tentar(RP.post('/feridos/curar', {})).then(function (it) {
      RP.aviso({ titulo: 'Cura na fila', texto: RP.num(it.custo.ervas) + ' ervas ' + (it.materialCompleto ? 'no castelo' : 'a caminho do castelo') + '. Os curados voltam à guarnição em ' + RP.fmtDuracao(it.duracao) + '.', icone: 'ervas', tipo: 'sucesso' });
      chaveF = ''; RP.recarregarReino(); buscarFeridos();
    });
  });

  /* ================================================================ último ataque: tropas padrão da ordem rápida e "Repetir" */
  RP.grupoPadraoEnvio = function (l) {
    var u = RP.reino && RP.reino.ultimoAtaque; if (!u || !u.tropas) return null;
    var g = {};
    Object.keys(u.tropas).forEach(function (k) { var n = Math.min(u.tropas[k], (l.guarnicao || {})[k] || 0); if (n > 0) g[k] = n; });
    return RP.somaGrupo(g) ? g : null;
  };
  RP.extrasTropas.push(function () {
    var u = RP.reino && RP.reino.ultimoAtaque; if (!u || u.alvoHex == null) return '';
    return '<a class="card linha repetir-card" href="#/envio?alvo=' + u.alvoHex + '&repetir=1' + (u.deLocalId ? '&de=' + u.deLocalId : '') + '"><span class="ico-placa">' + RP.icone('voltar') + '</span><span style="flex:1;min-width:0"><b>Repetir último ataque</b><br><small class="fraco">' +
      RP.esc((u.alvoNome || 'Alvo') + ' · ' + (u.tipoNome || '').toLowerCase() + ' · ' + (u.resumo || '') + ' · mesmos objetivos e tática') + '</small></span>' + RP.icone('avancar', 'ico-p') + '</a>';
  });

  /* ================================================================ faixas no reino: queda, forças vistas, feridos */
  RP.extrasReino = RP.extrasReino || [];
  RP.extrasReino.push(function (r) {
    var h = '', q = r.queda, a = r.avistamentos, f = r.feridos;
    if (q) h += '<a class="faixa-alerta faixa-guerra" href="#/exilio">' + RP.icone('castelo') + '<span class="txt"><b>' + (q.exilio ? 'Seu reino caiu: você recomeça em exílio' : 'Seu castelo caiu') + '</b><br>Veja o que aconteceu e o que ficou com você.</span>' + RP.icone('avancar', 'ico-p') + '</a>';
    if (a && a.n) h += '<a class="faixa-alerta faixa-guerra faixa-avist" href="#/mapa?foco=' + a.hex + '">' + RP.icone('olho') + '<span class="txt"><b>Forças desconhecidas</b><br>' +
      (a.n === 1 ? '1 grupo visto' : a.n + ' grupos vistos') + ' perto do reino · o último ' + RP.fmtHa((RP.agora() - a.quando) / 3600000) + '</span>' + RP.icone('avancar', 'ico-p') + '</a>';
    if (f && f.total) h += '<a class="faixa-alerta faixa-guerra" href="#/tropas">' + RP.icone('ferido') + '<span class="txt"><b>' + f.total + (f.total === 1 ? ' ferido esperando ervas' : ' feridos esperando ervas') + '</b><br>' +
      (f.morreEm ? 'os primeiros morrem em <span data-fim="' + f.morreEm + '">' + RP.fmtResta(f.morreEm - RP.agora()) + '</span> sem cura' : '') + '</span>' + RP.icone('avancar', 'ico-p') + '</a>';
    return h;
  });
  /* depois de cair em exílio, a primeira tela é a do exílio */
  var levouAoExilio = false;
  document.addEventListener('rp:reino', function () {
    var q = RP.reino && RP.reino.queda;
    if (!q || !q.exilio || levouAoExilio) return;
    levouAoExilio = true;
    if (document.documentElement.getAttribute('data-tela') !== 'exilio') RP.ir('exilio');
  });

  /* ================================================================ Exílio (#/exilio) */
  function cenaRuina() {
    return '<svg class="cena" viewBox="0 0 390 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">' +
      '<defs><linearGradient id="ceu-exilio" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14161c"/><stop offset=".7" stop-color="#3a2a2a"/><stop offset="1" stop-color="#6b3b26"/></linearGradient></defs>' +
      '<rect width="390" height="300" fill="url(#ceu-exilio)"/>' +
      '<path d="M0 230 50 196 90 214 140 180 190 206 240 176 300 210 340 192 390 214V300H0Z" fill="#1d1f24"/>' +
      '<path d="M0 300V244C70 236 140 224 195 222 260 220 320 232 390 240V300Z" fill="#121418"/>' +
      '<path d="M128 226V178H134V186H138V172H146V196H156V214H164V206H170V214H180V190L186 184 192 192V214H204V200L212 196 216 204V214H226V184H232V178H238V190L244 186 250 194V226Z" fill="#0b0c0f"/>' +
      '<path d="M180 190 186 184 192 192M138 172 146 172" stroke="#3b3f46" stroke-width="1.5" fill="none"/>' +
      '<g class="exilio-fumaca"><circle cx="186" cy="170" r="9"/><circle cx="194" cy="150" r="13"/><circle cx="184" cy="124" r="17"/><circle cx="198" cy="94" r="22"/></g>' +
      '<g class="cena-brasas"><circle cx="170" cy="200" r="1.4"/><circle cx="200" cy="190" r="1.1"/><circle cx="220" cy="205" r="1.6"/><circle cx="150" cy="210" r="1.2"/><circle cx="235" cy="195" r="1"/></g>' +
      '</svg>';
  }
  function perdidosHTML(rec) {
    var ks = Object.keys(rec || {}); if (!ks.length) return '<span class="fraco">nada</span>';
    return '<span class="custos">' + ks.map(function (k) { return '<span class="custo falta-perda">' + RP.icone(k, 'ico-p r-' + k) + '−' + RP.numCurto(rec[k]) + '</span>'; }).join('') + '</span>';
  }
  function desenharExilio(el, x) {
    if (!x) {
      RP.$('.exilio-conteudo', el).innerHTML = '<div class="exilio-titulo"><h1>Nada caiu</h1><p class="suave">Seu castelo está de pé.</p></div><a class="btn btn-p" href="#/reino">' + RP.icone('castelo') + 'Meu reino</a>';
      RP.$('.exilio-rodape', el).hidden = true;
      return;
    }
    var mantido = (x.reliquiasMantidas || []).map(function (n) { return 'Relíquia ' + n; }).concat(['Exércitos em campo e o que carregam', 'Linhagem, títulos e brasão']);
    var atk = x.atacanteReino ? RP.brasao(x.atacanteReino.brasao, { tamanho: 32 }) + '<span><b>Reino de ' + RP.esc(x.atacanteReino.nome) + '</b><br><small class="fraco">identificado pelo estandarte</small></span>'
      : RP.brasao(null, { tamanho: 32, desconhecido: true }) + '<span><b>Forças desconhecidas</b><br><small class="fraco">sem estandarte · batedores podem descobrir quem foi</small></span>';
    var h = '<div class="exilio-titulo"><span class="rotulo">Temporada ' + x.temporada + ' · dia ' + x.dia + '</span><h1>' + (x.exilio ? 'Seu reino caiu' : 'Seu castelo caiu') + '</h1>' +
      '<p class="suave">O ' + RP.esc(x.casteloAntigo) + ' (nível ' + x.nivelAntigo + ') caiu num cerco' + (x.exilio ? ' e o reino não tinha outros locais.' : ' e virou ruína.') + '</p></div>' +
      '<div class="card linha atacante">' + atk + '</div>';
    if (x.exilio) {
      h += '<div class="card card-moldura pilha"><h2>Você recomeça em exílio</h2>' +
        '<div class="exilio-item">' + RP.icone('bussola') + '<span><b>Um novo ponto do mapa</b><br><small class="fraco">' + (RP.reino && RP.reino.legado && RP.reino.legado.regiaoExilio ? 'Na região escolhida pela sua linhagem (' + RP.esc(RP.reino.legado.regiaoExilio) + ').' : 'Região aleatória, longe de quem derrubou você. A escolha da região vem com a linhagem (veja Temporada e legado).') + '</small></span></div>' +
        '<div class="exilio-item">' + RP.icone('castelo') + '<span><b>Kit de recomeço</b><br>' + RP.custoHTML(x.kit) + '<br><small class="fraco">' + RP.esc(RP.partesGrupo(x.kitTropas) || '') + ' · castelo nível 1</small></span></div>' +
        '<div class="exilio-item">' + RP.icone('escudo') + '<span><b>Escudo temporário · ' + x.escudoH + ' h</b><br><small class="fraco">' + (x.escudoAte > RP.agora() ? 'Termina em <span data-fim="' + x.escudoAte + '">' + RP.fmtResta(x.escudoAte - RP.agora()) + '</span>. ' : '') + 'Quem atacar seus locais só descobre ao chegar e volta sem combate.</small></span></div></div>' +
        '<div class="card pilha"><span class="rotulo">Fica com você</span><ul class="regras-lista">' + mantido.map(function (m) { return '<li>' + RP.icone('check', 'ico-p r-ervas') + RP.esc(m) + '</li>'; }).join('') + '</ul></div>' +
        '<p class="fraco" style="font-size:var(--fs-2)">Se ainda houvesse outros locais, não haveria exílio: o castelo viraria ruína e a sede iria para o local de maior nível, com ' + Math.round(x.regras.nivel * 100) + '% do nível do castelo. O reino perderia ' + Math.round(x.regras.recursos * 100) + '% dos recursos guardados, ' + Math.round(x.regras.populacao * 100) + '% da população civil e as relíquias do castelo.</p>';
    } else {
      h += '<div class="card card-moldura pilha"><h2>A sede mudou</h2>' +
        '<div class="exilio-item">' + RP.icone('castelo') + '<span><b>' + RP.esc(x.novoCastelo) + ' · nível ' + x.nivelNovo + '</b><br><small class="fraco">O local de maior nível virou castelo, com ' + Math.round(x.regras.nivel * 100) + '% do nível do antigo. Locais acima dele ficam como estão, mas só sobem quando o castelo passar deles.</small></span></div>' +
        '<div class="exilio-item">' + RP.icone('carroca') + '<span><b>Recursos perdidos</b><br>' + perdidosHTML(x.recursosPerdidos) + '<br><small class="fraco">' + Math.round(x.regras.recursos * 100) + '% do que estava guardado</small></span></div>' +
        '<div class="exilio-item">' + RP.icone('populacao') + '<span><b>População perdida · ' + RP.num(x.populacaoPerdida) + '</b><br><small class="fraco">' + Math.round(x.regras.populacao * 100) + '% da população civil</small></span></div></div>';
    }
    if (x.reliquiasLevadas && x.reliquiasLevadas.length) h += '<p class="nota-antiga nota-perigo">' + RP.icone('lendario', 'ico-p') + '<span>Relíquias levadas pelo atacante: <b>' + RP.esc(x.reliquiasLevadas.join(', ')) + '</b>. Elas viajam com as tropas e podem ser interceptadas no caminho.</span></p>';
    h += '<div style="height:120px"></div>';
    RP.$('.exilio-conteudo', el).innerHTML = h;
    var rod = RP.$('.exilio-rodape', el);
    rod.hidden = false;
    rod.innerHTML = (x.relatorioId ? '<a class="btn btn-p btn-fantasma" href="#/relatorio?id=' + x.relatorioId + '">' + RP.icone('relatorios') + 'Ver o que aconteceu</a>' : '') +
      '<button type="button" class="btn btn-primario btn-bloco btn-grande" data-recomecar>' + RP.icone(x.exilio ? 'bandeira' : 'castelo') + (x.exilio ? 'Recomeçar em exílio' : 'Ver meu reino') + '</button>';
  }
  var exilio = null;
  RP.registrarTela('exilio', {
    montar: function (el) {
      el.innerHTML = '<div class="exilio-cena">' + cenaRuina() + '</div><div class="conteudo-tela exilio-conteudo pilha-4"><p class="fraco">Carregando…</p></div>' +
        '<div class="rodape-acao rodape-com-resumo exilio-rodape" hidden></div>';
      el.addEventListener('click', function (e) {
        if (!e.target.closest('[data-recomecar]')) return;
        var x = exilio;
        RP.post('/exilio/visto').catch(function () { /* offline */ }).then(function () { RP.recarregarReino(); });
        if (!x || !x.exilio) { RP.ir('reino'); return; }
        RP.modal({
          topo: '<div class="modal-brasao">' + RP.iconeReino(RP.reino, 72) + '</div>',
          titulo: 'Novo começo',
          corpo: '<p class="suave">Um novo castelo foi erguido em outra região. Linhagem, relíquias e títulos seguem com você.</p><p class="selo selo-visivel" style="margin-top:var(--esp-3)">' + RP.icone('escudo') + 'Escudo temporário ativo · ' + x.escudoH + ' h</p>',
          acoes: [{ rotulo: RP.icone('castelo') + 'Ver meu reino', classe: 'btn-primario', acao: function () { RP.ir('reino'); } }],
          fecharFora: false
        });
      });
    },
    entrar: function (el) {
      RP.get('/exilio').then(function (x) { exilio = x; desenharExilio(el, x); }, function (e) { RP.$('.exilio-conteudo', el).innerHTML = '<p class="fraco">' + RP.esc(e.message) + '</p>'; });
    }
  });
  var iconeRel = RP.iconeRelatorio;
  RP.iconeRelatorio = function (t) { return t === 'queda' ? 'castelo' : iconeRel(t); };
  RP.desenhosRelatorio = RP.desenhosRelatorio || {};
  RP.desenhosRelatorio.queda = function (rel) {
    var d = rel.dados || {};
    return (d.resumo ? '<p class="suave">' + RP.esc(d.resumo) + '</p>' : '') +
      '<div class="info">' + (d.linhas || []).map(function (l) { return linha(RP.esc(l.rotulo), RP.esc(l.valor)); }).join('') + '</div>' +
      '<div class="linha rel-acoes"><a class="btn btn-p btn-primario" href="#/exilio">' + RP.icone('castelo') + (d.exilio ? 'Exílio' : 'O que aconteceu') + '</a>' +
      (d.hex != null ? '<a class="btn btn-p" href="#/mapa?foco=' + d.hex + '">' + RP.icone('mapa') + 'Novo castelo no mapa</a>' : '') + '</div>';
  };

  /* ================================================================ Interceptar (#/interceptar?marcha=<id>) */
  var INTERCEPTAVEIS = { exercito: 1, carregadores: 1, caravana: 1 };
  function objetosHex(h, dados) { return (dados && dados.porHex && dados.porHex[h]) || []; }
  RP.mapa.acoesFolhaHex.push(function (h, dados) {
    if (RP.envio && RP.envio.ativo()) return '';
    return RP.mapa.marchasEm(h, dados).filter(function (o) { return o.tipo === 'marcha' && o.dono !== 'meu' && INTERCEPTAVEIS[o.marcha] && o.id; }).map(function (o) {
      return '<a class="btn btn-p btn-primario" href="#/interceptar?marcha=' + o.id + '">' + RP.icone('alvo') + 'Interceptar</a>';
    }).join('');
  });
  var it = null, itTimer = null, itSeq = 0;
  function itOrigens() {
    return (RP.tropas ? RP.tropas.locais : []).filter(function (l) { return RP.somaGrupo(semMilicia(l.guarnicao)) > 0; });
  }
  function itDisp() { var l = (RP.tropas ? RP.tropas.locais : []).filter(function (x) { return x.id === it.de; })[0]; return l ? semMilicia(l.guarnicao) : {}; }
  function itGrupoPadrao() {
    var d = itDisp(), g = {};
    /* a mais rápida primeiro: cavalaria alcança quase tudo */
    ['elite', 'cavalaria'].forEach(function (k) { if (d[k]) g[k] = d[k]; });
    if (!RP.somaGrupo(g)) Object.keys(d).forEach(function (k) { if (d[k] > 0 && k !== 'ariete' && k !== 'trebuchet') g[k] = Math.max(1, Math.floor(d[k] / 2)); });
    return g;
  }
  function itPrevia(el) {
    clearTimeout(itTimer);
    itTimer = setTimeout(function () {
      var meu = ++itSeq;
      RP.post('/interceptacao/previa', { marchaId: it.marcha, deLocalId: it.de, tropas: it.grupo }).then(function (p) {
        if (meu !== itSeq || !it) return;
        it.previa = p; it.erro = null; desenharInterceptar(el);
      }, function (e) { if (meu !== itSeq || !it) return; it.erro = e.message; desenharInterceptar(el); });
    }, 180);
  }
  function desenharInterceptar(el) {
    var cont = RP.$('.it-conteudo', el); if (!cont || !it) return;
    var p = it.previa;
    RP.$('.rodape-acao', el).hidden = !p && !!it.erro;
    if (!p) { cont.innerHTML = it.erro ? '<p class="txt-alerta">' + RP.esc(it.erro) + '</p><a class="btn btn-p" href="#/mapa">' + RP.icone('mapa') + 'Mapa</a>' : '<p class="fraco">Carregando…</p>'; itRodape(el); return; }
    var a = p.alvo, n = RP.somaGrupo(it.grupo), enc = p.encontro, ors = itOrigens(), agora = RP.agora();
    var h = (it.erro ? '<p class="nota-antiga nota-perigo">' + RP.icone('alerta', 'ico-p') + '<span>' + RP.esc(it.erro) + '</span></p>' : '') +
      (p.bloqueio ? '<div class="faixa-alerta">' + RP.icone('alerta') + '<span class="txt"><b>Não dá para enviar</b><br>' + RP.esc(p.bloqueio) + '</span></div>' : '') +
      '<div class="card linha atacante">' + RP.brasao(null, { tamanho: 40, desconhecido: true }) + '<span style="flex:1;min-width:0"><b>Forças desconhecidas</b><br><small class="fraco">' +
      RP.esc(a.nome.charAt(0).toUpperCase() + a.nome.slice(1)) + ' · ' + RP.esc(a.tamanho) + ' tropas' + (a.rumo ? ' · rumo ao ' + RP.esc(a.rumo) : '') + '</small></span>' +
      '<a class="btn btn-p btn-fantasma" href="#/mapa?foco=' + a.hex + '">' + RP.icone('mapa') + 'Mapa</a></div>' +
      (a.carga ? '<div class="card linha" style="margin-top:var(--esp-3)"><span class="ico-placa">' + RP.icone('carroca') + '</span><span style="flex:1"><b>Levam carga</b><br><small class="fraco">Se vencerem, suas tropas trazem o que couber na carga delas.</small></span></div>' : '') +
      (a.some ? '<p class="nota-antiga nota-perigo" style="margin-top:var(--esp-3)">' + RP.icone('alerta', 'ico-p pulso') + '<span>Somem na névoa em <b class="num" data-fim="' + a.some + '">' + RP.fmtResta(a.some - agora) + '</b>. Depois disso, só a espionagem acha ' + (a.carga ? 'a carga' : 'essas forças') + '.</span></p>'
        : '<p class="nota-antiga" style="margin-top:var(--esp-3)">' + RP.icone('olho', 'ico-p') + '<span>Seguem à vista até chegar' + (a.chegada ? ', em <b class="num" data-fim="' + a.chegada + '">' + RP.fmtResta(a.chegada - agora) + '</b>' : '') + '.</span></p>') +
      '<div class="nota-regra" style="margin-top:var(--esp-3)">' + RP.icone('alvo', 'ico-p') + '<span>Suas tropas vão a um ponto do caminho <b>antes</b> deles e esperam. Se vencerem, trazem a carga e as relíquias de volta, e na volta elas também podem ser interceptadas. Se eles mudarem de rota, a interceptação falha.</span></div>' +
      '<div class="secao-titulo">1. Tropas</div>' +
      (ors.length > 1 ? '<div class="abas abas-rolagem envio-origens" role="group" aria-label="De onde saem">' + ors.map(function (x) {
        return '<button type="button" class="aba" data-it-de="' + x.id + '" aria-pressed="' + (x.id === it.de) + '">' + RP.esc(x.nome) + '</button>';
      }).join('') + '</div>' : '') +
      '<div class="card pilha" data-it-grupo>' + (ors.length ? RP.grupoTropas.linhas(it.grupo, itDisp()) : '<p class="fraco">Nenhuma tropa que ataca. Milícia só defende.</p>') +
      '<div class="ext-numeros"><div><span class="fraco">Tropas</span><b class="num">' + n + '</b></div><div><span class="fraco">Ataque</span><b class="num">' + RP.num(p.forca) + '</b></div>' +
      '<div><span class="fraco">Velocidade</span><b>' + RP.esc(RP.VELOCIDADES[p.vel] || p.vel) + '</b></div></div>' +
      '<p class="fraco" style="font-size:var(--fs-2)">Eles: ' + RP.esc(a.tamanho) + ' tropas. Tropas lentas podem não alcançar. Tática média: recuam com ' + Math.round(((p.taticas || {}).media || 0.4) * 100) + '% de baixas.</p></div>' +
      '<div class="secao-titulo">2. Ponto de encontro</div>' +
      (!n ? '<p class="fraco">Escolha as tropas para calcular onde alcançam.</p>'
        : enc ? '<div class="card pilha it-encontro"><div class="linha"><span class="ico-placa">' + RP.icone('alvo') + '</span><span style="flex:1;min-width:0"><b>Hexágono ' + enc.c + ', ' + enc.l + '</b><br><small class="fraco">' + enc.hexes + ' hexágonos pela rota curta</small></span>' +
          '<a class="btn btn-p btn-fantasma" href="#/mapa?foco=' + enc.hex + '">' + RP.icone('mapa') + 'Ver</a></div>' +
          '<div class="ext-numeros"><div><span class="fraco">Vocês chegam</span><b class="num">' + RP.fmtDuracao(Math.round((enc.nos - p.agora) / 1000)) + '</b></div><div><span class="fraco">Eles passam</span><b class="num">' + RP.fmtDuracao(Math.round((enc.eles - p.agora) / 1000)) + '</b></div>' +
          '<div><span class="fraco">Folga</span><b class="num">' + RP.fmtDuracao(Math.round(enc.folga / 1000)) + '</b></div></div></div>'
        : '<p class="nota-antiga">' + RP.icone('relogio', 'ico-p') + '<span><b>Não alcançam a tempo.</b> Com velocidade ' + RP.esc((RP.VELOCIDADES[p.vel] || p.vel || '').toLowerCase()) + ', eles passam antes. Tire as unidades lentas ou use cavalaria.</span></p>') +
      '<div style="height:var(--esp-8)"></div>';
    cont.innerHTML = h;
    itRodape(el);
  }
  function itRodape(el) {
    var p = it && it.previa, enc = p && p.encontro, n = it ? RP.somaGrupo(it.grupo) : 0;
    RP.$('.rodape-resumo', el).innerHTML = enc && n ? '<div class="resumo-linha"><b>Interceptar · ' + RP.esc(RP.partesGrupo(it.grupo)) + '</b><span class="tempo">' + RP.icone('relogio', 'ico-p') + 'chegam em ' + RP.fmtDuracao(Math.round((enc.nos - p.agora) / 1000)) + '</span></div>'
      : '<div class="resumo-linha fraco">' + (!p ? '' : n ? 'Sem ponto de encontro a tempo.' : 'Escolha as tropas.') + '</div>';
    RP.$('[data-interceptar]', el).classList.toggle('btn-inativo', !(enc && n && !p.bloqueio));
  }
  RP.registrarTela('interceptar', {
    secao: 'tropas',
    montar: function (el) {
      el.innerHTML = RP.topoVoltar('Interceptar', 'mapa', 'Alcançar no meio do caminho') + '<div class="conteudo-tela it-conteudo"></div>' +
        '<div class="rodape-acao rodape-com-resumo"><div class="rodape-resumo"></div><button type="button" class="btn btn-primario btn-bloco btn-grande" data-interceptar>' + RP.icone('alvo') + 'Enviar para interceptar</button></div>';
      el.addEventListener('click', function (e) {
        if (!it) return;
        var b;
        if ((b = e.target.closest('[data-it-de]'))) { it.de = +b.getAttribute('data-it-de'); it.grupo = itGrupoPadrao(); itPrevia(el); desenharInterceptar(el); return; }
        if (e.target.closest('[data-it-grupo]') && RP.grupoTropas.clique(e, it.grupo, itDisp())) { itPrevia(el); desenharInterceptar(el); return; }
        if (!e.target.closest('[data-interceptar]')) return;
        var p = it.previa, n = RP.somaGrupo(it.grupo);
        if (!p || !p.encontro || !n) { RP.aviso({ titulo: n ? 'Não alcançam' : 'Escolha as tropas', texto: n ? 'Use tropas mais rápidas.' : 'Use + e − em cada unidade.', icone: 'relogio', tipo: 'alerta' }); return; }
        if (p.bloqueio) { RP.aviso({ titulo: 'Não dá para enviar', texto: p.bloqueio, icone: 'alerta', tipo: 'alerta' }); return; }
        RP.tentar(RP.post('/interceptacao', { marchaId: it.marcha, deLocalId: it.de, tropas: it.grupo })).then(function (ex) {
          RP.aviso({ titulo: 'Tropas a caminho', texto: 'Chegam ao ponto de encontro ' + RP.fmtHora(ex.chegada) + ', antes deles.', icone: 'alvo', tipo: 'sucesso' });
          RP.recarregarReino(); RP.carregarTropas().catch(function () { /* offline */ });
          var hex = ex.destino; it = null;
          RP.ir('mapa?foco=' + hex);
        });
      });
      document.addEventListener('rp:tropas', function () { if (!el.hidden && it) desenharInterceptar(el); });
    },
    entrar: function (el, q) {
      it = { marcha: +q.get('marcha'), de: null, grupo: {}, previa: null, erro: null };
      desenharInterceptar(el);
      RP.carregarTropas().then(function () {
        if (!it) return;
        var ors = itOrigens();
        it.de = (ors.filter(function (x) { return x.tipo === 'castelo'; })[0] || ors[0] || {}).id || RP.reino.casteloId;
        it.grupo = itGrupoPadrao();
        itPrevia(el);
      }, function (e) { it.erro = e.message; desenharInterceptar(el); });
    },
    sair: function () { clearTimeout(itTimer); }
  });

  /* ================================================================ avistamentos no mapa ("visto há X") */
  function folhaAvistamento(o) {
    return linha('Forças vistas', RP.esc(o.tamanho) + ' · ' + RP.fmtHa((RP.agora() - o.quando) / 3600000) + (o.rumo ? ' · rumo ao ' + RP.esc(o.rumo) : '') +
      ' · some em <span data-fim="' + o.ate + '">' + RP.fmtResta(o.ate - RP.agora()) + '</span>');
  }
  function cor(nome, padrao) { return (getComputedStyle(document.documentElement).getPropertyValue(nome) || '').trim() || padrao; }
  function desenharAvistamento(ctx, o, p) {
    var idade = Math.max(0, Math.min(1, (RP.agora() - o.quando) / Math.max(1, o.ate - o.quando)));
    ctx.save();
    ctx.globalAlpha = 0.9 - idade * 0.6;
    ctx.setLineDash([4, 4]); ctx.lineWidth = 2; ctx.strokeStyle = cor('--cor-perigo', 'firebrick');
    ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, 7); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = cor('--cor-perigo', 'firebrick');
    ctx.font = '700 13px "Barlow Semi Condensed", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', p.x, p.y + 1);
    ctx.restore();
  }
  RP.mapa.tiposObjeto = RP.mapa.tiposObjeto || {};
  /* o sistema de exploração também pode registrar "avistamento": quem chegar primeiro desenha; o outro só manda os dados */
  if (!RP.mapa.tiposObjeto.avistamento) {
    RP.mapa.tiposObjeto.avistamento = { nome: 'Forças vistas', icone: 'olho', guerra: true, desenharTatico: function (ctx, o, p) { desenharAvistamento(ctx, o, p); }, folha: folhaAvistamento };
  }
  function meuDesenho() { return RP.mapa.tiposObjeto.avistamento && RP.mapa.tiposObjeto.avistamento.guerra && !RP.mapa.desenhaTiposObjeto; }
  RP.mapa.desenhosExtras.push(function (ctx, dados) {
    if (!meuDesenho()) return;
    (dados.objetos || []).forEach(function (o) { if (o.tipo === 'avistamento' && o.avistado !== 'espiao') desenharAvistamento(ctx, o, H.centroH(o.hex)); });
  });
  RP.mapa.extrasFolhaHex.push(function (h, dados) {
    if (!meuDesenho()) return '';
    return objetosHex(h, dados).filter(function (o) { return o.tipo === 'avistamento' && o.avistado !== 'espiao'; }).map(folhaAvistamento).join('');
  });
})();
