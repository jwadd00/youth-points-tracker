import Link from "next/link";
import { notFound } from "next/navigation";
import { all, get, attendeeName } from "@/lib/db";
import { saveSessionPoints } from "@/lib/actions";
import { fmtDate, points } from "@/lib/format";
import SaveToast from "@/components/SaveToast";

export const dynamic = "force-dynamic";

export default async function SessionDetailPage({ params, searchParams }) {
  const { id } = await params;
  const query = await searchParams;
  const session = await get("SELECT * FROM sessions WHERE id = ? AND deleted_at = ''", [id]);
  if (!session) notFound();

  const attendees = await all("SELECT * FROM attendees WHERE status = 'active' ORDER BY last_name, first_name");
  const categories = await all("SELECT * FROM point_categories WHERE enabled = 1 ORDER BY sort_order, label");
  const existing = await all("SELECT attendee_id, category_key FROM session_points WHERE session_id = ?", [session.id]);
  const selected = new Set(existing.map((row) => `${row.attendee_id}:${row.category_key}`));
  const totals = await all(`
    SELECT attendee_id, SUM(points) AS total
    FROM session_points
    WHERE session_id = ?
    GROUP BY attendee_id
  `, [session.id]);
  const totalByAttendee = new Map(totals.map((row) => [row.attendee_id, row.total]));

  return (
    <>
      <SaveToast show={query?.saved === "1"} />
      <section className="pageHeader">
        <div>
          <h1>{session.title || "Youth group session"}</h1>
          <p>{fmtDate(session.session_date)} - {session.notes || "Record attendance and engagement points."}</p>
        </div>
        <Link className="btn secondary" href="/sessions">Back to Sessions</Link>
      </section>

      <section className="panel">
        <form action={saveSessionPoints}>
          <input type="hidden" name="session_id" value={session.id} />
          <div className="sessionMatrix">
            <table>
              <thead>
                <tr>
                  <th>Youth</th>
                  {categories.map((category) => (
                    <th key={category.category_key}>{category.label}<br /><span className="muted">{points(category.points)}</span></th>
                  ))}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {attendees.map((attendee) => (
                  <tr key={attendee.id}>
                    <td>
                      {attendeeName(attendee)}
                      <br />
                      <small className="muted">
                        Grade: {attendee.grade || "not set"} - Birth date: {attendee.birth_date || "not set"}
                      </small>
                    </td>
                    {categories.map((category) => {
                      const name = `cat_${attendee.id}_${category.category_key}`;
                      return (
                        <td key={name}>
                          <input
                            aria-label={`${attendeeName(attendee)} ${category.label}`}
                            name={name}
                            type="checkbox"
                            defaultChecked={selected.has(`${attendee.id}:${category.category_key}`)}
                          />
                        </td>
                      );
                    })}
                    <td className="score">{points(totalByAttendee.get(attendee.id) || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="buttonRow" style={{ marginTop: 16 }}>
            <button className="btn" type="submit">Save Session Points</button>
            <Link className="btn secondary" href="/reports">View Reports</Link>
          </div>
        </form>
        {!attendees.length && <p className="empty">Add active youth attendees before recording a session.</p>}
      </section>
    </>
  );
}
