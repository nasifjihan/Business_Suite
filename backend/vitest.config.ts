import { defineConfig } from 'vitest/config';
import path from 'path';
import 'dotenv/config';

/**
 * Which database do tests run against?
 * ---------------------------------------------------------------------------
 * This MUST NOT be the development database. src/tests/setup.ts calls
 * resetDatabase() in afterEach, which deleteMany()s ~25 tables after EVERY
 * test. Before this config existed, tests inherited DATABASE_URL from
 * backend/.env and silently wiped the development database on every run.
 *
 * Resolution order:
 *   1. TEST_DATABASE_URL, if set        -> CI sets this explicitly
 *   2. otherwise, derive "<database>_test" from DATABASE_URL
 *      e.g. .../business_suite  ->  .../business_suite_test
 *
 * Deriving (rather than hardcoding) keeps credentials in one place: there is
 * no second copy of the password to leak or to fall out of sync.
 */
function resolveTestDatabaseUrl(): string {
  const explicit = process.env.TEST_DATABASE_URL;
  if (explicit) return explicit;

  const devUrl = process.env.DATABASE_URL;
  if (!devUrl) {
    throw new Error(
      'Cannot resolve a test database: neither TEST_DATABASE_URL nor DATABASE_URL is set. ' +
        'Create backend/.env, or set TEST_DATABASE_URL explicitly.'
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(devUrl);
  } catch {
    throw new Error(`DATABASE_URL is not a valid URL, so a test database cannot be derived from it.`);
  }

  const dbName = parsed.pathname.replace(/^\//, '');
  if (!dbName) {
    throw new Error(`DATABASE_URL has no database name, so a test database cannot be derived from it.`);
  }

  parsed.pathname = `/${dbName}_test`;
  const derived = parsed.toString();

  if (derived === devUrl) {
    throw new Error('Refusing to run: the derived test database is identical to DATABASE_URL.');
  }
  return derived;
}

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Set here rather than in setup.ts: `env` is applied before any module is
    // imported, whereas assignments inside setup.ts run AFTER its hoisted
    // imports have already constructed the Prisma client.
    env: {
      DATABASE_URL: resolveTestDatabaseUrl(),
    },
    setupFiles: ['./src/tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/tests/**', 'src/**/*.d.ts'],
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
