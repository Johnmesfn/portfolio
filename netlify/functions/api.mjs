// netlify/functions/api.mjs
import { config as loadEnv } from "dotenv";
loadEnv();
import { query, get, run, initSchema, updateLastUpdated, getLastUpdated, hashIP, checkRateLimit, recordLoginAttempt, clearLoginAttempts, saveMessage, getMessages, getMessage, markMessageRead, markAllMessagesRead, deleteMessage, getUnreadCount, logAnalytics, getAnalytics } from "../../lib/db.mjs";

function parsePositiveId(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const SECRET = process.env.JWT_SECRET;
if (!SECRET && process.env.NODE_ENV === "production") throw new Error("FATAL: JWT_SECRET missing in prod!");
const ACTIVE_SECRET = SECRET || "dev-secret-change-me";

const DEFAULT_ORIGINS = [
  "https://yohannesweb.netlify.app",
  "http://localhost:4321",
  "http://localhost:8888",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:4321",
  "http://127.0.0.1:8888",
  "http://127.0.0.1:5173",
];
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? [...new Set([...process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim()).filter(Boolean), ...DEFAULT_ORIGINS])]
  : DEFAULT_ORIGINS;

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

  if (!user) return unauthorized(event);

  if (method === "GET" && !id) return ok(await query(`SELECT * FROM ${table} ORDER BY sort_order, id`), event);
  if (method === "GET" && id) {
    const row = await get(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    return row ? ok(row, event) : bad("Not found", 404, event);
  }

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
  // Base64 encoding is ~33% larger than raw binary; 5MB binary data translates to ~7MB Base64 string
  if (typeof image === 'string' && image.length > 7 * 1024 * 1024) return bad("Image too large (Max 5MB)", 413, event);

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

function escapeEmailHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Sends a fail-soft lead alert via Resend when RESEND_API_KEY is configured. */
async function sendContactEmailAlert({ name, email, message, messageId }) {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) return { sent: false, reason: "missing_api_key" };

  let recipient = (process.env.CONTACT_NOTIFY_EMAIL || "").trim();
  if (!recipient) {
    const emailRow = await get("SELECT value FROM contacts WHERE lower(type) = 'email' ORDER BY sort_order LIMIT 1");
    recipient = (emailRow?.value || "").trim();
  }
  if (!recipient) {
    console.warn("[RESEND] Skipped alert: CONTACT_NOTIFY_EMAIL is not set.");
    return { sent: false, reason: "missing_recipient" };
  }

  const fromEmail = (process.env.RESEND_FROM_EMAIL || "Portfolio Contact <onboarding@resend.dev>").trim();
  const safeSubjectName = name.replace(/[\r\n]+/g, " ").slice(0, 80);
  const safeHtmlName = escapeEmailHtml(name);
  const safeHtmlEmail = escapeEmailHtml(email);
  const safeHtmlMsg = escapeEmailHtml(message).replace(/\n/g, "<br>");

  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#0d1117;color:#e6edf3;border:1px solid #30363d;border-radius:12px;overflow:hidden;">
      <div style="padding:18px 24px;background:#161b22;border-bottom:1px solid #30363d;">
        <span style="font-family:monospace;font-size:16px;font-weight:700;color:#2ecc87;">&lt;YM/&gt;</span>
        <span style="margin-left:10px;font-size:14px;color:#8b949e;">New Portfolio Message #${messageId}</span>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 12px;font-size:14px;"><strong>From:</strong> ${safeHtmlName} &lt;<a href="mailto:${safeHtmlEmail}" style="color:#2ecc87;">${safeHtmlEmail}</a>&gt;</p>
        <div style="background:#010409;border:1px solid #30363d;border-radius:8px;padding:16px;font-size:14px;line-height:1.6;color:#f0f6fc;">
          ${safeHtmlMsg}
        </div>
        <p style="margin:18px 0 0;font-size:12px;color:#8b949e;">Hit Reply in your email client to respond directly to ${safeHtmlName}.</p>
      </div>
    </div>`.trim();

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipient],
        reply_to: email,
        subject: `New Portfolio Inquiry from ${safeSubjectName}`,
        html,
        text: `New Portfolio Message (#${messageId})\n\nFrom: ${name} <${email}>\n\n${message}`,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.warn(`[RESEND] Alert failed (${res.status}):`, errBody.slice(0, 300));
      return { sent: false, status: res.status };
    }
    return { sent: true };
  } catch (err) {
    console.warn("[RESEND] Alert error:", err.message);
    return { sent: false, reason: err.message };
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
        const loginBlocked = await checkRateLimit(ipHash, "login_attempts", 15, 8);
        if (loginBlocked) return bad("Too many login attempts. Please wait 15 minutes.", 429, event);
        const u = await get("SELECT * FROM admin_users WHERE username = ?", [String(username).trim()]);
        if (!u || !bcrypt.compareSync(String(password), u.password_hash)) {
          await recordLoginAttempt(ipHash);
          return bad("Invalid credentials", 401, event);
        }
        await clearLoginAttempts(ipHash);
        const SESSION_TTL = 60 * 60; // 1 hour session
        const token = jwt.sign({ id: u.id, username: u.username }, ACTIVE_SECRET, { expiresIn: SESSION_TTL });
        return ok({ token, username: u.username, expiresIn: SESSION_TTL }, event);
      }
      if (segments[1] === "session" && method === "GET") {
        if (!user) return unauthorized(event);
        const exp = user.exp || Math.floor(Date.now() / 1000) + 3600;
        const expiresAt = exp * 1000;
        return ok({ username: user.username, expiresAt }, event);
      }
      if (segments[1] === "change-password" && method === "POST") {
        if (!user) return unauthorized(event);
        const { current, newPassword } = body;
        if (!current || !newPassword || String(newPassword).length < 6) return bad("New password must be at least 6 characters", 400, event);
        const u = await get("SELECT * FROM admin_users WHERE id = ?", [user.id]);
        if (!u || !bcrypt.compareSync(String(current), u.password_hash)) return bad("Wrong password", 401, event);
        await run("UPDATE admin_users SET password_hash = ? WHERE id = ?", [bcrypt.hashSync(String(newPassword), 12), user.id]);
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

      const cleanName = typeof name === "string" ? name.trim() : "";
      const cleanEmail = typeof email === "string" ? email.trim() : "";
      const cleanMessage = typeof message === "string" ? message.trim() : "";

      if (!cleanName || !cleanEmail || !cleanMessage) return bad("All fields required", 400, event);
      if (cleanName.length > 100) return bad("Name too long (max 100 chars)", 400, event);
      if (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return bad("Invalid email", 400, event);
      if (cleanMessage.length > 2000) return bad("Message too long (max 2000 chars)", 400, event);

      // Rate limit: 1 message per IP every 15 minutes
      const rateLimited = await checkRateLimit(ipHash, "messages", 15, 1);
      if (rateLimited) return bad("Please wait before sending another message", 429, event);

      const id = await saveMessage(cleanName, cleanEmail, cleanMessage, ipHash);
      await sendContactEmailAlert({ name: cleanName, email: cleanEmail, message: cleanMessage, messageId: id });
      return ok({ id, message: "Message sent successfully" }, event);
    }

    // ═══ PUBLIC: ANALYTICS LOGGING ═══
    if (segments[0] === "analytics" && method === "POST") {
      const { event_type, page } = body;
      const validTypes = ["page_view", "cv_download"];
      if (!validTypes.includes(event_type)) return bad("Invalid event type", 400, event);

      await logAnalytics(event_type, page ? String(page).slice(0, 50) : null, ipHash);
      return ok({ logged: true }, event);
    }

    // ═══ ADMIN: MESSAGES ═══
    if (segments[0] === "messages") {
      if (!user) return unauthorized(event);

      if (method === "GET" && !segments[1]) {
        const messages = await getMessages();
        return ok(messages, event);
      }
      if (segments[1] === "unread-count" && method === "GET") {
        const count = await getUnreadCount();
        return ok({ count }, event);
      }
      if (segments[1] === "mark-all-read" && method === "POST") {
        await markAllMessagesRead();
        return ok({ message: "All marked as read" }, event);
      }
      const msgId = parsePositiveId(segments[1]);
      if (!msgId) return bad("Invalid message ID", 400, event);

      if (method === "GET") {
        const msg = await getMessage(msgId);
        if (!msg) return bad("Not found", 404, event);
        await markMessageRead(msgId);
        return ok(msg, event);
      }
      if (method === "DELETE") {
        await deleteMessage(msgId);
        return ok({ deleted: true }, event);
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
        if (!user) return unauthorized(event);
        let profile = await get("SELECT * FROM profile WHERE id = 1");
        if (!profile) {
          await run(`INSERT OR IGNORE INTO profile (id, name, title, company, about_text, avatar_url, "availability") VALUES (1, '', '', 'Safaricom Ethiopia', '', '', 'available')`);
          profile = await get("SELECT * FROM profile WHERE id = 1");
        }
        return ok(profile || {}, event);
      }
      if (method === "PUT") {
        if (!user) return unauthorized(event);
        const { name, title, company, about_text, avatar_url, availability } = body;
        await run(
          `INSERT INTO profile (id, name, title, company, about_text, avatar_url, "availability") VALUES (1, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET name = excluded.name, title = excluded.title, company = excluded.company, about_text = excluded.about_text, avatar_url = excluded.avatar_url, "availability" = excluded.availability`,
          [name || "", title || "", company || "Safaricom Ethiopia", about_text || "", avatar_url || "", availability || "available"]
        );
        await updateLastUpdated();
        return ok({ message: "Profile updated" }, event);
      }
    }

    // ═══ META (REAL-TIME POLLING) ═══
    if (segments[0] === "meta" && method === "GET") {
      const lastUpdated = await getLastUpdated();
      // Only disclose unread message count to authenticated admin users
      const unreadCount = user ? await getUnreadCount() : 0;
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
    if (table && TABLES[table]) {
      const id = segments[1] !== undefined ? parsePositiveId(segments[1]) : null;
      if (segments[1] !== undefined && !id) return bad("Invalid resource ID", 400, event);
      return await handleCrud(table, method, id, body, user, event);
    }

    return bad(`Not found: ${method} /${segments.join("/")}`, 404, event);
  } catch (err) {
    console.error("[API] CRASH:", err.message, err.stack);
    const payload = process.env.NODE_ENV === "production"
      ? { error: "Internal server error" }
      : { error: "Internal server error", message: err.message };
    return { statusCode: 500, headers: getCorsHeaders(event), body: JSON.stringify(payload) };
  }
};