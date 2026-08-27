import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";
import { validate } from "@/middleware/validate";
import { DesignationsController } from "./controllers";
import {
  CreateDesignationSchema,
  ListDesignationsSchema,
  UpdateDesignationSchema,
} from "./validators";

const designationsRouter = Router();

designationsRouter.use(authenticate());

designationsRouter
  .route("/")
  .get(
    validate({ query: ListDesignationsSchema }),
    authorize("hrm.designations.read"),
    DesignationsController.list,
  )
  .post(
    validate({ body: CreateDesignationSchema }),
    authorize("hrm.designations.create"),
    DesignationsController.create,
  );

designationsRouter
  .route("/:id")
  .get(authorize("hrm.designations.read"), DesignationsController.getById)
  .patch(
    validate({ body: UpdateDesignationSchema }),
    authorize("hrm.designations.update"),
    DesignationsController.update,
  )
  .delete(
    authorize("hrm.designations.delete"),
    DesignationsController.remove,
  );

export { designationsRouter };
