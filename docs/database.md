# Database Architecture — Business Suite

> 28 tables, 5 business domains + auth/admin. PostgreSQL 16/18, Prisma ORM.

---

## 1. Design Rules (Non-Negotiable)

| # | Rule | Why | Exceptions |
|---|------|-----|------------|
| 1 | **All PKs are `UUID`** (`@id @default(uuid())`) | Prevents ID enumeration in URLs, allows client-side ID gen if needed. | None. |
| 2 | **All money columns are `Decimal(12,2)`** | IEEE 754 floats accumulate rounding errors ($0.10+$0.20 !== $0.30 in JS binary floats). Prisma maps `Decimal` to strings over the wire; frontend uses formatted display only. | None. |
| 3 | **All timestamps are `DateTime @db.Timestamptz` UTC** | PostgreSQL `timestamptz` stores UTC internally. Display converts in browser via Intl API. Never store "local server time". | Date-only columns (attendanceDate, dueDate, startDate) use `@db.Date` not timestamptz. |
| 4 | **Soft delete ONLY for core business entities** that have historical linkage. | Deleting a customer shouldn't delete their orders. Soft delete = `status = INACTIVE/DELETED`. Query scopes exclude by default. | Transaction tables (order_items, stock_movements, attendance), join tables (role_permissions, contacts sub-entities, refresh_tokens, audit_logs → HARD delete. |
| 5 | **Unique constraints on every business code column** | `sku`, `customerCode`, `orderNumber`, `invoiceNumber`, `paymentNumber`, `employeeCode`, `email` (users). Prevents duplicates at DB level even if Zod validation has a bug. | None. |
| 6 | **FK indexes on every FK column + common filter/sort cols** | Seq scan on 10k row joins is slow. B-tree indexes = log(n) lookup. | None. |
| 7 | **CHECK constraints as defense-in-depth** | `stock.quantity >= 0`. Even if application code has a race, Postgres refuses to write negative stock. The "belt" alongside the "suspenders" of row-level locking. | None. |
| 8 | **`createdAt` + `updatedAt` on every mutable table** (except pure join/junction) | Required for audit, filtering, sorting, debug. Set `createdAt` ONCE at insert. | None. |
| 9 | **On FK delete: prefer `Restrict` / `NoAction`** except for owned children. | Deleting a role shouldn't cascade-delete all users in that role. `OnDelete: Restrict` throws a clear DB error. `Cascade` OK for order_items (belongs 100% to order). | Cascade: order_items → orders, contacts → customers, lead_activities → leads. Restrict: everything else. |

---

## 2. Table Inventory (28 Total)

### Auth/Admin (6 tables)
| # | Table | PK | Uniques | FKs | Soft Delete? |
|---|-------|----|---------|-----|--------------|
| 1 | `users` | id | email | roleId → roles | Yes (status INACTIVE) |
| 2 | `roles` | id | name | — | No (isSystem roles non-deletable) |
| 3 | `permissions` | id | code | — | No |
| 4 | `role_permissions` | (roleId, permissionId) composite | — | roleId → roles, permissionId → permissions | No (hard delete on unassign) |
| 5 | `refresh_tokens` | id | tokenHash UNIQUE | userId → users | No (hard delete/revoke) |
| 6 | `audit_logs` | id | — | userId → users (nullable for system actions) | No (append-only, never delete) |

### CRM (4 tables)
| # | Table | PK | Uniques | FKs | Soft Delete? |
|---|-------|----|---------|-----|--------------|
| 7 | `customers` | id | customerCode, email nullable unique | createdBy → users | Yes (status INACTIVE) |
| 8 | `contacts` | id | — | customerId → customers (Cascade) | No |
| 9 | `leads` | id | leadCode | assignedTo → users | Yes (status WON/LOST is soft archival, not deleted) |
| 10 | `lead_activities` | id | — | leadId → leads (Cascade), userId → users | No |

### Inventory (5 tables)
| # | Table | PK | Uniques | FKs | Soft Delete? |
|---|-------|----|---------|-----|--------------|
| 11 | `categories` | id | name | — | Yes (status INACTIVE) |
| 12 | `products` | id | sku, (name+categoryId optional unique) | categoryId → categories, createdBy → users | Yes (status INACTIVE) |
| 13 | `warehouses` | id | code, name | managerId → users | Yes (status INACTIVE) |
| 14 | `stock` | **(productId, warehouseId) COMPOSITE PK** | (enforced by being the PK) | productId → products Restrict, warehouseId → warehouses Restrict | No (NEVER delete a stock row; adjust qty) |
| 15 | `stock_movements` | id | — | productId → products, warehouseId → warehouses, createdBy → users | No (append-only audit) |

### Sales/POS (4 tables)
| # | Table | PK | Uniques | FKs | Soft Delete? |
|---|-------|----|---------|-----|--------------|
| 16 | `orders` | id | orderNumber | customerId → customers (Restrict), createdBy → users | No (status CANCELLED archival) |
| 17 | `order_items` | id | — | orderId → orders (**Cascade**), productId → products (Restrict) | No |
| 18 | `invoices` | id | invoiceNumber | orderId → orders, customerId → customers | No (status VOID archival) |
| 19 | `payments` | id | paymentNumber | invoiceId → invoices, receivedBy → users | No |

### HRM (6 tables)
| # | Table | PK | Uniques | FKs | Soft Delete? |
|---|-------|----|---------|-----|--------------|
| 20 | `departments` | id | code, name | managerId → users | Yes (status INACTIVE) |
| 21 | `designations` | id | code, name | — | Yes (status INACTIVE) |
| 22 | `employees` | id | employeeCode, email | departmentId → departments, designationId → designations, managerId → employees (self-ref) | Yes (status INACTIVE/TERMINATED) |
| 23 | `attendance` | id | **(employeeId, attendanceDate) composite unique** | employeeId → employees (Restrict) | No (hard delete if mistake; should be rare) |
| 24 | `leave_types` | id | code, name | — | Yes (status INACTIVE) |
| 25 | `leave_requests` | id | — | employeeId → employees, leaveTypeId → leave_types, approvedById → users | No; status CANCELLED if revoked |

### System (3 tables, Prisma/PG managed)
| 26 | `_prisma_migrations` | — | — | — | Prisma managed; never hand-edit |
| 27 | `pg_*` system tables | — | — | — | PostgreSQL internals; ignore |
| 28 | *(junction/audit accounted above)* | | | | |

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
   ├─► employees (not direct FK — link via userId-employee 1:1 later) │
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

---

## 4. Enums (PostgreSQL Native Enums or Text + Check?)

**Decision: Use Prisma `enum` syntax (creates PostgreSQL native enum types) for fixed-set fields where the set rarely changes.**

Native enums:
- Enum list is validated at DB level; can't insert invalid string.
- Storage is efficient (4 bytes per value, not per-char).
- Downsides: Adding a new value requires `ALTER TYPE ... ADD VALUE` (not in a transaction pre-PG12; PG12+ fine).

Enums defined:
```prisma
enum UserStatus        { ACTIVE INACTIVE }
enum RoleType          { ADMIN MANAGER SALES CASHIER HR VIEWER }
enum CustomerStatus    { ACTIVE INACTIVE }
enum LeadStatus        { NEW CONTACTED QUALIFIED PROPOSAL WON LOST }
enum LeadSource        { WEBSITE REFERRAL SOCIAL PHONE EMAIL OTHER }
enum ActivityType      { CALL EMAIL MEETING NOTE TASK }
enum ProductStatus     { ACTIVE INACTIVE DISCONTINUED }
enum StockMovementType { PURCHASE SALE RETURN ADJUSTMENT_IN ADJUSTMENT_OUT TRANSFER_IN TRANSFER_OUT }
enum OrderStatus       { PENDING CONFIRMED SHIPPED DELIVERED COMPLETED CANCELLED }
enum PaymentStatus     { UNPAID PARTIAL PAID REFUNDED }
enum PaymentMethod     { CASH CARD MOBILE_BANKING BANK_TRANSFER }
enum InvoiceStatus     { DRAFT ISSUED PAID VOID OVERDUE }
enum EmploymentType    { FULL_TIME PART_TIME CONTRACT INTERN }
enum EmployeeStatus    { ACTIVE INACTIVE ON_LEAVE TERMINATED }
enum AttendanceStatus  { PRESENT LATE ABSENT LEAVE HALF_DAY }
enum LeaveStatus       { PENDING APPROVED REJECTED CANCELLED }
enum AuditAction       { CREATE UPDATE DELETE LOGIN LOGOUT }
```

---

## 5. Index Strategy (B-Tree unless noted)

### Mandatory Indexes (created in Prisma schema via `@@index`)
- **Every FK column that isn't already part of a PK or unique**:
  - users.roleId
  - audit_logs.userId, audit_logs.entityType, audit_logs.createdAt
  - customers.createdBy
  - contacts.customerId
  - leads.assignedToId, leads.status
  - lead_activities.leadId, lead_activities.userId, lead_activities.activityAt
  - products.categoryId, products.createdBy, products.status, products.name (for search), products.sku (already unique)
  - warehouses.managerId
  - stock_movements.productId+warehouseId (composite), stock_movements.createdAt
  - orders.customerId, orders.orderDate (BRIN!), orders.status, orders.paymentStatus, orders.createdBy
  - order_items.orderId (indexed via cascade? no — create explicit), order_items.productId
  - invoices.orderId (unique? 1:1 but nullable for partial invoicing later — so just FK index), invoices.customerId, invoices.dueAt, invoices.status
  - payments.invoiceId, payments.paidAt, payments.receivedBy
  - departments.managerId
  - employees.departmentId, employees.designationId, employees.managerId, employees.status
  - attendance.employeeId, attendance.attendanceDate (already unique composite), attendance.status
  - leave_requests.employeeId, leave_requests.leaveTypeId, leave_requests.status, leave_requests.startDate

### Search Optimization
- `products.name` + `products.sku`: Both indexed. Search queries use `WHERE name ILIKE '%widget%' OR sku ILIKE 'WID-%'`.
  - *Note*: For >100k rows, switch to PostgreSQL `pg_trgm` GIN trigram indexes. V1 uses standard B-tree; trigram is Phase 10 if needed.
- `customers.name`, `customers.companyName`, `customers.email`: B-tree indexes; trigram if scale demands it.

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
PostgreSQL: DECIMAL(12,2) column e.g. product.sellingPrice = '49.99'
  │  Prisma reads it as a JS string: "49.99"  (or Decimal.js if configured; we use strings for transport)
  ▼
Express: Service layer does PRICE MATH with BigInt + fixed-point OR use strings & DB-side SUM.
  │  - Order totals are computed inside the Prisma transaction (not JS loop)
  │  - Dashboard aggregates are SQL SUM()/AVG() via $queryRaw
  │  → avoids any IEEE rounding on the server
  ▼
API response: strings in JSON: "sellingPrice": "49.99", "totalAmount": "1248.50"
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
4. **All 6 roles covered**: admin/manager/sales/cashier/hr/viewer all work with password `Admin@123`.
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
| **28 tables, 1 schema file** (`schema.prisma`) | Single source of truth; easy to see entire DB model at a glance. | Split schema by module (Prisma supports multi-file). Rejected because Prisma's multi-file support is newer and tooling (format) is shakier. Monolithic schema is fine for 28 tables (still < 800 lines). |
| **UUIDs as PKs** | Security (no enumeration), portable. | BigInt (serial/identity) — smaller indexes, faster joins. Rejected because ID enumeration in URLs + audit log PK is a real security smell interviewers flag. Interview addendum: "I'd consider ULIDs if we needed time-ordered random PKs." |
| **Prisma over Drizzle/Kysely** | Best-in-class migration engine + type generation; docs; community. Drizzle = "SQL-like TS"; Kysely = pure query builder no migration tool. Prisma wins for teaching tooling completeness. | Both good. Drizzle is gaining traction; worth learning in future projects. |
| **One inventory `stock` table with composite PK** | Clean model; natural unique constraint. | Alternative: no composite PK, just unique index on (productId,warehouseId) + single id PK. Either works; composite PK "feels" more correct for a pure junction-with-data table. |
