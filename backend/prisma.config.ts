import "dotenv/config";
import { defineConfig, type PrismaConfig } from "prisma/config";

/**
 * Which URL do the Prisma CLI commands use?
 * ---------------------------------------------------------------------------
 * Two different connections are needed once the database sits behind a
 * connection pooler (Neon, Supabase, PgBouncer):
 *
 *   DATABASE_URL  -> POOLED endpoint.  Used by the application at runtime, via
 *                    @prisma/adapter-pg in src/lib/prisma.ts. Poolers are built
 *                    for many short-lived queries, which is what a web app does.
 *
 *   DIRECT_URL    -> DIRECT endpoint.  Used by `prisma migrate` / `db pull`
 *                    below. Migrations need session-level features (advisory
 *                    locks, temporary objects, DDL in a long transaction) that
 *                    a transaction-mode pooler does not support. Running them
 *                    through the pooler fails, sometimes only intermittently.
 *
 * On plain local Postgres or the Docker container there is no pooler, so
 * DIRECT_URL is simply unset and both fall back to DATABASE_URL.
 *
 * NOTE: Prisma 7's Datasource type is { url, shadowDatabaseUrl } only - there
 * is no `directUrl` field as there was in the Prisma 6 schema block. The
 * separation is expressed by giving THIS file the direct URL, while the
 * application reads DATABASE_URL itself.
 */
// `||` not `??`: Docker passes unset variables through as EMPTY STRINGS, and
// "" is not nullish - `??` would hand Prisma an empty connection string.
const migrationUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!migrationUrl) {
  throw new Error(
    "Neither DIRECT_URL nor DATABASE_URL is set. Prisma CLI commands " +
      "(migrate, db pull) need a database connection string."
  );
}

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrationUrl,
  },
  seed: [
    {
      run: "npx ts-node prisma/seed.ts",
    },
  ],
} as PrismaConfig);
