//DEFINICION DEL SERVIDOR
const express = require("express");
const cors = require("cors");
const app = express();
const twilio = require("./twilio");
const dialogflow = require("./dialogflow");
const uuid = require("uuid");

const axios = require("axios");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionIds = new Map();

//settings **Configuracion del servidor
app.set('port', process.env.PORT || 4000);

//middlewares
app.use(cors()); //Permite que dos servidores intercambien datos
app.use(express.json()); //Envia archivos en formato json

//routes
app.use('/api/users', require('./routes/users'))
app.use('/api/records', require('./routes/records'))

app.get("/webhook", function (req, res) {
  res.send("Webhook workin'");
});

app.post("/webhook", async function (req, res) {
  console.log("req ->", req.body);
  let messageComesFromPhone = req.body.WaId;
  let receivedMessage = req.body.Body;

  setSessionAndUser(messageComesFromPhone);
  let session = sessionIds.get(messageComesFromPhone);
  //TODO: Se guarda en memoria pero se tiene que mover a base de datos
  let payload = await dialogflow.sendToDialogFlow(receivedMessage, session);
  let responses = payload.fulfillmentMessages;
  for (const response of responses) {
    await twilio.sendTextMessage(req.body.WaId, response.text.text[0]);
  }
  res.status(200).json({ ok: true, msg: "Mensaje enviado correctamente" });
});

async function setSessionAndUser(senderId) {
  try {
    if (!sessionIds.has(senderId)) {
      sessionIds.set(senderId, uuid.v1());
    }
  } catch (error) {
    throw error;
  }
}

module.exports = app;