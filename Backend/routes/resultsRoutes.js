const express = require("express");
const router = express.Router();
const resultsController = require("../controllers/resultsController");
const authMiddleware = require("../middleware/authMiddleware");

// All results endpoints require authentication
router.use(authMiddleware);

router.post("/results/save", resultsController.saveResult);
router.get("/results/history/:username", resultsController.getUserHistory);
router.get("/leaderboard", resultsController.getLeaderboard);

module.exports = router;
