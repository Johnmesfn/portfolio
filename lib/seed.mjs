import { createClient } from "@libsql/client/web";
import bcrypt from "bcryptjs";
import { config } from "dotenv";

config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function query(sql, args = []) {
  const result = await db.execute({ sql, args });
  return result.rows;
}

async function run(sql, args = []) {
  const result = await db.execute({ sql, args });
  return { lastInsertRowid: result.lastInsertRowid };
}

async function batchInsert(table, cols, rows) {
  const placeholders = cols.map(() => "?").join(",");
  const sql = `INSERT INTO ${table} (${cols.join(",")}) VALUES (${placeholders})`;
  for (const row of rows) {
    await run(sql, row);
  }
}

async function seed() {
  console.log("🔧 Connecting to Turso...");
  console.log(
    "   URL:",
    process.env.TURSO_DATABASE_URL?.substring(0, 35) + "...",
  );

  // ═══════════════════════════════════
  // CREATE TABLES
  // ═══════════════════════════════════
  console.log("🔧 Creating tables...");

  const tables = [
    `CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY DEFAULT 1,
      name TEXT DEFAULT '',
      title TEXT DEFAULT '',
      about_text TEXT DEFAULT '',
      avatar_url TEXT DEFAULT './assets/images/my-avatar.png',
      availability TEXT DEFAULT 'available'
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
    await db.execute(sql);
  }
  console.log("✅ Tables created");

  // ═══════════════════════════════════
  // CHECK IF ALREADY SEEDED
  // ═══════════════════════════════════
  const existing = await query("SELECT COUNT(*) as c FROM profile");
  if (existing[0]?.c > 0) {
    console.log("✅ Database already seeded. Skipping.");
    return;
  }

  console.log("🌱 Seeding database...");

  // ═══════════════════════════════════
  // PROFILE
  // ═══════════════════════════════════
  await run(
    `INSERT INTO profile (id, name, title, about_text, avatar_url, availability)
     VALUES (1, ?, ?, ?, ?, ?)`,
    [
      "Yohannes Mesfin",
      "QA Automation Lead",
      `I'm a **QA Automation Lead** passionate about building reliable and scalable automation solutions. With expertise in **Python**, **Robot Framework**, **Jenkins**, and **CI/CD**, I help teams deliver high-quality software faster.\n\nCurrently contributing to large-scale **FinTech** and **Telecom** initiatives at **Safaricom Ethiopia**, focusing on automation strategy, secure testing, and continuous delivery.`,
      "./assets/images/my-avatar.png",
      "available",
    ],
  );
  console.log("   ✓ Profile");

  // ═══════════════════════════════════
  // ADMIN USER
  // ═══════════════════════════════════
  const hash = bcrypt.hashSync("admin123", 12);
  await run("INSERT INTO admin_users (username, password_hash) VALUES (?, ?)", [
    "admin",
    hash,
  ]);
  console.log("   ✓ Admin user (admin / admin123)");

  // ═══════════════════════════════════
  // CONTACTS
  // ═══════════════════════════════════
  await batchInsert(
    "contacts",
    ["type", "value", "icon", "sort_order"],
    [
      ["Email", "mesfiny711@gmail.com", "mail-outline", 1],
      ["Phone", "+251 954 906 800", "phone-portrait-outline", 2],
      ["Location", "Addis Ababa, Ethiopia", "location-outline", 3],
    ],
  );
  console.log("   ✓ Contacts");

  // ═══════════════════════════════════
  // SOCIAL LINKS
  // ═══════════════════════════════════
  await batchInsert(
    "social_links",
    ["platform", "url", "icon", "sort_order"],
    [
      [
        "LinkedIn",
        "https://www.linkedin.com/in/yohannesmesfin",
        "logo-linkedin",
        1,
      ],
      ["GitHub", "https://github.com/yohannesmesfin", "logo-github", 2],
      ["Email", "mailto:mesfiny711@gmail.com", "mail-outline", 3],
      ["Phone", "tel:+251954906800", "call-outline", 4],
    ],
  );
  console.log("   ✓ Social links");

  // ═══════════════════════════════════
  // TYPING TEXTS
  // ═══════════════════════════════════
  await batchInsert(
    "typing_texts",
    ["text", "sort_order"],
    [
      ["QA Automation Lead", 1],
      ["Python & Robot Framework", 2],
      ["CI/CD Pipeline Expert", 3],
      ["FinTech QA Specialist", 4],
      ["Scrum Certified", 5],
      ["DevOps Enthusiast", 6],
      ["ISO/IEC 27001 Compliant", 7],
    ],
  );
  console.log("   ✓ Typing texts");

  // ═══════════════════════════════════
  // STATS
  // ═══════════════════════════════════
  await batchInsert(
    "stats",
    ["label", "value", "suffix", "icon", "reveal", "sort_order"],
    [
      ["Testing Time Reduced", 40, "%", "speedometer-outline", "left", 1],
      ["Efficiency Improved", 30, "%", "bug-outline", "bottom", 2],
      [
        "Major Post-Launch Bugs",
        0,
        "",
        "shield-checkmark-outline",
        "bottom",
        3,
      ],
      ["Years Experience", 3, "+", "trending-up-outline", "right", 4],
    ],
  );
  console.log("   ✓ Stats");

  // ═══════════════════════════════════
  // SERVICES
  // ═══════════════════════════════════
  await batchInsert(
    "services",
    ["title", "description", "icon", "reveal", "sort_order"],
    [
      [
        "Test Automation",
        "Building scalable automation frameworks with Python and Robot Framework for web, mobile, and API testing.",
        "code-slash-outline",
        "left",
        1,
      ],
      [
        "Performance Testing",
        "Conducting load, stress, and performance testing to ensure applications handle expected traffic efficiently.",
        "speedometer-outline",
        "right",
        2,
      ],
      [
        "CI/CD Integration",
        "Integrating automated tests into Jenkins CI/CD pipelines to enable continuous testing and faster releases.",
        "git-branch-outline",
        "left",
        3,
      ],
      [
        "Security & Compliance",
        "Supporting secure testing practices aligned with ISO/IEC 27001 standards for FinTech platforms.",
        "shield-outline",
        "right",
        4,
      ],
      [
        "QA Leadership",
        "Leading QA initiatives in Agile teams, focusing on test strategy, quality improvement, and efficient delivery.",
        "people-outline",
        "left",
        5,
      ],
      [
        "IT Support & Troubleshooting",
        "Providing technical support and system troubleshooting to ensure smooth IT operations.",
        "laptop-outline",
        "right",
        6,
      ],
      [
        "Mentoring & Training",
        "Coaching junior QA engineers and team members on automation, testing best practices, and Agile workflows.",
        "school-outline",
        "left",
        7,
      ],
      [
        "Process Improvement",
        "Analyzing workflows to identify gaps and implement improvements that enhance testing efficiency and delivery quality.",
        "cog-outline",
        "right",
        8,
      ],
    ],
  );
  console.log("   ✓ Services");

  // ═══════════════════════════════════
  // TECH STACK
  // ═══════════════════════════════════
  await batchInsert(
    "tech_stack",
    ["name", "icon", "sort_order"],
    [
      ["Python", "logo-python", 1],
      ["Robot Framework", "hardware-chip-outline", 2],
      ["Jenkins", "server-outline", 3],
      ["Git/GitHub", "logo-github", 4],
      ["Docker", "cube-outline", 5],
      ["Kubernetes", "cube-outline", 6],
      ["Postman", "send-outline", 7],
      ["Linux", "terminal-outline", 8],
      ["Jira/Confluence", "clipboard-outline", 9],
      ["Scrum/Agile", "sync-outline", 10],
      ["CI/CD", "rocket-outline", 11],
      ["ISO 27001", "lock-closed-outline", 12],
      ["Performance Testing", "speedometer-outline", 13],
      ["API Testing", "server-outline", 14],
      ["LoadRunner/JMeter", "analytics-outline", 15],
      ["Monitoring/Logging", "eye-outline", 16],
      ["Slack/Teams", "chatbubble-outline", 17],
      ["Excel/Sheets", "document-text-outline", 18],
      ["VS Code/IDE", "code-outline", 19],
      ["Browser DevTools", "desktop-outline", 20],
      ["VMware/VirtualBox", "server-outline", 21],
    ],
  );
  console.log("   ✓ Tech stack");

  // ═══════════════════════════════════
  // COMPANIES (Experience + Education)
  // ═══════════════════════════════════
  await batchInsert(
    "companies",
    ["name", "meta", "icon", "section", "is_single", "sort_order"],
    [
      [
        "Safaricom Ethiopia Telecommunications PLC",
        "7 months · Addis Ababa, Ethiopia",
        "business-outline",
        "experience",
        0,
        1,
      ],
      [
        "Relevance Lab",
        "7 months · Addis Ababa, Ethiopia",
        "business-outline",
        "experience",
        0,
        2,
      ],
      [
        "Institute of Management, Technology and Finance",
        "May 2025 — Present",
        "school-outline",
        "experience",
        1,
        3,
      ],
      [
        "Two F Capital",
        "Feb 2025 — Mar 2025 · 2 months",
        "business-outline",
        "experience",
        1,
        4,
      ],
      [
        "Haron Computers",
        "Mar 2024 — Sep 2025 · 1 year 7 months",
        "business-outline",
        "experience",
        1,
        5,
      ],
      [
        "Matrix Information Technology",
        "10 months · Addis Ababa, Ethiopia",
        "business-outline",
        "experience",
        0,
        6,
      ],
      [
        "CodSoft",
        "Mar 2024 — Apr 2024 · 2 months",
        "code-slash-outline",
        "experience",
        1,
        7,
      ],
      [
        "Bonga University",
        "Oct 2019 — Jul 2023",
        "school-outline",
        "education",
        1,
        1,
      ],
    ],
  );
  console.log("   ✓ Companies");

  // ═══════════════════════════════════
  // ROLES
  // ═══════════════════════════════════
  await batchInsert(
    "roles",
    ["company_id", "title", "date_range", "description", "tags", "sort_order"],
    [
      [
        1,
        "Quality Assurance Automation Lead",
        "Feb 2026 — Present",
        "Led end-to-end automated test framework using Robot Framework & Python for USSD/M-PESA services. Integrated CI/CD pipelines with ISO/IEC 27001 compliance. Improved regression testing efficiency by 30%.",
        '["Robot Framework","Python","CI/CD","ISO 27001","M-PESA"]',
        1,
      ],
      [
        1,
        "Quality Assurance Automation Engineer",
        "Sep 2025 — Feb 2026 · 6 months",
        "Introduced Robot Framework and Python-based automation reducing manual testing efforts by 30%. Collaborated with development team for CI/CD pipeline integration.",
        '["Automation","USSD Testing","Agile","Security"]',
        2,
      ],
      [
        2,
        "Senior Quality Assurance Engineer",
        "Feb 2026 — Present",
        "Spearheaded automated testing framework for Telecom mobile apps using Python and Robot Framework. Integrated tests into CI/CD pipeline reducing manual testing time by 40%.",
        '["Python","DevOps","Mobile Testing","Security"]',
        1,
      ],
      [
        2,
        "Quality Assurance Automation Engineer",
        "Sep 2025 — Feb 2026 · 6 months",
        "Developed automated test suite covering critical mobile app features including task assignments and real-time navigation.",
        '["Robot Framework","Mobile QA","CI/CD"]',
        2,
      ],
      [
        3,
        "MTF ALUMNI Awarded Member",
        "Python Programming Certification",
        "Completed comprehensive certification in Python programming focused on writing clean, testable code.",
        '["Python","ALUMNI"]',
        1,
      ],
      [
        4,
        "Business Analyst",
        "Mastercard Edge Project",
        "Gathered and documented business and technical requirements for Mastercard Edge platform. Coordinated UAT ensuring features met business needs.",
        '["Requirements","UAT","FinTech","Mastercard"]',
        1,
      ],
      [
        5,
        "Quality Assurance Engineer",
        "Frappe ERP Applications",
        "Tested Frappe ERP applications. Achieved zero major post-launch defects, contributing to 15% increase in client retention.",
        '["Frappe ERP","Manual Testing","Bug Tracking"]',
        1,
      ],
      [
        6,
        "Quality Assurance / Quality Control Engineer",
        "Aug 2024 — Feb 2025 · 7 months",
        "Conducted manual testing for Fleet Management web app. Delivered bug-free release with 20% improvement in user satisfaction.",
        '["Cross-browser","Fleet Management","Web QA"]',
        1,
      ],
      [
        6,
        "Mobile Application Tester",
        "May 2024 — Aug 2024 · 4 months",
        "Led manual testing for Fleet Management mobile app validating real-time navigation and location tracking.",
        '["Mobile Testing","Android","GPS/Navigation"]',
        2,
      ],
      [
        7,
        "Python Developer (Intern)",
        "Command-line Tools Development",
        "Built CLI tools (task manager, password generator) to practice problem-solving with real-world logic.",
        '["Python","CLI Tools"]',
        1,
      ],
      [
        8,
        "Bachelor of Science — Computer Science",
        "4 Years",
        "Comprehensive study of computer science fundamentals including software engineering, data structures, algorithms, databases, and networking.",
        "[]",
        1,
      ],
    ],
  );
  console.log("   ✓ Roles");

  // ═══════════════════════════════════
  // SKILLS
  // ═══════════════════════════════════
  await batchInsert(
    "skills",
    ["name", "percentage", "sort_order"],
    [
      ["Python & Robot Framework", 95, 1],
      ["Test Automation & CI/CD", 90, 2],
      ["Agile / Scrum", 92, 3],
      ["DevOps & Jenkins", 85, 4],
      ["Security Testing (ISO 27001)", 88, 5],
      ["API & Mobile Testing", 82, 6],
    ],
  );
  console.log("   ✓ Skills");

  // ═══════════════════════════════════
  // PROJECTS
  // ═══════════════════════════════════
  await batchInsert(
    "projects",
    ["title", "category", "image_url", "description", "sort_order"],
    [
      [
        "M-PESA USSD Test Automation",
        "fintech",
        "./assets/images/project-1.jpg",
        "FinTech — Safaricom Ethiopia",
        1,
      ],
      [
        "Robot Framework CI/CD Pipeline",
        "automation",
        "./assets/images/project-2.png",
        "Automation — Safaricom & Relevance Lab",
        2,
      ],
      [
        "Telecom Mobile App QA",
        "telecom",
        "./assets/images/project-3.jpg",
        "Telecom — Relevance Lab",
        3,
      ],
      [
        "Mastercard Edge Platform",
        "fintech",
        "./assets/images/project-4.png",
        "FinTech — Two F Capital",
        4,
      ],
      [
        "Frappe ERP QA (E-Invoice)",
        "web apps",
        "./assets/images/project-5.png",
        "Web Apps — Haron Computers",
        5,
      ],
      [
        "Fleet Management System",
        "web apps",
        "./assets/images/project-6.png",
        "Web Apps — Matrix IT",
        6,
      ],
      [
        "Fleet Mobile App QA",
        "telecom",
        "./assets/images/project-7.png",
        "Telecom — Matrix IT",
        7,
      ],
      [
        "Python CLI Automation Tools",
        "automation",
        "./assets/images/project-8.jpg",
        "Automation — CodSoft",
        8,
      ],
      [
        "ISO 27001 Test Framework",
        "automation",
        "./assets/images/project-9.png",
        "Automation — Security Compliance",
        9,
      ],
    ],
  );
  console.log("   ✓ Projects");

  // ═══════════════════════════════════
  // CERTIFICATES
  // ═══════════════════════════════════
  await batchInsert(
    "certificates",
    [
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
    [
      [
        "Certified Associate in Scrum Fundamentals™",
        "CASF™ — International Scrum Institute",
        "CASF-78432-YM",
        "January 2025",
        "No Expiration",
        "https://www.scrum-institute.org/certifications/Certified-ScrumMaster-Certificated.php",
        "Verified",
        "ribbon-outline",
        1,
      ],
      [
        "ISO 9001 Quality Management Systems Associate™",
        "Quality Management Certification Body",
        "ISO9001-QMS-56291",
        "March 2025",
        "March 2028",
        "#",
        "Verified",
        "shield-checkmark-outline",
        2,
      ],
      [
        "IT Security: Defense Against the Digital Dark Arts",
        "Google — Coursera",
        "GOOGLE-ITSEC-A7K29",
        "November 2024",
        "No Expiration",
        "https://www.coursera.org/account/accomplishments/verify/",
        "Verified",
        "lock-closed-outline",
        3,
      ],
      [
        "Operating Systems and You: Becoming a Power User",
        "Google — Coursera",
        "GOOGLE-OS-B3M47",
        "October 2024",
        "No Expiration",
        "https://www.coursera.org/account/accomplishments/verify/",
        "Verified",
        "desktop-outline",
        4,
      ],
      [
        "Technical Support Fundamentals",
        "Google — Coursera",
        "GOOGLE-TSF-C9R12",
        "September 2024",
        "No Expiration",
        "https://www.coursera.org/account/accomplishments/verify/",
        "Verified",
        "construct-outline",
        5,
      ],
      [
        "Python Programming Certification",
        "MTF Institute of Management, Technology and Finance",
        "MTF-PY-ALUMNI-2025",
        "May 2025",
        "No Expiration",
        "#",
        "ALUMNI",
        "logo-python",
        6,
      ],
    ],
  );
  console.log("   ✓ Certificates");

  // ═══════════════════════════════════
  // TESTIMONIALS
  // ═══════════════════════════════════
  await batchInsert(
    "testimonials",
    ["name", "avatar_url", "text", "sort_order"],
    [
      [
        "Safaricom Team Lead",
        "./assets/images/avatar-1.png",
        "Yohannes transformed our testing process entirely. His automation framework reduced our regression cycle by 30% and brought a level of reliability to our M-PESA services that we hadn't achieved before.",
        1,
      ],
      [
        "Relevance Lab PM",
        "./assets/images/avatar-2.png",
        "Working with Yohannes on our Telecom client's mobile app was exceptional. He reduced manual testing time by 40% and his CI/CD integration made our deployment pipeline seamless.",
        2,
      ],
      [
        "Senior Developer",
        "./assets/images/avatar-3.png",
        "Yohannes has a rare combination of deep technical skills and collaborative spirit. His Robot Framework test suites caught bugs that manual testing missed for months.",
        3,
      ],
      [
        "Haron Computers Client",
        "./assets/images/avatar-4.png",
        "The Frappe ERP applications Yohannes tested launched with zero major defects. His thorough testing approach and clear bug reports made collaboration effortless.",
        4,
      ],
    ],
  );
  console.log("   ✓ Testimonials");

  // ═══════════════════════════════════
  console.log("");
  console.log("✅ Database seeded successfully!");
  console.log("   Admin login: admin / admin123");
  console.log("   ⚠️  Change the password after first login!");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  console.error(err.stack);
  process.exit(1);
});