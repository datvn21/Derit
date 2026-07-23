import { Router } from "express";
import passport from "passport";
import UserModel from "../models/User.js";
import ActivityLogModel from "../models/ActivityLog.js";
import dotenv from "dotenv";
dotenv.config();
const authRouter = Router();

async function logActivity(userId, activityType, details = {}, req) {
  try {
    await ActivityLogModel.create({
      userId,
      activityType,
      details,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get("user-agent"),
    });
  } catch (error) {
    console.error("Error logging activity:", error);
  }
}

/**
 * @swagger
 * /auth/user:
 *   get:
 *     summary: Get current authenticated user
 *     tags: [Authentication]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Current user information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
authRouter.get("/user", async (req, res) => {
  try {
    if (req.isAuthenticated()) {
      const user = await UserModel.findOne({ googleId: req.user.id });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
        studentId: user.studentId,
        isActive: user.isActive,
      });
    } else {
      res.status(401).json({ error: "Not authenticated" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /auth/logout:
 *   get:
 *     summary: Logout current user
 *     tags: [Authentication]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Logged out successfully
 */
authRouter.get("/logout", async (req, res) => {
  const userId = req.user?.id;

  req.logout(() => {
    req.session.destroy(async () => {
      res.clearCookie("connect.sid");

      if (userId) {
        const user = await UserModel.findOne({ googleId: userId });
        if (user) {
          await logActivity(user._id, "logout", {}, req);
        }
      }

      return res.status(200).json({ message: "Logged out successfully" });
    });
  });
});

/**
 * @swagger
 * /auth/google:
 *   get:
 *     summary: Initiate Google OAuth authentication
 *     tags: [Authentication]
 *     responses:
 *       302:
 *         description: Redirect to Google OAuth
 */
authRouter.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);

/**
 * @swagger
 * /auth/google/callback:
 *   get:
 *     summary: Google OAuth callback
 *     tags: [Authentication]
 *     responses:
 *       302:
 *         description: Redirect to frontend based on user role
 */
authRouter.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  async function (req, res) {
    console.log("Google authentication successful");

    try {
      const email = req.user.email;
      const emailDomain = email.split("@")[1];
      const emailPrefix = email.split("@")[0];

      // Determine role based on email domain
      let role = null;
      let studentId = null;

      if (emailDomain === "student.tdtu.edu.vn") {
        // Only students must use @student.tdtu.edu.vn
        role = "student";
        studentId = emailPrefix;
      } else {
        // Any other email can be lecturer (including @gmail.com, @tdtu.edu.vn, etc.)
        role = "lecturer";
      }

      // Find user by googleId first, then by email (for pre-created accounts)
      let user = await UserModel.findOne({ googleId: req.user.id });

      if (!user) {
        // If not found by googleId, try finding by email (pre-created account)
        user = await UserModel.findOne({ email: email });
      }

      if (!user) {
        // User doesn't exist - only auto-create student accounts
        if (role === "student") {
          user = await UserModel.create({
            googleId: req.user.id,
            email: email,
            name: req.user.displayName,
            avatar: req.user.photos?.[0]?.value || "",
            role: role,
            studentId: studentId,
            lastLogin: new Date(),
          });

          console.log(`New student created: ${user.email} (${user.role})`);
        } else {
          // Lecturer accounts must be created manually first
          req.logout(() => {
            req.session.destroy(() => {
              res.redirect(
                process.env.FRONTEND_URL + `/?error=lecturer_not_found`,
              );
            });
          });
          return;
        }
      } else {
        // User exists - update info and googleId if needed
        if (!user.googleId) {
          user.googleId = req.user.id;
          console.log(`Updated googleId for existing user: ${user.email}`);
        }

        user.lastLogin = new Date();
        user.avatar = req.user.photos?.[0]?.value || user.avatar;
        await user.save();

        console.log(`User logged in: ${user.email} (${user.role})`);
      }

      // Log activity
      await logActivity(user._id, "login", { role: user.role }, req);

      // Redirect based on role
      if (role === "student") {
        res.redirect(process.env.FRONTEND_URL + `/student`);
      } else if (role === "lecturer") {
        res.redirect(process.env.FRONTEND_URL + `/lecturer`);
      }
    } catch (error) {
      console.error("Error in OAuth callback:", error);
      res.redirect(process.env.FRONTEND_URL + `/?error=server_error`);
    }
  },
);

export default authRouter;
