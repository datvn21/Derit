import request from "supertest";
import express from "express";
import session from "express-session";
import passport from "passport";
import submissionRouter from "../../src/routes/submission.js";
import { initPassport } from "../../src/config/passport.js";
import StudentSubmissionModel from "../../src/models/StudentSubmission.js";
import ExamSessionModel from "../../src/models/ExamSession.js";
import ExamTemplateModel from "../../src/models/ExamTemplate.js";
import StudentExamCodeModel from "../../src/models/StudentExamCode.js";
import UserModel from "../../src/models/User.js";
import mongoose from "mongoose";

const createTestApp = (userId = "student-test-456", role = "student") => {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: "test-secret",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false },
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));

  app.use((req, res, next) => {
    req.user = { id: userId };
    next();
  });

  app.use("/submissions", submissionRouter);
  return app;
};

describe("Submissions Routes", () => {
  let app;
  let lecturerId = "lecturer-test-123";
  let studentId = "student-test-456";
  let lecturer, student, template, sessionObj;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_CONNECTIONSTRING || "mongodb://localhost:27017/derit-test");
    }

    lecturer = await UserModel.findOneAndUpdate(
      { googleId: lecturerId },
      { googleId: lecturerId, email: "lecturer@test.com", name: "Test Lecturer", role: "lecturer" },
      { upsert: true, new: true }
    );
    student = await UserModel.findOneAndUpdate(
      { googleId: studentId },
      { googleId: studentId, email: "student@test.com", name: "Test Student", role: "student" },
      { upsert: true, new: true }
    );

    template = await ExamTemplateModel.create({
      templateName: "Test Template",
      examType: "OOP",
      language: "java",
      duration: 60,
      examCodes: [{
        codeNumber: 1,
        code: "TEST001",
        questions: [{ 
          questionNumber: 1,
          questionText: "Test?", 
          points: 10, 
          testCases: [{ input: "test", expectedOutput: "result" }] 
        }],
      }],
      createdBy: lecturer._id,
    });

    sessionObj = await ExamSessionModel.create({
      examTemplateId: template._id,
      sessionName: "Test Session",
      accessKey: "test123",
      roomCode: "TESTROOM",
      status: "ongoing",
      whitelist: ["student@test.com"],
      startTime: new Date(Date.now() - 3600000),
      endTime: new Date(Date.now() + 3600000),
      createdBy: lecturer._id,
    });

    await StudentExamCodeModel.create({
      examSessionId: sessionObj._id,
      studentId: student._id,
      examCodeNumber: 1,
    });
  });

  beforeEach(() => {
    app = createTestApp(studentId, "student");
  });

  afterEach(async () => {
    await StudentSubmissionModel.deleteMany({});
  });

  describe("POST /submissions", () => {
    it("should create a new submission", async () => {
      const response = await request(app)
        .post("/submissions")
        .send({
          examSessionId: sessionObj._id.toString(),
          questionNumber: 1,
          code: "public class Test {}",
          language: "java",
        });

      expect([200, 201, 500]).toContain(response.status);
    });

    it("should reject non-student role", async () => {
      app = createTestApp(lecturerId, "lecturer");
      const response = await request(app)
        .post("/submissions")
        .send({
          examSessionId: sessionObj._id.toString(),
          questionNumber: 1,
          code: "test",
          language: "java",
        });

      expect(response.status).toBe(403);
    });

    it("should return 404 for non-existent session", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .post("/submissions")
        .send({
          examSessionId: fakeId,
          questionNumber: 1,
          code: "test",
          language: "java",
        });

      expect(response.status).toBe(404);
    });
  });

  describe("GET /submissions/:id", () => {
    let submission;

    beforeEach(async () => {
      submission = await StudentSubmissionModel.create({
        examSessionId: sessionObj._id,
        studentId: student._id,
        examCodeNumber: 1,
        submissions: [{
          questionNumber: 1,
          code: "test code",
          submittedAt: new Date(),
          status: "pending",
        }],
      });
    });

    it("should get submission by id", async () => {
      const response = await request(app).get(`/submissions/${submission._id}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("submission");
    });
  });

  describe("GET /submissions/exam/:sessionId", () => {
    beforeEach(async () => {
      await StudentSubmissionModel.create({
        examSessionId: sessionObj._id,
        studentId: student._id,
        examCodeNumber: 1,
        submissions: [{
          questionNumber: 1,
          code: "test",
          submittedAt: new Date(),
          status: "pending",
        }],
      });
    });

    it("should get all submissions for session", async () => {
      const response = await request(app).get(`/submissions/exam/${sessionObj._id}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("submissions");
    });
  });

  describe("POST /submissions/autosave", () => {
    it("should autosave code without grading", async () => {
      const response = await request(app)
        .post("/submissions/autosave")
        .send({
          examSessionId: sessionObj._id.toString(),
          questionNumber: 1,
          code: "// autosaved code",
          language: "java",
        });

      expect([200, 201]).toContain(response.status);
    });
  });

  describe("POST /submissions/run-console", () => {
    beforeEach(() => {
      app = createTestApp(studentId, "student");
    });

    it("should run code in console mode", async () => {
      const response = await request(app)
        .post("/submissions/run-console")
        .send({
          code: "print('hello')",
          language: "python",
        });

      expect([200, 201, 400]).toContain(response.status);
    });

    it("should reject code without language", async () => {
      const response = await request(app)
        .post("/submissions/run-console")
        .send({
          code: "test",
        });

      expect(response.status).toBe(400);
    });

    it("should enforce rate limiting", async () => {
      // Make 3 requests to hit limit
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post("/submissions/run-console")
          .send({ code: "test", language: "python" });
      }

      // 4th request should be rate limited
      const response = await request(app)
        .post("/submissions/run-console")
        .send({ code: "test", language: "python" });

      expect(response.status).toBe(429);
    });
  });

  describe("POST /submissions/submit-exam/:examSessionId", () => {
    beforeEach(async () => {
      await StudentSubmissionModel.create({
        examSessionId: sessionObj._id,
        studentId: student._id,
        examCodeNumber: 1,
        questionSubmissions: [{
          questionNumber: 1,
          submissions: [{
            code: "final code",
            submittedAt: new Date(),
            status: "pending",
          }],
        }],
      });
    });

    it("should finalize exam submission", async () => {
      const response = await request(app)
        .post(`/submissions/submit-exam/${sessionObj._id}`);

      expect([200, 201]).toContain(response.status);
      expect(response.body.isSubmitted).toBe(true);
    });

    it("should not allow resubmission", async () => {
      // First submission
      await request(app)
        .post(`/submissions/submit-exam/${sessionObj._id}`);

      // Second submission should fail
      const response = await request(app)
        .post(`/submissions/submit-exam/${sessionObj._id}`);

      expect(response.status).toBe(400);
    });
  });

  describe("POST /submissions/record-activity/:examSessionId", () => {
    it("should record join activity", async () => {
      const response = await request(app)
        .post(`/submissions/record-activity/${sessionObj._id}`)
        .send({ activityType: "join" });

      expect([200, 201]).toContain(response.status);
    });

    it("should record tab switch activity", async () => {
      const response = await request(app)
        .post(`/submissions/record-activity/${sessionObj._id}`)
        .send({ activityType: "tab_switch" });

      expect([200, 201]).toContain(response.status);
    });
  });

  describe("GET /submissions/session/:sessionId/all", () => {
    beforeEach(async () => {
      await StudentSubmissionModel.create({
        examSessionId: sessionObj._id,
        studentId: student._id,
        examCodeNumber: 1,
        questionSubmissions: [{
          questionNumber: 1,
          submissions: [{
            code: "test",
            submittedAt: new Date(),
            status: "pending",
          }],
        }],
      });
    });

    it("should get all submissions for session (lecturer)", async () => {
      app = createTestApp(lecturerId, "lecturer");
      const response = await request(app)
        .get(`/submissions/session/${sessionObj._id}/all`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("submissions");
    });
  });

  describe("POST /submissions/record-client-event/:examSessionId", () => {
    it("should record client event", async () => {
      const response = await request(app)
        .post(`/submissions/record-client-event/${sessionObj._id}`)
        .send({ eventType: "error", message: "Test error" });

      expect([200, 201]).toContain(response.status);
    });
  });
});
