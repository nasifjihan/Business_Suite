# Architecture — Business Suite

> High-level design decisions, full-stack request lifecycle, layer separation rationale.

---

## 1. System Overview (Text Diagram)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ BROWSER (User's Device)                                                  │
│ ┌────────────────────────────────────────────────────────────────────┐   │
│ │ Next.js 15 App (Frontend) — REACT 19 + TS 5                       │   │
│ │  ├─ Public pages: home, features, pricing, contact                │   │
│ │  ├─ Auth pages: login, forgot-password                            │   │
│ │  ├─ Dashboard shell (Sidebar + Navbar) + module pages             │   │
│ │  ├─ State: Redux Toolkit (UI state), RTK Query (API cache)       │   │
│ │  ├─ Tables: TanStack Table (server-side paginated)               │   │
│ │  ├─ Forms: React Hook Form + Zod                                 │   │
│ │  └─ Charts: Apache ECharts (lazy loaded, no SSR)                 │   │
│ └───────────────────────────────────┬────────────────────────────────┘   │
│                                     │                                    │
│  Authorization: Bearer <access_token>  (JWT, 15min, in memory)          │
│  Cookie: refresh_token                 (HTTP-only, SameSite=Lax,        │
│                                          7d, in browser cookie jar)     │
└─────────────────────────────────────┼────────────────────────────────────┘
                                      │ HTTPS
                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ REST API SERVER — Express 4.21 + Node 22 LTS + TypeScript 5             │
│                                                                          │
│  REQUEST LIFECYCLE MIDDLEWARE STACK (ORDER MATTERS!):                   │
│    1. cors()                    ← Allow FRONTEND_URL, credentials:true  │
│    2. helmet()                  ← Security headers (CSP, X-Frame, etc.) │
│    3. compression()             ← Gzip/brotli responses                │
│    4. express.json(limit='10mb')  ← Parse JSON body                    │
│    5. cookie-parser             ← Parse cookies (for refresh token)    │
│    6. express-rate-limit        ← Per-IP rate limit (100/15min)        │
│    7. ROUTER  →  /api/v1/*                                            │
│       ├─ authenticate()         ← Verify JWT; attach req.user         │
│       ├─ requirePermission()    ← RBAC: check req.permissions        │
│       ├─ validate(ZodSchema)    ← Parse req.body/query/params         │
│       ├─ Controller (thin)      ← Extract params → call Service       │
│       ├─ Service (fat)          ← BUSINESS LOGIC lives here          │
│       │                              └─ Prisma queries/transactions    │
│       └─ res.json(successResponse(data, meta?))                        │
│    8. notFound()                ← 404 for unmatched routes           │
│    9. errorHandler()            ← LAST — catches ALL errors           │
│                                    → maps typed errors → HTTP codes    │
│                                    → NEVER exposes stack in prod       │
│                                                                          │
│  ┌─ MODULES (per Section 5.3 of spec) ─────────────────────────────┐   │
│  │  auth / users / roles / permissions / audit / crm            │   │
│  │  inventory / sales / pos / hrm / dashboard / health          │   │
│  │  Each module: validators → services → controllers → routes      │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─ LIB ───────────────────────────────────────────────────────────┐   │
│  │  prisma.ts       ← Singleton PrismaClient (no dev leaks)       │   │
│  │  errors.ts       ← Typed error classes (AppError, 401, 403 etc)│   │
│  │  response.ts     ← successResponse() / errorResponse()          │   │
│  │  pagination.ts   ← parse params, build where, build meta       │   │
│  └───────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────┬────────────────────────────────────┘
                                      │ Prisma (postgres wire protocol)
                                      │ (connection pool, parameterized)
                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ POSTGRESQL 16/18 DATABASE                                               │
│  28 tables across 5 domains + auth/admin                               │
│  UUID primary keys, Decimal(12,2) for currency, B-tree indexes         │
│  Prisma-managed migrations (SQL files in prisma/migrations/)           │
│  Row-level locking (FOR UPDATE) for POS stock checkout                │
│  CHECK constraints (stock.quantity >= 0) as safety net                │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Why Next.js Frontend + SEPARATE Express Backend?

This is the #1 architecture decision. We could have used **Next.js Route Handlers** (or Pages API routes) to put everything in one app. Reasons for separating:

| Concern | Next.js Monolith API | Express Separate Backend (our choice) |
|---------|----------------------|---------------------------------------|
| **Learning value** | Route Handlers abstract the HTTP layer. Easy, but you don't learn the middleware stack. | Explicit `app.use(...)` ordering teaches request lifecycle, auth/rbac/validation chain, centralized error handling. |
| **Deployment topology** | Next deploys to Vercel. DB must be network-accessible from Vercel's edge. Works fine, but you can't deploy the API to a GPU box later without a monorepo refactor. | API and frontend deploy *separately*. Next → Vercel. Express → Render/EC2/ECS. Realistic enterprise topology; scales independently. |
| **Cold start performance** | Route handlers are serverless functions — cold starts on Hobby tier. DB connection pools are recreated per cold start. | Long-running Node process. Prisma connection pool lives the entire process lifetime. More efficient for high-traffic POST-heavy APIs like POS. |
| **DX / Package duplication** | One package.json. Less setup. | Two package.json. Some type duplication (types/ exist in both folders). Trade-off we accept for deployment + learning clarity. |
| **Testing** | Vercel Edge Runtime vs Node runtime differences are a common gotcha. | Plain Node.js. Supertest works out of the box with no adapters. |

**Decision**: Separated deployment is the standard for most companies > 5 engineers. For a portfolio project, demonstrating you understand this topology is more interview-relevant than saving 5 minutes of DX time.

---

## 3. Data Flow for a Typical Request: "User views Product list"

```
Browser (React)
   │  User clicks "Inventory > Products" in sidebar
   ▼
TanStack Table (GlobalTable.tsx)
   │  Reads URL search params: page=1, pageSize=25, sortBy=name, sortOrder=asc
   │  Calls RTK Query: useListProductsQuery({ page, pageSize, ... })
   ▼
RTK Query (productsApiSlice)
   │  Appends query params → GET http://localhost:5000/api/v1/products?...
   │  Header: Authorization: Bearer <access_token_from_Redux>
   ▼
────────────────────────── HTTPS ────────────────────────────────
   ▼
Express → middleware stack (cors/helmet/compression/JSON/rateLimit)
   ▼
products/routes.ts → router.get('/', authenticate(), requirePermission('products.read'), ...)
   │
   ├─ authenticate():
   │   ├── Extracts JWT from Authorization header
   │   ├── Verifies signature (JWT_ACCESS_SECRET), expiry
   │   ├── SELECT user + role + role_permissions + permission codes
   │   └── Attaches req.user = { id, email, roleId, permissions: ['products.read', ...] }
   │
   ├─ requirePermission('products.read'):
   │   └── Checks 'products.read' is in req.user.permissions
   │       If not → next(new AuthorizationError('Missing permission...'))
   │
   ▼
product controller → const { page, pageSize, sortBy, sortOrder, search } = parsePaginationParams(req.query)
   ▼
ProductService.list({ page, pageSize, sortBy, sortOrder, search })
   │
   ├── whereClause = buildWhereClause(search, ['name','sku'], filters)
   ├── [totalItems, items] = await prisma.$transaction([
   │       prisma.product.count({ where: whereClause }),
   │       prisma.product.findMany({
   │         where: whereClause,
   │         select: { id:true, sku:true, name:true, sellingPrice:true, status:true,
   │                   category: { select: { name: true } } },
   │         orderBy: { [sortBy]: sortOrder },
   │         skip: (page-1)*pageSize, take: pageSize,
   │       })
   │     ])
   └── return { items, meta: buildPaginationMeta({ totalItems, page, pageSize }) }
   ▼
res.json(successResponse(items, meta))
   │
   │  Response envelope shape:
   │  {
   │    success: true,
   │    data: [ { id, sku, name, sellingPrice, status, category: { name } } ],
   │    meta: { page:1, pageSize:25, totalItems:52, totalPages:3,
   │            hasNextPage:true, hasPreviousPage:false }
   │  }
   ▼
────────────────────────── HTTPS ────────────────────────────────
   ▼
RTK Query receives response → caches in Redux (keyed by cacheKey = query args)
   │  Auto-dedupes: 2 components on same page calling useListProductsQuery
   │                 with same args → only 1 network request is made
   ▼
GlobalTable.tsx receives data={items} + meta from props
   ▼
TanStack Table renders:
   - Column headers (clickable sort icons asc/desc/none per sort state)
   - 25 rows with name, sku, $price, category, StatusBadge
   - Empty state if data=[]
   - LoadingSkeleton rows if isLoading
   - Pagination footer (Page 1 of 3, Prev/Next buttons)
Browser renders → user sees product list page loaded
```

---

## 4. Typed Errors & Centralized Error Handling

All errors thrown by Service/Controller are **typed classes** from `backend/src/lib/errors.ts`:

```typescript
throw new ValidationError('Email is required');               // 422
throw new AuthenticationError('Invalid email or password');    // 401
throw new AuthorizationError('Missing permission: roles.delete'); // 403
throw new NotFoundError(`Product ${id} not found`);            // 404
throw new ConflictError(`SKU "${sku}" already exists`);        // 409
throw new BusinessRuleError('Insufficient stock for product X'); // 422 (or 409 depending on context)
```

The `errorHandler` middleware in the LAST position catches them all and maps to:

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Insufficient stock for product 'Premium Widget'. Available: 4. Requested: 10.",
    "details": [ { "path": ["items","2","qty"], "expected": "≤ 4" } ] // ValidationErrors only
  }
}
```

**Production rule**: `error.stack` is NEVER serialized to res.json in NODE_ENV=production. Only dev env exposes stack traces to client.

---

## 5. Module Dependency Boundaries (Backend)

```
health ─────┐
auth ───┐    │
users ───┤    │
roles ───┤    │
audit ───┼───►  lib/prisma.ts, lib/errors, lib/response, lib/pagination
crm ─────┤    │    ▲
inventory┤    │    │  (shared primitives ONLY)
sales ───┤    │    │
hrm ─────┤    │    │
dashboard┘    └────┘
  │
  └─ NONE of these modules import code from EACH OTHER.
     If sales needs product info, it goes DIRECTLY to Prisma
     (or we'd extract a shared ProductQueryService in lib/services/)
     NEVER `from '../../crm/services'` inside sales module.
```

Why? Keeps modules independently deployable and understandable. No circular import surprises.

---

## 6. State Management: Redux Toolkit vs RTK Query (Frontend)

**Two KINDS of state — different tools for each**:

| Type | Ownership | Persistence | Examples | Tool |
|------|-----------|-------------|----------|------|
| **Server State** | Backend DB is source of truth | Cached only, auto-invalidated | Products list, lead details, KPIs, orders | RTK Query (`createApi()`) |
| **UI / Ephemeral State** | Only lives in this browser session | Some persisted to localStorage | POS cart, sidebar collapsed, auth session, current filter state | Redux Toolkit slices (`createSlice()`) |

**Anti-Pattern Explicitly Avoided**: "I'll use RTK Query to fetch products then `extraReducers` to put them in my own products Redux slice." — **NEVER**. RTK Query is the cache; reading from RTK Query's cache IS how you get server data. Duplicating it into another slice = stale data bugs + double the code.

---

## 7. RTK Query baseQuery with Reauth Flow

One of the trickiest patterns to get right — auto-refresh access tokens when they expire:

```
App calls GET /products with access token (expired)
   ▼
Backend returns 401 Unauthorized
   ▼
RTK Query: baseQueryWithReauth.ts catches the 401 in result.error
   ▼
Calls /api/v1/auth/refresh POST (browser auto-sends the HTTP-only refresh cookie)
   ▼
Backend: validates refresh token hash against DB, not revoked, not expired
   → Issues new access token (15m) + new refresh cookie (7d, rotated)
   → OLD refresh token is marked revoked (rotation = no replay)
   ▼
New access token stored in Redux auth slice
   ▼
RTK Query RETRIES the original GET /products request (EXACTLY ONCE)
   ▼
Response 200 OK, products render (user notices nothing unusual, <1 sec total)
   ▼
If /refresh itself fails (401):
   → dispatch(logout()) → clear Redux auth → redirect('/login?redirect=currentUrl')
```

---

## 8. Why No ORM Direct From Frontend?

Why is frontend separated from database at all? Why not tools like PostgREST or Supabase auto-REST?

1. **RBAC enforcement is custom**: Permissions like `'sales.*'` require wildcard matching. Simple RLS (Row Level Security) policies are possible but complex to maintain and test. Express middleware is fully visible and unit-testable.
2. **Business logic**: The POS atomic transaction is 6 steps in order. Putting that logic in PostgreSQL stored procedures OR in the browser is harder to version-control, test, debug, audit-log. Service layer in TypeScript is where complexity lives.
3. **Vendor lock-in**: Using Prisma means the app is portable between Neon, Supabase, Render Postgres, local Postgres, and even (hypothetically) MySQL by changing provider in `schema.prisma`.
4. **Audit logging**: We use a service wrapper that logs every create/update/delete. Putting that in the application layer makes the log data rich (ip, user agent, entity before/after JSON) and queryable.

---

## 9. Request Sizing & Performance Budget

*Targets (dev / production on free tiers)*:

| Metric | Target | How we achieve it |
|--------|--------|-------------------|
| Login page LCP (Largest Contentful Paint) | < 2.5s dev / < 1.8s prod CDN | ECharts not loaded here. Only Shadcn input + button + Tailwind. |
| Dashboard load (including charts) | < 4s dev / < 2.5s prod | Lazy ECharts via `next/dynamic({ ssr: false })`, Suspense skeleton. |
| Paginated list (25 items) API response | < 200ms local DB, < 500ms remote managed DB | B-tree indexes on FK + search cols. Prisma `select:` only needed cols. |
| POS checkout (atomic tx) | < 500ms local DB / < 1.5s remote | Row-level locks are held briefly. No N+1 inside the tx. |
| Bundle size (login route gzipped) | < 150 KB gzipped | ECharts lazy loaded, not in main bundle. |
| Bundle size (dashboard route) | ECharts + data = 600-900 KB gzipped | Acceptable tradeoff; only loaded for logged-in users navigating to dashboard. |
