import mongoose from "mongoose";

// Generate unique room code
function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No confusing chars (0,O,I,1)
  const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
  let random = "";
  for (let i = 0; i < 4; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${timestamp}${random}`;
}

const examSessionSchema = new mongoose.Schema(
  {
    // Link to template
    examTemplateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamTemplate",
      required: true,
    },

    // Session info
    sessionName: {
      type: String,
      required: true,
    },
    roomCode: {
      type: String,
      required: true,
      unique: true,
      default: generateRoomCode,
    },

    // Access control
    accessKey: {
      type: String,
      required: true,
    },
    whitelist: {
      type: [String], // Student emails
      default: [],
    },
    blacklist: {
      type: [String], // Student emails
      default: [],
    },
    waitingList: {
      type: [
        {
          userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
          computerOrder: { type: Number, default: null },
        },
      ],
      default: [],
    },

    // Entry mode: 'open' = auto-approve, 'approval' = lecturer must approve
    entryMode: {
      type: String,
      enum: ["open", "approval"],
      default: "approval",
    },

    // Classrooms linked to this session (their students are merged into whitelist)
    classroomIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Classroom",
      default: [],
    },

    // Time control
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },

    // Session status
    status: {
      type: String,
      enum: ["scheduled", "ongoing", "ended", "graded"],
      default: "scheduled",
    },

    // Metadata
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

// Indexes
// Note: roomCode already has unique: true which creates an index automatically
examSessionSchema.index({ status: 1 });
examSessionSchema.index({ createdBy: 1 });
examSessionSchema.index({ startTime: 1, endTime: 1 });

const ExamSessionModel =
  mongoose.models.ExamSession ||
  mongoose.model("ExamSession", examSessionSchema);

export default ExamSessionModel;
