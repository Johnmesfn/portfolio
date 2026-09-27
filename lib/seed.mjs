import { query, run, batch, initSchema, updateLastUpdated } from "./db.mjs";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
config();

async function seed() {
  console.log("🔧 Connecting to Turso...");
  await initSchema();
  console.log("✅ Tables verified");

  const force = process.argv.includes("--force") || process.argv.includes("-f");
  const existing = await query("SELECT COUNT(*) as c FROM profile");

  if (existing[0]?.c > 0 && !force) {
    console.log("ℹ️  Database already seeded. Run `node lib/seed.mjs --force` to overwrite with complete data.");
    return;
  }

  if (force) {
    console.log("🔄 Force flag provided — wiping content tables before re-seeding...");
    const wipeTables = [
      "contacts", "social_links", "typing_texts", "stats", "services",
      "tech_stack", "companies", "roles", "skills", "projects",
      "certificates", "testimonials"
    ];
    for (const t of wipeTables) {
      await run(`DELETE FROM "${t}"`);
    }
  }

  console.log("🌱 Seeding full portfolio database...");

  async function batchInsert(table, cols, rows) {
    const placeholders = cols.map(() => "?").join(",");
    const sql = `INSERT INTO ${table} (${cols.join(",")}) VALUES (${placeholders})`;
    const statements = rows.map(row => ({ sql, args: row }));
    await batch(statements);
  }

  // 1. Profile
  const aboutText = `I'm a **Specialist in CVM Development and Operations** at **Safaricom Ethiopia**, architecting scalable Customer Value Management frameworks, automated campaign workflows, and end-to-end automation solutions.

With a strong technical foundation in **Python**, **DevOps**, and **CI/CD**, I bridge business operations and engineering across large-scale **Telecom** and **FinTech (M-PESA)** platforms—optimizing customer lifecycle efficiency, eliminating process bottlenecks, and ensuring platform reliability.`;

  await run(
    `INSERT INTO profile (id, name, title, about_text, avatar_url, availability) VALUES (1, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, title = excluded.title, about_text = excluded.about_text, avatar_url = excluded.avatar_url, availability = excluded.availability`,
    ["Yohannes Mesfin", "Specialist — CVM Development and Operations", aboutText, "/assets/images/my-avatar.png", "available"]
  );

  // 2. Admin User (admin / admin123 if not already existing)
  const existingAdmin = await query("SELECT COUNT(*) as c FROM admin_users");
  if (!existingAdmin[0]?.c) {
    const hash = bcrypt.hashSync("admin123", 12);
    await run("INSERT INTO admin_users (username, password_hash) VALUES (?, ?)", ["admin", hash]);
  }

  // 3. Contacts
  await batchInsert("contacts", ["type", "value", "icon", "sort_order"], [
    ["Email", "mesfiny711@gmail.com", "mail-outline", 1],
    ["Phone", "+251 954 906 800", "phone-portrait-outline", 2],
    ["Location", "Addis Ababa, Ethiopia", "location-outline", 3]
  ]);

  // 4. Social Links
  await batchInsert("social_links", ["platform", "url", "icon", "sort_order"], [
    ["LinkedIn", "https://www.linkedin.com/in/yohannesmesfin", "logo-linkedin", 1],
    ["GitHub", "https://github.com/yohannesmesfin", "logo-github", 2],
    ["Email", "mailto:mesfiny711@gmail.com", "mail-outline", 3],
    ["Phone", "tel:+251954906800", "call-outline", 4]
  ]);

  // 5. Typing Texts
  await batchInsert("typing_texts", ["text", "sort_order"], [
    ["Specialist — CVM Development & Operations", 1],
    ["Safaricom Ethiopia Telecommunications", 2],
    ["Customer Value Management Architect", 3],
    ["FinTech & Telecom Automation", 4],
    ["Python & CI/CD Pipelines", 5],
    ["QA & Platform Reliability", 6],
    ["ISO/IEC 27001 Compliant", 7]
  ]);

  // 6. Impact & Metrics
  await batchInsert("stats", ["label", "value", "suffix", "icon", "reveal", "sort_order"], [
    ["Testing Time Reduced", 40, "%", "speedometer-outline", "left", 1],
    ["Efficiency Improved", 30, "%", "bug-outline", "bottom", 2],
    ["Major Post-Launch Bugs", 0, "", "shield-checkmark-outline", "bottom", 3],
    ["Years Experience", 3, "+", "trending-up-outline", "right", 4]
  ]);

  // 7. Services (What I Do)
  await batchInsert("services", ["title", "description", "icon", "reveal", "sort_order"], [
    ["Test Automation", "Building scalable automation frameworks with Python and Robot Framework for web, mobile, and API testing.", "code-slash-outline", "left", 1],
    ["Performance Testing", "Conducting load, stress, and performance testing to ensure applications handle expected traffic efficiently.", "speedometer-outline", "right", 2],
    ["CI/CD Integration", "Integrating automated tests into Jenkins CI/CD pipelines to enable continuous testing and faster releases.", "git-branch-outline", "left", 3],
    ["Security & Compliance", "Supporting secure testing practices aligned with ISO/IEC 27001 standards for FinTech platforms.", "shield-outline", "right", 4],
    ["QA Leadership", "Leading QA initiatives in Agile teams, focusing on test strategy, quality improvement, and efficient delivery.", "people-outline", "left", 5],
    ["IT Support & Troubleshooting", "Providing technical support and system troubleshooting to ensure smooth IT operations.", "laptop-outline", "right", 6],
    ["Mentoring & Training", "Coaching junior QA engineers and team members on automation, testing best practices, and Agile workflows.", "school-outline", "left", 7],
    ["Process Improvement", "Analyzing workflows to identify gaps and implement improvements that enhance testing efficiency and delivery quality.", "cog-outline", "right", 8]
  ]);

  // 8. Tech Stack & Tools
  await batchInsert("tech_stack", ["name", "icon", "sort_order"], [
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
    ["VMware/VirtualBox", "server-outline", 21]
  ]);

  // 9. Companies & Roles
  // Safaricom Ethiopia
  const safaricomRes = await run(
    "INSERT INTO companies (name, meta, icon, section, is_single, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
    ["Safaricom Ethiopia Telecommunications PLC", "Addis Ababa, Ethiopia", "business-outline", "experience", 0, 1]
  );
  const safaricomId = Number(safaricomRes.lastInsertRowid);

  // Relevance Lab
  const relevanceRes = await run(
    "INSERT INTO companies (name, meta, icon, section, is_single, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
    ["Relevance Lab", "Addis Ababa, Ethiopia", "business-outline", "experience", 0, 2]
  );
  const relevanceId = Number(relevanceRes.lastInsertRowid);

  // MTF
  const mtfRes = await run(
    "INSERT INTO companies (name, meta, icon, section, is_single, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
    ["Institute of Management, Technology and Finance", "May 2025 — Present", "school-outline", "experience", 1, 3]
  );
  const mtfId = Number(mtfRes.lastInsertRowid);

  // Two F Capital
  const twoFRes = await run(
    "INSERT INTO companies (name, meta, icon, section, is_single, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
    ["Two F Capital", "Feb 2025 — Mar 2025", "business-outline", "experience", 1, 4]
  );
  const twoFId = Number(twoFRes.lastInsertRowid);

  // Haron Computers
  const haronRes = await run(
    "INSERT INTO companies (name, meta, icon, section, is_single, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
    ["Haron Computers", "Mar 2024 — Sep 2025", "business-outline", "experience", 1, 5]
  );
  const haronId = Number(haronRes.lastInsertRowid);

  // Matrix IT
  const matrixRes = await run(
    "INSERT INTO companies (name, meta, icon, section, is_single, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
    ["Matrix Information Technology", "Addis Ababa, Ethiopia", "business-outline", "experience", 0, 6]
  );
  const matrixId = Number(matrixRes.lastInsertRowid);

  // CodSoft
  const codsoftRes = await run(
    "INSERT INTO companies (name, meta, icon, section, is_single, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
    ["CodSoft", "Mar 2024 — Apr 2024", "code-slash-outline", "experience", 1, 7]
  );
  const codsoftId = Number(codsoftRes.lastInsertRowid);

  // Education: Bonga University
  const bongaRes = await run(
    "INSERT INTO companies (name, meta, icon, section, is_single, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
    ["Bonga University", "Oct 2019 — Jul 2023", "school-outline", "education", 1, 1]
  );
  const bongaId = Number(bongaRes.lastInsertRowid);

  // Roles for each company
  await batchInsert("roles", ["company_id", "title", "date_range", "description", "tags", "sort_order"], [
    // Safaricom roles
    [
      safaricomId,
      "Specialist — CVM Development and Operations",
      "Apr 2026 — Present",
      "Optimized customer value operations by designing and implementing CVM frameworks that improved operational efficiency and reduced process bottlenecks. Drove cross-functional collaboration between technical, operations, and business teams.",
      JSON.stringify(["CVM", "FinTech", "Operations", "Telecom"]),
      1
    ],
    [
      safaricomId,
      "Quality Assurance Automation Lead",
      "Feb 2026 — Apr 2026",
      "Led end-to-end automated test framework using Robot Framework & Python for USSD/M-PESA services. Integrated CI/CD pipelines with ISO/IEC 27001 compliance. Improved regression testing efficiency by 30%.",
      JSON.stringify(["Robot Framework", "Python", "CI/CD", "ISO 27001", "M-PESA"]),
      2
    ],
    [
      safaricomId,
      "Quality Assurance Automation Engineer",
      "Sep 2025 — Feb 2026",
      "Introduced Robot Framework and Python-based automation reducing manual testing efforts by 30%. Collaborated with development team for CI/CD pipeline integration.",
      JSON.stringify(["Automation", "USSD Testing", "Agile", "Security"]),
      3
    ],
    // Relevance Lab roles
    [
      relevanceId,
      "Senior Quality Assurance Engineer",
      "Feb 2026 — Apr 2026",
      "Spearheaded automated testing framework for Telecom mobile apps using Python and Robot Framework. Integrated tests into CI/CD pipeline reducing manual testing time by 40%.",
      JSON.stringify(["Python", "DevOps", "Mobile Testing", "Security"]),
      1
    ],
    [
      relevanceId,
      "Quality Assurance Automation Engineer",
      "Sep 2025 — Feb 2026",
      "Developed automated test suite covering critical mobile app features including task assignments and real-time navigation.",
      JSON.stringify(["Robot Framework", "Mobile QA", "CI/CD"]),
      2
    ],
    // MTF role
    [
      mtfId,
      "MTF ALUMNI Awarded Member",
      "Python Programming Certification",
      "Completed comprehensive certification in Python programming focused on writing clean, testable code.",
      JSON.stringify(["Python", "ALUMNI"]),
      1
    ],
    // Two F Capital role
    [
      twoFId,
      "Business Analyst",
      "Mastercard Edge Project",
      "Gathered and documented business and technical requirements for Mastercard's Edge platform. Coordinated UAT ensuring features met business needs.",
      JSON.stringify(["Requirements", "UAT", "FinTech", "Mastercard"]),
      1
    ],
    // Haron Computers role
    [
      haronId,
      "Quality Assurance Engineer",
      "Frappe ERP Applications",
      "Tested Frappe ERP applications. Achieved zero major post-launch defects, contributing to 15% increase in client retention.",
      JSON.stringify(["Frappe ERP", "Manual Testing", "Bug Tracking"]),
      1
    ],
    // Matrix IT roles
    [
      matrixId,
      "Quality Assurance / Quality Control Engineer",
      "Aug 2024 — Feb 2025",
      "Conducted manual testing for Fleet Management web app. Delivered bug-free release with 20% improvement in user satisfaction.",
      JSON.stringify(["Cross-browser", "Fleet Management", "Web QA"]),
      1
    ],
    [
      matrixId,
      "Mobile Application Tester",
      "May 2024 — Aug 2024",
      "Led manual testing for Fleet Management mobile app validating real-time navigation and location tracking.",
      JSON.stringify(["Mobile Testing", "Android", "GPS/Navigation"]),
      2
    ],
    // CodSoft role
    [
      codsoftId,
      "Python Developer (Intern)",
      "Command-line Tools Development",
      "Built CLI tools (task manager, password generator) to practice problem-solving with real-world logic.",
      JSON.stringify(["Python", "CLI Tools"]),
      1
    ],
    // Education role
    [
      bongaId,
      "Bachelor of Science — Computer Science",
      "4 Years",
      "Comprehensive study of computer science fundamentals including software engineering, data structures, algorithms, databases, and networking.",
      JSON.stringify([]),
      1
    ]
  ]);

  // 10. Skills (Core Competencies)
  await batchInsert("skills", ["name", "percentage", "sort_order"], [
    ["Python & Robot Framework", 95, 1],
    ["Test Automation & CI/CD", 90, 2],
    ["Agile / Scrum", 92, 3],
    ["DevOps & Jenkins", 85, 4],
    ["Security Testing (ISO 27001)", 88, 5],
    ["API & Mobile Testing", 82, 6]
  ]);

  // 11. Projects
  await batchInsert("projects", ["title", "category", "image_url", "description", "link", "sort_order"], [
    ["M-PESA USSD Test Automation", "fintech", "/assets/images/project-1.jpg", "FinTech — Safaricom Ethiopia", "#", 1],
    ["Robot Framework CI/CD Pipeline", "automation", "/assets/images/project-2.png", "Automation — Safaricom & Relevance Lab", "#", 2],
    ["Telecom Mobile App QA", "telecom", "/assets/images/project-3.jpg", "Telecom — Relevance Lab", "#", 3],
    ["Mastercard Edge Platform", "fintech", "/assets/images/project-4.png", "FinTech — Two F Capital", "#", 4],
    ["Fleet Management Web App QA", "web apps", "/assets/images/project-5.png", "Web Apps — Matrix IT", "#", 5],
    ["Frappe ERP Test Suite", "automation", "/assets/images/project-6.png", "Automation — Haron Computers", "#", 6],
    ["CVM Operations Framework", "fintech", "/assets/images/project-7.png", "FinTech — Safaricom Ethiopia", "#", 7],
    ["E-Commerce Web Testing", "web apps", "/assets/images/project-8.jpg", "Web Apps — CodSoft", "#", 8],
    ["Telecom Infrastructure Testing", "telecom", "/assets/images/project-9.png", "Telecom — Relevance Lab", "#", 9]
  ]);

  // 12. Certificates
  await batchInsert("certificates", ["title", "issuer", "credential_id", "issue_date", "expiry", "verify_url", "status", "icon", "sort_order"], [
    ["QA Automation Lead Certification", "Safaricom Ethiopia", "SEC-QA-2026-001", "Feb 2026", "No Expiration", "#", "Active", "shield-checkmark-outline", 1],
    ["MTF ALUMNI Awarded Member", "Institute of Management, Technology and Finance", "MTF-ALUMNI-2025-042", "May 2025", "No Expiration", "#", "ALUMNI", "school-outline", 2],
    ["Python Programming Certification", "MTF Institute", "MTF-PY-2025-041", "May 2025", "No Expiration", "#", "Active", "logo-python", 3]
  ]);

  // 13. Testimonials
  await batchInsert("testimonials", ["name", "avatar_url", "text", "sort_order"], [
    ["Safaricom Team Lead", "/assets/images/avatar-1.png", "Yohannes transformed our testing process entirely. His automation framework reduced our regression cycle by 30% and brought a level of reliability to our M-PESA services that we hadn't achieved before.", 1],
    ["Relevance Lab PM", "/assets/images/avatar-2.png", "Working with Yohannes on our Telecom client's mobile app was exceptional. He reduced manual testing time by 40% and his CI/CD integration made our deployment pipeline seamless.", 2],
    ["Senior Developer", "/assets/images/avatar-3.png", "Yohannes has a rare combination of deep technical skills and collaborative spirit. His Robot Framework test suites caught bugs that manual testing missed for months.", 3],
    ["Haron Computers Client", "/assets/images/avatar-4.png", "The Frappe ERP applications Yohannes tested launched with zero major defects. His thorough testing approach and clear bug reports made collaboration effortless.", 4]
  ]);

  await updateLastUpdated();
  console.log("✅ Database seeded with complete portfolio data successfully! (Admin: admin / admin123)");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err.message, err.stack);
  process.exit(1);
});