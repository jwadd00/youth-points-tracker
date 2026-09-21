import Link from "next/link";
import { all, getTopAttendeeBalances, attendeeName } from "@/lib/db";
import { getBirthdays } from "@/lib/birthdays";
import { comparisonDates, dashboardMetrics, sparklinePoints } from "@/lib/dashboard";
import styles from "./dashboard.module.css";

export const dynamic = "force-dynamic";

function dateLabel(value, options = {}) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC", month: "short", day: "numeric", ...options
  });
}

function Icon({ type, className }) {
  return <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {type === "trophy" ? <><path d="M15 8h18v14a9 9 0 0 1-18 0V8Z" /><path d="M15 12H9v5a8 8 0 0 0 8 8m16-13h6v5a8 8 0 0 1-8 8M24 31v8m-8 2h16" /></>
      : type === "people" ? <><circle cx="24" cy="15" r="6" /><circle cx="9" cy="19" r="4" /><circle cx="39" cy="19" r="4" /><path d="M13 39v-4a11 11 0 0 1 22 0v4M2 36v-4a7 7 0 0 1 10-6m34 10v-4a7 7 0 0 0-10-6" /></>
        : type === "calendar" ? <><rect x="8" y="10" width="32" height="30" rx="4" /><path d="M16 6v8m16-8v8M8 20h32m-24 8h5m6 0h5m-16 6h5" /></>
          : <><path d="M12 22h24v18H12zM9 15h30v7H9zM24 15v25" /><path d="M24 15c-12 0-13-11-6-10 5 0 6 10 6 10Zm0 0c12 0 13-11 6-10-5 0-6 10-6 10Z" /></>}
  </svg>;
}

function Change({ value, previous, period, estimate = false }) {
  const direction = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const text = value === null ? (previous === 0 ? "New" : "Unavailable")
    : `${value > 0 ? "+" : ""}${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
  return <div className={styles.change}>
    <span className={`${styles.changeBadge} ${styles[direction]}`}>
      {value !== null && value !== 0 && <span aria-hidden="true">{value > 0 ? "↗" : "↘"}</span>}{text}
    </span>
    <span>{estimate ? "est. " : ""}{period}</span>
  </div>;
}

function AttendanceSparkline({ sessions }) {
  const coordinates = sparklinePoints(sessions);
  if (!coordinates.length) return <p className={styles.noTrend}>Record a session to start the trend.</p>;
  const last = coordinates.at(-1);
  return <svg className={styles.sparkline} viewBox="0 0 180 60" role="img" aria-label={`Attendance in the last ${sessions.length} sessions: ${coordinates.map(p => p.value).join(", ")} youth. Most recent: ${last.value}.`}>
    <defs><linearGradient id="attendance-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4ce0ef" stopOpacity=".2" /><stop offset="100%" stopColor="#4ce0ef" stopOpacity="0" /></linearGradient></defs>
    <path d={`M${coordinates[0].x},54 ${coordinates.map(p => `L${p.x},${p.y}`).join(" ")} L${last.x},54 Z`} fill="url(#attendance-fill)" />
    <path d={`M${coordinates.map(p => `${p.x},${p.y}`).join(" L")}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx={last.x} cy={last.y} r="6" fill="currentColor" opacity=".14" />
    <circle cx={last.x} cy={last.y} r="3" fill="currentColor" />
  </svg>;
}

export default async function DashboardPage() {
  const now = new Date();
  const { today } = comparisonDates(now);
  const [ledger, youth, topBalances, sessions] = await Promise.all([
    all(`SELECT l.points, l.occurred_on FROM point_ledger l WHERE l.source_type != 'session'
      OR EXISTS (SELECT 1 FROM sessions s WHERE s.id = l.source_id AND s.deleted_at = '')`),
    all("SELECT id, first_name, last_name, birth_date, status, created_at FROM attendees"),
    getTopAttendeeBalances(3),
    all(`SELECT s.id, s.title, s.session_date,
      COUNT(DISTINCT CASE WHEN sp.category_key = 'attendance' THEN sp.attendee_id END) AS attendance
      FROM sessions s LEFT JOIN session_points sp ON sp.session_id = s.id
      WHERE s.deleted_at = '' AND s.session_date <= ?
      GROUP BY s.id, s.title, s.session_date ORDER BY s.session_date DESC, s.id DESC LIMIT 8`, [today])
  ]);
  const metrics = dashboardMetrics({ ledger, attendees: youth }, now);
  const birthdays = getBirthdays(youth, now);
  const celebrations = [...birthdays.thisWeek, ...birthdays.upcoming].slice(0, 3);
  const latest = sessions[0];

  return <div className={styles.dashboard}>
    <header className={styles.heading}>
      <h1>Rock Youth <span aria-hidden="true">|</span> <span>Session summary</span></h1>
      <div className={styles.headingMeta}><p>{latest ? `Latest meeting: ${latest.title || "Youth group session"}` : "Your youth group at a glance"}</p><time dateTime={today}>{dateLabel(today, { weekday: "long", year: "numeric" })}</time></div>
    </header>

    <section className={styles.metrics} aria-label="Youth group at a glance">
      <Link href="/ledger" className={styles.metric}>
        <h2>Total points</h2>
        <div className={styles.metricValue}>{metrics.total.toLocaleString("en-US")} <span>pts</span></div>
        <Change value={metrics.pointChange} previous={metrics.previousTotal} period="vs. last week" />
        <Icon type="trophy" className={styles.metricIcon} />
      </Link>
      <Link href="/attendees" className={styles.metric}>
        <h2>Active youth</h2>
        <div className={styles.metricValue}>{metrics.active}</div>
        <Change value={metrics.activeChange} previous={metrics.previousActive} period="vs. last month" estimate />
        <Icon type="people" className={styles.metricIcon} />
      </Link>
      <Link href="/trends" className={`${styles.metric} ${styles.attendanceMetric}`}>
        <h2>Attendance trend</h2>
        <div className={styles.metricValue}>{latest ? Number(latest.attendance) : "—"} <span>youth</span></div>
        <AttendanceSparkline sessions={[...sessions].reverse()} />
        <p className={styles.latestLabel}>{latest ? <><time dateTime={latest.session_date}>{dateLabel(latest.session_date)}</time><span> · latest session</span></> : "No sessions yet"}</p>
      </Link>
    </section>

    <section className={styles.panels} aria-label="Session highlights">
      <section className={`${styles.panel} ${styles.leaderPanel}`}>
        <div className={styles.panelHeading}><h2>Leaderboard snapshot</h2><Icon type="trophy" className={styles.smallIcon} /></div>
        <ol className={styles.leaders}>
          {topBalances.map((person, index) => <li key={person.id}><Link href={`/reports/${person.id}`}>
            <span className={styles.rank}>{String(index + 1).padStart(2, "0")}</span>
            <div><strong>{Number(person.balance).toLocaleString("en-US")} <span>pts</span></strong><span className={styles.leaderName}>{attendeeName(person)}</span></div>
          </Link></li>)}
        </ol>
        {!topBalances.length && <p className={styles.empty}>Your first point leaders will appear here.</p>}
        <Link href="/reports" className={styles.panelLink}>View all youth <span aria-hidden="true">↗</span></Link>
      </section>

      <section className={`${styles.panel} ${styles.sessionsPanel}`}>
        <div className={styles.panelHeading}><h2>Sessions</h2><Icon type="calendar" className={styles.smallIcon} /></div>
        <div className={styles.latestSession}>
          <span className={styles.sessionEyebrow}>{latest ? "Continue latest session" : "Ready for your first meeting?"}</span>
          <h3>{latest ? latest.title || "Youth group session" : "Start a new session"}</h3>
          {latest ? <time dateTime={latest.session_date}>{dateLabel(latest.session_date, { weekday: "long", year: "numeric" })}</time>
            : <p>Create a meeting to start recording attendance and points.</p>}
        </div>
        <div className={styles.sessionButtons}>
          {latest && <Link className={styles.primaryAction} href={`/sessions/${latest.id}`}>Edit points <span aria-hidden="true">↗</span></Link>}
          <Link className={latest ? styles.secondaryAction : styles.primaryAction} href="/sessions#new-session"><span aria-hidden="true">＋</span> Start a new session</Link>
        </div>
        <Link href="/sessions#session-history" className={styles.panelLink}>View all sessions <span aria-hidden="true">↗</span></Link>
      </section>

      <section className={`${styles.panel} ${styles.celebrationsPanel}`}>
        <div className={styles.panelHeading}><h2>Upcoming celebrations</h2><Icon type="gift" className={styles.smallIcon} /></div>
        <ul className={styles.celebrations}>
          {celebrations.map(birthday => <li key={`${birthday.id}:${birthday.date}`}><Link href={`/reports/${birthday.id}`}>
            <strong>{birthday.name}</strong><span>{birthday.isToday ? "Today!" : dateLabel(birthday.date, { weekday: "short", ...(birthday.date.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}) })}</span>
          </Link></li>)}
        </ul>
        {!celebrations.length && <p className={styles.empty}>Add birthdays to the youth roster to celebrate together.</p>}
        <Link href="/attendees" className={styles.panelLink}>Youth roster <span aria-hidden="true">↗</span></Link>
      </section>
    </section>

    <footer className={styles.footer}>
      <details><summary>About these numbers</summary><p>Total points is the combined balance, including adjustments and redemptions, compared with activity dated through {dateLabel(metrics.weekAgo)} using the current recorded values. Deleted sessions are excluded. Active youth growth is estimated from join dates of currently active youth compared with {dateLabel(metrics.monthAgo)}; past active/inactive changes weren’t recorded. “New” means the previous value was zero. Attendance counts recorded attendance awards in the last {sessions.length} sessions.</p></details>
    </footer>
  </div>;
}
