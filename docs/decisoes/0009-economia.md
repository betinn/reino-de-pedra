# 0009 — Produção sob demanda, checkpoint horário, excedente ao armazém

**Decisão.**
- Estoque = estoque anterior + taxa × tempo, calculado quando alguém olha ou age (`Economia.Atualizar`). Um evento por reino a cada hora faz um checkpoint (população e eficiência mudam continuamente; o erro fica limitado a 1 h).
- População: solução fechada da logística no intervalo, com teto livre = teto − tropas e +30% com sobra de comida (mesma regra do modelo: produção de comida > 2× a do castelo).
- Trabalhadores contam só nos locais de produção (como no modelo); a eficiência vale para eles, não para o castelo.
- Cada local guarda 10 h da própria produção. O excedente vai, na hora, para o armazém de maior nível e depois para o castelo, até a capacidade deles (abstração: não gera marcha).
- O castelo guarda por recurso o maior entre `estoqueMinimo` (2.000) e 10 h da produção dele; o armazém guarda `capN1 × capCresc^(L−1)` por recurso.

**Por quê.** Nenhum tique global; custo proporcional a quem está ativo. O excedente instantâneo evita milhares de marchas pequenas sem mudar o que o jogador sente (o armazém enche).
