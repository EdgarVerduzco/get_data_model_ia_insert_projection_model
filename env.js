'use strict';
//#region Scripts
const insert_projection = `
INSERT INTO Projection (date_projection, pr_producer, id_fruit, id_orchard)
OUTPUT Inserted.ID
VALUES (@date, @prod, (SELECT id FROM IA_Projection.dbo.Fruits WHERE fuit_name = @fruit), @id_orchard);
`

const insert_projection_detail = `
INSERT INTO Projection_Detail (id_projection, future_date, human, ia_model)
OUTPUT Inserted.ID
VALUES (@id_projection, @future_date, @human, @ia_model);
`

const get_list_producer_with_reception = `
SELECT DISTINCT
    prod.CardCodeSAP + '-' + CAST(huerto.idSAP AS varchar(10)) AS ProducerOrchard,
    CASE
        WHEN pres.Organico = 'Y' THEN UPPER(cul.[Desc] + ' ORG')
        ELSE UPPER(cul.[Desc])
    END AS Fruit
FROM Trazabilidad.dbo.Recepcion rec
INNER JOIN Trazabilidad.dbo.Productores prod ON prod.id = rec.idProductor
INNER JOIN Trazabilidad.dbo.Huerto huerto ON prod.id = huerto.idProductor
INNER JOIN Trazabilidad.dbo.Presentacion pres ON pres.id = rec.idPresentacion
INNER JOIN Trazabilidad.dbo.Cultivo cul ON cul.id = pres.idCultivo
WHERE YEAR(rec.FechaRecepcion) = YEAR(GETDATE())
`

const exist_projection = `
SELECT id
FROM IA_Projection.dbo.Projection
WHERE date_projection = @date_projection
  AND pr_producer = @pr_producer
  AND id_orchard = @id_orchard
  AND id_fruit = (SELECT id FROM IA_Projection.dbo.Fruits WHERE fuit_name = @fruit_name);
`

//#endregion

//#region Styles
const emailStyles = `
    <style>
        /* Estilos generales */
        body {
            font-family: "Arial", sans-serif;
            line-height: 1.6;
            background-color: #f9f9f9;
            margin: 0;
        }

        /* Estilos para el encabezado */
        .header {
            background-color: #004080;
            color: #ffffff;
            text-align: center;
            padding: 20px;
        }

        .table-container {
            margin-bottom: 20px;
        }
    
        .logo {
            width: 50px;
            height: 50px;
            vertical-align: middle;
        }

        .title {
            font-size: 24px;
            vertical-align: middle;
            margin-left: 10px;
        }

        /* Estilos para el contenido */
        .content {
            border: 1px solid #cccccc;
            background-color: #ffffff;
            padding: 20px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            border-radius: 5px;
            margin: 20px 0;
        }

        /* Estilos para el pie de página */
        .footer {
            text-align: center;
            padding: 20px;
            color: #888888;
        }

        .footer a {
            color: #004080;
            text-decoration: none;
        }

        /* Estilos para las tablas */
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }

        th, td {
            border: 1px solid #cccccc;
            padding: 10px;
            text-align: left;
        }

        th {
            background-color: #f2f2f2;
            font-weight: bold;
        }

        .highlight {
            font-weight: bold;
            color: #004080;
        }
    </style>
`;
//#endregion

//#region HTML
const email_template_success = `
<html>
<head>
    {{styles_email_complete}}
</head>
<body>
    <div class="header">
        <img src="https://www.tiveg.com/images/tiveg-icon.svg" alt="Tiveg Icon" class="logo">
        <span class="title">Resultados de Validación de Datos por IA</span>
    </div>
    <div class="container">
        <div class="content">
            <p class="greeting">Estimado(a) <span class="highlight">Usuario</span>,</p>
            <p class="message">Nuestro sistema de inteligencia artificial ha completado la curva de la semana actual.</p>
            
            <p class="error-heading"><span class="highlight">Este es el resultado:</span></p>
            {{messageResult}}

            <p class="thanks">Le agradecemos su colaboración y confianza en nuestros servicios.</p>
            
            <div class="error-details-table">
            </div>
            <p class="thanks">Gracias por colaborar con nosotros.</p>
        </div>
    </div>
    <div class="footer">
        <p class="signature">© {{fullYear}} Tiveg. Todos los derechos reservados.</p>
        <p class="more-info">Para obtener más información, visita <a href="https://www.tiveg.com">www.tiveg.com</a></p>
    </div>
</body>
</html>
`
//#endregion

module.exports = {
    SCRIPTS: {
        AWS: {
            SCRIPT_EXIST_PROJECTION: exist_projection,
            SCRIPT_INSERT_PROJECTION: insert_projection,
            SCRIPT_INSERT_PROJECTION_DETAIL: insert_projection_detail,

        },
        FK: {
            GET_LIST_PRODUCER_WITH_RECEPTION: get_list_producer_with_reception
        }
    },
    EMAILS: {
        AWS: 'email_projection@projection-tiveg.awsapps.com',
        PEDRO: 'pedro.mayorga@tiveg.com,',
        EDGAR: 'edgar.verduzco@tiveg.com',
    },
    URL_IA_MODEL: 'https://itzs15wy50.execute-api.us-east-1.amazonaws.com/Prod/hello/',
    HTML:{
        STYLES: emailStyles,
        BODY: email_template_success,
    },
    SECRET_MANAGER: {
        CONNECTION_DB_AWS: 'aws_database_credentials',
        CONNECTION_DB_FK: 'fk_database_credentials',
        CONNECTION_DB_FAMOUS: 'famous_database_credentials'
    },
    REGION: "us-east-1"
}