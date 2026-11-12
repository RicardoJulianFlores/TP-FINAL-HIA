require('dotenv').config();
const { Sequelize } = require('sequelize');

const dbName = process.env.DB_NAME || 'trabajoFinal';
const dbUser = process.env.DB_USER || 'postgres';
const dbPassword = process.env.DB_PASSWORD;

const readHost = process.env.DB_READ_HOST || process.env.DB_REPLICA_HOST;
const writeHost = process.env.DB_WRITE_HOST || process.env.DB_PRIMARY_HOST || process.env.DB_HOST || 'db';

let sequelize;

if (readHost) {
    const writePort = parseInt(process.env.DB_WRITE_PORT || process.env.DB_PORT || '5432', 10);
    const readPort = parseInt(process.env.DB_READ_PORT || process.env.DB_PORT || '5432', 10);

    sequelize = new Sequelize(dbName, null, null, {
        dialect: 'postgres',
        replication: {
            read: [
                {
                    host: readHost,
                    port: readPort,
                    username: dbUser,
                    password: dbPassword,
                }
            ],
            write: {
                host: writeHost,
                port: writePort,
                username: dbUser,
                password: dbPassword,
            }
        },
        pool: {
            max: 10,
            min: 0,
            idle: 10000,
            acquire: 30000,
        },
        logging: false,
    });

    console.log(`[Database] Sequelize replication enabled: Write -> ${writeHost}:${writePort}, Read -> ${readHost}:${readPort}`);
} else {
    const host = process.env.DB_HOST || 'localhost';
    const port = parseInt(process.env.DB_PORT || '5432', 10);

    sequelize = new Sequelize(dbName, dbUser, dbPassword, {
        host: host,
        port: port,
        dialect: 'postgres',
        logging: false,
    });

    console.log(`[Database] Standalone connection configured: ${host}:${port}`);
}

const verifyConnections = async () => {
    try {
        if (readHost) {
            await sequelize.authenticate({ useMaster: true });
            console.log(`[Database] Connected to PRIMARY (Write) at ${writeHost}`);
            await sequelize.authenticate();
            console.log(`[Database] Connected to REPLICA (Read) at ${readHost}`);
        } else {
            await sequelize.authenticate();
            console.log(`[Database] Connected to PostgreSQL at ${process.env.DB_HOST || 'localhost'}`);
        }
    } catch (err) {
        console.error('[Database] Error connecting to PostgreSQL cluster:', err.message);
    }
};

verifyConnections();

module.exports = sequelize;
