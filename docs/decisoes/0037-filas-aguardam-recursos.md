# 0037: Filas aceitam item sem recurso

Muda a [0010](0010-logistica.md): a reserva sai da hora de enfileirar para a hora em que chega a vez do item.

## Decisão

Tudo que entra em fila pode entrar sem recursos. Enfileirar não gasta nada. Ao chegar a vez do item, o servidor olha a soma do reino inteiro: havendo o bastante, reserva e dispara a requisição de sempre; sem o bastante, o item aguarda e começa sozinho, mesmo com o jogador offline. Entre filas diferentes, o item mais antigo tem direito primeiro.

As regras estão no `CLAUDE.md` (Recursos e Tempos). Aqui fica o porquê das escolhas técnicas e das que o pedido deixou em aberto.

## Máquina de estados

`ItemFila.Estado` tem dois valores e só anda para a frente: `Aguardando` e `Reservado`. Quem começa e termina continua sendo `Inicio` e `Fim`, como antes.

O valor inicial da propriedade é `Reservado`, de propósito: um item salvo antes desta regra não tem o campo, e ele já pagou o material na hora de enfileirar. Item novo passa por `Filas.Enfileirar`, que o põe em `Aguardando`. Assim não há migração, e o documento antigo continua valendo.

## Por que não há reserva dupla

- **Uma thread só.** O `Motor` executa comandos e eventos em série, sem travas. Não existem duas avaliações ao mesmo tempo, então "ler o estoque e tirar" não tem janela.
- **Passagem no mesmo passo.** `Filas.Reservar` troca o estado antes de qualquer outra coisa e, no mesmo passo, toma as pessoas e tira o material. Nada volta a `Aguardando`, então uma segunda avaliação não vê o item como candidato.
- **Gravação atômica.** O `Banco` grava os documentos sujos numa transação, entre comandos. O reino (com o item), os locais (com o estoque), as marchas e as pessoas vão juntos: depois de uma queda do servidor, ou a reserva inteira foi gravada, ou nada dela. Os testes cobrem as duas pontas, inclusive reservar na memória, perder a memória e reservar de novo.
- **O que falta vem do estado real.** Um item reservado que perdeu material (carregadores roubados, sem recurso para repor na hora) não guarda uma lista de pendências: `Logistica.Faltando` calcula custo menos entregue menos o que está nos carregadores. Pedir o que falta é idempotente por construção, também depois de reiniciar. Isso também conserta o item que antes ficava parado para sempre depois de um roubo sem reposição.

## Avaliação

`Filas.Avaliar` percorre o item da vez de cada fila em ordem de id (o id só cresce, é a ordem de entrada). Quem cabe no disponível reserva; quem não cabe abate o que pede de uma cópia do disponível, sem gastar nada de verdade. `Filas.Situacoes` faz a mesma conta só para ler, e é dela que vêm o "faltam" da tela e a fila parada da tela de atenção.

A avaliação roda ao enfileirar, ao concluir, logo depois de cancelar, ao abrir o reino, no checkpoint de hora em hora e por um evento próprio.

**O evento.** A produção é calculada sob demanda, então recurso chegando não gera aviso. Enquanto há item parado, o reino tem um único `AvaliarFilasEvento`, em `Reino.FilasEventoId`, marcado para quando a produção cobrir o que falta, entre 5 e 60 segundos. O limite de 60 s cobre o que chega de outro jeito (extração, comércio, saque) sem precisar de um gancho em cada lugar que soma estoque. Sem item parado, o evento não se reagenda: em reino sem espera o custo é zero. Por ser um evento comum, ele é gravado com o resto e volta depois de reiniciar.

**`Filas.Acordar`.** O cancelamento e a perda de local não avaliam na hora: agendam a avaliação para logo depois do comando em curso. Sem isso, a queda do castelo, que cancela item por item, faria o próximo da fila reservar no meio da queda, gastando o kit do exílio com um item que seria cancelado na linha seguinte.

## Escolhas que o pedido deixou em aberto

- **As pessoas também saem na reserva.** O recrutamento tirava o civil ao enfileirar. Mantido isso, um item parado por falta de comida prenderia justamente quem trabalha, podendo coletar ou produzir o que falta. Agora a pessoa só sai na vez do item, junto com o material. O envio continua recusando quando falta gente, descontando a população com que os itens que aguardam já contam (`ItemFila.PopReserva`). Se na vez do item não houver civil livre, ele aguarda ("falta população") e continua com direito ao material.
- **Cura sem ervas não salva ninguém.** O item que aguarda não tira os feridos dos lotes: o prazo de 24 h continua correndo e cada um morre no próprio prazo. Sair do lote só na reserva evita duas coisas: cura sem ervas como jeito de ficar imortal, e o grupo inteiro morrer no prazo do primeiro. Quem morre encolhe o item (`Qtd`, custo, rótulo). Sem número no pedido, a cura pega os que as ervas pagam ou, sem ervas nenhuma, todos.
- **Feridos no item que aguarda ainda podem ser sacrificados.** Continuam no lote; o item encolhe.
- **Item seguinte da mesma fila já não está pago.** Efeito direto da regra: os carregadores do segundo item só saem quando ele chega à frente, então fila longa leva mais tempo que antes. Em troca, o material fica no estoque, onde pode ser usado, saqueado ou cancelado sem custo.
- **Local perdido, sem reserva.** Item que aguarda num local que deixou de ser do reino sai da fila, sem gastar nada e com aviso. A checagem vale para a fila inteira, não só para o item da vez, e `Mundo.MudarDono` acorda a avaliação de quem perdeu o local. O mesmo vale para o que cada tipo sabe (`ITipoItemFila.Revisar`): lugar da fundação ou da torre ocupado, torre que caiu, posto com outro local no hexágono, rota já feita por outro reino, local que não serve mais para a salgadeira, castelo sabotado abaixo do nível que a melhoria daria.
- **Local perdido, com reserva.** Continua a regra antiga: o material volta ao castelo. Novidade só para o caso que antes travava: reservado, sem local e sem o resto do material sai da fila e devolve o que já chegou.
- **Queda e exílio.** `Quedas.ArrumarFilas` não mudou: cancela o que cancelava. Item aguardando não tem nada a devolver nem entra nos recursos perdidos, e o kit do exílio fica inteiro. A cura muda para o castelo novo, como antes.
- **Requisitos não são conferidos de novo na vez do item**, além dos acima. Um quartel sabotado abaixo do nível da unidade não cancela o treino que já estava na fila: é a regra de antes, e a validação é a do envio.
- **Custo fixado ao enfileirar.** O preço do próximo local ou da próxima moradia conta os que estão na fila, como antes, e não muda enquanto o item aguarda.

## IA e jogador ausente

A IA usa os mesmos serviços, mas sem cuidado encheria a fila com 10 itens impagáveis e prenderia os recursos dos mais antigos. Durante a sessão, `Mundo.ExigirRecursos` faz `Filas.Enfileirar` recusar o que o reino não pode pagar agora, descontado o que os itens que aguardam vão pedir (`Filas.LivreParaNovos`). É uma decisão dela, como a de um jogador cuidadoso; os caminhos de `Talvez` e `Tentar` no `Governo` continuaram iguais, e a economia da IA fica com o ritmo aprovado no balanceamento.

Se o material sumir depois (saque, comércio), o item aguarda como qualquer outro. O reino de IA cancela o item da vez parado há mais de um dia, para ele não segurar a fila. Ninguém mexe no que o jogador deixou: o item dele começa sozinho enquanto ele está fora.
