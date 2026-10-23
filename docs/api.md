# API Specification — Business Suite

> REST conventions, standard response envelope, error taxonomy, full endpoint index.

---

## 1. General Conventions

| Item | Standard |
|------|----------|
| **Base URL** (dev) | `http://localhost:5000/api/v1` |
| **Base URL** (prod example) | `https://business-suite-api-xyz.onrender.com/api/v1` |
| **Versioning** | URL-prefixed `/v1`. If we ever ship breaking changes, bump to `/v2` and keep `/v1` in parallel. |
| **HTTP Verbs** | `GET` (read), `POST` (create/action), `PATCH` (partial update), `DELETE` (remove/soft-delete). `PUT` intentionally unused (no full-replace semantics). |
| **Body Format** | All request bodies (POST/PATCH) are JSON `Content-Type: application/json`. |
| **Response Format** | All responses are JSON using the standard envelope below. **No endpoint returns raw arrays or raw strings.** |
| **Authentication** | Header: `Authorization: Bearer <short_lived_jwt_access_token>` on every protected endpoint. Exception (no access token needed): `/auth/login`, `/auth/refresh` (cookie only), `/auth/logout` (cookie only), `/auth/forgot-password`, `/auth/reset-password`, `/auth/2fa/verify`, `/health`. |
| **Timezone / Dates** | All dates in responses are ISO-8601 UTC strings e.g. `"2026-08-25T14:32:00.123Z"`. Frontend converts to local using `Intl.DateTimeFormat`. |
| **Currency** | Money fields are returned as JSON strings (not numbers) to preserve decimal precision e.g. `"total": "499.99"`. Frontend renders with `Intl.NumberFormat`. |
| **Character encoding** | All strings are UTF-8. |
| **No trailing slashes** | Prefer `/api/v1/customers` over `/api/v1/customers/`. |

---

## 2. Standard Response Envelope

### Success — All 2xx Responses

**Shape (used by `successResponse()` / `successResponsePaginated()` in `backend/src/lib/response.ts`)**:

```json
{
  "success": true,
  "data": {} | [] | "(any valid JSON value)",
  "message": "Optional human-readable success message, e.g. \"Product image uploaded successfully\".",
  "meta": {
    "page": 1,
    "perPage": 20,
    "totalItems": 87,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

- `success` is always `true` for 2xx. Allows frontend to quickly distinguish from error responses that may come from gateways/proxies that don't follow our envelope.
- `data` is whatever the endpoint is primarily returning (single object, array, nested object, string, `null` for success-without-body).
- `message` is optional and set only on endpoints that want a human-readable confirmation (`successResponse(res, data, status, message)`); it is **absent** on paginated list responses.
- `meta` is **OPTIONAL**. Only present for paginated list endpoints (`successResponsePaginated`). Omitted entirely for single-entity responses / creates / updates.

### Common Success HTTP Codes

| Code | Use case |
|------|----------|
| **200 OK** | GET, PATCH successful — `data` present. |
| **201 Created** | POST (create) successful. `data` is the newly-created entity with its `id` and generated fields (codes, createdAt). SHOULD also set `Location` header: `Location: /api/v1/customers/:newId` (interview nice-to-have; optional for V1). |
| **204 No Content** | Successful with ZERO response body. Rarely used in V1 in favor of 200 with empty data; available for pure-ack endpoints like logout if we want. |

---

## 3. Standard Error Envelope

**Shape (used by `errorResponse()` + `errorHandler` middleware)**:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "items.0.qty",
        "message": "Quantity must be a positive integer"
      },
      {
        "field": "email",
        "message": "Invalid email"
      }
    ]
  }
}
```

- `success` always `false` for non-2xx.
- `error.code` is a MACHINE-READABLE UPPER_SNAKE_CASE short identifier. Frontend switches on this for i18n or user-friendly toast.
- `error.message` is a HUMAN-READABLE short explanation in English (plaintext; no HTML).
- `error.details` is **OPTIONAL**. Only populated for validation errors (Zod issues) or multi-field business rule failures.
- **NEVER include `stack`** in the JSON in NODE_ENV=production. In development only, an optional `error.stack` field may be added for debugging.

### Error HTTP Codes

| Code | Typed Class | `error.code` | When used |
|------|-------------|--------------|-----------|
| **400 Bad Request** | `BadRequestError` | `BAD_REQUEST` | Malformed or unusable request (e.g. an upload whose bytes are not a valid image, or a missing multipart part). |
| **401 Unauthorized** | `UnauthorizedError` | `UNAUTHORIZED` | No token sent, bad/expired token, wrong login credentials, invalid 2FA challenge or code. **Response body message is always vague for credential endpoints ("Invalid email or password.") to prevent account enumeration.** |
| **403 Forbidden** | `ForbiddenError` | `FORBIDDEN` | Valid auth, but the route's required permission code is not in the caller's set, or the account is not `ACTIVE`. |
| **404 Not Found** | `NotFoundError` | `NOT_FOUND` | URL path doesn't match any route OR requested entity id doesn't exist in DB. Message: "Customer id_123 not found." |
| **409 Conflict** | `ConflictError` | `CONFLICT` | DB unique constraint violated, or a state transition is blocked (e.g. enabling 2FA when it is already on). |
| **413 Request Entity Too Large** | `AppError(413)` | `PAYLOAD_TOO_LARGE` | Uploaded file exceeds the configured size cap (raised by the product-image upload middleware). |
| **422 Unprocessable Entity** | `UnprocessableEntityError` / Zod `ZodError` | `VALIDATION_ERROR` | Body/query/params parsed successfully but semantically invalid. Most Zod validation failures, plus business-rule failures (e.g. wrong password on `POST /auth/2fa/disable`). |
| **429 Too Many Requests** | Rate limiter middleware | `TOO_MANY_REQUESTS` | Rate limit exceeded (`Retry-After` header set to the remaining window). |
| **500 Internal Server Error** | N/A (uncaught exception) | `INTERNAL_SERVER_ERROR` | Any throw not caught by the typed classes, or a Prisma error we do not map (every code except P2002/P2003/P2014/P2025). Message in PROD: "An unexpected error occurred. Our team has been notified." NEVER raw "relation X does not exist". |

`error.code` is derived from the HTTP status by `toErrorCode()` in `backend/src/middleware/errorHandler.ts`, so each status maps to exactly one machine code (an unrecognised status falls through to `HTTP_<status>`).

---

## 4. Prisma Error Mapping (inside `errorHandler`)

Prisma's error codes start with `P` followed by digits. We intercept the common ones and map to friendly typed errors:

| Prisma Code | Meaning | Mapped to HTTP | `error.code` |
|-------------|---------|----------------|---------------|
| P2002 | Unique constraint failed | 409 Conflict | `CONFLICT` + message includes the field name(s) from `meta.target` |
| P2003 | Foreign-key constraint failed (referenced row missing) | **400 Bad Request** | `BAD_REQUEST` ("Invalid reference: related record for … does not exist.") |
| P2014 | FK constraint (Restrict) blocked a delete | 409 Conflict | `CONFLICT` |
| P2025 | Record not found (`update` / `delete` on a missing row) | 404 Not Found | `NOT_FOUND` |
| Everything else (incl. P2000) | — | 500 Internal Server | `INTERNAL_SERVER_ERROR` |

In `NODE_ENV=development` the error response also carries `details: [{ rawCode }]` so the raw Prisma code is visible while debugging; production omits it.

---

## 5. Paginated List Endpoints — Shared Conventions

**Query Params** (parsed & validated by `lib/pagination.ts → parsePaginationQuery()`):

| Param | Type | Default | Validation | Purpose |
|-------|------|---------|------------|---------|
| `page` | integer | 1 | ≥ 1 | Current page (1-indexed, not 0). |
| `perPage` | integer | 20 | 1 ≤ perPage ≤ 200 | Rows per page. Hard cap 200 (`PAGINATION_DEFAULTS.perPageMax`) to prevent deliberate huge-request DoS. |
| `sortBy` | string | *(none — endpoint default)* | Validated against a per-endpoint whitelist | Column name to sort by. The whitelist prevents arbitrary SQL injection via sort. |
| `sortOrder` | string | `desc` | `asc` or `desc` only | Direction. |
| `search` | string | *(none)* | Trimmed; no explicit length cap | Full-text-ish substring search on endpoint-defined searchable cols. |
| *module-specific filters* | — | — | Zod validated per endpoint | e.g. `status=ACTIVE`, `categoryId=uuid`, `dateFrom=YYYY-MM-DD`, `dateTo=YYYY-MM-DD`. |

**Response `meta` object** (built by `buildPaginationMeta()`):

```typescript
interface PaginationMeta {
  page: number;        // Echoes requested page
  perPage: number;     // Echoes requested perPage
  totalItems: number;  // COUNT(*) across all pages
  totalPages: number;  // max(1, ceil(totalItems/perPage))
  hasNext: boolean;    // page < totalPages
  hasPrev: boolean;    // page > 1
}
```

### Server-side pagination Prisma pattern
```typescript
const [totalItems, items] = await prisma.$transaction([
  prisma.entity.count({ where }),
  prisma.entity.findMany({ where, select, orderBy, skip: (page-1)*perPage, take: perPage })
]);
```
We wrap in `$transaction` so both count and page see a consistent snapshot (no phantom rows appear between count and select).

---

## 6. CORS Configuration (Security)

Backend CORS policy (`backend/src/app.ts`): `origin = CONFIG.cors.frontendUrl` (from the `FRONTEND_URL` env var), `credentials = true`, `methods = ['GET','POST','PATCH','PUT','DELETE','OPTIONS']`, `allowedHeaders = ['Content-Type','Authorization','X-Request-ID']`, `exposedHeaders = ['X-Request-ID','X-RateLimit-Limit','X-RateLimit-Remaining']`, `maxAge = 86400`.

- **NEVER** `origin: '*'` when `credentials: true` — browsers block this explicitly anyway. The app refuses to boot in production if `FRONTEND_URL` is unset or `'*'`.
- The single `FRONTEND_URL` origin is allowed in every environment; in development it is expected to point at `http://localhost:3000`.
- Preflight OPTIONS requests are handled by the `cors()` middleware automatically.

---

## 7. Endpoint Cheat Sheet (Quick Index)

See [BUILD_PROCESS.md Section 21](BUILD_PROCESS.md#21-api-endpoint-cheat-sheet) for the complete verb-permission matrix. Short index by module (auth flows — the two login outcomes, 2FA and password reset — are detailed in § 11; the product image upload in § 12):

Paths below are relative to the `/api/v1` prefix. The CRM, inventory, sales and HRM groups are mounted under their module prefix (`/api/v1/crm/*`, `/api/v1/inventory/*`, `/api/v1/sales/*`, `/api/v1/hrm/*`).

| Module | Base path | Key verbs |
|--------|-----------|-----------|
| Health | `/health` | GET (public, no auth) |
| Auth | `/auth/*` | POST /login (may return a 2FA challenge), POST /2fa/verify, POST /refresh (cookie), POST /logout, GET /me, POST /change-password; 2FA management: GET /2fa/status, POST /2fa/setup, POST /2fa/enable, POST /2fa/disable; POST /forgot-password, POST /reset-password |
| Users | `/users` | GET list (paginated), POST create, GET/PATCH `/:id`, POST `/:id/activate`, POST `/:id/deactivate` |
| Roles | `/roles` | GET list, POST create, GET/PATCH/DELETE `/:id` (permission assignment happens on create/update) |
| Permissions | `/permissions`, `/permissions/flat` | GET grouped list, GET flat list (read-only) |
| Audit | `/audit-logs` | GET list, filterable |
| Profile | `/profile` | GET own profile, PATCH own profile, POST /change-password |
| CRM Customers | `/crm/customers` | CRUD + search/filter |
| CRM Contacts | `/crm/customers/:customerId/contacts`, `/crm/contacts/:id` | GET/POST customer's contacts; GET/PATCH/DELETE by id |
| CRM Leads | `/crm/leads` | CRUD + POST `/:id/convert`, PATCH `/:id/stage` |
| CRM Opportunities | `/crm/opportunities` | CRUD + PATCH `/:id/stage` |
| CRM Activities | `/crm/activities` | GET list, POST create |
| CRM Contracts | `/crm/contracts` | CRUD |
| Inventory Categories | `/inventory/categories` | CRUD |
| Inventory Products | `/inventory/products` | CRUD (paginated), GET `/low-stock`, GET `/:id/stock-summary`, POST `/:id/image` (multipart image upload) |
| Inventory Warehouses | `/inventory/warehouses` | CRUD |
| Inventory Stock | `/inventory/stock`, `/inventory/stock/:productId/:warehouseId` | GET list, GET by product+warehouse key (read-only) |
| Inventory Movements | `/inventory/movements` | GET list, POST create movement, POST `/transfer`, GET `/:id` |
| Sales Orders (POS) | `/sales/orders` | GET list, POST `/checkout` (atomic tx), GET/DELETE `/:id`, PATCH `/:id/status` |
| Sales Payments | `/sales/payments` | GET list, POST create, GET `/:id` |
| Sales Refunds | `/sales/refunds` | GET list, POST create, GET `/:id` |
| Sales Credits | `/sales/credits`, `/sales/credits/adjust` | GET list, POST `/adjust` |
| Sales Reports | `/sales/reports/daily-summary` | GET daily sales summary |
| HRM Departments | `/hrm/departments` | CRUD |
| HRM Designations | `/hrm/designations` | CRUD |
| HRM Employees | `/hrm/employees` | CRUD |
| HRM Attendance | `/hrm/attendance` | GET list, POST create, GET/PATCH/DELETE `/:employeeId/:attendanceDate`, POST `/self/check-in`, POST `/self/check-out` |
| HRM Leave Types | `/hrm/leave-types` | CRUD |
| HRM Leaves | `/hrm/leaves` | CRUD + PATCH `/:id/approve`, PATCH `/:id/reject`, PATCH `/:id/cancel` |
| Dashboard | `/dashboard/summary`, `/sales-trend`, `/top-products`, `/lead-pipeline`, `/attendance-summary`, `/recent-orders`, `/recent-activities` | GET read-only aggregates |

---

## 8. Validation Strategy

Validation happens in **3 layers** (defense in depth):

```
LAYER 1 (BROWSER UX, not security):
  React Hook Form → Zod resolver validates user input before form submit.
  Shows inline red error messages under each field. Prevents wasting an HTTP request
  on empty email, obvious format errors. Attacker can bypass this with Postman / curl.

LAYER 2 (HTTP GATEWAY, authoritative — required):
  Express middleware validate({ params?, query?, body? }) runs on every POST/PATCH body AND query/params.
  If parse fails → next(new UnprocessableEntityError("Validation failed", [{ field, message }])).
  Frontend gets 422 with error.code "VALIDATION_ERROR".
  THIS LAYER IS THE REAL SECURITY. Attacker CANNOT bypass this.

LAYER 3 (DATABASE, defense-in-depth):
  PostgreSQL UNIQUE, CHECK, FK, NOT NULL constraints. If Zod has a bug and a bad value
  gets past Layers 1 & 2, DB writes are refused with a Prisma error we map to 409/422.
```

---

## 9. Rate Limiting Policy (express-rate-limit, in-memory store)

*Note: Free tier deployment with multiple instances → in-memory is PER-instance. Upgrade to Redis store for production multi-instance.*

| Route pattern | Window | Max requests per IP | Rationale |
|---------------|--------|---------------------|-----------|
| `POST /auth/login` | 15 min | **10 attempts** | Thwart online brute-force password guessing. |
| `POST /auth/2fa/verify` | 15 min | **10 attempts** | The TOTP / recovery-code space is small enough to brute-force, so the second login step gets the same shield as the first. |
| `POST /auth/forgot-password` | 15 min | **10 attempts** | Prevent email bomb flooding a user's inbox. |
| `POST /auth/reset-password` | 15 min | **10 attempts** | Same credential-endpoint shield. |
| Everything else under `/api/v1/*` (incl. `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/change-password`, and the 2FA management routes) | 15 min | **100 requests** (`RATE_LIMIT_MAX`) | App-wide DoS protection. These are called on every page load / token expiry, so the strict auth budget would lock normal users out. |

Product images served from `/api/v1/uploads/*` are mounted **ahead of** this limiter, so rendering a grid of thumbnails does not consume the API budget.

The window and cap are configurable via `RATE_LIMIT_WINDOW_MS` (default `900000` = 15 min) and `RATE_LIMIT_MAX` (default `100`).

On 429 response, body is standard error envelope + `Retry-After` header set to remaining window seconds.

---

## 10. Security Headers (Helmet defaults + adjustments)

`helmet()` is applied globally in `backend/src/app.ts`, so every response — including 404s and error responses — carries its headers. The **only** override the app makes is the Content-Security-Policy `directives` object. Every other Helmet header is left at the library's built-in default and is not customised anywhere in the codebase, so it is not restated here.

The CSP directives actually set (`backend/src/app.ts`):

```
default-src 'self';
style-src   'self' 'unsafe-inline';        (Tailwind / Next.js inject inline styles)
img-src     'self' data: https:;
script-src  'self'                         (production) ;
script-src  'self' 'unsafe-inline'         (development — Next.js dev overlay) ;
connect-src 'self' <FRONTEND_URL>;         (the single allowed frontend origin)
```

- There is **no nonce** and no `blob:` source; in production `script-src` is just `'self'`.
- `connect-src` also allows `CONFIG.cors.frontendUrl` (the `FRONTEND_URL` env var) so the browser frontend may call the API.

Non-CSP-related — cookie flags for the `refreshToken` cookie (single source of truth: `backend/src/utils/cookies.ts`): `HttpOnly`, `Secure` (production only), `SameSite=None` in production / `Lax` otherwise, `Path=/`, `Domain` set to `COOKIE_DOMAIN` (omitted entirely when that value is `localhost`), and `Max-Age` equal to the refresh lifetime (`REFRESH_TOKEN_EXPIRES_IN`, default 7 days). Production uses `SameSite=None` because the frontend and the API are different sites; `None` is only honoured together with `Secure`, which is set there.

---

## 11. Authentication Flows — Login, Two-Factor & Password Reset

All routes below live under `/api/v1/auth` and use the standard envelope. Implementation: `backend/src/modules/auth/`.

### 11.1 `POST /auth/login` — two possible success shapes

Public. Body: `{ "email": string, "password": string }` (email trimmed & lower-cased; password 1–128 chars).

When the account **does not** have 2FA enabled, `200` returns a full session (`data.accessToken`, `data.tokenType`, `data.expiresInSec`, `data.user`, `data.permissions`) and **sets the `refreshToken` cookie**.

When the account **has** 2FA enabled, `200` returns a challenge instead of a session, and **sets no cookie and issues no access token**:

```json
{
  "success": true,
  "data": { "twoFactorRequired": true, "challengeToken": "<jwt>" }
}
```

- The response is distinguished by the presence of `twoFactorRequired` / `challengeToken` (there is no `accessToken`).
- This is the **changed contract**: a client that only checked `data.accessToken` will now have a `null`/`undefined` token for 2FA users and must call `POST /auth/2fa/verify` next.
- Errors: `401 Unauthorized` "Invalid email or password." (wrong password **or** unknown email — deliberately identical), `403 Forbidden` if the account is not `ACTIVE`.

**The challenge token is not an access token.** It is a JWT whose `type` claim is `"2fa_challenge"`, signed with the access-token secret and valid for **5 minutes**. `authenticate()` requires `type: "access"`, so sending a challenge token as a `Bearer` token is rejected with `401`. It is accepted only by `POST /auth/2fa/verify`.

### 11.2 `POST /auth/2fa/verify`

Public (the caller has no session yet) but rate-limited like `/login`.

| Field | Type | Rules |
|-------|------|-------|
| `challengeToken` | string | The token from the login response. Required, non-empty. |
| `code` | string | Trimmed. A 6-digit TOTP **or** a recovery code (dashes allowed). Length 6–32. |

Success `200` returns the same session payload as a plain login (access token, user, permissions) and **sets the `refreshToken` cookie**.

Errors:

| Status | Message | When |
|--------|---------|------|
| `401 Unauthorized` | "Your two-factor challenge is no longer valid. Please sign in again." | Unknown user, 2FA switched off between the two steps, or an unreadable stored secret — one message for all three, on purpose. |
| `401 Unauthorized` | "That verification code is not valid." | TOTP did not match **and** the code was not a stored recovery code. |
| `403 Forbidden` | "This account has been disabled…" | Account is not `ACTIVE`. |

A valid **recovery code is consumed on use** (its hash is removed from the stored set), so each code works exactly once.

### 11.3 Two-factor management (session required)

These act on the caller's **own** account (`req.user.id`); they require an access token but **no permission code**.

| Method & path | Body | Success `200` `data` |
|---------------|------|----------------------|
| `GET /auth/2fa/status` | — | `{ "enabled": boolean, "recoveryCodesRemaining": number }` |
| `POST /auth/2fa/setup` | — | `{ "secret": string, "otpauthUrl": string, "qrDataUrl": string }` |
| `POST /auth/2fa/enable` | `{ "code": "123456" }` | `{ "ok": true, "recoveryCodes": ["…"] }` |
| `POST /auth/2fa/disable` | `{ "password": "…" }` | `{ "ok": true }` |

- `POST /auth/2fa/setup` generates a fresh secret, stores it **encrypted**, and leaves 2FA **off** — enrolment only completes in `/2fa/enable`. Calling it again regenerates the secret, invalidating any abandoned attempt. `409 Conflict` if 2FA is already enabled.
- `POST /auth/2fa/enable` requires a live 6-digit code (`/^\d{6}$/`). It flips 2FA on and returns the **recovery codes in plaintext, exactly once** — they are stored only as SHA-256 hashes and there is no endpoint to read them back. `409 Conflict` if already enabled; `422 Unprocessable Entity` if no setup was started, the stored secret cannot be decrypted, or the code is invalid.
- `POST /auth/2fa/disable` **requires the account password** — a hijacked live session must not be able to quietly remove the second factor. `422 Unprocessable Entity` "That password is not correct." on a bad password. Disabling when 2FA is already off is idempotent (`200 { ok: true }`). The stored secret and recovery codes are wiped.

### 11.4 `POST /auth/forgot-password`

| Field | Type | Rules |
|-------|------|-------|
| `email` | string | RFC 5322 email, trimmed & lower-cased. |

Always responds `200 { "success": true, "data": { "ok": true } }` — **whether or not the address exists**, so the endpoint is not a user-enumeration oracle (unknown addresses also wait a fixed 100 ms so response timing cannot leak either).

When the address exists, a single-use reset token (valid 15 minutes, stored SHA-256-hashed) is created and a reset link is emailed through the **real SMTP transport** (`backend/src/lib/mailer.ts`; configured by `MAIL_ENABLED` and `SMTP_*`). If mail is disabled or the send fails, the link is printed to the **server terminal** instead, so local dev needs no SMTP credentials. `sendMail()` never throws, so a broken mail host degrades to the console fallback rather than a 500.

---

## 12. Product Image Upload

### `POST /api/v1/inventory/products/:id/image`

Replaces a product's image. Body is `multipart/form-data`, **not** JSON.

| Requirement | Value |
|-------------|-------|
| Auth | `Authorization: Bearer <access token>` |
| Permission | `inventory.products.update` (replacing an image is a product update — no separate permission code) |
| Form field | `file` — a single file |
| Accepted types | PNG, JPEG, WebP — identified by the file's **magic bytes**, not its filename or `Content-Type` |
| Size cap | `UPLOAD_MAX_BYTES`, default **2097152 bytes (2 MB)** |

On success `200`, `data` is the updated product row (including the new `imageUrl`) and `message` is `"Product image uploaded successfully"`. The stored value is the **relative** path `/api/v1/uploads/<uuid>.<ext>`, where `<ext>` (`.png` / `.jpg` / `.webp`) comes from the sniffed bytes. Images are served by Express from that same path (mounted ahead of the rate limiter), so the one stored URL resolves unchanged in dev, Docker and production.

Error cases:

| Status | `error.code` | When |
|--------|--------------|------|
| `400 Bad Request` | `BAD_REQUEST` | The bytes are not PNG/JPEG/WebP ("That file is not a valid image. Upload a PNG, JPEG or WebP file.") **or** no `file` part was sent ('Attach an image in the "file" field.'). |
| `401 Unauthorized` | `UNAUTHORIZED` | Missing / invalid access token. |
| `403 Forbidden` | `FORBIDDEN` | Caller lacks `inventory.products.update`. |
| `404 Not Found` | `NOT_FOUND` | No product with that `:id`. |
| `413 Request Entity Too Large` | `PAYLOAD_TOO_LARGE` | File exceeds the size cap ("Image must be 2.0 MB or smaller.", message derived from the configured cap). |

`authorize("inventory.products.update")` runs **before** multer, so an unauthenticated or unauthorised caller is rejected before any bytes are buffered. There is no separate delete-image endpoint; uploading a new image **replaces** the old one and the previous file is removed best-effort after the row update commits.
