<div align="center">

# &lt;YM/&gt; Portfolio CMS

**A modern, dark-themed developer portfolio with a built-in CMS admin panel.**

Built with **Astro** • **Netlify Functions** • **Turso SQLite** • **Cloudinary**

<a href="https://yohannesweb.netlify.app" target="_blank">
  <img src="https://img.shields.io/badge/🚀%20Live%20Demo-Visit-blue?style=for-the-badge&logo=appveyor" alt="Live Demo">
</a>
<a href="https://yohannesweb.netlify.app/admin" target="_blank">
  <img src="https://img.shields.io/badge/🛠️%20Admin%20Panel-Open-green?style=for-the-badge&logo=appveyor" alt="Admin Panel">
</a>
<a href="https://github.com/yohannesmesfin/portfolio/issues" target="_blank">
  <img src="https://img.shields.io/badge/🐛%20Report%20Bug-Now-red?style=for-the-badge&logo=appveyor" alt="Report Bug">
</a>

<br>

[![Netlify Status](https://api.netlify.com/api/v1/badges/3f49b4dd-1a82-405e-9b76-0b9a230856c1/deploy-status)](https://app.netlify.com/projects/yohannesweb/deploys)

</div>

---

## ✨ Features

### Portfolio Frontend

- ⚡ **Astro-powered** — zero JS by default, static-first, ultra-fast loads
- 🧩 **Component-based** — each section is a reusable `.astro` component
- 🌗 **Dark/Light mode** with localStorage persistence
- ⌨️ **Typing animation** with rotating texts
- 🎯 **Interactive particle background** (theme-aware)
- 📊 **Animated counters & skill bars** using IntersectionObserver
- 🗂️ **5-page SPA** — About, Resume, Portfolio, Certificates, Contact
- 🔍 **Portfolio filtering** by category
- 🏆 **Certificate modal** with verification links
- 💬 **Testimonials carousel** with detailed modals
- 📱 **Responsive & mobile-first** design with bottom navbar
- ♿ **Accessible** — ARIA, focus-visible, reduced motion support
- 📄 **Dynamic PDF CV generator** from live DOM content
- 🗺️ **Google Maps** integration with dark mode support
- 📬 **Contact form** with rate limiting & spam honeypot

### CMS Admin Panel

- 🔐 **JWT authentication** (1-hour sessions) with bcrypt-hashed passwords
- 👁️ **Password visibility toggle** on all password fields
- ⏱️ **Live session countdown** with automatic logout on expiry
- 🛡️ **Auth enforced on every admin action** — no unauthenticated reads of admin data
- 📝 **Full CRUD** for 12+ content sections
- 🏢 **Nested editing** — Companies → Roles (Experience/Education)
- 🖼️ **Cloudinary image uploads** with previews and progress
- 📱 **Mobile-responsive admin panel** with bottom tab navigation
- 🔄 **Live updates** — instant portfolio refresh after edits
- ⚡ **Config-driven** — add sections by editing one object

### Infrastructure

- 🌐 **Fully serverless** with Netlify Functions
- 🗄️ **Turso SQLite** — edge database with global replication
- ☁️ **Cloudinary CDN** — optimized worldwide image delivery
- 🆓 **$0/month** — fully free-tier compatible
- 🚀 **Auto-deploy** via GitHub → Netlify

---

## 🏗️ Architecture

```
Astro Frontend
├─ src/pages/index.astro        (Portfolio page)
├─ src/pages/admin.astro        (CMS page)
├─ src/layouts/BaseLayout.astro (shared HTML shell + SEO)
├─ src/components/              (12+ section components)
│
Netlify Functions (Serverless)
└─ netlify/functions/api.mjs → handles all API routes

Turso SQLite (Edge DB)
└─ 12+ tables, auto-seeded

Cloudinary
└─ Image hosting & CDN
```

---

## 📁 Project Structure

```
portfolio/
├── src/
│   ├── pages/
│   │   ├── index.astro
│   │   └── admin.astro
│   ├── layouts/
│   │   └── BaseLayout.astro
│   └── components/
│       ├── Sidebar.astro
│       ├── Navbar.astro
│       ├── AboutSection.astro
│       ├── ResumeSection.astro
│       ├── PortfolioSection.astro
│       ├── CertificatesSection.astro
│       ├── ContactSection.astro
│       ├── TestimonialModal.astro
│       └── CertModal.astro
├── public/
│   └── assets/
│       ├── css/style.css
│       ├── css/admin.css
│       ├── js/script.js
│       ├── js/admin.js
│       └── images/
├── netlify/
│   └── functions/api.mjs
├── lib/
│   ├── db.mjs
│   ├── seed.mjs
│   └── reset.mjs
├── astro.config.mjs
├── netlify.toml
├── package.json
├── .env
├── .gitignore
└── LICENSE
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Netlify CLI (`npm i -g netlify-cli`)
- Turso CLI
- Cloudinary account

### Setup Steps

1. **Clone & Install**

```bash
git clone https://github.com/yohannesmesfin/portfolio.git
cd portfolio
npm install
```

2. **Turso Database**

```bash
curl -sSfL https://get.tur.so/install.sh | bash
turso auth signup
turso db create portfolio-cms
turso db show portfolio-cms --url
turso db tokens create portfolio-cms
```

3. **Cloudinary**

- Copy **Cloud Name, API Key, API Secret** from your dashboard

4. **Environment Variables** (`.env`)

```
TURSO_DATABASE_URL=libsql://portfolio-cms-yourname.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token
JWT_SECRET=your-64-char-secret
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

5. **Seed Database**

```bash
npm run seed
```

6. **Run Locally**

```bash
npm run dev        # full stack: functions + site (recommended)
# or
npm run astro:dev  # site only (frontend work; API requires the functions server)
```

- Portfolio: `http://localhost:4321`
- Admin Panel: `http://localhost:4321/admin`
- Default login: `admin / admin123` (change immediately!)

> Note: `npm run astro:dev` runs the Astro dev server only. For full stack
> development with the API, use `npm run dev` (Netlify Dev), which serves both
> the functions and the site.

---

## 📡 API Reference

### Public Endpoints

| Method | Endpoint        | Description                            |
| ------ | --------------- | -------------------------------------- |
| GET    | /api/portfolio  | Get all public portfolio data          |
| GET    | /api/meta       | Get last-updated timestamp & unread count |
| POST   | /api/contact    | Submit contact form (rate-limited)     |
| POST   | /api/analytics  | Log page view / CV download event      |

### Authenticated Endpoints

Include `Authorization: Bearer <token>` (obtained from `/api/auth/login`).

| Method | Endpoint                   | Description                     |
| ------ | -------------------------- | ------------------------------- |
| POST   | /api/auth/login            | Login, returns 1-hour JWT       |
| GET    | /api/auth/session          | Validate session, get expiry    |
| POST   | /api/auth/change-password  | Change password (requires auth) |
| GET    | /api/profile               | Get profile (admin only)        |
| PUT    | /api/profile               | Update profile                  |
| GET/POST/PUT/DELETE | /api/{table}[/id] | CRUD on content tables         |
| GET    | /api/messages[/id]         | Read messages                   |
| GET    | /api/analytics             | Analytics dashboard data        |
| POST   | /api/upload                | Upload image to Cloudinary      |

### Available Tables

`contacts, social_links, typing_texts, stats, services, tech_stack, companies, roles, skills, projects, certificates, testimonials`

---

## 🎨 Customization

- **Colors:** edit CSS custom properties in `public/assets/css/style.css`
- **Sections:** edit the `.astro` components in `src/components/`
- **Admin sections:** modify the `SECTIONS` config in `public/assets/js/admin.js`
- **CV Template:** edit `buildCVHTML()` in `public/assets/js/script.js`
- **Site metadata / SEO:** edit `src/layouts/BaseLayout.astro`

---

## 🗄️ Database Schema (Summary)

- profile, contacts, social_links, typing_texts, stats, services, tech_stack
- companies → roles (nested)
- skills, projects, certificates, testimonials
- messages, analytics_events
- admin_users (JWT auth)

---

## 🛡️ Security & Best Practices

- Passwords hashed with bcrypt (12 rounds)
- **JWT sessions expire after 1 hour**; auto-logout on the client
- **Auth enforced on every admin request** — CRUD reads/writes all require a valid token
- Password visibility toggles on all password fields
- Public data is only exposed via dedicated public endpoints (`/portfolio`, `/meta`)
- Image uploads validated & signed (Cloudinary)
- SQL parameterized queries prevent injection
- Contact form rate-limited per IP + honeypot spam trap
- **Production:** change the default password, set a strong `JWT_SECRET`

---

## 🤝 Contributing

- Fork → feature branch → commit → PR
- Follow existing code style
- Test responsiveness & dark/light modes
- Update seed data if adding tables

---

## 📋 Changelog

**v2.0.0 (2026)**
✅ Migrated from vanilla HTML/CSS/JS to **Astro** (component architecture)
✅ Added 1-hour JWT sessions with live countdown & auto-logout
✅ Password visibility toggles
✅ Enforced auth on all admin CRUD operations

**v1.0.0 (2025)**
✅ Initial release with SPA, CMS, JWT auth, Cloudinary, Turso, dark/light theme, CV generator, responsive mobile design

---

## 📄 License

MIT License — see LICENSE

---

## 👨‍💻 Author

**Yohannes Mesfin**
Portfolio: your-site.netlify.app
LinkedIn: linkedin.com/in/yohannesmesfin
GitHub: github.com/yohannesmesfin
Email: [mesfiny711@gmail.com](mailto:mesfiny711@gmail.com)

<div align="center">
If this project helped you, please consider giving it a ⭐

Built with ❤️ in Addis Ababa, Ethiopia

</div>
