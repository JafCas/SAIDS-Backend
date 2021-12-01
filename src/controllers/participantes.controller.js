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
    puntuacionCuestionarioBAI,
    puntuacionCuestionarioPHQ,
    puntuacionTotalBAI,
    puntuacionTotalPHQ,
    veredictoBAI,
    veredictoPHQ,
    fechaParticipacionOnly,
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
    puntuacionCuestionarioBAI,
    puntuacionCuestionarioPHQ,
    puntuacionTotalBAI,
    puntuacionTotalPHQ,
    veredictoBAI,
    veredictoPHQ,
    fechaParticipacionOnly,
  });
  await newParticipante.save();
  res.json({ message: "Participante Saved" });
};

participanteCtrl.getAParticipante = async (req, res) => {
  const participante = await Participante.findById(req.params.id);
  res.json(participante);
};

//Desde aqui se declara para la interaccion con la base de datos desde el frontend
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
    checadoPorEspecialista,
  } = req.body;
  await Participante.findOneAndUpdate(
    { _id: req.params.id },
    {
      // nombresParticipante,
      // apellidoParticipante,
      // edadParticipante,
      // emailParticipante,
      // respuestasFiltroAnsiedad,
      // respuestasFiltroDepresion,
      // testAnsiedad,
      // testDepresion,
      // ansiedadFileLink,
      // depresionFileLink,
      checadoPorEspecialista,
    }
  );
  res.json({ message: "Participante Updated" });
};

participanteCtrl.deleteParticipante = async (req, res) => {
  await Record.findByIdAndDelete(req.params.id);
  res.json({ message: "Participante Deleted" });
};

module.exports = participanteCtrl;
