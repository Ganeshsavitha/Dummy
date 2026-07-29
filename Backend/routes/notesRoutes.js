const express = require("express");
const router = express.Router();
const notesController = require("../controllers/notesController");
const authMiddleware = require("../middleware/authMiddleware");

// Protect notes operations behind auth checks
router.use(authMiddleware);

router.get("/notes/:username", notesController.getNotes);
router.post("/notes/save", notesController.saveNote);
router.get("/bookmarks/:username", notesController.getBookmarks);
router.post("/bookmarks/save", notesController.saveBookmark);

module.exports = router;
