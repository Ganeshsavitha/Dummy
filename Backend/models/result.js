const mongoose = require("mongoose");

const ResultSchema = new mongoose.Schema({
  username: { type: String, required: true },
  type: { type: String, required: true },
  subject: { type: String, required: true },
  score: { type: Number, required: true },
  total: { type: Number, default: 10 },
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Result", ResultSchema);
