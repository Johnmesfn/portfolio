"use strict";

/* ============================================
   UTILITIES
   ============================================ */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const enc = encodeURIComponent;

function escapeHtml(value) {
  const s = value == null ? "" : String(value);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeUrl(url, fallback = "#") {
  if (!url) return fallback;
  const trimmed = String(url).trim();
  if (trimmed === "#" || trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) {
    return trimmed;
  }
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  return fallback;
}

// ═══ UNIVERSAL ICON RENDERER ═══
function renderIcon(name) {
  if (!name) return '';
  const clean = escapeHtml(String(name).trim());
  if (clean.startsWith('dev:')) return `<i class="devicon-${clean.substring(4)} colored"></i>`;
  if (clean.startsWith('si:')) return `<i class="si si-${clean.substring(3)}"></i>`;
  if (clean.startsWith('bi:')) return `<i class="bi bi-${clean.substring(3)}"></i>`;
  if (clean.includes(':')) return `<iconify-icon icon="${clean}" width="22" height="22"></iconify-icon>`;
  return `<ion-icon name="${clean}"></ion-icon>`;
}

/* ============================================
   DATE CALCULATION ENGINE
   ============================================ */
const MONTH_NAMES = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseMonth(str) {
  return MONTH_NAMES[str.trim().toLowerCase().slice(0, 3)] ?? -1;
}

function parseMonthYear(token) {
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

function getNowNormalized() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function calcDuration(rawText) {
  if (!rawText) return null;
  const cleaned = rawText.replace(/·.*$/, "").trim();
  const parts = cleaned.split(/\s*[—–]\s*|\s*--\s*|\s+-\s+/);
  if (parts.length < 2) return null;

  const start = parseMonthYear(parts[0]);
  if (!start) return null;

  const endToken = parts[1].trim();
  const isPresent = /^present$/i.test(endToken);
  const end = isPresent ? getNowNormalized() : parseMonthYear(endToken);
  if (!end) return null;

  const totalMonths =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());

  if (totalMonths < 0) return null;

  const endLabel = isPresent ? "Present" : endToken;
  const duration = formatDuration(totalMonths);
  return `${parts[0].trim()} — ${endLabel} · ${duration}`;
}

function computeGroupDuration(roles) {
  if (!roles?.length) return "";
  let earliest = null;
  let latestIsPresent = false;
  let latest = null;

  roles.forEach((r) => {
    if (!r.date_range) return;
    const cleaned = r.date_range.replace(/·.*$/, "").trim();
    const parts = cleaned.split(/\s*[—–]\s*|\s*--\s*|\s+-\s+/);
    if (parts.length < 2) return;

    const start = parseMonthYear(parts[0]);
    const endToken = parts[1].trim();
    const isPresent = /^present$/i.test(endToken);
    const end = isPresent ? getNowNormalized() : parseMonthYear(endToken);

    if (start && (!earliest || start < earliest)) earliest = start;
    if (isPresent) latestIsPresent = true;
    else if (end && (!latest || end > latest)) latest = end;
  });

  if (!earliest) return "";
  const end = latestIsPresent ? getNowNormalized() : latest;
  if (!end) return "";

  const totalMonths =
    (end.getFullYear() - earliest.getFullYear()) * 12 +
    (end.getMonth() - earliest.getMonth());

  if (totalMonths < 0) return "";
  return formatDuration(totalMonths);
}

function refreshDurations() {
  $$(".timeline-role-date").forEach((el) => {
    const updated = calcDuration(el.textContent);
    if (updated) el.textContent = updated;
  });

  $$(".timeline-group-meta").forEach((el) => {
    const text = el.textContent.trim();
    const hasDateRange = /[—–]/.test(text) || /\w+\s+\d{4}\s*[-—–]/.test(text);
    if (!hasDateRange) return;

    const locationMatch = text.match(/^(.*?)\s*·\s*(.+)$/);
    if (locationMatch) {
      const datePart = locationMatch[1].trim();
      const locationPart = locationMatch[2].trim();
      const updated = calcDuration(datePart);
      if (updated) {
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

/* ============================================
   INTERSECTION OBSERVER HELPER
   ============================================ */
function createObserver(callback, options = {}) {
  return new IntersectionObserver(
    (entries) =>
      entries.forEach(
        (e) => e.isIntersecting && callback(e.target, e, arguments[0]),
      ),
    { threshold: 0.15, ...options },
  );
}

/* ============================================
   MODAL HELPER
   ============================================ */
function setupModal(containerSel, overlaySel, closeSel) {
  const container = $(containerSel);
  const ov = overlaySel ? $(overlaySel) : null;
  const btn = closeSel ? $(closeSel) : null;
  let lastFocused = null;
  const open = () => {
    if (!container) return;
    lastFocused = document.activeElement;
    container.classList.add("active");
    container.setAttribute("aria-hidden", "false");
    if (ov) ov.classList.add("active");
    document.body.style.overflow = "hidden";
    btn?.focus();
  };
  const close = () => {
    if (!container) return;
    container.classList.remove("active");
    container.setAttribute("aria-hidden", "true");
    if (ov) ov.classList.remove("active");
    document.body.style.overflow = "";
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  };
  if (btn) btn.addEventListener("click", close);
  if (ov) ov.addEventListener("click", close);
  return { container, open, close };
}

/* ============================================
   PARTICLES (ACCESSIBLE & OPTIMIZED)
   ============================================ */
const canvas = document.getElementById("particles-canvas");
const ctx = canvas?.getContext("2d");
let particles = [];
let animationId = null;
let isTabVisible = true;
let resizeTimer;
const prefersReducedMotionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");

function resizeCanvas() {
  if (!canvas) return;
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
if (canvas) resizeCanvas();

window.addEventListener("resize", () => {
  if (!canvas || prefersReducedMotionMedia.matches) return;
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
  constructor() { this.reset(); }
  reset() {
    this.x = Math.random() * (canvas?.width || 800);
    this.y = Math.random() * (canvas?.height || 600);
    this.size = Math.random() * 2 + 0.3;
    this.vx = (Math.random() - 0.5) * 0.4;
    this.vy = (Math.random() - 0.5) * 0.4;
    this.opacity = Math.random() * 0.4 + 0.1;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    if (!canvas) return;
    if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
    if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
  }
  draw(color) {
    if (!ctx) return;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${color},${this.opacity})`;
    ctx.fill();
  }
}

function initParticles() {
  if (!canvas || prefersReducedMotionMedia.matches) return;
  const count = Math.min(Math.floor((canvas.width * canvas.height) / 18000), 70);
  particles = Array.from({ length: count }, () => new Particle());
}

function getParticleColor() {
  return document.documentElement.dataset.theme === "light" ? "10,102,52" : "46,204,135";
}

function connectParticles(color) {
  // ✅ OPTIMIZATION: Skip heavy line-drawing on mobile to save battery/CPU
  if (!ctx || window.innerWidth < 768) return;

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
  if (!canvas || !ctx || !isTabVisible || prefersReducedMotionMedia.matches) { animationId = null; return; }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const color = getParticleColor();
  particles.forEach((p) => { p.update(); p.draw(color); });
  connectParticles(color);
  animationId = requestAnimationFrame(animate);
}

if (!prefersReducedMotionMedia.matches && canvas) {
  initParticles();
  animate();
} else if (canvas) {
  canvas.style.display = "none";
}

prefersReducedMotionMedia.addEventListener("change", (e) => {
  if (e.matches) {
    if (animationId) cancelAnimationFrame(animationId);
    animationId = null;
    if (canvas) canvas.style.display = "none";
  } else {
    if (canvas) canvas.style.display = "block";
    initParticles();
    animate();
  }
});

document.addEventListener("visibilitychange", () => {
  if (prefersReducedMotionMedia.matches) return;
  if (document.hidden) {
    isTabVisible = false;
    if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
  } else {
    isTabVisible = true;
    if (!animationId) animate();
  }
});

/* ============================================
   TYPING ANIMATION
   ============================================ */
const typingEl = $("[data-typing]");
let typingTexts = [
  "Specialist — CVM Development & Operations",
  "Safaricom Ethiopia Telecommunications",
  "Customer Value Management Architect",
  "FinTech & Telecom Automation",
  "Python & CI/CD Pipelines",
  "QA & Platform Reliability",
  "ISO/IEC 27001 Compliant",
];
let tIdx = 0, cIdx = 0, deleting = false, speed = 80;

(function type() {
  const txt = typingTexts[tIdx];
  if (!txt) { tIdx = 0; setTimeout(type, 200); return; }
  typingEl.textContent = txt.substring(0, deleting ? --cIdx : ++cIdx);
  speed = deleting ? 40 : 80;
  if (!deleting && cIdx === txt.length) { deleting = true; speed = 2500; }
  else if (deleting && cIdx === 0) { deleting = false; tIdx = (tIdx + 1) % typingTexts.length; speed = 400; }
  setTimeout(type, speed);
})();

/* ============================================
   THEME TOGGLE
   ============================================ */
const themeBtn = $("[data-theme-btn]");
document.documentElement.dataset.theme = localStorage.getItem("theme") || "dark";

themeBtn.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("theme", next);
});

/* ============================================
   BACK TO TOP
   ============================================ */
const backTopBtn = $("[data-back-top]");
window.addEventListener("scroll", () => backTopBtn.classList.toggle("active", scrollY > 300));
backTopBtn.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));

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
const counters = $$("[data-counter]");
const skillFills = $$("[data-skill-fill]");
let countersRan = false, skillsRan = false;

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
  skillFills.forEach((el, i) => setTimeout(() => { el.style.width = el.dataset.width + "%"; }, 200 + i * 100));
}

if (counters.length) {
  const co = createObserver(() => { animateCounters(); co.disconnect(); }, { threshold: 0.3 });
  co.observe(counters[0]);
}

if (skillFills.length) {
  const so = createObserver(() => { animateSkills(); so.disconnect(); }, { threshold: 0.2 });
  skillFills.forEach((f) => so.observe(f));
}

/* ============================================
   SIDEBAR
   ============================================ */
const sidebarEl = $("[data-sidebar]");
const sidebarBtnEl = $("[data-sidebar-btn]");
sidebarBtnEl?.addEventListener("click", () => {
  if (!sidebarEl) return;
  const isOpen = sidebarEl.classList.toggle("active");
  sidebarBtnEl.setAttribute("aria-expanded", String(isOpen));
  const label = $("span", sidebarBtnEl);
  if (label) label.textContent = isOpen ? "Hide Contacts" : "Show Contacts";
});

/* ============================================
   TESTIMONIALS MODAL
   ============================================ */
const testimModal = setupModal("[data-modal-container]", "[data-overlay]", "[data-modal-close-btn]");
const mImg = $("[data-modal-img]"), mTitle = $("[data-modal-title]"), mText = $("[data-modal-text]");

$(".testimonials-list")?.addEventListener("click", (e) => {
  const item = e.target.closest("[data-testimonials-item]");
  if (!item) return;
  const av = $("[data-testimonials-avatar]", item);
  if (!av) return;
  mImg.src = av.src; mImg.alt = av.alt;
  mTitle.innerHTML = $("[data-testimonials-title]", item).innerHTML;
  mText.innerHTML = $("[data-testimonials-text]", item).innerHTML;
  testimModal.open();
});

/* ============================================
   CERTIFICATE MODAL
   ============================================ */
const certModal = setupModal("[data-cert-modal]", "[data-cert-overlay]", "[data-cert-close]");
const ce = {
  icon: $("[data-cert-modal-icon]"), status: $("[data-cert-modal-status]"),
  title: $("[data-cert-modal-title]"), issuer: $("[data-cert-modal-issuer]"),
  id: $("[data-cert-modal-id]"), date: $("[data-cert-modal-date]"),
  expiry: $("[data-cert-modal-expiry]"), statusText: $("[data-cert-modal-status-text]"),
  url: $("[data-cert-modal-url]"),
};

function openCertFromCard(card) {
  if (!card || !certModal.container) return;
  const d = card.dataset;
  if (ce.title) ce.title.textContent = d.certTitle || "Credential";
  if (ce.issuer) ce.issuer.textContent = d.certIssuer || "—";
  if (ce.id) ce.id.textContent = d.certId || "—";
  if (ce.date) ce.date.textContent = d.certDate || "—";
  if (ce.expiry) ce.expiry.textContent = d.certExpiry || "No Expiration";
  if (ce.statusText) ce.statusText.textContent = d.certStatus === "ALUMNI" ? "ALUMNI" : (d.certStatus || "Active");
  const statusLabel = ce.status ? ($("span", ce.status) || ce.status) : null;
  if (statusLabel) statusLabel.textContent = d.certStatus === "ALUMNI" ? "Alumni Credential" : "Verified Credential";
  if (ce.icon) ce.icon.innerHTML = renderIcon(d.certIcon || "ribbon-outline");
  const verifyHref = safeUrl(d.certUrl, "#");
  if (ce.url) {
    if (verifyHref !== "#") {
      ce.url.href = verifyHref;
      ce.url.classList.remove("disabled");
      ce.url.removeAttribute("aria-disabled");
    } else {
      ce.url.href = "#";
      ce.url.classList.add("disabled");
      ce.url.setAttribute("aria-disabled", "true");
    }
  }
  certModal.open();
}

ce.url?.addEventListener("click", (e) => {
  if (ce.url.classList.contains("disabled") || ce.url.getAttribute("href") === "#") {
    e.preventDefault();
  }
});

const certListEl = $(".certificates-list");
certListEl?.addEventListener("click", (e) => {
  const card = e.target.closest("[data-cert-item]");
  if (card) openCertFromCard(card);
});
certListEl?.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const card = e.target.closest("[data-cert-item]");
  if (card) {
    e.preventDefault();
    openCertFromCard(card);
  }
});

// Prevent placeholder '#' project links from clearing URL hash & redirecting to About
$(".project-list")?.addEventListener("click", (e) => {
  const link = e.target.closest("a");
  if (!link) return;
  const href = (link.getAttribute("href") || "").trim();
  if (!href || href === "#") e.preventDefault();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (certModal.container?.classList.contains("active")) certModal.close();
    if (testimModal.container?.classList.contains("active")) testimModal.close();
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
  filterItems.forEach((item) => item.classList.toggle("active", value === "all" || value === item.dataset.category));
}

if (selectEl) selectEl.addEventListener("click", () => selectEl.classList.toggle("active"));

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
const form = $("[data-form]"), formBtn = $("[data-form-btn]"), formMsg = $("[data-form-message]");

function showFormMsg(text, type) {
  formMsg.textContent = text;
  formMsg.className = `form-message ${type}`;
  formMsg.style.display = "block";
  if (type === "success") setTimeout(() => { formMsg.style.display = "none"; }, 5000);
}

$$("[data-form-input]").forEach((input) => {
  input.addEventListener("input", () => { formBtn.disabled = !form.checkValidity(); });
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formMsg.className = "form-message";
  formMsg.style.display = "none";

  // 1. Gather data (including the honeypot)
  const data = {
    name: form.fullname.value.trim(),
    email: form.email.value.trim(),
    message: form.message.value.trim(),
    website: form.querySelector('[name="website"]')?.value || "", // Honeypot
  };

  if (!data.name || !data.email || !data.message) {
    showFormMsg("Please fill all required fields.", "error");
    return;
  }

  formBtn.disabled = true;
  const btnSpan = $("span", formBtn);
  const orig = btnSpan.textContent;
  btnSpan.textContent = "Sending...";

  try {
    // 2. Send to our in-house API
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await res.json();

    if (!res.ok) {
      if (res.status === 429) {
        showFormMsg("⏱ Please wait a few minutes before sending another message.", "error");
      } else {
        throw new Error(result.error || "Failed to send");
      }
      formBtn.disabled = false;
      btnSpan.textContent = orig;
      return;
    }

    // 3. Success!
    form.reset();
    formBtn.disabled = true;
    showFormMsg("✓ Message sent successfully! I'll get back to you soon.", "success");
  } catch (err) {
    showFormMsg("✗ Failed to send. Please try again or email me directly.", "error");
    formBtn.disabled = false;
  }
  btnSpan.textContent = orig;
});

/* ============================================
   DYNAMIC CV GENERATOR (OPTIMIZED: LAZY LOADED)
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
      const display = u.hostname.replace("www.", "") + u.pathname.replace(/\/$/, "");
      if (a.href.includes("linkedin")) social.linkedin = display;
      if (a.href.includes("github")) social.github = display;
    } catch { /* skip */ }
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
    summary: $$(".about-text p").map((p) => p.textContent.trim()).join(" "),
    skills: $$(".tech-stack-item span").map((s) => s.textContent.trim()).filter(Boolean),
    experience: timelines[0] ? extractTimeline(timelines[0]) : [],
    education: timelines[1] ? extractTimeline(timelines[1]) : [],
    certificates: $$("[data-cert-item]").map((c) => ({ title: c.dataset.certTitle, issuer: c.dataset.certIssuer })),
  };
}

function buildCVHTML(d) {
  const S = {
    heading: `font-size:11px;text-transform:uppercase;color:#2ecc87;border-bottom:1.5px solid #e0e0e0;padding-bottom:3px;margin:0 0 7px;font-weight:700;letter-spacing:1px`,
    section: `margin-bottom:10px;page-break-inside:auto`,
    jobWrap: `margin-bottom:8px;page-break-inside:avoid`,
    jobHeader: `display:flex;justify-content:space-between;align-items:baseline;margin-bottom:1px`,
    jobTitle: `font-size:11px;color:#0d1117`,
    jobDate: `font-size:9.5px;color:#777;white-space:nowrap;margin-left:10px`,
    jobCompany: `font-size:10px;color:#2ecc87;margin:0 0 3px;font-weight:600`,
    bullets: `margin:0;padding-left:14px;color:#444;font-size:10px;line-height:1.55`,
    badge: `background:#e8f5ee;color:#1a7a4c;padding:1px 6px;border-radius:3px;margin:1px 2px 1px 0;display:inline-block;font-weight:600;font-size:9.5px`,
  };
  const heading = (text) => `<h2 style="${S.heading}">${text}</h2>`;
  const contactParts = [d.contacts.email && `✉ ${d.contacts.email}`, d.contacts.phone && `☎ ${d.contacts.phone}`, d.contacts.location && `⌖ ${d.contacts.location}`].filter(Boolean);
  const socialParts = [d.social.linkedin && `⊞ ${d.social.linkedin}`, d.social.github && `⌥ ${d.social.github}`].filter(Boolean);

  const expHTML = d.experience.map((exp) => exp.roles.map((r) => {
    const bullets = r.desc ? r.desc.split(/\.\s+/).map((s) => s.replace(/\.$/, "").trim()).filter((s) => s.length > 10).map((s) => `<li>${s}</li>`).join("") : "";
    return `<div style="${S.jobWrap}"><div style="${S.jobHeader}"><strong style="${S.jobTitle}">${r.title}</strong><span style="${S.jobDate}">${r.date}</span></div><p style="${S.jobCompany}">${exp.company}</p>${bullets ? `<ul style="${S.bullets}">${bullets}</ul>` : ""}</div>`;
  }).join("")).join("");

  const eduHTML = d.education.map((edu) => edu.roles.map((r) => `<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;page-break-inside:avoid"><div><strong style="${S.jobTitle}">${r.title}</strong><p style="font-size:10px;color:#555;margin:1px 0 0">${edu.company}</p></div><span style="${S.jobDate}">${edu.meta || r.date}</span></div>`).join("")).join("");
  const certHTML = d.certificates.map((c) => `<li style="margin-bottom:1px"><strong>${c.title}</strong> — ${c.issuer}</li>`).join("");

  return `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:780px;margin:0 auto;padding:20px 32px;color:#1a1a2e;line-height:1.45;font-size:10.5px"><div style="border-bottom:2.5px solid #2ecc87;padding-bottom:10px;margin-bottom:10px"><h1 style="font-size:22px;margin:0 0 2px;color:#0d1117;font-weight:800;letter-spacing:-0.5px">${d.name.toUpperCase()}</h1><p style="font-size:12px;color:#2ecc87;margin:0 0 6px;font-weight:700;letter-spacing:0.5px">${d.title}</p><p style="font-size:9.5px;color:#555;margin:0;line-height:1.6">${contactParts.join(" &nbsp;|&nbsp; ")}${socialParts.length ? "<br>" + socialParts.join(" &nbsp;|&nbsp; ") : ""}</p></div><div style="${S.section}">${heading("Professional Summary")}<p style="font-size:10px;color:#333;margin:0;line-height:1.55">${d.summary}</p></div><div style="${S.section}">${heading("Core Skills")}<div style="margin:0;line-height:1.6">${d.skills.map((s) => `<span style="${S.badge}">${s}</span>`).join("")}</div></div><div style="${S.section};page-break-before:auto">${heading("Professional Experience")}${expHTML}</div><div style="${S.section}">${heading("Education")}${eduHTML}</div><div style="margin-bottom:0">${heading("Certifications")}<ul style="margin:0;padding-left:14px;color:#333;font-size:9.5px;line-height:1.65">${certHTML}</ul></div></div>`;
}

cvBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  trackEvent("cv_download");

  // ✅ OPTIMIZATION: Dynamically load html2pdf ONLY when the button is clicked
  if (typeof window.html2pdf === "undefined") {
    cvBtn.classList.add("generating");
    const span = $("span", cvBtn);
    const orig = span.textContent;
    span.textContent = "Loading PDF engine...";

    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    } catch (err) {
      alert("Failed to load PDF library. Please check your internet connection.");
      span.textContent = orig;
      cvBtn.classList.remove("generating");
      return;
    }
    // Reset button state before proceeding to generation
    span.textContent = orig;
    cvBtn.classList.remove("generating");
  }

  // Proceed with your existing generation logic
  cvBtn.classList.add("generating");
  const span = $("span", cvBtn);
  const orig = span.textContent;
  span.textContent = "Generating...";

  const cvData = extractCVData();
  const tmp = document.createElement("div");
  tmp.innerHTML = buildCVHTML(cvData);
  Object.assign(tmp.style, { position: "fixed", left: "-9999px", top: "0", background: "white" });
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
      html2canvas: { scale: 2, useCORS: true, letterRendering: true, backgroundColor: "#ffffff" },
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
   ANALYTICS TRACKING (IN-HOUSE)
   ============================================ */
function trackEvent(eventType, page = null) {
  // Fire-and-forget: sends data to API without blocking the UI
  fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event_type: eventType, page }),
    keepalive: true, // Ensures request finishes even if navigating away
  }).catch(() => { }); // Silently fail if offline
}

/* ============================================
   PAGE NAVIGATION (ACCESSIBLE ARIA TABS)
   ============================================ */
const navLinks = $$("[data-nav-link]");
const pages = $$("[data-page]");

function navigateToPage(pageName) {
  pages.forEach((p) => p.classList.toggle("active", p.dataset.page === pageName));
  navLinks.forEach((l) => {
    const isAct = (l.querySelector("span")?.textContent || l.textContent).trim().toLowerCase() === pageName;
    l.classList.toggle("active", isAct);
    l.setAttribute("aria-selected", isAct ? "true" : "false");
  });
  scrollTo(0, 0);

  // Update document title for accessibility & browser history
  const formattedTitle = pageName.charAt(0).toUpperCase() + pageName.slice(1);
  document.title = `${formattedTitle} | Yohannes Mesfin`;

  // Directly track page view event for accurate analytics
  trackEvent("page_view", pageName);

  countersRan = false; skillsRan = false;
  skillFills.forEach((f) => (f.style.width = "0%"));
  counters.forEach((c) => (c.textContent = "0"));

  setTimeout(() => {
    reObserveReveals();
    if (pageName === "about" && counters.length) {
      const o = createObserver(() => { animateCounters(); o.disconnect(); }, { threshold: 0.3 });
      o.observe(counters[0]);
    }
    if (pageName === "resume" && skillFills.length) {
      const o = createObserver(() => { animateSkills(); o.disconnect(); }, { threshold: 0.2 });
      skillFills.forEach((f) => o.observe(f));
    }
  }, 300);
}

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    const name = (link.querySelector("span")?.textContent || link.textContent).trim().toLowerCase();
    location.hash = name;
    navigateToPage(name);
  });
});

/* ============================================
   INITIAL HASH ROUTING
   ============================================ */
function handleInitialRoute() {
  const hash = location.hash.slice(1).toLowerCase();
  const valid = pages.map((p) => p.dataset.page);
  if (hash && hash !== "about" && valid.includes(hash)) {
    navigateToPage(hash);
  } else {
    trackEvent("page_view", "about");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", handleInitialRoute, { once: true });
} else {
  handleInitialRoute();
}

window.addEventListener("hashchange", () => {
  const hash = location.hash.slice(1).toLowerCase();
  const valid = pages.map((p) => p.dataset.page);
  if (hash && valid.includes(hash)) navigateToPage(hash);
  else if (!hash) navigateToPage("about");
});

/* ============================================
   CMS DATA LOADER (THE HANDSHAKE)
   ============================================ */
function mdHighlight(text) {
  return escapeHtml(text).replace(/\*\*(.*?)\*\*/g, '<span class="highlight">$1</span>');
}

function cmsRenderProfile(profile, typTexts) {
  if (!profile) return;
  const nameEl = $(".sidebar .name");
  if (nameEl && profile.name) {
    nameEl.textContent = profile.name;
    nameEl.title = profile.name;
  }
  const avatarImg = $(".avatar-box img");
  if (avatarImg && profile.avatar_url) avatarImg.src = safeUrl(profile.avatar_url, "/assets/images/my-avatar.png");

  if (profile.company) {
    localStorage.setItem("portfolio_company", profile.company);
  }

  if (typTexts?.length) {
    typingTexts.length = 0;
    typTexts.forEach((t) => typingTexts.push(t.text));
    tIdx = 0; cIdx = 0; deleting = false;
  }

  const statusBadge = $(".status-badge");
  if (statusBadge) {
    const status = profile.availability || "available";
    statusBadge.setAttribute("data-status", status);
    const titles = { available: "Available for hire", busy: "Busy — limited availability", unavailable: "Not available for hire" };
    statusBadge.setAttribute("title", titles[status] || titles.available);
  }
}

function cmsRenderAbout(aboutText) {
  const el = $(".about-text");
  if (!el || !aboutText) return;
  el.innerHTML = aboutText.split("\n\n").filter((p) => p.trim()).map((p) => `<p>${mdHighlight(p.trim())}</p>`).join("");
}

function cmsRenderContacts(contacts) {
  const el = $(".contacts-list");
  if (!el || !contacts?.length) return;
  el.innerHTML = contacts
    .map(
      (c) => `
    <li class="contact-item">
      <div class="icon-box">${renderIcon(c.icon)}</div>
      <div class="contact-info">
        <p class="contact-title">${escapeHtml(c.type)}</p>
        ${c.type === "Location"
          ? `<address>${escapeHtml(c.value)}</address>`
          : `<a href="${escapeHtml((c.type === "Email" ? "mailto:" : "tel:") + String(c.value || "").replace(/\s/g, ""))}" class="contact-link">${escapeHtml(c.value)}</a>`
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
      <a href="${escapeHtml(safeUrl(s.url))}" class="social-link" title="${escapeHtml(s.platform)}" target="_blank"
         rel="noopener noreferrer" aria-label="${escapeHtml(s.platform)}">
        ${renderIcon(s.icon)}
      </a>
    </li>`,
    )
    .join("");
}

function cmsRenderStats(stats) {
  const el = $(".stats-list");
  if (!el || !stats?.length) return;
  el.innerHTML = stats.map((s) => `
    <li class="stats-item" data-reveal="${escapeHtml(s.reveal || "bottom")}">
      <div class="stats-icon-box">${renderIcon(s.icon)}</div>
      <div class="stats-content">
        <span class="stats-number" data-counter="${Number(s.value) || 0}">0</span>
        <span class="stats-suffix">${escapeHtml(s.suffix || "")}</span>
      </div>
      <p class="stats-label">${escapeHtml(s.label)}</p>
    </li>`).join("");
}

function cmsRenderServices(services) {
  const el = $(".service-list");
  if (!el || !services?.length) return;
  el.innerHTML = services.map((s) => `
    <li class="service-item" data-reveal="${escapeHtml(s.reveal || "left")}">
      <div class="service-icon-box">
        <span class="service-icon">${renderIcon(s.icon)}</span>
      </div>
      <div class="service-content-box">
        <h4 class="h4 service-item-title">${escapeHtml(s.title)}</h4>
        <p class="service-item-text">${escapeHtml(s.description)}</p>
      </div>
    </li>`).join("");
}

function cmsRenderTechStack(items) {
  const el = $(".tech-stack-list");
  if (!el || !items?.length) return;
  el.innerHTML = items
    .map(
      (t) => `
    <li class="tech-stack-item" data-reveal="bottom" title="${escapeHtml(t.name)}">
      ${renderIcon(t.icon)}<span>${escapeHtml(t.name)}</span>
    </li>`,
    )
    .join("");
}

function cmsRenderTestimonials(items) {
  const el = $(".testimonials-list");
  if (!el || !items?.length) return;
  el.innerHTML = items.map((t) => `
    <li class="testimonials-item">
      <div class="content-card" data-testimonials-item>
        <figure class="testimonials-avatar-box">
          <img src="${escapeHtml(safeUrl(t.avatar_url, "/assets/images/avatar-1.png"))}" alt="${escapeHtml(t.name)}" width="60" data-testimonials-avatar />
        </figure>
        <h4 class="h4 testimonials-item-title" data-testimonials-title>${escapeHtml(t.name)}</h4>
        <div class="testimonials-text" data-testimonials-text><p>${escapeHtml(t.text)}</p></div>
      </div>
    </li>`).join("");
}

function cmsRenderTimeline(companies, timelineEl) {
  if (!timelineEl || !companies?.length) return;
  const tw = timelineEl.querySelector(".title-wrapper");
  timelineEl.innerHTML = "";
  if (tw) timelineEl.appendChild(tw);

  companies.forEach((c) => {
    const singleCls = c.is_single ? " timeline-group-single" : "";
    let locationStr = "";
    if (c.meta) {
      const locMatch = c.meta.match(/·\s*(.+)$/);
      if (locMatch) locationStr = locMatch[1].trim();
      else if (!/\d{4}/.test(c.meta)) locationStr = c.meta.trim();
    }

    const liveDuration = computeGroupDuration(c.roles);
    const metaDisplay = liveDuration ? (locationStr ? `${liveDuration} · ${locationStr}` : liveDuration) : c.meta || "";

    const parseTags = (t) => {
      try {
        const arr = JSON.parse(t || "[]");
        return Array.isArray(arr) && arr.length ? `<ul class="timeline-tags">${arr.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>` : "";
      } catch { return ""; }
    };

    timelineEl.insertAdjacentHTML("beforeend", `
      <div class="timeline-group${singleCls}" data-reveal="left">
        <div class="timeline-group-header">
          <div class="timeline-group-icon">${renderIcon(c.icon)}</div>
          <div class="timeline-group-info">
            <h4 class="h4 timeline-group-company">${escapeHtml(c.name)}</h4>
            <span class="timeline-group-meta">${escapeHtml(metaDisplay)}</span>
          </div>
        </div>
        <div class="timeline-group-roles">
          ${c.roles.map((r) => {
      const liveDate = calcDuration(r.date_range) || r.date_range || "";
      return `
              <div class="timeline-role">
                <div class="timeline-role-dot"></div>
                <div class="timeline-role-content">
                  <h5 class="timeline-role-title">${escapeHtml(r.title)}</h5>
                  <span class="timeline-role-date">${escapeHtml(liveDate)}</span>
                  ${r.description ? `<p class="timeline-text">${escapeHtml(r.description)}</p>` : ""}
                  ${parseTags(r.tags)}
                </div>
              </div>`;
    }).join("")}
        </div>
      </div>`);
  });
}

function cmsRenderSkills(skills) {
  const el = $(".skills-list");
  if (!el || !skills?.length) return;
  el.innerHTML = skills.map((s) => {
    const pct = Math.max(0, Math.min(100, Number(s.percentage) || 0));
    return `
    <li class="skills-item">
      <div class="title-wrapper">
        <h5 class="h5">${escapeHtml(s.name)}</h5>
        <data value="${pct}">${pct}%</data>
      </div>
      <div class="skill-progress-bg">
        <div class="skill-progress-fill" data-skill-fill style="width:0%" data-width="${pct}"></div>
      </div>
    </li>`;
  }).join("");
}

function cmsRenderProjects(projects) {
  const el = $(".project-list");
  if (!el || !projects?.length) return;
  const categories = [...new Set(projects.map((p) => String(p.category || "").trim()).filter(Boolean))];
  const filterList = $(".filter-list");
  const selectList = $(".select-list");

  if (filterList) {
    filterList.innerHTML = `<li class="filter-item"><button class="active" data-filter-btn>All</button></li>` +
      categories.map((c) => `<li class="filter-item"><button data-filter-btn>${escapeHtml(c.charAt(0).toUpperCase() + c.slice(1))}</button></li>`).join("");
  }
  if (selectList) {
    selectList.innerHTML = `<li class="select-item"><button data-select-item>All</button></li>` +
      categories.map((c) => `<li class="select-item"><button data-select-item>${escapeHtml(c.charAt(0).toUpperCase() + c.slice(1))}</button></li>`).join("");
  }

  el.innerHTML = projects.map((p) => {
    const href = safeUrl(p.link, "#");
    const externalAttrs = href !== "#" ? ` target="_blank" rel="noopener noreferrer"` : "";
    const cat = String(p.category || "").toLowerCase();
    return `
    <li class="project-item active" data-filter-item data-category="${escapeHtml(cat)}" data-reveal="bottom">
      <a href="${escapeHtml(href)}"${externalAttrs}>
        <figure class="project-img">
          <div class="project-item-icon-box"><ion-icon name="eye-outline"></ion-icon></div>
          <img src="${escapeHtml(safeUrl(p.image_url, "/assets/images/project-1.jpg"))}" alt="${escapeHtml(p.title)}" loading="lazy" />
        </figure>
        <h3 class="project-title">${escapeHtml(p.title)}</h3>
        <p class="project-category">${escapeHtml(p.description || p.category)}</p>
      </a>
    </li>`;
  }).join("");
}

function cmsRenderCertificates(certs) {
  const el = $(".certificates-list");
  if (!el || !certs?.length) return;
  el.innerHTML = certs.map((c) => `
    <li class="certificate-item" data-reveal="bottom">
      <div class="certificate-card" data-cert-item role="button" tabindex="0"
        data-cert-title="${escapeHtml(c.title)}" data-cert-issuer="${escapeHtml(c.issuer)}"
        data-cert-id="${escapeHtml(c.credential_id)}" data-cert-date="${escapeHtml(c.issue_date)}"
        data-cert-expiry="${escapeHtml(c.expiry)}" data-cert-url="${escapeHtml(safeUrl(c.verify_url, "#"))}"
        data-cert-status="${escapeHtml(c.status)}" data-cert-icon="${escapeHtml(c.icon || "ribbon-outline")}">
        <div class="certificate-eye-overlay">
          <ion-icon name="eye-outline"></ion-icon>
          <span>View Credential</span>
        </div>
        <div class="certificate-icon">${renderIcon(c.icon || "ribbon-outline")}</div>
        <div class="certificate-content">
          <h3 class="h4 certificate-title">${escapeHtml(c.title)}</h3>
          <p class="certificate-issuer">${escapeHtml(c.issuer)}</p>
          <span class="certificate-badge">${escapeHtml(c.status)}</span>
        </div>
      </div>
    </li>`).join("");
}

/* ─── Re-initialize all dynamic elements after CMS render ─── */
function reinitAfterCMSRender() {
  const newCounters = $$("[data-counter]");
  const newSkillFills = $$("[data-skill-fill]");
  const newFilterItems = $$("[data-filter-item]");
  const newFilterBtns = $$("[data-filter-btn]");
  const newSelectItems = $$("[data-select-item]");

  counters.length = 0; newCounters.forEach((c) => counters.push(c));
  skillFills.length = 0; newSkillFills.forEach((f) => skillFills.push(f));
  filterItems.length = 0; newFilterItems.forEach((i) => filterItems.push(i));

  countersRan = false; skillsRan = false;
  reObserveReveals();

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

  newSelectItems.forEach((item) => {
    item.addEventListener("click", () => {
      const val = item.textContent.toLowerCase();
      if (selectValue) selectValue.textContent = item.textContent;
      if (selectEl) selectEl.classList.remove("active");
      applyFilter(val);
    });
  });

  if (counters.length) {
    const co = createObserver(() => { animateCounters(); co.disconnect(); }, { threshold: 0.3 });
    co.observe(counters[0]);
  }
  if (skillFills.length) {
    const so = createObserver(() => { animateSkills(); so.disconnect(); }, { threshold: 0.2 });
    skillFills.forEach((f) => so.observe(f));
  }
  refreshDurations();
}

/* ─── Main CMS Data Loader ─── */
async function loadCMSData() {
  try {
    const res = await fetch("/api/portfolio");
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();

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

    const resumeTimelines = $$('[data-page="resume"] .timeline');
    if (resumeTimelines[0] && data.experience?.length) cmsRenderTimeline(data.experience, resumeTimelines[0]);
    if (resumeTimelines[1] && data.education?.length) cmsRenderTimeline(data.education, resumeTimelines[1]);

    reinitAfterCMSRender();
    console.log("✅ CMS data loaded — " + new Date().toLocaleTimeString());
  } catch (err) {
    console.log("📄 Using static HTML (CMS: " + err.message + ")");
    refreshDurations();
  }
}

// Load CMS data on startup
loadCMSData();
refreshDurations();

/* ============================================
   REAL-TIME UPDATES (POLLING)
   ============================================ */
let lastKnownUpdate = null;
let pollInterval = null;

async function checkForUpdates() {
  try {
    // Safety guard: do not wipe/reload DOM while user is typing in form or viewing a modal
    if (document.querySelector("[data-form]:focus-within") || document.querySelector(".modal-container.active") || document.querySelector(".cert-modal-container.active")) return;
    const res = await fetch("/api/meta");
    if (!res.ok) return;
    const data = await res.json();

    if (data.last_updated && data.last_updated !== lastKnownUpdate) {
      if (lastKnownUpdate !== null) {
        console.log("🔄 Site update detected — updating CMS data...");
        await loadCMSData();
      }
      lastKnownUpdate = data.last_updated;
    }
  } catch (err) {
    // Silently fail
  }
}

function startPolling() {
  if (pollInterval) return;
  checkForUpdates();
  // Poll every 60 seconds instead of 5s to avoid exhausting serverless invocations and DB quota
  pollInterval = setInterval(checkForUpdates, 60000);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

startPolling();

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopPolling();
  } else {
    startPolling();
  }
});
