# Business Suite — Full Technical Project Specification

B2B ERP + CRM + POS + HRM Management System

AI-Assisted Build & Learning Specification
Version 1.0 | August 2026

Purpose: This document is the source of truth for an AI coding agent that will build the project phase-by-phase while teaching the developer the architecture, technologies, data flow, implementation decisions, testing, debugging, and deployment.

Scope decision: Python/Django and multi-tenancy are intentionally excluded from Version 1. Full accounting is also excluded. The project is designed to be realistic, resume-worthy, interview-explainable, and achievable with free-tier hosting.

## 1. Executive Summary

Business Suite is a single-organization B2B business management application that combines focused ERP, CRM, POS/Sales, Inventory, and HRM functionality. It is intentionally not a full enterprise ERP. The goal is to create one coherent product in which modules share real business data and workflows.

- Frontend: Next.js (latest stable) + React + TypeScript + Tailwind CSS + shadcn/ui.
- State/API: Redux Toolkit + RTK Query.
- Backend: Node.js + Express + TypeScript REST API.
- Database: PostgreSQL + Prisma ORM, with selected raw SQL for reporting and SQL learning.
- Authentication: JWT access/refresh tokens using secure HTTP-only cookies.
- Authorization: RBAC with role/permission checks on both API and UI.
- Tables: TanStack Table with server-side pagination, filtering, sorting, debounced search, and large-list optimization.
- Validation: Zod shared where practical; backend validation must always be authoritative.
- Charts: Apache ECharts.
- Testing: Vitest, React Testing Library, Supertest, and Playwright for critical flows.
- Deployment target: Vercel for frontend and a free-tier Node-compatible host such as Render for backend; managed PostgreSQL free tier where available.
- Docker, Docker Compose, and Nginx are learning/deployment topics and must be taught rather than blindly added.

## 2. Goals and Non-Goals

### 2.1 Goals

- Demonstrate modern full-stack JavaScript/TypeScript development.
- Demonstrate practical Next.js and React architecture.
- Demonstrate REST API design with Express.
- Demonstrate relational database design and PostgreSQL.
- Demonstrate Prisma without hiding SQL fundamentals.
- Demonstrate authentication, token refresh, RBAC, rate limiting, and secure error handling.
- Demonstrate enterprise-style reusable components and data tables.
- Demonstrate ERP/POS/CRM/HRM domain understanding.
- Demonstrate performance techniques for long lists and heavy UI modules.
- Produce a deployable application that can be shown in a resume and interview.

### 2.2 Non-Goals

- No Python or Django in Version 1.
- No multi-tenancy in Version 1.
- No full accounting/ledger system.
- No payroll engine.
- No complex procurement/MRP/manufacturing module.
- No requirement for paid AWS/DigitalOcean infrastructure.
- No invented performance numbers in the resume; measurements must be real.
- No AI-generated code should be accepted without explanation and verification.

## 3. Product Scope

| Module | Purpose | Priority |

| --- | --- | --- |

| Authentication & Session | Login, refresh, logout, protected access | Must |

| Dashboard | Business KPIs, charts, alerts, summaries | Must |

| CRM | Leads, customers, contacts, activities | Must |

| Inventory | Products, categories, warehouses, stock movements | Must |

| POS & Sales | Cart, checkout, orders, invoices, payments | Must |

| HRM | Employees, departments, designations, attendance, leave | Must |

| Administration/RBAC | Users, roles, permissions, audit logs | Must |

| Advanced performance | Virtualization, profiling, optimization | Later |

| Docker/Nginx/CI-CD | Production engineering learning | Later |

## 4. Technology Stack and Responsibilities

| Technology | Use | Learning Objective |

| --- | --- | --- |

| Next.js | Frontend application, routing, layouts, metadata, loading/error UI | Modern React/Next architecture |

| React | Interactive UI and client components | Component design and state |

| TypeScript | Frontend/backend type safety | Strong typing |

| Tailwind CSS | Utility-first styling and responsive UI | Responsive design |

| shadcn/ui | Accessible reusable UI primitives | UI composition |

| Redux Toolkit | Client/global UI state | Predictable state management |

| RTK Query | Server/API state, caching, invalidation | API integration |

| TanStack Table | Enterprise data tables | Large data UI |

| React Hook Form | Complex forms | Efficient form handling |

| Zod | Schema validation | Reliable input validation |

| Node.js | Backend runtime | Server-side JavaScript |

| Express | REST API server | Backend architecture |

| PostgreSQL | Relational database | SQL and data modeling |

| Prisma | ORM, migrations, relations, transactions | Type-safe database access |

| ECharts | Dashboard visualizations | Data visualization |

| JWT | Authentication credentials | Token-based auth |

| Vitest | Unit/integration testing | Automated testing |

| React Testing Library | UI behavior tests | User-focused frontend tests |

| Supertest | API tests | Backend verification |

| Playwright | Critical end-to-end workflows | Browser automation |

| Docker | Repeatable runtime environment | Containerization |

| Nginx | Reverse proxy learning | Production web architecture |

| Git/GitHub | Version control and collaboration | Professional workflow |

## 5. High-Level Architecture

```text
business-suite/
```

```text
├── frontend/                 # Next.js application
```

```text
├── backend/                  # Express REST API
```

```text
├── docs/                     # Architecture, ERD, API notes
```

```text
├── docker-compose.yml        # Local infrastructure learning
```

```text
├── README.md
```

```text
└── .gitignore
```

The frontend must never access PostgreSQL directly. All business data access goes through the Express REST API. Prisma is used only in the backend.

```text
Browser
```

```text
↓
```

```text
Next.js / React
```

```text
↓
```

```text
Redux Toolkit + RTK Query
```

```text
↓ HTTPS REST API
```

```text
Express
```

```text
↓ middleware
```

```text
Auth → Rate Limit → Validation → RBAC → Controller → Service
```

```text
↓
```

```text
Prisma
```

```text
↓
```

```text
PostgreSQL
```

### 5.1 Request lifecycle

1. User performs an action in the Next.js UI.
1. RTK Query sends a REST request.
1. Browser sends secure cookies automatically where applicable.
1. Express receives the request.
1. Rate-limit middleware evaluates the request.
1. Authentication middleware validates the access token.
1. RBAC middleware checks required permission.
1. Validation middleware parses request input.
1. Controller delegates business logic to a service.
1. Service performs Prisma/SQL operations.
1. Database transaction is used when multiple writes must succeed or fail together.
1. Service returns a domain result.
1. Controller sends a standardized API response.
1. RTK Query updates cache/invalidation state.
1. React re-renders only the affected UI.

## 6. Repository and Folder Structure

```text
business-suite/
```

```text
├── frontend/
```

```text
│   ├── app/
```

```text
│   │   ├── (public)/
```

```text
│   │   │   ├── page.tsx
```

```text
│   │   │   ├── features/page.tsx
```

```text
│   │   │   ├── pricing/page.tsx
```

```text
│   │   │   └── contact/page.tsx
```

```text
│   │   ├── (auth)/
```

```text
│   │   │   ├── login/page.tsx
```

```text
│   │   │   └── forgot-password/page.tsx
```

```text
│   │   ├── (dashboard)/
```

```text
│   │   │   ├── layout.tsx
```

```text
│   │   │   ├── dashboard/page.tsx
```

```text
│   │   │   ├── crm/
```

```text
│   │   │   ├── inventory/
```

```text
│   │   │   ├── pos/
```

```text
│   │   │   ├── sales/
```

```text
│   │   │   ├── hrm/
```

```text
│   │   │   └── administration/
```

```text
│   │   ├── error.tsx
```

```text
│   │   ├── global-error.tsx
```

```text
│   │   ├── loading.tsx
```

```text
│   │   ├── not-found.tsx
```

```text
│   │   ├── layout.tsx
```

```text
│   │   ├── robots.ts
```

```text
│   │   └── sitemap.ts
```

```text
│   ├── components/
```

```text
│   │   ├── ui/
```

```text
│   │   ├── layout/
```

```text
│   │   ├── forms/
```

```text
│   │   ├── tables/
```

```text
│   │   ├── feedback/
```

```text
│   │   ├── charts/
```

```text
│   │   └── common/
```

```text
│   ├── features/
```

```text
│   │   ├── auth/
```

```text
│   │   ├── crm/
```

```text
│   │   ├── inventory/
```

```text
│   │   ├── pos/
```

```text
│   │   ├── sales/
```

```text
│   │   ├── hrm/
```

```text
│   │   └── administration/
```

```text
│   ├── lib/
```

```text
│   ├── hooks/
```

```text
│   ├── store/
```

```text
│   │   ├── store.ts
```

```text
│   │   ├── hooks.ts
```

```text
│   │   └── slices/
```

```text
│   ├── types/
```

```text
│   ├── utils/
```

```text
│   └── public/
```

```text
│
```

```text
├── backend/
```

```text
│   ├── src/
```

```text
│   │   ├── config/
```

```text
│   │   ├── middleware/
```

```text
│   │   ├── modules/
```

```text
│   │   │   ├── auth/
```

```text
│   │   │   ├── users/
```

```text
│   │   │   ├── roles/
```

```text
│   │   │   ├── crm/
```

```text
│   │   │   ├── inventory/
```

```text
│   │   │   ├── sales/
```

```text
│   │   │   ├── pos/
```

```text
│   │   │   ├── hrm/
```

```text
│   │   │   ├── dashboard/
```

```text
│   │   │   └── audit/
```

```text
│   │   ├── routes/
```

```text
│   │   ├── lib/
```

```text
│   │   ├── utils/
```

```text
│   │   ├── types/
```

```text
│   │   ├── app.ts
```

```text
│   │   └── server.ts
```

```text
│   ├── prisma/
```

```text
│   │   ├── schema.prisma
```

```text
│   │   ├── migrations/
```

```text
│   │   └── seed.ts
```

```text
│   └── tests/
```

```text
│
```

```text
├── docs/
```

```text
│   ├── architecture.md
```

```text
│   ├── database.md
```

```text
│   ├── api.md
```

```text
│   ├── rbac.md
```

```text
│   └── learning-notes.md
```

```text
├── docker-compose.yml
```

```text
└── README.md
```

## 7. Database Design

PostgreSQL is the source of truth. Prisma models must represent real foreign-key relationships. IDs should use UUIDs unless there is a clear reason to use another strategy. All primary business tables should include createdAt and updatedAt. Soft deletion should be used only where business history matters; do not blindly add deletedAt to every table.

### 7.1 Core tables

| Table | Key Fields | Relationships |

| --- | --- | --- |

| users | id, email, passwordHash, firstName, lastName, phone, status, lastLoginAt, createdAt, updatedAt | role, audit logs |

| roles | id, name, description, isSystem, createdAt, updatedAt | permissions, users |

| permissions | id, code, module, action, description | roles |

| refresh_tokens | id, userId, tokenHash, expiresAt, revokedAt, createdAt | user |

| audit_logs | id, userId, action, entityType, entityId, beforeData, afterData, ipAddress, userAgent, createdAt | user |

### 7.2 CRM tables

| Table | Fields |

| --- | --- |

| customers | id, customerCode, name, companyName, email, phone, address, city, country, status, notes, createdBy, createdAt, updatedAt |

| contacts | id, customerId, name, email, phone, designation, isPrimary, createdAt, updatedAt |

| leads | id, leadCode, name, companyName, email, phone, source, status, value, assignedToId, notes, createdAt, updatedAt |

| lead_activities | id, leadId, userId, type, subject, description, activityAt, createdAt |

Lead statuses: NEW, CONTACTED, QUALIFIED, PROPOSAL, WON, LOST. Lead sources may include WEBSITE, REFERRAL, SOCIAL, PHONE, EMAIL, OTHER.

### 7.3 Inventory tables

| Table | Fields |

| --- | --- |

| categories | id, name, description, status, createdAt, updatedAt |

| products | id, sku, name, description, categoryId, brand, unit, purchasePrice, sellingPrice, taxRate, minimumStock, status, imageUrl, createdBy, createdAt, updatedAt |

| warehouses | id, code, name, address, managerId, status, createdAt, updatedAt |

| stock | id, productId, warehouseId, quantity, reservedQuantity, updatedAt |

| stock_movements | id, productId, warehouseId, type, quantity, referenceType, referenceId, note, createdBy, createdAt |

Stock movement types: PURCHASE, SALE, RETURN, ADJUSTMENT_IN, ADJUSTMENT_OUT, TRANSFER_IN, TRANSFER_OUT.

### 7.4 Sales/POS tables

| Table | Fields |

| --- | --- |

| orders | id, orderNumber, customerId, status, subtotal, discountAmount, taxAmount, totalAmount, paymentStatus, orderDate, createdBy, createdAt, updatedAt |

| order_items | id, orderId, productId, quantity, unitPrice, discountAmount, taxAmount, lineTotal |

| invoices | id, invoiceNumber, orderId, customerId, subtotal, discountAmount, taxAmount, totalAmount, status, issuedAt, dueAt, createdAt, updatedAt |

| payments | id, paymentNumber, invoiceId, amount, method, status, paidAt, reference, receivedBy, createdAt |

Order statuses: DRAFT, CONFIRMED, COMPLETED, CANCELLED. Payment methods: CASH, CARD, MOBILE_BANKING, BANK_TRANSFER. Payment status: UNPAID, PARTIAL, PAID, REFUNDED.

### 7.5 HRM tables

| Table | Fields |

| --- | --- |

| departments | id, name, code, description, managerId, status, createdAt, updatedAt |

| designations | id, name, code, description, status, createdAt, updatedAt |

| employees | id, employeeCode, firstName, lastName, email, phone, dateOfBirth, joiningDate, departmentId, designationId, managerId, employmentType, status, address, emergencyContactName, emergencyContactPhone, createdAt, updatedAt |

| attendance | id, employeeId, attendanceDate, checkInAt, checkOutAt, status, note, createdAt, updatedAt |

| leave_types | id, name, code, defaultDays, status, createdAt, updatedAt |

| leave_requests | id, employeeId, leaveTypeId, startDate, endDate, totalDays, reason, status, approvedById, approvedAt, createdAt, updatedAt |

### 7.6 Database rules

- Use foreign keys for all meaningful relationships.
- Use unique constraints for email, SKU, customerCode, employeeCode, orderNumber, invoiceNumber, and other business identifiers where appropriate.
- Add indexes to frequently filtered/joined columns such as email, SKU, customerId, productId, employeeId, orderDate, attendanceDate, status.
- Use composite indexes when query patterns justify them; verify with EXPLAIN rather than guessing.
- Use database transactions for checkout, inventory deduction, invoice/payment creation, and leave approval when multiple writes must remain consistent.
- Never trust client-provided stock totals; calculate authoritative stock on the backend.
- Use Decimal/appropriate numeric types for money rather than floating-point JavaScript numbers.
- Use UTC timestamps in storage and format them for the UI.

## 8. Module Specifications

### 8.1 Authentication & Session

- Login with email/password.
- Password hashing with a modern password-hashing library such as bcrypt or Argon2; teach the security trade-off.
- Short-lived access token.
- Longer-lived refresh token.
- Refresh token stored/managed through secure HTTP-only cookie.
- Refresh token rotation/revocation.
- Logout revokes refresh session and clears cookie.
- Protected frontend routes.
- Backend authentication middleware.
- Rate limit login and password-related endpoints.
- Standardized authentication errors that do not reveal whether an account exists.

### 8.2 RBAC

| Role | Typical Permissions |

| --- | --- |

| ADMIN | All permissions |

| MANAGER | Dashboard, CRM, inventory, sales, HRM read/manage except system administration |

| SALES | CRM and sales/POS operations; limited inventory access |

| CASHIER | POS, customer lookup, order/payment operations |

| HR | Employees, attendance, leave, HR reports |

| VIEWER | Read-only access to permitted business modules |

Permission naming convention: module.action, e.g. products.read, products.create, products.update, products.delete, orders.create, employees.read, leave.approve.

RBAC must be enforced on the backend. Frontend hiding is only a UX feature and never a security boundary.

### 8.3 Dashboard

- Total sales today, week, and month.
- Order count and average order value.
- New customers.
- Open leads and conversion summary.
- Low-stock products.
- Attendance summary.
- Recent orders.
- Recent activities.
- Sales trend chart using ECharts.
- Top-selling products.
- Dashboard APIs should return aggregated data instead of sending raw large datasets to the browser.

### 8.4 CRM

- Customer CRUD.
- Customer detail page with contacts, orders, invoices, and activity timeline.
- Lead CRUD.
- Lead pipeline with status transitions.
- Lead assignment to users.
- Lead activity notes.
- Search, filter, sort, pagination.
- Validation for email/phone/business fields.
- Permission checks on each action.

### 8.5 Inventory

- Category CRUD.
- Product CRUD.
- SKU uniqueness.
- Warehouse CRUD.
- Stock overview.
- Stock movement history.
- Low-stock filtering.
- Manual stock adjustment with audit record.
- Server-side product search and pagination.
- Product detail with stock by warehouse and movement history.

### 8.6 POS & Sales

- Search products by name/SKU.
- Add/remove cart items.
- Change quantity.
- Discount at line/order level according to the business rule defined by the implementation.
- Tax calculation.
- Customer selection or walk-in customer.
- Checkout.
- Payment method selection.
- Create order + order items + invoice + payment + stock movements in one transaction where appropriate.
- Prevent selling unavailable stock.
- Handle concurrent checkout safely using transaction/locking strategy appropriate to PostgreSQL.
- Receipt/invoice view.
- Sales history with filters and pagination.

### 8.7 HRM

- Department CRUD.
- Designation CRUD.
- Employee CRUD.
- Employee profile.
- Attendance list.
- Check-in/check-out action.
- Attendance status: PRESENT, LATE, ABSENT, LEAVE, HALF_DAY.
- Leave types.
- Leave request.
- Manager/HR approval or rejection.
- Date-range filtering.
- Pagination and reporting.

### 8.8 Administration

- User management.
- Role management.
- Permission assignment.
- User activation/deactivation.
- Audit log viewer.
- System configuration kept minimal and focused.

## 9. REST API Specification

API base path: /api/v1. All responses must use a consistent envelope.

```text
Success:
```

```text
{
```

```text
"success": true,
```

```text
"message": "Products retrieved successfully",
```

```text
"data": {...},
```

```text
"meta": {...}
```

```text
}
```

```text
Error:
```

```text
{
```

```text
"success": false,
```

```text
"message": "Validation failed",
```

```text
"code": "VALIDATION_ERROR",
```

```text
"errors": [...]
```

```text
}
```

### 9.1 Authentication endpoints

| Method | Endpoint | Purpose |

| --- | --- | --- |

| POST | /api/v1/auth/login | Authenticate user |

| POST | /api/v1/auth/refresh | Refresh access session |

| POST | /api/v1/auth/logout | Revoke session |

| GET | /api/v1/auth/me | Current user |

| POST | /api/v1/auth/forgot-password | Request password reset |

| POST | /api/v1/auth/reset-password | Reset password |

### 9.2 CRM endpoints

| Method | Endpoint | Purpose |

| --- | --- | --- |

| GET | /api/v1/customers | List customers |

| POST | /api/v1/customers | Create customer |

| GET | /api/v1/customers/:id | Customer details |

| PATCH | /api/v1/customers/:id | Update customer |

| DELETE | /api/v1/customers/:id | Delete/deactivate customer |

| GET | /api/v1/leads | List leads |

| POST | /api/v1/leads | Create lead |

| PATCH | /api/v1/leads/:id | Update lead |

| POST | /api/v1/leads/:id/activities | Add lead activity |

### 9.3 Inventory endpoints

| Method | Endpoint | Purpose |

| --- | --- | --- |

| GET | /api/v1/products | List products |

| POST | /api/v1/products | Create product |

| GET | /api/v1/products/:id | Product details |

| PATCH | /api/v1/products/:id | Update product |

| DELETE | /api/v1/products/:id | Deactivate product |

| GET | /api/v1/categories | List categories |

| GET | /api/v1/warehouses | List warehouses |

| GET | /api/v1/stock | Stock overview |

| GET | /api/v1/stock/movements | Stock movements |

| POST | /api/v1/stock/adjustments | Adjust stock |

### 9.4 Sales/POS endpoints

| Method | Endpoint | Purpose |

| --- | --- | --- |

| POST | /api/v1/orders | Create/confirm sale |

| GET | /api/v1/orders | List sales |

| GET | /api/v1/orders/:id | Order details |

| POST | /api/v1/orders/:id/cancel | Cancel order |

| GET | /api/v1/invoices/:id | Invoice details |

| POST | /api/v1/payments | Record payment |

| GET | /api/v1/sales/summary | Sales summary |

### 9.5 HRM endpoints

| Method | Endpoint | Purpose |

| --- | --- | --- |

| GET | /api/v1/employees | List employees |

| POST | /api/v1/employees | Create employee |

| GET | /api/v1/employees/:id | Employee details |

| PATCH | /api/v1/employees/:id | Update employee |

| GET | /api/v1/attendance | Attendance list |

| POST | /api/v1/attendance/check-in | Check in |

| POST | /api/v1/attendance/check-out | Check out |

| GET | /api/v1/leave-requests | List leave requests |

| POST | /api/v1/leave-requests | Submit leave request |

| POST | /api/v1/leave-requests/:id/approve | Approve leave |

| POST | /api/v1/leave-requests/:id/reject | Reject leave |

### 9.6 Administration endpoints

| Method | Endpoint | Purpose |

| --- | --- | --- |

| GET | /api/v1/users | List users |

| POST | /api/v1/users | Create user |

| PATCH | /api/v1/users/:id | Update user |

| GET | /api/v1/roles | List roles |

| POST | /api/v1/roles | Create role |

| PATCH | /api/v1/roles/:id | Update role |

| GET | /api/v1/permissions | List permissions |

| GET | /api/v1/audit-logs | Audit log list |

## 10. Pagination, Filtering, Sorting, Search

```text
GET /api/v1/products?page=2&pageSize=25
```

```text
GET /api/v1/products?search=laptop
```

```text
GET /api/v1/products?sortBy=name&sortOrder=asc
```

```text
GET /api/v1/products?categoryId=...
```

```text
GET /api/v1/products?status=ACTIVE
```

The API must return pagination metadata such as page, pageSize, totalItems, totalPages, hasNextPage, and hasPreviousPage.

- Default page size: 25.
- Maximum page size: 100.
- Search input should be debounced on the frontend.
- Filtering/sorting should happen on the server for large datasets.
- Never fetch an entire large table merely to display the first page.
- TanStack Table should operate in manual/server-side mode where appropriate.

## 11. Frontend State Architecture

| State | Owner |

| --- | --- |

| API/server data | RTK Query |

| Authentication UI/session representation | Redux Toolkit + RTK Query |

| POS cart | Redux Toolkit slice |

| Sidebar/UI preferences | Redux Toolkit slice where useful |

| Modal open state | Local React state |

| Form fields | React Hook Form |

| URL filters/pagination | URL search params where appropriate |

| Server cache | RTK Query cache |

Do not duplicate the same API data into ordinary Redux slices. RTK Query is the server-state layer.

## 12. Reusable Component System

- GlobalButton
- GlobalInput
- GlobalSelect
- GlobalMultiSelect
- GlobalDatePicker
- GlobalModal
- ConfirmDialog
- StatusBadge
- PageHeader
- GlobalTable
- TableToolbar
- Pagination
- SearchInput
- FilterPanel
- EmptyState
- ErrorState
- LoadingSkeleton
- FormField
- MoneyDisplay
- DateDisplay
- PermissionGate
- ResponsiveSidebar
- DashboardCard
  The AI must avoid creating slightly different versions of the same component for each module unless there is a documented reason.

## 13. Forms and Validation

- Use React Hook Form for complex forms.
- Use Zod schemas for frontend form validation.
- Backend must independently validate all request bodies.
- Never trust frontend validation for security.
- Display field-level errors.
- Display server business-rule errors.
- Disable submit while an operation is pending where appropriate.
- Prevent duplicate submission.
- Use accessible labels and error messages.

| Entity | Important Validation |

| --- | --- |

| User | Valid email, strong password, unique email |

| Customer | Required name, valid email when supplied, normalized phone |

| Product | Unique SKU, non-negative prices, valid tax rate, valid minimum stock |

| Order | At least one item, positive quantities, valid product IDs |

| Employee | Required employee code/name/joining date, valid department/designation |

| Leave | Valid dates, end >= start, positive days, no invalid overlap according to business rules |

## 14. Error Handling

### 14.1 Backend

- Central Express error middleware.
- Typed/custom application errors.
- ValidationError, AuthenticationError, AuthorizationError, NotFoundError, ConflictError, BusinessRuleError.
- Map known Prisma/database errors to safe API responses.
- Never expose stack traces in production.
- Log technical details server-side.
- Return safe client messages.
- Use request/correlation IDs for debugging where practical.

### 14.2 Frontend

- Next.js error.tsx for route-level failures.
- global-error.tsx for unrecoverable root-level errors.
- RTK Query error handling.
- Form validation messages.
- Toast/inline feedback for mutations.
- Empty states separate from error states.
- Loading skeletons separate from empty states.
- Retry actions where safe.

## 15. Authentication and Token Flow

```text
Login
```

```text
↓
```

```text
POST /auth/login
```

```text
↓
```

```text
Validate credentials
```

```text
↓
```

```text
Create short-lived access JWT
```

```text
Create refresh token
```

```text
↓
```

```text
Set refresh token in Secure + HttpOnly cookie
```

```text
↓
```

```text
Return access/session information
```

```text
↓
```

```text
RTK Query calls protected API
```

```text
↓
```

```text
401?
```

```text
├── no → return data
```

```text
└── yes → refresh
```

```text
↓
```

```text
rotate refresh token
```

```text
↓
```

```text
retry original request
```

```text
↓
```

```text
if refresh fails → logout
```

The implementation must teach why access tokens are short-lived, why refresh tokens need stronger protection, why HTTP-only cookies reduce JavaScript access to the refresh token, and what CSRF considerations exist.

## 16. Security Requirements

- Password hashing; never store plaintext passwords.
- HTTP-only, Secure, appropriately configured SameSite cookies for refresh/session secrets.
- CORS restricted to known frontend origins in production.
- Rate limiting on authentication and public endpoints.
- Input validation and sanitization where applicable.
- Parameterized/database-safe queries through Prisma/raw SQL parameters.
- RBAC enforced server-side.
- Avoid sensitive data in logs.
- Security headers where appropriate.
- Do not expose environment secrets to Next.js client bundles.
- Do not store database credentials in source code.
- Use HTTPS in production.
- Use generic login failure messages.

## 17. Rate Limiting

| Area | Suggested Policy |

| --- | --- |

| Login | Strict per-IP/per-account protection |

| Password reset | Strict protection |

| Public endpoints | Moderate protection |

| Authenticated API | Reasonable per-IP/user limit |

| Health check | Very light or exempt depending on hosting |

Exact limits should be configurable through environment variables and tuned based on actual deployment behavior. Do not claim a security limit is perfect; explain the trade-offs.

## 18. Performance and Long-List Optimization

- Server-side pagination for large datasets.
- Server-side filtering and sorting.
- Debounced search.
- Database indexes based on actual query patterns.
- Select only required database fields for list APIs.
- Avoid N+1 query patterns.
- Use Prisma include/select deliberately.
- Use database aggregation for dashboard metrics.
- TanStack Table manual pagination.
- Virtualize very large rendered lists where appropriate.
- Lazy-load heavy charts and rarely used components.
- Use Next.js dynamic imports for heavy client components.
- Use React memoization only when measurement or component behavior justifies it.
- Use browser/network/devtools profiling to identify real bottlenecks.
  The AI must teach the difference between server-side pagination and client-side pagination, and between pagination and virtualization.

## 19. Lazy Loading and Code Splitting

- Use Next.js route-level code splitting naturally through the App Router.
- Use dynamic imports for heavy client-only components.
- Lazy-load ECharts/dashboard visualizations when useful.
- Lazy-load large POS/report components when they are not immediately required.
- Use loading placeholders that preserve layout.
- Do not add lazy loading to tiny components merely for the sake of using the feature.
- Explain bundle size and JavaScript execution cost before introducing optimization.

## 20. SEO

SEO is intentionally basic because the main application is an authenticated business tool.

- Public pages: home, features, pricing, contact.
- Use Next.js metadata API.
- Unique title and description for public pages.
- Open Graph metadata.
- robots.txt.
- sitemap.xml.
- Semantic HTML.
- Reasonable page headings.
- No requirement to SEO-optimize private dashboard routes.

## 21. UI/UX Requirements

- Desktop-first enterprise layout but responsive down to tablet/mobile.
- Consistent spacing, typography, states, and actions.
- Accessible form labels and keyboard focus.
- Clear destructive-action confirmation.
- Consistent status badges.
- Tables must have loading, empty, error, and populated states.
- Avoid excessive modal nesting.
- Use drawers/sheets for appropriate mobile workflows.
- POS should prioritize speed and keyboard-friendly interaction.
- Use skeletons for predictable loading areas.
- Do not use color as the only indicator of status.

## 22. Charts and Analytics

Use Apache ECharts. Dashboard chart data should come from backend aggregation APIs.

- Monthly/weekly sales trend.
- Top products by quantity/revenue.
- Order status distribution.
- Lead pipeline distribution.
- Low-stock count.
- Attendance summary.
- Charts should be dynamically loaded when their size justifies it.
- Charts must handle empty datasets gracefully.

## 23. Testing Strategy

| Level | Tools | What to Test |

| --- | --- | --- |

| Unit | Vitest | Pure functions, calculations, validation helpers |

| Component | Vitest + React Testing Library | Forms, buttons, table states, permission UI |

| API integration | Vitest + Supertest | Auth, RBAC, CRUD, business rules |

| E2E | Playwright | Login → CRM, product → POS sale, HR leave flow |

| Database | Test PostgreSQL environment | Transactions and important constraints |

- Do not chase 100% coverage.
- Prioritize high-risk business logic.
- Every major bug fixed should result in a regression test when practical.
- Critical POS inventory transaction must have an automated test.
- RBAC must have tests proving unauthorized users are rejected.

## 24. Git and GitHub Workflow

```text
main
```

```text
└── dev
```

```text
├── feature/auth
```

```text
├── feature/crm
```

```text
├── feature/inventory
```

```text
├── feature/pos
```

```text
└── feature/hrm
```

- Use small, meaningful commits.
- Commit after coherent units of work.
- Use feature branches.
- Merge through pull requests even when working alone if practical.
- Never commit .env files or secrets.
- Use a useful commit style such as feat:, fix:, refactor:, docs:, test:, chore:.
- README must explain setup, architecture, environment variables, database migration, seed data, and deployment.

## 25. Environment Variables

```text
# Frontend
```

```text
NEXT_PUBLIC_API_URL=
```

```text
NEXT_PUBLIC_APP_NAME=
```

```text
# Backend
```

```text
NODE_ENV=
```

```text
PORT=
```

```text
DATABASE_URL=
```

```text
JWT_ACCESS_SECRET=
```

```text
JWT_REFRESH_SECRET=
```

```text
ACCESS_TOKEN_EXPIRES_IN=
```

```text
REFRESH_TOKEN_EXPIRES_IN=
```

```text
FRONTEND_URL=
```

```text
COOKIE_DOMAIN=
```

```text
RATE_LIMIT_WINDOW_MS=
```

```text
RATE_LIMIT_MAX=
```

```text
# Optional email/reset functionality
```

```text
SMTP_HOST=
```

```text
SMTP_PORT=
```

```text
SMTP_USER=
```

```text
SMTP_PASSWORD=
```

Secrets must never be committed. Frontend variables prefixed NEXT*PUBLIC* must contain only values safe to expose to browsers.

## 26. Docker Learning Plan

Docker is not required for the first local setup if it slows learning. After the application is stable, Docker is introduced as a separate learning phase.

- Explain image vs container.
- Explain Dockerfile.
- Explain Docker Compose.
- Containerize Express backend.
- Run PostgreSQL through Docker Compose locally.
- Use environment variables.
- Explain volumes and why database persistence matters.
- Explain container networking.
- Build and run the stack locally.
- Teach how production hosting differs from local Docker.

```text
services:
```

```text
postgres:
```

```text
image: postgres
```

```text
volumes:
```

```text
- postgres_data:/var/lib/postgresql/data
```

```text
backend:
```

```text
build: ./backend
```

```text
depends_on:
```

```text
- postgres
```

```text
volumes:
```

```text
postgres_data:
```

## 27. Nginx Learning Plan

Nginx is a learning/production architecture topic. The initial free deployment may not require it.

- Explain reverse proxy.
- Explain why frontend and API have different origins.
- Explain TLS/HTTPS termination.
- Explain forwarding /api requests.
- Explain static assets and caching at a high level.
- Create a local Nginx reverse-proxy example after Docker is understood.

```text
Browser
```

```text
↓ HTTPS
```

```text
Nginx
```

```text
├── /        → Next.js
```

```text
└── /api     → Express
```

## 28. Free Deployment Strategy

The first production deployment should prioritize free-tier availability and learning. Exact free-tier offerings can change over time, so the implementation AI must verify current limits before deployment rather than hard-code assumptions.

- Frontend: Vercel free tier.
- Backend: Render free tier or another currently available free Node hosting option.
- Database: managed PostgreSQL free tier where available; provider choice should be confirmed at deployment time.
- GitHub: source repository.
- Do not require AWS/DigitalOcean for the first deployment.
- Teach the difference between local, staging, and production configuration.
- Teach CORS and environment variables during deployment.

## 29. Seed Data

The AI should create realistic seed data so the application looks like a real product during demos.

- 1 administrator.
- 1 manager.
- 1 sales user.
- 1 cashier.
- 1 HR user.
- Several departments and designations.
- At least 30 employees.
- At least 50 products.
- Several categories and warehouses.
- At least 30 customers.
- Leads in every pipeline status.
- Historical orders and payments.
- Stock movements.
- Attendance records.
- Leave requests in multiple states.
  Seed credentials must be clearly documented and must never be reused as production passwords.

## 30. Demo Scenarios

1. Login as admin and inspect the dashboard.
1. Create a new customer in CRM.
1. Create a lead and move it through the pipeline.
1. Create a product and set stock.
1. Create a POS sale for the customer.
1. Complete payment.
1. Verify order, invoice, payment, and stock movement.
1. Open product stock and verify inventory changed.
1. Open dashboard and verify aggregated sales changed.
1. Login as cashier and verify restricted administration pages are unavailable.
1. Create an employee as HR.
1. Record attendance.
1. Submit a leave request and approve it as an authorized user.
1. Open audit logs and inspect important changes.

## 31. Development Phases

| Phase | Scope | Exit Criteria |

| --- | --- | --- |

| 0 | Planning, repository, architecture | Project boots and architecture understood |

| 1 | Next.js shell, Express shell, PostgreSQL, Prisma | Frontend/backend/database communicate |

| 2 | Auth + token refresh | Secure login/logout/refresh works |

| 3 | RBAC + administration | Permissions enforced server-side |

| 4 | Reusable UI + table infrastructure | Reusable table/form patterns exist |

| 5 | CRM | Customers/leads/activities work |

| 6 | Inventory | Products/stock/movements work |

| 7 | POS/Sales | Complete transaction updates inventory safely |

| 8 | HRM | Employees/attendance/leave work |

| 9 | Dashboard/analytics | Real aggregated metrics and charts |

| 10 | Error handling/security/performance | Production-quality hardening |

| 11 | Testing | Critical workflows covered |

| 12 | Deployment | Public frontend + API + database |

| 13 | Docker/Nginx/CI-CD learning | Developer can explain production architecture |

## 32. Mandatory AI Teaching Protocol

This section is binding for any coding AI used to build the project.

### 32.1 Rules

1. Do not generate the entire project in one response.
1. Do not silently create architecture decisions that conflict with this document.
1. Before each major phase, explain the objective, concepts, files, dependencies, and expected outcome.
1. Implement one coherent phase at a time.
1. After implementation, explain what changed and why.
1. Run tests/build/type checks when applicable.
1. When an error occurs, teach the root cause before giving the fix.
1. Do not hide generated code behind unexplained abstractions.
1. Ask for confirmation before moving to the next major phase.
1. Keep a learning-notes document updated with important concepts and decisions.
1. Do not invent metrics or completed work.
1. If a requirement is ambiguous, ask the developer instead of guessing.

### 32.2 Required explanation format

```text
PHASE X — [Name]
```

```text
1. What are we building?
```

```text
2. Why does the application need it?
```

```text
3. Concepts I will learn
```

```text
4. Architecture/data flow
```

```text
5. Files that will be created/changed
```

```text
6. Implementation
```

```text
7. Why the implementation works
```

```text
8. How to test it
```

```text
9. Common mistakes
```

```text
10. Security/performance considerations
```

```text
11. Interview questions
```

```text
12. Short recap
```

```text
13. Wait for confirmation before the next major phase
```

## 33. Interview Knowledge Targets

- Explain Next.js App Router and client/server component boundaries.
- Explain why a separate Express API is used.
- Explain REST and HTTP status codes.
- Explain JWT access/refresh token flow.
- Explain HTTP-only cookies and their security role.
- Explain RBAC and why frontend checks alone are insufficient.
- Explain RTK Query versus ordinary Redux state.
- Explain server-side pagination.
- Explain TanStack Table.
- Explain long-list optimization and virtualization.
- Explain Prisma versus raw SQL.
- Explain PostgreSQL indexes and EXPLAIN.
- Explain transactions and ACID in the POS workflow.
- Explain rate limiting.
- Explain centralized error handling.
- Explain React/Next.js error boundaries.
- Explain lazy loading/code splitting.
- Explain Docker images, containers, and Compose.
- Explain Nginx as a reverse proxy.
- Explain deployment environment variables and CORS.

## 34. Resume Truthfulness Rules

- Only list technologies actually used.
- Only list features actually implemented.
- Only state deployment platforms actually used.
- Only claim performance improvements that were measured.
- If a feature is a learning exercise, describe it honestly.
- Do not claim AWS/DigitalOcean experience unless the project actually used it.
- Do not claim Django/Python experience.
- Do not claim multi-tenancy in Version 1.

## 35. Definition of Done

- Application can be installed from README by following documented steps.
- Frontend builds successfully.
- Backend starts successfully.
- Database migrations run successfully.
- Seed data loads successfully.
- Authentication works.
- Refresh/logout works.
- RBAC blocks unauthorized backend requests.
- CRM workflows work.
- Inventory workflows work.
- POS checkout creates consistent business records.
- Inventory cannot become negative through normal checkout.
- HRM workflows work.
- Dashboard uses real API data.
- Tables support server-side pagination.
- Important forms validate correctly.
- Errors are handled without exposing sensitive information.
- Critical tests pass.
- Production deployment works.
- README and architecture documentation are complete.
- Developer can explain every major technology and workflow used.

## 36. Master Prompt for the Paid AI Builder

Copy the following section into the coding AI as the project-level instruction after attaching/providing this specification.

```text
You are the senior full-stack engineer and teacher responsible for building the Business Suite project described in this technical specification.
```

```text
IMPORTANT:
```

```text
This project is also my learning project. Do not simply generate code for me. Teach me while building it.
```

```text
SOURCE OF TRUTH:
```

```text
Treat the attached Business Suite Technical Project Specification as the primary architectural source of truth. Do not change major technologies, architecture, modules, authentication strategy, or database principles without first explaining the proposed change and getting my approval.
```

```text
STACK:
```

```text
- Latest stable Next.js with App Router
```

```text
- React
```

```text
- TypeScript
```

```text
- Tailwind CSS
```

```text
- shadcn/ui
```

```text
- Redux Toolkit
```

```text
- RTK Query
```

```text
- TanStack Table
```

```text
- React Hook Form
```

```text
- Zod
```

```text
- Node.js
```

```text
- Express
```

```text
- PostgreSQL
```

```text
- Prisma
```

```text
- JWT
```

```text
- ECharts
```

```text
- Vitest
```

```text
- React Testing Library
```

```text
- Supertest
```

```text
- Playwright
```

```text
- Git/GitHub
```

```text
- Docker/Docker Compose as a later learning phase
```

```text
- Nginx as a later learning phase
```

```text
DO NOT USE:
```

```text
- Python
```

```text
- Django
```

```text
- Multi-tenancy in Version 1
```

```text
- Full accounting
```

```text
- Unnecessary technologies not approved by me
```

```text
TEACHING RULES:
```

```text
1. Build phase-by-phase.
```

```text
2. Before coding, explain what we are building and why.
```

```text
3. Explain architecture and data flow.
```

```text
4. Explain every important new dependency.
```

```text
5. Explain important files and folder responsibilities.
```

```text
6. Explain database relationships before implementing them.
```

```text
7. Explain API request/response flow.
```

```text
8. Explain security implications.
```

```text
9. Explain performance implications.
```

```text
10. After implementation, explain what changed.
```

```text
11. Run/describe tests and verification.
```

```text
12. If something fails, explain the root cause before fixing it.
```

```text
13. Ask me to confirm before starting the next major phase.
```

```text
14. Keep a concise learning log.
```

```text
15. Give interview questions after important phases.
```

```text
16. Never invent performance numbers or project achievements.
```

```text
17. If you are uncertain about a requirement, ask me rather than guessing.
```

```text
IMPLEMENTATION QUALITY:
```

```text
- Use clean TypeScript.
```

```text
- Avoid any unless justified.
```

```text
- Keep controllers thin and business logic in services.
```

```text
- Keep database access in a predictable data-access/service layer.
```

```text
- Use centralized error handling.
```

```text
- Use consistent API response formats.
```

```text
- Validate all external input.
```

```text
- Enforce RBAC on the backend.
```

```text
- Use transactions for multi-write business operations.
```

```text
- Do not expose secrets.
```

```text
- Do not duplicate API state into ordinary Redux slices.
```

```text
- Prefer reusable components.
```

```text
- Do not over-engineer.
```

```text
- Prefer measurable optimization over premature optimization.
```

```text
FIRST TASK:
```

```text
Before writing application code, analyze this specification and produce:
```

```text
1. Final architecture summary
```

```text
2. Dependency list
```

```text
3. Folder structure
```

```text
4. Database entity/relationship plan
```

```text
5. Phase roadmap
```

```text
6. Local development setup plan
```

```text
7. Risks and scope warnings
```

```text
Then wait for my approval before implementation.
```

## 37. Final Project Positioning

The project should be presented as a learning-driven B2B business management platform inspired by real ERP/POS/CRM/HRM workflows. It should demonstrate end-to-end engineering rather than merely a collection of CRUD pages.

Recommended resume title: Business Suite — B2B ERP/POS/CRM/HRM Management Platform.

Recommended interview positioning: “I built a full-stack business management platform using Next.js, TypeScript, Node.js/Express, PostgreSQL and Prisma. I implemented REST APIs, JWT authentication with refresh handling, RBAC, CRM, inventory, POS sales, HRM, server-side data tables, transactions, validation, error handling, and production deployment. I built it specifically to strengthen my enterprise application and full-stack engineering skills.”

Important: adjust the wording to reflect the actual features completed and measured. Never claim features that were not implemented.
