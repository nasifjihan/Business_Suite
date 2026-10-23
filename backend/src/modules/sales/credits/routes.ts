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
    // The permission catalog defines sales.credits.update ("Decrease / adjust
    // customer credit balance") — there is no sales.credits.adjust code, and the
    // admin UI gates the Adjust Credit modal on sales.credits.update.
    authorize("sales.credits.update"),
    CreditsController.adjust,
  );

export { creditsRouter };
