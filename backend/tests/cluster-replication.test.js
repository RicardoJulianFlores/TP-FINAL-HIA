process.env.NODE_ENV = 'test';
const assert = require('assert');
const { calculateClusterHealth } = require('../config/cluster-health');

// Test Suite: Validacion de Configuracion de Cluster de 3 Nodos y Logica de Quorum

function testReadHostsResolution() {
    console.log('--- Test 1: Resolucion de replicas de lectura ---');

    // Subtest A: DB_READ_HOSTS comma-separated
    {
        process.env.DB_READ_HOSTS = 'db-replica,db-replica-2';
        delete process.env.DB_READ_HOST;
        delete process.env.DB_READ_HOST_2;

        delete require.cache[require.resolve('../config/database')];
        const db = require('../config/database');
        assert.strictEqual(db.readPoolConfigs.length, 2, 'Deben existir 2 replicas en el pool');
        assert.strictEqual(db.readPoolConfigs[0].host, 'db-replica');
        assert.strictEqual(db.readPoolConfigs[1].host, 'db-replica-2');
        console.log('✓ Subtest A (DB_READ_HOSTS comma-separated) paso exitosamente.');
    }

    // Subtest B: DB_READ_HOST + DB_READ_HOST_2 individuales
    {
        delete process.env.DB_READ_HOSTS;
        process.env.DB_READ_HOST = 'db-replica';
        process.env.DB_READ_HOST_2 = 'db-replica-2';

        delete require.cache[require.resolve('../config/database')];
        const db = require('../config/database');
        assert.strictEqual(db.readPoolConfigs.length, 2, 'Deben existir 2 replicas en el pool');
        assert.strictEqual(db.readPoolConfigs[0].host, 'db-replica');
        assert.strictEqual(db.readPoolConfigs[1].host, 'db-replica-2');
        console.log('✓ Subtest B (DB_READ_HOST + DB_READ_HOST_2) paso exitosamente.');
    }

    // Subtest C: Compatibilidad hacia atras con replica unica
    {
        delete process.env.DB_READ_HOSTS;
        process.env.DB_READ_HOST = 'db-replica';
        delete process.env.DB_READ_HOST_2;

        delete require.cache[require.resolve('../config/database')];
        const db = require('../config/database');
        assert.strictEqual(db.readPoolConfigs.length, 1, 'Debe existir 1 replica en el pool');
        assert.strictEqual(db.readPoolConfigs[0].host, 'db-replica');
        console.log('✓ Subtest C (Compatibilidad mono-replica) paso exitosamente.');
    }

    // Subtest D: Puertos personalizados en hosts
    {
        process.env.DB_READ_HOSTS = 'db-replica:5433,db-replica-2:5434';
        delete require.cache[require.resolve('../config/database')];
        const db = require('../config/database');
        assert.strictEqual(db.readPoolConfigs[0].port, 5433);
        assert.strictEqual(db.readPoolConfigs[1].port, 5434);
        console.log('✓ Subtest D (Puertos personalizados) paso exitosamente.');
    }

    // Subtest E: Fallback defensivo si DB_READ_HOSTS contiene solo espacios en blanco
    {
        process.env.DB_READ_HOSTS = '   ';
        process.env.DB_READ_HOST = 'db-replica';
        process.env.DB_READ_HOST_2 = 'db-replica-2';
        delete require.cache[require.resolve('../config/database')];
        const db = require('../config/database');
        assert.strictEqual(db.readPoolConfigs.length, 2, 'Debe hacer fallback a DB_READ_HOST y DB_READ_HOST_2');
        assert.strictEqual(db.readPoolConfigs[0].host, 'db-replica');
        assert.strictEqual(db.readPoolConfigs[1].host, 'db-replica-2');
        console.log('✓ Subtest E (Fallback defensivo con espacios en DB_READ_HOSTS) paso exitosamente.');
    }

    // Subtest F: Comma-separated en DB_READ_HOST cuando DB_READ_HOSTS no esta definido
    {
        delete process.env.DB_READ_HOSTS;
        process.env.DB_READ_HOST = 'db-replica,db-replica-2';
        delete process.env.DB_READ_HOST_2;
        delete require.cache[require.resolve('../config/database')];
        const db = require('../config/database');
        assert.strictEqual(db.readPoolConfigs.length, 2);
        assert.strictEqual(db.readPoolConfigs[0].host, 'db-replica');
        assert.strictEqual(db.readPoolConfigs[1].host, 'db-replica-2');
        console.log('✓ Subtest F (DB_READ_HOST comma-separated) paso exitosamente.');
    }
}

function testQuorumCalculationLogic() {
    console.log('--- Test 2: Logica de Quorum y Estados de Salud (Produccion cluster-health.js) ---');

    // Caso 1: 3/3 nodos saludables
    {
        const primary = { status: 'healthy', in_recovery: false, host: 'db', port: 5432 };
        const replicas = [
            { status: 'healthy', in_recovery: true, host: 'db-replica', port: 5432 },
            { status: 'healthy', in_recovery: true, host: 'db-replica-2', port: 5432 }
        ];
        const res = calculateClusterHealth(primary, replicas);
        assert.strictEqual(res.status, 'healthy');
        assert.strictEqual(res.httpCode, 200);
        assert.strictEqual(res.quorum.total_nodes, 3);
        assert.strictEqual(res.quorum.healthy_nodes, 3);
        assert.strictEqual(res.quorum.quorum_threshold, 2);
        assert.strictEqual(res.quorum.quorum_reached, true);
        console.log('✓ Caso 1 (3/3 saludable) verificado.');
    }

    // Caso 2: Primario + 1 Replica saludables (1 replica caida -> quorum 2/3 cumplido)
    {
        const primary = { status: 'healthy', in_recovery: false, host: 'db', port: 5432 };
        const replicas = [
            { status: 'healthy', in_recovery: true, host: 'db-replica', port: 5432 },
            { status: 'down', in_recovery: true, host: 'db-replica-2', port: 5432 }
        ];
        const res = calculateClusterHealth(primary, replicas);
        assert.strictEqual(res.status, 'healthy_partial_replica');
        assert.strictEqual(res.httpCode, 200);
        assert.strictEqual(res.quorum.healthy_nodes, 2);
        assert.strictEqual(res.quorum.quorum_reached, true);
        console.log('✓ Caso 2 (Primario + 1 replica vivos, quorum mantenido) verificado.');
    }

    // Caso 3: Primario saludable, 2 replicas caidas (quorum 1/3 perdido)
    {
        const primary = { status: 'healthy', in_recovery: false, host: 'db', port: 5432 };
        const replicas = [
            { status: 'down', in_recovery: true, host: 'db-replica', port: 5432 },
            { status: 'down', in_recovery: true, host: 'db-replica-2', port: 5432 }
        ];
        const res = calculateClusterHealth(primary, replicas);
        assert.strictEqual(res.status, 'degraded_no_replica');
        assert.strictEqual(res.httpCode, 200);
        assert.strictEqual(res.quorum.healthy_nodes, 1);
        assert.strictEqual(res.quorum.quorum_reached, false);
        console.log('✓ Caso 3 (Solo primario vivo, quorum perdido) verificado.');
    }

    // Caso 4: Primario caido, 2 replicas saludables en standby (read-only quorum 2/3)
    {
        const primary = { status: 'down', in_recovery: false, host: 'db', port: 5432 };
        const replicas = [
            { status: 'healthy', in_recovery: true, host: 'db-replica', port: 5432 },
            { status: 'healthy', in_recovery: true, host: 'db-replica-2', port: 5432 }
        ];
        const res = calculateClusterHealth(primary, replicas);
        assert.strictEqual(res.status, 'degraded_read_only');
        assert.strictEqual(res.httpCode, 200);
        assert.strictEqual(res.quorum.healthy_nodes, 2);
        assert.strictEqual(res.quorum.quorum_reached, true);
        console.log('✓ Caso 4 (Primario caido, 2 replicas vivas con quorum) verificado.');
    }

    // Caso 5: Primario caido, 1 replica promovida, otra replica caida (quorum 1/3 perdido)
    {
        const primary = { status: 'down', in_recovery: false, host: 'db', port: 5432 };
        const replicas = [
            { status: 'healthy', in_recovery: false, host: 'db-replica', port: 5432 },
            { status: 'down', in_recovery: true, host: 'db-replica-2', port: 5432 }
        ];
        const res = calculateClusterHealth(primary, replicas);
        assert.strictEqual(res.status, 'promoted_primary_no_standby');
        assert.strictEqual(res.httpCode, 200);
        assert.strictEqual(res.quorum.healthy_nodes, 1);
        assert.strictEqual(res.quorum.quorum_reached, false);
        console.log('✓ Caso 5 (Replica promovida sin standby) verificado.');
    }

    // Caso 6: Primario caido, 1 replica promovida, otra replica viva en standby (quorum 2/3 mantenido)
    {
        const primary = { status: 'down', in_recovery: false, host: 'db', port: 5432 };
        const replicas = [
            { status: 'healthy', in_recovery: false, host: 'db-replica', port: 5432 },
            { status: 'healthy', in_recovery: true, host: 'db-replica-2', port: 5432 }
        ];
        const res = calculateClusterHealth(primary, replicas);
        assert.strictEqual(res.status, 'promoted_primary_with_standby');
        assert.strictEqual(res.httpCode, 200);
        assert.strictEqual(res.quorum.healthy_nodes, 2);
        assert.strictEqual(res.quorum.quorum_reached, true);
        console.log('✓ Caso 6 (Replica promovida con standby superviviente) verificado.');
    }

    // Caso 7: Deteccion y prevencion de DOBLE CONTEO post-failover
    // Cuando el alias 'db' y 'db-replica' apuntan al mismo contenedor físico (misma IP)
    // y la replica 2 esta caida: debe reportar exactamente 1 nodo vivo y quorum PERDIDO.
    {
        const primary = { status: 'healthy', in_recovery: false, host: 'db', port: 5432, server_ip: '172.28.0.3' };
        const replicas = [
            { status: 'healthy', in_recovery: false, host: 'db-replica', port: 5432, server_ip: '172.28.0.3' },
            { status: 'down', in_recovery: true, host: 'db-replica-2', port: 5432, server_ip: null }
        ];
        const res = calculateClusterHealth(primary, replicas);
        assert.strictEqual(res.quorum.healthy_nodes, 1, 'No debe contar dos veces el nodo promovido');
        assert.strictEqual(res.quorum.quorum_reached, false, 'Un solo nodo sobreviviente NO debe alcanzar quorum');
        console.log('✓ Caso 7 (Prevención de doble conteo post-failover) verificado.');
    }

    // Caso 8: Primario respondiendo pero en modo recovery (read-only, rechazo de escrituras)
    {
        const primary = { status: 'healthy', in_recovery: true, host: 'db', port: 5432 };
        const replicas = [
            { status: 'healthy', in_recovery: true, host: 'db-replica', port: 5432 },
            { status: 'healthy', in_recovery: true, host: 'db-replica-2', port: 5432 }
        ];
        const res = calculateClusterHealth(primary, replicas);
        assert.strictEqual(res.status, 'degraded_read_only', 'Un primario en recovery no debe ser considerado saludable para escrituras');
        console.log('✓ Caso 8 (Primario en modo recovery tratado como read-only) verificado.');
    }

    // Caso 9: Outage total (503)
    {
        const primary = { status: 'down', in_recovery: false, host: 'db', port: 5432 };
        const replicas = [
            { status: 'down', in_recovery: true, host: 'db-replica', port: 5432 },
            { status: 'down', in_recovery: true, host: 'db-replica-2', port: 5432 }
        ];
        const res = calculateClusterHealth(primary, replicas);
        assert.strictEqual(res.status, 'outage');
        assert.strictEqual(res.httpCode, 503);
        assert.strictEqual(res.quorum.quorum_reached, false);
        console.log('✓ Caso 9 (Outage 503) verificado.');
    }

    // Caso 10: Defensivo ante inputs nulos / indefinidos
    {
        const res = calculateClusterHealth(null, null);
        assert.strictEqual(res.status, 'outage');
        assert.strictEqual(res.httpCode, 503);
        assert.strictEqual(res.quorum.total_nodes, 1);
        assert.strictEqual(res.quorum.healthy_nodes, 0);
        assert.strictEqual(res.quorum.quorum_reached, false);
        console.log('✓ Caso 10 (Defensivo ante inputs nulos) verificado.');
    }

    // Caso 11: Topología de 2 nodos (1 primario + 1 réplica) saludable
    {
        const primary = { status: 'healthy', in_recovery: false, host: 'db', port: 5432 };
        const replicas = [
            { status: 'healthy', in_recovery: true, host: 'db-replica', port: 5432 }
        ];
        const res = calculateClusterHealth(primary, replicas);
        assert.strictEqual(res.status, 'healthy');
        assert.strictEqual(res.httpCode, 200);
        assert.strictEqual(res.quorum.total_nodes, 2);
        assert.strictEqual(res.quorum.healthy_nodes, 2);
        assert.strictEqual(res.quorum.quorum_threshold, 2);
        assert.strictEqual(res.quorum.quorum_reached, true);
        console.log('✓ Caso 11 (Topología de 2 nodos saludable) verificado.');
    }
}

try {
    testReadHostsResolution();
    testQuorumCalculationLogic();
    console.log('\n=============================================');
    console.log('✓ TODOS LOS TESTS DE UNIDAD PASARON CON EXITO');
    console.log('=============================================');
} catch (err) {
    console.error('✗ ERROR EN TEST:', err);
    process.exit(1);
}
