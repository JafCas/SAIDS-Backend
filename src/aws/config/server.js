require("dotenv").config();

const express = require("express");
const exphbs = require("express-handlebars");
const fileUpload = require("express-fileupload");

class Server {
  constructor() {
    this.app = express();
    this.port = process.env.AWS_PORT || "5303";

    this.setTemplateEngine();

    this.middlewares();

    this.routes();
  }

  setTemplateEngine() {
    this.app.set("views", "./src/aws/views")
    this.app.set("view engine", "hbs");

    this.app.engine(
      "hbs",
      exphbs({
        extname: "hbs",
        defaultLayout: "",
        layoutsDir: "",
      })
    );
  }

  middlewares() {
    this.app.use(express.static("public"));
    this.app.use(express.json());

    this.app.use(
      fileUpload({
        useTempFiles: true,
        tempFileDir: "/tmp/",
        debug: true,
      })
    );
  }

  routes() {
    this.app.use("/index", require("../routes/index.routes"))
    this.app.use("/upload", require("../routes/upload.routes"))
  }

  listen() {
    this.app.listen(this.port, () => {
      console.log("server s3 on port", this.port);
    });
  }
}

module.exports = Server;