/*
  Warnings:

  - You are about to drop the column `code` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `brand` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `minimumStock` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `purchasePrice` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `sellingPrice` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `taxRate` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `unit` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `avgCostPrice` on the `Stock` table. All the data in the column will be lost.
  - You are about to drop the column `lastMovementAt` on the `Stock` table. All the data in the column will be lost.
  - You are about to drop the column `reservedQuantity` on the `Stock` table. All the data in the column will be lost.
  - You are about to drop the column `referenceId` on the `StockMovement` table. All the data in the column will be lost.
  - You are about to drop the column `referenceType` on the `StockMovement` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `StockMovement` table. All the data in the column will be lost.
  - You are about to drop the column `unitCost` on the `StockMovement` table. All the data in the column will be lost.
  - You are about to drop the column `address` on the `Warehouse` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `Warehouse` table. All the data in the column will be lost.
  - You are about to drop the column `country` on the `Warehouse` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Warehouse` table. All the data in the column will be lost.
  - Added the required column `movementType` to the `StockMovement` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('IN', 'OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUST', 'COUNT', 'SCRAP');

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "Stock" DROP CONSTRAINT "Stock_productId_fkey";

-- DropForeignKey
ALTER TABLE "Stock" DROP CONSTRAINT "Stock_warehouseId_fkey";

-- DropForeignKey
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_productId_fkey";

-- DropForeignKey
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_warehouseId_fkey";

-- DropIndex
DROP INDEX "Category_code_key";

-- DropIndex
DROP INDEX "Category_status_idx";

-- DropIndex
DROP INDEX "Product_barcode_key";

-- DropIndex
DROP INDEX "Product_createdBy_idx";

-- DropIndex
DROP INDEX "Product_sellingPrice_idx";

-- DropIndex
DROP INDEX "StockMovement_referenceType_referenceId_idx";

-- DropIndex
DROP INDEX "StockMovement_type_idx";

-- DropIndex
DROP INDEX "Warehouse_status_idx";

-- AlterTable
ALTER TABLE "Category" DROP COLUMN "code",
DROP COLUMN "imageUrl",
DROP COLUMN "status",
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "parentId" TEXT;

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "brand",
DROP COLUMN "createdBy",
DROP COLUMN "imageUrl",
DROP COLUMN "minimumStock",
DROP COLUMN "purchasePrice",
DROP COLUMN "sellingPrice",
DROP COLUMN "taxRate",
DROP COLUMN "unit",
ADD COLUMN     "costPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "unitOfMeasure" TEXT NOT NULL DEFAULT 'EACH',
ADD COLUMN     "unitPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "weightKg" DECIMAL(10,3);

-- AlterTable
ALTER TABLE "Stock" DROP COLUMN "avgCostPrice",
DROP COLUMN "lastMovementAt",
DROP COLUMN "reservedQuantity",
ADD COLUMN     "minimumLevel" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StockMovement" DROP COLUMN "referenceId",
DROP COLUMN "referenceType",
DROP COLUMN "type",
DROP COLUMN "unitCost",
ADD COLUMN     "movementType" "MovementType" NOT NULL,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "Warehouse" DROP COLUMN "address",
DROP COLUMN "city",
DROP COLUMN "country",
DROP COLUMN "status",
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "location" TEXT,
ALTER COLUMN "code" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- CreateIndex
CREATE INDEX "Category_createdById_idx" ON "Category"("createdById");

-- CreateIndex
CREATE INDEX "Product_barcode_idx" ON "Product"("barcode");

-- CreateIndex
CREATE INDEX "Product_createdById_idx" ON "Product"("createdById");

-- CreateIndex
CREATE INDEX "Product_unitPrice_idx" ON "Product"("unitPrice");

-- CreateIndex
CREATE INDEX "Stock_quantity_idx" ON "Stock"("quantity");

-- CreateIndex
CREATE INDEX "StockMovement_movementType_idx" ON "StockMovement"("movementType");

-- CreateIndex
CREATE INDEX "StockMovement_userId_idx" ON "StockMovement"("userId");

-- CreateIndex
CREATE INDEX "Warehouse_isActive_idx" ON "Warehouse"("isActive");

-- CreateIndex
CREATE INDEX "Warehouse_createdById_idx" ON "Warehouse"("createdById");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
