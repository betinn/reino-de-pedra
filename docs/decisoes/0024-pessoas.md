# 0024 — Pessoas no mapa e números menores

**Problema.** O jogo virou planilha: população abstrata, tropas como contadores numa guarnição, números de centenas a milhares que não cabem na tela nem na cabeça. O dono do projeto decidiu em 2026-11-03 que cada cidadão e cada soldado é uma pessoa com nome e ofício, visível no mapa, numa escala de dezenas ([`plano-pessoas-no-mapa.md`](../plano-pessoas-no-mapa.md)). Esta decisão registra como isso entra no servidor, no modelo e no cliente, fase a fase.

## Fase 1 — escala nova no modelo

- Pessoas valem cerca de **25× mais** cada (tropas, milícia, vagas); recursos ficam **÷10**. Todos os números estão em `balanceamento/modelo.js` e as metas M1 a M25 foram reescritas na escala nova (ver `balanceamento/README.md`, "A escala").
- `trabPorNivel` (10 por nível) virou **`vagas`**: `max(minimo, round(nivel × porNivel))`, com `porNivel 0,3` e mínimo 1. Uma vaga vazia produz menos.
- Milícia: **todo civil presente luta** (`miliciaPorPop 1`) e, quando a defesa perde, só `miliciaBaixas` (25 %) deles morre; o resto foge. Regra nova, necessária para o massacre não zerar um local com um ataque.
- Contagens aproximadas de tropas vistas de longe (`aproximado`: "poucas" até 4, depois arredondado de 5 em 5) saíram do modelo em vez de ficar fixas no servidor.

## Fase 2 — pessoas civis

**Pessoa como documento** (`servidor/src/Jogo/Pessoas/Pessoa.cs`): `ReinoId`, `Nome`, `Feminina`, `Oficio`, `LocalId` (onde trabalha, mora ou está guarnecida), `GrupoId` (marcha), `Estado` (trabalhando, ociosa, andando, carregando, treinando; guarnecida, marchando, ferida e capturada entram na fase 3), `Marcas`, `NasceuEm`, `OficioAnterior` e `ItemId` (treino). Coleção `m.Pessoas`, com índices por reino e por local no `Mundo` (`Mundo.Pessoas.cs`), remontados em `ReconstruirIndices`.

**Contagem derivada.** `Reino.Pop` continua gravado, mas só `Pessoas.Recontar` escreve nele: é a contagem das pessoas civis. Quem precisava mexer em `Pop` (recrutar, treinar explorador ou mensageiro, milícia morta, massacre, queda, exílio, abdicação) passa a criar, converter ou matar pessoas específicas. `Reino.PopFracao` guarda a fração do crescimento logístico; cada vez que fecha 1, nasce uma pessoa com nome no castelo e ela caminha até a vaga mais necessária.

**Nomes** (`NomesDePessoa`): lista de nomes medievais em português, sorteio determinístico pela semente do mundo, pelo reino e pela ordem de nascimento (`Reino.NomesSorteados`), sem repetir entre as pessoas vivas do reino; esgotada a lista, numeral ("Inês II").

**Ofícios civis** vêm do tipo de local: agricultor (vila, pasto), lenhador (serraria), pedreiro (pedreira), mineiro (mina de ferro) e sem ofício. Castelo, quartel, armazém, ferraria e posto não têm vagas; o castelo abriga os ociosos. O ferreiro e o construtor do plano ficaram de fora: a ferraria e as obras não têm vaga no modelo e a regra viria sem efeito econômico.

**Vagas e eficiência por local.** `Economia.TaxaLocal` usa a eficiência do próprio local (quem está produzindo / vagas) em vez da eficiência do reino. A vaga de quem está fora carregando ou a caminho continua dela (`VagasTomadas`), mas só quem está presente produz.

**Atribuição.** Automática: ofício anterior se houver vaga nele, senão o local com mais vagas livres, o mais perto. Manual pela API: `POST /pessoas/{id}/trabalho` (um ofício e local, recusa sem vaga) e `POST /pessoas/{id}/mover` (vai mesmo sem vaga, sem trabalho). Quem muda de hexágono anda numa marcha `Deslocamento` (tipo `pessoas` na API), com o mecanismo de marcha existente: nenhum evento por pessoa, posição interpolada. Civis a caminho **não são alvo de fauna nem de interceptação**: gente desarmada dentro do reino foge; isso evita que trocar o trabalho de alguém seja uma sentença de morte perto de um bando de lobos.

**Carregadores** (`Carregadores`, `Logistica.Enviar`): pessoas do **local de origem** (sem trabalho primeiro, depois trabalhadores), cada uma levando `P.carregador.carga` (30: carrinho de mão, contra 5 da mochila de um soldado). Com menos gente que o necessário o grupo guarda o resto em `Pendente` e faz **mais viagens**; depois da última entrega volta para casa e cada pessoa retoma a vaga. Roubado no caminho, o grupo perde a carga, devolve o pendente ao estoque da origem, foge para casa, e a obra pede tudo de novo. Sem ninguém livre na origem, a carga ainda viaja com carregadores anônimos que somem na entrega: a requisição nunca trava. Remessas entre reinos e caravanas continuam como estavam (a caravana sem carroça usa as tropas da escolta, fase 3).

**Milícia e mortes com nome.** `Combates.PopDoLocal` é a contagem dos civis presentes no local (o peso por moradias saiu). A milícia morta na batalha, o massacre e os 30 % da queda matam pessoas sorteadas (`Pessoas.Matar`), e os relatórios dizem quem (`Batalha.CivisMortos`, `ResumoEfeitos.MortosNomes`, `RegistroQueda.CivisMortos`). Local ocupado ou destruído manda os trabalhadores de volta ao castelo do dono antigo (`Pessoas.LocalMudou`); subir de nível, fundar ou ocupar preenche as vagas com ociosos.

**Recrutamento converte.** `Recrutar`, `Exploradores.Treinar` e `Mensageiros.Treinar` levam civis (`Pessoas.ParaTreino`: ociosos primeiro, depois trabalhadores dos locais de nível mais baixo) para o local do treino, com o ofício da unidade e `ItemId`. Cancelar devolve ao ofício anterior. Nesta fase, quando a unidade fica pronta a pessoa **sai do mundo** e a unidade entra na guarnição como contagem; a fase 3 mantém a pessoa.

**Exílio** mantém `P.guerra.exilio.pop` pessoas (presentes primeiro), que seguem até o castelo novo sem trabalho; as outras ficam para trás. A abdicação de um reino de IA remove todas as pessoas dele.

**API.** `GET /reino/pessoas` (pessoas e vagas por local), `GET /pessoas/{id}` (folha: estado, texto do que faz, opções de trabalho da vaga mais necessária à menos, ações), e os dois `POST` acima. O estado do reino ganha `trabalhando` e `pessoas`; cada local, `vagas`, `ocupadas`, `pessoas` e `eficiencia`.

**Consequências.** Um reino de 120 pessoas e 30 reinos dão cerca de 3 600 documentos a mais; medido no teste de carga da fase 6. Testes em `PessoasTestes` e `PessoasApiTestes`; os testes antigos que escreviam em `Reino.Pop` passaram a criar ou remover pessoas (`Pessoas.Povoar`, `Pessoas.Nascer`, `Pessoas.RemoverCivis`).

## Fase 3 — soldados são pessoas

**Toda unidade é uma pessoa.** Cada soldado tem o ofício da unidade e está na guarnição de um local (`Estados.Guarnecida`, `LocalId`) ou numa marcha (`Estados.Marchando`, `GrupoId`; `Marcha.PessoaIds` leva os ids). Aríete e trebuchet passam a ocupar 1 de população (`pop: 1` no modelo): uma pessoa opera a máquina, como qualquer outra unidade. Explorador e mensageiro são pessoas com o ofício do tipo (`Explorador.PessoaId`, `Mensageiro.PessoaId`); livres, ficam guarnecidos no castelo.

**Contagens mantidas, não calculadas.** `Local.Guarnicao`, `Marcha.Tropas`, `Reino.ExploradoresLivres` e `Reino.MensageirosLivres` continuam existindo como dicionários e inteiros, porque todo o resto do jogo (fórmulas, IA, visões, teto de população) lê contagens. `Pessoas` (`Soldados.cs`) reconta cada um depois de cada mudança: sair da guarnição (`Sair`: escolhidas pelo jogador primeiro, depois as mais veteranas), entrar numa marcha (`Embarcar`), chegar (`Desembarcar`), baixas (`Baixas`, sorteadas dentro de cada unidade e, numa guarnição, divididas entre o dono e os reforços aliados na proporção da fórmula), ficar ferida ou morrer (`Enterrar`), curar (`Curadas`), ser aniquilada (`Aniquilar`). Uma marcha reclama na partida (`Marcha.AoPartir`) as pessoas que saíram do local de origem e ainda não entraram em marcha nenhuma (`GrupoId = Saindo`); marchas criadas paradas chamam `Reclamar` direto. Ao encerrar uma marcha (`Marcha.AoEncerrar`), quem ainda estava nela some: todo fluxo legítimo desembarca antes.

**Rede de segurança.** Quando uma contagem declarada difere das pessoas (cenários de teste que escrevem no dicionário, `GT.Devolver` com o kit do exílio), `Pessoas.Sincronizar` faz nascer os soldados que faltam e tira os que sobram; no jogo normal é um não-fazer-nada, e `Pessoas.Conferir` prova isso num teste que roda dois dias de IA com fauna e confere todas as contagens a cada hora. A alternativa, dicionários calculados a cada leitura, custaria uma varredura por leitura e mudaria 60 pontos de leitura sem ganho.

**Veterania por pessoa.** `Pessoa.Marcas`; o bônus do grupo é a média (`Veterania.DoLocal`, `Veterania.DaMarcha`) e cada sobrevivente ganha ou perde a marca. `Local.Marcas`, `Local.MarcasTropas`, `Marcha.Marcas` e `MarcasIniciadas` saíram, junto com a média ponderada na entrada e na saída: quem sai leva as próprias marcas, e os mais veteranos saem primeiro. A guarnição que sai pela postura vira um exército de verdade por alguns instantes (`Interceptacao`), com pessoas, e volta.

**Feridos.** `LoteFeridos.PessoaIds`; a pessoa ferida fica no castelo em `Estados.Ferida`, a cura leva os ids no `Param` do item (`unidades;morreEm;ids`), e a morte sem ervas remove as pessoas e diz os nomes. `Combates.AoFerir` passa as pessoas feridas junto com a contagem.

**Nomes nos relatórios.** `Batalha.MortosAtaque` e `MortosDefesa`, `PerdaFauna.Nomes`, o nome do explorador morto pela fauna e `Prisioneiro.Nome` (quem captura e quem perde veem o nome; libertado, a mesma pessoa volta para casa; executado, some).

**Envio por ids.** Os envios (`/tropas/enviar`, `/tropas/previa`, extração, mover relíquia, interceptação, caravana) aceitam `pessoas: [ids]` além de `tropas: {unidade: n}` (`EnvioPessoas.Ler`): as pessoas são conferidas e marcadas como escolhidas (`GrupoId = Escolhida`) e a contagem segue pelo caminho de sempre; `Sair` leva as escolhidas antes das outras, e o que não saiu volta ao normal ao fim do pedido. As visões de tropas trazem `pessoas` (id, nome, ofício, marcas) em cada guarnição e exército.

## Fase 4 — ver e tocar

**O mapa manda as pessoas.** `GET /mapa` ganhou `pessoas` (as do próprio reino: id, nome, ofício, estado, local e o hexágono em que estão; quem está numa marcha vai pela marcha, que agora leva `pessoaIds`) e `pessoasOutras` (contagens de civis e soldados nos locais de outros reinos à vista agora, sem nome nem dono; a foto da névoa não guarda pessoas). O cliente organiza por hexágono em `modelo.js` (`pessoasPorHex`, `pessoa(id)`).

**Camada de pessoas na Vista** (`web/js/vista/pessoas.js`): cada pessoa é desenhada na frente da construção onde está, com a pose do estado (ferramenta do ofício, formação de soldados por unidade, estocadas em treino, sentada ferida, explorador e mensageiro livres). Até 12 figuras por hexágono; acima disso, ou com o zoom abaixo de 1,25, vira uma pilha de três figuras com um contador ("4 pessoas · 3 soldados"). Pessoas de outros reinos aparecem em roupa crua, sem nome. Cada figura é um alvo de toque (`['pessoa', id]`; a pilha, `['pessoas', hex]`), com a mesma regra de prioridade do hexágono tocado. A camada substituiu os bonecos de enfeite do protótipo (`prepararVida`), que agora só mantém os cavalos do pasto e o alvo de palha do quartel. O cache estático e o limite de 30 quadros/s não mudam: as figuras entram na lista de itens animados, ordenadas por profundidade.

**Folha da pessoa e tela Pessoas** (`web/js/telas/pessoas.js`): nome e ofício, o que faz agora com o tempo que falta (`chegada`, `pronta`), onde está, veterania para soldados; até 3 ações. Civil: Trocar trabalho (lista das vagas da mais necessária à menos, mais "sem trabalho" no castelo), Levar para… (qualquer local), Recrutar. Soldado: Missão, Selecionar o grupo, Voltar (em marcha); nos extras, "Todos deste tipo aqui" e "Ver no mapa". A tela `#/pessoas` lista todo mundo com filtro por ofício e por local e entra em Mais e na folha de cada local. A pilha tocada abre a lista de quem está no hexágono.

**Seleção de grupo** (`web/js/vista/selecao.js`): toque único num soldado abre a folha; o **modo seleção** (botão nos controles do mapa, toque longo na Vista ou a folha) faz cada toque somar ou tirar e o arrasto desenhar um **laço** em vez de mover a câmera; no computador, Shift faz o mesmo sem ligar o modo. O laço é testado contra as posições de tela das figuras do último quadro (ponto no polígono). A barra "7 selecionados · 4 lanceiros, 3 arqueiros" tem Missão (e Enter); Escape limpa. Missão exige soldados no mesmo lugar (uma guarnição ou um exército) e entra no envio de tropas de sempre (`envio.js`) com `pessoas: [ids]`; de um exército, é a ordem nova ao exército. O envio com ids mostra quem vai pelo nome e deixa trocar por quantidade. Quem está selecionado ganha um anel no chão (na marcha, o anel vai na marcha).

**Mapa tático**: o marcador de cada local próprio ganha o número de pessoas que estão nele (`.lc-pessoas`).

**Fora desta fase.** O ícone da missão sobre a cabeça e os sprites por ofício e pose (fase 5); o toque longo não dispara dentro de um gesto de pinça.
