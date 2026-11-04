# 0027 — Painéis sem sobreposição: um lugar só, em pilha; barra de tempo em tudo que tem tempo

**Problema.** Nos testes, sobretudo no computador, cada clique abria um painel por cima do outro: a tela do painel (Reino, Exército) na coluna da direita, a folha de seleção (um local, uma pessoa, um exército) por cima da parte de baixo da coluna e a confirmação por cima das duas. No celular, a folha cobria o painel baixo e deixava uma tira dele aparecendo atrás. Menu em cima de menu, sem dizer como voltar. E o tempo das coisas aparecia só como cronômetro ("12:40"), sem dar ideia de quanto já andou.

## Ideias consideradas

Como jogos do gênero resolvem:

- **Uma janela por vez, com fechar (Travian, Tribal Wars, Clash of Clans).** Cada prédio ou ação abre uma janela no centro; abrir outra fecha a anterior. Simples, mas a janela cobre o mundo e esconde de onde se veio. Fere o princípio "o jogo nunca fica escondido".
- **Janela cheia com pilha e botão voltar (Rise of Kingdoms, Age of Empires Mobile).** Tocar num prédio mostra ações em volta dele; a tela de detalhe ocupa a tela toda e cada subtela empilha com "voltar". Resolve a navegação, mas o mundo some a cada toque.
- **Painel lateral fixo com abas (Stronghold Kingdoms, Civilization VI).** Um lado da tela é reservado a painéis; abrir um painel fecha o outro do mesmo lado. O mundo fica sempre à vista no resto; a pilha não existe (abrir um detalhe perde a lista).
- **Folha inferior com pilha (Google Maps, apps de mapa, muitos jogos de celular).** Uma folha só, presa embaixo; tocar num item da lista troca a folha pelo detalhe, com "‹ voltar" para a lista. No computador, a mesma folha vira uma coluna lateral.
- **Manter as camadas e só arrumar os tamanhos** (folha menor que o painel, confirmação num canto). Mexe pouco, mas continua havendo duas coisas abertas no mesmo lugar e a dúvida de qual fechar.

## Decisão

**Um lugar só, em pilha** (a folha com pilha dos apps de mapa, que no computador é o painel lateral fixo):

1. O **painel** (`#telas`, a tela atual), a **folha de seleção** (`RP.abrirFolha`) e a **confirmação** (`RP.modal`) ocupam o **mesmo lugar**: painel baixo no celular, coluna à direita no computador. Formam uma pilha de no máximo três níveis — tela → folha → confirmação — e **só a de cima aparece**. As classes `html.com-folha` e `html.com-modal` escondem o que está embaixo (`concha.css`, seção "um lugar só").
2. A folha aberta sobre uma tela mostra **"‹ Reino"** (o nome do destino da navegação, ou o título da subtela) acima do título: um toque volta à tela, como o Esc. O **X** fecha a pilha toda e volta ao mundo (`#/mapa`). Sobre o mundo, sem tela embaixo, a folha só tem o X.
3. A confirmação é o topo da pilha: enquanto está aberta, folha e tela ficam escondidas; ao responder (ou com Esc), a de baixo volta como estava. Só existe uma confirmação por vez; uma nova substitui a anterior, e abrir uma folha fecha a confirmação.
4. No computador, folha e confirmação ocupam a **coluna inteira** (topo a base), e o mundo encolhe para o lado como já fazia com o painel: nada fica por cima do mundo nem de outro painel. No celular, a confirmação vira uma folha curta presa à navegação.
5. Trocar de tela (navegação, link) esvazia a pilha, como antes.

Por que esta: é a única que atende juntos os princípios da concha ([0023](0023-concha-jogo-sempre-visivel.md)) — o mundo nunca fica escondido (o lugar é sempre o mesmo, e o mundo encolhe em vez de ser coberto), pouca informação por vez (uma coisa aberta) e uma ação principal por contexto (a do topo da pilha). O "voltar" resolve o que o painel lateral com abas não resolve (perder a lista ao abrir um detalhe), e o mesmo código serve ao celular e ao computador. Nenhuma tela precisou mudar: a pilha está toda em `RP.abrirFolha`, `RP.modal` e no CSS da concha.

## Barra de tempo

Tudo que tem tempo mostra **barra de progresso com o cronômetro ao lado**, com um componente só: `RP.barraTempo(inicio, fim, { rotulo, classe: 'curta', cor })` em `nucleo.js` (estilo `.barra-tempo` em `concha.css`). O tique de 1 s que já existia anda a barra (`data-ini`/`data-barra-fim`) e o cronômetro (`data-fim`), no relógio do servidor (`RP.agora()`). Sem início conhecido, mostra só o cronômetro; terminado, a barra fica cheia. `RP.timerHTML` e `RP.itemFilaServidor` usam a mesma peça (num item de várias unidades: barra da próxima unidade e barra fina do item todo; esperando material: barra da viagem dos carregadores).

Onde o servidor só mandava o fim, a visão da API passou a mandar o início:

| Visão | Campo novo |
|---|---|
| `VisaoTropas.Trabalho` | `inicio` (caça: chegada ao bando; escavação: `EscavaInicio`; extração: início equivalente pela carga e pelo ritmo, `InicioExtracao`) |
| `VisaoReino.Item`, `VisaoTropas.emTreino` | `materialPartida` (partida da leva de carregadores que chega por último) |
| `VisaoPessoas.Pessoa` | `partida` (pessoa andando), `treinoInicio` (a unidade dela no item de treino) |
| `VisaoExploracao.Explorador` | `espionandoDesde` |
| `VisaoValiosos.Grupo`, relíquias e ruínas | `partida`, `extraiInicio`; `marcha.partida`, `escolta.partida`, `escavando.inicio`/`partida` |
| `VisaoSocial` | `partida` em propostas aceitas, pactos aguardando pagamento, resgates e mensageiros |
| objeto `batalha` do mapa | `inicio` |

Prazos que não são progresso de nada (escudo, prisioneiro libertado, feridos que morrem, "visto há X") continuam só com o cronômetro. Marchas alheias também: o servidor manda só o trecho à vista, e a barra mentiria sobre a partida.

**Consequências.**

- Telas novas não precisam cuidar de sobreposição: usam `RP.abrirFolha` e `RP.modal` e a pilha se arranja sozinha. Não abra outro elemento fixo na coluna ou sobre o painel.
- Todo tempo novo usa `RP.barraTempo`; quem manda o fim manda também o início.
- `.folha.sobre-nav` e o véu seguem ignorados; a folha no computador deixou de ter 72% da altura.
