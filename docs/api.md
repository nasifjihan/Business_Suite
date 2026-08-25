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
| **Authentication** | Header: `Authorization: Bearer <short_lived_jwt_access_token>` on every protected endpoint. Exception: `/auth/login`, `/auth/refresh` (cookie only), `/auth/forgot-password`, `/health`. |
| **Timezone / Dates** | All dates in responses are ISO-8601 UTC strings e.g. `"2026-08-25T14:32:00.123Z"`. Frontend converts to local using `Intl.DateTimeFormat`. |
| **Currency** | Money fields are returned as JSON strings (not numbers) to preserve decimal precision e.g. `"total": "499.99"`. Frontend renders with `Intl.NumberFormat`. |
| **Character encoding** | All strings are UTF-8. |
| **No trailing slashes** | Prefer `/api/v1/customers` over `/api/v1/customers/`. |

---

## 2. Standard Response Envelope

### Success — All 2xx Responses

**Shape (used by `successResponse()` helper in `backend/src/lib/response.ts`)**:

```json
{
  "success": true,
  "data": {} | [] | "(any valid JSON value)",
  "meta": {
    "page": 1,
    "pageSize": 25,
    "totalItems": 87,
    "totalPages": 4,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

- `success` is always `true` for 2xx. Allows frontend to quickly distinguish from error responses that may come from gateways/proxies that don't follow our envelope.
- `data` is whatever the endpoint is primarily returning (single object, array, nested object, string, `null` for 204-style success-without-body).
- `meta` is **OPTIONAL**. Only present for paginated list endpoints. Omitted entirely for single-entity responses / creates / updates.

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
    "message": "Validation failed. See 'details' for per-field errors.",
    "details": [
      {
        "path": ["items", 0, "qty"],
        "message": "Quantity must be a positive integer",
        "expected": "integer >= 1"
      },
      {
        "path": ["email"],
        "message": "Invalid email",
        "expected": "RFC 5322 email address"
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

| Code | Typed Class | `error.code` examples | When used |
|------|-------------|-----------------------|-----------|
| **400 Bad Request** | `AppError` generic | `BAD_REQUEST` | Catch-all for malformed requests we can't categorize better. Prefer 422 below. |
| **401 Unauthorized** | `AuthenticationError` | `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `INVALID_CREDENTIALS`, `REFRESH_TOKEN_REVOKED` | No token sent, bad token, bad login creds, expired refresh. **Response body message is always vague for auth endpoints ("Invalid email or password") to prevent account enumeration.** |
| **403 Forbidden** | `AuthorizationError` | `PERMISSION_DENIED` | Valid auth + user exists + role exists, but specific permission code required for route not in user's permission set. Message can be specific ("Missing permission: roles.delete"). |
| **404 Not Found** | `NotFoundError` | `NOT_FOUND` | URL path doesn't match any route OR requested entity id doesn't exist in DB. Message: "Customer id_123 not found." |
| **409 Conflict** | `ConflictError` | `DUPLICATE_SKU`, `DUPLICATE_EMAIL`, `ORDER_ALREADY_CANCELLED` | DB unique constraint violated, or state transition conflicts (cancel cancelled order). |
| **422 Unprocessable Entity** | `ValidationError` / `BusinessRuleError` | `VALIDATION_ERROR`, `INSUFFICIENT_STOCK`, `LEAVE_OVERLAP`, `LEAVE_START_AFTER_END` | Body/query/params parsed successfully but semantically invalid. Most Zod validation failures. The POS "insufficient stock" case. |
| **429 Too Many Requests** | Rate limiter middleware | `RATE_LIMIT_EXCEEDED` | Brute-force/login throttling. Standard. |
| **500 Internal Server Error** | N/A (uncaught exception) | `INTERNAL_SERVER_ERROR` | Any throw not caught by typed classes OR DB error we don't recognize (Prisma P2000-P2999 except P2002 we map to 409). Message in PROD: "An unexpected error occurred. Please try again later." NEVER raw "relation X does not exist". |

---

## 4. Prisma Error Mapping (inside `errorHandler`)

Prisma's error codes start with `P` followed by digits. We intercept the common ones and map to friendly typed errors:

| Prisma Code | Meaning | Mapped to HTTP | `error.code` |
|-------------|---------|----------------|---------------|
| P2002 | Unique constraint failed | 409 Conflict | `DUPLICATE_FIELD` + message includes the field name if available from meta.target |
| P2003 | FK constraint failed (child record exists on delete attempt) | 409 Conflict | `DEPENDENT_RECORDS_EXIST` |
| P2014 | FK constraint (Restrict) blocked delete | 409 Conflict | `DEPENDENT_RECORDS_EXIST` |
| P2025 | Record not found (when using `.findUniqueOrThrow` / `.update`) | 404 Not Found | `NOT_FOUND` |
| P2000 | Value too long for column | 422 Unprocessable | `VALIDATION_ERROR` |
| Everything else | — | 500 Internal Server | `INTERNAL_SERVER_ERROR` |

---

## 5. Paginated List Endpoints — Shared Conventions

**Query Params** (parsed & validated by `lib/pagination.ts → parsePaginationParams()`):

| Param | Type | Default | Validation | Purpose |
|-------|------|---------|------------|---------|
| `page` | integer | 1 | ≥ 1 | Current page (1-indexed, not 0). |
| `pageSize` | integer | 25 | 1 ≤ pageSize ≤ 200 | Per page. Hard cap 200 to prevent deliberate huge-request DoS. |
| `sortBy` | string | `createdAt` | Must be whitelisted per endpoint | Column name to sort by. Whitelist prevents arbitrary SQL injection via sort. |
| `sortOrder` | string | `desc` | `asc` or `desc` only | Direction. |
| `search` | string | `''` | ≤ 100 chars | Full-text-ish substring search on endpoint-defined searchable cols. |
| *module-specific filters* | — | — | Zod validated per endpoint | e.g. `status=ACTIVE`, `categoryId=uuid`, `dateFrom=YYYY-MM-DD`, `dateTo=YYYY-MM-DD`. |

**Response `meta` object** (returned by `buildPaginationMeta()`):

```typescript
interface PaginationMeta {
  page: number;            // Echoes requested page
  pageSize: number;        // Echoes requested pageSize
  totalItems: number;      // COUNT(*) across all pages
  totalPages: number;      // ceil(totalItems/pageSize)
  hasNextPage: boolean;    // page < totalPages
  hasPreviousPage: boolean;// page > 1
}
```

### Server-side pagination Prisma pattern
```typescript
const [totalItems, items] = await prisma.$transaction([
  prisma.entity.count({ where }),
  prisma.entity.findMany({ where, select, orderBy, skip: (page-1)*pageSize, take: pageSize })
]);
```
We wrap in `$transaction` so both count and page see a consistent snapshot (no phantom rows appear between count and select).

---

## 6. CORS Configuration (Security)

Backend CORS policy: `origin = process.env.FRONTEND_URL`, `credentials = true`, `methods = ['GET','POST','PATCH','DELETE','OPTIONS']`, `allowedHeaders = ['Content-Type','Authorization','X-Requested-With']`, `maxAge = 86400`.

- **NEVER** `origin: '*'` when `credentials: true` — browsers block this explicitly anyway.
- **Development-only helper**: If `NODE_ENV=development`, also allow `http://localhost:3000`, `http://127.0.0.1:3000` as convenience. In `NODE_ENV=production`, ONLY `FRONTEND_URL`.
- Preflight OPTIONS requests are handled by the `cors()` middleware automatically.

---

## 7. Endpoint Cheat Sheet (Quick Index)

See [BUILD_PROCESS.md Section 21](BUILD_PROCESS.md#21-api-endpoint-cheat-sheet) for the complete verb-permission matrix. Short index by module:

| Module | Base path | Key verbs |
|--------|-----------|-----------|
| Health | `/health` | GET (public) |
| Auth | `/auth/*` | POST /login, /refresh (cookie), /logout, GET /me, POST /forgot-password, POST /reset-password |
| Users | `/users` | CRUD Pagination + PATCH /:id/deactivate |
| Roles & Permissions | `/roles`, `/permissions` | Roles CRUD + assign permissions; Permissions read-only list |
| Audit | `/audit-logs` | GET list, filterable |
| CRM Customers | `/customers`, `/customers/:id/contacts` | CRUD + contacts sub-list + search/filter |
| CRM Leads | `/leads`, `/leads/:id/activities` | CRUD + PATCH status change + POST activity |
| Inventory Categories | `/categories` | CRUD + read all (not paginated) |
| Inventory Products | `/products` | CRUD, server paginated, includes stock by warehouse |
| Warehouses | `/warehouses` | CRUD |
| Stock | `/stock`, `/stock/low`, `/stock/movements`, `/stock/adjustments` | Reads + POST adjustment (transactional) |
| POS & Orders | `/orders`, `/orders/:id/cancel` | POST checkout (atomic tx), list, detail, POST cancel |
| Invoices & Payments | `/invoices/:id`, `/payments` | Read invoice + POST payment against invoice |
| HRM Departments/Designations | `/departments`, `/designations` | CRUD |
| HRM Employees | `/employees` | CRUD |
| Attendance | `/attendance`, `POST /check-in`, `POST /check-out` | Read list + check in/out for today |
| Leave | `/leave-requests`, `/leave-requests/:id/approve`, `/leave-requests/:id/reject` | Read + create + approve/reject |
| Dashboard | `/dashboard/summary`, `/sales-trend`, `/top-products`, `/lead-pipeline`, `/attendance-summary`, `/recent-orders`, `/recent-activities` | Read-only aggregates |

---

## 8. Validation Strategy

Validation happens in **3 layers** (defense in depth):

```
LAYER 1 (BROWSER UX, not security):
  React Hook Form → Zod resolver validates user input before form submit.
  Shows inline red error messages under each field. Prevents wasting an HTTP request
  on empty email, obvious format errors. Attacker can bypass this with Postman / curl.

LAYER 2 (HTTP GATEWAY, authoritative — required):
  Express middleware validate(ZodSchema) runs on every POST/PATCH body AND query/params.
  If parse fails → next(new ValidationError(zod.issues)). Frontend gets 422.
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
| `POST /auth/login` | 15 min | **5 attempts** | Thwart online brute-force password guessing. |
| `POST /auth/forgot-password` | 1 hour | **3 attempts** | Prevent email bomb flooding a user's inbox. |
| `/auth/*` other | 15 min | 30 | Generous for refresh/logout. |
| All other `/api/v1/*` | 15 min | **200 requests** | General DoS protection. |

On 429 response, body is standard error envelope + `Retry-After` header set to remaining window seconds.

---

## 10. Security Headers (Helmet defaults + adjustments)

Helmet is applied globally. Specific overrides we may use:

```
Content-Security-Policy
  default-src 'self';
  script-src 'self' 'nonce-<per-request-random>' (in prod) ;
  style-src 'self' 'unsafe-inline' (Tailwind injects inline styles) ;
  img-src 'self' https: data: blob: ;
  frame-ancestors 'none';  (clickjacking prevention — disables iframes of our site)

X-Content-Type-Options: nosniff
X-Frame-Options: DENY        (legacy fallback for frame-ancestors)
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()  (deny unused APIs)
Strict-Transport-Security: max-age=63072000; includeSubDomains (production only — forces HTTPS for 2 years)
```

Non-CSP-related: Cookie flags for refresh_token: `HttpOnly`, `Secure` (auto-detected in HTTPS/production), `SameSite=Lax`, `Path=/api/v1/auth`, `Max-Age=604800` (7 days).
