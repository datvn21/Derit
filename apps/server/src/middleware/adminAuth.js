/**
 * Admin authentication middleware
 * Requires user to be authenticated and have admin role
 */

/**
 * Middleware to check if user is authenticated
 */
export function isAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: "Authentication required" });
}

/**
 * Middleware to check if user has admin role
 * Must be used after isAuthenticated
 */
export function isAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (req.user.role !== "admin" && !req.user.isSuperAdmin) {
    return res.status(403).json({
      error: "Admin access required",
      required: "admin",
      current: req.user.role,
    });
  }

  return next();
}

/**
 * Middleware to check if user is super admin
 */
export function isSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (!req.user.isSuperAdmin) {
    return res.status(403).json({
      error: "Super admin access required",
      required: "superAdmin",
    });
  }

  return next();
}

/**
 * Middleware to check specific admin permission
 * @param {string} permission - Required permission (e.g., 'users:read', 'users:write')
 */
export function hasPermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Super admin has all permissions
    if (req.user.isSuperAdmin) {
      return next();
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    // Check specific permission
    if (
      req.user.adminPermissions &&
      !req.user.adminPermissions.includes(permission)
    ) {
      return res.status(403).json({
        error: `Permission '${permission}' required`,
        required: permission,
      });
    }

    return next();
  };
}

/**
 * Combined middleware: require authentication + admin role
 */
export function requireAdmin(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (req.user.role !== "admin" && !req.user.isSuperAdmin) {
    return res.status(403).json({
      error: "Admin access required",
      required: "admin",
      current: req.user.role,
    });
  }

  return next();
}

/**
 * Combined middleware: require super admin
 */
export function requireSuperAdmin(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (!req.user.isSuperAdmin) {
    return res.status(403).json({
      error: "Super admin access required",
      required: "superAdmin",
    });
  }

  return next();
}

// Permission constants
export const PERMISSIONS = {
  // User management
  USERS_READ: "users:read",
  USERS_WRITE: "users:write",
  USERS_DELETE: "users:delete",
  USERS_PROMOTE: "users:promote",

  // Exam management
  EXAMS_READ: "exams:read",
  EXAMS_WRITE: "exams:write",
  EXAMS_DELETE: "exams:delete",

  // Classroom management
  CLASSROOMS_READ: "classrooms:read",
  CLASSROOMS_WRITE: "classrooms:write",
  CLASSROOMS_DELETE: "classrooms:delete",

  // System settings
  SETTINGS_READ: "settings:read",
  SETTINGS_WRITE: "settings:write",

  // Activity logs
  LOGS_READ: "logs:read",
};
