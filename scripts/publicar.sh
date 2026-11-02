#!/usr/bin/env bash
# Gera um pacote pronto para o servidor (Linux x64, self-contained, arquivo único) em ./publicar/reino-de-pedra.
# Nada de endereço, usuário ou chave aqui: copie o pacote para o servidor do jeito que preferir
# e siga docs/publicar.md.
set -euo pipefail
cd "$(dirname "$0")/.."
RID="${RID:-linux-x64}"
SAIDA=publicar/reino-de-pedra
rm -rf "$SAIDA"
TMP_CONFIG="$(mktemp)"
trap 'rm -f "$TMP_CONFIG"' EXIT
node balanceamento/modelo.js --json > "$TMP_CONFIG"
if ! cmp -s "$TMP_CONFIG" balanceamento/config.json; then
  echo "balanceamento/config.json desatualizado: rode node balanceamento/modelo.js --json > balanceamento/config.json" >&2
  exit 1
fi
(cd servidor && dotnet test -c Release)
# bibliotecas nativas (SQLite) ficam ao lado do executável, sem extração: o serviço sobe com um usuário de sistema
# sem home (com extração, o .NET precisaria de $HOME/.net ou de DOTNET_BUNDLE_EXTRACT_BASE_DIR)
dotnet publish servidor/src/Api -c Release -r "$RID" --self-contained true \
  -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=false -p:DebugType=none -o "$SAIDA"
mkdir -p "$SAIDA/balanceamento"
cp balanceamento/config.json "$SAIDA/balanceamento/"
cp -r web "$SAIDA/web"
cp docs/publicar.md "$SAIDA/LEIAME.md"
cp .env.exemplo "$SAIDA/.env.exemplo"
tar -czf publicar/reino-de-pedra.tar.gz -C publicar reino-de-pedra
echo "Pacote: publicar/reino-de-pedra.tar.gz"
