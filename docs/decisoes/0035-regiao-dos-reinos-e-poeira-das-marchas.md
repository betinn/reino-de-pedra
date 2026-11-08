# 0035 — Região dos reinos e poeira das marchas grandes

**Problema.** Com a névoa cobrindo tudo, o jogador não sabe para onde ir: os reinos ficam escondidos até alguém tropeçar neles, e uma força grande passa a poucos hexágonos sem que ninguém perceba. Pouca informação desestimula o confronto. Tirar a névoa inteira resolveria isso, mas acabaria com a exploração, a espionagem e o anonimato.

## Decisão

Mostrar só o que aponta onde procurar, sem dono nem detalhes. A névoa continua.

### Região de cada reino

- **Todo reino do mundo** (jogador ou IA, menos o próprio) aparece no mapa como uma área marcada, **desde o início**, explorada ou não, por cima da névoa (`Rumores.Regioes`).
- A área tem raio `regiaoReino.raio` (14) e o centro fica a até `regiaoReino.desvio` (9) do castelo, sorteado de forma fixa por reino e castelo (`Rumores.Centro`). O castelo está sempre dentro da área, mas não no centro.
- Não diz de quem é, o tamanho do reino nem onde ficam os outros locais. A chave da região não é o id do reino. Para achar o castelo é preciso explorar; para saber de quem é, espionar.
- Se o castelo muda (queda, exílio), a região acompanha o castelo novo. Reino fora do mundo (sem castelo, inativo) não aparece.

### Poeira das marchas grandes

- Uma marcha de outro reino com pelo menos `rastro.tropas` (12) pessoas, **em movimento** e **fora da vista**, levanta poeira vista a até `rastro.alcance` (14) hexágonos de um local ou de uma marcha do reino (`Rumores.Rastros`).
- A poeira mostra a posição arredondada a uma grade de `rastro.grade` (3) hexágonos, o tamanho aproximado (como as forças vistas: "≈ 15") e o rumo (`rastro.adiante`: 6 hexágonos à frente no caminho). Não mostra dono, unidades nem destino.
- Não levantam poeira: marchas paradas, furtivas (batedor de elite), de aliados (já se veem) e as pequenas. À vista, a marcha aparece inteira, sem poeira.

### IA

A IA recebe exatamente a mesma informação:

- **Exploração** (`Governo.AlvoExploracao`): o explorador a pé procura primeiro o reino da região mais perto do castelo, a até `ia.exploracao.regiaoAlcance` (84), em que ainda não conhece nenhum local de outro reino, indo ao hexágono não visto da área mais perto de casa. Achado um local ali, passa à próxima região; sem nenhuma, explora ao acaso como antes. Achar locais alimenta a espionagem, e a espionagem, os ataques.
- **Defesa** (`Governo.PoeiraVindo`): com poeira vindo na direção de um local seu, a IA não manda o exército atacar fora.

### Cliente

- **Mapa**: a área com contorno tracejado e um marcador "Reino nesta região"; a poeira com nuvem, seta do rumo e rótulo ("Poeira · ≈ 15 · rumo sul"). Afastado (visão do mundo), os dois continuam visíveis.
- **Vista**: a área como elipse tracejada e a poeira animada, por cima da névoa.
- Clicar abre a folha com o que se sabe e o que fazer (explorar, chegar perto). A legenda explica os dois.

## Consequências

- Todo jogador sabe desde o começo para onde ficam os vizinhos, e a exploração ganha direção. A descoberta continua: o castelo pode estar em qualquer lugar de uma área de mais de 600 hexágonos, e os recursos seguem escondidos.
- Um exército grande deixa de passar despercebido perto de casa; caravanas pequenas, batedores e grupos de extração continuam invisíveis fora da vista.
- O anonimato fica: nenhuma das duas informações revela o dono. A posição aproximada da poeira não diz a origem exata.
- Valores no `balanceamento/modelo.js` (`regiaoReino`, `rastro`, `ia.exploracao.regiaoAlcance`); nenhuma meta mudou.
