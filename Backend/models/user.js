const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  fullName: { type: String },
  targetRole: { type: String, default: "Software Engineer" },
  streak: { type: Number, default: 1 },
  lastActive: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", UserSchema);
