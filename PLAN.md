# Business Suite — Completion Plan (V2)

> **Status:** In progress — Phases 0–4 complete
> **Created:** 2026-10-23
> **Predecessor:** Phases 0–14 (see [BUILD_PROCESS.md](BUILD_PROCESS.md))
> **Log:** [DEVELOPMENT_JOURNAL.md](DEVELOPMENT_JOURNAL.md)

## Why this plan exists

Phases 0–14 delivered a working, deployable application. A follow-up audit found
the work stopped mid-stream: a deployment-plumbing branch (Docker frontend, Neon
switch) ended in commits named `asas` and `revice`, leaving three categories of
loose end — dead code, a missing test layer, and three features the code itself
advertises as "Coming soon".

This plan closes all three. It is intentionally ordered so that **hygiene and
security land before new features**, and **documentation lands last**, once the
code it describes has stopped moving.

---

## Scope

| # | Workstream | Type | Status |
|---|---|---|---|
| 0 | Baseline verification | Gate | ✅ Done — all gates green |
| 1 | Code hygiene — remove dead Phase-1 middleware | Fix | ✅ Done |
| 2 | Security — scrub committed credential | Fix | ✅ Done (+ onboarding fix) |
| 3 | Email delivery — real SMTP for password reset | Feature | ✅ Done |
| 4 | Two-factor authentication (TOTP) | Feature | ✅ Done |
| 5 | Product image upload | Feature | ☐ |
| 6 | Playwright end-to-end suite | Test | ☐ (+ 7 skipped tests to resolve) |
| 7 | Documentation reconciliation | Docs | ☐ (4 more corrections found) |
| 8 | Final end-to-end verification | Gate | ☐ |

**Explicitly out of scope for this plan** (unchanged V1 non-goals):
multi-tenancy, full double-entry accounting, payroll engine, MRP/BOM,
native mobile apps.

---

## Findings added during Phase 0

Four issues surfaced that the original audit missed. They are folded into the
phases below rather than treated as new phases:

| Finding | Folded into | Journal ref |
|---|---|---|
| `localhost:5433` fails on Windows (IPv6 first); README documents it | Phase 7 | Finding 1 |
| `frontend/.env.local.example` never existed, but README says to copy it | Phase 2 ✅ | Finding 2 |
| 7 skipped tests — 2 cover a non-existent endpoint, 3 hide real gaps | Phase 6 | Finding 3 |
| Documented test counts (45 backend) no longer match (55) | Phase 7 | Finding 4 |

---

## Phase 0 — Baseline verification ✅ COMPLETE

All five gates green. Recorded in full in the journal.

| Step | Result |
|---|---|
| 0.1 backend `tsc --noEmit` | ✅ 0 errors |
| 0.2 backend `npm test` | ✅ 48 passed, 7 skipped (8 files) |
| 0.3 frontend `tsc --noEmit` | ✅ 0 errors |
| 0.4 frontend `npm test` | ✅ 44 passed / 44 |
| 0.5 database reachable | ✅ Postgres 16.15 (Docker) on `127.0.0.1:5433` |

Environment provisioned from scratch: deps installed, `backend/.env` written,
`bs_db` + `bs_test` migrated, `bs_db` seeded and verified against the README's
own counts (1 user / 7 roles / 143 permissions).

---

## Phase 1 — Code hygiene ✅ COMPLETE

| File | Action |
|---|---|
| `backend/src/middleware/rbac.ts` | **Deleted** — zero imports; real check is `authorize.ts` |
| `backend/src/middleware/auditLogger.ts` | **Deleted** — mounted but a no-op; real audit is `audit.ts` |
| `backend/src/app.ts` | Import + `app.use()` removed, comment renumbered, reason documented |

**Gate met:** `tsc --noEmit` 0 errors; no `TODO(phase3)` left in `backend/src`.

---

## Phase 2 — Security ✅ COMPLETE

1. ✅ `Note.md` — plaintext Postgres password replaced with a placeholder.
2. ✅ Repo swept for other copies: none. Remaining `Admin@123` /
   `postgres:postgres` hits are deliberate, documented demo values.
3. ✅ **Bonus fix:** created the missing `frontend/.env.local.example` (README
   step 4 was a guaranteed file-not-found) and added `!.env.local.example` to
   `frontend/.gitignore` so the template actually ships.
4. ⚠️ **Owner action required, not performed:** the password is still in git
   history. Removing it needs `git filter-repo` + credential rotation — both
   have consequences beyond this repo.

---

## Phase 3 — Email delivery (real SMTP) ✅ COMPLETE

Nodemailer over a generic SMTP transport, so the provider stays an env-var
decision. All 7 vars are **optional with defaults** and were added to the Zod
schema, `.env.example` and `docker-compose.yml` together.

| File | Change |
|---|---|
| `backend/src/lib/mailer.ts` | **New** — lazy transport, `sendMail()` → boolean, `renderPasswordResetEmail()` |
| `backend/src/config/env.ts` | +`MAIL_ENABLED`, `SMTP_HOST/PORT/SECURE/USER/PASS`, `MAIL_FROM` + `CONFIG.mail` |
| `backend/src/modules/auth/services.ts` | `forgotPassword` sends; console fallback only when `sendMail` returns false |
| `backend/.env.example`, `docker-compose.yml` | Same names, documented with provider recipes |
| `backend/src/tests/unit/mailer.test.ts` | **New** — 4 unit tests |
| `backend/src/tests/unit/auth-mail.test.ts` | **New** — 3 integration tests (mocked transport) |

**Key design point:** `sendMail()` is called unconditionally and returns a
boolean, rather than being wrapped in `if (CONFIG.mail.enabled)`. Identical
external behaviour, but the single `if (!delivered)` fallback also catches a
*failed* send — which the `if (enabled)` shape silently drops — and it keeps the
"is mail on?" decision in one place.

**Gate met, with a real message:** verified against a throwaway Mailpit
container (`SMTP_HOST=127.0.0.1 SMTP_PORT=1025`, no auth) rather than mocks
alone; the message arrived with the correct subject, text link and HTML button.
`tsc --noEmit` 0 errors; `npm test` **55 passed, 7 skipped** (was 48 passed —
the 7 new tests). `MAIL_ENABLED=false` behaviour byte-for-byte unchanged.

Deferred to Phase 7: README env table needs the new vars.

---

## Phase 4 — Two-factor authentication (TOTP) ✅ COMPLETE

The profile page rendered a dashed "Coming soon" card. It is now real.

**Decision — TOTP (RFC 6238)** via `otplib` v13 + `qrcode`. Standard authenticator
apps, no SMS provider, no per-message cost. Recovery codes are hashed at rest.

Schema (`User`): `twoFactorEnabled Boolean @default(false)`,
`twoFactorSecret String?` (**encrypted** at rest, not plaintext),
`twoFactorRecoveryCodes String[]` (SHA-256 hashes).

| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | 3 new `User` columns |
| `prisma/migrations/20261023025238_add_two_factor_auth/` | **New** — additive only |
| `backend/src/utils/crypto.ts` | +`encryptSecret` / `decryptSecret` (AES-256-GCM) |
| `backend/src/utils/totp.ts` | **New** — the only module importing `otplib` |
| `backend/src/utils/jwt.ts` | +challenge sign/verify, distinct `type: "2fa_challenge"` |
| `backend/src/config/env.ts` | +`TOTP_ENCRYPTION_KEY`, `TOTP_ISSUER` + `CONFIG.twoFactor` |
| `backend/src/modules/auth/{validators,types}.ts` | +3 schemas, +4 DTOs |
| `backend/src/modules/auth/services.ts` | `login` → `LoginOutcome` union; +5 methods |
| `backend/src/modules/auth/controllers.ts` | `login` handles the union + 5 handlers |
| `backend/src/modules/auth/routes.ts` | +`/2fa/verify` (public, rate-limited) + 4 session-guarded |
| `backend/src/tests/unit/auth_two_factor.test.ts` | **New** — 9 tests |
| `frontend/src/lib/api/authEndpoints.ts` | +5 endpoints, `login` returns `LoginResult` union |
| `frontend/src/components/auth/LoginForm.tsx` | two-step login (challenge → code) |
| `frontend/src/components/auth/TwoFactorCard.tsx` | **New** — replaces the placeholder card |
| `frontend/src/app/(dashboard)/profile/page.tsx` | renders `<TwoFactorCard />` |

**Login contract (owner decision):** with 2FA on, `POST /auth/login` answers
`200` with `{ twoFactorRequired: true, challengeToken }` — **no** access token and
**no** refresh cookie. `POST /auth/2fa/verify` exchanges the challenge + code for
the normal session payload, cookie included. The password is verified *before*
the 2FA branch, so the challenge is never an account-enumeration oracle.

**Disable contract (owner decision):** the password is required. A hijacked live
session must not be able to quietly strip the second factor.

**Key design points**
- **Secrets are encrypted, not hashed.** Verifying a TOTP code means recomputing
  it, so the server must be able to recover the plaintext. AES-256-GCM also gives
  tamper detection; the `v1.` prefix makes a future key rotation detectable
  rather than silently misparsed.
- **Enrolment is two-phase.** `setup` stores the secret but leaves
  `twoFactorEnabled` false. A user who scans the QR code and closes the tab is
  not locked out behind a secret they never confirmed.
- **A separate token `type`** (`2fa_challenge`) is what makes an access token
  unusable as a challenge and vice versa — asserted by a test.
- **Recovery codes are hex, 5-5-5-5.** 0/O and 1/l transcription errors are the
  main way a hand-typed code goes wrong; 80 bits is ample for a single-use,
  rate-limited code.

**Gate met:** a 2FA-on account cannot log in with the password alone (step 1
yields a challenge, no cookie), and a 2FA-off account is byte-for-byte unchanged
(asserted). `tsc --noEmit` 0 errors both sides; backend `npm test`
**64 passed, 7 skipped** (was 55 — the 9 new tests); frontend `npm test`
**44 passed**; frontend `tsc --noEmit` 0 errors.

Deferred to Phase 7: README env table needs the 2 new TOTP vars.

---

## Phase 5 — Product image upload

`Product` has **no `imageUrl` column** (unlike `Employee`, which has one). The
spec already fixed the guardrails: PNG/JPG/WebP only, 2 MB max, UUID filenames.

**Decision — local disk in dev, path stored in the DB.** Storage sits behind a
single module so it can move to S3-compatible later without touching callers.
Store only the relative path in `imageUrl`, never an absolute URL, so the same
row works in dev, Docker and production.

Steps:
1. Migration: `imageUrl String?` on `Product`.
2. `npm i multer` + types.
3. `backend/src/lib/uploads.ts` — UUID filenames, extension allow-list,
   **magic-byte check** (a `.png` extension is not proof of a PNG), 2 MB cap.
   Validate at the boundary; never trust the client `mimetype`.
4. `POST /api/v1/inventory/products/:id/image` guarded by the **existing**
   `inventory.products.update` permission — no new permission code, so the
   143-code RBAC matrix is untouched.
5. Serve uploads: mount static at `/uploads` and add the location to
   `nginx.conf` (it currently only routes `/api` and `/health`).
6. Docker: named volume for the uploads directory, or images vanish on rebuild.
7. Frontend: upload control in the product form, thumbnail in list + detail.
   Reuse the shared image-size/type constants.
8. Tests: rejects oversize, rejects wrong type, rejects a spoofed extension,
   accepts a valid PNG.

**Gate:** upload → thumbnail renders → survives a `docker compose up -d --build`.

---

## Phase 6 — Playwright end-to-end suite

Phase 11 spec'd three flows; the README states plainly that none exist. The
BUILD_PROCESS tree already reserves a `playwright/` directory, so this fills a
documented gap rather than inventing a new layout.

**Decision — root-level `playwright/` with its own `package.json`.** Keeps the
browser binaries and test deps out of both app images, and out of the production
dependency tree.

Steps:
1. Scaffold `playwright/`: `package.json`, `playwright.config.ts`, browsers.
2. `playwright.config.ts`: base URL `http://localhost`, `webServer` left manual
   (we run the Docker stack), trace/screenshot on failure, single worker against
   a shared database.
3. Specs matching the documented names:
   - `auth-crm-flow.spec.ts` — login → create customer → appears in list
   - `pos-inventory-flow.spec.ts` — product + stock → POS checkout → stock drops
   - `hrm-leave-flow.spec.ts` — employee → request leave → approve → status
4. **Test isolation:** the suite writes real rows. Use unique suffixes per run
   and clean up, so repeated runs do not accumulate junk in the shared dev DB.
5. `npm run test:e2e` at the root of `playwright/`.
6. CI job in `.github/workflows/` — separate from the existing unit pipelines;
   needs a Postgres service and a seeded database.

**Gate:** all three specs pass twice in a row against the Docker stack (proves
isolation, not just a lucky first run).

---

## Phase 7 — Documentation reconciliation

Docs land **last**, after the code stops moving.

| Document | Change |
|---|---|
| `BUILD_PROCESS.md` | Fix the folder tree: `nginx/` does not exist (it is a root `nginx.conf` bind-mount); `playwright/` now does. Add sections for Phases 3–6 above. |
| `README.md` | Rewrite the E2E row (currently "_Not implemented._"); add new env vars, the uploads volume, and the new features. |
| `docs/api.md` | Document 2FA, upload and mail endpoints. |
| `docs/database.md` | Document the new `User` and `Product` columns. |
| `docs/architecture.md` | Request lifecycle for the 2-step login and the upload path. |
| `docs/learning-notes.md` | One entry per phase above, in the existing format. |
| `DEVELOPMENT_JOURNAL.md` | Maintained throughout, not written at the end. |

**Gate:** no doc claims a file or feature that does not exist — the specific
failure this phase is fixing.

---

## Phase 8 — Final verification

1. Backend: `npm run lint` + `npm test` + `npm run build` + `node dist/server.js`
   boots (Phase 14's lesson: green tests do not prove the artifact starts).
2. Frontend: `npm run typecheck` + `npm test` + `npm run build`.
3. `docker compose up -d --build` → all four containers healthy.
4. Playwright suite green against the built stack.
5. Manual pass: login → 2FA → CRM → POS → HRM → image upload → forgot-password.
6. Commit, in phases, with messages that match the existing style.

---

## Working agreement

- Each phase ends with its gate met **and** a check-in before the next begins.
- Phases 1–2 are pure cleanup and land first, so later diffs are easy to read.
- Schema changes are additive only — no renaming or dropping existing columns.
- Every new env var goes into the Zod schema in `config/env.ts` (Phase 14 bug #5).
