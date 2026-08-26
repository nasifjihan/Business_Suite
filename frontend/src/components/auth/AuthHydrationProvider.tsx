/**
 * AuthHydrationProvider — final race-free version.
 *
 * On first client mount: call refreshAccessToken(store), the SHARED mutex-locked
 * helper exported from baseQueryWithReauth.ts. Because the helper shares the SAME
 * module-level Mutex singleton that RTK's auto-refresh middleware uses, there is
 * ZERO possibility of two parallel POST /auth/refresh calls within the same JS
 * tab context. Backend also tolerates cross-tab races via a 5s reuse-detection
 * tolerance window. The two combined eliminate the "this refresh token was used
 * twice" reuse detection → family-ban loop permanently.
 *
 * refreshAccessToken(store):
 *   - Commits setCredentials({accessToken, user, fullName enriched, permissions})
 *     into the SAME store React is rendering from BEFORE returning.
 *   - No second /me query required. No batched state race possible.
 *   - Response envelope already contains user + permissions from backend (added
 *     in LoginResponseDto / RefreshResponseDto Phase 6 fixes).
 */
"use client";

import { useEffect, type ReactNode } from "react";
import { useStore } from "react-redux";
import { usePathname, useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setHydratedUser } from "@/store/slices/authSlice";
import { refreshAccessToken } from "@/lib/api/baseQueryWithReauth";
import type { RootState } from "@/store/store";

const DASHBOARD_PATHS_REQUIRING_AUTH = new Set<string>([
  "/dashboard",
  "/crm",
  "/inventory",
  "/pos",
  "/sales",
  "/hrm",
  "/admin",
  "/change-password",
]);

function startsWithAny(path: string, prefixes: Set<string>): boolean {
  if (prefixes.has(path)) return true;
  for (const p of prefixes) if (path.startsWith(p + "/")) return true;
  return false;
}

export default function AuthHydrationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const store = useStore<RootState>();
  const dispatch = useAppDispatch();
  const hydrating = useAppSelector((s) => s.auth.hydrating);
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const forceChangePassword = useAppSelector(
    (s) => s.auth.forceChangePassword
  );
  const pathname = usePathname();
  const router = useRouter();

  // Hydrate once client-side. Shared mutex prevents concurrent refresh with
  // any in-flight 401-triggered refresh from RTK queries that fire in parallel
  // during layout mount (CRM overview cards, inventory stats, etc.).
  useEffect(() => {
    const onPublicAuth =
      pathname === "/login" ||
      pathname === "/forgot-password" ||
      pathname === "/reset-password";
    if (onPublicAuth) {
      dispatch(setHydratedUser({ user: null }));
      return;
    }

    let cancelled = false;
    (async () => {
      const payload = await refreshAccessToken(store);
      if (cancelled) return;
      if (payload) {
        // refreshAccessToken already committed setCredentials(...).
        // Signal hydration finished so guards/skeletons turn off.
        dispatch(
          setHydratedUser({
            user: payload.user,
            permissions: payload.permissions,
          })
        );
      } else {
        dispatch(setHydratedUser({ user: null }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route guards — only after hydration finished (hydrating=false).
  useEffect(() => {
    if (hydrating) return;
    const onDashboardPath = startsWithAny(
      pathname,
      DASHBOARD_PATHS_REQUIRING_AUTH
    );
    const onPublicAuthPage =
      pathname === "/login" || pathname === "/forgot-password";

    if (onDashboardPath && !isAuthenticated) {
      router.replace("/login?next=" + encodeURIComponent(pathname));
      return;
    }
    if (isAuthenticated && onPublicAuthPage) {
      router.replace("/dashboard");
      return;
    }
    if (
      isAuthenticated &&
      forceChangePassword &&
      pathname !== "/change-password"
    ) {
      router.replace("/change-password");
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrating, isAuthenticated, pathname, forceChangePassword]);

  const showSkeleton =
    hydrating && startsWithAny(pathname, DASHBOARD_PATHS_REQUIRING_AUTH);

  if (showSkeleton) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
          <p className="text-sm">Restoring your session…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
