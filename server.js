const express = require("express");
const cors = require("cors");
const path = require("path");
const Groq = require("groq-sdk");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const JWT_SECRET = process.env.JWT_SECRET || (IS_PRODUCTION ? null : "development-only-change-me");
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET must be configured in production.");
}

// Import MongoDB/Mongoose database operations
const db = require("./db");
const dbReady = db.initDb();
dbReady.then(() => {
  console.log("Database initialized and seeded. 🚀");
});
dbReady.catch(err => {
  console.error("Database initialization failed:", err);
});


const app = express();

app.disable("x-powered-by");
const configuredOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);
const renderOrigin = process.env.RENDER_EXTERNAL_HOSTNAME
  ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`
  : null;
const allowedOrigins = new Set([...configuredOrigins, ...(renderOrigin ? [renderOrigin] : [])]);
app.use(cors({
  origin(origin, callback) {
    if (!origin || !IS_PRODUCTION || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS policy."));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(self), geolocation=()");
  if (IS_PRODUCTION) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "frontend/dist")));

// Small in-process limiter. A shared Redis-backed limiter should replace this
// when the service is horizontally scaled.
const requestBuckets = new Map();
app.use("/api", (req, res, next) => {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const current = requestBuckets.get(key);
  if (!current || now - current.startedAt > 60_000) {
    requestBuckets.set(key, { startedAt: now, count: 1 });
    return next();
  }
  current.count += 1;
  if (current.count > 180) return res.status(429).json({ success: false, message: "Too many requests." });
  next();
});

function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ success: false, message: "A Bearer token is required." });
  }
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ success: false, message: "Invalid or expired token." });
    req.user = decoded;
    next();
  });
}

function requireRole(...roles) {
  return (req, res, next) => roles.includes(req.user?.role)
    ? next()
    : res.status(403).json({ success: false, message: "You are not authorized for this operation." });
}

function getInterviewJoinWindow(interview, now = new Date()) {
  const scheduledAt = new Date(`${interview.date}T${interview.time}:00`);
  const valid = !Number.isNaN(scheduledAt.getTime());
  const opensAt = valid ? new Date(scheduledAt.getTime() - 15 * 60 * 1000) : null;
  const closesAt = valid ? new Date(scheduledAt.getTime() + (Number(interview.duration) + 15) * 60 * 1000) : null;
  return { valid, open: valid && now >= opensAt && now <= closesAt, opensAt, closesAt };
}

const publicApiRoutes = new Set([
  "GET /api/health",
  "POST /api/auth/register", "POST /api/auth/login",
  "POST /api/placement/auth/register", "POST /api/placement/auth/login",
  "POST /api/placement/auth/student-login", "GET /api/placement/network-info",
  "GET /api/placement/drives"
]);
app.use("/api", (req, res, next) => {
  const routePath = req.originalUrl.split("?")[0];
  if (publicApiRoutes.has(`${req.method} ${routePath}`)) return next();
  return authenticateJWT(req, res, next);
});

app.use("/api/admin", requireRole("admin"));
app.use("/api/recruitment", (req, res, next) => {
  if (req.method === "GET" && req.user?.role === "student") return next();
  return requireRole("hr", "admin")(req, res, next);
});

app.use("/api/placement", async (req, res, next) => {
  // Public placement routes were already allow-listed above.
  if (!req.user) return next();
  const routePath = req.originalUrl.split("?")[0];
  const hrWriteRoutes = [
    "/api/placement/drives", "/api/placement/drives/publish",
    "/api/placement/rounds/save", "/api/placement/questions/save",
    "/api/placement/questions/generate", "/api/placement/questions/upload-pdf",
    "/api/placement/session/start", "/api/placement/session/terminate",
    "/api/placement/session/publish"
  ];
  if (req.method !== "GET" && hrWriteRoutes.includes(routePath)) {
    if (!["hr", "admin"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Recruiters or administrators only." });
    }
    if (req.user.role === "hr") {
      const ownerUsername = req.user.email.split("@")[0];
      const driveId = req.body?.driveId || req.body?.id;
      if (routePath === "/api/placement/drives") req.body.companyUsername = ownerUsername;
      if (driveId) {
        try {
          const drive = (await db.getPlacementDrives()).find(item => item.id === driveId);
          if (drive && drive.company_username !== ownerUsername && drive.companyUsername !== ownerUsername) {
            return res.status(403).json({ success: false, message: "You do not own this placement drive." });
          }
        } catch (error) {
          return next(error);
        }
      }
    }
    return next();
  }
  if (req.method === "GET" && /^\/api\/placement\/candidates\//.test(routePath)) {
    return requireRole("hr", "admin")(req, res, next);
  }
  if (["/api/placement/register", "/api/placement/profile/save", "/api/placement/session/submit", "/api/placement/resume/scan"].includes(routePath)) {
    if (req.user.role !== "student") return res.status(403).json({ success: false, message: "Students only." });
  }
  const username = req.body?.username || routePath.match(/^\/api\/placement\/(?:registrations|progress)\/([^/]+)$/)?.[1];
  if (req.user.role === "student" && username && username !== req.user.email.split("@")[0]) {
    return res.status(403).json({ success: false, message: "You cannot access another student's data." });
  }
  next();
});

// Student-owned learning data must never be readable or writable by another
// authenticated account. The username in legacy endpoints is retained for
// client compatibility, but the JWT remains the source of truth.
app.use("/api", (req, res, next) => {
  const routePath = req.originalUrl.split("?")[0];
  const studentOnlyPaths = new Set([
    "/api/generate-question", "/api/evaluate-answer", "/api/evaluate-code-review",
    "/api/analyze-resume", "/api/generate-roadmap", "/api/evaluate-code",
    "/api/results/save", "/api/notes/save", "/api/bookmarks/save"
  ]);
  const ownedPathMatch = routePath.match(/^\/api\/(?:results\/history|notes|bookmarks)\/([^/]+)$/);

  if (studentOnlyPaths.has(routePath)) {
    if (req.user?.role !== "student") {
      return res.status(403).json({ success: false, message: "Students only." });
    }
    const requestedUsername = req.body?.username;
    const authenticatedUsername = req.user.email.split("@")[0];
    if (requestedUsername && requestedUsername !== authenticatedUsername) {
      return res.status(403).json({ success: false, message: "You cannot modify another student's data." });
    }
    if (["/api/results/save", "/api/notes/save", "/api/bookmarks/save"].includes(routePath)) {
      req.body.username = authenticatedUsername;
    }
  }

  if (ownedPathMatch) {
    if (req.user?.role !== "student" || ownedPathMatch[1] !== req.user.email.split("@")[0]) {
      return res.status(403).json({ success: false, message: "You cannot access another student's data." });
    }
  }
  next();
});

// ========================================================
// 1. UNIFIED GEMINI / GROQ CLIENT ADAPTER
// ========================================================
app.get("/api/health", async (req, res) => {
  try {
    await dbReady;
    const connected = db.mongoose.connection.readyState === 1;
    res.status(connected ? 200 : 503).json({ status: connected ? "ok" : "unavailable", database: connected ? "connected" : "disconnected", timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "unavailable", database: "disconnected" });
  }
});

const isValidEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
const isStrongEnoughPassword = value => typeof value === "string" && value.length >= 8 && value.length <= 128;
const hasGemini = !!process.env.GEMINI_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
const groqKeys = [...new Set([
  ...(process.env.GROQ_API_KEYS || "").split(","),
  ...(process.env.GROQ_API_KEY || "").split(","),
  ...Object.entries(process.env)
    .filter(([name]) => /^GROQ_API_KEY_\d+$/.test(name))
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([, value]) => value)
].map(value => String(value || "").trim()).filter(Boolean))];
const hasGroq = groqKeys.length > 0;

console.log("AI Services Status:");
console.log("- Gemini API status:", hasGemini ? "AVAILABLE ✅" : "NOT CONFIGURED ❌");
console.log("- Groq API status:", hasGroq ? "AVAILABLE ✅" : "NOT CONFIGURED ❌");

let genAI = null;
let groqClients = [];
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 30_000);
const withTimeout = (promise, timeoutMs, label) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`${label} timed out.`)), timeoutMs);
  promise.then(
    value => { clearTimeout(timer); resolve(value); },
    error => { clearTimeout(timer); reject(error); }
  );
});

if (hasGemini) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}
if (hasGroq) {
  groqClients = groqKeys.map(apiKey => new Groq({ apiKey }));
}

async function runGroqRequest(createRequest) {
  let lastError;
  for (const client of groqClients) {
    try {
      return await createRequest(client);
    } catch (error) {
      lastError = error;
      const status = error?.status;
      const code = error?.error?.error?.code || error?.error?.code;
      // Fail over only for invalid/revoked credentials or transient provider
      // failures. A 429 is organization-level and must not be bypassed.
      if (![401, 403, 500, 502, 503, 504].includes(status) && !["expired_api_key", "invalid_api_key"].includes(code)) throw error;
    }
  }
  throw lastError || new Error("No Groq client is available.");
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
      const result = await withTimeout(model.generateContent(fullPrompt), AI_TIMEOUT_MS, "Gemini request");
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

    try {
      const completion = await runGroqRequest(client => withTimeout(client.chat.completions.create({
        messages: messages,
        model: GROQ_MODEL,
        response_format: isJson ? { type: "json_object" } : undefined,
        temperature: 0.7,
        max_tokens: 1500
      }), AI_TIMEOUT_MS, "Groq request"));
      return completion.choices[0].message.content;
    } catch (error) {
      const failedGeneration = error?.error?.error?.failed_generation || error?.error?.failed_generation;
      if (isJson && typeof failedGeneration === "string" && failedGeneration.trim()) {
        console.warn("Groq JSON validation failed; recovering the generated JSON payload.");
        return failedGeneration;
      }
      throw error;
    }
  }

  throw new Error("No AI API Keys are configured. Please check your .env settings.");
}

async function getGroqJSON(prompt, systemPrompt) {
  if (!groqClients.length) throw new Error("No Groq API key is configured.");
  const completion = await runGroqRequest(client => withTimeout(client.chat.completions.create({
    model: GROQ_MODEL,
    messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.45,
    max_tokens: 1400
  }), AI_TIMEOUT_MS, "Groq AI interview request"));
  const parsed = JSON.parse(String(completion.choices[0]?.message?.content || "{}").replace(/```json|```/g, "").trim());
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Groq returned an invalid interview response.");
  return parsed;
}

function safeParseJSON(str) {
  if (!str) return [];
  const cleaned = String(str).replace(/```json|```/g, "").trim();
  const candidates = [cleaned];
  const firstObject = cleaned.indexOf("{");
  const firstArray = cleaned.indexOf("[");
  const start = firstArray >= 0 && (firstObject < 0 || firstArray < firstObject) ? firstArray : firstObject;
  if (start >= 0) candidates.push(cleaned.slice(start));

  for (const original of candidates) {
    let candidate = original;
    for (let attempt = 0; attempt < 4 && candidate; attempt += 1) {
      try { return JSON.parse(candidate); } catch {}
      candidate = candidate.replace(/[}\]]\s*$/, "").trimEnd();
    }
  }
  console.error("Failed to parse AI JSON response.");
  return [];
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
  res.sendFile(path.join(__dirname, "frontend/dist", "index.html"));
});

// -- Authentication APIs (Vanilla/Fallback compatibility) --
app.post("/api/auth/register", async (req, res) => {
  const { username, password, fullName, targetRole } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Username and password required." });
  }
  if (!isStrongEnoughPassword(password)) return res.status(400).json({ success: false, message: "Password must contain 8 to 128 characters." });

  const email = username.includes("@") ? username : `${username}@example.com`;

  try {
    const row = await db.getUserByEmail(email);
    if (row) {
      return res.status(400).json({ success: false, message: "Username/Email already exists." });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const user = await db.createUser(fullName || username, email, hashedPassword, 'student');

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "24h" });
    res.status(201).json({
      success: true,
      token,
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

    const token = jwt.sign({ id: row.id, email: row.email, role: row.role }, JWT_SECRET, { expiresIn: "24h" });
    res.json({
      success: true,
      token,
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
app.post("/api/evaluate-code-review", async (req, res) => {
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

// -- Campus Placement Assessment APIs --
app.post("/api/placement/auth/register", async (req, res) => {
  const { fullName, email, password, role } = req.body;
  if (!fullName || !email || !password || !role) {
    return res.status(400).json({ success: false, message: "Missing registration details." });
  }
  if (!isValidEmail(email)) return res.status(400).json({ success: false, message: "A valid email address is required." });
  if (!isStrongEnoughPassword(password)) return res.status(400).json({ success: false, message: "Password must contain 8 to 128 characters." });
  
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
        id: user.id,
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
        id: user.id,
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
          id: user.id,
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
          id: user.id,
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
    let drives = await db.getPlacementDrives();
    if (!req.user) drives = drives.filter(drive => drive.status === "Active");
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
    if (!Number.isFinite(newCgpa) || newCgpa < 0 || newCgpa > 10) {
      return res.status(400).json({ success: false, message: "CGPA must be between 0 and 10." });
    }
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
  const { subject, count, difficulty, type } = req.body;
  const isCoding = type === 'coding' || (subject && (subject.toLowerCase().includes('programming') || subject.toLowerCase().includes('coding')));
  
  if (isCoding) {
    const prompt = `Generate exactly ${count || 1} programming coding challenge on subject "${subject}" with difficulty level "${difficulty || "Medium"}". 
    
    Each coding challenge must have a title, problem description, starter template code (with a standard function to write), and exactly 3 testcases (each testcase has an input string and an output string).
    
    Output the response as a raw JSON array matching this schema:
    [
      {
        "questionText": "Problem description here. Describe the task clearly.",
        "options": [],
        "correctIndex": 0,
        "explanation": "Brief explanation of the optimal algorithm",
        "topic": "Programming",
        "title": "Title of the challenge",
        "starterCode": "function solution() {\\n  // Write your code here\\n}",
        "sampleInput": "Sample Input details",
        "sampleOutput": "Sample Output details",
        "testCases": [
          { "input": "Input 1", "output": "Output 1" },
          { "input": "Input 2", "output": "Output 2" },
          { "input": "Input 3", "output": "Output 3" }
        ]
      }
    ]`;
    try {
      const responseText = await getAICompletion(prompt, "You are a senior compiler questions generator. Output only JSON array, do not add markdown wrapping tags.", true);
      const parsed = safeParseJSON(responseText);
      res.json({ success: true, questions: parsed });
    } catch (err) {
      res.status(500).json({ success: false, message: "AI coding question generation failed: " + err.message });
    }
    return;
  }

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

app.post("/api/evaluate-code", async (req, res) => {
  const { question, answer, language, testCases } = req.body;
  if (!answer) {
    return res.status(400).json({ success: false, message: "Code solution is empty." });
  }

  const prompt = `Act as a secure execution sandbox and code evaluator. Evaluate the following programming solution in "${language}" for the given problem against the provided test cases.

  Problem description:
  ${question}

  Student's Code Solution:
  ${answer}

  Test Cases to evaluate:
  ${JSON.stringify(testCases || [])}

  Analyze if the code compiles and runs. Test the code logic against each test case input and determine if it output the expected value.
  Determine the space complexity and time complexity of the solution. Grade the solution out of 10 points.
  Provide feedback suggestions and a detailed logic review.

  Output the response as a single, raw JSON object matching this schema:
  {
    "success": true,
    "compilationStatus": "Success | Compilation Error | Runtime Error",
    "errorMessage": "Syntax error message if code fails to compile, otherwise empty string",
    "testResults": [
      { "input": "Sample Input", "expected": "Expected Output", "actual": "Actual Output", "status": "PASS | FAIL" }
    ],
    "score": 8,
    "timeComplexity": "O(N)",
    "spaceComplexity": "O(1)",
    "suggestions": ["Suggestion 1", "Suggestion 2"],
    "explanation": "Detailed logic analysis and feedback summary"
  }`;

  try {
    const responseText = await getAICompletion(
      prompt,
      "You are an expert AI compiler examiner. Evaluate the code and test cases, and output exactly one JSON object. Do not include any markdown format tags.",
      true
    );
    const parsed = safeParseJSON(responseText);
    res.json({ success: true, feedback: parsed });
  } catch (err) {
    res.status(500).json({ success: false, message: "AI code evaluation failed: " + err.message });
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
    await db.completePlacementDrive(driveId);
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
    if (!round) return res.status(404).json({ success: false, message: "Assessment round not found." });
    if (!Number.isFinite(Number(score)) || !Number.isFinite(Number(total)) || Number(total) <= 0 || Number(score) < 0 || Number(score) > Number(total)) {
      return res.status(400).json({ success: false, message: "Score and total are invalid." });
    }
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

// ========================================================
// LIVE HR INTERVIEW ENDPOINTS (Phase 4 & 5)
// ========================================================

// Fetch all students for scheduling dropdown (HR or Admin only)
app.get("/api/placement/students", authenticateJWT, async (req, res) => {
  if (req.user.role !== 'hr' && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: "Unauthorized. HR or Admin only." });
  }

  try {
    const list = await db.getAllStudents();
    res.json({ success: true, students: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Schedule an interview (HR only)
app.post("/api/placement/interviews/schedule", authenticateJWT, async (req, res) => {
  if (req.user.role !== 'hr' && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: "Unauthorized. HR only." });
  }

  const { studentId, date, time, duration, type, meetingId } = req.body;
  if (!studentId || !date || !time || !duration || !type || !meetingId) {
    return res.status(400).json({ success: false, message: "Missing scheduling fields." });
  }
  if (!["Technical", "HR", "Managerial"].includes(type)) {
    return res.status(400).json({ success: false, message: "Invalid interview type." });
  }
  if (!Number.isInteger(Number(duration)) || Number(duration) < 5 || Number(duration) > 120) {
    return res.status(400).json({ success: false, message: "Duration must be between 5 and 120 minutes." });
  }

  try {
    const interview = await db.createInterview(meetingId, req.user.id, studentId, date, time, duration, type);
    
    // Notify only the selected student via Socket.io
    io.to(`student_${studentId}`).emit("new-interview-scheduled", interview);
    console.log(`[Notification] Emitted new-interview-scheduled to student notification room: student_${studentId}`);
    
    res.json({ success: true, interview });
  } catch (err) {
    console.error("Error scheduling interview:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// The selected student alone can accept or decline an HR interview invite.
app.post("/api/placement/interviews/:id/respond", authenticateJWT, async (req, res) => {
  const { response } = req.body;
  if (req.user.role !== "student") {
    return res.status(403).json({ success: false, message: "Only the invited student can respond." });
  }
  if (!["accepted", "declined"].includes(response)) {
    return res.status(400).json({ success: false, message: "Response must be accepted or declined." });
  }
  try {
    const existing = await db.getInterviewById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Interview not found." });
    if (existing.studentId !== req.user.id) {
      return res.status(403).json({ success: false, message: "This invitation is not assigned to you." });
    }
    if (["ongoing", "completed", "cancelled"].includes(existing.status)) {
      return res.status(409).json({ success: false, message: "This interview can no longer be changed." });
    }
    const interview = await db.respondToInterviewInvitation(req.params.id, response);
    io.to(`hr_${interview.hrId}`).emit("interview-invitation-response", { interviewId: interview.id, response, interview });
    res.json({ success: true, interview });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Retrieve interviews for student
app.get("/api/placement/interviews/student", authenticateJWT, async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ success: false, message: "Unauthorized. Students only." });
  }

  try {
    const list = await db.getInterviewsForStudent(req.user.id);
    res.json({ success: true, interviews: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Retrieve interviews for HR
app.get("/api/placement/interviews/hr", authenticateJWT, async (req, res) => {
  if (req.user.role !== 'hr') {
    return res.status(403).json({ success: false, message: "Unauthorized. HR only." });
  }

  try {
    const list = await db.getInterviewsForHR(req.user.id);
    res.json({ success: true, interviews: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Verify and join an interview (access check)
app.get("/api/placement/interviews/:meetingId/verify", authenticateJWT, async (req, res) => {
  const { meetingId } = req.params;
  try {
    console.log(`[Join Auth Check] User ${req.user.id} (${req.user.role}) requesting to join meeting ${meetingId}`);
    
    const interview = await db.getInterviewByMeetingId(meetingId);
    if (!interview) {
      console.warn(`[Join Auth Check] Rejecting join request: Meeting ID ${meetingId} not found`);
      return res.status(404).json({ success: false, message: "Meeting not found." });
    }
    if (interview.invitationStatus !== "accepted") {
      return res.status(409).json({ success: false, message: interview.invitationStatus === "declined" ? "This invitation was declined." : "The student must accept this invitation before the meeting can be joined." });
    }

    const joinWindow = getInterviewJoinWindow(interview);
    if (!joinWindow.open) {
      return res.status(403).json({ success: false, message: `This meeting opens 15 minutes before ${interview.date} at ${interview.time}.` });
    }
    
    console.log(`[Join Auth Check] Found Interview metadata: 
      - Meeting ID: ${interview.meetingId}
      - Assigned Candidate ID: ${interview.studentId}
      - Assigned HR ID: ${interview.hrId}
      - Candidate Name: ${interview.studentName}`);
      
    const isHr = req.user.role === 'hr' || req.user.role === 'admin';
    const isStudent = req.user.role === 'student';
    
    if (isHr) {
      // Validate that this HR is the one assigned to the meeting
      if (interview.hrId !== req.user.id && req.user.role !== 'admin') {
        console.warn(`[Join Auth Check] Rejecting HR ${req.user.id}: Not assigned to meeting. Assigned HR: ${interview.hrId}`);
        return res.status(403).json({ success: false, message: "You are not the assigned interviewer for this meeting." });
      }
    } else if (isStudent) {
      // Validate that this Student is the one assigned to the meeting
      if (interview.studentId !== req.user.id) {
        console.warn(`[Join Auth Check] Rejecting Student ${req.user.id}: Not assigned to meeting. Assigned Student: ${interview.studentId}`);
        return res.status(403).json({ success: false, message: "You're not assigned to this interview." });
      }
    } else {
      console.warn(`[Join Auth Check] Rejecting User ${req.user.id}: Invalid role ${req.user.role}`);
      return res.status(403).json({ success: false, message: "Unauthorized role." });
    }
    
    console.log(`[Join Auth Check] Authorized user ${req.user.id} to join meeting ${meetingId}`);
    res.json({ success: true, interview });
  } catch (err) {
    console.error("Error verifying interview join:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update interview status (e.g., set to ongoing when HR admits student)
app.post("/api/placement/interviews/:id/status", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['scheduled', 'waiting', 'ongoing', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status." });
  }

  try {
    const existing = await db.getInterviewById(id);
    if (!existing) return res.status(404).json({ success: false, message: "Interview not found." });
    if (existing.invitationStatus !== "accepted" && status !== "cancelled") {
      return res.status(409).json({ success: false, message: "The student must accept the invitation first." });
    }
    const ownsInterview = req.user.role === "admin" || existing.hrId === req.user.id || existing.studentId === req.user.id;
    if (!ownsInterview) return res.status(403).json({ success: false, message: "You are not assigned to this interview." });
    if (req.user.role === "student" && !["waiting", "cancelled"].includes(status)) {
      return res.status(403).json({ success: false, message: "Students cannot set this interview status." });
    }
    const interview = await db.updateInterviewStatus(id, status);
    
    // Broadcast status change to the student and to the meeting room
    io.to(`student_${interview.studentId}`).emit("interview-status-changed", { interviewId: id, status, interview });
    
    const formattedRoom = interview.meetingId.startsWith("meeting_") ? interview.meetingId : `meeting_${interview.meetingId}`;
    io.to(formattedRoom).emit("interview-status-changed", { interviewId: id, status, interview });
    
    console.log(`[Socket Broadcast] Emitted interview-status-changed to student_${interview.studentId} and ${formattedRoom} with status ${status}`);
    
    res.json({ success: true, interview });
  } catch (err) {
    console.error("Error updating interview status:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Submit evaluation feedback (HR only)
app.post("/api/placement/interviews/:id/evaluate", authenticateJWT, async (req, res) => {
  if (req.user.role !== 'hr') {
    return res.status(403).json({ success: false, message: "Unauthorized. HR only." });
  }

  const { id } = req.params;
  const { communicationScore, technicalScore, confidenceScore, problemSolvingScore, overallRating, comments, result } = req.body;

  if (communicationScore === undefined || technicalScore === undefined || confidenceScore === undefined || problemSolvingScore === undefined || !comments || !result) {
    return res.status(400).json({ success: false, message: "Missing evaluation inputs." });
  }

  try {
    const interview = await db.getInterviewById(id);
    if (!interview) return res.status(404).json({ success: false, message: "Interview not found." });
    if (interview.hrId !== req.user.id) return res.status(403).json({ success: false, message: "You are not the assigned interviewer." });
    const feedback = await db.saveInterviewFeedback(
      id,
      parseInt(communicationScore),
      parseInt(technicalScore),
      parseInt(confidenceScore),
      parseInt(problemSolvingScore),
      parseFloat(overallRating),
      comments,
      result
    );
    res.json({ success: true, feedback });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Fetch feedback details for a specific completed interview
app.get("/api/placement/interviews/:id/feedback", authenticateJWT, async (req, res) => {
  const { id } = req.params;

  try {
    const interview = await db.getInterviewById(id);
    if (!interview) return res.status(404).json({ success: false, message: "Interview not found." });
    const canRead = req.user.role === "admin" || interview.hrId === req.user.id || interview.studentId === req.user.id;
    if (!canRead) return res.status(403).json({ success: false, message: "You cannot view this feedback." });
    const feedback = await db.getInterviewFeedback(id);
    res.json({ success: true, feedback });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Groq-powered AI HR interview. It follows the same scheduled -> waiting ->
// ongoing -> completed lifecycle as a human interview.
async function requireAssignedAIInterview(req, res) {
  const interview = await db.getInterviewById(req.params.id);
  if (!interview) {
    res.status(404).json({ success: false, message: "Interview not found." });
    return null;
  }
  if (req.user.role !== "student" || interview.studentId !== req.user.id) {
    res.status(403).json({ success: false, message: "Only the assigned candidate can run this AI interview." });
    return null;
  }
  if (String(interview.type).toLowerCase() !== "ai hr") {
    res.status(400).json({ success: false, message: "This schedule is not an AI HR interview." });
    return null;
  }
  return interview;
}

app.post("/api/placement/interviews/:id/ai/start", async (req, res) => {
  try {
    const interview = await requireAssignedAIInterview(req, res);
    if (!interview) return;
    const existing = await db.getAIInterviewSession(interview.id);
    if (existing) return res.json({ success: true, session: existing, resumed: true });

    const student = await db.getUserById(req.user.id);
    const profile = {
      name: student?.full_name || interview.studentName,
      targetRole: student?.target_role || "Software Engineer",
      department: student?.department || "Not specified",
      skills: JSON.parse(student?.skills || "[]").slice(0, 12)
    };
    const generated = await getGroqJSON(
      `Create the opening question for this candidate profile: ${JSON.stringify(profile)}. The interview has exactly five questions.`,
      `You are HireGrad's professional AI HR interviewer. Be warm, concise and unbiased. Ask one behavioral or role-relevant question at a time. Never assess appearance, accent, gender, disability, ethnicity or other sensitive traits. Return JSON only: {"greeting":"short greeting","question":"one clear opening question"}.`
    );
    const question = String(generated.question || "Tell me about yourself and why you are interested in this role.").slice(0, 700);
    const greeting = String(generated.greeting || `Hello ${profile.name}. Welcome to your AI HR interview.`).slice(0, 300);
    const session = await db.startAIInterviewSession(interview.id, req.user.id, question);
    await db.updateInterviewStatus(interview.id, "ongoing");
    res.json({ success: true, greeting, session });
  } catch (error) {
    console.error("AI interview start failed:", error);
    res.status(502).json({ success: false, message: error.message });
  }
});

app.post("/api/placement/interviews/:id/ai/answer", async (req, res) => {
  try {
    const interview = await requireAssignedAIInterview(req, res);
    if (!interview) return;
    const answer = String(req.body?.answer || "").trim();
    if (answer.length < 2 || answer.length > 5000) {
      return res.status(400).json({ success: false, message: "Answer must contain 2 to 5000 characters." });
    }
    const session = await db.getAIInterviewSession(interview.id);
    if (!session) return res.status(409).json({ success: false, message: "Start the AI interview first." });
    if (session.status === "completed") return res.json({ success: true, completed: true, evaluation: session.evaluation });

    const history = session.messages.slice(-8).map(message => ({ speaker: message.speaker, text: message.text }));
    if (session.questionCount >= 5) {
      const evaluation = await getGroqJSON(
        `Evaluate this completed interview transcript. Transcript: ${JSON.stringify([...history, { speaker: "candidate", text: answer }])}`,
        `You are a fair interview evaluator. Judge only answer content and communication evidence in the transcript. Do not infer personality or sensitive traits. Return JSON only with this schema: {"communicationScore":1,"technicalScore":1,"confidenceScore":1,"problemSolvingScore":1,"overallRating":1,"strengths":["specific strength"],"weaknesses":["specific improvement"],"improvements":["actionable advice"],"summary":"concise evidence-based summary","recommendation":"selected|hold|rejected"}. Every score must be 1-10.`
      );
      const score = value => Math.max(1, Math.min(10, Number(value) || 1));
      const normalized = {
        communicationScore: score(evaluation.communicationScore), technicalScore: score(evaluation.technicalScore),
        confidenceScore: score(evaluation.confidenceScore), problemSolvingScore: score(evaluation.problemSolvingScore),
        overallRating: score(evaluation.overallRating),
        strengths: Array.isArray(evaluation.strengths) ? evaluation.strengths.slice(0, 6).map(String) : [],
        weaknesses: Array.isArray(evaluation.weaknesses) ? evaluation.weaknesses.slice(0, 6).map(String) : [],
        improvements: Array.isArray(evaluation.improvements) ? evaluation.improvements.slice(0, 6).map(String) : [],
        summary: String(evaluation.summary || "Interview completed."),
        recommendation: ["selected", "hold", "rejected"].includes(evaluation.recommendation) ? evaluation.recommendation : "hold"
      };
      await db.completeAIInterviewSession(interview.id, answer, normalized);
      await db.saveInterviewFeedback(interview.id, normalized.communicationScore, normalized.technicalScore,
        normalized.confidenceScore, normalized.problemSolvingScore, normalized.overallRating,
        `${normalized.summary}\nStrengths: ${normalized.strengths.join("; ")}\nImprovements: ${normalized.improvements.join("; ")}`,
        normalized.recommendation);
      return res.json({ success: true, completed: true, evaluation: normalized });
    }

    const generated = await getGroqJSON(
      `Question ${session.questionCount}: ${session.currentQuestion}\nCandidate answer: ${answer}\nRecent transcript: ${JSON.stringify(history)}\nGenerate the next single question.`,
      `You are a professional AI HR interviewer conducting a five-question interview. Ask a concise adaptive follow-up or move to a different behavioral/role topic. Do not repeat questions. Never assess appearance, accent or sensitive traits. Return JSON only: {"acknowledgement":"one short neutral sentence","question":"one next question"}.`
    );
    const nextQuestion = String(generated.question || "Describe a challenging situation and how you handled it.").slice(0, 700);
    const updated = await db.addAIInterviewTurn(interview.id, answer, nextQuestion);
    res.json({ success: true, completed: false, acknowledgement: String(generated.acknowledgement || "Thank you.").slice(0, 250), session: updated });
  } catch (error) {
    console.error("AI interview answer failed:", error);
    res.status(502).json({ success: false, message: error.message });
  }
});

app.get("/api/placement/interviews/:id/ai/report", async (req, res) => {
  try {
    const interview = await db.getInterviewById(req.params.id);
    if (!interview) return res.status(404).json({ success: false, message: "Interview not found." });
    const allowed = req.user.role === "admin" || interview.studentId === req.user.id || interview.hrId === req.user.id;
    if (!allowed) return res.status(403).json({ success: false, message: "You cannot view this report." });
    const session = await db.getAIInterviewSession(interview.id);
    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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

app.use("/api", (req, res) => {
  res.status(404).json({ success: false, message: "API endpoint not found." });
});

// Fallback client SPA routing
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "frontend/dist", "index.html"));
});

app.use((err, req, res, next) => {
  console.error("Unhandled request error:", err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ success: false, message: IS_PRODUCTION ? "Internal server error." : err.message });
});

// Start HTTP & Sockets Server
const PORT = process.env.PORT || 3000;
const http = require("http");
const socketIo = require("socket.io");
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: IS_PRODUCTION ? [...allowedOrigins] : true,
    methods: ["GET", "POST"]
  }
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Authentication required."));
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error("Invalid or expired token."));
    socket.user = decoded;
    next();
  });
});

io.on("connection", (socket) => {
  console.log(`Socket client connected: ${socket.id}`);

  socket.on("join-session", ({ username, role, driveId }) => {
    if (socket.user.role === "student" && role !== "student") return;
    if (socket.user.role === "hr" && role !== "company") return;
    socket.join(driveId);
    console.log(`${username} joined room for drive: ${driveId}`);
  });

  socket.on("candidate-submit", ({ username, driveId, roundId, score, status }) => {
    if (socket.user.role !== "student" || username !== socket.user.email.split("@")[0]) return;
    io.to(driveId).emit("candidate-update", { username, roundId, score, status });
  });

  // Real-Time Student Notification Room Join
  socket.on("join-student-room", ({ studentId }) => {
    if (socket.user.role !== "student" || socket.user.id !== studentId) return;
    socket.join(`student_${studentId}`);
    console.log(`Student ${studentId} joined personal notification room`);
  });

  socket.on("join-hr-room", ({ hrId }) => {
    if (socket.user.role !== "hr" || socket.user.id !== hrId) return;
    socket.join(`hr_${hrId}`);
  });

  // WebRTC Live HR Interview Signaling (Phase 6 & 7)
  socket.on("join-meeting", async ({ meetingId, userRole, userId }) => {
    const formattedRoom = meetingId.startsWith("meeting_") ? meetingId : `meeting_${meetingId}`;
    
    try {
      console.log(`[Socket Auth Check] User ${userId} (${userRole}) requesting to join socket room: ${formattedRoom}`);
      
      const interview = await db.getInterviewByMeetingId(meetingId);
      if (!interview) {
        console.warn(`[Socket Auth Check] Rejecting join request: Meeting ID ${meetingId} not found in database`);
        socket.emit("join-error", { message: "Meeting not found." });
        return;
      }
      if (interview.invitationStatus !== "accepted") {
        socket.emit("join-error", { message: "The interview invitation has not been accepted." });
        return;
      }
      if (!getInterviewJoinWindow(interview).open) {
        socket.emit("join-error", { message: `This meeting opens 15 minutes before ${interview.date} at ${interview.time}.` });
        return;
      }
      
      console.log(`[Socket Auth Check] Found Interview metadata:
        - Socket Room: ${formattedRoom}
        - Current Logged-in User: ${userId}
        - Assigned Student: ${interview.studentId}
        - Selected Candidate: ${interview.studentName}
        - Assigned HR: ${interview.hrId}`);
      
      const isHr = socket.user.role === 'hr';
      const isStudent = socket.user.role === 'student';
      userId = socket.user.id;
      userRole = socket.user.role;
      
      if (isHr) {
        if (interview.hrId !== userId) {
          console.warn(`[Socket Auth Check] Rejecting HR ${userId}: Not assigned to meeting. Assigned HR: ${interview.hrId}`);
          socket.emit("join-error", { message: "You are not the assigned interviewer." });
          return;
        }
      } else if (isStudent) {
        if (interview.studentId !== userId) {
          console.warn(`[Socket Auth Check] Rejecting Student ${userId}: Not assigned to meeting. Assigned Student: ${interview.studentId}`);
          socket.emit("join-error", { message: "You're not assigned to this interview." });
          return;
        }
      } else {
        console.warn(`[Socket Auth Check] Rejecting User ${userId} due to invalid role: ${userRole}`);
        socket.emit("join-error", { message: "Unauthorized role." });
        return;
      }
      
      socket.join(formattedRoom);
      socket.meetingId = formattedRoom;
      socket.userRole = userRole;
      socket.userId = userId;
      console.log(`[Socket Success] User ${userId} (${userRole}) joined meeting room: ${formattedRoom}`);
      
      // Get number of clients in the room to acknowledge to the joiner
      const clients = io.sockets.adapter.rooms.get(formattedRoom);
      const numClients = clients ? clients.size : 0;
      
      // Emit acknowledgment to the sender
      socket.emit("join-ack", { numClients });
      
      // Notify others in the room
      socket.to(formattedRoom).emit("user-joined", { userId, userRole });
    } catch (e) {
      console.error("[Socket Join Error]", e);
      socket.emit("join-error", { message: "Internal server error." });
    }
  });

  socket.on("offer", ({ meetingId, offer }) => {
    const formattedRoom = meetingId.startsWith("meeting_") ? meetingId : `meeting_${meetingId}`;
    if (socket.meetingId !== formattedRoom) return;
    console.log(`Forwarding WebRTC offer for room: ${formattedRoom}`);
    socket.to(formattedRoom).emit("offer", { offer });
  });

  socket.on("answer", ({ meetingId, answer }) => {
    const formattedRoom = meetingId.startsWith("meeting_") ? meetingId : `meeting_${meetingId}`;
    if (socket.meetingId !== formattedRoom) return;
    console.log(`Forwarding WebRTC answer for room: ${formattedRoom}`);
    socket.to(formattedRoom).emit("answer", { answer });
  });

  socket.on("ice-candidate", ({ meetingId, candidate }) => {
    const formattedRoom = meetingId.startsWith("meeting_") ? meetingId : `meeting_${meetingId}`;
    if (socket.meetingId !== formattedRoom) return;
    console.log(`Forwarding WebRTC ICE candidate for room: ${formattedRoom}`);
    socket.to(formattedRoom).emit("ice-candidate", { candidate });
  });

  socket.on("leave-meeting", ({ meetingId }) => {
    const formattedRoom = meetingId.startsWith("meeting_") ? meetingId : `meeting_${meetingId}`;
    if (socket.meetingId !== formattedRoom) return;
    console.log(`User left meeting room: ${formattedRoom}`);
    socket.to(formattedRoom).emit("user-left");
    socket.leave(formattedRoom);
  });

  socket.on("chat-message", ({ meetingId, message }) => {
    const formattedRoom = meetingId.startsWith("meeting_") ? meetingId : `meeting_${meetingId}`;
    if (socket.meetingId !== formattedRoom || !message || typeof message.text !== "string") return;
    message.text = message.text.trim().slice(0, 2000);
    if (!message.text) return;
    console.log(`Forwarding chat message for room: ${formattedRoom}`);
    socket.to(formattedRoom).emit("chat-message", { message });
  });

  socket.on("disconnect", () => {
    console.log(`Socket client disconnected: ${socket.id}`);
    if (socket.meetingId) {
      socket.to(socket.meetingId).emit("user-left");
    }
  });
});

dbReady.then(() => {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
  });
}).catch(error => {
  console.error("Server startup aborted because database initialization failed:", error);
  process.exit(1);
});

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down gracefully.`);
  server.close(async () => {
    try { await db.closeDb(); } finally { process.exit(0); }
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
