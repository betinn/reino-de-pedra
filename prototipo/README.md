# Reino de Pedra — Protótipo de telas

Protótipo navegável das telas principais, usado como referência visual para a implementação. É **apenas design**: não há regra de jogo real, servidor, persistência nem simulação. Todos os dados são fictícios e fixos (`js/dados.js`); timers, recursos, marchas, pessoas e animais "andam" só para dar vida às telas.

Identidade visual, tokens e componentes: [`design-system.md`](design-system.md).

---

## Como abrir

- **Local:** abra `prototipo/index.html` no navegador (funciona direto do arquivo, sem servidor e sem build).
- **GitHub Pages:** publique o repositório; o protótipo fica em `.../prototipo/` (todos os caminhos são relativos).
- Melhor experiência em viewport de celular (375–430 px). No computador, use o modo dispositivo do navegador; a roda do mouse faz zoom.

Fontes vêm do Google Fonts quando há rede; sem rede o protótipo usa as fontes de fallback e continua funcional.

---

## Direção visual

**Fortaleza** (pedra escura, ferro e brasa), escolhida na primeira entrega. A direção "Cartógrafo" foi descartada e removida.

## Duas visões do mesmo mundo

| Visão | Para quê | Como é |
|---|---|---|
| **Vista** (padrão) | Imersão: ver o reino vivo e assistir o jogo acontecer | Cena 2.5D com câmera alta e inclinada. Construções em volume, pessoas trabalhando, tropas marchando em formação, cavaleiros, animais selvagens, fumaça, moinho, rio e bandeiras animados. Névoa como nuvens; áreas exploradas aparecem esmaecidas e paradas (último estado conhecido). |
| **Mapa** | Localização e planejamento | Mapa tático em hexágonos, com ícones, nomes, legenda e camada de **Perigo** para escolher rotas. |

- Alternância no canto inferior direito do mapa (**Vista | Mapa**), mantendo o mesmo ponto central.
- **Zoom semântico:** afastar além do limite da Vista passa automaticamente para o Mapa.
- As duas visões usam o mesmo modelo (`js/mundo.js`), as mesmas folhas de detalhe e o mesmo minimapa.
- **Meu reino** abre com a Vista do território no topo (arrastar para os lados, tocar nas construções) e o botão "Abrir no mundo".
- A Vista é desenhada em Canvas 2D com arte procedural própria, sem bibliotecas. É a referência de enquadramento, escala, leitura e animação; a tecnologia de renderização do jogo final é decisão da implementação.

---

## Mapa de telas

| # | Tela | Rota |
|---|---|---|
| 1 | Entrada e criação do reino | `#/inicio`, `#/criar` |
| 2 | Mundo: Vista e Mapa | `#/mapa` (`?modo=cena\|tatico`, `?centro=<local>`, `?foco=<local>`, `?abrir=<tipo>:<id>`) |
| 3 | Meu reino (com Vista do território) | `#/reino` (`?local=<id>`) |
| 4 | Construção | `#/construcao` (`?aba=economia\|populacao\|militar\|novos`) |
| 5 | Recrutamento | `#/recrutamento` |
| 6 | Exploradores | `#/exploradores` (`?alvo=c,l`, `?tipo=batedor`, `?ativo=<marcha>`) |
| 7 | Extração de recurso | `#/extracao` (`?jazida=<id>`) |
| 7b | Caça | `#/caca` (`?fauna=<id>`) |
| 8 | Envio de ataque (e reforço, ocupação) | `#/envio` (`?alvo=<local>`, `?modo=reforco&destino=<local>`, `?modo=ocupar&alvo=<ruína>`) |
| 9 | Posturas | `#/posturas` (`?local=<id>`) |
| 10 | Batalha em andamento | `#/batalha` |
| 11 | Relatórios | `#/relatorios`, `#/relatorio?id=<id>` |
| 12 | Bandeiras | `#/bandeiras`, `#/bandeira-nova` (`?alvo=c,l`) |
| 13 | Notificações | `#/notificacoes` (sino) |
| 14 | Temporada e legado | `#/temporada`, `#/ranking` |
| 15 | Exílio | `#/exilio` (exemplo, em Mais) |
| 16 | Retorno após regência | `#/regencia` (exemplo, em Mais) |
| 17 | Relíquias lendárias | `#/reliquias` (em Mais, em Meu reino e nas folhas). Escavação: `#/extracao?jazida=j-ruina`. Mover com escolta: `#/transporte?rel=<id>`. Interceptar: `#/interceptar?marcha=<id>` |
| 18 | Transportar recursos (caravana) | `#/caravana` (`?para=<local>`, `?de=<local>`, `?leva=madeira:300,pedra:150`) |
| 19 | Aliança e pedido de recursos | `#/alianca`, `#/pedido?reino=<id>` |
| 20 | Precisa de você | `#/agora` (resumo no topo de Meu reino) |
| — | Tropas (em campo, guarnição, ordens) | `#/tropas` |

Todas as telas da lista estão prototipadas. Único passo só ilustrado: escolher no mapa o local de uma construção nova (vila, posto, rota).

### Navegação principal

`Mapa · Reino · Tropas · Relatórios · Mais` (barra inferior). Notificações ficam no sino, sempre visível no topo.

### Fluxos navegáveis

1. **Primeira vez:** Entrada → Fundar meu reino → nome + brasão → Fundar → modal "reino fundado" (escudo de novato) → Meu reino ou Mundo.
2. **Retorno:** Entrada → Continuar → Meu reino (Vista do território ao vivo).
3. **Assistir:** Mundo (Vista) → arrastar, pinça, botões; pessoas levam minério, toras e sacos ao armazém, o ferreiro martela, soldados treinam e patrulham, o moinho gira, cavalos pastam, animais rondam.
4. **Ameaça:** faixa "Forças desconhecidas" → a câmera vai até o exército (soldados sem brasão, "?") → folha com forças, direção de origem, alvo provável e chegada → Enviar reforços / Espionar.
5. **Fauna:** tocar num bando (Vista) ou no ícone (Mapa) → nível de perigo, regras e Caçar. Em áreas exploradas aparece a placa de perigo com a idade da informação.
6. **Rota segura:** Mapa → Camadas → Perigo: pinta as áreas com fauna; o explorador a cavalo mostra alerta de risco por passar por área de lobos.
7. **Do reino ao mundo:** Meu reino → tocar numa construção da Vista ou num card → detalhes → Ver no mapa.
8. **Regência:** Mais → Retorno após regência → o que o regente fez, o que foi perdido → Retomar o reino.
9. **Construir:** Reino → Construir (ou Melhorar num local) → escolher no catálogo → custo sai dos recursos e a obra entra na fila → na Vista aparecem andaimes, um construtor e o tempo da obra.
10. **Recrutar:** Tropas → Recrutar → quantidade por unidade (−/+, +5, +10, Máx.) → resumo com custo, população e tempo → fila; na Vista, arqueiros treinam no quartel enquanto há recrutamento.
11. **Explorar:** tocar num hexágono → Enviar explorador (ou Tropas → Exploradores) → tipo, ordem, destino e caminho (curto x seguro, escolta opcional, risco de fauna) → enviar → a Vista mostra o explorador saindo do castelo.
12. **Espionar:** local de outro reino → Espionar → Exploradores com batedor de elite. A Mina Rubra mostra o resultado: dono e defesa revelados por espionagem.
13. **Caçar:** animal no mapa → Caçar (ou Tropas → Caça) → alvo, rendimento estimado, grupo de caça com força x perigo, caminho → os caçadores saem do castelo na Vista.
14. **Extrair:** jazida no mapa → Extrair (ou Tropas → Extração) → grupo (uma unidade já basta), posto opcional, gráfico de rendimento por cenário, duração da jazida e caminho → os trabalhadores aparecem na Vista (exemplo ativo: Jazida de prata, com posto).
15. **Atacar:** local de outro reino → Atacar este local → tipo de ataque, tropas, **objetivos** (em ordem de prioridade, com quantidade e o que a espionagem sabe do alvo), **tática**, estandarte (com prévia do que o defensor verá) e caminho → confirmação com os objetivos e "quando param" → o ataque sai do castelo. Escudo de novato só é descoberto ao chegar; saque repetido avisa do rendimento menor.
    - Exemplo: Mina Rubra → objetivos "Lâmina do Rei Antigo" e "10.000 de madeira" (adicionar, +5k duas vezes) → a carga de 10 lanceiros (500) não cabe e a tela avisa → tática Cautelosa → "Quando param" mostra as três condições.
    - O relatório do saque à Mina Rubra mostra cada objetivo (cumprido, parcial ou falhou), o que foi obtido e por que as tropas voltaram.
16. **Defender:** faixa "Batalha em andamento" → Batalha: Vista do combate, força dos lados, gráfico ao longo do tempo (toque mostra os valores; também há tabela), acontecimentos → Enviar reforços (a curva muda quando chegam) ou Recuar.
17. **Posturas:** Tropas → Posturas: as três posturas explicadas, uma por guarnição e por exército em campo, ou "aplicar a todas".
18. **Relatórios:** aba Relatórios → filtro → detalhe: ataque anônimo x identificado pelo estandarte, saque com rendimento decrescente, exploração, espionagem (revela o dono e a relíquia guardada), relíquia roubada, fauna, caça, extração.
19. **Notificações:** sino → avisos de agora, de hoje e antes; como chegam no celular; o que avisar e silêncio noturno.
20. **Bandeira:** hexágono → Colocar bandeira → tipo, recado (até 60), prévia com seu brasão → aparece na Vista e no Mapa; Mais → Bandeiras para remover as suas (até 20) ou derrubar e denunciar as alheias.
21. **Temporada e legado:** Mais → dias restantes, o que fica e o que recomeça, ranking da temporada (baixas, perdas, tropas e famílias), linhagem, relíquias (com teto), títulos, brasões, histórico.
22. **Exílio:** Mais → Exílio → o que aconteceu, novo ponto do mapa, kit de recomeço, escudo temporário, legado mantido → Recomeçar.
23. **Relíquias:** Mais (ou Meu reino) → Relíquias → as suas (onde estão e o efeito), as espionadas, a roubada e as ruínas antigas.
24. **Escavar:** Relíquias → Escavar (ou a ruína no mapa) → grupo, posto opcional, gráfico de horas por cenário e **para onde levar ao achar** → os trabalhadores aparecem na Vista com "Escavando · tempo" → ao achar, o próprio grupo carrega a relíquia até o local escolhido (marcha com baú, sujeita a roubo).
25. **Mover com escolta:** Relíquias → Mover → destino (os que já guardam uma ficam bloqueados) → escolta (sem tropas o botão fica inativo; escolta pequena recebe aviso) → caminho: buscar (castelo → local da relíquia) e levar (rota curta ou segura, risco de fauna) → a escolta sai; ao pegar a relíquia, ela deixa de fortalecer a origem e passa a ser carregada, visível no mapa.
26. **Roubar de outro reino:** Mina Rubra (espionada) → Roubar a relíquia → saque ou cerco com "Priorizar a relíquia": as tropas trazem a relíquia ao castelo e podem ser interceptadas na volta. Na ocupação, a relíquia fica no local tomado. Sabotagem e massacre avisam que não levam a relíquia.
27. **Interceptar:** o Cálice das Colheitas acabou de ser roubado e as forças que o levam ainda marcham para o leste (faixa no mundo, notificação, relatório, Relíquias e Meu reino) → Interceptar → tropas → ponto de encontro calculado sobre o caminho deles, com "vocês chegam", "eles passam" e folga. Lanceiros (lentos) não alcançam; arqueiros alcançam por pouco. Se as forças chegam ao destino, a relíquia some na névoa e só a espionagem a acha.
28. **Recursos no lugar certo:** a barra mostra o estoque do castelo; tocar nela abre o estoque de cada local e "Transportar recursos". Na Construção, cada obra mostra se o material está no local; se falta, "Trazer recursos" abre a caravana já preenchida (origem com mais estoque, carga e carroças). O recrutamento usa o estoque do quartel.
29. **Caravana:** destino → origem → carga (−/+, Tudo) → carroças e escolta (capacidade, velocidade, aviso de caravana pouco protegida) → caminho (buscar no castelo + levar; rota curta ou segura; risco de fauna) → a caravana sai na Vista (carroças puxadas a boi, escolta). Ao chegar, a carga entra no estoque do destino. Exemplo em andamento: 500 de madeira da Serraria para o Castelo.
30. **Caravana alheia:** uma "Caravana desconhecida" com ferro cruza a área visível → folha com carga estimada → Interceptar.
31. **Torres de arqueiros:** Construção → Defesas → castelo (portões) e suas torres (alcance, arqueiros no alto, locais protegidos, prévia do alcance, subir nível) → Nova torre (escolher perto de qual local; a torre ocupa um hexágono livre ao lado). No mapa: ícone da torre e contorno tracejado do alcance; na Vista: torre de pedra com arqueiros no alto. Atacar a Mina Rubra mostra a torre no alcance; "Derrubar torre" é objetivo de sabotagem.
32. **Espião visto:** notificação → mapa com "Espião · há 3 h" → folha com quem viu, rumo e "some do mapa em 6 h 59 min". Um avistamento de 11 h já foi limpo ao abrir.
33. **Construir sem logística manual:** Construção → cada obra diz de onde vem o material ("Parte do material vem de Armazém Real · chega em ≈ 6 min") → Construir → a obra entra na fila com "material chega em 06:23" e carregadores saem a pé com sacos e toras, visíveis na Vista. O recrutamento faz o mesmo para o quartel. Torres também.
34. **Modelos de ataque:** Envio de ataque → Modelos (Repetir último, Saque rápido, Tomar relíquia, Danificar, Salvar atual) → um toque preenche tipo, tropas, objetivos e tática. Tropas → "Repetir último ataque".
35. **Faróis:** a Mina do Corvo guarda 3 relíquias e vira farol: aparece no Mapa e na Vista mesmo na névoa ("3 relíquias · farol"), entra em Relíquias → À vista e no envio de ataque. Mover a Pedra do Vale para o castelo avisa que ele passa a brilhar.
36. **Aliança:** Mais → Aliança (Pacto da Pedra, 3 de 5) → pedido da Casa Lúmen (Enviar sai dos locais mais próximos, visível e roubável) → Pedir a um membro → o aliado aceita e a carroça dele vem pelo mapa. Castelos aliados aparecem em verde, com nome.
37. **Precisa de você:** topo de Meu reino (3 itens mais urgentes) ou Mais → lista em Agora, Oportunidades e No seu reino, cada item com um botão. Nada obrigatório.
38. **Atacar em 3 toques:** Mapa → tocar no castelo → Enviar tropas (ou Tropas → Enviar tropas) → barra "Toque no destino" com as tropas (Tropas para mudar) → tocar no alvo → folha com o padrão (saque, objetivos automáticos, tática média, sem estandarte, rota curta, chegada) → Atacar. "Ajustar" abre o envio completo com as mesmas tropas. Num local seu vira Reforçar; numa ruína, Ocupar; em qualquer outro hexágono, Mover (as tropas vão e ficam lá). Num local inimigo, "Atacar este local" já pula para a confirmação.
39. **Jogador novo:** Mais → Sistemas apresentados aos poucos → Ver como jogador novo: somem transporte manual, espionagem, torres, relíquias e alianças. Cada um volta pelo gatilho (ex.: abrir a Ruína antiga no mapa mostra "Novo: Relíquias") ou por Simular.

---

## O que entrou com as regras novas

**Fauna hostil**
- Animais por terreno: lobos e javalis em florestas, ursos em montanhas e colinas, crocodilos em pântanos e rios.
- Ao vivo só em área visível; em área explorada, só o nível de perigo, com idade ("Ursos · há 30 h").
- Perigo baixo, médio ou alto. É reduzido em hexágonos com rota e fica sempre baixo perto do reino inicial.
- Marchas pequenas que cruzam área perigosa recebem alerta, sugerindo escolta ou rota mais longa.
- Ação **Caçar** na folha do animal e do hexágono.

**Couro e peles** entram como recursos na barra (decisão confirmada), obtidos pela caça.

**Reinos controlados por IA**
- **Nunca são identificados como IA.** Mesmos marcadores, nomes, brasões e cores dos jogadores.
- Locais sem dono aparecem como **Ruína** ou **Terra livre**, sem dizer a causa.
- Tela de **Retorno após regência**, com regente conservador: defendeu e produziu, sem expandir.

---

## Estrutura

```
prototipo/
  index.html          entrada do protótipo (SPA por hash, sem build)
  README.md           este arquivo
  design-system.md    paleta, tipografia, ícones, Vista, Mapa e componentes
  css/
    tokens.css        tokens da direção Fortaleza
    base.css          base e componentes
    telas.css         estilos das telas, do mapa tático e da Vista
  js/
    icones.js         sprite SVG de ícones e símbolos do mapa tático (arte própria)
    brasao.js         gerador de brasão
    hex.js            geometria hexagonal e terreno fixo
    dados.js          dados fictícios (reinos, locais, jazidas, marchas, fauna, ruínas, regência)
    nucleo.js         rotas de tela, gestos, folha, modal, avisos, timers, barra de recursos
    mundo.js          modelo do mundo: névoa, marchas no tempo, fauna e perigo
    cena.js           Vista imersiva 2.5D (Canvas 2D)
    mapa.js           tela do mundo: Mapa tático, alternância de visão, folhas de detalhe, minimapa
    telas.js          entrada, criação, meu reino, regência e telas-guia
    acoes.js          caminhos, tropas, construção, recrutamento, exploradores e caça
    militar.js        extração e escavação, envio de ataque, posturas e batalha
    social.js         relatórios, notificações, bandeiras e ranking
    legado.js         temporada e legado, exílio
    reliquias.js      relíquias lendárias: tela, mover com escolta, interceptar, chegada e fim da escavação
    logistica.js      estoques por local na prática: caravana, carroças, chegada das cargas
    defesas.js        torres de arqueiros (alcance, locais protegidos), aba Defesas e avistamentos com validade
    alianca.js        aliança (membros com limite), pedidos de recursos entre aliados
    agora.js          "Precisa de você": urgências, oportunidades e andamento do reino
```

---

## Decisões de design

- **Mobile-first em coluna única**; em telas largas o conteúdo centraliza (máx. 640 px) e o mundo ocupa a tela toda.
- **Vista como padrão do mundo**, Mapa a um toque. Pinça para longe leva ao Mapa (zoom semântico).
- **Névoa em três estados** nas duas visões: visível (cor e movimento), explorado (dessaturado, parado, "Visto há X"), desconhecido (nada desenhado: fumaça/nuvem).
- **Reino como conjunto de locais**: cada local é uma construção própria na Vista e um alvo próprio no Mapa.
- **Anonimato**: forças sem estandarte usam armadura cinza, sem bandeira, com "?"; com estandarte, levam a bandeira nas cores do brasão. Locais de outros reinos não mostram dono: cinza, sem brasão, nome genérico.
- **Rotas públicas** iguais para todos, com ponte sobre rio e vau marcado com pedras.
- **Ações sempre visíveis**: todo gesto tem botão equivalente; a folha inferior concentra detalhes e ações.
- **Barra de recursos com 7 itens** (madeira, pedra, comida, ferro, couro, peles, população) em números curtos (`2,3k`); o valor exato fica na folha de recursos.

---

## Decisões confirmadas (registradas no `CLAUDE.md`)

1. **Rotas não atravessam a névoa:** só aparecem em áreas já exploradas.
2. **Bandeiras mostram quem as colocou** (brasão e nome do autor).
3. **Explorar não revela o dono** de locais de outros reinos. No Mapa e na Vista eles aparecem em cinza, sem brasão, com nome genérico ("Castelo", "Mina"); a folha diz "Dono desconhecido". Rotas de outros também não dizem quem construiu. A identidade só aparece quando o próprio reino a mostra: exército com estandarte ou bandeira.
4. **Deslocamento curto:** viagens não devem levar muitas horas sem outras ações para o jogador. Os tempos mock de marcha ficam entre 10 e 50 minutos.
5. **Ruínas e terra livre podem ser ocupadas ou reconstruídas:** a folha oferece Ocupar e Reconstruir / Construir local.
6. **Couro e peles são recursos** do reino, obtidos pela caça.
7. **Colina:** deslocamento normal.
8. **Espionagem revela o dono:** espionar um local com batedor de elite revela a quem ele pertence (e a defesa).

## Decisões do último bloco (revisadas)

Regras confirmadas estão no `CLAUDE.md`.

| Tema | Aplicado |
|---|---|
| Batalha | Curvas roteirizadas: reforços sobem a sua força quando chegam; recuo zera a defesa. Mostra "tendência", não resultado garantido. |
| Recuo | Tropas e população se salvam; o local é saqueado. |
| Unidades adequadas na extração | Unidades com mais carga rendem mais por viagem. |
| Escudo de novato | Só é descoberto ao chegar: o atacante não vê a proteção; as tropas voltam sem combate (relatório "Ataque sem combate"). |
| Saque repetido | Rendimento cai a cada saque ao mesmo alvo (mock: −20% por saque em 24 h, até −80%), com aviso antes de enviar. |
| Bandeiras | Até 20 ativas, recado de até 60 caracteres. Outros jogadores podem derrubá-las mandando tropas até o local. "Denunciar" continua para texto ofensivo. |
| Notificações | Todas as categorias ligam e desligam, inclusive ataques; sem horário de silêncio. |
| Relíquias da temporada (legado) | Bônus pequenos com teto somado (mock: 5%). |
| Ranking da temporada | Por reino: baixas causadas, perdas, tropas e famílias (população). Os 10 primeiros por categoria e a sua posição. Não mede território. |
| Exílio | Região aleatória longe de quem derrubou você; a escolha libera pela linhagem. |
| Posturas padrão | Guarnições: "Apenas defender"; exércitos em campo: "Atacar quem atacar". |
| Reforço e ocupação | Mesma tela do envio de ataque, em outros modos. |

## Relíquias lendárias (sub-decisões aplicadas, para aprovar)

As regras definidas estão no `CLAUDE.md`. Detalhes que o protótipo precisou assumir:

| Tema | Aplicado | Alternativas |
|---|---|---|
| Quantas por local | Sem limite: relíquias juntas somam bônus. Regra sua: quanto mais juntas, mais visíveis. Aplicado: 1 só aparece com espionagem; 2 brilham para quem já explorou a área; 3 ou mais viram farol, visível para todos, até na névoa. | Visibilidade por raio crescente em vez de degraus. |
| Roubo | Saque, ocupação ou cerco vitorioso levam a relíquia. No saque, "Priorizar a relíquia" a traz antes dos recursos. Sabotagem e massacre não levam. | Só ocupação leva; ou a relíquia ocupa carga como recurso. |
| Escolta ao mover | As tropas saem do castelo, buscam a relíquia e a levam (duas pernas). A relíquia fortalece a origem até ser pega. Escolta escolhida pelo jogador; abaixo de uma força mínima, aviso de escolta pequena. | Usar a guarnição do próprio local; escolta mínima obrigatória. |
| Depois de escavar | O grupo de escavação carrega a relíquia até um local escolhido antes de enviar. | Escolher o destino só ao achar (a relíquia espera na ruína, exposta). |
| Depois de roubar | Saque e cerco: as tropas trazem a relíquia ao castelo, interceptáveis na volta. Ocupação: fica no local tomado. | Trazer sempre ao castelo, inclusive na ocupação. |
| Interceptar | Tropas vão a um hexágono do caminho deles e precisam chegar ao menos 1 min antes. Quem vence fica com a relíquia, que volta escoltada. | Alcançar por perseguição (atacar a marcha por trás); ou interceptar só em rotas. |
| Quem vê a relíquia em marcha | Você vê as suas e a sua que foi roubada (sabe que ela vai ali). Marchas de outros reinos não mostram se carregam relíquia sem espionagem. | Relíquia em marcha sempre visível para todos (brilho no mapa). |
| Visibilidade | Só a espionagem mostra relíquias de outros reinos (selo no mapa, pedestal na Vista, linha no envio). Relíquia roubada de você some até ser espionada. | Brilho visível de longe, sem revelar o tipo nem o dono. |
| Ruína antiga | Guarda 1 relíquia; o tipo só se conhece ao achar; esgota depois. | Tipo visível antes de escavar; ruína com várias relíquias. |
| Escavação | Uma unidade já escava (≈ 12 h); mais tropas e posto encurtam, mínimo de 4 h. Tropas ficam paradas na ruína. | Tempo fixo; ou exigir prospector. |
| Bônus (mock) | Ataque +15% nas tropas que saem do local; produção +15% do local; resistência +20% na defesa do local. | Bônus que cresce com o tempo guardado; bônus menor fora do castelo. |
| Fim da temporada | Relíquias lendárias ficam na temporada (recomeçam com o mapa). São distintas das relíquias da temporada do legado. | Quem termina com relíquias ganha um título ou uma relíquia de legado. |
| Mundo | Até 30 reinos por mundo (regra sua) → até 30 relíquias. | — |

## Objetivos e tática do ataque (sub-decisões aplicadas, para aprovar)

A regra (objetivos em ordem de prioridade + tática; as tropas sabem quando parar e voltar) está no `CLAUDE.md`.

| Tema | Aplicado | Alternativas |
|---|---|---|
| Objetivos por tipo | Saque: relíquia e recursos (madeira, pedra, comida, ferro, couro, peles) com quantidade. Sabotagem: derrubar torre e a construção do local, em níveis (1 a 3). Massacre: população. Ocupação: "Tomar o local" (fixo) + relíquia. Cerco: portões, torres, relíquia e recursos. | Objetivos livres para qualquer tipo; incluir animais e armas no saque. |
| Ordem | O jogador ordena (subir prioridade); se um objetivo não existe no local, as tropas passam ao próximo. | Objetivos simultâneos, sem ordem. |
| Padrão | Ao escolher o alvo: relíquia espionada (se houver) + o recurso principal do local, 1.000. Sem objetivo, o envio fica bloqueado. | Começar vazio; permitir enviar sem objetivo ("pegar o que der"). |
| Tática | Conservadora 25%, Média 40% (padrão), Agressiva 60%, Sem limite: definidas por você e registradas no `CLAUDE.md`. | — |
| Carga | Objetivos de recurso somam carga; acima da capacidade das tropas, aviso. As tropas param quando a carga enche. A relíquia não ocupa carga. | Bloquear o envio quando passa da carga; relíquia ocupa carga. |
| Encher a carga | Opção "depois dos objetivos, encher a carga com o que houver" (desligada por padrão). | Sempre encher. |
| Previsão | Espionagem mostra o estoque do alvo ("≈ 2.400 de ferro, há 10 h") e avisa "pode faltar". Sem espionagem: "desconhecido · espione antes". | Mostrar chance de sucesso estimada. |
| Relatório | Cada objetivo com resultado (cumprido, parcial, falhou), o obtido e o motivo da volta. | — |

## Logística, torres e avistamentos (sub-decisões aplicadas, para aprovar)

As regras (recursos transportados até onde são usados, veículos construídos com recursos, torres de arqueiros no lugar dos muros, espiões vistos por 10 h, limpeza do mapa) estão no `CLAUDE.md`.

| Tema | Aplicado | Alternativas |
|---|---|---|
| Barra de recursos | Mostra o estoque do castelo (sede); a folha mostra cada local e o total do reino. | Mostrar o total do reino com aviso; seletor de local na barra. |
| Produção | Cada local acumula a própria produção (serraria: madeira; minas: ferro e pedra; vilas e pasto: comida). Valiosos ficam no Armazém Real. | Toda produção vai direto ao armazém mais próximo. |
| Onde se usa | Obra usa o estoque do local da obra; o que falta vem por requisição automática dos locais mais próximos (regra sua). Recrutamento: quartel, idem. | — |
| Requisição | Origens em ordem de distância; a obra entra na fila e só começa quando o material chega. A carga sai da origem na hora e é consumida pela obra ao chegar. Carregadores: 1 a cada 50 de carga, a pé, sem escolta. | Usar carroças livres quando houver; escolta automática para cargas grandes. |
| Veículos | Carroça (500, lenta, madeira + ferro) e Carroção (1.500, média, usa 2 cavalos de raça). Ficam no castelo: saem, buscam na origem e levam. | Veículos parados em qualquer local; animais de carga separados. |
| Escolta | Opcional; carrega um pouco (25 por ponto de carga). Abaixo de uma força mínima, aviso "pouco protegida" (fauna e saqueadores). | Escolta obrigatória acima de certa carga. |
| Reserva | A carga sai do estoque da origem ao enviar e entra no destino ao chegar. | Sai só quando a caravana passa pela origem. |
| Abastecimento | Sem rota repetida (decisão sua: fica para depois). A requisição automática cobre o caso comum. | — |
| Torres | Construção própria num hexágono ao lado de um local. Alcance = nível + 1 hexágonos (máx. nível 3, alcance 4); 4 arqueiros por nível. Protege todos os seus locais no alcance. Custo 400 de pedra + 150 de madeira; subir nível custa mais a cada nível. | Alcance fixo; arqueiros tirados da guarnição. |
| Castelo | Sem muros: o castelo tem portões (nível 3) e 4 torres próprias. Aríetes derrubam portões e torres. | Castelo também só com torres. |
| Torre alheia | Visível quando o hexágono já foi explorado (nível e alcance); arqueiros só para suas torres e de aliados. | Só a espionagem mostra o nível. |
| Avistamentos | Espiões e exércitos vistos ficam 10 h e somem; a limpeza roda a cada minuto. Placas de perigo da fauna seguem a névoa e não somem. | Validade diferente por tipo; limpar também as placas de perigo. |

## Aliança, modelos e "Precisa de você" (sub-decisões aplicadas, para aprovar)

| Tema | Aplicado | Alternativas |
|---|---|---|
| Limite de membros | 5 reinos por aliança (num mundo de até 30). | 4 ou 6; limite proporcional ao tamanho do mundo. |
| O que aliados veem | Nome, brasão e cor verde dos locais aliados (sem espionar) e as marchas uns dos outros. | Ver também a névoa explorada dos aliados. |
| Pedido de recursos | Pede um recurso, quantidade e local de entrega; o aliado aceita ou recusa. Ao aceitar, a carga sai dos locais mais próximos do aliado e viaja visível e roubável. | Pedidos abertos a toda a aliança; limite de pedidos por dia. |
| Aliados e ataque | Locais aliados não aparecem como alvo de ataque. | Permitir traição com aviso (sai da aliança). |
| Modelos | Três modelos de exemplo + "Salvar atual"; "Repetir último" no envio e em Tropas. O recurso do modelo pode ser "principal do alvo". | Modelos por alvo. |
| Precisa de você | Três grupos (Agora, Oportunidades, No seu reino); resumo de até 3 itens no topo de Meu reino. Sem missões e sem recompensa. | Pontinho de alerta na aba Reino. |

## Ataque em 3 toques e apresentação aos poucos (sub-decisões aplicadas, para aprovar)

| Tema | Aplicado | Alternativas |
|---|---|---|
| Tropas padrão da ordem | As do último ataque (limitadas ao que está no castelo); sem histórico, metade de cada tipo. | Sempre todas; perguntar na primeira vez. |
| Padrão do ataque | Saque, objetivos automáticos (relíquia à vista + recurso principal do local), tática média, sem estandarte, rota curta. | Padrão por tipo de alvo (castelo → cerco). |
| Destino livre | Hexágono vazio ou local de aliado vira "Mover": as tropas vão e ficam, com postura "atacar apenas quem atacar". | Patrulhar entre dois pontos. |
| Gatilhos | Transporte manual: primeiro local longe do castelo. Espionagem: primeiro espião visto ou primeiro ataque. Torres: forças desconhecidas perto do reino. Relíquias: primeira ruína antiga ou farol. Alianças: primeiro reino conhecido. Ao aparecer, um aviso curto "Novo: …". | Mostrar também um ponto "novo" no menu até o primeiro uso. |
| O que some antes do gatilho | Menus, abas e botões do sistema (Mais, Construção, folhas do mapa, "Precisa de você"). O mundo continua igual: nada é bloqueado. | Mostrar esmaecido com o gatilho. |

## Pontos em aberto

1. **Famílias no ranking:** o protótipo trata como a população do reino.
2. **Quem derruba uma bandeira:** o protótipo não revela ao dono quem derrubou (mesma lógica do anonimato).

## Valores ilustrativos

Custos, tempos, atributos de unidades, rendimento de caça e força x perigo são **mock** para dar forma às telas, não balanceamento. Seguem as regras: construções básicas em minutos e fortes/tecnologias mais demoradas; deslocamentos curtos (dezenas de minutos); a viagem segue a unidade mais lenta; rio só com ponte ou vau; rotas reduzem o custo e o perigo; grupos médios passam ilesos pela fauna. Não existe atalho pago para encurtar timers.

---

## Verificação

As telas são conferidas em navegador headless com viewport de celular (390 × 844): capturas de cada tela e de cada tipo de entidade na Vista, gestos de arrastar, pinça, toque e minimapa, alternância Vista/Mapa e os fluxos de criação, construção, recrutamento, exploração, caça, extração, ataque, batalha e bandeira.

Revisão final:
- **Acessibilidade:** auditoria automática (axe-core, regras WCAG 2.1 A/AA) em 46 rotas (todas as telas, ordem rápida, folha de torre, mais relíquias, escavação, caravana, defesas, transporte, interceptar, avistamento, aliança, pedido, "Precisa de você", farol, relatórios de roubo, espionagem e saque): nenhuma violação. Para chegar lá, o texto fraco (`--cor-texto-3`) foi clareado e itens bloqueados esmaecem só a imagem, nunca o texto.
- **Toque:** todos os botões e links com pelo menos 44 × 44 px.
- **Larguras:** sem rolagem horizontal em 360, 375, 430 e 1024 px.
- **Gráficos:** cores do gráfico de batalha validadas contra o fundo (faixa de luminosidade, daltonismo e contraste); legenda, rótulos diretos, leitura por toque e tabela.
