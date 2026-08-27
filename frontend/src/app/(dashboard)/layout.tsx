"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  Boxes,
  Briefcase,
  Building2,
  Calendar,
  CalendarCheck,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  HandCoins,
  LayoutDashboard,
  Lock,
  LogOut,
  Package,
  PackageOpen,
  Receipt,
  Settings,
  Shield,
  ShoppingCart,
  Tags,
  Target,
  Undo2,
  UserCircle,
  UserRoundPlus,
  Users,
  UserCog,
  Wallet,
  Warehouse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearCredentials } from "@/store/slices/authSlice";
import { useLogoutMutation } from "@/lib/api/authEndpoints";
import {
  PermissionGate,
  useHasPermission,
} from "@/components/auth/PermissionGate";
import { GlobalToast } from "@/components/feedback/Toast";
// Side-effect: register RTK endpoints for all business modules (injectEndpoints file-level side-effect must run)
import "@/lib/api/dashboardEndpoints";
import "@/lib/api/crmEndpoints";
import "@/lib/api/inventoryEndpoints";
import "@/lib/api/salesEndpoints";
import "@/lib/api/hrmEndpoints";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  /** Match ALL these permission codes, OR use permissionCode string for single. */
  requires?: { all?: string[]; any?: string[] } | string;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  {
    href: "/dashboard/health-test",
    label: "Connectivity Test",
    icon: Activity,
    badge: "Phase 1",
  },
];

type SubNavItem = NavItem & {};

const SALES_SUBNAV: SubNavItem[] = [
  {
    href: "/sales/pos",
    label: "Quick Sale (POS)",
    icon: ShoppingCart,
    requires: { any: ["sales.orders.checkout", "sales.orders.create"] },
  },
  {
    href: "/sales/orders",
    label: "Orders",
    icon: Receipt,
    requires: { any: ["sales.orders.read"] },
  },
  {
    href: "/sales/payments",
    label: "Payments",
    icon: CreditCard,
    requires: { any: ["sales.payments.read"] },
  },
  {
    href: "/sales/refunds",
    label: "Refunds",
    icon: Undo2,
    requires: { any: ["sales.refunds.read"] },
  },
  {
    href: "/sales/reports",
    label: "Daily Report",
    icon: BarChart3,
    requires: { any: ["sales.reports.read"] },
  },
  {
    href: "/sales/credits",
    label: "Customer Credits",
    icon: Wallet,
    requires: { any: ["sales.credits.read"] },
  },
];

const HRM_SUBNAV: SubNavItem[] = [
  {
    href: "/hrm",
    label: "Overview",
    icon: LayoutDashboard,
    requires: {
      any: [
        "hrm.departments.read",
        "hrm.employees.read",
        "hrm.attendance.read",
        "hrm.leave.read",
      ],
    },
  },
  {
    href: "/hrm/departments",
    label: "Departments",
    icon: Building2,
    requires: { any: ["hrm.departments.read"] },
  },
  {
    href: "/hrm/designations",
    label: "Designations",
    icon: Briefcase,
    requires: { any: ["hrm.designations.read"] },
  },
  {
    href: "/hrm/employees",
    label: "Employees",
    icon: Users,
    requires: { any: ["hrm.employees.read"] },
  },
  {
    href: "/hrm/attendance",
    label: "Attendance",
    icon: Clock,
    requires: { any: ["hrm.attendance.read", "hrm.attendance.self_check"] },
  },
  {
    href: "/hrm/leaves",
    label: "Leave Requests",
    icon: CalendarRange,
    requires: { any: ["hrm.leave.read", "hrm.leave.create"] },
  },
];

const CRM_SUBNAV: SubNavItem[] = [
  {
    href: "/crm",
    label: "Overview",
    icon: LayoutDashboard,
    requires: { any: ["customers.read", "leads.read", "crm.customers.read"] },
  },
  {
    href: "/crm/customers",
    label: "Customers",
    icon: Users,
    requires: { any: ["customers.read", "crm.customers.read"] },
  },
  {
    href: "/crm/leads",
    label: "Leads",
    icon: Target,
    requires: { any: ["leads.read", "crm.leads.read"] },
  },
  {
    href: "/crm/opportunities",
    label: "Deals",
    icon: HandCoins,
    requires: { any: ["crm.opportunities.read"] },
  },
  {
    href: "/crm/contracts",
    label: "Contracts",
    icon: FileText,
    requires: { any: ["crm.contracts.read"] },
  },
];

const INVENTORY_SUBNAV: SubNavItem[] = [
  {
    href: "/inventory",
    label: "Overview",
    icon: Package,
    requires: {
      any: [
        "inventory.categories.read",
        "inventory.products.read",
        "inventory.warehouses.read",
        "inventory.stock.read",
        "inventory.movements.read",
      ],
    },
  },
  {
    href: "/inventory/categories",
    label: "Categories",
    icon: Tags,
    requires: { any: ["inventory.categories.read"] },
  },
  {
    href: "/inventory/products",
    label: "Products",
    icon: Boxes,
    requires: { any: ["inventory.products.read"] },
  },
  {
    href: "/inventory/warehouses",
    label: "Warehouses",
    icon: Warehouse,
    requires: { any: ["inventory.warehouses.read"] },
  },
  {
    href: "/inventory/stock",
    label: "Stock",
    icon: PackageOpen,
    requires: { any: ["inventory.stock.read"] },
  },
  {
    href: "/inventory/movements",
    label: "Movements",
    icon: ArrowLeftRight,
    requires: { any: ["inventory.movements.read"] },
  },
];

const ADMIN_SUBNAV: SubNavItem[] = [
  {
    href: "/administration/users",
    label: "Users",
    icon: Users,
    requires: "users.read",
  },
  {
    href: "/administration/roles",
    label: "Roles & Permissions",
    icon: Shield,
    requires: "roles.read",
  },
  {
    href: "/administration/audit-log",
    label: "Audit Log",
    icon: FileText,
    requires: "audit.read",
  },
];

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Business Suite";

export default function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [collapsed, setCollapsed] = useState(false);
  const [adminOpen, setAdminOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const dispatch = useAppDispatch();
  const [logoutTrigger] = useLogoutMutation();
  const user = useAppSelector((s) => s.auth.user);

  const hasAnyAdmin = useHasPermission({
    any: ["users.read", "roles.read", "audit.read"],
  });
  const hasAnySales = useHasPermission({
    any: [
      "sales.orders.read",
      "sales.orders.create",
      "sales.orders.checkout",
      "sales.payments.read",
      "sales.refunds.read",
      "sales.reports.read",
      "sales.credits.read",
    ],
  });
  const [salesOpen, setSalesOpen] = useState(true);
  const hasAnyCRM = useHasPermission({
    any: [
      "customers.read",
      "crm.customers.read",
      "leads.read",
      "crm.leads.read",
    ],
  });
  const [crmOpen, setCrmOpen] = useState(true);
  const hasAnyInventory = useHasPermission({
    any: [
      "inventory.categories.read",
      "inventory.products.read",
      "inventory.warehouses.read",
      "inventory.stock.read",
      "inventory.movements.read",
    ],
  });
  const [invOpen, setInvOpen] = useState(true);
  const hasAnyHRM = useHasPermission({
    any: [
      "hrm.departments.read",
      "hrm.designations.read",
      "hrm.employees.read",
      "hrm.attendance.read",
      "hrm.attendance.self_check",
      "hrm.leave.read",
      "hrm.leave.create",
    ],
  });
  const [hrmOpen, setHrmOpen] = useState(true);

  const handleLogout = async () => {
    try {
      await logoutTrigger().unwrap();
    } catch {
    } finally {
      dispatch(clearCredentials());
      router.replace("/login");
    }
  };

  const initials = user
    ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() ||
      "U"
    : "G";
  const fullName = user
    ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email
    : "Guest";

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Sidebar */}
      <aside
        className={cn(
          "border-r border-border bg-card flex flex-col transition-[width] duration-200 ease-out",
          collapsed ? "w-[72px]" : "w-60",
        )}
      >
        <div className="h-16 flex items-center border-b border-border px-4">
          <Building2 className="w-6 h-6 shrink-0 text-primary" />
          {!collapsed && (
            <span className="ml-2 font-semibold tracking-tight truncate">
              {appName}
            </span>
          )}
        </div>

        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {NAV.map((it) => {
            let permProps:
              | { one: string }
              | { any: string[] }
              | { all: string[] };
            if (!it.requires) {
              permProps = { one: "*" };
            } else if (typeof it.requires === "string") {
              permProps = { one: it.requires };
            } else {
              permProps = it.requires as { any: string[] } | { all: string[] };
            }
            return (
              <PermissionGate key={it.href} {...permProps}>
                <Link
                  href={it.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                    pathname === it.href &&
                      "bg-slate-100/60 dark:bg-slate-800/60 text-foreground font-medium",
                  )}
                >
                  <it.icon
                    className={cn(
                      "w-5 h-5 shrink-0 text-slate-500 group-hover:text-primary",
                    )}
                  />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate">{it.label}</span>
                      {it.badge && (
                        <span className="text-[10px] rounded-full bg-primary/10 text-primary px-1.5 py-0.5 border border-primary/20">
                          {it.badge}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              </PermissionGate>
            );
          })}

          {/* Sales & POS drawer — TOP-MOST business module (cashiers open app → sell = first click) */}
          {hasAnySales && (
            <>
              {!collapsed ? (
                <button
                  type="button"
                  className="mt-2 w-full group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => setSalesOpen((v) => !v)}
                >
                  <ShoppingCart className="w-5 h-5 shrink-0 text-slate-500 group-hover:text-primary" />
                  <span className="flex-1 truncate text-left">Sales & POS</span>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 text-slate-400 transition-transform",
                      salesOpen && "rotate-180",
                    )}
                  />
                </button>
              ) : (
                <div className="mt-2 h-6 flex items-center justify-center text-[10px] text-slate-400">
                  Sls
                </div>
              )}
              {salesOpen &&
                SALES_SUBNAV.map((sub) => {
                  let permProps:
                    | { one: string }
                    | { any: string[] }
                    | { all: string[] };
                  if (typeof sub.requires === "string") {
                    permProps = { one: sub.requires };
                  } else if (sub.requires) {
                    permProps = sub.requires as
                      | { any: string[] }
                      | { all: string[] };
                  } else {
                    permProps = { one: "*" };
                  }
                  return (
                    <PermissionGate key={sub.href} {...permProps}>
                      <Link
                        href={sub.href}
                        className={cn(
                          "group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors",
                          collapsed ? "justify-center" : "pl-9",
                          pathname === sub.href &&
                            "bg-slate-100/60 dark:bg-slate-800/60 text-foreground font-medium",
                        )}
                      >
                        <sub.icon
                          className={cn(
                            "w-4 h-4 shrink-0 text-slate-500 group-hover:text-primary",
                          )}
                        />
                        {!collapsed && (
                          <span className="flex-1 truncate">{sub.label}</span>
                        )}
                      </Link>
                    </PermissionGate>
                  );
                })}
            </>
          )}

          {/* Inventory drawer — shown only if user has any Inventory sub-permission */}
          {hasAnyInventory && (
            <>
              {!collapsed ? (
                <button
                  type="button"
                  className="mt-2 w-full group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => setInvOpen((v) => !v)}
                >
                  <Package className="w-5 h-5 shrink-0 text-slate-500 group-hover:text-primary" />
                  <span className="flex-1 truncate text-left">Inventory</span>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 text-slate-400 transition-transform",
                      invOpen && "rotate-180",
                    )}
                  />
                </button>
              ) : (
                <div className="mt-2 h-6 flex items-center justify-center text-[10px] text-slate-400">
                  Inv
                </div>
              )}
              {invOpen &&
                INVENTORY_SUBNAV.map((sub) => {
                  let permProps:
                    | { one: string }
                    | { any: string[] }
                    | { all: string[] };
                  if (typeof sub.requires === "string") {
                    permProps = { one: sub.requires };
                  } else if (sub.requires) {
                    permProps = sub.requires as
                      | { any: string[] }
                      | { all: string[] };
                  } else {
                    permProps = { one: "*" };
                  }
                  return (
                    <PermissionGate key={sub.href} {...permProps}>
                      <Link
                        href={sub.href}
                        className={cn(
                          "group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors",
                          collapsed ? "justify-center" : "pl-9",
                          pathname === sub.href &&
                            "bg-slate-100/60 dark:bg-slate-800/60 text-foreground font-medium",
                        )}
                      >
                        <sub.icon
                          className={cn(
                            "w-4 h-4 shrink-0 text-slate-500 group-hover:text-primary",
                          )}
                        />
                        {!collapsed && (
                          <span className="flex-1 truncate">{sub.label}</span>
                        )}
                      </Link>
                    </PermissionGate>
                  );
                })}
            </>
          )}

          {/* CRM drawer — shown only if user has any CRM sub-permission */}
          {hasAnyCRM && (
            <>
              {!collapsed ? (
                <button
                  type="button"
                  className="mt-2 w-full group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => setCrmOpen((v) => !v)}
                >
                  <Users className="w-5 h-5 shrink-0 text-slate-500 group-hover:text-primary" />
                  <span className="flex-1 truncate text-left">CRM</span>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 text-slate-400 transition-transform",
                      crmOpen && "rotate-180",
                    )}
                  />
                </button>
              ) : (
                <div className="mt-2 h-6 flex items-center justify-center text-[10px] text-slate-400">
                  CRM
                </div>
              )}
              {crmOpen &&
                CRM_SUBNAV.map((sub) => {
                  let permProps:
                    | { one: string }
                    | { any: string[] }
                    | { all: string[] };
                  if (typeof sub.requires === "string") {
                    permProps = { one: sub.requires };
                  } else if (sub.requires) {
                    permProps = sub.requires as
                      | { any: string[] }
                      | { all: string[] };
                  } else {
                    permProps = { one: "*" };
                  }
                  return (
                    <PermissionGate key={sub.href} {...permProps}>
                      <Link
                        href={sub.href}
                        className={cn(
                          "group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors",
                          collapsed ? "justify-center" : "pl-9",
                          pathname === sub.href &&
                            "bg-slate-100/60 dark:bg-slate-800/60 text-foreground font-medium",
                        )}
                      >
                        <sub.icon
                          className={cn(
                            "w-4 h-4 shrink-0 text-slate-500 group-hover:text-primary",
                          )}
                        />
                        {!collapsed && (
                          <span className="flex-1 truncate">{sub.label}</span>
                        )}
                      </Link>
                    </PermissionGate>
                  );
                })}
            </>
          )}

          {/* HRM drawer — shown only if user has any HRM sub-permission */}
          {hasAnyHRM && (
            <>
              {!collapsed ? (
                <button
                  type="button"
                  className="mt-2 w-full group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => setHrmOpen((v) => !v)}
                >
                  <UserCog className="w-5 h-5 shrink-0 text-slate-500 group-hover:text-primary" />
                  <span className="flex-1 truncate text-left">HR & Payroll</span>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 text-slate-400 transition-transform",
                      hrmOpen && "rotate-180",
                    )}
                  />
                </button>
              ) : (
                <div className="mt-2 h-6 flex items-center justify-center text-[10px] text-slate-400">
                  HRM
                </div>
              )}
              {hrmOpen &&
                HRM_SUBNAV.map((sub) => {
                  let permProps:
                    | { one: string }
                    | { any: string[] }
                    | { all: string[] };
                  if (typeof sub.requires === "string") {
                    permProps = { one: sub.requires };
                  } else if (sub.requires) {
                    permProps = sub.requires as
                      | { any: string[] }
                      | { all: string[] };
                  } else {
                    permProps = { one: "*" };
                  }
                  return (
                    <PermissionGate key={sub.href} {...permProps}>
                      <Link
                        href={sub.href}
                        className={cn(
                          "group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors",
                          collapsed ? "justify-center" : "pl-9",
                          pathname === sub.href &&
                            "bg-slate-100/60 dark:bg-slate-800/60 text-foreground font-medium",
                        )}
                      >
                        <sub.icon
                          className={cn(
                            "w-4 h-4 shrink-0 text-slate-500 group-hover:text-primary",
                          )}
                        />
                        {!collapsed && (
                          <span className="flex-1 truncate">{sub.label}</span>
                        )}
                      </Link>
                    </PermissionGate>
                  );
                })}
            </>
          )}

          {/* Administration drawer — shown only if user has any of users/roles/audit permissions */}
          {hasAnyAdmin && (
            <>
              {!collapsed ? (
                <button
                  type="button"
                  className="mt-4 w-full group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => setAdminOpen((v) => !v)}
                >
                  <Settings className="w-5 h-5 shrink-0 text-slate-500 group-hover:text-primary" />
                  <span className="flex-1 truncate text-left">
                    Administration
                  </span>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 text-slate-400 transition-transform",
                      adminOpen && "rotate-180",
                    )}
                  />
                </button>
              ) : (
                <div className="mt-4 h-6 flex items-center justify-center text-[10px] text-slate-400">
                  Adm
                </div>
              )}
              {adminOpen &&
                ADMIN_SUBNAV.map((sub) => {
                  let permProps:
                    | { one: string }
                    | { any: string[] }
                    | { all: string[] };
                  if (typeof sub.requires === "string") {
                    permProps = { one: sub.requires };
                  } else if (sub.requires) {
                    permProps = sub.requires as
                      | { any: string[] }
                      | { all: string[] };
                  } else {
                    permProps = { one: "*" };
                  }
                  return (
                    <PermissionGate key={sub.href} {...permProps}>
                      <Link
                        href={sub.href}
                        className={cn(
                          "group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors",
                          collapsed ? "justify-center" : "pl-9",
                          pathname === sub.href &&
                            "bg-slate-100/60 dark:bg-slate-800/60 text-foreground font-medium",
                        )}
                      >
                        <sub.icon
                          className={cn(
                            "w-4 h-4 shrink-0 text-slate-500 group-hover:text-primary",
                          )}
                        />
                        {!collapsed && (
                          <span className="flex-1 truncate">{sub.label}</span>
                        )}
                      </Link>
                    </PermissionGate>
                  );
                })}
            </>
          )}
        </nav>

        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 w-full justify-center"
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" /> Collapse
              </>
            )}
          </Button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur px-6">
          <div className="flex items-center gap-2 text-sm text-muted">
            <LayoutDashboard className="w-4 h-4" />
            <span className="font-medium text-foreground">Dashboard</span>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
              className="flex items-center gap-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 pr-2 pl-1 py-1 transition-colors"
            >
              <div className="rounded-full bg-primary/10 text-primary h-8 w-8 flex items-center justify-center font-semibold text-xs border border-primary/20">
                {initials}
              </div>
              <span className="hidden md:inline text-sm">{fullName}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 z-30 rounded-xl border border-border bg-popover shadow-lg overflow-hidden text-sm">
                <div className="px-4 py-3 border-b border-border">
                  <p className="font-medium text-foreground">{fullName}</p>
                  {user && (
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </p>
                  )}
                </div>
                <Link
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  <UserCircle className="w-4 h-4" /> My Profile
                </Link>
                <PermissionGate one="users.update">
                  <Link
                    href="/administration/users"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    <Lock className="w-4 h-4" /> Administration
                  </Link>
                </PermissionGate>
                <div className="border-t border-border">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 hover:bg-red-50 dark:hover:bg-red-950/30 text-rose-600 dark:text-rose-400"
                  >
                    <LogOut className="w-4 h-4" /> Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>
        <main className="flex-1 p-6 overflow-x-auto">{children}</main>
      </div>
      <GlobalToast />
    </div>
  );
}
