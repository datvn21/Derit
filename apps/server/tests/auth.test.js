import request from "supertest";
import express from "express";
import session from "express-session";
import passport from "passport";
import authRouter from "../../src/routes/auth.js";
import { initPassport } from "../../src/config/passport.js";

// Create test app
const createTestApp = () => {
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
  app.use("/auth", authRouter);
  return app;
};

describe("Auth Routes", () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  describe("GET /auth/user", () => {
    it("should return 401 when not authenticated", async () => {
      const response = await request(app).get("/auth/user");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
    });
  });

  describe("GET /auth/logout", () => {
    it("should logout successfully", async () => {
      const response = await request(app).get("/auth/logout");
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Logged out successfully");
    });
  });

  describe("GET /auth/google", () => {
    it("should redirect to Google OAuth", async () => {
      const response = await request(app).get("/auth/google");
      
      expect(response.status).toBe(302);
      expect(response.headers.location).toContain("accounts.google.com");
    });
  });

  describe("GET /auth/google/callback", () => {
    it("should handle Google OAuth callback", async () => {
      const response = await request(app).get("/auth/google/callback");
      
      // Without valid credentials, should redirect or error
      expect([302, 400, 500]).toContain(response.status);
    });
  });
});
