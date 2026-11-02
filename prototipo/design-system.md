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
| `--cor-texto` / `-2` / `-3` | `#efe9dd` / `#bfb6a8` / `#a69e92` | Principal / secundário / legendas |
| `--cor-primaria` | `#e07a2e` | Ação principal (brasa), uma por área |
| `--cor-destaque` | `#d9b25c` | Ouro velho: tempo restante, valiosos, títulos |
| `--cor-sucesso` | `#7dbb63` | Visível, crescimento, jazida restante |
| `--cor-alerta` | `#e8b947` | Informação antiga, armazém quase cheio |
| `--cor-perigo` | `#f0645a` | Ameaça, forças desconhecidas |
| `--cor-info` | `#62acdc` | Postura, links |
| `--barra-fundo` | `#0d0f12` | Barra de topo, navegação, avisos |

Contraste medido (WCAG): texto principal ≥ 12:1 sobre superfície; secundário 7,6:1; `--cor-texto-3` ≥ 5:1 sobre `--cor-superficie-2`; texto do botão primário 6,3:1; cores de estado ≥ 4,5:1 sobre superfície. Auditoria axe-core (WCAG 2.1 AA) sem violações em todas as telas.

### Gráficos

| Token | Valor | Uso |
|---|---|---|
| `--grafico-meu` | `#4f97da` | Série do seu lado (batalha), barras de rendimento |
| `--grafico-hostil` | `#e2584e` | Série das forças inimigas |

Validadas com o validador de paleta contra `#22262c` (faixa de luminosidade do modo escuro, separação para daltonismo ΔE 21, contraste ≥ 3:1). Regras: linha de 2 px, ponto atual com anel na cor da superfície, grade de 1 px, um único eixo, legenda sempre presente com 2 séries, rótulo direto só no ponto atual, cruz + dica ao tocar/passar, tabela como alternativa. Texto nunca usa a cor da série.

### 2.4 Donos

| Token | Valor | Regra |
|---|---|---|
| `--cor-meu` | `#5ea6ea` | Sempre o seu reino |
| `--cor-rival-1` / `-2` | `#e0503f` / `#a77ad9` | Identidade revelada de outro reino: exército com estandarte e bandeiras (na implementação, a cor principal do brasão do autor) |
| `--cor-desconhecido` | `#9aa0a8` | Locais de outros reinos (explorar não revela o dono), ruína, terra livre |

Locais de outros reinos nunca usam cor de reino: cinza, brasão "?", nome genérico ("Castelo", "Mina"). Forças hostis sem estandarte: `--cor-perigo` no Mapa; armadura cinza sem bandeira na Vista.

### 2.5 Recursos e perigo

- Recursos: `--rec-madeira`, `--rec-pedra`, `--rec-comida`, `--rec-ferro`, `--rec-couro`, `--rec-peles`, `--rec-populacao`, `--rec-ouro`, `--rec-prata`, `--rec-sal`, `--rec-cavalo`, `--rec-ervas`, `--rec-gema`, `--rec-lendario`, `--rec-aco`, `--rec-minerio`. Classe `r-<recurso>`. A cor sempre acompanha o ícone.
- Perigo da fauna: `--perigo-baixo` `#e8b947`, `--perigo-medio` `#ec8a3a`, `--perigo-alto` `#ea4f43`. Classe `nivel-<nivel>` define `--nivel`.
- Torres: `--torre-cor` `#b9b2a6` (corpo e prévias) e `--torre-borda` `#2c2a27` (contorno do ícone).
- Relíquias lendárias, por tipo: `--rel-ataque` `#f47b60`, `--rel-producao` `#e8c04a`, `--rel-resistencia` `#57c2c9`. Classe `tipo-<tipo>` define `--relq`. Contraste AA conferido sobre a superfície tingida do card. Sem tipo (ruína antiga, relíquia ainda não achada) usa `--rec-lendario`.

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
- Conjunto: recursos (madeira, pedra, comida, ferro, couro, peles, população, ouro, prata, aço, sal, cavalo, ervas, gema, minério raro, lendário, ruína); locais (castelo, vila, moradia, mina, serraria, pasto, armazém, ferraria, quartel, muralha, escombros, estaca); fauna (lobo, javali, urso, crocodilo, pata); unidades (tropas, explorador, bota, picareta, batedor, cerco); interface (mapa, vista, hexágonos, relatórios, menu, sino, mais, menos, alvo, camadas, fechar, voltar, avançar, relógio, escudo, alerta, olho, bandeira, estandarte, interrogação, coroa, martelo, cadeado, bússola, info, check, subir, seta, névoa, rota, ponte, temporada, troca, pacto, ferido, espada).
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
| Obra em andamento | Andaime de madeira em volta da construção | Construtor martelando; rótulo "Obra · tempo" |
| Obra na fila | Pilha de toras e pedras ao lado | — |
| Recrutamento ativo | Arqueiros e alvo de palha ao lado do quartel | Arqueiros puxando o arco e flechas voando |
| Explorador a pé / batedor | Andarilho / figura de capuz escuro | Caminhada |
| Escolta | Três lanceiros atrás do explorador | Marcha no passo do mais lento |
| Grupo de caça | Arqueiros de capuz verde e lanceiros | Caminhada até o animal |
| Extração em andamento | Posto de madeira e carrinho ao lado da jazida | Trabalhadores com picareta; rótulo "Extraindo · ritmo" |
| Relíquia guardada | Pedestal de pedra ao lado do local, gema na cor do tipo | Coluna de luz pulsando e cintilar; parada e sem luz em área explorada. Só as suas e as espionadas |
| Escavação | Trabalhadores na ruína antiga | Picaretas; rótulo "Escavando · tempo" |
| Relíquia em marcha | Baú carregado no meio da formação, com gema na cor do tipo | Brilho pulsando; rótulo "Relíquia · tempo" (com "?" se as forças são desconhecidas) |
| Caravana | Carroças puxadas a boi com sacos, faixa na cor do dono (cinza se desconhecido), escolta atrás | Rodas girando; rótulo "Caravana · tempo" ("?" se desconhecida) |
| Torre de arqueiros | Torre de pedra no próprio hexágono, mais alta a cada nível, com 1 a 3 arqueiros no alto na cor do dono; nas suas, anel tracejado discreto do alcance | Em obra: semitransparente |
| Carregadores | Pessoas a pé com sacos e toras, sem uniforme | Rótulo "Material · tempo" |
| Farol de relíquias | Coluna de luz lilás sobre o local, por cima da névoa | Pulsa; rótulo "N relíquias · farol" |
| Avistamento | Figura parada e esmaecida (espião de capuz ou três soldados) onde foi vista | Rótulo "Espião · visto há X h"; some depois de 10 h |
| Batalha | Atacantes (cinza, sem brasão) contra guarnição e milícia | Estocadas, flechas, celeiro em chamas, fumaça, poeira; rótulo "Batalha · tempo" |
| Ataque seu | Formação na sua cor; com estandarte, bandeira na cor do seu brasão | Marcha até o alvo |

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
| Relíquia no local | Disco pequeno na cor do tipo, no canto superior esquerdo do marcador. Só as suas e as espionadas |
| Relíquia em marcha | Mesmo disco no canto inferior esquerdo do marcador da marcha |
| Torre | Círculo claro com o ícone de torre e borda na cor do dono; contorno tracejado do alcance (some de longe); em obra, borda tracejada |
| Concentração de relíquias | Disco do selo com o número de relíquias; farol na névoa: halo lilás tracejado e rótulo "N relíquias" |
| Aliado | Locais e marchas em `--cor-aliado` `#5fb98a`, com nome e brasão |
| Avistamento | Círculo tracejado em `--cor-alerta` com o ícone (batedor ou tropas), relógio e rótulo "há X h" |
| Caravana | Marcador de marcha com ícone de carroça |
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
| Custo | `RP.custoHTML(custo)` → `.custos > .custo` | Ícone + quantidade de cada recurso; o que falta fica em `--cor-perigo` com "!". Sempre junto do tempo (`.tempo`, em `--cor-destaque`). |
| Card de obra | `.obra-card` | Ícone, nome, nível (Nv 2 → 3 / Novo / Tecnologia), onde, efeito em verde, custo e tempo, ação. Bloqueado: cadeado com o requisito. |
| Card de unidade | `.unid-card` | Papel, "Forte contra" (verde) e "Fraco contra" (vermelho), atributos em 5 pontos, custo por unidade com população, quantidade. |
| Quantidade | `.stepper` + `.chips-rapidos` | − e + de 44 px, número grande; atalhos +5, +10 e Máx. (limitado por recursos e população). |
| Escolha | `.escolha[aria-pressed]` | Cartão selecionável (tipo de explorador, alvo de caça); selecionado com contorno de brasa. |
| Opção de caminho | `.rota-opcao` | Curta (barra laranja) x segura (barra verde): hexágonos, trechos em rota pública, perigo e tempo. |
| Minimapa de rota | `.mini-rota` | Terreno conhecido, névoa, perigo, rotas exploradas, castelo de origem, destino e os dois caminhos (o escolhido em destaque). |
| Risco | `.perigo-linha.nivel-*` / `.risco-linha.ok` | Risco da fauna para o grupo escolhido, com a orientação (rota segura, escolta, reforçar o grupo). |
| Força do grupo | `.forca` | Barra do grupo pequeno até "passa ileso", na cor do risco. |
| Rodapé com resumo | `.rodape-acao.rodape-com-resumo` | Resumo do pedido (o quê, custo total, tempo) acima do botão principal, fixo no rodapé. |
| Fila com término | `.fila-termina` | Até 10 itens por fila, um por vez; mostra quando a fila toda termina ("amanhã às 06:40"). |
| Nota de regra | `.nota-regra` | Lembra uma regra que muda a decisão ("Nada é obrigatório", "Bandeiras mostram o autor"). |
| Barras de cenário | `.grafico-barras` | Comparação de rendimento (1 unidade sem preparo x seu grupo x com posto); a escolha atual em destaque, valor na ponta. |
| Força dos lados | `.bat-lados` + `.barra-dupla` | Números grandes nas cores das séries; barra dividida em proporção; "Tendência" com ícone. |
| Gráfico de linha | `.grafico-linha` | Força ao longo da batalha: sólido até agora, tracejado = tendência; marco de chegada de reforços. |
| Seletor de postura | `.abas-postura` (`role=radiogroup`) | Três opções curtas; o nome completo vai no `aria-label`. |
| Lista com "Trocar" | `.trocar-alvo` | Quando o alvo vem do mapa, mostra só ele; "Trocar alvo (N opções)" abre a lista. |
| Objetivos do ataque | `.obj-lista > .obj-item` (`.obj-n`, `.obj-txt`, `.obj-qtd`), `.obj-add`, `.obj-carga` | Número de prioridade em disco laranja; ícone; nome com quantidade; previsão da espionagem em texto pequeno; subir (↑) e remover (×) de 44 px; quantidade com − / + / +5k na linha de baixo. "Adicionar" lista só o que cabe no tipo de ataque. Carga dos objetivos em barra; acima da capacidade, vermelho e aviso. |
| Tática | `.escolha[role=radio][aria-checked]` | Três cartões; o escolhido com contorno de brasa. |
| Quando param | `.quando-voltam` | Condições de parada em frases curtas: cumprir (✓), carga cheia, perdas (escudo). Repetidas na confirmação e na folha da marcha. |
| Objetivos no relatório | `.lista-item` + `.obj-n` + selo | Resultado por objetivo: cumprido (verde), parcial (amarelo), falhou (vermelho), com o obtido; "Por que voltaram" em nota. |
| Relatório | `.rel-item`, `.rel-cab`, `.atacante` | Ícone por tipo, ponto de não lido; detalhe com atacante (brasão "?" ou brasão do estandarte), linhas de informação, ganhos em verde e perdas em vermelho, ações no rodapé. |
| Notificação | `.not-item`, `.push` | Agrupadas em Agora/Hoje/Antes; prévia de como chegam no celular (crítico em vermelho). |
| Preferência | `.alternar` | Liga/desliga por categoria, todas configuráveis. |
| Ranking | `.rank-eu`, `.rank-lista > .rank-linha` | Abas por categoria; sua posição em destaque; 10 primeiros com posição, brasão, nome, valor, barra fina relativa ao 1º e as outras três medidas em texto pequeno. Pódio com a posição em `--cor-destaque`. |
| Bandeira alheia | botão "Derrubar" + "Denunciar" | Derrubar manda uma tropa ao local (mostra "Derrubando · tempo"); denunciar oculta o texto para você e envia para revisão. |
| Relíquia / título / brasão | `.reliquia`, `.lista-item`, `.brasao-item` | Bloqueados esmaecem só a imagem; o texto mantém contraste. (Relíquias da temporada, do legado.) |
| Relíquia lendária | `.relq-card.tipo-<tipo>`, `.relq-ico`, `.relq-efeito`, `.relq-acoes` | Cor do tipo na borda, no halo do ícone e no efeito ("+15% de produção do local"). Roubada: borda tracejada. |
| Selo de relíquia | `.selo-relq.tipo-<tipo>` | Nome e efeito; quebra linha (diferente do `.selo` comum). |
| Tipos de relíquia | `.relq-tipos > .relq-tipo` | Três cartões lado a lado: ataque, produção, resistência. |
| Relíquia no card do local | `.lc-relq` | Linha na cor do tipo abaixo da produção. |
| Marcador no mapa | `.relq-badge.tipo-<tipo>` | Disco no marcador do local ou da marcha. |
| Aviso urgente | `.nota-antiga.nota-perigo` | Mesma forma da nota de informação antiga, em vermelho: relíquia em fuga, prazo para interceptar. |
| Alertas recolhidos | `.faixa-mais` + `.faixas-extra` | No mundo, no máximo duas faixas à vista; as demais ficam atrás de "+N alertas" (`aria-expanded`). |
| Estoque | `RP.estoqueHTML(local)` → `.custos` | Só o que o local tem, em números curtos; nos cards de local (`.lc-estoque`), folhas e escolha de origem. |
| Obra com estoque | `.obra-estoque` (`.falta`) | "Material em X" ou "Faltam … em X" em amarelo; o botão vira "Trazer recursos" e abre a caravana preenchida. |
| Caravana | tela `#/caravana` | Destino e origem com "Trocar"; carga por recurso (−/+, Tudo); carroças e escolta; barra de carga x capacidade; caminho com buscar + levar. |
| Torre | `.torre-card`, `.torre-previa`, `.torre-acao`, `.chip-sel[aria-pressed]` | Prévia do alcance sobre o terreno com os locais protegidos; números (alcance, arqueiros no alto, locais protegidos); subir nível com custo e de onde vem o material. |
| Ordem rápida | `.ordem-barra` + folha de destino | Barra "Toque no destino" com as tropas, botão Tropas e cancelar; esconde as faixas de alerta enquanto ativa. A folha mostra o padrão e tem Atacar (ou Reforçar, Ocupar, Mover), Ajustar e Trocar destino. |
| Sistemas aos poucos | `RP.sistema(k)`, `RP.revelarSistema(k)` | Menus e botões de um sistema só aparecem depois do gatilho; ao aparecer, aviso "Novo: …". |
| Material a caminho | `.obra-estoque.vem` + `.selo-material` | Na obra: de onde vem e quando chega (azul); na fila: "material chega em mm:ss" até chegar. |
| Modelos | `.modelos` + `.chip-sel` | Fileira de modelos e "Repetir último" no topo do envio; um toque preenche tudo. |
| Pendência | `.pend-item.pend-<grupo>` | Ícone, o que é, detalhe com tempo e um botão. Agora (borda vermelha), Oportunidades (ícone lilás), No seu reino. |
| Aliança | `.al-topo`, `.selo-aliado` | Brasão da aliança, membros "3 de 5"; aliado marcado em verde (`--cor-aliado`). |
| Ponto de encontro | `.mini-rota` + `.ext-numeros` | Caminho até o encontro e três números: vocês chegam, eles passam, folga. Sem encontro possível, nota com o motivo e o botão inativo. |
| Requisitos | `.req-lista` | Selos verdes (cumprido, com ✓) e cinza (falta, com cadeado), lado a lado; o botão fica inativo enquanto falta algum. |
| Era | `.era-card` (`.feita`) | Nome, o que libera, custo, requisitos e Pesquisar; feita mostra o dia. |
| Linha da ferraria | `.fam-card` + `.linha-forja` + `.trilha-niveis` | Por família, armas e armaduras com trilha de 3 níveis (feito em destaque, na fila em azul), bônus atual, custo e tempo do próximo e Forjar. |
| Feridos | `.feridos-card` | Grupos com prazo ("morrem em 15 h sem ervas"), quantos as ervas do reino curam e Curar; a cura entra como item de fila. |
| Veterania | `RP.seloVeterania(marcas)` | "Veterana I · +5% · 3 marcas" em destaque; sem veterania, selo neutro. |
| Bônus de combate | `.bonus-linha` | Soma com as partes (armas, veterania, relíquia, lendário, legado) e o lembrete do teto de +50%. |
| Troca | `.troca-linhas` + selo de equilíbrio | "Você recebe" e "Você dá" lado a lado com o valor; selo verde (a seu favor), vermelho (contra você) ou neutro (equilibrada). |
| Valor de referência | `.valor-grade` | Selos com o valor de cada recurso em básicos. |
| Pacto | `.selo-info` / `.selo-visivel` com contagem | "começa em…" enquanto o pagamento viaja; "termina em…" em vigor. No envio, `.faixa-alerta` com o pacto e o botão inativo. |

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
- Filas longas são permitidas (até 10): o jogador planeja horas ou a noite inteira, e a tela mostra quando tudo termina.
- Toda categoria de notificação liga e desliga (ataques vêm ligados por padrão); sem horário de silêncio.
- O escudo de novato de outro reino nunca aparece antes do ataque.
- Item bloqueado nunca reduz o contraste do texto.
- Não marcar reino como IA de nenhuma forma.
- Não esconder ação principal atrás de gesto.
- Toda contagem regressiva diz o que acontece no fim ("chegada", "nível 4").
