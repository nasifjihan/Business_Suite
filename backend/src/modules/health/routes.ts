import { Router } from "express";
import { healthCheck } from "./controllers";

export const healthRouter = Router();
healthRouter.get("/", healthCheck);
