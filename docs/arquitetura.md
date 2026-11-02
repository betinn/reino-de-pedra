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
| `Caminhos.CustosExtras` | Peso extra por hexágono na rota segura (fauna). |
| `Nevoas.FontesDeVisao` | Visão extra (torres, exploradores parados...). |
| `Obras.HexOcupado` | Hexágonos ocupados por objetos do sistema (torres, postos...). |
| `CheckpointReinoEvento.AoCheckpoint` | Rodar de hora em hora por reino (IA, regência). |
| `CriacaoReino.AoCriar`, `ObraFundar.AoFundar`, `Filas.AoConcluir`, `Mundo.AoCriarMundo` | Reagir a acontecimentos. |
| `ITipoItemFila.Cancelado` | Desfazer o que o item reservou além do material (população do recrutamento...). |
| `IOrdemExercito` | Nova ordem de exército (`Ordem`, `Validar`, `Chegou`; `NoEnvio = false` se não vale ao enviar de um local). Classe com construtor vazio; achada por reflexão. O combate acrescenta "atacar". |
| `Exercitos.BloqueiosOrdem`, `Exercitos.AoEntrarNoLocal` | Impedir nova ordem (ex.: em batalha); reagir a tropas que entram num local (relíquias carregadas). |
| `Marcha.Interceptavel`, `Marcha.Reliquias`, `Marcha.AoSerVencida(m, vencedor)` | Contrato de interceptação: o combate decide quem vence; quem perde entrega a carga (até a capacidade livre do vencedor) e as relíquias, e sai do mapa. Exploradores e mensageiros devolvem `Interceptavel = false`; caravanas e carregadores sobrescrevem `AoSerVencida` se precisarem reagir. |
| `Recrutamento.ReqCumprido`, `Recrutamento.Requisitos` | Quem cumpre um `U.req` (eras); bloqueios extras de unidade. |
| `Reinos.Tropas` | Ajudantes de grupo de tropas: validar, retirar, devolver, somar, velocidade, carga, força contra fauna, população. Dentro de uma `Marcha`, a propriedade `Tropas` esconde a classe: use um alias (`using GT = ReinoDePedra.Jogo.Reinos.Tropas;`). |
| `VisaoReino.Extras`, `VisaoReino.ExtrasLocal`, `VisaoMarcha.ExtrasPropria`, `VisaoMapa.Extras` (Api) | Acrescentar dados ao que o cliente recebe. |
| `RP.ordensEnvio`, `RP.acoesTropas`, `RP.extrasTropas`, `RP.NOMES_MARCHA` (cliente) | Ordens extras no envio pelo mapa (`{ ordem, rotulo, verbo, icone, descricao, dados, quando(hex, dados, envio) }`), cartões e blocos da tela Tropas, nome dos tipos de marcha. |

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

- Sem framework e sem build: scripts com o namespace global `RP`, carregados em ordem por `web/index.html`.
- Base: `icones.js`, `brasao.js`, `hex.js`, `api.js` (`RP.get/post/put/del`, `RP.ouvir` para SSE), `nucleo.js` (folha, modal, aviso, timers, barra de recursos, rotas, estado `RP.reino`).
- Cada tela num arquivo de `web/js/telas/`, registrada com `RP.registrarTela(nome, { montar, entrar, sair, nav, secao, fixa })`. Rotas em hash: `#/nome?param=1`.
- Siga `prototipo/design-system.md` e reaproveite CSS, ícones e arte do protótipo. Estilos novos em `web/css/jogo.css` (ou arquivo próprio do sistema), sempre com os tokens.
- Tempo no cliente: `RP.agora()` (relógio do servidor). Estoques andam sozinhos entre atualizações (`RP.qtdRecurso`).

## Testes

- `cd servidor && dotnet test`. `MundoTeste` cria um mundo com relógio falso: `t.NovoReino()`, `t.AvancarMin(5)`, `t.DarRecursos(r)`.
- Cada regra nova ganha teste. Fórmulas são conferidas contra o modelo.
- Teste de carga: 30 reinos (jogadores e IA) por dias de jogo simulados, medindo tempo de CPU por evento e memória.

## Segurança e repositório público

- Nada de segredo, endereço de servidor, nome de máquina ou caminho local em código, configuração, documentação ou commit. Configuração por variáveis de ambiente (`.env.exemplo` com valores fictícios).
- Revise o diff antes de cada commit procurando segredos e caminhos locais.
