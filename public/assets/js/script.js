"use strict";

/* ============================================
   UTILITIES
   ============================================ */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const enc = encodeURIComponent;

/* ============================================
   DATE CALCULATION ENGINE
   Parses date range strings like:
     "Feb 2026 — Present"
     "Sep 2025 — Feb 2026 · 6 months"  (existing suffix stripped & recomputed)
     "Mar 2024 — Sep 2025 · 1 year 7 months"
   and returns a live-computed duration suffix.
   ============================================ */
const MONTH_NAMES = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseMonth(str) {
  return MONTH_NAMES[str.trim().toLowerCase().slice(0, 3)] ?? -1;
}

function parseMonthYear(token) {
  // Matches "Feb 2026", "February 2026", etc.
  const m = token.trim().match(/^(\w+)\s+(\d{4})$/);
  if (!m) return null;
  const month = parseMonth(m[1]);
  if (month === -1) return null;
  return new Date(parseInt(m[2], 10), month, 1);
}

function formatDuration(totalMonths) {
  if (totalMonths < 1) return "< 1 month";
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const parts = [];
  if (years > 0) parts.push(`${years} year${years > 1 ? "s" : ""}`);
  if (months > 0) parts.push(`${months} month${months > 1 ? "s" : ""}`);
  return parts.join(" ");
}

/**
 * Parses "Start — End [· old suffix]" and returns the computed duration string.
 * Returns null if the string doesn't match the expected format.
 */
function calcDuration(rawText) {
  if (!rawText) return null;
  // Strip any existing "· …" suffix so we can recompute cleanly
  const cleaned = rawText.replace(/·.*$/, "").trim();
  // Splits on em-dash (—), en-dash (–), or double hyphen
  const parts = cleaned.split(/\s*[—–]\s*|\s*--\s*/);
  if (parts.length < 2) return null;

  const start = parseMonthYear(parts[0]);
  if (!start) return null;

  const endToken = parts[1].trim();
  const isPresent = /^present$/i.test(endToken);
  const end = isPresent ? new Date() : parseMonthYear(endToken);
  if (!end) return null;

  const totalMonths =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) + 1;

  if (totalMonths < 0) return null;

  const endLabel = isPresent ? "Present" : endToken;
  const duration = formatDuration(totalMonths);
  return `${parts[0].trim()} — ${endLabel} · ${duration}`;
}

/**
 * Scans the DOM for all role date and group-meta elements and
 * replaces their text with live-computed durations where possible.
 * Safe to call multiple times — only rewrites strings that contain
 * recognisable date ranges.
 */
function refreshDurations() {
  // Role date spans: "Feb 2026 — Present", "Sep 2025 — Feb 2026 · 6 months"
  $$(".timeline-role-date").forEach((el) => {
    const updated = calcDuration(el.textContent);
    if (updated) el.textContent = updated;
  });

  // Group meta spans: "7 months · Addis Ababa, Ethiopia"
  // These have a different format — only update if they contain a date range
  $$(".timeline-group-meta").forEach((el) => {
    const text = el.textContent.trim();
    // Only process if it looks like a date range (contains "—" or "–")
    if (!/[—–]/.test(text) && !/\w+\s+\d{4}/.test(text)) return;
    // Try stripping a location suffix: "May 2025 — Present · Addis Ababa" → compute date part
    const locationMatch = text.match(/^(.*?)\s*·\s*(.+)$/);
    if (locationMatch) {
      const datePart = locationMatch[1].trim();
      const locationPart = locationMatch[2].trim();
      const updated = calcDuration(datePart);
      if (updated) {
        // Extract just the duration from the computed string to append location
        const durationMatch = updated.match(/·\s*(.+)$/);
        if (durationMatch) {
          el.textContent = `${durationMatch[1]} · ${locationPart}`;
        }
      }
    } else {
      const updated = calcDuration(text);
      if (updated) el.textContent = updated;
    }
  });
}


function createObserver(callback, options = {}) {
  return new IntersectionObserver(
    (entries) =>
      entries.forEach(
        (e) => e.isIntersecting && callback(e.target, e, arguments[0]),
      ),
    { threshold: 0.15, ...options },
  );
}

function setupModal(containerSel, overlaySel, closeSel) {
  const container = $(containerSel);
  const ov = overlaySel ? $(overlaySel) : null;
  const btn = closeSel ? $(closeSel) : null;
  const open = () => {
    container.classList.add("active");
    container.setAttribute("aria-hidden", "false");
    if (ov) ov.classList.add("active");
    document.body.style.overflow = "hidden";
  };
  const close = () => {
    container.classList.remove("active");
    container.setAttribute("aria-hidden", "true");
    if (ov) ov.classList.remove("active");
    document.body.style.overflow = "";
  };
  if (btn) btn.addEventListener("click", close);
  if (ov) ov.addEventListener("click", close);
  return { container, open, close };
}

/* ============================================
   PRELOADER
   ============================================ */
const preloader = $("[data-preloader]");

/* ============================================
   PARTICLES
   ============================================ */
const canvas = document.getElementById("particles-canvas");
const ctx = canvas.getContext("2d");
let particles = [];
let animationId = null;
let isTabVisible = true;
let resizeTimer;

function resizeCanvas() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
resizeCanvas();

window.addEventListener("resize", () => {
  resizeCanvas();
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    initParticles();
    animate();
  }, 200);
});

class Particle {
  constructor() {
    this.reset();
  }
  reset() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.size = Math.random() * 2 + 0.3;
    this.vx = (Math.random() - 0.5) * 0.4;
    this.vy = (Math.random() - 0.5) * 0.4;
    this.opacity = Math.random() * 0.4 + 0.1;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
    if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
  }
  draw(color) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${color},${this.opacity})`;
    ctx.fill();
  }
}

function initParticles() {
  const count = Math.min(
    Math.floor((canvas.width * canvas.height) / 18000),
    70,
  );
  particles = Array.from({ length: count }, () => new Particle());
}

function getParticleColor() {
  return document.documentElement.dataset.theme === "light"
    ? "34,139,100"
    : "46,204,135";
}

function connectParticles(color) {
  const max = 110;
  const maxSq = max * max;
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dSq = dx * dx + dy * dy;
      if (dSq < maxSq) {
        const d = Math.sqrt(dSq);
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${color},${0.06 * (1 - d / max)})`;
        ctx.lineWidth = 0.5;
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.stroke();
      }
    }
  }
}

function animate() {
  if (!isTabVisible) {
    animationId = null;
    return;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const color = getParticleColor();
  particles.forEach((p) => {
    p.update();
    p.draw(color);
  });
  connectParticles(color);
  animationId = requestAnimationFrame(animate);
}

initParticles();
animate();

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    isTabVisible = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  } else {
    isTabVisible = true;
    if (!animationId) animate();
  }
});

/* ============================================
   TYPING ANIMATION
   ============================================ */
const typingEl = $("[data-typing]");
// Use `let` so CMS loader can update these
let typingTexts = [
  "QA Automation Lead",
  "Python & Robot Framework",
  "CI/CD Pipeline Expert",
  "FinTech QA Specialist",
  "Scrum Certified",
  "DevOps Enthusiast",
  "ISO/IEC 27001 Compliant",
];
let tIdx = 0;
let cIdx = 0;
let deleting = false;
let speed = 80;

(function type() {
  const txt = typingTexts[tIdx];
  if (!txt) {
    tIdx = 0;
    setTimeout(type, 200);
    return;
  }
  typingEl.textContent = txt.substring(0, deleting ? --cIdx : ++cIdx);
  speed = deleting ? 40 : 80;
  if (!deleting && cIdx === txt.length) {
    deleting = true;
    speed = 2500;
  } else if (deleting && cIdx === 0) {
    deleting = false;
    tIdx = (tIdx + 1) % typingTexts.length;
    speed = 400;
  }
  setTimeout(type, speed);
})();

/* ============================================
   THEME TOGGLE
   ============================================ */
const themeBtn = $("[data-theme-btn]");
document.documentElement.dataset.theme =
  localStorage.getItem("theme") || "dark";

themeBtn.addEventListener("click", () => {
  const next =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("theme", next);
});

/* ============================================
   BACK TO TOP
   ============================================ */
const backTopBtn = $("[data-back-top]");
window.addEventListener("scroll", () =>
  backTopBtn.classList.toggle("active", scrollY > 300),
);
backTopBtn.addEventListener("click", () =>
  scrollTo({ top: 0, behavior: "smooth" }),
);

/* ============================================
   SCROLL REVEAL
   ============================================ */
const revealObs = createObserver((el) => {
  el.classList.add("revealed");
  revealObs.unobserve(el);
});
$$("[data-reveal]").forEach((el) => revealObs.observe(el));

function reObserveReveals() {
  $$("[data-reveal]").forEach((el) => {
    el.classList.remove("revealed");
    revealObs.observe(el);
  });
}

/* ============================================
   COUNTERS & SKILL BARS
   ============================================ */
// Use mutable arrays so CMS loader can update refs
const counters = $$("[data-counter]");
const skillFills = $$("[data-skill-fill]");
let countersRan = false;
let skillsRan = false;

function animateCounters() {
  if (countersRan) return;
  countersRan = true;
  counters.forEach((el) => {
    const target = +el.dataset.counter;
    const start = performance.now();
    (function tick(now) {
      const p = Math.min((now - start) / 2000, 1);
      el.textContent = Math.floor((1 - (1 - p) ** 2) * target);
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = target;
    })(start);
  });
}

function animateSkills() {
  if (skillsRan) return;
  skillsRan = true;
  skillFills.forEach((el, i) =>
    setTimeout(
      () => {
        el.style.width = el.dataset.width + "%";
      },
      200 + i * 100,
    ),
  );
}

if (counters.length) {
  const co = createObserver(
    () => {
      animateCounters();
      co.disconnect();
    },
    { threshold: 0.3 },
  );
  co.observe(counters[0]);
}

if (skillFills.length) {
  const so = createObserver(
    () => {
      animateSkills();
      so.disconnect();
    },
    { threshold: 0.2 },
  );
  skillFills.forEach((f) => so.observe(f));
}

/* ============================================
   SIDEBAR
   ============================================ */
$("[data-sidebar-btn]").addEventListener("click", () =>
  $("[data-sidebar]").classList.toggle("active"),
);

/* ============================================
   TESTIMONIALS MODAL
   ============================================ */
const testimModal = setupModal(
  "[data-modal-container]",
  "[data-overlay]",
  "[data-modal-close-btn]",
);
const mImg = $("[data-modal-img]");
const mTitle = $("[data-modal-title]");
const mText = $("[data-modal-text]");

// Single delegation handler — works for both static HTML and CMS-rendered content
$(".testimonials-list")?.addEventListener("click", (e) => {
  const item = e.target.closest("[data-testimonials-item]");
  if (!item) return;
  const av = $("[data-testimonials-avatar]", item);
  if (!av) return;
  mImg.src = av.src;
  mImg.alt = av.alt;
  mTitle.innerHTML = $("[data-testimonials-title]", item).innerHTML;
  mText.innerHTML = $("[data-testimonials-text]", item).innerHTML;
  testimModal.open();
});

/* ============================================
   CERTIFICATE MODAL
   ============================================ */
const certModal = setupModal(
  "[data-cert-modal]",
  "[data-cert-overlay]",
  "[data-cert-close]",
);
const ce = {
  icon: $("[data-cert-modal-icon]"),
  status: $("[data-cert-modal-status]"),
  title: $("[data-cert-modal-title]"),
  issuer: $("[data-cert-modal-issuer]"),
  id: $("[data-cert-modal-id]"),
  date: $("[data-cert-modal-date]"),
  expiry: $("[data-cert-modal-expiry]"),
  statusText: $("[data-cert-modal-status-text]"),
  url: $("[data-cert-modal-url]"),
};

function openCertFromCard(card) {
  const d = card.dataset;
  ce.title.textContent = d.certTitle;
  ce.issuer.textContent = d.certIssuer;
  ce.id.textContent = d.certId;
  ce.date.textContent = d.certDate;
  ce.expiry.textContent = d.certExpiry || "No Expiration";
  ce.statusText.textContent = d.certStatus === "ALUMNI" ? "ALUMNI" : "Active";
  $("span", ce.status).textContent =
    d.certStatus === "ALUMNI" ? "Alumni Credential" : "Verified Credential";
  $("ion-icon", ce.icon).setAttribute("name", d.certIcon);
  if (d.certUrl && d.certUrl !== "#") {
    ce.url.href = d.certUrl;
    ce.url.classList.remove("disabled");
  } else {
    ce.url.href = "#";
    ce.url.classList.add("disabled");
  }
  certModal.open();
}

// Static binding
$$("[data-cert-item]").forEach((card) => {
  card.addEventListener("click", () => openCertFromCard(card));
});

// Event delegation (for CMS-rendered content)
$(".certificates-list")?.addEventListener("click", (e) => {
  const card = e.target.closest("[data-cert-item]");
  if (!card) return;
  openCertFromCard(card);
});

// Escape closes any modal
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (certModal.container.classList.contains("active")) certModal.close();
    if (testimModal.container.classList.contains("active")) testimModal.close();
  }
});

/* ============================================
   PORTFOLIO FILTER
   ============================================ */
const filterItems = $$("[data-filter-item]");
const selectEl = $("[data-select]");
const selectValue = $("[data-select-value]");
const filterBtns = $$("[data-filter-btn]");
let lastFilterBtn = filterBtns[0];

function applyFilter(value) {
  filterItems.forEach((item) =>
    item.classList.toggle(
      "active",
      value === "all" || value === item.dataset.category,
    ),
  );
}

if (selectEl) {
  selectEl.addEventListener("click", () => selectEl.classList.toggle("active"));
}

$$("[data-select-item]").forEach((item) => {
  item.addEventListener("click", () => {
    if (selectValue) selectValue.textContent = item.textContent;
    if (selectEl) selectEl.classList.remove("active");
    applyFilter(item.textContent.toLowerCase());
  });
});

filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const val = btn.textContent.toLowerCase();
    if (selectValue) selectValue.textContent = btn.textContent;
    applyFilter(val);
    if (lastFilterBtn) lastFilterBtn.classList.remove("active");
    btn.classList.add("active");
    lastFilterBtn = btn;
  });
});

/* ============================================
   CONTACT FORM
   ============================================ */
const form = $("[data-form]");
const formBtn = $("[data-form-btn]");
const formMsg = $("[data-form-message]");

function showFormMsg(text, type) {
  formMsg.textContent = text;
  formMsg.className = `form-message ${type}`;
  formMsg.style.display = "block";
  if (type === "success") {
    setTimeout(() => {
      formMsg.style.display = "none";
    }, 5000);
  }
}

$$("[data-form-input]").forEach((input) => {
  input.addEventListener("input", () => {
    formBtn.disabled = !form.checkValidity();
  });
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formMsg.className = "form-message";
  formMsg.style.display = "none";

  const data = new FormData(form);
  const action = form.getAttribute("action");

  // Mailto fallback if Formspree not configured
  if (!action || action.includes("YOUR_FORM_ID")) {
    const [name, email, msg] = ["fullname", "email", "message"].map((k) =>
      data.get(k),
    );
    if (!name || !email || !msg) {
      showFormMsg("Please fill all fields.", "error");
      return;
    }
    location.href = `mailto:mesfiny711@gmail.com?subject=${enc(
      `Portfolio Contact from ${name}`,
    )}&body=${enc(`${msg}\n\nFrom: ${name} (${email})`)}`;
    showFormMsg("Opening your email client...", "success");
    return;
  }

  // Formspree submission
  formBtn.disabled = true;
  const btnSpan = $("span", formBtn);
  const orig = btnSpan.textContent;
  btnSpan.textContent = "Sending...";

  try {
    const res = await fetch(action, {
      method: "POST",
      body: data,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error();
    form.reset();
    formBtn.disabled = true;
    showFormMsg("✓ Message sent successfully!", "success");
  } catch {
    showFormMsg("✗ Failed to send. Please try emailing directly.", "error");
    formBtn.disabled = false;
  }
  btnSpan.textContent = orig;
});

/* ============================================
   DYNAMIC CV GENERATOR
   Extracts ALL data from the live DOM.
   ============================================ */
const cvBtn = document.getElementById("download-cv-btn");

function extractContacts() {
  const contacts = {};
  $$(".contact-item").forEach((item) => {
    const key = $(".contact-title", item)?.textContent?.trim().toLowerCase();
    const el = $(".contact-link", item) || $("address", item);
    if (key && el) contacts[key] = el.textContent.trim();
  });
  return contacts;
}

function extractSocial() {
  const social = {};
  $$(".social-list a").forEach((a) => {
    try {
      const u = new URL(a.href);
      const display =
        u.hostname.replace("www.", "") + u.pathname.replace(/\/$/, "");
      if (a.href.includes("linkedin")) social.linkedin = display;
      if (a.href.includes("github")) social.github = display;
    } catch {
      /* skip */
    }
  });
  return social;
}

function extractTimeline(section) {
  return $$(".timeline-group", section).map((group) => ({
    company: $(".timeline-group-company", group)?.textContent?.trim() || "",
    meta: $(".timeline-group-meta", group)?.textContent?.trim() || "",
    roles: $$(".timeline-role", group).map((role) => ({
      title: $(".timeline-role-title", role)?.textContent?.trim() || "",
      date: $(".timeline-role-date", role)?.textContent?.trim() || "",
      desc: $(".timeline-text", role)?.textContent?.trim() || "",
    })),
  }));
}

function extractCVData() {
  const resume = $('[data-page="resume"]');
  const timelines = resume ? $$(".timeline", resume) : [];
  return {
    name: $(".sidebar .name")?.textContent?.trim() || "",
    title: typingTexts[0],
    contacts: extractContacts(),
    social: extractSocial(),
    summary: $$(".about-text p")
      .map((p) => p.textContent.trim())
      .join(" "),
    skills: $$(".tech-stack-item span")
      .map((s) => s.textContent.trim())
      .filter(Boolean),
    experience: timelines[0] ? extractTimeline(timelines[0]) : [],
    education: timelines[1] ? extractTimeline(timelines[1]) : [],
    certificates: $$("[data-cert-item]").map((c) => ({
      title: c.dataset.certTitle,
      issuer: c.dataset.certIssuer,
    })),
  };
}

function buildCVHTML(d) {
  const S = {
    heading: `font-size:11px;text-transform:uppercase;color:#2ecc87;
      border-bottom:1.5px solid #e0e0e0;padding-bottom:3px;margin:0 0 7px;
      font-weight:700;letter-spacing:1px`,
    section: `margin-bottom:10px;page-break-inside:auto`,
    jobWrap: `margin-bottom:8px;page-break-inside:avoid`,
    jobHeader: `display:flex;justify-content:space-between;align-items:baseline;margin-bottom:1px`,
    jobTitle: `font-size:11px;color:#0d1117`,
    jobDate: `font-size:9.5px;color:#777;white-space:nowrap;margin-left:10px`,
    jobCompany: `font-size:10px;color:#2ecc87;margin:0 0 3px;font-weight:600`,
    bullets: `margin:0;padding-left:14px;color:#444;font-size:10px;line-height:1.55`,
    badge: `background:#e8f5ee;color:#1a7a4c;padding:1px 6px;border-radius:3px;
      margin:1px 2px 1px 0;display:inline-block;font-weight:600;font-size:9.5px`,
  };

  const heading = (text) => `<h2 style="${S.heading}">${text}</h2>`;

  const contactParts = [
    d.contacts.email && `✉ ${d.contacts.email}`,
    d.contacts.phone && `☎ ${d.contacts.phone}`,
    d.contacts.location && `⌖ ${d.contacts.location}`,
  ].filter(Boolean);

  const socialParts = [
    d.social.linkedin && `⊞ ${d.social.linkedin}`,
    d.social.github && `⌥ ${d.social.github}`,
  ].filter(Boolean);

  const expHTML = d.experience
    .map((exp) =>
      exp.roles
        .map((r) => {
          const bullets = r.desc
            ? r.desc
                .split(/\.\s+/)
                .map((s) => s.replace(/\.$/, "").trim())
                .filter((s) => s.length > 10)
                .map((s) => `<li>${s}</li>`)
                .join("")
            : "";
          return `
            <div style="${S.jobWrap}">
              <div style="${S.jobHeader}">
                <strong style="${S.jobTitle}">${r.title}</strong>
                <span style="${S.jobDate}">${r.date}</span>
              </div>
              <p style="${S.jobCompany}">${exp.company}</p>
              ${bullets ? `<ul style="${S.bullets}">${bullets}</ul>` : ""}
            </div>`;
        })
        .join(""),
    )
    .join("");

  const eduHTML = d.education
    .map((edu) =>
      edu.roles
        .map(
          (r) => `
          <div style="display:flex;justify-content:space-between;align-items:baseline;
            margin-bottom:4px;page-break-inside:avoid">
            <div>
              <strong style="${S.jobTitle}">${r.title}</strong>
              <p style="font-size:10px;color:#555;margin:1px 0 0">${edu.company}</p>
            </div>
            <span style="${S.jobDate}">${edu.meta || r.date}</span>
          </div>`,
        )
        .join(""),
    )
    .join("");

  const certHTML = d.certificates
    .map(
      (c) =>
        `<li style="margin-bottom:1px"><strong>${c.title}</strong> — ${c.issuer}</li>`,
    )
    .join("");

  return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:780px;margin:0 auto;
      padding:20px 32px;color:#1a1a2e;line-height:1.45;font-size:10.5px">
      <div style="border-bottom:2.5px solid #2ecc87;padding-bottom:10px;margin-bottom:10px">
        <h1 style="font-size:22px;margin:0 0 2px;color:#0d1117;font-weight:800;letter-spacing:-0.5px">
          ${d.name.toUpperCase()}
        </h1>
        <p style="font-size:12px;color:#2ecc87;margin:0 0 6px;font-weight:700;letter-spacing:0.5px">
          ${d.title}
        </p>
        <p style="font-size:9.5px;color:#555;margin:0;line-height:1.6">
          ${contactParts.join(" &nbsp;|&nbsp; ")}${socialParts.length ? "<br>" + socialParts.join(" &nbsp;|&nbsp; ") : ""}
        </p>
      </div>
      <div style="${S.section}">
        ${heading("Professional Summary")}
        <p style="font-size:10px;color:#333;margin:0;line-height:1.55">${d.summary}</p>
      </div>
      <div style="${S.section}">
        ${heading("Core Skills")}
        <div style="margin:0;line-height:1.6">
          ${d.skills.map((s) => `<span style="${S.badge}">${s}</span>`).join("")}
        </div>
      </div>
      <div style="${S.section};page-break-before:auto">
        ${heading("Professional Experience")}
        ${expHTML}
      </div>
      <div style="${S.section}">
        ${heading("Education")}
        ${eduHTML}
      </div>
      <div style="margin-bottom:0">
        ${heading("Certifications")}
        <ul style="margin:0;padding-left:14px;color:#333;font-size:9.5px;line-height:1.65">
          ${certHTML}
        </ul>
      </div>
    </div>`;
}

cvBtn.addEventListener("click", (e) => {
  e.preventDefault();
  if (typeof html2pdf === "undefined") {
    alert("PDF library still loading. Please try again.");
    return;
  }

  cvBtn.classList.add("generating");
  const span = $("span", cvBtn);
  const orig = span.textContent;
  span.textContent = "Generating...";

  const cvData = extractCVData();
  const tmp = document.createElement("div");
  tmp.innerHTML = buildCVHTML(cvData);
  Object.assign(tmp.style, {
    position: "fixed",
    left: "-9999px",
    top: "0",
    background: "white",
  });
  document.body.appendChild(tmp);

  function cleanup() {
    document.body.removeChild(tmp);
    cvBtn.classList.remove("generating");
    span.textContent = orig;
  }

  html2pdf()
    .set({
      margin: [0.25, 0.2, 0.25, 0.2],
      filename: `${cvData.name.replace(/\s+/g, "_")}_CV.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        backgroundColor: "#ffffff",
      },
      jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] },
    })
    .from(tmp.firstElementChild)
    .save()
    .then(cleanup)
    .catch((err) => {
      console.error("CV generation failed:", err);
      cleanup();
      alert("CV generation failed. Please try again.");
    });
});

/* ============================================
   PAGE NAVIGATION
   ============================================ */
const navLinks = $$("[data-nav-link]");
const pages = $$("[data-page]");

function navigateToPage(pageName) {
  pages.forEach((p) =>
    p.classList.toggle("active", p.dataset.page === pageName),
  );
  navLinks.forEach((l) =>
    l.classList.toggle(
      "active",
      l.textContent.trim().toLowerCase() === pageName,
    ),
  );
  scrollTo(0, 0);

  // Reset animations
  countersRan = false;
  skillsRan = false;
  skillFills.forEach((f) => (f.style.width = "0%"));
  counters.forEach((c) => (c.textContent = "0"));

  setTimeout(() => {
    reObserveReveals();

    if (pageName === "about" && counters.length) {
      const o = createObserver(
        () => {
          animateCounters();
          o.disconnect();
        },
        { threshold: 0.3 },
      );
      o.observe(counters[0]);
    }

    if (pageName === "resume" && skillFills.length) {
      const o = createObserver(
        () => {
          animateSkills();
          o.disconnect();
        },
        { threshold: 0.2 },
      );
      skillFills.forEach((f) => o.observe(f));
    }
  }, 300);
}

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    const name = link.textContent.trim().toLowerCase();
    location.hash = name;
    navigateToPage(name);
  });
});

// Single load handler: preloader + hash routing
window.addEventListener("load", () => {
  setTimeout(() => preloader.classList.add("loaded"), 1800);
  setTimeout(() => {
    const hash = location.hash.slice(1).toLowerCase();
    const valid = pages.map((p) => p.dataset.page);
    if (hash && hash !== "about" && valid.includes(hash)) {
      navigateToPage(hash);
    }
  }, 100);
});

window.addEventListener("hashchange", () => {
  const hash = location.hash.slice(1).toLowerCase();
  const valid = pages.map((p) => p.dataset.page);
  if (hash && valid.includes(hash)) navigateToPage(hash);
  else if (!hash) navigateToPage("about");
});

/* ============================================
   CMS DATA LOADER
   Fetches live data from /api/portfolio
   and re-renders all sections.
   Falls back to static HTML if API unavailable.
   ============================================ */

function mdHighlight(text) {
  return text.replace(/\*\*(.*?)\*\*/g, '<span class="highlight">$1</span>');
}

function cmsRenderProfile(profile, typTexts) {
  if (!profile) return;

  // Update name
  const nameEl = $(".sidebar .name");
  if (nameEl && profile.name) nameEl.textContent = profile.name;

  // Update avatar
  const avatarImg = $(".avatar-box img");
  if (avatarImg && profile.avatar_url) avatarImg.src = profile.avatar_url;

  // Update typing texts
  if (typTexts?.length) {
    typingTexts.length = 0;
    typTexts.forEach((t) => typingTexts.push(t.text));
    tIdx = 0;
    cIdx = 0;
    deleting = false;
  }

  // Update availability status badge
  const statusBadge = $(".status-badge");
  if (statusBadge) {
    const status = profile.availability || "available";
    statusBadge.setAttribute("data-status", status);

    const titles = {
      available: "Available for hire",
      busy: "Busy — limited availability",
      unavailable: "Not available for hire",
    };
    statusBadge.setAttribute("title", titles[status] || titles.available);
  }
}

function cmsRenderAbout(aboutText) {
  const el = $(".about-text");
  if (!el || !aboutText) return;
  el.innerHTML = aboutText
    .split("\n\n")
    .filter((p) => p.trim())
    .map((p) => `<p>${mdHighlight(p.trim())}</p>`)
    .join("");
}

function cmsRenderContacts(contacts) {
  const el = $(".contacts-list");
  if (!el || !contacts?.length) return;
  el.innerHTML = contacts
    .map(
      (c) => `
    <li class="contact-item">
      <div class="icon-box"><ion-icon name="${c.icon}"></ion-icon></div>
      <div class="contact-info">
        <p class="contact-title">${c.type}</p>
        ${
          c.type === "Location"
            ? `<address>${c.value}</address>`
            : `<a href="${c.type === "Email" ? "mailto:" : "tel:"}${c.value.replace(/\s/g, "")}" class="contact-link">${c.value}</a>`
        }
      </div>
    </li>`,
    )
    .join("");
}

function cmsRenderSocial(links) {
  const el = $(".social-list");
  if (!el || !links?.length) return;
  el.innerHTML = links
    .map(
      (s) => `
    <li class="social-item">
      <a href="${s.url}" class="social-link" title="${s.platform}" target="_blank"
         rel="noopener noreferrer" aria-label="${s.platform}">
        <ion-icon name="${s.icon}"></ion-icon>
      </a>
    </li>`,
    )
    .join("");
}

function cmsRenderStats(stats) {
  const el = $(".stats-list");
  if (!el || !stats?.length) return;
  el.innerHTML = stats
    .map(
      (s) => `
    <li class="stats-item" data-reveal="${s.reveal || "bottom"}">
      <div class="stats-icon-box"><ion-icon name="${s.icon}"></ion-icon></div>
      <div class="stats-content">
        <span class="stats-number" data-counter="${s.value}">0</span>
        <span class="stats-suffix">${s.suffix || ""}</span>
      </div>
      <p class="stats-label">${s.label}</p>
    </li>`,
    )
    .join("");
}

function cmsRenderServices(services) {
  const el = $(".service-list");
  if (!el || !services?.length) return;
  el.innerHTML = services
    .map(
      (s) => `
    <li class="service-item" data-reveal="${s.reveal || "left"}">
      <div class="service-icon-box">
        <ion-icon name="${s.icon}" class="service-icon"></ion-icon>
      </div>
      <div class="service-content-box">
        <h4 class="h4 service-item-title">${s.title}</h4>
        <p class="service-item-text">${s.description}</p>
      </div>
    </li>`,
    )
    .join("");
}

function cmsRenderTechStack(items) {
  const el = $(".tech-stack-list");
  if (!el || !items?.length) return;
  el.innerHTML = items
    .map(
      (t) => `
    <li class="tech-stack-item" data-reveal="bottom" title="${t.name}">
      <ion-icon name="${t.icon}"></ion-icon><span>${t.name}</span>
    </li>`,
    )
    .join("");
}

function cmsRenderTestimonials(items) {
  const el = $(".testimonials-list");
  if (!el || !items?.length) return;
  el.innerHTML = items
    .map(
      (t) => `
    <li class="testimonials-item">
      <div class="content-card" data-testimonials-item>
        <figure class="testimonials-avatar-box">
          <img src="${t.avatar_url}" alt="${t.name}" width="60" data-testimonials-avatar />
        </figure>
        <h4 class="h4 testimonials-item-title" data-testimonials-title>${t.name}</h4>
        <div class="testimonials-text" data-testimonials-text><p>${t.text}</p></div>
      </div>
    </li>`,
    )
    .join("");
}

function cmsRenderTimeline(companies, timelineEl) {
  if (!timelineEl || !companies?.length) return;
  const tw = timelineEl.querySelector(".title-wrapper");
  timelineEl.innerHTML = "";
  if (tw) timelineEl.appendChild(tw);

  companies.forEach((c) => {
    const singleCls = c.is_single ? " timeline-group-single" : "";
    const parseTags = (t) => {
      try {
        const arr = JSON.parse(t || "[]");
        return arr.length
          ? `<ul class="timeline-tags">${arr.map((x) => `<li>${x}</li>`).join("")}</ul>`
          : "";
      } catch {
        return "";
      }
    };
    timelineEl.insertAdjacentHTML(
      "beforeend",
      `
      <div class="timeline-group${singleCls}" data-reveal="left">
        <div class="timeline-group-header">
          <div class="timeline-group-icon">
            <ion-icon name="${c.icon}"></ion-icon>
          </div>
          <div class="timeline-group-info">
            <h4 class="h4 timeline-group-company">${c.name}</h4>
            <span class="timeline-group-meta">${c.meta || ""}</span>
          </div>
        </div>
        <div class="timeline-group-roles">
          ${c.roles
            .map(
              (r) => `
            <div class="timeline-role">
              <div class="timeline-role-dot"></div>
              <div class="timeline-role-content">
                <h5 class="timeline-role-title">${r.title}</h5>
                <span class="timeline-role-date">${r.date_range || ""}</span>
                ${r.description ? `<p class="timeline-text">${r.description}</p>` : ""}
                ${parseTags(r.tags)}
              </div>
            </div>`,
            )
            .join("")}
        </div>
      </div>`,
    );
  });
}

function cmsRenderSkills(skills) {
  const el = $(".skills-list");
  if (!el || !skills?.length) return;
  el.innerHTML = skills
    .map(
      (s) => `
    <li class="skills-item">
      <div class="title-wrapper">
        <h5 class="h5">${s.name}</h5>
        <data value="${s.percentage}">${s.percentage}%</data>
      </div>
      <div class="skill-progress-bg">
        <div class="skill-progress-fill" data-skill-fill
             style="width:0%" data-width="${s.percentage}"></div>
      </div>
    </li>`,
    )
    .join("");
}

function cmsRenderProjects(projects) {
  const el = $(".project-list");
  if (!el || !projects?.length) return;

  // Dynamically update filter categories
  const categories = [...new Set(projects.map((p) => p.category))];
  const filterList = $(".filter-list");
  const selectList = $(".select-list");

  if (filterList) {
    filterList.innerHTML =
      `<li class="filter-item"><button class="active" data-filter-btn>All</button></li>` +
      categories
        .map(
          (c) =>
            `<li class="filter-item"><button data-filter-btn>${c.charAt(0).toUpperCase() + c.slice(1)}</button></li>`,
        )
        .join("");
  }
  if (selectList) {
    selectList.innerHTML =
      `<li class="select-item"><button data-select-item>All</button></li>` +
      categories
        .map(
          (c) =>
            `<li class="select-item"><button data-select-item>${c.charAt(0).toUpperCase() + c.slice(1)}</button></li>`,
        )
        .join("");
  }

  el.innerHTML = projects
    .map(
      (p) => `
    <li class="project-item active" data-filter-item
        data-category="${p.category}" data-reveal="bottom">
      <a href="${p.link || "#"}">
        <figure class="project-img">
          <div class="project-item-icon-box">
            <ion-icon name="eye-outline"></ion-icon>
          </div>
          <img src="${p.image_url}" alt="${p.title}" loading="lazy" />
        </figure>
        <h3 class="project-title">${p.title}</h3>
        <p class="project-category">${p.description || p.category}</p>
      </a>
    </li>`,
    )
    .join("");
}

function cmsRenderCertificates(certs) {
  const el = $(".certificates-list");
  if (!el || !certs?.length) return;
  el.innerHTML = certs
    .map(
      (c) => `
    <li class="certificate-item" data-reveal="bottom">
      <div class="certificate-card" data-cert-item
        data-cert-title="${c.title}" data-cert-issuer="${c.issuer}"
        data-cert-id="${c.credential_id}" data-cert-date="${c.issue_date}"
        data-cert-expiry="${c.expiry}" data-cert-url="${c.verify_url}"
        data-cert-status="${c.status}" data-cert-icon="${c.icon}">
        <div class="certificate-eye-overlay">
          <ion-icon name="eye-outline"></ion-icon>
          <span>View Credential</span>
        </div>
        <div class="certificate-icon">
          <ion-icon name="${c.icon}"></ion-icon>
        </div>
        <div class="certificate-content">
          <h3 class="h4 certificate-title">${c.title}</h3>
          <p class="certificate-issuer">${c.issuer}</p>
          <span class="certificate-badge">${c.status}</span>
        </div>
      </div>
    </li>`,
    )
    .join("");
}

/* ─── Re-initialize all dynamic elements after CMS render ─── */
function reinitAfterCMSRender() {
  // Update mutable counter/skill arrays
  const newCounters = $$("[data-counter]");
  const newSkillFills = $$("[data-skill-fill]");
  const newFilterItems = $$("[data-filter-item]");
  const newFilterBtns = $$("[data-filter-btn]");
  const newSelectItems = $$("[data-select-item]");

  counters.length = 0;
  newCounters.forEach((c) => counters.push(c));

  skillFills.length = 0;
  newSkillFills.forEach((f) => skillFills.push(f));

  filterItems.length = 0;
  newFilterItems.forEach((i) => filterItems.push(i));

  // Reset animation flags
  countersRan = false;
  skillsRan = false;

  // Re-observe all reveal elements
  reObserveReveals();

  // Re-bind filter buttons
  let newLastBtn = newFilterBtns[0];
  newFilterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = btn.textContent.toLowerCase();
      if (selectValue) selectValue.textContent = btn.textContent;
      applyFilter(val);
      if (newLastBtn) newLastBtn.classList.remove("active");
      btn.classList.add("active");
      newLastBtn = btn;
    });
  });

  // Re-bind select items
  newSelectItems.forEach((item) => {
    item.addEventListener("click", () => {
      const val = item.textContent.toLowerCase();
      if (selectValue) selectValue.textContent = item.textContent;
      if (selectEl) selectEl.classList.remove("active");
      applyFilter(val);
    });
  });

  // Counter observer
  if (counters.length) {
    const co = createObserver(
      () => {
        animateCounters();
        co.disconnect();
      },
      { threshold: 0.3 },
    );
    co.observe(counters[0]);
  }

  // Skill bar observer
  if (skillFills.length) {
    const so = createObserver(
      () => {
        animateSkills();
        so.disconnect();
      },
      { threshold: 0.2 },
    );
    skillFills.forEach((f) => so.observe(f));
  }

  // Calculate dynamic dates for newly rendered timeline items
  refreshDurations();
}

/* ─── Main CMS Data Loader ─── */
async function loadCMSData() {
  try {
    const res = await fetch("/api/portfolio");
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();

    // Render all sections from CMS data
    cmsRenderProfile(data.profile, data.typing_texts);
    cmsRenderAbout(data.profile?.about_text);
    cmsRenderContacts(data.contacts);
    cmsRenderSocial(data.social_links);
    cmsRenderStats(data.stats);
    cmsRenderServices(data.services);
    cmsRenderTechStack(data.tech_stack);
    cmsRenderTestimonials(data.testimonials);
    cmsRenderSkills(data.skills);
    cmsRenderProjects(data.projects);
    cmsRenderCertificates(data.certificates);

    // Experience & Education timelines
    const resumeTimelines = $$('[data-page="resume"] .timeline');
    if (resumeTimelines[0] && data.experience?.length) {
      cmsRenderTimeline(data.experience, resumeTimelines[0]);
    }
    if (resumeTimelines[1] && data.education?.length) {
      cmsRenderTimeline(data.education, resumeTimelines[1]);
    }

    // Re-bind all interactive elements
    reinitAfterCMSRender();

    console.log("✅ CMS data loaded — " + new Date().toLocaleTimeString());
  } catch (err) {
    console.log("📄 Using static HTML (CMS: " + err.message + ")");
  }
}

// Load CMS data on startup
loadCMSData();

// Run dynamic date calculations for static HTML fallback
refreshDurations();
