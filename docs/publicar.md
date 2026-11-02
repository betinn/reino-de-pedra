# Publicar o Reino de Pedra

Passo a passo genérico para uma VM Linux pequena (1/8 de OCPU, 1 GB de RAM). Nenhum dado de máquina aqui.

## 1. Gerar o pacote (na sua máquina)

```bash
scripts/publicar.sh
```

Gera `publicar/reino-de-pedra.tar.gz`: executável único `ReinoDePedra` (não precisa instalar .NET), `web/`, `balanceamento/config.json`.

## 2. Copiar e instalar (na VM)

1. Crie um usuário de sistema sem login para o jogo e uma pasta para o programa e outra para os dados (fora do pacote, para sobreviver a atualizações).
2. Copie o `.tar.gz` para a VM (scp, rsync...) e extraia na pasta do programa.
3. Configure as variáveis de ambiente (veja `.env.exemplo`): `REINO_DADOS` (pasta de dados), `REINO_URLS` (ex.: `http://127.0.0.1:5080` atrás de um proxy), `REINO_PROXY=1` se houver proxy reverso com HTTPS.
4. Variáveis recomendadas para pouca memória: `DOTNET_GCHeapHardLimit=0x10000000` (256 MB de teto do heap), `DOTNET_TieredPGO=0`, `DOTNET_gcConcurrent=0`.

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
# o processo grava ao parar (SIGTERM): dê tempo
TimeoutStopSec=20
MemoryMax=600M

[Install]
WantedBy=multi-user.target
```

## 4. HTTPS

Use um proxy reverso (Caddy ou nginx) com certificado e encaminhe para `REINO_URLS`. Para o SSE, desligue o buffer de resposta no proxy (o servidor já manda `X-Accel-Buffering: no`). Com HTTPS no proxy, deixe `REINO_COOKIE_INSEGURO` vazio e `REINO_PROXY=1`.

## 5. Backup

O estado inteiro está em `REINO_DADOS/reino.db` (+ `-wal`). Para copiar com o jogo rodando: `sqlite3 reino.db ".backup copia.db"`.

## 6. Atualizar

Pare o serviço (ele grava tudo ao parar), troque os arquivos do programa, inicie de novo. Os dados ficam.
