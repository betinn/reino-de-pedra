# 0012 — Tropas: recrutamento, exércitos em campo e interceptação

**Decisão.**

- **Recrutamento** usa a fila `recrutamento` do reino (item `recrutar`, `Param` = unidade, `Qtd`), com a requisição automática do material até o local. A população civil sai na hora de enfileirar (volta se o item for cancelado, via `ITipoItemFila.Cancelado`) e as tropas em treino ocupam o teto (`Economia.OcupantesExtras`). O castelo treina as unidades de `P.recrutaCastelo`; o quartel, todas. Cada tipo de unidade pedido vira um item da fila.
- **Requisitos de unidade** (`U.req`, ex.: "Era do Aço") bloqueiam até que algum sistema diga que o reino os cumpre (`Recrutamento.ReqCumprido`). Bloqueios extras entram em `Recrutamento.Requisitos`.
- **Exército** é uma `Marcha` com uma ordem (`IOrdemExercito`, registrada por reflexão). Ao chegar, a ordem decide: entrar num local (`EntrarNoLocal`) ou ficar parado (`Parar`: sem evento, continua no mapa e aceita nova ordem). Velocidade = a da unidade mais lenta; carga = soma de `U.carga`.
- **Retornar** vai ao local de origem; se ele caiu ou virou ruína, ao local próprio mais próximo em tempo de viagem. A carga vai para o estoque do local de chegada.
- **Mover** não aceita como destino um local de outro reino (isso é ataque, do combate); num local próprio vira reforço.
- **Milícia** (`so: defesa`) pode mudar de local e ficar em campo; quem impede o ataque com ela é o combate.
- **Interceptação**: quem perde no caminho (`Marcha.AoSerVencida`) entrega a carga ao vencedor até a capacidade livre dele (o resto se perde, na proporção de cada recurso) e todas as relíquias. Carregadores roubados fazem a obra pedir de novo o que se perdeu (`Logistica.Repor`).
- **Posturas**: "aplicar a todas" vale para as guarnições; os exércitos em campo têm a opção própria (`todosExercitos`).

**Por quê.** A fila e a requisição já existiam: o recrutamento reaproveita as duas e herda espera de material, cancelamento e transporte visível. Exército parado sem evento mantém a regra de não haver tique. Ordens e requisitos por gancho deixam combate, eras, caça, extração e escolta crescerem sem mexer no núcleo.
