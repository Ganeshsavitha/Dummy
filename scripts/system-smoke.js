const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { io } = require("../frontend/node_modules/socket.io-client");
require("dotenv").config({ quiet: true });

const db = require("../db");
const BASE = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";
const runId = `smoke_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const password = `Smoke-${crypto.randomBytes(8).toString("hex")}!`;
const emails = {
  student: `${runId}_student@example.com`,
  otherStudent: `${runId}_other@example.com`,
  hr: `${runId}_hr@example.com`,
  admin: `${runId}_admin@example.com`,
};
const results = [];

function check(condition, name, detail = "") {
  if (!condition) throw new Error(`${name}${detail ? `: ${detail}` : ""}`);
  results.push(name);
  console.log(`PASS ${name}`);
}

async function api(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, body: payload };
}

function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE, { auth: { token }, transports: ["websocket"], reconnection: false, timeout: 5000 });
    const timer = setTimeout(() => { socket.close(); reject(new Error("socket timeout")); }, 6000);
    socket.once("connect", () => { clearTimeout(timer); resolve(socket); });
    socket.once("connect_error", error => { clearTimeout(timer); socket.close(); reject(error); });
  });
}

function once(socket, event, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeout);
    socket.once(event, data => { clearTimeout(timer); resolve(data); });
  });
}

async function cleanup() {
  const User = db.mongoose.model("User");
  const users = await User.find({ email: { $in: Object.values(emails) } }).lean();
  const ids = users.map(user => user.id);
  const usernames = Object.values(emails).map(email => email.split("@")[0]);
  const Interview = db.mongoose.model("Interview");
  const interviews = await Interview.find({ $or: [{ hrId: { $in: ids } }, { studentId: { $in: ids } }] }).lean();
  const interviewIds = interviews.map(item => item.id);
  await Promise.all([
    db.mongoose.model("InterviewFeedback").deleteMany({ interviewId: { $in: interviewIds } }),
    db.mongoose.model("InterviewChat").deleteMany({ interviewId: { $in: interviewIds } }),
    db.mongoose.model("InterviewHistory").deleteMany({ interviewId: { $in: interviewIds } }),
    db.mongoose.model("AIInterviewSession").deleteMany({ interviewId: { $in: interviewIds } }),
    Interview.deleteMany({ id: { $in: interviewIds } }),
    db.mongoose.model("PlacementCompany").deleteMany({ username: { $in: usernames } }),
    User.deleteMany({ email: { $in: Object.values(emails) } }),
  ]);
}

async function main() {
  await db.initDb();
  await cleanup();

  const health = await api("/api/health");
  check(health.status === 200 && health.body.database === "connected", "health and database");

  for (const [key, role] of [["student", "student"], ["otherStudent", "student"], ["hr", "company"]]) {
    const registered = await api("/api/placement/auth/register", {
      method: "POST", body: { fullName: `Smoke ${key}`, email: emails[key], password, role }
    });
    check(registered.status === 200, `register ${key}`, JSON.stringify(registered.body));
  }
  await db.createUser("Smoke Admin", emails.admin, bcrypt.hashSync(password, 10), "admin");

  const studentLogin = await api("/api/placement/auth/student-login", { method: "POST", body: { email: emails.student, password } });
  const otherLogin = await api("/api/placement/auth/student-login", { method: "POST", body: { email: emails.otherStudent, password } });
  const hrLogin = await api("/api/placement/auth/login", { method: "POST", body: { email: emails.hr, password } });
  const adminLogin = await api("/api/placement/auth/login", { method: "POST", body: { email: emails.admin, password } });
  check(studentLogin.status === 200 && studentLogin.body.student.role === "student", "student login");
  check(hrLogin.status === 200 && hrLogin.body.company.role === "company", "HR login");
  check(adminLogin.status === 200 && adminLogin.body.company.role === "admin", "admin login");
  const tokens = { student: studentLogin.body.token, other: otherLogin.body.token, hr: hrLogin.body.token, admin: adminLogin.body.token };

  const wrongPortals = await Promise.all([
    api("/api/placement/auth/login", { method: "POST", body: { email: emails.student, password } }),
    api("/api/placement/auth/student-login", { method: "POST", body: { email: emails.hr, password } }),
  ]);
  check(wrongPortals.every(item => item.status === 401), "cross-role login denied");
  check((await api("/api/admin/system-data", { token: tokens.student })).status === 403, "student denied admin API");
  check((await api("/api/admin/system-data", { token: tokens.hr })).status === 403, "HR denied admin API");
  check((await api("/api/admin/system-data", { token: tokens.admin })).status === 200, "admin API allowed");
  check((await api("/api/placement/students", { token: tokens.student })).status === 403, "student denied recruiter roster");
  check((await api("/api/placement/students", { token: tokens.hr })).status === 200, "HR recruiter roster allowed");
  const studentUsername = emails.student.split("@")[0];
  const otherUsername = emails.otherStudent.split("@")[0];
  check((await api(`/api/notes/${otherUsername}`, { token: tokens.student })).status === 403, "student denied another student's notes");
  check((await api("/api/notes/save", { method: "POST", token: tokens.hr, body: { username: studentUsername, title: "x", content: "x" } })).status === 403, "HR denied student notes write");
  check((await api("/api/results/save", { method: "POST", token: tokens.student, body: { username: otherUsername, type: "MCQ", subject: "Test", score: 10, total: 10 } })).status === 403, "student denied score spoofing");
  check((await api("/api/evaluate-code", { method: "POST", token: tokens.hr, body: { question: "x", answer: "x", language: "javascript", testCases: [] } })).status === 403, "HR denied student coding evaluator");

  const studentId = studentLogin.body.student.id;
  const meetingId = `${runId}_meeting`;
  const now = new Date();
  const pad = value => String(value).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const scheduleBody = { studentId, date, time, duration: 30, type: "Technical", meetingId };
  check((await api("/api/placement/interviews/schedule", { method: "POST", token: tokens.student, body: scheduleBody })).status === 403, "student denied scheduling");
  const scheduled = await api("/api/placement/interviews/schedule", { method: "POST", token: tokens.hr, body: scheduleBody });
  check(scheduled.status === 200 && scheduled.body.interview.meetingId === meetingId, "HR schedules interview", JSON.stringify(scheduled.body));
  const interview = scheduled.body.interview;
  check(interview.invitationStatus === "pending", "new interview starts as pending invitation");
  check((await api(`/api/placement/interviews/${meetingId}/verify`, { token: tokens.student })).status === 409, "pending invitation cannot join");
  check((await api(`/api/placement/interviews/${interview.id}/respond`, { method: "POST", token: tokens.hr, body: { response: "accepted" } })).status === 403, "HR cannot accept for student");
  check((await api(`/api/placement/interviews/${interview.id}/respond`, { method: "POST", token: tokens.other, body: { response: "accepted" } })).status === 403, "unassigned student cannot accept invite");
  const accepted = await api(`/api/placement/interviews/${interview.id}/respond`, { method: "POST", token: tokens.student, body: { response: "accepted" } });
  check(accepted.status === 200 && accepted.body.interview.invitationStatus === "accepted", "assigned student accepts invite");
  check((await api(`/api/placement/interviews/${meetingId}/verify`, { token: tokens.student })).status === 200, "assigned student can verify meeting");
  check((await api(`/api/placement/interviews/${meetingId}/verify`, { token: tokens.hr })).status === 200, "assigned HR can verify meeting");
  check((await api(`/api/placement/interviews/${meetingId}/verify`, { token: tokens.other })).status === 403, "unassigned student denied meeting");
  check((await api(`/api/placement/interviews/${interview.id}/status`, { method: "POST", token: tokens.student, body: { status: "ongoing" } })).status === 403, "student denied privileged status change");
  check((await api(`/api/placement/interviews/${interview.id}/status`, { method: "POST", token: tokens.hr, body: { status: "ongoing" } })).status === 200, "HR can start interview");

  const sockets = [];
  try {
    let unauthenticatedRejected = false;
    try { await connectSocket(undefined); } catch { unauthenticatedRejected = true; }
    check(unauthenticatedRejected, "unauthenticated socket rejected");
    const hrSocket = await connectSocket(tokens.hr); sockets.push(hrSocket);
    const studentSocket = await connectSocket(tokens.student); sockets.push(studentSocket);
    const intruderSocket = await connectSocket(tokens.other); sockets.push(intruderSocket);
    const hrAck = once(hrSocket, "join-ack");
    hrSocket.emit("join-meeting", { meetingId, userRole: "hr", userId: interview.hrId });
    await hrAck;
    const joined = once(hrSocket, "user-joined");
    const studentAck = once(studentSocket, "join-ack");
    studentSocket.emit("join-meeting", { meetingId, userRole: "student", userId: studentId });
    await Promise.all([joined, studentAck]);
    const joinError = once(intruderSocket, "join-error");
    intruderSocket.emit("join-meeting", { meetingId, userRole: "student", userId: otherLogin.body.student.id });
    check(Boolean((await joinError).message), "unassigned socket denied meeting");
    const relayed = once(studentSocket, "offer");
    hrSocket.emit("offer", { meetingId, offer: { type: "offer", sdp: "smoke-sdp" } });
    check((await relayed).offer.sdp === "smoke-sdp", "WebRTC offer signaling relay");
    const answered = once(hrSocket, "answer");
    studentSocket.emit("answer", { meetingId, answer: { type: "answer", sdp: "smoke-answer" } });
    check((await answered).answer.sdp === "smoke-answer", "WebRTC answer signaling relay");
    const iceRelayed = once(studentSocket, "ice-candidate");
    hrSocket.emit("ice-candidate", { meetingId, candidate: { candidate: "smoke-ice" } });
    check((await iceRelayed).candidate.candidate === "smoke-ice", "WebRTC ICE signaling relay");
    const chatRelayed = once(hrSocket, "chat-message");
    studentSocket.emit("chat-message", { meetingId, message: { text: "smoke chat" } });
    check((await chatRelayed).message.text === "smoke chat", "meeting chat relay");
  } finally {
    sockets.forEach(socket => socket.close());
  }

  const evaluation = await api(`/api/placement/interviews/${interview.id}/evaluate`, {
    method: "POST", token: tokens.hr,
    body: { communicationScore: 8, technicalScore: 8, confidenceScore: 8, problemSolvingScore: 8, overallRating: 8, comments: "Automated smoke test", result: "selected" }
  });
  check(evaluation.status === 200, "assigned HR submits evaluation", JSON.stringify(evaluation.body));
  check((await api(`/api/placement/interviews/${interview.id}/feedback`, { token: tokens.student })).status === 200, "assigned student reads feedback");
  check((await api(`/api/placement/interviews/${interview.id}/feedback`, { token: tokens.other })).status === 403, "unassigned student denied feedback");

  const code = await api("/api/evaluate-code", {
    method: "POST", token: tokens.student,
    body: { question: "Read one integer and print twice its value.", language: "javascript", answer: "const fs=require('fs');console.log(Number(fs.readFileSync(0,'utf8').trim())*2)", testCases: [{ input: "2", output: "4" }, { input: "7", output: "14" }] }
  });
  check(code.status === 200 && code.body.feedback?.testResults?.every(item => item.status === "PASS"), "coding evaluator returns passing test results", JSON.stringify(code.body));

  console.log(`\n${results.length} smoke checks passed.`);
}

main().catch(error => { console.error(`FAIL ${error.stack || error.message}`); process.exitCode = 1; })
  .finally(async () => { try { await cleanup(); } finally { await db.closeDb(); } });
