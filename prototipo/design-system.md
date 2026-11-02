# Reino de Pedra — Design system

Referência visual para a implementação. Os valores abaixo vêm de `css/tokens.css`; em caso de divergência, o arquivo de tokens vale.

> **Status:** duas direções visuais em avaliação (A · Fortaleza e B · Cartógrafo). Depois da escolha, a direção descartada sai dos tokens e este documento passa a descrever apenas a escolhida.

---

## 1. Princípios

1. **Legibilidade acima de detalhe.** Texto base de 16 px, mínimo absoluto de 12 px (só em selos e rótulos curtos). Números sempre com algarismos tabulares, para que timers e recursos não "dancem".
2. **Toque primeiro.** Alvo mínimo de 44 × 44 px; ações principais com 48 px; nada depende de hover, clique direito ou teclado.
3. **Sessões curtas.** O que importa agora (ameaça, fila, recurso cheio) aparece no topo, sem precisar procurar. Ordens longas mostram tempo restante ao vivo.
4. **Informação tem idade.** Tudo o que não é visto ao vivo mostra quando foi visto pela última vez (selo "Visto há 6 h", relógio no marcador, contorno tracejado).
5. **Anonimato é visual.** Forças sem estandarte usam a cor de perigo e "?" no lugar de brasão; nunca a cor de um reino.
6. **Um sistema, duas peles.** Componentes usam apenas tokens. Trocar a direção troca cores, fontes, forma das bordas, traço dos ícones e estilo do mapa, sem mudar a estrutura.

---

## 2. Direções

| | A · Fortaleza | B · Cartógrafo |
|---|---|---|
| Conceito | Pedra escura entalhada, ferro e brasa. Clima noturno. | Pergaminho, tinta e lacre, emoldurados por barras de ferro. |
| Fundo | Pedra quase preta com ruído sutil | Pergaminho claro com fibras |
| Ação primária | Laranja de forja (gradiente com relevo) | Vermelho lacre (chapado com borda de tinta) |
| Títulos | Cinzel, caixa alta, espaçado | IM Fell English SC (versaletes de livro antigo) |
| Texto/números | Barlow Semi Condensed | Alegreya Sans |
| Bordas | Raios 6/10/14 px, relevo (luz em cima, sombra embaixo) | Raios 3/5/8 px, traço de 1,5 px e filete duplo nos cards de destaque |
| Ícones | Silhueta preenchida com entalhes escuros | Traço de tinta com aguada leve |
| Mapa | Pintado, tons cheios; névoa é fumaça escura | Aquarela com traço de tinta; desconhecido é pergaminho em branco ("Terra incógnita") |

A direção é aplicada por `data-direcao="a|b"` no `<html>` (ou em qualquer contêiner). No protótipo: `index.html?dir=b`, aba "Mais" ou seletor na tela de entrada.

---

## 3. Tokens

### 3.1 Espaçamento, toque e camadas (comuns)

| Token | Valor | Uso |
|---|---|---|
| `--esp-1` … `--esp-10` | 4, 8, 12, 16, 20, 24, 32, 40 px | Base 4. Margem lateral das telas: 16 px |
| `--alvo-min` / `--alvo` | 44 / 48 px | Altura mínima de qualquer controle / de ações principais |
| `--nav-altura` | 64 px | Navegação inferior (+ área segura do aparelho) |
| `--z-mapa` … `--z-aviso` | 0, 10, 20, 30, 40, 50 | Mapa < controles < barras < folha < modal < aviso |
| `--dur-1/2/3` | 120 / 220 / 360 ms | Toque / aparecer / folha deslizar |

### 3.2 Escala tipográfica (comum)

| Token | px | Uso |
|---|---|---|
| `--fs-1` | 12 | Selos, rótulos da navegação |
| `--fs-2` | 14 | Texto secundário, linhas de informação |
| `--fs-3` | 16 | Texto base, botões |
| `--fs-4` | 18 | Destaque, títulos de barra |
| `--fs-5` | 22 | Título de card |
| `--fs-6` | 28 | Título de tela |
| `--fs-7` | 40 | Título da entrada |

### 3.3 Cores semânticas

| Token | A · Fortaleza | B · Cartógrafo | Uso |
|---|---|---|---|
| `--cor-fundo` | `#111316` | `#e8dbbd` | Fundo de página |
| `--cor-superficie` | `#22262c` | `#f6eedb` | Cards, folhas, modais |
| `--cor-superficie-2` | `#2b3037` | `#efe4ca` | Itens dentro de cards, campos |
| `--cor-borda` / `-forte` | `#3a4049` / `#5b6370` | `#b9a37c` / `#4a3a28` | Divisórias / contornos de controles |
| `--cor-texto` | `#efe9dd` | `#2a2119` | Texto principal |
| `--cor-texto-2` | `#bfb6a8` | `#574634` | Texto secundário |
| `--cor-texto-3` | `#948c80` | `#6f5d47` | Legendas, unidades |
| `--cor-primaria` | `#e07a2e` | `#9b2c22` | Ação principal (uma por área) |
| `--cor-destaque` | `#d9b25c` | `#87590f` | Tempo restante, valiosos, títulos de seção |
| `--cor-sucesso` | `#7dbb63` | `#3f6f24` | Visível, crescimento, jazida restante |
| `--cor-alerta` | `#e8b947` | `#94600a` | Informação antiga, armazém quase cheio |
| `--cor-perigo` | `#f0645a` | `#a3261b` | Ameaça, forças desconhecidas |
| `--cor-info` | `#62acdc` | `#2c5d85` | Postura, links, estado neutro informativo |
| `--barra-fundo` | `#0d0f12` | `#2d3034` | Barra de topo, navegação, avisos |

Contraste medido (WCAG): texto principal ≥ 11:1; texto secundário ≥ 7,6:1; `--cor-texto-3` ≥ 4,6:1 sobre superfície; texto do botão primário 6,3:1 (A) e 6,8:1 (B); cores de estado ≥ 4,5:1 sobre superfície. Em B, `--cor-destaque` sobre o fundo de página fica em 4,4:1: usar sobre superfície ou em texto ≥ 18 px.

### 3.4 Donos no mapa

| Token | A | B | Regra |
|---|---|---|---|
| `--cor-meu` | `#5ea6ea` | `#2c5d85` | Sempre o seu reino |
| `--cor-rival-1` | `#e0503f` | `#a3261b` | Outro reino (exemplo) |
| `--cor-rival-2` | `#a77ad9` | `#5e3f80` | Outro reino (exemplo) |
| `--cor-desconhecido` | `#9aa0a8` | `#6f6658` | Dono não identificado |

Na implementação, cada reino rival recebe a cor principal do próprio brasão; o protótipo usa duas cores fixas como exemplo. Forças hostis sem estandarte usam `--cor-perigo`.

### 3.5 Recursos

`--rec-madeira`, `--rec-pedra`, `--rec-comida`, `--rec-ferro`, `--rec-populacao`, `--rec-ouro`, `--rec-prata`, `--rec-sal`, `--rec-cavalo`, `--rec-ervas`, `--rec-gema`, `--rec-lendario`. Classe utilitária `r-<recurso>` aplica a cor. O ícone sempre acompanha a cor: a cor nunca é o único identificador.

### 3.6 Terreno, névoa e rotas

| Token | A | B |
|---|---|---|
| `--t-planicie` | `#8b9a50` | `#e2d7a2` |
| `--t-floresta` | `#4a7341` | `#b9c48f` |
| `--t-colina` | `#9c8961` | `#dcc394` |
| `--t-montanha` | `#7c7671` | `#cbbea9` |
| `--t-pantano` | `#5c6d4e` | `#bcc39d` |
| `--rio-agua` / `--rio-margem` | `#4f9fd2` / `#24485f` | `#8fb8cd` / `#3e6a86` |
| `--nevoa-1/2/3` | fumaça `#0d0f12`… | pergaminho `#e8dbbd`… |
| `--explorado-veu` + `--explorado-hachura` | véu escuro + hachura clara | véu de pergaminho + hachura de tinta |
| `--rota-cor` | `#d8c08e` (estrada contínua) | `#7a4f27` (tracejado de tinta) |

Cada terreno tem uma variação `-2` sorteada por hexágono para quebrar a repetição.

### 3.7 Tinturas do brasão (comuns)

`--tin-ouro`, `--tin-prata` (metais); `--tin-vermelho`, `--tin-azul`, `--tin-verde`, `--tin-purpura`, `--tin-negro`, `--tin-castanho` (cores). São as mesmas nas duas direções porque pertencem ao jogador, não à interface.

---

## 4. Tipografia

| Papel | A | B | Fallback |
|---|---|---|---|
| Títulos (`--fonte-titulo`) | Cinzel 600/700, caixa alta, +0,06em | IM Fell English SC 400 | Trajan Pro / Palatino → Georgia → serif |
| Texto, botões, números (`--fonte-texto`) | Barlow Semi Condensed 400–700 | Alegreya Sans 400–700 | Roboto Condensed / Gill Sans → system-ui → sans-serif |

Regras:
- Fonte de título só em títulos curtos (tela, card, seção, nome de reino no mapa). Nunca em parágrafos, números ou botões.
- Números (recursos, timers, coordenadas) sempre na fonte de texto com `font-variant-numeric: lining-nums tabular-nums`.
- Botões: A em caixa alta com espaçamento; B em caixa normal.
- Google Fonts é opcional: sem rede, o protótipo cai no fallback e continua legível.

---

## 5. Ícones

- Desenhados à mão em SVG (`js/icones.js`), grade 24 × 24, cantos arredondados. Nenhuma arte de terceiros.
- Três camadas de traço, estilizadas por direção:
  - `ic-s` silhueta: preenchida em A, traço + aguada de 16% em B;
  - `ic-d` detalhe: entalhe escuro em A, traço em B;
  - `ic-l` linha estrutural: sempre na cor do ícone.
- Uso: `RP.icone('mina', 'ico-p r-ferro')` → `<svg class="ico"><use href="#i-mina"/></svg>`. Tamanhos: 18 (`ico-p`), 24 (padrão), 32 (`ico-g`).
- Conjunto atual: recursos (madeira, pedra, comida, ferro, população, ouro, prata, sal, cavalo, ervas, gema, lendário, ruína); locais (castelo, vila, moradia, mina, serraria, pasto, armazém, ferraria, quartel, muralha); unidades (tropas, explorador, bota, picareta, batedor, cerco); interface (mapa, relatórios, menu, sino, mais, menos, alvo, camadas, fechar, voltar, avançar, relógio, escudo, alerta, olho, bandeira, estandarte, interrogação, coroa, martelo, cadeado, bússola, info, check, subir, seta, névoa, rota, ponte, temporada).
- Ícone sozinho precisa de `aria-label` no botão; ícone ao lado de texto é decorativo (`aria-hidden`).

---

## 6. Mapa

### 6.1 Grade e camadas
- Hexágonos "pointy-top", coordenadas offset (coluna, linha), raio de referência 30 unidades.
- Ordem das camadas: terreno → rios → rotas (pontes e vaus) → véu de explorado → névoa → caminhos de marcha → seleção → jazidas → locais → bandeiras → marchas.
- Hexágonos desconhecidos **não desenham terreno** (nada vaza pela névoa). A fronteira conhecido/desconhecido ganha um contorno (`borda-nevoa`): filete dourado em A, linha de tinta em B.

### 6.2 Estados de névoa
| Estado | Visual | Conteúdo |
|---|---|---|
| Visível | Terreno em cor cheia | Tudo ao vivo, inclusive marchas inimigas |
| Explorado | Véu + hachura diagonal; marcadores a 78% com contorno tracejado e relógio | Último estado conhecido; folha mostra "Visto há X" e aviso "pode ter mudado" |
| Desconhecido | Fumaça (A) ou pergaminho em branco com "Terra incógnita" (B) | Nada; ações: enviar explorador, colocar bandeira |

### 6.3 Marcadores
| Elemento | Forma | Cor |
|---|---|---|
| Castelo | Círculo grande com anel duplo + brasão do reino + nome | Contorno na cor do dono |
| Local | Círculo com ícone do tipo | Contorno e ícone na cor do dono |
| Local ameaçado | + anel pulsante | `--cor-perigo` |
| Jazida | Losango com ícone do recurso | Contorno `--cor-destaque`; lendária com brilho `--rec-lendario` |
| Bandeira | Mastro com pano | Pano na cor de quem colocou |
| Exército / explorador | Disco cheio com ícone (exército 15, explorador 12) + selo de tempo | Disco na cor do dono |
| Forças desconhecidas | Disco cheio + "?" + anel pulsante | `--cor-perigo` |
| Estandarte levado | Selo de estandarte no canto do disco | `--cor-destaque` |
| Rota pública | Estrada (A) ou tracejado (B), com ponte sobre rio | `--rota-cor` |
| Caminho de marcha | Pontilhado animado até o destino + anel no destino | Cor do dono |

Marcadores mantêm tamanho legível em qualquer zoom (contraescala `--k`), com área de toque de ≥ 44 px.

### 6.4 Zoom
| Faixa | Mostra |
|---|---|
| Mundo (< 0,30) | Terreno sem símbolos; castelos, marchas; locais e jazidas viram pontos coloridos |
| Longe (0,30–0,46) | Símbolos de terreno; locais e jazidas como pontos; jazidas lendárias inteiras |
| Médio (0,46–0,95) | Todos os marcadores; nome só nos castelos |
| Perto (≥ 0,95) | Nomes de todos os locais, jazidas e bandeiras |

Controles: arrastar, pinça, roda do mouse; botões +, −, centralizar no castelo e camadas (48 px, à direita, no meio da tela, longe da navegação). Minimapa no canto inferior esquerdo com retângulo da vista; tocar ou arrastar nele move o mapa. Controles e minimapa somem enquanto uma folha está aberta.

---

## 7. Componentes

| Componente | Classe | Regras |
|---|---|---|
| Botão | `.btn` + `.btn-primario` / `.btn-perigo` / `.btn-fantasma`, tamanhos `.btn-p` (44) e `.btn-grande` (56), `.btn-bloco`, `.btn-icone` | Uma ação primária por área. Pressionado desce 2 px. Desabilitado: `aria-disabled` + 45% de opacidade. |
| Card | `.card`, `.card-moldura` | Superfície com relevo (A) ou traço (B). `card-moldura` só para destaques (castelo, prévia do brasão). |
| Selo | `.selo` + `-visivel` / `-antigo` / `-desconhecido` / `-perigo` / `-info` / `-destaque` | Estado curto, sempre com ícone quando indica névoa ou ameaça. |
| Barra de tempo | `.timer` > `.timer-topo` + `.barra > i` | Rótulo à esquerda, tempo restante à direita em `--cor-destaque`; atualiza a cada segundo. Abaixo de 1 h: `mm:ss`; acima: `1 h 05 min`. |
| Fila | card com títulos "Obras"/"Recrutamento" + timers; itens sem início mostram selo "Aguardando" | Sempre mostrar a quantidade na fila. |
| Medidor | `.barra.barra-grossa` | População vs. teto, recurso vs. armazém, jazida restante (`.barra-sucesso`). |
| Abas / segmentado | `.abas` > `.aba[aria-selected|aria-pressed]` | A: realce com sublinhado de brasa; B: caixa de tinta. Rolagem horizontal se não couber. |
| Folha inferior | `RP.abrirFolha({...})` | Detalhe contextual e ações. No mapa fica acima da navegação e sem véu (o mapa continua tocável); fora do mapa tem véu. Fecha no X, no véu, arrastando para baixo ou com Esc. |
| Modal | `RP.modal({...})` | Só para confirmações e marcos (reino fundado). Ações empilhadas, primária em cima. |
| Aviso (toast) | `RP.aviso({...})` | Topo da tela, some em ~3 s, borda esquerda colorida pelo tipo. |
| Faixa de alerta | `.faixa-alerta` | Ameaça em andamento; tocar leva ao exército no mapa. Ícone pulsa (respeita movimento reduzido). |
| Barra de recursos | `RP.barraRecursos()` | Madeira, pedra, comida, ferro e população, ao vivo. Recurso ≥ 95% do armazém fica em `--cor-alerta`. Tocar abre o detalhe. |
| Navegação | `.nav` | Mapa · Reino · Tropas · Relatórios · Mais. Ícone + rótulo; item ativo com fundo e marcador no topo. |
| Campo | `.campo` > `label` + `input` + `.campo-ajuda` + `.campo-erro` | Erro só depois de sair do campo ou tentar enviar. |
| Amostras / opções | `.amostras > .amostra`, `.opcoes > .opcao` | Escolhas visuais (cores, formas, símbolos) com prévia e estado `aria-pressed`. |
| Brasão | `RP.brasao(cfg, {tamanho})` | Forma (português, clássico, rodela) × divisão (6) × 2 cores × símbolo (8) × cor do símbolo. Dica de leitura: metal sobre cor. |

---

## 8. Movimento

- Folhas deslizam (360 ms), modais crescem de 94% (220 ms), avisos descem do topo.
- Animações contínuas só para comunicar estado: caminho de marcha "andando", anel de ameaça, brilho lendário, seleção.
- `prefers-reduced-motion: reduce` desliga todas as animações contínuas.

---

## 9. Regras de uso

- Não usar cor literal em componente: sempre token.
- Não criar estado de névoa novo: visível, explorado ou desconhecido.
- Não mostrar identidade de atacante sem estandarte ou espionagem.
- Não esconder ação principal atrás de gesto: todo gesto do mapa tem botão equivalente.
- Toda contagem regressiva mostra o que acontece no fim ("chegada", "nível 4").
