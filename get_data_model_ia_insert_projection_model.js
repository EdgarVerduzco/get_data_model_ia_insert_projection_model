const {connectToSqlDatabase, databases, connectToOracleDatabase} = require("./databaseConnector");
const uri = 's3://data-forecast-model/csv/proyeccion-vs-real-20230907.csv'
const { sendReturnEmail, generateEmailContent } = require('./emailUtils');
const axios = require('axios');
const env = require('./env')
const messages = require('./messages')
const sql = require('mssql');

/**
 * Connects to multiple databases, fetches and processes the producer data.
 * This function initiates connections to specified databases, retrieves
 * producers' information with their receptions, then closes the connections.
 *
 * @throws Will throw an error if connecting to the databases, fetching the data,
 *         or closing the connections fail.
 */
async function fetchAndProcessData() {
    let pool, pool_trz;

    try {
        pool = await connectToSqlDatabase(databases.db_Aws);
        pool_trz = await connectToSqlDatabase(databases.db_Fk);
        const list_producer_with_receptions = await getDataWithReceptions(uri, pool_trz)

        const result = await validateEntriesWithAI(list_producer_with_receptions, uri, pool)

        const emailContent = generateEmailContent(result);
        await sendReturnEmail(emailContent, true);
    } catch (err) {
        await sendReturnEmail('Error al procesar datos: ' + err.message, false)
        console.log(err)
    } finally {
        if (pool) await pool.close();
        if (pool_trz) await pool_trz.close();
    }
}

/**
 * Retrieve producers' information with their receptions from the FK database.
 * This function fetches the details of producers, their fruits, and their orchards.
 *
 * @param {string} s3_path - URL of the last created CSV that might be used for reference or logging.
 * @param {object} pool - Database pool instance for executing the query.
 *
 * @returns {Promise<Array>} - Promise that resolves with the data retrieved from the FK database.
 * @throws Will throw an error if the query execution fails or if no data is found for the producers.
 */
async function getDataWithReceptions(s3_path, pool) {
    try {
        // check if record exists
        let existData = await pool.request().query(env.SCRIPTS.FK.GET_LIST_PRODUCER_WITH_RECEPTION)

        if (existData.recordset.length  == 0)
            throw messages.ERROR.NO_DATA_PRODUCERS

        return existData.recordset
    } catch (error) {
        throw error
    }
}

/**
 * Validates if the AI has data for each entry in the list of producers with receptions.
 *
 * @param {Array} list_producer_with_receptions - The list of producer data entries to validate.
 * @param {string} s3_path - The S3 path for reference.
 * @param {object} pool - Database pool instance for executing the query.
 *
 * @returns {Object} An object containing two arrays: 'successResponses' for successful AI data validations,
 *                   and 'failedResponses' for entries that encountered an error.
 */
async function validateEntriesWithAI(list_producer_with_receptions, s3_path, pool) {
    const successResponses = [];
    const failedResponses = [];
    let counter = 0;

    for (let dataEntry of list_producer_with_receptions) {
        const _post = {
            path: s3_path,
            season: "2023-2024",
            provider_code: dataEntry.ProducerOrchard,
            fruit_name: dataEntry.Fruit
        };

        try {
            const response = await axios.post(env.URL_IA_MODEL, _post);
            const data = JSON.parse(response.data.replaceAll('NaN', null));

            // Almacenamos primero en successResponses
            successResponses.push(data.input);

            try {
                // Aquí verificamos e insertamos si es necesario
                await VerifyExistData(data, pool);

                // Si hay un error, lo movemos a failedResponses
            } catch (e) {
                // Quitamos de successResponses
                successResponses.pop()
                failedResponses.push({
                    pr: _post.provider_code,
                    message: "DB operation failed",
                    errorDetails: e.message
                });
            }

        } catch (e) {
            failedResponses.push({
                pr: _post.provider_code,
                message: "not added",
                errorDetails: e.message
            });
        }

        counter++;
        console.log(`Process: ${counter} de ${list_producer_with_receptions.length}`);

    }

    return {
        successResponses,
        failedResponses
    };
}

/**
 * Verify if data from the AI model already exists in the database.
 *
 * If the data does not exist in the database, the function will call the InsertData
 * function to store the new data. If the data already exists or there is an error
 * during the insertion, the function will throw an error with the relevant details.
 *
 * @param {object} data - The data received from the AI model, structured with 'input' and 'output' fields.
 * @param {object} pool - Database pool instance for executing the query.
 * @returns {object} - If successful, returns the inserted data or a confirmation that the data already exists.
 * @throws {Error} - Throws an error if the data already exists or if there's an issue during insertion.
 */
async function VerifyExistData(data, pool) {
    // Pool to connect to the database

    try {
        // Check if the data record exists in the database
        let existData = await pool.request()
            .input('date_projection', sql.TYPES.VarChar, data.output['last-date'])
            .input('pr_producer', sql.TYPES.VarChar, data.input.provider_code.split('-')[0])
            .input('id_orchard', sql.TYPES.Int, data.input.provider_code.split('-')[1])
            .input('fruit_name', sql.TYPES.VarChar, data.input.fruit_name.toUpperCase())
            .query(env.SCRIPTS.AWS.SCRIPT_EXIST_PROJECTION);

        // If the data does not exist, insert it into the database
        if (existData.recordset.length === 0) {
            const result = await InsertData(data, pool);
            return result
        } else {
            throw new Error(messages.ERROR.DATA_ALREADY_EXISTS);
        }

    } catch (e) {
        throw e;  // Propagate the error for handling in the calling function
    }
}

/**
 * Inserts the provided data into the database.
 *
 * @param {object} data - The data object to be inserted, containing information for the projection.
 * @param {object} pool - The connection pool to the database.
 * @returns {Array<object>} - Returns the result of the insertion.
 * @throws Will throw an error if the insertion fails.
 */
async function InsertData(data, pool) {
    try {
        // Insert main data into DB
        const result_data = await pool.request()
            .input('date', sql.TYPES.VarChar, data.output['last-date'])
            .input('prod', sql.TYPES.VarChar, data.input.provider_code.split('-')[0])
            .input('id_orchard', sql.TYPES.Int, data.input.provider_code.split('-')[1])
            .input('fruit', sql.TYPES.VarChar, data.input.fruit_name.toUpperCase())
            .query(env.SCRIPTS.AWS.SCRIPT_INSERT_PROJECTION);

        const id_projection = result_data.recordset[0].ID;

        // Insert details into the database
        for (let i = 0; i < data.output['future-dates'].length; i++) {
            await pool.request()
                .input('id_projection', sql.TYPES.Int, id_projection)
                .input('future_date', sql.TYPES.VarChar, data.output['future-dates'][i])
                .input('human', sql.TYPES.Float, data.output['human-predictions'][i])
                .input('ia_model', sql.TYPES.Float, data.output['model-predictions'][i])
                .query(env.SCRIPTS.AWS.SCRIPT_INSERT_PROJECTION_DETAIL);
        }

        return result_data.recordset;
    } catch (e) {
        console.log(e);
        throw e;
    }
}

fetchAndProcessData();