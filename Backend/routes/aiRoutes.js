const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");
const authMiddleware = require("../middleware/authMiddleware");

// Protect all AI routes with JWT authentication
router.use(authMiddleware);

router.post("/generate-question", aiController.generateQuestion);
router.post("/generate-mcq-deck", aiController.generateMcqDeck);
router.post("/evaluate-answer", aiController.evaluateAnswer);
router.post("/evaluate-code", aiController.evaluateCode);
router.post("/execute-code", aiController.executeCode);
router.post("/analyze-resume", aiController.analyzeResume);
router.post("/generate-roadmap", aiController.generateRoadmap);

module.exports = router;
