#!/usr/bin/env bash
# ==============================================================================
# Joyería Lumière - Script de Restauración y Reintegración del Clúster Original
# ==============================================================================
# Restaura la topología original de clúster:
# - lumiere-db como nodo Primario (Lectura/Escritura).
# - lumiere-db-replica como Standby (Streaming Replication, Solo Lectura).
# ==============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== 1. Asegurando que el nodo primario original (lumiere-db) esté iniciado ==="
docker compose start db || docker compose up -d db

echo "Esperando a que lumiere-db esté listo y saludable..."
until [ "$(docker inspect -f '{{.State.Health.Status}}' lumiere-db 2>/dev/null)" = "healthy" ]; do
  sleep 2
done
echo "OK: lumiere-db saludable."

echo "=== 2. Restaurando alias de red originales ==="
NETWORK_NAME=$(docker inspect lumiere-db --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' | grep "db-net" | head -n1)
if [ -n "$NETWORK_NAME" ]; then
  # Reasociar lumiere-db-replica sólo con su alias de réplica
  if docker inspect lumiere-db-replica >/dev/null 2>&1; then
    docker network disconnect "$NETWORK_NAME" lumiere-db-replica 2>/dev/null || true
    docker network connect --alias db-replica "$NETWORK_NAME" lumiere-db-replica 2>/dev/null || true
  fi
  # Asegurar que lumiere-db posea los alias principales
  docker network disconnect "$NETWORK_NAME" lumiere-db 2>/dev/null || true
  docker network connect --alias db --alias db-primary "$NETWORK_NAME" lumiere-db 2>/dev/null || true
  echo "OK: Alias restaurados (db -> lumiere-db, db-replica -> lumiere-db-replica)."
fi

echo "=== 3. Comprobando estado de recuperación de lumiere-db-replica ==="
REPLICA_REC=$(docker compose exec -T db-replica sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT pg_is_in_recovery();"' 2>/dev/null || echo "unhealthy")

if [ "$REPLICA_REC" = "f" ] || [ "$REPLICA_REC" = "unhealthy" ]; then
  echo "El nodo réplica se encontraba promovido o desconectado. Resincronizando réplica desde el primario..."
  
  # Asegurar que el replication slot replica_slot exista en el primario
  docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'EOF'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_replication_slots WHERE slot_name = 'replica_slot') THEN
    PERFORM pg_create_physical_replication_slot('replica_slot');
  END IF;
END;
$$;
EOF

  docker compose stop db-replica
  docker compose rm -f db-replica
  docker volume rm -f lumiere_pgdata_replica 2>/dev/null || true
  docker compose up -d db-replica

  echo "Esperando que el contenedor de réplica complete el base backup e inicie streaming..."
  COUNT=0
  MAX_WAIT=120
  until [ "$(docker compose exec -T db-replica sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT pg_is_in_recovery();"' 2>/dev/null || echo "f")" = "t" ]; do
    sleep 3
    COUNT=$((COUNT + 3))
    if [ "$COUNT" -ge "$MAX_WAIT" ]; then
      echo "ADVERTENCIA: La réplica aún no responde pg_is_in_recovery = t tras $MAX_WAIT segundos."
      break
    fi
  done
else
  echo "OK: La réplica ya se encuentra en modo standby (pg_is_in_recovery = t)."
fi

echo "=== 4. Reiniciando backend para reconectar pools con la topología restablecida ==="
docker compose restart backend
sleep 3

echo "=== 5. Ejecutando verificación completa de replicación ==="
./scripts/verificar-replicacion.sh

echo "=== CLÚSTER RESTABLECIDO EXITOSAMENTE A SU TOPOLOGÍA BASE ==="
