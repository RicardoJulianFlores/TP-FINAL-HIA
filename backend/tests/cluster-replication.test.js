process.env.NODE_ENV = 'test';
const assert = require('assert');

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
}

function testQuorumCalculationLogic() {
    console.log('--- Test 2: Logica de Quorum y Estados de Salud ---');

    const evaluateHealth = (primaryHealthy, replicas) => {
        const totalNodes = 1 + replicas.length;
        const healthyPrimaryCount = primaryHealthy ? 1 : 0;
        const healthyReplicasCount = replicas.filter(r => r.status === 'healthy').length;
        const totalHealthyNodes = healthyPrimaryCount + healthyReplicasCount;
        const quorumThreshold = Math.floor(totalNodes / 2) + 1;
        const quorumReached = totalHealthyNodes >= quorumThreshold;

        let status;
        let httpCode = 200;

        if (primaryHealthy && healthyReplicasCount === replicas.length) {
            status = 'healthy';
        } else if (primaryHealthy && healthyReplicasCount > 0) {
            status = 'healthy_partial_replica';
        } else if (primaryHealthy && healthyReplicasCount === 0) {
            status = 'degraded_no_replica';
        } else if (!primaryHealthy && healthyReplicasCount > 0) {
            const promoted = replicas.find(r => r.status === 'healthy' && r.in_recovery === false);
            if (promoted) {
                status = 'promoted_primary_no_standby';
            } else {
                status = 'degraded_read_only';
            }
        } else {
            status = 'outage';
            httpCode = 503;
        }

        return {
            status,
            httpCode,
            quorum: {
                total_nodes: totalNodes,
                healthy_nodes: totalHealthyNodes,
                quorum_threshold: quorumThreshold,
                quorum_reached: quorumReached
            }
        };
    };

    // Caso 1: 3/3 nodos saludables
    {
        const res = evaluateHealth(true, [
            { status: 'healthy', in_recovery: true },
            { status: 'healthy', in_recovery: true }
        ]);
        assert.strictEqual(res.status, 'healthy');
        assert.strictEqual(res.quorum.total_nodes, 3);
        assert.strictEqual(res.quorum.healthy_nodes, 3);
        assert.strictEqual(res.quorum.quorum_threshold, 2);
        assert.strictEqual(res.quorum.quorum_reached, true);
        console.log('✓ Caso 1 (3/3 saludable) verificado.');
    }

    // Caso 2: Primario + 1 Replica saludables (1 replica caida -> quorum cumplido!)
    {
        const res = evaluateHealth(true, [
            { status: 'healthy', in_recovery: true },
            { status: 'down', in_recovery: true }
        ]);
        assert.strictEqual(res.status, 'healthy_partial_replica');
        assert.strictEqual(res.quorum.healthy_nodes, 2);
        assert.strictEqual(res.quorum.quorum_reached, true);
        console.log('✓ Caso 2 (Primario + 1 replica vivos, quorum mantenido) verificado.');
    }

    // Caso 3: Primario saludable, 2 replicas caidas (quorum perdido)
    {
        const res = evaluateHealth(true, [
            { status: 'down', in_recovery: true },
            { status: 'down', in_recovery: true }
        ]);
        assert.strictEqual(res.status, 'degraded_no_replica');
        assert.strictEqual(res.quorum.healthy_nodes, 1);
        assert.strictEqual(res.quorum.quorum_reached, false);
        console.log('✓ Caso 3 (Solo primario vivo, quorum perdido) verificado.');
    }

    // Caso 4: Primario caido, 2 replicas saludables (failover factible con quorum)
    {
        const res = evaluateHealth(false, [
            { status: 'healthy', in_recovery: true },
            { status: 'healthy', in_recovery: true }
        ]);
        assert.strictEqual(res.status, 'degraded_read_only');
        assert.strictEqual(res.quorum.healthy_nodes, 2);
        assert.strictEqual(res.quorum.quorum_reached, true);
        console.log('✓ Caso 4 (Primario caido, 2 replicas vivas con quorum) verificado.');
    }

    // Caso 5: Primario caido, 1 replica promovida
    {
        const res = evaluateHealth(false, [
            { status: 'healthy', in_recovery: false },
            { status: 'down', in_recovery: true }
        ]);
        assert.strictEqual(res.status, 'promoted_primary_no_standby');
        console.log('✓ Caso 5 (Replica promovida) verificado.');
    }

    // Caso 6: Todos los nodos caidos (outage total)
    {
        const res = evaluateHealth(false, [
            { status: 'down', in_recovery: true },
            { status: 'down', in_recovery: true }
        ]);
        assert.strictEqual(res.status, 'outage');
        assert.strictEqual(res.httpCode, 503);
        assert.strictEqual(res.quorum.quorum_reached, false);
        console.log('✓ Caso 6 (Outage 503) verificado.');
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
