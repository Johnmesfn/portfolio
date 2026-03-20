<div align="center">

# &lt;YM/&gt; Portfolio CMS

**A modern, dark-themed developer portfolio with a built-in CMS admin panel.**

Built with vanilla **HTML/CSS/JS** • **Netlify Functions** • **Turso SQLite** • **Cloudinary**

<!-- “Button-style” links -->
<a href="https://yohannesweb.netlify.app" target="_blank">
  <img src="https://img.shields.io/badge/🚀%20Live%20Demo-Visit-blue?style=for-the-badge&logo=appveyor" alt="Live Demo">
</a>
<a href="https://yohannesweb.netlify.app/admin.html" target="_blank">
  <img src="https://img.shields.io/badge/🛠️%20Admin%20Panel-Open-green?style=for-the-badge&logo=appveyor" alt="Admin Panel">
</a>
<a href="https://github.com/yohannesmesfin/portfolio/issues" target="_blank">
  <img src="https://img.shields.io/badge/🐛%20Report%20Bug-Now-red?style=for-the-badge&logo=appveyor" alt="Report Bug">
</a>

<br>

<!-- Netlify Deploy Status -->

[![Netlify Status](https://api.netlify.com/api/v1/badges/3f49b4dd-1a82-405e-9b76-0b9a230856c1/deploy-status)](https://app.netlify.com/projects/yohannesweb/deploys)

</div>

---

## ✨ Features

### Portfolio Frontend

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
- 📬 **Contact form** via Formspree + mailto fallback

### CMS Admin Panel

- 🔐 **JWT authentication** with bcrypt-hashed passwords
- 📝 **Full CRUD** for 12+ content sections
- 🏢 **Nested editing** — Companies → Roles (Experience/Education)
- 🖼️ **Cloudinary image uploads** with previews and progress
- 📱 **Mobile-responsive admin panel** with bottom tab navigation
- 🔄 **Live updates** — instant portfolio refresh after edits
- 🛡️ **Static HTML fallback** in case API is down
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
Frontend
├─ index.html (Portfolio SPA)
├─ admin.html (CMS SPA)
├─ assets/
│  ├─ css/style.css
│  ├─ js/script.js
│  └─ images/
│     ├─ avatars, projects, icons
│
Netlify Functions (Serverless)
└─ api.mjs → handles all API routes

Turso SQLite (Edge DB)
└─ 12+ tables, auto-seeded

Cloudinary
└─ Image hosting & CDN
```

---

## 📁 Project Structure

```
portfolio/
├── public/
│   ├── index.html
│   ├── admin.html
│   └── assets/
├── netlify/functions/api.mjs
├── lib/
│   ├── db.mjs
│   └── seed.mjs
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
npm run dev
# or
npx netlify dev
```

- Portfolio: `http://localhost:3000`
- Admin Panel: `http://localhost:3000/admin.html`
- Default login: `admin / admin123` (change immediately!)

---

## 📡 API Reference

### Public Endpoints

| Method | Endpoint          | Description            |
| ------ | ----------------- | ---------------------- |
| GET    | /api/portfolio    | Get all portfolio data |
| GET    | /api/profile      | Get profile info       |
| GET    | /api/{table}      | List table items       |
| GET    | /api/{table}/{id} | Get item by ID         |

### Authenticated Endpoints

- Include `Authorization: Bearer <token>`
- Examples: create/update/delete items, upload images, update profile

### Available Tables

`contacts, social_links, typing_texts, stats, services, tech_stack, companies, roles, skills, projects, certificates, testimonials`

---

## 🎨 Customization

- **Colors:** edit CSS custom properties in `style.css`
- **Add Sections:** modify DB schema, API tables, admin SECTIONS array, frontend render functions
- **CV Template:** edit `buildCVHTML()` in `script.js`

---

## 🗄️ Database Schema (Summary)

- profile, contacts, social_links, typing_texts, stats, services, tech_stack
- companies → roles (nested)
- skills, projects, certificates, testimonials
- admin_users (JWT auth)

---

## 🛡️ Security & Best Practices

- Passwords hashed with bcrypt (12 rounds)
- JWT tokens expire after 24h
- Mutation endpoints require auth
- Image uploads validated & signed
- SQL parameterized queries prevent injection
- **Production:** change default password, set strong JWT_SECRET

---

## 🤝 Contributing

- Fork → feature branch → commit → PR
- Follow existing vanilla JS code style
- Test responsiveness & dark/light modes
- Update seed data if adding tables

---

## 📋 Changelog

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
