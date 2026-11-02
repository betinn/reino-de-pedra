# Tabelas do balanceamento (geradas)

Geradas por `node balanceamento/modelo.js`. Não edite à mão: mude os parâmetros no modelo e rode de novo.

## Locais de produção por nível

| Nível | Produção/h | Trabalhadores | Custo para subir | Receita | Tempo de obra | Retorno do custo |
|---|---|---|---|---|---|---|
| 1 | 30 | 10 | — | — | — | — |
| 2 | 39 | 20 | 50 | 20 madeira, 20 pedra, 10 ferro, 10 comida | 2 min | 5.6 h |
| 3 | 51 | 30 | 108 | 50 madeira, 40 pedra, 10 ferro, 10 comida | 4 min | 9.2 h |
| 4 | 66 | 40 | 231 | 100 madeira, 80 pedra, 20 ferro, 20 comida | 8 min | 15.2 h |
| 5 | 86 | 50 | 497 | 220 madeira, 170 pedra, 50 ferro, 50 comida | 16 min | 25.1 h |
| 6 | 111 | 60 | 1068 | 480 madeira, 370 pedra, 110 ferro, 110 comida | 32 min | 41.6 h |
| 7 | 145 | 70 | 2297 | 1030 madeira, 800 pedra, 230 ferro, 230 comida | 1 h 4 min | 68.7 h |
| 8 | 188 | 80 | 4939 | 2220 madeira, 1730 pedra, 490 ferro, 490 comida | 2 h 8 min | 113.7 h |
| 9 | 245 | 90 | 10618 | 4780 madeira, 3720 pedra, 1060 ferro, 1060 comida | 4 h 16 min | 188 h |
| 10 | 318 | 100 | 22829 | 10270 madeira, 7990 pedra, 2280 ferro, 2280 comida | 8 h 32 min | 310.9 h |

Estoque de cada local: até 10 h da própria produção; o excedente vai para o armazém, que também guarda os valiosos.

Castelo: produz 25/h de cada recurso básico no nível 1 e 69/h no nível 10. Nenhum local passa do nível do castelo. Melhorar o castelo custa 4× e leva 2× o tempo de um local do mesmo nível (nível 10: 17 h 4 min).

## Unidades

Valor: custo em valor de referência (couro vale 2, cavalo de raça 40). Por 100: ataque e defesa por 100 de valor.

| Unidade | Família | Ataque | Defesa | Vence | Velocidade | Carga | Custo | Valor | Tempo | Pop. | Ataque/100 | Defesa/100 | Requisito |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Milícia | Infantaria | 5 | 15 | — | Lenta | 20 | 20 comida, 10 madeira | 30 | 1 min | 1 | 16.7 | 50 | — |
| Lanceiro | Infantaria | 25 | 40 | Cavalaria | Lenta | 40 | 30 comida, 30 madeira, 30 ferro | 90 | 3 min | 1 | 27.8 | 44.4 | — |
| Arqueiro | Arqueiros | 35 | 25 | Infantaria | Média | 40 | 30 comida, 50 madeira, 10 couro | 100 | 4 min | 1 | 35 | 25 | — |
| Cavalaria | Cavalaria | 45 | 30 | Arqueiros | Rápida | 80 | 60 comida, 50 ferro, 30 couro | 170 | 6 min | 1 | 26.5 | 17.6 | — |
| Cavaleiro de elite | Cavalaria | 60 | 40 | Arqueiros | Rápida | 80 | 70 comida, 60 ferro, 40 couro, 1 cavalo de raça | 250 | 8 min | 1 | 24 | 16 | Era do Aço |
| Aríete | Cerco | 10 | 10 | torres e portões (40) | Lenta | 0 | 300 madeira, 60 ferro | 360 | 15 min | 4 | 2.8 | 2.8 | — |
| Trebuchet | Cerco | 5 | 5 | torres e portões (90) | Lenta | 0 | 600 madeira, 200 pedra, 150 ferro | 950 | 30 min | 6 | 0.5 | 0.5 | Era do Cerco Avançado |

Veículos: carroça 500 (lenta, 150 madeira, 20 ferro); carroção 1500 (média, 400 madeira, 80 ferro, 2 cavalos de raça). Carregador da requisição: 50, a pé.

## Deslocamento

| Distância | Exemplo | Lenta | Média | Rápida | Lenta em rota |
|---|---|---|---|---|---|
| 3 hex. | local vizinho do próprio reino | 10 min | 6 min | 4 min | 5 min |
| 6 hex. | outro lado do próprio reino | 19 min | 13 min | 8 min | 11 min |
| 14 hex. | reino vizinho | 45 min | 30 min | 19 min | 25 min |
| 30 hex. | meio mapa | 1 h 37 min | 1 h 5 min | 41 min | 53 min |
| 60 hex. | travessia do mapa | 3 h 14 min | 2 h 10 min | 1 h 21 min | 1 h 47 min |

Mapa para 30 reinos: 60 × 48 hexágonos (≈ 96 por reino). Terreno médio 1.35; rota pública multiplica por 0.55.

## Combates de referência

Valor de ataque contra valor de defesa; o vencedor perde (menor/maior)^1.5 das tropas. Milícia: 5% da população do local, defesa 15. Arqueiros no alto de torres: defesa ×3.

| Situação | Ataque | Defesa | Razão | Resultado | Perdas do atacante | Perdas da defesa |
|---|---|---|---|---|---|---|
| 20 lanceiros contra mina com 15 lanceiros e 200 de população | 500 | 750 | 0.7 | defesa vence | 100% | 54% |
| 30 arqueiros contra a mesma mina | 1575 | 750 | 2.1 | atacante vence | 33% | 100% |
| 30 arqueiros contra a mina com torre nível 2 (12 arqueiros no alto) | 1575 | 1650 | 1 | defesa vence | 100% | 93% |
| 30 cavaleiros (saque) contra vila com 10 lanceiros | 1350 | 825 | 1.6 | atacante vence | 48% | 100% |
| 30 cavaleiros contra vila com 15 arqueiros | 2025 | 600 | 3.4 | atacante vence | 16% | 100% |
| Mina Rubra (15 lanceiros, torre 1, relíquia de resistência) contra 40 arqueiros | 2100 | 1395 | 1.5 | atacante vence | 54% | 100% |
| Cerco: 150 tropas mistas contra castelo médio (60 tropas, 4 torres nível 1, portões 3, 1.500 de população) | 5844 | 7562 | 0.8 | defesa vence | 100% | 68% |
| Mesmo cerco com 320 tropas | 12390 | 7552 | 1.6 | atacante vence | 48% | 100% |
| Ataque perdido com tática média (recua com 40%) | 250 | 750 | 0.3 | recuou | 40% | 8% |
| 40 arqueiros contra mina com 15 lanceiros, torre 1 e 200 de população, sem bônus | 2100 | 1200 | 1.8 | atacante vence | 43% | 100% |
| Os mesmos 40 arqueiros com armas nível 3 (+24%) | 2604 | 1200 | 2.2 | atacante vence | 31% | 100% |
| Os mesmos 40 arqueiros com todos os bônus de ataque (+84%, limitado a +50%) | 3150 | 1200 | 2.6 | atacante vence | 24% | 100% |
| A mesma mina com todos os bônus de defesa (+89%, limitado a +50%) contra os 40 arqueiros sem bônus | 2100 | 1800 | 1.2 | atacante vence | 79% | 100% |

## Torres de arqueiros

| Nível | Alcance | Arqueiros no alto | Defesa somada | Custo | Tempo | Estrutura |
|---|---|---|---|---|---|---|
| 1 | 2 hex. | 6 | 450 | 420 pedra, 180 madeira | 40 min | 300 (8 aríetes) |
| 2 | 3 hex. | 12 | 900 | 760 pedra, 320 madeira | 1 h 20 min | 600 (15 aríetes) |
| 3 | 4 hex. | 18 | 1350 | 1360 pedra, 580 madeira | 2 h | 900 (23 aríetes) |

Portões do castelo: 500 de estrutura por nível (nível 3: 1500, 38 aríetes ou 17 trebuchets). Aríetes batem por combate; o trebuchet bate à distância, sem entrar no alcance dos arqueiros.

## Fauna, saque, relíquias e proteções

- Fauna (força = soma de (ataque + defesa)/2): baixo 40, médio 120, alto 300. Com o dobro do limite, o grupo passa ileso. 20 lanceiros = 650 (ileso em qualquer nível); 1 explorador a cavalo ≈ 37.5.
- Saque repetido ao mesmo alvo em 24 h: −20% por saque, até restar 20%.
- Relíquias: ataque +15%, produção +15%, resistência +20%. Produção +15% num local de nível 6 = +17/h, perto de meio nível (33/h). Escavação: 12 h com 1 unidade, mínimo 4 h.
- Escudo de novato 72 h; escudo de exílio 24 h; regência após 48 h sem entrar. Relíquias da temporada (legado): +1% a +2% cada, até 3 equipadas, teto somado de 5%. Aliança: até 5 reinos.

## Simulação de uma temporada (70 dias)

### Médio (4 sessões/dia)

| Dia | Produção/h (total) | Locais | Nível médio | Castelo | População / teto | Trabalhadores | Eficiência | Tropas |
|---|---|---|---|---|---|---|---|---|
| 1 | 328 | 4 | 3 | 3 | 279 / 300 | 120 | 100% | 46 |
| 3 | 496 | 4 | 5 | 5 | 302 / 360 | 200 | 99% | 104 |
| 7 | 733 | 5 | 6 | 6 | 575 / 600 | 300 | 100% | 210 |
| 10 | 1066 | 6 | 7 | 7 | 748 / 840 | 420 | 100% | 293 |
| 14 | 1495 | 7 | 7.9 | 8 | 966 / 1080 | 550 | 100% | 356 |
| 21 | 1793 | 9 | 7.6 | 8 | 1138 / 1140 | 680 | 100% | 398 |
| 35 | 3184 | 12 | 9 | 9 | 1866 / 1920 | 1080 | 100% | 672 |
| 50 | 3674 | 14 | 9 | 9 | 2218 / 2220 | 1260 | 100% | 776 |
| 70 | 3674 | 14 | 9 | 9 | 2218 / 2220 | 1260 | 100% | 776 |

Gasto em obras 472 mil · em tropas 84 mil · economia no máximo (nível médio ≥ 9,5), sem guerra: não chega.

### Ativo (8 sessões/dia)

| Dia | Produção/h (total) | Locais | Nível médio | Castelo | População / teto | Trabalhadores | Eficiência | Tropas |
|---|---|---|---|---|---|---|---|---|
| 1 | 328 | 4 | 3 | 3 | 279 / 300 | 120 | 100% | 54 |
| 3 | 400 | 4 | 4 | 4 | 331 / 360 | 160 | 99% | 173 |
| 7 | 536 | 6 | 4 | 4 | 622 / 720 | 240 | 100% | 379 |
| 10 | 757 | 7 | 5 | 5 | 958 / 1080 | 350 | 100% | 588 |
| 14 | 1169 | 8 | 6.4 | 7 | 1251 / 1380 | 510 | 98% | 751 |
| 21 | 1973 | 10 | 7.7 | 8 | 1943 / 1980 | 770 | 100% | 1089 |
| 35 | 3918 | 15 | 9 | 9 | 3408 / 3420 | 1350 | 100% | 1880 |
| 50 | 6004 | 18 | 10 | 10 | 4607 / 4620 | 1800 | 100% | 2540 |
| 70 | 6004 | 18 | 10 | 10 | 4607 / 4620 | 1800 | 100% | 2540 |

Gasto em obras 1377 mil · em tropas 313 mil · economia no máximo (nível médio ≥ 9,5), sem guerra: dia 46.

### Queda do castelo no dia 35 (médio)

O castelo cai com o reino ainda tendo outros locais: a sede vai para o local de maior nível, que vira castelo com 50% do nível antigo; o reino perde 50% dos recursos guardados e 30% da população civil; as relíquias do castelo vão com o atacante. A simulação supõe ainda 40% das tropas mortas no cerco e a fila de obras perdida.

- Castelo: nível 9 → 4. Volta ao nível 9 em 2.7 dias.
- Produção: 3184/h antes da queda; volta a 95% disso em 1.5 dias.

## Recursos valiosos e lendários

Valor de referência em recursos básicos (1). Orienta trocas, a IA comerciante e o limite do novato; os jogadores trocam pelo valor que combinarem. Couro e peles valem 2.

| Recurso | Valor | Onde | Para que serve | Jazida guarda | Jazidas no mapa | 10 lanceiros | 40 lanceiros + posto |
|---|---|---|---|---|---|---|---|
| Aço de qualidade | 15 | colina (veio puro) | armas e armaduras dos níveis 2 e 3; equipamento lendário | 1300 | 10 | 2.7/h | 12.1/h |
| Cavalos de raça | 40 | planície (manadas) | cavaleiro de elite (1 por unidade) e carroção (2) | 500 | 10 | 1/h | 4.5/h |
| Ouro | 20 | montanha | eras; armas e armaduras do nível 3 | 1000 | 10 | 2/h | 9.1/h |
| Prata | 10 | colina e montanha | moeda de troca padrão | 2000 | 10 | 4/h | 18.1/h |
| Sal | 6 | salinas (planície) | salgadeira: o local de comida guarda 20 h em vez de 10 h | 3300 | 10 | 6.6/h | 30.2/h |
| Ervas raras | 8 | pântano | tratar feridos (5 por ferido) | 2500 | 10 | 5/h | 22.7/h |
| Pedras preciosas | 30 | montanha | troca de alto valor; brasões e estandartes (só cosméticos) | 700 | 10 | 1.3/h | 6/h |
| Minério raro (lendário) | 60 | montanha, só o prospector revela | equipamento lendário | 200 | 5 | 0.7/h | 3/h |

Extração (valor por hora) = 0.158 × carga média × tropas^0.8; posto ×1.5; rota no caminho ×1.2; até 50 tropas por jazida. Quanto mais valioso, mais devagar sai.

| Grupo | Valor/h | Por população | Jazida de 20 mil dura |
|---|---|---|---|
| 1 lanceiro | 6.3 | 6.3 | 3164 h 33 min |
| 10 lanceiros | 39.9 | 4 | 501 h 33 min |
| 10 cavaleiros | 79.8 | 8 | 250 h 46 min |
| 20 lanceiros | 69.4 | 3.5 | 288 h 4 min |
| 40 lanceiros + posto | 181.3 | 4.5 | 110 h 18 min |
| 40 lanceiros + posto + rota | 217.6 | 5.4 | 91 h 55 min |

Um trabalhador de um local nível 6 rende 1.9/h. Extrair rende mais por pessoa, mas a tropa fica longe de casa, exposta, e a jazida acaba.

Oferta e demanda típica (Era do Aço, Era do Cerco Avançado e 2 linhas da ferraria no nível 3 por reino):

- Ouro: demanda 330 por reino, 9900 no mundo; oferta 10000 (101%).
- Aço: demanda 453 por reino, 13600 no mundo; oferta 13000 (96%).
- Minério raro: 1000 no mapa, 100 por equipamento: no máximo 10 lendários para 30 reinos.

## Comércio, pactos e resgate

- Sem mercado global. **Troca direta** só com reinos conhecidos; a proposta revela quem propõe. As duas cargas viajam pelo mapa, visíveis e roubáveis.
- **IA comerciante**: compra a 85% e vende a 115% do valor, só com o próprio estoque (mesmas regras dos jogadores). Ex.: 100 de ouro custam 2300 em básicos; vender 100 de ouro rende 1700.
- **Reino sob escudo de novato**: a diferença entre o que dá e o que recebe (trocas, ajuda de aliados, pagamentos) fica em até 2000 de valor por dia; no escudo inteiro, 6000, 24% do que um jogador médio produz no mesmo período (25323). Não pode ser cobrado por pacto.
- **Pacto de não agressão**: de 1 a 7 dias, até 3 ativos por reino; pagamento em qualquer direção (ou nenhum). Começa quando o pagamento chega; se a carga for roubada, não começa. O jogo impede ataques, saques e interceptações entre os dois até o fim.
- **Resgate de explorador**: quem captura vê o reino de origem e tem 24 h para pedir resgate, libertar ou executar; sem decisão, o explorador é libertado.

## Eras

A Era do Ferro é a inicial (armas e armaduras do nível 1).

| Era | Requisito | Custo | Valor | Tempo | Libera | Custo sem o ouro, em horas de produção do médio |
|---|---|---|---|---|---|---|
| Era do Aço | ferraria nível 7 | 80 ouro, 1500 ferro, 1000 madeira | 4100 | 6 h | armas e armaduras dos níveis 2 e 3, cavaleiro de elite, equipamento lendário | 2.3 h (dia 10) |
| Era do Cerco Avançado | Era do Aço e quartel nível 8 | 150 ouro, 4000 madeira, 3000 pedra, 1500 ferro | 11500 | 12 h | trebuchet e portões dos níveis 4 e 5 | 4.7 h (dia 21) |

## Ferraria: armas e armaduras

Duas linhas por família (infantaria, arqueiros, cavalaria): armas dão +8% de ataque por nível; armaduras, +8% de defesa. Fila própria, até 10, uma por vez.

| Nível | Bônus | Custo por linha | Valor | Tempo | Requisito |
|---|---|---|---|---|---|
| 1 | +8% | 1500 ferro, 800 madeira, 200 couro | 2700 | 2 h | ferraria nível 3 |
| 2 | +16% | 3000 ferro, 1500 madeira, 60 aço | 5400 | 6 h | Era do Aço |
| 3 | +24% | 6000 ferro, 3000 madeira, 150 aço, 50 ouro | 12250 | 12 h | Era do Aço e ferraria nível 9 |

- Uma linha completa: 20350 de valor e 20 h. As 6 linhas: 122 mil e 120 h de ferraria, 26% do que o médio gasta em obras na temporada.
- O nível 1 rende mais que recrutar com o mesmo valor a partir de 375 lanceiros, 338 arqueiros ou 199 cavaleiros. Antes disso, recrutar compensa mais: a ferraria é para exércitos grandes.

## Equipamento lendário e cavaleiro de elite

- **Equipamento lendário**: 100 minério raro, 1500 ferro, 100 aço (valor 9000), 24 h, Era do Aço e ferraria nível 8. +25% de ataque ou defesa para um exército de até 50 tropas (num exército maior, o bônus se dilui). Vale no máximo 12.5 tropas. Um por reino; se o exército for derrotado, fica no campo e o vencedor leva.
- **Cavaleiro de elite**: ataque 60, defesa 40, rápida, carga 80, 70 comida, 60 ferro, 40 couro, 1 cavalo de raça (valor 250), 8 min. Por população: 60 de ataque contra 45 da cavalaria. Por 100 de valor: 24 contra 26.5. Mais forte por pessoa, mais caro por força.

## Veterania, feridos e teto de bônus

- **Veterania**: cada vitória com perdas abaixo de 50%, contra um inimigo com pelo menos 30% da própria força, dá 1 marca ao exército. 2 marcas: +5%; 5 marcas: +10%; 9 marcas: +15% (ataque e defesa). Recrutas novos diluem as marcas na proporção; cada derrota tira 1. Fauna não conta.
- **Feridos**: 30% das baixas de quem vence, ou recua pela tática, voltam feridos. 5 ervas curam 1 em 2 h, no castelo; sem ervas em 24 h, morrem. Curar custa 40 de valor, 44% de um lanceiro, e devolve a população. No caso dos 40 arqueiros sem bônus, as perdas caem de 43% para 30%.
- **Teto de bônus**: a soma de armas ou armaduras (+24%), veterania (+15%), relíquia (+15% ataque, +20% resistência), lendário (+25%) e legado (+5%) chega a +84% no ataque e +89% na defesa; vale até +50%. Torres e portões ficam fora do teto. Com o teto, um exército no máximo vence uma defesa até 1.5× maior e perde para 2×.

## Metas verificadas

| | Meta | Resultado | |
|---|---|---|---|
| M1 | Kit inicial recruta 10 lanceiros na primeira sessão | pode | ✓ |
| M2a | Primeira melhoria se paga em até 6 h | 5.6 h | ✓ |
| M2b | Melhoria para o nível 10 se paga em 1 a 2 semanas (investimento de fim de temporada) | 13 dias | ✓ |
| M3a | Obra para o nível 2 leva até 2 min | 2 min | ✓ |
| M3b | Obra para o nível 10 leva de 6 a 10 h | 8 h 32 min | ✓ |
| M3c | 10 obras de nível 6 a 8 cobrem a noite (7 a 14 h) | 12 h 27 min | ✓ |
| M4a | Vizinho do próprio reino (3 hex.) em até 15 min, tropa lenta | 10 min | ✓ |
| M4b | Reino vizinho (14 hex.) entre 30 e 60 min, tropa lenta | 45 min | ✓ |
| M4c | Travessia do mapa em até 3 h 30 min, tropa lenta | 3 h 14 min | ✓ |
| M5a | Jogador médio com 60 a 150 tropas no fim do escudo (dia 3) | 104 | ✓ |
| M5b | Jogador médio com 400 a 900 tropas no dia 35 | 672 | ✓ |
| M5c | Jogador ativo com 2 a 3× as tropas do médio no dia 35 | 2.8× | ✓ |
| M5d | Recrutar não derruba a economia do médio (eficiência ≥ 90% no dia 35) | 100% | ✓ |
| M5e | Sem guerra, o ativo chega ao máximo da economia entre os dias 30 e 50 | dia 46 | ✓ |
| M5f | Sem guerra, o médio só chega ao máximo depois do dia 40 (ou não chega) | não chega | ✓ |
| M6 | 30 cavaleiros levam pelo menos 2 h de produção de um local nível 6 | 22 h | ✓ |
| M7a | Local defendido cai com cerca de 1,5× a força (arqueiros contra lanceiros) | 2.1× | ✓ |
| M7b | Torre muda o resultado do mesmo ataque | defesa vence | ✓ |
| M7c | Castelo médio resiste a 150 tropas e cai com cerca de 2× isso | resiste / cai | ✓ |
| M8 | Relíquia de produção vale menos que 1 nível do local (nível 6) | 17 < 33 | ✓ |
| M9 | Tática média recua com 40% e ainda causa perdas na defesa | 8% na defesa | ✓ |
| M10 | Bônus somados ficam no teto de +50% (sem teto: +84% / +89%) | 50% | ✓ |
| M11 | Armas ou armaduras nível 1 só compensam a partir de 150 a 600 tropas da família | 199 a 375 | ✓ |
| M12 | Ferraria completa custa 25% a 50% do gasto em obras do médio na temporada | 26% | ✓ |
| M13 | Extrair valiosos rende por pessoa 1,5 a 3× um trabalhador de local nível 6 (10 lanceiros) | 2.1× | ✓ |
| M14 | O ouro da Era do Aço sai em 6 a 36 h com 20 lanceiros, sem posto | 23 h 3 min | ✓ |
| M15 | Ouro e aço no mapa cobrem 90% a 150% da demanda típica (escassos, motivo de disputa) | 101% / 96% | ✓ |
| M16 | Era do Aço custa 2 a 4 h de produção do médio no dia 10; Era do Cerco, 4 a 8 h no dia 21 (sem o ouro) | 2.3 h / 4.7 h | ✓ |
| M17 | Curar um ferido custa 25% a 60% de recrutar um lanceiro | 44% | ✓ |
| M18 | Equipamento lendário vale no máximo 15 tropas | 12.5 tropas | ✓ |
| M19 | Cavaleiro de elite: mais ataque por pessoa e menos por valor que a cavalaria | 60 > 45 · 24 < 26.5 | ✓ |
| M20 | Reino sob escudo recebe no máximo 30% do que ele mesmo produz no escudo | 24% | ✓ |
| M21 | Depois de perder o castelo no dia 35, o médio volta ao nível anterior em 2 a 6 dias | 2.7 dias | ✓ |

Todas as metas no alvo.
