const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcryptjs");
const fs = require("fs");

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "hiregrad.db");

// Ensure target database directory exists (useful for Render persistent disk mounts)
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Failed to connect to SQLite database:", err.message);
  } else {
    console.log("Connected to SQLite database successfully. ✅");
  }
});


// Helper function to run query
function dbRun(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

// Helper function to get single row
function dbGet(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Helper function to get all rows
function dbAll(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// UUID generator
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function initDb() {
  // Create tables
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT CHECK(role IN ('student', 'hr', 'admin')) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      target_role TEXT,
      streak INTEGER DEFAULT 0,
      last_active TEXT,
      cgpa REAL,
      department TEXT,
      skills TEXT,
      company_name TEXT
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS results (
      id TEXT PRIMARY KEY,
      username TEXT,
      type TEXT,
      subject TEXT,
      score REAL,
      total INTEGER,
      date TEXT
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      username TEXT,
      question TEXT,
      subject TEXT,
      type TEXT
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      username TEXT,
      title TEXT,
      content TEXT,
      date TEXT
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS recruitment_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS recruitment_rounds (
      id TEXT PRIMARY KEY,
      name TEXT,
      passing_percentage INTEGER,
      min_score REAL,
      negative_marking INTEGER,
      time_limit INTEGER,
      mandatory INTEGER,
      weightage INTEGER,
      type TEXT,
      subject TEXT
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS candidate_status (
      username TEXT,
      round_id TEXT,
      status TEXT,
      score REAL,
      percentage REAL,
      date TEXT,
      PRIMARY KEY (username, round_id)
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS placement_companies (
      username TEXT PRIMARY KEY,
      company_name TEXT
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS placement_drives (
      id TEXT PRIMARY KEY,
      company_username TEXT,
      name TEXT,
      status TEXT,
      auto_shortlist INTEGER,
      job_role TEXT,
      package_offered TEXT,
      assessment_date TEXT,
      assessment_time TEXT,
      duration INTEGER,
      eligible_depts TEXT,
      min_cgpa REAL,
      eligible_batch TEXT,
      max_students_limit INTEGER,
      rounds TEXT
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS placement_questions (
      id TEXT PRIMARY KEY,
      drive_id TEXT,
      round_id TEXT,
      question_text TEXT,
      options TEXT,
      correct_index INTEGER,
      explanation TEXT,
      subject TEXT,
      topic TEXT,
      difficulty TEXT
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS placement_progress (
      username TEXT,
      drive_id TEXT,
      current_round_index INTEGER,
      status TEXT,
      scores TEXT,
      PRIMARY KEY (username, drive_id)
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS placement_registrations (
      username TEXT,
      drive_id TEXT,
      date TEXT,
      PRIMARY KEY (username, drive_id)
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS interviews (
      id TEXT PRIMARY KEY,
      meeting_id TEXT UNIQUE NOT NULL,
      hr_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      scheduled_date TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      duration INTEGER NOT NULL,
      type TEXT NOT NULL,
      status TEXT CHECK(status IN ('scheduled', 'waiting', 'ongoing', 'completed', 'cancelled')) DEFAULT 'scheduled',
      meeting_status TEXT CHECK(meeting_status IN ('scheduled', 'waiting', 'ongoing', 'completed', 'cancelled')) DEFAULT 'scheduled',
      join_token TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hr_id) REFERENCES users(id),
      FOREIGN KEY (student_id) REFERENCES users(id)
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS interview_feedback (
      id TEXT PRIMARY KEY,
      interview_id TEXT UNIQUE NOT NULL,
      communication_score INTEGER CHECK(communication_score >= 1 AND communication_score <= 10),
      technical_score INTEGER CHECK(technical_score >= 1 AND technical_score <= 10),
      confidence_score INTEGER CHECK(confidence_score >= 1 AND confidence_score <= 10),
      problem_solving_score INTEGER CHECK(problem_solving_score >= 1 AND problem_solving_score <= 10),
      overall_rating REAL,
      comments TEXT,
      result TEXT CHECK(result IN ('selected', 'rejected', 'hold')),
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (interview_id) REFERENCES interviews(id)
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS interview_chat (
      id TEXT PRIMARY KEY,
      interview_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (interview_id) REFERENCES interviews(id),
      FOREIGN KEY (sender_id) REFERENCES users(id)
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS interview_history (
      id TEXT PRIMARY KEY,
      interview_id TEXT NOT NULL,
      student_joined_at TEXT,
      hr_joined_at TEXT,
      ended_at TEXT,
      duration_seconds INTEGER,
      FOREIGN KEY (interview_id) REFERENCES interviews(id)
    )
  `);

  // Migrations for interviews table columns
  try {
    await dbRun("ALTER TABLE interviews ADD COLUMN meeting_status TEXT DEFAULT 'scheduled'");
    console.log("Migration: Added meeting_status column to interviews table successfully.");
  } catch (err) {
    // Column already exists or table doesn't exist yet
  }
  try {
    await dbRun("ALTER TABLE interviews ADD COLUMN join_token TEXT");
    console.log("Migration: Added join_token column to interviews table successfully.");
  } catch (err) {
    // Column already exists or table doesn't exist yet
  }

  // Seed default users if users table is empty
  const usersCount = await dbGet("SELECT COUNT(*) as count FROM users");
  if (usersCount.count === 0) {
    console.log("Seeding default users...");
    const defaultUsers = [
      {
        fullName: "System Administrator",
        email: "admin@example.com",
        password: "admin",
        role: "admin",
        targetRole: null,
        streak: 0,
        cgpa: null,
        department: null,
        skills: null,
        companyName: null
      },
      {
        fullName: "Jane Doe",
        email: "student@example.com",
        password: "password",
        role: "student",
        targetRole: "Full Stack Engineer",
        streak: 5,
        cgpa: 8.2,
        department: "CSE",
        skills: JSON.stringify(["JavaScript", "React"]),
        companyName: null
      },
      {
        fullName: "HR Recruiter",
        email: "hr@example.com",
        password: "password",
        role: "hr",
        targetRole: "Talent Acquisition Manager",
        streak: 1,
        cgpa: null,
        department: null,
        skills: null,
        companyName: "HireGrad Hiring Corp"
      },
      {
        fullName: "Alice Smith",
        email: "alice@example.com",
        password: "password",
        role: "student",
        targetRole: "Frontend Developer",
        streak: 4,
        cgpa: 8.5,
        department: "CSE",
        skills: JSON.stringify(["React", "CSS"]),
        companyName: null
      },
      {
        fullName: "Bob Jones",
        email: "bob@example.com",
        password: "password",
        role: "student",
        targetRole: "Java Developer",
        streak: 2,
        cgpa: 6.8,
        department: "ECE",
        skills: JSON.stringify(["Java", "Spring"]),
        companyName: null
      },
      {
        fullName: "Charlie Brown",
        email: "charlie@example.com",
        password: "password",
        role: "student",
        targetRole: "QA Engineer",
        streak: 3,
        cgpa: 7.2,
        department: "IT",
        skills: JSON.stringify(["Testing", "Selenium"]),
        companyName: null
      },
      {
        fullName: "David Miller",
        email: "david@example.com",
        password: "password",
        role: "student",
        targetRole: "DevOps Engineer",
        streak: 0,
        cgpa: 6.0,
        department: "IT",
        skills: JSON.stringify(["Docker", "AWS"]),
        companyName: null
      },
      {
        fullName: "Eva Davis",
        email: "eva@example.com",
        password: "password",
        role: "student",
        targetRole: "Data Scientist",
        streak: 6,
        cgpa: 9.0,
        department: "CSE",
        skills: JSON.stringify(["Python", "Machine Learning"]),
        companyName: null
      }
    ];

    for (const u of defaultUsers) {
      const hashedPassword = bcrypt.hashSync(u.password, 10);
      const userId = generateUUID();
      await dbRun(
        `INSERT INTO users (id, full_name, email, password, role, target_role, streak, last_active, cgpa, department, skills, company_name) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, u.fullName, u.email, hashedPassword, u.role, u.targetRole, u.streak, new Date().toISOString(), u.cgpa, u.department, u.skills, u.companyName]
      );
    }
  }

  // Seed default results if empty
  const resultsCount = await dbGet("SELECT COUNT(*) as count FROM results");
  if (resultsCount.count === 0) {
    console.log("Seeding default results...");
    const defaultResults = [
      { username: "student", type: "MCQ", subject: "Aptitude", score: 8, total: 10, date: new Date(Date.now() - 86400000).toISOString() },
      { username: "student", type: "Technical", subject: "Java", score: 7.5, total: 10, date: new Date(Date.now() - 43200000).toISOString() },
      { username: "alice", type: "MCQ", subject: "Aptitude", score: 8.5, total: 10, date: new Date(Date.now() - 259200000).toISOString() },
      { username: "alice", type: "Technical", subject: "Java", score: 8, total: 10, date: new Date(Date.now() - 172800000).toISOString() },
      { username: "alice", type: "Technical", subject: "Problem Solving", score: 8.5, total: 10, date: new Date(Date.now() - 86400000).toISOString() },
      { username: "alice", type: "HR", subject: "Behavioral", score: 9.0, total: 10, date: new Date(Date.now() - 10000000).toISOString() },
      { username: "bob", type: "MCQ", subject: "Aptitude", score: 8.0, total: 10, date: new Date(Date.now() - 259200000).toISOString() },
      { username: "bob", type: "Technical", subject: "Java", score: 5.5, total: 10, date: new Date(Date.now() - 172800000).toISOString() },
      { username: "charlie", type: "MCQ", subject: "Aptitude", score: 7.8, total: 10, date: new Date(Date.now() - 259200000).toISOString() },
      { username: "charlie", type: "Technical", subject: "Java", score: 7.2, total: 10, date: new Date(Date.now() - 172800000).toISOString() },
      { username: "eva", type: "MCQ", subject: "Aptitude", score: 9.5, total: 10, date: new Date(Date.now() - 259200000).toISOString() },
      { username: "eva", type: "Technical", subject: "Java", score: 8.5, total: 10, date: new Date(Date.now() - 172800000).toISOString() },
      { username: "eva", type: "Technical", subject: "Problem Solving", score: 8.0, total: 10, date: new Date(Date.now() - 86400000).toISOString() },
      { username: "eva", type: "HR", subject: "Behavioral", score: 8.0, total: 10, date: new Date(Date.now() - 10000000).toISOString() }
    ];

    for (const r of defaultResults) {
      await dbRun(
        "INSERT INTO results (id, username, type, subject, score, total, date) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [generateUUID(), r.username, r.type, r.subject, r.score, r.total, r.date]
      );
    }
  }

  // Seed default recruitment rounds if empty
  const roundsCount = await dbGet("SELECT COUNT(*) as count FROM recruitment_rounds");
  if (roundsCount.count === 0) {
    console.log("Seeding default recruitment rounds...");
    const defaultRounds = [
      { id: "round_1", name: "Aptitude Test", passingPercentage: 75, minScore: 7.5, negativeMarking: 0, timeLimit: 30, mandatory: 1, weightage: 25, type: "mcq", subject: "Aptitude" },
      { id: "round_2", name: "Java Assessment", passingPercentage: 70, minScore: 7.0, negativeMarking: 1, timeLimit: 45, mandatory: 1, weightage: 25, type: "coding", subject: "Java" },
      { id: "round_3", name: "Problem Solving", passingPercentage: 80, minScore: 8.0, negativeMarking: 0, timeLimit: 60, mandatory: 1, weightage: 30, type: "coding", subject: "Problem Solving" },
      { id: "round_4", name: "AI HR Interview", passingPercentage: 60, minScore: 6.0, negativeMarking: 0, timeLimit: 15, mandatory: 1, weightage: 20, type: "hr", subject: "Behavioral" }
    ];

    for (const r of defaultRounds) {
      await dbRun(
        `INSERT INTO recruitment_rounds (id, name, passing_percentage, min_score, negative_marking, time_limit, mandatory, weightage, type, subject) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.id, r.name, r.passingPercentage, r.minScore, r.negativeMarking, r.timeLimit, r.mandatory, r.weightage, r.type, r.subject]
      );
    }
  }

  // Seed default candidate status if empty
  const statusCount = await dbGet("SELECT COUNT(*) as count FROM candidate_status");
  if (statusCount.count === 0) {
    console.log("Seeding default candidate status...");
    const defaultStatus = [
      { username: "alice", roundId: "round_1", status: "Qualified", score: 8.5, percentage: 85, date: new Date(Date.now() - 259200000).toISOString() },
      { username: "alice", roundId: "round_2", status: "Qualified", score: 8.0, percentage: 80, date: new Date(Date.now() - 172800000).toISOString() },
      { username: "alice", roundId: "round_3", status: "Qualified", score: 8.5, percentage: 85, date: new Date(Date.now() - 86400000).toISOString() },
      { username: "alice", roundId: "round_4", status: "Qualified", score: 9.0, percentage: 90, date: new Date(Date.now() - 10000000).toISOString() },
      { username: "bob", roundId: "round_1", status: "Qualified", score: 8.0, percentage: 80, date: new Date(Date.now() - 259200000).toISOString() },
      { username: "bob", roundId: "round_2", status: "Not Qualified", score: 5.5, percentage: 55, date: new Date(Date.now() - 172800000).toISOString() },
      { username: "charlie", roundId: "round_1", status: "Qualified", score: 7.8, percentage: 78, date: new Date(Date.now() - 259200000).toISOString() },
      { username: "charlie", roundId: "round_2", status: "Pending", score: 7.2, percentage: 72, date: new Date(Date.now() - 172800000).toISOString() },
      { username: "eva", roundId: "round_1", status: "Qualified", score: 9.5, percentage: 95, date: new Date(Date.now() - 259200000).toISOString() },
      { username: "eva", roundId: "round_2", status: "Qualified", score: 8.5, percentage: 85, date: new Date(Date.now() - 172800000).toISOString() },
      { username: "eva", roundId: "round_3", status: "Qualified", score: 8.0, percentage: 80, date: new Date(Date.now() - 86400000).toISOString() },
      { username: "eva", roundId: "round_4", status: "Qualified", score: 8.0, percentage: 80, date: new Date(Date.now() - 10000000).toISOString() },
      { username: "student", roundId: "round_1", status: "Qualified", score: 8.0, percentage: 80, date: new Date(Date.now() - 86400000).toISOString() },
      { username: "student", roundId: "round_2", status: "Qualified", score: 7.5, percentage: 75, date: new Date(Date.now() - 43200000).toISOString() }
    ];

    for (const s of defaultStatus) {
      await dbRun(
        "INSERT INTO candidate_status (username, round_id, status, score, percentage, date) VALUES (?, ?, ?, ?, ?, ?)",
        [s.username, s.roundId, s.status, s.score, s.percentage, s.date]
      );
    }
  }

  // Seed default recruitment settings if empty
  const settingsCount = await dbGet("SELECT COUNT(*) as count FROM recruitment_settings");
  if (settingsCount.count === 0) {
    console.log("Seeding default recruitment settings...");
    await dbRun("INSERT INTO recruitment_settings (key, value) VALUES ('autoShortlist', 'false')");
  }

  // Seed default placement companies if empty
  const companiesCount = await dbGet("SELECT COUNT(*) as count FROM placement_companies");
  if (companiesCount.count === 0) {
    console.log("Seeding default placement companies...");
    await dbRun("INSERT INTO placement_companies (username, company_name) VALUES ('tata_hr', 'Tata Consultancy Services')");
  }

  // Seed default placement drives if empty
  const drivesCount = await dbGet("SELECT COUNT(*) as count FROM placement_drives");
  if (drivesCount.count === 0) {
    console.log("Seeding default placement drives...");
    const defaultDrives = [
      {
        id: "drive_1",
        companyUsername: "tata_hr",
        name: "TCS Ninja Hiring 2026",
        status: "Active",
        autoShortlist: 0,
        jobRole: "Software Engineer",
        packageOffered: "7.5 LPA",
        assessmentDate: "2026-08-01",
        assessmentTime: "10:00",
        duration: 90,
        eligibleDepts: JSON.stringify(["CSE", "ECE", "IT"]),
        minCgpa: 7.0,
        eligibleBatch: "2026",
        maxStudentsLimit: 100,
        rounds: JSON.stringify([
          { id: "r_1", name: "Aptitude Assessment", type: "mcq", passingPercentage: 75, minScore: 7.5, timeLimit: 30, weightage: 30, subject: "Aptitude" },
          { id: "r_2", name: "Programming Test", type: "coding", passingPercentage: 70, minScore: 7.0, timeLimit: 45, weightage: 40, subject: "JavaScript" },
          { id: "r_3", name: "AI HR Round", type: "hr", passingPercentage: 60, minScore: 6.0, timeLimit: 15, weightage: 30, subject: "Behavioral" }
        ])
      }
    ];

    for (const d of defaultDrives) {
      await dbRun(
        `INSERT INTO placement_drives (id, company_username, name, status, auto_shortlist, job_role, package_offered, 
         assessment_date, assessment_time, duration, eligible_depts, min_cgpa, eligible_batch, max_students_limit, rounds) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [d.id, d.companyUsername, d.name, d.status, d.autoShortlist, d.jobRole, d.packageOffered,
         d.assessmentDate, d.assessmentTime, d.duration, d.eligibleDepts, d.minCgpa, d.eligibleBatch, d.maxStudentsLimit, d.rounds]
      );
    }
  }

  // Seed default placement progress if empty
  const progressCount = await dbGet("SELECT COUNT(*) as count FROM placement_progress");
  if (progressCount.count === 0) {
    console.log("Seeding default placement progress...");
    const defaultProgress = [
      { username: "alice", driveId: "drive_1", currentRoundIndex: 2, status: "Qualified", scores: JSON.stringify({ "r_1": 8.0, "r_2": 7.5 }) },
      { username: "bob", driveId: "drive_1", currentRoundIndex: 1, status: "Disqualified", scores: JSON.stringify({ "r_1": 7.8, "r_2": 5.0 }) },
      { username: "charlie", driveId: "drive_1", currentRoundIndex: 1, status: "Pending", scores: JSON.stringify({ "r_1": 8.5, "r_2": 7.2 }) }
    ];

    for (const p of defaultProgress) {
      await dbRun(
        "INSERT INTO placement_progress (username, drive_id, current_round_index, status, scores) VALUES (?, ?, ?, ?, ?)",
        [p.username, p.driveId, p.currentRoundIndex, p.status, p.scores]
      );
    }
  }

  // Seed default placement registrations if empty
  const registrationsCount = await dbGet("SELECT COUNT(*) as count FROM placement_registrations");
  if (registrationsCount.count === 0) {
    console.log("Seeding default placement registrations...");
    await dbRun(
      "INSERT INTO placement_registrations (username, drive_id, date) VALUES (?, ?, ?)",
      ["student", "drive_1", new Date().toISOString()]
    );
  }

  // Seed default bookmarks if empty
  const bookmarksCount = await dbGet("SELECT COUNT(*) as count FROM bookmarks");
  if (bookmarksCount.count === 0) {
    await dbRun(
      "INSERT INTO bookmarks (id, username, question, subject, type) VALUES (?, ?, ?, ?, ?)",
      [generateUUID(), "student", "What is closure in JS?", "JavaScript", "MCQ"]
    );
  }

  // Seed default notes if empty
  const notesCount = await dbGet("SELECT COUNT(*) as count FROM notes");
  if (notesCount.count === 0) {
    await dbRun(
      "INSERT INTO notes (id, username, title, content, date) VALUES (?, ?, ?, ?, ?)",
      [generateUUID(), "student", "Java OOP Notes", "Remember to explain encapsulation vs abstraction clearly with code examples.", new Date().toISOString()]
    );
  }
}

// DATABASE OPERATIONS EXPORTS

// Users & Auth
async function getUserByEmail(email) {
  return await dbGet("SELECT * FROM users WHERE email = ?", [email]);
}

async function getUserById(id) {
  return await dbGet("SELECT * FROM users WHERE id = ?", [id]);
}

async function getUserByUsername(username) {
  // Try matching directly in email or match username part before @
  return await dbGet("SELECT * FROM users WHERE email = ? OR email LIKE ?", [username, `${username}@%`]);
}

async function createUser(fullName, email, hashedPassword, role, companyName = null) {
  const id = generateUUID();
  await dbRun(
    `INSERT INTO users (id, full_name, email, password, role, target_role, streak, last_active, cgpa, department, skills, company_name) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, fullName, email, hashedPassword, role, role === 'student' ? 'Software Engineer' : null, 1, new Date().toISOString(), role === 'student' ? 8.0 : null, role === 'student' ? 'CSE' : null, role === 'student' ? '[]' : null, companyName]
  );
  return await getUserById(id);
}

async function updateUserProfile(username, cgpa, department, skills) {
  await dbRun(
    "UPDATE users SET cgpa = ?, department = ?, skills = ? WHERE email = ? OR email LIKE ?",
    [cgpa, department, JSON.stringify(skills), username, `${username}@%`]
  );
}

async function updateUserStreakAndActive(username, streak, lastActive) {
  await dbRun(
    "UPDATE users SET streak = ?, last_active = ? WHERE email = ? OR email LIKE ?",
    [streak, lastActive, username, `${username}@%`]
  );
}

async function deleteUser(username) {
  await dbRun("DELETE FROM users WHERE email = ? OR email LIKE ?", [username, `${username}@%`]);
}

async function deleteAllUsers() {
  await dbRun("DELETE FROM users WHERE role != 'admin'");
}

async function getAllStudents() {
  const students = await dbAll("SELECT * FROM users WHERE role = 'student'");
  return students.map(s => {
    try {
      s.skills = JSON.parse(s.skills || '[]');
    } catch (e) {
      s.skills = [];
    }
    s.username = s.email.split("@")[0];
    return s;
  });
}

// Results
async function getResultsHistory(username) {
  return await dbAll("SELECT * FROM results WHERE username = ?", [username]);
}

async function getAllResults() {
  return await dbAll("SELECT * FROM results");
}

async function saveResult(username, type, subject, score, total) {
  const id = generateUUID();
  const date = new Date().toISOString();
  await dbRun(
    "INSERT INTO results (id, username, type, subject, score, total, date) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, username, type, subject, score, total, date]
  );
  return { id, username, type, subject, score, total, date };
}

async function deleteResultsByUsername(username) {
  await dbRun("DELETE FROM results WHERE username = ?", [username]);
}

async function deleteAllResults() {
  await dbRun("DELETE FROM results");
}

// Bookmarks
async function getBookmarks(username) {
  return await dbAll("SELECT * FROM bookmarks WHERE username = ?", [username]);
}

async function saveBookmark(username, question, subject, type) {
  const id = generateUUID();
  await dbRun(
    "INSERT INTO bookmarks (id, username, question, subject, type) VALUES (?, ?, ?, ?, ?)",
    [id, username, question, subject, type]
  );
  return { id, username, question, subject, type };
}

async function deleteBookmarksByUsername(username) {
  await dbRun("DELETE FROM bookmarks WHERE username = ?", [username]);
}

async function deleteAllBookmarks() {
  await dbRun("DELETE FROM bookmarks");
}

// Notes
async function getNotes(username) {
  return await dbAll("SELECT * FROM notes WHERE username = ?", [username]);
}

async function saveNote(username, title, content) {
  const id = generateUUID();
  const date = new Date().toISOString();
  await dbRun(
    "INSERT INTO notes (id, username, title, content, date) VALUES (?, ?, ?, ?, ?)",
    [id, username, title, content, date]
  );
  return { id, username, title, content, date };
}

async function deleteNotesByUsername(username) {
  await dbRun("DELETE FROM notes WHERE username = ?", [username]);
}

async function deleteAllNotes() {
  await dbRun("DELETE FROM notes");
}

// Recruitment settings
async function getRecruitmentSettings() {
  const row = await dbGet("SELECT value FROM recruitment_settings WHERE key = 'autoShortlist'");
  return { autoShortlist: row ? row.value === 'true' : false };
}

async function saveRecruitmentSettings(autoShortlist) {
  await dbRun(
    "INSERT INTO recruitment_settings (key, value) VALUES ('autoShortlist', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [autoShortlist ? 'true' : 'false']
  );
}

// Recruitment rounds
async function getRecruitmentRounds() {
  return await dbAll("SELECT * FROM recruitment_rounds");
}

async function saveRecruitmentRound(round) {
  const { id, name, passingPercentage, minScore, negativeMarking, timeLimit, mandatory, weightage, type, subject } = round;
  
  if (id) {
    // Check if exists
    const existing = await dbGet("SELECT id FROM recruitment_rounds WHERE id = ?", [id]);
    if (existing) {
      await dbRun(
        `UPDATE recruitment_rounds SET name = ?, passing_percentage = ?, min_score = ?, negative_marking = ?, 
         time_limit = ?, mandatory = ?, weightage = ?, type = ?, subject = ? WHERE id = ?`,
        [name, passingPercentage, minScore, negativeMarking ? 1 : 0, timeLimit, mandatory ? 1 : 0, weightage, type, subject, id]
      );
      return await dbGet("SELECT * FROM recruitment_rounds WHERE id = ?", [id]);
    }
  }

  const newId = id || "round_" + (Date.now());
  await dbRun(
    `INSERT INTO recruitment_rounds (id, name, passing_percentage, min_score, negative_marking, time_limit, mandatory, weightage, type, subject) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [newId, name, passingPercentage, minScore, negativeMarking ? 1 : 0, timeLimit, mandatory ? 1 : 0, weightage, type, subject]
  );
  return await dbGet("SELECT * FROM recruitment_rounds WHERE id = ?", [newId]);
}

// Candidate Round status
async function getCandidateStatusByUsername(username) {
  return await dbAll("SELECT * FROM candidate_status WHERE username = ?", [username]);
}

async function getAllCandidateStatus() {
  return await dbAll("SELECT * FROM candidate_status");
}

async function saveCandidateStatus(username, roundId, status, score, percentage) {
  const date = new Date().toISOString();
  await dbRun(
    `INSERT INTO candidate_status (username, round_id, status, score, percentage, date) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(username, round_id) DO UPDATE SET status = excluded.status, score = excluded.score, percentage = excluded.percentage, date = excluded.date`,
    [username, roundId, status, score, percentage, date]
  );
}

async function publishCandidateStatus(roundId) {
  await dbRun("UPDATE candidate_status SET status = 'Qualified' WHERE round_id = ? AND status = 'Pending'", [roundId]);
}

async function deleteCandidateStatusByUsername(username) {
  await dbRun("DELETE FROM candidate_status WHERE username = ?", [username]);
}

async function deleteAllCandidateStatus() {
  await dbRun("DELETE FROM candidate_status");
}

// Placement companies
async function getPlacementCompanies() {
  // Return companies seeded/stored
  return await dbAll("SELECT * FROM placement_companies");
}

async function savePlacementCompany(username, companyName) {
  await dbRun(
    "INSERT INTO placement_companies (username, company_name) VALUES (?, ?) ON CONFLICT(username) DO UPDATE SET company_name = excluded.company_name",
    [username, companyName]
  );
}

async function deleteCompany(username) {
  await dbRun("DELETE FROM placement_companies WHERE username = ?", [username]);
}

async function deleteAllCompanies() {
  await dbRun("DELETE FROM placement_companies");
}

// Placement drives
async function getPlacementDrives() {
  const drives = await dbAll("SELECT * FROM placement_drives");
  return drives.map(d => {
    try {
      d.rounds = JSON.parse(d.rounds || '[]');
      d.eligibleDepts = JSON.parse(d.eligibleDepts || '[]');
    } catch (e) {
      d.rounds = [];
      d.eligibleDepts = [];
    }
    d.autoShortlist = d.auto_shortlist === 1;
    return d;
  });
}

async function createPlacementDrive(drive) {
  const { 
    id, name, companyUsername, autoShortlist, jobRole, packageOffered, 
    assessmentDate, assessmentTime, duration, eligibleDepts, 
    minCgpa, eligibleBatch, maxStudentsLimit, rounds, status 
  } = drive;

  const existing = await dbGet("SELECT id FROM placement_drives WHERE id = ?", [id]);
  if (existing) {
    await dbRun(
      `UPDATE placement_drives SET name = ?, company_username = ?, auto_shortlist = ?, job_role = ?, package_offered = ?, 
       assessment_date = ?, assessment_time = ?, duration = ?, eligible_depts = ?, min_cgpa = ?, eligible_batch = ?, 
       max_students_limit = ? WHERE id = ?`,
      [name, companyUsername, autoShortlist ? 1 : 0, jobRole, packageOffered,
       assessmentDate, assessmentTime, duration, JSON.stringify(eligibleDepts || []), minCgpa, eligibleBatch, maxStudentsLimit, id]
    );
    const updatedDrive = await dbGet("SELECT * FROM placement_drives WHERE id = ?", [id]);
    try {
      updatedDrive.rounds = JSON.parse(updatedDrive.rounds || '[]');
      updatedDrive.eligibleDepts = JSON.parse(updatedDrive.eligibleDepts || '[]');
    } catch(e) {
      updatedDrive.rounds = [];
      updatedDrive.eligibleDepts = [];
    }
    updatedDrive.autoShortlist = updatedDrive.auto_shortlist === 1;
    return updatedDrive;
  } else {
    await dbRun(
      `INSERT INTO placement_drives (id, company_username, name, status, auto_shortlist, job_role, package_offered, 
       assessment_date, assessment_time, duration, eligible_depts, min_cgpa, eligible_batch, max_students_limit, rounds) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, companyUsername, name, status || "Draft", autoShortlist ? 1 : 0, jobRole, packageOffered,
       assessmentDate, assessmentTime, duration, JSON.stringify(eligibleDepts || []), minCgpa, eligibleBatch, maxStudentsLimit, JSON.stringify(rounds || [])]
    );
    return drive;
  }
}

async function publishPlacementDrive(driveId) {
  await dbRun("UPDATE placement_drives SET status = 'Active' WHERE id = ?", [driveId]);
}

async function savePlacementDriveRounds(driveId, rounds) {
  await dbRun("UPDATE placement_drives SET rounds = ? WHERE id = ?", [JSON.stringify(rounds), driveId]);
}

async function deleteDrive(id) {
  await dbRun("DELETE FROM placement_drives WHERE id = ?", [id]);
}

async function deleteAllDrives() {
  await dbRun("DELETE FROM placement_drives");
}

// Placement registrations
async function getPlacementRegistrations(username) {
  const regs = await dbAll("SELECT drive_id FROM placement_registrations WHERE username = ?", [username]);
  return regs.map(r => r.drive_id);
}

async function registerForDrive(username, driveId) {
  await dbRun(
    "INSERT INTO placement_registrations (username, drive_id, date) VALUES (?, ?, ?)",
    [username, driveId, new Date().toISOString()]
  );
}

async function getRegistrationsForDrive(driveId) {
  return await dbAll("SELECT * FROM placement_registrations WHERE drive_id = ?", [driveId]);
}

async function deleteRegistrationsByUsername(username) {
  await dbRun("DELETE FROM placement_registrations WHERE username = ?", [username]);
}

async function deleteRegistrationsByDriveId(driveId) {
  await dbRun("DELETE FROM placement_registrations WHERE drive_id = ?", [driveId]);
}

async function deleteAllRegistrations() {
  await dbRun("DELETE FROM placement_registrations");
}

// Placement progress
async function getPlacementProgress(username) {
  const list = await dbAll("SELECT * FROM placement_progress WHERE username = ?", [username]);
  return list.map(p => {
    try {
      p.scores = JSON.parse(p.scores || '{}');
    } catch (e) {
      p.scores = {};
    }
    return p;
  });
}

async function getPlacementCandidates(driveId) {
  const list = await dbAll("SELECT * FROM placement_progress WHERE drive_id = ?", [driveId]);
  return list.map(p => {
    try {
      p.scores = JSON.parse(p.scores || '{}');
    } catch (e) {
      p.scores = {};
    }
    return p;
  });
}

async function savePlacementProgress(username, driveId, currentRoundIndex, status, scores) {
  await dbRun(
    `INSERT INTO placement_progress (username, drive_id, current_round_index, status, scores) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(username, drive_id) DO UPDATE SET current_round_index = excluded.current_round_index, status = excluded.status, scores = excluded.scores`,
    [username, driveId, currentRoundIndex, status, JSON.stringify(scores || {})]
  );
}

async function publishPlacementProgress(driveId, roundId, nextRoundIndex) {
  const list = await dbAll("SELECT * FROM placement_progress WHERE drive_id = ? AND status = 'Pending'", [driveId]);
  let count = 0;
  for (const progress of list) {
    await dbRun(
      "UPDATE placement_progress SET status = 'Qualified', current_round_index = ? WHERE username = ? AND drive_id = ?",
      [nextRoundIndex, progress.username, driveId]
    );
    count++;
  }
  return count;
}

async function deletePlacementProgressByUsername(username) {
  await dbRun("DELETE FROM placement_progress WHERE username = ?", [username]);
}

async function deletePlacementProgressByDriveId(driveId) {
  await dbRun("DELETE FROM placement_progress WHERE drive_id = ?", [driveId]);
}

async function deleteAllPlacementProgress() {
  await dbRun("DELETE FROM placement_progress");
}

// Placement questions
async function getPlacementQuestions(driveId, roundId) {
  const list = await dbAll("SELECT * FROM placement_questions WHERE drive_id = ? AND round_id = ?", [driveId, roundId]);
  return list.map(q => {
    try {
      q.options = JSON.parse(q.options || '[]');
    } catch (e) {
      q.options = [];
    }
    return q;
  });
}

async function savePlacementQuestions(driveId, roundId, questions) {
  // Clear old questions for this round
  await dbRun("DELETE FROM placement_questions WHERE drive_id = ? AND round_id = ?", [driveId, roundId]);
  
  for (const q of questions) {
    const id = "pq_" + Date.now() + Math.random().toString(36).substring(7);
    await dbRun(
      `INSERT INTO placement_questions (id, drive_id, round_id, question_text, options, correct_index, explanation, subject, topic, difficulty) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, driveId, roundId, q.questionText, JSON.stringify(q.options || []), q.correctIndex !== undefined ? parseInt(q.correctIndex) : 0, q.explanation || "", q.subject || "General", q.topic || "Core", q.difficulty || "Medium"]
    );
  }
}

// Live HR Interview Operations
async function createInterview(meetingId, hrId, studentId, scheduledDate, scheduledTime, duration, type, joinToken = null) {
  const id = generateUUID();
  await dbRun(
    `INSERT INTO interviews (id, meeting_id, hr_id, student_id, scheduled_date, scheduled_time, duration, type, status, meeting_status, join_token) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', 'scheduled', ?)`,
    [id, meetingId, hrId, studentId, scheduledDate, scheduledTime, duration, type, joinToken]
  );
  return await getInterviewById(id);
}

function formatInterview(row) {
  if (!row) return null;
  return {
    id: row.id,
    meetingId: row.meeting_id,
    hrId: row.hr_id,
    studentId: row.student_id,
    date: row.scheduled_date,
    time: row.scheduled_time,
    scheduled_time: row.scheduled_time,
    duration: row.duration,
    type: row.type,
    status: row.status,
    meeting_status: row.meeting_status || row.status,
    meetingStatus: row.meeting_status || row.status,
    join_token: row.join_token || null,
    hrName: row.hr_name || "HR Recruiter",
    studentName: row.student_name || "Candidate",
    studentEmail: row.student_email || "",
    companyName: row.company_name || ""
  };
}

async function getInterviewById(id) {
  const row = await dbGet(
    `SELECT i.*, 
            hr.full_name as hr_name, hr.company_name,
            std.full_name as student_name, std.email as student_email 
     FROM interviews i
     LEFT JOIN users hr ON i.hr_id = hr.id
     LEFT JOIN users std ON i.student_id = std.id
     WHERE i.id = ?`,
    [id]
  );
  return formatInterview(row);
}

async function getInterviewByMeetingId(meetingId) {
  const row = await dbGet(
    `SELECT i.*, 
            hr.full_name as hr_name, hr.company_name,
            std.full_name as student_name, std.email as student_email 
     FROM interviews i
     LEFT JOIN users hr ON i.hr_id = hr.id
     LEFT JOIN users std ON i.student_id = std.id
     WHERE i.meeting_id = ?`,
    [meetingId]
  );
  return formatInterview(row);
}

async function getInterviewsForStudent(studentId) {
  const rows = await dbAll(
    `SELECT i.*, u.full_name as hr_name, u.company_name 
     FROM interviews i 
     JOIN users u ON i.hr_id = u.id 
     WHERE i.student_id = ? 
     ORDER BY i.scheduled_date DESC, i.scheduled_time DESC`,
    [studentId]
  );
  return rows.map(formatInterview);
}

async function getInterviewsForHR(hrId) {
  const rows = await dbAll(
    `SELECT i.*, u.full_name as student_name, u.email as student_email, u.cgpa, u.department, u.skills 
     FROM interviews i 
     JOIN users u ON i.student_id = u.id 
     WHERE i.hr_id = ? 
     ORDER BY i.scheduled_date DESC, i.scheduled_time DESC`,
    [hrId]
  );
  return rows.map(formatInterview);
}

async function updateInterviewStatus(id, status) {
  await dbRun("UPDATE interviews SET status = ?, meeting_status = ? WHERE id = ?", [status, status, id]);
  return await getInterviewById(id);
}

async function saveInterviewFeedback(interviewId, communicationScore, technicalScore, confidenceScore, problemSolvingScore, overallRating, comments, result) {
  const existing = await getInterviewFeedback(interviewId);
  if (existing) {
    await dbRun(
      `UPDATE interview_feedback SET 
        communication_score = ?, 
        technical_score = ?, 
        confidence_score = ?, 
        problem_solving_score = ?, 
        overall_rating = ?, 
        comments = ?, 
        result = ?, 
        submitted_at = CURRENT_TIMESTAMP 
       WHERE interview_id = ?`,
      [communicationScore, technicalScore, confidenceScore, problemSolvingScore, overallRating, comments, result, interviewId]
    );
  } else {
    const id = generateUUID();
    await dbRun(
      `INSERT INTO interview_feedback (id, interview_id, communication_score, technical_score, confidence_score, problem_solving_score, overall_rating, comments, result) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, interviewId, communicationScore, technicalScore, confidenceScore, problemSolvingScore, overallRating, comments, result]
    );
  }
  // Also update parent interview status to 'completed'
  await dbRun("UPDATE interviews SET status = 'completed' WHERE id = ?", [interviewId]);
  return await getInterviewFeedback(interviewId);
}

async function getInterviewFeedback(interviewId) {
  return await dbGet("SELECT * FROM interview_feedback WHERE interview_id = ?", [interviewId]);
}

async function saveInterviewChatMessage(interviewId, senderId, message) {
  const id = generateUUID();
  await dbRun(
    "INSERT INTO interview_chat (id, interview_id, sender_id, message) VALUES (?, ?, ?, ?)",
    [id, interviewId, senderId, message]
  );
  return { id, interviewId, senderId, message, timestamp: new Date().toISOString() };
}

async function getInterviewChatMessages(interviewId) {
  return await dbAll(
    `SELECT c.*, u.full_name as sender_name, u.role as sender_role 
     FROM interview_chat c 
     JOIN users u ON c.sender_id = u.id 
     WHERE c.interview_id = ? 
     ORDER BY c.timestamp ASC`,
    [interviewId]
  );
}

async function saveInterviewHistory(interviewId, studentJoinedAt, hrJoinedAt, endedAt, durationSeconds) {
  const id = generateUUID();
  await dbRun(
    `INSERT INTO interview_history (id, interview_id, student_joined_at, hr_joined_at, ended_at, duration_seconds) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, interviewId, studentJoinedAt, hrJoinedAt, endedAt, durationSeconds]
  );
  return { id, interviewId, studentJoinedAt, hrJoinedAt, endedAt, durationSeconds };
}

async function getAllInterviewsForAdmin() {
  const rows = await dbAll(
    `SELECT i.*, 
            hr.full_name as hr_name, hr.company_name,
            std.full_name as student_name, std.email as student_email 
     FROM interviews i
     JOIN users hr ON i.hr_id = hr.id
     JOIN users std ON i.student_id = std.id
     ORDER BY i.scheduled_date DESC, i.scheduled_time DESC`
  );
  return rows.map(formatInterview);
}

module.exports = {
  db,
  initDb,
  
  // Auth
  getUserByEmail,
  getUserById,
  getUserByUsername,
  createUser,
  updateUserProfile,
  updateUserStreakAndActive,
  deleteUser,
  deleteAllUsers,
  getAllStudents,

  // Results
  getResultsHistory,
  getAllResults,
  saveResult,
  deleteResultsByUsername,
  deleteAllResults,

  // Bookmarks
  getBookmarks,
  saveBookmark,
  deleteBookmarksByUsername,
  deleteAllBookmarks,

  // Notes
  getNotes,
  saveNote,
  deleteNotesByUsername,
  deleteAllNotes,

  // Settings
  getRecruitmentSettings,
  saveRecruitmentSettings,

  // Recruitment Rounds & Candidate status
  getRecruitmentRounds,
  saveRecruitmentRound,
  getCandidateStatusByUsername,
  getAllCandidateStatus,
  saveCandidateStatus,
  publishCandidateStatus,
  deleteCandidateStatusByUsername,
  deleteAllCandidateStatus,

  // Placement
  getPlacementCompanies,
  savePlacementCompany,
  deleteCompany,
  deleteAllCompanies,
  
  getPlacementDrives,
  createPlacementDrive,
  publishPlacementDrive,
  savePlacementDriveRounds,
  deleteDrive,
  deleteAllDrives,
  
  getPlacementRegistrations,
  registerForDrive,
  getRegistrationsForDrive,
  deleteRegistrationsByUsername,
  deleteRegistrationsByDriveId,
  deleteAllRegistrations,
  
  getPlacementProgress,
  getPlacementCandidates,
  savePlacementProgress,
  publishPlacementProgress,
  deletePlacementProgressByUsername,
  deletePlacementProgressByDriveId,
  deleteAllPlacementProgress,
  
  getPlacementQuestions,
  savePlacementQuestions,

  // Live Interviews
  createInterview,
  getInterviewById,
  getInterviewByMeetingId,
  getInterviewsForStudent,
  getInterviewsForHR,
  updateInterviewStatus,
  saveInterviewFeedback,
  getInterviewFeedback,
  saveInterviewChatMessage,
  getInterviewChatMessages,
  saveInterviewHistory,
  getAllInterviewsForAdmin
};
