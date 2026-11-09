#!/usr/bin/env bash
# Restaura una copia .sql sobre la base del contenedor (reemplaza las tablas existentes).
# Uso: ./scripts/restore.sh backups/lumiere_AAAAMMDD_HHMMSS.sql [-y]
set -euo pipefail
cd "$(dirname "$0")/.."
ARCHIVO="${1:-}"; [ -f "$ARCHIVO" ] || { echo "Uso: $0 <archivo.sql> [-y]" >&2; ls -1t backups/*.sql 2>/dev/null | head -5; exit 2; }
if [ "${2:-}" != "-y" ]; then
  read -r -p "Esto REEMPLAZA los datos actuales con $(basename "$ARCHIVO"). ¿Continuar? [s/N] " r
  [ "$r" = "s" ] || { echo "Cancelado."; exit 1; }
fi
T0=$(date +%s)
# --single-transaction + ON_ERROR_STOP: o se restaura todo o no se cambia nada
docker compose exec -T db sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q -o /dev/null -v ON_ERROR_STOP=1 --single-transaction' < "$ARCHIVO"
SEG=$(( $(date +%s) - T0 ))
mkdir -p backups
echo "$(date '+%F %T') | RESTORE OK | $(basename "$ARCHIVO") | ${SEG}s" | tee -a backups/backup.log

echo "--- Filas por tabla tras la restauración ---"
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
SELECT string_agg(format('SELECT %L AS tabla, count(*) AS filas FROM public.%I', table_name, table_name),
                  ' UNION ALL ' ORDER BY table_name) || ' ORDER BY 1'
FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'
\gexec
SQL
