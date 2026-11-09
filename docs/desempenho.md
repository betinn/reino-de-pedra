# Desempenho

O servidor precisa caber num servidor pequeno: o orçamento de projeto é ≈ 12,5% de um núcleo e 1 GB de memória com o mundo cheio (30 reinos). O mundo fica na memória, só o motor mexe nele e nada varre o mundo: tudo o que acontece no futuro é um evento ([0002](decisoes/0002-mundo-em-memoria.md)).

## Teste de carga

`servidor/testes/Testes/CargaIATestes.cs` (traço `Categoria=carga`, roda junto com `dotnet test`): 30 reinos (25 de IA e 5 jogadores simulados), com fauna, por dias de jogo, avançando o relógio falso evento a evento. `REINO_CARGA_DIAS` muda a duração (padrão 10). Para rodar só ele:

```
cd servidor && REINO_CARGA_DIAS=35 dotnet test --filter "Categoria=carga" --logger "console;verbosity=detailed"
```

Números medidos (máquina de desenvolvimento x86-64 de 2,1 GHz, um núcleo; detalhes em [0021](decisoes/0021-ia.md)):

| | 10 dias | 35 dias |
|---|---|---|
| Eventos por dia de jogo | 2 500 | 2 579 |
| CPU por dia de jogo | 1,27 s | 1,36 s |
| CPU por evento (sessões de IA incluídas) | 510 µs | 525 µs |
| Sessão de IA | 5,7 ms | 6,6 ms |
| Fração de um núcleo em tempo real | 0,0015% | 0,0016% |
| Memória gerenciada viva no fim | 24 MB | 59 MB |
| Banco | 5,2 MB | 11,8 MB |

Com o mapa de 104 × 80 e as tropas 5× mais rápidas ([0022](decisoes/0022-velocidade-e-mapa-maior.md)), medido de novo em 10 dias (mesma máquina):

| | 60 × 48 (antes) | 104 × 80 (depois) |
|---|---|---|
| Eventos por dia de jogo | 2 453 | 3 619 |
| CPU por dia de jogo | 1,24 s | 2,46 s |
| CPU por evento | 506 µs | 679 µs |
| Sessão de IA | 6,8 ms | 12,3 ms |
| Fração de um núcleo em tempo real | 0,0014% | 0,0028% |
| Pico de memória gerenciada | 38 MB | 116 MB |
| Banco | 5,0 MB | 5,5 MB |

O que cresceu: a revelação da névoa ao vivo (um evento por trecho de caminho que entra em névoa nunca vista) e os caminhos com mais hexágonos respondem pelos eventos a mais; A* e Dijkstra numa grade 2,9× maior, pelo custo da sessão de IA. Tudo segue duas ordens de grandeza abaixo do orçamento.

Com as pessoas como documentos ([0024](decisoes/0024-pessoas.md): cada civil, soldado, explorador e mensageiro é um documento; a escala nova tem dezenas de pessoas por reino), medido de novo em 10 dias (mesma máquina):

| | 104 × 80, tropas como contagem | 104 × 80, pessoas como documentos |
|---|---|---|
| Eventos por dia de jogo | 3 619 | 4 136 |
| CPU por dia de jogo | 2,46 s | 2,06 s |
| CPU por evento | 679 µs | 497 µs |
| Sessão de IA | 12,3 ms | 9,5 ms |
| Fração de um núcleo em tempo real | 0,0028% | 0,0024% |
| Pico de memória gerenciada | 116 MB | 30 MB |
| Documentos no fim | — | 8 330 |
| Banco | 5,5 MB | 4,3 MB |

Os eventos a mais são os deslocamentos de pessoas (nascimentos, trocas de vaga, carregadores que voltam); a memória caiu com a escala ÷10 dos recursos e a população em dezenas (menos tropas, menos marchas). Um reino de 120 pessoas e 30 reinos dão cerca de 3 600 documentos de pessoa, dentro do orçamento.

Com a vida das pessoas e a coleta de madeira e pedra ([0028](decisoes/0028-vida-e-coleta.md)), 10 dias, 30 reinos (25 de IA): 4 786 eventos por dia de jogo (+16%: viagens de coleta da IA e civis voltando para casa), 1,33 s de CPU por dia (278 µs por evento), sessão de IA de 4,8 ms, 0,0015% de um núcleo, pico de 33,8 MB, 9 865 documentos e banco de 4,6 MB. A vida não cria eventos (é calculada quando alguém olha). Castelo médio da IA no dia 10: 8,0.

Limites afirmados no teste: menos de 43 s de CPU por dia de jogo (0,05% de um núcleo), pico de memória gerenciada abaixo de 400 MB e banco abaixo de 64 MB.

Com o mapa de 312 × 240, hexágonos menores e construções em vários hexágonos ([0026](decisoes/0026-mapa-maior-e-bonecos-3d.md)), medido de novo em 10 dias (mesma máquina, testes em Debug):

| | 104 × 80 (antes) | 312 × 240 (depois) |
|---|---|---|
| Eventos por dia de jogo | 3 619 | 5 045 |
| CPU por dia de jogo | 2,46 s | 9,9 s |
| CPU por evento (sessões de IA incluídas) | 679 µs | 1 964 µs |
| Sessão de IA | 12,3 ms | 58 ms |
| Fração de um núcleo em tempo real | 0,0028% | 0,0115% |
| Pico de memória gerenciada | 116 MB | 51 MB |
| Banco | 5,5 MB | 5,4 MB |

O que cresceu: a sessão de IA (A* e Dijkstra numa grade 9× maior, e os alcances da IA em hexágonos 3× maiores) e a revelação da névoa em intervalos de 10 s de jogo. O que caiu: a névoa gravada comprimida (deflate) tirou a cópia em base64 de 4 bytes por hexágono da memória e do banco. Tudo segue três ordens de grandeza abaixo do orçamento; se a sessão de IA virar problema, limitar o Dijkstra ao alcance da decisão é o primeiro passo.

Com tudo junto (mapa de 312 × 240, vida e coleta da [0028](decisoes/0028-vida-e-coleta.md)), 10 dias, 30 reinos (25 de IA), testes em Debug: 5 665 eventos por dia de jogo, 11,1 s de CPU por dia (1 959 µs por evento), sessão de IA de 63 ms, 0,0128% de um núcleo, pico de 64 MB de memória gerenciada, 7 952 documentos e banco de 5,6 MB.

## Cliente: a Vista com muita gente

Com mais quadros por pose (12 no que se mexe, eram 8), a população inteira à vista e a batalha desenhada combatente a combatente, o custo do quadro da Vista foi medido de novo. Medição no navegador embutido, 800 × 600, zoom 1,5, sprites já prontos, chamando o quadro direto (o painel estava oculto: é o custo de montar e desenhar o quadro em JavaScript; a taxa de quadros real na tela não foi observada).

| Cena | Itens no quadro | Mediana | p90 | p99 |
|---|---|---|---|---|
| Reino novo: castelo com 17 pessoas, 4 locais | 101 | 1,8 ms | 6,3 ms (quadros que geram sprite) | — |
| Carga: 14 marchas de 8 figuras, castelo com 72 pessoas, 4 locais com 7 cada | 401 | 3,9 ms | 4,7 ms | 7,1 ms |

- O laço mira 60 quadros por segundo enquanto o custo médio fica abaixo de 6,5 ms e volta a 30 (o piso de antes) acima de 10,5 ms. `RP.Cena.medida()` mostra o custo médio, a taxa e o tamanho do cache.
- O cache de sprites 3D guarda até 960 figuras (640 em tela densa). Na cena de carga ele enche; quem fica sem uso sai. A geração de sprites gasta no máximo 7 ms por quadro; sem tempo, vale o quadro pronto mais perto da mesma figura.
- As aparências (pele, cabelo, barba, calça) saem de 8 variantes por semente, para muita gente dividir as mesmas figuras. Fase e ritmo continuam por pessoa: custam zero sprites.

Marcha de outro reino (o feed traz só o hexágono atual e o próximo, a cada 2,5 s), 24 s de caminhada a 50 quadros por segundo:

| | Posição exata | Posição desenhada |
|---|---|---|
| Tropa lenta (3,4 s por hexágono): quadros parada | 43% | 0% |
| Tropa lenta: maior salto num quadro | 18,8 (0,7 hexágono) | 0,37 |
| Cavalaria (1,35 s por hexágono): quadros parada | 74% | 4% (só a chegada) |
| Cavalaria: maior salto num quadro | 50,9 (2 hexágonos) | 0,94 |
