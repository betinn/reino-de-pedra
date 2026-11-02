# 0005 — Contas com e-mail e senha, PBKDF2, sessão por cookie HttpOnly

**Decisão.**
- Senha com PBKDF2-HMAC-SHA512, 210.000 iterações, sal de 16 bytes (biblioteca padrão do .NET), em formato versionado que permite subir o custo (refeito no próximo login). No máximo 2 hashes ao mesmo tempo, para um pico de logins não travar o jogo numa CPU pequena.
- Senha de 10 a 128 caracteres. E-mail sem confirmação por enquanto (não há envio de e-mail).
- Sessão: token aleatório de 256 bits; o banco guarda só o SHA-256 dele. Cookie `HttpOnly`, `Secure`, `SameSite=Strict`, 30 dias deslizantes. Escritas com cookie exigem o cabeçalho `X-Reino: 1` (o navegador não manda esse cabeçalho de outro site sem permissão). O app futuro usa `Authorization: Bearer`.
- Limite de tentativas: 5 falhas por e-mail em 15 min bloqueiam 15 min; 20 tentativas de login/cadastro por IP a cada 15 min; limite geral de requisições por IP. Login com e-mail inexistente gasta o mesmo tempo (não revela contas).

**Por quê.** PBKDF2 está na biblioteca padrão (sem dependência) e é aceito pela OWASP com esses parâmetros; Argon2 exigiria pacote de terceiros. Cookie HttpOnly impede que um script injetado leia a sessão.
