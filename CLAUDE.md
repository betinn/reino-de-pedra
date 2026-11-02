# Reino de Pedra

Jogo de estratégia medieval de conquista de território, multiplayer, persistente e em tempo real. Mobile-first, com cliente web e app compartilhando o mesmo mundo.

Subtítulo de loja: **Estratégia e Conquista**.

Este documento registra as **decisões de negócio e de game design** já fechadas. Decisões técnicas (stack, arquitetura, infraestrutura) são tratadas fora deste arquivo.

---

## Regras para agentes neste repositório

- **O repositório é público.** Nunca commitar informações sensíveis: credenciais, chaves, tokens, senhas, connection strings, endereços de servidores, IPs, nomes de hosts, dados de infraestrutura ou de deploy, e-mails ou dados pessoais.
- **Nenhum caminho de máquina local** pode aparecer no repositório, em código, configuração, documentação, logs, scripts ou mensagens de commit (ex.: diretórios de usuário, drives, caminhos absolutos de qualquer máquina). Use sempre caminhos relativos ao repositório.
- **Infraestrutura não é documentada aqui.** Informações de servidor, hospedagem e operação ficam fora do repositório.
- Configurações sensíveis devem vir de variáveis de ambiente ou arquivos ignorados pelo git; exemplos commitados usam apenas valores fictícios.
- Antes de cada commit, revisar o diff procurando segredos e caminhos locais.
- Mudanças de regra de jogo devem ser refletidas neste documento.

---

## Visão do jogo

- Gênero: MMO de estratégia persistente (4X), com construção e ações por **tempo real** (timers), **sem turnos**.
- Referências de gênero: Travian, Tribal Wars, Stronghold Kingdoms, Rise of Kingdoms.
- Diferencial: **exploração real** de um mapa grande, com recursos valiosos escondidos que precisam ser descobertos.
- O mundo continua funcionando com o jogador offline: construções terminam, tropas marcham e defesas reagem.
- **Multiplayer desde o início**: todos os jogadores no mesmo mapa.
- Sessões curtas no celular: o jogador dá ordens longas, sai e recebe notificações.
- Notificações são **configuráveis por categoria** (inclusive ataques), liga e desliga, sem horário de silêncio.

---

## Mapa e exploração

- Mapa **grande**, que exige deslocamento real: distância e terreno importam. Para 30 reinos: cerca de **60 × 48 hexágonos**; a travessia com tropa lenta leva pouco mais de 3 h (menos com rota ou cavalaria). Um reino pode não encontrar todos os outros na temporada.
- Coberto por **névoa**: no início o jogador só conhece o entorno do seu reino. Informações de áreas exploradas envelhecem e mostram o último estado conhecido.
- Terrenos afetam velocidade de deslocamento e o que pode ser encontrado:
  - Planície: deslocamento rápido, comida, cavalos de raça e sal.
  - Floresta: lenta, madeira e caça.
  - Colina: deslocamento normal, ferro, pedra, aço de qualidade e prata.
  - Montanha: lenta, ouro, prata, pedras preciosas e minério raro.
  - Pântano: muito lento, ervas raras.
  - Rio: exige ponte ou vau.

### Exploradores

| Tipo | Velocidade | Visão | Custo | Característica |
|---|---|---|---|---|
| A pé | Lenta | Média | Barato | Sem penalidade em floresta e pântano |
| A cavalo | Rápida | Alta | Médio | Penalizado em floresta e montanha |
| Prospector | Lenta | Baixa | Caro | Único que revela jazidas valiosas e lendárias |
| Batedor de elite | Rápida | Alta | Caro | Furtivo; espiona exércitos e reinos inimigos |

- Exploradores podem ser capturados ou mortos.
- Quem captura um explorador vê o **reino de origem** e tem **24 h** para pedir resgate, libertar ou executar. Sem decisão, o explorador é libertado.
- Ordens possíveis: explorar área, seguir rota, patrulhar, retornar.

### Fauna hostil

- Animais selvagens ocupam o mapa conforme o terreno: lobos e javalis em florestas, ursos em montanhas e colinas, crocodilos em pântanos e rios.
- Ameaçam principalmente **exploradores sozinhos, grupos pequenos de extração e caravanas**; exércitos médios passam praticamente ilesos.
- Criam a escolha entre **rota curta e perigosa** ou **longa e segura**, ou levar escolta. Rotas construídas reduzem a presença de animais.
- **Caçar** rende comida e materiais (couro, peles).
- Áreas exploradas mostram o **nível de perigo**, sujeito ao mesmo envelhecimento de informação da névoa.
- Animais se movem e **reaparecem** por região ao longo do tempo; área limpa não fica segura para sempre.
- Perto dos reinos iniciais a fauna é mais fraca, para não punir iniciantes.

### Rotas

- Rotas construídas funcionam como **ruas públicas**: qualquer jogador vê, usa e recebe as mesmas vantagens de deslocamento.
- Quem constrói paga o custo; a rota pode beneficiar inclusive inimigos.
- Rotas **não atravessam a névoa**: só aparecem nas áreas que o jogador já explorou.

---

## Recursos

- **Básicos**: madeira, pedra, comida, ferro. Espalhados pelo mapa, base da economia.
- **Valiosos**: aço de qualidade, cavalos de raça, ouro, prata, sal, ervas raras e pedras preciosas. Raros, liberam unidades e tecnologias melhores.
- **Lendários**: minério raro, relíquias, ruínas antigas. Pouquíssimos no mapa, bônus únicos, alvo de disputa.
- **Couro e peles**: recursos do reino, obtidos pela caça.
- Recursos valiosos e lendários ficam **ocultos** até serem descobertos.
- Jazidas são **finitas** e se esgotam com o tempo.
- **O reino base já gera recursos básicos** suficientes para recrutar tropas básicas, sem depender de exploração.
- Recursos ficam **no local** onde estão. Para usar (construir, recrutar), é preciso **transportá-los até o local** onde são necessários; não dá para usar recurso "de qualquer lugar". Vale a mesma lógica das relíquias: o transporte é feito por tropas e a carga pode ser **roubada no meio do caminho**.
- **Veículos de transporte** (ex.: carroças) facilitam o transporte e também são construídos com recursos.
- **Construir gera uma requisição**: os recursos que faltam são enviados automaticamente pelos locais **mais próximos**, levados por tropas ou população, sem ação manual. A construção mostra que está **aguardando a chegada dos recursos**, e o transporte é visível no mapa. Quem constrói se preocupa com o tempo, sem precisar aprender a enviar recursos de um lugar para outro desde o início.
- O **envio manual** de recursos de um local para outro continua possível.
- Cada local **acumula a própria produção** e guarda até **10 h** dela; o excedente vai para o armazém, onde também ficam os recursos valiosos. O estoque do local é o que um saque pode levar.
- **Nenhum local passa do nível do castelo.** Melhorar o castelo custa e demora mais que um local do mesmo nível.
- A obra entra na fila e **só começa quando o material chega**. Os carregadores da requisição vão a pé e sem escolta.
- Carroças ficam no castelo: saem, buscam a carga na origem e a levam. Escolta é opcional; caravana pouco protegida recebe aviso.

### Valiosos e lendários

| Recurso | Para que serve |
|---|---|
| Aço de qualidade | Armas e armaduras dos níveis 2 e 3; equipamento lendário |
| Cavalos de raça | Cavaleiro de elite (1 por unidade) e carroção |
| Ouro | Eras; armas e armaduras do nível 3 |
| Prata | Moeda de troca padrão |
| Sal | Salgadeira: o local de comida guarda 20 h de comida em vez de 10 h |
| Ervas raras | Curar feridos |
| Pedras preciosas | Troca de alto valor; brasões e estandartes (só cosméticos) |
| Minério raro (lendário) | Equipamento lendário |

- Cada recurso tem um **valor de referência** em recursos básicos (1 prata = 10 básicos). Orienta trocas, a IA comerciante e os limites do novato; não é preço fixo.
- Quanto mais valioso, **mais devagar sai** na extração: o ritmo é medido em valor.
- O mapa tem pouco mais ouro e aço que a demanda típica dos reinos: são **escassos de propósito**, motivo de disputa.

### Extração

- **Nada é obrigatório.** Qualquer tropa pode coletar um recurso descoberto, inclusive uma única unidade sem preparo.
- Posto de extração, mais tropas, unidades adequadas e rotas são **opcionais** e aumentam velocidade e rendimento da extração.
- Unidades adequadas são as de **maior capacidade de carga**: rendem mais por viagem.
- Até **50 tropas por jazida**; juntar tropas demais rende cada vez menos por tropa.

### Relíquias lendárias

- Existe **uma relíquia para cada reino** do mundo (ex.: 10 reinos, 10 relíquias). Um reino pode ter **mais de uma**.
- São obtidas por **escavação nas ruínas antigas**: lenta e finita.
- O jogador **guarda a relíquia num local** do reino, e ela melhora o desempenho daquele local.
- Tipos: **ataque**, **produção** e **resistência** (defesa).
- Relíquias podem ser **roubadas** e são **descobertas por espionagem**.
- Relíquias **não se movem sozinhas**: são sempre transportadas por tropas, e podem ser **roubadas no meio do caminho**.
- Relíquias podem ficar juntas no mesmo local, mas **quanto mais relíquias no mesmo lugar, maior a visibilidade** desse local para os outros jogadores:
  - 1 relíquia: só a espionagem revela.
  - 2 no mesmo local: visíveis para quem já explorou a área.
  - 3 ou mais: o local vira **farol**, visível para todos, até na névoa.
- Cada ruína antiga guarda **1 relíquia**, de tipo desconhecido até ser achada, e se esgota depois. Uma unidade já escava; mais tropas e posto encurtam, com tempo mínimo. O grupo que escava leva a relíquia ao local escolhido antes de partir.
- Mover uma relíquia: tropas saem, buscam e levam; até ser pega, ela continua fortalecendo a origem.
- **Saque, ocupação ou cerco** vitorioso levam a relíquia; sabotagem e massacre, não. No saque e no cerco, as tropas a carregam de volta; na ocupação, ela fica no local tomado.
- Uma marcha que leva relíquia pode ser **interceptada**: as tropas precisam chegar antes a um ponto do caminho.
- Relíquias lendárias ficam na temporada e são distintas das relíquias da temporada (legado).
- Objetivo: tornar o PvP mais desejável, com alvos que dão vantagem real além de recursos.

### Tempos

- Recursos e construções básicas: **tempos baixos**.
- Recursos e construções mais fortes ou valiosos: **tempos mais altos**.
- O equilíbrio entre tempos, custos e rendimento é ponto central de balanceamento e deve ser ajustado com testes.
- **Filas de construção e de recrutamento aceitam até 10 itens**, executados um por vez, para o jogador planejar horas ou a noite inteira.
- **Deslocamento não deve demorar excessivamente.** Viagens de muitas horas, sem outras ações para o jogador cuidar enquanto espera, afastam o jogador e quebram a imersão.

---

## População

- População é um **número abstrato** do reino, sem divisão por gênero ou profissão.
- **Teto** definido por moradias (e pelo castelo). Cresce construindo moradias, cada uma mais cara que a anterior.
- **Tropas ocupam o teto**: soldados também moram no reino. População civil + tropas ≤ teto.
- Cada nível de local precisa de **trabalhadores** (10 por nível). Sem população civil suficiente, o local produz menos. Cada soldado é um trabalhador a menos.
- **Crescimento** por tempo, mais rápido com excedente de comida.
- **Recrutar consome população**; tropas mortas não retornam. Feridos curados com ervas voltam (ver Combate).
- A população sustenta a produção de recursos e atua como **milícia** na defesa.
- Objetivo: criar a decisão central entre **tropas e economia**.
- Moral, profissões e migração ficam para depois, apenas se o balanceamento pedir.

---

## Tropas e evolução

- Tipos de unidade: milícia, lanceiro, arqueiro, cavalaria, cavaleiro de elite e máquinas de cerco (aríete, trebuchet).
- Vantagens por **família**: lança vence cavalaria (inclusive a de elite), cavalaria vence arqueiros, arqueiro vence infantaria.
- **Eras**: Ferro (inicial), Aço e Cerco Avançado. Cada era seguinte custa ouro e libera:
  - Era do Ferro: armas e armaduras do nível 1.
  - Era do Aço: armas e armaduras dos níveis 2 e 3, cavaleiro de elite e equipamento lendário.
  - Era do Cerco Avançado: trebuchet e portões dos níveis 4 e 5.
- **Armas e armaduras** na ferraria, por família (infantaria, arqueiros, cavalaria): armas dão ataque, armaduras dão defesa, **+8% por nível, até o nível 3**. O nível 1 usa ferro e couro; os níveis 2 e 3 pedem aço de qualidade, e o 3 também ouro. A ferraria tem fila própria de até 10 itens.
- **Cavaleiro de elite**: mais forte por pessoa que a cavalaria e mais caro por força; cada um usa 1 cavalo de raça.
- **Veterania**: o exército ganha 1 marca por vitória com perdas abaixo de 50% contra inimigo com pelo menos 30% da sua força. Com 2, 5 e 9 marcas: +5%, +10% e +15% de ataque e defesa. Recrutas novos diluem as marcas, cada derrota tira 1, e combate com fauna não conta.
- **Equipamento lendário**: forjado com minério raro, dá **+25% de ataque ou de defesa** a um exército de até 50 tropas (num exército maior, o bônus se dilui). Cada reino forja um. Se o exército for derrotado, o equipamento fica no campo e o vencedor o leva.
- **Teto de bônus**: armas e armaduras, veterania, relíquias, equipamento lendário e legado somam no máximo **+50%**. Torres e portões ficam fora do teto.
- Exércitos em marcha são visíveis no mapa; o tempo de viagem depende de distância, terreno, rotas e da unidade mais lenta.

---

## Combate

- **Semi-automático**: as tropas lutam sozinhas, mas o jogador pode tomar decisões estratégicas durante o combate (ex.: enviar reforços, recuar).
- Cada exército e guarnição tem uma **postura configurável** que funciona sem o jogador online:
  - Atacar qualquer ameaça.
  - Apenas defender.
  - Atacar apenas quem atacar.
- Postura padrão: guarnições em **apenas defender**; exércitos em campo em **atacar apenas quem atacar**.

### Reino como conjunto de alvos

- O reino não é um ponto único: é um **castelo (capital)** mais **locais espalhados** (vilas, minas, serrarias, pastos com animais, armazéns, ferrarias, quartéis).
- Cada local é um alvo com defesa própria. O atacante escolhe **por onde começar** conforme seus objetivos.

### Tipos de ataque

- **Saque**: leva recursos daquele local (madeira, ferro, armas, animais etc.), limitado à capacidade de carga.
- **Sabotagem**: destrói ou danifica construções.
- **Massacre**: mata população do local; enfraquece o reino a longo prazo, sem ganho de recurso.
- **Ocupação**: toma o local e passa a explorá-lo até alguém retomar.
- **Cerco ao castelo**: o ataque mais difícil do jogo.
- Todo ataque é enviado com **objetivos em ordem de prioridade** (ex.: capturar a relíquia + 10 mil de madeira) e uma **tática**. As tropas tentam cumprir os objetivos nessa ordem e sabem quando parar e voltar.
- A tática define o limite de baixas para recuar: **conservadora 25%**, **média 40%**, **agressiva 60%** e **sem limite**.
- Objetivos por tipo: saque (relíquia e recursos), sabotagem (construção do local e torres), massacre (população), ocupação (tomar o local e a relíquia), cerco (portões, torres, relíquia e recursos).
- Se um objetivo não existe no local, as tropas passam ao próximo. Recursos ocupam carga e as tropas voltam quando a carga enche; a relíquia não ocupa carga. Há a opção de completar a carga com o que houver no local.
- O ataque rápido usa o padrão: saque, objetivos automáticos (relíquia à vista e o recurso principal do local), tática média, sem estandarte e rota curta, com as tropas do último ataque.
- A espionagem revela também o **estoque** do alvo. O relatório mostra o resultado de cada objetivo e por que as tropas voltaram.

### Defesa

- Guarnição do local + **população como milícia** + **torres de arqueiros**.
- **Não há muros.** A defesa construída são **torres de arqueiros**: construções próprias, com **alcance**, que protegem os locais em volta. Os arqueiros ficam no alto, protegidos, e o invasor precisa **derrubar a torre** para se livrar deles.
- **Aríetes** derrubam torres e os portões do castelo.
- O alcance e os arqueiros de uma torre crescem com o nível. O castelo tem portões e torres próprias.
- Torres de outros reinos ficam visíveis quando a área já foi explorada.
- O atacante chega apenas com as tropas enviadas, após a viagem; o defensor pode enviar reforços durante a batalha.
- **Recuar** salva tropas e população, mas o local é saqueado.
- Destruir um reino inteiro deve ser **muito difícil e caro**, mesmo para um veterano contra um iniciante.

### Feridos

- **30% das baixas** de quem vence, ou de quem recua pela tática, voltam como feridos. Quem perde sem recuar não tem feridos.
- Cada ferido é curado no castelo com **5 ervas raras**. Sem ervas em **24 h**, morre.

### Queda do castelo

- Se o reino ainda possui outros locais: o castelo vira ruína e a sede vai para o **local de maior nível**, que vira castelo com **metade do nível** do antigo. O reino perde **metade dos recursos guardados**, **30% da população civil** e as relíquias do castelo, que vão com o atacante, sem extinção. Locais acima do novo nível do castelo ficam como estão, mas só sobem quando o castelo passar deles.
- Se perder tudo: o jogador recomeça **em exílio** em um novo ponto do mapa, com um kit de recomeço, mantendo linhagem e relíquias, e recebe **escudo temporário** contra ataques.
- O ponto do exílio é **aleatório e longe de quem derrubou** o reino; escolher a região depende da linhagem.

### Anonimato e bandeiras

- Ser atacado **não revela o atacante**. O relatório mostra apenas forças desconhecidas (tropas, tipo, direção de origem).
- A identidade só é revelada se o atacante escolher levar seu **estandarte**, ou se o defensor descobrir via batedores e espionagem.
- **Bandeiras** podem ser colocadas em qualquer lugar do mapa, como sinal para outros jogadores (reivindicação, ameaça, aliança). Têm valor social, não mecânico.
- Bandeiras **mostram quem as colocou**.
- Cada jogador tem **até 20 bandeiras ativas**, com recado de até 60 caracteres. **Outros jogadores podem derrubá-las** com tropas no local.
- O dono é avisado quando a bandeira cai, sem saber quem derrubou, a não ser que as tropas levassem estandarte.
- Explorar um local de outro reino **não revela o dono**; espionar o local com batedores de elite revela.
- Espiões são **descobertos se alguma tropa os vir**. Ficam no mapa como "visto há X horas" por apenas **10 horas**.
- Para não poluir o mapa, objetos vistos ("visto há X") são **limpos periodicamente**. Vale para espiões e exércitos vistos; o nível de perigo da fauna segue a regra da névoa.

### Território

- Controle de território é **presença física**: construções e tropas no local.
- **Não existe** barra de progresso, placar de domínio ou estado de "mapa conquistado". A disputa é contínua.
- Ruínas e terra livre (locais sem dono) podem ser **ocupadas ou reconstruídas**.

### Pontos de atenção no balanceamento

- Evitar farm de iniciantes: escudo de novato, rendimento decrescente em saques repetidos ao mesmo alvo, milícia proporcional à população.
- O escudo de novato **só é descoberto ao chegar**: o atacante não vê a proteção antes, e as tropas voltam sem combate.
- Saques repetidos ao mesmo alvo rendem **progressivamente menos**, e o atacante é avisado antes de enviar.
- Monitorar abuso do anonimato para assédio.

---

## Reinos controlados por IA

- O mundo nunca deve parecer vazio: existe uma **meta de ocupação** de reinos ativos por mundo, completada por reinos de IA quando faltam jogadores.
- Cada mundo é **controlado para até 30 reinos**, para manter as relíquias como motivo de confronto (uma por reino).
- **Indistinguíveis**: reinos de IA não são identificados como tal para os jogadores.
- **Mesmas regras dos jogadores**: timers, recursos, população e limites idênticos, sem trapaça. Perfis variados (expansionista, defensivo, saqueador, comerciante) e níveis de habilidade diferentes.
- Respeitam o escudo de novato e calibram a agressividade pelo porte do alvo.
- Proteções: escudo de novato de **72 h**; escudo de exílio de **24 h**; regência depois de **48 h** sem entrar.
- **Saída gradual**: conforme jogadores entram, não são criados novos reinos de IA; reinos de IA destruídos não renascem, e excedentes podem abdicar, com seus locais virando ruínas ou terra livre.
- **Entrada quando jogadores saem**:
  - **Regência**: após um período de inatividade, o reino do jogador ausente passa a ser governado por IA. Se o jogador voltar, retoma o controle do que restou.
  - A regência é **conservadora** (defende e produz, sem expansão agressiva), para que abandonar nunca seja vantajoso.
  - Se a ocupação cair abaixo da meta, novos reinos de IA surgem em regiões com pouca atividade.
- Cada temporada começa com mais reinos de IA, que vão saindo conforme a base de jogadores cresce.

---

## Alianças

- Reinos podem formar **alianças** e **pedir recursos a aliados**.
- Alianças têm **limite de membros**, por balanceamento: alianças muito grandes geram problemas. Valor inicial: **5 reinos** por aliança.
- Aliados se reconhecem (nome e brasão) e veem as marchas uns dos outros. Locais de aliados não são alvo de ataque.
- Um pedido de recursos é aceito ou recusado pelo aliado. A ajuda sai dos locais mais próximos dele e viaja visível no mapa, podendo ser roubada.
- **Cargos**: líder (convida, expulsa e promove), até 2 conselheiros (convidam e aceitam pedidos de entrada) e membros.
- **Saída**: qualquer membro sai quando quiser, e o líder pode expulsar. Ao sair ou ser expulso, vale uma **trégua de 24 h** entre o reino e a aliança, garantida pelo jogo, e o reino só entra em outra aliança depois de 24 h. A visão das marchas acaba na hora.
- **Traição**: não há ataque surpresa entre membros. Quem quer atacar um aliado precisa sair e esperar a trégua.
- Se o líder entra em regência, a liderança passa ao conselheiro mais antigo, ou ao membro mais antigo.

---

## Comércio e diplomacia

- **Sem mercado global**: um mercado único quebraria as regras de recurso no local e de roubo no caminho.
- **Troca direta** ("dou X, quero Y") só com reinos conhecidos: aliados, espionados ou identificados por estandarte ou bandeira. A proposta revela quem propõe. Se aceita, as duas cargas saem dos locais mais próximos e viajam visíveis no mapa, podendo ser roubadas.
- **Reinos de IA comerciantes** compram abaixo e vendem acima do valor de referência, só com o próprio estoque e pelas mesmas regras dos jogadores. Mantêm o comércio vivo quando há poucos jogadores.
- **Pacto de não agressão**: qualquer lado propõe, com pagamento em qualquer direção (quem ameaça cobra para não atacar, ou quem teme paga para não ser atacado) ou sem pagamento.
  - Dura de **1 a 7 dias**; cada reino tem até **3 pactos ativos**.
  - Começa quando o pagamento chega; se a carga for roubada no caminho, não começa.
  - **O jogo garante o pacto**: enquanto durar, nenhum dos dois consegue atacar, saquear ou interceptar o outro. Tropas enviadas a um local do outro descobrem o pacto ao chegar e voltam sem combate.
- **Resgate de explorador**: ver Exploradores.
- **Limites para o novato**: enquanto um reino está sob escudo de novato, a diferença entre o que ele dá e o que recebe (trocas, ajuda de aliados, pagamentos) tem limite por dia, para que contas secundárias não alimentem outra. Ninguém pode cobrar pacto de um reino sob escudo.

---

## Experiência do jogador

- **Jogo livre**: sem missões fixas ou obrigatórias; nada força o jogador a fazer algo.
- Sistemas são apresentados **aos poucos**, conforme o jogador chega a eles, em vez de tudo de uma vez.
- **Atacar em 3 passos**: escolher a tropa, tocar no destino no mapa e confirmar. Tudo já vem com padrões; os detalhes (tipo, objetivos, tática, estandarte) ficam numa opção de **ajuste**.
- Tropas podem **andar pelo mapa**: o destino pode ser um alvo, um local seu ou qualquer ponto. Num ponto qualquer, as tropas ficam lá com a postura "atacar apenas quem atacar".
- **Modelos de ataque**: o jogador pode salvar envios prontos e repetir o último ataque.
- Opções e sistemas só aparecem **quando fazem sentido** para o jogador; nada é bloqueado. Antes do gatilho, somem os menus e botões do sistema; o mundo continua igual. Ao aparecer, um aviso curto apresenta o sistema. Gatilhos:
  - Transporte manual de recursos: ao fundar o primeiro local longe do castelo.
  - Espionagem: ao ver o primeiro espião ou sofrer o primeiro ataque.
  - Torres de arqueiros: ao ver forças desconhecidas perto do reino.
  - Relíquias: ao avistar a primeira ruína antiga ou um farol.
  - Alianças: ao conhecer o primeiro reino.
- Uma tela mostra **o que precisa de atenção** (ameaças, oportunidades, filas paradas), sem obrigar nenhuma ação e sem recompensa.

---

## Temporadas e legado

- Mundo organizado em **temporadas de 70 dias**, com reset de mapa e reinos.
- Objetivo: evitar domínio permanente dos primeiros jogadores sem desanimar veteranos.
- **Legado** que atravessa temporadas:
  - **Relíquias da temporada**: itens únicos e limitados, ganhos por conquistas, com bônus pequeno e com teto (o teto vale para a soma das relíquias).
    - Ganhas no fim da temporada por: ficar entre os 3 primeiros de uma categoria do ranking (menos perdas), terminar com uma relíquia lendária em seu poder, ou ter vencido um cerco a um castelo.
    - Cada uma dá **+1% a +2%** (produção, ataque, defesa ou crescimento da população). Até **3 equipadas** por temporada, com **teto somado de 5%**, que também conta no teto de bônus de combate.
  - **Títulos, brasões e skins** permanentes, mostrando o histórico do jogador.
  - **Linhagem**: progressão de conta que desbloqueia opções, não poder bruto.
    - Níveis de 1 a 10. Sobe 1 nível por temporada jogada (ativo em pelo menos 30 dos 70 dias) e 1 por relíquia da temporada ganha.
    - Desbloqueios: nível 2, cores e formas extras de brasão; nível 3, títulos; nível 5, escolher a região inicial; nível 7, escolher a região do exílio; nível 10, brasão da casa com moldura de linhagem.
- Novos jogadores devem conseguir competir; veteranos carregam identidade e vantagem pequena.
- **Ranking da temporada** por reino: total de baixas causadas, perdas, quantidade de tropas e famílias (população civil). Não mede território (continua sem placar de domínio).

---

## Monetização

- **Nenhuma** neste momento. Prioridade é ter jogadores.
- Direção futura: **sem pay-to-win**.
  - Permitido: cosméticos (castelos, tropas, brasões, bandeiras) e passe de temporada cosmético.
  - Avaliar com cuidado: conveniências de assinatura.
  - Proibido: venda de aceleração de timers e de recursos.

---

## Em aberto

- Ajuste fino do balanceamento com testes. Valores atuais: **balanceamento v1 aprovado** e **v2 em validação** (valiosos, comércio, ferraria, eras, veterania, feridos, lendário e queda do castelo) em `balanceamento/README.md`, com modelo e simulação em `balanceamento/modelo.js`.
- Validar as regras propostas de eras, veterania, alianças (cargos, saída e trégua), legado (relíquias da temporada e linhagem) e queda do castelo.
