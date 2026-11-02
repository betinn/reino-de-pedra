/* Reino de Pedra — Relíquias lendárias.
   Uma por reino no mundo. Escavadas em ruínas antigas, guardadas num local para melhorar
   o desempenho dele (ataque, produção ou resistência), roubáveis, e só a espionagem revela
   onde estão as de outros reinos. Valores ilustrativos. */
(function () {
  'use strict';
  var RP = window.RP, D = RP.dados, W = RP.mundo, H = RP.hex, U = RP.util;

  var TIPOS = {
    ataque: { nome: 'Ataque', icone: 'tropas', txt: 'Tropas que saem do local atacam mais forte.', efeito: function (b) { return '+' + b + '% de ataque das tropas que saem daqui'; } },
    producao: { nome: 'Produção', icone: 'martelo', txt: 'O local produz mais.', efeito: function (b) { return '+' + b + '% de produção do local'; } },
    resistencia: { nome: 'Resistência', icone: 'escudo', txt: 'O local se defende melhor.', efeito: function (b) { return '+' + b + '% de defesa do local'; } }
  };
  RP.RELIQUIA = TIPOS;

  /* relíquia guardada num local. soVisivel: só as suas e as de outros reinos já espionadas */
  RP.reliquiaEm = function (localId, soVisivel) {
    return D.reliquias.filter(function (r) {
      return r.local === localId && !r.transito && (!soVisivel || r.dono === 'meu' || r.espionada !== undefined);
    })[0];
  };
  RP.seloReliquia = function (r) {
    return '<span class="selo selo-relq tipo-' + r.tipo + '">' + RP.icone('lendario') + RP.esc(r.nome) + ' · ' + TIPOS[r.tipo].efeito(r.bonus) + '</span>';
  };
  function nomeLocal(id) { var x = W.local(id); return x ? (x.reino === 'meu' && x.tipo === 'castelo' ? 'Castelo de ' + RP.estado.nome : W.nomeAparente(x)) : '—'; }
  function origemRel(r) { return r.local ? W.local(r.local) : W.jazida(r.achada); }
  function minhas() { return D.reliquias.filter(function (r) { return r.dono === 'meu'; }); }

  /* nomes possíveis de relíquias achadas em ruínas (ilustrativo) */
  var ACHADOS = [
    { nome: 'Elmo do Primeiro Rei', tipo: 'ataque', bonus: 15 },
    { nome: 'Selo das Fornalhas', tipo: 'producao', bonus: 15 },
    { nome: 'Pedra-Guardiã', tipo: 'resistencia', bonus: 20 }
  ];

  /* chegada de relíquias em trânsito e fim de escavações */
  document.addEventListener('rp:tique', function () {
    var agora = Date.now(), mudou = false;
    D.reliquias.forEach(function (r) {
      if (r.transito && r.transito.chegada <= agora) {
        r.local = r.transito.para; delete r.transito; mudou = true;
        RP.aviso({ titulo: r.nome + ' chegou', texto: 'Agora fortalece ' + nomeLocal(r.local) + '.', icone: 'lendario', tipo: 'sucesso' });
      }
    });
    D.escavacoes = D.escavacoes.filter(function (q) {
      if (q.fim > agora) return true;
      var j = W.jazida(q.jazida), a = ACHADOS[D.reliquias.length % ACHADOS.length];
      D.reliquias.push({ id: 'rl-' + agora, nome: a.nome, tipo: a.tipo, bonus: a.bonus, dono: 'meu', local: null, achada: j.id, origem: 'Escavada em ' + j.nome });
      D.ruinasComReliquia = D.ruinasComReliquia.filter(function (id) { return id !== j.id; });
      j.restante = 0; mudou = true;
      RP.aviso({ titulo: 'Relíquia encontrada', texto: a.nome + ' (' + TIPOS[a.tipo].nome.toLowerCase() + '). Escolha onde guardá-la.', icone: 'lendario', tipo: 'sucesso' });
      return false;
    });
    if (mudou) { RP.invalidarTela('mapa'); RP.invalidarTela('reino'); if (tela && !tela.hidden) desenhar(tela); }
  });

  function cartaoMinha(r) {
    var t = TIPOS[r.tipo];
    return '<div class="card relq-card tipo-' + r.tipo + '"><div class="linha"><span class="relq-ico">' + RP.icone('lendario') + '</span>' +
      '<span style="flex:1;min-width:0"><b>' + RP.esc(r.nome) + '</b><br><span class="selo selo-relq tipo-' + r.tipo + '">' + RP.icone(t.icone) + t.nome + '</span></span></div>' +
      '<p class="relq-efeito">' + RP.icone('subir', 'ico-p') + t.efeito(r.bonus) + '</p>' +
      (!r.local && !r.transito ? '<p class="nota-antiga">' + RP.icone('info', 'ico-p') + '<span>Ainda sem lugar: só fortalece um local depois de guardada.</span></p>'
        : r.transito ? '<p class="nota-antiga">' + RP.icone('tropas', 'ico-p') + '<span>Em trânsito para ' + RP.esc(nomeLocal(r.transito.para)) + ' · chega em <b class="num" data-fim="' + r.transito.chegada + '">' + RP.fmtResta(r.transito.chegada - Date.now()) + '</b>. Pode ser roubada no caminho.</span></p>'
        : '<p class="fraco" style="font-size:var(--fs-2)">Guardada em <b style="color:var(--cor-texto)">' + RP.esc(nomeLocal(r.local)) + '</b></p>') +
      '<small class="fraco">' + RP.esc(r.origem || '') + '</small>' +
      '<div class="linha relq-acoes">' + (r.transito ? '' : !r.local ? '<button type="button" class="btn btn-p btn-primario" data-mover-rel="' + r.id + '">' + RP.icone('castelo') + 'Guardar</button>'
        : '<button type="button" class="btn btn-p" data-mover-rel="' + r.id + '">' + RP.icone('seta') + 'Mover</button><a class="btn btn-p btn-fantasma" href="#/mapa?modo=cena&centro=' + r.local + '">' + RP.icone('vista') + 'Ver na Vista</a>') + '</div></div>';
  }
  function cartaoConhecida(r) {
    var t = TIPOS[r.tipo], x = W.local(r.local), reino = D.reinos[r.dono];
    return '<div class="card relq-card tipo-' + r.tipo + '"><div class="linha"><span class="relq-ico">' + RP.icone('lendario') + '</span>' +
      '<span style="flex:1;min-width:0"><b>' + RP.esc(r.nome) + '</b><br><span class="selo selo-relq tipo-' + r.tipo + '">' + RP.icone(t.icone) + t.nome + '</span></span></div>' +
      '<p class="relq-efeito">' + RP.icone('subir', 'ico-p') + t.efeito(r.bonus) + '</p>' +
      '<div class="linha">' + RP.brasao(reino.brasao, { tamanho: 22 }) + '<span class="fraco" style="font-size:var(--fs-2)">' + RP.esc(reino.nome) + ' · ' + RP.esc(W.nomeAparente(x)) + ' · espionado ' + RP.fmtHa(r.espionada) + '</span></div>' +
      '<div class="linha relq-acoes"><a class="btn btn-p btn-primario" href="#/envio?alvo=' + x.id + '">' + RP.icone('tropas') + 'Planejar roubo</a><a class="btn btn-p btn-fantasma" href="#/exploradores?tipo=batedor&alvo=' + x.c + ',' + x.l + '">' + RP.icone('batedor') + 'Espionar de novo</a></div></div>';
  }
  var tela = null;
  function desenhar(el) {
    var meu = minhas(), conhecidas = D.reliquias.filter(function (r) { return r.dono && r.dono !== 'meu' && r.espionada !== undefined; });
    var roubadas = D.reliquias.filter(function (r) { return r.roubada; });
    var ruinas = D.ruinasComReliquia.map(function (id) { return W.jazida(id); }).filter(function (j) { return W.estado(j.c, j.l).v !== 'desconhecido'; });
    RP.$('.relq-conteudo', el).innerHTML =
      '<div class="nota-regra">' + RP.icone('lendario', 'ico-p') + '<span>Há <b>uma relíquia para cada reino</b> do mundo. Guarde-a num local para fortalecê-lo. Relíquias podem ser <b>roubadas</b>, e só a <b>espionagem</b> revela onde estão as dos outros.</span></div>' +
      '<div class="ext-numeros"><div><span class="fraco">Com você</span><b class="num">' + meu.length + '</b></div><div><span class="fraco">Conhecidas</span><b class="num">' + conhecidas.length + '</b></div><div><span class="fraco">No mundo</span><b class="num">' + RP.num(D.temporada.reinos) + '</b></div></div>' +
      '<div class="relq-tipos">' + Object.keys(TIPOS).map(function (k) { return '<div class="relq-tipo tipo-' + k + '">' + RP.icone(TIPOS[k].icone) + '<b>' + TIPOS[k].nome + '</b><small class="fraco">' + TIPOS[k].txt + '</small></div>'; }).join('') + '</div>' +
      '<div class="secao-titulo">Suas relíquias</div><div class="pilha">' + (meu.length ? meu.map(cartaoMinha).join('') : '<p class="fraco">Nenhuma relíquia com você.</p>') + '</div>' +
      '<p class="fraco" style="font-size:var(--fs-2);margin-top:var(--esp-2)">Uma relíquia por local. Quem vencer um saque ou uma ocupação no local leva a relíquia.</p>' +
      '<div class="secao-titulo">Conhecidas por espionagem</div><div class="pilha">' + (conhecidas.length ? conhecidas.map(cartaoConhecida).join('') : '<p class="fraco">Espione locais de outros reinos para descobrir relíquias.</p>') + '</div>' +
      (roubadas.length ? '<div class="secao-titulo">Roubadas de você</div><div class="pilha">' + roubadas.map(function (r) {
        return '<div class="card relq-card roubada tipo-' + r.tipo + '"><div class="linha"><span class="relq-ico">' + RP.icone('lendario') + '</span><span style="flex:1"><b>' + RP.esc(r.nome) + '</b><br><small class="fraco">Levada da ' + RP.esc(nomeLocal(r.roubada.de)) + ' ' + RP.fmtHa(r.roubada.horas) + ' por forças desconhecidas vindas do ' + r.roubada.origem + '. Paradeiro desconhecido.</small></span></div>' +
          '<div class="linha relq-acoes"><a class="btn btn-p btn-primario" href="#/exploradores?tipo=batedor">' + RP.icone('batedor') + 'Espionar para achar</a><a class="btn btn-p btn-fantasma" href="#/relatorio?id=r-roubo">' + RP.icone('relatorios') + 'Relatório</a></div></div>';
      }).join('') + '</div>' : '') +
      '<div class="secao-titulo">Ruínas antigas</div><div class="pilha">' + ruinas.map(function (j) {
        var esc = D.escavacoes.filter(function (q) { return q.jazida === j.id; })[0], e = W.estado(j.c, j.l);
        return '<div class="card relq-card"><div class="linha"><span class="ico-placa">' + RP.icone('ruina', 'r-lendario') + '</span><span style="flex:1"><b>' + RP.esc(j.nome) + '</b><br><small class="fraco">Guarda 1 relíquia · tipo só se conhece ao achar · ' + (e.v === 'visivel' ? 'visível' : 'visto ' + RP.fmtHa(e.horas)) + '</small></span></div>' +
          (esc ? '<p class="nota-antiga">' + RP.icone('picareta', 'ico-p') + '<span>Escavação em andamento · relíquia encontrada em <b class="num" data-fim="' + esc.fim + '">' + RP.fmtResta(esc.fim - Date.now()) + '</b></span></p>'
            : '<div class="linha relq-acoes"><a class="btn btn-p btn-primario" href="#/extracao?jazida=' + j.id + '">' + RP.icone('picareta') + 'Escavar</a><a class="btn btn-p btn-fantasma" href="#/mapa?modo=cena&abrir=jazida:' + j.id + '">' + RP.icone('vista') + 'Ver</a></div>') + '</div>';
      }).join('') + '</div><div style="height:var(--esp-8)"></div>';
  }
  RP.registrarTela('reliquias', {
    secao: 'reino',
    montar: function (el) {
      tela = el;
      el.innerHTML = U.topo('Relíquias', 'reino', 'Lendárias · uma por reino no mundo') + '<div class="conteudo-tela relq-conteudo"></div>';
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-mover-rel]');
        if (!b) return;
        var r = D.reliquias.filter(function (q) { return q.id === b.getAttribute('data-mover-rel'); })[0], de = origemRel(r);
        var opcoes = D.locais.filter(function (x) { return x.reino === 'meu' && x.id !== r.local; }).map(function (x) {
          var ocupado = RP.reliquiaEm(x.id), cam = RP.caminho([de.c, de.l], [x.c, x.l], { vel: 'Lenta' });
          return '<button type="button" class="rota-opcao segura" data-destino-rel="' + x.id + '"' + (ocupado ? ' aria-disabled="true"' : '') + '><i class="rota-cor"></i><span><b>' + RP.esc(nomeLocal(x.id)) + '</b><small>' +
            (ocupado ? 'Já guarda ' + RP.esc(ocupado.nome) : RP.TIPOS_LOCAL[x.tipo]) + '</small></span><span class="rota-tempo">' + RP.icone('relogio', 'ico-p') + (cam ? RP.fmtDuracao(cam.seg) : '—') + '</span></button>';
        }).join('');
        RP.abrirFolha({
          titulo: (r.local ? 'Mover ' : 'Guardar ') + RP.esc(r.nome), veu: true,
          subtitulo: '<span class="fraco">Uma relíquia por local. No caminho, ela pode ser roubada.</span>',
          corpo: '<div class="pilha" data-rel="' + r.id + '">' + opcoes + '</div>'
        });
      });
    },
    entrar: function (el) { desenhar(el); }
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-destino-rel]');
    if (!b) return;
    if (b.getAttribute('aria-disabled') === 'true') { RP.aviso({ titulo: 'Local ocupado', texto: 'Cada local guarda só uma relíquia.', icone: 'lendario', tipo: 'alerta' }); return; }
    var r = D.reliquias.filter(function (q) { return q.id === b.closest('[data-rel]').getAttribute('data-rel'); })[0];
    var de = origemRel(r), para = W.local(b.getAttribute('data-destino-rel'));
    var cam = RP.caminho([de.c, de.l], [para.c, para.l], { vel: 'Lenta' });
    if (!cam) return;
    W.adicionarMarcha({ id: 'm-rel-' + Date.now(), dono: 'meu', tipo: 'exercito', nome: 'Escolta da relíquia', resumo: r.nome + ' → ' + nomeLocal(para.id), seg: cam.seg }, cam.hexes);
    r.transito = { para: para.id, chegada: Date.now() + cam.seg * 1000 };
    r.local = null;
    RP.fecharFolha();
    RP.invalidarTela('mapa'); RP.invalidarTela('reino'); RP.invalidarTela('tropas');
    RP.aviso({ titulo: r.nome + ' a caminho', texto: 'Chega a ' + nomeLocal(para.id) + ' em ' + RP.fmtDuracao(cam.seg) + '.', icone: 'lendario', tipo: 'sucesso' });
    if (tela && !tela.hidden) desenhar(tela);
  });
})();
