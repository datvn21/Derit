import { Router } from "express";
import UserModel from "../models/User.js";
import AdminSettingsModel from "../models/AdminSettings.js";
import ActivityLogModel from "../models/ActivityLog.js";
import { requireAdmin, requireSuperAdmin, PERMISSIONS } from "../middleware/adminAuth.js";

const adminRouter = Router();

/**
 * Helper to log admin actions
 */
async function logAdminAction(req, action, details = {}) {
  try {
    await ActivityLogModel.create({
      userId: req.user._id,
      activityType: `admin_${action}`,
      details: {
        ...details,
        targetUser: details.userId,
        userEmail: req.user.email,
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });
  } catch (error) {
    console.error("Error logging admin action:", error);
  }
}

// ============================================
// SYSTEM SETTINGS (Super Admin Only)
// ============================================

/**
 * Get system settings
 * GET /admin/settings
 */
adminRouter.get("/settings", requireAdmin, async (req, res) => {
  try {
    const settings = await AdminSettingsModel.getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update system settings (Super Admin only)
 * PUT /admin/settings
 */
adminRouter.put(
  "/settings",
  requireSuperAdmin,
  async (req, res) => {
    try {
      const {
        systemName,
        allowStudentRegistration,
        requireEmailVerification,
        defaultCompileTimeout,
        defaultRunTimeout,
        maxConcurrentSubmissions,
        sessionExpiryHours,
        maxLoginAttempts,
        lockoutDurationMinutes,
        allowedStudentDomains,
        maintenanceMode,
        maintenanceMessage,
        autoGradingEnabled,
        plagiarismDetectionEnabled,
      } = req.body;

      const settings = await AdminSettingsModel.updateSettings({
        ...(systemName !== undefined && { systemName }),
        ...(allowStudentRegistration !== undefined && {
          allowStudentRegistration,
        }),
        ...(requireEmailVerification !== undefined && {
          requireEmailVerification,
        }),
        ...(defaultCompileTimeout !== undefined && {
          defaultCompileTimeout,
        }),
        ...(defaultRunTimeout !== undefined && { defaultRunTimeout }),
        ...(maxConcurrentSubmissions !== undefined && {
          maxConcurrentSubmissions,
        }),
        ...(sessionExpiryHours !== undefined && { sessionExpiryHours }),
        ...(maxLoginAttempts !== undefined && { maxLoginAttempts }),
        ...(lockoutDurationMinutes !== undefined && {
          lockoutDurationMinutes,
        }),
        ...(allowedStudentDomains !== undefined && {
          allowedStudentDomains,
        }),
        ...(maintenanceMode !== undefined && { maintenanceMode }),
        ...(maintenanceMessage !== undefined && { maintenanceMessage }),
        ...(autoGradingEnabled !== undefined && { autoGradingEnabled }),
        ...(plagiarismDetectionEnabled !== undefined && {
          plagiarismDetectionEnabled,
        }),
      });

      await logAdminAction(req, "update_settings", { changes: req.body });
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// ============================================
// USER MANAGEMENT
// ============================================

/**
 * Get all users with pagination and filtering
 * GET /admin/users
 */
adminRouter.get("/users", requireAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      role,
      search,
      isActive,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const filter = {};

    if (role) {
      filter.role = role;
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { studentId: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [users, total] = await Promise.all([
      UserModel.find(filter).select("-__v").sort(sort).skip(skip).limit(parseInt(limit)),
      UserModel.countDocuments(filter),
    ]);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get user by ID
 * GET /admin/users/:id
 */
adminRouter.get("/users/:id", requireAdmin, async (req, res) => {
  try {
    const user = await UserModel.findById(req.params.id).select("-__v");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create new user (lecturer or admin)
 * POST /admin/users
 */
adminRouter.post("/users", requireSuperAdmin, async (req, res) => {
  try {
    const { email, name, role, studentId, isSuperAdmin, adminPermissions } = req.body;

    // Check if email already exists
    const existing = await UserModel.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const user = await UserModel.create({
      email,
      name,
      role: role || "lecturer",
      studentId: studentId || null,
      isSuperAdmin: role === "admin" ? !!isSuperAdmin : false,
      adminPermissions: role === "admin" ? adminPermissions || [] : [],
    });

    await logAdminAction(req, "create_user", { userId: user._id, email, role });

    res.status(201).json({
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      isSuperAdmin: user.isSuperAdmin,
      adminPermissions: user.adminPermissions,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update user
 * PUT /admin/users/:id
 */
adminRouter.put("/users/:id", requireAdmin, async (req, res) => {
  try {
    const { name, role, isActive, isSuperAdmin, adminPermissions } = req.body;
    const userId = req.params.id;

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Prevent self-demotion from super admin
    if (req.user._id.toString() === userId && isSuperAdmin === false) {
      return res.status(400).json({
        error: "Cannot remove super admin status from yourself",
      });
    }

    // Prevent removing last super admin
    if (
      user.isSuperAdmin &&
      isSuperAdmin === false &&
      (await UserModel.countDocuments({ isSuperAdmin: true })) <= 1
    ) {
      return res.status(400).json({
        error: "Cannot remove the last super admin",
      });
    }

    // Update fields
    if (name !== undefined) user.name = name;
    if (role !== undefined) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;

    // Only super admin can modify these
    if (req.user.isSuperAdmin) {
      if (role === "admin" || user.role === "admin") {
        if (isSuperAdmin !== undefined) user.isSuperAdmin = isSuperAdmin;
        if (adminPermissions !== undefined) user.adminPermissions = adminPermissions;
      }
    }

    await user.save();

    await logAdminAction(req, "update_user", {
      userId,
      changes: { name, role, isActive, isSuperAdmin, adminPermissions },
    });

    res.json({
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      isSuperAdmin: user.isSuperAdmin,
      adminPermissions: user.adminPermissions,
      isActive: user.isActive,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete user
 * DELETE /admin/users/:id
 */
adminRouter.delete("/users/:id", requireSuperAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent self-deletion
    if (req.user._id.toString() === userId) {
      return res.status(400).json({ error: "Cannot delete yourself" });
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Prevent deleting last super admin
    if (
      user.isSuperAdmin &&
      (await UserModel.countDocuments({ isSuperAdmin: true })) <= 1
    ) {
      return res.status(400).json({
        error: "Cannot delete the last super admin",
      });
    }

    await UserModel.findByIdAndDelete(userId);

    await logAdminAction(req, "delete_user", { userId, email: user.email });

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Change user role
 * POST /admin/users/:id/role
 */
adminRouter.post("/users/:id/role", requireSuperAdmin, async (req, res) => {
  try {
    const { role, isSuperAdmin } = req.body;
    const userId = req.params.id;

    if (!["student", "lecturer", "admin"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Prevent self-demotion from super admin
    if (req.user._id.toString() === userId && isSuperAdmin === false && role !== "admin") {
      return res.status(400).json({
        error: "Cannot demote yourself from super admin",
      });
    }

    user.role = role;
    if (role === "admin") {
      user.isSuperAdmin = !!isSuperAdmin;
      user.adminPermissions = user.adminPermissions || [];
    } else {
      user.isSuperAdmin = false;
      user.adminPermissions = [];
    }

    await user.save();

    await logAdminAction(req, "change_role", {
      userId,
      oldRole: user.role,
      newRole: role,
    });

    res.json({
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      isSuperAdmin: user.isSuperAdmin,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ACTIVITY LOGS
// ============================================

/**
 * Get activity logs with pagination
 * GET /admin/logs
 */
adminRouter.get("/logs", requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, userId, activityType, startDate, endDate } =
      req.query;

    const filter = {};

    if (userId) filter.userId = userId;
    if (activityType) filter.activityType = activityType;

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      ActivityLogModel.find(filter)
        .populate("userId", "name email role")
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      ActivityLogModel.countDocuments(filter),
    ]);

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get activity log stats
 * GET /admin/logs/stats
 */
adminRouter.get("/logs/stats", requireAdmin, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const stats = await ActivityLogModel.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: "$activityType",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const totalActions = await ActivityLogModel.countDocuments({
      timestamp: { $gte: startDate },
    });

    res.json({ stats, totalActions, period: `${days} days` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// STATISTICS
// ============================================

/**
 * Get dashboard statistics
 * GET /admin/stats
 */
adminRouter.get("/stats", requireAdmin, async (req, res) => {
  try {
    const [userStats, examStats] = await Promise.all([
      UserModel.aggregate([
        {
          $group: {
            _id: "$role",
            count: { $sum: 1 },
            activeCount: {
              $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
            },
          },
        },
      ]),
      UserModel.countDocuments({ lastLogin: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }),
    ]);

    const recentLogins = examStats;

    res.json({
      users: userStats,
      recentLogins,
      timestamp: new Date(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default adminRouter;
