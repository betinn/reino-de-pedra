# 0002 — Mundo inteiro na memória, motor em série, eventos agendados

**Decisão.** O estado do mundo (reinos, locais, marchas, eventos...) fica todo na memória, num objeto `Mundo`. Uma única tarefa, o `Motor`, executa em série os eventos vencidos e os comandos da API. Tudo que acontece no futuro é um `Evento` numa fila de prioridade por horário.

**Por quê.**
- 30 reinos cabem em poucos MB. Ler da memória é ordens de grandeza mais barato que consultar o banco a cada ação.
- Um dono só para o estado elimina travas e condições de corrida nas regras (combate, saque, interceptação).
- O motor só acorda quando há comando ou evento vencido (no máximo 1×/s para gravar): não há tique varrendo o mundo, como pede a restrição de desempenho.
- Durante um evento, `m.Agora` é o instante do evento: se o servidor ficar fora do ar, ao voltar ele executa o atraso em ordem e o resultado é o mesmo.
