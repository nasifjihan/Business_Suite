import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";
import { validate } from "@/middleware/validate";
import { OrdersController } from "./controllers";
import {
  CreateOrderCheckoutDto,
  ListOrdersQuery,
  UpdateOrderStatusDto,
} from "./validators";
export * as validators from "./validators";
export * as services from "./services";
export * as controllers from "./controllers";

const ordersRouter = Router();

ordersRouter.use(authenticate());

ordersRouter
  .route("/")
  .get(
    validate({ query: ListOrdersQuery }),
    authorize("sales.orders.read"),
    OrdersController.list,
  );

ordersRouter
  .route("/checkout")
  .post(
    validate({ body: CreateOrderCheckoutDto }),
    authorize("sales.orders.create"),
    OrdersController.checkout,
  );

ordersRouter
  .route("/:id")
  .get(
    authorize("sales.orders.read"),
    OrdersController.getById,
  )
  .delete(
    authorize("sales.orders.delete"),
    OrdersController.remove,
  );

ordersRouter
  .route("/:id/status")
  .patch(
    validate({ body: UpdateOrderStatusDto }),
    authorize("sales.orders.update"),
    OrdersController.updateStatus,
  );

export { ordersRouter };
export const routes = ordersRouter;
export default ordersRouter;
