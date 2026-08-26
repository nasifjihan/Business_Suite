import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";
import { validate } from "@/middleware/validate";
import { WarehousesController } from "./controllers";
import {
  CreateWarehouseSchema,
  ListWarehousesSchema,
  UpdateWarehouseSchema,
} from "./validators";

const warehousesRouter = Router();

warehousesRouter.use(authenticate());

warehousesRouter
  .route("/")
  .get(
    validate({ query: ListWarehousesSchema }),
    authorize("inventory.warehouses.read"),
    WarehousesController.list,
  )
  .post(
    validate({ body: CreateWarehouseSchema }),
    authorize("inventory.warehouses.create"),
    WarehousesController.create,
  );

warehousesRouter
  .route("/:id")
  .get(authorize("inventory.warehouses.read"), WarehousesController.getById)
  .patch(
    validate({ body: UpdateWarehouseSchema }),
    authorize("inventory.warehouses.update"),
    WarehousesController.update,
  )
  .delete(
    authorize("inventory.warehouses.delete"),
    WarehousesController.remove,
  );

export { warehousesRouter };
