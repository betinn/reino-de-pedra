/* Reino de Pedra — Aliança.
   Limite de membros por aliança (um mundo tem até 30 reinos). Aliados se reconhecem no mapa e
   podem pedir recursos uns aos outros; a ajuda viaja, leva tempo e pode ser roubada no caminho.
   Valores ilustrativos. */
(function () {
  'use strict';
  var RP = window.RP, D = RP.dados, W = RP.mundo, U = RP.util, A = D.alianca;
  var camCache = {};

  function reino(id) { return D.reinos[id]; }
  function castelo(id) { return W.local(A.castelos[id]); }
  function nomeLocal(id) { var x = W.local(id); return x ? (x.reino === 'meu' && x.tipo === 'castelo' ? 'Castelo de ' + RP.estado.nome : x.nome) : '—'; }
  function caminhoAte(deId, paraId, vel) {
    var kk = deId + '>' + paraId;
    if (!(kk in camCache)) { var a = W.local(deId), b = W.local(paraId); camCache[kk] = RP.caminho([a.c, a.l], [b.c, b.l], { vel: vel || 'Média' }); }
    return camCache[kk];
  }
  RP.nomeLocalAlianca = nomeLocal;

  /* ajuda de um aliado chegando: carroça visível, entra no estoque do local ao chegar */
  function ajudaChegando(pd) {
    var c = castelo(pd.de), cam = caminhoAte(c.id, pd.local, 'Lenta');
    if (!cam) return null;
    var m = W.adicionarMarcha({ id: 'm-ajuda-' + pd.id, dono: pd.de, tipo: 'caravana', veiculos: { carroca: 1 }, grupo: { lanceiro: 2 }, alvo: pd.local,
      nome: 'Ajuda de ' + reino(pd.de).nome, cargaTxt: RP.cargaTxt(pd.carga), resumo: RP.cargaTxt(pd.carga) + ' → ' + nomeLocal(pd.local), seg: cam.seg }, cam.hexes);
    D.caravanas.push({ marcha: m.d.id, de: c.id, para: pd.local, carga: pd.carga, veiculos: {}, escolta: {}, chegada: m.d.chegada, ajuda: pd.de });
    pd.marcha = m.d.id;
    return m;
  }
  /* exemplo: a Baronia da Fenda já aceitou seu pedido de ferro e a carroça está a caminho do quartel */
  D.pedidos.forEach(function (pd) {
    if (pd.de !== 'meu' || pd.estado !== 'aceito') return;
    var m = ajudaChegando({ id: pd.id, de: pd.para, local: pd.local, carga: pd.carga });
    if (m) { var passou = Math.round(m.d.seg * 0.3); m.d.inicio -= passou * 1000; m.d.chegada -= passou * 1000; m.atual = m.posicao(); m.hex = m.atual.hex; pd.marcha = m.d.id;
      D.caravanas[D.caravanas.length - 1].chegada = m.d.chegada; }
  });

  function textoOrigens(p) {
    if (!p.completo) return 'Faltam ' + RP.cargaTxt(p.faltaReino) + ' no reino todo.';
    return 'Sai de ' + p.viagens.map(function (v) { return nomeLocal(v.local); }).join(', ') + ' · chega em ≈ ' + RP.fmtDuracao(p.seg) + '.';
  }

  /* ---------------------------------------------------------------- tela Aliança */
  var tela = null;
  function desenhar(el) {
    var membros = A.membros, para = D.pedidos.filter(function (p) { return p.para === 'meu' && p.estado === 'aberto'; });
    var meus = D.pedidos.filter(function (p) { return p.de === 'meu'; });
    RP.$('.al-conteudo', el).innerHTML =
      '<div class="card card-moldura linha al-topo">' + RP.brasao(A.brasao, { tamanho: 56 }) + '<span style="flex:1;min-width:0"><h2>' + RP.esc(A.nome) + '</h2><small class="fraco">Desde o ' + RP.esc(A.desde) + '</small></span><span class="selo">' + membros.length + ' de ' + A.limite + '</span></div>' +
      '<div class="nota-regra">' + RP.icone('estandarte', 'ico-p') + '<span>Aliados se reconhecem no mapa e podem <b>pedir recursos</b> uns aos outros. A ajuda <b>viaja</b>: leva tempo e pode ser roubada no caminho. No máximo <b>' + A.limite + ' reinos</b> por aliança, para não desequilibrar um mundo de até ' + D.temporada.limiteReinos + ' reinos.</span></div>' +
      (para.length ? '<div class="secao-titulo">Pedidos para você</div><div class="pilha">' + para.map(function (pd) {
        var p = RP.planoRequisicao(pd.carga, A.castelos[pd.de]);
        return '<div class="card pilha"><div class="linha">' + RP.brasao(reino(pd.de).brasao, { tamanho: 32 }) + '<span style="flex:1;min-width:0"><b>' + RP.esc(reino(pd.de).nome) + ' pede ' + RP.esc(RP.cargaTxt(pd.carga)) + '</b><br><small class="fraco">' + RP.esc(pd.motivo) + ' · ' + RP.fmtHa(pd.horas) + '</small></span></div>' +
          '<small class="obra-estoque' + (p.completo ? ' vem' : ' falta') + '">' + RP.icone('carroca', 'ico-p') + RP.esc(textoOrigens(p)) + '</small>' +
          '<div class="linha relq-acoes"><button type="button" class="btn btn-p btn-primario' + (p.completo ? '' : ' btn-inativo') + '" data-enviar-pedido="' + pd.id + '">' + RP.icone('carroca') + 'Enviar</button><button type="button" class="btn btn-p btn-fantasma" data-recusar-pedido="' + pd.id + '">Recusar</button></div></div>';
      }).join('') + '</div>' : '') +
      '<div class="secao-titulo">Membros</div><div class="card lista">' + membros.map(function (id) {
        var r = reino(id), eu = id === 'meu', cam = eu ? null : caminhoAte('castelo', A.castelos[id]);
        return '<div class="lista-item">' + RP.brasao(eu ? RP.estado.brasao : r.brasao, { tamanho: 32 }) + '<span style="flex:1;min-width:0"><b>' + RP.esc(eu ? RP.estado.nome + ' (você)' : r.nome) + '</b><br><small class="fraco">' + RP.esc(A.papeis[id]) + (cam ? ' · castelo a ' + RP.fmtDuracao(cam.seg) : '') + (r.novato ? ' · sob escudo de novato' : '') + '</small></span>' +
          (eu ? '' : (A.papeis.meu === 'Líder' ? '<button type="button" class="btn btn-p btn-fantasma btn-icone" data-cargo="' + id + '" aria-label="Cargo de ' + RP.esc(r.nome) + '">' + RP.icone('coroa') + '</button>' : '') + '<a class="btn btn-p" href="#/pedido?reino=' + id + '">' + RP.icone('carroca') + 'Pedir</a>') + '</div>';
      }).join('') + '</div>' +
      '<p class="fraco" style="font-size:var(--fs-2);margin-top:var(--esp-2)">Líder convida, expulsa e promove. Até ' + A.conselheirosMax + ' conselheiros convidam e aceitam pedidos de entrada. Se o líder entrar em regência, a liderança passa ao conselheiro mais antigo.</p>' +
      (membros.length < A.limite ? '<button type="button" class="btn btn-p btn-fantasma" data-convidar style="margin-top:var(--esp-2)">' + RP.icone('mais') + 'Convidar reino (' + (A.limite - membros.length) + ' vagas)</button>' : '') +
      (A.tregua.length ? '<div class="secao-titulo">Em trégua</div><div class="pilha">' + A.tregua.map(function (t) {
        var fim = RP.fimItem(t);
        return '<div class="card linha">' + RP.brasao(t.brasao, { tamanho: 28 }) + '<span style="flex:1;min-width:0"><b>' + RP.esc(t.nome) + '</b><br><small class="fraco">' + (t.como === 'saiu' ? 'Saiu da aliança' : 'Foi expulso') + ' · nenhum lado ataca até o fim da trégua</small></span><span class="selo selo-info">' + RP.icone('pacto') + '<span data-fim="' + fim + '">' + RP.fmtResta(fim - Date.now()) + '</span></span></div>';
      }).join('') + '</div>' : '') +
      '<div class="secao-titulo">Seus pedidos</div><div class="pilha">' + (meus.length ? meus.map(function (pd) {
        var m = pd.marcha && W.marcha(pd.marcha), indo = m && m.d.chegada > Date.now();
        return '<div class="card linha">' + RP.brasao(reino(pd.para).brasao, { tamanho: 28 }) + '<span style="flex:1;min-width:0"><b>' + RP.esc(RP.cargaTxt(pd.carga)) + '</b><br><small class="fraco">' + RP.esc(reino(pd.para).nome) + ' · para ' + RP.esc(nomeLocal(pd.local)) + ' · ' +
          (pd.estado === 'aberto' ? 'aguardando resposta' : indo ? 'a caminho, chega em <b class="num" data-fim="' + m.d.chegada + '">' + RP.fmtResta(m.d.chegada - Date.now()) + '</b>' : 'entregue') + '</small></span>' +
          (indo ? '<a class="btn btn-p" href="#/mapa?modo=cena&abrir=marcha:' + m.d.id + '">' + RP.icone('vista') + 'Ver</a>' : '') + '</div>';
      }).join('') : '<p class="fraco">Nenhum pedido feito.</p>') + '</div>' +
      '<div class="secao-titulo">Sair</div><div class="card pilha"><p class="fraco" style="font-size:var(--fs-2)">Qualquer membro sai quando quiser. Ao sair ou ser expulso, vale uma <b>trégua de 24 h</b> entre o reino e a aliança, garantida pelo jogo, e só se entra em outra aliança depois de 24 h. Não há ataque surpresa entre membros.</p>' +
      '<button type="button" class="btn btn-p btn-fantasma" data-sair-alianca>' + RP.icone('voltar') + 'Sair da aliança</button></div><div style="height:var(--esp-8)"></div>';
  }
  RP.registrarTela('alianca', {
    secao: 'mais',
    montar: function (el) {
      tela = el;
      el.innerHTML = U.topo('Aliança', 'mais', RP.esc(A.nome)) + '<div class="conteudo-tela al-conteudo"></div>';
      el.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-enviar-pedido]'))) {
          var pd = D.pedidos.filter(function (q) { return q.id === b.getAttribute('data-enviar-pedido'); })[0];
          var p = RP.requisitar(pd.carga, A.castelos[pd.de], 'pedido de ' + reino(pd.de).nome);
          if (!p) { RP.aviso({ titulo: 'Recursos insuficientes', texto: textoOrigens(RP.planoRequisicao(pd.carga, A.castelos[pd.de])), icone: 'alerta', tipo: 'perigo' }); return; }
          pd.estado = 'enviado';
          RP.aviso({ titulo: 'Ajuda a caminho', texto: RP.cargaTxt(pd.carga) + ' chega a ' + nomeLocal(A.castelos[pd.de]) + ' em ' + RP.fmtDuracao(p.seg) + '. Pode ser roubada no caminho.', icone: 'carroca', tipo: 'sucesso' });
          RP.invalidarTela('mapa'); desenhar(el); return;
        }
        if ((b = e.target.closest('[data-recusar-pedido]'))) {
          D.pedidos.filter(function (q) { return q.id === b.getAttribute('data-recusar-pedido'); })[0].estado = 'recusado';
          RP.aviso({ titulo: 'Pedido recusado', texto: 'O aliado é avisado.', icone: 'info', tipo: 'alerta' }); desenhar(el); return;
        }
        if ((b = e.target.closest('[data-cargo]'))) {
          var id = b.getAttribute('data-cargo'), r = reino(id), cons = A.papeis[id] === 'Conselheiro';
          var nCons = Object.keys(A.papeis).filter(function (k) { return A.papeis[k] === 'Conselheiro'; }).length;
          RP.modal({
            titulo: RP.esc(r.nome), corpo: '<p class="suave">Cargo atual: <b>' + RP.esc(A.papeis[id]) + '</b>. Conselheiros convidam e aceitam pedidos de entrada (até ' + A.conselheirosMax + ').</p>',
            acoes: [
              cons ? { rotulo: 'Rebaixar a membro', acao: function () { A.papeis[id] = 'Membro'; desenhar(el); } }
                : { rotulo: RP.icone('coroa') + 'Promover a conselheiro', classe: 'btn-primario', acao: function () { if (nCons >= A.conselheirosMax) { RP.aviso({ titulo: 'Limite de conselheiros', texto: 'Até ' + A.conselheirosMax + ' por aliança.', icone: 'coroa', tipo: 'alerta' }); return; } A.papeis[id] = 'Conselheiro'; desenhar(el); } },
              { rotulo: 'Expulsar', classe: 'btn-perigo', acao: function () { RP.aviso({ titulo: 'Expulsão', texto: r.nome + ' sairia da aliança com trégua de 24 h. No protótipo, este passo é só ilustrado.', icone: 'estandarte', tipo: 'alerta', ms: 3600 }); } },
              { rotulo: 'Voltar' }]
          });
          return;
        }
        if (e.target.closest('[data-sair-alianca]')) {
          RP.modal({
            titulo: 'Sair do ' + RP.esc(A.nome) + '?',
            corpo: '<p class="suave">A visão das marchas dos aliados acaba na hora. Por 24 h, nenhum lado pode atacar o outro, e você só entra em outra aliança depois disso.' + (A.papeis.meu === 'Líder' ? ' A liderança passa ao conselheiro mais antigo.' : '') + '</p>',
            acoes: [{ rotulo: 'Sair', classe: 'btn-perigo', acao: function () { RP.aviso({ titulo: 'Saída', texto: 'No protótipo, você continua na aliança para seguir vendo as telas.', icone: 'estandarte', tipo: 'alerta', ms: 3600 }); } }, { rotulo: 'Ficar' }]
          });
          return;
        }
        if (e.target.closest('[data-convidar]')) RP.aviso({ titulo: 'Convite', texto: 'No jogo, você escolhe um reino conhecido e ele recebe o convite pelo sino. No protótipo, este passo é só ilustrado.', icone: 'estandarte', tipo: 'alerta', ms: 3600 });
      });
    },
    entrar: function (el) { desenhar(el); }
  });

  /* ---------------------------------------------------------------- tela Pedir recursos */
  var pr = { reino: 'lumen', rec: 'pedra', q: 300, local: RP.SEDE };
  function desenharPedido(el) {
    var r = reino(pr.reino), c = castelo(pr.reino), cam = caminhoAte(c.id, pr.local, 'Lenta');
    var locais = D.locais.filter(function (x) { return x.reino === 'meu'; });
    RP.$('.pd-conteudo', el).innerHTML =
      '<div class="card linha">' + RP.brasao(r.brasao, { tamanho: 40 }) + '<span style="flex:1"><b>' + RP.esc(r.nome) + '</b><br><small class="fraco">Aliado · ' + RP.esc(A.papeis[pr.reino]) + '</small></span></div>' +
      (r.novato ? '<p class="nota-antiga">' + RP.icone('escudo', 'ico-p') + '<span>' + RP.esc(r.nome) + ' está sob escudo de novato: ajudas, trocas e pagamentos somam até ' + RP.num(D.comercio.novatoDia) + ' de valor por dia (restam ' + RP.num(RP.novatoRestante(pr.reino)) + ' hoje).</span></p>' : '') +
      '<div class="secao-titulo">O quê</div><div class="obj-add-lista">' + RP.ORDEM_REC.map(function (k) {
        return '<button type="button" class="btn btn-p chip-sel" data-pr-rec="' + k + '" aria-pressed="' + (pr.rec === k) + '">' + RP.icone(k, 'ico-p r-' + k) + RP.dados.recursos[k].nome + '</button>';
      }).join('') + '</div>' +
      '<div class="secao-titulo">Quanto</div><div class="card linha-entre"><span class="linha">' + RP.icone(pr.rec, 'r-' + pr.rec) + '<b>' + RP.dados.recursos[pr.rec].nome + '</b></span>' +
      '<span class="linha" style="gap:4px"><span class="stepper"><button type="button" class="btn btn-icone" data-pr-d="-1" aria-label="Menos"' + (pr.q <= 100 ? ' disabled' : '') + '>' + RP.icone('menos') + '</button><output class="num">' + RP.numCurto(pr.q) + '</output><button type="button" class="btn btn-icone" data-pr-d="1" aria-label="Mais">' + RP.icone('mais') + '</button></span>' +
      '<button type="button" class="btn btn-p" data-pr-d="10">+1k</button></span></div>' +
      '<div class="secao-titulo">Para onde</div><div class="obj-add-lista">' + locais.map(function (x) {
        return '<button type="button" class="btn btn-p chip-sel" data-pr-local="' + x.id + '" aria-pressed="' + (pr.local === x.id) + '">' + RP.icone(x.tipo, 'ico-p') + RP.esc(nomeLocal(x.id)) + '</button>';
      }).join('') + '</div>' +
      '<div class="card pilha" style="margin-top:var(--esp-3)"><div class="linha-entre"><span class="fraco">Viagem a partir do castelo deles</span><b class="num">' + (cam ? '≈ ' + RP.fmtDuracao(cam.seg) : '—') + '</b></div>' +
      '<p class="fraco" style="font-size:var(--fs-2)">Se aceitarem, uma carroça deles traz a carga. Ela fica visível no mapa e pode ser roubada no caminho.</p></div><div style="height:var(--esp-8)"></div>';
    RP.$('.rodape-resumo', el).innerHTML = '<div class="resumo-linha"><b>' + RP.num(pr.q) + ' de ' + RP.nomeRecurso(pr.rec) + ' → ' + RP.esc(nomeLocal(pr.local)) + '</b></div><div class="resumo-linha fraco">pedido a ' + RP.esc(r.nome) + '</div>';
  }
  RP.registrarTela('pedido', {
    secao: 'mais',
    montar: function (el) {
      el.innerHTML = U.topo('Pedir recursos', 'alianca', 'A um aliado') + '<div class="conteudo-tela pd-conteudo"></div>' +
        '<div class="rodape-acao rodape-com-resumo"><div class="rodape-resumo"></div><button type="button" class="btn btn-primario btn-bloco btn-grande" data-pr-enviar>' + RP.icone('carroca') + 'Pedir</button></div>';
      el.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-pr-rec]'))) { pr.rec = b.getAttribute('data-pr-rec'); desenharPedido(el); return; }
        if ((b = e.target.closest('[data-pr-local]'))) { pr.local = b.getAttribute('data-pr-local'); desenharPedido(el); return; }
        if ((b = e.target.closest('[data-pr-d]'))) { pr.q = Math.max(100, Math.min(20000, pr.q + +b.getAttribute('data-pr-d') * 100)); desenharPedido(el); return; }
        if (e.target.closest('[data-pr-enviar]')) {
          var carga = {}; carga[pr.rec] = pr.q;
          var pd = { id: 'pd-' + Date.now(), de: 'meu', para: pr.reino, carga: carga, local: pr.local, motivo: '', horas: 0, estado: 'aberto' };
          D.pedidos.push(pd);
          var quem = reino(pr.reino).nome;
          RP.aviso({ titulo: 'Pedido enviado', texto: quem + ' recebe o pedido pelo sino.', icone: 'carroca', tipo: 'sucesso' });
          /* no protótipo, o aliado aceita depois de alguns segundos */
          setTimeout(function () {
            pd.estado = 'aceito';
            var m = ajudaChegando({ id: pd.id, de: pd.para, local: pd.local, carga: pd.carga });
            RP.aviso({ titulo: quem + ' aceitou', texto: RP.cargaTxt(pd.carga) + (m ? ' a caminho, chega em ' + RP.fmtDuracao(m.d.seg) : '') + '.', icone: 'estandarte', tipo: 'sucesso' });
            RP.invalidarTela('mapa'); if (tela && !tela.hidden) desenhar(tela);
          }, 3500);
          RP.ir('alianca');
        }
      });
    },
    entrar: function (el, params) { if (params.get('reino') && A.membros.indexOf(params.get('reino')) > 0) pr.reino = params.get('reino'); desenharPedido(el); }
  });
})();
