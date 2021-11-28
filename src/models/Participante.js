const { Schema, model } = require("mongoose");

const participanteSchema = new Schema(
  {
    WaID: { type: String, unique: true, trim: true },
    WaNumber: { type: String, unique: true, trim: true },
    nombresParticipante: String,
    apellidoParticipante: String,
    edadParticipante: Number,
    emailParticipante: String,
    preguntaAnsiedad_1: String,
    preguntaAnsiedad_2: String,
    preguntaDepresion_1: String,
    preguntaDepresion_2: String,
    testAnsiedad: String,
    testDepresion: String,
    ansiedadFileLink: String,
    depresionFileLink: String,
    puntuacionFiltroAnsiedad: Number,
    puntuacionFiltroDepresion: Number,
  },
  {
    timestamps: true,
  }
);

module.exports = model("Participante", participanteSchema);
