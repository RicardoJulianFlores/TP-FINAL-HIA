#!/usr/bin/env bash
# Restaura el dump masivo de 36.000.000 de registros (6M por tabla).
# Uso:
#   ./scripts/restaurar-dump.sh
#   ./scripts/restaurar-dump.sh backups/lumiere-36m.dump --si
set -euo pipefail
cd "$(dirname "$0")/.."

if command -v python3 >/dev/null 2>&1; then
  PY=python3
else
  PY=python
fi

exec "$PY" datos/restaurar_dump.py "$@"
