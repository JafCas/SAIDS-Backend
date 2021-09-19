const { Router } = require("express");
const router = Router();

const {
  getRecords,
  createRecord,
  getARecord,
  updateRecord,
  deleteRecord,
} = require("../controllers/records.controller");

router.route("/").get(getRecords).post(createRecord);

router.route("/:id").get(getARecord).put(updateRecord).delete(deleteRecord);

module.exports = router;
