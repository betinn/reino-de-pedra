# Decisões técnicas

Cada decisão em poucas linhas: o que foi decidido e por quê. Regras de jogo ficam no `CLAUDE.md`; números, em `balanceamento/`.

| # | Decisão |
|---|---|
| [0001](0001-stack.md) | Servidor em .NET 10 (C#), um único processo |
| [0002](0002-mundo-em-memoria.md) | Mundo inteiro na memória, um motor em série, eventos agendados |
| [0003](0003-sqlite-documentos.md) | SQLite em WAL com documentos JSON gravados em lote |
| [0004](0004-balanceamento.md) | Números do jogo gerados do modelo (`config.json`) |
| [0005](0005-contas-e-sessoes.md) | Contas com e-mail e senha, PBKDF2, sessão por cookie HttpOnly |
| [0006](0006-api-e-tempo-real.md) | API JSON + avisos por SSE, a mesma para web e app |
| [0007](0007-cliente-web.md) | Cliente sem framework e sem build, portado do protótipo |
| [0008](0008-mapa.md) | Mapa gerado por semente; terreno não vai para o banco |
| [0009](0009-economia.md) | Produção sob demanda, checkpoint horário, excedente ao armazém |
| [0010](0010-logistica.md) | Requisição: reserva na hora, carregadores por origem |
| [0011](0011-icone-do-reino.md) | Ícone: brasão sorteado/editável ou imagem própria pequena |
| [0012](0012-tropas.md) | Tropas: recrutamento na fila, exércitos com ordens, interceptação |
| [0016](0016-extracao-e-reliquias.md) | Caravanas em três fases, extração sem tique por jazida, escavação e relíquias com visibilidade por concentração |
| [0017](0017-vista-e-mapa-no-cliente.md) | Vista 2.5D e Mapa tático (Canvas + marcadores SVG) com um modelo e pontos de extensão |
| [0013](0013-combate.md) | Combate: ordem atacar, batalha como documento resolvida pela fórmula, torres como documento |
| [0015](0015-exploracao.md) | Exploração: névoa com foto, fauna por região, exploradores, caça, rotas e espionagem |
| [0013](0013-combate.md) | Combate: ordem atacar, batalha como documento resolvida pela fórmula, torres como documento; parte 2: feridos em lotes, veterania com média ponderada, queda e exílio, combate em campo, interceptação, posturas, avistamentos e modelos |
| [0018](0018-ferraria.md) | Ferraria: fila própria, eras por `ReqCumprido`, bônus por família ponderado pela força, lendário preso a um grupo; sistemas revelados aos poucos |
