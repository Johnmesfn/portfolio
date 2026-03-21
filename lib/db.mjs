// Use the HTTP/web client — works in ALL serverless environments
import { createClient } from "@libsql/client/web";

let db;

export function getDB() {
  if (!db) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url || !authToken) {
      throw new Error(
        "Missing database config. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables.",
      );
    }

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
  return {
    lastInsertRowid: result.lastInsertRowid,
    changes: result.rowsAffected,
  };
}

export async function get(sql, args = []) {
  const rows = await query(sql, args);
  return rows[0] || null;
}

export async function initSchema() {
  const tables = [
    // Profile — each column on its own line, no trailing comma issues
    `CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY DEFAULT 1,
      name TEXT DEFAULT '',
      title TEXT DEFAULT '',
      about_text TEXT DEFAULT '',
      avatar_url TEXT DEFAULT './assets/images/my-avatar.png',
      "availability" TEXT DEFAULT 'available'
    )`,
    `CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT, value TEXT, icon TEXT,
      sort_order INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS social_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT, url TEXT, icon TEXT,
      sort_order INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS typing_texts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT, sort_order INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT, value INTEGER, suffix TEXT, icon TEXT,
      reveal TEXT DEFAULT 'bottom',
      sort_order INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT, description TEXT, icon TEXT,
      reveal TEXT DEFAULT 'left',
      sort_order INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS tech_stack (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT, icon TEXT,
      sort_order INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT, meta TEXT,
      icon TEXT DEFAULT 'business-outline',
      section TEXT DEFAULT 'experience',
      is_single INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER,
      title TEXT, date_range TEXT, description TEXT,
      tags TEXT DEFAULT '[]',
      sort_order INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT, percentage INTEGER,
      sort_order INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT, category TEXT, image_url TEXT,
      description TEXT DEFAULT '', link TEXT DEFAULT '#',
      sort_order INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS certificates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT, issuer TEXT, credential_id TEXT,
      issue_date TEXT,
      expiry TEXT DEFAULT 'No Expiration',
      verify_url TEXT DEFAULT '#',
      status TEXT DEFAULT 'Verified',
      icon TEXT DEFAULT 'ribbon-outline',
      sort_order INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS testimonials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT, avatar_url TEXT, text TEXT,
      sort_order INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE, password_hash TEXT
    )`,
  ];

  for (const sql of tables) {
    try {
      await getDB().execute(sql);
    } catch (err) {
      console.error("[DB] Failed to execute:", sql.substring(0, 60) + "...");
      console.error("[DB] Error:", err.message);
      throw err;
    }
  }

  // Add availability column if profile table already exists without it
  try {
    await getDB().execute(
      `ALTER TABLE profile ADD COLUMN "availability" TEXT DEFAULT 'available'`,
    );
    console.log("[DB] Added availability column to profile");
  } catch {
    // Column already exists — this is fine
  }

  console.log("[DB] Schema initialized");
}