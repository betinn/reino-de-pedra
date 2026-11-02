# Reino de Pedra — Protótipo de telas

Protótipo navegável das telas principais, usado como referência visual para a implementação. É **apenas design**: não há regra de jogo real, servidor, persistência nem simulação. Todos os dados são fictícios e fixos (`js/dados.js`); timers, recursos, marchas, pessoas e animais "andam" só para dar vida às telas.

Identidade visual, tokens e componentes: [`design-system.md`](design-system.md).

---

## Como abrir

- **Local:** abra `prototipo/index.html` no navegador (funciona direto do arquivo, sem servidor e sem build).
- **GitHub Pages:** publique o repositório; o protótipo fica em `.../prototipo/` (todos os caminhos são relativos).
- Melhor experiência em viewport de celular (375–430 px). No computador, use o modo dispositivo do navegador; a roda do mouse faz zoom.

Fontes vêm do Google Fonts quando há rede; sem rede o protótipo usa as fontes de fallback e continua funcional.

---

## Direção visual

**Fortaleza** (pedra escura, ferro e brasa), escolhida na primeira entrega. A direção "Cartógrafo" foi descartada e removida.

## Duas visões do mesmo mundo

| Visão | Para quê | Como é |
|---|---|---|
| **Vista** (padrão) | Imersão: ver o reino vivo e assistir o jogo acontecer | Cena 2.5D com câmera alta e inclinada. Construções em volume, pessoas trabalhando, tropas marchando em formação, cavaleiros, animais selvagens, fumaça, moinho, rio e bandeiras animados. Névoa como nuvens; áreas exploradas aparecem esmaecidas e paradas (último estado conhecido). |
| **Mapa** | Localização e planejamento | Mapa tático em hexágonos, com ícones, nomes, legenda e camada de **Perigo** para escolher rotas. |

- Alternância no canto inferior direito do mapa (**Vista | Mapa**), mantendo o mesmo ponto central.
- **Zoom semântico:** afastar além do limite da Vista passa automaticamente para o Mapa.
- As duas visões usam o mesmo modelo (`js/mundo.js`), as mesmas folhas de detalhe e o mesmo minimapa.
- **Meu reino** abre com a Vista do território no topo (arrastar para os lados, tocar nas construções) e o botão "Abrir no mundo".
- A Vista é desenhada em Canvas 2D com arte procedural própria, sem bibliotecas. É a referência de enquadramento, escala, leitura e animação; a tecnologia de renderização do jogo final é decisão da implementação.

---

## Mapa de telas

| # | Tela | Rota | Status |
|---|---|---|---|
| 1 | Entrada (tela inicial) | `#/inicio` | Entregue |
| 1 | Criação do reino (nome e brasão) | `#/criar` | Entregue |
| 2 | Mundo: Vista e Mapa | `#/mapa` (`?modo=cena\|tatico`, `?centro=<local>`, `?foco=<local>`, `?abrir=<tipo>:<id>`) | Entregue |
| 3 | Meu reino (com Vista do território) | `#/reino` (`?local=<id>` abre o local) | Entregue |
| 4 | Construção | — | Próximo bloco |
| 5 | Recrutamento | — | Próximo bloco |
| 6 | Exploradores | — | Próximo bloco |
| 7 | Extração de recurso | — | Próximo bloco |
| 7b | Caça (comida, couro e peles) | — | Próximo bloco |
| 8 | Envio de ataque | — | Próximo bloco |
| 9 | Posturas | — | Próximo bloco |
| 10 | Batalha em andamento | — | Próximo bloco |
| 11 | Relatórios | `#/relatorios` (guia) | Próximo bloco |
| 12 | Bandeiras | — | Próximo bloco |
| 13 | Notificações | — | Próximo bloco |
| 14 | Temporada e legado | — | Próximo bloco |
| 15 | Exílio | — | Próximo bloco |
| 16 | Retorno após regência | `#/regencia` (também em Mais) | Entregue |

Botões que levam a telas ainda não prototipadas mostram um aviso "entra no próximo bloco".

### Navegação principal

`Mapa · Reino · Tropas · Relatórios · Mais` (barra inferior). Notificações ficam no sino, sempre visível no topo.

### Fluxos navegáveis

1. **Primeira vez:** Entrada → Fundar meu reino → nome + brasão → Fundar → modal "reino fundado" (escudo de novato) → Meu reino ou Mundo.
2. **Retorno:** Entrada → Continuar → Meu reino (Vista do território ao vivo).
3. **Assistir:** Mundo (Vista) → arrastar, pinça, botões; pessoas levam minério, toras e sacos ao armazém, o ferreiro martela, soldados treinam e patrulham, o moinho gira, cavalos pastam, animais rondam.
4. **Ameaça:** faixa "Forças desconhecidas" → a câmera vai até o exército (soldados sem brasão, "?") → folha com forças, direção de origem, alvo provável e chegada → Enviar reforços / Espionar.
5. **Fauna:** tocar num bando (Vista) ou no ícone (Mapa) → nível de perigo, regras e Caçar. Em áreas exploradas aparece a placa de perigo com a idade da informação.
6. **Rota segura:** Mapa → Camadas → Perigo: pinta as áreas com fauna; o explorador a cavalo mostra alerta de risco por passar por área de lobos.
7. **Do reino ao mundo:** Meu reino → tocar numa construção da Vista ou num card → detalhes → Ver no mapa.
8. **Regência:** Mais → Retorno após regência → o que o regente fez, o que foi perdido → Retomar o reino.

---

## O que entrou com as regras novas

**Fauna hostil**
- Animais por terreno: lobos e javalis em florestas, ursos em montanhas e colinas, crocodilos em pântanos e rios.
- Ao vivo só em área visível; em área explorada, só o nível de perigo, com idade ("Ursos · há 30 h").
- Perigo baixo, médio ou alto. É reduzido em hexágonos com rota e fica sempre baixo perto do reino inicial.
- Marchas pequenas que cruzam área perigosa recebem alerta, sugerindo escolta ou rota mais longa.
- Ação **Caçar** na folha do animal e do hexágono.

**Couro e peles** entram como recursos na barra (decisão confirmada), obtidos pela caça.

**Reinos controlados por IA**
- **Nunca são identificados como IA.** Mesmos marcadores, nomes, brasões e cores dos jogadores.
- Locais sem dono aparecem como **Ruína** ou **Terra livre**, sem dizer a causa.
- Tela de **Retorno após regência**, com regente conservador: defendeu e produziu, sem expandir.

---

## Estrutura

```
prototipo/
  index.html          entrada do protótipo (SPA por hash, sem build)
  README.md           este arquivo
  design-system.md    paleta, tipografia, ícones, Vista, Mapa e componentes
  css/
    tokens.css        tokens da direção Fortaleza
    base.css          base e componentes
    telas.css         estilos das telas, do mapa tático e da Vista
  js/
    icones.js         sprite SVG de ícones e símbolos do mapa tático (arte própria)
    brasao.js         gerador de brasão
    hex.js            geometria hexagonal e terreno fixo
    dados.js          dados fictícios (reinos, locais, jazidas, marchas, fauna, ruínas, regência)
    nucleo.js         rotas de tela, gestos, folha, modal, avisos, timers, barra de recursos
    mundo.js          modelo do mundo: névoa, marchas no tempo, fauna e perigo
    cena.js           Vista imersiva 2.5D (Canvas 2D)
    mapa.js           tela do mundo: Mapa tático, alternância de visão, folhas de detalhe, minimapa
    telas.js          entrada, criação, meu reino, regência e telas-guia
```

---

## Decisões de design

- **Mobile-first em coluna única**; em telas largas o conteúdo centraliza (máx. 640 px) e o mundo ocupa a tela toda.
- **Vista como padrão do mundo**, Mapa a um toque. Pinça para longe leva ao Mapa (zoom semântico).
- **Névoa em três estados** nas duas visões: visível (cor e movimento), explorado (dessaturado, parado, "Visto há X"), desconhecido (nada desenhado: fumaça/nuvem).
- **Reino como conjunto de locais**: cada local é uma construção própria na Vista e um alvo próprio no Mapa.
- **Anonimato**: forças sem estandarte usam armadura cinza, sem bandeira, com "?"; com estandarte, levam a bandeira nas cores do brasão.
- **Rotas públicas** iguais para todos, com ponte sobre rio e vau marcado com pedras.
- **Ações sempre visíveis**: todo gesto tem botão equivalente; a folha inferior concentra detalhes e ações.
- **Barra de recursos com 7 itens** (madeira, pedra, comida, ferro, couro, peles, população) em números curtos (`2,3k`); o valor exato fica na folha de recursos.

---

## Pontos em aberto (perguntas, não regras)

Nada abaixo altera o `CLAUDE.md`; são escolhas provisórias do protótipo que precisam de confirmação.

1. **Rotas públicas e névoa:** "qualquer jogador vê" significa ver através da névoa ou só ao explorar? O protótipo mostra rotas apenas em áreas conhecidas.
2. **Autoria das bandeiras:** a bandeira mostra quem a colocou? O protótipo mostra o brasão do autor.
3. **Dono de locais explorados:** ao explorar um local de outro reino, o jogador vê a quem ele pertence? O protótipo mostra (o anonimato vale para ataques).
4. **Deslocamento em colina:** o `CLAUDE.md` não define a velocidade; a tela mostra só os recursos.
5. **Terra livre e ruínas:** podem ser ocupadas, reconstruídas ou saqueadas? O protótipo só permite explorar e colocar bandeira.
6. **Couro e peles no `CLAUDE.md`:** a decisão de tratá-los como recursos ainda não está no documento de regras.

---

## Verificação

As telas são conferidas em navegador headless com viewport de celular (390 × 844): capturas de cada tela e de cada tipo de entidade na Vista, gestos de arrastar, pinça, toque e minimapa, alternância Vista/Mapa e o fluxo de criação do reino.
