# 0006 — API JSON e avisos por SSE, a mesma para web e app

**Decisão.** REST/JSON em `/api/v1`, compressão Brotli/Gzip. Tempo real por Server-Sent Events (`/api/v1/eventos`): o servidor manda avisos curtos ("reino mudou", "marchas mudaram", "relatório novo") e o cliente busca só o recurso afetado.

**Por quê.**
- SSE é HTTP comum (passa por proxies, reconecta sozinho, não precisa de biblioteca) e basta, porque as ordens do jogador vão por requisições normais.
- Avisos pequenos em vez de estado completo mantêm o tráfego baixo e o servidor simples; o cliente interpola timers e estoques localmente.
- A mesma API, com token Bearer, serve o app de celular depois.

**Limites de operação** (`Api/Limites.cs`; o servidor precisa caber numa CPU pequena sem barrar quem joga):
- Só a API conta no limitador: arquivos estáticos ficam de fora (um carregamento do cliente são ~50 arquivos, e vários aparelhos atrás do mesmo IP recarregam juntos).
- Baldes encadeados: por IP (IPv6 por /64) 240 de rajada e 60/s, com folga para vários jogadores atrás do mesmo endereço (rede móvel, Wi-Fi de casa); por sessão 80 e 20/s; rotas que montam a visão inteira (`GET /mapa`, `/reino`, `/agora`, ~2 ms de CPU cada) 12 e 4/s por sessão e 40 e 10/s por IP. O cliente recarrega essas rotas no máximo a cada 300–400 ms, então não sente; um script abusivo fica em ~1% de um núcleo por sessão. Token falso não ganha balde novo de graça: o balde do IP vale antes e o pedido volta 401.
- Conexões abertas por IP: 100 servindo direto (`REINO_CONEXOES_IP`), para um cliente não ocupar as 2000 vagas do Kestrel com conexões paradas. Atrás de proxy (`REINO_PROXY=1`) todas vêm do proxy: o limite fica desligado e deve ser configurado no proxy.
- SSE: até 3 conexões por reino; a mais antiga recebe `substituida` e fecha (o cliente não reconecta sozinho; volta quando a aba aparece de novo).
- Parada: no `ApplicationStopping` as conexões SSE fecham na hora e o motor grava tudo; `ShutdownTimeout` de 10 s fica abaixo do `TimeoutStopSec` do guia de publicação. Pedido que chega com o motor parado recebe 503, não 500.
