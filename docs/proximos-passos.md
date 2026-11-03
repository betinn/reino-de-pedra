# Próximos passos

O que ficou pendente na primeira etapa de implementação e como testar o jogo. Cada item diz onde mexer. Decisões técnicas novas vão para `docs/decisoes/`; regra de jogo nova, para o `CLAUDE.md`; número novo, para `balanceamento/modelo.js`.

> **Prioridade agora:** o refactor de [`plano-pessoas-no-mapa.md`](plano-pessoas-no-mapa.md) (pessoas com nome e ofício no mapa, números menores, visual mais realista). Ele absorve o "Plano futuro: gráficos e animações" abaixo. Os itens desta lista esperam o refactor, e os que dependem da escala ou da população abstrata serão revistos nele.

## Como testar

- `scripts/rodar-local.sh` e abra `http://localhost:5080` (viewport de celular, 390 × 844).
- Tempo acelerado: `REINO_ACELERACAO=60 scripts/rodar-local.sh` (1 min real = 1 h de jogo).
- Temporada curta, para ver o fim e o reset: `REINO_TEMPORADA_MIN=<minutos>`.
- Sem reinos de IA: `REINO_IA=0`. Mapa fixo: `REINO_SEMENTE=42`.
- Dois jogadores: duas janelas anônimas com contas diferentes (o mesmo navegador compartilha o cookie).
- Testes automáticos: `cd servidor && dotnet test` (304 testes, inclusive o de carga com 30 reinos). `CombateApiTestes.Previa_envio_batalha_anonima_recuo_relatorio_e_defesas_pela_api` falhou uma vez em três rodadas da suíte inteira e passa sozinho: investigar (provável dependência do mapa sorteado ou da IA no cenário).
- Tempo acelerado: o cliente anda junto com o servidor (`aceleracao` em `GET /mundo`). Para julgar o ritmo, prefira 6× a 60× (ver a sessão de ritmo em [`correcoes-usabilidade.md`](correcoes-usabilidade.md)).
- Saúde do servidor: `GET /api/v1/saude` (eventos na agenda, conexões, memória).

## Regras ainda incompletas

1. **IA dos reinos** (`servidor/src/Jogo/IA/`, decisão 0021). Já cura feridos (também na regência) e decide o destino de exploradores capturados (`Governo.Curar`, `Governo.Prisioneiros`). A IA ainda não:
   - pesquisa eras nem usa a ferraria (armas, armaduras, lendário);
   - forma alianças nem responde a convites (eles expiram);
   - paga resgates (o explorador dela é solto no prazo);
   - propõe trocas por conta própria (só responde);
   - na regência, recua de batalhas só no início da sessão, não no meio.
2. **Batedor de elite espionando exércitos em campo.** O `CLAUDE.md` diz que o batedor "espiona exércitos e reinos inimigos"; hoje só espiona locais (decisão 0015). Falta a ordem de espionar uma marcha visível, com relatório de tropas, carga, relíquia e equipamento lendário.
3. ~~Equipamento lendário perdido sem batalha.~~ **Feito:** volta à guarnição do castelo do dono (regra no `CLAUDE.md`; `Lendarios.Recolher`). Só se perde quando o dono não tem castelo.
4. ~~Atacar um local conhecido que sumiu.~~ **Feito:** fora da vista, o ataque é planejado contra a foto da névoa (local fantasma, `Ataques.Alvo`) e as tropas descobrem na chegada ("O alvo não existe mais"). Ainda vale o local real quando o mesmo local mudou de dono ou virou ruína: a prévia mostra os tipos de ataque do estado atual, o que pode revelar a mudança; avaliar planejar sempre pela foto.
5. **Ranking** mostra nome e brasão de todos os reinos, inclusive os que o jogador ainda não conhece (como no protótipo). Confirmar se é a regra desejada; se não, mostrar "Reino desconhecido" para quem não é conhecido.
6. **Avistamento de ataque** usa a visão do defensor no instante em que o atacante parte. Considerar avistar quando a marcha entra na visão (evento no instante da entrada, sem tique).

## Plano futuro: gráficos e animações

As animações atuais (pessoas trabalhando, marchas, fumaça, névoa à deriva) servem para o MVP. A melhoria gráfica (sprites com mais detalhe, transições de terreno, luz do dia, água animada) fica para depois das correções de usabilidade ([`correcoes-usabilidade.md`](correcoes-usabilidade.md), item 7). Ao mexer, manter o cache estático da Vista ([decisão 0017](decisoes/0017-vista-e-mapa-no-cliente.md)) e o limite de 30 quadros/s.

## Funcionalidades fora desta etapa

1. **App de celular.** A API já serve: login com `"app": true` devolve o token para `Authorization: Bearer`. Falta o app.
2. **Notificações com o jogo fechado.** Hoje chegam como aviso na página e como notificação do navegador com a página aberta. Push de verdade (Web Push com service worker e chaves VAPID vindas de variáveis de ambiente, ou push do app) ainda não existe.
3. **E-mail.** Não há confirmação de e-mail nem "esqueci minha senha": falta um serviço de envio (configurado só por variáveis de ambiente).
4. **Troca de senha** existe na API (`POST /api/v1/conta/senha`), mas não tem tela.

## Cliente: acabamentos

1. ~~`#/envio` ou `#/interceptar` sem alvo.~~ **Feito:** a tela explica e leva ao mapa, sem pedir prévia.
2. ~~Aba "Ferraria" fora da tela.~~ **Feito:** a aba escolhida rola para a vista.
3. ~~Reforçar manda todas as tropas.~~ **Feito:** escolher o local e depois quantas (testado com batalha simulada no navegador; falta uma batalha de verdade).
4. ~~Minimapa do caminho na confirmação.~~ **Feito:** `RP.miniRota` na confirmação do envio. Caça, extração e caravana ainda não o usam.
5. A pinça (zoom com dois dedos) no mapa não foi testada em aparelho real.
6. Rodar uma auditoria de acessibilidade (WCAG 2.1 AA) nas telas novas, como foi feito no protótipo.
7. Telas longas: exploradores, caça, caravana, ferraria e bandeiras passaram pela dieta de informação (camadas com `RP.comoFunciona` e `RP.secaoRecolhida`). Faltam extração, comércio, alianças, mensagens, relíquias e temporada; e a revisão com alguém de fora (regra 6) em todas.
8. A tela da ferraria abre pelo endereço mesmo antes do gatilho (primeira ferraria): mostrar só "Fundar ferraria" até lá.

## Operação e desempenho

1. **Medir na VM de verdade** com o pacote publicado (`scripts/publicar.sh`): memória do processo após alguns dias de jogo com 30 reinos e tempo de resposta de `GET /mapa` e `GET /reino`. Ajustar as variáveis de GC sugeridas em `docs/publicar.md` se precisar.
2. **Reset de temporada**: se o servidor cair exatamente entre apagar o mundo no banco e gravar o novo, a próxima subida cria um mundo novo com outra semente (o legado não é afetado). Avaliar fazer as duas coisas numa única transação (`servidor/src/Jogo/Temporada/`).
3. **Backup**: automatizar a cópia de `reino.db` (`sqlite3 reino.db ".backup ..."`) fora do repositório.

## Balanceamento

- Ajuste fino com partidas reais (item "Em aberto" do `CLAUDE.md`). Números novos que só o servidor usa estão em blocos marcados "(servidor)" no fim de `P`, em `balanceamento/modelo.js`; os inventados (duração da batalha, custo dos portões, regiões de fauna, meta de IA...) estão comentados lá e nas decisões 0013 a 0021.
