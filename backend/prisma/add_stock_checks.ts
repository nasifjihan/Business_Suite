/**
 * Run ONCE after init_core_tables migration to add CHECK constraints on the Stock table.
 * Defense-in-depth: even if our application has a bug that writes negative stock,
 * PostgreSQL itself will reject the write with a CHECK constraint violation.
 *
 * Usage:  npx ts-node prisma/add_stock_checks.ts
 * Safe re-run: idempotent (uses DROP CONSTRAINT IF EXISTS then ADD).
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("⏳ Adding Stock CHECK constraints (defense-in-depth against negative stock)...");

  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS "Stock"
    DROP CONSTRAINT IF EXISTS "stock_quantity_nonnegative";
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Stock"
    ADD CONSTRAINT "stock_quantity_nonnegative"
    CHECK ("quantity" >= 0);
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS "Stock"
    DROP CONSTRAINT IF EXISTS "stock_reserved_nonnegative";
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Stock"
    ADD CONSTRAINT "stock_reserved_nonnegative"
    CHECK ("reservedQuantity" >= 0 AND "reservedQuantity" <= "quantity");
  `);

  console.log("✅ Stock CHECK constraints applied successfully:");
  console.log('   - stock_quantity_nonnegative  ("quantity" >= 0)');
  console.log('   - stock_reserved_nonnegative  (0 <= "reservedQuantity" <= "quantity")');
}

main()
  .catch((e) => {
    console.error("❌ add_stock_checks FAILED:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
