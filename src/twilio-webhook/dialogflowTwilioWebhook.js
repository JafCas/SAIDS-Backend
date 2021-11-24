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

/*const uploadBucket = (bucketName, file) => {
  const params = {
      Bucket: bucketName,
      //Bucket: "test-files-node",
      Key: file,
      //Key: "texttest.txt",
      Body: "hello world"
  };
  return storage.upload(params).promise();
}*/

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

  //Fetch a la base de datos
  let registroParticipante = await participanteSchema.findOne({
    WaNumber: messageComesFromPhone,
  });

  let nombresParticipante,
    apellidoParticipante,
    edadParticipante,
    emailParticipante,
    fechaParticipacion,
    preguntaAnsiedad_1,
    preguntaAnsiedad_2,
    preguntaDepresion_1,
    preguntaDepresion_2;
  if (registroParticipante === null) {
    nombresParticipante = "";
    apellidoParticipante = "";
    edadParticipante = "";
    emailParticipante = "";
    fechaParticipacion = "";
    preguntaAnsiedad_1 = "";
    preguntaAnsiedad_2 = "";
    preguntaDepresion_1 = "";
    preguntaDepresion_2 = "";
  } else {
    nombresParticipante = registroParticipante.nombresParticipante;
    apellidoParticipante = registroParticipante.apellidoParticipante;
    edadParticipante = registroParticipante.edadParticipante;
    emailParticipante = registroParticipante.emailParticipante;
    fechaParticipacion = registroParticipante.updatedAt;
    preguntaAnsiedad_1 = registroParticipante.preguntaAnsiedad_1;
    preguntaAnsiedad_2 = registroParticipante.preguntaAnsiedad_2;
    preguntaDepresion_1 = registroParticipante.preguntaDepresion_1;
    preguntaDepresion_2 = registroParticipante.preguntaDepresion_2;
  }

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

  /** PUNTUACIONES  */
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
            text: "No. telefonico:",
          },
          {
            text: "email:",
          },
        ],
      },
      {
        alignment: "center",
        columns: [
          {
            text: messageComesFromPhone,
          },
          {
            text: emailParticipante,
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

  for (const response of responses) {
    //await twilio.sendTextMessage(req.body.WaId, response.text.text[0]);
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
    });
  } else {
    await participanteSchema.findOneAndUpdate(
      { WaNumber: messageComesFromPhone },
      { WaID: session }
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
    //let fileName = ["./createdFiles/", ]
    let nombreArchivo = "./createdFiles/" + fileName + ".pdf";
    let nombreCorto = [fileName, ".pdf"];
    nombreCorto = nombreCorto.join("");
    console.log("[DTW] nombre archivo: ", nombreCorto);
    pdfDoc.pipe(fs.createWriteStream(nombreArchivo));
    pdfDoc.end();
    process.env.NOMBRE_DEL_ARCHIVO = nombreArchivo;

    process.env.ID_PASADO = session;

    //SUBE EL ARCHIVO AL BUCKET S3
    const uploadBucket = (bucketName, file) => {
      const stream = fs.createReadStream(nombreArchivo);
      const params = {
        Bucket: bucketName,
        Key: file,
        Body: stream,
      };
      return storage.upload(params).promise();
    };

    //Sube al bucket de S3 el archivo
    let bucket = "test-files-node";
    let file = nombreCorto;
    uploadBucket(bucket, file);
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
