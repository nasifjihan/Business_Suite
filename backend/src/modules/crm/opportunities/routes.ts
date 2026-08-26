import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";
import { validate } from "@/middleware/validate";
import { OpportunitiesController } from "./controllers";
import {
  CreateOpportunitySchema,
  ListOpportunitiesSchema,
  UpdateOpportunitySchema,
  PatchStageSchema,
} from "./validators";

const opportunitiesRouter = Router();

opportunitiesRouter.use(authenticate());

opportunitiesRouter
  .route("/")
  .get(
    validate({ query: ListOpportunitiesSchema }),
    authorize("crm.opportunities.read"),
    OpportunitiesController.list,
  )
  .post(
    validate({ body: CreateOpportunitySchema }),
    authorize("crm.opportunities.create"),
    OpportunitiesController.create,
  );

opportunitiesRouter
  .route("/:id")
  .get(authorize("crm.opportunities.read"), OpportunitiesController.getById)
  .patch(
    validate({ body: UpdateOpportunitySchema }),
    authorize("crm.opportunities.update"),
    OpportunitiesController.update,
  )
  .delete(
    authorize("crm.opportunities.delete"),
    OpportunitiesController.remove,
  );

opportunitiesRouter.patch(
  "/:id/stage",
  validate({ body: PatchStageSchema }),
  authorize("crm.opportunities.stage"),
  OpportunitiesController.patchStage,
);

export { opportunitiesRouter };
