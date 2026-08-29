import { Router } from "express";
import StudentSubmissionModel from "../models/StudentSubmission.js";
import ExamSessionModel from "../models/ExamSession.js";
import ExamTemplateModel from "../models/ExamTemplate.js";
import StudentExamCodeModel from "../models/StudentExamCode.js";
import UserModel from "../models/User.js";
import ActivityLogModel from "../models/ActivityLog.js";
import { isAuthenticated } from "../middleware/middlewareAuth.js";
import { isLecturerOrAdmin } from "../middleware/isLecturerOrAdmin.js";
import { executeCodeLocally } from "../services/codeExecutor.js";
import { notifySessionUpdate } from "./examSession.js";
import { logActivity } from "../services/activityLogger.js";
import { BoundedCache, KeyedRateLimiter } from "../services/bounded.js";

// Normalize CRLF → LF in file content so Java compiler on Linux never sees \r
function normalizeFiles(files) {
  if (!files?.length) return files || [];
  return files.map((f) => ({
    ...f,
    content:
      typeof f.content === "string"
        ? f.content.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
        : f.content,
  }));
}
function normalizeCode(code) {
  if (typeof code !== "string") return code;
  return code.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

const submissionRouter = Router();

async function resolveCurrentUser(req) {
  if (req.dbUser) return req.dbUser;
  const googleId =
    req.user?.googleId ||
    (typeof req.user?.id === "string" ? req.user.id : undefined);
  if (!googleId) return null;
  return UserModel.findOne({ googleId });
}

// ─── G: Bounded in-memory rate limiter for /run-console ────────────────────────
// Production deployments should swap this for a Redis-backed limiter
// shared between processes.
const runConsoleRateLimiter = new KeyedRateLimiter({
  limit: 3, // max requests per user per window
  windowMs: 10_000, // 10 seconds
  maxEntries: 5000,
});

function runConsoleLimiter(req, res, next) {
  const userId = req.user?.id;
  if (!userId) return next();
  const r = runConsoleRateLimiter.hit(userId);
  res.setHeader("X-RateLimit-Limit", "3");
  res.setHeader("X-RateLimit-Remaining", String(r.remaining));
  if (!r.allowed) {
    const waitSec = Math.ceil(r.retryAfterMs / 1000);
    return res.status(429).json({
      error: `Too many run requests. Please wait ${waitSec}s before trying again.`,
    });
  }
  return next();
}

// ─── B: Bounded SSE infrastructure for push-based result delivery ───────────────
// Key format: `${submissionId}:${questionNumber}[:${testCaseIndex}]`
const SUBMISSION_SSE_MAX_KEYS = 2000;
const submissionSSEMap = new Map(); // key → Set<res>
const submissionResultCache = new BoundedCache({
  maxEntries: 2000,
  ttlMs: 60_000,
});

function sseKey(submissionId, questionNumber, testCaseIndex) {
  const base = `${submissionId}:${questionNumber}`;
  return testCaseIndex !== undefined ? `${base}:${testCaseIndex}` : base;
}

function registerSSEClient(key, res) {
  if (!submissionSSEMap.has(key)) submissionSSEMap.set(key, new Set());
  submissionSSEMap.get(key).add(res);
}

function removeSSEClient(key, res) {
  const set = submissionSSEMap.get(key);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) submissionSSEMap.delete(key);
}

function emitSSEResult(key, data) {
  submissionResultCache.set(key, data);

  const clients = submissionSSEMap.get(key);
  if (!clients) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
      res.end();
    } catch (_) {}
  }
  submissionSSEMap.delete(key);
}

// Submit code for a question (Student only)
submissionRouter.post("/", isAuthenticated, async (req, res) => {
  try {
    const user = await resolveCurrentUser(req);

    if (!user || user.role !== "student") {
      return res.status(403).json({ error: "Student only endpoint" });
    }

    const {
      examSessionId,
      questionNumber,
      code,
      language,
      files,
      mainFile,
      testCaseIndex,
    } = req.body;

    // Verify exam session exists and is ongoing
    const session =
      await ExamSessionModel.findById(examSessionId).populate("examTemplateId");

    if (!session) {
      return res.status(404).json({ error: "Exam session not found" });
    }

    if (session.status !== "ongoing") {
      return res.status(400).json({ error: "Exam is not currently ongoing" });
    }

    // Check time
    const now = new Date();
    if (now > session.endTime) {
      return res.status(400).json({ error: "Exam time has expired" });
    }

    // Get student's assigned exam code
    const studentCode = await StudentExamCodeModel.findOne({
      examSessionId,
      studentId: user._id,
    });

    if (!studentCode) {
      return res.status(403).json({ error: "No exam code assigned" });
    }

    // Get the question from template (toObject() → plain JS, ensures nested testFile.content is readable)
    const template = session.examTemplateId.toObject();
    const examCode = template.examCodes.find(
      (code) => code.codeNumber === studentCode.examCodeNumber,
    );

    if (!examCode) {
      return res.status(404).json({ error: "Exam code not found" });
    }

    const question = examCode.questions.find(
      (q) => q.questionNumber === questionNumber,
    );

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    // Verify language matches template
    if (language !== template.language) {
      return res.status(400).json({
        error: `Language must be ${template.language} for this exam`,
      });
    }

    // Find or create submission record
    let submission = await StudentSubmissionModel.findOne({
      examSessionId,
      studentId: user._id,
    });

    if (!submission) {
      submission = await StudentSubmissionModel.create({
        examSessionId,
        studentId: user._id,
        examCodeNumber: studentCode.examCodeNumber,
        submissions: [],
      });
    }

    // Add/update question submission
    const existingSubmissionIndex = submission.submissions.findIndex(
      (s) => s.questionNumber === questionNumber,
    );

    const normalizedFiles = normalizeFiles(files);
    const mainFileContent =
      normalizedFiles.find((f) => f.name === mainFile)?.content ??
      normalizedFiles[0]?.content ??
      "";
    const codeValue = normalizeCode(code) || mainFileContent;

    const newQuestionSubmission = {
      questionNumber,
      code: codeValue,
      language,
      files: normalizedFiles,
      mainFile: mainFile || null,
      status: "pending",
      testResults: [],
      totalScore: 0,
      submittedAt: new Date(),
    };

    if (existingSubmissionIndex >= 0) {
      submission.submissions[existingSubmissionIndex] = newQuestionSubmission;
    } else {
      submission.submissions.push(newQuestionSubmission);
    }

    await submission.save();

    // Execute code asynchronously
    setImmediate(async () => {
      try {
        const submissionToUpdate = await StudentSubmissionModel.findById(
          submission._id,
        );
        const questionSub = submissionToUpdate.submissions.find(
          (s) => s.questionNumber === questionNumber,
        );

        questionSub.status = "running";
        await submissionToUpdate.save();

        // --- Per-testcase run: inject testFile and run only that testcase ---
        if (testCaseIndex !== undefined && testCaseIndex !== null) {
          // Re-fetch template with .lean() inside async block to get guaranteed plain POJO
          // (avoids Mongoose subdoc getter quirks with deeply nested testFile.content)
          const templateLean = await ExamTemplateModel.findById(
            session.examTemplateId._id ?? session.examTemplateId,
          ).lean();
          const examCodeLean = templateLean.examCodes.find(
            (c) => c.codeNumber === studentCode.examCodeNumber,
          );
          const questionLean = examCodeLean?.questions.find(
            (q) => q.questionNumber === questionNumber,
          );
          const tc = questionLean?.testCases?.[testCaseIndex];
          if (!tc)
            throw new Error(`testCaseIndex ${testCaseIndex} out of bounds`);

          // Build file list: student files (or fallback to code field) + grader testFile + extraFiles
          const studentMainFile = questionSub.mainFile || "Main.java";
          const execFiles =
            questionSub.files?.length > 0
              ? questionSub.files.map((f) => ({
                  name: f.name,
                  content: f.content,
                }))
              : [{ name: studentMainFile, content: questionSub.code || "" }];
          // Inject extraFiles first (so testFile can override if names clash)
          if (tc.extraFiles && tc.extraFiles.length > 0) {
            for (const ef of tc.extraFiles) {
              if (!ef.name || !ef.content) continue;
              const idx = execFiles.findIndex((f) => f.name === ef.name);
              if (idx >= 0) execFiles.splice(idx, 1);
              execFiles.push({ name: ef.name, content: ef.content });
            }
          }
          if (tc.testFile?.name && tc.testFile?.content) {
            const idx = execFiles.findIndex((f) => f.name === tc.testFile.name);
            if (idx >= 0) execFiles.splice(idx, 1);
            execFiles.push({
              name: tc.testFile.name,
              content: tc.testFile.content,
            });
          }
          // mainFile → student's own file (always compiled first to catch syntax errors)
          // testRunFile → grader file (compiled second, then run); undefined if no grader
          const hasGrader = !!(tc.testFile?.name && tc.testFile?.content);
          const graderFile = hasGrader ? tc.testFile.name : null;

          const { results, status } = await executeCodeLocally(
            {
              code: questionSub.code,
              language: questionSub.language,
              files: execFiles,
              mainFile: studentMainFile,
              ...(graderFile ? { testRunFile: graderFile } : {}),
            },
            [tc],
          );

          const r = results[0];
          const tcResult = {
            testCaseId: testCaseIndex,
            status: r?.passed
              ? "passed"
              : r?.error?.length > 0
                ? "error"
                : "failed",
            actualOutput: r?.output ?? "",
            errorMessage: r?.error ?? "",
            executionTime: r?.executionTime ?? 0,
          };

          // Patch only this index in testResults array
          const existingResults = [...(questionSub.testResults || [])];
          while (existingResults.length <= testCaseIndex) {
            existingResults.push({
              testCaseId: existingResults.length,
              status: "pending",
              actualOutput: "",
              executionTime: 0,
            });
          }
          existingResults[testCaseIndex] = tcResult;
          questionSub.testResults = existingResults;
          questionSub.status =
            status === "compile_error"
              ? "compile_error"
              : r?.passed
                ? "accepted"
                : r?.error?.length > 0
                  ? "runtime_error"
                  : "wrong_answer";
        } else {
          // --- Full run: all testcases - run per-testcase to inject testFile/extraFiles ---
          // Re-fetch template with .lean() for guaranteed plain POJO with full file content
          const templateLean = await ExamTemplateModel.findById(
            session.examTemplateId._id ?? session.examTemplateId,
          ).lean();
          const examCodeLean = templateLean?.examCodes?.find(
            (c) => c.codeNumber === studentCode.examCodeNumber,
          );
          const questionLean = examCodeLean?.questions?.find(
            (q) => q.questionNumber === questionNumber,
          );
          const tcList = questionLean?.testCases ?? question.testCases;

          const studentMainFile = questionSub.mainFile || "Main.java";
          const allResults = [];
          let allPassed = 0;
          let compileError = null;

          for (let tcIdx = 0; tcIdx < tcList.length; tcIdx++) {
            const tc = tcList[tcIdx];

            // Build file list: student files (or fallback to code field) + extraFiles + testFile (grader)
            const execFiles =
              questionSub.files?.length > 0
                ? questionSub.files.map((f) => ({
                    name: f.name,
                    content: f.content,
                  }))
                : [{ name: studentMainFile, content: questionSub.code || "" }];

            if (tc.extraFiles?.length > 0) {
              for (const ef of tc.extraFiles) {
                if (!ef.name || !ef.content) continue;
                const i = execFiles.findIndex((f) => f.name === ef.name);
                if (i >= 0) execFiles.splice(i, 1);
                execFiles.push({ name: ef.name, content: ef.content });
              }
            }

            const hasGrader = !!(tc.testFile?.name && tc.testFile?.content);
            if (hasGrader) {
              const i = execFiles.findIndex((f) => f.name === tc.testFile.name);
              if (i >= 0) execFiles.splice(i, 1);
              execFiles.push({
                name: tc.testFile.name,
                content: tc.testFile.content,
              });
            }

            const { results, status } = await executeCodeLocally(
              {
                code: questionSub.code,
                language: questionSub.language,
                files: execFiles,
                mainFile: studentMainFile,
                ...(hasGrader ? { testRunFile: tc.testFile.name } : {}),
              },
              [tc],
            );

            if (status === "compile_error") {
              compileError = results[0]?.error ?? "Compile error";
              for (let rest = tcIdx; rest < tcList.length; rest++) {
                allResults.push({
                  testCaseId: rest,
                  status: "error",
                  actualOutput: "",
                  errorMessage: compileError,
                  executionTime: 0,
                });
              }
              break;
            }

            const r = results[0];
            const passed = r?.passed === true;
            if (passed) allPassed++;
            allResults.push({
              testCaseId: tcIdx,
              status: passed
                ? "passed"
                : r?.error?.length > 0
                  ? "error"
                  : "failed",
              actualOutput: r?.output ?? "",
              errorMessage: r?.error ?? "",
              executionTime: r?.executionTime ?? 0,
            });
          }

          questionSub.testResults = allResults;

          if (compileError) {
            questionSub.status = "compile_error";
            questionSub.errorMessage = compileError;
            questionSub.totalScore = 0;
          } else {
            questionSub.errorMessage = "";
            questionSub.totalScore =
              tcList.length > 0
                ? Math.round((allPassed / tcList.length) * 100) / 10
                : 0;

            const hasRuntimeErr = allResults.some(
              (r) => r.status === "error" && r.errorMessage?.length > 0,
            );
            if (allPassed === tcList.length) {
              questionSub.status = "accepted";
            } else if (hasRuntimeErr) {
              questionSub.status = "runtime_error";
            } else if (allPassed > 0) {
              questionSub.status = "partial";
            } else {
              questionSub.status = "wrong_answer";
            }
          }
        }

        // Recalculate final score - average of all question scores (thang 10)
        const scoredSubs = submissionToUpdate.submissions.filter(
          (s) => s.totalScore !== undefined,
        );
        submissionToUpdate.finalScore =
          scoredSubs.length > 0
            ? Math.round(
                (scoredSubs.reduce((sum, s) => sum + (s.totalScore || 0), 0) /
                  scoredSubs.length) *
                  10,
              ) / 10
            : 0;

        await submissionToUpdate.save();

        // ── Summary log ──────────────────────────────────────────────────────
        console.log(
          `[submit] ✓ ${user.name} | session="${session.sessionName}" | Q${questionNumber} score=${questionSub.totalScore?.toFixed(1) ?? 0}/10 | status=${questionSub.status}`,
        );

        // ─ B: push result to any waiting SSE client ─────────────────────────
        const ssePayload = {
          status: questionSub.status,
          testResults: questionSub.testResults,
          errorMessage: questionSub.errorMessage ?? "",
          totalScore: questionSub.totalScore ?? 0,
        };
        const key = sseKey(
          submission._id,
          questionNumber,
          testCaseIndex !== undefined ? testCaseIndex : undefined,
        );
        emitSSEResult(key, ssePayload);
      } catch (error) {
        console.error("[submission] async execution error:", error);
        try {
          const submissionToUpdate = await StudentSubmissionModel.findById(
            submission._id,
          );
          const questionSub = submissionToUpdate.submissions.find(
            (s) => s.questionNumber === questionNumber,
          );
          questionSub.status = "runtime_error";
          questionSub.errorMessage = error?.message ?? String(error);
          questionSub.testResults = [];
          await submissionToUpdate.save();

          // ─ B: push error to waiting SSE client ─────────────────────────
          const key = sseKey(
            submission._id,
            questionNumber,
            testCaseIndex !== undefined ? testCaseIndex : undefined,
          );
          emitSSEResult(key, {
            status: "runtime_error",
            testResults: [],
            errorMessage: error?.message ?? String(error),
            totalScore: 0,
          });
        } catch (saveErr) {
          console.error("[submission] failed to save error status:", saveErr);
        }
      }
    });

    // Log code run activity for audit trail
    logActivity({
      activityType:
        testCaseIndex !== undefined && testCaseIndex !== null
          ? "code_run_testcase"
          : "code_run_all",
      userId: user._id,
      examSessionId,
      questionNumber,
      details: {
        testCaseIndex: testCaseIndex ?? null,
        language,
        fileCount: (files || []).length,
        mainFile: mainFile || null,
      },
      req,
    });

    res.status(201).json({
      message: "Submission received and being processed",
      submissionId: submission._id,
      questionNumber,
      testCaseIndex: testCaseIndex ?? null,
    });
  } catch (error) {
    console.error("Error submitting code:", error);
    res.status(500).json({ error: error.message });
  }
});

// B: SSE endpoint - client connects here after POST / to receive results without polling.
// If result is already cached (execution finished before client connected), respond immediately.
submissionRouter.get("/:id/events", isAuthenticated, (req, res) => {
  const { qn, tc } = req.query; // qn = questionNumber, tc = testCaseIndex (optional)
  const key = sseKey(
    req.params.id,
    qn,
    tc !== undefined ? Number(tc) : undefined,
  );

  // Result already ready? Flush immediately as SSE then close.
  const cached = submissionResultCache.get(key);
  if (cached) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    res.write(`data: ${JSON.stringify(cached)}\n\n`);
    res.end();
    return;
  }

  // Set up long-lived SSE stream
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  if (!submissionSSEMap.has(key)) {
    if (submissionSSEMap.size >= SUBMISSION_SSE_MAX_KEYS) {
      // Drop the oldest entry to keep memory bounded.
      const oldestKey = submissionSSEMap.keys().next().value;
      const oldestSet = submissionSSEMap.get(oldestKey);
      if (oldestSet)
        for (const r of oldestSet)
          try {
            r.end();
          } catch (_) {}
      submissionSSEMap.delete(oldestKey);
    }
    submissionSSEMap.set(key, new Set());
  }
  submissionSSEMap.get(key).add(res);

  // Cleanup on client disconnect - uses the helper so the map stays consistent.
  req.on("close", () => removeSSEClient(key, res));

  // Safety timeout: 2 minutes
  const guard = setTimeout(() => {
    try {
      res.end();
    } catch (_) {}
    removeSSEClient(key, res);
  }, 120_000);
  req.on("close", () => clearTimeout(guard));
});

// Get submission status (Student only)
submissionRouter.get("/:id", isAuthenticated, async (req, res) => {
  try {
    const user = await resolveCurrentUser(req);

    const submission = await StudentSubmissionModel.findById(
      req.params.id,
    ).populate("studentId", "name email studentId");

    if (!submission) {
      return res.status(404).json({ error: "Submission not found" });
    }

    // Students can only view their own submissions
    if (
      user?.role === "student" &&
      submission.studentId._id.toString() !== user._id.toString()
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({ submission });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get my submissions for an exam session (Student only)
submissionRouter.get("/exam/:sessionId", isAuthenticated, async (req, res) => {
  try {
    const user = await resolveCurrentUser(req);

    if (!user || user.role !== "student") {
      return res.status(403).json({ error: "Student only endpoint" });
    }

    const submission = await StudentSubmissionModel.findOne({
      examSessionId: req.params.sessionId,
      studentId: user._id,
    });

    res.json({ submission: submission || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all submissions for a session (Lecturer only)
submissionRouter.get(
  "/session/:sessionId/all",
  isAuthenticated,
  isLecturerOrAdmin,
  async (req, res) => {
    try {
      // Verify lecturer owns this session
      const session = await ExamSessionModel.findOne({
        _id: req.params.sessionId,
        createdBy: req.dbUser._id,
      });

      if (!session) {
        return res
          .status(404)
          .json({ error: "Session not found or access denied" });
      }

      const submissions = await StudentSubmissionModel.find({
        examSessionId: req.params.sessionId,
      })
        .populate("studentId", "name email studentId")
        .sort({ submittedAt: -1 });

      res.json({ submissions });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Export CSV from StudentSubmission (Lecturer only) - works before Finalize
submissionRouter.get(
  "/session/:sessionId/export-csv",
  isAuthenticated,
  isLecturerOrAdmin,
  async (req, res) => {
    try {
      const session = await ExamSessionModel.findOne({
        _id: req.params.sessionId,
        createdBy: req.dbUser._id,
      });
      if (!session) {
        return res
          .status(404)
          .json({ error: "Session not found or access denied" });
      }

      const submissions = await StudentSubmissionModel.find({
        examSessionId: req.params.sessionId,
      })
        .populate("studentId", "name email studentId")
        .sort({ finalScore: -1, submittedAt: 1 });

      // Determine max question count across all submissions
      let maxQ = 0;
      for (const s of submissions) {
        for (const q of s.submissions || []) {
          if (q.questionNumber > maxQ) maxQ = q.questionNumber;
        }
      }

      // Sort submitted first by score descending for ranking
      const submitted = submissions.filter((s) => s.isSubmitted);
      submitted.sort((a, b) => b.finalScore - a.finalScore);
      const rankMap = new Map();
      submitted.forEach((s, i) => rankMap.set(s._id.toString(), i + 1));

      // Helper: wrap value so Excel won't misinterpret (e.g. 1/5 → 1-May)
      const safe = (v) => {
        const s = String(v ?? "");
        // Strings that look like fractions (digits/digits) get Excel text formula
        if (/^\d+\/\d+$/.test(s)) return `="${s}"`;
        return s;
      };
      // Wrap plain text cell (escape quotes)
      const cell = (v) => {
        const s = String(v ?? "").replace(/"/g, '""');
        return `"${s}"`;
      };

      // CSV Header
      const qHeaders = Array.from({ length: maxQ }, (_, i) => `Q${i + 1}`);
      const header = [
        "Rank",
        "Name",
        "Student ID",
        "Email",
        "Exam Code",
        ...qHeaders,
        "Passed/Total",
        "Score /10",
        "Score %",
        "Submitted",
        "Tab Switches",
      ];

      // Build rows
      const rows = submissions.map((sub) => {
        const qMap = new Map();
        let totalPassed = 0;
        let totalTests = 0;

        for (const q of sub.submissions || []) {
          const passed = (q.testResults || []).filter(
            (r) => r.status === "passed",
          ).length;
          const total = (q.testResults || []).length;
          qMap.set(q.questionNumber, { passed, total });
          totalPassed += passed;
          totalTests += total;
        }

        const qCols = Array.from({ length: maxQ }, (_, i) => {
          const d = qMap.get(i + 1);
          // e.g. ="1/5" so Excel won't convert to date
          return d ? safe(`${d.passed}/${d.total}`) : "-";
        });

        const pct =
          totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;
        const rank = sub.isSubmitted
          ? (rankMap.get(sub._id.toString()) ?? "-")
          : "-";
        const summary =
          totalTests > 0 ? safe(`${totalPassed}/${totalTests}`) : "-";
        // finalScore đã được BE tính theo thang 10
        const score10 = sub.isSubmitted
          ? (sub.finalScore ??
            (totalTests > 0
              ? Math.round((totalPassed / totalTests) * 100) / 10
              : 0))
          : "-";

        return [
          rank,
          cell(sub.studentId?.name || ""),
          sub.studentId?.studentId || "-",
          sub.studentId?.email || "-",
          sub.examCodeNumber ?? "-",
          ...qCols,
          summary,
          sub.isSubmitted
            ? typeof score10 === "number"
              ? score10.toFixed(1)
              : score10
            : "-",
          sub.isSubmitted ? `${pct}%` : "-",
          sub.isSubmitted ? "Yes" : "No",
          sub.tabSwitchCount || 0,
        ];
      });

      const csv = [header, ...rows].map((r) => r.join(",")).join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="results_${session.sessionName.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}.csv"`,
      );
      res.send("\uFEFF" + csv); // BOM for Excel UTF-8
    } catch (error) {
      console.error("[export-csv] error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// Get student's submission WITH testcase details (input + expectedOutput from template) - Lecturer only
submissionRouter.get(
  "/session/:sessionId/student/:studentId/detail",
  isAuthenticated,
  isLecturerOrAdmin,
  async (req, res) => {
    try {
      const session = await ExamSessionModel.findOne({
        _id: req.params.sessionId,
        createdBy: req.dbUser._id,
      }).populate("examTemplateId");

      if (!session) {
        return res
          .status(404)
          .json({ error: "Session not found or access denied" });
      }

      const submission = await StudentSubmissionModel.findOne({
        examSessionId: req.params.sessionId,
        studentId: req.params.studentId,
      }).populate("studentId", "name email studentId avatar");

      if (!submission) {
        return res.json({ submission: null });
      }

      const templateLean = await ExamTemplateModel.findById(
        session.examTemplateId._id ?? session.examTemplateId,
      ).lean();

      // Use examCodeNumber stored directly on the submission (more reliable than re-querying StudentExamCodeModel)
      const studentExamCodeNumber = submission.examCodeNumber;
      const examCodeLean =
        studentExamCodeNumber != null
          ? templateLean?.examCodes?.find(
              (c) => Number(c.codeNumber) === Number(studentExamCodeNumber),
            )
          : null;

      // Enrich each questionSubmission with testcase details
      const submittedQuestionNumbers = new Set(
        submission.submissions.map((s) => Number(s.questionNumber)),
      );

      const enrichedSubmissions = submission.submissions.map((questionSub) => {
        const question = examCodeLean?.questions?.find(
          (q) =>
            Number(q.questionNumber) === Number(questionSub.questionNumber),
        );

        if (!question) {
          console.warn(
            `[detail] question not found: questionNumber=${questionSub.questionNumber}` +
              ` available=[${examCodeLean?.questions?.map((q) => q.questionNumber).join(",")}]`,
          );
        }

        const enrichedTestResults = (questionSub.testResults || []).map(
          (result) => {
            // Use result.testCaseId (the actual index into testCases[]) not the array map index
            const tcIdx =
              typeof result.testCaseId === "number"
                ? result.testCaseId
                : Number(result.testCaseId) || 0;
            const tc = question?.testCases?.[tcIdx];
            if (!tc && question) {
              console.warn(
                `[detail] testCase[${tcIdx}] not found, length=${question.testCases?.length}`,
              );
            }
            return {
              ...result.toObject(),
              input: tc?.input ?? null,
              expectedOutput: tc?.expectedOutput ?? null,
              hasGrader: !!(tc?.testFile?.name && tc?.testFile?.content),
            };
          },
        );

        return {
          ...questionSub.toObject(),
          testResults: enrichedTestResults,
          questionTitle: question?.title ?? null,
        };
      });

      // Append virtual "not_submitted" entries for questions the student never touched
      // Only include non-hidden test cases so FE can show "0/N test cases"
      if (examCodeLean?.questions) {
        for (const question of examCodeLean.questions) {
          if (submittedQuestionNumbers.has(Number(question.questionNumber)))
            continue;
          const visibleTcs = (question.testCases || []).filter(
            (tc) => !tc.isHidden,
          );
          enrichedSubmissions.push({
            questionNumber: question.questionNumber,
            questionTitle: question.title ?? null,
            code: "",
            files: [],
            mainFile: null,
            language: templateLean?.language ?? "java",
            status: "not_submitted",
            totalScore: 0,
            errorMessage: "No code submitted",
            submittedAt: null,
            testResults: visibleTcs.map((tc, i) => ({
              testCaseId: i,
              status: "not_submitted",
              actualOutput: "",
              errorMessage: "Not submitted",
              executionTime: 0,
              input: tc.input ?? null,
              expectedOutput: tc.expectedOutput ?? null,
              hasGrader: !!(tc.testFile?.name && tc.testFile?.content),
            })),
          });
        }
        // Sort by questionNumber for consistent display order
        enrichedSubmissions.sort((a, b) => a.questionNumber - b.questionNumber);
      }

      res.json({
        submission: {
          ...submission.toObject(),
          submissions: enrichedSubmissions,
          examCodeNumber: studentExamCodeNumber,
          language: templateLean?.language ?? "java",
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Get student's submission (Lecturer only)
submissionRouter.get(
  "/session/:sessionId/student/:studentId",
  isAuthenticated,
  isLecturerOrAdmin,
  async (req, res) => {
    try {
      // Verify lecturer owns this session
      const session = await ExamSessionModel.findOne({
        _id: req.params.sessionId,
        createdBy: req.dbUser._id,
      });

      if (!session) {
        return res
          .status(404)
          .json({ error: "Session not found or access denied" });
      }

      const submission = await StudentSubmissionModel.findOne({
        examSessionId: req.params.sessionId,
        studentId: req.params.studentId,
      }).populate("studentId", "name email studentId");

      res.json({ submission: submission || null });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Run code freely without saving/grading – returns stdout/stderr immediately (Student only)
submissionRouter.post(
  "/run-console",
  isAuthenticated,
  runConsoleLimiter,
  async (req, res) => {
    try {
      const user = await resolveCurrentUser(req);
      if (!user || user.role !== "student") {
        return res.status(403).json({ error: "Student only endpoint" });
      }

      const { files, mainFile, language } = req.body;
      if (!files || !mainFile || !language) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Run with a single dummy testcase (empty input, no expected output check)
      const { results, status } = await executeCodeLocally(
        { code: files[0]?.content || "", language, files, mainFile },
        [{ input: "", expectedOutput: "__console__", _id: "console" }],
      );

      const r = results[0];
      res.json({
        stdout: r?.output ?? "",
        stderr: r?.error ?? "",
        executionTime: r?.executionTime ?? 0,
        status,
      });
    } catch (err) {
      console.error("[run-console] error:", err);
      res.status(500).json({ error: err.message });
    }
  },
);

// Auto-save code without triggering execution (Student only)
submissionRouter.post("/autosave", isAuthenticated, async (req, res) => {
  try {
    const user = await resolveCurrentUser(req);
    if (!user || user.role !== "student") {
      return res.status(403).json({ error: "Student only endpoint" });
    }

    const { examSessionId, questionNumber, code, language, files, mainFile } =
      req.body;

    const session = await ExamSessionModel.findById(examSessionId);
    if (!session || session.status !== "ongoing") {
      return res.status(400).json({ error: "Exam session not ongoing" });
    }

    const studentCode = await StudentExamCodeModel.findOne({
      examSessionId,
      studentId: user._id,
    });
    if (!studentCode) {
      return res.status(403).json({ error: "No exam code assigned" });
    }

    let submission = await StudentSubmissionModel.findOne({
      examSessionId,
      studentId: user._id,
    });

    if (!submission) {
      submission = await StudentSubmissionModel.create({
        examSessionId,
        studentId: user._id,
        examCodeNumber: studentCode.examCodeNumber,
        submissions: [],
      });
    }

    const idx = submission.submissions.findIndex(
      (s) => s.questionNumber === questionNumber,
    );

    const existing = idx >= 0 ? submission.submissions[idx] : null;
    const entry = {
      questionNumber,
      code: normalizeCode(code || ""),
      language,
      files: normalizeFiles(files || []),
      mainFile: mainFile || null,
      status: existing?.status ?? "pending",
      testResults: existing?.testResults ?? [],
      totalScore: existing?.totalScore ?? 0,
      submittedAt: existing?.submittedAt ?? new Date(),
    };

    if (idx >= 0) {
      submission.submissions[idx] = entry;
    } else {
      submission.submissions.push(entry);
    }

    await submission.save();
    notifySessionUpdate(examSessionId);

    res.json({ message: "Auto-saved", submissionId: submission._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Finalize exam submission (Student only)
submissionRouter.post(
  "/submit-exam/:examSessionId",
  isAuthenticated,
  async (req, res) => {
    try {
      const user = await resolveCurrentUser(req);
      if (!user || user.role !== "student") {
        return res.status(403).json({ error: "Student only endpoint" });
      }

      const examSessionId = req.params.examSessionId;

      let submission = await StudentSubmissionModel.findOne({
        examSessionId,
        studentId: user._id,
      });

      if (!submission) {
        // It's possible the student hasn't typed anything yet but just clicked submit
        const session = await ExamSessionModel.findById(examSessionId);
        if (!session || session.status !== "ongoing") {
          return res
            .status(400)
            .json({ error: "Exam session not ongoing or invalid" });
        }

        const studentCode = await StudentExamCodeModel.findOne({
          examSessionId,
          studentId: user._id,
        });

        if (!studentCode) {
          return res.status(403).json({ error: "No exam code assigned" });
        }

        submission = await StudentSubmissionModel.create({
          examSessionId,
          studentId: user._id,
          examCodeNumber: studentCode.examCodeNumber,
          submissions: [],
          isSubmitted: true,
          submittedAt: new Date(),
        });
      } else {
        submission.isSubmitted = true;
        submission.submittedAt = new Date();
        await submission.save();
      }

      notifySessionUpdate(examSessionId);

      // Log official exam submission with full evidence metadata
      logActivity({
        activityType: "exam_submit",
        userId: user._id,
        examSessionId,
        details: {
          submittedAt: new Date().toISOString(),
          questionCount: submission.submissions?.length ?? 0,
          finalScore: submission.finalScore ?? 0,
          isSubmitted: true,
        },
        req,
      });

      res.json({ message: "Exam submitted successfully", isSubmitted: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
// Record student activity during the exam (join count, tab switches)
submissionRouter.post(
  "/record-activity/:examSessionId",
  isAuthenticated,
  async (req, res) => {
    try {
      const { type } = req.body; // 'join' or 'tab_switch'

      if (!["join", "tab_switch"].includes(type)) {
        return res.status(400).json({ error: "Invalid activity type" });
      }

      const user = await resolveCurrentUser(req);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const updateField =
        type === "join" ? { joinCount: 1 } : { tabSwitchCount: 1 };

      const submission = await StudentSubmissionModel.findOneAndUpdate(
        {
          examSessionId: req.params.examSessionId,
          studentId: user._id,
        },
        { $inc: updateField },
        { returnDocument: "after" },
      );

      if (!submission) {
        return res.status(404).json({ error: "Submission record not found" });
      }

      // Log the event with timestamp + IP evidence
      logActivity({
        activityType: type === "join" ? "exam_join" : "tab_switch",
        userId: user._id,
        examSessionId: req.params.examSessionId,
        details: {
          joinCount: submission.joinCount,
          tabSwitchCount: submission.tabSwitchCount,
        },
        req,
      });

      notifySessionUpdate(req.params.examSessionId);

      res.json({
        message: "Activity recorded",
        [type === "join" ? "joinCount" : "tabSwitchCount"]:
          submission[type === "join" ? "joinCount" : "tabSwitchCount"],
      });
    } catch (error) {
      console.error("Error recording activity:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
// Record client-side cheating indicators (copy, paste, fullscreen_exit) - Student only
submissionRouter.post(
  "/record-client-event/:examSessionId",
  isAuthenticated,
  async (req, res) => {
    try {
      const { type } = req.body;
      const ALLOWED = [
        "copy_attempt",
        "paste_attempt",
        "fullscreen_exit",
        "right_click",
      ];
      if (!ALLOWED.includes(type)) {
        return res.status(400).json({ error: "Invalid event type" });
      }

      const user = await resolveCurrentUser(req);
      if (!user || user.role !== "student") {
        return res.status(403).json({ error: "Student only endpoint" });
      }

      logActivity({
        activityType: type,
        userId: user._id,
        examSessionId: req.params.examSessionId,
        details: {},
        req,
      });

      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

const REGRADE_SSE_MAX_KEYS = 500;
// ─── REGRADE: SSE infrastructure ─────────────────────────────────────────────
// Stores SSE response objects keyed by sessionId
const regradeSSEMap = new Map(); // sessionId → Set<res>
const regradeResultCache = new BoundedCache({ maxEntries: 500, ttlMs: 60_000 }); // sessionId → final event (kept 60s)

function emitRegradeEvent(sessionId, data) {
  const key = sessionId.toString();

  // Cache the final event so late-connecting SSE clients get it immediately
  if (data.type === "done" || data.type === "error") {
    regradeResultCache.set(key, data);
  }

  const clients = regradeSSEMap.get(key);
  if (!clients) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch (_) {}
  }
  // On "done" or "error", close all clients
  if (data.type === "done" || data.type === "error") {
    for (const res of clients) {
      try {
        res.end();
      } catch (_) {}
    }
    regradeSSEMap.delete(key);
  }
}

// SSE stream - client connects here to receive regrade progress
submissionRouter.get(
  "/session/:sessionId/regrade-progress",
  isAuthenticated,
  isLecturerOrAdmin,
  async (req, res) => {
    try {
      const { sessionId } = req.params;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      // If grading already finished before this client connected, flush immediately
      const cached = regradeResultCache.get(sessionId);
      if (cached) {
        res.write(`data: ${JSON.stringify(cached)}\n\n`);
        res.end();
        return;
      }

      // Bound the SSE map to prevent memory exhaustion attacks.
      if (!regradeSSEMap.has(sessionId)) {
        if (regradeSSEMap.size >= REGRADE_SSE_MAX_KEYS) {
          // Drop the oldest entry to make room
          const oldest = regradeSSEMap.keys().next().value;
          const oldestSet = regradeSSEMap.get(oldest);
          if (oldestSet)
            for (const r of oldestSet)
              try {
                r.end();
              } catch (_) {}
          regradeSSEMap.delete(oldest);
        }
        regradeSSEMap.set(sessionId, new Set());
      }
      regradeSSEMap.get(sessionId).add(res);

      req.on("close", () => {
        const clients = regradeSSEMap.get(sessionId);
        if (clients) {
          clients.delete(res);
          if (clients.size === 0) regradeSSEMap.delete(sessionId);
        }
      });

      // Safety timeout: 10 minutes
      const guard = setTimeout(() => {
        try {
          res.end();
        } catch (_) {}
        const clients = regradeSSEMap.get(sessionId);
        if (clients) clients.delete(res);
      }, 600_000);
      req.on("close", () => clearTimeout(guard));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// ─── Helper: grade a single question submission ───────────────────────────────
async function gradeQuestion(questionSub, question, templateLean) {
  // No code submitted → mark all testcases as not_submitted, score = 0
  const hasCode = !!(questionSub.code || questionSub.files?.length);
  if (!hasCode) {
    questionSub.testResults = question.testCases.map((_, i) => ({
      testCaseId: i,
      status: "pending",
      actualOutput: "",
      errorMessage: "Not submitted",
      executionTime: 0,
    }));
    questionSub.status = "not_submitted";
    questionSub.totalScore = 0;
    questionSub.errorMessage = "No code submitted";
    return;
  }

  questionSub.status = "running";
  const studentMainFile = questionSub.mainFile || "Main.java";
  const allResults = [];
  let allPassed = 0;
  let compileError = null;

  for (let tcIdx = 0; tcIdx < question.testCases.length; tcIdx++) {
    const tc = question.testCases[tcIdx];

    // Build file list: start with student files (or fallback to code field)
    // IMPORTANT: must include the student's own file even for single-file submissions
    const execFiles =
      questionSub.files?.length > 0
        ? questionSub.files.map((f) => ({ name: f.name, content: f.content }))
        : [{ name: studentMainFile, content: questionSub.code || "" }];

    if (tc.extraFiles?.length > 0) {
      for (const ef of tc.extraFiles) {
        if (!ef.name || !ef.content) continue;
        const i = execFiles.findIndex((f) => f.name === ef.name);
        if (i >= 0) execFiles.splice(i, 1);
        execFiles.push({ name: ef.name, content: ef.content });
      }
    }

    const hasGrader = !!(tc.testFile?.name && tc.testFile?.content);
    if (hasGrader) {
      const i = execFiles.findIndex((f) => f.name === tc.testFile.name);
      if (i >= 0) execFiles.splice(i, 1);
      execFiles.push({ name: tc.testFile.name, content: tc.testFile.content });
    }

    // ── Diagnostic log ──────────────────────────────────────────────────────

    const { results, status } = await executeCodeLocally(
      {
        code: questionSub.code,
        language: templateLean.language,
        files: execFiles,
        mainFile: studentMainFile,
        ...(hasGrader ? { testRunFile: tc.testFile.name } : {}),
      },
      [tc],
    );

    if (status === "compile_error") {
      compileError = results[0]?.error ?? "Compile error";
      // Mark remaining testcases as error
      for (let rest = tcIdx; rest < question.testCases.length; rest++) {
        allResults.push({
          testCaseId: rest,
          status: "error",
          actualOutput: "",
          errorMessage: compileError,
          executionTime: 0,
        });
      }
      break;
    }

    const r = results[0];
    const passed = r?.passed === true;
    if (passed) allPassed++;

    allResults.push({
      testCaseId: tcIdx,
      status: passed ? "passed" : r?.error?.length > 0 ? "error" : "failed",
      actualOutput: r?.output ?? "",
      errorMessage: r?.error ?? "",
      executionTime: r?.executionTime ?? 0,
    });
  }

  questionSub.testResults = allResults;

  if (compileError) {
    questionSub.status = "compile_error";
    questionSub.errorMessage = compileError;
    questionSub.totalScore = 0;
  } else {
    questionSub.errorMessage = "";
    questionSub.totalScore =
      question.testCases.length > 0
        ? Math.round((allPassed / question.testCases.length) * 100) / 10
        : 0;

    const hasRuntimeError = allResults.some(
      (r) => r.status === "error" && r.errorMessage?.length > 0,
    );
    if (allPassed === question.testCases.length) {
      questionSub.status = "accepted";
    } else if (hasRuntimeError) {
      questionSub.status = "runtime_error";
    } else if (allPassed > 0) {
      questionSub.status = "partial";
    } else {
      questionSub.status = "wrong_answer";
    }
  }
}

// Kick off async regrade for all submitted students (Lecturer only)
submissionRouter.post(
  "/session/:sessionId/regrade-all",
  isAuthenticated,
  isLecturerOrAdmin,
  async (req, res) => {
    try {
      // Verify lecturer owns this session
      const session = await ExamSessionModel.findOne({
        _id: req.params.sessionId,
        createdBy: req.dbUser._id,
      }).populate("examTemplateId");

      if (!session) {
        return res
          .status(404)
          .json({ error: "Session not found or access denied" });
      }

      // submittedOnly=true (default) → only grade students who clicked Submit
      // submittedOnly=false → grade ALL students in the session (even in-progress)
      const submittedOnly = req.body?.submittedOnly !== false;
      const submissionQuery = { examSessionId: req.params.sessionId };
      if (submittedOnly) submissionQuery.isSubmitted = true;

      const submissions = await StudentSubmissionModel.find(
        submissionQuery,
      ).populate("studentId", "name email");

      if (submissions.length === 0) {
        return res.json({
          message: "No submissions found to regrade",
          total: 0,
        });
      }

      // Respond immediately so client can open SSE connection
      res.json({ message: "Regrading started", total: submissions.length });

      // Run grading async after response sent
      setImmediate(async () => {
        const sessionId = req.params.sessionId;
        let graded = 0;

        try {
          // Fetch template once with .lean() to get full testFile.content
          const templateLean = await ExamTemplateModel.findById(
            session.examTemplateId._id ?? session.examTemplateId,
          ).lean();

          // Sequential grading: chấm từng sinh viên một - tránh nhiều javac chạy đồng thời
          // làm bão hòa CPU/RAM trên VPS yếu, gây Compilation timeout.
          for (const submission of submissions) {
            try {
              // Get the exam code for this student
              const studentCode = await StudentExamCodeModel.findOne({
                examSessionId: sessionId,
                studentId: submission.studentId._id,
              });

              if (!studentCode) {
                console.warn(
                  `[regrade] student ${submission.studentId.name} has no exam code - skipping`,
                );
                const count = ++graded;
                emitRegradeEvent(sessionId, {
                  type: "progress",
                  graded: count,
                  total: submissions.length,
                  studentName: submission.studentId.name,
                  skipped: true,
                  skipReason: "No exam code assigned",
                });
                continue;
              }

              const examCodeLean = templateLean?.examCodes?.find(
                (c) => c.codeNumber === studentCode.examCodeNumber,
              );

              // Pre-populate missing questions as "not_submitted" before grading
              // so students who never touched a question still appear with 0/N test cases
              if (examCodeLean?.questions) {
                const submittedQNums = new Set(
                  submission.submissions.map((s) => s.questionNumber),
                );
                for (const templateQ of examCodeLean.questions) {
                  if (submittedQNums.has(templateQ.questionNumber)) continue;
                  const visibleTcs = (templateQ.testCases || []).filter(
                    (tc) => !tc.isHidden,
                  );
                  submission.submissions.push({
                    questionNumber: templateQ.questionNumber,
                    code: "",
                    files: [],
                    mainFile: null,
                    status: "not_submitted",
                    totalScore: 0,
                    errorMessage: "No code submitted",
                    submittedAt: new Date(),
                    testResults: visibleTcs.map((_, i) => ({
                      testCaseId: i,
                      status: "not_submitted",
                      actualOutput: "",
                      errorMessage: "Not submitted",
                      executionTime: 0,
                    })),
                  });
                }
              }

              // Regrade each question in this submission
              for (const questionSub of submission.submissions) {
                const question = examCodeLean?.questions?.find(
                  (q) => q.questionNumber === questionSub.questionNumber,
                );

                // No template question or no testcases → reset to empty, skip execution
                if (!question || !question.testCases?.length) {
                  questionSub.testResults = [];
                  questionSub.totalScore = 0;
                  questionSub.status = "pending";
                  continue;
                }

                try {
                  await gradeQuestion(questionSub, question, templateLean);
                } catch (execErr) {
                  console.error(
                    `[regrade] exec error for ${submission.studentId.name} Q${questionSub.questionNumber}:`,
                    execErr,
                  );
                  questionSub.status = "runtime_error";
                  questionSub.errorMessage =
                    execErr?.message ?? String(execErr);
                  questionSub.testResults = question.testCases.map((_, i) => ({
                    testCaseId: i,
                    status: "error",
                    actualOutput: "",
                    errorMessage: execErr?.message ?? "Internal error",
                    executionTime: 0,
                  }));
                  questionSub.totalScore = 0;
                }
              }

              // Recalculate final score - average of question scores (thang 10)
              const scoredSubs = submission.submissions.filter(
                (s) => s.totalScore !== undefined,
              );
              const newFinalScore =
                scoredSubs.length > 0
                  ? Math.round(
                      (scoredSubs.reduce(
                        (sum, s) => sum + (s.totalScore || 0),
                        0,
                      ) /
                        scoredSubs.length) *
                        10,
                    ) / 10
                  : 0;

              try {
                const submissionsData = submission.submissions.map((s) =>
                  s.toObject ? s.toObject() : { ...s },
                );
                await StudentSubmissionModel.findByIdAndUpdate(submission._id, {
                  $set: {
                    submissions: submissionsData,
                    finalScore: newFinalScore,
                  },
                });
                submission.finalScore = newFinalScore;
              } catch (saveErr) {
                console.error("[regrade] save error:", saveErr);
              }

              const count = ++graded;
              console.log(
                `[regrade] ✓ ${submission.studentId.name} | session=${sessionId} | score=${newFinalScore.toFixed(1)}/10 [${count}/${submissions.length}]`,
              );
              emitRegradeEvent(sessionId, {
                type: "progress",
                graded: count,
                total: submissions.length,
                studentName: submission.studentId.name,
                studentEmail: submission.studentId.email,
                finalScore: submission.finalScore,
                questionScores: submission.submissions.map((s) => ({
                  questionNumber: s.questionNumber,
                  score: s.totalScore ?? 0,
                  status: s.status,
                  passedCount: (s.testResults || []).filter(
                    (r) => r.status === "passed",
                  ).length,
                  totalTests: (s.testResults || []).length,
                })),
              });
            } catch (studentErr) {
              console.error(
                `[regrade] unexpected error for student ${submission.studentId?.name}:`,
                studentErr,
              );
              const count = ++graded;
              emitRegradeEvent(sessionId, {
                type: "progress",
                graded: count,
                total: submissions.length,
                studentName: submission.studentId?.name ?? "Unknown",
                skipped: true,
                skipReason: studentErr?.message ?? "Unexpected error",
              });
            }
          }

          emitRegradeEvent(sessionId, {
            type: "done",
            graded,
            total: submissions.length,
          });

          // Invalidate session students cache
          notifySessionUpdate(sessionId);
        } catch (err) {
          console.error("[regrade] fatal error:", err);
          emitRegradeEvent(sessionId, {
            type: "error",
            message: err?.message ?? String(err),
          });
        }
      });
    } catch (error) {
      console.error("[regrade] route error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// ─── ACTIVITY LOG: Lecturer views student activity timeline ─────────────────

submissionRouter.get(
  "/session/:sessionId/student/:studentId/activity",
  isAuthenticated,
  isLecturerOrAdmin,
  async (req, res) => {
    try {
      // Verify the session belongs to this lecturer
      const session = await ExamSessionModel.findOne({
        _id: req.params.sessionId,
        createdBy: req.dbUser._id,
      });
      if (!session) {
        return res
          .status(404)
          .json({ error: "Session not found or access denied" });
      }

      const logs = await ActivityLogModel.find({
        examSessionId: req.params.sessionId,
        userId: req.params.studentId,
      })
        .sort({ timestamp: 1 })
        .lean();

      // Also include submission snapshot for context
      const submission = await StudentSubmissionModel.findOne({
        examSessionId: req.params.sessionId,
        studentId: req.params.studentId,
      })
        .populate("studentId", "name email studentId avatar")
        .lean();

      res.json({ logs, submission });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

export default submissionRouter;
