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

  //SI la puntuacion de las preguntas filtro del BAI son mayores a 1
  if (puntuacionFiltroAnsiedad >= 2) {
    puntuacionCuestionarioBAI = registroParticipante.puntuacionCuestionarioBAI;
  }

  //SI la puntuacion de las preguntas filtro del PHQ son mayores a 1
  if (puntuacionFiltroDepresion >= 2) {
    puntuacionCuestionarioPHQ = registroParticipante.puntuacionCuestionarioPHQ;
  }

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
  if (puntuacionFiltroAnsiedad >= 1) {
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
  let contadorTotalPHQ_1 = contadorPHQ_1 * 1;
  let contadorTotalPHQ_2 = contadorPHQ_2 * 2;
  let contadorTotalPHQ_3 = contadorPHQ_3 * 3;

  puntuacionPHQTotal =
    contadorTotalPHQ_1 + contadorTotalPHQ_2 + contadorTotalPHQ_3;

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
                bold: true,
                decoration: "underline",
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: false,
                decoration: "",
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
                bold: true,
                decoration: "underline",
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: false,
                decoration: "",
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
                bold: true,
                decoration: "underline",
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: false,
                decoration: "",
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
                bold: true,
                decoration: "underline",
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: false,
                decoration: "",
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
                bold: true,
                decoration: "underline",
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: false,
                decoration: "",
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
                bold: true,
                decoration: "underline",
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: false,
                decoration: "",
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
                bold: true,
                decoration: "underline",
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: false,
                decoration: "",
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
                bold: true,
                decoration: "underline",
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: false,
                decoration: "",
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
                bold: true,
                decoration: "underline",
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: false,
                decoration: "",
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
                bold: true,
                decoration: "underline",
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: false,
                decoration: "",
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
                bold: true,
                decoration: "underline",
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: false,
                decoration: "",
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
                bold: true,
                decoration: "underline",
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: false,
                decoration: "",
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
                bold: true,
                decoration: "underline",
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: false,
                decoration: "",
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
                bold: true,
                decoration: "underline",
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: false,
                decoration: "",
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
                bold: true,
                decoration: "underline",
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: false,
                decoration: "",
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
                bold: true,
                decoration: "underline",
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: false,
                decoration: "",
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
                bold: true,
                decoration: "underline",
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: false,
                decoration: "",
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
                bold: true,
                decoration: "underline",
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: false,
                decoration: "",
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
                bold: true,
                decoration: "underline",
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: false,
                decoration: "",
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
                bold: true,
                decoration: "underline",
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: false,
                decoration: "",
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
                bold: true,
                decoration: "underline",
                margin: [0, 7, 0, 7],
              },
              {
                text: "1",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "2",
                bold: false,
                decoration: "",
                margin: [0, 7, 0, 7],
              },
              {
                text: "3",
                bold: false,
                decoration: "",
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
                text: "0",
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
                text: "1",
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
                text: "2",
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
                text: "3",
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
                text: "26",
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
    await twilio.sendTextMessage(req.body.WaId, response.text.text[0]);
  }

  //Recibe valor del intent emparejado
  var intentEmparejado = process.env.INTENT_EMPAREJADO;
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
    await axios.post("http://localhost:4000/api/participantes", {
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
  if (intentEmparejado === "webhookDemo") {
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

    //console.log("stream: ", stream);
    const uploadBucket = (bucketName, file) => {
      //let stream = fs.createReadStream(nombreArchivo);
      const params = {
        Bucket: bucketName, //Nombre del bucket, establecido en la linea 678
        Key: file, //Nombre del archivo,
        //Body: fs.createReadStream(nombreArchivo), //Contenido del archivo\
        Body: stream,
      };
      return storage.upload(params).promise();
    };

    //Sube al bucket de S3 el archivo
    let bucket = "test-files-node"; //Bucket de datos seleccionado
    let file = nombreCorto; //Obtenido de la comunicación con el chatbot (Número_Whatsapp.pdf)
    // if (puntuacionFiltroDepresion <= 1 && puntuacionFiltroAnsiedad <= 1) {
    //   file = nombreCorto;
    //   uploadBucket(bucket, file); //Ejecutar función || Subir archivo al bucket
    // }
    // if (puntuacionFiltroDepresion >= 2 && puntuacionFiltroAnsiedad <= 1) {
    //   file = mergedFileName;
    //   uploadBucket(bucket, file); //Ejecutar función || Subir archivo al bucket
    // }
    uploadBucket(bucket, file); //Ejecutar función || Subir archivo al bucket
    const fileURL = `https://test-files-node.s3.us-east-2.amazonaws.com/${nombreCorto}`;
    let actualizacionParticipante = {
      ansiedadFileLink: fileURL,
      puntuacionFiltroAnsiedad: puntuacionFiltroAnsiedad,
      puntuacionFiltroDepresion: puntuacionFiltroDepresion,
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
console.log("[dialogflowTwilioWebhook] Twilio Webhook Workin'");

module.exports = dialogflowTwilioWebhook;
