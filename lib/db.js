import fs from "node:fs";
import path from "node:path";
import { approvedCategories, planSessionAwards } from "./point-scoring.js";

const isPostgres = Boolean(process.env.DATABASE_URL);
const defaultCategories = approvedCategories;

let sqliteDb;
let pgSql;
let initPromise;

function toPostgresSql(sqlText) {
  let index = 0;
  return sqlText.replace(/\?/g, () => `$${++index}`);
}

function rowId(row) {
  return Number(row?.id || row?.last_insert_rowid || row?.lastInsertRowid || 0);
}

async function initSqlite() {
  const { default: Database } = await import("better-sqlite3");
  const dataDir = path.join(process.cwd(), "data");
  const dbPath = process.env.SQLITE_PATH || path.join(dataDir, "rock-youth.db");

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  sqliteDb = new Database(dbPath);
  sqliteDb.pragma("journal_mode = WAL");
  sqliteDb.pragma("foreign_keys = ON");

  sqliteDb.exec(`
CREATE TABLE IF NOT EXISTS attendees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  grade TEXT NOT NULL DEFAULT '',
  birth_date TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Leader',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS point_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cost INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_date TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS session_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  attendee_id INTEGER NOT NULL,
  category_key TEXT NOT NULL,
  points INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, attendee_id, category_key),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (attendee_id) REFERENCES attendees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS point_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attendee_id INTEGER NOT NULL,
  entry_type TEXT NOT NULL,
  points INTEGER NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_id INTEGER,
  occurred_on TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (attendee_id) REFERENCES attendees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reward_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reward_id INTEGER NOT NULL,
  attendee_id INTEGER NOT NULL,
  points_spent INTEGER NOT NULL,
  ledger_id INTEGER,
  redeemed_on TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE RESTRICT,
  FOREIGN KEY (attendee_id) REFERENCES attendees(id) ON DELETE CASCADE,
  FOREIGN KEY (ledger_id) REFERENCES point_ledger(id) ON DELETE SET NULL
);
`);

  const migrateColumn = (table, column, definition) => {
    const columns = sqliteDb.prepare(`PRAGMA table_info(${table})`).all();
    if (columns.some((existing) => existing.name === column)) return;
    sqliteDb.prepare(`ALTER TABLE ${table} ADD COLUMN ${definition}`).run();
  };

  migrateColumn("attendees", "birth_date", "birth_date TEXT NOT NULL DEFAULT ''");
  migrateColumn("attendees", "grade", "grade TEXT NOT NULL DEFAULT ''");
  migrateColumn("sessions", "deleted_at", "deleted_at TEXT NOT NULL DEFAULT ''");
  migrateColumn("point_ledger", "category_key", "category_key TEXT NOT NULL DEFAULT ''");

  sqliteDb.exec(`
CREATE INDEX IF NOT EXISTS idx_attendees_status_name
  ON attendees(status, last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_sessions_deleted_date_id
  ON sessions(deleted_at, session_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_session_points_session_attendee
  ON session_points(session_id, attendee_id);
CREATE INDEX IF NOT EXISTS idx_session_points_attendee_category
  ON session_points(attendee_id, category_key);
CREATE INDEX IF NOT EXISTS idx_point_ledger_attendee
  ON point_ledger(attendee_id);
CREATE INDEX IF NOT EXISTS idx_point_ledger_source
  ON point_ledger(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_point_ledger_recent
  ON point_ledger(occurred_on DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_attendee_date
  ON reward_redemptions(attendee_id, redeemed_on DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_rewards_active_cost_name
  ON rewards(active, cost, name);
`);

  const seedCategory = sqliteDb.prepare(`
    INSERT OR IGNORE INTO point_categories (category_key, label, points, sort_order)
    VALUES (?, ?, ?, ?)
  `);
  for (const category of defaultCategories) seedCategory.run(...category);
}

async function initPostgres() {
  const { default: postgres } = await import("postgres");
  pgSql = postgres(process.env.DATABASE_URL, {
    max: 5,
    onnotice: () => {},
    ssl: process.env.PGSSL === "disable" ? false : "require"
  });

  await pgSql`
CREATE TABLE IF NOT EXISTS attendees (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  grade TEXT NOT NULL DEFAULT '',
  birth_date TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

  await pgSql`
CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Leader',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

  await pgSql`
CREATE TABLE IF NOT EXISTS point_categories (
  id SERIAL PRIMARY KEY,
  category_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

  await pgSql`
CREATE TABLE IF NOT EXISTS rewards (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cost INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

  await pgSql`
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  session_date TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT NOT NULL DEFAULT ''
)`;

  await pgSql`
CREATE TABLE IF NOT EXISTS session_points (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  attendee_id INTEGER NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
  category_key TEXT NOT NULL,
  points INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, attendee_id, category_key)
)`;

  await pgSql`
CREATE TABLE IF NOT EXISTS point_ledger (
  id SERIAL PRIMARY KEY,
  attendee_id INTEGER NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL,
  points INTEGER NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_id INTEGER,
  occurred_on TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

  await pgSql`
CREATE TABLE IF NOT EXISTS reward_redemptions (
  id SERIAL PRIMARY KEY,
  reward_id INTEGER NOT NULL REFERENCES rewards(id) ON DELETE RESTRICT,
  attendee_id INTEGER NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
  points_spent INTEGER NOT NULL,
  ledger_id INTEGER REFERENCES point_ledger(id) ON DELETE SET NULL,
  redeemed_on TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

  await pgSql`ALTER TABLE attendees ADD COLUMN IF NOT EXISTS birth_date TEXT NOT NULL DEFAULT ''`;
  await pgSql`ALTER TABLE attendees ADD COLUMN IF NOT EXISTS grade TEXT NOT NULL DEFAULT ''`;
  await pgSql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS deleted_at TEXT NOT NULL DEFAULT ''`;
  await pgSql`ALTER TABLE point_ledger ADD COLUMN IF NOT EXISTS category_key TEXT NOT NULL DEFAULT ''`;

  await pgSql`CREATE INDEX IF NOT EXISTS idx_attendees_status_name ON attendees(status, last_name, first_name)`;
  await pgSql`CREATE INDEX IF NOT EXISTS idx_sessions_deleted_date_id ON sessions(deleted_at, session_date DESC, id DESC)`;
  await pgSql`CREATE INDEX IF NOT EXISTS idx_session_points_session_attendee ON session_points(session_id, attendee_id)`;
  await pgSql`CREATE INDEX IF NOT EXISTS idx_session_points_attendee_category ON session_points(attendee_id, category_key)`;
  await pgSql`CREATE INDEX IF NOT EXISTS idx_point_ledger_attendee ON point_ledger(attendee_id)`;
  await pgSql`CREATE INDEX IF NOT EXISTS idx_point_ledger_source ON point_ledger(source_type, source_id)`;
  await pgSql`CREATE INDEX IF NOT EXISTS idx_point_ledger_recent ON point_ledger(occurred_on DESC, id DESC)`;
  await pgSql`CREATE INDEX IF NOT EXISTS idx_reward_redemptions_attendee_date ON reward_redemptions(attendee_id, redeemed_on DESC, id DESC)`;
  await pgSql`CREATE INDEX IF NOT EXISTS idx_rewards_active_cost_name ON rewards(active, cost, name)`;

  for (const [categoryKey, label, points, sortOrder] of defaultCategories) {
    await pgSql`
      INSERT INTO point_categories (category_key, label, points, sort_order)
      VALUES (${categoryKey}, ${label}, ${points}, ${sortOrder})
      ON CONFLICT (category_key) DO NOTHING
    `;
  }
}

export async function initDb() {
  if (!initPromise) {
    initPromise = isPostgres ? initPostgres() : initSqlite();
  }
  await initPromise;
}

export async function getDb() {
  await initDb();
  return isPostgres ? pgSql : sqliteDb;
}

export async function all(sqlText, params = []) {
  await initDb();
  if (isPostgres) {
    return pgSql.unsafe(toPostgresSql(sqlText), params);
  }
  return sqliteDb.prepare(sqlText).all(...params);
}

export async function get(sqlText, params = []) {
  await initDb();
  if (isPostgres) {
    const rows = await pgSql.unsafe(toPostgresSql(sqlText), params);
    return rows[0];
  }
  return sqliteDb.prepare(sqlText).get(...params);
}

export async function run(sqlText, params = []) {
  await initDb();
  if (isPostgres) {
    return pgSql.unsafe(toPostgresSql(sqlText), params);
  }
  return sqliteDb.prepare(sqlText).run(...params);
}

export async function saveSessionAwards(sessionId, selected) {
  await initDb();
  if (isPostgres) {
    return pgSql.begin(async tx => {
      const [session] = await tx`SELECT * FROM sessions WHERE id = ${sessionId} AND deleted_at = '' FOR UPDATE`;
      if (!session) return false;
      const categories = await tx`SELECT * FROM point_categories ORDER BY sort_order`;
      const attendees = await tx`SELECT id, status FROM attendees`;
      const actions = await tx`SELECT * FROM session_points WHERE session_id = ${sessionId}`;
      const ledger = await tx`SELECT * FROM point_ledger WHERE source_type = 'session' AND source_id = ${sessionId}`;
      for (const [sqlText, params] of planSessionAwards({ session, categories, attendees, actions, ledger }, selected)) {
        await tx.unsafe(toPostgresSql(sqlText), params);
      }
      return true;
    });
  }
  return sqliteDb.transaction(() => {
    const session = sqliteDb.prepare("SELECT * FROM sessions WHERE id = ? AND deleted_at = ''").get(sessionId);
    if (!session) return false;
    const categories = sqliteDb.prepare("SELECT * FROM point_categories ORDER BY sort_order").all();
    const attendees = sqliteDb.prepare("SELECT id, status FROM attendees").all();
    const actions = sqliteDb.prepare("SELECT * FROM session_points WHERE session_id = ?").all(sessionId);
    const ledger = sqliteDb.prepare("SELECT * FROM point_ledger WHERE source_type = 'session' AND source_id = ?").all(sessionId);
    for (const [sqlText, params] of planSessionAwards({ session, categories, attendees, actions, ledger }, selected)) {
      sqliteDb.prepare(sqlText).run(...params);
    }
    return true;
  })();
}

export function attendeeName(row) {
  return `${row.first_name} ${row.last_name}`.trim();
}

export async function getAttendeeBalances() {
  return all(`
    SELECT
      a.*,
      COALESCE(SUM(l.points), 0) AS balance,
      COALESCE(SUM(CASE WHEN l.points > 0 THEN l.points ELSE 0 END), 0) AS earned,
      ABS(COALESCE(SUM(CASE WHEN l.points < 0 THEN l.points ELSE 0 END), 0)) AS spent
    FROM attendees a
    LEFT JOIN point_ledger l
      ON l.attendee_id = a.id
      AND (
        l.source_type != 'session'
        OR EXISTS (
          SELECT 1 FROM sessions s
          WHERE s.id = l.source_id AND s.deleted_at = ''
        )
      )
    GROUP BY a.id
    ORDER BY a.status ASC, a.last_name ASC, a.first_name ASC
  `);
}

export async function getTopAttendeeBalances(limit = 5) {
  return all(`
    SELECT
      a.*,
      COALESCE(SUM(l.points), 0) AS balance,
      COALESCE(SUM(CASE WHEN l.points > 0 THEN l.points ELSE 0 END), 0) AS earned,
      ABS(COALESCE(SUM(CASE WHEN l.points < 0 THEN l.points ELSE 0 END), 0)) AS spent
    FROM attendees a
    LEFT JOIN point_ledger l
      ON l.attendee_id = a.id
      AND (
        l.source_type != 'session'
        OR EXISTS (
          SELECT 1 FROM sessions s
          WHERE s.id = l.source_id AND s.deleted_at = ''
        )
      )
    GROUP BY a.id
    ORDER BY balance DESC, a.last_name ASC, a.first_name ASC
    LIMIT ?
  `, [limit]);
}

export async function getBalance(attendeeId) {
  const row = await get(
    `
      SELECT COALESCE(SUM(points), 0) AS balance
      FROM point_ledger l
      WHERE l.attendee_id = ?
        AND (
          l.source_type != 'session'
          OR EXISTS (
            SELECT 1 FROM sessions s
            WHERE s.id = l.source_id AND s.deleted_at = ''
          )
        )
    `,
    [attendeeId]
  );
  return Number(row?.balance || 0);
}

export function insertedId(row) {
  return rowId(row);
}
