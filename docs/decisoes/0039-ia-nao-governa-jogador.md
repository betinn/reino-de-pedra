# 0039: A IA não governa o reino do jogador ausente

Muda a [0021](0021-ia.md). As regras estão no `CLAUDE.md` (Visão do jogo, Reinos controlados por IA e Alianças).

## Decisão

O dono pediu para tirar a regência: depois de 48 h sem entrar, o reino de um jogador real passava a ser governado por uma IA conservadora, e na volta ele via o relatório do que ela fez e do que se perdeu. Isso deixa de existir.

O reino de um jogador ausente fica como ele deixou. O mundo continua rodando para ele como para qualquer jogador offline: obras e filas andam, o item que ficou aguardando começa sozinho quando há recursos, tropas marcham e guarnições defendem pela postura. Nenhuma IA toma decisões por ele, por mais tempo que ele fique fora.

Os reinos de IA de verdade, com persona, não mudam.

## O que saiu

- **Servidor.** O gatilho por último acesso (o evento de verificação e o parâmetro de horas), o registro no reino (início, fim, ações e perdas), a conduta conservadora em `P.ia` e o campo do GET /reino com o relatório. `Sessoes.De` só devolve conduta para reino de IA; `Conduta` perdeu o indicador que separava os dois casos, e `Governo` não tem mais ramos para ele.
- **Aliança.** A liderança passa ao conselheiro mais antigo, ou ao membro mais antigo, só quando o líder sai. Um líder ausente continua líder.
- **Site público, avisos e notificações.** Some da lista de segredos, da lista de avisos grandes e do rótulo da categoria "reino" das notificações. Os cargos da aliança continuam fora do feed.
- **Cliente.** A faixa "Bem-vindo de volta" em Meu reino e a tela de retorno saíram do jogo e do protótipo.
- **Balanceamento.** O parâmetro de horas e a conduta conservadora saíram do `modelo.js`, do `config.json` e das tabelas.

## Reinos ativos e vagas

A meta de ocupação conta reinos com `Ativo`, e a regência nunca mudava esse campo: o reino de um jogador ausente já contava como ativo e continua contando. A vaga para um jogador novo continua saindo da abdicação de um reino de IA. Nada na contagem muda.

## Saves antigos

Um mundo gravado antes desta decisão pode ter um reino de jogador em regência. Ao carregar:

- o registro antigo no documento do reino e o id do evento de verificação são campos que não existem mais e são ignorados pelo leitor JSON; somem na próxima gravação do reino;
- o documento do evento de verificação tem uma classe que não existe mais e o `Banco.Carregar` já pula esse caso;
- as sessões de IA que ficaram marcadas para o reino do jogador são canceladas na subida (`SistemaIA.DevolverAosDonos`), e o reino volta ao dono sem quebrar.

O teste `Mundo_gravado_com_a_IA_governando_um_jogador_volta_ao_dono_ao_carregar` grava um mundo, põe nele os campos e o evento antigos, carrega de novo e confere que ninguém governa o reino e que o item que ele deixou na fila começa sozinho.
