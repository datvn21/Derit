/**
 * @deprecated Use `policy.js` instead. This file remains only for backwards
 * compatibility with any code that imports the legacy admin middleware names.
 * All admin gating should go through `requirePermission`, `requireAdmin`, or
 * `requireSuperAdmin` in `policy.js`.
 */
export {
  PERMISSIONS,
  requireAdmin,
  requireSuperAdmin,
  requireAuth,
  requireRole,
  requireLecturerOrAdmin,
  requirePermission,
  isAuthenticated,
  isAdmin,
  isSuperAdmin,
  isLecturerOrAdmin,
  hasPermission,
} from "./policy.js";
