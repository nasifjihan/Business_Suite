import { expect, request, type Page } from "@playwright/test";
import { BASE_URL } from "../playwright.config";

/**
 * Credentials for the dedicated E2E account created by
 * `backend/prisma/seed_e2e.ts`. Overridable so CI can rotate them without
 * touching the specs.
 */
export const E2E_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "e2e@example.com";
export const E2E_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "E2eAdmin@123";

/** nginx routes `/api/` to the backend on the same origin as the UI. */
export const API_PREFIX = "/api/v1";

/**
 * A unique token per run. The specs write real rows into the shared dev
 * database, so every created name/reason carries this suffix and the run
 * cleans up after itself — otherwise repeated runs pile up junk.
 */
export function runId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Signs in through the real UI.
 *
 * `POST /auth/login` sits behind `authStrictLimiter` (10 requests / 15 minutes
 * / IP) and docker-compose runs the backend with `NODE_ENV=production`, so the
 * limit is live during the suite. Every spec therefore logs in exactly once
 * and never retries.
 */
export async function loginViaUi(page: Page): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(E2E_EMAIL);
  await page.locator("#password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
}

/**
 * Mints an access token from the browser context's HTTP-only refresh cookie.
 *
 * The access token only ever lives in Redux memory, so it cannot be read back
 * out of storage after the UI login. `POST /auth/refresh` is deliberately
 * outside `authStrictLimiter`, so deriving the token this way costs no login
 * budget.
 */
export async function readAccessToken(page: Page): Promise<string> {
  const res = await page.request.post(`${API_PREFIX}/auth/refresh`);
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // fall through to the explicit failure below
  }
  const token = (body as { data?: { accessToken?: string } } | null)?.data?.accessToken;
  if (!token) {
    throw new Error(
      `Could not read an access token (HTTP ${res.status()}): ${JSON.stringify(body)}`
    );
  }
  return token;
}

export type ApiResult = { status: number; body: any };

export type Api = {
  get(path: string, params?: Record<string, string>): Promise<ApiResult>;
  post(path: string, data?: unknown): Promise<ApiResult>;
  patch(path: string, data?: unknown): Promise<ApiResult>;
  del(path: string): Promise<ApiResult>;
  dispose(): Promise<void>;
};

/**
 * A REST client usable from `afterAll`, where no `Page` exists.
 *
 * Cleanup goes through the API rather than the UI so a spec that failed
 * half-way can still leave the database tidy, and so teardown does not break
 * every time a modal is restyled.
 */
export async function apiFor(token: string): Promise<Api> {
  const ctx = await request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });

  async function call(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    options: { params?: Record<string, string>; data?: unknown } = {}
  ): Promise<ApiResult> {
    const res = await ctx.fetch(`${API_PREFIX}${path}`, {
      method,
      params: options.params,
      data: options.data,
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // 204 No Content and friends
    }
    return { status: res.status(), body };
  }

  return {
    get: (path, params) => call("GET", path, { params }),
    post: (path, data) => call("POST", path, { data }),
    patch: (path, data) => call("PATCH", path, { data }),
    del: (path) => call("DELETE", path),
    dispose: () => ctx.dispose(),
  };
}
