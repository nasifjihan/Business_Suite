# Business Suite — Full-Stack B2B Business Management

A single-organization business management suite with Authentication, RBAC, CRM, Inventory, POS & Sales, HRM, and Dashboard Analytics. Built as a learning-oriented portfolio project using **Next.js 15 (App Router)**, **Express 4.21**, **TypeScript 5**, **Prisma ORM**, and **PostgreSQL 16/18**.

---

## 🏗️ Architecture (3-Tier, Separated Deployment)

```
                  ┌──────────────────────────────┐
                  │   BROWSER                  │
                  │   Next.js 15 Frontend │
                  │   React 19, Tailwind  │
                  └────────────┬───────────┘
                               │ HTTPS + JWT (Header)
                               │ Refresh Token (HTTP-only Cookie)
                               ▼
                  ┌──────────────────────────────┐
                  │   REST API SERVER        │
                  │   Express 4.21 + Node 22 LTS │
                  │   Zod validation          │
                  │   RBAC middleware      │
                  │   Prisma ORM           │
                  └────────────┬───────────┘
                               │ Prisma (PostgreSQL wire protocol)
                               ▼
                  ┌──────────────────────────────┐
                  │   DATABASE                 │
                  │   PostgreSQL 16/18        │
                  │   28 tables, UUID PKs,       │
                  │   Decimal currency,      │
                  │   B-tree indexes        │
                  └──────────────────────────────┘
```

- **Frontend** (in `frontend/`):** Deployed separately to **Vercel** (or equivalent). App Router, Redux Toolkit + RTK Query, TanStack Table, ECharts, shadcn/ui.
- **Backend** (in `backend/`):** Deployed separately to **Render** (or equivalent). Module-based architecture: `modules/auth`, `modules/crm`, `modules/inventory`, etc.
- **Database:** PostgreSQL 16/18, managed by Prisma migrations.

---

## 🧰 Tech Stack

### Frontend
| Category | Tools |
|----------|-------|
| Framework | Next.js 15 (App Router), React 19, TypeScript 5 |
| Styling | Tailwind CSS 3, shadcn/ui primitives (Radix UI) |
| State | Redux Toolkit (UI state), RTK Query (API server state + cache) |
| Tables | TanStack React Table (server-side pagination, sort, filter, select) |
| Forms | React Hook Form + Zod resolvers |
| Charts | Apache ECharts (lazy-loaded, SSR disabled) |
| Utils | date-fns, react-day-picker, clsx + tailwind-merge, lucide-react |

### Backend
| Category | Tools |
|----------|-------|
| Framework | Express 4.21, Node.js 22 LTS, TypeScript 5 |
| Database | PostgreSQL 16/18 via Prisma ORM |
| Auth | bcryptjs (cost 12), jsonwebtoken, HTTP-only refresh cookies, express-rate-limit |
| Validation | Zod |
| Utils | uuid, dayjs, http-status-codes, helmet, cors, compression, cookie-parser |

### Testing
| Layer | Tools |
|-------|-------|
| Backend unit/integration | Vitest + Supertest |
| Frontend unit | Vitest + React Testing Library + jsdom |
| End-to-end | Playwright |

---

## 📦 Modules (Feature Modules (Full list)
1. **Authentication** — JWT access tokens, HTTP-only refresh tokens with rotation, password hashing, forgot password (bcrypt), rate-limited login.
2. **RBAC & Admin** — 6 system roles + fine-grained permission codes, audit logs, user management.
3. **Dashboard & Analytics** — KPI cards, sales trend, lead pipeline, top products, attendance summary.
4. **CRM** — Customers w/ contacts, lead pipeline (6 statuses), activity timeline.
5. **Inventory** — Categories, products (SKU unique), warehouses, per-warehouse stock w/ movement history & adjustments.
6. **POS & Sales** — Cart (localStorage), atomic checkout transaction prevents negative stock (row-level locking), orders, invoices, payments.
7. **HRM** — Departments, attendance (employees), departments, designations, attendance, leave workflow.

---

## 🚀 Quick Start (Local Development)

> **Prerequisites:** Node.js 20+, PostgreSQL 16+ (create a database called `business_suite`). See [BUILD_PROCESS.md Sections 2-4](BUILD_PROCESS.md) for step-by-step installations.

```powershell
# 1. Install backend dependencies
cd backend
npm install

# 2. Configure backend environment variables
copy .env.example .env   # Windows
# OR: cp .env.example .env   (Git Bash)
# Edit .env: set DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET

# 3. Run migrations + seed
npx prisma migrate deploy
npx prisma db seed

# 4. Start backend (dev mode)
npm run dev          # http://localhost:5000

# ── NEW terminal ─────────────────────────────────

# 5. Install frontend dependencies
cd ../frontend
npm install

# 6. Configure frontend environment
copy .env.local.example .env.local
# (contains NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1

# 7. Start frontend
npm run dev          # http://localhost:3000
```

Then open **http://localhost:3000` in your browser.

---

## 🔐 Default Seed Credentials

> **⚠️ WARNING: FOR LOCAL DEVELOPMENT ONLY. CHANGE THESE PASSWORDS BEFORE DEPLOYING PUBLICLY. DEACTIVATE OR REPLACE SEED USERS AFTER DEMO.**

All seed users have the same password: **`Admin@123`

| Email | Role | Permissions |
|-------|------|-------------|
| `admin@example.com` | ADMIN | Everything (`*.*`) |
| `manager@example.com` | MANAGER | All business modules; no Admin/User/Audit |
| `sales@example.com` | SALES | CRM, POS, Sales read/create |
| `cashier@example.com` | CASHIER | POS only + limited reads |
| `hr@example.com` | HR | HRM + Dashboard read |
| `viewer@example.com` | VIEWER | Read-only on business modules |

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| **[BUILD_PROCESS.md](BUILD_PROCESS.md)** | **THE BIG ONE.** Step-by-step book of the complete build process, all 13 phases, installation, full folder tree, env vars, ERD text, API cheat sheet, + 11 interview Q&A. Start here if you want to understand *how* this project was built from zero. |
| **[docs/architecture.md](docs/architecture.md)** | Full-stack request lifecycle, design decision rationale, layer separation justification. |
| **[docs/database.md](docs/database.md)** | 28-table inventory, design rules, index strategy, soft delete policy, migration notes. |
| **[docs/api.md](docs/api.md)** | REST endpoint envelope standard, error taxonomy, HTTP status codes used. |
| **[docs/rbac.md](docs/rbac.md)** | Role × Permission matrix. |
| **[docs/learning-notes.md](docs/learning-notes.md)** | Engineering journal updated per phase. |

---

## 🛠️ Commands Reference

### Backend (`cd backend`)
| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server (ts-node-dev watch mode) on port 5000 |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start` | Run compiled `dist/server.js` (production) |
| `npm test` | Vitest (unit + integration tests) |
| `npx prisma studio` | Web GUI for exploring database data |
| `npx prisma migrate dev --name your_migration_name` | Auto-generate + apply a migration after schema.prisma changes |
| `npx prisma migrate deploy` | Apply pending migrations (production / CI) |
| `npx prisma db seed` | Seed demo data |

### Frontend (`cd frontend`)
| Command | Purpose |
|---------|---------|
| `npm run dev` | Next.js dev server on port 3000 |
| `npm run build` | Production build (`.next/`) |
| `npm start` | Run production build server |
| `npm run lint` | ESLint check |
| `npm test` | Vitest (frontend unit tests) |

---

## 🗂️ Repository Structure (Top-Level)

```
business-suite/
├── BUILD_PROCESS.md       ← Build process book (step-by-step)
├── README.md              ← This file
├── docker-compose.yml     ← Phase 13 (Docker learning: postgres+backend+nginx)
├── .gitignore
├── frontend/              ← Next.js 15 frontend app
├── backend/               ← Express 4.21 + Prisma REST API
├── docs/                  ← Architecture/Database/API/RBAC/Learning docs
└── nginx/                 ← Phase 13 (Nginx reverse proxy learning)
```

Full expanded tree with 200+ file paths: See [BUILD_PROCESS.md Section 18](BUILD_PROCESS.md#18-complete-folder-structure-tree).

---

## ⚠️ Non-Goals (V1)

Explicitly **out of scope** for Version 1. Add these after V1 is deployed & interview-ready:
- Multi-tenancy / SaaS / multi-org isolation
- Full double-entry accounting / general ledger
- Payroll engine / tax calculations
- Manufacturing / MRP / BOMs
- Python backend, Django, or FastAPI rewrite
- Native mobile apps (iOS/Android)

---

## 📝 License

MIT — Educational / portfolio use. Modify freely.
