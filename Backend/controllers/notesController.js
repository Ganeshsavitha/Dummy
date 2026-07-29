const Note = require("../models/note");
const Bookmark = require("../models/bookmark");

exports.getNotes = async (req, res) => {
  try {
    const userNotes = await Note.find({ username: req.params.username }).sort({ date: -1 });
    res.json({ success: true, notes: userNotes });
  } catch (error) {
    console.error("Fetch notes failed:", error);
    res.status(500).json({ success: false, message: "Error retrieving notes: " + error.message });
  }
};

exports.saveNote = async (req, res) => {
  try {
    const { username, title, content } = req.body;
    const newNote = new Note({
      username: username || "student",
      title: title || "Untitled Note",
      content: content || "",
      date: new Date()
    });
    await newNote.save();
    res.json({ success: true, note: newNote });
  } catch (error) {
    console.error("Save note failed:", error);
    res.status(500).json({ success: false, message: "Error saving note: " + error.message });
  }
};

exports.getBookmarks = async (req, res) => {
  try {
    const userBookmarks = await Bookmark.find({ username: req.params.username }).sort({ date: -1 });
    res.json({ success: true, bookmarks: userBookmarks });
  } catch (error) {
    console.error("Fetch bookmarks failed:", error);
    res.status(500).json({ success: false, message: "Error retrieving bookmarks: " + error.message });
  }
};

exports.saveBookmark = async (req, res) => {
  try {
    const { username, question, subject, type } = req.body;
    const newBookmark = new Bookmark({
      username: username || "student",
      question: question || "",
      subject: subject || "General",
      type: type || "Normal",
      date: new Date()
    });
    await newBookmark.save();
    res.json({ success: true, bookmark: newBookmark });
  } catch (error) {
    console.error("Save bookmark failed:", error);
    res.status(500).json({ success: false, message: "Error saving bookmark: " + error.message });
  }
};
