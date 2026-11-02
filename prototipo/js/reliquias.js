/* Reino de Pedra — Relíquias lendárias.
   Uma por reino no mundo. Escavadas em ruínas antigas, guardadas num local para melhorar
   o desempenho dele (ataque, produção ou resistência), roubáveis, e só a espionagem revela
   onde estão as de outros reinos. Relíquias nunca se movem sozinhas: são sempre carregadas
   por tropas (escolta, grupo de escavação, saque) e podem ser roubadas no meio do caminho.
   Valores ilustrativos. */
(function () {
  'use strict';
  var RP = window.RP, D = RP.dados, W = RP.mundo, U = RP.util, G = U.grupo;

  var TIPOS = {
    ataque: { nome: 'Ataque', icone: 'tropas', txt: 'Tropas que saem do local atacam mais forte.', efeito: function (b) { return '+' + b + '% de ataque das tropas que saem daqui'; } },
    producao: { nome: 'Produção', icone: 'martelo', txt: 'O local produz mais.', efeito: function (b) { return '+' + b + '% de produção do local'; } },
    resistencia: { nome: 'Resistência', icone: 'escudo', txt: 'O local se defende melhor.', efeito: function (b) { return '+' + b + '% de defesa do local'; } }
  };
  RP.RELIQUIA = TIPOS;
  var ESCOLTA_MIN = 120;   /* força abaixo do perigo médio da fauna: escolta frágil */

  function relq(id) { return D.reliquias.filter(function (q) { return q.id === id; })[0]; }
  /* relíquia guardada num local. soVisivel: só as suas e as de outros reinos já espionadas */
  RP.reliquiaEm = function (localId, soVisivel) {
    return D.reliquias.filter(function (r) {
      return r.local === localId && (!soVisivel || r.dono === 'meu' || r.espionada !== undefined);
    })[0];
  };
  /* concentração: relíquias juntas somam bônus, mas chamam atenção.
     2 no mesmo local brilham para quem já explorou a área; 3 ou mais viram farol, visível para todos, até na névoa. */
  RP.concentracao = function (localId) {
    var rs = D.reliquias.filter(function (r) { return r.local === localId; }), n = rs.length, x = W.local(localId);
    var nivel = n >= 3 ? 'farol' : n === 2 ? 'brilho' : n === 1 ? 'oculta' : 'nenhuma';
    var visivel = !!x && x.reino !== 'meu' && (nivel === 'farol' || (nivel === 'brilho' && W.estado(x.c, x.l).v !== 'desconhecido'));
    return { n: n, nivel: nivel, visivel: visivel, reliquias: rs };
  };
  RP.TEXTO_CONC = { brilho: 'Brilha: quem já explorou a área vê que há relíquias aqui.', farol: 'Farol: visível para todos os reinos, até na névoa.' };
  /* relíquia que uma marcha está carregando agora (as suas e a sua que foi roubada: você sabe que ela vai ali) */
  RP.reliquiaNaMarcha = function (marchaId) {
    var agora = Date.now();
    return D.reliquias.filter(function (r) {
      if (r.transito) return r.transito.marcha === marchaId && r.transito.coleta <= agora;
      return r.roubada && r.roubada.marcha === marchaId && !r.roubada.sumiu;
    })[0];
  };
  RP.seloReliquia = function (r) {
    return '<span class="selo selo-relq tipo-' + r.tipo + '">' + RP.icone('lendario') + RP.esc(r.nome) + ' · ' + TIPOS[r.tipo].efeito(r.bonus) + '</span>';
  };
  function nomeLocal(id) { var x = W.local(id); return x ? (x.reino === 'meu' && x.tipo === 'castelo' ? 'Castelo de ' + RP.estado.nome : W.nomeAparente(x)) : '—'; }
  function minhas() { return D.reliquias.filter(function (r) { return r.dono === 'meu'; }); }
  function marchaAtiva(id) { var m = id && W.marcha(id); return m && m.d.chegada > Date.now() ? m : null; }
  function ladroes(r) { return r.roubada && !r.roubada.sumiu ? marchaAtiva(r.roubada.marcha) : null; }
  RP.ladroesDe = ladroes;

  /* ---------------------------------------------------------------- exemplo: o Cálice foi roubado há pouco
     e as forças que o levam ainda marcham para o leste, visíveis e interceptáveis */
  (function () {
    var r = D.reliquias.filter(function (q) { return q.roubada && q.roubada.marcha; })[0];
    if (!r) return;
    var de = W.local(r.roubada.de), cam = null;
    [[31, 15], [30, 17], [29, 14], [27, 18]].some(function (d) { cam = RP.caminho([de.c, de.l], d, { vel: 'Lenta' }); return cam; });
    if (!cam) return;
    var passou = Math.round(r.roubada.horas * 3600), total = Math.max(cam.seg, passou + 2400);
    var m = W.adicionarMarcha({ id: r.roubada.marcha, dono: 'desconhecido', tipo: 'exercito', hostil: true, nome: 'Forças desconhecidas',
      resumo: '≈ 26 tropas · infantaria e cavalaria, lentas com o saque', origem: 'oeste (Vila do Moinho)', rumo: 'leste', seg: total }, cam.hexes);
    m.d.inicio = Date.now() - passou * 1000; m.d.chegada = m.d.inicio + total * 1000;
    m.atual = m.posicao(); m.hex = m.atual.hex;
  })();

  /* ---------------------------------------------------------------- relógio: coleta, chegada, fim de escavação */
  var ACHADOS = [
    { nome: 'Elmo do Primeiro Rei', tipo: 'ataque', bonus: 15 },
    { nome: 'Selo das Fornalhas', tipo: 'producao', bonus: 15 },
    { nome: 'Pedra-Guardiã', tipo: 'resistencia', bonus: 20 }
  ];
  document.addEventListener('rp:tique', function () {
    var agora = Date.now(), mudou = false;
    D.reliquias.forEach(function (r) {
      var t = r.transito;
      if (t && r.local && t.coleta <= agora) {
        RP.aviso({ titulo: 'Escolta pegou ' + r.nome, texto: 'A caminho de ' + nomeLocal(t.para) + '. No caminho, pode ser roubada.', icone: 'lendario', tipo: 'alerta' });
        r.local = null; mudou = true;
      }
      if (t && t.chegada <= agora) {
        r.local = t.para; delete r.transito; mudou = true;
        RP.aviso({ titulo: r.nome + ' chegou', texto: 'Agora fortalece ' + nomeLocal(r.local) + '.', icone: 'lendario', tipo: 'sucesso' });
      }
      if (r.roubada && r.roubada.marcha && !r.roubada.sumiu && !marchaAtiva(r.roubada.marcha)) {
        r.roubada.sumiu = true; mudou = true;
        RP.aviso({ titulo: r.nome + ' sumiu na névoa', texto: 'As forças chegaram ao destino. Só a espionagem pode achá-la agora.', icone: 'lendario', tipo: 'perigo' });
      }
    });
    D.escavacoes = D.escavacoes.filter(function (q) {
      if (q.fim > agora) return true;
      var j = W.jazida(q.jazida), a = ACHADOS[D.reliquias.length % ACHADOS.length], dest = W.local(q.destino) || W.local('castelo');
      var cam = RP.caminho([j.c, j.l], [dest.c, dest.l], G.perfil(q.grupo)), id = 'rl-' + agora;
      var m = W.adicionarMarcha({ id: 'm-relq-' + agora, dono: 'meu', tipo: 'exercito', grupo: q.grupo, nome: 'Escolta da relíquia', alvo: dest.id,
        resumo: G.partes(q.grupo) + ' levam ' + a.nome + ' → ' + nomeLocal(dest.id), seg: cam ? cam.seg : 600 }, cam ? cam.hexes : [[j.c, j.l], [dest.c, dest.l]]);
      D.reliquias.push({ id: id, nome: a.nome, tipo: a.tipo, bonus: a.bonus, dono: 'meu', local: null, origem: 'Escavada em ' + j.nome,
        transito: { marcha: m.d.id, para: dest.id, coleta: agora, chegada: m.d.chegada } });
      D.ruinasComReliquia = D.ruinasComReliquia.filter(function (x) { return x !== j.id; });
      j.restante = 0; mudou = true;
      RP.aviso({ titulo: 'Relíquia encontrada', texto: a.nome + ' (' + TIPOS[a.tipo].nome.toLowerCase() + '). O grupo a leva para ' + nomeLocal(dest.id) + '; no caminho, pode ser roubada.', icone: 'lendario', tipo: 'sucesso' });
      return false;
    });
    if (mudou) { RP.invalidarTela('mapa'); RP.invalidarTela('reino'); if (tela && !tela.hidden) desenhar(tela); }
  });

  /* ---------------------------------------------------------------- tela Relíquias */
  function cabRel(r, extra) {
    var t = TIPOS[r.tipo];
    return '<div class="linha"><span class="relq-ico">' + RP.icone('lendario') + '</span><span style="flex:1;min-width:0"><b>' + RP.esc(r.nome) + '</b><br><span class="selo selo-relq tipo-' + r.tipo + '">' + RP.icone(t.icone) + t.nome + '</span></span>' + (extra || '') + '</div>' +
      '<p class="relq-efeito">' + RP.icone('subir', 'ico-p') + t.efeito(r.bonus) + '</p>';
  }
  function linhaTransito(r) {
    var t = r.transito, m = W.marcha(t.marcha), agora = Date.now();
    if (t.coleta > agora) return '<p class="nota-antiga">' + RP.icone('tropas', 'ico-p') + '<span>Escolta a caminho de ' + RP.esc(nomeLocal(r.local)) + ' para buscar · em <b class="num" data-fim="' + t.coleta + '">' + RP.fmtResta(t.coleta - agora) + '</b>. Depois leva a ' + RP.esc(nomeLocal(t.para)) + '.</span></p>';
    return '<p class="nota-antiga">' + RP.icone('tropas', 'ico-p') + '<span>Sendo levada a ' + RP.esc(nomeLocal(t.para)) + (m && m.d.grupo ? ' por ' + RP.esc(G.partes(m.d.grupo)) : '') + ' · chega em <b class="num" data-fim="' + t.chegada + '">' + RP.fmtResta(t.chegada - agora) + '</b>. Pode ser roubada no caminho.</span></p>';
  }
  function cartaoMinha(r) {
    return '<div class="card relq-card tipo-' + r.tipo + '">' + cabRel(r) +
      (r.transito ? linhaTransito(r) : '<p class="fraco" style="font-size:var(--fs-2)">Guardada em <b style="color:var(--cor-texto)">' + RP.esc(nomeLocal(r.local)) + '</b></p>') +
      '<small class="fraco">' + RP.esc(r.origem || '') + '</small>' +
      '<div class="linha relq-acoes">' + (r.transito
        ? '<a class="btn btn-p" href="#/mapa?modo=cena&abrir=marcha:' + r.transito.marcha + '">' + RP.icone('vista') + 'Ver a escolta</a>'
        : '<a class="btn btn-p" href="#/transporte?rel=' + r.id + '">' + RP.icone('seta') + 'Mover</a><a class="btn btn-p btn-fantasma" href="#/mapa?modo=cena&centro=' + r.local + '">' + RP.icone('vista') + 'Ver na Vista</a>') + '</div></div>';
  }
  function cartaoConhecida(r) {
    var x = W.local(r.local), reino = D.reinos[r.dono];
    return '<div class="card relq-card tipo-' + r.tipo + '">' + cabRel(r) +
      '<div class="linha">' + RP.brasao(reino.brasao, { tamanho: 22 }) + '<span class="fraco" style="font-size:var(--fs-2)">' + RP.esc(reino.nome) + ' · ' + RP.esc(W.nomeAparente(x)) + ' · espionado ' + RP.fmtHa(r.espionada) + '</span></div>' +
      '<div class="linha relq-acoes"><a class="btn btn-p btn-primario" href="#/envio?alvo=' + x.id + '">' + RP.icone('tropas') + 'Planejar roubo</a><a class="btn btn-p btn-fantasma" href="#/exploradores?tipo=batedor&alvo=' + x.c + ',' + x.l + '">' + RP.icone('batedor') + 'Espionar de novo</a></div></div>';
  }
  function cartaoRoubada(r) {
    var m = ladroes(r);
    return '<div class="card relq-card roubada tipo-' + r.tipo + '">' + cabRel(r, '<span class="selo selo-perigo">' + (m ? 'Em fuga' : 'Perdida') + '</span>') +
      (m ? '<p class="nota-antiga nota-perigo">' + RP.icone('alerta', 'ico-p pulso') + '<span>Levada da ' + RP.esc(nomeLocal(r.roubada.de)) + ' ' + RP.fmtHa(r.roubada.horas) + '. As forças que a carregam seguem para o ' + RP.esc(m.d.rumo || r.roubada.origem) + ' e somem na névoa em <b class="num" data-fim="' + m.d.chegada + '">' + RP.fmtResta(m.d.chegada - Date.now()) + '</b>.</span></p>' +
          '<div class="linha relq-acoes"><a class="btn btn-p btn-primario" href="#/interceptar?marcha=' + m.d.id + '">' + RP.icone('alvo') + 'Interceptar</a><a class="btn btn-p btn-fantasma" href="#/mapa?modo=cena&abrir=marcha:' + m.d.id + '">' + RP.icone('vista') + 'Ver na Vista</a></div>'
        : '<p class="fraco" style="font-size:var(--fs-2)">Levada da ' + RP.esc(nomeLocal(r.roubada.de)) + ' por forças desconhecidas vindas do ' + RP.esc(r.roubada.origem) + '. Paradeiro desconhecido.</p>' +
          '<div class="linha relq-acoes"><a class="btn btn-p btn-primario" href="#/exploradores?tipo=batedor">' + RP.icone('batedor') + 'Espionar para achar</a><a class="btn btn-p btn-fantasma" href="#/relatorio?id=r-roubo">' + RP.icone('relatorios') + 'Relatório</a></div>') + '</div>';
  }
  function cartaoConcentracao(x) {
    var c = RP.concentracao(x.id);
    return '<div class="card relq-card"><div class="linha"><span class="relq-ico">' + RP.icone('lendario') + '</span><span style="flex:1;min-width:0"><b>' + c.n + ' relíquias juntas</b><br><small class="fraco">' + RP.esc(W.nomeAparente(x)) + ' · dono desconhecido · tipos desconhecidos</small></span><span class="selo selo-destaque">' + (c.nivel === 'farol' ? 'Farol' : 'Brilho') + '</span></div>' +
      '<p class="fraco" style="font-size:var(--fs-2)">' + RP.TEXTO_CONC[c.nivel] + ' Espione para saber de quem são e o que fazem.</p>' +
      '<div class="linha relq-acoes"><a class="btn btn-p btn-primario" href="#/exploradores?tipo=batedor&alvo=' + x.c + ',' + x.l + '">' + RP.icone('batedor') + 'Espionar</a><a class="btn btn-p btn-fantasma" href="#/envio?alvo=' + x.id + '">' + RP.icone('tropas') + 'Planejar ataque</a></div></div>';
  }
  var tela = null;
  function desenhar(el) {
    var meu = minhas(), conhecidas = D.reliquias.filter(function (r) { return r.dono && r.dono !== 'meu' && r.espionada !== undefined; });
    var roubadas = D.reliquias.filter(function (r) { return r.roubada; });
    var avista = D.locais.filter(function (x) { var c = RP.concentracao(x.id); return c.visivel && !c.reliquias.every(function (r) { return r.espionada !== undefined; }); });
    var ruinas = D.ruinasComReliquia.map(function (id) { return W.jazida(id); }).filter(function (j) { return W.estado(j.c, j.l).v !== 'desconhecido'; });
    RP.$('.relq-conteudo', el).innerHTML =
      '<div class="nota-regra">' + RP.icone('lendario', 'ico-p') + '<span>Há <b>uma relíquia para cada reino</b> do mundo. Guarde-a num local para fortalecê-lo. Relíquias <b>não andam sozinhas</b>: tropas as carregam, e no caminho podem ser <b>roubadas</b>. Só a <b>espionagem</b> revela onde estão as dos outros.</span></div>' +
      '<div class="ext-numeros"><div><span class="fraco">Com você</span><b class="num">' + meu.length + '</b></div><div><span class="fraco">Conhecidas</span><b class="num">' + conhecidas.length + '</b></div><div><span class="fraco">No mundo</span><b class="num">' + RP.num(D.temporada.reinos) + '</b></div></div>' +
      '<div class="relq-tipos">' + Object.keys(TIPOS).map(function (k) { return '<div class="relq-tipo tipo-' + k + '">' + RP.icone(TIPOS[k].icone) + '<b>' + TIPOS[k].nome + '</b><small class="fraco">' + TIPOS[k].txt + '</small></div>'; }).join('') + '</div>' +
      (roubadas.length ? '<div class="secao-titulo">Roubadas de você</div><div class="pilha">' + roubadas.map(cartaoRoubada).join('') + '</div>' : '') +
      '<div class="secao-titulo">Suas relíquias</div><div class="pilha">' + (meu.length ? meu.map(cartaoMinha).join('') : '<p class="fraco">Nenhuma relíquia com você.</p>') + '</div>' +
      '<p class="fraco" style="font-size:var(--fs-2);margin-top:var(--esp-2)">Relíquias no mesmo local somam bônus, mas chamam atenção: 2 brilham para quem já explorou a área; 3 ou mais viram farol, visível para todos. Quem vencer um saque, uma ocupação ou um cerco no local leva as relíquias.</p>' +
      (avista.length ? '<div class="secao-titulo">À vista no mapa</div><div class="pilha">' + avista.map(cartaoConcentracao).join('') + '</div>' : '') +
      '<div class="secao-titulo">Conhecidas por espionagem</div><div class="pilha">' + (conhecidas.length ? conhecidas.map(cartaoConhecida).join('') : '<p class="fraco">Espione locais de outros reinos para descobrir relíquias.</p>') + '</div>' +
      '<div class="secao-titulo">Ruínas antigas</div><div class="pilha">' + (ruinas.length ? ruinas.map(function (j) {
        var esc = D.escavacoes.filter(function (q) { return q.jazida === j.id; })[0], e = W.estado(j.c, j.l);
        return '<div class="card relq-card"><div class="linha"><span class="ico-placa">' + RP.icone('ruina', 'r-lendario') + '</span><span style="flex:1"><b>' + RP.esc(j.nome) + '</b><br><small class="fraco">Guarda 1 relíquia · tipo só se conhece ao achar · ' + (e.v === 'visivel' ? 'visível' : 'visto ' + RP.fmtHa(e.horas)) + '</small></span></div>' +
          (esc ? '<p class="nota-antiga">' + RP.icone('picareta', 'ico-p') + '<span>Escavação em andamento · relíquia encontrada em <b class="num" data-fim="' + esc.fim + '">' + RP.fmtResta(esc.fim - Date.now()) + '</b>. O grupo a leva a ' + RP.esc(nomeLocal(esc.destino)) + '.</span></p>'
            : '<div class="linha relq-acoes"><a class="btn btn-p btn-primario" href="#/extracao?jazida=' + j.id + '">' + RP.icone('picareta') + 'Escavar</a><a class="btn btn-p btn-fantasma" href="#/mapa?modo=cena&abrir=jazida:' + j.id + '">' + RP.icone('vista') + 'Ver</a></div>') + '</div>';
      }).join('') : '<p class="fraco">Nenhuma ruína antiga conhecida com relíquia. Prospectores revelam ruínas.</p>') + '</div><div style="height:var(--esp-8)"></div>';
  }
  RP.registrarTela('reliquias', {
    secao: 'reino',
    montar: function (el) {
      tela = el;
      el.innerHTML = U.topo('Relíquias', 'reino', 'Lendárias · uma por reino no mundo') + '<div class="conteudo-tela relq-conteudo"></div>';
    },
    entrar: function (el) { desenhar(el); }
  });

  /* ---------------------------------------------------------------- Mover: a escolta sai do castelo, busca e leva */
  var tr = { rel: null, destino: null, grupo: { lanceiro: 0, arqueiro: 0, cavalaria: 0 }, caminho: 'curta' };
  function notaEscolta(g) {
    if (!G.soma(g)) return '';
    return G.forca(g) < ESCOLTA_MIN
      ? '<p class="nota-antiga">' + RP.icone('alerta', 'ico-p') + '<span><b>Escolta pequena.</b> Quem a vir no caminho pode roubar a relíquia com poucas tropas.</span></p>'
      : '<div class="risco-linha ok">' + RP.icone('escudo') + '<span><b>Escolta forte</b><br><small>Roubar no caminho exige um exército. Ainda assim, ela fica visível no mapa.</small></span></div>';
  }
  function livre() { return true; }   /* sem limite por local: juntar relíquias soma bônus e chama atenção */
  function depois(x) { return D.reliquias.filter(function (q) { return q.local === x.id || (q.transito && q.transito.para === x.id); }).length + 1; }
  function desenharTransporte(el) {
    var r = relq(tr.rel), de = W.local(r.local), cast = W.local('castelo');
    var destinos = D.locais.filter(function (x) { return x.reino === 'meu' && x.id !== r.local; });
    if (!tr.destino || !destinos.some(function (x) { return x.id === tr.destino && livre(x); })) { var l0 = destinos.filter(livre)[0]; tr.destino = l0 ? l0.id : null; }
    var para = tr.destino && W.local(tr.destino), n = G.soma(tr.grupo), perfil = G.perfil(tr.grupo);
    var ida = de.id === cast.id ? { seg: 0, hexes: [[de.c, de.l]] } : RP.caminho([cast.c, cast.l], [de.c, de.l], perfil);
    var op = para ? U.opcoesCaminho([de.c, de.l], [para.c, para.l], perfil) : { curta: null, segura: null };
    if (tr.caminho === 'segura' && !op.segura) tr.caminho = 'curta';
    var volta = op[tr.caminho] || op.curta;
    var h = '<div class="card relq-card tipo-' + r.tipo + '">' + cabRel(r) + '<p class="fraco" style="font-size:var(--fs-2)">Hoje em <b style="color:var(--cor-texto)">' + RP.esc(nomeLocal(r.local)) + '</b></p></div>' +
      '<div class="nota-regra" style="margin-top:var(--esp-3)">' + RP.icone('tropas', 'ico-p') + '<span>A relíquia <b>não anda sozinha</b>. Suas tropas ' + (ida && ida.seg ? 'saem do castelo, buscam a relíquia e a levam' : 'levam a relíquia') + ' até o destino. No caminho, ela fica visível e <b>pode ser roubada</b>.</span></div>' +
      '<div class="secao-titulo">1. Destino</div><div class="escolhas escolhas-lista">' + destinos.map(function (x) {
        var n = depois(x), nv = n >= 3 ? 'farol' : n === 2 ? 'brilho' : null;
        return '<button type="button" class="escolha escolha-linha" data-destino-tr="' + x.id + '" aria-pressed="' + (x.id === tr.destino) + '"><span class="ico-placa dono-meu">' + RP.icone(x.tipo) + '</span>' +
          '<span class="escolha-txt"><b>' + RP.esc(nomeLocal(x.id)) + '</b><small class="fraco">' + RP.TIPOS_LOCAL[x.tipo] + (n > 1 ? ' · ficaria com ' + n + ' relíquias' : '') + '</small></span>' +
          (nv ? '<span class="selo selo-antigo">' + (nv === 'farol' ? 'Farol' : 'Brilho') + '</span>' : '') + '</button>';
      }).join('') + '</div>' +
      (para && depois(para) >= 2 ? '<p class="nota-antiga">' + RP.icone('lendario', 'ico-p') + '<span>Com ' + depois(para) + ' relíquias em ' + RP.esc(nomeLocal(para.id)) + ', os bônus somam, mas o local ' + (depois(para) >= 3 ? 'vira farol: visível para todos os reinos, até na névoa.' : 'passa a brilhar para quem já explorou a área.') + '</span></p>' : '') +
      '<div class="secao-titulo">2. Escolta</div><div class="card pilha">' + G.linhas(tr.grupo, ['lanceiro', 'arqueiro', 'cavalaria'], G.disp) +
      '<div class="ext-numeros"><div><span class="fraco">Tropas</span><b class="num">' + n + '</b></div><div><span class="fraco">Força</span><b class="num">' + Math.round(G.forca(tr.grupo)) + '</b></div><div><span class="fraco">Velocidade</span><b>' + perfil.vel + '</b></div></div>' +
      notaEscolta(tr.grupo) + '</div>' +
      '<div class="secao-titulo">3. Caminho</div>' +
      (volta && ida ? (ida.seg ? '<div class="card linha"><span class="ico-placa dono-meu">' + RP.icone('castelo') + '</span><span style="flex:1"><b>Buscar</b><br><small class="fraco">Castelo → ' + RP.esc(nomeLocal(de.id)) + '</small></span><span class="rota-tempo">' + RP.icone('relogio', 'ico-p') + RP.fmtDuracao(ida.seg) + '</span></div>' : '') +
        '<div class="card mini-rota-card" style="margin-top:var(--esp-3)">' + U.miniRota(op, tr.caminho, nomeLocal(para.id), de.tipo) + '</div>' +
        '<div class="pilha" style="margin-top:var(--esp-3)">' + U.opcaoCaminho('curta', op.curta, tr.caminho) + U.opcaoCaminho('segura', op.segura, tr.caminho) + '</div>' +
        U.blocoRisco(volta.perigo ? RP.fauna.risco(volta.perigo.nivel, G.forca(tr.grupo)) : null, volta.perigo, false) +
        '<div style="height:var(--esp-6)"></div>'
        : '<p class="fraco">Sem caminho possível.</p>');
    RP.$('.tr-conteudo', el).innerHTML = h;
    var total = volta && ida ? ida.seg + volta.seg : 0;
    RP.$('.rodape-resumo', el).innerHTML = n && total ? '<div class="resumo-linha"><b>' + RP.esc(r.nome) + ' → ' + RP.esc(nomeLocal(para.id)) + '</b><span class="tempo">' + RP.icone('relogio', 'ico-p') + RP.fmtDuracao(total) + '</span></div><div class="resumo-linha fraco">escolta: ' + G.partes(tr.grupo) + (ida.seg ? ' · busca em ' + RP.fmtDuracao(ida.seg) : '') + '</div>'
      : '<div class="resumo-linha fraco">' + (para ? 'Escolha a escolta: a relíquia só se move com tropas.' : 'Nenhum destino livre.') + '</div>';
    RP.$('[data-enviar-escolta]', el).classList.toggle('btn-inativo', !n || !total);
    tr._ida = ida; tr._volta = volta;
  }
  RP.registrarTela('transporte', {
    secao: 'reino',
    montar: function (el) {
      el.innerHTML = U.topo('Mover relíquia', 'reliquias', 'Sempre com escolta') + '<div class="conteudo-tela tr-conteudo"></div>' +
        '<div class="rodape-acao rodape-com-resumo"><div class="rodape-resumo"></div><button type="button" class="btn btn-primario btn-bloco btn-grande" data-enviar-escolta>' + RP.icone('tropas') + 'Enviar escolta</button></div>';
      el.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-destino-tr]'))) {
          if (b.getAttribute('aria-disabled') === 'true') { RP.aviso({ titulo: 'Local ocupado', texto: 'Cada local guarda só uma relíquia.', icone: 'lendario', tipo: 'alerta' }); return; }
          tr.destino = b.getAttribute('data-destino-tr'); desenharTransporte(el); return;
        }
        if ((b = e.target.closest('[data-caminho]'))) { tr.caminho = b.getAttribute('data-caminho'); desenharTransporte(el); return; }
        if (G.passo(e, tr.grupo, G.disp)) { desenharTransporte(el); return; }
        if (e.target.closest('[data-enviar-escolta]')) {
          var r = relq(tr.rel), n = G.soma(tr.grupo), ida = tr._ida, volta = tr._volta, para = tr.destino && W.local(tr.destino);
          if (!n) { RP.aviso({ titulo: 'Escolha a escolta', texto: 'A relíquia só se move carregada por tropas.', icone: 'tropas', tipo: 'alerta' }); return; }
          if (!ida || !volta || !para) return;
          var agora = Date.now(), hexes = ida.hexes.concat(volta.hexes.slice(1)), seg = ida.seg + volta.seg;
          Object.keys(tr.grupo).forEach(function (k) { D.disponiveis[k] = G.disp(k) - (tr.grupo[k] || 0); });
          var m = W.adicionarMarcha({ id: 'm-relq-' + agora, dono: 'meu', tipo: 'exercito', grupo: Object.assign({}, tr.grupo), nome: 'Escolta da relíquia', alvo: para.id,
            resumo: G.partes(tr.grupo) + ' levam ' + r.nome + ' → ' + nomeLocal(para.id), seg: seg }, hexes);
          r.transito = { marcha: m.d.id, para: para.id, coleta: agora + ida.seg * 1000, chegada: m.d.chegada };
          if (!ida.seg) r.local = null;
          tr.grupo = { lanceiro: 0, arqueiro: 0, cavalaria: 0 };
          RP.aviso({ titulo: 'Escolta a caminho', texto: (ida.seg ? 'Busca ' + r.nome + ' em ' + RP.fmtDuracao(ida.seg) + ' e chega' : r.nome + ' chega') + ' a ' + nomeLocal(para.id) + ' em ' + RP.fmtDuracao(seg) + '.', icone: 'lendario', tipo: 'sucesso' });
          RP.invalidarTela('reino'); RP.invalidarTela('reliquias');
          U.irParaMarcha(m);
        }
      });
    },
    entrar: function (el, params) {
      var id = params.get('rel');
      if (id && id !== tr.rel) { tr.rel = id; tr.destino = null; tr.caminho = 'curta'; }
      var r = tr.rel && relq(tr.rel);
      if (!r || !r.local || r.transito) { var p = minhas().filter(function (q) { return q.local && !q.transito; })[0]; tr.rel = p ? p.id : null; }
      if (!tr.rel) { RP.ir('reliquias'); return; }
      desenharTransporte(el);
    }
  });

  /* ---------------------------------------------------------------- Interceptar: chegar a um ponto do caminho antes deles */
  var it = { marcha: null, grupo: { lanceiro: 0, arqueiro: 0, cavalaria: 0 } }, cacheEncontro = {};
  /* hexes que a marcha ainda vai cruzar, com a hora em que passa por cada um */
  function passagens(m) {
    var p = m.p, acum = [0], i;
    for (i = 1; i < p.length; i++) acum.push(acum[i - 1] + Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y));
    var tot = acum[acum.length - 1] || 1, agora = Date.now(), fr = m.posicao().frac, lista = [];
    for (i = 1; i < m.hexes.length; i++) {
      var f = acum[i] / tot;
      if (f <= fr) continue;
      lista.push({ hex: m.hexes[i], quando: m.d.inicio + ((f - m.d.pos) / (1 - m.d.pos)) * m.d.seg * 1000 });
    }
    return lista.filter(function (x) { return x.quando > agora; });
  }
  function encontro(m, perfil) {
    var chave = m.d.id + '|' + perfil.vel, c = cacheEncontro[chave];
    if (c && c.ate > Date.now()) return c.r;
    var cast = U.castelo(), agora = Date.now(), r = null;
    passagens(m).some(function (ps) {
      var cam = RP.caminho(cast, ps.hex, perfil);
      if (cam && agora + cam.seg * 1000 <= ps.quando - 60000) { r = { cam: cam, hex: ps.hex, eles: ps.quando, nos: agora + cam.seg * 1000 }; return true; }
      return false;
    });
    cacheEncontro[chave] = { r: r, ate: Date.now() + 20000 };
    return r;
  }
  /* tropa pré-escolhida: a mais rápida que chega a tempo, até 10 unidades; o jogador pode mudar */
  function grupoQueAlcanca(m) {
    var ordem = ['cavalaria', 'arqueiro', 'lanceiro'];
    for (var i = 0; i < ordem.length; i++) {
      var k = ordem[i], q = Math.min(10, G.disp(k));
      if (!q) continue;
      var g = { lanceiro: 0, arqueiro: 0, cavalaria: 0 }; g[k] = q;
      if (m.d.chegada > Date.now() && encontro(m, G.perfil(g))) return g;
    }
    return { lanceiro: 0, arqueiro: 0, cavalaria: 0 };
  }
  function desenharInterceptar(el) {
    var m = W.marcha(it.marcha), r = RP.reliquiaNaMarcha(it.marcha), ativa = m.d.chegada > Date.now();
    var n = G.soma(it.grupo), perfil = G.perfil(it.grupo), enc = ativa && n ? encontro(m, perfil) : null;
    var h = '<div class="card linha atacante">' + RP.brasao(null, { tamanho: 40, desconhecido: true }) + '<span style="flex:1"><b>Forças desconhecidas</b><br><small class="fraco">' + RP.esc(m.d.resumo) + ' · rumo ao ' + RP.esc(m.d.rumo || '?') + '</small></span></div>' +
      (r ? '<div class="card relq-card tipo-' + r.tipo + '" style="margin-top:var(--esp-3)">' + cabRel(r, '<span class="selo selo-perigo">Sua</span>') + '</div>'
        : m.d.cargaTxt ? '<div class="card linha" style="margin-top:var(--esp-3)"><span class="ico-placa">' + RP.icone('carroca') + '</span><span style="flex:1"><b>Levam</b><br><small class="fraco">' + RP.esc(m.d.cargaTxt) + '</small></span></div>' : '') +
      (ativa ? '<p class="nota-antiga nota-perigo" style="margin-top:var(--esp-3)">' + RP.icone('alerta', 'ico-p pulso') + '<span>Somem na névoa em <b class="num" data-fim="' + m.d.chegada + '">' + RP.fmtResta(m.d.chegada - Date.now()) + '</b>. Depois disso, só a espionagem acha ' + (r ? 'a relíquia' : 'a carga') + '.</span></p>'
        : '<p class="nota-antiga" style="margin-top:var(--esp-3)">' + RP.icone('info', 'ico-p') + '<span>Essas forças já chegaram ao destino. Espione para achar a relíquia.</span></p>') +
      '<div class="nota-regra" style="margin-top:var(--esp-3)">' + RP.icone('alvo', 'ico-p') + '<span>Suas tropas vão a um ponto do caminho <b>antes</b> deles. Se vencerem, trazem ' + (r ? 'a relíquia' : 'a carga') + ' de volta, e na volta ' + (r ? 'ela' : 'a carga') + ' também pode ser interceptada.</span></div>' +
      '<div class="secao-titulo">1. Tropas</div><div class="card pilha">' + G.linhas(it.grupo, ['lanceiro', 'arqueiro', 'cavalaria'], G.disp) +
      '<div class="ext-numeros"><div><span class="fraco">Tropas</span><b class="num">' + n + '</b></div><div><span class="fraco">Força</span><b class="num">' + Math.round(G.forca(it.grupo)) + '</b></div><div><span class="fraco">Velocidade</span><b>' + perfil.vel + '</b></div></div>' +
      '<p class="fraco" style="font-size:var(--fs-2)">Eles: ' + RP.esc(m.d.resumo) + '. Tropas lentas podem não alcançar.</p></div>' +
      '<div class="secao-titulo">2. Ponto de encontro</div>' +
      (!n ? '<p class="fraco">Escolha as tropas para calcular onde alcançam.</p>'
        : enc ? '<div class="card mini-rota-card">' + U.miniRota({ curta: enc.cam, segura: null }, 'curta', 'o ponto de encontro') + '</div>' +
          '<div class="ext-numeros" style="margin-top:var(--esp-3)"><div><span class="fraco">Vocês chegam</span><b class="num">' + RP.fmtDuracao(enc.cam.seg) + '</b></div><div><span class="fraco">Eles passam</span><b class="num">' + RP.fmtDuracao(Math.round((enc.eles - Date.now()) / 1000)) + '</b></div><div><span class="fraco">Folga</span><b class="num">' + RP.fmtDuracao(Math.round((enc.eles - enc.nos) / 1000)) + '</b></div></div>' +
          U.blocoRisco(enc.cam.perigo ? RP.fauna.risco(enc.cam.perigo.nivel, G.forca(it.grupo)) : null, enc.cam.perigo, false)
        : '<p class="nota-antiga">' + RP.icone('relogio', 'ico-p') + '<span><b>Não alcançam a tempo.</b> Com velocidade ' + perfil.vel.toLowerCase() + ', eles somem na névoa antes. Tire as unidades lentas ou use cavalaria.</span></p>') +
      '<div style="height:var(--esp-6)"></div>';
    RP.$('.it-conteudo', el).innerHTML = h;
    RP.$('.rodape-resumo', el).innerHTML = enc ? '<div class="resumo-linha"><b>Interceptar · ' + G.partes(it.grupo) + '</b><span class="tempo">' + RP.icone('relogio', 'ico-p') + 'chegam em ' + RP.fmtDuracao(enc.cam.seg) + '</span></div>'
      : '<div class="resumo-linha fraco">' + (n ? 'Sem ponto de encontro a tempo.' : 'Escolha as tropas.') + '</div>';
    RP.$('[data-interceptar]', el).classList.toggle('btn-inativo', !enc);
    it._enc = enc;
  }
  RP.registrarTela('interceptar', {
    secao: 'tropas',
    montar: function (el) {
      el.innerHTML = U.topo('Interceptar', 'mapa', 'Alcançar no meio do caminho') + '<div class="conteudo-tela it-conteudo"></div>' +
        '<div class="rodape-acao rodape-com-resumo"><div class="rodape-resumo"></div><button type="button" class="btn btn-primario btn-bloco btn-grande" data-interceptar>' + RP.icone('alvo') + 'Enviar para interceptar</button></div>';
      el.addEventListener('click', function (e) {
        if (G.passo(e, it.grupo, G.disp)) { desenharInterceptar(el); return; }
        if (!e.target.closest('[data-interceptar]')) return;
        var enc = it._enc, r = RP.reliquiaNaMarcha(it.marcha), n = G.soma(it.grupo);
        if (!enc) { RP.aviso({ titulo: n ? 'Não alcançam' : 'Escolha as tropas', texto: n ? 'Use tropas mais rápidas.' : 'Use + e − em cada unidade.', icone: 'relogio', tipo: 'alerta' }); return; }
        Object.keys(it.grupo).forEach(function (k) { D.disponiveis[k] = G.disp(k) - (it.grupo[k] || 0); });
        var m = W.adicionarMarcha({ id: 'm-int-' + Date.now(), dono: 'meu', tipo: 'exercito', grupo: Object.assign({}, it.grupo), nome: 'Interceptação',
          resumo: G.partes(it.grupo) + (r ? ' · retomar ' + r.nome : ''), seg: enc.cam.seg }, enc.cam.hexes);
        it.grupo = { lanceiro: 0, arqueiro: 0, cavalaria: 0 };
        RP.aviso({ titulo: 'Tropas a caminho', texto: 'Chegam ao ponto de encontro em ' + RP.fmtDuracao(enc.cam.seg) + ', antes deles.', icone: 'alvo', tipo: 'sucesso' });
        U.irParaMarcha(m);
      });
    },
    entrar: function (el, params) {
      var antes = it.marcha;
      it.marcha = params.get('marcha') || it.marcha || 'm-roubo';
      if (!W.marcha(it.marcha)) { RP.ir('reliquias'); return; }
      if (antes !== it.marcha || !G.soma(it.grupo)) it.grupo = grupoQueAlcanca(W.marcha(it.marcha));
      desenharInterceptar(el);
    }
  });
})();
