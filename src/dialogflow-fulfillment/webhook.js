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
    puntuacionFiltroDepresion,
    puntuacionTotalBAI,
    puntuacionTotalPHQ;

  if (registroParticipante === null) {
    preguntaAnsiedad_1 = "";
    preguntaAnsiedad_2 = "";
    preguntaDepresion_1 = "";
    preguntaDepresion_2 = "";
    puntuacionFiltroAnsiedad = "";
    puntuacionFiltroDepresion = "";
    puntuacionTotalBAI = "";
    puntuacionTotalPHQ = "";
  } else {
    preguntaAnsiedad_1 = registroParticipante.preguntaAnsiedad_1;
    preguntaAnsiedad_2 = registroParticipante.preguntaAnsiedad_2;
    preguntaDepresion_1 = registroParticipante.preguntaDepresion_1;
    preguntaDepresion_2 = registroParticipante.preguntaDepresion_2;
    puntuacionFiltroAnsiedad = registroParticipante.puntuacionFiltroAnsiedad;
    puntuacionFiltroDepresion = registroParticipante.puntuacionFiltroDepresion;
    puntuacionTotalBAI = registroParticipante.puntuacionTotalBAI;
    puntuacionTotalPHQ = registroParticipante.puntuacionTotalPHQ;
  }

  let puntuacionFiltroAnsiedad_1 = parseInt(preguntaAnsiedad_1, 10);
  let puntuacionFiltroAnsiedad_2 = parseInt(preguntaAnsiedad_2, 10);
  puntuacionFiltroAnsiedad =
    puntuacionFiltroAnsiedad_1 + puntuacionFiltroAnsiedad_2;
  let puntuacionFiltroDepresion_1 = parseInt(preguntaDepresion_1, 10);
  let puntuacionFiltroDepresion_2 = parseInt(preguntaDepresion_2, 10);
  puntuacionFiltroDepresion =
    puntuacionFiltroDepresion_1 + puntuacionFiltroDepresion_2;

  //Intent final dinamico

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

  function testNext(agent) {
    agent.add("Test del next intent");
  }

  let nextName = "";

  //------Toma de intent dependiendo de preguntas filtro------
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
  if (puntuacionFiltroAnsiedad <= 1 && puntuacionFiltroDepresion <= 1) {
    cuestionarioPorAplicar = "Ninguno";
    console.log("Toma el cuarto valor");
    nextName = "activar-intent-despedida";
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
  if (cuestionario === "Ninguno") {
    console.log("[webhook] no va ninguno porque no hay...", cuestionario);
  }

  function AplicarAnsiedad(agent) {
    agent.add("ansiedad confirmada");
    agent.setFollowupEvent({
      name: "activar-intent-despedida",
      parameters: { lastState: "aplicar-ansiedad" },
      languageCode: "es",
    });
  }

  if (cuestionario === "ambosCuestionarios") {
    function AplicarDepresion(agent) {
      agent.add("depresion confirmada de ambos");
      agent.setFollowupEvent({
        name: "aplicarAnsiedadEvent",
        parameters: { lastState: "aplicar-depresion" },
        languageCode: "es",
      });
    }
  } else {
    function AplicarDepresion(agent) {
      agent.add("depresion confirmada de la sola");
      agent.setFollowupEvent({
        name: "activar-intent-despedida",
        parameters: { lastState: "aplicar-depresion" },
        languageCode: "es",
      });
    }
  }

  let respuestaParaAnsiedad = "";
  if ( puntuacionTotalBAI <=7 ) { //Respuesta para ansiedad minima
    respuestaParaAnsiedad = "```Yo te veo bien, un poco de estrés en nuestro día a día es normal, pero nunca está de más poner atención a nuestros sentimientos, me alegra que estés bien, sigue así. 😉```";
  }
  if ( puntuacionTotalBAI >=8 && puntuacionTotalBAI <=15 ) { //Respuesta para ansiedad leve 
    respuestaParaAnsiedad = "```Respuesta para ansiedad leve```";
  }
  if ( puntuacionTotalBAI >=16 && puntuacionTotalBAI <=25 ) { //Respuesta para ansiedad moderada 
    respuestaParaAnsiedad = "```Respuesta para ansiedad moderada```";
  }
  if ( puntuacionTotalBAI >=26 && puntuacionTotalBAI <=63 ) { //Respuesta para ansiedad severa 
    respuestaParaAnsiedad = "```Respuesta para ansiedad severa```";
  }
  
  let respuestaParaDepresion = "";
  if ( puntuacionTotalPHQ <=4 ) { //Respuesta para ansiedad minima
    respuestaParaDepresion = "```respuesta para depresion minima```"
  }
  if ( puntuacionTotalPHQ >=5 && puntuacionTotalPHQ <=9 ) { //Respuesta para ansiedad leve 
    respuestaParaDepresion = "```Respuesta para depresion leve```";
  }
  if ( puntuacionTotalPHQ >=10 && puntuacionTotalPHQ <=17 ) { //Respuesta para ansiedad leve 
    respuestaParaDepresion = "```Respuesta para depresion moderada```";
  }
  if ( puntuacionTotalPHQ >=18 && puntuacionTotalPHQ <=27 ) { //Respuesta para ansiedad leve 
    respuestaParaDepresion = "```Respuesta para depresion severa```";
  }

  let responses = [respuestaParaAnsiedad, respuestaParaDepresion, "```Un especialista se pondra en contacto contigo pronto (Solo si eres de la UPIITA, y si me aprueban el PT)```"];

  // puntuacionTotalBAI
  // puntuacionTotalPHQ

  function aplicarCuestionario(agent) {
    // agent.add(responses);
  }

  function intentDespedida(agent) {
    agent.add(responses);
    // agent.add("Despedida");
  }

  function testIntent(agent) {
    agent.add("Test del nuevo intent");
    agent.setFollowupEvent({
      name: nextName,
      parameters: { lastState: "nueva-prueba" },
      languageCode: "es",
    });
  }

  function testParaArray(agent) {
    agent.add("arreglado confirmado");
    agent.setFollowupEvent({
      name: "activar-intent-despedida",
      parameters: { lastState: "array-test" },
      languageCode: "es",
    });
  }

  var intentMap = new Map();

  intentMap.set("webhookDemo", demo);
  intentMap.set("proseguir-cuestionarios", testIntent); // Siguiendo el flujo conversacional
  // intentMap.set("nueva-prueba", testIntent); //Probando
  intentMap.set("aplicar-ansiedad", AplicarAnsiedad);
  intentMap.set("aplicar-depresion", AplicarDepresion);
  intentMap.set("intent-despedida", intentDespedida);
  // intentMap.set("array-test", testParaArray);
  //if (intentE)
  //intentMap.set("webhookDemo", testIntent);
  //agent.contexts.set({ name: 'pruebaContext', lifespan: 2});

  agent.handleRequest(intentMap, testIntent);
});

console.log("funcionando el webhook del fulfillment");
//console.log("context: " + JSON.stringify())

module.exports = webhook;
