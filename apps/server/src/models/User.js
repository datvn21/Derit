import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // Authentication info (from Google OAuth)
    googleId: {
      type: String,
      unique: true,
      sparse: true, // Allow null/undefined values, only enforce uniqueness when present
      default: undefined,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      default: "",
    },

    // User type & permissions
    role: {
      type: String,
      enum: ["student", "lecturer", "admin"],
      required: true,
    },
    // Admin-specific fields
    isSuperAdmin: {
      type: Boolean,
      default: false,
    },
    adminPermissions: {
      type: [String],
      default: [],
    },
    studentId: {
      type: String,
      default: null,
    },

    // Metadata
    lastLogin: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // Auto-creates createdAt and updatedAt
  },
);

// Index for faster queries
// Note: email and googleId already have unique: true which creates indexes automatically
userSchema.index({ role: 1 });
userSchema.index({ studentId: 1 });

const UserModel = mongoose.models.User || mongoose.model("User", userSchema);
export default UserModel;
