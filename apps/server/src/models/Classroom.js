import mongoose from "mongoose";

const classroomSchema = new mongoose.Schema(
  {
    classroomName: {
      type: String,
      required: true,
      trim: true,
    },

    academicYear: {
      type: String,
      default: () => String(new Date().getFullYear()),
      trim: true,
      validate: {
        validator(value) {
          if (!/^\d{4}$/.test(String(value))) return false;

          const numericYear = Number(value);
          return (
            numericYear >= 2000 &&
            numericYear <= new Date().getFullYear() + 1
          );
        },
        message: "Academic year must be a valid 4-digit year",
      },
    },

    // Student IDs (e.g. "521H0001") — stored as raw numbers,
    // formatted to email on session creation
    students: {
      type: [String],
      default: [],
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

classroomSchema.index({ createdBy: 1 });
classroomSchema.index({ createdBy: 1, academicYear: 1 });

const ClassroomModel =
  mongoose.models.Classroom ||
  mongoose.model("Classroom", classroomSchema);

export default ClassroomModel;
