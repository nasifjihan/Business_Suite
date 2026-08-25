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

*(filled in after Phase 0 completes)*

### Mistakes during implementation:
1. _(To be filled in)_

### Interview-friendly takeaways from this phase:
1. A good .gitignore + README should be committed BEFORE npm install is ever run. Prevents accidental secret/private package commits.
2. Folder tree planning with route groups before create-next-app prevents later rename-induced broken imports.

---

## Phase 1 — Core Shells: Lessons Learned

### Mistakes:
1. _(To be filled in)_

### Key decisions:
1. _(To be filled in)_

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
