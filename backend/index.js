require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client } = require('pg');
const sequelize = require('./config/database');
const { calculateClusterHealth } = require('./config/cluster-health');

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
        let primaryData = {
            status: 'unknown',
            host: writeTarget.host,
            port: writeTarget.port,
            in_recovery: false,
            server_ip: null
        };

        try {
            const [pRow] = await sequelize.query('SELECT pg_is_in_recovery() AS in_recovery, inet_server_addr() AS server_ip;', {
                type: sequelize.QueryTypes.SELECT,
                useMaster: true
            });
            const inRecovery = pRow ? Boolean(pRow.in_recovery) : false;
            primaryData = {
                status: 'healthy',
                host: writeTarget.host,
                port: writeTarget.port,
                in_recovery: inRecovery,
                server_ip: pRow && pRow.server_ip ? String(pRow.server_ip) : null
            };
        } catch (err) {
            primaryData = {
                status: 'down',
                host: writeTarget.host,
                port: writeTarget.port,
                error: err.message,
                server_ip: null
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
                const qRes = await client.query('SELECT pg_is_in_recovery() AS in_recovery, inet_server_addr() AS server_ip;');
                await client.end();
                const row = qRes.rows[0];
                return {
                    status: 'healthy',
                    host: rCfg.host,
                    port: rCfg.port,
                    in_recovery: row ? Boolean(row.in_recovery) : true,
                    server_ip: row && row.server_ip ? String(row.server_ip) : null
                };
            } catch (err) {
                try { await client.end(); } catch (_) {}
                return {
                    status: 'down',
                    host: rCfg.host,
                    port: rCfg.port,
                    error: err.message,
                    server_ip: null
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

        // Evaluacion modular de Quorum y Estado Global (con deduplicacion de nodos)
        const healthResult = calculateClusterHealth(primaryData, replicaChecks);
        health.cluster.quorum = healthResult.quorum;
        health.status = healthResult.status;

        return res.status(healthResult.httpCode).json(health);
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

if (process.env.NODE_ENV !== 'test') {
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
}

module.exports = app;
