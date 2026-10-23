import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end configuration for Business Suite.
 *
 * There is deliberately no `webServer` block. The suite runs against the real
 * Docker Compose stack (`docker compose up -d --build`), which is the only
 * environment that exercises nginx, the built Next.js image and the compiled
 * Express server together. Pointing Playwright at `next dev` would test a
 * different application than the one we ship.
 *
 * Everything is served from a single origin — nginx publishes port 80, routes
 * `/` to the frontend container, `/api/` to the backend and `/health` to the
 * backend liveness probe. That means the browser and the REST API share an
 * origin, so cookies set by the API are visible to the UI without any CORS or
 * SameSite workarounds.
 *
 * The hostname matters and must be `localhost`, not `127.0.0.1`. The frontend
 * image bakes `NEXT_PUBLIC_API_URL=http://localhost/api/v1` into the browser
 * bundle at build time, so the page has to be served from the same hostname for
 * its API calls to stay same-origin. Loading the UI from `127.0.0.1` instead
 * makes every request cross-origin, and the backend's CORS allowlist
 * (`FRONTEND_URL`) rejects it — the login form then just sits there with a
 * generic error banner and no visible cause.
 *
 * (The `127.0.0.1`-not-`localhost` rule seen elsewhere in this repo is for
 * probes run INSIDE the nginx container, where /etc/hosts maps localhost to ::1.
 * From the host, nginx publishes port 80 on both stacks.)
 */
export const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost";

export default defineConfig({
  testDir: "./specs",
  outputDir: "./test-results",

  // The specs write to one shared PostgreSQL database and asserte on list
  // pages, so they must not interleave. Each spec isolates itself with a
  // unique run suffix instead of relying on parallel isolation.
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,

  timeout: 90_000,
  expect: { timeout: 15_000 },

  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
