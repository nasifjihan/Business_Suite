/**
 * Inventory module aggregate router.
 * URL surface under /api/v1/inventory/*:
 *   /api/v1/inventory/categories
 *   /api/v1/inventory/products
 *   /api/v1/inventory/warehouses
 *   /api/v1/inventory/stock
 *   /api/v1/inventory/movements
 *   /api/v1/inventory/movements/transfer
 */
import { Router } from "express";
import { categoriesRouter } from "./categories/routes";
import { productsRouter } from "./products/routes";
import { warehousesRouter } from "./warehouses/routes";
import { stockRouter } from "./stock/routes";
import { movementsRouter } from "./stockMovements/routes";

const inventoryRouter = Router();

inventoryRouter.use("/categories", categoriesRouter);
inventoryRouter.use("/products", productsRouter);
inventoryRouter.use("/warehouses", warehousesRouter);
inventoryRouter.use("/stock", stockRouter);
inventoryRouter.use("/movements", movementsRouter);

export { inventoryRouter };
