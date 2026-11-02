# 0005 — Contas com e-mail e senha, PBKDF2, sessão por cookie HttpOnly

**Decisão.**
- Senha com PBKDF2-HMAC-SHA512, 210.000 iterações, sal de 16 bytes (biblioteca padrão do .NET), em formato versionado que permite subir o custo (refeito no próximo login). O custo fica no recomendado: quem protege a CPU é a fila, não menos iterações.
- Senha de 10 a 128 caracteres. E-mail sem confirmação por enquanto (não há envio de e-mail).
- Sessão: token aleatório de 256 bits; o banco guarda só o SHA-256 dele. Cookie `HttpOnly`, `Secure`, `SameSite=Strict`, 30 dias deslizantes. Escritas com cookie exigem o cabeçalho `X-Reino: 1` (o navegador não manda esse cabeçalho de outro site sem permissão). O app futuro usa `Authorization: Bearer`.
- Fila de hash (`FilaHash`, uma por servidor): **1 hash por vez e até 4 esperando**; com a fila cheia, o pedido volta na hora com 429 (`Retry-After`), sem enfileirar. Um hash custa ~0,2 s de um núcleo; com um por vez, um ataque de logins ocupa no máximo uma thread e o motor do jogo continua dividindo a CPU com ela, sem fila crescendo na memória. Um pico legítimo é raro (a sessão dura 30 dias) e quem cai no 429 tenta de novo em segundos.
- Limite de tentativas: 5 falhas por e-mail em 15 min bloqueiam 15 min (conferido antes do hash: e-mail bloqueado não gasta CPU); 20 tentativas de login/cadastro/troca de senha por IP a cada 15 min, com IPv6 agrupado por /64 (quem tem um /64 não ganha um limite por endereço); limites gerais de requisições (decisão 0006). Login com e-mail inexistente gasta o mesmo tempo (não revela contas).

**Por quê.** PBKDF2 está na biblioteca padrão (sem dependência) e é aceito pela OWASP com esses parâmetros; Argon2 exigiria pacote de terceiros. Cookie HttpOnly impede que um script injetado leia a sessão.
