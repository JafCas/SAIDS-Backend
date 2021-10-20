//DEFINICION DEL SERVIDOR
const express = require("express");
const cors = require("cors");
const app = express();

const axios = require("axios");

app.use(express.json());
//app.use(express.urlencoded({ extended: true }));

//settings **Configuracion del servidor
app.set('port', process.env.PORT || 4000);

//middlewares
app.use(cors()); //Permite que dos servidores intercambien datos
app.use(express.json()); //Envia archivos en formato json

//routes
app.use('/api/users', require('./routes/users'))
app.use('/api/records', require('./routes/records'))
app.use('/webhook', require('./twilio-webhook/dialogflowTwilioWebhook'))
app.use('/dialogflow-fulfillment', require('./dialogflow-fulfillment/webhook'))

module.exports = app;