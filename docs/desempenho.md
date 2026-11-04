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
