const User = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "intervue-secret-key";

exports.register = async (req, res) => {
  try {
    const { username, password, fullName, targetRole } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Username and password are required." });
    }

    let user = await User.findOne({ username });
    if (user) {
      return res.status(400).json({ success: false, message: "Username already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user = new User({
      username,
      password: hashedPassword,
      fullName: fullName || username,
      targetRole: targetRole || "Software Engineer",
      streak: 1,
      lastActive: new Date()
    });

    await user.save();

    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: "24h" });

    res.json({
      success: true,
      token,
      user: {
        username: user.username,
        fullName: user.fullName,
        targetRole: user.targetRole,
        streak: user.streak
      }
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ success: false, message: "Server error during registration." });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Username and password are required." });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    // Try comparing with bcrypt first, fallback to plain check for seed records
    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(password, user.password);
    } catch (e) {
      isMatch = false;
    }
    
    if (!isMatch && password !== user.password) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    // Update login streak
    const today = new Date().toDateString();
    const lastActiveStr = new Date(user.lastActive).toDateString();
    if (today !== lastActiveStr) {
      const diffTime = Math.abs(new Date(today) - new Date(lastActiveStr));
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        user.streak += 1;
      } else if (diffDays > 1) {
        user.streak = 1;
      }
      user.lastActive = new Date();
    }

    await user.save();

    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: "24h" });

    res.json({
      success: true,
      token,
      user: {
        username: user.username,
        fullName: user.fullName,
        targetRole: user.targetRole,
        streak: user.streak
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Server error during login." });
  }
};
