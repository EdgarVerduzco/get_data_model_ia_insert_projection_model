const oracledb = require('oracledb');
const sql = require('mssql');
const secretsManager = require('aws-sdk/clients/secretsmanager');
const env = require('./env');
const messages = require('./messages');

/**
 * Establishes a connection to the specified SQL database using the provided credentials.
 * @param {object} databaseInfo - Information about the database connection.
 * @returns {Promise<sql.ConnectionPool>} A Promise that resolves to the connected database pool.
 */
async function connectToSqlDatabase(databaseInfo) {
    try {
        const secretsManagerClient = new secretsManager({region: env.REGION});

        const secretResponse = await secretsManagerClient.getSecretValue({
            SecretId: databaseInfo.secretName,
        }).promise();

        const credentials = JSON.parse(secretResponse.SecretString);

        const commonConfig = {
            options: {
                encrypt: false,
                max: 3,
            },
            dialectOptions: {
                instanceName: 'SQLEXPRESS',
            },
        };

        const config = {
            ...commonConfig,
            user: credentials.user || credentials.username,
            password: credentials.password,
            server: credentials.server || credentials.url,
            database: credentials.name_database || credentials.database,
            dialect: 'mssql',
            connectionTimeout: 60000,
            requestTimeout: 60000
        };

        const pool = new sql.ConnectionPool(config);
        await pool.connect();

        return pool;
    } catch (error) {
        console.error(messages.ERROR.CONNECTION_OR_QUERY_PROBLEMS, error.message);
        throw error;
    }
}

/**
 * Establishes a connection to the specified Oracle database using the provided credentials.
 * @param {object} databaseInfo - Information about the database connection.
 * @returns {Promise<oracledb.Connection>} A Promise that resolves to the connected database connection.
 */
async function connectToOracleDatabase(databaseInfo) {
    try {
        const secretsManagerClient = new secretsManager({region: env.REGION});

        const secretResponse = await secretsManagerClient.getSecretValue({
            SecretId: databaseInfo.secretName,
        }).promise();

        const credentials = JSON.parse(secretResponse.SecretString);

        const config = {
            user: credentials.userName,
            password: credentials.password,
            connectString: `${credentials.host}:${credentials.port}/${credentials.serviceName}`,
        };

        const connection = await oracledb.getConnection(config);

        return connection;
    } catch (error) {
        console.error(messages.ERROR.CONNECTION_OR_QUERY_PROBLEMS, error.message);
        throw error;
    }
}

/**
 * Database connection information for different databases.
 */
const databases = {
    db_Fk: {
        secretName: env.SECRET_MANAGER.CONNECTION_DB_FK,
        connectionFunction: connectToSqlDatabase,
    },
    db_Aws: {
        secretName: env.SECRET_MANAGER.CONNECTION_DB_AWS,
        connectionFunction: connectToSqlDatabase,
    },
    db_Famous: {
        secretName: env.SECRET_MANAGER.CONNECTION_DB_FAMOUS,
        connectionFunction: connectToOracleDatabase,
    },
};

module.exports = {
    databases,
    connectToSqlDatabase,
    connectToOracleDatabase,
};