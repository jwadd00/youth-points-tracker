import assert from "node:assert/strict";
import { getBirthdays } from "../lib/birthdays.js";

const person = (id, name, date, status = "active") => ({ id, first_name: name, last_name: "Youth", birth_date: date, status });
const roster = [
  person(1, "Sunday", "2010-09-13"), person(2, "Today", "2011-09-14"),
  person(3, "Saturday", "2012-09-19"), person(4, "Next", "2010-09-20"),
  person(5, "Autumn", "2011-10-01"), person(6, "Winter", "2009-12-01"),
  person(7, "Missing", ""), person(8, "Invalid", "2010-02-30"),
  person(9, "Inactive", "2010-09-14", "inactive"), person(10, "Future", "2027-09-14")
];
const monday = getBirthdays(roster, new Date("2026-09-14T15:00:00Z"));
assert.equal(monday.weekStart, "2026-09-13");
assert.equal(monday.weekEnd, "2026-09-19");
assert.deepEqual(monday.thisWeek.map(b => b.id), [1, 2, 3]);
assert.equal(monday.thisWeek.find(b => b.id === 2).isToday, true);
assert.deepEqual(monday.upcoming.map(b => b.id), [4, 5, 6]);
assert.equal(monday.upcoming[0].daysAway, 6);
assert.equal(getBirthdays(roster, new Date("2026-09-20T04:30:00Z")).weekStart, "2026-09-13", "Central time is still Saturday");
assert.equal(getBirthdays(roster, new Date("2026-09-20T05:00:00Z")).weekStart, "2026-09-20", "Sunday starts a new week in Central time");

const yearEnd = getBirthdays([
  person(1, "December", "2011-12-31"), person(2, "January", "2011-01-01"),
  person(3, "Later", "2010-01-03"), person(4, "Same date", "2011-01-03")
], new Date("2026-12-31T18:00:00Z"));
assert.deepEqual(yearEnd.thisWeek.map(b => b.date), ["2026-12-31", "2027-01-01"]);
assert.deepEqual(yearEnd.upcoming.slice(0, 2).map(b => b.id), [3, 4], "Tied birthdays remain distinct");
assert.equal(yearEnd.upcoming[2].date, "2027-12-31", "Upcoming occurrences roll into next year");

const leap = person(1, "Leap", "2012-02-29");
assert.equal(getBirthdays([leap], new Date("2027-02-28T18:00:00Z")).thisWeek[0].date, "2027-02-28");
assert.equal(getBirthdays([leap], new Date("2028-02-29T18:00:00Z")).thisWeek[0].date, "2028-02-29");
assert.equal(getBirthdays([], new Date("2026-09-14T15:00:00Z")).upcoming.length, 0);
assert.equal(getBirthdays([person(1, "One", "2010-10-01")], new Date("2026-09-14T15:00:00Z")).upcoming.length, 1);
console.log("Birthday checks passed: week boundaries, Central time, year rollover, leap days, ties, and missing/invalid dates.");
