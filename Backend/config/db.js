const mongoose = require("mongoose");
require("dotenv").config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ai-interview-coach";

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB Connected Successfully ✅");
  } catch (error) {
    console.error("MongoDB Connection Failed ❌:", error.message);
    console.warn("Please ensure MongoDB is running locally, or configure MONGO_URI in .env.");
  }
}

module.exports = connectDB;
