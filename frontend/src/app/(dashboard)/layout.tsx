"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Activity,
  Boxes,
  Building2,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Settings,
  ShoppingCart,
  Users,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearCredentials } from "@/store/slices/authSlice";
import { useLogoutMutation } from "@/lib/api/authEndpoints";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/health-test", label: "Connectivity Test", icon: Activity, badge: "Phase 1" },
  { href: "/crm", label: "CRM", icon: Users },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/pos", label: "POS", icon: ShoppingCart },
  { href: "/sales", label: "Sales", icon: ShoppingCart },
  { href: "/hrm", label: "HRM", icon: UserCog },
  { href: "/admin", label: "Admin", icon: Settings },
];

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Business Suite";

export default function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [logoutTrigger] = useLogoutMutation();
  const user = useAppSelector((s) => s.auth.user);

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
    ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "U"
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
          collapsed ? "w-[72px]" : "w-60"
        )}
      >
        <div className="h-16 flex items-center border-b border-border px-4">
          <Building2 className="w-6 h-6 shrink-0 text-primary" />
          {!collapsed && (
            <span className="ml-2 font-semibold tracking-tight truncate">{appName}</span>
          )}
        </div>
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {NAV.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              )}
            >
              <it.icon className={cn("w-5 h-5 shrink-0 text-slate-500 group-hover:text-primary")} />
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
          ))}
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
              <><ChevronLeft className="w-4 h-4" /> Collapse</>
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
          <div className="flex items-center gap-2 text-sm text-muted">
            <div className="rounded-full bg-primary/10 text-primary h-8 w-8 flex items-center justify-center font-semibold text-xs border border-primary/20">
              {initials}
            </div>
            <span className="hidden md:inline">{fullName}</span>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-x-auto">{children}</main>
      </div>
    </div>
  );
}
