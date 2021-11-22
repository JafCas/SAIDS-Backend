/*
 * AQUI SE HACE LA INTERACCIÓN TWILIO-DIALOGFLOW
 */
const dialogflow = require("dialogflow");
const config = require("./config");

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
    //console.log(JSON.stringify(result, null, " "));
    return result;
    // console.log("se enviara el resultado: ", result);
  } catch (e) {
    console.log("error");
    console.log(e);
  }
}

module.exports = {
  sendToDialogFlow,
  testIntent,
};
