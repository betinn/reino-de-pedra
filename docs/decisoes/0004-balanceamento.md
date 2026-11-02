# 0004 — Números do jogo gerados do modelo

**Decisão.** `node balanceamento/modelo.js --json > balanceamento/config.json` exporta `P`, `U`, `VEICULOS` e valores de referência calculados pelas fórmulas do modelo. O servidor carrega esse arquivo (classe `Balanceamento`) e as fórmulas em `Formulas.cs` reproduzem as do modelo linha a linha.

**Por quê.**
- Uma única fonte de verdade: mudar um número é mudar o modelo, rodar, conferir as metas e regenerar o `config.json`.
- Os testes comparam cada fórmula do servidor com os valores de referência do modelo e falham se o `config.json` estiver desatualizado.
- Parâmetros que só o servidor usa (capacidade do armazém, carregador, vau, raios de visão) também entraram em `P`, com comentário, sem mudar as tabelas.
