import mongoose from "mongoose";

// Test case result schema
const testResultSchema = new mongoose.Schema(
  {
    testCaseId: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["passed", "failed", "error", "pending"],
      required: true,
    },
    actualOutput: {
      type: String,
      default: "",
    },
    errorMessage: {
      type: String,
      default: "",
    },
    executionTime: {
      type: Number,
      default: 0, // milliseconds
    },
  },
  { _id: false },
);

// Single question submission schema
const questionSubmissionSchema = new mongoose.Schema(
  {
    questionNumber: {
      type: Number,
      required: true,
    },
    code: {
      type: String,
      default: "",
    },
    language: {
      type: String,
      required: true,
    },
    files: [
      {
        name: String,
        content: String,
      },
    ],
    mainFile: {
      type: String,
      default: null,
    },
    // Execution status: pending → running → accepted/wrong_answer/compile_error/runtime_error/time_limit_exceeded
    status: {
      type: String,
      enum: [
        "pending",
        "running",
        "accepted",
        "wrong_answer",
        "compile_error",
        "runtime_error",
        "time_limit_exceeded",
        "partial",
        "not_submitted",
      ],
      default: "pending",
    },
    testResults: {
      type: [testResultSchema],
      default: [],
    },
    errorMessage: {
      type: String,
      default: "",
    },
    // 0–100 representing percentage of test cases passed (equal weight)
    totalScore: {
      type: Number,
      default: 0,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true },
);

// Main submission schema
const studentSubmissionSchema = new mongoose.Schema(
  {
    // Student and session info
    examSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamSession",
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    examCodeNumber: {
      type: String,
      required: true, // Which exam code (mã đề) student got assigned
    },

    // Submissions per question
    submissions: {
      type: [questionSubmissionSchema],
      default: [],
    },

    // Final score
    finalScore: {
      type: Number,
      default: 0,
    },

    // Has student officially submitted the exam
    isSubmitted: {
      type: Boolean,
      default: false,
    },

    joinCount: {
      type: Number,
      default: 0,
    },

    tabSwitchCount: {
      type: Number,
      default: 0,
    },

    // Metadata
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Calculate final score before saving
studentSubmissionSchema.pre("save", function () {
  if (this.submissions && this.submissions.length > 0) {
    this.finalScore = this.submissions.reduce(
      (total, sub) => total + sub.totalScore,
      0,
    );
  }
});

// Indexes
studentSubmissionSchema.index(
  { examSessionId: 1, studentId: 1 },
  { unique: true },
);
studentSubmissionSchema.index({ studentId: 1, submittedAt: -1 });
studentSubmissionSchema.index({ examCodeNumber: 1 });

const StudentSubmissionModel =
  mongoose.models.StudentSubmission ||
  mongoose.model("StudentSubmission", studentSubmissionSchema);

export default StudentSubmissionModel;
