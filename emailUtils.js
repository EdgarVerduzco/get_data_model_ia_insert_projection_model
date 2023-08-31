const messages = require("./messages");
const env = require("./env");
const AWS = require('aws-sdk');
const awsConfig = require('./aws-config.json');
AWS.config.update({
    accessKeyId: awsConfig.ACCESS_KEY_ID,
    secretAccessKey: awsConfig.SECRET_ACCESS_KEY,
    region: awsConfig.REGION
});

/**
 * Genera una tabla HTML con las respuestas exitosas.
 *
 * @param {Object} data - El objeto que contiene las respuestas exitosas y fallidas.
 * @returns {string} - La tabla HTML que representa las respuestas exitosas.
 */
function generateSuccessTable(data) {
    let tableHTML = '<table><thead><tr><th>Provider Code</th><th>Fruit Name</th></tr></thead><tbody>';

    for (const entry of data.successResponses) {
        tableHTML += `<tr>
            <td>${entry.provider_code}</td>
            <td>${entry.fruit_name}</td>
        </tr>`;
    }

    tableHTML += '</tbody></table>';
    return tableHTML;
}

/**
 * Genera una tabla HTML con las respuestas fallidas.
 *
 * @param {Object} data - El objeto que contiene las respuestas exitosas y fallidas.
 * @returns {string} - La tabla HTML que representa las respuestas fallidas.
 */
function generateFailedTable(data) {
    let tableHTML = '<table><thead><tr><th>Provider Code</th><th>Message</th><th>Error Details</th></tr></thead><tbody>';

    for (const entry of data.failedResponses) {
        tableHTML += `<tr>
            <td>${entry.pr}</td>
            <td>${entry.message}</td>
            <td>${entry.errorDetails}</td>
        </tr>`;
    }

    tableHTML += '</tbody></table>';
    return tableHTML;
}

/**
 * Genera el contenido HTML del mensaje basándose en las tablas de respuestas exitosas y fallidas.
 *
 * @param {Object} data - El objeto que contiene las respuestas exitosas y fallidas.
 * @returns {string} - El contenido HTML completo para ser insertado en el cuerpo del correo electrónico.
 */
function generateEmailContent(data) {
    const successTable = generateSuccessTable(data);
    const failedTable = generateFailedTable(data);

    const message = `
        <h3>Respuestas Exitosas</h3>
        ${successTable}
        <h3>Respuestas Fallidas</h3>
        ${failedTable}
    `;

    return message;
}

/**
 * Send an error email to the sender
 * @param {string} message - Error message to include in the email body
 * @param {boolean} isSuccess - Subject of the email
 * @param {boolean} isHtml - Whether the message body is in HTML format
 * @returns {Promise} - A promise that resolves when the email is sent
 */
async function sendReturnEmail(message, isSuccess, isHtml = true) {

    const html = env.HTML.BODY
        .replace('{{styles_email_complete}}', env.HTML.STYLES)
        .replace('{{fullYear}}', new Date().getFullYear())
        .replace('{{messageResult}}', message);

    try {
        const ses = new AWS.SES();

        const toAddresses = [env.EMAILS.EDGAR];

        // if (isSuccess) {
        //     toAddresses.push(env.EMAILS.PEDRO);
        // }

        await ses.sendEmail({
            Source: env.EMAILS.AWS,
            Destination: {
                ToAddresses: toAddresses,
            },
            Message: {
                Subject: {
                    Data: isSuccess ? messages.SUCCESS.PROCESSED_CORRECTLY : messages.ERROR.PROCESSED_CORRECTLY,
                },
                Body: {
                    [isHtml ? 'Html' : 'Text']: {
                        Data: html,
                    },
                },
            },
        }).promise();
    } catch (error) {
        console.error(messages.ERROR.ERROR_SENDING_SUCCESS_EMAIL + error);
        throw new Error(messages.ERROR.ERROR_SENDING_SUCCESS_EMAIL + error);
    }
}

module.exports = {
    sendReturnEmail,
    generateSuccessTable,
    generateFailedTable,
    generateEmailContent
};