/* Reino de Pedra — Mensageiros e conversa da aliança.
   Sem chat geral: fora da aliança, mensagens vão por mensageiro, com bandeira branca (não é ataque),
   ocupando 1 de população. A mensagem revela quem a mandou; o destinatário só se revela se responder. */
(function () {
  'use strict';
  var RP = window.RP, D = RP.dados, W = RP.mundo, U = RP.util, MS = D.mensageiros;
  var CASTELO = { lumen: 'a-castelo', fenda: 'f-castelo', valdren: 'v-castelo', corvo: 'c-castelo', mirante: 'mi-castelo' };
  var tela = null;

  function reino(id) { return D.reinos[id]; }
  function nomeReino(id) { return id === 'meu' ? RP.estado.nome : reino(id).nome; }
  function brasao(id, t) { return RP.brasao(id === 'meu' ? RP.estado.brasao : reino(id).brasao, { tamanho: t || 32 }); }
  function hexDe(localId) { var x = W.local(localId); return [x.c, x.l]; }
  function meusEmCampo() { return W.marchas.filter(function (m) { return m.d.tipo === 'mensageiro' && m.d.dono === 'meu' && m.d.chegada > Date.now(); }).length; }
  RP.mensageirosLivres = function () { return Math.max(0, MS.total - meusEmCampo()); };
  function paraTxt(msg) { return msg.local ? 'dono da ' + W.nomeAparente(W.local(msg.local)) + ' (desconhecido)' : nomeReino(msg.para); }

  /* ---------------------------------------------------------------- mensageiros no mapa */
  function enviarMensageiro(msg, destinoLocal, jaAndou) {
    var cam = RP.caminho(hexDe(RP.SEDE), hexDe(destinoLocal), { vel: 'Rápida' });
    if (!cam) return null;
    var m = W.adicionarMarcha({ id: 'm-mens-' + msg.id, dono: 'meu', tipo: 'mensageiro', alvo: destinoLocal, msg: msg.id, paraTxt: paraTxt(msg),
      nome: 'Mensageiro', resumo: 'Bandeira branca · leva uma mensagem para ' + paraTxt(msg), seg: cam.seg }, cam.hexes);
    if (jaAndou) { var p = Math.round(m.d.seg * jaAndou); m.d.inicio -= p * 1000; m.d.chegada -= p * 1000; m.atual = m.posicao(); m.hex = m.atual.hex; }
    msg.marcha = m.d.id; msg.chegada = m.d.chegada; msg.cam = cam;
    return m;
  }
  function mensageiroChegando(de, texto, jaAndou) {
    var cam = RP.caminho(hexDe(CASTELO[de]), hexDe(RP.SEDE), { vel: 'Rápida' });
    if (!cam) return null;
    var m = W.adicionarMarcha({ id: 'm-mens-de-' + de + '-' + Date.now(), dono: de, tipo: 'mensageiro', alvo: RP.SEDE, paraTxt: 'Castelo de ' + RP.estado.nome, texto: texto, chegando: true,
      nome: 'Mensageiro de ' + reino(de).nome, resumo: 'Bandeira branca · traz uma mensagem', seg: cam.seg }, cam.hexes);
    if (jaAndou) { var p = Math.round(m.d.seg * jaAndou); m.d.inicio -= p * 1000; m.d.chegada -= p * 1000; m.atual = m.posicao(); m.hex = m.atual.hex; }
    return m;
  }
  /* exemplos: seu mensageiro a caminho da Ordem do Corvo; um da Casa Mirante chegando */
  (function () {
    var ms4 = { id: 'ms-4', de: 'meu', para: 'corvo', texto: 'Nosso pacto termina em 2 dias. Querem renovar por mais 3?', horas: 0, estado: 'a caminho' };
    D.mensagens.unshift(ms4);
    enviarMensageiro(ms4, CASTELO.corvo, 0.35);
    mensageiroChegando('mirante', 'Novas ofertas de prata no sino. Quem paga em madeira leva desconto.', 0.8);
  })();
  document.addEventListener('rp:tique', function () {
    var agora = Date.now(), mudou = false;
    W.marchas.forEach(function (m) {
      if (m.d.tipo !== 'mensageiro' || m.d.tratada || m.d.chegada > agora) return;
      m.d.tratada = true; mudou = true;
      if (m.d.chegando) {
        D.mensagens.unshift({ id: 'ms-' + agora, de: m.d.dono, texto: m.d.texto, horas: 0, lida: false });
        RP.aviso({ titulo: 'Mensageiro de ' + reino(m.d.dono).nome, texto: m.d.texto, icone: 'mensagem', tipo: 'info', ms: 4200 });
      } else if (m.d.msg) {
        var msg = D.mensagens.filter(function (q) { return q.id === m.d.msg; })[0];
        if (msg) msg.estado = 'entregue';
        RP.aviso({ titulo: 'Mensagem entregue', texto: 'O mensageiro volta para o castelo.', icone: 'mensagem', tipo: 'sucesso' });
        /* a volta: o mensageiro continua ocupado até chegar em casa */
        var volta = RP.caminho(hexDe(m.d.alvo), hexDe(RP.SEDE), { vel: 'Rápida' });
        if (volta) W.adicionarMarcha({ id: m.d.id + '-volta', dono: 'meu', tipo: 'mensageiro', alvo: RP.SEDE, voltando: true, tratada: true, paraTxt: 'Castelo de ' + RP.estado.nome,
          nome: 'Mensageiro voltando', resumo: 'Bandeira branca · mensagem entregue', seg: volta.seg }, volta.hexes);
      }
    });
    if (mudou) { ['mapa', 'agora', 'alianca'].forEach(RP.invalidarTela); if (tela && !tela.hidden) desenhar(tela); }
  });

  /* ---------------------------------------------------------------- tela Mensagens */
  function cardRecebida(msg) {
    return '<div class="card pilha msg-card' + (msg.lida ? '' : ' nova') + '"><div class="linha">' + brasao(msg.de, 30) + '<span style="flex:1;min-width:0"><b>' + RP.esc(nomeReino(msg.de)) + '</b><br><small class="fraco">' + RP.fmtHa(msg.horas) + ' · por mensageiro</small></span>' + (msg.lida ? '' : '<span class="selo selo-info">Nova</span>') + '</div>' +
      '<p class="msg-texto">“' + RP.esc(msg.texto) + '”</p><a class="btn btn-p" href="#/mensagem?para=' + msg.de + '">' + RP.icone('mensagem') + 'Responder</a></div>';
  }
  function cardEnviada(msg) {
    var indo = msg.estado === 'a caminho' && msg.chegada > Date.now();
    return '<div class="card pilha msg-card"><div class="linha">' + (msg.local ? RP.brasao(null, { tamanho: 30, desconhecido: true }) : brasao(msg.para, 30)) + '<span style="flex:1;min-width:0"><b>Para ' + RP.esc(paraTxt(msg)) + '</b><br><small class="fraco">' +
      (indo ? 'a caminho · entrega em <b class="num" data-fim="' + msg.chegada + '">' + RP.fmtResta(msg.chegada - Date.now()) + '</b>' : 'entregue' + (msg.horas ? ' ' + RP.fmtHa(msg.horas) : '') + (msg.local ? ' · sem resposta: o dono segue desconhecido' : '')) + '</small></span>' +
      (indo ? '<a class="btn btn-p" href="#/mapa?modo=cena&abrir=marcha:' + msg.marcha + '">' + RP.icone('vista') + 'Ver</a>' : '') + '</div><p class="msg-texto">“' + RP.esc(msg.texto) + '”</p></div>';
  }
  function desenhar(el) {
    var rec = D.mensagens.filter(function (m) { return m.de !== 'meu'; }), env = D.mensagens.filter(function (m) { return m.de === 'meu'; }), livres = RP.mensageirosLivres();
    RP.$('.msg-conteudo', el).innerHTML =
      '<div class="nota-regra">' + RP.icone('mensagem', 'ico-p') + '<span><b>Sem chat geral.</b> Para falar com outros reinos, mande um <b>mensageiro</b>: vai com bandeira branca e ninguém o ataca. A mensagem revela que foi você; quem recebe só se revela se responder. Na aliança, use a conversa.</span></div>' +
      '<div class="card linha-entre" style="margin-top:var(--esp-3)"><span class="linha"><span class="ico-placa">' + RP.icone('mensagem') + '</span><span><b>' + livres + ' de ' + MS.total + ' mensageiros livres</b><br><small class="fraco">Cada um ocupa 1 de população</small></span></span>' +
      '<button type="button" class="btn btn-p" data-treinar-mensageiro>' + RP.icone('mais') + 'Treinar</button></div>' +
      '<div class="linha" style="margin-top:var(--esp-3);flex-wrap:wrap"><a class="btn btn-p btn-primario" href="#/mensagem" style="flex:1 1 150px">' + RP.icone('mensagem') + 'Escrever</a>' +
      (RP.sistema('alianca') ? '<a class="btn btn-p" href="#/alianca" style="flex:1 1 150px">' + RP.icone('conversa') + 'Conversa da aliança</a>' : '') + '</div>' +
      '<div class="secao-titulo">Recebidas</div><div class="pilha">' + (rec.length ? rec.map(cardRecebida).join('') : '<p class="fraco">Nenhuma mensagem.</p>') + '</div>' +
      '<div class="secao-titulo">Enviadas</div><div class="pilha">' + (env.length ? env.map(cardEnviada).join('') : '<p class="fraco">Nenhuma mensagem enviada.</p>') + '</div><div style="height:var(--esp-8)"></div>';
    rec.forEach(function (m) { m.lida = true; });
  }
  RP.registrarTela('mensagens', {
    secao: 'mais',
    montar: function (el) {
      tela = el;
      el.innerHTML = U.topo('Mensagens', 'mais', 'Mensageiros e conversa da aliança') + '<div class="conteudo-tela msg-conteudo"></div>';
      el.addEventListener('click', function (e) {
        if (!e.target.closest('[data-treinar-mensageiro]')) return;
        if (RP.qtdRecurso('comida', RP.SEDE) < MS.custo.comida || RP.popAtual() < 1) { RP.aviso({ titulo: 'Sem recursos', texto: 'O mensageiro custa ' + MS.custo.comida + ' de comida no castelo e 1 de população.', icone: 'alerta', tipo: 'perigo' }); return; }
        RP.gastar({ comida: MS.custo.comida, populacao: 1 }, 1, RP.SEDE);
        MS.total++;
        RP.aviso({ titulo: 'Mensageiro treinado', texto: 'Pronto em 1 min. Ocupa 1 de população.', icone: 'mensagem', tipo: 'sucesso' });
        desenhar(el);
      });
    },
    entrar: function (el) { desenhar(el); }
  });

  /* ---------------------------------------------------------------- tela Escrever mensagem */
  var nova = { para: 'reino:valdren', texto: '' };
  function locaisDesconhecidos() {
    var c = hexDe(RP.SEDE);
    return D.locais.filter(function (x) { return x.reino !== 'meu' && !W.aliado(x.reino) && !x.espionado && W.estado(x.c, x.l).v !== 'desconhecido'; })
      .sort(function (a, b) { return RP.hex.dist([a.c, a.l], c) - RP.hex.dist([b.c, b.l], c); }).slice(0, 4);
  }
  function destinoLocal() { var p = nova.para.split(':'); return p[0] === 'reino' ? CASTELO[p[1]] : p[1]; }
  function desenharNova(el) {
    var conh = Object.keys(D.comercio.conhecidos), loc = locaisDesconhecidos(), dl = destinoLocal(), cam = dl ? RP.caminho(hexDe(RP.SEDE), hexDe(dl), { vel: 'Rápida' }) : null;
    var desconhecido = nova.para.indexOf('local:') === 0, livres = RP.mensageirosLivres();
    RP.$('.mn-conteudo', el).innerHTML =
      '<div class="secao-titulo" style="margin-top:0">Para</div><div class="escolhas escolhas-lista">' + conh.map(function (id) {
        return '<button type="button" class="escolha escolha-linha" data-mn-para="reino:' + id + '" aria-pressed="' + (nova.para === 'reino:' + id) + '">' + brasao(id, 30) + '<span class="escolha-txt"><b>' + RP.esc(reino(id).nome) + '</b><small class="fraco">' + (W.aliado(id) ? 'Aliado · também pela conversa da aliança' : 'Conhecido por ' + RP.esc(D.comercio.conhecidos[id])) + '</small></span></button>';
      }).join('') + loc.map(function (x) {
        return '<button type="button" class="escolha escolha-linha" data-mn-para="local:' + x.id + '" aria-pressed="' + (nova.para === 'local:' + x.id) + '"><span class="ico-placa dono-desconhecido">' + RP.icone(x.tipo) + '</span><span class="escolha-txt"><b>Dono da ' + RP.esc(W.nomeAparente(x)) + '</b><small class="fraco">Dono desconhecido · a mensagem chega a ele</small></span></button>';
      }).join('') + '</div>' +
      '<div class="secao-titulo">Mensagem</div><div class="campo"><label for="texto-mensagem">Texto</label><textarea id="texto-mensagem" maxlength="' + MS.max + '" rows="4" placeholder="Ex.: Podemos conversar sobre a estrada do norte?">' + RP.esc(nova.texto) + '</textarea>' +
      '<span class="campo-ajuda"><span data-mn-contador>' + nova.texto.length + '</span>/' + MS.max + ' · quem recebe vê seu brasão e nome</span></div>' +
      '<div class="card pilha" style="margin-top:var(--esp-3)"><div class="linha-entre"><span class="fraco">Entrega em</span><b class="num">' + (cam ? '≈ ' + RP.fmtDuracao(cam.seg) : '—') + '</b></div>' +
      '<div class="linha-entre"><span class="fraco">Mensageiros livres</span><b class="num">' + livres + ' de ' + MS.total + '</b></div>' +
      '<p class="fraco" style="font-size:var(--fs-2)">Vai a cavalo, com bandeira branca: fica claro no mapa que não é ataque, e tropas e fauna não o atacam. Depois de entregar, volta.' + (desconhecido ? ' Você não descobre quem é o dono, a menos que ele responda.' : '') + '</p></div><div style="height:var(--esp-8)"></div>';
    RP.$('.rodape-resumo', el).innerHTML = '<div class="resumo-linha"><b>Mensageiro → ' + RP.esc(desconhecido ? 'dono desconhecido' : reino(nova.para.split(':')[1]).nome) + '</b>' + (cam ? '<span class="tempo">' + RP.icone('relogio', 'ico-p') + RP.fmtDuracao(cam.seg) + '</span>' : '') + '</div>';
    RP.$('[data-mn-enviar]', el).classList.toggle('btn-inativo', !livres || !nova.texto.trim() || !cam);
  }
  RP.registrarTela('mensagem', {
    secao: 'mais',
    montar: function (el) {
      el.innerHTML = U.topo('Escrever mensagem', 'mensagens', 'Por mensageiro') + '<div class="conteudo-tela mn-conteudo"></div>' +
        '<div class="rodape-acao rodape-com-resumo"><div class="rodape-resumo"></div><button type="button" class="btn btn-primario btn-bloco btn-grande" data-mn-enviar>' + RP.icone('mensagem') + 'Enviar mensageiro</button></div>';
      el.addEventListener('input', function (e) {
        if (e.target.id !== 'texto-mensagem') return;
        nova.texto = e.target.value;
        RP.$('[data-mn-contador]', el).textContent = nova.texto.length;
        RP.$('[data-mn-enviar]', el).classList.toggle('btn-inativo', !RP.mensageirosLivres() || !nova.texto.trim());
      });
      el.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-mn-para]'))) { nova.para = b.getAttribute('data-mn-para'); desenharNova(el); return; }
        if (e.target.closest('[data-mn-enviar]')) {
          if (!nova.texto.trim()) { RP.aviso({ titulo: 'Mensagem vazia', texto: 'Escreva o que o mensageiro vai dizer.', icone: 'mensagem', tipo: 'alerta' }); return; }
          if (!RP.mensageirosLivres()) { RP.aviso({ titulo: 'Nenhum mensageiro livre', texto: 'Treine outro ou espere um voltar.', icone: 'mensagem', tipo: 'alerta' }); return; }
          var p = nova.para.split(':'), msg = { id: 'ms-' + Date.now(), de: 'meu', texto: nova.texto.trim(), horas: 0, estado: 'a caminho' };
          if (p[0] === 'reino') msg.para = p[1]; else msg.local = p[1];
          var m = enviarMensageiro(msg, destinoLocal());
          if (!m) return;
          D.mensagens.unshift(msg); nova.texto = '';
          RP.aviso({ titulo: 'Mensageiro a caminho', texto: 'Entrega em ' + RP.fmtDuracao(m.d.seg) + '. Acompanhe na Vista.', icone: 'mensagem', tipo: 'sucesso' });
          RP.invalidarTela('mapa');
          RP.ir('mensagens');
        }
      });
    },
    entrar: function (el, params) {
      var p = params.get('para'), l = params.get('local');
      if (p && D.comercio.conhecidos[p]) nova.para = 'reino:' + p;
      if (l) nova.para = 'local:' + l;
      desenharNova(el);
    }
  });

  /* ---------------------------------------------------------------- conversa da aliança (usada na tela Aliança) */
  RP.conversaHTML = function () {
    var C = D.alianca.conversa;
    return '<div class="card pilha conversa">' +
      '<ol class="conversa-lista">' + C.slice(-5).map(function (c) {
        return '<li class="' + (c.de === 'meu' ? 'minha' : '') + '">' + brasao(c.de, 22) + '<span><b>' + RP.esc(nomeReino(c.de)) + '</b> <small class="fraco">' + RP.fmtHa(c.horas) + '</small><br>' + RP.esc(c.texto) + '</span></li>';
      }).join('') + '</ol>' +
      '<div class="conversa-envio"><label class="sr" for="texto-conversa">Mensagem para a aliança</label><input id="texto-conversa" type="text" maxlength="' + MS.max + '" placeholder="Escreva para a aliança" autocomplete="off">' +
      '<button type="button" class="btn btn-p btn-primario" data-conversa-enviar>' + RP.icone('seta') + 'Enviar</button></div>' +
      '<p class="fraco" style="font-size:var(--fs-2)">O único chat do jogo: só membros leem. Para outros reinos, use um mensageiro.</p></div>';
  };
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-conversa-enviar]')) return;
    var box = e.target.closest('.conversa'), inp = RP.$('#texto-conversa', box), t = inp.value.trim();
    if (!t) return;
    D.alianca.conversa.push({ de: 'meu', texto: t, horas: 0 });
    box.outerHTML = RP.conversaHTML();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.id === 'texto-conversa') { var b = RP.$('[data-conversa-enviar]', e.target.closest('.conversa')); if (b) b.click(); }
  });

  /* pendências: mensagens novas (usadas em "Precisa de você") */
  RP.pendenciasMensagens = function () {
    return D.mensagens.filter(function (m) { return m.de !== 'meu' && !m.lida; }).map(function (m) {
      return { g: 'oportunidade', ic: 'mensagem', t: 'Mensagem de ' + reino(m.de).nome, d: '“' + RP.esc(m.texto.slice(0, 60)) + (m.texto.length > 60 ? '…' : '') + '”', href: '#/mensagens', bt: 'Ler' };
    });
  };
})();
