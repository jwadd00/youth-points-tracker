// Read-only snapshot: intentionally bypasses lib/db.js and its schema/seed writes.
import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';

const output = path.resolve('out/points-simulation');
fs.mkdirSync(output, { recursive: true });
if (!process.env.DATABASE_URL) throw new Error('Load the configured DATABASE_URL with --env-file=.env.local');
const sql = postgres(process.env.DATABASE_URL, {
  max: 1, connect_timeout: 15, idle_timeout: 5,
  ssl: process.env.PGSSL === 'disable' ? false : 'require',
  onnotice: () => {}
});
try {
  const snapshot = await sql.begin('isolation level repeatable read read only', async tx => {
    await tx`SET LOCAL statement_timeout = '20000'`;
    return {
      retrievedAt: new Date().toISOString(), source: 'Configured PostgreSQL database',
      attendees: await tx`SELECT id, first_name, last_name, status, created_at FROM attendees ORDER BY first_name, last_name, id`,
      sessions: await tx`SELECT id, session_date, title, deleted_at FROM sessions ORDER BY session_date, id`,
      categories: await tx`SELECT category_key, label, points, enabled FROM point_categories ORDER BY sort_order`,
      actions: await tx`SELECT session_id, attendee_id, category_key, points FROM session_points ORDER BY session_id, attendee_id, category_key`,
      balances: await tx`SELECT attendee_id, SUM(points) AS balance FROM point_ledger WHERE source_type != 'session' OR EXISTS (SELECT 1 FROM sessions s WHERE s.id = source_id AND s.deleted_at = '') GROUP BY attendee_id`
    };
  });
  fs.writeFileSync(path.join(output, 'source-snapshot.json'), JSON.stringify(snapshot, null, 2));
  console.log(JSON.stringify({ retrievedAt: snapshot.retrievedAt, attendees: snapshot.attendees.length,
    sessions: snapshot.sessions.length, actions: snapshot.actions.length, output }, null, 2));
} finally {
  await sql.end({ timeout: 5 });
}
