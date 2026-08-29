/**
 * Centralised policy middleware for Derit.
 *
 * Pattern: thin wrappers around `req.isAuthenticated()` plus a role/permission lookup.
 *  - `requireAuth`            → user must have a Passport session
 *  - `requireRole(...roles)`  → user.role (or isSuperAdmin) must match one of the allowed roles
 *  - `requirePermission(perm)`→ admin/super-admin with the named permission (or super-admin, which has all)
 *
 * Routes should only import from this file. Routes should never re-implement
 * role checks inline.
 */
import UserModel from "../models/User.js";

// Permission constants - single source of truth.
export const PERMISSIONS = {
  USERS_READ: "users:read",
  USERS_WRITE: "users:write",
  USERS_DELETE: "users:delete",
  USERS_PROMOTE: "users:promote",

  EXAMS_READ: "exams:read",
  EXAMS_WRITE: "exams:write",
  EXAMS_DELETE: "exams:delete",

  CLASSROOMS_READ: "classrooms:read",
  CLASSROOMS_WRITE: "classrooms:write",
  CLASSROOMS_DELETE: "classrooms:delete",

  SETTINGS_READ: "settings:read",
  SETTINGS_WRITE: "settings:write",

  LOGS_READ: "logs:read",
};

const ROLE_VALUES = new Set(["student", "lecturer", "admin"]);

/**
 * Load the DB-side user document and attach it to `req.dbUser`.
 * This consolidates what `isLecturerOrAdmin` used to do so each route
 * doesn't need to repeat the lookup.
 */
async function loadDbUser(req) {
  if (req.dbUser) return req.dbUser;
  const identifier =
    req.user?.googleId || req.user?.id || req.user?._id?.toString();
  if (!identifier) return null;
  const user = await UserModel.findOne({ googleId: identifier });
  if (user) req.dbUser = user;
  return user;
}

/**
 * Lightweight session check. Does not touch the DB.
 */
export function requireAuth(req, res, next) {
  if (typeof req.isAuthenticated === "function" && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: "Authentication required" });
}

/**
 * Require one of the given roles. Super-admin (`isSuperAdmin=true`) is
 * accepted regardless of the role enum.
 */
export function requireRole(...allowedRoles) {
  const allowed = allowedRoles.flat().filter((r) => ROLE_VALUES.has(r));
  return async (req, res, next) => {
    if (typeof req.isAuthenticated !== "function" || !req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }
    try {
      const user = await loadDbUser(req);
      if (!user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      if (!user.isSuperAdmin && !allowed.includes(user.role)) {
        return res.status(403).json({
          error: "Forbidden",
          required: allowed,
          current: user.role,
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Convenience: lecturer or admin (matches the existing role distribution).
 */
export const requireLecturerOrAdmin = requireRole("lecturer", "admin");

/**
 * Require an admin permission. Super-admins always pass.
 */
export function requirePermission(permission) {
  return async (req, res, next) => {
    if (typeof req.isAuthenticated !== "function" || !req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }
    try {
      const user = await loadDbUser(req);
      if (!user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      if (user.isSuperAdmin) return next();
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const perms = user.adminPermissions || [];
      if (!perms.includes(permission)) {
        return res.status(403).json({
          error: `Permission '${permission}' required`,
          required: permission,
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Require admin role (any sub-admin or super-admin).
 */
export const requireAdmin = requireRole("admin");
export const requireSuperAdmin = (req, res, next) => {
  if (typeof req.isAuthenticated !== "function" || !req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  loadDbUser(req).then((user) => {
    if (!user || !user.isSuperAdmin) {
      return res.status(403).json({ error: "Super admin access required" });
    }
    next();
  });
};

// Legacy aliases preserved so older imports keep working while we migrate.
export const isAuthenticated = requireAuth;
export const isLecturerOrAdmin = (req, res, next) =>
  requireLecturerOrAdmin(req, res, next);
export const isAdmin = requireAdmin;
export const isSuperAdmin = requireSuperAdmin;
export const hasPermission = (perm) => requirePermission(perm);
