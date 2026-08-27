import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";
import { validate } from "@/middleware/validate";
import { RefundsController } from "./controllers";
import {
  CreateRefundSchema,
  ListRefundsSchema,
} from "./validators";

const refundsRouter = Router();

refundsRouter.use(authenticate());

refundsRouter
  .route("/")
  .get(
    validate({ query: ListRefundsSchema }),
    authorize("sales.refunds.read"),
    RefundsController.list,
  )
  .post(
    validate({ body: CreateRefundSchema }),
    authorize("sales.refunds.create"),
    RefundsController.create,
  );

refundsRouter
  .route("/:id")
  .get(authorize("sales.refunds.read"), RefundsController.getById);

export { refundsRouter };
