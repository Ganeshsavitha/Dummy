const express = require("express");
const cors = require("cors");
const path = require("path");
const Groq = require("groq-sdk");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "hiregrad-jwt-secret-key-12345";

// Import SQLite database operations
const db = require("./db");
db.initDb().then(() => {
  console.log("Database initialized and seeded. 🚀");
}).catch(err => {
  console.error("Database initialization failed:", err);
});


const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" })); // Allow large base64 uploads for resumes
app.use(express.static(path.join(__dirname, "frontend/dist")));

// ========================================================
// 1. UNIFIED GEMINI / GROQ CLIENT ADAPTER
// ========================================================
const hasGemini = !!process.env.GEMINI_API_KEY;
const hasGroq = !!process.env.GROQ_API_KEY;

console.log("AI Services Status:");
console.log("- Gemini API status:", hasGemini ? "AVAILABLE ✅" : "NOT CONFIGURED ❌");
console.log("- Groq API status:", hasGroq ? "AVAILABLE ✅" : "NOT CONFIGURED ❌");

let genAI = null;
let groq = null;

if (hasGemini) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}
if (hasGroq) {
  groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
}

/**
 * Interface to chat completions (abstracts Groq and Gemini SDKs)
 */
async function getAICompletion(prompt, systemPrompt = "", isJson = false) {
  // 1. Prefer Gemini API if configured
  if (hasGemini) {
    try {
      const modelName = isJson ? "gemini-2.0-flash" : "gemini-2.0-flash";
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: isJson ? { responseMimeType: "application/json" } : undefined
      });

      const fullPrompt = systemPrompt ? `${systemPrompt}\n\nUser Request:\n${prompt}` : prompt;
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      return response.text();
    } catch (geminiError) {
      console.warn("Gemini compilation failed, attempting Groq fallback if available...", geminiError);
      if (!hasGroq) throw geminiError;
    }
  }

  // 2. Fallback to Groq API
  if (hasGroq) {
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const completion = await groq.chat.completions.create({
      messages: messages,
      model: "llama-3.1-8b-instant",
      response_format: isJson ? { type: "json_object" } : undefined,
      temperature: 0.7,
      max_tokens: 1500
    });
    return completion.choices[0].message.content;
  }

  throw new Error("No AI API Keys are configured. Please check your .env settings.");
}

function safeParseJSON(str) {
  if (!str) return [];
  try {
    const cleaned = str.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse JSON:", str, e);
    // Try to extract JSON array using regex if LLM returned text around it
    try {
      const match = str.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (match) {
        return JSON.parse(match[0]);
      }
    } catch (innerErr) {
      console.error("Secondary regex JSON parse failed:", innerErr);
    }
    return [];
  }
}

// ========================================================
// 2. MONGO DB SCHEMA ARCHITECTURE (READY FOR INTEGRATION)
// ========================================================
/*
  // Copy these directly into your Mongoose model definitions when connecting to MongoDB:

  const mongoose = require('mongoose');

  const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profile: {
      fullName: String,
      email: String,
      targetRole: String
    },
    streak: { type: Number, default: 0 },
    lastActive: { type: Date, default: Date.now }
  });

  const ResultSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: ['Normal', 'MCQ', 'Coding', 'HR', 'Mock'], required: true },
    subject: String,
    score: Number,
    details: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now }
  });

  const QuestionSchema = new mongoose.Schema({
    category: String,
    difficulty: String,
    type: String,
    questionText: String,
    meta: mongoose.Schema.Types.Mixed
  });

  const BookmarkSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    questionText: String,
    subject: String,
    type: String,
    meta: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now }
  });
*/

// Database initialized via db.js module.


// ========================================================
// 4. API ROUTING LIFECYCLE
// ========================================================

// Serving Landing Page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// -- Authentication APIs (Vanilla/Fallback compatibility) --
app.post("/api/auth/register", async (req, res) => {
  const { username, password, fullName, targetRole } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Username and password required." });
  }

  const email = username.includes("@") ? username : `${username}@example.com`;

  try {
    const row = await db.getUserByEmail(email);
    if (row) {
      return res.status(400).json({ success: false, message: "Username/Email already exists." });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const user = await db.createUser(fullName || username, email, hashedPassword, 'student');

    res.json({
      success: true,
      user: {
        username: user.email.split("@")[0],
        fullName: user.full_name,
        targetRole: user.target_role,
        streak: user.streak
      }
    });
  } catch (err) {
    console.error("Registration error:", err.message);
    res.status(500).json({ success: false, message: "Failed to register user." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Username and password required." });
  }

  const email = username.includes("@") ? username : `${username}@example.com`;

  try {
    const row = await db.getUserByEmail(email);
    if (!row) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    const isMatch = bcrypt.compareSync(password, row.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Incorrect password." });
    }

    // Sync streak updates
    const resolvedUsername = row.email.split("@")[0];
    let streak = row.streak || 1;
    let lastActive = row.last_active;
    
    if (row.role === 'student') {
      const today = new Date().toDateString();
      const lastActiveStr = lastActive ? new Date(lastActive).toDateString() : "";
      if (today !== lastActiveStr) {
        if (lastActiveStr) {
          const diffTime = Math.abs(new Date(today) - new Date(lastActiveStr));
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            streak += 1;
          } else if (diffDays > 1) {
            streak = 1;
          }
        } else {
          streak = 1;
        }
        lastActive = new Date().toISOString();
        await db.updateUserStreakAndActive(resolvedUsername, streak, lastActive);
      }
    }

    res.json({
      success: true,
      user: {
        username: resolvedUsername,
        fullName: row.full_name,
        targetRole: row.target_role || "Software Engineer",
        streak: streak
      }
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ success: false, message: "Database error during login." });
  }
});

// -- Question Generation API --
app.post("/api/generate-question", async (req, res) => {
  try {
    const { subject, difficulty = "Medium", role = "Software Engineer", mode = "normal", count = 1 } = req.body;
    let systemPrompt = "You are a senior tech recruiter at Google.";
    let prompt = "";

    if (mode === "mcq") {
      prompt = `Generate exactly ONE multiple choice question (MCQ) for a developer candidate on the subject: "${subject}" at difficulty level: "${difficulty}".
      The question must contain 4 clear choices, the index of the correct option (0 to 3), and a comprehensive technical explanation.
      Return the output as a JSON object with this exact schema:
      {
        "question": "The question text",
        "options": ["Option 0 text", "Option 1 text", "Option 2 text", "Option 3 text"],
        "correctIndex": 2,
        "explanation": "Clear details explaining why the choice is correct"
      }`;
      const aiResponse = await getAICompletion(prompt, systemPrompt, true);
      const parsedData = JSON.parse(aiResponse.replace(/```json|```/g, ""));
      return res.json({ success: true, mode: "mcq", question: parsedData });
    }

    if (mode === "coding") {
      prompt = `Generate exactly ONE coding round challenge for a candidate in: "${subject}" at difficulty level: "${difficulty}".
      Include challenge title, problem statement, sample input/output, starter code template, and 2 test case JSON assertions.
      Return output as a JSON object matching this schema:
      {
        "title": "Problem Title",
        "description": "Problem explanation",
        "sampleInput": "sample input text",
        "sampleOutput": "sample output text",
        "starterCode": "starter signature template",
        "testCases": [
          { "input": "input 1", "output": "expected output 1" },
          { "input": "input 2", "output": "expected output 2" }
        ]
      }`;
      const aiResponse = await getAICompletion(prompt, systemPrompt, true);
      const parsedData = JSON.parse(aiResponse.replace(/```json|```/g, ""));
      return res.json({ success: true, mode: "coding", question: parsedData });
    }

    if (mode === "hr") {
      prompt = `Generate exactly ONE HR / Behavioral interview question for a candidate applying for: "${role}". Target key behavioral traits like collaboration, problem solving, or adaptibility.
      Return ONLY the raw question string. No JSON, no formatting, no explanations.`;
      const aiResponse = await getAICompletion(prompt, systemPrompt, false);
      return res.json({ success: true, mode: "hr", question: aiResponse.trim() });
    }

    // Default Normal / Mock
    prompt = `Generate exactly ONE technical conceptual interview question on: "${subject}" at difficulty level: "${difficulty}".
    Focus on foundational principles and real-world implementation.
    Return ONLY the raw question string. No explanations, no formatting, no markdown wrappers.`;
    const aiResponse = await getAICompletion(prompt, systemPrompt, false);
    res.json({ success: true, mode: "normal", question: aiResponse.trim() });

  } catch (error) {
    console.error("AI Generation failed:", error);
    res.status(500).json({ success: false, message: "Error generating questions: " + error.message });
  }
});

// -- Answer Evaluation API --
app.post("/api/evaluate-answer", async (req, res) => {
  try {
    const { question, answer, type = "normal" } = req.body;
    let systemPrompt = "You are an automated code evaluation engine.";
    let prompt = "";

    if (type === "hr") {
      prompt = `Evaluate the candidate's HR behavioral interview answer.
      Question: "${question}"
      User Answer: "${answer}"
      
      Score their response out of 10 and assess three specific categories: confidence (High/Medium/Low), grammar (Excellent/Good/Needs Improvement), and communication quality (Clear/Vague/Too Wordy).
      Return response in this exact JSON schema:
      {
        "score": 8,
        "strengths": ["shows ownership", "clear structure"],
        "improvements": ["needs to explain metrics better"],
        "confidenceRating": "High",
        "grammarRating": "Excellent",
        "communicationRating": "Clear",
        "modelAnswer": "Model STAR behavioral answer template"
      }`;
      const aiResponse = await getAICompletion(prompt, systemPrompt, true);
      const parsed = JSON.parse(aiResponse.replace(/```json|```/g, ""));
      return res.json({ success: true, feedback: parsed });
    }

    // Default evaluate
    prompt = `Review this technical answer.
    Question: "${question}"
    User Answer: "${answer}"
    
    Evaluate the response and provide score (1-10), strengths list, improvements list, and model answer.
    Return response in this exact JSON schema:
    {
      "score": 7,
      "strengths": ["accurate concept"],
      "improvements": ["expand with edge cases"],
      "modelAnswer": "Detailed conceptual answer definition"
    }`;
    const aiResponse = await getAICompletion(prompt, systemPrompt, true);
    const parsed = JSON.parse(aiResponse.replace(/```json|```/g, ""));
    res.json({ success: true, feedback: parsed });

  } catch (error) {
    console.error("AI Evaluation failed:", error);
    res.status(500).json({ success: false, message: "Error evaluating answer: " + error.message });
  }
});

// -- Coding Evaluation API --
app.post("/api/evaluate-code", async (req, res) => {
  try {
    const { question, answer, language } = req.body;
    const systemPrompt = "You are an automated static analysis code checker.";
    const prompt = `Analyze this code submission.
    Challenge: "${question}"
    Submitted Code: "${answer}"
    Language: "${language}"
    
    Determine time complexity, space complexity, syntactic correctness, and provide performance suggestions.
    Return response as a JSON object matching this schema:
    {
      "success": true,
      "timeComplexity": "O(N)",
      "spaceComplexity": "O(1)",
      "score": 8,
      "suggestions": ["Use map to replace loops", "Check boundary values"],
      "explanation": "Your code is efficient and works as expected."
    }`;
    const aiResponse = await getAICompletion(prompt, systemPrompt, true);
    const parsed = JSON.parse(aiResponse.replace(/```json|```/g, ""));
    res.json({ success: true, feedback: parsed });
  } catch (error) {
    console.error("Coding feedback error:", error);
    res.status(500).json({ success: false, message: "Error evaluating code: " + error.message });
  }
});

// -- Resume Analysis API --
app.post("/api/analyze-resume", async (req, res) => {
  try {
    const { resumeText } = req.body;
    const systemPrompt = "You are an expert HR Specialist and Resume ATS Evaluator.";
    const prompt = `Analyze this candidate resume context:
    "${resumeText}"
    
    Assess the ATS score (0-100), extract matching skills, determine missing skills, review formatting and grammar quality, and generate 3 custom mock interview questions.
    Return output as a JSON object matching this schema:
    {
      "atsScore": 75,
      "detectedSkills": ["Javascript", "React"],
      "missingSkills": ["Node.js", "Docker"],
      "formattingFeedback": "Formatting looks good, suggest adding a projects section.",
      "grammarFeedback": "Grammar is clean.",
      "suggestions": ["Add links to GitHub profile", "Use active verbs"],
      "resumeQuestions": ["Explain your role in React setup", "How did you scale database?", "Describe JavaScript testing experience"]
    }`;
    const aiResponse = await getAICompletion(prompt, systemPrompt, true);
    const parsed = JSON.parse(aiResponse.replace(/```json|```/g, ""));
    res.json({ success: true, analysis: parsed });
  } catch (error) {
    console.error("Resume feedback error:", error);
    res.status(500).json({ success: false, message: "Error scanning resume: " + error.message });
  }
});

// -- Roadmap Generator API --
app.post("/api/generate-roadmap", async (req, res) => {
  try {
    const { currentSkill, targetCompany, targetRole, hours } = req.body;
    const systemPrompt = "You are a professional software engineering career mentor.";
    const prompt = `Create a custom learning roadmap to learn: "${currentSkill}" for role: "${targetRole}" at company: "${targetCompany}" with: ${hours} study hours per week.
    Provide a 4-week structured guide including weekly goals, study tasks, resource URLs, and practice code topics.
    Return output as a JSON object matching this schema:
    {
      "title": "Developer Learning path",
      "overview": "Detailed summary path target",
      "weeklyPlan": [
        {
          "week": 1,
          "topics": ["Topic A", "Topic B"],
          "tasks": ["Read articles", "Write 2 code scripts"],
          "resources": ["MDN Web Docs", "FreeCodeCamp Tutorials"]
        },
        {
          "week": 2,
          "topics": ["Topic C"],
          "tasks": ["Implement database schemas"],
          "resources": ["W3Schools SQL Tutorial"]
        }
      ],
      "practiceQuestions": ["Write index filters", "Develop callback routes"]
    }`;
    const aiResponse = await getAICompletion(prompt, systemPrompt, true);
    const parsedData = safeParseJSON(aiResponse);
    res.json({ success: true, roadmap: parsedData });
  } catch (error) {
    console.error("Roadmap generation error:", error);
    res.status(500).json({ success: false, message: "Error creating roadmap: " + error.message });
  }
});

// ========================================================
// RECRUITMENT DRIVES & Progression APIs
// ========================================================

// Get configured recruitment rounds
app.get("/api/recruitment/rounds", async (req, res) => {
  try {
    const rounds = await db.getRecruitmentRounds();
    res.json({ success: true, rounds });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create or update a recruitment round
app.post("/api/recruitment/rounds", async (req, res) => {
  try {
    const { id, name, passingPercentage, minScore, negativeMarking, timeLimit, mandatory, weightage, type, subject } = req.body;
    const round = await db.saveRecruitmentRound({
      id, name, passingPercentage, minScore, negativeMarking, timeLimit, mandatory, weightage, type, subject
    });
    res.json({ success: true, round });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get recruitment settings
app.get("/api/recruitment/settings", async (req, res) => {
  try {
    const settings = await db.getRecruitmentSettings();
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update recruitment settings (e.g. toggle autoShortlist)
app.post("/api/recruitment/settings", async (req, res) => {
  try {
    const { autoShortlist } = req.body;
    await db.saveRecruitmentSettings(autoShortlist);
    const settings = await db.getRecruitmentSettings();
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get candidates status list across all rounds
app.get("/api/recruitment/candidates", async (req, res) => {
  try {
    const students = await db.getAllStudents();
    const allStatuses = await db.getAllCandidateStatus();
    
    const candidatesList = students.map(u => {
      const statuses = allStatuses.filter(s => s.username === u.username);
      return {
        username: u.username,
        fullName: u.full_name,
        targetRole: u.target_role,
        streak: u.streak,
        roundsStatus: statuses
      };
    });
    res.json({ success: true, candidates: candidatesList });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Submit round test result and calculate automatic round eligibility
app.post("/api/recruitment/submit", async (req, res) => {
  try {
    const { username, roundId, score, total = 10 } = req.body;
    const rounds = await db.getRecruitmentRounds();
    const round = rounds.find(r => r.id === roundId);
    if (!round) {
      return res.status(404).json({ success: false, message: "Recruitment round not found." });
    }

    const percentage = Math.round((score / total) * 100);
    const passes = percentage >= round.passing_percentage;
    
    let status = "Not Qualified";
    if (passes) {
      const settings = await db.getRecruitmentSettings();
      status = settings.autoShortlist ? "Qualified" : "Pending";
    }

    await db.saveCandidateStatus(username, roundId, status, Number(score), percentage);
    await db.saveResult(username, round.type === "mcq" ? "MCQ" : round.type === "coding" ? "Coding" : "HR", round.subject, Number(score), Number(total));

    res.json({
      success: true,
      status,
      percentage,
      score,
      passes
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Publish results for manual review rounds (advancing pending candidates to qualified)
app.post("/api/recruitment/publish", async (req, res) => {
  try {
    const { roundId } = req.body;
    const allStatuses = await db.getAllCandidateStatus();
    const pendingCount = allStatuses.filter(entry => entry.round_id === roundId && entry.status === "Pending").length;
    
    await db.publishCandidateStatus(roundId);

    res.json({
      success: true,
      message: `Successfully published ${pendingCount} qualified candidates for ${roundId}.`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -- Leaderboard & Results Persistence APIs --
app.post("/api/results/save", async (req, res) => {
  try {
    const { username, type, subject, score, total } = req.body;
    const result = await db.saveResult(username || "anonymous", type || "Normal", subject || "General", score || 0, total || 10);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/results/history/:username", async (req, res) => {
  try {
    const history = await db.getResultsHistory(req.params.username);
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/leaderboard", async (req, res) => {
  try {
    const results = await db.getAllResults();
    const students = await db.getAllStudents();
    
    const scoresMap = {};
    results.forEach(r => {
      if (!scoresMap[r.username]) {
        scoresMap[r.username] = { username: r.username, totalScore: 0, count: 0, accuracy: 0 };
      }
      const percent = (r.score / (r.total || 10)) * 100;
      scoresMap[r.username].totalScore += r.score;
      scoresMap[r.username].count += 1;
      scoresMap[r.username].accuracy += percent;
    });

    const leaderboard = Object.values(scoresMap).map(u => {
      const userDetail = students.find(usr => usr.username === u.username);
      return {
        username: u.username,
        fullName: userDetail ? userDetail.full_name : u.username,
        streak: userDetail ? userDetail.streak : 0,
        totalInterviews: u.count,
        averageScore: (u.totalScore / u.count).toFixed(1),
        accuracy: Math.round(u.accuracy / u.count)
      };
    }).sort((a, b) => b.accuracy - a.accuracy || b.totalInterviews - a.totalInterviews);

    res.json({ success: true, leaderboard: leaderboard.slice(0, 10) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -- Bookmarks & Notes APIs --
app.get("/api/notes/:username", async (req, res) => {
  try {
    const notes = await db.getNotes(req.params.username);
    res.json({ success: true, notes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/notes/save", async (req, res) => {
  try {
    const { username, title, content } = req.body;
    const note = await db.saveNote(username || "student", title || "Untitled Note", content || "");
    res.json({ success: true, note });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/bookmarks/:username", async (req, res) => {
  try {
    const bookmarks = await db.getBookmarks(req.params.username);
    res.json({ success: true, bookmarks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/bookmarks/save", async (req, res) => {
  try {
    const { username, question, subject, type } = req.body;
    const bookmark = await db.saveBookmark(username || "student", question || "", subject || "General", type || "Normal");
    res.json({ success: true, bookmark });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// JWT Authentication Middleware
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(" ")[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({ success: false, message: "Invalid or expired token." });
      }
      req.user = decoded;
      next();
    });
  } else {
    res.status(401).json({ success: false, message: "Authorization header missing." });
  }
}

// -- Campus Placement Assessment APIs --
app.post("/api/placement/auth/register", async (req, res) => {
  const { fullName, email, password, role } = req.body;
  if (!fullName || !email || !password || !role) {
    return res.status(400).json({ success: false, message: "Missing registration details." });
  }
  
  const dbRole = role === 'company' ? 'hr' : role;
  
  if (dbRole !== 'student' && dbRole !== 'hr') {
    return res.status(400).json({ success: false, message: "Invalid role specified." });
  }
  
  try {
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Email already registered." });
    }
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    const companyName = dbRole === 'hr' ? fullName : null;
    await db.createUser(fullName, email, hashedPassword, dbRole, companyName);
    
    if (dbRole === 'hr') {
      const username = email.split("@")[0];
      await db.savePlacementCompany(username, fullName);
    }
    
    res.json({ success: true, message: "User registered successfully." });
  } catch (err) {
    console.error("Insert user error:", err);
    res.status(500).json({ success: false, message: "Failed to register user." });
  }
});

app.post("/api/placement/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Missing email or password." });
  }
  
  try {
    const user = await db.getUserByEmail(email);
    if (!user || (user.role !== 'hr' && user.role !== 'admin')) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }
    
    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Incorrect password." });
    }
    
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "24h" });
    const mappedRole = user.role === 'hr' ? 'company' : user.role;
    
    res.json({
      success: true,
      token,
      company: {
        username: user.email.split("@")[0],
        companyName: user.company_name || user.full_name,
        email: user.email,
        role: mappedRole
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Database error during login." });
  }
});

app.post("/api/placement/auth/student-login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Missing student credentials." });
  }
  
  try {
    const user = await db.getUserByEmail(email);
    if (!user || user.role !== 'student') {
      return res.status(401).json({ success: false, message: "Invalid student credentials." });
    }
    
    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Incorrect student password." });
    }
    
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "24h" });
    const username = user.email.split("@")[0];
    
    // Streak logic
    let streak = user.streak || 1;
    let lastActive = user.last_active;
    const today = new Date().toDateString();
    const lastActiveStr = lastActive ? new Date(lastActive).toDateString() : "";
    if (today !== lastActiveStr) {
      if (lastActiveStr) {
        const diffTime = Math.abs(new Date(today) - new Date(lastActiveStr));
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          streak += 1;
        } else if (diffDays > 1) {
          streak = 1;
        }
      } else {
        streak = 1;
      }
      lastActive = new Date().toISOString();
      await db.updateUserStreakAndActive(username, streak, lastActive);
    }
    
    res.json({
      success: true,
      token,
      student: {
        username,
        fullName: user.full_name,
        email: user.email,
        role: "student",
        cgpa: user.cgpa || 8.0,
        department: user.department || "CSE",
        skills: JSON.parse(user.skills || '[]'),
        streak: streak
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Database error during student login." });
  }
});

app.get("/api/placement/auth/me", authenticateJWT, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    
    const mappedRole = user.role === 'hr' ? 'company' : user.role;
    
    if (user.role === 'student') {
      const username = user.email.split("@")[0];
      res.json({
        success: true,
        user: {
          username,
          fullName: user.full_name,
          email: user.email,
          role: mappedRole,
          cgpa: user.cgpa || 8.0,
          department: user.department || "CSE",
          skills: JSON.parse(user.skills || '[]'),
          streak: user.streak || 1
        }
      });
    } else {
      res.json({
        success: true,
        user: {
          username: user.email.split("@")[0],
          fullName: user.full_name,
          email: user.email,
          role: mappedRole
        }
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Database error." });
  }
});

// -- Campus Placement Assessment Drives Management APIs --
app.get("/api/placement/drives", async (req, res) => {
  try {
    const drives = await db.getPlacementDrives();
    res.json({ success: true, drives });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/placement/drives", async (req, res) => {
  const { 
    id, name, companyUsername, autoShortlist, jobRole, packageOffered, 
    assessmentDate, assessmentTime, duration, eligibleDepts, 
    minCgpa, eligibleBatch, maxStudentsLimit 
  } = req.body;
  try {
    const driveId = id || "drive_" + Date.now();
    
    // Check if it already exists to preserve rounds and status
    const drives = await db.getPlacementDrives();
    const existing = drives.find(d => d.id === driveId);
    
    const drive = {
      id: driveId,
      companyUsername: companyUsername || "tata_hr",
      name: name || "New Hiring Campaign",
      status: existing ? existing.status : "Draft",
      autoShortlist: autoShortlist || false,
      jobRole: jobRole || "Software Engineer",
      packageOffered: packageOffered || "7.5 LPA",
      assessmentDate: assessmentDate || new Date().toISOString().split('T')[0],
      assessmentTime: assessmentTime || "10:00",
      duration: duration !== undefined ? parseInt(duration) : 90,
      eligibleDepts: eligibleDepts || ["CSE", "ECE", "IT"],
      minCgpa: minCgpa !== undefined ? parseFloat(minCgpa) : 7.0,
      eligibleBatch: eligibleBatch || "2026",
      maxStudentsLimit: maxStudentsLimit !== undefined ? parseInt(maxStudentsLimit) : 100,
      rounds: existing ? existing.rounds : []
    };
    const saved = await db.createPlacementDrive(drive);
    res.json({ success: true, drive: saved });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/placement/drives/publish", async (req, res) => {
  const { driveId } = req.body;
  try {
    await db.publishPlacementDrive(driveId);
    const drives = await db.getPlacementDrives();
    const drive = drives.find(d => d.id === driveId);
    res.json({ success: true, drive });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/placement/register", async (req, res) => {
  const { username, driveId } = req.body;
  try {
    const student = await db.getUserByUsername(username);
    const drives = await db.getPlacementDrives();
    const drive = drives.find(d => d.id === driveId);
    
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }
    if (!drive) {
      return res.status(404).json({ success: false, message: "Placement drive not found." });
    }
    
    const regs = await db.getPlacementRegistrations(username);
    const existing = regs.includes(driveId);
    if (existing) {
      return res.status(400).json({ success: false, message: "You are already registered for this drive." });
    }
    
    const studentCgpa = student.cgpa !== null && student.cgpa !== undefined ? student.cgpa : 8.2;
    const studentDept = student.department || "CSE";
    
    if (studentCgpa < drive.minCgpa) {
      return res.status(400).json({ success: false, message: `Ineligible: Your CGPA (${studentCgpa}) is below the required ${drive.minCgpa}.` });
    }
    
    if (drive.eligibleDepts && drive.eligibleDepts.length > 0 && !drive.eligibleDepts.includes(studentDept)) {
      return res.status(400).json({ success: false, message: `Ineligible: Your department (${studentDept}) is not eligible for this drive.` });
    }
    
    await db.registerForDrive(username, driveId);
    res.json({ success: true, message: "Registered successfully for " + drive.name });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/placement/registrations/:username", async (req, res) => {
  try {
    const list = await db.getPlacementRegistrations(req.params.username);
    res.json({ success: true, registeredDrives: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/placement/profile/save", async (req, res) => {
  const { username, cgpa, department, skills } = req.body;
  try {
    const student = await db.getUserByUsername(username);
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }
    
    const newCgpa = cgpa !== undefined ? parseFloat(cgpa) : student.cgpa;
    const newDept = department !== undefined ? department : student.department;
    const newSkills = skills !== undefined ? skills : JSON.parse(student.skills || '[]');
    
    await db.updateUserProfile(username, newCgpa, newDept, newSkills);
    res.json({ success: true, message: "Profile saved successfully." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/placement/network-info", (req, res) => {
  const os = require('os');
  let ip = 'localhost';
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
        ip = alias.address;
        break;
      }
    }
  }
  res.json({ success: true, localIp: ip, port: PORT });
});

app.get("/api/placement/progress/:username", async (req, res) => {
  try {
    const progressList = await db.getPlacementProgress(req.params.username);
    res.json({ success: true, progressList });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/placement/rounds/save", async (req, res) => {
  const { driveId, rounds } = req.body;
  try {
    const drives = await db.getPlacementDrives();
    const drive = drives.find(d => d.id === driveId);
    if (!drive) {
      return res.status(404).json({ success: false, message: "Drive not found" });
    }
    await db.savePlacementDriveRounds(driveId, rounds);
    drive.rounds = rounds;
    res.json({ success: true, drive });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/placement/rounds/:driveId", async (req, res) => {
  try {
    const drives = await db.getPlacementDrives();
    const drive = drives.find(d => d.id === req.params.driveId);
    if (!drive) {
      return res.status(404).json({ success: false, message: "Drive not found" });
    }
    res.json({ success: true, rounds: drive.rounds });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/placement/questions/:driveId/:roundId", async (req, res) => {
  try {
    const list = await db.getPlacementQuestions(req.params.driveId, req.params.roundId);
    res.json({ success: true, questions: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/placement/questions/save", async (req, res) => {
  const { driveId, roundId, questions } = req.body;
  try {
    await db.savePlacementQuestions(driveId, roundId, questions);
    res.json({ success: true, message: "Questions saved successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -- Gemini AI Generator & PDF Parser APIs --
app.post("/api/placement/questions/generate", async (req, res) => {
  const { subject, count, difficulty } = req.body;
  const isCommunication = subject && subject.toLowerCase() === "communication";
  const subjectText = isCommunication 
    ? "English Communication (specifically focusing on grammar, active/passive voice, tenses, sentence correction, vocabulary, and verbal aptitude)" 
    : (subject || "Java");
  
  const prompt = `Generate exactly ${count || 5} multiple-choice questions on subject "${subjectText}" with difficulty level "${difficulty || "Medium"}". 
  
  CRITICAL:
  1. NO REPEATED QUESTIONS: Each question must be completely unique and distinct.
  2. DEPTH BY LEVEL: Set questions matching the "${difficulty || "Medium"}" level (${isCommunication ? 'Easy focuses on basic grammar rules and word definitions, Medium focuses on sentence structures, correcting common grammar errors, and prepositions, Hard focuses on complex syntactical rules, idioms, and advanced vocabulary' : 'Easy focuses on basic syntax/rules, Medium focuses on intermediate logic and standard APIs, Hard focuses on complex algorithmic logic, performance, and concurrency'}).
  3. Return a "topic" field indicating the sub-topic.

  Output the response as a raw JSON array matching this schema:
  [
    {
      "questionText": "Question wording here",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Why this answer is correct",
      "topic": "Subtopic name"
    }
  ]`;
  try {
    const responseText = await getAICompletion(prompt, "You are a professional compiler examiner. Output only JSON array, do not add markdown wrapping tags.", true);
    const parsed = safeParseJSON(responseText);
    res.json({ success: true, questions: parsed });
  } catch (err) {
    res.status(500).json({ success: false, message: "AI question generation failed: " + err.message });
  }
});

app.post("/api/placement/questions/upload-pdf", async (req, res) => {
  const { pdfText, subject } = req.body;
  if (!pdfText) {
    return res.status(400).json({ success: false, message: "No PDF text parsed." });
  }
  const prompt = `Read this parsed PDF content text and extract 5 high-quality multiple choice questions matching subject area: "${subject || "Aptitude"}". 
  Output the response as a JSON array matching this schema:
  [
    {
      "questionText": "Question text here",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Explanation here"
    }
  ]
  
  PDF Text:
  ${pdfText.substring(0, 8000)}`;
  try {
    const responseText = await getAICompletion(prompt, "You are a compiler parser. Output only JSON array, do not add markdown wrapping tags.", true);
    const parsed = safeParseJSON(responseText);
    res.json({ success: true, questions: parsed });
  } catch (err) {
    res.status(500).json({ success: false, message: "PDF questions conversion failed: " + err.message });
  }
});

app.post("/api/placement/resume/scan", async (req, res) => {
  const { resumeText, targetRole } = req.body;
  if (!resumeText) {
    return res.status(400).json({ success: false, message: "No resume text content provided." });
  }
  const prompt = `Perform an ATS scan of the following candidate resume text. Evaluate its suitability for target role: "${targetRole || "Software Engineer"}". 
  Output the response as a JSON object matching this schema:
  {
    "atsScore": 85,
    "skillsMatched": ["Java", "SQL"],
    "skillsMissing": ["Docker"],
    "suitabilityRating": "High | Medium | Low",
    "summary": "Short ATS feedback summary"
  }
  
  Candidate Resume:
  ${resumeText}`;
  try {
    const responseText = await getAICompletion(prompt, "You are an ATS parser. Output only JSON object, do not add markdown wrapping tags.", true);
    const parsed = safeParseJSON(responseText);
    res.json({ success: true, analysis: parsed });
  } catch (err) {
    res.status(500).json({ success: false, message: "ATS scanning failed: " + err.message });
  }
});

// -- Live Session monitor & autograder APIs --
app.post("/api/placement/session/start", async (req, res) => {
  const { driveId, roundId, timeLimit } = req.body;
  try {
    await db.publishPlacementDrive(driveId);
    const drives = await db.getPlacementDrives();
    const drive = drives.find(d => d.id === driveId);
    if (!drive) return res.status(404).json({ success: false, message: "Drive not found" });
    
    io.emit("assessment-started", {
      driveId,
      driveName: drive.name,
      roundId,
      timeLimit: timeLimit || 30
    });
    
    res.json({ success: true, message: "Live drive session broadcasted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/placement/session/terminate", async (req, res) => {
  const { driveId } = req.body;
  try {
    await new Promise((resolve, reject) => {
      db.db.run("UPDATE placement_drives SET status = 'Completed' WHERE id = ?", [driveId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    io.emit("assessment-terminated", { driveId });
    res.json({ success: true, message: "Live session terminated" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/placement/session/submit", async (req, res) => {
  const { username, driveId, roundId, score, total } = req.body;
  try {
    const drives = await db.getPlacementDrives();
    const drive = drives.find(d => d.id === driveId);
    if (!drive) return res.status(404).json({ success: false, message: "Drive not found" });
    
    const roundIndex = drive.rounds.findIndex(r => r.id === roundId);
    const round = drive.rounds[roundIndex];
    const scorePercent = (score / total) * 100;
    
    let status = "Qualified";
    if (scorePercent < round.passingPercentage) {
      status = "Disqualified";
    }
    
    const progressList = await db.getPlacementProgress(username);
    let progress = progressList.find(p => p.driveId === driveId);
    
    const scores = progress ? progress.scores : {};
    scores[roundId] = score;
    
    let nextRoundIdx = progress ? progress.currentRoundIndex : 0;
    if (status === "Qualified") {
      nextRoundIdx = roundIndex + 1;
    }
    
    await db.savePlacementProgress(username, driveId, nextRoundIdx, status, scores);
    const updatedProgress = (await db.getPlacementProgress(username)).find(p => p.driveId === driveId);
    
    res.json({ success: true, status, percentage: scorePercent, progress: updatedProgress });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/placement/session/publish", async (req, res) => {
  const { driveId, roundId } = req.body;
  try {
    const drives = await db.getPlacementDrives();
    const drive = drives.find(d => d.id === driveId);
    if (!drive) return res.status(404).json({ success: false, message: "Drive not found" });
    const roundIndex = drive.rounds.findIndex(r => r.id === roundId);
    
    const count = await db.publishPlacementProgress(driveId, roundId, roundIndex + 1);
    res.json({ success: true, message: `Published ${count} qualified candidates.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/placement/candidates/:driveId", async (req, res) => {
  try {
    const list = await db.getPlacementCandidates(req.params.driveId);
    res.json({ success: true, candidates: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/admin/system-data", async (req, res) => {
  try {
    const companies = await db.getPlacementCompanies();
    const drives = await db.getPlacementDrives();
    const students = await db.getAllStudents();
    res.json({
      success: true,
      companies,
      drives,
      students
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete("/api/admin/users/:username", async (req, res) => {
  const { username } = req.params;
  try {
    const user = await db.getUserByUsername(username);
    if (user) {
      await db.deleteUser(username);
      await db.deleteResultsByUsername(username);
      await db.deleteBookmarksByUsername(username);
      await db.deleteNotesByUsername(username);
      await db.deleteCandidateStatusByUsername(username);
      await db.deletePlacementProgressByUsername(username);
      await db.deleteRegistrationsByUsername(username);
      
      res.json({ success: true, message: `User ${username} deleted successfully.` });
    } else {
      res.status(404).json({ success: false, message: `User ${username} not found.` });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete all users
app.delete("/api/admin/users", async (req, res) => {
  try {
    await db.deleteAllUsers();
    await db.deleteAllResults();
    await db.deleteAllBookmarks();
    await db.deleteAllNotes();
    await db.deleteAllCandidateStatus();
    await db.deleteAllPlacementProgress();
    await db.deleteAllRegistrations();
    res.json({ success: true, message: "All user records and associated data deleted successfully." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete single company
app.delete("/api/admin/companies/:username", async (req, res) => {
  const { username } = req.params;
  try {
    const companies = await db.getPlacementCompanies();
    const initialLength = companies.length;
    
    await db.deleteCompany(username);
    await db.deleteUser(username);
    
    const updatedCompanies = await db.getPlacementCompanies();
    if (updatedCompanies.length < initialLength) {
      const drives = await db.getPlacementDrives();
      const companyDrives = drives.filter(d => d.companyUsername === username);
      const driveIds = companyDrives.map(d => d.id);
      
      for (const dId of driveIds) {
        await db.deleteDrive(dId);
        await db.deletePlacementProgressByDriveId(dId);
        await db.deleteRegistrationsByDriveId(dId);
      }
      
      res.json({ success: true, message: `Company ${username} and all associated drives deleted successfully.` });
    } else {
      res.status(404).json({ success: false, message: `Company ${username} not found.` });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete single drive
app.delete("/api/admin/drives/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const drives = await db.getPlacementDrives();
    const initialLength = drives.length;
    
    await db.deleteDrive(id);
    
    const updatedDrives = await db.getPlacementDrives();
    if (updatedDrives.length < initialLength) {
      await db.deletePlacementProgressByDriveId(id);
      await db.deleteRegistrationsByDriveId(id);
      res.json({ success: true, message: `Drive ${id} deleted successfully.` });
    } else {
      res.status(404).json({ success: false, message: `Drive ${id} not found.` });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete all companies (and drives)
app.delete("/api/admin/companies", async (req, res) => {
  try {
    await db.deleteAllCompanies();
    await db.deleteAllDrives();
    await db.deleteAllPlacementProgress();
    await db.deleteAllRegistrations();
    res.json({ success: true, message: "All company records, drives, and registrations deleted successfully." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Fallback client SPA routing
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "frontend/dist", "index.html"));
});

// Start HTTP & Sockets Server
const PORT = process.env.PORT || 3000;
const http = require("http");
const socketIo = require("socket.io");
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log(`Socket client connected: ${socket.id}`);

  socket.on("join-session", ({ username, role, driveId }) => {
    socket.join(driveId);
    console.log(`${username} joined room for drive: ${driveId}`);
  });

  socket.on("candidate-submit", ({ username, driveId, roundId, score, status }) => {
    io.to(driveId).emit("candidate-update", { username, roundId, score, status });
  });

  socket.on("disconnect", () => {
    console.log(`Socket client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});