# Balanceamento — v1 (aprovado)

Números de tempos, custos, rendimentos e combate para o Reino de Pedra. Saem de **metas de ritmo** (o que o jogador deve sentir) e de um **modelo** que calcula as tabelas e simula uma temporada inteira, conferindo as metas a cada execução.

- Modelo: [`modelo.js`](modelo.js). Rodar: `node balanceamento/modelo.js > balanceamento/tabelas.md`.
- Tabelas completas, geradas pelo modelo: [`tabelas.md`](tabelas.md).
- Estado: **aprovado**. As 4 regras abaixo, a temporada de 70 dias, as proteções e o tamanho do mapa estão no `CLAUDE.md`; os números ficam aqui e mudam com testes.

---

## Resumo em 1 minuto

| Tema | Proposta |
|---|---|
| Temporada | **70 dias** (10 semanas) |
| Mundo | 30 reinos num mapa de **60 × 48 hexágonos** (≈ 96 por reino) |
| Escudo de novato | **72 h**; escudo de exílio **24 h**; regência após **48 h** sem entrar |
| Produção de um local | 30/h no nível 1 → **318/h no nível 10** (+30% por nível) |
| Obras | Nível 2 em **2 min**; nível 6 em 32 min; nível 10 em **8 h 32 min** (o castelo leva o dobro) |
| Retorno de uma melhoria | Primeira em **≈ 6 h**; a do nível 10 em **≈ 13 dias** (investimento de fim de temporada) |
| Exército | Jogador médio: **≈ 100 tropas** no fim do escudo, **≈ 670** no dia 35. Ativo: ≈ 2,8× isso |
| Unidade básica | Lanceiro: 90 recursos, 3 min, carga 40 |
| Viagem (tropa lenta) | Vizinho do reino **10 min**; reino vizinho **45 min**; travessia do mapa **3 h 14 min** |
| Combate | Para tomar um local, cerca de **1,5× a força da defesa**; um castelo médio exige cerca de **2×** |
| Torre | Nível 1: 6 arqueiros no alto, alcance 2, 600 recursos; com ela, o mesmo ataque que tomaria o local perde |
| Relíquias | Ataque +15%, produção +15%, resistência +20%; escavação de 12 h com 1 unidade, mínimo 4 h |

## 4 regras que o balanceamento precisou (aprovadas)

Sem elas, a simulação não fecha.

1. **Tropas ocupam o teto de população.** Soldados também moram no reino. Sem isso, a população se refaz depois de cada recrutamento e o exército cresce sem limite (a primeira simulação chegou a 10 mil tropas no dia 35). Com isso, cada soldado é um trabalhador a menos: é a escolha entre tropas e economia do `CLAUDE.md`, agora com número.
2. **Cada nível de local precisa de trabalhadores** (10 por nível). Se a população não cobre, o local produz menos. É o que "a população sustenta a produção" quer dizer na prática.
3. **Nenhum local passa do nível do castelo.** O castelo vira o compasso do reino: custa 4× e leva 2× o tempo de um local do mesmo nível. Sem isso, um jogador médio maximiza tudo por volta do dia 20.
4. **Cada local guarda até 10 h da própria produção.** É o que um saque pode levar de um local e o que a requisição busca. Para guardar mais, o armazém. Consequência na simulação: o jogador médio para no castelo nível 9, porque o nível 10 (≈ 92 mil recursos) passa do que ele consegue juntar sem armazém maior.

## Metas de ritmo

Cada meta vem das regras do `CLAUDE.md` ou de prática do gênero. O modelo confere todas; hoje **todas estão no alvo**.

| | Meta | Por quê | Resultado |
|---|---|---|---|
| M1 | O kit inicial recruta 10 lanceiros na primeira sessão | "O reino base já gera recursos para tropas básicas" | ✓ |
| M2 | Primeira melhoria se paga em até 6 h; a do nível 10 em 1 a 2 semanas | Começo rápido; fim de temporada com escolhas de longo prazo | 5,6 h · 13 dias |
| M3 | Obra do nível 2 em até 2 min; do nível 10 em 6 a 10 h; 10 obras de nível médio cobrem a noite | "Básico rápido, forte demorado"; fila de 10 para a noite | 2 min · 8 h 32 min · 12 h 27 min |
| M4 | Vizinho do reino em até 15 min; reino vizinho em 30 a 60 min; travessia em até 3 h 30 min | "Deslocamento não deve demorar excessivamente" | 10 min · 45 min · 3 h 14 min |
| M5 | Médio com 60–150 tropas no dia 3 e 400–900 no dia 35; ativo com 1,5–3× isso | Exército que pesa sem virar só números | 104 · 672 · 2,8× |
| M5 | Recrutar não derruba a economia do médio (eficiência ≥ 90%) | Tropas e economia em equilíbrio | 100% |
| M5 | Sem guerra, o ativo maximiza a economia entre os dias 30 e 50; o médio, depois do dia 40 | Saques e sabotagens atrasam os jogadores de verdade; a temporada não acaba antes da hora | dia 46 · não chega |
| M6 | 30 cavaleiros levam pelo menos 2 h da produção de um local nível 6 | Saque que vale a viagem | 22 h (limitado pelo estoque do local) |
| M7 | Um local defendido cai com cerca de 1,5× a força; uma torre muda o resultado; castelo médio aguenta 150 tropas e cai com cerca de 2× isso | "Destruir um reino deve ser muito difícil e caro" | ✓ |
| M8 | Relíquia de produção vale menos que 1 nível do local | Vantagem real, mas sem decidir a temporada | +17/h contra +33/h |
| M9 | Tática média recua com 40% e ainda causa perdas na defesa | O recuo protege, mas o ataque não é inútil | 8% de perdas na defesa |

## Como os números saem

**Produção** de um local de nível L: `30 × 1,30^(L−1)` por hora. O castelo produz 25/h de cada recurso básico (+12% por nível).

**Custo** para subir ao nível L: `50 × 2,15^(L−2)` recursos, divididos em 45% madeira, 35% pedra, 10% ferro e 10% comida. **Tempo**: `2 min × 2^(L−2)`.
O custo cresce mais rápido que a produção: cada nível rende menos por recurso gasto (o retorno vai de 6 h a 13 dias). Isso dá fôlego à temporada sem travar o começo.

**População**: o castelo dá teto de 300; cada moradia, +60, custando `400 + 120 × (moradias já feitas)`. Cresce `5%/h × população × (1 − população/teto livre)`, +30% com sobra de comida. Recrutar tira da população; as tropas ocupam o teto.

**Deslocamento**: `hexágonos × terreno médio 1,35 × minutos por velocidade` (lenta 2,4; média 1,6; rápida 1,0). Rota pública: ×0,55.

**Combate**:
- Ataque = soma de `ataque × quantidade`. Defesa = soma de `defesa × quantidade` + milícia + arqueiros no alto.
- **Vantagem**: uma unidade ganha ×1,5 na proporção em que o outro lado tem o tipo que ela vence (lança vence cavalaria, cavalaria vence arqueiro, arqueiro vence lanceiro).
- **Milícia**: 5% da população do local, com defesa 15 cada.
- **Arqueiros no alto das torres**: defesa ×3.
- **Multiplicadores da defesa**: relíquia de resistência +20%; portões do castelo ×1,15 por nível.
- **Resultado**: o lado maior vence. O vencedor perde `(menor/maior)^1,5` das tropas; o perdedor perde tudo, ou recua no limite de baixas da tática.

## Unidades

| Unidade | Ataque | Defesa | Vence | Velocidade | Carga | Custo | Tempo |
|---|---|---|---|---|---|---|---|
| Milícia | 5 | 15 | — | lenta | 20 | 20 comida, 10 madeira | 30 s |
| Lanceiro | 25 | 40 | cavalaria | lenta | 40 | 30 comida, 30 madeira, 30 ferro | 3 min |
| Arqueiro | 35 | 25 | lanceiro | média | 40 | 30 comida, 50 madeira, 10 couro | 3 min 30 s |
| Cavalaria | 45 | 30 | arqueiro | rápida | 80 | 60 comida, 50 ferro, 30 couro | 6 min |
| Aríete | 10 | 10 | 40 de estrutura por combate | lenta | 0 | 300 madeira, 60 ferro (4 pop.) | 15 min |
| Trebuchet | 5 | 5 | 90 de estrutura, à distância | lenta | 0 | 600 madeira, 200 pedra, 150 ferro (6 pop.) | 30 min |

Papéis: o lanceiro é a melhor **defesa por recurso** (44 por 100); o arqueiro, o melhor **ataque por recurso** (39 por 100); a cavalaria é cara, mas rápida e carrega o dobro: a unidade de **saque**. Veículos: carroça 500 de carga (150 madeira, 20 ferro); carroção 1.500 (400 madeira, 80 ferro, 2 cavalos de raça). Carregador da requisição: 50, a pé.

## Torres e cerco

| Nível | Alcance | Arqueiros no alto | Defesa somada | Custo | Tempo | Estrutura |
|---|---|---|---|---|---|---|
| 1 | 2 hex. | 6 | 450 | 420 pedra, 180 madeira | 40 min | 300 (8 aríetes) |
| 2 | 3 hex. | 12 | 900 | 760 pedra, 320 madeira | 1 h 20 min | 600 (15 aríetes) |
| 3 | 4 hex. | 18 | 1.350 | 1.360 pedra, 580 madeira | 2 h | 900 (23 aríetes) |

A torre é a defesa mais eficiente por recurso (uma torre nível 2 defende como 22 lanceiros, por 60% do custo e sem gastar população), mas é parada e pode ser derrubada. Portões do castelo: 500 de estrutura por nível; nível 3 exige 38 aríetes ou 17 trebuchets. É o ataque mais caro do jogo, como pede a regra.

## Combates de referência

| Situação | Resultado |
|---|---|
| 20 lanceiros contra mina com 15 lanceiros | defesa vence; atacante perde tudo, defesa perde 54% |
| 30 arqueiros contra a mesma mina | atacante vence com 33% de baixas |
| Os mesmos 30 arqueiros, com torre nível 2 na mina | **defesa vence** (a torre muda o resultado) |
| 30 cavaleiros contra vila com 15 arqueiros | atacante vence com 16% de baixas: saque lucrativo contra alvo fraco |
| 30 cavaleiros contra vila com 10 lanceiros | atacante vence, mas com 48% de baixas: saque que não compensa |
| 150 tropas contra castelo médio | defesa vence |
| 320 tropas contra o mesmo castelo | atacante vence com 48% de baixas |
| Ataque perdido com tática média | recua com 40% de baixas, a defesa perde 8% |

## Saque, relíquias, fauna e proteções

- **Saque**: limitado à carga e ao estoque do local (até 10 h de produção). Saque repetido ao mesmo alvo em 24 h rende −20% a cada vez, até 20%.
- **Relíquias**: produção +15% num local nível 6 dá +17/h, meio nível. Três relíquias juntas (farol) passam de um nível inteiro, e por isso atraem ataque.
- **Fauna** (força = soma de (ataque + defesa)/2): baixo 40, médio 120, alto 300; com o dobro, passa ileso. 20 lanceiros (650) atravessam qualquer região; um explorador sozinho (≈ 38) corre risco em quase todas.
- **Escudo de novato 72 h**: cobre o primeiro fim de semana de quem entra numa sexta. **Regência após 48 h**: dois dias fora já põem o regente para defender. **Escudo de exílio 24 h**: tempo para refazer o mínimo.
- **Legado**: relíquias da temporada com teto somado de 5%. **Aliança**: até 5 reinos.

## Simulação de uma temporada (sem guerra)

Dois jogadores simulados, hora a hora:
- **Médio**: 4 sessões por dia, mantém 35% do teto em tropas.
- **Ativo**: 8 sessões por dia, 55% do teto em tropas.

Os dois enchem a fila até a próxima sessão (ou a noite), escolhem a melhoria de melhor retorno, fundam locais e fazem moradias quando faltam trabalhadores.

| Dia | Médio: produção/h · locais · nível médio · tropas | Ativo: produção/h · locais · nível médio · tropas |
|---|---|---|
| 1 | 328 · 4 · 3 · 46 | 328 · 4 · 3 · 54 |
| 3 | 496 · 4 · 5 · 104 | 400 · 4 · 4 · 173 |
| 7 | 733 · 5 · 6 · 210 | 536 · 6 · 4 · 379 |
| 14 | 1.495 · 7 · 7,9 · 356 | 1.169 · 8 · 6,4 · 751 |
| 35 | 3.184 · 12 · 9 · 672 | 3.918 · 15 · 9 · 1.880 |
| 70 | 3.674 · 14 · 9 · 776 | 6.004 · 18 · 10 · 2.540 |

Limites do modelo: não há guerra (saques, sabotagens e perdas em batalha atrasariam todos), nem caça, extração de valiosos, relíquias ou o efeito do armazém. Os jogadores simulados são simples. Os números servem para dar a ordem de grandeza e mostrar o efeito de cada parâmetro, não para prever o jogo exato.

## O que muda no protótipo

Os valores desta proposta foram aplicados ao protótipo:
- custos, tempos e carga das unidades;
- produção e níveis dos locais de um reino no dia 34;
- custo e tempo das obras;
- torres (6 arqueiros por nível, custos);
- temporada de 70 dias.

O protótipo continua mostrando ataque e defesa em escala de 1 a 5, só para comparação visual.

## Como mudar um número

1. Edite o parâmetro em `P` (ou a unidade em `U`) no `modelo.js`.
2. Rode `node balanceamento/modelo.js > balanceamento/tabelas.md`.
3. Veja as metas no fim de `tabelas.md`: o que ficou ✗ mostra o efeito colateral da mudança.
