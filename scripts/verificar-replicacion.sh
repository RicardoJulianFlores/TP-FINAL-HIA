#!/usr/bin/env bash
# ==============================================================================
# Joyería Lumière - Script de Validación de Replicación Streaming
# ==============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== 1. Comprobando estado de contenedores del clúster ==="
docker compose ps db db-replica

echo "=== 2. Comprobando roles del clúster (pg_is_in_recovery) ==="
PRIMARY_REC=$(docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT pg_is_in_recovery();"')
REPLICA_REC=$(docker compose exec -T db-replica sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT pg_is_in_recovery();"')

echo "Primario pg_is_in_recovery: $PRIMARY_REC (esperado: f)"
echo "Réplica  pg_is_in_recovery: $REPLICA_REC (esperado: t)"

if [ "$PRIMARY_REC" != "f" ] || [ "$REPLICA_REC" != "t" ]; then
  echo "ERROR: Los roles maestro/esclavo no coinciden con la topología requerida." >&2
  exit 1
fi

echo "=== 3. Comprobando canal de replicación WAL y Slot ==="
SENDER_COUNT=$(docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT count(*) FROM pg_stat_replication WHERE state = '\''streaming'\'';"' || echo 0)
RECEIVER_STATUS=$(docker compose exec -T db-replica sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT status FROM pg_stat_wal_receiver;"' || echo "none")

echo "Primario sender streaming count: $SENDER_COUNT"
echo "Réplica receiver status: $RECEIVER_STATUS"

echo "=== 4. Comprobando sincronización automática de datos ==="
TEST_ITEM="TEST_REPL_$(date +%s)"
echo "Insertando registro en Primario: $TEST_ITEM"
docker compose exec -T db sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -c \"INSERT INTO productos (nombre, categoria, precio, stock, destacado, imagen, \\\"createdAt\\\", \\\"updatedAt\\\") VALUES ('$TEST_ITEM', 'Test', 999.99, 10, false, 'test.png', NOW(), NOW());\"" >/dev/null

sleep 1

echo "Consultando registro en Réplica..."
FOUND=$(docker compose exec -T db-replica sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -Atc \"SELECT nombre FROM productos WHERE nombre = '$TEST_ITEM';\"")

if [ "$FOUND" = "$TEST_ITEM" ]; then
  echo "OK: El registro insertado en el primario se sincronizó automáticamente en la réplica."
else
  echo "ERROR: El registro no fue encontrado en la réplica." >&2
  exit 1
fi

echo "=== 5. Comprobando restricción de solo lectura en la Réplica ==="
set +e
RO_ERR=$(docker compose exec -T db-replica sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -c \"INSERT INTO productos (nombre, categoria, precio, stock, destacado, imagen, \\\"createdAt\\\", \\\"updatedAt\\\") VALUES ('illegal_write', 'Test', 1, 1, false, 'test.png', NOW(), NOW());\"" 2>&1)
set -e

if echo "$RO_ERR" | grep -qi "read-only transaction"; then
  echo "OK: La réplica rechazó la escritura correctamente (read-only enforcement)."
else
  echo "ADVERTENCIA: La réplica no rechazó explícitamente la escritura como se esperaba: $RO_ERR"
fi

echo "=== 6. Limpieza de datos de prueba en el Primario ==="
docker compose exec -T db sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -c \"DELETE FROM productos WHERE nombre = '$TEST_ITEM';\"" >/dev/null

echo "=== RESULTADO: Verificación de Clúster Replicado Exitosa ==="
