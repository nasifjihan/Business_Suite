import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";
import { validate } from "@/middleware/validate";
import { StockMovementsController } from "./controllers";
import {
  CreateMovementSchema,
  TransferSchema,
  ListMovementsSchema,
  GetMovementSchema,
} from "./validators";

const movementsRouter = Router();

movementsRouter.use(authenticate());

movementsRouter
  .route("/")
  .get(
    validate({ query: ListMovementsSchema }),
    authorize("inventory.movements.read"),
    StockMovementsController.list,
  )
  .post(
    validate({ body: CreateMovementSchema }),
    authorize("inventory.movements.create"),
    StockMovementsController.createMovement,
  );

movementsRouter.post(
  "/transfer",
  validate({ body: TransferSchema }),
  authorize("inventory.movements.create"),
  StockMovementsController.createTransfer,
);

movementsRouter
  .route("/:id")
  .get(
    validate({ params: GetMovementSchema }),
    authorize("inventory.movements.read"),
    StockMovementsController.getMovement,
  );

export { movementsRouter };
