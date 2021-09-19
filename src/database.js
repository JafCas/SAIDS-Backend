const mongoose = require('mongoose');

const URI = process.env.SAIDSDB_URI
    ? process.env.SAIDSDB_URI //Se crea la base de datos 'saidsdb si existe env'
    : 'mongodb://localhost/saidsdbtest'; //Se crea la base de datos 'saidsdbtest en caso de no encontrar env'


mongoose.connect(URI, {});

const connection = mongoose.connection;

connection.once("open", () => {
    console.log("DB is connected");
});