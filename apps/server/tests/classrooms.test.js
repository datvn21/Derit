import request from "supertest";
import express from "express";
import session from "express-session";
import passport from "passport";
import classroomRouter from "../src/routes/classroom.js";
import { initPassport } from "../src/config/passport.js";
import ClassroomModel from "../src/models/Classroom.js";
import UserModel from "../src/models/User.js";
import mongoose from "mongoose";

const createTestApp = (userId = "lecturer-test-123", role = "lecturer") => {
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

  app.use("/classrooms", classroomRouter);
  return app;
};

describe("Classrooms Routes", () => {
  let app;
  let lecturerId = "lecturer-test-123";
  let studentId = "student-test-456";
  let lecturer, student;

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
  });

  beforeEach(() => {
    app = createTestApp(lecturerId, "lecturer");
  });

  afterEach(async () => {
    await ClassroomModel.deleteMany({});
  });

  describe("POST /classrooms", () => {
    const validClassroomData = {
      name: "Test Classroom",
      description: "Test Description",
      students: ["student1", "student2", "student3@student.tdtu.edu.vn"],
    };

    it("should create a new classroom", async () => {
      const response = await request(app)
        .post("/classrooms")
        .send(validClassroomData);

      expect(response.status).toBe(201);
      expect(response.body.classroom).toBeDefined();
      expect(response.body.classroom.name).toBe("Test Classroom");
    });

    it("should return 400 when name is missing", async () => {
      const response = await request(app)
        .post("/classrooms")
        .send({ description: "Test" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Name is required");
    });

    it("should normalize student IDs to full emails", async () => {
      const response = await request(app)
        .post("/classrooms")
        .send(validClassroomData);

      expect(response.status).toBe(201);
      expect(response.body.classroom.students).toContain("student1@student.tdtu.edu.vn");
      expect(response.body.classroom.students).toContain("student3@student.tdtu.edu.vn");
    });
  });

  describe("GET /classrooms", () => {
    beforeEach(async () => {
      await ClassroomModel.create([
        { name: "Classroom 1", students: [], createdBy: lecturer._id },
        { name: "Classroom 2", students: ["student1"], createdBy: lecturer._id },
      ]);
    });

    it("should return all classrooms for lecturer", async () => {
      const response = await request(app).get("/classrooms");

      expect(response.status).toBe(200);
      expect(response.body.classrooms).toBeDefined();
      expect(response.body.classrooms.length).toBe(2);
    });

    it("should include student count", async () => {
      const response = await request(app).get("/classrooms");

      expect(response.status).toBe(200);
      expect(response.body.classrooms[0]).toHaveProperty("studentCount");
    });
  });

  describe("GET /classrooms/:id", () => {
    let classroom;

    beforeEach(async () => {
      classroom = await ClassroomModel.create({
        name: "Get Test Classroom",
        students: ["student1", "student2"],
        createdBy: lecturer._id,
      });
    });

    it("should return classroom details", async () => {
      const response = await request(app).get(`/classrooms/${classroom._id}`);

      expect(response.status).toBe(200);
      expect(response.body.classroom).toBeDefined();
      expect(response.body.classroom.name).toBe("Get Test Classroom");
    });

    it("should return 404 for non-existent classroom", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const response = await request(app).get(`/classrooms/${fakeId}`);

      expect(response.status).toBe(404);
    });
  });

  describe("PUT /classrooms/:id", () => {
    let classroom;

    beforeEach(async () => {
      classroom = await ClassroomModel.create({
        name: "Update Test Classroom",
        students: ["student1"],
        createdBy: lecturer._id,
      });
    });

    it("should update classroom name", async () => {
      const response = await request(app)
        .put(`/classrooms/${classroom._id}`)
        .send({ name: "Updated Classroom Name" });

      expect(response.status).toBe(200);
      expect(response.body.classroom.name).toBe("Updated Classroom Name");
    });

    it("should update students list", async () => {
      const response = await request(app)
        .put(`/classrooms/${classroom._id}`)
        .send({ students: ["student1", "student2", "student3"] });

      expect(response.status).toBe(200);
      expect(response.body.classroom.students.length).toBe(3);
    });

    it("should return 404 for non-existent classroom", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .put(`/classrooms/${fakeId}`)
        .send({ name: "Updated" });

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /classrooms/:id", () => {
    let classroom;

    beforeEach(async () => {
      classroom = await ClassroomModel.create({
        name: "Delete Test Classroom",
        students: [],
        createdBy: lecturer._id,
      });
    });

    it("should delete classroom", async () => {
      const response = await request(app).delete(`/classrooms/${classroom._id}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Classroom deleted successfully");

      // Verify deletion
      const deleted = await ClassroomModel.findById(classroom._id);
      expect(deleted).toBeNull();
    });

    it("should return 404 for non-existent classroom", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const response = await request(app).delete(`/classrooms/${fakeId}`);

      expect(response.status).toBe(404);
    });
  });
});
