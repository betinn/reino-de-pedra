#!/usr/bin/env bash
# Roda o servidor localmente em http://localhost:5080 (dados em ./dados, ignorado pelo git).
# Uso: scripts/rodar-local.sh            (tempo normal)
#      REINO_ACELERACAO=60 scripts/rodar-local.sh   (1 min real = 1 h de jogo, só para testar)
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then set -a; . ./.env; set +a; fi
export REINO_DADOS="${REINO_DADOS:-./dados}"
export REINO_URLS="${REINO_URLS:-http://localhost:5080}"
export REINO_COOKIE_INSEGURO="${REINO_COOKIE_INSEGURO:-1}"
exec dotnet run --project servidor/src/Api -c Release
