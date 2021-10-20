/*
//DEFINICION DEL SERVIDOR
const express = require("express");
const cors = require("cors");
const app = express(); //Es el servidor
const dialogflow = require("./dialogflow");

//settings **Configuracion del servidor
app.set('port', process.env.PORT || 4000);

//middlewares
app.use(cors()); //Permite que dos servidores intercambien datos
app.use(express.json()); //Envia archivos en formato json

//routes
app.use('/api/users', require('./routes/users'))
app.use('/api/records', require('./routes/records'))

module.exports = app;
*/

// Supports ES6
// import { create, Whatsapp } from 'venom-bot';

/*const express = require("express");
const cors = require("cors");
const app = express(); //Es el servidor

const uuid = require("uuid");
const venom = require("venom-bot");
const dialogflow = require("./dialogflow");

//settings **Configuracion del servidor
app.set("port", process.env.PORT || 4000);

app.use(cors()); //Permite que dos servidores intercambien datos
app.use(express.json()); //Envia archivos en formato json
app.use(express.urlencoded({ extended: true }));

app.post("/webhook", function (req, res) {
  res.sendStatus(200);
  console.log("req =>", req.body);
});

const sessionIds = new Map();

venom
  .create()
  .then((client) => start(client))
  .catch((erro) => {
    console.log(erro);
  });

function start(client) {
  client.onMessage(async (message) => {
    setSessionAndUser(message.from);
    let session = sessionIds.get(message.from);
    //Se guarda en memoria pero se tiene que mover a base de datos
    let payload = await dialogflow.sendToDialogFlow(message.body, session);
    let responses = payload.fulfillmentMessages;
    for (const response of responses) {
      await sendMessageToWhastApp(client, message, response);
    }
    //console.log(message);
  });
}
function sendMessageToWhastApp(client, message, response) {
  return new Promise((resolve, reject) => {
    client
      .sendText(message.from, response.text.text[0])
      .then((result) => {
        console.log("Result: ", result); //return object success
        resolve(result);
      })
      .catch((erro) => {
        console.error("Error when sending: ", erro);
        reject(erro);
      });
  });
}

async function setSessionAndUser(senderId) {
  try {
    if (!sessionIds.has(senderId)) {
      sessionIds.set(senderId, uuid.v1());
    }
  } catch (error) {
    throw error;
  }
}
*/

const express = require("express");
const app = express();
const axios = require("axios");
const cors = require("cors");
const twilio = require("./twilio");
const dialogflow = require("./dialogflow");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/webhook", function (req, res) {
  res.send("Webhook workin'");
});

app.post("/webhook", async function (req, res) {
  console.log("req ->", req.body);
  //twilio.sendTextMessage(req.body.WaId, req.body.Body);
  let messageComesFromPhone = req.body.WaId;
  let receivedMessage = req.body.Body;

  let payload = await dialogflow.sendToDialogFlow(receivedMessage, "123123");
  let responses = payload.fulfillmentMessages;
  /*for (const response of responses) {
    await sendMessageToWhastApp(client, message, response);
  }*/
  for (const response of responses) {
    twilio.sendTextMessage(req.body.WaId, response.text.text[0]);
  }
  res.status(200).json({ ok: true, msg: "Mensaje enviado correctamente" });
});

/*async function sendMessageToWhastApp(phone, response) {
    let payload = await axios.post("")
}*/

app.listen(6000, () => {
  console.log("servidor montado en el puerto 6000");
});
