# Correções de usabilidade (antes dos próximos passos)

Defeitos encontrados nos testes locais (itens 1 a 14; a lista cresce conforme os testes seguem). Esta etapa vem **antes** de [`proximos-passos.md`](proximos-passos.md). Foco: usabilidade. Melhoria gráfica fica para depois (ver "Fora desta etapa").

Regras desta etapa:

- Mudança de regra de jogo (velocidade, tamanho do mapa) entra também no `CLAUDE.md`; número novo, em `balanceamento/modelo.js`, depois regenerar `tabelas.md` e `config.json` (ver README). Decisão técnica nova vai para `docs/decisoes/`.
- Cada item termina com um critério de pronto que dá para conferir jogando.

## Estado (novembro de 2026)

Feito nesta etapa, para conferir jogando (`REINO_ACELERACAO=60 scripts/rodar-local.sh`):

| Item | Estado | Onde |
|---|---|---|
| 14, 8, 2, 4 | **Feito.** Concha nova: o mundo é a tela de fundo e nunca some; as outras telas são painel baixo (celular) ou coluna (computador); folha de seleção sem véu com até 3 ações e "Mais ações"; confirmação curta no lugar do modal; avisos pequenos num canto (máx. 3); navegação com 5 destinos distintos (Mapa, Reino, Exército, Atenção, Mais). | [decisão 0023](decisoes/0023-concha-jogo-sempre-visivel.md), `web/css/concha.css`, `web/js/nucleo.js` |
| 1 | **Feito.** População como soma ("População 120 + Tropas 16 = 136 de 160 moradores"); "teto" → moradores / limite de bônus; "guarnição" → tropas no local; "postura" → comportamento; "requisição" → o material vem sozinho. | `reino.js`, `tropas.js`, `recrutamento.js`, `temporada.js`, `ferraria.js` |
| 3 | **Feito.** "Minhas construções" em lista de uma linha (ícone, nome, nível, +/h, guardado de capacidade); folha "Recursos e produção" (estoque, por hora, por minuto, quando enche, "quando terei X"); todo custo mostra "faltam X · pronto em Y". | `reino.js`, `RP.producaoHTML`, `RP.faltaHTML` |
| 5 | **Feito.** Tropas ~5× mais rápidas, mapa 104 × 80; metas M4 revistas; carregadores a pé na mesma escala. | `balanceamento/modelo.js`, [decisão 0022](decisoes/0022-velocidade-e-mapa-maior.md), `CLAUDE.md` |
| 6 | **Feito.** Inclinação da câmera com botão do meio (arrastar) e dois dedos (subir/descer juntos), limites, botão de voltar ao padrão, lembrada no aparelho. | `vista/arte.js`, `vista/cena.js`, `RP.gestos` |
| 7 | Nota de plano futuro. | [`proximos-passos.md`](proximos-passos.md) |
| 9 | **Feito.** Em toda ordem para hexágono com animais conhecidos: força do bando × força do grupo, veredito ("vai perder", "vai perder parte", "vence com perdas", "vence sem perdas") e "mande pelo menos N"; folha do hexágono e tela de caça dizem a força do bando. Números do servidor (`previa.fauna`, `forcaFauna`). | `envio.js` (`RP.faunaVereditoHTML`), `fauna.js`, `VisaoTropas.Previa` |
| 10 | **Feito.** Cliente: marcha própria nunca some (a Vista e o Mapa escondiam qualquer marcha 5 s depois da chegada); rótulo "parada". Servidor: toda tropa revela a névoa por onde passa e onde fica, com raio por unidade. | `vista/modelo.js` (`M.sumiu`), servidor (ver relatório do agente) |
| 11 | **Feito.** Carga com a mesma peça em todo lugar (`RP.cargaHTML`: o que leva, quanto, quanto cabe, barra); "Carga: vazia · 300 livres"; marchas próprias no `/mapa` levam carga. | `tropas.js`, `mapa.js`, `VisaoMapa`, `VisaoTropas` |
| 12 | **Feito.** `fmtHora`/`fmtDuracao`/`fmtResta` protegidos; aviso ao enfileirar usa `RP.textoFilaItem` (hora só quando já começou; "na fila" ou "material a caminho" nos outros casos). | `nucleo.js`, `reino.js`, `exploracao.js` |
| 13 | **Feito.** Tocar em marcha própria no mapa abre painel com estado, destino, chegada, carga e ações "Novo destino", "Voltar ao castelo", "Parar aqui" (exércitos) ou "Novo destino"/"Voltar" (exploradores); a nova rota sai da posição atual; `podeOrdem`/`bloqueio` vêm do servidor. | `mapa.js` (`folhaMarchaPropria`), `Exercito.DarOrdem` |

Pendente: a revisão com alguém de fora (regra 6) a cada tela refeita; as telas de ação longas (caça, exploradores, caravana, ferraria, social) ainda têm o desenho antigo dentro do painel novo e merecem a mesma dieta de informação.

## Princípios de design novos

Estes princípios guiam todos os itens abaixo. Entram em `docs/arquitetura.md`.

1. **O jogo nunca fica escondido.** O mapa/vista do reino ocupa a tela o tempo todo e anda em tempo real. Tocar em local, botão ou ação não abre tela cheia nem menu que cubra o jogo. Avisos também não cobrem a área de jogo.
2. **Pouca informação por vez.** A tela mostra só o que importa agora. O resto fica um toque adiante, nunca ao mesmo tempo.
3. **Ações só do que está selecionado.** Nada de botões soltos aparecendo o tempo todo. Sem seleção, a tela só tem o jogo, os recursos e a navegação. Ao tocar em algo (local, tropa, hexágono), aparece um painel pequeno com **no máximo 3 ações**; o resto fica em "Mais ações".
4. **Uma ação principal por contexto**, destacada. As outras ficam em segundo plano.
5. **Cada informação em um lugar só.** Se o mesmo dado aparece em três telas, escolher uma e ligar as outras a ela por um toque.
6. **Regra de teste:** quem nunca viu o jogo olha a tela por 5 segundos e diz o que ela mostra e qual é a próxima coisa a fazer.

## Itens

### 1. Linguagem simples (sem "teto")

Problema: textos como "16 tropas também moram no reino e ocupam o teto" usam um termo que o jogador não entende.

Fazer:

- Trocar por uma soma direta, por exemplo `População 120 + Tropas 16 = 136 de 160`, ou duas linhas curtas: `X tropas` / `X população`.
- Varrer o cliente atrás de "teto" voltado ao jogador e trocar por "limite de moradores" ou pela soma. Ocorrências conhecidas: `web/js/telas/reino.js` (resumo de população e moradia), `web/js/telas/tropas.js` (card de ocupação), `web/js/telas/recrutamento.js` e `web/js/telas/temporada.js`. O "teto de bônus" (`ferraria.js`, `temporada.js`) também precisa de nome mais claro, por exemplo "limite de bônus".
- Revisar outros termos internos que vazam para a tela (guarnição, postura, requisição, etc.) e usar o mesmo critério: se o jogador novo não entende, reescrever.

Pronto quando: nenhuma tela mostra "teto" ao jogador e a relação população × tropas se lê de uma olhada.

### 2. Menus e avisos não cobrem o jogo

Problema: menus cobrem o jogo todo, e as notificações também. O jogador quer acompanhar o que acontece o tempo todo.

Fazer:

- Avisos (`.avisos`, em `web/css/base.css`): ficar pequenos, em canto, sem tapar o centro da vista; empilhar poucos e sumir sozinhos. Avisos importantes também vão para uma lista consultável, sem tela cheia.
- Ver item 8 para o formato dos painéis.

Pronto quando: com aviso na tela, o centro do mapa continua visível e clicável.

### 3. Produção e tempo para juntar recursos, de forma fácil

Problema: demorou para descobrir quanto o reino produz por minuto/hora e quanto falta para ter X de madeira. A tela "Locais" mostra cards grandes e o nome "Locais" parece genérico (poderia ser qualquer local do jogo).

Fazer:

- Renomear para algo que diga que são do jogador, por exemplo **"Minhas construções"**.
- Trocar os cards grandes por uma **lista compacta, uma linha por construção**: ícone, nome, nível, produção por hora, quanto já está guardado e quanto cabe.
- No topo, um **resumo da produção do reino** por recurso: estoque, produção por hora e por minuto, e quando enche.
- Em qualquer custo que falte recurso (obra, recrutamento), mostrar **"faltam X · pronto em Y"** calculado pela produção atual. Campo para digitar "quero X de madeira" e mostrar o tempo.
- Mostrar o resumo de produção também na barra de recursos do topo (toque expande uma dica pequena, não uma tela).

Pronto quando: em até 2 toques o jogador vê quanto produz por hora e em quanto tempo terá a quantia que quer.

### 4. Menus distintos e claros

Problema: os menus são parecidos entre si e confusos, até para quem sabe do que se trata.

Fazer:

- Fazer um inventário das telas e menus atuais (navegação inferior, "Mais", folhas, abas) e do que cada um faz.
- Redesenhar a navegação com **poucos destinos, nomes diferentes entre si, ícone e cor próprios**, cada um respondendo a uma pergunta: o que tenho (reino), o que acontece (mapa), meu exército, o que precisa de atenção, o resto.
- Tirar de "Mais" o que o jogador usa sempre; agrupar o resto com títulos claros.
- Testar com alguém que nunca viu o jogo: pedir 5 tarefas (ver produção, recrutar, mandar tropa, ler relatório, construir) sem explicar.

Pronto quando: quem não conhece o jogo acha cada uma das 5 tarefas sem ajuda.

### 5. Velocidade e sensação de distância

Problema: milicianos levam ~15 min para andar 4 a 5 hexágonos, enquanto trabalhadores levam recurso ao castelo em segundos. A distância parece enorme.

Hoje: tropa lenta = `minPor.Lenta` 2,4 min/hex × terreno médio 1,35 ≈ 3,2 min/hex (`balanceamento/modelo.js`).

Fazer:

- **Aumentar bastante a velocidade** das tropas e, para manter a escala, **dobrar ou triplicar o número de hexágonos do mapa** (hoje 60 × 48 para 30 reinos, `P.mapa`). O mapa cresce; a travessia e o tempo entre reinos podem ficar parecidos com os de hoje, mas curtas distâncias passam a levar segundos/poucos minutos.
- Alinhar a velocidade dos carregadores/população com a das tropas, para que a diferença não seja de segundos contra minutos.
- Revisar metas M4a, M4b, M4c do modelo e a regra de "travessia" no `CLAUDE.md` (hoje "pouco mais de 3 h" para 60 × 48), e a distribuição de reinos, fauna, jazidas e relíquias no mapa maior.
- Verificar desempenho: mapa maior pesa na vista, na névoa e na simulação (teste de carga com 30 reinos).
- Decidir o fator com números, por exemplo: vizinho do castelo (3 hex) em ≤ 1 min, reino vizinho em 10 a 20 min, tropa lenta.

Pronto quando: 4 a 5 hexágonos levam poucos minutos no máximo e o mapa continua exigindo deslocamento real entre reinos.

### 6. Inclinar a câmera

Problema: não há como mudar a inclinação da câmera.

Fazer:

- Hoje a inclinação é fixa (`K = 0.62` em `web/js/vista/arte.js`; vista em `web/js/vista/cena.js`).
- Tornar a inclinação variável: **botão do meio do mouse (arrastar)** no computador e **gesto de dois dedos (arrastar vertical)** no celular, com limites mínimo e máximo e botão de voltar ao padrão.
- Não conflitar com zoom (roda do mouse e pinça), que já existem. Lembrar a última inclinação do jogador no aparelho.

Pronto quando: o jogador inclina e volta a câmera nos dois aparelhos sem perder o zoom.

### 7. Gráficos: plano futuro

As animações atuais são simples, mas servem para o MVP. **Melhoria gráfica fica para depois**; esta etapa foca usabilidade. Registrar em `proximos-passos.md` como item de plano futuro.

### 8. Sem tela cheia: painéis que não escondem o jogo

Problema: tocar em locais, botões e ações abre menus que escondem o jogo. Tela cheia é péssimo.

Fazer:

- Inventário de tudo que cobre a tela hoje: folha inferior (`.folha`, máx. 72% da altura, com `.veu` escurecendo), modais (`.modal-fundo`), telas inteiras (`web/js/telas/*.js`) e avisos.
- Regras novas:
  - O mapa/vista fica sempre visível e animado; ocupar no máximo cerca de **40% da altura** com um painel baixo ou uma **coluna lateral estreita** (no computador/tablet), nunca a tela toda.
  - **Sem véu escuro** sobre o jogo. Tocar no mapa fora do painel fecha ou troca o painel.
  - Telas longas (lista de construções, relatórios, ferraria) viram **painel que desliza e pode ser recolhido** para uma barra pequena, em vez de trocar de tela.
  - Confirmações curtas ficam no próprio painel, não em modal central.
- Migrar tela por tela: primeiro as mais usadas (toque em local, recrutar, enviar tropas, construção), depois as demais.

Pronto quando: em nenhuma tela o jogador deixa de ver o mapa em andamento, e nenhum toque abre algo que cubra tudo.

### 9. Força da fauna ao caçar (e ao enviar tropas)

Problema: ao mandar milicianos caçar ursos, o jogador não sabe quantos mandar. Nada indica nível de força nem se está mandando pouco ou muito.

Fazer:

- Em toda ordem contra fauna (caça, extração, escolta, exploração em área perigosa), mostrar **a força do bando** (`web/js/telas/fauna.js`, `web/js/telas/envio.js`) e **a força do grupo** que o jogador escolheu, lado a lado, com barra e veredito simples: **"vai perder"**, **"vai perder parte"**, **"vence com perdas"**, **"vence sem perdas"** (ileso com o dobro da força, regra do `CLAUDE.md`).
- Mostrar o bando em palavras: espécie, quantidade e nível de perigo (baixo/médio/alto), e **"mande pelo menos N milicianos para vencer"** e **"N para passar ileso"**. Mesmo cálculo que o servidor usa (`forcaFauna` em `balanceamento/modelo.js`); expor pela API em vez de recalcular no cliente.
- Lembrar que a informação envelhece com a névoa: indicar "visto há X horas" quando for dado antigo.

Pronto quando: ao escolher a tropa para caçar, o jogador sabe se o número é pouco ou muito antes de confirmar.

### 10. Tropa em marcha some do mapa e não revela a névoa

Problema: a tropa de milicianos foi para um lugar, não liberou a visão do mapa por onde passou e **sumiu do mapa** do jogador. Tropa própria nunca pode sumir.

Hoje: a revelação da névoa ao longo do caminho está em `servidor/src/Jogo/Marchas/Marcha.Exploracao.cs` (`RevelarPercorrido`, raio em `RaioVisao`). Pelo nome e pelo contexto, vale confirmar se ela só vale para exploradores. Conferir também como o mapa decide desenhar marchas próprias (`web/js/telas/mapa.js`, `web/js/vista/`) e se alguma marcha própria sai da lista quando está em hexágono de névoa.

Fazer:

- **Toda marcha própria é sempre desenhada**, esteja onde estiver, inclusive em hexágono de névoa, parada em um ponto, caçando ou extraindo.
- **Toda tropa revela a névoa** onde passa e onde fica, com raio de visão próprio de cada unidade (explorador alto, milícia baixo). Regra de jogo: registrar no `CLAUDE.md` e em `balanceamento/modelo.js` (raio por unidade).
- Tropa parada em ponto qualquer, em caça ou em extração continua dando visão ali enquanto estiver lá.
- Atenção ao custo: revelar por onde toda marcha passa aumenta o trabalho do servidor (teste de carga com 30 reinos).
- Teste automático: marcha de milícia para um hexágono distante deixa o caminho revelado e continua na lista de marchas do dono em todos os instantes.

Pronto quando: mandar milícia para longe deixa o caminho visível no mapa e a tropa nunca desaparece do mapa do dono.

### 11. Mostrar o que a tropa carrega (e o espaço livre)

Problema: não dá para saber o que a tropa tem nas mãos ou está trazendo. Não fica claro se voltou sem nada de uma caçada ou se traz algo.

Hoje: `web/js/telas/tropas.js` já tem uma linha "Carga" (`vazia` ou o custo) com "até X" de capacidade, mas só na tela de tropas. Isso não aparece na marcha no mapa nem no painel da marcha.

Fazer:

- Em todo lugar que mostra uma marcha (painel ao tocar nela, lista de marchas, relatório da caçada ou extração), mostrar **carga: o que leva, quanto leva e quanto cabe**, por exemplo `Carga: 40 de couro, 10 de peles · 130 de 300 (170 livres)`.
- Carga vazia deve ser dita com clareza: `Carga: vazia · 300 livres`.
- Barra de preenchimento da carga (cheia, parcial, vazia), com o mesmo desenho em todas as telas.
- Para tropa em caça ou extração, mostrar também o que **já coletou** até agora e para onde vai levar.
- No relatório de caça: o que trouxe, ou "não trouxe nada" e o motivo (perdeu, bando fugiu, jazida vazia).

Pronto quando: ao tocar em qualquer tropa o jogador vê, sem abrir nada pesado, o que ela leva e quanto espaço sobra.

### 12. Mensagem "Pronto Invalid Date" ao treinar explorador

Problema: ao clicar em treinar um explorador "A pé" aparece o aviso `Pronto Invalid Date às NaN:NaN`.

Causa provável: o aviso monta `RP.fmtHora(it.fim)` em `web/js/telas/exploracao.js` (clique em `data-exp-treinar`). No servidor, o `Fim` do item de fila é opcional e só é preenchido quando o item **começa** (`Fila.cs`, `Fim` e `Inicio` são `long?`). Se o item entra na fila sem começar, `fim` vem vazio e `fmtHora` recebe `undefined`. Confirmar com o JSON da resposta de `POST /exploradores/treinar`.

Fazer:

- Se o item já começou, mostrar a hora de fim; se está na fila atrás de outro, dizer `Na fila, começa quando o treino anterior terminar`; se espera material, manter a mensagem atual.
- Mostrar a duração (`pronto em 5 min`) em vez de hora do relógio sempre que possível, que combina com o resto do jogo.
- Proteger `RP.fmtHora` e `RP.fmtDuracao` em `web/js/nucleo.js` contra valor vazio ou inválido: nunca mostrar `NaN` nem `Invalid Date`, voltar um texto neutro.
- Procurar os outros avisos com a mesma montagem (`mensagens.js` usa duração e está certo; revisar os demais usos de `fmtHora`).
- Teste automático: treinar com fila vazia e com fila ocupada e conferir o texto do aviso.

Pronto quando: nenhum aviso mostra `Invalid Date` ou `NaN`, com fila vazia, ocupada ou esperando material.

### 13. Tropa em marcha sempre controlável pelo mapa

Problema: tocar numa tropa no mapa deve dar a opção de mandá-la para outro lugar, mesmo que ainda não tenha chegado nem voltado. No meio do caminho ela continua controlável.

Hoje: o servidor já aceita nova ordem para uma marcha existente (`POST /tropas/{marchaId}/ordem`, `Exercitos.DarOrdem` em `servidor/src/Api/Endpoints/ModuloTropas.cs`), e o envio já usa isso quando recebe `marchaId` (`web/js/telas/envio.js`); exploradores têm o equivalente em `/exploradores/{marchaId}/ordem`. Falta confirmar o que o toque na marcha faz no mapa (`web/js/telas/mapa.js`) e se `DarOrdem` recusa em algum estado (partindo, carregando, em batalha, voltando).

Fazer:

- Tocar em marcha própria no mapa abre um painel pequeno (sem cobrir o jogo, ver item 8) com: o que é, destino atual, chegada, carga (item 11) e as ações **Mandar para outro lugar** (toca em outro ponto do mapa e confirma), **Voltar ao castelo** e **Parar aqui** (fica no ponto com a postura "atacar apenas quem atacar").
- A nova ordem parte **da posição atual** da tropa, não da origem. Conferir que o servidor calcula o caminho e a chegada a partir do hexágono em que ela está.
- Valer para todo tipo: ataque, caça, extração, reforço, caravana com escolta, exploradores. Se uma ordem não puder ser trocada (tropa em batalha, por exemplo), dizer o motivo no painel e deixar `Recuar` quando fizer sentido.
- A tropa carregada continua com a carga ao mudar de destino (item 11 mostra isso). Trocar a ordem de uma marcha que leva relíquia mantém as regras de interceptação do `CLAUDE.md`.
- Teste automático: dar ordem a uma marcha no meio do caminho e conferir que a nova rota sai da posição atual e que a marcha continua na lista do dono.

Pronto quando: em qualquer ponto do caminho, tocar na tropa e escolher outro destino funciona em até 3 toques.

### 14. Tela poluída: replanejar a interface (item guarda-chuva)

Problema: já foi dito antes e precisa ficar explícito. Há informação demais na tela e ações aparecendo o tempo todo. Está poluído e confuso. Isso se soma aos itens 2, 4 e 8; este item **replaneja** como eles se encaixam e vem **antes** deles.

Fazer, em ordem:

1. **Inventário da poluição.** Para cada tela principal (Meu reino, Mapa, Tropas, Construção, Relatórios, Mais), listar tudo que aparece ao mesmo tempo: número de botões, cards, avisos e textos. Capturar uma imagem de cada tela em celular (390 × 844) e em desktop. Esse inventário vira a base de comparação (antes e depois).
2. **Orçamento por tela.** Definir limites, por exemplo: no máximo **1 ação principal** e **3 ações secundárias** visíveis; no máximo **5 informações** fixas (recursos, população, relógio e pouco mais); resto sob demanda.
3. **Sem seleção, tela limpa.** O mapa/vista sozinho, a barra de recursos e a navegação. Nenhum botão de ação solto.
4. **Seleção abre painel contextual pequeno** (item 8): mostra o que é, o estado em uma linha e até 3 ações. "Mais ações" abre o resto.
5. **Informação em camadas.** Resumo → detalhe (um toque) → detalhe avançado (outro toque). Valores, bônus, objetivos e táticas ficam na camada de detalhe ("ajuste"), como o `CLAUDE.md` já diz para o ataque.
6. **Avisos e alertas filtrados.** Só o que exige decisão aparece como aviso na hora; o resto vai para a lista de atenção (que já existe em Meu reino, com os 3 mais urgentes) e some sozinho.
7. **Remover o que não é essencial** na primeira versão da tela nova: o que for raro (ferraria, alianças, comércio) só aparece quando o gatilho do `CLAUDE.md` ("Opções e sistemas só aparecem quando fazem sentido") for cumprido, e os gatilhos devem ser revisados para não aparecer cedo demais.
8. **Revisão com alguém de fora** (regra 6 dos princípios) a cada tela refeita, antes de passar para a próxima.

Pronto quando: cada tela passa no orçamento do passo 2 e a regra dos 5 segundos funciona para Meu reino e para o Mapa.

## Ordem sugerida

1. **Item 14 define o novo desenho e guia o resto.** Os itens 2, 4 e 8 são feitos dentro dele, não separados.
2. Item 12 (aviso quebrado, pequeno) e itens 10 e 13 (bugs de jogo e de controle).
3. Itens 1, 3, 9 e 11 (textos e informação), já no desenho novo.
4. Item 5 (velocidade e mapa maior), com revisão do `CLAUDE.md` e do balanceamento.
5. Item 6 (câmera).
6. Item 7 vira nota de plano futuro.

## Como testar esta etapa

- `REINO_ACELERACAO=60 scripts/rodar-local.sh` e jogar em viewport de celular (390 × 844) e em desktop.
- Repetir as 5 tarefas do item 4 com alguém que não conhece o jogo.
- Conferir o item 5 com `node balanceamento/modelo.js` (metas) e `cd servidor && dotnet test` (carga com 30 reinos no mapa maior).

## Fora desta etapa

- Melhoria gráfica e de animações (item 7).
- Tudo de `proximos-passos.md`, que volta depois destas correções.
