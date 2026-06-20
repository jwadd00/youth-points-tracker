import { all } from "@/lib/db";
import { deleteAdminUser, saveAdminUser } from "@/lib/actions";
import SaveToast from "@/components/SaveToast";

export const dynamic = "force-dynamic";

export default async function UsersPage({ searchParams }) {
  const query = await searchParams;
  const users = await all("SELECT * FROM admin_users ORDER BY status ASC, name ASC");

  return (
    <>
      <SaveToast show={query?.saved === "1"} />
      <section className="pageHeader">
        <div>
          <h1>User admin</h1>
          <p>Track leader and admin display records. V1 intentionally has no authentication accounts.</p>
        </div>
      </section>

      <section className="grid two">
        <div className="panel">
          <div className="panelTitle"><h2>Leaders</h2></div>
          <div className="tableWrap">
            <table>
              <thead><tr><th>Name</th><th>Role</th><th>Contact</th><th>Status</th><th>Notes</th><th></th></tr></thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <form id={`user-${user.id}`} action={saveAdminUser}>
                        <input type="hidden" name="id" value={user.id} />
                        <input name="name" defaultValue={user.name} aria-label={`${user.name} name`} />
                      </form>
                    </td>
                    <td><input form={`user-${user.id}`} name="role" defaultValue={user.role} aria-label={`${user.name} role`} /></td>
                    <td>
                      <input form={`user-${user.id}`} name="email" type="email" defaultValue={user.email} aria-label={`${user.name} email`} />
                      <input form={`user-${user.id}`} name="phone" defaultValue={user.phone} aria-label={`${user.name} phone`} />
                    </td>
                    <td>
                      <select form={`user-${user.id}`} name="status" defaultValue={user.status} aria-label={`${user.name} status`}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </td>
                    <td><textarea form={`user-${user.id}`} name="notes" defaultValue={user.notes} aria-label={`${user.name} notes`} /></td>
                    <td>
                      <div className="buttonRow">
                      <button form={`user-${user.id}`} className="btn" type="submit">Save</button>
                      <form action={deleteAdminUser}>
                        <input type="hidden" name="id" value={user.id} />
                        <button className="btn danger" type="submit">Remove</button>
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
          <div className="panelTitle"><h2>Add leader</h2></div>
          <form action={saveAdminUser} className="formGrid two">
            <label className="field full">Name<input name="name" required /></label>
            <label className="field">Role<input name="role" defaultValue="Leader" /></label>
            <label className="field">
              Status
              <select name="status" defaultValue="active">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="field">Email<input name="email" type="email" /></label>
            <label className="field">Phone<input name="phone" /></label>
            <label className="field full">Notes<textarea name="notes" /></label>
            <div className="field full"><button className="btn" type="submit">Save User</button></div>
          </form>
        </div>
      </section>
    </>
  );
}
