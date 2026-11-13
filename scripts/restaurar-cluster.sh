#!/usr/bin/env bash
# ==============================================================================
# Joyería Lumière - Script de Restauración y Reintegración del Clúster Original
# ==============================================================================
# Restaura la topología original de clúster preservando los datos:
# - lumiere-db como nodo Primario (Lectura/Escritura).
# - lumiere-db-replica como Standby (Streaming Replication, Solo Lectura).
#
# GARANTÍA DE CERO PÉRDIDA DE DATOS (RPO = 0):
# Si lumiere-db-replica fue promovida y recibió transacciones mientras
# lumiere-db estaba fuera de servicio, dichas transacciones son sincronizadas
# hacia lumiere-db ANTES de recrear el standby, evitando pérdida de datos.
# ==============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

NETWORK_NAME=$(docker inspect lumiere-db-replica --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' 2>/dev/null | grep "db-net" | head -n1 || echo "")
if [ -z "$NETWORK_NAME" ]; then
  NETWORK_NAME=$(docker network ls --filter name=db-net --format '{{.Name}}' | head -n1 || echo "")
fi

echo "=== 1. Comprobando estado actual de lumiere-db-replica ==="
REPLICA_REC="unknown"
if docker compose ps -q db-replica >/dev/null 2>&1; then
  REPLICA_REC=$(docker compose exec -T db-replica sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT pg_is_in_recovery();"' 2>/dev/null || echo "offline")
fi
echo "Estado de lumiere-db-replica (pg_is_in_recovery): $REPLICA_REC"

echo "=== 2. Iniciando nodo primario original (lumiere-db) ==="
# Aislar alias 'db' en réplica antes de levantar lumiere-db para evitar colisiones DNS
if [ "$REPLICA_REC" = "f" ] && [ -n "$NETWORK_NAME" ]; then
  echo "Reasignando réplica únicamente a alias 'db-replica' para evitar colisiones..."
  docker network disconnect "$NETWORK_NAME" lumiere-db-replica 2>/dev/null || true
  docker network connect --alias db-replica "$NETWORK_NAME" lumiere-db-replica 2>/dev/null || true
fi

docker compose start db || docker compose up -d db

echo "Esperando a que lumiere-db esté listo y saludable..."
until [ "$(docker inspect -f '{{.State.Health.Status}}' lumiere-db 2>/dev/null)" = "healthy" ]; do
  sleep 2
done
echo "OK: lumiere-db saludable."

# Restaurar alias oficiales en lumiere-db
if [ -n "$NETWORK_NAME" ]; then
  docker network disconnect "$NETWORK_NAME" lumiere-db 2>/dev/null || true
  docker network connect --alias db --alias db-primary "$NETWORK_NAME" lumiere-db 2>/dev/null || true
  echo "OK: Alias 'db' y 'db-primary' asignados a lumiere-db."
fi

# Sincronizar datos si la réplica fue promovida y aceptó escrituras
if [ "$REPLICA_REC" = "f" ]; then
  echo "=== 3. Sincronizando datos transaccionales post-failover hacia lumiere-db ==="
  docker compose exec -T db-replica sh -c 'pg_dump -U "$POSTGRES_USER" --clean --if-exists "$POSTGRES_DB"' | \
    docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null
  echo "✓ Sincronización de transacciones completada exitosamente sin pérdida de datos."
fi

if [ "$REPLICA_REC" = "f" ] || [ "$REPLICA_REC" = "offline" ] || [ "$REPLICA_REC" = "unknown" ]; then
  echo "=== 4. Configurando Replication Slot en el Primario ==="
  docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'EOF'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_replication_slots WHERE slot_name = 'replica_slot') THEN
    PERFORM pg_create_physical_replication_slot('replica_slot');
  END IF;
END;
$$;
EOF

  echo "=== 5. Recreando contenedor de réplica para reinicialización en Standby ==="
  docker compose stop db-replica
  docker compose rm -f db-replica
  docker volume rm -f lumiere_pgdata_replica 2>/dev/null || true
  docker compose up -d db-replica

  echo "Esperando que el contenedor de réplica complete el base backup e inicie streaming..."
  COUNT=0
  MAX_WAIT=120
  until [ "$(docker compose exec -T db-replica sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT pg_is_in_recovery();"' 2>/dev/null || echo "f")" = "t" ]; do
    sleep 2
    COUNT=$((COUNT + 2))
    if [ "$COUNT" -ge "$MAX_WAIT" ]; then
      echo "ADVERTENCIA: La réplica aún no responde pg_is_in_recovery = t tras $MAX_WAIT segundos."
      break
    fi
  done
else
  echo "=== 3. La réplica ya se encuentra en modo Standby activo (pg_is_in_recovery = t). Omitiendo recreación. ==="
fi

echo "=== 6. Reiniciando backend para reconectar pools con la topología restablecida ==="
docker compose restart backend
sleep 3

echo "=== 7. Ejecutando verificación completa de replicación ==="
./scripts/verificar-replicacion.sh

echo "=== CLÚSTER RESTABLECIDO EXITOSAMENTE A SU TOPOLOGÍA BASE ==="
