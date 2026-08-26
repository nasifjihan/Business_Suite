import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";
import { validate } from "@/middleware/validate";
import { StockController } from "./controllers";
import {
  ListStockSchema,
  GetStockByKeySchema,
} from "./validators";

const stockRouter = Router();

stockRouter.use(authenticate());

stockRouter
  .route("/")
  .get(
    validate({ query: ListStockSchema }),
    authorize("inventory.stock.read"),
    StockController.list,
  );

stockRouter
  .route("/:productId/:warehouseId")
  .get(
    validate({ params: GetStockByKeySchema }),
    authorize("inventory.stock.read"),
    StockController.getByKey,
  );

export { stockRouter };
