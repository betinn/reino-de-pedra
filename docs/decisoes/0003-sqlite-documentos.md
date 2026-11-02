# 0003 — SQLite em WAL com documentos JSON gravados em lote

**Decisão.** Um arquivo SQLite (`REINO_DADOS/reino.db`) em modo WAL. As entidades do mundo são gravadas como documentos JSON numa tabela `docs (colecao, id, tipo, dados)`. O motor grava só os documentos marcados como sujos, a cada 3 s, numa única transação. Contas, sessões e ícones têm tabelas próprias.

**Por quê.**
- Poucas escritas, agrupadas: uma transação a cada poucos segundos em vez de uma por ação.
- Documentos JSON deixam cada sistema acrescentar campos sem migração de esquema (`partial class`); a carga inicial lê tudo de uma vez.
- Uma varredura a cada 5 min compara o JSON de todos os documentos com o último gravado e salva o que mudou sem `Sujar` (rede de segurança), registrando aviso.
- Na pior queda do processo, perde-se no máximo ~3 s de jogo; o WAL mantém o arquivo íntegro.
