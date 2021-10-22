const express = require("express");
const dialogflowTwilioWebhook = express();
const twilio = require("./src/twilio");
const dialogflow = require("./src/dialogflow");
const uuid = require("uuid");
const PdfPrinter = require ("pdfmake");
const fs = require("fs");

const fonts = require("./pdf/components/fonts");
const styles = require("./pdf/components/styles");
const {content} = require("./pdf/components/pdfContent");

const sessionIds = new Map();

dialogflowTwilioWebhook.use(express.urlencoded({ extended: true }));

dialogflowTwilioWebhook.get("/", function (req, res) {
  res.send("Webhook workin'");
});

dialogflowTwilioWebhook.post("/", async function (req, res) {
  console.log("req ->", req.body);
  messageComesFromPhone = req.body.WaId;
  let receivedMessage = req.body.Body;

  setSessionAndUser(messageComesFromPhone);
  let session = sessionIds.get(messageComesFromPhone);
  //TODO: Se guarda en memoria pero se tiene que mover a base de datos
  let payload = await dialogflow.sendToDialogFlow(receivedMessage, session);
  let responses = payload.fulfillmentMessages;
  for (const response of responses) {
    //await twilio.sendTextMessage(req.body.WaId, response.text.text[0]);
  }

  let docDefinition = {
    content: [
      {
        text: "This is a header, using header style.",
        style: "header",
      },
      "Lorem ipsum dolor, sit amet consectetur adipisicing elit. At eveniet animi saepe facilis, aliquid explicabo perspiciatis natus, aspernatur ullam nihil eius numquam, culpa laboriosam asperiores voluptates unde. Architecto, corporis iste?\n\n",
      { text: "Subheader 1: subheader style", style: "subheader" },
      "Lorem ipsum dolor sit amet consectetur adipisicing elit. Facere ad reprehenderit reiciendis quos veritatis perspiciatis odio sint natus. Nisi dicta adipisci dolor rem quas mollitia, quam delectus cum nesciunt! Veritatis.",
      "Lorem, ipsum dolor sit amet consectetur adipisicing elit. Eum recusandae eius, repudiandae magni cum libero quisquam delectus! Eveniet quo et in, magnam, quia omnis temporibus explicabo porro quas, vel consectetur.\n\n",
      {
        text: "This will be a footer, which will be written in small font size",
        //style: "quote", "small",
        style: "small"
      },
    ],
    styles: styles
};

const printer = new PdfPrinter(fonts);
const fileName = messageComesFromPhone;
console.log("nombre archivo: ", fileName)
let pdfDoc = printer.createPdfKitDocument(docDefinition);
pdfDoc.pipe(fs.createWriteStream("./createdFiles/"+fileName+".pdf"));
pdfDoc.end();

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
console.log("Twilio Webhook Workin'")

module.exports = dialogflowTwilioWebhook;

