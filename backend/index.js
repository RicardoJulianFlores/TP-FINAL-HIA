require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client } = require('pg');
const sequelize = require('./config/database');

const swaggerUi = require('swagger-ui-express'); //importamos la libreria, y esta genera una interfaz grafica
const swaggerFile = require('./swagger_output.json');

var app = express();
//middlewares
app.use(express.json());
app.use(cors());
//Cargamos el modulo de direccionamiento de rutas
app.use('/api/productos', require('./src/routes/producto.route'));
app.use('/api/contactos', require('./src/routes/contacto.route'));
app.use('/api/pedidos', require('./src/routes/pedido.route'));
app.use('/api/pagos', require('./src/routes/pago.route'));
app.use('/api/usuario', require('./src/routes/usuario.route'));
app.use('/api/dashboard', require('./src/routes/dashboard.route'));
app.use('/api/estadisticas', require('./src/routes/estadisticas.route'));
app.use('/api/mp', require('./src/routes/mp.route'));
app.use('/api/configuracion', require('./src/routes/configuracion.route'));

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerFile));

app.get('/api/health', async (req, res) => {
    const readPool = sequelize.readPoolConfigs || [];
    const writeTarget = sequelize.writeConfig || {
        host: process.env.DB_WRITE_HOST || 'db',
        port: parseInt(process.env.DB_WRITE_PORT || '5432', 10)
    };
    const dbUser = process.env.DB_USER || 'postgres';
    const dbPassword = process.env.DB_PASSWORD;
    const dbName = process.env.DB_NAME || 'trabajoFinal';

    const isReplicated = readPool.length > 0 || Boolean(process.env.DB_READ_HOST);

    const health = {
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        cluster: {
            topology: isReplicated ? 'replication' : 'standalone',
        }
    };

    if (isReplicated) {
        let primaryHealthy = false;
        let primaryData = {
            status: 'unknown',
            host: writeTarget.host,
            port: writeTarget.port,
            in_recovery: false
        };

        try {
            const [pRow] = await sequelize.query('SELECT pg_is_in_recovery() AS in_recovery;', {
                type: sequelize.QueryTypes.SELECT,
                useMaster: true
            });
            primaryData = {
                status: 'healthy',
                host: writeTarget.host,
                port: writeTarget.port,
                in_recovery: pRow ? pRow.in_recovery : false
            };
            primaryHealthy = true;
        } catch (err) {
            primaryData = {
                status: 'down',
                host: writeTarget.host,
                port: writeTarget.port,
                error: err.message
            };
        }
        health.cluster.primary = primaryData;

        // Comprobar cada nodo de replica configurado
        const targetsToCheck = readPool.length > 0 ? readPool : [{
            host: process.env.DB_READ_HOST || 'db-replica',
            port: parseInt(process.env.DB_READ_PORT || '5432', 10),
            username: dbUser,
            password: dbPassword
        }];

        const replicaChecks = await Promise.all(targetsToCheck.map(async (rCfg) => {
            const client = new Client({
                host: rCfg.host,
                port: rCfg.port,
                user: rCfg.username || dbUser,
                password: rCfg.password || dbPassword,
                database: dbName,
                connectionTimeoutMillis: 2500
            });
            try {
                await client.connect();
                const qRes = await client.query('SELECT pg_is_in_recovery() AS in_recovery;');
                await client.end();
                return {
                    status: 'healthy',
                    host: rCfg.host,
                    port: rCfg.port,
                    in_recovery: qRes.rows[0] ? qRes.rows[0].in_recovery : true
                };
            } catch (err) {
                try { await client.end(); } catch (_) {}
                return {
                    status: 'down',
                    host: rCfg.host,
                    port: rCfg.port,
                    error: err.message
                };
            }
        }));

        health.cluster.replicas = replicaChecks;
        // Compatibilidad hacia atras con tests y scripts que consultan health.cluster.replica
        health.cluster.replica = replicaChecks[0] || {
            status: 'down',
            host: process.env.DB_READ_HOST || 'db-replica',
            error: 'No read replicas configured'
        };

        // Calculo de Quorum del Cluster (Nodos totales = 1 Primario + M Replicas, Umbral = floor(N/2) + 1)
        const totalNodes = 1 + replicaChecks.length;
        const healthyPrimaryCount = primaryHealthy ? 1 : 0;
        const healthyReplicasCount = replicaChecks.filter(r => r.status === 'healthy').length;
        const totalHealthyNodes = healthyPrimaryCount + healthyReplicasCount;
        const quorumThreshold = Math.floor(totalNodes / 2) + 1;
        const quorumReached = totalHealthyNodes >= quorumThreshold;

        health.cluster.quorum = {
            total_nodes: totalNodes,
            healthy_nodes: totalHealthyNodes,
            quorum_threshold: quorumThreshold,
            quorum_reached: quorumReached
        };

        // Evaluacion del estado global
        if (primaryHealthy && healthyReplicasCount === replicaChecks.length) {
            health.status = 'healthy';
            return res.status(200).json(health);
        } else if (primaryHealthy && healthyReplicasCount > 0) {
            // Alta disponibilidad activa: falla parcial tolerada con quorum cumplido
            health.status = 'healthy_partial_replica';
            return res.status(200).json(health);
        } else if (primaryHealthy && healthyReplicasCount === 0) {
            health.status = 'degraded_no_replica';
            return res.status(200).json(health);
        } else if (!primaryHealthy && healthyReplicasCount > 0) {
            const promotedStandby = replicaChecks.find(r => r.status === 'healthy' && r.in_recovery === false);
            if (promotedStandby) {
                health.status = 'promoted_primary_no_standby';
            } else {
                health.status = 'degraded_read_only';
            }
            return res.status(200).json(health);
        } else {
            health.status = 'outage';
            return res.status(503).json(health);
        }
    } else {
        try {
            await sequelize.authenticate();
            health.cluster.database = { status: 'healthy', host: process.env.DB_HOST || 'localhost' };
            health.status = 'healthy';
            return res.status(200).json(health);
        } catch (err) {
            health.status = 'down';
            health.error = err.message;
            return res.status(503).json(health);
        }
    }
});

console.log("Access Token:", process.env.ACCESS_TOKEN);

//setting
app.set('port', process.env.PORT || 3000);
// Sincronizar Base de Datos y arrancar el servidor
// .sync() crea las tablas automáticamente en Postgres si aún no existen
// force en false crea las tablas solo si no existe, no borra datos en cada inicio
sequelize.sync({ force: false })
    .then(() => {
        console.log('Tablas de PostgreSQL sincronizadas');
        app.listen(app.get('port'), () => {
            console.log(`Server started on port`, app.get('port'));
        });
    })
    .catch(err => {
        console.error('No se pudo iniciar el servidor debido a un error en la BD:', err);
    });
