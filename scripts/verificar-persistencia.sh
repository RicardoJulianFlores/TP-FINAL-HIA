#!/usr/bin/env bash
# Demuestra que los datos sobreviven a "docker compose down" (el volumen se conserva).
set -euo pipefail
cd "$(dirname "$0")/.."
sql() { docker compose exec -T db sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -Atc \"$1\""; }

MARCA="marca-$(date +%Y%m%d%H%M%S)"
sql "CREATE TABLE IF NOT EXISTS prueba_persistencia (id serial PRIMARY KEY, marca text NOT NULL, creada timestamptz DEFAULT now());" >/dev/null
sql "INSERT INTO prueba_persistencia (marca) VALUES ('$MARCA');" >/dev/null
echo "1. Contenedor actual : $(docker inspect -f '{{.Id}}' lumiere-db | cut -c1-12)  | dato insertado: $MARCA"

docker compose down
echo "2. 'down' ejecutado. Volumen conservado: $(docker volume ls -q | grep '^lumiere_pgdata$')"

docker compose up -d --wait db
echo "3. Contenedor nuevo  : $(docker inspect -f '{{.Id}}' lumiere-db | cut -c1-12)"

if [ "$(sql "SELECT count(*) FROM prueba_persistencia WHERE marca='$MARCA';")" = "1" ]; then
  echo "RESULTADO: OK - el dato persistió tras destruir y recrear el contenedor"
else
  echo "RESULTADO: FALLO"; exit 1
fi
sql "DROP TABLE prueba_persistencia;" >/dev/null
docker compose up -d
