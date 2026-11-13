# Publicar o Reino de Pedra

Passo a passo genérico para um servidor Linux pequeno. Nenhum dado de máquina, hospedagem ou operação real aqui: só o que vale para qualquer instalação.

## 1. Gerar o pacote (numa máquina Linux)

```bash
scripts/publicar.sh
```

Gera `publicar/reino-de-pedra.tar.gz`: executável nativo `ReinoDePedra` (Native AOT: não precisa instalar .NET) com a biblioteca nativa do SQLite ao lado (nada é extraído na primeira execução, então o serviço não precisa de pasta pessoal), `web/`, `balanceamento/config.json` e `.env.exemplo`.

O Native AOT compila para o sistema em que roda: o pacote Linux sai de uma máquina Linux x64 (ou WSL, ou contêiner) com o SDK do .NET 10, `clang` e `zlib` (no Debian e no Ubuntu: `apt install clang zlib1g-dev`). No Windows o mesmo `dotnet publish` gera um `.exe` e pede o linker e as bibliotecas do Visual Studio (carga de trabalho "Desenvolvimento para desktop com C++"). A decisão está em [0040](decisoes/0040-servidor-native-aot.md).

## 2. Copiar e instalar (no servidor)

1. Crie um usuário de sistema sem login (pode ser sem pasta pessoal) para o jogo e uma pasta para o programa e outra para os dados (fora do pacote, para sobreviver a atualizações). O usuário precisa ler a pasta do programa e escrever na de dados.
2. Copie o `.tar.gz` para o servidor e extraia na pasta do programa.
3. Configure as variáveis de ambiente (veja `.env.exemplo`, que vai no pacote): `REINO_DADOS` (pasta de dados), `REINO_URLS` (ex.: `http://127.0.0.1:5080` atrás de um proxy), `REINO_PROXY=1` se houver proxy reverso com HTTPS. Servindo direto, `REINO_CONEXOES_IP` limita as conexões abertas por IP (padrão 100); atrás de proxy esse limite fica desligado e deve ser posto no proxy. Para as falas dos reinos de IA por LLM, `REINO_FALAS_LLM=1` e a chave em `ANTHROPIC_API_KEY` (fora do repositório; o servidor precisa de saída HTTPS para a API da Anthropic). Sem isso, as falas saem dos modelos de texto.
4. Memória: o binário já vem com o GC para pouca memória (GC de estação, sem modo concorrente, `ConserveMemory` 7 e teto de 256 MB para o heap gerenciado); o log da subida mostra o que está em vigor. Para ajustar sem recompilar, use as variáveis do .NET. Os valores são em hexadecimal **sem** `0x`: o binário nativo ignora a variável escrita com `0x`.
   - `DOTNET_GCHeapHardLimit=10000000`: teto do heap gerenciado (aqui 256 MB). Não ponha abaixo de `8000000` (128 MB): o pico medido com o mundo cheio é 64 MB, e já se viu 116 MB.
   - `DOTNET_GCConserveMemory=7`: de 0 a 9, quanto o GC se esforça para devolver memória (0 desliga).
   - `DOTNET_gcConcurrent=0` e `DOTNET_gcServer=0` já são o padrão embutido. `DOTNET_TieredPGO` não faz efeito: o binário nativo não tem JIT.
5. CPU: em dia, o mundo cheio usa menos de 1% de um núcleo (medidas em `docs/desempenho.md`). Depois de um tempo fora do ar, o servidor executa os eventos atrasados (perto de 2 s de CPU por dia parado) e continua respondendo enquanto isso. Se a recuperação passa de 2 s, o log avisa: `motor atrasado: ... h de jogo para recuperar` e, no fim, `motor em dia: N eventos em S s`.

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

## 7. Publicação automática

O workflow `.github/workflows/deploy.yml` publica sozinho quando um PR de um branch `deploy/…` entra no `main`. PR de outro branch não publica.

O que o workflow faz:

- gera o pacote como no item 1, sem rodar os testes;
- grava no pacote o arquivo `VERSAO`, com o commit e o número do PR;
- envia o pacote por SSH, pela entrada padrão.

O servidor precisa de três coisas:

- um script que recebe o pacote, troca a pasta do programa e reinicia o serviço;
- a conferência de `GET /api/v1/saude` depois de reiniciar;
- a volta para a versão anterior quando a saúde falha.

A chave usada pelo workflow só pode chamar esse script. Endereço, chave e impressão digital do servidor ficam nos secrets `VM_HOST`, `VM_SSH_KEY` e `VM_KNOWN_HOSTS`, nunca no repositório.
