import request from "supertest";
import express from "express";
import session from "express-session";
import passport from "passport";
import resultRouter from "../src/routes/result.js";
import { initPassport } from "../src/config/passport.js";
import StudentSubmissionModel from "../src/models/StudentSubmission.js";
import ExamSessionModel from "../src/models/ExamSession.js";
import ExamTemplateModel from "../src/models/ExamTemplate.js";
import UserModel from "../src/models/User.js";
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

  app.use("/results", resultRouter);
  return app;
};

describe("Results Routes", () => {
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
        questions: [{ questionNumber: 1, questionText: "Test?", points: 10, testCases: [] }],
      }],
      createdBy: lecturer._id,
    });

    sessionObj = await ExamSessionModel.create({
      examTemplateId: template._id,
      sessionName: "Test Session",
      accessKey: "test123",
      roomCode: "TESTROOM",
      status: "ended",
      startTime: new Date(Date.now() - 7200000),
      endTime: new Date(Date.now() - 3600000),
      createdBy: lecturer._id,
    });

    await StudentSubmissionModel.create({
      examSessionId: sessionObj._id,
      studentId: student._id,
      examCodeNumber: 1,
      isSubmitted: true,
      finalScore: 80,
      questionSubmissions: [{
        questionNumber: 1,
        submissions: [{
          code: "test code",
          submittedAt: new Date(),
          status: "graded",
          score: 80,
        }],
      }],
    });
  });

  describe("GET /results/exam/:sessionId", () => {
    it("should return student's result for session", async () => {
      app = createTestApp(studentId, "student");
      const response = await request(app)
        .get(`/results/exam/${sessionObj._id}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("result");
    });

    it("should return 404 if no submission exists", async () => {
      app = createTestApp("nonexistent@test.com", "student");
      const fakeSessionId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/results/exam/${fakeSessionId}`);

      expect([404, 403]).toContain(response.status);
    });
  });

  describe("GET /results/history", () => {
    it("should return student's exam history", async () => {
      app = createTestApp(studentId, "student");
      const response = await request(app).get("/results/history");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("results");
      expect(Array.isArray(response.body.results)).toBe(true);
    });
  });

  describe("GET /results/session/:sessionId", () => {
    it("should return all results for session (lecturer)", async () => {
      app = createTestApp(lecturerId, "lecturer");
      const response = await request(app)
        .get(`/results/session/${sessionObj._id}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("results");
    });

    it("should return 404 for non-existent session", async () => {
      app = createTestApp(lecturerId, "lecturer");
      const fakeId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .get(`/results/session/${fakeId}`);

      expect(response.status).toBe(404);
    });
  });

  describe("GET /results/session/:sessionId/leaderboard", () => {
    it("should return leaderboard for session", async () => {
      app = createTestApp(lecturerId, "lecturer");
      const response = await request(app)
        .get(`/results/session/${sessionObj._id}/leaderboard`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("leaderboard");
    });
  });

  describe("GET /results/session/:sessionId/export", () => {
    it("should export results as CSV", async () => {
      app = createTestApp(lecturerId, "lecturer");
      const response = await request(app)
        .get(`/results/session/${sessionObj._id}/export`);

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("text/csv");
    });
  });
});
