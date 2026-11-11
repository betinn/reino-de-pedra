# Próximos passos

O que ficou pendente na primeira etapa de implementação e como testar o jogo. Cada item diz onde mexer. Decisões técnicas novas vão para `docs/decisoes/`; regra de jogo nova, para o `CLAUDE.md`; número novo, para `balanceamento/modelo.js`.

> O refactor de [`plano-pessoas-no-mapa.md`](plano-pessoas-no-mapa.md) (pessoas com nome e ofício no mapa, números menores, visual mais realista) foi feito ([decisão 0024](decisoes/0024-pessoas.md)). O que ficou dele está em "Pessoas no mapa: pendências".

## Como testar

- `scripts/rodar-local.sh` e abra `http://localhost:5080` (viewport de celular, 390 × 844).
- Tempo acelerado: `REINO_ACELERACAO=60 scripts/rodar-local.sh` (1 min real = 1 h de jogo).
- Temporada curta, para ver o fim e o reset: `REINO_TEMPORADA_MIN=<minutos>`.
- Sem reinos de IA: `REINO_IA=0`. Mapa fixo: `REINO_SEMENTE=42`.
- Dois jogadores: duas janelas anônimas com contas diferentes (o mesmo navegador compartilha o cookie).
- Testes automáticos: `cd servidor && dotnet test` (338 testes, inclusive o de carga com 30 reinos). `CombateApiTestes.Previa_envio_batalha_anonima_recuo_relatorio_e_defesas_pela_api` falhou uma vez em três rodadas da suíte inteira e passa sozinho: investigar (provável dependência do mapa sorteado ou da IA no cenário).
- Tempo acelerado: o cliente anda junto com o servidor (`aceleracao` em `GET /mundo`). Para julgar o ritmo, prefira 6× a 60× (ver a sessão de ritmo em [`correcoes-usabilidade.md`](correcoes-usabilidade.md)).
- Saúde do servidor: `GET /api/v1/saude` (eventos na agenda, conexões, memória).

## Vida e coleta: pendências

O item 17 (vida e fauna) e o 18 (coleta e começo mais rápido) do teste a 6× foram feitos ([decisão 0028](decisoes/0028-vida-e-coleta.md)). Ficou para depois:

1. **Cura de vida**: hoje a vida só volta com o tempo, igual em qualquer lugar. Avaliar recuperar mais rápido dentro de um local (ou com ervas), o que exige guardar onde a pessoa estava em cada trecho.
2. **Veredito da fauna no envio** (`RP.faunaVereditoHTML`) ainda fala da regra de perdas da caçada ("perde parte"); para um grupo que só passa pela região, mostrar o dano esperado e quem pode morrer.
3. **Coleta pela seleção**: o envio pelo mapa leva só tropas; civis sem trabalho vão pela tela de coleta. Permitir selecionar civis no laço para a missão "coletar".
4. **IA**: coleta só com os civis do castelo e uma carga por sessão; não usa armazém próximo nem tropas ociosas de outros locais.
5. **Modelo**: a simulação de 70 dias não inclui a coleta (só a do começo); medir o efeito dela no meio da temporada.

## Regras ainda incompletas

1. **IA dos reinos** (`servidor/src/Jogo/IA/`, decisão 0021). Já cura feridos e decide o destino de exploradores capturados (`Governo.Curar`, `Governo.Prisioneiros`). A IA ainda não:
   - pesquisa eras nem usa a ferraria (armas, armaduras, lendário);
   - forma alianças nem responde a convites (eles expiram);
   - paga resgates (o explorador dela é solto no prazo);
   - propõe trocas por conta própria (só responde).
2. **Batedor de elite espionando exércitos em campo.** O `CLAUDE.md` diz que o batedor "espiona exércitos e reinos inimigos"; hoje só espiona locais (decisão 0015). Falta a ordem de espionar uma marcha visível, com relatório de tropas, carga, relíquia e equipamento lendário.
3. ~~Equipamento lendário perdido sem batalha.~~ **Feito:** volta à guarnição do castelo do dono (regra no `CLAUDE.md`; `Lendarios.Recolher`). Só se perde quando o dono não tem castelo.
4. ~~Atacar um local conhecido que sumiu.~~ **Feito:** fora da vista, o ataque é planejado contra a foto da névoa (local fantasma, `Ataques.Alvo`) e as tropas descobrem na chegada ("O alvo não existe mais"). Ainda vale o local real quando o mesmo local mudou de dono ou virou ruína: a prévia mostra os tipos de ataque do estado atual, o que pode revelar a mudança; avaliar planejar sempre pela foto.
5. **Ranking** mostra nome e brasão de todos os reinos, inclusive os que o jogador ainda não conhece (como no protótipo). Confirmar se é a regra desejada; se não, mostrar "Reino desconhecido" para quem não é conhecido.
6. **Avistamento de ataque** usa a visão do defensor no instante em que o atacante parte. Considerar avistar quando a marcha entra na visão (evento no instante da entrada, sem tique).

## Mapa maior e bonecos 3D: pendências

A decisão [0026](decisoes/0026-mapa-maior-e-bonecos-3d.md) entregou o mapa de 312 × 240 com hexágonos menores, construções em vários hexágonos, explorador que espera no destino, percursos e patrulha, escavação somada, névoa quase ao vivo e os bonecos 3D. Ficou para depois:

1. **Animais em 3D.** Lobos, javalis, ursos e crocodilos ainda são a arte 2D; o pacote animado de Quaternius (CC0) tem lobo e outros bichos que servem para o mesmo esquema de sprites.
2. **Natureza 3D no celular.** São ≈ 140 sprites gerados no carregamento (e de novo ao inclinar a câmera); medir o tempo num aparelho fraco e, se pesar, gerar só os do bioma à vista.
3. **Construções 3D: acabamento.** As construções são 3D (Kenney), mas estáticas: falta animar o moinho, a fumaça e a roda d'água, e dar aos níveis mais altos peças próprias além da torre de menagem. Jazidas, obras (andaime) e fundações continuam na arte 2D.
4. **Bonecos no celular de verdade.** O render dos sprites tem orçamento de 7 ms por quadro e cai na figura 2D enquanto o sprite não existe; medir num aparelho fraco quanto tempo leva para a cena encher e, se precisar, pré-renderizar as poses mais comuns na carga.
5. **Névoa sem buscar o mapa inteiro.** Cada aviso "mapa" ainda busca o `GET /mapa` completo (comprimido); um pedido só com o que mudou desde a última busca deixaria a revelação ao vivo mais leve.
6. **Banco antigo.** Um banco gravado com o mapa de 104 × 80 não serve para 312 × 240 (locais, névoas e fotos em índices do mapa antigo): em desenvolvimento, apague `reino.db` antes de subir; em produção, a troca entra com o reset de temporada.

## Pessoas no mapa: pendências

O refactor (decisão 0024) entregou pessoas civis e soldados como documentos, a Vista com cada pessoa, a folha, a tela Pessoas, a seleção com laço e missão, sprites por ofício em cache, transição de terreno, grade opcional e a batalha animada. Ficou para depois:

1. **Atacar pelo laço no navegador.** A missão de atacar usa o mesmo envio que mover e caçar (testados no navegador), mas não houve local inimigo à vista no teste local; conferir com dois reinos vizinhos.
2. **Remessas entre reinos** (troca, ajuda, pacto, resgate) ainda usam carregadores anônimos; as caravanas sem carroça usam as tropas da escolta, que já são pessoas.
3. **Ícone da missão sobre a cabeça** de quem está em missão, com o zoom aproximado; e as construções com mais detalhe na escala nova (as pessoas cresceram 30%; as construções são as do protótipo).
4. **Toque longo** para o modo seleção não dispara dentro de um gesto de pinça; a pinça e o laço não foram testados em aparelho real.
5. **IA**: usa os serviços por quantidade e a atribuição automática; não reatribui pessoas pela folha nem escolhe soldados pelo nome.
6. **Luz do dia e água animada** continuam fora. Ao mexer, manter o cache estático da Vista ([decisão 0017](decisoes/0017-vista-e-mapa-no-cliente.md)) e o limite de 30 quadros/s.

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
