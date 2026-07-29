const mongoose = require("mongoose");

const BookmarkSchema = new mongoose.Schema({
  username: { type: String, required: true },
  question: { type: String, required: true },
  subject: { type: String, required: true },
  type: { type: String, required: true },
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Bookmark", BookmarkSchema);
