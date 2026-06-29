import { getDB } from "./db.mjs";
import { config } from "dotenv";
config();

async function reset() {
    console.log("🗑️ Wiping database...");
    const db = getDB();
    await db.execute({ sql: "PRAGMA foreign_keys = OFF", args: [] });

    const tables = ["profile", "contacts", "social_links", "typing_texts", "stats", "services", "tech_stack", "companies", "roles", "skills", "projects", "certificates", "testimonials", "admin_users"];
    const dropStatements = tables.map(t => ({ sql: `DROP TABLE IF EXISTS "${t}"`, args: [] }));

    await db.batch(dropStatements);
    console.log("✅ All tables dropped. Database is completely empty.");
}

reset().catch((err) => { console.error("❌ Reset failed:", err.message); process.exit(1); });