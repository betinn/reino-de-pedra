# Balanceamento (aprovado)

Números de tempos, custos, rendimentos e combate para o Reino de Pedra. Saem de **metas de ritmo** (o que o jogador deve sentir) e de um **modelo** que calcula as tabelas e simula uma temporada inteira, conferindo as metas a cada execução.

- Modelo: [`modelo.js`](modelo.js). Rodar: `node balanceamento/modelo.js > balanceamento/tabelas.md`.
- Tabelas completas, geradas pelo modelo: [`tabelas.md`](tabelas.md).
- Estado: **aprovado na escala "pessoas no mapa"** ([`docs/plano-pessoas-no-mapa.md`](../docs/plano-pessoas-no-mapa.md)) e no **ritmo 3×** ([decisão 0038](../docs/decisoes/0038-ritmo-3x-persona-e-aliancas.md)). As regras ficam no `CLAUDE.md`; os números ficam aqui e mudam com testes.

---

## Ritmo 3×

O jogo anda como se estivesse acelerado em 3×, pelo próprio balanceamento (a variável `REINO_ACELERACAO` continua existindo só para teste).

| | Antes | Agora |
|---|---|---|
| Obra nível 2 / 6 / 10 | 2 min / 32 min / 8 h 32 | **40 s / 10 min 40 s / 2 h 51** |
| Novo local | 90 min | **30 min** |
| Lanceiro / arqueiro / cavalaria | 12 / 14 / 24 min | **4 min / 4 min 40 s / 8 min** |
| Aríete / trebuchet | 1 h / 2 h | **20 min / 40 min** |
| Explorador a pé | 4 min | **1 min 20 s** |
| Torre nível 1 | 40 min | **13 min 20 s** |
| Ferraria nível 1 / 2 / 3 | 2 / 6 / 12 h | **40 min / 2 h / 4 h** |
| Era do Aço / Cerco / lendário | 6 / 12 / 24 h | **2 / 4 / 8 h** |
| Cura de um ferido | 2 h | **40 min** |
| Escavação com 1 unidade (mínimo) | 12 h (4 h) | **4 h (1 h 20)** |
| Caçada | 20 min | **7 min** |
| Tropa lenta, por hexágono médio | 10 s | **3,4 s** |
| Local vizinho (6 hex.) / reino vizinho (72) / travessia (312) | 1 min / 12 min / 53 min | **20 s / 4 min / 18 min** |
| Produção de local nível 1 / 10 | 3 / 31,8 por hora | **9 / 95,4 por hora** |
| Castelo, por recurso | 2,5/h | **7,5/h** |
| Nascimentos | 1 a 2 por hora | **3 a 6 por hora** |
| Extração (4 lanceiros) | 38 de valor/h | **114/h** |
| Coleta, por pessoa | 4/h | **12/h** |
| Fauna volta / hexágono de coleta enche / vida volta | 24 h / 24 h / 6 h | **8 h / 8 h / 2 h** |

**Em tempo real**, porque é a vida de quem joga: temporada de 70 dias, escudos de 72 h e 24 h, tréguas, convites e prazos de 24 h (feridos sem ervas, resgate, decisão sobre preso), pactos em dias, "visto há 10 h", janela de 24 h do saque repetido. Cada local continua guardando **10 h** da própria produção (a noite de quem joga), então guarda 3× mais; o armazém e o estoque mínimo do castelo cresceram junto (600).

Três escolhas que vieram com o ritmo:

1. **Nível máximo 11** (era 10) e custo ×2,18 por nível (era ×2,15). Com 3× puro e nível 10, o ativo fechava a economia no dia 13 e sobravam 50 dias sem nada para crescer. Com um nível a mais, o ativo fecha no **dia 20** e o médio no **dia 26**; depois disso a temporada é disputa. As pessoas por reino não mudam (3 vagas do nível 9 ao 11).
2. **Batalha sem tempo fixo**: `20 s + 12 s × tropas do lado mais fraco × (força menor / força maior)^1,5`, até 10 min. 50 contra 1 acaba em 20 s; 20 contra 20 leva 4 min 20 s. O ritmo continua acompanhando quem sobra.
3. **Limite do novato 600 por dia** (era 200): a produção triplicou, e o limite continua sendo uma fração parecida do que o reino faz (16% no escudo).

## A escala

Em relação à primeira versão do modelo (castelo com teto 300, exércitos de 600 a 900 tropas):

| | Antes | Agora |
|---|---|---|
| Pessoas (população, tropas, milícia, vagas de trabalho) | centenas a milhares | **÷ 25**: dezenas |
| Recursos (custos de obras, carga, jazidas) | centenas a dezenas de milhares | **÷ 10** |
| Custo de uma unidade | 20 a 90 por recurso | o mesmo: 1 ou 2 dígitos por recurso (cada pessoa vale mais) |
| Trabalhadores por local | 10 por nível | **vagas**: 1 até o nível 4, 2 do 5 ao 8, 3 do 9 ao 11 (`max(1, round(nível × 0,3))`) |
| Milícia | 5% da população | **cada civil presente no local** luta (defesa 15); quando a defesa perde, 25% deles morrem e os outros fogem |

## Resumo em 1 minuto

| Tema | Valor |
|---|---|
| Temporada | **70 dias** (10 semanas) |
| Mundo | 30 reinos num mapa de **312 × 240 hexágonos** pequenos (≈ 2.500 por reino; [decisão 0026](../docs/decisoes/0026-mapa-maior-e-bonecos-3d.md)); construções ocupam 7 (castelo), 3 (locais) ou 1 (posto) hexágonos (`P.ocupa`) |
| Escudo de novato | **72 h**; escudo de exílio **24 h** |
| Reino novo | **Primeiros passos já dados**: castelo e locais no nível 2, 2 moradias, **4 lanceiros e 2 arqueiros** no castelo, **3 exploradores** prontos (a pé, a cavalo, prospector) e o entorno explorado. **8 civis**; o castelo abriga 15, cada moradia mais 3 (a primeira custa 40 recursos, cada uma 24 a mais) |
| Produção de um local | 9/h no nível 1 → **124/h no nível 11** (+30% por nível), proporcional às vagas ocupadas |
| Obras | Nível 2 em **40 s**; nível 6 em 10 min 40 s; nível 11 em **5 h 41 min** (o castelo leva o dobro) |
| Retorno de uma melhoria | Primeira em **≈ 1,9 h**; a do nível 11 em **≈ 8 dias** (investimento de fim de temporada) |
| Pessoas e exército | Jogador médio: **21 pessoas e 7 soldados** no fim do escudo, **66 pessoas e 23 soldados** no dia 35. Ativo: 2,3× as tropas; termina a temporada com ≈ 126 pessoas |
| Serraria | Rende **1,5×** os outros locais, porque as obras gastam 45% em madeira ([decisão 0032](../docs/decisoes/0032-serraria-e-ataque-de-tropa-em-campo.md)) |
| Unidade básica | Lanceiro: 90 recursos, 4 min, carga 5 |
| Começo | Kit com 90 de madeira e 60 de pedra. Sem coleta, 8 níveis na primeira hora; com coleta, **10 níveis em 40 min** e o castelo 5 em 2 h 11 min |
| Vida | Civil 60, lanceiro 110, explorador 80...; volta inteira em **2 h**, sem tique; soldado no próprio castelo, fora de batalha, recupera **30% por minuto** |
| Coleta | 12 por hora por pessoa (`12 × pessoas^0,8`), até 6 por hexágono; o hexágono guarda 60 e volta em 8 h |
| Viagem (tropa lenta) | Local vizinho (6 hex.) **20 s**; reino vizinho (72 hex.) **4 min**; travessia do mapa (312 hex.) **18 min** |
| Combate | Para tomar um local, cerca de **1,5× a força da defesa**; um castelo médio resiste a 20 tropas e cai com cerca de **2×** |
| Batalha | Sem tempo fixo: 20 s a 10 min, conforme as tropas do lado mais fraco e a desigualdade |
| Torre | Nível 1: 2 arqueiros no alto, alcance 4, 150 recursos, 13 min 20 s; com ela (nível 2), o mesmo ataque que tomaria o local perde |
| Relíquias | Ataque +15%, produção +15%, resistência +20%; escavação de 4 h com 1 unidade, mínimo 1 h 20 |

## 5 regras que o balanceamento precisou (aprovadas)

Sem elas, a simulação não fecha.

1. **Tropas ocupam o teto de população.** Soldados também moram no reino. Sem isso, a população se refaz depois de cada recrutamento e o exército cresce sem limite. Com isso, cada soldado é um trabalhador a menos: é a escolha entre tropas e economia do `CLAUDE.md`, agora com número.
2. **Cada nível de local abre vagas de trabalho** (1 até o nível 4, 2 do 5 ao 8, 3 do 9 ao 11). Vaga vazia produz menos. A referência do plano (1 por nível, mínimo 2) deixava o jogador médio sem gente no dia 35 e o ativo com 180 pessoas: o modelo usa menos vagas por nível (metas M5d e M5g).
3. **Nenhum local passa do nível do castelo.** O castelo vira o compasso do reino: custa 4× e leva 2× o tempo de um local do mesmo nível.
4. **Cada local guarda até 10 h da própria produção.** É o que um saque pode levar de um local e o que a requisição busca. Para guardar mais, o armazém.
5. **Civis como milícia morrem só em parte.** Toda pessoa presente no local defende, mas um saque vitorioso não esvazia o local: 25% dos civis que lutaram morrem na proporção das perdas e os outros fogem. Quem quer matar gente usa o massacre (cada tropa viva mata até 1 pessoa).

### Primeiros passos já dados

No reino de antes (castelo e locais no nível 1, nenhuma tropa, nenhum explorador) a primeira sessão era esperar o treino. Agora o reino nasce como se a primeira hora já tivesse passado (`P.inicio`): tem o que fazer desde o primeiro minuto.

## Metas de ritmo

Cada meta vem das regras do `CLAUDE.md`, do plano de pessoas no mapa ou de prática do gênero. O modelo confere todas; hoje **todas estão no alvo**.

| | Meta | Por quê | Resultado |
|---|---|---|---|
| M1 | O kit inicial recruta 2 a 3 lanceiros, prontos em até 15 min; o reino novo já tem tropas que caçam o perigo baixo ilesas e exploradores prontos | "O reino base já gera recursos para tropas básicas"; a primeira sessão tem o que fazer desde o primeiro minuto | 3 · 12 min · 190 de força e 3 exploradores |
| M2 | Primeira melhoria se paga em até 2 h; a do nível 11 em 1 a 2 semanas | Começo rápido; fim de temporada com escolhas de longo prazo | 1,9 h · 8,1 dias |
| M3 | Obra do nível 2 em até 40 s; do nível 11 em 2 a 6 h; 10 obras de nível 7 a 9 cobrem a noite | "Básico rápido, forte demorado"; fila de 10 para a noite | 40 s · 5 h 41 min · 8 h 18 min |
| M4 | Local vizinho (6 hex.) em até 40 s; reino vizinho (72 hex.) em 3 a 7 min; travessia (312 hex.) em até 30 min | "Deslocamento não deve demorar excessivamente" | 20 s · 4 min · 18 min |
| M5 | Médio com 4 a 10 soldados e 15 a 25 pessoas no dia 3; 20 a 30 soldados e 50 a 80 pessoas no dia 35; ativo com 1,5 a 2,5× as tropas e 90 a 140 pessoas no fim | As metas de escala do plano: dezenas de pessoas, não centenas | 7 · 21 / 23 · 66 / 2,3× · 126 |
| M5 | Recrutar não derruba a economia do médio (eficiência ≥ 90%) | Tropas e economia em equilíbrio | 100% |
| M5 | Sem guerra, o ativo fecha a economia perto do dia 20 (17 a 24); o médio depois dele, entre os dias 24 e 40 | Pedido do dono: quem maximiza tudo chega ao máximo no dia 20, o médio na proporção | dia 20 · dia 26 |
| M6 | 6 cavaleiros levam pelo menos 40 min da produção de um local nível 6 | Saque que vale a viagem (agora de ≈ 2 min) | 1 h 48 min |
| M7 | Um local defendido cai com cerca de 1,5× a força; uma torre muda o resultado; castelo médio (nível 10, com guarnição) aguenta 20 tropas e cai com cerca de 2× isso num exército de cerco | "Destruir um reino deve ser muito difícil e caro" | ✓ · 0,3× / 1,1× |
| M7d | Castelo nível 8 sem guarnição aguenta 6 a 10 tropas de reino novo sem máquinas de cerco (e 10 cavaleiros contra 2 lanceiros) | Decisão 0042: um castelo de IA nível 8 caiu para 6 tropas de um reino novo | 0,3× · 0,5× · 0,5× |
| M7e | O mesmo castelo aguenta 20 tropas sem máquinas e cai para um exército de cerco de 20 (o dobro dos 10) | "O cerco continua possível" | 0,9× / 1,3× |
| M7f | A defesa própria cresce com o nível e vale menos que a guarnição do médio (nível 11: 5 arqueiros na menagem, portões básicos 2) | A defesa própria é um piso, não substitui as tropas | 375 < 920 |
| M8 | Relíquia de produção vale menos que 1 nível do local | Vantagem real, mas sem decidir a temporada | +5/h contra +10/h |
| M9 | Tática média recua com 40% e ainda causa perdas na defesa | O recuo protege, mas o ataque não é inútil | 9% de perdas na defesa |
| M31 | Batalha sem tempo fixo: 50 contra 1 acaba em até 30 s; 20 contra 20 leva de 3 a 6 min; nenhuma passa de 10 min | Pedido do dono: 50 contra 1 não pode demorar | 20 s · 4 min 20 s · 10 min |
| M32 | A reserva da IA em casa (castelo × 0,5, até o perfil defensivo) cabe nas tropas do médio e ainda sobra tropa para sair | Decisão 0042: a IA guarda o reino pelas mesmas regras | 6 de 7 · 7 de 10 · 8 de 13 · 9 de 23 (dias 3, 7, 14 e 35) |

## Como os números saem

**Produção** de um local de nível L: `9 × 1,30^(L−1)` por hora, vezes a fração das vagas ocupadas. O castelo produz 7,5/h de cada recurso básico (+12% por nível), sem vagas.

**Custo** para subir ao nível L: `5 × 2,18^(L−2)` recursos, divididos em 45% madeira, 35% pedra, 10% ferro e 10% comida. **Tempo**: `40 s × 2^(L−2)`.
O custo cresce mais rápido que a produção: cada nível rende menos por recurso gasto (o retorno vai de 1,9 h a 8 dias). Isso dá fôlego à temporada sem travar o começo.

**População**: o castelo dá teto de 15; cada moradia, +3, custando `40 + 24 × (moradias já feitas)` e levando `3 min 20 s × (1 + 0,1 × moradias já feitas)`. Com espaço no teto, cresce de 3 a 6 pessoas por hora: `min(6, (3 + 3 × livre/teto livre) × (1,3 com sobra de comida))`, parando no teto. Recrutar tira da população (converte uma pessoa); as tropas ocupam o teto.

**Deslocamento**: `hexágonos × terreno médio 1,35 × minutos por velocidade` (lenta 0,0417; média 0,0277; rápida 0,0167). Rota pública: ×0,55. Carregadores da requisição são pessoas do local de origem, andam na velocidade lenta com 30 de carga por pessoa (carrinho de mão) e fazem mais viagens quando falta gente. **Visão em marcha**: um exército revela a névoa com a maior visão do grupo (milícia, lanceiro e cerco 2; arqueiro, cavalaria e elite 4), a cada 4 s de marcha em névoa nunca vista.

**Combate**:
- Ataque = soma de `ataque × quantidade`. Defesa = soma de `defesa × quantidade` + milícia + arqueiros no alto.
- **Vantagem**: uma unidade ganha ×1,5 na proporção em que o outro lado tem o tipo que ela vence (lança vence cavalaria, cavalaria vence arqueiro, arqueiro vence lanceiro).
- **Milícia**: cada civil presente no local, com defesa 15 cada. Na derrota, 25% deles morrem na proporção das perdas.
- **Arqueiros no alto das torres e da torre de menagem do castelo**: defesa ×3.
- **Multiplicadores da defesa**: relíquia de resistência +20%; portões do castelo ×1,15 por nível, × 1,5 se fechados (ver Defesa própria do castelo).
- **Resultado**: o lado maior vence. O vencedor perde `(menor/maior)^1,5` das tropas; o perdedor perde tudo, ou recua no limite de baixas da tática.
- **Duração da batalha**: sem tempo fixo. `20 s + 12 s × tropas do lado mais fraco × (força menor / força maior)^1,5`, até 10 min, sem contar baixas. O tempo real é menor: o ritmo acompanha quem sobra, e uma batalha em que todos caem leva metade disso.

| Situação | Tropas do lado mais fraco | Força menor / maior | Duração |
|---|---|---|---|
| 50 contra 1 | 1 | 0,02 | 20 s |
| 6 contra 4, forças parecidas | 4 | 0,9 | 1 min 1 s |
| 8 arqueiros contra mina com 4 lanceiros e 3 civis | 7 | 0,73 | 1 min 12 s |
| 20 contra 20, forças iguais | 20 | 1 | 4 min 20 s |
| 40 tropas contra castelo médio (12 tropas e 10 civis) | 22 | 0,82 | 3 min 36 s |
| 50 contra 50, forças iguais | 50 | 1 | 10 min |

## Unidades

| Unidade | Ataque | Defesa | Vence | Velocidade | Carga | Visão | Custo | Tempo |
|---|---|---|---|---|---|---|---|---|
| Milícia | 5 | 15 | — | lenta | 3 | 2 | 20 comida, 10 madeira | 40 s |
| Lanceiro | 25 | 40 | cavalaria | lenta | 5 | 2 | 30 comida, 30 madeira, 30 ferro | 4 min |
| Arqueiro | 35 | 25 | infantaria | média | 5 | 4 | 30 comida, 50 madeira, 10 couro | 4 min 40 s |
| Cavalaria | 45 | 30 | arqueiros | rápida | 10 | 4 | 60 comida, 50 ferro, 30 couro | 8 min |
| Cavaleiro de elite | 60 | 40 | arqueiros | rápida | 10 | 4 | 70 comida, 60 ferro, 40 couro, 1 cavalo de raça | 10 min 40 s |
| Aríete | 10 | 10 | 40 de estrutura por combate | lenta | 0 | 2 | 60 madeira, 15 ferro | 20 min |
| Trebuchet | 5 | 5 | 90 de estrutura, à distância | lenta | 0 | 2 | 90 madeira, 40 pedra, 30 ferro | 40 min |

Cada unidade é uma pessoa do reino, com nome; as máquinas de cerco são a equipe que as opera. As vantagens valem por **família**: a lança vence a cavalaria (inclusive a de elite), o arqueiro vence a infantaria e a cavalaria vence os arqueiros.

Papéis: o lanceiro é a melhor **defesa por recurso** (44 por 100 de valor); o arqueiro, o melhor **ataque por recurso** (35 por 100); a cavalaria é cara, mas rápida e carrega o dobro: a unidade de **saque**. Veículos: carroça 60 de carga (15 madeira, 2 ferro, 1 min 40 s); carroção 180 (40 madeira, 8 ferro, 2 cavalos de raça, 5 min). Mensageiro: 30 comida, 1 pessoa, 1 min 20 s, rápido (reino vizinho em ≈ 1 min 40 s); mensagem de até 200 caracteres, recado de proposta até 120.

## Torres e cerco

| Nível | Alcance | Arqueiros no alto | Defesa somada | Custo | Tempo | Estrutura |
|---|---|---|---|---|---|---|
| 1 | 4 hex. | 2 | 150 | 105 pedra, 45 madeira | 13 min 20 s | 80 (2 aríetes) |
| 2 | 6 hex. | 4 | 300 | 189 pedra, 81 madeira | 26 min 40 s | 160 (4 aríetes) |
| 3 | 8 hex. | 6 | 450 | 340 pedra, 146 madeira | 40 min | 240 (6 aríetes) |

A torre é a defesa mais eficiente por recurso (uma torre nível 1 defende como 4 lanceiros, por 40% do custo e sem gastar gente), mas é parada e pode ser derrubada. Portões do castelo: 100 de estrutura por nível, 20 min por nível; nível 3 exige 8 aríetes ou 4 trebuchets. É o ataque mais caro do jogo, como pede a regra.

## Defesa própria do castelo

Decisão 0042. Um castelo de IA nível 8 caiu para 6 tropas de um reino novo: o nível não dava defesa, e a guarnição estava fora. Agora o castelo tem uma defesa que cresce com o nível e não gasta pessoas:

- **Torre de menagem**: `floor(nível × 0,5)` arqueiros no alto, com a defesa ×3 das torres e fora do teto de bônus. Não são pessoas: não morrem nem ocupam o teto.
- **Portões básicos**: o castelo já vem com portões no nível `floor(nível / 4)` (castelo 4: 1; castelo 8: 2). A obra de portões sobe a partir do maior entre o básico e o construído. O cerco só derruba os construídos.
- **Portões fechados**: sem máquinas de cerco, o multiplicador dos portões vale × 1,5. Aríetes e trebuchets arrombam os portões durante a batalha, na proporção `Σ cerco das máquinas / (nível × 100)`, até 1. Arrombados por inteiro, os portões não contam; em parte, contam em parte.

| Castelo | Arqueiros na menagem | Portões básicos | Defesa contra força sem máquinas | Com os portões arrombados | Aríetes para arrombar |
|---|---|---|---|---|---|
| 2 | 1 | 0 | 75 | 75 | — |
| 4 | 2 | 1 | 259 | 150 | 3 |
| 6 | 3 | 1 | 388 | 225 | 3 |
| 8 | 4 | 2 | 585 | 300 | 5 |
| 10 | 5 | 2 | 731 | 375 | 5 |
| 11 | 5 | 2 | 731 | 375 | 5 |

Sem guarnição e sem civis. A milícia e as torres somam, e os portões multiplicam tudo.

Por que assim:
- **A força pequena sem máquinas não toma o castelo**, nem com o dono fora. 10 arqueiros contra o castelo 8 vazio ficam em 0,5× da defesa; 20 tropas sem máquinas, em 0,9×.
- **O cerco de verdade toma**: 20 tropas com 4 aríetes vencem o mesmo castelo com 1,3×. Os aríetes custam tempo (20 min cada) e andam devagar: o cerco é uma decisão, não um saque de passagem.
- **A defesa própria é um piso**. No nível 11, a menagem vale 375 de defesa, menos que metade dos 23 soldados do médio no dia 35. Quem guarda tropas continua mais forte.
- **O castelo guarnecido continua caindo para o dobro**. O castelo médio nível 10 da M7 resiste a 20 tropas sem máquinas e cai para 40 com 8 aríetes (1,1×). Antes, os 40 iam sem máquinas e venciam com 1,2×.

## Guarda do reino de IA

Decisão 0042. A IA guarda o reino pelas mesmas regras do jogador:

- **Reserva em casa**: `ceil(nível do castelo × 0,5 × perfil × persona)` tropas ficam no castelo. Nada sai abaixo disso: ataque, caça, extração, ocupação, coleta e reforço. Perfil: defensivo 1,5; expansionista e comerciante 1; saqueador 0,7. Persona: o cauteloso guarda mais e o agressivo menos (até ±25% cada traço).
- **Obras de defesa em todos os perfis**: portões construídos até o nível 3 a partir do castelo 6, e pelo menos 1 torre perto do castelo a partir do castelo 3. O defensivo continua com 2 torres; o comerciante, com 1. Vêm antes das obras da economia e só se dá para pagar.
- **Exército à vista**: quando um exército de outro reino entra na visão, ela recebe o mesmo aviso do jogador. Se está acordada e vê, entra com o tempo de reação dela e traz de volta as tropas em campo a até 30 hexágonos do castelo (caçando, extraindo, coletando, paradas ou reconhecendo). Usa só o que é público: o dono e o passo da marcha, sem tamanho nem destino.

## Combates de referência

| Situação | Resultado |
|---|---|
| 6 lanceiros contra mina com 4 lanceiros e 3 civis | defesa vence; atacante perde tudo, defesa perde 63% |
| 8 arqueiros contra a mesma mina | atacante vence com 34% de baixas |
| Os mesmos 8 arqueiros, com torre nível 2 na mina | **defesa vence** (a torre muda o resultado) |
| 6 cavaleiros contra vila com 3 arqueiros e 4 civis | atacante vence com 19% de baixas: saque lucrativo contra alvo fraco |
| 6 cavaleiros contra vila com 2 lanceiros e 4 civis | atacante vence, mas com 54% de baixas: saque que não compensa |
| 20 tropas sem máquinas contra castelo médio nível 10 (12 tropas, 2 torres, portões 3, 10 civis) | defesa vence |
| 40 tropas com 8 aríetes contra o mesmo castelo | atacante vence com 88% de baixas |
| 6 tropas de reino novo contra castelo nível 8 vazio (3 civis) | defesa vence |
| 20 tropas sem máquinas contra o mesmo castelo | defesa vence |
| 20 tropas com 4 aríetes contra o mesmo castelo | atacante vence com 70% de baixas |
| Ataque perdido com tática média | recua com 40% de baixas, a defesa perde 9% |

## Saque, relíquias, fauna e proteções

- **Saque**: limitado à carga e ao estoque do local (até 10 h de produção). Saque repetido ao mesmo alvo em 24 h rende −20% a cada vez, até 20%.
- **Relíquias**: produção +15% num local nível 6 dá +5/h, meio nível. Três relíquias juntas (farol) passam de um nível inteiro, e por isso atraem ataque.
- **Fauna** (força = soma de (ataque + defesa)/2): baixo 50, médio 110, alto 180, em bandos de 1 a 6 animais; com o dobro, passa ileso. 2 lanceiros (65) passam o perigo baixo; 12 arqueiros (360) atravessam qualquer região; um explorador sozinho (10 a 20) corre risco em todas.
- **Escudo de novato 72 h**: cobre o primeiro fim de semana de quem entra numa sexta. **Escudo de exílio 24 h**: tempo para refazer o mínimo (castelo nível 1, 6 pessoas, 2 milicianos e um kit).
- **Legado**: relíquias da temporada de +1% a +2% cada, até 3 equipadas, teto somado de 5%. **Aliança**: até 5 reinos.

## Simulação de uma temporada (sem guerra)

Dois jogadores simulados, hora a hora:
- **Médio**: 4 sessões por dia, mantém 35% do teto em tropas.
- **Ativo**: 8 sessões por dia, 50% do teto em tropas.

Os dois enchem a fila até a próxima sessão (ou a noite), escolhem a melhoria de melhor retorno, fundam locais e fazem moradias quando faltam trabalhadores.

| Dia | Médio: produção/h · locais · nível médio · pessoas (civis + tropas + exploradores) | Ativo: produção/h · locais · nível médio · pessoas (civis + tropas + exploradores) |
|---|---|---|
| 1 | 131 · 4 · 4 · 21 (11 + 7 + 3) | 203 · 4 · 6 · 24 (11 + 10 + 3) |
| 3 | 275 · 4 · 7,3 · 21 (11 + 7 + 3) | 320 · 4 · 8 · 24 (9 + 12 + 3) |
| 7 | 478 · 5 · 9 · 30 (17 + 10 + 3) | 548 · 6 · 8,5 · 42 (19 + 20 + 3) |
| 14 | 808 · 7 · 9,7 · 39 (23 + 13 + 3) | 942 · 8 · 10 · 60 (27 + 30 + 3) |
| 21 | 962 · 9 · 9,3 · 48 (29 + 16 + 3) | 1520 · 10 · 11 · 72 (34 + 35 + 3) |
| 35 | 1740 · 12 · 10,9 · 66 (40 + 23 + 3) | 2202 · 15 · 11 · 105 (50 + 52 + 3) |
| 70 | 2078 · 14 · 11 · 78 (49 + 26 + 3) | 2637 · 18 · 11 · 126 (61 + 62 + 3) |

Economia no máximo (nível médio ≥ 10,5): ativo no dia 20, médio no dia 26.

Limites do modelo: não há guerra (saques, sabotagens e perdas em batalha atrasariam todos), nem caça, relíquias ou o efeito do armazém; a extração de valiosos e a ferraria são calculadas à parte. Os jogadores simulados são simples. Os números servem para dar a ordem de grandeza e mostrar o efeito de cada parâmetro, não para prever o jogo exato.

---

## Valiosos, comércio, ferraria e guerra

Valiosos e seus usos, comércio, pactos, resgate, limites do novato, eras, ferraria, veterania, feridos, equipamento lendário, alianças, legado e queda do castelo. O modelo confere as metas M10 a M21; **todas no alvo**.

### Resumo

| Tema | Valor |
|---|---|
| Valor de referência | Básicos 1 · couro e peles 2 · sal 6 · ervas 8 · **prata 10** · aço 15 · **ouro 20** · gemas 30 · cavalo de raça 40 · minério raro 60 |
| Jazidas | Cada valiosa guarda **2 mil em valor** (ex.: 100 de ouro, 200 de prata); 1 de cada valioso para cada 3 reinos (10 no mundo). Minério raro: 5 no mundo, 20 cada |
| Extração | 4 lanceiros tiram **114 de valor/h** (5,7 de ouro/h); 6 lanceiros com posto, 236/h. Por pessoa, ≈ 1,7× um trabalhador de local nível 6. Até **6 tropas por jazida** |
| Era do Aço | Ferraria 7 · 8 ouro, 150 ferro, 120 madeira · 2 h. Libera armas e armaduras 2–3, cavaleiro de elite, lendário |
| Era do Cerco Avançado | Era do Aço e quartel 8 · 15 ouro, 400 madeira, 300 pedra, 150 ferro · 4 h. Libera trebuchet e portões 4–5 |
| Armas e armaduras | +8% por nível, 3 níveis, por família (infantaria, arqueiros, cavalaria). Linha completa: ≈ 2,2 mil de valor e 6 h 40 min; tudo: 13 mil (7% das obras do médio) |
| Veterania | Por pessoa: marca por vitória com perdas < 50% contra inimigo com ≥ 30% da força. 2 / 5 / 9 marcas: +5% / +10% / +15%; o bônus do grupo é a média |
| Feridos | 30% das baixas de quem vence ou recua pela tática. 5 ervas curam 1 em 40 min; sem ervas em 24 h, morrem |
| Lendário | 10 minério raro, 150 ferro, 10 aço · 8 h. +25% para até **8 tropas** (vale ≈ 2 tropas). No máximo 10 no mundo |
| Teto de bônus | A soma de armas, veterania, relíquia, lendário e legado vale até **+50%** (sem teto chegaria a +84% / +89%) |
| Novato | Sob escudo: diferença entre o que dá e recebe de até **600 de valor por dia** (16% do que produz no escudo) |
| Pacto | 1 a 7 dias, até 3 ativos; começa quando o pagamento chega |
| Queda do castelo | Sede vai para o local de maior nível com metade do nível do castelo; −50% dos recursos, −30% da população civil. Supondo ainda 40% das tropas mortas no cerco, o médio volta ao nível em **2,3 dias** |

### Por que esses números

- **Valor de referência**: a prata é a moeda (1 prata = 10 básicos), e o resto se mede por ela. Não é preço fixo: os jogadores combinam o que quiserem. Serve para a IA comerciante, para o limite do novato e para comparar custos.
- **Extração mais lenta para o que vale mais**: o ritmo é medido em valor. 4 lanceiros tiram 114 de valor por hora, seja 114 de madeira, 11 de prata ou 6 de ouro. O ouro da Era do Aço sai em ≈ 1 h 24 min com 4 lanceiros. Por pessoa, extrair rende ≈ 1,7× trabalhar num local nível 6, mas a tropa fica longe, exposta, e a jazida acaba. Com o expoente 0,8, juntar tropas demais rende cada vez menos (até 6 por jazida).
- **Escassez de propósito**: o ouro e o aço do mapa cobrem pouco mais que a demanda típica (≈ 100%). Nem todo reino fecha tudo sem disputar jazidas ou trocar: é motivo de PvP, como as relíquias. As jazidas não cresceram com o ritmo: acabam 3× mais cedo.
- **Ferraria para quem já tem exército**: o nível 1 só rende mais que recrutar com o mesmo valor a partir de ≈ 13 cavaleiros, 23 arqueiros ou 25 lanceiros. Abaixo disso, recrutar compensa. Mas o bônus não ocupa população, que é o limite real: por isso vale para quem já encheu o teto. Com a produção triplicada, a ferraria inteira pesa 7% das obras do médio (eram 29%): ficou acessível mais cedo.
- **Teto de +50%**: sem ele, um veterano com tudo teria +84% de ataque, e um novato não teria chance nem com o dobro de tropas. Com o teto, o exército no máximo vence uma defesa até 1,5× maior e perde para 2×. Torres e portões ficam fora do teto.
- **Feridos**: curar custa 40 de valor, 44% de um lanceiro, e devolve a pessoa. Suaviza "tropas mortas não voltam" sem anular: o perdedor que não recua perde tudo, e sem ervas os feridos morrem.
- **Lendário pequeno de propósito**: +25% para até 8 tropas equivale a ≈ 2 tropas. É forte numa tropa de elite e irrelevante num cerco de 40, para não decidir a temporada. O valor está em ser raro e roubável.
- **Cavaleiro de elite**: mais ataque por pessoa (60 contra 45) e menos por valor (24 contra 26,5 por 100). É para quem tem recurso, mas não tem teto.
- **Novato**: o limite de 600 por dia impede que contas secundárias alimentem uma principal, mas deixa um amigo ajudar. O reino sob escudo não pode ser cobrado por pacto.
- **Queda do castelo**: o médio refaz o nível em 2,3 dias: perda pesada, que não faz o jogador desistir.

### Metas desta parte

| | Meta | Resultado |
|---|---|---|
| M10 | Bônus somados ficam no teto de +50% | ✓ |
| M11 | Armas ou armaduras nível 1 só compensam a partir de 10 a 30 tropas da família | 13 a 25 |
| M12 | Ferraria completa custa 3% a 17% das obras do médio na temporada | 7% |
| M13 | Extrair valiosos rende por pessoa 1,5 a 3× um trabalhador de local nível 6 | 1,7× |
| M14 | O ouro da Era do Aço sai em 1 a 4 h com 4 lanceiros, sem posto | 1 h 24 min |
| M15 | Ouro e aço do mapa cobrem 90% a 150% da demanda típica | 101% / 96% |
| M16 | Era do Aço custa 30 min a 1 h 20 de produção do médio no dia 4; Era do Cerco, 1 h a 2 h 40 no dia 7 (sem o ouro) | 51 min / 1 h 47 min |
| M17 | Curar um ferido custa 25% a 60% de recrutar um lanceiro | 44% |
| M18 | Equipamento lendário vale no máximo 3 tropas | 2 |
| M19 | Cavaleiro de elite: mais ataque por pessoa e menos por valor que a cavalaria | ✓ |
| M20 | Reino sob escudo recebe no máximo 30% do que produz no escudo | 16% |
| M21 | Depois de perder o castelo no dia 35, o médio volta ao nível anterior em 0,5 a 3 dias | 2,3 dias |

### Combates com bônus

| Situação | Resultado |
|---|---|
| 8 arqueiros contra mina com 4 lanceiros, torre nível 1 e 3 civis, sem bônus | atacante vence com 78% de baixas (54% com feridos curados) |
| Os mesmos 8 com armas nível 3 (+24%) | vence com 56% |
| Os mesmos 8 com todos os bônus (+84%, limitado a +50%) | vence com 42% |
| A mesma mina com todos os bônus de defesa (limitado a +50%) | defesa vence; o ataque sem bônus perde tudo e tira 70% da defesa |

Tabelas completas (valiosos, extração, eras, ferraria, queda do castelo) em [`tabelas.md`](tabelas.md).

## Fauna, caça, exploradores, rotas e espionagem

| Tema | Valor |
|---|---|
| Fauna | Força 50 / 110 / 180 (baixo, médio, alto), bandos de 1 a 6 animais. Com o dobro, passa ileso; acima do limite, risco um nível menor. O bando muda de lugar a cada 1 h a 1 h 40 |
| Ataque de fauna | Chance por região atravessada: baixo 10%, médio 25%, alto 50%. Atacado, cada animal fere uma pessoa: 10 a 30 de vida (baixo), 20 a 60 (médio), 35 a 105 (alto), pelo risco efetivo; morre quem chega a zero. Explorador a cavalo foge em 60%. A carga perde 5% (acima do limite) ou 25% (abaixo) |
| Caça (por bando) | Javalis 12 comida, 4 couro, 1 pele · lobos 5, 3, 4 · ursos 9, 6, 6 · crocodilos 5, 9, 0. 7 min no local; o bando volta em 8 h |
| Exploradores | 1 pessoa cada. A pé 40 comida, 1 min 20 s, visão 4 · a cavalo 60 comida e 15 couro, 4 min, visão 6 · prospector 80 comida e 40 ferro, 8 min, visão 2 (jazidas a 4) · batedor 90 comida e 30 couro, 10 min 40 s, visão 6 |
| Rotas | 6 madeira e 4 pedra, 50 s por hexágono, × terreno (floresta 1,8; montanha 2,3; pântano 2,8). Ponte: 60 madeira, 40 pedra, 10 min |
| Espionagem | Chance de ser visto: 15% + 10% por torre no alcance + 2,5% por tropa, até 60%. Visto: metade das vezes capturado (sem relatório). 3 min 20 s no local |

Por quê:
- **Fauna com números reais**: os mesmos valores de força das tropas. Um explorador sozinho corre risco em qualquer região; 2 lanceiros de escolta já livram o perigo baixo; 12 arqueiros atravessam tudo.
- **Uma caçada paga o couro**: uma caçada por dia rende ≈ 5,5 de couro, o que o jogador médio usa para recrutar arqueiros e cavalaria. Com os bandos voltando em 8 h, quem caça mais tem couro de sobra: a caça virou rotina com risco, não gargalo.
- **Rotas são investimento leve**: 20 hexágonos em planície custam ≈ 15 min de produção do médio no dia 14. Em floresta ou montanha, o dobro: rota boa é onde mais se ganha tempo.
- **Espionagem tem risco proporcional**: espionar uma mina com torre e 4 lanceiros tem 1 chance em 3 de ser visto; um castelo médio (12 tropas, 2 torres) chega ao máximo de 60%. Nunca é certo nem impossível.

| | Meta | Resultado |
|---|---|---|
| M22 | Explorador sozinho é atacado em qualquer perigo, mas um ataque só mata no alto (20% a 50% a pé, até 25% a cavalo); 2 lanceiros passam ilesos pelo baixo; 12 arqueiros, até pelo alto | 36% / 14% |
| M23 | 1 caçada por dia cobre 70% a 150% do couro que o médio usa para recrutar | 100% |
| M24 | 20 hexágonos de rota em planície custam 10 min a 1 h de produção do médio no dia 14 | 15 min |
| M25 | Espionar um local defendido: 25% a 40% de ser visto; um castelo médio chega ao máximo | 35% / 60% |

## Vida, coleta e começo

| Tema | Valor |
|---|---|
| Vida | Por ofício: civil 60, milícia 70, lanceiro 110, arqueiro 90, cavalaria 110, elite 130, explorador 80, prospector 70, batedor 90. Volta inteira em 2 h, em linha |
| Fauna | Cada animal fere uma pessoa diferente: golpe de 20 (baixo), 40 (médio) ou 70 (alto) ± 50%, pelo risco efetivo do grupo. Explorador a pé morre num ataque só no alto (36%); a cavalo foge em 60% (14%). Um golpe do alto nunca tira a vida inteira de um lanceiro |
| Batalha | Quem sobrevive perde 80% × a fração de perdas do lado, sem morrer por isso |
| Coleta | `12 × pessoas^0,8` por hora (1 pessoa 12, 4 pessoas 36, 6 pessoas 50), até 6 por hexágono. Civil leva 10. Hexágono de 60, volta inteiro em 8 h: 4 coletores o esgotam em ≈ 2 h |
| Começo | Kit de pedra 60. Sem coleta: 6 níveis em 20 min, 8 na primeira hora, 10 em 2 h, e trava no castelo 4. Com coleta (4 civis sem vaga na madeira, a guarnição inicial na pedra): 10 níveis em 40 min e castelo 5 em 2 h 11 min |

Por quê:
- **Vida em vez de morte certa**: o jogador vê o dano, tem chance de sobreviver e o tempo cura. A força do grupo continua decidindo o risco, e o dobro continua passando ileso.
- **Coleta rende como um trabalhador do começo** (M28: 1× um trabalhador de local nível 2): vale para quem está sem vaga e para tropas paradas, sem substituir os locais, que passam a render mais por pessoa a partir do nível 3. A viagem, a fauna, o hexágono que acaba e o rendimento decrescente impedem que vire recurso de graça.

| | Meta | Resultado |
|---|---|---|
| M26 | Sem coleta, o reino novo sobe pelo menos 6 níveis na primeira hora | 8 |
| M27 | Com coleta, pelo menos 8 níveis nos primeiros 40 min e o castelo 5 em até 2 h 40 | 10 · 2 h 11 min |
| M28 | Coleta rende por pessoa 0,8 a 1,5× um trabalhador de local nível 2 | 1× |
| M29 | Um hexágono com 4 coletores se esgota em 1 h a 2 h 40 e se recupera em 4 a 12 h | 2 h 5 min · 8 h |
| M30 | A vida volta em 1 h 20 a 2 h 40; um ataque do perigo alto não mata ninguém de um grupo de lanceiros | 2 h · 105 < 110 |

## Como mudar um número

1. Edite o parâmetro em `P` (ou a unidade em `U`) no `modelo.js`.
2. Rode `node balanceamento/modelo.js > balanceamento/tabelas.md` e `node balanceamento/modelo.js --json > balanceamento/config.json`.
3. Veja as metas no fim de `tabelas.md`: o que ficou ✗ mostra o efeito colateral da mudança.
