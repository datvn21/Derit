import UserModel from "../models/User.js";

export async function isLecturerOrAdmin(req, res, next) {
  try {
    const userId = req.user.googleId || req.user.id || req.user._id;
    const user = await UserModel.findOne({ googleId: userId });
    if (!user || (user.role !== "lecturer" && user.role !== "admin" && !user.isSuperAdmin)) {
      return res.status(403).json({ error: "Access denied. Lecturer or Admin only." });
    }
    req.dbUser = user;
    return next();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
