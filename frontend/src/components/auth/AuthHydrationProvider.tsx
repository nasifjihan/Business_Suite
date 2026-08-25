/**
 * AuthHydrationProvider: on first client-side app mount, call GET /auth/me
 * with credentials:'include'. This sends the HTTP-only refresh cookie.
 *
 * Expected results:
 *   200 → Backend: cookie valid → backend /me needs auth header but /me endpoint
 *          is AUTHENTICATED — actually /me expects Bearer access token, doesn't
 *          accept refresh cookie. That means page-reload hydration without access
 *          token would return 401.
 *
 * CORRECTED design:
 *   - hydrateFirstMount() calls `/auth/refresh` (which DOES use refresh cookie, no Bearer needed).
 *   - If refresh succeeds → new accessToken in Redux + getUser data via /me call.
 *   - If refresh fails → user state stays null (not logged in).
 */
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setHydratedUser, setCredentials, clearCredentials } from "@/store/slices/authSlice";
import { useMeQuery, useRefreshMutation } from "@/lib/api/authEndpoints";

const PUBLIC_PATHS = new Set<string>([
  "/", "/features", "/pricing", "/contact",
  "/login", "/forgot-password", "/reset-password",
]);

const DASHBOARD_PATHS_REQUIRING_AUTH = new Set<string>([
  "/dashboard", "/crm", "/inventory", "/pos", "/sales", "/hrm", "/admin", "/change-password",
]);

function startsWithAny(path: string, prefixes: Set<string>): boolean {
  if (prefixes.has(path)) return true;
  for (const p of prefixes) if (path.startsWith(p + "/")) return true;
  return false;
}

function useHydrateAuth() {
  const dispatch = useAppDispatch();
  const hydrating = useAppSelector((s) => s.auth.hydrating);
  const pathname = usePathname();
  const router = useRouter();
  const [meTrigger, setMeTrigger] = useState<boolean>(false);

  // 1. First, run refresh (uses refresh cookie, no Bearer needed):
  const [refreshTrigger, refreshState] = useRefreshMutation();

  const meRes = useMeQuery(undefined, { skip: !meTrigger });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Attempt refresh. Returns {ok:true, new access token} OR error.
        const refreshOut = await refreshTrigger();
        if (cancelled) return;
        if ("data" in refreshOut && refreshOut.data?.success) {
          dispatch(
            setCredentials({
              accessToken: refreshOut.data.data.accessToken,
              user: {
                id: "",
                email: "",
                firstName: "",
                lastName: "",
                fullName: "",
                avatarUrl: null,
                role: "VIEWER",
                roleId: null,
                status: "ACTIVE",
                mustChangePassword: false,
                createdAt: "",
                lastLoginAt: null,
              },
            })
          );
          // Now trigger me query to fill user profile.
          setMeTrigger(true);
        } else {
          // Refresh failed = user NOT logged in. Finalize state.
          dispatch(setHydratedUser(null));
        }
      } catch (e) {
        dispatch(setHydratedUser(null));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Once /me returns with user data, populate it.
  useEffect(() => {
    if (meRes.currentData?.success && meRes.currentData.data) {
      const u = meRes.currentData.data;
      dispatch(
        setHydratedUser({
          ...u,
          fullName: `${u.firstName} ${u.lastName}`.trim(),
        })
      );
    }
  }, [dispatch, meRes.currentData]);

  return { hydrating };
}

export default function AuthHydrationProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const hydrating = useAppSelector((s) => s.auth.hydrating);
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const forceChangePassword = useAppSelector((s) => s.auth.forceChangePassword);
  const pathname = usePathname();
  const router = useRouter();
  const [meTrigger, setMeTrigger] = useState<boolean>(false);
  const [refreshTrigger, refreshState] = useRefreshMutation();
  const meRes = useMeQuery(undefined, { skip: !meTrigger });

  // ─────────────────────────────────────────────────────────────────────
  // Phase 2: Auth hydrate runs ONCE on first client mount.
  useEffect(() => {
    // Skip silent refresh on public auth pages — the user hasn't logged in yet.
    // This avoids spurious 401s (and noisy backend logs) when loading
    // /login, /forgot-password, or /reset-password with no valid cookie.
    const onPublicAuth =
      pathname === "/login" ||
      pathname === "/forgot-password" ||
      pathname === "/reset-password";
    if (onPublicAuth) {
      dispatch(setHydratedUser(null));
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const refreshOut = await refreshTrigger();
        if (cancelled) return;
        if ("data" in refreshOut && refreshOut.data?.success) {
          const accessToken = refreshOut.data.data.accessToken;
          // Temporary minimal user object until /me returns.
          dispatch(setCredentials({
            accessToken,
            user: {
              id: "",
              email: "",
              firstName: "",
              lastName: "",
              fullName: "",
              avatarUrl: null,
              role: "VIEWER",
              roleId: null,
              status: "ACTIVE",
              mustChangePassword: false,
              createdAt: "",
              lastLoginAt: null,
            },
          }));
          setMeTrigger(true);
        } else {
          dispatch(setHydratedUser(null));
        }
      } catch {
        dispatch(setHydratedUser(null));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When /me returns, populate real user object.
  useEffect(() => {
    if (meRes.currentData?.success && meRes.currentData.data) {
      const u = meRes.currentData.data;
      dispatch(
        setHydratedUser({
          ...u,
          fullName: `${u.firstName} ${u.lastName}`.trim(),
        })
      );
    } else if (
      meTrigger &&
      meRes.isError &&
      (meRes.error as { status?: unknown }).status === 401
    ) {
      // me returned 401 despite refresh ok → clear everything
      dispatch(clearCredentials());
    }
  }, [dispatch, meRes.currentData, meRes.isError, meRes.error, meTrigger]);

  // ─────────────────────────────────────────────────────────────────────
  // Auth guard redirects (run after hydration, NOT while hydrating)
  useEffect(() => {
    if (hydrating) return;
    const onDashboardPath = startsWithAny(pathname, DASHBOARD_PATHS_REQUIRING_AUTH);
    const onPublicAuthPage = pathname === "/login" || pathname === "/forgot-password";

    if (onDashboardPath && !isAuthenticated) {
      router.replace("/login?next=" + encodeURIComponent(pathname));
      return;
    }
    if (isAuthenticated && onPublicAuthPage) {
      router.replace("/dashboard");
      return;
    }
    if (isAuthenticated && forceChangePassword && pathname !== "/change-password") {
      router.replace("/change-password");
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrating, isAuthenticated, pathname, forceChangePassword]);

  // While hydrating on dashboard-like paths, render a clean skeleton spinner.
  // Public marketing paths should render immediately — the header doesn't need auth.
  const isPublic = startsWithAny(pathname, PUBLIC_PATHS);
  const showSkeleton = hydrating && !isPublic && startsWithAny(pathname, DASHBOARD_PATHS_REQUIRING_AUTH);

  void refreshState; // silence unused

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
