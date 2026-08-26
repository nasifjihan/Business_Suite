import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";
import { validate } from "@/middleware/validate";
import { CustomersController } from "./controllers";
import {
  CreateCustomerSchema,
  ListCustomersSchema,
  UpdateCustomerSchema,
} from "./validators";

const customersRouter = Router();

customersRouter.use(authenticate());

customersRouter
  .route("/")
  .get(
    validate({ query: ListCustomersSchema }),
    authorize("crm.customers.read"),
    CustomersController.list,
  )
  .post(
    validate({ body: CreateCustomerSchema }),
    authorize("crm.customers.create"),
    CustomersController.create,
  );

customersRouter
  .route("/:id")
  .get(authorize("crm.customers.read"), CustomersController.getById)
  .patch(
    validate({ body: UpdateCustomerSchema }),
    authorize("crm.customers.update"),
    CustomersController.update,
  )
  .delete(
    authorize("crm.customers.delete"),
    CustomersController.remove,
  );

export { customersRouter };
