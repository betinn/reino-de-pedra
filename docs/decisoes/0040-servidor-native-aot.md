# 0040: Servidor em Native AOT, JSON gerado na compilação e GC para pouca memória

Muda a [0001](0001-stack.md), que deixava trimming e AOT para depois por causa da reflexão. Números em [desempenho.md](../desempenho.md#native-aot).

## Contexto

O orçamento de memória do servidor ficou mais apertado: perto de 200 MB para o processo inteiro. Com JIT, o processo publicado (self-contained, arquivo único) ficava em 100 MB de memória privada e 166 MB de working set em média com o mundo cheio, e chegava a 195 MB. Uma reescrita em outra linguagem foi considerada; esta decisão mede antes o que o próprio .NET entrega compilado para código nativo.

O jogo não muda: só a forma de compilar e empacotar.

## Decisão

**Native AOT.** `servidor/src/Api` publica com `PublishAot` e trimming completo: um executável nativo, sem JIT, com a biblioteca nativa do SQLite ao lado. O `dotnet publish` sai sem avisos, e os avisos de trim e de AOT viram erro no projeto (`WarningsAsErrors`). O build comum e os testes continuam com JIT, mas com os mesmos analisadores e com o gerador de rotas do AOT (o ASP.NET o liga junto com `PublishAot`), então o código que os testes exercitam é o mesmo que vai no binário. `scripts/publicar.sh` gera o pacote Linux em AOT; o AOT compila para o sistema em que roda, então o pacote Linux sai de uma máquina Linux (detalhes em [publicar.md](../publicar.md)).

**JSON gerado na compilação.** Nada mais passa pela reflexão do System.Text.Json:

- `JsonJogo` (no jogo) cobre os 62 tipos de documento do save, o legado, o balanceamento, a persona e os nós de `JsonNode`. `JsonApi` (na API) cobre as respostas, os pedidos e os avisos do SSE.
- As respostas eram tipos anônimos, que o gerador não aceita. Viraram 232 records `...Json`, um por formato, com os mesmos membros, na mesma ordem e com os mesmos tipos. A troca foi mecânica, feita por uma ferramenta Roslyn fora do repositório. `Results.Json` virou `Json.Resposta`, que serializa pelo tipo de verdade com os metadados gerados.
- As opções não mudaram: o save usa os nomes das classes, omite nulos e grava enums como texto. A API usa camelCase, acentos sem escape, nulos omitidos e enums em camelCase. Só os metadados mudaram de origem. O `JsonStringEnumConverter` sem tipo precisa de código gerado em tempo de execução, então cada enum ganhou o seu (`ConversoresEnum`).
- `JsonArray.Add<T>` (genérico, com reflexão) virou `Add((JsonNode?)x)`, que dá o mesmo JSON.

**Registros explícitos.** O AOT não enumera tipos. O que era achado por reflexão virou lista: os documentos (`JsonJogo.Documentos`), as ordens de exército e os itens de fila (`RegistroTipos.Fabricas`), os sistemas `[Sistema]` (`Sistemas.Todos` e `RegistroApi.Sistemas`, na ordem de antes) e os módulos de rotas (`RegistroApi.Modulos`). As coleções do `Mundo` continuam achadas pelas propriedades, porque a classe é selada e o trimming as preserva.

**Como se prova que nada mudou.**

- `FormatoSaveTestes` lê `servidor/testes/Testes/Amostras/save-antigo.jsonl.gz`: 794 documentos de 55 tipos, gravados pela versão de antes. São uma amostra do mundo de 30 reinos depois de 10 dias (o teste de carga) e os documentos que a suíte inteira grava. Cada documento é lido e gravado de novo com os metadados gerados e tem de sair idêntico ao que a versão antiga gravava. Os tipos fora da amostra são comparados contra a reflexão.
- As respostas da API foram capturadas com a versão antiga e com a nova, num mesmo cenário (36 rotas GET). Os nomes, a ordem, os tipos e os nulos saíram iguais; só variaram nomes sorteados de pessoas, que variam também entre duas rodadas da versão antiga.
- Os testes rodam com `JsonSerializerIsReflectionEnabledByDefault=false` (`Directory.Build.props`), como o AOT. Um tipo que falte nos contextos derruba um teste, não a produção. Só o cliente HTTP dos testes pede reflexão de propósito, para montar os pedidos. `RegistrosTestes` confere cada lista explícita contra a reflexão.

**GC para pouca memória**, embutido no binário com `RuntimeHostConfigurationOption`, porque o AOT não lê `runtimeconfig.json`:

- O GC de estação sem modo concorrente continua como antes.
- **`ConserveMemory` 7.** No ritmo real, a memória privada média caiu de 73 para 56 MB e o pico de working set de 165 para 120 MB. O custo é CPU: o GC compacta mais vezes, o que pesa com o jogo acelerado (a 60×, de 50% para 76% de um núcleo) e ficou dentro do ruído no ritmo real. O orçamento apertado é o de memória; `DOTNET_GCConserveMemory=0` desliga se a CPU pesar.
- **`HeapHardLimit` 256 MB.** É um teto, não economia: com 128 MB o mundo cheio rodou sem erro e com a mesma memória. O pico de heap gerenciado medido é 64 MB com o mundo cheio, e o pior caso registrado é 116 MB. O teto fica com mais de 2× de folga e impede que um vazamento leve a máquina inteira.
- **`TieredPGO` não se aplica.** Sem JIT, não há o que otimizar em tempo de execução; a linha saiu do projeto. O Gen0 de 4 MB (`GCgen0size`) só baixou o pico (de 121 para 107 MB) e não tem nome público para ir embutido: fica como variável opcional.
- As variáveis `DOTNET_GCHeapHardLimit` e `DOTNET_GCConserveMemory` ajustam sem recompilar, em hexadecimal sem `0x` (o binário nativo ignora o valor com `0x`). O log da subida mostra o que está em vigor ([publicar.md](../publicar.md)).

**Globalização.** O `InvariantGlobalization` já estava ligado em todo o servidor (`Directory.Build.props`) e continua, então o AOT não muda nada visível. Os textos em português e os acentos são dados: UTF-8 de ponta a ponta, e o JSON sai sem escapar acentos. Datas e números para o jogador são formatados no cliente. Os números que o servidor põe em textos (relatórios, avisos) já saíam no formato invariante, e as ordenações por texto já eram ordinais. Com o AOT, o modo invariante ainda deixa os dados do ICU fora do pacote.

**Runtime do pacote em 10.0.14.** O SDK 10.0.401 traz o runtime e o compilador AOT 10.0.12, que têm a CVE-2026-111497 (decodificador Brotli). O projeto fixa os pacotes de runtime e o ILCompiler em 10.0.14 só para o publish (`RuntimeDoPacote` no `Api.csproj`). Os testes usam o runtime instalado.

## Resultado

Medido no Windows (sem WSL nem Docker nesta máquina), com o mesmo save de 30 reinos (25 de IA), no ritmo real do jogo (3 minutos):

| | JIT (antes) | AOT como publicado |
|---|---|---|
| Partida até a primeira resposta | 1,5 s | 0,55 s |
| Memória privada, média | 92 MB | 56 MB |
| Working set, média | 157 MB | 76 MB |
| Working set, pico | 187 MB | 120 MB |
| Tamanho do executável | 105 MB | 34 MB |

O AOT gasta mais CPU que o JIT, porque perde a otimização guiada por perfil. Com o mundo cheio, os dois usaram de 0,4 a 1 núcleo em qualquer ritmo de jogo nesta medida. A [0041](0041-cpu-do-motor.md) achou o motivo: o save era de meses antes e o servidor estava recuperando o atraso, não em regime. Em regime, o mundo cheio custa perto de 0,2% de um núcleo. Os números completos (720×, 60× e as variantes do GC) estão em [desempenho.md](../desempenho.md#native-aot).

Com esses números, o servidor cabe com folga num orçamento de 200 MB, sem trocar de linguagem.

## Consequências

- **Tipo novo no JSON:** um documento entra em `JsonJogo` (atributo e `Documentos`) e uma resposta vira um `record ...Json` com `[JsonSerializable]` em `JsonApi`. Valor guardado em `object` precisa do tipo de verdade registrado (`List<...Json>`, `Dictionary<string, ...Json>`), e enumerável preguiçoso vira lista. Os testes acusam o esquecimento.
- **Sem tipo anônimo** na resposta, e sem `Results.Json` com opções.
- **Reflexão** só onde o trimming entende: nada de `Assembly.GetTypes()` nem `Activator.CreateInstance(Type)` no servidor. Os testes podem usar reflexão para conferir as listas.
- **O publish é por sistema operacional.** O pacote Linux sai de uma máquina Linux com `clang`; no Windows, o publish precisa do linker e das bibliotecas do Visual Studio.
- **Se a memória não bastar** com o mundo maior, o próximo passo é medir `OptimizationPreference=Size` antes de pensar em outra linguagem.
