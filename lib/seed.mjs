import { query, run, batch, initSchema } from "./db.mjs";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
config();

async function seed() {
  console.log("🔧 Connecting to Turso...");
  await initSchema();
  console.log("✅ Tables created");

  const existing = await query("SELECT COUNT(*) as c FROM profile");
  if (existing[0]?.c > 0) { console.log("✅ Database already seeded. Skipping."); return; }

  console.log("🌱 Seeding database...");

  async function batchInsert(table, cols, rows) {
    const placeholders = cols.map(() => "?").join(",");
    const sql = `INSERT INTO ${table} (${cols.join(",")}) VALUES (${placeholders})`;
    const statements = rows.map(row => ({ sql, args: row }));
    await batch(statements);
  }

  await run(`INSERT INTO profile (id, name, title, about_text, avatar_url, availability) VALUES (1, ?, ?, ?, ?, ?)`,
    ["Yohannes Mesfin", "QA Automation Lead", "I'm a **QA Automation Lead** passionate about building reliable and scalable automation solutions.", "./assets/images/my-avatar.png", "available"]);

  const hash = bcrypt.hashSync("admin123", 12);
  await run("INSERT INTO admin_users (username, password_hash) VALUES (?, ?)", ["admin", hash]);

  await batchInsert("contacts", ["type", "value", "icon", "sort_order"], [
    ["Email", "mesfiny711@gmail.com", "mail-outline", 1],
    ["Phone", "+251 954 906 800", "phone-portrait-outline", 2],
    ["Location", "Addis Ababa, Ethiopia", "location-outline", 3]
  ]);

  await batchInsert("social_links", ["platform", "url", "icon", "sort_order"], [
    ["LinkedIn", "https://www.linkedin.com/in/yohannesmesfin", "logo-linkedin", 1],
    ["GitHub", "https://github.com/yohannesmesfin", "logo-github", 2]
  ]);

  await batchInsert("typing_texts", ["text", "sort_order"], [
    ["QA Automation Lead", 1], ["Python & Robot Framework", 2], ["CI/CD Pipeline Expert", 3]
  ]);

  await batchInsert("stats", ["label", "value", "suffix", "icon", "reveal", "sort_order"], [
    ["Testing Time Reduced", 40, "%", "speedometer-outline", "left", 1],
    ["Efficiency Improved", 30, "%", "bug-outline", "bottom", 2],
    ["Years Experience", 3, "+", "trending-up-outline", "right", 4]
  ]);

  await batchInsert("services", ["title", "description", "icon", "reveal", "sort_order"], [
    ["Test Automation", "Building scalable automation frameworks with Python and Robot Framework.", "code-slash-outline", "left", 1],
    ["CI/CD Integration", "Integrating automated tests into Jenkins CI/CD pipelines.", "git-branch-outline", "left", 2]
  ]);

  await batchInsert("tech_stack", ["name", "icon", "sort_order"], [
    ["Python", "logo-python", 1], ["Robot Framework", "hardware-chip-outline", 2], ["Jenkins", "server-outline", 3]
  ]);

  await batchInsert("companies", ["name", "meta", "icon", "section", "is_single", "sort_order"], [
    ["Safaricom Ethiopia", "Addis Ababa, Ethiopia", "business-outline", "experience", 0, 1],
    ["Bonga University", "Oct 2019 — Jul 2023", "school-outline", "education", 1, 1]
  ]);

  await batchInsert("roles", ["company_id", "title", "date_range", "description", "tags", "sort_order"], [
    [1, "QA Automation Lead", "Feb 2026 — Present", "Led end-to-end automated test framework.", '["Robot Framework","Python"]', 1],
    [2, "BSc Computer Science", "4 Years", "Comprehensive study of CS fundamentals.", "[]", 1]
  ]);

  await batchInsert("skills", ["name", "percentage", "sort_order"], [
    ["Python & Robot Framework", 95, 1], ["Test Automation & CI/CD", 90, 2]
  ]);

  await batchInsert("projects", ["title", "category", "image_url", "description", "sort_order"], [
    ["M-PESA USSD Test Automation", "fintech", "./assets/images/project-1.jpg", "FinTech — Safaricom Ethiopia", 1]
  ]);

  await batchInsert("certificates", ["title", "issuer", "credential_id", "issue_date", "expiry", "verify_url", "status", "icon", "sort_order"], [
    ["Certified Associate in Scrum Fundamentals™", "International Scrum Institute", "CASF-78432-YM", "January 2025", "No Expiration", "#", "Verified", "ribbon-outline", 1]
  ]);

  await batchInsert("testimonials", ["name", "avatar_url", "text", "sort_order"], [
    ["Safaricom Team Lead", "./assets/images/avatar-1.png", "Yohannes transformed our testing process entirely.", 1]
  ]);

  console.log("✅ Database seeded successfully! (Admin: admin / admin123)");
}

seed().catch((err) => { console.error("❌ Seed failed:", err.message); process.exit(1); });