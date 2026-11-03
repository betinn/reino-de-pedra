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
- Produção e população são calculadas sob demanda (`Economia.Atualizar(m, reino)` antes de ler ou mexer em estoques). Um `CheckpointReinoEvento` por reino por hora mantém tudo em dia.
- Sorteios de jogo: `m.Sorte` (não use `Random`). O mapa usa `Rng` com semente (determinístico).

## Documentos e persistência

- Entidades persistentes herdam `Documento` e vivem numa `Colecao<T>` do `Mundo`. Para uma coleção nova, num arquivo do seu sistema:
  ```csharp
  namespace ReinoDePedra.Jogo { public sealed partial class Mundo { public Colecao<Alianca> Aliancas { get; } = new("aliancas"); } }
  ```
  Toda propriedade pública `Colecao<T>` do `Mundo` é registrada e gravada sozinha.
- `Reino`, `Local`, `Marcha`, `Jazida`, `Ruina`, `Nevoa`, `Mundo` são `partial`: acrescente campos em **arquivo próprio do sistema** (ex.: `Reinos/Reino.Alianca.cs`), não no arquivo central.
- Propriedades públicas com get/set são gravadas em JSON. Get-only não. Use `[JsonIgnore]` para caches.
- **Depois de mudar um documento, chame `m.Sujar(doc)`.** O motor grava os sujos a cada 3 s numa transação (SQLite em WAL). A cada 5 min uma varredura grava o que mudou sem `Sujar` e registra aviso no log: isso é bug, corrija.
- Subtipos (eventos, marchas) são gravados com o nome da classe: **não renomeie classes de documento** sem migrar o banco.

## Pontos de extensão (para não editar arquivos centrais)

| Onde | Para quê |
|---|---|
| `[Sistema]` + `public static void AoIniciar(Mundo m)` | Rodar na subida do servidor (e em `Sistemas.IniciarTodos` nos testes). Ganchos em listas estáticas: dentro de `Sistemas.UmaVez("chave", () => ...)`. |
| `ITipoItemFila` | Novo tipo de item de fila (obra, recrutamento, forja...). Classe com construtor vazio; achada por reflexão. |
| `Marcha` (subclasse) | Novo tipo de marcha; implemente `Tipo`, `Chegou`, e se preciso `PopOcupada`, `RaioVisao`. |
| `IModuloApi` (Api) | Novo grupo de rotas em `/api/v1`. Classe com construtor vazio; achada por reflexão. |
| `Economia.ModificadoresProducao`, `HorasDeEstoque`, `OcupantesExtras`, `TetoExtra` | Relíquias, salgadeira, feridos... |
| `Marcha.AoPartir` | Rodar a cada partida de marcha (fauna no caminho, encontros, avistamentos). |
| `Combate.Bonus.Ataque/Defesa/DefesaExercito` | Bônus de combate (armas, veterania, relíquia, lendário, legado); o combate soma e aplica o teto. |
| `Combate.Permissoes.AntesDeEnviar/AoChegar` | Bloqueios de ataque (aliança, pacto, trégua antes; escudo descoberto ao chegar). |
| `Combate.Combates.AoCairCastelo` | Cerco vitorioso: (reino que perdeu, exército vencedor, castelo). A queda do castelo (`Combate.Quedas`) registra aqui. |
| `Combate.Quedas.EscolherExilio`, `Quedas.AoCair` | Ponto do exílio escolhido (linhagem nível 7; null = sorteio longe de quem derrubou); reagir a uma queda (ranking, legado, IA). `Reino.UltimaQueda` tem o resumo. |
| `Combate.Campo.Lutar(m, exército, marcha, tática, motivo)` | Combate em campo instantâneo contra uma marcha (interceptação, postura agressiva; escolta e caravanas podem usar). Feridos, veterania, `AoTerminar` e relatórios incluídos. |
| `Combate.Interceptacoes.Calcular/Alvo`, ordem `interceptar` | Ponto de encontro sobre o caminho de uma marcha visível; quem pode ser interceptado (usa `Permissoes`). |
| `Combate.Revide.Registrar/Atacou` | Quem atacou um reino na última P.guerra.postura.revidaH (postura "atacar apenas quem atacar"). Ataques de outros sistemas registram aqui. |
| `Combate.Veterania.Aplicar/Normalizar/BonusDe`, `Local.Marcas/MarcasTropas`, `Marcha.Marcas` | Marcas de veterania; quem tira ou põe tropas numa guarnição por fora dos ganchos não precisa avisar (recrutas diluem sozinhos). |
| `Combate.Feridos.Adicionar/Curar`, fila `cura` | Lotes de feridos no castelo (morrem no prazo) e a cura com ervas. |
| `Combate.ForcasVistas.Registrar` | Marcar no mapa de um reino "forças vistas há X" (some em P.avistamentoH). |
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
| `CheckpointReinoEvento.AoCheckpoint` | Rodar de hora em hora por reino (IA, regência). |
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
| `Reinos.Tropas` | Ajudantes de grupo de tropas: validar, retirar, devolver, somar, velocidade, carga, visão (`Visao`: a maior `U.visao` do grupo), força contra fauna, população. Dentro de uma `Marcha`, a propriedade `Tropas` esconde a classe: use um alias (`using GT = ReinoDePedra.Jogo.Reinos.Tropas;`). |
| `Marcha.AgendarRevelacao`, `RevelarCaminhoEvento` | Revelação da névoa ao vivo: eventos nos trechos do caminho que entram em névoa nunca vista (no máximo um por minuto) e um antes da chegada; avisam `"mapa"` ao dono quando revelam algo. Chamado em `Fauna.AoPartir` para toda marcha. |
| `Exercitos.Bloqueio`, `Exercito.PararAqui` | Motivo que impede nova ordem agora (o mesmo de `DarOrdem`; a API manda `podeOrdem`/`bloqueio`); "parar aqui" (`mover` para o próprio hexágono): fica onde está, com a postura padrão de campo, passando pelos ganchos de `AoPartir` (interrompe caça, extração e escavação). |
| `VisaoTropas.Estado/Trabalho/FaunaNoDestino`, `VisaoMapa.MarchaPropria` (Api) | Estado único de marcha própria ("marchando", "parado", "retornando", "trabalhando"), o trabalho de um exército parado (`{ tipo, recurso, coletado, destino, fim }`), a fauna conhecida num hexágono com o veredito da regra de perdas; o objeto de marcha própria do mapa (carga, tropas, estado, alvo). |
| `VisaoReino.Extras`, `VisaoReino.ExtrasLocal`, `VisaoMarcha.ExtrasPropria`, `VisaoMapa.Extras` (Api) | Acrescentar dados ao que o cliente recebe. |
| `Fotos.Fotografos` | Objetos do sistema que ficam na foto da névoa (último estado conhecido fora da visão: torres, bandeiras...). |
| `Marcha.AlvoDeFauna`, `Marcha.Furtiva`, `Marcha.ForcaContraFauna`, `Marcha.SofrerFauna`, `Marcha.AoPassar` | Fauna e visibilidade por tipo de marcha (mensageiro fora da fauna, batedor furtivo, caravana perde carga...). |
| `OpcoesCaminho.ReinoId` | A rota segura evita a fauna que esse reino conhece (passe sempre o reino que viaja). |
| `Espionagem.TorresNoAlcance`, `Espionagem.Milicia`, `Espionagem.ExtrasRelatorio` | Torres e milícia na chance e no relatório de espionagem. |
| `Capturas.Ignorar`, `Capturas.AoPedirResgate`, `Capturas.PagarResgate` | Aliança/pacto sem captura; levar o pedido de resgate e libertar quando pago (comércio). |
| `Conhecimento.Conhecer` / `Conhecimento.AoConhecer`, `Reino.ReinosConhecidos` | Reinos conhecidos (espionagem, captura, resgate; estandarte e bandeira depois) e gatilho de alianças e comércio. |
| `Avistamentos.Registrar` | "Visto há X" no mapa por `P.avistamentoH` (espião; o combate pode registrar tropas). |
| `Sistemas.Registrar/Revelar`, `Reino.SistemasVistos` | Sistemas apresentados aos poucos: registre a chave em AoIniciar e revele no gatilho ("Novo: ..."); GET /reino manda `sistemas`. |
| `Permissoes.AntesDeEnviarNoLocal` | Bloqueio que depende do local (pacto/trégua quando o atacante já sabe de quem é o local). |
| `OrdemReforcar.Aceita/Chegada`, `Tropas.Reservadas`, `Tropas.GuarnicaoLivre` | Reforço em local que não é seu (aliança); tropas da guarnição que o dono não pode usar. |
| `Reforcos.PartesDasPerdas` | Parte de cada reforço aliado nas perdas da defesa de um local (perdas e feridos de cada reino). |
| `Aliancas.SaoAliados/EmTregua/AoEntrarEmRegencia`, `Aliancas.EmRegencia` | Aliança para outros sistemas (IA, regência, interceptação). |
| `Remessa`, `Remessas.Enviar`, `Remessas.AoTerminar[motivo]` | Carga de um reino para outro (troca, ajuda, pagamentos): sai dos locais mais próximos, roubável; reação quando a última chega ou uma é roubada. |
| `Comercio.AceitarTroca/Abertas/PactoAtivo/ConferirNovato` | Comércio para a IA comerciante e para quem precisa do pacto ou do limite do novato. |
| `VisaoMapa.Aliados`, `VisaoMapa.AoVerEstandarte` (Api) | Locais e marchas reconhecidos (dono "aliado" com `reino`); reagir a uma marcha vista com estandarte. |
| `RP.social` (cliente) | Peças comuns do social: `cargaTxt`, `cargaHTML`, `brasao`, `stepper`, `chipsRecurso`, `campoRecado`; evento `rp:social` nos avisos `alianca`, `comercio` e `mensagem`. |
| `Fauna.Limpar`, `MundoTeste(fauna: true)`, `ServidorTeste.Iniciar(fauna: true)` | Testes sem sorteios de fauna por padrão. |
| `Sistemas.Apresentavel`, `Sistemas.Revelar`, `Reino.SistemasVistos` | Sistemas apresentados aos poucos: registre a chave e revele no gatilho ("Novo: …"); o cliente lê `RP.reino.sistemas` com `RP.sistema(chave)`. |
| `Caravanas.Enviar`/`Planejar`, `Caravana` (marcha) | Transporte manual (base → origem → destino → volta), com veículos de `Reino.Veiculos` e escolta. |
| `Extracoes` (`Liquidar`, `Reagendar`, `Enviar`), ordens `extrair`/`entregar`/`escavar`/`buscar-reliquia` | Trabalho de exércitos no mapa; `Marcha.ExtraiJazidaId`/`EscavaRuinaId` dizem quem está trabalhando. |
| `ReliquiasLendarias.NoMapa`, `ReliquiasLendarias.Oculta`, `VisaoValiosos.ReliquiasConhecidas` (Api) | O que o reino vê das relíquias; marchas que outros não veem (furtivas); relíquias reveladas por espionagem na tela Relíquias. |
| `RP.valiosos` (cliente) | Peças comuns de caravana, extração e relíquias (caminhos, gráfico de cenários, escolta, `V.tentar`). |
| `RP.ordensEnvio`, `RP.acoesTropas`, `RP.extrasTropas`, `RP.NOMES_MARCHA` (cliente) | Ordens extras no envio pelo mapa (`{ ordem, rotulo, verbo, icone, descricao, dados, quando(hex, dados, envio) }`), cartões e blocos da tela Tropas, nome dos tipos de marcha. |
| `RP.TIPOS_ATAQUE`, `RP.graficoBatalha`, `RP.mapa.tiposObjeto.torre/batalha` (cliente) | Tipos de ataque; gráfico de força dos lados (`serie` com `t, meu, eles, proj`); objetos do mapa. O mapa que desenha `tiposObjeto` sozinho marca `RP.mapa.desenhaTiposObjeto = true` e o combate deixa de desenhar e de pôr linhas na folha. |
| `RP.mapa.tiposObjeto`, `RP.mapa.camadas` (cliente) | Tipos de objeto do mapa (`{ nome, icone, desenharTatico(ctx, o, p, cam), folha(o) }`) e camadas que ligam e desligam (`perigo`). |
| `RP.ferraria` (`dados`, `carregar`), `RP.reino.ferraria`, `local.lendarios`, `RP.SISTEMAS` (cliente) | Dados de `GET /ferraria`; resumo da ferraria e equipamento lendário em cada local no GET /reino; nome e texto dos sistemas revelados aos poucos (`RP.sistema(k)`). |
| `RP.exploracao`, `RP.blocoRisco`, `RP.opcaoCaminhoExp`, `RP.perigoConhecido` (cliente) | Dados de `GET /exploracao`, risco da fauna e opção de caminho com risco (caravana, extração, escolta), perigo conhecido de um hexágono. |
| `RP.extrasGuarnicao`, `RP.extrasExercito`, `RP.extrasFolhaExercito`, `RP.grupoPadraoEnvio` (cliente) | Linhas nos cartões de guarnição e de exército da tela Tropas e na folha do exército (selo de veterania); tropas padrão do envio pelo mapa (o combate devolve as do último ataque). |
| `Temporada.Temporadas` (`Fim`, `DiaIndice`, `MarcarAtivo`, `Encerrar`, `Reiniciar`, `Reagendar`, eventos `AoTerminar`/`AoReiniciar`), `Mundo.DuracaoTemporadaMs` | Fim da temporada e reset do mundo (ver [decisão 0020](decisoes/0020-temporada.md)); temporada curta em desenvolvimento com `REINO_TEMPORADA_MIN`. |
| `m.Legados` (`LegadoConta`), `Temporada.Linhagem` (`Nivel`, `BonusReino`, desbloqueios), `Mundo.Banco` | Legado por conta (tabela `legado`), bônus das relíquias da temporada, desbloqueios da linhagem. |
| `IColecao.Limpar` | Esvaziar uma coleção na memória sem marcar remoções (reset). |
| `Economia.ModificadoresCrescimento` | Multiplicadores da taxa de crescimento da população (relíquia da temporada de crescimento). |
| `CriacaoReino.BrasaoLiberado`, `CriacaoReino.CriarNaRegiao/VagaPerto`, `Brasao.Valido(extras, moldura)` | Brasões liberados pela linhagem; região inicial. |
| `Temporada.Ranking`, `Reino.RankBaixas/RankPerdas/VenceuCerco` | Ranking da temporada e conquistas rastreadas na temporada. |
| `Temporada.PrecisaDeVoce.Listar/Extras` | "Precisa de você" (GET /agora): itens `{ grupo, icone, titulo, texto, href, botao, fim }`. |
| `Exploracao.Avistamentos.AoRegistrar` | Reagir a um avistamento (gatilho da espionagem). |
| `RP.agoraItemHTML`, telas `#/temporada`, `#/ranking`, `#/agora`, `#/regencia`, aviso SSE `temporada`, `RP.extrasConstrucao[].sistema` (cliente) | Item do "precisa de você"; telas da temporada; aba de construção que só aparece depois do gatilho do sistema; `RP.reino.legado` (`linhagem`, `titulo`, `regiaoExilio`) e `RP.reino.regencia` (do sistema de IA). |
| `RP.seloVeterania`, `RP.mapa.tiposObjeto.avistamento`, telas `#/exilio` e `#/interceptar?marcha=` (cliente) | Selo de veterania; avistamentos no mapa (se a exploração registrar o mesmo tipo antes, ela desenha); exílio e interceptação. |
| `m.IA` (`Ativa`, `CriarReinos`), `MundoIA.Novo` (testes) | Liga a IA no processo (não é gravado): sessões e regência; meta de ocupação (`REINO_IA=0` desliga só esta). `MundoTeste` sobe com a IA desligada. |
| `Ocupacao.Completar/CriarUm/Abdicar/LiberarVaga/VagaLonge` | Meta de ocupação (leva inicial, mínimo de ativos), reino de IA novo, abdicação (castelo em ruína, locais como terra livre) e vaga para jogador. |
| `CriacaoReino.IdNovo` | Id do reino e dos locais iniciais (a IA sorteia de uma reserva para a ordem dos ids não revelar quem é IA). |
| `CriacaoReino.VagaUtilizavel/LocalSubstituivel` | Vaga que pode receber reino novo (sem local de outro reino nem relíquia/lendário nos 5 hexágonos); local sem dono que pode dar lugar. |
| `Sessoes.Agendar/De`, `SessaoIAEvento`, `Conduta` | Próxima sessão de um reino de IA ou em regência e a conduta (habilidade × perfil, ou regência). |
| `Governo.Sessao` e partes (`Construir`, `Recrutar`, `Defender`, `Explorar`, `Cacar`, `Extrair`, `Torres`, `Ocupar`, `Espionar`, `Atacar`) | Decisões da IA, sempre pelos serviços da API e com a informação de um jogador. Um sistema novo que a IA deva usar ganha uma parte aqui. |
| `Regencia.Agendar/Comecar/AoEntrar/Acao/Perda`, `Reino.Regencia`, `Reino.EmRegencia` | Regência (último acesso + `P.regenciaH`), relatório do que a regência fez e perdeu; GET /reino leva `regencia: { ativaDesde, terminouEm, acoes, perdas }`. Sistemas que agem pelo reino em regência anotam com `Acao`/`Perda`. |
| `Comerciante.Responder/Vale` | Respostas da IA a trocas e pactos (margens de `P.comercio.margemIA` e `P.ia.comercio`). |

## Regras de visibilidade (o servidor é quem esconde)

- O cliente só recebe o que o reino pode saber: terreno das áreas exploradas, objetos ao vivo só no que vê agora, último estado conhecido no resto.
- Locais de outros reinos: tipo e nome genérico, **nunca o dono**, salvo espionagem, aliança ou estandarte.
- Forças sem estandarte: sem identidade. Reinos de IA: **nada** os distingue de jogadores (nem campo, nem id especial, nem tempo de resposta).

## API

- JSON em `/api/v1`, nomes em camelCase, enums em camelCase. Erros: status 4xx e `{ "erro": "mensagem para o jogador" }` (lance `RegraException`).
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

### Convenções

- Sem framework e sem build: scripts com o namespace global `RP`, carregados em ordem por `web/index.html`.
- Base: `icones.js`, `brasao.js`, `hex.js`, `api.js` (`RP.get/post/put/del`, `RP.ouvir` para SSE), `nucleo.js` (concha: painel, folha, confirmação, avisos, navegação; timers, barra de recursos, produção, carga, rotas, estado `RP.reino`).
- Concha (`web/css/concha.css`): a tela `mapa` é a tela de fundo (`fundo: true`), montada em `#mundo` e nunca escondida enquanto há reino. As outras telas do jogo são montadas em `#telas`, o painel (baixo no celular, coluna à direita no computador; `RP.painel`). A folha de seleção (`RP.abrirFolha`) fica por cima do painel, sem véu, com até 3 ações. Telas públicas (`publica: true`) ocupam a tela toda.
- Cada tela num arquivo de `web/js/telas/`, registrada com `RP.registrarTela(nome, { montar, entrar, sair, nav, secao, fundo, publica })`. Rotas em hash: `#/nome?param=1`. `nav: true` marca um destino de `RP.NAV`; `secao` liga uma sub-tela ao seu destino.
- Peças comuns: `RP.custoHTML` (custo com "faltam X · pronto em Y"), `RP.cargaHTML` (carga com barra), `RP.popSomaHTML` (população + tropas = moradores), `RP.producaoHTML` / `RP.contaRecursoHTML` (produção e "quando terei X"), `RP.faunaVereditoHTML` (força do bando × força do grupo), `RP.textoFilaItem` (aviso ao enfileirar).
- Siga `prototipo/design-system.md` e reaproveite CSS, ícones e arte do protótipo. Estilos novos em `web/css/jogo.css` (ou arquivo próprio do sistema), sempre com os tokens.
- Tempo no cliente: `RP.agora()` (relógio do servidor). Estoques andam sozinhos entre atualizações (`RP.qtdRecurso`).
- Mundo: `web/js/vista/` (modelo do `/mapa`, arte, Vista 2.5D, Mapa tático). Objetos novos no mapa ganham desenho registrando `RP.mapa.tiposObjeto[tipo]` (e `RP.mapa.tiposMarcha`, `RP.mapa.perigoHex`, `extrasFolhaHex`...) no arquivo do próprio sistema; ver [decisão 0017](decisoes/0017-vista-e-mapa-no-cliente.md). A inclinação da câmera é do jogador (`RP.arte.definirK`, `Cena.inclinar`).

## Testes

- `cd servidor && dotnet test`. `MundoTeste` cria um mundo com relógio falso: `t.NovoReino()`, `t.AvancarMin(5)`, `t.DarRecursos(r)`.
- Cada regra nova ganha teste. Fórmulas são conferidas contra o modelo.
- `MundoTeste` e `ServidorTeste` sobem **sem fauna** (sorteios); passe `fauna: true` para ter a fauna do mundo. Para um sorteio de `m.Sorte` com resultado conhecido, troque `m.Sorte` por um `Rng` com semente escolhida (ver `ExploracaoTestes.Sorte`).
- Teste de carga (`CargaIATestes`, `Categoria=carga`): 30 reinos (jogadores e IA) por dias de jogo simulados, medindo tempo de CPU por evento e memória; números em [`desempenho.md`](desempenho.md).

## Segurança e repositório público

- Nada de segredo, endereço de servidor, nome de máquina ou caminho local em código, configuração, documentação ou commit. Configuração por variáveis de ambiente (`.env.exemplo` com valores fictícios).
- Revise o diff antes de cada commit procurando segredos e caminhos locais.
