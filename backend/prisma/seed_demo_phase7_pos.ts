/**
 * DEMO DATA SEED for Phase 7 POS smoke test — RUN ONCE ONLY.
 * Idempotent upsert-only (no deleteMany, no destructive DROP).
 * Creates: 1 Warehouse (Main Warehouse), 1 Category (Beverages),
 * 1 Product "Coca Cola 330ml Can" sellingPrice $1.20, Stock qty = 100 in Main WH.
 *
 * Run:
 *   cd backend
 *   npx ts-node --transpile-only prisma/seed_demo_phase7_pos.ts
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const admin = await prisma.user.findFirst({
    where: { email: { equals: "admin@example.com", mode: "insensitive" } },
    select: { id: true },
  });
  const adminId = admin?.id;

  const warehouseData: Record<string, unknown> = {
    code: "WH-MAIN",
    name: "Main Warehouse",
    location: "123 Main Street, City Center",
    isActive: true,
  };
  if (adminId) {
    warehouseData.manager = { connect: { id: adminId } };
    warehouseData.createdBy = { connect: { id: adminId } };
  }
  const warehouse = await prisma.warehouse.upsert({
    where: { code: "WH-MAIN" },
    update: {},
    create: warehouseData as never,
  });
  console.log(`[upsert] Warehouse: ${warehouse.code} = ${warehouse.name}`);

  const categoryData: Record<string, unknown> = {
    name: "Beverages",
    description: "Soft drinks, juices, water",
  };
  if (adminId) categoryData.createdBy = { connect: { id: adminId } };
  const category = await prisma.category.upsert({
    where: { name: "Beverages" },
    update: {},
    create: categoryData as never,
  });
  console.log(`[upsert] Category id=${category.id} → Beverages`);

  const productData: Record<string, unknown> = {
    sku: "COKE-330ML",
    name: "Coca Cola 330ml Can",
    barcode: "5449000000996",
    status: "ACTIVE",
    description: "Classic Coca-Cola carbonated soft drink 330ml aluminum can",
    costPrice: 0.7,
    unitPrice: 1.2,
    unitOfMeasure: "EACH",
    category: { connect: { id: category.id } },
  };
  if (adminId) productData.createdBy = { connect: { id: adminId } };
  const product = await prisma.product.upsert({
    where: { sku: "COKE-330ML" },
    update: {},
    create: productData as never,
  });
  console.log(`[upsert] Product: ${product.sku} → ${product.name} ($${product.unitPrice} sell)`);

  const stock = await prisma.stock.upsert({
    where: {
      productId_warehouseId: { productId: product.id, warehouseId: warehouse.id },
    },
    update: {
      quantity: 100,
      minimumLevel: 10,
    },
    create: {
      product: { connect: { id: product.id } },
      warehouse: { connect: { id: warehouse.id } },
      quantity: 100,
      minimumLevel: 10,
    },
  });
  console.log(`[upsert] Stock: WH-MAIN x COKE-330ML qty=${stock.quantity} (on hand)`);

  console.log("✅ Demo data seed done. Refresh POS page → search 'coke' → appears.");
  console.log("Now test GATE 2: Cola × 2 → CASH $5 → change should be $2.60.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("❌ seed_demo_phase7_pos failed:", e);
    process.exit(1);
  });
