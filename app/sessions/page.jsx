import Link from "next/link";
import { all } from "@/lib/db";
import { createSession, deleteSession, restoreDeletedSessionsSince } from "@/lib/actions";
import { fmtDate, points } from "@/lib/format";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import SaveToast from "@/components/SaveToast";

export const dynamic = "force-dynamic";

function sessionDateParts(value) {
  const date = new Date(`${value}T00:00:00`);
  return {
    month: date.toLocaleDateString(undefined, { month: "short" }),
    day: date.toLocaleDateString(undefined, { day: "numeric" })
  };
}

export default async function SessionsPage({ searchParams }) {
  const query = await searchParams;
  const sessions = await all(`
    SELECT s.*,
      COUNT(DISTINCT sp.attendee_id) AS attendee_count,
      COALESCE(SUM(sp.points), 0) AS points_awarded
    FROM sessions s
    LEFT JOIN session_points sp ON sp.session_id = s.id
    WHERE s.deleted_at = ''
    GROUP BY s.id
    ORDER BY s.session_date DESC, s.id DESC
  `);
  const deletedSessions = await all(`
    SELECT id, session_date, title, deleted_at
    FROM sessions
    WHERE deleted_at != ''
    ORDER BY deleted_at DESC, session_date DESC
    LIMIT 8
  `);

  return (
    <>
      <SaveToast show={query?.saved === "1"} />
      <section className="pageHeader">
        <div>
          <h1>Sessions</h1>
          <p>Create meetings, edit point sheets, and remove sessions without permanently losing the underlying data.</p>
        </div>
      </section>

      <section className="sessionLayout">
        <div className="panel">
          <div className="panelTitle">
            <div>
              <h2>Session history</h2>
              <p>{sessions.length} active sessions</p>
            </div>
          </div>

          <div className="sessionList">
            {sessions.map((session) => {
              const dateParts = sessionDateParts(session.session_date);
              return (
                <article className="sessionCard" key={session.id}>
                  <div className="sessionDateBadge">
                    <span>{dateParts.month}</span>
                    <strong>{dateParts.day}</strong>
                  </div>
                  <div className="sessionCardBody">
                    <h3>{session.title || "Youth group session"}</h3>
                    <p>{session.notes || "No notes"}</p>
                    <div className="sessionMeta">
                      <span>{fmtDate(session.session_date)}</span>
                      <span>{session.attendee_count} youth</span>
                      <span>{points(session.points_awarded)}</span>
                    </div>
                  </div>
                  <div className="sessionActions">
                    <Link className="btn secondary" href={`/sessions/${session.id}`}>Edit</Link>
                    <form action={deleteSession}>
                      <input type="hidden" name="id" value={session.id} />
                      <ConfirmSubmitButton className="btn ghost danger">Remove</ConfirmSubmitButton>
                    </form>
                  </div>
                </article>
              );
            })}
            {!sessions.length && <p className="empty">No active sessions.</p>}
          </div>
        </div>

        <aside className="sessionSideStack">
          <div className="panel">
            <div className="panelTitle"><h2>New session</h2></div>
            <form action={createSession} className="formGrid">
              <label className="field">Date<input name="session_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
              <label className="field">Title<input name="title" placeholder="Wednesday Night" /></label>
              <label className="field">Notes<textarea name="notes" /></label>
              <button className="btn wide" type="submit">Create and edit</button>
            </form>
          </div>

          <div className="panel">
            <div className="panelTitle">
              <div>
                <h2>Rollback</h2>
                <p>Restore sessions removed on or after a date.</p>
              </div>
            </div>
            <form action={restoreDeletedSessionsSince} className="formGrid">
              <label className="field">Removed since<input name="restore_date" type="date" required /></label>
              <button className="btn secondary wide" type="submit">Restore removed sessions</button>
            </form>
            {deletedSessions.length ? (
              <div className="deletedSessionList">
                {deletedSessions.map((session) => (
                  <div key={session.id}>
                    <strong>{session.title || "Youth group session"}</strong>
                    <span>{fmtDate(session.session_date)} removed {session.deleted_at.slice(0, 10)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty compact">No removed sessions.</p>
            )}
          </div>
        </aside>
      </section>
    </>
  );
}
