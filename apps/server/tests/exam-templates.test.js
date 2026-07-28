import request from "supertest";
import express from "express";
import session from "express-session";
import passport from "passport";
import examTemplateRouter from "../src/routes/examTemplate.js";
import { isAuthenticated } from "../src/middleware/middlewareAuth.js";
import { initPassport } from "../src/config/passport.js";
import ExamTemplateModel from "../src/models/ExamTemplate.js";
import UserModel from "../src/models/User.js";
import mongoose from "mongoose";

// Mock authenticated user middleware
const mockAuth = (userId, role = "lecturer") => {
  return [
    isAuthenticated,
    async (req, res, next) => {
      req.user = { id: userId };
      try {
        const user = await UserModel.findById(userId);
        if (!user) {
          const newUser = await UserModel.create({
            googleId: userId,
            email: `${userId}@test.com`,
            name: `Test User ${userId}`,
            role: role,
          });
          req.dbUser = newUser;
        } else {
          req.dbUser = user;
        }
        next();
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },
  ];
};

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

  // Mock passport to always authenticate
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));

  // Mock isAuthenticated middleware
  app.use((req, res, next) => {
    req.user = { id: userId };
    next();
  });

  app.use("/exam-templates", examTemplateRouter);
  return app;
};

// Mock authenticated request helper
const authenticatedRequest = (app, userId = "test-user-123") => {
  const agent = request.agent(app);
  // Set the session user
  return agent;
};

describe("Exam Templates Routes", () => {
  let app;
  let lecturerId = "lecturer-test-123";
  let studentId = "student-test-456";

  beforeAll(async () => {
    // Ensure MongoDB is connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_CONNECTIONSTRING || "mongodb://localhost:27017/derit-test");
    }
    
    // Create test users
    await UserModel.findOneAndUpdate(
      { googleId: lecturerId },
      { googleId: lecturerId, email: "lecturer@test.com", name: "Test Lecturer", role: "lecturer" },
      { upsert: true, new: true }
    );
    await UserModel.findOneAndUpdate(
      { googleId: studentId },
      { googleId: studentId, email: "student@test.com", name: "Test Student", role: "student" },
      { upsert: true, new: true }
    );
  });

  beforeEach(() => {
    app = createTestApp(lecturerId);
  });

  afterEach(async () => {
    await ExamTemplateModel.deleteMany({});
  });

  describe("POST /exam-templates", () => {
    const validTemplateData = {
      templateName: "Test Template",
      examType: "OOP",
      language: "java",
      duration: 60,
      examCodes: [
        {
          code: "TEST001",
          pdf: "test.pdf",
          questions: [
            { questionText: "Test question?", points: 10, testCases: [] }
          ]
        }
      ]
    };

    it("should create a new exam template", async () => {
      const response = await request(app)
        .post("/exam-templates")
        .send(validTemplateData);

      expect(response.status).toBe(201);
      expect(response.body.template).toBeDefined();
      expect(response.body.template.templateName).toBe("Test Template");
      expect(response.body.template.examType).toBe("OOP");
      expect(response.body.template.language).toBe("java");
    });

    it("should return 400 when missing required fields", async () => {
      const response = await request(app)
        .post("/exam-templates")
        .send({ templateName: "Test" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Missing required fields");
    });

    it("should return 400 when examCodes is empty", async () => {
      const response = await request(app)
        .post("/exam-templates")
        .send({ ...validTemplateData, examCodes: [] });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("At least one exam code is required");
    });

    it("should force Java language for OOP exam type", async () => {
      const response = await request(app)
        .post("/exam-templates")
        .send({ ...validTemplateData, language: "python" });

      expect(response.status).toBe(201);
      expect(response.body.template.language).toBe("java");
    });

    it("should allow Python language for General exam type", async () => {
      const response = await request(app)
        .post("/exam-templates")
        .send({ ...validTemplateData, examType: "General", language: "python" });

      expect(response.status).toBe(201);
      expect(response.body.template.language).toBe("python");
    });
  });

  describe("GET /exam-templates", () => {
    beforeEach(async () => {
      // Create test templates
      await ExamTemplateModel.create([
        {
          templateName: "Template 1",
          examType: "OOP",
          language: "java",
          duration: 60,
          examCodes: [{ code: "T1", questions: [] }],
          createdBy: (await UserModel.findOne({ googleId: lecturerId }))._id,
        },
        {
          templateName: "Template 2",
          examType: "DSA",
          language: "java",
          duration: 90,
          examCodes: [{ code: "T2", questions: [] }],
          createdBy: (await UserModel.findOne({ googleId: lecturerId }))._id,
        },
      ]);
    });

    it("should return all templates for current lecturer", async () => {
      const response = await request(app).get("/exam-templates");

      expect(response.status).toBe(200);
      expect(response.body.templates).toBeDefined();
      expect(response.body.templates.length).toBe(2);
      expect(response.body.templates[0]).toHaveProperty("examCodeCount");
    });

    it("should include exam code count in response", async () => {
      const response = await request(app).get("/exam-templates");

      expect(response.status).toBe(200);
      expect(response.body.templates[0]).toHaveProperty("examCodeCount");
      expect(typeof response.body.templates[0].examCodeCount).toBe("number");
    });
  });

  describe("GET /exam-templates/:id", () => {
    let templateId;

    beforeEach(async () => {
      const lecturer = await UserModel.findOne({ googleId: lecturerId });
      const template = await ExamTemplateModel.create({
        templateName: "Test Template",
        examType: "OOP",
        language: "java",
        duration: 60,
        examCodes: [{ code: "TEST", questions: [{ questionText: "Q1", points: 10 }] }],
        createdBy: lecturer._id,
      });
      templateId = template._id.toString();
    });

    it("should return template details", async () => {
      const response = await request(app).get(`/exam-templates/${templateId}`);

      expect(response.status).toBe(200);
      expect(response.body.template).toBeDefined();
      expect(response.body.template.templateName).toBe("Test Template");
    });

    it("should return 404 for non-existent template", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const response = await request(app).get(`/exam-templates/${fakeId}`);

      expect(response.status).toBe(404);
    });
  });

  describe("PUT /exam-templates/:id", () => {
    let templateId;

    beforeEach(async () => {
      const lecturer = await UserModel.findOne({ googleId: lecturerId });
      const template = await ExamTemplateModel.create({
        templateName: "Original Name",
        examType: "OOP",
        language: "java",
        duration: 60,
        examCodes: [{ code: "TEST", questions: [] }],
        createdBy: lecturer._id,
      });
      templateId = template._id.toString();
    });

    it("should update template name", async () => {
      const response = await request(app)
        .put(`/exam-templates/${templateId}`)
        .send({ templateName: "Updated Name" });

      expect(response.status).toBe(200);
      expect(response.body.template.templateName).toBe("Updated Name");
    });

    it("should update duration", async () => {
      const response = await request(app)
        .put(`/exam-templates/${templateId}`)
        .send({ duration: 120 });

      expect(response.status).toBe(200);
      expect(response.body.template.duration).toBe(120);
    });

    it("should return 404 for non-existent template", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .put(`/exam-templates/${fakeId}`)
        .send({ templateName: "Updated" });

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /exam-templates/:id", () => {
    let templateId;

    beforeEach(async () => {
      const lecturer = await UserModel.findOne({ googleId: lecturerId });
      const template = await ExamTemplateModel.create({
        templateName: "To Delete",
        examType: "OOP",
        language: "java",
        duration: 60,
        examCodes: [{ code: "TEST", questions: [] }],
        createdBy: lecturer._id,
      });
      templateId = template._id.toString();
    });

    it("should delete template", async () => {
      const response = await request(app).delete(`/exam-templates/${templateId}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Template deleted successfully");

      // Verify deletion
      const deleted = await ExamTemplateModel.findById(templateId);
      expect(deleted).toBeNull();
    });

    it("should return 404 for non-existent template", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const response = await request(app).delete(`/exam-templates/${fakeId}`);

      expect(response.status).toBe(404);
    });
  });

  describe("PATCH /exam-templates/:id/publish", () => {
    let templateId;

    beforeEach(async () => {
      const lecturer = await UserModel.findOne({ googleId: lecturerId });
      const template = await ExamTemplateModel.create({
        templateName: "Publish Test",
        examType: "OOP",
        language: "java",
        duration: 60,
        examCodes: [{ code: "TEST", questions: [] }],
        createdBy: lecturer._id,
        isPublished: false,
      });
      templateId = template._id.toString();
    });

    it("should publish unpublished template", async () => {
      const response = await request(app).patch(`/exam-templates/${templateId}/publish`);

      expect(response.status).toBe(200);
      expect(response.body.template.isPublished).toBe(true);
    });

    it("should unpublish published template", async () => {
      await ExamTemplateModel.findByIdAndUpdate(templateId, { isPublished: true });

      const response = await request(app).patch(`/exam-templates/${templateId}/publish`);

      expect(response.status).toBe(200);
      expect(response.body.template.isPublished).toBe(false);
    });
  });

  describe("POST /exam-templates/:id/share", () => {
    let templateId;

    beforeEach(async () => {
      const lecturer = await UserModel.findOne({ googleId: lecturerId });
      const template = await ExamTemplateModel.create({
        templateName: "Share Test",
        examType: "OOP",
        language: "java",
        duration: 60,
        examCodes: [{ code: "TEST", questions: [] }],
        createdBy: lecturer._id,
      });
      templateId = template._id.toString();
    });

    it("should share template to another lecturer", async () => {
      const response = await request(app)
        .post(`/exam-templates/${templateId}/share`)
        .send({ email: "student@test.com" });

      expect(response.status).toBe(201);
      expect(response.body.message).toContain("shared successfully");
      expect(response.body.template).toBeDefined();
      expect(response.body.template.templateName).toContain("Share Test");
    });

    it("should return 400 when sharing to self", async () => {
      const response = await request(app)
        .post(`/exam-templates/${templateId}/share`)
        .send({ email: "lecturer@test.com" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("cannot share a template with yourself");
    });

    it("should return 400 when email is missing", async () => {
      const response = await request(app)
        .post(`/exam-templates/${templateId}/share`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Email is required");
    });

    it("should return 404 for non-existent user email", async () => {
      const response = await request(app)
        .post(`/exam-templates/${templateId}/share`)
        .send({ email: "nonexistent@test.com" });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain("No user found");
    });
  });
});
