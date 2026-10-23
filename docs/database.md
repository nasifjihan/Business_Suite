# Database Architecture — Business Suite

> 30 tables, 5 business domains + auth/admin. PostgreSQL 16/18, Prisma ORM.

---

## 1. Design Rules (Non-Negotiable)

| # | Rule | Why | Exceptions |
|---|------|-----|------------|
| 1 | **All PKs are `UUID`** (`@id @default(uuid())`) | Prevents ID enumeration in URLs, allows client-side ID gen if needed. | None. |
| 2 | **All money columns are `Decimal(14,2)`** | IEEE 754 floats accumulate rounding errors ($0.10+$0.20 !== $0.30 in JS binary floats). Prisma maps `Decimal` to strings over the wire; frontend uses formatted display only. | None. |
| 3 | **All timestamps are `DateTime @db.Timestamptz` UTC** | PostgreSQL `timestamptz` stores UTC internally. Display converts in browser via Intl API. Never store "local server time". | Date-only columns (attendanceDate, dueDate, startDate) use `@db.Date` not timestamptz. |
| 4 | **Soft delete ONLY for core business entities** that have historical linkage. | Deleting a customer shouldn't delete their orders. Soft delete = `status = INACTIVE/DELETED`. Query scopes exclude by default. | Transaction tables (order_items, stock_movements, attendance), join tables (role_permissions, contacts sub-entities, refresh_tokens, audit_logs → HARD delete. |
| 5 | **Unique constraints on every business code column** | `sku`, `customerCode`, `orderNumber`, `invoiceNumber`, `paymentNumber`, `employeeCode`, `email` (users). Prevents duplicates at DB level even if Zod validation has a bug. | None. |
| 6 | **FK indexes on every FK column + common filter/sort cols** | Seq scan on 10k row joins is slow. B-tree indexes = log(n) lookup. | None. |
| 7 | **CHECK constraints as defense-in-depth** | `stock.quantity >= 0`. Even if application code has a race, Postgres refuses to write negative stock. The "belt" alongside the "suspenders" of row-level locking. | None. |
| 8 | **`createdAt` + `updatedAt` on every mutable table** (except pure join/junction) | Required for audit, filtering, sorting, debug. Set `createdAt` ONCE at insert. | None. |
| 9 | **On FK delete: pick the action that matches the relationship** — `Cascade` only for owned children, `SetNull` for optional attribution links, `Restrict` where children must block a delete. | Deleting a role shouldn't cascade-delete all users in that role; deleting a user shouldn't erase the orders they created. `Restrict` throws a clear DB error; `SetNull` keeps the row but forgets who made it. | **Cascade** (owned children): order_items → orders, contacts → customers, lead_activities → leads, activities → leads/customers/opportunities, contracts → customers, stock / stock_movements → products & warehouses, role_permissions → roles & permissions, refresh_tokens / password_reset_tokens → users. **SetNull** (optional attribution): most `createdBy`/`assignedToId`/`signedById`/`managerId`/`receivedBy`/`processedBy`/`approvedById` columns, every `refunds` FK, `audit_logs.userId`, `invoices.orderId`, `payments.invoiceId`/`orderId`, and `users.employeeId`. **Restrict** (children block delete): users.roleId, orders.customerId, invoices.customerId, order_items.productId, lead_activities.userId, activities.userId, attendance.employeeId, leave_requests.employeeId & leaveTypeId. |

---

## 2. Table Inventory (30 Total)

### Auth/Admin (7 tables)
| # | Table | PK | Uniques | FKs | Soft Delete? |
|---|-------|----|---------|-----|--------------|
| 1 | `users` | id | email | roleId → roles, employeeId → employees | Yes (status INACTIVE) |
| 2 | `roles` | id | name | — | No (isSystem roles non-deletable) |
| 3 | `permissions` | id | code | — | No |
| 4 | `role_permissions` | (roleId, permissionId) composite | — | roleId → roles, permissionId → permissions | No (hard delete on unassign) |
| 5 | `refresh_tokens` | id | jti, tokenHash | userId → users | No (hard delete/revoke) |
| 6 | `password_reset_tokens` | id | tokenHash | userId → users | No (single-use; hard delete/expire) |
| 7 | `audit_logs` | id | — | userId → users (nullable for system actions) | No (append-only, never delete) |

### CRM (7 tables)
| # | Table | PK | Uniques | FKs | Soft Delete? |
|---|-------|----|---------|-----|--------------|
| 8 | `customers` | id | customerCode, email nullable unique | createdBy → users | Yes (status INACTIVE) |
| 9 | `contacts` | id | — | customerId → customers (Cascade) | No |
| 10 | `leads` | id | leadCode | assignedToId, createdBy → users | Yes (status WON/LOST is soft archival, not deleted) |
| 11 | `lead_activities` | id | — | leadId → leads (Cascade), userId → users | No |
| 12 | `opportunities` | id | opportunityCode | customerId → customers, leadId → leads, assignedToId, createdById → users | No |
| 13 | `activities` | id | — | userId → users, leadId → leads (Cascade), customerId → customers (Cascade), opportunityId → opportunities (Cascade) | No |
| 14 | `contracts` | id | contractCode | customerId → customers (Cascade), signedById, createdById → users | No |

### Inventory (5 tables)
| # | Table | PK | Uniques | FKs | Soft Delete? |
|---|-------|----|---------|-----|--------------|
| 15 | `categories` | id | name | parentId → categories (self-ref) | Yes (hard delete; tree) |
| 16 | `products` | id | sku | categoryId → categories, createdById → users | Yes (status INACTIVE) |
| 17 | `warehouses` | id | code, name | managerId, createdById → users | No (isActive flag) |
| 18 | `stock` | **(productId, warehouseId) COMPOSITE PK** | (enforced by being the PK) | productId → products (Cascade), warehouseId → warehouses (Cascade) | No (NEVER delete a stock row; adjust qty) |
| 19 | `stock_movements` | id | — | productId → products (Cascade), warehouseId → warehouses (Cascade), userId, createdBy → users | No (append-only audit) |

### Sales/POS (5 tables)
| # | Table | PK | Uniques | FKs | Soft Delete? |
|---|-------|----|---------|-----|--------------|
| 20 | `orders` | id | orderNumber | customerId → customers (Restrict), warehouseId → warehouses, createdBy → users | No (status CANCELLED archival) |
| 21 | `order_items` | id | — | orderId → orders (**Cascade**), productId → products (Restrict) | No |
| 22 | `invoices` | id | invoiceNumber | orderId → orders, customerId → customers (Restrict) | No (status VOID archival) |
| 23 | `payments` | id | paymentNumber | invoiceId → invoices, orderId → orders, receivedBy → users | No |
| 24 | `refunds` | id | refundNumber | orderId → orders, orderItemId → order_items, paymentId → payments, productId → products, processedBy → users (all SetNull) | No |

### HRM (6 tables)
| # | Table | PK | Uniques | FKs | Soft Delete? |
|---|-------|----|---------|-----|--------------|
| 25 | `departments` | id | code, name | managerId → users | Yes (status INACTIVE) |
| 26 | `designations` | id | code, name | departmentId → departments | Yes (status INACTIVE) |
| 27 | `employees` | id | employeeCode, email | departmentId → departments, designationId → designations, managerId → employees (self-ref) | Yes (status INACTIVE/TERMINATED) |
| 28 | `attendance` | id | **(employeeId, attendanceDate) composite unique** | employeeId → employees (Restrict) | No (hard delete if mistake; should be rare) |
| 29 | `leave_types` | id | code, name | — | Yes (status INACTIVE) |
| 30 | `leave_requests` | id | — | employeeId → employees, leaveTypeId → leave_types, approvedById → users | No; status CANCELLED if revoked |

### System (Prisma/PG managed — NOT part of the 30 application models)
| Table | Note |
|-------|------|
| `_prisma_migrations` | Prisma managed; never hand-edit |
| `pg_*` system tables | PostgreSQL internals; ignore |

### New Columns — Phase 4 (2FA) & Phase 5 (product image)

| Model | Column | Type | Nullable | Default | Notes |
|-------|--------|------|----------|---------|-------|
| `User` | `twoFactorEnabled` | `Boolean` | no | `false` | The switch the login flow reads. Flipped to `true` only after the user proves a working code, so a half-finished setup can never lock anyone out. |
| `User` | `twoFactorSecret` | `String?` (`TEXT`) | yes | — | The TOTP secret, stored **encrypted** with AES-256-GCM — deliberately not hashed, because verifying a code means recomputing it from the original secret. Format `v1.<iv>.<authTag>.<ciphertext>` (base64url). A database dump therefore hands over no working second factor. Key: `TOTP_ENCRYPTION_KEY` (falls back to `JWT_ACCESS_SECRET`). |
| `User` | `twoFactorRecoveryCodes` | `String[]` (`TEXT[]`) | no | `[]` | **SHA-256 hashes** of the recovery codes (same reasoning as `passwordHash`). Single-use: the matching hash is removed on use. The raw codes are shown to the user in plaintext exactly once, at enrolment; no endpoint reads them back. |
| `Product` | `imageUrl` | `String?` (`TEXT`) | yes | — | Stored as a **relative** path, e.g. `/api/v1/uploads/<uuid>.png` — never an absolute URL. One row then stays correct in dev (`:5000`), Docker and production behind nginx, which each serve the same file from a different origin. |

These arrived in two migrations: the three 2FA columns in `20261023025238_add_two_factor_auth`, and `imageUrl` in `20261023031734_add_product_image_url`.

---

## 3. Relationships (Text ERD)

```
 roles ────────M2M via role_permissions───► permissions
   │
   │ 1
   │
   │ *
 users ───────────────────────────────────────────────────────────────┐
   │ (1) createdBy, assignedTo, approvedBy, receivedBy, managerId,...│
   │                                                                  │
   ├─► audit_logs, refresh_tokens                                     │
   ├─► customers.createdBy                                            │
   ├─► leads.assignedToId, lead_activities.userId                    │
   ├─► products.createdBy, warehouses.managerId                       │
   ├─► stock_movements.createdBy                                      │
   ├─► orders.createdBy, payments.receivedBy                         │
   ├─► departments.managerId, designations                           │
   ├─► employees (User.employeeId @unique → Employee, 1:1 optional, SetNull) │
   └─► leave_requests.approvedById                                    │
                                                                      │
 customers ───1:*───► contacts                    (hard cascade-del) │
   │ 1                                                                 │
   │ *                                                                 │
 orders ───1:*───► order_items (cascade)                              │
   │ 1          *│FK: productId ──────────────► products              │
   │             │                                                      │
 invoices ──1:*► payments                                              │
                                                                  │
 categories ──1:*──► products                                          │
 products ──*:1 (via stock composite PK) ──*:1── warehouses          │
   │ 1                                                                  │
   │ *                                                                  │
 stock_movements ───► productId + warehouseId                       ◄──┘
                                                                      │
 employees ──*:1──► departments                                        │
           ──*:1──► designations                                       │
           ──*:1──► employees (managerId: self-ref tree)              │
           ──1:*──► attendance, leave_requests                          │
 leave_requests ──*:1──► leave_types                                   │
```

Additional relationships added in later phases, not wired into the diagram above: `lead_activities → leads` (Cascade) and `→ users` (Restrict); `opportunities → customers` and `→ leads` (both SetNull); `activities → leads` / `→ customers` / `→ opportunities` (Cascade), with `activities.userId → users` (Restrict); `contracts → customers` (Cascade) plus `signedById` / `createdById → users` (SetNull); `refunds → orders` / `order_items` / `payments` / `products` (all SetNull); and `password_reset_tokens → users` (Cascade).

---

## 4. Enums (PostgreSQL Native Enums or Text + Check?)

**Decision: Use Prisma `enum` syntax (creates PostgreSQL native enum types) for fixed-set fields where the set rarely changes.**

Native enums:
- Enum list is validated at DB level; can't insert invalid string.
- Storage is efficient (4 bytes per value, not per-char).
- Downsides: Adding a new value requires `ALTER TYPE ... ADD VALUE` (not in a transaction pre-PG12; PG12+ fine).

Enums defined (21):
```prisma
enum UserStatus        { ACTIVE INACTIVE }
enum RoleType          { SUPER_ADMIN ADMIN MANAGER SALES CASHIER HR VIEWER }
enum CustomerStatus    { ACTIVE INACTIVE CHURNED }
enum OpportunityStage  { PROSPECTING QUALIFICATION NEEDS_ANALYSIS PROPOSAL NEGOTIATION CLOSED_WON CLOSED_LOST }
enum ContractStatus    { DRAFT SIGNED ACTIVE EXPIRED TERMINATED }
enum LeadStatus        { NEW CONTACTED QUALIFIED PROPOSAL WON LOST }
enum LeadSource        { WEBSITE REFERRAL SOCIAL PHONE EMAIL OTHER }
enum ActivityType      { CALL EMAIL MEETING NOTE TASK PROPOSAL_SENT }
enum ProductStatus     { ACTIVE INACTIVE DISCONTINUED }
enum StockMovementType { PURCHASE SALE RETURN ADJUSTMENT_IN ADJUSTMENT_OUT TRANSFER_IN TRANSFER_OUT }
enum MovementType      { IN OUT TRANSFER_IN TRANSFER_OUT ADJUST COUNT SCRAP }
enum OrderStatus       { PENDING CONFIRMED PROCESSING SHIPPED DELIVERED COMPLETED CANCELLED REFUNDED }
enum PaymentStatus     { PENDING UNPAID PARTIAL PAID FAILED REFUNDED }
enum PaymentMethod     { CASH CARD MOBILE_BANKING BANK_TRANSFER CREDIT WALLET }
enum RefundReason      { DEFECTIVE WRONG_ITEM DAMAGED CUSTOMER_CHANGE OTHER }
enum InvoiceStatus     { DRAFT ISSUED PAID VOID OVERDUE }
enum EmploymentType    { FULL_TIME PART_TIME CONTRACT INTERN }
enum EmployeeStatus    { ACTIVE INACTIVE ON_LEAVE TERMINATED }
enum AttendanceStatus  { PRESENT LATE ABSENT LEAVE HALF_DAY }
enum LeaveStatus       { PENDING APPROVED REJECTED CANCELLED }
enum AuditAction       { CREATE UPDATE DELETE LOGIN LOGIN_FAILED LOGOUT }
```

---

## 5. Index Strategy (B-Tree unless noted)

### Mandatory Indexes (created in Prisma schema via `@@index`)
- **Every FK column that isn't already part of a PK or unique** (as declared by `@@index` in `schema.prisma`):
  - users.roleId, users.employeeId, users.status
  - audit_logs.userId, audit_logs.entityType, audit_logs.entityId, audit_logs.action, audit_logs.createdAt, audit_logs.(createdAt, entityType, userId)
  - customers.createdBy
  - contacts.customerId
  - leads.assignedToId, leads.createdBy, leads.status, leads.(status, createdAt)
  - lead_activities.leadId, lead_activities.userId, lead_activities.activityAt
  - opportunities.customerId, opportunities.leadId, opportunities.assignedToId, opportunities.stage, opportunities.expectedCloseDate
  - activities.userId, activities.leadId, activities.customerId, activities.opportunityId
  - contracts.customerId, contracts.status, contracts.(startDate, endDate)
  - categories.parentId, categories.createdById
  - products.categoryId, products.createdById, products.status, products.name (for search), products.barcode, products.unitPrice, products.createdAt (products.sku is unique)
  - warehouses.managerId, warehouses.createdById
  - stock.warehouseId, stock.quantity (productId is part of the composite PK)
  - stock_movements.productId, stock_movements.warehouseId, stock_movements.movementType, stock_movements.createdAt
  - orders.customerId, orders.warehouseId, orders.orderDate, orders.status, orders.paymentStatus, orders.createdBy
  - order_items.orderId, order_items.productId
  - invoices.orderId, invoices.customerId, invoices.dueAt, invoices.status
  - payments.invoiceId, payments.orderId, payments.paidAt, payments.receivedBy
  - refunds.orderId, refunds.orderItemId, refunds.paymentId, refunds.productId, refunds.processedBy
  - departments.managerId
  - designations.departmentId
  - employees.departmentId, employees.designationId, employees.managerId, employees.status
  - attendance.attendanceDate, attendance.status (employeeId is covered by the (employeeId, attendanceDate) composite unique)
  - leave_requests.employeeId, leave_requests.leaveTypeId, leave_requests.status, leave_requests.startDate, leave_requests.approvedById

### Search Optimization
- `products.name` + `products.sku`: Both indexed. Search queries use `WHERE name ILIKE '%widget%' OR sku ILIKE 'WID-%'`.
  - *Note*: For >100k rows, switch to PostgreSQL `pg_trgm` GIN trigram indexes. V1 uses standard B-tree; trigram is Phase 10 if needed.
- `customers.name`, `customers.email`: B-tree indexes (`customers.companyName` is *not* indexed); trigram if scale demands it.

### Date Columns (BRIN indexes for time-ordered huge tables)
For audit_logs, stock_movements, orders.createdAt, attendance.attendanceDate — if these tables reach millions of rows, a BRIN index (Block Range Index) is dramatically smaller and faster than B-tree for date-range scans. V1 uses B-tree (simpler). Mention in interview: "For audit_logs > 1M rows, I'd convert `createdAt` to a BRIN index — 100x smaller on disk."

### Unique Constraints (already indexed implicitly by PostgreSQL)
- users.email
- products.sku
- customers.customerCode; customers.email (UNIQUE if not null)
- leads.leadCode
- warehouses.code; warehouses.name
- orderNumber, invoiceNumber, paymentNumber
- employeeCode; employees.email (if not null)
- departments.code; departments.name; designations.code; designations.name; leave_types.code; leave_types.name
- stock (productId, warehouseId) composite PK (already indexed)
- attendance (employeeId, attendanceDate) composite unique

---

## 6. Money & Decimals: How They Flow

**Rule: NEVER do math with `number` in JavaScript for money.** Correct path:

```
PostgreSQL: DECIMAL(14,2) column e.g. product.unitPrice = '49.99'
  │  Prisma reads it as a JS string: "49.99"  (or Decimal.js if configured; we use strings for transport)
  ▼
Express: Service layer does PRICE MATH with BigInt + fixed-point OR use strings & DB-side SUM.
  │  - Order totals are computed inside the Prisma transaction (not JS loop)
  │  - Dashboard aggregates are SQL SUM()/AVG() via $queryRaw
  │  → avoids any IEEE rounding on the server
  ▼
API response: strings in JSON: "unitPrice": "49.99", "totalAmount": "1248.50"
  ▼
React/Frontend: MoneyDisplay.tsx component reads the string
  → new Intl.NumberFormat('en-US', { style:'currency', currency:'USD' }).format(Number(val))
  → user sees $1,248.50
  → FOR DISPLAY ONLY; never adding/subtracting these in frontend for checkout totals
  ▼
POS checkout request: SENDS { items: [{ productId, qty }] }  ← NO prices in body
  │  (backend re-looks EVERY price from the products table; ignores anything client sends about $)
  ▼
PostgreSQL transaction: uses DB prices only
```

---

## 7. Migrations Policy

### Creating
```bash
cd backend
# (edit prisma/schema.prisma — add model/field/index/enum-value)
npx prisma migrate dev --name descriptive_name_snake_case
# → auto-generates prisma/migrations/TIMESTAMP_name/migration.sql
# → auto-runs it against dev DB
# → auto-runs prisma generate to refresh client types
```

### In Production / CI
```bash
cd backend
# Apply all pending migrations without interactive prompts
npx prisma migrate deploy
```

### Naming Convention for migration names
`{action}_{entity}_{detail}`:
- `init_core_tables` (Phase 1)
- `add_indexes_on_orders_and_audit` (Phase 10)
- `add_employee_user_link_fk` (if needed in Phase 8)

### Never Do This
- ❌ `prisma db push` for schema changes after init (skips migration files = no history; only for prototypes before V1)
- ❌ Hand-editing `migration.sql` in a migration that's already been applied to any DB (changes must be NEW migration file)
- ❌ Deleting migrations folder once it has seeded real dev data (if you do, `prisma migrate resolve --applied <previous_migration_name>` to recover)

---

## 8. Seed Data Strategy (`prisma/seed.ts`)

Runs via: `npx prisma db seed` (after Prisma 4+, seed script is declared in package.json prisma.seed key):

```json
{
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

Seed rules:
1. **Idempotent-ish**: Checks if ADMIN role exists first. If seed has already run, log "Already seeded — skipping" and exit 0. (Allows repeated runs in CI without crashing.)
2. **Deterministic naming**: Realistic, not gibberish — employees named "Aarav Sharma", "Priya Patel" (or your region's common names); products "Wireless Mouse MX-3000" not `Product 123456`.
3. **Historical dates**: Historical orders/attendance span 3 months into the past so dashboard charts have trend data, not all TODAY.
4. **One seeded user**: a single SUPER_ADMIN, `admin@example.com` / `Admin@123` (`mustChangePassword: true`). All 7 roles exist, but only this one account is created — other roles' users must be added via Administration → Users (or the dedicated `npm run seed:e2e`, which adds the Playwright account).
5. **One realistic product image URL per product**: Via the AI image endpoint or placehold.co/400x300.
6. **Warehouse stock values**: Stock totals are realistic; some products are below min (so low-stock widget shows something on day 1).
7. **No customer PII**: Use `@example.com` emails, fake phone numbers. Never use seed data scraped from real people.

---

## 9. Backup & Restore (Learning — Phase 13)

Not implemented in V1 codebase. Documenting for completeness for interview talk-track:

- **Local dev backup**: `pg_dump -U postgres -d business_suite -Fc > backup_2026_08_25.dump` (custom format, compressed)
- **Restore**: `pg_restore -U postgres -d business_suite -c backup_2026_08_25.dump` (-c drops before restore)
- **Managed DB backups**: Neon/Supabase/Render auto-point-in-time-recovery on free tiers — USE THEM. Enable when we deploy Phase 12.
- **Backup frequency talk**: Enterprise = continuous WAL archiving (WAL-E / pgBackRest) + daily pg_dump. For our app, managed-db point-in-time is "good enough" and the interview answer.

---

## 10. Known Trade-offs & Interview Talking Points

| Trade-off | Why we chose this way | Alternative + why rejected |
|-----------|----------------------|----------------------------|
| **30 tables, 1 schema file** (`schema.prisma`) | Single source of truth; easy to see entire DB model at a glance. | Split schema by module (Prisma supports multi-file). Rejected because Prisma's multi-file support is newer and tooling (format) is shakier. Monolithic schema is fine for 30 tables. |
| **UUIDs as PKs** | Security (no enumeration), portable. | BigInt (serial/identity) — smaller indexes, faster joins. Rejected because ID enumeration in URLs + audit log PK is a real security smell interviewers flag. Interview addendum: "I'd consider ULIDs if we needed time-ordered random PKs." |
| **Prisma over Drizzle/Kysely** | Best-in-class migration engine + type generation; docs; community. Drizzle = "SQL-like TS"; Kysely = pure query builder no migration tool. Prisma wins for teaching tooling completeness. | Both good. Drizzle is gaining traction; worth learning in future projects. |
| **One inventory `stock` table with composite PK** | Clean model; natural unique constraint. | Alternative: no composite PK, just unique index on (productId,warehouseId) + single id PK. Either works; composite PK "feels" more correct for a pure junction-with-data table. |
