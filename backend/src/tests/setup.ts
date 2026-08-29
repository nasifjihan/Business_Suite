process.env.NODE_ENV = "test";
process.env.DISABLE_RATE_LIMIT = "true";

import { beforeAll, beforeEach, afterEach, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { applyBcryptMock } from "./mocks/bcrypt.mock";
import { resetDatabase } from "./testUtils";

applyBcryptMock();

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
