# 0036: Mapa público ao vivo, entrada por convite e fim do anonimato

Substitui a [0035](0035-regiao-dos-reinos-e-poeira-das-marchas.md).

## Decisão

A porta de entrada do jogo é o mapa real, ao vivo, sem login. Para isso não dar vantagem a quem joga, o que está no site é o que todo jogador vê: o anonimato sai e o jogo vira confronto puro. A névoa passa a esconder riqueza, não gente. A entrada é só por convite, decidida à mão pelo dono do jogo.

As regras estão no `CLAUDE.md` (Site público e convites). Aqui fica o porquê das escolhas técnicas e das que o pedido deixou em aberto.

## Uma regra só

`Jogo/Publico/RegraPublica.cs` monta, campo a campo, o que qualquer um vê de um reino, local, torre, ruína, marcha, batalha ou bandeira. `VisaoMapa` usa os mesmos construtores para o que é de outro reino e acrescenta o que é do próprio. Montar campo a campo, em vez de filtrar o documento, faz o campo novo ficar de fora por padrão. Os testes de `MapaPublicoTestes` percorrem o JSON real e falham se um nome da lista proibida aparecer.

## Muitos visitantes, nenhum peso na simulação

`FeedPublico` guarda, por parte (`chao`, `mundo`, `vivo`, `info`), os bytes prontos em JSON, brotli e gzip. A parte é montada no máximo uma vez por intervalo, e só se alguém pediu: sem visitante, nada roda. Quem pede recebe a última foto na hora, menos um pedido por intervalo, que entra na fila do motor e espera a foto nova por no máximo 100 ms. Assim o intervalo de atualização não vira atraso dobrado com um visitante só. As respostas têm `Cache-Control` público e `ETag`, então um proxy também pode absorver. Na página pública, o cliente pede `mundo` e `vivo` a cada 3 s e `chao` a cada minuto, só com a aba visível, e só refaz o mapa se reinos, construções ou o chão mudaram.

`GET /mundo` também passou a vir do feed, porque todo visitante o pede ao abrir a página.

## O caminho da marcha

Só vão o hexágono atual e o próximo, com os instantes: o bastante para animar. Vale para todos, inclusive para o reino atacado e para aliados: mandar mais a uns e menos a outros criaria um jeito de descobrir o destino, e o mapa do jogador já é o do site.

O cliente troca as marchas dos outros pelas do feed a cada tique, sem recarregar `/mapa`. Fora da tela, nada é pedido.

## Convites

- O token tem 256 bits e só o SHA-256 fica guardado. Vai no fragmento da URL (`#/convite/<token>`), que não chega a logs de servidor nem a proxies; o cliente o troca por uma rota sem token assim que valida.
- `Consumir` é um único `UPDATE ... WHERE token_hash = $h AND estado = 'enviado'`: quem muda a linha segue, os outros recebem 410. Isso cobre duas aberturas simultâneas sem trava nenhuma.
- A senha é validada e transformada em hash antes de consumir, para erro de digitação não gastar o link. Se a fundação falhar depois (nome inválido, mundo cheio), a conta é apagada e o link volta a valer.
- `POST /reino` continua para contas que já existem e estão sem reino (temporada nova). Conta nova só nasce em `POST /convites/fundar`.
- O administrador opera por rotas protegidas por `REINO_ADMIN_TOKEN` e por `scripts/convites.sh`. Sem a credencial configurada, as rotas respondem 404. É a forma mais simples e não exige conta de administrador no jogo.
- A resposta de `POST /convites/pedir` não muda se o e-mail já está na fila, já tem conta ou a fila está cheia. Só o formato inválido responde diferente.

## Escolhas que o pedido deixou em aberto

- **Relíquias**: o local com relíquia é público (brilho), sem o tipo, e 3 ou mais continuam sendo farol. Sai a regra antiga de "quanto mais, mais visível", e `reliquiaVis.brilho` foi removido.
- **Reconhecer e a prévia do ataque**: o batedor é o único que revela a guarnição exata, então ver um local de perto dá só o tamanho aproximado, e a estimativa de batalha o trata como lanceiros. Assim a prévia não vira um jeito de medir a guarnição mudando o número de tropas.
- **Milícia**: os civis de um local são secretos. A estimativa (do jogador e da IA) usa o que é público: as famílias do reino, no ranking, divididas pelos locais dele. O relatório do batedor não traz milícia, torres, portões, bônus, presos nem equipamento lendário.
- **Pessoas à vista na Vista**: a contagem por local vem arredondada (`Avistamentos.Arredondado`), e a marcha de outro reino é sempre a mesma formação.
- **Interceptação**: o servidor conhece o caminho, e a prévia diz onde as tropas encontram a marcha. Para não entregar o destino, o ponto só pode estar nos próximos `trechoHexes` hexágonos. Interceptar ficou mais perto do que era à vista.
- **Aviso de ataque**: o defensor não é mais avisado de "ataque a caminho" nem da hora de chegada, porque isso dizia o destino. Ele recebe "Exército de X à vista" quando um exército entra na visão dele, vá para onde for, e a notificação de batalha quando ela começa.
- **Aliados**: não veem mais o caminho nem o tamanho das marchas uns dos outros. O brief pede que nenhum outro reino veja, e a "visão das marchas" perdeu o sentido com todas as marchas públicas.
- **Cargos da aliança** não vão ao feed: a troca de líder diria quem entrou em regência.
- **Imagem própria do reino** é pública, como o nome: aparece no jogo e no site, em `GET /reinos/{id}/icone` sem login. Não há moderação: a entrada por convite limita quem envia.
- **Baixas ao vivo** no feed são a projeção da fórmula, sem a força de cada lado. A parte da força vai como proporção, nunca em número.
- **Dados antigos**: `Banco.Carregar` ignora documentos de classes que não existem mais (eventos de avistamento), para um banco antigo continuar subindo.
