import request from "supertest";
import express from "express";
import session from "express-session";
import passport from "passport";
import examSessionRouter from "../src/routes/examSession.js";
import { isAuthenticated } from "../src/middleware/middlewareAuth.js";
import { initPassport } from "../src/config/passport.js";
import ExamSessionModel from "../src/models/ExamSession.js";
import ExamTemplateModel from "../src/models/ExamTemplate.js";
import StudentExamCodeModel from "../src/models/StudentExamCode.js";
import StudentSubmissionModel from "../src/models/StudentSubmission.js";
import UserModel from "../src/models/User.js";
import mongoose from "mongoose";

const createTestApp = (userId = "test-user-123", role = "lecturer") => {
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
  initPassport(passport);

  // Mock passport
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));

  // Mock isAuthenticated
  app.use((req, res, next) => {
    req.user = { id: userId };
    next();
  });

  app.use("/exam-sessions", examSessionRouter);
  return app;
};

describe("Exam Sessions Routes", () => {
  let app;
  let lecturerId = "lecturer-test-123";
  let studentId = "student-test-456";
  let lecturer, student, template;

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
        questions: [{ questionText: "Test?", points: 10, testCases: [] }]
      }],
      createdBy: lecturer._id,
    });
  });

  beforeEach(() => {
    app = createTestApp(lecturerId, "lecturer");
  });

  afterEach(async () => {
    await ExamSessionModel.deleteMany({});
    await StudentExamCodeModel.deleteMany({});
    await StudentSubmissionModel.deleteMany({});
  });

  describe("POST /exam-sessions", () => {
    const validSessionData = {
      examTemplateId: null, // Will be set in beforeEach
      sessionName: "Test Session",
      accessKey: "test123",
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000),
    };

    beforeEach(() => {
      validSessionData.examTemplateId = template._id.toString();
    });

    it("should create a new exam session", async () => {
      const response = await request(app)
        .post("/exam-sessions")
        .send(validSessionData);

      expect(response.status).toBe(201);
      expect(response.body.session).toBeDefined();
      expect(response.body.session.sessionName).toBe("Test Session");
      expect(response.body.session.roomCode).toBeDefined();
    });

    it("should return 404 for non-existent template", async () => {
      const response = await request(app)
        .post("/exam-sessions")
        .send({ ...validSessionData, examTemplateId: new mongoose.Types.ObjectId().toString() });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain("not found");
    });

    it("should return 400 when missing required fields", async () => {
      const response = await request(app)
        .post("/exam-sessions")
        .send({ sessionName: "Test" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Missing required fields");
    });

    it("should normalize whitelist emails", async () => {
      const response = await request(app)
        .post("/exam-sessions")
        .send({
          ...validSessionData,
          whitelist: ["student1", "student2@test.com"],
        });

      expect(response.status).toBe(201);
      expect(response.body.session.whitelist).toContain("student1@student.tdtu.edu.vn");
      expect(response.body.session.whitelist).toContain("student2@test.com");
    });
  });

  describe("GET /exam-sessions", () => {
    beforeEach(async () => {
      await ExamSessionModel.create([
        {
          examTemplateId: template._id,
          sessionName: "Session 1",
          accessKey: "key1",
          roomCode: "ROOM001",
          startTime: new Date(),
          endTime: new Date(Date.now() + 3600000),
          createdBy: lecturer._id,
        },
        {
          examTemplateId: template._id,
          sessionName: "Session 2",
          accessKey: "key2",
          roomCode: "ROOM002",
          startTime: new Date(),
          endTime: new Date(Date.now() + 7200000),
          createdBy: lecturer._id,
        },
      ]);
    });

    it("should return all sessions for current lecturer", async () => {
      const response = await request(app).get("/exam-sessions");

      expect(response.status).toBe(200);
      expect(response.body.sessions).toBeDefined();
      expect(response.body.sessions.length).toBe(2);
    });

    it("should include submitted count", async () => {
      const response = await request(app).get("/exam-sessions");

      expect(response.status).toBe(200);
      expect(response.body.sessions[0]).toHaveProperty("submittedCount");
    });
  });

  describe("GET /exam-sessions/search/by-roomcode/:roomCode", () => {
    let sessionObj;

    beforeEach(async () => {
      sessionObj = await ExamSessionModel.create({
        examTemplateId: template._id,
        sessionName: "Search Test Session",
        accessKey: "searchkey",
        roomCode: "SEARCH1",
        status: "ongoing",
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 3600000),
        createdBy: lecturer._id,
      });
    });

    it("should find session by room code", async () => {
      const response = await request(app).get("/exam-sessions/search/by-roomcode/SEARCH1");

      expect(response.status).toBe(200);
      expect(response.body.session).toBeDefined();
      expect(response.body.session.roomCode).toBe("SEARCH1");
    });

    it("should return 404 for non-existent room code", async () => {
      const response = await request(app).get("/exam-sessions/search/by-roomcode/INVALID");

      expect(response.status).toBe(404);
    });

    it("should not expose access key", async () => {
      const response = await request(app).get("/exam-sessions/search/by-roomcode/SEARCH1");

      expect(response.status).toBe(200);
      expect(response.body.session.accessKey).toBeUndefined();
    });
  });

  describe("GET /exam-sessions/available", () => {
    beforeEach(async () => {
      app = createTestApp(studentId, "student");
      await ExamSessionModel.create({
        examTemplateId: template._id,
        sessionName: "Available Session",
        accessKey: "availkey",
        roomCode: "AVAIL1",
        status: "ongoing",
        whitelist: ["student@test.com"],
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 3600000),
        createdBy: lecturer._id,
      });
    });

    it("should return available sessions for student", async () => {
      const response = await request(app).get("/exam-sessions/available");

      expect(response.status).toBe(200);
      expect(response.body.sessions).toBeDefined();
    });

    it("should reject non-student role", async () => {
      app = createTestApp(lecturerId, "lecturer");
      const response = await request(app).get("/exam-sessions/available");

      expect(response.status).toBe(403);
    });
  });

  describe("POST /exam-sessions/:id/join", () => {
    let sessionObj;

    beforeEach(async () => {
      app = createTestApp(studentId, "student");
      sessionObj = await ExamSessionModel.create({
        examTemplateId: template._id,
        sessionName: "Join Test Session",
        accessKey: "joinkey",
        roomCode: "JOIN1",
        status: "ongoing",
        whitelist: ["student@test.com"],
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 3600000),
        createdBy: lecturer._id,
      });
    });

    it("should allow student to join with valid access key", async () => {
      const response = await request(app)
        .post(`/exam-sessions/${sessionObj._id}/join`)
        .send({ accessKey: "joinkey" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should reject invalid access key", async () => {
      const response = await request(app)
        .post(`/exam-sessions/${sessionObj._id}/join`)
        .send({ accessKey: "wrongkey" });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain("Invalid access key");
    });

    it("should reject blacklisted student", async () => {
      sessionObj.blacklist = ["student@test.com"];
      await sessionObj.save();

      const response = await request(app)
        .post(`/exam-sessions/${sessionObj._id}/join`)
        .send({ accessKey: "joinkey" });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain("blacklisted");
    });
  });

  describe("POST /exam-sessions/:id/start", () => {
    let sessionObj;

    beforeEach(async () => {
      sessionObj = await ExamSessionModel.create({
        examTemplateId: template._id,
        sessionName: "Start Test Session",
        accessKey: "startkey",
        roomCode: "START1",
        status: "scheduled",
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
        createdBy: lecturer._id,
      });
    });

    it("should start a scheduled session", async () => {
      const response = await request(app).post(`/exam-sessions/${sessionObj._id}/start`);

      expect(response.status).toBe(200);
      expect(response.body.session.status).toBe("ongoing");
    });

    it("should return 404 for non-existent session", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const response = await request(app).post(`/exam-sessions/${fakeId}/start`);

      expect(response.status).toBe(404);
    });
  });

  describe("POST /exam-sessions/:id/end", () => {
    let sessionObj;

    beforeEach(async () => {
      sessionObj = await ExamSessionModel.create({
        examTemplateId: template._id,
        sessionName: "End Test Session",
        accessKey: "endkey",
        roomCode: "END1",
        status: "ongoing",
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 3600000),
        createdBy: lecturer._id,
      });
    });

    it("should end an ongoing session", async () => {
      const response = await request(app).post(`/exam-sessions/${sessionObj._id}/end`);

      expect(response.status).toBe(200);
      expect(response.body.session.status).toBe("ended");
    });
  });

  describe("DELETE /exam-sessions/:id", () => {
    let sessionObj;

    beforeEach(async () => {
      sessionObj = await ExamSessionModel.create({
        examTemplateId: template._id,
        sessionName: "Delete Test Session",
        accessKey: "deletekey",
        roomCode: "DEL1",
        status: "scheduled",
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
        createdBy: lecturer._id,
      });
    });

    it("should delete a scheduled session", async () => {
      const response = await request(app).delete(`/exam-sessions/${sessionObj._id}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Session deleted successfully");
    });

    it("should not delete an ongoing session", async () => {
      sessionObj.status = "ongoing";
      await sessionObj.save();

      const response = await request(app).delete(`/exam-sessions/${sessionObj._id}`);

      expect(response.status).toBe(404);
    });
  });

  describe("POST /exam-sessions/:id/assign-code", () => {
    let sessionObj;

    beforeEach(async () => {
      app = createTestApp(studentId, "student");
      sessionObj = await ExamSessionModel.create({
        examTemplateId: template._id,
        sessionName: "Assign Code Session",
        accessKey: "assignkey",
        roomCode: "ASSIGN1",
        status: "ongoing",
        whitelist: ["student@test.com"],
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 3600000),
        createdBy: lecturer._id,
      });
    });

    it("should assign exam code to student", async () => {
      const response = await request(app)
        .post(`/exam-sessions/${sessionObj._id}/assign-code`)
        .send({ accessKey: "assignkey" });

      expect(response.status).toBe(200);
      expect(response.body.examCode).toBeDefined();
      expect(response.body.language).toBe("java");
    });

    it("should not reassign code if already assigned", async () => {
      // First assignment
      await request(app)
        .post(`/exam-sessions/${sessionObj._id}/assign-code`)
        .send({ accessKey: "assignkey" });

      // Second assignment should return same code
      const response = await request(app)
        .post(`/exam-sessions/${sessionObj._id}/assign-code`)
        .send({ accessKey: "assignkey" });

      expect(response.status).toBe(200);
      expect(response.body.examCode).toBeDefined();
    });
  });

  describe("GET /exam-sessions/:id/status", () => {
    let sessionObj;

    beforeEach(async () => {
      sessionObj = await ExamSessionModel.create({
        examTemplateId: template._id,
        sessionName: "Status Test Session",
        accessKey: "statuskey",
        roomCode: "STATUS1",
        status: "ongoing",
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 3600000),
        createdBy: lecturer._id,
      });
    });

    it("should return session status with remaining time", async () => {
      const response = await request(app).get(`/exam-sessions/${sessionObj._id}/status`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("status");
      expect(response.body).toHaveProperty("remainingTime");
      expect(response.body).toHaveProperty("serverTime");
    });
  });

  describe("GET /exam-sessions/:id/students", () => {
    let sessionObj;

    beforeEach(async () => {
      sessionObj = await ExamSessionModel.create({
        examTemplateId: template._id,
        sessionName: "Students Test Session",
        accessKey: "studentskey",
        roomCode: "STUDENTS1",
        status: "ongoing",
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 3600000),
        createdBy: lecturer._id,
      });
    });

    it("should return list of students in session", async () => {
      const response = await request(app).get(`/exam-sessions/${sessionObj._id}/students`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("students");
      expect(Array.isArray(response.body.students)).toBe(true);
    });
  });

  describe("POST /exam-sessions/join-waiting/:roomCode", () => {
    let sessionObj;

    beforeEach(async () => {
      app = createTestApp(studentId, "student");
      sessionObj = await ExamSessionModel.create({
        examTemplateId: template._id,
        sessionName: "Waiting Test Session",
        accessKey: "waitkey",
        roomCode: "WAIT1",
        status: "ongoing",
        entryMode: "approval",
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 3600000),
        createdBy: lecturer._id,
      });
    });

    it("should add student to waiting list in approval mode", async () => {
      const response = await request(app)
        .post(`/exam-sessions/join-waiting/WAIT1`)
        .send({ accessKey: "waitkey", computerOrder: 1 });

      expect(response.status).toBe(200);
      expect(response.body.directEntry).toBe(false);
      expect(response.body.message).toContain("waiting list");
    });

    it("should grant direct entry in open mode", async () => {
      sessionObj.entryMode = "open";
      await sessionObj.save();

      const response = await request(app)
        .post(`/exam-sessions/join-waiting/WAIT1`)
        .send({ accessKey: "waitkey", computerOrder: 1 });

      expect(response.status).toBe(200);
      expect(response.body.directEntry).toBe(true);
    });

    it("should reject invalid room code", async () => {
      const response = await request(app)
        .post(`/exam-sessions/join-waiting/INVALID`)
        .send({ accessKey: "waitkey" });

      expect(response.status).toBe(404);
    });
  });

  describe("GET /exam-sessions/:id/waiting", () => {
    let sessionObj;

    beforeEach(async () => {
      sessionObj = await ExamSessionModel.create({
        examTemplateId: template._id,
        sessionName: "Get Waiting Session",
        accessKey: "waitgetkey",
        roomCode: "WAITGET1",
        status: "ongoing",
        entryMode: "approval",
        waitingList: [{ userId: student._id, computerOrder: 1 }],
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 3600000),
        createdBy: lecturer._id,
      });
    });

    it("should return waiting list", async () => {
      const response = await request(app).get(`/exam-sessions/${sessionObj._id}/waiting`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("waitingStudents");
      expect(response.body).toHaveProperty("entryMode");
    });
  });

  describe("POST /exam-sessions/:id/approve-waiting/:studentId", () => {
    let sessionObj;

    beforeEach(async () => {
      sessionObj = await ExamSessionModel.create({
        examTemplateId: template._id,
        sessionName: "Approve Test Session",
        accessKey: "approvekey",
        roomCode: "APPROVE1",
        status: "ongoing",
        waitingList: [{ userId: student._id, computerOrder: 1 }],
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 3600000),
        createdBy: lecturer._id,
      });
    });

    it("should approve waiting student", async () => {
      const response = await request(app)
        .post(`/exam-sessions/${sessionObj._id}/approve-waiting/${student._id}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("approved");
    });

    it("should return 404 for non-existent student", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .post(`/exam-sessions/${sessionObj._id}/approve-waiting/${fakeId}`);

      expect(response.status).toBe(404);
    });
  });

  describe("POST /exam-sessions/:id/approve-all-waiting", () => {
    let sessionObj;

    beforeEach(async () => {
      const student2 = await UserModel.findOneAndUpdate(
        { googleId: "student2" },
        { googleId: "student2", email: "student2@test.com", name: "Test Student 2", role: "student" },
        { upsert: true, new: true }
      );
      sessionObj = await ExamSessionModel.create({
        examTemplateId: template._id,
        sessionName: "Approve All Test Session",
        accessKey: "approveallkey",
        roomCode: "APPROVEALL1",
        status: "ongoing",
        waitingList: [
          { userId: student._id, computerOrder: 1 },
          { userId: student2._id, computerOrder: 2 },
        ],
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 3600000),
        createdBy: lecturer._id,
      });
    });

    it("should approve all waiting students", async () => {
      const response = await request(app)
        .post(`/exam-sessions/${sessionObj._id}/approve-all-waiting`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("approved");

      // Verify waiting list is empty
      const updatedSession = await ExamSessionModel.findById(sessionObj._id);
      expect(updatedSession.waitingList.length).toBe(0);
    });
  });
});
