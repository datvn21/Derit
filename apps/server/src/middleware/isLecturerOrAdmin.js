// Deprecated: re-exports from the unified policy module. Use `apps/server/src/middleware/policy.js` directly.
import { requireLecturerOrAdmin } from "./policy.js";

export const isLecturerOrAdmin = (req, res, next) =>
  requireLecturerOrAdmin(req, res, next);
export { requireLecturerOrAdmin };
