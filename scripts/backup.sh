#!/usr/bin/env bash
# Genera una copia de seguridad en SQL plano:  backups/lumiere_AAAAMMDD_HHMMSS.sql
# Uso: ./scripts/backup.sh          (conserva las últimas BACKUP_KEEP copias, por defecto 7)
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
KEEP="${BACKUP_KEEP:-7}"
OUT="backups/lumiere_$(date +%Y%m%d_%H%M%S).sql"
T0=$(date +%s)

# pg_dump corre DENTRO del contenedor (misma versión que el servidor) con sus propias credenciales.
docker compose exec -T db sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges' > "$OUT.part"

# Un dump completo termina con esta línea; si falta, el archivo está truncado
if ! tail -n 5 "$OUT.part" | grep -q "PostgreSQL database dump complete"; then
  rm -f "$OUT.part"; echo "ERROR: el backup quedó incompleto" >&2; exit 1
fi
mv "$OUT.part" "$OUT"

SEG=$(( $(date +%s) - T0 ))
echo "$(date '+%F %T') | BACKUP OK | $(basename "$OUT") | $(wc -c < "$OUT") bytes | ${SEG}s" | tee -a backups/backup.log

# Retención: borra las copias más antiguas
ls -1t backups/lumiere_*.sql | tail -n +"$((KEEP + 1))" | while read -r viejo; do
  rm -f "$viejo"; echo "$(date '+%F %T') | RETENCION | eliminado $(basename "$viejo")" | tee -a backups/backup.log
done
