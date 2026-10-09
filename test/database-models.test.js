const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");

test("MongoDB data layer registers all required models", () => {
  const expected = [
    "User", "Result", "Bookmark", "Note", "RecruitmentSetting", "RecruitmentRound",
    "CandidateStatus", "PlacementCompany", "PlacementDrive", "PlacementQuestion",
    "PlacementProgress", "PlacementRegistration", "Interview", "InterviewFeedback",
    "InterviewChat", "InterviewHistory", "AIInterviewSession"
  ];
  assert.deepEqual(Object.keys(db.mongoose.models).sort(), expected.sort());
});

test("sensitive user password is excluded from normal queries", () => {
  const passwordPath = db.mongoose.model("User").schema.path("password");
  assert.equal(passwordPath.options.select, false);
});

test("critical compound indexes are declared", () => {
  const registrationIndexes = db.mongoose.model("PlacementRegistration").schema.indexes();
  const progressIndexes = db.mongoose.model("PlacementProgress").schema.indexes();
  assert.ok(registrationIndexes.some(([keys, options]) => keys.username === 1 && keys.driveId === 1 && options.unique));
  assert.ok(progressIndexes.some(([keys, options]) => keys.username === 1 && keys.driveId === 1 && options.unique));
});
