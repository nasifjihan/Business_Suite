process.env.NODE_ENV = "test";
process.env.DISABLE_RATE_LIMIT = "true";

import { beforeAll, beforeEach, afterEach, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { applyBcryptMock } from "./mocks/bcrypt.mock";
import { resetDatabase } from "./testUtils";

applyBcryptMock();

/**
 * SAFETY GUARD — do not remove.
 *
 * afterEach() below calls resetDatabase(), which deleteMany()s ~25 tables.
 * Pointed at the wrong database that silently destroys real data. This
 * refuses to run unless the target database name contains "test".
 *
 * vitest.config.ts is what selects the database (TEST_DATABASE_URL, or
 * "<database>_test" derived from DATABASE_URL). This is the second line of
 * defence in case that is ever bypassed or misconfigured.
 */
(() => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Tests aborted: DATABASE_URL is not set.");
  const dbName = (() => {
    try {
      return new URL(url).pathname.slice(1);
    } catch {
      return "";
    }
  })();
  if (!/test/i.test(dbName)) {
    throw new Error(
      `Tests aborted: refusing to run against database "${dbName}", whose name ` +
        `does not contain "test". resetDatabase() would DELETE every row in it. ` +
        `Set TEST_DATABASE_URL to a dedicated test database.`
    );
  }
})();


vi.mock("express-rate-limit", async () => {
  const actual =
    await vi.importActual<typeof import("express-rate-limit")>(
      "express-rate-limit",
    );
  return {
    default: (...args: any[]) => {
      const opts = args[0] || {};
      if (
        process.env.DISABLE_RATE_LIMIT !== "false" &&
        !(globalThis as any).__FORCE_RATE_LIMIT_TEST__
      ) {
        opts.max = 9999999;
        opts.windowMs = 1;
      }
      return actual.default(opts);
    },
    rateLimit: (...args: any[]) => {
      const opts = args[0] || {};
      if (
        process.env.DISABLE_RATE_LIMIT !== "false" &&
        !(globalThis as any).__FORCE_RATE_LIMIT_TEST__
      ) {
        opts.max = 9999999;
        opts.windowMs = 1;
      }
      return (actual as any).rateLimit(opts);
    },
  };
});

beforeAll(async () => {
  await prisma.$connect();
});

afterEach(async () => {
  await resetDatabase(prisma);
  vi.clearAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});
