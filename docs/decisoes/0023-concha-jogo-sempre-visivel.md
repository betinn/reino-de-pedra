# 0023 — Concha do cliente: o jogo nunca fica escondido

**Problema.** Nos testes locais, cada tela (Meu reino, Tropas, Construção…) ocupava a janela inteira, as folhas escureciam o mundo com um véu, os modais ficavam no centro e os avisos cobriam o topo. O jogador perdia o mapa de vista a cada toque, e a tela juntava botões soltos e informação demais ([`correcoes-usabilidade.md`](../correcoes-usabilidade.md), itens 2, 4, 8 e 14).

**Decisão.** O cliente passa a ter uma **concha** com três camadas fixas, em `web/js/nucleo.js` e `web/css/concha.css`:

1. **Mundo** (`#mundo`): a tela `mapa` é a **tela de fundo** (`fundo: true` em `RP.registrarTela`). É montada uma vez ao entrar no jogo, nunca é escondida enquanto há reino e continua animando com qualquer painel aberto. `entrar` roda na montagem e a cada `#/mapa?…`; `sair` só ao sair da conta.
2. **Painel** (`#telas`): todas as outras telas do jogo são montadas aqui. No celular é um painel baixo (até 42% da altura, `--painel-alt`) com pega para recolher; no computador (≥ 900 px) é uma coluna à direita (`--coluna`, 400 px) e a navegação vira um trilho à esquerda (`--trilho`). O mundo encolhe para a área que sobra (`.mundo { right: var(--coluna) }`), então o centro da câmera continua no centro do que se vê. Telas públicas (entrada, criação) continuam ocupando a tela toda (`html.tela-cheia`).
3. **Folha de seleção** (`RP.abrirFolha`): o que aparece ao tocar num local, tropa ou hexágono. Mesma geometria do painel, por cima dele, **sem véu**. Mostra no máximo **3 ações**, com a principal (`btn-primario`) sempre primeiro e o resto em "Mais ações" (`limitarAcoes`). `RP.modal` virou uma confirmação curta no mesmo lugar, sem escurecer o jogo. Avisos ficam pequenos num canto, no máximo 3, e somem sozinhos.

`RP.painel` (`abrir`, `fechar`, `recolher`, `expandir`) controla as classes `html.painel-aberto` / `html.painel-recolhido`; `#painel-barra` é a barra do painel recolhido. Quem desenha o mundo ouve `resize` (disparado por `RP.painel.redimensionado()`) e se ajusta.

**Navegação.** Cinco destinos, cada um com ícone e cor próprios (`RP.NAV`): Mapa (o que acontece), Reino (o que tenho), Exército (minhas tropas), Atenção (o que precisa de mim: a tela `agora`, com relatórios e notificações dentro e o contador no ícone) e Mais (o resto). Sub-telas usam `secao` para marcar o destino e não escondem a navegação.

**Camadas de informação.** Resumo → detalhe (um toque) → ajuste (outro toque). Em Meu reino: população como soma (`RP.popSomaHTML`: "População 120 + Tropas 16 = 136 de 160 moradores"), uma linha por construção (`linhaLocal`), filas só quando há algo e a produção numa folha (`RP.producaoHTML`, `RP.contaRecursoHTML`: estoque, por hora, por minuto, quando enche e "quando terei X"). Todo custo diz o que falta e quando dá (`RP.faltaHTML`, dentro de `RP.custoHTML`). Toda tropa mostra a carga com a mesma peça (`RP.cargaHTML`).

**Linguagem.** Termos internos não vazam para o jogador: "teto" virou "moradores"/"limite de bônus", "guarnição" virou "tropas no local", "postura" virou "comportamento", "requisição" virou "o material vem sozinho". As chaves da API não mudam.

**Câmera.** A inclinação da Vista (`A.K`, antes fixa em 0,62) é variável entre `K_MIN` e `K_MAX` (`RP.arte.definirK`, `Cena.inclinar`): botão do meio do mouse arrastando, ou dois dedos subindo/descendo juntos (a pinça continua sendo zoom: `RP.gestos` decide o modo uma vez por gesto, por quem passa primeiro de 14 px). O botão da câmera volta ao padrão. A última inclinação fica no aparelho (`RP.pref('inclinacao')`).

**Formatação segura.** `RP.fmtHora`, `RP.fmtDuracao`, `RP.fmtResta` e `RP.fmtHa` aceitam valor vazio ou inválido e nunca mostram `NaN` nem `Invalid Date`; `RP.fmtEm` ("em 5 min") é o padrão para prazos. O aviso de item de fila usa `RP.textoFilaItem`: hora de fim só quando o item já começou.

**Consequências.**

- `web/js/vista/reino.js` (a Vista no topo de Meu reino) saiu: o mundo atrás do painel faz o papel dela.
- `html.tela-fixa` e `.veu` saíram; `sobreNav` e `veu` em `RP.abrirFolha` são ignorados.
- Telas com rodapé fixo (`.rodape-acao`) passam a ter o rodapé preso ao fim do painel (`position: sticky`).
- A navegação fica visível em todas as telas do jogo; `nav: true` continua marcando os destinos principais.
- O teste de "5 segundos" (quem nunca viu o jogo diz o que a tela mostra e o que fazer) vale para Meu reino e para o Mapa; cada tela nova nasce com 1 ação principal, até 3 secundárias e no máximo 5 informações fixas.
