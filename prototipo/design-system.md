# Reino de Pedra — Design system

Referência visual para a implementação. Os valores abaixo vêm de `css/tokens.css` e `js/cena.js`; em caso de divergência, o código vale.

**Direção visual: Fortaleza** — pedra escura entalhada, ferro e brasa. Clima de fortaleza; a ação principal brilha em laranja de forja.

---

## 1. Princípios

1. **Imersão e leitura, cada uma no seu lugar.** A *Vista* mostra o mundo vivo para quem quer assistir; o *Mapa* tático mostra posição, donos e perigo para quem quer decidir. As duas são o mesmo mundo, alternáveis sem perder o lugar.
2. **Legibilidade acima de detalhe.** Texto base de 16 px, mínimo de 12 px (só selos e rótulos curtos). Números com algarismos tabulares.
3. **Toque primeiro.** Alvo mínimo de 44 × 44 px; ações principais com 48 px; nada depende de hover, clique direito ou teclado. Todo gesto tem botão equivalente.
4. **Sessões curtas.** O que importa agora (ameaça, fila, recurso cheio, perigo na rota) aparece sem procurar. Ordens longas mostram tempo restante ao vivo.
5. **Informação tem idade.** O que não é visto ao vivo mostra quando foi visto pela última vez e aparece parado e esmaecido.
6. **Anonimato é visual.** Forças sem estandarte nunca usam cor, bandeira ou brasão de reino.
7. **IA é invisível.** Reinos controlados por IA usam exatamente os mesmos marcadores, nomes, brasões e cores dos jogadores. Nenhum selo, ícone ou texto os distingue.

---

## 2. Tokens

### 2.1 Espaçamento, toque e camadas

| Token | Valor | Uso |
|---|---|---|
| `--esp-1` … `--esp-10` | 4, 8, 12, 16, 20, 24, 32, 40 px | Base 4. Margem lateral das telas: 16 px |
| `--alvo-min` / `--alvo` | 44 / 48 px | Altura mínima de qualquer controle / de ações principais |
| `--nav-altura` | 64 px | Navegação inferior (+ área segura do aparelho) |
| `--z-mapa` … `--z-aviso` | 0, 10, 20, 30, 40, 50 | Mundo < controles < barras < folha < modal < aviso |
| `--dur-1/2/3` | 120 / 220 / 360 ms | Toque / aparecer / folha deslizar |

### 2.2 Escala tipográfica

| Token | px | Uso |
|---|---|---|
| `--fs-1` | 12 | Selos, rótulos da navegação |
| `--fs-2` | 14 | Texto secundário, linhas de informação |
| `--fs-3` | 16 | Texto base, botões |
| `--fs-4` | 18 | Destaque, títulos de barra |
| `--fs-5` | 22 | Título de card |
| `--fs-6` | 28 | Título de tela |
| `--fs-7` | 40 | Título da entrada |

### 2.3 Cores da interface

| Token | Valor | Uso |
|---|---|---|
| `--cor-fundo` | `#111316` | Fundo de página (com ruído de pedra `--textura`) |
| `--cor-superficie` / `-2` / `-3` | `#22262c` / `#2b3037` / `#363c46` | Cards e folhas / itens internos / realces |
| `--cor-borda` / `-forte` | `#3a4049` / `#5b6370` | Divisórias / contornos de controles |
| `--cor-texto` / `-2` / `-3` | `#efe9dd` / `#bfb6a8` / `#948c80` | Principal / secundário / legendas |
| `--cor-primaria` | `#e07a2e` | Ação principal (brasa), uma por área |
| `--cor-destaque` | `#d9b25c` | Ouro velho: tempo restante, valiosos, títulos |
| `--cor-sucesso` | `#7dbb63` | Visível, crescimento, jazida restante |
| `--cor-alerta` | `#e8b947` | Informação antiga, armazém quase cheio |
| `--cor-perigo` | `#f0645a` | Ameaça, forças desconhecidas |
| `--cor-info` | `#62acdc` | Postura, links |
| `--barra-fundo` | `#0d0f12` | Barra de topo, navegação, avisos |

Contraste medido (WCAG): texto principal ≥ 12:1 sobre superfície; secundário 7,6:1; `--cor-texto-3` 4,6:1; texto do botão primário 6,3:1; cores de estado ≥ 4,5:1 sobre superfície.

### 2.4 Donos

| Token | Valor | Regra |
|---|---|---|
| `--cor-meu` | `#5ea6ea` | Sempre o seu reino |
| `--cor-rival-1` / `-2` | `#e0503f` / `#a77ad9` | Identidade revelada de outro reino: exército com estandarte e bandeiras (na implementação, a cor principal do brasão do autor) |
| `--cor-desconhecido` | `#9aa0a8` | Locais de outros reinos (explorar não revela o dono), ruína, terra livre |

Locais de outros reinos nunca usam cor de reino: cinza, brasão "?", nome genérico ("Castelo", "Mina"). Forças hostis sem estandarte: `--cor-perigo` no Mapa; armadura cinza sem bandeira na Vista.

### 2.5 Recursos e perigo

- Recursos: `--rec-madeira`, `--rec-pedra`, `--rec-comida`, `--rec-ferro`, `--rec-couro`, `--rec-peles`, `--rec-populacao`, `--rec-ouro`, `--rec-prata`, `--rec-sal`, `--rec-cavalo`, `--rec-ervas`, `--rec-gema`, `--rec-lendario`. Classe `r-<recurso>`. A cor sempre acompanha o ícone.
- Perigo da fauna: `--perigo-baixo` `#e8b947`, `--perigo-medio` `#ec8a3a`, `--perigo-alto` `#ea4f43`. Classe `nivel-<nivel>` define `--nivel`.

### 2.6 Mapa tático

| Token | Valor |
|---|---|
| `--t-planicie` / `-floresta` / `-colina` / `-montanha` / `-pantano` | `#8b9a50` / `#4a7341` / `#9c8961` / `#7c7671` / `#5c6d4e` (+ variação `-2`) |
| `--rio-agua` / `--rio-margem` | `#4f9fd2` / `#24485f` |
| `--nevoa-1/2/3` | fumaça `#0d0f12`, `#111418`, `#15191e` |
| `--explorado-veu` + `--explorado-hachura` | véu escuro + hachura clara |
| `--rota-cor` / `--rota-borda` | `#d8c08e` / `#4d3c28` |

### 2.7 Tinturas do brasão

`--tin-ouro`, `--tin-prata` (metais); `--tin-vermelho`, `--tin-azul`, `--tin-verde`, `--tin-purpura`, `--tin-negro`, `--tin-castanho` (cores). Pertencem ao jogador, não à interface.

---

## 3. Tipografia

| Papel | Fonte | Fallback |
|---|---|---|
| Títulos (`--fonte-titulo`) | Cinzel 600/700, caixa alta, +0,06em | Trajan Pro → Times New Roman → Georgia → serif |
| Texto, botões, números (`--fonte-texto`) | Barlow Semi Condensed 400–700 | Roboto Condensed → Arial Narrow → system-ui → sans-serif |

- Fonte de título só em títulos curtos e no nome dos castelos. Nunca em parágrafos, números ou botões.
- Botões em caixa alta com espaçamento.
- Números na fonte de texto, tabulares. Barras estreitas usam número curto (`640`, `2,3k`, `12k`); o valor exato fica na folha de detalhe.

---

## 4. Ícones

- SVG próprios (`js/icones.js`), grade 24 × 24. Nenhuma arte de terceiros.
- Estilo: silhueta preenchida (`ic-s`) com entalhes escuros (`ic-d`) e linhas estruturais (`ic-l`).
- Uso: `RP.icone('mina', 'ico-p r-ferro')`. Tamanhos 18 (`ico-p`), 24, 32 (`ico-g`).
- Conjunto: recursos (madeira, pedra, comida, ferro, couro, peles, população, ouro, prata, sal, cavalo, ervas, gema, lendário, ruína); locais (castelo, vila, moradia, mina, serraria, pasto, armazém, ferraria, quartel, muralha, escombros, estaca); fauna (lobo, javali, urso, crocodilo, pata); unidades (tropas, explorador, bota, picareta, batedor, cerco); interface (mapa, vista, hexágonos, relatórios, menu, sino, mais, menos, alvo, camadas, fechar, voltar, avançar, relógio, escudo, alerta, olho, bandeira, estandarte, interrogação, coroa, martelo, cadeado, bússola, info, check, subir, seta, névoa, rota, ponte, temporada).
- Ícone sozinho em botão precisa de `aria-label`.

---

## 5. Vista (mundo imersivo 2.5D)

### 5.1 Câmera e projeção
- Câmera alta e inclinada sobre o mesmo mundo do Mapa: o chão é achatado verticalmente por **K = 0,62**; objetos ficam em pé, desenhados do ponto de contato com o chão para cima.
- Construções em caixas oblíquas: frente, topo e lateral direita visíveis (deslocamento do topo **0,45**), com luz vindo da esquerda e sombra elíptica no chão.
- Ordem de desenho por profundidade (y do chão): quem está mais ao sul cobre quem está ao norte.
- Zoom da Vista: 0,85 a 3,2 (1 = hexágono de 52 px de largura). Abaixo do mínimo, passa ao Mapa.

### 5.2 Paleta de cena
Luz natural levemente quente, para conversar com a interface escura:

| Elemento | Cores |
|---|---|
| Planície | `#7f9c47` com tufos `#5d7b31` / `#93ad55` e flores |
| Floresta | chão `#4d6f35`; coníferas `#2e5427` / `#3b6a2f`; folhosas `#4f7d36` / `#77a44f` |
| Colina / montanha | `#9b8758` com montículos; picos `#8a837a` / `#5d5852` com neve `#eef1f4` |
| Pântano | `#5b6a45` com poças `#4a6764` e juncos |
| Água | `#3a7fb0`, margem `#56693f`, brilho animado |
| Estrada | `#b09768`, borda `#86704c`; pontes de madeira |
| Pedra das construções | `#aaa398` / luz `#c4beb3` / sombra `#7e786e` |
| Casas | parede `#d8ccb3`, telhado `#a4523b` ou madeira `#8a6a45` |
| Névoa | base `#191d24` com nuvens cinza-azuladas |

**Informação antiga:** toda a paleta é dessaturada e escurecida (mistura de 42% com `#30363f`), e nada se mexe.

### 5.3 O que aparece
| Elemento | Desenho | Animação |
|---|---|---|
| Castelo | Muralhas, 4 torres, torre de menagem, portão com grade | Bandeiras na cor do seu reino; tecido cru quando o dono é desconhecido. Guardas patrulhando |
| Vila | 3 casas, poço, campo cultivado, horta | Moinho girando (Vila do Moinho), fumaça de chaminé, aldeões indo e vindo |
| Mina | Colina com entrada escorada, trilho, carrinho e monte de minério (cor do recurso) | Mineiro com picareta; carregador levando minério ao armazém |
| Serraria | Telheiro, serra, pilha de toras, tocos | Lâmina girando; lenhador; carregador de toras |
| Pasto | Cerca circular | Cavalos pastando e trotando |
| Armazém | Celeiro grande com caixas e sacos | Ajudante trabalhando |
| Ferraria | Casa de pedra, chaminé, bigorna | Forja pulsando, faíscas, fumaça escura, ferreiro martelando |
| Quartel | Tendas (uma na cor do dono), boneco de treino, bandeira | Soldados treinando estocadas |
| Jazidas | Rochas com veios (ouro, prata), cristais (gemas), salina, ervas, manada de cavalos, ruínas lendárias com brilho | Cintilar, partículas, cavalos pastando |
| Ruína / terra livre | Muros quebrados e escombros / terreno limpo com estacas | — |
| Bandeira | Mastro com pano na cor de quem colocou | Pano ondulando |
| Exército | Formação de soldados com lança e escudo na cor do dono; porta-bandeira | Passos, poeira; avança no tempo real da marcha |
| Forças desconhecidas | Mesma formação em cinza, sem bandeira | Rótulo "?" com tempo de chegada |
| Exército com estandarte | Porta-bandeira com a cor do brasão | — |
| Explorador | Cavaleiro (a cavalo), andarilho com picareta (prospector) | Galope / caminhada |
| Fauna | Lobos, javalis, ursos, crocodilos (na água) | Bando passeando pelo território |
| Área de perigo conhecida | Placa triangular na cor do nível | Rótulo com animal e idade da informação |
| Névoa | Bancos de nuvem sobre o desconhecido | Nuvens à deriva |

### 5.4 Rótulos na Vista
Pílulas escuras com borda colorida, sempre legíveis sobre a cena: nome do castelo (fonte de título), tempo de chegada das marchas (borda na cor do dono; vermelha e com "?" para forças desconhecidas), animais com nível de perigo, "Ameaçado" sobre locais sob ataque.

### 5.5 Desempenho (referência)
Chão, vegetação, relevo e névoa ficam num cache que só é refeito ao sair da área coberta ou mudar o zoom. Construções, pessoas, animais e efeitos são redesenhados a ~30 quadros/s (quadro cheio durante gestos). A Vista pausa fora da tela e com a aba oculta.

---

## 6. Mapa tático

- Hexágonos "pointy-top", coordenadas offset (coluna, linha), raio de referência 30 unidades.
- Camadas: terreno → rios → rotas (pontes e vaus) → perigo (opcional) → véu de explorado → névoa → caminhos de marcha → seleção → ruínas → jazidas → locais → fauna → bandeiras → marchas.
- Hexágonos desconhecidos não desenham terreno (nada vaza pela névoa); a fronteira ganha filete dourado.

| Estado | Visual | Conteúdo |
|---|---|---|
| Visível | Cor cheia | Tudo ao vivo, inclusive marchas inimigas e animais |
| Explorado | Véu + hachura; marcadores a 78% com contorno tracejado e relógio | Último estado conhecido, inclusive perigo; "Visto há X" |
| Desconhecido | Fumaça escura e "Terra incógnita" | Nada |

| Marcador | Forma |
|---|---|
| Castelo | Círculo grande com anel duplo, brasão e nome (de outro reino: cinza, brasão "?", "Castelo") |
| Local | Círculo com ícone do tipo, na cor do dono; ameaçado com anel pulsante |
| Jazida | Losango com ícone do recurso; lendária com brilho |
| Fauna ao vivo | Círculo com o animal, contorno na cor do nível e contador do bando |
| Área de perigo | Triângulo na cor do nível com pegada |
| Ruína / terra livre | Círculo tracejado cinza com escombros / estacas |
| Marcha | Disco cheio com ícone e tempo; "?" se desconhecida; estandarte se identificada; "!" se pequena e em rota perigosa |

Camada **Perigo** (desligada por padrão): pinta hexágonos conhecidos em amarelo, laranja ou vermelho. Rotas reduzem um nível; perto do reino inicial o perigo é sempre baixo.

Zoom: mundo (< 0,30) · longe (0,30–0,46) · médio (0,46–0,95) · perto (≥ 0,95), com marcadores em contraescala.

---

## 7. Componentes

| Componente | Classe / função | Regras |
|---|---|---|
| Botão | `.btn` + `.btn-primario` / `.btn-perigo` / `.btn-fantasma`; `.btn-p` (44), `.btn-grande` (56), `.btn-bloco`, `.btn-icone` | Uma ação primária por área. Pressionado desce 2 px. Inativo mas tocável (`.btn-inativo`) quando o toque explica o motivo. |
| Card | `.card`, `.card-moldura` | Superfície com relevo. Moldura só para destaques. |
| Selo | `.selo` + `-visivel` / `-antigo` / `-desconhecido` / `-perigo` / `-info` / `-destaque` / `-perigo-<nivel>` | Estado curto com ícone. |
| Barra de tempo | `.timer` | Rótulo à esquerda, tempo restante à direita; `mm:ss` abaixo de 1 h. |
| Fila | card com Obras / Recrutamento | Mostra quantidade; itens sem início com "Aguardando". |
| Abas / segmentado | `.abas > .aba` | Realce com sublinhado de brasa. Também usado na alternância Vista / Mapa. |
| Folha inferior | `RP.abrirFolha({...})` | Detalhes e ações. No mundo fica acima da navegação, sem véu; fecha no X, no véu, arrastando para baixo ou com Esc. |
| Modal | `RP.modal({...})` | Só para confirmações e marcos. |
| Aviso | `RP.aviso({...})` | Topo, some em ~3 s. |
| Faixa de alerta | `.faixa-alerta` | Ameaça em andamento; leva até o exército. |
| Linha de perigo | `.perigo-linha.nivel-<nivel>` | Perigo do hexágono ou da rota de uma marcha, com orientação (escolta, rota longa). |
| Barra de recursos | `RP.barraRecursos()` | 6 recursos + população + sino, números curtos; ≥ 95% do armazém em alerta. |
| Navegação | `.nav` | Mapa · Reino · Tropas · Relatórios · Mais. |
| Gestos | `RP.gestos(el, {...})` | Arrastar, pinça, roda e toque, iguais em todas as superfícies. |
| Vista | `new RP.Cena(canvas, {...})` | Interativa (mundo) ou só toque + arrasto lateral (topo de Meu reino). |
| Brasão | `RP.brasao(cfg, {tamanho})` | 3 formas × 6 divisões × 2 cores × 8 símbolos × cor do símbolo. |

---

## 8. Movimento

- Folhas deslizam (360 ms), modais crescem de 94% (220 ms), avisos descem do topo, a câmera desliza ao focar algo (380 ms).
- Na Vista, a animação é o conteúdo: trabalho, marcha, fauna, fumaça, água e bandeiras. Informação antiga não se mexe.
- No Mapa, animações contínuas só comunicam estado: caminho de marcha, anel de ameaça, brilho lendário, seleção.
- `prefers-reduced-motion` desliga as animações contínuas da interface.

---

## 9. Regras de uso

- Não usar cor literal em componente de interface: sempre token.
- Não criar estado de névoa novo: visível, explorado ou desconhecido, iguais nas duas visões.
- Não mostrar identidade de atacante sem estandarte ou espionagem.
- Não revelar o dono de locais de outros reinos, nem quem construiu rotas alheias.
- Rotas só aparecem em área explorada; bandeiras sempre mostram o autor.
- Tempo de viagem sempre visível e curto: nada de esperas de muitas horas sem o que fazer.
- Não marcar reino como IA de nenhuma forma.
- Não esconder ação principal atrás de gesto.
- Toda contagem regressiva diz o que acontece no fim ("chegada", "nível 4").
