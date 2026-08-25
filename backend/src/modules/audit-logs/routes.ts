import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";
import { validate } from "@/middleware/validate";
import { AuditLogsController } from "./controllers";
import { ListAuditLogsSchema } from "./validators";

const auditLogsRouter = Router();

auditLogsRouter.use(authenticate());

auditLogsRouter.get(
  "/",
  validate({ query: ListAuditLogsSchema }),
  authorize("audit.read"),
  AuditLogsController.list,
);

export { auditLogsRouter };
