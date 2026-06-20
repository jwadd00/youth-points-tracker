import assert from "node:assert/strict";
import fs from "node:fs";

function loadEnvLocal() {
  if (!fs.existsSync(".env.local")) return;

  const lines = fs.readFileSync(".env.local", "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator);
    const value = trimmed.slice(separator + 1);
    process.env[key] ||= value;
  }
}

loadEnvLocal();

assert.ok(process.env.DATABASE_URL, "DATABASE_URL must be set in .env.local");

const { all, getDb, initDb } = await import("../lib/db.js");

await initDb();

const categoryCount = (await all("SELECT COUNT(*) AS count FROM point_categories"))[0].count;
assert.ok(Number(categoryCount) >= 8, "default point categories should be seeded in Neon");

await all(`
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

const sql = await getDb();
await sql.end({ timeout: 5 });

console.log("Neon connection and schema check passed");
