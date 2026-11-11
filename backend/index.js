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
