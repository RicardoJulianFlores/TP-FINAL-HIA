require('dotenv').config();
const { Sequelize } = require('sequelize');

const dbName = process.env.DB_NAME || 'trabajoFinal';
const dbUser = process.env.DB_USER || 'postgres';
const dbPassword = process.env.DB_PASSWORD;

const writeHost = process.env.DB_WRITE_HOST || process.env.DB_PRIMARY_HOST || process.env.DB_HOST || 'db';
const writePort = parseInt(process.env.DB_WRITE_PORT || process.env.DB_PORT || '5432', 10);
const defaultReadPort = parseInt(process.env.DB_READ_PORT || process.env.DB_PORT || '5432', 10);

// Resolucion de replicas de lectura (soporta DB_READ_HOSTS separado por comas o DB_READ_HOST + DB_READ_HOST_2)
const resolveReadHosts = () => {
    let hosts = [];
    if (process.env.DB_READ_HOSTS && process.env.DB_READ_HOSTS.trim().length > 0) {
        hosts = process.env.DB_READ_HOSTS.split(',').map(h => h.trim()).filter(Boolean);
    }
    if (hosts.length === 0) {
        const primaryRead = process.env.DB_READ_HOST || process.env.DB_REPLICA_HOST;
        if (primaryRead) {
            if (primaryRead.includes(',')) {
                hosts = primaryRead.split(',').map(h => h.trim()).filter(Boolean);
            } else {
                hosts.push(primaryRead.trim());
                const secondaryRead = process.env.DB_READ_HOST_2 || process.env.DB_REPLICA_HOST_2;
                if (secondaryRead) {
                    hosts.push(secondaryRead.trim());
                }
            }
        }
    }
    return hosts;
};

const rawReadHosts = resolveReadHosts();
const readPoolConfigs = rawReadHosts.map((entry, idx) => {
    let host = entry;
    let port = defaultReadPort;
    if (idx === 1 && process.env.DB_READ_PORT_2) {
        port = parseInt(process.env.DB_READ_PORT_2, 10);
    }
    if (entry.includes(':')) {
        const parts = entry.split(':');
        host = parts[0].trim();
        port = parseInt(parts[1], 10) || defaultReadPort;
    }
    return {
        host,
        port,
        database: dbName,
        username: dbUser,
        password: dbPassword,
    };
});

let sequelize;

if (readPoolConfigs.length > 0) {
    sequelize = new Sequelize(dbName, null, null, {
        dialect: 'postgres',
        replication: {
            read: readPoolConfigs,
            write: {
                host: writeHost,
                port: writePort,
                database: dbName,
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
        dialectOptions: {
            connectTimeout: 5000,
        },
        logging: false,
    });

    const readTargets = readPoolConfigs.map(c => `${c.host}:${c.port}`).join(', ');
    console.log(`[Database] Sequelize replication enabled: Write -> ${writeHost}:${writePort}, Read (${readPoolConfigs.length} nodes) -> [${readTargets}]`);
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
        if (readPoolConfigs.length > 0) {
            await sequelize.authenticate({ useMaster: true });
            console.log(`[Database] Connected to PRIMARY (Write) at ${writeHost}:${writePort}`);
            await sequelize.authenticate();
            console.log(`[Database] Read pool authenticated successfully (${readPoolConfigs.length} read replicas configured for load balancing)`);
        } else {
            await sequelize.authenticate();
            console.log(`[Database] Connected to PostgreSQL at ${process.env.DB_HOST || 'localhost'}`);
        }
    } catch (err) {
        console.error('[Database] Error connecting to PostgreSQL cluster:', err.message);
    }
};

if (process.env.NODE_ENV !== 'test') {
    verifyConnections();
}

// Metadatos adjuntos para inspeccion de salud y quorum
sequelize.readPoolConfigs = readPoolConfigs;
sequelize.writeConfig = { host: writeHost, port: writePort };
sequelize.resolveReadHosts = resolveReadHosts;

module.exports = sequelize;
