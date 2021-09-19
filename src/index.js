require('dotenv').config(); //Se importan las variables de entorno

const app = require("./app");
require("./database");

async function main() {
  await app.listen(app.get('port'));
  console.log("Server on port", app.get('port'));
}

main();
