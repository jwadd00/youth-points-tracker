import Link from "next/link";
import { notFound } from "next/navigation";
import { all, attendeeName, get, getBalance } from "@/lib/db";
import { fmtDate, points, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AttendeeReportPage({ params }) {
  const { id } = await params;
  const attendee = await get("SELECT * FROM attendees WHERE id = ?", [id]);
  if (!attendee) notFound();

  const balance = await getBalance(attendee.id);
  const totals = await get(`
    SELECT
      COALESCE(SUM(CASE WHEN points > 0 THEN points ELSE 0 END), 0) AS earned,
      ABS(COALESCE(SUM(CASE WHEN points < 0 THEN points ELSE 0 END), 0)) AS spent,
      COUNT(*) AS entries
    FROM point_ledger
    WHERE attendee_id = ?
      AND (
        source_type != 'session'
        OR EXISTS (
          SELECT 1 FROM sessions s
          WHERE s.id = point_ledger.source_id AND s.deleted_at = ''
        )
      )
  `, [attendee.id]);
  const categoryRows = await all(`
    SELECT pc.label, pc.category_key, COUNT(sp.id) AS count, COALESCE(SUM(sp.points), 0) AS total
    FROM point_categories pc
    LEFT JOIN session_points sp
      ON sp.category_key = pc.category_key
      AND sp.attendee_id = ?
      AND EXISTS (
        SELECT 1 FROM sessions s
        WHERE s.id = sp.session_id AND s.deleted_at = ''
      )
    GROUP BY pc.id, pc.label, pc.category_key, pc.sort_order
    ORDER BY pc.sort_order
  `, [attendee.id]);
  const maxCategory = Math.max(...categoryRows.map((row) => Number(row.total || 0)), 1);
  const sessionRows = await all(`
    SELECT s.id, s.session_date, s.title, COALESCE(SUM(sp.points), 0) AS total
    FROM sessions s
    JOIN session_points sp ON sp.session_id = s.id
    WHERE sp.attendee_id = ? AND s.deleted_at = ''
    GROUP BY s.id
    ORDER BY s.session_date DESC, s.id DESC
    LIMIT 12
  `, [attendee.id]);
  const manualRows = await all(`
    SELECT * FROM point_ledger
    WHERE attendee_id = ? AND source_type = 'manual'
    ORDER BY occurred_on DESC, id DESC
    LIMIT 10
  `, [attendee.id]);
  const redemptions = await all(`
    SELECT rr.*, r.name
    FROM reward_redemptions rr
    JOIN rewards r ON r.id = rr.reward_id
    WHERE rr.attendee_id = ?
    ORDER BY rr.redeemed_on DESC, rr.id DESC
  `, [attendee.id]);
  const ledger = await all(`
    SELECT * FROM point_ledger
    WHERE attendee_id = ?
      AND (
        source_type != 'session'
        OR EXISTS (
          SELECT 1 FROM sessions s
          WHERE s.id = point_ledger.source_id AND s.deleted_at = ''
        )
      )
    ORDER BY occurred_on DESC, id DESC
    LIMIT 12
  `, [attendee.id]);

  return (
    <>
      <section className="pageHeader">
        <div>
          <h1>{attendeeName(attendee)}</h1>
          <p>Grade: {attendee.grade || "not set"} - Birth date: {attendee.birth_date || "not set"} - {attendee.status} - {attendee.notes || "No notes"}</p>
        </div>
        <Link className="btn secondary" href="/reports">Back to Reports</Link>
      </section>

      <section className="statGrid">
        <div className="stat"><span>Current Balance</span><strong>{points(balance)}</strong></div>
        <div className="stat"><span>Lifetime Earned</span><strong>{points(totals.earned)}</strong></div>
        <div className="stat"><span>Redeemed/Spent</span><strong>{points(totals.spent)}</strong></div>
        <div className="stat"><span>Ledger Entries</span><strong>{totals.entries}</strong></div>
      </section>

      <section className="grid two">
        <div className="panel">
          <div className="panelTitle"><h2>Engagement by category</h2></div>
          <div className="timeline">
            {categoryRows.map((row) => (
              <div key={row.category_key}>
                <div className="buttonRow" style={{ justifyContent: "space-between" }}>
                  <strong>{row.label}</strong>
                  <span className="muted">{row.count} times - {points(row.total)}</span>
                </div>
                <div className="bar"><span style={{ width: pct((row.total / maxCategory) * 100) }} /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panelTitle"><h2>Recent sessions</h2></div>
          <div className="timeline">
            {sessionRows.map((session) => (
              <div className="timelineItem" key={session.id}>
                <strong>{session.title || "Youth group session"}</strong>
                <div className="muted">{fmtDate(session.session_date)} - {points(session.total)}</div>
              </div>
            ))}
            {!sessionRows.length && <p className="empty">No session activity yet.</p>}
          </div>
        </div>
      </section>

      <section className="grid two" style={{ marginTop: 16 }}>
        <div className="panel">
          <div className="panelTitle"><h2>Manual adjustments</h2></div>
          <div className="timeline">
            {manualRows.map((entry) => (
              <div className="timelineItem" key={entry.id}>
                <strong>{points(entry.points)}</strong>
                <div>{entry.description}</div>
                <small className="muted">{fmtDate(entry.occurred_on)}</small>
              </div>
            ))}
            {!manualRows.length && <p className="empty">No manual adjustments.</p>}
          </div>
        </div>

        <div className="panel">
          <div className="panelTitle"><h2>Reward history</h2></div>
          <div className="timeline">
            {redemptions.map((reward) => (
              <div className="timelineItem" key={reward.id}>
                <strong>{reward.name}</strong>
                <div>{points(reward.points_spent)} redeemed</div>
                <small className="muted">{fmtDate(reward.redeemed_on)} {reward.notes ? `- ${reward.notes}` : ""}</small>
              </div>
            ))}
            {!redemptions.length && <p className="empty">No rewards redeemed yet.</p>}
          </div>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panelTitle"><h2>Recent point history</h2></div>
        <div className="tableWrap">
          <table>
            <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Points</th></tr></thead>
            <tbody>
              {ledger.map((entry) => (
                <tr key={entry.id}>
                  <td>{fmtDate(entry.occurred_on)}</td>
                  <td><span className="pill">{entry.entry_type}</span></td>
                  <td>{entry.description}</td>
                  <td className="score">{points(entry.points)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
