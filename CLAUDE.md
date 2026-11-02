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

- Mapa **grande**, que exige deslocamento real: distância e terreno importam.
- Coberto por **névoa**: no início o jogador só conhece o entorno do seu reino. Informações de áreas exploradas envelhecem e mostram o último estado conhecido.
- Terrenos afetam velocidade de deslocamento e o que pode ser encontrado:
  - Planície: deslocamento rápido, comida.
  - Floresta: lenta, madeira e caça.
  - Colina: deslocamento normal, ferro e pedra.
  - Montanha: lenta, ouro e pedras preciosas.
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
- **Valiosos**: ex. ouro, prata, sal, cavalos de raça, aço de qualidade. Raros, liberam unidades e tecnologias melhores.
- **Lendários**: minérios raros, relíquias, ruínas antigas. Pouquíssimos no mapa, bônus únicos, alvo de disputa.
- **Couro e peles**: recursos do reino, obtidos pela caça.
- Recursos valiosos e lendários ficam **ocultos** até serem descobertos.
- Jazidas são **finitas** e se esgotam com o tempo.
- **O reino base já gera recursos básicos** suficientes para recrutar tropas básicas, sem depender de exploração.

### Extração

- **Nada é obrigatório.** Qualquer tropa pode coletar um recurso descoberto, inclusive uma única unidade sem preparo.
- Posto de extração, mais tropas, unidades adequadas e rotas são **opcionais** e aumentam velocidade e rendimento da extração.
- Unidades adequadas são as de **maior capacidade de carga**: rendem mais por viagem.

### Relíquias lendárias

- Existe **uma relíquia para cada reino** do mundo (ex.: 10 reinos, 10 relíquias). Um reino pode ter **mais de uma**.
- São obtidas por **escavação nas ruínas antigas**: lenta e finita.
- O jogador **guarda a relíquia num local** do reino, e ela melhora o desempenho daquele local.
- Tipos: **ataque**, **produção** e **resistência** (defesa).
- Relíquias podem ser **roubadas** e são **descobertas por espionagem**.
- Relíquias **não se movem sozinhas**: são sempre transportadas por tropas, e podem ser **roubadas no meio do caminho**.
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
- **Teto** definido por moradias.
- **Crescimento** por tempo, mais rápido com excedente de comida.
- **Recrutar consome população**; tropas mortas não retornam.
- A população sustenta a produção de recursos e atua como **milícia** na defesa.
- Objetivo: criar a decisão central entre **tropas e economia**.
- Moral, profissões e migração ficam para depois, apenas se o balanceamento pedir.

---

## Tropas e evolução

- Tipos de unidade: milícia, lanceiro, arqueiro, cavalaria e máquinas de cerco (aríete, trebuchet).
- Relação de vantagens entre tipos (ex.: lança vence cavalaria, cavalaria vence arqueiro, arqueiro vence infantaria lenta).
- **Evolução de armas e tecnologias** por eras (ferro, aço, cerco avançado), dependente de recursos valiosos.
- Exércitos sobreviventes ganham **veterania**.
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

### Defesa

- Guarnição do local + **população como milícia** + muralhas.
- O atacante chega apenas com as tropas enviadas, após a viagem; o defensor pode enviar reforços durante a batalha.
- **Recuar** salva tropas e população, mas o local é saqueado.
- Destruir um reino inteiro deve ser **muito difícil e caro**, mesmo para um veterano contra um iniciante.

### Queda do castelo

- Se o reino ainda possui outros locais: o castelo vira ruína e a sede se transfere para outro local, com perdas pesadas, sem extinção.
- Se perder tudo: o jogador recomeça **em exílio** em um novo ponto do mapa, com um kit de recomeço, mantendo linhagem e relíquias, e recebe **escudo temporário** contra ataques.
- O ponto do exílio é **aleatório e longe de quem derrubou** o reino; escolher a região depende da linhagem.

### Anonimato e bandeiras

- Ser atacado **não revela o atacante**. O relatório mostra apenas forças desconhecidas (tropas, tipo, direção de origem).
- A identidade só é revelada se o atacante escolher levar seu **estandarte**, ou se o defensor descobrir via batedores e espionagem.
- **Bandeiras** podem ser colocadas em qualquer lugar do mapa, como sinal para outros jogadores (reivindicação, ameaça, aliança). Têm valor social, não mecânico.
- Bandeiras **mostram quem as colocou**.
- Cada jogador tem **até 20 bandeiras ativas**, com recado de até 60 caracteres. **Outros jogadores podem derrubá-las** com tropas no local.
- Explorar um local de outro reino **não revela o dono**; espionar o local com batedores de elite revela.

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
- **Indistinguíveis**: reinos de IA não são identificados como tal para os jogadores.
- **Mesmas regras dos jogadores**: timers, recursos, população e limites idênticos, sem trapaça. Perfis variados (expansionista, defensivo, saqueador, comerciante) e níveis de habilidade diferentes.
- Respeitam o escudo de novato e calibram a agressividade pelo porte do alvo.
- **Saída gradual**: conforme jogadores entram, não são criados novos reinos de IA; reinos de IA destruídos não renascem, e excedentes podem abdicar, com seus locais virando ruínas ou terra livre.
- **Entrada quando jogadores saem**:
  - **Regência**: após um período de inatividade, o reino do jogador ausente passa a ser governado por IA. Se o jogador voltar, retoma o controle do que restou.
  - A regência é **conservadora** (defende e produz, sem expansão agressiva), para que abandonar nunca seja vantajoso.
  - Se a ocupação cair abaixo da meta, novos reinos de IA surgem em regiões com pouca atividade.
- Cada temporada começa com mais reinos de IA, que vão saindo conforme a base de jogadores cresce.

---

## Temporadas e legado

- Mundo organizado em **temporadas** (ordem de grandeza: 2 a 3 meses), com reset de mapa e reinos.
- Objetivo: evitar domínio permanente dos primeiros jogadores sem desanimar veteranos.
- **Legado** que atravessa temporadas:
  - **Relíquias da temporada**: itens únicos e limitados, ganhos por conquistas, com bônus pequeno e com teto (o teto vale para a soma das relíquias).
  - **Títulos, brasões e skins** permanentes, mostrando o histórico do jogador.
  - **Linhagem**: progressão de conta que desbloqueia opções (ex.: escolha de região inicial), não poder bruto.
- Novos jogadores devem conseguir competir; veteranos carregam identidade e vantagem pequena.
- **Ranking da temporada** por reino: total de baixas causadas, perdas, quantidade de tropas e famílias. Não mede território (continua sem placar de domínio).

---

## Monetização

- **Nenhuma** neste momento. Prioridade é ter jogadores.
- Direção futura: **sem pay-to-win**.
  - Permitido: cosméticos (castelos, tropas, brasões, bandeiras) e passe de temporada cosmético.
  - Avaliar com cuidado: conveniências de assinatura.
  - Proibido: venda de aceleração de timers e de recursos.

---

## Em aberto

- Valores concretos de tempos, custos e rendimentos (balanceamento).
- Lista final de recursos valiosos e lendários.
- Duração exata das temporadas e regras precisas de legado.
- Detalhes de diplomacia e alianças.
