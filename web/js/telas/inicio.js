/* Reino de Pedra — entrada: cena, login e cadastro com e-mail e senha. */
(function () {
  'use strict';
  var RP = window.RP, H = RP.hex;

  function cenaEntrada() {
    var estrelas = '', brasas = '', i;
    for (i = 0; i < 28; i++) estrelas += '<circle cx="' + (H.hash(i, 1, 1) * 390).toFixed(0) + '" cy="' + (H.hash(i, 2, 1) * 190).toFixed(0) + '" r="' + (0.6 + H.hash(i, 3, 1) * 1.1).toFixed(1) + '"/>';
    for (i = 0; i < 14; i++) brasas += '<circle cx="' + (150 + H.hash(i, 4, 2) * 100).toFixed(0) + '" cy="' + (150 + H.hash(i, 5, 2) * 120).toFixed(0) + '" r="' + (0.8 + H.hash(i, 6, 2) * 1.4).toFixed(1) + '"/>';
    return '<svg class="cena" viewBox="0 0 390 420" preserveAspectRatio="xMidYMax slice" aria-hidden="true">' +
      '<defs><linearGradient id="cena-ceu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="ceu-1"/><stop offset=".62" class="ceu-2"/><stop offset="1" class="ceu-3"/></linearGradient>' +
      '<radialGradient id="cena-brilho"><stop offset="0" class="brilho-1"/><stop offset="1" class="brilho-2"/></radialGradient></defs>' +
      '<rect width="390" height="420" fill="url(#cena-ceu)"/><g class="cena-estrelas">' + estrelas + '</g>' +
      '<circle cx="200" cy="268" r="150" fill="url(#cena-brilho)"/>' +
      '<path class="cena-monte-3" d="M0 300 40 250 70 270 110 215 150 255 190 228 230 262 275 205 320 250 350 232 390 262V420H0Z"/>' +
      '<path class="cena-neve" d="M110 215 101 226 108 224 113 230 118 225 123 228ZM275 205 265 217 272 215 277 221 282 214 288 219Z"/>' +
      '<path class="cena-monte-2" d="M0 334 45 292 80 312 120 288 152 304V420H0ZM238 304 280 272 320 298 355 278 390 300V420H238Z"/>' +
      '<path class="cena-monte-1" d="M0 420V338C60 326 120 304 160 300 190 296 230 296 260 304 310 316 350 332 390 338V420Z"/>' +
      '<path class="cena-rota" d="M24 420C64 392 112 378 150 360 176 348 190 330 195 305"/>' +
      '<path class="cena-castelo" d="M130 304V232H136V240H140V232H146V240H150V232H156V268H162V262H168V268H172V262H178V268H180V204H186V212H192V204H198V212H204V204H210V268H216V262H222V268H226V262H232V268H234V232H240V240H244V232H250V240H254V232H260V304Z"/>' +
      '<path class="cena-portao" d="M187 304V288a8 8 0 0 1 16 0V304Z"/>' +
      '<path class="cena-mastro" d="M195 204V178"/><path class="cena-flamula" d="M195 179H216L210 185 216 191H195Z"/>' +
      '<g class="cena-brasas">' + brasas + '</g></svg>';
  }

  function textoTemporada() {
    var m = RP.mundo;
    if (!m) return 'Servidor indisponível no momento.';
    var resta = Math.max(0, Math.ceil((m.fim - RP.agora()) / 86400000));
    return 'Temporada ' + m.temporada + ' · termina em ' + resta + ' dias · ' + (m.vagas ? 'há vaga para novos reinos' : 'mundo cheio: novos reinos só na próxima temporada');
  }

  function formulario(modo) {
    var cadastro = modo === 'cadastro';
    return '<form class="pilha-4 card entrada-form" novalidate data-form="' + modo + '">' +
      '<h2>' + (cadastro ? 'Criar conta' : 'Entrar') + '</h2>' +
      '<div class="campo"><label for="ent-email">E-mail</label><input id="ent-email" name="email" type="email" autocomplete="email" inputmode="email" required maxlength="254"></div>' +
      '<div class="campo"><label for="ent-senha">Senha</label><input id="ent-senha" name="senha" type="password" autocomplete="' + (cadastro ? 'new-password' : 'current-password') + '" required minlength="' + (cadastro ? 10 : 1) + '" maxlength="128">' +
      (cadastro ? '<span class="campo-ajuda">Pelo menos 10 caracteres. Uma frase longa é mais segura e fácil de lembrar.</span>' : '') +
      '<span class="campo-erro" role="alert"></span></div>' +
      '<button type="submit" class="btn btn-primario btn-bloco btn-grande">' + RP.icone(cadastro ? 'castelo' : 'avancar') + (cadastro ? 'Criar conta' : 'Entrar') + '</button>' +
      '<button type="button" class="btn btn-fantasma btn-bloco" data-trocar="' + (cadastro ? 'entrar' : 'cadastro') + '">' + (cadastro ? 'Já tenho conta' : 'Criar uma conta nova') + '</button>' +
      '</form>';
  }

  RP.registrarTela('inicio', {
    publica: true,
    montar: function (el) {
      el.innerHTML = '<div class="inicio-cena">' + cenaEntrada() + '</div><div class="inicio-conteudo">' +
        '<h1 class="titulo-jogo">Reino de Pedra</h1><p class="subtitulo-jogo">Estratégia e Conquista</p>' +
        '<div class="inicio-acoes" data-acoes></div>' +
        '<p class="inicio-temporada">' + RP.icone('temporada', 'ico-p') + '<span data-temporada></span></p></div>';
      el.addEventListener('click', function (e) {
        var t = e.target.closest('[data-trocar]');
        if (t) { mostrar(el, t.getAttribute('data-trocar')); }
        if (e.target.closest('[data-continuar]')) RP.ir('reino');
        if (e.target.closest('[data-sair]')) RP.sair();
      });
      el.addEventListener('submit', function (e) {
        e.preventDefault();
        var f = e.target, modo = f.getAttribute('data-form');
        var email = f.email.value.trim(), senha = f.senha.value, erro = RP.$('.campo-erro', f), bt = RP.$('[type=submit]', f);
        erro.textContent = '';
        if (!email || !senha) { erro.textContent = 'Preencha e-mail e senha.'; return; }
        bt.disabled = true;
        RP.post(modo === 'cadastro' ? '/conta/registrar' : '/conta/entrar', { email: email, senha: senha }, { sem401: true })
          .then(function () { return RP.entrarNoJogo(); })
          .then(function () { RP.ir(RP.reino ? 'reino' : 'criar'); RP.rotear(); })
          .catch(function (x) { erro.textContent = x.message; })
          .then(function () { bt.disabled = false; });
      });
    },
    entrar: function (el) {
      RP.$('[data-temporada]', el).textContent = textoTemporada();
      mostrar(el, RP.conta ? 'logado' : 'entrar');
    }
  });

  function mostrar(el, modo) {
    var a = RP.$('[data-acoes]', el);
    if (modo === 'logado') {
      a.innerHTML = (RP.reino
        ? '<button type="button" class="btn btn-primario btn-bloco btn-grande" data-continuar>' + RP.icone('castelo') + 'Continuar como ' + RP.esc(RP.reino.nome) + '</button>'
        : '<a class="btn btn-primario btn-bloco btn-grande" href="#/criar">' + RP.icone('castelo') + 'Fundar meu reino</a>') +
        '<button type="button" class="btn btn-bloco" data-sair>Sair da conta ' + RP.esc(RP.conta.email || '') + '</button>';
      return;
    }
    a.innerHTML = formulario(modo);
    var inp = RP.$('#ent-email', a); if (inp) setTimeout(function () { inp.focus(); }, 30);
  }
})();
