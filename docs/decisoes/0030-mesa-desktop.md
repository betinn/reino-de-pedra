# 0030 — Mesa de jogo para computador: mundo inteiro, mouse de dois botões, atalhos e janelas flutuantes

**Problema.** O cliente nasceu *mobile-first*: painel baixo, folha de seleção, navegação de cinco destinos e, no computador, um trilho à esquerda com uma coluna de 400 px à direita que encolhia o mundo. Jogando num monitor grande, a sensação era de um jogo "quadrado", apertado para caber numa tela de celular: cada ação pedia vários cliques (selecionar, abrir a folha, escolher a ordem, confirmar), os menus se empilhavam e o mapa ficava com metade da largura. O usuário pediu para esquecer o celular e focar **exclusivamente em desktop**: mouse com dois botões, teclado, monitor grande, poucos menus, ações rápidas.

## O que jogos do gênero fazem

Convenções consolidadas em RTS e 4X de computador (Age of Empires, Command & Conquer, Civilization, Stronghold):

- **Botão esquerdo seleciona, botão direito ordena.** O direito é a "ordem inteligente": mover para o chão, entrar num local próprio, atacar o inimigo, conforme o alvo. Shift soma à seleção; arrastar laça; duplo clique pega todos do mesmo tipo.
- **Grupos de controle** com Ctrl + número e chamada pelo número (duas vezes centra a câmera); Tab passa pelas unidades.
- **HUD nas bordas**, mundo no centro: recursos no topo com dica ao passar o mouse, minimapa num canto inferior, painel do que está selecionado na base da tela com a "carta de comandos" e as teclas de cada botão.
- **Janelas flutuantes** arrastáveis para as telas de gestão, uma por vez, fechadas por Esc ou pela mesma tecla que as abriu; menus de contexto no botão direito; dicas (tooltips) em tudo.
- **Teclado para a câmera** (WASD ou setas) e atalhos de uma letra para cada janela.

Fontes consultadas: controles de [Command & Conquer](https://strategywiki.org/wiki/Command_%26_Conquer/Controls), [Dawn of War](https://www.magicgameworld.com/?p=118993) e [Ashes of the Singularity](https://wiki.ashesofthesingularity.com/index.php/Controls); pedidos de jogadores sobre grupos de controle e duplo toque no [fórum do Age of Empires](https://forums.ageofempires.com/t/feature-request-gameplay-control-related-improvements/242852); [menus radiais e de contexto](https://300mind.studio/blog/radial-menus-in-game-design/) como sobreposição temporária; a crítica de que HUD de estratégia precisa de densidade organizada, não de minimalismo, em [guias de HUD](https://bootcamp.uxdesign.cc/7-obvious-beginner-mistakes-with-your-games-hud-from-a-ui-ux-art-director-d852e255184a).

## Decisão

O cliente web vira uma **mesa de jogo para computador**. O celular deixa de ser alvo (a decisão [0023](0023-concha-jogo-sempre-visivel.md) e a [0027](0027-paineis-sem-sobreposicao.md) ficam como história; o que nelas vale continua valendo: o jogo nunca fica escondido, pouca informação por vez, uma ação principal por contexto).

### Layout

| Região | O que fica |
|---|---|
| Mundo | A tela inteira, sempre. Nenhum painel encolhe o mapa. |
| Barra do topo (`#topo-jogo`, `RP.montarTopo`) | Brasão e nome do reino (abre Meu reino), recursos do castelo com `+N/h` e dica ao passar o mouse (estoque, capacidade, por hora, quando enche), população, e os botões das janelas com a tecla de cada um: Reino **R**, Construir **B**, Exército **E**, Recrutar **T**, Pessoas **P**, Atenção **N** (com contador), Mais (menu suspenso com Relatórios, Notificações, os itens que os sistemas registram em `RP.itensMais`, Atalhos e Sons e conta). |
| Janela (`#telas`) | Uma tela do jogo por vez, numa janela flutuante no canto superior direito, arrastável pela barra de título, fechada pelo X, por Esc ou pela tecla que a abriu. Os links de "voltar" das sub-telas continuam funcionando dentro dela. |
| Folha (`RP.abrirFolha`) | Painel de seleção na base da tela, centrado: título e informação à esquerda, coluna de comandos à direita com a ação principal primeiro e a tecla de cada botão (`data-tecla`, até 6 à vista, o resto em "Mais"). Enter aciona a principal; Esc fecha. |
| Painel de seleção (`.selecao-barra`) | No mesmo lugar da folha, quando há tropa selecionada e a folha está fechada: quem está selecionado, a dica do botão direito e a carta de comandos (Ordem… Enter, Patrulhar Q, Voltar V, Parar aqui H, Separar K, Detalhes I, Comportamento C, Limpar Esc). |
| Barra de ordem (`.ordem-barra`) | Faixa no topo durante um envio sem destino ("Clique no destino") e enquanto a linha da patrulha é desenhada (Patrulhar Enter, Circuito O, Desfazer Z). |
| Cantos inferiores | Minimapa à esquerda (280 px, mostrando só a parte conhecida do mundo com folga, não os 312 × 240 inteiros); zoom, castelo, câmera, modo seleção, camadas, atalhos e Vista ⇄ Mapa à direita. |
| Confirmação (`RP.modal`) | Diálogo pequeno no centro, sobre um véu leve; Enter confirma, Esc fecha. |
| Avisos | Canto superior esquerdo, sob a barra (a janela fica à direita). |
| Menu de contexto (`RP.menuContexto`) | No botão direito sobre qualquer coisa sem tropa selecionada: os mesmos botões que a folha daquele alvo teria, sem abrir a folha. Fechado por clique fora, Esc ou roda. |
| Dica (`[data-dica]`, `[data-dica-rec]`) | Tooltip em botões, recursos e controles, com a tecla de atalho. |

### Mouse

| Gesto | Efeito |
|---|---|
| Clique esquerdo | Seleciona ou abre o que foi clicado: tropa (seleciona), local, pessoa, hexágono (folha). Com tropa selecionada, clicar em outro lugar abre o que foi clicado e solta a seleção. |
| Botão direito, com tropa selecionada | **Ordem inteligente no ponto clicado**: hexágono sem local → mover; local seu → reforçar; outra tropa sua em campo → juntar. Alvos que pedem escolha ou confirmação (local de outro reino, jazida, ruína, animais) abrem a folha do hexágono com as ordens. |
| Shift + direito, com tropa selecionada | Sempre a folha do hexágono com todas as ordens (mover, patrulhar daqui, ver o caminho, atacar, caçar…). |
| Botão direito, sem seleção | Menu de contexto do que está sob o mouse. |
| Arrastar com o esquerdo | Move o mapa. Com Shift (ou no modo seleção), desenha o laço. |
| Roda | Zoom. Afastar além da Vista passa ao Mapa tático. |
| Direito ou meio arrastando | Inclina (vertical) e gira (horizontal) a câmera. |
| Shift + clique | Soma ou tira da seleção. |
| Duplo clique num soldado | Seleciona todos do mesmo tipo naquele lugar. |
| Passar o mouse | Cursor de mão sobre o que é clicável; dicas na barra e nos controles. |

### Teclado (`RP.teclas`, ajuda em F1)

| Grupo | Teclas |
|---|---|
| Janelas | R Reino · B Construir · E Exército · T Recrutar · P Pessoas · N Atenção (cada uma abre e fecha) |
| Mapa | W A S D ou setas movem · Espaço centra no castelo · M Vista ⇄ Mapa · G grade · L camadas · + e − zoom · Home câmera no padrão |
| Tropas | Tab próxima tropa (Shift+Tab anterior) · Ctrl+1…9 guarda a seleção no grupo · 1…9 chama o grupo (duas vezes centra) · Enter ordem · Q patrulhar · V voltar · H parar · K separar · I detalhes · C comportamento |
| Geral | Esc fecha o que estiver mais em cima (menu, confirmação, folha, seleção, envio, janela) · F1 ou ? esta ajuda |

Ordem de quem recebe uma tecla: menu de contexto → confirmação → folha aberta (os `data-tecla` dos botões dela e Enter) → atalhos globais. Teclas não valem em campos de texto.

### Peças do núcleo (`web/js/nucleo.js`, `web/css/desktop.css`)

- `RP.gestos` ganhou botão direito (`cliqueDireito`, com Shift), arrasto do direito para a câmera, duplo clique (`toque(..., duplo)`) e `passar` (mouse sem botão). `RP.Cena.tocar` e `RP.Tatico.tocar` levam `botao`, `duplo`, `shift` e a posição na tela; `deslocar(dx, dy)` move a câmera pelo teclado.
- `RP.abrirFolha`, `RP.modal`, `RP.painel` (agora a janela), `RP.montarTopo`, `RP.menuContexto`, `RP.fecharMenu`, dicas, `RP.teclas.registrar(tecla, { descricao, grupo, acao, quando, ctrl, oculta })`, `RP.ajudaTeclas`.
- As folhas do mapa são **montadas separadas de abrir** (`montarHex`, `montarObjeto`, `montarMarchaPropria`, `montarMarchaAlheia` em `mapa.js`; `RP.acoesLocal` em `reino.js`): o mesmo `{ titulo, corpo, acoes }` serve à folha e ao menu de contexto, e os itens do menu disparam exatamente o clique que o botão dispararia (os sistemas continuam tratando por delegação).
- `RP.envio.iniciar({ ..., hex, rapido })` e `RP.selecao.ordem(hex, completa)`: a ordem direta (mover, reforçar) parte sem barra nem folha; a seleção continua depois da ordem.
- `concha.css` virou `desktop.css`; a navegação inferior, o trilho, a coluna, a pega do painel e a folha arrastável saíram. Densidade de computador: alvos de 36–40 px.

**Consequências.**

- Celular e toque deixam de ser suportados como alvo; a Vista continua aceitando toque e pinça, mas nada é desenhado para ele.
- Telas novas não precisam saber do layout: registram-se como antes e abrem na janela; botões de folha com `data-tecla` ganham a tecla sozinhos.
- Textos "toque" viraram "clique"; o `CLAUDE.md` descreve a mesa em "Experiência do jogador".
- Fica para depois: redimensionar a janela, lembrar a posição dela entre sessões, laço com arrasto do esquerdo sem Shift em terreno vazio (hoje o esquerdo move o mapa), e dicas sobre as pessoas no mapa.
