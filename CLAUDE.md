# Reino de Pedra

Jogo de estratégia medieval de conquista de território, multiplayer, persistente e em tempo real. Feito para **computador** (mouse de dois botões, teclado e monitor grande); o cliente é web.

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
- **Nome de branch diz o que ela entrega.** Em português, kebab-case, 2 a 5 palavras, sem id, hash, data ou nome de sessão: `correcoes-usabilidade-paineis`, `marcha-revela-nevoa`, `mapa-maior-tropas-rapidas`, `docs-decisao-ia`. Um prefixo fixo da ferramenta (ex.: `claude/`) pode ficar antes do nome. Sessão que começa numa branch com nome automático (`claude/abc123`, `ccr-…`) a renomeia com `git branch -m` antes do primeiro commit; se a branch já foi publicada, cria a nova com o nome certo e abandona a antiga. A mensagem do primeiro commit e o título do PR dizem a mesma coisa que o nome da branch.

---

## Visão do jogo

- Gênero: MMO de estratégia persistente (4X), com construção e ações por **tempo real** (timers), **sem turnos**.
- Referências de gênero: Travian, Tribal Wars, Stronghold Kingdoms, Rise of Kingdoms.
- Diferencial: **exploração real** de um mapa grande, com recursos valiosos escondidos que precisam ser descobertos.
- O mundo continua funcionando com o jogador offline: construções terminam, tropas marcham e defesas reagem.
- **Multiplayer desde o início**: todos os jogadores no mesmo mapa.
- **Um único mundo**, por enquanto. Novos jogadores entram enquanto houver vaga ou reino de IA para dar lugar; com o mundo cheio e sem IA, ninguém mais entra até a próxima temporada. Não há ajuda especial para quem entra tarde.
- Uma vaga com local de outro reino em algum dos seus hexágonos não recebe reino novo; ruína ou terra livre sem dono dá lugar, salvo se guarda relíquia ou equipamento lendário.
- Sessões curtas: o jogador dá ordens longas, sai e recebe notificações.
- Notificações são **configuráveis por categoria** (inclusive ataques), liga e desliga, sem horário de silêncio.

---

## Mapa e exploração

- Mapa **grande**, que exige deslocamento real: distância e terreno importam. Para 30 reinos: **312 × 240 hexágonos pequenos** (cerca de 2.500 por reino); a travessia com tropa lenta leva perto de 1 h (menos com rota ou cavalaria), o reino vizinho fica a 10 a 15 min e as curtas distâncias (6 a 10 hexágonos) levam 1 a 2 min. Um reino pode não encontrar todos os outros na temporada.
- **Construções ocupam vários hexágonos**, conforme o tamanho: o castelo ocupa 7 (o hexágono e o anel em volta), os outros locais 3 (o hexágono e os vizinhos de leste e oeste), o posto 1. Fundar exige o espaço inteiro explorado, sem rio e livre; tocar em qualquer parte da construção é tocar no local.
- Coberto por **névoa**: no início o jogador só conhece o entorno do seu reino. Informações de áreas exploradas envelhecem e mostram o último estado conhecido. Na Vista, a névoa é uma bruma de tom médio com borda suave (sem aresta de hexágono); o explorado fica com as cores apagadas, e a visão atual, com cor e movimento.
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

- Cada explorador é **uma pessoa do reino, com nome** (treinada no castelo a partir de um civil). Pode ser capturado ou morto; o relatório diz quem.
- Quem captura um explorador vê o **reino de origem** e o **nome** da pessoa, e tem **24 h** para pedir resgate, libertar ou executar. Sem decisão, o explorador é libertado e a mesma pessoa volta para casa.
- Só explorador **sem escolta** é capturado, ao passar à vista de tropas de outro reino; o batedor de elite só é pego espionando. Resgate pedido e não pago no prazo também liberta.
- O preso fica num **local de quem capturou**: a guarnição que o viu, o local espionado ou, se foram tropas em campo, o local do captor mais perto de onde ele foi pego.
- **O dono negocia** sem precisar saber quem capturou: oferece um pagamento ou contrapropõe o resgate pedido; quem capturou aceita, recusa ou pede outro valor. Aceita, o pagamento sai na hora, viaja visível e pode ser roubado; ao chegar, o explorador é solto. Pedir resgate e aceitar a oferta revelam quem capturou; oferecer e recusar, não.
- **Resgate à força**: qualquer ataque vitorioso no local onde ele está preso o liberta, e ele volta para casa. O dono sabe onde ele foi pego e para que direção foi levado; o local exato, só se ele foi pego espionando aquele local ou se um batedor espiona o local e o vê lá (a espionagem mostra os presos e revela o captor). Local tomado ou arruinado solta todos os presos dali.
- Ordens possíveis: explorar área, seguir rota, patrulhar, retornar.
- **Seguir rota se desenha no mapa**: escolhida a ordem, cada clique num hexágono é um ponto, sem diálogo. A linha no chão é o caminho real, pela rota segura ou curta, e o tracejado vai do último ponto ao mouse. Enter envia, Z desfaz, O fecha o circuito, Esc cancela.
- **O explorador não volta sozinho.** Ao chegar ao destino, fica lá esperando nova ordem (outro lugar, rota, patrulha ou voltar), mantendo a área à vista. A rota é desenhada ponto a ponto; no fim, espera no último ponto, ou recomeça do primeiro se for um circuito.
- Exploradores vão pela **rota segura por padrão**: desviam do perigo que o reino conhece; quem envia pode escolher a rota curta.

### Fauna hostil

- Animais selvagens ocupam o mapa conforme o terreno: lobos e javalis em florestas, ursos em montanhas e colinas, crocodilos em pântanos e rios.
- Ameaçam principalmente **exploradores sozinhos, grupos pequenos de extração e caravanas**; exércitos médios passam praticamente ilesos.
- Criam a escolha entre **rota curta e perigosa** ou **longa e segura**, ou levar escolta. Rotas construídas reduzem a presença de animais (um nível de perigo a menos no hexágono com rota).
- **Caçar** rende comida e materiais (couro, peles). A caçada é uma luta com o bando pela mesma regra de perdas; se sobra alguém, o grupo traz o que couber na carga.
- Áreas exploradas mostram o **nível de perigo**, sujeito ao mesmo envelhecimento de informação da névoa.
- Animais se movem e **reaparecem** por região ao longo do tempo; um bando abatido volta em 24 h, e área limpa não fica segura para sempre.
- Um ataque de animais **fere**: cada animal do bando ataca uma pessoa diferente do grupo e tira vida (mais quanto maior o risco para a força do grupo); morre só quem chega a zero, e os feridos seguem andando. Com o dobro da força dos animais, o grupo passa ileso. Um explorador sozinho sobrevive a um ataque, salvo no perigo alto; a cavalo (ou batedor) pode fugir do bando sem se ferir. Carregadores fogem e perdem parte da carga; caravanas perdem a mesma parte da carga.
- A caçada é uma luta até o fim e continua pela regra de perdas.
- Perto dos reinos iniciais a fauna é mais fraca, para não punir iniciantes.

### Rotas

- Rotas construídas funcionam como **ruas públicas**: qualquer jogador vê, usa e recebe as mesmas vantagens de deslocamento.
- Quem constrói paga o custo; a rota pode beneficiar inclusive inimigos.
- O custo e o tempo de cada hexágono de rota crescem com o terreno (floresta, montanha e pântano custam mais). Num rio, a rota precisa de **ponte**, mais cara; sem ponte, só pelo vau, mais lento.
- Rotas **não atravessam a névoa**: só aparecem nas áreas que o jogador já explorou.

---

## Recursos

- **Básicos**: madeira, pedra, comida, ferro. Espalhados pelo mapa, base da economia.
- **Valiosos**: aço de qualidade, cavalos de raça, ouro, prata, sal, ervas raras e pedras preciosas. Raros, liberam unidades e tecnologias melhores.
- **Lendários**: minério raro, relíquias, ruínas antigas. Pouquíssimos no mapa, bônus únicos, alvo de disputa.
- **Couro e peles**: recursos do reino, obtidos pela caça.
- Recursos valiosos e lendários ficam **ocultos** até serem descobertos. Jazida oculta não impede fundar nem erguer torre no hexágono; ela segue oculta embaixo.
- Jazidas são **finitas** e se esgotam com o tempo.
- A **serraria rende 1,5×** o que os outros locais do mesmo nível rendem: as obras gastam 45% em madeira.
- **O reino base já gera recursos básicos** suficientes para recrutar tropas básicas, sem depender de exploração.
- Recursos ficam **no local** onde estão. Para usar (construir, recrutar), é preciso **transportá-los até o local** onde são necessários; não dá para usar recurso "de qualquer lugar". Vale a mesma lógica das relíquias: o transporte é feito por tropas e a carga pode ser **roubada no meio do caminho**.
- **Veículos de transporte** (ex.: carroças) facilitam o transporte e também são construídos com recursos.
- **Construir gera uma requisição**: os recursos que faltam são enviados automaticamente pelos locais **mais próximos**, levados por tropas ou população, sem ação manual. A construção mostra que está **aguardando a chegada dos recursos**, e o transporte é visível no mapa. Quem constrói se preocupa com o tempo, sem precisar aprender a enviar recursos de um lugar para outro desde o início.
- O **envio manual** de recursos de um local para outro continua possível.
- Cada local **acumula a própria produção** e guarda até **10 h** dela; o excedente vai para o armazém, onde também ficam os recursos valiosos. O estoque do local é o que um saque pode levar.
- **Nenhum local passa do nível do castelo.** Melhorar o castelo custa e demora mais que um local do mesmo nível.
- **Novos locais podem ser fundados em qualquer hexágono livre**, sem limite de distância, de vizinhança ou de quantidade. O custo crescente de cada novo local e o transporte do material até lá são os únicos freios.
- A obra entra na fila e **só começa quando o material chega**. Os carregadores da requisição são **pessoas do local de origem** (quem está sem trabalho primeiro, depois trabalhadores, que deixam a vaga vazia enquanto carregam), vão a pé e sem escolta, cada uma com um carrinho de mão (30 de carga, contra 5 na mochila de um soldado) e fazem mais viagens quando falta gente; depois da última entrega voltam para casa. Roubados no caminho, perdem a carga e fogem para casa. Sem ninguém livre na origem, a carga ainda viaja: a requisição nunca trava.
- Civis a caminho dentro do reino (troca de trabalho, carregadores) não são alvo da fauna nem de interceptação: gente desarmada foge.
- Se o local de uma obra deixa de ser seu (ocupado ou destruído), o material dela volta ao castelo ao cancelar ou ao terminar; nunca fica com o novo dono.
- Carroças ficam no castelo: saem, buscam a carga na origem e a levam. Escolta é opcional; caravana pouco protegida recebe aviso.
- A carga da caravana só sai da origem quando ela chega lá; depois de entregar, carroças e escolta voltam. Sem carroças, as próprias tropas carregam. Roubada no caminho, a carga vai ao vencedor e as carroças se perdem.
- Pouco protegida: escolta com força abaixo do perigo médio da fauna. É só aviso.
- Na caravana manual, valiosos só vão para o armazém ou o castelo.

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
- Até **6 tropas por jazida**; juntar tropas demais rende cada vez menos por tropa.
- O grupo extrai até a carga encher (ou a jazida acabar), leva ao armazém ou castelo mais próximo e, se pedido, volta. Grupos na mesma jazida dividem o que resta. Nova ordem interrompe e leva o que já tirou.
- O posto vira um local do reino no hexágono da jazida ou ruína; enquanto existir, outro reino não extrai nem escava ali.

### Coleta de madeira e pedra

- Tropas e **civis sem trabalho** podem **coletar** num hexágono explorado sem local: madeira na floresta, pedra na colina e na montanha.
- O grupo coleta até a carga encher (um civil leva um feixe; um soldado, a carga da unidade), leva ao local próprio mais próximo que guarda o recurso (castelo, armazém ou o local que o produz) e, se pedido, volta; se o hexágono acabou, passa a um igual ali perto.
- Até **6 pessoas por hexágono**; quanto mais gente, menos cada uma rende. Por pessoa, rende o mesmo que um trabalhador de local no começo: vale para quem está sem vaga, não substitui os locais.
- Cada hexágono tem um estoque que **acaba** e **volta a encher** com o tempo.
- Civis coletando estão fora do local: não defendem como milícia nem podem ser recrutados até voltar. Os animais podem feri-los.

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
- Cada ruína antiga guarda **1 relíquia**, de tipo desconhecido até ser achada, e se esgota depois. Uma unidade já escava; mais tropas e posto encurtam, com tempo mínimo. Tropas mandadas depois à mesma ruína se juntam ao grupo que já escava, sem recomeçar: mais gente, menos tempo. O grupo que escava leva a relíquia ao local escolhido antes de partir.
- Mover uma relíquia: tropas saem, buscam e levam; até ser pega, ela continua fortalecendo a origem.
- A escavação depende do número de tropas, não da carga; interrompida, recomeça do zero. Se outro grupo acha a relíquia antes, os demais voltam.
- Uma marcha que leva relíquia aparece com um baú para quem a vê, sem revelar o tipo.
- **Saque, ocupação ou cerco** vitorioso levam a relíquia; sabotagem e massacre, não. No saque e no cerco, as tropas a carregam de volta; na ocupação, ela fica no local tomado.
- Uma marcha que leva relíquia pode ser **interceptada**: as tropas precisam chegar antes a um ponto do caminho.
- Qualquer marcha alheia à vista (exército, caravana, carregadores) pode ser interceptada. As tropas esperam no ponto de encontro; se a marcha mudar de rota, a interceptação falha e elas voltam.
- Relíquias lendárias ficam na temporada e são distintas das relíquias da temporada (legado).
- Objetivo: tornar o PvP mais desejável, com alvos que dão vantagem real além de recursos.

### Tempos

- Recursos e construções básicas: **tempos baixos**.
- Recursos e construções mais fortes ou valiosos: **tempos mais altos**.
- O equilíbrio entre tempos, custos e rendimento é ponto central de balanceamento e deve ser ajustado com testes.
- **Filas de construção e de recrutamento aceitam até 10 itens**, executados um por vez, para o jogador planejar horas ou a noite inteira.
- Num item com várias unidades (tropas, exploradores, mensageiros, carroças), **cada unidade fica pronta ao fim do seu próprio tempo** (a 1ª em um tempo, a 2ª em dois...) e já pode ser usada antes das seguintes. O item continua um só na fila; cancelar devolve material e população só das que ainda não ficaram prontas.
- **Deslocamento não deve demorar excessivamente.** Viagens de muitas horas, sem outras ações para o jogador cuidar enquanto espera, afastam o jogador e quebram a imersão.

---

## População

- **Toda pessoa do reino é um indivíduo**: nome próprio, ofício, onde mora, onde está e o que faz. A população civil é a contagem das pessoas civis; o reino novo começa com 8 civis, além da guarnição e dos exploradores do início. A escala é de dezenas, não de centenas (valores em `balanceamento/`).
- **Ofícios civis** ligados aos locais: agricultor (vila e pasto), lenhador (serraria), pedreiro (pedreira), mineiro (mina) e sem ofício (quem fica no castelo sem vaga). Soldados têm o ofício da unidade; explorador, prospector, batedor e mensageiro também são ofícios.
- **Cada nível de local de produção abre vagas de trabalho** (1 vaga até o nível 4, 2 até o 8, 3 nos níveis 9 e 10). Uma vaga vazia produz menos: a produção do local é proporcional às vagas ocupadas por quem está presente. Castelo, quartel, armazém, ferraria e posto não têm vagas.
- **Atribuição automática por padrão.** Uma pessoa nova vai para a vaga mais necessária (o ofício anterior, se tem vaga; senão o local com mais vagas livres, o mais perto). Subir de nível, fundar ou ocupar um local chama quem está sem trabalho. O jogador pode reatribuir qualquer pessoa: tocar nela e escolher outro trabalho ou outro local; ela caminha até lá, visível no mapa. Quem é levado ao castelo sem trabalho fica assim: a vaga que deixou é do jogador. Nada obriga a microgerenciar.
- **Teto** definido por moradias (e pelo castelo). Cresce construindo moradias, cada uma mais cara que a anterior.
- **Tropas ocupam o teto**: soldados também moram no reino. População civil + tropas ≤ teto.
- **Nascimento com nome.** O crescimento é por tempo (mais rápido com excedente de comida; abaixo de 3 pessoas, em linha, para recrutar todos não travar o reino) e cria pessoas inteiras, uma por vez, no castelo; cada uma caminha até a vaga mais necessária.
- **Vida.** Toda pessoa tem vida, com o máximo pelo ofício, que volta sozinha com o tempo (inteira em algumas horas). Soldado no castelo do próprio reino, fora de batalha, recupera **10% da vida por minuto**. Animais tiram vida; quem sai vivo de uma batalha sai ferido na proporção das perdas do seu lado (sem morrer por isso: quem morre na batalha continua saindo das perdas). A barra de vida aparece na folha da pessoa e, no mapa, sobre quem está ferido.
- **Morte com nome.** Batalha, fauna (quando a vida chega a zero), massacre, ferimento sem ervas e execução matam pessoas específicas, e o relatório diz quem.
- **Recrutar converte uma pessoa**: o treino tira um civil (quem está sem trabalho primeiro; senão, um trabalhador do local de nível mais baixo) e o devolve como soldado com o mesmo nome. Cancelar devolve o civil ao ofício anterior. Tropas mortas não retornam; feridos curados com ervas voltam (ver Combate).
- **Carregadores são pessoas** (ver Recursos). **Milícia são as pessoas presentes** (ver Combate).
- Objetivo: criar a decisão central entre **tropas e economia**, agora com rostos.
- Moral e migração ficam para depois, apenas se o balanceamento pedir.

---

## Tropas e evolução

- **Toda tropa é uma pessoa** com nome e ofício da unidade: está na guarnição de um local, em marcha, caçando, extraindo ou parada num hexágono. Cada unidade (inclusive aríete e trebuchet) é uma pessoa.
- Tipos de unidade: milícia, lanceiro, arqueiro, cavalaria, cavaleiro de elite e máquinas de cerco (aríete, trebuchet).
- O castelo recruta milícia, lanceiro e arqueiro; o quartel recruta todas as unidades.
- Vantagens por **família**: lança vence cavalaria (inclusive a de elite), cavalaria vence arqueiros, arqueiro vence infantaria.
- **Eras**: Ferro (inicial), Aço e Cerco Avançado. Cada era seguinte custa ouro e libera:
  - Era do Ferro: armas e armaduras do nível 1.
  - Era do Aço: armas e armaduras dos níveis 2 e 3, cavaleiro de elite e equipamento lendário.
  - Era do Cerco Avançado: trebuchet e portões dos níveis 4 e 5.
- **Armas e armaduras** na ferraria, por família (infantaria, arqueiros, cavalaria): armas dão ataque, armaduras dão defesa, **+8% por nível, até o nível 3**. O nível 1 usa ferro e couro; os níveis 2 e 3 pedem aço de qualidade, e o 3 também ouro. A ferraria tem fila própria de até 10 itens. Num grupo misto, cada família recebe o bônus dela (o do grupo é a média ponderada pela força de cada família). A milícia, inclusive a da população, é infantaria; os arqueiros no alto das torres usam as armaduras dos arqueiros. Os requisitos de nível olham a maior ferraria (e o maior quartel) do reino.
- **Cavaleiro de elite**: mais forte por pessoa que a cavalaria e mais caro por força; cada um usa 1 cavalo de raça.
- **Veterania por pessoa**: cada soldado guarda as próprias marcas. Vitória com perdas abaixo de 50% contra inimigo com pelo menos 30% da força do grupo dá 1 marca a cada sobrevivente; cada derrota tira 1; combate com fauna não conta. O bônus do grupo (exército ou guarnição) é a média das marcas: com 2, 5 e 9, +5%, +10% e +15% de ataque e defesa. Recrutas novos diluem a média; ao enviar por quantidade, os mais veteranos saem primeiro.
- **Equipamento lendário**: forjado com minério raro, dá **+25% de ataque ou de defesa** a um exército de até 8 tropas (num exército maior, o bônus se dilui). Cada reino forja um por temporada (o capturado não conta). Fica sempre com um grupo: nasce na guarnição da ferraria, vai com o próximo exército que sair do local quando o jogador marca "levar" e fica na guarnição do local onde o exército entrar. Vale para a guarnição (defesa) e para o exército (ataque ou defesa em campo); conta um de cada tipo por grupo, e na guarnição a milícia e os arqueiros no alto também diluem. O grupo que perde a batalha, mesmo recuando, ou que é vencido no caminho, deixa o equipamento no campo e o vencedor o leva (na ocupação, ele fica no local tomado). Se o grupo some sem batalha (morto pela fauna, por exemplo), ninguém o leva: o equipamento volta à guarnição do castelo do dono. A espionagem do local mostra o equipamento na guarnição, sem revelar quem o forjou.
- **Teto de bônus**: armas e armaduras, veterania, relíquias, equipamento lendário e legado somam no máximo **+50%**. Torres e portões ficam fora do teto.
- **Um exército é um grupo de pessoas.** O jogador forma o grupo tocando um soldado, juntando vários (modo de seleção ou laço) ou por atalho ("todos deste tipo aqui", "todo o grupo"), e dá a ele uma **missão**: mover, atacar, caçar, extrair, escavar, interceptar, guarnecer ou reforçar um aliado. Os serviços continuam aceitando quantidade por tipo (ataque rápido, modelos, IA): nesse caso o servidor escolhe as pessoas, as mais veteranas para atacar.
- Exércitos em marcha são visíveis no mapa; o tempo de viagem depende de distância, terreno, rotas e da unidade mais lenta.
- Além de ir a um lugar, as tropas seguem a **linha exata desenhada no mapa** (arrastando ou de hexágono em hexágono): **patrulhar** repete até nova ordem, indo e voltando numa linha aberta ou dando a volta num circuito fechado; **só uma vez** para no fim da linha. Primeiro vão até o começo da linha pelo caminho de sempre.
- **Juntar tropas:** duas tropas em campo viram uma. No mesmo hexágono, na hora; em hexágonos diferentes, a primeira vai até a outra (e segue atrás, se ela andar) e se junta ao chegar. Fica a segunda, com a ordem e a postura dela; carga, relíquias e equipamento lendário passam para ela, e o passo é o da unidade mais lenta. Soldados de uma guarnição também podem sair para se juntar a uma tropa.
- **Separar tropas:** quem sai forma uma tropa nova, parada onde está, com a parte da carga que cabe a ela; relíquias e equipamento ficam com quem fica.
- Em batalha, ou caçando, extraindo, escavando, coletando ou atacando, a tropa não se separa nem recebe gente.
- **Toda tropa revela a névoa** por onde passa e onde fica (parada, caçando ou extraindo), com o raio de visão da unidade de maior visão do grupo: milícia, lanceiro e máquinas de cerco 2 hexágonos; arqueiro, cavalaria e cavaleiro de elite 4 (exploradores têm a visão própria). A névoa se abre quase ao vivo enquanto a marcha anda. Uma marcha do próprio reino nunca some do mapa do dono.

---

## Combate

- **Semi-automático**: as tropas lutam sozinhas, mas o jogador pode tomar decisões estratégicas durante o combate (ex.: enviar reforços, recuar).
- Cada exército e guarnição tem uma **postura configurável** que funciona sem o jogador online:
  - Atacar qualquer ameaça.
  - Apenas defender.
  - Atacar apenas quem atacar.
- Postura padrão: guarnições em **apenas defender**; exércitos em campo em **atacar apenas quem atacar**.
- Quem ataca qualquer ameaça sai contra forças hostis que passam a até 2 hexágonos; quem ataca apenas quem atacar só revida contra o reino que atacou seus locais ou exércitos na última hora. A guarnição sai sem a milícia e volta com o que tomou.

### Reino como conjunto de alvos

- O reino não é um ponto único: é um **castelo (capital)** mais **locais espalhados** (vilas, minas, serrarias, pastos com animais, armazéns, ferrarias, quartéis).
- Cada local é um alvo com defesa própria. O atacante escolhe **por onde começar** conforme seus objetivos.

### Tipos de ataque

- **Saque**: leva recursos daquele local (madeira, ferro, armas, animais etc.), limitado à capacidade de carga.
- **Sabotagem**: destrói ou danifica construções.
- **Massacre**: mata população do local; enfraquece o reino a longo prazo, sem ganho de recurso.
- **Ocupação**: toma o local e passa a explorá-lo até alguém retomar. O local vira seu e mantém o nível; se estiver acima do seu castelo, só sobe quando o castelo passar dele.
- **Cerco ao castelo**: o ataque mais difícil do jogo.
- Todo ataque é enviado com **objetivos em ordem de prioridade** (ex.: capturar a relíquia, depois madeira, depois ferro) e uma **tática**. As tropas tentam cumprir os objetivos nessa ordem e sabem quando parar e voltar.
- **Recurso não tem quantidade**: o jogador escolhe a ordem e o jogo decide quanto trazer, pela carga e pelo estoque. A carga se divide de duas formas, à escolha no envio: **por prioridade** (enche com o primeiro recurso, depois com o seguinte) ou **igual** (a mesma parte para cada recurso; o que faltar de um vai para os outros).
- **Recuar sem o que levar**: no saque, uma opção do envio, ligada por padrão, faz as tropas voltarem quando não há no local nada do que foi pedido. Elas olham ao chegar (voltam sem combate) e sempre que a batalha muda (outra frente levou tudo, por exemplo: recuam com as baixas que já tiveram). Desligada, lutam mesmo assim, e a tela da batalha avisa que não há o que levar, com o botão de recuar. O relatório diz por que voltaram.
- A tática define o limite de baixas para recuar: **conservadora 25%**, **média 40%**, **agressiva 60%** e **sem limite**.
- Objetivos por tipo: saque (relíquia e recursos), sabotagem (construção do local e torres), massacre (população), ocupação (tomar o local e a relíquia), cerco (portões, torres, relíquia e recursos).
- A batalha dura alguns minutos (mais com mais tropas), tempo para reforços e recuo; reforços que entram antes do fim lutam. **O tempo encurta conforme as tropas morrem**: com metade das tropas vivas, a batalha corre no dobro do ritmo.
- **Vários ataques ao mesmo tempo**: um segundo ataque do mesmo reino se junta ao primeiro; o de outro reino abre outra **frente** na hora, sem esperar. As mesmas tropas defendem todas as frentes: a defesa enfrenta a soma dos ataques e se divide entre eles, na proporção da força de cada um. Cada frente tem o próprio tempo, plano e relatório, e leva o que achar quando vence. Ao acabar uma frente, a defesa que sobrou se redivide entre as outras. Se o local cai numa frente, as outras voltam com as baixas que já tiveram. A defesa que recua sai de todas as frentes de uma vez.
- A tela da batalha e o mapa mostram **ao vivo** quem está ganhando (barra com a força de cada lado) e as baixas de cada lado, e a tela lista as frentes. O número é a projeção do resultado: um reforço pode mudá-lo.
- A milícia e o massacre usam as **pessoas civis presentes no local**: quem trabalha ali e quem está no castelo sem trabalho. O massacre mata pessoas específicas, com nome no relatório.
- Sabotagem tira níveis; um local (que não seja o castelo) que chega ao nível 0 vira ruína sem dono. Uma melhoria na fila sobe só um nível e não passa do castelo (parada, o material fica no local): não desfaz a sabotagem. Aríetes batem só na vitória; trebuchets, de longe, mesmo na derrota.
- Ruína e terra livre sem defesa são ocupadas na chegada, sem batalha.
- Torres ficam a até 4 hexágonos de um local próprio.
- Se um objetivo não existe no local, as tropas passam ao próximo. Recursos ocupam carga; a relíquia não ocupa carga. Há a opção de completar a carga com o que houver no local.
- O ataque rápido usa o padrão: saque, objetivos automáticos (relíquia à vista e o recurso principal do local), carga por prioridade, recuar sem o que levar, tática média, sem estandarte e rota curta, com as tropas do último ataque.
- Clicar num local de outro reino mostra o que atacar pode render: o recurso que ele produz (se vê de fora), relíquia se houver e o próprio local na ocupação. Quanto há guardado, só a espionagem revela.
- A espionagem revela também o **estoque** do alvo. O relatório mostra o resultado de cada objetivo e por que as tropas voltaram.
- **Força inimiga antes da batalha**: o envio de ataque mostra a guarnição do local por unidade, a milícia (civis presentes), as torres e os portões, e a batalha estimada pela mesma fórmula contra as tropas escolhidas (força dos dois lados, perdas, vantagem ou desvantagem). À vista agora, vale o que se vê, sem os bônus de defesa; fora da vista, o último relatório de espionagem, com a idade, que também revela os bônus. Sem nenhum dos dois, só as torres conhecidas. Não revela o dono, o escudo nem o pacto.
- **Reconhecer**: as tropas vão em direção ao local e param à vista dele, a até 3 hexágonos (ou a visão do grupo, se menor), sem atacar. O relatório traz a força estimada; dali, o jogador ataca ou manda voltar. O último reconhecimento fica gravado no local: clicar nele no mapa, de qualquer distância, mostra o que se viu naquele momento (guarnição por unidade, quantidade, milícia, torres e a força contra a das tropas que foram), com a idade, sem se atualizar sozinho.

### Defesa

- Guarnição do local + **civis presentes como milícia** (cada um luta com a defesa de milícia do modelo; quando a defesa perde, 25% dos que lutaram morrem e os outros fogem) + **torres de arqueiros**.
- **Não há muros.** A defesa construída são **torres de arqueiros**: construções próprias, com **alcance**, que protegem os locais em volta. Os arqueiros ficam no alto, protegidos, e o invasor precisa **derrubar a torre** para se livrar deles.
- **Aríetes** derrubam torres e os portões do castelo.
- O alcance e os arqueiros de uma torre crescem com o nível. O castelo tem portões e torres próprias.
- Torres de outros reinos ficam visíveis quando a área já foi explorada.
- O atacante chega apenas com as tropas enviadas, após a viagem; o defensor pode enviar reforços durante a batalha.
- **Recuar** salva tropas e população, mas o local é saqueado.
- As perdas de cada lado são pessoas sorteadas dentro de cada unidade (numa guarnição com reforço aliado, divididas na proporção de cada reino). O relatório diz quem morreu.
- Destruir um reino inteiro deve ser **muito difícil e caro**, mesmo para um veterano contra um iniciante.

### Feridos

- **30% das baixas** de quem vence, ou de quem recua pela tática, voltam como feridos. Quem perde sem recuar não tem feridos.
- **Feridos são pessoas**: cada uma espera no castelo com o próprio nome e o seu prazo. Cada ferido é curado no castelo com **5 ervas raras**. Sem ervas em **24 h**, morre (o aviso diz quem).
- Os feridos ficam no castelo e ocupam o teto. A cura entra numa fila própria, as ervas vêm pela requisição e cada cura leva 2 h; cancelada, os feridos voltam a esperar com o prazo de antes. Curados, voltam à guarnição do castelo.

### Queda do castelo

- Se o reino ainda possui outros locais: o castelo vira ruína e a sede vai para o **local de maior nível**, que vira castelo com **metade do nível** do antigo. O reino perde **metade dos recursos guardados**, **30% da população civil** e as relíquias do castelo, que vão com o atacante, sem extinção. Locais acima do novo nível do castelo ficam como estão, mas só sobem quando o castelo passar deles.
- Se perder tudo: o jogador recomeça **em exílio** em um novo ponto do mapa, com um kit de recomeço (inclusive soldados novos, com nome), mantendo linhagem e relíquias, e recebe **escudo temporário** contra ataques. Seguem o reino as pessoas de recomeço (as presentes primeiro), quem está em marcha, os feridos e os presos; o resto fica para trás.
- O ponto do exílio é **aleatório e longe de quem derrubou** o reino; escolher a região depende da linhagem.
- O castelo caído vira ruína sem dono, que pode ser ocupada ou reconstruída como qualquer ruína. No exílio, o reino recomeça só com um castelo nível 1, o kit e a população de recomeço; exércitos em campo e o que carregam seguem com ele. O material das obras na fila e as carroças, exploradores e mensageiros parados no castelo se perdem.

### Anonimato e bandeiras

- Ser atacado **não revela o atacante**. O relatório mostra apenas forças desconhecidas (tropas, tipo, direção de origem).
- A identidade só é revelada se o atacante escolher levar seu **estandarte**, ou se o defensor descobrir via batedores e espionagem.
- **Bandeiras** podem ser colocadas em qualquer lugar do mapa, como sinal para outros jogadores (reivindicação, ameaça, aliança). Têm valor social, não mecânico.
- Bandeiras **mostram quem as colocou**.
- Cada jogador tem **até 20 bandeiras ativas**, com recado de 3 a 60 caracteres, em hexágonos que já explorou. **Outros jogadores podem derrubá-las** com tropas no local, que voltam depois. Ver uma bandeira torna o autor conhecido.
- O dono é avisado quando a bandeira cai, sem saber quem derrubou, a não ser que as tropas levassem estandarte.
- Explorar um local de outro reino **não revela o dono**; espionar o local com batedores de elite revela.
- Espiões são **descobertos se alguma tropa os vir**. Ficam no mapa como "visto há X horas" por apenas **10 horas**.
- Ao espionar um local, o batedor pode ser visto: a chance cresce com as torres no alcance e com a guarnição, até um máximo. Visto, metade das vezes é capturado e o relatório não volta.
- Para não poluir o mapa, objetos vistos ("visto há X") são **limpos periodicamente**. Vale para espiões e exércitos vistos; o nível de perigo da fauna segue a regra da névoa.

### Território

- Controle de território é **presença física**: construções e tropas no local.
- **Não existe** barra de progresso, placar de domínio ou estado de "mapa conquistado". A disputa é contínua.
- Ruínas e terra livre (locais sem dono) podem ser **ocupadas ou reconstruídas**.

### Pontos de atenção no balanceamento

- Evitar farm de iniciantes: escudo de novato, rendimento decrescente em saques repetidos ao mesmo alvo, milícia proporcional à população.
- O escudo de novato **só é descoberto ao chegar**: o atacante não vê a proteção antes, e as tropas voltam sem combate. A notificação já diz o motivo.
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
- Valores atuais: a temporada começa com 25 reinos de IA e o mundo nunca fica com menos de 20 reinos ativos; o reino de IA novo surge na vaga livre mais longe dos jogadores.
- Abdica o reino de IA de menor porte: o castelo vira ruína e os outros locais, terra livre. Reino de IA que perde o último local não vai ao exílio: sai do mundo.
- A IA joga em sessões, nas horas de um jogador, e só com o que um jogador saberia: ataca apenas locais espionados nas últimas 24 h, estimando a milícia pelos civis que o batedor viu. Caça enquanto tem pouco couro, para treinar os batedores. Usa os mesmos serviços por quantidade; a atribuição automática cuida das vagas dela.
- A regência não funda, não ataca, não espiona e não negocia. O jogador que volta vê o que ela fez e o que se perdeu.

---

## Alianças

- Reinos podem formar **alianças** e **pedir recursos a aliados**.
- Alianças têm **limite de membros**, por balanceamento: alianças muito grandes geram problemas. Valor inicial: **5 reinos** por aliança.
- Aliados se reconhecem (nome e brasão) e veem as marchas uns dos outros. Locais de aliados não são alvo de ataque.
- **Reforço entre aliados**: um aliado pode mandar tropas para defender um local seu. As tropas continuam ocupando o teto de população de quem mandou. Não há ataque conjunto.
- O reforço não leva carga (tropas carregadas voltam para casa com ela), não sai pela postura do local e seus feridos vão para o castelo de quem mandou.
- **Conversa da aliança**: os membros conversam entre si; é o único chat do jogo.
- Um pedido de recursos é aceito ou recusado pelo aliado. A ajuda sai dos locais mais próximos dele e viaja visível no mapa, podendo ser roubada.
- **Cargos**: líder (convida, expulsa e promove), até 2 conselheiros (convidam e aceitam pedidos de entrada) e membros.
- **Saída**: qualquer membro sai quando quiser, e o líder pode expulsar. Ao sair ou ser expulso, vale uma **trégua de 24 h** entre o reino e a aliança, garantida pelo jogo, e o reino só entra em outra aliança depois de 24 h. A visão das marchas acaba na hora.
- **Traição**: não há ataque surpresa entre membros. Quem quer atacar um aliado precisa sair e esperar a trégua.
- Se o líder entra em regência ou sai, a liderança passa ao conselheiro mais antigo na aliança, ou ao membro mais antigo.
- Convite só para reinos conhecidos; pedido de entrada só a aliança com algum membro conhecido. Convites e pedidos valem 24 h.
- O reforço de um aliado defende com a guarnição, mas o dono do local não o usa; divide as perdas da defesa e volta para casa se a defesa recuar ou a aliança entre os dois acabar.
- Pacto e trégua são descobertos ao chegar; o envio só é recusado se o atacante já sabe de quem é o local (espionado).

---

## Comércio e diplomacia

- **Sem mercado global**: um mercado único quebraria as regras de recurso no local e de roubo no caminho.
- **Sem chat geral.** Fora da aliança, a comunicação é por **mensageiro** e pelos recados curtos que acompanham as propostas.
- **Mensageiro**: treinado no castelo; unidade que ocupa 1 de população e leva uma mensagem até um local de outro reino, inclusive de dono desconhecido. Vai com bandeira branca, evidente no mapa como não agressivo; tropas e fauna não o atacam. A mensagem revela quem a mandou; o destinatário só se revela se responder. Depois de entregar, o mensageiro volta.
- **Troca direta** ("dou X, quero Y") só com reinos conhecidos: aliados, espionados ou identificados por estandarte ou bandeira. A proposta revela quem propõe. Se aceita, as duas cargas saem dos locais mais próximos e viajam visíveis no mapa, podendo ser roubadas.
- **Reinos de IA comerciantes** compram abaixo e vendem acima do valor de referência, só com o próprio estoque e pelas mesmas regras dos jogadores. Mantêm o comércio vivo quando há poucos jogadores.
  - Compram a 85% e vendem a 115%, com a prata pelo valor cheio; nunca dão mais que metade do que guardam de um recurso. Os outros reinos de IA pedem o dobro da margem.
- **Pacto de não agressão**: qualquer lado propõe, com pagamento em qualquer direção (quem ameaça cobra para não atacar, ou quem teme paga para não ser atacado) ou sem pagamento.
  - Dura de **1 a 7 dias**; cada reino tem até **3 pactos ativos**.
  - Começa quando o pagamento chega; se a carga for roubada no caminho, não começa.
  - **O jogo garante o pacto**: enquanto durar, nenhum dos dois consegue atacar, saquear ou interceptar o outro. Tropas enviadas a um local do outro descobrem o pacto ao chegar e voltam sem combate.
- **Resgate de explorador**: ver Exploradores.
- **Limites para o novato**: enquanto um reino está sob escudo de novato, a diferença entre o que ele dá e o que recebe (trocas, ajuda de aliados, pagamentos de pacto e resgate), somada transação a transação em valor de referência, tem limite por dia (janela de 24 h), para que contas secundárias não alimentem outra. Ninguém pode cobrar pacto de um reino sob escudo. O escudo e o limite de outro reino não aparecem a quem não é aliado: a recusa sai no aceite, sem revelar o escudo a quem propôs.

---

## Experiência do jogador

- **Jogo livre**: sem missões fixas ou obrigatórias; nada força o jogador a fazer algo.
- **O reino nasce com os primeiros passos já dados**: castelo e locais acima do nível 1, moradias prontas, uma guarnição pequena (lanceiros e arqueiros com nome) e exploradores prontos no castelo (a pé, a cavalo e prospector), com o entorno do castelo já explorado. Quem entra explora, caça, prospecta e manda os civis sem trabalho e as tropas coletarem madeira e pedra na hora, sem passar a primeira sessão só esperando timers: as primeiras melhorias saem nos primeiros minutos. Vale igual para reinos de IA.
- Sistemas são apresentados **aos poucos**, conforme o jogador chega a eles, em vez de tudo de uma vez.
- **Enviar tropas para cá**: sem tropa selecionada, o botão direito num hexágono oferece esse item primeiro. Ele abre o painel da base com de onde saem (o local mais perto ou o último usado, ou uma tropa em campo) e quantas vão (as últimas enviadas assim, metade ou todas); Enter envia. Destino que pede escolha (atacar, caçar...) termina na folha com as ordens.
- **Atacar em 2 cliques**: clicar na tropa e clicar com o botão direito no alvo. Tudo já vem com padrões; os detalhes (tipo, objetivos, tática, estandarte) ficam numa opção de **ajuste**, de um local ou de uma tropa em campo, e Shift + botão direito mostra todas as ordens.
- Tropas podem **andar pelo mapa**: o destino pode ser um alvo, um local seu ou qualquer ponto. Num ponto qualquer, as tropas ficam lá com a postura "atacar apenas quem atacar".
- **Modelos de ataque**: o jogador pode salvar envios prontos e repetir o último ataque.
- **Ver é jogar.** A Vista desenha cada pessoa do reino onde ela está (trabalhando com a ferramenta do ofício, em formação na guarnição, em coluna na marcha, cavando e quebrando pedra na escavação e na extração, treinando, ferida), com bonecos 3D de forma humana (e cavalos de verdade para quem monta) renderizados uma vez por ofício, pose e direção. Castelo, locais, torres e ruínas também são construções 3D, que crescem com o nível e levam a bandeira na cor do dono. Árvores, arbustos, flores, cogumelos, juncos, rochas e picos de montanha são 3D, com tipos e tamanhos que variam de lugar para lugar. Rios têm margem, canal fundo e reflexos, vitórias-régias, pedras e uma canoa aqui e ali; a ponte é de pedra, em arco, e atravessa o rio na direção da estrada. Ao girar a câmera, as construções giram em 3D junto, ao vivo, sem salto ao soltar; a vegetação fica em pé. Uma marcha mostra exatamente as pessoas que estão nela; com o zoom afastado, ou acima de 12 figuras no hexágono, vira uma pilha com contador. Pessoas de outros reinos aparecem só dentro da visão atual, em roupa sem cor de dono e sem nome. A foto da névoa guarda construções, não pessoas. Uma batalha em andamento aparece animada; o resultado continua vindo da fórmula.
- **Clicar num civil** abre a folha dele; **clicar numa tropa** seleciona, e clicar nela de novo abre a folha. A folha mostra nome, ofício, o que faz e onde, com o tempo que falta, veterania para soldados, e as ações, cada uma com a tecla: civil "Trocar trabalho" (vagas da mais necessária à menos), "Levar para…" e "Recrutar"; soldado "Missão", "Selecionar o grupo" e "Voltar". A tela **Pessoas** (P) lista todo mundo, com filtro por ofício e por local, e é a alternativa acessível ao clique no mapa.
- **Selecionar e mover, como num RTS**: o botão esquerdo seleciona a tropa (um soldado da guarnição, os soldados de uma pilha ou um exército inteiro em campo; duplo clique pega todos do mesmo tipo no lugar). Com ela selecionada, o **botão direito** no mapa dá a ordem na hora: hexágono livre move, local seu reforça, outra tropa sua junta; alvos que pedem escolha (outro reino, jazida, ruína, animais) abrem a folha com as ordens, e Shift + direito sempre mostra todas. Shift + clique soma à seleção; Shift + arrastar (ou o modo seleção) desenha um laço. O painel de seleção, na base da tela, mostra "7 selecionados · 4 lanceiros, 3 arqueiros" e a carta de comandos com as teclas (Ordem Enter, Patrulhar Q, Voltar V, Parar H, Separar K, Detalhes I, Comportamento C). Ctrl + 1 a 9 guarda a seleção num grupo e o número chama de volta (duas vezes centra); Tab passa pelas tropas. Quem está selecionado ganha um círculo azul em volta dos pés.
- **Simples, sem caça a botões**: o que acontece no mapa se abre clicando nele mesmo (ex.: o selo "Ver batalha" sobre o hexágono), não por um botão escondido em menu ou folha. Antes de criar um botão, menu ou tela, tirar o que não precisa estar lá.
- Opções e sistemas só aparecem **quando fazem sentido** para o jogador; nada é bloqueado. Antes do gatilho, somem os menus e botões do sistema; o mundo continua igual. Ao aparecer, um aviso curto apresenta o sistema. Gatilhos:
  - Transporte manual de recursos: ao fundar o primeiro local longe do castelo (fora da vista dele).
  - Espionagem: ao ver o primeiro espião ou sofrer o primeiro ataque.
  - Torres de arqueiros: ao ver forças desconhecidas perto do reino.
  - Relíquias: ao avistar a primeira ruína antiga ou um farol.
  - Alianças: ao conhecer o primeiro reino.
  - Comércio e diplomacia: ao conhecer o primeiro reino.
  - Ferraria e eras: ao ter a primeira ferraria (fundada ou ocupada).
- A câmera da Vista **inclina e gira** em volta do ponto olhado: botão direito ou do meio do mouse arrastando (para cima e para baixo inclina, para os lados gira). O mapa anda com W A S D ou as setas, a roda dá zoom, Espaço centra no castelo, M troca Vista e Mapa tático e Home põe a câmera no padrão. Afastar além do limite da Vista leva ao Mapa tático; aproximar além do limite do Mapa volta à Vista.
- **Sons de efeito**: cliques, folhas, ações confirmadas, notificações pela categoria e, na Vista, o trabalho e as batalhas à vista (mais alto quanto mais perto e maior o zoom). Liga, desliga e volume em Mais, no aparelho.
- **Mesa de jogo**: o mundo ocupa a tela inteira e nada o encolhe. A barra do topo tem brasão, recursos (com dica ao passar o mouse: estoque, por hora, quando enche) e os botões das janelas, cada um com a tecla: Reino R, Construir B, Exército E, Recrutar T, Pessoas P, Atenção N, Mais. Cada tela abre numa **janela flutuante** (uma por vez, arrastável, fecha com Esc ou com a mesma tecla); o que está selecionado aparece no **painel da base** da tela com a coluna de comandos; a confirmação é um diálogo curto no centro (Enter confirma). O **botão direito** sobre qualquer coisa sem tropa selecionada abre o menu de contexto com as ações dela. F1 mostra mouse e teclado.
- Tudo que tem tempo (obras, recrutamento, ferraria, cura, escavação, extração, caça, marchas, treino) mostra uma **barra de progresso com o cronômetro** ao lado.
- Uma tela mostra **o que precisa de atenção** (ameaças, oportunidades, filas paradas), sem obrigar nenhuma ação e sem recompensa. Os 3 mais urgentes aparecem no topo de Meu reino.
- Espionagem também aparece ao sofrer o primeiro ataque; torres, quando forças de outro reino (não aliado) entram na visão do reino.

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
- Um dia conta como ativo quando o jogador abre o jogo nele. As relíquias da temporada valem pela posição (1º 2%, 2º 1,5%, 3º 1%; relíquia lendária e cerco 1,5%), uma por conquista; se as equipadas passam de 5%, todas encolhem na mesma proporção.
- Títulos vêm da linhagem (níveis 3, 5, 7 e 10) e das conquistas; só aparecem para o próprio jogador.
- A região do exílio é escolhida antes, em Temporada e legado; a região inicial, ao fundar. Vale a vaga livre mais perto do centro da região.
- **Ranking da temporada** por reino: total de baixas causadas, perdas, quantidade de tropas e famílias (população civil). Não mede território (continua sem placar de domínio).
  - Baixas e perdas contam tropas e milícia nas batalhas (fauna não conta); perdas: menos é melhor. Reinos de IA aparecem como qualquer reino, mas não ganham relíquias.

---

## Monetização

- **Nenhuma** neste momento. Prioridade é ter jogadores.
- Direção futura: **sem pay-to-win**.
  - Permitido: cosméticos (castelos, tropas, brasões, bandeiras) e passe de temporada cosmético.
  - Avaliar com cuidado: conveniências de assinatura.
  - Proibido: venda de aceleração de timers e de recursos.

---

## Em aberto

- Ajuste fino do balanceamento com testes. Valores atuais: **balanceamento aprovado** em `balanceamento/README.md`, com modelo e simulação em `balanceamento/modelo.js`.
