import { all } from "@/lib/db";
import Link from "next/link";
import { deleteReward, saveReward } from "@/lib/actions";
import { points } from "@/lib/format";
import SaveToast from "@/components/SaveToast";

export const dynamic = "force-dynamic";

export default async function RewardsPage({ searchParams }) {
  const query = await searchParams;
  const rewards = await all("SELECT * FROM rewards ORDER BY active DESC, cost ASC, name ASC");

  return (
    <>
      <SaveToast show={query?.saved === "1"} />
      <section className="pageHeader">
        <div>
          <h1>Rewards</h1>
          <p>Configure rewards that leaders can redeem for youth from their point balances.</p>
        </div>
        <Link className="btn secondary" href="/point-rules">Configure point awards</Link>
      </section>

      <section className="grid two">
        <div className="panel">
          <div className="panelTitle"><h2>Reward catalog</h2></div>
          <div className="tableWrap">
            <table>
              <thead><tr><th>Reward</th><th>Cost</th><th>Status</th><th>Description</th><th></th></tr></thead>
              <tbody>
                {rewards.map((reward) => (
                  <tr key={reward.id}>
                    <td>
                      <form id={`reward-${reward.id}`} action={saveReward}>
                        <input type="hidden" name="id" value={reward.id} />
                        <input name="name" defaultValue={reward.name} aria-label={`${reward.name} name`} />
                      </form>
                    </td>
                    <td><input form={`reward-${reward.id}`} name="cost" type="number" min="1" defaultValue={reward.cost} aria-label={`${reward.name} cost`} /></td>
                    <td>
                      <label className="checkRow">
                        <input form={`reward-${reward.id}`} name="active" type="checkbox" defaultChecked={Boolean(reward.active)} />
                        Active
                      </label>
                    </td>
                    <td><textarea form={`reward-${reward.id}`} name="description" defaultValue={reward.description} aria-label={`${reward.name} description`} /></td>
                    <td>
                      <div className="buttonRow">
                      <button form={`reward-${reward.id}`} className="btn" type="submit">Save</button>
                      <form action={deleteReward}>
                        <input type="hidden" name="id" value={reward.id} />
                        <button className="btn danger" type="submit">{reward.active ? "Deactivate" : "Remove"}</button>
                      </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panelTitle"><h2>Add reward</h2></div>
          <form action={saveReward} className="formGrid">
            <label className="field">Name<input name="name" required /></label>
            <label className="field">Point cost<input name="cost" type="number" min="1" defaultValue="10" required /></label>
            <label className="checkRow"><input name="active" type="checkbox" defaultChecked /> Active</label>
            <label className="field">Description<textarea name="description" /></label>
            <button className="btn" type="submit">Save Reward</button>
          </form>
        </div>
      </section>
    </>
  );
}
