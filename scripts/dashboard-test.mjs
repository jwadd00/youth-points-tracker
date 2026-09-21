import assert from "node:assert/strict";
import { centralDate, comparisonDates, dashboardMetrics, percentageChange, sparklinePoints } from "../lib/dashboard.js";

assert.deepEqual(comparisonDates(new Date("2026-09-21T19:00:00Z")), { today: "2026-09-21", weekAgo: "2026-09-14", monthAgo: "2026-08-21" });
assert.equal(comparisonDates(new Date("2026-03-31T18:00:00Z")).monthAgo, "2026-02-28");
assert.equal(comparisonDates(new Date("2024-03-31T18:00:00Z")).monthAgo, "2024-02-29");
assert.deepEqual(comparisonDates(new Date("2026-01-01T02:00:00Z")), { today: "2025-12-31", weekAgo: "2025-12-24", monthAgo: "2025-11-30" });
assert.equal(percentageChange(100, 80), 25);
assert.equal(percentageChange(80, 100), -20);
assert.equal(percentageChange(0, 0), 0);
assert.equal(percentageChange(10, 0), null);
assert.equal(percentageChange(-5, -10), 50);
assert.equal(centralDate("2026-08-22 02:00:00"), "2026-08-21", "SQLite timestamps are interpreted as UTC");

const metrics = dashboardMetrics({
  ledger: [
    { points: 100, occurred_on: "2026-09-14" },
    { points: -10, occurred_on: "2026-09-15" },
    { points: 25, occurred_on: "2026-09-20" },
    { points: 1000, occurred_on: "2026-09-22" }
  ],
  attendees: [
    { status: "active", created_at: "2026-08-01T12:00:00Z" },
    { status: "active", created_at: "2026-08-22T02:00:00Z" }, // Still Aug 21 in Central.
    { status: "active", created_at: "2026-09-01T12:00:00Z" },
    { status: "inactive", created_at: "2026-08-01T12:00:00Z" }
  ]
}, new Date("2026-09-21T19:00:00Z"));
assert.equal(metrics.total, 115, "Balance includes redemptions and excludes future activity");
assert.equal(metrics.previousTotal, 100, "Seven-day comparison includes the cutoff date");
assert.equal(metrics.pointChange, 15);
assert.equal(metrics.active, 3);
assert.equal(metrics.previousActive, 2);
assert.equal(metrics.activeChange, 50);
const missing = dashboardMetrics({ ledger: [], attendees: [{status: "active", created_at: "invalid"}] });
assert.equal(missing.activeChange, null, "Missing join dates must not fabricate historical membership");
assert.deepEqual(sparklinePoints([]), []);
assert.equal(sparklinePoints([{attendance: 0}])[0].x, 90);
assert.ok(sparklinePoints([{attendance: 0}, {attendance: 0}]).every(p => Number.isFinite(p.y)));
const trend = sparklinePoints([{attendance: 5}, {attendance: "10"}, {attendance: 3}]);
assert.ok(trend[1].y < trend[0].y && trend[0].y < trend[2].y);
assert.equal(trend.at(-1).value, 3, "The latest sparkline point matches the latest session count");
console.log("Dashboard checks passed: Central dates, month-end/leap boundaries, net balances, roster estimates, zero baselines, and sparse attendance trends.");
