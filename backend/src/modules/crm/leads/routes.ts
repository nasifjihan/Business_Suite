import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";
import { validate } from "@/middleware/validate";
import { LeadsController } from "./controllers";
import { LeadService } from "./services";
import { successResponse } from "@/lib/response";
import {
  CreateLeadSchema,
  ListLeadsSchema,
  UpdateLeadSchema,
  ConvertLeadSchema,
  PatchLeadStageSchema,
} from "./validators";

const leadsRouter = Router();

leadsRouter.use(authenticate());

leadsRouter
  .route("/")
  .get(
    validate({ query: ListLeadsSchema }),
    authorize("crm.leads.read"),
    LeadsController.list,
  )
  .post(
    validate({ body: CreateLeadSchema }),
    authorize("crm.leads.create"),
    LeadsController.create,
  );

leadsRouter
  .route("/:id")
  .get(authorize("crm.leads.read"), LeadsController.getById)
  .patch(
    validate({ body: UpdateLeadSchema }),
    authorize("crm.leads.update"),
    LeadsController.update,
  )
  .delete(
    authorize("crm.leads.delete"),
    LeadsController.remove,
  );

leadsRouter.post(
  "/:id/convert",
  validate({ body: ConvertLeadSchema }),
  authorize("crm.leads.convert"),
  LeadsController.convertLead,
);

leadsRouter.patch(
  "/:id/stage",
  validate({ body: PatchLeadStageSchema }),
  authorize("crm.leads.update"),
  async (req, res) => {
    const id = req.params.id as string;
    const updated = await LeadService.update(id, { status: req.body.stage }, req);
    return successResponse(res, updated, 200, "Lead stage updated successfully");
  },
);

export { leadsRouter };
