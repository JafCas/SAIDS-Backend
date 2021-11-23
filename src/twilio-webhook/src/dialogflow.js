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
        let WaID = process.env.ID_PASADO;
        const WaNumber = process.env.WA_NUMBER;
        await participanteSchema.findOneAndUpdate({WaNumber : WaNumber}, newParticipante);

        //await axios.post("http://localhost:4000/api/participantes" , newParticipante);
        console.log("[/**MANDADOS A LA DATABASE**/]: ");
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
