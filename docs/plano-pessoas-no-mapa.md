# Plano imediato de refactor: pessoas no mapa e números menores

Decidido pelo dono do projeto em 2026-11-03. Este refactor tem **prioridade sobre tudo** em [`proximos-passos.md`](proximos-passos.md) e [`correcoes-usabilidade.md`](correcoes-usabilidade.md). Ele também absorve o "Plano futuro: gráficos e animações". Quando este plano e o `CLAUDE.md` divergirem, vale o plano, e o `CLAUDE.md` é reescrito durante a execução.

## Por que

O jogo virou planilha. Os números são grandes (castelo com teto 300, exércitos de 600 a 900 tropas no dia 35), a população é um número abstrato e as tropas são contadores numa guarnição. O jogador não *vê* o reino.

A direção nova:
- **Ver é jogar.** Cada cidadão e cada soldado é uma pessoa com nome e ofício. Ela aparece no mapa, onde está, fazendo o que faz.
- **Números pequenos**, que cabem na tela e na cabeça: dezenas de pessoas, não centenas.
- **Mais visual**, com arte mais realista e ofícios fáceis de reconhecer pela roupa e pela ferramenta. A inspiração é o gênero de estratégia por hexágonos com unidades no tabuleiro (estilo Civilization). Nada é copiado de jogo nenhum: nem nome, nem arte, nem interface.

O que **não muda**: mundo persistente em tempo real, timers, exploração com névoa, recursos no local com transporte visível, combate semi-automático, anonimato, alianças, temporadas e legado, nada de pay-to-win, mobile-first. Tudo isso continua como está no `CLAUDE.md`, só que na escala nova.

## Regras novas de jogo

### Pessoas

- **Toda pessoa do reino é um indivíduo**: nome próprio, ofício, onde mora, onde está e o que está fazendo. A população deixa de ser um número abstrato. O total do reino é a contagem de pessoas.
- **Ofícios civis** ligados aos locais: agricultor (fazenda e pasto), lenhador (serraria), pedreiro (pedreira), mineiro (mina), caçador, carregador, construtor, ferreiro (ferraria) e sem ofício (ocioso). Os soldados têm o ofício da unidade (miliciano, lanceiro, arqueiro, cavaleiro, cavaleiro de elite, operador de cerco). Explorador, prospector, batedor e mensageiro também são ofícios.
- **Cada nível de local abre vagas de trabalho** (valor no modelo; a referência é 1 vaga por nível, com mínimo de 2). Uma vaga vazia produz menos. A regra "10 trabalhadores por nível" deixa de valer.
- **Atribuição automática por padrão.** Uma pessoa nova vai para a vaga mais necessária. O jogador pode reatribuir qualquer pessoa: tocar nela e escolher outro trabalho ou outro local. Ao mudar de local, a pessoa caminha até lá, visível no mapa. Nada obriga a microgerenciar.
- **Nascimento e chegada.** O crescimento da população cria pessoas novas, uma por vez, com nome. A regra continua a mesma (por tempo, mais rápido com sobra de comida, mínimo garantido, teto de moradias), só em número de pessoas.
- **Morte com nome.** Batalha, fauna, massacre, ferimento sem ervas e execução matam pessoas específicas. O relatório diz quem morreu ("Inês, lanceira, morreu na defesa da Mina Alta").
- **Recrutar converte uma pessoa.** O treino tira um civil (o ocioso primeiro; senão, o trabalhador da vaga menos necessária) e o devolve como soldado com o mesmo nome. Cada soldado fica pronto ao fim do seu tempo, como na regra de entrega uma por vez que já existe. Cancelar devolve o civil ao ofício anterior.
- **Carregadores são pessoas.** Os carregadores da requisição e os das caravanas sem carroça saem do reino: ociosos primeiro, depois trabalhadores do local de origem. Enquanto carregam, deixam a vaga vazia.
- **Milícia são as pessoas presentes.** Na defesa, cada civil que está no local luta como miliciano (a defesa individual sai do modelo). A regra dos 5% da população deixa de valer. O massacre mata civis específicos do local.
- **Feridos são pessoas.** Cada uma tem o seu prazo de 24 h e a sua cura.
- **Exploradores capturados** aparecem com nome para quem captura e para quem perdeu.

### Tropas e grupos

- **Todo soldado está no mapa**: na guarnição do local, em marcha, caçando, extraindo ou parado num hexágono.
- **Um exército é um grupo de pessoas.** O jogador forma o grupo:
  - tocando um soldado;
  - juntando vários (modo de seleção ou laço);
  - usando um atalho ("todos os lanceiros deste local", "todo o grupo").
- Ao grupo se dá uma **missão**: mover, atacar (com os tipos e objetivos atuais), caçar, extrair, escavar, escoltar, patrulhar, interceptar, guarnecer ou reforçar um aliado.
- Os serviços continuam aceitando **quantidade por tipo** (o ataque rápido, os modelos de ataque e a IA). Nesse caso o servidor escolhe as pessoas: as mais veteranas para atacar e as que estão mais perto para transportar.
- **Veterania por pessoa.** Cada soldado guarda as suas marcas. O bônus do grupo é a média, como hoje.
- Valores com teto de "tropas" passam à escala nova: até 50 tropas por jazida e equipamento lendário para até 50 tropas.

### Escala nova (metas para o modelo)

Os números exatos saem de `balanceamento/modelo.js`. Estas são as metas que o modelo precisa cumprir. Elas substituem as metas de mesmo assunto em `balanceamento/README.md`.

| Assunto | Hoje | Meta nova |
|---|---|---|
| Reino novo | teto 300 | 6 a 8 pessoas; o kit recruta 2 a 3 lanceiros na primeira sessão |
| Médio, dia 3 | 104 tropas | cerca de 20 pessoas, 6 a 8 soldados |
| Médio, dia 35 | 672 tropas | 50 a 70 pessoas, 20 a 30 soldados; ativo 1,5 a 2× |
| Teto prático de um reino | milhares | cerca de 120 pessoas |
| Exército típico | 100+ | 5 a 20 soldados; cerco a castelo médio com 30 a 40 |
| Custos e estoques | centenas a milhares | custo de unidade com 1 ou 2 dígitos por recurso; estoques em dezenas ou centenas |
| Carga | lanceiro 40, carroça 500 | pessoa cerca de 5, carroça cerca de 60 |
| Tropas por jazida | 50 | 6 |
| Equipamento lendário | até 50 tropas | até 8 |
| Fauna | força 40 / 120 / 300 | bandos de 2 a 6 animais com a mesma lógica (explorador sozinho em risco; 3 a 4 soldados passam pelo perigo baixo) |

Regras de escala:
- **As proporções se mantêm.** Tropas contra economia, saque que não compensa contra defesa forte, castelo difícil de cair, ouro escasso. Cada meta M1 a M17 é reescrita na escala nova e volta a passar na simulação.
- **Os tempos de deslocamento ficam como estão** (decisão 0022). O tempo de treino por pessoa sobe na proporção, porque cada pessoa vale mais. A meta é que a primeira sessão ainda tenha o que fazer.
- **Mundo novo.** A mudança começa um mundo novo, sem migrar os documentos do mundo atual. O legado por conta (linhagem e relíquias da temporada) continua.

## Experiência no cliente

### Ver todos

- **A Vista desenha cada pessoa do reino** onde ela está.
  - Os trabalhadores aparecem no local, com a animação do ofício (machado, picareta, enxada, martelo).
  - Quem anda aparece no caminho.
  - Os soldados aparecem em formação na guarnição e em coluna na marcha.
- Pessoas de outros reinos aparecem só dentro da visão atual: roupa sem cor de dono e sem nome, salvo aliado ou reino conhecido. A foto da névoa guarda construções, não pessoas.
- **Com o zoom afastado**, as figuras de um mesmo hexágono viram uma pilha com contador e ícone do ofício que mais aparece. No Mapa tático, um marcador por grupo com o número.
- **Teto de desenho**: no máximo cerca de 12 figuras por hexágono. As demais entram no contador. A Vista mantém o cache estático e o limite de 30 quadros/s (decisão 0017).

### Tocar numa pessoa

A folha mostra:
- nome e ofício;
- onde está e o que está fazendo, com tempo ("Cortando madeira na Serraria do Vale · 3 madeira/h", "Andando para a Mina Alta · chega em 2 min", "Carregando 5 ferro para o Castelo", "Treinando como lanceira · pronta em 8 min", "Ferida · 18 h para receber ervas");
- veterania, para soldados;
- até 3 ações: civil "Trocar trabalho", "Levar para…" e "Recrutar"; soldado "Missão", "Selecionar o grupo" e "Voltar".

"Trocar trabalho" lista os ofícios com vagas, do mais necessário ao menos. Uma tela **Pessoas** (destino da navegação) lista todo mundo, com filtro por ofício e por local, e serve de alternativa acessível ao toque no mapa.

### Selecionar um grupo

- **Toque único** num soldado: seleciona e abre a folha.
- **Modo seleção** (botão na folha ou toque longo): cada toque soma ou tira uma pessoa. Arrastar desenha um laço. Fora do modo seleção, arrastar continua movendo a câmera.
- No computador, também Shift+clique e arrastar com Shift para o laço.
- **Atalhos na folha**: "todos deste tipo aqui", "todo o grupo" e "todos os soldados deste local".
- Com o grupo pronto, a barra mostra "7 selecionados · 4 lanceiros, 3 arqueiros" e o botão **Missão**. Tocar no destino no mapa e confirmar continua sendo o ataque em 3 passos. O ajuste fica opcional.
- A pessoa selecionada ganha um anel no chão. Quem está em missão mostra um ícone pequeno da missão sobre a cabeça quando o zoom está aproximado.

### Visual mais realista

- Figuras com proporção mais humana e mais altura na tela. Roupas e ferramentas por ofício, para cada um ser reconhecido sem texto. Soldados com armadura conforme o nível da ferraria.
- Construções com mais detalhe e escala coerente com as pessoas. Transição de terreno entre hexágonos. Grade de hexágonos discreta, que pode ser ligada e desligada.
- A arte continua procedural em Canvas 2D, sem build e sem bibliotecas (decisões 0007 e 0017). Os sprites de pessoa por ofício e pose são pré-desenhados em canvas fora da tela e reaproveitados a cada quadro.
- A batalha aparece na Vista com as figuras lutando. É só animação: o resultado continua vindo da fórmula do servidor.

## Plano técnico

### Servidor

1. **`Pessoa` como documento** (`servidor/src/Jogo/Reinos/Pessoa.cs` ou uma pasta `Pessoas/`), com estes campos:
   - `Id`, `ReinoId`, `Nome`;
   - `Oficio`;
   - `LocalId` (onde trabalha ou está guarnecida);
   - `GrupoId` (marcha ou exército em que está, se houver);
   - `Estado` (trabalhando, ocioso, andando, carregando, em treino, ferida, capturada);
   - `Marcas` (veterania);
   - `NasceuEm`.

   Os nomes saem de uma lista de nomes medievais em português, sorteados pela semente do mundo, sem repetir dentro do reino.
2. **Contagens viram derivadas.** `Reino.Pop`, `Local.Guarnicao` (dicionário por tipo) e as contagens de exploradores e mensageiros passam a ser calculadas a partir das pessoas, com índice por reino e por local no `Mundo`. Isso evita varrer tudo a cada tique. A produção sob demanda (decisão 0009) usa as vagas ocupadas de cada local.
3. **Marchas carregam ids.** `Exercito`, carregadores, caravanas, exploradores e mensageiros levam a lista de `PessoaId`. Perdas em batalha, fauna e massacre escolhem pessoas específicas, pesando pelo tipo de unidade como a fórmula já faz.
4. **Nenhum evento por pessoa** para andar dentro do reino. Uma pessoa que muda de local é uma marcha de 1, com o mecanismo de marcha que já existe. A posição no caminho é interpolada no cliente, como hoje.
5. **API.** Mudanças:
   - `GET /reino/pessoas` (todas as pessoas próprias, com estado e posição);
   - `GET /pessoas/{id}`;
   - `POST /pessoas/{id}/trabalho` (ofício e local);
   - `POST /pessoas/{id}/mover`;
   - os envios (`/envio`, caça, extração, caravana, interceptação) aceitam `pessoas: [ids]` além de `tropas: {tipo: qtd}`;
   - `GET /mapa` manda as pessoas visíveis de outros reinos, sem nome.
6. **IA** (decisão 0021) continua com os mesmos serviços, usando as quantidades por tipo. Ela passa a reatribuir ofícios quando falta trabalhador.
7. **Persistência.** Pessoas são documentos, gravadas em lote como o resto (decisão 0003). Um reino de 120 pessoas e 30 reinos dão cerca de 3.600 documentos, o que está dentro do orçamento de memória. Medir com o teste de carga.

### Cliente

1. `web/js/vista/arte.js`: sprites de pessoa por ofício, pose e direção, desenhados uma vez em canvas fora da tela. Reaproveitar `pessoa()` como base.
2. `web/js/vista/cena.js`: uma camada de pessoas, com pilha e contador por hexágono, anel de seleção e toque que acha a pessoa pela caixa (respeitando `C.alvoEm`, que já prioriza o hexágono tocado).
3. Uma seleção nova (`web/js/vista/selecao.js` ou no núcleo) com modo seleção, laço, Shift e a barra de selecionados, ligada a `RP.envio`.
4. Uma tela `web/js/telas/pessoas.js` (lista e filtro) e a folha da pessoa.
5. As telas de recrutamento, guarnição, caça, extração e caravana mostram pessoas, com nome nos detalhes e contagem por tipo no resumo, mantendo a dieta de informação.

### Documentação

- `CLAUDE.md`: reescrever População, Tropas e evolução, Extração, Combate (milícia, massacre, feridos), Exploradores e Experiência do jogador com as regras acima. No fim, tirar o aviso de refactor em andamento.
- `docs/decisoes/0024-pessoas.md`: pessoa como documento, contagens derivadas, ids nas marchas, sprites e seleção. Atualizar o índice.
- `balanceamento/`: modelo, `config.json`, `tabelas.md` e `README.md` na escala nova, com as metas reescritas.
- `docs/proximos-passos.md` e `docs/arquitetura.md` atualizados ao fim.

## Fases

Cada fase termina com `cd servidor && dotnet test` verde, teste no navegador no computador e em 390 × 844, e um commit que diz o que entrega.

1. **Escala nova no modelo.** Metas reescritas, `config.json` gerado, testes ajustados aos números novos. O jogo roda igual, só que menor.
2. **Pessoas civis.** Documento, nomes, nascimento, morte, vagas, atribuição automática e manual, carregadores e milícia como pessoas. API de pessoas.
3. **Soldados são pessoas.** Recrutamento converte, exércitos com ids, envio por ids ou por quantidade, perdas e feridos nomeados, veterania por pessoa. Exploradores e mensageiros também.
4. **Ver e tocar.** Camada de pessoas na Vista e no Mapa, folha da pessoa, tela Pessoas, seleção de grupo e missão.
5. **Visual.** Sprites por ofício, construções na escala nova, transição de terreno, grade opcional e batalha animada. 30 quadros/s num celular médio.
6. **Fechamento.** IA ajustada, teste de carga com 30 reinos, documentação final e revisão do diff (segredos e caminhos locais).
