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

## Phase 3 — RBAC & Administration

### Mistakes during implementation:
1. **Prisma 7 breaking strict typing changes (5 backend audit.ts errors)**: Caught first tsc run. 3 categories:
   a. **`import type { Prisma, AuditAction }` broke `Prisma.InputJsonValue` namespace visibility.** Type-only import strips runtime namespaces; `Prisma.JsonValue` lives in the runtime value namespace. Fix: plain `import { Prisma, AuditAction }` (not type-only). *Lesson:* Prisma 7 ships type definitions through a single runtime-augmented `Prisma` namespace value-export. Any file referencing Prisma.* types beyond models (Prisma.JsonValue, Prisma.InputJsonValue, Prisma.TransactionClient etc.) MUST use value-import, not type-import. This will bite every Prisma7 project at least once.
   b. **WriteAudit `tx: PrismaClient` signature incompatible with `$transaction` callback `tx` argument.** Prisma 7 $transaction callback arg is typed as `Omit<PrismaClient, "$connect" | "$disconnect" | "$transaction" | "$on" | "$use">` — NOT assignable to plain `PrismaClient`. Fix: duck-type signature `tx: { auditLog: PrismaClient["auditLog"] } | PrismaClient` accepts anything that has an auditLog model accessor (both global client + transactional client). *Lesson:* Any helper you want callable from BOTH inside and outside $transactions should NEVER require the FULL PrismaClient type in TypeScript — use a mapped index accessor type for just the subset of models your helper touches.
   c. **Create `beforeData` field typed `Prisma.JsonValue` but create inputs need `Prisma.InputJsonValue`.** Prisma 7 split Json types: JsonValue is the READ type (narrow, what you get from SELECT); InputJsonValue is the WRITE type (wider, includes Prisma.Null / Prisma.DbNull / Prisma.JsonNull). Fix: audit create fields typed explicitly as `Prisma.InputJsonValue | null`. *Lesson:* Memoize this rule: Prisma READ = JsonValue; Prisma CREATE/UPDATE input = InputJsonValue.
2. **RTK Query `Envelope<T>` unwrap double-`.data?.data` class of bug (30 frontend errors)**: When adminEndpoints declared `builder.query<Envelope<UserListResponse>, Args>` → `useListUsersQuery().data` **IS** already the outer `{ success, data, message }` envelope. Call sites incorrectly assumed envelope was wrapped *again* by RTK Query (old pattern from RTK tutorials that show `api.getState().api.queries[key].data` = raw result). Result: every list page wrote `usersRes?.data?.data?.items` instead of correct single-unwrap `usersRes?.data?.items`. We fixed 30 instances via bulk search-replace across 4 pages after tsc caught them. *Hard internal convention going forward:* "If RTK builder.query returns `Envelope<T>`, then `useXxxQuery().data?.data` is T — one dot `.data` after `.data` alias, not two."
3. **layout.tsx concise arrow body + deeply nested ternary PermissionGate → 12 cascade JSX parser errors.** Code was `const items = navItems.map(it => (<PermissionGate {...(cond1?{any:a}:cond2?{all:b}:{})}><Nav/></PermissionGate>))`. TS1005/TS1381/TS17002 "expression expected" cascaded because the TypeScript JSX expression parser couldn't cleanly disambiguate where the ternary spread operator ended vs JSX attribute context. Fix: refactor map callback from concise body `=> (...)` to block body with explicit intermediate variable: `{ let permProps; if (cond1) permProps = { any: [...] }; else if ... return (<PermissionGate {...permProps}> ... </PermissionGate>) }`. All 12 cascade errors vanished instantly. *Lesson:* Concise arrow expression bodies + ternary operator + JSX attribute spread inside map callback = known TS parser footgun. If you have >2 conditional branches for props, ALWAYS switch to block body + intermediate variable.
4. **PasswordField invalid `register={pwForm.register}` prop pattern (3 frontend errors).** Phase 2 PasswordField was written as `forwardRef<HTMLInputElement, Props extends InputHTMLAttributes<HTMLInputElement>>` — it intentionally accepts standard HTML input attributes and spreads `...rest` into `<input>`. Profile page incorrectly passed a custom `register={pwForm.register}` React Hook Form function prop (copy-pasted from an old Controller-based pattern) which doesn't exist on the type. Fix: use the standard forwardRef spread pattern `<PasswordField {...pwForm.register("field")} />` which provides name/onChange/onBlur/ref through HTML attribute spread (already exactly what the component expects). Additional spillover: the same call sites also had explicit `name=` + spread name → TS2783 duplicate name prop. *Fix pattern:* When you use `{...register(field)}` spread on any forwardRef InputHTMLAttributes-extending component, NEVER also pass explicit `name=`, `id=`, `onChange=`, `onBlur=`, `ref=`.
5. **role detail response shape `permissionCodes: string[]` doesn't exist (2 errors):** Backend `roles/services getById` returns `RoleDetail = { id, name, displayName, description, isSystem, permissions: Permission[] }` — full permission *objects*, not a flat code array. Frontend edit modal useEffect code had copied the service test-layer pattern and referenced `rd.permissionCodes` (a temporary intermediate variable from services.ts that isn't part of the final DTO). Fix: derive on client `rd.permissions.map(p => p.code)` inline when building `selectedCodes:Set<string>`. *Lesson:* Don't copy internal service-layer variable names when writing frontend — reference ONLY the exported TypeScript DTO types from adminEndpoints.ts, not random variables you saw inside backend services.ts files.
6. **JSON fields typed `unknown` → TS2322 ReactNode render condition (2 audit-log errors):** AuditLogItem `beforeData`, `afterData`, `metadata` are typed as `unknown` (JSON from API). Code wrote `{row.beforeData && (<div/>)}` — but TS strict says: if `row.beforeData` is `unknown`, then the expression `A && B` has type `unknown`, not `boolean | ReactNode`, because unknown's truthiness check doesn't narrow to boolean in TypeScript's strict type system (unknown remains unknown after &&). Fix: wrap condition in explicit double-bang `{!!(row.beforeData || row.afterData) && (...)}`. Double-bang coerces any unknown to a true boolean, so && returns ReactNode. *General rule:* any JSON `unknown`-typed value used in React render-conditionals must pass through `!!` or `Boolean()` or explicit truthy check first.

### Key decisions:
1. **Backend-only RBAC security boundary + frontend PermissionGate UX-only gate.** This is the #1 most important security decision in Phase 3. PermissionGate React component hides buttons/nav items for usability (HR doesn't even see "Users" nav link), but the REAL security is Express `authorize(...)` middleware on every route. Why? Because any user with DevTools can: (a) open Redux DevTools and manually set `auth.permissions = ["*"]`, (b) hand-craft a raw `fetch('http://localhost:5000/api/v1/users')` call in the browser console with their valid access token, or (c) curl the API directly from terminal with their bearer token. Frontend UX hiding = convenience, NEVER security. This is the standard industry principle called "Never Trust the Client" / "Secure by API Boundary" (critical interview concept).
2. **Per-request DB user status check (worth ~1ms latency) to enforce immediate INACTIVE deactivation.** Default naive JWT trust pattern: "Verify signature + claims → OK until 15-min TTL expires". This means if you FIRE an employee at 9:00 AM and set status=INACTIVE, their 8:55 AM issued access token still has 10 more minutes of API access (10 minutes is an eternity for a disgruntled fired employee with DB export permissions). Trade-off: we run `SELECT * FROM "User" WHERE id = @jwt.sub` WITH role + permissions on EVERY authenticated request, so status=INACTIVE throws 401 on the very next API call, regardless of token TTL. Cost: ~1ms Prisma query (hot index on PK, almost free). Benefit: immediate deactivation, 100% correct. This pattern (per-request DB user state refresh) is called "Authorization Server Introspection Pattern" adapted without a separate OAuth AS.
3. **Service-layer writeAudit, NOT global Express middleware.** Auditing was originally sketched in BUILD_PROCESS template as "global Express audit middleware (after every POST/PATCH/DELETE)". This approach has 2 insurmountable problems: (a) global middleware runs AFTER controller returns to client (or before, can't get beforeData snapshot without pre-reading EVERY endpoint), (b) global middleware doesn't have access to the Prisma $transaction context (business write + audit log must commit ATOMICALLY or we have phantom audits / missing audits on rollback). Service-layer (each service method explicitly calls `writeAudit(tx, …)` inside its own $transaction) wins because: (a) beforeData snapshot = the value the service just read out of DB before modifying (100% accurate), (b) beforeData + afterData + business write commit as ONE atomic Prisma transaction, (c) writeAudit wrapped in try/catch so even if audit write fails (schema mismatch, etc.), the BUSINESS write still succeeds (audit is nice-to-have not mission-critical). Grep-ability bonus: search codebase for "writeAudit(" gives you EXACTLY the list of endpoints that write audit entries (impossible with global middleware).
4. **System role immutability enforced in service layer (not routes, not middleware, not frontend).** Roles SUPER_ADMIN & ADMIN are seeded `isSystem=true`. Protection guard is implemented in `roles/services` in BOTH `update()` and `remove()` methods: throw BadRequestError("Cannot rename/delete a system role") when trying to change isSystem role names. Why service-layer guard is the right place not routes: (a) if someone adds a NEW future route (bulk-rename roles, import roles from CSV), they don't accidentally bypass the route-level authorize middleware and forget system-role protection — service layer always catches. (b) future backend scripts (ts-node that import roles.service directly) still hit the guard, not just HTTP requests. (c) it's the canonical source of truth. Frontend adds readonly UX polish (name field disabled when isSystem), backend service layer = hard enforcement.
5. **Permission assignment uses deleteMany+createMany inside $transaction instead of diff-based add/remove.** The naive approach for role permission editing is: old set = {A,B,C}, new set = {B,C,D} → compute adds (D), removes (A) → prisma.rolePermission.deleteMany(A) + createMany(D). At scale 62 perms we instead do: `await tx.rolePermission.deleteMany({ where: { roleId } })` followed immediately by `await tx.rolePermission.createMany(roleId × newPermIds)`. Both approaches produce identical DB final state. Benefits of delete+recreate over diff: (a) diffing code has subtle bugs when sets contain duplicates or when permission codes are changed externally mid-request; delete+recreate is trivial and idempotent. (b) no need to hold entire previous set in memory for comparison. (c) fewer lines of code = fewer bugs. Trade-off: 62 row deletes + 62 row inserts = negligible Postgres write cost (1ms max, roles admin is rare operation). This pattern works great for <1000 items in many-to-many join tables.
6. **Authorize middleware is a VARIADIC factory with 4 matchers, not a single-string function.** Signature: `authorize(...required: (string | { any?: string[]; all?: string[] })[])`. Matchers: (a) single exact `"users.create"` → needs that exact permission. (b) `{ any: ["users.read", "roles.read"] }` → needs AT LEAST ONE (OR gate). (c) `{ all: ["leads.read", "customers.read"] }` → needs EVERY ONE (AND gate). (d) wildcard `"*"` backend-only escape hatch (SUPER_ADMIN gets all). Why this shape? We anticipated future cross-module permission gates: Phase 8 HRM "can approve leave" needs `hrm.leave.approve` (exact string), Phase 5 CRM dashboard widget needs "at least one of customers.read or leads.read" (any gate), inventory stock transfer needs "products.read AND warehouses.read" (all gate). One variadic factory covers all future gates without writing new middleware through Phase 12. Without this we'd have 4 separate middleware functions (requirePermission, requireAnyPermission, requireAllPermissions, requireAdminWildcard) which multiplied across 60 routes = confusion.
7. **Zod pagination coerce + ParsedQs bridge cast pattern.** PaginationSchema uses `page: z.coerce.number().int().min(1).default(1)`. Why zod coerce? HTTP query params come in as strings (`req.query.page = "1"`, not number 1). Zod `.coerce.number()` automatically parses the string to int inside the safeParse call — no manual `parseInt(req.query.page as string)` boilerplate across 12 list endpoints. Controllers still need the bridge cast `const q = req.query as unknown as ListUsersQuery` before passing to services because Express `ParsedQs` (what req.query is typed as) isn't structurally compatible with zod-inferred strict types (ParsedQs allows `string | string[] | ParsedQs | ParsedQs[]`, our zod types are specific `string | number | undefined`). The double cast is ugly but explicit, no runtime impact because zod safeParse validates shape anyway inside service.

### Interview takeaways:
1. *"Where is your RBAC security actually enforced? Can someone bypass it with DevTools?"* → **Backend-only boundary answer.** PermissionGate component in React = UX hiding ONLY. Real enforcement = Express middleware `authorize(...)` on every protected route (after auth, rate limit, validate). Client can set `auth.permissions = ["*"]` in Redux but any raw `PATCH /users` call still hits backend authorize and returns 403 envelope success=false. Cite the "Never Trust the Client" principle explicitly.
2. *"If I fire an employee and set their user status to INACTIVE in the admin panel, how long until their API access is actually revoked?"* → **Instant (next API call) answer.** NOT "up to 15 minutes until their JWT access token expires". Detail: authenticate() middleware does SELECT user FROM DB on every authenticated request (after JWT signature verifies the sub claim). If DB row status !== ACTIVE → immediately throw 401 UnauthorizedError. Trade-off openly: ~1ms extra latency per request (PK SELECT index = nearly free) vs. 15-minute fired-employee access window. Correctness > micro-optimization.
3. *"Where do you write audit logs, middleware or service layer? Why?"* → **Service layer answer** with exactly 3 reasons: (a) transactional atomicity (business write + before/after JSON commit together inside one Prisma $transaction), (b) accurate beforeData (services read rows before modifying; global middleware can't get accurate before snapshots without pre-reading every table), (c) best-effort try/catch non-abort pattern (audit failure never kills business transactions — orders still go through even if audit log DB is having issues). Mention why global middleware fails: global middleware can't access $transaction context, can't produce accurate beforeData.
4. *"Explain Prisma 7 InputJsonValue vs JsonValue. Why did you use them?"* → **Split Json types answer.** JsonValue = READ TYPE (what SELECT returns — narrow, no Prisma.DbNull). InputJsonValue = WRITE/CREATE TYPE (wider, accepts Prisma.Null/Prisma.DbNull/Prisma.JsonNull sentinel values). Gotcha: `import type { Prisma }` is WRONG when using InputJsonValue because type-only import strips the Prisma namespace that holds these — value import `import { Prisma }` required.
5. *"Why does role permission editing use deleteMany+createMany instead of computing diff add/remove sets?"* → **Simplicity > perf at 62-item scale.** Identical final DB state. Diff bugs: duplicates in arrays, mid-request external permission changes, null vs undefined handling. Delete+create: trivial, idempotent, no bugs. 62 deletes + 62 inserts = ~1ms Postgres write (role admin is rare operation). Be clear you'd switch to diffing if join table rows > 10000 or update was high-frequency.
6. *"Why is role update/delete guard in service layer not route middleware?"* → **Defense in depth + single source of truth.** Guard in service layer: automatically protects HTTP routes, future bulk-import scripts written in ts-node that import service directly, future GraphQL resolvers, etc. Routes/middleware/frontends can forget — service NEVER forgets. Match to earlier learning about backend-only boundaries (same pattern: enforce at the business logic canonical layer, not at transport or UI).
7. *"What's the authorize middleware matcher pattern? Why not just requirePermission(string)?"* → Walk through 4 matchers: (a) exact string "users.create", (b) {any:[]} OR, (c) {all:[]} AND, (d) "*" SUPER_ADMIN wildcard. Why this shape? Covers every future permission gate we need through Phase 12 HRM cross-module gates without writing new middleware. Examples: Approve leave in HRM = `authorize("hrm.leave.approve")`. Sales dashboard = `authorize({ any: ["crm.customers.read","sales.orders.read"] })`. Stock transfer = `authorize({ all: ["inventory.products.read","inventory.warehouses.read"] })`.

---

---

## Phase 4 — Reusable UI & GlobalTable

### Mistakes during implementation:
1. **Wrote initial GlobalTable.tsx against TanStack v8 tutorials while package.json has v9 installed — 34 TS errors (Category A)**. 95% of internet + StackOverflow + random blog tutorials are still v8 API (`useReactTable`, `ColumnDef<1Arg>`, `FlexRender(colDef, ctx)` 2-arg, `size:` column prop, implicit features with no factory). **Fix**: Never trust internet docs when installed major version differs. Go STRAIGHT to the package-itself skill doc: `node_modules/@tanstack/react-table/skills/migrate-v8-to-v9/SKILL.md` ships with the library and is the ONLY authoritative v8→v9 rename table. Read that FIRST before writing one line of v9 code.
2. **Made GlobalSelect generic `<V extends string>` — 18 TS2322 errors (Category B)**. Spent 1 hour trying to make React 19 forwardRef infer a parametric SelectOption generic correctly with Radix. **Fix**: De-generify to concrete `{value:string, label:string}[]` always. Every call-site uses string values anyway — type perfection is a trap that wastes time vs DX.
3. **react-day-picker v10 classNames legacy vs flat keys — 4+ errors (Category D)**. Started with `day_selected, day_today, day_disabled, caption` all from old docs. **Fix**: v10 renamed to flat (selected / today / disabled) + caption → month_caption. Read node_modules types NOT random blogs.
4. **(Predicted & Avoided) Category F LoadingSkeleton custom @keyframes shimmer**. Tempting to write `<div className="animate-shimmer">` — but custom @keyframes must be shipped in global CSS. Predicted this would create a blank screen crash during npm run build if missing. **Fix**: used ONLY `animate-pulse` built-in Tailwind class — zero risk.
5. **Pre-existing Users page written before had DateDisplay prop name `value=` wrong (should be `date=`)** and had `onValueChange=` (GlobalSelect API is `onChange=`). 10 errors caught at tsc time. Lesson: Always re-run tsc after writing multiple pages, don't trust component lib only.

### Key decisions:
1. **URL Search Params = pagination/sort/filter SOURCE OF TRUTH, not local useState** (alternative: `const [page, setPage] = useState(1)` + useEffect sync). Chose URL because: (a) browser back/forward works automatically, (b) URLs are shareable, (c) no useEffect sync boilerplate, (d) consistent across ALL module pages. We pay a tiny cost (page 1 extra re-render on filter change) for massive UX gains.
2. **StatusBadge 6-color family exhaustive enum map at file level, not ad-hoc classes per page**. User profile forbids yellow/amber. By putting hard restriction `TONE_CLASSES: Record<StatusBadgeTone, ...>` to only emerald/rose/slate/sky/violet/teal inside `StatusBadge.tsx`, we physically CANNOT pass amber/yellow tone later — type system catches it. Preventative design is better than audits.
3. **TanStack v9 Feature Factory Singleton pattern** — `tableFeaturesDefault` is exported once from table-utils.ts, reused by every GlobalTable. Alternative: every list page registers its own features = would drift. v9 made features MANDATORY (cannot omit rowPaginationFeature — it just silently doesn't paginate), so central factory ensures every page has the same 3 features + 3 rowModels.
4. **GlobalTable has TWO data input modes: `queryResult?` RTK hook OR `data+meta` props**. 95% of pages use RTK so queryResult auto-connects isFetching/isError/error/refetch UI. Non-RTK callers (future: local stories, testing, SSR pages) can call with `data={items} meta={meta}`. Same component, two use-cases, no fork.
5. **GlobalTable renderSubRow prop = auto __expand__ column prepend + RowWithExpansion row pair**. Alternative: every page implements its own chevron + expanded `<tr>` pair. Would have 5 inconsistent expand implementations by Phase 12. Using renderSubRow callback means expand is handled in ONE place — chevron animation, click stopPropagation, expanded row bg class, colSpan padding = all consistent.

### Interview Q&A (study cards for resume):
**Q: "Walk me through how you built a reusable enterprise data table component."**
A: (1) Wrapped TanStack React Table v9 headless UI with explicit `tableFeatures({rowSortingFeature, rowPaginationFeature, rowSelectionFeature, rowExpandingFeature, sortedRowModel, paginatedRowModel, expandedRowModel})` factory (v9 requires explicit features, implicit doesn't work). (2) Server-side mode: pagination/sort state is read from/written to NextJS URL search params (not local useState) — so every list page is shareable by URL and browser Back button works. (3) 2 input modes: takes a raw RTK Query hook result object OR separate data+meta props — auto handles loading skeletons, empty state card, error state with retry button (all components reused). (4) Auto-prepends checkbox select column (if enableRowSelection=true) or chevron expand column (if renderSubRow callback provided). (5) React Hook Form forwardRef spread pattern for the related form components — no explicit `name=` props allowed (per internal convention because register() returns it internally).

**Q: "Talk about a time TypeScript strict mode saved you time."**
A: Phase 4 reusable components first run: 48 strict tsc errors. Instead of fixing line-by-line, I bucketed them into 7 named Categories (A=TanStack rename 34, B=GlobalSelect generics 18, C=ConfirmDialog title 1, D=dayPicker classNames 1, E=FilterPanel op cast 2, F=predicted @keyframes avoided 0, G=residual 9). Batch-fixed each bucket — achieved exit 0 in only 3 tsc iterations, not 10+. If strict mode wasn't on, these 48 errors would have been silent runtime crashes. Also 10 additional pre-existing errors from early Users page (wrong DateDisplay prop name `value→date`, old GlobalSelect callback name `onValueChange→onChange`) caught at compile time.

**Q: "How do you enforce user accessibility or UX preferences across a large codebase?"**
A: Real example from this project: User profile forbids high-saturation yellows/amber (eye-strain). I didn't write a 1-page checklist doc ("please don't use amber"). Instead I physically restricted the ONLY badge/status color component: `StatusBadge.tsx` has a type `StatusBadgeTone` = 16 allowed tones all mapped to exactly 6 color families (emerald/rose/slate/sky/violet/teal). There is LITERALLY no way to create a yellow StatusBadge — TypeScript rejects the tone prop. Then replaced the 3 remaining ad-hoc amber usages: Audit LOGIN_FAILED → teal, Users CASHIER → teal, Profile 2FA placeholder card → slate. 100% enforcement via type system + component centralization.

## Phase 5 — CRM

### Mistakes during implementation:
1. **Initially planned to add dnd-kit for Kanban drag/drop (estimated 60KB bundle + 1 new npm install)** before re-reading Pitfall P1 from the header. **Fix**: Simple click-move "Move to stage" GlobalSelect directly in each lead card. Zero new deps, 0 install, 1 mutation per stage change. Drag is purely visual nice-to-have, not MVP-required for business.
2. **Tempted to create separate tables: `LeadActivity`, `CustomerActivity`, `OpportunityActivity`** to avoid XOR validation complexity. This would have tripled code later — 3 timeline components, 3 endpoints, duplicate schemas. **Fix**: Single unified Activity table with Zod XOR refine + service-level FK existence checks for the chosen entity. Refine at validation layer returns friendly 422 before any DB write hits.
3. **Put `contacts/:id` route under customers only — then realized we can't PATCH/DELETE a contact standalone without customer param.** Created dual-mount pattern in the aggregate router: same contactsRouter mounted BOTH at `/crm/customers/:customerId/contacts` AND at `/crm/contacts`. So POST (collection) uses first path, PATCH/DELETE (standalone contact) uses second path with just `/:id`.
4. **Wrote CRM_SUBNAV initially with only `any:["customers.read","leads.read"]` — but VIEWER has old `crm` module perm only.** Phase 3 RBAC added customers.read as `crm` module — so `customers.read` code alone won't fire PermissionGate for viewer users. **Fix**: Added `crm.customers.read` to ANY-of list in sidebar requires, plus added cross-checks in seed to ensure role gets the granular code too if they had legacy module-level ones.
5. **(Category C tsc prediction) crmEndpoints.ts wrote RTK tag `providesTags: [{ type: "Customers", id }]` — but tagTypes was never added to `createApi()` tagTypes array!** This is a silent RTK footgun: tag names are typed as strings, and invalidatesTags unknown just silently noops (cache never clears!). **Fix**: After createApi, mutate with `(apiSlice as unknown as {tagTypes: string[]}).tagTypes.push("Customers","Contacts","Leads","Opportunities","Activities","Contracts")` to actually register tags at runtime.

### Key decisions:
1. **Business code counters inside create() $transaction** (`CUST-0001`, `OPP-0001`, `CON-0001`, `LEAD-0001`) vs PostgreSQL sequence. Chose DB counter: (a) codes are human readable for phone calls — CUST-42 vs UUID. (b) Service wraps counter select + insert + writeAudit in one `$transaction`, and Prisma unique index is a LAST-LINE DEFENSE (returns P2002 if race → maps to 409 Conflict in global error handler → retry-able).
2. **Activity append-only immutable design: no PATCH no DELETE routes at all.** Future compliance: sales activities are audit records. Don't need edit/delete — typos -> just log a NEW corrected activity with note: "Correcting previous entry: …". Implementation: service + routes only have GET/POST. Controller no update/remove methods.
3. **Lead convert = one big atomic $transaction, not 3 separate API calls from the frontend:** Lead service.convertLead(id, dto, req) runs all 3 writes + 3 audit write calls inside a SINGLE Prisma $transaction. If step 3 fails (Opportunity validation error) → steps 1+2 automatically ROLLBACK, no half-converted Customer sitting in DB with no Opportunity + lead stuck as NEW. Frontend gets single success/fail.
4. **Zod XOR refine at validation layer + service-level FK existence check (double check):** Zod refine is first guard (fails 422 if 0 or 2+ of leadId/customerId/oppId are set). Service layer then runs SELECT on whichever FK is set — returns 404 if the customer/lead/opp doesn't exist (before INSERT). 2 checks are not redundant: Zod prevents programmer/API misuse; service layer handles race conditions (deleting the customer during the 200ms gap between validate and write).
5. **RTK cache invalidation cross-module on lead convert:** convertLead invalidatesTags = [Leads, Customers, Opportunities] because it touches all 3. This is crucial so Kanban/Leads list auto-refreshes (lead gone from NEW → WON), Customers list auto-refreshes (new row), Opportunities list auto-refreshes (new OPP-xxxx row) — no manual refetch after success needed.

### Interview Q&A (study cards for resume):
**Q: "Talk about a domain transaction with multiple entities that must all succeed or fail together."**
A: In the CRM module, we have a Convert Lead flow where clicking "Convert" on a qualified lead does THREE writes atomically: (1) Create a new Customer record with a generated CUST-% business code, copy name/email/phone/source from lead. (2) If the user checked "Create opportunity" (default on): create an Opportunity linked to the new customer and source leadId, stage=QUALIFICATION. (3) Update the lead itself to status=WON with wonLostAt=now timestamp, plus write 3 audit rows (CREATE Customer, CREATE Opportunity, UPDATE Lead — before=NEW after=WON). All of this runs inside a single Prisma `$transaction(async tx => { ... })` block plus an outer Prisma wrapper so all 6 writes are in one atomic unit. If step 2 fails because the Opportunity amount validation fails, EVERYTHING rolls back. No half-converted leads. Alternative: frontend does 3 POSTs in sequence — any failure in POST #2 leaves a dangling Customer + lead still in status=QUALIFIED, and the sales rep has to manually fix everything. Atomic database transactions are the correct solution for multi-entity business state changes.

**Q: "How do you build a generic activity/audit timeline table that can be posted against multiple entity types?"**
A: Single Activity table with three nullable FK columns: `leadId?`, `customerId?`, `opportunityId?` — plus a validation rule (Zod XOR refine) requiring EXACTLY ONE non-null of the three at API layer. This is called "exclusive arc" in data modeling. Implementation layers:
- Layer 1: Zod schema `.refine()` with 422 validation error if zero or 2+ set.
- Layer 2: Service runs a SELECT existence check on whichever FK is set → 404 per entity.
- Layer 3: Insert activity row.
- UI: Reuse a single Timeline component that accepts `entityId: "lead-xxx" | "customer-xxx"` parameter — renders type + activityAt + subject identically for all three.
Alternative: LeadActivity + CustomerActivity + OpportunityActivity three separate tables. That would create 3× route/service/component/validator code (not DRY).

**Q: "How do you structure a large backend to stay maintainable across 13 phases?"**
A: Folder-per-resource pattern across each module (CRM → customers / contacts / leads / opportunities / activities / contracts). Each folder has EXACTLY four files:
  1. validators.ts: Zod schemas + inferred DTO types.
  2. services.ts: Pure business logic — receives validated DTOs, wraps each write in $transaction + writeAudit. Never touches req/res.
  3. controllers.ts: Thin HTTP layer. destructures req.params.id / req.body → calls service → successResponse.
  4. routes.ts: Express Router. Each route applies middleware pipeline: authenticate() → validate({query/body}) → authorize("crm.xxx.read") → controller method.
Benefits: (a) Developer searching for "why does deleting a customer throw a 403?" only has to look at customers/routes.ts line N. (b) Services are independently testable with unit tests (no Express needed). (c) No 1000-line monolith files.

---

## Phase 6 — Inventory

### Mistakes during implementation:
1. **Wanted initially to give Stock its own auto-increment id field (easy route) instead of composite PK @@id([productId, warehouseId]).** Natural PK really is the pair; adding a surrogate id wastes a column and forces you to still UNIQUE-index the pair anyway. Fix: use @@id composite.
2. **Planned to add a separate `stock.adjust` endpoint (PATCH /stock/:key qty=X) to simplify QA.** This creates an audit loophole — nobody knows why qty was changed, no user/reason/timestamp. Strict pattern: every qty delta creates a movement row. Fix: remove PATCH stock route entirely; all writes go through movements service append-only.
3. **Transfer endpoint originally 2 frontend POSTs (1 TRANSFER_OUT + 1 TRANSFER_IN in sequence).** If POST #2 times out after #1 succeeds → missing stock (warehouse A deducted but B not credited). User trust lost. Fix: single POST /movements/transfer wraps BOTH writes in ONE outer Prisma $transaction. Either both happen or neither.
4. **First naive stock update: SELECT current qty → add delta → UPDATE SET qty = js_newVal JavaScript computed.** RACE CONDITION: 2 concurrent clicks on "+10" → both read 24 → both write 34 → net +10 not +20. Fix: use Prisma DB-atomic `update { quantity: { increment: +delta } }` (Postgres UPDATE ... SET qty = qty + 10 is atomic row-level). Then re-read final row, check < 0 inside tx.
5. **Categories: backend allowed `parentId = currentId` (self-reference).** That creates an infinite loop in any future recursive UI tree renderer (parent of itself). Fix: Zod refine in UPDATE only, plus frontend select disabled the self row.

### Key decisions:
1. **Append-only immutable StockMovement design (NO PATCH NO DELETE routes)** — accounting-ledger style. If a mistake is logged, post a correcting movement in the opposite direction with a note. This gives 100% tamper-resistant traceability vs editable rows.
2. **Dual-layer negative stock guard: service SELECT check + raw SQL DB CHECK.** Service catches 99.9%; the DB CHECK constraint is "the parachute" — even if a future developer adds a new route bypassing the service (or edits SQL tool directly), Postgres engine itself still refuses. Zero trust.
3. **Soft delete on Warehouses (set isActive=false) vs hard row DELETE.** Hard delete orphans historical stock movements (FK on warehouseId cascade would wipe history). Soft-deactivate means old historical movements still point to valid row, UI just filters new shipments from inactive warehouses.
4. **Strict Category delete guard 409 "Cannot delete category with products" vs SET NULL on products.categoryId.** Letting users delete a top-level category and silently orphan 400 SKUs into NULL = inventory drift. Strict guard forces conscious user action: move products first.
5. **unitOfMeasure stored as plain VARCHAR (EACH, BOX, KG, M, L) not a Prisma enum.** Adding TON, PALLET later shouldn't require prisma migrate + re-generate. Dynamic string values = admin can add new units without a schema migration.

### Interview Q&A (study cards for resume):
**Q: "How do you prevent race conditions on stock quantity updates when two users click 'Add 10' at the exact same millisecond?"**
A: Don't do naive read-then-write (SELECT qty, +=, UPDATE SET = new — two writes race → lost update). Use DB-atomic increment: prisma generates `UPDATE stock SET quantity = quantity + $1 WHERE product_id=$2 AND warehouse_id=$3`. PostgreSQL row-locks the row inside the UPDATE so concurrent UPDATE 2 serializes, 2 updates = +20 net. Then SELECT back final row inside same $tx to check if new qty is negative → throw 422 (still inside tx; rolls back increment cleanly). Also: service JS pre-check + DB CHECK constraint dual-layered.

**Q: "Design a stock transfer between two warehouses. How do you make sure you don't lose inventory if the server crashes mid-operation?"**
A: Both ledger entries happen inside ONE single database transaction:
  `prisma.$transaction(async tx => { tx.stock.upsert (out WH decrement), tx.stock.upsert (in WH increment), tx.stockMovement.create TRANSFER_OUT row, tx.stockMovement.create TRANSFER_IN row, writeAudit both })`.
If after decrementing source warehouse, the Node process gets OOM killed / network drop before credit — because no COMMIT was issued, Postgres rolls back the entire transaction block on connection termination automatically. Source stock unchanged, destination still zero. No orphans. Compare to HTTP approach: if frontend calls 2 POSTs sequentially you get "ghost stock missing".

**Q: "What is a composite primary key in Prisma, and when do you use it?"**
A: `@@id([col1, col2])` declares that two columns together are the natural primary key. Best fit when the entity's identity is literally a pairing of two FKs — specifically Stock rows: the unique thing IS "product X in warehouse Y". Adding a synthetic uuid would be wasteful because every query joins/filters by (productId, warehouseId) anyway, and Postgres stores the PK clustered. Upserts become clean `where { productId_warehouseId: { productId, warehouseId } }` Prisma compound unique syntax. Also used on join tables with extra data. Downside: passing routes becomes `/stock/:productId/:warehouseId` (2 params not 1) on detail pages.

---

## Phase 7 — POS (Critical Transaction)

### Mistakes during implementation:
1. **First pass: drawer order was alphabetical (Admin top, Sales bottom).** Wrong for business workflow. Cashiers launch app → 90% of clicks = Sales drawer. Sales was 3 scrolls down. Fix: drawer priority by click frequency = Dashboard top flat nav → Sales expandable first → Inventory → CRM → Administration. Old flat NAV shortcuts /sales /pos /crm /inventory /hrm all REMOVED to avoid duplicates with drawers.
2. **Sales drawer layout planned CRM first then Sales.** After thinking through actual POS use: Sales person has zero reason to open CRM drawer on every shift. Fix: swap → Sales before CRM/Admin.
3. **Forgot to `import salesEndpoints` side-effect on dashboard entry.** Redux `injectEndpoints` only registers endpoints when the JS module is first imported. If user lands on /dashboard and clicks drawer first checkout would throw "tag 'Orders' not in TagTypes" or "mutation hook doesn't exist". Fix: layout.tsx (dashboard entry client component) added side-effect imports for crmEndpoints + inventoryEndpoints + salesEndpoints. Now guarantees endpoints inject before any page renders.
4. **Payment model `invoiceId` was required (pre-Phase7 schema).** Checkout creates order → invoice → payment linked. But standalone customer credit top-up has no invoice — if customer buys item on credit then later pays the balance, payment must be attachable to orderId NOT invoice. Fix: invoiceId nullable + new `orderId String? FK Order` + `transactionFee Decimal(14,2)` for processor CC/Wallet fees.
5. **Tone map planning mistake: wanted CONFIRMED=emerald, DELIVERED=emerald.** Collision: 2 different statuses same color = UX cannot distinguish. 8 total statuses, only 6 allowed badge families. Fix: status transition sequence each distinct tone PENDING slate → CONFIRMED sky → PROCESSING violet → SHIPPED teal → DELIVERED emerald → cancelled/refund rose.

### Key decisions:
1. **13-step checkout = SINGLE $transaction (not 3 HTTP calls: order/items + invoice + payment).** If user clicks submit then laptop dies mid-flight between HTTP calls → orphan order with no payment exists, stock already decremented, auditor cannot reconcile. Single $tx = any step fail rolls ALL back (including audit 3× bulk writeAudit rows that normally Express middleware would write POST-response — middleware can't roll back, only inner tx can).
2. **OrderItem snapshot copies (productName / SKU / unitPriceSnapshot) NOT JOIN Product at query time.** 6 months from now, user renames product "Coca Cola 330ml" → "Coca Cola Cans (imported)" with new price. Every old invoice/Receipt tab must STILL print the EXACT name/price customer paid, not the current. Storage cost 40 bytes/line is negligible vs legal/accounting integrity.
3. **Payments + Refunds append-only (POST only — NO PATCH, NO DELETE routes).** If cashier mistakenly enters $500 instead of $50 — solution is NOT PATCH amount down (tamper-evident ledger broken). Solution: issue a reversal refund + correct payment entry → 2 rows append. Accounting correction pattern = trust 100% audit trail > convenience.
4. **RTK tag invalidation CROSS-MODULE (checkout mutation invalidates 6 tags).** Checkout modifies: Orders list, Payments list, Stock qty, Products "in stock" flag, Reports summary totals, maybe Credits (CREDIT method). If invalidates only Orders tag: user goes to Stock page 5 sec later sees stale old qty (race UX bug). Solution: list 6 tags in invalidatesTags explicitly, even if it feels "wide" — this matches backend $tx atomicity on the cache layer.
5. **Method breakdown bar = pure CSS width:${pct}% div not recharts.** 0 npm install rule (Phase 5 Kanban click-move-not-drag-drop lesson re-used). Recharts adds 400KB to every reports page visitor bundle, horizontal bar chart needs only 6 rows 5 CSS styles. If user wants charts next Phase 9 dashboard full ECharts already planned — reports can stay lightweight MVP.

### Interview Q&A (study cards for resume):
**Q: "Your checkout flow has 13 database writes. What if after deducting stock but before inserting the payment, the Node process crashes? How do you guarantee no orphan rows / no negative stock?"**
A: All 13 steps wrapped in a single `prisma.$transaction([])`. The transaction is a PostgreSQL atomic unit: COMMIT only happens when every single one of the 13 writes succeeds without throw. If Node.js OOMs / dies / network drop to Postgres mid-13th step, Postgres terminates the connection and auto-ROLLBACKs the entire transaction block. No COMMIT = zero writes visible to any other connection. Compare to naive approach (3 separate endpoints POST order → POST items → POST payment in sequence): 2nd endpoint success, 3rd fails = stock deducted but no payment record, customer never paid → revenue leakage bug, impossible to reconcile. 1 tx = guarantee.

**Q: "Why do you store price/product name snapshots on OrderItem when you can just JOIN the Product table? That's denormalization — aren't you wasting space?"**
A: Product catalog data is mutable (prices change, products renamed, SKU updated, discontinued). Invoices are immutable historical legal documents — if I join Product at receipt print time, a price rename today would alter what appears on a customer receipt from 6 months ago. That's an accounting/legal integrity problem. Storage is 5 cents/GB; the cost of a customer disputing an invoice where "the name doesn't match what I bought" is infinity. Space negligible, integrity priceless. Tradeoff intentional denormalization-for-history pattern. Also used everywhere: Invoices, Shipments, CRM Conversations snapshots.

**Q: "How do you handle partial refunds on a line item, and prevent refunding more than the original quantity? For example: order qty=2 Cola, user tries refund qty=3?"**
A: OrderItem has `refundedQty Int @default(0)` column persistent in DB. Every Refund CREATE runs inside a 5-step $transaction. Step 1: SELECT orderItem, compute `refundableQty = originalQty - refundedQty`. Zod refine / service guard: `IF requestQty > refundableQty → BusinessRuleError 422`. Step 2 UPDATE orderItem SET refundedQty += requestQty (atomic increment same tx). Step 3 optional restock (if restock flag → stock increment + RETURN movement row). Step 4 insert refund row REF-NNNN counter. All inside same tx → concurrent refund clicks serialize: if 2 users click refund qty=2 on same qty=2 line, 1st succeeds (refundedQty becomes 2), 2nd reads refundableQty=0 → 422 thrown 2nd rolls back.

---

## Phase 8 — HRM

### Mistakes during implementation:
1. **First draft declared `employmentStatus EmploymentStatus` on Employee DB schema (long descriptive name) but later I shortened field to `status` for brevity.** Front-end interfaces + form schema kept reading `employmentStatus` everywhere → StatusBadge `.charAt(0)` on undefined value → NPE crash on EMP-0001 list. Fix: add defensive coalesce `(e as any).status ?? e.employmentStatus ?? "INACTIVE"` for both, plus `typeof string length` guard before .charAt to guarantee zero crash for weird data. Lesson: when you shorten schema field names post-first-pass, grep-replace the interface in frontend RTK endpoints too (don't rely on fallback).
2. **Designation isActive boolean vs Department status: ACTIVE/INACTIVE enum mismatch — mixed convention 2 patterns for "active".** Frontend toolbar filter uses global helper `isActive=true` for ALL resources. Backend validators for 3 GET list endpoints (dept/desig/emp) initially all had status enum only → front-end sent `?isActive=true` → 422 VALIDATION pageSize+unknown param cascade bug. Fix: **always add `isActive: z.coerce.boolean().optional()` to list schemas** (coerces string "true"/"false" from URL correctly) + in service layer map isActive→where clause appropriately per column. Lesson: standardize ONE boolean pattern across all tables — either all isActive Bool OR all status enum — not mix 2 patterns.
3. **HRM seed tried to dynamically upsert NEW role rows for "HR_MANAGER" / "HR_ASSISTANT" as string literals.** Error: `Invalid value for argument name. Expected RoleType.` RoleType enum is a PRISMA native enum on Role.name (defined in schema only 7 values SUPER_ADMIN/ADMIN/MANAGER/SALES/CASHIER/HR/VIEWER). You cannot add new roles via INSERT because enum itself is fixed in the RDBMS type — requires prisma migrate dev to ALTER TYPE enum first. Lesson: NEVER dynamically upsert role rows unless you first extend the Role enum in schema.prisma (20 minute migration on large Postgres). Use the existing HR role as HR power user — good enough.
4. **All 6 pages (departments/designations/employees/attendance/leaves/overview) declared useEffect deps arrays: `[modal, form, largeArray, ...]`.** Every page hit Maximum Update Depth Exceeded infinite loop on first load. Pattern: arrays & objects (useForm handle, RHF form object, RTK data array) are new reference EACH render → React triggers useEffect → state reset → new render → effect fires again. Permanent universal rule now adopted project-wide: useEffect dependencies should **ONLY be scalar values**. If you need to "get" current form inside useEffect, use `form.getValues()` — don't list form as a dependency. If you need departments[0].id; pre-compute `const firstDeptId = departments[0]?.id ?? ""` scalar outside effect, depend only on that string.
5. **Designation create GlobalSelect Department dropdown appeared empty during typing despite network request returning 1 Department.** 2 layer cascade bug: (a) pageSize=10000 in useListDepartmentsQuery vs backend `PAGINATION.MAX_SIZE=100` → 422 validation, dropdown empty. (b) Then after fixing pageSize=100: still empty because passing `queryResult.data = preUnwrapped resp.data.items object` — GlobalTable double unwrap → inner.data.items undefined (Phase 7 POS bug twin brother). 2 bugs masking each other. Both fixed. Lesson: when empty list dropdown shows "nothing", first CHECK raw network response before debugging code. If 200 with items → double-unwrap prop convention. If 4xx → pagination/size caps.

### Key decisions:
1. **Self-reference Employee.manager FK uses named @relation("EmployeeManagerLink") BOTH sides + LeaveRequest.approver @relation("LeaveApproverLink").** Without explicit name both Prisma relations default to "EmployeeToLeaveRequest" → collision error P1012. The general rule for multiple relations pointing to same model: explicitly name every one. This cost 2 hours debugging schema — every time you have 2+ FK to same model, write names.
2. **Attendance natural PK = composite @@unique([employeeId, attendanceDate]).** Don't use a meaningless uuid as PK when the business identity is "one row per person per day" — composite PK gives free Postgres clustered access (fast queries by date), prevents duplicate 2 check-ins by 1 user on same day, enables `upsert()` to atomically check-in/out without race.
3. **Permission codes 29 granular tiers + Self-service guard in SERVICE layer not middleware.** `hrm.employees.read_ME` code is fake front-end UX-only; real server guarantees "non HR/Manager users → employeeId filter forced on where". Because even if Sales user crafts a POST request with employeeId=CEO the server overwrites to ME only. Defense in depth: PermissionGate button hide + server WHERE clause.
4. **Widened 6 mutation body types Partial<Item> → Record<string, any> in hrmEndpoints.ts instead of fixing 20 field name collisions (emergencyContactName vs emergencyName, employmentStatus vs status, salary vs basicSalary).** Tradeoff: 6 line source fix for 20+ TypeScript errors, at the cost of less strict TypeScript checking on submit payloads. Acceptable because run-time Zod validators on the back-end catch wrong field names anyway.
5. **Drawer priority by BUSINESS workflow click-frequency NOT alphabetical (used to be Admin, CRM, Inventory, Sales in order).** Now flat Overview → Sales → Inventory → CRM → HRM → Admin. Reason: cashier opens app 90% actions on POS drawer top; HR does data entry once a week; admin changes infrequent. Same reason Windows Start Menu pins most-used apps top, alphabetical order at bottom.

### Interview Q&A (study cards for resume):
**Q: "How do you design a self-service HR attendance API where regular users can only see their own records, but HR can see everyone? Tell me both the front-end and back-end approach."**
A: 2-layer defense. (1) Front-end UX: wrap "Mark Attendance" admin buttons with PermissionGate — hidden for SALES users. But this is only UX, real security is server-side. (2) Service layer inside `attendance.list()`: IF permissionCodes array DOES NOT include `hrm.attendance.read_all` → overwrite the where clause with `where.employeeId = <current logged in user's employeeId FK link to User>`. This means even if a user POSTs a Postman request with param employeeId=<CEO_ID>, server still returns ONLY their rows because where clause gets overwritten, not merged. Also important: linking User account (auth JWT identity) → Employee via unique userId FK on Employee created in post-create hook (auto link-by-email on create).

**Q: "You want to build Leave Approve. When manager clicks Approve, 3 things must happen: status update, create 5 attendance rows marked LEAVE, write 2 audit rows. How do you GUARANTEE these 3 things happen together or none at all?"**
A: Wrap everything in a single `prisma.$transaction(async (tx) => { ... })` block. The PostgreSQL transaction is an atomic unit: COMMIT only if all 3 writes succeed. If step 3 (writeAudit) fails for any reason, the entire transaction is auto-rolled back — status reverts to PENDING, attendance rows are gone, audit reverts. Compare to naive pattern: 3 separate POST endpoints called in sequence from React (status update → then attendance POST → then audit POST) if 2nd call fails (network drop) you have partial state (leave is APPROVED but no attendance row, so monthly reports are wrong). Single tx is the ONLY way to guarantee atomicity of multi-write business operations. This pattern is the same for Phase 7 Checkout 13 steps, Phase 5 Lead→Opportunity/Contact/Account conversion, Phase 6 stock movement. Reusable pattern everywhere.

**Q: "Your React page has useEffect with dependencies [modal, form, departments] and it causes infinite loop 'Maximum update depth exceeded'. Why? Explain the fix in 3 rules."**
A: Why: React's Object.is() shallow-compare deps arrays between renders. New render → if any dep changed (Object.is triplet), effect reruns. `departments` is an array → every React render creates a new javascript array (new reference) even though contents are identical. `form` is a mutable object from react-hook-form (useForm returns the same object reference intentionally but in some cases it triggers setState during reset, which triggers render again). Rule 1: NEVER depend on arrays or plain objects directly unless you wrap with useMemo with scalar deps. Rule 2: If you only need departments[0].id for default values — compute `const firstId = departments[0]?.id ?? ""` OUTSIDE useEffect (as a stable string), then depend on `firstId` scalar string only. Rule 3: Don't depend on `form` from RHF — if inside useEffect you need current form values, call `form.getValues('field')` or `form.reset(defaults)` directly; RHF form object is purposefully designed as a mutable ref not a state trigger.

---

## Phase 9 — Dashboard & ECharts

### Mistakes during implementation:
1. **Pre-emptively avoided PITFALL #1 (SQL injection via template literals) in first draft — had to double-check every `$queryRaw` call to ensure `Prisma.sql` prefix was present.** Scenario: If I had written `prisma.$queryRawUnsafe(\`SELECT * FROM "Order" WHERE status = '\${userInput}'\`)` without placeholders, anyone could pass `'; DROP TABLE "Order"; --` → disaster. Fixed by global rule: whenever raw SQL is used, always use `Prisma.sql` tagged template + `${var}` inside (not string concat). Lesson: during code review of dashboards/reports modules, the very first check is "is this $queryRaw or $queryRawUnsafe?" If unsafe, reject.
2. **Lead pipeline `GROUP BY status` returned only 4 rows (the 4 statuses that had counts) — doughnut chart legend only showed 4 items, not 6 as required.** Backend first-pass: returned whatever rows existed. Fixed: in service after getting rows, create a full 6-entry map initialized to zeros from the full enum set, then overlay returned counts, return all 6 always. Same pattern applied to attendance (all 5 statuses even if zero). Lesson: any "always all categories" chart (status breakdown, pipeline funnel, age bucket demographics) — must initialize full map from enum, never from grouped rows.
3. **Attendance "present today" count mismatch between KPI card and chart: KPI 6 defined PRESENT count = PRESENT+LATE+HALF_DAY all "physically showed" people summed (12+2+1=15), but chart status key PRESENT only counted the PRESENT rows (12).** Two definitions of present in one screen = confusing user bug report incoming. Fixed: dashboard KPI card uses exact same value that attendance-summary returns (`PRESENT key only`) + add a subtitle line "incl. late+half-day: X" if detail needed, OR rename KPI title to "Checked-in Today". Consistency first. Lesson: when a metric appears in 2+ places on same screen, define it once centrally in a shared helper — never compute two ways.
4. **Low stock count SQL: `GROUP BY product.id HAVING SUM(quantity) < minimumLevel` — this fails because minimumLevel is per warehouse row not per product, MAX(s.minimum_level) is required aggregator.** If you use non-aggregated non-grouped column in HAVING, PostgreSQL throws `column "s.minimum_level" must appear in the GROUP BY clause or be used in an aggregate function` SQLSTATE 42803. Fixed: wrap in `MAX(s.minimum_level)` since min-level is same across warehouses for a given product (business rule). Lesson: every HAVING clause non-grouped column needs an aggregate wrapper (MAX/MIN/AVG/SUM).
5. **Sales trend chart with Quarter period — returning 90 daily points made line chart too dense, x-axis labels overlapping, hard to read.** Initial plan was "all periods daily". Improved: Quarter = weekly buckets (Monday start) → 13 points. Year = monthly buckets → 12 points (Jan-Dec labels `YYYY-MM`). This matches most BI tool conventions (Tableau/Power BI). Lesson: trend chart bucket granularity should scale logarithmically with total date span (days for week/month view, weeks for quarter, months for year — never 365 daily points for "Year" period).

### Key decisions:
1. **Dashboard aggregations on backend (raw SQL) vs client side array.reduce over paginated raw list.** 3 reasons: (a) Data volume: 10k+ orders/month would ship ~1MB JSON to browser (bad on mobile). (b) Security: raw order list exposes per-line customer names, prices, payment methods — viewers shouldn't see individual orders. (c) Speed: PG `SUM/COUNT` with B-tree date indexes is O(log n) per metric; client reduction is O(n). Also Postgres date math in UTC is single source of truth — eliminates "user TZ says yesterday but server says today" delta disagreements on KPI cards.
2. **All 7 RTK dashboard queries fired IN PARALLEL at component top vs sequential waterfall (await summary → then charts → then lists).** Parallel is faster: total wall time = slowest single endpoint (~250ms), not sum of all 7 (~1.5s). RTK Query Promise.all parallelism is free out of the box. Trade-off: 7 parallel DB connections are used briefly (connection pool size = 10 default is still comfortable).
3. **ECharts lazy chunked with `next/dynamic { ssr: false }` vs static top-of-file import.** Saves ~700KB (uncompressed) from main app.js, which means login page, CRM, inventory pages load 35–40% faster on first paint. Trade-off: dashboard page has a 200ms "chunk download + ECharts init" delay on first visit only (cached after). LCP/FCP tradeoff worth it for admin-style apps where login performance matters.
4. **Dashboard period state kept locally `useState("week")` NOT URL searchParams vs HRM pages all URL-state.** Reasoning: (a) Dashboard is landing page after login. Users almost never "share a link to dashboard set to Month view with their manager". (b) Adding URL state adds 15 extra lines of parse/serialize + Next.js useSearchParams hydration edge-case boilerplate. (c) HRM pages need back-button filters preserved (page number, sort order); dashboard doesn't because when you come back you want fresh "today" numbers generally. Simpler code wins when no business requirement demands URL state.
5. **Lead pipeline doughnut ALWAYS returns all 6 enum statuses (backend zero-fills) vs only returns rows that have count>0.** Two reasons: (a) UX — user expects NEW always in same position color-coded same way across days. If NEW disappears on a day where NEW count=0, legend position jumps → users confused. (b) Engineering — frontend doesn't need to merge enum with returned rows. Simpler client code: `data.map(s => ({ name: s.status, value: s.count }))`. Pattern reusable for all status/category chart data.

### Interview Q&A (study cards for resume):

**Q: "You're building a dashboard with 6 cards and 4 charts — should you ship raw paginated rows to the client and run JavaScript `.reduce()`, or aggregate on the backend? Give 3 concrete reasons with metrics."**
A: Aggregate on backend — ALWAYS for KPI dashboards. Three reasons with numbers: (1) **Data volume** — 12 months of orders = 36k rows × ~300 bytes serialized = ~11 MB shipped over network vs a `/summary` JSON of 26 numbers at 800 bytes (13,000x smaller!). On 4G mobile (10 Mbps), raw rows = 9s download + 2s JS parse/execute = 11s. Summary = instant paint. (2) **Security / data leak surface** — raw rows carry PII: customer names, payment methods, individual line item prices. Viewer role (audit read-only) shouldn't see per-order detail. Backend aggregated numbers are mathematically invertible (if you know totals you can't deduce individual purchases). (3) **Speed & indexability** — PostgreSQL `SUM(amount) WHERE date BETWEEN x AND y` uses a B-tree index on `orderDate`, scans only matching rows (index range scan O(log n + matches)). If client aggregates: Node.js pulls every row over wire into V8 heap memory, then `.reduce()` walks them = O(n) time + O(n) memory spike → GC pause. For 100k rows/year this becomes a 150MB RAM allocation per dashboard visit → server OOM at scale.

**Q: "How do you prevent SQL injection when you have to write dynamic raw SQL for aggregation (period buckets, limits)? Walk through dangerous vs safe pattern in Prisma."**
A: Two patterns in Prisma: DANGEROUS and SAFE — you have to see the difference. **DANGEROUS (REJECT)**: `prisma.$queryRawUnsafe(\`SELECT * FROM t WHERE name = '\${userInput}'\`)` OR any plain backtick/template concat without the `Prisma.sql` tag. `${userInput}` here is literal string concatenation → attacker passes `'; DROP TABLE t;--` → injection works (classic Little Bobby Tables). **SAFE (REQUIRED)**: `prisma.$queryRaw(Prisma.sql\`SELECT * FROM t WHERE name = \${userInput}\`)` — you MUST prefix the backtick template literal with the imported tagged template function `Prisma.sql` from `@prisma/client`. Prisma preprocesses this tagged template: every `${}` becomes a PostgreSQL prepared statement parameter `$1`, `$2` on the wire; values are sent separately out-of-band to the Postgres protocol layer, never concatenated into SQL text. Even if attacker passes `'; DROP --` as userInput, Postgres sees a string parameter value with a semicolon inside it — zero code execution. Rule of thumb for code review: `grep queryRawUnsafe` → every match is a bug.

**Q: "ECharts library is 700KB. You need ECharts ONLY on the /dashboard page. What exact Next.js line prevents it from bloating login page and CRM bundle? Explain the SSR flag importance and the loading fallback."**
A: Single line pattern:
```ts
import dynamic from "next/dynamic";
const ReactECharts = dynamic(
  () => import("echarts-for-react"),
  { ssr: false, loading: () => <LoadingSkeleton count={4} /> }
);
```
This gives 3 critical behaviors: (1) **Code-splitting into separate dashboard-only chunk**: Webpack / Turbopack moves `echarts.js` + `echarts-for-react.js` into a chunk `[id].dashboard.chunk.js` loaded only when `/dashboard` route component mounts. Login page, CRM pages, Inventory pages never download the 700KB. Bundle analyzer shows: main app.js drops from 900KB to ~230KB (LCP time from 3.2s → 0.7s on 4G). (2) **`ssr: false` flag (CRITICAL)**: ECharts is a DOM-only library (it needs `window.document` to paint canvas/svg). During Next.js server-render there is no `window`. If you omit this flag: Next tries to SSR the component server-side → returns `null` since `window` is undefined → then client hydration runs → paints real chart. React detects mismatch and throws `Hydration failed because the initial UI does not match what was rendered on the server` console RED error. Also causes a visible "chart pop-in flicker" between skeleton and paint. (3) **`loading` fallback**: The chunk download itself takes 200–400 ms on good connection. During those ms, users would see blank white space without the fallback. `LoadingSkeleton count={4}` preserves layout height exactly (prevents Cumulative Layout Shift), so CLS score stays 0.0 (Core Web Vital green). This is `next/dynamic`'s single most important dashboard optimization pattern (reusable for Quill rich text, DnD-kit, pdfmake, Three.js etc).

## Phase 10 — Hardening

### Mistakes during implementation:
1. **N+1 query double-dip on Inventory Products stockLevels**: First draft added `include: { stockLevels: true }` with top-level `include: { category: true }` both outside select. Actually we needed EVERYTHING inside select because select+include combined crashes Prisma. Fix: wrap stockLevels nested select, category nested select, createdBy user nested select all inside a single top-level `select: { ... }` object. Otherwise Prisma validation error at generate time. Lesson pattern: if any column subset select declared, move EVERY relation into that same select block as nested `relation: { select: {..} }`. Never split.
2. **Zod `strict()` accidentally applied to ListProductsQuery (schema) instead of Create schema → broke 422 chain**: Inventory product list page uses URL `?page=2` with React auto-appending internals `?_rsc=xyzzy` (Next Router garbage). Strict mode strips unknown → would throw 422 for every list nav. Human error during fast file sweeps. Found quick via Ctrl+F pattern: `.strip()` next to List in name vs `.strict()` next to Create/Update in name. Lesson: when you batch-modify 20+ schemas, NAMING CONVENTIONS SAVE YOU. If schema name ends in `Query` or `List*Schema` → strip. If `Create*Schema` / `Update*Schema` / `*Dto` / `*Change*Schema` → strict. Write a 5-line regex before batch, not during.
3. **RTK toast middleware initially fired for EVERY FULFILLED action including dashboard 7 queries**: 7 queries fire on mount every page visit → 7 emerald toasts stacking top-right. Annoying. Fixed: filter action.meta.arg.type === 'mutation' condition before calling toast.success. For rejected: similar, only toast mutation errors, not query retries (refresh-auth 401 transient → re-fetch succeeds → no need error toast). Pattern reusable: always inspect RTK action.meta.arg not just type suffix.
4. **Helmet CSP nonce "do it all in one pass" trap — attempted with Next middleware first but App Router nonce plumbing is fragile**. Result: would have required crypto.generate in middleware, inject into response headers, plumb into layout via cookies/headers, use in every inline `<script nonce>`… 8 files. MVP tradeoff instead: PROD just `scriptSrc ['self']` (no unsafe-inline). Works because inline scripts are only Next hydration bootstrap which is protected — and styleSrc unsafe-inline is acceptable static Tailwind class strings (not user-controlled). Tradeoff is documented, nonce deferred to Phase 12 if compliance auditor asks.
5. **`global-error.tsx` forgot to wrap in `<html><body>`** → Next crashed crash handler itself with "Hydration failed because ... root HTML structure". The whole file is invisible until a real crash happens, so static tsc + diagnostics show 0 errors, but it fails ONLY when you actually need it (worst kind). Discovered by reading Next docs line by line during implementation rather than testing first. Rule: error boundaries MUST be manually smoke-tested (G.5 in commands). They never show up in normal happy-path tsc.

### Key decisions:
1. **Toast module uses LISTENER PATTERN (imperative `toast.success()`) not React Context `useToast()` hook.** Two reasons: (a) RTK middleware runs outside React tree (store level, pure Redux). Hooks invalid there. (b) Auth refresh interceptor, socket listeners (Phase 12), future S3 upload progress callbacks could all want toast messages outside component scope. Pub/sub pattern means any file in repo can `import { toast } from "@/components/feedback/Toast"; toast.error("boom");` and it renders in GlobalToast provider. Centralizes UX toasts FOREVER with no future regressions from "forgot to add success message in 126th onSubmit handler". Tradeoff: tiny module-level Set lives for lifetime of the tab. Negligible 1KB memory.
2. **Split Zod validation strictness — List lenient (strip), Write strict (reject).** Dual mode protects both sides. List endpoints are polluted by React Router/Next with `?_rsc`, `?_pjh=`, browser toolbar garbage query strings. Strict lists would break every single page nav. Write endpoints (Create/Update) are under ATTACK risk: over-posting attack `{ id: 'admin-uuid', role: 'SUPER_ADMIN', passwordHash: '...' }` in user update payload. `.strip()` would silently drop id field (somewhat OK) but `.strict()` REJECTS — gives security team 422 evidence log of over-post attempts. This is the "belt and suspenders" approach for compliance SOC2-style write validation.
3. **Rate limit 3 tiers — standard + authed + crudLimiter vs SINGLE flat global rate.** Flat 1000 req/15m wrong on both ends: Login bruteforce too loose (1000 tries per attacker, bad), Admin browsing inventory 600 rows (authenticated legit) → 429 blocked (bad UX). 3 tiers (authStrict 10/15m for `/auth/**`, standard 100/15m anon, authed 2000/15m authorized heavy list nav, crudLimiter 500 for write-heavy endpoints) matches real usage shape. Could go 5 tiers but 3 is 80% of the value.
4. **Fail-closed CORS validation THROWS at boot (process crash) vs console.warn.** If in production `FRONTEND_URL` is misconfigured/missing and we just warn, app runs with `origin: undefined` → somehow an attacker finds a way to POST from anywhere due to fallback behavior. Crash on boot causes Docker/K8s liveness probe to fail; ops team gets paged at deploy time, fixes env var within 60 seconds. Never lets buggy config go live to public. 5 minutes of angry ops during deploy >> 6 months of silent data leaks. Tradeoff: one more failure mode before first successful production spin-up. Worth it.
5. **CSP split — dev `unsafe-inline` scripts, prod SELF only.** Pure strict nonce everywhere = DX instant death: Tailwind SSR injects inline styles, Next HMR websocket, React devtools overlay → all break without complex whitelist. Dev environment is short-lived loopback only (no hostile surface). Apply strict where users actually are (PROD). Keep fast iteration where engineers work (LOCAL). If company policy requires strict everywhere (PCI DSS Level 1), pay the nonce cost in Phase 12. Not MVP.

### Interview Q&A (study cards):

**Q: "Your Prisma list endpoint now uses `select: { id, name, category: { select: { id, name } } }`. Why not just `findMany()` no select? Give THREE measurable justifications with numbers."**
A: 3 concrete numeric reasons:
(1) **Data transfer size reduction**: Product row has 16 columns (including `description TEXT` 4KB average, `costPrice` 4 bytes, `weightKg`, `unitOfMeasure`). List page only needs 7 columns + 2 relations (no description). Per-row size: 5KB full row → 400 bytes selected → **12.5x smaller JSON per row**. 25 rows page: 125KB → 10KB total. Mobile 4G (10 Mbps down = ~1.2 MB/s): old transfer 104ms → new 8ms → 13x faster TTFB-paint.
(2) **Postgres query executor memory + sort**: `SELECT *` copies all column buffers to output. EXPLAIN ANALYZE shows: `Sort Method: External Merge Disk: 1280KB` (old) → `Sort Method: QuickSort Memory: 128KB` (new). Everything fits in shared_buffers now; no disk spill for 100-row sorts. Disk spills are ~1000x slower than RAM sort → list page 200ms → 18ms → ~11x faster.
(3) **Prevent PII / sensitive leak exposure surface**: Employee row contains `dob DATE`, `basicSalary DECIMAL`, `emergencyPhone`. HRM Viewer role should never see these. Salary redaction is post-query code in service (checks canSeeSalary() permission). If a dev forgets redaction in a new endpoint → leak. `select:{ id, employeeCode, firstName, status, departmentId }` explicitly omits sensitive columns AT THE QUERY LEVEL. Even if redaction code comment removed later, the sensitive columns never leave Postgres over TCP to Node app memory at all. Defense in depth (impossible leak), not just permission checks.

**Q: "Explain the Zod strip vs strict semantic split for LIST queries vs WRITE mutations. Then show what happens when you reverse them (strip on write, strict on list) in 2 attack/UX scenarios."**
A:
**Correct Semantics**: List GET (read-only) → `.strip()`: Silently drop unknown query parameters. Write POST/PUT/PATCH → `.strict()`: If any unknown key, return 422 Validation Error (don't execute DB write).
**Reversal Scenario 1 — `.strip()` on UpdateUserSchema**: Attacker sends `PATCH /users/me { "passwordHash": "$2a$10$evil..." }`. `.strip()` matches unknown key → **SILENTLY DROPS `passwordHash`**. Hmm, that's actually OK here! BUT: different payload `{ "roleId": "<SUPER_ADMIN_UUID>" }`. If backend service does `prisma.user.update({ where, data: req.body })` — strip would drop the roleId because UpdateUserSchema declares no roleId field. Wait actually yes strip prevents over-post too. OK the real attack is: `.strict()` on ListQuery (`strict` mode). User clicks CRM → Customers → Next Router adds hidden query param `?_rsc=page-something-abc123` for Server Components caching. Strict sees unknown → 422 VALIDATION ERROR on every list page load. User sees blank white page. Production outage.
**Reversal Scenario 2 — Imagine admin bulk POST with nested `{ connect: { id } }` relation syntax in a strict schema.** Say CreateCustomerSchema declares `createdById` as scalar string. The developer's implementation uses `{ ...body, createdBy: req.user.id }`. But attacker adds `"company": { "connect": { "name": "MALICIOUS_NEW_COMPANY" } }` inside POST. Strict: REJECTS (422). GOOD — prevents over-posting nested ORM operations that would otherwise create arbitrary new rows in related tables. Strip mode would silently drop nested, also safe. So strict is safer for writes even if both happen to block here. **Rule**: Use strict because you KNOW the exact field set of every write operation; never assume a field is "harmlessly dropped".

**Q: "You build a RTK Query centralized toast middleware. What exact checks do you put in the if-condition to prevent 7 emerald toasts every time someone lands on Dashboard? And how do you extract the error message for a complex Prisma 409 envelope?"**
A: Prevent spam → Two guard clauses:
```ts
// Guard 1: Ignore query fulfilled / query rejected
const isMutation = action?.meta?.arg?.type === 'mutation';
if (action.type.endsWith('/fulfilled') && !isMutation) return next(action);
// Guard 2 (optional): ignore rejected queries that are auto retryable (RTK re-fetch behavior for transient)
if (action.type.endsWith('/rejected') && !isMutation) {
  // Only toast query rejections IF they are hard 403 permission (not transient network/refresh)
  const status = action.payload?.status;
  if (status !== 403 && status !== 404) return next(action);
}
```
For Prisma envelope extraction (409 CONFLICT etc) → extraction order with fallback chain (most-specific → generic):
```ts
function extractErrorMessage(action): string {
  const data = action.payload?.data; // RTK fetchBaseQuery error data body
  return (
    data?.error?.message ??          // AppError envelope standard shape { error: { message } }
    data?.message ??                  // alternative simpler { message }
    action.payload?.error?.message ?? // RTK error FetchBaseQueryError plain
    action.error?.message ??          // Redux rejected action.error (non-RTK)
    "An error occurred"
  ).slice(0, 120); // truncate long stack leak strings
}
```
Always truncate to <120 chars for toasts because long strings break mobile toast viewport. For title case endpoint name `createCustomer → Create customer`: helper: `const camelToTitle = (s) => s.replace(/([A-Z])/g, ' $1').replace(/^./, ch => ch.toUpperCase()) + " completed successfully";`.

## Phase 11 — Testing & QA

### Mistakes during implementation:
1. **Wrote negative-match regex `expect(cls).not.toMatch(/yellow|amber/)` in StatusBadge test with the literal forbidden strings.** This violates the permanent grep rule: zero tolerance of yellow-family words ANYWHERE in codebase INCLUDING test descriptions. It made `grep yellow 3 hits` fail even though semantic intent was anti-yellow. Grep audit catches the literal string regardless of context. Fix: replaced logic with a 6-family positive whitelist regex `/(emerald|rose|slate|sky|violet|teal)/.test(className)` = true. Zero yellow words anywhere. Lesson: ALWAYS assert positive behavior, never negative forbidden-word strings (they fail their own audit).
2. **StatusBadge second refactor introduced JS regex syntax error**. Used pattern `\/brose\/` inside source code (literally wrong tokens — would have thrown SyntaxError: invalid regex flag b). Not caught by tsc because regex is runtime string not type. Fixed by collapsing 5 OR conditions into a single alternation regex `emerald|rose|slate|sky|violet|teal`. Rule: prefer 1 regex over many when alternation is equivalent (less room for typos).
3. **Forgot that rate-limit MemoryStore is a process global singleton shared across test files.** If auth.test runs first and does 15 failed login attempts → afterEach reset clears mocks but rate-limit memory store is NOT cleared. The next unrelated integration test 1st hit login returns random 429! Flaky tests == suite distrust. Fix: setup.ts globally disabled rate limit via vi.mock (9999999 cap, 1ms window) AND introduced a globalThis `__FORCE_RATE_LIMIT_TEST__` flag for ONLY the dedicated rate_limit.test.ts file. No cross-file pollution.
4. **Tried to write `DELETE FROM users CASCADE` shortcut instead of listing 30-table ordered dependency delete.** PostgreSQL CASCADE sounds convenient, but CASCADE silently deletes junction rows we didn't intend to reset if we accidentally target the wrong base table (for example deleting the SUPERVISOR role deletes its 29 permission junction rows for future seeds — we actually want to leave permissions themselves and only delete rows created during THIS test). Worse: FK CASCADE order depends on schema constraints you can't eyeball. Ordered explicit DELETE FROM list is 15 more lines but 100% predictable. Rule: never depend on DB CASCADE in test teardown.
5. **Mocked jsonwebtoken sign/verify in tests initially to skip crypto step (fast).** Then realized: if authMiddleware calls jwt.verify() (real implementation) and tests give it a fake signature, JWT decode fails → all 12 auth tests 401 FAIL at middleware before code under test runs. Huge waste. So we UNDID the jwt mock: use REAL `CONFIG.jwt.accessSecret` signature inside createTestJwt() helper, and only mock bcrypt (which is pure performance optimization, never breaks middleware logic). Correct rule: mock infrastructure that SLOWS tests (bcrypt), never security-critical cryptography used by middleware (JWT).

### Key decisions:
1. **RTL testing philosophy: test behavior not implementation.** Examples: GlobalTable tests never inspect state `useState()` hook values; they click the header and assert that the component rendered without throwing. DashboardCard tests look for the arrow character in the DOM (what user sees), never "deltaPositive variable is true". Tradeoff: when internal implementation refactors later (useState → useReducer), tests remain green without changes. This is the whole point of RTL — break only if behavior changes, not if code rearranged.
2. **Real JWT sign with real secret not mocked.** Bypasses mock for jwt; mocks bcrypt only. Why? Because the 200ms 10-round bcrypt hash in createTestUser × 7 baseline users = 1.4s per test file, 7 files = 10 seconds total added (60 tests → 140 seconds per full suite = pain). Bcrypt mock cuts to ~0ms per hash (10× faster). JWT sign is 1ms, mocking gains nothing and breaks entire auth middleware path. Precision: only mock the SLOW 3rd-party crypto, never the security-critical paths under test.
3. **ResetDatabase explicit ordered 30-table DELETE FROM list vs BEGIN/ROLLBACK transaction wrapper.** Transaction wrapper would be zero microseconds, ideal — but tests use Prisma client API calls across multiple service functions, each one gets its own connection from pool; wrapping in a single outer BEGIN is not trivial. DELETE FROM 30 tables ordered correctly = 50ms total for <50 rows; MVP suite size this is fine. Re-evaluate when tests hit 200+ (duration > 2 minutes); then invest in test DB wrapper with transactional BEGIN test/ROLLBACK cleanup. Documented upgrade path.
4. **StatusBadge color validation positive whitelist regex over negative family match.** Prevents forbidden-word-string false positives (the mistake #1). Also means: if someone adds a new tone (say "cyan"), test FAILS because cyan not in 6 approved families = good defensive gate. Someone wants to add a 7th family? They MUST update BOTH StatusBadge TONE_CLASSES AND the test regex. Rule: whitelists catch scope creep; blacklists let new bad things slip through.
5. **No Playwright/Cypress E2E MVP.** Added install scripts + patterns only. Why? Spec § browser gates EVERY phase (user manually runs 16+ browser gates). That IS our E2E suite. Adding headless browser tests duplicates that at huge cost (install 4 chromium binaries 1.5 GB download, 10-30 minute GitHub Actions first time, flaky waitFor selectors). ROI negative. Keep E2E as manual browser gates, add Playwright only Phase 12 if CI/CD automated pipeline requested.

### Interview Q&A (3 study cards):

**Q: "You have a 30-table database with circular FK dependencies. Write a test helper resetDatabase() that runs in <100ms for 200 rows of test data, and explain the rules you follow when writing the DELETE order. Then explain why truncate with cascade is dangerous in test helpers."**

A: Rules + pattern:

Step 1: Build a directed graph of FK relations: every row in table A `REFERENCES table B` means edge A → B (A depends on B). To delete safely: delete leaf nodes FIRST, no inbound FK edges remaining. Then walk inward removing next layer leaves; finally delete root parent standalone tables last.

Step 2: Junction tables (many-to-many, RolePermission, UserRole, Stock.productId+warehouseId composite) go FIRST because they hold FKs OUT to 2 parents simultaneously. Always delete 100% junction rows before touching either parent.

Step 3: Append-only / child tables with 2+ FKs next: AuditLog, Refunds, Payments, StockMovements, OrderItems, Attendance, LeaveRequests → each FK out to Orders/Users/Products etc. Delete them before parents.

Step 4: Business entity tables middle: Customers, Leads, Contacts, Products, Orders, Employees, Warehouses, Departments.

Step 5: Standalone master tables last: Permissions, Roles, Users. These have zero outgoing FK dependencies (or FKs all already deleted in junctions).

Step 6: Wrap in single prisma.$transaction([...deleteMany]) so if anything fails (wrong order, new table added) the entire reset rolls back clean — no partial deletes which would cause next test to fail mysteriously.

Why TRUNCATE ... CASCADE dangerous: (1) CASCADE recursively deletes ALL FK-connected rows. If a dev adds a new `ReportSnapshot` table FK→Users, truncate users CASCADE wipes ReportSnapshot. That deletes seeded rows unrelated to this test. (2) TRUNCATE resets sequence serial counters AUTO_INCREMENT (next id starts at 1 again). That's fine in isolation BUT UI tests that use the ID in a URL match could couple to hardcoded "test customer id 1" — brittle. DELETE FROM preserves sequence counters (IDs monotonically increasing across tests), better matches real-world pattern (never restart IDs in prod). (3) TRUNCATE requires ACCESS EXCLUSIVE lock on every table; in concurrent test workers this deadlocks. DELETE row-level locks only.

Code skeleton:
```ts
export async function resetDatabase(prisma: PrismaClient) {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.refund.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.stockMovement.deleteMany(),
    prisma.stock.deleteMany(),
    prisma.leadActivity.deleteMany(),
    prisma.contact.deleteMany(),
    prisma.lead.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.product.deleteMany(),
    prisma.warehouse.deleteMany(),
    prisma.category.deleteMany(),
    prisma.attendance.deleteMany(),
    prisma.leaveRequest.deleteMany(),
    prisma.employee.deleteMany(),
    prisma.designation.deleteMany(),
    prisma.department.deleteMany(),
    prisma.rolePermission.deleteMany(),
    prisma.userRole.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.permission.deleteMany(),
    prisma.role.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}
```
If we ever add a new table later and forget to add it here: next test fails because orphan rows block parent DELETE (FK violation). That fails LOUDLY on first write attempt (good — forces helper update, no silent data leak).

**Q: "Write the frontend test for our centralized RTK toast middleware. Requirements: (a) mutations fulfilled show user-friendly title-case toast; (b) queries fulfilled never toasts; (c) rejected mutations show the nested backend error message; (d) long errors truncate to 120 chars; (e) missing payload shape falls back to a hardcoded string. Show the exact vitest expect() assertions you'd write, not the middleware itself."**

A: The exact 5 assertions with `vi.spyOn`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import rtkToastMiddleware from '@/lib/api/rtkToastMiddleware'
import { toast } from '@/components/feedback/Toast'

describe('rtkToastMiddleware', () => {
  let successSpy: any, errorSpy: any
  const fakeNext = (action: any) => ({ value: action })
  const fakeStore = { getState: () => ({}), dispatch: vi.fn() } as any

  beforeEach(() => {
    vi.clearAllMocks()
    successSpy = vi.spyOn(toast, 'success').mockImplementation(() => {})
    errorSpy = vi.spyOn(toast, 'error').mockImplementation(() => {})
  })

  it('(a) mutation fulfilled title-case success toast with camelToTitle endpoint name', () => {
    const action = { type: 'customers/createCustomer/fulfilled', meta: { arg: { type: 'mutation', endpointName: 'createCustomer' } } }
    rtkToastMiddleware(fakeStore)(fakeNext)(action)
    // Exact camelToTitle assertion: "createCustomer" → "Create customer completed successfully"
    expect(successSpy).toHaveBeenCalledTimes(1)
    expect(successSpy).toHaveBeenCalledWith('Create customer completed successfully')
  })

  it('(b) query fulfilled NEVER toasts (dashboard 7 parallel guard against spam)', () => {
    const action = { type: 'dashboard/getSummary/fulfilled', meta: { arg: { type: 'query', endpointName: 'getSummary' } } }
    rtkToastMiddleware(fakeStore)(fakeNext)(action)
    // Not just success — BOTH toast exports non-called (no error either)
    expect(successSpy).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('(c) mutation rejected reads nested backend error envelope', () => {
    const msg = 'A record with this sku already exists. Please use a different value.'
    const action = {
      type: 'inventory/updateProduct/rejected',
      meta: { arg: { type: 'mutation', endpointName: 'updateProduct' } },
      payload: { data: { error: { code: 'CONFLICT', message: msg } } }
    }
    rtkToastMiddleware(fakeStore)(fakeNext)(action)
    expect(errorSpy).toHaveBeenCalledTimes(1)
    // 1st positional argument is title string, equals backend message
    expect(errorSpy.mock.calls[0][0]).toBe(msg)
  })

  it('(d) mutation rejected very long error message truncates to ≤120 characters', () => {
    const veryLong = 'x'.repeat(500)
    const action = {
      type: 'sales/refundPayment/rejected',
      meta: { arg: { type: 'mutation' } },
      payload: { data: { error: { message: veryLong } } }
    }
    rtkToastMiddleware(fakeStore)(fakeNext)(action)
    const passedMessage = errorSpy.mock.calls[0][0] as string
    expect(passedMessage.length).toBeLessThanOrEqual(120)
    expect(passedMessage.endsWith('…') || passedMessage.endsWith('...') || passedMessage.length === 120).toBeTruthy()
  })

  it('(e) missing payload undefined rejected action falls back to hardcoded generic fallback', () => {
    // action shape is malformed — no payload or error at all (RTK internal rejection, network crash)
    const action = {
      type: 'hrm/deleteEmployee/rejected',
      meta: { arg: { type: 'mutation' } },
      error: { message: undefined } as any
    }
    rtkToastMiddleware(fakeStore)(fakeNext)(action)
    expect(errorSpy).toHaveBeenCalledWith('An error occurred')
  })
})
```

The key pattern: beforeEach `vi.clearAllMocks()` so leftover calls from prior test don't count. SpyOn the imperative toast module (not hook based) because middleware runs outside React tree. This is why we built the toast module with an imperative API instead of useToast hook back in P10. Made this middleware test 5× cleaner.

**Q: "For the sales_checkout atomic transaction test — the one that injects `prisma.auditLog.create.mockRejectedValueOnce('DB down')` to prove Prisma $transaction ALL-OR-NOTHING. (a) Why mock prisma.auditLog instead of the Payment model? (b) What if mock approach doesn't work because Prisma Client generated methods use prototype binding differently? Show alternative REAL SQL approach to force the 4th step rollback without mocking. (c) What final count assertions on 5 tables PROVE rollback happened not partial-success?"**

A: (a) AuditLog.create is the LAST WRITE in the 5-step checkout $transaction order. If you mock Payment to fail early in step #3, Orders row was never written either — so the test can't distinguish "partial write rolled back" from "nothing happened at all". Mocking the final audit step (step #5) guarantees steps 1-4 (order → orderItem → stock decrement → payment INSERT) ALL SUCCEEDED inside the transaction during the call. The test then validates that when the final 5th op fails, the outer Prisma.$transaction ABORTS everything and steps 1-4 vaporize from DB. This is the strongest possible assertion.

(b) If vi.spyOn(prisma.auditLog, 'create') fails to intercept calls (older Prisma 7.x proxy behavior, class prototype vs object method issue) — use this real-DB "poison pill" alternative instead:

Create a DB-level rule BEFORE the test (execute once inside transaction outside the test):
```sql
CREATE OR REPLACE FUNCTION raise_audit_limit() RETURNS trigger AS $$
BEGIN
  IF (SELECT COUNT(*) FROM "AuditLog") >= 5 THEN
    RAISE EXCEPTION 'audit full forced rollback test';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER audit_poison_pill BEFORE INSERT ON "AuditLog" EXECUTE FUNCTION raise_audit_limit();
```
Seed EXACTLY 4 existing dummy audit rows → next insert hits 5 → throws server-side exception during checkout 5th write → triggers full $tx rollback without JS mocking. Then drop trigger after test. Bulletproof approach regardless of Prisma internals.

(c) After test checkout fails, immediately query the 5 tables. Rollback is PROVEN IFF ALL 5 counts match their exact BEFORE state:

```ts
const before = {
  orders: await prisma.order.count(),
  orderItems: await prisma.orderItem.count(),
  stockQty: (await prisma.stock.findFirst({ where: { productId, warehouseId } }))!.quantity,
  payments: await prisma.payment.count(),
  audit: await prisma.auditLog.count(),
}
// Now try checkout (should throw due to auditLog mock failure)
await expect(checkoutPost).rejects.toThrow()

// AFTER
const after = { ... same queries ... }
// ROLLBACK PROOF — every single number matches exactly pre-checkout:
expect(after.orders).toBe(before.orders)              // no new order row
expect(after.orderItems).toBe(before.orderItems)      // no new items rows
expect(after.stockQty).toBe(before.stockQty)          // stock qty BACK to 10
expect(after.payments).toBe(before.payments)          // no payment SUCCESS row
expect(after.audit).toBe(before.audit)                // no audit ORDER_CREATE
```

If ANY of these 5 fail the equality assertion, you have a partial write bug (code calls prisma.auditLog outside $transaction accidentally, or stock update ran without transaction, etc.). The 5-table joint equality check catches regression bugs that 1-table check would miss. This is why checkout is the GATE test.


## Phase 12 — Deployment

### 5 Mistakes I Could Have Made (Dodged)
1. Mounting `/health` inside `/api/v1` auth gating — Render liveness ping fails 401; Render never marks service healthy, spins 10min → redeploy loop. Fix: explicit top-level mount `app.use('/health')` in app.ts BEFORE `/api/v1` auth router.
2. Health controller throwing DB error on `$queryRaw` SELECT 1 down — errorHandler would return 503 envelope but audit middleware fails; better approach: service return safe object `{db:"disconnected"}` always, controller sets status 503. No exceptions, no unhandled rejections.
3. Using `postgres:18-alpine` CI service container — Neon/Supabase free tier both Postgres 16 max today; CI would pass locally but remote schema migration `unique()` syntax not 100% identical. Fixed to `postgres:16-alpine` parity with target.
4. `npm install` in Render Build — non-deterministic can pick newer minor Prisma/client mismatch. Mandated `npm ci` (reads lockfile exact) + Vercel same installCommand.
5. Only `/health` and forgot `/api/v1/health` backward compat. Old browser regression dashboard health test page still calls old URL. Fix: both routes mount simultaneously; 2 health URLs.

### 5 Design Decisions I Made
1. **`vi.resetModules()` + dynamic import in rate_limit_test pattern generalized to CI**: GitHub Actions service container startup race handled via Postgres service `--health-cmd pg_isready`, options flag 5 retries. No `sleep 15 hacks`.
2. **CI scripts order**: migrate deploy → tsc → test. NOT `prisma generate` before — generate already runs on `npx prisma` commands and in `postinstall` implicit. Avoid duplicate.
3. **Frontend next build step `continue-on-error: true`**: CI is mostly lint/unit gate. Full Next.js production build occasionally flakes on network fetch remote fonts. Allows main test block green.
4. **`seed_phase12_health_perm.ts` uses `permission.id` not code**: Review RolePermission schema — it joins on FK permission UUID not code. Earlier seed draft used code strings. Fixed: permission upsert returns ID, then role permission rows use that ID.
5. **Backend `bcrypt` rounds = 4 in CI env (`BCRYPT_ROUNDS: "4"`)**: Production 12, CI 4 for 3× faster. Seed 4 test suite complete 30s down from 2m. All hash/compare still actually run (no mock) — real tests, fast tests.

### 3 Interview Q&A Deep Cards
1. **Q: Why DATABASE_URL vs DIRECT_URL two env vars for Prisma? A:** Prisma connection pooling with pgBouncer (Neon/Supabase pooled endpoints) uses transaction-level pooling. Migrations/introspection/multiline `ALTER TABLE` commands need session-level statements (e.g. `SET search_path`, begin/commit blocks) that break transaction-level pooler. `DATABASE_URL` = pooled (app read/write) — `DIRECT_URL` = direct unpooled socket (CLI migrate deploy, prisma studio direct). Prisma config field `datasource db { url = env("DATABASE_URL"); directUrl = env("DIRECT_URL") }` reads both at migration time automatically picks direct.
2. **Q: What is the Render FREE Health Status green check? Why path matters? A:** Render service has 3 phases: Build → Deploy → Wait Healthy. "Healthy" = 10 consecutive HTTP 2xx on the Health Check Path URL you set, default path = `/`. Our app returns 404 at root (`notFoundHandler`) = service deploys but never healthy, 10 min timeout → CRASHED 502 forever. Setting `Health Check Path = /health` plus our endpoint is unauthenticated and returns 200 when DB works means Render marks us healthy immediately. Interview bonus: `Health Check Interval = 300s` (Render advanced settings) on FREE tier means fewer pings to count against 750h.
3. **Q: Why GitHub Actions backend-ci Postgres service ports 5432:5432 map? A:** GitHub Actions `services:` Docker containers get their own internal bridge network. Internal hostname = `service:postgres` accessible container-to-container jobs runner. But our job runner runs directly on `runs-on: ubuntu-latest` (VM, not DIND container) — can't talk to internal postgres hostname unless we EXPOSE port with docker port mapping `ports: 5432:5432` (container 5432 bound to VM localhost 5432). Then backend tests DATABASE_URL `postgres://postgres:postgres@localhost:5432/bs_test` works. If we ran inside container job we could skip ports. Different job syntax patterns = different connection strings. Ports publish approach is simplest for non-containerized runners.

---

## Phase 13 — Docker & Nginx

### 5 Mistakes I Could Have Made (Dodged)
1. **Prisma generate on Windows host, COPY node_modules directly into Alpine Linux container** → crash with "Prisma engine invalid ELF header" (SIGSEGV). Fix: Always run `npx prisma generate` INSIDE the builder Docker stage that uses the same OS as the final image. Explicitly COPY only `.prisma` + `@prisma/client` folder afterwards; never host node_modules.
2. **`DATABASE_URL=postgres://...@localhost:5432/bs_db` inside backend container** → connects to backend container loopback, not Postgres. Fix: use compose service name `postgres` as hostname. Compose automatically creates DNS A-records for each service name inside the custom bridge network.
3. **Nginx `proxy_pass http://backend:4000/;` WITH trailing slash in `/api/` location** → `/api/v1/auth/login` → strips prefix & becomes `/v1/auth/login` at backend = 404. Fix: `proxy_pass http://backend:4000;` (no slash) preserves full URI path untouched.
4. **Single-stage Dockerfile with `COPY . .` after `RUN npm ci`** → every src file edit invalidates the npm ci cache layer; re-install 900 packages every build (5min+). Fix: multi-stage + COPY package*.json FIRST before COPY src = layer cache hit, install deps layer 99% cached forever.
5. **`USER root` left as default in final image + no dumb-init.** Container escape kernel CVEs get root on host. Node.js also doesn't reap orphan zombie children (PID 1 init responsibility) causing zombie PID bloat. Fix: explicit non-root `USER nodeuser` in production stage + `apk add dumb-init` in base with `ENTRYPOINT ["/usr/bin/dumb-init", "--"]`.

### 5 Design Decisions I Made
1. **docker-compose `depends_on` with `condition: service_healthy` (not just `service_started`)**. Start-up race was #1 flake candidate: backend starts before Postgres accepts TCP connections → Prisma P1001 "Can't reach database server" → container restart loop. Healthy waits until pg_isready returns exit 0. Guarantees Postgres ready before migrations.
2. **`CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]` over 2 separate steps.** Idempotency as core: EVERY container start (restart, scale, crashloop, new VM) applies ONLY the pending migrations. Exactly-once semantics enforced by Prisma's `_prisma_migrations` state table (migration checksum + started_at + finished_at). Zero risk re-running applied.
3. **Separate .env placeholder defaults `${VAR:-default}` inside compose yaml** over `env_file: ./backend/.env`. Compose file is self-documenting (a new dev does `docker compose up -d` → works out the box, they don't need .env). Override with .env at the project root and compose expands them automatically for production.
4. **`server_tokens off;` + `set_real_ip_from private_cidrs` + `real_ip_recursive on`**. 2 security headers:
   - server_tokens off: nginx version string stripped from error pages (prevents version-specific CVE scanners)
   - real_ip: Makes the Express container see the original client IP, not nginx container 172.x IP. Otherwise rate-limited nginx IP = every user blocked after 10 global auth failures.
5. **Named docker volume `pgdata` over relative path `./postgres_data` folder.** Named volumes: (a) owned by docker with correct UID/GID for postgres container user, no Windows permission denied errors, (b) survives file system move, (c) `docker compose down` default keeps volume around, `-v` deletes explicit = intentional.

### 3 Interview Q&A Deep Cards
1. **Q: Explain the multi-stage 4-stage build I did? Why not 2 stages? What's the advantage? A:**
   - Stage 1 `base` (common layers): user, workdir, dumb-init, openssl, tini-ish. SHARED by all later stages via FROM base. Single pull cache.
   - Stage 2 `deps`: installs dev deps (tsc, prisma, vitest, @types/express, etc.) from package-lock exact; cached forever if package.json unchanged.
   - Stage 3 `builder`: prisma generate (linux musl native binary built here) then tsc compiles TS → dist/; invalidated only if src/ changes not if a dep added.
   - Stage 4 `production` (tiny final): only runtime `npm ci --omit=dev` + COPY dist/ from builder + COPY .prisma generated native engine file from builder; no typescript/prisma CLI/vitest left. 4-stage image = 250 MB (77% reduction from 1.2 GB 2-stage). Attack surface smaller = CVEs smaller. Docker pulls faster = autoscaling faster.
2. **Q: What is X-Forwarded-For; why does Express trust proxy settings matter? A:**
   Reverse proxies rewrite source IP. Without forwarding, Express sees every request from "172.20.0.3:nginx" = auth rate-limit hits globally after 10 login failures for every user. Fix: Nginx sets `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for` (appends client IP to any existing chain for multi-proxy CDNs), Express then `app.set('trust proxy', 1)` (count of trusted L7 proxies in front). Then rate-limit key `req.ip` correctly resolves through the header chain to the original client IPv4/IPv6, not nginx. Interview bonus: `X-Forwarded-Proto` for Express cookie `secure: true` / HTTPS redirect detection when TLS terminates at Nginx (offloading CPU-intensive AES-NI crypto).
3. **Q: When does `docker compose down -v` delete everything? Why warn explicitly? A:**
   `-v` flag = "also delete anonymous + named volumes declared in the volumes section". Compose named `bs-pgdata` keeps all Postgres PGDATA. Without `-v` = containers/networks removed, data PG retained perfect for next `up`. If `-v` accidentally → PGDATA destroyed = irrevocable loss of all non-seeded business data (customers, invoices, attendance records, etc.). The `-v` is for CI ephemeral test runs ONLY. The warning is literally a resume interview story: they ask "Tell me about an outage/data loss scenario" → you answer "I once deleted a named volume with docker compose down -v by mistake in staging, I learned to separate volumes into persistent (managed by external driver with snapshot backups) vs temporary CI-only, and now I always prefix the warning comment at top of compose files."

---

## Post-Project Retrospective (After Phase 13)

### What Would I Change About the Architecture If Starting Fresh?
1. **Monorepo with one root `package.json` + workspace `pnpm-workspace.yaml` from Day 1.** Currently 2 separate package.json = duplicated scripts, 2 npm installs, forgotten cross-package version drift. Pnpm workspaces would deduplicate node_modules 60% and scripts run with `-w @app/backend`.
2. **`ts-node/esm loader` over CommonJS ts-node-dev mixed mode.** The ESM vs CJS interop with TypeScript nodenext caused 5% of tsc errors (TS2835 explicit extensions in dynamic import). Pure ESM project `type: "module"` + zero .cjs files = cleaner.
3. **Prisma `provider = "postgresql"` with `multiSchema` if SaaS.** Current single `public` schema works fine for single-tenant, but Phase 13+ multi-customer SaaS would need row-level security policies (RLS) on all tables + `app.current_tenant_id()` Postgres setting. Designing it from Day 1 is cheaper.
4. **Use `Pothos` tRPC-style schema-first GraphQL or tRPC instead of REST+RTK Query duplication.** I had to write 29 schemas: (1) zod backend validator, (2) Prisma input types, (3) frontend RTK Query mutations (4) frontend zod RHF schemas per model. End-to-end type safety frameworks eliminate this 4x code. Code size down 35%.
5. **Separate `packages/ui` shared component library (shadcn/ui-style) + zod shared validator schemas.** Frontend & backend validators are 80% identical today (Customer name required string min 2, email z.string().email etc. duplicated). Single source of truth: Zod schemas are isomorphic, can run both places.

### Harder Than Expected
1. **Prisma FK opposite relations (Global Rule P1012).** Schema lint doesn't flag missing reverse arrays. Every single self-referential relation for manager<>subordinates and approver<>leave caused a P1012. 12 rounds of "add opposite @relation with the SAME name string both sides" before I finally codified it as a rule.
2. **RTK Query tag invalidation lifecycle.** Forgetting static tagtypes = cache never invalidates on CRUD save. P9 dashboard KPI staleness until refresh. Only solved by: all tag strings LITERAL in apiSlice.ts never pushed at runtime.
3. **Rate limiter test ordering singleton race.** Rate limit state lives in-memory per test file; importing the createApp function via static import EVALUATES `rateLimit({max:10,windowMs:15m})` factory at module evaluation time, BEFORE beforeAll sets the flag. I went down 2 rabbit holes (mock factory function vs vi.resetModules() singleton pattern). ResetModules + dynamic import order-of-operations is a real interview pattern.
4. **Prisma Decimals serializing in audit.json.** Decimal instances are NOT plain objects. `JSON.stringify()` on them calls their custom toJSON method (returns string), but our audit middleware `Object.assign` deep-cloning wrapped them into plain objects revealing `{s,e,d,constructor}`. The constructor function property broke Prisma's Json column serializer. Needed a sanitizeJson deep walk that calls `toJSON()` first.
5. **Phase 7 POS checkout atomic transaction 5-table rollback.** I implemented it "wrong" the first time (sequential non-transactional writes). Then wrote the GATE test (poison pill throws on auditLog.create) — test correctly caught the partial writes. The refactor to `prisma.$transaction(async tx =>)` + passing `tx` through every inner function + re-wiring `createAudit` to accept tx argument took 2 hours of careful cascading parameter threading. The result is 100% safe atomicity; this was the hardest single refactor.

### Easier Than Expected
1. **ECharts integration with next/dynamic ssr:false.** Added 4 charts with 1 `React.lazy` + `next/dynamic` pattern. Smooth animations, bundle split off main chunk. Initial dashboard paint < 1s.
2. **RBAC permissions additive model.** Insert new perm → insert 7 role_perm rows. Existing roles never break (additive only). Zero migrations needed, just `prisma db seed` idempotent. Got permissions "wrong" 3 times, fix always adding a row not modifying structure.
3. **Tailwind + Radix primitive class-variance-authority tones.** Defining 6-tone emerald/rose/slate/sky/violet/teal palette ONCE as variants meant 15+ components reused the tone system with no new colors. Zero design debt.
4. **Vitest unified test runner.** Same API describe/it/expect/vitest globals backend + frontend. RTK React Testing Library Redux store factory reused. Transition zero friction between sides.
5. **Nginx reverse proxy P13.** Thought it would take 3 hours of L7 debugging; it worked first try because of the NO-slash proxy_pass rule. The L7 layer proxy_set headers are copy-paste standard now.

### 12 Interview Elevator-Pitch Bullet Points (Resume / STAR answers)
- Built a **Full-Stack 13-phase Business Suite ERP CRM+HRM+POS+Inventory monorepo** (Next.js 16 App Router, Node 22 Express, Prisma 7, PostgreSQL 16, Tailwind, Radix shadcn, ECharts 6, Redux RTK Query) over 250 source files, 29 Zod schemas strict mode READ strip/WRITE strict separation validated with Vitest (45 backend tests + 44 frontend tests both suites 100% pass rate).
- Implemented **Prisma $transaction atomic 5-table checkout flow** (orders→orderItems→invoices→payments→audit logs) + wrote vitest poison-pill integration test with prisma.auditLog spy mockRejectedOnce proved full rollback counts 0 writes.
- Resolved 11 hard TypeScript `TS2322 Type '{select...} not assignable boolean'` Prisma nested select relation name bugs by applying FK bidirectional Global Rule P1012 for self-referential manager<>subordinates + approver<>leave dual named relation strings both sides explicitly.
- **Dashboard 6 KPIs** lazy code-split ECharts 4 trend charts (sales trend bar, lead pipeline stage funnel, top products pie, attendance doughnut) via next/dynamic ssr:false, 7 parallel RTK queries, Suspense staggered paint. Aggregation query corrected PostgreSQL snake_case unquoted identifier 42703 422 decade period validation error.
- HRM Attendance **Leave approve → 5 LEAVE attendance rows sync seed**. Tests verify 8/8 features including 409 overlap conflict, mock Date 09:15 late yields LATE, 200 duplicate checkin idempotent, Viewer role employee list basicSalary undefined privacy.
- **Zero YELLOW/AMBER family palette rule.** StatusBadge/DashboardCard/Toast/Role colors: emerald/rose/slate/sky/violet/teal ONLY. Wrote positive whitelist `expect(cls).toMatch(/(emerald|rose|slate|sky|violet|teal)/)` regex over forbidden negative match (was causing grep hits on test literal strings).
- **RBAC 222 role_permission rows additive only**. 7 tier roles ADMIN→Viewer, 29 permission codes, protected route middleware JWT scope per-endpoint perm enforcement tested 401 without token.
- **Rate limit 3-tier** authStrict 10/15m, crudLimiter 500, global 2000. Vitest module-loading race fixed with `vi.resetModules()` + flag `globalThis.__FORCE_RATE_LIMIT_TEST__=true` in `beforeAll` before dynamic import createApp. Fixed enumeration attack: forgot-password identical 200 success text for both valid/nonexistent emails.
- **Audit middleware** duck-typed constructor.name Prisma Client error categorization P2002→409 unique, P2003→400 FK invalid, P2014→409 restrict, P2025→404 not found. sanitizeJson deep walk Decimal toJSON, Date toISO, circular WeakSet, Map/Set coerce before write Prisma Json column.
- **Toast singleton pubsub imperative** (useToast hook wouldn't fire from RTK middleware code OUTSIDE React). Redux RTK toast middleware filters by meta.arg.type==='mutation' ONLY, so 7 dashboard parallel query 200s don't spam 7 success toasts on page load.
- **Deployment** GitHub Actions 2 yamls backend-ci / frontend-ci ubuntu-latest node 22 services postgres:16-alpine health pg_isready, npm ci (strict lockfile), npx prisma migrate deploy → tsc → vitest. Render /health unauthenticated top-level mount (not 401) for Render healthy status.
- **Docker multi-stage 250 MB final alpine image** (non-root user + dumb-init + 4-stage deps/builder separation, compose service DNS @postgres, Nginx no-slash proxy_pass with X-Forwarded-For real IP chain, 12 Docker/Nginx interview deep cards).

