// Pure helpers shared by the reporting UI and its regression checks.
export function sortReportRows(rows, key, direction = "asc") {
  const sign = direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const comparison = key === "name"
      ? a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true })
      : Number(a[key]) - Number(b[key]);
    return comparison * sign || a.name.localeCompare(b.name) || a.id - b.id;
  });
}

export function buildSessionTrends(sessions, counts) {
  const bySession = new Map(sessions.map(session => [Number(session.id), {
    id: Number(session.id), date: session.session_date, title: session.title || "Youth group session", counts: {}
  }]));
  for (const row of counts) {
    const session = bySession.get(Number(row.session_id));
    if (session) session.counts[row.category_key] = Number(row.youth_count);
  }
  return [...bySession.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
}

export function filterSessionTrends(sessions, from, through) {
  return sessions.filter(session => (!from || session.date >= from) && (!through || session.date <= through));
}

export function chartTicks(maximum) {
  const rawStep = Math.max(1, maximum / 4);
  const power = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 5, 10].map(n => n * power).find(n => n >= rawStep);
  const top = Math.max(step, Math.ceil(maximum / step) * step);
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}
