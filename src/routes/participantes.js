const { Router } = require("express");
const router = Router();

const {
  getParticipantes,
  createParticipante,
  getAParticipante,
  updateParticipante,
} = require("../controllers/participantes.controller");

router.route("/").get(getParticipantes).post(createParticipante);

router.route("/:id").get(getAParticipante).put(updateParticipante);

module.exports = router;
