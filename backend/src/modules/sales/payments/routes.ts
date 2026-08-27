import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";
import { validate } from "@/middleware/validate";
import { PaymentsController } from "./controllers";
import {
  CreatePaymentSchema,
  ListPaymentsSchema,
} from "./validators";

const paymentsRouter = Router();

paymentsRouter.use(authenticate());

paymentsRouter
  .route("/")
  .get(
    validate({ query: ListPaymentsSchema }),
    authorize("sales.payments.read"),
    PaymentsController.list,
  )
  .post(
    validate({ body: CreatePaymentSchema }),
    authorize("sales.payments.create"),
    PaymentsController.create,
  );

paymentsRouter
  .route("/:id")
  .get(authorize("sales.payments.read"), PaymentsController.getById);

export { paymentsRouter };
