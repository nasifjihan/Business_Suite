# Business Suite — Full-Stack B2B Business Management

A single-organization business management suite with Authentication, RBAC, CRM, Inventory, POS & Sales, HRM, and Dashboard Analytics. Built as a learning-oriented portfolio project using **Next.js 16 (App Router)**, **Express 4.21**, **TypeScript 5**, **Prisma ORM**, and **PostgreSQL 16/18**.

---

## 🏗️ Architecture (3-Tier, Separated Deployment)

```
                  ┌──────────────────────────────┐
                  │   BROWSER                  │
                  │   Next.js 16 Frontend │
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
                  │   30 tables, UUID PKs,       │
                  │   Decimal currency,      │
                  │   B-tree indexes        │
                  └──────────────────────────────┘
```

- **Frontend** (in `frontend/`): Deployed separately to **Vercel** (or equivalent). App Router, Redux Toolkit + RTK Query, TanStack Table, ECharts, shadcn/ui.
- **Backend** (in `backend/`): Deployed separately to **Render** (or equivalent). Module-based architecture: `modules/auth`, `modules/crm`, `modules/inventory`, etc.
- **Database:** PostgreSQL 16/18, managed by Prisma migrations.

> **Locally the whole stack runs in Docker instead**, behind the same nginx reverse
> proxy: `docker compose up -d` starts PostgreSQL, the API, the frontend and nginx,
> all served from `http://localhost`. The split above describes the *production*
> deployment; Vercel builds the frontend from source and ignores its Dockerfile.
> See [Quick Start](#-quick-start).

---

## 🧰 Tech Stack

### Frontend
| Category | Tools |
|----------|-------|
| Framework | Next.js 16 (App Router), React 19, TypeScript 5 |
| Styling | Tailwind CSS 4, shadcn/ui primitives (Radix UI) |
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
| End-to-end | _Not implemented._ Planned as Playwright; there is no config or spec file in the repo today. Coverage is backend Vitest + Supertest and frontend Vitest + RTL. |

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

## 🚀 Quick Start

Two ways to run this project. **Option A is recommended** — it needs no PostgreSQL
installation and starts the entire stack with one command.

---

### Option A — Docker (recommended)

> **Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/),
> [Node.js 20+](https://nodejs.org) (needed only to run the seed scripts), and Git.
> Launch Docker Desktop and wait for the whale icon to stop animating before continuing.

```bash
# 1. Clone
git clone https://github.com/nasifjihan/Business_Suite.git
cd Business_Suite

# 2. Start everything: PostgreSQL + API + frontend + nginx
docker compose up -d --build
```

No configuration needed — `docker-compose.yml` supplies working defaults for every
variable. The first build takes ~10 minutes (image downloads and two `npm ci` runs);
later starts take seconds.

The database schema is created automatically: the backend container runs
`prisma migrate deploy` on startup.

```bash
# 3. Seed it — the schema exists but there are no rows, so nobody can log in yet
cd backend
npm install
```

```bash
# Point the seeder at the container's database, then run it.
#   Git Bash:        export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/bs_db?schema=public"
#   Command Prompt:  set DATABASE_URL=postgresql://postgres:postgres@localhost:5433/bs_db?schema=public
npm run seed
```

> `npm run seed` prints the **target database** in a banner before it writes anything.
> Read that line. A `DATABASE_URL` exported in your shell overrides `.env`, so it is
> genuinely easy to seed the wrong database.
>
> Port **5433**, not 5432 — the container maps its 5432 to host 5433 so it does not
> collide with a PostgreSQL you may already have installed.

Open **http://localhost** (port 80, via nginx).

Everything is served from that one origin: nginx routes `/api/*` and `/health` to the
API container and everything else to the frontend.

| What | Where |
|---|---|
| Application | http://localhost |
| API | http://localhost/api/v1 |
| Health check | http://localhost/health |
| Database from host | `localhost:5433` (user `postgres`, password `postgres`, db `bs_db`) |

Useful commands:

```bash
docker compose ps                 # status of all four containers
docker compose logs -f backend    # follow API logs
docker compose stop               # stop, keep data
docker compose up -d --build      # REBUILD after changing code — without --build
                                  # Docker silently runs the previous image
docker compose down -v            # remove containers AND delete the database volume
```

---

### Option B — Local (no Docker)

Better for day-to-day development: hot reload is instant, whereas Docker needs a
rebuild for every change.

> **Prerequisites:** Node.js 20+, and PostgreSQL 16 or later installed locally.

```bash
# 1. Create two databases — one to develop against, one for tests.
#    They MUST be separate: the test suite deletes every row in ~25 tables
#    after each test, so pointing tests at your dev database wipes your work.
psql -U postgres -c "CREATE DATABASE business_suite;"
psql -U postgres -c "CREATE DATABASE business_suite_test;"
```

```bash
# 2. Backend
cd backend
npm install
cp .env.example .env        # Windows: copy .env.example .env
```

Edit `backend/.env` and set at minimum:

```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/business_suite?schema=public"
JWT_ACCESS_SECRET=<any string of 16+ characters>
JWT_REFRESH_SECRET=<a different string of 16+ characters>
```

Every variable is validated by Zod at boot (`src/config/env.ts`), so a missing or
malformed value fails immediately with a readable message rather than causing
strange behaviour later.

```bash
# 3. Create the schema, seed it, and start the API on :5000
npx prisma migrate deploy
npm run seed
npm run dev
```

```bash
# 4. Frontend — in a SECOND terminal
cd frontend
npm install
cp .env.local.example .env.local    # Windows: copy .env.local.example .env.local
```

Set the API URL in `frontend/.env.local` to match the backend you are running:

```
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
```

| You are running | Use this value |
|---|---|
| Backend locally (`npm run dev`) | `http://localhost:5000/api/v1` |
| Full Docker stack | `http://localhost/api/v1` |

> `NEXT_PUBLIC_*` values are read at startup, so **restart the dev server** after
> editing this file. Nothing will change otherwise.

```bash
npm run dev
```

Open **http://localhost:3000**.

---

### Using a cloud database (optional)

Both options work against a managed PostgreSQL such as [Neon](https://neon.tech)
instead of a local one — useful when several people need to see the same data.

Put the connection strings in a **gitignored** `.env`:

| File | Used by |
|---|---|
| `backend/.env` | local `npm run dev`, migrations, seeding |
| `.env` (repo root) | the Docker containers |

```
DATABASE_URL=<pooled connection string>
DIRECT_URL=<direct, non-pooled connection string>
```

Two URLs because a connection pooler (Neon, Supabase, PgBouncer) cannot serve
migrations: those need session-level advisory locks a transaction-mode pooler does
not support. The application uses `DATABASE_URL`; `prisma.config.ts` prefers
`DIRECT_URL` for `prisma migrate`.

> ⚠️ If you point `DATABASE_URL` at a cloud database, also set `TEST_DATABASE_URL`
> in `backend/.env` to a **local** test database. `npm test` deletes every row in
> ~25 tables. `vitest.config.ts` otherwise derives the test database name from
> `DATABASE_URL`, and a safety guard aborts the run if the target database name does
> not contain "test" — but an explicit `TEST_DATABASE_URL` is the reliable way.

---

## 🔐 Default Seed Credentials

> **⚠️ LOCAL DEVELOPMENT ONLY.** Change this password before exposing the app
> publicly, and remove or deactivate the seed user after a demo.

`npm run seed` creates **one** user:

| Email | Password | Role | Permissions |
|-------|----------|------|-------------|
| `admin@example.com` | `Admin@123` | SUPER_ADMIN | Everything (`*.*`) |

All seven roles (SUPER_ADMIN, ADMIN, MANAGER, SALES, CASHIER, HR, VIEWER) and their
143 permission codes are created too — but only the admin account exists. Create
users for the other roles from **Admin → Users** once logged in.

**On first login you are required to change the password.** That is deliberate:
default credentials should not survive first use. Click **"Sign out instead"** to skip
it and keep `Admin@123` working for repeated local demos.

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| **[BUILD_PROCESS.md](BUILD_PROCESS.md)** | **THE BIG ONE.** Step-by-step book of the complete build process, all 14 phases, installation, full folder tree, env vars, ERD text, API cheat sheet, + 11 interview Q&A. Start here if you want to understand *how* this project was built from zero. |
| **[docs/architecture.md](docs/architecture.md)** | Full-stack request lifecycle, design decision rationale, layer separation justification. |
| **[docs/database.md](docs/database.md)** | 30-model inventory, design rules, index strategy, soft delete policy, migration notes. |
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
| `npm test` | Vitest (unit + integration). Runs against `<database>_test`, never your dev database. |
| `npx prisma studio` | Web GUI for exploring database data |
| `npx prisma migrate dev --name your_migration_name` | Auto-generate + apply a migration after schema.prisma changes |
| `npx prisma migrate deploy` | Apply pending migrations (production / CI) |
| `npm run seed` | Seed all system data + demo fixtures. Prints the target database first. Add `-- --no-demo` to skip demo fixtures. |

### Docker (repo root)
| Command | Purpose |
|---------|---------|
| `docker compose up -d --build` | Build and start all four containers. **`--build` is required after code changes** — without it Docker silently runs the previous image. |
| `docker compose ps` | Status and health of each container |
| `docker compose logs -f backend` | Follow one container's logs |
| `docker compose stop` / `start` | Pause / resume; data is kept |
| `docker compose down` | Remove containers and network; **keeps** the database volume |
| `docker compose down -v` | Also **deletes** the database volume — all data gone |
| `docker exec -it bs-postgres psql -U postgres -d bs_db` | psql shell inside the database container |

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
Business_Suite/
├── README.md              ← This file
├── BUILD_PROCESS.md       ← Step-by-step build book, all 14 phases
├── docker-compose.yml     ← Full stack: postgres + backend + frontend + nginx
├── nginx.conf             ← Reverse proxy: / → frontend, /api and /health → backend
├── .dockerignore          ← (repo root; each build context has its own)
├── .github/workflows/     ← CI: backend and frontend pipelines
├── backend/               ← Express 4.21 + Prisma REST API (has its own Dockerfile)
├── frontend/              ← Next.js 16 App Router UI (has its own Dockerfile)
└── docs/                  ← Architecture / Database / API / RBAC / Learning notes
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
