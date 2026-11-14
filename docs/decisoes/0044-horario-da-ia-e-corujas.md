# 0044: Horário da IA no balanceamento, por cota, com corujas na madrugada

Muda a [0038](0038-ritmo-3x-persona-e-aliancas.md) (persona da IA) e completa a [0021](0021-ia.md) (sessões). Números em [balanceamento/README.md](../../balanceamento/README.md#horário-dos-reinos-de-ia).

## Contexto

O dono joga à noite e o mundo parecia morto. No código:

- Cada IA joga nas horas de sessão da habilidade (`P.ia.habilidades[].sessoes`), com variação de ±40 min.
- O cronotipo (`Persona.DesvioHoras`) era sorteado em `Personas.Gerar` com números fixos no código: 20% madrugadores (−2 a −1 h), 50% normais (±0,7 h) e 30% notívagos (+1,2 a +2,8 h).
- A última sessão do dia é às 23 h (médio e ativo); com o maior desvio, 1h48 com a variação. A primeira é às 7 h; com −2 h, 5 h. Entre ≈ 2h30 e 4h20 não havia nenhuma IA, por construção.

O teste de carga (30 reinos, 25 de IA, 35 dias) confirmou: zero sessões entre 3 h e 5 h e nenhuma IA acordada (`Personas.Acordada`, a regra da reação a ataques) entre 3 h e 6 h.

Aumentar `variacaoMin` não resolve: mexe em todas as sessões por igual e bagunça a ordem do dia.

## Decisão

### O horário vem do balanceamento

`P.ia.cronotipos` (gerado por `modelo.js` em `config.json`, lido por `IAP.Cronotipos`) lista as faixas: peso, desvio (de, até) e, se quiser, as habilidades aceitas. Mudar a distribuição é mudar números. A persona guarda a faixa (`Persona.Cronotipo`) e o desvio sorteado dentro dela (`DesvioHoras`).

| Faixa | Peso | Desvio | Habilidades |
|---|---|---|---|
| Madrugador | 16% | −2 a −1 h | todas |
| Normal | 42% | −0,7 a +0,7 h | todas |
| Notívago | 26% | +1,2 a +2,8 h | todas |
| Coruja | 16% | +4,5 a +6,5 h | médio e ativo |

### Por cota, não por sorteio solto

`Cronotipos.Atribuir` põe a IA na faixa mais abaixo do peso entre as IAs ativas que já têm faixa: `peso × (n + 1) − quantas já estão nela`, só entre as faixas que aceitam a habilidade dela, com empate pela sorte do reino. O desvio é sorteado por igual dentro da faixa, com uma sorte própria do reino (semente do mundo, id e criação): não mexe na sorte do mundo.

Com sorteio solto, 10% de corujas num mundo de 25 IAs dá 7% de mundos sem nenhuma coruja (0,9²⁵), e 12% num mundo de 20. Com a cota, 25 IAs têm sempre 4 corujas e 20 têm 3.

### Coruja só médio e ativo, de +4,5 a +6,5 h

A proposta do dono era cerca de 10% de corujas com +4 a +6 h. Simulamos mundos de 25 e 20 IAs, com a habilidade sorteada pelos pesos, o desvio por igual e a variação de cada sessão:

| Proposta | Corujas (25 / 20 IAs) | Mundos de 25 com alguma hora de 1 h a 5 h sem IA acordada | Idem, 20 IAs |
|---|---|---|---|
| 10%, +4 a +6 h, todas as habilidades | 3 / 2 | 7,7% | 15,9% |
| 16%, +4 a +6 h, todas | 4 / 3 | 3,5% | 8,8% |
| 16%, +4 a +6 h, médio e ativo | 4 / 3 | 0,2% | 1,1% |
| **16%, +4,5 a +6,5 h, médio e ativo** | **4 / 3** | **0** (mínimo 3) | **0** (mínimo 2) |

O fraco joga às 9, 14 e 21 h: como coruja, fica acordado só até 2 h a 4 h. O médio e o ativo jogam até as 23 h: com pelo menos +4,5 h, ficam acordados até 4h30 ou mais. Quem a coruja não aceita vai para a próxima faixa mais abaixo do peso, e a cota se completa com as outras habilidades.

Os 16% saíram de madrugadores (20% → 16%) e normais (50% → 42%); notívagos caíram de 30% para 26%, para a noite (22 h a 1 h) não ficar mais cheia que antes.

### O dia de quem joga

O desvio já valia para as horas de sessão e para `Personas.Acordada`. Duas regras ainda olhavam o relógio oficial:

- **Fim de semana** (`Personas.FimDeSemana`, usado por `Aparece`): agora é o dia dela. A coruja que joga às 3 h de sábado ainda está na sexta dela; às 3 h de segunda, ainda no domingo. De dia não muda nada.
- **Última sessão do dia** (`Sessoes.UltimaDoDia`, que enche a fila de obras para a noite): agora é a da hora de dormir dela. Antes, o madrugador enchia a fila da noite na sessão das 5 h, e o notívago e a coruja em duas ou três sessões da madrugada. É uma correção: o ritmo de obras de cada IA volta a ser o da habilidade, só deslocado.

### O mundo que já existe

- **Faixa vazia é persona de antes desta regra.** `Persona.Cronotipo` é novo e vale `""` num save antigo. Na subida, `SistemaIA.AoIniciar` passa por cada reino de IA ativo (em ordem de id) e chama `Personas.Garantir`, que chama `Cronotipos.Atribuir`: quem não tem faixa ganha uma pela cota, contando as que já ganharam nessa mesma passada. O desvio velho é substituído.
- **Uma vez só.** A faixa fica gravada. Na próxima subida, nada é sorteado de novo.
- **Já nesta noite.** Quem ganhou a faixa na subida tem a próxima sessão reagendada no horário novo (`Sessoes.Agendar`). Sem isso, a sessão marcada no horário velho aconteceria, e só a seguinte mudaria.
- **Reinos de jogadores não mudam.** Não têm persona (`Personas.Garantir` devolve null) e `Atribuir` exige `EhIA`.
- **O save não quebra.** O campo novo tem valor padrão; nada mais muda no formato. A persona neutra dos testes tem a faixa `neutro`, fora da cota e sem desvio.
- **O resto da persona não muda.** `Personas.Gerar` continua consumindo os dois números que sorteavam o horário, para o nome, a idade e o tom continuarem os mesmos para a mesma semente. O horário saiu de `Gerar` porque depende das outras IAs do mundo; até `Atribuir`, o desvio é 0.

## Números

### Por hora, num mundo de 25 IAs

Valores esperados pelo modelo (meta M33), pela mesma conta antes e agora: cota de cada faixa, habilidade pelos pesos, desvio por igual dentro da faixa e variação de ±40 min. Sessões marcadas, antes da assiduidade.

| Hora | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 9 a 21 (média) |
|---|---|---|---|---|---|---|---|---|---|
| Acordadas, antes | 6,9 | 3,9 | 1,0 | 0 | 0,5 | 2,7 | 7,5 | 13,9 | 24,6 |
| Acordadas, agora | 9,5 | 7,1 | 4,8 | 4,0 | 4,1 | 4,0 | 6,1 | 11,1 | 23,6 |
| Sessões/h, antes | 2,7 | 2,2 | 0,2 | 0 | 0,2 | 1,2 | 3,7 | 6,6 | 5,8 |
| Sessões/h, agora | 4,1 | 3,0 | 0,8 | 1,3 | 2,1 | 1,9 | 2,8 | 5,3 | 5,6 |

De 1 h a 5 h: 4 a 7 IAs acordadas (antes, 0 a 3,9) e 0,8 a 3 sessões por hora (antes, 0 a 2,2). De dia, 24 acordadas e 5,6 sessões por hora. Toda noite há sessões de IA entre 1 h e 5 h: cada coruja tem pelo menos uma hora de sessão nessa janela (antes da variação de ±40 min), e nunca faltam três seguidas.

### Teste de carga

`CargaIATestes` com `REINO_CARGA_DIAS=35`: 30 reinos (25 de IA e 5 jogadores simulados), com fauna, o mesmo mundo e a mesma sorte antes e depois. O teste agora também mostra as sessões e as IAs acordadas por hora local e, a cada dia, o castelo e as tropas médios da IA e as batalhas.

| | Antes | Agora |
|---|---|---|
| Sessões de IA em 35 dias | 7 572 | 7 566 |
| Sessões marcadas por noite de 1 h a 5 h (1 h · 2 h · 3 h · 4 h) | 5,5 (4,7 · 0,8 · 0 · 0) | 7,6 (2,0 · 1,5 · 1,6 · 2,5) |
| IAs acordadas às 3 h · 4 h · 5 h | 0 · 0 · 0 | 4 · 4 · 3 |
| Castelo médio da IA nos dias 5 · 10 · 20 · 35 | 7,9 · 9,8 · 11,0 · 11,0 | 7,6 · 9,8 · 11,0 · 11,0 |
| Tropas médias da IA nos dias 10 · 20 · 35 | 11,1 · 16,7 · 25,3 | 11,1 · 16,8 · 25,3 |
| Batalhas em 35 dias (atacadas por IA) | 42 (34) | 50 (31) |
| CPU por dia de jogo | 0,90 s | 0,83 s |

O cronotipo desloca as sessões, não acrescenta: cada IA joga o mesmo número de vezes por dia, e o total ficou igual. A IA não ficou mais forte: o crescimento é o mesmo dia a dia. Nos dias 2 a 5 o castelo médio fica 0,2 a 0,3 nível atrás; a causa provável é a correção da última sessão do dia, que tirou o horizonte da noite que notívagos e madrugadores ganhavam em sessões a mais. As batalhas variam com a ordem dos acontecimentos (é o mesmo mundo, mas cada sessão em outra hora muda tudo o que vem depois): as atacadas por IA caíram de 34 para 31, e as dos jogadores simulados subiram de 8 para 19.

## Parece gente

- **Dorme.** A faixa só desloca o dia. O fraco dorme 10 h seguidas, o médio 7 h e o ativo 6 h, em qualquer faixa (meta M34). A coruja ativa vai dormir entre 4h30 e 6h30 e acorda entre 10h30 e 12h30. O teste `Quem_joga_de_madrugada_dorme_e_nao_joga_24_horas` confere todas as faixas nas duas pontas do desvio.
- **Fim de semana** continua valendo, no dia dela (acima).
- **Falta a sessões** como antes (assiduidade, nunca três seguidas), e a reação a ataques segue o "acordada" dela.

## Consequências

- `P.ia.cronotipos` e `P.ia.madrugada` no balanceamento; metas M33 (madrugada) e M34 (ninguém joga 24 h) no modelo.
- A coruja reage a ataques de madrugada, com o atraso de gente. Quem ataca uma IA às 3 h pode encontrar resposta.
- Quando jogadores entram e reinos de IA abdicam, a cota não é refeita: as corujas que sobram seguem corujas. Um reino de IA novo (meta de ocupação) entra na faixa que estiver faltando.

### Abdicação poupa a última IA de cada faixa

A cota só age em quem nasce, e um reino de IA novo só surge com o mundo abaixo de 20 reinos ativos. Com jogadores entrando, isso não acontece: a partir do 6º jogador, cada um faz abdicar o reino de IA de menor porte, e ninguém entra no lugar. Pelo porte, as 4 corujas podiam sair uma a uma e levar a madrugada de volta a zero.

Por isso `Ocupacao.LiberarVaga` pula a IA que é a última ativa da faixa dela (`Cronotipos.UltimaDaFaixa`) e tira a próxima de menor porte. A regra vale para todas as faixas, não só para a coruja: nenhum nome de faixa fica no código, e o madrugador cobre o começo da manhã. A regra nunca barra o jogador. Se só restam as últimas de cada faixa, sai a menor delas, como antes. O teste `Quem_abdica_para_o_jogador_poupa_a_ultima_IA_de_cada_horario` deixa as corujas como as menores do mundo e confere que a última fica até sobrar uma IA por faixa.

O risco era baixo no começo da temporada: a coruja é sempre médio ou ativo, que crescem mais que o fraco. Ele crescia com o mundo cheio de jogadores e poucas IAs, que é quando cada IA na madrugada mais conta.
