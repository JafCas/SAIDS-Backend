require('dotenv').config(); //Se importan las variables de entorno

const app = require("./app");
require("./database");

async function main() {
  app.listen(process.env.PORT || 4001, () => {
    console.log("Backend connected!");
  });
}

main();
