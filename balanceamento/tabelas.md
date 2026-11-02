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

Estoque de cada local: até 10 h da própria produção (o que passa disso se perde até alguém buscar). Armazém: guarda o excedente do reino.

Castelo: produz 25/h de cada recurso básico no nível 1 e 69/h no nível 10. Nenhum local passa do nível do castelo. Melhorar o castelo custa 4× e leva 2× o tempo de um local do mesmo nível (nível 10: 17 h 4 min).

## Unidades

| Unidade | Ataque | Defesa | Vence | Velocidade | Carga | Custo | Total | Tempo | Pop. | Ataque/100 rec. | Defesa/100 rec. |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Milícia | 5 | 15 | — | Lenta | 20 | 20 comida, 10 madeira | 30 | 1 min | 1 | 16.7 | 50 |
| Lanceiro | 25 | 40 | Cavalaria | Lenta | 40 | 30 comida, 30 madeira, 30 ferro | 90 | 3 min | 1 | 27.8 | 44.4 |
| Arqueiro | 35 | 25 | Lanceiro | Média | 40 | 30 comida, 50 madeira, 10 couro | 90 | 4 min | 1 | 38.9 | 27.8 |
| Cavalaria | 45 | 30 | Arqueiro | Rápida | 80 | 60 comida, 50 ferro, 30 couro | 140 | 6 min | 1 | 32.1 | 21.4 |
| Aríete | 10 | 10 | torres e portões (40) | Lenta | 0 | 300 madeira, 60 ferro | 360 | 15 min | 4 | 2.8 | 2.8 |
| Trebuchet | 5 | 5 | torres e portões (90) | Lenta | 0 | 600 madeira, 200 pedra, 150 ferro | 950 | 30 min | 6 | 0.5 | 0.5 |

Veículos: carroça 500 (lenta, 150 madeira, 20 ferro); carroção 1500 (média, 400 madeira, 80 ferro, 2 cavalo). Carregador da requisição: 50, a pé.

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
- Escudo de novato 72 h; escudo de exílio 24 h; regência após 48 h sem entrar. Relíquias da temporada (legado): teto somado de 5%. Aliança: até 5 reinos.

## Simulação de uma temporada (70 dias)

### Médio (4 sessões/dia)

| Dia | Produção/h (total) | Locais | Nível médio | Castelo | População / teto | Trabalhadores | Eficiência | Tropas |
|---|---|---|---|---|---|---|---|---|
| 1 | 328 | 4 | 3 | 3 | 279 / 300 | 120 | 100% | 46 |
| 3 | 496 | 4 | 5 | 5 | 302 / 360 | 200 | 99% | 104 |
| 7 | 733 | 5 | 6 | 6 | 575 / 600 | 300 | 100% | 210 |
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
| 14 | 1169 | 8 | 6.4 | 7 | 1251 / 1380 | 510 | 98% | 751 |
| 21 | 1973 | 10 | 7.7 | 8 | 1943 / 1980 | 770 | 100% | 1089 |
| 35 | 3918 | 15 | 9 | 9 | 3408 / 3420 | 1350 | 100% | 1880 |
| 50 | 6004 | 18 | 10 | 10 | 4607 / 4620 | 1800 | 100% | 2540 |
| 70 | 6004 | 18 | 10 | 10 | 4607 / 4620 | 1800 | 100% | 2540 |

Gasto em obras 1377 mil · em tropas 313 mil · economia no máximo (nível médio ≥ 9,5), sem guerra: dia 46.

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

Todas as metas no alvo.
