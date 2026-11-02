# 0006 — API JSON e avisos por SSE, a mesma para web e app

**Decisão.** REST/JSON em `/api/v1`, compressão Brotli/Gzip. Tempo real por Server-Sent Events (`/api/v1/eventos`): o servidor manda avisos curtos ("reino mudou", "marchas mudaram", "relatório novo") e o cliente busca só o recurso afetado.

**Por quê.**
- SSE é HTTP comum (passa por proxies, reconecta sozinho, não precisa de biblioteca) e basta, porque as ordens do jogador vão por requisições normais.
- Avisos pequenos em vez de estado completo mantêm o tráfego baixo e o servidor simples; o cliente interpola timers e estoques localmente.
- A mesma API, com token Bearer, serve o app de celular depois.
