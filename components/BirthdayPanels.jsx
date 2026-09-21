import Link from "next/link";

function format(date, options) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", ...options });
}

function BirthdayList({ birthdays, today, emptyMessage }) {
  if (!birthdays.length) return <p className="birthdayEmpty">{emptyMessage}</p>;
  return <ul className="birthdayList">
    {birthdays.map(birthday => <li key={birthday.id}>
      <time className="birthdayDate" dateTime={birthday.date} aria-label={format(birthday.date, { month: "long", day: "numeric", year: "numeric" })}>
        <span>{format(birthday.date, { month: "short" })}</span>
        <strong>{format(birthday.date, { day: "numeric" })}</strong>
      </time>
      <div className="birthdayPerson">
        <strong>{birthday.name}</strong>
        <span>{format(birthday.date, { weekday: "long" })}{birthday.date.slice(0, 4) !== today.slice(0, 4) ? ` · ${birthday.date.slice(0, 4)}` : ""}</span>
      </div>
      {birthday.isToday && <span className="birthdayToday">Today</span>}
    </li>)}
  </ul>;
}

export default function BirthdayPanels({ birthdays }) {
  const { today, weekStart, weekEnd, thisWeek, upcoming } = birthdays;
  const range = `${format(weekStart, { month: "short", day: "numeric" })} – ${format(weekEnd, { month: "short", day: "numeric" })}`;
  return <section className="birthdayGrid" aria-label="Youth birthdays">
    <div className="panel birthdayPanel">
      <div className="panelTitle"><div><h2>This week’s birthdays</h2><p>{range} · Sunday–Saturday</p></div></div>
      <BirthdayList birthdays={thisWeek} today={today} emptyMessage="No birthdays this week." />
    </div>
    <div className="panel birthdayPanel">
      <div className="panelTitle"><div><h2>Next 3 birthdays</h2><p>Coming up after this week</p></div><Link className="birthdayRosterLink" href="/attendees">Youth roster</Link></div>
      <BirthdayList birthdays={upcoming} today={today} emptyMessage="Add birth dates on the youth roster to see upcoming birthdays." />
    </div>
  </section>;
}
