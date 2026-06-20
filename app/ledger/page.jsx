import { all, attendeeName, getAttendeeBalances } from "@/lib/db";
import { addManualLedger, redeemReward } from "@/lib/actions";
import { fmtDate, points } from "@/lib/format";
import SaveToast from "@/components/SaveToast";

export const dynamic = "force-dynamic";

export default async function LedgerPage({ searchParams }) {
  const query = await searchParams;
  const attendees = await getAttendeeBalances();
  const rewards = await all("SELECT * FROM rewards WHERE active = 1 ORDER BY cost ASC, name ASC");
  const ledger = await all(`
    SELECT l.*, a.first_name, a.last_name
    FROM point_ledger l
    JOIN attendees a ON a.id = l.attendee_id
    WHERE l.source_type != 'session'
      OR EXISTS (
        SELECT 1 FROM sessions s
        WHERE s.id = l.source_id AND s.deleted_at = ''
      )
    ORDER BY l.occurred_on DESC, l.id DESC
    LIMIT 100
  `);

  return (
    <>
      <SaveToast show={query?.saved === "1"} />
      <section className="pageHeader">
        <div>
          <h1>Point ledger</h1>
          <p>Add manual adjustments, special awards, corrections, and approved reward redemptions.</p>
        </div>
      </section>

      <section className="grid two">
        <div className="panel">
          <div className="panelTitle"><h2>Manual entry</h2></div>
          <form action={addManualLedger} className="formGrid">
            <label className="field">
              Youth
              <select name="attendee_id" required>
                <option value="">Select youth</option>
                {attendees.map((attendee) => <option key={attendee.id} value={attendee.id}>{attendeeName(attendee)} - {points(attendee.balance)}</option>)}
              </select>
            </label>
            <label className="field">Points<input name="points" type="number" placeholder="Use negative numbers for corrections" required /></label>
            <label className="field">Date<input name="occurred_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
            <label className="field">Description<textarea name="description" /></label>
            <button className="btn" type="submit">Add Ledger Entry</button>
          </form>
        </div>

        <div className="panel">
          <div className="panelTitle"><h2>Redeem reward</h2></div>
          <form action={redeemReward} className="formGrid">
            <label className="field">
              Youth
              <select name="attendee_id" required>
                <option value="">Select youth</option>
                {attendees.map((attendee) => <option key={attendee.id} value={attendee.id}>{attendeeName(attendee)} - {points(attendee.balance)}</option>)}
              </select>
            </label>
            <label className="field">
              Reward
              <select name="reward_id" required>
                <option value="">Select reward</option>
                {rewards.map((reward) => <option key={reward.id} value={reward.id}>{reward.name} - {points(reward.cost)}</option>)}
              </select>
            </label>
            <label className="field">Date<input name="redeemed_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
            <label className="field">Notes<textarea name="notes" /></label>
            <button className="btn" type="submit">Redeem Reward</button>
          </form>
          <p className="muted">Redemption is ignored if the youth does not have enough points.</p>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panelTitle"><h2>Recent ledger</h2></div>
        <div className="tableWrap">
          <table>
            <thead><tr><th>Date</th><th>Youth</th><th>Type</th><th>Description</th><th>Points</th></tr></thead>
            <tbody>
              {ledger.map((entry) => (
                <tr key={entry.id}>
                  <td>{fmtDate(entry.occurred_on)}</td>
                  <td>{attendeeName(entry)}</td>
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
