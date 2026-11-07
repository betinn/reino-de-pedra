# 0031 — Rota desenhada, envio rápido pelo botão direito e névoa mais leve

**Problema.** Testando na mesa de jogo ([0030](0030-mesa-desktop.md)), três coisas atrapalhavam. Cada ponto de "Seguir rota" custava cerca de três cliques e uma ida e volta à janela de Exploradores. Mandar tropas sem selecioná-las antes pedia abrir a folha do local. A névoa da Vista, quase preta e com bancos de nuvem em cada hexágono, competia com o mapa.

## Decisão

### Rota desenhada

- Escolher "Seguir rota" fecha a janela e entra num modo de desenho, com a barra no topo do mapa. Cada clique, esquerdo ou direito, é um ponto. Vale nas duas visões.
- A linha no chão é o caminho que o explorador fará: `POST /exploracao/previa` aceita `pontos` e devolve o caminho emendado de ponto em ponto, com tempo e risco. Assim, a rota segura por padrão continua valendo e o jogador vê o desvio antes de enviar. Quem quer um trajeto exato clica em hexágonos próximos.
- Enter envia, Z desfaz o último ponto, O fecha o circuito, Esc cancela e volta à janela com os pontos de antes. "Ajustes" volta à janela mantendo os pontos, para a escolta.
- O limite de pontos deixa de ser o da fila (10) e passa a ser o da linha da patrulha (`patrulha.maxHexes`).

### Envio rápido

- "Enviar tropas para cá" é o primeiro item do menu de contexto sem seleção, em hexágonos, locais e objetos.
- O painel usa a folha da base: abas de origem, atalhos (Últimas, Metade, Todas), as quantidades e o tempo de chegada, com o caminho desenhado no mapa. Enter envia; o botão direito em outro hexágono troca o destino; Esc ou um clique no mundo larga o envio.
- A origem e as tropas usadas ficam guardadas no navegador (`RP.pref`), como conveniência.
- O fluxo de seleção mais botão direito não muda.

### Névoa da Vista

| Estado | Antes | Agora |
|---|---|---|
| Desconhecido | Quase preto, aresta de hexágono e nuvens em cada hexágono | Tom médio liso (`#3b434d`), com poucas nuvens tênues à deriva |
| Fronteira | Corte duro | Mancha suave desenhada só na fronteira, por cima do cache |
| Explorado | 42% de cinza escuro | 26% do tom da névoa, ainda sem saturação nem movimento |
| Visão atual | Cor cheia, animada | Igual |

O desenho também ficou mais barato: a névoa saiu da lista de objetos ordenados por profundidade. O Mapa tático, que é a leitura técnica do mapa, não mudou.
