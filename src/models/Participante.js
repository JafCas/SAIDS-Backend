const { Schema, model } = require("mongoose");

const participanteSchema = new Schema(
  {
    WaID: { type: String, unique: true, trim: true },
    WaNumber: { type: String, unique: true, trim: true },
    nombresParticipante: String,
    apellidoParticipante: String,
    edadParticipante: String,
    emailParticipante: String,
    respuestasFiltroAnsiedad: String,
    respuestasFiltroDepresion: String,
    testAnsiedad: String,
    testDepresion: String,
    ansiedadFileLink: String,
    depresionFileLink: String
  },
  {
    timestamps: true,
  }
);

module.exports = model("Participante", participanteSchema);
