import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { approvedScoringStatements, planApprovedScoring } from "../lib/point-scoring.js";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "rock-scoring-"));
delete process.env.DATABASE_URL;
process.env.SQLITE_PATH = path.join(temp, "test.db");
const { getDb, saveSessionAwards } = await import("../lib/db.js");
const db = await getDb();
const read = () => ({
  categories: db.prepare("SELECT * FROM point_categories ORDER BY id").all(),
  actions: db.prepare("SELECT * FROM session_points ORDER BY id").all(),
  ledger: db.prepare("SELECT * FROM point_ledger ORDER BY id").all()
});
try {
  assert.deepEqual(db.prepare("SELECT points FROM point_categories ORDER BY sort_order").all().map(r => r.points), [2, 5, 5, 4, 5, 3, 5, 10]);
  db.exec(`
    INSERT INTO attendees (id, first_name, last_name, status) VALUES (1, 'Active', 'Youth', 'active'), (2, 'Former', 'Youth', 'inactive');
    INSERT INTO sessions (id, title, session_date, deleted_at) VALUES (1, 'Meeting', '2026-09-01', ''), (2, 'Deleted meeting', '2026-09-08', '2026-09-10'), (3, 'New meeting', '2026-09-15', '');
    UPDATE point_categories SET points = 5 WHERE category_key = 'attendance';
    UPDATE point_categories SET points = 3 WHERE category_key = 'bible';
    UPDATE point_categories SET points = 4 WHERE category_key = 'praying';
    INSERT INTO point_categories (category_key, label, points, sort_order) VALUES ('participation', 'Brought a Friend', 10, 8);
    INSERT INTO session_points (id, session_id, attendee_id, category_key, points) VALUES
      (1, 1, 1, 'attendance', 5), (2, 1, 1, 'participation', 4),
      (3, 2, 1, 'participation', 10), (4, 1, 2, 'bible', 3), (5, 1, 1, 'praying', 4);
    INSERT INTO point_ledger (id, attendee_id, entry_type, points, description, source_type, source_id, occurred_on) VALUES
      (1, 1, 'earn', 5, 'Attendance - Meeting', 'session', 1, '2026-09-01'),
      (2, 1, 'earn', 4, 'Participation - Meeting', 'session', 1, '2026-09-01'),
      (3, 1, 'earn', 10, 'Brought a Friend - Deleted meeting', 'session', 2, '2026-09-08'),
      (4, 2, 'earn', 3, 'Brought Bible - Meeting', 'session', 1, '2026-09-01'),
      (5, 1, 'earn', 4, 'Prayed - Meeting', 'session', 1, '2026-09-01'),
      (6, 1, 'earn', 5, 'Attendance - Meeting', 'session', 1, '2026-09-01'),
      (7, 1, 'adjustment', 7, 'Bonus', 'manual', NULL, '2026-09-01'),
      (8, 1, 'reward', -3, 'Already redeemed', 'reward', 1, '2026-09-01');
  `);
  const before = read();
  const bad = structuredClone(before);
  bad.ledger[0].points = 999;
  assert.throws(() => planApprovedScoring(bad), /inconsistent/);
  const plan = planApprovedScoring(before);
  assert.deepEqual(plan.duplicateLedgerIds, [6]);
  db.transaction(() => {
    for (const [query, params] of approvedScoringStatements(plan)) db.prepare(query).run(...params);
  })();
  const after = read();
  assert.deepEqual(approvedScoringStatements(planApprovedScoring(after)), [], "Second migration makes no changes");
  assert.deepEqual(after.actions.map(a => [a.category_key, a.points]), [["attendance", 2], ["participation", 4], ["bring_friend", 10], ["bible", 5], ["praying", 5]]);
  assert.deepEqual(after.actions[1], before.actions[1], "Legacy Participation row preserved exactly");
  assert.deepEqual(after.ledger.filter(l => l.source_type !== "session"), before.ledger.filter(l => l.source_type !== "session"));
  assert.equal(after.categories.find(c => c.category_key === "participation").enabled, 0);

  await saveSessionAwards(1, new Set(["1:attendance", "1:bring_friend"]));
  let saved = read();
  assert.deepEqual(saved.actions.find(a => a.id === 2), before.actions[1], "Archived Participation survives session save");
  assert.deepEqual(saved.actions.find(a => a.id === 4), after.actions.find(a => a.id === 4), "Inactive youth history survives save");
  assert.equal(saved.actions.some(a => a.id === 5), false, "Unchecked active award removed");
  assert.equal(saved.ledger.some(l => l.id === 5), false, "Matching ledger removed with unchecked award");
  assert.equal(saved.actions.find(a => a.session_id === 1 && a.category_key === "bring_friend").points, 10);
  await saveSessionAwards(1, new Set(["1:attendance", "1:bring_friend"]));
  assert.deepEqual(read(), saved, "Repeated save does not duplicate or rewrite awards");
  db.exec("UPDATE point_categories SET points = 9, label = 'Attended' WHERE category_key = 'attendance'");
  await saveSessionAwards(1, new Set(["1:attendance", "1:bring_friend"]));
  assert.equal(read().actions.find(a => a.id === 1).points, 2, "Later rule changes do not silently reprice past awards");
  await saveSessionAwards(3, new Set(["1:attendance", "1:bible"]));
  assert.deepEqual(read().actions.filter(a => a.session_id === 3).map(a => a.points), [9, 5], "New awards use current configured values");
  await saveSessionAwards(1, new Set(["1:bring_friend"]));
  assert.equal(read().ledger.some(l => l.id === 1), false, "Category keys link historical ledger after label changes");

  saved = read();
  db.exec("CREATE TRIGGER fail_ledger BEFORE INSERT ON point_ledger BEGIN SELECT RAISE(ABORT, 'simulated write failure'); END");
  await assert.rejects(saveSessionAwards(3, new Set(["1:attendance", "1:bible", "1:praying"])), /simulated write failure/);
  assert.deepEqual(read(), saved, "Partial award save rolls back both action and ledger");
  assert.equal(await saveSessionAwards(2, new Set()), false, "Deleted session cannot be edited");
  console.log("Point scoring checks passed: retroactive values, preserved Participation/manual/redemptions, friend separation, duplicate repair, idempotency, future values, and atomic session saves.");
} finally {
  db.close();
  fs.rmSync(temp, { recursive: true, force: true });
}
