import Link from "next/link";
import { all, get, getTopAttendeeBalances, attendeeName } from "@/lib/db";
import { fmtDate, points } from "@/lib/format";

export const dynamic = "force-dynamic";

function signedPoints(value) {
  const amount = Number(value || 0);
  return `${amount >= 0 ? "+" : ""}${amount.toLocaleString()} pts`;
}

export default async function DashboardPage() {
  const stats = await get(`
    SELECT
      (SELECT COUNT(*) FROM attendees WHERE status = 'active') AS active_attendees,
      (SELECT COUNT(*) FROM attendees) AS total_attendees,
      (SELECT COUNT(*) FROM sessions WHERE deleted_at = '') AS sessions,
      (
        SELECT COALESCE(SUM(CASE WHEN l.points > 0 THEN l.points ELSE 0 END), 0)
        FROM point_ledger l
        WHERE l.source_type != 'session'
          OR EXISTS (
            SELECT 1 FROM sessions s
            WHERE s.id = l.source_id AND s.deleted_at = ''
          )
      ) AS points_earned,
      (SELECT COUNT(*) FROM reward_redemptions) AS redemptions
  `);
  const topBalances = await getTopAttendeeBalances(5);
  const categoryRows = await all(`
    SELECT pc.label, pc.category_key, COALESCE(SUM(sp.points), 0) AS total, COUNT(sp.id) AS count
    FROM point_categories pc
    LEFT JOIN session_points sp
      ON sp.category_key = pc.category_key
      AND EXISTS (
        SELECT 1 FROM sessions s
        WHERE s.id = sp.session_id AND s.deleted_at = ''
      )
    GROUP BY pc.id, pc.label, pc.category_key, pc.sort_order
    ORDER BY total DESC, pc.sort_order ASC
    LIMIT 6
  `);
  const recentLedger = await all(`
    SELECT l.*, a.first_name, a.last_name
    FROM point_ledger l
    JOIN attendees a ON a.id = l.attendee_id
    WHERE l.source_type != 'session'
      OR EXISTS (
        SELECT 1 FROM sessions s
        WHERE s.id = l.source_id AND s.deleted_at = ''
      )
    ORDER BY l.occurred_on DESC, l.id DESC
    LIMIT 6
  `);
  const recentSessions = await all("SELECT * FROM sessions WHERE deleted_at = '' ORDER BY session_date DESC, id DESC LIMIT 3");
  const leader = topBalances[0];
  const topCategory = categoryRows[0];
  const activeRate = stats.total_attendees ? Math.round((stats.active_attendees / stats.total_attendees) * 100) : 0;

  return (
    <div className="scorecardPage">
      <section className="scoreHero">
        <div>
          <div className="scoreKicker">
            <span>Rock Youth</span>
            <i aria-hidden="true" />
          </div>
          <h1>Scorecard</h1>
          <div className="scoreHeroStats">
            <div><span>Points</span><strong>{points(stats.points_earned)}</strong></div>
            <div><span>Sessions</span><strong>{stats.sessions}</strong></div>
            <div><span>Active</span><strong>{stats.active_attendees}</strong></div>
            <div><span>Redeemed</span><strong>{stats.redemptions}</strong></div>
          </div>
        </div>
        <div className="heroRings" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>

      <section className="scoreInsight cyan">
        <div className="scoreVisual trophyVisual" aria-hidden="true">
          <span />
        </div>
        <div className="scoreBody">
          <div className="scoreTitle">
            <h2>Point leaders</h2>
          </div>
          <div className="scoreSplit">
            <div className="megaMetric">
              <strong>{leader ? signedPoints(leader.balance) : "+0 pts"}</strong>
              <span>{leader ? attendeeName(leader) : "No leader yet"}</span>
            </div>
            <div className="movementList">
              {topBalances.map((attendee, index) => (
                <div key={attendee.id}>
                  <span>{index + 1}. {attendeeName(attendee)}</span>
                  <strong>{points(attendee.balance)}</strong>
                </div>
              ))}
              {!topBalances.length && <p className="empty dark">Add youth attendees to begin tracking momentum.</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="scoreInsight cyan deep rewardStatus">
        <div className="scoreBody">
          <div className="scoreTitle">
            <h2>Reward status</h2>
          </div>
          <div className="rewardMetricGrid">
            <div className="rewardMetric primary">
              <span>Points earned</span>
              <strong>{points(stats.points_earned)}</strong>
              <small>{stats.sessions} sessions</small>
            </div>
            <div className="rewardMetric">
              <span>Redemptions</span>
              <strong>{stats.redemptions}</strong>
              <small>Rewards claimed</small>
            </div>
            <div className="rewardMetric">
              <span>Active roster</span>
              <strong>{activeRate}%</strong>
              <small>{stats.active_attendees} / {stats.total_attendees} active</small>
            </div>
            <div className="rewardMetric accent">
              <span>Top category</span>
              <strong>{topCategory?.label || "None"}</strong>
              <small>{topCategory ? signedPoints(topCategory.total) : "+0 pts"}</small>
            </div>
          </div>
        </div>
      </section>

      <section className="scoreInsight magenta categoryTotals">
        <div className="scoreBody">
          <div className="scoreTitle">
            <h2>Category totals</h2>
          </div>
          <div className="dualMovement">
            <div className="movementList">
              {categoryRows.slice(0, 3).map((category) => (
                <div key={category.category_key}>
                  <span>{category.label}</span>
                  <strong>{signedPoints(category.total)}</strong>
                </div>
              ))}
            </div>
            <div className="movementList pink">
              {categoryRows.slice(3, 6).map((category) => (
                <div key={category.category_key}>
                  <span>{category.label}</span>
                  <strong>{points(category.total)}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="scoreFooterGrid">
        <div className="panel neonPanel">
          <div className="panelTitle">
            <h2>Latest point activity</h2>
            <Link className="pill" href="/ledger">Open ledger</Link>
          </div>
          <div className="timeline">
            {recentLedger.map((entry) => (
              <div className="timelineItem" key={entry.id}>
                <strong>{attendeeName(entry)}</strong>
                <div>{entry.description}</div>
                <small className="muted">{fmtDate(entry.occurred_on)} - {points(entry.points)}</small>
              </div>
            ))}
            {!recentLedger.length && <p className="empty dark">No point activity yet.</p>}
          </div>
        </div>
        <div className="panel neonPanel">
          <div className="panelTitle">
            <h2>Recent sessions</h2>
            <Link className="pill" href="/sessions">Record session</Link>
          </div>
          <div className="compactSessionList">
            {recentSessions.map((session) => (
              <Link href={`/sessions/${session.id}`} key={session.id}>
                <span>{fmtDate(session.session_date)}</span>
                <strong>{session.title || "Youth group session"}</strong>
                <small>{session.notes || "Open score sheet"}</small>
              </Link>
            ))}
            {!recentSessions.length && <p className="empty dark">No sessions yet.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
