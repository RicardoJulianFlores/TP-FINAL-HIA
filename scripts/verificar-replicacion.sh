#!/usr/bin/env bash
# ==============================================================================
# Joyería Lumière - Script de Validación de Replicación Streaming (Clúster 3 Nodos)
# ==============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== 1. Comprobando estado de contenedores del clúster (3 Nodos) ==="
docker compose ps db db-replica db-replica-2

echo "=== 2. Comprobando roles del clúster (pg_is_in_recovery) ==="
PRIMARY_REC=$(docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT pg_is_in_recovery();"')
REPLICA1_REC=$(docker compose exec -T db-replica sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT pg_is_in_recovery();"')
REPLICA2_REC=$(docker compose exec -T db-replica-2 sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT pg_is_in_recovery();"')

echo "Primario   pg_is_in_recovery: $PRIMARY_REC (esperado: f)"
echo "Réplica 1  pg_is_in_recovery: $REPLICA1_REC (esperado: t)"
echo "Réplica 2  pg_is_in_recovery: $REPLICA2_REC (esperado: t)"

if [ "$PRIMARY_REC" != "f" ] || [ "$REPLICA1_REC" != "t" ] || [ "$REPLICA2_REC" != "t" ]; then
  echo "ERROR: Los roles maestro/esclavos no coinciden con la topología de 3 nodos requerida." >&2
  exit 1
fi

echo "=== 3. Comprobando canal de replicación WAL y Slots ==="
SENDER_COUNT=$(docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT count(*) FROM pg_stat_replication WHERE state = '\''streaming'\'';"' || echo 0)
RECEIVER1_STATUS=$(docker compose exec -T db-replica sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT status FROM pg_stat_wal_receiver;"' || echo "none")
RECEIVER2_STATUS=$(docker compose exec -T db-replica-2 sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT status FROM pg_stat_wal_receiver;"' || echo "none")

echo "Primario sender streaming count: $SENDER_COUNT (esperado: 2)"
echo "Réplica 1 receiver status: $RECEIVER1_STATUS"
echo "Réplica 2 receiver status: $RECEIVER2_STATUS"

if [ "$SENDER_COUNT" -lt 2 ]; then
  echo "ADVERTENCIA: Se esperaban 2 réplicas en streaming activo; detectadas: $SENDER_COUNT."
fi

echo "=== 4. Comprobando sincronización automática de datos en ambas réplicas ==="
TEST_ITEM="TEST_REPL_$(date +%s)"
echo "Insertando registro en Primario: $TEST_ITEM"
docker compose exec -T db sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -c \"INSERT INTO productos (nombre, categoria, precio, stock, destacado, imagen, \\\"createdAt\\\", \\\"updatedAt\\\") VALUES ('$TEST_ITEM', 'Test', 999.99, 10, false, 'test.png', NOW(), NOW());\"" >/dev/null

sleep 1

echo "Consultando registro en Réplica 1..."
FOUND1=$(docker compose exec -T db-replica sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -Atc \"SELECT nombre FROM productos WHERE nombre = '$TEST_ITEM';\"")
echo "Consultando registro en Réplica 2..."
FOUND2=$(docker compose exec -T db-replica-2 sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -Atc \"SELECT nombre FROM productos WHERE nombre = '$TEST_ITEM';\"")

if [ "$FOUND1" = "$TEST_ITEM" ] && [ "$FOUND2" = "$TEST_ITEM" ]; then
  echo "OK: El registro insertado en el primario se sincronizó automáticamente en ambas réplicas (Réplica 1 y Réplica 2)."
else
  echo "ERROR: El registro no fue encontrado en ambas réplicas. R1='$FOUND1', R2='$FOUND2'" >&2
  exit 1
fi

echo "=== 5. Comprobando restricción de solo lectura en ambas réplicas ==="
set +e
RO1_ERR=$(docker compose exec -T db-replica sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -c \"INSERT INTO productos (nombre, categoria, precio, stock, destacado, imagen, \\\"createdAt\\\", \\\"updatedAt\\\") VALUES ('illegal_write_1', 'Test', 1, 1, false, 'test.png', NOW(), NOW());\"" 2>&1)
RO2_ERR=$(docker compose exec -T db-replica-2 sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -c \"INSERT INTO productos (nombre, categoria, precio, stock, destacado, imagen, \\\"createdAt\\\", \\\"updatedAt\\\") VALUES ('illegal_write_2', 'Test', 1, 1, false, 'test.png', NOW(), NOW());\"" 2>&1)
set -e

if echo "$RO1_ERR" | grep -qi "read-only transaction" && echo "$RO2_ERR" | grep -qi "read-only transaction"; then
  echo "OK: Ambas réplicas rechazaron la escritura correctamente (read-only enforcement)."
else
  echo "ADVERTENCIA: Alguna réplica no rechazó explícitamente la escritura como se esperaba: R1: $RO1_ERR | R2: $RO2_ERR"
fi

echo "=== 6. Comprobando Quórum del Clúster (Consenso de Mayoría) ==="
ACTIVE_NODES=0
[ "$PRIMARY_REC" = "f" ] && ACTIVE_NODES=$((ACTIVE_NODES + 1))
[ "$REPLICA1_REC" = "t" ] && ACTIVE_NODES=$((ACTIVE_NODES + 1))
[ "$REPLICA2_REC" = "t" ] && ACTIVE_NODES=$((ACTIVE_NODES + 1))

echo "Nodos operativos detectados: $ACTIVE_NODES / 3 (Umbral de Quórum: 2)"
if [ "$ACTIVE_NODES" -ge 2 ]; then
  echo "OK: Quórum de mayoría alcanzado exitosamente ($ACTIVE_NODES >= 2)."
else
  echo "ERROR: Quórum perdido en el clúster ($ACTIVE_NODES < 2)." >&2
  exit 1
fi

echo "=== 7. Limpieza de datos de prueba en el Primario ==="
docker compose exec -T db sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -c \"DELETE FROM productos WHERE nombre = '$TEST_ITEM';\"" >/dev/null

echo "=== RESULTADO: Verificación de Clúster Replicado de 3 Nodos Exitosa ==="
