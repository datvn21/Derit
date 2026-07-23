import mongoose from "mongoose";

const classroomSchema = new mongoose.Schema(
  {
    classroomName: {
      type: String,
      required: true,
      trim: true,
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

const ClassroomModel =
  mongoose.models.Classroom ||
  mongoose.model("Classroom", classroomSchema);

export default ClassroomModel;
