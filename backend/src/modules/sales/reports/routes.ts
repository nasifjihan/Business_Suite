import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";
import { validate } from "@/middleware/validate";
import { ReportsController } from "./controllers";
import {
  DailySalesSummarySchema,
} from "./validators";

const reportsRouter = Router();

reportsRouter.use(authenticate());

reportsRouter
  .route("/daily-summary")
  .get(
    validate({ query: DailySalesSummarySchema }),
    authorize("sales.reports.read"),
    ReportsController.dailySummary,
  );

export { reportsRouter };
