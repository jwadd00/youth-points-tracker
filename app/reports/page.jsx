import Link from "next/link";
import { all, attendeeName, getAttendeeBalances } from "@/lib/db";
import { points, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const attendees = await getAttendeeBalances();
  const totalSessions = (await all("SELECT COUNT(*) AS count FROM sessions WHERE deleted_at = ''"))[0]?.count || 0;
  const attendance = await all(`
    SELECT sp.attendee_id, COUNT(DISTINCT sp.session_id) AS sessions_attended
    FROM session_points sp
    JOIN sessions s ON s.id = sp.session_id
    WHERE sp.category_key = 'attendance' AND s.deleted_at = ''
    GROUP BY sp.attendee_id
  `);
  const attendanceById = new Map(attendance.map((row) => [row.attendee_id, row.sessions_attended]));

  return (
    <>
      <section className="pageHeader">
        <div>
          <h1>Individual reports</h1>
          <p>Review balances, attendance trends, lifetime earning, redemptions, and engagement patterns for each youth.</p>
        </div>
      </section>

      <section className="panel">
        <div className="tableWrap">
          <table>
            <thead><tr><th>Youth</th><th>Grade</th><th>Birth Date</th><th>Status</th><th>Balance</th><th>Earned</th><th>Redeemed</th><th>Attendance</th><th></th></tr></thead>
            <tbody>
              {attendees.map((attendee) => {
                const sessionsAttended = attendanceById.get(attendee.id) || 0;
                const attendanceRate = totalSessions ? (sessionsAttended / totalSessions) * 100 : 0;
                return (
                  <tr key={attendee.id}>
                    <td>{attendeeName(attendee)}</td>
                    <td>{attendee.grade || "Not set"}</td>
                    <td>{attendee.birth_date || "Not set"}</td>
                    <td><span className={attendee.status === "active" ? "pill" : "pill off"}>{attendee.status}</span></td>
                    <td className="score">{points(attendee.balance)}</td>
                    <td>{points(attendee.earned)}</td>
                    <td>{points(attendee.spent)}</td>
                    <td>
                      <div>{sessionsAttended} of {totalSessions}</div>
                      <div className="bar"><span style={{ width: pct(attendanceRate) }} /></div>
                    </td>
                    <td><Link className="btn secondary" href={`/reports/${attendee.id}`}>Open</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!attendees.length && <p className="empty">No youth attendees have been added yet.</p>}
      </section>
    </>
  );
}
