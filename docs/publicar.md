# Publicar o Reino de Pedra

Passo a passo genérico para um servidor Linux pequeno. Nenhum dado de máquina, hospedagem ou operação real aqui: só o que vale para qualquer instalação.

## 1. Gerar o pacote (na sua máquina)

```bash
scripts/publicar.sh
```

Gera `publicar/reino-de-pedra.tar.gz`: executável `ReinoDePedra` (não precisa instalar .NET) com a biblioteca nativa do SQLite ao lado (nada é extraído na primeira execução, então o serviço não precisa de pasta pessoal), `web/`, `balanceamento/config.json` e `.env.exemplo`.

## 2. Copiar e instalar (no servidor)

1. Crie um usuário de sistema sem login (pode ser sem pasta pessoal) para o jogo e uma pasta para o programa e outra para os dados (fora do pacote, para sobreviver a atualizações). O usuário precisa ler a pasta do programa e escrever na de dados.
2. Copie o `.tar.gz` para o servidor e extraia na pasta do programa.
3. Configure as variáveis de ambiente (veja `.env.exemplo`, que vai no pacote): `REINO_DADOS` (pasta de dados), `REINO_URLS` (ex.: `http://127.0.0.1:5080` atrás de um proxy), `REINO_PROXY=1` se houver proxy reverso com HTTPS. Servindo direto, `REINO_CONEXOES_IP` limita as conexões abertas por IP (padrão 100); atrás de proxy esse limite fica desligado e deve ser posto no proxy.
4. Variáveis recomendadas para pouca memória (ajuste ao servidor): `DOTNET_GCHeapHardLimit=0x10000000` (256 MB de teto do heap), `DOTNET_TieredPGO=0`, `DOTNET_gcConcurrent=0`.

## 3. Serviço (systemd, exemplo)

```ini
[Unit]
Description=Reino de Pedra
After=network.target

[Service]
User=<usuario-do-jogo>
WorkingDirectory=<pasta-do-programa>
ExecStart=<pasta-do-programa>/ReinoDePedra
EnvironmentFile=<arquivo-de-ambiente>
Restart=always
RestartSec=3
# o processo grava ao parar (SIGTERM) e fecha as conexões SSE na hora; ele mesmo desiste em 10 s
TimeoutStopSec=20
# teto de memória do serviço (ajuste ao servidor; acima do teto do heap)
MemoryMax=<limite>

[Install]
WantedBy=multi-user.target
```

## 4. HTTPS

Use um proxy reverso (Caddy ou nginx) com certificado e encaminhe para `REINO_URLS`. Para o SSE, desligue o buffer de resposta no proxy (o servidor já manda `X-Accel-Buffering: no`). Com HTTPS no proxy, deixe `REINO_COOKIE_INSEGURO` vazio e `REINO_PROXY=1`. Limite no proxy as conexões abertas por IP (o servidor só vê o proxy).

## 5. Backup

O estado inteiro está em `REINO_DADOS/reino.db` (+ `-wal`). Para copiar com o jogo rodando: `sqlite3 reino.db ".backup copia.db"`.

## 6. Atualizar

Pare o serviço (ele grava tudo ao parar), troque os arquivos do programa, inicie de novo. Os dados ficam.
