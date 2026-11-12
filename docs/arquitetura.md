# Arquitetura e convenções do código

Guia para quem mexe no código (pessoas e agentes). As decisões e o porquê de cada uma ficam em [`decisoes/`](decisoes/).

## Peças

| Pasta | O que é |
|---|---|
| `servidor/src/Jogo` | Regras e simulação do jogo, sem dependência de web (biblioteca .NET). |
| `servidor/src/Api` | Processo do servidor: HTTP (Kestrel), contas, sessões, API JSON, avisos em tempo real (SSE), arquivos do cliente. |
| `servidor/testes/Testes` | Testes xUnit: fórmulas contra o modelo, regras, persistência, API, carga. |
| `web/` | Cliente web (HTML/CSS/JS sem build), portado do protótipo. |
| `balanceamento/` | Modelo de balanceamento (fonte dos números) e `config.json` gerado para o servidor. |

## Números do jogo

- Todo número de jogo vem de `balanceamento/config.json`, gerado por `node balanceamento/modelo.js --json > balanceamento/config.json`.
- No servidor: `m.P` (parâmetros), `m.B.U` (unidades), `m.B.VEICULOS`, e as fórmulas em `m.F` (`Config/Formulas.cs`, linha a linha iguais às do modelo).
- **Nunca escreva um número de jogo no C# ou no JS.** Precisa de um número novo? Acrescente em `P` no `modelo.js` (com comentário), rode o modelo (tabelas e `--json`), confira que as metas seguem ✓ e que `tabelas.md` não mudou sem querer, e leia o valor de `m.P`. Acrescente a propriedade correspondente em `ParametrosP` (`Config/Balanceamento.cs`).
- O teste `Config_do_servidor_esta_em_dia_com_o_modelo` falha se o `config.json` estiver desatualizado.
- Fórmulas novas que existam no modelo ganham valores em `referencia` (bloco `--json` no fim do `modelo.js`) e um teste em `FormulasTestes`.

## Mundo, motor e tempo

- O mundo inteiro fica na memória (`Mundo`). **Só a thread do `Motor` mexe nele.** A API chama `motor.Executar(m => ...)`, que roda o código em série com os eventos.
- Tempo: `m.Agora` (ms Unix). Dentro de um evento, `m.Agora` é o instante do evento (mesmo recuperando atraso depois de o servidor ficar fora do ar). Constantes em `T` (`T.Min`, `T.Hora`...).
- **Nada de tique varrendo o mundo.** Algo que acontece no futuro é um `Evento` (subclasse com `Executar(Mundo m)`), agendado com `m.Agendar(new MeuEvento { Quando = ... })` e cancelado com `m.Cancelar(id)`.
- Produção e população são calculadas sob demanda (`Economia.Atualizar(m, reino)` antes de ler ou mexer em estoques). Um `CheckpointReinoEvento` por reino por hora mantém tudo em dia. A produção de cada local usa a eficiência dele (quem está produzindo / vagas); o crescimento guarda a fração e faz nascer pessoas inteiras.
- **Pessoas** ([0024](decisoes/0024-pessoas.md)): cada civil, soldado, explorador e mensageiro é um documento `Pessoa` (`Jogo/Pessoas/`), com índices por reino e por local no `Mundo` (`m.PessoasDe`, `m.PessoasNoLocal`). `Reino.Pop`, `Local.Guarnicao`, `Marcha.Tropas`, `Reino.ExploradoresLivres` e `MensageirosLivres` continuam existindo como contagens, mas só `Pessoas` escreve nelas: tire e ponha gente por `Pessoas` (`Sair`, `Embarcar`, `Desembarcar`, `Baixas`, `Enterrar`, `Curadas`, `TreinoPronto`...) ou por `Reinos.Tropas.Retirar/Devolver`, nunca mexendo nos dicionários. `Pessoas.Conferir(m)` diz se alguma contagem não bate com as pessoas (um teste roda dois dias de IA conferindo a cada hora).
- Sorteios de jogo: `m.Sorte` (não use `Random`). O mapa usa `Rng` com semente (determinístico).
- **Buscas de caminho** (`Marchas.Caminhos`, [0041](decisoes/0041-cpu-do-motor.md)): `Calcular` (A*) e `MinutosAte` (minutos de alguns alvos até um destino) usam a memória de trabalho do mundo e só visitam o que precisam. Não escreva busca que percorra a grade inteira dentro de um evento: `Mundo.HexesBuscados` conta os hexágonos visitados, e o teste de carga tem limite por dia de jogo.
- Com eventos atrasados (o servidor ficou fora do ar), o motor trabalha em fatias de 25 ms e atende os comandos entre elas. O log diz quanto atraso há (`motor atrasado`) e quando acabou (`motor em dia`).

## Documentos e persistência

- Entidades persistentes herdam `Documento` e vivem numa `Colecao<T>` do `Mundo`. Para uma coleção nova, num arquivo do seu sistema:
  ```csharp
  namespace ReinoDePedra.Jogo { public sealed partial class Mundo { public Colecao<Alianca> Aliancas { get; } = new("aliancas"); } }
  ```
  Toda propriedade pública `Colecao<T>` do `Mundo` é registrada e gravada sozinha.
- `Reino`, `Local`, `Marcha`, `Jazida`, `Ruina`, `Nevoa`, `Mundo` são `partial`: acrescente campos em **arquivo próprio do sistema** (ex.: `Reinos/Reino.Alianca.cs`), não no arquivo central.
- Propriedades públicas com get/set são gravadas em JSON. Get-only não. Use `[JsonIgnore]` para caches.
- O JSON é gerado na compilação, sem reflection (o servidor publicado é Native AOT, [0040](decisoes/0040-servidor-native-aot.md)). **Um documento novo** entra em `Persistencia/JsonJogo.cs`: um `[JsonSerializable(typeof(...))]` e uma linha em `JsonJogo.Documentos`. **Um enum novo** que vá para o JSON entra em `ConversoresEnum.Todos`. Os testes rodam com a reflection do System.Text.Json desligada e o `RegistrosTestes` confere as listas: um tipo esquecido quebra um teste, não a produção.
- **Depois de mudar um documento, chame `m.Sujar(doc)`.** O motor grava os sujos a cada 3 s numa transação (SQLite em WAL). A cada 5 min uma varredura grava o que mudou sem `Sujar` e registra aviso no log: isso é bug, corrija.
- Subtipos (eventos, marchas) são gravados com o nome da classe: **não renomeie classes de documento** sem migrar o banco.

## Pontos de extensão (para não editar arquivos centrais)

| Onde | Para quê |
|---|---|
| `[Sistema]` + `public static void AoIniciar(Mundo m)` | Rodar na subida do servidor (e em `Sistemas.IniciarTodos` nos testes). Ganchos em listas estáticas: dentro de `Sistemas.UmaVez("chave", () => ...)`. O `AoIniciar` entra também na lista explícita: `Sistemas.Todos` (jogo) ou `RegistroApi.Sistemas` (API). |
| `ITipoItemFila` | Novo tipo de item de fila (obra, recrutamento, forja...). Classe com construtor vazio, registrada em `RegistroTipos.Fabricas` (como as ordens de exército, `IOrdemExercito`). `Revisar` desiste do item que aguarda e deixou de fazer sentido; `AoReservar` toma o que ele usa além do material. |
| `Filas.Avaliar`, `Filas.Acordar`, `Filas.Situacoes`, `ItemFila.Estado` | Passagem única de Aguardando para Reservado, por ordem de entrada entre as filas (ver decisão 0037); pedir uma avaliação depois do comando em curso; o que falta a cada item da vez, só para ler. |
| `Marcha` (subclasse) | Novo tipo de marcha; implemente `Tipo`, `Chegou`, e se preciso `PopOcupada`, `RaioVisao`. |
| `IModuloApi` (Api) | Novo grupo de rotas em `/api/v1`. Classe com construtor vazio, registrada em `RegistroApi.Modulos`. |
| `Economia.ModificadoresProducao`, `HorasDeEstoque`, `OcupantesExtras`, `TetoExtra` | Relíquias, salgadeira, feridos... |
| `Marcha.AoPartir` | Rodar a cada partida de marcha (fauna no caminho, encontros, avistamentos). |
| `Combate.Bonus.Ataque/Defesa/DefesaExercito` | Bônus de combate (armas, veterania, relíquia, lendário, legado); o combate soma e aplica o teto. |
| `Combate.Permissoes.AntesDeEnviar/AoChegar` | Bloqueios de ataque (aliança, pacto, trégua, públicos, antes; escudo descoberto ao chegar). |
| `Combate.Combates.AoCairCastelo` | Cerco vitorioso: (reino que perdeu, exército vencedor, castelo). A queda do castelo (`Combate.Quedas`) registra aqui. |
| `Combate.Quedas.EscolherExilio`, `Quedas.AoCair` | Ponto do exílio escolhido (linhagem nível 7; null = sorteio longe de quem derrubou); reagir a uma queda (ranking, legado, IA). `Reino.UltimaQueda` tem o resumo. |
| `Combate.Campo.Lutar(m, exército, marcha, tática, motivo)` | Combate em campo instantâneo contra uma marcha (interceptação, postura agressiva; escolta e caravanas podem usar). Feridos, veterania, `AoTerminar` e relatórios incluídos. |
| `Combate.Interceptacoes.Calcular/Alvo`, ordem `interceptar` | Ponto de encontro nos próximos `P.guerra.interceptacao.trechoHexes` hexágonos da marcha (o resto do caminho é segredo); quem pode ser interceptado (usa `Permissoes`). |
| `Combate.Revide.Registrar/Atacou` | Quem atacou um reino na última P.guerra.postura.revidaH (postura "atacar apenas quem atacar"). Ataques de outros sistemas registram aqui. |
| `Combate.Veterania.Aplicar/BonusDe/DoLocal/DaMarcha`, `Pessoa.Marcas` | Marcas de veterania por pessoa; o bônus do grupo é a média dos soldados nele. |
| `Combate.Feridos.Adicionar/Curar`, fila `cura`, `LoteFeridos.PessoaIds` | Lotes de feridos no castelo (pessoas em `Estados.Ferida`; morrem no prazo, com nome) e a cura com ervas. `Combates.AoFerir` entrega a contagem e as pessoas. |
| `Combate.ModelosAtaque`, `Reino.UltimoAtaque` | Modelos de ataque salvos e o último ataque (recurso `"auto"` = recurso principal do alvo). |
| `Combate.Combates.AoTerminar` | Batalha encerrada (`ResultadoCombate`: lados, tropas, perdas, milícia): veterania, ranking, legado. |
| `Combate.Combates.AoFerir` | Feridos de um lado (reino, unidades, local). Sem ninguém registrado, as baixas são todas mortes. |
| `Combate.Combates.PopDoLocal`, `Combates.Perdas` | População "do local" (milícia, massacre, espionagem); divisão proporcional de perdas. |
| `Combate.Defesas.NoAlcance/ArqueirosNoAlto/Protege`, `Defesas.RequisitosPortao` | Torres que cobrem um local (espionagem usa); bloqueios extras dos portões (o nível acima de `P.combate.portao.nivelSemEra` já pede a Era do Cerco Avançado por `Recrutamento.ReqCumprido`). |
| `Combate.Batalhas.Ativa/Recalcular/Encerrar` | Batalha num local; quem muda a composição fora dos ganchos (aliados reforçando) chama `Recalcular`. |
| `Reliquia` (`m.Reliquias`, `Reliquias.Carregar/Guardar`) | Relíquia lendária guardada num local ou carregada por marcha. |
| `Caminhos.CustosExtras` | Peso extra por hexágono na rota segura (fauna). |
| `Nevoas.FontesDeVisao` | Visão extra (torres, exploradores parados...). |
| `Obras.HexOcupado` | Hexágonos ocupados por objetos do sistema (torres, postos...). |
| `CheckpointReinoEvento.AoCheckpoint` | Rodar de hora em hora por reino (IA...). |
| `CriacaoReino.AoCriar`, `ObraFundar.AoFundar`, `Filas.AoConcluir`, `Mundo.AoCriarMundo` | Reagir a acontecimentos. |
| `ITipoItemFila.Cancelado` | Desfazer o que o item reservou além do material (população do recrutamento...). |
| `Reino.FilaSe`, `Filas.DevolverMaterial` | Ler uma fila pelo nome sem criá-la (nomes vindos do cliente; `Reino.Fila` cria); devolver o material de um item a um local do próprio reino (ou ao castelo). |
| `IOrdemExercito` | Nova ordem de exército (`Ordem`, `Validar`, `Chegou`; `NoEnvio = false` se não vale ao enviar de um local). Classe com construtor vazio; achada por reflexão. O combate acrescenta "atacar". |
| `Exercitos.BloqueiosOrdem`, `Exercitos.AoEntrarNoLocal` | Impedir nova ordem (ex.: em batalha); reagir a tropas que entram num local (relíquias carregadas). |
| `Marcha.Interceptavel`, `Marcha.Reliquias`, `Marcha.AoSerVencida(m, vencedor)` | Contrato de interceptação: o combate decide quem vence; quem perde entrega a carga (até a capacidade livre do vencedor) e as relíquias, e sai do mapa. Exploradores e mensageiros devolvem `Interceptavel = false`; caravanas e carregadores sobrescrevem `AoSerVencida` se precisarem reagir. |
| `Recrutamento.ReqCumprido`, `Recrutamento.Requisitos` | Quem cumpre um `U.req` (eras); bloqueios extras de unidade. |
| `Marcha.AoPerderNoCaminho` | Quem perde no caminho, antes de ser esvaziado (perdedor, vencedor): o equipamento lendário vai ao vencedor. |
| `Sistemas.Revelavel/Revelar/Estado/Gatilhos`, `Reino.SistemasVistos` | Sistemas apresentados aos poucos: registre a chave em AoIniciar, chame `Revelar` no gatilho (notifica "Novo: ..."); GET /reino leva `sistemas` com as chaves registradas; `Gatilhos` conferem antes de mostrar (ex.: ferraria ocupada). |
| `Forja.Ferrarias`, `Forja.BonusFerraria`, `Forja.Lendarios` (`m.Lendarios`) | Eras feitas (`Ferrarias.EraFeita`, `EraAtual`), níveis de armas e armaduras, maior local de um tipo; bônus por família; onde está cada equipamento lendário e o bônus dele. |
| `Reinos.Tropas` | Ajudantes de grupo de tropas: validar, retirar (tira as pessoas da guarnição, as mais veteranas primeiro), devolver, somar, velocidade, carga, visão (`Visao`: a maior `U.visao` do grupo), força contra fauna, população. Dentro de uma `Marcha`, a propriedade `Tropas` esconde a classe: use um alias (`using GT = ReinoDePedra.Jogo.Reinos.Tropas;`). |
| `Pessoas.Pessoas` (`Jogo/Pessoas/`), `Marcha.PessoaIds`, `Marcha.AoEncerrar`, `Pessoas.Escolher` | Pessoas civis e soldados: nascer, morrer, atribuir trabalho, levar (carregar, treinar), sair e entrar de guarnições e marchas, baixas e feridos com nome. Uma marcha reclama na partida quem saiu do local de origem; ao encerrar, quem ainda estava nela some (desembarque antes). `Escolher` marca pessoas pelo id para o próximo envio (`EnvioPessoas.Ler` na API). Alias: `using PS = ReinoDePedra.Jogo.Pessoas.Pessoas;` (dentro de `ReinoDePedra.Jogo.*`, `Pessoas` sozinho é o namespace). |
| `Pessoas.Deslocamento` (marcha `pessoas`), `Carregadores.PessoaIds/Pendente` | Civis andando entre locais do reino (sem fauna nem interceptação); carregadores da requisição com pessoas, várias viagens e volta para casa. |
| `Marcha.AgendarRevelacao`, `RevelarCaminhoEvento` | Revelação da névoa ao vivo: eventos nos trechos do caminho que entram em névoa nunca vista (no máximo um por minuto) e um antes da chegada; avisam `"mapa"` ao dono quando revelam algo. Chamado em `Fauna.AoPartir` para toda marcha. |
| `Exercitos.Bloqueio`, `Exercito.PararAqui` | Motivo que impede nova ordem agora (o mesmo de `DarOrdem`; a API manda `podeOrdem`/`bloqueio`); "parar aqui" (`mover` para o próprio hexágono): fica onde está, com a postura padrão de campo, passando pelos ganchos de `AoPartir` (interrompe caça, extração e escavação). |
| `VisaoTropas.Estado/Trabalho/FaunaNoDestino`, `VisaoMapa.MarchaPropria` (Api) | Estado único de marcha própria ("marchando", "parado", "retornando", "trabalhando"), o trabalho de um exército parado (tipo `caca`, `extracao`, `escavacao` ou `coleta`; `{ tipo, recurso, coletado, destino, inicio, fim }`), a fauna conhecida num hexágono com o veredito da regra de perdas; o objeto de marcha própria do mapa (carga, tropas, estado, alvo). |
| `VisaoReino.Extras`, `VisaoReino.ExtrasLocal`, `VisaoMarcha.ExtrasPropria`, `VisaoMapa.Extras` (Api) | Acrescentar dados ao que o cliente recebe. |
| `Jogo.Publico.RegraPublica`, `Jogo.Publico.MensagensGlobais`, `Api.Publico.FeedPublico`, `Combate.Batalhas.AoComecar`, `Capturas.AoCapturar` | A regra única do que é público ([0036](decisoes/0036-mapa-publico-e-convites.md)): monta campo a campo o que o site e o mapa do jogador mostram de outros reinos. O feed guarda bytes prontos por parte (`chao`, `mundo`, `vivo`, `info`) e não passa pelo motor a cada visitante. Campo novo em objeto de outro reino entra aqui, de propósito. |
| `Api.Contas.ServicoConvites`, `ModuloPublico`, `ModuloAdmin`, `scripts/convites.sh` | Fila de pedidos de convite, link de uso único (só o hash fica guardado; `Consumir` é um UPDATE condicional) e rotas do administrador (`REINO_ADMIN_TOKEN`). |
| `Marcha.AlvoDeFauna`, `Marcha.Furtiva`, `Marcha.ForcaContraFauna`, `Marcha.SofrerFauna`, `Marcha.AoPassar` | Fauna e visibilidade por tipo de marcha (mensageiro fora da fauna, batedor furtivo, caravana perde carga...). |
| `OpcoesCaminho.ReinoId` | A rota segura evita a fauna que esse reino conhece (passe sempre o reino que viaja). |
| `Espionagem.TorresNoAlcance` | Torres na chance de o batedor ser visto. |
| `Capturas.Ignorar`, `Capturas.AoPedirResgate`, `Capturas.PagarResgate` | Aliança/pacto sem captura; levar o pedido de resgate e libertar quando pago (comércio). |
| `Avistamentos.Registrar` | "Visto há X" no mapa por `P.avistamentoH` (espião). |
| `Sistemas.Registrar/Revelar`, `Reino.SistemasVistos` | Sistemas apresentados aos poucos: registre a chave em AoIniciar e revele no gatilho ("Novo: ..."); GET /reino manda `sistemas`. |
| `OrdemReforcar.Aceita/Chegada`, `Tropas.Reservadas`, `Tropas.GuarnicaoLivre` | Reforço em local que não é seu (aliança); tropas da guarnição que o dono não pode usar. |
| `Reforcos.PartesDasPerdas` | Parte de cada reforço aliado nas perdas da defesa de um local (perdas e feridos de cada reino). |
| `Aliancas.SaoAliados/EmTregua` | Aliança para outros sistemas (IA, interceptação). |
| `Remessa`, `Remessas.Enviar`, `Remessas.AoTerminar[motivo]` | Carga de um reino para outro (troca, ajuda, pagamentos): sai dos locais mais próximos, roubável; reação quando a última chega ou uma é roubada. |
| `Comercio.AceitarTroca/Abertas/PactoAtivo/ConferirNovato` | Comércio para a IA comerciante e para quem precisa do pacto ou do limite do novato. |
| `VisaoMapa.Aliados`, `VisaoMapa.Dono` (Api) | Quem é aliado e como cada dono aparece (`meu`, `aliado`, `outro`, `livre`). |
| `RP.teclas` (`registrar(tecla, { descricao, grupo, acao, quando, ctrl, oculta })`, F1), `RP.menuContexto({ x, y, titulo, acoes, itens })`, `[data-dica]` / `[data-dica-rec]`, `data-tecla` nos botões de folha, `RP.painel` (janela), `RP.montarTopo`, `RP.NAV`, `RP.itensMenuMais` (cliente) | Mesa de computador ([0030](decisoes/0030-mesa-desktop.md)): atalhos de teclado com ajuda, menu de contexto do botão direito a partir do mesmo HTML de botões da folha, dicas ao passar o mouse, tecla de cada comando, janela flutuante das telas e barra do topo. `RP.gestos` entrega `cliqueDireito`, `passar` e `toque(..., duplo, shift)`; `Cena.deslocar` / `Tatico.deslocar` movem a câmera pelo teclado. |
| `RP.social` (cliente) | Peças comuns do social: `cargaTxt`, `cargaHTML`, `brasao`, `stepper`, `chipsRecurso`, `campoRecado`; evento `rp:social` nos avisos `alianca`, `comercio` e `mensagem`. |
| `Fauna.Limpar`, `MundoTeste(fauna: true)`, `ServidorTeste.Iniciar(fauna: true)` | Testes sem sorteios de fauna por padrão. |
| `Sistemas.Apresentavel`, `Sistemas.Revelar`, `Reino.SistemasVistos` | Sistemas apresentados aos poucos: registre a chave e revele no gatilho ("Novo: …"); o cliente lê `RP.reino.sistemas` com `RP.sistema(chave)`. |
| `Caravanas.Enviar`/`Planejar`, `Caravana` (marcha) | Transporte manual (base → origem → destino → volta), com veículos de `Reino.Veiculos` e escolta. |
| `Extracoes` (`Liquidar`, `Reagendar`, `Enviar`), ordens `extrair`/`entregar`/`escavar`/`buscar-reliquia` | Trabalho de exércitos no mapa; `Marcha.ExtraiJazidaId`/`EscavaRuinaId` dizem quem está trabalhando. |
| `Coletas` (`Recurso`, `Motivo`, `Disponivel`, `Liquidar`, `Reagendar`, `Enviar`, `Deposito`), `PontoColeta` (`m.PontosColeta`), ordens `coletar`/`entregar-coleta` | Coleta de madeira e pedra no mapa sem tique ([0028](decisoes/0028-vida-e-coleta.md)); `Marcha.ColetaPontoId` diz quem está coletando. Civis sem trabalho vão no exército (`Pessoas.LevarParaColeta`, `Coletores`, `CivisColetando`, estado `coletando`) e voltam para casa num gancho no início de `Marcha.AoEncerrar` (`Pessoas.SoltarColetores`). |
| `Pessoas.Vidas` (`Max`, `Atual`, `Ferir`, `AposBatalha`, `CheiaEm`), `Pessoa.Dano/DanoEm` | Vida sem tique: guarde o dano pelo `Ferir` (que diz se chegou a zero; quem chama remove a pessoa). `Marcha.SofrerGolpes` e `Marcha.AlvosDeFauna`: ataque de fauna como dano e quem ele fere (carregadores fogem). |
| `ReliquiasLendarias.NoMapa`, `ReliquiasLendarias.Oculta`, `VisaoValiosos.ReliquiasConhecidas` (Api) | O que o reino vê das relíquias (local com relíquia é público, sem o tipo); marchas que outros não veem (furtivas); relíquias reveladas por espionagem na tela Relíquias. |
| `RP.valiosos` (cliente) | Peças comuns de caravana, extração e relíquias (caminhos, gráfico de cenários, escolta, `V.tentar`). |
| `RP.ordensEnvio`, `RP.acoesTropas`, `RP.extrasTropas`, `RP.NOMES_MARCHA` (cliente) | Ordens extras no envio pelo mapa (`{ ordem, rotulo, verbo, icone, descricao, dados, quando(hex, dados, envio) }`), cartões e blocos da tela Tropas, nome dos tipos de marcha. |
| `RP.TIPOS_ATAQUE`, `RP.graficoBatalha`, `RP.mapa.tiposObjeto.torre/batalha` (cliente) | Tipos de ataque; gráfico de força dos lados (`serie` com `t, meu, eles, proj`); objetos do mapa. O mapa que desenha `tiposObjeto` sozinho marca `RP.mapa.desenhaTiposObjeto = true` e o combate deixa de desenhar e de pôr linhas na folha. |
| `RP.mapa.tiposObjeto`, `RP.mapa.camadas` (cliente) | Tipos de objeto do mapa (`{ nome, icone, desenharTatico(ctx, o, p, cam), folha(o) }`) e camadas que ligam e desligam (`perigo`). |
| `RP.ferraria` (`dados`, `carregar`), `RP.reino.ferraria`, `local.lendarios`, `RP.SISTEMAS` (cliente) | Dados de `GET /ferraria`; resumo da ferraria e equipamento lendário em cada local no GET /reino; nome e texto dos sistemas revelados aos poucos (`RP.sistema(k)`). |
| `RP.exploracao`, `RP.blocoRisco`, `RP.opcaoCaminhoExp`, `RP.perigoConhecido` (cliente) | Dados de `GET /exploracao`, risco da fauna e opção de caminho com risco (caravana, extração, escolta), perigo conhecido de um hexágono. |
| `RP.extrasGuarnicao`, `RP.extrasExercito`, `RP.extrasFolhaExercito`, `RP.grupoPadraoEnvio` (cliente) | Linhas nos cartões de guarnição e de exército da tela Tropas e na folha do exército (selo de veterania); tropas padrão do envio pelo mapa (o combate devolve as do último ataque). |
| `RP.pessoasVista.barraVida/vidaAgora`, `RP.coletaRecurso` (cliente) | Barra de vida sobre a figura de quem está ferido (pessoas `vida`, `vidaMax`, `vidaH` do `GET /mapa`); recurso que se coleta num hexágono conhecido (tela `#/coleta`). |
| `RP.pessoasVista` (`vista/pessoas.js`), `RP.sprites` (`vista/sprites.js`), `RP.selecao` (`vista/selecao.js`), `RP.folhaPessoa`, `RP.folhaPessoasDoHex`, tela `pessoas` (cliente) | Camada de pessoas na Vista (alvos `['pessoa', id]` e `['pessoas', hex]`), sprites por ofício e pose em cache, seleção de tropas (toque seleciona, toque num lugar oferece Enviar tropa, toque noutra tropa oferece Juntar; modo, laço, Shift; barra com Missão e Patrulha), folha da pessoa e tela Pessoas. `GET /mapa` manda `pessoas` e `pessoasOutras`; os envios aceitam `pessoas: [ids]`. |
| `Mapa.Pegada` (`Hexes`, `DoLocal`, `Tamanho`), `Mundo.CentroDoLocal`, `Mundo.Reindexar`, `Obras.PegadaLivreParaObra`, `CriacaoReino.Pegadas` | Construções em vários hexágonos (`P.ocupa`: 7, 3 ou 1). `m.LocalNoHex(h)` responde por qualquer hexágono da pegada; distâncias, caminhos e visão continuam medidos do centro (`Local.Hex`). Ordens tocadas na pegada vão ao centro (`CentroDoLocal`). Quem troca o tipo de um local (castelo em ruína, sede nova) chama `Reindexar`. Ver [0026](decisoes/0026-mapa-maior-e-bonecos-3d.md). |
| `Marchas.Percursos`, ordens `percorrer` e `patrulhar`, `IOrdemExercito.Trajeto`, `Caminhos.Seguir` | A linha exata desenhada no mapa (`Dados.pontos`, inteira; `Dados.circuito` fecha a linha; até `P.patrulha.maxHexes`). `Trajeto` dá o caminho da partida depois de `Validar`; `Seguir` anda pelos hexágonos dados, sem A*. |
| `Marchas.Grupos`, ordem `juntar`, `POST /tropas/juntar`, `POST /tropas/{id}/separar` | Juntar e separar tropas em campo (carga, relíquias, equipamento e passo). `Grupos.Parte` dá ordem a parte de uma tropa (`pessoas` em `/tropas/{id}/ordem`). |
| `Exploradores.Aguardar`/`Esperar`, `Explorador.Circuito` | O explorador que chega fica no destino esperando ordem (estado "parado" na API); rota em circuito recomeça no fim. A IA dá destino novo aos seus (`Governo.ExploradoresParados`). |
| `Escavacoes.Juntar`, `Pessoas.Unir` | Grupos que se juntam no mapa: as pessoas, as tropas e a carga passam para o outro exército, que segue com o trabalho dele (escavação recalculada com o progresso). |
| `RP.estruturas` (`vista/estruturas.js`, módulo ES) | Construções 3D montadas com peças de kits CC0 da Kenney (`castelo.glb`, `vila.glb`, `sobrevivencia.glb`, `ruinas.glb`): `local(o)`, `ruinaAntiga(esgotada)`, `torre(nivel, cor)`, `CX` (caixas em unidades do mundo), `alturaTorre(n)`. `RP.arte.local`, `RP.arte.ruina` e `RP.arte.jazida('ruina')` desenham o sprite quando ele existe e a arte 2D antes; a torre (`vista/tipos.js`) também. Um tipo novo de local ganha um caso em `montarLocal`. |
| `RP.sons` (`sons.js`) | Sons de efeito pelo Web Audio, de `web/sons/*.mp3` (CC0, ver `web/sons/LICENCAS.md`). `tocar(nome, { vol, pan })` e `tocarJa` (espera o arquivo na primeira vez); `aoPedido` (chamado por `RP.api` em toda escrita confirmada: som pelo caminho), `aoErro` (`RP.tentar`), notificações pela categoria (`RP.ouvir('notificacao')`); `mundo(fontes, cena)` com os itens da Vista que têm `som` (`machado`, `picareta`, `martelo`, `batalha`; tipos de objeto podem declarar `tipo.som`). Preferências `sons`, `volume` e `sons-mundo` em `RP.pref`. |
| `RP.natureza` (`vista/natureza.js`, módulo ES) | Vegetação e relevo 3D do Nature Kit (`natureza.glb`), recoloridos pelos nomes dos materiais (`COR`) e renderizados uma vez por variante (`TIPOS`: `con`, `fol`, `outono`, `arb`, `mon`, `roc`, `mor`, `pic`, `jun`, `agua`, `pedraRio`, `margem`, `canoa`; `ponte(c, ang, antigo)` para a ponte na direção da estrada). `desenhar(c, tipo, h, s, antigo)` desenha no cache estático do chão da Vista; quando os sprites ficam prontos ou são refeitos (inclinação da câmera), o evento `rp:natureza` faz as cenas refazerem o cache. |
| `RP.bonecos` (`vista/bonecos.js`, módulo ES), `web/modelos/`, `web/vendor/three/`, `RP.hex.pegada` (cliente) | Bonecos 3D (pessoa da Kenney, cavalo de Quaternius, CC0) renderizados por three.js num canvas fora da tela e guardados como sprites; `RP.sprites.pessoa` e `RP.arte.cavalo` os usam quando prontos e caem na figura 2D antes disso. Opções aceitas: as de `RP.sprites.pessoa` mais `semente`, `feminina`, `ang` (8 direções), `pose`, `correndo`, `bandeira`, `pelagem`, `galope`, `pastando`. Licenças em `web/modelos/LICENCAS.md`. |
| `Temporada.Temporadas` (`Fim`, `DiaIndice`, `MarcarAtivo`, `Encerrar`, `Reiniciar`, `Reagendar`, eventos `AoTerminar`/`AoReiniciar`), `Mundo.DuracaoTemporadaMs` | Fim da temporada e reset do mundo (ver [decisão 0020](decisoes/0020-temporada.md)); temporada curta em desenvolvimento com `REINO_TEMPORADA_MIN`. |
| `m.Legados` (`LegadoConta`), `Temporada.Linhagem` (`Nivel`, `BonusReino`, desbloqueios), `Mundo.Banco` | Legado por conta (tabela `legado`), bônus das relíquias da temporada, desbloqueios da linhagem. |
| `IColecao.Limpar` | Esvaziar uma coleção na memória sem marcar remoções (reset). |
| `Economia.ModificadoresCrescimento` | Multiplicadores da taxa de crescimento da população (relíquia da temporada de crescimento). |
| `CriacaoReino.BrasaoLiberado`, `CriacaoReino.CriarNaRegiao/VagaPerto`, `Brasao.Valido(extras, moldura)` | Brasões liberados pela linhagem; região inicial. |
| `Temporada.Ranking`, `Reino.RankBaixas/RankPerdas/VenceuCerco` | Ranking da temporada e conquistas rastreadas na temporada. |
| `Temporada.PrecisaDeVoce.Listar/Extras` | "Precisa de você" (GET /agora): itens `{ grupo, icone, titulo, texto, href, botao, fim }`. |
| `Exploracao.Avistamentos.AoRegistrar`, `Combate.Avistamentos.Visao/Arredondado` | Reagir a um avistamento de espião; visão de um reino sem marcar a névoa; número arredondado para o que se vê de fora. |
| `RP.aviso({ titulo, texto, icone, tipo, link, ms, anuncio, descartavel })` (cliente) | Aviso no centro da tela. Com `anuncio`, grande e em fila (o que aconteceu); sem ele, menor e na hora (resposta a um gesto). |
| `RP.agoraItemHTML`, telas `#/temporada`, `#/ranking`, `#/agora`, aviso SSE `temporada`, `RP.extrasConstrucao[].sistema` (cliente) | Item do "precisa de você"; telas da temporada; aba de construção que só aparece depois do gatilho do sistema; `RP.reino.legado` (`linhagem`, `titulo`, `regiaoExilio`). |
| `RP.seloVeterania`, `RP.mapa.tiposObjeto.avistamento`, telas `#/exilio` e `#/interceptar?marcha=` (cliente) | Selo de veterania; espião visto no mapa; exílio e interceptação. |
| `m.IA` (`Ativa`, `CriarReinos`), `MundoIA.Novo` (testes) | Liga a IA no processo (não é gravado): sessões dos reinos de IA; meta de ocupação (`REINO_IA=0` desliga só esta). `MundoTeste` sobe com a IA desligada. |
| `Ocupacao.Completar/CriarUm/Abdicar/LiberarVaga/VagaLonge` | Meta de ocupação (leva inicial, mínimo de ativos), reino de IA novo, abdicação (castelo em ruína, locais como terra livre) e vaga para jogador. |
| `CriacaoReino.IdNovo` | Id do reino e dos locais iniciais (a IA sorteia de uma reserva para a ordem dos ids não revelar quem é IA). |
| `CriacaoReino.VagaUtilizavel/LocalSubstituivel` | Vaga que pode receber reino novo (sem local de outro reino nem relíquia/lendário nos 5 hexágonos); local sem dono que pode dar lugar. |
| `Sessoes.Agendar/De`, `SessaoIAEvento`, `Conduta` | Próxima sessão de um reino de IA e a conduta (habilidade × perfil). Reino de jogador não tem conduta: ninguém o governa. |
| `Governo.Sessao` e partes (`Construir`, `Recrutar`, `Defender`, `Explorar`, `Cacar`, `Extrair`, `Torres`, `Ocupar`, `Espionar`, `Atacar`) | Decisões da IA, sempre pelos serviços da API e com a informação de um jogador. Um sistema novo que a IA deva usar ganha uma parte aqui. |
| `Comerciante.Responder/Vale` | Respostas da IA a trocas e pactos (margens de `P.comercio.margemIA` e `P.ia.comercio`). |

## Regras de visibilidade (o servidor é quem esconde)

- O cliente só recebe o que o reino pode saber: terreno das áreas exploradas, objetos ao vivo só no que vê agora, último estado conhecido no resto.
- Locais de outros reinos: tipo e nome genérico, **nunca o dono**, salvo espionagem, aliança ou estandarte.
- Forças sem estandarte: sem identidade. Reinos de IA: **nada** os distingue de jogadores (nem campo, nem id especial, nem tempo de resposta).

## API

- JSON em `/api/v1`, nomes em camelCase, enums em camelCase. Erros: status 4xx e `{ "erro": "mensagem para o jogador" }` (lance `RegraException`).
- **Sem tipo anônimo no JSON**: o gerador do System.Text.Json não os aceita. Cada formato de resposta é um `record ...Json` (os nomes, a ordem e o tipo dos membros são o formato) com um `[JsonSerializable]` em `Api/JsonApi.cs`; o mesmo vale para os pedidos (`Pedido*`) e os avisos do SSE. Responda com `Json.Resposta(valor, Json.Web)`, não com `Results.Json`, que usa reflection. Valor guardado em `object` vai pelo tipo de verdade: registre também `List<...Json>`, `Dictionary<string, ...Json>` e afins, e materialize (`ToList()`) o que for enumerável preguiçoso.
- Autenticação: cookie HttpOnly `rp_sessao` (web) ou `Authorization: Bearer <token>` (app: `"app": true` no login devolve o token). Escritas com cookie exigem o cabeçalho `X-Reino: 1`.
- Avisos em tempo real: `GET /api/v1/eventos` (SSE). O servidor manda avisos curtos (`reino`, `marchas`, `mapa`, `relatorio`, `notificacao`...) e o cliente busca só o que mudou. `m.Avisar(reinoId, "tipo", dados?)`.
- Mesma API para o futuro app de celular.

## Cliente web

### Princípios de interface

Valem para toda tela nova ou refeita (ver [decisão 0023](decisoes/0023-concha-jogo-sempre-visivel.md)):

1. **O jogo nunca fica escondido.** O mundo ocupa a tela o tempo todo e anda em tempo real. Tocar em local, botão ou ação não abre tela cheia nem menu que cubra o jogo; avisos também não cobrem a área de jogo.
2. **Pouca informação por vez.** A tela mostra só o que importa agora; o resto fica um toque adiante, nunca ao mesmo tempo. Orçamento por tela: 1 ação principal, até 3 secundárias, no máximo 5 informações fixas.
3. **Ações só do que está selecionado.** Sem seleção, a tela tem só o jogo, os recursos e a navegação. Ao tocar em algo aparece um painel pequeno com no máximo 3 ações; o resto fica em "Mais ações".
4. **Uma ação principal por contexto**, destacada (`btn-primario`); as outras em segundo plano.
5. **Cada informação em um lugar só.** Se o mesmo dado aparece em três telas, uma é a dona e as outras ligam a ela por um toque.
6. **Regra de teste:** quem nunca viu o jogo olha a tela por 5 segundos e diz o que ela mostra e qual é a próxima coisa a fazer.
7. **Linguagem do jogador.** Termo interno (teto, guarnição, postura, requisição) não aparece na tela: "moradores", "tropas no local", "comportamento", "o material vem sozinho". Chaves da API não mudam.
8. **Tempo sempre como duração** ("pronto em 5 min", `RP.fmtEm`) e nunca `NaN` ou `Invalid Date`: as formatações aceitam valor vazio.
9. **Informação em camadas.** Regras e notas que não são a decisão de agora ficam em "Como funciona" (`RP.comoFunciona`); seções secundárias, recolhidas (`RP.secaoRecolhida`). Listas de escolha usam uma linha por item (`escolhas-linhas`) e o detalhe só do escolhido.

### Convenções

- Sem framework e sem build: scripts com o namespace global `RP`, carregados em ordem por `web/index.html`.
- Base: `icones.js`, `brasao.js`, `hex.js`, `api.js` (`RP.get/post/put/del`, `RP.ouvir` para SSE), `nucleo.js` (concha: painel, folha, confirmação, avisos, navegação; timers, barra de recursos, produção, carga, rotas, estado `RP.reino`).
- Concha (`web/css/concha.css`): a tela `mapa` é a tela de fundo (`fundo: true`), montada em `#mundo` e nunca escondida enquanto há reino. As outras telas do jogo são montadas em `#telas`, o painel (baixo no celular, coluna à direita no computador; `RP.painel`). A tela do painel, a folha de seleção (`RP.abrirFolha`, sem véu, com até 3 ações) e a confirmação (`RP.modal`) ocupam o mesmo lugar e formam uma pilha: só a de cima aparece, a folha sobre uma tela mostra "‹ Reino" para voltar e o X volta ao mundo; no computador, folha e confirmação ocupam a coluna inteira ([decisão 0027](decisoes/0027-paineis-sem-sobreposicao.md)). Nunca ponha outro elemento fixo sobre o painel. Telas públicas (`publica: true`) ocupam a tela toda.
- Cada tela num arquivo de `web/js/telas/`, registrada com `RP.registrarTela(nome, { montar, entrar, sair, nav, secao, fundo, publica })`. Rotas em hash: `#/nome?param=1`. `nav: true` marca um destino de `RP.NAV`; `secao` liga uma sub-tela ao seu destino.
- Tempo: tudo que tem tempo usa `RP.barraTempo(inicio, fim, { rotulo, classe: 'curta', cor })` (barra de progresso com o cronômetro ao lado, anda sozinha no tique); a API manda o início junto do fim (`inicio`, `partida`, `materialPartida`...). Prazos que não são progresso (escudo, feridos) ficam só com o cronômetro.
- Peças comuns: `RP.custoHTML` (custo com "faltam X · pronto em Y"; o que nada produz diz "extraia ou troque"), `RP.itemFilaServidor` (item de fila com barra de tempo; com várias unidades, "2 de 5 prontos"), `RP.itensFilaHTML(fila, filtro)` (itens de uma fila, ex.: o treino de exploradores), `RP.miniRota` (minimapa do caminho), `RP.cargaHTML` (carga com barra), `RP.popSomaHTML` (população + tropas = moradores), `RP.producaoHTML` / `RP.contaRecursoHTML` (produção e "quando terei X"), `RP.faunaVereditoHTML` (força do bando × força do grupo), `RP.textoFilaItem` (aviso ao enfileirar).
- Siga `prototipo/design-system.md` e reaproveite CSS, ícones e arte do protótipo. Estilos novos em `web/css/jogo.css` (ou arquivo próprio do sistema), sempre com os tokens.
- Tempo no cliente: `RP.agora()` (relógio do servidor, na mesma aceleração dele: `aceleracao` de `GET /mundo`, só > 1 no teste local). Estoques andam sozinhos entre atualizações (`RP.qtdRecurso`).
- Toque no mundo: a Vista e o Mapa medem o canvas por `ResizeObserver` (a coluna do painel muda a largura com transição) e de novo a cada toque. Na Vista, o objeto só ganha o toque no hexágono dele; escolhendo destino (`escolhendoHex`), vale sempre o hexágono do chão.
- Mundo: `web/js/vista/` (modelo do `/mapa`, arte, Vista 2.5D, Mapa tático). Objetos novos no mapa ganham desenho registrando `RP.mapa.tiposObjeto[tipo]` (e `RP.mapa.tiposMarcha`, `RP.mapa.perigoHex`, `extrasFolhaHex`...) no arquivo do próprio sistema; ver [decisão 0017](decisoes/0017-vista-e-mapa-no-cliente.md). A inclinação e o giro da câmera são do jogador (`RP.arte.definirK`/`Cena.inclinar` e `RP.arte.definirAz`/`Cena.girar`); quem desenha no chão da Vista usa `chao`/`obj` ou `Cena.tela`/`mundo`, nunca a conta de projeção na mão.

## Testes

- `cd servidor && dotnet test`. `MundoTeste` cria um mundo com relógio falso: `t.NovoReino()`, `t.AvancarMin(5)`, `t.DarRecursos(r)`.
- Cada regra nova ganha teste. Fórmulas são conferidas contra o modelo.
- `MundoTeste` e `ServidorTeste` sobem **sem fauna** (sorteios); passe `fauna: true` para ter a fauna do mundo. Para um sorteio de `m.Sorte` com resultado conhecido, troque `m.Sorte` por um `Rng` com semente escolhida (ver `ExploracaoTestes.Sorte`).
- Teste de carga (`CargaIATestes`, `Categoria=carga`): 30 reinos (jogadores e IA) por dias de jogo simulados, medindo tempo de CPU por evento, hexágonos visitados pelas buscas de caminho e memória; depois o mesmo save sobe num servidor de verdade, com relógio de parede, no ritmo real, 720× mais rápido e com um dia de atraso. Números em [`desempenho.md`](desempenho.md).
- Cenários que escrevem contagens direto (`l.Guarnicao["lanceiro"] = 4`, `CombateCenario.Alvo`) funcionam porque `Pessoas.Sincronizar` faz as pessoas que faltam nascerem na primeira operação; para pessoas específicas use `Pessoas.CriarSoldados`, `Pessoas.Povoar`, `Pessoas.Nascer` e `Pessoas.RemoverCivis`.

## Segurança e repositório público

- Nada de segredo, endereço de servidor, nome de máquina ou caminho local em código, configuração, documentação ou commit. Configuração por variáveis de ambiente (`.env.exemplo` com valores fictícios).
- Revise o diff antes de cada commit procurando segredos e caminhos locais.
