#!/usr/bin/env bash
# Operação do administrador: fila de pedidos de convite e links de uso único. O jogo não manda e-mail: você recebe o link e o envia.
# Precisa de REINO_ADMIN_TOKEN (a mesma do servidor) e REINO_SITE (endereço do jogo), no ambiente ou no .env (ignorado pelo git).
# Uso:
#   scripts/convites.sh fila [estado]      lista os pedidos (estado: fila, enviado, usado, revogado)
#   scripts/convites.sh link <id>          gera o link do pedido (o anterior deixa de valer); ele só aparece esta vez
#   scripts/convites.sh revogar <id>       o link deixa de valer e o pedido sai da fila
#   scripts/convites.sh apagar <id>        apaga o pedido e o e-mail dele
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then set -a; . ./.env; set +a; fi
: "${REINO_ADMIN_TOKEN:?defina REINO_ADMIN_TOKEN}"
SITE="${REINO_SITE:-http://localhost:5080}"
# a credencial vai por um arquivo de configuração na entrada padrão: não aparece na lista de processos
chamar() { printf 'header = "Authorization: Bearer %s"\n' "$REINO_ADMIN_TOKEN" | curl -sS --config - "$@"; echo; }
case "${1:-}" in
  fila)    chamar "$SITE/api/v1/admin/convites?estado=${2:-}" ;;
  link)    chamar -X POST "$SITE/api/v1/admin/convites/${2:?id}/link" ;;
  revogar) chamar -X POST "$SITE/api/v1/admin/convites/${2:?id}/revogar" ;;
  apagar)  chamar -X DELETE "$SITE/api/v1/admin/convites/${2:?id}" ;;
  *) sed -n '2,8p' "$0"; exit 1 ;;
esac
