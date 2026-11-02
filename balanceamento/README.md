# Balanceamento (aprovado)

Números de tempos, custos, rendimentos e combate para o Reino de Pedra. Saem de **metas de ritmo** (o que o jogador deve sentir) e de um **modelo** que calcula as tabelas e simula uma temporada inteira, conferindo as metas a cada execução.

- Modelo: [`modelo.js`](modelo.js). Rodar: `node balanceamento/modelo.js > balanceamento/tabelas.md`.
- Tabelas completas, geradas pelo modelo: [`tabelas.md`](tabelas.md).
- Estado: **aprovado**, incluindo valiosos, comércio, ferraria, eras, veterania, feridos, equipamento lendário e queda do castelo ([seção própria](#valiosos-comércio-ferraria-e-guerra)). As regras ficam no `CLAUDE.md`; os números ficam aqui e mudam com testes.

---

## Resumo em 1 minuto

| Tema | Valor |
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
| Arqueiro | 35 | 25 | infantaria | média | 40 | 30 comida, 50 madeira, 10 couro | 3 min 30 s |
| Cavalaria | 45 | 30 | arqueiros | rápida | 80 | 60 comida, 50 ferro, 30 couro | 6 min |
| Cavaleiro de elite | 60 | 40 | arqueiros | rápida | 80 | 70 comida, 60 ferro, 40 couro, 1 cavalo de raça | 8 min |
| Aríete | 10 | 10 | 40 de estrutura por combate | lenta | 0 | 300 madeira, 60 ferro (4 pop.) | 15 min |
| Trebuchet | 5 | 5 | 90 de estrutura, à distância | lenta | 0 | 600 madeira, 200 pedra, 150 ferro (6 pop.) | 30 min |

As vantagens valem por **família**: a lança vence a cavalaria (inclusive a de elite), o arqueiro vence a infantaria e a cavalaria vence os arqueiros.

Papéis: o lanceiro é a melhor **defesa por recurso** (44 por 100 de valor); o arqueiro, o melhor **ataque por recurso** (35 por 100); a cavalaria é cara, mas rápida e carrega o dobro: a unidade de **saque**. Os custos por 100 usam o valor de referência (couro vale 2). Veículos: carroça 500 de carga (150 madeira, 20 ferro); carroção 1.500 (400 madeira, 80 ferro, 2 cavalos de raça). Carregador da requisição: 50, a pé. Mensageiro: 30 comida, 1 de população, 1 min, rápido (reino vizinho em ≈ 19 min); mensagem de até 200 caracteres, recado de proposta até 120.

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
- **Legado**: relíquias da temporada de +1% a +2% cada, até 3 equipadas, teto somado de 5%. **Aliança**: até 5 reinos.

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

Limites do modelo: não há guerra (saques, sabotagens e perdas em batalha atrasariam todos), nem caça, relíquias ou o efeito do armazém; a extração de valiosos e a ferraria são calculadas à parte. Os jogadores simulados são simples. Os números servem para dar a ordem de grandeza e mostrar o efeito de cada parâmetro, não para prever o jogo exato.

## O que muda no protótipo

Os valores foram aplicados ao protótipo:
- custos, tempos e carga das unidades;
- produção e níveis dos locais de um reino no dia 34;
- custo e tempo das obras;
- torres (6 arqueiros por nível, custos);
- temporada de 70 dias.

O protótipo continua mostrando ataque e defesa em escala de 1 a 5, só para comparação visual.

---

## Valiosos, comércio, ferraria e guerra

Valiosos e seus usos, comércio, pactos, resgate, limites do novato, eras, ferraria, veterania, feridos, equipamento lendário, alianças, legado e queda do castelo. O modelo confere as metas M10 a M21; **todas no alvo**.

### Resumo

| Tema | Valor |
|---|---|
| Valor de referência | Básicos 1 · couro e peles 2 · sal 6 · ervas 8 · **prata 10** · aço 15 · **ouro 20** · gemas 30 · cavalo de raça 40 · minério raro 60 |
| Jazidas | Cada valiosa guarda **20 mil em valor** (ex.: 1.000 de ouro, 2.000 de prata); 1 de cada valioso para cada 3 reinos (10 no mundo). Minério raro: 5 no mundo, 200 cada |
| Extração | 10 lanceiros tiram **40 de valor/h** (2 de ouro/h); 40 lanceiros com posto, 181/h. Por pessoa, ≈ 2× um trabalhador de local nível 6 |
| Era do Aço | Ferraria 7 · 80 ouro, 1.500 ferro, 1.000 madeira · 6 h. Libera armas e armaduras 2–3, cavaleiro de elite, lendário |
| Era do Cerco Avançado | Era do Aço e quartel 8 · 150 ouro, 4.000 madeira, 3.000 pedra, 1.500 ferro · 12 h. Libera trebuchet e portões 4–5 |
| Armas e armaduras | +8% por nível, 3 níveis, por família (infantaria, arqueiros, cavalaria). Linha completa: ≈ 20 mil de valor e 20 h; tudo: 122 mil (26% das obras do médio) |
| Veterania | Marca por vitória com perdas < 50% contra inimigo com ≥ 30% da força. 2 / 5 / 9 marcas: +5% / +10% / +15% |
| Feridos | 30% das baixas de quem vence ou recua pela tática. 5 ervas curam 1 em 2 h; sem ervas em 24 h, morrem |
| Lendário | 100 minério raro, 1.500 ferro, 100 aço · 24 h. +25% para até 50 tropas (vale ≈ 12 tropas). No máximo 10 no mundo |
| Teto de bônus | A soma de armas, veterania, relíquia, lendário e legado vale até **+50%** (sem teto chegaria a +84% / +89%) |
| Novato | Sob escudo: diferença entre o que dá e recebe de até **2.000 de valor por dia** (24% do que produz no escudo) |
| Pacto | 1 a 7 dias, até 3 ativos; começa quando o pagamento chega |
| Queda do castelo | Sede vai para o local de maior nível com metade do nível do castelo; −50% dos recursos, −30% da população civil. Supondo ainda 40% das tropas mortas no cerco, o médio volta ao nível em **2,7 dias** |

### Por que esses números

- **Valor de referência**: a prata é a moeda (1 prata = 10 básicos), e o resto se mede por ela. Não é preço fixo: os jogadores combinam o que quiserem. Serve para a IA comerciante, para o limite do novato e para comparar custos.
- **Extração mais lenta para o que vale mais**: o ritmo é medido em valor. 10 lanceiros tiram 40 de valor por hora, seja 40 de madeira, 4 de prata ou 2 de ouro. O ouro da Era do Aço sai em ≈ 23 h com 20 lanceiros, ou ≈ 9 h com 40 e posto. Por pessoa, extrair rende ≈ 2× trabalhar num local nível 6, mas a tropa fica longe, exposta, e a jazida acaba. Com o expoente 0,8, juntar tropas demais rende cada vez menos (até 50 por jazida).
- **Escassez de propósito**: o ouro e o aço do mapa cobrem pouco mais que a demanda típica (≈ 100%). Nem todo reino fecha tudo sem disputar jazidas ou trocar: é motivo de PvP, como as relíquias.
- **Ferraria para exércitos grandes**: o nível 1 só rende mais que recrutar com o mesmo valor a partir de ≈ 200 cavaleiros, 340 arqueiros ou 375 lanceiros. Abaixo disso, recrutar compensa. Mas o bônus não ocupa população, que é o limite real: por isso vale para quem já encheu o teto.
- **Teto de +50%**: sem ele, um veterano com tudo teria +84% de ataque, e um novato não teria chance nem com o dobro de tropas. Com o teto, o exército no máximo vence uma defesa até 1,5× maior e perde para 2×. Torres e portões ficam fora do teto.
- **Feridos**: curar custa 40 de valor, 44% de um lanceiro, e devolve a população. Suaviza "tropas mortas não voltam" sem anular: o perdedor que não recua perde tudo, e sem ervas os feridos morrem.
- **Lendário pequeno de propósito**: +25% para até 50 tropas equivale a ≈ 12 tropas. É forte numa tropa de elite e irrelevante numa guerra de 700, para não decidir a temporada. O valor está em ser raro e roubável.
- **Cavaleiro de elite**: mais ataque por pessoa (60 contra 45) e menos por valor (24 contra 26,5 por 100). É para quem tem recurso, mas não tem teto.
- **Novato**: o limite de 2.000 por dia impede que contas secundárias alimentem uma principal, mas deixa um amigo ajudar. O reino sob escudo não pode ser cobrado por pacto.
- **Queda do castelo**: perder metade do nível do castelo custa ≈ 78 mil de obras. O médio refaz em 2,7 dias e recupera a produção em 1,5 dia: perda pesada, que não faz o jogador desistir.

### Metas desta parte

| | Meta | Resultado |
|---|---|---|
| M10 | Bônus somados ficam no teto de +50% | ✓ |
| M11 | Armas ou armaduras nível 1 só compensam a partir de 150 a 600 tropas da família | 199 a 375 |
| M12 | Ferraria completa custa 25% a 50% das obras do médio na temporada | 26% |
| M13 | Extrair valiosos rende por pessoa 1,5 a 3× um trabalhador de local nível 6 | 2,1× |
| M14 | O ouro da Era do Aço sai em 6 a 36 h com 20 lanceiros, sem posto | 23 h |
| M15 | Ouro e aço do mapa cobrem 90% a 150% da demanda típica | 101% / 96% |
| M16 | Era do Aço custa 2 a 4 h de produção do médio no dia 10; Era do Cerco, 4 a 8 h no dia 21 (sem o ouro) | 2,3 h / 4,7 h |
| M17 | Curar um ferido custa 25% a 60% de recrutar um lanceiro | 44% |
| M18 | Equipamento lendário vale no máximo 15 tropas | 12,5 |
| M19 | Cavaleiro de elite: mais ataque por pessoa e menos por valor que a cavalaria | ✓ |
| M20 | Reino sob escudo recebe no máximo 30% do que produz no escudo | 24% |
| M21 | Depois de perder o castelo no dia 35, o médio volta ao nível em 2 a 6 dias | 2,7 dias |

### Combates com bônus

| Situação | Resultado |
|---|---|
| 40 arqueiros contra mina com 15 lanceiros e torre nível 1, sem bônus | atacante vence com 43% de baixas (30% com feridos curados) |
| Os mesmos 40 com armas nível 3 (+24%) | vence com 31% |
| Os mesmos 40 com todos os bônus (+84%, limitado a +50%) | vence com 24% |
| A mesma mina com todos os bônus de defesa (limitado a +50%) | o ataque sem bônus ainda vence, mas com 79% de baixas |

Tabelas completas (valiosos, extração, eras, ferraria, queda do castelo) em [`tabelas.md`](tabelas.md).

Esses valores estão aplicados no protótipo: ferraria e eras, cavaleiro de elite, feridos, veterania, equipamento lendário, extração, comércio, pactos e resgate.

## Fauna, caça, exploradores, rotas e espionagem

| Tema | Valor |
|---|---|
| Fauna | Força 40 / 120 / 300 (baixo, médio, alto). Com o dobro, passa ileso; acima do limite, risco um nível menor |
| Ataque de fauna | Chance por região atravessada: baixo 10%, médio 25%, alto 50%. Atacado, o grupo perde 5% (acima do limite) ou 25% (abaixo); explorador sozinho morre |
| Caça (por bando) | Javalis 120 comida, 40 couro, 5 peles · lobos 50, 30, 40 · ursos 90, 60, 60 · crocodilos 50, 90, 0. 20 min no local; o bando volta em 24 h |
| Exploradores | 1 de população cada. A pé 40 comida, 1 min, visão 2 · a cavalo 80 comida e 20 couro, 3 min, visão 3 · prospector 120 comida e 60 ferro, 6 min, visão 1 (jazidas a 2) · batedor 150 comida e 40 couro, 8 min, visão 3 |
| Rotas | 120 madeira e 80 pedra, 5 min por hexágono, × terreno (floresta 1,8; montanha 2,3; pântano 2,8). Ponte: 600 madeira, 400 pedra, 30 min |
| Espionagem | Chance de ser visto: 15% + 10% por torre no alcance + 0,5% por tropa, até 60%. Visto: metade das vezes capturado (sem relatório) |

Por quê:
- **Fauna com números reais**: os mesmos valores de força das tropas. Um explorador sozinho corre risco em qualquer região; uma escolta de 5 lanceiros já livra o perigo baixo; 20 arqueiros atravessam tudo.
- **Caça paga o couro**: três caçadas por dia rendem ≈ 165 de couro, o que o jogador médio usa para recrutar arqueiros e cavalaria (≈ 160). Couro deixa de ser gargalo para quem caça, e a caça vira rotina com risco.
- **Rotas são investimento de verdade**: 10 hexágonos em planície custam ≈ 1,3 h de produção do médio no dia 14. Em floresta ou montanha, o dobro: rota boa é onde mais se ganha tempo.
- **Espionagem tem risco proporcional**: espionar uma mina com torre e 15 lanceiros tem 1 chance em 3 de ser visto; um castelo médio chega ao máximo de 60%. Nunca é certo nem impossível.

| | Meta | Resultado |
|---|---|---|
| M22 | Explorador sozinho corre risco em qualquer perigo; 20 arqueiros passam ilesos até no alto | ✓ |
| M23 | 3 caçadas por dia cobrem 70% a 150% do couro que o médio usa para recrutar | 103% |
| M24 | 10 hexágonos de rota em planície custam 1 a 3 h de produção do médio no dia 14 | 1,3 h |
| M25 | Espionar um local defendido: 25% a 40% de ser visto; um castelo médio chega ao máximo | 33% / 60% |

## Como mudar um número

1. Edite o parâmetro em `P` (ou a unidade em `U`) no `modelo.js`.
2. Rode `node balanceamento/modelo.js > balanceamento/tabelas.md`.
3. Veja as metas no fim de `tabelas.md`: o que ficou ✗ mostra o efeito colateral da mudança.
