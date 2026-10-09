require("dotenv").config({ quiet: true });
const { spawn } = require("node:child_process");
const mongoose = require("mongoose");

const port = 3199;
const baseUrl = `http://127.0.0.1:${port}`;
const testDatabase = "hiregrad_ai_e2e";
const sourceUri = process.env.MONGODB_URI;
if (!sourceUri) throw new Error("MONGODB_URI is required.");
const testUri = sourceUri.replace(/\/[^/?]+(\?|$)/, `/${testDatabase}$1`);
const suffix = Date.now();
const studentEmail = `ai.student.${suffix}@example.com`;
const hrEmail = `ai.hr.${suffix}@example.com`;

const server = spawn(process.execPath, ["server.js"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port), MONGODB_URI: testUri, NODE_ENV: "development", ENABLE_DEMO_SEED: "false", GEMINI_API_KEY: "" },
  stdio: ["ignore", "pipe", "pipe"]
});
let serverLogs = "";
server.stdout.on("data", chunk => { serverLogs += chunk.toString(); });
server.stderr.on("data", chunk => { serverLogs += chunk.toString(); });

async function request(path, options = {}, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) }
  });
  const body = await response.json();
  if (!response.ok || body.success === false) throw new Error(`${path}: ${body.message || response.status}`);
  return body;
}

async function waitUntilReady() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try { const health = await request("/api/health"); if (health.database === "connected") return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Server did not become ready. ${serverLogs}`);
}

async function main() {
  try {
    await waitUntilReady();
    await request("/api/placement/auth/register", { method: "POST", body: JSON.stringify({ fullName: "AI Test Student", email: studentEmail, password: "StudentPass123!", role: "student" }) });
    await request("/api/placement/auth/register", { method: "POST", body: JSON.stringify({ fullName: "AI Test Company", email: hrEmail, password: "RecruiterPass123!", role: "company" }) });
    const studentLogin = await request("/api/placement/auth/student-login", { method: "POST", body: JSON.stringify({ email: studentEmail, password: "StudentPass123!" }) });
    const hrLogin = await request("/api/placement/auth/login", { method: "POST", body: JSON.stringify({ email: hrEmail, password: "RecruiterPass123!" }) });
    const scheduled = await request("/api/placement/interviews/schedule", { method: "POST", body: JSON.stringify({
      studentId: studentLogin.student.id, date: "2026-12-01", time: "10:00", duration: 15, type: "AI HR", meetingId: `ai-e2e-${suffix}`
    }) }, hrLogin.token);
    const started = await request(`/api/placement/interviews/${scheduled.interview.id}/ai/start`, { method: "POST", body: "{}" }, studentLogin.token);
    if (!started.session.currentQuestion) throw new Error("AI did not generate an opening question.");
    let finalResponse;
    for (let question = 1; question <= 5; question += 1) {
      finalResponse = await request(`/api/placement/interviews/${scheduled.interview.id}/ai/answer`, {
        method: "POST",
        body: JSON.stringify({ answer: `In situation ${question}, I clarified the goal, collaborated with my team, implemented the solution, measured the outcome, and documented what I learned.` })
      }, studentLogin.token);
    }
    if (!finalResponse.completed || !finalResponse.evaluation?.strengths?.length) throw new Error("Final AI evaluation was not generated.");
    const feedback = await request(`/api/placement/interviews/${scheduled.interview.id}/feedback`, {}, studentLogin.token);
    const report = await request(`/api/placement/interviews/${scheduled.interview.id}/ai/report`, {}, studentLogin.token);
    if (!feedback.feedback || report.session?.status !== "completed") throw new Error("Persisted report verification failed.");
    console.log(JSON.stringify({ health: "ok", groq: "ok", questions: 5, evaluation: "persisted", historyFeedback: "available" }));
  } finally {
    server.kill();
    await new Promise(resolve => setTimeout(resolve, 500));
    await mongoose.connect(testUri, { serverSelectionTimeoutMS: 5000 });
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
