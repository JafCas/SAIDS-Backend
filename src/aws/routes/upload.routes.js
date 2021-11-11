const { Router } = require("express");
const { upload } = require("../controllers/upload.controller");


const router = Router();

router.post("/", upload);

module.exports = router;