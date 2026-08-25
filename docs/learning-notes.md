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

## Phase 2 — Authentication & Token Refresh

### Mistakes during implementation:
1. **TypeScript strict mode on frontend — 11 errors caught at tsc time (not at runtime)**: Strict mode is worth the extra time. Three recurring categories caused 9 of 11 errors:
   a. **`'name' specified more than once` TS2783 × 6 instances:** When using React Hook Form `register()` spread, the spread already provides `name, id, onChange, onBlur, ref`. If you ALSO pass an explicit `name="password"` prop, TypeScript complains (correctly) that the later spread overwrites your earlier value. This was a copy-paste error when composing forms — copy/pasted explicit `name=` from a non-RHF version alongside the RHF spread. *Fix pattern:* When using `{...register(field)}`, never pass `name=`, `id=`, `onChange=`, `onBlur=`, or `ref=` explicitly — the spread handles all of them.
   b. **RTK Query `.error` union type is `FetchBaseQueryError | SerializedError`**. `SerializedError` (serialized by RTK internally for redux devtools) has no `.status` field. If you do `const s = error.status` without narrowing, TS strict complains. *Fix pattern:* cast `(rtkError as { status?: number | string }).status` + compare both numeric and string literals (`status === 429 || status === "429"`), or write a helper `isFetchBaseQueryError(err): err is FetchBaseQueryError { return 'status' in err; }` type-guard.
   c. **Imported `DashboardIcon` from lucide-react, but it doesn't exist.** This is a documentation issue in lucide-react — some answers on Stack Overflow refer to `DashboardIcon` from a major version ago. The actual icon is `LayoutDashboard` (which we already imported for the sidebar nav). *Lesson:* always try to find similar icons already imported elsewhere before guessing icon names from memory.
2. **Frontend tsconfig `include:` contained `.next/types/**/*.ts` by default from `create-next-app` template.** When you run `npx tsc --noEmit` standalone (not via `next dev` or `next build`), tsc walks ALL `.next/types/**/*.ts` files including Next's route validator. Since our App Router uses **route groups** — `(public)/page.tsx`, `(auth)/login/page.tsx`, `(dashboard)/dashboard/page.tsx` — there is no flat `app/page.tsx`; the root marketing `/` URL is actually handled by `app/(public)/page.tsx`. Next's own `next dev` pipeline correctly resolves this via the next TypeScript plugin, but standalone `tsc` reads `.next/types/validator.ts:42` which statically references `../../src/app/page.js` and produces a bogus `TS2307 Cannot find module '../../src/app/page.js'` error. *Fix:* remove `.next/types` and `.next/dev/types` from `include`, add `.next` straight to `exclude`. This lets standalone `npx tsc --noEmit` (our goto for quick strict checks) only scan our actual source files. Next dev/build still works — it uses the `next` plugin in `tsconfig.compilerOptions.plugins` internally and has its own compiler pipeline; the `include/exclude` only impacts standalone tsc runs.
3. **AuthHydrationProvider initial draft had a dead custom hook `useHydrateAuth` that referenced `useAppSelector.getState` as a property (WRONG).** Dead scaffolding code from copy-pasting. Redux `useAppSelector` is a hook-FUNCTION, not an object with `.getState` (`.getState` is a store method, `store.getState()`). Strict TypeScript correctly rejected it. Fix: **delete dead code entirely** — all redirect logic was already correctly implemented inline in the main AuthHydrationProvider component via `const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated)` selectors inside useEffects.
4. **Standalone `ts-node` scripts (seed.ts, add_stock_checks.ts) that import from `@/lib/prisma` → `-r tsconfig-paths/register` required.** If you forget -r, Node can't resolve `@/` aliases (ts-paths sets global require hooks). We avoided this in Phase 2 seed by using relative imports `../src/lib/prisma` instead of `@/lib/prisma` inside seed scripts. Good teaching pattern for seed scripts that may be run without tsconfig-paths installed.
5. **Prisma `validate()` middleware call shape mismatch (caught in backend phase 2b):** auth routes were passing `validate(LoginSchema)` (flat ZodObject), but the `validate()` middleware we wrote expects `{ body?: Zod, query?: Zod, params?: Zod }` shape. Controllers were written assuming the flat form works — this surfaced during tsc. *Fix:* Wrapped all route validators as `validate({body: LoginSchema})`, `validate({body: ForgotPasswordSchema})`, etc. *Lesson:* always write small type tests of middleware signatures immediately after writing middleware, before attaching to 10 routes that all need rewrite.
6. **`z.nativeEnum(RoleType)` in jwt.ts threw runtime error "RoleType is not defined"** — wait no, it threw a TypeScript error, not runtime, because we had written `import type { RoleType } from "@prisma/client"` (`import type`). `z.nativeEnum()` needs the *actual runtime JavaScript enum value* (Prisma exports it as real value, not just type). Fix: change to plain value import `import { RoleType }`. This is a common footgun with Prisma native enums in Zod nativeEnum.

### Key decisions:
1. **Split Token Storage (the biggest security decision of Phase 2)**: Access tokens in volatile Redux memory only → close tab = access token dead. Refresh tokens ONLY as HttpOnly Secure SameSite=Lax cookies → document.cookie CANNOT read them. This is the industry-standard model (RFC 6749 Bearer + refresh pattern with JS-inaccessible cookie). Protects against XSS: if a malicious npm package runs in the browser context, it can read localStorage (so localStorage access token = theft permanent, 7 days refresh), but it CANNOT read the HttpOnly refresh cookie. It CAN still make API requests using the cookie (SameSite=Lax reduces this to top-level navigations only).
2. **Refresh token rotation + reuse detection (family revocation) instead of simple one-refresh**: Each `/auth/refresh` exchange:
   - Finds DB row by jti
   - Checks if `isUsed` (if yes → ATTACK → all rows in same `familyId` → `isFamilyRevoked=true`)
   - Marks row `isUsed=true`, `usedAt=now`
   - Issues NEW refresh JWT with NEW jti, SAME familyId
   Why this pattern: If attacker steals an old refresh cookie value (MITM in coffee shop, old backup, etc.) and replays it AFTER the user has already rotated past it → reuse detection fires → attacker AND user both logged out. User logs back in with new creds, gets NEW familyId, attacker's old stolen token now hits `Session revoked` because the family was revoked. If we simply revoked old tokens without family tracking, the attacker could replay tokens independently.
3. **baseQueryWithReauth mutex singleton (async-mutex 0.5.0)**: This solves a *real bug*, not a hypothetical. Imagine the dashboard mounts with 6 widgets, each firing an RTK query. Access token has EXACTLY just expired. All 6 return 401 in parallel. Without a mutex, RTK dispatches 6 simultaneous `/auth/refresh` requests. Backend processes them. First one marks jti as isUsed. Other 5 find `isUsed=true` → reuse detection fires → `family revoked` → the USER IS LOGGED OUT WRONGLY (this is a bug you'd see in prod about once a day during access token expiry minute, extremely hard to debug). Mutex: `refreshMutex.runExclusive(async () => ...)` serializes these into EXACTLY 1 refresh; after success, all 6 original requests retry with the NEW access token. This is the OFFICIAL RTK Query recommended pattern. `async-mutex` is a tiny package (single file implementation, no transitive deps).
4. **Anti-enumeration as a FIRST-class implementation, not an afterthought**:
   - Login: identical error message string "Invalid email or password." for wrong email, wrong password, disabled account.
   - bcrypt dummy compare when user-not-found. *Why timing attack matters:* bcrypt.compare ~100ms. If user-not-found branch returns immediately (0ms), attacker can measure: >50ms means account EXISTS, <5ms means NO account. DUMMY_HASH constant-time compare evens the timing to ~100ms regardless of existence.
   - `POST /forgot-password` ALWAYS returns 200 success envelope regardless of email. This is the strictest option (even Slack leaks "if we found your account we sent an email").
5. **Password strength regex IDENTICAL on front + back Zod validators, not slightly different**: Prevents insidious bugs where "backend rejects this password because it lacks a special character, but frontend showed all 4 strength bars green". Same regex copy-pasted to both validators.ts files.
6. **Seed admin MUST CHANGE PASSWORD on first login**: `User.mustChangePassword = true` default. Frontend checks `authSlice.forceChangePassword` on mount (from me query). If true AND NOT on `/change-password` → router.redirect. Backend ChangePassword endpoint flips `mustChangePassword=false` after validating current password matches AND new password passes strength regex. This ensures local devs never ship to prod with default seed password `Admin@123` in a real user record.
7. **Refresh failure → clear cookie on response**: controllers.ts `refresh()` wraps service call in try/catch. On catch: `res.cookie(REFRESH_COOKIE_NAME, "", CLEAR_REFRESH_COOKIE_OPTIONS)` before re-throwing. This is critical because: user runs seed-script (change password → logout everywhere → all refresh tokens revoked). Browser still has the OLD HttpOnly cookie, and subsequent refreshes keep hitting "Session revoked" error (we saw this exact error in the backend log at 18:37:02!). After this fix: FIRST hydration hit with stale cookie → 401 + cookie cleared → SECOND page reload → NO cookie sent → silent return (no spurious backend error). Browser is now in clean state for manual login.
8. **Frontend skip silent refresh on public auth pages** (`/login`, `/forgot-password`, `/reset-password`): When a first-time visitor hits `/login`, no cookie is set. They DON'T need silent hydration. The public auth pages just want to render forms. Skipping refresh: no spurious 401 in backend logs, one less round trip, no cookie present issues (browser first visit empty cookie handled cleanly).

### Interview takeaways:
1. *"Explain your JWT architecture. Where do you store tokens?"* → **Split Token Storage answer**: Access token (short 15m) in Redux in-memory only (never localStorage). Refresh token (7-day) ONLY as HttpOnly Secure SameSite=Lax cookie, SHA-256 hashed in DB (never plaintext). Why not localStorage refresh? XSS = permanent theft. Why not access token in cookie? CORS preflight complexity, harder to use Bearer schema with Postman, would need CSRF tokens for POSTs. Why HttpOnly + SameSite + Secure? HttpOnly = JS can't read. Secure = only over HTTPS (set to secure in production env). SameSite=Lax = balance between CSRF protection and usability (strict breaks POST redirects back from external SSO providers).
2. *"How do refresh token rotation and reuse detection work? Why not just long-lived access tokens?"* → Long-lived = single stolen token = 30 days access. Rotation = every refresh invalidates previous. Reuse detection: each token has familyId. If OLD token replayed after already rotated → mark entire FAMILY revoked (both attacker & user logged out; user logs back in → new family, attacker stuck). Explain jti vs familyId distinction clearly.
3. *"What steps prevent an attacker from enumerating which emails are registered in your system?"* → (1) Verbatim same error string for bad email and bad password. (2) bcrypt.compare dummy hash when user not found → ~100ms response regardless. (3) Forgot-password endpoint ALWAYS returns 200 success, regardless of email. Explain *why constant timing matters* — attacker can differentiate by response time.
4. *"Why a mutex around token refresh in the RTK client? What's the bug without it?"* → Simulate N parallel 401s at exactly the moment access token expires. Without mutex → N parallel POST /refresh calls. First succeeds; others hit reuse detection (they all carry the same old jti) → family revoked → user WRONGLY logged out by their own app. This is a production-class intermittent bug. Async-mutex singleton pattern (official RTK guide) serializes those N calls into exactly 1 refresh.
5. *"What happens when I hit 'change password' or 'reset password' on ALL my devices?"* → Both endpoints run in ONE Prisma $transaction: (a) flip reset token usedAt / validate current pw, (b) update user passwordHash + flip mustChangePassword=false (change pw only), (c) BULK revoke ALL user's existing RefreshToken rows → set revokedAt or isFamilyRevoked. Result: ALL logged-in devices (laptop, phone, old coffee shop session) are logged out globally; only the current device (who just changed password) gets a new cookie from the response (we actually log out EVERYONE including current device as stricter policy).
6. *"What's bcrypt cost factor, and why did you pick 10?"* → Cost is exponent: 2^cost rounds. 10 = ~1024 rounds = ~100ms on modern CPUs. Too low (4-5) → too fast, attacker with stolen hash can GPU crack 40 billion/s. Too high (15) → every login/register takes 20+ seconds DoS. 10 is OWASP 2026-recommended default for Node.js servers for "interactive user login, no offline cracking service".
7. *"Why SHA-256 for refresh/reset storage, not plaintext? Why not just bcrypt them too?"* → SHA-256 = fast (no cost factor). Refresh tokens are HIGH ENTROPY random UUIDs (2^128 bits) → no dictionary brute feasible; they're already unguessable. No need for slow bcrypt here — you'd just slow down every /auth/refresh endpoint. Passwords = LOW ENTROPY human input (dict attack) → NEED slow bcrypt. Refresh tokens = cryptographically random 128-bit jti → no dict attack → SHA-256 sufficient, fast, no slowness downside.
8. *"What's the difference between SameSite=Strict, Lax, None? Why Lax?"* → Strict = cookie NEVER sent cross-site (even from bank.com clicking your-site.com link → no cookie sent → user appears logged out, poor UX). Lax = cookie sent on TOP-LEVEL navigation from external site (standard clicking link behavior), but not on embedded iframe/form POSTs. Good balance: prevents CSRF POST forms from attacker.com while not breaking click-through login flows. None = always sent cross-site, requires Secure=true, use ONLY for third-party embedded widgets. We use Lax.
9. *"Why Path=/api/v1/auth on the refresh cookie?"* → Narrow path scope reduces surface area: by default, browsers attach cookies to EVERY request to localhost. If Path=/api/v1/auth, browser only sends cookie to /api/v1/auth/refresh, /api/v1/auth/login, /api/v1/auth/logout. It's NOT sent to GET /api/v1/products, POST /api/v1/customers. So even on a CSRF-style cross-site form, browser won't attach refresh cookie to non-auth endpoints. Defense in depth: SameSite=Lax + narrowly scoped Path.

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
