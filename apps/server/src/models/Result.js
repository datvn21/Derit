import mongoose from "mongoose";

const questionScoreSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QuestionBank',
    required: true
  },
  bestScore: {
    type: Number,
    default: 0
  },
  totalAttempts: {
    type: Number,
    default: 0
  },
  bestSubmissionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudentSubmission',
    default: null
  }
}, { _id: false });

const resultSchema = new mongoose.Schema(
  {
    // Result info
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
    
    // Overall score
    totalScore: {
      type: Number,
      default: 0
    },
    maxPossibleScore: {
      type: Number,
      required: true
    },
    percentage: {
      type: Number,
      default: 0
    },
    rank: {
      type: Number,
      default: null
    },
    
    // Question-level breakdown
    questionScores: {
      type: [questionScoreSchema],
      default: []
    },
    
    // Time tracking
    startedAt: {
      type: Date,
      default: Date.now
    },
    lastSubmittedAt: {
      type: Date,
      default: null
    },
    totalTimeSpent: {
      type: Number,
      default: 0 // minutes
    },
    
    // Proctoring flags
    tabSwitchCount: {
      type: Number,
      default: 0
    },
    suspiciousActivities: {
      type: [String],
      default: []
    },
    
    // Status
    isFinalized: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);
resultSchema.pre('save', async function() {
  if (this.maxPossibleScore > 0) {
    this.percentage = (this.totalScore / this.maxPossibleScore) * 100;
  }
});


// Compound index for unique student per session
resultSchema.index({ examSessionId: 1, studentId: 1 }, { unique: true });
resultSchema.index({ examSessionId: 1, totalScore: -1 }); // For leaderboard
resultSchema.index({ studentId: 1, createdAt: -1 });

const ResultModel = mongoose.models.Result || 
  mongoose.model("Result", resultSchema);

export default ResultModel;
