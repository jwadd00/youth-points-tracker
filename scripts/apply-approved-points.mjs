import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { approvedScoringStatements, planApprovedScoring } from "../lib/point-scoring.js";

const apply = process.argv.includes("--apply");
if (!process.env.DATABASE_URL) throw new Error("Load DATABASE_URL using --env-file=.env.local");
const output = path.resolve("out/approved-points", `${new Date().toISOString().replace(/[:.]/g, "-")}-${apply ? "applied" : "preview"}`);
fs.mkdirSync(output, { recursive: true });
const write = (name, value) => fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2));
const sql = postgres(process.env.DATABASE_URL, {
  // The transaction adds a ledger column between its before/after SELECTs.
  prepare: false, max: 1, connect_timeout: 15, ssl: process.env.PGSSL === "disable" ? false : "require", onnotice: () => {}
});

async function snapshot(tx) {
  const data = {
    categories: await tx`SELECT * FROM point_categories ORDER BY id`,
    actions: await tx`SELECT * FROM session_points ORDER BY id`,
    ledger: await tx`SELECT * FROM point_ledger ORDER BY id`,
    sessions: await tx`SELECT * FROM sessions ORDER BY id`,
    attendees: await tx`SELECT id, first_name, last_name, status FROM attendees ORDER BY id`,
    rewards: await tx`SELECT * FROM rewards ORDER BY id`,
    redemptions: await tx`SELECT * FROM reward_redemptions ORDER BY id`
  };
  return JSON.parse(JSON.stringify(data));
}

function balances(data) {
  const activeSessions = new Set(data.sessions.filter(s => !s.deleted_at).map(s => s.id));
  return new Map(data.attendees.map(a => [a.id, data.ledger.filter(l => l.attendee_id === a.id
    && (l.source_type !== "session" || activeSessions.has(l.source_id))).reduce((sum, l) => sum + Number(l.points), 0)]));
}

function previewAfter(before, plan) {
  const after = structuredClone(before);
  after.actions = after.actions.map(a => ({ ...a, ...plan.actionUpdates.find(u => u.id === a.id) }));
  after.ledger = after.ledger.filter(l => !plan.duplicateLedgerIds.includes(l.id))
    .map(l => ({ ...l, ...plan.ledgerUpdates.find(u => u.id === l.id) }));
  return after;
}

try {
  const result = await sql.begin(apply ? "" : "isolation level repeatable read read only", async tx => {
    await tx`SET LOCAL statement_timeout = '30000'`;
    await tx`SET LOCAL lock_timeout = '10000'`;
    if (apply) {
      await tx`LOCK TABLE point_categories, sessions, session_points, point_ledger, attendees, rewards, reward_redemptions IN SHARE ROW EXCLUSIVE MODE`;
    }
    const before = await snapshot(tx);
    const plan = planApprovedScoring(before);
    // Persist original rows before the first write; audit files never enter public/.
    write("before.json", before);
    write("plan.json", plan);
    let after = previewAfter(before, plan);
    if (apply) {
      await tx`ALTER TABLE point_ledger ADD COLUMN IF NOT EXISTS category_key TEXT NOT NULL DEFAULT ''`;
      for (const [query, params] of approvedScoringStatements(plan)) {
        let parameter = 0;
        await tx.unsafe(query.replace(/\?/g, () => `$${++parameter}`), params);
      }
      after = await snapshot(tx);
      assert.deepEqual(approvedScoringStatements(planApprovedScoring(after)), [], "Migration must be idempotent");
      for (const property of ["sessions", "attendees", "rewards", "redemptions"]) assert.deepEqual(after[property], before[property]);
      // Older snapshots may precede the new ledger category column.
      const nonSession = data => data.ledger.filter(l => l.source_type !== "session").map(l => ({ ...l, category_key: l.category_key || "" }));
      assert.deepEqual(nonSession(after), nonSession(before), "Manual entries and redemptions must be unchanged");
      const legacyBefore = before.actions.filter(a => a.category_key === "participation"
        && before.ledger.some(l => l.attendee_id === a.attendee_id && l.source_id === a.session_id
          && l.source_type === "session" && l.description.startsWith("Participation - ")));
      for (const legacy of legacyBefore) assert.deepEqual(after.actions.find(a => a.id === legacy.id), legacy);
      assert.deepEqual(after.actions, previewAfter(before, plan).actions);
      assert.deepEqual(after.ledger, previewAfter(before, plan).ledger.map(l => ({ ...l, category_key: l.category_key || "" })));
      write("after.json", after);
    }
    const oldBalances = balances(before);
    const newBalances = balances(after);
    const rows = before.attendees.map(a => ({ id: a.id, name: `${a.first_name} ${a.last_name}`, before: oldBalances.get(a.id),
      after: newBalances.get(a.id), change: newBalances.get(a.id) - oldBalances.get(a.id) }));
    const totals = rows.reduce((total, row) => ({ before: total.before + row.before, after: total.after + row.after, change: total.change + row.change }), { before: 0, after: 0, change: 0 });
    const summary = { status: apply ? "validated-awaiting-commit" : "preview-only", actionUpdates: plan.actionUpdates.length,
      ledgerUpdates: plan.ledgerUpdates.length, duplicateLedgerIds: plan.duplicateLedgerIds, categoryUpdates: plan.categoryUpdates.length, totals, rows };
    write("summary.json", summary);
    return summary;
  });
  result.status = apply ? "committed" : "preview-only";
  write("summary.json", result);
  const report = ["# Private points recalculation", "", `Status: ${result.status}. Prepared ${new Date().toISOString()}.`, "",
    "Approved scoring: Attendance 2; Bible 5; Prayer 5; Read Aloud 4; Insight 5; Questions 3; Notes 5; Brought a Friend 10.", "",
    "Historical Participation points are preserved. Verified friend awards use a separate category. Recorded actions in all sessions are recalculated, including deleted sessions; deleted sessions remain excluded from balances. Manual adjustments and redemptions are unchanged.", "",
    `Duplicate session ledger credits removed: ${result.duplicateLedgerIds.join(", ") || "none"}. Each recorded action earns once. Original rows and the exact changes are retained in before.json and plan.json.`, "",
    "| Youth | Before | After | Change |", "|---|---:|---:|---:|",
    ...result.rows.map(row => `| ${row.name} | ${row.before} | ${row.after} | ${row.change > 0 ? "+" : ""}${row.change} |`),
    `| **Total** | **${result.totals.before}** | **${result.totals.after}** | **${result.totals.change}** |`, ""
  ].join("\n");
  fs.writeFileSync(path.join(output, "report.md"), report);
  console.log(JSON.stringify({ ...result, rows: undefined, output }, null, 2));
} catch (error) {
  write("error.json", { message: error.message, note: "Check summary.json for commit status. Transaction errors roll back database changes." });
  throw error;
} finally {
  await sql.end({ timeout: 5 });
}
