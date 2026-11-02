/* Reino de Pedra — Temporada e legado, Exílio. */
(function () {
  'use strict';
  var RP = window.RP, D = RP.dados, U = RP.util;

  /* ================================================================ Temporada e legado */
  function desenharTemporada(el) {
    var t = D.temporada, L = D.legado, total = 70, passados = total - t.diasRestantes;
    var lin = L.linhagem;
    RP.$('.temp-conteudo', el).innerHTML =
      '<div class="card card-moldura temp-hero"><span class="rotulo">Temporada ' + t.numero + '</span><h2>' + RP.esc(t.nome) + '</h2>' +
      '<div class="temp-dias"><b>' + t.diasRestantes + '</b><span>dias restantes</span></div>' +
      '<div class="barra barra-grossa" role="progressbar" aria-label="Dia ' + passados + ' de ' + total + '"><i style="width:' + ((100 * passados) / total).toFixed(1) + '%"></i></div>' +
      '<div class="linha-entre fraco" style="font-size:var(--fs-1);margin-top:4px"><span>Dia ' + passados + '</span><span>Dia ' + total + '</span></div>' +
      '<p class="suave" style="margin-top:var(--esp-3);font-size:var(--fs-2)">Ao fim, mapa e reinos recomeçam do zero. O território não tem placar: não existe "mapa conquistado".</p></div>' +
      '<a class="card linha rank-atalho" href="#/ranking"><span class="ico-placa">' + RP.icone('coroa') + '</span><span style="flex:1"><b>Ranking da temporada</b><br><small class="fraco">Baixas, perdas, tropas e famílias · você: ' + D.ranking.minhaPosicao.baixas + 'º em baixas</small></span>' + RP.icone('avancar', 'ico-p') + '</a>' +
      '<div class="temp-duas"><div class="card"><span class="rotulo">Fica com você</span><ul class="regras-lista">' +
      ['Linhagem', 'Relíquias da temporada', 'Títulos', 'Brasões e cosméticos'].map(function (x) { return '<li>' + RP.icone('check', 'ico-p r-ervas') + x + '</li>'; }).join('') + '</ul></div>' +
      '<div class="card"><span class="rotulo">Recomeça</span><ul class="regras-lista">' +
      ['Mapa e névoa', 'Reino e locais', 'Recursos e tropas'].map(function (x) { return '<li>' + RP.icone('relogio', 'ico-p') + x + '</li>'; }).join('') + '</ul></div></div>' +

      '<div class="secao-titulo">Linhagem</div><div class="card pilha"><div class="linha"><span class="linhagem-nivel">' + lin.nivel + '</span><span style="flex:1"><b>' + RP.esc(D.jogador.linhagem.titulo) + '</b><br><small class="fraco">' + Math.round(lin.progresso * 100) + '% até o nível ' + (lin.nivel + 1) + '</small></span></div>' +
      '<div class="barra"><i style="width:' + (lin.progresso * 100) + '%"></i></div>' +
      '<ul class="linhagem-lista">' + lin.desbloqueios.map(function (d) {
        return '<li class="' + (d.feito ? 'feito' : '') + '"><span class="selo' + (d.feito ? ' selo-visivel' : '') + '">Nv ' + d.nivel + '</span><span>' + RP.esc(d.txt) + '</span>' + RP.icone(d.feito ? 'check' : 'cadeado', 'ico-p') + '</li>';
      }).join('') + '</ul><p class="fraco" style="font-size:var(--fs-2)">A linhagem desbloqueia opções e cosméticos, nunca poder.</p></div>' +

      '<div class="secao-titulo">Relíquias da temporada</div><div class="reliquias">' + L.reliquias.map(function (r) {
        return '<div class="card reliquia' + (r.ganha ? ' ganha' : '') + '"><span class="reliquia-ico">' + RP.icone('lendario', 'r-lendario') + '</span><b>' + RP.esc(r.nome) + '</b><span class="selo' + (r.ganha ? ' selo-destaque' : '') + '">' + RP.esc(r.bonus) + '</span>' +
          '<small class="fraco">' + (r.ganha ? 'Conquistada: ' : 'Como ganhar: ') + RP.esc(r.como) + '</small>' + (!r.ganha && r.progresso ? '<div class="barra"><i style="width:' + (r.progresso * 100) + '%"></i></div>' : '') + '</div>';
      }).join('') + '</div><p class="fraco" style="font-size:var(--fs-2);margin-top:var(--esp-2)">Bônus pequenos e com teto: somadas, as relíquias dão no máximo ' + L.tetoBonus + '. Não confundir com as <a href="#/reliquias">relíquias lendárias</a> do mapa, que ficam na temporada.</p>' +

      '<div class="secao-titulo">Títulos</div><div class="card lista">' + L.titulos.map(function (ti, i) {
        return '<div class="lista-item"><span class="ico-placa">' + RP.icone(ti.ganho ? 'coroa' : 'cadeado') + '</span><span style="flex:1;min-width:0"><b>' + RP.esc(ti.nome) + '</b><br><small class="fraco">' + RP.esc(ti.como) + '</small></span>' +
          (ti.ganho ? (ti.ativo ? '<span class="selo selo-visivel">Em uso</span>' : '<button type="button" class="btn btn-p" data-titulo="' + i + '">Usar</button>') : '<span class="selo selo-desconhecido">Bloqueado</span>') + '</div>';
      }).join('') + '</div>' +

      '<div class="secao-titulo">Brasões e cosméticos</div><div class="brasoes-grade">' + L.brasoes.map(function (b) {
        return '<div class="card brasao-item' + (b.bloqueado ? ' bloqueado' : '') + '">' + RP.brasao(b, { tamanho: 56 }) + '<small>' + RP.esc(b.nome) + '</small></div>';
      }).join('') + '</div><p class="fraco" style="font-size:var(--fs-2);margin-top:var(--esp-2)">Brasões antigos ficam no seu histórico e podem ser usados ao fundar o próximo reino.</p>' +

      '<div class="secao-titulo">Suas temporadas</div><div class="card lista">' + L.historico.map(function (h) {
        return '<div class="lista-item"><span class="linhagem-nivel pequeno">' + h.temporada + '</span><span><b>' + RP.esc(h.nome) + '</b><br><small class="fraco">' + RP.esc(h.resumo) + '</small></span></div>';
      }).join('') + '</div><div style="height:var(--esp-8)"></div>';
  }
  RP.registrarTela('temporada', {
    secao: 'mais',
    montar: function (el) {
      el.innerHTML = U.topo('Temporada e legado', 'mais') + '<div class="conteudo-tela temp-conteudo"></div>';
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-titulo]');
        if (!b) return;
        D.legado.titulos.forEach(function (t, i) { t.ativo = i === +b.getAttribute('data-titulo'); });
        D.jogador.linhagem.titulo = D.legado.titulos[+b.getAttribute('data-titulo')].nome;
        RP.aviso({ titulo: 'Título em uso', texto: D.jogador.linhagem.titulo, icone: 'coroa', tipo: 'sucesso', ms: 1800 });
        desenharTemporada(el);
      });
    },
    entrar: function (el) { desenharTemporada(el); }
  });

  /* ================================================================ Exílio */
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
  RP.registrarTela('exilio', {
    montar: function (el) {
      var X = D.exilio, lin = D.legado.linhagem;
      el.innerHTML = '<div class="exilio-cena">' + cenaRuina() + '</div>' +
        '<div class="conteudo-tela exilio-conteudo pilha-4">' +
        '<div class="exilio-titulo"><span class="rotulo">Temporada ' + D.temporada.numero + ' · dia 34</span><h1>Seu reino caiu</h1><p class="suave">' + RP.esc(X.motivo) + '</p></div>' +
        '<div class="card card-moldura pilha"><h2>Você recomeça em exílio</h2>' +
        '<div class="exilio-item">' + RP.icone('bussola') + '<span><b>Um novo ponto do mapa</b><br><small class="fraco">' + (lin.nivel >= 5 ? 'Escolha a região inicial.' : 'Região aleatória, longe de quem derrubou você. A escolha libera no nível 5 da linhagem.') + '</small></span></div>' +
        '<div class="exilio-item">' + RP.icone('castelo') + '<span><b>Kit de recomeço</b><br>' + RP.custoHTML(X.kit) + '<br><small class="fraco">' + RP.esc(X.kitTropas) + '</small></span></div>' +
        '<div class="exilio-item">' + RP.icone('escudo') + '<span><b>Escudo temporário · ' + X.escudo + '</b><br><small class="fraco">Ninguém pode atacar seus locais enquanto ele durar.</small></span></div></div>' +
        '<div class="card pilha"><span class="rotulo">Fica com você</span><ul class="regras-lista">' + X.mantido.map(function (m) { return '<li>' + RP.icone('check', 'ico-p r-ervas') + RP.esc(m) + '</li>'; }).join('') + '</ul></div>' +
        '<p class="fraco" style="font-size:var(--fs-2)">Se ainda houvesse outros locais, o castelo viraria ruína e a sede iria para um deles, com perdas pesadas, sem exílio.</p>' +
        '<div style="height:120px"></div></div>' +
        '<div class="rodape-acao rodape-com-resumo"><a class="btn btn-p btn-fantasma" href="#/relatorios" style="color:var(--barra-texto)">' + RP.icone('relatorios') + 'Ver o que aconteceu</a><button type="button" class="btn btn-primario btn-bloco btn-grande" data-recomecar>' + RP.icone('bandeira') + 'Recomeçar em exílio</button></div>';
      el.addEventListener('click', function (e) {
        if (!e.target.closest('[data-recomecar]')) return;
        RP.modal({
          topo: '<div class="modal-brasao">' + RP.brasao(RP.estado.brasao, { tamanho: 72 }) + '</div>',
          titulo: 'Novo começo',
          corpo: '<p class="suave">Um novo castelo foi erguido em outra região. Linhagem, relíquias e títulos seguem com você.</p><p class="selo selo-visivel" style="margin-top:var(--esp-3)">' + RP.icone('escudo') + 'Escudo temporário ativo · ' + D.exilio.escudo + '</p>',
          acoes: [{ rotulo: RP.icone('castelo') + 'Ver meu reino', classe: 'btn-primario', acao: function () { RP.estado.recemFundado = true; RP.invalidarTela('reino'); RP.ir('reino'); } }],
          fecharFora: false
        });
      });
    }
  });
})();
