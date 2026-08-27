import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";
import { DashboardController } from "./controllers";

const dashboardRouter = Router();

dashboardRouter.use(authenticate());

dashboardRouter.get(
  "/summary",
  authorize("dashboard.read"),
  DashboardController.summary
);

dashboardRouter.get(
  "/sales-trend",
  authorize("dashboard.read"),
  DashboardController.salesTrend
);

dashboardRouter.get(
  "/top-products",
  authorize("dashboard.read"),
  DashboardController.topProducts
);

dashboardRouter.get(
  "/lead-pipeline",
  authorize("dashboard.read"),
  DashboardController.leadPipeline
);

dashboardRouter.get(
  "/attendance-summary",
  authorize("dashboard.read"),
  DashboardController.attendanceSummary
);

dashboardRouter.get(
  "/recent-orders",
  authorize("dashboard.read"),
  DashboardController.recentOrders
);

dashboardRouter.get(
  "/recent-activities",
  authorize("dashboard.read"),
  DashboardController.recentActivities
);

export { dashboardRouter };
