#!/usr/bin/env bash
# ==============================================================================
# Joyería Lumière - Script de Promoción de Réplica a Primario (Failover)
# ==============================================================================
# Este script promueve el contenedor de réplica (lumiere-db-replica) a nuevo
# nodo primario de lectura y escritura, y redirige el tráfico del backend.
# Soporta métodos:
#   --method=sql    (por defecto: ejecuta SELECT pg_promote() vía psql)
#   --method=pg_ctl (ejecuta pg_ctl promote a nivel de proceso PostgreSQL)
# ==============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

METHOD="sql"
for arg in "$@"; do
  case "$arg" in
    --method=sql)
      METHOD="sql"
      ;;
    --method=pg_ctl|--method=ctl)
      METHOD="pg_ctl"
      ;;
    *)
      ;;
  esac
done

COMPOSE_PROJECT=$(docker compose ps -q db-replica 2>/dev/null || true)
if [ -z "$COMPOSE_PROJECT" ]; then
  echo "ERROR: El contenedor lumiere-db-replica no se encuentra en ejecución." >&2
  exit 1
fi

echo "=== 1. Comprobando rol actual del nodo réplica ==="
REPLICA_REC=$(docker compose exec -T db-replica sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT pg_is_in_recovery();"' 2>/dev/null || echo "error")

if [ "$REPLICA_REC" = "f" ]; then
  echo "AVISO: El nodo réplica ya se encuentra promovido a primario (pg_is_in_recovery = false)."
elif [ "$REPLICA_REC" = "t" ]; then
  echo "Nodo réplica en modo Standby confirmado (pg_is_in_recovery = true)."
  echo "=== 2. Ejecutando promoción en lumiere-db-replica (Método: $METHOD) ==="
  T_PROM_START=$(date +%s%N 2>/dev/null || date +%s)
  
  if [ "$METHOD" = "pg_ctl" ]; then
    echo "Invocando 'pg_ctl promote' sobre el nodo standby..."
    docker compose exec -T db-replica sh -c 'gosu postgres pg_ctl promote -D "$PGDATA"'
  else
    echo "Invocando 'SELECT pg_promote()' vía SQL..."
    PROMOTE_RES=$(docker compose exec -T db-replica sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT pg_promote();"')
    if [ "$PROMOTE_RES" != "t" ]; then
      echo "ERROR: pg_promote() retornó '$PROMOTE_RES'." >&2
      exit 1
    fi
  fi
  T_PROM_END=$(date +%s%N 2>/dev/null || date +%s)

  # Validar que efectivamente salió de recovery
  RECOVERY_AFTER=$(docker compose exec -T db-replica sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT pg_is_in_recovery();"')
  if [ "$RECOVERY_AFTER" != "f" ]; then
    echo "ERROR: La réplica aún indica pg_is_in_recovery = $RECOVERY_AFTER." >&2
    exit 1
  fi
  echo "OK: Nodo réplica promovido exitosamente a PRIMARIO (pg_is_in_recovery = false)."
else
  echo "ERROR: No fue posible comunicarse con lumiere-db-replica: $REPLICA_REC" >&2
  exit 1
fi

echo "=== 3. Comprobación de Fencing (Aislamiento del primario anterior) ==="
if [ "$(docker inspect -f '{{.State.Running}}' lumiere-db 2>/dev/null || echo 'false')" = "true" ]; then
  echo "ADVERTENCIA: lumiere-db sigue activo. Deteniendo para evitar conflicto de red y split-brain..."
  docker compose stop db
fi

echo "=== 4. Redirigiendo tráfico de red (alias 'db' y 'db-primary' hacia la réplica promovida) ==="
NETWORK_NAME=$(docker inspect lumiere-db-replica --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' 2>/dev/null | grep "db-net" | head -n1 || echo "")
if [ -z "$NETWORK_NAME" ]; then
  NETWORK_NAME=$(docker network ls --filter name=db-net --format '{{.Name}}' | head -n1 || echo "")
fi

if [ -n "$NETWORK_NAME" ]; then
  echo "Red detectada: $NETWORK_NAME"
  docker network disconnect "$NETWORK_NAME" lumiere-db-replica
  docker network connect --alias db-replica --alias db --alias db-primary "$NETWORK_NAME" lumiere-db-replica
  echo "OK: Alias 'db' y 'db-primary' asignados a lumiere-db-replica en $NETWORK_NAME."
else
  echo "ADVERTENCIA: No se pudo auto-detectar la red db-net. Omitiendo reasignación de alias."
fi

echo "=== 5. Verificando conectividad y salud del Backend ==="
sleep 2
HEALTH_RESP=$(curl -s http://localhost:3000/api/health || echo "{}")
echo "Respuesta de /api/health: $HEALTH_RESP"

echo "=== PROCESO DE PROMOCIÓN COMPLETADO EXITOSAMENTE ==="
