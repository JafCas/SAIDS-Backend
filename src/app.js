//DEFINICION DEL SERVIDOR
const express = require("express");
const cors = require("cors");
const app = express(); //Es el servidor

//settings **Configuracion del servidor
app.set('port', process.env.PORT || 4000);

//middlewares
app.use(cors()); //Permite que dos servidores intercambien datos
app.use(express.json()); //Envia archivos en formato json

//routes
app.use('/api/users', require('./routes/users'))
app.use('/api/records', require('./routes/records'))

module.exports = app;
