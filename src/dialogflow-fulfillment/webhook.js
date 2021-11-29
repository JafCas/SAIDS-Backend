const express = require("express");
const webhook = express();
const dfff = require("dialogflow-fulfillment");
const participanteSchema = require("../models/Participante");

webhook.get("/", (req, res) => {
  res.send("El servidor del webhook está vivo");
});

webhook.post("/", express.json(), async (req, res) => {
  const agent = new dfff.WebhookClient({
    request: req,
    response: res,
  });

  let registroParticipante = await participanteSchema.findOne({
    /**
     * Encuentra un registro donde el número de WhatsApp sea igual al
     * número del cual vienen los mensajes de esta conversación
     */
    WaNumber: messageComesFromPhone,
  });

  let preguntaAnsiedad_1,
    preguntaAnsiedad_2,
    preguntaDepresion_1,
    preguntaDepresion_2,
    puntuacionFiltroAnsiedad,
    puntuacionFiltroDepresion;

  if (registroParticipante === null) {
    preguntaAnsiedad_1 = "";
    preguntaAnsiedad_2 = "";
    preguntaDepresion_1 = "";
    preguntaDepresion_2 = "";
    puntuacionFiltroAnsiedad = "";
    puntuacionFiltroDepresion = "";
  } else {
    preguntaAnsiedad_1 = registroParticipante.preguntaAnsiedad_1;
    preguntaAnsiedad_2 = registroParticipante.preguntaAnsiedad_2;
    preguntaDepresion_1 = registroParticipante.preguntaDepresion_1;
    preguntaDepresion_2 = registroParticipante.preguntaDepresion_2;
    puntuacionFiltroAnsiedad = registroParticipante.puntuacionFiltroAnsiedad;
    puntuacionFiltroDepresion = registroParticipante.puntuacionFiltroDepresion;
  }

  let puntuacionFiltroAnsiedad_1 = parseInt(preguntaAnsiedad_1, 10);
  let puntuacionFiltroAnsiedad_2 = parseInt(preguntaAnsiedad_2, 10);
  puntuacionFiltroAnsiedad =
    puntuacionFiltroAnsiedad_1 + puntuacionFiltroAnsiedad_2;
  let puntuacionFiltroDepresion_1 = parseInt(preguntaDepresion_1, 10);
  let puntuacionFiltroDepresion_2 = parseInt(preguntaDepresion_2, 10);
  puntuacionFiltroDepresion =
    puntuacionFiltroDepresion_1 + puntuacionFiltroDepresion_2;

  function demo(agent) {
    agent.add("Respuesta enviada desde el servidor webhookkk");
    // agent.context.set({ name: "pruebaContext", lifespan: 2 });
    // agent.context.set({ name: "pruebaContext", lifespan: 2 });
    // agent.setFollowupEvent({
    //   name: "pruebaContextEvent",
    //   parameters: { lastState: "webhookDemo" },
    //   languageCode: "es",
    // });
  }

  let nextName = "";

  if (puntuacionFiltroAnsiedad >= 2 && puntuacionFiltroDepresion >= 2) {
    cuestionarioPorAplicar = "ambosCuestionarios";
    // cuestionarioPorAplicar = "depresionCuestionario";
    console.log("toma el primer valor");
    //nextName = "aplicarAmbosEvent";
    nextName = "aplicarDepresionEvent";
  }
  if (puntuacionFiltroAnsiedad >= 2 && puntuacionFiltroDepresion <= 1) {
    cuestionarioPorAplicar = "ansiedadCuestionario";
    console.log("toma el segundo valor");
    nextName = "aplicarAnsiedadEvent";
  }
  if (puntuacionFiltroAnsiedad <= 1 && puntuacionFiltroDepresion >= 2) {
    cuestionarioPorAplicar = "depresionCuestionario";
    console.log("toma el tercer valor");
    nextName = "aplicarDepresionEvent";
  }

  let cuestionario = cuestionarioPorAplicar;

  if (cuestionario === "ambosCuestionarios") {
    console.log("[webhook] van ambos", cuestionario);
    //nextName = "aplicarAnsiedadEvent";
  }
  if (cuestionario === "ansiedadCuestionario") {
    console.log("[webhook] va ansiedad", cuestionario);
    // intentMap.set("aplicar-ansiedad", AplicarAnsiedad);
  }
  if (cuestionario === "depresionCuestionario") {
    console.log("[webhook] va depresion", cuestionario);
    // intentMap.set("aplicar-depresion", AplicarDepresion);
  }

  function AplicarAnsiedad(agent) {
    agent.add("ansiedad confirmada");
  }

  if (cuestionario === "ambosCuestionarios") {
    function AplicarDepresion(agent) {
      agent.add("depresion confirmada de ambos");
      // nextName = "aplicarAnsiedadEvent";
      agent.setFollowupEvent({
        name: "aplicarAnsiedadEvent",
        parameters: { lastState: "aplicar-depresion" },
        languageCode: "es",
      });
    }
  } else {
    function AplicarDepresion(agent) {
      agent.add("depresion confirmada de la sola");
    }
  }
  // function AplicarAmbos(agent) {
  //   agent.add("Va el siguiente");
  // }

  function aplicarCuestionario(agent) {
    agent.setFollowupEvent({
      name: "aplicarDepresionEvent",
      parameters: { lastState: "nueva-prueba" },
      languageCode: "es",
    });
  }

  function testIntent(agent) {
    agent.add("Test del nuevo intent");
    agent.setFollowupEvent({
      name: nextName,
      parameters: { lastState: "nueva-prueba" },
      languageCode: "es",
    });
  }

  var intentMap = new Map();

  intentMap.set("webhookDemo", demo);
  // intentMap.set("proseguir-cuestionarios", testIntent); // Siguiendo el flujo conversacional
  intentMap.set("nueva-prueba", testIntent); //Probando
  intentMap.set("aplicar-ansiedad", AplicarAnsiedad);
  intentMap.set("aplicar-depresion", AplicarDepresion);
  //if (intentE)
  //intentMap.set("webhookDemo", testIntent);
  //agent.contexts.set({ name: 'pruebaContext', lifespan: 2});

  agent.handleRequest(intentMap, testIntent);
});

console.log("funcionando el webhook del fulfillment");
//console.log("context: " + JSON.stringify())

module.exports = webhook;
