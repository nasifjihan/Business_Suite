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
 * `127.0.0.1` is used instead of `localhost` on purpose: on Windows,
 * `localhost` can resolve to `::1` first, and the Docker port publish binds
 * IPv4 only.
 */
export const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1";

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
