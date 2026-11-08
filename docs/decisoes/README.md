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
| [0013](0013-combate.md) | Combate: ordem atacar, batalha como documento resolvida pela fórmula, torres como documento; parte 2: feridos em lotes, veterania com média ponderada, queda e exílio, combate em campo, interceptação, posturas, avistamentos e modelos |
| [0015](0015-exploracao.md) | Exploração: névoa com foto, fauna por região, exploradores, caça, rotas e espionagem |
| [0016](0016-extracao-e-reliquias.md) | Caravanas em três fases, extração sem tique por jazida, escavação e relíquias com visibilidade por concentração |
| [0017](0017-vista-e-mapa-no-cliente.md) | Vista 2.5D e Mapa tático (Canvas + marcadores SVG) com um modelo e pontos de extensão |
| [0018](0018-ferraria.md) | Ferraria: fila própria, eras por `ReqCumprido`, bônus por família ponderado pela força, lendário preso a um grupo; sistemas revelados aos poucos |
| [0019](0019-social.md) | Social: aliança como documento, reforço na guarnição com reserva, cargas entre reinos, propostas, pactos, mensageiros e bandeiras |
| [0020](0020-temporada.md) | Temporada: fim como evento, reset dentro do motor (limpa coleções, mundo novo, apaga e grava o banco), legado por conta em tabela própria, ranking por ganchos de batalha, "precisa de você" sob demanda |
| [0021](0021-ia.md) | IA: uma sessão agendada por reino, só os serviços da API e a informação de um jogador; meta de ocupação com abdicação; ids sorteados de uma reserva; regência por evento no último acesso; margens da IA comerciante |
| [0022](0022-velocidade-e-mapa-maior.md) | Tropas 5× mais rápidas num mapa de 104 × 80; visão por unidade e revelação da névoa ao vivo por eventos; alcances da IA na mesma escala |
| [0023](0023-concha-jogo-sempre-visivel.md) | Concha do cliente: mundo sempre à vista como tela de fundo, painel baixo/coluna, folha sem véu com até 3 ações, navegação por destinos, câmera inclinável, formatação de tempo segura |
| [0024](0024-pessoas.md) | Pessoas no mapa e números menores: escala ÷10 nos recursos e 25× nas pessoas, pessoa como documento com nome e ofício, vagas por local, contagens derivadas, carregadores e milícia como pessoas, marchas com ids |
| [0025](0025-primeiros-passos.md) | Reino novo com os primeiros passos já dados: níveis, moradias, guarnição e exploradores prontos e entorno explorado (`P.inicio`); início vazio nos cenários de teste |
| [0026](0026-mapa-maior-e-bonecos-3d.md) | Mapa de 312 × 240 com hexágonos menores e tropas 2× mais rápidas, construções em vários hexágonos (`P.ocupa`), explorador que espera no destino, percursos e patrulha, escavação somada, névoa quase ao vivo e bonecos 3D (Kenney e Quaternius, CC0) renderizados com three.js em sprites |
| [0027](0027-paineis-sem-sobreposicao.md) | Painéis sem sobreposição: tela, folha e confirmação no mesmo lugar, em pilha com "‹ voltar" (só a de cima aparece); barra de tempo única (`RP.barraTempo`) com o início vindo da API |
| [0028](0028-vida-e-coleta.md) | Vida das pessoas sem tique (dano e instante), fauna como dano com fuga do explorador rápido, sobreviventes de batalha feridos; coleta de madeira e pedra no mapa por tropas e civis sem trabalho, com hexágono que se esgota e se recupera; começo mais rápido |
| [0029](0029-tropas-no-mapa.md) | Tropas no mapa: construções que giram em 3D por passos, círculo azul na seleção, envio em 3 toques sem prévia, juntar e separar tropas (`Marchas/Grupos.cs`, ordem `juntar`) e patrulha pela linha exata desenhada no mapa (`Caminhos.Seguir`, `P.patrulha.maxHexes`) |
| [0030](0030-mesa-desktop.md) | Mesa de jogo para computador: mundo na tela inteira, botão esquerdo seleciona e direito ordena, menu de contexto, dicas, atalhos (`RP.teclas`, F1), grupos de controle, janela flutuante para as telas, painel de seleção na base, minimapa recortado ao conhecido; `desktop.css` no lugar de `concha.css` |
| [0031](0031-rota-desenhada-envio-rapido-nevoa.md) | Rota do explorador desenhada com um clique por ponto, envio rápido de tropas pelo botão direito e névoa mais leve na Vista |
| [0032](0032-serraria-e-ataque-de-tropa-em-campo.md) | Serraria rende 1,5×, tropa em campo ajusta o ataque, motivo na notificação sem combate, foto da névoa com um local só e relógio acelerado que não volta atrás |
| [0033](0033-frentes-e-saque-por-prioridade.md) | Frentes simultâneas com a defesa dividida, tempo de batalha que encurta, placar ao vivo, recuar sem o que levar, saque por prioridade e repouso no castelo |
| [0034](0034-resgate-de-explorador-e-forca-inimiga.md) | Explorador capturado preso num local do captor, oferta do dono e resgate à força; força inimiga antes da batalha (estimativa por vista ou espionagem) e ordem "reconhecer" |
| [0035](0035-regiao-dos-reinos-e-poeira-das-marchas.md) | Região de cada reino marcada desde o início e poeira das marchas grandes fora da vista, sem dono nem detalhes; a IA usa as mesmas informações |

(A 0014 não existe: o número ficou reservado para a parte 2 do combate, que entrou na 0013.)
