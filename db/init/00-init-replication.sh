#!/bin/sh
set -e

echo "=== [Primary DB] Configuring replication user and pg_hba.conf ==="

REPLICA_USER="${DB_REPLICA_USER:-replicator}"
REPLICA_PASS="${DB_REPLICA_PASSWORD:-replica_password}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${REPLICA_USER}') THEN
            CREATE USER ${REPLICA_USER} WITH REPLICATION LOGIN ENCRYPTED PASSWORD '${REPLICA_PASS}';
        ELSE
            ALTER USER ${REPLICA_USER} WITH REPLICATION LOGIN ENCRYPTED PASSWORD '${REPLICA_PASS}';
        END IF;
    END
    \$\$;

    SELECT pg_create_physical_replication_slot('replica_slot')
    WHERE NOT EXISTS (
        SELECT 1 FROM pg_replication_slots WHERE slot_name = 'replica_slot'
    );
EOSQL

echo "host replication ${REPLICA_USER} 0.0.0.0/0 scram-sha-256" >> "$PGDATA/pg_hba.conf"
echo "host replication ${REPLICA_USER} ::/0 scram-sha-256" >> "$PGDATA/pg_hba.conf"
echo "host replication all 0.0.0.0/0 scram-sha-256" >> "$PGDATA/pg_hba.conf"

echo "=== [Primary DB] Replication configuration completed ==="
