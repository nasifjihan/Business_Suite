/**
 * Prisma 7 Singleton Client with pg driver adapter
 * ------------------------------------------------------------------
 * Prisma 7.x REMOVED the built-in native database drivers.
 * All connections now require a driver adapter. We use @prisma/adapter-pg
 * which wraps the standard 'pg' npm package (node-postgres).
 *
 * Usage in ALL code: import { prisma } from "@/lib/prisma"
 * NEVER instantiate new PrismaClient() anywhere else.
 *
 * The globalThis cache pattern prevents connection storms during
 * ts-node-dev hot-reload (which re-runs module-level code on every save,
 * potentially creating hundreds of PrismaClients without this).
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Create backend/.env with a valid PostgreSQL URL.");
}

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

type PrismaClientSingleton = PrismaClient<{ adapter: typeof adapter }>;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClientSingleton;
};

function createPrismaClient(): PrismaClientSingleton {
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development"
      ? ["warn", "error"]
      : ["error"],
  });
}

export const prisma: PrismaClientSingleton =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type { PrismaClientSingleton };
