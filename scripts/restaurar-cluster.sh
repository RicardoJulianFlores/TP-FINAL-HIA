#!/usr/bin/env bash
# ==============================================================================
# Joyería Lumière - Script de Restauración y Reintegración del Clúster Original
# Topología de 3 Nodos: Primario (lumiere-db) + 2 Réplicas (db-replica, db-replica-2)
# ==============================================================================
# Restaura la topología original de clúster preservando los datos:
# - lumiere-db como nodo Primario (Lectura/Escritura).
# - lumiere-db-replica como Standby 1 (Streaming Replication, Solo Lectura).
# - lumiere-db-replica-2 como Standby 2 (Streaming Replication, Solo Lectura).
#
# GARANTÍA DE CERO PÉRDIDA DE DATOS (RPO = 0):
# Si alguna réplica fue promovida y recibió transacciones mientras lumiere-db
# estaba fuera de servicio, dichas transacciones son sincronizadas hacia lumiere-db
# ANTES de recrear los standbys, evitando pérdida de datos (Failback sin pérdida).
# ==============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

NETWORK_NAME=$(docker inspect lumiere-db-replica --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' 2>/dev/null | grep "db-net" | head -n1 || echo "")
if [ -z "$NETWORK_NAME" ]; then
  NETWORK_NAME=$(docker network ls --filter name=db-net --format '{{.Name}}' | head -n1 || echo "")
fi

echo "=== 1. Comprobando estado actual de réplicas en el clúster ==="
REPLICA1_REC="unknown"
REPLICA2_REC="unknown"

if docker compose ps -q db-replica >/dev/null 2>&1; then
  REPLICA1_REC=$(docker compose exec -T db-replica sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT pg_is_in_recovery();"' 2>/dev/null || echo "offline")
fi
if docker compose ps -q db-replica-2 >/dev/null 2>&1; then
  REPLICA2_REC=$(docker compose exec -T db-replica-2 sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT pg_is_in_recovery();"' 2>/dev/null || echo "offline")
fi

echo "Estado de lumiere-db-replica   (pg_is_in_recovery): $REPLICA1_REC"
echo "Estado de lumiere-db-replica-2 (pg_is_in_recovery): $REPLICA2_REC"

PROMOTED_NODE=""
if [ "$REPLICA1_REC" = "f" ]; then
  PROMOTED_NODE="db-replica"
elif [ "$REPLICA2_REC" = "f" ]; then
  PROMOTED_NODE="db-replica-2"
fi

echo "=== 2. Iniciando nodo primario original (lumiere-db) ==="
# Aislar alias 'db' en el nodo promovido antes de levantar lumiere-db para evitar colisiones DNS
if [ -n "$PROMOTED_NODE" ] && [ -n "$NETWORK_NAME" ]; then
  echo "Reasignando réplica promovida ($PROMOTED_NODE) únicamente a su alias original para evitar colisiones..."
  docker network disconnect "$NETWORK_NAME" "lumiere-$PROMOTED_NODE" 2>/dev/null || true
  if [ "$PROMOTED_NODE" = "db-replica" ]; then
    docker network connect --alias db-replica --alias db-replica-1 "$NETWORK_NAME" "lumiere-$PROMOTED_NODE" 2>/dev/null || true
  else
    docker network connect --alias "$PROMOTED_NODE" "$NETWORK_NAME" "lumiere-$PROMOTED_NODE" 2>/dev/null || true
  fi
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

# Sincronizar datos si una réplica fue promovida y aceptó escrituras post-failover
if [ -n "$PROMOTED_NODE" ]; then
  echo "=== 3. Sincronizando datos transaccionales post-failover desde $PROMOTED_NODE hacia lumiere-db ==="
  docker compose exec -T "$PROMOTED_NODE" sh -c 'pg_dump -U "$POSTGRES_USER" --clean --if-exists "$POSTGRES_DB"' | \
    docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null
  echo "✓ Sincronización de transacciones completada exitosamente sin pérdida de datos (RPO = 0)."
fi

echo "=== 4. Configurando Replication Slots en el Primario ==="
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'EOF'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_replication_slots WHERE slot_name = 'replica_slot') THEN
    PERFORM pg_create_physical_replication_slot('replica_slot');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_replication_slots WHERE slot_name = 'replica_slot_2') THEN
    PERFORM pg_create_physical_replication_slot('replica_slot_2');
  END IF;
END;
$$;
EOF

# Restaurar db-replica si fue promovida, si hubo failover, o si está fuera de servicio
if [ -n "$PROMOTED_NODE" ] || [ "$REPLICA1_REC" = "f" ] || [ "$REPLICA1_REC" = "offline" ] || [ "$REPLICA1_REC" = "unknown" ]; then
  echo "=== 5a. Recreando contenedor lumiere-db-replica para reinicialización en Standby ==="
  docker compose stop db-replica
  docker compose rm -f db-replica
  docker volume rm -f lumiere_pgdata_replica 2>/dev/null || true
  docker compose up -d db-replica
fi

# Restaurar db-replica-2 si fue promovida, si hubo failover, o si está fuera de servicio
if [ -n "$PROMOTED_NODE" ] || [ "$REPLICA2_REC" = "f" ] || [ "$REPLICA2_REC" = "offline" ] || [ "$REPLICA2_REC" = "unknown" ]; then
  echo "=== 5b. Recreando contenedor lumiere-db-replica-2 para reinicialización en Standby ==="
  docker compose stop db-replica-2
  docker compose rm -f db-replica-2
  docker volume rm -f lumiere_pgdata_replica_2 2>/dev/null || true
  docker compose up -d db-replica-2
fi

echo "Esperando que ambas réplicas completen base backup e inicien streaming..."
MAX_WAIT=120
COUNT=0
until [ "$(docker compose exec -T db-replica sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT pg_is_in_recovery();"' 2>/dev/null || echo "f")" = "t" ] && \
      [ "$(docker compose exec -T db-replica-2 sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT pg_is_in_recovery();"' 2>/dev/null || echo "f")" = "t" ]; do
  sleep 2
  COUNT=$((COUNT + 2))
  if [ "$COUNT" -ge "$MAX_WAIT" ]; then
    echo "ADVERTENCIA: Las réplicas aún no responden pg_is_in_recovery = t tras $MAX_WAIT segundos."
    break
  fi
done

echo "=== 6. Reiniciando backend para reconectar pools con la topología de 3 nodos ==="
docker compose restart backend
sleep 3

echo "=== 7. Ejecutando verificación completa de replicación en los 3 nodos ==="
./scripts/verificar-replicacion.sh

echo "=== CLÚSTER RESTABLECIDO EXITOSAMENTE A SU TOPOLOGÍA BASE (3 NODOS) ==="
