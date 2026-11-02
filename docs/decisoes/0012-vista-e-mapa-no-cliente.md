# 0012 — Vista e Mapa tático no cliente

**Decisão.** O mundo no cliente tem um só modelo (`web/js/vista/modelo.js`, de `GET /api/v1/mapa`) e duas visões alternáveis com o mesmo centro, portadas do protótipo:

- **Vista** (`vista/cena.js` + `vista/arte.js`): cena 2.5D em Canvas 2D com a arte procedural do protótipo. Chão, rios, rotas, vegetação e névoa vão para um cache que só é refeito ao sair da área coberta, ao mudar o zoom ou quando chegam dados novos; construções, pessoas, marchas e rótulos são redesenhados no máximo a 30 quadros/s. Afastar além do zoom mínimo passa ao Mapa.
- **Mapa tático** (`vista/tatico.js`): terreno, rios, rotas, perigo, véu de explorado e névoa em Canvas com o mesmo tipo de cache; marcadores numa camada SVG por cima, com as classes e ícones do protótipo (zoom semântico, contraescala, anéis de ameaça). O toque acha o marcador pelo elemento.
- **Meu reino** usa a mesma Vista enquadrada nos seus locais (`vista/reino.js`, `RP.vistaReino`).

Regras do desenho:

- O servidor esconde; o cliente só desenha o que veio. Locais de outros reinos: pano cru, brasão "?", nome genérico. Forças sem estandarte: cinza, sem bandeira, "?" no rótulo. Nada distingue reinos de IA.
- Informação antiga (idade > 0) usa a paleta esmaecida e não se mexe; o brilho do rio só corre onde se vê agora.
- Rios e rotas vêm por hexágono; as curvas ligam meios de aresta com o centro como controle. Atalhos que fecham triângulos são cortados (a começar pelos hexágonos com mais vizinhos), para um rio que serpenteia não virar malha.
- Rótulos da Vista não se cobrem: a pílula que bate em outra sobe uma linha.
- Tudo para quando a tela sai ou a aba fica oculta (uma escuta de visibilidade para todas as cenas, sem timer por instância).
- Fundar pelo mapa (`#/mapa?fundar=<tipo>`): o Mapa destaca os hexágonos que servem (terreno, sem rio, livre, explorado); a folha mostra custo e tempo, consulta `GET /fundar/motivo` e só então manda a obra.

**Pontos de extensão** (`RP.mapa`, criados antes de qualquer tela, para nenhum sistema editar estes arquivos):

| Ponto | Uso |
|---|---|
| `tiposObjeto[tipo]` | Desenho de objetos novos do `VisaoMapa.Extras`: marcador do Mapa (`svgTatico`, `classe`, `svgFundo`), desenho na Vista (`desenharCena`, `rotulo`), folha (`folha`, `acoes`), `camada`, `atravessaNevoa`/`sobreNevoa`, `pos` para objetos que andam. Sem registro, o objeto aparece com um marcador genérico. |
| `tiposMarcha[marcha]` | Nome, ícone e desenho na Vista de um tipo novo de marcha. |
| `perigoHex(hex, dados)` | Camada Perigo (o sistema de fauna devolve `baixo`, `medio`, `alto` ou `null`). Sem ela, o botão da camada não aparece. |
| `extrasFolhaHex`, `acoesFolhaHex`, `desenhosExtras`, `desenhosExtrasCena`, `legendaExtras` | Linhas e botões na folha do hexágono, desenhos em Canvas no espaço do mundo (Mapa e chão da Vista), itens na legenda. |

`vista/tipos.js` já registra desenhos padrão (arte do protótipo) para os objetos que outros sistemas vão mandar; cada sistema pode substituí-los. Campos esperados (além de `tipo`, `id` e `hex`):

| Tipo | Campos |
|---|---|
| `fauna` | `animal` (`lobos`, `javalis`, `ursos`, `crocodilos`), `nivel` (`baixo`, `medio`, `alto`), `qtd`; ao vivo quando o hexágono é visível (ou `aoVivo`), senão placa de perigo |
| `torre` | `nivel`, `alcance` (hexágonos), `dono`, `emObra` |
| `bandeira` | `dono`, `autor` (`nome`, `brasao`), `recado` |
| `avistamento` | `alvo` (`espiao` ou `exercito`), `vistoEm` (ms) |
| `farol` | `n` (relíquias no local); aparece mesmo na névoa |

Marchas e locais aceitam `estandarte` com `cor` ou `brasao` (identidade revelada) e `reliquia` (`{ tipo }`).

**Por quê.** O SVG do protótipo inteiro (terreno + névoa) passaria de 7 mil nós em 60 × 48, pesado para arrastar no celular; o terreno em Canvas com cache custa ~15 ms para refazer e quase nada por quadro, e os marcadores em SVG mantêm o visual, o CSS e os ícones do design system. Um modelo e uma arte compartilhados garantem que Vista, Mapa e Meu reino mostrem o mesmo mundo.
