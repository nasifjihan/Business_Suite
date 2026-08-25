/**
 * Barrel export for auth module — keeps routes/index import line short:
 *   import { authRouter } from "../modules/auth";
 * Without this file the import would have to be:
 *   import { authRouter } from "../modules/auth/routes";
 */
export { authRouter } from "./routes";
