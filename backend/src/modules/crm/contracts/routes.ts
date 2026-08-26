import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";
import { validate } from "@/middleware/validate";
import { ContractsController } from "./controllers";
import {
  CreateContractSchema,
  ListContractsSchema,
  UpdateContractSchema,
} from "./validators";

const contractsRouter = Router();

contractsRouter.use(authenticate());

contractsRouter
  .route("/")
  .get(
    validate({ query: ListContractsSchema }),
    authorize("crm.contracts.read"),
    ContractsController.list,
  )
  .post(
    validate({ body: CreateContractSchema }),
    authorize("crm.contracts.create"),
    ContractsController.create,
  );

contractsRouter
  .route("/:id")
  .get(authorize("crm.contracts.read"), ContractsController.getById)
  .patch(
    validate({ body: UpdateContractSchema }),
    authorize("crm.contracts.update"),
    ContractsController.update,
  )
  .delete(
    authorize("crm.contracts.delete"),
    ContractsController.remove,
  );

export { contractsRouter };
