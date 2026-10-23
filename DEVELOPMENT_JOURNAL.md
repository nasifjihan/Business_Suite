# Development Journal — Business Suite

A running record of decisions, problems and their causes for the V2 completion
work. The plan itself lives in [PLAN.md](PLAN.md); this file records what
actually happened, in order, including the parts that went wrong.

The earlier build (Phases 0–14) is documented in
[BUILD_PROCESS.md](BUILD_PROCESS.md) and `docs/learning-notes.md`. This journal
picks up from there.

---

## 2026-10-23 — Audit and plan

### What prompted this

Asked to assess an "unfinished" project. The project turned out to be
**functionally complete through Phase 14** — every module has migrations, seeds,
services, validators and UI. The unfinished part was narrower and more specific:
the last four commits were a deployment-plumbing run that ended abruptly
(`frontend dockerization` → `database to neon` → container DB made configurable
→ `asas` → `revice`), and it left behind dead code, a documented-but-missing test
layer, and three features that the UI itself labels "Coming soon".

### Findings

| Category | Finding |
|---|---|
| Dead code | `middleware/rbac.ts` — Phase-1 stub, **zero imports**. `middleware/auditLogger.ts` — Phase-1 stub, mounted in `app.ts`, no-op with a `TODO(phase3)`. |
| Security | `Note.md` line 3 holds a plaintext Postgres password, and the file is tracked in git. |
| Missing tests | Playwright: spec'd in Phase 11, config and specs never written. README states this outright; BUILD_PROCESS still shows the directory. |
| Doc drift | BUILD_PROCESS folder tree lists `nginx/` (Dockerfile + conf) which does not exist — nginx is a stock image with the root `nginx.conf` bind-mounted. |
| Placeholders | Password-reset email is a `console.log` fake; 2FA card reads "Coming soon"; `Product` has no `imageUrl` column. |
| Missing docs | No `PLAN.md`, no `DEVELOPMENT_JOURNAL.md`. |

### Decisions made

1. **Order: cleanup → security → features → tests → docs.** Docs go last so they
   describe code that has stopped moving. This is the same mistake the repo
   already contains once — BUILD_PROCESS promising a `playwright/` directory that
   was never created.
2. **Nodemailer with generic SMTP**, not a vendor SDK (Resend/SendGrid/SES). One
   dependency that works with all of them keeps the choice reversible.
3. **TOTP via `otplib`**, standard authenticator apps — no SMS provider, no
   per-message cost, no phone-number handling.
4. **Uploads: local disk behind a single module**, relative path in the DB. Keeps
   the dev/Docker path working now and leaves S3 as a contained change later.
5. **No new permission codes.** Image upload reuses `inventory.products.update`;
   2FA is self-service under `auth`. The 143-code RBAC matrix stays untouched.
6. **Playwright lives in a root `playwright/` package**, not in `frontend/` — the
   browser binaries and test deps stay out of both app images.
7. **All new env vars go into the Zod schema in `config/env.ts`.** This is
   Phase 14 bug #5: vars set in `docker-compose.yml` but absent from the schema
   fail *silently*, because `z.object()` ignores unknown keys.

### Risk identified before starting

**The 2FA login change touches the most-tested path in the application.**
`POST /auth/login` currently returns tokens directly; with 2FA enabled it must
return a short-lived challenge instead, with a second endpoint to verify the
code. Every existing auth test exercises the current contract. Plan Phase 4
therefore starts by enumerating the affected tests *before* touching code,
and the 2FA-off path must remain byte-for-byte unchanged.

### Known limitation recorded, not fixed

The password in `Note.md` is **still present in git history** (`git log -p
-- Note.md`). Editing the file does not remove it. Removing it properly needs a
history rewrite (`git filter-repo`) plus credential rotation on the database.
Both are owner decisions with real consequences, so this is flagged rather than
performed.

---

## 2026-10-23 — Phase 0: Baseline verification

### Environment surprise

This machine is a **fresh clone**, not the machine the project was built on.
Nothing was installed and nothing was configured:

| Check | Result |
|---|---|
| `backend/node_modules` | missing |
| `frontend/node_modules` | missing |
| `backend/.env` | missing |
| `frontend/.env.local` | missing |
| PostgreSQL installed | **No** — `C:\Program Files\PostgreSQL` does not exist |
| PostgreSQL service | not found |
| Listening on 5432 / 5433 | nothing |
| Docker daemon | **not running** (CLI present at DockerDesktop resources/bin) |

`Note.md` documents a PostgreSQL 18.6 install (port 5432, db `business_suite`)
that no longer exists here. The recent commits moved the app to Neon, but that
connection string lived in a gitignored `.env` which is absent.

**Lesson:** an `.env.example` is not a substitute for a `.env`. The repo is
clone-and-run *only* if the reader re-creates the environment, and the README's
"no configuration needed" claim for Docker Option A assumed a running daemon.

### Actions

1. `npm install` in `backend/` and `frontend/` (540 packages frontend, plus
   backend). Both reported audit findings — 24 vulns backend, 14 frontend. Not
   addressed here; recorded as follow-up.
2. `prisma generate` failed initially: `prisma.config.ts` refuses to load without
   `DATABASE_URL` or `DIRECT_URL`. Generating a client does not need a *live*
   database, only a parseable config, so it was run with a placeholder URL to
   unblock type checking. This is a diagnostic, not a fix — the real `.env` is
   still required.

### Baseline results

| Gate | Command | Result |
|---|---|---|
| 0.1 | `backend: npm run lint` (`tsc --noEmit`) | ✅ **0 errors** |
| 0.2 | `backend: npm test` | ⛔ **blocked** — needs a live test database |
| 0.3 | `frontend: npm run typecheck` | ✅ **0 errors** |
| 0.4 | `frontend: npm test` | ✅ **44 passed / 44** (7 files, 4.68s) |
| 0.5 | database reachable | ❌ **unavailable** |

Frontend is green. Backend type-checks clean. Backend *tests* are the only
unverified gate, and they are unverifiable until a database exists — which
blocks Phases 3–6 as well (migrations, seeded E2E runs).

**Decision:** treat database provisioning as a prerequisite, not a phase. It is
an environment concern, and Phase 6 (Playwright) needs the full Docker stack
regardless, so Docker is the path of least resistance.

Incidental finding: the frontend Vite config emits a native-loader warning
(ESM syntax in a file loaded as CommonJS, `vitest.config.ts:1:1`). Harmless
today, will break when Vite changes its default loader. Recorded, not fixed —
out of scope for this plan.

---

## 2026-10-23 — Phase 0 close-out: environment provisioned

Docker Desktop was launched on request. The `bs-pgdata` volume **already
existed** and already had all 8 migrations applied — Postgres logged
`database system was interrupted; last known up at ...`, which a fresh
`initdb` cluster never does. The data directory was empty of *rows* but not
of *schema*. So "fresh clone" was true of the working tree, not of Docker's
state.

Seeded `bs_db` and confirmed the seed matches the README's claims:

| Entity | Count | README claim |
|---|---|---|
| User | 1 | "creates **one** user" ✅ |
| Role | 7 | "All seven roles" ✅ |
| Permission | 143 | "143 permission codes" ✅ |
| RolePermission | 554 | — |
| Product | 1 (demo fixture) | — |

### Baseline re-run — all gates green

| Gate | Command | Result |
|---|---|---|
| 0.1 | `backend: tsc --noEmit` | ✅ 0 errors |
| 0.2 | `backend: npm test` | ✅ **48 passed, 7 skipped** (8 files, 83s) |
| 0.3 | `frontend: tsc --noEmit` | ✅ 0 errors |
| 0.4 | `frontend: npm test` | ✅ **44 passed / 44** |
| 0.5 | database reachable | ✅ Postgres 16.15 in Docker on 127.0.0.1:5433 |

### New finding 1 — `localhost:5433` does not work on this machine

`prisma migrate deploy` failed with **P1001 "Can't reach database server"**
against `localhost:5433`, while the container was healthy and
`docker exec` worked fine.

Diagnosis: `127.0.0.1:5433` → **OPEN**, `[::1]:5433` → **FAILED**. Node 17+
resolves `localhost` using the resolver's own ordering (`verbatim`), so `::1`
is tried first. Docker Desktop's loopback forward only serves IPv4 here, so
the IPv6 attempt is refused and Prisma reports the whole host as unreachable.

**Impact:** the README's documented seed command uses
`postgresql://postgres:postgres@localhost:5433/bs_db` — that instruction fails
on Windows. Both `backend/.env` entries now use `127.0.0.1`, and the README
needs the same correction in Phase 7.

This is the same class of bug the project already documents in
`docker-compose.yml`, where the nginx healthcheck had to switch from
`localhost` to `127.0.0.1` for exactly this reason — the lesson existed in the
repo but was never applied to the database connection strings.

### New finding 2 — `frontend/.env.local.example` did not exist

README step 4 says `cp .env.local.example .env.local`. **The file was never
created** — it is absent from the repo, and `frontend/.gitignore`'s `.env*`
rule would have ignored it even if it were. Anyone following the README hit a
file-not-found on their first run.

Fixed: created `frontend/.env.local.example` (documenting `NEXT_PUBLIC_API_URL`
and `NEXT_PUBLIC_APP_NAME`, both with the two valid API URLs) and added a
`!.env.local.example` negation so the template is actually committed.
Verified with `git status` showing it as untracked-but-not-ignored.

### New finding 3 — 7 skipped tests, and one group that cannot pass

`npm test` reports *7 skipped*. Inspected rather than accepted:

| Test | Why skipped | Verdict |
|---|---|---|
| `auth`: register with existing email → 409 | `POST /auth/register` **does not exist** (registration is admin-only via `/users`) | Dead test — should be deleted, not un-skipped |
| `auth`: register valid user → 201 | same | Dead test |
| `auth`: strict limiter 429 after 10 logins | timing-dependent | Real gap |
| `rate_limit`: 2100 requests → 429 | explicitly marked "(slow)" | Deliberate |
| `rate_limit`: 110 anon requests → 429 | explicitly marked "(slow)" | Deliberate |
| `health`: prisma failure → 503 | mocking regression | Real gap |
| `sales_checkout`: refund valid order → 200 | never re-enabled | Real gap |

Two tests cover an endpoint that was never built, so they can never pass. Three
represent genuine untested behaviour. The suite reads as fully green at a
glance, which is exactly how a skipped test hides a gap.

**Decision:** fold into Phase 6. Delete the two dead tests, and either
un-skip or explicitly justify the other three in a comment.

### New finding 4 — documented test counts no longer match reality

`BUILD_PROCESS.md` and `docs/learning-notes.md` claim "45 backend tests + 44
frontend tests". Actual: **55 backend (48 pass + 7 skip) and 44 frontend**.
Phase 14's table also records "42 passed / 6 failed" pre-fix. The frontend
number still holds; the backend number has drifted. Correct in Phase 7.

### Lockfile churn

`npm install` rewrote both lockfiles — **removals only** (backend −42 lines,
frontend −144), consistent with npm 10.8.2 pruning stale entries. Kept: any
future `npm install` would regenerate the same diff, and reverting would make
the lockfile disagree with the installed tree.

---

## 2026-10-23 — Phase 1: dead middleware removed

Verified by grep before deleting: `middleware/rbac.ts` had **zero imports**
anywhere (the only "rbac" hits were the unrelated `seed_phase3_rbac.ts` filename
and a `package.json` keyword). `auditLogger` appeared only in `app.ts`.

| Action | File |
|---|---|
| Deleted | `backend/src/middleware/rbac.ts` |
| Deleted | `backend/src/middleware/auditLogger.ts` |
| Edited | `backend/src/app.ts` — removed import + `app.use()`, renumbered the middleware-order comment, added a note explaining *why* there is no global audit middleware |

Replaced the renumbered comment block with an explicit note rather than silent
renumbering: without it, the next person sees a missing step 7 and may helpfully
add a global auditor back — which cannot work, because capturing a PATCH's
*before* snapshot is impossible from global middleware. The reason lives in
`middleware/audit.ts`'s header comment; the note now points at it.

**Gate:** `tsc --noEmit` → **0 errors**; no `TODO(phase3)` remains in `backend/src`.

---

## 2026-10-23 — Phase 2: committed credential scrubbed

`Note.md` line 3 held a plaintext Postgres password and the file is tracked in
git. Replaced with `<your-local-postgres-password>` plus an inline warning.

Swept the whole repo for other copies of the same string: **none**. Checked
`Admin@123`, `postgres:postgres@` and similar patterns — the remaining hits are
all deliberate, documented demo values (`Admin@123` is the README's advertised
seed password and appears in the seed script and the login page's helper text;
`postgres:postgres` is the compose file's documented default). Those are
intentional and were left alone.

**Not fixed, deliberately:** the password remains in git history. Removing it
needs `git filter-repo` plus a database credential rotation — both owner
decisions with consequences beyond this codebase. Flagged, not performed.

**Gate:** no credential in the working tree; rotation flagged as an owner action.

---

## 2026-10-23 — Phase 3: real email delivery (SMTP)

`forgotPassword` used to `console.log` a fake email. The token/reset flow around
it was already complete and enumeration-safe — only *delivery* was missing, so
this phase is deliberately narrow: add a transport, add a template, call them.

### Decision — Nodemailer over a vendor SDK

`nodemailer` speaks plain SMTP, which Resend, SendGrid, SES, Mailtrap, Mailpit
and a bare local MTA all expose. One dependency instead of a provider-specific
client, and switching providers becomes an env-var change rather than a code
change. Rejected the Resend SDK (nicer API, but it makes the provider a
compile-time dependency of an open-source core).

### Files

| File | Change |
|---|---|
| `backend/src/lib/mailer.ts` | **New.** Lazy transport, `sendMail()` returning a boolean, `renderPasswordResetEmail()` |
| `backend/src/config/env.ts` | +7 optional vars (`MAIL_ENABLED`, `SMTP_HOST/PORT/SECURE/USER/PASS`, `MAIL_FROM`) and a `CONFIG.mail` block |
| `backend/src/modules/auth/services.ts` | `forgotPassword` now renders and sends; console fallback only when `sendMail` returns false |
| `backend/.env.example` | Email section with provider recipes (Resend/SendGrid/Gmail/Mailpit) |
| `docker-compose.yml` | Same 7 names passed through, all defaulted |
| `backend/src/tests/unit/mailer.test.ts` | **New.** Unit: disabled by default, link in all parts, greeting fallback |
| `backend/src/tests/unit/auth-mail.test.ts` | **New.** Integration: right recipient, failure stays invisible, no send for unknown address |

### The design choice that made testing possible

Two candidate shapes for the wiring:

1. `if (CONFIG.mail.enabled) { await sendMail(...) }` in the service.
2. Call `sendMail()` unconditionally; let *it* decide, and treat `false` as
   "not delivered".

Chose (2). Externally the behaviour is identical — mail is still inert when
disabled — but the fallback becomes one rule (`if (!delivered)`) that also
covers a *failed* send, which is the case shape (1) silently drops: the old code
would have thrown away the reset link entirely when SMTP was up but rejecting.
It also puts the decision in one place instead of two, and lets the integration
test assert "the mailer was asked to send to the right address" without having
to mutate a frozen `CONFIG` object.

### `sendMail` never throws

Mirrors `writeAudit()` in `middleware/audit.ts`: catch, `console.error`,
return false. This is not defensive padding — the endpoint's contract is "answer
`{ ok: true }` for every input, including addresses that do not exist". A 500
from a dead SMTP host would reintroduce exactly the enumeration oracle the
contract exists to close, since `{ ok: false }` would only ever appear for real
accounts.

### Verifying the transport for real, without credentials

The gate is "with `MAIL_ENABLED=true` and valid creds, a real message arrives".
Rather than stopping at mocks, ran a throwaway probe against **Mailpit** —
`docker run axllent/mailpit`, `MAIL_ENABLED=true SMTP_HOST=127.0.0.1 SMTP_PORT=1025`,
then read the message back from Mailpit's API:

```
mail.enabled = true | host = 127.0.0.1 | port = 1025
sendMail returned: true
Subject : Reset your Business Suite password
Snippet : Reset your password Hi Admin, We received a request to reset the
          password for your Business Suite account. This link is valid ...
```

The text part contained `http://localhost:3000/reset-password?token=gate-check-token`
and the HTML part rendered the button. This is a genuine end-to-end proof of the
transport options (no auth, port 1025, `secure: false`) that unit tests cannot
give. Probe script and container were deleted afterwards; the repo has no trace.

### Result

`tsc --noEmit` → **0 errors**. `npm test` → **55 passed, 7 skipped (62)** in 10
files, up from 48 passed (7 new tests). `MAIL_ENABLED=false` behaviour is
byte-for-byte unchanged, so every existing test still passes untouched.

**Gate met.** Left for Phase 7: document the new vars in the README env table.

---

## 2026-10-23 — Phase 4: two-factor authentication (TOTP)

The profile page had a dashed "Coming soon" card for 2FA and the login form had
no concept of a second step. Both are now real.

### Decision — TOTP, encrypted secrets, and a challenge token

TOTP (RFC 6238) via `otplib` + `qrcode`: works with every standard authenticator
app, needs no SMS provider and no per-message cost, and degrades gracefully when
the user's phone is offline.

Two security decisions were escalated to the owner rather than assumed:

1. **Login contract — `200 + challengeToken`.** With 2FA on, `POST /auth/login`
   answers `200` with `{ twoFactorRequired: true, challengeToken }` and issues
   **no** access token and **no** refresh cookie. The alternative (a `401` that
   the frontend interprets as "2FA") was rejected because `401` is already the
   wrong-password answer, so the two states would be indistinguishable to any
   client that only looks at the status code. A second call to
   `POST /auth/2fa/verify` exchanges the challenge plus the code for the normal
   session payload.
2. **Disabling 2FA requires the password.** Without this, a stolen live session
   could silently strip the second factor, which defeats the point of having one.

### Encrypted, not hashed

`twoFactorSecret` is stored **encrypted** (AES-256-GCM), unlike recovery codes
which are SHA-256 hashed. This is not an inconsistency: verifying a 6-digit code
means *recomputing* it, so the server must be able to recover the plaintext
secret. Hashing it would make verification impossible. GCM also authenticates
the ciphertext, so a tampered row fails closed rather than decrypting to garbage.

The stored format is `v1.<iv>.<tag>.<ciphertext>` (all base64url). The version
prefix exists so a future key rotation is *detectable* rather than silently
misparsed into a wrong-but-plausible secret. `decryptSecret()` returns `null`
rather than throwing, because its caller is a login path that must degrade to
"please sign in again" instead of a 500.

`CONFIG.twoFactor.encryptionKey` falls back to `JWT_ACCESS_SECRET`, and the
fallback uses `||` and not `??` — Docker passes unset variables through as
**empty strings**, and `""` is not nullish, so `??` would have handed the
cipher a blank key that hashes to a *different* AES key than the documented
default. That would have silently broken every enrolment made before the
`.env` was filled in.

### Enrolment is two-phase on purpose

`POST /auth/2fa/setup` generates and stores the secret but leaves
`twoFactorEnabled` **false**. Only `POST /auth/2fa/enable` — which requires a
live code, proving the secret actually reached the device — flips the flag. A
user who scans the QR code and then closes the tab therefore cannot lock
themselves out behind a secret they never successfully imported.

`setup` also regenerates the secret on every call, so an abandoned attempt can
never be the one that ends up enrolled.

### The token type is the security boundary

The challenge is signed with the same `accessSecret` as a normal access token,
so signature verification alone cannot tell them apart. What separates them is a
different `type` literal — `2fa_challenge` versus `access` — and each verifier
rejects the other's. Without that field, the challenge token would have been a
fully valid Bearer token for its 5-minute lifetime, silently bypassing 2FA
entirely. There is a test that asserts a challenge token gets `401` from
`GET /auth/me`.

### Recovery codes

Ten codes, hex, grouped 5-5-5-5 (`4F9A2-C10B7-8E3D5-A6F42`). Hex rather than a
full alphabet because these get read off a screen and typed on a phone, and
0/O and 1/l confusions are the main way that goes wrong. 80 bits is ample for a
code that is single-use and rate-limited.

They are returned in plaintext **exactly once** and stored only as hashes; there
is deliberately no endpoint to read them back. Consumption filters the array
with `{ set: [...] }` rather than `{ push: ... }`, so two concurrent verifications
cannot both spend the same code.

### Testing without weakening anything

`backend/src/tests/unit/auth_two_factor.test.ts` (9 tests) drives the real HTTP
surface with no service mocking, because what is most likely to break is the
*contract between the two login steps* — and that contract only exists at the
route layer. Codes are generated with `otplib` from the secret the server itself
returned in the setup response, which keeps the test honest: it proves the
QR/manual-entry secret really is the one enrolled.

Covered: 2FA-off login unchanged; setup does not enable; full enable → challenge
→ verify round trip; wrong code rejected with no cookie; recovery code accepted
once then rejected; challenge token rejected as a Bearer token; disable requires
the password and wipes the secret; status counts; all four management routes
`401` without a token.

### Problems hit

**1. Prisma client was stale.** First `tsc --noEmit` after the service changes
produced 20 errors, all "property `twoFactorEnabled` does not exist on type
`User`". The migration was applied and `schema.prisma` was edited, but the
*generated client* had not been rebuilt. `npx prisma generate` fixed all 20 at
once. Worth remembering: in Prisma 7 the client is generated code, so editing
the schema is not enough for the type checker.

**2. A real bug caught by design, not by a test.** The first draft of the login
form reused the login mutation's `isSuccess` flag to render "Signed in —
redirecting…". But `isSuccess` flips to `true` as soon as step 1 answers — which
is exactly when we show the *code prompt*. The screen would have announced
"Signed in" before the second factor was entered. Replaced with an explicit
`signedIn` state set only by the shared `finishLogin()` helper, so the flag means
one thing: a real session is in the store.

### Result

`tsc --noEmit` → **0 errors** on both sides.

| Suite | Before | After |
|---|---|---|
| backend `npm test` | 55 passed, 7 skipped | **64 passed, 7 skipped** (11 files) |
| frontend `npm test` | 44 passed | **44 passed** (7 files) |

The `login` return-type change was the flagged risk — it touches the most-tested
path in the app. Every affected test was enumerated before the edit (5 in
`auth.test.ts`, 1 in `rate_limit.test.ts`) and all passed unchanged, which is the
point of the `LoginOutcome` union: the compiler, not a reviewer, forces the 2FA
branch to be handled.

**Gate met.** Left for Phase 7: document `TOTP_ENCRYPTION_KEY` / `TOTP_ISSUER` in
the README env table.

---

## 2026-10-23 — Phase 5: product image upload

`Product` was the only catalog entity with no image column, while the UI's
detail page drew a gradient placeholder and the spec had already named the
constraints (PNG/JPG/WebP, 2 MB, UUID filenames). This phase adds the column,
the upload path, the serving path, and the two UI touch points.

### Decision — serve uploads from Express, not nginx

The plan's step 5 said: mount static at `/uploads` and add a `location` to
`nginx.conf`. That was superseded, and the reason is worth recording because it
was the one place this phase diverged from its own plan.

`nginx.conf` already has `location /api/ { proxy_pass http://backend:4000; }`.
Mounting the static handler at **`/api/v1/uploads`** therefore needs *no nginx
change whatsoever* — the images ride the existing proxy rule. The alternative, a
second top-level `/uploads` location, would have introduced a second path
prefix the frontend had to know about, and a second nginx block to keep in sync
with the backend.

That in turn is what makes the **relative path** viable. `imageUrl` stores
`/api/v1/uploads/<uuid>.png`, never an absolute URL, so one database row is
correct in all three places the app runs (dev `:5000`, Docker via nginx, real
production). The cost lands on the frontend — see `resolveAssetUrl` below — and
it is a small, one-time cost paid for a row that never has to be migrated.

### The extension comes from the bytes, not the filename

`detectImageType()` checks magic bytes: the 8-byte PNG signature, `FF D8 FF` for
JPEG, `RIFF....WEBP` for WebP. The client's `Content-Type` and filename are
ignored for anything but display. A file called `logo.png` that is really a JPEG
is stored as `<uuid>.jpg` and served as `image/jpeg`; there is a test asserting
exactly that. Filenames are server-generated UUIDs, so a crafted name cannot
escape the upload directory or overwrite an existing file — and
`deleteImageByUrl()` still double-guards, with `path.basename()` plus a
`startsWith(resolve(dir) + sep)` check, because a path helper that can only ever
be handed a UUID should not be *relied upon* to only ever be handed a UUID.

### `authorize()` before `multer`, and memory rather than disk

The route is
`authorize("inventory.products.update") → uploadSingleImage("file") → controller`.
Order matters: an unauthenticated or unauthorised caller is rejected before a
single byte of their body is buffered.

`multer.memoryStorage()` rather than `diskStorage()`. With a 2 MB cap the whole
file fits comfortably in memory, and buffering means a rejected upload (wrong
type, bad size, failed transaction) leaves **nothing** on disk to clean up. The
disk variant writes the file first and then needs an unlink on every rejection
path — including the ones that throw before reaching the handler.

The size cap is enforced by multer *before* the bytes are written anywhere, and
the resulting `MulterError` is translated to a project-standard envelope: an
`AppError` with `StatusCodes.REQUEST_TOO_LONG` (413 — the constant is named
`REQUEST_TOO_LONG`; there is no `CONTENT_TOO_LARGE` export in
`http-status-codes`) plus a `PAYLOAD_TOO_LARGE` code in `errorHandler`.

### Ordering: write the file, then the row

The service writes the file first, then updates the row inside a transaction
that also writes the audit entry — matching what `ProductService.update` already
does.

- The file is written **before** the row, so a rejected image never leaves a row
  pointing at a file that does not exist.
- If the transaction fails, the new file is deleted and the row still points at
  the old one.
- The **previous** file is deleted only **after** commit, and best-effort: at
  that point nothing references it, and failing to delete it must not turn a
  successful upload into an error.

### The static mount sits above the rate limiter

`standardLimiter` allows 100 requests per 15 minutes. A product grid showing 24
thumbnails would spend a quarter of that budget merely by rendering, pushing
normal use into `429`s. The static mount is therefore registered **before** the
limiter, so image traffic does not compete with the API calls the limiter exists
to protect. The comment in `app.ts` says so, since the order looks arbitrary
otherwise.

### The Dockerfile must own the upload directory

`UPLOAD_DIR=/app/uploads` in compose, backed by the `bs-uploads` named volume.
The subtlety: Docker seeds a **brand-new** named volume from the image's
directory contents and ownership. If `/app/uploads` does not exist in the image,
the volume is created root-owned, and every upload then fails `EACCES` **while
the container healthcheck still reports healthy** — a failure that only shows up
on the first real upload. So the Dockerfile does
`RUN mkdir -p /app/uploads && chown -R nodeuser:nodegrp /app`.

### Frontend: `resolveAssetUrl`

Storing a relative path moves one problem to the browser. In dev the UI is on
`:3000` and the API is on `:5000`, so `<img src="/api/v1/uploads/x.png">` would
resolve against `:3000` and 404. `resolveAssetUrl()` takes the origin from
`NEXT_PUBLIC_API_URL` (which always ends in `/api/v1`, and uploads share its
origin) and prefixes it; when that URL is itself relative — the nginx case — the
stored path is already correct and is returned unchanged.

The new `ImageUploadField` mirrors the server's type and size checks purely as a
courtesy, so an obviously wrong file never leaves the browser; the server repeats
both and is the only one enforcing them. It is wired into the **edit** forms
only: an upload needs a product id, and in the create form the row does not exist
until the POST returns.

### Problems hit

**1. `migrate dev` only migrates the development database.** All 10 new tests
failed with Prisma `P2022` — "The column `Product.imageUrl` does not exist in
the current database" — cascading into `TypeError: Cannot read properties of
undefined (reading 'id')`. The migration had been applied to `bs_db`, but the
test suite runs against `bs_test`, which had never seen it. Fixed with
`npx prisma migrate deploy` pointed at `bs_test`, verified directly in `psql`
against both `_prisma_migrations` and `information_schema.columns`. This is the
same family of trap as Phase 4's stale-client lesson: `migrate dev` is
dev-only, and each environment carries its own schema state.

**2. `UPLOAD_DIR` could not be set from `src/tests/setup.ts`.** The first attempt
set it there and had no effect. `setup.ts`'s imports are hoisted above its
statements, so `config/env.ts` — which resolves `UPLOAD_DIR` to an absolute path
once, at import — had already run. Moved into `vitest.config.ts`'s `test.env`,
which Vitest applies *before any module import*, matching the existing
`DATABASE_URL` entry and its comment.

**3. PowerShell strips quotes from JSON passed to a native command.** The first
gate run returned `Expected property name or '}' in JSON at position 1` from
`body-parser` — PowerShell 5 had handed `curl.exe` a body with the quotes
removed, so `{"email":...}` arrived as `{email:...}`. Wrote the body to a file
and used `--data-binary "@file"` instead.

### Result

| Suite | Before | After |
|---|---|---|
| backend `npm test` | 64 passed, 7 skipped | **74 passed, 7 skipped** (12 files) |
| frontend `npm test` | 44 passed | **44 passed** (7 files) |
| backend `tsc --noEmit` | 0 errors | 0 errors |
| frontend `tsc --noEmit` | 0 errors | 0 errors |

**Gate met, against the real stack.** Through nginx on port 80: login → upload a
genuine PNG to the first seeded product → the response carried
`/api/v1/uploads/1dc9f142-….png` → `GET` on that path returned
`200 image/png` (70 bytes) → the product row held the same relative path. Then
`docker compose up -d --build`, all four containers recreated and healthy, and
the **same URL still returned `200 image/png`** — which is the half of the gate
the volume exists for. Probe script and temp files were deleted afterwards; the
repo has no trace.

Left for Phase 7: the README env table needs `UPLOAD_DIR` / `UPLOAD_MAX_BYTES`
and the `uploads` volume.

