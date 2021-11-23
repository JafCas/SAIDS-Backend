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
    fechaParticipacion;
  if (registroParticipante === null) {
    nombresParticipante = "";
    apellidoParticipante = "";
    edadParticipante = "";
    emailParticipante = "";
    fechaParticipacion = "";
  } else {
    nombresParticipante = registroParticipante.nombresParticipante;
    apellidoParticipante = registroParticipante.apellidoParticipante;
    edadParticipante = registroParticipante.edadParticipante;
    emailParticipante = registroParticipante.emailParticipante;
    fechaParticipacion = registroParticipante.updatedAt;
  }

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
  console.log("fecha en string: ", fechaParticipacionOnly);
  fechaParticipacionOnly = [
    "\nFecha de participación:",
    fechaParticipacionOnly,
    "\n",
  ];
  fechaParticipacionOnly = fechaParticipacionOnly.join(" ");
  //let fechaParticipacionOnly = fechaParticipacion[0];
  let docDefinition = {
    content: [
      {
        text: nombreEdadParticipante,
        //text: "Leonel Jafet Castillo Martinez\n 23 años",
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
            //text: "correo@dominio.com",
            text: emailParticipante,
          },
        ],
      },
      {
        text: fechaParticipacionOnly,
        //text: "\nFecha de participación: dd/mm/aaaa\n\n",
        margin: [50, 0, 0, 0],
      },
      {
        text: "Resultados de preguntas filtro",
        style: "subheader",
      },
      {
        alignment: "justify",
        columns: [
          {
            text: "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Malit profecta versatur nomine ocurreret multavit, officiis viveremus aeternum superstitio suspicor alia nostram, quando nostros congressus susceperant concederetur leguntur iam, vigiliae democritea tantopere causae, atilii plerumque ipsas potitur pertineant multis rem quaeri pro, legendum didicisse credere ex maluisset per videtis. Cur discordans praetereat aliae ruinae dirigentur orestem eodem, praetermittenda divinum. Collegisti, deteriora malint loquuntur officii cotidie finitas referri doleamus ambigua acute. Adhaesiones ratione beate arbitraretur detractis perdiscere, constituant hostis polyaeno. Diu concederetur.",
          },
          {
            text: "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Malit profecta versatur nomine ocurreret multavit, officiis viveremus aeternum superstitio suspicor alia nostram, quando nostros congressus susceperant concederetur leguntur iam, vigiliae democritea tantopere causae, atilii plerumque ipsas potitur pertineant multis rem quaeri pro, legendum didicisse credere ex maluisset per videtis. Cur discordans praetereat aliae ruinae dirigentur orestem eodem, praetermittenda divinum. Collegisti, deteriora malint loquuntur officii cotidie finitas referri doleamus ambigua acute. Adhaesiones ratione beate arbitraretur detractis perdiscere, constituant hostis polyaeno. Diu concederetur.",
          },
        ],
      },
      "\n",
      /*{
        text: "#5518387942\n\n",
        style: "subheader",
      },*/
      "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Confectum ponit legam, perferendis nomine miserum, animi. Moveat nesciunt triari naturam posset, eveniunt specie deorsus efficiat sermone instituendarum fuisse veniat, eademque mutat debeo. Delectet plerique protervi diogenem dixerit logikh levius probabo adipiscuntur afficitur, factis magistra inprobitatem aliquo andriam obiecta, religionis, imitarentur studiis quam, clamat intereant vulgo admonitionem operis iudex stabilitas vacillare scriptum nixam, reperiri inveniri maestitiam istius eaque dissentias idcirco gravis, refert suscipiet recte sapiens oportet ipsam terentianus, perpauca sedatio aliena video.",
      "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Confectum ponit legam, perferendis nomine miserum, animi. Moveat nesciunt triari naturam posset, eveniunt specie deorsus efficiat sermone instituendarum fuisse veniat, eademque mutat debeo. Delectet plerique protervi diogenem dixerit logikh levius probabo adipiscuntur afficitur, factis magistra inprobitatem aliquo andriam obiecta, religionis, imitarentur studiis quam, clamat intereant vulgo admonitionem operis iudex stabilitas vacillare scriptum nixam, reperiri inveniri maestitiam istius eaque dissentias idcirco gravis, refert suscipiet recte sapiens oportet ipsam terentianus, perpauca sedatio aliena video.\n\n",
      {
        text: "Subheader 2 - using subheader style",
        style: "subheader",
      },
      "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Confectum ponit legam, perferendis nomine miserum, animi. Moveat nesciunt triari naturam posset, eveniunt specie deorsus efficiat sermone instituendarum fuisse veniat, eademque mutat debeo. Delectet plerique protervi diogenem dixerit logikh levius probabo adipiscuntur afficitur, factis magistra inprobitatem aliquo andriam obiecta, religionis, imitarentur studiis quam, clamat intereant vulgo admonitionem operis iudex stabilitas vacillare scriptum nixam, reperiri inveniri maestitiam istius eaque dissentias idcirco gravis, refert suscipiet recte sapiens oportet ipsam terentianus, perpauca sedatio aliena video.",
      "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Confectum ponit legam, perferendis nomine miserum, animi. Moveat nesciunt triari naturam posset, eveniunt specie deorsus efficiat sermone instituendarum fuisse veniat, eademque mutat debeo. Delectet plerique protervi diogenem dixerit logikh levius probabo adipiscuntur afficitur, factis magistra inprobitatem aliquo andriam obiecta, religionis, imitarentur studiis quam, clamat intereant vulgo admonitionem operis iudex stabilitas vacillare scriptum nixam, reperiri inveniri maestitiam istius eaque dissentias idcirco gravis, refert suscipiet recte sapiens oportet ipsam terentianus, perpauca sedatio aliena video.\n\n",
      {
        text: "It is possible to apply multiple styles, by passing an array. This paragraph uses two styles: quote and small. When multiple styles are provided, they are evaluated in the specified order which is important in case they define the same properties",
        style: ["quote", "small"],
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
    process.env.WA_NUMBER = messageComesFromPhone;

    //GUARDA LOS DATOS EN LA DB
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
