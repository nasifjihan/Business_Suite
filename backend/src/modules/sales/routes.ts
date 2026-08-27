import { Router } from "express";
import { ordersRouter } from "./orders/routes";
import { paymentsRouter } from "./payments/routes";
import { refundsRouter } from "./refunds/routes";
import { reportsRouter } from "./reports/routes";
import { creditsRouter } from "./credits/routes";

const salesRouter = Router();

salesRouter.use("/orders", ordersRouter);
salesRouter.use("/payments", paymentsRouter);
salesRouter.use("/refunds", refundsRouter);
salesRouter.use("/reports", reportsRouter);
salesRouter.use("/credits", creditsRouter);

export default salesRouter;
export { salesRouter };
