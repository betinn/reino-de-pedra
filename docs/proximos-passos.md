# Próximos passos

O que ficou pendente na primeira etapa de implementação e como testar o jogo. Cada item diz onde mexer. Decisões técnicas novas vão para `docs/decisoes/`; regra de jogo nova, para o `CLAUDE.md`; número novo, para `balanceamento/modelo.js`.

## Como testar

- `scripts/rodar-local.sh` e abra `http://localhost:5080` (viewport de celular, 390 × 844).
- Tempo acelerado: `REINO_ACELERACAO=60 scripts/rodar-local.sh` (1 min real = 1 h de jogo).
- Temporada curta, para ver o fim e o reset: `REINO_TEMPORADA_MIN=<minutos>`.
- Sem reinos de IA: `REINO_IA=0`. Mapa fixo: `REINO_SEMENTE=42`.
- Dois jogadores: duas janelas anônimas com contas diferentes (o mesmo navegador compartilha o cookie).
- Testes automáticos: `cd servidor && dotnet test` (286 testes, inclusive o de carga com 30 reinos).
- Saúde do servidor: `GET /api/v1/saude` (eventos na agenda, conexões, memória).

## Regras ainda incompletas

1. **IA dos reinos** (`servidor/src/Jogo/IA/`, decisão 0021). A IA ainda não:
   - pesquisa eras nem usa a ferraria (armas, armaduras, lendário);
   - cura feridos (ficam para morrer em 24 h);
   - forma alianças nem responde a convites (eles expiram);
   - decide o destino de exploradores capturados nem paga resgates (são soltos no prazo);
   - propõe trocas por conta própria (só responde);
   - na regência, recua de batalhas só no início da sessão, não no meio.
2. **Batedor de elite espionando exércitos em campo.** O `CLAUDE.md` diz que o batedor "espiona exércitos e reinos inimigos"; hoje só espiona locais (decisão 0015). Falta a ordem de espionar uma marcha visível, com relatório de tropas, carga, relíquia e equipamento lendário.
3. **Equipamento lendário perdido sem batalha.** Se o exército que o leva some sem combate (por exemplo, morto pela fauna), o equipamento se perde. Decidir o destino (fica no hexágono, volta à ferraria) e implementar (`servidor/src/Jogo/Forja/`).
4. **Atacar um local conhecido que sumiu** é recusado no envio, e a recusa revela que algo mudou ali. Trocar por descoberta na chegada (as tropas encontram ruína ou terra livre), como o escudo (`servidor/src/Jogo/Combate/Ataque.cs`).
5. **Ranking** mostra nome e brasão de todos os reinos, inclusive os que o jogador ainda não conhece (como no protótipo). Confirmar se é a regra desejada; se não, mostrar "Reino desconhecido" para quem não é conhecido.
6. **Avistamento de ataque** usa a visão do defensor no instante em que o atacante parte. Considerar avistar quando a marcha entra na visão (evento no instante da entrada, sem tique).

## Funcionalidades fora desta etapa

1. **App de celular.** A API já serve: login com `"app": true` devolve o token para `Authorization: Bearer`. Falta o app.
2. **Notificações com o jogo fechado.** Hoje chegam como aviso na página e como notificação do navegador com a página aberta. Push de verdade (Web Push com service worker e chaves VAPID vindas de variáveis de ambiente, ou push do app) ainda não existe.
3. **E-mail.** Não há confirmação de e-mail nem "esqueci minha senha": falta um serviço de envio (configurado só por variáveis de ambiente).
4. **Troca de senha** existe na API (`POST /api/v1/conta/senha`), mas não tem tela.

## Cliente: acabamentos

1. Abrir `#/envio` ou `#/interceptar` sem alvo gera um 400/404 no console: a tela deve explicar e oferecer escolher o alvo no mapa.
2. A aba "Ferraria" da Construção fica fora da tela em celular: rolar a aba selecionada para a vista (`web/js/telas/reino.js`).
3. Reforçar pela folha da batalha manda todas as tropas do local: permitir escolher quantidades.
4. A confirmação do envio não tem o minimapa do caminho que o protótipo mostra.
5. A pinça (zoom com dois dedos) no mapa não foi testada em aparelho real.
6. Rodar uma auditoria de acessibilidade (WCAG 2.1 AA) nas telas novas, como foi feito no protótipo.

## Operação e desempenho

1. **Medir na VM de verdade** com o pacote publicado (`scripts/publicar.sh`): memória do processo após alguns dias de jogo com 30 reinos e tempo de resposta de `GET /mapa` e `GET /reino`. Ajustar as variáveis de GC sugeridas em `docs/publicar.md` se precisar.
2. **Reset de temporada**: se o servidor cair exatamente entre apagar o mundo no banco e gravar o novo, a próxima subida cria um mundo novo com outra semente (o legado não é afetado). Avaliar fazer as duas coisas numa única transação (`servidor/src/Jogo/Temporada/`).
3. **Backup**: automatizar a cópia de `reino.db` (`sqlite3 reino.db ".backup ..."`) fora do repositório.

## Balanceamento

- Ajuste fino com partidas reais (item "Em aberto" do `CLAUDE.md`). Números novos que só o servidor usa estão em blocos marcados "(servidor)" no fim de `P`, em `balanceamento/modelo.js`; os inventados (duração da batalha, custo dos portões, regiões de fauna, meta de IA...) estão comentados lá e nas decisões 0013 a 0021.
