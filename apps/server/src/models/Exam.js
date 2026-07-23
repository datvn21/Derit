import mongoose from "mongoose";

const examSchema = new mongoose.Schema(
  {
    examName: {
      type: String,
      required: true
    },
    accessKey: {
      type: String,
      required: true
    },
    whitelist: {
      type: [String],
      default: [""]
    },
    pdfList: {
      type: [String],
      required: true
    },
    testcaseList: {
      type: Object,
      required: true
    }
  }
);

const ExamModel = mongoose.models.Exam || mongoose.model("Exam", examSchema);
export default ExamModel;