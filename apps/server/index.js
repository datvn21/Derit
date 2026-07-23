import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { connectDB } from "./src/config/db.js";
import passport from "passport";
import authRouter from "./src/routes/auth.js";
import session from "express-session";
import { initPassport } from "./src/config/passport.js";
import examTemplateRouter from "./src/routes/examTemplate.js";
import examSessionRouter from "./src/routes/examSession.js";
import submissionRouter from "./src/routes/submission.js";
import resultRouter from "./src/routes/result.js";
import uploadRouter from "./src/routes/upload.js";
import classroomRouter from "./src/routes/classroom.js";
import path from "path";
import { fileURLToPath } from "url";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./src/config/swagger.js";
import MongoStore from "connect-mongo";
import { cleanupDockerPool } from "./src/services/dockerExecutor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express({ limit: "5mb" });
const PORT = process.env.PORT || 5001;

//middleware
app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.set("trust proxy", 1);

// Swagger UI (only in development)
if (process.env.NODE_ENV !== "production") {
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: ".swagger-ui .topbar { display: none }",
      customSiteTitle: "DERIT API Documentation",
    }),
  );
  console.log("📚 Swagger UI available at /api-docs");
}

// Serve static files (uploaded PDFs) with caching and CORS
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    maxAge: "1d", // Cache for 1 day
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".pdf")) {
        res.set("Content-Type", "application/pdf");
        res.set(
          "Access-Control-Allow-Origin",
          process.env.FRONTEND_URL || "http://localhost:3000",
        );
        res.set("Cross-Origin-Resource-Policy", "cross-origin");
      }
    },
  }),
);

app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      (() => {
        if (process.env.NODE_ENV === "production")
          throw new Error("SESSION_SECRET env var is required in production");
        return "dev-secret-derit-local";
      })(),
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_CONNECTIONSTRING + "derit-session-store",
    }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      httpOnly: true,
    },
  }),
);
app.use(passport.initialize());
app.use(passport.session());
initPassport(passport);

/**
 * @swagger
 * /:
 *   get:
 *     summary: Welcome endpoint
 *     tags: [General]
 *     responses:
 *       200:
 *         description: Welcome message
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: Hello from DERIT API
 */
app.get("/", (req, res) => {
  res.send("Hello from DERIT API");
});

// Routes
app.use("/auth", authRouter);
app.use("/exam-templates", examTemplateRouter);
app.use("/exam-sessions", examSessionRouter);
app.use("/submissions", submissionRouter);
app.use("/results", resultRouter);
app.use("/upload", uploadRouter);
app.use("/classrooms", classroomRouter);

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`server started at port: ${PORT}`);
  });
});

// Graceful shutdown
let isShuttingDown = false;
const gracefulShutdown = async (signal) => {
  if (isShuttingDown) {
    console.log("Already shutting down, please wait...");
    return;
  }
  isShuttingDown = true;

  // Print stack trace to see WHERE the signal came from
  const stack = new Error("signal origin trace").stack;
  console.log(`\n${signal} received. Cleaning up...\n${stack}`);

  // Set a timeout to force exit if cleanup takes too long
  const forceExitTimer = setTimeout(() => {
    console.error("Cleanup timeout exceeded, forcing exit...");
    process.exit(1);
  }, 10000); // 10 seconds max

  try {
    await cleanupDockerPool();
    console.log("Docker pool cleaned up successfully");
    clearTimeout(forceExitTimer);
    process.exit(0);
  } catch (err) {
    console.error("Error during cleanup:", err.message);
    clearTimeout(forceExitTimer);
    process.exit(1);
  }
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGHUP", () => gracefulShutdown("SIGHUP"));

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

// Handle nodemon restart
process.once("SIGUSR2", async () => {
  await gracefulShutdown("SIGUSR2 (nodemon restart)");
  process.kill(process.pid, "SIGUSR2");
});
