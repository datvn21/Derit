import mongoose from "mongoose";

// Schema to track which student got which exam code
const studentExamCodeSchema = new mongoose.Schema(
  {
    examSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExamSession',
      required: true
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    examCodeNumber: {
      type: String,
      required: true
    },
    computerOrder: {
      type: Number,
      default: null,
    },
    assignedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Ensure one code per student per session
studentExamCodeSchema.index({ examSessionId: 1, studentId: 1 }, { unique: true });
studentExamCodeSchema.index({ examSessionId: 1, examCodeNumber: 1 });
// Ensure no two students share the same computerOrder in a session (sparse = ignore nulls)
studentExamCodeSchema.index({ examSessionId: 1, computerOrder: 1 }, { unique: true, sparse: true });

const StudentExamCodeModel = mongoose.models.StudentExamCode || 
  mongoose.model("StudentExamCode", studentExamCodeSchema);

export default StudentExamCodeModel;
