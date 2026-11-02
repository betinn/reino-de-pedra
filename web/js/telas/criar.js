/* Reino de Pedra — fundação do reino: nome escolhido pelo jogador e ícone (brasão sorteado, editado ou imagem própria). */
(function () {
  'use strict';
  var RP = window.RP;
  var rascunho = null, sorteados = [], legado = null;
  /* sem o legado (offline), só as tinturas e formas básicas */
  RP.TINTURAS_LISTA = Object.keys(RP.TINTURAS).filter(function (k) { return !RP.TINTURAS[k].extra; });
  function formasLiberadas() { return legado ? legado.brasao.formas : Object.keys(RP.FORMAS).filter(function (k) { return !RP.FORMAS[k].extra; }); }
  function tinturasLiberadas() { return legado ? legado.brasao.tinturas : RP.TINTURAS_LISTA; }

  function validarNome(n) {
    n = (n || '').trim().replace(/\s+/g, ' ');
    if (n.length < 3 || n.length > 24) return 'O nome precisa ter de 3 a 24 letras.';
    if (!/^[\p{L}][\p{L}\p{M} '\-]{1,22}[\p{L}\p{M}]$/u.test(n)) return 'Use só letras, espaços, hífen e apóstrofo.';
    return '';
  }

  /* reduz a imagem para no máximo 256 × 256 e gera PNG (o servidor só aceita imagens pequenas) */
  function prepararImagem(arquivo) {
    return new Promise(function (ok, falha) {
      if (!/^image\/(png|jpeg|webp|gif)$/.test(arquivo.type)) { falha(new Error('Escolha uma imagem PNG, JPEG ou WebP.')); return; }
      var url = URL.createObjectURL(arquivo), img = new Image();
      img.onload = function () {
        var lado = 256, s = Math.min(1, lado / Math.max(img.width, img.height));
        var w = Math.max(16, Math.round(img.width * s)), h = Math.max(16, Math.round(img.height * s));
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        cv.toBlob(function (b) { if (b) ok(b); else falha(new Error('Não deu para ler a imagem.')); }, 'image/png');
      };
      img.onerror = function () { URL.revokeObjectURL(url); falha(new Error('Não deu para ler a imagem.')); };
      img.src = url;
    });
  }

  function previa(el) {
    var p = RP.$('.criar-previa-brasao', el);
    if (rascunho.imagem) p.innerHTML = '<img class="icone-proprio" src="' + rascunho.imagemUrl + '" alt="Ícone do reino" width="112" height="112">';
    else p.innerHTML = RP.brasao(rascunho.brasao, { tamanho: 112 });
    RP.$('.criar-previa-nome', el).textContent = rascunho.nome.trim() || 'Seu reino';
    var erro = validarNome(rascunho.nome);
    RP.$('.campo-erro', el).textContent = rascunho.tocado ? erro : '';
    RP.$('[data-fundar]', el).classList.toggle('btn-inativo', !!erro);
    RP.$$('[data-sorteado]', el).forEach(function (b) { b.setAttribute('aria-pressed', String(!rascunho.imagem && +b.getAttribute('data-sorteado') === rascunho.escolhido)); });
    RP.$('[data-editor]', el).hidden = !!rascunho.imagem;
    RP.$$('[data-campo]', el).forEach(function (b) {
      var c = b.getAttribute('data-campo').split(':');
      b.setAttribute('aria-pressed', String(rascunho.brasao[c[0]] === c[1]));
    });
    RP.$$('[data-moldura]', el).forEach(function (b) { b.setAttribute('aria-pressed', String(!!rascunho.brasao.moldura)); });
    RP.$$('[data-regiao]', el).forEach(function (b) { b.setAttribute('aria-pressed', String((rascunho.regiao || '') === b.getAttribute('data-regiao'))); });
  }

  /* editor do brasão e escolha de região conforme a linhagem (GET /temporada) */
  function montarLegado(el) {
    var forma = function (f) { return RP.brasao(Object.assign({}, rascunho.brasao, { forma: f, moldura: false }), { tamanho: 30, semSimbolo: true }); };
    var L = legado, lin = L ? L.linhagem.nivel : 1;
    var nivelDe = function (k) { var d = L && L.linhagem.desbloqueios.filter(function (x) { return x.chave === k; })[0]; return d ? d.nivel : '?'; };
    RP.$('[data-ed-forma]', el).innerHTML = grade('forma', formasLiberadas(), forma);
    ['cor1', 'cor2', 'corSimbolo'].forEach(function (k) { RP.$('[data-ed-' + k + ']', el).innerHTML = grade(k, tinturasLiberadas()); });
    RP.$('[data-ed-nota]', el).innerHTML = L && L.brasao.extras ? '<span class="selo selo-visivel">' + RP.icone('check') + 'Cores e formas da linhagem</span>'
      : '<span class="fraco">Cores e formas extras liberam no nível ' + nivelDe('brasoes') + ' da linhagem.</span>';
    RP.$('[data-ed-moldura]', el).innerHTML = L && L.brasao.moldura
      ? '<button type="button" class="alternar" data-moldura aria-pressed="false" style="width:100%">' + RP.icone('coroa') + '<span>Brasão da casa: moldura de linhagem</span><i aria-hidden="true"></i></button>' : '';
    var hist = (L && L.brasoes) || [];
    RP.$('[data-historico]', el).innerHTML = hist.length ? '<span class="rotulo">Seus brasões de temporadas antigas</span><div class="opcoes opcoes-4">' + hist.map(function (b, i) {
      return '<button type="button" class="opcao" data-historico-i="' + i + '" aria-label="' + RP.esc(b.nome) + '">' + RP.brasao(b.brasao, { tamanho: 44 }) + '</button>';
    }).join('') + '</div>' : '';
    RP.$('[data-regiao-bloco]', el).innerHTML = L && L.regiaoInicial
      ? '<div class="linha">' + RP.icone('bussola') + '<div style="flex:1"><b>Região inicial</b><div class="fraco" style="font-size:var(--fs-2)">Linhagem nível ' + lin + ': escolha onde fundar. Sem vaga livre ali, vale a mais perto.</div></div></div>' +
        '<div class="regioes" role="group" aria-label="Região inicial">' + [{ id: '', nome: 'Aleatória' }].concat(L.regioes).map(function (r) {
          return '<button type="button" class="aba" data-regiao="' + r.id + '" aria-pressed="' + ((rascunho.regiao || '') === r.id) + '">' + RP.esc(r.nome) + '</button>';
        }).join('') + '</div>'
      : '<div class="linha">' + RP.icone('bussola') + '<div style="flex:1"><b>Região inicial: aleatória</b><div class="fraco" style="font-size:var(--fs-2)">A escolha de região libera no nível ' + nivelDe('regiao') + ' da linhagem.</div></div></div>';
    previa(el);
  }

  function grade(campo, lista, desenho) {
    return lista.map(function (v) {
      return '<button type="button" class="' + (desenho ? 'opcao' : 'amostra') + '" data-campo="' + campo + ':' + v + '" aria-label="' + v + '"' +
        (desenho ? '' : ' style="background:var(--tin-' + v + ')"') + '>' + (desenho ? desenho(v) : '') + '</button>';
    }).join('');
  }

  function sortear(el) {
    return RP.get('/reino/brasoes?n=8').then(function (l) {
      sorteados = l; rascunho.escolhido = 0; rascunho.brasao = Object.assign({}, l[0]); rascunho.imagem = null;
      RP.$('[data-sorteados]', el).innerHTML = l.map(function (b, i) {
        return '<button type="button" class="opcao" data-sorteado="' + i + '" aria-label="Brasão ' + (i + 1) + '">' + RP.brasao(b, { tamanho: 44 }) + '</button>';
      }).join('');
      previa(el);
    });
  }

  RP.registrarTela('criar', {
    semReino: true,
    montar: function (el) {
      rascunho = { nome: '', tocado: false, escolhido: 0, imagem: null, regiao: '', brasao: { forma: 'portugues', divisao: 'cortado', cor1: 'azul', cor2: 'vermelho', simbolo: 'torre', corSimbolo: 'ouro' } };
      var divisao = function (d) { return RP.brasao(Object.assign({}, rascunho.brasao, { divisao: d }), { tamanho: 30, semSimbolo: true }); };
      var simbolo = function (s) { return RP.brasao(Object.assign({}, rascunho.brasao, { simbolo: s, divisao: 'pleno' }), { tamanho: 30 }); };
      el.innerHTML =
        '<header class="topo"><a class="btn btn-fantasma btn-icone" href="#/inicio" aria-label="Voltar">' + RP.icone('voltar') + '</a><h1>Fundar reino</h1></header>' +
        '<div class="conteudo-tela pilha-4">' +
        '<div class="card card-moldura criar-previa"><div class="criar-previa-brasao"></div><p class="criar-previa-nome"></p></div>' +
        '<div class="campo"><label for="nome-reino">Nome do reino</label>' +
        '<input id="nome-reino" type="text" maxlength="24" autocomplete="off" autocapitalize="words" placeholder="Ex.: Pedralva" enterkeyhint="done">' +
        '<span class="campo-ajuda">De 3 a 24 letras. Outros jogadores só verão este nome quando você levar seu estandarte.</span><span class="campo-erro" role="alert"></span></div>' +
        '<div class="secao-titulo">Ícone do reino</div>' +
        '<div class="pilha"><div class="linha-entre"><span class="rotulo">Escolha um brasão</span><button type="button" class="btn btn-p" data-sortear>' + RP.icone('seta') + 'Sortear outros</button></div>' +
        '<div class="opcoes opcoes-4" data-sorteados></div><div class="pilha" data-historico></div></div>' +
        '<div class="pilha"><span class="rotulo">Ou envie uma imagem</span>' +
        '<label class="btn btn-p" for="icone-arquivo">' + RP.icone('subir') + 'Enviar imagem</label>' +
        '<input id="icone-arquivo" type="file" accept="image/png,image/jpeg,image/webp" hidden>' +
        '<span class="campo-ajuda">PNG, JPEG ou WebP. A imagem é reduzida para 256 × 256.</span><span class="campo-erro" data-erro-img role="alert"></span></div>' +
        '<details class="pilha" data-editor><summary class="rotulo">Ajustar o brasão</summary>' +
        '<div data-ed-nota></div>' +
        '<div class="pilha"><span class="rotulo">Forma</span><div class="opcoes opcoes-3" data-ed-forma></div></div>' +
        '<div class="pilha"><span class="rotulo">Divisão</span><div class="opcoes opcoes-3">' + grade('divisao', ['pleno', 'partido', 'cortado', 'esquartelado', 'banda', 'chaveirao'], divisao) + '</div></div>' +
        '<div class="pilha"><span class="rotulo">Cor do campo</span><div class="amostras" data-ed-cor1></div></div>' +
        '<div class="pilha"><span class="rotulo">Segunda cor</span><div class="amostras" data-ed-cor2></div></div>' +
        '<div class="pilha"><span class="rotulo">Símbolo</span><div class="opcoes opcoes-4">' + grade('simbolo', ['torre', 'espada', 'estrela', 'coroa', 'chave', 'martelo', 'lua', 'montes'], simbolo) + '</div></div>' +
        '<div class="pilha"><span class="rotulo">Cor do símbolo</span><div class="amostras" data-ed-corSimbolo></div></div>' +
        '<div data-ed-moldura></div>' +
        '</details>' +
        '<div class="secao-titulo">Início</div><div class="card pilha">' +
        '<div class="pilha" data-regiao-bloco></div>' +
        '<div class="linha">' + RP.icone('escudo') + '<div style="flex:1"><b>Escudo de novato · 72 h</b><div class="fraco" style="font-size:var(--fs-2)">Seus locais ficam protegidos contra ataques no começo.</div></div></div>' +
        '<div class="linha">' + RP.icone('mapa') + '<div style="flex:1"><b>Um único mundo</b><div class="fraco" style="font-size:var(--fs-2)">Todos jogam no mesmo mapa, com até 30 reinos.</div></div></div>' +
        '<div class="linha">' + RP.icone('castelo') + '<div style="flex:1"><b>Castelo e recursos básicos</b><div class="fraco" style="font-size:var(--fs-2)">O reino já produz o suficiente para tropas básicas.</div></div></div>' +
        '</div></div>' +
        '<div class="rodape-acao"><button type="button" class="btn btn-primario btn-bloco btn-grande" data-fundar>' + RP.icone('castelo') + 'Fundar reino</button></div>';

      var inp = RP.$('#nome-reino', el);
      inp.addEventListener('input', function () { rascunho.nome = inp.value; previa(el); });
      inp.addEventListener('blur', function () { rascunho.tocado = true; previa(el); });
      RP.$('#icone-arquivo', el).addEventListener('change', function (e) {
        var f = e.target.files && e.target.files[0], er = RP.$('[data-erro-img]', el);
        er.textContent = '';
        if (!f) return;
        prepararImagem(f).then(function (b) {
          if (b.size > 200 * 1024) throw new Error('Imagem grande demais mesmo reduzida. Tente outra.');
          rascunho.imagem = b;
          if (rascunho.imagemUrl) URL.revokeObjectURL(rascunho.imagemUrl);
          rascunho.imagemUrl = URL.createObjectURL(b);
          previa(el);
        }).catch(function (x) { er.textContent = x.message; });
      });
      el.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-sorteado]'))) {
          rascunho.escolhido = +b.getAttribute('data-sorteado');
          rascunho.brasao = Object.assign({}, sorteados[rascunho.escolhido]); rascunho.imagem = null;
        } else if ((b = e.target.closest('[data-campo]'))) {
          var c = b.getAttribute('data-campo').split(':'); rascunho.brasao[c[0]] = c[1]; rascunho.escolhido = -1;
        } else if ((b = e.target.closest('[data-historico-i]'))) {
          rascunho.brasao = Object.assign({}, legado.brasoes[+b.getAttribute('data-historico-i')].brasao); rascunho.escolhido = -1; rascunho.imagem = null;
          if (!legado.brasao.moldura) rascunho.brasao.moldura = false;
        } else if (e.target.closest('[data-moldura]')) { rascunho.brasao.moldura = !rascunho.brasao.moldura; }
        else if ((b = e.target.closest('[data-regiao]'))) { rascunho.regiao = b.getAttribute('data-regiao'); }
        else if (e.target.closest('[data-sortear]')) { sortear(el); return; }
        else if (e.target.closest('[data-fundar]')) { rascunho.tocado = true; previa(el); fundar(el); return; }
        else return;
        previa(el);
      });
      montarLegado(el);
      sortear(el).catch(function () { previa(el); });
      RP.get('/temporada').then(function (L) { legado = L; montarLegado(el); }).catch(function () { /* offline: só o básico */ });
    }
  });

  function fundar(el) {
    if (validarNome(rascunho.nome)) { RP.$('#nome-reino', el).focus(); return; }
    if (rascunho.brasao.cor1 === rascunho.brasao.cor2) { RP.aviso({ titulo: 'Escolha duas cores diferentes no brasão.', icone: 'alerta', tipo: 'alerta' }); return; }
    var bt = RP.$('[data-fundar]', el); bt.disabled = true;
    RP.tentar(RP.post('/reino', { nome: rascunho.nome.trim(), brasao: rascunho.brasao, regiao: rascunho.regiao || null }))
      .then(function () { return rascunho.imagem ? RP.put('/reino/icone', rascunho.imagem).catch(function (x) { RP.aviso({ titulo: 'Reino fundado, mas a imagem não foi aceita', texto: x.message, tipo: 'alerta', icone: 'alerta' }); }) : null; })
      .then(function () { return RP.entrarNoJogo(); })
      .then(function () {
        RP.modal({
          topo: '<div class="modal-brasao">' + RP.iconeReino(RP.reino, 96) + '</div>',
          titulo: 'Reino de ' + RP.esc(RP.reino.nome) + ' fundado',
          corpo: '<p class="suave">O castelo foi erguido numa região do mapa. O entorno já é conhecido; o resto do mundo está coberto pela névoa.</p>' +
            '<p class="selo selo-visivel" style="margin-top:var(--esp-3)">' + RP.icone('escudo') + 'Escudo de novato ativo</p>',
          acoes: [
            { rotulo: RP.icone('castelo') + 'Ver meu reino', classe: 'btn-primario', acao: function () { RP.ir('reino'); } },
            { rotulo: RP.icone('mapa') + 'Abrir o mapa', acao: function () { RP.ir('mapa'); } }
          ],
          fecharFora: false
        });
      })
      .catch(function () { /* aviso já mostrado */ })
      .then(function () { bt.disabled = false; });
  }

  /* ícone de um reino: imagem própria (se houver) ou brasão */
  RP.iconeReino = function (r, tamanho) {
    tamanho = tamanho || 36;
    if (r && r.iconeProprio) return '<img class="icone-proprio" src="/api/v1/reinos/' + r.id + '/icone?v=' + (r.iconeVersao || 0) + '" alt="" width="' + tamanho + '" height="' + tamanho + '">';
    return RP.brasao((r && r.brasao) || {}, { tamanho: tamanho });
  };
})();
