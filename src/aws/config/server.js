require("dotenv").config();

const express = require("express");
const exphbs = require("express-handlebars");
const fileUpload = require("express-fileupload");

class Server {
    constructor(){
        this.app = express();
        this.port = process.env.AWS_PORT || '5303';

        
    }
}
