/*
 * AQUI SE HACE LA INTERACCIÓN TWILIO-DIALOGFLOW
 */
const dialogflow = require("dialogflow");
const config = require("./config");
const axios = require("axios");

const participanteSchema = require("../../models/Participante");

const credentials = {
  client_email: config.GOOGLE_CLIENT_EMAIL,
  private_key: config.GOOGLE_PRIVATE_KEY,
};

const sessionClient = new dialogflow.SessionsClient({
  projectId: config.GOOGLE_PROJECT_ID,
  credentials,
});

var testIntent = "Hola";

/**
 * Send a query to the dialogflow agent, and return the query result.
 * @param {string} projectId The project to be used
 */
async function sendToDialogFlow(msg, session, params) {
  let textToDialogFlow = msg;
  try {
    const sessionPath = sessionClient.sessionPath(
      config.GOOGLE_PROJECT_ID,
      session
    );

    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          text: textToDialogFlow,
          languageCode: config.DF_LANGUAGE_CODE,
        },
      },
      queryParams: {
        payload: {
          data: params,
        },
      },
    };
    const responses = await sessionClient.detectIntent(request);
    const result = responses[0].queryResult;
    let intentEmparejado = result.intent.displayName;
    console.log("INTENT EMPAREJADO: ", intentEmparejado);

    //Si el webhook al que se llegó es el deseado se ejecuta algo
    if (intentEmparejado === "webhookDemo") {
      testIntent = intentEmparejado;
      process.env.INTENT_EMPAREJADO = intentEmparejado;
      console.log("[Dialogflow] Todo bien");
      console.log("test: ", testIntent);
    } else {
      console.log("nada por aca");
      process.env.INTENT_EMPAREJADO = "";
    }

    let defaultResponses = [];
    if (result.action !== "input.unknown") {
      result.fulfillmentMessages.forEach((element) => {});
    }
    if (defaultResponses.length === 0) {
      result.fulfillmentMessages.forEach((element) => {
        if (element.platform === "PLATFORM_UNSPECIFIED") {
          defaultResponses.push(element);
        }
      });
    }
    result.fulfillmentMessages = defaultResponses;
    //Muestra detalles de la comunicacion con DF
    //console.log(JSON.stringify(result, null, " "));

    //Checa si ya existe el registro para este numero de whats
    const Wa_Number = process.env.WA_NUMBER;
    let WaID = process.env.ID_PASADO;
    console.log("El WA_NUMBER que recibe: ", Wa_Number);
    const yaExiste = await participanteSchema.findOne({
      WaNumber: Wa_Number,
    });

    console.log("[/**LA ACCION**/]: ", result.action);
    if (
      result.action ===
      "DefaultWelcomeIntent.DefaultWelcomeIntent-custom.iniciar-custom"
    ) {
      console.log("[DIALOGFLOW] WaNumber: ", process.env.WA_NUMBER);
      if (
        result.parameters.fields.nombreParticipante.stringValue !== "" &&
        result.parameters.fields.apellidoParticipante.stringValue !== "" &&
        result.parameters.fields.edadParticipante.numberValue !== "" &&
        result.parameters.fields.emailParticipante.stringValue !== ""
      ) {
        const newParticipante = {
          nombresParticipante:
            result.parameters.fields.nombreParticipante.stringValue,
          apellidoParticipante:
            result.parameters.fields.apellidoParticipante.stringValue,
          edadParticipante:
            result.parameters.fields.edadParticipante.numberValue,
          emailParticipante:
            result.parameters.fields.emailParticipante.stringValue,
        };
        if (yaExiste !== null) {
          //Encuentra el registro de la base de datos y lo actualiza
          await participanteSchema.findOneAndUpdate(
            { WaNumber: Wa_Number },
            newParticipante
          );
          console.log("[Dialogflow] /**ACTUALIZADO**/: ");
        } else {
          console.log("[Dialogflow] /**NO EXISTIA PERO YA LO CREÉ**/: ");
          await axios.post("http://localhost:4000/api/participantes", {
            WaID: WaID,
            WaNumber: Wa_Number,
          });
        }

        //await axios.post("http://localhost:4000/api/participantes" , newParticipante);
        console.log("[/**MANDADOS A LA DATABASE**/]: ");
      }
    }
    if (
      //Si la acción actual es ...inicio-preguntas-filtro... => Ejecuta lo siguiente
      result.action ===
      "DefaultWelcomeIntent.DefaultWelcomeIntent-custom.iniciar-custom.iniciar-datos-custom.inicio-preguntas-filtro-custom"
    ) {
      if (
        result.parameters.fields.preguntaAnsiedad_1.stringValue !== "" && //Si el valor del campo preguntaAnsiedad_1 NO es vacío Y
        result.parameters.fields.preguntaAnsiedad_2.stringValue !== "" && //Si el valor del campo preguntaAnsiedad_2 NO es vacío Y
        result.parameters.fields.preguntaDepresion_1.stringValue !== "" && //Si el valor del campo preguntaDepresion_1 NO es vacío Y
        result.parameters.fields.preguntaDepresion_2.numberValue !== "" //Si el valor del campo preguntaDepresion_2 NO es vacío
      ) {
        // Ejecuta lo siguiente
        const respuestasParticipante = {
          //Se crea un arreglo de valores que contiene lo siguiente
          //El valor de preguntaAnsiedad_1 será el valor del campo obtenido de la conversación
          preguntaAnsiedad_1:
            result.parameters.fields.preguntaAnsiedad_1.stringValue,
          //El valor de preguntaAnsiedad_2 será el valor del campo obtenido de la conversación
          preguntaAnsiedad_2:
            result.parameters.fields.preguntaAnsiedad_2.stringValue,
          //El valor de preguntaDepresion_1 será el valor del campo obtenido de la conversación
          preguntaDepresion_1:
            result.parameters.fields.preguntaDepresion_1.stringValue,
          //El valor de preguntaDepresion_2 será el valor del campo obtenido de la conversación
          preguntaDepresion_2:
            result.parameters.fields.preguntaDepresion_2.stringValue,
        };
        //if (yaExiste !== null) {
        await participanteSchema.findOneAndUpdate(
          //Busca en la base de datos y actualiza
          { WaNumber: Wa_Number }, //Un registro cuyo Número de WhatsApp sea igual al Número de WhatsApp con el que se está conversando actualmente
          respuestasParticipante //Actualiza los valores agregando el contenido del arreglo de la linea 138
        );
        console.log(
          "[Dialogflow] /**ACTUALIZADOS REGISTROS DE RESPUESTAS**/: "
        );
        //}
      }
    }

    return result;
    //console.log("se enviara el resultado: ", result);
  } catch (e) {
    console.log("error");
    console.log(e);
  }
}

module.exports = {
  sendToDialogFlow,
  testIntent,
};
