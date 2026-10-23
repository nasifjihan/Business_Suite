/**
 * Tailwind className helper — merges Tailwind classes intelligently
 * Combines clsx (conditional classes) + tailwind-merge (de-duplicates)
 *
 * Usage: cn('p-4', active && 'bg-blue-600', 'p-2')  →  'p-2 bg-blue-600'
 * (tailwind-merge resolved the 'p-4' vs 'p-2' conflict by keeping the later one)
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Resolves a stored asset path — currently only product images, held as
 * `/api/v1/uploads/<uuid>.png` — into a URL the browser can load.
 *
 * The path is deliberately stored relative so one database row stays valid in
 * dev, Docker and production, where the API is reachable from a different
 * origin each time. That means it CANNOT be used as-is in an <img src>: in dev
 * the UI runs on :3000 while the API runs on :5000, so a relative path would
 * resolve against :3000 and 404.
 *
 * NEXT_PUBLIC_API_URL always ends in the `/api/v1` prefix, and uploads are
 * served from that same origin, so the origin is all we need. When the API URL
 * is itself relative the UI is already same-origin with the API (the nginx
 * case) and the stored path is used unchanged.
 */
export function resolveAssetUrl(url: string | null | undefined) {
  if (!url) return undefined;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";
  if (!/^https?:\/\//i.test(apiUrl)) return url;
  return `${new URL(apiUrl).origin}${url}`;
}
