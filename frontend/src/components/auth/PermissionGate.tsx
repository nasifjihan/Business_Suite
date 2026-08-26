"use client";
/**
 * PermissionGate (spec §1078) — React component wrapper for front-end UX-only gating.
 * Backend authorize() middleware is the REAL security boundary; these wrappers
 * are just so the user doesn't click buttons that always return 403.
 *
 * Props (choose ONE mode):
 *   - `any: string[]` — show children if user has ANY of these codes (OR)
 *   - `all: string[]` — show children ONLY if user has ALL of these codes (AND)
 *   - `fallback?: ReactNode` — what to render instead if not allowed (default: null)
 *
 * Inverse wrapper is PermissionHide — hides children if user lacks permission
 * (useful for hiding sensitive controls like "Delete Role" next to sensitive data).
 */
import type { ReactNode } from "react";
import { useAppSelector } from "@/store/hooks";

export type PermissionMatch =
  | { any: string[]; all?: never }
  | { all: string[]; any?: never }
  | { one: string };

function hasPermission(codes: string[] | undefined | null, match: PermissionMatch): boolean {
  const safe: string[] = Array.isArray(codes) ? codes : [];
  if (safe.includes("*")) return true;
  if ("one" in match) return safe.includes(match.one);
  if ("any" in match) return !!match.any?.some((c) => safe.includes(c));
  if ("all" in match) return !!match.all?.every((c) => safe.includes(c));
  return false;
}

export function PermissionGate(props: PermissionMatch & { children: ReactNode; fallback?: ReactNode }) {
  const permissions = useAppSelector((s) => s.auth.permissions) ?? [];
  const ok = hasPermission(permissions, props as PermissionMatch);
  if (!ok) return <>{props.fallback ?? null}</>;
  return <>{props.children}</>;
}

export function PermissionHide(props: PermissionMatch & { children: ReactNode }) {
  const permissions = useAppSelector((s) => s.auth.permissions) ?? [];
  const hidden = hasPermission(permissions, props as PermissionMatch);
  if (hidden) return null;
  return <>{props.children}</>;
}

/** Hook form — use when gating logic, not JSX (e.g. redirecting if not allowed on a page) */
export function useHasPermission(match: PermissionMatch): boolean {
  const permissions = useAppSelector((s) => s.auth.permissions) ?? [];
  return hasPermission(permissions, match);
}
