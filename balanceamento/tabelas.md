# Tabelas do balanceamento (geradas)

Geradas por `node balanceamento/modelo.js`. Não edite à mão: mude os parâmetros no modelo e rode de novo.

## Locais de produção por nível

| Nível | Produção/h | Vagas de trabalho | Custo para subir | Receita | Tempo de obra | Retorno do custo |
|---|---|---|---|---|---|---|
| 1 | 9 | 1 | — | — | — | — |
| 2 | 11.7 | 1 | 5 | 2 madeira, 2 pedra, 1 ferro, 1 comida | 40 s | 1.9 h |
| 3 | 15.2 | 1 | 11 | 5 madeira, 4 pedra, 1 ferro, 1 comida | 1 min 20 s | 3.1 h |
| 4 | 19.8 | 1 | 24 | 11 madeira, 8 pedra, 2 ferro, 2 comida | 3 min | 5.2 h |
| 5 | 25.7 | 2 | 52 | 23 madeira, 18 pedra, 5 ferro, 5 comida | 5 min | 8.7 h |
| 6 | 33.4 | 2 | 113 | 51 madeira, 40 pedra, 11 ferro, 11 comida | 11 min | 14.6 h |
| 7 | 43.4 | 2 | 246 | 111 madeira, 86 pedra, 25 ferro, 25 comida | 21 min | 24.6 h |
| 8 | 56.5 | 2 | 537 | 242 madeira, 188 pedra, 54 ferro, 54 comida | 43 min | 41.2 h |
| 9 | 73.4 | 3 | 1170 | 526 madeira, 409 pedra, 117 ferro, 117 comida | 1 h 25 min | 69.1 h |
| 10 | 95.4 | 3 | 2550 | 1148 madeira, 893 pedra, 255 ferro, 255 comida | 2 h 51 min | 115.8 h |
| 11 | 124.1 | 3 | 5560 | 2502 madeira, 1946 pedra, 556 ferro, 556 comida | 5 h 41 min | 194.2 h |

A serraria rende 1.5× o valor da tabela: as obras gastam 45% em madeira.

Estoque de cada local: até 10 h da própria produção; o excedente vai para o armazém, que também guarda os valiosos. Uma vaga vazia produz menos: a produção do local é proporcional às vagas ocupadas.

Castelo: produz 7.5/h de cada recurso básico no nível 1 e 23.3/h no nível 11. Nenhum local passa do nível do castelo. Melhorar o castelo custa 4× e leva 2× o tempo de um local do mesmo nível (nível 11: 11 h 23 min).

População: o castelo abriga 15 pessoas e cada moradia mais 3 (a primeira custa 18 madeira, 14 pedra, 4 ferro, 4 comida, cada uma 24 a mais). Reino novo: 8 pessoas. Crescimento de 3 a 6 pessoas por hora enquanto há espaço no teto (mais rápido com mais espaço livre), +30% com sobra de comida, até 6/h.

Reino novo com os primeiros passos já dados: castelo e locais no nível 2, 2 moradias, 4 lanceiros e 2 arqueiros no castelo, 1 a pé, 1 a cavalo, 1 prospector (exploradores prontos) e o entorno explorado até 12 hexágonos do castelo.

## Unidades

Cada unidade é uma pessoa do reino (as máquinas de cerco, a equipe que as opera). Valor: custo em valor de referência (couro vale 2, cavalo de raça 40). Por 100: ataque e defesa por 100 de valor.

| Unidade | Família | Ataque | Defesa | Vence | Velocidade | Carga | Visão | Custo | Valor | Tempo | Pop. | Ataque/100 | Defesa/100 | Requisito |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Milícia | Infantaria | 5 | 15 | — | Lenta | 3 | 2 | 20 comida, 10 madeira | 30 | 40 s | 1 | 16.7 | 50 | — |
| Lanceiro | Infantaria | 25 | 40 | Cavalaria | Lenta | 5 | 2 | 30 comida, 30 madeira, 30 ferro | 90 | 4 min | 1 | 27.8 | 44.4 | — |
| Arqueiro | Arqueiros | 35 | 25 | Infantaria | Média | 5 | 4 | 30 comida, 50 madeira, 10 couro | 100 | 5 min | 1 | 35 | 25 | — |
| Cavalaria | Cavalaria | 45 | 30 | Arqueiros | Rápida | 10 | 4 | 60 comida, 50 ferro, 30 couro | 170 | 8 min | 1 | 26.5 | 17.6 | — |
| Cavaleiro de elite | Cavalaria | 60 | 40 | Arqueiros | Rápida | 10 | 4 | 70 comida, 60 ferro, 40 couro, 1 cavalo de raça | 250 | 11 min | 1 | 24 | 16 | Era do Aço |
| Aríete | Cerco | 10 | 10 | torres e portões (40) | Lenta | 0 | 2 | 60 madeira, 15 ferro | 75 | 20 min | 1 | 13.3 | 13.3 | — |
| Trebuchet | Cerco | 5 | 5 | torres e portões (90) | Lenta | 0 | 2 | 90 madeira, 40 pedra, 30 ferro | 160 | 40 min | 1 | 3.1 | 3.1 | Era do Cerco Avançado |

Mensageiro: 30 comida, 1 de população, 1 min 20 s, velocidade rápida (reino vizinho em 1 min 37 s). Mensagem de até 200 caracteres; recado de proposta, até 120.

Veículos: carroça 60 (lenta, 15 madeira, 2 ferro); carroção 180 (média, 40 madeira, 8 ferro, 2 cavalos de raça). Carregador da requisição: 30 por pessoa, a pé.

## Deslocamento

| Distância | Exemplo | Lenta | Média | Rápida | Lenta em rota |
|---|---|---|---|---|---|
| 6 hex. | local vizinho do próprio reino | 20 s | 13 s | 8 s | 11 s |
| 20 hex. | outro lado do próprio reino | 1 min 8 s | 45 s | 27 s | 37 s |
| 72 hex. | reino vizinho | 4 min | 3 min | 1 min 37 s | 2 min |
| 156 hex. | meio mapa | 9 min | 6 min | 4 min | 5 min |
| 312 hex. | travessia do mapa | 18 min | 12 min | 7 min | 10 min |

Mapa para 30 reinos: 312 × 240 hexágonos (≈ 2496 por reino). Terreno médio 1.35; rota pública multiplica por 0.55.

## Combates de referência

Valor de ataque contra valor de defesa; o vencedor perde (menor/maior)^1.5 das tropas. Milícia: cada civil presente no local luta, com defesa 15. Arqueiros no alto de torres: defesa ×3.

| Situação | Ataque | Defesa | Razão | Resultado | Perdas do atacante | Perdas da defesa |
|---|---|---|---|---|---|---|
| 6 lanceiros contra mina com 4 lanceiros e 3 civis | 150 | 205 | 0.7 | defesa vence | 100% | 63% |
| 8 arqueiros contra a mesma mina | 420 | 205 | 2 | atacante vence | 34% | 100% |
| 8 arqueiros contra a mina com torre nível 2 (4 arqueiros no alto) | 420 | 505 | 0.8 | defesa vence | 100% | 76% |
| 6 cavaleiros (saque) contra vila com 2 lanceiros e 4 civis | 270 | 180 | 1.5 | atacante vence | 54% | 100% |
| 6 cavaleiros contra vila com 3 arqueiros e 4 civis | 405 | 135 | 3 | atacante vence | 19% | 100% |
| Mina Rubra (4 lanceiros, torre 1, relíquia de resistência, 2 civis) contra 8 arqueiros | 420 | 408 | 1 | atacante vence | 96% | 100% |
| Cerco: 20 tropas mistas, sem máquinas, contra castelo médio nível 10 (12 tropas, 2 torres nível 1, portões 3, 10 civis, 5 arqueiros na menagem) | 779 | 2791 | 0.3 | defesa vence | 100% | 15% |
| Mesmo castelo contra exército de cerco de 40 (10 lanceiros, 16 arqueiros, 6 cavaleiros, 8 aríetes) | 1380 | 1267 | 1.1 | atacante vence | 88% | 100% |
| Ataque perdido com tática média (recua com 40%) | 75 | 205 | 0.4 | recuou | 40% | 9% |
| 8 arqueiros contra mina com 4 lanceiros, torre 1 e 3 civis, sem bônus | 420 | 355 | 1.2 | atacante vence | 78% | 100% |
| Os mesmos 8 arqueiros com armas nível 3 (+24%) | 521 | 355 | 1.5 | atacante vence | 56% | 100% |
| Os mesmos 8 arqueiros com todos os bônus de ataque (+84%, limitado a +50%) | 630 | 355 | 1.8 | atacante vence | 42% | 100% |
| A mesma mina com todos os bônus de defesa (+89%, limitado a +50%) contra os 8 arqueiros sem bônus | 420 | 533 | 0.8 | defesa vence | 100% | 70% |
| Castelo nível 8 vazio (3 civis, 4 arqueiros na menagem, portões básicos 2) contra 6 tropas de reino novo (4 lanceiros, 2 arqueiros) | 170 | 673 | 0.3 | defesa vence | 100% | 13% |
| O mesmo castelo contra 10 arqueiros de reino novo | 350 | 673 | 0.5 | defesa vence | 100% | 38% |
| O mesmo castelo contra 20 tropas sem máquinas de cerco (10 lanceiros, 10 arqueiros) | 600 | 673 | 0.9 | defesa vence | 100% | 84% |
| O mesmo castelo contra exército de cerco de 20 (8 lanceiros, 8 arqueiros, 4 aríetes) | 520 | 411 | 1.3 | atacante vence | 70% | 100% |
| Castelo nível 8 com 2 lanceiros e 3 civis contra 10 cavaleiros sem máquinas | 450 | 907 | 0.5 | defesa vence | 100% | 35% |

## Duração da batalha

Sem tempo fixo: 20 s + 12 s × tropas do lado mais fraco × (força menor / força maior)^1,5, até 10 min. O tempo real é menor: o ritmo acompanha quem sobra.

| Situação | Tropas do lado mais fraco | Força menor / maior | Duração |
|---|---|---|---|
| 50 contra 1 | 1 | 0,02 | 20 s |
| 6 contra 4, forças parecidas | 4 | 0,9 | 1 min 1 s |
| 8 arqueiros contra mina com 4 lanceiros e 3 civis | 7 | 0,73 | 1 min 12 s |
| 20 contra 20, forças iguais | 20 | 1 | 4 min 20 s |
| 40 tropas contra castelo médio (12 tropas e 10 civis) | 22 | 0,82 | 3 min 36 s |
| 50 contra 50, forças iguais | 50 | 1 | 10 min |

## Torres de arqueiros

| Nível | Alcance | Arqueiros no alto | Defesa somada | Custo | Tempo | Estrutura |
|---|---|---|---|---|---|---|
| 1 | 4 hex. | 2 | 150 | 105 pedra, 45 madeira | 13 min | 80 (2 aríetes) |
| 2 | 6 hex. | 4 | 300 | 189 pedra, 81 madeira | 27 min | 160 (4 aríetes) |
| 3 | 8 hex. | 6 | 450 | 340 pedra, 146 madeira | 40 min | 240 (6 aríetes) |

Portões do castelo: 100 de estrutura por nível (nível 3: 300, 8 aríetes ou 4 trebuchets). Aríetes batem por combate; o trebuchet bate à distância, sem entrar no alcance dos arqueiros.

## Defesa própria do castelo

Cresce com o nível e não gasta pessoas: arqueiros no alto da torre de menagem (defesa ×3, fora do teto de bônus) e portões básicos. Sem máquinas de cerco, os portões fechados valem o multiplicador × 1,5; aríetes e trebuchets os arrombam na proporção da estrutura (100 por nível). A obra de portões sobe a partir do básico. Defesa sem guarnição e sem civis:

| Castelo | Arqueiros na menagem | Portões básicos | Defesa contra força sem máquinas | Com os portões arrombados | Aríetes para arrombar |
|---|---|---|---|---|---|
| 1 | 0 | 0 | 0 | 0 | — |
| 2 | 1 | 0 | 75 | 75 | — |
| 3 | 1 | 0 | 75 | 75 | — |
| 4 | 2 | 1 | 259 | 150 | 3 |
| 5 | 2 | 1 | 259 | 150 | 3 |
| 6 | 3 | 1 | 388 | 225 | 3 |
| 7 | 3 | 1 | 388 | 225 | 3 |
| 8 | 4 | 2 | 585 | 300 | 5 |
| 9 | 4 | 2 | 585 | 300 | 5 |
| 10 | 5 | 2 | 731 | 375 | 5 |
| 11 | 5 | 2 | 731 | 375 | 5 |

## Fauna, saque, relíquias e proteções

- Fauna (força = soma de (ataque + defesa)/2): baixo 50, médio 110, alto 180. Com o dobro do limite, o grupo passa ileso. 4 lanceiros = 130 (ilesos no baixo); 12 arqueiros = 360 (ilesos em qualquer nível); 1 explorador a cavalo = 15.
- Saque repetido ao mesmo alvo em 24 h: −20% por saque, até restar 20%.
- Relíquias: ataque +15%, produção +15%, resistência +20%. Produção +15% num local de nível 6 = +5/h, perto de meio nível (10/h). Escavação: 4 h com 1 unidade, mínimo 1 h 20 min.
- Escudo de novato 72 h; escudo de exílio 24 h. Relíquias da temporada (legado): +1% a +2% cada, até 3 equipadas, teto somado de 5%. Aliança: até 5 reinos.

## Simulação de uma temporada (70 dias)

### Médio (4 sessões/dia)

| Dia | Produção/h (total) | Locais | Nível médio | Castelo | Pessoas (civis + tropas + exploradores) / teto | Vagas | Eficiência | Tropas |
|---|---|---|---|---|---|---|---|---|
| 1 | 131 | 4 | 4 | 4 | 21 (11 + 7 + 3) / 21 | 4 | 100% | 7 |
| 3 | 275 | 4 | 7.3 | 8 | 21 (11 + 7 + 3) / 21 | 8 | 100% | 7 |
| 4 | 320 | 4 | 8 | 8 | 21 (11 + 7 + 3) / 21 | 8 | 100% | 7 |
| 7 | 478 | 5 | 9 | 9 | 30 (17 + 10 + 3) / 30 | 15 | 100% | 10 |
| 10 | 693 | 6 | 9.7 | 10 | 33 (19 + 11 + 3) / 33 | 17 | 100% | 11 |
| 14 | 808 | 7 | 9.7 | 10 | 39 (23 + 13 + 3) / 39 | 20 | 100% | 13 |
| 21 | 962 | 9 | 9.3 | 10 | 48 (29 + 16 + 3) / 48 | 25 | 100% | 16 |
| 35 | 1740 | 12 | 10.9 | 11 | 66 (40 + 23 + 3) / 66 | 36 | 100% | 23 |
| 50 | 2078 | 14 | 11 | 11 | 78 (49 + 26 + 3) / 78 | 42 | 100% | 26 |
| 70 | 2078 | 14 | 11 | 11 | 78 (49 + 26 + 3) / 78 | 42 | 100% | 26 |

Gasto em obras 194867 · em tropas 2340 · economia no máximo (nível médio ≥ 10,5), sem guerra: dia 26.

### Ativo (8 sessões/dia)

| Dia | Produção/h (total) | Locais | Nível médio | Castelo | Pessoas (civis + tropas + exploradores) / teto | Vagas | Eficiência | Tropas |
|---|---|---|---|---|---|---|---|---|
| 1 | 203 | 4 | 6 | 6 | 24 (11 + 10 + 3) / 24 | 8 | 100% | 10 |
| 3 | 320 | 4 | 8 | 8 | 24 (9 + 12 + 3) / 24 | 8 | 100% | 12 |
| 4 | 402 | 5 | 8.2 | 9 | 30 (13 + 14 + 3) / 30 | 11 | 100% | 14 |
| 7 | 548 | 6 | 8.5 | 10 | 42 (19 + 20 + 3) / 42 | 17 | 100% | 20 |
| 10 | 808 | 7 | 9.7 | 10 | 51 (23 + 25 + 3) / 51 | 20 | 100% | 25 |
| 14 | 942 | 8 | 10 | 10 | 60 (27 + 30 + 3) / 60 | 24 | 100% | 30 |
| 21 | 1520 | 10 | 11 | 11 | 72 (34 + 35 + 3) / 72 | 30 | 100% | 35 |
| 35 | 2202 | 15 | 11 | 11 | 105 (50 + 52 + 3) / 105 | 45 | 100% | 52 |
| 50 | 2637 | 18 | 11 | 11 | 126 (61 + 62 + 3) / 126 | 54 | 100% | 62 |
| 70 | 2637 | 18 | 11 | 11 | 126 (61 + 62 + 3) / 126 | 54 | 100% | 62 |

Gasto em obras 253580 · em tropas 7380 · economia no máximo (nível médio ≥ 10,5), sem guerra: dia 20.

### Queda do castelo no dia 35 (médio)

O castelo cai com o reino ainda tendo outros locais: a sede vai para o local de maior nível, que vira castelo com 50% do nível antigo; o reino perde 50% dos recursos guardados e 30% da população civil; as relíquias do castelo vão com o atacante. A simulação supõe ainda 40% das tropas mortas no cerco e a fila de obras perdida.

- Castelo: nível 11 → 5. Volta ao nível 11 em 2.3 dias.
- Produção: 1740/h antes da queda; volta a 95% disso em 2.3 dias.

## Recursos valiosos e lendários

Valor de referência em recursos básicos (1). Orienta trocas, a IA comerciante e o limite do novato; os jogadores trocam pelo valor que combinarem. Couro e peles valem 2.

| Recurso | Valor | Onde | Para que serve | Jazida guarda | Jazidas no mapa | 4 lanceiros | 6 lanceiros + posto |
|---|---|---|---|---|---|---|---|
| Aço de qualidade | 15 | colina (veio puro) | armas e armaduras dos níveis 2 e 3; equipamento lendário | 130 | 10 | 7.6/h | 15.7/h |
| Cavalos de raça | 40 | planície (manadas) | cavaleiro de elite (1 por unidade) e carroção (2) | 50 | 10 | 2.8/h | 5.9/h |
| Ouro | 20 | montanha | eras; armas e armaduras do nível 3 | 100 | 10 | 5.7/h | 11.8/h |
| Prata | 10 | colina e montanha | moeda de troca padrão | 200 | 10 | 11.4/h | 23.6/h |
| Sal | 6 | salinas (planície) | salgadeira: o local de comida guarda 20 h em vez de 10 h | 330 | 10 | 18.9/h | 39.3/h |
| Ervas raras | 8 | pântano | tratar feridos (5 por ferido) | 250 | 10 | 14.2/h | 29.5/h |
| Pedras preciosas | 30 | montanha | troca de alto valor; brasões e estandartes (só cosméticos) | 70 | 10 | 3.8/h | 7.9/h |
| Minério raro (lendário) | 60 | montanha, só o prospector revela | equipamento lendário | 20 | 5 | 1.9/h | 3.9/h |

Extração (valor por hora) = 7.5 × carga média × tropas^0.8; posto ×1.5; rota no caminho ×1.2; até 6 tropas por jazida. Quanto mais valioso, mais devagar sai.

| Grupo | Valor/h | Por pessoa | Jazida de 2000 dura |
|---|---|---|---|
| 1 lanceiro | 37.5 | 37.5 | 53 h 20 min |
| 4 lanceiros | 113.7 | 28.4 | 17 h 36 min |
| 3 cavaleiros | 180.6 | 60.2 | 11 h 4 min |
| 6 lanceiros | 157.2 | 26.2 | 12 h 43 min |
| 6 lanceiros + posto | 235.9 | 39.3 | 8 h 29 min |
| 6 lanceiros + posto + rota | 283 | 47.2 | 7 h 4 min |

Um trabalhador de um local nível 6 rende 16.7/h. Extrair rende mais por pessoa, mas a tropa fica longe de casa, exposta, e a jazida acaba.

Oferta e demanda típica (Era do Aço, Era do Cerco Avançado e 2 linhas da ferraria no nível 3 por reino):

- Ouro: demanda 33 por reino, 990 no mundo; oferta 1000 (101%).
- Aço: demanda 45 por reino, 1360 no mundo; oferta 1300 (96%).
- Minério raro: 100 no mapa, 10 por equipamento: no máximo 10 lendários para 30 reinos.

## Comércio, pactos e resgate

- Sem mercado global. **Troca direta** só com reinos conhecidos; a proposta revela quem propõe. As duas cargas viajam pelo mapa, visíveis e roubáveis.
- **IA comerciante**: compra a 85% e vende a 115% do valor, só com o próprio estoque (mesmas regras dos jogadores). Ex.: 10 de ouro custam 230 em básicos; vender 10 de ouro rende 170.
- **Reino sob escudo de novato**: a diferença entre o que dá e o que recebe (trocas, ajuda de aliados, pagamentos) fica em até 600 de valor por dia; no escudo inteiro, 1800, 16% do que um jogador médio produz no mesmo período (11428). Não pode ser cobrado por pacto.
- **Pacto de não agressão**: de 1 a 7 dias, até 3 ativos por reino; pagamento em qualquer direção (ou nenhum). Começa quando o pagamento chega; se a carga for roubada, não começa. O jogo impede ataques, saques e interceptações entre os dois até o fim.
- **Resgate de explorador**: quem captura vê o reino de origem e tem 24 h para pedir resgate, libertar ou executar; sem decisão, o explorador é libertado.

## Eras

A Era do Ferro é a inicial (armas e armaduras do nível 1).

| Era | Requisito | Custo | Valor | Tempo | Libera | Custo sem o ouro, em horas de produção do médio |
|---|---|---|---|---|---|---|
| Era do Aço | ferraria nível 7 | 8 ouro, 150 ferro, 120 madeira | 430 | 2 h | armas e armaduras dos níveis 2 e 3, cavaleiro de elite, equipamento lendário | 0.8 h (dia 4) |
| Era do Cerco Avançado | Era do Aço e quartel nível 8 | 15 ouro, 400 madeira, 300 pedra, 150 ferro | 1150 | 4 h | trebuchet e portões dos níveis 4 e 5 | 1.8 h (dia 7) |

## Ferraria: armas e armaduras

Duas linhas por família (infantaria, arqueiros, cavalaria): armas dão +8% de ataque por nível; armaduras, +8% de defesa. Fila própria, até 10, uma por vez.

| Nível | Bônus | Custo por linha | Valor | Tempo | Requisito |
|---|---|---|---|---|---|
| 1 | +8% | 100 ferro, 50 madeira, 15 couro | 180 | 40 min | ferraria nível 3 |
| 2 | +16% | 350 ferro, 200 madeira, 6 aço | 640 | 2 h | Era do Aço |
| 3 | +24% | 700 ferro, 350 madeira, 15 aço, 5 ouro | 1375 | 4 h | Era do Aço e ferraria nível 9 |

- Uma linha completa: 2195 de valor e 6 h 40 min. As 6 linhas: 13170 e 40 h de ferraria, 7% do que o médio gasta em obras na temporada.
- O nível 1 rende mais que recrutar com o mesmo valor a partir de 25 lanceiros, 23 arqueiros ou 13 cavaleiros. Antes disso, recrutar compensa mais: a ferraria é para quem já tem exército.

## Equipamento lendário e cavaleiro de elite

- **Equipamento lendário**: 10 minério raro, 150 ferro, 10 aço (valor 900), 8 h, Era do Aço e ferraria nível 8. +25% de ataque ou defesa para um exército de até 8 tropas (num exército maior, o bônus se dilui). Vale no máximo 2 tropas. Um por reino; se o exército for derrotado, fica no campo e o vencedor leva.
- **Cavaleiro de elite**: ataque 60, defesa 40, rápida, carga 10, 70 comida, 60 ferro, 40 couro, 1 cavalo de raça (valor 250), 11 min. Por população: 60 de ataque contra 45 da cavalaria. Por 100 de valor: 24 contra 26.5. Mais forte por pessoa, mais caro por força.

## Veterania, feridos e teto de bônus

- **Veterania** (por pessoa): cada vitória com perdas abaixo de 50%, contra um inimigo com pelo menos 30% da própria força, dá 1 marca a cada soldado do grupo. 2 marcas: +5%; 5 marcas: +10%; 9 marcas: +15% (ataque e defesa; o bônus do grupo é a média). Recrutas novos diluem as marcas; cada derrota tira 1. Fauna não conta.
- **Feridos**: 30% das baixas de quem vence, ou recua pela tática, voltam feridos. 5 ervas curam 1 em 40 min, no castelo; sem ervas em 24 h, morrem. Curar custa 40 de valor, 44% de um lanceiro, e devolve a pessoa. No caso dos 8 arqueiros sem bônus, as perdas caem de 78% para 54%.
- **Teto de bônus**: a soma de armas ou armaduras (+24%), veterania (+15%), relíquia (+15% ataque, +20% resistência), lendário (+25%) e legado (+5%) chega a +84% no ataque e +89% na defesa; vale até +50%. Torres e portões ficam fora do teto. Com o teto, um exército no máximo vence uma defesa até 1.5× maior e perde para 2×.

## Fauna, caça, exploradores, rotas e espionagem

Fauna: força 50 / 110 / 180 (baixo, médio, alto); bandos de 1 a 6 animais. Chance de ataque por região atravessada: baixo 10%, médio 25%, alto 50%. Num ataque, o grupo perde 5% se tiver força acima do limite e 25% se abaixo; um explorador sozinho morre. O bando abatido volta em 8 h.

| Grupo | Força | Perigo baixo | Perigo médio | Perigo alto |
|---|---|---|---|---|
| Explorador a pé | 10 | risco baixo | risco médio | risco alto |
| Explorador a cavalo | 15 | risco baixo | risco médio | risco alto |
| Explorador + 2 lanceiros de escolta | 80 | ileso | risco médio | risco alto |
| 2 lanceiros | 65 | ileso | risco médio | risco alto |
| 4 lanceiros (extração) | 130 | ileso | risco baixo | risco alto |
| 12 arqueiros | 360 | ileso | ileso | ileso |

**Caça** (por bando abatido; 7 min no local):

| Animal | Perigo | Comida | Couro | Peles | Valor | Grupo para ir ileso |
|---|---|---|---|---|---|---|
| Javalis | baixo | 12 | 4 | 1 | 22 | 4 arqueiros |
| Lobos | alto | 5 | 3 | 4 | 19 | 12 arqueiros |
| Ursos | alto | 9 | 6 | 6 | 33 | 12 arqueiros |
| Crocodilos | médio | 5 | 9 | 0 | 23 | 8 arqueiros |

Couro: 1 caçada por dia rende ≈ 5.5; o médio usa ≈ 5.5 por dia para recrutar (1/3 arqueiros, 1/6 cavalaria).

**Exploradores** (pessoas do reino; 1 de população cada):

| Tipo | Custo | Valor | Treino | Velocidade | Visão | Força contra fauna |
|---|---|---|---|---|---|---|
| A pé | 40 comida | 40 | 1 min 20 s | Lenta | 4 | 10 |
| A cavalo | 60 comida, 15 couro | 90 | 4 min | Rápida | 6 | 15 |
| Prospector | 80 comida, 40 ferro | 120 | 8 min | Lenta | 2 (jazidas a 4) | 8 |
| Batedor de elite | 90 comida, 30 couro | 150 | 11 min | Rápida | 6 | 20 |

**Rotas**: 6 madeira, 4 pedra e 50 s por hexágono, multiplicados pelo terreno (planície ×1, colina ×1.25, floresta ×1.8, montanha ×2.3, pântano ×2.8). **Ponte** (hexágono de rio): 60 madeira, 40 pedra, 10 min. Vau: grátis e mais lento. 20 hexágonos de rota em planície (a distância de 10 hexágonos antigos): 200 (0.2 h de produção do médio no dia 14).

**Espionagem**: chance de o batedor ser visto ao espionar = 15% + 10% por torre no alcance + 2.5% por tropa da guarnição, até 60%. Visto, metade das vezes é capturado (sem relatório); na outra, foge com o relatório. Em ambos os casos, o alvo vê o espião por 10 h. 3 min no local.

| Alvo | Chance de ser visto |
|---|---|
| Local sem torre e sem tropas | 15% |
| Mina com 4 lanceiros e 1 torre | 35% |
| Castelo médio (12 tropas, 2 torres) | 60% |

## Vida e fauna como dano

Cada pessoa tem vida e a recupera inteira em 2 h, sem tique. Num ataque de fauna no caminho, cada animal do bando ataca uma pessoa diferente do grupo e tira 10 a 30 (baixo), 20 a 60 (médio), 35 a 105 (alto) de vida, pelo risco efetivo do grupo (a força continua reduzindo o risco e, com o dobro, o grupo passa ileso). Morre só quem chega a zero; os feridos seguem andando. O explorador sozinho a cavalo (ou batedor) foge do bando em 60% dos ataques. Carregadores perdem carga, não vida. Numa batalha, quem sobrevive perde 80% da vida máxima vezes a fração de perdas do próprio lado, sem morrer por isso.

| Ofício | Vida | Recupera por hora |
|---|---|---|
| Civil | 60 | 30 |
| Milícia | 70 | 35 |
| Lanceiro | 110 | 55 |
| Arqueiro | 90 | 45 |
| Cavalaria | 110 | 55 |
| Cavaleiro de elite | 130 | 65 |
| Explorador (a pé, a cavalo) | 80 | 40 |
| Prospector | 70 | 35 |
| Batedor de elite | 90 | 45 |
| Mensageiro | 70 | 35 |

| Explorador sozinho | Morre num ataque do perigo baixo | médio | alto |
|---|---|---|---|
| A pé (vida 80) | 0% | 0% | 36% |
| A cavalo (foge em 60%) | 0% | 0% | 14% |

Antes, o explorador sozinho atacado morria sempre. Agora, um ataque só mata no perigo alto, e a rota segura (padrão dos exploradores) desvia do perigo que o reino conhece. Dois ataques seguidos antes de recuperar a vida podem matar.

## Coleta de madeira e pedra no mapa

Ordem "coletar": tropas e civis sem trabalho cortam árvores (floresta) ou quebram pedra (colina, montanha) num hexágono explorado sem local. Ritmo do grupo = 12 × pessoas^0.8 por hora, até 6 pessoas por hexágono. Um civil leva 10 (um soldado, a carga da unidade). Cada hexágono guarda 60 e se recupera inteiro em 8 h.

| Grupo | Por hora | Por pessoa | Hexágono de 60 acaba em |
|---|---|---|---|
| 1 pessoa | 12 | 12 | 13 h 20 min |
| 2 pessoas | 20.9 | 10.4 | 4 h 29 min |
| 4 pessoas | 36.4 | 9.1 | 2 h 5 min |
| 6 pessoas | 50.3 | 8.4 | 1 h 24 min |

Um trabalhador de local nível 2 rende 11.7/h. A coleta vale para quem está sem trabalho (o reino novo tem 4 civis sem vaga) e para tropas paradas; não substitui os locais, que rendem mais por pessoa a partir do nível 3.

### Começo (primeiras 4 h)

Jogador de olho no jogo: sempre que a fila fica livre, começa a melhoria mais barata que pode pagar. Com coleta, os civis sem trabalho cortam madeira e a guarnição inicial quebra pedra a 3 hexágonos do castelo. Sem carregadores nem crescimento da população.

| Tempo de jogo | Sem coleta: níveis subidos · castelo · nível médio | Com coleta: níveis subidos · castelo · nível médio · coletado |
|---|---|---|
| 20 min | 6 · 4 · 3 | 6 · 4 · 3 · 29 |
| 40 min | 7 · 4 · 3.3 | 10 · 4 · 4 · 57 |
| 1 h | 8 · 4 · 3.5 | 10 · 4 · 4 · 86 |
| 2 h | 10 · 4 · 4 | 10 · 4 · 4 · 172 |
| 4 h | 10 · 4 · 4 | 15 · 5 · 5 · 312 |

Castelo nível 5: sem coleta depois de 4 h; com coleta em 2 h 11 min. Os primeiros níveis são baratos e rápidos (40 s a 5 min); o que segura o começo é madeira e pedra, e a coleta resolve.

## Metas verificadas

| | Meta | Resultado | |
|---|---|---|---|
| M1a | Kit inicial recruta 2 a 3 lanceiros na primeira sessão | 3 | ✓ |
| M1b | Os lanceiros do kit ficam prontos em até 15 min (a primeira sessão tem o que fazer) | 12 min | ✓ |
| M1c | Reino novo começa com tropas que caçam o perigo baixo ilesas e exploradores prontos (nada de esperar a primeira hora) | 190 de força · 3 exploradores | ✓ |
| M2a | Primeira melhoria se paga em até 2 h | 1.9 h | ✓ |
| M2b | Melhoria para o nível 11 se paga em 1 a 2 semanas (investimento de fim de temporada) | 8.1 dias | ✓ |
| M3a | Obra para o nível 2 leva até 40 s | 40 s | ✓ |
| M3b | Obra para o nível 11 leva de 2 a 6 h | 5 h 41 min | ✓ |
| M3c | 10 obras de nível 7 a 9 cobrem a noite (7 a 14 h) | 8 h 18 min | ✓ |
| M4a | Vizinho do próprio reino (6 hex.) em até 40 s, tropa lenta | 20 s | ✓ |
| M4b | Reino vizinho (72 hex.) entre 3 e 7 min, tropa lenta | 4 min | ✓ |
| M4c | Travessia do mapa (312 hex.) em até 30 min, tropa lenta | 18 min | ✓ |
| M5a | Jogador médio com 4 a 10 soldados e 15 a 25 pessoas no fim do escudo (dia 3) | 7 · 21 | ✓ |
| M5b | Jogador médio com 20 a 30 soldados e 50 a 80 pessoas no dia 35 | 23 · 66 | ✓ |
| M5c | Jogador ativo com 1,5 a 2,5× as tropas do médio no dia 35 | 2.3× | ✓ |
| M5d | Recrutar não derruba a economia do médio (eficiência ≥ 90% no dia 35) | 100% | ✓ |
| M5e | Sem guerra, o ativo chega ao máximo da economia perto do dia 20 (entre os dias 17 e 24) | dia 20 | ✓ |
| M5f | Sem guerra, o médio chega ao máximo depois do ativo, entre os dias 24 e 40 | dia 26 | ✓ |
| M5g | Teto prático de um reino: o ativo termina a temporada com 90 a 140 pessoas | 126 | ✓ |
| M6 | 6 cavaleiros levam pelo menos 40 min de produção de um local nível 6 (o saque vale a viagem de ≈ 2 min) | 1 h 48 min | ✓ |
| M7a | Local defendido cai com cerca de 1,5× a força (arqueiros contra lanceiros) | 2× | ✓ |
| M7b | Torre muda o resultado do mesmo ataque | defesa vence | ✓ |
| M7c | Castelo médio (nível 10, com guarnição) resiste a 20 tropas e cai com cerca de 2× isso num exército de cerco | resiste (0.3×) / cai (1.1×) | ✓ |
| M7d | Castelo nível 8 sem guarnição aguenta 6 a 10 tropas de reino novo sem máquinas de cerco (e 10 cavaleiros contra 2 lanceiros) | 0.3× · 0.5× · 0.5× | ✓ |
| M7e | O mesmo castelo aguenta 20 tropas sem máquinas e cai para um exército de cerco de 20 (o dobro dos 10) | resiste (0.9×) / cai (1.3×) | ✓ |
| M7f | A defesa própria do castelo cresce com o nível e vale menos que a guarnição do médio: no nível 11, 5 arqueiros na menagem e portões básicos 2 | 375 < 920 | ✓ |
| M8 | Relíquia de produção vale menos que 1 nível do local (nível 6) | 5 < 10 | ✓ |
| M9 | Tática média recua com 40% e ainda causa perdas na defesa | 9% na defesa | ✓ |
| M10 | Bônus somados ficam no teto de +50% (sem teto: +84% / +89%) | 50% | ✓ |
| M11 | Armas ou armaduras nível 1 só compensam a partir de 10 a 30 tropas da família | 13 a 25 | ✓ |
| M12 | Ferraria completa custa 3% a 17% do gasto em obras do médio na temporada (um terço do que pesava antes: a produção triplicou) | 7% | ✓ |
| M13 | Extrair valiosos rende por pessoa 1,5 a 3× um trabalhador de local nível 6 (4 lanceiros) | 1.7× | ✓ |
| M14 | O ouro da Era do Aço sai em 1 a 4 h com 4 lanceiros, sem posto | 1 h 24 min | ✓ |
| M15 | Ouro e aço no mapa cobrem 90% a 150% da demanda típica (escassos, motivo de disputa) | 101% / 96% | ✓ |
| M16 | Era do Aço custa 30 min a 1 h 20 de produção do médio no dia 4; Era do Cerco, 1 h a 2 h 40 no dia 7 (sem o ouro) | 51 min / 1 h 47 min | ✓ |
| M17 | Curar um ferido custa 25% a 60% de recrutar um lanceiro | 44% | ✓ |
| M18 | Equipamento lendário vale no máximo 3 tropas | 2 tropas | ✓ |
| M19 | Cavaleiro de elite: mais ataque por pessoa e menos por valor que a cavalaria | 60 > 45 · 24 < 26.5 | ✓ |
| M20 | Reino sob escudo recebe no máximo 30% do que ele mesmo produz no escudo | 16% | ✓ |
| M21 | Depois de perder o castelo no dia 35, o médio volta ao nível anterior em 0,5 a 3 dias | 2.3 dias | ✓ |
| M22 | Explorador sozinho é atacado em qualquer perigo, mas um ataque só mata no alto: 20% a 50% das vezes a pé, até 25% a cavalo (foge); 2 lanceiros passam ilesos pelo baixo; 12 arqueiros, até pelo alto | 36% / 14% | ✓ |
| M23 | 1 caçada por dia cobre 70% a 150% do couro que o médio usa para recrutar | 100% | ✓ |
| M24 | 20 hexágonos de rota em planície custam 10 min a 1 h de produção do médio no dia 14 | 15 min | ✓ |
| M25 | Espionar um local defendido: 25% a 40% de ser visto; um castelo médio chega ao máximo | 35% / 60% | ✓ |
| M26 | Sem coleta, o reino novo sobe pelo menos 6 níveis na primeira hora | 8 níveis | ✓ |
| M27 | Com coleta, sobe pelo menos 8 níveis nos primeiros 40 min e chega ao castelo 5 em até 2 h 40 | 10 níveis · 2 h 11 min | ✓ |
| M28 | Coleta rende por pessoa 0,8 a 1,5× um trabalhador de local nível 2 (vale para quem está sem trabalho, sem substituir os locais) | 1× | ✓ |
| M29 | Um hexágono com 4 coletores se esgota em 1 h a 2 h 40 e se recupera inteiro em 4 a 12 h | 2 h 5 min · 8 h | ✓ |
| M30 | A vida volta inteira em 1 h 20 a 2 h 40; um ataque do perigo alto não mata ninguém de um grupo de lanceiros | 2 h · golpe até 105 < 110 | ✓ |
| M31 | Batalha sem tempo fixo: 50 contra 1 acaba em até 30 s; 20 contra 20 leva de 3 a 6 min; nenhuma passa de 10 min | 20 s · 4 min 20 s · 10 min | ✓ |
| M32 | A reserva da IA em casa (castelo × 0,5, até o perfil defensivo) cabe nas tropas do médio e ainda sobra tropa para sair (dias 3, 7, 14 e 35) | 6 de 7 · 7 de 10 · 8 de 13 · 9 de 23 | ✓ |

Todas as metas no alvo.
