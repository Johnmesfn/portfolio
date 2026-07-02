// lib/db.mjs
import { createClient } from "@libsql/client/web";
import { createHash } from "crypto";

let db;

export function getDB() {
  if (!db) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || !authToken) throw new Error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN");
    db = createClient({ url, authToken });
    console.log("[DB] Connected to Turso:", url.substring(0, 30) + "...");
  }
  return db;
}

export async function query(sql, args = []) {
  const result = await getDB().execute({ sql, args });
  return result.rows;
}

export async function run(sql, args = []) {
  const result = await getDB().execute({ sql, args });
  return { lastInsertRowid: result.lastInsertRowid, changes: result.rowsAffected };
}

export async function get(sql, args = []) {
  const rows = await query(sql, args);
  return rows[0] || null;
}

export async function batch(statements) {
  return await getDB().batch(statements);
}

export async function updateLastUpdated() {
  await run(
    `INSERT INTO site_meta (id, last_updated) VALUES (1, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET last_updated = datetime('now')`
  );
}

export async function getLastUpdated() {
  const row = await get("SELECT last_updated FROM site_meta WHERE id = 1");
  return row?.last_updated || null;
}

// ═══ NEW: CONTACT FORM & ANALYTICS HELPERS ═══

export function hashIP(ip) {
  if (!ip) return "unknown";
  return createHash("sha256").update(ip + "portfolio-salt-2026").digest("hex").substring(0, 16);
}

export async function checkRateLimit(ipHash, table, minutes = 5) {
  const recent = await get(
    `SELECT COUNT(*) as count FROM ${table} 
     WHERE ip_hash = ? AND created_at > datetime('now', '-' || ? || ' minutes')`,
    [ipHash, minutes]
  );
  return (recent?.count || 0) > 0;
}

export async function saveMessage(name, email, message, ipHash) {
  const result = await run(
    `INSERT INTO messages (name, email, message, ip_hash) VALUES (?, ?, ?, ?)`,
    [name, email, message, ipHash]
  );
  await updateLastUpdated();
  return Number(result.lastInsertRowid);
}

export async function getMessages() {
  return await query(`SELECT * FROM messages ORDER BY created_at DESC`);
}

export async function getMessage(id) {
  return await get(`SELECT * FROM messages WHERE id = ?`, [id]);
}

export async function markMessageRead(id) {
  await run(`UPDATE messages SET is_read = 1 WHERE id = ?`, [id]);
}

export async function markAllMessagesRead() {
  await run(`UPDATE messages SET is_read = 1 WHERE is_read = 0`);
}

export async function deleteMessage(id) {
  await run(`DELETE FROM messages WHERE id = ?`, [id]);
}

export async function getUnreadCount() {
  const row = await get(`SELECT COUNT(*) as count FROM messages WHERE is_read = 0`);
  return row?.count || 0;
}

export async function logAnalytics(eventType, page = null, ipHash = "unknown") {
  await run(
    `INSERT INTO analytics_events (event_type, page, ip_hash) VALUES (?, ?, ?)`,
    [eventType, page, ipHash]
  );
}

export async function getAnalytics() {
  const [totalViews, todayViews, weekViews, monthViews, cvDownloads, messages, pageBreakdown, dailyViews] = await Promise.all([
    get(`SELECT COUNT(*) as count FROM analytics_events WHERE event_type = 'page_view'`),
    get(`SELECT COUNT(*) as count FROM analytics_events WHERE event_type = 'page_view' AND date(created_at) = date('now')`),
    get(`SELECT COUNT(*) as count FROM analytics_events WHERE event_type = 'page_view' AND created_at > datetime('now', '-7 days')`),
    get(`SELECT COUNT(*) as count FROM analytics_events WHERE event_type = 'page_view' AND created_at > datetime('now', '-30 days')`),
    get(`SELECT COUNT(*) as count FROM analytics_events WHERE event_type = 'cv_download'`),
    get(`SELECT COUNT(*) as count FROM messages`),
    query(`SELECT page, COUNT(*) as count FROM analytics_events WHERE event_type = 'page_view' AND page IS NOT NULL GROUP BY page ORDER BY count DESC`),
    query(`SELECT date(created_at) as day, COUNT(*) as count FROM analytics_events WHERE event_type = 'page_view' AND created_at > datetime('now', '-7 days') GROUP BY date(created_at) ORDER BY day ASC`),
  ]);

  return {
    views: {
      total: totalViews?.count || 0,
      today: todayViews?.count || 0,
      week: weekViews?.count || 0,
      month: monthViews?.count || 0,
    },
    cvDownloads: cvDownloads?.count || 0,
    messages: messages?.count || 0,
    pageBreakdown,
    dailyViews,
  };
}

export async function initSchema() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS profile (id INTEGER PRIMARY KEY DEFAULT 1, name TEXT DEFAULT '', title TEXT DEFAULT '', about_text TEXT DEFAULT '', avatar_url TEXT DEFAULT './assets/images/my-avatar.png', "availability" TEXT DEFAULT 'available')`,
    `CREATE TABLE IF NOT EXISTS contacts (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, value TEXT, icon TEXT, sort_order INTEGER DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS social_links (id INTEGER PRIMARY KEY AUTOINCREMENT, platform TEXT, url TEXT, icon TEXT, sort_order INTEGER DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS typing_texts (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT, sort_order INTEGER DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS stats (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT, value INTEGER, suffix TEXT, icon TEXT, reveal TEXT DEFAULT 'bottom', sort_order INTEGER DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS services (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, icon TEXT, reveal TEXT DEFAULT 'left', sort_order INTEGER DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS tech_stack (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, icon TEXT, sort_order INTEGER DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS companies (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, meta TEXT, icon TEXT DEFAULT 'business-outline', section TEXT DEFAULT 'experience', is_single INTEGER DEFAULT 0, sort_order INTEGER DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER, title TEXT, date_range TEXT, description TEXT, tags TEXT DEFAULT '[]', sort_order INTEGER DEFAULT 0, FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS skills (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, percentage INTEGER, sort_order INTEGER DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, category TEXT, image_url TEXT, description TEXT DEFAULT '', link TEXT DEFAULT '#', sort_order INTEGER DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS certificates (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, issuer TEXT, credential_id TEXT, issue_date TEXT, expiry TEXT DEFAULT 'No Expiration', verify_url TEXT DEFAULT '#', status TEXT DEFAULT 'Verified', icon TEXT DEFAULT 'ribbon-outline', sort_order INTEGER DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS testimonials (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, avatar_url TEXT, text TEXT, sort_order INTEGER DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS admin_users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password_hash TEXT)`,
    `CREATE TABLE IF NOT EXISTS site_meta (id INTEGER PRIMARY KEY DEFAULT 1, last_updated TEXT DEFAULT (datetime('now')))`,
    // ═══ NEW TABLES ═══
    `CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL, message TEXT NOT NULL, created_at DATETIME DEFAULT (datetime('now')), is_read INTEGER DEFAULT 0, ip_hash TEXT)`,
    `CREATE TABLE IF NOT EXISTS analytics_events (id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL, page TEXT, created_at DATETIME DEFAULT (datetime('now')), ip_hash TEXT)`,
  ];

  try {
    const statements = tables.map(sql => ({ sql, args: [] }));
    await getDB().batch(statements);
  } catch (err) {
    console.error("[DB] Schema init failed:", err.message);
    throw err;
  }

  try {
    await getDB().execute({ sql: `ALTER TABLE profile ADD COLUMN "availability" TEXT DEFAULT 'available'`, args: [] });
  } catch { /* Column already exists */ }

  console.log("[DB] Schema initialized");
}