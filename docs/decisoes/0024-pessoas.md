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
