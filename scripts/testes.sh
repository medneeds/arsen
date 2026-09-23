#!/usr/bin/env bash
# Executa TODA a suite de src/tests/.
#
# POR QUE ISTO EXISTE (auditoria de 18/09/2026)
# Os 43 arquivos .test.ts eram scripts autocontidos rodados um a um, a mao.
# Nao havia runner, nao havia script `test`, nao havia CI — entao, na pratica,
# ninguem rodava. O teste antimicrobial-intervals ficou quebrado desde a
# renomeacao de um valor de intervalo e ninguem notou.
#
# Uso:
#   bash scripts/testes.sh            # roda tudo
#   bash scripts/testes.sh prescricao # roda os que casam com o filtro
#
# Sai com codigo 1 se qualquer teste falhar, para poder ser usado em CI.

set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

FILTRO="${1:-}"
PASSOU=0
FALHOU=0
FALHAS=()

for arquivo in src/tests/*.test.ts; do
  nome="$(basename "$arquivo")"
  if [ -n "$FILTRO" ] && [[ "$nome" != *"$FILTRO"* ]]; then
    continue
  fi
  if npx tsx "$arquivo" > /tmp/arsen-teste.log 2>&1; then
    PASSOU=$((PASSOU + 1))
    printf '  \033[32mok\033[0m    %s\n' "$nome"
  else
    FALHOU=$((FALHOU + 1))
    FALHAS+=("$nome")
    printf '  \033[31mFALHA\033[0m %s\n' "$nome"
    sed 's/^/          /' /tmp/arsen-teste.log | tail -6
  fi
done

echo
echo "────────────────────────────────────────────"
echo "  ${PASSOU} passaram, ${FALHOU} falharam"

if [ "$FALHOU" -gt 0 ]; then
  echo
  echo "  Falharam:"
  for f in "${FALHAS[@]}"; do echo "    - $f"; done
  exit 1
fi
