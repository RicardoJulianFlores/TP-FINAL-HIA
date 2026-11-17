#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

BACKUP_FILE="backups/backup-6m.dump"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: No se encuentra el archivo $BACKUP_FILE en la raíz del proyecto." >&2
  exit 1
fi

echo "=== 1. Copiando el respaldo al contenedor principal (lumiere-db) ==="
docker cp "$BACKUP_FILE" lumiere-db:/tmp/backup.dump

echo "=== 2. Restaurando los 36 millones de registros con pg_restore (Esto puede tardar unos minutos) ==="
docker exec -t lumiere-db pg_restore -U postgres -d trabajoFinal --clean --if-exists /tmp/backup.dump

echo "=== 3. Limpiando archivo temporal dentro del contenedor ==="
docker exec -t lumiere-db rm /tmp/backup.dump

echo "¡Restauración masiva completada con éxito!"