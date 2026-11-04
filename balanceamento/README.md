# Balanceamento (aprovado)

Números de tempos, custos, rendimentos e combate para o Reino de Pedra. Saem de **metas de ritmo** (o que o jogador deve sentir) e de um **modelo** que calcula as tabelas e simula uma temporada inteira, conferindo as metas a cada execução.

- Modelo: [`modelo.js`](modelo.js). Rodar: `node balanceamento/modelo.js > balanceamento/tabelas.md`.
- Tabelas completas, geradas pelo modelo: [`tabelas.md`](tabelas.md).
- Estado: **aprovado na escala "pessoas no mapa"** ([`docs/plano-pessoas-no-mapa.md`](../docs/plano-pessoas-no-mapa.md)): cada cidadão e cada soldado é uma pessoa com nome, e os números cabem na tela e na cabeça. As regras ficam no `CLAUDE.md`; os números ficam aqui e mudam com testes.

---

## A escala

Em relação à primeira versão do modelo (castelo com teto 300, exércitos de 600 a 900 tropas):

| | Antes | Agora |
|---|---|---|
| Pessoas (população, tropas, milícia, vagas de trabalho) | centenas a milhares | **÷ 25**: dezenas |
| Recursos (produção, custos de obras, estoques, carga, jazidas) | centenas a dezenas de milhares | **÷ 10** |
| Custo de uma unidade | 20 a 90 por recurso | o mesmo: 1 ou 2 dígitos por recurso (cada pessoa vale mais) |
| Tempo de treino por pessoa | 30 s a 8 min | **× 4** (lanceiro 12 min, arqueiro 14 min, cavalaria 24 min) |
| Tempos de obra e de deslocamento | | iguais ([decisão 0022](../docs/decisoes/0022-velocidade-e-mapa-maior.md)) |
| Trabalhadores por local | 10 por nível | **vagas**: 1 até o nível 4, 2 do 5 ao 8, 3 no 9 e 10 (`max(1, round(nível × 0,3))`) |
| Milícia | 5% da população | **cada civil presente no local** luta (defesa 15); quando a defesa perde, 25% deles morrem e os outros fogem |

## Resumo em 1 minuto

| Tema | Valor |
|---|---|
| Temporada | **70 dias** (10 semanas) |
| Mundo | 30 reinos num mapa de **104 × 80 hexágonos** (≈ 277 por reino) |
| Escudo de novato | **72 h**; escudo de exílio **24 h**; regência após **48 h** sem entrar |
| Reino novo | **Primeiros passos já dados**: castelo e locais no nível 2, 2 moradias, **4 lanceiros e 2 arqueiros** no castelo, **3 exploradores** prontos (a pé, a cavalo, prospector) e o entorno explorado até 6 hexágonos. **8 civis**; o castelo abriga 15, cada moradia mais 3 (a primeira custa 40 recursos, cada uma 24 a mais) |
| Produção de um local | 3/h no nível 1 → **31,8/h no nível 10** (+30% por nível), proporcional às vagas ocupadas |
| Obras | Nível 2 em **2 min**; nível 6 em 32 min; nível 10 em **8 h 32 min** (o castelo leva o dobro) |
| Retorno de uma melhoria | Primeira em **≈ 6 h**; a do nível 10 em **≈ 13 dias** (investimento de fim de temporada) |
| Pessoas e exército | Jogador médio: **21 pessoas e 7 soldados** no fim do escudo, **65 pessoas e 22 soldados** no dia 35. Ativo: 2,4× as tropas; termina a temporada com ≈ 135 pessoas |
| Unidade básica | Lanceiro: 90 recursos, 12 min, carga 5 |
| Começo | Kit com 90 de madeira e **60 de pedra**. Sem coleta, 8 níveis nas 3 primeiras horas (30 min reais a 6×); com coleta, **10 níveis em 2 h** e o castelo 5 em 6 h |
| Vida | Civil 60, lanceiro 110, explorador 80...; volta inteira em **6 h**, sem tique |
| Coleta | 4 por hora por pessoa (`4 × pessoas^0,8`), até 6 por hexágono; o hexágono guarda 60 e volta em 24 h |
| Viagem (tropa lenta) | Vizinho do reino (3 hex.) **2 min**; reino vizinho (24 hex.) **16 min**; travessia do mapa (104 hex.) **1 h 10 min** |
| Combate | Para tomar um local, cerca de **1,5× a força da defesa**; um castelo médio resiste a 20 tropas e cai com cerca de **2×** |
| Torre | Nível 1: 2 arqueiros no alto, alcance 2, 150 recursos; com ela (nível 2), o mesmo ataque que tomaria o local perde |
| Relíquias | Ataque +15%, produção +15%, resistência +20%; escavação de 12 h com 1 unidade, mínimo 4 h |

## 5 regras que o balanceamento precisou (aprovadas)

Sem elas, a simulação não fecha.

1. **Tropas ocupam o teto de população.** Soldados também moram no reino. Sem isso, a população se refaz depois de cada recrutamento e o exército cresce sem limite. Com isso, cada soldado é um trabalhador a menos: é a escolha entre tropas e economia do `CLAUDE.md`, agora com número.
2. **Cada nível de local abre vagas de trabalho** (1 até o nível 4, 2 do 5 ao 8, 3 no 9 e 10). Vaga vazia produz menos. A referência do plano (1 por nível, mínimo 2) deixava o jogador médio sem gente no dia 35 (eficiência de 70%) e o ativo com 180 pessoas: o modelo usa menos vagas por nível (metas M5d e M5g).
3. **Nenhum local passa do nível do castelo.** O castelo vira o compasso do reino: custa 4× e leva 2× o tempo de um local do mesmo nível. Sem isso, um jogador médio maximiza tudo por volta do dia 20.
4. **Cada local guarda até 10 h da própria produção.** É o que um saque pode levar de um local e o que a requisição busca. Para guardar mais, o armazém. O jogador médio para no castelo nível 9, porque o nível 10 (≈ 9 mil recursos) passa do que ele consegue juntar sem armazém maior.
5. **Civis como milícia morrem só em parte.** Toda pessoa presente no local defende, mas um saque vitorioso não esvazia o local: 25% dos civis que lutaram morrem na proporção das perdas e os outros fogem. Quem quer matar gente usa o massacre (cada tropa viva mata até 1 pessoa).

### Primeiros passos já dados

Testado a 6×: no reino de antes (castelo e locais no nível 1, nenhuma tropa, nenhum explorador) a primeira sessão era esperar o treino. O kit acabava em 10 min, um lanceiro custa 30 de ferro e o reino fazia 5,5 de ferro por hora. Agora o reino nasce como se a primeira hora já tivesse passado (`P.inicio`). Os números finais quase não mudam: o médio chega ao dia 35 com 65 pessoas (eram 63) e o ativo termina com 135 (eram 123). Para isso, a meta M5g passou a ir até 140 e a Era do Aço pede 120 de madeira (eram 100), porque o médio produz um pouco mais no dia 10.

## Metas de ritmo

Cada meta vem das regras do `CLAUDE.md`, do plano de pessoas no mapa ou de prática do gênero. O modelo confere todas; hoje **todas estão no alvo**.

| | Meta | Por quê | Resultado |
|---|---|---|---|
| M1 | O kit inicial recruta 2 a 3 lanceiros, prontos em até 45 min; o reino novo já tem tropas que caçam o perigo baixo ilesas e exploradores prontos | "O reino base já gera recursos para tropas básicas"; a primeira sessão tem o que fazer desde o primeiro minuto, sem esperar treino | 3 · 36 min · 190 de força e 3 exploradores |
| M2 | Primeira melhoria se paga em até 6 h; a do nível 10 em 1 a 2 semanas | Começo rápido; fim de temporada com escolhas de longo prazo | 5,6 h · 13 dias |
| M3 | Obra do nível 2 em até 2 min; do nível 10 em 6 a 10 h; 10 obras de nível médio cobrem a noite | "Básico rápido, forte demorado"; fila de 10 para a noite | 2 min · 8 h 32 min · 12 h 27 min |
| M4 | Vizinho do reino (3 hex.) em até 3 min; reino vizinho (24 hex.) em 10 a 20 min; travessia (104 hex.) em até 90 min | "Deslocamento não deve demorar excessivamente" ([decisão 0022](../docs/decisoes/0022-velocidade-e-mapa-maior.md)) | 2 min · 16 min · 1 h 10 min |
| M5 | Médio com 4 a 10 soldados e 15 a 25 pessoas no dia 3; 20 a 30 soldados e 50 a 80 pessoas no dia 35; ativo com 1,5 a 2,5× as tropas e 90 a 140 pessoas no fim | As metas de escala do plano: dezenas de pessoas, não centenas | 7 · 21 / 22 · 65 / 2,4× · 135 |
| M5 | Recrutar não derruba a economia do médio (eficiência ≥ 90%) | Tropas e economia em equilíbrio | 100% |
| M5 | Sem guerra, o ativo maximiza a economia entre os dias 30 e 50; o médio, depois do dia 40 | Saques e sabotagens atrasam os jogadores de verdade; a temporada não acaba antes da hora | dia 43 · não chega |
| M6 | 6 cavaleiros levam pelo menos 2 h da produção de um local nível 6 | Saque que vale a viagem | 5,4 h |
| M7 | Um local defendido cai com cerca de 1,5× a força; uma torre muda o resultado; castelo médio aguenta 20 tropas e cai com cerca de 2× isso | "Destruir um reino deve ser muito difícil e caro" | ✓ |
| M8 | Relíquia de produção vale menos que 1 nível do local | Vantagem real, mas sem decidir a temporada | +1,7/h contra +3,3/h |
| M9 | Tática média recua com 40% e ainda causa perdas na defesa | O recuo protege, mas o ataque não é inútil | 9% de perdas na defesa |

## Como os números saem

**Produção** de um local de nível L: `3 × 1,30^(L−1)` por hora, vezes a fração das vagas ocupadas. O castelo produz 2,5/h de cada recurso básico (+12% por nível), sem vagas.

**Custo** para subir ao nível L: `5 × 2,15^(L−2)` recursos, divididos em 45% madeira, 35% pedra, 10% ferro e 10% comida. **Tempo**: `2 min × 2^(L−2)`.
O custo cresce mais rápido que a produção: cada nível rende menos por recurso gasto (o retorno vai de 6 h a 13 dias). Isso dá fôlego à temporada sem travar o começo.

**População**: o castelo dá teto de 15; cada moradia, +3, custando `40 + 24 × (moradias já feitas)`. Cresce `5%/h × população × (1 − população/teto livre)`, +30% com sobra de comida; abaixo de 3 pessoas, cresce em linha. Recrutar tira da população (converte uma pessoa); as tropas ocupam o teto.

**Deslocamento**: `hexágonos × terreno médio 1,35 × minutos por velocidade` (lenta 0,5; média 0,33; rápida 0,2). Rota pública: ×0,55. Carregadores da requisição são pessoas do local de origem, andam na velocidade lenta com 30 de carga por pessoa (carrinho de mão) e fazem mais viagens quando falta gente. **Visão em marcha**: um exército revela a névoa com a maior visão do grupo (milícia, lanceiro e cerco 1; arqueiro, cavalaria e elite 2).

**Combate**:
- Ataque = soma de `ataque × quantidade`. Defesa = soma de `defesa × quantidade` + milícia + arqueiros no alto.
- **Vantagem**: uma unidade ganha ×1,5 na proporção em que o outro lado tem o tipo que ela vence (lança vence cavalaria, cavalaria vence arqueiro, arqueiro vence lanceiro).
- **Milícia**: cada civil presente no local, com defesa 15 cada. Na derrota, 25% deles morrem na proporção das perdas.
- **Arqueiros no alto das torres**: defesa ×3.
- **Multiplicadores da defesa**: relíquia de resistência +20%; portões do castelo ×1,15 por nível.
- **Resultado**: o lado maior vence. O vencedor perde `(menor/maior)^1,5` das tropas; o perdedor perde tudo, ou recua no limite de baixas da tática.
- **Duração da batalha**: 5 min + 15 s por tropa envolvida, até 20 min (6 contra 4 ≈ 7,5 min; um cerco de 50 tropas ≈ 17 min).

## Unidades

| Unidade | Ataque | Defesa | Vence | Velocidade | Carga | Visão | Custo | Tempo |
|---|---|---|---|---|---|---|---|---|
| Milícia | 5 | 15 | — | lenta | 3 | 1 | 20 comida, 10 madeira | 2 min |
| Lanceiro | 25 | 40 | cavalaria | lenta | 5 | 1 | 30 comida, 30 madeira, 30 ferro | 12 min |
| Arqueiro | 35 | 25 | infantaria | média | 5 | 2 | 30 comida, 50 madeira, 10 couro | 14 min |
| Cavalaria | 45 | 30 | arqueiros | rápida | 10 | 2 | 60 comida, 50 ferro, 30 couro | 24 min |
| Cavaleiro de elite | 60 | 40 | arqueiros | rápida | 10 | 2 | 70 comida, 60 ferro, 40 couro, 1 cavalo de raça | 32 min |
| Aríete | 10 | 10 | 40 de estrutura por combate | lenta | 0 | 1 | 60 madeira, 15 ferro (2 pessoas) | 1 h |
| Trebuchet | 5 | 5 | 90 de estrutura, à distância | lenta | 0 | 1 | 90 madeira, 40 pedra, 30 ferro (3 pessoas) | 2 h |

Cada unidade é uma pessoa do reino, com nome; as máquinas de cerco são a equipe que as opera. As vantagens valem por **família**: a lança vence a cavalaria (inclusive a de elite), o arqueiro vence a infantaria e a cavalaria vence os arqueiros.

Papéis: o lanceiro é a melhor **defesa por recurso** (44 por 100 de valor); o arqueiro, o melhor **ataque por recurso** (35 por 100); a cavalaria é cara, mas rápida e carrega o dobro: a unidade de **saque**. Veículos: carroça 60 de carga (15 madeira, 2 ferro); carroção 180 (40 madeira, 8 ferro, 2 cavalos de raça). Mensageiro: 30 comida, 1 pessoa, 4 min, rápido (reino vizinho em ≈ 6 min); mensagem de até 200 caracteres, recado de proposta até 120.

## Torres e cerco

| Nível | Alcance | Arqueiros no alto | Defesa somada | Custo | Tempo | Estrutura |
|---|---|---|---|---|---|---|
| 1 | 2 hex. | 2 | 150 | 105 pedra, 45 madeira | 40 min | 80 (2 aríetes) |
| 2 | 3 hex. | 4 | 300 | 189 pedra, 81 madeira | 1 h 20 min | 160 (4 aríetes) |
| 3 | 4 hex. | 6 | 450 | 340 pedra, 146 madeira | 2 h | 240 (6 aríetes) |

A torre é a defesa mais eficiente por recurso (uma torre nível 1 defende como 4 lanceiros, por 40% do custo e sem gastar gente), mas é parada e pode ser derrubada. Portões do castelo: 100 de estrutura por nível; nível 3 exige 8 aríetes (16 pessoas) ou 4 trebuchets. É o ataque mais caro do jogo, como pede a regra.

## Combates de referência

| Situação | Resultado |
|---|---|
| 6 lanceiros contra mina com 4 lanceiros e 3 civis | defesa vence; atacante perde tudo, defesa perde 63% |
| 8 arqueiros contra a mesma mina | atacante vence com 34% de baixas |
| Os mesmos 8 arqueiros, com torre nível 2 na mina | **defesa vence** (a torre muda o resultado) |
| 6 cavaleiros contra vila com 3 arqueiros e 4 civis | atacante vence com 19% de baixas: saque lucrativo contra alvo fraco |
| 6 cavaleiros contra vila com 2 lanceiros e 4 civis | atacante vence, mas com 54% de baixas: saque que não compensa |
| 20 tropas contra castelo médio (12 tropas, 2 torres, portões 3, 10 civis) | defesa vence |
| 40 tropas contra o mesmo castelo | atacante vence com 78% de baixas |
| Ataque perdido com tática média | recua com 40% de baixas, a defesa perde 9% |

## Saque, relíquias, fauna e proteções

- **Saque**: limitado à carga e ao estoque do local (até 10 h de produção). Saque repetido ao mesmo alvo em 24 h rende −20% a cada vez, até 20%.
- **Relíquias**: produção +15% num local nível 6 dá +1,7/h, meio nível. Três relíquias juntas (farol) passam de um nível inteiro, e por isso atraem ataque.
- **Fauna** (força = soma de (ataque + defesa)/2): baixo 50, médio 110, alto 180, em bandos de 1 a 6 animais; com o dobro, passa ileso. 2 lanceiros (65) passam o perigo baixo; 12 arqueiros (360) atravessam qualquer região; um explorador sozinho (10 a 20) corre risco em todas.
- **Escudo de novato 72 h**: cobre o primeiro fim de semana de quem entra numa sexta. **Regência após 48 h**: dois dias fora já põem o regente para defender. **Escudo de exílio 24 h**: tempo para refazer o mínimo (castelo nível 1, 6 pessoas, 2 milicianos e um kit).
- **Legado**: relíquias da temporada de +1% a +2% cada, até 3 equipadas, teto somado de 5%. **Aliança**: até 5 reinos.

## Simulação de uma temporada (sem guerra)

Dois jogadores simulados, hora a hora:
- **Médio**: 4 sessões por dia, mantém 35% do teto em tropas.
- **Ativo**: 8 sessões por dia, 50% do teto em tropas.

Os dois enchem a fila até a próxima sessão (ou a noite), escolhem a melhoria de melhor retorno, fundam locais e fazem moradias quando faltam trabalhadores.

| Dia | Médio: produção/h · locais · nível médio · pessoas (civis + tropas + exploradores) | Ativo: produção/h · locais · nível médio · pessoas (civis + tropas + exploradores) |
|---|---|---|
| 1 | 40 · 4 · 4 · 20 (10 + 7 + 3) | 40 · 4 · 4 · 20 (7 + 10 + 3) |
| 3 | 62 · 4 · 6 · 21 (11 + 7 + 3) | 54 · 4 · 5,3 · 25 (9 + 13 + 3) |
| 7 | 92 · 5 · 7 · 21 (11 + 7 + 3) | 100 · 6 · 6,7 · 33 (14 + 16 + 3) |
| 14 | 150 · 7 · 7,9 · 28 (16 + 10 + 3) | 173 · 8 · 8 · 45 (20 + 22 + 3) |
| 35 | 318 · 12 · 9 · 65 (39 + 22 + 3) | 392 · 15 · 9 · 105 (49 + 52 + 3) |
| 70 | 367 · 14 · 9 · 81 (50 + 27 + 3) | 600 · 18 · 10 · 135 (64 + 67 + 3) |

Limites do modelo: não há guerra (saques, sabotagens e perdas em batalha atrasariam todos), nem caça, relíquias ou o efeito do armazém; a extração de valiosos e a ferraria são calculadas à parte. Os jogadores simulados são simples. Os números servem para dar a ordem de grandeza e mostrar o efeito de cada parâmetro, não para prever o jogo exato.

---

## Valiosos, comércio, ferraria e guerra

Valiosos e seus usos, comércio, pactos, resgate, limites do novato, eras, ferraria, veterania, feridos, equipamento lendário, alianças, legado e queda do castelo. O modelo confere as metas M10 a M21; **todas no alvo**.

### Resumo

| Tema | Valor |
|---|---|
| Valor de referência | Básicos 1 · couro e peles 2 · sal 6 · ervas 8 · **prata 10** · aço 15 · **ouro 20** · gemas 30 · cavalo de raça 40 · minério raro 60 |
| Jazidas | Cada valiosa guarda **2 mil em valor** (ex.: 100 de ouro, 200 de prata); 1 de cada valioso para cada 3 reinos (10 no mundo). Minério raro: 5 no mundo, 20 cada |
| Extração | 4 lanceiros tiram **38 de valor/h** (1,9 de ouro/h); 6 lanceiros com posto, 79/h. Por pessoa, ≈ 1,7× um trabalhador de local nível 6. Até **6 tropas por jazida** |
| Era do Aço | Ferraria 7 · 8 ouro, 150 ferro, 120 madeira · 6 h. Libera armas e armaduras 2–3, cavaleiro de elite, lendário |
| Era do Cerco Avançado | Era do Aço e quartel 8 · 15 ouro, 400 madeira, 300 pedra, 150 ferro · 12 h. Libera trebuchet e portões 4–5 |
| Armas e armaduras | +8% por nível, 3 níveis, por família (infantaria, arqueiros, cavalaria). Linha completa: ≈ 2,2 mil de valor e 20 h; tudo: 13 mil (29% das obras do médio) |
| Veterania | Por pessoa: marca por vitória com perdas < 50% contra inimigo com ≥ 30% da força. 2 / 5 / 9 marcas: +5% / +10% / +15%; o bônus do grupo é a média |
| Feridos | 30% das baixas de quem vence ou recua pela tática. 5 ervas curam 1 em 2 h; sem ervas em 24 h, morrem |
| Lendário | 10 minério raro, 150 ferro, 10 aço · 24 h. +25% para até **8 tropas** (vale ≈ 2 tropas). No máximo 10 no mundo |
| Teto de bônus | A soma de armas, veterania, relíquia, lendário e legado vale até **+50%** (sem teto chegaria a +84% / +89%) |
| Novato | Sob escudo: diferença entre o que dá e recebe de até **200 de valor por dia** (22% do que produz no escudo) |
| Pacto | 1 a 7 dias, até 3 ativos; começa quando o pagamento chega |
| Queda do castelo | Sede vai para o local de maior nível com metade do nível do castelo; −50% dos recursos, −30% da população civil. Supondo ainda 40% das tropas mortas no cerco, o médio volta ao nível em **2,2 dias** |

### Por que esses números

- **Valor de referência**: a prata é a moeda (1 prata = 10 básicos), e o resto se mede por ela. Não é preço fixo: os jogadores combinam o que quiserem. Serve para a IA comerciante, para o limite do novato e para comparar custos.
- **Extração mais lenta para o que vale mais**: o ritmo é medido em valor. 4 lanceiros tiram 38 de valor por hora, seja 38 de madeira, 4 de prata ou 2 de ouro. O ouro da Era do Aço sai em ≈ 4 h com 4 lanceiros. Por pessoa, extrair rende ≈ 1,7× trabalhar num local nível 6, mas a tropa fica longe, exposta, e a jazida acaba. Com o expoente 0,8, juntar tropas demais rende cada vez menos (até 6 por jazida).
- **Escassez de propósito**: o ouro e o aço do mapa cobrem pouco mais que a demanda típica (≈ 100%). Nem todo reino fecha tudo sem disputar jazidas ou trocar: é motivo de PvP, como as relíquias.
- **Ferraria para quem já tem exército**: o nível 1 só rende mais que recrutar com o mesmo valor a partir de ≈ 13 cavaleiros, 23 arqueiros ou 25 lanceiros. Abaixo disso, recrutar compensa. Mas o bônus não ocupa população, que é o limite real: por isso vale para quem já encheu o teto.
- **Teto de +50%**: sem ele, um veterano com tudo teria +84% de ataque, e um novato não teria chance nem com o dobro de tropas. Com o teto, o exército no máximo vence uma defesa até 1,5× maior e perde para 2×. Torres e portões ficam fora do teto.
- **Feridos**: curar custa 40 de valor, 44% de um lanceiro, e devolve a pessoa. Suaviza "tropas mortas não voltam" sem anular: o perdedor que não recua perde tudo, e sem ervas os feridos morrem.
- **Lendário pequeno de propósito**: +25% para até 8 tropas equivale a ≈ 2 tropas. É forte numa tropa de elite e irrelevante num cerco de 40, para não decidir a temporada. O valor está em ser raro e roubável.
- **Cavaleiro de elite**: mais ataque por pessoa (60 contra 45) e menos por valor (24 contra 26,5 por 100). É para quem tem recurso, mas não tem teto.
- **Novato**: o limite de 200 por dia impede que contas secundárias alimentem uma principal, mas deixa um amigo ajudar. O reino sob escudo não pode ser cobrado por pacto.
- **Queda do castelo**: perder metade do nível do castelo custa ≈ 7,8 mil de obras. O médio refaz em 2,2 dias e recupera a produção em 1,4 dia: perda pesada, que não faz o jogador desistir.

### Metas desta parte

| | Meta | Resultado |
|---|---|---|
| M10 | Bônus somados ficam no teto de +50% | ✓ |
| M11 | Armas ou armaduras nível 1 só compensam a partir de 10 a 30 tropas da família | 13 a 25 |
| M12 | Ferraria completa custa 25% a 50% das obras do médio na temporada | 29% |
| M13 | Extrair valiosos rende por pessoa 1,5 a 3× um trabalhador de local nível 6 | 1,7× |
| M14 | O ouro da Era do Aço sai em 3 a 12 h com 4 lanceiros, sem posto | 4 h 13 min |
| M15 | Ouro e aço do mapa cobrem 90% a 150% da demanda típica | 101% / 96% |
| M16 | Era do Aço custa 2 a 4 h de produção do médio no dia 10; Era do Cerco, 4 a 8 h no dia 21 (sem o ouro) | 2,1 h / 4,7 h |
| M17 | Curar um ferido custa 25% a 60% de recrutar um lanceiro | 44% |
| M18 | Equipamento lendário vale no máximo 3 tropas | 2 |
| M19 | Cavaleiro de elite: mais ataque por pessoa e menos por valor que a cavalaria | ✓ |
| M20 | Reino sob escudo recebe no máximo 30% do que produz no escudo | 22% |
| M21 | Depois de perder o castelo no dia 35, o médio volta ao nível em 2 a 6 dias | 2,2 dias |

### Combates com bônus

| Situação | Resultado |
|---|---|
| 8 arqueiros contra mina com 4 lanceiros, torre nível 1 e 3 civis, sem bônus | atacante vence com 78% de baixas (54% com feridos curados) |
| Os mesmos 8 com armas nível 3 (+24%) | vence com 56% |
| Os mesmos 8 com todos os bônus (+84%, limitado a +50%) | vence com 42% |
| A mesma mina com todos os bônus de defesa (limitado a +50%) | defesa vence; o ataque sem bônus perde tudo e tira 70% da defesa |

Tabelas completas (valiosos, extração, eras, ferraria, queda do castelo) em [`tabelas.md`](tabelas.md).

## Fauna, caça, exploradores, rotas e espionagem

| Tema | Valor |
|---|---|
| Fauna | Força 50 / 110 / 180 (baixo, médio, alto), bandos de 1 a 6 animais. Com o dobro, passa ileso; acima do limite, risco um nível menor |
| Ataque de fauna | Chance por região atravessada: baixo 10%, médio 25%, alto 50%. Atacado, cada animal fere uma pessoa: 10 a 30 de vida (baixo), 20 a 60 (médio), 35 a 105 (alto), pelo risco efetivo; morre quem chega a zero. Explorador a cavalo foge em 60%. A carga perde 5% (acima do limite) ou 25% (abaixo) |
| Caça (por bando) | Javalis 12 comida, 4 couro, 1 pele · lobos 5, 3, 4 · ursos 9, 6, 6 · crocodilos 5, 9, 0. 20 min no local; o bando volta em 24 h |
| Exploradores | 1 pessoa cada. A pé 40 comida, 4 min, visão 2 · a cavalo 60 comida e 15 couro, 12 min, visão 3 · prospector 80 comida e 40 ferro, 24 min, visão 1 (jazidas a 2) · batedor 90 comida e 30 couro, 32 min, visão 3 |
| Rotas | 12 madeira e 8 pedra, 5 min por hexágono, × terreno (floresta 1,8; montanha 2,3; pântano 2,8). Ponte: 60 madeira, 40 pedra, 30 min |
| Espionagem | Chance de ser visto: 15% + 10% por torre no alcance + 2,5% por tropa, até 60%. Visto: metade das vezes capturado (sem relatório) |

Por quê:
- **Fauna com números reais**: os mesmos valores de força das tropas. Um explorador sozinho corre risco em qualquer região; 2 lanceiros de escolta já livram o perigo baixo; 12 arqueiros atravessam tudo.
- **Uma caçada paga o couro**: uma caçada por dia rende ≈ 5,5 de couro, o que o jogador médio usa para recrutar arqueiros e cavalaria (≈ 5). Couro deixa de ser gargalo para quem caça, e a caça vira rotina com risco.
- **Rotas são investimento de verdade**: 10 hexágonos em planície custam ≈ 1,3 h de produção do médio no dia 14. Em floresta ou montanha, o dobro: rota boa é onde mais se ganha tempo.
- **Espionagem tem risco proporcional**: espionar uma mina com torre e 4 lanceiros tem 1 chance em 3 de ser visto; um castelo médio (12 tropas, 2 torres) chega ao máximo de 60%. Nunca é certo nem impossível.

| | Meta | Resultado |
|---|---|---|
| M22 | Explorador sozinho é atacado em qualquer perigo, mas um ataque só mata no alto (20% a 50% a pé, até 25% a cavalo); 2 lanceiros passam ilesos pelo baixo; 12 arqueiros, até pelo alto | 36% / 14% |
| M23 | 1 caçada por dia cobre 70% a 150% do couro que o médio usa para recrutar | 105% |
| M24 | 10 hexágonos de rota em planície custam 1 a 3 h de produção do médio no dia 14 | 1,3 h |
| M25 | Espionar um local defendido: 25% a 40% de ser visto; um castelo médio chega ao máximo | 35% / 60% |

## Vida, coleta e começo

Testado a 6×: o explorador morria no primeiro animal, e o reino novo subia uns 5 níveis e travava no castelo 4 por falta de pedra, com 4 civis sem vaga parados no castelo ([decisão 0028](../docs/decisoes/0028-vida-e-coleta.md)).

| Tema | Valor |
|---|---|
| Vida | Por ofício: civil 60, milícia 70, lanceiro 110, arqueiro 90, cavalaria 110, elite 130, explorador 80, prospector 70, batedor 90. Volta inteira em 6 h, em linha |
| Fauna | Cada animal fere uma pessoa diferente: golpe de 20 (baixo), 40 (médio) ou 70 (alto) ± 50%, pelo risco efetivo do grupo. Explorador a pé morre num ataque só no alto (36%); a cavalo foge em 60% (14%). Um golpe do alto nunca tira a vida inteira de um lanceiro |
| Batalha | Quem sobrevive perde 80% × a fração de perdas do lado, sem morrer por isso |
| Coleta | `4 × pessoas^0,8` por hora (1 pessoa 4, 4 pessoas 12, 6 pessoas 17), até 6 por hexágono. Civil leva 10. Hexágono de 60, volta inteiro em 24 h: 4 coletores o esgotam em ≈ 6 h |
| Começo | Kit de pedra 60 (era 40). Sem coleta: 6 níveis na 1ª hora, 8 em 3 h, trava no castelo 4. Com coleta (4 civis sem vaga na madeira, a guarnição inicial na pedra): 8 na 1ª hora, 10 em 2 h, castelo 5 em 6 h |

Por quê:
- **Vida em vez de morte certa**: o jogador vê o dano, tem chance de sobreviver e o tempo cura. A força do grupo continua decidindo o risco, e o dobro continua passando ileso: as metas de fauna (M22) mudam só no que acontece num ataque.
- **Coleta rende como um trabalhador do começo** (M28: 1× um trabalhador de local nível 2): vale para quem está sem vaga e para tropas paradas, sem substituir os locais, que passam a render mais por pessoa a partir do nível 3. A viagem, a fauna, o hexágono que acaba e o rendimento decrescente impedem que vire recurso de graça.
- **Mais níveis de construção, não**: os primeiros níveis já levam 2 a 16 min e custam pouco; faltava madeira e pedra. Mais níveis mudariam a temporada inteira (M2, M3, M5).

| | Meta | Resultado |
|---|---|---|
| M26 | Sem coleta, o reino novo sobe pelo menos 6 níveis nas 3 primeiras horas (30 min reais a 6×) | 8 |
| M27 | Com coleta, pelo menos 8 níveis nas 2 primeiras horas e o castelo 5 em até 8 h | 10 · 6 h 6 min |
| M28 | Coleta rende por pessoa 0,8 a 1,5× um trabalhador de local nível 2 | 1× |
| M29 | Um hexágono com 4 coletores se esgota em 3 a 8 h e se recupera em 12 a 36 h | 6 h 14 min · 24 h |
| M30 | A vida volta em 4 a 8 h; um ataque do perigo alto não mata ninguém de um grupo de lanceiros | 6 h · 105 < 110 |

## Como mudar um número

1. Edite o parâmetro em `P` (ou a unidade em `U`) no `modelo.js`.
2. Rode `node balanceamento/modelo.js > balanceamento/tabelas.md` e `node balanceamento/modelo.js --json > balanceamento/config.json`.
3. Veja as metas no fim de `tabelas.md`: o que ficou ✗ mostra o efeito colateral da mudança.
