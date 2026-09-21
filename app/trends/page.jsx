import { all } from "@/lib/db";
import { buildSessionTrends } from "@/lib/reporting";
import SessionTrends from "@/components/SessionTrends";

export const dynamic = "force-dynamic";

export default async function TrendsPage() {
  const [sessions, categories, counts] = await Promise.all([
    all("SELECT id, session_date, title FROM sessions WHERE deleted_at = '' ORDER BY session_date, id"),
    all("SELECT category_key, label FROM point_categories ORDER BY sort_order, id"),
    all(`SELECT sp.session_id, sp.category_key, COUNT(DISTINCT sp.attendee_id) AS youth_count
      FROM session_points sp JOIN sessions s ON s.id = sp.session_id
      WHERE s.deleted_at = '' GROUP BY sp.session_id, sp.category_key`)
  ]);
  return <>
    <section className="pageHeader"><div><h1>Session trends</h1><p>See attendance and engagement across your meetings.</p></div></section>
    <SessionTrends sessions={buildSessionTrends(sessions, counts)} categories={categories} />
  </>;
}
