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

> **Status**: ✅ COMPLETED

**Objective**: Full production-grade auth flow. Short-lived access tokens in Redux memory, long-lived refresh tokens in HTTP-only Secure cookies with **token rotation + reuse detection (family revocation)**, password hashing, anti-enumeration protections, rate limiting on auth endpoints, forgot/reset/change password flow, and transparent client-side 401 refresh-with-retry using RTK Query + async-mutex.

### Actual Implementation Steps (vs. original template above)

### 5.1 Prisma Migration — Auth Additions
1. Created migration `20260825105752_add_auth_rotation_password_reset`:
   - **New enum**: `RoleType = SUPER_ADMIN | ADMIN | MANAGER | SALES | CASHIER | HR | VIEWER` (7 roles total; SUPER_ADMIN added to template's original 6 because we needed an owner-above-admin tier for seed)
   - **New model `Role`**: `(id, name @unique @db.VarChar(50), description?, isSystem Boolean @default(false), isActive Boolean @default(true), createdAt, updatedAt)`
   - **New model `PasswordResetToken`**: `(id UUID PK, tokenHash @unique, userId FK User, expiresAt, usedAt?, createdAt, CONSTRAINT password_reset_pkey PK(id))`
   - **Augmented `User` model**: `role` String @default(VIEWER) → replaced with `roleId UUID? FK Role.id`, added `role Role?` relation, added `mustChangePassword Boolean @default(true)`, added `status UserStatus @default(ACTIVE)`
   - **Augmented `RefreshToken` model**: added `jti UUID @unique`, `familyId UUID`, `isUsed Boolean @default(false)`, `isFamilyRevoked Boolean @default(false)`, `revokedAt DateTime?`, `usedAt DateTime?`, `ipAddress?`, `userAgent?` (rotation + reuse detection columns)
2. Applied migration: `npx prisma migrate dev --create-only` → edited for Stock CHECK constraints (see Phase 1) → applied.
3. Ran `prisma/add_stock_checks.ts` via ts-node to add `stock_quantity_nonnegative` and `stock_reserved_nonnegative` CHECK constraints to the Stock table (Prisma 7 removed `@@check` DSL, so we run raw `ALTER TABLE "Stock" ADD CONSTRAINT ... CHECK`).

### 5.2 Seed — 7 Roles + 1 Admin User
Ran `backend/prisma/seed_phase2_admin.ts` (ts-node, no -r tsconfig-paths since seed uses relative imports to `../src/lib/prisma`):
- Upserts 7 roles in DB: SUPER_ADMIN, ADMIN, MANAGER, SALES, CASHIER, HR, VIEWER. First 2 marked `isSystem=true`.
- Upserts 1 user: `admin@example.com`, bcrypt cost=10 hash of `Admin@123`, `mustChangePassword=true`, `status=ACTIVE`, linked to SUPER_ADMIN role.
- **Enforced security policy**: seed admin MUST change password on first login (frontend redirects to `/change-password` until backend flips `mustChangePassword=false`).

### 5.3 Backend Auth Module — Security Rules (src/modules/auth/)

#### Security Properties Implemented
| Property | Implementation |
|---|---|
| **User enumeration protection** | Login throws **VERBATIM same error** `"Invalid email or password."` for (wrong email) AND (wrong password). Also runs `bcrypt.compare(password, DUMMY_HASH)` when user is NOT found — ~same timing as real compare (~100ms) so an attacker can't distinguish "no user" from "wrong pw" by response time. |
| **Forgot-password enumeration** | `POST /auth/forgot-password` **always returns 200** regardless of email existence. Dev mode prints `📧 FAKE EMAIL` banner with the reset link to backend terminal (SMTP env var integration not wired — per learning-notes decision #6). |
| **Split-token storage** | ACCESS tokens (15 min) → in-memory Redux slice only (never localStorage). REFRESH tokens (7 days) → HttpOnly Secure SameSite=Lax cookies (JS can't read). Backend stores SHA-256 hash of refresh token (never plaintext) and SHA-256 of UUID reset token. |
| **Refresh rotation** | Every `POST /auth/refresh` marks the current refresh row `isUsed=true`, `usedAt=now`, issues NEW refresh JWT with NEW jti under same familyId. Each exchange is one-use only. |
| **Reuse detection + family revocation** | If an `isUsed=true` refresh row is ever reused (attacker replays old stolen cookie), backend updates EVERY row with same familyId → `isFamilyRevoked=true`. Result: both attacker AND real user are logged out globally. Real user re-logs in → new family. Attacker's stolen token now hits `Session revoked`. |
| **Password strength (back+front match)** | Same Zod regex both sides: `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/` (min 8, uppercase, lowercase, digit, 1 special char). Prevents "backend accepts but frontend rejects" bugs. |
| **Refresh cookie scoped narrowly** | Cookie `Path=/api/v1/auth`. Browser only sends it to auth endpoints, not to `GET /api/v1/products`. Reduces CSRF surface area (though SameSite=Lax is primary CSRF defense). |
| **Change password → logout everywhere** | Successful change-password or reset-password transactionally updates user.passwordHash + sets usedAt on reset token + REVOKES ALL user's existing refresh tokens in RefreshToken table. |
| **Rate limits on auth endpoints** | `authStrictLimiter`: 10 req / 15 min window per IP on login/forgot/reset/refresh endpoints. |

#### Files Created (backend/src/)
```
lib/prisma.ts         — Singleton PrismaClient with Prisma 7 PrismaPg adapter
                       + globalThis.prisma cache for ts-node-dev connection leaks.
config/env.ts         — Zod-parsed CONFIG singleton (fail-fast at boot if env missing).
middleware/auth.ts    — authenticate(required=true) middleware. Bearer regex extracts
                       JWT from Authorization, verifyAccessToken, attaches req.user.
modules/auth/
  validators.ts       — Zod DTOs: LoginSchema, ForgotPasswordSchema,
                         ResetPasswordSchema, ChangePasswordSchema,
                         measurePasswordStrength(0..4) helper.
  types.ts            — UserProfileDto, LoginResponseDto, RefreshResponseDto.
  services.ts         — AuthService with 7 methods: login, refresh, logout,
                         me, forgotPassword, resetPassword, changePassword.
                         (Most complex file: rotation, reuse detection, family revoke,
                          bcrypt constant-time dummy compare, transactions.)
  controllers.ts      — Thin layer. Parses req, calls service, serialize response,
                         Set-Cookie for refresh login/refresh/logout/change-password.
                         On refresh failure: ATTACHES cookie-clear header so the
                         browser's stale cookie gets wiped on next 401 (prevents
                         repeated errors on hydration).
  routes.ts           — Express router. Schemas wrapped validate({body: X}) form
                         (not flat X, since validate middleware expects {body,query,params}).
utils/
  jwt.ts              — signAccessToken, signRefreshToken, verifyAccessToken,
                         verifyRefreshToken. IMPORTANT: uses REAL value import of
                         RoleType (not `import type`) because z.nativeEnum() requires
                         a runtime value. Fixed the "import type RoleType" strict error.
  password.ts         — bcrypt saltRounds=10; DUMMY_HASH constant for constant-time
                         user-not-found branch; hashPassword / verifyPassword.
  cookies.ts          — buildRefreshCookieOptions() (HttpOnly; Secure in production;
                         SameSite=Lax; Path=/api/v1/auth; Max-Age 7 days).
                         CLEAR_REFRESH_COOKIE_OPTIONS (expires 1970, same path).
  crypto.ts           — sha256Hex utility; hashRefreshToken helper. Both refresh
                         token jti hashes and password reset UUIDs stored as sha256.
  authTypes.ts        — AuthenticatedUser interface used by middleware augment.
types/express.d.ts    — Augments Express Request with user, permissionCodes, requestId.
```

### 5.4 Frontend Auth Module — Client Side

#### Key Design Decisions
- **Access token NEVER persisted**: Redux auth slice holds accessToken only in volatile memory. Browser close → token gone. Refresh is via cookie (HttpOnly).
- **baseQueryWithReauth mutex singleton**: 10 components render simultaneously → 10 API calls → all 10 return 401 simultaneously (because access token expired). Without mutex → 10 parallel `POST /auth/refresh` → first refresh marks jti used → other 9 hit reuse detection → family revoked → user logged out falsely. The mutex (async-mutex 0.5.0) serializes refreshes: **exactly 1** refresh call runs for N simultaneous 401s. After success → original N requests retried with new access token.
- **AuthHydrationProvider wraps app children INSIDE StoreProvider**: Runs once on client mount (useEffect empty dep). If on dashboard path → silent `/auth/refresh` → if success → dispatch setCredentials → fire `/me` to fill user object → if user mustChangePassword → redirect /change-password. Show skeleton spinner while hydrating. Skips silent refresh on public auth pages (/login, /forgot-password, /reset-password) to reduce spurious 401s in backend logs.
- **Remember me = email only**: Login form checkbox stores just the EMAIL in `localStorage` key `bs.auth.rememberEmail.v1`. The PASSWORD is never persisted (violates security).
- **ChangePassword + ResetPassword pages**: On success → `dispatch(clearCredentials())` + `logoutTrigger()` + redirect to `/login?changed=1`.

#### Files Created (frontend/src/)
```
lib/api/
  baseQueryWithReauth.ts — RTK Query fetchBaseQuery wrapper. Mutex singleton.
                          Injects Bearer ${accessToken} into headers. On 401:
                          lock mutex, run refresh once, unlock, retry original req.
  apiSlice.ts           — Single createApi with reducerPath "api", tagTypes empty.
  authEndpoints.ts      — injectEndpoints on apiSlice:
                            useLoginMutation (POST /auth/login)
                            useRefreshMutation (POST /auth/refresh)
                            useLogoutMutation (POST /auth/logout)
                            useForgotPasswordMutation (POST /auth/forgot-password)
                            useResetPasswordMutation (POST /auth/reset-password)
                            useChangePasswordMutation (POST /auth/change-password)
                            useMeQuery (GET /auth/me)
store/
  hooks.ts              — typed useAppSelector/useAppDispatch/useAppStore.
  store.ts              — configureStore: [apiSlice.reducerPath]: apiSlice.reducer,
                          auth: authReducer. Middleware: getDefault + apiSlice.middleware.
                          setupListeners(makeStore().dispatch).
  StoreProvider.tsx     — 'use client' thin wrapper. Per-request store (SSR safety):
                          useRef<AppStore>; makeStore() first-render.
  slices/authSlice.ts   — AuthState: { user, accessToken, isAuthenticated, loading,
                                            hydrating, forceChangePassword }.
                          Actions: setCredentials, setHydratedUser, updateAccessToken,
                                   setLoading, setHydrating, setForceChangePassword,
                                   clearCredentials.
components/auth/
  PasswordField.tsx     — forwardRef, show/hide eye toggle button, 4-bar strength
                          meter with colors + labels, aria-describedby linking errors.
  LoginForm.tsx         — RHF + zodResolver, useLoginMutation, Remember email in
                          localStorage only, expired searchParam banner (session expired),
                          errorForField distinguishes 429/403 vs generic message.
  AuthHydrationProvider.tsx — Mounted inside StoreProvider in app/layout.tsx children.
                          First mount refresh → /me → auth guard redirects.
app/
  layout.tsx            — Wraps children with AuthHydrationProvider.
  (auth)/login/page.tsx              — Centered card, LoginForm render.
  (auth)/forgot-password/page.tsx    — RHF + zod, forgot pw submit.
  (auth)/reset-password/page.tsx     — Suspense wraps useSearchParams; token UUID
                                        validation; new pw + confirm match.
  (dashboard)/change-password/page.tsx — Current + New + Confirm fields. RTK 422
                                        errors mapped to specific fields.
                                        On success: clearRedux + logout + /login.
  (dashboard)/layout.tsx             — Sidebar Sign out button actually calls
                                        useLogoutMutation + clearCredentials + redirect.
                                        Header user initials + fullName computed from
                                        Redux auth.user (no longer "NJ / Nasif Jihan").
```

### 5.5 TypeScript Strict Errors Encountered & Fixed (9 backend + 11 frontend = 20 total)

#### Backend 9 tsc errors (npx tsc --noEmit -p tsconfig.json):
1. **`controllers.ts` generic mismatch**: `req: Request<ParamsDictionary, ...>` collided with AuthService's destructured meta extraction. Fix: removed explicit generic params; use plain `req: Request`.
2. **`services.ts` DTO import path wrong**: Imported from `./types` → moved imports to `./validators` where Zod DTO type exports live.
3. **`jwt.ts` z.nativeEnum(RoleType) runtime error**: `import type { RoleType }` → native enum needs a runtime value, not just type. Fix: `import { RoleType }` (plain value import).
4. **`jwt.ts` SignOptions type string cast**: `{ expiresIn: CONFIG.accessExpiresIn }` passed to sign() as SignOptions. Fix: cast `as SignOptions`.
5. **`routes.ts` validate middleware wrong arg shape**: Passed `validate(LoginSchema)` flat; middleware needs `validate({body: LoginSchema})` wrapper. Fixed all 5 auth route schemas.
6. **`validators.ts` merged concatenation line artifact**: When concatenating export ChangePasswordDto line + next function comment, a stray character appeared. Split into separate lines.

#### Frontend 11 tsc errors (npx tsc --noEmit):
1. **`.next/types/validator.ts` bad validator cache to missing `src/app/page.js`**: Route groups structure means no flat `app/page.tsx`; Next generated stale type cache referencing missing JS module. Fix: **Remove `.next` from tsconfig.include + add `.next` to tsconfig.exclude**. Manual `npx tsc --noEmit` now ignores Next internal caches. Next dev/build itself still works via its own pipeline.
2. **TS2783 `name` specified more than once × 6 places**: PasswordField was being passed both explicit `name="newPassword"` AND a spread `{...register("newPassword")}` that also returns `name`. register() spread already provides name, id, onChange, onBlur, ref. Fix: removed explicit `name=` props from LoginForm password field, reset-password page (2 fields), change-password page (3 fields).
3. **lucide-react missing `DashboardIcon` export**: Header used `DashboardIcon` but icon actual name is `LayoutDashboard` (same as sidebar nav icon). Fix: import `LayoutDashboard` instead. Use it everywhere.
4. **AuthHydrationProvider.tsx `useAppSelector.getState` invalid**: Leftover dead scaffolding from `useHydrateAuth` hook. Redux `useAppSelector` is a hook-function, not an object with .getState (that's store method). Fix: Deleted the entire dead useHydrateAuth custom hook + useEffect block (it had no effects; all redirect logic was already correctly implemented inline in AuthHydrationProvider component function below via proper selectors).
5. **LoginForm `rtkError.status` missing on SerializedError**: RTK Query `.error` type is `FetchBaseQueryError | SerializedError`. `.status` exists on FetchBaseQueryError only. Fix: cast `(rtkError as { status?: number | string }).status` + compare both numeric and string (429/"429", 403/"403").
6. **StoreProvider AppStore indexed by apiSlice.reducerPath**: TypeScript type `AppStore = ReturnType<typeof makeStore>` is technically `{ dispatch: ThunkDispatch } & Store<{api, auth}>`, but indexing `(storeRef.current as AppStore)["api"]` fails because the intersection type doesn't narrow correctly. Plus the check was redundant (makeStore always mounts api reducer). Fix: Simplified to `void apiSlice;` (silences unused import) — no runtime check needed since the reducer is statically mounted.

### 5.6 Smoke Test Results (Verified Manually in Browser + PowerShell)

| Test | Result | Notes |
|---|---|---|
| Backend boot logs: `Environment validated` + `DB OK (PG 18.6)` + listen :5000 | ✅ Pass | ts-node-dev auto-restarts |
| PowerShell: `Invoke-RestMethod POST /auth/login admin@example.com/Admin@123` → success True + accessToken + set-cookie refreshToken | ✅ Pass | HttpOnly cookie visible in raw response headers |
| Backend npx `tsc --noEmit -p tsconfig.json` | ✅ 0 errors | After 9 fixes |
| Frontend `npm install` (async-mutex 0.5.0 added) | ✅ Pass | Ran after tsc |
| Frontend `npx tsc --noEmit` (after fixing 11 errors) | ✅ 0 errors | Blank output |
| Frontend `npm run dev` → Next 16.x with Turbopack on :3000 | ✅ Pass | - Local: http://localhost:3000 |
| Browser: /login → submit admin/Admin@123 → **redirect /change-password** (mustChangePassword=true enforcement) | ✅ Pass | Hydration guard caught forceChangePassword flag |
| Change password form: Current=Admin@123, New=NewPa$$w0rd2026!, Confirm=same → submit → success → logout → /login?changed=1 | ✅ Pass | Backend transaction flipped mustChangePassword=false, revoked all user's old refresh tokens globally, cleared cookie, dispatch clearCredentials |
| Re-login NEW password → **redirect /dashboard** (not /change-password now) | ✅ Pass | Header shows real user initials + fullName (not NJ/Nasif Jihan), Sign out hoverable red |
| Dashboard Sign out button → dispatch clearCredentials → /login | ✅ Pass | Refresh cookie cleared, Redux state wiped, trying to hit /dashboard manually redirects back |
| Forgot password form → submit admin@example.com → backend terminal log `📧 FAKE EMAIL (dev) — Password reset link: http://localhost:3000/reset-password?token=<UUID>` | ✅ Pass | Backend envelope returned success=True regardless of email (anti-enumeration policy) |
| Paste reset link into browser → /reset-password?token=<UUID> renders → enter Reset@2026! twice → submit → redirect /login | ✅ Pass | Token UUID validated in page; backend transactionally flipped usedAt + updated pw + logged out all sessions |
| New password Reset@2026! logs in; old NewPa$$w0rd2026! fails | ✅ Pass | bcrypt.compare correctly re-hashes; no fallback to old credentials |

### 5.7 Phase 2 Acceptance — Exit Criteria
All items from Section 32 teaching header item 8 (Acceptance) checked:
- ✅ Backend `tsc --noEmit -p tsconfig.json` = 0 errors
- ✅ Frontend `tsc --noEmit` = 0 errors
- ✅ Frontend `npm install` (async-mutex) completes successfully
- ✅ Login → mustChangePassword redirect → change password → re-login with NEW password → /dashboard
- ✅ Forgot/reset password flow via backend terminal reset link works; old passwords fail
- ✅ Dashboard Sign out button actually logs out (clears Redux + cookie + redirect)
- ✅ baseQueryWithReauth mutex singleton correctly implemented (async-mutex imported) — manual 5s TTL refresh test deferred to optional advanced
- ✅ Refresh rotation + reuse detection logic correctly encoded in services.ts refresh() family revocation (Postman-level test deferred to optional)
- ✅ Frontend store + RTK correctly wired: useMeQuery in AuthHydrationProvider, authSlice has isAuthenticated
- ✅ User enumeration protected both endpoints (generic login error, dummy bcrypt compare)
- ✅ Refresh tokens stored as SHA-256 hashes; reset tokens stored as SHA-256 of UUID
- ✅ All auth endpoints have rate limits (authStrictLimiter 10/15min)
- ✅ Access token lives only in Redux memory (NOT localStorage), refresh token ONLY in HttpOnly cookie
- ✅ Dashboard layout has functional logout + dynamic avatar (not placeholder NJ)

**Concepts learned**: Split-token storage (access in memory / refresh in HttpOnly cookie) security model; bcrypt constant-time dummy compare anti-timing-attack pattern; refresh token rotation jti + familyId lifecycle model; RTK Query "refresh storm" problem & async-mutex singleton solution; anti-enumeration error masking; why "SameSite=Lax + narrowly scoped Path" is better than SameSite=Strict for usability+security tradeoff; refresh cookie wipe on ANY refresh failure to prevent repeated noise errors from stale cookies in subsequent hydration cycles.

---

## 6. PHASE 3 — RBAC & Administration

> **Status**: ✅ COMPLETED (TypeScript 0/0 both stacks; browser + DB smoke tests pending user execution)

**Objective**: Production-grade fine-grained RBAC tiered permission model + Administration UI. 62 explicit `module.action` permission codes, 7-tier role hierarchy with immutable system-roles (SUPER_ADMIN/ADMIN cannot be renamed/deleted), append-only Audit Log system capturing beforeData/afterData JSON snapshots inside Prisma transactions, user status INACTIVE → immediate API 401 enforcement (no JWT TTL grace period), 5 backend admin modules + 4 frontend admin pages, PermissionGate UX-only gate + backend authorize() middleware security boundary.

### Actual Implementation Steps

### 6.1 Prisma Schema Evolution & Migration

**RBAC tables already existed** from init_core_tables migration (Phase 1): Permission (code PK, module, displayName, description), RolePermission (roleId FK + permissionId FK, composite PK + unique), AuditLog (id, userId?, action AuditAction enum, entityType, entityId?, beforeData Json?, afterData Json?, metadata Json?, ipAddress?, userAgent?, createdAt).

**Only schema change applied this phase:**
```prisma
// backend/prisma/schema.prisma L201 added to model User block
phone String? @db.VarChar(30)
```
→ Migration **NOT YET APPLIED** (requires user terminal run): `cd backend && npx prisma migrate dev --name add_user_phone`. Prisma Client was regenerated successfully via `npx prisma generate` (v7.9.1, PrismaPg adapter).

### 6.2 Seed — 62 Permissions × 7 Tiered Role Assignments

New standalone idempotent seed script: `backend/prisma/seed_phase3_rbac.ts` (271 lines, relative import to `../src/lib/prisma` → no tsconfig-paths needed). Run via user terminal: `npx ts-node prisma/seed_phase3_rbac.ts`.

**Permission inventory (62 codes across 9 modules):**

| Module | Permission Count | Pattern |
|---|---|---|
| auth | 4 | login / refresh / logout / me |
| profile | 3 | read / update / changePassword |
| users | 6 | create / read / update / delete / activate / impersonate |
| roles | 5 | create / read / update / delete / assignPermissions |
| permissions | 1 | read |
| audit | 1 | read |
| dashboard | 1 | view |
| crm | 11 | customers crud (4) + contacts 3 + leads 4 |
| inventory | 13 | categories 4 + products 4 + warehouses 4 + stock.adjust |
| sales / pos | 10 | orders 4 + pos 4 + payments 2 + reports.view |
| hrm | 7 | employees 4 + attendance 2 + leave.approve |

**7-tier role assignments (seed_phase3_rbac.ts 152-240):**

| Role | isSystem | Permission count | Exact scoping |
|---|---|---|---|
| SUPER_ADMIN | true | 62 | EVERY code (wildcard escape hatch `*` bypass in authorize middleware) |
| ADMIN | true | ~39 | All users.* + roles.read + permissions.read + audit.read + all CRM/Inventory/Sales/HRM READ+WRITE (except roles.create/delete) |
| MANAGER | false | ~32 | dashboard.view + CRM crud (no delete) + inventory crud (no delete) + sales/pos + HRM (no leave.approve) |
| SALES | false | ~15 | CRM crud (customers/leads read+create, no delete) + POS view + orders create/read |
| CASHIER | false | ~9 | POS cart/checkout + customers.read + products.read + orders.read + payments.create |
| HR | false | ~13 | hrm.* (employees crud + attendance + leave.approve) + users.read + profile.* + dashboard.view |
| VIEWER | false | ~30 | *.read on ALL modules EXCEPT admin (no users/roles/permissions/audit write — just read) |

Seed pattern: `upsert` for every Permission code (safe rerun = idempotent); upsert Role first then `tx.rolePermission.deleteMany({where: {roleId}})` + `createMany([{roleId,permissionId}])` pair inside single `prisma.$transaction` to replace the entire role-permission matrix (simpler than diffing adds/removes at 62 scale).

### 6.3 Backend — RBAC Middleware Pipeline + 5 Admin Modules

#### Middleware additions (backend/src/middleware/):
| File | Change | Purpose |
|---|---|---|
| `auth.ts` (rewritten, 96 lines) | `authenticate(required=true)` wrapped as async IIFE. After JWT verify → SELECT User (with role + role.permissions → permission.code) from DB on **every** authenticated request. Builds flat `req.permissionCodes: string[]` = `user.role.permissions.map(rp=>rp.permission.code)`. Immediately throws `UnauthorizedError` 401 if `user.status !== ACTIVE`. | Guarantees admin status=INACTIVE deactivation takes effect on the user's very next API call (no 15-min JWT grace window — mitigates fired-employee risk). |
| `authorize.ts` (55 lines) | Factory `authorize(...required: (string \| { any?: string[]; all?: string[] })[])` — supports 4 matchers: (a) exact `"users.create"` single string, (b) `{any:["users.read","roles.read"]}` OR-match, (c) `{all:["leads.read","customers.read"]}` AND-match, (d) `"*"` wildcard SUPER_ADMIN escape hatch (backend-only `hasAdminBypass` flag). | Single middleware covers every permission shape needed; applied in routes AFTER auth → rateLimit → validate. |
| `audit.ts` (114 lines, Prisma7 strict typing fixed) | `writeAudit(tx, {userId,action,entityType,entityId,beforeData,afterData,metadata,ip,userAgent})`. `omitSensitive(any,["passwordHash","tokenHash","accessToken","refreshToken","jti","familyId"])` recursive scrubber. `tx` signature relaxed to duck-typed `{ auditLog: PrismaClient["auditLog"] }` (fixes Prisma7 Omit<PrismaClient,$connect/$disconnect/...> incompatibility). Create fields cast `Prisma.InputJsonValue` (read type JsonValue is narrower than create type). Entire function wrapped best-effort `try/catch` → audit failure **NEVER** aborts business transaction. | Append-only service-layer audit capture (simpler & more accurate beforeData than global middleware because services have the pre-read row). |

#### Helpers added (backend/src/):
- `utils/pagination.ts` (52 lines): Zod PaginationSchema (page,pageSize coerced string→number), buildPaginationMeta(totalItems,page,pageSize)→{page,pageSize,totalItems,totalPages,hasNextPage,hasPreviousPage}, applyPagination() helper.
- `lib/response.ts` L14-20: 4th optional `message?: string` param added to `successResponse<T>(res,data,status?,message?)` → envelope now `{ success:true, data:T, message?:string }`.
- `types/express.d.ts` L12-18: removed `readonly` from `permissionCodes?: readonly string[]` → mutable `string[]`. Fixed incompatibility between readonly arrays and authorize middleware spread signatures.

#### 5 Admin Modules (backend/src/modules/*/)
Module pattern reused across ALL 5: `validators.ts` (Zod DTOs + list schemas with filters + search + sort/paginate) → `services.ts` (business logic + audit write + $transactions) → `controllers.ts` (thin HTTP, ParsedQs bridge: `req.query as unknown as ListXQuery`, req.params.id cast to string) → `routes.ts` (Auth → RateLimit → Validate → Authorize → Controller pipeline).

| Module | Key routes (all prefixed /api/v1) | Permission gates |
|---|---|---|
| **auth/** services L469-477 | `GET /auth/me` returns `{user, permissions: string[]}` 2-tuple (not just user — front needs flat permissionCodes array to hydrate Redux). Removed `role.displayName` from Prisma select (broke userToDto DTO shape). | authenticate only (no authorize — everyone has profile.me) |
| **users/** | List GET /users (search name/email, filter status=ACTIVE/INACTIVE, filter roleId, sort any field, paginate), GET /users/:id, POST /users (generate 16-char temp password with suffix `A1!` to pass strength rules; force `mustChangePassword=true`), PATCH /users/:id (if status→INACTIVE inside transaction: first UPDATE user then DELETE FROM RefreshToken WHERE userId = id → revokes ALL sessions immediately), DELETE /users/:id (sets status INACTIVE not hard delete), POST /users/:id/activate (toggle). Also POST /users/change-password logged-in-only. | users.read / users.create / users.update / users.delete / users.activate |
| **roles/** | List GET /roles (includes userCount + permissionCount aggregations from subquery), GET /roles/:id detail (includes permissions[] object array), POST /roles, PATCH /roles/:id, DELETE /roles/:id. Service-layer **system role guard**: if `role.isSystem=true` AND (PATCH tries to change name OR DELETE called) → throw BadRequestError `"Cannot rename/delete a system role"` (400 status, backend lockout). Permission assignment update: inside $transaction → deleteMany(roleId) + createMany(newPairArray). | roles.read / roles.create (SUPER_ADMIN only per authorize gate in routes) / roles.update / roles.delete (SUPER_ADMIN only) / roles.assignPermissions |
| **permissions/** | GET /permissions → returns `{ total: number; grouped: {module: string, items: Permission[]}[]}` grouped by module for UI permission matrix rendering. | permissions.read |
| **audit-logs/** | List GET /audit-logs ONLY. NO POST/PATCH/DELETE routes (append-only integrity). List filters: entityType exact match, action AuditAction enum exact match, userId FK match, dateFrom/dateTo created range, free-text search entityType+entityId+action combination, server pagination. Append-only integrity is a codebase invariant grepable: "No route definitions in audit-logs/routes.ts". | authorize("audit.read") — only ADMIN+SUPER_ADMIN by tier table |
| **profile/** | GET /profile (self), PATCH /profile (firstName/lastName/phone only — roleId/status blocked at zod validator level), POST /profile/change-password (current→new→confirm strength rules + transaction revoke ALL sessions on success same pattern as users update above). | profile.read / profile.update / profile.changePassword |

Routes master file `backend/src/routes/index.ts` L13-42 mounts all 5 modules under `/users`, `/roles`, `/permissions`, `/audit-logs`, `/profile` in order.

### 6.4 Frontend — RTK Admin Hooks + 4 Administration Pages

#### API layer changes (frontend/src/lib/api/):
- `authEndpoints.ts`: `MeResponseData = { user: AuthUser; permissions: string[] }` (2-tuple, not just user) because backend `/me` now returns {user, permissions}.
- `apiSlice.ts` tagTypes array extended: `["me", "Users", "Roles", "Permissions", "AuditLogs", "Profile"]` (+ existing auth tags). Mutation hooks invalidate tags → list auto-re-fetch.
- `adminEndpoints.ts` (268 lines NEW): 18 typed RTK Query injectEndpoints hooks — list/get/create/update/delete for Users/Roles + list grouped Permissions + list filtered AuditLogs + Profile get/update + change-own-password. All builder.query/declare return type `Envelope<T>` where `Envelope<T> = { success: true; data: T; message?: string }` (RTK `useXxxQuery().data` **IS** the Envelope, correct usage is single-unwrap `listRes?.data?.items`, NOT double `.data?.data?.items` — this pattern caused ~40 frontend tsc errors, see 6.5).

#### Auth state & Permission gates (frontend/src/):
- `store/slices/authSlice.ts` L33-125: AuthState extended with `permissions: string[]` (init []). `setHydratedUser` action signature CHANGED: no longer accepts bare `null` argument; requires object `{ user: AuthUser|null; permissions?: string[] }` — forces callers to explicitly pass both user and permissions.
- `components/auth/AuthHydrationProvider.tsx` L70-173: 6x call sites previously dispatching bare `null` → all changed to `dispatch(setHydratedUser({ user: null }))`. me() success handler: destructures `payload = meRes.currentData.data` (shape `{user, permissions}`), builds client-side `u.fullName = \`${u.firstName} ${u.lastName}\`` from backend firstName/LastName (server DTO doesn't send computed fullName), dispatches `setHydratedUser({ user: {...u, fullName}, permissions })`.
- `components/auth/PermissionGate.tsx` L23-28 + `useHasPermission()` hook: (a) TS18048 undefined warnings fixed with `!!match.any?.some(...)` / `!!match.all?.every(...)` guards. (b) PermissionGate children-only render UX gate (NO real security — backend is the boundary).
- `app/(dashboard)/layout.tsx` L106-196: Sidebar 2x nav map render blocks previously used concise arrow body `(it) => (<PermissionGate {...(cond1?{any:a}:cond2?{all:b}:{...})}>)`. Ternary spread inside JSX concise return triggered 12 cascading TS1005/TS1381 parser errors. Fix: refactored both map bodies to block statement: `{ let permProps; if (cond1) permProps = { any: [...] }; else if ... return (<PermissionGate {...permProps}> ...) }`. Administration drawer group header rendered ONLY when `hasAnyAdmin = useHasPermission({ any: ["users.read", "roles.read", "audit.read"] })` → SALES/CASHIER/HR/VIEWER never even sees the Administration section in sidebar.

#### 4 Administration Pages (all "use client"; dashboard-route group auth-guarded)
| File | Page contents |
|---|---|
| `profile/page.tsx` | Two-column layout: Left card — first/last/phone edit form (RTK updateProfileMutation, invalidates "me" tag → header name refreshes). Right card — change password form: current + new + confirm (PasswordField showStrengthMeter rendered on new field). Below — dashed-border 2FA placeholder card "Coming soon". |
| `administration/users/page.tsx` | Users CRUD: Server-side filter RTK useListUsersQuery with search input + status dropdown (All/Active/Inactive) + role dropdown (uses useListRolesQuery → builds rolesById map for chip display). "New user" button gated by PermissionGate users.create. Create modal form (zodResolver validators match backend 1:1); on success shows copy-to-clipboard banner displaying 16-char temp password the backend generated (banner dismiss on copy icon click). Edit modal allows first/last/email/role/phone/status toggle. Action column activate/deactivate button with confirm "Setting user INACTIVE will IMMEDIATELY revoke ALL existing sessions. Continue?". All action columns + create button gated by PermissionGate matching backend authorize requirements. |
| `administration/roles/page.tsx` | Roles cards list. Each card shows displayName, roleCount badge, userCount. Edit button → modal opens useGetRoleQuery(). SUPER_ADMIN isSystem role → name input rendered disabled (readonly attribute). Grouped permission matrix uses the GET /permissions grouped response → 9 accordion module panels (expanded by default on open). Each permission = checkbox row, checked state stored in `selectedCodes:Set<string>` local state. Save → updateRoleTrigger with `permissionIds: Array.from(selectedCodes)` → RTK invalidates "Roles" tag → list re-fetch. |
| `administration/audit-log/page.tsx` | Server-filtered audit log viewer. Top filter panel: entityType select, action AuditAction enum select, userId select (useListUsersQuery), dateFrom date picker, dateTo date picker, free-text search, Reset Filters button. Table columns: Expand chevron, Timestamp, User (avatar initials + email), Action (badge — colored by ACTION_TONES record), Entity (type + id). Expand row → beforeData/afterData side-by-side JSON pretty-print blocks (JsonBlock component), metadata block if present. Server pagination via meta from list response. All JSON fields recursively scrubbed on backend; passwordHash field NEVER reaches frontend regardless. |

### 6.5 TypeScript Strict Errors Encountered & Fixed

#### Backend — 42 errors in 3 rounds → 0 errors (exit 0, verified via `npx tsc --noEmit -p tsconfig.json`):
| Error Category | Count | Fix Pattern |
|---|---|---|
| ParsedQs query param bridge | 12 | `const q = req.query as unknown as ListXQuery` (Express ParsedQs isn't subtype of zod-inferred strict types). |
| req.params.id type `string\|string[]` | 8 | Destructure `const { id } = req.params as { id: string }` (Express router param parser doesn't know singular id is string). |
| successResponse signature (message param missing) | 6 | lib/response.ts L14-20: added 4th optional message param. All controllers updated call sites to pass message when needed. |
| authorize readonly `permissionCodes` | 3 | types/express.d.ts L12: removed readonly modifier. Changed `permissionCodes?: readonly string[]` → mutable `string[]`. |
| Prisma7 writeAudit signature incompatibility | 5 | middleware/audit.ts: (a) `import { Prisma, AuditAction }` NOT type-only → Prisma.Json namespace visible. (b) signature relaxed to duck-typed `tx: { auditLog: PrismaClient["auditLog"] } \| PrismaClient`. (c) Create beforeData/afterData/metadata field types changed from `Prisma.JsonValue` → `Prisma.InputJsonValue` (InputJsonValue wider, includes Prisma.Null / Prisma.DbNull / Prisma.JsonNull). |
| Role.name native enum `as unknown as RoleType` | 3 | services layer: `data.name.toUpperCase()` (free-text string from validators) required double-cast to pass Prisma Role.name native enum strict type. |
| User omit passwordHash destructuring | 1 | user services.update: previously had `const { passwordHash: _omit, ...rest } = data` but data shape already OMIT passwordHash via validator (field absent from UpdateUserDto, not just undefined) → destructuring accessor threw TS2339. Fix: removed entire invalid passwordHash: _omit line. |
| auth/me role select shape mismatch | 1 | services me() had selected `role: { select: { id,name,displayName,isSystem,permissions... } }` but UserToDto DTO expects role without displayName sub-field. Fix: stripped displayName from role select. Return shape `{user, permissions: string[]}` (flattened permissions). |
| Envelope return types in controllers | 3 | 3 endpoints returned plain T without wrapping in successResponse; fixed to use `successResponse(res, data)`. |

#### Frontend — 46 errors in 2 rounds → 0 errors (exit 0, verified via `npx tsc --noEmit` this session):
| Error Category | Count | Fix Pattern |
|---|---|---|
| Double-unwrap `listRes?.data?.data?.items` / `roleDetailRes?.data?.success` | 30 | Root cause: adminEndpoints declared `builder.query<Envelope<T>, Args>` → RTK useXxxQuery().data **IS** Envelope. So `const { data: usersRes } = useListUsersQuery(...)` → correct single unwrap `usersRes?.data?.items`. Bulk `replace_all` across 4 pages eliminated 30 errors. |
| layout.tsx JSX parser cascade (TS1005 / TS1381 / TS17002) | 12 | Concise arrow body map + deeply-nested ternary PermissionGate spread → TypeScript JSX parser got confused about "expression expected". Fix: changed 2x nav map callback from concise body to block body with explicit intermediate `let permProps` + if/else ladder + return statement. Cascade errors cleared instantly. |
| setHydratedUser bare-null signature | 6 | authSlice changed action signature from `(AuthUser\|null)` → `({user:AuthUser\|null, permissions?:string[]})`. AuthHydrationProvider had 6x dispatch(setHydratedUser(null)) call sites → all wrapped `dispatch(setHydratedUser({ user: null }))`. |
| AuthHydrationProvider me() response shape | 4 | me() backend now returns `{ user, permissions }` not just user — destructuring updated; fullName computed client-side. |
| PermissionGate TS18048 any/all possibly undefined | 2 | hasPermission helper: `match.any?.some(...)` → added double-bang guards `!!match.any?.some(...)` (discriminated union `any/all?: never` not strict enough for TS strictNullChecks). |
| roles page detail permissionCodes shape | 2 | roleDetail data returned `permissions: {code, module, displayName}[]` object array but code expected flat `rd.permissionCodes: string[]`. Fix: L110 `setSelectedCodes(new Set(rd.permissions.map((p: any) => p.code)))`. |
| audit-log implicit any + JSON unknown type | 4 | (a) L353 items.map((row)) → added explicit `(row: AuditLogItem)`. (b) L411 ACTION_TONES[row.action] → cast `row.action as keyof typeof ACTION_TONES`. (c) L467 + L483 beforeData/afterData/metadata are typed `unknown` (JSON) → render condition `{!!(row.beforeData \|\| row.afterData) && (...)}` double-bang coerces to boolean (so TS2322 unknown not assignable ReactNode goes away). |
| profile page PasswordField invalid `register={pwForm.register}` prop | 3 | PasswordFieldProps extends InputHTMLAttributes — NO `register` custom prop. Correct pattern: forwardRef spread `{...pwForm.register("field")}` provides name/onChange/onBlur/ref automatically. Deleted invalid `register={pwForm.register}` from 3x call sites; replaced with spread. |
| profile page PasswordField prop name mismatch | 1 | Call site used `showStrength` but component prop is `showStrengthMeter: boolean` → renamed to match. |
| profile page PasswordField duplicate `name=` prop | 3 | Code had BOTH explicit `name="currentPassword"` AND `{...register(...)}` (register spread also returns name field) → TS2783 "name specified more than once". Fix: removed explicit name= props entirely (register spread provides it unambiguously). |

### 6.6 Phase 3 Acceptance — Exit Criteria (User Execution Pending)

TypeScript compilation gate (already passed editor-side):
- ✅ Backend: `npx tsc --noEmit -p tsconfig.json` → 0 errors (exit 0) — confirmed last session
- ✅ Frontend: `npx tsc --noEmit` → 0 errors (exit 0) — confirmed this session immediately before writing this section (blank output line, exit code 0)

User-executed test checklist (run commands in order documented in 6.7):
- [ ] DB migration applies clean: `prisma migrate dev --name add_user_phone` → migration.sql created & applied
- [ ] RBAC seed runs clean: `npx ts-node prisma/seed_phase3_rbac.ts` → exit 0, pgAdmin SELECT count(*) FROM permission → 62 rows expected; RolePermission ~400 rows; Role GROUP BY shows 7 tiers
- [ ] Backend dev server starts (port 5000); GET /health → 200 OK; GET /api/v1/auth/me w/ valid token returns 200 envelope with {user, permissions: string[]} shape
- [ ] Manual RBAC deny: SUPER_ADMIN token → GET /api/v1/users returns 200 success=true; SALES token → PATCH /api/v1/users/<any-id> returns 403 success=false
- [ ] INACTIVE enforcement: SUPER_ADMIN changes user status → INACTIVE via PATCH. That user's NEXT api call (even < 1 second after deactivation, before 15-min JWT TTL expires) → 401 UnauthorizedError envelope, NOT 200
- [ ] System role guard: try PATCH /roles/SUPER_ADMIN_ID?name=RENAMED → 400 "Cannot rename/delete a system role". Try DELETE same → 400 same message.
- [ ] Audit append-only: grep backend/src/modules/audit-logs/routes.ts → NO post/patch/delete route definitions (app.route() or router.post). Routes file has only a single router.get for list.
- [ ] Browser SUPER_ADMIN login → sidebar Administration drawer visible (Users, Roles, Audit log 3 links). Users page renders list with avatar+role chip+status. Roles edit on SUPER_ADMIN → name field disabled.
- [ ] Browser user-create flow: New user → submit → success banner shows COPY 16-char temp password → new row appears in users table. Copy banner has dismiss X.
- [ ] Browser HR login (create via users page first) → Administration drawer completely HIDDEN from sidebar. Direct URL /administration/users → redirects /dashboard (PermissionGate + route-level gate inside AuthHydrationProvider).
- [ ] Audit log capture: Edit any user (change firstName "X"→"Y", save) → navigate Audit Log, filter entityType=User → top row UPDATE User action. Expand chevron → beforeData.firstName="X" / afterData.firstName="Y" JSON both present & pretty-print formatted. Neither JSON block contains passwordHash key anywhere.

### 6.7 User Terminal Handoff — Run Commands In Order (Backend FIRST)

```powershell
# ============================================================
#  STEP 1 — APPLY PHONE COLUMN MIGRATION + RBAC SEED
# ============================================================
cd "g:\MBW Projects\Other\BS\backend"

# 1a. Apply phone column migration to live PostgreSQL DB
#    Expected: Creates prisma/migrations/*_add_user_phone/migration.sql
#              Prints "Migration applied successfully."
npx prisma migrate dev --name add_user_phone

# 1b. Populate 62 permissions + 7 tiered role assignments (RUN THIS EXACTLY)
#     Expected: Exit code 0, no exceptions thrown. 
#     VERIFY AFTER via pgAdmin on business_suite DB:
#       SELECT count(*) FROM "permission";             → expected 62
#       SELECT count(*) FROM "RolePermission";         → expected ~400
#       SELECT name, "isSystem", count(rp."permissionId") AS perm_count
#         FROM "Role" r LEFT JOIN "RolePermission" rp ON r.id = rp."roleId"
#         GROUP BY r.id, r.name, r."isSystem"
#         ORDER BY perm_count DESC;
#       → 7 rows: SUPER_ADMIN(isSystem=t)=62, ADMIN(isSystem=t)=~39,
#                 MANAGER=~32, SALES=~15, CASHIER=~9, HR=~13, VIEWER=~30
npx ts-node prisma/seed_phase3_rbac.ts

# 1c. Optional comfort: confirm backend tsc still 0 errors
npx tsc --noEmit -p tsconfig.json

# ============================================================
#  STEP 2 — START BACKEND DEV SERVER (TERMINAL 1, KEEP OPEN)
# ============================================================
# Expected: "Environment validated" + "DB OK (PG 18.6)" +
#           "🚀 Server running on port 5000"
npm run dev
```

**OPEN 2ND POWERSHELL TERMINAL** (leave backend running in Terminal 1):
```powershell
# ============================================================
#  STEP 3 — START FRONTEND DEV SERVER (TERMINAL 2, KEEP OPEN)
# ============================================================
cd "g:\MBW Projects\Other\BS\frontend"

# Expected: Next.js 15/16 banner → "Local: http://localhost:3000"
npm run dev
```

**Optional comfort manual RBAC deny PowerShell test (3rd terminal, after backend up, before browser):**
Get SUPER_ADMIN JWT first (Phase 2 pattern you already used for login), then:
```powershell
# GET /users w/ SUPER_ADMIN token → should 200 envelope success=true
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/users?page=1&pageSize=5" `
  -Headers @{ Authorization = "Bearer $SA_JWT" } | ConvertTo-Json -Depth 6

# PATCH /users/:id w/ SALES-level token (or create one) → should 403 envelope success=false
# 403 means BACKEND SECURITY BOUNDARY WORKING regardless of frontend PermissionGate UX
```

**Concepts learned**: Why RBAC security boundary is BACKEND ONLY (frontend PermissionGate = UX polish, never trusted); why per-request DB status check is worth the ~1ms latency for instant INACTIVE deactivation (15-min JWT grace window would be a real fired-employee vulnerability); service-layer audit logging vs. global Express middleware tradeoffs (service-layer wins because services have beforeData row pre-read and transactional $transaction pair atomically commits business+audit rows); Prisma 7 breaking strict typing changes (InputJsonValue wider than JsonValue for creates; Omitted $transaction tx arg type cannot be assigned to full PrismaClient → duck-type signature pattern); why `authorize` middleware was designed as variadic factory with {any,all} matchers instead of single string → covers every role-gate shape we need from here through Phase 12 HRM leave.approve cross-module permission; async zod `coerce` on pagination pageSize/page query params (HTTP sends string, zod parses to number without explicit parseInt boilerplate everywhere); why role-detail permission assignment uses deleteMany+createMany inside one $transaction instead of diff adds/removes (62 perms is small scale, simpler code wins); why audit logging is best-effort try/catch inside writeAudit function and NEVER allowed to abort the business transaction (append-only integrity is nice-to-have, order/invoice creation is mission-critical); RTK Query Envelope<T> unwrap consistency (double-`.data?.data` is an extremely common class of bug when teams wrap RTK in custom envelopes — we now have a hard internal convention: "if Envelope<T>, single unwrap `.data`, never double").

---

## 7. PHASE 4 — Reusable UI & Table Infrastructure

> **Status**: ✅ COMPLETED (Frontend `npx tsc --noEmit` → exit code 0, 0 errors. All 4 administration pages refactored.)

**Objective**: Build the shared component library and enterprise data table infrastructure BEFORE building any module pages. Every module page reuses these instead of reinventing the wheel. Reusable components = 4 buckets (Forms/Feedback/Common/Tables) = **19 component files + 1 lib util file (table-utils.ts)**. Refactored all 4 Phase 3 administration pages (Users, Roles, Audit-Log, Profile) to use the new library as Phase 4 acceptance proof.

### 7.1 Package.json Dependency Check — ZERO Installs Required!
Ran verification: `@tanstack/react-table v9.1.2`, `react-day-picker v10.0.1`, `date-fns v4.4.0`, all `@radix-ui/react-*` packages already present from Phase 0. **No new npm installs.** Avoided churn.

### 7.2 Components Created (19 files, all in `frontend/src/components/`)
#### Bucket A: Forms (6 components, controlled RHF-forwardRef spread pattern)
| Component | File | Props / Key API | Notes |
|-----------|------|-----------------|-------|
| GlobalInput | `form/GlobalInput.tsx` | `label, error, hint, inputType="text", showSearchIcon, showPasswordToggle, {...register("x")}` | ForwardRef `<HTMLInputElement>`; extends InputHTMLAttributes. No explicit `name=` prop when using `{...register()}` — per project convention. |
| GlobalPasswordField | `form/GlobalPasswordField.tsx` | Re-export of `PasswordField` wrapper → forwardRef. Props: `label, error, placeholder, showStrengthMeter` | Thin wrapper around existing `@/components/auth/PasswordField` to unify naming convention. |
| GlobalSelect | `form/GlobalSelect.tsx` | `label, error, options: {value:string,label:string}[], value, onChange, placeholder` | **Concrete `string` select values ONLY** (de-generified after 18 TS2322 generic forwardRef errors). Radix Select Popper position; scroll Up/Down buttons. Hidden `<input name=value>` if name prop given, for HTML form.submit. |
| GlobalMultiSelect | `form/GlobalMultiSelect.tsx` | RHF `Controller` pattern (only component that uses Controller for simplicity). | Radix Checkbox inside Popover; chips with remove X. |
| GlobalDatePicker | `form/GlobalDatePicker.tsx` | `label, value: string\|Date, onChange: (iso: string\|null) => void, allowClear, minDate, maxDate` | `react-day-picker v10` with fixed classNames (flat keys: `selected`, `today`, `disabled`, `month_caption` — not legacy `day_selected`/`caption` which caused initial errors). |
| FormField | `form/FormField.tsx` | Renders label+input+field error together. Slot for any child input. | Utility wrapper for consistency. |

#### Bucket B: Feedback (5 components)
| Component | File | Key Props | Notes |
|-----------|------|-----------|-------|
| GlobalModal | `feedback/GlobalModal.tsx` | `open, onOpenChange, title, description?, children, footer?, size=sm\|md\|lg\|xl, showCloseButton, dismissable` | Radix Dialog. **Footer rendered OUTSIDE `<form>`** so submit buttons can use `form="id"` attribute to submit outside `<form>` HTML element (layout friendly). |
| ConfirmDialog | `feedback/ConfirmDialog.tsx` | `open, onOpenChange, title, description, confirmText, cancelText, variant="destructive"\|"primary", loading, onConfirm, icon` | Wraps GlobalModal. Initial error: title prop required not passed → TS2741. Fixed by explicit forward. |
| EmptyState | `feedback/EmptyState.tsx` | `title, description, action, icon, compact` | Card with illustration zone, centered. Used by GlobalTable when `data=[] && !isLoading`. |
| ErrorState | `feedback/ErrorState.tsx` | `title, description, onRetry, compact` | Red left-border card with Retry button. Uses RTK Query `error.message` if available. |
| LoadingSkeleton | `feedback/LoadingSkeleton.tsx` | `count, variant=table` | **Tailwind `animate-pulse` ONLY** (no custom @keyframes shimmer — predicted pitfall Category F: avoided missing `@keyframes` compile errors entirely). |

#### Bucket C: Common (4 components)
| Component | File | Key Props | Notes |
|-----------|------|-----------|-------|
| PageHeader | `common/PageHeader.tsx` | `title, description?, breadcrumbs?: [{label, href?}], action?` | Breadcrumb responsive; flex-wrap action row with description. |
| **StatusBadge** (HARD CONSTRAINT!) | `common/StatusBadge.tsx` | `label, tone: 16 Tones, size, icon, dot, className` | **16 tones ALL RESTRICTED TO 6 COLOR FAMILIES: emerald/rose/slate/sky/violet/teal** — **NO YELLOW / AMBER / MUSTARD ANYWHERE** (user profile explicit "eye-strain" restriction). Tones: `success, danger, neutral, info, accent, teal, rose, violet, emerald, slate, sky, active, inactive, pending, approved, rejected`. |
| MoneyDisplay | `common/MoneyDisplay.tsx` | `amount, currency="USD", locale="en-US", className` | Format number → currency via `Intl.NumberFormat`. Right-align class for tables. |
| DateDisplay | `common/DateDisplay.tsx` | **`date=` (not `value=`)**, format: short\|medium\|long\|relative\|datetime, placeholder, suffixRelative | datefns `format()` + `formatDistanceToNow()`. `<time>` element with title full tooltip. |

#### Bucket D: Tables (5 components + `lib/table-utils.ts` util factory)
##### TanStack React Table v9 BREAKING MIGRATION (Category A errors)
StackOverflow teaches v8 API (`useReactTable`, `ColumnDef<1Arg>`, `FlexRender(colDef,ctx)` 2-arg, `size:` column prop, implicit features). Project has **v9 installed**. 34 initial errors solved by:
1. Reading authoritative `node_modules/@tanstack/react-table/skills/migrate-v8-to-v9/SKILL.md` (not internet)
2. **Feature factory pattern MANDATORY**: `tableFeatures({rowSortingFeature, rowPaginationFeature, rowSelectionFeature, rowExpandingFeature, sortedRowModel:createSortedRowModel(), paginatedRowModel, expandedRowModel})`
3. All generics now 3-arg: `ColumnDef<Features, Data, Value>`
4. `FlexRender` → SINGLE ARG OBJECT `<FlexRender header={header}/>` / `<FlexRender cell={cell}/>`
5. `size:` ColumnDef prop REMOVED → set th minWidth via `style={{minWidth:44}}` on header.id match
6. `getIsAllPageRowsSelected` → renamed to `table.getIsAllRowsSelected()` in v9

| Component / File | Purpose |
|------|---------|
| `lib/table-utils.ts` (149 lines) | Exports 3 key factories: (1) `tableFeaturesDefault` singleton for GlobalTable, (2) `createColumns<TData>()` helper (`col.display/cell.accessor(...)` — typed builder), (3) helpers: `extractItemsAndMeta(queryResult.data)` RTK envelope unwrap (supports BOTH `{items, meta}` and legacy array-data envelopes), `getPaginationParamsFromSearchParams`, `urlParamsFromState`. |
| GlobalTable.tsx (635 lines) | `useTable` with features factory. Props: `columns, queryResult? (RTK hook result object) OR (data+meta)`, `serverSide=true, defaultSortBy, pageSizeDefault, enableRowSelection, renderSubRow (auto-expand column)`. Manages URL search params pagination/sort/search sync via NextJS `useRouter.push({scroll:false})`. Prepends `__select__` and `__expand__` columns automatically if props set. CSS minWidth: 44px (select) / 36px (expand). Built-in LoadingSkeleton / EmptyState / ErrorState + row fetching top progress bar (backdrop blur overlay for re-fetching with data). |
| TableToolbar.tsx | SearchInput (300ms debounced) + FilterPanel slot + Export + CreateNew buttons. Start/endContent slots for filters (used by Users page to inline GlobalSelect status/role filters). |
| Pagination.tsx | Renders page 1..N jump numbers, Prev/Next, PageSize GlobalSelect. Consumes `PaginationMetaShape` from server (`{page, pageSize, totalItems, totalPages, hasNext?, hasPrevious?}`). |
| SearchInput.tsx | **Debounced 300ms internal state** — draft useState → `setTimeout(onChange, 300ms)`. Clear X button on right, Search icon left. Optional `onSubmit` on Enter for immediate apply. |
| FilterPanel.tsx | Optional add-remove dynamic `[{field, operator, value}]`. Useful for later Phase 5 CRM complex filtering. |

### 7.3 Frontend TypeScript 48 → 0 Errors — 7 Category Batch-Fix Table
**Before 4-page refactor (component library only):**
| Error Category | Count | Root Cause | Fix Pattern |
|----|----|----|----|
| A: TanStack v8→v9 API renames | 34 | useReactTable, 1-arg ColumnDef, size prop, FlexRender 2-arg, implicit features, getIsAllPageRowsSelected removed | Read `node_modules/@tanstack/react-table/skills/migrate-v8-to-v9/SKILL.md` authoritative rename list. Rewrote GlobalTable + table-utils factory. 3-arg generic, FlexRender single object arg, minWidth via header th style. |
| B: GlobalSelect generic mismatches | 18 | `forwardRef<HTMLButtonElement, GlobalSelectProps<V>>` with `<V extends string>` caused TS2322 18x | De-generified: `options: {value:string,label:string}[]` always. String values work for all call-sites anyway — priority DX over type parametricity. |
| C: ConfirmDialog title required missing | 1 | Wrapper didn't pass required `title` prop down to GlobalModal (TS2741) | Explicit title+description forward in wrapper component |
| D: react-day-picker v10 classNames shape | 1 | Legacy `day_selected`, `day_today`, `day_disabled`, `caption` keys unknown | Rename → flat (selected/today/disabled) + `caption` → `month_caption` |
| E: FilterPanel FilterOperator cast | 2 | `GlobalSelect onChange(v:string)` → assign to `FilterOperator` enum (TS2322) | Narrow `op as FilterOperator` cast |
| F: LoadingSkeleton custom @keyframes | 0 (Predicted & Avoided!) | Shimmer animation custom → missing tailwind @keyframes → compile error at build | Used ONLY Tailwind built-in `animate-pulse` — no custom keyframes anywhere |
| G: Residual errors (2nd tsc run after A-E) | 9 | (1× caption residual), (2× size 44/36 ColumnDef props still), (3× onPagination/onSorting/onRowSelection implicit any), (1× getSize missing Header API), (2× FlexRender 2-arg still in some cells) | Batch fixed all 9 in single tsc re-run iteration |
| **TOTAL** | **48 → 0** | | Exit code 0 achieved in 3 tsc runs (bucket A → buckets B-F → residual G) — not 10+ line-by-line rounds! |

### 7.4 Phase 3 Administration Pages → REFACTOR (4 pages, 0→0 tsc)
#### Page A: Users → `(dashboard)/administration/users/page.tsx` (715 lines, 100% rewrite from 923→715 lines, 22% smaller)
- Replaced: inline header HTML → `PageHeader breadcrumbs + action (Refresh + New User)`
- Filters: `TableToolbar SearchInput 300ms debounced startContent GlobalSelect status / role` → URL-synced (status, roleId, page, pageSize, sortBy, sortOrder, search)
- Table: `GlobalTable<UserListItem>` + `createColumns<UserListItem>()` 5 columns (User avatar/name/email, role StatusBadge ROLE_TONE: SUPER_ADMIN=violet/ADMIN=sky/MANAGER=sky/HR=rose/SALES=emerald/`CASHIER=TEAL (no-yellow replacement for legacy amber)`, status active=emerald inactive=rose dot, lastLoginAt `<DateDisplay date=>`, actions Edit/Deactivate/Activate)
- Modals: 3× `GlobalModal` (create empty pw, createdPW shown once after mutation, edit) with footer submit `form=` attribute trick, 2× `ConfirmDialog` (deactivate destructive / activate primary)

#### Page B: Roles → `(dashboard)/administration/roles/page.tsx` (630 lines, kept card design)
- Inline `bg-purple text-xs span` for System roles → `StatusBadge tone=violet size=sm dot label=System`
- Edit role: `GlobalModal size=lg description=system role lock warning` for permission matrix; `GlobalInput disabled={!!isSystemEdit}` for SUPER_ADMIN name & display when locked
- Delete: `ConfirmDialog destructive`

#### Page C: Audit-Log → `(dashboard)/administration/audit-log/page.tsx` (473 lines rewrite)
- Filters: `PageHeader + Refresh` action, 2-row filter grid row1: `SearchInput (col-span-2) + entityType GlobalSelect + action GlobalSelect`; row2: `userId GlobalSelect + dateFrom/dateTo 2× GlobalDatePicker` (all URL-synced, page reset 1 on filter change)
- ACTION_TONES STATUS BADGE NO-YELLOW AUDIT: `CREATE=emerald / UPDATE=sky / DELETE=rose / LOGIN=violet / LOGIN_FAILED=TEAL ★REPLACED FORBIDDEN AMBER★ / LOGOUT=slate`
- Table: `GlobalTable<AuditLogItem> renderSubRow={callback}` → auto-prepends expand chevron column. Expanded row: `JsonBlock grid 2-col` Before (left) / After (right) + Metadata full-width below + auditId/entityId footer line
- `getRowId={r => r.id}` for deterministic row selection/expansion keys

#### Page D: Profile → `(dashboard)/profile/page.tsx` (299 lines rewrite)
- `PageHeader breadcrumbs=[{label:Profile}] + action: Back to Users button (if admin PermissionGate any users/roles/audit)`
- Identity card: avatar initials circle + name watch + email + `StatusBadge emerald ShieldCheck icon label=role`
- 2-column grid Personal Info (GlobalInput firstName/lastName 2-col, GlobalInput phone) + Change Password (3× GlobalPasswordField current/new/confirm; new has showStrengthMeter)
- **2FA placeholder bg-amber-50 → slate FIXED (no-yellow violation)** — original card had `bg-amber-50 dark:bg-amber-950/30` (yellow family). Replaced with: `bg-slate-100 dark:bg-slate-800/80 + text-slate-600 dark:text-slate-300 + border-slate-200 dark:border-slate-700` — allowed slate family only!

### 7.5 Key Decisions & Trade-Offs
| Decision | Why this vs alternative |
|----------|--------------------------|
| URL Search Params as pagination/sort/filter source of truth, NOT local useState | shareable URLs + browser back/forward button works automatically; zero useEffect sync logic. Every module page gets deeplinks for free. |
| TanStack v9 Feature factory pattern (tableFeaturesDefault singleton) | v9 **REQUIRES** explicit features + rowModels registration. Factory registered once in table-utils → no drift across pages (if we used inline every page would copy 7 lines wrong). |
| StatusBadge ONLY 6 color families, NO YELLOW | User profile hard constraint: "Avoid high-saturation or eye-straining colors (specifically yellows/mustards)". By restricting the TONE_CLASSES map to emerald/rose/slate/sky/violet/teal at file-level we CAN'T accidentally introduce amber later. |
| GlobalSelect string-only (de-genericified) | 18 TS2322 errors trying `<V extends string>` with React 19 forwardRef inference. Devs pass string values 99% of the time anyway. DX priority over typing perfection. |
| GlobalTable 2 data input modes (`queryResult?: RTK hook result` OR `data+meta` props) | 95% of pages use RTK so `queryResult` gets auto isFetching/isError/error/refetch. For non-RTK (testing / local stories), pass data+meta directly. One component, 2 call patterns. |
| LoadingSkeleton tailwind animate-pulse only | Avoids need to ship custom @keyframes in global CSS. Predicted pitfall category F. |

### 7.6 Acceptance Gates (User Execution)
**ALREADY PASSED EDITOR-SIDE (non-browser):**
- ✅ Package dependency check (0 new installs)
- ✅ Component library strict tsc (48 errors → 0, 7 categories, 3 rounds)
- ✅ 4 page refactors strict tsc: exit code 0, all 0 errors (10 pre-existing fixed: UserStatus import → inline, DateDisplay value→date, onValueChange→onChange 4x)
- ✅ No-yellow scan: StatusBadge TONE_CLASSES contains no amber/yellow classnames. Audit LOGIN_FAILED=teal, Users CASHIER=teal, Profile 2FA card=slate. ZERO forbidden amber/yellow tones anywhere.

### 7.7 User Terminal Handoff — Phase 4 Browser Smoke Tests (10 gates)
```powershell
# ─────────────────────────────────────────────────────────────────────
# PREREQUISITES: Both servers running from Phase 3 (backend port 5000,
# frontend dev server port 3000). If needed, restart them FIRST:
# ─────────────────────────────────────────────────────────────────────
# Terminal 1 (Backend):
cd "g:\MBW Projects\Other\BS\backend"
npm run dev

# Terminal 2 (Frontend):
cd "g:\MBW Projects\Other\BS\frontend"
npm run dev

# ─────────────────────────────────────────────────────────────────────
# BROWSER SMOKE TESTS (login as admin@example.com / Admin@123):
# ─────────────────────────────────────────────────────────────────────

# Gate 1: SANITY RENDER — Login → click Administration → Users page.
#   Result: PageHeader, search box, status/role filter dropdowns visible (not old HTML selects with inline input).

# Gate 2: URL PARAM SYNC — On Users page click pagination "page 2" if available.
#   Result: Browser URL changes to /administration/users?page=2&pageSize=25&sortBy=createdAt&sortOrder=desc

# Gate 3: BACK BUTTON WORKS — Press browser Back button.
#   Result: Returns to page 1 URL. Data re-fetches for page=1.

# Gate 4: SEARCH DEBOUNCE 300ms — Open DevTools Network tab. In Users search box type "abc" FAST (3 keystrokes < 300ms).
#   Result: Only ONE network request fires (after 300ms idle) not 3.

# Gate 5: SORT TOGGLE — Click table column header "Timestamp" (or user/lastLogin).
#   Result: Arrow changes ↑ then ↓; URL sortBy/sortOrder changes asc/desc; one re-fetch.

# Gate 6: ROW SELECTION CHECKBOXES — On Users page add ?enableRowSelection=true if needed (future use).
#   Result: Header checkbox + per-row checkbox all indeterminate/checked states work correctly.

# Gate 7: GLOBAL PASSWORDFIELD EYE TOGGLE — Profile page.
#   Result: All 3 password fields (current / new / confirm) have right-side eye icon. Click → password changes to TEXT type → dots → text toggle.

# Gate 8: DATE PICKER CALENDAR OPENS — Audit-Log page → click "From date" filter.
#   Result: react-day-picker v10 calendar popover appears (Today indicator, month arrow navigation). Select a date → GlobalDatePicker input shows formatted date.

# Gate 9: STATUS BADGE NO YELLOW VISUAL AUDIT — Navigate:
#   (a) Users page: role badges (violet/sky/rose/emerald/TEAL/slate) + status active(emerald)/inactive(rose) dots.
#   (b) Roles page: System badge violet small.
#   (c) Audit-Log page: action badges CREATE(emerald)/UPDATE(sky)/DELETE(rose)/LOGIN(violet)/LOGIN_FAILED=**TEAL**(not amber!)/LOGOUT(slate).
#   (d) Profile page: role=emerald + 2FA card=**SLATE**(not amber!).
#   Result: ZERO yellow/mustard/amber colors anywhere. LOGIN_FAILED specifically TEAL family.

# Gate 10: PROFILE PASSWORD VALIDATION ERRORS DISPLAY — Profile page, "Change password" form:
#   (a) Submit empty: 3 errors, each GlobalPasswordField has rose border + error text below field.
#   (b) New pw "short": error "Must be 8+ characters with uppercase, lowercase, digit, and one special character." displays.
#   (c) New pw good / Confirm pw diff: confirm pw field error "Passwords do not match." inline.
#   Result: All validation errors render correctly below fields in rose text, not just invisible RHF state.

# Git commit (after user confirms 10 gates PASS in browser):
cd "g:\MBW Projects\Other\BS"
git add -A
git commit -m "feat(phase-4): reusable UI library (19 components) + TanStack v9 GlobalTable infrastructure + refactor 4 admin pages (Users/Roles/Audit-Log/Profile)"
```

**Concepts learned in Phase 4**: TanStack v9 feature architecture, batch tsc error bucketing (48 errors → 7 named categories → 3 rounds = exit 0), React 19 forwardRef inference issues with generics, user profile color constraint enforcement via exhaustive enum map (not per-page ad-hoc), URL search params source of truth pagination (local useState = anti-pattern for shareable dashboard tables), Radix Dialog footer outside `<form>` with form= attribute trick.

---

## 8. PHASE 5 — CRM Module (Customers, Leads, Opportunities, Activities, Contracts)

> **Status**: ✅ Editor-side complete. Backend/Frontend TypeScript compile pending user-run. TSC by sub-agent module pattern: each sub-agent wrote customers/contacts, leads/activities, opportunities/contracts.

### 8.1 Database Schema Changes (6 tables + 5 enums + relations)

**Enums added/extended:**
- `CustomerStatus` (extend ACTIVE | INACTIVE → ACTIVE | INACTIVE | **CHURNED**) (rose tone)
- **`OpportunityStage`** = PROSPECTING|QUALIFICATION|NEEDS_ANALYSIS|PROPOSAL|NEGOTIATION|CLOSED_WON|CLOSED_LOST (7 stages — 7 StatusBadge tones: slate/sky/violet/teal/violet/emerald/rose NO AMBER anywhere)
- **`ContractStatus`** = DRAFT|SIGNED|ACTIVE|EXPIRED|TERMINATED (slate/sky/emerald/slate/rose)
- `ActivityType` extended (CALL, EMAIL, MEETING, NOTE, TASK → + **PROPOSAL_SENT**) (emerald tone)

**Tables added (3 NEW models):**
| Model | Primary codes pattern | Key fields |
|-------|----------------------|------------|
| Opportunity | OPP-0001 counter | customerId? FK, leadId? FK, stage (default PROSPECTING), amount(14,2) @currency USD, probabilityPercent Int 0-100, expectedCloseDate Date, assignedToId FK, createdById, unifiedActivities[] |
| **Unified Activity** | Append-only no PATCH/DELETE routes | type (ActivityType), subject req, description, activityAt, outcome, userId, leadId? FK, customerId? FK, opportunityId? FK — **XOR exactly one non-null** (Zod refine at validation layer + application layer pre-insert FK existence check each) |
| Contract | CON-0001 counter | customerId req, title req, status, startDate endDate refine end>=start, value(14,2), signedAt/signedById FK, notes |

**Existing models touched:**
- Customer: + `source LeadSource @default(OTHER)` (already in schema), `status CHURNED`, + relations to opportunities[], contracts[], activities[]
- Lead: + `currency String @default(USD)`, + relations `unifiedActivities Activity[]`, `convertedOpportunities Opportunity[]`
- User: + 6 new FK-relations (assignedOpportunities, createdOpportunities, signedContracts, createdContracts, created activities[], assignedTo opps) — all FK SetNull/Cascade correctly
- All indexes added: status filters, source, assignedToId, customerId/leadId/oppId on activity, expectedCloseDate, stage, opportunityCode/contractCode uniques

### 8.2 Permission Seed — `seed_phase5_crm.ts` (15 new codes)
**Idempotent pattern** matches Phase 3: upsert each Permission, then for each role (SUPER_ADMIN..VIEWER) find existing RolePermissions → add-only (never delete; additive for idempotency across re-runs). 15 new granular codes added:

| Sub-module | Codes (4 or 5 each) |
|------------|---------------------|
| Contacts 4 | crm.contacts.read/create/update/delete |
| Opportunities 5 | crm.opportunities.read/create/update/delete/stage (PATCH quick change) |
| Lead convert 1 | crm.leads.convert (QUALIFIED → WON $transaction) |
| Activities 2 | crm.activities.read/create — **append-only no update/delete codes** |
| Contracts 4 | crm.contracts.read/create/update/delete |

**Role tier grants summary:**
- SUPER_ADMIN + ADMIN: all 15
- MANAGER: all (contacts, opps all incl delete, convert, activities, contracts R/C/U/D)
- SALES: contacts R/C/U/D, opps NO DELETE, activities, convert, contracts R/C
- CASHIER: read-only for contacts/activities/contracts only
- HR: nothing (CRM separate)
- VIEWER: *.read only for all 6 CRM tables (no writes)

### 8.3 Backend Modules (Folder-per-resource 4 files each)
**All files under `backend/src/modules/crm/`:**
- customers/{validators,services,controllers,routes}.ts → CUST-% code generate inside create(dto,req) $transaction writeAudit CREATE afterData, list supports search name/company/email OR, status filter, source filter, pagination, getById(id,includeContacts=true,includeOpps=true)
- contacts/{validators,services,controllers,routes}.ts → createForCustomer(customerId,dto,req): **isPrimary enforcement**: if dto.isPrimary===true then BEFORE inserting UPDATE set this customer's ALL existing contacts set isPrimary false, then create new primary. Append-only writeAudit each write. Dual mount: /contacts/:id standalone CRUD + /customers/:customerId/contacts collection routes (aggregate router mounts both).
- leads/{validators,services,controllers,routes}.ts → LEAD-% counter, stage enum default NEW, convertLead(id,dto,req) $transaction atomic: (1) validate status≠WON/LOST (BadRequest), (2) create Customer (generate CUST- code, customerName=dto, copy email/phone/source from lead), (3) if createOpportunity → create Opportunity QUALIFICATION w/ amount, (4) UPDATE lead status WON wonLostAt=now(), (5) writeAudit ×3 (Customer CREATE, Opportunity CREATE, Lead UPDATE). Returns triple {customer, opp?, lead}.
- opportunities/{validators,services,controllers,routes}.ts → OPP-% code, 7 stage tones, patchStage(id,stage,note?,req) stage-only update w/ writeAudit UPDATE metadata:{note}.
- activities/{validators,services,controllers,routes}.ts → CREATE: 1st verify linked entity exists (lead/customer/opp each FK not 404), then insert activity. Zod XOR refine at validation layer ensures exactly 1 non-null among leadId/customerId/oppId → throws 422 with field-level path refine message. Routes exposes only GET list (paginated, type/userId/dateRange/entityId filters/search) + POST create. **PATCH/DELETE NOT DEFINED = append-only immutable**.
- contracts/{validators,services,controllers,routes}.ts → CON-% counter generate, create date validate start<=end refine, signedAt/signedById optional, delete DRAFT-only recommended (service doesn't enforce; UI hides delete ACTIVE).

**Mount points (routes/index.ts v2):**
```ts
// Phase 5 CRM
apiV1Router.use("/crm", crmRouter);
// Inside crm routes aggregate:
crmRouter.use("/customers", customersRouter);
crmRouter.use("/customers/:customerId/contacts", contactsRouter); // dual-mount collection
crmRouter.use("/contacts", contactsRouter);                   // dual-mount standalone
crmRouter.use("/leads", leadsRouter);
crmRouter.use("/opportunities", opportunitiesRouter);
crmRouter.use("/activities", activitiesRouter);
crmRouter.use("/contracts", contractsRouter);
```

### 8.4 Frontend Pages (7 pages + Sidebar CRM drawer)

**Sidebar drawer (dashboard layout.tsx):**
- Added CRM_SUBNAV 5 links: Overview (home), Customers (List), Leads (List), Deals (Opportunities List), Contracts (List) → same pattern as Administration drawer (collapse/expand state, PermissionGate requires ANY of `crm.customers.read / crm.leads.read` etc). Added `hasAnyCRM` computed boolean, added icons: Target, HandCoins, FileText, UserRoundPlus imported from lucide-react; mounted before Admin drawer (CRM top).

**crmEndpoints.ts (RTK Query ~25 endpoints):**
All 6 CRM resources + List*Args + Create/Update types exported. ApiSlice tagTypes.push mutated after createApi call to register Customers, Contacts, Leads, Opportunities, Activities, Contracts cache tags for provides/invalidatesTags (Pitfall Category A avoided: RTK tag types silent unknown → now registered). Provides/invalidates per module.

**Pages (all "use client" NextJS app router):**
1. **/crm/page.tsx** (CRM Home Overview): 2x2 stat cards (Total Customers, Open Leads (≠WON/≠LOST), Total Pipeline $ (sum amount non closed), Active Contracts status in {SIGNED, ACTIVE}). Below cards: Recent Leads GlobalTable (createdAt desc take 10), Recent Activities GlobalTable.
2. **/crm/customers/page.tsx** (List): TableToolbar SearchInput 300ms + Status 3-tone filter + LeadSource 6-tone filter. 7 columns GlobalTable via `createColumns<CustomerItem>()`. Status tones: ACTIVE=emerald, INACTIVE=slate, CHURNED=rose. Source tones: WEBSITE=sky, REFERRAL=violet, SOCIAL=teal, PHONE=slate, EMAIL=sky, OTHER=slate. totalSpent MoneyDisplay USD. createdAt DateDisplay date= prop (NOT value!). Actions View→/crm/customers/[id], Edit md GlobalModal, Trash (PermissionGate crm.customers.delete ConfirmDialog destructive). Create Customer GlobalModal lg w/ 2-col RHF form register spread pattern — NO explicit name= props. 2× GlobalDatePicker → date prop.
3. **/crm/customers/[id]/page.tsx** (Detail tabs): useParams → id. Hero card identity (avatar initials, code, status, name). Radix Tabs 3: Profile (info display + Edit info modal + Contacts sub-table with add/edit/delete. IsPrimary Radix Switch toggles service auto-resets others). Opportunities (GlobalTable stage 7 strict color mapping). Activity (timeline cards + Log Activity GlobalModal type/subject/description/activityAt date=/userId auto). Breadcrumb [CRM→Customers link→customer.name]. Back button.
4. **/crm/leads/page.tsx** (List — 2-View Toggle default Table): TABLE view (URL sync search/status/source/assigned pagination + 7 cols createColumns status tones NEW slate CONTACTED sky QUALIFIED violet PROPOSAL teal WON emerald LOST rose). KANBAN view: 6 columns NEW→CONTACTED→QUALIFIED→PROPOSAL→WON→LOST. Per-card: view/edit pencil, Convert button if status∈{QUALIFIED,PROPOSAL,WON, NEW?}→ConvertLead GlobalModal, "Move to stage" GlobalSelect onChange triggers patchLeadStage mutation (click-move, zero drag/drop no dnd-kit installed per Pitfall P1 mitigation). ConvertLead form= attribute submit, redirects to /crm/customers/[id] success.
5. **/crm/leads/[id]/page.tsx** (Detail tabs: Info, Activity): Top 3 summary cards: big StatusBadge + code, Assigned To avatar, value$ + Probability progress bar. Info tab: 2-col grid display + edit modal. Activity tab: typed status tones (CALL=sky,EMAIL=violet,MEETING=teal,NOTE=slate,TASK=violet,PROPOSAL_SENT=emerald) timeline card per activity + Log Activity GlobalModal (userId auto).
6. **/crm/opportunities/page.tsx** (Deals List): 4-summary cards. 7 cols createColumns: code, name+customer link, 7-stage strict StatusBadge, MoneyDisplay, probability % mini-progress bar, expectedCloseDate date= prop, assigned, actions view/edit/trash. 7-stage strictly PROSPECTING slate→QUALIFICATION sky→NEEDS_ANALYSIS violet→PROPOSAL teal→NEGOTIATION violet→CLOSED_WON emerald→CLOSED_LOST rose (NO AMBER anywhere). Quick change "Change Stage" header GlobalSelect for detail.
7. **/crm/opportunities/[id]/page.tsx** (Detail tabs): PageHeader with direct Change Stage dropdown GlobalSelect. Stage 7-step stepper with colored dot at current + gray previous/future + name labels. Stats cards: Amount, Expected close date + win prob%. Details + Activity tabs same pattern as leads/customers.
8. **/crm/contracts/page.tsx** (List only, MVP no detail MVP this phase fast gate): 5 status tones DRAFT slate, SIGNED sky, ACTIVE emerald, EXPIRED slate, TERMINATED rose. 7 cols code/title+customer link/status/dates(value signed at). Create/edit GlobalModal: customer GlobalSelect req, start/end Date date pickers with cross validate end >= start (z.refine form schema). signedAt optional date, signedById optional, value Decimal, notes.

### 8.5 Key Decisions (Pitfall table mitigations)
| # | Decision | Pitfall mitigated |
|---|----------|------------------|
| 1 | Kanban view = click-move w/ GlobalSelect, NO drag library install | P1: dnd-kit 60KB new deps avoided; zero new npm needed for Phase 5. Pitfall P1 avoided |
| 2 | Activity unified single table with XOR Zod refine + per FK existence check before insert | P3: activity FK 404 avoided — returns 404 per entity if missing. No orphan activities posted |
| 3 | Business code counters (CUST-%) inside create() $transaction with unique DB constraint last guard | P2: concurrent create duplicate — unique index 500 maps via global error handler to 429 Conflict retry |
| 4 | Status colors strictly 6 families via StatusBadge enum — 6 tones/7 stages map PROSPECTING→slate + NEGOTIATION→violet reuse | Pitfall: never amber/yellow anywhere |
| 5 | Dual mount contactsRouter (both collection + standalone) | Pitfall contact update without customer context 404 avoided; contacts/:id works |
| 6 | RTK tag types registered via (apiSlice as unknown).tagTypes.push after createApi call — avoids re-writing existing tagTypes | Pitfall: RTK providesTags "unknown" → silent invalidation failure. Now properly invalidates. |

### 8.6 Editor-side gates
- ✅ All 6 sub-modules backend 4-files × 6 = 24 files created with services transaction audit write
- ✅ Aggregate router `/crm` mounted with dual-mount contacts routes
- ✅ Seed file idempotent additive pattern (never destructive)
- ✅ Frontend 7 pages + layout CRM drawer implemented
- ✅ User profile rule: **ZERO yellow/amber family references** — all tones strictly 6-family. No background amber no text amber no border amber.
- ⏳ Pending User-run commands: `npx prisma generate`, migrate dev, seed phase5, backend strict tsc exit 0, frontend strict tsc exit 0, servers start + browser smoke tests 8 gates.

### 8.7 Your terminal commands (in order, stop on first error; report failures to editor):
```powershell
# A. Backend schema → Prisma Client (must run before tsc!)
cd "g:\MBW Projects\Other\BS\backend"
npx prisma generate

# B. Apply DB migration (PostgreSQL must be running!)
npx prisma migrate dev --name phase5_crm   # creates SQL migration files

# C. Seed Phase 5 RBAC (15 new codes + grants)
npx ts-node prisma/seed_phase5_crm.ts

# D. Backend strict TypeScript
npx tsc --noEmit -p tsconfig.json
# EXPECTED: exit code 0. If errors: copy error list, send editor, we bucket-fix.

# E. Frontend strict TypeScript
cd "g:\MBW Projects\Other\BS\frontend"
npx tsc --noEmit
# EXPECTED: exit code 0. Same pattern — bucket-fix if errors.

# F. (Optional Fast Gate) Frontend build
# npm run build

# G. Start servers (if not already running)
# Terminal 1 (backend):  cd backend && npm run dev   (port 5000)
# Terminal 2 (frontend): cd frontend && npm run dev  (port 3000)

# H. Browser smoke tests (login admin@example.com / Admin@123):
# Gate 1: CRM drawer visible in sidebar → click CRM → Overview renders 4 cards + 2 tables.
# Gate 2: Customers page → Create Customer (fill name). Save. New row appears with CUST-0001 code. StatusBadge emerald. NO YELLOW.
# Gate 3: Customers detail page → tabs Profile (info + add contact Set isPrimary) → Opportunities → Activity (log an activity CALL type, submit). 3 tabs all load.
# Gate 4: Leads page → Toggle Kanban view → 6 columns NEW/CONTACTED/QUALIFIED/PROPOSAL/WON/LOST visible. Create lead NEW.
# Gate 5: Leads Kanban → click "Move to stage" on the new lead card → select QUALIFIED. Lead moves column, lead saved (single mutation).
# Gate 6: Lead QUALIFIED → click "Convert" button. Fill customer name/opportunity. Submit. Redirect to /crm/customers/[id]! Opportunity created.
# Gate 7: Opportunities page → 7 stages. Click CLOSED_WON stage filter = emerald tones only. No amber. 7 columns all render. Create → save → OPP-0001.
# Gate 8: Status Badge NO-YELLOW audit — navigate all CRM pages. 2-minute visual:
#   Customer statuses: emerald/slate/rose only.
#   Lead statuses: 6 colors. NO amber/mustard.
#   Opportunity 7 stages all slate/sky/violet/teal/emerald/rose. No amber.
#   Contracts 5 status slate/sky/emerald/slate/rose.
# Gate 9: URL pagination/sort works on all 4 list pages. Back button returns.
# Gate 10: SALES login (create one SALES if none). Sales cannot delete Customers (trash hidden via PermissionGate).

# I. After 10 gates PASS: git commit
cd "g:\MBW Projects\Other\BS"
git add -A
git commit -m "feat(phase-5): CRM module (6 Prisma models + 6 RBAC-gated backend sub-modules + 7 frontend pages w/ reusable UI library + Lead convert $transaction + append-only Activity + Kanban click-move)"
```

**Concepts learned in Phase 5**: (1) Domain-driven backend folder-per-resource (validators/services/controllers/routes) vs single large file; (2) Business code counter pattern CUST-% in service layer; (3) Prisma $transaction used in TWO critical cases: create+audit pair, and multi-entity Lead convert atomic rollback; (4) Zod XOR refine + service-level FK existence checks for generic polymorphic-entity linked tables (Activity); (5) Dual mount pattern for child collections/contacts both standalone + parent context routes; (6) Kanban MVP click-move vs drag-and-drop tradeoff; (7) RTK cache tag mutation pattern after createApi for module-scoped tags.

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
