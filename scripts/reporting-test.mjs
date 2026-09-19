import assert from "node:assert/strict";
import { buildSessionTrends, chartTicks, filterSessionTrends, sortReportRows } from "../lib/reporting.js";

const rows = [
  { id: 1, name: "Zoe", attendance: 2, balance: 9, earned: 19, spent: 10 },
  { id: 2, name: "Ada", attendance: 10, balance: 100, earned: 100, spent: 0 },
  { id: 3, name: "Ben", attendance: 2, balance: -5, earned: 5, spent: 10 }
];
assert.deepEqual(sortReportRows(rows, "name").map(r => r.name), ["Ada", "Ben", "Zoe"]);
assert.deepEqual(sortReportRows(rows, "attendance", "desc").map(r => r.name), ["Ada", "Ben", "Zoe"]);
assert.deepEqual(sortReportRows(rows, "balance").map(r => r.balance), [-5, 9, 100]);
assert.deepEqual(sortReportRows(rows, "spent", "desc").map(r => r.name), ["Ben", "Zoe", "Ada"]);
assert.equal(rows[0].name, "Zoe", "Sorting must not mutate server-provided rows");

const trends = buildSessionTrends([
  { id: 3, session_date: "2026-02-08", title: "No awards yet" },
  { id: 2, session_date: "2026-02-01", title: "Evening" },
  { id: 1, session_date: "2026-02-01", title: "Morning" }
], [
  { session_id: "1", category_key: "attendance", youth_count: "12" },
  { session_id: "1", category_key: "bible", youth_count: "7" },
  { session_id: 2, category_key: "attendance", youth_count: 4 },
  { session_id: 99, category_key: "attendance", youth_count: 100 }
]);
assert.deepEqual(trends.map(s => s.id), [1, 2, 3], "Same-date sessions must remain distinct and ordered");
assert.equal(trends[0].counts.attendance, 12);
assert.equal(trends[0].counts.bible, 7);
assert.deepEqual(trends[2].counts, {}, "Keep sessions without awards so the chart displays zero");
assert.equal(trends.length, 3, "Counts must not reintroduce excluded sessions");
assert.deepEqual(filterSessionTrends(trends, "2026-02-01", "2026-02-01").map(s => s.id), [1, 2], "Range ends are inclusive");
assert.equal(filterSessionTrends(trends, "2027-01-01", "").length, 0);
assert.equal(filterSessionTrends(trends, "", "").length, 3);
for (const max of [0, 1, 2, 13, 19, 100, 523]) {
  const ticks = chartTicks(max);
  assert.equal(ticks[0], 0, "Count axes start at zero");
  assert.ok(ticks.at(-1) >= max && ticks.at(-1) > 0);
  assert.ok(ticks.every(Number.isInteger), "Youth counts use whole-number ticks");
  assert.ok(ticks.length <= 6);
}
console.log("Reporting checks passed: numeric sorting, date filters, same-date sessions, zero awards, and chart axes.");
