/**
 * Aquí se hace todo lo de WhatsApp-Twilio
 */
const express = require("express");
const dialogflowTwilioWebhook = express();
const twilio = require("./src/twilio");
const dialogflow = require("./src/dialogflow");
const uuid = require("uuid");
const PdfPrinter = require("pdfmake");
const fs = require("fs");
const axios = require("axios");
const participanteSchema = require("../models/Participante");
const { Base64Encode } = require("base64-stream");
const merge = require("easy-pdf-merge");

//De AWS
const S3 = require("aws-sdk/clients/s3");
const region = process.env.AWS_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY;
const secretAccessKey = process.env.AWS_SECRET_KEY;

const fonts = require("./pdf/components/fonts");
const styles = require("./pdf/components/styles");
const { content } = require("./pdf/components/pdfContent");
const { sendToDialogFlow } = require("./src/dialogflow");
const { testIntent } = require("./src/dialogflow");

const sessionIds = new Map();

dialogflowTwilioWebhook.use(express.urlencoded({ extended: true }));

dialogflowTwilioWebhook.get("/", function (req, res) {
  res.send("Webhook workin'");
});

const storage = new S3({
  region,
  accessKeyId,
  secretAccessKey,
});

dialogflowTwilioWebhook.post("/", async function (req, res) {
  console.log("[dialogflowTwilioWebhook] req ->", req.body);
  messageComesFromPhone = req.body.WaId;
  let receivedMessage = req.body.Body;

  setSessionAndUser(messageComesFromPhone);
  let session = sessionIds.get(messageComesFromPhone);
  //TODO: Se guarda en memoria pero se tiene que mover a base de datos
  console.log("[/**SESSION**/: ]", session);
  let payload = await dialogflow.sendToDialogFlow(receivedMessage, session);
  let responses = payload.fulfillmentMessages;

  //Recupera registros de la base de datos
  let registroParticipante = await participanteSchema.findOne({
    /**
     * Encuentra un registro donde el número de WhatsApp sea igual al
     * número del cual vienen los mensajes de esta conversación
     */
    WaNumber: messageComesFromPhone,
  });

  //Declara los valores que esperas de la base de datos para su uso localmente
  let nombresParticipante,
    apellidoParticipante,
    edadParticipante,
    emailParticipante,
    fechaParticipacion,
    preguntaAnsiedad_1,
    preguntaAnsiedad_2,
    preguntaDepresion_1,
    preguntaDepresion_2,
    ansiedadFileLink,
    puntuacionFiltroAnsiedad,
    puntuacionFiltroDepresion,
    puntuacionCuestionarioBAI,
    puntuacionCuestionarioPHQ;
  //Si no existe un registro de participante que cumpla con la función anterior
  if (registroParticipante === null) {
    //Vuelve vacíos todos los valores
    nombresParticipante = "";
    apellidoParticipante = "";
    edadParticipante = "";
    emailParticipante = "";
    fechaParticipacion = "";
    preguntaAnsiedad_1 = "";
    preguntaAnsiedad_2 = "";
    preguntaDepresion_1 = "";
    preguntaDepresion_2 = "";
    ansiedadFileLink = "";
    puntuacionFiltroAnsiedad = "";
    puntuacionFiltroDepresion = "";
    puntuacionCuestionarioBAI = [""];
    puntuacionCuestionarioPHQ = [""];
  } else {
    //Si sí existen valores con esa condición
    //Asigna los valores locales a los obtenidos por la base de datos
    nombresParticipante = registroParticipante.nombresParticipante;
    apellidoParticipante = registroParticipante.apellidoParticipante;
    edadParticipante = registroParticipante.edadParticipante;
    emailParticipante = registroParticipante.emailParticipante;
    fechaParticipacion = registroParticipante.updatedAt;
    preguntaAnsiedad_1 = registroParticipante.preguntaAnsiedad_1;
    preguntaAnsiedad_2 = registroParticipante.preguntaAnsiedad_2;
    preguntaDepresion_1 = registroParticipante.preguntaDepresion_1;
    preguntaDepresion_2 = registroParticipante.preguntaDepresion_2;
    ansiedadFileLink = registroParticipante.ansiedadFileLink;
    puntuacionFiltroAnsiedad = registroParticipante.puntuacionFiltroAnsiedad;
    puntuacionFiltroDepresion = registroParticipante.puntuacionFiltroDepresion;
    puntuacionCuestionarioBAI = registroParticipante.puntuacionCuestionarioBAI;
    puntuacionCuestionarioPHQ = registroParticipante.puntuacionCuestionarioPHQ;
  }

  //Suma de Puntuaciones Filtro
  let puntuacionFiltroAnsiedad_1 = parseInt(preguntaAnsiedad_1, 10);
  let puntuacionFiltroAnsiedad_2 = parseInt(preguntaAnsiedad_2, 10);
  puntuacionFiltroAnsiedad =
    puntuacionFiltroAnsiedad_1 + puntuacionFiltroAnsiedad_2;
  let puntuacionFiltroDepresion_1 = parseInt(preguntaDepresion_1, 10);
  let puntuacionFiltroDepresion_2 = parseInt(preguntaDepresion_2, 10);
  puntuacionFiltroDepresion =
    puntuacionFiltroDepresion_1 + puntuacionFiltroDepresion_2;

  //Formateo para archivo pdf
  let nombreCompletoParticipante = [nombresParticipante, apellidoParticipante];
  nombreCompletoParticipante = nombreCompletoParticipante.join(" ");
  let edadCompletaParticipante = [edadParticipante, "años"];
  edadCompletaParticipante = edadCompletaParticipante.join(" ");
  let nombreEdadParticipante = [
    nombreCompletoParticipante,
    edadCompletaParticipante,
  ];
  nombreEdadParticipante = nombreEdadParticipante.join("\n");
  let fechaParticipacionOnly = "";
  let fechaParticipacionCorta = "";
  if (fechaParticipacion !== "") {
    fechaParticipacionOnly =
      (fechaParticipacion.getDate() > 9
        ? fechaParticipacion.getDate()
        : "0" + fechaParticipacion.getDate()) +
      "/" +
      (fechaParticipacion.getMonth() > 8
        ? fechaParticipacion.getMonth() + 1
        : "0" + (fechaParticipacion.getMonth() + 1)) +
      "/" +
      fechaParticipacion.getFullYear();
      fechaParticipacionCorta = fechaParticipacionOnly;
  }
  fechaParticipacionOnly = [
    "\nFecha de participación:",
    fechaParticipacionOnly,
    "\n",
  ];
  fechaParticipacionOnly = fechaParticipacionOnly.join(" ");

  /** PUNTUACIONES FILTRO */
  let decorationAnsiedad0 = "",
    decorationAnsiedad1 = "",
    decorationAnsiedad2 = "",
    decorationAnsiedad3 = "";
  let boldAnsiedad0 = false,
    boldAnsiedad1 = false,
    boldAnsiedad2 = false,
    boldAnsiedad3 = false;

  switch (preguntaAnsiedad_1) {
    case "0":
      decorationAnsiedad0 = "underline";
      boldAnsiedad0 = true;
      break;
    case "1":
      decorationAnsiedad1 = "underline";
      boldAnsiedad1 = true;
      break;
    case "2":
      decorationAnsiedad2 = "underline";
      boldAnsiedad2 = true;
      break;
    case "3":
      decorationAnsiedad3 = "underline";
      boldAnsiedad3 = true;
      break;
  }

  let decorationAnsiedad0_2 = "",
    decorationAnsiedad1_2 = "",
    decorationAnsiedad2_2 = "",
    decorationAnsiedad3_2 = "";
  let boldAnsiedad0_2 = false,
    boldAnsiedad1_2 = false,
    boldAnsiedad2_2 = false,
    boldAnsiedad3_2 = false;

  switch (preguntaAnsiedad_2) {
    case "0":
      decorationAnsiedad0_2 = "underline";
      boldAnsiedad0_2 = true;
      break;
    case "1":
      decorationAnsiedad1_2 = "underline";
      boldAnsiedad1_2 = true;
      break;
    case "2":
      decorationAnsiedad2_2 = "underline";
      boldAnsiedad2_2 = true;
      break;
    case "3":
      decorationAnsiedad3_2 = "underline";
      boldAnsiedad3_2 = true;
      break;
  }

  let decorationDepresion0_1 = "",
    decorationDepresion1_1 = "",
    decorationDepresion2_1 = "",
    decorationDepresion3_1 = "";
  let boldDepresion0_1 = false,
    boldDepresion1_1 = false,
    boldDepresion2_1 = false,
    boldDepresion3_1 = false;

  switch (preguntaDepresion_1) {
    case "0":
      decorationDepresion0_1 = "underline";
      boldDepresion0_1 = true;
      break;
    case "1":
      decorationDepresion1_1 = "underline";
      boldDepresion1_1 = true;
      break;
    case "2":
      decorationDepresion2_1 = "underline";
      boldDepresion2_1 = true;
      break;
    case "3":
      decorationDepresion3_1 = "underline";
      boldDepresion3_1 = true;
      break;
  }

  let decorationDepresion0_2 = "",
    decorationDepresion1_2 = "",
    decorationDepresion2_2 = "",
    decorationDepresion3_2 = "";
  let boldDepresion0_2 = false,
    boldDepresion1_2 = false,
    boldDepresion2_2 = false,
    boldDepresion3_2 = false;

  switch (preguntaDepresion_2) {
    case "0":
      decorationDepresion0_2 = "underline";
      boldDepresion0_2 = true;
      break;
    case "1":
      decorationDepresion1_2 = "underline";
      boldDepresion1_2 = true;
      break;
    case "2":
      decorationDepresion2_2 = "underline";
      boldDepresion2_2 = true;
      break;
    case "3":
      decorationDepresion3_2 = "underline";
      boldDepresion3_2 = true;
      break;
  }

  //-------------PUNTUACIONES DEL PHQ-------------

  //SI la puntuacion de las preguntas filtro del BAI son mayores a 1
  // if (puntuacionFiltroAnsiedad >= 2) {
  //   puntuacionCuestionarioBAI = registroParticipante.puntuacionCuestionarioBAI;
  // }

  //SI la puntuacion de las preguntas filtro del PHQ son mayores a 1
  // if (puntuacionFiltroDepresion >= 2) {
  //   puntuacionCuestionarioPHQ = registroParticipante.puntuacionCuestionarioPHQ;
  // }

  //Pregunta 1 del PHQ9
  let decorationPHQ0_1 = "",
    decorationPHQ1_1 = "",
    decorationPHQ2_1 = "",
    decorationPHQ3_1 = "";
  let boldPHQ0_1 = false,
    boldPHQ1_1 = false,
    boldPHQ2_1 = false,
    boldPHQ3_1 = false;

  //Pregunta 2 del PHQ9
  let decorationPHQ0_2 = "",
    decorationPHQ1_2 = "",
    decorationPHQ2_2 = "",
    decorationPHQ3_2 = "";
  let boldPHQ0_2 = false,
    boldPHQ1_2 = false,
    boldPHQ2_2 = false,
    boldPHQ3_2 = false;

  //Pregunta 3 del PHQ9
  let decorationPHQ0_3 = "",
    decorationPHQ1_3 = "",
    decorationPHQ2_3 = "",
    decorationPHQ3_3 = "";
  let boldPHQ0_3 = false,
    boldPHQ1_3 = false,
    boldPHQ2_3 = false,
    boldPHQ3_3 = false;

  //Pregunta 4 del PHQ9
  let decorationPHQ0_4 = "",
    decorationPHQ1_4 = "",
    decorationPHQ2_4 = "",
    decorationPHQ3_4 = "";
  let boldPHQ0_4 = false,
    boldPHQ1_4 = false,
    boldPHQ2_4 = false,
    boldPHQ3_4 = false;

  //Pregunta 5 del PHQ9
  let decorationPHQ0_5 = "",
    decorationPHQ1_5 = "",
    decorationPHQ2_5 = "",
    decorationPHQ3_5 = "";
  let boldPHQ0_5 = false,
    boldPHQ1_5 = false,
    boldPHQ2_5 = false,
    boldPHQ3_5 = false;

  //Pregunta 6 del PHQ9
  let decorationPHQ0_6 = "",
    decorationPHQ1_6 = "",
    decorationPHQ2_6 = "",
    decorationPHQ3_6 = "";
  let boldPHQ0_6 = false,
    boldPHQ1_6 = false,
    boldPHQ2_6 = false,
    boldPHQ3_6 = false;

  //Pregunta 7 del PHQ9
  let decorationPHQ0_7 = "",
    decorationPHQ1_7 = "",
    decorationPHQ2_7 = "",
    decorationPHQ3_7 = "";
  let boldPHQ0_7 = false,
    boldPHQ1_7 = false,
    boldPHQ2_7 = false,
    boldPHQ3_7 = false;

  //Pregunta 8 del PHQ9
  let decorationPHQ0_8 = "",
    decorationPHQ1_8 = "",
    decorationPHQ2_8 = "",
    decorationPHQ3_8 = "";
  let boldPHQ0_8 = false,
    boldPHQ1_8 = false,
    boldPHQ2_8 = false,
    boldPHQ3_8 = false;

  //Pregunta 9 del PHQ9
  let decorationPHQ0_9 = "",
    decorationPHQ1_9 = "",
    decorationPHQ2_9 = "",
    decorationPHQ3_9 = "";
  let boldPHQ0_9 = false,
    boldPHQ1_9 = false,
    boldPHQ2_9 = false,
    boldPHQ3_9 = false;

  //Pregunta D del PHQ9
  let decorationPHQ0_D = "",
    decorationPHQ1_D = "",
    decorationPHQ2_D = "",
    decorationPHQ3_D = "";
  let boldPHQ0_D = false,
    boldPHQ1_D = false,
    boldPHQ2_D = false,
    boldPHQ3_D = false;

  //Contador para cada puntuacion
  let contadorPHQ_0 = 0;
  let contadorPHQ_1 = 0;
  let contadorPHQ_2 = 0;
  let contadorPHQ_3 = 0;

  let puntuacionPHQTotal = 0;

  let puntuacionCuestionarioPHQ_1 = "";
  let puntuacionCuestionarioPHQ_2 = "";
  let puntuacionCuestionarioPHQ_3 = "";
  let puntuacionCuestionarioPHQ_4 = "";
  let puntuacionCuestionarioPHQ_5 = "";
  let puntuacionCuestionarioPHQ_6 = "";
  let puntuacionCuestionarioPHQ_7 = "";
  let puntuacionCuestionarioPHQ_8 = "";
  let puntuacionCuestionarioPHQ_9 = "";
  let puntuacionCuestionarioPHQDificil = "";
  if (puntuacionFiltroDepresion >= 2) {
    puntuacionCuestionarioPHQ = registroParticipante.puntuacionCuestionarioPHQ;
    puntuacionCuestionarioPHQ_1 = registroParticipante.preguntaDepresion_1;
    puntuacionCuestionarioPHQ_2 = registroParticipante.preguntaDepresion_2;
    puntuacionCuestionarioPHQ_3 =
      registroParticipante.puntuacionCuestionarioPHQ[0];
    puntuacionCuestionarioPHQ_4 =
      registroParticipante.puntuacionCuestionarioPHQ[1];
    puntuacionCuestionarioPHQ_5 =
      registroParticipante.puntuacionCuestionarioPHQ[2];
    puntuacionCuestionarioPHQ_6 =
      registroParticipante.puntuacionCuestionarioPHQ[3];
    puntuacionCuestionarioPHQ_7 =
      registroParticipante.puntuacionCuestionarioPHQ[4];
    puntuacionCuestionarioPHQ_8 =
      registroParticipante.puntuacionCuestionarioPHQ[5];
    puntuacionCuestionarioPHQ_9 =
      registroParticipante.puntuacionCuestionarioPHQ[6];
    puntuacionCuestionarioPHQDificil =
      registroParticipante.puntuacionCuestionarioPHQ[7];

    switch (puntuacionCuestionarioPHQ_1) {
      case "0":
        decorationPHQ0_1 = "underline";
        boldPHQ0_1 = true;
        contadorPHQ_0++;
        break;
      case "1":
        decorationPHQ1_1 = "underline";
        boldPHQ1_1 = true;
        contadorPHQ_1++;
        break;
      case "2":
        decorationPHQ2_1 = "underline";
        boldPHQ2_1 = true;
        contadorPHQ_2++;
        break;
      case "3":
        decorationPHQ3_1 = "underline";
        boldPHQ3_1 = true;
        contadorPHQ_3++;
        break;
    }

    switch (puntuacionCuestionarioPHQ_2) {
      case "0":
        decorationPHQ0_2 = "underline";
        boldPHQ0_2 = true;
        contadorPHQ_0++;
        break;
      case "1":
        decorationPHQ1_2 = "underline";
        boldPHQ1_2 = true;
        contadorPHQ_1++;
        break;
      case "2":
        decorationPHQ2_2 = "underline";
        boldPHQ2_2 = true;
        contadorPHQ_2++;
        break;
      case "3":
        decorationPHQ3_2 = "underline";
        boldPHQ3_2 = true;
        contadorPHQ_3++;
        break;
    }

    switch (puntuacionCuestionarioPHQ_3) {
      case "0":
        decorationPHQ0_3 = "underline";
        boldPHQ0_3 = true;
        contadorPHQ_0++;
        break;
      case "1":
        decorationPHQ1_3 = "underline";
        boldPHQ1_3 = true;
        contadorPHQ_1++;
        break;
      case "2":
        decorationPHQ2_3 = "underline";
        boldPHQ2_3 = true;
        contadorPHQ_2++;
        break;
      case "3":
        decorationPHQ3_3 = "underline";
        boldPHQ3_3 = true;
        contadorPHQ_3++;
        break;
    }

    switch (puntuacionCuestionarioPHQ_4) {
      case "0":
        decorationPHQ0_4 = "underline";
        boldPHQ0_4 = true;
        contadorPHQ_0++;
        break;
      case "1":
        decorationPHQ1_4 = "underline";
        boldPHQ1_4 = true;
        contadorPHQ_1++;
        break;
      case "2":
        decorationPHQ2_4 = "underline";
        boldPHQ2_4 = true;
        contadorPHQ_2++;
        break;
      case "3":
        decorationPHQ3_4 = "underline";
        boldPHQ3_4 = true;
        contadorPHQ_3++;
        break;
    }

    switch (puntuacionCuestionarioPHQ_5) {
      case "0":
        decorationPHQ0_5 = "underline";
        boldPHQ0_5 = true;
        contadorPHQ_0++;
        break;
      case "1":
        decorationPHQ1_5 = "underline";
        boldPHQ1_5 = true;
        contadorPHQ_1++;
        break;
      case "2":
        decorationPHQ2_5 = "underline";
        boldPHQ2_5 = true;
        contadorPHQ_2++;
        break;
      case "3":
        decorationPHQ3_5 = "underline";
        boldPHQ3_5 = true;
        contadorPHQ_3++;
        break;
    }

    switch (puntuacionCuestionarioPHQ_6) {
      case "0":
        decorationPHQ0_6 = "underline";
        boldPHQ0_6 = true;
        contadorPHQ_0++;
        break;
      case "1":
        decorationPHQ1_6 = "underline";
        boldPHQ1_6 = true;
        contadorPHQ_1++;
        break;
      case "2":
        decorationPHQ2_6 = "underline";
        boldPHQ2_6 = true;
        contadorPHQ_2++;
        break;
      case "3":
        decorationPHQ3_6 = "underline";
        boldPHQ3_6 = true;
        contadorPHQ_3++;
        break;
    }

    switch (puntuacionCuestionarioPHQ_7) {
      case "0":
        decorationPHQ0_7 = "underline";
        boldPHQ0_7 = true;
        contadorPHQ_0++;
        break;
      case "1":
        decorationPHQ1_7 = "underline";
        boldPHQ1_7 = true;
        contadorPHQ_1++;
        break;
      case "2":
        decorationPHQ2_7 = "underline";
        boldPHQ2_7 = true;
        contadorPHQ_2++;
        break;
      case "3":
        decorationPHQ3_7 = "underline";
        boldPHQ3_7 = true;
        contadorPHQ_3++;
        break;
    }

    switch (puntuacionCuestionarioPHQ_8) {
      case "0":
        decorationPHQ0_8 = "underline";
        boldPHQ0_8 = true;
        contadorPHQ_0++;
        break;
      case "1":
        decorationPHQ1_8 = "underline";
        boldPHQ1_8 = true;
        contadorPHQ_1++;
        break;
      case "2":
        decorationPHQ2_8 = "underline";
        boldPHQ2_8 = true;
        contadorPHQ_2++;
        break;
      case "3":
        decorationPHQ3_8 = "underline";
        boldPHQ3_8 = true;
        contadorPHQ_3++;
        break;
    }

    switch (puntuacionCuestionarioPHQ_9) {
      case "0":
        decorationPHQ0_9 = "underline";
        boldPHQ0_9 = true;
        contadorPHQ_0++;
        break;
      case "1":
        decorationPHQ1_9 = "underline";
        boldPHQ1_9 = true;
        contadorPHQ_1++;
        break;
      case "2":
        decorationPHQ2_9 = "underline";
        boldPHQ2_9 = true;
        contadorPHQ_2++;
        break;
      case "3":
        decorationPHQ3_9 = "underline";
        boldPHQ3_9 = true;
        contadorPHQ_3++;
        break;
    }

    switch (puntuacionCuestionarioPHQDificil) {
      case "0":
        decorationPHQ0_D = "underline";
        boldPHQ0_D = true;
        break;
      case "1":
        decorationPHQ1_D = "underline";
        boldPHQ1_D = true;
        break;
      case "2":
        decorationPHQ2_D = "underline";
        boldPHQ2_D = true;
        break;
      case "3":
        decorationPHQ3_D = "underline";
        boldPHQ3_D = true;
        break;
    }
  }
  let contadorTotalPHQ_0 = contadorPHQ_0 * 0;
  let contadorTotalPHQ_1 = contadorPHQ_1 * 1;
  let contadorTotalPHQ_2 = contadorPHQ_2 * 2;
  let contadorTotalPHQ_3 = contadorPHQ_3 * 3;

  puntuacionPHQTotal =
    contadorTotalPHQ_0 +
    contadorTotalPHQ_1 +
    contadorTotalPHQ_2 +
    contadorTotalPHQ_3;

  //----------------PUNTUACIONES DEL BAI----------
  //Pregunta 1 del BAI
  let decorationBAI0_1 = "",
    decorationBAI1_1 = "",
    decorationBAI2_1 = "",
    decorationBAI3_1 = "";
  let boldBAI0_1 = false,
    boldBAI1_1 = false,
    boldBAI2_1 = false,
    boldBAI3_1 = false;

  //Pregunta 2 del BAI
  let decorationBAI0_2 = "",
    decorationBAI1_2 = "",
    decorationBAI2_2 = "",
    decorationBAI3_2 = "";
  let boldBAI0_2 = false,
    boldBAI1_2 = false,
    boldBAI2_2 = false,
    boldBAI3_2 = false;

  //Pregunta 3 del BAI
  let decorationBAI0_3 = "",
    decorationBAI1_3 = "",
    decorationBAI2_3 = "",
    decorationBAI3_3 = "";
  let boldBAI0_3 = false,
    boldBAI1_3 = false,
    boldBAI2_3 = false,
    boldBAI3_3 = false;

  //Pregunta 4 del BAI
  let decorationBAI0_4 = "",
    decorationBAI1_4 = "",
    decorationBAI2_4 = "",
    decorationBAI3_4 = "";
  let boldBAI0_4 = false,
    boldBAI1_4 = false,
    boldBAI2_4 = false,
    boldBAI3_4 = false;

  //Pregunta 5 del BAI
  let decorationBAI0_5 = "",
    decorationBAI1_5 = "",
    decorationBAI2_5 = "",
    decorationBAI3_5 = "";
  let boldBAI0_5 = false,
    boldBAI1_5 = false,
    boldBAI2_5 = false,
    boldBAI3_5 = false;

  //Pregunta 6 del BAI
  let decorationBAI0_6 = "",
    decorationBAI1_6 = "",
    decorationBAI2_6 = "",
    decorationBAI3_6 = "";
  let boldBAI0_6 = false,
    boldBAI1_6 = false,
    boldBAI2_6 = false,
    boldBAI3_6 = false;

  //Pregunta 7 del BAI
  let decorationBAI0_7 = "",
    decorationBAI1_7 = "",
    decorationBAI2_7 = "",
    decorationBAI3_7 = "";
  let boldBAI0_7 = false,
    boldBAI1_7 = false,
    boldBAI2_7 = false,
    boldBAI3_7 = false;

  //Pregunta 8 del BAI
  let decorationBAI0_8 = "",
    decorationBAI1_8 = "",
    decorationBAI2_8 = "",
    decorationBAI3_8 = "";
  let boldBAI0_8 = false,
    boldBAI1_8 = false,
    boldBAI2_8 = false,
    boldBAI3_8 = false;

  //Pregunta 9 del BAI
  let decorationBAI0_9 = "",
    decorationBAI1_9 = "",
    decorationBAI2_9 = "",
    decorationBAI3_9 = "";
  let boldBAI0_9 = false,
    boldBAI1_9 = false,
    boldBAI2_9 = false,
    boldBAI3_9 = false;

  //Pregunta 10 del BAI
  let decorationBAI0_10 = "",
    decorationBAI1_10 = "",
    decorationBAI2_10 = "",
    decorationBAI3_10 = "";
  let boldBAI0_10 = false,
    boldBAI1_10 = false,
    boldBAI2_10 = false,
    boldBAI3_10 = false;

  //Pregunta 11 del BAI
  let decorationBAI0_11 = "",
    decorationBAI1_11 = "",
    decorationBAI2_11 = "",
    decorationBAI3_11 = "";
  let boldBAI0_11 = false,
    boldBAI1_11 = false,
    boldBAI2_11 = false,
    boldBAI3_11 = false;

  //Pregunta 12 del BAI
  let decorationBAI0_12 = "",
    decorationBAI1_12 = "",
    decorationBAI2_12 = "",
    decorationBAI3_12 = "";
  let boldBAI0_12 = false,
    boldBAI1_12 = false,
    boldBAI2_12 = false,
    boldBAI3_12 = false;

  //Pregunta 13 del BAI
  let decorationBAI0_13 = "",
    decorationBAI1_13 = "",
    decorationBAI2_13 = "",
    decorationBAI3_13 = "";
  let boldBAI0_13 = false,
    boldBAI1_13 = false,
    boldBAI2_13 = false,
    boldBAI3_13 = false;

  //Pregunta 14 del BAI
  let decorationBAI0_14 = "",
    decorationBAI1_14 = "",
    decorationBAI2_14 = "",
    decorationBAI3_14 = "";
  let boldBAI0_14 = false,
    boldBAI1_14 = false,
    boldBAI2_14 = false,
    boldBAI3_14 = false;

  //Pregunta 15 del BAI
  let decorationBAI0_15 = "",
    decorationBAI1_15 = "",
    decorationBAI2_15 = "",
    decorationBAI3_15 = "";
  let boldBAI0_15 = false,
    boldBAI1_15 = false,
    boldBAI2_15 = false,
    boldBAI3_15 = false;

  //Pregunta 16 del BAI
  let decorationBAI0_16 = "",
    decorationBAI1_16 = "",
    decorationBAI2_16 = "",
    decorationBAI3_16 = "";
  let boldBAI0_16 = false,
    boldBAI1_16 = false,
    boldBAI2_16 = false,
    boldBAI3_16 = false;

  //Pregunta 17 del BAI
  let decorationBAI0_17 = "",
    decorationBAI1_17 = "",
    decorationBAI2_17 = "",
    decorationBAI3_17 = "";
  let boldBAI0_17 = false,
    boldBAI1_17 = false,
    boldBAI2_17 = false,
    boldBAI3_17 = false;

  //Pregunta 18 del BAI
  let decorationBAI0_18 = "",
    decorationBAI1_18 = "",
    decorationBAI2_18 = "",
    decorationBAI3_18 = "";
  let boldBAI0_18 = false,
    boldBAI1_18 = false,
    boldBAI2_18 = false,
    boldBAI3_18 = false;

  //Pregunta 19 del BAI
  let decorationBAI0_19 = "",
    decorationBAI1_19 = "",
    decorationBAI2_19 = "",
    decorationBAI3_19 = "";
  let boldBAI0_19 = false,
    boldBAI1_19 = false,
    boldBAI2_19 = false,
    boldBAI3_19 = false;

  //Pregunta 20 del BAI
  let decorationBAI0_20 = "",
    decorationBAI1_20 = "",
    decorationBAI2_20 = "",
    decorationBAI3_20 = "";
  let boldBAI0_20 = false,
    boldBAI1_20 = false,
    boldBAI2_20 = false,
    boldBAI3_20 = false;

  //Pregunta 21 del BAI
  let decorationBAI0_21 = "",
    decorationBAI1_21 = "",
    decorationBAI2_21 = "",
    decorationBAI3_21 = "";
  let boldBAI0_21 = false,
    boldBAI1_21 = false,
    boldBAI2_21 = false,
    boldBAI3_21 = false;

  //Contador para cada puntuacion
  let contadorBAI_0 = 0;
  let contadorBAI_1 = 0;
  let contadorBAI_2 = 0;
  let contadorBAI_3 = 0;

  let puntuacionBAITotal = 0;

  let puntuacionCuestionarioBAI_1 = "";
  let puntuacionCuestionarioBAI_2 = "";
  let puntuacionCuestionarioBAI_3 = "";
  let puntuacionCuestionarioBAI_4 = "";
  let puntuacionCuestionarioBAI_5 = "";
  let puntuacionCuestionarioBAI_6 = "";
  let puntuacionCuestionarioBAI_7 = "";
  let puntuacionCuestionarioBAI_8 = "";
  let puntuacionCuestionarioBAI_9 = "";
  let puntuacionCuestionarioBAI_10 = "";
  let puntuacionCuestionarioBAI_11 = "";
  let puntuacionCuestionarioBAI_12 = "";
  let puntuacionCuestionarioBAI_13 = "";
  let puntuacionCuestionarioBAI_14 = "";
  let puntuacionCuestionarioBAI_15 = "";
  let puntuacionCuestionarioBAI_16 = "";
  let puntuacionCuestionarioBAI_17 = "";
  let puntuacionCuestionarioBAI_18 = "";
  let puntuacionCuestionarioBAI_19 = "";
  let puntuacionCuestionarioBAI_20 = "";
  let puntuacionCuestionarioBAI_21 = "";
  if (puntuacionFiltroAnsiedad >= 2) {
    puntuacionCuestionarioBAI = registroParticipante.puntuacionCuestionarioBAI;
    puntuacionCuestionarioBAI_1 =
      registroParticipante.puntuacionCuestionarioBAI[0];
    puntuacionCuestionarioBAI_2 =
      registroParticipante.puntuacionCuestionarioBAI[1];
    puntuacionCuestionarioBAI_3 =
      registroParticipante.puntuacionCuestionarioBAI[2];
    puntuacionCuestionarioBAI_4 =
      registroParticipante.puntuacionCuestionarioBAI[3];
    puntuacionCuestionarioBAI_5 =
      registroParticipante.puntuacionCuestionarioBAI[4];
    puntuacionCuestionarioBAI_6 =
      registroParticipante.puntuacionCuestionarioBAI[5];
    puntuacionCuestionarioBAI_7 =
      registroParticipante.puntuacionCuestionarioBAI[6];
    puntuacionCuestionarioBAI_8 =
      registroParticipante.puntuacionCuestionarioBAI[7];
    puntuacionCuestionarioBAI_9 =
      registroParticipante.puntuacionCuestionarioBAI[8];
    puntuacionCuestionarioBAI_10 =
      registroParticipante.puntuacionCuestionarioBAI[9];
    puntuacionCuestionarioBAI_11 =
      registroParticipante.puntuacionCuestionarioBAI[10];
    puntuacionCuestionarioBAI_12 =
      registroParticipante.puntuacionCuestionarioBAI[11];
    puntuacionCuestionarioBAI_13 =
      registroParticipante.puntuacionCuestionarioBAI[12];
    puntuacionCuestionarioBAI_14 =
      registroParticipante.puntuacionCuestionarioBAI[13];
    puntuacionCuestionarioBAI_15 =
      registroParticipante.puntuacionCuestionarioBAI[14];
    puntuacionCuestionarioBAI_16 =
      registroParticipante.puntuacionCuestionarioBAI[15];
    puntuacionCuestionarioBAI_17 =
      registroParticipante.puntuacionCuestionarioBAI[16];
    puntuacionCuestionarioBAI_18 =
      registroParticipante.puntuacionCuestionarioBAI[17];
    puntuacionCuestionarioBAI_19 =
      registroParticipante.puntuacionCuestionarioBAI[18];
    puntuacionCuestionarioBAI_20 = registroParticipante.preguntaAnsiedad_1;
    puntuacionCuestionarioBAI_21 = registroParticipante.preguntaAnsiedad_2;

    switch (puntuacionCuestionarioBAI_1) {
      case "0":
        decorationBAI0_1 = "underline";
        boldBAI0_1 = true;
        contadorBAI_0++;
        break;
      case "1":
        decorationBAI1_1 = "underline";
        boldBAI1_1 = true;
        contadorBAI_1++;
        break;
      case "2":
        decorationBAI2_1 = "underline";
        boldBAI2_1 = true;
        contadorBAI_2++;
        break;
      case "3":
        decorationBAI3_1 = "underline";
        boldBAI3_1 = true;
        contadorBAI_3++;
        break;
    }

    switch (puntuacionCuestionarioBAI_2) {
      case "0":
        decorationBAI0_2 = "underline";
        boldBAI0_2 = true;
        contadorBAI_0++;
        break;
      case "1":
        decorationBAI1_2 = "underline";
        boldBAI1_2 = true;
        contadorBAI_1++;
        break;
      case "2":
        decorationBAI2_2 = "underline";
        boldBAI2_2 = true;
        contadorBAI_2++;
        break;
      case "3":
        decorationBAI3_2 = "underline";
        boldBAI3_2 = true;
        contadorBAI_3++;
        break;
    }

    switch (puntuacionCuestionarioBAI_3) {
      case "0":
        decorationBAI0_3 = "underline";
        boldBAI0_3 = true;
        contadorBAI_0++;
        break;
      case "1":
        decorationBAI1_3 = "underline";
        boldBAI1_3 = true;
        contadorBAI_1++;
        break;
      case "2":
        decorationBAI2_3 = "underline";
        boldBAI2_3 = true;
        contadorBAI_2++;
        break;
      case "3":
        decorationBAI3_3 = "underline";
        boldBAI3_3 = true;
        contadorBAI_3++;
        break;
    }

    switch (puntuacionCuestionarioBAI_4) {
      case "0":
        decorationBAI0_4 = "underline";
        boldBAI0_4 = true;
        contadorBAI_0++;
        break;
      case "1":
        decorationBAI1_4 = "underline";
        boldBAI1_4 = true;
        contadorBAI_1++;
        break;
      case "2":
        decorationBAI2_4 = "underline";
        boldBAI2_4 = true;
        contadorBAI_2++;
        break;
      case "3":
        decorationBAI3_4 = "underline";
        boldBAI3_4 = true;
        contadorBAI_3++;
        break;
    }

    switch (puntuacionCuestionarioBAI_5) {
      case "0":
        decorationBAI0_5 = "underline";
        boldBAI0_5 = true;
        contadorBAI_0++;
        break;
      case "1":
        decorationBAI1_5 = "underline";
        boldBAI1_5 = true;
        contadorBAI_1++;
        break;
      case "2":
        decorationBAI2_5 = "underline";
        boldBAI2_5 = true;
        contadorBAI_2++;
        break;
      case "3":
        decorationBAI3_5 = "underline";
        boldBAI3_5 = true;
        contadorBAI_3++;
        break;
    }

    switch (puntuacionCuestionarioBAI_6) {
      case "0":
        decorationBAI0_6 = "underline";
        boldBAI0_6 = true;
        contadorBAI_0++;
        break;
      case "1":
        decorationBAI1_6 = "underline";
        boldBAI1_6 = true;
        contadorBAI_1++;
        break;
      case "2":
        decorationBAI2_6 = "underline";
        boldBAI2_6 = true;
        contadorBAI_2++;
        break;
      case "3":
        decorationBAI3_6 = "underline";
        boldBAI3_6 = true;
        contadorBAI_3++;
        break;
    }

    switch (puntuacionCuestionarioBAI_7) {
      case "0":
        decorationBAI0_7 = "underline";
        boldBAI0_7 = true;
        contadorBAI_0++;
        break;
      case "1":
        decorationBAI1_7 = "underline";
        boldBAI1_7 = true;
        contadorBAI_1++;
        break;
      case "2":
        decorationBAI2_7 = "underline";
        boldBAI2_7 = true;
        contadorBAI_2++;
        break;
      case "3":
        decorationBAI3_7 = "underline";
        boldBAI3_7 = true;
        contadorBAI_3++;
        break;
    }

    switch (puntuacionCuestionarioBAI_8) {
      case "0":
        decorationBAI0_8 = "underline";
        boldBAI0_8 = true;
        contadorBAI_0++;
        break;
      case "1":
        decorationBAI1_8 = "underline";
        boldBAI1_8 = true;
        contadorBAI_1++;
        break;
      case "2":
        decorationBAI2_8 = "underline";
        boldBAI2_8 = true;
        contadorBAI_2++;
        break;
      case "3":
        decorationBAI3_8 = "underline";
        boldBAI3_8 = true;
        contadorBAI_3++;
        break;
    }

    switch (puntuacionCuestionarioBAI_9) {
      case "0":
        decorationBAI0_9 = "underline";
        boldBAI0_9 = true;
        contadorBAI_0++;
        break;
      case "1":
        decorationBAI1_9 = "underline";
        boldBAI1_9 = true;
        contadorBAI_1++;
        break;
      case "2":
        decorationBAI2_9 = "underline";
        boldBAI2_9 = true;
        contadorBAI_2++;
        break;
      case "3":
        decorationBAI3_9 = "underline";
        boldBAI3_9 = true;
        contadorBAI_3++;
        break;
    }

    switch (puntuacionCuestionarioBAI_10) {
      case "0":
        decorationBAI0_10 = "underline";
        boldBAI0_10 = true;
        contadorBAI_0++;
        break;
      case "1":
        decorationBAI1_10 = "underline";
        boldBAI1_10 = true;
        contadorBAI_1++;
        break;
      case "2":
        decorationBAI2_10 = "underline";
        boldBAI2_10 = true;
        contadorBAI_2++;
        break;
      case "3":
        decorationBAI3_10 = "underline";
        boldBAI3_10 = true;
        contadorBAI_3++;
        break;
    }

    switch (puntuacionCuestionarioBAI_11) {
      case "0":
        decorationBAI0_11 = "underline";
        boldBAI0_11 = true;
        contadorBAI_0++;
        break;
      case "1":
        decorationBAI1_11 = "underline";
        boldBAI1_11 = true;
        contadorBAI_1++;
        break;
      case "2":
        decorationBAI2_11 = "underline";
        boldBAI2_11 = true;
        contadorBAI_2++;
        break;
      case "3":
        decorationBAI3_11 = "underline";
        boldBAI3_11 = true;
        contadorBAI_3++;
        break;
    }

    switch (puntuacionCuestionarioBAI_12) {
      case "0":
        decorationBAI0_12 = "underline";
        boldBAI0_12 = true;
        contadorBAI_0++;
        break;
      case "1":
        decorationBAI1_12 = "underline";
        boldBAI1_12 = true;
        contadorBAI_1++;
        break;
      case "2":
        decorationBAI2_12 = "underline";
        boldBAI2_12 = true;
        contadorBAI_2++;
        break;
      case "3":
        decorationBAI3_12 = "underline";
        boldBAI3_12 = true;
        contadorBAI_3++;
        break;
    }

    switch (puntuacionCuestionarioBAI_13) {
      case "0":
        decorationBAI0_13 = "underline";
        boldBAI0_13 = true;
        contadorBAI_0++;
        break;
      case "1":
        decorationBAI1_13 = "underline";
        boldBAI1_13 = true;
        contadorBAI_1++;
        break;
      case "2":
        decorationBAI2_13 = "underline";
        boldBAI2_13 = true;
        contadorBAI_2++;
        break;
      case "3":
        decorationBAI3_13 = "underline";
        boldBAI3_13 = true;
        contadorBAI_3++;
        break;
    }

    switch (puntuacionCuestionarioBAI_14) {
      case "0":
        decorationBAI0_14 = "underline";
        boldBAI0_14 = true;
        contadorBAI_0++;
        break;
      case "1":
        decorationBAI1_14 = "underline";
        boldBAI1_14 = true;
        contadorBAI_1++;
        break;
      case "2":
        decorationBAI2_14 = "underline";
        boldBAI2_14 = true;
        contadorBAI_2++;
        break;
      case "3":
        decorationBAI3_14 = "underline";
        boldBAI3_14 = true;
        contadorBAI_3++;
        break;
    }

    switch (puntuacionCuestionarioBAI_15) {
      case "0":
        decorationBAI0_15 = "underline";
        boldBAI0_15 = true;
        contadorBAI_0++;
        break;
      case "1":
        decorationBAI1_15 = "underline";
        boldBAI1_15 = true;
        contadorBAI_1++;
        break;
      case "2":
        decorationBAI2_15 = "underline";
        boldBAI2_15 = true;
        contadorBAI_2++;
        break;
      case "3":
        decorationBAI3_15 = "underline";
        boldBAI3_15 = true;
        contadorBAI_3++;
        break;
    }

    switch (puntuacionCuestionarioBAI_16) {
      case "0":
        decorationBAI0_16 = "underline";
        boldBAI0_16 = true;
        contadorBAI_0++;
        break;
      case "1":
        decorationBAI1_16 = "underline";
        boldBAI1_16 = true;
        contadorBAI_1++;
        break;
      case "2":
        decorationBAI2_16 = "underline";
        boldBAI2_16 = true;
        contadorBAI_2++;
        break;
      case "3":
        decorationBAI3_16 = "underline";
        boldBAI3_16 = true;
        contadorBAI_3++;
        break;
    }

    switch (puntuacionCuestionarioBAI_17) {
      case "0":
        decorationBAI0_17 = "underline";
        boldBAI0_17 = true;
        contadorBAI_0++;
        break;
      case "1":
        decorationBAI1_17 = "underline";
        boldBAI1_17 = true;
        contadorBAI_1++;
        break;
      case "2":
        decorationBAI2_17 = "underline";
        boldBAI2_17 = true;
        contadorBAI_2++;
        break;
      case "3":
        decorationBAI3_17 = "underline";
        boldBAI3_17 = true;
        contadorBAI_3++;
        break;
    }

    switch (puntuacionCuestionarioBAI_18) {
      case "0":
        decorationBAI0_18 = "underline";
        boldBAI0_18 = true;
        contadorBAI_0++;
        break;
      case "1":
        decorationBAI1_18 = "underline";
        boldBAI1_18 = true;
        contadorBAI_1++;
        break;
      case "2":
        decorationBAI2_18 = "underline";
        boldBAI2_18 = true;
        contadorBAI_2++;
        break;
      case "3":
        decorationBAI3_18 = "underline";
        boldBAI3_18 = true;
        contadorBAI_3++;
        break;
    }

    switch (puntuacionCuestionarioBAI_19) {
      case "0":
        decorationBAI0_19 = "underline";
        boldBAI0_19 = true;
        contadorBAI_0++;
        break;
      case "1":
        decorationBAI1_19 = "underline";
        boldBAI1_19 = true;
        contadorBAI_1++;
        break;
      case "2":
        decorationBAI2_19 = "underline";
        boldBAI2_19 = true;
        contadorBAI_2++;
        break;
      case "3":
        decorationBAI3_19 = "underline";
        boldBAI3_19 = true;
        contadorBAI_3++;
        break;
    }

    switch (puntuacionCuestionarioBAI_20) {
      case "0":
        decorationBAI0_20 = "underline";
        boldBAI0_20 = true;
        contadorBAI_0++;
        break;
      case "1":
        decorationBAI1_20 = "underline";
        boldBAI1_20 = true;
        contadorBAI_1++;
        break;
      case "2":
        decorationBAI2_20 = "underline";
        boldBAI2_20 = true;
        contadorBAI_2++;
        break;
      case "3":
        decorationBAI3_20 = "underline";
        boldBAI3_20 = true;
        contadorBAI_3++;
        break;
    }

    switch (puntuacionCuestionarioBAI_21) {
      case "0":
        decorationBAI0_21 = "underline";
        boldBAI0_21 = true;
        contadorBAI_0++;
        break;
      case "1":
        decorationBAI1_21 = "underline";
        boldBAI1_21 = true;
        contadorBAI_1++;
        break;
      case "2":
        decorationBAI2_21 = "underline";
        boldBAI2_21 = true;
        contadorBAI_2++;
        break;
      case "3":
        decorationBAI3_21 = "underline";
        boldBAI3_21 = true;
        contadorBAI_3++;
        break;
    }
  }
  let contadorTotalBAI_1 = contadorBAI_1 * 1;
  let contadorTotalBAI_2 = contadorBAI_2 * 2;
  let contadorTotalBAI_3 = contadorBAI_3 * 3;

  puntuacionBAITotal =
    contadorTotalBAI_1 + contadorTotalBAI_2 + contadorTotalBAI_3;

  //VEREDICTOS

  let veredictoBAI = "";
  let veredictoPHQ = "";
  if (puntuacionBAITotal <= 7) veredictoBAI = "Posible Ansiedad Mínima";

  if (puntuacionBAITotal >= 8 && puntuacionBAITotal <= 15)
    veredictoBAI = "Posible Ansiedad Leve";

  if (puntuacionBAITotal >= 16 && puntuacionBAITotal <= 25)
    veredictoBAI = "Posible Ansiedad Moderada";

  if (puntuacionBAITotal >= 26 && puntuacionBAITotal <= 63)
    veredictoBAI = "Posible Ansiedad Severa";

  if (puntuacionPHQTotal <= 4) veredictoPHQ = "Posible Depresion Mínima";

  if (puntuacionPHQTotal >= 5 && puntuacionPHQTotal <= 9)
    veredictoPHQ = "Posible Depresion Leve";

  if (puntuacionPHQTotal >= 10 && puntuacionPHQTotal <= 17)
    veredictoPHQ = "Posible Depresion Moderada";

  if (puntuacionPHQTotal >= 18 && puntuacionPHQTotal <= 27)
    veredictoPHQ = "Posible Depresion Severa";

  //TODO: Dar formato a este archivo
  let docDefinition = {
    content: [
      {
        text: nombreEdadParticipante,
        style: "header",
        margin: [100, 50, 0, 20],
      },
      {
        alignment: "center",
        columns: [
          {
            text: "No. telefonico:", //Muestra este texto estáticamente
          },
          {
            text: "email:", //Muestra este texto estáticamente
          },
        ],
      },
      {
        alignment: "center",
        columns: [
          {
            text: messageComesFromPhone, //Cambia dinámicamente este texto
          },
          {
            text: emailParticipante, //Cambia dinámicamente este texto
          },
        ],
      },
      {
        text: fechaParticipacionOnly,
        margin: [50, 0, 0, 0],
      },
      "\n",
      {
        text: "Resultados de preguntas filtro",
        style: "subheader",
        alignment: "center",
        color: "#d58e76",
      },
      "\n",
      //Prueba de filas
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Presentacion
        alignment: "center",
        columns: [
          {
            text: "Preguntas Filtro",
            style: { fontSize: 15 },
            bold: true,
            margin: [0, 27, 0, 5],
          },
          {
            //Respuestas MINI
            columns: [
              {
                text: "Ningún día",
                bold: true,
                margin: [0, 20, 0, 0],
              },
              {
                text: "Menos de la mitad de los días",
                bold: true,
                margin: [0, 2, 0, 2],
              },
              {
                text: "Más de la mitad de los días",
                bold: true,
                margin: [0, 10, 0, 0],
              },
              {
                text: "Casi todos los días",
                bold: true,
                margin: [0, 14, 0, 0],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //ENTREVISTA MINI
        alignment: "center",
        columns: [
          {
            text: "Preguntas de entrevista MINI",
            style: { fontSize: 13 },
            bold: true,
            margin: [0, 5, 0, 5],
          },
          {
            //Respuestas MINI
            columns: [
              {
                // text: "Ningún día",
                text: "",
                bold: true,
                margin: [0, 2, 0, 2],
              },
              {
                // text: "Menos de la mitad de los días",
                text: "",
                bold: true,
                margin: [0, 2, 0, 2],
              },
              {
                // text: "Más de la mitad de los días",
                text: "",
                bold: true,
                margin: [0, 2, 0, 2],
              },
              {
                // text: "Casi todos los días",
                text: "",
                bold: true,
                margin: [0, 2, 0, 2],
              },
            ],
          },
        ],
      },
      "",
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 1
        alignment: "center",
        columns: [
          {
            text: "¿Dlurante las últimas dos semanas se ha sentido excesivamente preocupado o ansioso debido a varias cosas?",
            margin: [0, 5, 0, 5],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldAnsiedad0,
                decoration: decorationAnsiedad0,
                margin: [0, 17, 0, 0],
              },
              {
                text: "1",
                bold: boldAnsiedad1,
                decoration: decorationAnsiedad1,
                margin: [0, 17, 0, 0],
              },
              {
                text: "2",
                bold: boldAnsiedad2,
                decoration: decorationAnsiedad2,
                margin: [0, 17, 0, 0],
              },
              {
                text: "3",
                bold: boldAnsiedad3,
                decoration: decorationAnsiedad3,
                margin: [0, 17, 0, 0],
              },
            ],
          },
        ],
      },
      "",
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 2
        alignment: "center",
        columns: [
          {
            text: "¿Estas molestias se presentan estas preocupasiones casi todos los días?",
            margin: [0, 5, 0, 5],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldAnsiedad0_2,
                decoration: decorationAnsiedad0_2,
                margin: [0, 12, 0, 0],
              },
              {
                text: "1",
                bold: boldAnsiedad1_2,
                decoration: decorationAnsiedad1_2,
                margin: [0, 12, 0, 0],
              },
              {
                text: "2",
                bold: boldAnsiedad2_2,
                decoration: decorationAnsiedad2_2,
                margin: [0, 12, 0, 0],
              },
              {
                text: "3",
                bold: boldAnsiedad3_2,
                decoration: decorationAnsiedad3_2,
                margin: [0, 12, 0, 0],
              },
            ],
          },
        ],
      },
      "",
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      "",
      {
        //CUESTIONARIO PHQ-2
        alignment: "center",
        columns: [
          {
            text: "Preguntas PHQ-2",
            style: { fontSize: 13 },
            bold: true,
            margin: [0, 5, 0, 5],
          },
          {
            //Respuestas PHQ
            columns: [
              {
                // text: "Ningún día",
                text: "",
                bold: true,
                margin: [0, 2, 0, 2],
              },
              {
                // text: "Menos de la mitad de los días",
                text: "",
                bold: true,
                margin: [0, 2, 0, 2],
              },
              {
                // text: "Más de la mitad de los días",
                text: "",
                bold: true,
                margin: [0, 2, 0, 2],
              },
              {
                // text: "Casi todos los días",
                text: "",
                bold: true,
                margin: [0, 2, 0, 2],
              },
            ],
          },
        ],
      },
      "",
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 3
        alignment: "center",
        columns: [
          {
            text: "Durante las últimas 2 semanas, ¿qué tan seguido has tenido molestias debido al poco interés o placer en hacer cosas?",
            margin: [0, 10, 0, 10],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldDepresion0_1,
                decoration: decorationDepresion0_1,
                margin: [0, 23, 0, 0],
              },
              {
                text: "1",
                bold: boldDepresion1_1,
                decoration: decorationDepresion1_1,
                margin: [0, 23, 0, 0],
              },
              {
                text: "2",
                bold: boldDepresion2_1,
                decoration: decorationDepresion2_1,
                margin: [0, 23, 0, 0],
              },
              {
                text: "3",
                bold: boldDepresion3_1,
                decoration: decorationDepresion3_1,
                margin: [0, 23, 0, 0],
              },
            ],
          },
        ],
      },
      "",
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 4
        alignment: "center",
        columns: [
          {
            text: "¿Se ha sentido decaído(a), deprimido(a) o sin esperanzas?",
            margin: [0, 10, 0, 10],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldDepresion0_2,
                decoration: decorationDepresion0_2,
                margin: [0, 17, 0, 0],
              },
              {
                text: "1",
                bold: boldDepresion1_2,
                decoration: decorationDepresion1_2,
                margin: [0, 17, 0, 0],
              },
              {
                text: "2",
                bold: boldDepresion2_2,
                decoration: decorationDepresion2_2,
                margin: [0, 17, 0, 0],
              },
              {
                text: "3",
                bold: boldDepresion3_2,
                decoration: decorationDepresion3_2,
                margin: [0, 17, 0, 0],
              },
            ],
          },
        ],
      },
      "",
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
    ],
    styles: {
      header: {
        fontSize: 16,
        bold: true,
      },
      subheader: {
        fontSize: 15,
        bold: true,
      },
      quote: {
        italics: true,
      },
      small: {
        fontSize: 8,
      },
    },
    defaultStyle: {
      columnGap: 20,
    },
  };

  //PDF del cuestionario Beck
  let ansiedadDefinition = {
    content: [
      {
        text: "Resultados del cuestionario BAI (Inventario Beck de Ansiedad)",
        style: "subheader",
        alignment: "center",
        color: "#d58e76",
        //pageBreak: 'before'
      },
      "\n",
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Presentacion
        alignment: "center",
        columns: [
          {
            text: "Preguntas Filtro",
            style: { fontSize: 15 },
            bold: true,
            margin: [0, 8, 0, 5],
          },
          {
            //Respuestas MINI
            columns: [
              {
                text: "Para nada",
                bold: true,
                margin: [0, 3, 0, 0],
              },
              {
                text: "Leve-mente",
                bold: true,
                margin: [0, 3, 0, 0],
              },
              {
                text: "Modera-damente",
                style: { fontSize: 11 },
                bold: true,
                margin: [0, 4, 0, 0],
              },
              {
                text: "Severa-mente",
                bold: true,
                margin: [0, 3, 0, 0],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 1
        alignment: "center",
        columns: [
          {
            text: "1. Torpe o entumecito",
            alignment: "left",
            style: { fontSize: 11 },
            margin: [0, 7, 0, 7],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldBAI0_1,
                decoration: decorationBAI0_1,
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: boldBAI1_1,
                decoration: decorationBAI1_1,
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: boldBAI2_1,
                decoration: decorationBAI2_1,
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: boldBAI3_1,
                decoration: decorationBAI3_1,
                margin: [0, 7, 0, 7],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 2
        alignment: "center",
        columns: [
          {
            text: "2. Acalorado",
            alignment: "left",
            style: { fontSize: 11 },
            margin: [0, 7, 0, 7],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldBAI0_2,
                decoration: decorationBAI0_2,
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: boldBAI1_2,
                decoration: decorationBAI1_2,
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: boldBAI2_2,
                decoration: decorationBAI2_2,
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: boldBAI3_2,
                decoration: decorationBAI3_2,
                margin: [0, 7, 0, 7],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 3
        alignment: "center",
        columns: [
          {
            text: "3. Con temblor en las piernas",
            alignment: "left",
            style: { fontSize: 11 },
            margin: [0, 7, 0, 7],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldBAI0_3,
                decoration: decorationBAI0_3,
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: boldBAI1_3,
                decoration: decorationBAI1_3,
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: boldBAI2_3,
                decoration: decorationBAI2_3,
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: boldBAI3_3,
                decoration: decorationBAI3_3,
                margin: [0, 7, 0, 7],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 4
        alignment: "center",
        columns: [
          {
            text: "4. Incapaz de relajarse",
            alignment: "left",
            style: { fontSize: 11 },
            margin: [0, 7, 0, 7],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldBAI0_4,
                decoration: decorationBAI0_4,
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: boldBAI1_4,
                decoration: decorationBAI1_4,
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: boldBAI2_4,
                decoration: decorationBAI2_4,
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: boldBAI3_4,
                decoration: decorationBAI3_4,
                margin: [0, 7, 0, 7],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 5
        alignment: "center",
        columns: [
          {
            text: "5. Con temor a que ocurra lo peor",
            alignment: "left",
            style: { fontSize: 11 },
            margin: [0, 7, 0, 7],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldBAI0_5,
                decoration: decorationBAI0_5,
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: boldBAI1_5,
                decoration: decorationBAI1_5,
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: boldBAI2_5,
                decoration: decorationBAI2_5,
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: boldBAI3_5,
                decoration: decorationBAI3_5,
                margin: [0, 7, 0, 7],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 6.
        alignment: "center",
        columns: [
          {
            text: "6. Mareado, o que se le va la cabeza",
            alignment: "left",
            style: { fontSize: 11 },
            margin: [0, 7, 0, 7],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldBAI0_6,
                decoration: decorationBAI0_6,
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: boldBAI1_6,
                decoration: decorationBAI1_6,
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: boldBAI2_6,
                decoration: decorationBAI2_6,
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: boldBAI3_6,
                decoration: decorationBAI3_6,
                margin: [0, 7, 0, 7],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 7
        alignment: "center",
        columns: [
          {
            text: "7. Con latidos del corazón fuertes y acelerados",
            alignment: "left",
            style: { fontSize: 11 },
            margin: [0, 7, 0, 7],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldBAI0_7,
                decoration: decorationBAI0_7,
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: boldBAI1_7,
                decoration: decorationBAI1_7,
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: boldBAI2_7,
                decoration: decorationBAI2_7,
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: boldBAI3_7,
                decoration: decorationBAI3_7,
                margin: [0, 7, 0, 7],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 8
        alignment: "center",
        columns: [
          {
            text: "8. Inestable",
            alignment: "left",
            style: { fontSize: 11 },
            margin: [0, 7, 0, 7],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldBAI0_8,
                decoration: decorationBAI0_8,
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: boldBAI1_8,
                decoration: decorationBAI1_8,
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: boldBAI2_8,
                decoration: decorationBAI2_8,
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: boldBAI3_8,
                decoration: decorationBAI3_8,
                margin: [0, 7, 0, 7],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 9
        alignment: "center",
        columns: [
          {
            text: "9. Atemorizado o asustado",
            alignment: "left",
            style: { fontSize: 11 },
            margin: [0, 7, 0, 7],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldBAI0_9,
                decoration: decorationBAI0_9,
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: boldBAI1_9,
                decoration: decorationBAI1_9,
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: boldBAI2_9,
                decoration: decorationBAI2_9,
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: boldBAI3_9,
                decoration: decorationBAI3_9,
                margin: [0, 7, 0, 7],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 10
        alignment: "center",
        columns: [
          {
            text: "10. Nervioso",
            alignment: "left",
            style: { fontSize: 11 },
            margin: [0, 7, 0, 7],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldBAI0_10,
                decoration: decorationBAI0_10,
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: boldBAI1_10,
                decoration: decorationBAI1_10,
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: boldBAI2_10,
                decoration: decorationBAI2_10,
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: boldBAI3_10,
                decoration: decorationBAI3_10,
                margin: [0, 7, 0, 7],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 11
        alignment: "center",
        columns: [
          {
            text: "11. Con sensación de bloqueo",
            alignment: "left",
            style: { fontSize: 11 },
            margin: [0, 7, 0, 7],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldBAI0_11,
                decoration: decorationBAI0_11,
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: boldBAI1_11,
                decoration: decorationBAI1_11,
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: boldBAI2_11,
                decoration: decorationBAI2_11,
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: boldBAI3_11,
                decoration: decorationBAI3_11,
                margin: [0, 7, 0, 7],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 12
        alignment: "center",
        columns: [
          {
            text: "12. Con temblores en las manos",
            alignment: "left",
            style: { fontSize: 11 },
            margin: [0, 7, 0, 7],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldBAI0_12,
                decoration: decorationBAI0_12,
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: boldBAI1_12,
                decoration: decorationBAI1_12,
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: boldBAI2_12,
                decoration: decorationBAI2_12,
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: boldBAI3_12,
                decoration: decorationBAI3_12,
                margin: [0, 7, 0, 7],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 13
        alignment: "center",
        columns: [
          {
            text: "13. Inquieto, inseguro",
            alignment: "left",
            style: { fontSize: 11 },
            margin: [0, 7, 0, 7],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldBAI0_13,
                decoration: decorationBAI0_13,
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: boldBAI1_13,
                decoration: decorationBAI1_13,
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: boldBAI2_13,
                decoration: decorationBAI2_13,
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: boldBAI3_13,
                decoration: decorationBAI3_13,
                margin: [0, 7, 0, 7],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 14
        alignment: "center",
        columns: [
          {
            text: "14. Con miedo a perder el control",
            alignment: "left",
            style: { fontSize: 11 },
            margin: [0, 7, 0, 7],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldBAI0_14,
                decoration: decorationBAI0_14,
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: boldBAI1_14,
                decoration: decorationBAI1_14,
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: boldBAI2_14,
                decoration: decorationBAI2_14,
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: boldBAI3_14,
                decoration: decorationBAI3_14,
                margin: [0, 7, 0, 7],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 15
        alignment: "center",
        columns: [
          {
            text: "15. Con sensación de ahogo",
            alignment: "left",
            style: { fontSize: 11 },
            margin: [0, 7, 0, 7],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldBAI0_15,
                decoration: decorationBAI0_15,
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: boldBAI1_15,
                decoration: decorationBAI1_15,
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: boldBAI2_15,
                decoration: decorationBAI2_15,
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: boldBAI3_15,
                decoration: decorationBAI3_15,
                margin: [0, 7, 0, 7],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 16
        alignment: "center",
        columns: [
          {
            text: "16. Con temor a morir",
            alignment: "left",
            style: { fontSize: 11 },
            margin: [0, 7, 0, 7],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldBAI0_16,
                decoration: decorationBAI0_16,
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: boldBAI1_16,
                decoration: decorationBAI1_16,
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: boldBAI2_16,
                decoration: decorationBAI2_16,
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: boldBAI3_16,
                decoration: decorationBAI3_16,
                margin: [0, 7, 0, 7],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 17
        alignment: "center",
        columns: [
          {
            text: "17. Con miedo",
            alignment: "left",
            style: { fontSize: 11 },
            margin: [0, 7, 0, 7],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldBAI0_17,
                decoration: decorationBAI0_17,
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: boldBAI1_17,
                decoration: decorationBAI1_17,
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: boldBAI2_17,
                decoration: decorationBAI2_17,
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: boldBAI3_17,
                decoration: decorationBAI3_17,
                margin: [0, 7, 0, 7],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 18
        alignment: "center",
        columns: [
          {
            text: "18. Con problemas digestivos",
            alignment: "left",
            style: { fontSize: 11 },
            margin: [0, 7, 0, 7],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldBAI0_18,
                decoration: decorationBAI0_18,
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: boldBAI1_18,
                decoration: decorationBAI1_18,
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: boldBAI2_18,
                decoration: decorationBAI2_18,
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: boldBAI3_18,
                decoration: decorationBAI3_18,
                margin: [0, 7, 0, 7],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 19
        alignment: "center",
        columns: [
          {
            text: "19. Con desvanecimientos",
            alignment: "left",
            style: { fontSize: 11 },
            margin: [0, 7, 0, 7],
            margin: [0, 7, 0, 7],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldBAI0_19,
                decoration: decorationBAI0_19,
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: boldBAI1_19,
                decoration: decorationBAI1_19,
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: boldBAI2_19,
                decoration: decorationBAI2_19,
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: boldBAI3_19,
                decoration: decorationBAI3_19,
                margin: [0, 7, 0, 7],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 20
        alignment: "center",
        columns: [
          {
            text: "20. Con rubor facial",
            alignment: "left",
            style: { fontSize: 11 },
            margin: [0, 7, 0, 7],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldBAI0_20,
                decoration: decorationBAI0_20,
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: boldBAI1_20,
                decoration: decorationBAI1_20,
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: boldBAI2_20,
                decoration: decorationBAI2_20,
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: boldBAI3_20,
                decoration: decorationBAI3_20,
                margin: [0, 7, 0, 7],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 21
        alignment: "center",
        columns: [
          {
            text: "21. Con sudores, fríos o calientes",
            alignment: "left",
            style: { fontSize: 11 },
            margin: [0, 7, 0, 7],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldBAI0_21,
                decoration: decorationBAI0_21,
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: boldBAI1_21,
                decoration: decorationBAI1_21,
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: boldBAI2_21,
                decoration: decorationBAI2_21,
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: boldBAI3_21,
                decoration: decorationBAI3_21,
                margin: [0, 7, 0, 7],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Suma
        alignment: "center",
        columns: [
          {
            text: "Para codificación del especialista:",
            bold: true,
            alignment: "right",
            style: { fontSize: 11 },
            margin: [0, 10, 0, 10],
          },
          {
            //Respuestas
            columns: [
              {
                alignment: "right",
                text: contadorBAI_0,
                bold: true,
                //decoration: "underline",
                margin: [0, 10, -9, 0],
              },
              {
                text: "+",
                bold: true,
                //decoration: "underline",
                margin: [-20, 10, -32, 0],
              },
              {
                text: contadorBAI_1,
                bold: true,
                //decoration: "",
                margin: [0, 10, -9, 0],
              },
              {
                text: "+",
                bold: true,
                //decoration: "underline",
                margin: [-35, 10, -35, 0],
              },
              {
                text: contadorBAI_2,
                bold: true,
                //decoration: "",
                margin: [-9, 10, 0, 0],
              },
              {
                text: "+",
                bold: true,
                //decoration: "underline",
                margin: [-50, 10, -35, 0],
              },
              {
                text: contadorBAI_3,
                bold: true,
                //decoration: "",
                margin: [-29, 10, 0, 0],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Suma
        alignment: "right",
        columns: [
          {
            text: "Total puntuación:",
            bold: true,
            alignment: "right",
            style: { fontSize: 11 },
            margin: [0, 20, 0, 20],
          },
          {
            //Respuestas
            columns: [
              {
                alignment: "right",
                text: puntuacionBAITotal,
                alignment: "center",
                bold: true,
                style: { fontSize: 14 },
                decoration: "underline",
                margin: [0, 19, 0, 0],
              },
            ],
          },
        ],
      },
      {
        //Suma
        alignment: "right",
        columns: [
          {
            text: "",
            bold: true,
            alignment: "right",
            style: { fontSize: 11 },
            margin: [0, 0, 0, 0],
          },
          {
            //Respuestas
            columns: [
              {
                alignment: "right",
                text: veredictoBAI,
                alignment: "center",
                bold: true,
                style: { fontSize: 12 },
                decoration: "",
                margin: [0, -15, 0, 10],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
    ],
    styles: {
      header: {
        fontSize: 16,
        bold: true,
      },
      subheader: {
        fontSize: 15,
        bold: true,
      },
      quote: {
        italics: true,
      },
      small: {
        fontSize: 8,
      },
    },
    defaultStyle: {
      columnGap: 20,
    },
  };

  //PDF del cuestionario PHQ
  let depresionDefinition = {
    content: [
      {
        text: "Resultados del cuestionario PHQ-9 (Patience Health Questionnarie)",
        style: "subheader",
        alignment: "center",
        color: "#d58e76",
        //pageBreak: "before",
      },
      "\n",
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Presentacion
        alignment: "center",
        columns: [
          {
            text: "Preguntas Filtro",
            style: { fontSize: 15 },
            bold: true,
            margin: [0, 8, 0, 5],
          },
          {
            //Respuestas MINI
            columns: [
              {
                text: "Para nada",
                bold: true,
                margin: [0, 3, 0, 0],
              },
              {
                text: "Leve-mente",
                bold: true,
                margin: [0, 3, 0, 0],
              },
              {
                text: "Modera-damente",
                style: { fontSize: 11 },
                bold: true,
                margin: [0, 4, 0, 0],
              },
              {
                text: "Severa-mente",
                bold: true,
                margin: [0, 3, 0, 0],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 1
        alignment: "center",
        columns: [
          {
            text: "1. Poco interés o placer en hacer cosas",
            alignment: "left",
            style: { fontSize: 11 },
            margin: [0, 7, 0, 5],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldPHQ0_1,
                decoration: decorationPHQ0_1,
                margin: [0, 7, 0, 0],
              },
              {
                text: "1",
                bold: boldPHQ1_1,
                decoration: decorationPHQ1_1,
                margin: [0, 7, 0, 0],
              },
              {
                text: "2",
                bold: boldPHQ2_1,
                decoration: decorationPHQ2_1,
                margin: [0, 7, 0, 0],
              },
              {
                text: "3",
                bold: boldPHQ3_1,
                decoration: decorationPHQ3_1,
                margin: [0, 7, 0, 0],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 2
        alignment: "center",
        columns: [
          {
            text: "2. Se ha sentido decaído(a), deprimido(a) o sin esperanzas",
            alignment: "left",
            style: { fontSize: 11 },
            margin: [0, 7, 0, 5],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldPHQ0_2,
                decoration: decorationPHQ0_2,
                margin: [0, 13, 0, 0],
              },
              {
                text: "1",
                bold: boldPHQ1_2,
                decoration: decorationPHQ1_2,
                margin: [0, 13, 0, 0],
              },
              {
                text: "2",
                bold: boldPHQ2_2,
                decoration: decorationPHQ2_2,
                margin: [0, 13, 0, 0],
              },
              {
                text: "3",
                bold: boldPHQ3_2,
                decoration: decorationPHQ3_2,
                margin: [0, 13, 0, 0],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 3
        alignment: "center",
        columns: [
          {
            text: "3. Ha tenido dificultad para quedarse o permanecer dormido(a), o ha dormido demasiado",
            alignment: "left",
            style: { fontSize: 11 },
            margin: [0, 7, 0, 5],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldPHQ0_3,
                decoration: decorationPHQ0_3,
                margin: [0, 13, 0, 0],
              },
              {
                text: "1",
                bold: boldPHQ1_3,
                decoration: decorationPHQ1_3,
                margin: [0, 13, 0, 0],
              },
              {
                text: "2",
                bold: boldPHQ2_3,
                decoration: decorationPHQ2_3,
                margin: [0, 13, 0, 0],
              },
              {
                text: "3",
                bold: boldPHQ3_3,
                decoration: decorationPHQ3_3,
                margin: [0, 13, 0, 0],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 4
        alignment: "center",
        columns: [
          {
            text: "4. Se ha sentido cansado(a) o con poca energía",
            alignment: "left",
            style: { fontSize: 11 },
            margin: [0, 7, 0, 5],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldPHQ0_4,
                decoration: decorationPHQ0_4,
                margin: [0, 7, 0, 0],
              },
              {
                text: "1",
                bold: boldPHQ1_4,
                decoration: decorationPHQ1_4,
                margin: [0, 7, 0, 0],
              },
              {
                text: "2",
                bold: boldPHQ2_4,
                decoration: decorationPHQ2_4,
                margin: [0, 7, 0, 0],
              },
              {
                text: "3",
                bold: boldPHQ3_4,
                decoration: decorationPHQ3_4,
                margin: [0, 7, 0, 0],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 5
        alignment: "center",
        columns: [
          {
            text: "5. Sin apetito o ha comido en exceso",
            alignment: "left",
            style: { fontSize: 11 },
            margin: [0, 7, 0, 5],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldPHQ0_5,
                decoration: decorationPHQ0_5,
                margin: [0, 7, 0, 0],
              },
              {
                text: "1",
                bold: boldPHQ1_5,
                decoration: decorationPHQ1_5,
                margin: [0, 7, 0, 0],
              },
              {
                text: "2",
                bold: boldPHQ2_5,
                decoration: decorationPHQ2_5,
                margin: [0, 7, 0, 0],
              },
              {
                text: "3",
                bold: boldPHQ3_5,
                decoration: decorationPHQ3_5,
                margin: [0, 7, 0, 0],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 6.
        alignment: "center",
        columns: [
          {
            text: "6.  Se ha sentido mal con usted mismo(a) – o que es un fracaso o que ha quedado mal con usted mismo(a) o con su familia",
            alignment: "left",
            style: { fontSize: 11 },
            margin: [0, 7, 0, 5],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldPHQ0_6,
                decoration: decorationPHQ0_6,
                margin: [0, 19, 0, 0],
              },
              {
                text: "1",
                bold: boldPHQ1_6,
                decoration: decorationPHQ1_6,
                margin: [0, 19, 0, 0],
              },
              {
                text: "2",
                bold: boldPHQ2_6,
                decoration: decorationPHQ2_6,
                margin: [0, 19, 0, 0],
              },
              {
                text: "3",
                bold: boldPHQ3_6,
                decoration: decorationPHQ3_6,
                margin: [0, 19, 0, 0],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 7
        alignment: "center",
        columns: [
          {
            text: "7. Ha tenido dificultad para concentrarse en ciertas actividades, tales como leer el periódico o ver la televisión",
            alignment: "left",
            style: { fontSize: 11 },
            margin: [0, 7, 0, 5],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldPHQ0_7,
                decoration: decorationPHQ0_7,
                margin: [0, 19, 0, 0],
              },
              {
                text: "1",
                bold: boldPHQ1_7,
                decoration: decorationPHQ1_7,
                margin: [0, 19, 0, 0],
              },
              {
                text: "2",
                bold: boldPHQ2_7,
                decoration: decorationPHQ2_7,
                margin: [0, 19, 0, 0],
              },
              {
                text: "3",
                bold: boldPHQ3_7,
                decoration: decorationPHQ3_7,
                margin: [0, 19, 0, 0],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 8
        alignment: "center",
        columns: [
          {
            text: "8.  ¿Se ha movido o hablado tan lento que otras personas podrían haberlo notado? o lo contrario – muy inquieto(a) o agitado(a) que ha estado moviéndose mucho más de lo normal",
            alignment: "left",
            style: { fontSize: 11 },
            margin: [0, 7, 0, 5],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldPHQ0_8,
                decoration: decorationPHQ0_8,
                margin: [0, 25, 0, 0],
              },
              {
                text: "1",
                bold: boldPHQ1_8,
                decoration: decorationPHQ1_8,
                margin: [0, 25, 0, 0],
              },
              {
                text: "2",
                bold: boldPHQ2_8,
                decoration: decorationPHQ2_8,
                margin: [0, 25, 0, 0],
              },
              {
                text: "3",
                bold: boldPHQ3_8,
                decoration: decorationPHQ3_8,
                margin: [0, 25, 0, 0],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Pregunta 9
        alignment: "center",
        columns: [
          {
            text: "9. Pensamientos de que estaría mejor muerto(a) o de lastimarse de alguna manera",
            alignment: "left",
            style: { fontSize: 11 },
            margin: [0, 7, 0, 5],
          },
          {
            //Respuestas
            columns: [
              {
                text: "0",
                bold: boldPHQ0_9,
                decoration: decorationPHQ0_9,
                margin: [0, 13, 0, 0],
              },
              {
                text: "1",
                bold: boldPHQ1_9,
                decoration: decorationPHQ1_9,
                margin: [0, 13, 0, 0],
              },
              {
                text: "2",
                bold: boldPHQ2_9,
                decoration: decorationPHQ2_9,
                margin: [0, 13, 0, 0],
              },
              {
                text: "3",
                bold: boldPHQ3_9,
                decoration: decorationPHQ3_9,
                margin: [0, 13, 0, 0],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Suma
        alignment: "center",
        columns: [
          {
            text: "Para codificación del especialista",
            bold: true,
            alignment: "right",
            style: { fontSize: 11 },
            margin: [0, 10, 0, 10],
          },
          {
            //Respuestas
            columns: [
              {
                alignment: "right",
                text: contadorPHQ_0,
                bold: true,
                //decoration: "underline",
                margin: [0, 10, -9, 0],
              },
              {
                text: "+",
                bold: true,
                //decoration: "underline",
                margin: [-20, 10, -32, 0],
              },
              {
                text: contadorPHQ_1,
                bold: true,
                //decoration: "",
                margin: [0, 10, -9, 0],
              },
              {
                text: "+",
                bold: true,
                //decoration: "underline",
                margin: [-35, 10, -35, 0],
              },
              {
                text: contadorPHQ_2,
                bold: true,
                //decoration: "",
                margin: [-9, 10, 0, 0],
              },
              {
                text: "+",
                bold: true,
                //decoration: "underline",
                margin: [-50, 10, -35, 0],
              },
              {
                text: contadorPHQ_3,
                bold: true,
                //decoration: "",
                margin: [-29, 10, 0, 0],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        //Suma
        alignment: "right",
        columns: [
          {
            text: "Total puntuación:",
            bold: true,
            alignment: "right",
            style: { fontSize: 11 },
            margin: [0, 25, 0, 25],
          },
          {
            //Respuestas
            columns: [
              {
                alignment: "right",
                text: puntuacionPHQTotal,
                alignment: "center",
                bold: true,
                style: { fontSize: 14 },
                decoration: "underline",
                margin: [0, 24, 0, 0],
              },
            ],
          },
        ],
      },
      {
        //Suma
        alignment: "right",
        columns: [
          {
            text: "",
            bold: true,
            alignment: "right",
            style: { fontSize: 11 },
            margin: [0, 0, 0, 0],
          },
          {
            //Respuestas
            columns: [
              {
                alignment: "right",
                text: veredictoPHQ,
                alignment: "center",
                bold: true,
                style: { fontSize: 12 },
                decoration: "",
                margin: [0, -15, 0, 10],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
      {
        text: "Si marcó cualquiera de los problemas, ¿qué tanta dificultad le han dado estos problemas para hacer su trabajo, encargarse de las tareas del hogar, o llevarse bien con otras personas?",
        //style: "subheader",
        style: { fontSize: 11 },
        alignment: "center",
        margin: [0, 5, 0, 0],
        //color: "#d58e76",
        //pageBreak: 'before'
      },
      {
        alignment: "justify",
        //Respuestas
        columns: [
          {
            text: "No ha sido \ndificil",
            bold: boldPHQ0_D,
            decoration: decorationPHQ0_D,
            alignment: "center",
            style: { fontSize: 11 },
            margin: [0, 10, 0, 10],
          },
          {
            text: "Un poco\ndificil",
            bold: boldPHQ1_D,
            decoration: decorationPHQ1_D,
            alignment: "center",
            style: { fontSize: 11 },
            margin: [0, 10, 0, 0],
          },
          {
            text: "Muy\ndificil",
            bold: boldPHQ2_D,
            decoration: decorationPHQ2_D,
            alignment: "center",
            style: { fontSize: 11 },
            margin: [0, 10, 0, 0],
          },
          {
            text: "Extremadamente\ndificil",
            bold: boldPHQ3_D,
            decoration: decorationPHQ3_D,
            alignment: "center",
            style: { fontSize: 11 },
            margin: [0, 10, 0, 0],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      },
    ],
    styles: {
      header: {
        fontSize: 16,
        bold: true,
      },
      subheader: {
        fontSize: 15,
        bold: true,
      },
      quote: {
        italics: true,
      },
      small: {
        fontSize: 8,
      },
    },
    defaultStyle: {
      columnGap: 20,
    },
  };

  for (const response of responses) {
    // //Deshabilitar para quitar respuestas de whatsapp
    await twilio.sendTextMessage(req.body.WaId, response.text.text[0]);
  }

  //Recibe valor del intent emparejado
  let intentEmparejado = process.env.INTENT_EMPAREJADO;
  console.log(
    "[dialogflowTwilioWebhook] Intent que se ve desde DTW: ",
    intentEmparejado
  );
  //GUARDA LOS DATOS EN LA DB
  //Wacha si ya existe
  const yaExiste = await participanteSchema.findOne({
    WaNumber: messageComesFromPhone,
  });

  if (yaExiste === null) {
    //Si no existe un registro con este numero, se crea uno nuevo
    await axios.post(`${process.env.ACCESS_URI}/api/participantes`, {
    // await axios.post("http://localhost:4000/api/participantes", {
      WaID: session,
      WaNumber: messageComesFromPhone,
      ansiedadFileLink: ansiedadFileLink,
    });
  } else {
    await participanteSchema.findOneAndUpdate(
      { WaNumber: messageComesFromPhone },
      { WaID: session }
      //{ ansiedadFileLink: process.env.fileURL },
    );
    console.log("ya existe raza, pero se actualizó");
  }
  process.env.WA_NUMBER = messageComesFromPhone;

  //A partir del intent webhook
  //if (intentEmparejado === "intent-despedida") {
  //if (intentEmparejado === "webhookDemo") {
  if (
    puntuacionCuestionarioPHQDificil !== "" ||
    puntuacionCuestionarioBAI_19 !== ""
  ) {
    //CREA EL ARCHIVO PDF
    const printer = new PdfPrinter(fonts);
    const fileName = messageComesFromPhone;
    //console.log("[dialogflowTwilioWebhook] nombre archivo: ", fileName);
    let pdfDoc = printer.createPdfKitDocument(docDefinition);
    let nombreArchivo = "./createdFiles/" + fileName + ".pdf";
    let nombreCorto = [fileName, ".pdf"];
    nombreCorto = nombreCorto.join("");
    console.log("[DTW] nombre archivo: ", nombreCorto);
    pdfDoc.pipe(fs.createWriteStream(nombreArchivo));

    pdfDoc.end();
    let stream;
    let mergedFilePathName;

    // fileMergedName = `./createdFiles/${messageComesFromPhone}merged.pdf`;
    //   pdfDoc = printer.createPdfKitDocument(docDefinition);
    //   pdfDoc.pipe(fs.createWriteStream(fileMergedName));
    //   pdfDoc.end();

    //PDF ANSIEDAD
    let fileAnsiedadName;
    let fileAnsiedadCorto;
    const printerAnsiedad = new PdfPrinter(fonts);
    if (puntuacionFiltroDepresion <= 1 && puntuacionFiltroAnsiedad >= 2) {
      fileAnsiedadName = `./createdFiles/${messageComesFromPhone}Ansiedad.pdf`;
      fileAnsiedadCorto = `${messageComesFromPhone}Ansiedad.pdf`;
      let pdfDocAnsiedad =
        printerAnsiedad.createPdfKitDocument(ansiedadDefinition);
      console.log("[DTW] nombre archivo ansiedad", fileAnsiedadCorto);
      pdfDocAnsiedad.pipe(fs.createWriteStream(fileAnsiedadName));
      pdfDocAnsiedad.end();

      //Mergea los pdfs con filtros
      mergedFilePathName = `./createdFiles/${messageComesFromPhone}merged.pdf`;
      merge(
        [nombreArchivo, fileAnsiedadName],
        mergedFilePathName,
        function (err) {
          if (err) return console.log("El error: ", err);

          console.log("Sucessfully merged con ansiedad!");
        }
      );
      // mergedFileName = `${messageComesFromPhone}merged.pdf`;
    }

    //PDF DEPRESION
    let fileDepresionCorto;
    let fileDepresionName;
    if (puntuacionFiltroDepresion >= 2 && puntuacionFiltroAnsiedad <= 1) {
      const printerDepresion = new PdfPrinter(fonts);
      fileDepresionName = `./createdFiles/${messageComesFromPhone}Depresion.pdf`;
      fileDepresionCorto = `${messageComesFromPhone}Depresion.pdf`;
      let pdfDocDepresion =
        printerDepresion.createPdfKitDocument(depresionDefinition);
      console.log("[DTW] nombre archivo Depresion", fileDepresionCorto);
      pdfDocDepresion.pipe(fs.createWriteStream(fileDepresionName));
      pdfDocDepresion.end();

      //Mergea los PDFs
      mergedFilePathName = `./createdFiles/${messageComesFromPhone}merged.pdf`;
      merge(
        [nombreArchivo, fileDepresionName],
        mergedFilePathName,
        function (err) {
          if (err) return console.log("El error: ", err);

          console.log("Sucessfully merged con depresion!");
        }
      );
    }

    //PDF AMBAS
    let fileAnsiedadFirstName;
    let fileAmbasName;
    if (puntuacionFiltroDepresion >= 2 && puntuacionFiltroAnsiedad >= 2) {
      const printerAnsiedadFirst = new PdfPrinter(fonts);
      fileAnsiedadFirstName = `./createdFiles/${messageComesFromPhone}AnsiedadFirst.pdf`;
      let pdfDocAnsiedadFirst =
        printerAnsiedadFirst.createPdfKitDocument(ansiedadDefinition);
      pdfDocAnsiedadFirst.pipe(fs.createWriteStream(fileAnsiedadFirstName));
      pdfDocAnsiedadFirst.end();

      //building el segundo
      const printerDepresionSecond = new PdfPrinter(fonts);
      fileAmbasName = `./createdFiles/${messageComesFromPhone}DepresionSecond.pdf`;
      let pdfDocDepresionSecond =
        printerDepresionSecond.createPdfKitDocument(depresionDefinition);
      pdfDocDepresionSecond.pipe(fs.createWriteStream(fileAmbasName));
      pdfDocDepresionSecond.end();

      //merge de todo
      mergedFilePathName = `./createdFiles/${messageComesFromPhone}merged.pdf`;
      merge(
        [nombreArchivo, fileAnsiedadFirstName, fileAmbasName],
        mergedFilePathName,
        function (err) {
          if (err) return console.log("El error: ", err);

          console.log("Sucessfully merged con depresion!");
        }
      );
    }

    //SUBE EL ARCHIVO AL BUCKET S3
    if (puntuacionFiltroDepresion <= 1 && puntuacionFiltroAnsiedad <= 1)
      stream = fs.createReadStream(nombreArchivo);
    if (puntuacionFiltroDepresion >= 2 && puntuacionFiltroAnsiedad <= 1)
      stream = fs.createReadStream(mergedFilePathName);
    if (puntuacionFiltroDepresion <= 1 && puntuacionFiltroAnsiedad >= 2)
      stream = fs.createReadStream(mergedFilePathName);
    if (puntuacionFiltroDepresion >= 2 && puntuacionFiltroAnsiedad >= 2) {
      stream = fs.createReadStream(mergedFilePathName);
      // console.log("stream: ", stream);
    }

    //Sube al bucket de S3 el archivo
    let bucket = "test-files-node"; //Bucket de datos seleccionado
    let file = nombreCorto; //Obtenido de la comunicación con el chatbot (Número_Whatsapp.pdf)

    uploadBucket(bucket, file, stream); //Ejecutar función || Subir archivo al bucket
    // uploadBucket(bucket, file, stream); //Ejecutar función || Subir archivo al bucket x2
    const fileURL = `https://test-files-node.s3.us-east-2.amazonaws.com/${nombreCorto}`;
    let actualizacionParticipante = {
      ansiedadFileLink: fileURL,
      puntuacionFiltroAnsiedad: puntuacionFiltroAnsiedad,
      puntuacionFiltroDepresion: puntuacionFiltroDepresion,
      puntuacionTotalBAI: puntuacionBAITotal,
      puntuacionTotalPHQ: puntuacionPHQTotal,
      veredictoPHQ: veredictoPHQ,
      veredictoBAI: veredictoBAI,
      fechaParticipacionOnly: fechaParticipacionCorta,
    };
    await participanteSchema.findOneAndUpdate(
      //Adición de la URL del archivo en la base de datos de MongoDB
      { WaNumber: messageComesFromPhone },
      actualizacionParticipante
    );
    console.log("URL del archivo recién cargado: ", fileURL);
    console.log(
      "Esto contiene el arreglo depresivo: ",
      puntuacionCuestionarioPHQ
    );
    console.log("Numero total de 0: ", contadorPHQ_0);
    console.log("Numero total de 1: ", contadorPHQ_1);
    console.log("Numero total de 2: ", contadorPHQ_2);
    console.log("Numero total de 3: ", contadorPHQ_3);
    //ansioso
    console.log(
      "Esto contiene el arreglo ansioso: ",
      puntuacionCuestionarioBAI
    );
    console.log("Numero total de 0: ", contadorBAI_0);
    console.log("Numero total de 1: ", contadorBAI_1);
    console.log("Numero total de 2: ", contadorBAI_2);
    console.log("Numero total de 3: ", contadorBAI_3);
  }

  if (intentEmparejado === "intent-despedida") {
    // if (intentEmparejado === "webhookDemo-next") {
    console.log("llega aqui");
    let bucket = "test-files-node"; //Bucket de datos seleccionado
    let file = `${messageComesFromPhone}.pdf`;
    let mergedFilePathName = `./createdFiles/${messageComesFromPhone}merged.pdf`;
    let stream = fs.createReadStream(mergedFilePathName);
    uploadBucket(bucket, file, stream);
    const checadoPorEspecialista = false;
    let actualizacionParticipante = {
      checadoPorEspecialista: checadoPorEspecialista,
    };
    await participanteSchema.findOneAndUpdate(
      //Adición de la URL del archivo en la base de datos de MongoDB
      { WaNumber: messageComesFromPhone },
      actualizacionParticipante
    );
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

//console.log("stream: ", stream);
const uploadBucket = (bucketName, file, stream) => {
  //let stream = fs.createReadStream(nombreArchivo);
  const params = {
    Bucket: bucketName, //Nombre del bucket, establecido en la linea 678
    Key: file, //Nombre del archivo,
    //Body: fs.createReadStream(nombreArchivo), //Contenido del archivo\
    Body: stream,
  };
  console.log("subido al bucket");
  return storage.upload(params).promise();
};

console.log("[dialogflowTwilioWebhook] Twilio Webhook Workin'");

module.exports = dialogflowTwilioWebhook;
