import { all } from "@/lib/db";
import { savePointCategory } from "@/lib/actions";
import SaveToast from "@/components/SaveToast";

export const dynamic = "force-dynamic";

export default async function PointRulesPage({ searchParams }) {
  const query = await searchParams;
  const categories = await all("SELECT * FROM point_categories ORDER BY sort_order, label");

  return (
    <>
      <SaveToast show={query?.saved === "1"} />
      <section className="pageHeader">
        <div>
          <h1>Point rules</h1>
          <p>Configure which actions can earn points and how many points each action is worth.</p>
          <p className="muted">Changes apply to newly awarded points. Existing awards keep their recorded values.</p>
        </div>
      </section>

      <section className="panel">
        <div className="tableWrap">
          <table>
            <thead><tr><th>Category</th><th>Points</th><th>Enabled</th><th></th></tr></thead>
            <tbody>
              {categories.map((category) => category.category_key === "participation" ? (
                <tr key={category.id}>
                  <td>Participation <small className="muted">Historical awards</small></td>
                  <td>Original values preserved</td>
                  <td>Archived</td>
                  <td></td>
                </tr>
              ) : (
                <tr key={category.id}>
                  <td>
                    <form id={`category-${category.id}`} action={savePointCategory} className="formGrid">
                      <input type="hidden" name="id" value={category.id} />
                      <input name="label" defaultValue={category.label} required />
                    </form>
                    <small className="muted">{category.category_key}</small>
                  </td>
                  <td><input form={`category-${category.id}`} name="points" type="number" min="0" defaultValue={category.points} /></td>
                  <td>
                    <label className="checkRow">
                      <input form={`category-${category.id}`} name="enabled" type="checkbox" defaultChecked={Boolean(category.enabled)} />
                      Active
                    </label>
                  </td>
                  <td><button form={`category-${category.id}`} className="btn" type="submit">Save</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
