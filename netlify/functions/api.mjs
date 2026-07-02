// netlify/functions/api.mjs
import { query, get, run, initSchema, updateLastUpdated, getLastUpdated, hashIP, checkRateLimit, saveMessage, getMessages, getMessage, markMessageRead, markAllMessagesRead, deleteMessage, getUnreadCount, logAnalytics, getAnalytics } from "../../lib/db.mjs";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const SECRET = process.env.JWT_SECRET;
if (!SECRET && process.env.NODE_ENV === "production") throw new Error("FATAL: JWT_SECRET missing in prod!");
const ACTIVE_SECRET = SECRET || "dev-secret-change-me";

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : ["http://localhost:3000", "http://localhost:5173"];

let schemaReady = false;
async function ensureSchema() {
  if (schemaReady) return;
  await initSchema();
  schemaReady = true;
}

function getClientIP(event) {
  return event.headers["x-nf-client-connection-ip"] ||
    event.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    event.headers["client-ip"] ||
    "unknown";
}

function getCorsHeaders(event) {
  const origin = event.headers.origin || event.headers.Origin;
  const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Content-Type": "application/json",
  };
}

function ok(data, event) { return { statusCode: 200, headers: getCorsHeaders(event), body: JSON.stringify(data) }; }
function bad(msg, code = 400, event) { return { statusCode: code, headers: getCorsHeaders(event), body: JSON.stringify({ error: msg }) }; }
function unauthorized(event) { return bad("Unauthorized", 401, event); }

function verifyAuth(headers) {
  const token = (headers["authorization"] || headers["Authorization"])?.split(" ")[1];
  if (!token) return null;
  try { return jwt.verify(token, ACTIVE_SECRET); } catch { return null; }
}

const TABLES = {
  contacts: ["type", "value", "icon", "sort_order"],
  social_links: ["platform", "url", "icon", "sort_order"],
  typing_texts: ["text", "sort_order"],
  stats: ["label", "value", "suffix", "icon", "reveal", "sort_order"],
  services: ["title", "description", "icon", "reveal", "sort_order"],
  tech_stack: ["name", "icon", "sort_order"],
  companies: ["name", "meta", "icon", "section", "is_single", "sort_order"],
  roles: ["company_id", "title", "date_range", "description", "tags", "sort_order"],
  skills: ["name", "percentage", "sort_order"],
  projects: ["title", "category", "image_url", "description", "link", "sort_order"],
  certificates: ["title", "issuer", "credential_id", "issue_date", "expiry", "verify_url", "status", "icon", "sort_order"],
  testimonials: ["name", "avatar_url", "text", "sort_order"],
};

async function handleCrud(table, method, id, body, user, event) {
  const fields = TABLES[table];
  if (!fields) return bad("Unknown resource", 404, event);
  if ((method === "PUT" || method === "DELETE") && !id) return bad("Missing resource ID", 400, event);

  if (method === "GET" && !id) return ok(await query(`SELECT * FROM ${table} ORDER BY sort_order, id`), event);
  if (method === "GET" && id) {
    const row = await get(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    return row ? ok(row, event) : bad("Not found", 404, event);
  }
  if (!user) return unauthorized(event);

  if (method === "POST") {
    const cols = fields.filter(f => body[f] !== undefined);
    const vals = cols.map(f => body[f]);
    if (!cols.length) return bad("No valid fields", 400, event);
    const result = await run(`INSERT INTO ${table} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`, vals);
    await updateLastUpdated();
    return ok({ id: Number(result.lastInsertRowid), ...body }, event);
  }
  if (method === "PUT" && id) {
    const cols = fields.filter(f => body[f] !== undefined);
    const vals = cols.map(f => body[f]);
    if (!cols.length) return bad("No valid fields", 400, event);
    await run(`UPDATE ${table} SET ${cols.map(f => `${f}=?`).join(",")} WHERE id=?`, [...vals, id]);
    await updateLastUpdated();
    return ok({ id: +id, ...body }, event);
  }
  if (method === "DELETE" && id) {
    await run(`DELETE FROM ${table} WHERE id=?`, [id]);
    await updateLastUpdated();
    return ok({ deleted: true }, event);
  }
  return bad("Method not allowed", 405, event);
}

async function handleUpload(body, event) {
  const { image } = body;
  if (!image) return bad("No image data", 400, event);
  if (typeof image === 'string' && image.length > 5 * 1024 * 1024) return bad("Image too large (Max 5MB)", 413, event);

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return bad("Cloudinary not configured", 500, event);

  const timestamp = Math.floor(Date.now() / 1000);
  const { createHash } = await import("crypto");
  const signature = createHash("sha1").update(`folder=portfolio&timestamp=${timestamp}${apiSecret}`).digest("hex");

  const formData = new URLSearchParams();
  formData.append("file", image);
  formData.append("api_key", apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);
  formData.append("folder", "portfolio");

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: formData });
    const data = await res.json();
    if (data.secure_url) {
      await updateLastUpdated();
      return ok({ url: data.secure_url }, event);
    }
    return bad("Upload failed: " + (data.error?.message || "Unknown"), 500, event);
  } catch (err) {
    return bad("Cloudinary request failed: " + err.message, 500, event);
  }
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: getCorsHeaders(event), body: "" };

  const method = event.httpMethod;
  const rawPath = event.path || "";
  const cleanPath = rawPath.replace(/^\/?\.netlify\/functions\/api\/?/, "").replace(/^\/?(api)?\/?/, "").replace(/\/+$/, "");
  const segments = cleanPath.split("/").filter(Boolean);

  let body = {};
  if (event.body) { try { body = JSON.parse(event.body); } catch { /* not JSON */ } }

  try {
    await ensureSchema();
    const user = verifyAuth(event.headers);
    const clientIP = getClientIP(event);
    const ipHash = hashIP(clientIP);

    // ═══ AUTH ═══
    if (segments[0] === "auth") {
      if (segments[1] === "login" && method === "POST") {
        const { username, password } = body;
        if (!username || !password) return bad("Username and password required", 400, event);
        const u = await get("SELECT * FROM admin_users WHERE username = ?", [username]);
        if (!u || !bcrypt.compareSync(password, u.password_hash)) return bad("Invalid credentials", 401, event);
        const token = jwt.sign({ id: u.id, username: u.username }, ACTIVE_SECRET, { expiresIn: "24h" });
        return ok({ token, username: u.username }, event);
      }
      if (segments[1] === "change-password" && method === "POST") {
        if (!user) return unauthorized(event);
        const { current, newPassword } = body;
        const u = await get("SELECT * FROM admin_users WHERE id = ?", [user.id]);
        if (!u || !bcrypt.compareSync(current, u.password_hash)) return bad("Wrong password", 401, event);
        await run("UPDATE admin_users SET password_hash = ? WHERE id = ?", [bcrypt.hashSync(newPassword, 12), user.id]);
        await updateLastUpdated();
        return ok({ message: "Password changed" }, event);
      }
      return bad("Not found", 404, event);
    }

    // ═══ UPLOAD ═══
    if (segments[0] === "upload" && method === "POST") {
      if (!user) return unauthorized(event);
      return await handleUpload(body, event);
    }

    // ═══ PUBLIC: CONTACT FORM ═══
    if (segments[0] === "contact" && method === "POST") {
      const { name, email, message, website } = body; // website = honeypot

      // Honeypot: if 'website' field is filled, it's a bot
      if (website) return bad("Spam detected", 400, event);

      if (!name || !email || !message) return bad("All fields required", 400, event);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad("Invalid email", 400, event);
      if (message.length > 2000) return bad("Message too long (max 2000 chars)", 400, event);

      // Rate limit: 1 message per IP every 15 minutes
      const rateLimited = await checkRateLimit(ipHash, "messages", 15);
      if (rateLimited) return bad("Please wait before sending another message", 429, event);

      const id = await saveMessage(name.trim(), email.trim(), message.trim(), ipHash);
      return ok({ id, message: "Message sent successfully" }, event);
    }

    // ═══ PUBLIC: ANALYTICS LOGGING ═══
    if (segments[0] === "analytics" && method === "POST") {
      const { event_type, page } = body;
      const validTypes = ["page_view", "cv_download"];
      if (!validTypes.includes(event_type)) return bad("Invalid event type", 400, event);

      await logAnalytics(event_type, page || null, ipHash);
      return ok({ logged: true }, event);
    }

    // ═══ ADMIN: MESSAGES ═══
    if (segments[0] === "messages") {
      if (!user) return unauthorized(event);

      if (method === "GET" && !segments[1]) {
        const messages = await getMessages();
        return ok(messages, event);
      }
      if (method === "GET" && segments[1]) {
        const msg = await getMessage(+segments[1]);
        if (!msg) return bad("Not found", 404, event);
        await markMessageRead(+segments[1]);
        return ok(msg, event);
      }
      if (segments[1] === "mark-all-read" && method === "POST") {
        await markAllMessagesRead();
        return ok({ message: "All marked as read" }, event);
      }
      if (method === "DELETE" && segments[1]) {
        await deleteMessage(+segments[1]);
        return ok({ deleted: true }, event);
      }
      if (segments[1] === "unread-count" && method === "GET") {
        const count = await getUnreadCount();
        return ok({ count }, event);
      }
      return bad("Not found", 404, event);
    }

    // ═══ ADMIN: ANALYTICS DASHBOARD ═══
    if (segments[0] === "analytics" && method === "GET") {
      if (!user) return unauthorized(event);
      const data = await getAnalytics();
      return ok(data, event);
    }

    // ═══ PROFILE ═══
    if (segments[0] === "profile") {
      if (method === "GET") {
        let profile = await get("SELECT * FROM profile WHERE id = 1");
        if (!profile) {
          await run(`INSERT OR IGNORE INTO profile (id, name, title, about_text, avatar_url, "availability") VALUES (1, '', '', '', '', 'available')`);
          profile = await get("SELECT * FROM profile WHERE id = 1");
        }
        return ok(profile || {}, event);
      }
      if (method === "PUT") {
        if (!user) return unauthorized(event);
        const { name, title, about_text, avatar_url, availability } = body;
        await run(
          `INSERT INTO profile (id, name, title, about_text, avatar_url, "availability") VALUES (1, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET name = excluded.name, title = excluded.title, about_text = excluded.about_text, avatar_url = excluded.avatar_url, "availability" = excluded.availability`,
          [name || "", title || "", about_text || "", avatar_url || "", availability || "available"]
        );
        await updateLastUpdated();
        return ok({ message: "Profile updated" }, event);
      }
    }

    // ═══ META (REAL-TIME POLLING) ═══
    if (segments[0] === "meta" && method === "GET") {
      const [lastUpdated, unreadCount] = await Promise.all([
        getLastUpdated(),
        getUnreadCount()
      ]);
      return ok({ last_updated: lastUpdated, unread_messages: unreadCount }, event);
    }

    // ═══ PORTFOLIO (PUBLIC) ═══
    if (segments[0] === "portfolio" && method === "GET") {
      const [profile, contacts, social_links, typing_texts, stats, services, tech_stack, skills, projects, certificates, testimonials, companies, roles] = await Promise.all([
        get("SELECT * FROM profile WHERE id = 1"),
        query("SELECT * FROM contacts ORDER BY sort_order"),
        query("SELECT * FROM social_links ORDER BY sort_order"),
        query("SELECT * FROM typing_texts ORDER BY sort_order"),
        query("SELECT * FROM stats ORDER BY sort_order"),
        query("SELECT * FROM services ORDER BY sort_order"),
        query("SELECT * FROM tech_stack ORDER BY sort_order"),
        query("SELECT * FROM skills ORDER BY sort_order"),
        query("SELECT * FROM projects ORDER BY sort_order"),
        query("SELECT * FROM certificates ORDER BY sort_order"),
        query("SELECT * FROM testimonials ORDER BY sort_order"),
        query("SELECT * FROM companies ORDER BY sort_order"),
        query("SELECT * FROM roles ORDER BY sort_order"),
      ]);
      const withRoles = (section) => companies.filter(c => c.section === section).map(c => ({ ...c, roles: roles.filter(r => r.company_id === c.id) }));
      return ok({
        profile: profile || {}, contacts, social_links, typing_texts, stats, services, tech_stack, skills, projects, certificates, testimonials,
        experience: withRoles("experience"), education: withRoles("education"),
      }, event);
    }

    // ═══ GENERIC CRUD ═══
    const table = segments[0];
    const id = segments[1] ? +segments[1] : null;
    if (table && TABLES[table]) return await handleCrud(table, method, id, body, user, event);

    return bad(`Not found: ${method} /${segments.join("/")}`, 404, event);
  } catch (err) {
    console.error("[API] CRASH:", err.message, err.stack);
    return { statusCode: 500, headers: getCorsHeaders(event), body: JSON.stringify({ error: "Internal server error", message: err.message }) };
  }
};