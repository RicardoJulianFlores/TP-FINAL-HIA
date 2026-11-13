#!/usr/bin/env bash
# ==============================================================================
# Joyería Lumière - Script de Promoción de Réplica a Primario (Failover)
# ==============================================================================
# Este script promueve el contenedor de réplica (lumiere-db-replica) a nuevo
# nodo primario de lectura y escritura, y redirige el tráfico del backend.
# ==============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

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
  echo "=== 2. Ejecutando pg_promote() en lumiere-db-replica ==="
  T_PROM_START=$(date +%s%N 2>/dev/null || date +%s)
  
  PROMOTE_RES=$(docker compose exec -T db-replica sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT pg_promote();"')
  T_PROM_END=$(date +%s%N 2>/dev/null || date +%s)
  
  if [ "$PROMOTE_RES" = "t" ]; then
    echo "OK: pg_promote() retornó éxito (t)."
  else
    echo "ERROR: pg_promote() retornó '$PROMOTE_RES'." >&2
    exit 1
  fi

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

echo "=== 3. Redirigiendo tráfico de red (alias 'db' y 'db-primary' hacia la réplica promovida) ==="
NETWORK_NAME=$(docker inspect lumiere-db-replica --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' | grep "db-net" | head -n1)

if [ -n "$NETWORK_NAME" ]; then
  echo "Red detectada: $NETWORK_NAME"
  docker network disconnect "$NETWORK_NAME" lumiere-db-replica
  docker network connect --alias db-replica --alias db --alias db-primary "$NETWORK_NAME" lumiere-db-replica
  echo "OK: Alias 'db' y 'db-primary' asignados a lumiere-db-replica en $NETWORK_NAME."
else
  echo "ADVERTENCIA: No se pudo auto-detectar la red db-net. Omitiendo reasignación de alias."
fi

echo "=== 4. Verificando conectividad y salud del Backend ==="
sleep 2
HEALTH_RESP=$(curl -s http://localhost:3000/api/health || echo "{}")
echo "Respuesta de /api/health: $HEALTH_RESP"

echo "=== PROCESO DE PROMOCIÓN COMPLETADO EXITOSAMENTE ==="
