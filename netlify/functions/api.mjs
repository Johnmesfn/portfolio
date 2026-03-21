import { query, get, run, initSchema } from "../../lib/db.mjs";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const SECRET = process.env.JWT_SECRET || "change-this";

// ─── Startup diagnostics ───
console.log("[API] Function loaded");
console.log(
  "[API] TURSO_DATABASE_URL:",
  process.env.TURSO_DATABASE_URL
    ? "✅ Set (" + process.env.TURSO_DATABASE_URL.substring(0, 25) + "...)"
    : "❌ MISSING",
);
console.log(
  "[API] TURSO_AUTH_TOKEN:",
  process.env.TURSO_AUTH_TOKEN ? "✅ Set" : "❌ MISSING",
);
console.log(
  "[API] JWT_SECRET:",
  process.env.JWT_SECRET ? "✅ Set" : "⚠️ Using default",
);
console.log(
  "[API] CLOUDINARY_CLOUD_NAME:",
  process.env.CLOUDINARY_CLOUD_NAME ? "✅ Set" : "⚠️ Not set",
);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Content-Type": "application/json",
};

let schemaReady = false;
async function ensureSchema() {
  if (schemaReady) return;
  try {
    await initSchema();
    schemaReady = true;
    console.log("[API] Schema ready");
  } catch (err) {
    console.error("[API] Schema init FAILED:", err.message);
    throw err;
  }
}

function ok(data) {
  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(data) };
}
function bad(msg, code = 400) {
  console.log(`[API] Error ${code}: ${msg}`);
  return {
    statusCode: code,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: msg }),
  };
}
function unauthorized() {
  return bad("Unauthorized", 401);
}

function verifyAuth(headers) {
  const authHeader = headers["authorization"] || headers["Authorization"];
  const token = authHeader?.split(" ")[1];
  if (!token) return null;
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

const TABLES = {
  contacts: ["type", "value", "icon", "sort_order"],
  social_links: ["platform", "url", "icon", "sort_order"],
  typing_texts: ["text", "sort_order"],
  stats: ["label", "value", "suffix", "icon", "reveal", "sort_order"],
  services: ["title", "description", "icon", "reveal", "sort_order"],
  tech_stack: ["name", "icon", "sort_order"],
  companies: ["name", "meta", "icon", "section", "is_single", "sort_order"],
  roles: [
    "company_id",
    "title",
    "date_range",
    "description",
    "tags",
    "sort_order",
  ],
  skills: ["name", "percentage", "sort_order"],
  projects: [
    "title",
    "category",
    "image_url",
    "description",
    "link",
    "sort_order",
  ],
  certificates: [
    "title",
    "issuer",
    "credential_id",
    "issue_date",
    "expiry",
    "verify_url",
    "status",
    "icon",
    "sort_order",
  ],
  testimonials: ["name", "avatar_url", "text", "sort_order"],
};

async function handleCrud(table, method, id, body, user) {
  const fields = TABLES[table];
  if (!fields) return bad("Unknown resource", 404);

  if (method === "GET" && !id) {
    return ok(await query(`SELECT * FROM ${table} ORDER BY sort_order, id`));
  }
  if (method === "GET" && id) {
    const row = await get(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    return row ? ok(row) : bad("Not found", 404);
  }
  if (!user) return unauthorized();

  if (method === "POST") {
    const cols = fields.filter((f) => body[f] !== undefined);
    const vals = cols.map((f) => body[f]);
    if (!cols.length) return bad("No valid fields");
    const result = await run(
      `INSERT INTO ${table} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`,
      vals,
    );
    return ok({ id: Number(result.lastInsertRowid), ...body });
  }

  if (method === "PUT" && id) {
    const cols = fields.filter((f) => body[f] !== undefined);
    const vals = cols.map((f) => body[f]);
    if (!cols.length) return bad("No valid fields");
    await run(
      `UPDATE ${table} SET ${cols.map((f) => `${f}=?`).join(",")} WHERE id=?`,
      [...vals, id],
    );
    return ok({ id: +id, ...body });
  }

  if (method === "DELETE" && id) {
    await run(`DELETE FROM ${table} WHERE id=?`, [id]);
    return ok({ deleted: true });
  }

  return bad("Method not allowed", 405);
}

async function handleUpload(body) {
  const { image } = body;
  if (!image) return bad("No image data");

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return bad("Cloudinary not configured");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const { createHash } = await import("crypto");
  const signature = createHash("sha1")
    .update(`folder=portfolio&timestamp=${timestamp}${apiSecret}`)
    .digest("hex");

  const formData = new URLSearchParams();
  formData.append("file", image);
  formData.append("api_key", apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);
  formData.append("folder", "portfolio");

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: formData },
  );
  const data = await res.json();

  if (data.secure_url) return ok({ url: data.secure_url });
  return bad("Upload failed: " + (data.error?.message || "Unknown"));
}

// ═══════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  const method = event.httpMethod;
  const rawPath = event.path || "";
  const cleanPath = rawPath
    .replace(/^\/?\.netlify\/functions\/api\/?/, "")
    .replace(/^\/?(api)?\/?/, "")
    .replace(/\/+$/, "");
  const segments = cleanPath.split("/").filter(Boolean);

  let body = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch {
      // not JSON
    }
  }

  console.log(`[API] ${method} /${segments.join("/")}`);

  try {
    await ensureSchema();

    const user = verifyAuth(event.headers);

    // Auth
    if (segments[0] === "auth") {
      if (segments[1] === "login" && method === "POST") {
        const { username, password } = body;
        if (!username || !password)
          return bad("Username and password required");
        const u = await get("SELECT * FROM admin_users WHERE username = ?", [
          username,
        ]);
        if (!u || !bcrypt.compareSync(password, u.password_hash)) {
          return bad("Invalid credentials", 401);
        }
        const token = jwt.sign({ id: u.id, username: u.username }, SECRET, {
          expiresIn: "24h",
        });
        return ok({ token, username: u.username });
      }
      if (segments[1] === "change-password" && method === "POST") {
        if (!user) return unauthorized();
        const { current, newPassword } = body;
        if (!current || !newPassword) return bad("Both passwords required");
        const u = await get("SELECT * FROM admin_users WHERE id = ?", [
          user.id,
        ]);
        if (!u || !bcrypt.compareSync(current, u.password_hash))
          return bad("Wrong password");
        await run("UPDATE admin_users SET password_hash = ? WHERE id = ?", [
          bcrypt.hashSync(newPassword, 12),
          user.id,
        ]);
        return ok({ message: "Password changed" });
      }
      return bad("Not found", 404);
    }

    // Upload
    if (segments[0] === "upload" && method === "POST") {
      if (!user) return unauthorized();
      return await handleUpload(body);
    }

    // Profile
    if (segments[0] === "profile") {
      if (method === "GET") {
        let profile = await get("SELECT * FROM profile WHERE id = 1");
        if (!profile) {
          await run(
            "INSERT OR IGNORE INTO profile (id, name, title, about_text, avatar_url, availability) VALUES (1,'','','','','available')",
          );
          profile = await get("SELECT * FROM profile WHERE id = 1");
        }
        return ok(profile || {});
      }
      if (method === "PUT") {
        if (!user) return unauthorized();
        const { name, title, about_text, avatar_url, availability } = body;
        const exists = await get("SELECT id FROM profile WHERE id = 1");
        if (exists) {
          await run(
            "UPDATE profile SET name=?, title=?, about_text=?, avatar_url=?, availability=? WHERE id=1",
            [
              name || "",
              title || "",
              about_text || "",
              avatar_url || "",
              availability || "available",
            ],
          );
        } else {
          await run(
            "INSERT INTO profile (id, name, title, about_text, avatar_url, availability) VALUES (1,?,?,?,?,?)",
            [
              name || "",
              title || "",
              about_text || "",
              avatar_url || "",
              availability || "available",
            ],
          );
        }
        return ok({ message: "Profile updated" });
      }
    }

    // Portfolio (combined)
    if (segments[0] === "portfolio" && method === "GET") {
      const [
        profile,
        contacts,
        social_links,
        typing_texts,
        stats,
        services,
        tech_stack,
        skills,
        projects,
        certificates,
        testimonials,
        companies,
        roles,
      ] = await Promise.all([
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
      const withRoles = (section) =>
        companies
          .filter((c) => c.section === section)
          .map((c) => ({
            ...c,
            roles: roles.filter((r) => r.company_id === c.id),
          }));
      return ok({
        profile: profile || {},
        contacts,
        social_links,
        typing_texts,
        stats,
        services,
        tech_stack,
        skills,
        projects,
        certificates,
        testimonials,
        experience: withRoles("experience"),
        education: withRoles("education"),
      });
    }

    // CRUD
    const table = segments[0];
    const id = segments[1] ? +segments[1] : null;
    if (table && TABLES[table]) {
      return await handleCrud(table, method, id, body, user);
    }

    return bad(`Not found: ${method} /${segments.join("/")}`, 404);
  } catch (err) {
    console.error("[API] CRASH:", err.message, err.stack);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Internal server error",
        message: err.message,
        // Remove this in production:
        stack: err.stack,
      }),
    };
  }
};
