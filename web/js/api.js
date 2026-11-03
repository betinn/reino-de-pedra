/* Reino de Pedra — acesso à API do servidor (/api/v1) e avisos em tempo real (SSE).
   A sessão é um cookie HttpOnly (o script não vê o token). Toda escrita leva o cabeçalho X-Reino: 1. */
(function () {
  'use strict';
  var RP = (window.RP = window.RP || {});
  var BASE = '/api/v1';

  function erroDe(resp, corpo) {
    var e = new Error((corpo && corpo.erro) || (resp.status === 429 ? 'Muitas tentativas. Espere um pouco.' : 'Algo deu errado (' + resp.status + ').'));
    e.status = resp.status; e.corpo = corpo;
    return e;
  }

  RP.api = function (metodo, caminho, corpo, opcoes) {
    opcoes = opcoes || {};
    var h = { 'X-Reino': '1' };
    var body;
    if (corpo instanceof Blob) { body = corpo; h['Content-Type'] = corpo.type || 'application/octet-stream'; }
    else if (corpo !== undefined) { body = JSON.stringify(corpo); h['Content-Type'] = 'application/json'; }
    return fetch(BASE + caminho, { method: metodo, headers: h, body: body, credentials: 'same-origin', cache: 'no-store' })
      .then(function (resp) {
        if (resp.status === 204) return null;
        var tipo = resp.headers.get('Content-Type') || '';
        var p = tipo.indexOf('json') >= 0 ? resp.json().catch(function () { return null; }) : Promise.resolve(null);
        return p.then(function (j) {
          if (!resp.ok) {
            if (resp.status === 401 && !opcoes.sem401 && RP.aoSair) RP.aoSair();
            throw erroDe(resp, j);
          }
          return j;
        });
      });
  };
  RP.get = function (c, o) { return RP.api('GET', c, undefined, o); };
  RP.post = function (c, b, o) { return RP.api('POST', c, b === undefined ? {} : b, o); };
  RP.put = function (c, b) { return RP.api('PUT', c, b); };
  RP.del = function (c) { return RP.api('DELETE', c); };

  /* mostra o erro do servidor como aviso; devolve a promessa para encadear */
  RP.tentar = function (p) {
    return p.catch(function (e) { RP.aviso({ titulo: e.message, icone: 'alerta', tipo: 'perigo' }); throw e; });
  };

  /* ---------------------------------------------------------------- tempo do servidor
     O relógio do servidor é a verdade: guardamos o último instante dele e quando chegou. Com o tempo acelerado
     de desenvolvimento (REINO_ACELERACAO, vem em GET /mundo), o relógio daqui anda na mesma velocidade do servidor. */
  var baseServidor = 0, baseLocal = 0;
  RP.aceleracao = 1;
  RP.agora = function () { return baseLocal ? baseServidor + (Date.now() - baseLocal) * RP.aceleracao : Date.now(); };
  RP.sincronizar = function (agoraServidor) { if (agoraServidor) { baseServidor = agoraServidor; baseLocal = Date.now(); } };

  /* ---------------------------------------------------------------- avisos em tempo real */
  var fonte = null, ouvintes = {};
  RP.ouvir = function (tipo, f) { (ouvintes[tipo] = ouvintes[tipo] || []).push(f); };
  function emitir(tipo, dados) { (ouvintes[tipo] || []).concat(ouvintes['*'] || []).forEach(function (f) { try { f(dados, tipo); } catch (e) { console.error(e); } }); }
  RP.conectarEventos = function () {
    if (fonte || !window.EventSource) return;
    fonte = new EventSource(BASE + '/eventos');
    var tipos = ['ola', 'reino', 'marchas', 'mapa', 'relatorio', 'notificacao', 'mensagem', 'batalha', 'alianca', 'comercio'];
    tipos.forEach(function (t) {
      fonte.addEventListener(t, function (ev) { var d = {}; try { d = JSON.parse(ev.data); } catch (e) { /* vazio */ } emitir(t, d); });
    });
    fonte.onerror = function () { /* o navegador reconecta sozinho (retry do servidor) */ };
    /* outra aba ou aparelho abriu uma conexão nova e o servidor fechou esta (teto por conta): só volta quando esta aba aparecer */
    fonte.addEventListener('substituida', function () { RP.desconectarEventos(); substituida = true; });
  };
  var substituida = false;
  document.addEventListener('visibilitychange', function () {
    if (substituida && document.visibilityState === 'visible') { substituida = false; RP.conectarEventos(); if (RP.recarregarReino) RP.recarregarReino(); }
  });
  RP.desconectarEventos = function () { if (fonte) { fonte.close(); fonte = null; } };
  /* sistemas novos podem ouvir tipos extras de aviso */
  RP.ouvirTipoSse = function (t) { if (fonte) fonte.addEventListener(t, function (ev) { var d = {}; try { d = JSON.parse(ev.data); } catch (e) { /* vazio */ } emitir(t, d); }); };
})();
