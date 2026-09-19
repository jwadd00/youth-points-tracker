import { all, attendeeName, getAttendeeBalances } from "@/lib/db";
import ReportsTable from "@/components/ReportsTable";

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
  const attendanceById = new Map(attendance.map((row) => [Number(row.attendee_id), Number(row.sessions_attended)]));
  const rows = attendees.map(attendee => ({
    id: Number(attendee.id), name: attendeeName(attendee),
    attendance: attendanceById.get(Number(attendee.id)) || 0,
    balance: Number(attendee.balance), earned: Number(attendee.earned), spent: Number(attendee.spent)
  }));

  return (
    <>
      <section className="pageHeader">
        <div>
          <h1>Individual reports</h1>
          <p>Review balances, attendance trends, lifetime earning, redemptions, and engagement patterns for each youth.</p>
        </div>
      </section>

      <section className="panel">
        <ReportsTable rows={rows} totalSessions={Number(totalSessions)} />
      </section>
    </>
  );
}
