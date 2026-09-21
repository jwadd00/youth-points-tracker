export function centralDate(value = new Date()) {
  // SQLite CURRENT_TIMESTAMP is UTC even though its text has no timezone suffix.
  const normalized = typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}Z` : value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date(normalized));
}

export function comparisonDates(now = new Date()) {
  const today = centralDate(now);
  const date = new Date(`${today}T12:00:00Z`);
  const week = new Date(date);
  week.setUTCDate(week.getUTCDate() - 7);
  const month = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 0, 12));
  month.setUTCDate(Math.min(date.getUTCDate(), month.getUTCDate()));
  return { today, weekAgo: week.toISOString().slice(0, 10), monthAgo: month.toISOString().slice(0, 10) };
}

export function percentageChange(current, previous) {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / Math.abs(previous) * 100;
}

export function dashboardMetrics({ ledger, attendees }, now = new Date()) {
  const dates = comparisonDates(now);
  const balance = through => ledger.filter(row => row.occurred_on <= through)
    .reduce((sum, row) => sum + Number(row.points), 0);
  const total = balance(dates.today);
  const previousTotal = balance(dates.weekAgo);
  const active = attendees.filter(a => a.status === "active");
  // No historical status log exists; the UI identifies this as an estimate.
  const joined = active.map(a => a.created_at && !Number.isNaN(new Date(a.created_at).getTime()) ? centralDate(a.created_at) : null);
  const previousActive = joined.some(date => !date) ? null : joined.filter(date => date <= dates.monthAgo).length;
  return { ...dates, total, previousTotal, pointChange: percentageChange(total, previousTotal),
    active: active.length, previousActive,
    activeChange: previousActive === null ? null : percentageChange(active.length, previousActive) };
}

export function sparklinePoints(sessions, width = 180, height = 54) {
  if (!sessions.length) return [];
  const maximum = Math.max(1, ...sessions.map(s => Number(s.attendance)));
  return sessions.map((session, index) => ({
    x: sessions.length === 1 ? width / 2 : 8 + index * (width - 16) / (sessions.length - 1),
    y: height - 8 - Number(session.attendance) / maximum * (height - 20),
    value: Number(session.attendance)
  }));
}
