const Result = require("../models/result");
const User = require("../models/user");

exports.saveResult = async (req, res) => {
  try {
    const { username, type, subject, score, total } = req.body;
    const newResult = new Result({
      username: username || "anonymous",
      type: type || "Normal",
      subject: subject || "General",
      score: score || 0,
      total: total || 10,
      date: new Date()
    });
    await newResult.save();
    res.json({ success: true, result: newResult });
  } catch (error) {
    console.error("Save result failed:", error);
    res.status(500).json({ success: false, message: "Error saving result: " + error.message });
  }
};

exports.getUserHistory = async (req, res) => {
  try {
    const userResults = await Result.find({ username: req.params.username }).sort({ date: -1 });
    res.json({ success: true, history: userResults });
  } catch (error) {
    console.error("Fetch history failed:", error);
    res.status(500).json({ success: false, message: "Error retrieving history logs: " + error.message });
  }
};

exports.getLeaderboard = async (req, res) => {
  try {
    const allResults = await Result.find({});
    const allUsers = await User.find({});

    const scoresMap = {};
    allResults.forEach(r => {
      if (!scoresMap[r.username]) {
        scoresMap[r.username] = { username: r.username, totalScore: 0, count: 0, accuracy: 0 };
      }
      const percent = (r.score / (r.total || 10)) * 100;
      scoresMap[r.username].totalScore += r.score;
      scoresMap[r.username].count += 1;
      scoresMap[r.username].accuracy += percent;
    });

    const leaderboard = Object.values(scoresMap).map(u => {
      const userDetail = allUsers.find(usr => usr.username === u.username);
      return {
        username: u.username,
        fullName: userDetail ? userDetail.fullName : u.username,
        streak: userDetail ? userDetail.streak : 0,
        totalInterviews: u.count,
        averageScore: (u.totalScore / u.count).toFixed(1),
        accuracy: Math.round(u.accuracy / u.count)
      };
    }).sort((a, b) => b.accuracy - a.accuracy || b.totalInterviews - a.totalInterviews);

    res.json({ success: true, leaderboard: leaderboard.slice(0, 10) });
  } catch (error) {
    console.error("Leaderboard calculation failed:", error);
    res.status(500).json({ success: false, message: "Error aggregating leaderboard data: " + error.message });
  }
};
