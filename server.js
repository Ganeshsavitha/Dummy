const express = require("express");
const cors = require("cors");
const path = require("path");
const Groq = require("groq-sdk");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

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
      const modelName = isJson ? "gemini-1.5-flash" : "gemini-1.5-flash";
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

// ========================================================
// 3. IN-MEMORY DATABASE ENGINE (MOCKS PRODUCTION STATE)
// ========================================================
const db = {
  users: [
    { username: "student", password: "password", fullName: "Jane Doe", targetRole: "Full Stack Engineer", streak: 5, lastActive: new Date(), cgpa: 8.2, department: "CSE" },
    { username: "hr", password: "password", fullName: "HR Recruiter", targetRole: "Talent Acquisition Manager", streak: 1, lastActive: new Date() },
    { username: "alice", password: "password", fullName: "Alice Smith", targetRole: "Frontend Developer", streak: 4, lastActive: new Date(), cgpa: 8.5, department: "CSE" },
    { username: "bob", password: "password", fullName: "Bob Jones", targetRole: "Java Developer", streak: 2, lastActive: new Date(), cgpa: 6.8, department: "ECE" },
    { username: "charlie", password: "password", fullName: "Charlie Brown", targetRole: "QA Engineer", streak: 3, lastActive: new Date(), cgpa: 7.2, department: "IT" },
    { username: "david", password: "password", fullName: "David Miller", targetRole: "DevOps Engineer", streak: 0, lastActive: new Date(), cgpa: 6.0, department: "IT" },
    { username: "eva", password: "password", fullName: "Eva Davis", targetRole: "Data Scientist", streak: 6, lastActive: new Date(), cgpa: 9.0, department: "CSE" }
  ],
  results: [
    { username: "student", type: "MCQ", subject: "Aptitude", score: 8, total: 10, date: new Date(Date.now() - 86400000) },
    { username: "student", type: "Technical", subject: "Java", score: 7.5, total: 10, date: new Date(Date.now() - 43200000) },
    // Alice's completed rounds
    { username: "alice", type: "MCQ", subject: "Aptitude", score: 8.5, total: 10, date: new Date(Date.now() - 259200000) },
    { username: "alice", type: "Technical", subject: "Java", score: 8, total: 10, date: new Date(Date.now() - 172800000) },
    { username: "alice", type: "Technical", subject: "Problem Solving", score: 8.5, total: 10, date: new Date(Date.now() - 86400000) },
    { username: "alice", type: "HR", subject: "Behavioral", score: 9.0, total: 10, date: new Date(Date.now() - 10000000) },
    // Bob's completed rounds
    { username: "bob", type: "MCQ", subject: "Aptitude", score: 8.0, total: 10, date: new Date(Date.now() - 259200000) },
    { username: "bob", type: "Technical", subject: "Java", score: 5.5, total: 10, date: new Date(Date.now() - 172800000) },
    // Charlie's completed rounds
    { username: "charlie", type: "MCQ", subject: "Aptitude", score: 7.8, total: 10, date: new Date(Date.now() - 259200000) },
    { username: "charlie", type: "Technical", subject: "Java", score: 7.2, total: 10, date: new Date(Date.now() - 172800000) },
    // Eva's completed rounds
    { username: "eva", type: "MCQ", subject: "Aptitude", score: 9.5, total: 10, date: new Date(Date.now() - 259200000) },
    { username: "eva", type: "Technical", subject: "Java", score: 8.5, total: 10, date: new Date(Date.now() - 172800000) },
    { username: "eva", type: "Technical", subject: "Problem Solving", score: 8.0, total: 10, date: new Date(Date.now() - 86400000) },
    { username: "eva", type: "HR", subject: "Behavioral", score: 8.0, total: 10, date: new Date(Date.now() - 10000000) }
  ],
  bookmarks: [
    { username: "student", question: "What is closure in JS?", subject: "JavaScript", type: "MCQ" }
  ],
  notes: [
    { username: "student", title: "Java OOP Notes", content: "Remember to explain encapsulation vs abstraction clearly with code examples.", date: new Date() }
  ],
  recruitmentSettings: {
    autoShortlist: false // Default to manual review as requested for Company Control features
  },
  recruitmentRounds: [
    {
      id: "round_1",
      name: "Aptitude Test",
      passingPercentage: 75,
      minScore: 7.5,
      negativeMarking: false,
      timeLimit: 30,
      mandatory: true,
      weightage: 25,
      type: "mcq",
      subject: "Aptitude"
    },
    {
      id: "round_2",
      name: "Java Assessment",
      passingPercentage: 70,
      minScore: 7.0,
      negativeMarking: true,
      timeLimit: 45,
      mandatory: true,
      weightage: 25,
      type: "coding",
      subject: "Java"
    },
    {
      id: "round_3",
      name: "Problem Solving",
      passingPercentage: 80,
      minScore: 8.0,
      negativeMarking: false,
      timeLimit: 60,
      mandatory: true,
      weightage: 30,
      type: "coding",
      subject: "Problem Solving"
    },
    {
      id: "round_4",
      name: "AI HR Interview",
      passingPercentage: 60,
      minScore: 6.0,
      negativeMarking: false,
      timeLimit: 15,
      mandatory: true,
      weightage: 20,
      type: "hr",
      subject: "Behavioral"
    }
  ],
  candidateStatus: [
    // Alice: Qualified everything
    { username: "alice", roundId: "round_1", status: "Qualified", score: 8.5, percentage: 85, date: new Date(Date.now() - 259200000) },
    { username: "alice", roundId: "round_2", status: "Qualified", score: 8.0, percentage: 80, date: new Date(Date.now() - 172800000) },
    { username: "alice", roundId: "round_3", status: "Qualified", score: 8.5, percentage: 85, date: new Date(Date.now() - 86400000) },
    { username: "alice", roundId: "round_4", status: "Qualified", score: 9.0, percentage: 90, date: new Date(Date.now() - 10000000) },
    // Bob: Failed Round 2
    { username: "bob", roundId: "round_1", status: "Qualified", score: 8.0, percentage: 80, date: new Date(Date.now() - 259200000) },
    { username: "bob", roundId: "round_2", status: "Not Qualified", score: 5.5, percentage: 55, date: new Date(Date.now() - 172800000) },
    // Charlie: Pending Manual Review on Round 2
    { username: "charlie", roundId: "round_1", status: "Qualified", score: 7.8, percentage: 78, date: new Date(Date.now() - 259200000) },
    { username: "charlie", roundId: "round_2", status: "Pending", score: 7.2, percentage: 72, date: new Date(Date.now() - 172800000) },
    // Eva: Qualified everything
    { username: "eva", roundId: "round_1", status: "Qualified", score: 9.5, percentage: 95, date: new Date(Date.now() - 259200000) },
    { username: "eva", roundId: "round_2", status: "Qualified", score: 8.5, percentage: 85, date: new Date(Date.now() - 172800000) },
    { username: "eva", roundId: "round_3", status: "Qualified", score: 8.0, percentage: 80, date: new Date(Date.now() - 86400000) },
    { username: "eva", roundId: "round_4", status: "Qualified", score: 8.0, percentage: 80, date: new Date(Date.now() - 10000000) },
    // Student (Jane Doe): Qualified Round 1, completed Round 2 (Java)
    { username: "student", roundId: "round_1", status: "Qualified", score: 8.0, percentage: 80, date: new Date(Date.now() - 86400000) },
    { username: "student", roundId: "round_2", status: "Qualified", score: 7.5, percentage: 75, date: new Date(Date.now() - 43200000) }
  ],
  placementCompanies: [
    { username: "tata_hr", password: "password", companyName: "Tata Consultancy Services" }
  ],
  placementDrives: [
    {
      id: "drive_1",
      companyUsername: "tata_hr",
      name: "TCS Ninja Hiring 2026",
      status: "Active", // Draft, Published, Active, Completed
      autoShortlist: false, // Default to manual review mode
      rounds: [
        { id: "r_1", name: "Aptitude Assessment", type: "mcq", passingPercentage: 75, minScore: 7.5, timeLimit: 30, weightage: 30, subject: "Aptitude" },
        { id: "r_2", name: "Programming Test", type: "coding", passingPercentage: 70, minScore: 7.0, timeLimit: 45, weightage: 40, subject: "JavaScript" },
        { id: "r_3", name: "AI HR Round", type: "hr", passingPercentage: 60, minScore: 6.0, timeLimit: 15, weightage: 30, subject: "Behavioral" }
      ]
    }
  ],
  placementQuestions: [],
  placementProgress: [
    {
      username: "alice",
      driveId: "drive_1",
      currentRoundIndex: 2, // Qualified r_1, r_2, waiting for r_3
      status: "Qualified", // Eligible, Pending, Qualified, Disqualified, Selected
      scores: {
        "r_1": 8.0,
        "r_2": 7.5
      }
    },
    {
      username: "bob",
      driveId: "drive_1",
      currentRoundIndex: 1,
      status: "Disqualified", // Failed r_2
      scores: {
        "r_1": 7.8,
        "r_2": 5.0
      }
    },
    {
      username: "charlie",
      driveId: "drive_1",
      currentRoundIndex: 1,
      status: "Pending", // Awaiting HR publish for r_2
      scores: {
        "r_1": 8.5,
        "r_2": 7.2
      }
    }
  ],
  placementRegistrations: [
    { username: "student", driveId: "drive_1", date: new Date() }
  ]
};

// ========================================================
// 4. API ROUTING LIFECYCLE
// ========================================================

// Serving Landing Page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// -- Authentication APIs --
app.post("/api/auth/register", (req, res) => {
  const { username, password, fullName, targetRole } = req.body;
  if (db.users.find(u => u.username === username)) {
    return res.status(400).json({ success: false, message: "Username already exists." });
  }
  const newUser = {
    username,
    password,
    fullName: fullName || username,
    targetRole: targetRole || "Software Engineer",
    streak: 1,
    lastActive: new Date()
  };
  db.users.push(newUser);
  res.json({ success: true, user: { username: newUser.username, fullName: newUser.fullName, targetRole: newUser.targetRole, streak: newUser.streak } });
});

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  const user = db.users.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(401).json({ success: false, message: "Invalid credentials." });
  }
  // Check streak updates
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
  res.json({ success: true, user: { username: user.username, fullName: user.fullName, targetRole: user.targetRole, streak: user.streak } });
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
app.get("/api/recruitment/rounds", (req, res) => {
  res.json({ success: true, rounds: db.recruitmentRounds });
});

// Create or update a recruitment round
app.post("/api/recruitment/rounds", (req, res) => {
  try {
    const { id, name, passingPercentage, minScore, negativeMarking, timeLimit, mandatory, weightage, type, subject } = req.body;
    
    if (id) {
      // Update existing
      const idx = db.recruitmentRounds.findIndex(r => r.id === id);
      if (idx !== -1) {
        db.recruitmentRounds[idx] = {
          ...db.recruitmentRounds[idx],
          name: name || db.recruitmentRounds[idx].name,
          passingPercentage: Number(passingPercentage) || db.recruitmentRounds[idx].passingPercentage,
          minScore: Number(minScore) || db.recruitmentRounds[idx].minScore,
          negativeMarking: !!negativeMarking,
          timeLimit: Number(timeLimit) || db.recruitmentRounds[idx].timeLimit,
          mandatory: !!mandatory,
          weightage: Number(weightage) || db.recruitmentRounds[idx].weightage,
          type: type || db.recruitmentRounds[idx].type,
          subject: subject || db.recruitmentRounds[idx].subject
        };
        return res.json({ success: true, round: db.recruitmentRounds[idx] });
      }
    }

    // Create new
    const newRound = {
      id: "round_" + (db.recruitmentRounds.length + 1),
      name: name || "New Round",
      passingPercentage: Number(passingPercentage) || 70,
      minScore: Number(minScore) || 7.0,
      negativeMarking: !!negativeMarking,
      timeLimit: Number(timeLimit) || 30,
      mandatory: !!mandatory,
      weightage: Number(weightage) || 20,
      type: type || "mcq",
      subject: subject || "General"
    };
    db.recruitmentRounds.push(newRound);
    res.json({ success: true, round: newRound });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get recruitment settings
app.get("/api/recruitment/settings", (req, res) => {
  res.json({ success: true, settings: db.recruitmentSettings });
});

// Update recruitment settings (e.g. toggle autoShortlist)
app.post("/api/recruitment/settings", (req, res) => {
  const { autoShortlist } = req.body;
  db.recruitmentSettings.autoShortlist = !!autoShortlist;
  res.json({ success: true, settings: db.recruitmentSettings });
});

// Get candidates status list across all rounds
app.get("/api/recruitment/candidates", (req, res) => {
  // Return all users that are not 'hr' or 'admin' along with their progression logs
  const candidatesList = db.users
    .filter(u => u.username !== "hr" && u.username !== "admin")
    .map(u => {
      const statuses = db.candidateStatus.filter(s => s.username === u.username);
      return {
        username: u.username,
        fullName: u.fullName,
        targetRole: u.targetRole,
        streak: u.streak,
        roundsStatus: statuses
      };
    });
  res.json({ success: true, candidates: candidatesList });
});

// Submit round test result and calculate automatic round eligibility
app.post("/api/recruitment/submit", (req, res) => {
  try {
    const { username, roundId, score, total = 10 } = req.body;
    const round = db.recruitmentRounds.find(r => r.id === roundId);
    if (!round) {
      return res.status(404).json({ success: false, message: "Recruitment round not found." });
    }

    const percentage = Math.round((score / total) * 100);
    const passes = percentage >= round.passingPercentage;
    
    let status = "Not Qualified";
    if (passes) {
      // Under Auto-Shortlist, candidate qualifies immediately.
      // Under Manual Review, candidate status remains Pending until HR publishes.
      status = db.recruitmentSettings.autoShortlist ? "Qualified" : "Pending";
    }

    const newStatusEntry = {
      username,
      roundId,
      status,
      score: Number(score),
      percentage,
      date: new Date()
    };

    // Update if already completed, else push
    const existingIdx = db.candidateStatus.findIndex(s => s.username === username && s.roundId === roundId);
    if (existingIdx !== -1) {
      db.candidateStatus[existingIdx] = newStatusEntry;
    } else {
      db.candidateStatus.push(newStatusEntry);
    }

    // Save to regular results history
    db.results.push({
      username,
      type: round.type === "mcq" ? "MCQ" : round.type === "coding" ? "Coding" : "HR",
      subject: round.subject,
      score: Number(score),
      total: Number(total),
      date: new Date()
    });

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
app.post("/api/recruitment/publish", (req, res) => {
  const { roundId } = req.body;
  let count = 0;
  
  db.candidateStatus.forEach(entry => {
    if (entry.roundId === roundId && entry.status === "Pending") {
      entry.status = "Qualified";
      count++;
    }
  });

  res.json({
    success: true,
    message: `Successfully published ${count} qualified candidates for ${roundId}.`
  });
});

// -- Leaderboard & Results Persistence APIs --
app.post("/api/results/save", (req, res) => {
  const { username, type, subject, score, total } = req.body;
  const newResult = {
    username: username || "anonymous",
    type: type || "Normal",
    subject: subject || "General",
    score: score || 0,
    total: total || 10,
    date: new Date()
  };
  db.results.push(newResult);
  res.json({ success: true, result: newResult });
});

app.get("/api/results/history/:username", (req, res) => {
  const userResults = db.results.filter(r => r.username === req.params.username);
  res.json({ success: true, history: userResults });
});

app.get("/api/leaderboard", (req, res) => {
  // Aggregate scores by user
  const scoresMap = {};
  db.results.forEach(r => {
    if (!scoresMap[r.username]) {
      scoresMap[r.username] = { username: r.username, totalScore: 0, count: 0, accuracy: 0 };
    }
    // Calculate normalized percentage accuracy
    const percent = (r.score / (r.total || 10)) * 100;
    scoresMap[r.username].totalScore += r.score;
    scoresMap[r.username].count += 1;
    scoresMap[r.username].accuracy += percent;
  });

  const leaderboard = Object.values(scoresMap).map(u => {
    const userDetail = db.users.find(usr => usr.username === u.username);
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
});

// -- Bookmarks & Notes APIs --
app.get("/api/notes/:username", (req, res) => {
  const userNotes = db.notes.filter(n => n.username === req.params.username);
  res.json({ success: true, notes: userNotes });
});

app.post("/api/notes/save", (req, res) => {
  const { username, title, content } = req.body;
  const newNote = {
    username: username || "student",
    title: title || "Untitled Note",
    content: content || "",
    date: new Date()
  };
  db.notes.push(newNote);
  res.json({ success: true, note: newNote });
});

app.get("/api/bookmarks/:username", (req, res) => {
  const userBookmarks = db.bookmarks.filter(b => b.username === req.params.username);
  res.json({ success: true, bookmarks: userBookmarks });
});

app.post("/api/bookmarks/save", (req, res) => {
  const { username, question, subject, type } = req.body;
  const newBookmark = {
    username: username || "student",
    question: question || "",
    subject: subject || "General",
    type: type || "Normal"
  };
  db.bookmarks.push(newBookmark);
  res.json({ success: true, bookmark: newBookmark });
});

// -- Campus Placement Assessment APIs --
app.post("/api/placement/auth/register", (req, res) => {
  const { username, password, companyName } = req.body;
  if (!username || !password || !companyName) {
    return res.status(400).json({ success: false, message: "Missing registration details." });
  }
  const exists = db.placementCompanies.find(c => c.username === username);
  if (exists) {
    return res.status(400).json({ success: false, message: "Company username already exists." });
  }
  const newCompany = { username, password, companyName };
  db.placementCompanies.push(newCompany);
  res.json({ success: true, company: newCompany });
});

app.post("/api/placement/auth/login", (req, res) => {
  const { username, password } = req.body;
  const company = db.placementCompanies.find(c => c.username === username && c.password === password);
  if (!company) {
    return res.status(401).json({ success: false, message: "Invalid company credentials." });
  }
  res.json({
    success: true,
    company: {
      username: company.username,
      companyName: company.companyName,
      role: "company"
    }
  });
});

app.post("/api/placement/auth/student-login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Missing student credentials." });
  }
  let student = db.users.find(u => u.username === username);
  if (!student) {
    student = {
      username,
      password,
      fullName: username.charAt(0).toUpperCase() + username.slice(1) + " Candidate",
      targetRole: "Software Engineer",
      streak: 0,
      lastActive: new Date()
    };
    db.users.push(student);
  } else if (student.password !== password) {
    return res.status(401).json({ success: false, message: "Incorrect student password." });
  }
  res.json({
    success: true,
    student: {
      username: student.username,
      fullName: student.fullName,
      role: "student",
      cgpa: student.cgpa !== undefined ? student.cgpa : 8.2,
      department: student.department || "CSE",
      skills: student.skills || "React, Node.js, Python, Java"
    }
  });
});

// -- Campus Placement Assessment Drives Management APIs --
app.get("/api/placement/drives", (req, res) => {
  res.json({ success: true, drives: db.placementDrives });
});

app.post("/api/placement/drives", (req, res) => {
  const { 
    name, companyUsername, autoShortlist, jobRole, packageOffered, 
    assessmentDate, assessmentTime, duration, eligibleDepts, 
    minCgpa, eligibleBatch, maxStudentsLimit 
  } = req.body;
  const newDrive = {
    id: "drive_" + Date.now(),
    companyUsername: companyUsername || "tata_hr",
    name: name || "New Hiring Campaign",
    status: "Draft",
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
    rounds: []
  };
  db.placementDrives.push(newDrive);
  res.json({ success: true, drive: newDrive });
});

app.post("/api/placement/drives/publish", (req, res) => {
  const { driveId } = req.body;
  const drive = db.placementDrives.find(d => d.id === driveId);
  if (!drive) return res.status(404).json({ success: false, message: "Drive not found" });
  drive.status = "Active";
  res.json({ success: true, drive });
});

app.post("/api/placement/register", (req, res) => {
  const { username, driveId } = req.body;
  const student = db.users.find(u => u.username === username);
  const drive = db.placementDrives.find(d => d.id === driveId);
  
  if (!student) {
    return res.status(404).json({ success: false, message: "Student not found." });
  }
  if (!drive) {
    return res.status(404).json({ success: false, message: "Placement drive not found." });
  }
  
  const existing = db.placementRegistrations.find(r => r.username === username && r.driveId === driveId);
  if (existing) {
    return res.status(400).json({ success: false, message: "You are already registered for this drive." });
  }
  
  const studentCgpa = student.cgpa !== undefined ? student.cgpa : 8.2;
  const studentDept = student.department || "CSE";
  
  if (studentCgpa < drive.minCgpa) {
    return res.status(400).json({ success: false, message: `Ineligible: Your CGPA (${studentCgpa}) is below the required ${drive.minCgpa}.` });
  }
  
  if (drive.eligibleDepts && drive.eligibleDepts.length > 0 && !drive.eligibleDepts.includes(studentDept)) {
    return res.status(400).json({ success: false, message: `Ineligible: Your department (${studentDept}) is not eligible for this drive.` });
  }
  
  db.placementRegistrations.push({
    username,
    driveId,
    date: new Date()
  });
  
  res.json({ success: true, message: "Registered successfully for " + drive.name });
});

app.get("/api/placement/registrations/:username", (req, res) => {
  const list = db.placementRegistrations.filter(r => r.username === req.params.username).map(r => r.driveId);
  res.json({ success: true, registeredDrives: list });
});

app.post("/api/placement/profile/save", (req, res) => {
  const { username, cgpa, department, skills } = req.body;
  const student = db.users.find(u => u.username === username);
  if (!student) {
    return res.status(404).json({ success: false, message: "Student not found." });
  }
  if (cgpa !== undefined) student.cgpa = parseFloat(cgpa);
  if (department !== undefined) student.department = department;
  if (skills !== undefined) student.skills = skills;
  res.json({ success: true, message: "Profile saved successfully." });
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

app.get("/api/placement/progress/:username", (req, res) => {
  const progressList = db.placementProgress.filter(p => p.username === req.params.username);
  res.json({ success: true, progressList });
});

app.post("/api/placement/rounds/save", (req, res) => {
  const { driveId, rounds } = req.body;
  const drive = db.placementDrives.find(d => d.id === driveId);
  if (!drive) {
    return res.status(404).json({ success: false, message: "Drive not found" });
  }
  drive.rounds = rounds;
  res.json({ success: true, drive });
});

app.get("/api/placement/rounds/:driveId", (req, res) => {
  const drive = db.placementDrives.find(d => d.id === req.params.driveId);
  if (!drive) {
    return res.status(404).json({ success: false, message: "Drive not found" });
  }
  res.json({ success: true, rounds: drive.rounds });
});

app.get("/api/placement/questions/:driveId/:roundId", (req, res) => {
  const list = db.placementQuestions.filter(q => q.driveId === req.params.driveId && q.roundId === req.params.roundId);
  res.json({ success: true, questions: list });
});

app.post("/api/placement/questions/save", (req, res) => {
  const { driveId, roundId, questions } = req.body;
  db.placementQuestions = db.placementQuestions.filter(q => !(q.driveId === driveId && q.roundId === roundId));
  questions.forEach(q => {
    db.placementQuestions.push({
      id: "pq_" + Date.now() + Math.random().toString(36).substring(7),
      driveId,
      roundId,
      questionText: q.questionText,
      options: q.options || [],
      correctIndex: q.correctIndex !== undefined ? parseInt(q.correctIndex) : 0,
      explanation: q.explanation || "",
      subject: q.subject || "General",
      topic: q.topic || "Core",
      difficulty: q.difficulty || "Medium"
    });
  });
  res.json({ success: true, message: "Questions saved successfully" });
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
app.post("/api/placement/session/start", (req, res) => {
  const { driveId, roundId, timeLimit } = req.body;
  const drive = db.placementDrives.find(d => d.id === driveId);
  if (!drive) return res.status(404).json({ success: false, message: "Drive not found" });
  
  drive.status = "Active";
  
  io.emit("assessment-started", {
    driveId,
    driveName: drive.name,
    roundId,
    timeLimit: timeLimit || 30
  });
  
  res.json({ success: true, message: "Live drive session broadcasted successfully" });
});

app.post("/api/placement/session/terminate", (req, res) => {
  const { driveId } = req.body;
  const drive = db.placementDrives.find(d => d.id === driveId);
  if (drive) drive.status = "Completed";
  io.emit("assessment-terminated", { driveId });
  res.json({ success: true, message: "Live session terminated" });
});

app.post("/api/placement/session/submit", (req, res) => {
  const { username, driveId, roundId, score, total } = req.body;
  const drive = db.placementDrives.find(d => d.id === driveId);
  if (!drive) return res.status(404).json({ success: false, message: "Drive not found" });
  
  const roundIndex = drive.rounds.findIndex(r => r.id === roundId);
  const round = drive.rounds[roundIndex];
  const scorePercent = (score / total) * 100;
  
  let status = "Qualified";
  if (scorePercent < round.passingPercentage) {
    status = "Disqualified";
  }
  
  let progress = db.placementProgress.find(p => p.username === username && p.driveId === driveId);
  if (!progress) {
    progress = { username, driveId, currentRoundIndex: 0, status, scores: {} };
    db.placementProgress.push(progress);
  }
  
  progress.scores[roundId] = score;
  progress.status = status;
  
  if (status === "Qualified") {
    progress.currentRoundIndex = roundIndex + 1;
  }
  
  res.json({ success: true, status, percentage: scorePercent, progress });
});

app.post("/api/placement/session/publish", (req, res) => {
  const { driveId, roundId } = req.body;
  let count = 0;
  db.placementProgress.forEach(progress => {
    if (progress.driveId === driveId && progress.status === "Pending") {
      progress.status = "Qualified";
      const drive = db.placementDrives.find(d => d.id === driveId);
      const roundIndex = drive.rounds.findIndex(r => r.id === roundId);
      progress.currentRoundIndex = roundIndex + 1;
      count++;
    }
  });
  res.json({ success: true, message: `Published ${count} qualified candidates.` });
});

app.get("/api/placement/candidates/:driveId", (req, res) => {
  const list = db.placementProgress.filter(p => p.driveId === req.params.driveId);
  res.json({ success: true, candidates: list });
});

app.get("/api/admin/system-data", (req, res) => {
  res.json({
    success: true,
    companies: db.placementCompanies,
    drives: db.placementDrives,
    students: db.users
  });
});

app.delete("/api/admin/users/:username", (req, res) => {
  const { username } = req.params;
  const initialLength = db.users.length;
  
  db.users = db.users.filter(u => u.username !== username);
  
  if (db.users.length < initialLength) {
    db.results = db.results.filter(r => r.username !== username);
    db.bookmarks = db.bookmarks.filter(b => b.username !== username);
    db.notes = db.notes.filter(n => n.username !== username);
    db.candidateStatus = db.candidateStatus.filter(c => c.username !== username);
    db.placementProgress = db.placementProgress.filter(p => p.username !== username);
    db.placementRegistrations = db.placementRegistrations.filter(pr => pr.username !== username);
    
    res.json({ success: true, message: `User ${username} deleted successfully.` });
  } else {
    res.status(404).json({ success: false, message: `User ${username} not found.` });
  }
});

// Delete all users
app.delete("/api/admin/users", (req, res) => {
  db.users = [];
  db.results = [];
  db.bookmarks = [];
  db.notes = [];
  db.candidateStatus = [];
  db.placementProgress = [];
  db.placementRegistrations = [];
  res.json({ success: true, message: "All user records and associated data deleted successfully." });
});

// Delete single company
app.delete("/api/admin/companies/:username", (req, res) => {
  const { username } = req.params;
  const initialLength = db.placementCompanies.length;
  
  db.placementCompanies = db.placementCompanies.filter(c => c.username !== username);
  
  if (db.placementCompanies.length < initialLength) {
    const companyDrives = db.placementDrives.filter(d => d.companyUsername === username);
    const driveIds = companyDrives.map(d => d.id);
    
    db.placementDrives = db.placementDrives.filter(d => d.companyUsername !== username);
    db.placementProgress = db.placementProgress.filter(p => !driveIds.includes(p.driveId));
    db.placementRegistrations = db.placementRegistrations.filter(pr => !driveIds.includes(pr.driveId));
    
    res.json({ success: true, message: `Company ${username} and all associated drives deleted successfully.` });
  } else {
    res.status(404).json({ success: false, message: `Company ${username} not found.` });
  }
});

// Delete single drive
app.delete("/api/admin/drives/:id", (req, res) => {
  const { id } = req.params;
  const initialLength = db.placementDrives.length;
  
  db.placementDrives = db.placementDrives.filter(d => d.id !== id);
  
  if (db.placementDrives.length < initialLength) {
    db.placementProgress = db.placementProgress.filter(p => p.driveId !== id);
    db.placementRegistrations = db.placementRegistrations.filter(pr => pr.driveId !== id);
    res.json({ success: true, message: `Drive ${id} deleted successfully.` });
  } else {
    res.status(404).json({ success: false, message: `Drive ${id} not found.` });
  }
});

// Delete all companies (and drives)
app.delete("/api/admin/companies", (req, res) => {
  db.placementCompanies = [];
  db.placementDrives = [];
  db.placementProgress = [];
  db.placementRegistrations = [];
  res.json({ success: true, message: "All company records, drives, and registrations deleted successfully." });
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