# 0010 — Requisição: reserva na hora, carregadores por origem

**Decisão.** Ao pôr uma obra (ou recrutamento, forja...) na fila, o servidor confere se o reino inteiro tem o material; se não, recusa sem mexer em nada. Se tem, retira na hora: primeiro do próprio local da obra, depois dos locais mais próximos em tempo de viagem a pé (Dijkstra reverso). Cada origem manda um grupo de carregadores (50 de carga por pessoa, a pé, sem escolta) que anda pelo mapa e pode ser roubado. O item começa quando é o primeiro da fila e todo o material chegou.

- Cancelar: o que já chegou fica no local da obra (ou no castelo, se era um hexágono livre); o que está a caminho chega e fica lá.
- Carregadores não ocupam o teto de população (são trabalho da população, não gente a menos).

**Por quê.** Reservar na hora evita duas obras disputando o mesmo recurso e deixa o jogador ver o custo saindo. Um grupo por origem mantém poucas marchas no mapa.

**Revisão.** O material devolvido (`Filas.DevolverMaterial`: cancelamento, obra de nível que termina num local perdido) só vai para um local do próprio reino que não esteja em ruínas; senão, para o castelo. O cancelamento olhava só se o local existia e entregava o material a quem tinha tomado o local. Leituras de fila por nome (`Cancelar`, `MaterialChegou`, `Concluir`, `TentarIniciar`, `Logistica.Repor`, carregadores) usam `Reino.FilaSe`, que não cria a fila: o nome vem do cliente no `DELETE /filas/{fila}/{item}`, e `Reino.Fila` criava uma entrada (gravada no reino) para qualquer nome. `Reino.Fila` continua criando, só para os nomes dos sistemas.
