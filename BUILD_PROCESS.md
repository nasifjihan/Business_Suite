# Business Suite — Complete Step-by-Step Build Process

> **Purpose**: This file documents EVERY step of the project construction in plain language so any developer can read it and understand exactly how the application was built, from zero to deployment. Updated after EVERY phase and major decision.

---

## TABLE OF CONTENTS

1. [OVERVIEW — What This Project Is](#1-overview--what-this-project-is)
2. [PREREQUISITE INSTALLATION — Step-by-Step](#2-prerequisite-installation--step-by-step)
3. [PHASE 0 — Repository Initialization & Folder Skeleton](#3-phase-0--repository-initialization--folder-skeleton)
4. [PHASE 1 — Core Shells (Next.js + Express + PostgreSQL + Prisma)](#4-phase-1--core-shells-nextjs--express--postgresql--prisma)
5. [PHASE 2 — Authentication & Token Refresh](#5-phase-2--authentication--token-refresh)
6. [PHASE 3 — RBAC & Administration](#6-phase-3--rbac--administration)
7. [PHASE 4 — Reusable UI & Table Infrastructure](#7-phase-4--reusable-ui--table-infrastructure)
8. [PHASE 5 — CRM Module (Customers, Leads, Activities)](#8-phase-5--crm-module-customers-leads-activities)
9. [PHASE 6 — Inventory Module (Products, Stock, Warehouses)](#9-phase-6--inventory-module-products-stock-warehouses)
10. [PHASE 7 — POS & Sales Module (Atomic Transactions)](#10-phase-7--pos--sales-module-atomic-transactions)
11. [PHASE 8 — HRM Module (Employees, Attendance, Leave)](#11-phase-8--hrm-module-employees-attendance-leave)
12. [PHASE 9 — Dashboard & Analytics (ECharts)](#12-phase-9--dashboard--analytics-echarts)
13. [PHASE 10 — Hardening (Performance, Security, Errors)](#13-phase-10--hardening-performance-security-errors)
14. [PHASE 11 — Testing (Vitest, Supertest, Playwright)](#14-phase-11--testing-vitest-supertest-playwright)
15. [PHASE 12 — Deployment (Vercel + Render + Managed PostgreSQL)](#15-phase-12--deployment-vercel--render--managed-postgresql)
16. [PHASE 13 — Docker & Nginx Learning](#16-phase-13--docker--nginx-learning)
17. [FULL TECHNOLOGY STACK REFERENCE](#17-full-technology-stack-reference)
18. [COMPLETE FOLDER STRUCTURE TREE](#18-complete-folder-structure-tree)
19. [ENVIRONMENT VARIABLE REFERENCE](#19-environment-variable-reference)
20. [DATABASE ENTITY RELATIONSHIP DIAGRAM (TEXT)](#20-database-entity-relationship-diagram-text)
21. [API ENDPOINT CHEAT SHEET](#21-api-endpoint-cheat-sheet)
22. [LEARNING NOTES & KEY DECISIONS](#22-learning-notes--key-decisions)
23. [INTERVIEW PREP — ANSWERS TO LIKELY QUESTIONS](#23-interview-prep--answers-to-likely-questions)

---

## 1. OVERVIEW — What This Project Is

**Business Suite** is a single-organization B2B business management web application. It is a **learning-focused portfolio project** designed to demonstrate modern full-stack engineering.

**What it does:**
- **Authentication**: Secure JWT login with access/refresh tokens and HTTP-only cookies
- **RBAC**: Role-based access control (Admin, Manager, Sales, Cashier, HR, Viewer)
- **Dashboard**: Business KPIs, sales trends, top products, attendance, low-stock alerts
- **CRM**: Customer and contact management, lead pipeline with status tracking and activities
- **Inventory**: Product catalog with SKUs, categories, warehouses, stock levels, stock movement history
- **POS & Sales**: Point-of-sale cart, checkout with atomic transaction (creates order, items, invoice, payment, deducts stock, records movements all at once), sales history
- **HRM**: Employee records, departments/designations, daily attendance (check-in/out), leave requests with approval workflow
- **Audit logs**: Who did what, when, to which record

**What it deliberately does NOT do (V1):**
- No multi-tenancy (one organization only)
- No full accounting/ledger system
- No payroll engine
- No complex MRP/manufacturing
- No Python/Django

---

## 2. PREREQUISITE INSTALLATION — Step-by-Step

> All installations are on **Windows 10/11 64-bit**. Installing over an existing installation is safe.

---

### STEP 2.1 — Install Node.js 22 LTS (JavaScript Runtime)

**Why we need it**: Node.js runs both our Express backend server and the Next.js build/dev tools.

**How to install:**
1. Open https://nodejs.org/ in your browser
2. Click the big green **"LTS"** button (labeled 22.x.x LTS — get the latest in 22.x line)
3. Download the `node-v22.x.x-x64.msi` installer
4. Run the installer
5. Click **Next > Accept > Next > Next > Next > Install > Finish**
   - ⚠️ **IMPORTANT**: On the "Tools for Native Modules" screen, CHECK the box that says **"Automatically install the necessary tools"** (this installs Python and Visual Studio Build Tools which some npm packages need)
6. **Verify installation** — Open a NEW PowerShell or CMD window and run:
   ```
   node --version
   ```
   Expected output: `v22.x.x` (must be 20 or higher; 22 preferred)
   ```
   npm --version
   ```
   Expected output: `10.x.x` or higher

**If already installed**: Re-running the MSI will simply update/repair it. No harm.

---

### STEP 2.2 — Install Git (Version Control)

**Why we need it**: Git tracks code changes, creates feature branches, and pushes to GitHub.

**How to install:**
1. Open https://git-scm.com/download/win
2. Download the **64-bit Git for Windows Setup** EXE
3. Run the installer
4. Click **Next** through EVERY screen — the defaults are all correct:
   - Select Components: leave as-is (Windows Explorer integration is nice to have)
   - Default editor: Vim is fine, or select VS Code if you have it
   - PATH environment: **"Git from the command line and also from 3rd-party software"** (this is the default — CRITICAL)
   - SSH executable: Use bundled OpenSSH
   - HTTPS transport: Use the OpenSSL library
   - Line ending conversions: Checkout Windows-style, commit Unix-style (default)
   - Terminal emulator: Use MinTTY (default)
   - Everything else: Next, Next, Install
5. **Verify installation** — Open a NEW PowerShell and run:
   ```
   git --version
   ```
   Expected output: `git version 2.x.x.windows.x`

6. **Configure Git** (run these once — use your real name and email):
   ```
   git config --global user.name "Your Full Name"
   git config --global user.email "your.email@example.com"
   ```

**If already installed**: Skip to step 5 (git config) to confirm your name/email are set.

---

### STEP 2.3 — Install PostgreSQL 16 (Relational Database)

**Why we need it**: PostgreSQL is our database. It stores all business data (users, customers, products, orders, employees, etc.).

**How to install:**
1. Open https://www.postgresql.org/download/windows/
2. Click **"Download the installer"** (takes you to EDB/EnterpriseDB)
3. Download **PostgreSQL 16.x** for Windows x86-64 (not 17 unless Prisma explicitly supports it — 16 is the safest latest stable)
4. Run the installer EXE
5. Click through the wizard carefully:
   - **Installation Directory**: Keep default `C:\Program Files\PostgreSQL\16`
   - **Select Components**: Check ALL four (PostgreSQL Server, pgAdmin 4, Stack Builder, Command Line Tools)
   - **Data Directory**: Keep default
   - **Password**: Set a password for the `postgres` superuser. **WRITE THIS DOWN — YOU WILL NEED IT LATER**. Example: `postgres123` (only for local dev, never production)
   - **Port**: Keep `5432` (default)
   - **Locale**: Keep `[Default locale]` or choose your region
   - Click **Next > Next > Finish**
6. **Verify installation — check service is running**:
   - Press `Win + R`, type `services.msc`, press Enter
   - Find **"postgresql-x64-16"** in the list
   - Status should say **"Running"**. If not, right-click > Start.
7. **Verify installation — command line**:
   ```
   psql --version
   ```
   Expected: `psql (PostgreSQL) 16.x`
   
   If that says "not found", add PostgreSQL to your PATH:
   - Open **System Properties > Environment Variables**
   - Under **System Variables**, find `Path` > Edit > New
   - Add: `C:\Program Files\PostgreSQL\16\bin`
   - Click OK on all windows
   - Open a NEW PowerShell and try `psql --version` again

8. **Create the `business_suite` database**:
   - Open **pgAdmin 4** from Start Menu (it opens in your browser)
   - Set a master password for pgAdmin (first time only — can be same as postgres password for simplicity)
   - In the left sidebar: **Servers > PostgreSQL 16** (enter the postgres password you set in step 5)
   - Right-click **Databases > Create > Database...**
   - Database: `business_suite`
   - Owner: `postgres`
   - Click **Save**

   *Alternative command-line method:*
   ```
   psql -U postgres -c "CREATE DATABASE business_suite;"
   ```
   (enter your postgres password when prompted)

**If already installed**: Just confirm the service is running and create the `business_suite` database via step 8.

---

### STEP 2.4 — Optional: Install a Code Editor (if not using Trae)

The Trae IDE already has a built-in editor. If you want a standalone editor:
- **Visual Studio Code**: https://code.visualstudio.com/ — free, industry standard. Install these extensions:
  - ESLint
  - Prettier
  - Prisma (Prisma.prisma)
  - Tailwind CSS IntelliSense (bradlc.vscode-tailwindcss)
  - GitLens

---

## 3. PHASE 0 — Repository Initialization & Folder Skeleton

> **Status**: ✅ COMPLETED

**Objective**: Create the empty project structure, initialize Git, create documentation placeholders, and establish the README. This is the "foundation concrete" before any real code.

**Steps performed in this phase:**
1. Initialize Git repository in `g:\MBW Projects\Other\BS` (the current folder)
2. Create `.gitignore` for Node.js, Next.js, Prisma, IDE files, .env
3. Create the folder skeleton (frontend/, backend/, docs/) with placeholder `.gitkeep` files
4. Write the main `README.md` with architecture overview, setup instructions, tech stack
5. Create placeholder docs under `docs/` (architecture.md, database.md, api.md, rbac.md, learning-notes.md)
6. Create empty `docker-compose.yml` placeholder with explanatory comments
7. First commit to git

**Files created/modified in this phase:**
```
.gitignore
README.md
docker-compose.yml
frontend/.gitkeep
backend/.gitkeep
docs/architecture.md
docs/database.md
docs/api.md
docs/rbac.md
docs/learning-notes.md
```

**Concepts learned**: Monorepo folder layout, .gitignore best practices, README structure, git init, git commit.

**Exit criteria**: `git log` shows at least one commit. Folder tree exists. README is readable.

---

## 4. PHASE 1 — Core Shells (Next.js + Express + PostgreSQL + Prisma)

> **Status**: ⏳ PENDING

**Objective**: Get all three tiers (frontend, backend, database) talking to each other with a minimal "hello world" test. No business features yet — just proving the plumbing works.

**Steps performed in this phase:**

### 4.1 Backend — Express + TypeScript Setup
1. `cd backend && npm init -y`
2. Install dependencies: `express cors helmet compression cookie-parser dotenv bcryptjs jsonwebtoken express-rate-limit zod uuid dayjs http-status-codes`
3. Install devDependencies: `typescript ts-node ts-node-dev nodemon prisma vitest supertest @types/node @types/express @types/cors @types/bcryptjs @types/jsonwebtoken @types/cookie-parser @types/supertest -D`
4. Create `tsconfig.json` with strict mode, ESNext modules, outDir `./dist`
5. Create `src/config/env.ts` — validates environment variables with Zod (catches missing .env early)
6. Create `src/lib/prisma.ts` — singleton PrismaClient instance (prevents connection leaks in dev)
7. Create `src/lib/errors.ts` — custom typed error classes: `AppError`, `ValidationError`, `AuthenticationError`, `AuthorizationError`, `NotFoundError`, `ConflictError`, `BusinessRuleError`
8. Create `src/lib/response.ts` — `successResponse()` and `errorResponse()` helpers for the standard API envelope
9. Create `src/middleware/errorHandler.ts` — centralized Express error middleware (catches all errors, maps typed errors to HTTP codes, never exposes stacks in prod)
10. Create `src/middleware/notFound.ts` — 404 handler for unmatched routes
11. Create `src/modules/health/routes.ts` — simple `GET /api/v1/health` that returns `{ status: 'ok', timestamp }` and optionally tests DB connectivity
12. Create `src/app.ts` — assemble Express app: CORS config (allows FRONTEND_URL), JSON body parser (10mb limit), cookie parser, helmet security headers, compression, rate limit, route mounting, error handlers LAST
13. Create `src/server.ts` — read PORT from env, call `app.listen()`, graceful shutdown on SIGTERM

### 4.2 Database — Prisma Schema & First Migration
1. `cd backend && npx prisma init` (creates `prisma/schema.prisma` and `.env`)
2. Edit `prisma/schema.prisma`:
   - Provider: `postgresql`
   - Add initial core models: `User`, `Role`, `Permission`, `RolePermission`, `RefreshToken`, `AuditLog`
   - All PKs: `id String @id @default(uuid())`
   - All business tables: `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`
   - Proper FK relations, `@unique` on email, indexes on FK columns and email
3. Set `DATABASE_URL` in `backend/.env`
4. Run `npx prisma migrate dev --name init_core_tables`
   - This generates SQL in `prisma/migrations/` and runs it against PostgreSQL
5. Run `npx prisma generate` — generates the TypeScript Prisma Client types

### 4.3 Frontend — Next.js 15 (App Router) + TypeScript + Tailwind Setup
1. From project root: `npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack`
   - Answer: TypeScript=Yes, ESLint=Yes, Tailwind=Yes, App Router=Yes, src/=Yes, import alias=@/*=Yes, Turbopack=No
2. Install additional frontend dependencies:
   ```
   npm install @reduxjs/toolkit react-redux @tanstack/react-table react-hook-form @hookform/resolvers zod echarts echarts-for-react date-fns react-day-picker clsx tailwind-merge class-variance-authority lucide-react
   ```
   Plus all Radix UI packages for shadcn/ui primitives: dialog, select, dropdown-menu, label, slot, toast, alert-dialog, tabs, avatar, separator, tooltip, popover, checkbox, switch
3. Install devDependencies: `vitest @testing-library/react @testing-library/jest-dom jsdom @types/node @types/react @types/react-dom -D`
4. Add `frontend/.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1` and `NEXT_PUBLIC_APP_NAME=Business Suite`
5. Test frontend boots: `cd frontend && npm run dev` → open http://localhost:3000 should show Next.js welcome
6. Modify `app/layout.tsx` for proper metadata, Inter font, theme colors
7. Create a minimal test page that calls `/api/v1/health` and displays the result (proves frontend→backend communication)

### 4.4 Integration Test
1. Start backend: Terminal 1 → `cd backend && npm run dev` (ts-node-dev watches for changes)
2. Start frontend: Terminal 2 → `cd frontend && npm run dev`
3. Open browser to http://localhost:3000/health-test
4. Expected: Page shows `Backend status: ok` with a timestamp
5. Open Postman/Thunder Client/curl: `GET http://localhost:5000/api/v1/health` → `{ success: true, data: { status: 'ok' } }`
6. Open pgAdmin → business_suite database → Schemas → public → Tables should have: User, Role, Permission, RolePermission, RefreshToken, AuditLog, _prisma_migrations

**Concepts learned**: Next.js App Router, Express middleware stack, Prisma schema design, migrations, Prisma Client, strict TypeScript config, typed error classes, centralized error handling, CORS, API response envelopes, .gitignore for env files.

**Exit criteria**: All three services boot, frontend can call backend health endpoint, tables exist in PostgreSQL, `npx tsc --noEmit` passes in both frontend and backend.

---

## 5. PHASE 2 — Authentication & Token Refresh

> **Status**: ⏳ PENDING

**Objective**: Full production-grade auth flow. Short-lived access tokens in memory/headers, long-lived refresh tokens in HTTP-only Secure cookies with rotation, password hashing, rate limiting on login.

### Core Concepts
- **Access Token**: JWT, 15-minute TTL, sent in `Authorization: Bearer <token>` header. Short TTL limits damage if stolen.
- **Refresh Token**: Random 64-byte string (NOT a JWT), 7-day TTL, stored in DB as SHA-256 hash (not plaintext), sent to browser via `Set-Cookie` with `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/api/v1/auth/refresh`. JavaScript on the page CANNOT read this cookie.
- **Token Rotation**: Every time `/auth/refresh` is called, the old refresh token is revoked (marked revokedAt in DB) and a NEW one is issued. This prevents replay of stolen refresh tokens.
- **Authorization Code Flow**: Not used (that's OAuth2); we use direct credential POST.
- **Rate Limiting**: Login endpoint: 5 attempts per IP per 15 minutes. Prevents brute force.
- **Password Hashing**: bcrypt with cost factor 12. Not Argon2 (bcrypt is sufficient and has fewer native compilation issues on Windows).

### Backend Auth Module
- `src/modules/auth/validators.ts` — Zod schemas: `loginSchema` (email+password), `forgotSchema`, `resetSchema`
- `src/modules/auth/services.ts` — `AuthService` class with methods: `login()`, `refreshToken()`, `logout()`, `me()`, `forgotPassword()`, `resetPassword()`, `generateTokens()`, `hashRefreshToken()`, `verifyPassword()`, `hashPassword()`
- `src/modules/auth/controllers.ts` — Thin controllers that call AuthService and return responses
- `src/modules/auth/routes.ts` — POST /login, POST /refresh, POST /logout, GET /me, POST /forgot-password, POST /reset-password
- `src/middleware/auth.ts` — `authenticate()` middleware. Extracts Bearer token from Authorization header, verifies JWT signature+expiry, attaches `req.user` object (id, email, roleId, permissions[]). Returns 401 if invalid/expired.
- RTK Query client-side: Base query with auto-reauth on 401 — if an API call returns 401, it calls `/auth/refresh` once to get a new access token, then retries the original request. If refresh also fails → user is logged out.

### Frontend Auth
- `frontend/features/auth/apiSlice.ts` — RTK Query endpoints for login/refresh/logout/me
- `frontend/features/auth/authSlice.ts` — Redux Toolkit slice for `{ user, isAuthenticated, loading }`
- `frontend/store/store.ts` — Configure Redux store with the auth reducer + RTK Query API reducer + `setupListeners`
- `frontend/app/(auth)/login/page.tsx` — Login page with React Hook Form + Zod validation, loading state, generic error messages ("Invalid email or password" — never reveal which is wrong)
- `frontend/app/(dashboard)/layout.tsx` — Protected route wrapper: checks RTK Query `useGetMeQuery()` on mount. If loading → skeleton. If 401/not authenticated → redirect to `/login` with `?redirect=...` query param.
- Logout button dispatches logout thunk: calls `/auth/logout` POST (invalidates server-side refresh token), clears Redux auth state, redirects to login.

### Testing This Phase
1. Create a test user directly in DB: Open pgAdmin, insert a User row with a bcrypt-hashed password. (We'll create seed script in Phase 3, but for now, manual insert.)
2. Open browser → go to `/login` → enter credentials → verify:
   - Network tab: POST /login returns 200 with accessToken in JSON body
   - Application tab → Cookies → localhost → `refreshToken` cookie exists, HttpOnly=Yes, Secure=Yes (if HTTPS), SameSite=Lax
   - Redux DevTools: auth slice shows isAuthenticated=true, user object populated
3. Navigate to `/dashboard` — loads without redirect
4. Wait 15 minutes (or manually delete access token from Redux via DevTools) — make an API call, verify it AUTOMATICALLY refreshes (see extra 401→refresh→200→original request 200 in Network tab)
5. Click Logout — cookies cleared, redirect to login. Reloading `/dashboard` now redirects to login.

**Concepts learned**: JWT structure (header.payload.signature), bcrypt cost factors, HTTP-only cookies vs localStorage security trade-offs, CSRF risks with cookies and why SameSite=Lax helps, token rotation vs reuse, RTK Query baseQuery reauthentication flow, Redux Toolkit slice pattern, Next.js protected route pattern.

---

## 6. PHASE 3 — RBAC & Administration

> **Status**: ⏳ PENDING

**Objective**: Users, roles, permissions, role-permission assignment, audit logging. The RBAC middleware enforces permissions on EVERY protected API endpoint.

### RBAC Model
6 system roles (non-deletable `isSystem=true`):
| Role | Permission Pattern |
|------|--------------------|
| ADMIN | `*.*` (wildcard — everything) |
| MANAGER | `dashboard.*`, `crm.*`, `inventory.*`, `sales.*`, `pos.*`, `hrm.*` (NOT `users.*`, `roles.*`, `audit.*`) |
| SALES | `crm.*`, `pos.*`, `sales.create`, `sales.read`, `products.read` |
| CASHIER | `pos.*`, `customers.read`, `products.read`, `orders.read` |
| HR | `hrm.*`, `dashboard.read` |
| VIEWER | `*.read` (read-only on all business modules except admin) |

Permission code format: `module.action`, e.g. `products.create`, `customers.read`, `leave.approve`, `users.delete`.

### Backend
- `src/middleware/rbac.ts` — `requirePermission('products.create')` middleware. Checks `req.user.permissions` (populated by auth middleware) against required permission. Supports wildcard matching (e.g. `products.*` matches `products.read`). Returns 403 if denied.
- `src/modules/users/` — CRUD for users. User create hashes password with bcrypt. Patch user can activate/deactivate. DELETE is soft (set status=INACTIVE).
- `src/modules/roles/` — CRUD for roles. Role-permission assignment via many-to-many `role_permissions` table.
- `src/modules/permissions/` — Read-only list of all permissions (seeded).
- `src/modules/audit/` — Read-only list of audit logs. Filterable by userId, entityType, date range.
- **Audit Logging middleware**: After every successful POST/PATCH/DELETE that mutates data, create an `AuditLog` record: userId, action (CREATE/UPDATE/DELETE), entityType, entityId, beforeData (JSON), afterData (JSON), ipAddress (from `req.ip`), userAgent (from `req.headers['user-agent']`). We'll use a Prisma `$use` middleware or a service-level wrapper for this.

### Prisma Seed Script
`backend/prisma/seed.ts` — Run via `npx prisma db seed`. Creates realistic demo data:
- 6 permissions roles (ADMIN, MANAGER, SALES, CASHIER, HR, VIEWER)
- 100+ permission codes — one for every `module.action` combination
- 5 users: admin@example.com / manager@example.com / sales@example.com / cashier@example.com / hr@example.com
  - ALL seeded passwords: `Admin@123` (DOCUMENTED IN README — FOR LOCAL DEV ONLY, NEVER PRODUCTION)
- Departments, designations
- 30 employees
- 50 products across 8 categories
- 2 warehouses
- 30 customers
- 20 leads in every status
- 50 historical orders with items, invoices, payments
- 2 weeks of attendance records
- 10 leave requests in various states

### Frontend
- `frontend/app/(dashboard)/administration/users/page.tsx` — User list table, create user modal, edit user modal, activate/deactivate buttons
- `frontend/app/(dashboard)/administration/roles/page.tsx` — Role list, edit permissions dialog
- `frontend/app/(dashboard)/administration/audit-logs/page.tsx` — Audit log viewer with filters
- `frontend/components/common/PermissionGate.tsx` — React component that wraps children and only renders if user has required permission. Also disables/hides nav items the user can't access. NOTE: This is ONLY a UX optimization — the backend RBAC middleware is the real security. If someone bypasses the UI and calls the API directly, RBAC middleware still blocks.

### Testing This Phase
1. Run `npx prisma db seed`
2. Login as admin@example.com / Admin@123 — see all nav items, see Administration section
3. Login as cashier@example.com / Admin@123 — see ONLY POS, Customers, Orders in nav. Trying to manually navigate to `/administration/users` shows 403 page or redirects.
4. Use Postman to try `DELETE /api/v1/users/:id` with cashier's access token — backend returns 403 even though frontend hid the button.
5. Create a product as admin — check audit_logs table in pgAdmin has a record with beforeData/afterData/IP.

**Concepts learned**: RBAC vs ABAC, why frontend hiding isn't security, wildcard permission matching, audit trail design, many-to-many junction tables in Prisma, database seeding strategies, least-privilege principle.

---

## 7. PHASE 4 — Reusable UI & Table Infrastructure

> **Status**: ⏳ PENDING

**Objective**: Build the shared component library and enterprise data table infrastructure BEFORE building any module pages. Every module page then reuses these instead of reinventing the wheel.

### Components Created (all in `frontend/components/`)
| Component | Location | Purpose |
|-----------|----------|---------|
| GlobalButton | common/GlobalButton.tsx | All buttons — primary/secondary/destructive variants, loading state, disabled state |
| GlobalInput | forms/GlobalInput.tsx | Text input with label, error message, RHF register binding |
| GlobalSelect | forms/GlobalSelect.tsx | Single select dropdown (Radix Select) |
| GlobalMultiSelect | forms/GlobalMultiSelect.tsx | Multi-select with chips |
| GlobalDatePicker | forms/GlobalDatePicker.tsx | Date picker using react-day-picker |
| GlobalModal | feedback/GlobalModal.tsx | Modal dialog (Radix Dialog), title, body, footer |
| ConfirmDialog | feedback/ConfirmDialog.tsx | "Are you sure?" modal for destructive actions |
| StatusBadge | common/StatusBadge.tsx | Colored badge for status fields (ACTIVE/INACTIVE, WON/LOST, PAID/UNPAID). Colors coordinated (e.g., green badge text slightly darker green background) |
| PageHeader | common/PageHeader.tsx | Title + description + primary action button at top of every page |
| GlobalTable | tables/GlobalTable.tsx | **The big one** — wraps TanStack Table. Props: columns, data (or RTK Query hook), serverSide=true, pageSize=25. Includes: column header sorting, checkbox row selection, sticky header, loading skeleton rows, empty state, error state. Handles pagination state via URL search params + syncs with server. |
| TableToolbar | tables/TableToolbar.tsx | Above-table row: SearchInput (debounced 300ms), FilterPanel dropdown, Export button, Create New button |
| Pagination | tables/Pagination.tsx | Prev / Next / Page numbers / Jump to page — matches backend meta fields (totalItems, totalPages, hasNext, hasPrev) |
| SearchInput | tables/SearchInput.tsx | Debounced text input for TanStack table or toolbar |
| FilterPanel | tables/FilterPanel.tsx | Dynamic filter builder — field+operator+value. Generates query params. |
| EmptyState | feedback/EmptyState.tsx | "No customers yet. [Create Customer]" illustration |
| ErrorState | feedback/ErrorState.tsx | Red error card with "Something went wrong. [Retry]" button |
| LoadingSkeleton | feedback/LoadingSkeleton.tsx | N skeleton placeholder rows matching table row height |
| FormField | forms/FormField.tsx | Renders label + input + field error together for RHF |
| MoneyDisplay | common/MoneyDisplay.tsx | Formats Decimal values as currency ($1,234.56). Takes currency prop. Right-aligned in tables. |
| DateDisplay | common/DateDisplay.tsx | Formats UTC timestamps to local timezone. Props for format (short, long, relative). |
| PermissionGate | common/PermissionGate.tsx | Wraps children, renders null/fallback if user lacks permission |
| ResponsiveSidebar | layout/ResponsiveSidebar.tsx | Collapsible left nav with icons, module grouping, highlights active route. Mobile: drawer. |
| DashboardCard | charts/DashboardCard.tsx | Card wrapper for KPI metric: label, value, delta (↑/↓ % vs last period), icon |

### TanStack Table Server-Side Integration Pattern
```typescript
// In any list page:
const searchParams = useSearchParams();
const router = useRouter();

const page = parseInt(searchParams.get('page') || '1', 10);
const pageSize = parseInt(searchParams.get('pageSize') || '25', 10);
const sortBy = searchParams.get('sortBy') || 'createdAt';
const sortOrder = searchParams.get('sortOrder') || 'desc';
const search = searchParams.get('search') || '';

const { data, isLoading, isError } = useListProductsQuery({
  page, pageSize, sortBy, sortOrder, search,
  // + any filter params
});

// GlobalTable handles column defs, sort icons, row selection,
// loading skeletons, empty states. When user clicks page 2,
// it updates the URL search params, triggering a re-fetch.
```

### Backend Pagination Helper
`src/lib/pagination.ts` — Utility functions:
- `parsePaginationParams(req.query)` → `{ page, pageSize, sortBy, sortOrder, search }` with validation
- `buildPaginationMeta({ totalItems, page, pageSize })` → `{ page, pageSize, totalItems, totalPages, hasNextPage, hasPreviousPage }`
- `buildWhereClause(filters, searchableColumns)` — builds Prisma `where` object from filter+search params

**Concepts learned**: Component-driven development, TanStack Table headless UI pattern, server-side vs client-side pagination, URL search params as state for filter/pagination (so URLs are shareable), debouncing search inputs to reduce API calls, component composition with Radix UI primitives, shadcn/ui approach (copy components into repo instead of npm package).

---

## 8. PHASE 5 — CRM Module (Customers, Leads, Activities)

> **Status**: ⏳ PENDING

### Database Tables
- `customers` (id, customerCode, name, companyName, email, phone, address, city, country, status, notes, createdBy → FK users.id)
- `contacts` (id, customerId, name, email, phone, designation, isPrimary) — one customer has many contacts
- `leads` (id, leadCode, name, companyName, email, phone, source, status, value, assignedToId → users.id, notes)
- `lead_activities` (id, leadId, userId, type, subject, description, activityAt)

Status enums: LeadStatus = NEW | CONTACTED | QUALIFIED | PROPOSAL | WON | LOST
Source enums: WEBSITE | REFERRAL | SOCIAL | PHONE | EMAIL | OTHER

### Backend CRM Module
- Each sub-module (customers, contacts, leads, activities) has: `validators.ts` (Zod), `services.ts` (business logic), `controllers.ts` (thin HTTP layer), `routes.ts`
- `GET /customers` — server-side pagination, search by name/company/email/code, filter by status, sort by any column
- `POST /customers` — Validates unique email (if provided), generates customerCode (CUST-0001 auto-increment pattern stored in a counter or derived from existing max)
- `GET /customers/:id` — Includes contacts, last 10 orders, summary stats (total spent, order count)
- Leads: `PATCH /leads/:id` can change status, `POST /leads/:id/activities` adds timeline entry
- Permissions applied: `customers.read`, `customers.create`, `customers.update`, `customers.delete` etc.

### Frontend CRM
- Pages under `app/(dashboard)/crm/`: customers/page.tsx, customers/[id]/page.tsx (detail), leads/page.tsx, leads/[id]/page.tsx
- Customer list: GlobalTable with search + status filter + create button
- Customer detail: 3 tabs — Profile info, Contacts table (add/edit/remove), Orders table, Activity timeline
- Lead list: Kanban-ish pipeline view (6 columns: NEW → CONTACTED → QUALIFIED → PROPOSAL → WON → LOST) + table view toggle
- Lead detail: Status dropdown (quick change), Assigned-to user select, Activity timeline with Add Activity form

**Concepts learned**: Domain-driven module structure, one-to-many relations, Prisma `include` for joins, status pipeline workflow, auto-generated business codes (CUST-0001 pattern), detail page with tabbed sections, kanban vs table view trade-offs.

---

## 9. PHASE 6 — Inventory Module (Products, Stock, Warehouses)

> **Status**: ⏳ PENDING

### Tables
- `categories` (id, name, description, status)
- `products` (id, sku UNIQUE, name, description, categoryId, brand, unit, purchasePrice Decimal(12,2), sellingPrice Decimal(12,2), taxRate Decimal(5,2), minimumStock, status, imageUrl, createdBy)
- `warehouses` (id, code, name, address, managerId, status)
- `stock` (productId FK + warehouseId FK → composite unique PK, quantity, reservedQuantity) — physically separate stock per warehouse per product
- `stock_movements` (id, productId, warehouseId, type ENUM, quantity, referenceType, referenceId, note, createdBy, createdAt)

Stock movement types: PURCHASE, SALE, RETURN, ADJUSTMENT_IN, ADJUSTMENT_OUT, TRANSFER_IN, TRANSFER_OUT

### Critical Backend Patterns
- **Never trust client-side stock calculation**. Stock qty is the DB source of truth. When we need "available qty": `stock.quantity - stock.reservedQuantity`.
- **Manual stock adjustment**: `POST /stock/adjustments` — creates a stock_movement record AND atomically updates the stock row (increment or decrement) inside a Prisma transaction.
- **Low-stock alert API**: `GET /stock/low` returns products where `quantity - reservedQuantity < minimumStock` across any warehouse.
- **SKU uniqueness**: Backend validates with Zod + Prisma unique constraint. Duplicate SKU returns 409 Conflict with message "SKU 'XYZ-123' already exists".
- `GET /products` — Server-side search by name/SKU, filter by category/status, sort by price/name/createdAt, pagination.
- `GET /products/:id` — Includes category, stock by warehouse (array of warehouse rows + qty), last 20 stock movements.

### Frontend Inventory
- Inventory sub-pages: Categories, Products, Warehouses, Stock Overview, Stock Movements, Stock Adjustments
- Product list with image thumbnails, sellingPrice as MoneyDisplay, stock qty by warehouse (green if > minimumStock, red if low, amber if exactly at minimum)
- Stock Movement history table with colored type badges, reference links (e.g. movement type=SALE links to Order #SO-0421)
- Low Stock dashboard widget on inventory home

**Concepts learned**: Inventory tracking patterns, composite unique keys in Prisma, Decimal precision for money (NEVER use JS numbers/floats for currency — IEEE 754 floating point errors add up), row-level stock consistency, stock movement audit patterns, why reservedQuantity is separate from quantity (reserved for pending orders that haven't fully deducted yet).

---

## 10. PHASE 7 — POS & Sales Module (Atomic Transactions)

> **Status**: ⏳ PENDING

**This is the most critical phase — the "money path" of the application.** If this breaks, inventory and financial data become inconsistent. We use ONE Prisma database transaction for the entire checkout. If ANY step fails, EVERYTHING rolls back.

### Tables
- `orders` (orderNumber UNIQUE, customerId, status, subtotal, discountAmount, taxAmount, totalAmount, paymentStatus, orderDate, createdBy)
- `order_items` (orderId, productId, quantity, unitPrice, discountAmount, taxAmount, lineTotal)
- `invoices` (invoiceNumber UNIQUE, orderId, customerId, subtotal, discountAmount, taxAmount, totalAmount, status, issuedAt, dueAt)
- `payments` (paymentNumber UNIQUE, invoiceId, amount, method [CASH/CARD/MOBILE_BANKING/BANK_TRANSFER], status, paidAt, reference, receivedBy)

### Atomic Checkout Transaction (in `sales.service.ts → createSale()`)

```
PRISMA TRANSACTION BEGIN
│
├── 1. FOR EACH cart item:
│   ├── SELECT stock WHERE productId=? AND warehouseId=? FOR UPDATE  ← row lock
│   ├── available = quantity - reservedQuantity
│   ├── IF quantity_ordered > available → THROW BusinessRuleError("Insufficient stock for X")
│   └── (locks prevent race condition — second concurrent checkout waits for first transaction to commit)
│
├── 2. INSERT order + order_items (use sellingPrice FROM DB, NOT from client — client can tamper)
├── 3. INSERT invoice linked to order
├── 4. INSERT payment (if payment was taken at checkout)
├── 5. FOR EACH cart item:
│   └── UPDATE stock: quantity = quantity - qty_ordered
│   └── INSERT stock_movement (type=SALE, referenceType=ORDER, referenceId=order.id)
│
PRISMA TRANSACTION COMMIT (ALL SUCCESS) OR ROLLBACK (ANY FAILURE)
```

**Row-level locking**: `FOR UPDATE` tells PostgreSQL "I am going to update this row, give me exclusive access". If another checkout tries to buy the same product at the exact same moment, it blocks (waits) until the first transaction commits or rolls back. This guarantees no negative stock and no double-sales.

### POS Frontend (`app/(dashboard)/pos/page.tsx`)
- Left 70%: Product search bar + product grid (cards with image, name, price, stock qty). Click adds to cart. Keyboard-friendly: search bar auto-focuses on load, arrow keys + Enter to add product.
- Right 30%: Cart sidebar. Items list with qty +/- buttons, line total. Order-level discount %. Tax auto-calc. Customer selector dropdown (with quick "Walk-in Customer" default). Payment method selector. Grand total display. Checkout button.
- Checkout dispatches RTK Query mutation → shows loading spinner → on success: prints receipt view modal (printable with `window.print()`) → clears cart.
- Cart state is in a Redux Toolkit slice (`store/slices/cartSlice.ts`), persisted to `localStorage` so cart survives page refresh.

### Sales History (`app/(dashboard)/sales/page.tsx`)
- Orders table with filters (date range, customer, status, paymentStatus), server-side pagination
- Order detail: Order items, invoice, payment records, stock movements linked, printable invoice view
- Cancel order button: Requires permission `orders.cancel`. Cancelling reverses everything in another transaction (restores stock, creates RETURN stock movements, sets order.status=CANCELLED, marks invoice as VOID).

**Concepts learned**: ACID properties, database transactions, row-level locking (`SELECT ... FOR UPDATE`), concurrent access patterns, pessimistic vs optimistic locking, why you NEVER trust client-side prices, localStorage persistence for cart state, print CSS stylesheets (`@media print`), window.print() receipts.

---

## 11. PHASE 8 — HRM Module (Employees, Attendance, Leave)

> **Status**: ⏳ PENDING

### Tables
- `departments` (id, name, code, description, managerId → users.id, status)
- `designations` (id, name, code, description, status)
- `employees` (id, employeeCode UNIQUE, firstName, lastName, email, phone, dateOfBirth, joiningDate, departmentId, designationId, managerId → employees.id [self-reference for manager], employmentType [FULL_TIME/PART_TIME/CONTRACT], status, address, emergencyContactName, emergencyContactPhone)
- `attendance` (id, employeeId, attendanceDate UNIQUE per employee, checkInAt, checkOutAt, status [PRESENT/LATE/ABSENT/LEAVE/HALF_DAY], note)
- `leave_types` (id, name, code, defaultDays, status)
- `leave_requests` (id, employeeId, leaveTypeId, startDate, endDate, totalDays, reason, status [PENDING/APPROVED/REJECTED/CANCELLED], approvedById, approvedAt)

### Backend Key Logic
- **Attendance check-in**: `POST /attendance/check-in` body: `{ employeeId }`. Creates attendance row for TODAY (attendanceDate = current date in DB timezone, truncated to date). If already checked in → 409 Conflict. `status = PRESENT` if checkInAt <= 09:00 else `LATE` (configurable threshold).
- **Attendance check-out**: `POST /attendance/check-out` body: `{ employeeId }`. Finds today's attendance row, sets checkOutAt. If total hours < 4h → `HALF_DAY`.
- **Leave validation**: Before creating leave_request, check for overlapping existing leave for that employee in the date range → BusinessRuleError. `endDate >= startDate`, totalDays calculated correctly (excludes weekends? — we'll make it simple: just calendar days minus Sat/Sun).
- **Leave approval**: `POST /leave-requests/:id/approve` requires permission `leave.approve`. Sets status=APPROVED, approvedById = current user, approvedAt=now. Also inserts attendance rows with status=LEAVE for each day of the leave period (so attendance reports are accurate).
- **Self-service vs admin**: Employees should only see their own attendance/leave; HR sees everyone. Enforced in backend where clause: non-HR users querying attendance get `where: { employeeId: req.user.employeeId }`. (We'll need to link a User to an Employee via a FK.)

### Frontend HRM
- Employees: List with department/designation filters, create/edit forms with emergency contact section, employee detail profile page
- Departments & Designations: Simple CRUD tables
- Attendance: Today's check-in status tile, date-range attendance table, mass check-in button (for admin), "Check In" big button on HRM dashboard home
- Leave: "Request Leave" form (leave type, start date, end date auto-calculates days), Leave list with Pending/Approved/Rejected tabs, Approve/Reject buttons for managers/HR

**Concepts learned**: Self-referential FK in Prisma (employee → manager → employee), unique constraints on (employeeId, date), date truncation in SQL, leave validation for date range overlap, approval workflow patterns, attendance automation (status from check-in time).

---

## 12. PHASE 9 — Dashboard & Analytics (ECharts)

> **Status**: ⏳ PENDING

**Rule**: Dashboard never fetches raw data and aggregates in JavaScript. Backend API returns pre-aggregated numbers. This is faster and keeps sensitive data on the server.

### Backend Aggregation Endpoints
- `GET /dashboard/summary` — Returns one object:
  ```
  totalSalesToday: number
  totalSalesThisWeek: number
  totalSalesThisMonth: number
  orderCountToday: number
  avgOrderValue: number
  newCustomersThisMonth: number
  totalOpenLeads: number
  leadConversionRateThisMonth: number (%)
  lowStockProductCount: number
  presentEmployeesToday: number
  leaveRequestsPendingCount: number
  ```
  This uses raw SQL with `SUM`, `COUNT`, `WHERE date BETWEEN` clauses. Prisma `$queryRaw` for performance on aggregate queries.

- `GET /dashboard/sales-trend?period=week|month|quarter|year` — Array of `{ date: string, total: number, orders: number }` for charting.

- `GET /dashboard/top-products?limit=10` — `[{ productId, name, qtySold, revenue }]` sorted by revenue DESC.

- `GET /dashboard/lead-pipeline` — `[{ status: NEW, count: 12, value: 15000 }, ...]` for all 6 statuses.

- `GET /dashboard/attendance-summary?date=today` — `{ PRESENT: 28, LATE: 3, ABSENT: 2, LEAVE: 4, HALF_DAY: 1 }`.

- `GET /dashboard/recent-orders?limit=10` — Most recent completed orders (small list, not paginated).

- `GET /dashboard/recent-activities?limit=15` — Recent audit logs and lead activities combined (for activity feed).

### Frontend Dashboard (`app/(dashboard)/dashboard/page.tsx`)
- **Top row (KPI cards, 6 across)**: DashboardCard × 6 — Sales Today, Sales Month, Orders Today, New Customers, Open Leads, Present Today. Each card has colored icon, big number, small delta indicator vs previous period (e.g. Sales Today: $4,280 ↑ 12% vs yesterday).

- **Second row**:
  - Left (70% width): Sales Trend Line Chart (ECharts). Date on X axis, total sales $ on Y axis. Period dropdown (Week/Month/Quarter/Year) in header.
  - Right (30%): Lead Pipeline Doughnut Chart — 6 colored segments by status. Hover shows value in $.

- **Third row**:
  - Left: Top Products Bar Chart — top 10 by revenue, horizontal bars.
  - Right: Attendance Summary — simple stacked bar or donut.

- **Fourth row**:
  - Left: Recent Orders table (small, no pagination) — links to full Order detail
  - Right: Low Stock Alert — list of products with qty below minimum, links to product detail

### ECharts Implementation Notes
- Use `import dynamic from 'next/dynamic'; const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false, loading: () => <LoadingSkeleton /> });` — because ECharts is 700KB+; we lazy-load it and it only runs client-side (no SSR).
- Wrap chart options in `useMemo` to avoid unnecessary re-renders.
- Handle empty datasets gracefully — show "No data for this period" message instead of blank chart.
- Colors use project theme (slate/indigo/emerald variants), no mustard/yellow.

**Concepts learned**: Aggregation queries in SQL vs Prisma, raw SQL performance benefits for reporting, ECharts React integration, dynamic imports/code splitting with Next.js, KPI dashboard layout patterns, date-period comparison (this week vs last week) calculation.

---

## 13. PHASE 10 — Hardening (Performance, Security, Errors)

> **Status**: ⏳ PENDING

### Performance Checklist
1. **N+1 Query Audit**: Turn on Prisma query logging (`log: ['query']` in prisma client config) and visit every list page. If you see 26 SELECT queries for a 25-row page of products with categories → that's N+1. Fix by adding `include: { category: true }` in product findMany.
2. **Prisma `select` for list APIs**: List endpoints don't need every column. Use `select: { id: true, name: true, sku: true, sellingPrice: true, createdAt: true }` instead of fetching all columns. Reduces data transfer and memory.
3. **Add indexes**: Run `EXPLAIN ANALYZE` in pgAdmin on the slowest queries (from Prisma log). If Seq Scan on a 1000-row table → add index. Example: `CREATE INDEX idx_orders_orderDate ON orders(orderDate);` — we'll add these as `prisma migrate dev --name add_perf_indexes`.
4. **TanStack Table virtualization**: If we test 1000+ rows on screen (no pagination), add `@tanstack/react-virtual` to GlobalTable as an optional mode.
5. **Next.js `<Suspense>` boundaries**: Wrap lazy-loaded chart components in `<Suspense fallback={<LoadingSkeleton />}>`.
6. **Bundle analyzer**: `cd frontend && npx @next/bundle-analyzer` — identify heavy imports.
7. **Image optimization**: Product images use Next.js `<Image>` component with proper width/height/sizes props. `public/` folder uses AVIF/WebP conversion.

### Security Checklist
1. **Helmet CSP headers**: Configure nonce-based Content Security Policy so inline styles/scripts are blocked.
2. **Generic auth errors**: "Invalid email or password" regardless of which is wrong. "If we see your account, we'll send an email" for forgot password. Both prevent account enumeration.
3. **CORS strict**: Backend CORS config allows ONLY `FRONTEND_URL` in production. Never `*`.
4. **No secrets in client env vars**: Double-check only `NEXT_PUBLIC_*` vars are exposed to browser.
5. **Rate limit tune-up**: Increase limits for authenticated users, keep strict for auth endpoints.
6. **Input validation review**: Every Zod schema explicitly disallows unknown fields with `.strict()` or `.strip()`.
7. **File upload (if any)**: If product image upload is added later, restrict file types to PNG/JPG/WebP, max size 2MB, sanitize filenames, store in S3-compatible storage not filesystem.

### Error Handling Checklist
1. All RTK Query mutations show toast notifications for success/failure.
2. Prisma P2002 (unique constraint violation) errors are caught in error middleware and mapped to 409 Conflict with a friendly message.
3. All pages have `error.tsx` at route level.
4. 404 `not-found.tsx` styled.
5. Global `global-error.tsx` at root with "Go to home" button.

**Concepts learned**: N+1 query detection and prevention, `EXPLAIN ANALYZE` basics, B-tree indexes, Next.js bundle analysis, CSP header configuration, account enumeration prevention, Prisma error codes (P2002, P2003, P2014, P2025).

---

## 14. PHASE 11 — Testing (Vitest, Supertest, Playwright)

> **Status**: ⏳ PENDING

We do NOT chase 100% coverage. We test what actually matters: authentication, RBAC enforcement, POS atomic transaction (the money path), and inventory constraints.

### Backend Tests (Vitest + Supertest)
- `backend/tests/auth.test.ts`:
  - Login with valid creds → 200 + accessToken + set-cookie refreshToken
  - Login with wrong password → 401 + generic message
  - Login with non-existent email → 401 + same generic message (enumeration check)
  - Refresh with valid cookie → new access token + rotated refresh token
  - Refresh with revoked/invalid cookie → 401
  - Me endpoint with valid token → 200 with user data
  - Me endpoint without token → 401
  - 10 rapid login attempts → 429 Too Many Requests (rate limit test)
- `backend/tests/rbac.test.ts`:
  - Admin can DELETE /users/:id → 200
  - Cashier tries DELETE /users/:id → 403 (even with valid auth!)
  - Sales can POST /customers → 201
  - Viewer tries POST /customers → 403
  - No token, any POST → 401
- `backend/tests/pos.test.ts` — **THE MOST IMPORTANT TEST**:
  - Create sale of product with qty=5 in stock → stock becomes 4 (4+1=5, right? No: stock=5, sold 1, stock becomes 4)
  - Create 3 concurrent sales of same product with qty=2 each, but stock is only 5 → EXACTLY 2 should succeed (total sold 4), 1 should fail with "Insufficient stock" (tests row-level locking prevents oversell)
  - Cancel order → stock is restored, RETURN movement created, invoice voided
  - Attempt to sell quantity=0 → 422 validation error
  - Attempt to sell non-existent product → 404
- `backend/tests/inventory.test.ts`:
  - Adjust stock +10, verify stock_movement row with ADJUSTMENT_IN
  - Adjust stock -100 when qty is 10 → BusinessRuleError, NO change to stock qty
  - SKU duplicate creates → 409 Conflict

### Frontend Tests (Vitest + React Testing Library)
- Login form renders fields, shows validation error on empty submit, shows loading state on submit, shows error toast on invalid creds, redirects on success
- PermissionGate renders children when permission exists, renders null (or fallback) when permission missing
- GlobalTable shows loading skeletons when isLoading, shows empty state when data=[], shows error state on isError
- MoneyDisplay formats $1234.5 correctly (renders "$1,234.50")

### E2E Tests (Playwright)
- **Flow 1: Admin login → Create Customer → Create Lead → Convert Lead to Won**
- **Flow 2: Product check (stock=10) → Cashier login → POS: add 3 × product → checkout → verify stock=7 in inventory**
- **Flow 3: HR login → Create Employee → Submit leave request → Login as Manager → Approve leave → Check attendance shows LEAVE status**

### Running Tests
```
# Backend unit/integration tests
cd backend && npm run test
# Frontend tests
cd frontend && npm run test
# Playwright E2E (run both servers first!)
npx playwright test
```

**Concepts learned**: Test pyramid (few E2E, more integration, many unit), testing-library philosophy ("test behavior not implementation"), Supertest for Express integration testing, concurrency testing via Promise.all, Vitest globalSetup/teardown for test DB lifecycle (reset DB before each test run).

---

## 15. PHASE 12 — Deployment (Vercel + Render + Managed PostgreSQL)

> **Status**: ⏳ PENDING

**Objective**: Make it public on the real internet, for free, using free tiers.

### Free Tier Providers (confirmed available as of 2026, verify current offerings)
- **Frontend**: Vercel Hobby (free) — deploys Next.js directly from GitHub repo. 100GB bandwidth/month, unlimited projects.
- **Backend API**: Render Free Tier (free) — Node.js service. Spins down after 15 min idle (first request wakes it up in ~30 sec). 750 hours/month.
- **Database**: Choose ONE free managed PostgreSQL:
  - **Neon**: https://neon.tech — Free tier: 0.5GB storage, 1GB RAM, auto-sleeps. Good UX.
  - **Supabase**: https://supabase.com — Free tier: 500MB storage, 2GB bandwidth. Includes pgAdmin-like SQL editor.
  - **Render PostgreSQL**: Free tier: 1GB storage, auto-deletes after 90 days — NOT recommended.

### Deployment Steps
1. **Push everything to GitHub**: Create new private repo at github.com → push project.
2. **Set up managed Postgres** (Neon or Supabase):
   - Create new project, database name `business_suite`
   - Copy the connection string (DATABASE_URL), add query params `?pgbouncer=true&connection_limit=1` (connection pooling)
   - Run migration against remote DB: `cd backend && DATABASE_URL=postgres://remote... npx prisma migrate deploy`
   - Run seed: `DATABASE_URL=remote... npx prisma db seed`
3. **Deploy Backend to Render**:
   - New → Web Service → Connect GitHub repo
   - Root Directory: `backend`
   - Runtime: Node
   - Build Command: `npm install && npx prisma generate && npx tsc`
   - Start Command: `node dist/server.js`
   - Environment Variables: Paste ALL backend .env vars (NODE_ENV=production, PORT=10000, DATABASE_URL=remote..., JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, ACCESS_TOKEN_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN, FRONTEND_URL=https://your-project.vercel.app, COOKIE_DOMAIN=.your-project.vercel.app, RATE_LIMIT vars)
   - Click "Create Web Service" — wait for deploy. Copy the Render URL e.g. `https://business-suite-api-xyz.onrender.com`
4. **Deploy Frontend to Vercel**:
   - Add New → Project → Import GitHub repo
   - Root Directory: `frontend`
   - Framework Preset: Next.js (auto-detected)
   - Environment Variables:
     - `NEXT_PUBLIC_API_URL`: `https://business-suite-api-xyz.onrender.com/api/v1`
     - `NEXT_PUBLIC_APP_NAME`: `Business Suite`
   - Click Deploy. Wait. Copy Vercel URL e.g. `https://business-suite-abc.vercel.app`
5. **Update CORS on Backend**: Go back to Render environment vars → set `FRONTEND_URL=https://business-suite-abc.vercel.app` → trigger a manual redeploy (Clear Build Cache & Deploy).
6. **Smoke test the public deployment**:
   - Open https://business-suite-abc.vercel.app
   - Login as admin@example.com / Admin@123 (REMINDER: Change this IMMEDIATELY or deactivate this user after demo!)
   - Check dashboard loads
   - Try POS → create a sale
   - If any CORS errors → check backend FRONTEND_URL matches EXACTLY (no trailing slash, correct protocol https://)
7. **Add custom domain (optional)**: If you own a domain, Vercel and Render both have easy custom domain setup.

**Post-deployment considerations**:
- ⚠️ Render free tier sleeps after 15min. First request may take 30-60 seconds. Explain this in your resume interview: "For production, I'd upgrade to Render's paid tier at $7/month which never sleeps."
- ⚠️ Seed password `Admin@123` is PUBLIC. Change it OR deactivate all seed users after public demo. Or set a different password in the seed script BEFORE running seed against the production database.
- ⚠️ Neon free tier idle timeout: database sleeps after 5 minutes of inactivity, wakes on next query (~5 sec). Another "upgraded tier" interview talking point.
- ⚠️ Rate limits: Vercel Hobby has 100GB bandwidth/month. Render free has 750 hours/month (which means exactly ONE free service running 24/7 — perfect).

**Concepts learned**: Environment separation (dev vs prod), managed databases vs self-hosted, CORS origin configuration for multiple domains, connection pooling for serverless/PaaS environments (Prisma + pgbouncer), HTTPS-by-default platforms, CI/CD pipelines (Vercel/Render auto-deploy on git push to main).

---

## 16. PHASE 13 — Docker & Nginx Learning

> **Status**: ⏳ PENDING

**This phase is PURELY EDUCATIONAL.** You don't need Docker to run this project locally. But Docker is on every backend job description, so we learn it.

### What You'll Learn
- **Image vs Container**: An image is the compiled "recipe" (OS + Node + code). A container is a running instance of that image. Think: image = class, container = object.
- **Dockerfile**: Build instructions for the image (`FROM`, `COPY`, `RUN npm install`, `EXPOSE`, `CMD`).
- **Docker Compose**: `docker-compose.yml` orchestrates multiple containers (postgres + backend + nginx) as one stack. One command: `docker compose up`.
- **Volumes**: Map a host folder or named volume to a container path. Persists PostgreSQL data when containers are deleted. Without volumes, `rm -rf postgres_container` → ALL DATA LOST.
- **Container networking**: Containers on the same docker-compose network can talk to each other by service name (e.g. backend can connect to postgres via `postgres:5432` hostname, not localhost).
- **Nginx as reverse proxy**: Browser → `https://app.example.com` → Nginx on port 443 → `/api/*` goes to Express backend container (internal port 5000), `/` goes to Next.js frontend container or Nginx serves static Next build. This is how enterprise deployments work. Nginx also handles TLS/HTTPS termination (SSL cert from Let's Encrypt).
- **How this differs from actual deployment**: We deployed on Vercel+Render, NOT Docker. Docker is how you'd self-host on AWS EC2 / DigitalOcean Droplet / Hetzner.

### Files Created
- `backend/Dockerfile` — Multi-stage build: Stage 1 installs all deps + builds TypeScript → dist/. Stage 2 is a smaller image with only production deps + dist/. Security best practice: smaller attack surface.
- `backend/.dockerignore` — Prevents COPYing node_modules, .env, dist, etc.
- `docker-compose.yml` — Defines 3 services:
  1. **postgres**: postgres:16 image, environment POSTGRES_DB/PASSWORD, volume `postgres_data:/var/lib/postgresql/data`, port 5432 published locally.
  2. **backend**: `build: ./backend`, env_file: `./backend/.env`, ports "5000:5000", depends_on postgres.
  3. **(Optional)** pgadmin: dpage/pgadmin4, port 5050:80, for DB UI in Docker.
- `nginx/Dockerfile` + `nginx/nginx.conf` — Nginx reverse proxy config (for local learning, not required for free deployment).

### Running It
```
# 1. Start everything
docker compose up -d
# 2. Check logs
docker compose logs -f backend
# 3. Run migration inside backend container
docker compose exec backend npx prisma migrate deploy
# 4. Run seed
docker compose exec backend npx prisma db seed
# 5. Open http://localhost:5000/api/v1/health — should be OK
# 6. Stop and remove (CAUTION: -v DELETES postgres volume = data loss!)
docker compose down
# Stop without deleting volume
docker compose down
```

**Concepts learned**: Containerization vs virtual machines, Docker image layers (each RUN command creates a cached layer — order COPY package.json FIRST before COPY . for install caching), multi-stage builds, docker-compose service discovery, persistent volumes, reverse proxy topology.

---

## 17. FULL TECHNOLOGY STACK REFERENCE

### FRONTEND
| Technology | Version (approx) | Purpose |
|------------|-----------------|---------|
| Next.js | 15.x (App Router) | Frontend framework, routing, layouts, SSR/SSG |
| React | 19.x | UI component library |
| TypeScript | 5.x | Type safety for all .ts/.tsx files |
| Tailwind CSS | 3.x | Utility-first CSS, responsive design |
| shadcn/ui (Radix UI primitives) | latest | Accessible UI components: dialogs, selects, toasts, etc. |
| Redux Toolkit | latest | Global UI state (auth session, POS cart, UI preferences) |
| RTK Query (part of RTK) | latest | Server state — caching, auto-refetch, invalidation, API calls |
| TanStack React Table | latest | Enterprise data tables (sort, filter, paginate, select) |
| TanStack React Virtual | latest | Large-list DOM virtualization (optional) |
| React Hook Form | latest | Performant form state management (controlled/uncontrolled) |
| Zod | latest | Schema validation (shared concept between frontend/backend schemas) |
| @hookform/resolvers | latest | Zod → RHF integration |
| Apache ECharts | latest | All charts (line, bar, pie/doughnut) |
| echarts-for-react | latest | React wrapper for ECharts |
| date-fns | latest | Date formatting/manipulation |
| react-day-picker | latest | Date picker component |
| lucide-react | latest | Icon library (MIT, tree-shakeable) |
| clsx + tailwind-merge | latest | Safe dynamic className construction |
| class-variance-authority | latest | shadcn/ui component variants |

### BACKEND
| Technology | Version (approx) | Purpose |
|------------|-----------------|---------|
| Node.js | 22 LTS | JavaScript runtime |
| Express | 4.21.x | REST API framework |
| TypeScript | 5.x | Backend type safety |
| Prisma ORM | latest | PostgreSQL access, migrations, type-safe query builder |
| PostgreSQL | 16 | Relational database |
| bcryptjs | latest | Password hashing (cost 12) |
| jsonwebtoken | latest | JWT access token creation/verification |
| cookie-parser | latest | Parse cookies from request (for refresh token cookie) |
| cors | latest | CORS configuration |
| helmet | latest | Security HTTP headers (CSP, X-Frame-Options, etc.) |
| compression | latest | Gzip/brotli response compression |
| express-rate-limit | latest | In-memory rate limiting (strict on auth endpoints) |
| zod | latest | Backend request validation (authoritative; frontend validation is UX only) |
| uuid | latest | UUID generation if needed outside Prisma |
| dayjs | latest | Backend date math (smaller API surface than moment) |
| http-status-codes | latest | Enum for HTTP codes (e.g. StatusCodes.UNAUTHORIZED vs raw 401) |

### TESTING & TOOLING
| Technology | Purpose |
|------------|---------|
| Vitest | Unit/integration test runner (frontend + backend, one tool) |
| React Testing Library | Frontend component tests — user behavior, not implementation |
| @testing-library/jest-dom | RTL matchers (toBeInTheDocument, etc.) |
| Supertest | HTTP integration testing for Express (mock requests without a running server) |
| Playwright | Cross-browser end-to-end tests (critical user flows) |
| ts-node-dev | Backend dev server (auto-restart on TS file changes) |
| nodemon | Alternative file watcher |
| Prisma Studio | `npx prisma studio` — web UI for exploring database data |
| pgAdmin 4 | PostgreSQL administration GUI (ships with PostgreSQL installer) |

### DEPLOYMENT & DEVOPS (Learning)
| Technology | Purpose |
|------------|---------|
| Docker | Containerization of backend + postgres for local dev & self-hosting |
| Docker Compose | Orchestrate multi-container local stack |
| Nginx | Reverse proxy + TLS termination (self-host learning) |
| Vercel | Frontend hosting |
| Render | Backend hosting |
| Neon / Supabase | Managed PostgreSQL hosting |
| GitHub | Git repository, collaboration, future CI/CD via Actions |

---

## 18. COMPLETE FOLDER STRUCTURE TREE

```
business-suite/
│
├── BUILD_PROCESS.md                      ← THIS FILE — the book of how everything was built
├── README.md                             ← Quick-start guide for developers
├── docker-compose.yml                    ← Phase 13: Local Docker stack (postgres+backend+optional nginx/pgadmin)
├── .gitignore
│
├── frontend/                             ← Next.js Frontend Application
│   ├── .env.local                        ← NEXT_PUBLIC_API_URL, NEXT_PUBLIC_APP_NAME (NOT in git)
│   ├── .eslintrc.json
│   ├── next.config.mjs
│   ├── tsconfig.json
│   ├── package.json
│   ├── package-lock.json
│   ├── postcss.config.js
│   ├── tailwind.config.ts
│   │
│   ├── public/
│   │   ├── favicon.ico
│   │   └── images/                       ← Product images, logo, etc.
│   │
│   └── src/
│       ├── app/
│       │   ├── layout.tsx                ← Root layout (html/body, metadata, ReduxProvider)
│       │   ├── global-error.tsx          ← Root-level fallback error boundary
│       │   ├── loading.tsx               ← Global loading UI (skeleton page)
│       │   ├── not-found.tsx             ← Styled 404 page
│       │   ├── robots.ts                 ← Next.js metadata API: /robots.txt
│       │   ├── sitemap.ts                ← /sitemap.xml (for SEO, public pages only)
│       │   │
│       │   ├── (public)/                 ← Route Group: unauthenticated landing pages
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx              ← Home / Landing page
│       │   │   ├── features/page.tsx
│       │   │   ├── pricing/page.tsx
│       │   │   └── contact/page.tsx
│       │   │
│       │   ├── (auth)/                   ← Route Group: authentication pages
│       │   │   ├── login/page.tsx
│       │   │   └── forgot-password/page.tsx
│       │   │
│       │   └── (dashboard)/              ← Route Group: protected, authenticated
│       │       ├── layout.tsx            ← Sidebar + Navbar wrapper, auth check, redirects to login
│       │       ├── error.tsx             ← Route-level error boundary for dashboard
│       │       ├── loading.tsx
│       │       │
│       │       ├── dashboard/page.tsx    ← KPIs + Charts
│       │       │
│       │       ├── crm/
│       │       │   ├── customers/
│       │       │   │   ├── page.tsx      ← Customer list
│       │       │   │   └── [id]/page.tsx ← Customer detail (tabs: profile, contacts, orders, activity)
│       │       │   ├── leads/
│       │       │   │   ├── page.tsx      ← Lead list + pipeline view
│       │       │   │   └── [id]/page.tsx ← Lead detail + activity timeline
│       │       │   └── page.tsx          ← CRM home / quick actions
│       │       │
│       │       ├── inventory/
│       │       │   ├── categories/page.tsx
│       │       │   ├── products/
│       │       │   │   ├── page.tsx
│       │       │   │   └── [id]/page.tsx
│       │       │   ├── warehouses/page.tsx
│       │       │   ├── stock/page.tsx        ← Stock overview + low stock
│       │       │   ├── stock/movements/page.tsx
│       │       │   ├── stock/adjustments/page.tsx
│       │       │   └── page.tsx
│       │       │
│       │       ├── pos/
│       │       │   └── page.tsx          ← POS interface (product grid + cart sidebar)
│       │       │
│       │       ├── sales/
│       │       │   ├── orders/
│       │       │   │   ├── page.tsx
│       │       │   │   └── [id]/page.tsx
│       │       │   ├── invoices/[id]/page.tsx
│       │       │   └── page.tsx
│       │       │
│       │       ├── hrm/
│       │       │   ├── employees/
│       │       │   │   ├── page.tsx
│       │       │   │   └── [id]/page.tsx
│       │       │   ├── departments/page.tsx
│       │       │   ├── designations/page.tsx
│       │       │   ├── attendance/page.tsx
│       │       │   ├── leave-requests/page.tsx
│       │       │   └── page.tsx
│       │       │
│       │       └── administration/
│       │           ├── users/page.tsx
│       │           ├── roles/page.tsx
│       │           ├── permissions/page.tsx
│       │           └── audit-logs/page.tsx
│       │
│       ├── components/
│       │   ├── ui/                       ← shadcn/ui primitives (Radix UI wrappers)
│       │   │   ├── button.tsx
│       │   │   ├── input.tsx
│       │   │   ├── select.tsx
│       │   │   ├── dialog.tsx
│       │   │   ├── dropdown-menu.tsx
│       │   │   ├── label.tsx
│       │   │   ├── toast.tsx
│       │   │   ├── toaster.tsx
│       │   │   ├── use-toast.ts
│       │   │   ├── alert-dialog.tsx
│       │   │   ├── tabs.tsx
│       │   │   ├── avatar.tsx
│       │   │   ├── separator.tsx
│       │   │   ├── tooltip.tsx
│       │   │   ├── popover.tsx
│       │   │   ├── checkbox.tsx
│       │   │   ├── switch.tsx
│       │   │   └── calendar.tsx
│       │   │
│       │   ├── layout/
│       │   │   ├── ResponsiveSidebar.tsx
│       │   │   ├── Navbar.tsx
│       │   │   ├── PageContainer.tsx
│       │   │   └── DashboardShell.tsx
│       │   │
│       │   ├── forms/
│       │   │   ├── GlobalInput.tsx
│       │   │   ├── GlobalSelect.tsx
│       │   │   ├── GlobalMultiSelect.tsx
│       │   │   ├── GlobalDatePicker.tsx
│       │   │   └── FormField.tsx
│       │   │
│       │   ├── tables/
│       │   │   ├── GlobalTable.tsx
│       │   │   ├── TableToolbar.tsx
│       │   │   ├── Pagination.tsx
│       │   │   └── SearchInput.tsx
│       │   │
│       │   ├── feedback/
│       │   │   ├── GlobalModal.tsx
│       │   │   ├── ConfirmDialog.tsx
│       │   │   ├── EmptyState.tsx
│       │   │   ├── ErrorState.tsx
│       │   │   └── LoadingSkeleton.tsx
│       │   │
│       │   ├── charts/
│       │   │   ├── DashboardCard.tsx
│       │   │   ├── LineChart.tsx
│       │   │   ├── BarChart.tsx
│       │   │   ├── DoughnutChart.tsx
│       │   │   └── index.ts
│       │   │
│       │   └── common/
│       │       ├── GlobalButton.tsx
│       │       ├── StatusBadge.tsx
│       │       ├── PageHeader.tsx
│       │       ├── FilterPanel.tsx
│       │       ├── MoneyDisplay.tsx
│       │       ├── DateDisplay.tsx
│       │       └── PermissionGate.tsx
│       │
│       ├── features/                     ← Module-specific components/hooks/api
│       │   ├── auth/
│       │   │   ├── apiSlice.ts           ← RTK Query: login, refresh, logout, me, forgot/reset
│       │   │   ├── authSlice.ts          ← Redux: user, isAuthenticated
│       │   │   ├── LoginForm.tsx
│       │   │   ├── ProtectedRoute.tsx
│       │   │   └── LogoutButton.tsx
│       │   ├── crm/
│       │   │   ├── customersApiSlice.ts
│       │   │   ├── leadsApiSlice.ts
│       │   │   ├── CustomerForm.tsx
│       │   │   ├── LeadPipelineView.tsx
│       │   │   └── LeadActivityTimeline.tsx
│       │   ├── inventory/
│       │   │   ├── productsApiSlice.ts
│       │   │   ├── stockApiSlice.ts
│       │   │   ├── ProductForm.tsx
│       │   │   └── StockMovementTable.tsx
│       │   ├── pos/
│       │   │   ├── cartSlice.ts          ← Redux: cart items, total, discounts
│       │   │   ├── salesApiSlice.ts
│       │   │   ├── ProductGrid.tsx
│       │   │   ├── CartSidebar.tsx
│       │   │   ├── CheckoutModal.tsx
│       │   │   └── ReceiptView.tsx
│       │   ├── sales/
│       │   │   ├── ordersApiSlice.ts
│       │   │   ├── invoicesApiSlice.ts
│       │   │   └── InvoicePrintView.tsx
│       │   ├── hrm/
│       │   │   ├── employeesApiSlice.ts
│       │   │   ├── attendanceApiSlice.ts
│       │   │   ├── leaveApiSlice.ts
│       │   │   ├── EmployeeForm.tsx
│       │   │   ├── LeaveRequestForm.tsx
│       │   │   └── CheckInButton.tsx
│       │   ├── administration/
│       │   │   ├── usersApiSlice.ts
│       │   │   ├── rolesApiSlice.ts
│       │   │   ├── permissionsApiSlice.ts
│       │   │   ├── auditApiSlice.ts
│       │   │   ├── UserForm.tsx
│       │   │   └── RolePermissionsDialog.tsx
│       │   └── dashboard/
│       │       ├── dashboardApiSlice.ts
│       │       ├── KpiCardsRow.tsx
│       │       ├── SalesTrendChart.tsx
│       │       ├── LeadPipelineChart.tsx
│       │       ├── TopProductsChart.tsx
│       │       ├── AttendanceSummaryChart.tsx
│       │       └── RecentActivityFeed.tsx
│       │
│       ├── lib/
│       │   ├── api/
│       │   │   ├── baseQueryWithReauth.ts ← RTK Query baseQuery w/ auto 401 refresh
│       │   │   └── apiSlice.ts           ← Root createApi({ baseQuery... })
│       │   ├── utils.ts                  ← cn() = tailwind-merge, formatters
│       │   ├── axiosInstance.ts          ← (if needed) axios wrapper
│       │   └── constants.ts              ← app-wide constants
│       │
│       ├── hooks/
│       │   ├── useDebounce.ts            ← For search inputs
│       │   ├── usePaginationParams.ts    ← Read/write URL search params for table state
│       │   ├── useToast.ts               ← Sonner/shadcn toast hook
│       │   └── usePermission.ts          ← Check current user permission
│       │
│       ├── store/
│       │   ├── store.ts                  ← configureStore: authReducer, cartReducer, api.reducer, middleware
│       │   ├── hooks.ts                  ← typed useSelector, useDispatch
│       │   ├── StoreProvider.tsx         ← Next.js client component that wraps app with <Provider store={store}>
│       │   └── slices/
│       │       ├── authSlice.ts
│       │       ├── cartSlice.ts
│       │       └── uiPreferencesSlice.ts ← Sidebar collapsed, theme (if dark mode added)
│       │
│       ├── types/
│       │   ├── api.ts                    ← ApiResponse<T>, PaginationMeta
│       │   ├── auth.ts                   ← LoginResponse, User, Role, Permission
│       │   ├── crm.ts                    ← Customer, Lead, Contact, LeadActivity
│       │   ├── inventory.ts              ← Product, Category, Warehouse, Stock, StockMovement
│       │   ├── sales.ts                  ← Order, OrderItem, Invoice, Payment
│       │   ├── hrm.ts                    ← Employee, Department, Attendance, LeaveRequest
│       │   └── audit.ts                  ← AuditLog
│       │
│       └── utils/
│           ├── formatters.ts             ← formatMoney(), formatDate(), formatPhone()
│           ├── validators.ts             ← Shared Zod schemas (email, phone, etc.)
│           └── permissions.ts            ← Permission code constants, hasPermission() helper
│
├── backend/                              ← Express REST API Server
│   ├── .env                              ← DATABASE_URL, JWT_*, PORT, etc. (NOT in git)
│   ├── tsconfig.json
│   ├── package.json
│   ├── package-lock.json
│   ├── .dockerignore                     ← Phase 13
│   ├── Dockerfile                        ← Phase 13
│   │
│   ├── prisma/
│   │   ├── schema.prisma                 ← ALL PostgreSQL models in one file
│   │   ├── seed.ts                       ← Demo data: users, roles, 30+ employees, 50+ products, orders, etc.
│   │   └── migrations/
│   │       └── 20260825000000_init_core_tables/
│   │           └── migration.sql         ← Generated SQL from schema
│   │
│   ├── src/
│   │   ├── server.ts                     ← app.listen() entrypoint, graceful shutdown
│   │   ├── app.ts                        ← Express app construction: middleware, routes, errorHandlers LAST
│   │   │
│   │   ├── config/
│   │   │   ├── env.ts                    ← Zod-validated env vars (fail fast on misconfiguration)
│   │   │   └── logger.ts                 ← Console/structured logging wrapper
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.ts                   ← authenticate(): verifies JWT, attaches req.user
│   │   │   ├── rbac.ts                   ← requirePermission('products.create'): 403 if no match
│   │   │   ├── validate.ts               ← validate(schema): parses body/query via Zod, returns 422
│   │   │   ├── rateLimiter.ts            ← express-rate-limit configs (authStrict, authenticated, public)
│   │   │   ├── errorHandler.ts           ← LAST middleware: catches all errors, maps typed classes → HTTP, enveloped
│   │   │   ├── notFound.ts               ← 404 handler
│   │   │   └── auditLogger.ts            ← After response: creates AuditLog record for mutations
│   │   │
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   │   ├── validators.ts         ← Zod: login, forgot, reset
│   │   │   │   ├── services.ts           ← AuthService: login, refresh, logout, me, hashPassword, generateTokens
│   │   │   │   ├── controllers.ts        ← Thin: call service, send response
│   │   │   │   └── routes.ts             ← POST /login, POST /refresh, POST /logout, GET /me, etc.
│   │   │   ├── health/
│   │   │   │   └── routes.ts             ← GET /health → status ok, DB ping
│   │   │   ├── users/
│   │   │   │   ├── validators.ts
│   │   │   │   ├── services.ts
│   │   │   │   ├── controllers.ts
│   │   │   │   └── routes.ts
│   │   │   ├── roles/
│   │   │   │   ├── validators.ts
│   │   │   │   ├── services.ts
│   │   │   │   ├── controllers.ts
│   │   │   │   └── routes.ts
│   │   │   ├── permissions/
│   │   │   │   ├── services.ts
│   │   │   │   ├── controllers.ts
│   │   │   │   └── routes.ts
│   │   │   ├── audit/
│   │   │   │   ├── services.ts
│   │   │   │   ├── controllers.ts
│   │   │   │   └── routes.ts
│   │   │   ├── crm/
│   │   │   │   ├── customers/
│   │   │   │   ├── contacts/
│   │   │   │   ├── leads/
│   │   │   │   └── activities/
│   │   │   │       ├── validators.ts, services.ts, controllers.ts, routes.ts
│   │   │   ├── inventory/
│   │   │   │   ├── categories/
│   │   │   │   ├── products/
│   │   │   │   ├── warehouses/
│   │   │   │   ├── stock/
│   │   │   │   └── movements/
│   │   │   ├── sales/
│   │   │   │   ├── orders/
│   │   │   │   ├── invoices/
│   │   │   │   ├── payments/
│   │   │   │   └── pos/        ← Checkout transaction service (the big atomic one)
│   │   │   ├── hrm/
│   │   │   │   ├── departments/
│   │   │   │   ├── designations/
│   │   │   │   ├── employees/
│   │   │   │   ├── attendance/
│   │   │   │   ├── leave-types/
│   │   │   │   └── leave-requests/
│   │   │   └── dashboard/
│   │   │       ├── services.ts           ← Aggregation queries (raw SQL via prisma.$queryRaw)
│   │   │       ├── controllers.ts
│   │   │       └── routes.ts
│   │   │
│   │   ├── routes/
│   │   │   └── index.ts                  ← Combines all module routes under /api/v1
│   │   │
│   │   ├── lib/
│   │   │   ├── prisma.ts                 ← Singleton PrismaClient (prevents dev connection leaks)
│   │   │   ├── errors.ts                 ← Typed error classes: AppError, ValidationError, AuthError, etc.
│   │   │   ├── response.ts               ← successResponse() / errorResponse() envelope helpers
│   │   │   └── pagination.ts             ← parsePaginationParams(), buildPaginationMeta(), buildWhereClause()
│   │   │
│   │   ├── utils/
│   │   │   ├── date.ts                   ← dayjs wrappers
│   │   │   ├── crypto.ts                 ← randomToken(), hashRefreshToken()
│   │   │   ├── businessCodes.ts          ← generateNextCode('CUST-') using DB max pattern
│   │   │   └── permutations.ts           ← Permission code matching helper (wildcard support)
│   │   │
│   │   └── types/
│   │       ├── express.d.ts              ← Augment Express Request type: req.user, req.permissions
│   │       ├── api.ts                    ← PaginationParams, PaginatedResponse
│   │       ├── auth.ts
│   │       ├── crm.ts
│   │       ├── inventory.ts
│   │       ├── sales.ts
│   │       └── hrm.ts
│   │
│   └── tests/
│       ├── setup.ts                      ← Vitest globalSetup: test DB, truncate, seed minimal
│       ├── auth.test.ts
│       ├── rbac.test.ts
│       ├── pos.test.ts                   ← Atomic transaction + concurrency
│       ├── inventory.test.ts
│       └── helpers/
│           ├── testClient.ts             ← Supertest agent with auth helper methods
│           └── factories.ts              ← Test data factories (createTestUser, createTestProduct)
│
├── docs/                                 ← Architecture documentation
│   ├── architecture.md                   ← Design decisions, request lifecycle diagrams
│   ├── database.md                       ← ERD text description, index tuning notes, migration history
│   ├── api.md                            ← Full API reference: all endpoints, request/response examples
│   ├── rbac.md                           ← Role/permission matrix
│   └── learning-notes.md                 ← Updated after every phase: key lessons, mistakes, trade-offs
│
├── nginx/                                ← Phase 13 learning only
│   ├── Dockerfile
│   └── nginx.conf                        ← Reverse proxy: / → frontend, /api → backend
│
└── playwright/                           ← Phase 11 E2E tests
    ├── tests/
    │   ├── auth-crm-flow.spec.ts
    │   ├── pos-inventory-flow.spec.ts
    │   └── hrm-leave-flow.spec.ts
    └── playwright.config.ts
```

---

## 19. ENVIRONMENT VARIABLE REFERENCE

### `backend/.env` (never commit this)
```
# ──────────────────────────────────────────────────────────
# Backend — Business Suite
# Copy this to backend/.env and FILL IN REAL VALUES below
# NEVER commit .env files to git.
# ──────────────────────────────────────────────────────────

# ── Runtime ───────────────────────────────────────────────
NODE_ENV=development            # development | test | production
PORT=5000                        # Render: MUST use 10000 (Render's default exposed port)

# ── Database (local PostgreSQL or Neon/Supabase remote) ───
# LOCAL: postgresql://USER:PASSWORD@localhost:5432/business_suite?schema=public
# REMOTE (Neon): postgresql://user:pw@ep-xxxx.region.neon.tech/business_suite?pgbouncer=true&sslmode=require
# REMOTE (Supabase): postgresql://postgres:PW@db.xxx.supabase.co:5432/postgres?schema=public
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/business_suite?schema=public

# ── JWT Secrets ────────────────────────────────────────────
# ⚠️ GENERATE THESE YOURSELF. Example generator command in PowerShell:
#   -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | % {[char]$_})
# Must be DIFFERENT for access vs refresh.
JWT_ACCESS_SECRET=replace_me_with_random_64_char_string_for_access
JWT_REFRESH_SECRET=replace_me_with_random_64_char_string_for_REFRESH

# ── Token Expiry ───────────────────────────────────────────
# Short-lived access token (15 minutes is standard)
ACCESS_TOKEN_EXPIRES_IN=15m
# Longer-lived refresh token (7 days — the user re-auths this often)
REFRESH_TOKEN_EXPIRES_IN=7d

# ── CORS & Cookies ─────────────────────────────────────────
# Frontend origin. NO TRAILING SLASH.
# Local:  http://localhost:3000
# Prod:   https://business-suite-abc.vercel.app
FRONTEND_URL=http://localhost:3000
# Cookie domain. For localhost use "localhost". For production use ".yourdomain.com" (leading dot matches subdomains)
COOKIE_DOMAIN=localhost

# ── Rate Limiting ──────────────────────────────────────────
# 15 minute window, 100 requests per IP for standard endpoints (auth endpoints are stricter internally)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# ── Optional: SMTP for forgot-password emails ─────────────
# Skip these entirely if you don't want password reset emails (the API endpoints
# will still exist, they'll just return success without actually sending mail).
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your.app.email@gmail.com
# SMTP_PASSWORD=app_password_not_your_gmail_password
```

### `frontend/.env.local` (never commit this)
```
# ──────────────────────────────────────────────────────────
# Frontend — Business Suite
# Copy this to frontend/.env.local
# ONLY variables prefixed with NEXT_PUBLIC_ are sent to the browser.
# NEVER put secrets here.
# ──────────────────────────────────────────────────────────

# Base URL of the backend API INCLUDING /api/v1 prefix. NO TRAILING SLASH.
# Local dev: http://localhost:5000/api/v1
# Production: https://business-suite-api-xyz.onrender.com/api/v1
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1

# Displayed in header, login page, title tags
NEXT_PUBLIC_APP_NAME=Business Suite
```

**Environment Variable Safety Rules (memorize these)**:
1. `.env` files are listed in `.gitignore`. NEVER `git add .env`.
2. On Vercel/Render, you set env vars in their web UI, not via a file.
3. `NEXT_PUBLIC_*` vars go to the BROWSER JS BUNDLE. Any user can open DevTools → Application → see them. So NEVER put JWT secrets, DB URL, or API keys in NEXT_PUBLIC_ vars.
4. Backend env vars: `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are the most critical. If these leak, attackers can forge valid tokens. Rotate them immediately if exposed.

---

## 20. DATABASE ENTITY RELATIONSHIP DIAGRAM (TEXT)

```
                    ┌──────────────┐
                    │   users      │
                    │──────────────│
          ┌────────►│ id (PK, UUID)│◄───────────────────────────────┐
          │         │ email UNIQUE │                                │
          │         │ passwordHash │                                │
          │         │ firstName    │                                │
          │         │ lastName     │                                │
          │         │ roleId (FK)  │──┐                             │
          │         │ status       │  │                             │
          │         └──────────────┘  │                             │
          │                           │  Many-to-one                 │
          │                           ▼                             │
          │              ┌──────────────────┐                       │
          │              │      roles       │                       │
          │              │──────────────────│                       │
          │              │ id               │                       │
          │              │ name (UNIQUE)    │                       │
          │              │ isSystem         │                       │
          │              │ description      │                       │
          │              └──────────────────┘                       │
          │                        │                                 │
          │                        │ M2M via role_permissions       │
          │                        ▼                                 │
          │              ┌──────────────────┐                       │
          │              │   permissions    │                       │
          │              │──────────────────│                       │
          │              │ id               │                       │
          │              │ code (UNIQUE)    │ e.g. products.read    │
          │              │ module           │                       │
          │              │ action           │                       │
          │              └──────────────────┘                       │
          │                                                         │
          │  (1) refreshes   (1) creates     (1) performs actions   │
          │                                                         │
          ▼                     ▼                                   ▼
┌─────────────────┐  ┌─────────────────┐   ┌────────────────────────────────┐
│ refresh_tokens  │  │   audit_logs    │   │            CRM                 │
│─────────────────│  │─────────────────│   ├────────────────────────────────┤
│ id              │  │ id              │   │ customers                      │
│ userId (FK)     │  │ userId (FK)     │   │  ├── contacts (FK: customerId) │
│ tokenHash       │  │ action          │   │                                │
│ expiresAt       │  │ entityType      │   │ leads                          │
│ revokedAt       │  │ entityId        │   │  └── lead_activities           │
└─────────────────┘  │ beforeData(JSON)│   │      (FK: leadId, userId)     │
                     │ afterData(JSON) │   └────────────────────────────────┘
                     │ ipAddress       │
                     │ userAgent       │   ┌────────────────────────────────┐
                     └─────────────────┘   │          INVENTORY             │
                                           ├────────────────────────────────┤
                                           │ categories                     │
                                           │  └── products (FK: categoryId) │
                                           │      ├── stock (unique P+W)    │
                                           │      └── stock_movements       │
                                           │ warehouses ────────────┘       │
                                           └────────────────────────────────┘

                                           ┌────────────────────────────────┐
                                           │          SALES / POS           │
                                           ├────────────────────────────────┤
                                           │ orders                         │
                                           │  ├── customerId (FK)           │
                                           │  ├── createdBy (FK → users)    │
                                           │  └── order_items (FK: orderId, │
                                           │             productId)         │
                                           │                                │
                                           │ invoices (FK: orderId,         │
                                           │         customerId)            │
                                           │  └── payments (FK: invoiceId,  │
                                           │             receivedBy → users)│
                                           └────────────────────────────────┘

                                           ┌────────────────────────────────┐
                                           │             HRM                │
                                           ├────────────────────────────────┤
                                           │ departments ──┐                │
                                           │ designations  │                │
                                           │               ▼                │
                                           │ employees (FK: deptId,        │
                                           │             designationId,     │
                                           │             managerId→self)    │
                                           │  ├── attendance (FK: empId)    │
                                           │  │   UNIQUE(employeeId, date)  │
                                           │  └── leave_requests            │
                                           │      (FK: empId, leaveTypeId,  │
                                           │            approvedById→users) │
                                           └────────────────────────────────┘
```

**28 tables total**:

**Auth/Admin (6)**: users, roles, permissions, role_permissions, refresh_tokens, audit_logs

**CRM (4)**: customers, contacts, leads, lead_activities

**Inventory (5)**: categories, products, warehouses, stock (composite PK: productId + warehouseId), stock_movements

**Sales/POS (4)**: orders, order_items, invoices, payments

**HRM (6)**: departments, designations, employees, attendance, leave_types, leave_requests

**System (1)**: _prisma_migrations (auto-generated by Prisma)

---

## 21. API ENDPOINT CHEAT SHEET

All endpoints prefixed with: **`/api/v1`**

### Auth
| Method | Path | Perm | Purpose |
|--------|------|------|---------|
| POST | `/auth/login` | Public | Body: { email, password }. Returns accessToken. Sets refreshToken cookie. |
| POST | `/auth/refresh` | Public (cookie) | Uses refreshToken cookie → new accessToken + rotates refresh cookie |
| POST | `/auth/logout` | Auth | Revokes refresh token DB record. Clears cookie. |
| GET | `/auth/me` | Auth | Returns current user, role, permissions[] |
| POST | `/auth/forgot-password` | Public | Body: { email }. Sends reset link (if SMTP configured) |
| POST | `/auth/reset-password` | Public | Body: { token, newPassword } |

### Users / Administration
| Method | Path | Perm | Purpose |
|--------|------|------|---------|
| GET | `/users` | users.read | List w/ pagination |
| POST | `/users` | users.create | Create user (password hashed server-side) |
| GET | `/users/:id` | users.read | User details |
| PATCH | `/users/:id` | users.update | Update user |
| PATCH | `/users/:id/deactivate` | users.delete | Soft-deactivate |
| GET | `/roles` | roles.read | All roles with permissions[] |
| POST | `/roles` | roles.create | |
| PATCH | `/roles/:id` | roles.update | Update role + permission assignments |
| GET | `/permissions` | roles.read | Flat list of all permissions |
| GET | `/audit-logs` | audit.read | Filterable audit log list |

### CRM
| Method | Path | Perm | Purpose |
|--------|------|------|---------|
| GET/POST | `/customers` | customers.read/create | List (w/ search+filters) / Create |
| GET/PATCH/DELETE | `/customers/:id` | customers.* | Detail / Update / Deactivate |
| GET/POST | `/customers/:id/contacts` | customers.* | Contacts for a customer |
| GET/POST | `/leads` | leads.read/create | Lead list (pipeline + table) / Create |
| PATCH | `/leads/:id` | leads.update | Update lead status/assignment |
| GET | `/leads/:id` | leads.read | Lead detail w/ activities |
| POST | `/leads/:id/activities` | leads.update | Add activity to lead |

### Inventory
| Method | Path | Perm | Purpose |
|--------|------|------|---------|
| GET/POST | `/categories` | categories.* | List (can be unpaginated — usually < 100) / Create |
| PATCH/DELETE | `/categories/:id` | categories.update/delete | |
| GET/POST | `/products` | products.read/create | Server-side: search, category filter, sort, pagination |
| GET/PATCH/DELETE | `/products/:id` | products.* | Includes stock by warehouse + movements |
| GET/POST | `/warehouses` | warehouses.* | |
| GET | `/stock` | inventory.read | Stock overview (product × warehouse) |
| GET | `/stock/low` | inventory.read | Low-stock only (qty < min) |
| GET | `/stock/movements` | inventory.read | Paginated movement history + filters |
| POST | `/stock/adjustments` | inventory.update | Body: { productId, warehouseId, qtyDelta, reason, type } → transactional adjust |

### Sales / POS
| Method | Path | Perm | Purpose |
|--------|------|------|---------|
| POST | `/orders` | orders.create | **POS Checkout** Body: { items[], customerId?, warehouseId, payment: { method, amount? } }. Atomic tx: order+items+invoice+payment−stock+movements. |
| GET | `/orders` | orders.read | Orders list: filters dateRange/status/customer/paymentStatus, server paginated |
| GET | `/orders/:id` | orders.read | Order detail: items, invoice, payments, linked movements |
| POST | `/orders/:id/cancel` | orders.cancel | Transactional reverse: stock restored, movements RETURN, invoice voided |
| GET | `/invoices/:id` | sales.read | Invoice detail (printable view) |
| POST | `/payments` | payments.create | Record a payment against an invoice |
| GET | `/sales/summary?period=month` | dashboard.read | Aggregate: total, count, AOV by date bucket |

### HRM
| Method | Path | Perm | Purpose |
|--------|------|------|---------|
| GET/POST | `/departments` | hrm.read / hrm.update | |
| GET/POST | `/designations` | hrm.read / hrm.update | |
| GET/POST | `/employees` | hrm.* | Employee list + pagination / Create |
| GET/PATCH | `/employees/:id` | hrm.* | Employee profile |
| GET | `/attendance` | attendance.read | List w/ employeeId + dateRange filters |
| POST | `/attendance/check-in` | attendance.write | Body: { employeeId } → today's attendance row, checkInAt set |
| POST | `/attendance/check-out` | attendance.write | Body: { employeeId } → checkOutAt set |
| GET | `/leave-requests` | leave.read | Filter by employee / status / dateRange |
| POST | `/leave-requests` | leave.create | Submit leave request (self-service — employeeId = current user's linked employee) |
| POST | `/leave-requests/:id/approve` | leave.approve | Sets status APPROVED + populates attendance rows with LEAVE status |
| POST | `/leave-requests/:id/reject` | leave.approve | Sets status REJECTED, requires reason |

### Dashboard
| Method | Path | Perm | Purpose |
|--------|------|------|---------|
| GET | `/dashboard/summary` | dashboard.read | KPI tile numbers (today/monthly sales, order counts, etc.) |
| GET | `/dashboard/sales-trend?period=week` | dashboard.read | Array {date, total, orders} for chart |
| GET | `/dashboard/top-products?limit=10` | dashboard.read | Top N by revenue |
| GET | `/dashboard/lead-pipeline` | dashboard.read | Per-status counts + aggregate value |
| GET | `/dashboard/attendance-summary?date=today` | dashboard.read | { PRESENT: n, LATE: n, ... } |
| GET | `/dashboard/recent-orders?limit=10` | dashboard.read | |
| GET | `/dashboard/recent-activities?limit=15` | dashboard.read | |
| GET | `/health` | Public | { status: ok, timestamp } |

---

## 22. LEARNING NOTES & KEY DECISIONS

> Updated after every phase. Think of this as your "engineering journal".

### Project-Wide Decisions (made before Phase 0)
1. **Architecture Choice: Next.js frontend + separate Express backend + PostgreSQL.** Why not Next.js Route Handlers for everything? Because the specification explicitly separates the layers to teach REST API design, Express middleware pipeline, and deployment topology. Learning > DX speed.
2. **No Monorepo Tooling (Turborepo/Nx):** Keep it simple. Two separate package.json files in two folders. Build commands run independently. This avoids learning curve when starting fresh.
3. **Prisma over raw SQL or Knex:** Prisma gives migration system + type-safe queries + Studio GUI. We still learn SQL explicitly (raw `$queryRaw` for dashboard aggregates, EXPLAIN ANALYZE in Phase 10).
4. **bcryptjs over Argon2:** Argon2 is technically superior but requires native compilation. bcryptjs is pure JS, zero native issues on Windows. The security difference is negligible for a portfolio project. Cost factor 12 is adequate.
5. **Refresh Token = Random String (not JWT):** JWT access tokens are stateless and fine for short TTL. Refresh tokens MUST be revocable. We store them in the database so we can revoke with one UPDATE. If we used JWT as refresh token, revocation would require a blocklist DB anyway — so why sign it? Random 64-byte string, hashed with SHA-256 in DB (so DB leak doesn't allow impersonation).
6. **No CSRF Token (for now):** CSRF attacks only work with cookie-based auth AND simple forms. Since we use `SameSite=Lax` + the auth-protected POST endpoints use JSON `Content-Type: application/json`, simple form CSRF is blocked by browser's SameSite policy AND by the CORS preflight requirement (custom content types trigger OPTIONS preflight which enforces CORS). If we add same-site forms or switch to `SameSite=None`, we'd add CSRF tokens then.
7. **UUIDs as PKs over Auto-Increment Integers:** UUIDs prevent ID enumeration (attacker can't guess /users/1, /users/2) and allow ID generation client-side without a DB round-trip. Performance cost: slightly larger index size. Acceptable.

### Phase-Specific Lessons (filled in during build)

#### Phase 0 (Skeleton) — Lessons Learned
_(will be filled in)_

#### Phase 1 (Shells) — Lessons Learned
_(will be filled in)_

#### Phase 2 (Auth) — Lessons Learned
_(will be filled in)_

---

## 23. INTERVIEW PREP — ANSWERS TO LIKELY QUESTIONS

> **Rule**: These are talking points. Memorize the CONCEPTS, not the words. Your interviewer will know if you're reciting a script.

---

**Q: "Why did you build this project?"**
> I wanted to get hands-on experience with enterprise-style full-stack development, specifically the kind of app a real B2B company would use internally. I chose a business suite (ERP/POS/CRM/HRM) because it forces you to handle non-trivial concerns: authentication with real token security, role-based access control, database transactions for money operations, server-side pagination with real datasets, and performance tuning with indexes and raw SQL aggregates. I built it specifically to go beyond the typical "todo + blog" tutorial projects so I'd have meaningful conversation material in interviews.

---

**Q: "Next.js can do backend API routes. Why a separate Express server?"**
> Two reasons. First, **learning**: The point of this project was to understand REST API architecture end-to-end — Express middleware pipeline, typed error classes, centralized error handling, request lifecycle, route modularity. Doing it in a separate Express server makes those layers explicit instead of abstracted behind Next.js Route Handler files. Second, **deployment separation**: in real enterprises, the frontend team and backend team often deploy and scale independently. Putting the API in its own service lets me deploy it to Render/ECS while Next.js goes to Vercel — a realistic topology.

---

**Q: "Explain your authentication flow."**
> When a user logs in with email and password, I hash the password with bcrypt (cost factor 12) and compare to the stored hash. If valid, I generate two things:
>
> 1. **Short-lived access token JWT (15 min TTL)** — sent in the JSON response body. The frontend stores this in Redux/RTK Query memory (NOT localStorage), so it's lost on page close or hard refresh.
> 2. **Long-lived refresh token (7 days)** — this is a random 64-byte string, NOT a JWT. I store only a SHA-256 hash of it in the database, then send the plaintext value back to the browser via an HTTP-only cookie (Secure in prod, SameSite=Lax, Path scoped to `/api/v1/auth/refresh`). Browser JavaScript cannot read this cookie.
>
> When the frontend makes any protected API call, it sends the access token in the Authorization header. If that token has expired, the API returns a 401. The RTK Query baseQuery automatically catches that 401, silently calls `/auth/refresh` (the cookie is auto-attached by the browser), gets a new access token + a *rotated* refresh token (the old one is marked revoked in DB to prevent replay), then retries the original request exactly once. If refresh fails, the user is redirected to login.
>
> On logout, the server revokes the refresh token row and clears the cookie.

---

**Q: "Why HTTP-only cookies for the refresh token? Why not store it in localStorage too?"**
> If I stored the refresh token in `localStorage`, any XSS vulnerability on the site (a compromised npm package, an unsanitized textarea, etc.) would let the attacker script `localStorage.getItem('refreshToken')` and steal it to impersonate the user forever (or 7 days). With HTTP-only cookies, the browser automatically attaches the cookie to requests to the right origin, but JavaScript on the page CANNOT read the cookie value. The attacker can still abuse the user's session with XSS by making fetch calls in the background, but they can't exfiltrate the token and use it from their own machine forever. Token rotation every refresh further limits damage: if a stolen cookie is used to refresh, the user's next refresh attempt fails and they get logged out, detecting the breach.

---

**Q: "What's the difference between Redux and RTK Query? Why both?"**
> They manage two different kinds of state:
>
> - **RTK Query** owns **server state**: all data from the API — products, customers, orders, KPIs. RTK Query handles caching, deduplication of in-flight requests, cache invalidation (after a POST, it automatically re-fetches the list), pagination state sync, auto-refetch on focus, etc. This is 90% of state in an enterprise app.
> - **Redux Toolkit slices** own **client-side UI state**: stuff the API doesn't care about — is the sidebar collapsed, what's in the POS cart before checkout, the current user's session (we store the user object returned from /me here because it's our app identity, not strictly API data).
>
> A very common anti-pattern I explicitly avoided is "fetching data via RTK Query then duplicating it into a Redux slice" — that defeats the entire purpose of RTK Query's cache. I never do that.

---

**Q: "Describe the POS checkout transaction. What happens, and what makes it atomic?"**
> Checkout is a **single Prisma transaction** — if any step fails, the entire transaction rolls back and no rows are written. The steps are:
>
> 1. For each cart item, run `SELECT ... FROM stock WHERE productId=? AND warehouseId=? FOR UPDATE`. The `FOR UPDATE` takes an **exclusive row-level lock** on each stock row. This means if another concurrent checkout hits the same product at the exact same millisecond, it blocks and waits for my transaction to commit or rollback — this is what prevents overselling (negative stock).
> 2. Check `available = quantity - reservedQuantity >= order_qty`. If any item fails, throw `BusinessRuleError` → rollback.
> 3. INSERT the Order row + all OrderItems. IMPORTANT: I use sellingPrice from the **database's product row**, not whatever the client sent. The client can tamper with the price in memory; DB is source of truth.
> 4. INSERT Invoice linked to the order.
> 5. If payment was taken at checkout, INSERT Payment.
> 6. For each cart item: UPDATE stock SET quantity = quantity - qty_sold AND INSERT a StockMovement row with type=SALE linking to the order.
>
> Only if ALL of those succeed does Prisma commit the transaction. Otherwise it's as if nothing happened. I wrote tests using `Promise.all` of 3 concurrent purchases for stock=5, qty=2 each — exactly 2 succeed, 1 fails with "Insufficient stock". This is a hard regression test; I run it every time I touch the checkout code.

---

**Q: "Why Prisma? How is it different from raw SQL?"**
> Prisma is a type-safe ORM for TypeScript. The schema.prisma file is the single source of truth for tables and relationships. I run `prisma migrate dev` which generates and runs SQL migration files, and `prisma generate` which creates a fully-typed query client.
>
> Benefits:
> - **Zero SQL injection** (for query builder calls) — all params are parameterized.
> - **Auto-completion & type-safety**: `prisma.product.findMany({ where: { sku: 'X' }})` — VS Code knows every field and type.
> - **Readable joins**: `include: { category: true, stock: { include: { warehouse: true } } }` beats writing manual LEFT JOIN SQL and manually stitching nested results.
> - **Migrations system**: schema → SQL diff → named migration file. Easy to track schema history in git and deploy via `prisma migrate deploy`.
>
> What Prisma is NOT good at: complex aggregation queries with subselects, window functions, or CTEs. That's why for the **dashboard KPIs and sales-trend aggregates**, I use `prisma.$queryRaw` with parameterized raw SQL. Prisma doesn't hide SQL from me; I use the right tool for each job.

---

**Q: "How do you make sure a user can't access an admin-only endpoint by typing the URL?"**
> Two layers of protection. The **frontend layer** (UX only, not security) has a `<PermissionGate permission="users.delete">` wrapper that hides navigation items and buttons. I also redirect unauthorized dashboard routes. But I fully acknowledge — this is just UX. Anyone can forge a request in Postman with a valid token.
>
> The **real security is on the backend**. Every protected route goes through two Express middlewares in order:
> 1. `authenticate()` — extracts the access token from the Authorization header, verifies the signature and expiry, loads the user along with their flattened permission codes (from role → role_permissions → permissions). Attaches to `req.user` and `req.permissions`. Returns 401 if anything is wrong.
> 2. `requirePermission('users.delete')` — checks `req.permissions` against the required permission, supporting wildcard matching (admin role has `*.*` which matches anything). Returns 403 Forbidden if missing.
>
> Even if a cashier somehow gets a POST /users call to hit the server (e.g. via curl with their valid auth token), it returns 403 and the user is never deleted. I have an explicit test for this.

---

**Q: "What's server-side pagination? Why not paginate on the client?"**
> Server-side pagination means the API only returns ONE page of data (e.g. 25 rows) plus metadata (totalItems=2481, totalPages=100, hasNext=true). The query params are `?page=2&pageSize=25&sortBy=name&sortOrder=asc&search=xyz`. The client renders only the 25 rows it received.
>
> Client-side pagination would be `GET /products` → return all 2,481 products as a massive JSON array → slice it client-side. That works for 100 rows. For 10,000+ rows:
> - Initial page load is slow (huge JSON download),
> - Memory footprint is huge,
> - Database does unnecessary work fetching 9,975 rows the user will never see on page 1,
> - User on a slow mobile network gets a terrible experience.
>
> All of my list APIs (customers, products, orders, employees, audit logs) are server-side paginated. TanStack Table is configured in "manual mode" so it reads the pagination meta from the API response and doesn't try to slice data client-side.
>
> If we ever needed to render 10,000 rows at once (like a spreadsheet view), I'd combine server pagination with TanStack Virtual for DOM virtualization (render only visible rows, scroll buffer of ~20).

---

**Q: "How did you approach performance optimization?"**
> I avoided premature optimization. First I made it work correctly, then I measured and optimized only what was actually slow.
>
> Measured improvements:
> 1. **N+1 query fixes**: Enabled Prisma query logging (`log: ['query']`) and navigated every list page. When I saw the classic N+1 pattern (1 query for 25 products, then 25 queries for categories), I added `include: { category: true }` to batch the join.
> 2. **Added DB indexes**: Ran `EXPLAIN ANALYZE` on the top 5 slowest queries from the log. If the plan showed Seq Scan with high cost, I added a B-tree index on the filtered/joined column. For example, `CREATE INDEX idx_orders_customer_date ON orders(customerId, orderDate DESC);` turned a 120ms customer order history query into 8ms.
> 3. **Prisma select**: List endpoints use explicit `select: { ... }` to fetch only the columns the table needs. No point fetching `description TEXT` when the list shows only sku, name, price, and status.
> 4. **Bundle splitting on the frontend**: ECharts is 700KB+ gzipped even in 2026. I lazy-load it with `next/dynamic({ ssr: false })` and a Suspense boundary. The dashboard route loads ECharts only when the user navigates there — the login page bundle is clean and small.
> 5. **Debounced search** on all table search inputs (300ms delay). Prevents firing a request for every keystroke.

---

**Q: "Tell me about a bug you had in this project and how you fixed it."**
> (Pick whichever actually happened — example below. Be honest; interviewers love real stories.)
>
> "Early on, I had a concurrency bug in checkout. I was checking stock availability then updating it in two separate Prisma calls, without a transaction or row locking. During manual testing I accidentally double-clicked the checkout button. The UI disabled the button on click, but I was on a dev machine with React strict mode which double-invokes effects, so two requests fired. What happened: Request 1 reads qty=5, passes. Request 2 reads qty=5 (before request 1's UPDATE), passes. Both UPDATEs subtract 2. Final stock = 5 − 2 − 2 = 1? No wait, no — with two separate transactions each doing read → write → commit, I actually got lost update: qty=3 instead of 1. Worse, with stock=1 and two buyers it went to -1.
>
> **Fix**: I wrapped everything in a Prisma `$transaction` AND changed the stock check to use `SELECT ... FOR UPDATE` (Prisma supports this via the `for: 'update'` clause on `findUniqueOrThrow` inside a transaction). Now the first transaction locks the stock row, the second transaction blocks on the SELECT until the first commits, then it re-reads the updated value and correctly fails with 'Insufficient stock'. I also added a PostgreSQL CHECK constraint on `stock.quantity >= 0` as a defense-in-depth last line — even if my code has a bug, Postgres refuses to write negative stock. Then I wrote that concurrent Promise.all regression test so this can never come back."

---

---

> **END OF BUILD_PROCESS.md**
>
> This file is a LIVING DOCUMENT. After each phase is complete, I (the AI builder) will update:
> - The STATUS labels (⏳ PENDING → ✅ DONE) next to each phase
> - The "Lessons Learned" entries under Section 22 with real takeaways from that phase's implementation
> - Any architectural deviations and why they were made
> - The folder tree if new files are added outside the original plan
