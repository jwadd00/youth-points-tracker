import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rock-youth-test-"));
delete process.env.DATABASE_URL;
process.env.SQLITE_PATH = path.join(tempDir, "test.db");

try {
  const { all, get, getAttendeeBalances, getDb, getTopAttendeeBalances, insertedId, run } = await import("../lib/db.js");

  const categoryCount = (await all("SELECT COUNT(*) AS count FROM point_categories"))[0].count;
  assert.ok(categoryCount >= 8, "default point categories should be seeded");

  const indexNames = new Set(
    (await all("SELECT name FROM sqlite_master WHERE type = 'index'")).map((row) => row.name)
  );
  assert.ok(indexNames.has("idx_point_ledger_attendee"), "ledger attendee index should exist");
  assert.ok(indexNames.has("idx_session_points_session_attendee"), "session matrix index should exist");
  assert.ok(indexNames.has("idx_sessions_deleted_date_id"), "session soft-delete index should exist");

  const attendeeA = insertedId(await get(`
    INSERT INTO attendees (first_name, last_name, grade, status)
    VALUES ('Ada', 'Young', '7th', 'active')
    RETURNING id
  `));
  const attendeeB = insertedId(await get(`
    INSERT INTO attendees (first_name, last_name, grade, status)
    VALUES ('Ben', 'Stone', '8th', 'active')
    RETURNING id
  `));

  await run(`
    INSERT INTO point_ledger (attendee_id, entry_type, points, description, source_type, occurred_on)
    VALUES (?, 'adjustment', ?, 'Smoke test entry', 'manual', '2026-01-01')
  `, [attendeeA, 15]);
  await run(`
    INSERT INTO point_ledger (attendee_id, entry_type, points, description, source_type, occurred_on)
    VALUES (?, 'adjustment', ?, 'Smoke test entry', 'manual', '2026-01-01')
  `, [attendeeA, -4]);
  await run(`
    INSERT INTO point_ledger (attendee_id, entry_type, points, description, source_type, occurred_on)
    VALUES (?, 'adjustment', ?, 'Smoke test entry', 'manual', '2026-01-01')
  `, [attendeeB, 6]);

  const balances = await getAttendeeBalances();
  const ada = balances.find((row) => row.id === attendeeA);
  assert.equal(ada.balance, 11);
  assert.equal(ada.earned, 15);
  assert.equal(ada.spent, 4);

  const [leader] = await getTopAttendeeBalances(1);
  assert.equal(leader.id, attendeeA);

  const db = await getDb();
  db.close();
  console.log("Smoke tests passed");
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
