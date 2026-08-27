import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";
import { validate } from "@/middleware/validate";
import { CreditsController } from "./controllers";
import {
  AdjustCreditSchema,
  ListCreditsSchema,
} from "./validators";

const creditsRouter = Router();

creditsRouter.use(authenticate());

creditsRouter
  .route("/")
  .get(
    validate({ query: ListCreditsSchema }),
    authorize("sales.credits.read"),
    CreditsController.list,
  );

creditsRouter
  .route("/adjust")
  .post(
    validate({ body: AdjustCreditSchema }),
    authorize("sales.credits.adjust"),
    CreditsController.adjust,
  );

export { creditsRouter };
