#!/bin/sh
set -e

echo "=== [Replica Node] Starting Replica Node Bootstrapper ==="

PRIMARY_HOST="${DB_PRIMARY_HOST:-db}"
PRIMARY_PORT="${DB_PRIMARY_PORT:-5432}"
PRIMARY_USER="${POSTGRES_USER:-postgres}"
REPLICA_USER="${DB_REPLICA_USER:-replicator}"
REPLICA_PASS="${DB_REPLICA_PASSWORD:-replica_password}"

echo "Waiting for primary database ($PRIMARY_HOST:$PRIMARY_PORT) to accept connections..."
until pg_isready -h "$PRIMARY_HOST" -p "$PRIMARY_PORT" -U "$PRIMARY_USER"; do
  sleep 2
done
echo "Primary database is responding."

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "Replica data directory is uninitialized. Preparing to clone from primary..."
  mkdir -p "$PGDATA"
  rm -rf "${PGDATA:?}"/* "${PGDATA:?}"/.[!.]*
  chown -R postgres:postgres "$PGDATA"
  chmod 700 "$PGDATA"

  echo "Executing pg_basebackup from $PRIMARY_HOST..."
  MAX_RETRIES=30
  COUNT=0
  until PGPASSWORD="$REPLICA_PASS" gosu postgres pg_basebackup \
    -h "$PRIMARY_HOST" \
    -p "$PRIMARY_PORT" \
    -U "$REPLICA_USER" \
    -D "$PGDATA" \
    -Fp \
    -Xs \
    -R \
    --slot=replica_slot; do
      COUNT=$((COUNT + 1))
      if [ "$COUNT" -ge "$MAX_RETRIES" ]; then
        echo "ERROR: pg_basebackup failed after $MAX_RETRIES attempts."
        exit 1
      fi
      echo "pg_basebackup attempt $COUNT failed. Retrying in 2s..."
      rm -rf "${PGDATA:?}"/* "${PGDATA:?}"/.[!.]*
      sleep 2
  done
  echo "pg_basebackup completed successfully."
  chmod 700 "$PGDATA"
  chown -R postgres:postgres "$PGDATA"
else
  echo "Replica data directory already initialized. Skipping base backup."
fi

echo "Starting PostgreSQL in standby mode..."
exec docker-entrypoint.sh postgres -c hot_standby=on
