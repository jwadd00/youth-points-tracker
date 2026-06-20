import { getAttendeeBalances } from "@/lib/db";
import { saveAttendee } from "@/lib/actions";
import { points } from "@/lib/format";
import AttendeeRoster from "@/components/AttendeeRoster";
import SaveToast from "@/components/SaveToast";

export const dynamic = "force-dynamic";

export default async function AttendeesPage({ searchParams }) {
  const query = await searchParams;
  const attendees = await getAttendeeBalances();
  const activeCount = attendees.filter((attendee) => attendee.status === "active").length;
  const totalBalance = attendees.reduce((sum, attendee) => sum + Number(attendee.balance || 0), 0);

  return (
    <>
      <SaveToast show={query?.saved === "1"} />
      <section className="pageHeader">
        <div>
          <p className="eyebrow">Roster management</p>
          <h1>Youth attendees</h1>
          <p>Maintain clean profile records for attendance, rewards, reports, and point history.</p>
        </div>
        <div className="summaryStrip" aria-label="Roster summary">
          <div><span>Total</span><strong>{attendees.length}</strong></div>
          <div><span>Active</span><strong>{activeCount}</strong></div>
          <div><span>Balance</span><strong>{points(totalBalance)}</strong></div>
        </div>
      </section>

      <section className="workspaceGrid">
        <div className="panel rosterPanel">
          <div className="panelTitle">
            <div>
              <h2>Roster</h2>
              <p>Update individual records without leaving the list.</p>
            </div>
          </div>

          <AttendeeRoster attendees={attendees} />
        </div>

        <aside className="panel sidePanel">
          <div className="panelTitle">
            <div>
              <h2>Add youth</h2>
              <p>Create a profile for a new attendee.</p>
            </div>
          </div>
          <form action={saveAttendee} className="formGrid two">
            <label className="field">
              First name
              <input name="first_name" required />
            </label>
            <label className="field">
              Last name
              <input name="last_name" required />
            </label>
            <label className="field">
              Grade
              <input name="grade" placeholder="7th" />
            </label>
            <label className="field">
              Birth date
              <input name="birth_date" type="date" />
            </label>
            <label className="field full">
              Status
              <select name="status" defaultValue="active">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="field full">
              Notes
              <textarea name="notes" />
            </label>
            <div className="field full">
              <button className="btn wide" type="submit">Save youth</button>
            </div>
          </form>
        </aside>
      </section>
    </>
  );
}
