# 0042: Defesa própria do castelo pelo nível e a IA que guarda o reino

Completa a [0013](0013-combate.md) (torres e portões) e a [0038](0038-ritmo-3x-persona-e-aliancas.md) (persona da IA). Números em [balanceamento/README.md](../../balanceamento/README.md#defesa-própria-do-castelo).

## Contexto

Num teste, um castelo de IA nível 8 caiu para 6 tropas de um reino novo. No código:

- O nível do castelo não dava defesa. A defesa era só a guarnição, os civis presentes como milícia, as torres e os portões.
- A IA nunca construía portões, e só o perfil defensivo construía torres.
- A milícia do castelo são só os civis sem trabalho, porque quem trabalha está no próprio local.
- A IA mandava tropas para fora com uma reserva fixa por perfil, que não crescia com o castelo.

O jogador ausente sofre o mesmo, porque nenhuma IA governa o reino dele ([0039](0039-ia-nao-governa-jogador.md)).

## Decisão

### Defesa própria do castelo

A defesa cresce com o nível do castelo e não gasta pessoas. Parâmetros em `P.defesaCastelo`.

- **Torre de menagem.** O castelo tem `floor(nível × 0,5)` arqueiros no alto. Eles lutam com a defesa ×3 das torres e ficam fora do teto de +50%, como torres e portões. Não são pessoas: não morrem, não ocupam o teto e não entram nas perdas. `Defesas.ArqueirosNoAlto` já os soma, então a ferraria (armaduras dos arqueiros) e o equipamento lendário (diluição) os tratam como os das torres.
- **Portões básicos.** O castelo já vem com portões no nível `floor(nível / 4)`: 1 no castelo 4, 2 no castelo 8. Na batalha vale o maior entre os construídos e os básicos (`Defesas.PortoesEfetivos`). A obra de portões sobe a partir desse nível. O dano de cerco só derruba os construídos, porque os básicos vêm com o nível.
- **Portões fechados.** Contra quem vem sem máquinas de cerco, o multiplicador dos portões vale × 1,5. Aríetes e trebuchets arrombam os portões durante a batalha. A fração aberta é `Σ (cerco das máquinas) / (nível × 100)`, até 1, com a mesma estrutura por nível dos portões construídos. O multiplicador é `1 + (P.portoes[n] × 1,5 − 1) × (1 − aberta)`: arrombados por inteiro, os portões não contam; em parte, contam em parte.
- **Sem muros.** O `CLAUDE.md` já dizia que o castelo tem portões e torres próprias. Muda só que eles vêm com o nível.
- **Pública como o nível.** A prévia do envio e o reconhecimento mostram a menagem, os portões e se eles estão fechados para as tropas escolhidas. A estimativa da IA (`Governo.DefesaEstimada`) também conta tudo isso. A dica de Melhorar o castelo mostra os arqueiros da menagem e os portões básicos de um nível para o outro.
- **Só no castelo.** Em campo (interceptação, postura que sai contra uma ameaça), a defesa própria não conta, porque fica no castelo.

Os portões fechados mudam também os portões construídos: um castelo com portões 3 contra 40 tropas sem máquinas agora resiste. Por isso o caso de referência da M7c passou a levar 8 aríetes.

### A IA guarda o reino

Pelas mesmas regras, sem trapaça. Parâmetros em `P.ia.guarda` e `P.ia.perfis[].guarda`.

- **Reserva em casa.** `ceil(nível do castelo × 0,5 × perfil × persona)` tropas ficam no castelo (`Governo.Reserva`). Ataque, caça, extração, ocupação, coleta e reforço só usam o que passa disso (`Governo.Disponiveis`). Perfil: defensivo 1,5; expansionista e comerciante 1; saqueador 0,7. Persona: o cauteloso guarda mais e o agressivo menos (até ±25% por traço).
- **Obras de defesa em todos os perfis.** A partir do castelo 6, os portões construídos sobem até o nível 3. A partir do castelo 3, há pelo menos 1 torre perto do castelo; o perfil pode pedir mais. É um passo próprio da sessão (`defesas`), antes das obras da economia, e só entra o que dá para pagar.
- **Exército à vista.** `AvistamentoAtaqueEvento` avisa o reino quando um exército de outro reino entra na visão dele, com dono e posição. Agora também dispara `AoAvistar`. A IA usa o mesmo filtro da reação a um ataque: persona com reflexo, acordada e com a chance de ter visto. Então ela marca a reação (`ReacaoIAEvento`) com o próprio tempo de reação. Na reação e na sessão, `Governo.Recolher` traz de volta as tropas em campo a até 30 hexágonos do castelo que caçam, extraem, coletam, estão paradas ou reconhecem. Isso só vale se `MarchaVindo` vê um exército vindo, e ela usa só o dono e o passo público da marcha. Quem ataca, ocupa, reforça um aliado ou está em batalha segue o que fazia.

## Números

Metas novas no modelo, todas atendidas:

| Meta | Resultado |
|---|---|
| M7c: castelo médio nível 10 (12 tropas, 2 torres, portões 3, 10 civis) resiste a 20 tropas sem máquinas e cai para 40 com 8 aríetes | 0,3× / 1,1× |
| M7d: castelo nível 8 vazio (3 civis) aguenta 6 tropas de reino novo, 10 arqueiros e 10 cavaleiros contra 2 lanceiros | 0,3× · 0,5× · 0,5× |
| M7e: o mesmo castelo aguenta 20 tropas sem máquinas e cai para 20 com 4 aríetes | 0,9× / 1,3× |
| M7f: a defesa própria cresce com o nível e vale menos que a guarnição do médio no dia 35 | 375 < 920 |
| M32: a reserva da IA (até o perfil defensivo) cabe nas tropas do médio e ainda sobra tropa | 6 de 7 · 7 de 10 · 8 de 13 · 9 de 23 |

As metas antigas continuam no alvo, inclusive "destruir um reino deve ser muito difícil e caro". Tomar um castelo agora pede máquinas de cerco (20 min de treino cada, lentas). Um castelo guarnecido continua caindo para cerca do dobro das tropas que ele aguenta.

## Consequências

- O formato do save não muda. `Local.Portoes` continua sendo o nível construído, e os básicos saem do nível na hora. Não há migração.
- A API ganha campos: `menagem` e `portoesAbertos` na força inimiga; `basicos`, `construidos`, `menagem` e `fechado` no castelo das defesas; `menagem` na defesa do local. `portoes` passa a ser o nível efetivo. Na dica de melhoria há dois efeitos novos: `menagem` e `portoesBasicos`.
- O objetivo "portões" num cerco contra um castelo só com portões básicos falha com o motivo "os portões básicos vêm com o nível do castelo e não caem".
- A IA saqueadora, que não leva máquinas, deixa de saquear castelos com portões, porque a estimativa dela já conta os portões fechados. Ela continua saqueando os outros locais.
