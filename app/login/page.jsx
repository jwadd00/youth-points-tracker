import { login } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const nextPath = typeof params?.next === "string" ? params.next : "/";
  const hasError = params?.error === "1";

  return (
    <main className="loginShell">
      <section className="loginPanel">
        <div>
          <p className="scoreKicker loginKicker"><span>Rock Youth</span></p>
          <h1>Enter password</h1>
          <p className="muted">Access is restricted before the tracker loads.</p>
        </div>

        <form action={login} className="formGrid">
          <input type="hidden" name="next" value={nextPath} />
          <label className="field">
            Password
            <input name="password" type="password" autoComplete="current-password" autoFocus required />
          </label>
          {hasError && <p className="formError">Incorrect password.</p>}
          <button className="btn wide" type="submit">Continue</button>
        </form>
      </section>
    </main>
  );
}
