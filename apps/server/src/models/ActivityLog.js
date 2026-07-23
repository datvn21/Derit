import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
  {
    // Activity type — comprehensive list for legal evidence
    activityType: {
      type: String,
      enum: [
        // Auth
        "login",
        "logout",
        // Exam participation
        "exam_join",         // student entered exam room
        "exam_exit",         // navigate away without submitting
        "exam_submit",       // student officially submitted
        // Cheating indicators
        "tab_switch",        // document.visibilityState → hidden
        "fullscreen_exit",   // left fullscreen mode
        "copy_attempt",      // Ctrl+C inside editor
        "paste_attempt",     // Ctrl+V inside editor
        "right_click",       // right-click suppressed
        // Code activity
        "code_run_all",      // run all test cases
        "code_run_testcase", // run single test case
        "code_run_console",  // free console run
        "code_autosave",     // autosave triggered
        // Lecturer actions
        "grade_update",
        "question_create",
        "exam_create",
        "session_create",
      ],
      required: true,
    },

    // Who & where
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    examSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamSession",
      default: null,
    },

    // Per-question context (for code_run_* events)
    questionNumber: {
      type: Number,
      default: null,
    },

    // Structured metadata for the event
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Network fingerprint for legal evidence
    ipAddress: {
      type: String,
      default: "",
    },
    userAgent: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: { createdAt: "timestamp", updatedAt: false },
  },
);

// Compound index: per-student timeline within a session (most common query)
activityLogSchema.index({ examSessionId: 1, userId: 1, timestamp: 1 });
// Per-session overview (lecturer views all students)
activityLogSchema.index({ examSessionId: 1, timestamp: 1 });
activityLogSchema.index({ activityType: 1, timestamp: -1 });
activityLogSchema.index({ timestamp: -1 });
// Admin user→activity→time pagination queries
activityLogSchema.index({ userId: 1, activityType: 1, timestamp: -1 });

const ActivityLogModel =
  mongoose.models.ActivityLog ||
  mongoose.model("ActivityLog", activityLogSchema);

export default ActivityLogModel;
