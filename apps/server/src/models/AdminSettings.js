import mongoose from "mongoose";

const adminSettingsSchema = new mongoose.Schema(
  {
    // System-wide settings
    systemName: {
      type: String,
      default: "DERIT - Online Exam System",
    },
    allowStudentRegistration: {
      type: Boolean,
      default: true,
    },
    requireEmailVerification: {
      type: Boolean,
      default: false,
    },

    // Exam defaults
    defaultCompileTimeout: {
      type: Number,
      default: 10000, // 10 seconds
    },
    defaultRunTimeout: {
      type: Number,
      default: 5000, // 5 seconds
    },
    maxConcurrentSubmissions: {
      type: Number,
      default: 4,
    },

    // Security settings
    sessionExpiryHours: {
      type: Number,
      default: 24,
    },
    maxLoginAttempts: {
      type: Number,
      default: 5,
    },
    lockoutDurationMinutes: {
      type: Number,
      default: 30,
    },

    // Allowed email domains for students
    allowedStudentDomains: {
      type: [String],
      default: ["student.tdtu.edu.vn"],
    },

    // Maintenance mode
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    maintenanceMessage: {
      type: String,
      default: "System is under maintenance. Please try again later.",
    },

    // Grading settings
    autoGradingEnabled: {
      type: Boolean,
      default: true,
    },
    plagiarismDetectionEnabled: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Ensure singleton document
adminSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

adminSettingsSchema.statics.updateSettings = async function (updates) {
  const settings = await this.getSettings();
  Object.assign(settings, updates);
  return settings.save();
};

const AdminSettingsModel =
  mongoose.models.AdminSettings ||
  mongoose.model("AdminSettings", adminSettingsSchema);
export default AdminSettingsModel;
