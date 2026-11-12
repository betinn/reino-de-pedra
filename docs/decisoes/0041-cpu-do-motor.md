# 0041: CPU do motor com o mundo cheio: buscas de caminho baratas, motor em fatias e relógio que retoma do save

Corrige o que a [0040](0040-servidor-native-aot.md) disse sobre a CPU e completa a [0032](0032-serraria-e-ataque-de-tropa-em-campo.md) (relógio acelerado). Números em [desempenho.md](../desempenho.md#cpu-do-motor-com-o-mundo-cheio).

## Contexto

A medida do Native AOT mostrou o processo usando de 0,4 a 1 núcleo com o save de 30 reinos, em qualquer ritmo de jogo, no JIT e no AOT. O teste de carga, com o mesmo mundo, media 5 s de CPU por dia de jogo. O orçamento é ≈ 12,5% de um núcleo, numa máquina dividida com outros projetos. A diferença não tinha explicação.

O jogo não muda: nenhuma regra, nem o formato do save, nem a API.

## O que era

**1. O servidor corria atraso; não era o custo de regime.** O save do teste de carga fica em janeiro de 2026, a data do relógio falso dos testes. `RelogioReal.RetomarEm` só retomava de um save à frente da hora real. Com o save atrás, o relógio ficava na hora de hoje, mesmo com `REINO_ACELERACAO=1.0001`, e o motor executava de uma vez dez meses de eventos, com uma virada de temporada no meio. Repetido com o binário de antes: 100% de um núcleo por 7,5 minutos e, com o atraso recuperado, 0,2%. O teste de carga estava certo.

**2. O custo de cada evento era alto sem necessidade.** Isso não estourava o orçamento no ritmo real, mas era 3,5× o necessário, e é o tempo que o servidor leva para recuperar um período fora do ar:

- `Caminhos.MinutosAte` rodava um Dijkstra no mapa inteiro (74.880 hexágonos, 16 ms) a cada requisição de material, só para ordenar meia dúzia de locais do reino por distância. Era 68% da CPU do teste de carga.
- `Caminhos.Calcular` (A*) alocava e zerava duas grades do tamanho do mapa a cada busca: 900 KB novos por chamada, direto no heap de objetos grandes, e uma coleta completa do GC a cada 16 buscas, em média.

**3. Recuperando atraso, o motor deixava os comandos esperando.** Ele executava até 5.000 eventos vencidos antes de olhar a fila de comandos, e de novo depois de cada comando. Um pedido da API esperava segundos.

**4. O teste de carga não rodava o servidor.** Ele avança um relógio falso de evento em evento: mede o custo dos eventos, mas não o motor, o relógio real nem a gravação. E o limite de CPU dele (43 s por dia de jogo) tinha 8× de folga: o custo podia dobrar sem o teste acusar.

## Decisão

**Buscas de caminho sem varrer nem zerar a grade.**

- Cada mundo guarda um rascunho de busca (`Caminhos.Rascunho`): as grades de distância e de caminho, a fila de prioridade e uma marca por hexágono. A distância de um hexágono só vale se a marca dele é a da busca em curso, então começar uma busca é trocar um número, sem tocar na grade. Uma busca dentro de outra (ou de outra thread) pega um rascunho novo.
- `MinutosAte` recebe os alvos e para quando alcança o último. O custo passa a ser a área até o alvo mais distante.
- O que não muda de um hexágono para outro (rotas, pontes, fatores de terreno, velocidade) é lido uma vez por busca, e os vizinhos saem sem alocar (`Grade.Vizinhos(h, saida)`).
- Os caminhos e os minutos são os mesmos de antes, bit a bit: `CaminhosTestes` compara com a busca escrita do jeito simples.

**Requisição: só entra na conta quem tem o que falta.** `Logistica.EnviarDosProximos` ordena por distância só os locais com estoque de algum recurso pedido. Com uma origem só, não há busca. A ordem das origens e o que cada uma manda não mudam.

**Motor em fatias.** O motor executa eventos vencidos por no máximo 25 ms seguidos (`Motor.Fatia`) e então atende os comandos. Em dia, nada muda: os eventos vencidos cabem numa fatia. Com atraso, um comando espera uma fatia, não o atraso. `Motor.AtrasoMs` diz quanto tempo de jogo falta recuperar e `Motor.Ocupado`, quanto o motor trabalhou. O log avisa quando a recuperação passa de 2 s (`motor atrasado: ... h de jogo para recuperar`) e quando termina (`motor em dia: N eventos em S s`).

**O relógio acelerado retoma do save também para trás.** Com `REINO_ACELERACAO` diferente de 1, o relógio do mundo já não era a hora real; agora ele continua de onde o mundo parou, esteja o save à frente ou atrás de hoje. Sem aceleração nada muda: o relógio é a hora real e o servidor recupera o tempo em que ficou fora do ar. Só afeta o desenvolvimento local e a medição.

**O teste de carga roda o servidor de verdade.** Depois da simulação, o mesmo save sobe num servidor completo (Kestrel, motor, gravação) com relógio de parede, e o teste afirma:

- no ritmo real, o motor fica ocioso (menos de 5% ocupado; o medido é 0,001%) e o processo, dentro do orçamento;
- 720× mais rápido, o motor acompanha o jogo e fica dentro do orçamento;
- com um dia de jogo de atraso, o motor recupera em menos de 30 s e nenhum comando espera mais de 0,4 s.

O que segura o custo dos eventos é uma medida igual em qualquer máquina: `Mundo.HexesBuscados`, os hexágonos visitados pelas buscas de caminho. O teste afirma menos de 3 milhões por dia de jogo (o medido é 640 mil; com uma busca no mapa inteiro por requisição eram 16 milhões). O limite de CPU caiu de 43 para 8 s por dia de jogo.

## Consequências

- **Busca nova no mapa** usa `Caminhos` e diz até onde precisa ir. Varrer a grade num evento estoura o limite de hexágonos do teste de carga, em Debug ou em Release.
- **Medir o servidor com um save:** `REINO_ACELERACAO=1.0001` retoma do instante do save e mede o ritmo real. Com 1 exato, o servidor recupera o tempo desde o save, e o log diz quanto.
- **Os números de CPU da 0040 e da seção Native AOT de `desempenho.md` eram de um servidor recuperando atraso**, e os de memória foram tomados sob essa mesma carga. A comparação entre JIT e AOT continua valendo; o valor absoluto de CPU, não.
- **O que sobra de custo** é a sessão de IA (2 ms, a maior parte em mandar exploradores, construir e caçar), a chegada de marchas e a varredura de 5 minutos do banco (0,3 a 0,5 s de CPU a cada 5 minutos, a maior parcela do processo ocioso). Nada disso pesa no orçamento; fica anotado para o caso de o mundo crescer.
