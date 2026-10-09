const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const generateUUID = () => crypto.randomUUID();
const schemaOptions = { versionKey: false, timestamps: false };

const User = mongoose.model("User", new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ["student", "hr", "admin"], required: true, index: true },
  createdAt: { type: Date, default: Date.now },
  targetRole: String,
  streak: { type: Number, default: 0 },
  lastActive: Date,
  cgpa: { type: Number, min: 0, max: 10 },
  department: String,
  skills: { type: [String], default: [] },
  companyName: String
}, schemaOptions));

const Result = mongoose.model("Result", new mongoose.Schema({
  id: { type: String, default: generateUUID, unique: true }, username: { type: String, index: true },
  type: String, subject: String, score: Number, total: Number, date: { type: Date, default: Date.now }
}, schemaOptions));
const Bookmark = mongoose.model("Bookmark", new mongoose.Schema({
  id: { type: String, default: generateUUID, unique: true }, username: { type: String, index: true },
  question: String, subject: String, type: String
}, schemaOptions));
const Note = mongoose.model("Note", new mongoose.Schema({
  id: { type: String, default: generateUUID, unique: true }, username: { type: String, index: true },
  title: String, content: String, date: { type: Date, default: Date.now }
}, schemaOptions));
const Setting = mongoose.model("RecruitmentSetting", new mongoose.Schema({
  key: { type: String, unique: true }, value: mongoose.Schema.Types.Mixed
}, schemaOptions));
const RecruitmentRound = mongoose.model("RecruitmentRound", new mongoose.Schema({
  id: { type: String, required: true, unique: true }, name: String, passingPercentage: Number,
  minScore: Number, negativeMarking: Boolean, timeLimit: Number, mandatory: Boolean,
  weightage: Number, type: String, subject: String
}, schemaOptions));
const CandidateStatus = mongoose.model("CandidateStatus", new mongoose.Schema({
  username: { type: String, required: true }, roundId: { type: String, required: true }, status: String,
  score: Number, percentage: Number, date: { type: Date, default: Date.now }
}, schemaOptions).index({ username: 1, roundId: 1 }, { unique: true }));
const PlacementCompany = mongoose.model("PlacementCompany", new mongoose.Schema({
  username: { type: String, required: true, unique: true }, companyName: String
}, schemaOptions));
const PlacementDrive = mongoose.model("PlacementDrive", new mongoose.Schema({
  id: { type: String, required: true, unique: true }, companyUsername: { type: String, index: true },
  name: String, status: { type: String, default: "Draft", index: true }, autoShortlist: Boolean,
  jobRole: String, packageOffered: String, assessmentDate: String, assessmentTime: String,
  duration: Number, eligibleDepts: { type: [String], default: [] }, minCgpa: Number,
  eligibleBatch: String, maxStudentsLimit: Number, rounds: { type: [mongoose.Schema.Types.Mixed], default: [] }
}, schemaOptions));
const PlacementQuestion = mongoose.model("PlacementQuestion", new mongoose.Schema({
  id: { type: String, default: generateUUID, unique: true }, driveId: { type: String, required: true },
  roundId: { type: String, required: true }, questionText: String, options: { type: [String], default: [] },
  correctIndex: Number, explanation: String, subject: String, topic: String, difficulty: String,
  title: String, starterCode: String, sampleInput: String, sampleOutput: String,
  testCases: { type: [mongoose.Schema.Types.Mixed], default: [] }
}, schemaOptions).index({ driveId: 1, roundId: 1 }));
const PlacementProgress = mongoose.model("PlacementProgress", new mongoose.Schema({
  username: { type: String, required: true }, driveId: { type: String, required: true },
  currentRoundIndex: Number, status: String, scores: { type: Map, of: Number, default: {} }
}, schemaOptions).index({ username: 1, driveId: 1 }, { unique: true }));
const PlacementRegistration = mongoose.model("PlacementRegistration", new mongoose.Schema({
  username: { type: String, required: true }, driveId: { type: String, required: true }, date: { type: Date, default: Date.now }
}, schemaOptions).index({ username: 1, driveId: 1 }, { unique: true }));
const Interview = mongoose.model("Interview", new mongoose.Schema({
  id: { type: String, default: generateUUID, unique: true }, meetingId: { type: String, required: true, unique: true },
  hrId: { type: String, required: true, index: true }, studentId: { type: String, required: true, index: true },
  scheduledDate: { type: String, required: true }, scheduledTime: { type: String, required: true },
  duration: { type: Number, required: true }, type: { type: String, required: true },
  status: { type: String, enum: ["scheduled", "waiting", "ongoing", "completed", "cancelled"], default: "scheduled" },
  meetingStatus: { type: String, enum: ["scheduled", "waiting", "ongoing", "completed", "cancelled"], default: "scheduled" },
  invitationStatus: { type: String, enum: ["pending", "accepted", "declined"], default: "pending", index: true },
  invitationRespondedAt: Date,
  joinToken: { type: String, select: false }, createdAt: { type: Date, default: Date.now }
}, schemaOptions));
const InterviewFeedback = mongoose.model("InterviewFeedback", new mongoose.Schema({
  id: { type: String, default: generateUUID, unique: true }, interviewId: { type: String, required: true, unique: true },
  communicationScore: { type: Number, min: 1, max: 10 }, technicalScore: { type: Number, min: 1, max: 10 },
  confidenceScore: { type: Number, min: 1, max: 10 }, problemSolvingScore: { type: Number, min: 1, max: 10 },
  overallRating: Number, comments: String, result: { type: String, enum: ["selected", "rejected", "hold"] },
  submittedAt: { type: Date, default: Date.now }
}, schemaOptions));
const InterviewChat = mongoose.model("InterviewChat", new mongoose.Schema({
  id: { type: String, default: generateUUID, unique: true }, interviewId: { type: String, required: true, index: true },
  senderId: { type: String, required: true }, message: { type: String, required: true, maxlength: 2000 },
  timestamp: { type: Date, default: Date.now }
}, schemaOptions));
const InterviewHistory = mongoose.model("InterviewHistory", new mongoose.Schema({
  id: { type: String, default: generateUUID, unique: true }, interviewId: { type: String, required: true, index: true },
  studentJoinedAt: Date, hrJoinedAt: Date, endedAt: Date, durationSeconds: Number
}, schemaOptions));
const AIInterviewSession = mongoose.model("AIInterviewSession", new mongoose.Schema({
  id: { type: String, default: generateUUID, unique: true },
  interviewId: { type: String, required: true, unique: true, index: true },
  studentId: { type: String, required: true, index: true },
  status: { type: String, enum: ["active", "completed"], default: "active" },
  questionCount: { type: Number, default: 0 },
  currentQuestion: String,
  messages: { type: [{ speaker: { type: String, enum: ["ai", "candidate"] }, text: String, createdAt: { type: Date, default: Date.now } }], default: [] },
  evaluation: mongoose.Schema.Types.Mixed,
  startedAt: { type: Date, default: Date.now },
  completedAt: Date
}, schemaOptions));

function userDto(user, includePassword = false) {
  if (!user) return null;
  const u = user.toObject ? user.toObject() : user;
  const dto = { id: u.id, full_name: u.fullName, email: u.email, role: u.role, created_at: u.createdAt,
    target_role: u.targetRole, streak: u.streak, last_active: u.lastActive, cgpa: u.cgpa,
    department: u.department, skills: JSON.stringify(u.skills || []), company_name: u.companyName };
  if (includePassword) dto.password = u.password;
  return dto;
}
function roundDto(r) {
  if (!r) return null; const x = r.toObject ? r.toObject() : r;
  return { id: x.id, name: x.name, passing_percentage: x.passingPercentage, min_score: x.minScore,
    negative_marking: x.negativeMarking ? 1 : 0, time_limit: x.timeLimit, mandatory: x.mandatory ? 1 : 0,
    weightage: x.weightage, type: x.type, subject: x.subject };
}
function statusDto(s) {
  const x = s.toObject ? s.toObject() : s;
  return { username: x.username, round_id: x.roundId, status: x.status, score: x.score, percentage: x.percentage, date: x.date };
}
function progressDto(p) {
  const x = p.toObject ? p.toObject({ flattenMaps: true }) : p;
  return { username: x.username, driveId: x.driveId, drive_id: x.driveId, currentRoundIndex: x.currentRoundIndex,
    current_round_index: x.currentRoundIndex, status: x.status, scores: x.scores || {} };
}
function questionDto(q) {
  const x = q.toObject ? q.toObject() : q;
  return { id: x.id, driveId: x.driveId, drive_id: x.driveId, roundId: x.roundId, round_id: x.roundId,
    questionText: x.questionText, question_text: x.questionText, options: x.options || [], correctIndex: x.correctIndex,
    correct_index: x.correctIndex, explanation: x.explanation, subject: x.subject, topic: x.topic,
    difficulty: x.difficulty, title: x.title || "", starterCode: x.starterCode || "", sampleInput: x.sampleInput || "",
    sampleOutput: x.sampleOutput || "", testCases: x.testCases || [] };
}

async function initDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required.");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: Number(process.env.MONGODB_TIMEOUT_MS || 10000), maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || 20) });
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
  const existingAdmin = await User.exists({ role: "admin" });
  if (!existingAdmin && (process.env.ADMIN_EMAIL || process.env.ADMIN_PASSWORD)) {
    const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD || "";
    if (!email || password.length < 12) throw new Error("ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters are required together.");
    await User.create({ id: generateUUID(), fullName: "System Administrator", email, password: bcrypt.hashSync(password, 12), role: "admin" });
  } else if (!existingAdmin && process.env.NODE_ENV === "production") {
    throw new Error("A fresh production database requires ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters.");
  }
  if (process.env.ENABLE_DEMO_SEED === "true") await seedDemoData();
  console.log(`Connected to MongoDB database: ${mongoose.connection.name}`);
}

async function seedDemoData() {
  if (await User.exists({})) return;
  const users = [
    ["System Administrator", "admin@example.com", "admin-password", "admin", null],
    ["Jane Doe", "student@example.com", "student-password", "student", null],
    ["HR Recruiter", "hr@example.com", "recruiter-password", "hr", "HireGrad Hiring Corp"]
  ];
  for (const [fullName, email, password, role, companyName] of users) {
    await User.create({ id: generateUUID(), fullName, email, password: bcrypt.hashSync(password, 10), role, companyName,
      targetRole: role === "student" ? "Software Engineer" : undefined, cgpa: role === "student" ? 8.2 : undefined,
      department: role === "student" ? "CSE" : undefined, skills: role === "student" ? ["JavaScript", "React"] : [] });
  }
  await PlacementCompany.create({ username: "hr", companyName: "HireGrad Hiring Corp" });
  await Setting.updateOne({ key: "autoShortlist" }, { $setOnInsert: { value: false } }, { upsert: true });
}

async function closeDb() { await mongoose.disconnect(); }
async function getUserByEmail(email) { return userDto(await User.findOne({ email: String(email).toLowerCase() }).select("+password"), true); }
async function getUserById(id) { return userDto(await User.findOne({ id })); }
async function getUserByUsername(username) {
  const value = String(username).toLowerCase();
  return userDto(await User.findOne(value.includes("@") ? { email: value } : { email: new RegExp(`^${escapeRegex(value)}@`, "i") }).select("+password"), true);
}
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
async function createUser(fullName, email, hashedPassword, role, companyName = null) {
  return userDto(await User.create({ id: generateUUID(), fullName, email: String(email).toLowerCase(), password: hashedPassword, role, companyName, streak: 0 }), false);
}
async function updateUserProfile(username, cgpa, department, skills) { await User.updateOne(usernameFilter(username), { cgpa, department, skills }); }
async function updateUserStreakAndActive(username, streak, lastActive) { await User.updateOne(usernameFilter(username), { streak, lastActive }); }
async function deleteUser(username) { await User.deleteOne(usernameFilter(username)); }
async function deleteAllUsers() { await User.deleteMany({ role: { $ne: "admin" } }); }
async function getAllStudents() { return (await User.find({ role: "student" })).map(u => ({ ...userDto(u), skills: u.skills || [], username: u.email.split("@")[0] })); }
function usernameFilter(username) { const value = String(username).toLowerCase(); return value.includes("@") ? { email: value } : { email: new RegExp(`^${escapeRegex(value)}@`, "i") }; }

async function getResultsHistory(username) { return Result.find({ username }).sort({ date: -1 }).lean(); }
async function getAllResults() { return Result.find().lean(); }
async function saveResult(username, type, subject, score, total) { return Result.create({ username, type, subject, score, total }).then(x => x.toObject()); }
async function deleteResultsByUsername(username) { await Result.deleteMany({ username }); }
async function deleteAllResults() { await Result.deleteMany({}); }
async function getBookmarks(username) { return Bookmark.find({ username }).lean(); }
async function saveBookmark(username, question, subject, type) { return Bookmark.create({ username, question, subject, type }).then(x => x.toObject()); }
async function deleteBookmarksByUsername(username) { await Bookmark.deleteMany({ username }); }
async function deleteAllBookmarks() { await Bookmark.deleteMany({}); }
async function getNotes(username) { return Note.find({ username }).sort({ date: -1 }).lean(); }
async function saveNote(username, title, content) { return Note.create({ username, title, content }).then(x => x.toObject()); }
async function deleteNotesByUsername(username) { await Note.deleteMany({ username }); }
async function deleteAllNotes() { await Note.deleteMany({}); }

async function getRecruitmentSettings() { const x = await Setting.findOne({ key: "autoShortlist" }).lean(); return { autoShortlist: Boolean(x?.value) }; }
async function saveRecruitmentSettings(autoShortlist) { await Setting.updateOne({ key: "autoShortlist" }, { value: Boolean(autoShortlist) }, { upsert: true }); }
async function getRecruitmentRounds() { return (await RecruitmentRound.find()).map(roundDto); }
async function saveRecruitmentRound(round) {
  const id = round.id || `round_${Date.now()}`;
  const x = await RecruitmentRound.findOneAndUpdate({ id }, { id, name: round.name, passingPercentage: round.passingPercentage,
    minScore: round.minScore, negativeMarking: Boolean(round.negativeMarking), timeLimit: round.timeLimit,
    mandatory: Boolean(round.mandatory), weightage: round.weightage, type: round.type, subject: round.subject },
  { upsert: true, new: true, runValidators: true }); return roundDto(x);
}
async function getCandidateStatusByUsername(username) { return (await CandidateStatus.find({ username })).map(statusDto); }
async function getAllCandidateStatus() { return (await CandidateStatus.find()).map(statusDto); }
async function saveCandidateStatus(username, roundId, status, score, percentage) { await CandidateStatus.updateOne({ username, roundId }, { username, roundId, status, score, percentage, date: new Date() }, { upsert: true }); }
async function publishCandidateStatus(roundId) { return CandidateStatus.updateMany({ roundId, status: "Pending" }, { status: "Qualified" }); }
async function deleteCandidateStatusByUsername(username) { await CandidateStatus.deleteMany({ username }); }
async function deleteAllCandidateStatus() { await CandidateStatus.deleteMany({}); }

async function getPlacementCompanies() { return (await PlacementCompany.find().lean()).map(x => ({ username: x.username, companyName: x.companyName, company_name: x.companyName })); }
async function savePlacementCompany(username, companyName) { await PlacementCompany.updateOne({ username }, { username, companyName }, { upsert: true }); }
async function deleteCompany(username) { await PlacementCompany.deleteOne({ username }); }
async function deleteAllCompanies() { await PlacementCompany.deleteMany({}); }
function driveDto(d) { if (!d) return null; const x = d.toObject ? d.toObject() : d; return { ...x, company_username: x.companyUsername, auto_shortlist: x.autoShortlist ? 1 : 0,
  job_role: x.jobRole, package_offered: x.packageOffered, assessment_date: x.assessmentDate, assessment_time: x.assessmentTime,
  min_cgpa: x.minCgpa, eligible_batch: x.eligibleBatch, max_students_limit: x.maxStudentsLimit }; }
async function getPlacementDrives() { return (await PlacementDrive.find().lean()).map(driveDto); }
async function createPlacementDrive(drive) { return driveDto(await PlacementDrive.findOneAndUpdate({ id: drive.id }, { $set: { ...drive, status: drive.status || "Draft", rounds: drive.rounds || [] } }, { upsert: true, new: true, runValidators: true })); }
async function publishPlacementDrive(driveId) { await PlacementDrive.updateOne({ id: driveId }, { status: "Active" }); }
async function completePlacementDrive(driveId) { await PlacementDrive.updateOne({ id: driveId }, { status: "Completed" }); }
async function savePlacementDriveRounds(driveId, rounds) { await PlacementDrive.updateOne({ id: driveId }, { rounds }); }
async function deleteDrive(id) { await Promise.all([PlacementDrive.deleteOne({ id }), PlacementQuestion.deleteMany({ driveId: id })]); }
async function deleteAllDrives() { await Promise.all([PlacementDrive.deleteMany({}), PlacementQuestion.deleteMany({})]); }
async function getPlacementRegistrations(username) { return (await PlacementRegistration.find({ username }).select("driveId -_id").lean()).map(x => x.driveId); }
async function registerForDrive(username, driveId) { return PlacementRegistration.create({ username, driveId }); }
async function getRegistrationsForDrive(driveId) { return PlacementRegistration.find({ driveId }).lean(); }
async function deleteRegistrationsByUsername(username) { await PlacementRegistration.deleteMany({ username }); }
async function deleteRegistrationsByDriveId(driveId) { await PlacementRegistration.deleteMany({ driveId }); }
async function deleteAllRegistrations() { await PlacementRegistration.deleteMany({}); }
async function getPlacementProgress(username) { return (await PlacementProgress.find({ username })).map(progressDto); }
async function getPlacementCandidates(driveId) { return (await PlacementProgress.find({ driveId })).map(progressDto); }
async function savePlacementProgress(username, driveId, currentRoundIndex, status, scores) { await PlacementProgress.updateOne({ username, driveId }, { username, driveId, currentRoundIndex, status, scores }, { upsert: true }); }
async function publishPlacementProgress(driveId, roundId, nextRoundIndex) { const x = await PlacementProgress.updateMany({ driveId, status: "Pending" }, { status: "Qualified", currentRoundIndex: nextRoundIndex }); return x.modifiedCount; }
async function deletePlacementProgressByUsername(username) { await PlacementProgress.deleteMany({ username }); }
async function deletePlacementProgressByDriveId(driveId) { await PlacementProgress.deleteMany({ driveId }); }
async function deleteAllPlacementProgress() { await PlacementProgress.deleteMany({}); }
async function getPlacementQuestions(driveId, roundId) { return (await PlacementQuestion.find({ driveId, roundId })).map(questionDto); }
async function savePlacementQuestions(driveId, roundId, questions) {
  if (!Array.isArray(questions) || !questions.length || questions.length > 100) throw new Error("Questions must contain 1 to 100 items.");
  const docs = questions.map(q => { if (!q.questionText && !q.title) throw new Error("Every question requires text or a title."); return { ...q, id: generateUUID(), driveId, roundId }; });
  const session = await mongoose.startSession();
  try { await session.withTransaction(async () => { await PlacementQuestion.deleteMany({ driveId, roundId }, { session }); await PlacementQuestion.insertMany(docs, { session }); }); }
  catch (error) {
    // Standalone MongoDB does not support transactions; safely replace only after input validation.
    if (!/Transaction numbers|replica set/i.test(String(error.message))) throw error;
    await PlacementQuestion.deleteMany({ driveId, roundId }); await PlacementQuestion.insertMany(docs);
  } finally { await session.endSession(); }
}

async function hydrateInterview(interview) {
  if (!interview) return null; const x = interview.toObject ? interview.toObject() : interview;
  const [hr, student] = await Promise.all([User.findOne({ id: x.hrId }).lean(), User.findOne({ id: x.studentId }).lean()]);
  return { id: x.id, meetingId: x.meetingId, hrId: x.hrId, studentId: x.studentId, date: x.scheduledDate,
    time: x.scheduledTime, scheduled_time: x.scheduledTime, duration: x.duration, type: x.type, status: x.status,
    meeting_status: x.meetingStatus || x.status, meetingStatus: x.meetingStatus || x.status, hrName: hr?.fullName || "HR Recruiter",
    studentName: student?.fullName || "Candidate", studentEmail: student?.email || "", companyName: hr?.companyName || "",
    invitationStatus: x.invitationStatus || "pending", invitationRespondedAt: x.invitationRespondedAt,
    cgpa: student?.cgpa, department: student?.department, skills: student?.skills || [] };
}
async function createInterview(meetingId, hrId, studentId, scheduledDate, scheduledTime, duration, type, joinToken = null) { return hydrateInterview(await Interview.create({ meetingId, hrId, studentId, scheduledDate, scheduledTime, duration, type, joinToken })); }
async function getInterviewById(id) { return hydrateInterview(await Interview.findOne({ id })); }
async function getInterviewByMeetingId(meetingId) { return hydrateInterview(await Interview.findOne({ meetingId })); }
async function getInterviewsForStudent(studentId) { const xs = await Interview.find({ studentId }).sort({ scheduledDate: -1, scheduledTime: -1 }); return Promise.all(xs.map(hydrateInterview)); }
async function getInterviewsForHR(hrId) { const xs = await Interview.find({ hrId }).sort({ scheduledDate: -1, scheduledTime: -1 }); return Promise.all(xs.map(hydrateInterview)); }
async function updateInterviewStatus(id, status) { return hydrateInterview(await Interview.findOneAndUpdate({ id }, { status, meetingStatus: status }, { new: true, runValidators: true })); }
async function respondToInterviewInvitation(id, invitationStatus) { return hydrateInterview(await Interview.findOneAndUpdate(
  { id }, { invitationStatus, invitationRespondedAt: new Date() }, { new: true, runValidators: true }
)); }
function feedbackDto(f) { if (!f) return null; const x = f.toObject ? f.toObject() : f; return { id: x.id, interview_id: x.interviewId, interviewId: x.interviewId,
  communication_score: x.communicationScore, technical_score: x.technicalScore, confidence_score: x.confidenceScore,
  problem_solving_score: x.problemSolvingScore, overall_rating: x.overallRating, comments: x.comments, result: x.result, submitted_at: x.submittedAt }; }
async function saveInterviewFeedback(interviewId, communicationScore, technicalScore, confidenceScore, problemSolvingScore, overallRating, comments, result) {
  const feedback = await InterviewFeedback.findOneAndUpdate({ interviewId }, { $set: { communicationScore, technicalScore, confidenceScore, problemSolvingScore, overallRating, comments, result, submittedAt: new Date() }, $setOnInsert: { id: generateUUID(), interviewId } }, { upsert: true, new: true, runValidators: true });
  await Interview.updateOne({ id: interviewId }, { status: "completed", meetingStatus: "completed" }); return feedbackDto(feedback);
}
async function getInterviewFeedback(interviewId) { return feedbackDto(await InterviewFeedback.findOne({ interviewId })); }
async function saveInterviewChatMessage(interviewId, senderId, message) { return InterviewChat.create({ interviewId, senderId, message }).then(x => x.toObject()); }
async function getInterviewChatMessages(interviewId) {
  const xs = await InterviewChat.find({ interviewId }).sort({ timestamp: 1 }).lean();
  return Promise.all(xs.map(async x => { const sender = await User.findOne({ id: x.senderId }).lean(); return { ...x, sender_name: sender?.fullName, sender_role: sender?.role }; }));
}
async function saveInterviewHistory(interviewId, studentJoinedAt, hrJoinedAt, endedAt, durationSeconds) { return InterviewHistory.create({ interviewId, studentJoinedAt, hrJoinedAt, endedAt, durationSeconds }).then(x => x.toObject()); }
async function getAllInterviewsForAdmin() { const xs = await Interview.find().sort({ scheduledDate: -1, scheduledTime: -1 }); return Promise.all(xs.map(hydrateInterview)); }
async function getAIInterviewSession(interviewId) { return AIInterviewSession.findOne({ interviewId }).lean(); }
async function startAIInterviewSession(interviewId, studentId, firstQuestion) {
  return AIInterviewSession.findOneAndUpdate({ interviewId }, {
    $setOnInsert: { id: generateUUID(), interviewId, studentId, status: "active", questionCount: 1, currentQuestion: firstQuestion,
      messages: [{ speaker: "ai", text: firstQuestion, createdAt: new Date() }], startedAt: new Date() }
  }, { upsert: true, new: true, runValidators: true }).lean();
}
async function addAIInterviewTurn(interviewId, answer, nextQuestion) {
  const messages = [{ speaker: "candidate", text: answer, createdAt: new Date() }];
  if (nextQuestion) messages.push({ speaker: "ai", text: nextQuestion, createdAt: new Date() });
  return AIInterviewSession.findOneAndUpdate({ interviewId, status: "active" }, {
    $push: { messages: { $each: messages } },
    ...(nextQuestion ? { $set: { currentQuestion: nextQuestion }, $inc: { questionCount: 1 } } : {})
  }, { new: true, runValidators: true }).lean();
}
async function completeAIInterviewSession(interviewId, answer, evaluation) {
  return AIInterviewSession.findOneAndUpdate({ interviewId, status: "active" }, {
    $push: { messages: { speaker: "candidate", text: answer, createdAt: new Date() } },
    $set: { status: "completed", evaluation, completedAt: new Date(), currentQuestion: "" }
  }, { new: true, runValidators: true }).lean();
}

module.exports = { mongoose, initDb, closeDb, getUserByEmail, getUserById, getUserByUsername, createUser, updateUserProfile,
  updateUserStreakAndActive, deleteUser, deleteAllUsers, getAllStudents, getResultsHistory, getAllResults, saveResult,
  deleteResultsByUsername, deleteAllResults, getBookmarks, saveBookmark, deleteBookmarksByUsername, deleteAllBookmarks,
  getNotes, saveNote, deleteNotesByUsername, deleteAllNotes, getRecruitmentSettings, saveRecruitmentSettings,
  getRecruitmentRounds, saveRecruitmentRound, getCandidateStatusByUsername, getAllCandidateStatus, saveCandidateStatus,
  publishCandidateStatus, deleteCandidateStatusByUsername, deleteAllCandidateStatus, getPlacementCompanies, savePlacementCompany,
  deleteCompany, deleteAllCompanies, getPlacementDrives, createPlacementDrive, publishPlacementDrive, completePlacementDrive,
  savePlacementDriveRounds, deleteDrive, deleteAllDrives, getPlacementRegistrations, registerForDrive, getRegistrationsForDrive,
  deleteRegistrationsByUsername, deleteRegistrationsByDriveId, deleteAllRegistrations, getPlacementProgress, getPlacementCandidates,
  savePlacementProgress, publishPlacementProgress, deletePlacementProgressByUsername, deletePlacementProgressByDriveId,
  deleteAllPlacementProgress, getPlacementQuestions, savePlacementQuestions, createInterview, getInterviewById,
  getInterviewByMeetingId, getInterviewsForStudent, getInterviewsForHR, updateInterviewStatus, saveInterviewFeedback,
  respondToInterviewInvitation,
  getInterviewFeedback, saveInterviewChatMessage, getInterviewChatMessages, saveInterviewHistory, getAllInterviewsForAdmin,
  getAIInterviewSession, startAIInterviewSession, addAIInterviewTurn, completeAIInterviewSession };
