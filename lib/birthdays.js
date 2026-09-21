const DAY = 24 * 60 * 60 * 1000;

function utcDate(value) {
  return new Date(`${value}T00:00:00Z`);
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function validBirthDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const date = utcDate(value);
  return !Number.isNaN(date.getTime()) && isoDate(date) === value;
}

function occurrence(birthDate, year) {
  const month = Number(birthDate.slice(5, 7));
  const day = Number(birthDate.slice(8, 10));
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  // Observe February 29 birthdays on February 28 in non-leap years.
  return `${year}-${String(month).padStart(2, "0")}-${String(month === 2 && day === 29 && !leapYear ? 28 : day).padStart(2, "0")}`;
}

export function getBirthdays(attendees, now = new Date()) {
  // Calculate calendar days in the group's timezone, independent of the host's timezone.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const part = type => parts.find(p => p.type === type).value;
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const todayDate = utcDate(today);
  const startDate = new Date(todayDate.getTime() - todayDate.getUTCDay() * DAY);
  const endDate = new Date(startDate.getTime() + 6 * DAY);
  const weekStart = isoDate(startDate), weekEnd = isoDate(endDate);
  const thisWeek = [], upcoming = [];
  const eligible = attendees.filter(a => a.status === "active" && validBirthDate(a.birth_date) && a.birth_date <= today);

  for (const attendee of eligible) {
    const event = date => ({
      id: attendee.id, name: `${attendee.first_name} ${attendee.last_name}`.trim(), date,
      isToday: date === today, daysAway: Math.round((utcDate(date).getTime() - todayDate.getTime()) / DAY)
    });
    for (let year = startDate.getUTCFullYear(); year <= endDate.getUTCFullYear(); year++) {
      const date = occurrence(attendee.birth_date, year);
      if (date >= weekStart && date <= weekEnd) thisWeek.push(event(date));
    }
    let next = occurrence(attendee.birth_date, endDate.getUTCFullYear());
    if (next <= weekEnd) next = occurrence(attendee.birth_date, endDate.getUTCFullYear() + 1);
    upcoming.push(event(next));
  }
  const byDate = (a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name) || a.id - b.id;
  return { today, weekStart, weekEnd, thisWeek: thisWeek.sort(byDate), upcoming: upcoming.sort(byDate).slice(0, 3) };
}
