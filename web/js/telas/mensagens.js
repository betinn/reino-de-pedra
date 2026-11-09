/* Reino de Pedra — Mensagens (#/mensagens) e Escrever (#/mensagem?para=<reino>&responde=<id>).
   Sem chat geral: fora da aliança, mensagens vão por mensageiro, com bandeira branca (ninguém o ataca), ocupando
   1 de população. Porte de prototipo/js/mensagens.js. */
(function () {
  'use strict';
  var RP = window.RP, S = RP.social;
  var dados = null;

  function carregar() { return RP.get('/mensagens').then(function (d) { dados = d; RP.sincronizar(d.agora); return d; }); }
  function quando(ms) { return RP.fmtHa((RP.agora() - ms) / 3600000); }

  function cardRecebida(m) {
    return '<div class="card pilha msg-card' + (m.lida ? '' : ' nova') + '"><div class="linha">' + S.brasao(m.de, 30) + '<span style="flex:1;min-width:0"><b>' + RP.esc(S.nome(m.de)) + '</b><br><small class="fraco">' + quando(m.quando) + ' · por mensageiro</small></span>' + (m.lida ? '' : '<span class="selo selo-info">Nova</span>') + '</div>' +
      '<p class="msg-texto">“' + RP.esc(m.texto) + '”</p><a class="btn btn-p" href="#/mensagem?responde=' + m.id + '">' + RP.icone('mensagem') + 'Responder</a></div>';
  }
  function cardEnviada(m) {
    var ag = RP.agora(), indo = m.estado === 'a-caminho' && m.chegada && m.chegada > ag;
    var para = m.para ? RP.esc(m.para.nome) : m.local ? 'dono de ' + RP.esc(m.local.nome) : 'reino';
    var est = indo ? 'a caminho · entrega ' + RP.barraTempo(m.partida, m.chegada, { classe: 'curta', rotulo: 'Mensageiro a caminho' })
      : m.estado === 'sem-destinatario' ? 'ninguém recebeu: o local não tinha mais dono'
      : 'entregue' + (m.entregue ? ' ' + quando(m.entregue) : '');
    return '<div class="card pilha msg-card"><div class="linha">' + S.brasao(m.para, 30) + '<span style="flex:1;min-width:0"><b>Para ' + para + '</b><br><small class="fraco">' + est + '</small></span>' +
      (indo && m.marcha ? '<a class="btn btn-p" href="#/mapa?modo=tatico">' + RP.icone('vista') + 'Ver</a>' : '') + '</div><p class="msg-texto">“' + RP.esc(m.texto) + '”</p></div>';
  }
  function desenhar(el) {
    return carregar().then(function (d) {
      var total = d.livres + d.emCampo.length;
      RP.$('.msg-conteudo', el).innerHTML =
        '<div class="nota-regra">' + RP.icone('mensagem', 'ico-p') + '<span><b>Sem chat geral.</b> Para falar com outros reinos, mande um <b>mensageiro</b>: vai com bandeira branca e ninguém o ataca. Na aliança, use a conversa.</span></div>' +
        '<div class="card linha-entre" style="margin-top:var(--esp-3)"><span class="linha"><span class="ico-placa">' + RP.icone('mensagem') + '</span><span><b>' + d.livres + ' de ' + total + ' mensageiros livres</b><br><small class="fraco">' +
        (d.emTreino ? d.emTreino + ' em treino · ' : '') + 'cada um ocupa ' + d.pop + ' de população · ' + RP.custoHTML(d.custo) + '</small></span></span>' +
        '<button type="button" class="btn btn-p" data-treinar-mensageiro>' + RP.icone('mais') + 'Treinar</button></div>' +
        (function () { var t = RP.itensFilaHTML ? RP.itensFilaHTML('recrutamento', function (i) { return i.tipo === 'mensageiro'; }) : ''; return t ? '<div class="card pilha" style="margin-top:var(--esp-2)">' + t + '</div>' : ''; })() +
        '<div class="linha" style="margin-top:var(--esp-3);flex-wrap:wrap"><a class="btn btn-p btn-primario" href="#/mensagem" style="flex:1 1 150px">' + RP.icone('mensagem') + 'Escrever</a>' +
        '<a class="btn btn-p" href="#/alianca" style="flex:1 1 150px">' + RP.icone('conversa') + 'Conversa da aliança</a></div>' +
        '<div class="secao-titulo">Recebidas</div><div class="pilha">' + (d.recebidas.length ? d.recebidas.map(cardRecebida).join('') : S.vazio('Nenhuma mensagem.')) + '</div>' +
        '<div class="secao-titulo">Enviadas</div><div class="pilha">' + (d.enviadas.length ? d.enviadas.map(cardEnviada).join('') : S.vazio('Nenhuma mensagem enviada.')) + '</div><div style="height:var(--esp-8)"></div>';
      if (d.recebidas.some(function (m) { return !m.lida; })) RP.post('/mensagens/lidas').then(function () { RP.recarregarReino(); }).catch(function () { /* offline */ });
    }).catch(function (e) { RP.$('.msg-conteudo', el).innerHTML = S.vazio(RP.esc(e.message)); });
  }
  RP.registrarTela('mensagens', {
    secao: 'mais',
    montar: function (el) {
      el.innerHTML = RP.topoVoltar('Mensagens', 'mais', 'Mensageiros e conversa da aliança') + '<div class="conteudo-tela msg-conteudo"></div>';
      el.addEventListener('click', function (e) {
        if (!e.target.closest('[data-treinar-mensageiro]')) return;
        RP.tentar(RP.post('/mensageiros/treinar', { qtd: 1 })).then(function (it) {
          RP.aviso({ titulo: it.aguardando ? 'Mensageiro na fila' : 'Mensageiro em treino', texto: it.aguardando ? RP.textoFilaItem(it) : 'Pronto em ' + RP.fmtDuracao(it.duracao) + '. Ocupa ' + dados.pop + ' de população.', icone: 'mensagem', tipo: 'sucesso' });
          RP.recarregarReino(); desenhar(el);
        }).catch(function () { /* aviso já mostrado */ });
      });
    },
    entrar: function (el) { desenhar(el); }
  });
  document.addEventListener('rp:social', function (e) { if (e.detail === 'mensagem') S.redesenhar('mensagens', desenhar); });

  /* ---------------------------------------------------------------- Escrever mensagem */
  var nova = { para: null, texto: '', responde: null };
  function desenharNova(el) {
    var d = dados, max = d.max, resp = nova.responde ? d.recebidas.filter(function (m) { return m.id === nova.responde; })[0] : null;
    if (resp) nova.para = resp.de.id;
    var reinos = d.destinos.reinos;
    if (!nova.para) nova.para = reinos.length ? reinos[0].reino.id : null;
    RP.$('.mn-conteudo', el).innerHTML =
      (resp ? '<div class="card pilha"><small class="fraco">Respondendo a ' + RP.esc(S.nome(resp.de)) + '</small><p class="msg-texto">“' + RP.esc(resp.texto) + '”</p></div>'
        : '<div class="secao-titulo" style="margin-top:0">Para</div><div class="escolhas escolhas-lista">' + reinos.map(function (x) {
          return '<button type="button" class="escolha escolha-linha" data-mn-para="' + x.reino.id + '" aria-pressed="' + (nova.para === x.reino.id) + '">' + S.brasao(x.reino, 30) + '<span class="escolha-txt"><b>' + RP.esc(x.reino.nome) + '</b><small class="fraco">' + (x.aliado ? 'Aliado · também pela conversa da aliança' : 'Vai ao castelo dele') + '</small></span></button>';
        }).join('') + '</div>' + (!reinos.length ? S.vazio('Nenhum outro reino no mundo agora.') : '')) +
      '<div class="secao-titulo">Mensagem</div><div class="campo"><label for="texto-mensagem">Texto</label><textarea id="texto-mensagem" maxlength="' + max + '" rows="4" placeholder="Ex.: Podemos conversar sobre a estrada do norte?">' + RP.esc(nova.texto) + '</textarea>' +
      '<span class="campo-ajuda"><span data-mn-contador>' + nova.texto.length + '</span>/' + max + ' · quem recebe vê seu brasão e nome</span></div>' +
      '<div class="card pilha" style="margin-top:var(--esp-3)"><div class="linha-entre"><span class="fraco">Mensageiros livres</span><b class="num">' + d.livres + ' de ' + (d.livres + d.emCampo.length) + '</b></div>' +
      '<p class="fraco" style="font-size:var(--fs-2)">Vai a cavalo, com bandeira branca: fica claro no mapa que não é ataque, e tropas e fauna não o atacam. Depois de entregar, volta.</p></div><div style="height:var(--esp-8)"></div>';
    var alvo = resp ? S.nome(resp.de) : ((reinos.filter(function (x) { return x.reino.id === nova.para; })[0] || {}).reino || {}).nome || '—';
    RP.$('.rodape-resumo', el).innerHTML = '<div class="resumo-linha"><b>Mensageiro → ' + RP.esc(alvo) + '</b></div>';
    RP.$('[data-mn-enviar]', el).classList.toggle('btn-inativo', !d.livres || !nova.texto.trim() || !nova.para);
  }
  RP.registrarTela('mensagem', {
    secao: 'mais',
    montar: function (el) {
      el.innerHTML = RP.topoVoltar('Escrever mensagem', 'mensagens', 'Por mensageiro') + '<div class="conteudo-tela mn-conteudo"></div>' +
        '<div class="rodape-acao rodape-com-resumo"><div class="rodape-resumo"></div><button type="button" class="btn btn-primario btn-bloco btn-grande" data-mn-enviar>' + RP.icone('mensagem') + 'Enviar mensageiro</button></div>';
      el.addEventListener('input', function (e) {
        if (e.target.id !== 'texto-mensagem') return;
        nova.texto = e.target.value;
        RP.$('[data-mn-contador]', el).textContent = nova.texto.length;
        RP.$('[data-mn-enviar]', el).classList.toggle('btn-inativo', !dados.livres || !nova.texto.trim() || !nova.para);
      });
      el.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-mn-para]'))) { nova.para = +b.getAttribute('data-mn-para'); desenharNova(el); return; }
        if (e.target.closest('[data-mn-enviar]')) {
          if (!nova.texto.trim()) { RP.aviso({ titulo: 'Mensagem vazia', texto: 'Escreva o que o mensageiro vai dizer.', icone: 'mensagem', tipo: 'alerta' }); return; }
          if (!dados.livres) { RP.aviso({ titulo: 'Nenhum mensageiro livre', texto: 'Treine outro ou espere um voltar.', icone: 'mensagem', tipo: 'alerta' }); return; }
          var corpo = { texto: nova.texto.trim() };
          if (nova.responde) corpo.respondeA = nova.responde; else corpo.reinoId = nova.para;
          RP.tentar(RP.post('/mensagens', corpo)).then(function (x) {
            nova.texto = ''; nova.responde = null;
            RP.aviso({ titulo: 'Mensageiro a caminho', texto: x.chegada ? 'Entrega ' + RP.fmtHora(x.chegada) + '.' : '', icone: 'mensagem', tipo: 'sucesso' });
            if (RP.mapaModelo) RP.mapaModelo.velho = true;
            RP.ir('mensagens');
          }).catch(function () { /* aviso já mostrado */ });
        }
      });
    },
    entrar: function (el, params) {
      nova.responde = params.get('responde') ? +params.get('responde') : null;
      if (params.get('para')) nova.para = +params.get('para');
      carregar().then(function () { desenharNova(el); }).catch(function (e) { RP.$('.mn-conteudo', el).innerHTML = S.vazio(RP.esc(e.message)); });
    }
  });
})();
