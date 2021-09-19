const recordsCtrl = {};
const Record = require("../models/Record");

recordsCtrl.getRecords = async (req, res) => {
  const records = await Record.find(); //[{}, {}, {}, ...]
  res.json(records);
};

recordsCtrl.createRecord = async (req, res) => {
  const { title, content, date, author } = req.body; //Lo que espera que se envíe
  const newRecord = new Record({
    title,
    content,
    date,
    author,
  });
  await newRecord.save(); //Guarda el nuevo registro en la base de datos
  res.json({ message: "Note Saved" });
};

recordsCtrl.getARecord = async (req, res) => {
  const record = await Record.findById(req.params.id);
  res.json(record);
};

recordsCtrl.updateRecord = async (req, res) => {
  const { title, content, author } = req.body;
  await Record.findOneAndUpdate(
    { _id: req.params.id },
    {
      title,
      content,
      author,
    }
  );
  res.json({ message: "Note Updated" });
};

recordsCtrl.deleteRecord = async (req, res) => {
  await Record.findByIdAndDelete(req.params.id);
  res.json({ message: "Note Deleted" });
};

module.exports = recordsCtrl;
