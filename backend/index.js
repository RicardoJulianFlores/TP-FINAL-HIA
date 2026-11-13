require('dotenv').config();
const express = require('express');
const cors = require('cors');
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
    const health = {
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        cluster: {
            topology: process.env.DB_READ_HOST ? 'replication' : 'standalone',
        }
    };

    if (process.env.DB_READ_HOST) {
        let primaryHealthy = false;
        let replicaHealthy = false;

        try {
            const [pRow] = await sequelize.query('SELECT pg_is_in_recovery() AS in_recovery;', {
                type: sequelize.QueryTypes.SELECT,
                useMaster: true
            });
            health.cluster.primary = {
                status: 'healthy',
                host: process.env.DB_WRITE_HOST || 'db',
                in_recovery: pRow ? pRow.in_recovery : false
            };
            primaryHealthy = true;
        } catch (err) {
            health.cluster.primary = {
                status: 'down',
                host: process.env.DB_WRITE_HOST || 'db',
                error: err.message
            };
        }

        try {
            const [rRow] = await sequelize.query('SELECT pg_is_in_recovery() AS in_recovery;', {
                type: sequelize.QueryTypes.SELECT,
                useMaster: false
            });
            health.cluster.replica = {
                status: 'healthy',
                host: process.env.DB_READ_HOST,
                in_recovery: rRow ? rRow.in_recovery : true
            };
            replicaHealthy = true;
        } catch (err) {
            health.cluster.replica = {
                status: 'down',
                host: process.env.DB_READ_HOST,
                error: err.message
            };
        }

        if (primaryHealthy && replicaHealthy) {
            if (health.cluster.replica.in_recovery === false) {
                // Standby promovido a primario (failover completado sin standby secundario adjunto)
                health.status = 'promoted_primary_no_standby';
            } else {
                health.status = 'healthy';
            }
            return res.status(200).json(health);
        } else if (replicaHealthy && !primaryHealthy) {
            health.status = 'degraded_read_only';
            return res.status(200).json(health);
        } else if (primaryHealthy && !replicaHealthy) {
            health.status = 'degraded_no_replica';
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
