# Desempenho

O servidor precisa caber num servidor pequeno: o orçamento de projeto é ≈ 12,5% de um núcleo e 1 GB de memória com o mundo cheio (30 reinos). O mundo fica na memória, só o motor mexe nele e nada varre o mundo: tudo o que acontece no futuro é um evento ([0002](decisoes/0002-mundo-em-memoria.md)).

## Teste de carga

`servidor/testes/Testes/CargaIATestes.cs` (traço `Categoria=carga`, roda junto com `dotnet test`): 30 reinos (25 de IA e 5 jogadores simulados), com fauna, por dias de jogo, avançando o relógio falso evento a evento. `REINO_CARGA_DIAS` muda a duração (padrão 10). Depois da simulação, o mesmo save sobe num servidor de verdade (Kestrel, motor, gravação) com relógio de parede: no ritmo real, 720× mais rápido e com um dia de jogo de atraso ([CPU do motor com o mundo cheio](#cpu-do-motor-com-o-mundo-cheio)). Para rodar só ele:

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

Limites afirmados no teste nessa época: menos de 43 s de CPU por dia de jogo (0,05% de um núcleo), pico de memória gerenciada abaixo de 400 MB e banco abaixo de 64 MB. Os de hoje são mais apertados e estão em [CPU do motor com o mundo cheio](#cpu-do-motor-com-o-mundo-cheio).

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

## Native AOT

O servidor publicado passou de JIT (self-contained, arquivo único) para Native AOT, com JSON gerado na compilação e o GC para pouca memória embutido ([0040](decisoes/0040-servidor-native-aot.md)). As medidas são do processo publicado em Release, servindo de verdade, com o save do teste de carga: 30 reinos (25 de IA), 10 dias de jogo, 8 486 documentos e 6 MB de banco. As medidas foram feitas no Windows, na máquina de desenvolvimento (x86-64 de 2,1 GHz), porque não há WSL nem Docker nela; no Linux os números absolutos mudam, mas a comparação vale.

Como repetir: `REINO_CARGA_BANCO=<arquivo>` faz o teste de carga guardar uma cópia do banco. Suba o binário com `REINO_DADOS` numa pasta com essa cópia como `reino.db`. A memória é amostrada a cada 5 s: a privada e o working set, o que o sistema conta para o processo. O ritmo real foi medido com `REINO_ACELERACAO=1.0001`.

**As linhas de CPU desta seção são de um servidor recuperando atraso, não em regime.** Na época, o relógio acelerado só retomava de um save à frente da hora real, e o save do teste de carga é de janeiro de 2026: em todas as medidas o servidor subiu na hora de hoje e passou o tempo executando meses de eventos. A memória foi medida sob essa mesma carga. A comparação entre JIT e AOT vale; o valor absoluto de CPU, não. A medida certa está em [CPU do motor com o mundo cheio](#cpu-do-motor-com-o-mundo-cheio): em regime, o servidor AOT com este save usa 0,03% de um núcleo, com 68 MB de memória privada e 87 MB de working set.

**Antes e depois**, com o jogo 720× mais rápido, por 8 minutos:

| | JIT (antes) | AOT, GC padrão | AOT como publicado (`ConserveMemory` 7, teto 256 MB) |
|---|---|---|---|
| Partida até a primeira resposta | 1,53 s | 0,56 s | 0,57 s |
| Memória privada, média / máxima | 100 / 114 MB | 80 / 91 MB | 62 / 94 MB |
| Working set, média / máximo | 166 / 182 MB | 100 / 111 MB | 82 / 111 MB |
| Working set, pico | 195 MB | 165 MB | 121 MB |
| CPU (fração de um núcleo) | 74% | 79% | 100% (saturado) |
| Executável | 105 MB | 34 MB | 34 MB |

**No ritmo real** (1,0001×, 3 minutos) e a 60× (5 minutos):

| | JIT | AOT, GC padrão | AOT, `ConserveMemory` 7 | AOT, `ConserveMemory` 5 |
|---|---|---|---|---|
| 1×: privada, média | 92 MB | 73 MB | 56 MB | 69 MB |
| 1×: working set, média / pico | 157 / 187 MB | 93 / 165 MB | 76 / 120 MB | 89 / 137 MB |
| 1×: CPU | 61% | 83% | 82% | 89% |
| 60×: privada, média | 93 MB | 78 MB | 60 MB | — |
| 60×: working set, média / pico | 158 / 187 MB | 98 / 166 MB | 81 / 121 MB | — |
| 60×: CPU | 42% | 50% | 76% | — |

Outras variantes do binário publicado, a 720× por 4 minutos:

- **Teto de 128 MB** (`DOTNET_GCHeapHardLimit=8000000`): o mundo cheio rodou sem erro e com a mesma memória (privada média 67 MB). O teto limita, não economiza.
- **Gen0 de 4 MB** (`DOTNET_GCgen0size=400000`): a mesma média (62 MB de privada) e um pico de working set menor (107 MB contra 121 MB). Fica como ajuste opcional.

O que os números dizem:

- **Memória.** O AOT tira cerca de 20 MB de memória privada e 60 MB de working set. O JIT, os metadados de reflexão e o código compilado em tempo de execução saem do processo. O `ConserveMemory` 7 tira mais 15 a 20 MB de privada e corta o pico da carga do save, de 165 para 120 MB. No ritmo real, o servidor como publicado fica em 56 MB de privada e 76 MB de working set, contra 92 e 157 MB do JIT.
- **Partida.** Cai de 1,5 s para 0,55 s, quase só a leitura do save.
- **CPU.** O AOT gasta mais que o JIT: de 7% a mais (720×) a 35% a mais (1×). Ele perde a otimização guiada por perfil do JIT. O `ConserveMemory` 7 compacta mais vezes e, sob carga, soma CPU: a 60×, de 50% para 76%. No ritmo real a diferença ficou dentro do ruído.
- **A CPU alta era atraso.** Com este save, o processo usou de 0,4 a 1 núcleo em qualquer ritmo de jogo, no JIT e no AOT, e uma amostragem do processo JIT (`dotnet-trace`, 25 s) mostrou a thread do motor ocupada o tempo todo em `Filas.Avaliar → Filas.Reservar → Logistica.EnviarDosProximos` e nas sessões de IA (`Governo.Decidir`, `Caminhos.Calcular`). O motor estava executando meses de eventos atrasados; logo depois da subida (a 60×), os primeiros pedidos do feed esperaram de 4 a 13 s na fila dele. A explicação e a correção estão na seção seguinte.

## CPU do motor com o mundo cheio

A medida do Native AOT acima deu de 0,4 a 1 núcleo com o save de 30 reinos, contra 5 s de CPU por dia de jogo no teste de carga. A [0041](decisoes/0041-cpu-do-motor.md) explica a diferença e corta o custo que havia.

As medidas são da mesma máquina (x86-64 de 2,1 GHz, Windows) e do mesmo save: 30 reinos (25 de IA), 10 dias de jogo, 8 615 documentos, 6 MB de banco. O processo é o servidor em Release com JIT, salvo onde diz AOT. A CPU é o tempo de processador do processo dividido pelo tempo de relógio, amostrada a cada 10 ou 20 s. Um pedido a `/saude` e um ao feed (`/publico/vivo`) a cada amostra entram na conta.

**De onde vinha a CPU alta.** O save do teste de carga fica em janeiro de 2026, a data do relógio falso dos testes. O relógio só retomava de um save à frente da hora real. Com o save atrás, o servidor subia na hora de hoje, mesmo com `REINO_ACELERACAO=1.0001`, e executava dez meses de eventos de uma vez, com uma virada de temporada no meio. O binário de antes, medido como na seção anterior, por minuto de relógio:

| Minuto | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CPU (fração de um núcleo) | 106% | 97% | 99% | 100% | 98% | 94% | 95% | 56% | 0,1% | 0,1% | 0,6% | 0,0% | 0,0% |

Foram 447 s de CPU para recuperar o atraso. Em dia, o processo gastou 0,5 s de CPU em 5 minutos: 0,17% de um núcleo, e 0,34 s disso foram a varredura do banco, que roda a cada 5 minutos. O teste de carga estava certo. As medidas do servidor, de 3 a 8 minutos cada, passaram o tempo todo, ou quase todo, recuperando atraso.

**Antes e depois.** Nas linhas do servidor no ritmo real e a 720×, "antes" é o código anterior só com o relógio corrigido, para os dois retomarem do save. Na do save de janeiro, os dois sobem com o relógio de hoje.

| | Antes | Depois |
|---|---|---|
| Teste de carga (10 dias, Release): CPU por dia de jogo | 5,13 s | 1,44 s |
| Teste de carga: CPU por evento (sessões de IA incluídas) | 634 µs | 179 µs |
| Teste de carga: sessão de IA | 6,97 ms | 1,97 ms |
| Teste de carga: pico de memória gerenciada | 63,5 MB | 31,1 MB |
| Servidor no ritmo real, 5 min: CPU | 0,26% | 0,35% |
| Servidor a 720×, 4 min: CPU | 6,1% | 1,65% |
| Servidor a 720×: pior resposta do feed | 856 ms | 63 ms |
| Save de janeiro com o relógio de hoje (10 meses de atraso): CPU até ficar em dia | 447 s | 110 s |
| Recuperando esse atraso: pior resposta do feed | 1 467 ms | 49 ms |
| Servidor AOT como publicado, ritmo real, 5 min: CPU | não medido | 0,03% |

Por tipo de evento, no teste de carga de 5 dias (Release):

| | Vezes | Antes | Depois |
|---|---|---|---|
| Fim de item de fila (com a requisição do próximo) | 1 450 | 9,3 ms | 0,9 ms |
| Sessão de IA | 1 060 | 7,3 ms | 2,7 ms |
| Chegada de marcha | 8 000 | 408 µs | 227 µs |
| Coletas completas do GC (geração 2) no teste | | 639 | 9 |
| Hexágonos visitados pelas buscas, por dia de jogo | | mais de 16 milhões | 0,6 milhão |

O que os números dizem:

- **No ritmo real, o mundo cheio já custava quase nada, e continua assim.** 0,26% e 0,35% são a mesma coisa: quase tudo é a medição (dois pedidos a cada 10 s) e a varredura do banco. O binário AOT como publicado, sem JIT, ficou em 0,03% de um núcleo (0,08 s de CPU em 4,5 minutos), com 68 MB de memória privada e 87 MB de working set. O orçamento é 12,5%.
- **O custo que existia era por evento.** 68% da CPU do teste de carga estava num Dijkstra do mapa inteiro (16 ms) a cada requisição de material, e cada busca de caminho alocava 900 KB. Isso pesa quando há muito evento para executar de uma vez: jogo acelerado, ou servidor que ficou fora do ar. O teste de carga caiu de 5,13 para 1,44 s por dia de jogo, o servidor a 720× de 6,1% para 1,65% e os dez meses de atraso de 447 para 110 s.
- **Recuperando atraso, o servidor agora responde.** O motor executa eventos vencidos por 25 ms e atende os comandos. Com dez meses de atraso, o pior pedido do feed esperou 49 ms (antes, 1,5 s; na medida do AOT, de 4 a 13 s logo depois da subida).
- **Um dia de servidor fora do ar** custa perto de 1 s de CPU para recuperar (o teste de carga mede: 7 600 eventos em 0,8 s, pior resposta a um comando de 27 ms).

Como repetir: `REINO_CARGA_BANCO=<arquivo>` faz o teste de carga guardar uma cópia do banco. Suba o binário com `REINO_DADOS` numa pasta com essa cópia como `reino.db` e `REINO_ACELERACAO=1.0001`: o relógio retoma do instante do save e o jogo anda no ritmo real. Com `REINO_ACELERACAO=1` exato, o relógio é o de hoje e o servidor primeiro recupera o tempo desde o save; o log diz quanto (`motor atrasado: ... h de jogo para recuperar`) e quando acabou (`motor em dia: N eventos em S s`). Meça a CPU depois disso.

Limites afirmados no teste de carga: menos de 3 milhões de hexágonos visitados pelas buscas de caminho por dia de jogo (igual em qualquer máquina, em Debug ou em Release), menos de 8 s de CPU por dia de jogo (o medido é 1,4 s em Release e 2,7 s em Debug), pico de memória gerenciada abaixo de 400 MB e banco abaixo de 64 MB. Com o servidor de verdade no mesmo save: motor menos de 5% ocupado no ritmo real e processo dentro do orçamento, motor em dia e dentro do orçamento a 720×, e um dia de jogo de atraso recuperado em menos de 30 s sem nenhum comando esperar mais de 0,4 s.

## Cliente: a Vista com muita gente

**Medidor na tela.** Ctrl + Shift + F liga e desliga, no canto de cima à esquerda, a taxa de quadros que o monitor está mostrando de verdade, o alvo (30 ou 60), o custo médio do quadro e quantas figuras há nele. É a forma de conferir o desempenho na máquina de quem joga: num painel de navegador oculto ou coberto o navegador segura os quadros (perto de 1 por segundo), e a medida de lá não vale.

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
