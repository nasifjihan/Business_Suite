# RBAC (Role-Based Access Control) — Business Suite

> 6 System Roles × ~100 Permission Codes. Enforced by `requirePermission()` middleware on the BACKEND.

---

## 1. Concepts

### What is a "Permission Code"?
A string in the format `{module}.{action}`. Examples:
- `users.read` — Can view the user list
- `products.create` — Can create a product
- `roles.delete` — Can delete custom roles
- `dashboard.read` — Can view the dashboard page + call dashboard APIs

Wildcards for ADMIN role:
- `products.*` — Matches `products.read`, `products.create`, `products.update`, `products.delete`
- `*.*` — Matches EVERYTHING. Only the ADMIN role has this. Assigned via code to the ADMIN row in seed.

### What is a "Role"?
A named set of permissions. 6 SYSTEM roles (`isSystem = true`) are non-deletable. Admins can create custom roles (e.g. "Senior Sales + Inventory reader") by picking any subset of permission codes.

### Who assigns roles to users?
ADMIN only. Edit User modal → Role dropdown. Roles are stored as `users.roleId → roles.id` FK.

---

## 2. Role Inventory & Permission Matrix

✅ = **GRANTED** · ❌ = **DENIED**

> Hint: In an interview, say "ADMIN gets wildcard `*.*`. Every other role gets a curated list. RBAC middleware matches `module.action` against user's permission codes with wildcard support."

### Legend of columns
A = ADMIN, M = MANAGER, S = SALES, C = CASHIER, H = HR, V = VIEWER

| # | Module / Permission Code | Description | A | M | S | C | H | V |
|---|---------------------------|-------------|---|---|---|---|---|---|
| | **Auth & Session** | | | | | | | |
| 1 | `auth.login` | Login (public, but checked for logging) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 2 | `auth.logout` | Logout | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 3 | `auth.refresh` | Refresh access token | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 4 | `auth.me` | Get my user profile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 5 | `auth.forgotPassword` | Public (no perm needed) | — | — | — | — | — | — |
| | | **Administration** | | | | | | |
| 6 | `dashboard.read` | View dashboard page & APIs | ✅ | ✅ | ✅ | ❌ *see note* | ✅ | ✅ |
| 7 | `users.read` | View user list/details | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 8 | `users.create` | Invite/create new users | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 9 | `users.update` | Edit user fields / role | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 10 | `users.delete` | Deactivate users | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 11 | `roles.read` | View roles + permission assignments | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 12 | `roles.create` | Create custom roles | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 13 | `roles.update` | Edit roles + change permissions | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 14 | `roles.delete` | Delete custom (non-system) roles | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 15 | `permissions.read` | List all permission codes (for role edit UI) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 16 | `audit.read` | View audit logs | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | | **CRM** | | | | | | |
| 17 | `customers.read` | View customers, contacts, history | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| 18 | `customers.create` | Add customer | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| 19 | `customers.update` | Edit customer | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| 20 | `customers.delete` | Deactivate customer | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 21 | `leads.read` | View leads list, pipeline, details | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| 22 | `leads.create` | Add lead | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| 23 | `leads.update` | Edit lead, change status, assign | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| 24 | `leads.delete` | Delete/archive lost lead | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 25 | `activities.create` | Add lead/customer activity note | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| | | **Inventory** | | | | | | |
| 26 | `categories.read` | View categories list | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| 27 | `categories.create` | Create category | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 28 | `categories.update` | Edit category | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 29 | `categories.delete` | Delete category (if empty) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 30 | `products.read` | View products + stock by warehouse | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| 31 | `products.create` | Create product | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 32 | `products.update` | Edit product | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 33 | `products.delete` | Deactivate product | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 34 | `warehouses.read` | View warehouses | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| 35 | `warehouses.create` | Create warehouse | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 36 | `warehouses.update` | Edit warehouse | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 37 | `warehouses.delete` | Delete warehouse (if empty) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 38 | `inventory.read` | View stock overview, stock movements, low stock | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| 39 | `inventory.update` | Perform stock adjustments, transfers | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| | | **Sales & POS** | | | | | | |
| 40 | `pos.use` | Access POS page + do checkout | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| 41 | `orders.read` | View orders list & details | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| 42 | `orders.create` | Create order (non-POS, e.g. backoffice) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| 43 | `orders.cancel` | Cancel order (restores stock, voids invoice) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 44 | `invoices.read` | View & print invoices | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| 45 | `payments.read` | View payment history | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| 46 | `payments.create` | Record a payment against invoice | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 47 | `sales.reports` | Access sales trend/top products/etc raw endpoints | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| | | **HRM** | | | | | | |
| 48 | `hr.read` | View departments/designations/employees list | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| 49 | `hr.update` | CRUD departments, designations | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| 50 | `employees.read` | View employees | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| 51 | `employees.create` | Add employee | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| 52 | `employees.update` | Edit employee record | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| 53 | `employees.delete` | Terminate employee (soft) | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| 54 | `attendance.read` | View attendance (HR sees all; non-HR sees own only — enforced in query) | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ *own* |
| 55 | `attendance.write` | Check in / check out (self-service + admin backdate) | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ *own* |
| 56 | `leave.read` | View leave requests (HR sees all; non-HR sees own only) | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ *own* |
| 57 | `leave.create` | Submit leave request (self) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 58 | `leave.approve` | Approve / Reject leave | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| 59 | `leave.cancel` | Cancel my own pending request | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Design Notes
- **CASHIER deliberately narrow**: Cashier can do POS, read customers and products to operate checkout. Cannot edit anything. Cannot see dashboard KPIs (prevents front-desk snooping on financials). That's the `❌ *see note*` on row 6 for CASHIER — intentional.
- **VIEWER never writes**: All 40+ `*.read` permissions, ZERO create/update/delete. Perfect for an external auditor or CFO "look but don't touch" account.
- **SALES narrower than MANAGER**: Sales can add customers + leads + do POS checkout (close deals face-to-face), but can't edit product prices, can't access stock adjustment (prevent theft channel — POS decreases stock, but stock adjustment + cash refund = steal).
- **MANAGER CANNOT access Administration section (users/roles/audit)**: Separation of duties. The person closing the cash register at 5pm should not be the person resetting the ADMIN password.
- **Self-service pattern in HRM**: `attendance.read` / `leave.read` — the permission check allows it, but the service layer narrows the DB query. If role != HR && role != ADMIN then add `where: { employeeId: currentUser.employeeId }`. The double-layer (middleware + query where) ensures: (a) a VIEWER can list leave requests, but ONLY theirs; (b) an HR staffer sees everyone's.
- **Approve requires explicit `leave.approve`**: Not folded into `hr.update` because approving leave is a sensitive action. You might want to grant "HR admin who can add employees but not approve leave" to a trainee HR.

---

## 3. Permission Matching Algorithm (Backend)

File: `backend/src/utils/permissions.ts` → `hasPermission(userPermissions: string[], required: string): boolean`

Used by `requirePermission()` middleware:

```typescript
// Given: userPermissions = ['products.*', 'customers.read']
// Required: 'products.create' → match
// Required: 'products.delete' → match
// Required: 'customers.update' → NO match
// Required: 'users.read' → NO match
// ADMIN ALWAYS has ['*.*'] in their permission list so everything matches
```

Algorithm (simple loop, short-circuits):
```
FOR each userPerm IN userPermissions:
   IF userPerm === required                          → RETURN true
   IF userPerm === '*.*'                              → RETURN true (ADMIN)
   Split userPerm on '.' → [uMod, uAct]
   Split required on '.' → [rMod, rAct]
   IF uMod === rMod AND (uAct === '*' OR uAct === rAct) → RETURN true
END
RETURN false
```

No regex. No libs. 6 lines of TS. Fast, auditable, testable.

---

## 4. Frontend UI Permission Gating (NOT Security)

`frontend/src/components/common/PermissionGate.tsx`:
```tsx
<PermissionGate permission="roles.delete" fallback={<span className="opacity-50">No Access</span>}>
  <GlobalButton variant="destructive">Delete Role</GlobalButton>
</PermissionGate>
```

Also drives the sidebar: Sidebar component maps nav items to required permission. Items missing permission are hidden (or rendered grayed + tooltip).

### Critical Security Discipline
> The backend RBAC middleware is the REAL security. The frontend hiding buttons is a UX optimization ONLY.
>
> Example interviewer question: "What if I open Chrome DevTools, find the user-management route handler, and manually make a DELETE /users/:id request with my cashier's JWT?"
>
> Correct answer: "The cashier JWT is valid (so `authenticate()` passes and 401 is not the response). But the next middleware is `requirePermission('users.delete')` which checks the cashier's permission list. The cashier doesn't have it, so middleware calls `next(new AuthorizationError(...))` and Express returns 403 Forbidden. The DB row is never touched. We also have tests in rbac.test.ts that exercise exactly this case to prevent regressions."

---

## 5. How to Add a New Permission (Workflow for Future Developers)

If we add a new feature — say, "Product Bulk Import" (Phase V2):

1. **Step 1 — Add code to DB (one-time)**
   - In `prisma/seed.ts`, inside the permissions seed array, add:
     `{ code: 'products.import', module: 'products', action: 'import' }`
   - Run `npx prisma db seed` again (or manually INSERT the row if seed can't be re-run).

2. **Step 2 — Backend route middleware**
   - Add to the POST import route: `router.post('/import', authenticate(), requirePermission('products.import'), validate(importSchema), controller.import)`

3. **Step 3 — Frontend Gate**
   - Wrap the button: `<PermissionGate permission="products.import"> <Button>Import CSV</Button> </PermissionGate>`

4. **Step 4 — Assign to roles (Admin UI)**
   - ADMIN logs in, navigates to Administration → Roles → Edit Role (MANAGER) → Check the newly available "products.import" checkbox → Save.
   - Done. MANAGERs can now import products. CASHIERs and SALES cannot (unless explicitly granted).

*Note*: System roles (ADMIN/MANAGER/...) have curated starting permission sets from seed. After seed runs once, the UI (or manual DB edit) is the way to extend role permissions. No more editing seed to re-assign — that would overwrite customizations.

---

## 6. Audit Logging of Permission Checks?

Explicitly NO for the permission middleware itself. Checking permissions on every API call (100 req/sec) and writing a DB row each time kills performance.

*What we DO log:*
- **Auth events**: LOGIN, LOGIN_FAILED, LOGOUT, REFRESH, REVOKE (in audit_logs as action enum).
- **Data mutating events**: Every POST / PATCH / DELETE successful response writes 1 audit_logs row with entityType, entityId, beforeData (JSON), afterData (JSON), userId, ipAddress, userAgent — done via `auditLogger` middleware that runs AFTER the successful response.
- **DENIED permission attempts**: Every `next(new AuthorizationError(...))` in middleware writes a WARN-level server log (stdout/stderr via logger), but NOT to the DB audit table. In production you'd ship stdout to a log aggregator (Sentry / Datadog) and alert on bursts of 403s to detect compromised accounts probing for endpoints.
