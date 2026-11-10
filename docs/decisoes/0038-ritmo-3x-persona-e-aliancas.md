# 0038: Ritmo 3×, batalha sem tempo fixo, IA com persona e alianças com vida

Quatro pedidos do dono na mesma leva. As regras estão no `CLAUDE.md`; os números, em `balanceamento/README.md`. Aqui fica o porquê das escolhas.

## Ritmo 3×

O dono achava o jogo e o andar lentos e pediu o equivalente a jogar em 3× acelerado, recalculado no balanceamento, não pela variável `REINO_ACELERACAO` (que continua existindo só para teste).

**O que anda 3× mais rápido.** Tudo o que é ação: tempo de obras, recrutamento, ferraria, eras, cura, escavação, caça, rotas, pontes, postos, veículos e deslocamento caem a um terço; produção, nascimentos, extração e coleta rendem o triplo. O que o mundo leva para se refazer segue junto (fauna que volta, hexágono de coleta que enche, vida que volta, bando que muda de lugar): com caça e coleta 3× mais rápidas, o mapa secaria se ele não se refizesse no mesmo passo.

**O que continua em tempo real.** O que está preso à vida de quem joga: temporada de 70 dias, escudos, regência, tréguas, convites, prazos de 24 h, pactos em dias, "visto há X horas", janela do saque repetido. Cada local continua guardando 10 h da própria produção, porque 10 h é a noite de quem joga; como a produção triplicou, ele guarda 3× mais, e o armazém e o estoque mínimo do castelo cresceram junto.

**Nível máximo 11.** Com 3× puro e nível 10, a simulação fechava a economia do jogador ativo no dia 13 e a do médio no dia 18: sobravam 50 dias sem nada para crescer. O dono pediu um nível máximo um pouco mais alto, de modo que quem maximiza tudo chegue lá no dia 20 e o médio na proporção. Com o nível 11 e o custo ×2,18 por nível (era ×2,15), o ativo fecha no dia 20 e o médio no dia 26. As pessoas por reino não mudam: as vagas continuam 3 do nível 9 ao 11. Testado e descartado: nível 12 (levava o ativo a 165 pessoas, fora da escala "dezenas") e curva de custo bem mais íngreme no nível 10 (segurava o começo sem necessidade).

**Metas refeitas, não apagadas.** As metas de tempo do modelo foram divididas por 3 (obra do nível 2 em até 40 s, reino vizinho em 3 a 7 min, vida que volta em 1 h 20 a 2 h 40...). Três mudaram de sentido: o arco da temporada (M5e e M5f, agora "ativo perto do dia 20, médio depois"), a noite coberta por 10 obras (agora de nível 7 a 9) e a ferraria (pesa um terço do que pesava, porque o custo dela não mudou e a produção triplicou).

**Limite do novato.** Passou de 200 para 600 de valor por dia: é uma fração do que o reino produz, e a produção triplicou.

**Névoa em marcha.** O intervalo de revelação caiu de 10 s para 4 s de marcha: a cavalaria agora anda 3 hexágonos em 4 s e enxerga 4, então o caminho continua aberto sem buracos. O número de revelações por viagem ficou parecido com o de antes.

**Mundos salvos.** O balanceamento não é gravado com o mundo. O que já estava em andamento (obra, treino, marcha, batalha) guarda o próprio instante de fim e termina na hora que tinha; o que começa depois da troca já anda no ritmo novo. Local no nível 10 continua válido e pode subir ao 11. `RitmoTestes` grava um mundo com o balanceamento antigo e o abre com o novo.

## Batalha sem tempo fixo

Pedido do dono: a duração tem de sair da quantidade de tropas e da velocidade com que um lado cai; 50 contra 1 não pode demorar.

`duração = 20 s + 12 s × tropas do lado mais fraco × (força menor / força maior)^1,5`, até 10 min.

- Quem define o tempo é o lado mais fraco: a batalha dura o que ele leva para cair. Mais gente dele, mais tempo; quanto mais desigual, menos.
- O mínimo de 20 s existe para a batalha aparecer na tela e nas mensagens globais; não é um tempo fixo de espera.
- Continua valendo o que já existia: o ritmo acompanha quem sobra (com metade das tropas vivas, o dobro do ritmo), e reforço ou recuo recalculam tudo, inclusive a duração.
- Efeito colateral aceito: em frentes simultâneas, a frente mais desigual acaba antes, não a menor.

## Animação e batalha à vista (cliente)

- **Posição desenhada ≠ posição da regra.** `M.posMarcha` continua sendo a verdade (hexágono, chegada). `M.posSuave` é só desenho: mola amortecida para toda marcha e, para a de outro reino, um relógio atrasado de um intervalo do feed. O feed só traz o hexágono atual e o próximo; sem o atraso, a figura parava no fim do trecho conhecido e pulava no feed seguinte (medido: 43% dos quadros parada na tropa lenta, 74% na cavalaria). Mandar mais hexágonos no feed resolveria, mas entregaria o caminho, que é segredo.
- **Batalha com o que já é público.** Quantos ficam em pé sai da parte da força de cada lado e do andamento; as quedas saem do contador de baixas. O tamanho de verdade nunca entra: 50 contra 50 e 5 contra 5 começam iguais na tela.
- **Poses que se somavam.** O mixer do three.js só escreve num osso quando o valor da animação muda entre duas amostras. As poses de trabalho usam sempre a mesma amostra do idle, então os giros de uma pose ficavam por baixo da seguinte. Agora toda pose parte do repouso gravado na carga do modelo.

## IA com persona

Pedido do dono: reino de IA não pode parecer IA. Cada um ganha uma pessoa que o governa.

- **Onde fica.** `Reino.Persona` (`servidor/src/Jogo/IA/Persona.cs`), gravada com o reino. É um documento só de propriedades, serializável como está: é o que uma LLM receberia. Nunca entra em visão, feed ou log; `PersonaTestes` procura os nomes proibidos em tudo o que o jogador e o visitante recebem.
- **0,5 é neutro.** Todo traço vai de 0 a 1 e multiplica a conduta por `1 + (traço − 0,5) × 2 × amplitude`. A persona neutra (tudo em 0,5, nunca falta, nunca esquece, sem atraso) é a conduta pura de habilidade × perfil. Os testes antigos da conduta usam a neutra; o que a persona muda tem teste próprio. Assim a persona desvia o comportamento sem trocar de perfil: as amplitudes são de 10% a 30%.
- **Sorte própria.** Presença, esquecimento e atraso saem de uma sorte derivada do reino e do instante, não da sorte do mundo: ligar a persona não muda nenhum outro sorteio do jogo, e o mesmo mundo dá sempre a mesma história.
- **Geração estável.** A persona sai de uma semente feita da semente do mundo, do id e da criação do reino. Um mundo gravado antes desta regra ganha as personas na subida, e elas são as mesmas a cada subida.
- **Sessão em duas partes e reação.** São eventos comuns da agenda (`SessaoIAEvento` com `Etapa` e `ReacaoIAEvento`), um por reino: nada varre o mundo. A reação fora da sessão só defende; todo o resto continua esperando a sessão, como um jogador que só abriu o jogo para responder ao ataque.
- **Falas.** `Falas.Gerar(mundo, reino, contexto)` é o único lugar de onde sai texto de IA. `Falas.Gerador` é quem escreve: hoje `FalasPorModelo` (frases por assunto, passadas pelo jeito de escrever da persona); amanhã, uma LLM com a mesma interface (`IGeradorDeFala`). `Falas.Pedido` monta o pedido que ela receberia (persona + contexto), para o formato ficar definido e testado. Quem escreve pode calar ou falhar: a IA fica quieta e o jogo segue. Os modelos não afirmam fatos que o servidor não deu no contexto.
- **O que não foi feito de propósito.** A persona não aparece no jogo (nem o nome de quem governa): mostrá-la só nos reinos de IA os denunciaria, e os jogadores não têm campo equivalente.

## Alianças e conversa

Pedido do dono: rever as alianças e o chat; criar e entrar tem de ser fácil; a IA participa como gente, sem desespero.

- **A conversa é o registro da aliança.** `FalaAlianca` ganhou `Tipo` (fala ou evento). Os eventos são escritos pelos próprios serviços (entrar, sair, pedido de recursos, reforço, batalha num local de membro, relíquia achada), sempre com o que os membros já podem saber. Assim a janela não precisa de abas: quem abre lê o que houve.
- **A linha diz o que dá para fazer nela.** A visão manda `propostaId`, `convidar`, `aceitar` e `reforcar` só quando a ação ainda vale para quem lê; o cliente não deduz permissão.
- **Aberta ou por convite.** Padrão por convite, para não mudar o que já existia. Na aberta, `PedirEntrada` já é a entrada. O limite de 5 e a trégua de 24 h valem igual.
- **Resposta no aviso.** A notificação leva `acao` (tipo e id); o aviso do centro da tela mostra os botões e chama as mesmas rotas da janela. Nada novo no servidor além do campo.
- **Conselheiro expulsa membro.** Só membro: não derruba outro conselheiro nem o líder. O líder passa a liderança sem sair.
- **Não lidas por membro** (`LidaAte`), zeradas ao abrir a janela. A fala nova vai por SSE a cada membro; o aviso pequeno depende da categoria "Conversa da aliança", mas a menção avisa pela categoria da aliança.
- **Sem chat geral.** Continua valendo: fora da aliança, só mensageiro. Menção e ponto do mapa são da conversa da aliança.
- **Aliança na barra do topo** (tecla J), fora do menu Mais: com conversa e não lidas, é uma janela de uso diário.
- **IA.** `ConvivioAlianca` usa os mesmos serviços dos jogadores e a persona decide: `VontadeDeEntrar` junta sociabilidade, afinidade e rancor; convite é respondido depois de um tempo de pensar; pedir entrada exige sociabilidade, dias de temporada, sorte e vizinhança; fundar é do orgulhoso. Limite de 2 falas por sessão, todas por `Falas.Gerar`. Reforço e ajuda saem da lealdade e do que sobra. Nada disso é automático nem imediato, de propósito: aliança de IA que aceita tudo na hora denuncia a IA.
