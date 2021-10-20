const express = require("express");
const webhook = express();
const dfff = require('dialogflow-fulfillment');

webhook.get('/', (req, res) => {
    res.send("El servidor del webhook está vivo")
});

webhook.post('/', express.json(), (req, res) => {
    const agent = new dfff.WebhookClient({
        request: req,
        response: res
    });

    function demo(agent){
        agent.add("Respuesta enviada desde el servidor webhook");
    }

    var intentMap = new Map();

    intentMap.set("webhookDemo", demo)

    agent.handleRequest(intentMap);
});

console.log("funcionando el webhook del fulfillment")

module.exports = webhook;