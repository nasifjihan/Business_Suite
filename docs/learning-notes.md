# Learning Notes — Business Suite

> Updated after every phase. An engineering journal of decisions, mistakes, trade-offs, and "what I'd do differently next time."

---

## Pre-Phase 0 Decisions (Made Before Writing Code)

### 1. Next.js + Express vs T3 Stack (Create-T3-App)
The T3 Stack is amazing (Next.js + tRPC + Prisma + NextAuth + Tailwind). Why we chose Next.js + Express separate:
- **Teaching goal #1**: Learn REST API lifecycle, middleware ordering, typed error classes, envelope responses. tRPC abstracts HTTP away entirely — great for prod speed, bad for demonstrating you understand how HTTP actually works in interviews.
- **Portfolio narrative**: An interviewer sees "Express API" + "separate deployment" and pictures you working on a team where the backend is a different codebase owned by different engineers. That's the majority of real-world mid-size+ companies.
- If I were starting a startup side project and cared about DX over teaching, I'd pick T3. Portfolio/demonstration → Next+Express was correct.

### 2. PostgreSQL 18 by User Choice
Spec was written targeting PG16. User installed 18.6 latest stable. This is FINE. Prisma fully supports PG 18. Features we don't use but may mention in interviews:
- PG 18: faster `EXPLAIN` output, incremental sort, compression improvements
- PG 16+ features we DO rely on: logical replication improvements, performance on large IN clauses

### 3. Package Manager: NPM
Monorepo would lean pnpm for strict workspace linking and dedupe speed. But 2 separate package.json files in 2 folders is the simplest structure. NPM ships with Node.js — zero installation. Yarn classic has compatibility issues with some native modules on Windows. Bun is fast but Node.js LTS ecosystem (Prisma, Playwright) explicitly tests against Node first, Bun second. So npm is safest for teaching without module bugs.

### 4. No Dark Mode in V1
Tailwind supports class-based dark mode easily; shadcn/ui ships dark mode tokens. Why skip? Because the spec said to avoid high-saturation mustard colors, not explicitly ask for dark mode. Dark mode doubles component testing (both themes) without adding functionality. Adding dark mode later is a 1-hour refactor (CSS vars only, no JS logic).

### 5. No Real Product Image Upload (V1)
Product `imageUrl` stores a string URL. Images are AI-generated via the spec's image endpoint URL at seed time. Why no upload?
- File uploads bring scope creep: file validation (MIME type sniffing, size limits), antivirus scan on upload, S3-compatible storage bucket, thumbnail generation, CORS for direct upload presigned URLs, deletion cleanup, GDPR data access/download/delete compliance for uploaded PII.
- In an interview: "Out of scope for V1 per spec section 2 'no complex features'. If I were to add it, I'd use S3-compatible object storage (Cloudflare R2 = egress-free) with presigned PUT URLs so the upload never hits our Express server (no memory bloat from large files). Multer for direct upload only as a last resort."

### 6. Email / Forgot Password: SMTP Optional, Not Required
The auth API endpoints exist (POST /forgot-password, POST /reset-password) but without SMTP env vars configured, they return success silently without sending mail (good for dev & demo). In an interview: "I integrated NodeMailer but made SMTP env vars optional so the app is runnable without a SendGrid/Mailgun account. For production, I'd configure a transactional email provider and add a rate limit + audit log on password resets."

---

## Phase 0 — Skeleton: Lessons Learned

### Mistakes during implementation:
1. **No real mistakes — this was documentation and file creation, pure plumbing.** Plan for Phase 0 is straightforward once the spec defines the folder tree in Section 6. The work was adapting that spec into files.

### Interview-friendly takeaways from this phase:
1. A good .gitignore + README **is the very first commit**, before `npm install` is ever run. Prevents accidental secret/node_modules commits. On a real team, onboarding starts with git clone → npm install, not the other way around.
2. **Route group naming (parentheses folders in Next.js) is worth planning before `create-next-app` runs. Renaming folders *after* importing causes import paths to break.
3. **The planning-to-coding ratio on a well-scoped enterprise project is surprisingly high.** Phase 0 is 100% planning/docs + 0% runtime code. You never regret writing documentation for large systems (a lesson I took me took less).
4. BUILD_PROCESS.md is unusual in real dev teams but invaluable for a solo portfolio project — future employers love to see because it proves you think ahead of "thought out loud".

---

## Phase 1 — Core Shells: Lessons Learned

### Mistakes during implementation:
1. **Prisma 7 major breaking changes caught us off-guard THREE times.**
   - Prisma 7.9.1 (latest stable) removed:
     a. `datasource url = env("DATABASE_URL")` inline in schema.prisma → must live in `prisma.config.ts`
     b. `@@check` native CHECK constraint syntax in schema.prisma (feature may re-appear later; we worked around by running ALTER TABLE SQL via ts-node script)
     c. **MOST IMPORTANTLY: The native Rust/Go postgres drivers were REMOVED entirely.** Every connection now requires a JS driver adapter: `@prisma/adapter-pg` + `pg` node-postgres package. `new PrismaClient()` with zero args now throws `PrismaClient was instantiated without any options — a driver adapter is required`.
   - We considered downgrading to Prisma 6.19.3 (LTS) but user chose **Option B** — stay on Prisma 7 and learn the new architecture. This was the right teaching choice: Prisma 7 is what teams will migrate to in 2026.
2. **Prisma 7 relationship validation is strict on BOTH sides of a relation.** Four groups of issues surfaced: User↔Employee inverse incorrectly configured, Order↔Warehouse missing inverse, Department↔Designation missing inverse, Employee self-relation missing relation name on the manager FK side. Fix pattern: every `@relation(fields:[fk], references:[id])` owning side MUST have a matching `inverseField: Model[]` (or `Model?` for 1:1) on the OTHER side with the SAME relation name string (for self-refs).
3. **Postgres `$queryRaw` column name quoting:** `Stock.reservedQuantity` (camelCase Prisma field with no `@map`/`@@map`) maps to PG `"reservedQuantity"` (double-quoted). Raw SQL with unquoted `reserved_quantity` fails with "column does not exist". Rule of thumb for raw SQL on Prisma tables: If schema didn't snake_case it, quote the camelCase name when writing SQL manually.

### Key decisions:
1. **Prisma 7 driver adapter singleton pattern (src/lib/prisma.ts):** `new Pool({ connectionString })` + `new PrismaPg(pool)` → `new PrismaClient({ adapter })`. Wrapped with the globalThis cache pattern to prevent ts-node-dev connection leaks. All code paths (app.ts, seed.ts, add_stock_checks.ts, tests) import `from "@/lib/prisma"` — never instantiate PrismaClient inline (that would spawn 2 pools).
2. **Fail-fast Zod env validation imported FIRST in server.ts:** `import "./config/env"` runs BEFORE Express even starts. If DATABASE_URL, JWT secrets, ports are missing/invalid the process DIES with a colored bullet list of issues instead of letting undefined leak.
3. **Standard 7 middleware ORDER in app.ts is NON-NEGOTIABLE:** helmet(1) → cors(2) → compression(3) → json + cookieParser(4) → rateLimit(5) → auditLogger(6) → routes(7) → notFound → errorHandler(LAST!). Interviewer favorite: "Why is errorHandler last?" Because it's the catch-all after ALL layers have run.
4. **Response envelope strictly enforced by library functions** `successResponse<T>` / `errorResponse` in src/lib/response.ts. Controllers NEVER do `res.json({ whatever })` — envelope structure is the same on every endpoint, RTK query code only needs one unwrap path.
5. **Typed error class hierarchy:** BadRequestError / UnauthorizedError / ForbiddenError / NotFoundError / ConflictError / UnprocessableEntityError / TooManyRequestsError all extend AppError. errorHandler catches these and maps HTTP status codes. Controllers/services ONLY throw typed classes, never strings or raw Error().
6. **Next.js frontend store pattern:** `StoreProvider.tsx` as a thin `'use client'` wrapper that the root Server Component layout can import without blowing up. This is the only correct Next.js App Router way to wrap a Redux Provider.
7. **Route groups (parentheses folders):** src/app/(public), (auth), (dashboard). Public has marketing navbar, auth has centered card, dashboard has collapsible sidebar. These share layouts but do NOT create URL segments — health-test URL is clean `/dashboard/health-test`, not `/(dashboard)/health-test`.

### Interview takeaways:
1. *"What was the hardest part of Phase 1?"* → Configuring Prisma 7 without its native driver. The community hasn't 100% migrated yet, so Stack Overflow answers are mixed between 6.x and 7.x. Fixing that taught me the value of reading the actual migration guide instead of copying examples.
2. *"Walk me through the Express middleware stack."* → (Answer in order: 1-helmet, 2-cors, 3-compression, 4-parsers, 5-rateLimit, 6-auditLogger, 7-routes → notFound → errorHandler LAST. Reasoning for each placement.)
3. *"What's the difference between Prisma migrate dev, migrate deploy, and db push?"* → (Standard answer per BUILD_PROCESS.md answer key).
4. *"Why a typed error hierarchy instead of throwing strings?"* → Centralized envelope + status code mapping, consistent error codes client-side, IDE autocomplete on error classes, no random ad-hoc status codes scattered in controllers.
5. *"Explain StoreProvider.tsx — why not put <Provider> directly in root layout.tsx?"* → layout.tsx is a Server Component (no hooks, no context). Provider needs 'use client'. Wrap in a small 'use client' file = best of both worlds: server-side metadata rendering + client-side Redux.

---

## Phase 2 — Auth

*(per-phase template — filled in AFTER each phase)*
### Mistakes:
1. _

### Key decisions:
1. _

### Interview takeaways:
1. _

---

## Phase 3 — RBAC
_(template repeated per section 32 recaps)_

---

## Phase 4 — Reusable UI & GlobalTable

---

## Phase 5 — CRM

---

## Phase 6 — Inventory

---

## Phase 7 — POS (Critical Transaction)

---

## Phase 8 — HRM

---

## Phase 9 — Dashboard & ECharts

---

## Phase 10 — Hardening

---

## Phase 11 — Testing

---

## Phase 12 — Deployment

---

## Phase 13 — Docker & Nginx

---

## Post-Project Retrospective (After Phase 13)

> Write this on completion: What would you change about the architecture if starting fresh? What was harder than expected? What was easier than expected?
