/**
 * Single entry point for seeding.  ->  npm run seed
 *
 * Replaces the previous placeholder, which printed "nothing to do" while the
 * real data lived in ten seed_phase*.ts files you had to run by hand, in the
 * right order, with DATABASE_URL set correctly. That was the source of a long
 * run of "why is my database empty" and "why did this seed the wrong database".
 *
 * Each phase is spawned as its own process rather than imported: every
 * seed_phase*.ts calls main() at module scope and disconnects Prisma in a
 * finally block, so importing them in sequence would tear down the connection
 * after the first one. Spawning keeps each file's lifecycle intact and means
 * none of them had to be rewritten.
 *
 * The seeds are additive and idempotent, so re-running is safe.
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

/** Ordered: later phases grant permissions that assume earlier roles exist. */
const SYSTEM_SEEDS = [
  "seed_phase2_admin.ts", // roles + the first admin user
  "seed_phase3_rbac.ts", // 69 base permission codes
  "seed_phase5_crm.ts",
  "seed_phase6_inventory.ts",
  "seed_phase7_sales.ts",
  "seed_phase8_hrm.ts",
  "seed_phase9_dashboard.ts",
  "seed_phase12_health_perm.ts",
] as const;

/**
 * Development-only fixtures: a fake warehouse, a "Beverages" category and demo
 * products. Never run this against production - nobody wants Coca Cola 330ml
 * appearing in a real inventory. Skipped automatically when NODE_ENV=production,
 * and skippable anywhere with `npm run seed -- --no-demo`.
 */
const DEMO_SEEDS = ["seed_demo_phase7_pos.ts"] as const;

function describeTarget(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return "(DATABASE_URL is not set)";
  try {
    const u = new URL(url);
    return `${u.hostname}  db=${u.pathname.slice(1)}`;
  } catch {
    return "(DATABASE_URL is not a valid URL)";
  }
}

function run(file: string): void {
  console.log(`\n──── ${file} ${"─".repeat(Math.max(0, 50 - file.length))}`);
  // A RELATIVE path, run from the backend root - deliberately, not resolve().
  // shell:true is required on Windows (npx is npx.cmd, not a real executable),
  // but it means the argument list gets re-parsed by the shell. An absolute
  // path like "G:\MBW Projects\..." then splits on the space and ts-node
  // receives only "G:\MBW", failing with: Cannot find module ./MBW
  // "prisma/seed_phase2_admin.ts" has no spaces, so it survives the re-parse.
  // cwd is an option, never shell-parsed, so spaces are safe there.
  execFileSync("npx", ["ts-node", `prisma/${file}`], {
    stdio: "inherit",
    shell: true,
    cwd: resolve(__dirname, ".."),
  });
}

function main(): void {
  const skipDemo =
    process.argv.includes("--no-demo") || process.env.NODE_ENV === "production";

  // Printed loudly and first, because the single most common seeding mistake is
  // running against the wrong database: an exported DATABASE_URL in the shell
  // silently overrides backend/.env, and dotenv never overwrites what is
  // already set. Read this line before anything else.
  console.log("═".repeat(60));
  console.log("  SEEDING TARGET:", describeTarget());
  console.log("  Demo fixtures :", skipDemo ? "SKIPPED" : "included");
  console.log("═".repeat(60));

  const files = skipDemo ? [...SYSTEM_SEEDS] : [...SYSTEM_SEEDS, ...DEMO_SEEDS];
  for (const f of files) run(f);

  console.log("\n" + "═".repeat(60));
  console.log(`  Seeding complete - ${files.length} scripts, target above.`);
  console.log("═".repeat(60));
}

main();
