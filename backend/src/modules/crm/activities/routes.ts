import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";
import { validate } from "@/middleware/validate";
import { ActivitiesController } from "./controllers";
import {
  CreateActivitySchema,
  ListActivitiesSchema,
} from "./validators";

const activitiesRouter = Router();

activitiesRouter.use(authenticate());

activitiesRouter
  .route("/")
  .get(
    validate({ query: ListActivitiesSchema }),
    authorize("crm.activities.read"),
    ActivitiesController.list,
  )
  .post(
    validate({ body: CreateActivitySchema }),
    authorize("crm.activities.create"),
    ActivitiesController.create,
  );

export { activitiesRouter };
