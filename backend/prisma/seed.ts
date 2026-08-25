// Business Suite — Prisma Seed Script (Phase 3 placeholder, expanded then)
// Currently only creates the seed skeleton + prints warnings.
// Full realistic demo data (users, customers, products, orders, etc.) is implemented in Phase 3.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Prisma Seed running...");
  console.log("ℹ️  Full seed data with demo users/customers/products will be populated in Phase 3.");
  console.log("✅ Seed: nothing to do (placeholder phase 1). Exiting.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
