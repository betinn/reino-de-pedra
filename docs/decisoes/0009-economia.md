# 0009 — Produção sob demanda, checkpoint horário, excedente ao armazém

**Decisão.**
- Estoque = estoque anterior + taxa × tempo, calculado quando alguém olha ou age (`Economia.Atualizar`). Um evento por reino a cada hora faz um checkpoint (população e eficiência mudam continuamente; o erro fica limitado a 1 h).
- População: solução fechada da logística no intervalo, com teto livre = teto − tropas e +30% com sobra de comida (mesma regra do modelo: produção de comida > 2× a do castelo).
- Trabalhadores contam só nos locais de produção (como no modelo); a eficiência vale para eles, não para o castelo.
- Cada local guarda 10 h da própria produção. O excedente vai, na hora, para o armazém de maior nível e depois para o castelo, até a capacidade deles (abstração: não gera marcha).
- O castelo guarda por recurso o maior entre `estoqueMinimo` (2.000) e 10 h da produção dele; o armazém guarda `capN1 × capCresc^(L−1)` por recurso.

**Por quê.** Nenhum tique global; custo proporcional a quem está ativo. O excedente instantâneo evita milhares de marchas pequenas sem mudar o que o jogador sente (o armazém enche).

**Revisão (população e obras).**
- População civil abaixo de `P.popSemente` cresce em linha (`crescPop × popSemente` pessoas por hora, com os mesmos multiplicadores) até chegar a ela, e daí segue a logística (`Economia.Logistica(..., semente)`, ainda fechada no intervalo). Sem isso, a logística parte de 0 e fica em 0 para sempre: recrutar toda a população travava o reino. O modelo não usa o mínimo (a simulação nunca chega perto dele), então as tabelas não mudam.
- `ObraNivel.Concluir` sobe no máximo um nível (até `NivelAlvo`) e recusa passar do castelo no momento em que termina (o material fica no local, com aviso). A trava só no enfileiramento deixava a sabotagem ser desfeita por um item já pago e um local acima de um castelo sabotado.
