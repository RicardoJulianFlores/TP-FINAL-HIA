#!/usr/bin/env bash
# Genera los CSV (6M filas por tabla), los carga en Postgres dentro de Docker y limpia.
#
# Uso:
#   ./cargar_datos.sh                  # genera CSV y carga (aborta si ya hay datos)
#   ./cargar_datos.sh --limpiar        # vacia las 6 tablas (TRUNCATE) antes de cargar
#   ./cargar_datos.sh --sin-generar    # reutiliza los CSV que ya existen
#
# Ponelo en la misma carpeta que generador_maestras.py, generador_transaccional.py
# y cargar_datos.sql. En Windows ejecutalo con Git Bash o WSL.

set -euo pipefail
cd "$(dirname "$0")"

# Git Bash (Windows) convierte rutas como /tmp/x.csv a C:/...; esto lo evita
export MSYS_NO_PATHCONV=1

CONTAINER="lumiere-db"
DB="trabajoFinal"
DBUSER="postgres"
CSVS=(usuarios productos pedidos detalles pagos accesos)

LIMPIAR=false
GENERAR=true
for arg in "$@"; do
  case "$arg" in
    --limpiar)      LIMPIAR=true ;;
    --sin-generar)  GENERAR=false ;;
    *) echo "Opcion desconocida: $arg"; exit 1 ;;
  esac
done

PY=""
for cand in python3 python py; do
  if command -v "$cand" >/dev/null 2>&1 && "$cand" -c "import sys" >/dev/null 2>&1; then
    PY="$cand"; break
  fi
done
if [[ -z "$PY" ]]; then
  echo "No se encontro un Python funcional (el alias de Microsoft Store no cuenta)."
  echo "Instalalo desde https://www.python.org/downloads/ marcando 'Add python.exe to PATH',"
  echo "o con: winget install Python.Python.3.12  -- y abri una Git Bash nueva."
  exit 1
fi

psql_c() { docker exec -i "$CONTAINER" psql -U "$DBUSER" -d "$DB" -v ON_ERROR_STOP=1 "$@"; }

cleanup() {
  echo ">> Borrando CSV temporales del contenedor..."
  for t in "${CSVS[@]}"; do
    docker exec "$CONTAINER" rm -f "/tmp/$t.csv" >/dev/null 2>&1 || true
  done
}
trap cleanup EXIT

# 0. Verificaciones
docker ps --format '{{.Names}}' | grep -qx "$CONTAINER" \
  || { echo "El contenedor $CONTAINER no esta corriendo."; exit 1; }

EXISTENTES=$(psql_c -tAc 'SELECT count(*) FROM public.pedidos')
if [[ "$LIMPIAR" == true ]]; then
  echo ">> Vaciando tablas (TRUNCATE ... RESTART IDENTITY)..."
  psql_c -c 'TRUNCATE public.accesos, public.pagos, public.detalles, public.pedidos, public.productos, public.usuarios RESTART IDENTITY CASCADE;'
elif [[ "$EXISTENTES" -gt 0 ]]; then
  echo "Ya hay $EXISTENTES pedidos cargados. Cargar de nuevo duplicaria datos y rompería las relaciones."
  echo "Volve a correr con --limpiar si queres borrar todo y empezar de cero."
  exit 1
fi

# 1. Generar CSV
if [[ "$GENERAR" == true ]]; then
  echo ">> Generando CSV maestros..."
  "$PY" generador_maestras.py
  echo ">> Generando CSV transaccionales..."
  "$PY" generador_transaccional.py
else
  for t in "${CSVS[@]}"; do
    [[ -f "$t.csv" ]] || { echo "Falta $t.csv (quita --sin-generar)."; exit 1; }
  done
fi

# 2. Copiar al contenedor
echo ">> Copiando CSV al contenedor..."
for t in "${CSVS[@]}"; do
  docker cp "$t.csv" "$CONTAINER:/tmp/$t.csv"
done

# 3. Cargar
echo ">> Cargando en PostgreSQL (puede tardar varios minutos)..."
psql_c < cargar_datos.sql

echo ">> Listo."
