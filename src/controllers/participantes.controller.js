const participanteCtrl = {};
const Participante = require("../models/Participante");

participanteCtrl.getParticipantes = async (req, res) => {
  const participantes = await Participante.find();
  res.json(participantes);
};

participanteCtrl.createParticipante = async (req, res) => {
  const {
    WaID,
    WaNumber,
    nombresParticipante,
    apellidoParticipante,
    edadParticipante,
    emailParticipante,
    preguntaAnsiedad_1,
    preguntaAnsiedad_2,
    preguntaDepresion_1,
    preguntaDepresion_2,
    testAnsiedad,
    testDepresion,
    ansiedadFileLink,
    depresionFileLink,
    puntuacionFiltroAnsiedad,
    puntuacionFiltroDepresion,
  } = req.body;
  const newParticipante = new Participante({
    WaID,
    WaNumber,
    nombresParticipante,
    apellidoParticipante,
    edadParticipante,
    emailParticipante,
    preguntaAnsiedad_1,
    preguntaAnsiedad_2,
    preguntaDepresion_1,
    preguntaDepresion_2,
    testAnsiedad,
    testDepresion,
    ansiedadFileLink,
    depresionFileLink,
    puntuacionFiltroAnsiedad,
    puntuacionFiltroDepresion,
  });
  await newParticipante.save();
  res.json({ message: "Participante Saved" });
};

participanteCtrl.getAParticipante = async (req, res) => {
  const participante = await Participante.findById(req.params.id);
  res.json(participante);
};

participanteCtrl.updateParticipante = async (req, res) => {
  const {
    nombresParticipante,
    apellidoParticipante,
    edadParticipante,
    emailParticipante,
    respuestasFiltroAnsiedad,
    respuestasFiltroDepresion,
    testAnsiedad,
    testDepresion,
    ansiedadFileLink,
    depresionFileLink,
  } = req.body;
  await Participante.findOneAndUpdate(
    { _id: req.params.id },
    {
      nombresParticipante,
      apellidoParticipante,
      edadParticipante,
      emailParticipante,
      respuestasFiltroAnsiedad,
      respuestasFiltroDepresion,
      testAnsiedad,
      testDepresion,
      ansiedadFileLink,
      depresionFileLink,
    }
  );
  res.json({ message: "Participante Updated" });
};

module.exports = participanteCtrl;
