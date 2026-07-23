import mongoose from "mongoose";

// Test case schema for each question
const testCaseSchema = new mongoose.Schema(
  {
    input: {
      type: String,
      default: "",
    },
    expectedOutput: {
      type: String,
      default: "",
    },
    isHidden: {
      type: Boolean,
      default: false,
    },
    // Optional grader file (e.g. Test1.java) injected server-side during per-testcase run
    testFile: {
      name: { type: String, default: "" },
      content: { type: String, default: "" },
    },
    // Optional extra files (e.g. input.txt, data.inp, Helper.java) placed alongside code during run
    extraFiles: {
      type: [
        new mongoose.Schema(
          {
            name: { type: String, required: true },
            content: { type: String, default: "" },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { _id: false },
);

// Starter file schema (code provided to students)
const starterFileSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    content: { type: String, default: "" },
    canDownload: { type: Boolean, default: false },
  },
  { _id: false },
);

// Question schema for each exam code
const questionSchema = new mongoose.Schema(
  {
    questionNumber: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      default: "",
    },
    testCases: {
      type: [testCaseSchema],
      default: [],
    },
    starterFiles: {
      type: [starterFileSchema],
      default: [],
    },
    defaultMainFile: {
      type: String,
      default: "",
    },
  },
  { _id: false },
);

// Exam code schema (mã đề)
const examCodeSchema = new mongoose.Schema(
  {
    codeNumber: {
      type: String,
      required: true,
    },
    pdfUrl: {
      type: String,
      required: true,
    },
    questions: {
      type: [questionSchema],
      default: [],
    },
  },
  { _id: false },
);

// Main exam template schema
const examTemplateSchema = new mongoose.Schema(
  {
    // Template info
    templateName: {
      type: String,
      required: true,
    },
    examType: {
      type: String,
      enum: ["OOP", "DSA"],
      required: true,
    },
    language: {
      type: String,
      enum: ["java", "python"],
      required: true,
    },

    // Exam codes (mã đề)
    examCodes: {
      type: [examCodeSchema],
      default: [],
      validate: {
        validator: function (codes) {
          return codes.length > 0;
        },
        message: "At least one exam code is required",
      },
    },

    // Exam settings
    duration: {
      type: Number,
      required: true, // minutes
    },

    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
examTemplateSchema.index({ createdBy: 1 });
examTemplateSchema.index({ isPublished: 1 });
examTemplateSchema.index({ examType: 1 });

const ExamTemplateModel =
  mongoose.models.ExamTemplate ||
  mongoose.model("ExamTemplate", examTemplateSchema);

export default ExamTemplateModel;
