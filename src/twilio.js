/*const accountSid = "AC30eb1ebf5a744f849d3d149ec867f196";
const authToken = "dd7e8f4aad6c28630858e406b11e16c3";
//pasar esto a .env
const client = require("twilio")(accountSid, authToken);

function sendTextMessage(sender, message) {
  return new Promise((resolve, reject) => {
    client.messages
      .create({
        from: "whatsapp:+14155238886",
        body: message,
        to: "whatsapp:+"+sender,
      })
      .then((message) => resolve())
      .catch((err) => reject(err));
  });
}

sendTextMessage("525518387942", "Esto esta funcionando!!");*/

require('dotenv').config();
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_TOKEN;
const client = require("twilio")(accountSid, authToken);

function sendTextMessage(sender, message) {
  return new Promise((resolve, reject) => {
    client.messages
      .create({
        from: "whatsapp:+14155238886",
        body: message,
        to: "whatsapp:+" + sender,
        //to: "whatsapp:+" + sender,
        //to: "whatsapp:+5215518387942",
      })
      .then((message) => resolve())
      .catch((err) => reject(err));
  });
}

module.exports = {
  sendTextMessage,
};
