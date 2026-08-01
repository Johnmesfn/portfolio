"use strict";
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const API = "/api";
const SESSION_KEY = "admin_session_expiry";
let TOKEN = localStorage.getItem("admin_token");
let currentTab = "", currentUser = "";
const _cache = {};
const esc = v => { const d = document.createElement("div"); d.textContent = v == null ? "" : String(v); return d.innerHTML; };

function getSessionExpiry() { return parseInt(localStorage.getItem(SESSION_KEY) || "0", 10) || 0; }
function isSessionExpired() { return getSessionExpiry() <= Date.now(); }
function clearSession() { TOKEN = null; localStorage.removeItem("admin_token"); localStorage.removeItem(SESSION_KEY); }

function togglePw(target) {
  const input = typeof target === "string" ? document.getElementById(target) : target;
  if (!input) return;
  const btn = input.closest(".pw-wrap")?.querySelector(".pw-toggle");
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  if (btn) btn.innerHTML = `<ion-icon name="${show ? "eye-off-outline" : "eye-outline"}"></ion-icon>`;
}

function bindPwToggles(root) {
  const wrap = root instanceof Element ? root : document;
  wrap.querySelectorAll(".pw-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.pwToggle;
      togglePw(id ? document.getElementById(id) : btn.closest(".pw-wrap")?.querySelector("input"));
    });
  });
}

function renderIcon(name) {
  if (!name) return '';
  if (name.startsWith('dev:')) return `<i class="devicon-${name.substring(4)} colored"></i>`;
  if (name.startsWith('si:')) return `<i class="si si-${name.substring(3)}"></i>`;
  if (name.startsWith('bi:')) return `<i class="bi bi-${name.substring(3)}"></i>`;
  if (name.includes(':')) return `<iconify-icon icon="${name}" width="22" height="22"></iconify-icon>`;
  return `<ion-icon name="${name}"></ion-icon>`;
}

async function apiFetch(endpoint, method = "GET", body = null) {
  if (isSessionExpired()) { logout("Session expired"); throw new Error("Session expired"); }
  if (method === "GET" && _cache[endpoint]) return _cache[endpoint];
  const opts = { method, headers: { Authorization: "Bearer " + TOKEN } };
  if (body) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
  const res = await fetch(API + endpoint, opts);
  if (res.status === 401) { logout("Session expired"); throw new Error("Session expired"); }
  let data;
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) data = await res.json();
  else data = { error: `Server error (${res.status})` };
  if (!res.ok) throw new Error(data.error || "Request failed");
  if (method === "GET") _cache[endpoint] = data;
  return data;
}

function clearCache() { Object.keys(_cache).forEach(key => delete _cache[key]); }
function showLoading(el) { el.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading data...</p></div>`; }
function toast(msg, type = "ok") {
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.innerHTML = `<ion-icon name="${type === "ok" ? "checkmark-circle" : "alert-circle"}"></ion-icon>${esc(msg)}`;
  $("#toasts").appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 300); }, 3500);
}
function cfmDialog(title, text) {
  return new Promise(resolve => {
    $("#cfm-title").textContent = title; $("#cfm-text").textContent = text;
    $("#cfm-ov").classList.add("open");
    const done = v => { $("#cfm-ov").classList.remove("open"); resolve(v); };
    $("#cfm-cancel").onclick = () => done(false); $("#cfm-ok").onclick = () => done(true);
  });
}
const openModal = html => { $("#modal-box").innerHTML = html; $("#modal-ov").classList.add("open"); };
const closeModal = () => { $("#modal-ov").classList.remove("open"); };
$("#modal-ov").addEventListener("click", e => { if (e.target.id === "modal-ov") closeModal(); });
document.addEventListener("keydown", e => { if (e.key !== "Escape") return; closeModal(); $("#cfm-ov").classList.remove("open"); closePickers(); closeIconBrowser(); });
const closePickers = () => { $$(".dp-drop.open").forEach(d => d.classList.remove("open")); $$(".dp-trigger.open").forEach(t => t.classList.remove("open")); };
document.addEventListener("click", e => { if (!e.target.closest(".dp-wrap")) closePickers(); }, true);
const toBase64 = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });

function bindUploads(ctx = $("#modal-box")) {
  $$("[data-upload]", ctx).forEach(inp => {
    inp.addEventListener("change", async () => {
      const key = inp.dataset.upload, file = inp.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { toast("Image must be < 5 MB", "err"); return; }
      const st = $(`[data-ust="${key}"]`, ctx), pr = $$(`[data-preview="${key}"]`, ctx), hid = $(`[name="${key}"]`, ctx);
      if (st) { st.textContent = "Uploading…"; st.className = "upload-st busy"; }
      try {
        const d = await apiFetch("/upload", "POST", { image: await toBase64(file) });
        if (hid) hid.value = d.url;
        pr.forEach(img => img.src = d.url);
        if (st) { st.textContent = "✓ Uploaded"; st.className = "upload-st ok"; }
        clearCache();
      } catch (err) { if (st) { st.textContent = "✗ " + err.message; st.className = "upload-st err"; } }
    });
  });
}

const MONTHS_S = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_F = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function parseMY(str = "") {
  const match = str.trim().match(/^(\w+)\s+(\d{4})/);
  if (!match) return null;
  const mi = MONTHS_F.findIndex(n => n.toLowerCase().startsWith(match[1].toLowerCase().slice(0, 3)));
  return mi < 0 ? null : { m: mi, y: parseInt(match[2], 10) };
}
const fmtMY = ({ m, y }) => MONTHS_S[m] + " " + y;
let _uid = 0; const uid = () => "dp" + (++_uid);

function buildPicker(opts = {}) {
  const id = uid(); const val = opts.value || ""; const ph = opts.placeholder || "Select month & year";
  const isPresentNow = /^present$/i.test(val); const isNoneNow = /^no\s*expir/i.test(val);
  const parsed = (!isPresentNow && !isNoneNow) ? parseMY(val) : null;
  const dispTxt = isPresentNow ? "Present" : isNoneNow ? (opts.noneLabel || "No Expiration") : (parsed ? fmtMY(parsed) : "");
  const html = `<div class="dp-wrap" id="${id}w"><button type="button" class="dp-trigger" id="${id}t"><ion-icon class="cal-icon" name="calendar-outline"></ion-icon><span class="dp-text${dispTxt ? "" : " ph"}" id="${id}d">${esc(dispTxt || ph)}</span><ion-icon class="chev" name="chevron-down-outline"></ion-icon></button><input type="hidden" name="${opts.name}" id="${id}h" value="${esc(val)}" /><div class="dp-drop" id="${id}drop">${opts.hasPresent ? `<div class="dp-toggle-row${isPresentNow ? " on" : ""}" id="${id}pr"><span class="dp-toggle-label"><ion-icon name="radio-button-on-outline"></ion-icon>Currently working here</span><div class="toggle-pill${isPresentNow ? " on" : ""}" id="${id}pt"></div></div>` : ""}${opts.hasNone ? `<div class="dp-toggle-row${isNoneNow ? " on" : ""}" id="${id}nr"><span class="dp-toggle-label"><ion-icon name="infinite-outline"></ion-icon>${esc(opts.noneLabel || "No Expiration")}</span><div class="toggle-pill${isNoneNow ? " on" : ""}" id="${id}nt"></div></div>` : ""}<div class="dp-body${(isPresentNow || isNoneNow) ? " disabled" : ""}" id="${id}body"><div class="dp-year-nav"><button type="button" id="${id}py">‹</button><span class="dp-year-val" id="${id}yr">${parsed?.y ?? new Date().getFullYear()}</span><button type="button" id="${id}ny">›</button></div><div class="dp-months" id="${id}mg"></div></div><div class="dp-footer"><button type="button" class="btn btn-ghost btn-sm" id="${id}cl">Clear</button><button type="button" class="btn btn-primary btn-sm" id="${id}ap">Apply</button></div></div></div>`;
  function bind(root = document) {
    let selM = parsed?.m ?? null; let selY = parsed?.y ?? new Date().getFullYear(); let present = isPresentNow; let none = isNoneNow;
    const T = document.getElementById(id + "t"), D = document.getElementById(id + "d"), H = document.getElementById(id + "h"), drop = document.getElementById(id + "drop"), body = document.getElementById(id + "body"), yrEl = document.getElementById(id + "yr"), mg = document.getElementById(id + "mg"), prRow = document.getElementById(id + "pr"), prPl = document.getElementById(id + "pt"), nrRow = document.getElementById(id + "nr"), nrPl = document.getElementById(id + "nt");
    if (!T || !drop || !H) return;
    function renderMonths() { if (!yrEl || !mg) return; yrEl.textContent = selY; mg.innerHTML = MONTHS_S.map((m, i) => `<button type="button" class="dp-month${selM === i && !present && !none ? " sel" : ""}" data-m="${i}">${m}</button>`).join(""); mg.querySelectorAll(".dp-month").forEach(b => b.addEventListener("click", () => { selM = +b.dataset.m; present = false; none = false; syncToggles(); renderMonths(); })); }
    function syncToggles() { if (prRow) { prRow.classList.toggle("on", present); prPl.classList.toggle("on", present); } if (nrRow) { nrRow.classList.toggle("on", none); nrPl.classList.toggle("on", none); } if (body) body.classList.toggle("disabled", present || none); }
    function commit(val) { H.value = val; D.textContent = val || ph; D.classList.toggle("ph", !val); opts.onChange?.(val); }
    prRow?.addEventListener("click", () => { present = !present; if (present) none = false; syncToggles(); renderMonths(); });
    nrRow?.addEventListener("click", () => { none = !none; if (none) present = false; syncToggles(); renderMonths(); });
    document.getElementById(id + "py")?.addEventListener("click", () => { selY--; renderMonths(); });
    document.getElementById(id + "ny")?.addEventListener("click", () => { selY++; renderMonths(); });
    document.getElementById(id + "cl")?.addEventListener("click", () => { selM = null; present = false; none = false; syncToggles(); renderMonths(); commit(""); closeThisDrop(); });
    document.getElementById(id + "ap")?.addEventListener("click", () => { let v = ""; if (present) v = "Present"; else if (none) v = opts.noneLabel || "No Expiration"; else if (selM !== null) v = fmtMY({ m: selM, y: selY }); commit(v); closeThisDrop(); });
    function closeThisDrop() { drop.classList.remove("open"); T.classList.remove("open"); }
    T.addEventListener("click", e => { e.stopPropagation(); const wasOpen = drop.classList.contains("open"); closePickers(); if (!wasOpen) { drop.classList.add("open"); T.classList.add("open"); renderMonths(); } });
    drop.addEventListener("click", e => e.stopPropagation());
    renderMonths();
  }
  return { html, bind };
}

function buildRangePicker(name, value = "") {
  const rid = uid(); let sVal = "", eVal = "";
  const cleaned = value.replace(/·.*$/, "").trim();
  const parts = cleaned.split(/\s*[—–]\s*|\s*--\s*|\s+-\s+/);
  if (parts.length >= 2) { const sO = parseMY(parts[0]); sVal = sO ? fmtMY(sO) : ""; const eTok = parts[1].trim(); eVal = /^present$/i.test(eTok) ? "Present" : (parseMY(eTok) ? fmtMY(parseMY(eTok)) : ""); }
  const sKey = "__rs_" + rid, eKey = "__re_" + rid;
  let syncRange;
  const sP = buildPicker({ name: sKey, value: sVal, placeholder: "Start date", onChange: () => syncRange && syncRange() });
  const eP = buildPicker({ name: eKey, value: eVal, placeholder: "End date", hasPresent: true, onChange: () => syncRange && syncRange() });
  const html = `<div class="two-col"><div><div class="sub-label">Start</div>${sP.html}</div><div><div class="sub-label">End</div>${eP.html}</div></div><input type="hidden" name="${name}" id="${rid}rh" value="${esc(value)}" />`;
  function bind(root = document) {
    const H = document.getElementById(rid + "rh");
    syncRange = () => { const sv = root.querySelector(`[name="${sKey}"]`)?.value || ""; const ev = root.querySelector(`[name="${eKey}"]`)?.value || ""; H.value = sv && ev ? sv + " — " + ev : sv || ev || ""; };
    sP.bind(root); eP.bind(root); syncRange();
  }
  return { html, bind };
}

function buildMetaField(name, value = "") {
  const mid = uid(); let location = value;
  const dotI = value.indexOf("·"); if (dotI !== -1) location = value.slice(dotI + 1).trim();
  if (/^\d+\s*(month|year)/i.test(location)) location = "";
  const html = `<div class="meta-box" id="${mid}mb"><div class="meta-info"><ion-icon name="information-circle-outline"></ion-icon>Duration is auto-calculated from role dates — just enter the location below.</div><div class="loc-row"><ion-icon name="location-outline"></ion-icon><input type="text" id="${mid}loc" placeholder="e.g. Addis Ababa, Ethiopia" value="${esc(location)}" /></div></div><input type="hidden" name="${name}" id="${mid}h" value="${esc(location)}" />`;
  function bind(root = document) { const H = document.getElementById(mid + "h"); const loc = document.getElementById(mid + "loc"); if (!H || !loc) return; loc.addEventListener("input", () => { H.value = loc.value.trim(); }); }
  return { html, bind };
}

const BLANK_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' fill='%2321262d'/%3E%3C/svg%3E";

function buildField(f, item) {
  const val = item?.[f.key] ?? ""; const ph = f.ph || ""; const binders = []; let html = "";
  switch (f.type) {
    case "monthyear": { const p = buildPicker({ name: f.key, value: val, placeholder: "Select month & year" }); binders.push(r => p.bind(r)); html = fieldWrap(f.label, p.html); break; }
    case "monthyear_optional": { const p = buildPicker({ name: f.key, value: val, placeholder: "Select expiry or choose no expiration", hasNone: true, noneLabel: "No Expiration" }); binders.push(r => p.bind(r)); html = fieldWrap(f.label, p.html); break; }
    case "daterange": { const p = buildRangePicker(f.key, val); binders.push(r => p.bind(r)); html = fieldWrap(f.label, p.html); break; }
    case "meta": { const p = buildMetaField(f.key, val); binders.push(r => p.bind(r)); html = fieldWrap(f.label, p.html); break; }
    case "textarea": html = fieldWrap(f.label, `<textarea name="${f.key}" placeholder="${esc(ph)}">${esc(val)}</textarea>`); break;
    case "select": { const opts = (f.options || []).map(o => `<option value="${o}"${String(val) === String(o) ? " selected" : ""}>${o}</option>`).join(""); html = fieldWrap(f.label, `<select name="${f.key}">${opts}</select>`); break; }
    case "image": html = fieldWrap(f.label, `<div class="upload-area"><label class="upload-thumb-wrap"><img src="${esc(val) || BLANK_IMG}" class="upload-thumb" data-preview="${f.key}" /><div class="upload-overlay"><ion-icon name="camera-outline"></ion-icon></div><input type="file" accept="image/*" data-upload="${f.key}" style="display:none" /></label><div class="upload-ctrl"><input type="hidden" name="${f.key}" value="${esc(val)}" /><span class="upload-st" data-ust="${f.key}">${val ? "Current image" : "No image"}</span></div></div>`); break;
    case "icon": { const p = buildIconPicker(f.key, val); binders.push(r => p.bind(r)); html = fieldWrap(f.label, p.html); break; }
    default: html = fieldWrap(f.label, `<input type="${f.type}" name="${f.key}" value="${esc(val)}" placeholder="${esc(ph)}" />`);
  }
  return { html, binders };
}
const fieldWrap = (label, inner) => `<div class="field"><label>${label}</label>${inner}</div>`;
function buildFields(fields, item) {
  const all = fields.map(f => buildField(f, item));
  const html = all.map(x => x.html).join("");
  const bind = (root = document) => all.forEach(x => x.binders.forEach(b => b(root)));
  return { html, bind };
}
function collectForm(fields, ctx = $("#modal-box")) {
  const body = {};
  fields.forEach(f => { const el = $(`[name="${f.key}"]`, ctx); if (!el) return; body[f.key] = f.type === "number" ? (+el.value || 0) : (el.value || ""); });
  return body;
}

const ICON_CATEGORIES = {
  "All": null,
  "Tech & Testing (Devicon)": [
    "dev:python-plain", "dev:javascript-plain", "dev:typescript-plain", "dev:java-plain",
    "dev:selenium-original", "dev:cypress-plain", "dev:pytest-plain", "dev:junit-plain",
    "dev:react-original", "dev:vuejs-plain", "dev:angularjs-plain", "dev:nodejs-plain",
    "dev:html5-plain", "dev:css3-plain", "dev:sass-original", "dev:php-plain", "dev:ruby-plain",
    "dev:go-original-wordmark", "dev:rust-plain", "dev:swift-plain", "dev:kotlin-plain"
  ],
  "DevOps & Cloud (Devicon/Bootstrap)": [
    "dev:docker-plain", "dev:kubernetes-plain", "dev:jenkins-plain", "dev:git-plain",
    "dev:gitlab-plain", "dev:github-original", "dev:ansible-plain", "dev:terraform-plain",
    "dev:amazonwebservices-plain-wordmark", "dev:azure-plain", "dev:googlecloud-plain",
    "dev:heroku-plain", "dev:digitalocean-original", "dev:nginx-original", "dev:apache-plain",
    "dev:linux-plain", "dev:ubuntu-plain", "dev:redhat-plain",
    "bi:aws", "bi:microsoft", "bi:google", "bi:cloud-fill", "bi:server", "bi:diagram-3"
  ],
  "Brands & Tools (Simple Icons)": [
    "si:linkedin", "si:github", "si:twitter", "si:facebook", "si:instagram", "si:youtube",
    "si:whatsapp", "si:telegram", "si:discord", "si:slack", "si:medium", "si:stackoverflow",
    "si:reddit", "si:tiktok", "si:pinterest", "si:upwork", "si:fiverr", "si:dribbble",
    "si:figma", "si:adobe", "si:notion", "si:netlify", "si:vercel", "si:cloudflare",
    "si:postman", "si:swagger", "si:jira", "si:confluence", "si:trello", "si:bitbucket"
  ],
  "QA & Testing (Iconify)": [
    "mdi:robot", "mdi:test-tube", "mdi:flask", "mdi:bug-check", "mdi:check-circle",
    "mdi:shield-check", "mdi:security", "mdi:lock-check", "mdi:eye-check",
    "mdi:clipboard-check", "mdi:clipboard-list", "mdi:file-document-check",
    "mdi:checkbox-marked-circle", "mdi:check-all", "mdi:tick-circle"
  ],
  "UI & Actions (Ionicons)": [
    "mail-outline", "call-outline", "location-outline", "globe-outline", "person-outline",
    "people-outline", "briefcase-outline", "school-outline", "ribbon-outline", "trophy-outline",
    "star-outline", "checkmark-circle-outline", "shield-checkmark-outline", "code-slash-outline",
    "terminal-outline", "speedometer-outline", "analytics-outline", "pie-chart-outline",
    "rocket-outline", "cloud-upload-outline", "download-outline", "share-social-outline",
    "link-outline", "eye-outline", "settings-outline"
  ],
  "UI & Misc (Bootstrap)": [
    "bi:award", "bi:patch-check", "bi:clock-history", "bi:calendar-check", "bi:graph-up-arrow",
    "bi:bar-chart-line", "bi:bug", "bi:shield-lock", "bi:lock", "bi:key", "bi:fingerprint",
    "bi:lightbulb", "bi:hammer", "bi:wrench", "bi:tools", "bi:gear", "bi:clipboard-check",
    "bi:file-earmark-code", "bi:terminal", "bi:database", "bi:cpu"
  ]
};

const ALL_ICONS = Object.entries(ICON_CATEGORIES).filter(([cat]) => cat !== "All").flatMap(([_, icons]) => icons);
let _iconPickerTarget = null, _iconPickerPreview = null, _activeIconCat = "All";

function buildIconPicker(fieldName, currentValue) {
  const pid = "ip" + (++_uid); const val = currentValue || "";
  const html = `<div class="icon-picker" id="${pid}"><div class="icon-picker-preview ${val ? '' : 'empty'}" data-ip-preview="${pid}">${val ? renderIcon(val) : "?"}</div><div class="icon-picker-input-wrap"><input type="text" name="${fieldName}" value="${esc(val)}" placeholder="e.g. dev:python-plain" data-ip-input="${pid}" /><button type="button" class="icon-picker-browse" data-ip-browse="${pid}"><ion-icon name="grid-outline"></ion-icon>Browse</button></div></div>`;
  function bind(root = document) {
    const input = root.querySelector(`[data-ip-input="${pid}"]`), preview = root.querySelector(`[data-ip-preview="${pid}"]`), browseBtn = root.querySelector(`[data-ip-browse="${pid}"]`);
    if (!input || !preview || !browseBtn) return;
    input.addEventListener("input", () => { const v = input.value.trim(); if (v) { preview.innerHTML = renderIcon(v); preview.classList.remove("empty"); } else { preview.innerHTML = "?"; preview.classList.add("empty"); } });
    browseBtn.addEventListener("click", () => { _iconPickerTarget = input; _iconPickerPreview = preview; openIconBrowser(); });
  }
  return { html, bind };
}
function openIconBrowser() { $("#icon-browser-ov").classList.add("open"); $("#icon-search").value = ""; _activeIconCat = "All"; renderIconCategories(); renderIconGrid(); setTimeout(() => $("#icon-search").focus(), 100); }
function closeIconBrowser() { $("#icon-browser-ov").classList.remove("open"); _iconPickerTarget = null; _iconPickerPreview = null; }
function renderIconCategories() { const cats = $("#icon-cats"); cats.innerHTML = Object.keys(ICON_CATEGORIES).map(cat => `<button type="button" class="icon-browser-cat ${cat === _activeIconCat ? 'active' : ''}" data-cat="${cat}">${cat}</button>`).join(""); cats.querySelectorAll(".icon-browser-cat").forEach(btn => btn.addEventListener("click", () => { _activeIconCat = btn.dataset.cat; renderIconCategories(); renderIconGrid(); })); }
function renderIconGrid() { const grid = $("#icon-grid"); const search = $("#icon-search").value.toLowerCase().trim(); let icons = _activeIconCat === "All" ? ALL_ICONS : (ICON_CATEGORIES[_activeIconCat] || []); if (search) icons = icons.filter(name => name.toLowerCase().includes(search)); if (icons.length === 0) { grid.innerHTML = `<div class="icon-browser-empty">No icons match "${esc(search)}"</div>`; return; } grid.innerHTML = icons.map(name => { let displayName = name.replace(/-plain|-original|-wordmark|-outline|-original-wordmark/g, "").replace(/:/, " "); return `<button type="button" class="icon-browser-item" data-icon="${name}" title="${name}">${renderIcon(name)}<span>${displayName}</span></button>`; }).join(""); grid.querySelectorAll(".icon-browser-item").forEach(item => item.addEventListener("click", () => { if (_iconPickerTarget) { _iconPickerTarget.value = item.dataset.icon; _iconPickerTarget.dispatchEvent(new Event("input")); } closeIconBrowser(); })); }
document.addEventListener("input", (e) => { if (e.target.id === "icon-search") renderIconGrid(); });
$("#icon-browser-ov").addEventListener("click", (e) => { if (e.target.id === "icon-browser-ov") closeIconBrowser(); });

const SECTIONS = [
  { group: "Content" },
  { key: "profile", title: "Profile", icon: "person-outline", custom: true },
  { key: "typing_texts", title: "Typing Texts", icon: "text-outline", fields: [{ key: "text", label: "Text", type: "text", ph: "QA Automation Lead" }, { key: "sort_order", label: "Order", type: "number" }], display: i => esc(i.text), subtitle: i => "Order: " + (i.sort_order || 0) },
  { key: "stats", title: "Impact Metrics", icon: "speedometer-outline", fields: [{ key: "label", label: "Label", type: "text", ph: "Testing Time Reduced" }, { key: "value", label: "Value", type: "number", ph: "40" }, { key: "suffix", label: "Suffix", type: "text", ph: "%" }, { key: "icon", label: "Icon", type: "icon" }, { key: "reveal", label: "Reveal direction", type: "select", options: ["left", "right", "bottom"] }, { key: "sort_order", label: "Order", type: "number" }], display: i => `<span style="font-size:14px;vertical-align:middle;margin-right:4px;display:inline-block">${renderIcon(i.icon)}</span>${esc(i.label)}: <strong>${i.value}${esc(i.suffix || "")}</strong>`, subtitle: i => "" },
  { key: "services", title: "Services", icon: "construct-outline", fields: [{ key: "title", label: "Title", type: "text" }, { key: "description", label: "Description", type: "textarea" }, { key: "icon", label: "Icon", type: "icon" }, { key: "reveal", label: "Reveal", type: "select", options: ["left", "right"] }, { key: "sort_order", label: "Order", type: "number" }], display: i => `<span style="font-size:14px;vertical-align:middle;margin-right:4px;display:inline-block">${renderIcon(i.icon)}</span>${esc(i.title)}`, subtitle: i => (i.description || "").slice(0, 60) + "…" },
  { key: "tech_stack", title: "Tech Stack", icon: "hardware-chip-outline", fields: [{ key: "name", label: "Name", type: "text", ph: "Python" }, { key: "icon", label: "Icon", type: "icon" }, { key: "sort_order", label: "Order", type: "number" }], display: i => `<span style="font-size:14px;vertical-align:middle;margin-right:4px;display:inline-block">${renderIcon(i.icon)}</span>${esc(i.name)}`, subtitle: () => "" },
  { key: "testimonials", title: "Testimonials", icon: "chatbubbles-outline", fields: [{ key: "name", label: "Name", type: "text" }, { key: "avatar_url", label: "Avatar", type: "image" }, { key: "text", label: "Testimonial text", type: "textarea" }, { key: "sort_order", label: "Order", type: "number" }], display: i => esc(i.name), subtitle: i => (i.text || "").slice(0, 50) + "…" },
  { group: "Resume" },
  { key: "experience", title: "Experience", icon: "briefcase-outline", custom: true },
  { key: "education", title: "Education", icon: "school-outline", custom: true },
  { key: "skills", title: "Skill Bars", icon: "bar-chart-outline", fields: [{ key: "name", label: "Skill name", type: "text" }, { key: "percentage", label: "Percentage", type: "number", ph: "90" }, { key: "sort_order", label: "Order", type: "number" }], display: i => esc(i.name) + " — <strong>" + i.percentage + "%</strong>", subtitle: () => "" },
  { group: "Portfolio" },
  { key: "projects", title: "Projects", icon: "images-outline", fields: [{ key: "title", label: "Title", type: "text" }, { key: "category", label: "Category", type: "text", ph: "fintech / automation / web apps" }, { key: "image_url", label: "Project image", type: "image" }, { key: "description", label: "Category label", type: "text", ph: "FinTech — Company" }, { key: "link", label: "Link", type: "text", ph: "#" }, { key: "sort_order", label: "Order", type: "number" }], display: i => esc(i.title), subtitle: i => "[" + i.category + "] " + (i.description || "") },
  { key: "certificates", title: "Certificates", icon: "ribbon-outline", fields: [{ key: "title", label: "Title", type: "text" }, { key: "issuer", label: "Issuer", type: "text" }, { key: "credential_id", label: "Credential ID", type: "text" }, { key: "issue_date", label: "Issue date", type: "monthyear" }, { key: "expiry", label: "Expiry date", type: "monthyear_optional" }, { key: "verify_url", label: "Verify URL", type: "text", ph: "https://…" }, { key: "status", label: "Status", type: "select", options: ["Verified", "ALUMNI", "Pending"] }, { key: "sort_order", label: "Order", type: "number" }], display: i => esc(i.title), subtitle: i => i.issuer + " · " + i.status },
  { group: "Sidebar" },
  { key: "contacts", title: "Contacts", icon: "call-outline", fields: [{ key: "type", label: "Type", type: "text", ph: "Email / Phone / Location" }, { key: "value", label: "Value", type: "text", ph: "mesfiny711@gmail.com" }, { key: "icon", label: "Icon", type: "icon" }, { key: "sort_order", label: "Order", type: "number" }], display: i => `<span style="font-size:14px;vertical-align:middle;margin-right:4px;display:inline-block">${renderIcon(i.icon)}</span><strong>${esc(i.type)}</strong>: ${esc(i.value)}`, subtitle: () => "" },
  { key: "social_links", title: "Social Links", icon: "share-social-outline", fields: [{ key: "platform", label: "Platform", type: "text", ph: "LinkedIn" }, { key: "url", label: "URL", type: "text", ph: "https://linkedin.com/in/…" }, { key: "icon", label: "Icon", type: "icon" }, { key: "sort_order", label: "Order", type: "number" }], display: i => `<span style="font-size:14px;vertical-align:middle;margin-right:4px;display:inline-block">${renderIcon(i.icon)}</span><strong>${esc(i.platform)}</strong>`, subtitle: i => i.url },
  { group: "Inbox" },
  { key: "messages", title: "Messages", icon: "mail-outline", custom: true },
  { key: "analytics", title: "Analytics", icon: "analytics-outline", custom: true },
  { group: "System" },
  { key: "settings", title: "Settings", icon: "settings-outline", custom: true },
];
const secMap = Object.fromEntries(SECTIONS.filter(s => s.key).map(s => [s.key, s]));
const COMPANY_FIELDS = section => [{ key: "name", label: section === "education" ? "School name" : "Company name", type: "text" }, { key: "meta", label: "Location (optional)", type: "meta" }, { key: "icon", label: "Icon", type: "icon" }, { key: "is_single", label: "Single entry (dashed)", type: "select", options: ["0", "1"] }, { key: "sort_order", label: "Order", type: "number" }];
const ROLE_FIELDS = [{ key: "title", label: "Role / Degree title", type: "text" }, { key: "date_range", label: "Date range", type: "daterange" }, { key: "description", label: "Description", type: "textarea" }, { key: "tags", label: "Tags (comma-separated)", type: "text", ph: "Python, CI/CD, Agile" }, { key: "sort_order", label: "Order", type: "number" }];

$("#login-form").addEventListener("submit", async e => { e.preventDefault(); const u = $("#lu").value.trim(), p = $("#lp").value, err = $("#login-err"); err.textContent = ""; try { const d = await fetch(API + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: u, password: p }) }).then(r => r.json()); if (d.token) { TOKEN = d.token; currentUser = d.username; const ttl = (d.expiresIn || 3600) * 1000; localStorage.setItem("admin_token", TOKEN); localStorage.setItem(SESSION_KEY, String(Date.now() + ttl)); startSessionTimer(); initPanel(); } else err.textContent = d.error || "Login failed"; } catch { err.textContent = "Connection failed"; } });
let _sessionTimer = null;
function startSessionTimer() {
  stopSessionTimer();
  _sessionTimer = setInterval(updateSessionBar, 1000);
  updateSessionBar();
}
function stopSessionTimer() { if (_sessionTimer) { clearInterval(_sessionTimer); _sessionTimer = null; } }
function updateSessionBar() {
  const bar = $("#session-bar");
  const phRight = $(".ph-right");
  if (!phRight || !$("#admin-panel") || $("#admin-panel").style.display === "none") return;
  if (!bar) {
    const el = document.createElement("div");
    el.className = "session-bar";
    el.id = "session-bar";
    phRight.insertBefore(el, phRight.firstChild);
  }
  const remaining = getSessionExpiry() - Date.now();
  if (remaining <= 0) { logout("Session expired"); return; }
  const total = Math.floor(remaining / 1000);
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  const barEl = $("#session-bar");
  barEl.innerHTML = `<ion-icon name="time-outline"></ion-icon><span>${h}:${m}:${s}</span>`;
  barEl.classList.toggle("warn", remaining < 5 * 60 * 1000);
  barEl.title = "Session expires in " + (total > 3600 ? Math.floor(total / 3600) + "h " : "") + Math.floor((total % 3600) / 60) + "m " + (total % 60) + "s";
}
function logout(msg) {
  clearSession();
  stopSessionTimer();
  $("#admin-panel").style.display = "none";
  $("#login-screen").style.display = "flex";
  $("#lp").value = "";
  const err = $("#login-err");
  if (msg && err) err.textContent = msg;
}
$("#logout-btn").addEventListener("click", logout);
function initPanel() { $("#login-screen").style.display = "none"; $("#admin-panel").style.display = "block"; $("#ph-user").textContent = currentUser || "admin"; buildNav(); switchTab("profile"); }
function buildNav() { let nav = "", mob = ""; SECTIONS.forEach(s => { if (s.group) { nav += `<div class="nav-group">${s.group}</div>`; return; } nav += `<button class="nav-btn" data-tab="${s.key}"><ion-icon name="${s.icon}"></ion-icon>${s.title}</button>`; mob += `<button data-tab="${s.key}"><ion-icon name="${s.icon}"></ion-icon>${s.title}</button>`; }); $("#admin-nav").innerHTML = nav; $("#mobile-nav").innerHTML = mob; $$("[data-tab]").forEach(b => b.addEventListener("click", () => switchTab(b.dataset.tab))); }
async function switchTab(key) { currentTab = key; $$("[data-tab]").forEach(b => b.classList.toggle("active", b.dataset.tab === key)); const el = $("#admin-content"), sec = secMap[key]; if (!sec) return; showLoading(el); try { if (sec.custom) { if (key === "profile") await renderProfile(el); else if (key === "experience") await renderTimeline(el, "experience", "Experience"); else if (key === "education") await renderTimeline(el, "education", "Education"); else if (key === "settings") renderSettings(el); else if (key === "messages") await renderMessages(el); else if (key === "analytics") await renderAnalytics(el); } else await renderCrud(el, key); } catch (err) { el.innerHTML = `<div class="empty"><ion-icon name="alert-circle-outline"></ion-icon><p>Error: ${esc(err.message)}</p><button class="btn btn-ghost" onclick="switchTab('${key}')">Retry</button></div>`; } }

async function renderCrud(el, key) {
  const sec = secMap[key], items = await apiFetch("/" + key);
  el.innerHTML = `<div class="sec-header"><h2 class="sec-title"><ion-icon name="${sec.icon}"></ion-icon>${sec.title}<span class="sec-count">${items.length}</span></h2><button class="btn btn-primary" id="crud-add"><ion-icon name="add-outline"></ion-icon> Add New</button></div><div id="crud-items">${items.length === 0 ? `<div class="empty"><ion-icon name="${sec.icon}"></ion-icon><p>No ${sec.title.toLowerCase()} yet</p></div>` : `<div class="item-list">${items.map(item => `<div class="item-card" data-id="${item.id}"><div class="ic-body"><div class="ic-title">${sec.display(item)}</div><div class="ic-sub">${esc(sec.subtitle ? sec.subtitle(item) : "#" + item.id)}</div></div><div class="ic-actions"><span class="ic-order">${item.sort_order ?? 0}</span><button class="btn btn-ghost btn-sm btn-edit">Edit</button><button class="btn btn-danger btn-sm btn-del">Delete</button></div></div>`).join("")}</div>`}</div>`;
  $("#crud-add").onclick = () => openItemModal(key, null, items);
  $("#crud-items").addEventListener("click", async e => { const card = e.target.closest("[data-id]"); if (!card) return; const item = items.find(i => i.id === +card.dataset.id); if (e.target.closest(".btn-edit")) openItemModal(key, item, items); else if (e.target.closest(".btn-del")) { if (!await cfmDialog("Delete?", "This item will be permanently removed.")) return; await apiFetch("/" + key + "/" + item.id, "DELETE"); clearCache(); toast("Deleted"); switchTab(key); } });
}

function openItemModal(key, item, items) {
  const sec = secMap[key], isEdit = !!item;
  const { html, bind } = buildFields(sec.fields, item);
  openModal(`<div class="modal-head"><h2>${isEdit ? "Edit" : "Add"} ${sec.title.replace(/s$/, "")}</h2><button class="btn btn-icon btn-ghost" onclick="closeModal()"><ion-icon name="close-outline"></ion-icon></button></div><form id="item-form"><div class="modal-body">${html}</div><div class="modal-foot"><button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button><button type="submit" class="btn btn-primary">${isEdit ? "Save" : "Create"}</button></div></form>`);
  bindUploads(); bind($("#modal-box"));
  $("#item-form").onsubmit = async e => { e.preventDefault(); const body = collectForm(sec.fields); if (!isEdit && sec.fields.some(f => f.key === 'sort_order') && !body.sort_order) body.sort_order = (items && items.length > 0 ? Math.max(...items.map(i => i.sort_order || 0)) : 0) + 1; try { if (isEdit) await apiFetch("/" + key + "/" + item.id, "PUT", body); else await apiFetch("/" + key, "POST", body); clearCache(); closeModal(); toast(isEdit ? "Updated!" : "Created!"); switchTab(key); } catch (err) { toast(err.message, "err"); } };
}

function openCustomForm(title, fields, item, onSubmit, items) {
  const isEdit = !!item;
  const { html, bind } = buildFields(fields, item);
  openModal(`<div class="modal-head"><h2>${title}</h2><button class="btn btn-icon btn-ghost" onclick="closeModal()"><ion-icon name="close-outline"></ion-icon></button></div><form id="cust-form"><div class="modal-body">${html}</div><div class="modal-foot"><button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button><button type="submit" class="btn btn-primary">${isEdit ? "Save" : "Create"}</button></div></form>`);
  bindUploads(); bind($("#modal-box"));
  $("#cust-form").onsubmit = async e => { e.preventDefault(); const body = collectForm(fields); if (!isEdit && fields.some(f => f.key === 'sort_order') && !body.sort_order) body.sort_order = (items && items.length > 0 ? Math.max(...items.map(i => i.sort_order || 0)) : 0) + 1; try { await onSubmit(body); clearCache(); closeModal(); } catch (err) { toast(err.message, "err"); } };
}

async function renderProfile(el) {
  const p = await apiFetch("/profile");
  const cur = p.availability || "available";
  const STATUS = [{ v: "available", l: "Available for Hire", c: "#2ecc87", ic: "checkmark-circle" }, { v: "busy", l: "Busy / Limited", c: "#e8a838", ic: "time" }, { v: "unavailable", l: "Not Available", c: "#f85149", ic: "close-circle" }];
  const curSt = STATUS.find(s => s.v === cur) || STATUS[0];
  el.innerHTML = `<div class="sec-header"><h2 class="sec-title"><ion-icon name="person-outline"></ion-icon> Profile &amp; About</h2></div><div class="status-card"><div class="st-info"><h3><span class="st-dot" id="st-dot" style="background:${curSt.c};box-shadow:0 0 8px ${curSt.c}60"></span><span id="st-label">${curSt.l}</span></h3><p>Controls the availability badge on your portfolio avatar</p></div><div class="st-btns" id="st-btns">${STATUS.map(s => `<button class="btn ${s.v === cur ? "btn-primary" : "btn-ghost"} btn-sm" data-av="${s.v}" ${s.v === cur ? `style="background:${s.c};border-color:${s.c}"` : ""}><ion-icon name="${s.ic}"></ion-icon> ${s.l}</button>`).join("")}</div></div><form id="pf-form"><div class="form-row"><div class="field"><label>Full name</label><input name="name" value="${esc(p.name)}" placeholder="Your Name" /></div><div class="field"><label>Primary title</label><input name="title" value="${esc(p.title)}" placeholder="QA Automation Lead" /></div></div><div class="field"><label>Avatar image</label><div class="upload-area"><label class="upload-thumb-wrap"><img src="${esc(p.avatar_url) || BLANK_IMG}" class="upload-thumb lg" data-preview="avatar_url" /><div class="upload-overlay"><ion-icon name="camera-outline"></ion-icon></div><input type="file" accept="image/*" data-upload="avatar_url" style="display:none" /></label><div class="upload-ctrl"><input type="hidden" name="avatar_url" value="${esc(p.avatar_url)}" /><span class="upload-st" data-ust="avatar_url">Current avatar</span></div></div></div><div class="field"><label>About text</label><div class="text-toolbar"><button type="button" id="tb-bold"><b>B</b></button><button type="button" id="tb-para">¶</button><button type="button" id="tb-preview">Preview</button></div><textarea name="about_text" id="about-text-area" style="min-height:190px" placeholder="Write about yourself…">${esc(p.about_text)}</textarea><input type="hidden" name="availability" id="av-inp" value="${cur}" /><div class="text-preview" id="about-text-preview" style="display:none"></div></div><div class="modal-foot" style="border:none;padding:0;margin-top:8px"><button type="submit" class="btn btn-primary"><ion-icon name="save-outline"></ion-icon> Save Profile</button></div></form>`;
  bindUploads(el);

  const ta = document.getElementById("about-text-area");
  const preview = document.getElementById("about-text-preview");
  if (ta && preview) {
    document.getElementById("tb-bold")?.addEventListener("click", () => {
      const start = ta.selectionStart, end = ta.selectionEnd, selected = ta.value.substring(start, end);
      ta.setRangeText(selected ? `**${selected}**` : "**highlighted text**", start, end, "select"); ta.focus();
    });
    document.getElementById("tb-para")?.addEventListener("click", () => { const start = ta.selectionStart; ta.setRangeText("\n\n", start, start, "end"); ta.focus(); });
    document.getElementById("tb-preview")?.addEventListener("click", () => {
      const isPreview = preview.style.display !== "none";
      if (isPreview) { preview.style.display = "none"; ta.style.display = "block"; document.getElementById("tb-preview").textContent = "Preview"; }
      else {
        const html = ta.value.split("\n\n").filter(p => p.trim()).map(p => `<p style="margin-bottom:18px">${p.replace(/\*\*(.*?)\*\*/g, '<span class="highlight">$1</span>')}</p>`).join("");
        preview.innerHTML = html || "<p style='color:var(--text-3)'>Nothing to preview yet...</p>";
        preview.style.display = "block"; ta.style.display = "none"; document.getElementById("tb-preview").textContent = "Edit";
      }
    });
  }

  const colMap = { available: "#2ecc87", busy: "#e8a838", unavailable: "#f85149" };
  $("#st-btns").addEventListener("click", async e => { const btn = e.target.closest("[data-av]"); if (!btn) return; const nv = btn.dataset.av, st = STATUS.find(s => s.v === nv); $("#av-inp").value = nv; $$("#st-btns .btn").forEach(b => { if (b.dataset.av === nv) { b.className = "btn btn-primary btn-sm"; b.style.cssText = `background:${colMap[nv]};border-color:${colMap[nv]}`; } else { b.className = "btn btn-ghost btn-sm"; b.style.cssText = ""; } }); $("#st-dot").style.cssText = `background:${st.c};box-shadow:0 0 8px ${st.c}60`; $("#st-label").textContent = st.l; try { await apiFetch("/profile", "PUT", { name: $('[name="name"]').value, title: $('[name="title"]').value, about_text: $('[name="about_text"]').value, avatar_url: $('[name="avatar_url"]').value, availability: nv }); clearCache(); toast("Status: " + st.l); } catch (err) { toast(err.message, "err"); } });
  $("#pf-form").onsubmit = async e => { e.preventDefault(); try { await apiFetch("/profile", "PUT", { name: $('[name="name"]').value, title: $('[name="title"]').value, about_text: $('[name="about_text"]').value, avatar_url: $('[name="avatar_url"]').value, availability: $("#av-inp").value }); clearCache(); toast("Profile saved!"); } catch (err) { toast(err.message, "err"); } };
}

async function renderTimeline(el, section, label) {
  const [allCo, allRoles] = await Promise.all([apiFetch("/companies"), apiFetch("/roles")]);
  const cos = allCo.filter(c => c.section === section); const icon = section === "education" ? "school" : "briefcase";
  el.innerHTML = `<div class="sec-header"><h2 class="sec-title"><ion-icon name="${icon}-outline"></ion-icon> ${label} <span class="sec-count">${cos.length}</span></h2><button class="btn btn-primary" id="add-co"><ion-icon name="add-outline"></ion-icon> Add ${section === "education" ? "School" : "Company"}</button></div><div id="co-list">${cos.length === 0 ? `<div class="empty"><ion-icon name="${icon}-outline"></ion-icon><p>No entries yet</p></div>` : cos.map(c => { const roles = allRoles.filter(r => r.company_id === c.id); return `<div class="item-card" data-cid="${c.id}" style="flex-direction:column;align-items:stretch;margin-bottom:8px"><div style="display:flex;justify-content:space-between;align-items:center"><div class="ic-body"><div class="ic-title"><span style="font-size:14px;vertical-align:middle;margin-right:4px;display:inline-block">${renderIcon(c.icon)}</span>${esc(c.name)}</div><div class="ic-sub">${esc(c.meta || "No location set")}</div></div><div class="ic-actions"><span class="ic-order">${c.sort_order || 0}</span><button class="btn btn-ghost btn-sm btn-eco">Edit</button><button class="btn btn-danger btn-sm btn-dco">Delete</button></div></div><div class="roles-wrap">${roles.map(r => `<div class="item-card" data-rid="${r.id}"><div class="ic-body"><div class="ic-title" style="font-size:13px">${esc(r.title)}</div><div class="ic-sub">${esc(r.date_range)}</div></div><div class="ic-actions"><span class="ic-order">${r.sort_order || 0}</span><button class="btn btn-ghost btn-sm btn-ero">Edit</button><button class="btn btn-danger btn-sm btn-dro">Delete</button></div></div>`).join("")}<button class="add-role-btn" data-fcid="${c.id}">+ Add Role</button></div></div>`; }).join("")}</div>`;
  $("#add-co").onclick = () => openCustomForm("Add " + (section === "education" ? "School" : "Company"), COMPANY_FIELDS(section), null, async body => { body.section = section; await apiFetch("/companies", "POST", body); toast("Added!"); switchTab(section); }, cos);
  $("#co-list").addEventListener("click", async e => {
    if (e.target.closest(".btn-eco")) { const cid = +e.target.closest("[data-cid]").dataset.cid; const c = cos.find(x => x.id === cid); openCustomForm("Edit " + esc(c.name), COMPANY_FIELDS(section), c, async body => { body.section = section; await apiFetch("/companies/" + cid, "PUT", body); toast("Updated!"); switchTab(section); }, cos); return; }
    if (e.target.closest(".btn-dco")) { const cid = +e.target.closest("[data-cid]").dataset.cid; const c = cos.find(x => x.id === cid); if (!await cfmDialog("Delete?", `"${c.name}" and all its roles will be removed.`)) return; await apiFetch("/companies/" + cid, "DELETE"); clearCache(); toast("Deleted"); switchTab(section); return; }
    if (e.target.closest(".add-role-btn")) { const cid = +e.target.closest("[data-fcid]").dataset.fcid; openCustomForm("Add Role", ROLE_FIELDS, null, async body => { body.company_id = cid; body.tags = JSON.stringify((body.tags || "").split(",").map(t => t.trim()).filter(Boolean)); await apiFetch("/roles", "POST", body); toast("Role added!"); switchTab(section); }, allRoles.filter(r => r.company_id === cid)); return; }
    if (e.target.closest(".btn-ero")) { const rid = +e.target.closest("[data-rid]").dataset.rid; const r = allRoles.find(x => x.id === rid); let tags = ""; try { tags = JSON.parse(r.tags || "[]").join(", "); } catch { tags = r.tags || ""; } openCustomForm("Edit Role", ROLE_FIELDS, { ...r, tags }, async body => { body.company_id = r.company_id; body.tags = JSON.stringify((body.tags || "").split(",").map(t => t.trim()).filter(Boolean)); await apiFetch("/roles/" + rid, "PUT", body); toast("Updated!"); switchTab(section); }, allRoles.filter(x => x.company_id === r.company_id)); return; }
    if (e.target.closest(".btn-dro")) { const rid = +e.target.closest("[data-rid]").dataset.rid; if (!await cfmDialog("Delete role?", "This role will be permanently removed.")) return; await apiFetch("/roles/" + rid, "DELETE"); clearCache(); toast("Deleted"); switchTab(section); }
  });
}

async function renderMessages(el) {
  const messages = await apiFetch("/messages"); const unreadCount = messages.filter(m => !m.is_read).length;
  el.innerHTML = `<div class="sec-header"><h2 class="sec-title"><ion-icon name="mail-outline"></ion-icon> Messages<span class="sec-count">${messages.length}</span>${unreadCount > 0 ? `<span class="sec-count" style="background:var(--accent-bg);color:var(--accent);border:1px solid var(--accent-border)">${unreadCount} unread</span>` : ""}</h2>${messages.length > 0 ? `<button class="btn btn-ghost btn-sm" id="mark-all-read"><ion-icon name="checkmark-done-outline"></ion-icon> Mark all read</button>` : ""}</div><div id="messages-list">${messages.length === 0 ? `<div class="empty"><ion-icon name="mail-open-outline"></ion-icon><p>No messages yet</p><p style="font-size:12px;color:var(--text-3)">Messages from your contact form will appear here</p></div>` : `<div class="item-list">${messages.map(m => `<div class="item-card" data-mid="${m.id}" style="cursor:pointer;${!m.is_read ? 'border-left:3px solid var(--accent);' : ''}"><div class="ic-body"><div class="ic-title" style="display:flex;align-items:center;gap:8px">${!m.is_read ? '<span style="width:8px;height:8px;background:var(--accent);border-radius:50%;flex-shrink:0"></span>' : ''}${esc(m.name)} <span style="color:var(--text-3);font-weight:400;font-size:12px">&lt;${esc(m.email)}&gt;</span></div><div class="ic-sub" style="margin-top:4px;white-space:normal;line-height:1.4">${esc(m.message.substring(0, 120))}${m.message.length > 120 ? '…' : ''}</div><div class="ic-sub" style="margin-top:4px">${new Date(m.created_at).toLocaleString()}</div></div><div class="ic-actions"><button class="btn btn-ghost btn-sm btn-view-msg">View</button><button class="btn btn-danger btn-sm btn-del-msg">Delete</button></div></div>`).join("")}</div>`}</div>`;
  $("#mark-all-read")?.addEventListener("click", async () => { await apiFetch("/messages/mark-all-read", "POST"); clearCache(); toast("All marked as read"); renderMessages(el); });
  $("#messages-list").addEventListener("click", async (e) => {
    const card = e.target.closest("[data-mid]"); if (!card) return; const mid = +card.dataset.mid;
    if (e.target.closest(".btn-del-msg")) { if (!await cfmDialog("Delete message?", "This cannot be undone.")) return; await apiFetch("/messages/" + mid, "DELETE"); clearCache(); toast("Message deleted"); renderMessages(el); return; }
    if (e.target.closest(".btn-view-msg") || e.target.closest(".ic-body")) { const msg = await apiFetch("/messages/" + mid); clearCache(); openModal(`<div class="modal-head"><h2>Message from ${esc(msg.name)}</h2><button class="btn btn-icon btn-ghost" onclick="closeModal()"><ion-icon name="close-outline"></ion-icon></button></div><div class="modal-body"><div class="field"><label>From</label><div style="padding:10px;background:var(--bg-1);border-radius:var(--r);font-size:13px"><strong>${esc(msg.name)}</strong> &lt;<a href="mailto:${esc(msg.email)}" style="color:var(--accent)">${esc(msg.email)}</a>&gt;</div></div><div class="field"><label>Date</label><div style="padding:10px;background:var(--bg-1);border-radius:var(--r);font-size:13px;color:var(--text-2)">${new Date(msg.created_at).toLocaleString()}</div></div><div class="field"><label>Message</label><div style="padding:14px;background:var(--bg-1);border-radius:var(--r);font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(msg.message)}</div></div><div style="display:flex;gap:8px;margin-top:16px"><a href="mailto:${esc(msg.email)}?subject=Re: Your message on my portfolio" class="btn btn-primary"><ion-icon name="mail-outline"></ion-icon> Reply via Email</a><button class="btn btn-danger" onclick="deleteMsgAndClose(${mid})"><ion-icon name="trash-outline"></ion-icon> Delete</button></div></div>`); }
  });
}
window.deleteMsgAndClose = async (id) => { await apiFetch("/messages/" + id, "DELETE"); clearCache(); closeModal(); toast("Message deleted"); switchTab("messages"); };

async function renderAnalytics(el) {
  showLoading(el); const data = await apiFetch("/analytics"); const maxDaily = Math.max(...data.dailyViews.map(d => d.count), 1);
  el.innerHTML = `<div class="sec-header"><h2 class="sec-title"><ion-icon name="analytics-outline"></ion-icon> Analytics Dashboard</h2><button class="btn btn-ghost btn-sm" onclick="switchTab('analytics')"><ion-icon name="refresh-outline"></ion-icon> Refresh</button></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:24px"><div style="background:var(--bg-2);border:1px solid var(--border);border-radius:var(--r-lg);padding:18px"><div style="font-size:11px;color:var(--text-3);font-family:var(--mono);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Today</div><div style="font-size:28px;font-weight:700;color:var(--accent);font-family:var(--mono)">${data.views.today}</div><div style="font-size:11px;color:var(--text-3);margin-top:4px">page views</div></div><div style="background:var(--bg-2);border:1px solid var(--border);border-radius:var(--r-lg);padding:18px"><div style="font-size:11px;color:var(--text-3);font-family:var(--mono);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Last 7 Days</div><div style="font-size:28px;font-weight:700;color:var(--accent);font-family:var(--mono)">${data.views.week}</div><div style="font-size:11px;color:var(--text-3);margin-top:4px">page views</div></div><div style="background:var(--bg-2);border:1px solid var(--border);border-radius:var(--r-lg);padding:18px"><div style="font-size:11px;color:var(--text-3);font-family:var(--mono);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Last 30 Days</div><div style="font-size:28px;font-weight:700;color:var(--accent);font-family:var(--mono)">${data.views.month}</div><div style="font-size:11px;color:var(--text-3);margin-top:4px">page views</div></div><div style="background:var(--bg-2);border:1px solid var(--border);border-radius:var(--r-lg);padding:18px"><div style="font-size:11px;color:var(--text-3);font-family:var(--mono);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">All Time</div><div style="font-size:28px;font-weight:700;color:var(--accent);font-family:var(--mono)">${data.views.all}</div><div style="font-size:11px;color:var(--text-3);margin-top:4px">page views</div></div></div><h3 style="font-size:15px;margin-bottom:18px">Daily Page Views (Last 14 Days)</h3><div style="display:flex;align-items:flex-end;gap:6px;min-height:160px;padding:12px;background:var(--bg-2);border:1px solid var(--border);border-radius:var(--r-lg);overflow-x:auto">${data.dailyViews.map(d => `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;min-width:36px"><div style="width:100%;background:var(--accent);border-radius:4px 4px 0 0;min-height:8px;transition:height .6s;height:${Math.max((d.count / maxDaily) * 120, 8)}px;opacity:.8"></div><span style="font-size:9px;color:var(--text-3);font-family:var(--mono);white-space:nowrap">${d.date.split("-").slice(1).join("/")}</span><span style="font-size:9px;font-weight:600;color:var(--text-1);font-family:var(--mono)">${d.count}</span></div>`).join("")}</div><div style="margin-top:24px"><h3 style="font-size:15px;margin-bottom:14px">Top Pages</h3>${data.topPages.length === 0 ? `<p style="color:var(--text-3);font-size:13px">No data yet</p>` : `<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="border-bottom:1px solid var(--border);color:var(--text-3);font-family:var(--mono);font-size:10px;text-transform:uppercase"><th style="text-align:left;padding:8px 10px">Page</th><th style="text-align:right;padding:8px 10px">Views</th></tr></thead><tbody>${data.topPages.map(p => `<tr style="border-bottom:1px solid var(--border)"><td style="padding:8px 10px">${p.page}</td><td style="padding:8px 10px;text-align:right;font-family:var(--mono);font-weight:600">${p.count}</td></tr>`).join("")}</tbody></table>`}</div>`;
}

function renderSettings(el) {
  el.innerHTML = `<div class="sec-header"><h2 class="sec-title"><ion-icon name="settings-outline"></ion-icon> Settings</h2></div><div style="max-width:400px"><h3 style="font-size:15px;margin-bottom:14px">Change Password</h3><form id="pw-form"><div class="field"><label>Current password</label><div class="pw-wrap"><input type="password" name="current" required autocomplete="current-password" /><button type="button" class="pw-toggle" aria-label="Toggle password visibility"><ion-icon name="eye-outline"></ion-icon></button></div></div><div class="field"><label>New password</label><div class="pw-wrap"><input type="password" name="np" required minlength="6" autocomplete="new-password" /><button type="button" class="pw-toggle" aria-label="Toggle password visibility"><ion-icon name="eye-outline"></ion-icon></button></div></div><div class="field"><label>Confirm new password</label><div class="pw-wrap"><input type="password" name="cp" required minlength="6" autocomplete="new-password" /><button type="button" class="pw-toggle" aria-label="Toggle password visibility"><ion-icon name="eye-outline"></ion-icon></button></div></div><button type="submit" class="btn btn-primary"><ion-icon name="lock-closed-outline"></ion-icon> Update Password</button></form><div style="margin-top:36px;padding-top:20px;border-top:1px solid var(--border)"><p style="font-size:12px;color:var(--text-3);line-height:1.8">Portfolio CMS v1.0 · Netlify Functions · Turso · Cloudinary<br><a href="/" target="_blank">View live portfolio →</a></p></div></div>`;
  bindPwToggles(el);
  $("#pw-form").onsubmit = async e => { e.preventDefault(); const cur = $('[name="current"]').value, np = $('[name="np"]').value, cp = $('[name="cp"]').value; if (np !== cp) { toast("Passwords don't match", "err"); return; } if (np.length < 6) { toast("Min 6 characters", "err"); return; } try { await apiFetch("/auth/change-password", "POST", { current: cur, newPassword: np }); toast("Password changed!"); e.target.reset(); } catch (err) { toast(err.message, "err"); } };
}

(async () => {
  bindPwToggles(document);
  if (TOKEN) {
    if (isSessionExpired()) { clearSession(); logout(); return; }
    try { await apiFetch("/profile"); currentUser = "admin"; startSessionTimer(); initPanel(); return; } catch { /* token expired */ }
  }
  logout();
})();
const broadcastChannel = new BroadcastChannel("portfolio-updates");
const originalToast = toast;
window.toast = function (msg, type = "ok") { originalToast(msg, type); if (type === "ok" && !msg.includes("Status:")) broadcastChannel.postMessage({ type: "update", timestamp: Date.now() }); };
broadcastChannel.addEventListener("message", (event) => { if (event.data.type === "update") { console.log("🔄 Update detected in another tab — refreshing..."); switchTab(currentTab); } });
